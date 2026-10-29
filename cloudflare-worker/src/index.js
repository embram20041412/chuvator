// Konfigurasi Header CORS Dinamis
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Ganti '*' dengan URL Frontend Anda jika sudah di tahap production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
  'Access-Control-Max-Age': '86400',
};

// Helper untuk format response JSON dengan CORS
const jsonResponse = (data, status = 200, extraHeaders = {}) => {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
  });
};

/**
 * Helper to encode text to Base64URL string
 */
function base64UrlEncodeUint8Array(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlEncode(str) {
  return base64UrlEncodeUint8Array(new TextEncoder().encode(str));
}

/**
 * Generates a Google OAuth2 Access Token using Web Crypto API RS256 signing
 * with FIREBASE_SERVICE_ACCOUNT_KEY credentials.
 */
async function getGoogleAccessToken(serviceAccount) {
  const pem = serviceAccount.private_key;
  if (!pem) {
    throw new Error('Private key missing from FIREBASE_SERVICE_ACCOUNT_KEY JSON');
  }

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['sign']
  );

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
  };

  const base64UrlHeader = base64UrlEncode(JSON.stringify(header));
  const base64UrlPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${base64UrlHeader}.${base64UrlPayload}`;

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signatureInput)
  );

  const base64UrlSignature = base64UrlEncodeUint8Array(new Uint8Array(signature));
  const jwt = `${signatureInput}.${base64UrlSignature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Google OAuth Failed: ${data.error_description || data.error || JSON.stringify(data)}`);
  }
  return data.access_token;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. TANGANI CORS PREFLIGHT (Sangat Penting)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // 2. ENDPOINT HEALTH CHECK
      if ((url.pathname.includes('/api/health') || url.pathname.endsWith('/health') || url.pathname === '/' || url.pathname === '/api') && request.method === 'GET') {
        return jsonResponse({
          success: true,
          status: 'healthy',
          service: 'chua-sport-backend',
          timestamp: new Date().toISOString(),
          env_keys_detected: Object.keys(env),
          hasServiceAccount: Boolean(env.FIREBASE_SERVICE_ACCOUNT_KEY),
        });
      }

      // 3. ENDPOINT LOGIN STAF (POST /api/login-staff)
      if ((url.pathname.includes('/api/login-staff') || url.pathname.endsWith('/login-staff')) && request.method === 'POST') {
        let payload = {};
        try {
          const reqText = await request.text();
          payload = reqText ? JSON.parse(reqText) : {};
        } catch (e) {
          return jsonResponse({ success: false, error: 'Invalid JSON payload request' }, 400);
        }

        const { email, password } = payload || {};
        if (!email || !password) {
          return jsonResponse({ success: false, error: 'Email dan password wajib diisi.' }, 400);
        }

        const apiKey = env.FIREBASE_API_KEY || 'AIzaSyAXd9BEbKOD-tbgFSjcvZuedwG_6bekK44';

        // Autentikasi via Google Identity Toolkit REST API
        const signInRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              password: password,
              returnSecureToken: true,
            }),
          }
        );

        const signInText = await signInRes.text();
        const signInData = signInText ? JSON.parse(signInText) : {};

        if (!signInRes.ok) {
          const errMsg = signInData.error?.message || 'Email atau password staf salah.';
          const friendlyMsg = (errMsg === 'INVALID_PASSWORD' || errMsg === 'EMAIL_NOT_FOUND' || errMsg === 'INVALID_LOGIN_CREDENTIALS')
            ? 'Email atau password staf tidak sesuai.'
            : errMsg;

          return jsonResponse({ success: false, error: friendlyMsg, code: errMsg }, 400);
        }

        return jsonResponse({
          success: true,
          message: 'Login staf berhasil.',
          uid: signInData.localId,
          email: signInData.email,
          idToken: signInData.idToken,
          refreshToken: signInData.refreshToken,
          expiresIn: signInData.expiresIn,
        }, 200);
      }

      // 4. ENDPOINT PEMBUATAN STAF (RBAC) (POST /api/create-staff)
      if ((url.pathname.includes('/api/create-staff') || url.pathname.endsWith('/create-staff')) && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return jsonResponse({ success: false, error: 'Unauthorized: Token pemanggil hilang' }, 401);
        }

        const callerToken = authHeader.split('Bearer ')[1].trim();

        let payload = {};
        try {
          const reqText = await request.text();
          payload = reqText ? JSON.parse(reqText) : {};
        } catch (e) {
          return jsonResponse({ success: false, error: 'Invalid JSON payload request' }, 400);
        }

        const { email, password, role, tenantId, displayName } = payload || {};

        if (!email || !password || !role || !tenantId) {
          return jsonResponse({
            success: false,
            error: 'Missing parameters: email, password, role, and tenantId are required.',
          }, 400);
        }

        const apiKey = env.FIREBASE_API_KEY || 'AIzaSyAXd9BEbKOD-tbgFSjcvZuedwG_6bekK44';

        // a. Verifikasi token pemanggil (Owner)
        const lookupRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: callerToken }),
          }
        );

        const lookupText = await lookupRes.text();
        const lookupData = lookupText ? JSON.parse(lookupText) : {};

        if (!lookupRes.ok || !lookupData.users || lookupData.users.length === 0) {
          return jsonResponse({ success: false, error: 'Token pemanggil tidak valid atau kadaluarsa' }, 401);
        }

        // b. Buat akun staf baru menggunakan REST API Identity Toolkit
        const signUpRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              password: password,
              returnSecureToken: true,
            }),
          }
        );

        const signUpText = await signUpRes.text();
        const signUpData = signUpText ? JSON.parse(signUpText) : {};

        if (!signUpRes.ok) {
          const rawErr = signUpData.error?.message || 'Gagal mendaftarkan akun staf.';
          const friendlyErr = rawErr === 'EMAIL_EXISTS' ? 'Email tersebut sudah terdaftar.' : rawErr;
          return jsonResponse({ success: false, error: friendlyErr, code: rawErr }, 400);
        }

        const newUid = signUpData.localId;

        // Update display name jika ada
        if (displayName) {
          try {
            await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  idToken: signUpData.idToken,
                  displayName: displayName,
                  returnSecureToken: false,
                }),
              }
            );
          } catch (e) {
            console.error('Failed setting display name:', e);
          }
        }

        // c. Sematkan Custom Claims { tenantId, role } menggunakan env.FIREBASE_SERVICE_ACCOUNT_KEY
        let customClaimsSet = false;
        let claimsNotice = '';

        if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          try {
            const serviceAccount =
              typeof env.FIREBASE_SERVICE_ACCOUNT_KEY === 'string'
                ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY)
                : env.FIREBASE_SERVICE_ACCOUNT_KEY;

            const accessToken = await getGoogleAccessToken(serviceAccount);

            const setClaimsRes = await fetch(
              'https://identitytoolkit.googleapis.com/v1/accounts:setCustomAttributes',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  localId: newUid,
                  customAttributes: JSON.stringify({
                    role: role,
                    tenantId: tenantId,
                  }),
                }),
              }
            );

            if (setClaimsRes.ok) {
              customClaimsSet = true;
            } else {
              const claimErrText = await setClaimsRes.text();
              console.error('Failed setting custom claims:', claimErrText);
              claimsNotice = 'User registered, but custom claims failed: ' + claimErrText;
            }
          } catch (claimsErr) {
            console.error('Error in custom claims processing:', claimsErr);
            claimsNotice = 'Custom claims error: ' + claimsErr.message;
          }
        } else {
          claimsNotice = 'FIREBASE_SERVICE_ACCOUNT_KEY belum diatur. Akun dibuat tanpa Custom Claims.';
        }

        return jsonResponse(
          {
            success: true,
            message: 'Staf berhasil didaftarkan dan Custom Claims disematkan.',
            uid: newUid,
            user: {
              uid: newUid,
              email: email.trim(),
              displayName: displayName || email.split('@')[0],
              role: role,
              tenantId: tenantId,
              customClaimsSet: customClaimsSet,
            },
            notice: claimsNotice || undefined,
          },
          201
        );
      }

      // Fallback rute tidak ditemukan
      return jsonResponse({ success: false, error: `Endpoint not found: ${request.method} ${url.pathname}` }, 404);

    } catch (error) {
      // Penanganan Error Global
      return jsonResponse(
        {
          success: false,
          error: 'Internal Server Error',
          details: error.message,
        },
        500
      );
    }
  },
};