import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Read Firebase Config
let firebaseConfig = {
  projectId: 'chua-sport-core',
  apiKey: 'AIzaSyAXd9BEbKOD-tbgFSjcvZuedwG_6bekK44',
};

try {
  const configFile = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configFile)) {
    const raw = fs.readFileSync(configFile, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.projectId) firebaseConfig.projectId = parsed.projectId;
    if (parsed.apiKey) firebaseConfig.apiKey = parsed.apiKey;
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

function parseServiceAccountKey() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!sa.client_email || !sa.private_key) return null;
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    return sa;
  } catch {
    return null;
  }
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createServiceAccountJwt(serviceAccount: any): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase.auth',
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signature}`;
}

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const jwt = createServiceAccountJwt(serviceAccount);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gagal memperoleh Google Access Token: ${data.error_description || data.error || res.statusText}`);
  }
  return data.access_token;
}

function parseFirestoreFields(fields: any): any {
  if (!fields) return {};
  const obj: any = {};
  for (const key of Object.keys(fields)) {
    const valObj = fields[key];
    if ('stringValue' in valObj) obj[key] = valObj.stringValue;
    else if ('integerValue' in valObj) obj[key] = parseInt(valObj.integerValue, 10);
    else if ('doubleValue' in valObj) obj[key] = parseFloat(valObj.doubleValue);
    else if ('booleanValue' in valObj) obj[key] = valObj.booleanValue;
    else if ('mapValue' in valObj) obj[key] = parseFirestoreFields(valObj.mapValue?.fields);
    else if ('arrayValue' in valObj) obj[key] = (valObj.arrayValue?.values || []).map((v: any) => parseFirestoreFields({ item: v }).item);
    else obj[key] = null;
  }
  return obj;
}

