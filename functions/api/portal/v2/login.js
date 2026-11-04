/**
 * Cloudflare Pages Function: /api/portal/v2/login
 * Supabase Auth email/password login endpoint for Parent Portal.
 * Uses ONLY anon/publishable key. Never service_role.
 * Resolves child & tenant access via RPC parent_get_children.
 *
 * Enforces dual-counter rate limiting:
 * 1. IP rate limit: Max 30 attempts per 900 seconds.
 * 2. Email rate limit: Max 5 attempts per 900 seconds.
 * Both counters are always evaluated and accumulated on every attempt.
 *
 * Strict fail-closed, trusted Cloudflare IP ('cf-connecting-ip'), and origin/CSRF protection.
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

  // 3. Normalisasi email
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

  // 4. Validasi Konfigurasi Secret Server-Side (FAIL-CLOSED)
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

  // 5. Validasi IP Klien Tepercaya Cloudflare (FAIL-CLOSED)
  const clientIp = getTrustedClientIp(request);
  if (!clientIp) {
    console.error('FAIL_CLOSED: Alamat IP klien tidak terdeteksi dari header proxy tepercaya Cloudflare.');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memverifikasi identitas jaringan. Permintaan ditolak.'
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  // 6. Dual-Counter Rate Limiting (Keduanya dievaluasi dan dicatat pada setiap percobaan)
  // Counter A: IP Limit (Maks 30 percobaan per 900 detik)
  const hashedIp = await hashString(`v2_ip_${clientIp}_${encryptionSecret}`);
  const ipStorageKey = `v2_ratelimit:ip:${hashedIp}`;
  const ipRateLimit = await checkV2RateLimit(context, ipStorageKey, 30, 900);

  // Counter B: Email Limit (Maks 5 percobaan per 900 detik)
  const hashedEmail = await hashString(`v2_email_${email}_${encryptionSecret}`);
  const emailStorageKey = `v2_ratelimit:email:${hashedEmail}`;
  const emailRateLimit = await checkV2RateLimit(context, emailStorageKey, 5, 900);

  // Jika salah satu counter menolak atau mengalami error -> Tolak login
  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
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
    // 7. Authenticate with Supabase Auth using anon key
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

    // 8. Query accessible children & tenants via RPC parent_get_children (Respects RLS & auth.uid())
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

    // 9. Create secure server-side v2 session (Strict AES-256-GCM + KV)
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
