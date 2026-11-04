/**
 * Cloudflare Pages Function: /api/portal/login (STAGE 7G.2A.2)
 * Edge-safe secure authentication endpoint for Portal Wali Murid.
 * Verifies Student ID, Parent Phone, PBKDF2 PIN, and/or Birth Date in backend.
 * Enforces fail-closed session management, strict CORS/CSRF, anti-enumeration, and PBKDF2 PIN migration.
 */

import {
  getGoogleAccessToken,
  parseFirestoreFields,
  generatePhoneVariations,
  normalizePhoneDigits,
  normalizeBirthDate,
  getCorsHeaders,
  verifyCsrf,
  verifyPinPbkdf2,
  migrateStudentPinToPbkdf2,
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

  // 1. Strict CSRF & Origin Validation
  if (!verifyCsrf(request, env)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Permintaan ditolak. Origin tidak diizinkan atau CSRF check gagal.'
      }),
      { status: 403, headers: corsHeaders }
    );
  }

  const clientIp = getClientIp(request);

  try {
    // 2. Parse request body
    const body = await request.json().catch(() => ({}));
    const { studentId, parentPhone, parentPin, birthDate } = body;

    const cleanStudentId = String(studentId || '').trim();
    const cleanParentPhone = String(parentPhone || '').trim();
    const cleanParentPin = String(parentPin || '').trim();
    const cleanBirthDate = normalizeBirthDate(birthDate);

    const inputPhoneDigits = normalizePhoneDigits(cleanParentPhone);

    // Rate Limiting Key: Hashed IP + Hashed Phone & Student ID
    const rateLimitKeyRaw = `${clientIp}_${inputPhoneDigits}_${cleanStudentId}`;
    const rateLimitKey = await hashString(rateLimitKeyRaw);

    // Generic Failure Response Helper (Prevents Student ID / Phone enumeration)
    const genericFailure = async (reasonCode) => {
      await recordAuditLog(context, {
        action: 'PORTAL_LOGIN_FAILED',
        studentId: cleanStudentId,
        phoneDigits: inputPhoneDigits,
        success: false,
        failureReason: reasonCode
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Kredensial tidak ditemukan atau verifikasi keamanan gagal.'
        }),
        { status: 401, headers: corsHeaders }
      );
    };

    // 3. Basic Input Presence Check
    if (!cleanStudentId || !cleanParentPhone) {
      return await genericFailure('missing_id_or_phone');
    }

    if (!cleanParentPin && !cleanBirthDate) {
      return await genericFailure('missing_pin_and_birthdate');
    }

    // 4. Fail-Closed Rate Limiting Check (Max 5 attempts per 15 minutes)
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
          message: 'Terlalu banyak percobaan login. Silakan coba beberapa saat lagi.'
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // 5. Fetch Google Service Account Access Token for Firestore REST API
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Firebase Service Account environment variables missing');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Terjadi kesalahan konfigurasi server. Silakan hubungi admin.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let accessToken = null;
    try {
      accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    } catch (tokenErr) {
      console.error('Google OAuth Token Exchange Error:', tokenErr.message);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Gagal melakukan autentikasi server. Silakan coba beberapa saat lagi.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    // 6. Query Firestore for candidate student record
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
      const exactMatches = [];

      for (const item of documents) {
        const docName = item.document.name || '';
        const docId = (docName.split('/').pop() || '').trim();
        const fields = parseFirestoreFields(item.document.fields);
        const doc = { id: docId, ...fields };

        // EXACT STUDENT DOCUMENT ID MATCHING (STAGE 7G.2A.6 — NO STARTSWITH BYPASS)
        if (doc.id.toLowerCase() === cleanStudentId.toLowerCase()) {
          exactMatches.push(doc);
        }
      }

      if (exactMatches.length === 1) {
        candidateDoc = exactMatches[0];
      } else if (exactMatches.length > 1) {
        console.warn(`Multiple student documents found matching exact ID ${cleanStudentId}`);
        return await genericFailure('multiple_candidate_docs');
      }
    } else {
      console.error(`Firestore query failed with HTTP status ${firestoreResponse.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Terjadi kesalahan jaringan database.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Direct fetch fallback if query returns empty (STRICT EXACT ID MATCHING)
    if (!candidateDoc && cleanStudentId.length >= 3) {
      try {
        const getDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/students/${encodeURIComponent(cleanStudentId)}`;
        const directDocResp = await fetch(getDocUrl, { method: 'GET', headers: reqHeaders });
        if (directDocResp.ok) {
          const docData = await directDocResp.json();
          const docId = ((docData.name || '').split('/').pop() || cleanStudentId).trim();
          const fields = parseFirestoreFields(docData.fields);
          const doc = { id: docId, ...fields };
          const docPhoneDigits = normalizePhoneDigits(fields.parentPhone || fields.phone);

          // EXACT MATCH REQUIREMENT (NO STARTSWITH)
          if (
            doc.id.toLowerCase() === cleanStudentId.toLowerCase() &&
            docPhoneDigits &&
            inputPhoneDigits &&
            docPhoneDigits === inputPhoneDigits
          ) {
            candidateDoc = doc;
          }
        }
      } catch (err) {
        console.error('Direct doc fetch error:', err.message);
      }
    }

    if (!candidateDoc) {
      return await genericFailure('student_not_found');
    }

    // 7. Verify Phone Digits Match Strictly & Tenant ID Presence
    const recordPhoneDigits = normalizePhoneDigits(candidateDoc.parentPhone || candidateDoc.phone);
    if (!recordPhoneDigits || recordPhoneDigits !== inputPhoneDigits) {
      return await genericFailure('phone_mismatch');
    }

    const candidateTenantId = String(candidateDoc.tenantId || candidateDoc.tenant_id || '').trim();
    if (!candidateTenantId) {
      console.warn(`Student document ${candidateDoc.id} has no tenantId/tenant_id`);
      return await genericFailure('no_tenant_id_on_record');
    }

    // 8. STRICT AUTHENTICATION FACTORS VERIFICATION (NO BYPASS!)
    const storedPinField = candidateDoc.parentPin ? 'parentPin' : (candidateDoc.parent_pin ? 'parent_pin' : (candidateDoc.pin ? 'pin' : 'parentPin'));
    const storedPin = String(candidateDoc.parentPin || candidateDoc.parent_pin || candidateDoc.pin || '').trim();
    const storedBirthDate = normalizeBirthDate(candidateDoc.birthDate || candidateDoc.birth_date);

    let pinMigrationNeeded = false;

    // A. NO STORED FACTORS AVAILABLE -> REJECT IMMEDIATELY!
    if (!storedPin && !storedBirthDate) {
      return await genericFailure('no_stored_factors');
    }

    // B. BOTH FACTORS STORED -> BOTH MUST BE PROVIDED AND BOTH MUST MATCH!
    if (storedPin && storedBirthDate) {
      if (!cleanParentPin || !cleanBirthDate) {
        return await genericFailure('both_factors_required');
      }
      const pinResult = await verifyPinPbkdf2(cleanParentPin, storedPin);
      const isBirthDateValid = cleanBirthDate === storedBirthDate;
      if (!pinResult.verified || !isBirthDateValid) {
        return await genericFailure('both_factors_failed');
      }
      if (pinResult.isLegacy) pinMigrationNeeded = true;
    }
    // C. ONLY PIN STORED -> PIN MUST BE PROVIDED AND MATCH
    else if (storedPin) {
      if (!cleanParentPin) {
        return await genericFailure('pin_required');
      }
      const pinResult = await verifyPinPbkdf2(cleanParentPin, storedPin);
      if (!pinResult.verified) {
        return await genericFailure('pin_failed');
      }
      if (pinResult.isLegacy) pinMigrationNeeded = true;
    }
    // D. ONLY BIRTH DATE STORED -> BIRTH DATE MUST BE PROVIDED AND MATCH
    else if (storedBirthDate) {
      if (!cleanBirthDate) {
        return await genericFailure('birthdate_required');
      }
      if (cleanBirthDate !== storedBirthDate) {
        return await genericFailure('birthdate_failed');
      }
    }

    // AUTOMATIC PIN MIGRATION: Upgrade Legacy Plain / SHA-256 PIN to PBKDF2 in background
    if (pinMigrationNeeded && cleanParentPin) {
      context.waitUntil(
        migrateStudentPinToPbkdf2(context, candidateDoc.id, cleanParentPin, storedPinField)
      );
    }

    // 9. Fail-Closed Session Creation
    const sanitizedStudent = sanitizeStudentProfile(candidateDoc);

    let sessionRes = null;
    try {
      sessionRes = await createPortalSession(context, {
        studentId: candidateDoc.id,
        tenantId: candidateTenantId,
        studentName: sanitizedStudent.studentName
      });
    } catch (sessionErr) {
      console.error('Portal Session Creation Fail-Closed:', sessionErr.message);
      await recordAuditLog(context, {
        action: 'PORTAL_LOGIN_FAILED',
        studentId: candidateDoc.id,
        phoneDigits: inputPhoneDigits,
        success: false,
        failureReason: 'session_store_failed'
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const isSecure = request.url.startsWith('https://') || env.ENVIRONMENT === 'production';
    const cookieHeaderVal = buildSessionCookie(sessionRes.sessionToken, 86400, isSecure);

    await recordAuditLog(context, {
      action: 'PORTAL_LOGIN_SUCCESS',
      studentId: candidateDoc.id,
      phoneDigits: inputPhoneDigits,
      success: true
    });

    // 10. Return Sanitized Student Profile & Session CSRF Token with Set-Cookie Header
    const responseHeaders = {
      ...corsHeaders,
      'Set-Cookie': cookieHeaderVal
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Autentikasi berhasil',
        student: sanitizedStudent,
        csrfToken: sessionRes.csrfToken,
        expiresAt: sessionRes.expiresAt
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    console.error('Portal Login API Error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

