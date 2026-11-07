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
  buildIntermediaryClaimUrl
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
    const kvBinding = env.PORTAL_RATELIMIT_KV || env.PORTAL_SESSIONS_KV;
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

    // 6. Handle Action: confirm_sent (Manual Delivery Confirmation)
    if (action === 'confirm_sent') {
      if (isConfirmed) {
        return new Response(
          JSON.stringify({
            success: true,
            status: 'ACTIVATED',
            message: 'Akun wali murid ini telah aktif sebelumnya.'
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      const nowIso = new Date().toISOString();
      let metaSaved = false;
      let kvSaved = false;

      // 1. Primary: Persist in Supabase Auth user_metadata
      try {
        const metaResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${authUid}`, {
          method: 'PUT',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_metadata: {
              ...(authUser.user_metadata || {}),
              invitation_status: 'SENT_MANUALLY',
              invitation_sent_at: nowIso,
              invitation_sent_by: staffUid
            }
          })
        });
        metaSaved = metaResp.ok;
      } catch (_) {
        metaSaved = false;
      }

      // 2. Secondary/Cache: Persist in KV
      if (kvBinding) {
        try {
          await kvBinding.put(
            `v2_invitation_status:${parent.id}`,
            JSON.stringify({
              status: 'SENT_MANUALLY',
              sentAt: nowIso,
              sentBy: staffUid,
              generatedAt: authUser.user_metadata?.invitation_generated_at || nowIso,
              generatedBy: authUser.user_metadata?.invitation_generated_by || staffUid
            }),
            { expirationTtl: 86400 * 7 }
          );
          kvSaved = true;
        } catch (_) {
          kvSaved = false;
        }
      }

      // Fail-closed if ALL persistence mechanisms failed
      if (!metaSaved && !kvSaved) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'PERSISTENCE_FAILED',
            message: 'Gagal mencatat status pengiriman manual ke database maupun penyimpanan sesi.'
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'SENT_MANUALLY',
          message: 'Undangan berhasil dikonfirmasi telah dikirim secara manual via WhatsApp.'
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 7. Handle Action: generate / resend WhatsApp invitation link
    // Validate recipient WhatsApp phone number
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

    // Tenant Name Must Fail Closed (strictly from database)
    let tenantName;
    try {
      tenantName = await getVerifiedTenantName(supabaseUrl, serviceRoleKey, targetTenantId);
    } catch (tErr) {
      const statusCode = tErr.code === 'TENANT_NOT_FOUND' ? 404 : 500;
      return new Response(
        JSON.stringify({
          success: false,
          code: tErr.code || 'TENANT_VERIFICATION_FAILED',
          message: tErr.message || 'Gagal memverifikasi identitas tenant resmi.'
        }),
        { status: statusCode, headers: corsHeaders }
      );
    }

    const appUrl = env.APP_URL || 'https://chuvator.pages.dev';
    const redirectUrl = `${appUrl.replace(/\/$/, '')}/portal/accept-invitation`;
    const linkType = isConfirmed ? 'recovery' : 'invite';

    // Call Supabase Auth Admin generate_link (rotates token, generates action_link without sending email)
    const linkResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: linkType,
        email: targetEmail,
        redirect_to: redirectUrl
      })
    });

    if (!linkResp.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'GENERATE_LINK_FAILED', 
          message: 'Gagal menghasilkan tautan dari Supabase Auth.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const linkData = await linkResp.json().catch(() => ({}));
    const actionLink = linkData.properties?.action_link || linkData.action_link;

    // Strict action link validation (HTTPS, Supabase origin, /auth/v1/verify, type match, redirect_to match)
    const linkValidation = validateSupabaseActionLink(actionLink, { supabaseUrl, expectedType: linkType, appUrl });
    if (!linkValidation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'INVALID_ACTION_LINK', 
          reason: linkValidation.reason,
          message: 'Tautan aksi tidak valid atau tidak memenuhi standar keamanan.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 7.5 Secure Intermediary Claim: Generate 256-bit entropy token & store mapping in KV (Fail-Closed)
    if (!kvBinding) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'KV_BINDING_MISSING',
          message: 'Penyimpanan server tidak tersedia untuk tautan undangan.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const claimToken = generateClaimToken();
    const claimKey = `v2_invitation_claim:${claimToken}`;
    const claimTtlSeconds = 3600; // 1 jam (tidak melebihi masa berlaku OTP Supabase)
    const nowIso = new Date().toISOString();
    const claimExpiresAt = new Date(Date.now() + claimTtlSeconds * 1000).toISOString();

    try {
      await kvBinding.put(
        claimKey,
        JSON.stringify({
          actionLink,
          parentId: parent.id,
          tenantId: targetTenantId,
          type: linkType,
          createdAt: nowIso,
          expiresAt: claimExpiresAt
        }),
        { expirationTtl: claimTtlSeconds }
      );
    } catch (_) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'CLAIM_STORAGE_FAILED',
          message: 'Gagal menyiapkan tautan aktivasi yang aman di server.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const intermediaryUrl = buildIntermediaryClaimUrl(appUrl, claimToken);

    // Build dynamic message and safe wa.me URL using INTERMEDIARY URL (NO raw Supabase link)
    const parentName = parent.full_name || 'Bapak/Ibu';
    const message = generateWhatsAppMessage({
      parentName,
      tenantName,
      actionLink: intermediaryUrl
    });

    const whatsappUrl = buildWhatsAppUrl(phoneCheck.normalized, message);

    // Update generatedAt and RESET SENT_MANUALLY status in Supabase user_metadata & KV
    let metaUpdated = false;
    let kvUpdated = false;

    try {
      const updateMetaResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${authUid}`, {
        method: 'PUT',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_metadata: {
            ...(authUser.user_metadata || {}),
            invitation_status: 'READY_TO_SEND',
            invitation_generated_at: nowIso,
            invitation_generated_by: staffUid,
            invitation_sent_at: null,
            invitation_sent_by: null
          }
        })
      });
      metaUpdated = updateMetaResp.ok;
    } catch (_) {
      metaUpdated = false;
    }

    if (kvBinding) {
      try {
        await kvBinding.put(
          `v2_invitation_status:${parent.id}`,
          JSON.stringify({
            status: 'READY_TO_SEND',
            generatedAt: nowIso,
            generatedBy: staffUid,
            sentAt: null,
            sentBy: null
          }),
          { expirationTtl: 86400 * 7 }
        );
        kvUpdated = true;
      } catch (_) {
        kvUpdated = false;
      }
    }

    if (!metaUpdated && !kvUpdated) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'PERSISTENCE_FAILED',
          message: 'Gagal memperbarui status dan waktu pembuatan undangan.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const responseStatus = isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND';
    const successMsg = isConfirmed
      ? 'Tautan pemulihan akun berhasil dibuat. Silakan bagikan melalui WhatsApp.'
      : 'Tautan undangan aktivasi berhasil dibuat. Silakan bagikan melalui WhatsApp.';

    return new Response(
      JSON.stringify({
        success: true,
        status: responseStatus,
        message: successMsg,
        actionLink,
        claimUrl: intermediaryUrl,
        whatsappUrl,
        phone: phoneCheck.normalized,
        data: {
          parentId: parent.id,
          parentName: parent.full_name,
          email: targetEmail,
          phone: phoneCheck.normalized,
          rawPhone: parent.phone || '',
          tenantName,
          actionLink,
          claimUrl: intermediaryUrl,
          message,
          whatsappUrl,
          isConfirmed,
          type: linkType,
          generatedAt: nowIso
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('WhatsApp invitation error.');
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
