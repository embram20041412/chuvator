import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateSupabaseActionLink,
  isValidSupabaseActionLink,
  validateAndNormalizeWhatsAppNumber,
  generateWhatsAppMessage,
  buildWhatsAppUrl
} from '../functions/api/tenant/parents/_invitation_helper.js';
import { onRequestPost as resendHandler } from '../functions/api/tenant/parents/resend.js';
import { onRequestPost as parentCreateHandler } from '../functions/api/tenant/parents/index.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR PARENT PORTAL V2.6.13 — ACTION LINK DIAGNOSTICS & RESEND VALIDATION TEST SUITE', async (t) => {
  const supabaseUrl = 'https://xyzcompany.supabase.co';
  const appUrl = 'https://chuvator.pages.dev';
  const validRedirect = `${appUrl}/portal/accept-invitation`;

  await t.test('1. validateSupabaseActionLink: Comprehensive Reason Code Assertions', async (t2) => {
    // 1. ACTION_LINK_MISSING
    await t2.test('returns ACTION_LINK_MISSING on null, undefined, empty, or non-string', () => {
      assert.deepStrictEqual(validateSupabaseActionLink(null as any, { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_MISSING'
      });
      assert.deepStrictEqual(validateSupabaseActionLink(undefined as any, { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_MISSING'
      });
      assert.deepStrictEqual(validateSupabaseActionLink('', { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_MISSING'
      });
      assert.deepStrictEqual(validateSupabaseActionLink('   ', { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_MISSING'
      });
      assert.deepStrictEqual(validateSupabaseActionLink(12345 as any, { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_MISSING'
      });
    });

    // 2. ACTION_LINK_INVALID_URL
    await t2.test('returns ACTION_LINK_INVALID_URL on malformed URL string', () => {
      assert.deepStrictEqual(validateSupabaseActionLink('not-a-valid-url', { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_INVALID_URL'
      });
      assert.deepStrictEqual(validateSupabaseActionLink('https://', { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_INVALID_URL'
      });
      assert.deepStrictEqual(validateSupabaseActionLink('://invalid', { supabaseUrl }), {
        valid: false,
        reason: 'ACTION_LINK_INVALID_URL'
      });
    });

    // 3. ACTION_LINK_INVALID_SCHEME
    await t2.test('returns ACTION_LINK_INVALID_SCHEME on non-https (http, ftp, javascript)', () => {
      const httpLink = `http://xyzcompany.supabase.co/auth/v1/verify?token=pkce_secret_123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(httpLink, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_INVALID_SCHEME'
      });

      const ftpLink = `ftp://xyzcompany.supabase.co/auth/v1/verify?token=pkce_secret_123&type=invite`;
      assert.deepStrictEqual(validateSupabaseActionLink(ftpLink, { supabaseUrl, expectedType: 'invite' }), {
        valid: false,
        reason: 'ACTION_LINK_INVALID_SCHEME'
      });
    });

    // 4. ACTION_LINK_WRONG_ORIGIN
    await t2.test('returns ACTION_LINK_WRONG_ORIGIN when origin does not match SUPABASE_URL', () => {
      const evilLink = `https://attacker-supabase.co/auth/v1/verify?token=secret123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(evilLink, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_ORIGIN'
      });

      const subDomainAttack = `https://xyzcompany.supabase.co.attacker.com/auth/v1/verify?token=secret123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(subDomainAttack, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_ORIGIN'
      });

      const differentTenantSubdomain = `https://othercompany.supabase.co/auth/v1/verify?token=secret123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(differentTenantSubdomain, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_ORIGIN'
      });
    });

    // 5. ACTION_LINK_WRONG_PATH
    await t2.test('returns ACTION_LINK_WRONG_PATH when path is not /auth/v1/verify', () => {
      const wrongPath1 = `${supabaseUrl}/auth/v1/authorize?token=secret123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(wrongPath1, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_PATH'
      });

      const wrongPath2 = `${supabaseUrl}/rest/v1/verify?token=secret123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(wrongPath2, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_PATH'
      });

      const wrongPath3 = `${supabaseUrl}/portal/accept-invitation?token=secret123&type=invite`;
      assert.deepStrictEqual(validateSupabaseActionLink(wrongPath3, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_PATH'
      });
    });

    // 6. ACTION_LINK_TOKEN_MISSING
    await t2.test('returns ACTION_LINK_TOKEN_MISSING when token parameter is absent or empty', () => {
      const noToken = `${supabaseUrl}/auth/v1/verify?type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(noToken, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_TOKEN_MISSING'
      });

      const emptyToken = `${supabaseUrl}/auth/v1/verify?token=&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(emptyToken, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_TOKEN_MISSING'
      });

      const whitespaceToken = `${supabaseUrl}/auth/v1/verify?token=%20%20&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(whitespaceToken, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_TOKEN_MISSING'
      });
    });

    // 7. ACTION_LINK_WRONG_TYPE
    await t2.test('returns ACTION_LINK_WRONG_TYPE when link type does not match expectedType', () => {
      // Expecting invite but got recovery
      const recoveryLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=recovery&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(recoveryLink, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_TYPE'
      });

      // Expecting recovery but got invite (e.g. Resend called on active account but returned invite link)
      const inviteLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(inviteLink, { supabaseUrl, expectedType: 'recovery', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_TYPE'
      });

      // Expecting invite but got magiclink
      const magicLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=magiclink&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(magicLink, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_TYPE'
      });

      // Expecting invite but type is missing in query param
      const missingType = `${supabaseUrl}/auth/v1/verify?token=sec123&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(missingType, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_WRONG_TYPE'
      });
    });

    // 8. ACTION_LINK_REDIRECT_MISSING
    await t2.test('returns ACTION_LINK_REDIRECT_MISSING when appUrl is required but redirect_to is missing or empty', () => {
      const noRedirect = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite`;
      assert.deepStrictEqual(validateSupabaseActionLink(noRedirect, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_REDIRECT_MISSING'
      });

      const emptyRedirect = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=`;
      assert.deepStrictEqual(validateSupabaseActionLink(emptyRedirect, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_REDIRECT_MISSING'
      });

      const whitespaceRedirect = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=%20%20`;
      assert.deepStrictEqual(validateSupabaseActionLink(whitespaceRedirect, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_REDIRECT_MISSING'
      });
    });

    // 9. ACTION_LINK_REDIRECT_INVALID
    await t2.test('returns ACTION_LINK_REDIRECT_INVALID when redirect_to is not a valid URL', () => {
      const invalidRedirect = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=not-a-valid-url`;
      assert.deepStrictEqual(validateSupabaseActionLink(invalidRedirect, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_REDIRECT_INVALID'
      });

      const relativeRedirect = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=/portal/accept-invitation`;
      assert.deepStrictEqual(validateSupabaseActionLink(relativeRedirect, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_REDIRECT_INVALID'
      });
    });

    // 10. ACTION_LINK_REDIRECT_MISMATCH
    await t2.test('returns ACTION_LINK_REDIRECT_MISMATCH on domain mismatch or wrong path', () => {
      // Different domain (Open redirect attempt)
      const evilRedirect = encodeURIComponent('https://phishing-portal.com/portal/accept-invitation');
      const evilLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=${evilRedirect}`;
      assert.deepStrictEqual(validateSupabaseActionLink(evilLink, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_REDIRECT_MISMATCH'
      });

      // Same domain, wrong path
      const wrongPathRedirect = encodeURIComponent(`${appUrl}/dashboard`);
      const wrongPathLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=${wrongPathRedirect}`;
      assert.deepStrictEqual(validateSupabaseActionLink(wrongPathLink, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: false,
        reason: 'ACTION_LINK_REDIRECT_MISMATCH'
      });

      // Trailing slash variations must normalize properly
      const trailingApp = `${appUrl}/`;
      const normalLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=${encodeURIComponent(`${appUrl}/portal/accept-invitation/`)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(normalLink, { supabaseUrl, expectedType: 'invite', appUrl: trailingApp }), {
        valid: true,
        reason: 'ACTION_LINK_VALID'
      });
    });

    // 11. ACTION_LINK_VALID
    await t2.test('returns ACTION_LINK_VALID for valid invite and recovery links', () => {
      // Valid invite
      const validInviteLink = `${supabaseUrl}/auth/v1/verify?token=valid_invite_token_999&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(validInviteLink, { supabaseUrl, expectedType: 'invite', appUrl }), {
        valid: true,
        reason: 'ACTION_LINK_VALID'
      });

      // Valid recovery
      const validRecoveryLink = `${supabaseUrl}/auth/v1/verify?token=valid_recovery_token_888&type=recovery&redirect_to=${encodeURIComponent(validRedirect)}`;
      assert.deepStrictEqual(validateSupabaseActionLink(validRecoveryLink, { supabaseUrl, expectedType: 'recovery', appUrl }), {
        valid: true,
        reason: 'ACTION_LINK_VALID'
      });
    });

    // Backward compatibility wrapper isValidSupabaseActionLink
    await t2.test('isValidSupabaseActionLink wrapper returns true only when valid', () => {
      const validLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      const invalidLink = `${supabaseUrl}/auth/v1/verify?token=sec123&type=recovery&redirect_to=${encodeURIComponent(validRedirect)}`;

      assert.strictEqual(isValidSupabaseActionLink(validLink, { supabaseUrl, expectedType: 'invite', appUrl }), true);
      assert.strictEqual(isValidSupabaseActionLink(invalidLink, { supabaseUrl, expectedType: 'invite', appUrl }), false);
      assert.strictEqual(isValidSupabaseActionLink('invalid', { supabaseUrl }), false);
    });
  });

  await t.test('2. Resend Endpoint Integration: Diagnostic Reason & Zero Data Leakage', async (t2) => {
    const originalFetch = globalThis.fetch;
    const interceptedErrors: any[] = [];
    const originalConsoleError = console.error;

    const setupMocks = (options: {
      isConfirmed?: boolean;
      generatedActionLink?: string;
    }) => {
      const {
        isConfirmed = true,
        generatedActionLink = `${supabaseUrl}/auth/v1/verify?token=tok123&type=recovery&redirect_to=${encodeURIComponent(validRedirect)}`
      } = options;

      interceptedErrors.length = 0;
      console.error = (...args: any[]) => {
        interceptedErrors.push(args.map(a => String(a)).join(' '));
      };

      globalThis.fetch = async (url: any, opts: any) => {
        const urlStr = String(url);
        const method = (opts?.method || 'GET').toUpperCase();

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
              email_confirmed_at: isConfirmed ? '2026-01-01T00:00:00.000Z' : null,
              confirmed_at: isConfirmed ? '2026-01-01T00:00:00.000Z' : null,
              user_metadata: {
                invitation_status: isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND'
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
              action_link: generatedActionLink
            }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({}), { status: 200 });
      };
    };

    const cleanup = () => {
      globalThis.fetch = originalFetch;
      console.error = originalConsoleError;
    };

    const createMockContext = (body: any) => {
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
          body: JSON.stringify(body)
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

    await t2.test('returns HTTP 500 and exact diagnostic reason code when Supabase returns link with type mismatch (e.g. invite instead of recovery)', async () => {
      // Simulate account confirmed -> handler expects recovery link, but Supabase returns invite link
      const mismatchLink = `${supabaseUrl}/auth/v1/verify?token=pkce_secret_token_12345&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      setupMocks({ isConfirmed: true, generatedActionLink: mismatchLink });

      try {
        const ctx = createMockContext({ parentId: 'parent_uuid_001', action: 'generate' });
        const res = await resendHandler(ctx as any);
        const json = await res.json();

        assert.strictEqual(res.status, 500);
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.code, 'INVALID_ACTION_LINK');
        assert.strictEqual(json.reason, 'ACTION_LINK_WRONG_TYPE');
        assert.strictEqual(json.message, 'Tautan aksi tidak valid atau tidak memenuhi standar keamanan.');

        // Verify zero leakage of secret token, action link URL, or parent email in response body
        const rawJsonString = JSON.stringify(json);
        assert.strictEqual(rawJsonString.includes('pkce_secret_token_12345'), false, 'Token must not leak in response');
        assert.strictEqual(rawJsonString.includes('verify'), false, 'Verify URL must not leak in response');
        assert.strictEqual(rawJsonString.includes('budi.santoso@example.com'), false, 'Email must not leak in response');

        // Verify console logs do not leak token or URLs
        const logContent = interceptedErrors.join(' ');
        assert.strictEqual(logContent.includes('pkce_secret_token_12345'), false, 'Token must not leak in console log');
        assert.strictEqual(logContent.includes(supabaseUrl), false, 'Supabase URL must not leak in console log');
      } finally {
        cleanup();
      }
    });

    await t2.test('returns HTTP 500 with ACTION_LINK_WRONG_ORIGIN when link origin is forged', async () => {
      const wrongOriginLink = `https://malicious-supabase.io/auth/v1/verify?token=sensitivetoken999&type=recovery&redirect_to=${encodeURIComponent(validRedirect)}`;
      setupMocks({ isConfirmed: true, generatedActionLink: wrongOriginLink });

      try {
        const ctx = createMockContext({ parentId: 'parent_uuid_001', action: 'generate' });
        const res = await resendHandler(ctx as any);
        const json = await res.json();

        assert.strictEqual(res.status, 500);
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.code, 'INVALID_ACTION_LINK');
        assert.strictEqual(json.reason, 'ACTION_LINK_WRONG_ORIGIN');
        assert.strictEqual(json.message, 'Tautan aksi tidak valid atau tidak memenuhi standar keamanan.');

        const rawJsonString = JSON.stringify(json);
        assert.strictEqual(rawJsonString.includes('sensitivetoken999'), false);
        assert.strictEqual(rawJsonString.includes('malicious-supabase.io'), false);
      } finally {
        cleanup();
      }
    });

    await t2.test('returns HTTP 500 with ACTION_LINK_REDIRECT_MISMATCH when redirect_to is an open redirect', async () => {
      const openRedirect = encodeURIComponent('https://phishing.site/portal/accept-invitation');
      const badRedirectLink = `${supabaseUrl}/auth/v1/verify?token=sensitivetoken999&type=recovery&redirect_to=${openRedirect}`;
      setupMocks({ isConfirmed: true, generatedActionLink: badRedirectLink });

      try {
        const ctx = createMockContext({ parentId: 'parent_uuid_001', action: 'generate' });
        const res = await resendHandler(ctx as any);
        const json = await res.json();

        assert.strictEqual(res.status, 500);
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.code, 'INVALID_ACTION_LINK');
        assert.strictEqual(json.reason, 'ACTION_LINK_REDIRECT_MISMATCH');
        assert.strictEqual(json.message, 'Tautan aksi tidak valid atau tidak memenuhi standar keamanan.');

        const rawJsonString = JSON.stringify(json);
        assert.strictEqual(rawJsonString.includes('sensitivetoken999'), false);
        assert.strictEqual(rawJsonString.includes('phishing.site'), false);
      } finally {
        cleanup();
      }
    });

    await t2.test('returns HTTP 200 with valid recovery action link on confirmed parent', async () => {
      const validRecoveryLink = `${supabaseUrl}/auth/v1/verify?token=valid_token_777&type=recovery&redirect_to=${encodeURIComponent(validRedirect)}`;
      setupMocks({ isConfirmed: true, generatedActionLink: validRecoveryLink });

      try {
        const ctx = createMockContext({ parentId: 'parent_uuid_001', action: 'generate' });
        const res = await resendHandler(ctx as any);
        const json = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.status, 'ACTIVATED');
        assert.strictEqual(json.actionLink, validRecoveryLink);
        assert.ok(json.whatsappUrl.startsWith('https://wa.me/6281234567890?text='));
        assert.strictEqual(json.data.tenantName, 'Chua Badminton Academy');
        assert.strictEqual(json.data.type, 'recovery');
      } finally {
        cleanup();
      }
    });
  });

  await t.test('3. Create Parent Endpoint: Diagnostic Reason on Action Link Failure', async (t2) => {
    const originalFetch = globalThis.fetch;
    const hmacSecret = 'test-hmac-secret-1234567890123456';

    const setupCreateMocks = (generatedActionLink: string) => {
      globalThis.fetch = async (url: any, opts: any) => {
        const urlStr = String(url);
        const method = (opts?.method || 'GET').toUpperCase();

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
            id: 'auth_uid_new_parent',
            user: { id: 'auth_uid_new_parent' },
            properties: {
              action_link: generatedActionLink
            }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 5. Cleanup auth user
        if (urlStr.includes('/auth/v1/admin/users/auth_uid_new_parent') && method === 'DELETE') {
          return new Response(JSON.stringify({}), { status: 200 });
        }

        return new Response(JSON.stringify([]), { status: 200 });
      };
    };

    const cleanup = () => {
      globalThis.fetch = originalFetch;
    };

    const createMockContext = (body: any) => {
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
          body: JSON.stringify(body)
        }),
        env: {
          ENVIRONMENT: 'development',
          SUPABASE_URL: supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
          KK_HMAC_SECRET: hmacSecret,
          APP_URL: appUrl
        }
      };
    };

    await t2.test('create parent returns HTTP 500 with reason: ACTION_LINK_TOKEN_MISSING when token is missing', async () => {
      const invalidLink = `${supabaseUrl}/auth/v1/verify?type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
      setupCreateMocks(invalidLink);

      try {
        const ctx = createMockContext({
          email: 'wali.baru@example.com',
          name: 'Ibu Pertiwi',
          phone: '081234567899',
          kk: '3201010101010001',
          studentIds: ['11111111-1111-4111-8111-111111111111'],
          relationship: 'mother'
        });

        const res = await parentCreateHandler(ctx as any);
        const json = await res.json();

        assert.strictEqual(res.status, 500);
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.code, 'INVALID_ACTION_LINK');
        assert.strictEqual(json.reason, 'ACTION_LINK_TOKEN_MISSING');
        assert.strictEqual(json.message, 'Tautan aktivasi yang dihasilkan tidak valid atau tidak memenuhi standar keamanan.');
      } finally {
        cleanup();
      }
    });
  });
});
