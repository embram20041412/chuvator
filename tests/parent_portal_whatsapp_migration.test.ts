import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWhatsAppNumber,
  generateWhatsAppMessage,
  buildWhatsAppUrl,
  isValidSupabaseActionLink,
  determineInvitationStatus
} from '../functions/api/tenant/parents/_invitation_helper.js';
import { onRequestPost as resendHandler } from '../functions/api/tenant/parents/resend.js';
import { onRequestPost as parentCreateHandler, onRequestGet as parentListHandler } from '../functions/api/tenant/parents/index.js';
import { onRequestDelete as parentDeleteHandler } from '../functions/api/tenant/parents/delete.js';

test('CHUVATOR PARENT PORTAL — WHATSAPP-ONLY INVITATION MIGRATION TEST SUITE', async (t) => {
  const mockSupabaseUrl = 'https://mock-supabase.local';
  const mockServiceKey = 'service-role-key-test';
  const appUrl = 'https://myapp.local';
  const hmacSecret = 'test-hmac-secret-32-bytes-secure!';

  let fetchHistory: Array<{ url: string; options: any }> = [];
  const originalFetch = globalThis.fetch;

  const mockFetch = (rules: Array<{ pattern: string; method?: string; status?: number; body?: any; headers?: any }>) => {
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      const method = (options?.method || 'GET').toUpperCase();
      fetchHistory.push({ url: urlStr, options });

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

  let consoleErrors: string[] = [];
  const originalConsoleError = console.error;
  const interceptConsoleError = () => {
    consoleErrors = [];
    console.error = (...args: any[]) => {
      consoleErrors.push(args.map(arg => String(arg)).join(' '));
    };
  };
  const restoreConsoleError = () => {
    console.error = originalConsoleError;
  };

  const createMockContext = (options: {
    url?: string;
    method?: string;
    body?: any;
    role?: string;
    tenantId?: string;
    envOverrides?: any;
  }) => {
    const {
      url = 'http://localhost/api/tenant/parents/resend',
      method = 'POST',
      body,
      role = 'owner',
      tenantId = 'tenant_chua_01',
      envOverrides = {}
    } = options;

    const headers: Record<string, string> = {
      'Authorization': 'Bearer test-staff-token',
      'Origin': appUrl,
      'Content-Type': 'application/json',
      'x-test-staff-role': role,
      'x-test-staff-uid': 'staff-admin-uuid-01',
      'x-test-tenant-id': tenantId,
      'cf-connecting-ip': '1.1.1.1'
    };

    const reqInit: RequestInit = {
      method,
      headers
    };
    if (method === 'POST' && body !== undefined) {
      reqInit.body = JSON.stringify(body);
    }

    const kvStore = new Map<string, string>();

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

  // --- 1. Invitation generation tanpa pengiriman email ---
  await t.test('1. Invitation generation tanpa pengiriman email: Action link dihasilkan dari Supabase generate_link dan TIDAK memanggil Resend atau email provider', async () => {
    const mockActionLink = 'https://mock-supabase.local/auth/v1/verify?token=invite-token-abc&type=invite&redirect_to=https://myapp.local/portal/accept-invitation';

    mockFetch([
      // Supabase parent query
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-uuid-001',
          tenant_id: 'tenant_chua_01',
          email: 'budi.santoso@example.com',
          phone: '081234567890',
          full_name: 'Budi Santoso',
          auth_uid: 'auth-user-uuid-001'
        }],
        status: 200
      },
      // Supabase auth user check (unconfirmed)
      {
        pattern: '/auth/v1/admin/users/auth-user-uuid-001',
        method: 'GET',
        body: { id: 'auth-user-uuid-001', email_confirmed_at: null, confirmed_at: null },
        status: 200
      },
      // Supabase admin generate_link
      {
        pattern: '/auth/v1/admin/generate_link',
        method: 'POST',
        body: {
          properties: {
            action_link: mockActionLink
          }
        },
        status: 200
      },
      // Tenant name check
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        body: [{ id: 'tenant_chua_01', name: 'Chua Badminton Academy' }],
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        body: { parentId: 'parent-uuid-001' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'READY_TO_SEND');
      assert.strictEqual(data.data.actionLink, mockActionLink);
      assert.strictEqual(data.data.tenantName, 'Chua Badminton Academy');
      assert.strictEqual(data.data.phone, '6281234567890');

      // CRITICAL ASSERTION: Zero email provider or Resend API calls
      const resendCalls = fetchHistory.filter(f => f.url.includes('resend.com') || f.url.includes('/auth/v1/invite'));
      assert.strictEqual(resendCalls.length, 0, 'Must NOT invoke Resend API or Supabase /auth/v1/invite');

      // Verify generate_link was called
      const genLinkCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/generate_link'));
      assert.ok(genLinkCall, 'Must call Supabase /auth/v1/admin/generate_link');
      const genLinkBody = JSON.parse(genLinkCall.options.body);
      assert.strictEqual(genLinkBody.type, 'invite');
      assert.strictEqual(genLinkBody.email, 'budi.santoso@example.com');
    } finally {
      resetFetch();
    }
  });

  // --- 2. Tenant-specific message template ---
  await t.test('2. Tenant-specific message template: Format sesuai spesifikasi Section C dengan nama tenant dan platform CHUVATOR', () => {
    const parentName = 'Eko Prasetyo';
    const tenantName = 'Jaya Raya Satria';
    const actionLink = 'https://mock-supabase.local/auth/v1/verify?token=xyz123';

    const msg = generateWhatsAppMessage({ parentName, tenantName, actionLink });

    assert.ok(msg.includes("Assalamu'alaikum Bapak/Ibu Eko Prasetyo,"));
    assert.ok(msg.includes('Kami dari Jaya Raya Satria menginformasikan'));
    assert.ok(msg.includes('terdaftar di Jaya Raya Satria.'));
    assert.ok(msg.includes(actionLink));
    assert.ok(msg.includes('Admin Jaya Raya Satria.'));
    assert.ok(msg.includes('Jaya Raya Satria\nPlatform layanan: CHUVATOR'));

    // Verify absence of sensitive info
    assert.ok(!msg.includes('KK'), 'Message must not contain KK');
    assert.ok(!msg.includes('Kartu Keluarga'), 'Message must not contain Kartu Keluarga');
  });

  // --- 3. WhatsApp number normalization ---
  await t.test('3. WhatsApp number normalization: Menangani format Indonesia 08..., 8..., +62..., dan internasional', () => {
    assert.strictEqual(normalizeWhatsAppNumber('081234567890'), '6281234567890');
    assert.strictEqual(normalizeWhatsAppNumber('+62 812-3456-7890'), '6281234567890');
    assert.strictEqual(normalizeWhatsAppNumber('6281234567890'), '6281234567890');
    assert.strictEqual(normalizeWhatsAppNumber('81234567890'), '6281234567890');
    assert.strictEqual(normalizeWhatsAppNumber('+1 (555) 234-5678'), '15552345678');
    assert.strictEqual(normalizeWhatsAppNumber(''), '');
    assert.strictEqual(normalizeWhatsAppNumber(null as any), '');
  });

  // --- 4. URL encoding pesan & 5. WhatsApp opening URL ---
  await t.test('4 & 5. WhatsApp opening URL & URL encoding: URL wa.me dibangun dengan URI encoding yang aman', () => {
    const phone = '081234567890';
    const rawMessage = "Assalamu'alaikum Bapak/Ibu Budi,\nLink: https://example.com/test?a=1&b=2";
    const waUrl = buildWhatsAppUrl(phone, rawMessage);

    assert.ok(waUrl.startsWith('https://wa.me/6281234567890?text='));
    const encodedPart = waUrl.split('?text=')[1];
    assert.strictEqual(decodeURIComponent(encodedPart), rawMessage);
    assert.ok(!waUrl.includes('\n'), 'Raw newline must be encoded in URL');
    assert.ok(!waUrl.includes(' '), 'Raw space must be encoded in URL');
  });

  // --- 6. Manual sent confirmation ---
  await t.test('6. Manual sent confirmation: Status SENT_MANUALLY dicatat hanya saat admin mengonfirmasi manual', async () => {
    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-uuid-002',
          tenant_id: 'tenant_chua_01',
          email: 'wati@example.com',
          phone: '081987654321',
          full_name: 'Ibu Wati',
          auth_uid: 'auth-user-uuid-002'
        }],
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-user-uuid-002',
        method: 'GET',
        body: { id: 'auth-user-uuid-002', email_confirmed_at: null },
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-user-uuid-002',
        method: 'PUT',
        body: { id: 'auth-user-uuid-002' },
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        body: { parentId: 'parent-uuid-002', action: 'confirm_sent' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'SENT_MANUALLY');
      assert.match(data.message, /dikonfirmasi telah dikirim secara manual/i);

      // Verify KV was updated
      const kvVal = await ctx.env.PORTAL_SESSIONS_KV.get('v2_invitation_status:parent-uuid-002');
      assert.ok(kvVal);
      const parsedKv = JSON.parse(kvVal);
      assert.strictEqual(parsedKv.status, 'SENT_MANUALLY');
    } finally {
      resetFetch();
    }
  });

  // --- 7. Resend token rotation ---
  await t.test('7. Resend token rotation: Pembuatan ulang invitation mereset status ke READY_TO_SEND dan memanggil generate_link', async () => {
    const freshActionLink = 'https://mock-supabase.local/auth/v1/verify?token=rotated-token-999&type=invite';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-uuid-003',
          tenant_id: 'tenant_chua_01',
          email: 'rotasi@example.com',
          phone: '08111222333',
          full_name: 'Bapak Rotasi',
          auth_uid: 'auth-user-uuid-003'
        }],
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-user-uuid-003',
        method: 'GET',
        body: { id: 'auth-user-uuid-003', email_confirmed_at: null },
        status: 200
      },
      {
        pattern: '/auth/v1/admin/generate_link',
        method: 'POST',
        body: { properties: { action_link: freshActionLink } },
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
        body: { parentId: 'parent-uuid-003', action: 'generate' }
      });
      // Set initial status as SENT_MANUALLY in KV
      await ctx.env.PORTAL_SESSIONS_KV.put('v2_invitation_status:parent-uuid-003', JSON.stringify({ status: 'SENT_MANUALLY' }));

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'READY_TO_SEND', 'Generating fresh link resets status to READY_TO_SEND');
      assert.strictEqual(data.data.actionLink, freshActionLink);
    } finally {
      resetFetch();
    }
  });

  // --- 8. Expired invitation ---
  await t.test('8. Expired invitation: Status kedaluwarsa terdeteksi jika melebihi batas waktu 24 jam', () => {
    const expiredTime = new Date(Date.now() - 90000 * 1000).toISOString(); // 25 hours ago
    const status = determineInvitationStatus({
      hasAuthUser: true,
      isConfirmed: false,
      isExpired: false,
      invitationCreatedAt: expiredTime,
      expirationTtlSeconds: 86400
    });

    assert.strictEqual(status, 'EXPIRED');
  });

  // --- 9. Existing activated account ---
  await t.test('9. Existing activated account: Akun yang sudah aktif menghasilkan tipe recovery dan status ACTIVATED', async () => {
    const recoveryLink = 'https://mock-supabase.local/auth/v1/verify?token=recov-token-111&type=recovery';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-uuid-004',
          tenant_id: 'tenant_chua_01',
          email: 'aktif@example.com',
          phone: '08555666777',
          full_name: 'Ibu Aktif',
          auth_uid: 'auth-user-uuid-004'
        }],
        status: 200
      },
      {
        pattern: '/auth/v1/admin/users/auth-user-uuid-004',
        method: 'GET',
        body: { id: 'auth-user-uuid-004', email_confirmed_at: '2026-11-01T00:00:00Z' }, // Already confirmed
        status: 200
      },
      {
        pattern: '/auth/v1/admin/generate_link',
        method: 'POST',
        body: { properties: { action_link: recoveryLink } },
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
        body: { parentId: 'parent-uuid-004' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'ACTIVATED');
      assert.strictEqual(data.data.type, 'recovery');
      assert.strictEqual(data.data.isConfirmed, true);

      // Verify generate_link was called with type: recovery
      const genCall = fetchHistory.find(f => f.url.includes('/auth/v1/admin/generate_link'));
      assert.ok(genCall);
      const genBody = JSON.parse(genCall.options.body);
      assert.strictEqual(genBody.type, 'recovery');
    } finally {
      resetFetch();
    }
  });

  // --- 10. Duplicate account prevention ---
  await t.test('10. Duplicate account prevention: Email yang sudah terdaftar di tenant yang sama ditolak HTTP 409', async () => {
    const { computeHMAC } = await import('../functions/api/tenant/_auth_staff.js');
    const validHmac = await computeHMAC('1234567890123456', hmacSecret);

    mockFetch([
      // Student query
      {
        pattern: '/rest/v1/students',
        method: 'GET',
        body: [{
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Siswa Test',
          tenant_id: 'tenant_chua_01',
          kk_hmac: validHmac
        }],
        status: 200
      },
      // Check existing parent email in same tenant
      {
        pattern: '/rest/v1/parent_accounts?email=eq.',
        method: 'GET',
        body: [{ id: 'existing-parent-id' }],
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        url: 'http://localhost/api/tenant/parents',
        body: {
          name: 'Budi Duplicate',
          email: 'budi.duplicate@example.com',
          phone: '081234567890',
          kk: '1234567890123456',
          studentIds: ['11111111-1111-1111-1111-111111111111'],
          relationship: 'father'
        }
      });

      const res = await parentCreateHandler(ctx);
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /sudah terdaftar pada tenant ini/i);
    } finally {
      resetFetch();
    }
  });

  // --- 11. Tenant isolation ---
  await t.test('11. Tenant isolation: Admin tenant A dilarang mengakses akun wali murid milik tenant B (HTTP 404)', async () => {
    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [], // Filtered by tenant_id in REST query -> returns empty
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        tenantId: 'tenant_chua_01',
        body: { parentId: 'parent-of-other-tenant-999' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /di luar tenant Anda/i);
    } finally {
      resetFetch();
    }
  });

  // --- 12. RBAC dan CSRF ---
  await t.test('12. RBAC: Role selain owner/admin/superadmin ditolak dengan HTTP 403', async () => {
    mockFetch([]);
    try {
      const ctx = createMockContext({
        role: 'coach', // Coach cannot invite parents
        body: { parentId: 'parent-uuid-001' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /Hanya Owner\/Admin/i);
    } finally {
      resetFetch();
    }
  });

  // --- 13. Token/PII sanitization ---
  await t.test('13. Token/PII sanitization: Exception database atau Supabase Auth tidak membocorkan token, PII, atau raw stack', async () => {
    interceptConsoleError();
    const sensitiveToken = 'super-secret-action-token-xyz!';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: () => {
          throw new Error(`Database error containing token=${sensitiveToken} and email=rahasia@test.com`);
        },
        status: 500
      }
    ]);

    try {
      const ctx = createMockContext({
        body: { parentId: 'parent-uuid-001' }
      });

      const res = await resendHandler(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();

      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Terjadi kesalahan internal pada server.');

      const respString = JSON.stringify(data);
      assert.ok(!respString.includes(sensitiveToken), 'Response must not leak token');
      assert.ok(!respString.includes('Database error'), 'Response must not leak raw exception');

      assert.ok(consoleErrors.length > 0);
      for (const log of consoleErrors) {
        assert.ok(!log.includes(sensitiveToken), 'Console log must not leak token');
        assert.ok(!log.includes('Database error'), 'Console log must not leak raw exception');
        assert.strictEqual(log, 'WhatsApp invitation error.', 'Must log static sanitized message');
      }
    } finally {
      restoreConsoleError();
      resetFetch();
    }
  });

  // --- 14. Regression activation flow link compatibility ---
  await t.test('14. Regression activation flow: Redirect URL diarahkan ke /portal/accept-invitation dan link Supabase tervalidasi', () => {
    const validLink = `${mockSupabaseUrl}/auth/v1/verify?token=abc12345&type=invite&redirect_to=${encodeURIComponent(appUrl + '/portal/accept-invitation')}`;
    assert.strictEqual(isValidSupabaseActionLink(validLink, mockSupabaseUrl), true);

    const fakeLink = 'https://attacker.site/phish?token=abc12345';
    assert.strictEqual(isValidSupabaseActionLink(fakeLink, mockSupabaseUrl), false);

    const httpLink = `http://${mockSupabaseUrl.replace('https://', '')}/auth/v1/verify?token=abc`;
    assert.strictEqual(isValidSupabaseActionLink(httpLink, mockSupabaseUrl), false);
  });

  // --- 15. Regression delete flow ---
  await t.test('15. Regression delete flow: Menghapus akun Auth terlebih dahulu, lalu mengeksekusi RPC atomik', async () => {
    mockFetch([
      // Parent check
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: 'parent-uuid-del',
          tenant_id: 'tenant_chua_01',
          auth_uid: 'auth-user-del-123'
        }],
        status: 200
      },
      // Auth delete
      {
        pattern: '/auth/v1/admin/users/auth-user-del-123',
        method: 'DELETE',
        status: 200
      },
      // Database atomic RPC
      {
        pattern: '/rest/v1/rpc/parent_portal_atomic_delete',
        method: 'POST',
        body: [{ success: true, deleted_parent_count: 1 }],
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        url: 'http://localhost/api/tenant/parents/delete?id=parent-uuid-del',
        method: 'DELETE'
      });

      const res = await parentDeleteHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.match(data.message, /berhasil dihapus secara atomik dan aman/i);

      // Verify sequence: Auth delete must happen BEFORE atomic RPC
      const authDeleteIndex = fetchHistory.findIndex(f => f.url.includes('/auth/v1/admin/users/auth-user-del-123') && f.options.method === 'DELETE');
      const rpcIndex = fetchHistory.findIndex(f => f.url.includes('/rest/v1/rpc/parent_portal_atomic_delete'));

      assert.ok(authDeleteIndex !== -1, 'Auth delete must be called');
      assert.ok(rpcIndex !== -1, 'Atomic RPC delete must be called');
      assert.ok(authDeleteIndex < rpcIndex, 'Auth delete must precede atomic RPC delete');
    } finally {
      resetFetch();
    }
  });
});
