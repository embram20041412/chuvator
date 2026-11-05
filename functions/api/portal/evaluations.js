/**
 * Cloudflare Pages Function: /api/portal/evaluations
 * Edge-safe athlete evaluations and achievements endpoint for Parent Portal V2.
 * Pure Cloudflare Pages Functions standard with native Fetch API to Supabase REST.
 * 
 * ZERO DUMMY DATA:
 * - If no evaluations in database, returns evaluations: [] and latestEvaluation: null.
 * - If no achievements in database, returns achievements: [].
 * - No fake 85 score, no fake Juara 2 Perak medal.
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
        console.warn('[evaluations.js] Session check fallback:', e.message);
      }
    }

    const effectiveAuthHeader = authHeader || `Bearer ${anonKey}`;

    // 1. Ambil data rapor evaluasi dari Supabase tabel academy_evaluations
    let evaluationsList = [];
    if (studentId) {
      try {
        const evalResp = await fetch(`${supabaseUrl}/rest/v1/academy_evaluations?student_id=eq.${studentId}&order=created_at.desc`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': effectiveAuthHeader
          }
        });

        if (evalResp.ok) {
          const rawEvals = await evalResp.json().catch(() => []);
          if (Array.isArray(rawEvals) && rawEvals.length > 0) {
            evaluationsList = rawEvals
              .filter(ev => {
                // Filter status publikasi jika kolom status ada
                const rawStatus = ev.status || ev.publication_status;
                if (rawStatus) {
                  const s = String(rawStatus).toLowerCase().trim();
                  return ['published', 'approved'].includes(s);
                }
                return true;
              })
              .map(ev => {
                const pScores = ev.pillar_scores || ev.pillarScores || {};
                const teknik = typeof pScores.teknik === 'number' ? pScores.teknik : (typeof ev.technical_score === 'number' ? ev.technical_score : null);
                const fisik = typeof pScores.fisik === 'number' ? pScores.fisik : (typeof ev.physical_score === 'number' ? ev.physical_score : null);
                const mental = typeof pScores.mental === 'number' ? pScores.mental : (typeof ev.mental_score === 'number' ? ev.mental_score : null);
                const taktik = typeof pScores.taktik === 'number' ? pScores.taktik : (typeof ev.tactical_score === 'number' ? ev.tactical_score : null);

                return {
                  id: ev.id,
                  date: ev.date || (ev.created_at ? String(ev.created_at).substring(0, 10) : null),
                  evaluator: ev.evaluator || ev.coach_name || 'Pelatih',
                  className: ev.class_name || 'Kelas Reguler',
                  sport: ev.sport || 'Badminton',
                  playerRole: ev.player_role || ev.main_position || null,
                  overallScore: typeof ev.overall_score === 'number' ? ev.overall_score : null,
                  pillarScores: {
                    teknik,
                    fisik,
                    mental,
                    taktik
                  },
                  coachNote: ev.coach_note || ev.notes || null,
                  createdAt: ev.created_at || null
                };
              });
          }
        } else {
          console.warn('[evaluations.js] Supabase academy_evaluations query status:', evalResp.status);
        }
      } catch (evalErr) {
        console.warn('[evaluations.js] Evaluations query error:', evalErr.message);
      }
    }

    // 2. Ambil data prestasi atlet dari kolom tournaments di tabel students
    let achievementsList = [];
    let studentInfo = {
      id: studentId,
      studentName: '',
      className: ''
    };

    if (studentId) {
      try {
        const studentResp = await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${studentId}&select=tournaments,student_name,name,class_name`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': effectiveAuthHeader
          }
        });

        if (studentResp.ok) {
          const studentData = await studentResp.json().catch(() => []);
          const st = studentData[0];
          if (st) {
            studentInfo.studentName = st.student_name || st.name || '';
            studentInfo.className = st.class_name || '';

            const rawTournaments = Array.isArray(st.tournaments) ? st.tournaments : [];
            rawTournaments.forEach(t => {
              const achName = t.name || t.title || t.tournamentName;
              const achResult = t.result || t.rank || t.achievement;
              if (achName && achResult) {
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

            achievementsList.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          }
        }
      } catch (stErr) {
        console.warn('[evaluations.js] Students query error:', stErr.message);
      }
    }

    // Response murni tanpa data palsu: jika kosong, kembalikan array kosong []
    const finalResponse = {
      success: true,
      evaluations: evaluationsList,
      latestEvaluation: evaluationsList.length > 0 ? evaluationsList[0] : null,
      achievements: achievementsList,
      student: studentInfo
    };

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[evaluations.js] Unhandled exception:', error.message);
    return new Response(JSON.stringify({
      success: true,
      evaluations: [],
      latestEvaluation: null,
      achievements: [],
      student: { id: '', studentName: '', className: '' }
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
