/**
 * Cloudflare Pages Function: POST /api/admin/backfill_kk_hmac
 * Execution & Dry-Run Endpoint for Student KK_HMAC Backfill.
 * Protected: Superadmin Only, Fail-Closed on missing KK_HMAC_SECRET.
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
    const tenantFilter = body.tenantId || url.searchParams.get('tenantId') || null;

    // -------------------------------------------------------------------------
    // 3. MODE DRY-RUN: 100% Read-Only, Zero INSERT, Zero UPDATE, Zero Locks
    // -------------------------------------------------------------------------
    if (isDryRun) {
      const analysis = await performDryRunAnalysis(supabaseUrl, serviceRoleKey, secret, tenantFilter);

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
    // 4. MODE ACTIVE EXECUTION (ATOMIC BATCHING WITH CONCURRENCY LEASE LOCK)
    // -------------------------------------------------------------------------
    const batchSize = Math.min(Number(body.batchSize) || 50, 50);
    const resumeCursor = body.cursor || null;
    let runId = body.runId || null;

    // 4.1. Ambil atau verifikasi lease lock
    if (!runId) {
      const leaseRpcUrl = `${supabaseUrl}/rest/v1/rpc/acquire_backfill_kk_lease`;
      const leaseResp = await fetch(leaseRpcUrl, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_created_by: auth.user.email,
          p_lease_seconds: 120
        })
      }).catch(() => null);

      if (leaseResp && leaseResp.ok) {
        const leaseData = await leaseResp.json().catch(() => ({}));
        if (!leaseData.success) {
          return new Response(
            JSON.stringify({
              success: false,
              code: leaseData.code || 'CONCURRENCY_LOCKED',
              message: leaseData.message || 'Terdapat proses backfill lain yang sedang aktif.'
            }),
            { status: 409, headers: corsHeaders }
          );
        }
        runId = leaseData.run_id;
      } else {
        // Fallback jika tabel audit belum di-deploy: Tolak mutasi dengan pesan jelas
        return new Response(
          JSON.stringify({
            success: false,
            code: 'AUDIT_INFRASTRUCTURE_PENDING',
            message: 'Infrastruktur tabel public.backfill_kk_runs dan RPC belum tersedia di database. Jalankan migrasi phase5_5_b_backfill_audit_schema.sql terlebih dahulu.'
          }),
          { status: 503, headers: corsHeaders }
        );
      }
    }

    // 4.2. Baca batch siswa menggunakan Keyset Pagination (UUID deterministik)
    let fetchUrl = `${supabaseUrl}/rest/v1/students?select=id,tenant_id,nik_kk,kk_hmac,kk_last4&order=id.asc&limit=${batchSize}`;
    if (resumeCursor) {
      fetchUrl += `&id=gt.${encodeURIComponent(resumeCursor)}`;
    }
    if (tenantFilter && tenantFilter !== 'global') {
      fetchUrl += `&tenant_id=eq.${encodeURIComponent(tenantFilter)}`;
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
    let lastProcessedId = resumeCursor;

    // 4.3. Proses setiap siswa dalam batch secara terkontrol
    for (const student of studentsBatch) {
      const studentId = student.id;
      const tenantId = student.tenant_id;
      const rawKK = student.nik_kk;
      const cleanKK = normalizeKK(rawKK);
      const currHmac = student.kk_hmac ? String(student.kk_hmac).trim() : null;
      const currLast4 = student.kk_last4 ? String(student.kk_last4).trim() : null;

      lastProcessedId = studentId;

      // Kasus A: KK sumber tidak valid (< 16 digit, bukan angka, atau null)
      if (!cleanKK) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_run_id: runId,
            p_batch_id: 1,
            p_student_id: studentId,
            p_tenant_id: tenantId,
            p_reason: 'INVALID_SOURCE_KK',
            p_old_hmac: currHmac,
            p_old_last4: currLast4
          })
        }).catch(() => null);
        skipped++;
        continue;
      }

      // Kasus B: HMAC sudah ada tetapi formatnya rusak (bukan 64 hex)
      if (currHmac && !/^[0-9a-f]{64}$/.test(currHmac)) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_run_id: runId,
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

      // Kasus C: HMAC sudah ada dan valid
      if (currHmac) {
        if (currHmac !== computedHmac) {
          // Mismatch antara KK sumber dan HMAC yang tersimpan
          await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
            method: 'POST',
            headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              p_run_id: runId,
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

        // Jika HMAC cocok dan last4 sudah terisi valid
        if (currLast4 === computedLast4) {
          await fetch(`${supabaseUrl}/rest/v1/rpc/record_backfill_kk_skip`, {
            method: 'POST',
            headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              p_run_id: runId,
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

        // Jika HMAC cocok tetapi last4 kosong, update last4 saja via RPC atomik
        const applyResp = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_backfill_kk_atomic_record`, {
          method: 'POST',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_run_id: runId,
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
          processed++;
        } else {
          failed++;
        }
        continue;
      }

      // Kasus D: Kandidat Murni (KK valid, HMAC kosong) -> Terapkan secara atomik
      const applyResp = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_backfill_kk_atomic_record`, {
        method: 'POST',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_run_id: runId,
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
        processed++;
      } else {
        failed++;
      }
    }

    // 4.4. Perpanjang heartbeat lease
    await fetch(`${supabaseUrl}/rest/v1/rpc/heartbeat_backfill_kk_lease`, {
      method: 'POST',
      headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_run_id: runId, p_lease_seconds: 120 })
    }).catch(() => null);

    // 4.5. Jika seluruh batch selesai atau tidak ada baris tersisa, selesaikan run
    const hasMoreRows = studentsBatch.length === batchSize;
    if (!hasMoreRows) {
      await fetch(`${supabaseUrl}/rest/v1/rpc/complete_backfill_kk_run`, {
        method: 'POST',
        headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_run_id: runId, p_status: 'COMPLETED' })
      }).catch(() => null);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          runId,
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
