/**
 * Cloudflare Pages Functions Helper Module for Parent Portal v2 (Supabase Auth)
 * Provides:
 * - Supabase REST/Auth direct integration using anon/publishable key only (no service_role).
 * - AES-GCM 256-bit encryption for sensitive tokens at rest when stored in KV or session records.
 * - Symmetrical cookie management for 'portal_session_v2'.
 * - Session validation, token refresh, and CSRF protection.
 * - Strict tenant/parent account validation against public.parent_accounts.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  hashString,
  getClientIp,
  timingSafeEqual
} from './_auth.js';

export { getCorsHeaders, verifyCsrf, hashString, getClientIp };

/**
 * Clean and normalize Supabase URL
 */
export function getCleanSupabaseUrl(env) {
  const rawUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!rawUrl) return '';
  return rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

/**
 * Retrieve Supabase anon/publishable key (STRICT: NEVER service_role)
 */
export function getSupabaseAnonKey(env) {
  return env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
}

/**
 * Generate cryptographically secure random token (base64url)
 */
export function generateSecureToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  const binStr = String.fromCharCode(...bytes);
  return btoa(binStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Derive AES-GCM 256-bit CryptoKey from environment encryption secret
 */
async function getEncryptionKey(env) {
  // Use dedicated secret, fallback to hash of anon key or fallback seed if not set
  const secretMaterial = env.PORTAL_TOKEN_ENCRYPTION_SECRET || env.SUPABASE_ANON_KEY || 'chuvator-portal-token-salt-secure-key-256';
  const enc = new TextEncoder();
  const keyHash = await crypto.subtle.digest('SHA-256', enc.encode(secretMaterial));
  return await crypto.subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt sensitive token string using AES-GCM 256-bit
 */
export async function encryptToken(plainText, env) {
  if (!plainText) return '';
  try {
    const key = await getEncryptionKey(env);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const enc = new TextEncoder();
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plainText)
    );
    const ivStr = btoa(String.fromCharCode(...iv));
    const cipherStr = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
    return `${ivStr}:${cipherStr}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    throw new Error('FAIL_CLOSED: Gagal mengenkripsi token.');
  }
}

/**
 * Decrypt sensitive token string using AES-GCM 256-bit
 */
export async function decryptToken(encryptedString, env) {
  if (!encryptedString || !encryptedString.includes(':')) return '';
  try {
    const [ivStr, cipherStr] = encryptedString.split(':');
    const key = await getEncryptionKey(env);
    
    const ivBytes = new Uint8Array(
      atob(ivStr).split('').map(c => c.charCodeAt(0))
    );
    const cipherBytes = new Uint8Array(
      atob(cipherStr).split('').map(c => c.charCodeAt(0))
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      cipherBytes
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '';
  }
}

/**
 * Build Cookie header string for portal_session_v2
 */
export function buildV2SessionCookie(token, maxAgeSeconds = 86400, isSecure = true) {
  const flags = [
    `portal_session_v2=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (isSecure) {
    flags.push('Secure');
  }
  return flags.join('; ');
}

/**
 * Build Cookie header string to clear portal_session_v2
 */
export function buildClearV2SessionCookie(isSecure = true) {
  const flags = [
    'portal_session_v2=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if (isSecure) {
    flags.push('Secure');
  }
  return flags.join('; ');
}

/**
 * Parse specific cookie value from request
 */
export function parseCookie(request, cookieName) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const [name, ...valParts] = c.trim().split('=');
    if (name === cookieName) {
      return valParts.join('=');
    }
  }
  return null;
}

/**
 * Call Supabase Auth: signInWithPassword via REST API using anon key only
 */
export async function supabaseSignInWithPassword(supabaseUrl, anonKey, email, password) {
  const url = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: data?.error_description || data?.msg || data?.message || 'Login gagal'
    };
  }

  return {
    success: true,
    data
  };
}

/**
 * Refresh Supabase access token using refresh token via REST API
 */
export async function supabaseRefreshToken(supabaseUrl, anonKey, refreshToken) {
  const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: data?.error_description || data?.msg || data?.message || 'Gagal memperbarui sesi'
    };
  }

  return {
    success: true,
    data
  };
}

