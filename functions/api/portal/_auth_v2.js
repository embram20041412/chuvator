/**
 * Cloudflare Pages Functions Helper Module for Parent Portal v2 (Supabase Auth)
 * Provides:
 * - Supabase REST/Auth direct integration using anon/publishable key only (no service_role).
 * - Multi-tenant child & account resolution via database RPC `parent_get_children(p_tenant_id DEFAULT NULL)`.
 * - Mandatory strict encryption for sensitive tokens using AES-GCM 256-bit with PORTAL_TOKEN_ENCRYPTION_SECRET.
 * - Symmetrical cookie management for 'portal_session_v2'.
 * - Production-enforced fail-closed session storage (PORTAL_SESSIONS_KV).
 * - Pure Edge Rate Limiting (Dual-counter: IP & Email) WITHOUT Firestore.
 * - Strict Cloudflare Client IP extraction ('cf-connecting-ip') without silent 127.0.0.1 fallback.
 * - Session validation, auto-refresh of Supabase tokens, and CSRF protection.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  hashString
} from './_auth.js';

export { getCorsHeaders, verifyCsrf, hashString };

/**
 * Strict Cloudflare Client IP extraction.
 * 'cf-connecting-ip' is provided and validated directly by Cloudflare edge proxy
 * and CANNOT be forged by client HTTP headers.
 * Never fallback to untrusted client-supplied 'x-forwarded-for'.
 * Never silently fallback to '127.0.0.1'. If absent or invalid, returns null.
 */
export function getTrustedClientIp(request) {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && typeof cfIp === 'string') {
    const trimmed = cfIp.trim();
    if (trimmed && trimmed.length >= 7 && trimmed.length <= 45) {
      return trimmed;
    }
  }

  // True-Client-IP fallback provided by Cloudflare Enterprise if cf-connecting-ip is absent
  const trueClientIp = request.headers.get('true-client-ip');
  if (trueClientIp && typeof trueClientIp === 'string') {
    const trimmed = trueClientIp.trim();
    if (trimmed && trimmed.length >= 7 && trimmed.length <= 45) {
      return trimmed;
    }
  }

  // Fail-closed: No silent dummy IP fallback
  return null;
}

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
 * Derive AES-GCM 256-bit CryptoKey strictly from PORTAL_TOKEN_ENCRYPTION_SECRET.
 * NO FALLBACK to anon keys, publishable keys, or hardcoded strings.
 */
async function getEncryptionKey(env) {
  const secretMaterial = (env.PORTAL_TOKEN_ENCRYPTION_SECRET || '').trim();
  if (!secretMaterial) {
    throw new Error('FAIL_CLOSED: PORTAL_TOKEN_ENCRYPTION_SECRET tidak dikonfigurasi. Enkripsi token ditolak.');
  }

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
 * Encrypt sensitive token string using AES-GCM 256-bit.
 * Generates a fresh random 12-byte IV for every single encryption.
 */
export async function encryptToken(plainText, env) {
  if (!plainText) return '';
  const key = await getEncryptionKey(env);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv); // Fresh random IV for every operation
  const enc = new TextEncoder();
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );
  const ivStr = btoa(String.fromCharCode(...iv));
  const cipherStr = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
  return `${ivStr}:${cipherStr}`;
}

/**
 * Decrypt sensitive token string using AES-GCM 256-bit.
 * Fails closed if secret is missing or ciphertext cannot be verified.
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
    console.error('Decryption failed or invalid key:', err.message);
    return '';
  }
}

/**
 * Pure Edge Rate Limiting Counter for Parent Portal v2 (NO FIRESTORE).
 * Evaluates and increments an isolated rate limit key.
 *
 * Key format convention in KV:
 * - IP rate limit:    `v2_ratelimit:ip:<ipHash>`
 * - Email rate limit: `v2_ratelimit:email:<emailHash>`
 *
 * NOTE: Cloudflare KV is an eventually consistent key-value store, not an atomic counter.
 * For strict atomic serialization, Durable Objects can be bound in the future.
 *
 * Fails closed in production if no KV storage is available.
 */
