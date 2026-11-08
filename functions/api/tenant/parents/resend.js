/**
 * Cloudflare Pages Function: POST /api/tenant/parents/resend
 * Parent Portal WhatsApp-Only Invitation & Recovery (V2.6.11 Audit Hotfix).
 * Generates official Supabase Admin action link without email dispatch,
 * validates action link, strictly checks tenant identity from database,
 * normalizes WhatsApp number, updates generatedAt, and ensures persistent status tracking.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession } from '../_auth_staff.js';
import {
  validateAndNormalizeWhatsAppNumber,
  generateWhatsAppMessage,
  buildWhatsAppUrl,
  isValidSupabaseActionLink,
  validateSupabaseActionLink,
  getVerifiedTenantName,
  generateClaimToken,
  buildIntermediaryClaimUrl,
  invokeCreateParentInvitation,
  invokeRevokeParentInvitation
} from './_invitation_helper.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Staff Authentication & RBAC
    const authResult = await validateStaffSession(context);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ success: false, message: authResult.message }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { role, tenantId: staffTenantId, uid: staffUid } = authResult.user;
    if (!['superadmin', 'owner', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat mengelola undangan wali murid.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 2. Parse Body
    const body = await request.json().catch(() => ({}));
    const { parentId, email, action = 'generate' } = body;

    if (!parentId && !email) {
      return new Response(
        JSON.stringify({ success: false, message: 'Parent ID atau email wajib disertakan.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const isProduction = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, code: 'SUPABASE_CONFIG_MISSING', message: 'Konfigurasi server tidak lengkap.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. Rate limiting check (KV with fallback)
    const kvBinding = env.PORTAL_SESSIONS_KV || env.PORTAL_RATELIMIT_KV;
    if (isProduction && !kvBinding) {
      console.error('FAIL_CLOSED: PORTAL_RATELIMIT_KV / PORTAL_SESSIONS_KV missing in production for invitation.');
      return new Response(
        JSON.stringify({ success: false, message: 'Konfigurasi rate limit server wajib tersedia di production.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Fetch Parent Account (Tenant Isolation)
    let queryUrl = `${supabaseUrl}/rest/v1/parent_accounts?select=id,tenant_id,email,phone,full_name,auth_uid`;
    if (parentId) {
      queryUrl += `&id=eq.${encodeURIComponent(parentId)}`;
    } else {
      queryUrl += `&email=eq.${encodeURIComponent(email)}`;
    }
    if (role !== 'superadmin') {
      queryUrl += `&tenant_id=eq.${encodeURIComponent(staffTenantId)}`;
    }

    const parentResp = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });

    if (!parentResp.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'Gagal memverifikasi akun wali murid.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const parents = await parentResp.json().catch(() => []);
    if (!Array.isArray(parents) || parents.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akun wali murid tidak ditemukan atau di luar tenant Anda.' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const parent = parents[0];
    const targetEmail = parent.email;
    const authUid = parent.auth_uid;
    const targetTenantId = parent.tenant_id;

    // Rate limit increment for generating invitations
    if (kvBinding && action === 'generate') {
      const rateKey = `v2_ratelimit:resend:${parent.id}`;
      const countStr = await kvBinding.get(rateKey);
      const count = countStr ? Number(countStr) : 0;
      if (count >= 10) {
        return new Response(
          JSON.stringify({ success: false, message: 'Terlalu banyak permintaan pembuatan undangan. Silakan tunggu beberapa menit.' }),
          { status: 429, headers: corsHeaders }
        );
      }
      await kvBinding.put(rateKey, String(count + 1), { expirationTtl: 300 });
    }

    // 5. Auth User Verification
    if (!authUid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'AUTH_UID_MISSING', 
          message: 'Auth UID tidak ditemukan pada akun wali murid.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const authUserResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${authUid}`, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!authUserResp.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'AUTH_VERIFICATION_FAILED', 
          message: 'Gagal memverifikasi status autentikasi user (Fail-closed).' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const authUser = await authUserResp.json().catch(() => null);
    if (!authUser || typeof authUser !== 'object' || authUser.id !== authUid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'AUTH_VERIFICATION_FAILED', 
          message: 'Respons Auth tidak valid atau ID user tidak cocok (Fail-closed).' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const isConfirmed = !!(authUser.email_confirmed_at || authUser.confirmed_at);

    // 6. Handle Action: revoke
    if (action === 'revoke') {
      const revokeReason = body.reason || 'Dicabut oleh pengelola';
      const rpcResult = await invokeRevokeParentInvitation(supabaseUrl, serviceRoleKey, {
        tenantId: targetTenantId,
        actorUid: staffUid,
        invitationIdOrToken: parent.id,
        reason: revokeReason
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'REVOKED',
          message: 'Undangan wali murid berhasil dicabut.',
          data: rpcResult
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 7. Handle Action: generate / resend WhatsApp invitation link via RPC create_parent_invitation
    const phoneCheck = validateAndNormalizeWhatsAppNumber(parent.phone);
    if (!phoneCheck.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_PHONE_NUMBER',
          message: `Nomor WhatsApp wali murid tidak valid: ${phoneCheck.error}`
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    let tenantName;
    try {
      tenantName = await getVerifiedTenantName(supabaseUrl, serviceRoleKey, targetTenantId);
    } catch (tErr) {
      return new Response(
        JSON.stringify({
          success: false,
          code: tErr.code || 'TENANT_VERIFICATION_FAILED',
          message: tErr.message || 'Gagal memverifikasi identitas tenant resmi.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Fetch student linked to this parent account
    let targetStudentId = body.studentId;
    let relationship = body.relationship || 'guardian';

    if (!targetStudentId) {
      const linkResp = await fetch(`${supabaseUrl}/rest/v1/parent_student_links?parent_account_id=eq.${encodeURIComponent(parent.id)}&select=student_id,relationship&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Accept': 'application/json'
        }
      });
      if (linkResp.ok) {
        const linkData = await linkResp.json().catch(() => []);
        if (linkData && linkData.length > 0) {
          targetStudentId = linkData[0].student_id;
          relationship = linkData[0].relationship || relationship;
        }
      }
    }

    if (!targetStudentId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Siswa terpilih tidak ditemukan untuk akun wali ini.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Invoke V3.3 RPC create_parent_invitation
    const rpcRes = await invokeCreateParentInvitation(supabaseUrl, serviceRoleKey, {
      tenantId: targetTenantId,
      actorUid: staffUid,
      parentEmail: targetEmail,
      targetStudentId: targetStudentId,
      relationship: relationship,
      expiryDays: 7
    });

    const rawInvitationToken = rpcRes?.raw_invitation_token;
    if (!rawInvitationToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'RPC create_parent_invitation gagal mengembalikan token undangan.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const nowIso = new Date().toISOString();
    const appUrl = env.APP_URL || 'https://chuvator.pages.dev';
    const claimUrl = `${appUrl.replace(/\/$/, '')}/portal/claim-invitation?token=${encodeURIComponent(rawInvitationToken)}`;

    const parentName = parent.full_name || 'Bapak/Ibu';
    const message = generateWhatsAppMessage({
      parentName,
      tenantName,
      actionLink: claimUrl
    });

    const whatsappUrl = buildWhatsAppUrl(phoneCheck.normalized, message);

    return new Response(
      JSON.stringify({
        success: true,
        status: isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND',
        message: 'Tautan undangan WhatsApp berhasil diperbarui. Silakan bagikan.',
        claimUrl,
        whatsappUrl,
        phone: phoneCheck.normalized,
        data: {
          parentId: parent.id,
          parentName: parent.full_name,
          email: targetEmail,
          phone: phoneCheck.normalized,
          tenantName,
          claimUrl,
          message,
          whatsappUrl,
          rawInvitationToken,
          isConfirmed,
          generatedAt: nowIso
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('WhatsApp invitation error:', err.message || err);
    return new Response(
      JSON.stringify({ success: false, message: `Terjadi kesalahan internal: ${err.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}
