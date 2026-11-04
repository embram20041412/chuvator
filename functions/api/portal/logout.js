/**
 * Cloudflare Pages Function: /api/portal/logout
 * Endpoint for revoking server-side session and clearing HttpOnly session cookie.
 */

import {
  getCorsHeaders,
  revokePortalSession,
  buildClearSessionCookie,
  recordAuditLog,
  parseCookie
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
    const token = parseCookie(request, 'portal_session');

    // Revoke session server-side in KV / Firestore
    await revokePortalSession(context);

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
    console.error('Portal Logout Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal mengakhiri sesi portal.',
        details: err.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
