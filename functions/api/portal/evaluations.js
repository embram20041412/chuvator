/**
 * Cloudflare Pages Function: /api/portal/evaluations
 * Edge-safe athlete evaluations and achievements endpoint for Parent Portal V2 (V2.6.10 Security Hardening).
 * Strict Session V2, Anti-IDOR, Tenant Boundary Enforcement, CSRF verification, and Supabase RLS Bearer token integration.
 * 
 * ZERO DUMMY DATA:
 * - If no evaluations in database, returns evaluations: [] and latestEvaluation: null.
 * - If no achievements in database, returns achievements: [].
 * - Never uses anonKey as Bearer token.
 * - Fail-closed CSRF, Tenant Isolation, Student UUID validation, and Supabase Response Error Handling.
 */

import {
  validatePortalV2Session,
  verifyCsrf,
  getCorsHeaders,
  getCleanSupabaseUrl,
  getSupabaseAnonKey
} from './_auth_v2.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequest(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  // 1. Tangani Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // 2. Autentikasi Sesi Parent Portal V2 (Strict Fail-Closed)
    const sessionResult = await validatePortalV2Session(context);

    if (
      !sessionResult ||
      !sessionResult.valid ||
      !sessionResult.session ||
      !sessionResult.session.accessToken
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Sesi tidak valid atau telah kedaluwarsa.',
          message: 'Sesi tidak valid atau telah kedaluwarsa.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { session } = sessionResult;
    const { accessToken } = session;
    const childrenSummary = Array.isArray(session.childrenSummary) ? session.childrenSummary : [];
    const accessibleTenants = Array.isArray(session.accessibleTenants) ? session.accessibleTenants : [];

    // 3. Strict CSRF Verification for POST (Fail-Closed)
    if (request.method === 'POST') {
      const sessionCsrf = typeof session.csrfToken === 'string' ? session.csrfToken.trim() : '';
      if (!sessionCsrf) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'CSRF token sesi tidak tersedia.',
            message: 'Akses ditolak. CSRF token sesi tidak tersedia.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      const reqCsrf = request.headers.get('X-Portal-CSRF');
      if (!reqCsrf || reqCsrf !== sessionCsrf || !verifyCsrf(request, env, sessionCsrf)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'CSRF token atau origin tidak valid.',
            message: 'Akses ditolak. CSRF token atau origin tidak valid.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // 4. Validasi accessibleTenants (Wajib array valid dan tidak kosong)
    if (!Array.isArray(session.accessibleTenants) || session.accessibleTenants.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Akses lintas tenant tidak diizinkan.',
          message: 'Akses ditolak. Sesi Anda tidak memiliki daftar tenant yang terotorisasi.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 5. Parse Body / SearchParams for requested student & tenant
    let rawStudentId = '';
    let rawTenantId = '';

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      rawStudentId = body.studentId || body.student_id || '';
      rawTenantId = body.tenantId || body.tenant_id || '';
    } else {
      const url = new URL(request.url);
      rawStudentId = url.searchParams.get('studentId') || url.searchParams.get('student_id') || '';
      rawTenantId = url.searchParams.get('tenantId') || url.searchParams.get('tenant_id') || '';
    }

    // Default to first child if not specified
    const firstChild = childrenSummary[0] || {};
    const studentId = String(rawStudentId || firstChild.studentId || firstChild.id || '').trim().toLowerCase();

    // 6. Validasi studentId & format UUID
    if (!studentId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parameter studentId wajib diisi.',
          message: 'Parameter studentId wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!UUID_REGEX.test(studentId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Format studentId tidak valid.',
          message: 'Format studentId tidak valid. Wajib berupa UUID.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 7. Anti-IDOR: Validasi Kepemilikan Siswa terhadap childrenSummary pada sesi
    const matchingChildren = childrenSummary.filter(
      c => String(c.studentId || c.id || '').trim().toLowerCase() === studentId
    );

    if (matchingChildren.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Akses terhadap data siswa ini ditolak.',
          message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk data siswa ini.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (matchingChildren.length > 1) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ambiguitas data siswa: otorisasi ditolak.',
          message: 'Ambiguitas data siswa: otorisasi ditolak.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    const matchedChild = matchingChildren[0];

    // 8. Isolasi Batas Tenant (Tenant wajib berasal dari data anak yang terverifikasi)
    const childTenantId = String(matchedChild.tenantId || matchedChild.tenant_id || '').trim();

    if (!childTenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Akses lintas tenant tidak diizinkan.',
          message: 'Akses ditolak. Tenant siswa tidak valid atau kosong.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    const isTenantAccessible = accessibleTenants.some(
      t => String(t).trim().toLowerCase() === childTenantId.toLowerCase()
    );

    if (!isTenantAccessible) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Akses lintas tenant tidak diizinkan.',
          message: 'Akses ditolak. Tenant siswa tidak terdaftar dalam tenant yang terotorisasi.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (rawTenantId && String(rawTenantId).trim().toLowerCase() !== childTenantId.toLowerCase()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Akses lintas tenant tidak diizinkan.',
          message: 'Akses ditolak. Parameter tenant tidak sesuai dengan data siswa.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 9. Pengambilan Data Evaluasi via Supabase REST dengan Bearer Token Sesi Parent
    const supabaseUrl = getCleanSupabaseUrl(env) || (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    const anonKey = getSupabaseAnonKey(env) || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Konfigurasi server belum lengkap.',
          message: 'Konfigurasi server belum lengkap. Hubungi administrator.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let evaluationsList = [];
    const evalQuery = `${supabaseUrl}/rest/v1/academy_evaluations?student_id=eq.${encodeURIComponent(studentId)}&tenant_id=eq.${encodeURIComponent(childTenantId)}&order=created_at.desc`;

    const evalResp = await fetch(evalQuery, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!evalResp.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Terjadi gangguan pada layanan evaluasi.',
          message: 'Terjadi gangguan pada layanan evaluasi. Silakan coba beberapa saat lagi.'
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const rawEvals = await evalResp.json().catch(() => null);
    if (!Array.isArray(rawEvals)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Terjadi gangguan pada layanan evaluasi.',
          message: 'Terjadi gangguan pada layanan evaluasi. Silakan coba beberapa saat lagi.'
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    if (rawEvals.length > 0) {
      evaluationsList = rawEvals
        .filter(ev => {
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

    // 10. Ambil data prestasi atlet dari kolom tournaments di tabel students (Fail-Closed)
    let achievementsList = [];
    const studentInfo = {
      id: studentId,
      studentName: matchedChild.studentName || matchedChild.name || '',
      className: matchedChild.className || ''
    };

    const studentQuery = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&tenant_id=eq.${encodeURIComponent(childTenantId)}&select=tournaments,student_name,name,class_name`;

    const studentResp = await fetch(studentQuery, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!studentResp.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Terjadi gangguan pada layanan data siswa.',
          message: 'Terjadi gangguan pada layanan data siswa. Silakan coba beberapa saat lagi.'
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const studentData = await studentResp.json().catch(() => null);
    if (!Array.isArray(studentData)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Terjadi gangguan pada layanan data siswa.',
          message: 'Terjadi gangguan pada layanan data siswa. Silakan coba beberapa saat lagi.'
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const st = studentData[0];
    if (st) {
      studentInfo.studentName = st.student_name || st.name || studentInfo.studentName;
      studentInfo.className = st.class_name || studentInfo.className;

      const rawTournaments = Array.isArray(st.tournaments) ? st.tournaments : [];
      rawTournaments.forEach(t => {
        const achName = t.name || t.title || t.tournamentName;
        const achResult = t.result || t.rank || t.achievement;
        const achStatus = t.status || t.publication_status;
        if (achStatus) {
          const s = String(achStatus).toLowerCase().trim();
          if (!['published', 'approved'].includes(s)) return;
        }

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

    return new Response(
      JSON.stringify({
        success: true,
        evaluations: evaluationsList,
        latestEvaluation: evaluationsList.length > 0 ? evaluationsList[0] : null,
        achievements: achievementsList,
        student: studentInfo
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('[evaluations.js] Error processing athlete evaluations.');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Terjadi kesalahan internal pada server.',
        message: 'Terjadi kesalahan internal pada server.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
