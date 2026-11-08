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

async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleInfoRequest(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    let rawToken = '';
    if (request.method === 'GET') {
      const url = new URL(request.url);
      rawToken = url.searchParams.get('token') || '';
    } else {
      const body = await request.json().catch(() => ({}));
      rawToken = body.token || '';
    }

    if (!rawToken || !rawToken.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token undangan wajib disertakan.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Konfigurasi server tidak lengkap.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Hashing raw token utuh (including 'inv_' prefix)
    const hashedToken = await hashToken(rawToken.trim());

    // Query table 'parent_invitations' directly using serviceKey to bypass RLS
    const queryUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/parent_invitations?invitation_token_hash=eq.${hashedToken}&select=*,parent_accounts(email)`;
    const resp = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Database query failed: ${errText}`);
    }

    const results = await resp.json();
    const invitation = Array.isArray(results) ? results[0] : null;

    if (!invitation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Undangan tidak ditemukan atau token tidak valid.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (invitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: `Undangan tidak dapat digunakan (Status: ${invitation.status}).` }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (invitation.expires_at && new Date() > new Date(invitation.expires_at)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tautan undangan telah kedaluwarsa.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Manual Email Masking in JS
    const rawEmail = invitation.parent_accounts?.email || '';
    let maskedEmail = '';
    if (rawEmail.includes('@')) {
      const [name, domain] = rawEmail.split('@');
      if (name.length > 2) {
        maskedEmail = `${name[0]}***${name[name.length - 1]}@${domain}`;
      } else {
        maskedEmail = `${name[0]}***@${domain}`;
      }
    }

    const invitationData = {
      invitationId: invitation.id,
      tenantId: invitation.tenant_id,
      parentAccountId: invitation.parent_account_id,
      maskedEmail: maskedEmail,
      invitationStatus: invitation.status,
      expiresAt: invitation.expires_at,
      isValid: true
    };

    return new Response(
      JSON.stringify({
        success: true,
        invitation: invitationData,
        data: invitationData
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('get_parent_invitation_info handler error:', err.message || err);
    return new Response(
      JSON.stringify({ success: false, error: 'Terjadi kesalahan sistem saat mengambil data undangan.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
