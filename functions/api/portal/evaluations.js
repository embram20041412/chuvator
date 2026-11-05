/**
 * Cloudflare Pages Function: /api/portal/evaluations
 * Edge-safe athlete evaluations and achievements endpoint for Parent Portal V2.
 * Enforces V2 session authentication, CSRF validation, and server-side child authorization.
 * 
 * ACTIVE DATABASE: Supabase/PostgreSQL (RECONCILED)
 * LEGACY FIRESTORE REMOVED.
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
    const supabaseUrl = getCleanSupabaseUrl(env);
    const anonKey = getSupabaseAnonKey(env);

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

    // 4. Supabase REST API Query - Evaluations
    const evaluationsUrl = `${supabaseUrl}/rest/v1/academy_evaluations?student_id=eq.${verifiedStudentId}&tenant_id=eq.${verifiedTenantId}&select=*&order=created_at.desc`;
    
    const evalResp = await fetch(evaluationsUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!evalResp.ok) {
      const errText = await evalResp.text().catch(() => 'Unknown error');
      console.error(`[Evaluations] Supabase query failed with status ${evalResp.status}: ${errText}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: evalResp.status === 401 || evalResp.status === 403 
            ? 'Akses database ditolak. Hubungi administrator.' 
            : 'Terjadi gangguan pada layanan database evaluasi.'
        }),
        { status: evalResp.status >= 500 ? 502 : 500, headers: corsHeaders }
      );
    }

    const rawEvaluations = await evalResp.json();
    
    // 5. Supabase REST API Query - Student Achievements (Tournaments)
    const studentUrl = `${supabaseUrl}/rest/v1/students?id=eq.${verifiedStudentId}&tenant_id=eq.${verifiedTenantId}&select=tournaments,student_name,class_name`;
    const studentResp = await fetch(studentUrl, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    let achievementsList = [];
    let studentInfo = {
      id: verifiedStudentId,
      studentName: authorizedChild.studentName || '',
      className: authorizedChild.className || ''
    };

    if (studentResp.ok) {
      const studentData = await studentResp.json();
      if (Array.isArray(studentData) && studentData.length > 0) {
        const student = studentData[0];
        studentInfo.studentName = student.student_name || studentInfo.studentName;
        studentInfo.className = student.class_name || studentInfo.className;

        const rawTournaments = Array.isArray(student.tournaments) ? student.tournaments : [];
        rawTournaments.forEach((t) => {
          const achName = t.name || t.title || t.tournamentName;
          const achResult = t.result || t.rank || t.achievement;
          
          // Strict Publication Check: isVerified or published status
          const isVerified = t.isVerified === true || t.verified === true || t.status === 'published' || t.status === 'verified';
          
          if (achName && achResult && isVerified) {
            achievementsList.push({
              id: t.id || null,
              name: achName,
              date: t.date || t.year || null,
              result: achResult,
              category: t.category || t.sport || null,
              notes: t.notes || t.description || null
            });
          }
        });

        achievementsList.sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        });
      }
    }

    // 6. Normalize & Filter Evaluations - Truth-in-Data (FAIL-CLOSED Publication)
    const normalizedEvaluations = rawEvaluations
      .filter(ev => {
        // Publication Status Filter:
        // If status column exists, only allow 'published' or 'approved'.
        // If status column is missing (null/undefined), we assume published 
        // because currently Supabase schema doesn't have it yet.
        const rawStatus = ev.status || ev.publication_status || ev.publicationStatus;
        if (rawStatus) {
          const evalStatus = String(rawStatus).toLowerCase().trim();
          return ['published', 'approved'].includes(evalStatus);
        }
        return true; // No status field -> Default to visible for now (operational truth)
      })
      .map((ev) => {
        const pScores = ev.pillar_scores || ev.pillarScores || {};

        // Strict: Only return numbers if present. NO ARBITRARY DEFAULTS (e.g. 75).
        const teknikScore = typeof pScores.teknik === 'number' ? pScores.teknik : (typeof ev.technical_score === 'number' ? ev.technical_score : null);
        const fisikScore = typeof pScores.fisik === 'number' ? pScores.fisik : (typeof ev.physical_score === 'number' ? ev.physical_score : null);
        const mentalScore = typeof pScores.mental === 'number' ? pScores.mental : (typeof ev.mental_score === 'number' ? ev.mental_score : null);
        const taktikScore = typeof pScores.taktik === 'number' ? pScores.taktik : (typeof ev.tactical_score === 'number' ? ev.tactical_score : null);

        // Strict: DO NOT synthesize overall score if not stored
        const overall = typeof ev.overall_score === 'number'
          ? ev.overall_score
          : (typeof ev.overallScore === 'number'
            ? ev.overallScore
            : (typeof pScores.overall === 'number' ? pScores.overall : null));

        return {
          id: ev.id,
          date: ev.date || (ev.created_at ? String(ev.created_at).substring(0, 10) : null),
          evaluator: ev.evaluator || ev.coach_name || ev.coach || null,
          className: ev.class_name || ev.className || authorizedChild.className || null,
          sport: ev.sport || ev.sport_name || null,
          playerRole: ev.player_role || ev.playing_role || ev.main_position || null,
          overallScore: overall,
          pillarScores: {
            teknik: teknikScore,
            fisik: fisikScore,
            mental: mentalScore,
            taktik: taktikScore,
            teamwork: typeof pScores.teamwork === 'number' ? pScores.teamwork : (typeof pScores.komunikasi === 'number' ? pScores.komunikasi : null),
            health: typeof pScores.health === 'number' ? pScores.health : (typeof pScores.perkembangan === 'number' ? pScores.perkembangan : null),
            position: typeof pScores.position === 'number' ? pScores.position : (typeof pScores.khususPosisi === 'number' ? pScores.khususPosisi : null),
            universalHybrid: typeof pScores.universalHybrid === 'number' ? pScores.universalHybrid : null
          },
          mainPosition: ev.main_position || ev.mainPosition || null,
          subPosition: ev.sub_position || ev.subPosition || null,
          playingRole: ev.playing_role || ev.playingRole || null,
          coachNote: ev.coach_note || ev.coachNote || ev.notes || ev.feedback || null,
          scores: ev.scores || {},
          createdAt: ev.created_at || null
        };
      });

    return new Response(
      JSON.stringify({
        success: true,
        evaluations: normalizedEvaluations,
        latestEvaluation: normalizedEvaluations.length > 0 ? normalizedEvaluations[0] : null,
        achievements: achievementsList,
        student: studentInfo
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
