/**
 * Cloudflare Pages Function: GET & POST /api/portal/invitation/info
 * Retrieves non-enumerable invitation info using RPC get_parent_invitation_info.
 */

import { getCorsHeaders } from '../_auth_v2.js';
import { invokeGetParentInvitationInfo } from '../../tenant/parents/_invitation_helper.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequest(context) {
  return handleInfoRequest(context);
}

export async function onRequestGet(context) {
  return handleInfoRequest(context);
}

export async function onRequestPost(context) {
  return handleInfoRequest(context);
}

async function handleInfoRequest(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    let token = '';
    if (request.method === 'GET') {
      const url = new URL(request.url);
      token = url.searchParams.get('token') || '';
    } else {
      const body = await request.json().catch(() => ({}));
      token = body.token || '';
    }

    if (!token || !token.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Token undangan wajib disertakan.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Konfigurasi server tidak lengkap.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const info = await invokeGetParentInvitationInfo(supabaseUrl, serviceRoleKey, token.trim());

    if (!info || !info.invitation_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Undangan tidak ditemukan atau token tidak valid.'
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          invitationId: info.invitation_id,
          tenantId: info.tenant_id,
          parentAccountId: info.parent_account_id,
          maskedEmail: info.masked_email,
          invitationStatus: info.invitation_status,
          expiresAt: info.expires_at,
          isValid: info.is_valid
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('get_parent_invitation_info handler error:', err.message || err);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan sistem saat mengambil data undangan.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
