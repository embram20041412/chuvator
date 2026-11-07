import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as createParentPost } from '../functions/api/tenant/parents/index.js';
import { onRequestGet as searchStudentsGet } from '../functions/api/tenant/parents/students.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR — Parent Portal Hotfix Verification Suite', async (t) => {
  const mockSecret = 'test-secret-123';
  const mockUrl = 'http://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  
  const validKK = '1234567890123456';
  const validHmac = await computeHMAC(validKK, mockSecret);

  // Helper for mock context
  const getMockContext = (overrides = {}) => ({
    request: new Request('http://localhost/api/tenant/parents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer staff-token',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'owner-1',
        'x-test-tenant-id': 'tenant-1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Parent Name',
        email: 'parent@example.com',
        kk: validKK,
        studentIds: ['s1']
      })
    }),
    env: {
      KK_HMAC_SECRET: mockSecret,
      SUPABASE_URL: mockUrl,
      SUPABASE_SERVICE_ROLE_KEY: mockServiceKey,
      ENVIRONMENT: 'test'
    },
    ...overrides
  });

  await t.test('1. Fail-closed if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    const ctx = getMockContext();
    ctx.env.SUPABASE_SERVICE_ROLE_KEY = ''; // Missing

    const res = await createParentPost(ctx);
    assert.strictEqual(res.status, 500);
    const body: any = await res.json();
    assert.strictEqual(body.code, 'SUPABASE_CONFIG_MISSING');
  });

  await t.test('2. HMAC Mismatch rejected with 400', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      if (String(url).includes('/rest/v1/students')) {
        return new Response(JSON.stringify([{
          id: 's1',
          name: 'Student 1',
          tenant_id: 'tenant-1',
          kk_hmac: 'wrong-hmac-in-db'
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'HMAC_MISMATCH');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('3. Tenant Mismatch rejected with 403', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      if (String(url).includes('/rest/v1/students')) {
        return new Response(JSON.stringify([{
          id: 's1',
          name: 'Student 1',
          tenant_id: 'tenant-other', // Different tenant
          kk_hmac: validHmac
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 403);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'STUDENT_TENANT_MISMATCH');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('4. Auth Invitation Failure stops process', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/students')) {
        return new Response(JSON.stringify([{ id: 's1', name: 'S1', tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      }
      if (urlStr.includes('/rest/v1/parent_accounts')) {
         return new Response(JSON.stringify([]), { status: 200 });
      }
      if (urlStr.includes('/auth/v1/admin/users/invite')) {
        return new Response(JSON.stringify({ message: 'Email provider error' }), { status: 500 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'AUTH_INVITATION_FAILED');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('5. Parent Insert Failure triggers Auth Cleanup', async () => {
    const originalFetch = global.fetch;
    let deletedAuthId = null;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();

      if (urlStr.includes('/rest/v1/students')) {
        return new Response(JSON.stringify([{ id: 's1', name: 'S1', tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      }
      if (urlStr.includes('/auth/v1/admin/users/invite')) {
        return new Response(JSON.stringify({ id: 'new-auth-uid' }), { status: 200 });
      }
      if (urlStr.includes('/rest/v1/parent_accounts')) {
        if (method === 'POST') return new Response(JSON.stringify({ error: 'DB Error' }), { status: 500 });
      }
      if (urlStr.includes('/auth/v1/admin/users/new-auth-uid') && method === 'DELETE') {
        deletedAuthId = 'new-auth-uid';
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'PARENT_INSERT_FAILED');
      assert.strictEqual(deletedAuthId, 'new-auth-uid', 'Auth user should be cleaned up');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('6. Student Link Failure triggers full Cleanup (Parent & Auth)', async () => {
    const originalFetch = global.fetch;
    let deletedAuthId = null;
    let deletedParentId = null;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();

      if (urlStr.includes('/rest/v1/students')) {
        return new Response(JSON.stringify([{ id: 's1', name: 'S1', tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      }
      if (urlStr.includes('/auth/v1/admin/users/invite')) {
        return new Response(JSON.stringify({ id: 'new-auth-uid' }), { status: 200 });
      }
      if (urlStr.includes('/rest/v1/parent_accounts')) {
        if (method === 'POST') return new Response(JSON.stringify([{ id: 'new-parent-id' }]), { status: 201 });
        if (method === 'DELETE' && urlStr.includes('id=eq.new-parent-id')) {
          deletedParentId = 'new-parent-id';
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
      }
      if (urlStr.includes('/rest/v1/parent_student_links')) {
        if (method === 'POST') return new Response(JSON.stringify({ error: 'DB Error' }), { status: 500 });
      }
      if (urlStr.includes('/auth/v1/admin/users/new-auth-uid') && method === 'DELETE') {
        deletedAuthId = 'new-auth-uid';
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'STUDENT_LINK_INSERT_FAILED');
      assert.strictEqual(deletedAuthId, 'new-auth-uid', 'Auth user should be cleaned up');
      assert.strictEqual(deletedParentId, 'new-parent-id', 'Parent record should be cleaned up');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('7. Search students fails if config is missing', async () => {
    const ctx = {
      request: new Request(`http://localhost/api/tenant/parents/students?kk=${validKK}`, {
        headers: {
          'Authorization': 'Bearer staff-token',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'owner-1',
          'x-test-tenant-id': 'tenant-1'
        }
      }),
      env: {
        KK_HMAC_SECRET: mockSecret,
        SUPABASE_URL: mockUrl,
        SUPABASE_SERVICE_ROLE_KEY: '', // Missing
        ENVIRONMENT: 'test'
      }
    };

    const res = await searchStudentsGet(ctx);
    assert.strictEqual(res.status, 500);
    const body: any = await res.json();
    assert.strictEqual(body.code, 'SUPABASE_CONFIG_MISSING');
  });

  await t.test('8. Search students uses service role', async () => {
    const originalFetch = global.fetch;
    let usedAuthHeader = '';

    global.fetch = async (url: any, options: any) => {
      usedAuthHeader = options?.headers?.Authorization || '';
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = {
        request: new Request(`http://localhost/api/tenant/parents/students?kk=${validKK}`, {
          headers: {
            'Authorization': 'Bearer staff-token',
            'x-test-staff-role': 'owner',
            'x-test-staff-uid': 'owner-1',
            'x-test-tenant-id': 'tenant-1'
          }
        }),
        env: {
          KK_HMAC_SECRET: mockSecret,
          SUPABASE_URL: mockUrl,
          SUPABASE_SERVICE_ROLE_KEY: mockServiceKey,
          ENVIRONMENT: 'test'
        }
      };

      await searchStudentsGet(ctx);
      assert.strictEqual(usedAuthHeader, `Bearer ${mockServiceKey}`, 'Search should use service role key');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
