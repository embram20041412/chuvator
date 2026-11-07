/**
 * Cloudflare Pages Function: POST /api/tenant/parents & GET /api/tenant/parents
 * Parent Account Management & WhatsApp-Only Invitation (V2.6.11 Audit Hotfix).
 * Creates Auth user via generateLink without sending email, enforces mandatory WhatsApp phone,
 * validates action link, fail-closed tenant lookup, tracks persistent status, and enforces HMAC KK.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession, normalizeKK, computeHMAC } from '../_auth_staff.js';
import {
  validateAndNormalizeWhatsAppNumber,
  generateWhatsAppMessage,
  buildWhatsAppUrl,
  isValidSupabaseActionLink,
  validateSupabaseActionLink,
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
      let manualSentAt = null;
      let latestGeneratedAt = null;

      let kvData = null;
      if (kvBinding) {
        try {
          const rawStatus = await kvBinding.get(`v2_invitation_status:${p.id}`);
          if (rawStatus) {
            kvData = JSON.parse(rawStatus);
          }
        } catch (_) {}
      }

      let metaHasInvitationInfo = false;

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
              const meta = authUser.user_metadata || {};

              // Primary persistent source: Supabase Auth user_metadata
              if (meta.invitation_status) {
                metaHasInvitationInfo = true;
                latestGeneratedAt = meta.invitation_generated_at || null;

                if (meta.invitation_status === 'SENT_MANUALLY') {
                  manualSentAt = meta.invitation_sent_at || true;
                } else if (meta.invitation_status === 'READY_TO_SEND') {
                  // Explicitly READY_TO_SEND in primary source; NEVER beaten by stale KV SENT_MANUALLY!
                  manualSentAt = null;
                }
              }

              // Fallback to auth-level invitation timestamps if metadata doesn't have generatedAt
              if (!latestGeneratedAt) {
                latestGeneratedAt = authUser.invited_at || authUser.confirmation_sent_at || null;
              }
            }
          }
        } catch (_) {}
      }

      // KV is strictly a secondary fallback if user_metadata does not contain invitation info or Auth fetch failed
      if (!metaHasInvitationInfo && kvData) {
        if (kvData.status === 'SENT_MANUALLY') {
          manualSentAt = kvData.sentAt || true;
        } else if (kvData.status === 'READY_TO_SEND') {
          manualSentAt = null;
        }
        if (!latestGeneratedAt && kvData.generatedAt) {
          latestGeneratedAt = kvData.generatedAt;
        }
      }

      // Timestamp consistency enforcement:
      // If invitation was generated AFTER it was marked sent, the manual sent status is superseded/obsolete
      if (manualSentAt && latestGeneratedAt && typeof manualSentAt === 'string' && typeof latestGeneratedAt === 'string') {
        const genTime = new Date(latestGeneratedAt).getTime();
        const sentTime = new Date(manualSentAt).getTime();
        if (!isNaN(genTime) && !isNaN(sentTime) && genTime > sentTime) {
          manualSentAt = null;
        }
      }

      // Determine clear invitation status (invitationCreatedAt strictly uses latestGeneratedAt, NEVER p.created_at)
      const invitationStatus = determineInvitationStatus({
        hasAuthUser: !!p.auth_uid,
        isConfirmed,
        manualSentAt,
        invitationCreatedAt: latestGeneratedAt
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

    const { role, tenantId: staffTenantId, uid: staffUid } = authResult.user;

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

    // Mandatory WhatsApp phone validation (Backend independent validation)
    const phoneCheck = validateAndNormalizeWhatsAppNumber(phone);
    if (!phoneCheck.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'INVALID_PHONE_NUMBER', 
          message: phoneCheck.error || 'Nomor WhatsApp wajib diisi dengan format yang valid.' 
        }),
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
          message: 'Satu atau lebih siswa tidak ditemukan dalam sistem.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Tenant Isolation Check across all selected students
    const targetTenantId = (role === 'superadmin') ? foundStudents[0].tenant_id : staffTenantId;

    if (!targetTenantId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Siswa tidak memiliki tenant yang valid.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    for (const student of foundStudents) {
      if (!student.tenant_id) {
        return new Response(
          JSON.stringify({ success: false, message: `Siswa '${student.name}' belum memiliki data tenant_id.` }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (student.tenant_id !== targetTenantId) {
        return new Response(
          JSON.stringify({ success: false, message: `Siswa '${student.name}' berada di tenant yang berbeda.` }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (student.kk_hmac !== kkHmac) {
        return new Response(
          JSON.stringify({ success: false, message: `Verifikasi nomor KK gagal untuk siswa '${student.name}'.` }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // 6.5 Fail-Closed Tenant Name Lookup (BEFORE generating Auth user)
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

    // 7. Check Duplicate Parent Email within the Target Tenant
    const parentCheckUrl = `${supabaseUrl}/rest/v1/parent_accounts?email=eq.${encodeURIComponent(normalizedEmail)}&tenant_id=eq.${encodeURIComponent(targetTenantId)}&select=id`;
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
          message: 'Gagal memeriksa duplikasi email wali murid.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let existingParents;
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
    const nowIso = new Date().toISOString();
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
            tenantId: targetTenantId,
            invitation_status: 'READY_TO_SEND',
            invitation_generated_at: nowIso,
            invitation_generated_by: staffUid
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

    // Strict Action Link Validation (HTTPS, Supabase origin, /auth/v1/verify, type: invite, redirect_to)
    const linkValidation = validateSupabaseActionLink(actionLink, { supabaseUrl, expectedType: 'invite', appUrl });
    if (!linkValidation.valid) {
      // Clean up Auth user immediately
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
      }).catch(() => null);

      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_ACTION_LINK',
          reason: linkValidation.reason,
          message: 'Tautan aktivasi yang dihasilkan tidak valid atau tidak memenuhi standar keamanan.'
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
      phone: phoneCheck.normalized,
      created_at: nowIso
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
    const message = generateWhatsAppMessage({
      parentName: name,
      tenantName,
      actionLink
    });

    const whatsappUrl = buildWhatsAppUrl(phoneCheck.normalized, message);

    // Record initial READY_TO_SEND status in KV cache (non-blocking fallback)
    const kvBinding = env.PORTAL_RATELIMIT_KV || env.PORTAL_SESSIONS_KV;
    if (kvBinding) {
      try {
        await kvBinding.put(
          `v2_invitation_status:${parentId}`,
          JSON.stringify({
            status: 'READY_TO_SEND',
            generatedAt: nowIso,
            generatedBy: staffUid
          }),
          { expirationTtl: 86400 * 7 }
        );
      } catch (_) {
        // KV is only a cache/fallback. Failure to write to KV cache must not fail account creation
        // or trigger cleanup of the newly created account.
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun wali murid berhasil dibuat. Silakan kirim undangan melalui WhatsApp.',
        actionLink,
        whatsappUrl,
        phone: phoneCheck.normalized,
        data: {
          parentId,
          authUid,
          email: normalizedEmail,
          phone: phoneCheck.normalized,
          rawPhone: phone,
          tenantName,
          actionLink,
          message,
          whatsappUrl,
          status: 'READY_TO_SEND',
          generatedAt: nowIso
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
