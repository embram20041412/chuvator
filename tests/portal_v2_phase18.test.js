import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidIp,
  isValidIpv4,
  isValidIpv6,
  getTrustedClientIp,
  checkV2RateLimit,
  recordV2FailedLogin,
  supabaseSignInWithPassword,
  hashString
} from '../functions/api/portal/_auth_v2.js';
import { onRequestPost } from '../functions/api/portal/v2/login.js';

// Helper mock KV class simulating Cloudflare KV Namespace
class MockKV {
  constructor(initialData = {}) {
    this.store = new Map(Object.entries(initialData));
    this.putCalls = [];
    this.getCalls = [];
  }

  async get(key) {
    this.getCalls.push(key);
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value, options = {}) {
    this.putCalls.push({ key, value, options });
    this.store.set(key, String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }
}

// Helper to create mock login request
function createMockLoginRequest({
  ip = '203.0.113.195',
  email = 'parent@example.com',
  password = 'secretPassword123',
  origin = 'https://portal.chuvator.com'
} = {}) {
  const headers = new Headers();
  if (ip !== null) {
    headers.set('cf-connecting-ip', ip);
  }
  headers.set('origin', origin);
  headers.set('content-type', 'application/json');

  return new Request('https://portal.chuvator.com/api/portal/v2/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password })
  });
}

const TEST_SECRET = 'chuvator_super_secure_random_portal_encryption_secret_2026';

