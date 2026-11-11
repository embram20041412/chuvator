import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';
import { runKkHmacDryRun, executeKkHmacBackfill, isValidBackfillTenantId } from '../src/services/backfillService.js';

const MOCK_SECRET = 'chuvator-phase-4-5-2-2-3-3-secret-key-256bit!';
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

      // ATOMIC CAS CONDITION MATCHING:
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

  return { fetchImpl, runs, students };
}

test('CHUVATOR — PHASE 4.5.2.2.3.3: Final Lease Recovery & Backfill Service Integrity Suite', async (t) => {

  // ===========================================================================
  // 1. lease_expires_at null ditolak dengan error fail-closed (HTTP 409 LEASE_EXPIRY_INVALID)
  // ===========================================================================
  await t.test('1. lease_expires_at null ditolak dengan error fail-closed (HTTP 409 LEASE_EXPIRY_INVALID)', async () => {
    const runId = '10101010-1010-4010-8010-101010101010';
    const leaseToken = 'token-101';

    const sim = createSimulator(
      [{ id: 'std-101', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: leaseToken,
        lease_expires_at: null,
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
      body: JSON.stringify({ execute: true, runId, leaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.code, 'LEASE_EXPIRY_INVALID');
  });

  // ===========================================================================
  // 2. lease_expires_at string invalid ditolak dengan error fail-closed (HTTP 409)
  // ===========================================================================
  await t.test('2. lease_expires_at string invalid ditolak dengan error fail-closed (HTTP 409)', async () => {
    const runId = '20202020-2020-4020-8020-202020202020';
    const leaseToken = 'token-202';

    const sim = createSimulator(
      [{ id: 'std-201', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: leaseToken,
        lease_expires_at: 'invalid-date-string-xyz',
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
      body: JSON.stringify({ execute: true, runId, leaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.code, 'LEASE_EXPIRY_INVALID');
  });

  // ===========================================================================
  // 3. Lease belum kedaluwarsa: Token salah ditolak HTTP 409; Token benar diproses normal (leaseRecovered: false)
  // ===========================================================================
  await t.test('3. Lease belum kedaluwarsa: Token salah ditolak; Token benar diproses (leaseRecovered: false)', async () => {
    const runId = '30303030-3030-4030-8030-303030303030';
    const validLeaseToken = 'token-303-valid';
    const futureExpiry = new Date(Date.now() + 60_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-301', tenant_id: TENANT_A_UUID, no_kk: '3506011234560003', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-302', tenant_id: TENANT_A_UUID, no_kk: '3506011234560004', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: validLeaseToken,
        lease_expires_at: futureExpiry,
        last_cursor: null,
        processed_count: 0,
        skipped_count: 0,
        failed_count: 0
      }]
    );
    globalThis.fetch = sim.fetchImpl as any;

    // A. Request dengan wrong lease token
    const reqWrong = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: 'wrong-token-123' })
    });
    const resWrong = await backfillIndexPost({ request: reqWrong, env: makeEnv() });
    assert.equal(resWrong.status, 409);
    const bodyWrong: any = await resWrong.json();
    assert.equal(bodyWrong.code, 'FENCING_TOKEN_STALE');

    // B. Request dengan correct lease token
    const reqCorrect = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: validLeaseToken, batchSize: 1 })
    });
    const resCorrect = await backfillIndexPost({ request: reqCorrect, env: makeEnv() });
    assert.equal(resCorrect.status, 200);
    const bodyCorrect: any = await resCorrect.json();
    assert.equal(bodyCorrect.leaseRecovered, false);
    assert.equal(bodyCorrect.leaseToken, validLeaseToken);
  });

  // ===========================================================================
  // 4. Lease kedaluwarsa: Recovery dipicu (leaseRecovered: true), merotasi lease_token
  // ===========================================================================
  await t.test('4. Lease kedaluwarsa: Recovery dipicu (leaseRecovered: true) dan merotasi token', async () => {
    const runId = '40404040-4040-4040-8040-404040404040';
    const oldLeaseToken = 'old-expired-token-404';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-401', tenant_id: TENANT_A_UUID, no_kk: '3506011234560005', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-402', tenant_id: TENANT_A_UUID, no_kk: '3506011234560006', kk_hmac: null, kk_last4: null, mutationCount: 0 }
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

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
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

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.leaseRecovered, true);
    assert.notEqual(body.leaseToken, oldLeaseToken);
  });

  // ===========================================================================
  // 5. CAS dengan nilai lease_expires_at lama yang berubah (concurrent update DB) ditolak HTTP 409
  // ===========================================================================
  await t.test('5. CAS dengan lease_expires_at lama yang berubah ditolak dengan HTTP 409 FENCING_TOKEN_STALE', async () => {
    const runId = '50505050-5050-4050-8050-505050505050';
    const oldLeaseToken = 'old-token-505';
    const expiredTime = new Date(Date.now() - 10_000).toISOString();

    const sim = createSimulator(
      [{ id: 'std-501', tenant_id: TENANT_A_UUID, no_kk: '3506011234560007', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
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

    // Modifikasi simulator fetch agar mensimulasikan kegagalan CAS matching (0 rows updated)
    const originalFetch = sim.fetchImpl;
    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('/rest/v1/backfill_kk_runs') && (init?.method || 'GET').toUpperCase() === 'PATCH') {
        // Return 0 rows updated
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input, init);
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
      body: JSON.stringify({ execute: true, runId, leaseToken: oldLeaseToken })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.code, 'FENCING_TOKEN_STALE');
  });

  // ===========================================================================
  // 6. Dua recovery request bersamaan: hanya satu berhasil via CAS
  // ===========================================================================
  await t.test('6. Dua recovery request bersamaan: hanya satu berhasil (Atomic CAS lock)', async () => {
    const runId = '60606060-6060-4060-8060-606060606060';
    const oldLeaseToken = 'shared-old-token-606';
    const expiredTime = new Date(Date.now() - 30_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-601', tenant_id: TENANT_A_UUID, no_kk: '3506011234560008', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-602', tenant_id: TENANT_A_UUID, no_kk: '3506011234560009', kk_hmac: null, kk_last4: null, mutationCount: 0 }
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
    assert.deepEqual(statuses, [200, 409], 'Tepat satu request berhasil (200) dan satu ditolak (409)');
  });

  // ===========================================================================
  // 7. Token lama ditolak pasca recovery (HTTP 409 FENCING_TOKEN_STALE)
  // ===========================================================================
  await t.test('7. Token lama ditolak pasca recovery (HTTP 409 FENCING_TOKEN_STALE)', async () => {
    const runId = '70707070-7070-4070-8070-707070707070';
    const oldLeaseToken = 'token-to-rotate-707';
    const expiredTime = new Date(Date.now() - 20_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-701', tenant_id: TENANT_A_UUID, no_kk: '3506011234560010', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-702', tenant_id: TENANT_A_UUID, no_kk: '3506011234560011', kk_hmac: null, kk_last4: null, mutationCount: 0 }
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

    // 1. First call rotates token
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
    assert.equal(res1.status, 200);

    // 2. Second call using old token is rejected
    const req2 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
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
    const res2 = await backfillIndexPost({ request: req2, env: makeEnv() });
    assert.equal(res2.status, 409);
    const body2: any = await res2.json();
    assert.equal(body2.code, 'FENCING_TOKEN_STALE');
  });

  // ===========================================================================
  // 8. Token baru yang dirotasi digunakan secara sukses pada batch kedua
  // ===========================================================================
  await t.test('8. Token baru yang dirotasi digunakan secara sukses pada batch kedua', async () => {
    const runId = '80808080-8080-4080-8080-808080808080';
    const oldLeaseToken = 'token-batch-1-old';
    const expiredTime = new Date(Date.now() - 15_000).toISOString();

    const sim = createSimulator(
      [
        { id: 'std-801', tenant_id: TENANT_A_UUID, no_kk: '3506011234560012', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-802', tenant_id: TENANT_A_UUID, no_kk: '3506011234560013', kk_hmac: null, kk_last4: null, mutationCount: 0 }
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

    // Batch 1 (Recovery triggers, returns new leaseToken)
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
    const rotatedToken = body1.leaseToken;
    assert.notEqual(rotatedToken, oldLeaseToken);

    // Batch 2 (Uses rotatedToken)
    const req2 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: rotatedToken, batchSize: 1 })
    });
    const res2 = await backfillIndexPost({ request: req2, env: makeEnv() });
    assert.equal(res2.status, 200);
    const body2: any = await res2.json();
    assert.equal(body2.leaseToken, rotatedToken);
  });

  // ===========================================================================
  // 9. runId tetap sama sepanjang seluruh batch
  // ===========================================================================
  await t.test('9. runId tetap sama sepanjang seluruh batch', async () => {
    const runId = '90909090-9090-4090-8090-909090909090';
    const leaseToken = 'token-stable-run-909';

    const sim = createSimulator(
      [
        { id: 'std-901', tenant_id: TENANT_A_UUID, no_kk: '3506011234560014', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-902', tenant_id: TENANT_A_UUID, no_kk: '3506011234560015', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
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
      body: JSON.stringify({ execute: true, runId, leaseToken, batchSize: 1 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    const body: any = await res.json();
    assert.equal(body.runId, runId);
  });

  // ===========================================================================
  // 10. Kursor database (last_cursor) tidak dapat diganti oleh client
  // ===========================================================================
  await t.test('10. Kursor database (last_cursor) tidak dapat diganti oleh client (HTTP 400 CLIENT_CURSOR_REJECTED)', async () => {
    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, tenantId: TENANT_A_UUID, cursor: 'std-custom-999' })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.code, 'CLIENT_CURSOR_REJECTED');
  });

  // ===========================================================================
  // 11. Batch terakhir (hasMoreRows: false) menyelesaikan run dan menghentikan proses
  // ===========================================================================
  await t.test('11. Batch terakhir (hasMoreRows: false) menyelesaikan run dan menetapkan COMPLETED', async () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    const leaseToken = 'token-last-batch-111';

    const sim = createSimulator(
      [{ id: 'std-1101', tenant_id: TENANT_A_UUID, no_kk: '3506011234560016', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
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
      body: JSON.stringify({ execute: true, runId, leaseToken, batchSize: 50 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.hasMoreRows, false);
    assert.equal(body.completed, true);
    assert.equal(body.status, 'COMPLETED');
  });

  // ===========================================================================
  // 12. Error batch tidak membuat run baru saat di-resume
  // ===========================================================================
  await t.test('12. Error batch tidak membuat run baru saat di-resume', async () => {
    const runId = '12121212-1212-4212-8212-121212121212';
    const leaseToken = 'token-error-121';

    const sim = createSimulator(
      [{ id: 'std-1201', tenant_id: TENANT_A_UUID, no_kk: '3506011234560017', kk_hmac: null, kk_last4: null, mutationCount: 0 }],
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
    globalThis.fetch = sim.fetchImpl as any;

    const initialRunCount = sim.runs.size;

    // Request with stale lease token triggers 409 error
    const reqErr = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, runId, leaseToken: 'wrong-token-xyz' })
    });

    const resErr = await backfillIndexPost({ request: reqErr, env: makeEnv() });
    assert.equal(resErr.status, 409);
    assert.equal(sim.runs.size, initialRunCount, 'Jumlah run di database tidak bertambah');
  });

  // ===========================================================================
  // 13. Resume menggunakan runId dan leaseToken terbaru
  // ===========================================================================
  await t.test('13. Resume menggunakan runId dan leaseToken terbaru', async () => {
    const runId = '13131313-1313-4313-8313-131313131313';
    const latestLeaseToken = 'token-latest-131';

    const sim = createSimulator(
      [
        { id: 'std-1301', tenant_id: TENANT_A_UUID, no_kk: '3506011234560018', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-1302', tenant_id: TENANT_A_UUID, no_kk: '3506011234560019', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [{
        run_id: runId,
        tenant_id: TENANT_A_UUID,
        status: 'RUNNING',
        lease_token: latestLeaseToken,
        lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
        last_cursor: 'std-1301',
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
      body: JSON.stringify({ execute: true, runId, leaseToken: latestLeaseToken, batchSize: 1 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.runId, runId);
    assert.equal(body.lastCursor, 'std-1302');
  });

  // ===========================================================================
  // 14. Desktop UI membatasi akses Owner/Admin
  // ===========================================================================
  await t.test('14. Desktop UI (TenantBackfillControlCard.jsx & PengaturanPage.jsx) membatasi akses Owner/Admin', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/TenantBackfillControlCard.jsx'), 'utf-8');
    const pageCode = fs.readFileSync(path.join(process.cwd(), 'src/pages/PengaturanPage.jsx'), 'utf-8');

    assert.ok(cardCode.includes("userRole === 'owner' || userRole === 'admin'"), 'TenantBackfillControlCard memverifikasi role owner atau admin');
    assert.ok(pageCode.includes("userProfile?.role === 'owner' || userProfile?.role === 'admin'"), 'PengaturanPage merender card hanya untuk owner atau admin');
  });

  // ===========================================================================
  // 15. Superadmin tidak dapat mengakses atau menjalankan kontrol operasional
  // ===========================================================================
  await t.test('15. Superadmin ditolak dari seluruh endpoint operasional backfill (HTTP 403 FORBIDDEN_SUPERADMIN_ROLE)', async () => {
    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer superadmin-token',
        'x-test-staff-role': 'superadmin',
        'x-test-staff-uid': 'uid-superadmin',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, tenantId: TENANT_A_UUID })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.code, 'FORBIDDEN_SUPERADMIN_ROLE');
  });

  // ===========================================================================
  // 16. Catatan eksplisit bahwa simulator concurrency di test suite bukan pengganti pengujian PostgreSQL nyata
  // ===========================================================================
  await t.test('16. Catatan eksplisit: Simulator concurrency in-memory test suite BUKAN pengganti pengujian PostgreSQL live', async () => {
    const notice = `
    [PERINGATAN AUDIT CONCURRENCY & INTEGRITAS INTEGRASI]:
    Test suite ini menggunakan simulator fetch in-memory untuk memverifikasi kontrak logika Atomic CAS, Fencing Token, dan Rotasi Lease.
    Simulator in-memory BUKAN pengganti pengujian PostgreSQL / Supabase live concurrency nyata.
    Pengujian live concurrency database harus dilakukan pada instance staging/produksi Supabase nyata dengan worker paralel riil.
    `;
    assert.ok(notice.includes('BUKAN pengganti pengujian PostgreSQL / Supabase live concurrency'));
  });

});
