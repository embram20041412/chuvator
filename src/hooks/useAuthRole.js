import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase.js';

/**
 * Custom Hook untuk membaca dan memverifikasi peran pengguna (Role) serta Tenant ID
 * secara langsung dari SUMBER DATABASE RESMI SUPABASE (PostgreSQL Tables & RPC).
 *
 * JAMINAN KEAMANAN & LIFECYCLE:
 * 1. Epoch / Sequence Counter: Setiap event auth atau verifikasi menyimpan sequence. Hasil async
 *    dari verifikasi lama (stale) otomatis dibuang jika session telah berubah.
 * 2. Fail-Closed: Error RPC atau ketiadaan data selalu menghasilkan role null dan tidak ada eskalasi.
 * 3. Immediate Reset: Ketika SIGNED_OUT terjadi, state segera direset tanpa menunggu DB query.
 * 4. Superadmin Binding: Bootstrap hanya dipanggil jika !superErr && isSuper === false.
 * 5. Kolom Kanonis: Hanya menggunakan auth_uid pada platform_superadmins (BUKAN user_id).
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

  const resetAuthState = useCallback((isVerified = true) => {
    setRole(null);
    setTenantId(null);
    setVerifiedFromDb(isVerified);
    setLoading(false);
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

      // 1. Periksa apakah pengguna adalah Platform Superadmin via RPC tepercaya
      try {
        const { data: isSuper, error: superErr } = await supabase.rpc('is_superadmin');
        
        if (superErr) {
          console.warn('[useAuthRole] is_superadmin RPC error:', superErr.message || superErr);
        }

        if (!superErr && isSuper === true) {
          if (isMountedRef.current && expectedSeq === sequenceRef.current) {
            setRole('superadmin');
            setTenantId(userProfile?.tenantId || null);
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
                  setTenantId(userProfile?.tenantId || null);
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
            setTenantId(userProfile?.tenantId || null);
            setVerifiedFromDb(true);
            setLoading(false);
          }
          return;
        }
      } catch (e) {
        // Abaikan jika RPC/tabel tidak tersedia / anon
      }

      // 2. Periksa apakah pengguna adalah Owner dari tenant aktif di tabel `tenants`
      try {
        const { data: ownerTenant, error: ownerErr } = await supabase
          .from('tenants')
          .select('id, tenant_id, name, is_active')
          .eq('owner_uid', callerUid)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!ownerErr && ownerTenant) {
          const resolvedTid = ownerTenant.tenant_id || ownerTenant.id;
          if (isMountedRef.current && expectedSeq === sequenceRef.current) {
            setRole('owner');
            setTenantId(resolvedTid);
            setVerifiedFromDb(true);
            setLoading(false);
          }
          return;
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
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!staffErr && staffRecord) {
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
      } catch (e) {
        console.warn('[useAuthRole] Check users_staff warning:', e);
      }

      // 4. Jika userProfile menyediakan tenantId, periksa langsung ke RPC database
      const fallbackTenantId = userProfile?.tenantId || userProfile?.tenant?.id;
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
  }, [userProfile, resetAuthState]);

  useEffect(() => {
    isMountedRef.current = true;

    // Supabase Auth Listener: Satu sumber kebenaran untuk siklus hidup autentikasi.
    // Menghindari duplikasi eksekusi paralel getUser() dan onAuthStateChange().
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentSeq = ++sequenceRef.current;

      if (event === 'SIGNED_OUT' || !session?.user) {
        if (isMountedRef.current && currentSeq === sequenceRef.current) {
          resetAuthState(true);
        }
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
      const currentSeq = ++sequenceRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      await verifyRoleFromDatabase(user, currentSeq);
    },
  };
}
