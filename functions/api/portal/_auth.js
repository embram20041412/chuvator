/**
 * Cloudflare Pages Functions Edge Helper Module for Portal Wali Murid (STAGE 7G.2A-HOTFIX)
 * Provides cryptographic PBKDF2 PIN hashing, fail-closed session management,
 * strict origin CORS/CSRF validation, fail-closed rate limiting, and data minimization.
 */

// Helper to convert PEM private key to ArrayBuffer for Web Crypto API
export function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
    .replace(/-----END [A-Z0-9 ]+-----/g, '')
    .replace(/[\r\n\s]+/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Base64URL string encoder
export function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ArrayBuffer to Base64URL encoder
export function bufferToBase64Url(buf) {
  const binStr = String.fromCharCode(...new Uint8Array(buf));
  return btoa(binStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ArrayBuffer to Hex string encoder
export function bufferToHex(buf) {
  const byteArray = new Uint8Array(buf);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Hex string to Uint8Array decoder
export function hexToBuffer(hexString) {
  if (!hexString || typeof hexString !== 'string') return new Uint8Array(0);
  const cleanHex = hexString.trim();
  const bytes = new Uint8Array(Math.floor(cleanHex.length / 2));
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generate Google OAuth2 Access Token using RS256 Web Crypto in Edge runtime
 */
export async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  if (!clientEmail || !privateKeyPem) return null;

  try {
    const cleanPem = privateKeyPem.replace(/\\n/g, '\n').trim();
    const keyBuffer = pemToArrayBuffer(cleanPem);

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: { name: 'SHA-256' }
      },
      false,
      ['sign']
    );

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
      scope: 'https://www.googleapis.com/auth/datastore'
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaims = base64UrlEncode(JSON.stringify(claimSet));
    const unsignedToken = `${encodedHeader}.${encodedClaims}`;

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );

    const signedJwt = `${unsignedToken}.${bufferToBase64Url(signature)}`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google OAuth token exchange failed (${tokenResponse.status}): ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (err) {
    throw new Error(`Auth Error: ${err.message}`);
  }
}

/**
 * Unwraps Firestore typed values into standard JS primitives/objects
 */
export function parseFirestoreValue(val) {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    return parseFirestoreFields(val.mapValue.fields);
  }
  return Object.values(val)[0];
}

export function parseFirestoreFields(fields) {
  if (!fields) return {};
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

/**
 * Normalizes phone numbers to clean digits (e.g. 081234 -> 81234)
 */
export function normalizePhoneDigits(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Generates phone permutations for Firestore runQuery
 */
export function generatePhoneVariations(phone) {
  if (!phone || typeof phone !== 'string') return [];
  const raw = phone.trim();
  const digitsOnly = raw.replace(/\D/g, '');
  const variations = new Set();

  variations.add(raw);
  if (digitsOnly) {
    variations.add(digitsOnly);
    if (digitsOnly.startsWith('0')) {
      const withoutZero = digitsOnly.slice(1);
      variations.add('62' + withoutZero);
      variations.add('+62' + withoutZero);
      if (digitsOnly.length >= 10) {
        variations.add(`${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 8)}-${digitsOnly.slice(8)}`);
        variations.add(`${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7)}`);
      }
    } else if (digitsOnly.startsWith('62')) {
      const national = '0' + digitsOnly.slice(2);
      variations.add(national);
      variations.add('+' + digitsOnly);
    }
  }
  return Array.from(variations).slice(0, 25);
}

/**
 * Normalizes birth dates into YYYY-MM-DD
 */
export function normalizeBirthDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (!str) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {
    // Ignore parse error
  }
  return str;
}

/**
 * Compute SHA-256 hash of a string using Web Crypto API
 */
export async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuf);
}

/**
 * PBKDF2-HMAC-SHA256 Password Hashing Implementation
 * Format: $pbkdf2-sha256$i=100000$<saltHex>$<hashHex>
 */
export async function hashPinPbkdf2(pinText, saltBytes = null, iterations = 100000) {
  const enc = new TextEncoder();
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const pinKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pinText),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    pinKey,
    256
  );
  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);
  return `$pbkdf2-sha256$i=${iterations}$${saltHex}$${hashHex}`;
}

/**
 * Secure PBKDF2-HMAC-SHA256 Verification with Legacy Transition Support
 */
