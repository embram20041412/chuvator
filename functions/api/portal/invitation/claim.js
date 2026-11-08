/**
 * Cloudflare Pages Function: POST /api/portal/invitation/claim
 * CHUVATOR Parent Portal V3.3 - Invitation Claim & Continuation Ticket Handler.
 */

import { getCorsHeaders, verifyCsrf } from '../_auth_v2.js';
import {
  invokeCreateContinuationTicket,
  invokeClaimParentInvitationByTicket
} from '../../tenant/parents/_invitation_helper.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Metode GET tidak diizinkan. Tautan aktivasi harus diklaim melalui permintaan POST.'
    }),
    { status: 405, headers: corsHeaders }
  );
}

async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  const securityHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer'
  };

  if (!verifyCsrf(request, env)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Permintaan ditolak karena masalah keamanan (Invalid Origin/Referer).'
      }),
      { status: 403, headers: securityHeaders }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawToken = (body?.token || '').trim();
    const authUid = body?.authUid || null;

    if (!rawToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    // 1. Handling V3.3 Invitation Token (starts with 'inv_')
    if (rawToken.startsWith('inv_')) {
      if (!supabaseUrl || !serviceKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Konfigurasi server tidak lengkap.' }),
          { status: 500, headers: securityHeaders }
        );
      }

      // Hashing raw token utuh (including 'inv_' prefix)
      const hashedToken = await hashToken(rawToken.trim());

      // Query table 'parent_invitations' directly using serviceKey to bypass RLS
      const queryUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/parent_invitations?invitation_token_hash=eq.${hashedToken}&select=id,tenant_id,student_id,parent_account_id,status,expires_at,parent_accounts(email,auth_uid)`;
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
          { status: 400, headers: securityHeaders }
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
          { status: 400, headers: securityHeaders }
        );
      }

      // Null-safe date check for expires_at
      if (invitation.expires_at && new Date() > new Date(invitation.expires_at)) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            is_valid: false, 
            isValid: false, 
            error: 'Tautan undangan telah kedaluwarsa.',
            message: 'Tautan undangan telah kedaluwarsa.' 
          }),
          { status: 400, headers: securityHeaders }
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

      const targetAuthUid = authUid || invitation.parent_accounts?.auth_uid;
      const targetEmail = invitation.parent_accounts?.email;
      const newPassword = body?.password || body?.newPassword;

      if (newPassword && newPassword.length < 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'Kata sandi minimal harus 6 karakter.' }),
          { status: 400, headers: securityHeaders }
        );
      }

      // If targetAuthUid is present and activation requested (via authUid or password provided)
      if (targetAuthUid && (authUid || newPassword)) {
        try {
          if (newPassword) {
            // Update password in Supabase Auth via Admin API
            await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${targetAuthUid}`, {
              method: 'PUT',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ password: newPassword })
            });
          }

          const ticketRes = await invokeCreateContinuationTicket(supabaseUrl, serviceKey, {
            rawInvitationToken: rawToken, 
            tenantId: invitation.tenant_id,
            authUid: targetAuthUid
          });

          const ticketToken = ticketRes?.raw_ticket_token;
          if (!ticketToken) {
            return new Response(
              JSON.stringify({ success: false, error: 'Gagal membuat tiket kelanjutan klaim.' }),
              { status: 500, headers: securityHeaders }
            );
          }

          const claimRes = await invokeClaimParentInvitationByTicket(supabaseUrl, serviceKey, {
            rawTicketToken: ticketToken,
            authUid: targetAuthUid
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Akun wali murid dan keterikatan siswa berhasil diaktifkan!',
              tenantId: claimRes.tenant_id,
              parentAccountId: claimRes.parent_account_id,
              claimedAt: claimRes.claimed_at,
              email: targetEmail,
              invitation: responseData, // Include for consistency
              data: responseData
            }),
            { status: 200, headers: securityHeaders }
          );

        } catch (rpcErr) {
          console.error('[Claim Error] Ticket creation/claim RPC error:', rpcErr.message);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Proses klaim tiket gagal: ${rpcErr.message}`
            }),
            { status: 400, headers: securityHeaders }
          );
        }
      }

      // If authUid is not yet available, return invitation info
      return new Response(
        JSON.stringify({
          success: true,
          is_valid: true,
          isValid: true,
          data: responseData,
          invitation: responseData,
          // Properti rata tingkat atas (top-level properties)
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
        }),
        { status: 200, headers: securityHeaders }
      );
    }

    // Fallback for non-V3 tokens or unexpected formats
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Format tautan aktivasi tidak dikenali.'
      }),
      { status: 400, headers: securityHeaders }
    );

  } catch (err) {
    console.error('[Claim Error] Unexpected exception in claim handler:', err.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Terjadi kesalahan sistem saat memproses aktivasi akun.'
      }),
      { status: 500, headers: securityHeaders }
    );
  }
}
