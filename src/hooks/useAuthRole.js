import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

/**
 * Custom Hook untuk membaca peran pengguna (Role) dan Tenant ID dari Supabase Auth & userProfile.
 * Format role: 'superadmin' | 'owner' | 'admin' | 'kasir' | 'pelatih'
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

    const inspectSupabaseUser = async (user) => {
      if (!user) {
        if (isMounted) {
          setRole(userProfile?.role || null);
          setTenantId(userProfile?.tenantId || userProfile?.tenant?.id || null);
          setClaims({});
          setLoading(false);
        }
        return;
      }

      try {
        const metadata = user.user_metadata || {};
        if (isMounted) {
          setClaims(metadata);
          const resolvedRole = userProfile?.role || metadata.role || 'owner';
          const resolvedTenantId =
            userProfile?.tenantId ||
            userProfile?.tenant?.id ||
            metadata.tenant_id ||
            metadata.tenantId ||
            user.id;

          setRole(resolvedRole);
          setTenantId(resolvedTenantId);
        }
      } catch (err) {
        console.error('Error in useAuthRole inspectSupabaseUser:', err);
        if (isMounted) {
          setRole(userProfile?.role || 'owner');
          setTenantId(userProfile?.tenantId || userProfile?.tenant?.id || user.id);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Ambil user saat inisialisasi
    supabase.auth.getUser().then(({ data: { user } }) => {
      inspectSupabaseUser(user);
    });

    // Dengarkan perubahan sesi autentikasi Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      inspectSupabaseUser(session?.user || null);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
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

  const isKasir = normalizedRole === 'kasir' || normalizedRole === 'admin';
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metadata = user.user_metadata || {};
        setClaims(metadata);
        if (metadata.role) setRole(metadata.role);
        if (metadata.tenant_id || metadata.tenantId) {
          setTenantId(metadata.tenant_id || metadata.tenantId);
        }
      }
    },
  };
}
