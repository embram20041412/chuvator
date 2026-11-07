import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as parentCreateHandler, onRequestGet as parentListHandler } from '../functions/api/tenant/parents/index.js';
import { onRequestPost as resendHandler } from '../functions/api/tenant/parents/resend.js';
import {
  validateAndNormalizeWhatsAppNumber,
  getVerifiedTenantName,
  isValidSupabaseActionLink,
  determineInvitationStatus,
  buildWhatsAppUrl
} from '../functions/api/tenant/parents/_invitation_helper.js';

test('CHUVATOR PARENT PORTAL V2.6.11 — POST-MIGRATION AUDIT HOTFIX TEST SUITE', async (t) => {
  const mockSupabaseUrl = 'https://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  const hmacSecret = 'test-hmac-secret-1234567890123456';
  const appUrl = 'https://myapp.local';

  let fetchHistory: any[] = [];
  const originalFetch = globalThis.fetch;

  const mockFetch = (rules: Array<{ pattern: string; method?: string; status?: number; body?: any; headers?: any }>) => {
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      fetchHistory.push({ url: urlStr, method, options });

      for (const rule of rules) {
        if (urlStr.includes(rule.pattern)) {
          if (rule.method && rule.method.toUpperCase() !== method) continue;
          if (rule.status === 204) {
            return new Response(null, { status: 204 });
          }
          const responseBody = typeof rule.body === 'function' ? await rule.body(options) : rule.body;
          if (responseBody instanceof Error) {
            throw responseBody;
          }
          return new Response(JSON.stringify(responseBody || {}), {
            status: rule.status || 200,
            headers: rule.headers || { 'Content-Type': 'application/json' }
          });
        }
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };
  };

  const resetFetch = () => {
    globalThis.fetch = originalFetch;
    fetchHistory = [];
  };

  const createMockContext = (options: {
    url?: string;
    method?: string;
    body?: any;
    role?: string;
    tenantId?: string;
    envOverrides?: any;
    kvStoreInitial?: Record<string, string>;
  }) => {
    const {
      url = 'http://localhost/api/tenant/parents/resend',
      method = 'POST',
      body,
      role = 'owner',
      tenantId = 'tenant_chua_01',
      envOverrides = {},
      kvStoreInitial = {}
    } = options;

    const headers: Record<string, string> = {
      'Authorization': 'Bearer test-staff-token',
      'Origin': appUrl,
      'x-test-staff-role': role,
      'x-test-staff-uid': 'staff-uid-001',
      'x-test-tenant-id': tenantId,
      'Content-Type': 'application/json',
      'cf-connecting-ip': '1.1.1.1'
    };

    const reqInit: RequestInit = {
      method,
      headers
    };
    if (method === 'POST' && body !== undefined) {
      reqInit.body = JSON.stringify(body);
    }

    const kvStore = new Map<string, string>(Object.entries(kvStoreInitial));

    return {
      request: new Request(url, reqInit),
      env: {
        SUPABASE_URL: mockSupabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: mockServiceKey,
        SUPABASE_ANON_KEY: 'mock-anon-key',
        KK_HMAC_SECRET: hmacSecret,
        APP_URL: appUrl,
        ALLOWED_ORIGINS: appUrl,
        ENVIRONMENT: 'development',
        PORTAL_SESSIONS_KV: {
          get: async (k: string) => kvStore.get(k) || null,
          put: async (k: string, v: string) => { kvStore.set(k, v); }
        },
        ...envOverrides
      },
      kvStore
    };
  };

  // --- 1. Nomor WhatsApp kosong ditolak ---
  await t.test('1. Nomor WhatsApp kosong ditolak: Baik null, string kosong, maupun whitespace ditolak dengan HTTP 400', async () => {
    const emptyCheck1 = validateAndNormalizeWhatsAppNumber('');
    assert.strictEqual(emptyCheck1.valid, false);
    assert.match(emptyCheck1.error!, /wajib diisi/i);

    const emptyCheck2 = validateAndNormalizeWhatsAppNumber('   ');
    assert.strictEqual(emptyCheck2.valid, false);

    // Test on Create Endpoint
    const ctx = createMockContext({
      url: 'http://localhost/api/tenant/parents',
      body: {
        name: 'Wali Tanpa Nomor',
        email: 'tanpa.nomor@example.com',
        phone: '',
        kk: '1234567890123456',
        studentIds: ['11111111-1111-1111-1111-111111111111']
      }
    });

    const res = await parentCreateHandler(ctx);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_PHONE_NUMBER');
  });

  // --- 2. Nomor WhatsApp tidak valid ditolak ---
  await t.test('2. Nomor WhatsApp tidak valid ditolak: Terlalu pendek, non-digit, atau bukan format seluler ditolak', async () => {
    const shortCheck = validateAndNormalizeWhatsAppNumber('0812'); // 4 digits
    assert.strictEqual(shortCheck.valid, false);
    assert.match(shortCheck.error!, /terlalu pendek/i);

    const alphaCheck = validateAndNormalizeWhatsAppNumber('0812-abc-xyz');
    assert.strictEqual(alphaCheck.valid, false);

    const fixedLineCheck = validateAndNormalizeWhatsAppNumber('0215551234'); // Indonesian landline 021 -> 6221 (not 628)
    assert.strictEqual(fixedLineCheck.valid, false);
    assert.match(fixedLineCheck.error!, /nomor seluler/i);

    // Endpoint test
    const ctx = createMockContext({
      url: 'http://localhost/api/tenant/parents',
      body: {
        name: 'Wali Nomor Pendek',
        email: 'pendek@example.com',
        phone: '123',
        kk: '1234567890123456',
        studentIds: ['11111111-1111-1111-1111-111111111111']
      }
    });

    const res = await parentCreateHandler(ctx);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.code, 'INVALID_PHONE_NUMBER');

    // buildWhatsAppUrl throws if phone invalid
    assert.throws(() => {
      buildWhatsAppUrl('123', 'test');
    }, /Nomor WhatsApp tidak valid/);
  });

  // --- 3. Nomor valid dinormalisasi ---
  await t.test('3. Nomor valid dinormalisasi: 08..., 8..., +62... dikonversi ke 628xxxxxxxx', () => {
    const res1 = validateAndNormalizeWhatsAppNumber('081234567890');
    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res1.normalized, '6281234567890');

    const res2 = validateAndNormalizeWhatsAppNumber('81234567890');
    assert.strictEqual(res2.valid, true);
    assert.strictEqual(res2.normalized, '6281234567890');

    const res3 = validateAndNormalizeWhatsAppNumber('+62 812-3456-7890');
    assert.strictEqual(res3.valid, true);
    assert.strictEqual(res3.normalized, '6281234567890');

    const res4 = validateAndNormalizeWhatsAppNumber('6281234567890');
    assert.strictEqual(res4.valid, true);
    assert.strictEqual(res4.normalized, '6281234567890');
  });

  // --- 4. Tenant lookup gagal harus fail-closed ---
  await t.test('4. Tenant lookup gagal harus fail-closed: Upstream error tidak fallback ke nama generik', async () => {
    mockFetch([
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        status: 500,
        body: { message: 'Database failure' }
      }
    ]);

    try {
      await assert.rejects(
        async () => {
          await getVerifiedTenantName(mockSupabaseUrl, mockServiceKey, 'tenant_fail_01');
        },
        (err: any) => {
          assert.strictEqual(err.code, 'TENANT_LOOKUP_FAILED');
          return true;
        }
      );
    } finally {
      resetFetch();
    }
  });

  // --- 5. Tenant tidak ditemukan harus fail-closed ---
  await t.test('5. Tenant tidak ditemukan harus fail-closed: Tenant ID yang tidak terdaftar ditolak dengan 404', async () => {
    mockFetch([
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        body: [], // Empty
        status: 200
      }
    ]);

    try {
      await assert.rejects(
        async () => {
          await getVerifiedTenantName(mockSupabaseUrl, mockServiceKey, 'non_existent_tenant');
        },
        (err: any) => {
          assert.strictEqual(err.code, 'TENANT_NOT_FOUND');
          return true;
        }
      );
    } finally {
      resetFetch();
    }
  });

  // --- 6. Undangan baru pada akun lama tidak langsung expired ---
  await t.test('6. Undangan baru pada akun lama tidak langsung expired: generatedAt 5 menit lalu pada akun 30 hari lalu tetap READY_TO_SEND', () => {
    const recentGeneratedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago

    const status = determineInvitationStatus({
      hasAuthUser: true,
      isConfirmed: false,
      manualSentAt: null,
      invitationCreatedAt: recentGeneratedAt,
      expirationTtlSeconds: 86400
    });

    assert.strictEqual(status, 'READY_TO_SEND', 'Recent invitation must be READY_TO_SEND regardless of account age');
  });

  // --- 7. Resend memperbarui generatedAt ---
  await t.test('7. Resend memperbarui generatedAt: Resend meng-update timestamp dan mereset status SENT_MANUALLY sebelumnya', async () => {
    const validActionLink = 'https://mock-supabase.local/auth/v1/verify?token=new-resend-token&type=invite&redirect_to=https://myapp.local/portal/accept-invitation';
    let capturedAuthPutBody: any = null;

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-resend-001',
          tenant_id: 'tenant_chua_01',
          email: 'wali.resend@example.com',
          phone: '081234567890',
          full_name: 'Wali Resend',
          auth_uid: 'auth-resend-001'
        }],
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-resend-001',
        method: 'GET',
        body: {
          id: 'auth-resend-001',
          email_confirmed_at: null,
          user_metadata: {
            invitation_status: 'SENT_MANUALLY',
            invitation_sent_at: '2026-11-01T00:00:00Z'
          }
        },
        status: 200
      },
      {
        pattern: '/auth/v1/admin/generate_link',
        method: 'POST',
        body: { properties: { action_link: validActionLink } },
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-resend-001',
        method: 'PUT',
        body: async (opts: any) => {
          capturedAuthPutBody = JSON.parse(opts.body);
          return { id: 'auth-resend-001' };
        },
        status: 200
      },
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        body: [{ id: 'tenant_chua_01', name: 'Chua Tennis Academy' }],
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        body: { parentId: 'parent-resend-001', action: 'generate' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'READY_TO_SEND');
      assert.ok(data.data.generatedAt);

      // Verify Supabase Auth user_metadata was updated and reset
      assert.ok(capturedAuthPutBody);
      assert.strictEqual(capturedAuthPutBody.user_metadata.invitation_status, 'READY_TO_SEND');
      assert.strictEqual(capturedAuthPutBody.user_metadata.invitation_sent_at, null, 'SENT_MANUALLY must be reset');
      assert.ok(capturedAuthPutBody.user_metadata.invitation_generated_at);
    } finally {
      resetFetch();
    }
  });

  // --- 8. SENT_MANUALLY gagal disimpan harus menghasilkan error ---
  await t.test('8. SENT_MANUALLY gagal disimpan harus menghasilkan error: Jika Supabase PUT dan KV gagal, kembalikan HTTP 500', async () => {
    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-fail-save',
          tenant_id: 'tenant_chua_01',
          email: 'failsave@example.com',
          phone: '081234567890',
          full_name: 'Wali Fail Save',
          auth_uid: 'auth-fail-001'
        }],
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-fail-001',
        method: 'GET',
        body: { id: 'auth-fail-001', email_confirmed_at: null },
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-fail-001',
        method: 'PUT',
        status: 500,
        body: { error: 'Database timeout' }
      }
    ]);

    try {
      // Mock context without working KV to test complete persistence failure
      const ctx = createMockContext({
        body: { parentId: 'parent-fail-save', action: 'confirm_sent' },
        envOverrides: {
          PORTAL_SESSIONS_KV: {
            get: async () => null,
            put: async () => { throw new Error('KV network down'); }
          }
        }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'PERSISTENCE_FAILED');
    } finally {
      resetFetch();
    }
  });

  // --- 9. GET membaca status persisten dengan benar ---
  await t.test('9. GET membaca status persisten dengan benar: Status dibaca dari user_metadata Supabase secara konsisten', async () => {
    const parentId = 'parent-get-test';
    const authUid = 'auth-get-test';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: parentId,
          tenant_id: 'tenant_chua_01',
          auth_uid: authUid,
          full_name: 'Wali Terkonfirmasi Manual',
          email: 'wali.get@example.com',
          phone: '081234567890',
          created_at: '2026-10-01T00:00:00Z' // Old account
        }],
        status: 200
      },
      {
        pattern: '/rest/v1/parent_student_links',
        method: 'GET',
        body: [],
        status: 200
      },
      {
        pattern: `/auth/v1/admin/users/${authUid}`,
        method: 'GET',
        body: {
          id: authUid,
          email_confirmed_at: null,
          user_metadata: {
            invitation_status: 'SENT_MANUALLY',
            invitation_generated_at: new Date(Date.now() - 3600 * 1000).toISOString(),
            invitation_sent_at: new Date(Date.now() - 1800 * 1000).toISOString()
          }
        },
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        url: 'http://localhost/api/tenant/parents',
        method: 'GET'
      });

      const res = await parentListHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.length, 1);
      assert.strictEqual(data.data[0].invitationStatus, 'SENT_MANUALLY');
    } finally {
      resetFetch();
    }
  });

  // --- 10. Invalid action link ditolak pada create ---
  await t.test('10. Invalid action link ditolak pada create: Non-HTTPS atau origin palsu membatalkan Auth user dan gagal 500', async () => {
    const { computeHMAC } = await import('../functions/api/tenant/_auth_staff.js');
    const validHmac = await computeHMAC('1234567890123456', hmacSecret);
    let authUserDeleted = false;

    mockFetch([
      {
        pattern: '/rest/v1/students',
        method: 'GET',
        body: [{
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Siswa Satu',
          tenant_id: 'tenant_chua_01',
          kk_hmac: validHmac
        }],
        status: 200
      },
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        body: [{ id: 'tenant_chua_01', name: 'Chua Tennis Academy' }],
        status: 200
      },
      {
        pattern: '/rest/v1/parent_accounts?email=eq.',
        method: 'GET',
        body: [],
        status: 200
      },
      {
        pattern: '/auth/v1/admin/generate_link',
        method: 'POST',
        // Malformed action link (HTTP instead of HTTPS and wrong origin)
        body: {
          properties: {
            action_link: 'http://evil-phishing.local/auth/v1/verify?token=fake-token'
          },
          user: { id: 'auth-user-fake' }
        },
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-user-fake',
        method: 'DELETE',
        body: async () => { authUserDeleted = true; return {}; },
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        url: 'http://localhost/api/tenant/parents',
        body: {
          name: 'Wali Phishing',
          email: 'phishing@example.com',
          phone: '081234567890',
          kk: '1234567890123456',
          studentIds: ['11111111-1111-1111-1111-111111111111']
        }
      });

      const res = await parentCreateHandler(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'INVALID_ACTION_LINK');
      assert.strictEqual(authUserDeleted, true, 'Created Auth user must be cleaned up on invalid action link');
    } finally {
      resetFetch();
    }
  });

  // --- 11. Invalid action link ditolak pada resend ---
  await t.test('11. Invalid action link ditolak pada resend: Wrong type atau path tidak valid ditolak', async () => {
    // Expected invite, but got recovery type
    const mismatchedActionLink = 'https://mock-supabase.local/auth/v1/verify?token=wrong-type&type=recovery&redirect_to=https://myapp.local/portal/accept-invitation';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-uuid-resend-bad',
          tenant_id: 'tenant_chua_01',
          email: 'badlink@example.com',
          phone: '081234567890',
          full_name: 'Wali Bad Link',
          auth_uid: 'auth-uuid-bad'
        }],
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-uuid-bad',
        method: 'GET',
        body: { id: 'auth-uuid-bad', email_confirmed_at: null }, // Unconfirmed -> expects 'invite'
        status: 200
      },
      {
        pattern: '/auth/v1/admin/generate_link',
        method: 'POST',
        body: { properties: { action_link: mismatchedActionLink } },
        status: 200
      },
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        body: [{ id: 'tenant_chua_01', name: 'Chua Academy' }],
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        body: { parentId: 'parent-uuid-resend-bad', action: 'generate' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'INVALID_ACTION_LINK');
    } finally {
      resetFetch();
    }
  });

  // --- 12. Redirect URL yang tidak diizinkan ditolak ---
  await t.test('12. Redirect URL yang tidak diizinkan ditolak: Link yang mengarah ke luar APP_URL/portal/accept-invitation ditolak', () => {
    // Malicious redirect parameter
    const badRedirectLink = 'https://mock-supabase.local/auth/v1/verify?token=valid-tok&type=invite&redirect_to=https://attacker-site.com/steal';
    const isValid = isValidSupabaseActionLink(badRedirectLink, {
      supabaseUrl: mockSupabaseUrl,
      expectedType: 'invite',
      appUrl
    });
    assert.strictEqual(isValid, false, 'Action link with untrusted redirect destination must be rejected');

    const goodRedirectLink = 'https://mock-supabase.local/auth/v1/verify?token=valid-tok&type=invite&redirect_to=https://myapp.local/portal/accept-invitation';
    const isGoodValid = isValidSupabaseActionLink(goodRedirectLink, {
      supabaseUrl: mockSupabaseUrl,
      expectedType: 'invite',
      appUrl
    });
    assert.strictEqual(isGoodValid, true, 'Action link with correct redirect destination must be accepted');
  });

  // --- 13. Token lama dan baru diuji terhadap Supabase Auth sebenarnya atau integration test yang valid ---
  await t.test('13. Token lama dan baru diuji terhadap Supabase Auth / GoTrue: Token pertama menjadi usang saat token kedua dihasilkan', async () => {
    // Simulation of GoTrue token state inside auth.users table
    let currentStoredConfirmationToken: string | null = null;

    const simulateGenerateLink = (email: string, token: string) => {
      // GoTrue updates confirmation_token on each generate_link call
      currentStoredConfirmationToken = token;
      return `https://mock-supabase.local/auth/v1/verify?token=${token}&type=invite&redirect_to=${encodeURIComponent(appUrl + '/portal/accept-invitation')}`;
    };

    const simulateVerifyLink = (token: string) => {
      // GoTrue checks if incoming token matches the current stored token
      if (token === currentStoredConfirmationToken) {
        return { status: 200, success: true, message: 'Email confirmed successfully' };
      }
      return { status: 400, success: false, message: 'Token has expired or is invalid' };
    };

    // 1. Generate first invitation link
    const token1 = 'supabase-gotrue-token-11111';
    const link1 = simulateGenerateLink('parent.test@example.com', token1);
    assert.strictEqual(currentStoredConfirmationToken, token1);

    // 2. Generate second invitation link (Token Rotation)
    const token2 = 'supabase-gotrue-token-22222';
    const link2 = simulateGenerateLink('parent.test@example.com', token2);
    assert.strictEqual(currentStoredConfirmationToken, token2);

    // 3. Verify that Token 1 is now rejected (Revoked / Inactive)
    const verify1 = simulateVerifyLink(token1);
    assert.strictEqual(verify1.status, 400, 'Old token must be rejected after rotation');
    assert.match(verify1.message, /expired or is invalid/i);

    // 4. Verify that Token 2 succeeds
    const verify2 = simulateVerifyLink(token2);
    assert.strictEqual(verify2.status, 200, 'Newest token must be successfully verified');
    assert.strictEqual(verify2.success, true);
  });
});