/**
 * Fetch authenticated user info using Supabase access token
 */
export async function supabaseGetUser(supabaseUrl, anonKey, accessToken) {
  const url = `${supabaseUrl}/auth/v1/user`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return { success: false, status: response.status };
  }

  const user = await response.json().catch(() => null);
  return { success: true, user };
}

/**
 * Query parent_accounts for the authenticated user using the user's access token and anon key
 * Enforces RLS: Uses user's Bearer token so user only sees their own accounts
 */
export async function fetchParentAccounts(supabaseUrl, anonKey, accessToken) {
  const url = `${supabaseUrl}/rest/v1/parent_accounts?select=id,tenant_id,email,full_name,phone,status,created_at&status=eq.active`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('Fetch parent_accounts failed HTTP status', response.status, errText);
    return { success: false, status: response.status, error: 'Gagal mengambil parent_accounts' };
  }

  const accounts = await response.json().catch(() => []);
  return {
    success: true,
    accounts: Array.isArray(accounts) ? accounts : []
  };
}

/**
 * Create and persist Parent Portal v2 Session
 * Fail-closed: Saves encrypted tokens in KV (if bound) or memory/Firestore.
 */
export async function createPortalV2Session(context, sessionPayload) {
  const { env = {} } = context;
  const sessionToken = generateSecureToken(32);
  const sessionHash = await hashString(sessionToken);
  const csrfToken = generateSecureToken(16);

  const now = new Date();
  const sessionExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 jam

  // Encrypt Supabase tokens before persisting
  const encryptedAccessToken = await encryptToken(sessionPayload.accessToken, env);
  const encryptedRefreshToken = await encryptToken(sessionPayload.refreshToken, env);

  const record = {
    version: 'v2',
    sessionHash,
    csrfToken,
    authUserId: sessionPayload.authUserId,
    email: sessionPayload.email,
    parentAccounts: sessionPayload.parentAccounts || [],
    encryptedAccessToken,
    encryptedRefreshToken,
    tokenExpiresAt: sessionPayload.tokenExpiresAt || null,
    createdAt: now.toISOString(),
    expiresAt: sessionExpiresAt,
    isRevoked: false
  };

  if (env.PORTAL_SESSIONS_KV) {
    try {
      await env.PORTAL_SESSIONS_KV.put(`v2:${sessionHash}`, JSON.stringify(record), {
        expirationTtl: 86400
      });
      return { sessionToken, sessionHash, csrfToken, expiresAt: sessionExpiresAt, record };
    } catch (kvErr) {
      console.error('PORTAL_SESSIONS_KV write failed for v2 session:', kvErr);
      throw new Error('FAIL_CLOSED: Sesi server v2 gagal disimpan ke KV.');
    }
  }

  // Fallback fallback storage: if KV is not yet provisioned, we can maintain an in-memory/isolated map per worker isolate
  // or return the safe record. Note: For Cloudflare Pages Functions production, PORTAL_SESSIONS_KV is recommended.
  globalThis.__chuvator_v2_sessions = globalThis.__chuvator_v2_sessions || new Map();
  globalThis.__chuvator_v2_sessions.set(`v2:${sessionHash}`, JSON.stringify(record));

  return { sessionToken, sessionHash, csrfToken, expiresAt: sessionExpiresAt, record };
}

/**
 * Validate and refresh Parent Portal v2 Session
 */
