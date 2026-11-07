/**
 * Cloudflare Pages Function: GET /api/tenant/parents/students?kk=...
 * Search students by KK (HMAC) within the authenticated tenant.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateStaffSession, normalizeKK, computeHMAC } from '../_auth_staff.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
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

    const { role, tenantId } = authResult.user;

    // 2. RBAC: Owner/Admin only
    if (!['superadmin', 'owner', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Hanya Owner/Admin yang dapat mencari data wali murid.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Initialize Supabase Admin Config (Fail-Closed)
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const secret = env.KK_HMAC_SECRET;

    if (!supabaseUrl || !serviceRoleKey || !secret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'SUPABASE_CONFIG_MISSING', 
          message: 'Konfigurasi server (Supabase/Security) tidak lengkap.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Get and Normalize KK
    const url = new URL(request.url);
    const rawKK = url.searchParams.get('kk');
    const normalizedKKVal = normalizeKK(rawKK);

    if (!normalizedKKVal) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nomor KK harus 16 digit angka.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 5. Compute HMAC
    const kkHmac = await computeHMAC(normalizedKKVal, secret);
    const kkLast4 = normalizedKKVal.slice(-4);

    // 6. Query Supabase using Service Role (Bypass RLS for verification if needed, or stick to tenant isolation)
    let queryUrl = `${supabaseUrl}/rest/v1/students?kk_hmac=eq.${encodeURIComponent(kkHmac)}&select=id,name,birth_date,kk_last4,tenant_id`;
    if (role !== 'superadmin') {
      queryUrl += `&tenant_id=eq.${encodeURIComponent(tenantId)}`;
    }

    const resp = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'STUDENT_VERIFICATION_FAILED', 
          message: 'Gagal mencari data siswa di database.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const students = await resp.json().catch(() => []);

    return new Response(
      JSON.stringify({
        success: true,
        data: students.map(s => ({
          studentId: s.id,
          name: s.name,
          birthDate: s.birth_date,
          kkLast4: s.kk_last4
        }))
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('Search students by KK error:', err.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada server.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

