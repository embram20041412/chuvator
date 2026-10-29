/**
 * Cloudflare Pages Function: /api/portal/evaluations
 * Edge-safe athlete evaluations and achievements endpoint for Portal Wali Murid using Firebase Firestore REST API.
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
 * POST /api/portal/evaluations
 * Accepts { studentId, tenantId }
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
    let { studentId, tenantId } = body;

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

    // 2. Ambil data Siswa untuk membaca tournaments/prestasi dan tenantId
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
      console.warn('Failed to fetch student document:', sErr.message);
    }

    // 3. Ekstrak Prestasi / Tournaments dari Dokumen Siswa
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

    // 4. Kueri Koleksi Evaluasi Pelatih (academy_evaluations & evaluations)
    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
    let evaluations = [];

    // Helper function to query a collection by studentId
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

    // Coba kueri academy_evaluations terlebih dahulu
    evaluations = await queryEvaluationsCollection('academy_evaluations');

    // Jika kosong, coba kueri alternatif koleksi 'evaluations'
    if (evaluations.length === 0) {
      const fallbackEvals = await queryEvaluationsCollection('evaluations');
      if (fallbackEvals.length > 0) {
        evaluations = fallbackEvals;
      }
    }

    // Normalisasi dan standardisasi data evaluasi
    const normalizedEvaluations = evaluations.map((ev) => {
      // Normalisasi skor pilar (Teknik, Fisik, Mental, Taktik)
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

    // Urutkan evaluasi dari yang paling baru
    normalizedEvaluations.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // Urutkan prestasi dari yang terbaru
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
    console.error('Unhandled evaluations API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Gagal memproses data evaluasi atlet.',
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
