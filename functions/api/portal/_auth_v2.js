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
 * Strict IPv4 validator (RFC 791).
 * - Exactly 4 decimal octets separated by '.'
 * - Range 0-255 per octet
 * - Strictly NO leading zeros (e.g., '01', '00' are invalid; '0' is valid)
 * - Strictly digits only (no signs, letters, colons, ports, spaces)
 */
export function isValidIpv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (/\s/.test(ip)) return false;

  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  for (let i = 0; i < 4; i++) {
    const part = parts[i];
    if (!/^\d+$/.test(part)) return false;
    if (part.length > 1 && part.startsWith('0')) return false;
    const num = Number(part);
    if (num < 0 || num > 255) return false;
  }
  return true;
}

/**
 * Strict RFC 4291 compliant IPv6 validator.
 * - Supports full 8-hextet format
 * - Supports compressed '::' notation (at most one '::' in total)
 * - Supports unspecified (::) and loopback (::1)
 * - Supports IPv4-mapped (::ffff:x.x.x.x) and IPv4-embedded (e.g., 2001:db8::x.x.x.x)
 * - Strictly rejects zone identifiers (%eth0, etc.)
 * - Strictly rejects port numbers, brackets, whitespace, and non-hex characters
 * - Rejects excessive hextets and empty/oversized hextets (>4 hex chars)
 */
export function isValidIpv6(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (/\s/.test(ip)) return false;

  // Strictly reject zone IDs (e.g. %eth0), brackets, and non-delimiter illegal punctuation
  if (ip.includes('%') || ip.includes('[') || ip.includes(']')) return false;

  // Check for IPv4-embedded or IPv4-mapped syntax (e.g., ::ffff:192.0.2.128, 2001:db8::192.0.2.128)
  let ipv6Prefix = ip;
  let embeddedIpv4Hextets = 0;

  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':');
    if (lastColon === -1) return false;

    const ipv4Part = ip.slice(lastColon + 1);
    if (!isValidIpv4(ipv4Part)) return false;

    embeddedIpv4Hextets = 2; // IPv4 address occupies 32 bits = 2 x 16-bit hextets
    const beforeIpv4 = ip.slice(0, lastColon);

    // If beforeIpv4 ends with ':', that means the original address had '::' right before IPv4 (e.g., '::192.0.2.1' or '2001:db8::192.0.2.1')
    if (beforeIpv4.endsWith(':')) {
      ipv6Prefix = beforeIpv4 + ':';
    } else {
      ipv6Prefix = beforeIpv4;
    }
  }

  // Check double-colon '::' occurrences
  const firstDoubleColon = ipv6Prefix.indexOf('::');
  if (firstDoubleColon !== -1) {
    if (ipv6Prefix.indexOf('::', firstDoubleColon + 1) !== -1) {
      // More than one '::' is strictly invalid
      return false;
    }
  }

  // Disallow leading or trailing single colon (e.g., ':2001:...', '...:2001:')
  // '::' at beginning or end is valid, but single colon is not.
  if (ipv6Prefix.startsWith(':') && !ipv6Prefix.startsWith('::')) return false;
  if (ipv6Prefix.endsWith(':') && !ipv6Prefix.endsWith('::')) return false;

  let leftParts = [];
  let rightParts = [];

  if (firstDoubleColon !== -1) {
    const leftStr = ipv6Prefix.slice(0, firstDoubleColon);
    const rightStr = ipv6Prefix.slice(firstDoubleColon + 2);

    if (leftStr.length > 0) {
      leftParts = leftStr.split(':');
    }
    if (rightStr.length > 0) {
      rightParts = rightStr.split(':');
    }
  } else {
    leftParts = ipv6Prefix.split(':');
  }

  const allParts = [...leftParts, ...rightParts];

  // Each hextet must be 1 to 4 hexadecimal digits
  for (const part of allParts) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
      return false;
    }
  }

  const totalHextets = allParts.length + embeddedIpv4Hextets;

  if (firstDoubleColon !== -1) {
    // With '::', it must replace at least one 16-bit hextet, so total specified hextets must be < 8
    return totalHextets < 8;
  } else {
    // Without '::', must have exactly 8 hextets
    return totalHextets === 8;
  }
}

/**
 * Strict IPv4 and IPv6 format validator.
 * Ensures the IP string strictly conforms to valid IP representation without dummy values.
 */
export function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (/\s/.test(ip)) return false;
  return isValidIpv4(ip) || isValidIpv6(ip);
}

/**
 * Strict Cloudflare Client IP extraction.
 * 'cf-connecting-ip' is provided and validated directly by Cloudflare edge proxy
 * and CANNOT be forged by client HTTP headers.
 *
 * Security Rules:
 * - Only inspect 'cf-connecting-ip'.
 * - Removed 'true-client-ip' fallback (not guaranteed in non-Enterprise Cloudflare tiers).
 * - Never fallback to untrusted client-supplied 'x-forwarded-for'.
 * - Never silently fallback to '127.0.0.1'.
 * - Strict regex format validation for IPv4 and IPv6.
 * - Fail-closed: If header is absent or value is not a valid IPv4/IPv6 address, returns null.
 */