// ============================================================================
// SKENARIO 10: MATRIKS PENGUJIAN IPv4 DAN IPv6 LENGKAP
// ============================================================================
test('Skenario 10: Matriks pengujian deterministik IPv4 dan IPv6 lengkap', async (t) => {
  // 1. Standard IPv4
  assert.equal(isValidIp('192.168.1.1'), true, 'Standard IPv4 192.168.1.1 should be valid');
  assert.equal(isValidIp('10.0.0.1'), true, 'Standard IPv4 10.0.0.1 should be valid');
  assert.equal(isValidIp('172.16.254.1'), true, 'Standard IPv4 172.16.254.1 should be valid');

  // 2. Boundary IPv4
  assert.equal(isValidIp('0.0.0.0'), true, 'Boundary IPv4 0.0.0.0 should be valid');
  assert.equal(isValidIp('255.255.255.255'), true, 'Boundary IPv4 255.255.255.255 should be valid');

  // 3. Leading zeros IPv4 (strictly rejected per RFC 791 / security standards)
  assert.equal(isValidIp('010.0.0.1'), false, 'IPv4 with leading zeros 010.0.0.1 must be rejected');
  assert.equal(isValidIp('192.168.01.1'), false, 'IPv4 with leading zeros 192.168.01.1 must be rejected');
  assert.equal(isValidIp('192.168.1.00'), false, 'IPv4 with leading zeros 192.168.1.00 must be rejected');

  // 4. Octet > 255 (rejected)
  assert.equal(isValidIp('256.1.1.1'), false, 'IPv4 octet > 255 must be rejected');
  assert.equal(isValidIp('192.168.1.300'), false, 'IPv4 octet 300 must be rejected');
  assert.equal(isValidIp('999.999.999.999'), false, 'IPv4 octets 999 must be rejected');

  // 5. Octet count != 4 (rejected)
  assert.equal(isValidIp('192.168.1'), false, 'IPv4 with 3 octets must be rejected');
  assert.equal(isValidIp('192.168.1.1.1'), false, 'IPv4 with 5 octets must be rejected');
  assert.equal(isValidIp('192.168'), false, 'IPv4 with 2 octets must be rejected');

  // 6. Karakter ekstra / port pada IPv4 (rejected)
  assert.equal(isValidIp('192.168.1.1:80'), false, 'IPv4 with port :80 must be rejected');
  assert.equal(isValidIp('192.168.1.1:443'), false, 'IPv4 with port :443 must be rejected');
  assert.equal(isValidIp('192.168.1.1abc'), false, 'IPv4 with trailing letters must be rejected');
  assert.equal(isValidIp('192.168.1.1/24'), false, 'IPv4 with CIDR slash must be rejected');

  // 7. Whitespace dan string kosong (rejected)
  assert.equal(isValidIp(''), false, 'Empty string must be rejected');
  assert.equal(isValidIp('   '), false, 'Whitespace-only string must be rejected');
  assert.equal(isValidIp(' 192.168.1.1 '), false, 'IP with leading/trailing spaces must be rejected by isValidIp');
  assert.equal(isValidIp('192. 168.1.1'), false, 'IP with internal space must be rejected');

  // 8. Full IPv6
  assert.equal(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true, 'Full 8-hextet IPv6 must be valid');
  assert.equal(isValidIp('fe80:0000:0000:0000:0204:61ff:fe9d:f156'), true, 'Full IPv6 with zeros must be valid');

  // 9. Compressed IPv6 (::)
  assert.equal(isValidIp('2001:db8::1'), true, 'Compressed IPv6 2001:db8::1 must be valid');
  assert.equal(isValidIp('2001:db8:85a3::8a2e:370:7334'), true, 'Compressed IPv6 with multiple sections must be valid');
  assert.equal(isValidIp('fe80::1'), true, 'Compressed link-local IPv6 must be valid');

  // 10. IPv6 loopback (::1)
  assert.equal(isValidIp('::1'), true, 'IPv6 loopback ::1 must be valid');

  // 11. IPv6 unspecified (::)
  assert.equal(isValidIp('::'), true, 'IPv6 unspecified :: must be valid');

  // 12. IPv4-mapped IPv6 (::ffff:192.0.2.128)
  assert.equal(isValidIp('::ffff:192.0.2.128'), true, 'IPv4-mapped IPv6 ::ffff:192.0.2.128 must be valid');
  assert.equal(isValidIp('::ffff:0:192.0.2.128'), true, 'IPv4-mapped IPv6 ::ffff:0:192.0.2.128 must be valid');

  // 13. IPv4-embedded IPv6 (2001:db8::192.0.2.128)
  assert.equal(isValidIp('2001:db8::192.0.2.128'), true, 'IPv4-embedded IPv6 must be valid');
  assert.equal(isValidIp('64:ff9b::192.0.2.33'), true, 'IPv4-embedded IPv6 (NAT64) must be valid');

  // 14. Excessive hextets (rejected)
  assert.equal(isValidIp('2001:db8:1:2:3:4:5:6:7'), false, 'IPv6 with 9 hextets must be rejected');
  assert.equal(isValidIp('1:2:3:4:5:6:7:8:9'), false, 'IPv6 with 9 hextets must be rejected');

  // 15. Double :: (rejected)
  assert.equal(isValidIp('2001::db8::1'), false, 'IPv6 with double :: must be rejected');
  assert.equal(isValidIp('::1::1'), false, 'IPv6 with double :: must be rejected');

  // 16. Empty atau >4-char hextet (rejected)
  assert.equal(isValidIp('2001:00db8::1'), false, 'IPv6 with 5-char hextet must be rejected');
  assert.equal(isValidIp('2001:::1'), false, 'IPv6 with triple colon must be rejected');
  assert.equal(isValidIp(':2001:db8::1'), false, 'IPv6 with single leading colon must be rejected');
  assert.equal(isValidIp('2001:db8::1:'), false, 'IPv6 with single trailing colon must be rejected');

  // 17. Illegal characters (rejected)
  assert.equal(isValidIp('::g123'), false, 'IPv6 with non-hex g character must be rejected');
  assert.equal(isValidIp('2001:db8::z'), false, 'IPv6 with non-hex z character must be rejected');
  assert.equal(isValidIp('2001:db8::1#'), false, 'IPv6 with hash symbol must be rejected');

  // 18. Zone identifier rejection (fe80::1%eth0)
  assert.equal(isValidIp('fe80::1%eth0'), false, 'IPv6 with zone identifier %eth0 must be rejected');
  assert.equal(isValidIp('fe80::1%1'), false, 'IPv6 with numeric zone identifier %1 must be rejected');
});

