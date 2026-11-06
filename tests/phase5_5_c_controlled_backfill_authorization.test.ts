import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';

test('CHUVATOR — FASE 5.5-C: Controlled Backfill & Authorization Verification Suite (8 Mandatory Tests)', async (t) => {
  const mockSecret = 'test-kk-hmac-secret-32-bytes-long!';
  const mockUrl = 'http://localhost:54321';
  const mockKey = 'test-service-role-key';

  // Mock global fetch for Supabase calls during dry-run / active run checks
  const originalFetch = global.fetch;

  t.beforeEach(() => {
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Mock DB query for students (Dry-Run / Batch fetch)
      if (urlStr.includes('/rest/v1/students')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'std-1', tenant_id: 'tenant-owner-1', no_kk: '1234567890123456', kk_hmac: null, kk_last4: null },
            { id: 'std-2', tenant_id: 'tenant-owner-1', no_kk: null, kk_hmac: null, kk_last4: null }
          ]
        } as any;
      }

      // Mock DB query for backfill_kk_runs
      if (urlStr.includes('/rest/v1/backfill_kk_runs')) {
        if (urlStr.includes('run_id=eq.run-belonging-to-tenant-B')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                run_id: 'run-belonging-to-tenant-B',
                tenant_id: 'tenant-B',
                status: 'RUNNING',
                lease_token: 'lease-token-B',
                lease_expires_at: new Date(Date.now() + 60000).toISOString(),
                last_cursor: null
              }
            ]
          } as any;
        }
        if (urlStr.includes('run_id=eq.run-belonging-to-tenant-owner-1')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                run_id: 'run-belonging-to-tenant-owner-1',
                tenant_id: 'tenant-owner-1',
                status: 'RUNNING',
                lease_token: 'lease-token-valid',
                lease_expires_at: new Date(Date.now() + 60000).toISOString(),
                last_cursor: null
              }
            ]
          } as any;
        }
        return {
          ok: true,
          status: 200,
          json: async () => []
        } as any;
      }

      // Mock lease acquire / RPC calls
      if (urlStr.includes('/rest/v1/rpc/acquire_backfill_kk_lease')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            run_id: 'new-run-uuid-123',
            lease_token: 'new-lease-token-456'
          })
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as any;
    }) as any;
  });

  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  // =========================================================================
  // BUKTI TEST 1: Owner dapat menjalankan backfill untuk tenant sendiri
  // =========================================================================
  await t.test('1. Bukti: Owner dapat menjalankan backfill untuk tenant sendiri', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'uid-owner-1',
          'x-test-tenant-id': 'tenant-owner-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true })
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 200, 'Owner harus diizinkan (200 OK)');
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.mode, 'DRY_RUN');
  });

  // =========================================================================
  // BUKTI TEST 2: Owner tidak dapat menjalankan backfill tenant lain
  // =========================================================================
  await t.test('2. Bukti: Owner tidak dapat menjalankan backfill tenant lain (HTTP 403)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'uid-owner-1',
          'x-test-tenant-id': 'tenant-owner-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true, tenantId: 'tenant-B-stolen' })
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 403, 'Akses tenant lain oleh owner harus ditolak HTTP 403');
    const body = await res.json();
    assert.strictEqual(body.code, 'FORBIDDEN_TENANT_SCOPE');
    assert.match(body.message, /Akses ditolak/);
  });

  // =========================================================================
  // BUKTI TEST 3: Administrator tenant dengan izin yang sesuai dapat menjalankan
  // =========================================================================
  await t.test('3. Bukti: Administrator tenant (admin & manager) dapat menjalankan backfill tenant sendiri', async () => {
    for (const role of ['admin', 'manager']) {
      const context = {
        request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${role}-token`,
            'x-test-staff-role': role,
            'x-test-staff-uid': `uid-${role}-1`,
            'x-test-tenant-id': 'tenant-owner-1',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ dryRun: true })
        }),
        env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
      };

      const res = await backfillIndexPost(context);
      assert.strictEqual(res.status, 200, `Peran tenant admin/manager '${role}' harus diizinkan`);
      const body = await res.json();
      assert.strictEqual(body.success, true);
    }
  });

  // =========================================================================
  // BUKTI TEST 4: Staf tanpa izin ditolak
  // =========================================================================
  await t.test('4. Bukti: Staf tanpa izin (kasir, coach, staff) ditolak (HTTP 403)', async () => {
    for (const role of ['kasir', 'coach', 'staff']) {
      const context = {
        request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${role}-token`,
            'x-test-staff-role': role,
            'x-test-staff-uid': `uid-${role}-1`,
            'x-test-tenant-id': 'tenant-owner-1',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ dryRun: true })
        }),
        env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
      };

      const res = await backfillIndexPost(context);
      assert.strictEqual(res.status, 403, `Peran '${role}' tanpa wewenang harus ditolak (403)`);
      const body = await res.json();
      assert.strictEqual(body.success, false);
    }
  });

  // =========================================================================
  // BUKTI TEST 5: Super Admin bukan syarat operasi tenant
  // =========================================================================
  await t.test('5. Bukti: Super Admin bukan syarat operasi tenant (Owner/Tenant Admin dapat menjalankan tanpa role superadmin)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner', // BUKAN superadmin
          'x-test-staff-uid': 'uid-owner-regular',
          'x-test-tenant-id': 'tenant-owner-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true })
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  // =========================================================================
  // BUKTI TEST 6: runId saja tidak dapat mengotorisasi eksekusi
  // =========================================================================
  await t.test('6. Bukti: runId saja tidak dapat mengotorisasi eksekusi (Permintaan tanpa sesi valid / role terlarang / tenant salah ditolak)', async () => {
    // 6a. Tanpa header otorisasi sesi
    const unauthReq = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run-belonging-to-tenant-B', execute: true })
    });
    const unauthRes = await backfillIndexPost({ request: unauthReq, env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey } });
    assert.strictEqual(unauthRes.status, 401, 'Request dengan runId tanpa sesi autentikasi harus ditolak HTTP 401');

    // 6b. Dengan role staf tidak berwenang (kasir)
    const forbiddenRoleReq = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer kasir-token',
        'x-test-staff-role': 'kasir',
        'x-test-staff-uid': 'uid-kasir-1',
        'x-test-tenant-id': 'tenant-owner-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ runId: 'run-belonging-to-tenant-owner-1', execute: true })
    });
    const forbiddenRoleRes = await backfillIndexPost({ request: forbiddenRoleReq, env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey } });
    assert.strictEqual(forbiddenRoleRes.status, 403, 'Request dengan runId oleh peran kasir harus ditolak HTTP 403');

    // 6c. Dengan owner Tenant A mencoba mengakses runId milik Tenant B
    const crossTenantRunReq = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-1',
        'x-test-tenant-id': 'tenant-owner-1', // Tenant A
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ runId: 'run-belonging-to-tenant-B', execute: true }) // Run Tenant B
    });
    const crossTenantRunRes = await backfillIndexPost({ request: crossTenantRunReq, env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey } });
    assert.strictEqual(crossTenantRunRes.status, 403, 'Request dengan runId milik tenant lain harus ditolak HTTP 403');
    const crossBody = await crossTenantRunRes.json();
    assert.strictEqual(crossBody.code, 'FORBIDDEN_TENANT_SCOPE');
  });

  // =========================================================================
  // BUKTI TEST 7: Tenant dan fencing token divalidasi server-side
  // =========================================================================
  await t.test('7. Bukti: Tenant dan fencing token divalidasi server-side', async () => {
    // 7a. Rejection of stale fencing lease token
    const staleTokenReq = new Request('http://localhost/api/admin/backfill_kk_hmac', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'uid-owner-1',
        'x-test-tenant-id': 'tenant-owner-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        runId: 'run-belonging-to-tenant-owner-1',
        leaseToken: 'stale-lease-token-expired', // Mismatched token!
        execute: true
      })
    });
    const staleRes = await backfillIndexPost({ request: staleTokenReq, env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey } });
    assert.strictEqual(staleRes.status, 409, 'Lease token usang/stale harus ditolak HTTP 409');
    const staleBody = await staleRes.json();
    assert.strictEqual(staleBody.code, 'FENCING_TOKEN_STALE');
  });

  // =========================================================================
  // BUKTI TEST 8: Dry-run tetap tidak melakukan mutasi
  // =========================================================================
  await t.test('8. Bukti: Dry-run tetap tidak melakukan mutasi (100% read-only)', async () => {
    let mutationAttempted = false;

    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = (init?.method || 'GET').toUpperCase();
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        if (urlStr.includes('/rpc/') || urlStr.includes('/rest/v1/students')) {
          mutationAttempted = true;
        }
      }

      if (urlStr.includes('/rest/v1/students')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'std-1', tenant_id: 'tenant-owner-1', no_kk: '1234567890123456', kk_hmac: null, kk_last4: null }
          ]
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as any;
    }) as any;

    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'uid-owner-1',
          'x-test-tenant-id': 'tenant-owner-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true })
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(mutationAttempted, false, 'Dry-run tidak boleh memicu permintaan mutasi ke database');
  });
});