export function getTrustedClientIp(request) {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && typeof cfIp === 'string') {
    const trimmed = cfIp.trim();
    if (isValidIp(trimmed)) {
      return trimmed;
    }
  }

  // Fail-closed: No fallback to true-client-ip, x-forwarded-for, or dummy IP
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
 * - IP hard rate limit:   `v2_ratelimit:ip:<ipHash>` (Maks 30 req / 900s)
 * - Email failed log:     `v2_ratelimit:email_failed:<emailHash>` (Risk tracking)
 *
 * KV Storage Behavior & Characteristics:
 * - Eventually Consistent: Cloudflare KV replicates asynchronously across global edge points.
 * - Rolling TTL Window: Each write via `put` with `expirationTtl` resets the key's TTL from the
 *   moment of write (rolling window).
 * - For strictly serialized atomic increments without rolling window reset, Cloudflare Durable
 *   Objects can be integrated in a later stage.
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
 * Record failed login attempt for an email target in KV (Audit / Risk Tracking).
 * Crucial Anti-Lockout Design:
 * - This does NOT block or lock legitimate parent logins.
 * - Legitimate parents providing the correct password will NOT be denied login
 *   due to malicious 3rd parties attempting incorrect passwords from other IPs.
 */
export async function recordV2FailedLogin(context, storageKey, windowSeconds = 900) {
  const { env = {} } = context;
  const isProduction = env.ENVIRONMENT === 'production';
  const kvBinding = env.PORTAL_RATELIMIT_KV || env.PORTAL_SESSIONS_KV;

  if (kvBinding) {
    try {
      const currentVal = await kvBinding.get(storageKey);
      let count = 0;
      if (currentVal !== null && currentVal !== undefined) {
        const parsed = Number(currentVal);
        if (!isNaN(parsed) && parsed >= 0) {
          count = parsed;
        }
      }
      const nextCount = count + 1;
      await kvBinding.put(storageKey, String(nextCount), { expirationTtl: windowSeconds });
      return { success: true, count: nextCount };
    } catch (err) {
      console.error('Failed to record failed login in KV:', err);
      return { success: false, error: err.message };
    }
  }

  if (!isProduction) {
    globalThis.__chuvator_v2_ratelimits = globalThis.__chuvator_v2_ratelimits || new Map();
    const now = Date.now();
    const entry = globalThis.__chuvator_v2_ratelimits.get(storageKey);
    let currentCount = 0;
    if (entry && entry.expiresAt > now) {
      currentCount = entry.count;
    }
    const nextCount = currentCount + 1;
    globalThis.__chuvator_v2_ratelimits.set(storageKey, {
      count: nextCount,
      expiresAt: now + windowSeconds * 1000
    });
    return { success: true, count: nextCount };
  }

  return { success: false, reason: 'No KV store available' };
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
 * Call Supabase Auth: signInWithPassword via REST API using anon key only.
 * Classifies failure modes:
 * - 'INVALID_CREDENTIALS': Wrong password, unconfirmed email, or user not found (HTTP 400 + invalid_grant).
 * - 'UPSTREAM_ERROR': Supabase outage (5xx), network exception, DNS error, timeout.
 * - 'CONFIG_OR_CLIENT_ERROR': Missing/invalid API keys (401/403) or malformed parameters.
 */
export async function supabaseSignInWithPassword(supabaseUrl, anonKey, email, password) {
  const url = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey
      },
      body: JSON.stringify({ email, password })
    });
  } catch (networkErr) {
    console.error('Supabase Auth network/fetch exception:', networkErr.message);
    return {
      success: false,
      category: 'UPSTREAM_ERROR',
      status: 503,
      error: networkErr.message || 'Layanan autentikasi gagal dihubungi.'
    };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const status = response.status;
    const errorMsg = data?.error_description || data?.msg || data?.message || data?.error || '';
    const errorCode = data?.error_code || data?.error || '';

    // Upstream 5xx server errors
    if (status >= 500) {
      return {
        success: false,
        category: 'UPSTREAM_ERROR',
        status,
        error: errorMsg || 'Layanan autentikasi upstream sedang bermasalah.'
      };
    }

    // Config errors (401/403: API key invalid / permission denied)
    if (status === 401 || status === 403) {
      return {
        success: false,
        category: 'CONFIG_OR_CLIENT_ERROR',
        status,
        error: errorMsg || 'Konfigurasi kunci autentikasi tidak valid.'
      };
    }

    // HTTP 400: Differentiate invalid credentials from other client errors
    if (status === 400) {
      const isInvalidCredentials =
        errorCode === 'invalid_grant' ||
        errorCode === 'invalid_credentials' ||
        /invalid.*credential/i.test(errorMsg) ||
        /email.*not.*confirm/i.test(errorMsg) ||
        /user.*not.*found/i.test(errorMsg);

      if (isInvalidCredentials) {
        return {
          success: false,
          category: 'INVALID_CREDENTIALS',
          status: 400,
          error: errorMsg || 'Kredensial tidak valid.'
        };
      }

      return {
        success: false,
        category: 'CONFIG_OR_CLIENT_ERROR',
        status: 400,
        error: errorMsg || 'Format permintaan autentikasi tidak valid.'
      };
    }

    // Fallback for other 4xx status codes
    return {
      success: false,
      category: 'CONFIG_OR_CLIENT_ERROR',
      status,
      error: errorMsg || 'Permintaan autentikasi gagal diproses.'
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
