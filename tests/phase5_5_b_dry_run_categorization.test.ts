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
  // 1. AUTHENTICATION & SECURITY CONTROLS
  // =========================================================================

  await t.test('1. Invalid staff authentication rejected (401)', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/backfill_kk_hmac?dryRun=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockKey }
    };

    const res = await backfillIndexPost(context);
    assert.strictEqual(res.status, 401);
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
  });

  await t.test('3. Tenant isolation works: Filter applied to REST query', async () => {
    const originalFetch = global.fetch;
    let queriedUrl = '';

    global.fetch = async (url) => {
      queriedUrl = String(url);
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'tenant-abc');
      assert.match(queriedUrl, /tenant_id=eq\.tenant-abc/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 2. CATEGORIZATION RULES
  // =========================================================================

  await t.test('4. Empty no_kk categorized as MISSING_NO_KK', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-empty-kk', tenant_id: 't1', no_kk: null, kk_hmac: null, kk_last4: null }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.MISSING_NO_KK, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('5. Invalid no_kk format (not 16 digits) categorized as INVALID_NO_KK', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-short-kk', tenant_id: 't1', no_kk: '12345', kk_hmac: null, kk_last4: null }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.INVALID_NO_KK, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('6. Valid KK (16 digits) without HMAC categorized as ELIGIBLE', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-eligible', tenant_id: 't1', no_kk: '1234567890123456', kk_hmac: null, kk_last4: null }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.ELIGIBLE, 1);
      assert.strictEqual(result.eligibleCandidates, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('7. Valid HMAC and valid kk_last4 categorized as ALREADY_VALID', async () => {
    const kk = '1234567890123456';
    const validHmac = await computeHMAC(kk, mockSecret);

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-valid', tenant_id: 't1', no_kk: kk, kk_hmac: validHmac, kk_last4: '3456' }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.ALREADY_VALID, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('8. Valid HMAC with empty kk_last4 where computed HMAC matches categorized as MISSING_LAST4', async () => {
    const kk = '1234567890123456';
    const validHmac = await computeHMAC(kk, mockSecret);

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-missing-last4', tenant_id: 't1', no_kk: kk, kk_hmac: validHmac, kk_last4: null }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.MISSING_LAST4, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('9. Valid HMAC that does NOT match computed HMAC categorized as HMAC_MISMATCH', async () => {
    const kk = '1234567890123456';
    const wrongHmac = 'a'.repeat(64);

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-mismatch', tenant_id: 't1', no_kk: kk, kk_hmac: wrongHmac, kk_last4: '3456' }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.HMAC_MISMATCH, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('10. Corrupt HMAC (not 64 hex chars) categorized as CORRUPT_HMAC', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-corrupt', tenant_id: 't1', no_kk: '1234567890123456', kk_hmac: 'corrupt123', kk_last4: '3456' }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.categories.CORRUPT_HMAC, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 3. KEYSET PAGINATION & OUTPUT SAFETY
  // =========================================================================

  await t.test('11 & 12. Keyset pagination batching (limit 50)', async () => {
    const originalFetch = global.fetch;
    const fetchCalls: string[] = [];

    global.fetch = async (url) => {
      const urlStr = String(url);
      fetchCalls.push(urlStr);

      if (urlStr.includes('id=gt.student-050')) {
        const page2 = Array.from({ length: 10 }, (_, i) => ({
          id: `student-${String(i + 51).padStart(3, '0')}`,
          tenant_id: 't1',
          no_kk: '1234567890123456',
          kk_hmac: null,
          kk_last4: null
        }));
        return new Response(JSON.stringify(page2), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const page1 = Array.from({ length: 50 }, (_, i) => ({
        id: `student-${String(i + 1).padStart(3, '0')}`,
        tenant_id: 't1',
        no_kk: '1234567890123456',
        kk_hmac: null,
        kk_last4: null
      }));
      return new Response(JSON.stringify(page1), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const result = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.totalStudents, 60);
      assert.strictEqual(fetchCalls.length, 2);
      assert.match(fetchCalls[0], /limit=50/);
      assert.match(fetchCalls[1], /id=gt\.student-050/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('13. Response contains NO sensitive fields or identifiers', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([
      { id: 's-privacy-test', tenant_id: 't1', no_kk: '1234567890123456', kk_hmac: null, kk_last4: '3456' }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result: any = await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      assert.strictEqual(result.items, undefined);
      const resStr = JSON.stringify(result);
      assert.doesNotMatch(resStr, /s-privacy-test/);
      assert.doesNotMatch(resStr, /1234567890123456/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('14 & 15. Dry-run does NOT call mutation RPCs', async () => {
    const originalFetch = global.fetch;
    const calledEndpoints: string[] = [];

    global.fetch = async (url) => {
      const urlStr = String(url);
      calledEndpoints.push(urlStr);
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      await performDryRunAnalysis(mockUrl, mockKey, mockSecret, 'global');
      const rpcCalls = calledEndpoints.filter(ep => ep.includes('/rpc/'));
      assert.strictEqual(rpcCalls.length, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
