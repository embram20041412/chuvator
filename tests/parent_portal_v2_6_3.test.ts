import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as resendPost } from '../functions/api/tenant/parents/resend.js';
import { onRequestDelete as deleteDelete } from '../functions/api/tenant/parents/delete.js';

test('CHUVATOR — Parent Portal V2.6.3 Final Email Delivery & Safe Deletion Correction', async (t) => {
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
      RESEND_API_KEY: 'test-resend-key',
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

  await t.test('1. Email delivery fails explicitly with EMAIL_PROVIDER_NOT_CONFIGURED when API key is missing', async () => {
    try {
      const ctx = getResendContext(null, { RESEND_API_KEY: '', SENDGRID_API_KEY: '', EMAIL_PROVIDER_API_KEY: '' });
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'EMAIL_PROVIDER_NOT_CONFIGURED');
    } finally {
      resetFetch();
    }
  });

  await t.test('2. Successful email delivery and generate_link integration with type: invite', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null } },
      { pattern: '/auth/v1/admin/generate_link', method: 'POST', body: { properties: { action_link: 'http://mock-link' } }, status: 200 },
      { pattern: 'api.resend.com/emails', method: 'POST', body: { id: 'email-id-123' }, status: 200 }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    } finally {
      resetFetch();
    }
  });

  await t.test('3. Email delivery fails with EMAIL_SEND_FAILED when email provider returns error', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: '2026-01-01T00:00:00Z' } },
      { pattern: '/auth/v1/admin/generate_link', method: 'POST', body: { properties: { action_link: 'http://mock-link' } }, status: 200 },
      { pattern: 'api.resend.com/emails', method: 'POST', body: { error: 'Delivery failed' }, status: 500 }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'EMAIL_SEND_FAILED');
    } finally {
      resetFetch();
    }
  });

  await t.test('4. Delete halts if Auth deletion fails (no partial DB delete)', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 500, body: { error: 'Auth error' } }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'AUTH_DELETE_FAILED');
      
      // Verify parent_accounts DELETE was never called
      const dbDeleteCalled = fetchHistory.some(f => f.url.includes('/rest/v1/parent_accounts') && f.options?.method === 'DELETE');
      assert.strictEqual(dbDeleteCalled, false);
    } finally {
      resetFetch();
    }
  });

  await t.test('5. Successful delete across Auth and DB', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { pattern: '/rest/v1/parent_student_links', method: 'DELETE', status: 204 },
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'DELETE', status: 204 }
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
