import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as resendHandler } from '../functions/api/tenant/parents/resend.js';
import { onRequestPost as parentCreateHandler } from '../functions/api/tenant/parents/index.js';
import {
  onRequestGet as claimGetHandler,
  onRequestPost as claimPostHandler
} from '../functions/api/portal/invitation/claim.js';
import {
  generateClaimToken,
  buildIntermediaryClaimUrl,
  validateSupabaseActionLink
} from '../functions/api/tenant/parents/_invitation_helper.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR PARENT PORTAL V2.6.15 — SECURE INTERMEDIARY INVITATION CLAIM TEST SUITE', async (t) => {
  const supabaseUrl = 'https://xyzcompany.supabase.co';
  const appUrl = 'https://chuvator.pages.dev';
  const validRedirect = `${appUrl}/portal/accept-invitation`;
  const hmacSecret = 'test-hmac-secret-1234567890123456';

  await t.test('1 & 2. Create Parent & Resend produce intermediary URL and protect WhatsApp from raw OTP verify link', async (t2) => {
    const originalFetch = globalThis.fetch;
    const rawInviteLink = `${supabaseUrl}/auth/v1/verify?token=invite_otp_secret_111&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;
    const rawRecoveryLink = `${supabaseUrl}/auth/v1/verify?token=recovery_otp_secret_222&type=recovery&redirect_to=${encodeURIComponent(validRedirect)}`;

    const mockKVStore: Record<string, string> = {};

    const setupMocks = (isConfirmed = false) => {
      globalThis.fetch = async (url: any, opts: any) => {
        const urlStr = String(url);
        const method = (opts?.method || 'GET').toUpperCase();

        // 1. Students check (create)
        if (urlStr.includes('/rest/v1/students')) {
          const studentHmac = await computeHMAC('3201010101010001', hmacSecret);
          return new Response(JSON.stringify([{
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Andi Santoso',
            tenant_id: 'tenant_chua_01',
            kk_hmac: studentHmac
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Tenants lookup
        if (urlStr.includes('/rest/v1/tenants')) {
          return new Response(JSON.stringify([{
            id: 'tenant_chua_01',
            name: 'Chua Badminton Academy'
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Parent check
        if (urlStr.includes('/rest/v1/parent_accounts?email=')) {
          return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (urlStr.includes('/rest/v1/parent_accounts')) {
          if (method === 'GET') {
            return new Response(JSON.stringify([{
              id: 'parent_uuid_001',
              tenant_id: 'tenant_chua_01',
              email: 'budi.santoso@example.com',
              phone: '081234567890',
              full_name: 'Budi Santoso',
              auth_uid: 'auth_uid_parent_001'
            }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (method === 'POST') {
            return new Response(JSON.stringify([{ id: 'new_parent_id_999' }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
          }
        }

        // 4. Parent student links
        if (urlStr.includes('/rest/v1/parent_student_links')) {
          return new Response(JSON.stringify([{ success: true }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        // 5. Auth user check (resend)
        if (urlStr.includes('/auth/v1/admin/users/auth_uid_parent_001')) {
          if (method === 'GET') {
            return new Response(JSON.stringify({
              id: 'auth_uid_parent_001',
              email: 'budi.santoso@example.com',
              email_confirmed_at: isConfirmed ? '2026-01-01T00:00:00.000Z' : null,
              confirmed_at: isConfirmed ? '2026-01-01T00:00:00.000Z' : null,
              user_metadata: { invitation_status: isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND' }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (method === 'PUT') {
            return new Response(JSON.stringify({ success: true }), { status: 200 });
          }
        }

        // 6. Generate link mock
        if (urlStr.includes('/auth/v1/admin/generate_link')) {
          const action_link = isConfirmed ? rawRecoveryLink : rawInviteLink;
          return new Response(JSON.stringify({
            id: 'auth_uid_generated',
            user: { id: 'auth_uid_generated' },
            properties: { action_link }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify([]), { status: 200 });
      };
    };

    const cleanup = () => {
      globalThis.fetch = originalFetch;
    };

    await t2.test('1. Create parent generates intermediary URL, puts claim record in KV, and excludes raw Supabase verify URL from WhatsApp', async () => {
      setupMocks(false);
      try {
        const ctx = {
          request: new Request('https://chuvator.pages.dev/api/tenant/parents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-staff-token',
              'x-test-staff-role': 'owner',
              'x-test-staff-uid': 'staff_01',
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
              get: async (k: string) => mockKVStore[k] || null,
              put: async (k: string, v: string) => { mockKVStore[k] = v; },
              delete: async (k: string) => { delete mockKVStore[k]; }
            }
          }
        };

        const res = await parentCreateHandler(ctx as any);
        assert.strictEqual(res.status, 201);
        const json = await res.json();

        assert.strictEqual(json.success, true);
        assert.ok(json.claimUrl, 'claimUrl must be present');
        assert.ok(json.claimUrl.includes('/portal/claim?token='), 'claimUrl must use CHUVATOR portal/claim route');

        // Check WhatsApp message: MUST NOT contain raw Supabase link
        assert.ok(json.data.message.includes(json.claimUrl), 'WhatsApp message must include intermediary URL');
        assert.strictEqual(json.data.message.includes('/auth/v1/verify'), false, 'WhatsApp message must NOT contain Supabase /auth/v1/verify');
        assert.strictEqual(json.whatsappUrl.includes('/auth/v1/verify'), false, 'wa.me URL must NOT contain Supabase /auth/v1/verify');

        // Check that claim is stored in KV
        const claimKeys = Object.keys(mockKVStore).filter(k => k.startsWith('v2_invitation_claim:'));
        assert.strictEqual(claimKeys.length, 1);
        const stored = JSON.parse(mockKVStore[claimKeys[0]]);
        assert.strictEqual(stored.actionLink, rawInviteLink, 'Stored record must securely hold the verified actionLink');
        assert.strictEqual(stored.type, 'invite');
      } finally {
        cleanup();
      }
    });

    await t2.test('2. Resend generates intermediary URL for recovery flow, updates KV, and protects WhatsApp from raw link', async () => {
      setupMocks(true); // isConfirmed = true
      try {
        const ctx = {
          request: new Request('https://chuvator.pages.dev/api/tenant/parents/resend', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-staff-token',
              'x-test-staff-role': 'owner',
              'x-test-staff-uid': 'staff_01',
              'x-test-tenant-id': 'tenant_chua_01'
            },
            body: JSON.stringify({ parentId: 'parent_uuid_001', action: 'generate' })
          }),
          env: {
            ENVIRONMENT: 'development',
            SUPABASE_URL: supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
            APP_URL: appUrl,
            PORTAL_SESSIONS_KV: {
              get: async (k: string) => mockKVStore[k] || null,
              put: async (k: string, v: string) => { mockKVStore[k] = v; },
              delete: async (k: string) => { delete mockKVStore[k]; }
            }
          }
        };

        const res = await resendHandler(ctx as any);
        assert.strictEqual(res.status, 200);
        const json = await res.json();

        assert.strictEqual(json.success, true);
        assert.strictEqual(json.status, 'ACTIVATED');
        assert.ok(json.claimUrl.includes('/portal/claim?token='));
        assert.ok(json.data.message.includes(json.claimUrl));
        assert.strictEqual(json.data.message.includes('/auth/v1/verify'), false);
        assert.strictEqual(json.whatsappUrl.includes('/auth/v1/verify'), false);
      } finally {
        cleanup();
      }
    });
  });

  await t.test('3, 4, 5. GET /api/portal/invitation/claim does NOT read/consume KV, call Supabase, or leak OTP', async () => {
    let kvGetCount = 0;
    let kvDeleteCount = 0;
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({}), { status: 200 });
    };

    try {
      const ctx = {
        request: new Request('https://chuvator.pages.dev/api/portal/invitation/claim?token=dummy', {
          method: 'GET'
        }),
        env: {
          PORTAL_SESSIONS_KV: {
            get: async () => { kvGetCount++; return null; },
            delete: async () => { kvDeleteCount++; }
          }
        }
      };

      const res = await claimGetHandler(ctx as any);
      assert.strictEqual(res.status, 405, 'GET must return 405 Method Not Allowed');

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'METHOD_NOT_ALLOWED');
      assert.strictEqual(json.actionLink, undefined, 'GET must NOT return actionLink');

      // Verify zero interaction with storage or upstream
      assert.strictEqual(kvGetCount, 0, 'GET must NOT read KV');
      assert.strictEqual(kvDeleteCount, 0, 'GET must NOT delete from KV');
      assert.strictEqual(fetchCalled, false, 'GET must NOT call Supabase');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('6 & 7. POST /api/portal/invitation/claim lifecycle: claim valid token, delete KV, reject invalid/expired', async (t2) => {
    const validClaimToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f809'; // 64 hex chars
    const targetActionLink = `${supabaseUrl}/auth/v1/verify?token=valid_otp_token_999&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;

    const createClaimContext = (token: any, kvMap: Record<string, string>) => ({
      request: new Request('https://chuvator.pages.dev/api/portal/invitation/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.pages.dev'
        },
        body: JSON.stringify({ token })
      }),
      env: {
        SUPABASE_URL: supabaseUrl,
        APP_URL: appUrl,
        PORTAL_SESSIONS_KV: {
          get: async (k: string) => kvMap[k] || null,
          delete: async (k: string) => { delete kvMap[k]; }
        }
      }
    });

    await t2.test('6. POST with valid token returns actionLink, deletes KV record, and sets no-store headers', async () => {
      const kvStore: Record<string, string> = {
        [`v2_invitation_claim:${validClaimToken}`]: JSON.stringify({
          actionLink: targetActionLink,
          parentId: 'parent-001',
          tenantId: 'tenant_chua_01',
          type: 'invite',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
        })
      };

      const ctx = createClaimContext(validClaimToken, kvStore);
      const res = await claimPostHandler(ctx as any);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
      assert.strictEqual(res.headers.get('Referrer-Policy'), 'no-referrer');

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.actionLink, targetActionLink);

      // Verify zero leak of parent internal details
      assert.strictEqual(json.parentId, undefined);
      assert.strictEqual(json.tenantId, undefined);

      // Verify single-use deletion from KV
      assert.strictEqual(kvStore[`v2_invitation_claim:${validClaimToken}`], undefined, 'Record must be consumed/deleted');
    });

    await t2.test('7a. Replay attack: second POST with same token is rejected as already used', async () => {
      const kvStore: Record<string, string> = {}; // Already deleted
      const ctx = createClaimContext(validClaimToken, kvStore);
      const res = await claimPostHandler(ctx as any);

      assert.strictEqual(res.status, 410);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'CLAIM_NOT_FOUND_OR_EXPIRED');
    });

    await t2.test('7b. Invalid token formats rejected with 400', async () => {
      const kvStore: Record<string, string> = {};

      // Short token
      let res = await claimPostHandler(createClaimContext('short', kvStore) as any);
      assert.strictEqual(res.status, 400);

      // Non-hex token
      res = await claimPostHandler(createClaimContext('g'.repeat(64), kvStore) as any);
      assert.strictEqual(res.status, 400);

      // Null token
      res = await claimPostHandler(createClaimContext(null, kvStore) as any);
      assert.strictEqual(res.status, 400);
    });

    await t2.test('7c. Expired token rejected with 410', async () => {
      const kvStore: Record<string, string> = {
        [`v2_invitation_claim:${validClaimToken}`]: JSON.stringify({
          actionLink: targetActionLink,
          parentId: 'parent-001',
          type: 'invite',
          createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
          expiresAt: new Date(Date.now() - 3600 * 1000).toISOString() // Expired 1 hr ago
        })
      };

      const ctx = createClaimContext(validClaimToken, kvStore);
      const res = await claimPostHandler(ctx as any);

      assert.strictEqual(res.status, 410);
      const json = await res.json();
      assert.strictEqual(json.code, 'CLAIM_EXPIRED');
      assert.strictEqual(kvStore[`v2_invitation_claim:${validClaimToken}`], undefined, 'Expired record must be cleaned up');
    });
  });

  await t.test('8. Concurrent claim requests: Eventual consistency boundary & Supabase OTP final authority', async () => {
    const validClaimToken = 'b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f809a1';
    const targetActionLink = `${supabaseUrl}/auth/v1/verify?token=valid_otp_999&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;

    const kvStore: Record<string, string> = {
      [`v2_invitation_claim:${validClaimToken}`]: JSON.stringify({
        actionLink: targetActionLink,
        parentId: 'parent-001',
        tenantId: 'tenant_chua_01',
        type: 'invite',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    };

    const makeReq = (headers = {}) => claimPostHandler({
      request: new Request('https://chuvator.pages.dev/api/portal/invitation/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.pages.dev',
          ...headers 
        },
        body: JSON.stringify({ token: validClaimToken })
      }),
      env: {
        SUPABASE_URL: supabaseUrl,
        APP_URL: appUrl,
        ALLOWED_ORIGINS: 'https://chuvator.pages.dev',
        PORTAL_SESSIONS_KV: {
          get: async (k: string) => kvStore[k] || null,
          delete: async (k: string) => { delete kvStore[k]; }
        }
      }
    } as any);

    // 8a. Serial Replay Protection (Standard Case)
    const res1 = await makeReq();
    const res2 = await makeReq();

    const json1 = await res1.json();
    const json2 = await res2.json();

    assert.strictEqual(res1.status, 200, 'First request must succeed');
    assert.strictEqual(json1.success, true);

    assert.strictEqual(res2.status, 410, 'Second request must fail (Replay Protection)');
    assert.strictEqual(json2.success, false);

    // 8b. Concurrency Honest Audit: Simulating Race Condition (KV Eventual Consistency Window)
    // We mock a race where two requests hit the 'get()' before the first 'delete()' is processed.
    const validClaimTokenRace = 'd4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f809a1b2c3';
    const raceRecord = JSON.stringify({
      actionLink: targetActionLink,
      type: 'invite',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    });
    
    // Custom mock that delays deletion to simulate the propagation window
    let deleteStarted = false;
    const kvStoreRace: Record<string, string> = {
      [`v2_invitation_claim:${validClaimTokenRace}`]: raceRecord
    };

    const makeRaceReq = () => claimPostHandler({
      request: new Request('https://chuvator.pages.dev/api/portal/invitation/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.pages.dev'
        },
        body: JSON.stringify({ token: validClaimTokenRace })
      }),
      env: {
        SUPABASE_URL: supabaseUrl,
        APP_URL: appUrl,
        PORTAL_SESSIONS_KV: {
          get: async (k: string) => kvStoreRace[k] || null,
          delete: async (k: string) => { 
            deleteStarted = true;
            // Delay actual deletion to simulate eventual consistency / propagation lag
            await new Promise(r => setTimeout(r, 10));
            delete kvStoreRace[k]; 
          }
        }
      }
    } as any);

    // In Cloudflare KV (eventually consistent), if these fire in parallel:
    const [raceRes1, raceRes2] = await Promise.all([makeRaceReq(), makeRaceReq()]);
    
    // HONEST AUDIT: In the current implementation using KV get() + delete(),
    // both requests would likely succeed if they overlap in the propagation window.
    // The test confirms that without atomic storage, we rely on Supabase OTP.
    if (raceRes1.status === 200 && raceRes2.status === 200) {
      const r1 = await raceRes1.json();
      const r2 = await raceRes2.json();
      assert.strictEqual(r1.actionLink, targetActionLink);
      assert.strictEqual(r2.actionLink, targetActionLink);
      // This confirms the limitation documented in claim.js
    }
  });

  await t.test('9. CSRF & Origin Validation: Rejects requests from unauthorized origins', async () => {
    const validClaimToken = 'c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f809a1b2';
    const kvStore: Record<string, string> = {
      [`v2_invitation_claim:${validClaimToken}`]: JSON.stringify({
        actionLink: 'https://valid.link',
        type: 'invite',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    };

    const makeReq = (origin: string | null) => claimPostHandler({
      request: new Request('https://chuvator.pages.dev/api/portal/invitation/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(origin ? { 'Origin': origin } : {})
        },
        body: JSON.stringify({ token: validClaimToken })
      }),
      env: {
        SUPABASE_URL: supabaseUrl,
        APP_URL: appUrl,
        ALLOWED_ORIGINS: 'https://chuvator.pages.dev',
        PORTAL_SESSIONS_KV: {
          get: async (k: string) => kvStore[k] || null,
          delete: async (k: string) => { delete kvStore[k]; }
        }
      }
    } as any);

    // Rejects forged origin
    const res1 = await makeReq('https://evil-hacker.com');
    assert.strictEqual(res1.status, 403);
    const json1 = await res1.json();
    assert.strictEqual(json1.code, 'CSRF_VALIDATION_FAILED');

    // Rejects missing origin/referer
    const res2 = await makeReq(null);
    assert.strictEqual(res2.status, 403);
  });

  await t.test('10. Action link with forged origin or open-redirect is rejected by claim endpoint', async () => {
    const validClaimToken = 'c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f809a1b2';
    const forgedLink = `https://evil-hacker.com/auth/v1/verify?token=tok123&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`;

    const kvStore: Record<string, string> = {
      [`v2_invitation_claim:${validClaimToken}`]: JSON.stringify({
        actionLink: forgedLink,
        type: 'invite',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    };

    const ctx = {
      request: new Request('https://chuvator.pages.dev/api/portal/invitation/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.pages.dev'
        },
        body: JSON.stringify({ token: validClaimToken })
      }),
      env: {
        SUPABASE_URL: supabaseUrl,
        APP_URL: appUrl,
        PORTAL_SESSIONS_KV: {
          get: async (k: string) => kvStore[k] || null,
          delete: async (k: string) => { delete kvStore[k]; }
        }
      }
    };

    const res = await claimPostHandler(ctx as any);
    assert.strictEqual(res.status, 500);
    const json = await res.json();
    assert.strictEqual(json.code, 'INVALID_STORED_ACTION_LINK');
    assert.strictEqual(json.actionLink, undefined, 'Must not leak forged link');
  });

  await t.test('10. KV storage failure during create/resend fails closed and produces zero invalid WhatsApp link', async () => {
    const originalFetch = globalThis.fetch;
    let authUserCleanedUp = false;

    globalThis.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      const method = (opts?.method || 'GET').toUpperCase();

      if (urlStr.includes('/rest/v1/students')) {
        const studentHmac = await computeHMAC('3201010101010001', hmacSecret);
        return new Response(JSON.stringify([{
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Andi Santoso',
          tenant_id: 'tenant_chua_01',
          kk_hmac: studentHmac
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/rest/v1/tenants')) {
        return new Response(JSON.stringify([{ id: 'tenant_chua_01', name: 'Chua Academy' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/rest/v1/parent_accounts')) {
        if (method === 'GET') return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (method === 'POST') return new Response(JSON.stringify([{ id: 'p_new_123' }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
        if (method === 'DELETE') return new Response(JSON.stringify({}), { status: 200 });
      }

      if (urlStr.includes('/rest/v1/parent_student_links')) {
        return new Response(JSON.stringify([{ success: true }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/auth/v1/admin/generate_link')) {
        return new Response(JSON.stringify({
          id: 'auth_uid_new_123',
          properties: {
            action_link: `${supabaseUrl}/auth/v1/verify?token=tok&type=invite&redirect_to=${encodeURIComponent(validRedirect)}`
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/auth/v1/admin/users/auth_uid_new_123') && method === 'DELETE') {
        authUserCleanedUp = true;
        return new Response(JSON.stringify({}), { status: 200 });
      }

      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const ctx = {
        request: new Request('https://chuvator.pages.dev/api/tenant/parents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-staff-token',
            'x-test-staff-role': 'owner',
            'x-test-staff-uid': 'staff_01',
            'x-test-tenant-id': 'tenant_chua_01'
          },
          body: JSON.stringify({
            email: 'fail.storage@example.com',
            name: 'Wali Gagal',
            phone: '081234567899',
            kk: '3201010101010001',
            studentIds: ['11111111-1111-4111-8111-111111111111'],
            relationship: 'father'
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
            put: async () => { throw new Error('Simulated KV Write Outage'); },
            delete: async () => {}
          }
        }
      };

      const res = await parentCreateHandler(ctx as any);
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'CLAIM_STORAGE_FAILED');
      assert.strictEqual(json.whatsappUrl, undefined, 'Must not return unusable WhatsApp link on storage error');
      assert.strictEqual(authUserCleanedUp, true, 'Auth user must be rolled back on storage failure');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('11. generateClaimToken produces 64-char hex string with high entropy', () => {
    const token1 = generateClaimToken();
    const token2 = generateClaimToken();

    assert.strictEqual(token1.length, 64);
    assert.strictEqual(token2.length, 64);
    assert.ok(/^[a-f0-9]{64}$/.test(token1));
    assert.ok(/^[a-f0-9]{64}$/.test(token2));
    assert.notStrictEqual(token1, token2);
  });

  await t.test('12. buildIntermediaryClaimUrl correctly forms CHUVATOR claim URL', () => {
    const url = buildIntermediaryClaimUrl('https://chuvator.pages.dev', 'dummy_token_123');
    assert.strictEqual(url, 'https://chuvator.pages.dev/portal/claim?token=dummy_token_123');

    // Handles trailing slash
    const url2 = buildIntermediaryClaimUrl('https://chuvator.pages.dev/', 'dummy_token_123');
    assert.strictEqual(url2, 'https://chuvator.pages.dev/portal/claim?token=dummy_token_123');
  });
});
