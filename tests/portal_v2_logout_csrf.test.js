import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPortalV2Session,
  validatePortalV2Session,
  revokePortalV2Session,
  buildV2SessionCookie,
  buildClearV2SessionCookie,
  hashString
} from '../functions/api/portal/_auth_v2.js';
import { verifyCsrf, getCorsHeaders } from '../functions/api/portal/_auth.js';
import { onRequestPost as handleLogout } from '../functions/api/portal/v2/logout.js';
import { onRequestGet as handleGetSession } from '../functions/api/portal/v2/session.js';

// Mock Cloudflare KV Namespace
class MockKV {
  constructor(initialData = {}) {
    this.store = new Map(Object.entries(initialData));
    this.putCalls = [];
    this.getCalls = [];
    this.deleteCalls = [];
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
    this.deleteCalls.push(key);
    this.store.delete(key);
  }
}

const TEST_SECRET = 'chuvator_portal_token_encryption_secret_production_2026';
const ORIGIN = 'https://portal.chuvator.com';

test('Parent Portal V2 Logout & CSRF Header Mismatch Validation Matrix', async (t) => {
  const kv = new MockKV();
  const env = {
    PORTAL_SESSIONS_KV: kv,
    PORTAL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
    ENVIRONMENT: 'production',
    ALLOWED_ORIGINS: ORIGIN
  };

  // 1. Setup Active Session (simulating successful login & CSRF token issuance)
  const sessionInit = await createPortalV2Session({ env }, {
    authUserId: 'parent-uuid-001',
    email: 'wali.test@chuvator.com',
    accessibleTenants: ['tenant-1'],
    childrenSummary: [
      { studentId: 'student-101', studentName: 'Budi Pratama', academyName: 'Chuvator Arena' }
    ],
    accessToken: 'mock-sb-access-token',
    refreshToken: 'mock-sb-refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
  });

  const sessionToken = sessionInit.sessionToken;
  const activeCsrfToken = sessionInit.csrfToken;
  const sessionHash = sessionInit.sessionHash;

  assert.ok(sessionToken, 'Session token should be generated');
  assert.ok(activeCsrfToken, 'Active CSRF token should be generated');
  assert.equal(kv.store.has(`v2:${sessionHash}`), true, 'Session must be stored in KV with v2: prefix');

  // 2. Test Session Verification (GET /api/portal/v2/session) before logout
  const sessionReq = new Request(`${ORIGIN}/api/portal/v2/session`, {
    method: 'GET',
    headers: new Headers({
      'Cookie': `portal_session_v2=${sessionToken}`,
      'Origin': ORIGIN
    })
  });

  const sessionRes = await handleGetSession({ request: sessionReq, env });
  assert.equal(sessionRes.status, 200, 'Active session must return HTTP 200');
  const sessionData = await sessionRes.json();
  assert.equal(sessionData.authenticated, true, 'User must be authenticated');
  assert.equal(sessionData.session.csrfToken, activeCsrfToken, 'Session CSRF token must match active token');
  assert.equal(sessionData.session.email, 'wali.test@chuvator.com');

  // 3. Test Negative Case: Logout with old / incorrect header 'X-CSRF-Token' (Bug Scenario)
  const buggyLogoutReq = new Request(`${ORIGIN}/api/portal/v2/logout`, {
    method: 'POST',
    headers: new Headers({
      'Cookie': `portal_session_v2=${sessionToken}`,
      'Origin': ORIGIN,
      'x-csrf-token': activeCsrfToken // Old buggy header name!
    })
  });

  const buggyLogoutRes = await handleLogout({ request: buggyLogoutReq, env });
  assert.equal(buggyLogoutRes.status, 403, 'Logout with x-csrf-token must be rejected with HTTP 403 Forbidden');
  const buggyResData = await buggyLogoutRes.json();
  assert.match(buggyResData.message, /CSRF token atau Origin tidak valid/i);
  assert.equal(kv.store.has(`v2:${sessionHash}`), true, 'Session in KV must NOT be deleted when CSRF check fails');

  // 4. Test Negative Case: Logout with invalid CSRF token in 'X-Portal-CSRF'
  const invalidCsrfLogoutReq = new Request(`${ORIGIN}/api/portal/v2/logout`, {
    method: 'POST',
    headers: new Headers({
      'Cookie': `portal_session_v2=${sessionToken}`,
      'Origin': ORIGIN,
      'X-Portal-CSRF': 'invalid-or-stale-csrf-token'
    })
  });

  const invalidCsrfRes = await handleLogout({ request: invalidCsrfLogoutReq, env });
  assert.equal(invalidCsrfRes.status, 403, 'Logout with wrong token must be rejected with HTTP 403');
  assert.equal(kv.store.has(`v2:${sessionHash}`), true, 'Session in KV must remain intact');

  // 5. Test Positive Case: Logout with correct header 'X-Portal-CSRF' and active session token
  const validLogoutReq = new Request(`${ORIGIN}/api/portal/v2/logout`, {
    method: 'POST',
    headers: new Headers({
      'Cookie': `portal_session_v2=${sessionToken}`,
      'Origin': ORIGIN,
      'X-Portal-CSRF': activeCsrfToken // Correct header specified by backend!
    })
  });

  const validLogoutRes = await handleLogout({ request: validLogoutReq, env });
  assert.equal(validLogoutRes.status, 200, 'Logout with valid X-Portal-CSRF must succeed with HTTP 200');
  const validLogoutData = await validLogoutRes.json();
  assert.equal(validLogoutData.success, true);
  assert.equal(validLogoutData.message, 'Sesi portal berhasil diakhiri.');

  // 6. Verify Set-Cookie header clears 'portal_session_v2'
  const setCookie = validLogoutRes.headers.get('Set-Cookie');
  assert.ok(setCookie, 'Set-Cookie header must be present on logout');
  assert.match(setCookie, /portal_session_v2=/);
  assert.match(setCookie, /Max-Age=0/);
  assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);

  // 7. Verify KV Session was permanently purged
  assert.equal(kv.store.has(`v2:${sessionHash}`), false, 'Session in KV must be deleted on logout');
  assert.ok(kv.deleteCalls.includes(`v2:${sessionHash}`), 'KV delete call must be executed for session');

  // 8. Test Post-Logout Session Verification: Must return 401 unauthenticated
  const postLogoutSessionReq = new Request(`${ORIGIN}/api/portal/v2/session`, {
    method: 'GET',
    headers: new Headers({
      'Cookie': `portal_session_v2=${sessionToken}`, // Client attempting to reuse old cookie
      'Origin': ORIGIN
    })
  });

  const postLogoutSessionRes = await handleGetSession({ request: postLogoutSessionReq, env });
  assert.equal(postLogoutSessionRes.status, 401, 'Subsequent session call must return HTTP 401');
  const postLogoutData = await postLogoutSessionRes.json();
  assert.equal(postLogoutData.authenticated, false, 'Authentication status must be false');
});

test('CORS Headers verification for X-Portal-CSRF', async (t) => {
  const req = new Request('https://portal.chuvator.com/api/portal/v2/logout', {
    method: 'OPTIONS',
    headers: new Headers({
      'Origin': 'https://portal.chuvator.com',
      'Access-Control-Request-Headers': 'Content-Type, X-Portal-CSRF'
    })
  });

  const corsHeaders = getCorsHeaders(req, { ALLOWED_ORIGINS: 'https://portal.chuvator.com' });
  assert.ok(corsHeaders['Access-Control-Allow-Headers'], 'Access-Control-Allow-Headers must exist');
  assert.match(corsHeaders['Access-Control-Allow-Headers'], /X-Portal-CSRF/, 'X-Portal-CSRF must be allowed in CORS');
  assert.equal(corsHeaders['Access-Control-Allow-Credentials'], 'true');
});
