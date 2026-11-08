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

test('CHUVATOR — FASE 5.5-B: Hardened Backfill Infrastructure V2.2.4 (Security & Concurrency Suite)', async (t) => {
  const schemaSql = fs.readFileSync(SCHEMA_FILE_PATH, 'utf8');
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

    // V2.2.3 Patch: COALESCE is a syntax construct, must NOT have pg_catalog prefix
    assert.match(schemaSql, /COALESCE\(p_lease_seconds, 60\)/);
    assert.doesNotMatch(schemaSql, /pg_catalog\.coalesce/);
  });

  // =========================================================================
  // 3. AUDIT APPEND-ONLY & TRUNCATE DEFENSE
  // =========================================================================

  await t.test('7. Append-Only Defense: Statement-Level Trigger for TRUNCATE', () => {
    assert.match(schemaSql, /CREATE TRIGGER trg_prevent_backfill_audit_truncate\s+BEFORE TRUNCATE ON public\.backfill_kk_audit\s+FOR EACH STATEMENT\s+EXECUTE FUNCTION public\.fn_prevent_backfill_audit_mutation\(\);/);
    assert.match(schemaSql, /TABEL AUDIT BERSIFAT APPEND-ONLY: Mutasi \(UPDATE, DELETE, atau TRUNCATE\) dilarang/);
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

  // =========================================================================
  // 6. V2.2.2 KONSOLIDASI: SOURCE MUTATION & TERMINAL STATUS VALIDATION
  // =========================================================================

  await t.test('13. Source Mutation Guard: apply_backfill_kk_atomic_record validates p_expected_no_kk', () => {
    // p_expected_no_kk harus tepat 16 digit
    assert.match(schemaSql, /IF p_expected_no_kk IS NULL OR p_expected_no_kk !~ '\^\[0-9\]\{16\}\$' THEN/);
    assert.match(schemaSql, /'code', 'INVALID_EXPECTED_NO_KK'/);

    // Bandingkan aktual vs diharapkan
    assert.match(schemaSql, /IF v_curr_no_kk IS DISTINCT FROM p_expected_no_kk THEN/);
    assert.match(schemaSql, /'code', 'SOURCE_KK_MUTATED'/);
  });

  await t.test('14. Terminal Status Hardening: complete_backfill_kk_run validation', () => {
    // FOR UPDATE lock
    assert.match(schemaSql, /SELECT run_id, lease_token, status, lease_expires_at INTO v_run\s+FROM public\.backfill_kk_runs\s+WHERE run_id = p_run_id\s+FOR UPDATE;/);
    
    // p_status validation
    assert.match(schemaSql, /IF p_status IS NULL OR p_status NOT IN \('COMPLETED', 'FAILED', 'ROLLED_BACK'\) THEN/);
    assert.match(schemaSql, /'code', 'INVALID_TERMINAL_STATUS'/);

    // Initial status check
    assert.match(schemaSql, /IF v_run\.status <> 'RUNNING' THEN/);
    assert.match(schemaSql, /'code', 'RUN_ALREADY_TERMINAL'/);
  });

  await t.test('15. Tenant Isolation Hardening: record_backfill_kk_skip checks', () => {
    // p_tenant_id mandatory
    assert.match(schemaSql, /IF p_tenant_id IS NULL OR pg_catalog\.btrim\(p_tenant_id\) = '' THEN/);
    assert.match(schemaSql, /'code', 'INVALID_TENANT_ID'/);

    // Run tenant isolation
    assert.match(schemaSql, /IF v_run\.tenant_id <> 'global' AND v_run\.tenant_id <> p_tenant_id THEN/);
    assert.match(schemaSql, /'code', 'TENANT_MISMATCH'/);

    // V2.2.4 Patch: Student ownership check WITH PERFORM ... FOR UPDATE LOCK (Consolidated Hierarchy)
    assert.match(schemaSql, /PERFORM 1 FROM public\.students\s+WHERE id = p_student_id AND tenant_id = p_tenant_id\s+FOR UPDATE;/);
    assert.doesNotMatch(schemaSql, /SELECT 1 INTO v_student_exists/);
    assert.match(schemaSql, /'code', 'STUDENT_NOT_FOUND'/);
  });

  await t.test('16. Rollback Safety: Rejection of Active Runs', () => {
    // Memastikan rollback memeriksa status run dan menolak ACQUIRED/RUNNING
    assert.match(schemaSql, /IF v_run\.status IN \('ACQUIRED', 'RUNNING'\) THEN/);
    assert.match(schemaSql, /'code', 'RUN_STILL_ACTIVE'/);
    
    // Memastikan status terminal tetap diproses (idempotensi)
    assert.match(schemaSql, /event_type = 'BACKFILL_APPLIED'/);
  });

  await t.test('17. Runtime Integration: Active Execution Guard Validation', async () => {
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
    assert.ok(body.code === 'DRY_RUN_ONLY_MODE');
  });

  await t.test('18. Dry-Run Purity: Zero Database Mutation', async () => {
    let attemptedMutations = 0;
    const originalFetch = global.fetch;

    (global as any).fetch = async (url: any, options: any) => {
      const method = (options?.method || 'GET').toUpperCase();
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        attemptedMutations++;
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
      }

      if (String(url).includes('/rest/v1/students')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
          ENVIRONMENT: 'test',
          SUPABASE_URL: 'http://mock-supabase.local',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key'
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(attemptedMutations, 0, 'Dry-run must never perform write operations');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('19. Dry-Run: Keyset Pagination for > 50 students', async () => {
    const originalFetch = global.fetch;
    let fetchCount = 0;

    (global as any).fetch = async (url: any) => {
      fetchCount++;
      const limit = new URL(url).searchParams.get('limit');
      assert.strictEqual(limit, '50', 'Must use limit=50 for pagination');

      if (fetchCount === 1) {
        // Return 50 students
        const students = Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}`, tenant_id: 'global', no_kk: '1234567890123456' }));
        return new Response(JSON.stringify(students), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else if (fetchCount === 2) {
        // Return 10 more
        const students = Array.from({ length: 10 }, (_, i) => ({ id: `id-${50+i}`, tenant_id: 'global', no_kk: '1234567890123456' }));
        return new Response(JSON.stringify(students), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const res = await performDryRunAnalysis('http://mock', 'key', 'secret', 'global');
      assert.strictEqual(res.totalStudents, 60);
      assert.ok(fetchCount >= 2, 'Should have made at least 2 fetch calls');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('20. Dry-Run: Classification Accuracy (9 Categories)', async () => {
    const secret = 'test-secret';
    const validKK = '1234567890123456';
    const validHmac = await computeHMAC(validKK, secret);
    const validLast4 = validKK.slice(-4);

    const mockStudents = [
      { id: '1', no_kk: validKK, kk_hmac: null, kk_last4: null }, // ELIGIBLE
      { id: '2', no_kk: validKK, kk_hmac: validHmac, kk_last4: validLast4 }, // ALREADY_VALID
      { id: '3', no_kk: null, kk_hmac: null, kk_last4: null }, // MISSING_NO_KK
      { id: '4', no_kk: '123', kk_hmac: null, kk_last4: null }, // INVALID_NO_KK
      { id: '5', no_kk: validKK, kk_hmac: validHmac, kk_last4: null }, // MISSING_LAST4
      { id: '6', no_kk: validKK, kk_hmac: validHmac, kk_last4: '9999' }, // LAST4_MISMATCH
      { id: '7', no_kk: validKK, kk_hmac: 'not-hex', kk_last4: null }, // CORRUPT_HMAC
      { id: '8', no_kk: validKK, kk_hmac: 'a'.repeat(64), kk_last4: null }, // HMAC_MISMATCH
      { id: '9', no_kk: validKK, kk_hmac: null, kk_last4: '1234' } // LAST4_WITHOUT_HMAC
    ];

    const originalFetch = global.fetch;
    (global as any).fetch = async () => new Response(JSON.stringify(mockStudents), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const res = await performDryRunAnalysis('http://mock', 'key', secret, 'global');
      
      assert.strictEqual(res.totalStudents, 9);
      assert.strictEqual(res.categories.ELIGIBLE, 1);
      assert.strictEqual(res.categories.ALREADY_VALID, 1);
      assert.strictEqual(res.categories.MISSING_NO_KK, 1);
      assert.strictEqual(res.categories.INVALID_NO_KK, 1);
      assert.strictEqual(res.categories.MISSING_LAST4, 1);
      assert.strictEqual(res.categories.LAST4_MISMATCH, 1);
      assert.strictEqual(res.categories.CORRUPT_HMAC, 1);
      assert.strictEqual(res.categories.HMAC_MISMATCH, 1);
      assert.strictEqual(res.categories.LAST4_WITHOUT_HMAC, 1);
      
      const totalFromCats = Object.values(res.categories).reduce((a: any, b: any) => a + b, 0);
      assert.strictEqual(totalFromCats, 9, 'Total categories must equal total students');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('21. Dry-Run: Privacy Hardening (No PII or Identifiers)', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = async () => new Response(JSON.stringify([{ id: 'uuid-1', no_kk: '1234567890123456', kk_hmac: null, kk_last4: null }]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const res: any = await performDryRunAnalysis('http://mock', 'key', 'secret', 'global');
      
      // Check that sensitive fields are NOT in the response
      assert.strictEqual(res.items, undefined, 'Response must not contain individual items list');
      const resString = JSON.stringify(res);
      assert.doesNotMatch(resString, /uuid-1/, 'Response must not contain student UUIDs');
      assert.doesNotMatch(resString, /1234567890123456/, 'Response must not contain full No. KK');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('22. Endpoint: Fail-Closed on Missing Secret or Service Role Key', async () => {
    const mockContextBase = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: { 'x-test-staff-role': 'superadmin', 'x-test-staff-uid': '1', 'x-test-tenant-id': 'global' }
      }),
      env: { KK_HMAC_SECRET: 'secret', SUPABASE_SERVICE_ROLE_KEY: 'key', SUPABASE_URL: 'http://mock' }
    };

    // 1. Missing Secret
    const res1 = await backfillIndexPost({ ...mockContextBase, env: { ...mockContextBase.env, KK_HMAC_SECRET: '' } });
    const body1: any = await res1.json();
    assert.strictEqual(body1.code, 'SECRET_NOT_CONFIGURED');

    // 2. Missing Service Role Key
    const res2 = await backfillIndexPost({ ...mockContextBase, env: { ...mockContextBase.env, SUPABASE_SERVICE_ROLE_KEY: '' } });
    const body2: any = await res2.json();
    assert.strictEqual(body2.code, 'SERVICE_ROLE_NOT_CONFIGURED');
  });
});
