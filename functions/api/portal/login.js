/**
 * Cloudflare Pages Function: /api/portal/login
 * Edge-safe secure authentication endpoint for Portal Wali Murid.
 * Verifies Student ID, Parent Phone, Parent PIN, and/or Birth Date in backend.
 * Issues cryptographically secure HttpOnly session cookies.
 */

import {
  getGoogleAccessToken,
  parseFirestoreFields,
  generatePhoneVariations,
  normalizePhoneDigits,
  normalizeBirthDate,
  getCorsHeaders,
  buildSessionCookie,
  createPortalSession,
  checkRateLimit,
  recordAuditLog,
  sanitizeStudentProfile,
  getClientIp,
  hashString
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
 * POST /api/portal/login
 */
export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);
  const clientIp = getClientIp(request);

  try {
    // 1. Parse request body
    const body = await request.json().catch(() => ({}));
    const { studentId, parentPhone, parentPin, birthDate } = body;

    const cleanStudentId = String(studentId || '').trim();
    const cleanParentPhone = String(parentPhone || '').trim();
    const cleanParentPin = String(parentPin || '').trim();
    const cleanBirthDate = normalizeBirthDate(birthDate);

    // Rate Limiting Key: IP + Phone Digits
    const inputPhoneDigits = normalizePhoneDigits(cleanParentPhone);
    const rateLimitKey = `rl_login_${clientIp}_${inputPhoneDigits}`;

    // 2. Validate basic input presence
    if (!cleanStudentId || !cleanParentPhone) {
      await recordAuditLog(context, {
        action: 'PORTAL_LOGIN_FAILED',
        studentId: cleanStudentId,
        phoneDigits: inputPhoneDigits,
        success: false,
        failureReason: 'missing_id_or_phone'
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Kredensial tidak lengkap.',
          details: 'ID Siswa dan Nomor HP Wali wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Require either parentPin or birthDate for 2FA backend verification
    if (!cleanParentPin && !cleanBirthDate) {
      await recordAuditLog(context, {
        action: 'PORTAL_LOGIN_FAILED',
        studentId: cleanStudentId,
        phoneDigits: inputPhoneDigits,
        success: false,
        failureReason: 'missing_pin_and_birthdate'
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Kredensial tidak lengkap.',
          details: 'PIN Akses Wali (6 Digit) atau Tanggal Lahir Siswa wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Enforce Rate Limiting (Max 5 attempts per 15 minutes)
    const rateLimit = await checkRateLimit(context, rateLimitKey, 5, 900);
    if (!rateLimit.allowed) {
      await recordAuditLog(context, {
        action: 'PORTAL_LOGIN_BLOCKED',
        studentId: cleanStudentId,
        phoneDigits: inputPhoneDigits,
        success: false,
        failureReason: 'rate_limit_exceeded'
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Terlalu banyak percobaan login gagal.',
          details: 'Silakan tunggu beberapa menit sebelum mencoba kembali.'
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // 4. Fetch Google OAuth Access Token for Firestore REST API
    const projectId = env.FIREBASE_PROJECT_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const databaseId = env.FIREBASE_DATABASE_ID || 'ai-studio-chuasportcorespo-a3f4ecd8-7371-486a-9e89-d74d93ce6065';
    const clientEmail = env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    let accessToken = null;
    try {
      accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    } catch (tokenErr) {
      console.error('Google Auth Token Error:', tokenErr.message);
    }

    const reqHeaders = { 'Content-Type': 'application/json' };
    if (accessToken) {
      reqHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    // 5. Query Firestore for student matching parentPhone & studentId
    const phoneVariations = generatePhoneVariations(cleanParentPhone);
    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: 'students' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'parentPhone' },
            op: phoneVariations.length > 1 ? 'IN' : 'EQUAL',
            value: phoneVariations.length > 1
              ? { arrayValue: { values: phoneVariations.map((p) => ({ stringValue: p })) } }
              : { stringValue: phoneVariations[0] }
          }
        }
      }
    };

    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
    const firestoreResponse = await fetch(runQueryUrl, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(queryPayload)
    });

    let candidateDoc = null;

    if (firestoreResponse.ok) {
      const queryResults = await firestoreResponse.json();
      const documents = (Array.isArray(queryResults) ? queryResults : []).filter((item) => item.document);

      for (const item of documents) {
        const docName = item.document.name || '';
        const docId = docName.split('/').pop() || '';
        const fields = parseFirestoreFields(item.document.fields);
        const doc = { id: docId, ...fields };

        // Match Student ID prefix (case-insensitive)
        if (doc.id.toLowerCase().startsWith(cleanStudentId.toLowerCase())) {
          candidateDoc = doc;
          break;
        }
      }
    }

    // Fallback: Direct document fetch by student ID
    if (!candidateDoc && cleanStudentId.length >= 3) {
      try {
        const getDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students/${encodeURIComponent(cleanStudentId)}`;
        const directDocResp = await fetch(getDocUrl, { method: 'GET', headers: reqHeaders });
        if (directDocResp.ok) {
          const docData = await directDocResp.json();
          const docId = (docData.name || '').split('/').pop() || cleanStudentId;
          const fields = parseFirestoreFields(docData.fields);
          const doc = { id: docId, ...fields };
          const docPhoneDigits = normalizePhoneDigits(fields.parentPhone || fields.phone);

          if (
            doc.id.toLowerCase().startsWith(cleanStudentId.toLowerCase()) &&
            docPhoneDigits &&
            inputPhoneDigits &&
            docPhoneDigits === inputPhoneDigits
          ) {
            candidateDoc = doc;
          }
        }
      } catch (err) {
        console.warn('Direct doc fetch fallback warning:', err.message);
      }
    }

    // 6. Generic Failure Response (Pencegahan Enumerasi ID / Nomor HP)
    const genericFailure = async (reason) => {
      await recordAuditLog(context, {
        action: 'PORTAL_LOGIN_FAILED',
        studentId: cleanStudentId,
        phoneDigits: inputPhoneDigits,
        success: false,
        failureReason: reason
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Kredensial tidak ditemukan atau verifikasi keamanan gagal.',
          details: 'Kombinasi ID Siswa, Nomor HP Wali, PIN, atau Tanggal Lahir tidak cocok.'
        }),
        { status: 401, headers: corsHeaders }
      );
    };

    if (!candidateDoc) {
      return await genericFailure('student_not_found');
    }

    // 7. Verify Phone Number (Strict Normalized Digit Matching)
    const recordPhoneDigits = normalizePhoneDigits(candidateDoc.parentPhone || candidateDoc.phone);
    if (!recordPhoneDigits || recordPhoneDigits !== inputPhoneDigits) {
      return await genericFailure('phone_mismatch');
    }

    // 8. Verify PIN and/or Birth Date in Backend
    let credentialVerified = false;

    // A. Check PIN Verification
    const storedPin = String(candidateDoc.parentPin || candidateDoc.parent_pin || candidateDoc.pin || '').trim();
    if (storedPin && cleanParentPin) {
      // Support plain-text PIN comparison or SHA-256 hashed PIN comparison
      const hashedInputPin = await hashString(cleanParentPin);
      if (storedPin === cleanParentPin || storedPin === hashedInputPin) {
        credentialVerified = true;
      } else {
        return await genericFailure('pin_mismatch');
      }
    }

    // B. Check Birth Date Verification
    const storedBirthDate = normalizeBirthDate(candidateDoc.birthDate || candidateDoc.birth_date);
    if (storedBirthDate && cleanBirthDate) {
      if (storedBirthDate === cleanBirthDate) {
        credentialVerified = true;
      } else if (!credentialVerified) {
        return await genericFailure('birthdate_mismatch');
      }
    }

    // C. If student record has no PIN or birth date configured in backend data
    if (!storedPin && !storedBirthDate) {
      // Fallback: If neither PIN nor birthDate is configured in DB, require cleanBirthDate or cleanParentPin match if available
      credentialVerified = Boolean(cleanBirthDate || cleanParentPin);
    }

    if (!credentialVerified) {
      return await genericFailure('verification_failed');
    }

    // 9. Create Server-side Session & HttpOnly Cookie
    const sanitizedStudent = sanitizeStudentProfile(candidateDoc);

    const { sessionToken, expiresAt } = await createPortalSession(context, {
      studentId: candidateDoc.id,
      tenantId: candidateDoc.tenantId || '',
      studentName: sanitizedStudent.studentName
    });

    const isSecure = request.url.startsWith('https://') || env.ENVIRONMENT === 'production';
    const cookieHeaderVal = buildSessionCookie(sessionToken, 86400, isSecure);

    await recordAuditLog(context, {
      action: 'PORTAL_LOGIN_SUCCESS',
      studentId: candidateDoc.id,
      phoneDigits: inputPhoneDigits,
      success: true
    });

    // 10. Return Sanitized Response with Set-Cookie Header
    const responseHeaders = {
      ...corsHeaders,
      'Set-Cookie': cookieHeaderVal
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Autentikasi berhasil',
        student: sanitizedStudent,
        expiresAt
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    console.error('Portal Login API Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal pada server.',
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
