/**
 * Cloudflare Pages Function: /api/portal/profile
 * Edge-safe student profile endpoint for Parent Portal V2.
 * Retrieves student profile with JOIN to academy_classes and coaches.
 */

import { validatePortalV2Session } from './_auth_v2.js';

export async function onRequest(context) {
  const { request, env = {} } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Portal-CSRF'
      }
    });
  }

  try {
    let authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      try {
        const v2Session = await validatePortalV2Session(context);
        if (v2Session?.valid && v2Session?.session?.accessToken) {
          authHeader = `Bearer ${v2Session.session.accessToken}`;
        }
      } catch (sessionErr) {
        console.warn('[profile.js] Session check fallback:', sessionErr.message);
      }
    }

    if (!authHeader) {
      const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
      if (anonKey) {
        authHeader = `Bearer ${anonKey}`;
      } else {
        return new Response(JSON.stringify({ error: 'Unauthorized: Sesi tidak valid' }), { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');

    if (!studentId) {
      return new Response(JSON.stringify({ error: 'Parameter studentId wajib diisi' }), { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co';
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

    // Kueri JOIN untuk mengambil profil siswa, data kelas, dan data pelatih (foto & nama)
    const queryUrl = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&select=*,academy_classes(id,class_name,coach_id,coach_name,coaches(id,name,photo_url))`;

    const dbResponse = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': authHeader
      }
    });

    if (!dbResponse.ok) {
      const err = await dbResponse.text();
      throw new Error(`Gagal dari Supabase: ${err}`);
    }

    const data = await dbResponse.json();
    
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'Data siswa tidak ditemukan / RLS memblokir akses' }), { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const student = data[0];
    
    // Flatten data pelatih agar UI React mudah membacanya
    if (student.academy_classes) {
      const cls = student.academy_classes;
      // Ekstrak nama dan foto pelatih dari relasi JOIN
      student.coach_name = cls.coaches?.name || cls.coach_name || null;
      student.coach_photo_url = cls.coaches?.photo_url || null;
      student.coachName = student.coach_name;
      student.coachPhotoUrl = student.coach_photo_url;
      student.class_name = cls.class_name || student.class_name;
      student.className = student.class_name;
    }

    student.photoUrl = student.photo_url || student.photoUrl || null;
    student.studentName = student.student_name || student.name || student.studentName || '';

    return new Response(JSON.stringify({ success: true, data: student, student }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
