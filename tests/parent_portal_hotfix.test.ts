import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as createParentPost } from '../functions/api/tenant/parents/index.js';
import { onRequestGet as searchStudentsGet } from '../functions/api/tenant/parents/students.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR — Parent Portal Hotfix V2.4.0 Verification Suite', async (t) => {
  const mockSecret = 'test-secret-123';
  const mockUrl = 'http://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  
  const validKK = '1234567890123456';
  const validHmac = await computeHMAC(validKK, mockSecret);
  const validUuid = '12345678-1234-1234-1234-123456789012';

  // Helper for mock context
  const getMockContext = (bodyOverride: any = null, envOverrides: any = {}, staffOverrides: any = {}) => ({
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
        studentIds: [validUuid],
        relationship: 'father'
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

  await t.test('3. Superadmin correctly inherits and enforces tenant consistency (V2.4.0)', async () => {
    const originalFetch = global.fetch;
    let parentPayload: any = null;
    let linkPayload: any = null;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      // Student check returns a student with 'tenant-A'
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-A', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts?email=eq.')) return new Response(JSON.stringify([]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-1' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') {
        parentPayload = JSON.parse(options.body);
        return new Response(JSON.stringify([{ id: 'p1' }]), { status: 201 });
      }
      if (urlStr.includes('/rest/v1/parent_student_links') && method === 'POST') {
        linkPayload = JSON.parse(options.body)[0];
        return new Response(JSON.stringify({}), { status: 201 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      // Superadmin with null tenantId
      const ctx = getMockContext(null, {}, { role: 'superadmin', tenantId: null });
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 201);
      
      // Verify parent and link use the student's tenant ('tenant-A') instead of 'global'
      assert.strictEqual(parentPayload.tenant_id, 'tenant-A');
      assert.strictEqual(linkPayload.tenant_id, 'tenant-A');
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

  await t.test('5. Student link failure triggers diagnostics and cleanup (V2.4.0)', async () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    let loggedErrors: any[] = [];
    let authCleaned = false;
    let parentCleaned = false;

    console.error = (...args: any[]) => {
      loggedErrors.push(args);
    };

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-id' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') return new Response(JSON.stringify([{ id: 'p-id' }]), { status: 201 });
      if (urlStr.includes('/rest/v1/parent_student_links')) {
        return new Response(JSON.stringify({ code: '23502', message: 'Not null violation' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/auth/v1/admin/users/auth-id') && method === 'DELETE') { authCleaned = true; return new Response(JSON.stringify({}), { status: 200 }); }
      if (urlStr.includes('/parent_accounts?id=eq.p-id') && method === 'DELETE') { parentCleaned = true; return new Response(JSON.stringify({}), { status: 200 }); }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      assert.ok(authCleaned && parentCleaned, 'Both Auth and DB Parent must be cleaned up');
      
      const logEntry = loggedErrors.find(l => l[0].includes('Student link insertion failed'))[1];
      assert.strictEqual(logEntry.status, 400);
      assert.strictEqual(logEntry.sqlState, '23502');
      assert.strictEqual(logEntry.classification, 'NOT_NULL_VIOLATION');
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });

  await t.test('6. Invalid relationship rejected (V2.4.0)', async () => {
    const ctx = getMockContext({ 
      name: 'P', 
      email: 'e@e.com', 
      kk: validKK, 
      studentIds: [validUuid],
      relationship: 'invalid' 
    });
    const res = await createParentPost(ctx);
    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.match(body.message, /Nilai relationship tidak valid/);
  });

  await t.test('7. Default relationship "guardian" used if not provided (V2.4.0)', async () => {
    const originalFetch = global.fetch;
    let linkPayload: any = null;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-id' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') return new Response(JSON.stringify([{ id: 'p-id' }]), { status: 201 });
      if (urlStr.includes('/rest/v1/parent_student_links')) {
        linkPayload = JSON.parse(options.body)[0];
        return new Response(JSON.stringify({}), { status: 201 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      // Body without relationship
      const ctx = getMockContext({
        name: 'Parent Name',
        email: 'parent@example.com',
        kk: validKK,
        studentIds: [validUuid]
      });
      await createParentPost(ctx);
      assert.strictEqual(linkPayload.relationship, 'guardian', 'Should default to guardian');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('8. Full successful invitation flow with father (HTTP 201)', async () => {
    const originalFetch = global.fetch;
    let linkPayload: any = null;
    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/parent_accounts?email=')) return new Response(JSON.stringify([]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-ok' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts')) return new Response(JSON.stringify([{ id: 'p-ok' }]), { status: 201 });
      if (urlStr.includes('/rest/v1/parent_student_links')) {
        linkPayload = JSON.parse(options.body)[0];
        return new Response(JSON.stringify({}), { status: 201 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(linkPayload.relationship, 'father');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('9. Database insert error logs sanitized diagnostics (V2.3.8+)', async (st) => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    let loggedErrors: any[] = [];

    console.error = (...args: any[]) => {
      loggedErrors.push(args);
    };

    const setupFetchMock = (respBody: string, contentType: string, status: number = 400) => {
      global.fetch = async (url: any, options: any) => {
        const urlStr = String(url);
        const method = (options?.method || 'GET').toUpperCase();
        if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
        if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-id' }), { status: 200 });
        if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') {
          return new Response(respBody, { 
            status, 
            headers: { 'Content-Type': contentType } 
          });
        }
        if (urlStr.includes('/auth/v1/admin/users/auth-id') && method === 'DELETE') {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      };
    };

    try {
      await st.test('9a. Valid SQLSTATE 23505 (Unique Violation)', async () => {
        loggedErrors = [];
        setupFetchMock(JSON.stringify({ code: '23505', message: 'Leak parent@example.com' }), 'application/json');
        await createParentPost(getMockContext());
        const log = loggedErrors.find(l => l[0].includes('[Database Error]'))[1];
        assert.strictEqual(log.sqlState, '23505');
        assert.strictEqual(log.classification, 'UNIQUE_VIOLATION');
        assert.ok(!JSON.stringify(loggedErrors).includes('parent@example.com'));
      });

      await st.test('9b. PostgREST Error Code PGRST116', async () => {
        loggedErrors = [];
        setupFetchMock(JSON.stringify({ code: 'PGRST116', hint: 'Sensitive hint' }), 'application/json');
        await createParentPost(getMockContext());
        const log = loggedErrors.find(l => l[0].includes('[Database Error]'))[1];
        assert.strictEqual(log.sqlState, 'PGRST116');
        assert.strictEqual(log.classification, 'POSTGREST_ERROR');
        assert.ok(!JSON.stringify(loggedErrors).includes('Sensitive hint'));
      });
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });

  await t.test('10. Database insert uses full_name and does not contain name (V2.3.9)', async () => {
    const originalFetch = global.fetch;
    let capturedPayload: any = null;

    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      if (urlStr.includes('/rest/v1/students')) return new Response(JSON.stringify([{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }]), { status: 200 });
      if (urlStr.includes('/auth/v1/invite')) return new Response(JSON.stringify({ id: 'auth-ok' }), { status: 200 });
      if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') {
        capturedPayload = JSON.parse(options.body);
        return new Response(JSON.stringify([{ id: 'p-ok' }]), { status: 201 });
      }
      if (urlStr.includes('/rest/v1/parent_student_links')) return new Response(JSON.stringify({}), { status: 201 });
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = getMockContext();
      await createParentPost(ctx);
      
      assert.ok(capturedPayload, 'Payload should be captured');
      assert.strictEqual(capturedPayload.full_name, 'Parent Name', 'Should use full_name');
      assert.strictEqual(capturedPayload.name, undefined, 'Should not contain name property');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
