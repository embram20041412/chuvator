/**
 * Cloudflare Pages Function: /api/portal/profile
 * Edge-safe student profile endpoint for Parent Portal V2.
 * Performs joined foreign key query to academy_classes and coaches to retrieve the authentic coach name.
 * 
 * Query: ?select=*,academy_classes(class_name,coach_id,coach_name,coaches(name))
 */

import { validatePortalV2Session } from './_auth_v2.js';

export async function onRequest(context) {
  const { request, env = {} } = context;

  // Tangani Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Portal-CSRF, apikey'
      }
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

    let authHeader = request.headers.get('Authorization') || '';
    let studentId = '';

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      studentId = body.studentId || body.student_id || body.id || '';
    } else {
      const url = new URL(request.url);
      studentId = url.searchParams.get('studentId') || url.searchParams.get('student_id') || url.searchParams.get('id') || '';
    }

    if (!authHeader) {
      try {
        const v2SessionResult = await validatePortalV2Session(context);
        if (v2SessionResult && v2SessionResult.valid && v2SessionResult.session) {
          authHeader = `Bearer ${v2SessionResult.session.accessToken}`;
          if (!studentId) {
            const firstChild = v2SessionResult.session.childrenSummary?.[0];
            studentId = firstChild?.studentId || '';
          }
        }
      } catch (e) {
        console.warn('[profile.js] Session check fallback:', e.message);
      }
    }

    const effectiveAuthHeader = authHeader || `Bearer ${anonKey}`;

    if (!studentId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Parameter studentId wajib disertakan.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // 1. Kueri Supabase REST dengan JOIN ke academy_classes dan coaches
    let student = null;
    const joinedUrl = `${supabaseUrl}/rest/v1/students?id=eq.${studentId}&select=*,academy_classes(class_name,coach_id,coach_name,coaches(name))`;

    try {
      const resp = await fetch(joinedUrl, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': effectiveAuthHeader
        }
      });

      if (resp.ok) {
        const list = await resp.json().catch(() => []);
        student = list[0] || null;
      } else {
        console.warn('[profile.js] Joined query status:', resp.status);
      }
    } catch (jErr) {
      console.warn('[profile.js] Joined query error:', jErr.message);
    }

    // Fallback kueri flat jika relasi nested belum aktif di schema cache
    if (!student) {
      try {
        const flatUrl = `${supabaseUrl}/rest/v1/students?id=eq.${studentId}&select=*`;
        const flatResp = await fetch(flatUrl, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': effectiveAuthHeader
          }
        });
        if (flatResp.ok) {
          const list = await flatResp.json().catch(() => []);
          student = list[0] || null;
        }
      } catch (fErr) {
        console.warn('[profile.js] Flat query error:', fErr.message);
      }
    }

    if (!student) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Data siswa tidak ditemukan.'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Petakan nama pelatih asli secara deterministik
    const academyClass = student.academy_classes || {};
    const coach = academyClass.coaches || {};
    const coachName = coach.name || academyClass.coach_name || student.coach_name || null;
    const className = academyClass.class_name || student.class_name || student.className || 'Kelas Reguler';

    return new Response(JSON.stringify({
      success: true,
      student: {
        id: student.id,
        student_id: student.id,
        studentName: student.student_name || student.name || '',
        student_name: student.student_name || student.name || '',
        className,
        class_name: className,
        coachName,
        coach_name: coachName,
        sportCategory: student.sport_category || student.sport || 'Badminton',
        sport_category: student.sport_category || student.sport || 'Badminton',
        birthDate: student.birth_date || null,
        birth_date: student.birth_date || null,
        photoUrl: student.photo_url || null,
        photo_url: student.photo_url || null,
        schoolOrigin: student.school_name || student.school_origin || '',
        school_name: student.school_name || '',
        tenantId: student.tenant_id,
        tenant_id: student.tenant_id
      }
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[profile.js] Unhandled exception:', error.message);
    return new Response(JSON.stringify({
      success: false,
      message: 'Terjadi kesalahan internal saat memuat profil siswa.'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
