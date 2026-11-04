/**
 * Cloudflare Pages Function: /api/portal/logout (STAGE 7G.2A-HOTFIX)
 * Endpoint for revoking server-side session and clearing HttpOnly session cookie.
 * Enforces CSRF validation and fail-closed session revocation.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  revokePortalSession,
  buildClearSessionCookie,
  recordAuditLog
} from './_auth.js';

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

  // 1. Strict CSRF & Origin Validation
  if (!verifyCsrf(request, env)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Permintaan ditolak. Origin tidak diizinkan atau CSRF check gagal.'
      }),
      { status: 403, headers: corsHeaders }
    );
  }

  try {
    // 2. Revoke session server-side in KV or Firestore
    const revokeResult = await revokePortalSession(context);

    if (!revokeResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal mengakhiri sesi portal. Silakan coba beberapa saat lagi.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    await recordAuditLog(context, {
      action: 'PORTAL_LOGOUT',
      success: true
    });

    const isSecure = request.url.startsWith('https://') || env.ENVIRONMENT === 'production';
    const clearCookieHeader = buildClearSessionCookie(isSecure);

    const responseHeaders = {
      ...corsHeaders,
      'Set-Cookie': clearCookieHeader
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sesi portal berhasil diakhiri.'
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    console.error('Portal Logout Error:', err.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal mengakhiri sesi portal. Silakan coba beberapa saat lagi.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