export async function verifyPinPbkdf2(pinText, storedHashString) {
  if (!pinText || !storedHashString || typeof storedHashString !== 'string') return false;

  const cleanStored = storedHashString.trim();

  // 1. Standard PBKDF2-HMAC-SHA256 Format Verification
  if (cleanStored.startsWith('$pbkdf2-sha256$')) {
    const parts = cleanStored.split('$');
    // parts[0] = "", parts[1] = "pbkdf2-sha256", parts[2] = "i=100000", parts[3] = saltHex, parts[4] = hashHex
    if (parts.length >= 5) {
      const iterMatch = parts[2].match(/^i=(\d+)$/);
      const iterations = iterMatch ? parseInt(iterMatch[1], 10) : 100000;
      const saltHex = parts[3];
      const targetHashHex = parts[4];
      const saltBytes = hexToBuffer(saltHex);

      const computedHashStr = await hashPinPbkdf2(pinText, saltBytes, iterations);
      const computedHashHex = computedHashStr.split('$')[4];
      return computedHashHex === targetHashHex;
    }
  }

  // 2. Legacy Transition: Plain 6-digit PIN match
  if (/^\d{6}$/.test(cleanStored)) {
    return pinText === cleanStored;
  }

  // 3. Legacy Transition: Plain SHA-256 hex string match (64 hex characters)
  if (/^[a-f0-9]{64}$/i.test(cleanStored)) {
    const computedPlainSha256 = await hashString(pinText);
    return computedPlainSha256.toLowerCase() === cleanStored.toLowerCase();
  }

  return false;
}

/**
 * Generate cryptographically random session token (256 bits)
 */
export function generateSessionToken() {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return bufferToBase64Url(tokenBytes.buffer);
}

/**
 * Extract client IP from Cloudflare Pages request
 */
export function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';
}

/**
 * Strict Origin Validation (No wildcard *, exact match against ALLOWED_ORIGINS + request origin)
 */
export function getValidatedOrigin(request, env = {}) {
  const reqOrigin = request.headers.get('Origin');
  if (!reqOrigin) return null;

  const allowedSet = new Set();

  try {
    const reqUrlOrigin = new URL(request.url).origin;
    if (reqUrlOrigin) allowedSet.add(reqUrlOrigin);
  } catch {
    // Ignore URL parse error
  }

  if (env.ALLOWED_ORIGINS) {
    env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) allowedSet.add(trimmed);
    });
  }

  // Exact match validation
  if (allowedSet.has(reqOrigin)) {
    return reqOrigin;
  }

  return null;
}

/**
 * Construct CORS Headers with dynamic origin and Credentials support
 */
export function getCorsHeaders(request, env = {}) {
  const validatedOrigin = getValidatedOrigin(request, env);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-CSRF',
    'Access-Control-Max-Age': '86400'
  };

  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Strict CSRF Validation for POST/PUT/DELETE requests
 */
export function verifyCsrf(request, env = {}) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const reqOrigin = request.headers.get('Origin');
  const reqReferer = request.headers.get('Referer');

  const allowedSet = new Set();
  try {
    const reqUrlOrigin = new URL(request.url).origin;
    if (reqUrlOrigin) allowedSet.add(reqUrlOrigin);
  } catch {
    // Ignore
  }

  if (env.ALLOWED_ORIGINS) {
    env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) allowedSet.add(trimmed);
    });
  }

  if (reqOrigin) {
    return allowedSet.has(reqOrigin);
  }

  if (reqReferer) {
    try {
      const refOrigin = new URL(reqReferer).origin;
      return allowedSet.has(refOrigin);
    } catch {
      return false;
    }
  }

  const csrfHeader = request.headers.get('X-Portal-CSRF');
  if (csrfHeader === '1' || csrfHeader === 'true') {
    return true;
  }

  return false;
}

/**
 * Construct HttpOnly & Secure Cookie header string
 */
