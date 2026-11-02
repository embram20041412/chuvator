import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure authorization navigation decision logic mirrors ProtectedRoute behavior
 */
function evaluateRouteAccess({ userProfile, pathname, allowedRoles, requireTenant = true }) {
  // 1. Unauthenticated -> Redirect to /login with replace
  if (!userProfile) {
    return { action: 'redirect', to: '/login', replace: true };
  }

  const userRole = (userProfile.role || '').toLowerCase();
  const isCoach = userRole === 'pelatih' || userRole === 'coach';

  // 2. Super Admin strict routing: Super Admin must ONLY access /saas-admin
  if (userRole === 'superadmin') {
    if (pathname !== '/saas-admin') {
      return { action: 'redirect', to: '/saas-admin', replace: true };
    }
    return { action: 'allow' };
  }

  // Handle non-superadmin users trying to access /saas-admin
  if (pathname === '/saas-admin' && userRole !== 'superadmin') {
    return { action: 'redirect', to: isCoach ? '/akademi' : '/dashboard', replace: true };
  }

  // 3. Pelatih / Coach RBAC Protection: Coach accesses /akademi
  if (isCoach) {
    if (pathname !== '/akademi' && !pathname.startsWith('/akademi')) {
      return { action: 'redirect', to: '/akademi', replace: true };
    }
    return { action: 'allow' };
  }

  // 4. Tenant Owner without tenant data: MUST complete Onboarding
  if (userRole === 'owner' && !userProfile.tenant && requireTenant) {
    if (pathname !== '/onboarding') {
      return { action: 'redirect', to: '/onboarding', replace: true };
    }
    return { action: 'allow' };
  }

  // Handle Tenant Owner with tenant data trying to re-access /onboarding
  if (userRole === 'owner' && userProfile.tenant && pathname === '/onboarding') {
    return { action: 'redirect', to: '/dashboard', replace: true };
  }

  // 5. Role authorization check if explicit allowedRoles provided
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

test('Unauthenticated user (e.g. after logout or reload without session) redirects to /login with replace', () => {
  const result = evaluateRouteAccess({
    userProfile: null,
    pathname: '/saas-admin',
  });

  assert.equal(result.action, 'redirect');
  assert.equal(result.to, '/login');
  assert.equal(result.replace, true);
});

test('Superadmin is restricted strictly to /saas-admin and redirected there from any other route', () => {
  const superProfile = { role: 'superadmin', email: 'admin@chua.com' };

  // On /saas-admin -> allowed
  assert.deepEqual(
    evaluateRouteAccess({ userProfile: superProfile, pathname: '/saas-admin' }),
    { action: 'allow' }
  );

  // On /dashboard -> redirected to /saas-admin
  assert.deepEqual(
    evaluateRouteAccess({ userProfile: superProfile, pathname: '/dashboard' }),
    { action: 'redirect', to: '/saas-admin', replace: true }
  );

  // On /keuangan -> redirected to /saas-admin
  assert.deepEqual(
    evaluateRouteAccess({ userProfile: superProfile, pathname: '/keuangan' }),
    { action: 'redirect', to: '/saas-admin', replace: true }
  );
});

test('Non-superadmin cannot access /saas-admin and is redirected to their home route', () => {
  const ownerProfile = { role: 'owner', tenant: { id: 't1' } };
  const coachProfile = { role: 'coach', tenant: { id: 't1' } };

  assert.deepEqual(
    evaluateRouteAccess({ userProfile: ownerProfile, pathname: '/saas-admin' }),
    { action: 'redirect', to: '/dashboard', replace: true }
  );

  assert.deepEqual(
    evaluateRouteAccess({ userProfile: coachProfile, pathname: '/saas-admin' }),
    { action: 'redirect', to: '/akademi', replace: true }
  );
});

test('Coach is restricted strictly to /akademi routes', () => {
  const coachProfile = { role: 'coach', tenant: { id: 't1' } };

  // Accessing /akademi -> allowed
  assert.deepEqual(
    evaluateRouteAccess({ userProfile: coachProfile, pathname: '/akademi' }),
    { action: 'allow' }
  );

  // Accessing /keuangan -> redirected to /akademi
  assert.deepEqual(
    evaluateRouteAccess({ userProfile: coachProfile, pathname: '/keuangan' }),
    { action: 'redirect', to: '/akademi', replace: true }
  );
});

test('Tenant Owner without tenant data is routed to /onboarding', () => {
  const unconfiguredOwner = { role: 'owner', tenant: null };

  assert.deepEqual(
    evaluateRouteAccess({ userProfile: unconfiguredOwner, pathname: '/dashboard' }),
    { action: 'redirect', to: '/onboarding', replace: true }
  );

  assert.deepEqual(
    evaluateRouteAccess({ userProfile: unconfiguredOwner, pathname: '/onboarding' }),
    { action: 'allow' }
  );
});

test('Configured Tenant Owner cannot re-access /onboarding', () => {
  const configuredOwner = { role: 'owner', tenant: { id: 't-123' } };

  assert.deepEqual(
    evaluateRouteAccess({ userProfile: configuredOwner, pathname: '/onboarding' }),
    { action: 'redirect', to: '/dashboard', replace: true }
  );
});
