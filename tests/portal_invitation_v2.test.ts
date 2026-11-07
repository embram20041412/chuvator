import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as createParentPost } from '../functions/api/tenant/parents/index.js';
import { onRequestPost as portalLoginPost } from '../functions/api/portal/v2/login.js';
import { initInvitationSessionCallback } from '../src/utils/portalAuthCallback.js';

test('CHUVATOR — Parent Portal V2.5.2 Comprehensive Invitation & Callback Flow', async (t) => {
  const mockSecret = 'test-secret-123';
  const mockUrl = 'http://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  const appUrl = 'https://myapp.local';
  const encryptionSecret = 'enc-secret-456789012345678901234567';

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

  await t.test('1. Invitation includes redirect_to in URL query parameter and metadata in body', async () => {
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
      
      const inviteReqUrl = new URL(inviteCall.url);
      assert.strictEqual(
        inviteReqUrl.searchParams.get('redirect_to'),
        `${appUrl}/portal/accept-invitation`,
        'redirect_to query parameter must match activation page URL'
      );

      const invitePayload = JSON.parse(inviteCall.options.body);
      assert.strictEqual(invitePayload.redirectTo, undefined, 'redirectTo must not be in JSON body');
      assert.strictEqual(invitePayload.data.role, 'parent');
      assert.strictEqual(invitePayload.data.name, 'Parent Name');
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

      const dbErrorLog = logs.find(l => l[0].includes('[Database Error]'));
      assert.ok(dbErrorLog, 'Should log database error');
      const metadata = dbErrorLog[1];
      assert.strictEqual(metadata.sqlState, '23505');
      assert.strictEqual(metadata.classification, 'UNIQUE_VIOLATION');
      assert.ok(metadata.hasMessage, 'Should indicate message exists');
      assert.ok(metadata.hasDetails, 'Should indicate details exist');
      assert.ok(!metadata.message, 'Should not contain raw message');
      assert.ok(!metadata.details, 'Should not contain raw details');

      const cleanupCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/users/auth-id-to-delete') && f.options.method === 'DELETE');
      assert.ok(cleanupCall, 'Auth cleanup should be called');
    } finally {
      console.error = originalError;
      resetFetch();
    }
  });

  await t.test('5. V2.5.2: Session received before timeout - no expiration error appears', async () => {
    let successCalled = false;
    let errorCalled = false;

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: { user: { email: 'p@ex.com', user_metadata: { role: 'parent' } } } },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=abc', search: '' };
    const sessionReceivedRef = { current: false };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 100,
      sessionReceivedRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(successCalled, true, 'onSuccess should be called when session is valid');
    assert.strictEqual(errorCalled, false, 'onError should NOT be called if session is received before timeout');

    cleanup();
  });

  await t.test('6. V2.5.2: Session not received until timeout - expiration error appears', async () => {
    let errorCalled = false;
    let errorMsg = '';

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: null },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=abc', search: '' };
    const sessionReceivedRef = { current: false };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => {},
      onError: (msg: any) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 50,
      sessionReceivedRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 120));
    assert.strictEqual(errorCalled, true, 'onError should be called upon timeout if no session received');
    assert.ok(errorMsg.includes('kedaluwarsa'), 'Error message should mention expiration');

    cleanup();
  });

  await t.test('7. V2.5.2: Component unmount cleans up timeout and subscription', async () => {
    let unsubscribed = false;

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: () => { unsubscribed = true; }
            }
          }
        }),
        getSession: async () => ({
          data: { session: null },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=abc', search: '' };
    const sessionReceivedRef = { current: false };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => {},
      onError: () => {},
      timeoutMs: 500,
      sessionReceivedRef,
      timeoutRef
    });

    cleanup();
    assert.strictEqual(unsubscribed, true, 'Subscription unsubscribe must be called on cleanup/unmount');
    assert.strictEqual(timeoutRef.current, null, 'Timeout ref must be cleared on cleanup/unmount');
  });

  await t.test('8. V2.5.2: Callback role non-parent is rejected', async () => {
    let errorCalled = false;
    let errorMsg = '';

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: { user: { email: 'staff@ex.com', user_metadata: { role: 'staff' } } } },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=abc', search: '' };
    const sessionReceivedRef = { current: false };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => {},
      onError: (msg: any) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 100,
      sessionReceivedRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(errorCalled, true, 'onError should be called for non-parent role');
    assert.ok(errorMsg.includes('Akses ditolak'), 'Error message should deny non-parent access');

    cleanup();
  });

  await t.test('9. Password Update & V2 Session: Success flow', async () => {
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
      const ctx = getMockContext({ email: 'parent@example.com', password: 'new-password-123' });
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

  await t.test('10. Password Update & V2 Session: Login failure after password update (Unlinked parent)', async () => {
    mockFetch({
      '/auth/v1/token': { 
        body: { access_token: 'valid-token', user: { id: 'auth-id-123' }, expires_in: 3600 } 
      },
      '/rest/v1/rpc/parent_get_children': { body: [] }
    });

    try {
      const ctx = getMockContext({ email: 'parent@example.com', password: 'new-password-123' });
      const res = await portalLoginPost(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.message.includes('belum dihubungkan'));
    } finally {
      resetFetch();
    }
  });

  await t.test('11. Security Audit: No secrets, passwords, or tokens in logs', async () => {
    let capturedLogs: string[] = [];
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;

    console.error = (...args: any[]) => capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    console.log = (...args: any[]) => capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));

    const sensitiveTerms = ['new-password-123', mockServiceKey, mockSecret];

    try {
      const ctx = getMockContext({ email: 'parent@example.com', password: 'new-password-123' });
      await portalLoginPost(ctx);

      const allLogsText = capturedLogs.join('\n');
      for (const term of sensitiveTerms) {
        assert.ok(!allLogsText.includes(term), `Log output must not contain sensitive term: ${term}`);
      }
    } finally {
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
    }
  });
});
