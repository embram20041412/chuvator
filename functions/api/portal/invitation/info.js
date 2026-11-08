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
        JSON.stringify({ 
          success: false, 
          is_valid: false, 
          isValid: false, 
          error: 'Token undangan wajib disertakan.',
          message: 'Token undangan wajib disertakan.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          is_valid: false, 
          isValid: false, 
          error: 'Konfigurasi server tidak lengkap.',
          message: 'Konfigurasi server tidak lengkap.' 
        }),
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
        JSON.stringify({ 
          success: false, 
          is_valid: false, 
          isValid: false, 
          error: 'Undangan tidak ditemukan atau token tidak valid.',
          message: 'Undangan tidak ditemukan atau token tidak valid.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (invitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          is_valid: false, 
          isValid: false, 
          error: `Undangan tidak dapat digunakan (Status: ${invitation.status}).`,
          message: `Undangan tidak dapat digunakan (Status: ${invitation.status}).` 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (invitation.expires_at && new Date() > new Date(invitation.expires_at)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          is_valid: false, 
          isValid: false, 
          error: 'Tautan undangan telah kedaluwarsa.',
          message: 'Tautan undangan telah kedaluwarsa.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Masking email aman
    const rawEmail = invitation.parent_accounts?.email || invitation.email || '';
    const emailParts = rawEmail.split('@');
    const maskedEmail = emailParts.length === 2 
      ? (emailParts[0].length > 2 
          ? `${emailParts[0][0]}***${emailParts[0][emailParts[0].length - 1]}@${emailParts[1]}` 
          : `${emailParts[0].substring(0, 1)}***@${emailParts[1]}`)
      : '***@***.com';

    // Ambil nama tenant jika tersedia
    let tenantName = invitation.tenants?.name || 'Chua Sport Academy';
    if (!invitation.tenants?.name && invitation.tenant_id) {
      try {
        const tResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/tenants?id=eq.${encodeURIComponent(invitation.tenant_id)}&select=name`, {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Accept': 'application/json'
          }
        });
        if (tResp.ok) {
          const tData = await tResp.json();
          if (tData?.[0]?.name) {
            tenantName = tData[0].name;
          }
        }
      } catch (_) {}
    }

    const responseData = {
      // Format camelCase (Standar V3.3)
      id: invitation.id,
      tenantId: invitation.tenant_id,
      studentId: invitation.student_id,
      parentAccountId: invitation.parent_account_id,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      maskedEmail: maskedEmail,
      tenantName: tenantName,
      
      // Format snake_case / Legacy / Top-level flags
      is_valid: true,
      isValid: true,
      tenant_id: invitation.tenant_id,
      student_id: invitation.student_id,
      parent_account_id: invitation.parent_account_id,
      tenant_name: tenantName,
      masked_email: maskedEmail,
      invite_role: invitation.relationship || 'guardian',
      expires_at: invitation.expires_at,

      // Format alias ekstra
      invitationId: invitation.id,
      invitationStatus: invitation.status,
      invitation_id: invitation.id,
      invitation_status: invitation.status
    };

    return new Response(JSON.stringify({
      success: true,
      is_valid: true,
      isValid: true,
      data: responseData,
      invitation: responseData,
      // Properti rata tingkat atas (top-level properties) untuk menangkap ekspektasi frontend manapun
      id: invitation.id,
      tenantId: responseData.tenantId,
      studentId: responseData.studentId,
      parentAccountId: responseData.parentAccountId,
      status: responseData.status,
      tenantName: responseData.tenantName,
      maskedEmail: responseData.maskedEmail,
      expiresAt: responseData.expiresAt,
      tenant_name: responseData.tenant_name,
      masked_email: responseData.masked_email,
      expires_at: responseData.expires_at,
      student_id: responseData.student_id,
      tenant_id: responseData.tenant_id,
      parent_account_id: responseData.parent_account_id,
      invite_role: responseData.invite_role
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });

  } catch (err) {
    console.error('get_parent_invitation_info handler error:', err.message || err);
    return new Response(
      JSON.stringify({ success: false, error: 'Terjadi kesalahan sistem saat mengambil data undangan.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
