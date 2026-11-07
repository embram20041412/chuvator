import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as createParentPost } from '../functions/api/tenant/parents/index.js';
import { onRequestPost as portalLoginPost } from '../functions/api/portal/v2/login.js';

test('CHUVATOR — Parent Portal V2.5.0 Comprehensive Flow', async (t) => {
  const mockSecret = 'test-secret-123';
  const mockUrl = 'http://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  const appUrl = 'https://myapp.local';
  const encryptionSecret = 'enc-secret-456789012345678901234567'; // 32 bytes ideally but for test any string works if mocked
  
  const validKK = '1234567890123456';
  const validUuid = '12345678-1234-1234-1234-123456789012';

  const getMockContext = (bodyOverride: any = null, envOverrides: any = {}, headersOverride: any = {}) => ({
    request: new Request('http://localhost/api/tenant/parents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer staff-token',
        'Origin': 'https://myapp.local',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'staff-123',
        'x-test-tenant-id': 'tenant-1',
        'cf-connecting-ip': '1.1.1.1',
        'Content-Type': 'application/json',
        ...headersOverride
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
      SUPABASE_ANON_KEY: 'anon-key',
      APP_URL: appUrl,
      ENVIRONMENT: 'test',
      ALLOWED_ORIGINS: 'https://myapp.local',
      PORTAL_TOKEN_ENCRYPTION_SECRET: encryptionSecret,
      ...envOverrides
    }
  });

  // Helper to capture fetch calls
  let fetchHistory: any[] = [];
  const originalFetch = global.fetch;

  const mockFetch = (responses: Record<string, any>) => {
    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      fetchHistory.push({ url: urlStr, options });
      
      for (const [pattern, resp] of Object.entries(responses)) {
        if (urlStr.includes(pattern)) {
          return new Response(JSON.stringify(resp.body), { 
            status: resp.status || 200,
            headers: resp.headers || { 'Content-Type': 'application/json' }
          });
        }
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };
  };

  const resetFetch = () => {
    global.fetch = originalFetch;
    fetchHistory = [];
  };

  await t.test('1. Invitation includes redirect_to and roles (Success Case)', async () => {
    const { computeHMAC } = await import('../functions/api/tenant/_auth_staff.js');
    const validHmac = await computeHMAC(validKK, mockSecret);

    mockFetch({
      '/rest/v1/students': { body: [{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }] },
      '/parent_accounts?email=': { body: [] },
      '/auth/v1/invite': { body: { id: 'auth-id-123' } },
      '/rest/v1/parent_accounts': { body: [{ id: 'p123' }], status: 201 },
      '/rest/v1/parent_student_links': { body: {}, status: 201 }
    });

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 201, 'Should return 201 Created');
      
      const inviteCall = fetchHistory.find(f => f.url.includes('/auth/v1/invite'));
      assert.ok(inviteCall, 'Should have called invite endpoint');
      const invitePayload = JSON.parse(inviteCall.options.body);
      
      assert.strictEqual(invitePayload.redirectTo, `${appUrl}/portal/accept-invitation`);
      assert.strictEqual(invitePayload.data.role, 'parent');
      assert.strictEqual(invitePayload.data.tenantId, 'tenant-1');
    } finally {
      resetFetch();
    }
  });

  await t.test('2. Verification Failure: HMAC Mismatch (Invalid KK)', async () => {
    mockFetch({
      '/rest/v1/students': { body: [{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: 'wrong-hmac' }] }
    });

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'HMAC_MISMATCH');
    } finally {
      resetFetch();
    }
  });

  await t.test('3. Conflict: Email already exists in tenant', async () => {
    const { computeHMAC } = await import('../functions/api/tenant/_auth_staff.js');
    const validHmac = await computeHMAC(validKK, mockSecret);

    mockFetch({
      '/rest/v1/students': { body: [{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }] },
      '/parent_accounts?email=': { body: [{ id: 'existing-p' }] }
    });

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 409);
    } finally {
      resetFetch();
    }
  });

  await t.test('4. Fail-Closed: Database insert failure triggers Auth Cleanup and Sanitized Log', async () => {
    const { computeHMAC } = await import('../functions/api/tenant/_auth_staff.js');
    const validHmac = await computeHMAC(validKK, mockSecret);

    let logs: any[] = [];
    const originalError = console.error;
    console.error = (...args) => logs.push(args);

    mockFetch({
      '/rest/v1/students': { body: [{ id: validUuid, tenant_id: 'tenant-1', kk_hmac: validHmac }] },
      '/parent_accounts?email=': { body: [] },
      '/auth/v1/invite': { body: { id: 'auth-id-to-delete' } },
      '/rest/v1/parent_accounts': { 
        body: { code: '23505', message: 'Unique constraint violation', details: 'secret detail' }, 
        status: 409 
      },
      '/auth/v1/admin/users/': { body: { success: true }, status: 200 }
    });

    try {
      const ctx = getMockContext();
      const res = await createParentPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'PARENT_INSERT_FAILED');

      // Verify log sanitization
      const dbErrorLog = logs.find(l => l[0].includes('[Database Error]'));
      assert.ok(dbErrorLog, 'Should log database error');
      const metadata = dbErrorLog[1];
      assert.strictEqual(metadata.sqlState, '23505');
      assert.strictEqual(metadata.classification, 'UNIQUE_VIOLATION');
      assert.ok(metadata.hasMessage, 'Should indicate message exists');
      assert.ok(metadata.hasDetails, 'Should indicate details exist');
      
      // Verify no PII/Secrets in log metadata (manually check structure)
      assert.strictEqual(Object.keys(metadata).length, 9); // status, contentType, bodyFormat, sqlState, classification, hasMessage, hasDetails, hasHint, authCleanup
      assert.ok(!metadata.message, 'Should not contain raw message');
      assert.ok(!metadata.details, 'Should not contain raw details');

      // Verify cleanup was called
      const cleanupCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/users/auth-id-to-delete') && f.options.method === 'DELETE');
      assert.ok(cleanupCall, 'Auth cleanup should be called');
    } finally {
      console.error = originalError;
      resetFetch();
    }
  });

  await t.test('5. Portal Login: Success Flow (Activation)', async () => {
    mockFetch({
      '/auth/v1/token': { 
        body: { 
          access_token: 'valid-token', 
          refresh_token: 'valid-refresh', 
          user: { id: 'auth-id-123' },
          expires_in: 3600
        } 
      },
      '/rest/v1/rpc/parent_get_children': { 
        body: [{ student_id: validUuid, student_name: 'Kid', tenant_id: 'tenant-1' }] 
      }
    });

    try {
      const ctx = getMockContext({ email: 'parent@example.com', password: 'new-password' });
      const res = await portalLoginPost(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.csrfToken);
      
      const setCookie = res.headers.get('Set-Cookie');
      assert.ok(setCookie?.includes('portal_session_v2'));
    } finally {
      resetFetch();
    }
  });

  await t.test('6. Portal Login: Invalid Credentials', async () => {
    mockFetch({
      '/auth/v1/token': { 
        body: { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 
        status: 400 
      }
    });

    try {
      const ctx = getMockContext({ email: 'parent@example.com', password: 'wrong' });
      const res = await portalLoginPost(ctx);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.message, 'Email atau kata sandi tidak sesuai.');
    } finally {
      resetFetch();
    }
  });

  await t.test('7. Portal Login: Unlinked Account (Parent record missing links)', async () => {
    mockFetch({
      '/auth/v1/token': { 
        body: { access_token: 'valid-token', user: { id: 'auth-id-123' }, expires_in: 3600 } 
      },
      '/rest/v1/rpc/parent_get_children': { body: [] } // Empty = No links
    });

    try {
      const ctx = getMockContext({ email: 'parent@example.com', password: 'password' });
      const res = await portalLoginPost(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.message.includes('belum dihubungkan'));
    } finally {
      resetFetch();
    }
  });
});
