/**
 * Cloudflare Pages Function: /api/portal/profile
 * Parent Portal V2 Fail-Closed Student Profile Endpoint.
 * 
 * Security Specifications:
 * - Strict Parent Portal V2 session validation via validatePortalV2Session.
 * - Dynamic CORS with origin allowlisting and credentials support via getCorsHeaders.
 * - Anti-IDOR: Validates studentId ownership against server-verified childrenSummary with duplicate detection.
 * - Tenant Isolation: Validates child's tenantId against session accessibleTenants.
 * - Zero fallback to anonKey for authentication.
 * - No unrestricted multi-table joins to academy_classes or coaches (eliminates 42501).
 * - Generic error masking on internal exceptions.
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
    const childTenantId = matchedChild.tenantId || '';
    if (!childTenantId || !accessibleTenants.includes(childTenantId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Akses lintas tenant tidak diizinkan' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 6. Pengambilan Data Profil
    // matchedChild dari server-side RPC parent_get_children adalah sumber kebenaran utama.
    let flatData = null;
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    // Optional single-table query ke 'students' (hanya kolom data pribadi, TANPA JOIN)
    if (supabaseUrl && anonKey && accessToken) {
      try {
        const queryUrl = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&tenant_id=eq.${encodeURIComponent(childTenantId)}&select=id,name,student_name,birth_date,photo_url,school_name,school_origin,sport_category`;
        const dbResponse = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (dbResponse.ok) {
          const list = await dbResponse.json().catch(() => []);
          if (Array.isArray(list) && list.length > 0) {
            flatData = list[0];
          }
        }
      } catch (dbErr) {
        // Fallback aman: kegagalan query pelengkap tidak menggagalkan profil yang sudah terverifikasi di sesi
        console.warn('[profile.js] Flat student query fallback note:', dbErr.message);
      }
    }

    // 7. Konstruksi Data Respons (Kompatibel Penuh dengan PortalDashboard.jsx)
    const studentData = {
      id: matchedChild.studentId,
      studentId: matchedChild.studentId,
      student_id: matchedChild.studentId,
      student_name: flatData?.student_name || flatData?.name || matchedChild.studentName || '',
      studentName: flatData?.student_name || flatData?.name || matchedChild.studentName || '',
      class_name: matchedChild.className || 'Kelas Reguler',
      className: matchedChild.className || 'Kelas Reguler',
      coach_name: matchedChild.coach_name || matchedChild.coachName || null,
      coachName: matchedChild.coach_name || matchedChild.coachName || null,
      coach_photo_url: null,
      coachPhotoUrl: null,
      photo_url: flatData?.photo_url || matchedChild.photo_url || matchedChild.photoUrl || null,
      photoUrl: flatData?.photo_url || matchedChild.photo_url || matchedChild.photoUrl || null,
      sport_category: flatData?.sport_category || 'Badminton',
      sportCategory: flatData?.sport_category || 'Badminton',
      birth_date: flatData?.birth_date || null,
      birthDate: flatData?.birth_date || null,
      school_name: flatData?.school_name || flatData?.school_origin || '',
      school_origin: flatData?.school_name || flatData?.school_origin || '',
      schoolOrigin: flatData?.school_name || flatData?.school_origin || '',
      tenant_id: childTenantId,
      tenantId: childTenantId,
      academy_name: matchedChild.academyName || 'Sport Academy',
      academyName: matchedChild.academyName || 'Sport Academy'
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: studentData,
        student: studentData
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    // Masking error internal, tidak membocorkan detail server/database
    console.error('[profile.js] Unhandled exception:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Terjadi kesalahan internal pada server' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestOptions = onRequest;
