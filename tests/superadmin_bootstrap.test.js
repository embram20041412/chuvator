import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySuperadminStatus, verifyUserRoleAndTenant } from '../src/services/supabaseAuthService.js';

/**
 * Helper to build mock Supabase clients matching PostgreSQL RPC & Table behaviors
 */
function createMockSupabaseClient({
  isSuperadminResponses = [false],
  bootstrapResponse = { data: false, error: null },
  platformSuperadminsTable = [],
  usersStaffTable = [],
  tenantsTable = [],
  invitationsTable = [],
}) {
  let isSuperCallIndex = 0;
  let bootstrapCalled = 0;
  let queriedColumns = [];

  return {
    getStats: () => ({
      isSuperCallCount: isSuperCallIndex,
      bootstrapCallCount: bootstrapCalled,
      queriedColumns,
    }),
    rpc: async (fnName, params) => {
      if (fnName === 'is_superadmin') {
        const resp = isSuperadminResponses[isSuperCallIndex] ?? isSuperadminResponses[isSuperadminResponses.length - 1];
        isSuperCallIndex++;
        if (resp instanceof Error) {
          return { data: null, error: resp };
        }
        return { data: resp, error: null };
      }
      if (fnName === 'bootstrap_platform_superadmin') {
        bootstrapCalled++;
        if (bootstrapResponse instanceof Error) {
          throw bootstrapResponse;
        }
        if (bootstrapResponse?.error) {
          return { data: null, error: bootstrapResponse.error };
        }
        return { data: bootstrapResponse.data ?? bootstrapResponse, error: null };
      }
      throw new Error(`Unexpected RPC call: ${fnName}`);
    },
    from: (tableName) => {
      let selectedCols = '*';
      let eqFilters = {};
      let orFilter = null;
      let ilikeFilter = {};

      const builder = {
        select: (cols) => {
          selectedCols = cols;
          queriedColumns.push({ table: tableName, columns: cols });
          return builder;
        },
        eq: (col, val) => {
          eqFilters[col] = val;
          return builder;
        },
        or: (condition) => {
          orFilter = condition;
          return builder;
        },
        ilike: (col, val) => {
          ilikeFilter[col] = val.toLowerCase();
          return builder;
        },
        maybeSingle: async () => {
          if (tableName === 'platform_superadmins') {
            // Note: column must be auth_uid, NOT user_id
            if (eqFilters.user_id !== undefined) {
              return { data: null, error: new Error('column "user_id" does not exist in table "platform_superadmins"') };
            }
            const match = platformSuperadminsTable.find(
              (row) => eqFilters.auth_uid && row.auth_uid === eqFilters.auth_uid
            );
            return { data: match || null, error: null };
          }
          if (tableName === 'users_staff') {
            const match = usersStaffTable.find((row) => {
              if (ilikeFilter.email && row.email?.toLowerCase() === ilikeFilter.email) return true;
              if (eqFilters.uid && row.uid === eqFilters.uid) return true;
              return false;
            });
            return { data: match || null, error: null };
          }
          if (tableName === 'tenants') {
            const match = tenantsTable.find((row) => {
              if (eqFilters.id && row.id === eqFilters.id) return true;
              return false;
            });
            return { data: match || null, error: null };
          }
          if (tableName === 'invitations') {
            const match = invitationsTable.find((row) => eqFilters.email && row.email === eqFilters.email);
            return { data: match || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}

/**
 * Pure authorization navigation evaluator (mirrors ProtectedRoute.jsx)
 */
function evaluateRouteAccess({ userProfile, pathname, allowedRoles, requireTenant = true }) {
  if (!userProfile) {
    return { action: 'redirect', to: '/login', replace: true };
  }

  const userRole = (userProfile.role || '').toLowerCase();
  const isCoach = userRole === 'pelatih' || userRole === 'coach';

  if (userRole === 'superadmin') {
    if (pathname !== '/saas-admin') {
      return { action: 'redirect', to: '/saas-admin', replace: true };
    }
    return { action: 'allow' };
  }

  if (pathname === '/saas-admin' && userRole !== 'superadmin') {
    return { action: 'redirect', to: isCoach ? '/akademi' : '/dashboard', replace: true };
  }

  if (isCoach) {
    if (pathname !== '/akademi' && !pathname.startsWith('/akademi')) {
      return { action: 'redirect', to: '/akademi', replace: true };
    }
    return { action: 'allow' };
  }

  if (userRole === 'owner' && !userProfile.tenant && requireTenant) {
    if (pathname !== '/onboarding') {
      return { action: 'redirect', to: '/onboarding', replace: true };
    }
    return { action: 'allow' };
  }

  if (userRole === 'owner' && userProfile.tenant && pathname === '/onboarding') {
    return { action: 'redirect', to: '/dashboard', replace: true };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const isAllowed =
      normalizedAllowed.includes(userRole) ||
      (isCoach && (normalizedAllowed.includes('pelatih') || normalizedAllowed.includes('coach')));

    if (!isAllowed) {
      return { action: 'redirect', to: isCoach ? '/akademi' : '/dashboard', replace: true };
    }
  }

  return { action: 'allow' };
}

// =========================================================================
// TEST SCENARIOS
// =========================================================================

test('Test 1: Superadmin with auth_uid already bound is immediately recognized via is_superadmin()', async () => {
  const mockUser = {
    id: 'super-uid-001',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [true], // Immediate true
  });

  const profile = await verifySuperadminStatus(mockUser, client);

  assert.ok(profile, 'Profile should be returned');
  assert.equal(profile.role, 'superadmin');
  assert.equal(profile.uid, 'super-uid-001');
  assert.equal(profile.email, 'erizamaulana.bramantya@gmail.com');
  assert.equal(profile.isStaff, false);
  assert.equal(client.getStats().isSuperCallCount, 1);
  assert.equal(client.getStats().bootstrapCallCount, 0, 'Bootstrap should not be called if already superadmin');
});

test('Test 2: Superadmin with unbound auth_uid (first login) calls bootstrap_platform_superadmin() and re-verifies successfully', async () => {
  const mockUser = {
    id: 'super-uid-002',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    // 1st call: false (unbound auth_uid in DB), 2nd call: true (after bootstrap)
    isSuperadminResponses: [false, true],
    bootstrapResponse: { data: true, error: null },
  });

  const profile = await verifySuperadminStatus(mockUser, client);

  assert.ok(profile, 'Superadmin profile should be returned after successful bootstrap');
  assert.equal(profile.role, 'superadmin');
  assert.equal(profile.uid, 'super-uid-002');
  assert.equal(client.getStats().isSuperCallCount, 2, 'Should call is_superadmin twice (before & after bootstrap)');
  assert.equal(client.getStats().bootstrapCallCount, 1, 'Bootstrap should be called once');
});

test('Test 3: verifyUserRoleAndTenant returns superadmin role when bootstrap succeeds and re-check is true', async () => {
  const mockUser = {
    id: 'super-uid-003',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, true],
    bootstrapResponse: { data: true, error: null },
  });

  const profile = await verifyUserRoleAndTenant(mockUser, client);

  assert.ok(profile);
  assert.equal(profile.role, 'superadmin');
  assert.equal(profile.tenantId, null);
  assert.equal(profile.tenant, null);
});

test('Test 4: Normal user cannot become Superadmin (is_superadmin returns false, bootstrap returns false)', async () => {
  const normalUser = {
    id: 'normal-uid-100',
    email: 'staff@example.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, false],
    bootstrapResponse: { data: false, error: null },
    usersStaffTable: [
      { id: 'staff-1', uid: 'normal-uid-100', email: 'staff@example.com', role: 'kasir', tenant_id: 't-1' },
    ],
    tenantsTable: [
      { id: 't-1', name: 'Arena Badminton' },
    ],
  });

  const superStatus = await verifySuperadminStatus(normalUser, client);
  assert.equal(superStatus, null, 'Normal user must not be granted superadmin status');

  const fullProfile = await verifyUserRoleAndTenant(normalUser, client);
  assert.equal(fullProfile.role, 'kasir', 'Normal user role must resolve to staff role');
  assert.equal(fullProfile.tenantId, 't-1');
});

test('Test 5: User with unconfirmed email cannot bootstrap (bootstrap_platform_superadmin returns false)', async () => {
  const unconfirmedSuper = {
    id: 'unconfirmed-uid',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, false],
    // Database returns false because email_confirmed_at IS NULL
    bootstrapResponse: { data: false, error: null },
  });

  const profile = await verifySuperadminStatus(unconfirmedSuper, client);
  assert.equal(profile, null, 'Unconfirmed email must not be granted superadmin role');
  assert.equal(client.getStats().bootstrapCallCount, 1);
});

