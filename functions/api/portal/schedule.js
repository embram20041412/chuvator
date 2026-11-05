/**
 * Cloudflare Pages Function: /api/portal/schedule (REFACTORED V2 - SUPABASE)
 * Edge-safe schedule and attendance endpoint for Portal Wali Murid.
 * Enforces V2 session authentication, CSRF validation, and server-side child authorization.
 * 
 * ACTIVE DATABASE: Supabase/PostgreSQL
 * REMOVED: Firestore REST API logic.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  validatePortalV2Session,
  getCleanSupabaseUrl,
  getSupabaseAnonKey
} from './_auth_v2.js';

// OPTIONS CORS Preflight handler
export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/portal/schedule
 */
export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Session Validation via Parent Portal V2 Auth
    const sessionResult = await validatePortalV2Session(context);
    if (!sessionResult.valid || !sessionResult.session) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesi tidak valid. Silakan login kembali.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;
    const supabaseUrl = getCleanSupabaseUrl(env);
    const anonKey = getSupabaseAnonKey(env);

    // 2. Strict CSRF Validation
    if (!verifyCsrf(request, env, session.csrfToken)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Permintaan ditolak. CSRF check gagal.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Multi-Child Request Body & Student Authorization Check
    const body = await request.json().catch(() => ({}));
    const requestedStudentId = String(body.studentId || '').trim();

    if (!requestedStudentId) {
      return new Response(
        JSON.stringify({ success: false, message: 'studentId wajib disertakan.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const authorizedChild = (session.childrenSummary || []).find(
      c => String(c.studentId || c.id || '').trim().toLowerCase() === requestedStudentId.toLowerCase()
    );

    if (!authorizedChild) {
      return new Response(
        JSON.stringify({ success: false, message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk anak ini.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const verifiedStudentId = String(authorizedChild.studentId || authorizedChild.id).trim();
    const verifiedTenantId = String(authorizedChild.tenantId || '').trim();

    // 4. Fetch Student & Class Info via Supabase
    // Join student with class and coach info
    const studentUrl = `${supabaseUrl}/rest/v1/students?id=eq.${verifiedStudentId}&tenant_id=eq.${verifiedTenantId}&select=*,academy_classes(*,coaches(*))`;
    const studentResp = await fetch(studentUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!studentResp.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'Gagal mengambil data profil siswa dari database.' }),
        { status: 502, headers: corsHeaders }
      );
    }

    const studentDataList = await studentResp.json();
    const student = studentDataList[0];

    if (!student) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data siswa tidak ditemukan.' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const academyClass = student.academy_classes || {};
    const coach = academyClass.coaches || {};

    const classInfo = {
      id: academyClass.id || student.class_id || '',
      className: academyClass.class_name || student.class_name || 'Kelas Reguler',
      sport: academyClass.sport || student.sport_category || student.sport || 'Olahraga',
      coachName: coach.name || academyClass.coach_name || student.coach_name || 'Instruktur Utama'
    };

    // 5. Normalize Schedules
    const normalizedSchedules = [];
    const rawSchedules = Array.isArray(academyClass.schedules) ? academyClass.schedules : [];
    
    if (rawSchedules.length > 0) {
      for (const s of rawSchedules) {
        normalizedSchedules.push({
          day: s.day || s.hari || 'Sesi Latihan',
          startTime: s.startTime || s.jamMulai || '16:00',
          endTime: s.endTime || s.jamSelesai || '18:00',
          courtName: s.courtName || s.lapangan || 'Lapangan Utama',
          courtId: s.courtId || ''
        });
      }
    } else if (academyClass.schedule) {
      // Parse semi-colon separated string if present
      const parts = String(academyClass.schedule).split(';');
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed) {
          normalizedSchedules.push({
            day: trimmed.split('(')[0]?.trim() || 'Sesi Latihan',
            startTime: '16:00',
            endTime: '18:00',
            courtName: trimmed.includes(',') ? trimmed.split(',')[1]?.replace(')', '')?.trim() || 'Lapangan Utama' : 'Lapangan Utama',
            courtId: ''
          });
        }
      }
    }

    // 6. Fetch Attendance Records via Supabase
    const attUrl = `${supabaseUrl}/rest/v1/academy_attendance?student_id=eq.${verifiedStudentId}&tenant_id=eq.${verifiedTenantId}&order=date.desc&limit=25`;
    const attResp = await fetch(attUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json'
      }
    });

    const rawAttendances = attResp.ok ? await attResp.json() : [];
    const attendances = rawAttendances.map(a => ({
      id: a.id,
      date: a.date || '',
      className: a.class_name || classInfo.className,
      coachName: a.coach_name || classInfo.coachName,
      status: a.status || 'Hadir',
      notes: a.notes || ''
    }));

    // 7. Calculate Statistics
    const totalSessions = attendances.length;
    let hadirCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alphaCount = 0;

    for (const a of attendances) {
      const st = String(a.status || '').toLowerCase();
      if (st.includes('hadir') || st.includes('present')) hadirCount++;
      else if (st.includes('izin') || st.includes('permit')) izinCount++;
      else if (st.includes('sakit') || st.includes('sick')) sakitCount++;
      else if (st.includes('alpa') || st.includes('alpha') || st.includes('absent')) alphaCount++;
      else hadirCount++;
    }

    const attendanceRate = totalSessions > 0
      ? `${Math.round((hadirCount / totalSessions) * 100)}%`
      : '100%';

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data jadwal dan presensi berhasil dimuat',
        classInfo,
        schedules: normalizedSchedules,
        attendances,
        stats: {
          totalSessions,
          hadir: hadirCount,
          izin: izinCount,
          sakit: sakitCount,
          alpha: alphaCount,
          attendanceRate
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Portal Schedule API Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal saat memuat jadwal.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
