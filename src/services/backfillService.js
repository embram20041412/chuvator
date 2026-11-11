import { supabase } from '../config/supabase';

const TENANT_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidBackfillTenantId(tenantId) {
  if (typeof tenantId !== 'string') return false;
  const trimmed = tenantId.trim();
  if (!trimmed || trimmed.toLowerCase() === 'global') return false;
  return TENANT_UUID_REGEX.test(trimmed);
}

function assertValidTenantId(tenantId, callerName) {
  const raw = typeof tenantId === 'string' ? tenantId.trim() : '';
  if (!raw) {
    const error = new Error(`[${callerName}] Parameter tenantId wajib disertakan.`);
    error.status = 400;
    error.code = 'MISSING_TENANT_ID';
    throw error;
  }
  if (raw.toLowerCase() === 'global') {
    const error = new Error(`[${callerName}] Scope 'global' tidak diizinkan pada layanan operasional tenant.`);
    error.status = 403;
    error.code = 'FORBIDDEN_GLOBAL_SCOPE';
    throw error;
  }
  if (!TENANT_UUID_REGEX.test(raw)) {
    const error = new Error(`[${callerName}] Format tenantId tidak valid (wajib UUID).`);
    error.status = 400;
    error.code = 'INVALID_TENANT_ID';
    throw error;
  }
  return raw;
}

/**
 * Service Helper: Menjalankan Audit & Analisis Dry-Run KK HMAC Backfill (100% Read-Only)
 * Endpoint: POST /api/admin/backfill_kk_hmac?dryRun=true
 * 
 * @param {Object} options
 * @param {string} options.tenantId UUID tenant spesifik yang valid (wajib, menolak 'global')
 * @returns {Promise<Object>} Data hasil analisis dry-run
 */
export async function runKkHmacDryRun(options = {}) {
  const tenantId = assertValidTenantId(options?.tenantId, 'runKkHmacDryRun');

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
    dryRun: 'true',
    tenantId
  });

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

/**
 * Service Helper: Menjalankan Eksekusi Controlled Backfill KK HMAC (Memerlukan Konfirmasi Eksplisit)
 * Endpoint: POST /api/admin/backfill_kk_hmac (dryRun=false)
 * 
 * @param {Object} options
 * @param {string} options.tenantId UUID Tenant terdaftar (wajib, menolak 'global')
 * @param {string} [options.runId] ID siklus run aktif jika melakukan resume
 * @param {string} [options.leaseToken] Fencing token lease aktif
 * @param {number} [options.batchSize=50] Batas ukuran batch
 * @returns {Promise<Object>} Data hasil eksekusi batch
 */
export async function executeKkHmacBackfill(options = {}) {
  const tenantId = assertValidTenantId(options?.tenantId, 'executeKkHmacBackfill');

  let token = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData?.session?.access_token || null;
  } catch (err) {
    console.warn('[executeKkHmacBackfill] Gagal mendapatkan token sesi Supabase:', err);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const bodyPayload = {
    dryRun: false,
    execute: true,
    tenantId,
    runId: options.runId || null,
    leaseToken: options.leaseToken || null,
    batchSize: options.batchSize || 50
  };

  const response = await fetch('/api/admin/backfill_kk_hmac', {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload)
  });

  const resJson = await response.json().catch(() => ({}));

  if (!response.ok || !resJson.success) {
    const errorMsg = resJson.message || `Gagal mengeksekusi backfill KK HMAC (HTTP ${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = resJson.code || 'EXECUTION_API_ERROR';
    error.data = resJson.data || null;
    error.batchStatus = resJson.status || null;
    throw error;
  }

  return resJson;
}
