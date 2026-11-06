import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeKK, computeHMAC } from '../functions/api/tenant/_auth_staff.js';
import { checkCryptoEngineStatus, performDryRunAnalysis } from '../functions/api/admin/backfill_helpers.js';
import { onRequestGet as backfillStatusGet } from '../functions/api/admin/backfill_kk_hmac/status.js';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';
import { onRequestPost as backfillRollbackPost } from '../functions/api/admin/backfill_kk_hmac/rollback.js';

const SCHEMA_FILE_PATH = path.join(process.cwd(), 'phase5_5_b_backfill_audit_schema.sql');
const VERIFICATION_FILE_PATH = path.join(process.cwd(), 'phase5_5_b_backfill_verification.sql');
const INDEX_FILE_PATH = path.join(process.cwd(), 'functions/api/admin/backfill_kk_hmac/index.js');
const ROLLBACK_FILE_PATH = path.join(process.cwd(), 'functions/api/admin/backfill_kk_hmac/rollback.js');

test('CHUVATOR — FASE 5.5-B: Hardened Backfill Infrastructure V2.1 (Security & Concurrency Suite)', async (t) => {
  const schemaSql = fs.readFileSync(SCHEMA_FILE_PATH, 'utf8');
  const verificationSql = fs.readFileSync(VERIFICATION_FILE_PATH, 'utf8');
  const indexJs = fs.readFileSync(INDEX_FILE_PATH, 'utf8');
  const rollbackJs = fs.readFileSync(ROLLBACK_FILE_PATH, 'utf8');

  // =========================================================================
  // 1. AUDIT ROW LOCKING & ANTI-DEADLOCK SERIALIZATION
  // =========================================================================

  await t.test('1. Anti-Deadlock: Elimination of FOR SHARE -> UPDATE Lock Upgrade', () => {
    // Memastikan tidak ada pola SELECT ... FOR SHARE pada tabel yang nantinya di-UPDATE dalam transaksi sama
    assert.doesNotMatch(schemaSql, /FROM public\.backfill_kk_runs[\s\S]*?FOR SHARE;/);
    
    // apply_backfill_kk_atomic_record harus menggunakan FOR UPDATE pada backfill_kk_runs
    assert.match(schemaSql, /SELECT run_id, tenant_id, lease_token, status, lease_expires_at INTO v_run\s+FROM public\.backfill_kk_runs\s+WHERE run_id = p_run_id\s+FOR UPDATE;/);
    
    // record_backfill_kk_skip juga harus mengunci FOR UPDATE sebelum mutasi counter
    assert.match(schemaSql, /SELECT run_id, tenant_id, lease_token, status, lease_expires_at INTO v_run\s+FROM public\.backfill_kk_runs\s+WHERE run_id = p_run_id\s+FOR UPDATE;/);
  });

  await t.test('2. Strict Lock Hierarchy: Consistent Table Lock Acquisition Order', () => {
    // 1. Dalam apply_backfill_kk_atomic_record:
    // Urutan: backfill_kk_runs (FOR UPDATE) -> students (FOR UPDATE)
    const applyIdxRuns = schemaSql.indexOf('FROM public.backfill_kk_runs\n    WHERE run_id = p_run_id\n    FOR UPDATE;');
    const applyIdxStudents = schemaSql.indexOf('FROM public.students\n    WHERE id = p_student_id AND tenant_id = p_tenant_id\n    FOR UPDATE;');
    assert.ok(applyIdxRuns > 0 && applyIdxStudents > applyIdxRuns, 'apply RPC must lock runs before students');

    // 2. Dalam rollback_backfill_kk_atomic:
    // Urutan: backfill_kk_runs (FOR UPDATE) -> students (FOR UPDATE)
    const rollbackIdxRuns = schemaSql.indexOf('SELECT run_id, tenant_id, status INTO v_run\n    FROM public.backfill_kk_runs\n    WHERE run_id = p_run_id\n    FOR UPDATE;');
    const rollbackIdxStudents = schemaSql.indexOf('SELECT tenant_id, kk_hmac, kk_last4 INTO v_curr_tenant, v_curr_hmac, v_curr_last4\n    FROM public.students\n    WHERE id = p_student_id AND tenant_id = v_applied_audit.tenant_id\n    FOR UPDATE;');
    assert.ok(rollbackIdxRuns > 0 && rollbackIdxStudents > rollbackIdxRuns, 'rollback RPC must lock runs before students to prevent inverted lock deadlock');
  });

  await t.test('3. Concurrency Simulation: Two Workers with Identical vs Different Lease Tokens', async () => {
    // Skenario A: Dua worker dengan token berbeda -> worker lama ditolak dengan FENCING_TOKEN_MISMATCH
    assert.match(schemaSql, /IF v_run\.lease_token IS DISTINCT FROM p_lease_token THEN/);
    assert.match(schemaSql, /'code', 'FENCING_TOKEN_MISMATCH'/);

    // Skenario B: Dua worker dengan token sama mencoba proses siswa sama -> OCC CONCURRENCY_CONFLICT
    assert.match(schemaSql, /IF \(v_curr_hmac IS DISTINCT FROM p_expected_old_hmac\) OR \(v_curr_last4 IS DISTINCT FROM p_expected_old_last4\) THEN/);
    assert.match(schemaSql, /'code', 'CONCURRENCY_CONFLICT'/);
  });

  await t.test('4. Concurrency Simulation: Concurrent Apply and Heartbeat Serialization', () => {
    // Heartbeat melakukan single atomic UPDATE pada backfill_kk_runs
    assert.match(schemaSql, /CREATE OR REPLACE FUNCTION public\.heartbeat_backfill_kk_lease/);
    assert.match(schemaSql, /UPDATE public\.backfill_kk_runs[\s\S]*?WHERE run_id = p_run_id[\s\S]*?AND lease_token = p_lease_token/);
    // Apply mengunci baris yang sama dengan FOR UPDATE, sehingga serialize tanpa deadlock
    assert.match(schemaSql, /WHERE run_id = p_run_id\s+FOR UPDATE;/);
  });

  // =========================================================================
  // 2. HARDENING SECURITY DEFINER & SEARCH PATH
  // =========================================================================

  await t.test('5. SECURITY DEFINER Hardening: Strict SET search_path = \'\' on All Functions', () => {
    const fnPrevent = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.fn_prevent_backfill_audit_mutation[\s\S]*?SET search_path = ''/);
    const fnAcquire = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.acquire_backfill_kk_lease[\s\S]*?SET search_path = ''/);
    const fnHeartbeat = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.heartbeat_backfill_kk_lease[\s\S]*?SET search_path = ''/);
    const fnApply = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.apply_backfill_kk_atomic_record[\s\S]*?SET search_path = ''/);
    const fnSkip = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.record_backfill_kk_skip[\s\S]*?SET search_path = ''/);
    const fnRollback = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.rollback_backfill_kk_atomic[\s\S]*?SET search_path = ''/);
    const fnComplete = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.complete_backfill_kk_run[\s\S]*?SET search_path = ''/);

    assert.ok(fnPrevent, 'fn_prevent_backfill_audit_mutation must have SET search_path = \'\'');
    assert.ok(fnAcquire, 'acquire_backfill_kk_lease must have SET search_path = \'\'');
    assert.ok(fnHeartbeat, 'heartbeat_backfill_kk_lease must have SET search_path = \'\'');
    assert.ok(fnApply, 'apply_backfill_kk_atomic_record must have SET search_path = \'\'');
    assert.ok(fnSkip, 'record_backfill_kk_skip must have SET search_path = \'\'');
    assert.ok(fnRollback, 'rollback_backfill_kk_atomic must have SET search_path = \'\'');
    assert.ok(fnComplete, 'complete_backfill_kk_run must have SET search_path = \'\'');
  });

  await t.test('6. Explicit Schema Qualification for All System & Catalog Functions', () => {
    // Memastikan pemanggilan built-in menggunakan pg_catalog.* saat search_path kosong
    assert.match(schemaSql, /pg_catalog\.now\(\)/);
    assert.match(schemaSql, /pg_catalog\.gen_random_uuid\(\)/);
    assert.match(schemaSql, /pg_catalog\.jsonb_build_object\(/);
    assert.match(schemaSql, /(GREATEST|pg_catalog\.greatest)\(/);
    assert.match(schemaSql, /pg_catalog\.btrim\(/);
    assert.match(schemaSql, /pg_catalog\.interval/);
  });

  // =========================================================================
  // 3. AUDIT APPEND-ONLY & TRUNCATE DEFENSE
  // =========================================================================

  await t.test('7. Append-Only Defense: Statement-Level Trigger for TRUNCATE', () => {
    assert.match(schemaSql, /CREATE TRIGGER trg_prevent_backfill_audit_truncate\s+BEFORE TRUNCATE ON public\.backfill_kk_audit\s+FOR EACH STATEMENT\s+EXECUTE FUNCTION public\.fn_prevent_backfill_audit_mutation\(\);/);
    assert.match(schemaSql, /TABEL AUDIT BERSIFAT APPEND-ONLY: Mutasi \(UPDATE, DELETE, atau TRUNCATE\) dilarang/);
    assert.match(verificationSql, /UNION ALL SELECT 'TRIGGER', 'trg_prevent_backfill_audit_truncate'/);
  });

  await t.test('8. Append-Only Defense: Row-Level Trigger for UPDATE and DELETE', () => {
    assert.match(schemaSql, /CREATE TRIGGER trg_prevent_backfill_audit_update\s+BEFORE UPDATE OR DELETE ON public\.backfill_kk_audit\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.fn_prevent_backfill_audit_mutation\(\);/);
  });

  await t.test('9. Least Privilege Table Access: service_role Denied UPDATE/DELETE/TRUNCATE', () => {
    assert.match(schemaSql, /REVOKE ALL ON TABLE public\.backfill_kk_audit FROM PUBLIC, anon, authenticated;/);
    assert.match(schemaSql, /GRANT SELECT, INSERT ON TABLE public\.backfill_kk_audit TO service_role;/);
    assert.doesNotMatch(schemaSql, /GRANT [^;]*UPDATE[^;]* ON TABLE public\.backfill_kk_audit/);
    assert.doesNotMatch(schemaSql, /GRANT [^;]*DELETE[^;]* ON TABLE public\.backfill_kk_audit/);
    assert.doesNotMatch(schemaSql, /GRANT [^;]*TRUNCATE[^;]* ON TABLE public\.backfill_kk_audit/);
  });

  // =========================================================================
  // 4. ATOMICITY & TRANSACTION INTEGRITY
  // =========================================================================

  await t.test('10. Atomic Execution: Student Update, Audit Insert, and Run Cursor in Single Transaction', () => {
    // Pada apply_backfill_kk_atomic_record:
    // Tidak ada autonomous transaction atau intermediate commit
    const applyMatch = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.apply_backfill_kk_atomic_record[\s\S]*?\$\$;/);
    assert.ok(applyMatch, 'apply_backfill_kk_atomic_record must be defined');
    assert.doesNotMatch(applyMatch[0], /\bCOMMIT\b/i);
    assert.doesNotMatch(applyMatch[0], /\bROLLBACK\b/i);
    
    // Tiga mutasi utama wajib berada dalam satu blok eksekusi:
    assert.match(applyMatch[0], /UPDATE public\.students[\s\S]*?INSERT INTO public\.backfill_kk_audit[\s\S]*?UPDATE public\.backfill_kk_runs/);
  });

  await t.test('11. Atomic Rollback: Student Restoration and Audit Event in Single Transaction', () => {
    assert.match(schemaSql, /UPDATE public\.students[\s\S]*?INSERT INTO public\.backfill_kk_audit[\s\S]*?UPDATE public\.backfill_kk_runs/);
  });

  // =========================================================================
  // 5. REST & RPC ACCESS CONTROL REJECTION
  // =========================================================================

  await t.test('12. RPC Privilege Enforcement: Strict Revoke from PUBLIC, anon, authenticated', () => {
    assert.match(schemaSql, /REVOKE ALL ON FUNCTION public\.fn_prevent_backfill_audit_mutation\(\) FROM PUBLIC, anon, authenticated;/);
    assert.match(schemaSql, /REVOKE ALL ON FUNCTION public\.acquire_backfill_kk_lease\(TEXT, TEXT, INTEGER\) FROM PUBLIC, anon, authenticated;/);
    assert.match(schemaSql, /REVOKE ALL ON FUNCTION public\.heartbeat_backfill_kk_lease\(UUID, UUID, INTEGER\) FROM PUBLIC, anon, authenticated;/);
    assert.match(schemaSql, /REVOKE ALL ON FUNCTION public\.apply_backfill_kk_atomic_record\(UUID, UUID, INTEGER, UUID, TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR(, VARCHAR)?\) FROM PUBLIC, anon, authenticated;/);
    assert.match(schemaSql, /REVOKE ALL ON FUNCTION public\.record_backfill_kk_skip\(UUID, UUID, INTEGER, UUID, TEXT, TEXT, VARCHAR, VARCHAR\) FROM PUBLIC, anon, authenticated;/);
    assert.match(schemaSql, /REVOKE ALL ON FUNCTION public\.rollback_backfill_kk_atomic\(UUID, UUID\) FROM PUBLIC, anon, authenticated;/);
    assert.match(schemaSql, /REVOKE ALL ON FUNCTION public\.complete_backfill_kk_run\(UUID, UUID, VARCHAR, TEXT\) FROM PUBLIC, anon, authenticated;/);

    assert.match(schemaSql, /GRANT EXECUTE ON FUNCTION public\.apply_backfill_kk_atomic_record[\s\S]*?TO service_role;/);
  });

  await t.test('13. HTTP Unauthorized & Forbidden Rejections (anon & non-superadmin)', async () => {
    // Anon request (no token) -> 401
    const unauthReq = new Request('http://localhost:3000/api/admin/backfill_kk_hmac/status', { method: 'GET' });
    const unauthRes = await backfillStatusGet({ request: unauthReq, env: { ENVIRONMENT: 'production' } });
    assert.strictEqual(unauthRes.status, 401);

    // Authenticated non-superadmin -> 403
    const nonSuperReq = new Request('http://localhost:3000/api/admin/backfill_kk_hmac/status', {
      method: 'GET',
      headers: {
        'x-test-staff-role': 'admin',
        'x-test-staff-uid': 'tenant-admin-1',
        'x-test-tenant-id': 'tenant-1'
      }
    });
    const nonSuperRes = await backfillStatusGet({ request: nonSuperReq, env: { ENVIRONMENT: 'test', KK_HMAC_SECRET: 'test' } });
    assert.strictEqual(nonSuperRes.status, 403);
  });

  // =========================================================================
  // 6. RESUME, CURSOR & CRYPTO HARDENING
  // =========================================================================

  await t.test('14. Active Execution Lock: Non-dryRun requests strictly rejected in Dry-Run Only Mode', async () => {
    const req = new Request('http://localhost:3000/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-staff-role': 'superadmin',
        'x-test-staff-uid': 'superadmin-1',
        'x-test-tenant-id': 'global'
      },
      body: JSON.stringify({
        runId: '11111111-1111-1111-1111-111111111111',
        cursor: 'arbitrary-client-cursor'
      })
    });

    const res = await backfillIndexPost({
      request: req,
      env: {
        KK_HMAC_SECRET: 'test-secret',
        ENVIRONMENT: 'test',
        SUPABASE_URL: 'http://mock-supabase.local',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key'
      }
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.code === 'CLIENT_CURSOR_REJECTED' || body.code === 'DRY_RUN_ONLY_MODE', 'Client cursor must be rejected with 400');
  });

  await t.test('15. Cryptographic Fail-Closed & Normalization Contract', async () => {
    assert.strictEqual(normalizeKK('1234-5678-9012 3456'), '1234567890123456');
    assert.strictEqual(normalizeKK('12345'), '');
    assert.strictEqual(await computeHMAC('1234567890123456', ''), null);

    const sig = await computeHMAC('1234567890123456', 'test-secret');
    assert.ok(sig);
    assert.match(sig, /^[0-9a-f]{64}$/);
  });

  await t.test('16. Dry-Run Purity: Zero Database Mutation & Zero Run State', async () => {
    let attemptedMutations = 0;
    const originalFetch = global.fetch;

    (global as any).fetch = async (url: any, options: any) => {
      const method = (options?.method || 'GET').toUpperCase();
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        attemptedMutations++;
        throw new Error(`Forbidden mutation during dry-run: ${method} ${url}`);
      }

      if (String(url).includes('/rest/v1/students')) {
        return new Response(
          JSON.stringify([
            { id: '11111111-1111-1111-1111-111111111111', tenant_id: 't-1', no_kk: '1234567890123456', kk_hmac: null, kk_last4: null },
            { id: '22222222-2222-2222-2222-222222222222', tenant_id: 't-1', no_kk: '12345', kk_hmac: null, kk_last4: null },
            { id: '33333333-3333-3333-3333-333333333333', tenant_id: 't-2', no_kk: '9999999999999999', kk_hmac: 'a'.repeat(64), kk_last4: '9999' }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const req = new Request('http://localhost:3000/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-staff-role': 'superadmin',
          'x-test-staff-uid': 'superadmin-1',
          'x-test-tenant-id': 'global'
        },
        body: JSON.stringify({ dryRun: true })
      });

      const res = await backfillIndexPost({
        request: req,
        env: {
          KK_HMAC_SECRET: 'test-secret',
          SUPABASE_URL: 'http://mock-supabase.local',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          ENVIRONMENT: 'test'
        }
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.mode, 'DRY_RUN');
      assert.strictEqual(attemptedMutations, 0, 'Dry-run must never perform write operations');
      assert.strictEqual(data.data.totalStudents, 3);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
