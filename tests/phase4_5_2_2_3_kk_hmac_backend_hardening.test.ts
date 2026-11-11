import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';
import { onRequestGet as backfillStatusGet } from '../functions/api/admin/backfill_kk_hmac/status.js';
import { onRequestPost as backfillRollbackPost } from '../functions/api/admin/backfill_kk_hmac/rollback.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';
import { runKkHmacDryRun, executeKkHmacBackfill } from '../src/services/backfillService.js';

const MOCK_SECRET = 'chuvator-phase-4-5-2-2-3-secret-key-256bit!';
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

interface SimulatedAuditEvent {
  run_id: string;
  event_type: 'BACKFILL_APPLIED' | 'BACKFILL_SKIPPED';
  tenant_id: string;
  student_id: string;
  old_kk_hmac: string | null;
  old_kk_last4: string | null;
  new_kk_hmac: string | null;
  new_kk_last4: string | null;
  reason: string | null;
}

interface SimulatorFailureHooks {
  failApplyForStudentIds?: Set<string>;
  failApplyCode?: string;
  failSkipForStudentIds?: Set<string>;
  failSkipCode?: string;
  failSkipHttp500?: boolean;
  failHeartbeat?: boolean;
  failHeartbeatCode?: string;
  failHeartbeatHttp500?: boolean;
  failComplete?: boolean;
  failCompleteCode?: string;
  failCompleteHttp500?: boolean;
}