export function buildSessionCookie(token, maxAgeSeconds = 86400, isSecure = true) {
  const flags = [
    `portal_session=${token}`,
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
 * Construct Cookie header string to immediately clear session
 */
export function buildClearSessionCookie(isSecure = true) {
  const flags = [
    'portal_session=',
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
 * Parse Cookie header to extract specific cookie value
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
 * FAIL-CLOSED Portal Session Store (Primary: KV if bound, else Firestore REST API)
 */
export async function createPortalSession(context, sessionData) {
  const { request, env = {} } = context;
  const sessionToken = generateSessionToken();
  const sessionHash = await hashString(sessionToken);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 Hours

  const fullSessionRecord = {
    sessionHash,
    studentId: sessionData.studentId,
    tenantId: sessionData.tenantId || '',
    studentName: sessionData.studentName || '',
    createdAt: now.toISOString(),
    expiresAt,
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') || '',
    isRevoked: false
  };

  // Primary Store 1: Cloudflare KV Namespace if bound
  if (env.PORTAL_SESSIONS_KV) {
    try {
      await env.PORTAL_SESSIONS_KV.put(sessionHash, JSON.stringify(fullSessionRecord), {
        expirationTtl: 86400
      });
      return { sessionToken, sessionHash, expiresAt, fullSessionRecord };
    } catch (kvErr) {
      console.error('PORTAL_SESSIONS_KV session write failed:', kvErr);
      throw new Error('FAIL_CLOSED: Sesi server gagal disimpan ke KV.');
    }
  }

  // Primary Store 2: Firestore REST API
  try {
    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (accessToken) reqHeaders['Authorization'] = `Bearer ${accessToken}`;

    const setDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_sessions/${encodeURIComponent(sessionHash)}`;

    const fieldsPayload = {
      fields: {
        sessionHash: { stringValue: sessionHash },
        studentId: { stringValue: fullSessionRecord.studentId },
        tenantId: { stringValue: fullSessionRecord.tenantId },
        studentName: { stringValue: fullSessionRecord.studentName },
        createdAt: { stringValue: fullSessionRecord.createdAt },
        expiresAt: { stringValue: fullSessionRecord.expiresAt },
        ip: { stringValue: fullSessionRecord.ip },
        userAgent: { stringValue: fullSessionRecord.userAgent },
        isRevoked: { booleanValue: false }
      }
    };

    const resp = await fetch(setDocUrl, {
      method: 'PATCH',
      headers: reqHeaders,
      body: JSON.stringify(fieldsPayload)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Firestore session HTTP error ${resp.status}: ${errText}`);
    }

    return { sessionToken, sessionHash, expiresAt, fullSessionRecord };
  } catch (fsErr) {
    console.error('Firestore session storage failed:', fsErr);
    // FAIL-CLOSED: Throw error to prevent returning un-persisted session token!
    throw new Error('FAIL_CLOSED: Sesi server gagal disimpan.');
  }
}

/**
 * FAIL-CLOSED Portal Session Validation
 */
export async function validatePortalSession(context) {
  const { request, env = {} } = context;

  let token = parseCookie(request, 'portal_session');
  if (!token) {
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return { valid: false, reason: 'No session token provided' };
  }

  const sessionHash = await hashString(token);
  let sessionRecord = null;

  if (env.PORTAL_SESSIONS_KV) {
    try {
      const kvData = await env.PORTAL_SESSIONS_KV.get(sessionHash);
      if (kvData) {
        sessionRecord = JSON.parse(kvData);
      }
    } catch (kvErr) {
      console.error('PORTAL_SESSIONS_KV read failed:', kvErr);
      return { valid: false, reason: 'Session store read error' };
    }
  } else {
    try {
      const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
      const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
      const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
      const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

      const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
      const reqHeaders = { 'Content-Type': 'application/json' };
      if (accessToken) reqHeaders['Authorization'] = `Bearer ${accessToken}`;

      const getDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_sessions/${encodeURIComponent(sessionHash)}`;
      const resp = await fetch(getDocUrl, { method: 'GET', headers: reqHeaders });

      if (resp.ok) {
        const docData = await resp.json();
        sessionRecord = parseFirestoreFields(docData.fields);
      } else {
        return { valid: false, reason: `Session fetch HTTP status ${resp.status}` };
      }
    } catch (fsErr) {
      console.error('Firestore session fetch failed:', fsErr);
      return { valid: false, reason: 'Session store read error' };
    }
  }

  if (!sessionRecord) {
    return { valid: false, reason: 'Session not found or expired' };
  }

  if (sessionRecord.isRevoked === true) {
    return { valid: false, reason: 'Session has been revoked' };
  }

  const nowIso = new Date().toISOString();
  if (sessionRecord.expiresAt && sessionRecord.expiresAt <= nowIso) {
    return { valid: false, reason: 'Session expired' };
  }

  return {
    valid: true,
    session: sessionRecord
  };
}

/**
 * FAIL-CLOSED Session Revocation
 */
export async function revokePortalSession(context) {
  const { request, env = {} } = context;
  const token = parseCookie(request, 'portal_session') || (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) {
    return { success: false, reason: 'No token provided' };
  }

  const sessionHash = await hashString(token);

  if (env.PORTAL_SESSIONS_KV) {
    try {
      await env.PORTAL_SESSIONS_KV.delete(sessionHash);
      return { success: true };
    } catch (kvErr) {
      console.error('KV session revocation error:', kvErr);
      return { success: false, reason: 'KV revocation error' };
    }
  }

  try {
    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (accessToken) reqHeaders['Authorization'] = `Bearer ${accessToken}`;

    const updateDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_sessions/${encodeURIComponent(sessionHash)}?updateMask.fieldPaths=isRevoked`;
    const fieldsPayload = {
      fields: {
        isRevoked: { booleanValue: true }
      }
    };

    const resp = await fetch(updateDocUrl, {
      method: 'PATCH',
      headers: reqHeaders,
      body: JSON.stringify(fieldsPayload)
    });

    if (!resp.ok) {
      throw new Error(`Firestore revocation status (${resp.status})`);
    }

    return { success: true };
  } catch (fsErr) {
    console.error('Firestore session revocation error:', fsErr);
    return { success: false, reason: 'Session revocation error' };
  }
}

/**
 * FAIL-CLOSED Rate Limiting Helper (KV or Firestore)
 */
export async function checkRateLimit(context, rawKey, maxAttempts = 5, windowSeconds = 900) {
  const { env = {} } = context;
  const keyHash = await hashString(rawKey);

  if (env.PORTAL_RATELIMIT_KV) {
    try {
      const currentVal = await env.PORTAL_RATELIMIT_KV.get(keyHash);
      const count = currentVal ? Number(currentVal) : 0;
      if (count >= maxAttempts) {
        return { allowed: false, count };
      }
      await env.PORTAL_RATELIMIT_KV.put(keyHash, String(count + 1), { expirationTtl: windowSeconds });
      return { allowed: true, count: count + 1 };
    } catch (kvErr) {
      console.error('PORTAL_RATELIMIT_KV error:', kvErr);
      // FAIL-CLOSED: Lock request if rate limit check fails
      return { allowed: false, count: maxAttempts, error: true };
    }
  }

  try {
    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (accessToken) reqHeaders['Authorization'] = `Bearer ${accessToken}`;

    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_rate_limits/${encodeURIComponent(keyHash)}`;
    const getResp = await fetch(docUrl, { method: 'GET', headers: reqHeaders });

    let count = 0;
    const expiresAt = new Date(Date.now() + windowSeconds * 1000).toISOString();

    if (getResp.ok) {
      const docData = await getResp.json();
      const fields = parseFirestoreFields(docData.fields);
      if (fields.expiresAt && fields.expiresAt > new Date().toISOString()) {
        count = Number(fields.count || 0);
      }
    }

    if (count >= maxAttempts) {
      return { allowed: false, count };
    }

    const setPayload = {
      fields: {
        keyHash: { stringValue: keyHash },
        count: { integerValue: count + 1 },
        expiresAt: { stringValue: expiresAt }
      }
    };

    const updateResp = await fetch(docUrl, {
      method: 'PATCH',
      headers: reqHeaders,
      body: JSON.stringify(setPayload)
    });

    if (!updateResp.ok) {
      throw new Error(`Firestore rate limit write HTTP status ${updateResp.status}`);
    }

    return { allowed: true, count: count + 1 };
  } catch (fsErr) {
    console.error('Firestore rate limit error:', fsErr);
    // FAIL-CLOSED: Reject request if rate limit storage fails
    return { allowed: false, count: maxAttempts, error: true };
  }
}

/**
 * Record Audit Log without saving PII or raw PINs
 */
export async function recordAuditLog(context, logData) {
  const { request, env = {} } = context;
  try {
    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (accessToken) reqHeaders['Authorization'] = `Bearer ${accessToken}`;

    const studentIdHash = logData.studentId ? await hashString(logData.studentId) : '';
    const phoneHash = logData.phoneDigits ? await hashString(logData.phoneDigits) : '';

    const payload = {
      fields: {
        timestamp: { stringValue: new Date().toISOString() },
        action: { stringValue: logData.action || 'PORTAL_AUTH' },
        studentIdHash: { stringValue: studentIdHash },
        phoneHash: { stringValue: phoneHash },
        success: { booleanValue: Boolean(logData.success) },
        ip: { stringValue: getClientIp(request) },
        userAgent: { stringValue: request.headers.get('user-agent') || '' },
        failureReason: { stringValue: logData.failureReason || '' }
      }
    };

    const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_audit_logs`;
    await fetch(createUrl, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Audit log write error:', err.message);
  }
}

/**
 * Data Minimization: Filter student document object to return ONLY safe public portal fields
 */
export function sanitizeStudentProfile(studentDoc) {
  if (!studentDoc) return null;
  return {
    id: studentDoc.id,
    studentName: studentDoc.studentName || studentDoc.name || '',
    className: studentDoc.className || '',
    coachName: studentDoc.coachName || '',
    sportCategory: studentDoc.sportCategory || studentDoc.sport || 'General',
    academyName: studentDoc.academyName || '',
    photoUrl: studentDoc.photoUrl || null,
    tenantId: studentDoc.tenantId || ''
  };
}
