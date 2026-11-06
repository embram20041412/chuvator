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

    // 3. Get KK from query params
    const url = new URL(request.url);
    const rawKK = url.searchParams.get('kk');
    const normalizedKK = normalizeKK(rawKK);

    if (!normalizedKK) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nomor KK harus 16 digit angka.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Compute HMAC
    const secret = env.KK_HMAC_SECRET;
    if (!secret) {
      return new Response(
        JSON.stringify({ success: false, message: 'Konfigurasi keamanan (KK_HMAC_SECRET) belum tersedia.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const kkHmac = await computeHMAC(normalizedKK, secret);

    // 5. Query Supabase
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    let queryUrl = `${supabaseUrl}/rest/v1/students?kk_hmac=eq.${encodeURIComponent(kkHmac)}&select=id,name,birth_date,kk_last4`;
    
    // Filter by tenant unless superadmin
    if (role !== 'superadmin') {
      queryUrl += `&tenant_id=eq.${encodeURIComponent(tenantId)}`;
    }

    const resp = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': request.headers.get('Authorization'),
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Supabase query failed:', resp.status, errText);
      return new Response(
        JSON.stringify({ success: false, message: 'Gagal mengambil data siswa dari database.' }),
        { status: resp.status, headers: corsHeaders }
      );
    }

    const students = await resp.json();

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
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