// ============================================================================
// SKENARIO 1: PASSWORD SALAH MENAMBAH COUNTER EMAIL
// ============================================================================
test('Skenario 1: Password salah menambah counter email failure', async (t) => {
  const kv = new MockKV();
  const originalFetch = globalThis.fetch;

  // Mock fetch to simulate Supabase returning 400 invalid_grant
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/token')) {
      return new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const context = {
      request: createMockLoginRequest({ email: 'wali@example.com', password: 'wrongPassword' }),
      env: {
        PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PORTAL_SESSIONS_KV: kv,
        ENVIRONMENT: 'development'
      }
    };

    const res = await onRequestPost(context);
    assert.equal(res.status, 401, 'Invalid credentials should return HTTP 401');

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Email atau kata sandi tidak sesuai.');

    // Verify email counter in KV was written
    const emailHash = await hashString(`v2_email_wali@example.com_${TEST_SECRET}`);
    const emailKey = `v2_ratelimit:email_failed:${emailHash}`;
    const storedVal = await kv.get(emailKey);
    assert.equal(storedVal, '1', 'Email failure counter should be incremented to 1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// SKENARIO 2: HTTP 500/503 DARI SUPABASE TIDAK MENAMBAH COUNTER EMAIL
// ============================================================================
test('Skenario 2: HTTP 500/503 dari Supabase TIDAK menambah counter email', async (t) => {
  const kv = new MockKV();
  const originalFetch = globalThis.fetch;

  // Test with HTTP 500
  globalThis.fetch = async (url) => {
    return new Response(
      JSON.stringify({ message: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const context = {
      request: createMockLoginRequest({ email: 'wali2@example.com', password: 'anyPassword' }),
      env: {
        PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PORTAL_SESSIONS_KV: kv,
        ENVIRONMENT: 'development'
      }
    };

    const res = await onRequestPost(context);
    assert.equal(res.status, 500, 'Upstream 500 must return HTTP 500');

    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /gangguan|bermasalah/i);

    // Verify email counter was NOT touched in KV
    const emailHash = await hashString(`v2_email_wali2@example.com_${TEST_SECRET}`);
    const emailKey = `v2_ratelimit:email_failed:${emailHash}`;
    const storedVal = await kv.get(emailKey);
    assert.equal(storedVal, null, 'Email failure counter must NOT be created on upstream 500 error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// SKENARIO 3: NETWORK ERROR / FETCH EXCEPTION TIDAK MENAMBAH COUNTER EMAIL
// ============================================================================
test('Skenario 3: Network error/fetch exception TIDAK menambah counter email', async (t) => {
  const kv = new MockKV();
  const originalFetch = globalThis.fetch;

  // Mock fetch throwing network exception
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch: Connection timeout / DNS failure');
  };

  try {
    const context = {
      request: createMockLoginRequest({ email: 'wali3@example.com', password: 'anyPassword' }),
      env: {
        PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PORTAL_SESSIONS_KV: kv,
        ENVIRONMENT: 'development'
      }
    };

    const res = await onRequestPost(context);
    assert.equal(res.status, 503, 'Network fetch exception must return HTTP 503');

    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /gangguan/i);

    // Verify email counter was NOT created or incremented
    const emailHash = await hashString(`v2_email_wali3@example.com_${TEST_SECRET}`);
    const emailKey = `v2_ratelimit:email_failed:${emailHash}`;
    const storedVal = await kv.get(emailKey);
    assert.equal(storedVal, null, 'Email failure counter must NOT be created on network error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// SKENARIO 4: COUNTER EMAIL TINGGI TIDAK MEMBLOKIR LOGIN DENGAN PASSWORD BENAR
// ============================================================================
test('Skenario 4: Counter email tinggi tidak memblokir login dengan password benar', async (t) => {
  const email = 'victim_parent@example.com';
  const emailHash = await hashString(`v2_email_${email}_${TEST_SECRET}`);
  const emailKey = `v2_ratelimit:email_failed:${emailHash}`;

  // Pre-seed KV with high email failure counter (e.g. 50 attempts by an attacker)
  const kv = new MockKV({
    [emailKey]: '50'
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'valid-test-access-token',
          refresh_token: 'valid-test-refresh-token',
          expires_in: 3600,
          user: { id: 'auth-user-uuid-123' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('/rest/v1/rpc/parent_get_children')) {
      return new Response(
        JSON.stringify([
          {
            student_id: 'student-uuid-456',
            student_name: 'Budi Santoso',
            tenant_id: 'tenant-demo',
            academy_name: 'Chuvator Tennis Academy',
            class_name: 'Beginner Junior'
          }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const context = {
      request: createMockLoginRequest({ email, password: 'correctPassword123' }),
      env: {
        PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PORTAL_SESSIONS_KV: kv,
        ENVIRONMENT: 'development'
      }
    };

    const res = await onRequestPost(context);
    assert.equal(res.status, 200, 'Legitimate login must succeed even with counter email = 50');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.user.email, email);
    assert.equal(body.user.children.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// SKENARIO 5: LOGIN SUKSES TIDAK MERESET COUNTER IP
// ============================================================================
test('Skenario 5: Login sukses tidak mereset counter IP', async (t) => {
  const ip = '198.51.100.42';
  const hashedIp = await hashString(`v2_ip_${ip}_${TEST_SECRET}`);
  const ipKey = `v2_ratelimit:ip:${hashedIp}`;

  // Pre-seed KV with IP counter at 5
  const kv = new MockKV({
    [ipKey]: '5'
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'valid-test-access-token',
          refresh_token: 'valid-test-refresh-token',
          expires_in: 3600,
          user: { id: 'auth-user-uuid-123' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('/rest/v1/rpc/parent_get_children')) {
      return new Response(
        JSON.stringify([
          {
            student_id: 'student-uuid-456',
            student_name: 'Ananda',
            tenant_id: 'tenant-demo'
          }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const context = {
      request: createMockLoginRequest({ ip, email: 'parent5@example.com', password: 'correctPassword' }),
      env: {
        PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PORTAL_SESSIONS_KV: kv,
        ENVIRONMENT: 'development'
      }
    };

    const res = await onRequestPost(context);
    assert.equal(res.status, 200, 'Login should succeed');

    // Check IP counter in KV - must be incremented to 6, NOT reset or deleted
    const finalIpCount = await kv.get(ipKey);
    assert.equal(finalIpCount, '6', 'IP counter must be 6 after success; it is never reset by successful login');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// SKENARIO 6: REQUEST KE-31 DARI IP YANG SAMA DITOLAK (HTTP 429)
// ============================================================================
test('Skenario 6: Request ke-31 dari IP yang sama ditolak (HTTP 429)', async (t) => {
  const ip = '198.51.100.99';
  const hashedIp = await hashString(`v2_ip_${ip}_${TEST_SECRET}`);
  const ipKey = `v2_ratelimit:ip:${hashedIp}`;

  // Pre-seed KV with IP counter at 30 (limit reached)
  const kv = new MockKV({
    [ipKey]: '30'
  });

  let authCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    authCalled = true;
    return new Response('{}', { status: 200 });
  };

  try {
    const context = {
      request: createMockLoginRequest({ ip, email: 'user@example.com', password: 'pwd' }),
      env: {
        PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PORTAL_SESSIONS_KV: kv,
        ENVIRONMENT: 'development'
      }
    };

    const res = await onRequestPost(context);
    assert.equal(res.status, 429, 'Attempt 31 from the same IP must be rejected with HTTP 429');
    assert.equal(authCalled, false, 'Supabase Auth must NOT be called when IP rate limit is exceeded');

    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Terlalu banyak percobaan login/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// SKENARIO 7: KV ERROR FAIL-CLOSED
// ============================================================================
test('Skenario 7: KV error fail-closed', async (t) => {
  // Mock KV where .get throws an unhandled error
  const brokenKv = {
    async get() {
      throw new Error('KV Service Unavailable');
    },
    async put() {
      throw new Error('KV Service Unavailable');
    }
  };

  const context = {
    env: {
      PORTAL_SESSIONS_KV: brokenKv,
      ENVIRONMENT: 'production'
    }
  };

  const result = await checkV2RateLimit(context, 'v2_ratelimit:test', 30, 900);
  assert.equal(result.allowed, false, 'Rate limit must fail closed (allowed: false) on KV error');
  assert.equal(result.error, true, 'Error flag must be set on KV error');
});

// ============================================================================
// SKENARIO 8: TIDAK ADA FALLBACK KE MAP DI PRODUCTION
// ============================================================================
test('Skenario 8: Tidak ada fallback ke Map di production', async (t) => {
  // Clear any global mock map
  delete globalThis.__chuvator_v2_ratelimits;

  const context = {
    env: {
      PORTAL_SESSIONS_KV: null,
      PORTAL_RATELIMIT_KV: null,
      ENVIRONMENT: 'production' // STRICT PRODUCTION
    }
  };

  const result = await checkV2RateLimit(context, 'v2_ratelimit:prod_test', 30, 900);
  assert.equal(result.allowed, false, 'Production without KV must fail closed (allowed: false)');
  assert.equal(result.error, true, 'Error flag must be set');
  assert.equal(globalThis.__chuvator_v2_ratelimits, undefined, 'No memory map fallback allowed in production');
});

// ============================================================================
// SKENARIO 9: IP INVALID TIDAK BISA BYPASS RATE LIMIT (DITOLAK SEBELUM AUTH)
// ============================================================================
test('Skenario 9: IP invalid tidak bisa bypass rate limit (ditolak sebelum auth)', async (t) => {
  const invalidIps = [
    '010.0.0.1', // leading zero
    '192.168.1.1:80', // with port
    '256.0.0.1', // out of range
    'fe80::1%eth0', // zone ID
    'invalid-ip-string', // plain text
    '', // empty
    '2001::db8::1' // double ::
  ];

  for (const badIp of invalidIps) {
    let authCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      authCalled = true;
      return new Response('{}', { status: 200 });
    };

    try {
      const req = createMockLoginRequest({ ip: badIp });
      const context = {
        request: req,
        env: {
          PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_ANON_KEY: 'test-anon-key',
          PORTAL_SESSIONS_KV: new MockKV(),
          ENVIRONMENT: 'development'
        }
      };

      const res = await onRequestPost(context);
      assert.equal(res.status, 400, `Invalid IP '${badIp}' must be rejected with HTTP 400`);
      assert.equal(authCalled, false, `Auth must never be reached for invalid IP '${badIp}'`);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /Gagal memverifikasi identitas jaringan/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Also test when cf-connecting-ip header is completely missing
  let authCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    authCalled = true;
    return new Response('{}', { status: 200 });
  };

  try {
    const req = createMockLoginRequest({ ip: null });
    const context = {
      request: req,
      env: {
        PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PORTAL_SESSIONS_KV: new MockKV(),
        ENVIRONMENT: 'development'
      }
    };

    const res = await onRequestPost(context);
    assert.equal(res.status, 400, 'Missing cf-connecting-ip must return HTTP 400');
    assert.equal(authCalled, false, 'Auth must not be called when cf-connecting-ip is missing');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