export async function checkV2RateLimit(context, storageKey, maxAttempts = 5, windowSeconds = 900) {
  const { env = {} } = context;
  const isProduction = env.ENVIRONMENT === 'production';

  // Mode 1: Cloudflare KV Namespace (Dedicated PORTAL_RATELIMIT_KV or isolated namespace in PORTAL_SESSIONS_KV)
  const kvBinding = env.PORTAL_RATELIMIT_KV || env.PORTAL_SESSIONS_KV;
  if (kvBinding) {
    try {
      const currentVal = await kvBinding.get(storageKey);
      let count = 0;
      if (currentVal !== null && currentVal !== undefined) {
        count = Number(currentVal);
        if (isNaN(count) || count < 0) {
          // Corrupted value -> FAIL-CLOSED
          console.error('Invalid counter value in rate limit store for key:', storageKey);
          return { allowed: false, count: maxAttempts, error: true };
        }
      }

      // Check limit
      const nextCount = count + 1;
      const isAllowed = count < maxAttempts;

      // Always record/increment attempt to accurately accumulate brute-force attempts
      await kvBinding.put(storageKey, String(nextCount), { expirationTtl: windowSeconds });

      return { allowed: isAllowed, count: nextCount, atomic: false };
    } catch (kvErr) {
      console.error('KV v2 rate limit error for key:', kvErr);
      // FAIL-CLOSED: Lock request if rate limit store fails
      return { allowed: false, count: maxAttempts, error: true };
    }
  }

  // Mode 2: Local memory fallback ONLY for non-production development environments
  if (!isProduction) {
    globalThis.__chuvator_v2_ratelimits = globalThis.__chuvator_v2_ratelimits || new Map();
    const now = Date.now();
    const entry = globalThis.__chuvator_v2_ratelimits.get(storageKey);

    if (entry && entry.expiresAt > now) {
      const nextCount = entry.count + 1;
      const isAllowed = entry.count < maxAttempts;
      entry.count = nextCount;
      return { allowed: isAllowed, count: nextCount, atomic: false };
    }

    globalThis.__chuvator_v2_ratelimits.set(storageKey, {
      count: 1,
      expiresAt: now + windowSeconds * 1000
    });
    return { allowed: true, count: 1, atomic: false };
  }

  // If in production and NO KV is configured -> FAIL-CLOSED without contacting Firestore
  console.error('FAIL_CLOSED: No valid KV rate limit store configured in production.');
  return { allowed: false, count: maxAttempts, error: true };
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
 * Fetch linked children & accessible tenants via RPC `parent_get_children(p_tenant_id DEFAULT NULL)`
 * Uses authenticated user's access token and anon key.
 * Respects RLS and internal auth.uid() validation in database.
 */
export async function fetchChildrenViaRpc(supabaseUrl, anonKey, accessToken) {
  const url = `${supabaseUrl}/rest/v1/rpc/parent_get_children`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({}) // p_tenant_id has DEFAULT NULL in database
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('RPC parent_get_children failed HTTP status', response.status, errText);
    return { success: false, status: response.status, error: 'Gagal mengeksekusi RPC parent_get_children' };
  }

  const result = await response.json().catch(() => null);
  if (!Array.isArray(result)) {
    return { success: false, status: 500, error: 'Format respons RPC tidak valid' };
  }

  return {
    success: true,
    children: result
  };
}

/**
 * Create and persist Parent Portal v2 Session.
 * Production rule: PORTAL_SESSIONS_KV is strictly mandatory in production.
 */
export async function createPortalV2Session(context, sessionPayload) {
  const { env = {} } = context;
  const isProduction = env.ENVIRONMENT === 'production';

  // Rule: Production must NOT use memory fallback
  if (isProduction && !env.PORTAL_SESSIONS_KV) {
    throw new Error('CONFIG_ERROR: PORTAL_SESSIONS_KV binding wajib tersedia pada environment production.');
  }

  const sessionToken = generateSecureToken(32);
  const sessionHash = await hashString(sessionToken);
  const csrfToken = generateSecureToken(16);

  const now = new Date();
  const sessionExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 jam

  // Encrypt Supabase tokens before persisting (Strict AES-256-GCM)
  const encryptedAccessToken = await encryptToken(sessionPayload.accessToken, env);
  const encryptedRefreshToken = await encryptToken(sessionPayload.refreshToken, env);

  const record = {
    version: 'v2',
    sessionHash,
    csrfToken,
    authUserId: sessionPayload.authUserId,
    email: sessionPayload.email,
    accessibleTenants: sessionPayload.accessibleTenants || [],
    childrenSummary: sessionPayload.childrenSummary || [],
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

  // Memory fallback ONLY for non-production development environments
  globalThis.__chuvator_v2_sessions = globalThis.__chuvator_v2_sessions || new Map();
  globalThis.__chuvator_v2_sessions.set(`v2:${sessionHash}`, JSON.stringify(record));

  return { sessionToken, sessionHash, csrfToken, expiresAt: sessionExpiresAt, record };
}

/**
 * Validate and refresh Parent Portal v2 Session.
 * Production rule: PORTAL_SESSIONS_KV is strictly mandatory in production.
 */
export async function validatePortalV2Session(context) {
  const { request, env = {} } = context;
  const isProduction = env.ENVIRONMENT === 'production';

  if (isProduction && !env.PORTAL_SESSIONS_KV) {
    return { valid: false, reason: 'CONFIG_ERROR: PORTAL_SESSIONS_KV binding required in production' };
  }

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
  } else if (!isProduction && globalThis.__chuvator_v2_sessions) {
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

  // Decrypt Supabase tokens
  const decryptedAccessToken = await decryptToken(sessionRecord.encryptedAccessToken, env);
  const decryptedRefreshToken = await decryptToken(sessionRecord.encryptedRefreshToken, env);

  if (!decryptedAccessToken) {
    return { valid: false, reason: 'Session token decryption failed' };
  }

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
        } else if (!isProduction && globalThis.__chuvator_v2_sessions) {
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
      accessibleTenants: sessionRecord.accessibleTenants || [],
      childrenSummary: sessionRecord.childrenSummary || [],
      csrfToken: sessionRecord.csrfToken,
      expiresAt: sessionExpiresAt,
      accessToken: activeAccessToken,
      tokenRefreshed
    }
  };
}

/**
 * Revoke Parent Portal v2 Session
 * Production rule: Fail closed if KV is not available in production.
 */
export async function revokePortalV2Session(context) {
  const { request, env = {} } = context;
  const isProduction = env.ENVIRONMENT === 'production';

  if (isProduction && !env.PORTAL_SESSIONS_KV) {
    return { success: false, reason: 'CONFIG_ERROR: PORTAL_SESSIONS_KV required in production' };
  }

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
  } else if (!isProduction && globalThis.__chuvator_v2_sessions) {
    globalThis.__chuvator_v2_sessions.delete(`v2:${sessionHash}`);
    return { success: true };
  }

  return { success: true };
}
