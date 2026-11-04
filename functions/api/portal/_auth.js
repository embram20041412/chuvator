/**
 * Cloudflare Pages Functions Edge Helper Module for Portal Wali Murid
 * Provides cryptographic session management, credential verification,
 * origin checking, rate limiting, audit logging, and data minimization.
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
 * Normalizes phone numbers to a clean digit string stripped of country prefix (e.g. 081234 -> 81234)
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
 * Generates telephone number format permutations for Firestore queries
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
 * Normalizes birth dates into standard YYYY-MM-DD string format
 */
export function normalizeBirthDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (!str) return '';

  // Standard YYYY-MM-DD format check
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Handle ISO string or timestamp
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
 * Generate a cryptographically random session token (256 bits)
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
 * Origin Validation & Allowed Domain Checking
 */
export function getValidatedOrigin(request, env = {}) {
  const reqOrigin = request.headers.get('Origin');
  if (!reqOrigin) return null;

  // Read explicit allowed origins from environment variable if configured
  const allowedList = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];

  if (allowedList.includes(reqOrigin)) {
    return reqOrigin;
  }

  // Domain pattern validation for production AI Studio, Cloudflare Pages, and local dev
  try {
    const url = new URL(reqOrigin);
    const host = url.hostname;

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.pages.dev') ||
      host.endsWith('.run.app') ||
      host.endsWith('.aistudio.google')
    ) {
      return reqOrigin;
    }
  } catch {
    // Invalid URL format
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
  } else {
    // Default fallback without credentials for unknown origins
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

/**
 * Construct HttpOnly & Secure Cookie header string for portal session
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
 * Construct Cookie header string to immediately revoke/clear portal session
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
 * Store active portal session in server storage (KV namespace if bound, with Firestore REST API fallback)
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

  // 1. Storage via Cloudflare KV if namespace is bound
  if (env.PORTAL_SESSIONS_KV) {
    try {
      await env.PORTAL_SESSIONS_KV.put(sessionHash, JSON.stringify(fullSessionRecord), {
        expirationTtl: 86400
      });
    } catch (kvErr) {
      console.warn('PORTAL_SESSIONS_KV write failed:', kvErr.message);
    }
  }

  // 2. Storage via Firestore REST API (Primary persistent store)
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

    await fetch(setDocUrl, {
      method: 'PATCH',
      headers: reqHeaders,
      body: JSON.stringify(fieldsPayload)
    });
  } catch (fsErr) {
    console.warn('Firestore session storage failed:', fsErr.message);
  }

  return { sessionToken, sessionHash, expiresAt, fullSessionRecord };
}

/**
 * Validate active portal session token from HttpOnly cookie or Authorization header
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

  // 1. Check Cloudflare KV namespace if bound
  if (env.PORTAL_SESSIONS_KV) {
    try {
      const kvData = await env.PORTAL_SESSIONS_KV.get(sessionHash);
      if (kvData) {
        sessionRecord = JSON.parse(kvData);
      }
    } catch (kvErr) {
      console.warn('PORTAL_SESSIONS_KV read failed:', kvErr.message);
    }
  }

  // 2. Fallback to Firestore REST API if not found in KV
  if (!sessionRecord) {
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
      }
    } catch (fsErr) {
      console.warn('Firestore session fetch failed:', fsErr.message);
    }
  }

  if (!sessionRecord) {
    return { valid: false, reason: 'Session not found or expired' };
  }

  if (sessionRecord.isRevoked) {
    return { valid: false, reason: 'Session has been revoked' };
  }

  const nowIso = new Date().toISOString();
  if (sessionRecord.expiresAt && sessionRecord.expiresAt < nowIso) {
    return { valid: false, reason: 'Session expired' };
  }

  return {
    valid: true,
    session: sessionRecord
  };
}

/**
 * Revoke session in server storage
 */
export async function revokePortalSession(context) {
  const { request, env = {} } = context;
  const token = parseCookie(request, 'portal_session') || (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return true;

  const sessionHash = await hashString(token);

  if (env.PORTAL_SESSIONS_KV) {
    try {
      await env.PORTAL_SESSIONS_KV.delete(sessionHash);
    } catch {
      // Ignore KV delete error
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

    await fetch(updateDocUrl, {
      method: 'PATCH',
      headers: reqHeaders,
      body: JSON.stringify(fieldsPayload)
    });
  } catch (fsErr) {
    console.warn('Firestore session revocation error:', fsErr.message);
  }

  return true;
}

/**
 * Rate Limiting helper (Cloudflare KV if bound, else Firestore rate limits collection)
 */
export async function checkRateLimit(context, key, maxAttempts = 5, windowSeconds = 900) {
  const { env = {} } = context;

  // 1. Check via Cloudflare KV if namespace bound
  if (env.PORTAL_RATELIMIT_KV) {
    try {
      const currentVal = await env.PORTAL_RATELIMIT_KV.get(key);
      const count = currentVal ? Number(currentVal) : 0;
      if (count >= maxAttempts) {
        return { allowed: false, count };
      }
      await env.PORTAL_RATELIMIT_KV.put(key, String(count + 1), { expirationTtl: windowSeconds });
      return { allowed: true, count: count + 1 };
    } catch (kvErr) {
      console.warn('PORTAL_RATELIMIT_KV error:', kvErr.message);
    }
  }

  // 2. Check via Firestore REST API fallback
  try {
    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (accessToken) reqHeaders['Authorization'] = `Bearer ${accessToken}`;

    const docId = await hashString(key);
    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/portal_rate_limits/${encodeURIComponent(docId)}`;

    const getResp = await fetch(docUrl, { method: 'GET', headers: reqHeaders });
    let count = 0;
    let expiresAt = new Date(Date.now() + windowSeconds * 1000).toISOString();

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
        key: { stringValue: key },
        count: { integerValue: count + 1 },
        expiresAt: { stringValue: expiresAt }
      }
    };

    await fetch(docUrl, {
      method: 'PATCH',
      headers: reqHeaders,
      body: JSON.stringify(setPayload)
    });

    return { allowed: true, count: count + 1 };
  } catch (fsErr) {
    console.warn('Firestore rate limit fallback error:', fsErr.message);
    // Allow request if storage fails to avoid locking out legitimate users
    return { allowed: true, count: 1 };
  }
}

/**
 * Record audit log entry in Firestore without storing PINs or secrets
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

    const payload = {
      fields: {
        timestamp: { stringValue: new Date().toISOString() },
        action: { stringValue: logData.action || 'PORTAL_LOGIN' },
        studentId: { stringValue: logData.studentId || '' },
        phoneDigits: { stringValue: logData.phoneDigits || '' },
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
    console.warn('Audit log write error:', err.message);
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
