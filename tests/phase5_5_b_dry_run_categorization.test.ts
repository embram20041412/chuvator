import { test } from 'node:test';
import assert from 'node:assert';
import { performDryRunAnalysis } from '../functions/api/admin/backfill_helpers.js';
import { onRequestPost as backfillIndexPost } from '../functions/api/admin/backfill_kk_hmac/index.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR — FASE 5.5-B: Dry-Run Categorization & Runtime Integration Suite (16 Test Cases)', async (t) => {
  const mockSecret = 'test-secret-key-1234567890';
  const mockUrl = 'http://mock-supabase.local';
  const mockKey = 'mock-key';

  // =========================================================================
  // 1. AUTHENTICATION & SECURITY CONTROLS (TESTS 1, 2, 3, 16)
  // =========================================================================

  await t.test('1. Invalid staff authentication rejected (401)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' } // Missing Authorization header
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  await t.test('2. Role without superadmin permission rejected (403)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer kasir-token',
          'x-test-staff-role': 'kasir',
          'x-test-staff-uid': 'user-kasir',
          'x-test-tenant-id': 'tenant-1',
          'Content-Type': 'application/json'
        }
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Akses ditolak/);
  });

  await t.test('3. Tenant isolation works: Filter applied to REST query', async () => {
    const originalFetch = global.fetch;
    let queriedUrl = '';

    global.fetch = async (url) => {
      queriedUrl = String(url);
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'tenant-abc');
      assert.match(queriedUrl, /tenant_id=eq\.tenant-abc/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('16. Secret not available causes fail-closed failure (SECRET_NOT_CONFIGURED / 500)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer superadmin-token',
          'x-test-staff-role': 'superadmin',
          'x-test-staff-uid': 'user-admin',
          'x-test-tenant-id': 'global',
          'Content-Type': 'application/json'
        }
      }),
      env: {
        // Missing KK_HMAC_SECRET!
        SUPABASE_URL: mockUrl,
        SUPABASE_SERVICE_ROLE_KEY: mockKey
      }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.code, 'SECRET_NOT_CONFIGURED');
  });

  await t.test('17. Request without dryRun=true is strictly rejected (400 DRY_RUN_ONLY_MODE)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer superadmin-token',
          'x-test-staff-role': 'superadmin',
          'x-test-staff-uid': 'user-admin',
          'x-test-tenant-id': 'global',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: false })
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'DRY_RUN_ONLY_MODE');
    assert.match(body.message, /Dry-Run READ-ONLY/);
  });

  await t.test('18. Client tenant manipulation by non-superadmin is rejected (403 FORBIDDEN_TENANT_SCOPE)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer owner-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'user-owner',
          'x-test-tenant-id': 'tenant-registered-owner',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tenantId: 'tenant-other-stolen' })
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Akses ditolak/);
  });

  // =========================================================================
  // 2. CATEGORIZATION RULES (TESTS 4 TO 10)
  // =========================================================================

  await t.test('4. Empty no_kk categorized as INVALID_SOURCE', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-empty-kk', tenant_id: 't1', no_kk: null, nik_kk: '1234567890123456', kk_hmac: null, kk_last4: null }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.INVALID_SOURCE, 1);
      assert.strictEqual(result.items[0].category, 'INVALID_SOURCE');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('5. Invalid no_kk format (not 16 digits) categorized as INVALID_SOURCE', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-short-kk', tenant_id: 't1', no_kk: '12345', nik_kk: null, kk_hmac: null, kk_last4: null }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.INVALID_SOURCE, 1);
      assert.strictEqual(result.items[0].category, 'INVALID_SOURCE');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('6. Valid KK (16 digits) without HMAC categorized as ELIGIBLE', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-eligible', tenant_id: 't1', no_kk: '1234567890123456', nik_kk: null, kk_hmac: null, kk_last4: null }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.ELIGIBLE, 1);
      assert.strictEqual(result.items[0].category, 'ELIGIBLE');
      assert.strictEqual(result.backfillCandidates, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('7. Valid HMAC and valid kk_last4 categorized as ALREADY_VALID', async () => {
    const kk = '1234567890123456';
    const validHmac = await computeHMAC(kk, mockSecret);

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-valid', tenant_id: 't1', no_kk: kk, nik_kk: null, kk_hmac: validHmac, kk_last4: '3456' }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.ALREADY_VALID, 1);
      assert.strictEqual(result.items[0].category, 'ALREADY_VALID');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('8. Valid HMAC with empty kk_last4 where computed HMAC matches categorized as MISSING_LAST4', async () => {
    const kk = '1234567890123456';
    const validHmac = await computeHMAC(kk, mockSecret);

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-missing-last4', tenant_id: 't1', no_kk: kk, nik_kk: null, kk_hmac: validHmac, kk_last4: null }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.MISSING_LAST4, 1);
      assert.strictEqual(result.items[0].category, 'MISSING_LAST4');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('9. Valid HMAC that does NOT match computed HMAC categorized as HMAC_MISMATCH', async () => {
    const kk = '1234567890123456';
    const wrongHmac = 'a'.repeat(64);

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-mismatch', tenant_id: 't1', no_kk: kk, nik_kk: null, kk_hmac: wrongHmac, kk_last4: '3456' }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.HMAC_MISMATCH, 1);
      assert.strictEqual(result.items[0].category, 'HMAC_MISMATCH');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('10. Corrupt HMAC (not 64 hex chars) categorized as CORRUPT_HMAC', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-corrupt', tenant_id: 't1', no_kk: '1234567890123456', nik_kk: null, kk_hmac: 'corrupt123', kk_last4: '3456' }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.CORRUPT_HMAC, 1);
      assert.strictEqual(result.items[0].category, 'CORRUPT_HMAC');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 3. KEYSET PAGINATION & OUTPUT SAFETY (TESTS 11, 12, 13, 14, 15)
  // =========================================================================

  await t.test('11 & 12. Keyset pagination batching (limit 50) and no data skipping/duplication', async () => {
    const originalFetch = global.fetch;
    const fetchCalls: string[] = [];

    // Simulate 2 pages of data (Page 1: 50 items, Page 2: 10 items)
    global.fetch = async (url) => {
      const urlStr = String(url);
      fetchCalls.push(urlStr);

      if (urlStr.includes('id=gt.student-050')) {
        // Page 2
        const page2 = Array.from({ length: 10 }, (_, i) => ({
          id: `student-${String(i + 51).padStart(3, '0')}`,
          tenant_id: 't1',
          no_kk: '1234567890123456',
          kk_hmac: null,
          kk_last4: null
        }));
        return new Response(JSON.stringify(page2), { status: 200 });
      }

      // Page 1
      const page1 = Array.from({ length: 50 }, (_, i) => ({
        id: `student-${String(i + 1).padStart(3, '0')}`,
        tenant_id: 't1',
        no_kk: '1234567890123456',
        kk_hmac: null,
        kk_last4: null
      }));
      return new Response(JSON.stringify(page1), { status: 200 });
    };

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.totalStudents, 60);
      assert.strictEqual(result.items.length, 60);
      assert.strictEqual(fetchCalls.length, 2);
      assert.match(fetchCalls[0], /limit=50/);
      assert.match(fetchCalls[1], /id=gt\.student-050/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('13. Response contains NO NIK, full KK, full HMAC, or secret', async () => {
    const kk = '1234567890123456';
    const validHmac = await computeHMAC(kk, mockSecret);

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-privacy-test', tenant_id: 't1', no_kk: kk, nik_kk: '9999999999999999', nik: '8888888888888888', kk_hmac: validHmac, kk_last4: '3456' }
    ]), { status: 200 });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      const item = result.items[0];

      assert.strictEqual(item.id, 's-privacy-test');
      assert.strictEqual(item.tenant_id, 't1');
      assert.strictEqual(item.category, 'ALREADY_VALID');

      // Verify no sensitive fields in item output
      assert.strictEqual((item as any).no_kk, undefined);
      assert.strictEqual((item as any).nik, undefined);
      assert.strictEqual((item as any).nik_kk, undefined);
      assert.strictEqual((item as any).kk_hmac, undefined);
      assert.strictEqual((item as any).secret, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('14 & 15. Dry-run does NOT call mutation RPCs or modify database tables', async () => {
    const originalFetch = global.fetch;
    const calledEndpoints: string[] = [];

    global.fetch = async (url) => {
      const urlStr = String(url);
      calledEndpoints.push(urlStr);
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');

      // Assert zero RPC calls
      const rpcCalls = calledEndpoints.filter(ep => ep.includes('/rpc/'));
      assert.strictEqual(rpcCalls.length, 0, 'Dry-run must not invoke any RPC functions');

      // Assert only GET REST requests
      for (const ep of calledEndpoints) {
        assert.match(ep, /\/rest\/v1\/students\?/);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});
