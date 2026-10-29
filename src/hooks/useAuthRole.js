import { useState, useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Custom Hook untuk membaca peran pengguna (Role) dan Tenant ID dari Firebase Auth Custom Claims.
 * Format claims: { role: 'owner' | 'kasir' | 'pelatih', tenantId: string }
 */
export default function useAuthRole(userProfile) {
  const [role, setRole] = useState(userProfile?.role || null);
  const [tenantId, setTenantId] = useState(
    userProfile?.tenantId || userProfile?.tenant?.id || null
  );
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const inspectUserClaims = async (currentUser) => {
      if (!currentUser) {
        if (isMounted) {
          setRole(userProfile?.role || null);
          setTenantId(userProfile?.tenantId || userProfile?.tenant?.id || null);
          setClaims({});
          setLoading(false);
        }
        return;
      }

      try {
        // Ambil token result terkini dengan forceRefresh false untuk kecepatan, 
        // fallback refresh jika diperlukan
        const idTokenResult = await currentUser.getIdTokenResult();
        const userClaims = idTokenResult?.claims || {};

        if (isMounted) {
          setClaims(userClaims);
          // Prioritaskan custom claims role jika ada, lalu fallback ke userProfile.role
          const resolvedRole = userClaims.role || userProfile?.role || 'owner';
          const resolvedTenantId =
            userClaims.tenantId ||
            userProfile?.tenantId ||
            userProfile?.tenant?.id ||
            currentUser.uid;

          setRole(resolvedRole);
          setTenantId(resolvedTenantId);
        }
      } catch (err) {
        console.error('Error in useAuthRole getIdTokenResult:', err);
        if (isMounted) {
          setRole(userProfile?.role || 'owner');
          setTenantId(userProfile?.tenantId || userProfile?.tenant?.id || currentUser.uid);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Dengarkan perubahan ID token (misalnya saat custom claims baru diterapkan)
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      inspectUserClaims(user);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userProfile]);

  const normalizedRole = (role || userProfile?.role || '').toLowerCase();

  const isOwner =
    normalizedRole === 'owner' ||
    userProfile?.role === 'owner' ||
    normalizedRole === 'superadmin' ||
    userProfile?.role === 'superadmin';

  const isSuperAdmin =
    normalizedRole === 'superadmin' || userProfile?.role === 'superadmin';

  const isKasir = normalizedRole === 'kasir';
  const isCoach = normalizedRole === 'pelatih' || normalizedRole === 'coach';

  return {
    role: normalizedRole,
    tenantId,
    claims,
    isOwner,
    isSuperAdmin,
    isKasir,
    isCoach,
    loading,
    refreshClaims: async () => {
      if (auth.currentUser) {
        const refreshed = await auth.currentUser.getIdTokenResult(true);
        setClaims(refreshed.claims || {});
        if (refreshed.claims?.role) setRole(refreshed.claims.role);
        if (refreshed.claims?.tenantId) setTenantId(refreshed.claims.tenantId);
      }
    },
  };
}
