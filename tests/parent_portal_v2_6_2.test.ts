import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as resendPost } from '../functions/api/tenant/parents/resend.js';
import { onRequestDelete as deleteDelete } from '../functions/api/tenant/parents/delete.js';
import { onRequestGet as getParentsGet } from '../functions/api/tenant/parents/index.js';

test('CHUVATOR — Parent Portal V2.6.2 Final Invitation Recovery & Lifecycle Correction', async (t) => {
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

  const getGetContext = (headersOverride: any = {}) => ({
    request: new Request('http://localhost/api/tenant/parents', {
      method: 'GET',
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
          return new Response(JSON.stringify(rule.body || {}), { 
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

  await t.test('1. Resend for unconfirmed user uses type: invite', async () => {
    let capturedBody: any = null;
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null } },
      { 
        pattern: '/auth/v1/admin/generate_link', 
        method: 'POST', 
        body: async (opts: any) => {
          capturedBody = JSON.parse(opts.body);
          return { properties: { action_link: 'http://link' } };
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
    } finally {
      resetFetch();
    }
  });

  await t.test('2. Password recovery for confirmed user uses type: recovery', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: '2026-01-01T00:00:00Z' } },
      { pattern: '/auth/v1/admin/generate_link', method: 'POST', body: { properties: { action_link: 'http://link' } }, status: 200 }
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

  await t.test('3. Status verification uses email_confirmed_at instead of last_sign_in_at', async () => {
    mockFetch([
      { 
        pattern: '/rest/v1/parent_accounts?select=', 
        method: 'GET', 
        body: [
          { id: 'p1', tenant_id: 'tenant-1', auth_uid: 'auth-active', full_name: 'Parent Active', email: 'a@ex.com' },
          { id: 'p2', tenant_id: 'tenant-1', auth_uid: 'auth-pending', full_name: 'Parent Pending', email: 'p@ex.com' },
          { id: 'p3', tenant_id: 'tenant-1', auth_uid: 'auth-missing', full_name: 'Parent Missing', email: 'u@ex.com' }
        ] 
      },
      { pattern: '/rest/v1/parent_student_links', method: 'GET', body: [] },
      { pattern: '/auth/v1/admin/users/auth-active', method: 'GET', body: { id: 'auth-active', email_confirmed_at: '2026-01-01T00:00:00Z', last_sign_in_at: null }, status: 200 },
      { pattern: '/auth/v1/admin/users/auth-pending', method: 'GET', body: { id: 'auth-pending', email_confirmed_at: null, last_sign_in_at: '2026-01-01T00:00:00Z' }, status: 200 },
      { pattern: '/auth/v1/admin/users/auth-missing', method: 'GET', body: { error: 'Not found' }, status: 404 }
    ]);

    try {
      const ctx = getGetContext();
      const res = await getParentsGet(ctx);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const list = json.data;
      
      assert.strictEqual(list.find((p: any) => p.id === 'p1').status, 'active');
      assert.strictEqual(list.find((p: any) => p.id === 'p2').status, 'pending');
      assert.strictEqual(list.find((p: any) => p.id === 'p3').status, 'unverifiable');
    } finally {
      resetFetch();
    }
  });

  await t.test('4. Delete handles auth failure with compensation', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123', email: 'p@ex.com', full_name: 'Parent' }] },
      { pattern: '/rest/v1/parent_student_links', method: 'GET', body: [] },
      { pattern: '/rest/v1/parent_student_links', method: 'DELETE', status: 204 },
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'DELETE', status: 204 },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 500, body: { error: 'Auth delete error' } },
      { pattern: '/rest/v1/parent_accounts', method: 'POST', status: 201, body: {} }
    ]);

    try {
      const ctx = getDeleteContext('parent-uuid-123');
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'AUTH_DELETE_FAILED');
    } finally {
      resetFetch();
    }
  });
});
