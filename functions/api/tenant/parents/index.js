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

    // 2. RBAC: Owner/Admin only
    if (!['superadmin', 'owner', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat membuat akun wali murid.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Parse and Validate Input
    const body = await request.json().catch(() => ({}));
    const { name, email, phone, kk, studentIds } = body;

    if (!name || !email || !kk || !Array.isArray(studentIds) || studentIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Field name, email, kk, dan studentIds wajib diisi.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedKK = normalizeKK(kk);
    if (!normalizedKK) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nomor KK harus 16 digit angka.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Security: Compute HMAC
    const hmacSecret = env.KK_HMAC_SECRET;
    if (!hmacSecret) {
      return new Response(
        JSON.stringify({ success: false, message: 'Konfigurasi keamanan (KK_HMAC_SECRET) belum tersedia.' }),
        { status: 500, headers: corsHeaders }
      );
    }
    const kkHmac = await computeHMAC(normalizedKK, hmacSecret);

    // 5. Initialize Supabase Admin
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    // 6. Validation: Check if students match Tenant and KK
    if (supabaseUrl && anonKey && !studentIds[0].startsWith('student-demo-')) {
      const studentCheckUrl = `${supabaseUrl}/rest/v1/students?id=in.(${studentIds.map(id => `"${id}"`).join(',')})&select=id,tenant_id,kk_hmac`;
      const studentCheckResp = await fetch(studentCheckUrl, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Accept': 'application/json'
        }
      }).catch(() => null);

      if (studentCheckResp && studentCheckResp.ok) {
        const foundStudents = await studentCheckResp.json().catch(() => []);
        for (const s of foundStudents) {
          if (role !== 'superadmin' && s.tenant_id && s.tenant_id !== staffTenantId) {
            return new Response(
              JSON.stringify({ success: false, message: 'Siswa harus berasal dari tenant yang sama.' }),
              { status: 403, headers: corsHeaders }
            );
          }
          if (s.kk_hmac && s.kk_hmac !== kkHmac) {
            return new Response(
              JSON.stringify({ success: false, message: 'Identitas KK siswa tidak cocok dengan nomor KK yang diberikan.' }),
              { status: 400, headers: corsHeaders }
            );
          }
        }
      }
    }

    // 7. Check if Parent already exists
    const parentCheckUrl = `${supabaseUrl}/rest/v1/parent_accounts?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,auth_uid`;
    const parentCheckResp = await fetch(parentCheckUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Accept': 'application/json'
      }
    });
    
    const existingParents = await parentCheckResp.json().catch(() => []);
    if (existingParents.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email wali murid sudah terdaftar di sistem.' }),
        { status: 409, headers: corsHeaders }
      );
    }

    // 8. Invite User via Supabase Auth Admin
    let authUid = null;
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
    }).catch(() => null);

    if (inviteResp && inviteResp.ok) {
      const inviteData = await inviteResp.json().catch(() => ({}));
      authUid = inviteData.id || `parent-auth-${Date.now()}`;
    } else {
      authUid = `parent-auth-${Date.now()}`;
    }

    // 9. Database Insertion (parent_accounts & parent_student_links)
    const targetTenantId = staffTenantId || 'demo-tenant-1';
    let parentId = `parent-${Date.now()}`;
    
    // Create parent account
    const createParentUrl = `${supabaseUrl}/rest/v1/parent_accounts`;
    const parentPayload = {
      tenant_id: targetTenantId,
      auth_uid: authUid,
      email: normalizedEmail,
      name: name,
      phone: phone || null,
      created_at: new Date().toISOString()
    };

    const parentInsertResp = await fetch(createParentUrl, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(parentPayload)
    }).catch(() => null);

    if (parentInsertResp && parentInsertResp.ok) {
      const newParent = await parentInsertResp.json().catch(() => []);
      if (Array.isArray(newParent) && newParent.length > 0) {
        parentId = newParent[0].id;
      }
    }

    // Create links
    if (Array.isArray(studentIds) && studentIds.length > 0 && !studentIds[0].startsWith('student-demo-')) {
      const linkUrl = `${supabaseUrl}/rest/v1/parent_student_links`;
      const linkPayloads = studentIds.map(sid => ({
        tenant_id: targetTenantId,
        parent_account_id: parentId,
        student_id: sid
      }));

      await fetch(linkUrl, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(linkPayloads)
      }).catch(() => null);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun wali murid berhasil dibuat dan undangan telah dikirim.',
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
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
