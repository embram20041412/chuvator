/**
 * Cloudflare Pages Function: POST /api/tenant/parents & GET /api/tenant/parents
 * Parent Account Management & WhatsApp-Only Invitation (V2.6.11 Migration).
 * Creates Auth user via generateLink without sending email, enforces HMAC KK matching,
 * isolates tenants, and provides WhatsApp-ready dynamic invitation links.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession, normalizeKK, computeHMAC } from '../_auth_staff.js';
import {
  normalizeWhatsAppNumber,
  generateWhatsAppMessage,
  buildWhatsAppUrl,
  getVerifiedTenantName,
  determineInvitationStatus
} from './_invitation_helper.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const authResult = await validateStaffSession(context);
    if (!authResult.valid) {
      return new Response(JSON.stringify({ success: false, message: authResult.message }), { status: 401, headers: corsHeaders });
    }

    const { role, tenantId: staffTenantId } = authResult.user;
    if (!['superadmin', 'owner', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ success: false, message: 'Akses ditolak.' }), { status: 403, headers: corsHeaders });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, message: 'Konfigurasi server tidak lengkap.' }), { status: 500, headers: corsHeaders });
    }

    let queryUrl = `${supabaseUrl}/rest/v1/parent_accounts?select=id,tenant_id,auth_uid,full_name,email,phone,created_at`;
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
      return new Response(JSON.stringify({ success: false, message: 'Gagal mengambil data akun wali murid.' }), { status: 500, headers: corsHeaders });
    }

    const parents = await parentResp.json().catch(() => []);

    const parentIds = parents.map(p => p.id);
    let linksMap = {};
    if (parentIds.length > 0) {
      const linksUrl = `${supabaseUrl}/rest/v1/parent_student_links?parent_account_id=in.(${parentIds.map(id => `"${id}"`).join(',')})&select=parent_account_id,student:students(id,name,kk_last4)`;
      const linksResp = await fetch(linksUrl, {
        method: 'GET',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Accept': 'application/json'
        }
      });
      if (linksResp.ok) {
        const linksData = await linksResp.json().catch(() => []);
        linksData.forEach(l => {
          linksMap[l.parent_account_id] = linksMap[l.parent_account_id] || [];
          linksMap[l.parent_account_id].push(l);
        });
      }
    }

    const kvBinding = env.PORTAL_RATELIMIT_KV || env.PORTAL_SESSIONS_KV;

    const enrichedParents = await Promise.all(parents.map(async (p) => {
      let isConfirmed = false;
      let isExpired = false;
      let manualSentAt = null;

      // Check KV for manual sent status
      if (kvBinding) {
        try {
          const rawStatus = await kvBinding.get(`v2_invitation_status:${p.id}`);
          if (rawStatus) {
            const parsed = JSON.parse(rawStatus);
            if (parsed.status === 'SENT_MANUALLY') {
              manualSentAt = parsed.sentAt;
            }
          }
        } catch (_) {}
      }

      if (p.auth_uid) {
        try {
          const authUserResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${p.auth_uid}`, {
            method: 'GET',
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`
            }
          });
          if (authUserResp.ok) {
            const authUser = await authUserResp.json();
            if (authUser && authUser.id) {
              isConfirmed = !!(authUser.email_confirmed_at || authUser.confirmed_at);

              // Check user_metadata for SENT_MANUALLY if not found in KV
              if (!manualSentAt && authUser.user_metadata?.invitation_status === 'SENT_MANUALLY') {
                manualSentAt = authUser.user_metadata.invitation_sent_at || true;
              }

              // Check invitation expiration (TTL 24h without confirmation)
              const inviteTime = authUser.invited_at || authUser.confirmation_sent_at || p.created_at;
              if (inviteTime && !isConfirmed) {
                const t = new Date(inviteTime).getTime();
                if (!isNaN(t) && (Date.now() - t) > 86400 * 1000) {
                  isExpired = true;
                }
              }
            }
          }
        } catch (_) {}
      }

      const invitationStatus = determineInvitationStatus({
        hasAuthUser: !!p.auth_uid,
        isConfirmed,
        isExpired,
        manualSentAt,
        invitationCreatedAt: p.created_at
      });

      return {
        ...p,
        name: p.full_name,
        status: isConfirmed ? 'active' : (invitationStatus === 'EXPIRED' ? 'expired' : 'pending'),
        invitationStatus,
        links: linksMap[p.id] || []
      };
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedParents
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('List parents error:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Terjadi kesalahan internal.' }), { status: 500, headers: corsHeaders });
  }
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

    // 2. RBAC: Owner/Admin/Superadmin only
    const allowedRoles = ['superadmin', 'owner', 'admin'];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat membuat akun wali murid.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Ensure staff tenant is available for non-superadmins
    if (role !== 'superadmin' && !staffTenantId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data tenant Anda tidak ditemukan. Akses ditolak.' }),
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
    const { name, email, phone, kk, studentIds, relationship } = body;

    if (!name || !email || !kk || !Array.isArray(studentIds) || studentIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Field name, email, kk, dan studentIds wajib diisi.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const validRelationships = ['father', 'mother', 'guardian', 'other'];
    if (relationship && !validRelationships.includes(relationship)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nilai relationship tidak valid. Gunakan: father, mother, guardian, atau other.' }),
        { status: 400, headers: corsHeaders }
      );
    }
    const finalRelationship = relationship || 'guardian';

    // Validate studentIds (Type check, Duplicates, UUID or demo prefix)
    if (new Set(studentIds).size !== studentIds.length) {
      return new Response(
        JSON.stringify({ success: false, message: 'Daftar studentIds berisi duplikat.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isProduction = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';

    for (const sid of studentIds) {
      if (typeof sid !== 'string') {
        return new Response(
          JSON.stringify({ success: false, message: 'Setiap ID siswa harus bertipe string.' }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (sid.startsWith('student-demo-')) {
        if (isProduction) {
          return new Response(
            JSON.stringify({ success: false, message: 'ID siswa demo dilarang di lingkungan produksi.' }),
            { status: 400, headers: corsHeaders }
          );
        }
      } else if (!uuidRegex.test(sid)) {
        return new Response(
          JSON.stringify({ success: false, message: `ID Siswa '${sid}' bukan UUID yang valid.` }),
          { status: 400, headers: corsHeaders }
        );
      }
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

    // Determine targetTenantId (Hardened for consistency)
    let targetTenantId = staffTenantId || 'global';
    if (role === 'superadmin' && foundStudents.length > 0) {
      targetTenantId = foundStudents[0].tenant_id || 'global';
    }

    for (const s of foundStudents) {
      const studentTenant = s.tenant_id || 'global';

      if (role !== 'superadmin') {
        if (studentTenant !== staffTenantId) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              code: 'STUDENT_TENANT_MISMATCH', 
              message: `Siswa '${s.name || s.id}' tidak berasal dari tenant yang sama dengan Anda.` 
            }),
            { status: 403, headers: corsHeaders }
          );
        }
      } else {
        if (studentTenant !== targetTenantId) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              code: 'STUDENT_TENANT_MISMATCH', 
              message: `Seluruh siswa yang dipilih harus berasal dari tenant yang sama (${targetTenantId}).` 
            }),
            { status: 400, headers: corsHeaders }
          );
        }
      }
      
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

    // 7. Check if Parent account record already exists (Tenant-Scoped)
    let parentCheckUrl = `${supabaseUrl}/rest/v1/parent_accounts?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`;
    if (role !== 'superadmin') {
      parentCheckUrl += `&tenant_id=eq.${encodeURIComponent(targetTenantId)}`;
    }
    
    const parentCheckResp = await fetch(parentCheckUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (!parentCheckResp.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'PARENT_VERIFICATION_FAILED', 
          message: 'Gagal memverifikasi status email wali murid.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let existingParents = [];
    try {
      existingParents = await parentCheckResp.json();
    } catch (e) {
      existingParents = null;
    }

    if (!Array.isArray(existingParents)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'PARENT_VERIFICATION_FAILED', 
          message: 'Data pemeriksaan email tidak valid (format salah).' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (existingParents.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email wali murid sudah terdaftar pada tenant ini.' }),
        { status: 409, headers: corsHeaders }
      );
    }

    // 8. Generate Auth User & Activation Link via Supabase Auth Admin generate_link
    // (NO automatic email dispatched!)
    const appUrl = env.APP_URL || 'https://chuvator.pages.dev';
    const redirectUrl = `${appUrl.replace(/\/$/, '')}/portal/accept-invitation`;

    const linkResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'invite',
        email: normalizedEmail,
        options: {
          redirectTo: redirectUrl,
          data: {
            name: name,
            role: 'parent',
            tenantId: targetTenantId
          }
        }
      })
    });

    if (!linkResp.ok) {
      const errData = await linkResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'AUTH_INVITATION_FAILED', 
          message: `Gagal membuat akun autentikasi: ${errData.msg || errData.message || 'Error unknown'}` 
        }),
        { status: linkResp.status, headers: corsHeaders }
      );
    }

    const linkData = await linkResp.json().catch(() => ({}));
    const authUid = linkData.user?.id || linkData.id;
    const actionLink = linkData.properties?.action_link || linkData.action_link;

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
    const parentPayload = {
      tenant_id: targetTenantId,
      auth_uid: authUid,
      email: normalizedEmail,
      full_name: name,
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
      // Clean up Auth user on DB failure
      const cleanupAuth = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
      }).catch(() => ({ ok: false }));

      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'PARENT_INSERT_FAILED', 
          message: 'Gagal menyimpan profil wali murid. ' + (cleanupAuth.ok ? 'Sesi dibatalkan secara aman.' : 'PERINGATAN: Cleanup gagal, hubungi teknisi.')
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const newParents = await parentInsertResp.json().catch(() => []);
    const parentId = (newParents.length > 0) ? newParents[0].id : null;

    if (!parentId) {
      const cleanupAuth = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
      }).catch(() => ({ ok: false }));

      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'PARENT_INSERT_FAILED', 
          message: 'ID wali murid tidak ditemukan setelah penyimpanan. ' + (cleanupAuth.ok ? 'Sesi dibatalkan secara aman.' : 'PERINGATAN: Cleanup gagal.')
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const linkPayloads = studentIds.map(sid => ({
      tenant_id: targetTenantId,
      parent_account_id: parentId,
      student_id: sid,
      relationship: finalRelationship
    }));

    const studentLinkResp = await fetch(`${supabaseUrl}/rest/v1/parent_student_links`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(linkPayloads)
    });

    if (!studentLinkResp.ok) {
      // Full Compensation
      const cleanupParent = await fetch(`${supabaseUrl}/rest/v1/parent_accounts?id=eq.${parentId}`, {
        method: 'DELETE',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
      }).catch(() => ({ ok: false }));

      const cleanupAuth = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
      }).catch(() => ({ ok: false }));

      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'STUDENT_LINK_INSERT_FAILED', 
          message: 'Gagal menghubungkan siswa. ' + (cleanupParent.ok && cleanupAuth.ok ? 'Pendaftaran dibatalkan secara aman.' : 'PERINGATAN: Cleanup database/auth gagal.')
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 10. Generate WhatsApp Invitation message and wa.me URL
    const tenantName = await getVerifiedTenantName(supabaseUrl, serviceRoleKey, targetTenantId);
    const message = generateWhatsAppMessage({
      parentName: name,
      tenantName,
      actionLink
    });

    const normalizedPhone = normalizeWhatsAppNumber(phone);
    const whatsappUrl = buildWhatsAppUrl(phone, message);

    // Record initial READY_TO_SEND status in KV
    const kvBinding = env.PORTAL_RATELIMIT_KV || env.PORTAL_SESSIONS_KV;
    if (kvBinding) {
      await kvBinding.put(
        `v2_invitation_status:${parentId}`,
        JSON.stringify({ status: 'READY_TO_SEND', generatedAt: new Date().toISOString() }),
        { expirationTtl: 86400 * 7 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun wali murid berhasil dibuat. Silakan kirim undangan melalui WhatsApp.',
        data: {
          parentId,
          authUid,
          email: normalizedEmail,
          phone: normalizedPhone,
          rawPhone: phone || '',
          tenantName,
          actionLink,
          message,
          whatsappUrl,
          status: 'READY_TO_SEND'
        }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (err) {
    console.error('[Parent Portal] Internal error occurred.');
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
