/**
 * Cloudflare Pages Functions Edge Helper Module for Portal Wali Murid (STAGE 7G.2A.2)
 * Provides cryptographic PBKDF2 PIN hashing & migration, fail-closed session management,
 * strict origin & CSRF token validation, fail-closed rate limiting, and data minimization.
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
 * Constant-time byte comparison against timing side-channel attacks
 */
export function timingSafeEqual(aBytes, bBytes) {
  if (!aBytes || !bBytes || aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

/**
 * Generate Google OAuth2 Access Token using RS256 Web Crypto in Edge runtime.
 * Fails closed if credentials are missing or invalid.
 */
export async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  if (!clientEmail || !privateKeyPem) {
    throw new Error('Google OAuth Credentials Missing: clientEmail and privateKey are required');
  }

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
      throw new Error(`Google OAuth token exchange failed with status ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Google OAuth response did not contain access_token');
    }
    return tokenData.access_token;
  } catch (err) {
    throw new Error(`Google Access Token Error: ${err.message}`);
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
 * Secure PBKDF2-HMAC-SHA256 Verification with Legacy Transition Support & Timing-Safe Comparison
 * Returns { verified: boolean, isLegacy: boolean }
 */
export async function verifyPinPbkdf2(pinText, storedHashString) {
  if (!pinText || !storedHashString || typeof storedHashString !== 'string') {
    return { verified: false, isLegacy: false };
  }

  const cleanStored = storedHashString.trim();

  // 1. Standard PBKDF2-HMAC-SHA256 Format Verification
  if (cleanStored.startsWith('$pbkdf2-sha256$')) {
    const parts = cleanStored.split('$');
    // parts[0] = "", parts[1] = "pbkdf2-sha256", parts[2] = "i=100000", parts[3] = saltHex, parts[4] = hashHex
    if (parts.length >= 5) {
      const iterMatch = parts[2].match(/^i=(\d+)$/);
      const iterations = iterMatch ? parseInt(iterMatch[1], 10) : 100000;

      // Bound iterations to prevent CPU exhaustion DoS (10k to 250k)
      if (isNaN(iterations) || iterations < 10000 || iterations > 250000) {
        return { verified: false, isLegacy: false };
      }

      const saltHex = parts[3];
      const targetHashHex = parts[4];

      // Validate salt and hash lengths
      if (!saltHex || saltHex.length < 16 || saltHex.length > 128 || !targetHashHex || targetHashHex.length !== 64) {
        return { verified: false, isLegacy: false };
      }

      const saltBytes = hexToBuffer(saltHex);
      const targetHashBytes = hexToBuffer(targetHashHex);

      const computedHashStr = await hashPinPbkdf2(pinText, saltBytes, iterations);
      const computedHashHex = computedHashStr.split('$')[4];
      const computedHashBytes = hexToBuffer(computedHashHex);

      const isMatch = timingSafeEqual(computedHashBytes, targetHashBytes);
      return { verified: isMatch, isLegacy: false };
    }
  }

  // 2. Legacy Transition: Plain 6-digit PIN match
  if (/^\d{6}$/.test(cleanStored)) {
    const enc = new TextEncoder();
    const pinBytes = enc.encode(pinText);
    const storedBytes = enc.encode(cleanStored);
    const isMatch = timingSafeEqual(pinBytes, storedBytes);
    return { verified: isMatch, isLegacy: true };
  }

  // 3. Legacy Transition: Plain SHA-256 hex string match (64 hex characters)
  if (/^[a-f0-9]{64}$/i.test(cleanStored)) {
    const computedPlainSha256 = await hashString(pinText);
    const computedBytes = hexToBuffer(computedPlainSha256.toLowerCase());
    const targetBytes = hexToBuffer(cleanStored.toLowerCase());
    const isMatch = timingSafeEqual(computedBytes, targetBytes);
    return { verified: isMatch, isLegacy: true };
  }

  return { verified: false, isLegacy: false };
}

/**
 * Automatic background migration helper from legacy PIN to PBKDF2-HMAC-SHA256
 */
export async function migrateStudentPinToPbkdf2(context, studentId, plainPin, pinFieldName = 'parentPin') {
  const { env = {} } = context;
  try {
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      return false;
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    if (!accessToken) return false;

    const newPbkdf2Hash = await hashPinPbkdf2(plainPin);
    const updateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students/${encodeURIComponent(studentId)}?updateMask.fieldPaths=${encodeURIComponent(pinFieldName)}`;

    const payload = {
      fields: {
        [pinFieldName]: { stringValue: newPbkdf2Hash }
      }
    };

    const resp = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      return false;
    }

    await recordAuditLog(context, {
      action: 'PORTAL_PIN_MIGRATED_PBKDF2',
      studentId: studentId,
      success: true
    });

    return true;
  } catch (err) {
    console.error('PIN Migration error:', err.message);
    return false;
  }
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
 * Generate cryptographically random CSRF token (128 bits)
 */
export function generateCsrfToken() {
  const csrfBytes = new Uint8Array(16);
  crypto.getRandomValues(csrfBytes);
  return bufferToBase64Url(csrfBytes.buffer);
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
 * Strict CSRF Validation for POST/PUT/DELETE requests.
 * Checks Origin & Referer strictly against allowed origins.
 * If expectedCsrfToken is passed, verifies X-Portal-CSRF header matches.
 */
export function verifyCsrf(request, env = {}, expectedCsrfToken = null) {
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

  // 1. Verify Origin strictly if present
  if (reqOrigin) {
    if (!allowedSet.has(reqOrigin)) {
      return false;
    }
  } else if (reqReferer) {
    // 2. Fallback to Referer origin
    try {
      const refOrigin = new URL(reqReferer).origin;
      if (!allowedSet.has(refOrigin)) {
        return false;
      }
    } catch {
      return false;
    }
  } else {
    // Neither Origin nor Referer -> Reject
    return false;
  }

  // 3. Check X-Portal-CSRF header token if session token is required
  if (expectedCsrfToken) {
    const headerCsrf = request.headers.get('X-Portal-CSRF');
    if (!headerCsrf || headerCsrf !== expectedCsrfToken) {
      return false;
    }
  }

  return true;
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
  const csrfToken = generateCsrfToken();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 Hours

  const fullSessionRecord = {
    sessionHash,
    csrfToken,
    studentId: sessionData.studentId,
    tenantId: sessionData.tenantId || '',
    studentName: sessionData.studentName || '',
    createdAt: now.toISOString(),
    expiresAt,
    isRevoked: false
  };

  // Primary Store 1: Cloudflare KV Namespace if bound
  if (env.PORTAL_SESSIONS_KV) {
    try {
      await env.PORTAL_SESSIONS_KV.put(sessionHash, JSON.stringify(fullSessionRecord), {
        expirationTtl: 86400
      });
      return { sessionToken, sessionHash, csrfToken, expiresAt, fullSessionRecord };
    } catch (kvErr) {
      console.error('PORTAL_SESSIONS_KV session write failed:', kvErr);
      throw new Error('FAIL_CLOSED: Sesi server gagal disimpan ke KV.');
    }
  }

  // Primary Store 2: Firestore REST API
  try {
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('FIREBASE_CREDENTIALS_MISSING');
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    if (!accessToken) {
      throw new Error('FIREBASE_OAUTH_TOKEN_FAILED');
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const setDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_sessions/${encodeURIComponent(sessionHash)}`;

    const fieldsPayload = {
      fields: {
        sessionHash: { stringValue: sessionHash },
        csrfToken: { stringValue: csrfToken },
        studentId: { stringValue: fullSessionRecord.studentId },
        tenantId: { stringValue: fullSessionRecord.tenantId },
        studentName: { stringValue: fullSessionRecord.studentName },
        createdAt: { stringValue: fullSessionRecord.createdAt },
        expiresAt: { stringValue: fullSessionRecord.expiresAt },
        isRevoked: { booleanValue: false }
      }
    };

    const resp = await fetch(setDocUrl, {
      method: 'PATCH',
      headers: reqHeaders,
      body: JSON.stringify(fieldsPayload)
    });

    if (!resp.ok) {
      throw new Error(`Firestore session HTTP error status ${resp.status}`);
    }

    return { sessionToken, sessionHash, csrfToken, expiresAt, fullSessionRecord };
  } catch (fsErr) {
    console.error('Firestore session storage failed:', fsErr.message);
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
      const projectId = env.FIREBASE_PROJECT_ID;
      const databaseId = env.FIREBASE_DATABASE_ID || projectId;
      const clientEmail = env.FIREBASE_CLIENT_EMAIL;
      const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

      if (!projectId || !clientEmail || !privateKey) {
        return { valid: false, reason: 'Firebase credentials missing' };
      }

      const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
      if (!accessToken) {
        return { valid: false, reason: 'OAuth token failed' };
      }

      const reqHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };

      const getDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_sessions/${encodeURIComponent(sessionHash)}`;
      const resp = await fetch(getDocUrl, { method: 'GET', headers: reqHeaders });

      if (resp.ok) {
        const docData = await resp.json();
        sessionRecord = parseFirestoreFields(docData.fields);
      } else {
        return { valid: false, reason: `Session fetch HTTP status ${resp.status}` };
      }
    } catch (fsErr) {
      console.error('Firestore session fetch failed:', fsErr.message);
      return { valid: false, reason: 'Session store read error' };
    }
  }

  if (!sessionRecord) {
    return { valid: false, reason: 'Session not found or expired' };
  }

  if (sessionRecord.isRevoked === true) {
    return { valid: false, reason: 'Session has been revoked' };
  }

  // Mandatory & Strict session expiration check (STAGE 7G.2A.6)
  const expiresAtStr = String(sessionRecord.expiresAt || '').trim();
  if (!expiresAtStr) {
    return { valid: false, reason: 'Incomplete session: missing expiresAt timestamp' };
  }

  const expDate = new Date(expiresAtStr);
  if (isNaN(expDate.getTime())) {
    return { valid: false, reason: 'Invalid session expiresAt date format' };
  }

  const nowMs = Date.now();
  if (expDate.getTime() <= nowMs) {
    return { valid: false, reason: 'Session has expired' };
  }

  // Strict tenant & student identity check
  const studentId = String(sessionRecord.studentId || '').trim();
  const tenantId = String(sessionRecord.tenantId || '').trim();

  if (!studentId || !tenantId) {
    return { valid: false, reason: 'Incomplete session identity: missing studentId or tenantId' };
  }

  return {
    valid: true,
    session: {
      ...sessionRecord,
      studentId,
      tenantId,
      expiresAt: expiresAtStr
    }
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
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      return { success: false, reason: 'Firebase credentials missing' };
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    if (!accessToken) {
      return { success: false, reason: 'OAuth token failed' };
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

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
      throw new Error(`Firestore revocation HTTP status ${resp.status}`);
    }

    return { success: true };
  } catch (fsErr) {
    console.error('Firestore session revocation error:', fsErr.message);
    return { success: false, reason: 'Session revocation error' };
  }
}

/**
 * FAIL-CLOSED Rate Limiting Helper (Durable Objects > KV > Firestore)
 */
export async function checkRateLimit(context, rawKey, maxAttempts = 5, windowSeconds = 900) {
  const { env = {} } = context;
  const keyHash = await hashString(rawKey);

  // Mode 1: Cloudflare Durable Objects (Atomic counter if bound)
  if (env.PORTAL_RATELIMIT_DO) {
    try {
      const id = env.PORTAL_RATELIMIT_DO.idFromName(keyHash);
      const stub = env.PORTAL_RATELIMIT_DO.get(id);
      const res = await stub.fetch(`https://ratelimit.internal/check?max=${maxAttempts}&window=${windowSeconds}`);
      if (res.ok) {
        const data = await res.json();
        return { allowed: Boolean(data.allowed), count: Number(data.count || 0), atomic: true };
      }
      return { allowed: false, count: maxAttempts, error: true };
    } catch (doErr) {
      console.error('Durable Object rate limit error:', doErr);
      return { allowed: false, count: maxAttempts, error: true };
    }
  }

  // Mode 2: Cloudflare KV Namespace (Read + Put, non-atomic, eventual consistency)
  if (env.PORTAL_RATELIMIT_KV) {
    try {
      const currentVal = await env.PORTAL_RATELIMIT_KV.get(keyHash);
      const count = currentVal ? Number(currentVal) : 0;
      if (count >= maxAttempts) {
        return { allowed: false, count, atomic: false };
      }
      await env.PORTAL_RATELIMIT_KV.put(keyHash, String(count + 1), { expirationTtl: windowSeconds });
      return { allowed: true, count: count + 1, atomic: false };
    } catch (kvErr) {
      console.error('PORTAL_RATELIMIT_KV error:', kvErr);
      // FAIL-CLOSED: Lock request if rate limit check fails
      return { allowed: false, count: maxAttempts, error: true };
    }
  }

  // Mode 3: Firestore REST API (Read + Patch, fail-closed)
  try {
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      return { allowed: false, count: maxAttempts, error: true };
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    if (!accessToken) {
      return { allowed: false, count: maxAttempts, error: true };
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_rate_limits/${encodeURIComponent(keyHash)}`;
    const getResp = await fetch(docUrl, { method: 'GET', headers: reqHeaders });

    let count = 0;
    const expiresAt = new Date(Date.now() + windowSeconds * 1000).toISOString();

    if (getResp.status === 404) {
      count = 0;
    } else if (getResp.ok) {
      const docData = await getResp.json();
      const fields = parseFirestoreFields(docData.fields);
      if (fields.expiresAt && fields.expiresAt > new Date().toISOString()) {
        count = Number(fields.count || 0);
      }
    } else {
      // Non-2xx and non-404 HTTP status from Firestore -> FAIL-CLOSED
      throw new Error(`Firestore rate limit read HTTP status ${getResp.status}`);
    }

    if (count >= maxAttempts) {
      return { allowed: false, count, atomic: false };
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

    return { allowed: true, count: count + 1, atomic: false };
  } catch (fsErr) {
    console.error('Firestore rate limit error:', fsErr.message);
    // FAIL-CLOSED: Reject request if rate limit storage fails
    return { allowed: false, count: maxAttempts, error: true };
  }
}

/**
 * Record Audit Log without saving PII or raw PINs/tokens
 */
export async function recordAuditLog(context, logData) {
  const { request, env = {} } = context;
  try {
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      return;
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    if (!accessToken) return;

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const studentIdHash = logData.studentId ? await hashString(logData.studentId) : '';
    const phoneHash = logData.phoneDigits ? await hashString(logData.phoneDigits) : '';
    const clientIp = getClientIp(request);
    const ipHash = clientIp ? await hashString(clientIp) : '';

    const payload = {
      fields: {
        timestamp: { stringValue: new Date().toISOString() },
        action: { stringValue: logData.action || 'PORTAL_AUTH' },
        studentIdHash: { stringValue: studentIdHash },
        phoneHash: { stringValue: phoneHash },
        ipHash: { stringValue: ipHash },
        success: { booleanValue: Boolean(logData.success) },
        userAgent: { stringValue: (request.headers.get('user-agent') || '').slice(0, 200) },
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

