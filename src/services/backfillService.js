import { supabase } from '../config/supabase';

/**
 * Service Helper: Menjalankan Audit & Analisis Dry-Run KK HMAC Backfill (100% Read-Only)
 * Endpoint: POST /api/admin/backfill_kk_hmac?dryRun=true
 * 
 * @param {Object} [options]
 * @param {string} [options.tenantId='global'] Filter cakupan tenant ('global' atau UUID tenant spesifik)
 * @returns {Promise<Object>} Data hasil analisis dry-run
 */
export async function runKkHmacDryRun(options = {}) {
  const tenantId = options.tenantId || 'global';

  let token = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData?.session?.access_token || null;
  } catch (err) {
    console.warn('[runKkHmacDryRun] Gagal mendapatkan token sesi Supabase:', err);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const queryParams = new URLSearchParams({
    dryRun: 'true'
  });

  if (tenantId && tenantId !== 'global') {
    queryParams.append('tenantId', tenantId);
  }

  const response = await fetch(`/api/admin/backfill_kk_hmac?${queryParams.toString()}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dryRun: true, tenantId })
  });

  const resJson = await response.json().catch(() => ({}));

  if (!response.ok || !resJson.success) {
    const errorMsg = resJson.message || `Gagal menjalankan dry-run analisis (HTTP ${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = resJson.code || 'DRY_RUN_API_ERROR';
    throw error;
  }

  return resJson;
}
