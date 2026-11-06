/**
 * Cloudflare Pages Functions Helper: Backfill KK_HMAC Infrastructure
 * Handles Cryptographic Verification, Preflight Checks, Atomic Execution & Rollback.
 */

import { validateStaffSession, normalizeKK, computeHMAC } from '../tenant/_auth_staff.js';
import { getCleanSupabaseUrl, getSupabaseAnonKey } from '../portal/_auth_v2.js';

export async function validateSuperadmin(context) {
  const authResult = await validateStaffSession(context);
  if (!authResult.valid) {
    return {
      authorized: false,
      status: 401,
      message: authResult.message || 'Sesi tidak valid.'
    };
  }

  const user = authResult.user;
  if (user.role !== 'superadmin') {
    return {
      authorized: false,
      status: 403,
      message: 'Akses ditolak. Operasi administratif backfill hanya diizinkan untuk superadmin.'
    };
  }

  return {
    authorized: true,
    user
  };
}

/**
 * Checks cryptographic engine readiness without exposing the secret or full HMAC.
 */
export async function checkCryptoEngineStatus(secret) {
  if (!secret) {
    return {
      configured: false,
      ready: false,
      algorithm: 'HMAC-SHA-256',
      outputLength: 0
    };
  }

  try {
    const testSample = '1234567890123456';
    const testSignature = await computeHMAC(testSample, secret);
    const isValidHex64 = typeof testSignature === 'string' && /^[0-9a-f]{64}$/.test(testSignature);

    return {
      configured: true,
      ready: isValidHex64,
      algorithm: 'HMAC-SHA-256',
      outputLength: testSignature ? testSignature.length : 0
    };
  } catch (err) {
    return {
      configured: true,
      ready: false,
      algorithm: 'HMAC-SHA-256',
      outputLength: 0,
      error: 'CRYPTO_ENGINE_ERROR'
    };
  }
}

/**
 * Perform 100% Read-Only Dry-Run Analysis
 * Zero INSERT, Zero UPDATE, Zero Run record, Zero Audit record.
 */
export async function performDryRunAnalysis(supabaseUrl, serviceRoleKey, secret, tenantFilter = null) {
  // Sumber KK harus berasal dari kolom no_kk yang sudah terverifikasi (BUKAN nik_kk)
  let queryUrl = `${supabaseUrl}/rest/v1/students?select=id,tenant_id,no_kk,nik_kk,kk_hmac,kk_last4&order=id.asc`;
  if (tenantFilter && tenantFilter !== 'global') {
    queryUrl += `&tenant_id=eq.${encodeURIComponent(tenantFilter)}`;
  }

  const resp = await fetch(queryUrl, {
    method: 'GET',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Accept': 'application/json'
    }
  }).catch(() => null);

  if (!resp || !resp.ok) {
    throw new Error('Gagal membaca data siswa dari database.');
  }

  const students = await resp.json().catch(() => []);

  let summary = {
    totalStudents: students.length,
    validSourceKK: 0,
    invalidSourceKK: 0,
    unverifiedLegacyNikKk: 0,
    nullOrEmptyHmac: 0,
    validFormatHmac: 0,
    corruptHmac: 0,
    hmacMismatch: 0,
    missingLast4: 0,
    backfillCandidates: 0,
    estimatedProcessable: 0
  };

  for (const s of students) {
    // Membaca no_kk (Nomor KK terverifikasi)
    const rawKK = s.no_kk;
    const cleanKK = normalizeKK(rawKK);
    const hasValidSourceKK = Boolean(cleanKK);

    if (hasValidSourceKK) {
      summary.validSourceKK++;
    } else {
      summary.invalidSourceKK++;
      if (!rawKK && s.nik_kk) {
        summary.unverifiedLegacyNikKk++;
      }
    }

    const currHmac = s.kk_hmac ? String(s.kk_hmac).trim() : null;
    const currLast4 = s.kk_last4 ? String(s.kk_last4).trim() : null;

    if (!currHmac) {
      summary.nullOrEmptyHmac++;
      if (hasValidSourceKK) {
        summary.backfillCandidates++;
        summary.estimatedProcessable++;
      }
    } else if (/^[0-9a-f]{64}$/.test(currHmac)) {
      summary.validFormatHmac++;

      if (hasValidSourceKK && secret) {
        const expectedHmac = await computeHMAC(cleanKK, secret);
        if (expectedHmac !== currHmac) {
          summary.hmacMismatch++;
        }
      }

      if (!currLast4 || currLast4.length !== 4) {
        summary.missingLast4++;
      }
    } else {
      summary.corruptHmac++;
    }
  }

  return summary;
}