test('Test 6: Handling error when RPC bootstrap_platform_superadmin fails/throws (fail-closed, does not crash)', async () => {
  const mockUser = {
    id: 'err-uid-001',
    email: 'admin@chuasport.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, false],
    bootstrapResponse: new Error('PostgreSQL RPC network timeout or execution failure'),
  });

  // Must not throw, must return null (fail-closed)
  let profile = null;
  assert.doesNotThrow(async () => {
    profile = await verifySuperadminStatus(mockUser, client);
  });

  const res = await verifySuperadminStatus(mockUser, client);
  assert.equal(res, null, 'Must return null gracefully on bootstrap RPC error');
});

test('Test 7: Handling error when RPC is_superadmin fails/throws (fail-closed, does not crash)', async () => {
  const mockUser = {
    id: 'err-uid-002',
    email: 'admin@chuasport.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [new Error('500 Internal Server Error in is_superadmin')],
    bootstrapResponse: { data: false, error: null },
  });

  const profile = await verifySuperadminStatus(mockUser, client);
  assert.equal(profile, null, 'Must fail-closed to null when is_superadmin errors out');
});

test('Test 8: Superadmin logout then reload scenario (unauthenticated redirects to /login)', () => {
  // Session is null after logout or on page reload before auth initializes
  const unauthenticatedResult = evaluateRouteAccess({
    userProfile: null,
    pathname: '/saas-admin',
  });

  assert.equal(unauthenticatedResult.action, 'redirect');
  assert.equal(unauthenticatedResult.to, '/login');
  assert.equal(unauthenticatedResult.replace, true);
});

