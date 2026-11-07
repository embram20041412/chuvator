/**
 * Cloudflare Pages Function: POST /api/portal/invitation/claim
 * CHUVATOR Parent Portal V2.6.15 - Secure Intermediary Invitation Claim.
 * 
 * Validates the single-use intermediary claim token, enforces TTL,
 * ensures stored Supabase action link adheres to strict security standards,
 * executes one-time consumption from KV, and returns the verified action link
 * to initiate browser-driven activation without crawler pre-fetching hazards.
 */

import { getCorsHeaders, verifyCsrf } from '../_auth_v2.js';
import { validateSupabaseActionLink } from '../../tenant/parents/_invitation_helper.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(
    JSON.stringify({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Metode GET tidak diizinkan. Tautan aktivasi harus diklaim melalui permintaan POST.'
    }),
    {
      status: 405,
      headers: {
        ...corsHeaders,
        'Allow': 'POST, OPTIONS',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer'
      }
    }
  );
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  const securityHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer'
  };

  // 0. Strict CSRF & Origin Validation (Fail-Closed)
  // Ensures request comes from the allowed CHUVATOR origin.
  // Since this is a pre-session action, we verify Origin/Referer without a session-bound CSRF token.
  if (!verifyCsrf(request, env)) {
    return new Response(
      JSON.stringify({
        success: false,
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Permintaan ditolak karena masalah keamanan (Invalid Origin/Referer).'
      }),
      { status: 403, headers: securityHeaders }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawToken = body?.token;

    // 1. Strict Token Format & Entropy Validation
    if (!rawToken || typeof rawToken !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_CLAIM_TOKEN',
          message: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    const token = rawToken.trim();
    // Enforce 64-character lowercase hex string (256-bit entropy)
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_CLAIM_TOKEN',
          message: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    // 2. Resolve KV Binding
    const kvBinding = env.PORTAL_SESSIONS_KV || env.PORTAL_RATELIMIT_KV;
    if (!kvBinding) {
      console.error('[Claim Error] KV binding is not available in environment.');
      return new Response(
        JSON.stringify({
          success: false,
          code: 'SERVER_CONFIG_ERROR',
          message: 'Layanan aktivasi saat ini sedang tidak tersedia. Silakan hubungi admin sekolah.'
        }),
        { status: 500, headers: securityHeaders }
      );
    }

    const claimKey = `v2_invitation_claim:${token}`;

    // 3. Retrieve Claim Record from KV
    let rawRecord;
    try {
      rawRecord = await kvBinding.get(claimKey);
    } catch (_) {
      rawRecord = null;
    }

    if (!rawRecord) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'CLAIM_NOT_FOUND_OR_EXPIRED',
          message: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        }),
        { status: 410, headers: securityHeaders }
      );
    }

    let record;
    try {
      record = JSON.parse(rawRecord);
    } catch (_) {
      record = null;
    }

    if (!record || typeof record !== 'object' || !record.actionLink) {
      await kvBinding.delete(claimKey).catch(() => {});
      return new Response(
        JSON.stringify({
          success: false,
          code: 'CLAIM_DATA_CORRUPT',
          message: 'Tautan aktivasi tidak valid atau telah rusak.'
        }),
        { status: 410, headers: securityHeaders }
      );
    }

    // 4. Validate Stored TTL Expiry
    if (record.expiresAt) {
      const expiresTime = new Date(record.expiresAt).getTime();
      if (isNaN(expiresTime) || Date.now() > expiresTime) {
        await kvBinding.delete(claimKey).catch(() => {});
        return new Response(
          JSON.stringify({
            success: false,
            code: 'CLAIM_EXPIRED',
            message: 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
          }),
          { status: 410, headers: securityHeaders }
        );
      }
    }

    // 5. Strict Re-Validation of the Stored Supabase Action Link
    // Protects against open-redirects, protocol manipulation, origin spoofing, or malformed targets
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const appUrl = env.APP_URL || 'https://chuvator.pages.dev';

    const linkValidation = validateSupabaseActionLink(record.actionLink, {
      supabaseUrl,
      expectedType: record.type,
      appUrl
    });

    if (!linkValidation.valid) {
      // Invalidate poisoned/invalid record immediately
      await kvBinding.delete(claimKey).catch(() => {});
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_STORED_ACTION_LINK',
          message: 'Tautan aktivasi tidak memenuhi standar keamanan resmi.'
        }),
        { status: 500, headers: securityHeaders }
      );
    }

    // 6. One-Time Consumption / Invalidation
    // EVENTUAL CONSISTENCY WARNING:
    // Cloudflare KV get() followed by delete() is NOT an atomic operation.
    // In a distributed environment, two concurrent requests hitting different edge nodes
    // at the exact same millisecond might both successfully execute get() before the
    // first delete() propagates.
    //
    // NO atomic conditional claim storage (Durable Objects / D1) is currently available
    // in this environment. We prioritize fail-closed behavior and rely on Supabase Auth's
    // single-use OTP token as the final atomic invariant that prevents duplicate account activation.
    try {
      await kvBinding.delete(claimKey);
    } catch (deleteErr) {
      console.error('[Claim Error] KV delete failed during consumption:', deleteErr);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'CLAIM_CONSUMPTION_FAILED',
          message: 'Terjadi kesalahan sistem saat memproses aktivasi akun.'
        }),
        { status: 500, headers: securityHeaders }
      );
    }

    // 7. Successful Response returning only the verified actionLink (Zero PII / internals returned)
    return new Response(
      JSON.stringify({
        success: true,
        actionLink: record.actionLink
      }),
      { status: 200, headers: securityHeaders }
    );

  } catch (err) {
    console.error('[Claim Error] Unexpected exception in claim handler.');
    return new Response(
      JSON.stringify({
        success: false,
        code: 'INTERNAL_CLAIM_ERROR',
        message: 'Terjadi kesalahan sistem saat memproses aktivasi akun.'
      }),
      { status: 500, headers: securityHeaders }
    );
  }
}
