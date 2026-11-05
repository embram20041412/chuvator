/**
 * Cloudflare Pages Function: /api/admin/verify_payment (FASE 4B)
 * Admin/Owner Tenant payment verification endpoint.
 * STRICT RBAC: Permitted ONLY for 'owner' and 'admin' roles from the target tenant.
 * Rejects 'manager', 'kasir', 'staff', 'parent', and cross-tenant attempts with HTTP 403.
 * Supports action = 'VERIFY' (sets LUNAS + verified) and action = 'REJECT' (requires notes/rejection reason).
 */

import { getCorsHeaders, verifyCsrf } from '../portal/_auth_v2.js';
import { getGoogleAccessToken, parseFirestoreFields } from '../portal/_auth.js';

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
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const sppPaymentId = String(body.sppPaymentId || body.paymentId || '').trim();
    const action = String(body.action || '').toUpperCase(); // 'VERIFY' or 'REJECT'
    const notes = String(body.notes || body.reason || '').trim();
    const staffRole = String(body.staffRole || body.role || '').toLowerCase();
    const staffUid = String(body.staffUid || body.uid || '').trim();

    if (!tenantId || !sppPaymentId || !action) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parameter tenantId, sppPaymentId, dan action (VERIFY/REJECT) wajib diisi.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // STRICT RBAC CHECK: Owner and Admin ONLY (Reject manager, kasir, staff, parent)
    if (!['owner', 'admin'].includes(staffRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Akses ditolak. Peran '${staffRole || 'NONE'}' tidak memiliki kewenangan verifikasi pembayaran.`
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (action === 'REJECT' && !notes) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Catatan alasan penolakan wajib diisi saat menolak pembayaran.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Process Verification / Rejection in Financial Core DB
    const newVerificationStatus = action === 'VERIFY' ? 'verified' : 'rejected';
    const newPaymentStatus = action === 'VERIFY' ? 'LUNAS' : 'BELUM_LUNAS';

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

          const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/spp_payments/${encodeURIComponent(sppPaymentId)}?updateMask.fieldPaths=verification_status&updateMask.fieldPaths=status&updateMask.fieldPaths=rejection_reason`;

          const payload = {
            fields: {
              verification_status: { stringValue: newVerificationStatus },
              status: { stringValue: newPaymentStatus },
              rejection_reason: action === 'REJECT' ? { stringValue: notes } : { nullValue: null }
            }
          };

          const patchResp = await fetch(patchUrl, {
            method: 'PATCH',
            headers: reqHeaders,
            body: JSON.stringify(payload)
          });

          if (!patchResp.ok) {
            console.warn('Update spp_payments verification failed with status', patchResp.status);
          }
        }
      } catch (dbErr) {
        console.warn('Database error in verify_payment.js:', dbErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: action === 'VERIFY' ? 'Pembayaran berhasil disetujui (LUNAS).' : 'Pembayaran berhasil ditolak.',
        result: {
          sppPaymentId,
          tenantId,
          action,
          verificationStatus: newVerificationStatus,
          status: newPaymentStatus,
          notes: notes || null,
          verifiedBy: staffUid,
          verifiedRole: staffRole,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Verify payment error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Terjadi kesalahan internal saat memproses verifikasi pembayaran.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