test('Test 9: Non-superadmin user attempting to access /saas-admin is redirected away', () => {
  const ownerProfile = { role: 'owner', tenant: { id: 't-1' } };
  const coachProfile = { role: 'coach', tenant: { id: 't-1' } };
  const kasirProfile = { role: 'kasir', tenant: { id: 't-1' } };

  // Owner accessing /saas-admin -> redirected to /dashboard
  const ownerAccess = evaluateRouteAccess({ userProfile: ownerProfile, pathname: '/saas-admin' });
  assert.deepEqual(ownerAccess, { action: 'redirect', to: '/dashboard', replace: true });

  // Coach accessing /saas-admin -> redirected to /akademi
  const coachAccess = evaluateRouteAccess({ userProfile: coachProfile, pathname: '/saas-admin' });
  assert.deepEqual(coachAccess, { action: 'redirect', to: '/akademi', replace: true });

  // Kasir accessing /saas-admin -> redirected to /dashboard
  const kasirAccess = evaluateRouteAccess({ userProfile: kasirProfile, pathname: '/saas-admin' });
  assert.deepEqual(kasirAccess, { action: 'redirect', to: '/dashboard', replace: true });
});

test('Test 10: Superadmin re-login after logout restores session and authorizes strictly to /saas-admin', async () => {
  const restoredSuperUser = {
    id: 'super-uid-restored',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [true], // Session active in DB
  });

  const profile = await verifySuperadminStatus(restoredSuperUser, client);
  assert.ok(profile);
  assert.equal(profile.role, 'superadmin');

  // Route evaluation for restored superadmin on /saas-admin is allowed
  const routeCheck = evaluateRouteAccess({ userProfile: profile, pathname: '/saas-admin' });
  assert.deepEqual(routeCheck, { action: 'allow' });

  // Route evaluation for restored superadmin trying to go to /dashboard is redirected to /saas-admin
  const dashCheck = evaluateRouteAccess({ userProfile: profile, pathname: '/dashboard' });
  assert.deepEqual(dashCheck, { action: 'redirect', to: '/saas-admin', replace: true });
});

test('Test 11 (Audit): Queries on platform_superadmins never use user_id column (canonical auth_uid only)', async () => {
  const mockUser = {
    id: 'audit-uid-001',
    email: 'super@chua.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, false],
    bootstrapResponse: { data: false, error: null },
    platformSuperadminsTable: [
      { id: 'rec-1', auth_uid: 'audit-uid-001', email: 'super@chua.com' },
    ],
  });

  const profile = await verifySuperadminStatus(mockUser, client);
  assert.ok(profile);
  assert.equal(profile.role, 'superadmin');

  // Verify that the table query inspected canonical 'auth_uid' and never 'user_id'
  const queries = client.getStats().queriedColumns;
  const superQueries = queries.filter((q) => q.table === 'platform_superadmins');
  assert.ok(superQueries.length > 0, 'Should have queried platform_superadmins');
  superQueries.forEach((q) => {
    assert.ok(q.columns.includes('auth_uid'), 'Must query auth_uid');
    assert.ok(!q.columns.includes('user_id'), 'Must NEVER query user_id');
  });
});
