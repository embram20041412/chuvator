/**
 * Cloudflare Pages Function: GET /api/admin/backfill_kk_hmac/status
 * Secret preflight check and backfill infrastructure readiness.
 * STRICTLY READ-ONLY & ZERO SECRET EXPOSURE.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateSuperadmin, checkCryptoEngineStatus } from '../backfill_helpers.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // 1. Otorisasi Superadmin
    const auth = await validateSuperadmin(context);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: auth.message }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const secret = env.KK_HMAC_SECRET;
    const cryptoStatus = await checkCryptoEngineStatus(secret);

    // 2. Cek status database dan active lock lease jika Supabase tersedia
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

    let activeLock = false;
    let activeRunId = null;
    let infrastructureReady = false;

    if (supabaseUrl && serviceRoleKey) {
      // Periksa apakah tabel backfill_kk_runs sudah tersedia
      const checkRunsUrl = `${supabaseUrl}/rest/v1/backfill_kk_runs?status=in.("ACQUIRED","RUNNING")&lease_expires_at=gt.now()&select=run_id,started_at,lease_expires_at&limit=1`;
      const runsResp = await fetch(checkRunsUrl, {
        method: 'GET',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Accept': 'application/json'
        }
      }).catch(() => null);

      if (runsResp && runsResp.ok) {
        infrastructureReady = true;
        const activeRuns = await runsResp.json().catch(() => []);
        if (Array.isArray(activeRuns) && activeRuns.length > 0) {
          activeLock = true;
          activeRunId = activeRuns[0].run_id;
        }
      } else {
        infrastructureReady = false;
      }
    }

    const isProduction = env.ENVIRONMENT === 'production';

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          environment: env.ENVIRONMENT || 'development',
          isProduction,
          secretConfigured: cryptoStatus.configured,
          cryptoEngineReady: cryptoStatus.ready,
          hmacAlgorithm: cryptoStatus.algorithm,
          outputLength: cryptoStatus.outputLength,
          infrastructureReady,
          activeLeaseLocked: activeLock,
          activeRunId: activeRunId || null,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Status check error:', err.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada status check.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
