import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase.js';

/**
 * Custom Hook untuk membaca dan memverifikasi peran pengguna (Role) serta Tenant ID
 * secara langsung dari SUMBER DATABASE RESMI SUPABASE (PostgreSQL Tables & RPC).
 *
 * KONTRAK DATABASE KANONIS:
 * 1. Tabel `tenants`: Kolom valid mencakup `id`, `tenant_id`, `name`, `owner_uid`, `owner_email`, `status`.
 *    CATATAN: Kolom `is_active` TIDAK ADA pada tabel `tenants`. Status keaktifan dicek via kolom `status` (default 'active').
 * 2. Tabel `users_staff`: Kolom valid mencakup `id`, `uid`, `tenant_id`, `role`, `status`, `is_active`.
 * 3. Tabel `platform_superadmins`: Kolom valid adalah `id`, `auth_uid`, `email`. DILARANG query `user_id`.
 * 4. RPC Superadmin: `is_superadmin()` dan `bootstrap_platform_superadmin()` dipanggil tanpa parameter.
 *    Bootstrap hanya dipanggil jika `!superErr && isSuper === false` (fail-closed).
 * 5. Siklus Hidup Stabil: Menggunakan sequence counter & userProfileRef untuk mencegah pemanggilan berulang
 *    tanpa kendali akibat re-render komponen.
 */
