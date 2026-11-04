/**
 * Cloudflare Pages Function: /api/portal/v2/login
 * Supabase Auth email/password login endpoint for Parent Portal.
 * Uses ONLY anon/publishable key. Never service_role.
 * Resolves child & tenant access via RPC parent_get_children.
 * Enforces pure edge rate limiting (NO FIRESTORE), strict server secret salt,
 * trusted Cloudflare client IP, strict origin/CSRF, and secure portal_session_v2 cookie.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  getCleanSupabaseUrl,
  getSupabaseAnonKey,
  supabaseSignInWithPassword,
  fetchChildrenViaRpc,
  createPortalV2Session,
  buildV2SessionCookie,
  getTrustedClientIp,
  checkV2RateLimit,
  hashString
} from '../_auth_v2.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  // 1. Strict Origin & CSRF check
  if (!verifyCsrf(request, env)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Permintaan ditolak. Origin tidak diizinkan atau pengecekan CSRF gagal.'
      }),
      { status: 403, headers: corsHeaders }
    );
  }

  // 2. Parse request body
  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Format request tidak valid. JSON body diperlukan.'
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Email dan kata sandi wajib diisi.'
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  // 3. Strict Server-Side Salt & Rate Limiting (NO FIRESTORE)
  // Must use PORTAL_TOKEN_ENCRYPTION_SECRET as server-side salt.
  // NO FALLBACK to hardcoded strings, anon keys, or public values.
  const encryptionSecret = (env.PORTAL_TOKEN_ENCRYPTION_SECRET || '').trim();
  if (!encryptionSecret) {
    console.error('FAIL_CLOSED: PORTAL_TOKEN_ENCRYPTION_SECRET tidak dikonfigurasi.');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Konfigurasi keamanan server belum lengkap. Hubungi administrator.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }

  // Extract IP using Cloudflare edge proxy header ('cf-connecting-ip'), non-spoofable
  const clientIp = getTrustedClientIp(request);
  const hashedEmail = await hashString(`v2_salt_${email}_${encryptionSecret}`);
  const rateLimitKey = `v2_login_${clientIp}_${hashedEmail}`;

  // Limit: max 5 login attempts per 15 minutes (900 seconds)
  const rateLimitResult = await checkV2RateLimit(context, rateLimitKey, 5, 900);
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terlalu banyak percobaan login. Silakan tunggu beberapa menit sebelum mencoba kembali.'
      }),
      { status: 429, headers: corsHeaders }
    );
  }

  const supabaseUrl = getCleanSupabaseUrl(env);
  const anonKey = getSupabaseAnonKey(env);

  if (!supabaseUrl || !anonKey) {
    console.error('Supabase configuration missing (SUPABASE_URL or SUPABASE_ANON_KEY)');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Konfigurasi server belum lengkap. Hubungi administrator.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    // 4. Authenticate with Supabase Auth using anon key
    const authResult = await supabaseSignInWithPassword(supabaseUrl, anonKey, email, password);

    if (!authResult.success || !authResult.data?.access_token) {
      // Anti-enumeration: Generic failure message
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email atau kata sandi tidak sesuai.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { access_token, refresh_token, user, expires_in } = authResult.data;
    const authUserId = user?.id;

    if (!authUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Autentikasi gagal: identitas pengguna tidak valid.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 5. Query accessible children & tenants via RPC parent_get_children (Respects RLS & auth.uid())
    const childrenResult = await fetchChildrenViaRpc(supabaseUrl, anonKey, access_token);
    if (!childrenResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal memverifikasi akun wali murid melalui database.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const linkedChildren = childrenResult.children || [];

    // Rule: If RPC returns empty array, reject login with appropriate notice.
    // Do NOT auto-create account.
    if (linkedChildren.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akun Anda belum terdaftar atau belum dihubungkan dengan data siswa oleh pihak pengelola.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Extract unique accessible tenant IDs without fabricating missing fields
    const tenantSet = new Set();
    linkedChildren.forEach(child => {
      if (child.tenant_id) {
        tenantSet.add(child.tenant_id);
      }
    });
    const accessibleTenants = Array.from(tenantSet);

    // Minimize children summary for the session (only fields returned by RPC)
    const childrenSummary = linkedChildren.map(child => ({
      studentId: child.student_id || child.id,
      studentName: child.student_name || child.full_name || child.name || '',
      tenantId: child.tenant_id || '',
      academyName: child.academy_name || child.tenant_name || '',
      className: child.class_name || ''
    }));

    // 6. Create secure server-side v2 session (Strict AES-256-GCM + KV)
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();
    const sessionInit = await createPortalV2Session(context, {
      authUserId,
      email,
      accessibleTenants,
      childrenSummary,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt
    });

    const isSecure = request.url.startsWith('https://') || env.ENVIRONMENT === 'production';
    const cookieHeader = buildV2SessionCookie(sessionInit.sessionToken, 86400, isSecure);

    const responseHeaders = {
      ...corsHeaders,
      'Set-Cookie': cookieHeader
    };

    // Return sanitized session payload without exposing tokens or secrets
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login berhasil.',
        user: {
          authUserId,
          email,
          accessibleTenants,
          children: childrenSummary
        },
        csrfToken: sessionInit.csrfToken,
        expiresAt: sessionInit.expiresAt
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    console.error('Portal v2 login error:', err.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: err.message.startsWith('CONFIG_ERROR')
          ? 'Konfigurasi server bermasalah. Hubungi administrator.'
          : 'Terjadi kesalahan pada sistem saat memproses login.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
