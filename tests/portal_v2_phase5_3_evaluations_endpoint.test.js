import { test, describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/portal/evaluations.js';

/**
 * CHUVATOR Parent Portal V2 — Phase 5.3-B.4
 * REAL ENDPOINT TEST AUDIT
 * Reconciled for Supabase/PostgreSQL source and V2.6.10 Security Hardening.
 */

describe('Evaluations API Endpoint — Real Logic Test Audit (Supabase)', () => {
  let originalFetch;
  let originalImportKey;
  let originalSign;
  let originalDecrypt;
  let originalDigest;

  const mockEnv = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    ALLOWED_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'development',
    PORTAL_TOKEN_ENCRYPTION_SECRET: 'test-secret-long-enough-32-chars-!!!'
  };

  const VALID_CHILD_1_UUID = '11111111-1111-1111-1111-111111111111';
  const VALID_CHILD_2_UUID = '22222222-2222-2222-2222-222222222222';
  const STRANGER_CHILD_UUID = '99999999-9999-9999-9999-999999999999';

  before(() => {
    originalFetch = globalThis.fetch;
    originalImportKey = globalThis.crypto.subtle.importKey;
    originalSign = globalThis.crypto.subtle.sign;
    originalDecrypt = globalThis.crypto.subtle.decrypt;
    originalDigest = globalThis.crypto.subtle.digest;

    // Mock Crypto for Session Decryption
    globalThis.crypto.subtle.importKey = async () => ({});
    globalThis.crypto.subtle.sign = async () => new Uint8Array(32);
    globalThis.crypto.subtle.decrypt = async () => new TextEncoder().encode('mock-decrypted-supabase-token');
    globalThis.crypto.subtle.digest = async () => new Uint8Array(32);
  });

  after(() => {
    globalThis.fetch = originalFetch;
    globalThis.crypto.subtle.importKey = originalImportKey;
    globalThis.crypto.subtle.sign = originalSign;
    globalThis.crypto.subtle.decrypt = originalDecrypt;
    globalThis.crypto.subtle.digest = originalDigest;
  });

  const setupEnvironment = (sessionRecord, supabaseResponses) => {
    mockEnv.PORTAL_SESSIONS_KV = {
      get: async () => JSON.stringify(sessionRecord)
    };

    let callCount = 0;
    globalThis.fetch = async (url) => {
      // Supabase Auth check (validatePortalV2Session calls /auth/v1/user)
      if (url.includes('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: 'user-123' }) };
      }
      
      const response = supabaseResponses[callCount] || supabaseResponses[supabaseResponses.length - 1];
      callCount++;
      
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        text: async () => JSON.stringify(response.body),
        json: async () => response.body
      };
    };
  };

  const headerMap = (csrf = 'mock-csrf') => new Map([
    ['Origin', 'http://localhost:3000'],
    ['Cookie', 'portal_session_v2=token'],
    ['X-Portal-CSRF', csrf],
    ['Content-Type', 'application/json']
  ]);

  const createMockContext = (studentId, csrf = 'mock-csrf') => {
    const headers = headerMap(csrf);
    return {
      request: {
        method: 'POST',
        headers: { get: (n) => headers.get(n) },
        json: async () => ({ studentId }),
        url: 'http://localhost:3000/api/portal/evaluations'
      },
      env: mockEnv
    };
  };

  it('Verified Audit 1: Supabase Source & Publication Filter', async () => {
    const mockSessionRecord = {
      version: 'v2',
      csrfToken: 'mock-csrf',
      authUserId: 'user-123',
      accessibleTenants: ['tenant-01'],
      childrenSummary: [{ studentId: VALID_CHILD_1_UUID, tenantId: 'tenant-01' }],
      encryptedAccessToken: 'iv:cipher',
      encryptedRefreshToken: 'iv:cipher',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: false
    };

    const supabaseEvaluations = [
      { id: 'eval-01', student_id: VALID_CHILD_1_UUID, tenant_id: 'tenant-01', status: 'published', overall_score: 85 },
      { id: 'eval-02', student_id: VALID_CHILD_1_UUID, tenant_id: 'tenant-01', status: 'approved', overall_score: 80 },
      { id: 'eval-03', student_id: VALID_CHILD_1_UUID, tenant_id: 'tenant-01', status: 'draft', overall_score: 90 }, // Filtered
      { id: 'eval-04', student_id: VALID_CHILD_1_UUID, tenant_id: 'tenant-01', overall_score: 75 } // No status -> Allowed for now
    ];

    setupEnvironment(mockSessionRecord, [
      { status: 200, body: supabaseEvaluations },
      { status: 200, body: [{ id: VALID_CHILD_1_UUID, tournaments: [] }] } // Student achievements query
    ]);

    const response = await onRequestPost(createMockContext(VALID_CHILD_1_UUID));
    const result = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.evaluations.length, 3, 'Draft should be filtered out, records with no status allowed');
    assert.ok(result.evaluations.some(ev => ev.id === 'eval-04'));
  });

  it('Verified Audit 2: Truth-In-Data Integrity (No Fabrication)', async () => {
    const mockSessionRecord = {
      version: 'v2',
      csrfToken: 'mock-csrf',
      authUserId: 'user-123',
      accessibleTenants: ['tenant-01'],
      childrenSummary: [{ studentId: VALID_CHILD_1_UUID, tenantId: 'tenant-01' }],
      encryptedAccessToken: 'iv:cipher',
      encryptedRefreshToken: 'iv:cipher',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: false
    };

    const supabaseEvaluations = [
      { 
        id: 'eval-01', 
        student_id: VALID_CHILD_1_UUID, 
        tenant_id: 'tenant-01', 
        status: 'published',
        pillar_scores: { teknik: 90 } // other pillars missing
      }
    ];

    setupEnvironment(mockSessionRecord, [
      { status: 200, body: supabaseEvaluations },
      { status: 200, body: [] }
    ]);

    const response = await onRequestPost(createMockContext(VALID_CHILD_1_UUID));
    const result = await response.json();

    const ev = result.evaluations[0];
    assert.strictEqual(ev.pillarScores.teknik, 90);
    assert.strictEqual(ev.pillarScores.fisik, null, 'Unrecorded score must be null, not 75');
    assert.strictEqual(ev.overallScore, null, 'Unrecorded overall score must be null');
  });

  it('Verified Audit 3: Multi-Child & Tenant Isolation', async () => {
    const mockSessionRecord = {
      version: 'v2',
      csrfToken: 'mock-csrf',
      authUserId: 'user-123',
      accessibleTenants: ['tenant-01', 'tenant-02'],
      childrenSummary: [
        { studentId: VALID_CHILD_1_UUID, tenantId: 'tenant-01' },
        { studentId: VALID_CHILD_2_UUID, tenantId: 'tenant-02' }
      ],
      encryptedAccessToken: 'iv:cipher',
      encryptedRefreshToken: 'iv:cipher',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: false
    };

    // Scenario: Trying to access data for an unauthorized student
    setupEnvironment(mockSessionRecord, []);

    const response = await onRequestPost(createMockContext(STRANGER_CHILD_UUID));
    const result = await response.json();

    assert.strictEqual(response.status, 403);
    assert.match(result.message, /tidak memiliki otorisasi/);
  });

  it('Verified Audit 4: Achievement Integrity', async () => {
    const mockSessionRecord = {
      version: 'v2',
      csrfToken: 'mock-csrf',
      authUserId: 'user-123',
      accessibleTenants: ['tenant-01'],
      childrenSummary: [{ studentId: VALID_CHILD_1_UUID, tenantId: 'tenant-01' }],
      encryptedAccessToken: 'iv:cipher',
      encryptedRefreshToken: 'iv:cipher',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: false
    };

    const studentData = [
      { 
        id: VALID_CHILD_1_UUID,
        tournaments: [
          { name: 'Juara 1', result: 'Emas', status: 'published' },
          { name: 'Latihan', result: 'Peserta', status: 'draft' } // Should be filtered
        ]
      }
    ];

    setupEnvironment(mockSessionRecord, [
      { status: 200, body: [] }, // No evaluations
      { status: 200, body: studentData }
    ]);

    const response = await onRequestPost(createMockContext(VALID_CHILD_1_UUID));
    const result = await response.json();

    assert.strictEqual(result.achievements.length, 1);
    assert.strictEqual(result.achievements[0].name, 'Juara 1');
  });

  it('Verified Audit 5: Supabase Failure Handling (Fail-Closed)', async () => {
    const mockSessionRecord = {
      version: 'v2',
      csrfToken: 'mock-csrf',
      authUserId: 'user-123',
      accessibleTenants: ['tenant-01'],
      childrenSummary: [{ studentId: VALID_CHILD_1_UUID, tenantId: 'tenant-01' }],
      encryptedAccessToken: 'iv:cipher',
      encryptedRefreshToken: 'iv:cipher',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: false
    };

    setupEnvironment(mockSessionRecord, [
      { status: 500, body: { message: 'Database Error' } }
    ]);

    const response = await onRequestPost(createMockContext(VALID_CHILD_1_UUID));
    const result = await response.json();

    assert.strictEqual(response.status, 502);
    assert.strictEqual(result.success, false);
    assert.match(result.message, /terjadi gangguan/i);
  });
});
