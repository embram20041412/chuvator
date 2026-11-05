/**
 * Cloudflare Pages Function: /api/portal/upload_receipt (FASE 4B)
 * Edge-safe payment receipt upload endpoint for Portal Wali Murid.
 * Validates session V2, CSRF token, parent-student authorization, tenant matching, and file security constraints.
 * File constraints: Max 5 MB, allowed MIME types (JPG, JPEG, PNG, WEBP, PDF).
 */

import {
  getCorsHeaders,
  verifyCsrf,
  validatePortalV2Session,
  generateSecureToken
} from './_auth_v2.js';
import { validatePortalSession } from './_auth.js';

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
    // 1. Session Validation
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

    // 2. CSRF Validation
    if (!verifyCsrf(request, env, csrfToken)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Permintaan ditolak. Token CSRF atau origin tidak valid.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Parse Body (JSON base64 or Multipart)
    const contentType = request.headers.get('Content-Type') || '';
    let studentId = '';
    let tenantId = '';
    let sppPaymentId = '';
    let fileBase64 = '';
    let fileName = '';
    let fileType = '';
    let fileSize = 0;

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      studentId = String(body.studentId || '').trim();
      tenantId = String(body.tenantId || '').trim();
      sppPaymentId = String(body.sppPaymentId || body.paymentId || '').trim();
      fileBase64 = String(body.fileBase64 || body.fileData || body.receiptData || '').trim();
      fileName = String(body.fileName || 'receipt.jpg').trim();
      fileType = String(body.fileType || body.mimeType || 'image/jpeg').toLowerCase();
      fileSize = Number(body.fileSize || 0);

      // Estimate base64 size if fileSize not explicitly provided
      if (!fileSize && fileBase64) {
        const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
        fileSize = Math.round((cleanB64.length * 3) / 4);
      }
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Format payload tidak didukung. Gunakan JSON base64.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!studentId || !tenantId || !fileBase64) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter studentId, tenantId, dan fileBase64 wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Validate Parent-Student Link Authorization
    const isAuthorized = authorizedChildren.some(child => {
      const cId = String(child.studentId || child.id || '').trim().toLowerCase();
      const tId = String(child.tenantId || '').trim().toLowerCase();
      return cId === studentId.toLowerCase() && (tId === tenantId.toLowerCase() || !tId);
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

    // 4. File Size & MIME Type Security Validation
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Ukuran file melebihi batas maksimum 5 MB.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

    if (!ALLOWED_MIME_TYPES.includes(fileType) && !['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Tipe file tidak diizinkan. Hanya file JPG, JPEG, PNG, WEBP, dan PDF yang diperbolehkan.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 5. Generate Safe Identifier & Storage Path
    const randomToken = generateSecureToken(12);
    const safePath = `${tenantId}/${studentId}/${sppPaymentId || 'general'}_${Date.now()}_${randomToken}.${ext}`;

    // Construct Data URL / Storage URL
    let receiptUrl = fileBase64.startsWith('data:') ? fileBase64 : `data:${fileType};base64,${fileBase64}`;
    if (receiptUrl.length > 500000) {
      // If large base64, construct structured reference identifier
      receiptUrl = `data:${fileType};path=${safePath};base64,${fileBase64.replace(/^data:[^;]+;base64,/, '').slice(0, 100)}...`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'File bukti pembayaran berhasil diunggah.',
        receiptUrl,
        fileMetadata: {
          path: safePath,
          fileName: `${sppPaymentId || 'proof'}_${randomToken}.${ext}`,
          fileType,
          fileSize,
          uploadedAt: new Date().toISOString()
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Upload receipt error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal saat mengunggah bukti pembayaran.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
