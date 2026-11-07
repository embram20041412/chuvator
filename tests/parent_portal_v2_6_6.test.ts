import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as resendPost } from '../functions/api/tenant/parents/resend.js';
import { onRequestDelete as deleteDelete } from '../functions/api/tenant/parents/delete.js';

test('CHUVATOR — Parent Portal V2.6.6 Final Delete Verification & Diagnostic Sanitization', async (t) => {
  const mockUrl = 'https://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  const appUrl = 'https://myapp.local';

  const getResendContext = (bodyOverride: any = null, envOverrides: any = {}) => ({
    request: new Request('http://localhost/api/tenant/parents/resend', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer staff-token',
        'Origin': 'https://myapp.local',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'staff-123',
        'x-test-tenant-id': 'tenant-1',
        'cf-connecting-ip': '1.1.1.1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyOverride || { parentId: 'parent-uuid-123' })
    }),
    env: {
      SUPABASE_URL: mockUrl,
      SUPABASE_SERVICE_ROLE_KEY: mockServiceKey,
      SUPABASE_ANON_KEY: 'mock-anon-key',
      RESEND_API_KEY: 're_test_key_123',
      EMAIL_FROM: 'noreply@chuasport.com',
      APP_URL: appUrl,
      ENVIRONMENT: 'test',
      ALLOWED_ORIGINS: 'https://myapp.local',
      ...envOverrides
    }
  });

  const getDeleteContext = (queryId: string = 'parent-uuid-123', headersOverride: any = {}) => ({
    request: new Request(`http://localhost/api/tenant/parents/delete?id=${queryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer staff-token',
        'Origin': 'https://myapp.local',
        'x-test-staff-role': 'owner',
        'x-test-staff-uid': 'staff-123',
        'x-test-tenant-id': 'tenant-1',
        'cf-connecting-ip': '1.1.1.1',
        ...headersOverride
      }
    }),
    env: {
      SUPABASE_URL: mockUrl,
      SUPABASE_SERVICE_ROLE_KEY: mockServiceKey,
      SUPABASE_ANON_KEY: 'mock-anon-key',
      ENVIRONMENT: 'test',
      ALLOWED_ORIGINS: 'https://myapp.local'
    }
  });

  let fetchHistory: any[] = [];
  const originalFetch = global.fetch;

  const mockFetch = (rules: Array<{ pattern: string; method?: string; status?: number; body?: any; headers?: any }>) => {
    global.fetch = async (url: any, options: any) => {
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
    global.fetch = originalFetch;
    fetchHistory = [];
  };

  // --- EMAIL TESTS ---

  await t.test('A. Invite: Auth unconfirmed uses type invite and escapes action link', async () => {
    let capturedGenerateBody: any = null;
    let capturedResendBody: any = null;

    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null }, status: 200 },
      { 
        pattern: '/auth/v1/admin/generate_link', 
        method: 'POST', 
        body: async (opts: any) => {
          capturedGenerateBody = JSON.parse(opts.body);
          return { properties: { action_link: 'https://mock-supabase.local/verify?token=abc&val="test"' } };
        }, 
        status: 200 
      },
      { 
        pattern: 'api.resend.com/emails', 
        method: 'POST', 
        body: async (opts: any) => {
          capturedResendBody = JSON.parse(opts.body);
          return { id: 'resend-id-123' };
        }, 
        status: 200 
      }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(capturedGenerateBody.type, 'invite');
      assert.ok(capturedResendBody.html.includes('&quot;test&quot;'));
      assert.ok(!capturedResendBody.html.includes('"test"'));
    } finally {
      resetFetch();
    }
  });

  await t.test('B. Recovery: Auth confirmed uses type recovery', async () => {
    let capturedGenerateBody: any = null;

    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: '2026-01-01T00:00:00Z' }, status: 200 },
      { 
        pattern: '/auth/v1/admin/generate_link', 
        method: 'POST', 
        body: async (opts: any) => {
          capturedGenerateBody = JSON.parse(opts.body);
          return { properties: { action_link: 'https://mock-supabase.local/recovery?token=xyz' } };
        }, 
        status: 200 
      },
      { pattern: 'api.resend.com/emails', method: 'POST', body: { id: 'resend-id-123' }, status: 200 }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedGenerateBody.type, 'recovery');
    } finally {
      resetFetch();
    }
  });

  await t.test('C. Provider: Resend HTTP error or exception does not produce success', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null }, status: 200 },
      { pattern: '/auth/v1/admin/generate_link', method: 'POST', body: { properties: { action_link: 'https://mock-supabase.local/verify?token=abc' } }, status: 200 },
      { pattern: 'api.resend.com/emails', method: 'POST', body: { error: 'Internal Resend Error' }, status: 500 }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'EMAIL_SEND_FAILED');
      assert.ok(!JSON.stringify(data).includes('Internal Resend Error'));
    } finally {
      resetFetch();
    }
  });

  // --- DELETE TESTS ---

  await t.test('D. Delete: success=true but deleted_parent_count=0 must fail', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { pattern: '/rest/v1/rpc/parent_portal_atomic_delete', method: 'POST', body: [{ success: true, deleted_links_count: 0, deleted_parent_count: 0 }], status: 200 }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'ATOMIC_DELETE_FAILED');
    } finally {
      resetFetch();
    }
  });

  await t.test('E. Delete: success=true but deleted_parent_count=2 must fail', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { pattern: '/rest/v1/rpc/parent_portal_atomic_delete', method: 'POST', body: [{ success: true, deleted_links_count: 5, deleted_parent_count: 2 }], status: 200 }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'ATOMIC_DELETE_FAILED');
    } finally {
      resetFetch();
    }
  });

  await t.test('F. Delete: success=false must fail', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { pattern: '/rest/v1/rpc/parent_portal_atomic_delete', method: 'POST', body: [{ success: false, deleted_links_count: 0, deleted_parent_count: 0 }], status: 200 }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    } finally {
      resetFetch();
    }
  });

  await t.test('G. Delete: RPC HTTP error must fail', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { pattern: '/rest/v1/rpc/parent_portal_atomic_delete', method: 'POST', body: { message: 'Database error' }, status: 500 }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'RPC_DELETE_FAILED');
    } finally {
      resetFetch();
    }
  });

  await t.test('H. Delete: Auth error other than 404 must NOT call RPC', async () => {
    let rpcCalled = false;
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 502 },
      { 
        pattern: '/rest/v1/rpc/parent_portal_atomic_delete', 
        method: 'POST', 
        body: async () => { rpcCalled = true; return [{ success: true, deleted_parent_count: 1 }]; }, 
        status: 200 
      }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'AUTH_DELETE_FAILED');
      assert.strictEqual(rpcCalled, false);
    } finally {
      resetFetch();
    }
  });

  await t.test('I. Delete: Auth 404 still proceeds to RPC successfully', async () => {
    let rpcCalled = false;
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 404 },
      { 
        pattern: '/rest/v1/rpc/parent_portal_atomic_delete', 
        method: 'POST', 
        body: async () => { rpcCalled = true; return [{ success: true, deleted_parent_count: 1 }]; }, 
        status: 200 
      }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(rpcCalled, true);
    } finally {
      resetFetch();
    }
  });

  await t.test('J. Delete: Valid deletion with count 1 succeeds', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { pattern: '/rest/v1/rpc/parent_portal_atomic_delete', method: 'POST', body: [{ success: true, deleted_links_count: 1, deleted_parent_count: 1 }], status: 200 }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    } finally {
      resetFetch();
    }
  });
});
