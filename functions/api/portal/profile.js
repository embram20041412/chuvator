/**
 * Cloudflare Pages Function: /api/portal/profile
 * Parent Portal V2 Fail-Closed Student Profile Endpoint (FASE 5.4).
 * Connects directly to database RPC `public.portal_get_student_dashboard`.
 */

import { validatePortalV2Session, getCorsHeaders } from './_auth_v2.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequest(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  // 1. Tangani CORS Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // 2. Validasi Parameter studentId
    const url = new URL(request.url);
    const rawStudentId = (url.searchParams.get('studentId') || url.searchParams.get('student_id') || '').trim();

    if (!rawStudentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parameter studentId wajib diisi' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!UUID_REGEX.test(rawStudentId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Format studentId tidak valid' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const studentId = rawStudentId.toLowerCase();

    // 3. Autentikasi Sesi Parent Portal V2 (Strict Fail-Closed)
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

    // 4. Anti-IDOR: Validasi Kepemilikan Siswa & Deteksi Duplikasi
    const matchingChildren = childrenSummary.filter(
      c => String(c.studentId || c.id || '').toLowerCase() === studentId
    );

    if (matchingChildren.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Akses terhadap data siswa ini ditolak' }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (matchingChildren.length > 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ambiguitas data siswa: otorisasi ditolak' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const matchedChild = matchingChildren[0];

    // 5. Isolasi Tenant
    const childTenantId = matchedChild.tenantId || matchedChild.tenant_id || '';
    if (!childTenantId || !accessibleTenants.includes(childTenantId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Akses lintas tenant tidak diizinkan' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 6. Pengambilan Data Profil via RPC portal_get_student_dashboard
    let rpcData = null;
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
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
            p_tenant_id: childTenantId || null
          })
        });

        if (rpcResp.ok) {
          rpcData = await rpcResp.json().catch(() => null);
        } else {
          const errText = await rpcResp.text().catch(() => '');
          console.warn(`[profile.js] RPC portal_get_student_dashboard HTTP ${rpcResp.status}: ${errText}`);
        }
      } catch (rpcErr) {
        console.warn('[profile.js] RPC fetch exception:', rpcErr.message);
      }
    }

    const rpcStudent = rpcData?.student || {};
    const rpcTenant = rpcData?.tenant || {};

    const studentData = {
      id: matchedChild.studentId,
      studentId: matchedChild.studentId,
      student_id: matchedChild.studentId,
      student_name: rpcStudent.student_name || rpcStudent.name || matchedChild.studentName || '',
      studentName: rpcStudent.student_name || rpcStudent.name || matchedChild.studentName || '',
      class_name: rpcStudent.class_name || matchedChild.className || 'Kelas Reguler',
      className: rpcStudent.class_name || matchedChild.className || 'Kelas Reguler',
      coach_name: rpcStudent.coach_name || matchedChild.coach_name || matchedChild.coachName || null,
      coachName: rpcStudent.coach_name || matchedChild.coach_name || matchedChild.coachName || null,
      coach_photo_url: rpcStudent.coach_photo_url || null,
      coachPhotoUrl: rpcStudent.coach_photo_url || null,
      photo_url: rpcStudent.photo_url || matchedChild.photo_url || matchedChild.photoUrl || null,
      photoUrl: rpcStudent.photo_url || matchedChild.photo_url || matchedChild.photoUrl || null,
      sport_category: rpcStudent.sport_category || rpcStudent.sport || 'Badminton',
      sportCategory: rpcStudent.sport_category || rpcStudent.sport || 'Badminton',
      birth_date: rpcStudent.birth_date || null,
      birthDate: rpcStudent.birth_date || null,
      school_name: rpcStudent.school_name || rpcStudent.school_origin || '',
      school_origin: rpcStudent.school_name || rpcStudent.school_origin || '',
      schoolOrigin: rpcStudent.school_name || rpcStudent.school_origin || '',
      tenant_id: childTenantId,
      tenantId: childTenantId,
      tenant_name: rpcStudent.tenant_name || rpcTenant.name || 'Sport Arena',
      academy_name: rpcStudent.academy_name || matchedChild.academyName || 'Sport Academy',
      academyName: rpcStudent.academy_name || matchedChild.academyName || 'Sport Academy'
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: studentData,
        student: studentData,
        tenant: rpcTenant,
        evaluations: Array.isArray(rpcData?.evaluations) ? rpcData.evaluations : [],
        attendance: Array.isArray(rpcData?.attendance) ? rpcData.attendance : []
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[profile.js] Unhandled exception:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Terjadi kesalahan internal pada server' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestOptions = onRequest;
