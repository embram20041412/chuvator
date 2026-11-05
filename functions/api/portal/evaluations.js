/**
 * Cloudflare Pages Function: /api/portal/evaluations
 * Edge-safe athlete evaluations and achievements endpoint for Parent Portal V2.
 * Enforces V2 session authentication, CSRF validation, server-side child authorization,
 * and zero-artificial-data truth-in-data integrity.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  validatePortalV2Session
} from './_auth_v2.js';
import {
  getGoogleAccessToken,
  parseFirestoreFields
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
    // 1. Session Validation via Parent Portal V2 Auth
    const sessionResult = await validatePortalV2Session(context);
    if (!sessionResult.valid || !sessionResult.session) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;

    // 2. Strict CSRF & Origin Validation according to V2 session contract
    if (!verifyCsrf(request, env, session.csrfToken)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Permintaan ditolak. Origin tidak diizinkan atau CSRF check gagal.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Multi-Child Request Body & Student Authorization Check
    const body = await request.json().catch(() => ({}));
    const requestedStudentId = String(body.studentId || '').trim();

    if (!requestedStudentId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'studentId wajib disertakan.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Strictly validate requested studentId against server-verified childrenSummary in V2 session
    const authorizedChild = (session.childrenSummary || []).find(
      c => String(c.studentId || c.id || '').trim().toLowerCase() === requestedStudentId.toLowerCase()
    );

    if (!authorizedChild) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk data siswa ini.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    const verifiedStudentId = String(authorizedChild.studentId || authorizedChild.id).trim();
    const verifiedTenantId = String(authorizedChild.tenantId || '').trim();

    // Tenant boundary check if tenantId is provided in request body
    if (body.tenantId && String(body.tenantId).trim().toLowerCase() !== verifiedTenantId.toLowerCase()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Tenant tidak sesuai dengan relasi siswa.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

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

    // 5. Query ONLY official academy_evaluations collection (NO fallback to 'evaluations')
    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
    let evaluations = [];

    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: 'academy_evaluations' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'studentId' },
            op: 'EQUAL',
            value: { stringValue: verifiedStudentId }
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
        for (const item of results) {
          if (item.document && item.document.fields) {
            const parsed = parseFirestoreFields(item.document.fields);
            const docId = item.document.name.split('/').pop();
            const docTenant = String(parsed.tenantId || parsed.tenant_id || '').trim().toLowerCase();
            const docStudent = String(parsed.studentId || parsed.student_id || '').trim().toLowerCase();

            // STRICT FAIL-CLOSED TENANT & STUDENT OWNERSHIP CHECK
            if (!docTenant || docTenant !== verifiedTenantId.toLowerCase()) {
              console.warn(`[Evaluations] Rejecting evaluation ${docId}: tenantId mismatch (${docTenant} vs ${verifiedTenantId})`);
              continue;
            }

            if (!docStudent || docStudent !== verifiedStudentId.toLowerCase()) {
              console.warn(`[Evaluations] Rejecting evaluation ${docId}: studentId mismatch (${docStudent} vs ${verifiedStudentId})`);
              continue;
            }

            // 6. Publication Status Verification
            // If document contains an explicit status, only allow published/approved evaluations
            const evalStatus = String(parsed.status || parsed.publication_status || parsed.publicationStatus || '').toLowerCase().trim();
            if (evalStatus === 'draft' || evalStatus === 'archived' || evalStatus === 'cancelled') {
              console.warn(`[Evaluations] Skipping non-published evaluation ${docId} with status: ${evalStatus}`);
              continue;
            }

            evaluations.push({
              id: docId,
              ...parsed
            });
          }
        }
      }
    }

    // 7. Normalize Evaluation Data - Strict Truth-in-Data (NO ARBITRARY DEFAULTS)
    const normalizedEvaluations = evaluations.map((ev) => {
      const pScores = ev.pillarScores || ev.pillar_scores || {};

      // Strict: Only return numbers if present in database. DO NOT default to 75.
      const teknikScore = typeof pScores.teknik === 'number' ? pScores.teknik : (typeof ev.technicalScore === 'number' ? ev.technicalScore : null);
      const fisikScore = typeof pScores.fisik === 'number' ? pScores.fisik : (typeof ev.physicalScore === 'number' ? ev.physicalScore : null);
      const mentalScore = typeof pScores.mental === 'number' ? pScores.mental : (typeof ev.mentalScore === 'number' ? ev.mentalScore : null);
      const taktikScore = typeof pScores.taktik === 'number' ? pScores.taktik : (typeof ev.tacticalScore === 'number' ? ev.tacticalScore : null);

      // Strict: DO NOT synthesize overall score if not explicitly recorded in database
      const overall = typeof ev.overallScore === 'number'
        ? ev.overallScore
        : (typeof ev.overall_score === 'number'
          ? ev.overall_score
          : (typeof pScores.overall === 'number' ? pScores.overall : null));

      return {
        id: ev.id,
        date: ev.date || (ev.createdAt ? String(ev.createdAt).substring(0, 10) : (ev.created_at ? String(ev.created_at).substring(0, 10) : null)),
        evaluator: ev.evaluator || ev.coachName || ev.coach || null,
        className: ev.className || ev.class_name || authorizedChild.className || null,
        sport: ev.sport || ev.sportName || ev.sportCategory || null,
        playerRole: ev.playerRole || ev.player_role || ev.mainPosition || ev.position || null,
        overallScore: overall,
        pillarScores: {
          teknik: teknikScore,
          fisik: fisikScore,
          mental: mentalScore,
          taktik: taktikScore,
          teamwork: typeof pScores.teamwork === 'number' ? pScores.teamwork : null,
          health: typeof pScores.health === 'number' ? pScores.health : null,
          position: typeof pScores.position === 'number' ? pScores.position : null,
          universalHybrid: typeof pScores.universalHybrid === 'number' ? pScores.universalHybrid : null
        },
        mainPosition: ev.mainPosition || ev.main_position || null,
        subPosition: ev.subPosition || ev.sub_position || null,
        playingRole: ev.playingRole || ev.playing_role || null,
        secondaryPosition: ev.secondaryPosition || ev.secondary_position || null,
        situationalRole: ev.situationalRole || ev.situational_role || null,
        isUniversalHybrid: !!ev.isUniversalHybrid,
        coachNote: ev.coachNote || ev.coach_note || ev.notes || ev.feedback || null,
        scores: ev.scores || {},
        createdAt: ev.createdAt || ev.created_at || null
      };
    });

    normalizedEvaluations.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const latestEvaluation = normalizedEvaluations.length > 0 ? normalizedEvaluations[0] : null;

    // Optional student achievements query from verified student record
    let achievementsList = [];
    try {
      const studentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students/${encodeURIComponent(verifiedStudentId)}`;
      const studentResp = await fetch(studentUrl, { method: 'GET', headers: reqHeaders });
      if (studentResp.ok) {
        const studentDoc = await studentResp.json();
        const studentData = parseFirestoreFields(studentDoc.fields);
        const rawTournaments = Array.isArray(studentData?.tournaments)
          ? studentData.tournaments
          : (Array.isArray(studentData?.achievements) ? studentData.achievements : []);

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

        achievementsList.sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        });
      }
    } catch (achErr) {
      console.warn('Achievements fetch optional warning:', achErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        evaluations: normalizedEvaluations,
        latestEvaluation,
        achievements: achievementsList,
        student: {
          id: verifiedStudentId,
          studentName: authorizedChild.studentName || '',
          className: authorizedChild.className || ''
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

