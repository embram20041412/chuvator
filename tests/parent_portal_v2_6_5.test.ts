import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { onRequestPost as resendPost } from '../functions/api/tenant/parents/resend.js';
import { onRequestDelete as deleteDelete } from '../functions/api/tenant/parents/delete.js';

test('CHUVATOR — Parent Portal V2.6.5 Final Type Alignment, Error Sanitization & Verification Hardening', async (t) => {
  const mockUrl = 'https://mock-supabase.local';
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

  await t.test('1. Email delivery: Malformed Auth JSON fails-closed', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: 'not-json-malformed', status: 200, headers: { 'Content-Type': 'text/plain' } }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'AUTH_VERIFICATION_FAILED');
    } finally {
      resetFetch();
    }
  });

  await t.test('2. Email delivery: Auth UID mismatch fails-closed', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'different-auth-uid' }, status: 200 }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'AUTH_VERIFICATION_FAILED');
    } finally {
      resetFetch();
    }
  });

  await t.test('3. Email delivery: Non-Supabase or non-HTTPS action link is rejected', async () => {
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', phone: '081234567890', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null }, status: 200 },
      { pattern: '/auth/v1/admin/generate_link', method: 'POST', body: { properties: { action_link: 'http://malicious-external.com/link' } }, status: 200 },
      { pattern: '/rest/v1/tenants', method: 'GET', body: [{ id: 'tenant-1', name: 'Tenant 1' }], status: 200 }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.code, 'INVALID_ACTION_LINK');
    } finally {
      resetFetch();
    }
  });

  await t.test('4. WhatsApp invitation: Successful action link with verified type: invite without email provider', async () => {
    let capturedGenerateBody: any = null;
    const validLink = 'https://mock-supabase.local/auth/v1/verify?token=abc&xyz="test"&type=invite&redirect_to=https://myapp.local/portal/accept-invitation';
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123', phone: '08123456789' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null }, status: 200 },
      { 
        pattern: '/auth/v1/admin/generate_link', 
        method: 'POST', 
        body: async (opts: any) => {
          capturedGenerateBody = JSON.parse(opts.body);
          return { properties: { action_link: validLink } };
        }, 
        status: 200 
      },
      {
        pattern: '/rest/v1/tenants',
        method: 'GET',
        body: [{ id: 'tenant-1', name: 'Chua Academy' }],
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
      assert.ok(data.data.actionLink.includes('token=abc'));
      assert.ok(data.data.whatsappUrl.startsWith('https://wa.me/'));
    } finally {
      resetFetch();
    }
  });

  await t.test('5. Deletion: RPC receives tenant_id as TEXT and parent_id as UUID, success=true', async () => {
    let rpcPayload: any = null;
    mockFetch([
      { pattern: '/rest/v1/parent_accounts?id=eq.parent-uuid-123', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { 
        pattern: '/rest/v1/rpc/parent_portal_atomic_delete', 
        method: 'POST', 
        body: async (opts: any) => {
          rpcPayload = JSON.parse(opts.body);
          return [{ success: true, deleted_links_count: 2, deleted_parent_count: 1 }];
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
      assert.strictEqual(typeof rpcPayload.p_tenant_id, 'string');
      assert.strictEqual(rpcPayload.p_tenant_id, 'tenant-1');
      assert.strictEqual(rpcPayload.p_parent_id, 'parent-uuid-123');
    } finally {
      resetFetch();
    }
  });

  await t.test('6. Static SQL verification: check migration file content for TEXT tenant_id, FOR UPDATE, search_path, SECURITY DEFINER, and no SQLERRM return', async () => {
    const sqlPath = path.join(process.cwd(), 'phase_parent_portal_v2_6_5_atomic_delete.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    assert.ok(sqlContent.includes('p_tenant_id TEXT'), 'RPC parameter p_tenant_id must be TEXT');
    assert.ok(sqlContent.includes('SECURITY DEFINER'), 'Must have SECURITY DEFINER');
    assert.ok(sqlContent.includes('SET search_path = \'\''), 'Must set empty search_path');
    assert.ok(sqlContent.includes('FOR UPDATE'), 'Must use FOR UPDATE row locking');
    assert.ok(sqlContent.includes('public.parent_accounts'), 'Must use fully qualified table public.parent_accounts');
    assert.ok(sqlContent.includes('public.parent_student_links'), 'Must use fully qualified table public.parent_student_links');
    assert.ok(!sqlContent.includes('SQLERRM'), 'Must NOT return SQLERRM to caller');
    assert.ok(sqlContent.includes('REVOKE EXECUTE ON FUNCTION public.parent_portal_atomic_delete(TEXT, UUID) FROM PUBLIC'), 'Must revoke execute from PUBLIC');
    assert.ok(sqlContent.includes('GRANT EXECUTE ON FUNCTION public.parent_portal_atomic_delete(TEXT, UUID) TO service_role'), 'Must grant execute only to service_role');
  });
});
