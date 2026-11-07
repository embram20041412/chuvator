/**
 * Cloudflare Pages Function: DELETE /api/tenant/parents?id=...
 * Safe deletion / cancellation of parent account with compensation on Auth deletion failure.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession } from '../_auth_staff.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestDelete(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const authResult = await validateStaffSession(context);
    if (!authResult.valid) {
      return new Response(JSON.stringify({ success: false, message: authResult.message }), { status: 401, headers: corsHeaders });
    }

    const { role, tenantId: staffTenantId } = authResult.user;
    if (!['superadmin', 'owner', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat menghapus akun wali murid.' }), { status: 403, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const parentId = url.searchParams.get('id');

    if (!parentId) {
      return new Response(JSON.stringify({ success: false, message: 'Parent ID wajib disertakan.' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, code: 'SUPABASE_CONFIG_MISSING', message: 'Konfigurasi server tidak lengkap.' }), { status: 500, headers: corsHeaders });
    }

    // 1. Verify parent exists and belongs to tenant
    let parentQuery = `${supabaseUrl}/rest/v1/parent_accounts?id=eq.${encodeURIComponent(parentId)}&select=*`;
    if (role !== 'superadmin') {
      parentQuery += `&tenant_id=eq.${encodeURIComponent(staffTenantId)}`;
    }

    const parentResp = await fetch(parentQuery, {
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
    if (!Array.isArray(parents) || parents.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'Akun wali murid tidak ditemukan atau di luar tenant Anda.' }), { status: 404, headers: corsHeaders });
    }

    const parent = parents[0];
    const authUid = parent.auth_uid;

    // Fetch existing links for compensation snapshot
    const linksResp = await fetch(`${supabaseUrl}/rest/v1/parent_student_links?parent_account_id=eq.${encodeURIComponent(parentId)}&select=*`, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });
    const existingLinks = linksResp.ok ? await linksResp.json().catch(() => []) : [];

    // 2. Delete parent_student_links first
    const linkDelResp = await fetch(`${supabaseUrl}/rest/v1/parent_student_links?parent_account_id=eq.${encodeURIComponent(parentId)}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!linkDelResp.ok && linkDelResp.status !== 404) {
      return new Response(JSON.stringify({ success: false, code: 'LINK_DELETE_FAILED', message: 'Gagal menghapus relasi siswa wali murid.' }), { status: 500, headers: corsHeaders });
    }

    // 3. Delete parent_accounts record
    const parentDelResp = await fetch(`${supabaseUrl}/rest/v1/parent_accounts?id=eq.${encodeURIComponent(parentId)}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!parentDelResp.ok) {
      // Compensation: re-insert links if possible
      if (existingLinks.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/parent_student_links`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(existingLinks)
        }).catch(() => {});
      }
      return new Response(JSON.stringify({ success: false, code: 'PROFILE_DELETE_FAILED', message: 'Gagal menghapus profil wali murid.' }), { status: 500, headers: corsHeaders });
    }

    // 4. Delete Supabase Auth user if authUid exists
    if (authUid) {
      const authDelResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      });

      if (!authDelResp.ok && authDelResp.status !== 404) {
        // COMPENSATION: Restore parent account and student links to maintain consistency
        await fetch(`${supabaseUrl}/rest/v1/parent_accounts`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(parent)
        }).catch(() => {});

        if (existingLinks.length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/parent_student_links`, {
            method: 'POST',
            headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(existingLinks)
          }).catch(() => {});
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            code: 'AUTH_DELETE_FAILED', 
            message: 'Gagal menghapus akun pengguna Auth. Operasi dibatalkan dan data profil dipulihkan secara aman.' 
          }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun wali murid berhasil dibatalkan dan dihapus secara aman.'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('Delete parent account error:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }), { status: 500, headers: corsHeaders });
  }
}
