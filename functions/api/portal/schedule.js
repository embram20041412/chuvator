/**
 * Cloudflare Pages Function: /api/portal/schedule
 * Edge-safe schedule and attendance endpoint for Parent Portal V2 (FASE 5.4).
 * Strict Session V2, Anti-IDOR, CSRF verification & Supabase RPC portal_get_student_dashboard integration.
 */

import { validatePortalV2Session, verifyCsrf, getCorsHeaders } from './_auth_v2.js';

export async function onRequest(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  // 1. Tangani Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // 2. Strict CSRF Verification for POST
    if (request.method === 'POST') {
      const csrfHeader = request.headers.get('X-Portal-CSRF');
      if (!verifyCsrf(request, env, csrfHeader)) {
        return new Response(
          JSON.stringify({ success: false, error: 'CSRF token atau origin tidak valid' }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // 3. Strict Parent Portal V2 Session Validation
    const sessionResult = await validatePortalV2Session(context);

    if (
      !sessionResult ||
      !sessionResult.valid ||
      !sessionResult.session ||
      !sessionResult.session.accessToken
    ) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sesi tidak valid atau telah kedaluwarsa' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;
    const { accessToken } = session;
    const childrenSummary = Array.isArray(session.childrenSummary) ? session.childrenSummary : [];
    const accessibleTenants = Array.isArray(session.accessibleTenants) ? session.accessibleTenants : [];

    // Parse Body / SearchParams for requested student & tenant
    let rawStudentId = '';
    let rawTenantId = '';

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      rawStudentId = body.studentId || body.student_id || '';
      rawTenantId = body.tenantId || body.tenant_id || '';
    } else {
      const url = new URL(request.url);
      rawStudentId = url.searchParams.get('studentId') || url.searchParams.get('student_id') || '';
      rawTenantId = url.searchParams.get('tenantId') || url.searchParams.get('tenant_id') || '';
    }

    // Default to first child if not specified
    const firstChild = childrenSummary[0] || {};
    const studentId = (rawStudentId || firstChild.studentId || firstChild.id || '').toLowerCase();

    // 4. Anti-IDOR: Verify student belongs to authenticated parent
    const matchingChildren = childrenSummary.filter(
      c => String(c.studentId || c.id || '').toLowerCase() === studentId
    );

    if (matchingChildren.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Akses terhadap data siswa ini ditolak' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const matchedChild = matchingChildren[0];
    const childTenantId = matchedChild.tenantId || matchedChild.tenant_id || rawTenantId || firstChild.tenantId || '';

    // 5. Tenant Isolation Validation
    if (!childTenantId || !accessibleTenants.includes(childTenantId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Akses lintas tenant tidak diizinkan' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 6. Call Supabase RPC portal_get_student_dashboard with Validated Access Token
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

    let rpcData = null;
    try {
      const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/portal_get_student_dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          p_student_id: studentId,
          p_tenant_id: childTenantId
        })
      });

      if (rpcResp.ok) {
        rpcData = await rpcResp.json().catch(() => null);
      } else {
        const errText = await rpcResp.text().catch(() => '');
        console.warn(`[schedule.js] RPC portal_get_student_dashboard HTTP ${rpcResp.status}: ${errText}`);
      }
    } catch (rpcErr) {
      console.warn('[schedule.js] RPC fetch exception:', rpcErr.message);
    }

    const student = rpcData?.student || {};
    const tenant = rpcData?.tenant || {};
    const upcoming_sessions = Array.isArray(rpcData?.upcoming_sessions) ? rpcData.upcoming_sessions : [];
    const schedules = Array.isArray(rpcData?.schedules) ? rpcData.schedules : [];
    const attendances = Array.isArray(rpcData?.attendance)
      ? rpcData.attendance
      : (Array.isArray(rpcData?.attendances) ? rpcData.attendances : []);

    const totalSessions = attendances.length;
    let hadirCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alphaCount = 0;

    attendances.forEach(a => {
      const s = String(a.status || '').toLowerCase();
      if (s.includes('hadir') || s.includes('present')) hadirCount++;
      else if (s.includes('izin') || s.includes('permit')) izinCount++;
      else if (s.includes('sakit') || s.includes('sick')) sakitCount++;
      else if (s.includes('alpha') || s.includes('alpa')) alphaCount++;
      else hadirCount++;
    });

    const attendanceRate = totalSessions > 0
      ? `${Math.round((hadirCount / totalSessions) * 100)}%`
      : '100%';

    const finalResponse = {
      success: true,
      message: 'Data jadwal & presensi berhasil dimuat',
      student,
      tenant,
      classInfo: {
        id: student.class_id || matchedChild.classId || '',
        className: student.class_name || matchedChild.className || 'Kelas Reguler',
        sport: student.sport_category || student.sport || 'Badminton',
        coachName: student.coach_name || matchedChild.coachName || null
      },
      schedules,
      upcoming_sessions,
      attendances,
      stats: {
        totalSessions,
        hadir: hadirCount,
        izin: izinCount,
        sakit: sakitCount,
        alpha: alphaCount,
        attendanceRate
      }
    };

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[schedule.js] Unhandled exception:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Terjadi kesalahan internal pada server' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
