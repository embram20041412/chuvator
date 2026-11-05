/**
 * Cloudflare Pages Function: /api/admin/verify_payment (FASE 4B - REMEDIATED)
 * Admin/Owner Tenant payment verification endpoint.
 * STRICT SERVER-SIDE RBAC: Permitted ONLY for authenticated 'owner' and 'admin' roles
 * derived strictly from server-verified session / database records ('users_staff' & 'tenants').
 * Rejects 'manager', 'kasir', 'staff', 'parent', and cross-tenant attempts with HTTP 403.
 * Invokes PostgreSQL PL/pgSQL RPC 'admin_verify_spp_payment' for atomic Financial Core verification & double-entry ledger journal.
 */

import { getCorsHeaders, verifyCsrf, getCleanSupabaseUrl, getSupabaseAnonKey, supabaseGetUser } from '../portal/_auth_v2.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. CSRF & Origin Validation
    if (!verifyCsrf(request, env)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Permintaan ditolak. Origin tidak diizinkan atau CSRF token tidak valid.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 2. Parse Request Parameters (Action & SppPaymentId)
    const body = await request.json().catch(() => ({}));
    const sppPaymentId = String(body.sppPaymentId || body.paymentId || '').trim();
    const action = String(body.action || '').toUpperCase(); // 'VERIFY' or 'REJECT'
    const notes = String(body.notes || body.reason || '').trim();
    const requestTenantId = String(body.tenantId || '').trim();

    if (!sppPaymentId || !action) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter sppPaymentId dan action (VERIFY/REJECT) wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!['VERIFY', 'REJECT', 'CORRECT'].includes(action)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter action tidak valid. Harus VERIFY, REJECT, atau CORRECT.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (action === 'REJECT' && !notes) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Catatan alasan penolakan wajib diisi saat menolak pembayaran.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. SERVER-SIDE STAFF AUTHENTICATION & RBAC (P0-1 Fix)
    // Extract Access Token from Authorization Header or Cookie
    const authHeader = request.headers.get('Authorization') || '';
    let accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    // Test environment headers fallback (ONLY for non-production unit testing)
    const isProduction = env.ENVIRONMENT === 'production';
    let verifiedStaffUid = null;
    let verifiedStaffRole = null;
    let verifiedTenantId = null;

    const supabaseUrl = getCleanSupabaseUrl(env);
    const anonKey = getSupabaseAnonKey(env);

    if (accessToken && supabaseUrl && anonKey) {
      // Authenticate User Token via Supabase Auth
      const userRes = await supabaseGetUser(supabaseUrl, anonKey, accessToken);
      if (!userRes.success || !userRes.user) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Sesi staff tidak valid atau telah kedaluwarsa. Silakan login kembali.'
          }),
          { status: 401, headers: corsHeaders }
        );
      }

      verifiedStaffUid = userRes.user.id;

      // Query server-side role & tenant from database table 'users_staff'
      const staffUrl = `${supabaseUrl}/rest/v1/users_staff?uid=eq.${encodeURIComponent(verifiedStaffUid)}&status=eq.active&select=role,tenant_id,name,email`;
      const staffResp = await fetch(staffUrl, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }).catch(() => null);

      if (staffResp && staffResp.ok) {
        const staffData = await staffResp.json().catch(() => []);
        if (Array.isArray(staffData) && staffData.length > 0) {
          verifiedStaffRole = String(staffData[0].role || '').toLowerCase();
          verifiedTenantId = String(staffData[0].tenant_id || '').trim();
        }
      }

      // Check if user is owner in 'tenants' table
      if (!verifiedStaffRole || !verifiedTenantId) {
        const tenantUrl = `${supabaseUrl}/rest/v1/tenants?owner_uid=eq.${encodeURIComponent(verifiedStaffUid)}&select=id,name`;
        const tenantResp = await fetch(tenantUrl, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }).catch(() => null);

        if (tenantResp && tenantResp.ok) {
          const tenantData = await tenantResp.json().catch(() => []);
          if (Array.isArray(tenantData) && tenantData.length > 0) {
            verifiedStaffRole = 'owner';
            verifiedTenantId = String(tenantData[0].id || '').trim();
          }
        }
      }
    } else if (!isProduction) {
      // Test mode mock authorization check (using explicit test headers, NOT body parameters)
      const testRole = request.headers.get('x-test-staff-role');
      const testUid = request.headers.get('x-test-staff-uid');
      const testTenant = request.headers.get('x-test-tenant-id');

      if (testRole && testUid && testTenant) {
        verifiedStaffRole = String(testRole).toLowerCase();
        verifiedStaffUid = String(testUid);
        verifiedTenantId = String(testTenant);
      }
    }

    // Fail-Closed Unauthenticated Check
    if (!verifiedStaffUid || !verifiedStaffRole || !verifiedTenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Autentikasi staff gagal. Identitas atau wewenang staff tidak terverifikasi di server.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // STRICT ROLE RBAC CHECK: Owner & Admin ONLY
    if (!['owner', 'admin'].includes(verifiedStaffRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Akses ditolak. Peran '${verifiedStaffRole}' tidak memiliki kewenangan verifikasi pembayaran.`
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // STRICT TENANT ISOLATION CHECK: Match server-verified tenant with request target if provided
    if (requestTenantId && requestTenantId.toLowerCase() !== verifiedTenantId.toLowerCase()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Identitas tenant staff tidak cocok dengan target pembayaran.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 4. INVOKE POSTGRESQL PL/PGSQL RPC 'admin_verify_spp_payment' (P1-1 Fix)
    if (supabaseUrl && anonKey && accessToken) {
      const rpcUrl = `${supabaseUrl}/rest/v1/rpc/admin_verify_spp_payment`;
      const rpcPayload = {
        p_tenant_id: verifiedTenantId,
        p_spp_payment_id: sppPaymentId,
        p_action: action,
        p_notes: notes || null
      };

      const rpcResp = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(rpcPayload)
      });

      if (!rpcResp.ok) {
        const errText = await rpcResp.text().catch(() => '');
        console.error('RPC admin_verify_spp_payment failed with status', rpcResp.status, errText);

        let errorMsg = 'Gagal mengeksekusi verifikasi pembayaran pada database Financial Core.';
        if (errText.includes('ALREADY_VERIFIED')) {
          errorMsg = 'Pembayaran ini telah diverifikasi sebelumnya (mencegah verifikasi ganda).';
        } else if (errText.includes('REJECTION_REASON_REQUIRED')) {
          errorMsg = 'Catatan alasan penolakan wajib diisi saat menolak pembayaran.';
        } else if (errText.includes('403 REJECTED')) {
          errorMsg = 'Peran Anda tidak diizinkan mengeksekusi verifikasi pada Financial Core.';
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: errorMsg,
            status: rpcResp.status
          }),
          { status: rpcResp.status >= 400 && rpcResp.status < 500 ? rpcResp.status : 500, headers: corsHeaders }
        );
      }

      const rpcResult = await rpcResp.json().catch(() => ({}));

      return new Response(
        JSON.stringify({
          success: true,
          message: action === 'VERIFY' ? 'Pembayaran berhasil disetujui (LUNAS) pada Financial Core.' : 'Pembayaran berhasil ditolak.',
          result: rpcResult
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Non-production test environment fallback response
    const newVerificationStatus = action === 'VERIFY' ? 'verified' : 'rejected';
    const newPaymentStatus = action === 'VERIFY' ? 'LUNAS' : 'BELUM_LUNAS';

    return new Response(
      JSON.stringify({
        success: true,
        message: action === 'VERIFY' ? 'Pembayaran berhasil disetujui (LUNAS).' : 'Pembayaran berhasil ditolak.',
        result: {
          sppPaymentId,
          tenantId: verifiedTenantId,
          action,
          verificationStatus: newVerificationStatus,
          status: newPaymentStatus,
          notes: notes || null,
          verifiedBy: verifiedStaffUid,
          verifiedRole: verifiedStaffRole,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Verify payment error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal saat memproses verifikasi pembayaran.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
