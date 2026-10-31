import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ userProfile, allowedRoles, requireTenant = true, children }) {
  const location = useLocation();

  // 1. Unauthenticated -> Fallback / Redirect
  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-red-500 font-medium">Sesi tidak valid atau hak akses tidak ditemukan.</p>
      </div>
    );
  }

  const userRole = (userProfile.role || '').toLowerCase();
  const isCoach = userRole === 'pelatih' || userRole === 'coach';

  // 2. Super Admin strict routing: Super Admin must ONLY access /saas-admin
  if (userRole === 'superadmin') {
    if (location.pathname !== '/saas-admin') {
      return <Navigate to="/saas-admin" replace />;
    }
    return children;
  }

  // Handle non-superadmin users trying to access /saas-admin
  if (location.pathname === '/saas-admin' && userRole !== 'superadmin') {
    return isCoach ? <Navigate to="/akademi" replace /> : <Navigate to="/dashboard" replace />;
  }

  // 3. Pelatih / Coach RBAC Protection: Coach accesses /akademi
  if (isCoach) {
    if (location.pathname !== '/akademi' && !location.pathname.startsWith('/akademi')) {
      return <Navigate to="/akademi" replace />;
    }
    return children;
  }

  // 4. Tenant Owner without tenant data: MUST complete Onboarding
  if (userRole === 'owner' && !userProfile.tenant && requireTenant) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
    return children;
  }

  // Handle Tenant Owner with tenant data trying to re-access /onboarding
  if (userRole === 'owner' && userProfile.tenant && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  // 5. Role authorization check if explicit allowedRoles provided
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const isAllowed =
      normalizedAllowed.includes(userRole) ||
      (isCoach && (normalizedAllowed.includes('pelatih') || normalizedAllowed.includes('coach')));

    if (!isAllowed) {
      return isCoach ? <Navigate to="/akademi" replace /> : <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
