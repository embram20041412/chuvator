import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as createParentPost } from '../functions/api/tenant/parents/index.js';
import { onRequestGet as searchStudentsGet } from '../functions/api/tenant/parents/students.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR — Parent Portal Hotfix V2.3.2 Verification Suite', async (t) => {
  const mockSecret = 'test-secret-123';
  const mockUrl = 'http://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  
  const validKK = '1234567890123456';
  const validHmac = await computeHMAC(validKK, mockSecret);
  const validUuid = '12345678-1234-1234-1234-123456789012';

  // Helper for mock context
  const getMockContext = (bodyOverride = null, envOverrides = {}) => ({
    request: new Request('http://localhost/api/tenant/parents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer staff-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'owner-1',
        'x-test-tenant-id': 'tenant-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyOverride || {
        name: 'Parent Name',
        email: 'parent@example.com',
        kk: validKK,
        studentIds: [validUuid]
      })
    }),
    env: {
      KK_HMAC_SECRET: mockSecret,
      SUPABASE_URL: mockUrl,
      SUPABASE_SERVICE_ROLE_KEY: mockServiceKey,
      ENVIRONMENT: 'test',
      ...envOverrides
    }
  });

  await t.test('1. Fail-closed if Config Missing', async () => {
    const ctx = getMockContext(null, { SUPABASE_SERVICE_ROLE_KEY: '' });
    const res = await createParentPost(ctx);
    assert.strictEqual(res.status, 500);
    const body: any = await res.json();
    assert.strictEqual(body.code, 'SUPABASE_CONFIG_MISSING');
  });

  await t.test('2. Parent email check failure stops process', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      if (String(url).includes('/rest/v1/parent_accounts?email=eq.')) {
        return new Response(JSON.stringify({ error: 'DB error' }), { status: 500 });
      }
      if (String(url).includes('/rest/v1/students')) {
        return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'PARENT_VERIFICATION_FAILED');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('3. Duplicate parent email returns 409', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      if (String(url).includes('/rest/v1/parent_accounts?email=eq.')) {
        return new Response(JSON.stringify([{ id: 'existing' }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 409);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('4. Correct Invitation Endpoint used (/auth/v1/invite)', async () => {
    const originalFetch = global.fetch;
    let usedUrl = '';
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/invite')) {
        usedUrl = urlStr;
        return new Response(JSON.stringify({ id: 'new-uid' }), { status: 200 });
      }
      if (urlStr.includes('/rest/v1/students')) {
        return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      await createParentPost(ctx);
      assert.ok(usedUrl.endsWith('/auth/v1/invite'), `Expected /auth/v1/invite but got ${usedUrl}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('5. Duplicate studentIds rejected', async () => {
    const body = { name: 'P', email: 'e@e.com', kk: validKK, studentIds: [validUuid, validUuid] };
    const ctx = getMockContext(body);

    const res = await createParentPost(ctx);
    assert.strictEqual(res.status, 400);
  });

  await t.test('6. Student Demo rejected in Production', async () => {
    const body = { name: 'P', email: 'e@e.com', kk: validKK, studentIds: ['student-demo-123'] };
    const ctx = getMockContext(body, { NODE_ENV: 'production' });

    const res = await createParentPost(ctx);
    assert.strictEqual(res.status, 400);
  });

  await t.test('7. Cleanup: Parent Insert without ID', async () => {
    const originalFetch = global.fetch;
    let authDeleted = false;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();

      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-uid' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts')) {
        if (method === 'POST') return new Response(JSON.stringify([]), { status: 200 }); // Missing ID
      }
      if (urlStr.includes('/auth/v1/admin/users/auth-uid') && method === 'DELETE') {
        authDeleted = true;
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      assert.strictEqual(authDeleted, true, 'Auth should be cleaned up');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('8. Full Cleanup: Student Link Failure', async () => {
    const originalFetch = global.fetch;
    let authDeleted = false;
    let parentDeleted = false;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();

      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-uid' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts')) {
        if (method === 'POST') return new Response(JSON.stringify([{ id: 'p1' }]), { status: 201 });
        if (method === 'DELETE' && urlStr.includes('id=eq.p1')) {
          parentDeleted = true;
          return new Response(JSON.stringify({}), { status: 200 });
        }
      }
      if (urlStr.includes('/rest/v1/parent_student_links')) return new Response(JSON.stringify({}), { status: 500 });
      if (urlStr.includes('/auth/v1/admin/users/auth-uid') && method === 'DELETE') {
        authDeleted = true;
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      assert.strictEqual(authDeleted, true);
      assert.strictEqual(parentDeleted, true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('9. Search Student uses Service Role', async () => {
    const originalFetch = global.fetch;
    let authHeader = '';

    global.fetch = async (url: any, options: any) => {
      authHeader = options?.headers?.Authorization || '';
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = {
        request: new Request(`http://localhost/api/tenant/parents/students?kk=${validKK}`, {
          headers: { 'Authorization': 'Bearer staff-token', 'x-test-staff-role': 'owner', 'x-test-staff-uid': 'o1', 'x-test-tenant-id': 't1' }
        }),
        env: { KK_HMAC_SECRET: mockSecret, SUPABASE_URL: mockUrl, SUPABASE_SERVICE_ROLE_KEY: mockServiceKey }
      };
      await searchStudentsGet(ctx);
      assert.strictEqual(authHeader, `Bearer ${mockServiceKey}`);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