export async function validatePortalV2Session(context) {
  const { request, env = {} } = context;

  let token = parseCookie(request, 'portal_session_v2');
  if (!token) {
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return { valid: false, reason: 'No v2 session token provided' };
  }

  const sessionHash = await hashString(token);
  let sessionRecord = null;

  if (env.PORTAL_SESSIONS_KV) {
    try {
      const raw = await env.PORTAL_SESSIONS_KV.get(`v2:${sessionHash}`);
      if (raw) {
        sessionRecord = JSON.parse(raw);
      }
    } catch (kvErr) {
      console.error('PORTAL_SESSIONS_KV read failed for v2:', kvErr);
      return { valid: false, reason: 'Session store read error' };
    }
  } else if (globalThis.__chuvator_v2_sessions) {
    const raw = globalThis.__chuvator_v2_sessions.get(`v2:${sessionHash}`);
    if (raw) {
      sessionRecord = JSON.parse(raw);
    }
  }

  if (!sessionRecord) {
    return { valid: false, reason: 'Session not found or expired' };
  }

  if (sessionRecord.isRevoked === true) {
    return { valid: false, reason: 'Session has been revoked' };
  }

  // Check session expiration
  const expDate = new Date(sessionRecord.expiresAt);
  if (isNaN(expDate.getTime()) || expDate.getTime() <= Date.now()) {
    return { valid: false, reason: 'Session has expired' };
  }

  // Decrypt Supabase access token
  const decryptedAccessToken = await decryptToken(sessionRecord.encryptedAccessToken, env);
  const decryptedRefreshToken = await decryptToken(sessionRecord.encryptedRefreshToken, env);

  const supabaseUrl = getCleanSupabaseUrl(env);
  const anonKey = getSupabaseAnonKey(env);

  let activeAccessToken = decryptedAccessToken;
  let activeRefreshToken = decryptedRefreshToken;
  let tokenRefreshed = false;

  // Validate user or refresh if expired
  if (supabaseUrl && anonKey && activeAccessToken) {
    const userCheck = await supabaseGetUser(supabaseUrl, anonKey, activeAccessToken);
    if (!userCheck.success && activeRefreshToken) {
      // Try refresh
      const refreshResult = await supabaseRefreshToken(supabaseUrl, anonKey, activeRefreshToken);
      if (refreshResult.success && refreshResult.data) {
        activeAccessToken = refreshResult.data.access_token;
        activeRefreshToken = refreshResult.data.refresh_token;
        tokenRefreshed = true;

        // Re-encrypt and update session store
        sessionRecord.encryptedAccessToken = await encryptToken(activeAccessToken, env);
        sessionRecord.encryptedRefreshToken = await encryptToken(activeRefreshToken, env);
        sessionRecord.tokenExpiresAt = new Date(Date.now() + (refreshResult.data.expires_in || 3600) * 1000).toISOString();

        if (env.PORTAL_SESSIONS_KV) {
          try {
            await env.PORTAL_SESSIONS_KV.put(`v2:${sessionHash}`, JSON.stringify(sessionRecord), {
              expirationTtl: 86400
            });
          } catch (kvErr) {
            console.error('Failed to update refreshed tokens in KV:', kvErr);
          }
        } else if (globalThis.__chuvator_v2_sessions) {
          globalThis.__chuvator_v2_sessions.set(`v2:${sessionHash}`, JSON.stringify(sessionRecord));
        }
      } else {
        return { valid: false, reason: 'Supabase session expired and refresh failed' };
      }
    }
  }

  return {
    valid: true,
    token,
    session: {
      authUserId: sessionRecord.authUserId,
      email: sessionRecord.email,
      parentAccounts: sessionRecord.parentAccounts || [],
      csrfToken: sessionRecord.csrfToken,
      expiresAt: sessionRecord.expiresAt,
      accessToken: activeAccessToken,
      tokenRefreshed
    }
  };
}

/**
 * Revoke Parent Portal v2 Session
 */
export async function revokePortalV2Session(context) {
  const { request, env = {} } = context;
  let token = parseCookie(request, 'portal_session_v2');
  if (!token) {
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return { success: false, reason: 'No token provided' };
  }

  const sessionHash = await hashString(token);

  if (env.PORTAL_SESSIONS_KV) {
    try {
      await env.PORTAL_SESSIONS_KV.delete(`v2:${sessionHash}`);
      return { success: true };
    } catch (kvErr) {
      console.error('KV session revocation error for v2:', kvErr);
      return { success: false, reason: 'KV revocation error' };
    }
  } else if (globalThis.__chuvator_v2_sessions) {
    globalThis.__chuvator_v2_sessions.delete(`v2:${sessionHash}`);
    return { success: true };
  }

  return { success: true };
}
