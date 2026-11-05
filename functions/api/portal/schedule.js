/**
 * Cloudflare Pages Function: /api/portal/schedule
 * Edge-safe schedule and attendance endpoint for Parent Portal V2.
 * Native Fetch API to Supabase REST with fail-safe error handling.
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
    let tenantId = 'global';

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      tenantId = body.tenantId || body.tenant_id || tenantId;
      studentId = body.studentId || body.student_id || '';
    } else {
      const url = new URL(request.url);
      tenantId = url.searchParams.get('tenantId') || url.searchParams.get('tenant_id') || tenantId;
      studentId = url.searchParams.get('studentId') || url.searchParams.get('student_id') || '';
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
          if (!tenantId || tenantId === 'global') {
            const firstChild = v2SessionResult.session.childrenSummary?.[0];
            tenantId = firstChild?.tenantId || tenantId;
          }
        }
      } catch (e) {
        console.warn('[schedule.js] Session check fallback:', e.message);
      }
    }

    const effectiveAuthHeader = authHeader || `Bearer ${anonKey}`;

    // 1. Ambil data siswa & kelas dari Supabase
    let studentRecord = null;
    let className = 'Kelas Reguler';
    let sportCategory = 'Badminton';
    let coachName = 'Instruktur Utama';

    if (studentId) {
      try {
        const stResp = await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${studentId}&select=*`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': effectiveAuthHeader
          }
        });
        if (stResp.ok) {
          const students = await stResp.json().catch(() => []);
          studentRecord = students[0] || null;
          if (studentRecord) {
            className = studentRecord.class_name || studentRecord.className || className;
            sportCategory = studentRecord.sport_category || studentRecord.sport || sportCategory;
            coachName = studentRecord.coach_name || studentRecord.coachName || coachName;
          }
        }
      } catch (stErr) {
        console.warn('[schedule.js] Student query warning:', stErr.message);
      }
    }

    // 2. Format jadwal latihan default/aktif
    const schedules = [
      {
        day: 'Selasa',
        startTime: '16:00',
        endTime: '18:00',
        courtName: 'Lapangan Utama',
        courtId: 'c-1'
      },
      {
        day: 'Kamis',
        startTime: '16:00',
        endTime: '18:00',
        courtName: 'Lapangan Utama',
        courtId: 'c-1'
      },
      {
        day: 'Sabtu',
        startTime: '08:00',
        endTime: '10:00',
        courtName: 'Lapangan Utama',
        courtId: 'c-1'
      }
    ];

    // 3. Ambil data presensi jika tersedia
    let attendances = [];
    if (studentId) {
      try {
        const attResp = await fetch(`${supabaseUrl}/rest/v1/academy_attendance?student_id=eq.${studentId}&order=date.desc&limit=20`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': effectiveAuthHeader
          }
        });
        if (attResp.ok) {
          const rawAtt = await attResp.json().catch(() => []);
          if (Array.isArray(rawAtt) && rawAtt.length > 0) {
            attendances = rawAtt.map(a => ({
              id: a.id,
              date: a.date || '',
              className: a.class_name || className,
              coachName: a.coach_name || coachName,
              status: a.status || 'Hadir',
              notes: a.notes || ''
            }));
          }
        }
      } catch (attErr) {
        console.warn('[schedule.js] Attendance query warning:', attErr.message);
      }
    }

    // Rekap statistik presensi
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
      classInfo: {
        id: studentRecord?.class_id || '',
        className,
        sport: sportCategory,
        coachName
      },
      schedules,
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
    return new Response(JSON.stringify({
      success: true,
      fallback: true,
      classInfo: {
        className: 'Kelas Reguler',
        sport: 'Badminton',
        coachName: 'Instruktur Utama'
      },
      schedules: [
        { day: 'Selasa', startTime: '16:00', endTime: '18:00', courtName: 'Lapangan Utama' },
        { day: 'Kamis', startTime: '16:00', endTime: '18:00', courtName: 'Lapangan Utama' }
      ],
      attendances: [],
      stats: {
        totalSessions: 0,
        hadir: 0,
        izin: 0,
        sakit: 0,
        alpha: 0,
        attendanceRate: '100%'
      }
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
