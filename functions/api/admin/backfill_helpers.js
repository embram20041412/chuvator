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
 * Output contains ONLY non-sensitive aggregate fields. NO PII, NO identifiers.
 * @param {string} supabaseUrl
 * @param {string} serviceRoleKey
 * @param {string} secret
 * @param {string|null} [tenantFilter=null]
 */
export async function performDryRunAnalysis(supabaseUrl, serviceRoleKey, secret, tenantFilter = null) {
  const startedAt = new Date().toISOString();
  let summary = {
    totalStudents: 0,
    eligibleCandidates: 0,
    reviewRequired: 0
  };

  let categories = {
    ELIGIBLE: 0,
    ALREADY_VALID: 0,
    MISSING_NO_KK: 0,
    INVALID_NO_KK: 0,
    MISSING_LAST4: 0,
    LAST4_MISMATCH: 0,
    CORRUPT_HMAC: 0,
    HMAC_MISMATCH: 0,
    LAST4_WITHOUT_HMAC: 0
  };

  const batchSize = 50; 
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

      const rawKK = s.no_kk ? String(s.no_kk).trim() : '';
      const cleanKK = normalizeKK(rawKK);
      const currHmac = s.kk_hmac ? String(s.kk_hmac).trim().toLowerCase() : null;
      const currLast4 = s.kk_last4 ? String(s.kk_last4).trim() : null;
      
      let category = 'INVALID_NO_KK';

      // 1. Validasi No. KK
      if (!rawKK) {
        category = 'MISSING_NO_KK';
        summary.reviewRequired++;
      } else if (!cleanKK) {
        category = 'INVALID_NO_KK';
        summary.reviewRequired++;
      } else {
        // No. KK Valid (16 digits)
        const expectedHmac = secret ? await computeHMAC(cleanKK, secret) : null;
        const expectedLast4 = cleanKK.slice(-4);

        if (!currHmac) {
          // HMAC Kosong
          if (!currLast4) {
            category = 'ELIGIBLE';
            summary.eligibleCandidates++;
          } else {
            category = 'LAST4_WITHOUT_HMAC';
            summary.reviewRequired++;
          }
        } else if (!/^[0-9a-f]{64}$/.test(currHmac)) {
          // HMAC Ada tapi corrupt (bukan 64 hex)
          category = 'CORRUPT_HMAC';
          summary.reviewRequired++;
        } else if (expectedHmac && currHmac !== expectedHmac) {
          // HMAC Ada tapi mismatch
          category = 'HMAC_MISMATCH';
          summary.reviewRequired++;
        } else {
          // HMAC Cocok
          if (!currLast4) {
            category = 'MISSING_LAST4';
            summary.reviewRequired++;
          } else if (currLast4 !== expectedLast4) {
            category = 'LAST4_MISMATCH';
            summary.reviewRequired++;
          } else {
            category = 'ALREADY_VALID';
          }
        }
      }

      if (categories[category] !== undefined) {
        categories[category]++;
      }
    }

    if (students.length < batchSize) {
      hasMore = false;
    }
  }

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    ...summary,
    categories
  };
}
