/**
 * Cloudflare Pages Functions Helper: Backfill KK_HMAC Infrastructure
 * Handles Cryptographic Verification, Preflight Checks, Atomic Execution & Rollback.
 */

import { validateStaffSession, normalizeKK, computeHMAC } from '../tenant/_auth_staff.js';
import { getCleanSupabaseUrl, getSupabaseAnonKey } from '../portal/_auth_v2.js';

export async function validateBackfillAdmin(context) {
  const authResult = await validateStaffSession(context);
  if (!authResult.valid) {
    return {
      authorized: false,
      status: 401,
      message: authResult.message || 'Sesi staf tidak valid atau telah kedaluwarsa.'
    };
  }

  const user = authResult.user;
  const allowedRoles = new Set(['superadmin', 'owner', 'admin']);

  if (!allowedRoles.has(user.role)) {
    return {
      authorized: false,
      status: 403,
      message: `Akses ditolak. Peran '${user.role}' tidak memiliki wewenang administratif untuk mengelola data siswa (Hanya Superadmin, Owner, dan Admin).`
    };
  }

  return {
    authorized: true,
    user
  };
}

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
 * Zero INSERT, Zero UPDATE, Zero Run record, Zero Audit record, Zero RPC calls.
 * Uses Keyset Pagination (order=id.asc, limit=50) and strict no_kk source validation.
 * Categorizes each student record into: ELIGIBLE, ALREADY_VALID, INVALID_SOURCE, MISSING_LAST4, CORRUPT_HMAC, HMAC_MISMATCH.
 * Output contains ONLY non-sensitive fields (id, tenant_id, category). NO NIK, NO full KK, NO full HMAC, NO secret.
 * @param {string} supabaseUrl
 * @param {string} serviceRoleKey
 * @param {string} secret
 * @param {string|null} [tenantFilter=null]
 */
export async function performDryRunAnalysis(supabaseUrl, serviceRoleKey, secret, tenantFilter = null) {
  let summary = {
    totalStudents: 0,
    validSourceKK: 0,
    invalidSourceKK: 0,
    nullOrEmptyHmac: 0,
    validFormatHmac: 0,
    corruptHmac: 0,
    hmacMismatch: 0,
    missingLast4: 0,
    backfillCandidates: 0,
    estimatedProcessable: 0
  };

  let categories = {
    ELIGIBLE: 0,
    ALREADY_VALID: 0,
    INVALID_SOURCE: 0,
    MISSING_LAST4: 0,
    CORRUPT_HMAC: 0,
    HMAC_MISMATCH: 0
  };

  let items = [];

  const batchSize = 50; // Keyset pagination batch limit (max 50)
  let lastId = null;
  let hasMore = true;

  while (hasMore) {
    let queryUrl = `${supabaseUrl}/rest/v1/students?select=id,tenant_id,no_kk,kk_hmac,kk_last4&order=id.asc&limit=${batchSize}`;
    if (tenantFilter && tenantFilter !== 'global') {
      queryUrl += `&tenant_id=eq.${encodeURIComponent(tenantFilter)}`;
    }
    if (lastId) {
      queryUrl += `&id=gt.${encodeURIComponent(lastId)}`;
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
    if (!students || students.length === 0) {
      hasMore = false;
      break;
    }

    for (const s of students) {
      lastId = s.id;
      summary.totalStudents++;

      let category = 'INVALID_SOURCE';

      // Membaca HANYA no_kk (Nomor KK terverifikasi) sebagai sumber resmi
      const rawKK = s.no_kk;
      const cleanKK = normalizeKK(rawKK);
      const hasValidSourceKK = Boolean(cleanKK);

      const currHmac = s.kk_hmac ? String(s.kk_hmac).trim().toLowerCase() : null;
      const currLast4 = s.kk_last4 ? String(s.kk_last4).trim() : null;
      const hasValidLast4 = Boolean(currLast4 && /^[0-9]{4}$/.test(currLast4));

      if (!hasValidSourceKK) {
        category = 'INVALID_SOURCE';
        summary.invalidSourceKK++;
      } else {
        summary.validSourceKK++;
        const expectedHmac = secret ? await computeHMAC(cleanKK, secret) : null;

        if (!currHmac) {
          category = 'ELIGIBLE';
          summary.nullOrEmptyHmac++;
          summary.backfillCandidates++;
          summary.estimatedProcessable++;
        } else if (!/^[0-9a-f]{64}$/.test(currHmac)) {
          category = 'CORRUPT_HMAC';
          summary.corruptHmac++;
        } else {
          // Format HMAC valid 64 hex
          summary.validFormatHmac++;

          if (expectedHmac && currHmac !== expectedHmac) {
            category = 'HMAC_MISMATCH';
            summary.hmacMismatch++;
          } else {
            // HMAC cocok dengan hasil perhitungan sumber KK
            if (hasValidLast4) {
              category = 'ALREADY_VALID';
            } else {
              category = 'MISSING_LAST4';
              summary.missingLast4++;
            }
          }
        }
      }

      if (categories[category] !== undefined) {
        categories[category]++;
      }

      // HANYA data non-sensitif (tanpa NIK, tanpa KK lengkap, tanpa HMAC lengkap, tanpa secret)
      items.push({
        id: s.id,
        tenant_id: s.tenant_id,
        category
      });
    }

    if (students.length < batchSize) {
      hasMore = false;
    }
  }

  return {
    ...summary,
    categories,
    items
  };
}
