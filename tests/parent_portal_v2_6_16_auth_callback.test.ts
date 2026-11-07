import { test } from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { initInvitationSessionCallback } from '../src/utils/portalAuthCallback.js';

test('CHUVATOR PARENT PORTAL V2.6.16 — AUTH CALLBACK SESSION DETECTION HARDENING SUITE', async (t) => {

  await t.test('1. Immediate session found via getSession()', async () => {
    let successCalled = false;
    let errorCalled = false;
    let capturedSession: any = null;
    let capturedUser: any = null;

    const mockSession = {
      access_token: 'token123',
      user: {
        id: 'u1',
        email: 'parent1@example.com',
        user_metadata: { role: 'parent' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: mockSession },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=token123&type=invite', search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: (session: any, user: any) => {
        successCalled = true;
        capturedSession = session;
        capturedUser = user;
      },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(successCalled, true, 'onSuccess must be called when getSession returns valid session');
    assert.strictEqual(errorCalled, false, 'onError must not be called when getSession returns valid session');
    assert.strictEqual(capturedSession, mockSession);
    assert.strictEqual(capturedUser, mockSession.user);
    assert.strictEqual(sessionReceivedRef.current, true, 'sessionReceivedRef must be true');

    cleanup();
  });

  await t.test('2. Session received asynchronously via onAuthStateChange (SIGNED_IN / PASSWORD_RECOVERY)', async () => {
    let successCalled = false;
    let errorCalled = false;
    let authListener: any = null;

    const mockSession = {
      access_token: 'token456',
      user: {
        id: 'u2',
        email: 'parent2@example.com',
        user_metadata: { role: 'parent' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: (cb: any) => {
          authListener = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: async () => ({
          data: { session: null },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=token456&type=recovery', search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    // Simulate async auth state change arriving after getSession returned null
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(successCalled, false, 'Not called yet before onAuthStateChange triggers');
    assert.strictEqual(errorCalled, false, 'Should not time out prematurely while processing URL tokens');

    // Trigger onAuthStateChange event 'PASSWORD_RECOVERY'
    authListener('PASSWORD_RECOVERY', mockSession);

    assert.strictEqual(successCalled, true, 'onSuccess must be called when onAuthStateChange fires with session');
    assert.strictEqual(errorCalled, false, 'onError must not be called');
    assert.strictEqual(sessionReceivedRef.current, true);

    cleanup();
  });

  await t.test('3. Real 2500 ms delayed session initialization before 5000 ms timeout', async () => {
    let successCalled = false;
    let errorCalled = false;
    let authListener: any = null;

    const mockSession = {
      access_token: 'delayed_token_789',
      user: {
        id: 'u3',
        email: 'delayed_parent@example.com',
        user_metadata: { role: 'parent' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: (cb: any) => {
          authListener = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: async () => ({
          data: { session: null },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '', search: '?code=pkce_code_789&type=invite' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    // Wait full 2500 ms
    await new Promise(r => setTimeout(r, 2500));

    // Strict assertions during 2500 ms waiting window
    assert.strictEqual(errorCalled, false, 'onError MUST NOT be called before 2500 ms delay');
    assert.strictEqual(successCalled, false, 'onSuccess not called yet before session triggers');
    assert.ok(timeoutRef.current !== null, 'Timer must still be active during 2500 ms delay');

    // Fire authListener now after 2500 ms
    authListener('SIGNED_IN', mockSession);

    assert.strictEqual(successCalled, true, 'onSuccess called when delayed session completes after 2500 ms');
    assert.strictEqual(errorCalled, false, 'onError MUST NOT be called for delayed session');
    assert.strictEqual(sessionReceivedRef.current, true);
    assert.strictEqual(timeoutRef.current, null, 'Timer MUST be cleared when session succeeds');

    cleanup();
  });

  await t.test('4. Recovery callback flow with parent role (type=recovery in hash)', async () => {
    let successCalled = false;
    let errorCalled = false;

    const mockSession = {
      access_token: 'token_rec_123',
      user: {
        id: 'u4',
        email: 'recovery_parent@example.com',
        app_metadata: { role: 'parent' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: mockSession },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=token_rec&type=recovery', search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(successCalled, true, 'Recovery callback for parent role must succeed');
    assert.strictEqual(errorCalled, false);

    cleanup();
  });

  await t.test('5. Invite callback flow with parent role (type=invite in query)', async () => {
    let successCalled = false;
    let errorCalled = false;

    const mockSession = {
      access_token: 'token_inv_123',
      user: {
        id: 'u5',
        email: 'invite_parent@example.com',
        user_metadata: { role: 'parent' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: mockSession },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '', search: '?code=invite_code_123&type=invite' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(successCalled, true, 'Invite callback for parent role must succeed');
    assert.strictEqual(errorCalled, false);

    cleanup();
  });

  await t.test('6. Expired token / No URL token / Session timeout', async () => {
    let errorCalled = false;
    let errorMsg = '';

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: null },
          error: null
        })
      }
    };

    // Case 6a: Direct navigation without URL token -> immediate error
    const noTokenLocation: any = { hash: '', search: '' };
    const sessionReceivedRef1 = { current: false };
    const processedSessionKeyRef1 = { current: null };
    const timeoutRef1 = { current: null };

    const { cleanup: cleanup1 } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: noTokenLocation,
      onSuccess: () => {},
      onError: (msg: string) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 5000,
      sessionReceivedRef: sessionReceivedRef1,
      processedSessionKeyRef: processedSessionKeyRef1,
      timeoutRef: timeoutRef1
    });

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(errorCalled, true, 'Direct navigation without token should fail immediately');
    assert.ok(errorMsg.includes('kedaluwarsa'), 'Error message must mention link expiration');
    cleanup1();

    // Case 6b: URL token present but session never arrives before timeout
    errorCalled = false;
    errorMsg = '';
    const tokenLocation: any = { hash: '#access_token=expired_token', search: '' };
    const sessionReceivedRef2 = { current: false };
    const processedSessionKeyRef2 = { current: null };
    const timeoutRef2 = { current: null };

    const { cleanup: cleanup2 } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: tokenLocation,
      onSuccess: () => {},
      onError: (msg: string) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 100, // Short timeout for test
      sessionReceivedRef: sessionReceivedRef2,
      processedSessionKeyRef: processedSessionKeyRef2,
      timeoutRef: timeoutRef2
    });

    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(errorCalled, true, 'Should trigger onError when timeout expires without session');
    assert.ok(errorMsg.includes('kedaluwarsa'));
    cleanup2();
  });

  await t.test('7. Non-parent user role is rejected with access denied', async () => {
    let errorCalled = false;
    let errorMsg = '';

    const mockStaffSession = {
      access_token: 'staff_token_123',
      user: {
        id: 'staff1',
        email: 'staff@example.com',
        user_metadata: { role: 'staff' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({
          data: { session: mockStaffSession },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=staff_token', search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => {},
      onError: (msg: string) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(errorCalled, true, 'Non-parent role must be rejected');
    assert.ok(errorMsg.includes('Akses ditolak'), 'Error message must say Akses ditolak');

    cleanup();
  });

  await t.test('8. Security Audit: NO logging of access tokens, refresh tokens, or OTP hashes', async () => {
    let capturedLogs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    console.error = (...args: any[]) => capturedLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));

    const secretToken = 'secret_access_token_99999';
    const secretRefreshToken = 'secret_refresh_token_88888';

    const mockSession = {
      access_token: secretToken,
      user: {
        id: 'sec1',
        email: 'security_parent@example.com',
        user_metadata: { role: 'parent' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: (cb: any) => {
          cb('SIGNED_IN', mockSession);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: async () => ({
          data: { session: mockSession },
          error: null
        })
      }
    };

    const locationMock: any = { hash: `#access_token=${secretToken}&refresh_token=${secretRefreshToken}`, search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    try {
      const { cleanup } = initInvitationSessionCallback({
        supabaseClient: mockClient,
        locationObj: locationMock,
        onSuccess: () => {},
        onError: () => {},
        timeoutMs: 5000,
        sessionReceivedRef,
        processedSessionKeyRef,
        timeoutRef
      });
      cleanup();

      const logContent = capturedLogs.join('\n');
      assert.ok(!logContent.includes(secretToken), 'Must not log access token');
      assert.ok(!logContent.includes(secretRefreshToken), 'Must not log refresh token');
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });

  await t.test('9. SDK Smoke Test: Supabase client contract verification with flowType pkce', async () => {
    // Note: This is an SDK contract smoke test verifying that initInvitationSessionCallback
    // correctly accepts a live @supabase/supabase-js v2 GoTrueClient instance (with flowType: 'pkce')
    // and correctly registers listeners without runtime exception.
    // End-to-end network PKCE code exchange and real JWT verification requires live browser runtime + live OTP server issuance.
    const realSupabase = createClient(
      'https://wqnhlmvvyhpctmaukwyj.supabase.co',
      'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P',
      {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    let successCount = 0;
    let errorCount = 0;

    const locationMock: any = { hash: '#access_token=dummy_token_123&refresh_token=dummy_ref_123&type=recovery', search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: realSupabase,
      locationObj: locationMock,
      onSuccess: () => { successCount++; },
      onError: () => { errorCount++; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 100));

    // Verify SDK contract handling: real client initializes gracefully, registers onAuthStateChange, and maintains timeout during pending async state
    assert.strictEqual(errorCount, 0, 'SDK smoke test: real Supabase client contract must not trigger onError prematurely');
    assert.ok(timeoutRef.current !== null, 'SDK smoke test: active timeout must be maintained while awaiting token processing');

    cleanup();
  });

  await t.test('10. Lifecycle Audit: Duplicate onSuccess calls prevented for identical session', async () => {
    let successCount = 0;
    let authListener: any = null;

    const mockSession = {
      access_token: 'dup_token_123',
      user: {
        id: 'u_dup',
        email: 'dup_parent@example.com',
        user_metadata: { role: 'parent' }
      }
    };

    const mockClient = {
      auth: {
        onAuthStateChange: (cb: any) => {
          authListener = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: async () => ({
          data: { session: mockSession },
          error: null
        })
      }
    };

    const locationMock: any = { hash: '#access_token=dup_token_123', search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCount++; },
      onError: () => {},
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(successCount, 1, 'First session reception calls onSuccess once');

    // Fire onAuthStateChange event twice with identical session
    authListener('SIGNED_IN', mockSession);
    authListener('TOKEN_REFRESHED', mockSession);

    assert.strictEqual(successCount, 1, 'Duplicate session events must NOT trigger duplicate onSuccess calls');

    cleanup();
  });

  await t.test('11. Lifecycle Audit: Late getSession() null does NOT overwrite active onAuthStateChange session', async () => {
    let successCount = 0;
    let errorCount = 0;
    let resolveGetSession: any = null;

    const mockSession = {
      access_token: 'active_token_123',
      user: {
        id: 'u_active',
        email: 'active_parent@example.com',
        user_metadata: { role: 'parent' }
      }
    };

    let authListener: any = null;

    const mockClient = {
      auth: {
        onAuthStateChange: (cb: any) => {
          authListener = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: () => new Promise(resolve => {
          resolveGetSession = resolve;
        })
      }
    };

    const locationMock: any = { hash: '#access_token=active_token_123', search: '' };
    const sessionReceivedRef = { current: false };
    const processedSessionKeyRef = { current: null };
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCount++; },
      onError: () => { errorCount++; },
      timeoutMs: 5000,
      sessionReceivedRef,
      processedSessionKeyRef,
      timeoutRef
    });

    // 1. onAuthStateChange fires FIRST with valid session
    authListener('SIGNED_IN', mockSession);
    assert.strictEqual(successCount, 1);
    assert.strictEqual(sessionReceivedRef.current, true);

    // 2. Later, delayed getSession() resolves with null
    resolveGetSession({ data: { session: null }, error: null });
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(successCount, 1, 'onSuccess count must stay 1');
    assert.strictEqual(errorCount, 0, 'Late getSession() null must NOT trigger onError when session was already received');
    assert.strictEqual(sessionReceivedRef.current, true, 'sessionReceivedRef must remain true');

    cleanup();
  });

});
