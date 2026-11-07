import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestGet as parentListHandler, onRequestPost as parentCreateHandler } from '../functions/api/tenant/parents/index.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

test('CHUVATOR PARENT PORTAL V2.6.12 — STATUS CONSISTENCY & KV RESILIENCE TEST SUITE', async (t) => {
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
    kvOverride?: any;
    kvStoreInitial?: Record<string, string>;
  }) => {
    const {
      url = 'http://localhost/api/tenant/parents',
      method = 'GET',
      body,
      role = 'owner',
      tenantId = 'tenant_chua_01',
      kvOverride,
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

    const defaultKV = {
      get: async (k: string) => kvStore.get(k) || null,
      put: async (k: string, v: string) => { kvStore.set(k, v); }
    };

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
        PORTAL_SESSIONS_KV: kvOverride || defaultKV
      },
      kvStore
    };
  };

  // --- 1. Regression Test: Metadata READY_TO_SEND, KV SENT_MANUALLY lama ---
  await t.test('1. Status Consistency: Metadata READY_TO_SEND mengalahkan KV SENT_MANUALLY lama', async () => {
    const parentId = 'p-uuid-ready-meta';
    const authUid = 'auth-uuid-ready-meta';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: parentId,
          tenant_id: 'tenant_chua_01',
          auth_uid: authUid,
          full_name: 'Wali Ready',
          email: 'ready@example.com',
          phone: '081234567890',
          created_at: '2026-10-01T00:00:00Z'
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
            invitation_status: 'READY_TO_SEND',
            invitation_generated_at: new Date(Date.now() - 300 * 1000).toISOString() // 5 mins ago
          }
        },
        status: 200
      }
    ]);

    try {
      // KV holds stale SENT_MANUALLY from yesterday
      const ctx = createMockContext({
        method: 'GET',
        kvStoreInitial: {
          [`v2_invitation_status:${parentId}`]: JSON.stringify({
            status: 'SENT_MANUALLY',
            sentAt: '2026-11-06T10:00:00Z'
          })
        }
      });

      const res = await parentListHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data[0].invitationStatus, 'READY_TO_SEND', 'Metadata READY_TO_SEND must strictly override stale KV SENT_MANUALLY');
    } finally {
      resetFetch();
    }
  });

  // --- 2. Regression Test: Metadata SENT_MANUALLY, KV READY_TO_SEND lama ---
  await t.test('2. Status Consistency: Metadata SENT_MANUALLY mengalahkan KV READY_TO_SEND lama', async () => {
    const parentId = 'p-uuid-sent-meta';
    const authUid = 'auth-uuid-sent-meta';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: parentId,
          tenant_id: 'tenant_chua_01',
          auth_uid: authUid,
          full_name: 'Wali Sent',
          email: 'sent@example.com',
          phone: '081234567890',
          created_at: '2026-10-01T00:00:00Z'
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
      // KV holds stale READY_TO_SEND
      const ctx = createMockContext({
        method: 'GET',
        kvStoreInitial: {
          [`v2_invitation_status:${parentId}`]: JSON.stringify({
            status: 'READY_TO_SEND',
            generatedAt: '2026-11-06T08:00:00Z'
          })
        }
      });

      const res = await parentListHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data[0].invitationStatus, 'SENT_MANUALLY', 'Metadata SENT_MANUALLY must strictly override stale KV READY_TO_SEND');
    } finally {
      resetFetch();
    }
  });

  // --- 3. Regression Test: Metadata tidak tersedia, KV READY_TO_SEND ---
  await t.test('3. Status Consistency: Metadata tidak tersedia (legacy user), KV READY_TO_SEND digunakan sebagai fallback', async () => {
    const parentId = 'p-uuid-legacy-ready';
    const authUid = 'auth-uuid-legacy-ready';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: parentId,
          tenant_id: 'tenant_chua_01',
          auth_uid: authUid,
          full_name: 'Wali Legacy Ready',
          email: 'legacy.ready@example.com',
          phone: '081234567890',
          created_at: '2026-10-01T00:00:00Z'
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
          user_metadata: {} // No invitation metadata
        },
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        method: 'GET',
        kvStoreInitial: {
          [`v2_invitation_status:${parentId}`]: JSON.stringify({
            status: 'READY_TO_SEND',
            generatedAt: new Date(Date.now() - 600 * 1000).toISOString()
          })
        }
      });

      const res = await parentListHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data[0].invitationStatus, 'READY_TO_SEND');
    } finally {
      resetFetch();
    }
  });

  // --- 4. Regression Test: Metadata tidak tersedia, KV SENT_MANUALLY ---
  await t.test('4. Status Consistency: Metadata tidak tersedia (legacy user), KV SENT_MANUALLY digunakan sebagai fallback', async () => {
    const parentId = 'p-uuid-legacy-sent';
    const authUid = 'auth-uuid-legacy-sent';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: parentId,
          tenant_id: 'tenant_chua_01',
          auth_uid: authUid,
          full_name: 'Wali Legacy Sent',
          email: 'legacy.sent@example.com',
          phone: '081234567890',
          created_at: '2026-10-01T00:00:00Z'
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
          user_metadata: {} // No invitation metadata
        },
        status: 200
      }
    ]);

    try {
      const ctx = createMockContext({
        method: 'GET',
        kvStoreInitial: {
          [`v2_invitation_status:${parentId}`]: JSON.stringify({
            status: 'SENT_MANUALLY',
            sentAt: new Date(Date.now() - 600 * 1000).toISOString()
          })
        }
      });

      const res = await parentListHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data[0].invitationStatus, 'SENT_MANUALLY');
    } finally {
      resetFetch();
    }
  });

  // --- 5. Regression Test: Metadata dan KV gagal dibaca ---
  await t.test('5. Status Consistency: Metadata dan KV gagal dibaca, fallback elegan tanpa crash (READY_TO_SEND, bukan crash atau salah EXPIRED)', async () => {
    const parentId = 'p-uuid-total-fail';
    const authUid = 'auth-uuid-total-fail';

    mockFetch([
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'GET',
        body: [{
          id: parentId,
          tenant_id: 'tenant_chua_01',
          auth_uid: authUid,
          full_name: 'Wali Fail All',
          email: 'failall@example.com',
          phone: '081234567890',
          created_at: '2026-09-01T00:00:00Z' // 2 months old account
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
        // Auth user fetch fails with 500
        pattern: `/auth/v1/admin/users/${authUid}`,
        method: 'GET',
        status: 500,
        body: { message: 'Internal auth service failure' }
      }
    ]);

    try {
      // KV also throws or is empty
      const ctx = createMockContext({
        method: 'GET',
        kvOverride: {
          get: async () => { throw new Error('KV network disconnected'); },
          put: async () => {}
        }
      });

      const res = await parentListHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.length, 1);
      // Because account created_at is NOT used as TTL fallback, it doesn't falsely mark as EXPIRED
      assert.strictEqual(data.data[0].invitationStatus, 'READY_TO_SEND');
    } finally {
      resetFetch();
    }
  });

  // --- 6. Regression Test: Kegagalan KV setelah pembuatan akun ---
  await t.test('6. KV Resilience on Create: Kegagalan penulisan KV setelah DB & Auth tersimpan TIDAK menghasilkan HTTP 500 dan akun tidak dihapus', async () => {
    const validHmac = await computeHMAC('1234567890123456', hmacSecret);
    const validActionLink = 'https://mock-supabase.local/auth/v1/verify?token=valid-tok-kv-fail&type=invite&redirect_to=https://myapp.local/portal/accept-invitation';
    let authUserDeleted = false;
    let parentAccountDeleted = false;

    mockFetch([
      // Student query
      {
        pattern: '/rest/v1/students',
        method: 'GET',
        body: [{
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Siswa Sukses',
          tenant_id: 'tenant_chua_01',
          kk_hmac: validHmac
        }],
        status: 200
      },
      // Tenant lookup
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        body: [{ id: 'tenant_chua_01', name: 'Chua Tennis Academy' }],
        status: 200
      },
      // Check existing email
      {
        pattern: '/rest/v1/parent_accounts?email=eq.',
        method: 'GET',
        body: [],
        status: 200
      },
      // Generate link
      {
        pattern: '/auth/v1/admin/generate_link',
        method: 'POST',
        body: {
          properties: { action_link: validActionLink },
          user: { id: 'auth-user-kv-resilience-123' }
        },
        status: 200
      },
      // Insert parent_accounts
      {
        pattern: '/rest/v1/parent_accounts',
        method: 'POST',
        body: [{ id: 'parent-acc-kv-resilience-123' }],
        status: 201
      },
      // Insert parent_student_links
      {
        pattern: '/rest/v1/parent_student_links',
        method: 'POST',
        body: [{ id: 'link-123' }],
        status: 201
      },
      // Auth user delete trap (must NOT be called)
      {
        pattern: '/auth/v1/admin/users/auth-user-kv-resilience-123',
        method: 'DELETE',
        body: async () => { authUserDeleted = true; return {}; },
        status: 200
      },
      // Parent account delete trap (must NOT be called)
      {
        pattern: '/rest/v1/parent_accounts?id=eq.parent-acc-kv-resilience-123',
        method: 'DELETE',
        body: async () => { parentAccountDeleted = true; return {}; },
        status: 200
      }
    ]);

    try {
      // Mock KV where put() throws an unexpected exception
      const ctx = createMockContext({
        method: 'POST',
        url: 'http://localhost/api/tenant/parents',
        body: {
          name: 'Budi KV Resilient',
          email: 'budi.kvresilient@example.com',
          phone: '081234567890',
          kk: '1234567890123456',
          studentIds: ['11111111-1111-1111-1111-111111111111'],
          relationship: 'father'
        },
        kvOverride: {
          get: async () => null,
          put: async () => {
            throw new Error('Cloudflare KV 503 Service Unavailable');
          }
        }
      });

      const res = await parentCreateHandler(ctx);
      assert.strictEqual(res.status, 201, 'Account creation must succeed with HTTP 201 even if KV cache put fails');
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.actionLink, validActionLink);
      assert.ok(data.whatsappUrl.startsWith('https://wa.me/6281234567890'));
      assert.strictEqual(authUserDeleted, false, 'Auth user must NOT be deleted due to KV cache failure');
      assert.strictEqual(parentAccountDeleted, false, 'Parent account must NOT be deleted due to KV cache failure');
    } finally {
      resetFetch();
    }
  });
});
