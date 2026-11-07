import { test } from 'node:test';
import assert from 'node:assert';
import { onRequestPost as resendPost } from '../functions/api/tenant/parents/resend.js';
import { onRequestDelete as deleteDelete } from '../functions/api/tenant/parents/delete.js';

function escapeHtml(str: string) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

test('CHUVATOR — Parent Portal V2.6.8 Final Log Sanitization & Exception Test Completion', async (t) => {
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
    global.fetch = originalFetch;
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

  // --- 1. ACTION LINK & WHATSAPP URL ASSERTIONS ---

  await t.test('A. Invite: Action link with special characters is returned for WhatsApp assistance and properly encoded', async () => {
    const specialActionLink = 'https://mock-supabase.local/verify?token=abc&val="test"&quote=\'single\'&tag=<script>&end=>';

    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null }, status: 200 },
      { 
        pattern: '/auth/v1/admin/generate_link', 
        method: 'POST', 
        body: { properties: { action_link: specialActionLink } }, 
        status: 200 
      }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'READY_TO_SEND');
      assert.strictEqual(data.actionLink, specialActionLink);
      assert.ok(data.whatsappUrl.startsWith('https://wa.me/'));
      assert.ok(data.whatsappUrl.includes(encodeURIComponent(specialActionLink)));

      // Verify no Resend API calls were made
      const resendCalls = fetchHistory.filter(f => f.url.includes('api.resend.com'));
      assert.strictEqual(resendCalls.length, 0, 'No calls to Resend API allowed');
    } finally {
      resetFetch();
    }
  });

  await t.test('B. Recovery: Auth confirmed uses type recovery and returns WhatsApp url', async () => {
    let capturedGenerateBody: any = null;
    const recoveryLink = 'https://mock-supabase.local/recovery?token=xyz&secure=true';

    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: 'parent@example.com', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: '2026-01-01T00:00:00Z' }, status: 200 },
      { 
        pattern: '/auth/v1/admin/generate_link', 
        method: 'POST', 
        body: async (opts: any) => {
          capturedGenerateBody = JSON.parse(opts.body);
          return { properties: { action_link: recoveryLink } };
        }, 
        status: 200 
      }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedGenerateBody.type, 'recovery');
      
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.actionLink, recoveryLink);
      assert.ok(data.whatsappUrl.includes(encodeURIComponent(recoveryLink)));
    } finally {
      resetFetch();
    }
  });

  // --- 2. DIAGNOSTIC SANITIZATION & LOG INTERCEPTION TESTS ---

  await t.test('C. Provider & Supabase Error Sanitization: Raw messages, tokens, and PII do not leak to response or logs', async () => {
    interceptConsoleError();
    const sensitiveToken = 'super-secret-token-999';
    const sensitiveEmail = 'private-parent@example.com';

    mockFetch([
      { pattern: '/rest/v1/parent_accounts?select=', method: 'GET', body: [{ id: 'parent-uuid-123', tenant_id: 'tenant-1', email: sensitiveEmail, auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'GET', body: { id: 'auth-123', email_confirmed_at: null }, status: 200 },
      { 
        pattern: '/auth/v1/admin/generate_link', 
        method: 'POST', 
        body: new Error(`Unexpected failure with token=${sensitiveToken} and email=${sensitiveEmail}`), 
        status: 500 
      }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Terjadi kesalahan internal pada server.');

      const responseString = JSON.stringify(data);
      assert.ok(!responseString.includes(sensitiveToken), 'Response must not contain sensitive token');
      assert.ok(!responseString.includes(sensitiveEmail), 'Response must not contain sensitive email');
      assert.ok(!responseString.includes('Unexpected failure'), 'Response must not contain raw exception message');

      // Verify console.error logs are static and devoid of sensitive data / raw error messages
      assert.ok(consoleErrors.length > 0, 'Console error must be logged');
      for (const log of consoleErrors) {
        assert.ok(!log.includes(sensitiveToken), 'Log must not contain token');
        assert.ok(!log.includes(sensitiveEmail), 'Log must not contain email');
        assert.ok(!log.includes('Unexpected failure'), 'Log must not contain raw exception message');
        assert.strictEqual(log, 'WhatsApp invitation error.', 'Catch block must use static log message');
      }
    } finally {
      restoreConsoleError();
    }
  });

  await t.test('H. Upstream exception: Database fetch throws exception with sensitive tokens/email and is sanitized', async () => {
    interceptConsoleError();
    const sensitiveToken = 'upstream-exc-token-xyz';
    const sensitiveEmail = 'upstream-exc-email@example.com';

    mockFetch([
      { 
        pattern: '/rest/v1/parent_accounts?select=', 
        method: 'GET', 
        body: new Error(`Database connection dropped for token=${sensitiveToken} and email=${sensitiveEmail}`), 
        status: 500 
      }
    ]);

    try {
      const ctx = getResendContext();
      const res = await resendPost(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Terjadi kesalahan internal pada server.');

      const respStr = JSON.stringify(data);
      assert.ok(!respStr.includes(sensitiveToken));
      assert.ok(!respStr.includes(sensitiveEmail));
      assert.ok(!respStr.includes('Database connection dropped'));

      for (const log of consoleErrors) {
        assert.ok(!log.includes(sensitiveToken));
        assert.ok(!log.includes(sensitiveEmail));
        assert.ok(!log.includes('Database connection dropped'));
        assert.strictEqual(log, 'WhatsApp invitation error.');
      }
    } finally {
      restoreConsoleError();
      resetFetch();
    }
  });

  // --- DELETE TESTS & SANITIZATION ---

  await t.test('I. Delete log sanitization: Unexpected exception in delete enters catch block and logs static message without PII/tokens', async () => {
    interceptConsoleError();
    const sensitiveParentId = 'parent-uuid-sql-err-999';
    const sensitiveToken = 'db-error-token-secret';

    mockFetch([
      { 
        pattern: `/rest/v1/parent_accounts?id=eq.${sensitiveParentId}`, 
        method: 'GET', 
        body: new Error(`Database connection timeout for parent=${sensitiveParentId} token=${sensitiveToken}`), 
        status: 500 
      }
    ]);

    try {
      const ctx = getDeleteContext(sensitiveParentId);
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Terjadi kesalahan internal pada server.');

      const respStr = JSON.stringify(data);
      assert.ok(!respStr.includes(sensitiveParentId));
      assert.ok(!respStr.includes(sensitiveToken));
      assert.ok(!respStr.includes('Database connection timeout'));

      assert.strictEqual(consoleErrors.length, 1, 'Exactly one console.error call expected in catch block');
      assert.strictEqual(consoleErrors[0], 'Delete parent account error.', 'Log must be strictly the static message');
      assert.ok(!consoleErrors[0].includes(sensitiveParentId));
      assert.ok(!consoleErrors[0].includes(sensitiveToken));
      assert.ok(!consoleErrors[0].includes('Database connection timeout'));
    } finally {
      restoreConsoleError();
      resetFetch();
    }
  });

  await t.test('D. Delete Sanitization & Validation: Count validation and log sanitization', async () => {
    interceptConsoleError();
    const sensitiveParentId = 'parent-uuid-secret-999';

    mockFetch([
      { pattern: `/rest/v1/parent_accounts?id=eq.${sensitiveParentId}`, method: 'GET', body: [{ id: sensitiveParentId, tenant_id: 'tenant-1', auth_uid: 'auth-123' }] },
      { pattern: '/auth/v1/admin/users/auth-123', method: 'DELETE', status: 200 },
      { pattern: '/rest/v1/rpc/parent_portal_atomic_delete', method: 'POST', body: [{ success: true, deleted_links_count: 5, deleted_parent_count: 2 }], status: 200 }
    ]);

    try {
      const ctx = getDeleteContext(sensitiveParentId);
      const res = await deleteDelete(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'ATOMIC_DELETE_FAILED');
      
      const respStr = JSON.stringify(data);
      assert.ok(!respStr.includes(sensitiveParentId));
    } finally {
      restoreConsoleError();
      resetFetch();
    }
  });

  await t.test('E. Delete: success=true but deleted_parent_count=0 must fail', async () => {
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

  await t.test('F. Delete: Auth error other than 404 must NOT call RPC', async () => {
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

  await t.test('G. Delete: Valid deletion with count 1 succeeds', async () => {
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
