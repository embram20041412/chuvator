/**
 * Cloudflare Pages Function: /api/portal/announcements (FASE 3)
 * Edge-safe announcements endpoint for Portal Wali Murid.
 * Enforces session authentication, CSRF validation, and strict tenant/student isolation.
 * READ-ONLY: Fetches academy announcements for the student's tenant.
 */

import {
  getCorsHeaders,
  verifyCsrf,
  validatePortalV2Session
} from './_auth_v2.js';
import {
  getGoogleAccessToken,
  parseFirestoreFields,
  validatePortalSession
} from './_auth.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Session Validation (V2 first, fallback to V1)
    let session = null;
    let csrfToken = null;
    let authorizedChildren = [];

    const v2Result = await validatePortalV2Session(context);
    if (v2Result.valid) {
      session = v2Result.session;
      csrfToken = session.csrfToken;
      authorizedChildren = session.children || [];
    } else {
      const v1Result = await validatePortalSession(context);
      if (v1Result.valid) {
        session = v1Result.session;
        csrfToken = session.csrfToken;
        authorizedChildren = [{ studentId: session.studentId, tenantId: session.tenantId }];
      }
    }

    if (!session) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Strict CSRF Validation
    if (!verifyCsrf(request, env, csrfToken)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Permintaan ditolak. CSRF token atau origin tidak valid.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Request Body Student Authorization Check
    const body = await request.json().catch(() => ({}));
    const reqStudentId = String(body.studentId || '').trim();
    const reqTenantId = String(body.tenantId || '').trim();

    if (!reqStudentId || !reqTenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter studentId dan tenantId wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify reqStudentId belongs to authorized children
    const isAuthorized = authorizedChildren.some(child => {
      const cId = String(child.studentId || child.id || '').trim().toLowerCase();
      const tId = String(child.tenantId || '').trim().toLowerCase();
      return cId === reqStudentId.toLowerCase() && (tId === reqTenantId.toLowerCase() || !tId);
    });

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Akses ditolak. Sesi Anda tidak memiliki otorisasi untuk data siswa/tenant ini.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 4. Fetch Announcements from Database (Firestore REST or Supabase)
    const announcements = [];
    const projectId = env.FIREBASE_PROJECT_ID;
    const databaseId = env.FIREBASE_DATABASE_ID || projectId;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

    if (projectId && clientEmail && privateKey) {
      try {
        const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
        if (accessToken) {
          const reqHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          };

          const queryPayload = {
            structuredQuery: {
              from: [{ collectionId: 'announcements' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'tenantId' },
                  op: 'EQUAL',
                  value: { stringValue: reqTenantId }
                }
              },
              limit: 20
            }
          };

          const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
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
                  const docId = item.document.name.split('/').pop();
                  const parsed = parseFirestoreFields(item.document.fields);
                  const docTenant = String(parsed.tenantId || parsed.tenant_id || '').trim().toLowerCase();

                  if (docTenant === reqTenantId.toLowerCase()) {
                    announcements.push({
                      id: docId,
                      title: parsed.title || parsed.subject || 'Pengumuman Akademi',
                      content: parsed.content || parsed.message || parsed.body || '',
                      category: parsed.category || parsed.tag || 'Umum',
                      date: parsed.date || parsed.createdAt || parsed.publishDate || '',
                      isImportant: !!(parsed.isImportant || parsed.important || parsed.isPinned),
                      author: parsed.author || parsed.createdByName || 'Pengelola Akademi'
                    });
                  }
                }
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn('Gagal membaca database announcements:', dbErr.message);
      }
    }

    // Sort announcements by date descending
    announcements.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return new Response(
      JSON.stringify({
        success: true,
        announcements,
        total: announcements.length
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Announcements API error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal saat memuat pengumuman.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
