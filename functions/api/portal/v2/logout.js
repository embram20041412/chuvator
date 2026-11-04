/**
 * Cloudflare Pages Function: /api/portal/v2/logout
 * Revokes portal_session_v2 session on server (KV) and clears HttpOnly cookie.
 * Enforces session validation and CSRF token match.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  validatePortalV2Session,
  revokePortalV2Session,
  buildClearV2SessionCookie
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

  try {
    // 1. Validate Active v2 Session First
    const sessionResult = await validatePortalV2Session(context);
    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Sesi tidak valid atau telah kedaluwarsa.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Verify Session-Bound CSRF Token & Origin
    const expectedCsrfToken = sessionResult.session.csrfToken || null;
    if (!verifyCsrf(request, env, expectedCsrfToken)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Permintaan ditolak. CSRF token atau Origin tidak valid.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Revoke v2 session server-side in KV
    const revokeResult = await revokePortalV2Session(context);
    if (!revokeResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal mengakhiri sesi portal pada server.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const isSecure = request.url.startsWith('https://') || env.ENVIRONMENT === 'production';
    const clearCookieHeader = buildClearV2SessionCookie(isSecure);

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
    console.error('Portal v2 logout error:', err.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal mengakhiri sesi portal. Silakan coba beberapa saat lagi.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