function createStatefulBackfillDbSimulator(
  initialStudents: SimulatedStudent[],
  initialRuns: SimulatedRun[] = [],
  hooks: SimulatorFailureHooks = {}
) {
  const students = new Map<string, SimulatedStudent>(
    initialStudents.map((s) => [s.id, { ...s }])
  );
  const runs = new Map<string, SimulatedRun>(
    initialRuns.map((r) => [r.run_id, { ...r }])
  );
  const audits: SimulatedAuditEvent[] = [];
  let runSeq = 1;

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

    // 3. POST /rest/v1/rpc/acquire_backfill_kk_lease
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

    // 4. POST /rest/v1/rpc/apply_backfill_kk_atomic_record
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

      if (hooks.failApplyForStudentIds?.has(studentId)) {
        return new Response(
          JSON.stringify({
            success: false,
            code: hooks.failApplyCode || 'CONCURRENCY_CONFLICT',
            message: `Simulated failure for student ${studentId}`
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const student = students.get(studentId);
      if (!student || student.tenant_id !== tenantId) {
        return new Response(JSON.stringify({ success: false, code: 'STUDENT_NOT_FOUND' }), { status: 200 });
      }

      // Optimistic Concurrency Check (OCC) matching SQL RPC
      if (
        (student.kk_hmac ?? null) !== (rawBody.p_expected_old_hmac ?? null) ||
        (student.kk_last4 ?? null) !== (rawBody.p_expected_old_last4 ?? null)
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'CONCURRENCY_CONFLICT',
            message: 'Data siswa telah berubah sebelum update diaplikasikan.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      student.kk_hmac = rawBody.p_new_hmac;
      student.kk_last4 = rawBody.p_new_last4;
      student.mutationCount += 1;

      audits.push({
        run_id: runId,
        event_type: 'BACKFILL_APPLIED',
        tenant_id: tenantId,
        student_id: studentId,
        old_kk_hmac: rawBody.p_expected_old_hmac ?? null,
        old_kk_last4: rawBody.p_expected_old_last4 ?? null,
        new_kk_hmac: rawBody.p_new_hmac,
        new_kk_last4: rawBody.p_new_last4,
        reason: null
      });

      run.processed_count += 1;
      run.last_cursor = studentId;

      return new Response(
        JSON.stringify({ success: true, code: 'UPDATED' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. POST /rest/v1/rpc/record_backfill_kk_skip
    if (url.pathname === '/rest/v1/rpc/record_backfill_kk_skip' && method === 'POST') {
      const studentId = rawBody.p_student_id;
      const runId = rawBody.p_run_id;
      const leaseToken = rawBody.p_lease_token;
      const tenantId = rawBody.p_tenant_id;

      if (hooks.failSkipHttp500) {
        return new Response('Internal Server Error', { status: 500 });
      }

      if (hooks.failSkipForStudentIds?.has(studentId)) {
        return new Response(
          JSON.stringify({
            success: false,
            code: hooks.failSkipCode || 'SKIP_AUDIT_WRITE_FAILED',
            message: `Simulated skip RPC failure for ${studentId}`
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const run = runs.get(runId);
      if (!run) {
        return new Response(JSON.stringify({ success: false, code: 'RUN_NOT_FOUND' }), { status: 200 });
      }
      if (run.lease_token !== leaseToken) {
        return new Response(JSON.stringify({ success: false, code: 'FENCING_TOKEN_MISMATCH' }), { status: 200 });
      }

      audits.push({
        run_id: runId,
        event_type: 'BACKFILL_SKIPPED',
        tenant_id: tenantId,
        student_id: studentId,
        old_kk_hmac: rawBody.p_old_hmac ?? null,
        old_kk_last4: rawBody.p_old_last4 ?? null,
        new_kk_hmac: null,
        new_kk_last4: null,
        reason: rawBody.p_reason ?? null
      });

      run.skipped_count += 1;
      run.last_cursor = studentId;

      return new Response(
        JSON.stringify({ success: true, code: 'SKIPPED_RECORDED' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. POST /rest/v1/rpc/heartbeat_backfill_kk_lease
    if (url.pathname === '/rest/v1/rpc/heartbeat_backfill_kk_lease' && method === 'POST') {
      if (hooks.failHeartbeatHttp500) {
        return new Response('Internal Server Error', { status: 500 });
      }
      if (hooks.failHeartbeat) {
        return new Response(
          JSON.stringify({
            success: false,
            code: hooks.failHeartbeatCode || 'LEASE_LOST_OR_TOKEN_INVALID',
            message: 'Lease token tidak valid, telah kedaluwarsa, atau telah diambil alih oleh worker lain.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const run = runs.get(rawBody.p_run_id);
      if (!run || run.lease_token !== rawBody.p_lease_token || run.status !== 'RUNNING') {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'LEASE_LOST_OR_TOKEN_INVALID',
            message: 'Lease token tidak valid.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      run.lease_expires_at = new Date(Date.now() + 120_000).toISOString();
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. POST /rest/v1/rpc/complete_backfill_kk_run
    if (url.pathname === '/rest/v1/rpc/complete_backfill_kk_run' && method === 'POST') {
      if (hooks.failCompleteHttp500) {
        return new Response('Internal Server Error', { status: 500 });
      }
      if (hooks.failComplete) {
        return new Response(
          JSON.stringify({
            success: false,
            code: hooks.failCompleteCode || 'FENCING_TOKEN_MISMATCH',
            message: 'Gagal menyelesaikan siklus run karena token lease tidak cocok.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const run = runs.get(rawBody.p_run_id);
      if (!run || run.lease_token !== rawBody.p_lease_token || run.status !== 'RUNNING') {
        return new Response(
          JSON.stringify({ success: false, code: 'RUN_ALREADY_TERMINAL' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      run.status = rawBody.p_status;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Unmocked route: ' + urlStr }), { status: 404 });
  };

  return {
    students,
    runs,
    audits,
    hooks,
    fetchImpl
  };
}

function makeEnv() {
  return {
    ENVIRONMENT: 'test',
    KK_HMAC_SECRET: MOCK_SECRET,
    SUPABASE_URL: MOCK_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY
  };
}

test('CHUVATOR — PHASE 4.5.2.2.3: Backend KK HMAC Authorization & Batch Reliability Hardening (16 Mandatory Tests + Service Contract)', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ===========================================================================
  // 1. Superadmin ditolak pada endpoint operasional (Dry-Run & Execute)
  // ===========================================================================
  await t.test('1. Superadmin ditolak pada endpoint operasional dengan HTTP 403', async () => {
    for (const payload of [
      { dryRun: true },
      { dryRun: true, tenantId: TENANT_A_UUID },
      { dryRun: false, execute: true, tenantId: TENANT_A_UUID },
      { dryRun: false, execute: true, tenantId: 'global' }
    ]) {
      const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer superadmin-token',
          'x-test-staff-role': 'superadmin',
          'x-test-staff-uid': 'uid-superadmin-1',
          'x-test-tenant-id': TENANT_A_UUID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const res = await backfillIndexPost({ request: req, env: makeEnv() });
      assert.equal(res.status, 403, 'Superadmin wajib ditolak HTTP 403 pada endpoint operasional');
      const body: any = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.code, 'FORBIDDEN_SUPERADMIN_ROLE');
    }
  });

  // ===========================================================================
  // 2. Owner tenant dapat menjalankan dry-run tenant sendiri
  // ===========================================================================
  await t.test('2. Owner tenant dapat menjalankan dry-run tenant sendiri', async () => {
    const sim = createStatefulBackfillDbSimulator([
      { id: 'std-01', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 },
      { id: 'std-02', tenant_id: TENANT_B_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }
    ]);
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dryRun: true, tenantId: TENANT_A_UUID })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.mode, 'DRY_RUN');
    assert.equal(body.tenantId, TENANT_A_UUID);
    // Hanya menghitung 1 siswa milik TENANT_A_UUID, bukan TENANT_B_UUID
    assert.equal(body.data.totalStudents, 1);
    assert.equal(body.data.eligibleCandidates, 1);
    assert.equal(sim.runs.size, 0, 'Dry-run tidak boleh membuat record backfill_kk_runs');
  });

  // ===========================================================================
  // 3. Admin tenant dapat menjalankan dry-run tenant sendiri
  // ===========================================================================
  await t.test('3. Admin tenant dapat menjalankan dry-run tenant sendiri', async () => {
    const sim = createStatefulBackfillDbSimulator([
      { id: 'std-01', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 }
    ]);
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin-token',
        'x-test-staff-role': 'admin',
        'x-test-staff-uid': 'uid-admin-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dryRun: true })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.mode, 'DRY_RUN');
    assert.equal(body.tenantId, TENANT_A_UUID);
    assert.equal(body.data.totalStudents, 1);
  });

  // ===========================================================================
  // 4. Manipulasi tenant ID ditolak
  // ===========================================================================
  await t.test('4. Manipulasi tenant ID oleh client (body maupun query param) ditolak dengan HTTP 403', async () => {
    // 4a. Manipulasi via JSON body
    const reqBodySpoof = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dryRun: true, tenantId: TENANT_B_UUID })
    });
    const resBodySpoof = await backfillIndexPost({ request: reqBodySpoof, env: makeEnv() });
    assert.equal(resBodySpoof.status, 403);
    const bodySpoofJson: any = await resBodySpoof.json();
    assert.equal(bodySpoofJson.code, 'FORBIDDEN_TENANT_SCOPE');

    // 4b. Manipulasi via URL query string
    const reqQuerySpoof = new Request(`http://localhost/api/admin/backfill_kk_hmac?dryRun=true&tenantId=${TENANT_B_UUID}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin-token',
        'x-test-staff-role': 'admin',
        'x-test-staff-uid': 'uid-admin-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true })
    });
    const resQuerySpoof = await backfillIndexPost({ request: reqQuerySpoof, env: makeEnv() });
    assert.equal(resQuerySpoof.status, 403);
    const querySpoofJson: any = await resQuerySpoof.json();
    assert.equal(querySpoofJson.code, 'FORBIDDEN_TENANT_SCOPE');
  });

  // ===========================================================================
  // 5. Tenant ID `global` ditolak
  // ===========================================================================
  await t.test('5. Tenant ID `global` ditolak baik dari konteks user maupun parameter client', async () => {
    // 5a. Konteks tenant user bernilai 'global'
    const reqServerGlobal = new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-global',
        'x-test-tenant-id': 'global',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dryRun: true })
    });
    const resServerGlobal = await backfillIndexPost({ request: reqServerGlobal, env: makeEnv() });
    assert.equal(resServerGlobal.status, 403);
    const jsonServerGlobal: any = await resServerGlobal.json();
    assert.equal(jsonServerGlobal.code, 'FORBIDDEN_GLOBAL_SCOPE');

    // 5b. Client mengirim tenantId: 'global'
    const reqClientGlobal = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, tenantId: 'global' })
    });
    const resClientGlobal = await backfillIndexPost({ request: reqClientGlobal, env: makeEnv() });
    assert.equal(resClientGlobal.status, 403);
    const jsonClientGlobal: any = await resClientGlobal.json();
    assert.equal(jsonClientGlobal.code, 'FORBIDDEN_GLOBAL_SCOPE');
  });

  // ===========================================================================
  // 6. Tenant ID kosong atau tidak valid ditolak
  // ===========================================================================
  await t.test('6. Tenant ID kosong, whitespace, atau bukan format UUID ditolak', async () => {
    // 6a. Konteks tenant user bukan UUID (mis. 'tenant-gor-101')
    const reqInvalidUserTenant = new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': 'tenant-non-uuid-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dryRun: true })
    });
    const resInvalidUserTenant = await backfillIndexPost({ request: reqInvalidUserTenant, env: makeEnv() });
    assert.equal(resInvalidUserTenant.status, 403);
    const jsonInvalidUser: any = await resInvalidUserTenant.json();
    assert.equal(jsonInvalidUser.code, 'INVALID_TENANT_ID');

    // 6b. Pengguna terautentikasi tanpa konteks tenant (tenant_id null atau whitespace di DB)
    for (const emptyDbTenant of [null, '', '   ']) {
      globalThis.fetch = (async (input: string | URL | Request) => {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (urlStr.includes('/auth/v1/user')) {
          return new Response(JSON.stringify({ id: 'uid-no-tenant', email: 'admin@tenant.com' }), { status: 200 });
        }
        if (urlStr.includes('/rest/v1/tenants')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (urlStr.includes('/rest/v1/users_staff')) {
          return new Response(JSON.stringify([{ role: 'admin', tenant_id: emptyDbTenant }]), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }) as any;

      const reqMissingUserTenant = new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-session-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true })
      });
      const resMissingUser = await backfillIndexPost({
        request: reqMissingUserTenant,
        env: { ...makeEnv(), VITE_SUPABASE_ANON_KEY: 'mock-anon-key' }
      });
      assert.equal(resMissingUser.status, 403);
      const jsonMissingUser: any = await resMissingUser.json();
      assert.equal(jsonMissingUser.code, 'MISSING_TENANT_CONTEXT');
    }

    // 6c. Client mengirim tenantId kosong "" atau format UUID rusak
    for (const badClientTenant of ['', '   ', 'not-a-valid-uuid']) {
      const reqBadClient = new Request('http://localhost/api/admin/backfill_kk_hmac', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'uid-owner-a',
          'x-test-tenant-id': TENANT_A_UUID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true, tenantId: badClientTenant })
      });
      const resBadClient = await backfillIndexPost({ request: reqBadClient, env: makeEnv() });
      assert.equal(resBadClient.status, 400);
      const jsonBadClient: any = await resBadClient.json();
      assert.equal(jsonBadClient.code, 'INVALID_TENANT_ID');
    }
  });

  // ===========================================================================
  // 7. Cursor arbitrer dari client ditolak
  // ===========================================================================
  await t.test('7. Cursor arbitrer dari client (cursor / lastCursor) ditolak dengan HTTP 400', async () => {
    for (const bodyPayload of [
      { execute: true, cursor: 'std-arbitrary-cursor' },
      { execute: true, lastCursor: 'std-arbitrary-last-cursor' }
    ]) {
      const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'uid-owner-a',
          'x-test-tenant-id': TENANT_A_UUID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });
      const res = await backfillIndexPost({ request: req, env: makeEnv() });
      assert.equal(res.status, 400);
      const json: any = await res.json();
      assert.equal(json.code, 'CLIENT_CURSOR_REJECTED');
    }
  });

  // ===========================================================================
  // 8. Batch dengan seluruh record berhasil
  // ===========================================================================
  await t.test('8. Batch dengan seluruh record berhasil memperbarui DB, cursor, dan menyelesaikan status run COMPLETED', async () => {
    const sim = createStatefulBackfillDbSimulator([
      { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 },
      { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: null, kk_hmac: null, kk_last4: null, mutationCount: 0 }, // Skip
      { id: 'std-003', tenant_id: TENANT_A_UUID, no_kk: '3506011234560003', kk_hmac: null, kk_last4: null, mutationCount: 0 }
    ]);
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
      body: JSON.stringify({ execute: true, tenantId: TENANT_A_UUID, batchSize: 50 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 200);
    const body: any = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.status, 'COMPLETED');
    assert.equal(body.data.tenantId, TENANT_A_UUID);
    assert.equal(body.data.batchCount, 3);
    assert.equal(body.data.processed, 2);
    assert.equal(body.data.skipped, 1);
    assert.equal(body.data.failed, 0);
    assert.equal(body.data.lastCursor, 'std-003');
    assert.equal(body.data.hasMoreRows, false);
    assert.equal(body.data.completed, true);
    assert.equal(body.data.error, null);

    // Verifikasi state aktual di DB simulator
    const dbRun = sim.runs.get(body.data.runId);
    assert.ok(dbRun);
    assert.equal(dbRun.status, 'COMPLETED');
    assert.equal(dbRun.last_cursor, 'std-003');
    assert.equal(dbRun.processed_count, 2);
    assert.equal(dbRun.skipped_count, 1);

    const std1 = sim.students.get('std-001')!;
    const std3 = sim.students.get('std-003')!;
    assert.equal(std1.kk_last4, '0001');
    assert.equal(std1.kk_hmac, await computeHMAC('3506011234560001', MOCK_SECRET));
    assert.equal(std3.kk_last4, '0003');
    assert.equal(std3.kk_hmac, await computeHMAC('3506011234560003', MOCK_SECRET));
  });

  // ===========================================================================
  // 9. Batch dengan sebagian record gagal
  // ===========================================================================
  await t.test('9. Batch dengan sebagian record gagal menahan cursor sebelum record gagal dan tidak menyelesaikan run', async () => {
    const sim = createStatefulBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }, // Gagal di sini!
        { id: 'std-003', tenant_id: TENANT_A_UUID, no_kk: '3506011234560003', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [],
      { failApplyForStudentIds: new Set(['std-002']), failApplyCode: 'SOURCE_KK_MUTATED' }
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
      body: JSON.stringify({ execute: true, batchSize: 50 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 422);
    const body: any = await res.json();

    assert.equal(body.success, false);
    assert.equal(body.status, 'PARTIAL_FAILURE');
    assert.equal(body.data.processed, 1);
    assert.equal(body.data.skipped, 0);
    assert.equal(body.data.failed, 1);
    // Kursor TIDAK BOLEH maju ke std-002 atau std-003; wajib tertahan di std-001!
    assert.equal(body.data.lastCursor, 'std-001');
    assert.equal(body.data.hasMoreRows, true);
    assert.equal(body.data.completed, false);
    assert.equal(body.data.error?.code, 'SOURCE_KK_MUTATED');
    assert.equal(body.data.error?.failedStudentId, 'std-002');

    // Verifikasi DB run status masih RUNNING dan last_cursor tetap std-001
    const dbRun = sim.runs.get(body.data.runId)!;
    assert.equal(dbRun.status, 'RUNNING');
    assert.equal(dbRun.last_cursor, 'std-001');
    // std-003 belum disentuh karena loop berhenti saat std-002 gagal
    assert.equal(sim.students.get('std-003')!.kk_hmac, null);
  });

  // ===========================================================================
  // 10. RPC pencatatan skip gagal
  // ===========================================================================
  await t.test('10. Kegagalan RPC record_backfill_kk_skip dihitung sebagai failed (bukan skipped) dan menahan cursor', async () => {
    const sim = createStatefulBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: null, kk_hmac: null, kk_last4: null, mutationCount: 0 }, // Skip RPC gagal!
        { id: 'std-003', tenant_id: TENANT_A_UUID, no_kk: '3506011234560003', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [],
      { failSkipForStudentIds: new Set(['std-002']), failSkipCode: 'SKIP_AUDIT_LOCK_ERROR' }
    );
    globalThis.fetch = sim.fetchImpl as any;

    const req = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin-token',
        'x-test-staff-role': 'admin',
        'x-test-staff-uid': 'uid-admin-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, batchSize: 50 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 422);
    const body: any = await res.json();

    assert.equal(body.success, false);
    assert.equal(body.status, 'PARTIAL_FAILURE');
    assert.equal(body.data.processed, 1);
    assert.equal(body.data.skipped, 0, 'Skip yang gagal dicatat tidak boleh dihitung sebagai skipped');
    assert.equal(body.data.failed, 1, 'Skip yang gagal dicatat wajib dihitung sebagai failed');
    assert.equal(body.data.lastCursor, 'std-001');
    assert.equal(body.data.hasMoreRows, true);
    assert.equal(body.data.completed, false);
    assert.equal(body.data.error?.stage, 'RECORD_SKIP_RPC');
    assert.equal(body.data.error?.code, 'SKIP_AUDIT_LOCK_ERROR');

    const dbRun = sim.runs.get(body.data.runId)!;
    assert.equal(dbRun.status, 'RUNNING');
    assert.equal(dbRun.last_cursor, 'std-001');
    assert.equal(dbRun.skipped_count, 0);
  });

  // ===========================================================================
  // 11. Heartbeat lease gagal
  // ===========================================================================
  await t.test('11. Kegagalan RPC heartbeat_backfill_kk_lease diverifikasi dan mencegah penyelesaian run', async () => {
    const sim = createStatefulBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [],
      { failHeartbeat: true, failHeartbeatCode: 'LEASE_LOST_OR_TOKEN_INVALID' }
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
      body: JSON.stringify({ execute: true, batchSize: 50 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();

    assert.equal(body.success, false);
    assert.equal(body.status, 'LEASE_HEARTBEAT_FAILED');
    assert.equal(body.code, 'LEASE_LOST_OR_TOKEN_INVALID');
    assert.equal(body.data.completed, false, 'Run tidak boleh dinyatakan completed jika lease heartbeat gagal');

    const dbRun = sim.runs.get(body.data.runId)!;
    assert.notEqual(dbRun.status, 'COMPLETED');
  });

  // ===========================================================================
  // 12. RPC complete gagal
  // ===========================================================================
  await t.test('12. Kegagalan RPC complete_backfill_kk_run tidak boleh mengembalikan completed: true', async () => {
    const sim = createStatefulBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [],
      { failComplete: true, failCompleteCode: 'COMPLETE_RPC_DB_ERROR' }
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
      body: JSON.stringify({ execute: true, batchSize: 50 })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 500);
    const body: any = await res.json();

    assert.equal(body.success, false);
    assert.equal(body.status, 'COMPLETION_RPC_FAILED');
    assert.equal(body.data.processed, 1);
    assert.equal(body.data.completed, false, 'Jangan mengembalikan completed: true apabila RPC penyelesaian gagal');
    assert.equal(body.data.error?.stage, 'COMPLETE_RUN_RPC');

    const dbRun = sim.runs.get(body.data.runId)!;
    assert.equal(dbRun.status, 'RUNNING');
  });

  // ===========================================================================
  // 13. Resume setelah kegagalan
  // ===========================================================================
  await t.test('13. Resume setelah kegagalan melanjutkan dari kursor DB resmi dan menyelesaikan run', async () => {
    const sim = createStatefulBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-003', tenant_id: TENANT_A_UUID, no_kk: '3506011234560003', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [],
      { failApplyForStudentIds: new Set(['std-002']) }
    );
    globalThis.fetch = sim.fetchImpl as any;

    // Panggilan Pertama: std-001 berhasil, std-002 gagal, std-003 belum diproses
    const req1 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, batchSize: 50 })
    });
    const res1 = await backfillIndexPost({ request: req1, env: makeEnv() });
    assert.equal(res1.status, 422);
    const body1: any = await res1.json();

    assert.equal(body1.data.processed, 1);
    assert.equal(body1.data.failed, 1);
    assert.equal(body1.data.lastCursor, 'std-001');
    assert.equal(body1.data.completed, false);
    assert.equal(sim.runs.get(body1.data.runId)!.status, 'RUNNING');

    // Pulihkan gangguan pada std-002 lalu lakukan Resume menggunakan runId & leaseToken
    sim.hooks.failApplyForStudentIds?.clear();

    const req2 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
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
        runId: body1.data.runId,
        leaseToken: body1.data.leaseToken,
        batchSize: 50
      })
    });
    const res2 = await backfillIndexPost({ request: req2, env: makeEnv() });
    assert.equal(res2.status, 200);
    const body2: any = await res2.json();

    assert.equal(body2.success, true);
    assert.equal(body2.status, 'COMPLETED');
    assert.equal(body2.data.batchCount, 2, 'Resume hanya mengambil std-002 dan std-003 setelah kursor std-001');
    assert.equal(body2.data.processed, 2);
    assert.equal(body2.data.failed, 0);
    assert.equal(body2.data.lastCursor, 'std-003');
    assert.equal(body2.data.hasMoreRows, false);
    assert.equal(body2.data.completed, true);
    assert.equal(sim.runs.get(body1.data.runId)!.status, 'COMPLETED');
  });

  // ===========================================================================
  // 14. Fencing token usang ditolak
  // ===========================================================================
  await t.test('14. Resume dengan fencing leaseToken usang atau tidak cocok ditolak dengan HTTP 409', async () => {
    const activeRunId = '77777777-7777-4777-8777-777777777777';
    const sim = createStatefulBackfillDbSimulator(
      [],
      [
        {
          run_id: activeRunId,
          tenant_id: TENANT_A_UUID,
          status: 'RUNNING',
          lease_token: 'cccccccc-dddd-4eee-8fff-000000000001',
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          last_cursor: 'std-001',
          processed_count: 1,
          skipped_count: 0,
          failed_count: 0
        }
      ]
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
        runId: activeRunId,
        leaseToken: 'cccccccc-dddd-4eee-8fff-999999999999' // Token usang!
      })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 409);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'FENCING_TOKEN_STALE');
  });

  // ===========================================================================
  // 15. Tenant tidak dapat berubah ketika resume
  // ===========================================================================
  await t.test('15. Tenant tidak dapat berubah ketika resume (Run milik Tenant B ditolak untuk sesi Tenant A)', async () => {
    const runBelongingToTenantB = '88888888-8888-4888-8888-888888888888';
    const sim = createStatefulBackfillDbSimulator(
      [],
      [
        {
          run_id: runBelongingToTenantB,
          tenant_id: TENANT_B_UUID,
          status: 'RUNNING',
          lease_token: 'cccccccc-dddd-4eee-8fff-000000000002',
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          last_cursor: null,
          processed_count: 0,
          skipped_count: 0,
          failed_count: 0
        }
      ]
    );
    globalThis.fetch = sim.fetchImpl as any;

    // Owner Tenant A mencoba resume runId yang terikat pada Tenant B
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
        runId: runBelongingToTenantB,
        leaseToken: 'cccccccc-dddd-4eee-8fff-000000000002'
      })
    });

    const res = await backfillIndexPost({ request: req, env: makeEnv() });
    assert.equal(res.status, 403);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'TENANT_MISMATCH_ON_RESUME');
  });

  // ===========================================================================
  // 16. Tidak terjadi duplikasi mutasi pada record yang sudah berhasil
  // ===========================================================================
  await t.test('16. Tidak terjadi duplikasi mutasi pada record yang sudah berhasil (baik saat resume maupun run berikutnya)', async () => {
    const sim = createStatefulBackfillDbSimulator(
      [
        { id: 'std-001', tenant_id: TENANT_A_UUID, no_kk: '3506011234560001', kk_hmac: null, kk_last4: null, mutationCount: 0 },
        { id: 'std-002', tenant_id: TENANT_A_UUID, no_kk: '3506011234560002', kk_hmac: null, kk_last4: null, mutationCount: 0 }
      ],
      [],
      { failApplyForStudentIds: new Set(['std-002']) }
    );
    globalThis.fetch = sim.fetchImpl as any;

    // 1. Batch 1: std-001 berhasil dimutasi (mutationCount=1), std-002 gagal
    const req1 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, batchSize: 50 })
    });
    const res1 = await backfillIndexPost({ request: req1, env: makeEnv() });
    const body1: any = await res1.json();
    assert.equal(sim.students.get('std-001')!.mutationCount, 1);

    // 2. Resume run yang sama: std-001 dilewati oleh kursor DB (id > std-001), std-002 dimutasi (mutationCount=1)
    sim.hooks.failApplyForStudentIds?.clear();
    const req2 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
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
        runId: body1.data.runId,
        leaseToken: body1.data.leaseToken,
        batchSize: 50
      })
    });
    const res2 = await backfillIndexPost({ request: req2, env: makeEnv() });
    assert.equal(res2.status, 200);
    assert.equal(sim.students.get('std-001')!.mutationCount, 1, 'std-001 tidak dimutasi ulang saat resume');
    assert.equal(sim.students.get('std-002')!.mutationCount, 1, 'std-002 dimutasi tepat 1 kali');

    // 3. Jalankan siklus run baru dari awal: seluruh record yang sudah valid dicatat ALREADY_VALID (skip), 0 mutasi baru
    const req3 = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-a',
        'x-test-tenant-id': TENANT_A_UUID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ execute: true, batchSize: 50 })
    });
    const res3 = await backfillIndexPost({ request: req3, env: makeEnv() });
    assert.equal(res3.status, 200);
    const body3: any = await res3.json();
    assert.equal(body3.data.processed, 0, 'Run baru pada data yang sudah valid tidak boleh melakukan mutasi ulang');
    assert.equal(body3.data.skipped, 2, 'Seluruh record yang sudah valid wajib masuk ke jalur idempotent skip ALREADY_VALID');
    assert.equal(sim.students.get('std-001')!.mutationCount, 1);
    assert.equal(sim.students.get('std-002')!.mutationCount, 1);
  });

  // ===========================================================================
  // 17. Service Helper (backfillService.js) — Fail-Closed Sebelum Fetch
  // ===========================================================================
  await t.test('17. backfillService.js menolak tenantId kosong, global, atau non-UUID sebelum memanggil fetch()', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as any;

    for (const invalidOption of [{}, { tenantId: '' }, { tenantId: '   ' }, { tenantId: 'global' }, { tenantId: 'tenant-123' }]) {
      await assert.rejects(
        () => runKkHmacDryRun(invalidOption as any),
        (err: any) => err.code === 'MISSING_TENANT_ID' || err.code === 'FORBIDDEN_GLOBAL_SCOPE' || err.code === 'INVALID_TENANT_ID'
      );
      await assert.rejects(
        () => executeKkHmacBackfill(invalidOption as any),
        (err: any) => err.code === 'MISSING_TENANT_ID' || err.code === 'FORBIDDEN_GLOBAL_SCOPE' || err.code === 'INVALID_TENANT_ID'
      );
    }

    assert.equal(fetchCalls, 0, 'Tidak boleh ada pemanggilan fetch() apabila tenantId tidak valid');
  });

  // ===========================================================================
  // 18. Endpoint Status & Rollback tetap khusus Superadmin
  // ===========================================================================
  await t.test('18. Endpoint status dan rollback tetap eksklusif untuk Superadmin', async () => {
    const ownerHeaders = {
      'Authorization': 'Bearer owner-token',
      'x-test-staff-role': 'owner',
      'x-test-staff-uid': 'uid-owner-a',
      'x-test-tenant-id': TENANT_A_UUID,
      'Content-Type': 'application/json'
    };

    const statusRes = await backfillStatusGet({
      request: new Request('http://localhost/api/admin/backfill_kk_hmac/status', { method: 'GET', headers: ownerHeaders }),
      env: makeEnv()
    });
    assert.equal(statusRes.status, 403, 'Owner tenant wajib ditolak pada endpoint status Superadmin');

    const rollbackRes = await backfillRollbackPost({
      request: new Request('http://localhost/api/admin/backfill_kk_hmac/rollback', {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ runId: '77777777-7777-4777-8777-777777777777' })
      }),
      env: makeEnv()
    });
    assert.equal(rollbackRes.status, 403, 'Owner tenant wajib ditolak pada endpoint rollback Superadmin');
  });
});