async function getFirestoreDoc(docPath: string, idToken?: string) {
  const serviceAccount = parseServiceAccountKey();
  let bearerToken = idToken;
  if (serviceAccount) {
    try {
      bearerToken = await getGoogleAccessToken(serviceAccount);
    } catch {
      // ignore
    }
  } else if (!bearerToken) {
    try {
      const metaRes = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
        headers: { 'Metadata-Flavor': 'Google' },
      });
      if (metaRes.ok) {
        const metaData: any = await metaRes.json();
        bearerToken = metaData.access_token;
      }
    } catch {
      // ignore
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${docPath}`;
  const headers: Record<string, string> = {};
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data: any = await res.json();
  return parseFirestoreFields(data.fields);
}

async function findStudentDoc(studentId: string, idToken?: string) {
  const directDoc = await getFirestoreDoc(`students/${studentId}`, idToken);
  if (directDoc && (directDoc.name || directDoc.nama || directDoc.id)) {
    return { id: studentId, ...directDoc };
  }

  const serviceAccount = parseServiceAccountKey();
  let bearerToken = idToken;
  if (serviceAccount) {
    try {
      bearerToken = await getGoogleAccessToken(serviceAccount);
    } catch {}
  } else if (!bearerToken) {
    try {
      const metaRes = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
        headers: { 'Metadata-Flavor': 'Google' },
      });
      if (metaRes.ok) {
        const metaData: any = await metaRes.json();
        bearerToken = metaData.access_token;
      }
    } catch {}
  }

  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: 'students' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'id' },
          op: 'EQUAL',
          value: { stringValue: studentId },
        },
      },
      limit: 1,
    },
  };

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) return null;
  const list: any = await res.json();
  if (Array.isArray(list) && list[0]?.document) {
    const docPath = list[0].document.name;
    const docId = docPath.split('/').pop();
    const fields = parseFirestoreFields(list[0].document.fields);
    return { id: docId, ...fields };
  }
  return null;
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  }
  return cleaned;
}

async function verifyCallerToken(req: express.Request) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!idToken) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Header Authorization dengan Bearer Firebase ID Token wajib disertakan.' };
  }

  let payload: any = null;
  try {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    }
  } catch {
    // Ignore
  }

  const apiKey = firebaseConfig.apiKey;
  const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const lookupData: any = await lookupRes.json().catch(() => ({}));
  if (!lookupRes.ok || !lookupData.users || lookupData.users.length === 0) {
    throw { status: 401, code: 'INVALID_TOKEN', message: 'Token otorisasi pemanggil tidak valid, telah dicabut, atau telah kedaluwarsa.' };
  }

  const user = lookupData.users[0];
  let customClaims: any = {};
  if (user.customAttributes) {
    try {
      customClaims = JSON.parse(user.customAttributes);
    } catch {
      customClaims = {};
    }
  }

  let role = customClaims.role || payload?.role;
  let tenantId = customClaims.tenantId || payload?.tenantId;

  const userEmail = (user.email || payload?.email || '').toLowerCase().trim();

  // If claims missing, perform database verification
  if (!role || !tenantId) {
    if (userEmail === 'erizamaulana.bramantya@gmail.com') {
      role = 'superadmin';
      tenantId = 'global';
    } else {
      // Check tenant owner record
      const tenantDoc = await getFirestoreDoc(`tenants/${user.localId}`, idToken);
      if (tenantDoc && (tenantDoc.ownerUid === user.localId || tenantDoc.email === userEmail)) {
        role = 'owner';
        tenantId = user.localId;
      } else {
        // Check staff record
        const staffDoc = await getFirestoreDoc(`users_staff/${user.localId}`, idToken);
        if (staffDoc && staffDoc.tenantId) {
          role = staffDoc.role || 'kasir';
          tenantId = staffDoc.tenantId;
        } else {
          // Fail-closed default: unassigned, no tenant access
          role = 'unassigned';
          tenantId = null;
        }
      }
    }
  }

  return {
    uid: user.localId,
    email: userEmail,
    role: role,
    tenantId: tenantId,
    emailVerified: user.emailVerified || false,
  };
}

async function startServer() {
  const app = express();

  app.use(express.json());

  // CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // GET /api/health : Full-stack Express Healthcheck
  app.get(['/api/health', '/health'], (req, res) => {
    const serviceAccount = parseServiceAccountKey();
    res.status(200).json({
      success: true,
      status: 'online',
      service: 'Chua Sport Core Full-Stack Node.js Express Server',
      environment: {
        projectId: firebaseConfig.projectId,
        serviceAccountConfigured: Boolean(serviceAccount),
        runtime: 'Google AI Studio Node.js Server',
        version: '2.0.0-fullstack',
      },
      endpoints: [
        'GET /api/health',
        'POST /api/create-staff',
        'POST /api/login-staff',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/create-staff : Pembuatan Staff
  app.post('/api/create-staff', async (req, res) => {
    try {
      const { email, password, displayName, role, tenantId } = req.body || {};

      if (!email || !password || !role || !tenantId) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'MISSING_FIELDS',
          message: 'Field email, password, role, dan tenantId wajib diisi.',
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const cleanDisplayName = String(displayName || '').trim();
      const normalizedRole = String(role).toLowerCase().trim();

      if (!['kasir', 'pelatih', 'coach'].includes(normalizedRole)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'INVALID_ROLE',
          message: 'Role tidak valid. Pilihan role staf yang didukung: kasir, pelatih (coach).',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'WEAK_PASSWORD',
          message: 'Password staff minimal harus 6 karakter.',
        });
      }

      // Verifikasi token pemanggil
      let caller: any;
      try {
        caller = await verifyCallerToken(req);
      } catch (callerErr: any) {
        return res.status(callerErr.status || 401).json({
          success: false,
          statusCode: callerErr.status || 401,
          error: callerErr.code || 'UNAUTHORIZED',
          message: callerErr.message || 'Otorisasi pemanggil gagal.',
        });
      }

      const isSuperAdmin = caller.email === 'erizamaulana.bramantya@gmail.com' || caller.role === 'superadmin';
      const isOwner = caller.role === 'owner' && (caller.tenantId === tenantId || caller.uid === tenantId);
      const isAuthorized = isSuperAdmin || isOwner;

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          error: 'FORBIDDEN',
          message: 'Hanya Owner dari tenant yang bersangkutan yang memiliki wewenang mendaftarkan staff.',
        });
      }

      const assignedRole = normalizedRole === 'coach' ? 'pelatih' : normalizedRole;
      const serviceAccount = parseServiceAccountKey();

      if (serviceAccount) {
        const googleAccessToken = await getGoogleAccessToken(serviceAccount);
        const customClaims = {
          role: assignedRole,
          tenantId: tenantId,
          registeredBy: caller.email,
          createdAt: new Date().toISOString(),
        };

        const createRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/projects/${firebaseConfig.projectId}/accounts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${googleAccessToken}`,
            },
            body: JSON.stringify({
              email: normalizedEmail,
              password: password,
              displayName: cleanDisplayName || (assignedRole === 'kasir' ? 'Staff Kasir' : 'Pelatih Akademi'),
              customAttributes: JSON.stringify(customClaims),
              emailVerified: false,
            }),
          }
        );

        const createData: any = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          if (createData.error?.message?.includes('EMAIL_EXISTS')) {
            return res.status(409).json({
              success: false,
              statusCode: 409,
              error: 'EMAIL_ALREADY_EXISTS',
              message: `Email "${normalizedEmail}" sudah terdaftar di sistem Firebase Authentication. Harap gunakan alamat email lain.`,
            });
          }
          return res.status(500).json({
            success: false,
            statusCode: 500,
            error: 'FIREBASE_AUTH_ERROR',
            message: createData.error?.message || 'Gagal membuat user staff di Firebase Auth.',
          });
        }

        return res.status(201).json({
          success: true,
          statusCode: 201,
          message: 'Akun staff berhasil dibuat dan Custom Claims RBAC telah disematkan.',
          data: {
            uid: createData.localId,
            email: createData.email || normalizedEmail,
            displayName: createData.displayName || cleanDisplayName,
            role: assignedRole,
            tenantId: tenantId,
            customClaims,
            isExistingUser: false,
          },
        });
      } else {
        // Fallback via Identity Toolkit Public API
        const apiKey = firebaseConfig.apiKey;
        const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            password: password,
            displayName: cleanDisplayName || (assignedRole === 'kasir' ? 'Staff Kasir' : 'Pelatih Akademi'),
            returnSecureToken: true,
          }),
        });

        const signUpData: any = await signUpRes.json().catch(() => ({}));

        if (!signUpRes.ok) {
          if (signUpData.error?.message?.includes('EMAIL_EXISTS')) {
            return res.status(409).json({
              success: false,
              statusCode: 409,
              error: 'EMAIL_ALREADY_EXISTS',
              message: `Email "${normalizedEmail}" sudah terdaftar di sistem Firebase Authentication. Harap gunakan alamat email lain.`,
            });
          }

          if (signUpData.error?.message?.includes('OPERATION_NOT_ALLOWED')) {
            return res.status(400).json({
              success: false,
              statusCode: 400,
              error: 'OPERATION_NOT_ALLOWED',
              message: 'Metode pendaftaran Email/Password belum diaktifkan di Firebase Console (Authentication > Sign-in method).',
              guidance: 'Buka Firebase Console -> Authentication -> Sign-in method -> aktifkan provider "Email/Password", atau setel variabel FIREBASE_SERVICE_ACCOUNT_KEY di environment.',
            });
          }

          return res.status(500).json({
            success: false,
            statusCode: 500,
            error: 'SIGNUP_ERROR',
            message: signUpData.error?.message || 'Gagal mendaftarkan akun di Firebase Auth.',
          });
        }

        return res.status(201).json({
          success: true,
          statusCode: 201,
          message: 'Akun staff berhasil dibuat.',
          data: {
            uid: signUpData.localId,
            email: signUpData.email || normalizedEmail,
            displayName: cleanDisplayName,
            role: assignedRole,
            tenantId: tenantId,
            isExistingUser: false,
          },
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        error: 'SERVER_ERROR',
        message: err.message || 'Terjadi kesalahan internal pada server.',
      });
    }
  });

  // Vite Integration
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CHUA SPORT CORE Full-Stack Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
