/**
 * Cloudflare Pages Function: POST /api/tenant/parents/resend
 * Parent Portal WhatsApp-Only Invitation & Recovery (V2.6.11 Migration).
 * Generates official Supabase Admin action link without email dispatch,
 * formats dynamic WhatsApp invitation template with verified tenant identity,
 * constructs safe wa.me URL, and tracks manual delivery confirmation.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession } from '../_auth_staff.js';
import {
  normalizeWhatsAppNumber,
  generateWhatsAppMessage,
  buildWhatsAppUrl,
  isValidSupabaseActionLink,
  getVerifiedTenantName
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

      // Persist in KV
      if (kvBinding) {
        await kvBinding.put(
          `v2_invitation_status:${parent.id}`,
          JSON.stringify({ status: 'SENT_MANUALLY', sentAt: nowIso, sentBy: staffUid }),
          { expirationTtl: 86400 * 7 }
        );
      }

      // Persist in Supabase Auth user_metadata
      await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${authUid}`, {
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
      }).catch(() => null);

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
        options: {
          redirectTo: redirectUrl
        }
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

    if (!isValidSupabaseActionLink(actionLink, supabaseUrl)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'GENERATE_LINK_FAILED', 
          message: 'Tautan aksi tidak valid atau tidak berasal dari project Supabase yang dikonfigurasi.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Fetch verified tenant name from database
    const tenantName = await getVerifiedTenantName(supabaseUrl, serviceRoleKey, targetTenantId);

    // Build dynamic message and safe wa.me URL
    const parentName = parent.full_name || 'Bapak/Ibu';
    const message = generateWhatsAppMessage({
      parentName,
      tenantName,
      actionLink
    });

    const normalizedPhone = normalizeWhatsAppNumber(parent.phone);
    const whatsappUrl = buildWhatsAppUrl(parent.phone, message);

    // Reset status to READY_TO_SEND upon link regeneration
    const nowIso = new Date().toISOString();
    if (kvBinding) {
      await kvBinding.put(
        `v2_invitation_status:${parent.id}`,
        JSON.stringify({ status: 'READY_TO_SEND', generatedAt: nowIso, generatedBy: staffUid }),
        { expirationTtl: 86400 * 7 }
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
        whatsappUrl,
        phone: normalizedPhone,
        data: {
          parentId: parent.id,
          parentName: parent.full_name,
          email: targetEmail,
          phone: normalizedPhone,
          rawPhone: parent.phone || '',
          tenantName,
          actionLink,
          message,
          whatsappUrl,
          isConfirmed,
          type: linkType
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
