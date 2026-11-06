/**
 * Cloudflare Pages Function: POST /api/admin/backfill_kk_hmac/rollback
 * Idempotent, atomic rollback based on run_id from persistent audit trail.
 */

import { getCorsHeaders } from '../../portal/_auth_v2.js';
import { validateSuperadmin } from '../backfill_helpers.js';

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

    const body = await request.json().catch(() => ({}));
    const { runId } = body;

    if (!runId || typeof runId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Parameter runId (UUID) wajib disertakan.' }),
        { status: 400, headers: corsHeaders }
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

    // 2. Ambil catatan audit BACKFILL_APPLIED untuk run_id yang bersangkutan
    const auditQueryUrl = `${supabaseUrl}/rest/v1/backfill_kk_audit?run_id=eq.${encodeURIComponent(runId)}&event_type=eq.BACKFILL_APPLIED&select=id,batch_id,tenant_id,student_id,old_kk_hmac,old_kk_last4,new_kk_hmac,new_kk_last4`;
    const auditResp = await fetch(auditQueryUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    }).catch(() => null);

    if (!auditResp || !auditResp.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUDIT_QUERY_FAILED',
          message: 'Tabel audit belum tersedia di database atau runId tidak ditemukan.'
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    const auditRows = await auditResp.json().catch(() => []);
    if (auditRows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Tidak ditemukan catatan perubahan (BACKFILL_APPLIED) yang perlu di-rollback untuk runId ini.',
          data: { runId, totalAudited: 0, restoredCount: 0, conflictCount: 0 }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    let restoredCount = 0;
    let conflictCount = 0;
    let alreadyRestoredCount = 0;
    let failedCount = 0;

    for (const row of auditRows) {
      // Panggil RPC atomic rollback jika tersedia
      const rpcUrl = `${supabaseUrl}/rest/v1/rpc/rollback_backfill_kk_atomic`;
      const rpcResp = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_run_id: runId,
          p_student_id: row.student_id
        })
      }).catch(() => null);

      if (rpcResp && rpcResp.ok) {
        const result = await rpcResp.json().catch(() => ({}));
        if (result.success) {
          if (result.code === 'ALREADY_ROLLED_BACK') {
            alreadyRestoredCount++;
          } else {
            restoredCount++;
          }
        } else if (result.code === 'ROLLBACK_CONFLICT_DATA_CHANGED') {
          conflictCount++;
        } else {
          failedCount++;
        }
      } else {
        // Fallback: Optimistic rollback manual melalui REST jika RPC belum ter-deploy
        // 1. Periksa apakah sudah pernah di-restore (idempotensi)
        const checkRestoredUrl = `${supabaseUrl}/rest/v1/backfill_kk_audit?run_id=eq.${encodeURIComponent(runId)}&student_id=eq.${encodeURIComponent(row.student_id)}&event_type=eq.ROLLBACK_RESTORED&original_audit_id=eq.${encodeURIComponent(row.id)}`;
        const checkRestoredResp = await fetch(checkRestoredUrl, {
          method: 'GET',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Accept': 'application/json' }
        }).catch(() => null);

        if (checkRestoredResp && checkRestoredResp.ok) {
          const restoredRows = await checkRestoredResp.json().catch(() => []);
          if (restoredRows.length > 0) {
            alreadyRestoredCount++;
            continue;
          }
        }

        // 2. Baca kondisi aktual siswa saat ini
        const checkStudentUrl = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(row.student_id)}&tenant_id=eq.${encodeURIComponent(row.tenant_id)}&select=id,kk_hmac,kk_last4`;
        const studentResp = await fetch(checkStudentUrl, {
          method: 'GET',
          headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Accept': 'application/json' }
        }).catch(() => null);

        if (studentResp && studentResp.ok) {
          const studentData = await studentResp.json().catch(() => []);
          if (studentData.length > 0) {
            const currentStudent = studentData[0];
            // STRICT COMPARISON: Baik kk_hmac maupun kk_last4 harus cocok persis dengan new_kk_*
            const hmacMatches = (currentStudent.kk_hmac ?? null) === (row.new_kk_hmac ?? null);
            const last4Matches = (currentStudent.kk_last4 ?? null) === (row.new_kk_last4 ?? null);

            if (hmacMatches && last4Matches) {
              const updateUrl = `${supabaseUrl}/rest/v1/students?id=eq.${encodeURIComponent(row.student_id)}&tenant_id=eq.${encodeURIComponent(row.tenant_id)}`;
              const updateResp = await fetch(updateUrl, {
                method: 'PATCH',
                headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  kk_hmac: row.old_kk_hmac,
                  kk_last4: row.old_kk_last4,
                  updated_at: new Date().toISOString()
                })
              }).catch(() => null);

              if (updateResp && updateResp.ok) {
                // Catat event ROLLBACK_RESTORED sebagai baris baru (TRUE APPEND-ONLY, BUKAN UPDATE)
                const appendAuditUrl = `${supabaseUrl}/rest/v1/backfill_kk_audit`;
                await fetch(appendAuditUrl, {
                  method: 'POST',
                  headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    run_id: runId,
                    event_type: 'ROLLBACK_RESTORED',
                    batch_id: row.batch_id || 1,
                    tenant_id: row.tenant_id,
                    student_id: row.student_id,
                    original_audit_id: row.id,
                    old_kk_hmac: row.old_kk_hmac,
                    old_kk_last4: row.old_kk_last4,
                    new_kk_hmac: row.new_kk_hmac,
                    new_kk_last4: row.new_kk_last4,
                    reason: 'RESTORED: Nilai kk_hmac dan kk_last4 dikembalikan ke nilai sebelum backfill.'
                  })
                }).catch(() => null);
                restoredCount++;
              } else {
                failedCount++;
              }
            } else {
              // Terjadi konflik perubahan data pasca-backfill
              const appendConflictUrl = `${supabaseUrl}/rest/v1/backfill_kk_audit`;
              await fetch(appendConflictUrl, {
                method: 'POST',
                headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  run_id: runId,
                  event_type: 'ROLLBACK_CONFLICT',
                  batch_id: row.batch_id || 1,
                  tenant_id: row.tenant_id,
                  student_id: row.student_id,
                  original_audit_id: row.id,
                  old_kk_hmac: row.old_kk_hmac,
                  old_kk_last4: row.old_kk_last4,
                  new_kk_hmac: row.new_kk_hmac,
                  new_kk_last4: row.new_kk_last4,
                  current_db_hmac: currentStudent.kk_hmac,
                  current_db_last4: currentStudent.kk_last4,
                  reason: 'CONFLICT: Nilai aktual di database telah berubah pasca-backfill. Pemulihan otomatis dibatalkan.'
                })
              }).catch(() => null);
              conflictCount++;
            }
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }
    }

    // Update status run menjadi ROLLED_BACK jika ada baris yang dipulihkan
    const updateRunUrl = `${supabaseUrl}/rest/v1/backfill_kk_runs?run_id=eq.${encodeURIComponent(runId)}`;
    await fetch(updateRunUrl, {
      method: 'PATCH',
      headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ROLLED_BACK',
        rollback_count: restoredCount,
        updated_at: new Date().toISOString()
      })
    }).catch(() => null);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Prosedur rollback selesai dieksekusi.',
        data: {
          runId,
          totalAudited: auditRows.length,
          restoredCount,
          conflictCount,
          alreadyRestoredCount,
          failedCount,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Rollback error:', err.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Terjadi kesalahan internal pada proses rollback.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
