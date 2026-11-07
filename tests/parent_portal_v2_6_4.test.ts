import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as resendPost } from '../functions/api/tenant/parents/resend.js';
import { onRequestDelete as deleteDelete } from '../functions/api/tenant/parents/delete.js';

test('CHUVATOR — Parent Portal V2.6.4 Email Action Link Delivery & Atomic Database Deletion', async (t) => {
  const mockUrl = 'http://mock-supabase.local';
  const mockServiceKey = 'service-role-key';
  const appUrl = 'https://myapp.local';

  const getResendContext = (bodyOverride: any = null, envOverrides: any = {}, headersOverride: any = {}) => ({
    request: new Request('http://localhost/api/tenant/parents/resend', {
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
        parentId: 'parent-uuid-123'
      })
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

  await t.test('1. Email delivery: RESEND_API_KEY missing produces EMAIL_PROVIDER_NOT_CONFIGURED', async () => {
    try {
      const ctx = getResendContext(null, { RESEND_API_KEY: '' });
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'EMAIL_PROVIDER_NOT_CONFIGURED');
    } finally {
      resetFetch();
    }
  });

  await t.test('2. Email delivery: Only SendGrid key produces EMAIL_PROVIDER_NOT_CONFIGURED', async () => {
    try {
      const ctx = getResendContext(null, { RESEND_API_KEY: '', SENDGRID_API_KEY: 'SG.test' });
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'EMAIL_PROVIDER_NOT_CONFIGURED');
    } finally {
      resetFetch();
    }
  });

  await t.test('3. Email delivery: Invalid EMAIL_FROM produces INVALID_EMAIL_FROM', async () => {
    try {
      const ctx = getResendContext(null, { EMAIL_FROM: 'invalid-email-format' });
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'INVALID_EMAIL_FROM');
    } finally {
      resetFetch();
    }
  });

  await t.test('4. Email delivery: Successful HTML delivery with escaped action link (type: invite)', async () => {
    let capturedResendBody: any = null;
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null }, status: 200 },
      { pattern: '/auth/v1/admin/generate_link', method: 'POST', body: { properties: { action_link: 'https://supabase.co/verify?token=abc&xyz="test"' } }, status: 200 },
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
      assert.ok(capturedResendBody.html.includes('&quot;test&quot;'));
      assert.ok(!capturedResendBody.html.includes('"test"'));
    } finally {
      resetFetch();
    }
  });

  await t.test('5. Deletion: Auth failure halts process, RPC not called', async () => {
    let rpcCalled = false;
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 500, body: { error: 'Auth error' } },
      { 
        pattern: '/rest/v1/rpc/parent_portal_atomic_delete', 
        method: 'POST', 
        body: () => {
          rpcCalled = true;
          return [{ success: true }];
        }, 
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

  await t.test('6. Deletion: Auth 404 or success invokes atomic RPC', async () => {
    let rpcPayload: any = null;
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 404 },
      { 
        pattern: '/rest/v1/rpc/parent_portal_atomic_delete', 
        method: 'POST', 
        body: async (opts: any) => {
          rpcPayload = JSON.parse(opts.body);
          return [{ success: true, deleted_links_count: 1, deleted_parent_id: 'parent-uuid-123' }];
        }, 
        status: 200 
      }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.deepStrictEqual(rpcPayload, { p_tenant_id: 'tenant-1', p_parent_id: 'parent-uuid-123' });
    } finally {
      resetFetch();
    }
  });
});
