import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Inisialisasi Supabase Client Server-side
const rawUrl = process.env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifyCallerToken(req: express.Request) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw {
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Header Authorization dengan Bearer Supabase Access Token wajib disertakan.',
    };
  }

  // Verifikasi token via Supabase Auth
  const { data: userData, error: userError } = await supabaseServer.auth.getUser(token);

  if (userError || !userData?.user) {
    throw {
      status: 401,
      code: 'INVALID_TOKEN',
      message: 'Token otorisasi pemanggil tidak valid, telah dicabut, atau telah kedaluwarsa.',
    };
  }

  const user = userData.user;
  const userEmail = (user.email || '').toLowerCase().trim();

  // 1. Cek Superadmin
  if (userEmail === 'erizamaulana.bramantya@gmail.com') {
    return {
      uid: user.id,
      email: userEmail,
      role: 'superadmin',
      tenantId: 'global',
    };
  }

  // 2. Cek Owner dari tabel tenants
  const { data: tenant } = await supabaseServer
    .from('tenants')
    .select('id, owner_uid, email')
    .or(`owner_uid.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (tenant) {
    return {
      uid: user.id,
      email: userEmail,
      role: 'owner',
      tenantId: tenant.id,
    };
  }

  // 3. Cek Staff dari tabel users_staff
  const { data: staff } = await supabaseServer
    .from('users_staff')
    .select('role, tenant_id')
    .or(`uid.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (staff && staff.tenant_id) {
    return {
      uid: user.id,
      email: userEmail,
      role: staff.role || 'kasir',
      tenantId: staff.tenant_id,
    };
  }

  // 4. Fallback jika ada role di user_metadata
  const metaRole = user.user_metadata?.role;
  const metaTenantId = user.user_metadata?.tenantId || user.user_metadata?.tenant_id;
  if (metaRole && metaTenantId) {
    return {
      uid: user.id,
      email: userEmail,
      role: metaRole,
      tenantId: metaTenantId,
    };
  }

  return {
    uid: user.id,
    email: userEmail,
    role: 'unassigned',
    tenantId: null,
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
    res.status(200).json({
      success: true,
      status: 'online',
      service: 'Chua Sport Core Supabase Full-Stack Server',
      environment: {
        supabaseConfigured: Boolean(supabaseUrl && supabaseKey),
        runtime: 'Google AI Studio Node.js Server',
        version: '2.0.0-supabase-fullstack',
      },
      endpoints: [
        'GET /api/health',
        'POST /api/create-staff',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/create-staff : Pembuatan Staff di Supabase
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

      if (!['kasir', 'pelatih', 'coach', 'admin'].includes(normalizedRole)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'INVALID_ROLE',
          message: 'Role tidak valid. Pilihan role staf yang didukung: kasir, pelatih, admin.',
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
      let newUserId: string | null = null;

      // 1. Coba buat user via admin API jika SERVICE_ROLE_KEY tersedia
      const hasAdminKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
      if (hasAdminKey && (supabaseServer.auth as any).admin?.createUser) {
        try {
          const { data: adminUser, error: adminErr } = await (supabaseServer.auth as any).admin.createUser({
            email: normalizedEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              displayName: cleanDisplayName || (assignedRole === 'kasir' ? 'Staff Kasir' : 'Pelatih Akademi'),
              role: assignedRole,
              tenantId: tenantId,
            },
          });

          if (!adminErr && adminUser?.user?.id) {
            newUserId = adminUser.user.id;
          } else if (adminErr?.message?.toLowerCase().includes('already registered')) {
            return res.status(409).json({
              success: false,
              statusCode: 409,
              error: 'EMAIL_ALREADY_EXISTS',
              message: `Email "${normalizedEmail}" sudah terdaftar di sistem autentikasi. Harap gunakan alamat email lain.`,
            });
          }
        } catch (e) {
          console.warn('Admin createUser fallback to isolated client:', e);
        }
      }

      // 2. Jika belum berhasil (atau tanpa admin key), buat akun via isolated client agar sesi caller tidak tertimpa
      if (!newUserId) {
        const isolatedAuthClient = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const { data: signUpData, error: signUpError } = await isolatedAuthClient.auth.signUp({
          email: normalizedEmail,
          password: password,
          options: {
            data: {
              displayName: cleanDisplayName || (assignedRole === 'kasir' ? 'Staff Kasir' : 'Pelatih Akademi'),
              role: assignedRole,
              tenantId: tenantId,
            },
          },
        });

        if (signUpError) {
          const msg = signUpError.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('user already exists')) {
            return res.status(409).json({
              success: false,
              statusCode: 409,
              error: 'EMAIL_ALREADY_EXISTS',
              message: `Email "${normalizedEmail}" sudah terdaftar di sistem autentikasi. Harap gunakan alamat email lain.`,
            });
          }

          return res.status(500).json({
            success: false,
            statusCode: 500,
            error: 'SIGNUP_ERROR',
            message: signUpError.message || 'Gagal mendaftarkan akun di Supabase Auth.',
          });
        }

        newUserId = signUpData.user?.id || null;
      }

      if (!newUserId) {
        return res.status(500).json({
          success: false,
          statusCode: 500,
          error: 'USER_CREATION_FAILED',
          message: 'Gagal memperoleh ID pengguna baru setelah pendaftaran.',
        });
      }

      // 3. Simpan profil staf ke tabel users_staff di Supabase
      const { error: dbError } = await supabaseServer.from('users_staff').upsert(
        {
          uid: newUserId,
          email: normalizedEmail,
          display_name: cleanDisplayName || normalizedEmail.split('@')[0],
          name: cleanDisplayName || normalizedEmail.split('@')[0],
          role: assignedRole,
          tenant_id: tenantId,
          status: 'active',
          auth_method: 'express_fullstack_supabase_rbac',
          created_by: caller.email,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'uid' }
      );

      if (dbError) {
        console.error('Error saving to users_staff in backend:', dbError);
        // User auth sudah dibuat, kembalikan uid agar client bisa handle atau sync
      }

      return res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Akun staff berhasil dibuat dan profil disimpan di Supabase.',
        data: {
          uid: newUserId,
          email: normalizedEmail,
          displayName: cleanDisplayName,
          role: assignedRole,
          tenantId: tenantId,
          isExistingUser: false,
        },
      });
    } catch (err: any) {
      console.error('Unhandled error in /api/create-staff:', err);
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
    console.log(`CHUA SPORT CORE Supabase Full-Stack Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