export default function useAuthRole(userProfile) {
  const [role, setRole] = useState(userProfile?.role || null);
  const [tenantId, setTenantId] = useState(
    userProfile?.tenantId || userProfile?.tenant?.id || null
  );
  const [verifiedFromDb, setVerifiedFromDb] = useState(false);
  const [loading, setLoading] = useState(true);

  // Epoch / Sequence Counter untuk membatalkan hasil verifikasi kedaluwarsa & race conditions
  const sequenceRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastVerifiedUidRef = useRef(null);

  // Stabilkan referensi userProfile agar tidak memicu re-subscribe listener secara berulang
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const resetAuthState = useCallback((isVerified = true) => {
    setRole(null);
    setTenantId(null);
    setVerifiedFromDb(isVerified);
    setLoading(false);
    lastVerifiedUidRef.current = null;
  }, []);

  const verifyRoleFromDatabase = useCallback(async (user, expectedSeq) => {
    // 0. Jika pengguna kosong (misal setelah SIGNED_OUT atau sesi anon)
    if (!user) {
      if (isMountedRef.current && expectedSeq === sequenceRef.current) {
        resetAuthState(true);
      }
      return;
    }

    try {
      const callerUid = user.id || user.uid;
      if (!callerUid) {
        if (isMountedRef.current && expectedSeq === sequenceRef.current) {
          resetAuthState(true);
        }
        return;
      }

      lastVerifiedUidRef.current = callerUid;

      // 1. Periksa apakah pengguna adalah Platform Superadmin via RPC tepercaya
      try {
        const { data: isSuper, error: superErr } = await supabase.rpc('is_superadmin');
        
        if (superErr) {
          console.warn('[useAuthRole] is_superadmin RPC error:', superErr.message || superErr);
        }

        if (!superErr && isSuper === true) {
          if (isMountedRef.current && expectedSeq === sequenceRef.current) {
            setRole('superadmin');
            setTenantId(userProfileRef.current?.tenantId || null);
            setVerifiedFromDb(true);
            setLoading(false);
          }
          return;
        }

        // Jalankan bootstrap HANYA jika is_superadmin() TIDAK error dan bernilai eksplisit FALSE
        // Prinsip ketat: !superErr && isSuper === false
        if (!superErr && isSuper === false) {
          try {
            const { data: bootResult, error: bootErr } = await supabase.rpc('bootstrap_platform_superadmin');
            if (bootErr) {
              console.warn('[useAuthRole] bootstrap_platform_superadmin RPC error:', bootErr.message || bootErr);
            } else if (bootResult === true || bootResult?.success === true) {
              // Re-verifikasi dengan is_superadmin() untuk memastikan baris terikat
              const { data: recheckSuper, error: recheckErr } = await supabase.rpc('is_superadmin');
              if (!recheckErr && recheckSuper === true) {
                if (isMountedRef.current && expectedSeq === sequenceRef.current) {
                  setRole('superadmin');
                  setTenantId(userProfileRef.current?.tenantId || null);
                  setVerifiedFromDb(true);
                  setLoading(false);
                }
                return;
              }
            }
          } catch (bootEx) {
            console.warn('[useAuthRole] Bootstrap superadmin RPC check warning:', bootEx);
          }
        }

        // Fallback pencarian tabel hanya menggunakan kolom kanonis 'auth_uid' (BUKAN 'user_id')
        const { data: superRow, error: superRowErr } = await supabase
          .from('platform_superadmins')
          .select('id, auth_uid, email')
          .eq('auth_uid', callerUid)
          .maybeSingle();

        if (!superRowErr && superRow && superRow.auth_uid === callerUid) {
          if (isMountedRef.current && expectedSeq === sequenceRef.current) {
            setRole('superadmin');
            setTenantId(userProfileRef.current?.tenantId || null);
            setVerifiedFromDb(true);
            setLoading(false);
          }
          return;
        }
      } catch (e) {
        // Abaikan jika RPC/tabel tidak tersedia / anon
      }

      // 2. Periksa apakah pengguna adalah Owner dari tenant aktif di tabel `tenants`
      // KONTRAK DATABASE: Tabel tenants TIDAK memiliki kolom 'is_active'.
      // Tabel tenants menggunakan kolom 'status' (DEFAULT 'active').
      try {
        const { data: ownerTenant, error: ownerErr } = await supabase
          .from('tenants')
          .select('id, tenant_id, name, status')
          .eq('owner_uid', callerUid)
          .limit(1)
          .maybeSingle();

        if (!ownerErr && ownerTenant) {
          const tenantStatus = String(ownerTenant.status || 'active').toLowerCase().trim();
          if (tenantStatus === 'active' || tenantStatus === 'aktif') {
            const resolvedTid = ownerTenant.tenant_id || ownerTenant.id;
            if (isMountedRef.current && expectedSeq === sequenceRef.current) {
              setRole('owner');
              setTenantId(resolvedTid);
              setVerifiedFromDb(true);
              setLoading(false);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('[useAuthRole] Check tenant owner warning:', e);
      }

      // 3. Periksa apakah pengguna adalah Staf di tabel `users_staff`
      try {
        const { data: staffRecord, error: staffErr } = await supabase
          .from('users_staff')
          .select('id, tenant_id, role, status, is_active')
          .eq('uid', callerUid)
          .limit(1)
          .maybeSingle();

        if (!staffErr && staffRecord) {
          const isStaffActive = staffRecord.is_active !== false &&
            ['active', 'aktif'].includes(String(staffRecord.status || 'active').toLowerCase().trim());

          if (isStaffActive) {
            const normalizedStaffRole = String(staffRecord.role || 'kasir').toLowerCase().trim();
            const cleanRole = normalizedStaffRole === 'pelatih' ? 'coach' : normalizedStaffRole;
            const resolvedTid = staffRecord.tenant_id;

            // Validasi silang dengan RPC get_user_tenant_role
            try {
              const { data: rpcRole } = await supabase.rpc('get_user_tenant_role', {
                check_tenant_id: String(resolvedTid),
              });
              if (rpcRole) {
                if (isMountedRef.current && expectedSeq === sequenceRef.current) {
                  setRole(rpcRole.toLowerCase());
                  setTenantId(resolvedTid);
                  setVerifiedFromDb(true);
                  setLoading(false);
                }
                return;
              }
            } catch (rErr) {
              // Fallback ke kolom users_staff yang diverifikasi
            }

            if (isMountedRef.current && expectedSeq === sequenceRef.current) {
              setRole(cleanRole);
              setTenantId(resolvedTid);
              setVerifiedFromDb(true);
              setLoading(false);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('[useAuthRole] Check users_staff warning:', e);
      }

      // 4. Jika userProfile menyediakan tenantId, periksa langsung ke RPC database
      const fallbackTenantId = userProfileRef.current?.tenantId || userProfileRef.current?.tenant?.id;
      if (fallbackTenantId) {
        try {
          const { data: rpcRole, error: rpcErr } = await supabase.rpc('get_user_tenant_role', {
            check_tenant_id: String(fallbackTenantId),
          });
          if (!rpcErr && rpcRole) {
            if (isMountedRef.current && expectedSeq === sequenceRef.current) {
              setRole(rpcRole.toLowerCase());
              setTenantId(fallbackTenantId);
              setVerifiedFromDb(true);
              setLoading(false);
            }
            return;
          }
        } catch (e) {
          // ignore
        }
      }

      // Jika tidak terdaftar di database, set role null (fail-closed)
      if (isMountedRef.current && expectedSeq === sequenceRef.current) {
        setRole(null);
        setTenantId(fallbackTenantId || null);
        setVerifiedFromDb(true);
      }
    } catch (err) {
      console.error('[useAuthRole] Verification error:', err);
      if (isMountedRef.current && expectedSeq === sequenceRef.current) {
        setRole(null);
        setTenantId(null);
        setVerifiedFromDb(true);
      }
    } finally {
      if (isMountedRef.current && expectedSeq === sequenceRef.current) {
        setLoading(false);
      }
    }
  }, [resetAuthState]);

  useEffect(() => {
    isMountedRef.current = true;

    // Supabase Auth Listener: Satu sumber kebenaran untuk siklus hidup autentikasi.
    // Dijalankan 1 kali saat mount, terhindar dari re-subscribing berulang.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentSeq = ++sequenceRef.current;

      if (event === 'SIGNED_OUT' || !session?.user) {
        if (isMountedRef.current && currentSeq === sequenceRef.current) {
          resetAuthState(true);
        }
        return;
      }

      // Hindari re-verifikasi berulang saat TOKEN_REFRESHED jika user ID sama
      if (event === 'TOKEN_REFRESHED' && session.user.id === lastVerifiedUidRef.current) {
        return;
      }

      verifyRoleFromDatabase(session.user, currentSeq);
    });

    return () => {
      isMountedRef.current = false;
      ++sequenceRef.current;
      subscription?.unsubscribe();
    };
  }, [verifyRoleFromDatabase, resetAuthState]);

  const normalizedRole = (role || '').toLowerCase();

  const isSuperAdmin = normalizedRole === 'superadmin';
  const isOwner = normalizedRole === 'owner' || isSuperAdmin;
  const isAdmin = normalizedRole === 'admin' || isOwner;
  const isKasir = normalizedRole === 'kasir' || isAdmin;
  const isCoach = normalizedRole === 'coach' || normalizedRole === 'pelatih';
  const isStaff = normalizedRole === 'staff' || isKasir || isCoach;

  // Hierarki RBAC Manajemen Staf:
  // Owner & Superadmin berhak mengundang Admin, Kasir, Coach, Staff.
  // Admin HANYA berhak mengundang Kasir, Coach, Staff (DILARANG mengundang Owner/Admin).
  const canManageStaff = isOwner || isAdmin;
  const canInviteAdmins = isOwner || isSuperAdmin; // Admin TIDAK boleh mengundang Admin lain

  return {
    role: normalizedRole,
    tenantId,
    verifiedFromDb,
    isSuperAdmin,
    isOwner,
    isAdmin,
    isKasir,
    isCoach,
    isStaff,
    canManageStaff,
    canInviteAdmins,
    loading,
    refreshClaims: async () => {
      lastVerifiedUidRef.current = null; // Paksa refresh
      const currentSeq = ++sequenceRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      await verifyRoleFromDatabase(user, currentSeq);
    },
  };
}
