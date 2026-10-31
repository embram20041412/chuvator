import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import useAuthRole from './useAuthRole';

/**
 * Custom Hook `useUserAccessScope` untuk mendeteksi role pengguna (owner, admin, coach, kasir)
 * dan secara khusus memuat profil pelatih (`coachProfile`) dari tabel `coaches`
 * jika pengguna login sebagai pelatih (role 'coach' atau 'pelatih').
 */
export default function useUserAccessScope(userProfile) {
  const authScope = useAuthRole(userProfile);
  const [coachProfile, setCoachProfile] = useState(null);
  const [loadingCoachProfile, setLoadingCoachProfile] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchCoachProfile = async () => {
      if (!authScope.isCoach) {
        if (isMounted) {
          setCoachProfile(null);
          setLoadingCoachProfile(false);
        }
        return;
      }

      setLoadingCoachProfile(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setCoachProfile(null);
          return;
        }

        // Cari profil pelatih di tabel coaches berdasarkan auth_uid atau email
        let query = supabase.from('coaches').select('*');

        if (user.id) {
          query = query.or(`auth_uid.eq.${user.id},email.ilike.${user.email}`);
        } else if (user.email) {
          query = query.ilike('email', user.email);
        }

        const { data: coachData, error } = await query.maybeSingle();

        if (error) {
          console.warn('Error fetching coach profile:', error.message);
        }

        if (isMounted) {
          setCoachProfile(coachData || null);
        }
      } catch (err) {
        console.error('Unhandled error in useUserAccessScope:', err);
        if (isMounted) setCoachProfile(null);
      } finally {
        if (isMounted) setLoadingCoachProfile(false);
      }
    };

    if (!authScope.loading) {
      fetchCoachProfile();
    }
  }, [authScope.isCoach, authScope.loading, userProfile]);

  return {
    ...authScope,
    coachProfile,
    coachId: coachProfile?.id || null,
    loadingCoachProfile,
    // Helper RBAC
    isCoachOnly: authScope.isCoach && !authScope.isOwner && !authScope.isSuperAdmin,
    canAccessFinance: authScope.isOwner || authScope.isSuperAdmin || authScope.role === 'admin' || authScope.isKasir,
    canAccessDashboard: authScope.isOwner || authScope.isSuperAdmin || authScope.role === 'admin',
  };
}
