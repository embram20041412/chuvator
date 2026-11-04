/**
 * Cloudflare Pages Function: /api/portal/v2/session
 * Validates HttpOnly portal_session_v2 cookie, auto-refreshes Supabase access token if needed,
 * and returns active parent account details without exposing raw tokens.
 */

import {
  getCorsHeaders,
  validatePortalV2Session
} from '../_auth_v2.js';

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
    const result = await validatePortalV2Session(context);

    if (!result.valid) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          message: 'Sesi tidak valid atau telah kedaluwarsa.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        session: {
          authUserId: result.session.authUserId,
          email: result.session.email,
          accessibleTenants: result.session.accessibleTenants || [],
          children: result.session.childrenSummary || [],
          csrfToken: result.session.csrfToken || null,
          expiresAt: result.session.expiresAt
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Portal v2 session validation error:', err.message);
    return new Response(
      JSON.stringify({
        authenticated: false,
        message: 'Gagal memverifikasi sesi portal.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
