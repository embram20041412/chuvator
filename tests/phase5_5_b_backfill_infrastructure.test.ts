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

test('CHUVATOR — FASE 5.5-B: Persistent KK_HMAC Backfill Infrastructure', async (t) => {
  const schemaSql = fs.readFileSync(SCHEMA_FILE_PATH, 'utf8');
  const verificationSql = fs.readFileSync(VERIFICATION_FILE_PATH, 'utf8');

  // 1. Normalisasi KK
  await t.test('1. Normalisasi KK: Tepat 16 digit angka murni', () => {
    assert.strictEqual(normalizeKK('1234567890123456'), '1234567890123456');
    assert.strictEqual(normalizeKK('1234-5678-9012 3456'), '1234567890123456');
    assert.strictEqual(normalizeKK('1234.5678.9012.3456'), '1234567890123456');
    assert.strictEqual(normalizeKK('123456789012345'), ''); // 15 digit -> tolak
    assert.strictEqual(normalizeKK('12345678901234567'), ''); // 17 digit -> tolak
    assert.strictEqual(normalizeKK(''), '');
    assert.strictEqual(normalizeKK(null), '');
    assert.strictEqual(normalizeKK(undefined), '');
  });

  // 2. HMAC SHA-256
  await t.test('2. HMAC-SHA-256: Lowercase Hexadecimal 64 Karakter', async () => {
    const testSecret = 'chuvator-test-secret-key-123';
    const sig = await computeHMAC('1234567890123456', testSecret);
    assert.ok(sig, 'HMAC must not be null');
    assert.strictEqual(typeof sig, 'string');
    assert.strictEqual(sig.length, 64);
    assert.match(sig, /^[0-9a-f]{64}$/);
    
    // Deterministik
    const sig2 = await computeHMAC('1234567890123456', testSecret);
    assert.strictEqual(sig, sig2);
  });

  // 3. Secret tidak tersedia (Fail-Closed)
  await t.test('3. Secret Tidak Tersedia: Fail-Closed Protection', async () => {
    const noSecretRes = await computeHMAC('1234567890123456', '');
    assert.strictEqual(noSecretRes, null);

    const check = await checkCryptoEngineStatus('');
    assert.strictEqual(check.configured, false);
    assert.strictEqual(check.ready, false);

    // Endpoint call with missing secret
    const req = new Request('http://localhost:3000/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-staff-role': 'superadmin',
        'x-test-staff-uid': 'super-admin-uid-1',
        'x-test-tenant-id': 'global'
      },
      body: JSON.stringify({ dryRun: false })
    });

    const res = await backfillIndexPost({ request: req, env: { KK_HMAC_SECRET: '', ENVIRONMENT: 'test' } });
    assert.strictEqual(res.status, 500);
    const body: any = await res.json();
    assert.strictEqual(body.code, 'SECRET_NOT_CONFIGURED');
  });

  // 4. Dry-Run Tanpa Mutasi
  await t.test('4. Dry-Run: 100% Read-Only Zero Mutation', async () => {
    const req = new Request('http://localhost:3000/api/admin/backfill_kk_hmac?dryRun=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-staff-role': 'superadmin',
        'x-test-staff-uid': 'super-admin-uid-1',
        'x-test-tenant-id': 'global'
      },
      body: JSON.stringify({ dryRun: true })
    });

    // Mock fetch for dry-run
    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      if (String(url).includes('/rest/v1/students')) {
        return new Response(
          JSON.stringify([
            { id: '11111111-1111-1111-1111-111111111111', tenant_id: 't-1', nik_kk: '1234567890123456', kk_hmac: null, kk_last4: null },
            { id: '22222222-2222-2222-2222-222222222222', tenant_id: 't-1', nik_kk: '12345', kk_hmac: null, kk_last4: null },
            { id: '33333333-3333-3333-3333-333333333333', tenant_id: 't-2', nik_kk: '9999999999999999', kk_hmac: 'a'.repeat(64), kk_last4: '9999' }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
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
      const data = await res.json();
      assert.strictEqual(data.mode, 'DRY_RUN');
      assert.strictEqual(data.data.totalStudents, 3);
      assert.strictEqual(data.data.validSourceKK, 2);
      assert.strictEqual(data.data.invalidSourceKK, 1);
      assert.strictEqual(data.data.backfillCandidates, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 5. Run Creation & Lease Acquisition
  await t.test('5. Schema: public.backfill_kk_runs definition & lease duration', () => {
    assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS public\.backfill_kk_runs/);
    assert.match(schemaSql, /run_id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    assert.match(schemaSql, /lease_expires_at TIMESTAMPTZ NOT NULL/);
    assert.match(schemaSql, /status VARCHAR\(32\)/);
  });

  // 6. Lock Simultan (Concurrency Lock Rejection)
  await t.test('6. Concurrency Lease Lock Rejection (RPC logic)', () => {
    assert.match(schemaSql, /CREATE OR REPLACE FUNCTION public\.acquire_backfill_kk_lease/);
    assert.match(schemaSql, /WHERE status IN \('ACQUIRED', 'RUNNING'\)\s*AND lease_expires_at > now\(\)/);
    assert.match(schemaSql, /'code', 'LOCKED'/);
  });

  // 7. Lease Expiration & Recovery
  await t.test('7. Lease Expiration & Auto-Timeout Recovery', () => {
    assert.match(schemaSql, /LEASE_EXPIRED_TIMEOUT/);
    assert.match(schemaSql, /WHERE status IN \('ACQUIRED', 'RUNNING'\)\s*AND lease_expires_at <= now\(\)/);
  });

  // 8. Heartbeat Extension
  await t.test('8. Heartbeat Extension Routine', () => {
    assert.match(schemaSql, /CREATE OR REPLACE FUNCTION public\.heartbeat_backfill_kk_lease/);
    assert.match(schemaSql, /heartbeat_at = now\(\)/);
  });

  // 9. Batch Processing (Keyset Pagination)
  await t.test('9. Keyset Pagination & Batch Limit <= 50', () => {
    const indexJs = fs.readFileSync(path.join(process.cwd(), 'functions/api/admin/backfill_kk_hmac/index.js'), 'utf8');
    assert.match(indexJs, /Math\.min\(Number\(body\.batchSize\) \|\| 50, 50\)/);
    assert.match(indexJs, /order=id\.asc&limit=/);
    assert.match(indexJs, /id=gt\./);
  });

  // 10. Worker Restart Resiliency (Persistent State)
  await t.test('10. Worker Restart Resiliency: Persistent Storage', () => {
    assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS public\.backfill_kk_audit/);
    assert.match(schemaSql, /run_id UUID NOT NULL REFERENCES public\.backfill_kk_runs/);
    assert.match(schemaSql, /student_id UUID NOT NULL REFERENCES public\.students/);
  });

  // 11. Resume Cursor
  await t.test('11. Resume Cursor Mechanism', () => {
    assert.match(schemaSql, /last_cursor UUID NULL/);
  });

  // 12. Optimistic Concurrency Control
  await t.test('12. Optimistic Concurrency Control on Update', () => {
    assert.match(schemaSql, /CREATE OR REPLACE FUNCTION public\.apply_backfill_kk_atomic_record/);
    assert.match(schemaSql, /CONCURRENCY_CONFLICT/);
    assert.match(schemaSql, /v_curr_hmac IS DISTINCT FROM p_expected_old_hmac/);
  });

  // 13. Tenant Isolation
  await t.test('13. Tenant Isolation: students.tenant_id is TEXT', () => {
    assert.match(schemaSql, /tenant_id TEXT NOT NULL/);
    assert.match(schemaSql, /WHERE id = p_student_id AND tenant_id = p_tenant_id/);
  });

  // 14. Audit Atomik
  await t.test('14. Atomic Audit Trail Recording', () => {
    assert.match(schemaSql, /INSERT INTO public\.backfill_kk_audit/);
    assert.match(schemaSql, /old_kk_hmac[\s\S]*old_kk_last4[\s\S]*new_kk_hmac[\s\S]*new_kk_last4/);
  });

  // 15. Partial Failure Handling
  await t.test('15. Partial Failure & Skip Logging', () => {
    assert.match(schemaSql, /CREATE OR REPLACE FUNCTION public\.record_backfill_kk_skip/);
    assert.match(schemaSql, /operation_status IN \('SUCCESS', 'SKIPPED', 'FAILED', 'ROLLED_BACK'\)/);
  });

  // 16. Rollback (Restoration to Old Values)
  await t.test('16. Rollback Atomic Routine', () => {
    assert.match(schemaSql, /CREATE OR REPLACE FUNCTION public\.rollback_backfill_kk_atomic/);
    assert.match(schemaSql, /SET kk_hmac = v_audit\.old_kk_hmac/);
    assert.match(schemaSql, /SET operation_status = 'ROLLED_BACK'/);
  });

  // 17. Rollback Conflict Detection
  await t.test('17. Rollback Conflict Detection (Post-Backfill Modification)', () => {
    assert.match(schemaSql, /ROLLBACK_CONFLICT_DATA_CHANGED/);
    assert.match(schemaSql, /v_curr_hmac IS DISTINCT FROM v_audit\.new_kk_hmac/);
  });

  // 18. Idempotensi
  await t.test('18. Idempotensi: ALREADY_VALID Skip Check', () => {
    const indexJs = fs.readFileSync(path.join(process.cwd(), 'functions/api/admin/backfill_kk_hmac/index.js'), 'utf8');
    assert.match(indexJs, /ALREADY_VALID/);
  });

  // 19. Unauthorized Request (Missing / Invalid Bearer)
  await t.test('19. Unauthorized Request: Rejected with HTTP 401', async () => {
    const req = new Request('http://localhost:3000/api/admin/backfill_kk_hmac/status', {
      method: 'GET'
    });

    const res = await backfillStatusGet({ request: req, env: { ENVIRONMENT: 'production' } });
    assert.strictEqual(res.status, 401);
  });

  // 20. Non-Superadmin Request (Access Denied with HTTP 403)
  await t.test('20. Non-Superadmin Request: Denied with HTTP 403', async () => {
    const req = new Request('http://localhost:3000/api/admin/backfill_kk_hmac/status', {
      method: 'GET',
      headers: {
        'x-test-staff-role': 'admin',
        'x-test-staff-uid': 'tenant-admin-1',
        'x-test-tenant-id': 'tenant-1'
      }
    });

    const res = await backfillStatusGet({ request: req, env: { ENVIRONMENT: 'test', KK_HMAC_SECRET: 'test' } });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.match(data.message, /hanya diizinkan untuk superadmin/i);
  });
});
