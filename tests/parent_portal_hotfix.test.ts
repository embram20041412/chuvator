import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as createParentPost } from '../functions/api/tenant/parents/index.js';
import { onRequestGet as searchStudentsGet } from '../functions/api/tenant/parents/students.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR — Parent Portal Hotfix V2.3.3 Verification Suite', async (t) => {
  const mockSecret = 'test-secret-123';
  const mockUrl = 'http://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  
  const validKK = '1234567890123456';
  const validHmac = await computeHMAC(validKK, mockSecret);
  const validUuid = '12345678-1234-1234-1234-123456789012';

  // Helper for mock context
  const getMockContext = (bodyOverride = null, envOverrides = {}, staffOverrides = {}) => ({
    request: new Request('http://localhost/api/tenant/parents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer staff-token',
        'x-test-staff-role': staffOverrides.role || 'owner',
        'x-test-staff-uid': staffOverrides.uid || 'owner-1',
        'x-test-tenant-id': staffOverrides.tenantId || 'tenant-1',
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

  await t.test('1. Owner rejected if student tenant_id is NULL', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([{ id: validUuid, tenant_id: null, kk_hmac: validHmac }]), { status: 200 });

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

  await t.test('2. Owner rejected if student tenant_id is different', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-wrong', kk_hmac: validHmac }]), { status: 200 });

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 403);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('3. Superadmin can process cross-tenant students', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-any', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts?email=eq.')) return new Response(JSON.stringify([]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-1' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts')) return new Response(JSON.stringify([{ id: 'p1' }]), { status: 201 });
      if (urlStr.includes('/rest/v1/parent_student_links')) return new Response(JSON.stringify({}), { status: 201 });
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext(null, {}, { role: 'superadmin', tenantId: 'global' });
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 201);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('4. Duplicate email check uses tenant filter for Owner', async () => {
    const originalFetch = global.fetch;
    let checkUrl = '';
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/parent_accounts?email=')) { checkUrl = urlStr; return new Response(JSON.stringify([]), { status: 200 }); }
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-1' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts')) return new Response(JSON.stringify([{ id: 'p1' }]), { status: 201 });
      if (urlStr.includes('/rest/v1/parent_student_links')) return new Response(JSON.stringify({}), { status: 201 });
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      await createParentPost(ctx);
      assert.ok(checkUrl.includes('tenant_id=eq.tenant-1'), 'Email check must be tenant-scoped for owner');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('5. Auth cleanup failure detected and logged', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-fail' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') return new Response(JSON.stringify({}), { status: 500 });
      if (urlStr.includes('/auth/v1/admin/users/auth-fail') && method === 'DELETE') return new Response(JSON.stringify({}), { status: 503 }); // Cleanup fails
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      const body: any = await res.json();
      assert.match(body.message, /PERINGATAN: Cleanup gagal/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('6. Student link failure triggers double cleanup', async () => {
    const originalFetch = global.fetch;
    let authCleaned = false;
    let parentCleaned = false;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-id' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') return new Response(JSON.stringify([{ id: 'p-id' }]), { status: 201 });
      if (urlStr.includes('/rest/v1/parent_student_links')) return new Response(JSON.stringify({}), { status: 500 });
      if (urlStr.includes('/auth/v1/admin/users/auth-id') && method === 'DELETE') { authCleaned = true; return new Response(JSON.stringify({}), { status: 200 }); }
      if (urlStr.includes('/parent_accounts?id=eq.p-id') && method === 'DELETE') { parentCleaned = true; return new Response(JSON.stringify({}), { status: 200 }); }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      assert.ok(authCleaned && parentCleaned, 'Both Auth and DB Parent must be cleaned up');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('7. Non-string studentId rejected with 400', async () => {
    const ctx = getMockContext({ name: 'P', email: 'e@e.com', kk: validKK, studentIds: [123] });
    const res = await createParentPost(ctx);
    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.match(body.message, /harus bertipe string/);
  });

  await t.test('8. Full successful invitation flow (HTTP 201)', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/parent_accounts?email=')) return new Response(JSON.stringify([]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-ok' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts')) return new Response(JSON.stringify([{ id: 'p-ok' }]), { status: 201 });
      if (urlStr.includes('/rest/v1/parent_student_links')) return new Response(JSON.stringify({}), { status: 201 });
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 201);
      const body: any = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.parentId, 'p-ok');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
