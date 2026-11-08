/**
 * Cloudflare Pages Function: POST /api/portal/invitation/claim
 * CHUVATOR Parent Portal V3.3 - Invitation Claim & Continuation Ticket Handler.
 */

import { getCorsHeaders, verifyCsrf } from '../_auth_v2.js';
import {
  validateSupabaseActionLink,
  invokeGetParentInvitationInfo,
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
      code: 'METHOD_NOT_ALLOWED',
      message: 'Metode GET tidak diizinkan. Tautan aktivasi harus diklaim melalui permintaan POST.'
    }),
    { status: 405, headers: corsHeaders }
  );
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
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Permintaan ditolak karena masalah keamanan (Invalid Origin/Referer).'
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
          code: 'INVALID_CLAIM_TOKEN',
          message: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Handling V3.3 Invitation Token (starts with 'inv_')
    if (rawToken.startsWith('inv_')) {
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
          JSON.stringify({ success: false, message: 'Konfigurasi server tidak lengkap.' }),
          { status: 500, headers: securityHeaders }
        );
      }

      // Query invitation info
      const info = await invokeGetParentInvitationInfo(supabaseUrl, serviceRoleKey, rawToken);

      if (!info || !info.is_valid) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'INVITATION_INVALID_OR_EXPIRED',
            message: 'Tautan undangan tidak valid, telah kedaluwarsa, atau sudah dicabut.'
          }),
          { status: 400, headers: securityHeaders }
        );
      }

      // If authUid is present, execute continuation ticket creation and ticket claim
      if (authUid) {
        try {
          const ticketRes = await invokeCreateContinuationTicket(supabaseUrl, serviceRoleKey, {
            rawInvitationToken: rawToken,
            tenantId: info.tenant_id,
            authUid: authUid
          });

          const ticketToken = ticketRes?.raw_ticket_token;
          if (!ticketToken) {
            return new Response(
              JSON.stringify({ success: false, message: 'Gagal membuat tiket kelanjutan klaim.' }),
              { status: 500, headers: securityHeaders }
            );
          }

          const claimRes = await invokeClaimParentInvitationByTicket(supabaseUrl, serviceRoleKey, {
            rawTicketToken: ticketToken,
            authUid: authUid
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Akun wali murid dan keterikatan siswa berhasil diaktifkan!',
              tenantId: claimRes.tenant_id,
              parentAccountId: claimRes.parent_account_id,
              claimedAt: claimRes.claimed_at
            }),
            { status: 200, headers: securityHeaders }
          );

        } catch (rpcErr) {
          console.error('[Claim Error] Ticket creation/claim RPC error:', rpcErr.message);
          return new Response(
            JSON.stringify({
              success: false,
              code: 'TICKET_CLAIM_FAILED',
              message: `Proses klaim tiket gagal: ${rpcErr.message}`
            }),
            { status: 400, headers: securityHeaders }
          );
        }
      }

      // If authUid is not yet available, return invitation info
      return new Response(
        JSON.stringify({
          success: true,
          invitation: {
            invitationId: info.invitation_id,
            tenantId: info.tenant_id,
            parentAccountId: info.parent_account_id,
            maskedEmail: info.masked_email,
            expiresAt: info.expires_at,
            isValid: info.is_valid
          }
        }),
        { status: 200, headers: securityHeaders }
      );
    }

    // 2. Handling Intermediary KV Claim Tokens (64 hex string)
    const kvBinding = env.PORTAL_SESSIONS_KV || env.PORTAL_RATELIMIT_KV;
    if (!kvBinding) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'SERVER_CONFIG_ERROR',
          message: 'Layanan aktivasi saat ini sedang tidak tersedia.'
        }),
        { status: 500, headers: securityHeaders }
      );
    }

    const claimKey = `v2_invitation_claim:${rawToken}`;
    const rawRecord = await kvBinding.get(claimKey).catch(() => null);

    if (!rawRecord) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'CLAIM_NOT_FOUND_OR_EXPIRED',
          message: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        }),
        { status: 410, headers: securityHeaders }
      );
    }

    let record = JSON.parse(rawRecord || '{}');
    if (!record || !record.actionLink) {
      await kvBinding.delete(claimKey).catch(() => {});
      return new Response(
        JSON.stringify({
          success: false,
          code: 'CLAIM_DATA_CORRUPT',
          message: 'Tautan aktivasi tidak valid.'
        }),
        { status: 410, headers: securityHeaders }
      );
    }

    await kvBinding.delete(claimKey).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        actionLink: record.actionLink
      }),
      { status: 200, headers: securityHeaders }
    );

  } catch (err) {
    console.error('[Claim Error] Unexpected exception in claim handler:', err.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        code: 'INTERNAL_CLAIM_ERROR',
        message: 'Terjadi kesalahan sistem saat memproses aktivasi akun.'
      }),
      { status: 500, headers: securityHeaders }
    );
  }
}
