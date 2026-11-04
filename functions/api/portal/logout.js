/**
 * Cloudflare Pages Function: /api/portal/logout (STAGE 7G.2A.2)
 * Endpoint for revoking server-side session and clearing HttpOnly session cookie.
 * Enforces session validation, session-bound CSRF token check, and fail-closed session revocation.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  validatePortalSession,
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

  try {
    // 1. Validate Active Session First
    const sessionResult = await validatePortalSession(context);
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

    // 3. Revoke session server-side in KV or Firestore (FAIL-CLOSED)
    const revokeResult = await revokePortalSession(context);

    if (!revokeResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal mengakhiri sesi portal pada database server.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    await recordAuditLog(context, {
      action: 'PORTAL_LOGOUT',
      studentId: sessionResult.session.studentId,
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

