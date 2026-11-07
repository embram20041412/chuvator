import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as evaluationsHandler } from '../functions/api/portal/evaluations.js';

test('CHUVATOR — Parent Portal V2.6.10 Security Hardening: Evaluations Endpoint Strict Audit', async (t) => {
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
    csrfToken?: string | null;
    envOverrides?: any;
  }) => {
    const {
      method = 'POST',
      body,
      searchParams = {},
      cookie,
      csrfToken = 'valid_csrf_token_abc',
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
    if (csrfToken !== null && csrfToken !== undefined) {
      headers['X-Portal-CSRF'] = csrfToken;
    }

    const reqInit: RequestInit = {
      method,
      headers
    };
    if (method === 'POST' && body !== undefined) {
      reqInit.body = JSON.stringify(body);
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

  const VALID_STUDENT_UUID = '11111111-1111-1111-1111-111111111111';

  const setupSession = async (envObj: any, customProps: any = {}) => {
    const { hashString, encryptToken } = await import('../functions/api/portal/_auth_v2.js');
    const token = 'session_token_v2_6_10_xyz';
    const sessionHash = await hashString(token);
    const csrfToken = customProps.csrfToken !== undefined ? customProps.csrfToken : 'valid_csrf_token_abc';

    const encAccess = await encryptToken('parent_access_token_v2_6_10', envObj);
    const encRefresh = await encryptToken('parent_refresh_token_v2_6_10', envObj);

    const record = {
      version: 'v2',
      sessionHash,
      csrfToken,
      authUserId: 'parent_user_uuid_10',
      email: 'parent.v2610@example.com',
      accessibleTenants: customProps.accessibleTenants !== undefined ? customProps.accessibleTenants : ['tenant_alpha'],
      childrenSummary: customProps.childrenSummary !== undefined ? customProps.childrenSummary : [
        {
          studentId: VALID_STUDENT_UUID,
          studentName: 'Budi Hartono',
          tenantId: 'tenant_alpha',
          className: 'Kelas Taruna'
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

  // --- REGRESSION TEST SUITES V2.6.10 ---

  await t.test('A.1. CSRF token hilang: Request POST tanpa header X-Portal-CSRF ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 }
    ]);
    try {
      const ctx = createEvaluationContext({
        csrfToken: null // Header X-Portal-CSRF sengaja dihilangkan
      });
      const { token } = await setupSession(ctx.env);
      ctx.request.headers.set('Cookie', `portal_session_v2=${token}`);

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /CSRF token/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('A.2. Session CSRF kosong: Sesi server tidak memiliki csrfToken ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 }
    ]);
    try {
      const ctx = createEvaluationContext({
        csrfToken: 'some_request_csrf'
      });
      const { token } = await setupSession(ctx.env, { csrfToken: '' }); // Sesi server CSRF kosong
      ctx.request.headers.set('Cookie', `portal_session_v2=${token}`);

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /CSRF token sesi tidak tersedia/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('A.3. CSRF token palsu: Token header tidak cocok dengan token sesi ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 }
    ]);
    try {
      const ctx = createEvaluationContext({
        csrfToken: 'spoofed_csrf_attacker_token'
      });
      const { token } = await setupSession(ctx.env, { csrfToken: 'legitimate_secret_session_csrf' });
      ctx.request.headers.set('Cookie', `portal_session_v2=${token}`);

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /CSRF token atau origin tidak valid/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('B.1. accessibleTenants kosong: Sesi tanpa accessibleTenants ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 }
    ]);
    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupSession(ctx.env, { accessibleTenants: [] }); // Array kosong
      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({ studentId: VALID_STUDENT_UUID })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /tidak memiliki daftar tenant yang terotorisasi/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('B.2. tenantId anak kosong: Siswa tanpa tenantId valid ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 }
    ]);
    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupSession(ctx.env, {
        accessibleTenants: ['tenant_alpha'],
        childrenSummary: [
          {
            studentId: VALID_STUDENT_UUID,
            studentName: 'Anak Tanpa Tenant',
            tenantId: '', // Kosong
            className: 'Kelas Taruna'
          }
        ]
      });
      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({ studentId: VALID_STUDENT_UUID })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /Tenant siswa tidak valid atau kosong/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('B.3. Tenant anak tidak terdaftar dalam accessibleTenants ditolak dengan HTTP 403', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 }
    ]);
    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupSession(ctx.env, {
        accessibleTenants: ['tenant_alpha'],
        childrenSummary: [
          {
            studentId: VALID_STUDENT_UUID,
            studentName: 'Anak Tenant Asing',
            tenantId: 'tenant_unauthorized_xyz', // Tidak ada di accessibleTenants
            className: 'Kelas Taruna'
          }
        ]
      });
      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({ studentId: VALID_STUDENT_UUID })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /tidak terdaftar dalam tenant yang terotorisasi/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('C.1. studentId bukan UUID: Format studentId non-UUID ditolak dengan HTTP 400', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 }
    ]);
    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupSession(ctx.env);
      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({ studentId: 'invalid-student-id-not-uuid' })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Format studentId tidak valid/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('D.1. Student query gagal: Upstream Supabase /rest/v1/students mengembalikan HTTP 500 menghasilkan HTTP 502', async () => {
    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 },
      { pattern: '/rest/v1/academy_evaluations', method: 'GET', body: [], status: 200 },
      { pattern: '/rest/v1/students', method: 'GET', body: { error: 'Internal Database Failure' }, status: 500 }
    ]);

    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupSession(ctx.env);
      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({ studentId: VALID_STUDENT_UUID })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 502);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /gangguan pada layanan data siswa/i);
    } finally {
      resetFetch();
    }
  });

  await t.test('D.2. Sesi valid tetap berhasil: Memuat evaluasi, prestasi, dan identitas siswa dengan benar (HTTP 200)', async () => {
    const mockEvaluations = [
      {
        id: 'eval-v2610-01',
        student_id: VALID_STUDENT_UUID,
        tenant_id: 'tenant_alpha',
        status: 'published',
        overall_score: 92,
        pillar_scores: { teknik: 95, fisik: 90, mental: 90, taktik: 93 },
        coach_note: 'Performa konsisten di setiap babak',
        evaluator: 'Head Coach Marcus',
        created_at: '2026-11-05T08:00:00Z'
      }
    ];

    const mockStudent = [
      {
        id: VALID_STUDENT_UUID,
        student_name: 'Budi Hartono',
        class_name: 'Kelas Taruna',
        tournaments: [
          { name: 'Sirkuit Nasional U-15', result: 'Juara 1', status: 'published', year: '2026' }
        ]
      }
    ];

    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 },
      { pattern: '/rest/v1/academy_evaluations', method: 'GET', body: mockEvaluations, status: 200 },
      { pattern: '/rest/v1/students', method: 'GET', body: mockStudent, status: 200 }
    ]);

    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupSession(ctx.env);
      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({
          studentId: VALID_STUDENT_UUID,
          tenantId: 'tenant_alpha'
        })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.evaluations.length, 1);
      assert.strictEqual(data.evaluations[0].overallScore, 92);
      assert.strictEqual(data.latestEvaluation.evaluator, 'Head Coach Marcus');
      assert.strictEqual(data.achievements.length, 1);
      assert.strictEqual(data.achievements[0].name, 'Sirkuit Nasional U-15');
      assert.strictEqual(data.student.studentName, 'Budi Hartono');

      // Pastikan Authorization header menggunakan access token parent dan apikey anonKey
      const evalCall = fetchHistory.find(f => f.url.includes('/rest/v1/academy_evaluations'));
      assert.ok(evalCall, 'Panggilan academy_evaluations wajib ada');
      assert.strictEqual(evalCall.options.headers.Authorization, 'Bearer parent_access_token_v2_6_10');
      assert.strictEqual(evalCall.options.headers.apikey, mockAnonKey);
    } finally {
      resetFetch();
    }
  });

  await t.test('E.1. Tidak ada kebocoran token, PII, atau exception mentah pada log saat terjadi error', async () => {
    interceptConsoleError();
    const sensitivePayload = 'secret_supabase_token_999888';

    mockFetch([
      { pattern: '/auth/v1/user', method: 'GET', body: { id: 'parent_user_uuid_10' }, status: 200 },
      {
        pattern: '/rest/v1/academy_evaluations',
        method: 'GET',
        body: () => {
          throw new Error(`Fatal DB exception containing token=${sensitivePayload} and studentId=${VALID_STUDENT_UUID}`);
        },
        status: 500
      }
    ]);

    try {
      const ctx = createEvaluationContext({});
      const { token, csrfToken } = await setupSession(ctx.env);
      ctx.request = new Request('http://localhost/api/portal/evaluations', {
        method: 'POST',
        headers: {
          'Origin': appUrl,
          'Content-Type': 'application/json',
          'Cookie': `portal_session_v2=${token}`,
          'X-Portal-CSRF': csrfToken
        },
        body: JSON.stringify({ studentId: VALID_STUDENT_UUID })
      });

      const res = await evaluationsHandler(ctx);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Terjadi kesalahan internal pada server.');

      const responseText = JSON.stringify(data);
      assert.ok(!responseText.includes(sensitivePayload), 'Response tidak boleh memuat token sensitif');
      assert.ok(!responseText.includes('Fatal DB exception'), 'Response tidak boleh membocorkan exception mentah');

      assert.ok(consoleErrors.length > 0, 'Console error harus dicatat');
      for (const log of consoleErrors) {
        assert.ok(!log.includes(sensitivePayload), 'Log tidak boleh memuat token sensitif');
        assert.ok(!log.includes('Fatal DB exception'), 'Log tidak boleh memuat pesan exception');
        assert.ok(!log.includes(VALID_STUDENT_UUID), 'Log tidak boleh memuat studentId');
        assert.strictEqual(log, '[evaluations.js] Error processing athlete evaluations.', 'Log harus berupa pesan statis tersanitasi');
      }
    } finally {
      restoreConsoleError();
      resetFetch();
    }
  });
});
