/**
 * Cloudflare Pages Function: POST /api/tenant/parents
 * Creates a Parent account, invites them via Supabase Auth, and links students.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession, normalizeKK, computeHMAC } from '../_auth_staff.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Authenticate Staff
    const authResult = await validateStaffSession(context);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ success: false, message: authResult.message }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { role, tenantId: staffTenantId } = authResult.user;

    // 2. RBAC: Owner/Admin only (Superadmin allowed as per logic)
    const allowedRoles = ['superadmin', 'owner', 'admin'];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat membuat akun wali murid.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Initialize Supabase Admin Config (Fail-Closed)
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const hmacSecret = env.KK_HMAC_SECRET;

    if (!supabaseUrl || !serviceRoleKey || !hmacSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'SUPABASE_CONFIG_MISSING', 
          message: 'Konfigurasi server (Supabase/Security) tidak lengkap.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Parse and Validate Input
    const body = await request.json().catch(() => ({}));
    const { name, email, phone, kk, studentIds } = body;

    if (!name || !email || !kk || !Array.isArray(studentIds) || studentIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Field name, email, kk, dan studentIds wajib diisi.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedKKVal = normalizeKK(kk);
    if (!normalizedKKVal) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nomor KK harus 16 digit angka.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 5. Security: Compute HMAC
    const kkHmac = await computeHMAC(normalizedKKVal, hmacSecret);

    // 6. Validation: Check if all students match Tenant and KK (Strict Verification)
    // Using service role for backend verification
    const studentCheckUrl = `${supabaseUrl}/rest/v1/students?id=in.(${studentIds.map(id => `"${id}"`).join(',')})&select=id,name,tenant_id,kk_hmac`;
    const studentCheckResp = await fetch(studentCheckUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });

    if (!studentCheckResp.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'STUDENT_VERIFICATION_FAILED', 
          message: 'Gagal memverifikasi data siswa ke database.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const foundStudents = await studentCheckResp.json().catch(() => []);
    if (!Array.isArray(foundStudents) || foundStudents.length !== studentIds.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'STUDENT_VERIFICATION_FAILED', 
          message: 'Sebagian atau seluruh data siswa yang dipilih tidak ditemukan atau tidak dapat diverifikasi.' 
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    for (const s of foundStudents) {
      // Tenant Isolation
      if (role !== 'superadmin' && s.tenant_id && s.tenant_id !== staffTenantId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            code: 'STUDENT_TENANT_MISMATCH', 
            message: `Siswa '${s.name || s.id}' tidak berasal dari tenant yang sama dengan Anda.` 
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      // HMAC Verification
      if (s.kk_hmac !== kkHmac) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            code: 'HMAC_MISMATCH', 
            message: `Nomor KK tidak cocok dengan data siswa '${s.name || s.id}'.` 
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // 7. Check if Parent account record already exists
    const parentCheckUrl = `${supabaseUrl}/rest/v1/parent_accounts?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`;
    const parentCheckResp = await fetch(parentCheckUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (parentCheckResp.ok) {
      const existingParents = await parentCheckResp.json().catch(() => []);
      if (existingParents.length > 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Email wali murid sudah terdaftar di sistem.' }),
          { status: 409, headers: corsHeaders }
        );
      }
    }

    // 8. Invite User via Supabase Auth Admin
    const inviteUrl = `${supabaseUrl}/auth/v1/admin/users/invite`;
    const inviteResp = await fetch(inviteUrl, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        data: {
          name: name,
          role: 'parent',
          tenantId: staffTenantId || 'global'
        }
      })
    });

    if (!inviteResp.ok) {
      const errData = await inviteResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'AUTH_INVITATION_FAILED', 
          message: `Gagal mengirim undangan email: ${errData.msg || errData.message || 'Error unknown'}` 
        }),
        { status: inviteResp.status, headers: corsHeaders }
      );
    }

    const inviteData = await inviteResp.json();
    const authUid = inviteData.id;
    if (!authUid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'AUTH_INVITATION_FAILED', 
          message: 'Gagal mendapatkan Auth UID dari Supabase.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 9. Database Insertion (parent_accounts & parent_student_links)
    const targetTenantId = staffTenantId || 'global';
    
    // Create parent account record
    const parentPayload = {
      tenant_id: targetTenantId,
      auth_uid: authUid,
      email: normalizedEmail,
      name: name,
      phone: phone || null,
      created_at: new Date().toISOString()
    };

    const parentInsertResp = await fetch(`${supabaseUrl}/rest/v1/parent_accounts`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(parentPayload)
    });

    if (!parentInsertResp.ok) {
      // COMPENSATION: Delete Auth User if DB record fails
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      }).catch(() => null);

      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'PARENT_INSERT_FAILED', 
          message: 'Gagal menyimpan data profil wali murid ke database.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const newParents = await parentInsertResp.json().catch(() => []);
    const parentId = (newParents.length > 0) ? newParents[0].id : null;

    if (!parentId) {
       return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'PARENT_INSERT_FAILED', 
          message: 'Gagal mengambil ID wali murid yang baru dibuat.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Create Student Links
    const linkPayloads = studentIds.map(sid => ({
      tenant_id: targetTenantId,
      parent_account_id: parentId,
      student_id: sid
    }));

    const linkResp = await fetch(`${supabaseUrl}/rest/v1/parent_student_links`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(linkPayloads)
    });

    if (!linkResp.ok) {
      // COMPENSATION: Cleanup Parent Account and Auth User if Links fail
      // This ensures we don't have orphan parent accounts without students
      await fetch(`${supabaseUrl}/rest/v1/parent_accounts?id=eq.${parentId}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      }).catch(() => null);

      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      }).catch(() => null);

      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'STUDENT_LINK_INSERT_FAILED', 
          message: 'Gagal menghubungkan siswa ke akun wali. Pendaftaran dibatalkan untuk menjaga integritas data.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun wali murid berhasil dibuat, terverifikasi, dan undangan telah dikirim.',
        data: {
          parentId,
          authUid,
          email: normalizedEmail
        }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (err) {
    console.error('Create parent error:', err.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

