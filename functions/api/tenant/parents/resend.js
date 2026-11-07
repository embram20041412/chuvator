/**
 * Cloudflare Pages Function: POST /api/tenant/parents/resend
 * Invitation Recovery & Resend for existing parent accounts with strict separation
 * between unconfirmed (invite) and confirmed (recovery) users.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession } from '../_auth_staff.js';

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

    // 1. Fetch actual Supabase Auth user to check confirmation status
    let isConfirmed = false;
    if (authUid) {
      const authUserResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${authUid}`, {
        method: 'GET',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      });
      if (authUserResp.ok) {
        const authUser = await authUserResp.json().catch(() => null);
        if (authUser) {
          isConfirmed = !!(authUser.email_confirmed_at || authUser.confirmed_at);
        }
      }
    }

    const appUrl = env.APP_URL || 'https://chuvator.pages.dev';
    const redirectUrl = `${appUrl.replace(/\/$/, '')}/portal/accept-invitation`;

    let actionResp;
    let successMessage;

    if (!isConfirmed) {
      // Unconfirmed user -> Generate invite link / resend invitation
      actionResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'invite',
          email: targetEmail,
          options: {
            redirectTo: redirectUrl
          }
        })
      });
      successMessage = 'Undangan aktivasi berhasil dikirim ulang ke wali murid.';
    } else {
      // Confirmed user -> Password recovery
      actionResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'recovery',
          email: targetEmail,
          options: {
            redirectTo: redirectUrl
          }
        })
      });
      successMessage = 'Email pemulihan password berhasil dikirim ke wali murid.';
    }

    if (!actionResp.ok) {
      const errData = await actionResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'RECOVERY_OR_INVITE_FAILED', 
          message: `Gagal mengirim email: ${errData.msg || errData.message || 'Error unknown'}` 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('Resend invitation error:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }), { status: 500, headers: corsHeaders });
  }
}
