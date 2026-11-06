/**
 * Cloudflare Pages Functions Helper for Staff/Admin RBAC
 */

import { 
  getCleanSupabaseUrl, 
  getSupabaseAnonKey, 
  supabaseGetUser 
} from '../portal/_auth_v2.js';

export async function validateStaffSession(context) {
  const { request, env = {} } = context;
  
  const authHeader = request.headers.get('Authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const isProduction = env.ENVIRONMENT === 'production';

  // Test environment fallback (ONLY for non-production unit/e2e testing)
  const testRole = request.headers.get('x-test-staff-role');
  const testUid = request.headers.get('x-test-staff-uid');
  const testTenant = request.headers.get('x-test-tenant-id');

  if (!isProduction && testRole && testUid && testTenant) {
    return {
      valid: true,
      user: {
        uid: String(testUid),
        email: 'demo@chuasport.com',
        role: String(testRole).toLowerCase(),
        tenantId: String(testTenant)
      }
    };
  }

  if (!accessToken) {
    return { valid: false, message: 'Header Authorization dengan Bearer token wajib disertakan.' };
  }

  const supabaseUrl = getCleanSupabaseUrl(env);
  const anonKey = getSupabaseAnonKey(env);

  if (!supabaseUrl || !anonKey) {
    return { valid: false, message: 'Konfigurasi Supabase tidak lengkap di server.' };
  }

  // 1. Verifikasi Token via Supabase Auth
  const userRes = await supabaseGetUser(supabaseUrl, anonKey, accessToken);
  if (!userRes.success || !userRes.user) {
    return { valid: false, message: 'Sesi staff tidak valid atau telah kedaluwarsa.' };
  }

  const user = userRes.user;
  const userUid = user.id;

  // 2. Cek Superadmin (hardcoded as per server.ts)
  if (user.email === 'erizamaulana.bramantya@gmail.com') {
    return {
      valid: true,
      user: {
        uid: userUid,
        email: user.email,
        role: 'superadmin',
        tenantId: 'global'
      }
    };
  }

  // 3. Cek Owner dari tabel tenants
  const tenantUrl = `${supabaseUrl}/rest/v1/tenants?owner_uid=eq.${encodeURIComponent(userUid)}&select=id,name`;
  const tenantResp = await fetch(tenantUrl, {
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  }).catch(() => null);

  if (tenantResp && tenantResp.ok) {
    const tenantData = await tenantResp.json().catch(() => []);
    if (Array.isArray(tenantData) && tenantData.length > 0) {
      return {
        valid: true,
        user: {
          uid: userUid,
          email: user.email,
          role: 'owner',
          tenantId: tenantData[0].id
        }
      };
    }
  }

  // 4. Cek Staff dari tabel users_staff
  const staffUrl = `${supabaseUrl}/rest/v1/users_staff?uid=eq.${encodeURIComponent(userUid)}&status=eq.active&select=role,tenant_id`;
  const staffResp = await fetch(staffUrl, {
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  }).catch(() => null);

  if (staffResp && staffResp.ok) {
    const staffData = await staffResp.json().catch(() => []);
    if (Array.isArray(staffData) && staffData.length > 0) {
      return {
        valid: true,
        user: {
          uid: userUid,
          email: user.email,
          role: staffData[0].role || 'staff',
          tenantId: staffData[0].tenant_id
        }
      };
    }
  }

  return { valid: false, message: 'Identitas staff tidak terverifikasi atau akun dinonaktifkan.' };
}

/**
 * Normalizes KK to 16 digits string.
 */
export function normalizeKK(kk) {
  if (!kk) return '';
  const clean = String(kk).replace(/\D/g, '');
  return clean.length === 16 ? clean : '';
}

/**
 * Computes HMAC-SHA256 of a string using a secret.
 */
export async function computeHMAC(text, secret) {
  if (!text || !secret) return null;
  
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const textData = enc.encode(text);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, textData);
  
  // Convert to Hex
  const byteArray = new Uint8Array(signature);
  return Array.from(byteArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
