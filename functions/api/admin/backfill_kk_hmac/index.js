/**
 * Cloudflare Pages Function: POST /api/admin/backfill_kk_hmac
 * Execution & Dry-Run Endpoint for Student KK_HMAC Backfill (V2 Hardened).
 * Protected: Superadmin Only, Fail-Closed on missing KK_HMAC_SECRET.
 * Enforces Distributed Fencing Lease Tokens, Persistent Database Cursors, and Tenant Binding.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { normalizeKK, computeHMAC } from '../../tenant/_auth_staff.js';
import { validateSuperadmin, performDryRunAnalysis } from '../backfill_helpers.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request, context.env);
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
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

    // 2. Validasi Secret: Fail-Closed
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
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Konfigurasi server database tidak lengkap.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const isDryRun = url.searchParams.get('dryRun') === 'true' || body.dryRun === true;
    const requestedTenantId = body.tenantId || url.searchParams.get('tenantId') || 'global';

    // -------------------------------------------------------------------------
    // 3. MODE DRY-RUN: 100% Read-Only, Zero INSERT, Zero UPDATE, Zero Locks
    // -------------------------------------------------------------------------
    if (isDryRun) {
      const analysis = await performDryRunAnalysis(supabaseUrl, serviceRoleKey, secret, requestedTenantId);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'DRY_RUN',
          message: 'Analisis simulasi selesai (100% read-only, tanpa perubahan database).',
          data: {
            ...analysis,
            timestamp: new Date().toISOString()
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // 4. ACTIVE EXECUTION (FENCING LEASE TOKEN + DATABASE-AUTHORITATIVE CURSOR)
    // -------------------------------------------------------------------------
    const batchSize = Math.min(Number(body.batchSize) || 50, 50);
    const requestRunId = body.runId || null;
    let runId = requestRunId;
    let leaseToken = body.leaseToken || null;
    let runTenantId = requestedTenantId;
    let dbCursor = null;

    if (requestRunId) {
      // -----------------------------------------------------------------------
      // RESUME PRE-EXISTING RUN:
      // Baca langsung state resmi dari database: cursor dan tenant terikat permanen!
      // DILARANG menerima kursor arbitrer dari client.
      // -----------------------------------------------------------------------
      if (body.cursor !== undefined) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'CLIENT_CURSOR_REJECTED',
            message: 'Kursor klien ditolak. Siklus resume harus membaca kursor secara eksklusif dari database (last_cursor).'
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      const getRunUrl = `${supabaseUrl}/rest/v1/backfill_kk_runs?run_id=eq.${encodeURIComponent(requestRunId)}&select=run_id,tenant_id,status,lease_token,lease_expires_at,last_cursor`;
      const runResp = await fetch(getRunUrl, {
        method: 'GET',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Accept': 'application/json' }
      }).catch(() => null);

      if (!runResp || !runResp.ok) {
        return new Response(
          JSON.stringify({ success: false, code: 'RUN_NOT_FOUND', message: 'Siklus run tidak ditemukan di database.' }),
          { status: 404, headers: corsHeaders }
        );
      }

      const runs = await runResp.json().catch(() => []);
      if (!Array.isArray(runs) || runs.length === 0) {
        return new Response(
          JSON.stringify({ success: false, code: 'RUN_NOT_FOUND', message: 'Siklus run tidak ditemukan di database.' }),
          { status: 404, headers: corsHeaders }
        );
      }

      const existingRun = runs[0];
      if (existingRun.status !== 'RUNNING' && existingRun.status !== 'ACQUIRED') {
        return new Response(
          JSON.stringify({ success: false, code: 'RUN_NOT_ACTIVE', message: `Siklus run tidak dapat dilanjutkan karena berstatus: ${existingRun.status}.` }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Validasi Tenant Immutability: Tenant tidak boleh diganti saat resume!
      if (requestedTenantId && requestedTenantId !== 'global' && requestedTenantId !== existingRun.tenant_id) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'TENANT_MISMATCH_ON_RESUME',
            message: `Siklus run ini terikat secara permanen pada tenant '${existingRun.tenant_id}'. Penggantian tenant saat resume dilarang.`
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      runTenantId = existingRun.tenant_id;
      dbCursor = existingRun.last_cursor; // Selalu baca kursor dari DB!

      // Validasi atau Akuisisi Fencing Lease Token
      if (body.leaseToken) {
        if (body.leaseToken !== existingRun.lease_token) {
          return new Response(
            JSON.stringify({
              success: false,
              code: 'FENCING_TOKEN_STALE',
              message: 'Lease token yang disertakan telah usang. Worker lain telah mengambil alih run ini.'
            }),
            { status: 409, headers: corsHeaders }
          );
        }
        leaseToken = body.leaseToken;
      } else {
        // Jika resume tanpa token aktif, periksa apakah lease lama sudah kedaluwarsa
        const leaseExpired = new Date(existingRun.lease_expires_at).getTime() <= Date.now();
        if (!leaseExpired) {
          return new Response(
            JSON.stringify({
              success: false,
              code: 'RUN_CURRENTLY_LOCKED',
              message: 'Run ini sedang dikunci oleh worker aktif. Sertakan leaseToken yang sah atau tunggu lease kedaluwarsa.'
            }),
            { status: 409, headers: corsHeaders }
          );
        }

        // Perpanjang / terbitkan lease token baru untuk worker ini
        const renewUrl = `${supabaseUrl}/rest/v1/rpc/acquire_backfill_kk_lease`;
        const renewResp = await fetch(renewUrl, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_tenant_id: runTenantId, p_created_by: auth.user.email, p_lease_seconds: 120 })
        }).catch(() => null);

        if (renewResp && renewResp.ok) {
          const renewData = await renewResp.json().catch(() => ({}));
          runId = renewData.run_id;
          leaseToken = renewData.lease_token;
        } else {
          return new Response(
            JSON.stringify({ success: false, code: 'LEASE_ACQUIRE_FAILED', message: 'Gagal memperbarui lease lock.' }),
            { status: 500, headers: corsHeaders }
          );
        }
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
            message: 'Infrastruktur tabel public.backfill_kk_runs dan RPC belum tersedia di database. Jalankan migrasi phase5_5_b_backfill_audit_schema.sql terlebih dahulu.'
          }),
          { status: 503, headers: corsHeaders }
        );
      }

      const leaseData = await leaseResp.json().catch(() => ({}));
      if (!leaseData.success) {
        return new Response(
          JSON.stringify({
            success: false,
            code: leaseData.code || 'CONCURRENCY_LOCKED',
            message: leaseData.message || 'Terdapat proses backfill yang sedang berjalan pada tenant ini.'
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      runId = leaseData.run_id;
      leaseToken = leaseData.lease_token;
    }

    // 4.2. Baca batch siswa menggunakan Keyset Pagination dengan kursor resmi DB
    // Sumber KK harus berasal dari kolom no_kk yang sudah terverifikasi (BUKAN nik_kk)
    let fetchUrl = `${supabaseUrl}/rest/v1/students?select=id,tenant_id,no_kk,kk_hmac,kk_last4&order=id.asc&limit=${batchSize}`;
    if (dbCursor) {
      fetchUrl += `&id=gt.${encodeURIComponent(dbCursor)}`;
    }
    if (runTenantId && runTenantId !== 'global') {
      fetchUrl += `&tenant_id=eq.${encodeURIComponent(runTenantId)}`;
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
        JSON.stringify({ success: false, message: 'Gagal mengambil data siswa untuk eksekusi batch.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const studentsBatch = await studentsResp.json().catch(() => []);
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let lastProcessedId = dbCursor;

    // 4.3. Proses setiap siswa dalam batch menggunakan RPC atomik ber-fencing token
    for (const student of studentsBatch) {
      const studentId = student.id;
      const tenantId = student.tenant_id;
      const rawKK = student.no_kk;
      const cleanKK = normalizeKK(rawKK);
      const currHmac = student.kk_hmac ? String(student.kk_hmac).trim() : null;
      const currLast4 = student.kk_last4 ? String(student.kk_last4).trim() : null;

      lastProcessedId = studentId;

      // Kasus A: KK sumber tidak ada / belum diverifikasi (null/kosong) atau format tidak valid
      if (!cleanKK) {
        const reason = !rawKK ? 'UNVERIFIED_NO_KK' : 'INVALID_SOURCE_KK';
        await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_run_id: runId,
            p_lease_token: leaseToken,
            p_batch_id: 1,
            p_student_id: studentId,
            p_tenant_id: tenantId,
            p_reason: reason,
            p_old_hmac: currHmac,
            p_old_last4: currLast4
          })
        }).catch(() => null);
        skipped++;
        continue;
      }

      // Kasus B: Format hash rusak (bukan 64 hex)
      if (currHmac && !/^[0-9a-f]{64}$/.test(currHmac)) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_run_id: runId,
            p_lease_token: leaseToken,
            p_batch_id: 1,
            p_student_id: studentId,
            p_tenant_id: tenantId,
            p_reason: 'CORRUPT_HMAC_FLAGGED',
            p_old_hmac: currHmac,
            p_old_last4: currLast4
          })
        }).catch(() => null);
        skipped++;
        continue;
      }

      // Hitung HMAC dari KK yang valid
      const computedHmac = await computeHMAC(cleanKK, secret);
      const computedLast4 = cleanKK.slice(-4);

      // Kasus C: Hash sudah ada di database
      if (currHmac) {
        if (currHmac !== computedHmac) {
          // Mismatch antara KK sumber dan hash tersimpan
          await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
            method: 'POST',
            headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              p_run_id: runId,
              p_lease_token: leaseToken,
              p_batch_id: 1,
              p_student_id: studentId,
              p_tenant_id: tenantId,
              p_reason: 'HMAC_MISMATCH_FLAGGED',
              p_old_hmac: currHmac,
              p_old_last4: currLast4
            })
          }).catch(() => null);
          skipped++;
          continue;
        }

        // Jika hash cocok dan last4 sudah valid: Idempoten skip
        if (currLast4 === computedLast4) {
          await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
            method: 'POST',
            headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              p_run_id: runId,
              p_lease_token: leaseToken,
              p_batch_id: 1,
              p_student_id: studentId,
              p_tenant_id: tenantId,
              p_reason: 'ALREADY_VALID',
              p_old_hmac: currHmac,
              p_old_last4: currLast4
            })
          }).catch(() => null);
          skipped++;
          continue;
        }

        // Jika hash cocok tetapi last4 kosong: Mutasi hanya last4 via RPC atomik
        const applyResp = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_backfill_kk_atomic_record`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_run_id: runId,
            p_lease_token: leaseToken,
            p_batch_id: 1,
            p_student_id: studentId,
            p_tenant_id: tenantId,
            p_expected_old_hmac: currHmac,
            p_expected_old_last4: currLast4,
            p_new_hmac: currHmac,
            p_new_last4: computedLast4
          })
        }).catch(() => null);

        if (applyResp && applyResp.ok) {
          const resJson = await applyResp.json().catch(() => ({}));
          if (resJson.success) processed++; else failed++;
        } else {
          failed++;
        }
        continue;
      }

      // Kasus D: Kandidat Murni (KK valid, HMAC null/kosong) -> Terapkan secara atomik
      const applyResp = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_backfill_kk_atomic_record`, {
        method: 'POST',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_run_id: runId,
          p_lease_token: leaseToken,
          p_batch_id: 1,
          p_student_id: studentId,
          p_tenant_id: tenantId,
          p_expected_old_hmac: null,
          p_expected_old_last4: currLast4,
          p_new_hmac: computedHmac,
          p_new_last4: computedLast4
        })
      }).catch(() => null);

      if (applyResp && applyResp.ok) {
        const resJson = await applyResp.json().catch(() => ({}));
        if (resJson.success) processed++; else failed++;
      } else {
        failed++;
      }
    }

    // 4.4. Perpanjang heartbeat lease dengan fencing token
    await fetch(`${supabaseUrl}/rest/v1/rpc/heartbeat_backfill_kk_lease`, {
      method: 'POST',
      headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_run_id: runId, p_lease_token: leaseToken, p_lease_seconds: 120 })
    }).catch(() => null);

    // 4.5. Jika seluruh batch selesai atau tidak ada baris tersisa, selesaikan run
    const hasMoreRows = studentsBatch.length === batchSize;
    if (!hasMoreRows) {
      await fetch(`${supabaseUrl}/rest/v1/rpc/complete_backfill_kk_run`, {
        method: 'POST',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_run_id: runId, p_lease_token: leaseToken, p_status: 'COMPLETED' })
      }).catch(() => null);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          runId,
          leaseToken,
          tenantId: runTenantId,
          batchCount: studentsBatch.length,
          processed,
          skipped,
          failed,
          lastCursor: lastProcessedId,
          hasMoreRows,
          completed: !hasMoreRows,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Backfill execution error:', err.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada eksekusi backfill.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
