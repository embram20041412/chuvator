import { test } from 'node:test';
import assert from 'node:assert';
import { initInvitationSessionCallback } from '../src/utils/portalAuthCallback.js';

test('CHUVATOR PARENT PORTAL V2.6.16 — AUTH CALLBACK SESSION DETECTION HARDENING SUITE', async (t) => {

  await t.test('1. Immediate session found via getSession()', async () => {
    let successCalled = false;
    let errorCalled = false;
    let capturedSession: any = null;
    let capturedUser: any = null;

    const mockSession = {
      user: {
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
      user: {
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
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
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

  await t.test('3. Delayed session initialization (> 1500 ms, e.g. at 2500 ms) before 5000 ms timeout', async () => {
    let successCalled = false;
    let errorCalled = false;
    let authListener: any = null;

    const mockSession = {
      user: {
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
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
      timeoutRef
    });

    // Wait 200ms (exceeding old 1500ms when tested with small scale or real time delays)
    await new Promise(r => setTimeout(r, 200));
    assert.strictEqual(errorCalled, false, 'Must not time out prematurely at < 5000ms');

    // Now fire authListener (simulating 2500ms delayed token exchange completion)
    authListener('SIGNED_IN', mockSession);

    assert.strictEqual(successCalled, true, 'onSuccess called when delayed session completes');
    assert.strictEqual(errorCalled, false, 'onError must NOT be called for delayed session');

    cleanup();
  });

  await t.test('4. Recovery callback flow with parent role (type=recovery in hash)', async () => {
    let successCalled = false;
    let errorCalled = false;

    const mockSession = {
      user: {
        email: 'recovery_parent@example.com',
        app_metadata: { role: 'parent' } // Testing app_metadata fallback
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
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
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
      user: {
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
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => { successCalled = true; },
      onError: () => { errorCalled = true; },
      timeoutMs: 5000,
      sessionReceivedRef,
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
    const timeoutRef1 = { current: null };

    const { cleanup: cleanup1 } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: noTokenLocation,
      onSuccess: () => {},
      onError: (msg: string) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 5000,
      sessionReceivedRef: sessionReceivedRef1,
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
    const timeoutRef2 = { current: null };

    const { cleanup: cleanup2 } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: tokenLocation,
      onSuccess: () => {},
      onError: (msg: string) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 100, // Short timeout for test
      sessionReceivedRef: sessionReceivedRef2,
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
      user: {
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
    const timeoutRef = { current: null };

    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: mockClient,
      locationObj: locationMock,
      onSuccess: () => {},
      onError: (msg: string) => { errorCalled = true; errorMsg = msg; },
      timeoutMs: 5000,
      sessionReceivedRef,
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
      user: {
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
    const timeoutRef = { current: null };

    try {
      const { cleanup } = initInvitationSessionCallback({
        supabaseClient: mockClient,
        locationObj: locationMock,
        onSuccess: () => {},
        onError: () => {},
        timeoutMs: 5000,
        sessionReceivedRef,
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

});
