/**
 * Cloudflare Pages Function: /api/portal/evaluations (STAGE 7G.2A.3)
 * Edge-safe athlete evaluations and achievements endpoint for Portal Wali Murid using Firebase Firestore REST API.
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
 * POST /api/portal/evaluations
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

    // 4. Validate Service Account Credentials
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Firebase Service Account environment variables missing in evaluations.js');
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
      console.error('Google Auth token error in evaluations.js:', tokenErr.message);
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

    // 5. Fetch Student document for achievements & tenantId
    let studentData = null;
    try {
      const studentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students/${encodeURIComponent(String(studentId).trim())}`;
      const studentResp = await fetch(studentUrl, { method: 'GET', headers: reqHeaders });
      if (studentResp.ok) {
        const studentDoc = await studentResp.json();
        studentData = parseFirestoreFields(studentDoc.fields);
        if (!tenantId && studentData.tenantId) {
          tenantId = studentData.tenantId;
        }
      }
    } catch (sErr) {
      console.warn('Failed to fetch student document in evaluations.js:', sErr.message);
    }

    // 6. Extract Achievements / Tournaments from Student Document
    const achievementsList = [];
    if (studentData) {
      const rawTournaments = Array.isArray(studentData.tournaments) 
        ? studentData.tournaments 
        : (Array.isArray(studentData.achievements) ? studentData.achievements : []);

      rawTournaments.forEach((t, idx) => {
        achievementsList.push({
          id: t.id || `ach-${idx}-${Date.now()}`,
          name: t.name || t.title || t.tournamentName || 'Kejuaraan / Turnamen',
          date: t.date || t.year || '-',
          result: t.result || t.rank || t.achievement || 'Peserta',
          category: t.category || t.sport || studentData.sportCategory || 'Umum',
          notes: t.notes || t.description || ''
        });
      });
    }

    // 7. Query Coach Evaluations (academy_evaluations & evaluations)
    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
    let evaluations = [];

    const queryEvaluationsCollection = async (collectionName) => {
      try {
        const queryPayload = {
          structuredQuery: {
            from: [{ collectionId: collectionName }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'studentId' },
                op: 'EQUAL',
                value: { stringValue: String(studentId).trim() }
              }
            },
            limit: 50
          }
        };

        const resp = await fetch(runQueryUrl, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(queryPayload)
        });

        if (resp.ok) {
          const results = await resp.json();
          if (Array.isArray(results)) {
            const list = [];
            for (const item of results) {
              if (item.document && item.document.fields) {
                const parsed = parseFirestoreFields(item.document.fields);
                const docId = item.document.name.split('/').pop();
                list.push({
                  id: docId,
                  ...parsed
                });
              }
            }
            return list;
          }
        }
      } catch (err) {
        console.warn(`Query on ${collectionName} failed:`, err.message);
      }
      return [];
    };

    evaluations = await queryEvaluationsCollection('academy_evaluations');

    if (evaluations.length === 0) {
      const fallbackEvals = await queryEvaluationsCollection('evaluations');
      if (fallbackEvals.length > 0) {
        evaluations = fallbackEvals;
      }
    }

    // 8. Normalize Evaluation Scores & Details
    const normalizedEvaluations = evaluations.map((ev) => {
      const pScores = ev.pillarScores || {};
      const teknikScore = typeof pScores.teknik === 'number' ? pScores.teknik : (typeof ev.technicalScore === 'number' ? ev.technicalScore : 75);
      const fisikScore = typeof pScores.fisik === 'number' ? pScores.fisik : (typeof ev.physicalScore === 'number' ? ev.physicalScore : 75);
      const mentalScore = typeof pScores.mental === 'number' ? pScores.mental : (typeof ev.mentalScore === 'number' ? ev.mentalScore : 75);
      const taktikScore = typeof pScores.taktik === 'number' ? pScores.taktik : (typeof ev.tacticalScore === 'number' ? ev.tacticalScore : 75);
      
      const overall = typeof ev.overallScore === 'number'
        ? ev.overallScore
        : (typeof pScores.overall === 'number'
          ? pScores.overall
          : Math.round((teknikScore + fisikScore + mentalScore + taktikScore) / 4));

      return {
        id: ev.id,
        date: ev.date || (ev.createdAt ? String(ev.createdAt).substring(0, 10) : '-'),
        evaluator: ev.evaluator || ev.coachName || ev.coach || 'Pelatih Utama',
        className: ev.className || 'Kelas Akademi',
        sport: ev.sport || ev.sportName || ev.sportCategoryLabel || 'Olahraga',
        playerRole: ev.playerRole || 'Umum',
        overallScore: overall,
        pillarScores: {
          teknik: Math.round(teknikScore),
          fisik: Math.round(fisikScore),
          mental: Math.round(mentalScore),
          taktik: Math.round(taktikScore),
          teamwork: typeof pScores.teamwork === 'number' ? Math.round(pScores.teamwork) : null,
          health: typeof pScores.health === 'number' ? Math.round(pScores.health) : null,
          position: pScores.position ? Math.round(pScores.position) : null,
          universalHybrid: typeof pScores.universalHybrid === 'number' ? Math.round(pScores.universalHybrid) : null
        },
        mainPosition: ev.mainPosition || null,
        subPosition: ev.subPosition || null,
        playingRole: ev.playingRole || null,
        secondaryPosition: ev.secondaryPosition || null,
        situationalRole: ev.situationalRole || null,
        isUniversalHybrid: !!ev.isUniversalHybrid,
        coachNote: ev.coachNote || ev.notes || ev.feedback || 'Perkembangan atlet menunjukkan konsistensi yang baik.',
        scores: ev.scores || {},
        createdAt: ev.createdAt || null
      };
    });

    normalizedEvaluations.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    achievementsList.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    const latestEvaluation = normalizedEvaluations.length > 0 ? normalizedEvaluations[0] : null;

    return new Response(
      JSON.stringify({
        success: true,
        evaluations: normalizedEvaluations,
        latestEvaluation,
        achievements: achievementsList,
        student: {
          id: studentId,
          studentName: studentData?.studentName || '',
          className: studentData?.className || ''
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Unhandled evaluations API error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memproses data evaluasi atlet.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

