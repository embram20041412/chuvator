/**
 * Cloudflare Pages Function: DELETE /api/tenant/parents?id=...
 * Safe deletion / cancellation of parent account with Supabase Auth deletion first,
 * followed by atomic database deletion via PostgreSQL RPC.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession } from '../_auth_staff.js';
import { invokeRevokeParentInvitation } from './_invitation_helper.js';

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

    const { role, tenantId: staffTenantId, uid: staffUid } = authResult.user;
    if (!['superadmin', 'owner', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat menghapus/mencabut akun wali murid.' }), { status: 403, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const parentId = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    if (!parentId) {
      return new Response(JSON.stringify({ success: false, message: 'Parent ID wajib disertakan.' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, code: 'SUPABASE_CONFIG_MISSING', message: 'Konfigurasi server tidak lengkap.' }), { status: 500, headers: corsHeaders });
    }

    // Handle invitation revocation without deleting parent account or active student links
    if (action === 'revoke') {
      const reason = url.searchParams.get('reason') || 'Dicabut oleh pengelola';
      const revokeRes = await invokeRevokeParentInvitation(supabaseUrl, serviceRoleKey, {
        tenantId: staffTenantId,
        actorUid: staffUid,
        invitationIdOrToken: parentId,
        reason
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'REVOKED',
          message: 'Undangan berhasil dicabut tanpa menghapus akun wali murid.',
          data: revokeRes
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 1. Verify parent exists and belongs to tenant (Tenant Isolation)
    let parentQuery = `${supabaseUrl}/rest/v1/parent_accounts?id=eq.${encodeURIComponent(parentId)}&select=id,tenant_id,auth_uid`;
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
    const targetTenantId = parent.tenant_id;

    // 2. Delete Supabase Auth user FIRST. If Auth fails (other than 404), do not execute database RPC.
    if (authUid) {
      const authDelResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUid}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      });

      if (!authDelResp.ok && authDelResp.status !== 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            code: 'AUTH_DELETE_FAILED', 
            message: 'Gagal menghapus akun pengguna Auth. Profil aplikasi dipertahankan secara aman untuk retry idempotent.' 
          }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 3. Call atomic PostgreSQL RPC `parent_portal_atomic_delete`
    const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/parent_portal_atomic_delete`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        p_tenant_id: targetTenantId,
        p_parent_id: parentId
      })
    });

    if (!rpcResp.ok) {
      const rpcErr = await rpcResp.text().catch(() => '');
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'RPC_DELETE_FAILED', 
          message: 'Gagal mengeksekusi penghapusan database atomik.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const rpcResult = await rpcResp.json().catch(() => null);
    const resultItem = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

    if (!resultItem || !resultItem.success || Number(resultItem.deleted_parent_count) !== 1) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'ATOMIC_DELETE_FAILED', 
          message: 'Gagal menghapus data secara atomik di database.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun wali murid berhasil dihapus secara atomik dan aman.'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('Delete parent account error.');
    return new Response(JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }), { status: 500, headers: corsHeaders });
  }
}
