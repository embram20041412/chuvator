import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as resendHandler } from '../functions/api/tenant/parents/resend.js';
import { onRequestPost as parentCreateHandler } from '../functions/api/tenant/parents/index.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR PARENT PORTAL V2.6.14 — REST PAYLOAD & REDIRECT_TO VERIFICATION', async (t) => {
  const supabaseUrl = 'https://xyzcompany.supabase.co';
  const appUrl = 'https://chuvator.pages.dev';
  const expectedRedirectUrl = `${appUrl}/portal/accept-invitation`;
  const hmacSecret = 'test-hmac-secret-1234567890123456';

  await t.test('1. Resend Endpoint: Intercept actual POST payload to /auth/v1/admin/generate_link', async (t2) => {
    const originalFetch = globalThis.fetch;
    const fetchHistory: Array<{ url: string; method: string; body: any }> = [];

    const setupMocks = (options: {
      isConfirmed: boolean;
      returnedActionLink: string;
    }) => {
      fetchHistory.length = 0;
      globalThis.fetch = async (url: any, opts: any) => {
        const urlStr = String(url);
        const method = (opts?.method || 'GET').toUpperCase();
        let parsedBody: any = null;
        if (opts?.body) {
          try {
            parsedBody = JSON.parse(opts.body);
          } catch (_) {
            parsedBody = opts.body;
          }
        }
        fetchHistory.push({ url: urlStr, method, body: parsedBody });

        // 1. Parent accounts query
        if (urlStr.includes('/rest/v1/parent_accounts')) {
          return new Response(JSON.stringify([{
            id: 'parent_uuid_001',
            tenant_id: 'tenant_chua_01',
            email: 'budi.santoso@example.com',
            phone: '081234567890',
            full_name: 'Budi Santoso',
            auth_uid: 'auth_uid_parent_001'
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Auth user check
        if (urlStr.includes('/auth/v1/admin/users/auth_uid_parent_001')) {
          if (method === 'GET') {
            return new Response(JSON.stringify({
              id: 'auth_uid_parent_001',
              email: 'budi.santoso@example.com',
              email_confirmed_at: options.isConfirmed ? '2026-01-01T00:00:00.000Z' : null,
              confirmed_at: options.isConfirmed ? '2026-01-01T00:00:00.000Z' : null,
              user_metadata: {
                invitation_status: options.isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND'
              }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (method === 'PUT') {
            return new Response(JSON.stringify({ success: true }), { status: 200 });
          }
        }

        // 3. Tenant name verification
        if (urlStr.includes('/rest/v1/tenants')) {
          return new Response(JSON.stringify([{
            id: 'tenant_chua_01',
            name: 'Chua Badminton Academy'
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 4. Generate link mock
        if (urlStr.includes('/auth/v1/admin/generate_link')) {
          return new Response(JSON.stringify({
            properties: {
              action_link: options.returnedActionLink
            }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({}), { status: 200 });
      };
    };

    const cleanup = () => {
      globalThis.fetch = originalFetch;
    };

    const createMockContext = () => {
      const mockKVStore: Record<string, string> = {};
      return {
        request: new Request('https://chuvator.pages.dev/api/tenant/parents/resend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-staff-token',
            'x-test-staff-role': 'owner',
            'x-test-staff-uid': 'staff_uid_01',
            'x-test-tenant-id': 'tenant_chua_01'
          },
          body: JSON.stringify({ parentId: 'parent_uuid_001', action: 'generate' })
        }),
        env: {
          ENVIRONMENT: 'development',
          SUPABASE_URL: supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
          APP_URL: appUrl,
          PORTAL_RATELIMIT_KV: {
            get: async (k: string) => mockKVStore[k] || null,
            put: async (k: string, v: string) => { mockKVStore[k] = v; },
            delete: async (k: string) => { delete mockKVStore[k]; }
          }
        }
      };
    };

    await t2.test('A. Confirmed parent uses type recovery, top-level redirect_to, and no options object', async () => {
      const validRecoveryLink = `${supabaseUrl}/auth/v1/verify?token=tok_rec_123&type=recovery&redirect_to=${encodeURIComponent(expectedRedirectUrl)}`;
      setupMocks({ isConfirmed: true, returnedActionLink: validRecoveryLink });

      try {
        const res = await resendHandler(createMockContext() as any);
        const json = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.status, 'ACTIVATED');

        // Verify intercepted generate_link request
        const generateLinkCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/generate_link'));
        assert.ok(generateLinkCall, 'Must call /auth/v1/admin/generate_link');
        assert.strictEqual(generateLinkCall.method, 'POST');

        const payload = generateLinkCall.body;
        assert.strictEqual(payload.type, 'recovery', 'Confirmed account must use type: recovery');
        assert.strictEqual(payload.email, 'budi.santoso@example.com');
        assert.strictEqual(payload.redirect_to, expectedRedirectUrl, 'redirect_to must be top-level and match accept-invitation URL');
        assert.strictEqual(payload.options, undefined, 'Must not include options wrapper object');
        assert.strictEqual('options' in payload, false, 'options property must not exist in payload');
      } finally {
        cleanup();
      }
    });

    await t2.test('B. Unconfirmed parent uses type invite, top-level redirect_to, and no options object', async () => {
      const validInviteLink = `${supabaseUrl}/auth/v1/verify?token=tok_inv_123&type=invite&redirect_to=${encodeURIComponent(expectedRedirectUrl)}`;
      setupMocks({ isConfirmed: false, returnedActionLink: validInviteLink });

      try {
        const res = await resendHandler(createMockContext() as any);
        const json = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.status, 'READY_TO_SEND');

        // Verify intercepted generate_link request
        const generateLinkCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/generate_link'));
        assert.ok(generateLinkCall, 'Must call /auth/v1/admin/generate_link');

        const payload = generateLinkCall.body;
        assert.strictEqual(payload.type, 'invite', 'Unconfirmed account must use type: invite');
        assert.strictEqual(payload.email, 'budi.santoso@example.com');
        assert.strictEqual(payload.redirect_to, expectedRedirectUrl, 'redirect_to must be top-level and match accept-invitation URL');
        assert.strictEqual(payload.options, undefined, 'Must not include options wrapper object');
        assert.strictEqual('options' in payload, false, 'options property must not exist in payload');
      } finally {
        cleanup();
      }
    });

    await t2.test('C. Resend still strictly rejects action link with mismatched redirect', async () => {
      const maliciousRedirect = encodeURIComponent('https://evil.attacker.com/portal/accept-invitation');
      const maliciousLink = `${supabaseUrl}/auth/v1/verify?token=tok_inv_123&type=recovery&redirect_to=${maliciousRedirect}`;
      setupMocks({ isConfirmed: true, returnedActionLink: maliciousLink });

      try {
        const res = await resendHandler(createMockContext() as any);
        const json = await res.json();

        assert.strictEqual(res.status, 500);
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.code, 'INVALID_ACTION_LINK');
        assert.strictEqual(json.reason, 'ACTION_LINK_REDIRECT_MISMATCH');
      } finally {
        cleanup();
      }
    });
  });

  await t.test('2. Create Parent Endpoint: Intercept actual POST payload to /auth/v1/admin/generate_link', async (t2) => {
    const originalFetch = globalThis.fetch;
    const fetchHistory: Array<{ url: string; method: string; body: any }> = [];

    const setupCreateMocks = (returnedActionLink: string) => {
      fetchHistory.length = 0;
      globalThis.fetch = async (url: any, opts: any) => {
        const urlStr = String(url);
        const method = (opts?.method || 'GET').toUpperCase();
        let parsedBody: any = null;
        if (opts?.body) {
          try {
            parsedBody = JSON.parse(opts.body);
          } catch (_) {
            parsedBody = opts.body;
          }
        }
        fetchHistory.push({ url: urlStr, method, body: parsedBody });

        // 1. Verify students
        if (urlStr.includes('/rest/v1/students')) {
          const studentHmac = await computeHMAC('3201010101010001', hmacSecret);
          return new Response(JSON.stringify([{
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Andi Santoso',
            tenant_id: 'tenant_chua_01',
            kk_hmac: studentHmac
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Tenant lookup
        if (urlStr.includes('/rest/v1/tenants')) {
          return new Response(JSON.stringify([{
            id: 'tenant_chua_01',
            name: 'Chua Badminton Academy'
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Parent email check
        if (urlStr.includes('/rest/v1/parent_accounts?email=')) {
          return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 4. Generate link
        if (urlStr.includes('/auth/v1/admin/generate_link')) {
          return new Response(JSON.stringify({
            id: 'auth_uid_new_parent_123',
            user: { id: 'auth_uid_new_parent_123' },
            properties: {
              action_link: returnedActionLink
            }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 5. Parent accounts insert
        if (urlStr.includes('/rest/v1/parent_accounts') && method === 'POST') {
          return new Response(JSON.stringify([{
            id: 'new_parent_id_999'
          }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        // 6. Parent student links insert
        if (urlStr.includes('/rest/v1/parent_student_links') && method === 'POST') {
          return new Response(JSON.stringify([{ success: true }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        // 7. Cleanup auth user
        if (urlStr.includes('/auth/v1/admin/users/auth_uid_new_parent_123') && method === 'DELETE') {
          return new Response(JSON.stringify({}), { status: 200 });
        }

        return new Response(JSON.stringify([]), { status: 200 });
      };
    };

    const cleanup = () => {
      globalThis.fetch = originalFetch;
    };

    const createMockContext = () => {
      return {
        request: new Request('https://chuvator.pages.dev/api/tenant/parents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-staff-token',
            'x-test-staff-role': 'owner',
            'x-test-staff-uid': 'staff_uid_01',
            'x-test-tenant-id': 'tenant_chua_01'
          },
          body: JSON.stringify({
            email: 'wali.baru@example.com',
            name: 'Ibu Pertiwi',
            phone: '081234567899',
            kk: '3201010101010001',
            studentIds: ['11111111-1111-4111-8111-111111111111'],
            relationship: 'mother'
          })
        }),
        env: {
          ENVIRONMENT: 'development',
          SUPABASE_URL: supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
          KK_HMAC_SECRET: hmacSecret,
          APP_URL: appUrl,
          PORTAL_SESSIONS_KV: {
            get: async () => null,
            put: async () => {},
            delete: async () => {}
          }
        }
      };
    };

    await t2.test('A. Create parent uses type invite, top-level redirect_to, top-level data metadata, and no options object', async () => {
      const validInviteLink = `${supabaseUrl}/auth/v1/verify?token=tok_create_123&type=invite&redirect_to=${encodeURIComponent(expectedRedirectUrl)}`;
      setupCreateMocks(validInviteLink);

      try {
        const res = await parentCreateHandler(createMockContext() as any);
        const json = await res.json();

        assert.strictEqual(res.status, 201);
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.actionLink, validInviteLink);

        // Verify intercepted generate_link request
        const generateLinkCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/generate_link'));
        assert.ok(generateLinkCall, 'Must call /auth/v1/admin/generate_link');
        assert.strictEqual(generateLinkCall.method, 'POST');

        const payload = generateLinkCall.body;
        assert.strictEqual(payload.type, 'invite', 'Must use type: invite for new parent creation');
        assert.strictEqual(payload.email, 'wali.baru@example.com');
        assert.strictEqual(payload.redirect_to, expectedRedirectUrl, 'redirect_to must be top-level and match accept-invitation URL');
        assert.strictEqual(payload.options, undefined, 'Must not include options wrapper object');
        assert.strictEqual('options' in payload, false, 'options property must not exist in payload');

        // Assert top-level data metadata structure
        assert.ok(payload.data, 'data must be present at top-level');
        assert.strictEqual(typeof payload.data, 'object');
        assert.strictEqual(payload.data.name, 'Ibu Pertiwi');
        assert.strictEqual(payload.data.role, 'parent');
        assert.strictEqual(payload.data.tenantId, 'tenant_chua_01');
        assert.strictEqual(payload.data.invitation_status, 'READY_TO_SEND');
        assert.ok(payload.data.invitation_generated_at, 'invitation_generated_at must be present');
        assert.ok(!isNaN(new Date(payload.data.invitation_generated_at).getTime()), 'invitation_generated_at must be valid date');
        assert.strictEqual(payload.data.invitation_generated_by, 'staff_uid_01');
      } finally {
        cleanup();
      }
    });

    await t2.test('B. Create parent still strictly rejects action link with mismatched redirect', async () => {
      const maliciousRedirect = encodeURIComponent('https://evil.site/portal/accept-invitation');
      const badLink = `${supabaseUrl}/auth/v1/verify?token=tok_create_123&type=invite&redirect_to=${maliciousRedirect}`;
      setupCreateMocks(badLink);

      try {
        const res = await parentCreateHandler(createMockContext() as any);
        const json = await res.json();

        assert.strictEqual(res.status, 500);
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.code, 'INVALID_ACTION_LINK');
        assert.strictEqual(json.reason, 'ACTION_LINK_REDIRECT_MISMATCH');

        // Confirm cleanup auth user was called
        const deleteAuthCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/users/auth_uid_new_parent_123') && f.method === 'DELETE');
        assert.ok(deleteAuthCall, 'Must clean up auth user upon action link validation failure');
      } finally {
        cleanup();
      }
    });
  });
});
