/**
 * Cloudflare Pages Function: /api/portal/v2/login
 * Supabase Auth email/password login endpoint for Parent Portal.
 * Uses ONLY anon/publishable key. Never service_role.
 * Resolves child & tenant access via RPC parent_get_children.
 *
 * Rate Limiting & Account Protection Architecture:
 * 1. IP Hard Rate Limit: Max 30 attempts per 900 seconds.
 *    - Hard rate limit applied before Supabase Auth call.
 *    - All login requests from the client IP are counted.
 *    - Successful logins do not clear this IP counter.
 * 2. Email Failure Tracking (Anti-Lockout):
 *    - Failed credential attempts are recorded per hashed email (`v2_ratelimit:email_failed:<hash>`).
 *    - NO hard lockout prior to Supabase Auth call, preventing malicious 3rd parties
 *      from locking legitimate parents out of their accounts.
 *
 * Strict fail-closed, trusted Cloudflare IP ('cf-connecting-ip' with strict IPv4/IPv6 validation),
 * and origin/CSRF protection.
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
  recordV2FailedLogin,
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
    console.error('FAIL_CLOSED: Alamat IP klien tidak terdeteksi atau format tidak valid dari cf-connecting-ip.');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memverifikasi identitas jaringan. Permintaan ditolak.'
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  // 6. Hard Rate Limiting: IP-based (Maksimum 30 percobaan per 900 detik)
  // Menghitung seluruh request login dari IP yang sama untuk membatasi automated brute-force flooding.
  // Login berhasil tidak menghapus counter IP.
  const hashedIp = await hashString(`v2_ip_${clientIp}_${encryptionSecret}`);
  const ipStorageKey = `v2_ratelimit:ip:${hashedIp}`;
  const ipRateLimit = await checkV2RateLimit(context, ipStorageKey, 30, 900);

  if (!ipRateLimit.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terlalu banyak percobaan login dari alamat IP Anda. Silakan tunggu beberapa menit sebelum mencoba kembali.'
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
      // Kondisi 1: Kredensial tidak valid (wrong password, unconfirmed, etc.)
      if (authResult.category === 'INVALID_CREDENTIALS') {
        // Catat kegagalan autentikasi pada counter email gagal (audit & risk tracking)
        // Mencegah account lockout DoS: Wali murid sah tidak akan terkunci meskipun pihak ketiga sengaja mencoba password salah.
        // Pure telemetry: Kegagalan pencatatan telemetry tidak mengubah hasil autentikasi.
        try {
          const hashedEmail = await hashString(`v2_email_${email}_${encryptionSecret}`);
          const emailFailureStorageKey = `v2_ratelimit:email_failed:${hashedEmail}`;
          await recordV2FailedLogin(context, emailFailureStorageKey, 900);
        } catch (telemetryErr) {
          console.error('Failed to record failed login telemetry:', telemetryErr.message);
        }

        // Anti-enumeration: Generic failure message
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Email atau kata sandi tidak sesuai.'
          }),
          { status: 401, headers: corsHeaders }
        );
      }

      // Kondisi 2: Gangguan upstream (5xx, network error, timeout, fetch exception)
      // JANGAN menambah email failure counter!
      if (authResult.category === 'UPSTREAM_ERROR') {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Layanan autentikasi sedang mengalami gangguan. Silakan coba beberapa saat lagi.'
          }),
          { status: authResult.status >= 500 ? authResult.status : 503, headers: corsHeaders }
        );
      }

      // Kondisi 3: Konfigurasi bermasalah atau bad request dari server
      // JANGAN menambah email failure counter!
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Terjadi kendala pada konfigurasi layanan autentikasi. Hubungi administrator.'
        }),
        { status: 500, headers: corsHeaders }
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
