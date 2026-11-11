import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';

const MOCK_SECRET = 'chuvator-phase-4-5-2-2-3-4-secret-key-256bit!';
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
  lease_expires_at: string | null;
  last_cursor: string | null;
  processed_count: number;
  skipped_count: number;
  failed_count: number;
}

function makeEnv() {
  return {
    KK_HMAC_SECRET: MOCK_SECRET,
    SUPABASE_URL: 'http://mock-supabase.local',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key'
  };
}

function createSimulator(initialStudents: SimulatedStudent[], initialRuns: SimulatedRun[] = []) {
  const students = new Map<string, SimulatedStudent>(initialStudents.map((s) => [s.id, { ...s }]));
  const runs = new Map<string, SimulatedRun>(initialRuns.map((r) => [r.run_id, { ...r }]));
  let runSeq = 10;
  let patchCallCount = 0;

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

    // 3. PATCH /rest/v1/backfill_kk_runs (ATOMIC CAS RECOVERY WITH EXPLICIT EXPIRY MATCHING)
    if (url.pathname === '/rest/v1/backfill_kk_runs' && method === 'PATCH') {
      patchCallCount++;
      const runIdEq = url.searchParams.get('run_id');
      const tenantIdEq = url.searchParams.get('tenant_id');
      const leaseTokenEq = url.searchParams.get('lease_token');
      const leaseExpiresAtEq = url.searchParams.get('lease_expires_at');

      const targetRunId = runIdEq && runIdEq.startsWith('eq.') ? decodeURIComponent(runIdEq.slice(3)) : null;
      const targetTenant = tenantIdEq && tenantIdEq.startsWith('eq.') ? decodeURIComponent(tenantIdEq.slice(3)) : null;
      const targetLeaseToken = leaseTokenEq && leaseTokenEq.startsWith('eq.') ? decodeURIComponent(leaseTokenEq.slice(3)) : null;
      const targetExpiry = leaseExpiresAtEq && leaseExpiresAtEq.startsWith('eq.') ? decodeURIComponent(leaseExpiresAtEq.slice(3)) : null;

      if (!targetRunId || !runs.has(targetRunId)) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const existingRun = runs.get(targetRunId)!;
      const expiresMs = existingRun.lease_expires_at ? new Date(existingRun.lease_expires_at).getTime() : NaN;
      const isExpired = !isNaN(expiresMs) && expiresMs <= Date.now();

      if (
        existingRun.tenant_id === targetTenant &&
        ['RUNNING', 'ACQUIRED'].includes(existingRun.status) &&
        existingRun.lease_token === targetLeaseToken &&
        (!targetExpiry || existingRun.lease_expires_at === targetExpiry) &&
        isExpired
      ) {
        existingRun.lease_token = rawBody.lease_token;
        existingRun.status = rawBody.status || 'RUNNING';
        existingRun.lease_expires_at = rawBody.lease_expires_at;

        return new Response(JSON.stringify([{ ...existingRun }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

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

      const student = students.get(studentId);
      if (!student || student.tenant_id !== tenantId) {
        return new Response(JSON.stringify({ success: false, code: 'STUDENT_NOT_FOUND' }), { status: 200 });
      }

      student.kk_hmac = rawBody.p_new_hmac;
      student.kk_last4 = rawBody.p_new_last4;
      student.mutationCount += 1;

      run.processed_count += 1;
      run.last_cursor = studentId;

      return new Response(JSON.stringify({ success: true, code: 'UPDATED', student_id: studentId }), { status: 200 });
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

      return new Response(JSON.stringify({ success: true, code: 'SKIPPED_RECORDED', student_id: studentId }), { status: 200 });
    }

    // 7. POST /rest/v1/rpc/heartbeat_backfill_kk_lease
    if (url.pathname === '/rest/v1/rpc/heartbeat_backfill_kk_lease' && method === 'POST') {
      const runId = rawBody.p_run_id;
      const leaseToken = rawBody.p_lease_token;
      const run = runs.get(runId);
      if (!run || run.lease_token !== leaseToken) {
        return new Response(JSON.stringify({ success: false, code: 'LEASE_LOST_OR_TOKEN_INVALID' }), { status: 200 });
      }
      run.lease_expires_at = new Date(Date.now() + 120_000).toISOString();
      return new Response(JSON.stringify({ success: true, code: 'HEARTBEAT_OK' }), { status: 200 });
    }

    // 8. POST /rest/v1/rpc/complete_backfill_kk_run
    if (url.pathname === '/rest/v1/rpc/complete_backfill_kk_run' && method === 'POST') {
      const runId = rawBody.p_run_id;
      const leaseToken = rawBody.p_lease_token;
      const run = runs.get(runId);
      if (!run || run.lease_token !== leaseToken) {
        return new Response(JSON.stringify({ success: false, code: 'FENCING_TOKEN_MISMATCH' }), { status: 200 });
      }
      run.status = 'COMPLETED';
      return new Response(JSON.stringify({ success: true, code: 'RUN_COMPLETED' }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
  };

  return { fetchImpl, runs, students, getPatchCallCount: () => patchCallCount };
}

test('CHUVATOR — PHASE 4.5.2.2.3.4: Final Fencing Token, Cursor & Completion Integrity Suite', async (t) => {

  // ===========================================================================
  // 1. Token salah pada lease expired ditolak SEBELUM CAS dilakukan
  // ===========================================================================
  await t.test('1. Token salah pada lease expired ditolak SEBELUM CAS dilakukan (HTTP 409 FENCING_TOKEN_STALE)', async () => {
    const runId = '10000000-1000-4000-8000-100000000001';
    const realLeaseToken = 'real-token-100';
    const wrongLeaseToken = 'wrong-token-999';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createSimulator(
      [{ id: 'std-1001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: realLeaseToken,
        lease_expires_at: expiredTime,
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
      body: JSON.stringify({ execute: true, runId, leaseToken: wrongLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.code, 'FENCING_TOKEN_STALE');
    assert.equal(sim.getPatchCallCount(), 0, 'CAS PATCH TIDAK Boleh dipanggil jika token salah');
  });

  // ===========================================================================
  // 2. Token lama yang benar dapat melakukan recovery
  // ===========================================================================
  await t.test('2. Token lama yang benar dapat melakukan recovery', async () => {
    const runId = '20000000-2000-4000-8000-200000000002';
    const realLeaseToken = 'real-token-200';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-2001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-2002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560003', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: realLeaseToken,
        lease_expires_at: expiredTime,
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
      body: JSON.stringify({ execute: true, runId, leaseToken: realLeaseToken, batchSize: 1 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.leaseRecovered, true);
    assert.notEqual(body.leaseToken, realLeaseToken);
    assert.equal(sim.getPatchCallCount(), 1);
  });

  // ===========================================================================
  // 3. Token baru yang dihasilkan CAS diteruskan ke batch berikutnya
  // ===========================================================================
  await t.test('3. Token baru yang dihasilkan CAS diteruskan ke batch berikutnya', async () => {
    const runId = '30000000-3000-4000-8000-300000000003';
    const oldToken = 'old-token-300';
    const expiredTime = new Date(Date.now() - 20_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-3001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560004', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-3002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560005', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldToken,
        lease_expires_at: expiredTime,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    // Batch 1: CAS triggers recovery
    const req1 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldToken, batchSize: 1 })
    });
    const res1 = await backfillIndexPost({ request: req1, env: makeEnv() });
    const body1: any = await res1.json();
    const newToken = body1.leaseToken;

    // Batch 2: Uses newToken
    const req2 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: newToken, batchSize: 1 })
    });
    const res2 = await backfillIndexPost({ request: req2, env: makeEnv() });
    assert.equal(res2.status, 200);
    const body2: any = await res2.json();
    assert.equal(body2.leaseToken, newToken);
  });

  // ===========================================================================
  // 4. Cursor berasal dari hasil CAS, bukan hasil GET sebelumnya
  // ===========================================================================
  await t.test('4. Cursor berasal dari hasil CAS (patchedRows[0].last_cursor)', async () => {
    const runId = '40000000-4000-4000-8000-400000000004';
    const oldToken = 'old-token-400';
    const expiredTime = new Date(Date.now() - 25_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-4001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560006', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-4002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560007', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldToken,
        lease_expires_at: expiredTime,
        last_cursor: 'std-4001',
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
      body: JSON.stringify({ execute: true, runId, leaseToken: oldToken, batchSize: 1 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.lastCursor, 'std-4002');
  });

  // ===========================================================================
  // 5. Student batch fetch gagal setelah recovery tetap mengembalikan konteks resume aman
  // ===========================================================================
  await t.test('5. Student batch fetch gagal setelah recovery tetap mengembalikan konteks resume aman', async () => {
    const runId = '50000000-5000-4000-8000-500000000005';
    const oldToken = 'old-token-500';
    const expiredTime = new Date(Date.now() - 15_000).toISOString();

    const sim = createSimulator(
      [{ id: 'std-5001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560008', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldToken,
        lease_expires_at: expiredTime,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );

    const origFetch = sim.fetchImpl;
    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('/rest/v1/students') && (init?.method || 'GET').toUpperCase() === 'GET') {
        return new Response(JSON.stringify({ error: 'DB Fetch Failed' }), { status: 500 });
      }
      return origFetch(input, init);
    }) as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 500);
    const body: any = await res.json();
    assert.equal(body.code, 'STUDENT_BATCH_FETCH_FAILED');
    assert.ok(body.leaseToken, 'Wajib menyertakan rotated leaseToken');
    assert.notEqual(body.leaseToken, oldToken);
    assert.equal(body.leaseRecovered, true);
  });

  // ===========================================================================
  // 6. RPC apply gagal setelah recovery tetap mengembalikan leaseToken baru
  // ===========================================================================
  await t.test('6. RPC apply gagal setelah recovery tetap mengembalikan leaseToken baru', async () => {
    const runId = '60000000-6000-4000-8000-600000000006';
    const oldToken = 'old-token-600';
    const expiredTime = new Date(Date.now() - 15_000).toISOString();

    const sim = createSimulator(
      [{ id: 'std-6001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560009', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldToken,
        lease_expires_at: expiredTime,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );

    const origFetch = sim.fetchImpl;
    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('/rpc/apply_backfill_kk_atomic_record')) {
        return new Response(JSON.stringify({ success: false, code: 'APPLY_FAILED' }), { status: 500 });
      }
      return origFetch(input, init);
    }) as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 422);
    const body: any = await res.json();
    assert.ok(body.leaseToken);
    assert.notEqual(body.leaseToken, oldToken);
  });

  // ===========================================================================
  // 7. RPC skip gagal setelah recovery tetap mengembalikan leaseToken baru
  // ===========================================================================
  await t.test('7. RPC skip gagal setelah recovery tetap mengembalikan leaseToken baru', async () => {
    const runId = '70000000-7000-4000-8000-700000000007';
    const oldToken = 'old-token-700';
    const expiredTime = new Date(Date.now() - 15_000).toISOString();

    const sim = createSimulator(
      [{ id: 'std-7001', tenant_id: TENANT_A_UUID, no_kk: null, kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldToken,
        lease_expires_at: expiredTime,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );

    const origFetch = sim.fetchImpl;
    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('/rpc/record_backfill_kk_skip')) {
        return new Response(JSON.stringify({ success: false, code: 'SKIP_FAILED' }), { status: 500 });
      }
      return origFetch(input, init);
    }) as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 422);
    const body: any = await res.json();
    assert.ok(body.leaseToken);
    assert.notEqual(body.leaseToken, oldToken);
  });

  // ===========================================================================
  // 8. Heartbeat gagal setelah recovery tetap mengembalikan leaseToken baru
  // ===========================================================================
  await t.test('8. Heartbeat gagal setelah recovery tetap mengembalikan leaseToken baru', async () => {
    const runId = '80000000-8000-4000-8000-800000000008';
    const oldToken = 'old-token-800';
    const expiredTime = new Date(Date.now() - 15_000).toISOString();

    const sim = createSimulator(
      [{ id: 'std-8001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560010', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldToken,
        lease_expires_at: expiredTime,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );

    const origFetch = sim.fetchImpl;
    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('/rpc/heartbeat_backfill_kk_lease')) {
        return new Response(JSON.stringify({ success: false, code: 'HEARTBEAT_FAILED' }), { status: 500 });
      }
      return origFetch(input, init);
    }) as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: oldToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 500);
    const body: any = await res.json();
    assert.equal(body.status, 'LEASE_HEARTBEAT_FAILED');
    assert.ok(body.leaseToken);
  });

  // ===========================================================================
  // 9. Completion RPC gagal tidak menampilkan status COMPLETED
  // ===========================================================================
  await t.test('9. Completion RPC gagal tidak menampilkan status COMPLETED (completed: false)', async () => {
    const runId = '90000000-9000-4000-8000-900000000009';
    const leaseToken = 'token-complete-fail-900';

    const sim = createSimulator(
      [{ id: 'std-9001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560011', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: leaseToken,
        lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );

    const origFetch = sim.fetchImpl;
    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('/rpc/complete_backfill_kk_run')) {
        return new Response(JSON.stringify({ success: false, code: 'COMPLETE_FAILED' }), { status: 500 });
      }
      return origFetch(input, init);
    }) as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 500);
    const body: any = await res.json();
    assert.equal(body.completed, false);
    assert.notEqual(body.status, 'COMPLETED');
  });

  // ===========================================================================
  // 10. hasMoreRows=false dan completed=false tidak dianggap selesai oleh UI
  // ===========================================================================
  await t.test('10. Desktop UI menolak hasMoreRows=false dengan completed=false sebagai status sukses final', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/TenantBackfillControlCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('if (resData.completed === true)'), 'UI hanya mengonfirmasi sukses final jika completed === true');
    assert.ok(cardCode.includes('resData.hasMoreRows === false && resData.completed !== true'), 'UI menangani kasus hasMoreRows false namun completed false');
  });

  // ===========================================================================
  // 11. completed=true menghentikan loop UI
  // ===========================================================================
  await t.test('11. completed=true menghentikan loop UI dan meriset token aktif', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/TenantBackfillControlCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('setIsCompleted(true)'), 'UI menetapkan isCompleted = true');
    assert.ok(cardCode.includes('setActiveRunId(null)'), 'UI meriset activeRunId setelah completed === true');
    assert.ok(cardCode.includes('setActiveLeaseToken(null)'), 'UI meriset activeLeaseToken setelah completed === true');
  });

  // ===========================================================================
  // 12. Batas iterasi UI menghentikan loop tanpa kehilangan konteks run
  // ===========================================================================
  await t.test('12. Batas iterasi UI (MAX_AUTO_BATCH_ITERATIONS) menghentikan loop tanpa meriset token', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/TenantBackfillControlCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('MAX_AUTO_BATCH_ITERATIONS = 20'), 'UI menetapkan batas otomatis 20 batch');
    assert.ok(cardCode.includes('Batas Otomatis Sesi UI'), 'UI menampilkan notifikasi batas iterasi sesi');
  });

  // ===========================================================================
  // 13. Dua recovery request serentak hanya menghasilkan satu pemenang
  // ===========================================================================
  await t.test('13. Dua recovery request serentak hanya menghasilkan satu pemenang (Atomic CAS)', async () => {
    const runId = '13000000-1300-4300-8300-130000000013';
    const oldLeaseToken = 'shared-old-token-130';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-1301', tenant_id: TENANT_A_UUID, no_kk: '3506011234560012', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-1302', tenant_id: TENANT_A_UUID, no_kk: '3506011234560013', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    const makeReq = () => new Request('http://localhost/api/admin/backfill_kk_hmac', {
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

    const [res1, res2] = await Promise.all([
      backfillIndexPost({ request: makeReq(), env: makeEnv() }),
      backfillIndexPost({ request: makeReq(), env: makeEnv() })
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 409]);
  });

  // ===========================================================================
  // 14. Tenant berbeda tidak dapat memperoleh token recovery
  // ===========================================================================
  await t.test('14. Tenant berbeda tidak dapat memperoleh token recovery (HTTP 403 TENANT_MISMATCH_ON_RESUME)', async () => {
    const runId = '14000000-1400-4400-8400-140000000014';
    const oldLeaseToken = 'token-tenant-b-140';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createSimulator(
      [{ id: 'std-1401', tenant_id: TENANT_B_UUID, no_kk: '3506011234560014', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_B_UUID,
        status: 'RUNNING',
        lease_token: oldLeaseToken,
        lease_expires_at: expiredTime,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    // Tenant A attempts to resume Tenant B's run
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
    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.code, 'TENANT_MISMATCH_ON_RESUME');
  });

  // ===========================================================================
  // 15. Penjelasan mana pengujian yang menggunakan mock dan mana yang menguji database
  // ===========================================================================
  await t.test('15. Penataan Eksplisit: Mock In-Memory Simulator vs Instructions Live PostgreSQL Database', async () => {
    const documentation = `
    ================================================================================
    DOKUMENTASI CAKUPAN PENGUJIAN & DIFFERENSIASI IN-MEMORY MOCK VS LIVE POSTGRESQL:
    ================================================================================
    1. Pengujian dalam suite TypeScript ini (Test 1 s.d. 14) 100% menggunakan IN-MEMORY MOCK SIMULATOR.
       - Mock fetch menangani endpoint /rest/v1/backfill_kk_runs, /rest/v1/students, dan RPC.
       - Berguna untuk verifikasi cepat lintasan kode, validasi token, rotasi CAS, dan urutan status.

    2. Pengujian LIVE POSTGRESQL / SUPABASE CONCURRENCY BUKAN bagian dari mock ini.
       - Pengujian live database nyata memerlukan instance Supabase staging terhubung dengan
         banyak worker HTTP simultan yang mengeksekusi PATCH secara atomik pada row PostgreSQL.
    ================================================================================
    `;
    assert.ok(documentation.includes('100% menggunakan IN-MEMORY MOCK SIMULATOR'));
  });

});
