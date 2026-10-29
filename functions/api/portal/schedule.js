/**
 * Cloudflare Pages Function: /api/portal/schedule
 * Edge-safe schedule and attendance endpoint for Portal Wali Murid using Firebase Firestore REST API.
 */

// Helper to convert PEM private key to ArrayBuffer for Web Crypto API
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
    .replace(/-----END [A-Z0-9 ]+-----/g, '')
    .replace(/[\r\n\s]+/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Base64URL string encoder
function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ArrayBuffer to Base64URL encoder
function bufferToBase64Url(buf) {
  const binStr = String.fromCharCode(...new Uint8Array(buf));
  return btoa(binStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate Google OAuth2 Access Token using RS256 Web Crypto in Edge runtime
 */
async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  if (!clientEmail || !privateKeyPem) return null;

  try {
    const cleanPem = privateKeyPem.replace(/\\n/g, '\n').trim();
    const keyBuffer = pemToArrayBuffer(cleanPem);

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: { name: 'SHA-256' }
      },
      false,
      ['sign']
    );

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
      scope: 'https://www.googleapis.com/auth/datastore'
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaims = base64UrlEncode(JSON.stringify(claimSet));
    const unsignedToken = `${encodedHeader}.${encodedClaims}`;

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );

    const signedJwt = `${unsignedToken}.${bufferToBase64Url(signature)}`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google OAuth token exchange failed (${tokenResponse.status}): ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (err) {
    throw new Error(`Auth Error: ${err.message}`);
  }
}

/**
 * Unwraps Firestore typed values into standard JS primitives/objects
 */
function parseFirestoreValue(val) {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    return parseFirestoreFields(val.mapValue.fields);
  }
  return Object.values(val)[0];
}

function parseFirestoreFields(fields) {
  if (!fields) return {};
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

// OPTIONS CORS Preflight handler
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * POST /api/portal/schedule
 * Accepts { studentId, tenantId, classId }
 */
export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const { request, env = {} } = context;

    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    const body = await request.json().catch(() => ({}));
    let { studentId, tenantId, classId } = body;

    if (!studentId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Parameter studentId diperlukan.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Dapatkan Access Token Service Account
    let accessToken = null;
    try {
      accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    } catch (tokenErr) {
      console.warn('Google Auth token error:', tokenErr.message);
    }

    const reqHeaders = {
      'Content-Type': 'application/json'
    };
    if (accessToken) {
      reqHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    // 2. Ambil data Siswa untuk mendapatkan classId, className, tenantId
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
      console.warn('Gagal membaca data siswa di schedule.js:', err);
    }

    const classNameFromStudent = studentData?.className || '';
    const coachNameFromStudent = studentData?.coachName || '';

    // 3. Ambil data Kelas dan Jadwal dari koleksi academy_classes
    let classInfo = {
      id: classId || '',
      className: classNameFromStudent || 'Kelas Reguler',
      sport: studentData?.sportCategory || studentData?.sport || 'Olahraga',
      coachName: coachNameFromStudent || 'Instruktur Utama',
      schedules: [],
      scheduleSummary: ''
    };

    // Cari dokumen academy_classes
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
        console.warn('Gagal mengambil data academy_classes by ID:', err);
      }
    }

    // Jika schedules masih kosong, cari di academy_classes berdasarkan tenantId atau className
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

          // Cari kelas yang cocok dengan classId atau className
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
        console.warn('Gagal menjalankan kueri academy_classes:', err);
      }
    }

    // Normalisasi jadwal jika berupa string atau belum ada objek
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
      // Fallback: parse ringkasan misal "Senin (16:00-18:00, Lapangan 1)"
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

    // 4. Kueri Catatan Presensi Siswa
    const attendances = [];
    const cleanStudentId = String(studentId).trim().toLowerCase();

    // A. Kueri dari koleksi `academy_attendance`
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

          // Cek array students di dalam dokumen academy_attendance
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
              status: matchedRecord.status || 'Hadir', // 'Hadir' | 'Izin' | 'Sakit' | 'Alpa'
              notes: f.notes || ''
            });
          }
        }
      }
    } catch (attErr) {
      console.warn('Gagal membaca academy_attendance:', attErr);
    }

    // B. Kueri tambahan dari koleksi `attendances` (jika disimpan secara individual)
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
          // Cegah duplikasi berdasarkan id
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
      console.warn('Gagal membaca koleksi attendances:', directErr);
    }

    // Urutkan riwayat presensi berdasarkan tanggal terbaru (descending)
    attendances.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // 5. Hitung Statistik Presensi Siswa
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
    console.error('Portal Schedule API Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Terjadi kesalahan internal saat memuat jadwal',
        details: error.stack || error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
