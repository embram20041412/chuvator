/**
 * Cloudflare Pages Function: /api/portal/submit_proof (FASE 4B)
 * Submits manual payment confirmation with receipt URL.
 * Sets verification_status = 'unverified' (WAITING_VERIFICATION / MENUNGGU VERIFIKASI).
 * DOES NOT mark payment as LUNAS or modify Financial Core ledgers directly.
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
          message: 'Permintaan ditolak. CSRF token atau origin tidak valid.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Request Parameters Validation
    const body = await request.json().catch(() => ({}));
    const studentId = String(body.studentId || '').trim();
    const tenantId = String(body.tenantId || '').trim();
    const sppPaymentId = String(body.sppPaymentId || body.paymentId || '').trim();
    const receiptUrl = String(body.receiptUrl || body.proofUrl || '').trim();
    const paymentMethod = String(body.paymentMethod || 'TRANSFER_BANK').toUpperCase();

    if (!studentId || !tenantId || !sppPaymentId || !receiptUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter studentId, tenantId, sppPaymentId, dan receiptUrl wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Verify Parent-Student Link Authorization
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

    // 5. Update Database Record to WAITING_VERIFICATION (unverified)
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

          const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/spp_payments/${encodeURIComponent(sppPaymentId)}?updateMask.fieldPaths=receipt_url&updateMask.fieldPaths=verification_status&updateMask.fieldPaths=submitted_at&updateMask.fieldPaths=payment_method&updateMask.fieldPaths=rejection_reason`;

          const payload = {
            fields: {
              receipt_url: { stringValue: receiptUrl },
              verification_status: { stringValue: 'unverified' },
              submitted_at: { stringValue: new Date().toISOString() },
              payment_method: { stringValue: paymentMethod },
              rejection_reason: { nullValue: null }
            }
          };

          const patchResp = await fetch(patchUrl, {
            method: 'PATCH',
            headers: reqHeaders,
            body: JSON.stringify(payload)
          });

          if (!patchResp.ok) {
            console.warn('Update spp_payments failed with status', patchResp.status);
          }
        }
      } catch (dbErr) {
        console.warn('Database update error in submit_proof.js:', dbErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Konfirmasi pembayaran berhasil dikirim. Status saat ini: MENUNGGU VERIFIKASI.',
        confirmation: {
          sppPaymentId,
          studentId,
          tenantId,
          status: 'MENUNGGU VERIFIKASI',
          verificationStatus: 'unverified',
          receiptUrl,
          submittedAt: new Date().toISOString()
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Submit proof error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal saat mengirim konfirmasi pembayaran.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
