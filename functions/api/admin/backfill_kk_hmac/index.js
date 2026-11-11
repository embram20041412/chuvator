/**
 * Cloudflare Pages Function: POST /api/admin/backfill_kk_hmac
 * Execution & Dry-Run Endpoint for Student KK_HMAC Backfill (Phase 4.5.2.2.3 Hardened).
 * Protected: Tenant Owner & Admin ONLY (Superadmin rejected on operational endpoint).
 * Fail-Closed on missing KK_HMAC_SECRET, invalid/global tenantId, RPC failures, and lease loss.
 * Enforces Distributed Fencing Lease Tokens, Persistent Database Cursors, and Tenant Binding.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { normalizeKK, computeHMAC } from '../../tenant/_auth_staff.js';
import { validateBackfillAdmin, performDryRunAnalysis, isValidTenantUuid } from '../backfill_helpers.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const url = new URL(request.url);
    let body = {};
    try {
      const rawText = await request.text();
      body = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      body = {};
    }

    // 1. Otorisasi Peran Operasional Tenant (Hanya Owner & Admin Tenant; Superadmin Ditolak)
    const auth = await validateBackfillAdmin(context);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({
          success: false,
          code: auth.code || 'UNAUTHORIZED',
          message: auth.message
        }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const userRole = String(auth.user?.role || '').trim().toLowerCase();
    if (userRole === 'superadmin') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'FORBIDDEN_SUPERADMIN_ROLE',
          message: 'Akses ditolak. Platform Superadmin tidak diizinkan menjalankan endpoint operasional backfill tenant.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (userRole !== 'owner' && userRole !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'FORBIDDEN_ROLE',
          message: 'Akses ditolak. Endpoint operasional hanya diizinkan untuk Owner dan Admin tenant.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 2. Validasi Tenant Server-Authoritative (Fail-Closed terhadap kosong, global, atau non-UUID)
    const serverTenantId = typeof auth.user?.tenantId === 'string' ? auth.user.tenantId.trim() : '';
    if (!serverTenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'MISSING_TENANT_CONTEXT',
          message: 'Akses ditolak. Konteks tenant pengguna tidak tersedia.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (serverTenantId.toLowerCase() === 'global') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'FORBIDDEN_GLOBAL_SCOPE',
          message: 'Akses ditolak. Scope global tidak diizinkan pada jalur operasional tenant.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (!isValidTenantUuid(serverTenantId)) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_TENANT_ID',
          message: 'Akses ditolak. Identitas tenant pengguna bukan format UUID yang valid.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Validasi parameter tenantId dari client (jika dikirim via body atau query string)
    const clientTenantInputs = [];
    if (Object.prototype.hasOwnProperty.call(body, 'tenantId')) {
      clientTenantInputs.push(body.tenantId);
    }
    if (url.searchParams.has('tenantId')) {
      clientTenantInputs.push(url.searchParams.get('tenantId'));
    }

    for (const rawInput of clientTenantInputs) {
      const strInput = typeof rawInput === 'string' ? rawInput.trim() : '';
      if (!strInput) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'INVALID_TENANT_ID',
            message: 'Parameter tenantId tidak boleh kosong.'
          }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (strInput.toLowerCase() === 'global') {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'FORBIDDEN_GLOBAL_SCOPE',
            message: 'Akses ditolak. Scope global dilarang pada endpoint operasional tenant.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }
      if (!isValidTenantUuid(strInput)) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'INVALID_TENANT_ID',
            message: 'Format parameter tenantId tidak valid (wajib UUID).'
          }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (strInput.toLowerCase() !== serverTenantId.toLowerCase()) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'FORBIDDEN_TENANT_SCOPE',
            message: 'Akses ditolak. Manipulasi tenant scope ditolak. Anda hanya diizinkan mengakses data tenant terdaftar Anda.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // Tenant ID selalu ditetapkan dari identitas server yang telah diverifikasi
    const authoritativeTenantId = serverTenantId;

    // 3. Validasi Secret & Service Role: Fail-Closed
    const secret = env.KK_HMAC_SECRET;
    if (!secret) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'SECRET_NOT_CONFIGURED',
          message: 'Konfigurasi keamanan (KK_HMAC_SECRET) belum tersedia di server. Operasi dibatalkan secara aman.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'SERVICE_ROLE_NOT_CONFIGURED',
          message: 'Konfigurasi server database (SERVICE_ROLE_KEY) tidak lengkap.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const isDryRun = url.searchParams.get('dryRun') === 'true' || body.dryRun === true;

    // -------------------------------------------------------------------------
    // 4. MODE DRY-RUN: 100% Read-Only, Zero INSERT, Zero UPDATE, Zero Locks, Zero RPC
    // -------------------------------------------------------------------------
    if (isDryRun) {
      const analysis = await performDryRunAnalysis(supabaseUrl, serviceRoleKey, secret, authoritativeTenantId);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'DRY_RUN',
          tenantId: authoritativeTenantId,
          message: 'Analisis simulasi selesai (100% read-only, tanpa perubahan database).',
          data: analysis
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // 5. ACTIVE EXECUTION PRECONDITIONS
    // -------------------------------------------------------------------------
    // DILARANG menerima kursor arbitrer dari client. Kursor harus dibaca dari DB.
    if (
      body.cursor !== undefined ||
      body.lastCursor !== undefined ||
      url.searchParams.has('cursor') ||
      url.searchParams.has('lastCursor')
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'CLIENT_CURSOR_REJECTED',
          message: 'Kursor klien ditolak. Siklus resume harus membaca kursor secara eksklusif dari database (last_cursor).'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Mandatory check: All active execution requests (new or resume) MUST have explicit execute: true
    if (body.execute !== true) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DRY_RUN_ONLY_MODE',
          message: 'Konfirmasi eksekusi (execute: true) wajib disertakan. Permintaan tanpa konfirmasi ditolak dalam mode Dry-Run READ-ONLY.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const batchSize = Math.min(Math.max(Number(body.batchSize) || 50, 1), 50);
    const requestRunId = body.runId ? String(body.runId).trim() : null;
    let runId = requestRunId;
    let leaseToken = body.leaseToken ? String(body.leaseToken).trim() : null;
    const runTenantId = authoritativeTenantId;
    let dbCursor = null;
    let leaseRecovered = false;

    if (requestRunId) {
      // -----------------------------------------------------------------------
      // RESUME EXISTING RUN: VALIDATE TENANT BINDING, STATUS, LEASE & DB CURSOR
      // -----------------------------------------------------------------------
      const getRunUrl = `${supabaseUrl}/rest/v1/backfill_kk_runs?run_id=eq.${encodeURIComponent(requestRunId)}&select=run_id,tenant_id,status,lease_token,lease_expires_at,last_cursor`;
      const runResp = await fetch(getRunUrl, {
        method: 'GET',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Accept': 'application/json'
        }
      }).catch(() => null);

      if (!runResp || !runResp.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'RUN_NOT_FOUND',
            message: 'Siklus run tidak ditemukan di database.'
          }),
          { status: 404, headers: corsHeaders }
        );
      }

      const runs = await runResp.json().catch(() => []);
      if (!Array.isArray(runs) || runs.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'RUN_NOT_FOUND',
            message: 'Siklus run tidak ditemukan di database.'
          }),
          { status: 404, headers: corsHeaders }
        );
      }

      const existingRun = runs[0];
      const existingRunTenant = typeof existingRun.tenant_id === 'string' ? existingRun.tenant_id.trim() : '';

      // Validasi Tenant Immutability & Kepemilikan Run
      if (!isValidTenantUuid(existingRunTenant) || existingRunTenant.toLowerCase() !== authoritativeTenantId.toLowerCase()) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'TENANT_MISMATCH_ON_RESUME',
            message: 'Akses ditolak. Siklus run ini terikat secara permanen pada tenant lain dan tidak dapat dilanjutkan oleh sesi Anda.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      if (existingRun.status !== 'RUNNING' && existingRun.status !== 'ACQUIRED') {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'RUN_NOT_ACTIVE',
            message: `Siklus run tidak dapat dilanjutkan karena berstatus: ${existingRun.status}.`
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Validasi Fencing Lease Token Wajib Sebelum Operasi Apapun (Recovery maupun Normal Continuation)
      if (!leaseToken) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'MISSING_LEASE_TOKEN',
            message: 'Lease token wajib disertakan untuk melanjutkan (resume) siklus run aktif.'
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      if (leaseToken !== String(existingRun.lease_token || '').trim()) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'FENCING_TOKEN_STALE',
            message: 'Lease token yang disertakan telah usang atau tidak cocok. Worker lain telah mengambil alih run ini.'
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Validasi Eksplisit Expiry Timestamp (Fail-Closed jika null, kosong, atau invalid Date)
      const rawExpiresAt = existingRun.lease_expires_at;
      const expiresAtMs = rawExpiresAt ? new Date(rawExpiresAt).getTime() : NaN;

      if (!rawExpiresAt || isNaN(expiresAtMs)) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'LEASE_EXPIRY_INVALID',
            message: 'Waktu kedaluwarsa lease pada database tidak valid, kosong, atau bernilai null.'
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Waktu server konsisten (Asumsi clock skew tolerance: NTP server disinkronkan)
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const isLeaseExpired = expiresAtMs <= nowMs;

      if (isLeaseExpired) {
        // ATOMIC COMPARE-AND-SWAP (CAS) LEASE RECOVERY
        // Single atomic PATCH filtering exact run_id, tenant_id, status IN ('RUNNING','ACQUIRED'),
        // exact old lease_token, AND exact old lease_expires_at timestamp (plus lease_expires_at <= nowIso)
        const newLeaseToken = crypto.randomUUID();
        const newLeaseExpiresAt = new Date(nowMs + 120_000).toISOString();

        const patchCasUrl = `${supabaseUrl}/rest/v1/backfill_kk_runs?run_id=eq.${encodeURIComponent(existingRun.run_id)}&tenant_id=eq.${encodeURIComponent(authoritativeTenantId)}&status=in.("RUNNING","ACQUIRED")&lease_token=eq.${encodeURIComponent(existingRun.lease_token)}&lease_expires_at=eq.${encodeURIComponent(existingRun.lease_expires_at)}&lease_expires_at=lte.${encodeURIComponent(nowIso)}`;

        const patchResp = await fetch(patchCasUrl, {
          method: 'PATCH',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            lease_token: newLeaseToken,
            status: 'RUNNING',
            heartbeat_at: nowIso,
            lease_expires_at: newLeaseExpiresAt,
            updated_at: nowIso
          })
        }).catch(() => null);

        if (!patchResp || !patchResp.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              code: 'LEASE_RECOVERY_FAILED',
              message: 'Gagal melakukan pemulihan lease pada database.',
              runId: existingRun.run_id,
              leaseToken: existingRun.lease_token,
              tenantId: authoritativeTenantId,
              lastCursor: existingRun.last_cursor || null,
              leaseRecovered: false
            }),
            { status: 500, headers: corsHeaders }
          );
        }

        const patchedRows = await patchResp.json().catch(() => []);
        if (!Array.isArray(patchedRows) || patchedRows.length !== 1) {
          // CAS matched 0 rows -> another worker modified lease, rotated token, or updated expiry!
          return new Response(
            JSON.stringify({
              success: false,
              code: 'FENCING_TOKEN_STALE',
              message: 'Pemulihan lease gagal karena lock atau timestamp expiry telah diubah oleh worker lain.'
            }),
            { status: 409, headers: corsHeaders }
          );
        }

        const recoveredRun = patchedRows[0];
        runId = recoveredRun.run_id;
        leaseToken = recoveredRun.lease_token;
        dbCursor = recoveredRun.last_cursor || null; // Cursor resmi dibaca dari hasil CAS (patchedRows[0].last_cursor)
        leaseRecovered = true;
      } else {
        runId = existingRun.run_id;
        leaseToken = existingRun.lease_token;
        dbCursor = existingRun.last_cursor || null;
        leaseRecovered = false;
      }
    } else {
      // -----------------------------------------------------------------------
      // INISIASI RUN BARU DENGAN LEASE FENCING TOKEN & TENANT TERIKAT
      // -----------------------------------------------------------------------
      const leaseRpcUrl = `${supabaseUrl}/rest/v1/rpc/acquire_backfill_kk_lease`;
      const leaseResp = await fetch(leaseRpcUrl, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_tenant_id: runTenantId,
          p_created_by: auth.user.email,
          p_lease_seconds: 120
        })
      }).catch(() => null);

      if (!leaseResp || !leaseResp.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'AUDIT_INFRASTRUCTURE_PENDING',
            message: 'Infrastruktur tabel public.backfill_kk_runs dan RPC belum tersedia di database.'
          }),
          { status: 503, headers: corsHeaders }
        );
      }

      const leaseData = await leaseResp.json().catch(() => ({}));
      if (!leaseData || leaseData.success !== true || !leaseData.run_id || !leaseData.lease_token) {
        return new Response(
          JSON.stringify({
            success: false,
            code: leaseData?.code || 'CONCURRENCY_LOCKED',
            message: leaseData?.message || 'Terdapat proses backfill yang sedang berjalan pada tenant ini.'
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      runId = leaseData.run_id;
      leaseToken = leaseData.lease_token;
      dbCursor = null;
    }

    // -------------------------------------------------------------------------
    // 6. BACA BATCH SISWA MENGGUNAKAN KEYSET PAGINATION & KURSOR RESMI DB
    // -------------------------------------------------------------------------
    let fetchUrl = `${supabaseUrl}/rest/v1/students?select=id,tenant_id,no_kk,kk_hmac,kk_last4&tenant_id=eq.${encodeURIComponent(runTenantId)}&order=id.asc&limit=${batchSize}`;
    if (dbCursor) {
      fetchUrl += `&id=gt.${encodeURIComponent(dbCursor)}`;
    }

    const studentsResp = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    }).catch(() => null);

    if (!studentsResp || !studentsResp.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'STUDENT_BATCH_FETCH_FAILED',
          message: 'Gagal mengambil data siswa untuk eksekusi batch.',
          runId,
          leaseToken,
          tenantId: runTenantId,
          lastCursor: dbCursor,
          leaseRecovered: Boolean(leaseRecovered),
          data: { runId, leaseToken, tenantId: runTenantId, lastCursor: dbCursor, leaseRecovered: Boolean(leaseRecovered) }
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const rawStudentsBatch = await studentsResp.json().catch(() => null);
    if (!Array.isArray(rawStudentsBatch)) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_STUDENT_BATCH_RESPONSE',
          message: 'Format data batch siswa dari database tidak valid.',
          runId,
          leaseToken,
          tenantId: runTenantId,
          lastCursor: dbCursor,
          leaseRecovered: Boolean(leaseRecovered),
          data: { runId, leaseToken, tenantId: runTenantId, lastCursor: dbCursor, leaseRecovered: Boolean(leaseRecovered) }
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const studentsBatch = rawStudentsBatch;
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let lastProcessedId = dbCursor;
    let batchError = null;
    let haltedMidBatch = false;

    const invokeRecordSkip = async (studentId, reason, currHmac, currLast4) => {
      const skipResp = await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_run_id: runId,
          p_lease_token: leaseToken,
          p_batch_id: 1,
          p_student_id: studentId,
          p_tenant_id: runTenantId,
          p_reason: reason,
          p_old_hmac: currHmac,
          p_old_last4: currLast4
        })
      }).catch(() => null);

      if (!skipResp || !skipResp.ok) {
        return {
          ok: false,
          code: 'SKIP_RPC_HTTP_ERROR',
          message: 'Gagal menghubungi RPC record_backfill_kk_skip.'
        };
      }

      const skipJson = await skipResp.json().catch(() => null);
      if (!skipJson || skipJson.success !== true) {
        return {
          ok: false,
          code: skipJson?.code || 'SKIP_RPC_FAILED',
          message: skipJson?.message || 'RPC record_backfill_kk_skip gagal mencatat skip.'
        };
      }

      return { ok: true, code: skipJson.code || 'SKIPPED_RECORDED' };
    };

    const invokeApplyRecord = async (studentId, expectedOldHmac, expectedOldLast4, newHmac, newLast4, expectedNoKk) => {
      const applyResp = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_backfill_kk_atomic_record`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_run_id: runId,
          p_lease_token: leaseToken,
          p_batch_id: 1,
          p_student_id: studentId,
          p_tenant_id: runTenantId,
          p_expected_old_hmac: expectedOldHmac,
          p_expected_old_last4: expectedOldLast4,
          p_new_hmac: newHmac,
          p_new_last4: newLast4,
          p_expected_no_kk: expectedNoKk
        })
      }).catch(() => null);

      if (!applyResp || !applyResp.ok) {
        return {
          ok: false,
          code: 'APPLY_RPC_HTTP_ERROR',
          message: 'Gagal menghubungi RPC apply_backfill_kk_atomic_record.'
        };
      }

      const applyJson = await applyResp.json().catch(() => null);
      if (!applyJson || applyJson.success !== true) {
        return {
          ok: false,
          code: applyJson?.code || 'APPLY_RPC_FAILED',
          message: applyJson?.message || 'RPC apply_backfill_kk_atomic_record gagal memperbarui record.'
        };
      }

      return { ok: true, code: applyJson.code || 'UPDATED' };
    };

    // -------------------------------------------------------------------------
    // 7. PROSES SETIAP SISWA SECARA BERURUTAN (FAIL-CLOSED CURSOR PROGRESSION)
    // Jika satu record gagal (apply maupun skip), hentikan loop segera tanpa
    // memajukan lastProcessedId agar kursor DB tidak melompati record yang gagal.
    // -------------------------------------------------------------------------
    for (const student of studentsBatch) {
      const studentId = student.id;
      const rowTenantId = typeof student.tenant_id === 'string' ? student.tenant_id.trim() : '';

      if (!rowTenantId || rowTenantId.toLowerCase() !== runTenantId.toLowerCase()) {
        failed++;
        haltedMidBatch = true;
        batchError = {
          stage: 'ROW_TENANT_VERIFICATION',
          code: 'ROW_TENANT_MISMATCH',
          message: 'Baris siswa tidak cocok dengan tenant siklus run aktif.',
          failedStudentId: studentId
        };
        break;
      }

      const rawKK = student.no_kk;
      const cleanKK = normalizeKK(rawKK);
      const currHmac = student.kk_hmac ? String(student.kk_hmac).trim().toLowerCase() : null;
      const currLast4 = student.kk_last4 ? String(student.kk_last4).trim() : null;

      // Kasus A: KK sumber tidak ada / belum diverifikasi (null/kosong) atau format tidak valid
      if (!cleanKK) {
        const reason = !rawKK ? 'UNVERIFIED_NO_KK' : 'INVALID_SOURCE_KK';
        const skipRes = await invokeRecordSkip(studentId, reason, currHmac, currLast4);
        if (!skipRes.ok) {
          failed++;
          haltedMidBatch = true;
          batchError = {
            stage: 'RECORD_SKIP_RPC',
            code: skipRes.code,
            message: skipRes.message,
            failedStudentId: studentId
          };
          break;
        }
        skipped++;
        lastProcessedId = studentId;
        continue;
      }

      // Kasus B: Format hash rusak (bukan 64 hex)
      if (currHmac && !/^[0-9a-f]{64}$/.test(currHmac)) {
        const skipRes = await invokeRecordSkip(studentId, 'CORRUPT_HMAC_FLAGGED', currHmac, currLast4);
        if (!skipRes.ok) {
          failed++;
          haltedMidBatch = true;
          batchError = {
            stage: 'RECORD_SKIP_RPC',
            code: skipRes.code,
            message: skipRes.message,
            failedStudentId: studentId
          };
          break;
        }
        skipped++;
        lastProcessedId = studentId;
        continue;
      }

      // Hitung HMAC dari KK yang valid
      const computedHmac = await computeHMAC(cleanKK, secret);
      const computedLast4 = cleanKK.slice(-4);

      // Kasus C: Hash sudah ada di database
      if (currHmac) {
        if (currHmac !== computedHmac) {
          // Mismatch antara KK sumber dan hash tersimpan
          const skipRes = await invokeRecordSkip(studentId, 'HMAC_MISMATCH_FLAGGED', currHmac, currLast4);
          if (!skipRes.ok) {
            failed++;
            haltedMidBatch = true;
            batchError = {
              stage: 'RECORD_SKIP_RPC',
              code: skipRes.code,
              message: skipRes.message,
              failedStudentId: studentId
            };
            break;
          }
          skipped++;
          lastProcessedId = studentId;
          continue;
        }

        // Jika hash cocok dan last4 sudah valid: Idempoten skip
        if (currLast4 === computedLast4) {
          const skipRes = await invokeRecordSkip(studentId, 'ALREADY_VALID', currHmac, currLast4);
          if (!skipRes.ok) {
            failed++;
            haltedMidBatch = true;
            batchError = {
              stage: 'RECORD_SKIP_RPC',
              code: skipRes.code,
              message: skipRes.message,
              failedStudentId: studentId
            };
            break;
          }
          skipped++;
          lastProcessedId = studentId;
          continue;
        }

        // Jika hash cocok tetapi last4 perlu diisi: Mutasi via RPC atomik
        const applyRes = await invokeApplyRecord(studentId, currHmac, currLast4, currHmac, computedLast4, cleanKK);
        if (!applyRes.ok) {
          failed++;
          haltedMidBatch = true;
          batchError = {
            stage: 'APPLY_RECORD_RPC',
            code: applyRes.code,
            message: applyRes.message,
            failedStudentId: studentId
          };
          break;
        }
        processed++;
        lastProcessedId = studentId;
        continue;
      }

      // Kasus D: Kandidat Murni (KK valid, HMAC null/kosong) -> Terapkan secara atomik
      const applyRes = await invokeApplyRecord(studentId, null, currLast4, computedHmac, computedLast4, cleanKK);
      if (!applyRes.ok) {
        failed++;
        haltedMidBatch = true;
        batchError = {
          stage: 'APPLY_RECORD_RPC',
          code: applyRes.code,
          message: applyRes.message,
          failedStudentId: studentId
        };
        break;
      }
      processed++;
      lastProcessedId = studentId;
    }

    // -------------------------------------------------------------------------
    // 8. VERIFIKASI & PERPANJANG HEARTBEAT LEASE DENGAN FENCING TOKEN
    // -------------------------------------------------------------------------
    const heartbeatResp = await fetch(`${supabaseUrl}/rest/v1/rpc/heartbeat_backfill_kk_lease`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_run_id: runId,
        p_lease_token: leaseToken,
        p_lease_seconds: 120
      })
    }).catch(() => null);

    const heartbeatJson = heartbeatResp && heartbeatResp.ok
      ? await heartbeatResp.json().catch(() => null)
      : null;

    const leaseHeartbeatOk = Boolean(
      heartbeatResp &&
      heartbeatResp.ok &&
      heartbeatJson &&
      heartbeatJson.success === true
    );

    if (!leaseHeartbeatOk && !batchError) {
      batchError = {
        stage: 'HEARTBEAT_LEASE_RPC',
        code: heartbeatJson?.code || 'LEASE_HEARTBEAT_FAILED',
        message: heartbeatJson?.message || 'Gagal memperbarui atau memverifikasi lease lock pada database.'
      };
    }

    // -------------------------------------------------------------------------
    // 9. TENTUKAN STATUS BARIS TERSISA & PENYELESAIAN RUN (FAIL-CLOSED)
    // -------------------------------------------------------------------------
    const allBatchRowsAccounted = !haltedMidBatch && failed === 0 && (processed + skipped) === studentsBatch.length;
    const hasMoreRows = allBatchRowsAccounted ? studentsBatch.length === batchSize : true;
    let completed = false;

    if (allBatchRowsAccounted && !hasMoreRows && leaseHeartbeatOk) {
      const completeResp = await fetch(`${supabaseUrl}/rest/v1/rpc/complete_backfill_kk_run`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_run_id: runId,
          p_lease_token: leaseToken,
          p_status: 'COMPLETED'
        })
      }).catch(() => null);

      const completeJson = completeResp && completeResp.ok
        ? await completeResp.json().catch(() => null)
        : null;

      if (completeResp && completeResp.ok && completeJson && completeJson.success === true) {
        completed = true;
      } else {
        completed = false;
        batchError = {
          stage: 'COMPLETE_RUN_RPC',
          code: completeJson?.code || 'COMPLETE_RUN_RPC_FAILED',
          message: completeJson?.message || 'Gagal menetapkan status COMPLETED pada siklus run.'
        };
      }
    }

    // -------------------------------------------------------------------------
    // 10. KONTRAK RESPONSE DETERMINISTIK
    // -------------------------------------------------------------------------
    const isBatchSuccess = failed === 0 && leaseHeartbeatOk && !batchError;
    let batchStatus = 'RUNNING';
    let batchCode = 'BATCH_PROCESSED';
    let batchMessage = 'Batch berhasil diproses.';
    let httpStatus = 200;

    if (isBatchSuccess) {
      if (completed) {
        batchStatus = 'COMPLETED';
        batchCode = 'RUN_COMPLETED';
        batchMessage = 'Seluruh proses backfill KK HMAC pada tenant berhasil diselesaikan.';
      } else {
        batchStatus = 'RUNNING';
        batchCode = 'BATCH_PROCESSED';
        batchMessage = 'Batch berhasil diproses. Masih terdapat baris berikutnya untuk dilanjutkan.';
      }
    } else if (failed > 0) {
      batchStatus = processed > 0 || skipped > 0 ? 'PARTIAL_FAILURE' : 'BATCH_FAILED';
      batchCode = batchError?.code || 'BATCH_RECORD_FAILED';
      batchMessage = batchError?.message || 'Sebagian record dalam batch gagal diproses. Kursor ditahan pada record terakhir yang berhasil.';
      httpStatus = (batchCode === 'FENCING_TOKEN_MISMATCH' || batchCode === 'LEASE_EXPIRED') ? 409 : 422;
    } else if (!leaseHeartbeatOk) {
      batchStatus = 'LEASE_HEARTBEAT_FAILED';
      batchCode = batchError?.code || 'LEASE_HEARTBEAT_FAILED';
      batchMessage = batchError?.message || 'Gagal memverifikasi lease lock.';
      httpStatus = batchCode === 'LEASE_LOST_OR_TOKEN_INVALID' ? 409 : 500;
    } else {
      batchStatus = 'COMPLETION_RPC_FAILED';
      batchCode = batchError?.code || 'COMPLETE_RUN_RPC_FAILED';
      batchMessage = batchError?.message || 'Gagal menyelesaikan status akhir run.';
      httpStatus = (batchCode === 'FENCING_TOKEN_MISMATCH' || batchCode === 'LEASE_EXPIRED') ? 409 : 500;
    }

    const timestamp = new Date().toISOString();
    const batchData = {
      runId,
      leaseToken,
      leaseRecovered: Boolean(typeof leaseRecovered !== 'undefined' ? leaseRecovered : false),
      tenantId: runTenantId,
      batchCount: studentsBatch.length,
      processed,
      skipped,
      failed,
      lastCursor: lastProcessedId,
      hasMoreRows,
      completed,
      status: batchStatus,
      code: batchCode,
      error: batchError,
      timestamp
    };

    return new Response(
      JSON.stringify({
        success: isBatchSuccess,
        status: batchStatus,
        code: batchCode,
        message: batchMessage,
        error: batchError,
        leaseRecovered: Boolean(typeof leaseRecovered !== 'undefined' ? leaseRecovered : false),
        ...batchData,
        data: batchData
      }),
      { status: httpStatus, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Backfill execution error:', err.message);
    return new Response(
      JSON.stringify({
        success: false,
        code: 'INTERNAL_EXECUTION_ERROR',
        message: 'Terjadi kesalahan internal pada eksekusi backfill.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
