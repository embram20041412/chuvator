import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ userProfile, allowedRoles, requireTenant = true, children }) {
  const location = useLocation();

  // 1. Unauthenticated -> Redirect to Login
  if (!userProfile) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 2. Super Admin strict routing: Super Admin must ONLY access /saas-admin
  if (userProfile.role === 'superadmin') {
    if (location.pathname !== '/saas-admin') {
      return <Navigate to="/saas-admin" replace />;
    }
    return children;
  }

  // Handle non-superadmin users trying to access /saas-admin
  if (location.pathname === '/saas-admin' && userProfile.role !== 'superadmin') {
    return userProfile.role === 'pelatih' ? <Navigate to="/akademi" replace /> : <Navigate to="/dashboard" replace />;
  }

  // 3. Pelatih RBAC Protection: Pelatih HANYA memiliki akses ke modul /akademi
  if (userProfile.role === 'pelatih') {
    if (location.pathname !== '/akademi') {
      return <Navigate to="/akademi" replace />;
    }
    return children;
  }

  // 4. Tenant Owner without tenant data: MUST complete Onboarding
  if (userProfile.role === 'owner' && !userProfile.tenant && requireTenant) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
    return children;
  }

  // Handle Tenant Owner with tenant data trying to re-access /onboarding
  if (userProfile.role === 'owner' && userProfile.tenant && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  // 5. Role authorization check if explicit allowedRoles provided
  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    return userProfile.role === 'pelatih' ? <Navigate to="/akademi" replace /> : <Navigate to="/dashboard" replace />;
  }

  return children;
}
