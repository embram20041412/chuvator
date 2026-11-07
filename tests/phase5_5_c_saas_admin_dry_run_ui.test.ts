import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { runKkHmacDryRun, executeKkHmacBackfill } from '../src/services/backfillService.js';
import { supabase } from '../src/services/supabaseClient.js';
import { validateBackfillAdmin } from '../functions/api/admin/backfill_helpers.js';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';

test('CHUVATOR — FASE 5.5-C: SaaS Admin & Tenant Controlled Backfill Integration Suite', async (t) => {

  // =========================================================================
  // 1. SERVICE HELPER TESTS: runKkHmacDryRun() & executeKkHmacBackfill() Contract
  // =========================================================================

  await t.test('1. Service Helper: Issues POST to /api/admin/backfill_kk_hmac?dryRun=true with Bearer auth token', async () => {
    const originalFetch = global.fetch;
    const originalGetSession = supabase.auth.getSession;

    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    // Mock Supabase Session
    supabase.auth.getSession = async () => ({
      data: {
        session: {
          access_token: 'mock-superadmin-jwt-token-12345',
          token_type: 'bearer',
          user: { id: 'super-admin-uid', email: 'admin@chua.com' }
        }
      },
      error: null
    }) as any;

    // Mock Fetch
    global.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          mode: 'DRY_RUN',
          message: 'Analisis simulasi selesai (100% read-only).',
          data: {
            totalStudents: 150,
            eligibleCandidates: 50,
            reviewRequired: 10,
            categories: {
              ELIGIBLE: 50,
              ALREADY_VALID: 60,
              MISSING_NO_KK: 20,
              INVALID_NO_KK: 10,
              MISSING_LAST4: 2,
              LAST4_MISMATCH: 2,
              CORRUPT_HMAC: 2,
              HMAC_MISMATCH: 2,
              LAST4_WITHOUT_HMAC: 2
            },
            completedAt: '2026-11-06T12:00:00.000Z'
          }
        })
      } as any;
    }) as any;

    try {
      const res: any = await runKkHmacDryRun({ tenantId: 'global' });

      assert.ok(capturedUrl.includes('/api/admin/backfill_kk_hmac?dryRun=true'), 'URL harus memuat endpoint dan query param dryRun=true');
      assert.strictEqual(capturedMethod, 'POST', 'HTTP method harus POST');
      assert.strictEqual(capturedHeaders['Authorization'], 'Bearer mock-superadmin-jwt-token-12345', 'Header Authorization Bearer token wajib dikirim');
      assert.strictEqual(capturedBody?.dryRun, true, 'Body JSON wajib memuat dryRun: true');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.totalStudents, 150);
      assert.strictEqual(res.data.categories.ELIGIBLE, 50);
    } finally {
      global.fetch = originalFetch;
      supabase.auth.getSession = originalGetSession;
    }
  });

  await t.test('2. Service Helper: Handles HTTP Error response and throws structured Error', async () => {
    const originalFetch = global.fetch;

    global.fetch = (async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        code: 'FORBIDDEN_SUPERADMIN_ONLY',
        message: 'Akses ditolak. Operasi administratif backfill hanya diizinkan untuk superadmin.'
      })
    })) as any;

    try {
      await runKkHmacDryRun();
      assert.fail('runKkHmacDryRun harus melempar error saat HTTP 403');
    } catch (err: any) {
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.code, 'FORBIDDEN_SUPERADMIN_ONLY');
      assert.match(err.message, /Akses ditolak/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('3. Service Helper: executeKkHmacBackfill issues POST with dryRun=false & execute=true', async () => {
    const originalFetch = global.fetch;
    let capturedBody: any = null;

    global.fetch = (async (url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            runId: 'run-uuid-123',
            leaseToken: 'lease-uuid-456',
            processed: 2,
            skipped: 4,
            failed: 0,
            completed: true
          }
        })
      } as any;
    }) as any;

    try {
      const res: any = await executeKkHmacBackfill({ tenantId: 'tenant-owner-123' });
      assert.strictEqual(capturedBody.dryRun, false, 'Controlled execution harus dryRun: false');
      assert.strictEqual(capturedBody.execute, true, 'Controlled execution harus execute: true');
      assert.strictEqual(capturedBody.tenantId, 'tenant-owner-123');
      assert.strictEqual(res.data.processed, 2);
      assert.strictEqual(res.data.skipped, 4);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 2. AUTHORIZATION & TENANT ISOLATION TESTS
  // =========================================================================

  await t.test('4. Authorization: validateBackfillAdmin allows owner/admin/superadmin and rejects kasir/coach/staff', async () => {
    // 1. Test allowed roles
    for (const role of ['superadmin', 'owner', 'admin']) {
      const mockContext = {
        request: new Request('http://localhost/api/admin/backfill_kk_hmac', {
          headers: {
            'Authorization': 'Bearer valid-token',
            'x-test-staff-role': role,
            'x-test-staff-uid': `user-${role}`,
            'x-test-tenant-id': 'tenant-test-1'
          }
        }),
        env: { ENVIRONMENT: 'development' }
      };
      const auth = await validateBackfillAdmin(mockContext);
      assert.strictEqual(auth.authorized, true, `Role '${role}' harus diizinkan`);
    }

    // 2. Test forbidden roles
    for (const role of ['kasir', 'coach', 'pelatih', 'staff']) {
      const mockContext = {
        request: new Request('http://localhost/api/admin/backfill_kk_hmac', {
          headers: {
            'Authorization': 'Bearer valid-token',
            'x-test-staff-role': role,
            'x-test-staff-uid': `user-${role}`,
            'x-test-tenant-id': 'tenant-test-1'
          }
        }),
        env: { ENVIRONMENT: 'development' }
      };
      const auth = await validateBackfillAdmin(mockContext);
      assert.strictEqual(auth.authorized, false, `Role '${role}' harus ditolak`);
      assert.strictEqual(auth.status, 403);
    }
  });

  await t.test('5. Tenant Isolation: Owner Tenant A cannot request Tenant B data (HTTP 403)', async () => {
    const mockContext = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'user-owner-A',
          'x-test-tenant-id': 'tenant-A',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true, tenantId: 'tenant-B' }) // Attempting to access Tenant B!
      }),
      env: {
        ENVIRONMENT: 'development',
        KK_HMAC_SECRET: 'test-secret',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key'
      }
    };

    const res = await backfillIndexPost(mockContext);
    assert.strictEqual(res.status, 403, 'Cross-tenant manipulation harus ditolak HTTP 403');
    const body = await res.json();
    assert.strictEqual(body.code, 'FORBIDDEN_TENANT_SCOPE');
    assert.match(body.message, /Manipulasi tenant scope ditolak/);
  });

  // =========================================================================
  // 3. UI COMPONENT & CODE AUDIT TESTS
  // =========================================================================

  await t.test('6. UI Contract: SaasAdminPage.jsx & TenantBackfillControlCard.jsx enforce READ-ONLY phase', () => {
    const saasPageJsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/SaasAdminPage.jsx'), 'utf8');
    const tenantCardJsx = fs.readFileSync(path.join(process.cwd(), 'src/components/TenantBackfillControlCard.jsx'), 'utf8');
    const pengaturanJsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/PengaturanPage.jsx'), 'utf8');

    // 1. SaasAdminPage contains dry-run button & categories
    assert.match(saasPageJsx, /Jalankan Dry-Run KK HMAC/);
    assert.match(saasPageJsx, /100% AMAN & READ-ONLY/i);
    assert.match(saasPageJsx, /LAST4_WITHOUT_HMAC/);

    // 2. TenantBackfillControlCard disables execution button for this phase
    assert.match(tenantCardJsx, /Eksekusi Terkunci/);
    assert.match(tenantCardJsx, /disabled=\{true\}/);

    // 3. PengaturanPage imports & renders TenantBackfillControlCard
    assert.match(pengaturanJsx, /TenantBackfillControlCard/);

    // 4. Zero PII rendered across components
    for (const code of [saasPageJsx, tenantCardJsx]) {
      assert.doesNotMatch(code, /student\.nik/);
      assert.doesNotMatch(code, /student\.no_kk/);
      assert.doesNotMatch(code, /KK_HMAC_SECRET/);
    }
  });
});
