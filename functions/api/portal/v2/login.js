/**
 * Cloudflare Pages Function: /api/portal/v2/login
 * Supabase Auth email/password login endpoint for Parent Portal.
 * Uses ONLY anon/publishable key. Never service_role.
 * Verifies Auth UID, validates active parent_accounts, and sets secure portal_session_v2 cookie.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  getCleanSupabaseUrl,
  getSupabaseAnonKey,
  supabaseSignInWithPassword,
  fetchParentAccounts,
  createPortalV2Session,
  buildV2SessionCookie
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
    // 3. Authenticate with Supabase Auth using anon key
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

    // 4. Query parent_accounts for this user using their access token (Enforces RLS)
    const accountsResult = await fetchParentAccounts(supabaseUrl, anonKey, access_token);
    if (!accountsResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal memverifikasi status akun wali murid.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const activeAccounts = accountsResult.accounts || [];

    // Rule 5: User must have at least one active parent_accounts record. Do NOT auto-create account.
    if (activeAccounts.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akun Anda belum terdaftar atau belum diaktifkan sebagai wali murid oleh pihak pengelola.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 5. Create secure server-side v2 session
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();
    const sessionInit = await createPortalV2Session(context, {
      authUserId,
      email,
      parentAccounts: activeAccounts.map(acc => ({
        id: acc.id,
        tenantId: acc.tenant_id,
        fullName: acc.full_name || '',
        phone: acc.phone || '',
        status: acc.status
      })),
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

    // Return sanitized session and parent info (without secrets or access tokens)
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login berhasil.',
        user: {
          authUserId,
          email,
          accounts: activeAccounts.map(acc => ({
            id: acc.id,
            tenantId: acc.tenant_id,
            fullName: acc.full_name || '',
            status: acc.status
          }))
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
        message: 'Terjadi kesalahan pada sistem saat memproses login.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
