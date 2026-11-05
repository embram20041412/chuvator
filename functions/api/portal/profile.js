/**
 * Cloudflare Pages Function: /api/portal/profile
 * Edge-safe student profile endpoint for Parent Portal V2.
 * Retrieves student profile with JOIN to academy_classes and coaches.
 */

import { validatePortalV2Session } from './_auth_v2.js';

export async function onRequest(context) {
  const { request, env = {} } = context;

  // 1. Tangani CORS Preflight
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

  try {
    let authHeader = request.headers.get('Authorization');

    // Cek session cookie v2 jika Authorization header tidak dikirim langsung oleh browser
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

    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co').replace(/\/+$/, '');
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

    if (!authHeader) {
      authHeader = `Bearer ${anonKey}`;
    }

    // 2. Ambil studentId dari parameter URL atau body
    const url = new URL(request.url);
    let studentId = url.searchParams.get('studentId') || url.searchParams.get('student_id');

    if (!studentId && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      studentId = body.studentId || body.student_id;
    }

    if (!studentId) {
      return new Response(JSON.stringify({ success: false, error: 'Parameter studentId wajib diisi' }), { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        } 
      });
    }

    // 3. Kueri Supabase: Ambil data siswa dan relasi JOIN ke academy_classes dan coaches
    // Ini akan mengambil foto profil siswa (photo_url) sekaligus nama pelatihnya.
    const queryUrl = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&select=*,academy_classes(id,class_name,coach_id,coach_name,coaches(id,name,photo_url))`;

    const dbResponse = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': authHeader
      }
    });

    if (!dbResponse.ok) {
      const err = await dbResponse.text().catch(() => '');
      throw new Error(`Gagal mengambil data profil dari Supabase: ${err}`);
    }

    const data = await dbResponse.json().catch(() => []);
    
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Data siswa tidak ditemukan atau akses ditolak RLS' }), { 
        status: 404, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        } 
      });
    }

    const raw = data[0];
    const academyClass = raw.academy_classes || {};
    const coach = academyClass.coaches || {};
    const coachName = coach.name || academyClass.coach_name || raw.coach_name || raw.coachName || null;
    const className = academyClass.class_name || raw.class_name || raw.className || 'Kelas Reguler';
    const photoUrl = raw.photo_url || raw.photoUrl || null;

    const studentObj = {
      ...raw,
      id: raw.id,
      student_id: raw.id,
      studentName: raw.student_name || raw.name || '',
      student_name: raw.student_name || raw.name || '',
      className,
      class_name: className,
      coachName,
      coach_name: coachName,
      photoUrl,
      photo_url: photoUrl,
      sportCategory: raw.sport_category || raw.sport || 'Badminton',
      sport_category: raw.sport_category || raw.sport || 'Badminton',
      birthDate: raw.birth_date || null,
      birth_date: raw.birth_date || null
    };

    // 4. Kembalikan data sukses ke frontend (menyertakan data dan student)
    return new Response(JSON.stringify({ 
      success: true, 
      data: studentObj,
      student: studentObj 
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, 
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
