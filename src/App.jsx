import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { subscribeToAuthChanges } from './services/authService';

import LoadingScreen from './components/LoadingScreen';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PortalLayout from './layouts/PortalLayout';
import PortalLogin from './pages/Portal/PortalLogin';

// Lazy-loaded heavy modules for Code Splitting & Performance Optimization
const SaasAdminPage = lazy(() => import('./pages/SaasAdminPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const KasirPage = lazy(() => import('./pages/KasirPage'));
const AkademiPage = lazy(() => import('./pages/AkademiPage'));
const EventManagementPage = lazy(() => import('./pages/EventManagementPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const IntelligencePage = lazy(() => import('./pages/IntelligencePage'));
const PengaturanPage = lazy(() => import('./pages/PengaturanPage'));
const PortalDashboard = lazy(() => import('./pages/Portal/PortalDashboard'));

function PageLoadingSkeleton() {
  return (
    <div className="w-full min-h-[60vh] flex flex-col justify-center items-center p-6 space-y-3">
      <div className="w-12 h-12 border-4 border-[#354944] border-t-[#C89D32] rounded-full animate-spin shadow-md" />
      <div className="text-center space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-[#354944] dark:text-[#C89D32]">CHUA SPORT CORE</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Memuat modul &amp; performa sistem...</p>
      </div>
    </div>
  );
}

function EventDetailWrapper({ userProfile }) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  return (
    <EventDetailPage
      eventId={eventId}
      userProfile={userProfile}
      onBack={() => navigate('/events')}
    />
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Subscribe to Firebase Auth and Firestore role verification
    const unsubscribe = subscribeToAuthChanges((authUser, profile, errorMessage) => {
      if (authUser && profile) {
        setFirebaseUser(authUser);
        setUserProfile(profile);
      } else {
        setFirebaseUser(null);
        setUserProfile(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleTenantCreated = (newTenant) => {
    setUserProfile((prev) => ({
      ...prev,
      tenant: newTenant,
      tenantId: newTenant.id,
    }));
  };

  const handleTenantUpdated = (updatedTenant) => {
    setUserProfile((prev) => ({
      ...prev,
      tenant: updatedTenant,
    }));
  };

  // 1. Render LoadingScreen if auth state check is in progress (Prevents Flash Login)
  if (isAuthLoading) {
    return <LoadingScreen message="Memverifikasi Otentikasi & Akses Security..." />;
  }

  // Helper untuk menentukan halaman tujuan berdasarkan role
  const getHomeRouteForRole = (profile) => {
    if (!profile) return '/login';
    if (profile.role === 'superadmin') return '/saas-admin';
    if (profile.role === 'pelatih') return '/akademi';
    if (profile.role === 'owner' && !profile.tenant) return '/onboarding';
    return '/dashboard'; // default for owner & admin
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Routes>
            {/* Public / Auth Page */}
            <Route
              path="/login"
              element={
                userProfile ? (
                  <Navigate to={getHomeRouteForRole(userProfile)} replace />
                ) : (
                  <LoginPage onLoginSuccess={(profile) => setUserProfile(profile)} />
                )
              }
            />

            {/* Portal Wali Murid (Isolated Mobile-First Unified Routing) */}
            <Route element={<PortalLayout />}>
              <Route path="/portal" element={<PortalLogin />} />
              <Route path="/portal/dashboard" element={<PortalDashboard />} />
            </Route>

            {/* Super Admin Protected Route */}
            <Route
              path="/saas-admin"
              element={
                <ProtectedRoute userProfile={userProfile} allowedRoles={['superadmin']}>
                  <SaasAdminPage userProfile={userProfile} />
                </ProtectedRoute>
              }
            />

            {/* Onboarding Page for Invited Tenant Owner without Tenant Data */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute userProfile={userProfile} allowedRoles={['owner']} requireTenant={false}>
                  <OnboardingPage
                    userProfile={userProfile}
                    onTenantCreated={handleTenantCreated}
                  />
                </ProtectedRoute>
              }
            />

            {/* Protected Main App Layout (Owner, Admin, Pelatih) */}
            <Route
              element={
                <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin', 'pelatih']}>
                  <Layout userProfile={userProfile} />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <DashboardPage userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/booking"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <BookingPage userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kasir"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <KasirPage userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/akademi"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin', 'pelatih']}>
                    <AkademiPage userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <EventManagementPage userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events/:eventId"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <EventDetailWrapper userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/keuangan"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <FinancePage userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/intelligence"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <IntelligencePage userProfile={userProfile} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pengaturan"
                element={
                  <ProtectedRoute userProfile={userProfile} allowedRoles={['owner', 'superadmin', 'admin']}>
                    <PengaturanPage
                      userProfile={userProfile}
                      onTenantUpdated={handleTenantUpdated}
                    />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all Redirect */}
            <Route
              path="*"
              element={
                userProfile ? (
                  <Navigate to={getHomeRouteForRole(userProfile)} replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
