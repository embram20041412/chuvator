import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as evaluationsHandler } from '../functions/api/portal/evaluations.js';

test('CHUVATOR — Parent Portal V2.6.9 Security Hotfix: Evaluations Endpoint Authentication & Authorization', async (t) => {
  const mockUrl = 'https://mock-supabase.local';
  const mockAnonKey = 'anon-key-public-123';
  const encryptionSecret = 'enc-secret-long-enough-32-chars-xyz!';
  const appUrl = 'https://myapp.local';

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

  const createEvaluationContext = (options: {
    method?: string;
    body?: any;
    searchParams?: Record<string, string>;
    cookie?: string;
    csrfToken?: string;
    sessionRecord?: any;
    envOverrides?: any;
  }) => {
    const {
      method = 'POST',
      body,
      searchParams = {},
      cookie,
      csrfToken = 'csrf_token_123',
      sessionRecord,
      envOverrides = {}
    } = options;

    let urlStr = 'http://localhost/api/portal/evaluations';
    const sp = new URLSearchParams(searchParams);
    if (Object.keys(searchParams).length > 0) {
      urlStr += `?${sp.toString()}`;
    }

    const headers: Record<string, string> = {
      'Origin': appUrl,
      'Content-Type': 'application/json'
    };
    if (cookie !== undefined) {
      headers['Cookie'] = cookie;
    }
    if (csrfToken) {
      headers['X-Portal-CSRF'] = csrfToken;
    }

    const reqInit: RequestInit = {
      method,
      headers
    };
    if (method === 'POST' && body !== undefined) {
      reqInit.body = JSON.stringify(body);
    }

    const kvStore = new Map<string, string>();
    if (sessionRecord) {
      // In _auth_v2.js, hash is calculated via hashString(token)
      // When token is 'valid_session_token', we store under v2:<hash>
    }

    return {
      request: new Request(urlStr, reqInit),
      env: {
        SUPABASE_URL: mockUrl,
        SUPABASE_ANON_KEY: mockAnonKey,
        PORTAL_TOKEN_ENCRYPTION_SECRET: encryptionSecret,
        ALLOWED_ORIGINS: appUrl,
        ENVIRONMENT: 'development',
        ...envOverrides
      }
    };
  };

  // Helper to create active V2 session in KV
  const setupValidSession = async (envObj: any, customProps: any = {}) => {
    const { hashString, encryptToken } = await import('../functions/api/portal/_auth_v2.js');
    const token = 'valid_session_token_xyz';
    const sessionHash = await hashString(token);
    const csrfToken = 'valid_csrf_token_abc';

    const encAccess = await encryptToken('parent_access_token_secret_123', envObj);
    const encRefresh = await encryptToken('parent_refresh_token_secret_456', envObj);

    const record = {
      version: 'v2',
      sessionHash,
      csrfToken,
      authUserId: 'auth_parent_uuid_789',
      email: 'wali@example.com',
      accessibleTenants: ['tenant_academy_1'],
      childrenSummary: [
        {
          studentId: '11111111-1111-1111-1111-111111111111',
          studentName: 'Budi Santoso',
          tenantId: 'tenant_academy_1',
          className: 'Kelas U-12'
        }
      ],
      encryptedAccessToken: encAccess,
      encryptedRefreshToken: encRefresh,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      isRevoked: false,
      ...customProps
    };

    const kvStore = new Map<string, string>();
    kvStore.set(`v2:${sessionHash}`, JSON.stringify(record));

    envObj.PORTAL_SESSIONS_KV = {
      get: async (key: string) => kvStore.get(key) || null,
      put: async (key: string, val: string) => { kvStore.set(key, val); }
    };

    return { token, csrfToken, sessionRecord: record };
  };

  // --- TEST SUITES ---

  await t.test('1. Akses tanpa cookie sesi mengembalikan HTTP 401', async () => {
    mockFetch([]);
    try {
      const ctx = createEvaluationContext({
        cookie: '' // No cookie
      });
      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /sesi tidak valid/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('2. Akses dengan cookie sesi palsu / expired mengembalikan HTTP 401', async () => {
    mockFetch([]);
    try {
      const ctx = createEvaluationContext({
        cookie: 'portal_session_v2=fake_invalid_token'
      });
      ctx.env.PORTAL_SESSIONS_KV = {
        get: async () => null // Sesi tidak ditemukan
      };

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /sesi tidak valid/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('3. Akses studentId milik parent lain (IDOR) ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'auth_parent_uuid_789' }, status: 200 }
    ]);

    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupValidSession(ctx.env);

      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({
          studentId: '99999999-9999-9999-9999-999999999999', // Orang lain
          tenantId: 'tenant_academy_1'
        })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /akses.*ditolak/i);
      assert.match(data.message, /tidak memiliki otorisasi/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('4. Akses dengan parameter tenant yang tidak sesuai ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'auth_parent_uuid_789' }, status: 200 }
    ]);

    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupValidSession(ctx.env);

      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({
          studentId: '11111111-1111-1111-1111-111111111111',
          tenantId: 'tenant_hacker_academy' // Spoofed tenant
        })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /akses lintas tenant tidak diizinkan/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('5. Sesi valid dan siswa terhubung: berhasil memuat data dan menggunakan token user (BUKAN anonKey Bearer)', async () => {
    const validStudentId = '11111111-1111-1111-1111-111111111111';
    const mockEvaluations = [
      {
        id: 'eval-uuid-001',
        student_id: validStudentId,
        tenant_id: 'tenant_academy_1',
        status: 'published',
        overall_score: 88,
        pillar_scores: { teknik: 90, fisik: 85, mental: 85, taktik: 92 },
        coach_note: 'Bermain sangat disiplin',
        evaluator: 'Coach Agus',
        created_at: '2026-11-01T10:00:00Z'
      }
    ];

    const mockStudent = [
      {
        id: validStudentId,
        student_name: 'Budi Santoso',
        class_name: 'Kelas U-12',
        tournaments: [
          { name: 'Piala Gubernur 2026', result: 'Juara 1 Emas', status: 'published' }
        ]
      }
    ];

    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'auth_parent_uuid_789' }, status: 200 },
      { pattern: '/rest/v1/academy_evaluations', method: 'GET', body: mockEvaluations, status: 200 },
      { pattern: '/rest/v1/students', method: 'GET', body: mockStudent, status: 200 }
    ]);

    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupValidSession(ctx.env);

      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({
          studentId: validStudentId,
          tenantId: 'tenant_academy_1'
        })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.evaluations.length, 1);
      assert.strictEqual(data.evaluations[0].overallScore, 88);
      assert.strictEqual(data.latestEvaluation.evaluator, 'Coach Agus');
      assert.strictEqual(data.achievements.length, 1);
      assert.strictEqual(data.achievements[0].name, 'Piala Gubernur 2026');
      assert.strictEqual(data.student.studentName, 'Budi Santoso');

      // VERIFIKASI KEAMANAN: Pastikan Bearer token adalah accessToken sesi orang tua, BUKAN anonKey!
      const evalCall = fetchHistory.find(f => f.url.includes('/rest/v1/academy_evaluations'));
      assert.ok(evalCall, 'Call to academy_evaluations must occur');
      assert.strictEqual(
        evalCall.options.headers.Authorization,
        'Bearer parent_access_token_secret_123',
        'Authorization header must use parent accessToken'
      );
      assert.strictEqual(evalCall.options.headers.apikey, mockAnonKey);
      assert.notStrictEqual(
        evalCall.options.headers.Authorization,
        `Bearer ${mockAnonKey}`,
        'CRITICAL: Authorization header must NEVER be Bearer anonKey'
      );
    } finally {
      resetFetch();
    }
  });

  await t.test('6. Sanitasi log: Tidak ada kebocoran token, PII, atau exception mentah pada log saat terjadi error', async () => {
    interceptConsoleError();
    const sensitiveToken = 'sensitive_parent_token_do_not_leak_999';

    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'auth_parent_uuid_789' }, status: 200 },
      { 
        pattern: '/rest/v1/academy_evaluations', 
        method: 'GET', 
        body: () => {
          throw new Error(`Database connection failed with sensitive token=${sensitiveToken}`);
        }, 
        status: 500 
      }
    ]);

    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupValidSession(ctx.env);

      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({
          studentId: '11111111-1111-1111-1111-111111111111',
          tenantId: 'tenant_academy_1'
        })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Terjadi kesalahan internal pada server.');

      const respString = JSON.stringify(data);
      assert.ok(!respString.includes(sensitiveToken), 'Response must not contain sensitive token');
      assert.ok(!respString.includes('Database connection failed'), 'Response must not leak raw exception');

      assert.ok(consoleErrors.length > 0, 'Console error must be logged');
      for (const log of consoleErrors) {
        assert.ok(!log.includes(sensitiveToken), 'Log must not contain sensitive token');
        assert.ok(!log.includes('Database connection failed'), 'Log must not contain raw exception message');
        assert.strictEqual(log, '[evaluations.js] Error processing athlete evaluations.', 'Log must use static sanitized message');
      }
    } finally {
      restoreConsoleError();
      resetFetch();
    }
  });
});
