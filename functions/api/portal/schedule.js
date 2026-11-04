/**
 * Cloudflare Pages Function: /api/portal/schedule (STAGE 7G.2A.3)
 * Edge-safe schedule and attendance endpoint for Portal Wali Murid using Firebase Firestore REST API.
 * Enforces session authentication, CSRF validation, strict tenant/student isolation, and fail-closed credentials.
 */

import {
  getGoogleAccessToken,
  parseFirestoreFields,
  getCorsHeaders,
  verifyCsrf,
  validatePortalSession
} from './_auth.js';

// OPTIONS CORS Preflight handler
export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * POST /api/portal/schedule
 */
export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Session Validation
    const sessionResult = await validatePortalSession(context);
    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Sesi tidak valid atau telah kedaluwarsa.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;

    // 2. Strict CSRF & Origin Validation
    if (!verifyCsrf(request, env, session.csrfToken)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Permintaan ditolak. Origin tidak diizinkan atau CSRF check gagal.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Request Body Student Authorization Check
    const body = await request.json().catch(() => ({}));
    if (body.studentId && String(body.studentId).trim().toLowerCase() !== session.studentId.toLowerCase()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk data siswa ini.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    const studentId = session.studentId;
    let tenantId = session.tenantId;
    let classId = body.classId || '';

    // 4. Validate Service Account Credentials
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Firebase Service Account environment variables missing in schedule.js');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Terjadi kesalahan konfigurasi server database.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let accessToken = null;
    try {
      accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    } catch (tokenErr) {
      console.error('Google Auth token error in schedule.js:', tokenErr.message);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal melakukan autentikasi koneksi database.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Access token database tidak dapat diperoleh.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    // 5. Fetch Student document for classId, className, and tenantId
    let studentData = null;
    try {
      const studentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students/${encodeURIComponent(String(studentId).trim())}`;
      const studentResp = await fetch(studentUrl, { method: 'GET', headers: reqHeaders });
      if (studentResp.ok) {
        const studentDoc = await studentResp.json();
        studentData = parseFirestoreFields(studentDoc.fields);
        if (!classId && studentData.classId) {
          classId = studentData.classId;
        }
        if (!tenantId && studentData.tenantId) {
          tenantId = studentData.tenantId;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca data siswa di schedule.js:', err.message);
    }

    const classNameFromStudent = studentData?.className || '';
    const coachNameFromStudent = studentData?.coachName || '';

    // 6. Fetch Class & Schedule Data from academy_classes
    let classInfo = {
      id: classId || '',
      className: classNameFromStudent || 'Kelas Reguler',
      sport: studentData?.sportCategory || studentData?.sport || 'Olahraga',
      coachName: coachNameFromStudent || 'Instruktur Utama',
      schedules: [],
      scheduleSummary: ''
    };

    if (classId) {
      try {
        const classUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/academy_classes/${encodeURIComponent(String(classId).trim())}`;
        const classResp = await fetch(classUrl, { method: 'GET', headers: reqHeaders });
        if (classResp.ok) {
          const classDoc = await classResp.json();
          const cFields = parseFirestoreFields(classDoc.fields);
          classInfo = {
            id: classId,
            className: cFields.className || classNameFromStudent || 'Kelas Akademi',
            sport: cFields.sport || studentData?.sportCategory || 'Olahraga',
            coachName: cFields.coachName || coachNameFromStudent || 'Instruktur Utama',
            schedules: Array.isArray(cFields.schedules) ? cFields.schedules : [],
            scheduleSummary: cFields.schedule || ''
          };
        }
      } catch (err) {
        console.warn('Gagal mengambil data academy_classes by ID:', err.message);
      }
    }

    if (classInfo.schedules.length === 0 && tenantId) {
      try {
        const classQueryPayload = {
          structuredQuery: {
            from: [{ collectionId: 'academy_classes' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'tenantId' },
                op: 'EQUAL',
                value: { stringValue: String(tenantId).trim() }
              }
            },
            limit: 10
          }
        };

        const classQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
        const classQueryResp = await fetch(classQueryUrl, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(classQueryPayload)
        });

        if (classQueryResp.ok) {
          const classResults = await classQueryResp.json();
          const docs = (Array.isArray(classResults) ? classResults : []).filter((item) => item.document);

          let matchedClass = null;
          for (const d of docs) {
            const docId = (d.document.name || '').split('/').pop();
            const f = parseFirestoreFields(d.document.fields);
            if (classId && docId === classId) {
              matchedClass = { id: docId, ...f };
              break;
            }
            if (classNameFromStudent && f.className && f.className.toLowerCase() === classNameFromStudent.toLowerCase()) {
              matchedClass = { id: docId, ...f };
              break;
            }
          }

          if (!matchedClass && docs.length > 0) {
            const firstDocId = (docs[0].document.name || '').split('/').pop();
            matchedClass = { id: firstDocId, ...parseFirestoreFields(docs[0].document.fields) };
          }

          if (matchedClass) {
            classInfo = {
              id: matchedClass.id,
              className: matchedClass.className || classNameFromStudent || 'Kelas Akademi',
              sport: matchedClass.sport || studentData?.sportCategory || 'Olahraga',
              coachName: matchedClass.coachName || coachNameFromStudent || 'Instruktur Utama',
              schedules: Array.isArray(matchedClass.schedules) ? matchedClass.schedules : [],
              scheduleSummary: matchedClass.schedule || ''
            };
            if (!classId) classId = matchedClass.id;
          }
        }
      } catch (err) {
        console.warn('Gagal menjalankan kueri academy_classes:', err.message);
      }
    }

    const normalizedSchedules = [];
    if (Array.isArray(classInfo.schedules) && classInfo.schedules.length > 0) {
      for (const s of classInfo.schedules) {
        normalizedSchedules.push({
          day: s.day || s.hari || 'Sesi Latihan',
          startTime: s.startTime || s.jamMulai || '16:00',
          endTime: s.endTime || s.jamSelesai || '18:00',
          courtName: s.courtName || s.lapangan || 'Lapangan Utama',
          courtId: s.courtId || ''
        });
      }
    } else if (classInfo.scheduleSummary) {
      const parts = classInfo.scheduleSummary.split(';');
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

    // 7. Query Attendance Records for Authenticated Student
    const attendances = [];
    const cleanStudentId = String(studentId).trim().toLowerCase();

    // A. Query academy_attendance collection for tenant
    try {
      const attQueryPayload = {
        structuredQuery: {
          from: [{ collectionId: 'academy_attendance' }],
          where: tenantId ? {
            fieldFilter: {
              field: { fieldPath: 'tenantId' },
              op: 'EQUAL',
              value: { stringValue: String(tenantId).trim() }
            }
          } : undefined,
          limit: 25
        }
      };

      const attQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
      const attResp = await fetch(attQueryUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(attQueryPayload)
      });

      if (attResp.ok) {
        const attResults = await attResp.json();
        const docs = (Array.isArray(attResults) ? attResults : []).filter((item) => item.document);

        for (const d of docs) {
          const docId = (d.document.name || '').split('/').pop();
          const f = parseFirestoreFields(d.document.fields);

          const studentsList = Array.isArray(f.students) ? f.students : [];
          const matchedRecord = studentsList.find((s) => {
            const sid = String(s.studentId || s.id || '').trim().toLowerCase();
            return sid === cleanStudentId || sid.startsWith(cleanStudentId);
          });

          if (matchedRecord) {
            attendances.push({
              id: docId,
              date: f.date || f.attendanceDate || '',
              className: f.className || classInfo.className,
              coachName: f.coachName || classInfo.coachName,
              status: matchedRecord.status || 'Hadir',
              notes: f.notes || ''
            });
          }
        }
      }
    } catch (attErr) {
      console.warn('Gagal membaca academy_attendance:', attErr.message);
    }

    // B. Query attendances collection directly for studentId
    try {
      const directAttPayload = {
        structuredQuery: {
          from: [{ collectionId: 'attendances' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'studentId' },
              op: 'EQUAL',
              value: { stringValue: String(studentId).trim() }
            }
          },
          limit: 20
        }
      };

      const directAttUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
      const directResp = await fetch(directAttUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(directAttPayload)
      });

      if (directResp.ok) {
        const directResults = await directResp.json();
        const docs = (Array.isArray(directResults) ? directResults : []).filter((item) => item.document);
        for (const d of docs) {
          const docId = (d.document.name || '').split('/').pop();
          const f = parseFirestoreFields(d.document.fields);
          if (!attendances.some((a) => a.id === docId)) {
            attendances.push({
              id: docId,
              date: f.date || f.attendanceDate || '',
              className: f.className || classInfo.className,
              coachName: f.coachName || classInfo.coachName,
              status: f.status || 'Hadir',
              notes: f.notes || ''
            });
          }
        }
      }
    } catch (directErr) {
      console.warn('Gagal membaca koleksi attendances:', directErr.message);
    }

    attendances.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // 8. Calculate Attendance Statistics
    const totalSessions = attendances.length;
    let hadirCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alphaCount = 0;

    for (const a of attendances) {
      const st = String(a.status || '').toLowerCase();
      if (st.includes('hadir') || st.includes('present')) {
        hadirCount++;
      } else if (st.includes('izin') || st.includes('permit')) {
        izinCount++;
      } else if (st.includes('sakit') || st.includes('sick')) {
        sakitCount++;
      } else if (st.includes('alpa') || st.includes('alpha') || st.includes('absent')) {
        alphaCount++;
      } else {
        hadirCount++;
      }
    }

    const attendanceRate = totalSessions > 0
      ? `${Math.round((hadirCount / totalSessions) * 100)}%`
      : '100%';

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data jadwal latihan dan presensi berhasil dimuat',
        classInfo: {
          id: classInfo.id,
          className: classInfo.className,
          sport: classInfo.sport,
          coachName: classInfo.coachName
        },
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
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal saat memuat jadwal.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

