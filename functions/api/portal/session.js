/**
 * Cloudflare Pages Function: /api/portal/session
 * Validates the current HttpOnly portal_session cookie and returns session state.
 */

import {
  getCorsHeaders,
  validatePortalSession
} from './_auth.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function onRequestGet(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const result = await validatePortalSession(context);

    if (!result.valid) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          message: result.reason || 'Sesi tidak valid atau telah kedaluwarsa.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        session: {
          studentId: result.session.studentId,
          tenantId: result.session.tenantId,
          studentName: result.session.studentName,
          expiresAt: result.session.expiresAt
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Portal Session Validation Error:', err);
    return new Response(
      JSON.stringify({
        authenticated: false,
        message: 'Gagal memverifikasi sesi portal.',
        details: err.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
