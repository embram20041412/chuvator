/**
 * Cloudflare Pages Function: POST /api/tenant/parents/resend
 * Email Action Link Delivery via Resend with strict URL validation, error sanitization,
 * and fail-closed Auth user verification.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession } from '../_auth_staff.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidSupabaseActionLink(link, supabaseUrl) {
  if (!link || typeof link !== 'string') return false;
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:') return false;
    const baseClean = supabaseUrl.replace(/\/$/, '');
    const urlOrigin = url.origin;
    const baseOrigin = new URL(baseClean).origin;
    return urlOrigin === baseOrigin;
  } catch {
    return false;
  }
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const authResult = await validateStaffSession(context);
    if (!authResult.valid) {
      return new Response(JSON.stringify({ success: false, message: authResult.message }), { status: 401, headers: corsHeaders });
    }

    const { role, tenantId: staffTenantId } = authResult.user;
    if (!['superadmin', 'owner', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat mengirim ulang undangan.' }), { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const { parentId, email } = body;

    if (!parentId && !email) {
      return new Response(JSON.stringify({ success: false, message: 'Parent ID atau email wajib disertakan.' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const isProduction = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, code: 'SUPABASE_CONFIG_MISSING', message: 'Konfigurasi server tidak lengkap.' }), { status: 500, headers: corsHeaders });
    }

    // 1. Strict Resend API Key check (Reject if only SendGrid or other provider keys are provided)
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      if (env.SENDGRID_API_KEY || env.EMAIL_PROVIDER_API_KEY) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            code: 'EMAIL_PROVIDER_NOT_CONFIGURED', 
            message: 'Konfigurasi provider tidak didukung. Hanya Resend yang didukung untuk pengiriman email ini.' 
          }),
          { status: 500, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'EMAIL_PROVIDER_NOT_CONFIGURED', 
          message: 'RESEND_API_KEY belum dikonfigurasi di server.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Validate EMAIL_FROM format
    const emailFrom = env.EMAIL_FROM;
    if (!emailFrom || !isValidEmailFormat(emailFrom.includes('<') ? emailFrom.split('<')[1].replace('>', '') : emailFrom)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'INVALID_EMAIL_FROM', 
          message: 'Konfigurasi EMAIL_FROM tidak valid atau belum diset.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Fail-closed rate limiting check
    const kvBinding = env.PORTAL_RATELIMIT_KV || env.PORTAL_SESSIONS_KV;
    if (isProduction && !kvBinding) {
      console.error('FAIL_CLOSED: PORTAL_RATELIMIT_KV / PORTAL_SESSIONS_KV missing in production for resend.');
      return new Response(JSON.stringify({ success: false, message: 'Konfigurasi rate limit server wajib tersedia di production.' }), { status: 500, headers: corsHeaders });
    }

    let queryUrl = `${supabaseUrl}/rest/v1/parent_accounts?select=id,tenant_id,email,auth_uid`;
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
      return new Response(JSON.stringify({ success: false, message: 'Gagal memverifikasi akun wali murid.' }), { status: 500, headers: corsHeaders });
    }

    const parents = await parentResp.json().catch(() => []);
    if (!Array.isArray(parents) || parents.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'Akun wali murid tidak ditemukan atau di luar tenant Anda.' }), { status: 404, headers: corsHeaders });
    }

    const parent = parents[0];
    const targetEmail = parent.email;
    const authUid = parent.auth_uid;

    if (kvBinding) {
      const rateKey = `v2_ratelimit:resend:${parent.id}`;
      const countStr = await kvBinding.get(rateKey);
      const count = countStr ? Number(countStr) : 0;
      if (count >= 3) {
        return new Response(JSON.stringify({ success: false, message: 'Terlalu banyak permintaan pengiriman ulang. Silakan tunggu beberapa menit.' }), { status: 429, headers: corsHeaders });
      }
      await kvBinding.put(rateKey, String(count + 1), { expirationTtl: 300 });
    }

    // 3. Fail-closed Auth user verification
    let isConfirmed = false;
    if (authUid) {
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
      isConfirmed = !!(authUser.email_confirmed_at || authUser.confirmed_at);
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'AUTH_UID_MISSING', 
          message: 'Auth UID tidak ditemukan pada akun wali murid.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const appUrl = env.APP_URL || 'https://chuvator.pages.dev';
    const redirectUrl = `${appUrl.replace(/\/$/, '')}/portal/accept-invitation`;
    const linkType = isConfirmed ? 'recovery' : 'invite';

    // 4. Generate action link from Supabase Auth Admin API
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

    // 5. Send email via Resend with exact escaped actionLink in HTML
    const escapedActionLink = escapeHtml(actionLink);
    const emailHtml = `<p>Halo,</p><p>Silakan klik tautan berikut untuk ${linkType === 'invite' ? 'mengaktivasi akun Portal Wali Murid Anda' : 'memulihkan kata sandi akun Anda'}:</p><p><a href="${escapedActionLink}">Aktivasi / Pemulihan Akun</a></p>`;

    let emailSent = false;

    try {
      const resendSendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [targetEmail],
          subject: linkType === 'invite' ? 'Undangan Portal Wali Murid CHUVATOR' : 'Pemulihan Kata Sandi Portal Wali Murid CHUVATOR',
          html: emailHtml
        })
      });

      if (resendSendResp.ok) {
        emailSent = true;
      }
    } catch (sendErr) {
      // Sanitized: no raw exception message leaked
    }

    if (!emailSent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'EMAIL_SEND_FAILED', 
          message: 'Gagal mengirim email melalui Resend.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const successMessage = linkType === 'invite' 
      ? 'Undangan aktivasi berhasil dikirim ke email wali murid.' 
      : 'Email pemulihan password berhasil dikirim ke email wali murid.';

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('Resend invitation error.');
    return new Response(JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }), { status: 500, headers: corsHeaders });
  }
}
