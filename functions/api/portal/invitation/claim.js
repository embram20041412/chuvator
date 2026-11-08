/**
 * Cloudflare Pages Function: POST /api/portal/invitation/claim
 * CHUVATOR Parent Portal V3.3 - Invitation Claim & Continuation Ticket Handler.
 */

import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders, verifyCsrf } from '../_auth_v2.js';

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

  // Tolerant CSRF verification: verify only if Origin or Referer is supplied
  const hasOriginOrReferer = request.headers.get('Origin') || request.headers.get('Referer');
  if (hasOriginOrReferer && !verifyCsrf(request, env)) {
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
    // Accept token under various payload aliases
    const rawToken = (
      body?.token ||
      body?.invitationToken ||
      body?.raw_invitation_token ||
      body?.rawInvitationToken ||
      body?.invitation_token ||
      ''
    ).trim();

    // Accept password under various payload aliases
    const newPassword = (
      body?.password ||
      body?.newPassword ||
      body?.new_password ||
      ''
    ).trim();

    const explicitAuthUid = body?.authUid || body?.auth_uid || null;

    if (!rawToken) {
      return new Response(
        JSON.stringify({
          success: false,
          is_valid: false,
          isValid: false,
          error: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.',
          message: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Konfigurasi server tidak lengkap.' }),
        { status: 500, headers: securityHeaders }
      );
    }

    // 1. Hash raw invitation token using SHA-256 (including 'inv_' prefix)
    const hashedToken = await hashToken(rawToken);

    // 2. Query table 'parent_invitations' directly using serviceKey to bypass RLS
    const queryUrl = `${supabaseUrl}/rest/v1/parent_invitations?invitation_token_hash=eq.${hashedToken}&select=id,tenant_id,student_id,parent_account_id,status,expires_at,parent_accounts(id,email,auth_uid,status)`;
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
      const errText = await resp.text().catch(() => '');
      throw new Error(`Database query failed (${resp.status}): ${errText}`);
    }

    const results = await resp.json().catch(() => []);
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

    // Email masking
    const rawEmail = (invitation.parent_accounts?.email || invitation.email || '').trim();
    const emailParts = rawEmail.split('@');
    const maskedEmail = emailParts.length === 2 
      ? (emailParts[0].length > 2 
          ? `${emailParts[0][0]}***${emailParts[0][emailParts[0].length - 1]}@${emailParts[1]}` 
          : `${emailParts[0].substring(0, 1)}***@${emailParts[1]}`)
      : '***@***.com';

    // Retrieve tenant name
    let tenantName = 'Chua Sport Academy';
    if (invitation.tenant_id) {
      try {
        const tResp = await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${encodeURIComponent(invitation.tenant_id)}&select=name`, {
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
      invite_role: 'guardian',
      expires_at: invitation.expires_at,

      // Format alias ekstra
      invitationId: invitation.id,
      invitationStatus: invitation.status,
      invitation_id: invitation.id,
      invitation_status: invitation.status
    };

    // If neither password nor explicitAuthUid is submitted, return invitation info
    if (!newPassword && !explicitAuthUid) {
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

    // Password length validation
    if (newPassword && newPassword.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Kata sandi minimal harus 6 karakter.',
          message: 'Kata sandi minimal harus 6 karakter.' 
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    const targetEmail = rawEmail.toLowerCase().trim();
    if (!targetEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email wali murid tidak ditemukan pada data undangan.',
          message: 'Email wali murid tidak ditemukan pada data undangan.'
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    // 3. Supabase Auth User Confirmation & Creation (using Admin Client / Service Role)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let confirmedAuthUid = explicitAuthUid || invitation.parent_accounts?.auth_uid || null;
    let authUserConfirmed = false;

    // Step 3a: If confirmedAuthUid exists, verify and update password + email_confirm: true
    if (confirmedAuthUid) {
      try {
        const updatePayload = { email_confirm: true };
        if (newPassword) updatePayload.password = newPassword;

        const { data: updatedData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
          confirmedAuthUid,
          updatePayload
        );

        if (!updateErr && updatedData?.user) {
          authUserConfirmed = true;
        } else {
          console.warn('[Claim] updateUserById failed, will search or recreate:', updateErr?.message);
          confirmedAuthUid = null;
        }
      } catch (err) {
        console.warn('[Claim] updateUserById exception:', err.message);
        confirmedAuthUid = null;
      }
    }

    // Step 3b: If not confirmed yet, attempt to find user by email in Auth
    if (!authUserConfirmed) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existingUser = listData?.users?.find(
          u => u.email && u.email.toLowerCase() === targetEmail
        );

        if (existingUser?.id) {
          confirmedAuthUid = existingUser.id;
          const updatePayload = { email_confirm: true };
          if (newPassword) updatePayload.password = newPassword;

          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
            confirmedAuthUid,
            updatePayload
          );
          if (!updErr) {
            authUserConfirmed = true;
          }
        }
      } catch (err) {
        console.warn('[Claim] listUsers search exception:', err.message);
      }
    }

    // Step 3c: If still not existing, create new user with email_confirm: true
    if (!authUserConfirmed) {
      try {
        const createPayload = {
          email: targetEmail,
          email_confirm: true,
          user_metadata: {
            role: 'parent',
            tenantId: invitation.tenant_id
          }
        };
        if (newPassword) {
          createPayload.password = newPassword;
        }

        const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser(createPayload);

        if (!createErr && createdData?.user) {
          confirmedAuthUid = createdData.user.id;
          authUserConfirmed = true;
        } else if (createErr) {
          console.warn('[Claim] createUser error:', createErr.message);
          // If already registered, re-list to extract ID
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const match = listData?.users?.find(u => u.email && u.email.toLowerCase() === targetEmail);
          if (match?.id) {
            confirmedAuthUid = match.id;
            const updatePayload = { email_confirm: true };
            if (newPassword) updatePayload.password = newPassword;
            await supabaseAdmin.auth.admin.updateUserById(confirmedAuthUid, updatePayload);
            authUserConfirmed = true;
          }
        }
      } catch (err) {
        console.warn('[Claim] createUser exception:', err.message);
      }
    }

    if (!confirmedAuthUid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Gagal mengonfirmasi akun autentikasi pengguna.',
          message: 'Gagal mengonfirmasi akun autentikasi pengguna.' 
        }),
        { status: 500, headers: securityHeaders }
      );
    }

    // Step 3d: Synchronize auth_uid with parent_accounts so RPC check passes:
    // v_parent.auth_uid IS NOT DISTINCT FROM p_auth_uid
    if (invitation.parent_account_id) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/parent_accounts?id=eq.${encodeURIComponent(invitation.parent_account_id)}`, {
          method: 'PATCH',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ 
            auth_uid: confirmedAuthUid,
            status: invitation.parent_accounts?.status === 'suspended' ? 'suspended' : 'active'
          })
        });
      } catch (patchErr) {
        console.warn('[Claim] Failed to synchronize parent_accounts.auth_uid:', patchErr);
      }
    }

    // 4. Eksekusi RPC create_parent_continuation_ticket via REST API (Fungsi ini sekarang melakukan segalanya)
    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/create_parent_continuation_ticket`;
    const rpcResp = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        p_raw_invitation_token: rawToken,
        p_tenant_id: invitation.tenant_id,
        p_auth_uid: confirmedAuthUid
      })
    });

    if (!rpcResp.ok) {
      const errText = await rpcResp.text();
      throw new Error(`Gagal memproses aktivasi di database: ${errText}`);
    }

    let claimRes = await rpcResp.json();
    if (Array.isArray(claimRes) && claimRes.length > 0) {
      claimRes = claimRes[0];
    }
    if (claimRes && !claimRes.ticket_token && claimRes.raw_ticket_token) {
      claimRes.ticket_token = claimRes.raw_ticket_token;
    }

    if (!claimRes || !claimRes.ticket_token) {
      throw new Error('Gagal mendapatkan tiket kelanjutan dari database.');
    }

    // 5. Kembalikan respons sukses
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun wali murid berhasil diaktifkan!',
        tenantId: invitation.tenant_id,
        parentAccountId: invitation.parent_account_id,
        email: targetEmail,
        authUid: confirmedAuthUid,
        data: {
          ...responseData,
          claimed: true,
          ticket_token: claimRes.ticket_token
        }
      }),
      { status: 200, headers: securityHeaders }
    );

  } catch (err) {
    console.error('[Claim Error]:', err.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Terjadi kesalahan sistem saat memproses aktivasi akun.'
      }),
      { status: 500, headers: securityHeaders }
    );
  }
}
