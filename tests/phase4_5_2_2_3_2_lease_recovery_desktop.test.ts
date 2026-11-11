import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';
import { runKkHmacDryRun, executeKkHmacBackfill, isValidBackfillTenantId } from '../src/services/backfillService.js';

const MOCK_SECRET = 'chuvator-phase-4-5-2-2-3-2-secret-key-256bit!';
const MOCK_SUPABASE_URL = 'http://mock-supabase.local';
const MOCK_SERVICE_KEY = 'mock-service-role-key';

const TENANT_A_UUID = '11111111-2222-4333-8444-555555555551';
const TENANT_B_UUID = '99999999-8888-4777-8666-555555555552';

interface SimulatedStudent {
  id: string;
  tenant_id: string;
  no_kk: string | null;
  kk_hmac: string | null;
  kk_last4: string | null;
  mutationCount: number;
}

interface SimulatedRun {
  run_id: string;
  tenant_id: string;
  status: 'ACQUIRED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  lease_token: string;
  lease_expires_at: string;
  last_cursor: string | null;
  processed_count: number;
  skipped_count: number;
  failed_count: number;
}

function createAdvancedBackfillDbSimulator(
  initialStudents: SimulatedStudent[],
  initialRuns: SimulatedRun[] = []
) {
  const students = new Map<string, SimulatedStudent>(
    initialStudents.map((s) => [s.id, { ...s }])
  );
  const runs = new Map<string, SimulatedRun>(
    initialRuns.map((r) => [r.run_id, { ...r }])
  );
  let runSeq = 10;

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(urlStr);
    const method = (init?.method || 'GET').toUpperCase();
    const rawBody = init?.body ? JSON.parse(String(init.body)) : {};

    // 1. GET /rest/v1/students
    if (url.pathname === '/rest/v1/students' && method === 'GET') {
      const tenantEq = url.searchParams.get('tenant_id');
      const idGt = url.searchParams.get('id');
      const limit = Number(url.searchParams.get('limit') || 50);

      let list = Array.from(students.values());

      if (tenantEq && tenantEq.startsWith('eq.')) {
        const targetTenant = decodeURIComponent(tenantEq.slice(3));
        list = list.filter((s) => s.tenant_id === targetTenant);
      }

      list.sort((a, b) => a.id.localeCompare(b.id));

      if (idGt && idGt.startsWith('gt.')) {
        const cursor = decodeURIComponent(idGt.slice(3));
        list = list.filter((s) => s.id.localeCompare(cursor) > 0);
      }

      const sliced = list.slice(0, limit).map(({ mutationCount, ...rest }) => rest);
      return new Response(JSON.stringify(sliced), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. GET /rest/v1/backfill_kk_runs
    if (url.pathname === '/rest/v1/backfill_kk_runs' && method === 'GET') {
      const runIdEq = url.searchParams.get('run_id');
      if (runIdEq && runIdEq.startsWith('eq.')) {
        const targetRunId = decodeURIComponent(runIdEq.slice(3));
        const run = runs.get(targetRunId);
        return new Response(JSON.stringify(run ? [{ ...run }] : []), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(Array.from(runs.values())), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. PATCH /rest/v1/backfill_kk_runs (ATOMIC CAS LEASE RECOVERY)
    if (url.pathname === '/rest/v1/backfill_kk_runs' && method === 'PATCH') {
      const runIdEq = url.searchParams.get('run_id');
      const tenantIdEq = url.searchParams.get('tenant_id');
      const statusIn = url.searchParams.get('status');
      const leaseTokenEq = url.searchParams.get('lease_token');

      const targetRunId = runIdEq && runIdEq.startsWith('eq.') ? decodeURIComponent(runIdEq.slice(3)) : null;
      const targetTenant = tenantIdEq && tenantIdEq.startsWith('eq.') ? decodeURIComponent(tenantIdEq.slice(3)) : null;
      const targetLeaseToken = leaseTokenEq && leaseTokenEq.startsWith('eq.') ? decodeURIComponent(leaseTokenEq.slice(3)) : null;

      if (!targetRunId || !runs.has(targetRunId)) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const existingRun = runs.get(targetRunId)!;

      // ATOMIC CAS CONDITION MATCHING:
      if (
        existingRun.tenant_id === targetTenant &&
        ['RUNNING', 'ACQUIRED'].includes(existingRun.status) &&
        existingRun.lease_token === targetLeaseToken &&
        new Date(existingRun.lease_expires_at).getTime() <= Date.now()
      ) {
        // CAS MATCHES! Rotate lease token
        existingRun.lease_token = rawBody.lease_token;
        existingRun.status = rawBody.status || 'RUNNING';
        existingRun.lease_expires_at = rawBody.lease_expires_at;

        return new Response(JSON.stringify([{ ...existingRun }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // CAS MISMATCH (e.g., token already changed or status changed) -> Return 0 rows updated
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. POST /rest/v1/rpc/acquire_backfill_kk_lease
    if (url.pathname === '/rest/v1/rpc/acquire_backfill_kk_lease' && method === 'POST') {
      const tenantId = rawBody.p_tenant_id;
      const runId = `00000000-0000-4000-8000-${String(runSeq++).padStart(12, '0')}`;
      const leaseToken = `aaaaaaaa-bbbb-4ccc-8ddd-${String(runSeq).padStart(12, '0')}`;
      const newRun: SimulatedRun = {
        run_id: runId,
        tenant_id: tenantId,
        status: 'RUNNING',
        lease_token: leaseToken,
        lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      };
      runs.set(runId, newRun);
      return new Response(
        JSON.stringify({
          success: true,
          code: 'ACQUIRED',
          run_id: runId,
          lease_token: leaseToken,
          tenant_id: tenantId
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. POST /rest/v1/rpc/apply_backfill_kk_atomic_record
    if (url.pathname === '/rest/v1/rpc/apply_backfill_kk_atomic_record' && method === 'POST') {
      const studentId = rawBody.p_student_id;
      const runId = rawBody.p_run_id;
      const leaseToken = rawBody.p_lease_token;
      const tenantId = rawBody.p_tenant_id;

      const run = runs.get(runId);
      if (!run) {
        return new Response(JSON.stringify({ success: false, code: 'RUN_NOT_FOUND' }), { status: 200 });
      }
      if (run.lease_token !== leaseToken) {
        return new Response(JSON.stringify({ success: false, code: 'FENCING_TOKEN_MISMATCH' }), { status: 200 });
      }
      if (run.status !== 'RUNNING') {
        return new Response(JSON.stringify({ success: false, code: 'RUN_INACTIVE' }), { status: 200 });
      }

      const student = students.get(studentId);
      if (!student || student.tenant_id !== tenantId) {
        return new Response(JSON.stringify({ success: false, code: 'STUDENT_NOT_FOUND' }), { status: 200 });
      }

      student.kk_hmac = rawBody.p_new_hmac;
      student.kk_last4 = rawBody.p_new_last4;
      student.mutationCount += 1;

      run.processed_count += 1;
      run.last_cursor = studentId;

      return new Response(
        JSON.stringify({ success: true, code: 'UPDATED' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. POST /rest/v1/rpc/record_backfill_kk_skip
    if (url.pathname === '/rest/v1/rpc/record_backfill_kk_skip' && method === 'POST') {
      const studentId = rawBody.p_student_id;
      const runId = rawBody.p_run_id;
      const leaseToken = rawBody.p_lease_token;

      const run = runs.get(runId);
      if (!run || run.lease_token !== leaseToken) {
        return new Response(JSON.stringify({ success: false, code: 'FENCING_TOKEN_MISMATCH' }), { status: 200 });
      }

      run.skipped_count += 1;
      run.last_cursor = studentId;

      return new Response(
        JSON.stringify({ success: true, code: 'SKIPPED_RECORDED' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. POST /rest/v1/rpc/heartbeat_backfill_kk_lease
    if (url.pathname === '/rest/v1/rpc/heartbeat_backfill_kk_lease' && method === 'POST') {
      const run = runs.get(rawBody.p_run_id);
      if (!run || run.lease_token !== rawBody.p_lease_token || run.status !== 'RUNNING') {
        return new Response(
          JSON.stringify({ success: false, code: 'LEASE_LOST_OR_TOKEN_INVALID' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      run.lease_expires_at = new Date(Date.now() + 120_000).toISOString();
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 8. POST /rest/v1/rpc/complete_backfill_kk_run
    if (url.pathname === '/rest/v1/rpc/complete_backfill_kk_run' && method === 'POST') {
      const run = runs.get(rawBody.p_run_id);
      if (!run || run.lease_token !== rawBody.p_lease_token || run.status !== 'RUNNING') {
        return new Response(JSON.stringify({ success: false, code: 'RUN_ALREADY_TERMINAL' }), { status: 200 });
      }
      run.status = rawBody.p_status;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unmocked route' }), { status: 404 });
  };

  return { students, runs, fetchImpl };
}

function makeEnv() {
  return {
    ENVIRONMENT: 'test',
    KK_HMAC_SECRET: MOCK_SECRET,
    SUPABASE_URL: MOCK_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
  };
}

test('CHUVATOR — PHASE 4.5.2.2.3.2: Lease Recovery & Desktop Compatibility Suite (20 Mandatory Scenarios)', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ===========================================================================
  // 1. Lease expired berhasil dipulihkan via Atomic CAS PATCH
  // ===========================================================================
  await t.test('1. Lease expired berhasil dipulihkan via Atomic CAS PATCH (returns leaseRecovered: true)', async () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    const oldLeaseToken = 'old-token-111';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [{ id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        execute: true,
        runId,
        leaseToken: oldLeaseToken,
        batchSize: 50
      })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200, 'Lease recovery harus berhasil HTTP 200');
    const body: any = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.leaseRecovered, true);
    assert.equal(body.data.leaseRecovered, true);
  });

  // ===========================================================================
  // 2. run_id tetap sama setelah lease recovery
  // ===========================================================================
  await t.test('2. run_id tetap sama setelah lease recovery', async () => {
    const runId = '22222222-2222-4222-8222-222222222222';
    const oldLeaseToken = 'old-token-222';
    const expiredTime = new Date(Date.now() - 10_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [{ id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    const body: any = await res.json();
    assert.equal(body.data.runId, runId, 'run_id tidak boleh berubah');
  });

  // ===========================================================================
  // 3. tenant_id tetap sama setelah lease recovery
  // ===========================================================================
  await t.test('3. tenant_id tetap sama setelah lease recovery', async () => {
    const runId = '33333333-3333-4333-8333-333333333333';
    const oldLeaseToken = 'old-token-333';
    const expiredTime = new Date(Date.now() - 5_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [{ id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    const body: any = await res.json();
    assert.equal(body.data.tenantId, TENANT_A_UUID, 'tenant_id tidak boleh berubah');
  });

  // ===========================================================================
  // 4. last_cursor tetap sama (dari database) saat lease recovery
  // ===========================================================================
  await t.test('4. last_cursor tetap sama dari database saat lease recovery', async () => {
    const runId = '44444444-4444-4444-8444-444444444444';
    const oldLeaseToken = 'old-token-444';
    const expiredTime = new Date(Date.now() - 15_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [{ id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    const body: any = await res.json();
    assert.equal(body.data.lastCursor, 'std-002', 'Setelah batch diproses, cursor menunjuk std-002');
  });

  // ===========================================================================
  // 5. Lease token berubah (rotasi) saat recovery
  // ===========================================================================
  await t.test('5. Lease token berubah (berotasi ke token baru) saat recovery', async () => {
    const runId = '55555555-5555-4555-8555-555555555555';
    const oldLeaseToken = 'old-token-555';
    const expiredTime = new Date(Date.now() - 20_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [{ id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    const body: any = await res.json();
    assert.notEqual(body.data.leaseToken, oldLeaseToken, 'Lease token baru wajib berbeda dari token lama');
  });

  // ===========================================================================
  // 6. Token lama ditolak pasca rotasi
  // ===========================================================================
  await t.test('6. Token lama ditolak dengan HTTP 409 FENCING_TOKEN_STALE setelah rotasi', async () => {
    const runId = '66666666-6666-4666-8666-666666666666';
    const oldLeaseToken = 'old-token-666';
    const expiredTime = new Date(Date.now() - 20_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [
        { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-003', tenant_id: TENANT_A_UUID, no_kk: '3506011234560003', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    // 1. Panggilan Recovery pertama: Berhasil merotasi token
    const req1 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken, batchSize: 1 })
    });
    const res1 = await backfillIndexPost({ request: req1, env: makeEnv() });
    const body1: any = await res1.json();
    assert.equal(res1.status, 200);

    // 2. Worker lama mencoba memanggil ulang dengan oldLeaseToken
    const req2 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });
    const res2 = await backfillIndexPost({ request: req2, env: makeEnv() });
    assert.equal(res2.status, 409);
    const body2: any = await res2.json();
    assert.equal(body2.code, 'FENCING_TOKEN_STALE');
  });

  // ===========================================================================
  // 7. Dua request recovery serentak: hanya satu berhasil (Atomic CAS)
  // ===========================================================================
  await t.test('7. Dua request recovery serentak: hanya satu berhasil (Atomic CAS lock)', async () => {
    const runId = '77777777-7777-4777-8777-777777777777';
    const oldLeaseToken = 'shared-old-token-777';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [{ id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const makeRequest = () => new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const [resA, resB] = await Promise.all([
      backfillIndexPost({ request: makeRequest(), env: makeEnv() }),
      backfillIndexPost({ request: makeRequest(), env: makeEnv() })
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [200, 409], 'Tepat 1 request harus 200 OK dan 1 request 409 FENCING_TOKEN_STALE');
  });

  // ===========================================================================
  // 8. Lease yang belum kedaluwarsa ditolak untuk recovery attempt
  // ===========================================================================
  await t.test('8. Lease yang belum kedaluwarsa dengan token tidak cocok ditolak (HTTP 409 FENCING_TOKEN_STALE)', async () => {
    const runId = '88888888-8888-4888-8888-888888888888';
    const activeLeaseToken = 'active-valid-token-888';
    const validFutureTime = new Date(Date.now() + 60_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [{ id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: activeLeaseToken,
        lease_expires_at: validFutureTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: 'wrong-token-attempt' })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.code, 'FENCING_TOKEN_STALE');
  });

  // ===========================================================================
  // 9. Lease null atau tidak valid ditolak
  // ===========================================================================
  await t.test('9. Lease token null atau kosong saat resume ditolak (HTTP 409 MISSING_LEASE_TOKEN)', async () => {
    const runId = '99999999-9999-4999-8999-999999999999';

    const sim = createAdvancedBackfillDbSimulator(
      [],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: 'valid-token-999',
        lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: '' })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.code, 'MISSING_LEASE_TOKEN');
  });

  // ===========================================================================
  // 10. Tenant A tidak dapat memulihkan run Tenant B
  // ===========================================================================
  await t.test('10. Tenant A tidak dapat memulihkan run Tenant B (HTTP 403 TENANT_MISMATCH_ON_RESUME)', async () => {
    const runBelongingToTenantB = '10101010-1010-4010-8010-101010101010';
    const oldLeaseTokenB = 'lease-token-b-10';

    const sim = createAdvancedBackfillDbSimulator(
      [],
      [{
        run_id: runBelongingToTenantB,
        tenant_id: TENANT_B_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseTokenB,
        lease_expires_at: new Date(Date.now() - 10_000).toISOString(),
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID, // Tenant A!
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId: runBelongingToTenantB, leaseToken: oldLeaseTokenB })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.code, 'TENANT_MISMATCH_ON_RESUME');
  });

  // ===========================================================================
  // 11. Run COMPLETED tidak dapat dipulihkan
  // ===========================================================================
  await t.test('11. Run COMPLETED tidak dapat dipulihkan (HTTP 400 RUN_NOT_ACTIVE)', async () => {
    const runId = '11000000-1100-4100-8100-110000000000';
    const token = 'token-completed-11';

    const sim = createAdvancedBackfillDbSimulator(
      [],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'COMPLETED',
        lease_token: token,
        lease_expires_at: new Date(Date.now() - 10_000).toISOString(),
        last_cursor: 'std-005',
        processed_count: 5,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: token })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.code, 'RUN_NOT_ACTIVE');
  });

  // ===========================================================================
  // 12. Run FAILED tidak dapat dipulihkan
  // ===========================================================================
  await t.test('12. Run FAILED tidak dapat dipulihkan (HTTP 400 RUN_NOT_ACTIVE)', async () => {
    const runId = '12000000-1200-4120-8120-120000000000';
    const token = 'token-failed-12';

    const sim = createAdvancedBackfillDbSimulator(
      [],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'FAILED',
        lease_token: token,
        lease_expires_at: new Date(Date.now() - 10_000).toISOString(),
        last_cursor: 'std-002',
        processed_count: 2,
        skipped_count: 0,
        failed_count: 1
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: token })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.code, 'RUN_NOT_ACTIVE');
  });

  // ===========================================================================
  // 13. Run ROLLED_BACK tidak dapat dipulihkan
  // ===========================================================================
  await t.test('13. Run ROLLED_BACK tidak dapat dipulihkan (HTTP 400 RUN_NOT_ACTIVE)', async () => {
    const runId = '13000000-1300-4130-8130-130000000000';
    const token = 'token-rolled-back-13';

    const sim = createAdvancedBackfillDbSimulator(
      [],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'ROLLED_BACK',
        lease_token: token,
        lease_expires_at: new Date(Date.now() - 10_000).toISOString(),
        last_cursor: 'std-002',
        processed_count: 2,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: token })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.code, 'RUN_NOT_ACTIVE');
  });

  // ===========================================================================
  // 14. Client tidak dapat mengganti cursor
  // ===========================================================================
  await t.test('14. Client tidak dapat mengganti cursor (HTTP 400 CLIENT_CURSOR_REJECTED)', async () => {
    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, cursor: 'std-spoofed-cursor' })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.code, 'CLIENT_CURSOR_REJECTED');
  });

  // ===========================================================================
  // 15. Batch setelah recovery melanjutkan dari cursor database
  // ===========================================================================
  await t.test('15. Batch setelah recovery melanjutkan dari cursor database (last_cursor)', async () => {
    const runId = '15000000-1500-4150-8150-150000000000';
    const oldLeaseToken = 'token-recovery-15';
    const expiredTime = new Date(Date.now() - 10_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: 'already-done', kk_last4: '0001', mutationCount: 0 },
        { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();

    assert.equal(body.data.batchCount, 1, 'Hanya mengambil std-002 setelah cursor std-001');
    assert.equal(body.data.processed, 1);
    assert.equal(body.data.lastCursor, 'std-002');
  });

  // ===========================================================================
  // 16. Tidak terjadi mutasi ulang terhadap record yang sudah berhasil
  // ===========================================================================
  await t.test('16. Tidak terjadi mutasi ulang terhadap record yang sudah berhasil (mutationCount === 0 for std-001)', async () => {
    const runId = '16000000-1600-4160-8160-160000000000';
    const oldLeaseToken = 'token-recovery-16';
    const expiredTime = new Date(Date.now() - 10_000).toISOString();

    const sim = createAdvancedBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: 'hmac-std-001', kk_last4: '0001', mutationCount: 0 },
        { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-001',
        processed_count: 1,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);

    assert.equal(sim.students.get('std-001')!.mutationCount, 0, 'std-001 tidak boleh dimutasi ulang');
    assert.equal(sim.students.get('std-002')!.mutationCount, 1, 'std-002 dimutasi 1 kali');
  });

  // ===========================================================================
  // 17. Desktop tidak memiliki fallback `global`
  // ===========================================================================
  await t.test('17. Source Code Desktop (TenantBackfillControlCard.jsx & PengaturanPage.jsx) tidak memiliki fallback global', () => {
    const cardJsx = fs.readFileSync(path.join(process.cwd(), 'src/components/TenantBackfillControlCard.jsx'), 'utf8');
    const pengaturanJsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/PengaturanPage.jsx'), 'utf8');

    assert.doesNotMatch(cardJsx, /tenantId\s*=\s*['"]global['"]/);
    assert.doesNotMatch(pengaturanJsx, /tenantId=\{[^}]*\|\|\s*['"]global['"]\}/);
  });

  // ===========================================================================
  // 18. Superadmin tidak melihat kontrol backfill
  // ===========================================================================
  await t.test('18. PengaturanPage.jsx merender TenantBackfillControlCard hanya untuk owner dan admin, bukan superadmin', () => {
    const pengaturanJsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/PengaturanPage.jsx'), 'utf8');
    assert.match(pengaturanJsx, /userProfile\?\.role === 'owner' \|\| userProfile\?\.role === 'admin'/);
    assert.doesNotMatch(pengaturanJsx, /userProfile\?\.role === 'superadmin'.*TenantBackfillControlCard/);
  });

  // ===========================================================================
  // 19. Owner/Admin dengan tenant UUID valid tetap dapat mengakses kontrol desktop
  // ===========================================================================
  await t.test('19. isValidBackfillTenantId mengonfirmasi UUID valid untuk Owner/Admin', () => {
    assert.equal(isValidBackfillTenantId(TENANT_A_UUID), true);
    assert.equal(isValidBackfillTenantId(TENANT_B_UUID), true);
    assert.equal(isValidBackfillTenantId('global'), false);
    assert.equal(isValidBackfillTenantId('   '), false);
    assert.equal(isValidBackfillTenantId(null as any), false);
  });

  // ===========================================================================
  // 20. Tenant ID belum tersedia menyebabkan tombol nonaktif
  // ===========================================================================
  await t.test('20. isValidBackfillTenantId menolak string kosong, null, atau whitespace sehingga tombol nonaktif', () => {
    for (const invalidTenant of ['', '   ', 'global', 'not-uuid', null, undefined]) {
      assert.equal(isValidBackfillTenantId(invalidTenant as any), false, `Tenant '${invalidTenant}' harus dianggap tidak valid`);
    }
  });
});
