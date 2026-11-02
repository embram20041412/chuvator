import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

/**
 * Custom Hook untuk membaca dan memverifikasi peran pengguna (Role) serta Tenant ID
 * secara langsung dari SUMBER DATABASE RESMI SUPABASE (PostgreSQL Tables & RPC).
 *
 * ATURAN KEAMANAN:
 * - DILARANG menggunakan `user_metadata` atau `localStorage` untuk otorisasi keamanan atau tenant isolation.
 * - Peran diverifikasi via RPC `is_superadmin()`, tabel `tenants`, tabel `users_staff`, dan RPC `get_user_tenant_role()`.
 */
export default function useAuthRole(userProfile) {
  const [role, setRole] = useState(userProfile?.role || null);
  const [tenantId, setTenantId] = useState(
    userProfile?.tenantId || userProfile?.tenant?.id || null
  );
  const [verifiedFromDb, setVerifiedFromDb] = useState(false);
  const [loading, setLoading] = useState(true);

  const verifyRoleFromDatabase = useCallback(async (user) => {
    if (!user) {
      setRole(null);
      setTenantId(null);
      setVerifiedFromDb(false);
      setLoading(false);
      return;
    }

    try {
      const callerUid = user.id;

      // 1. Periksa apakah pengguna adalah Platform Superadmin via RPC tepercaya
      try {
        const { data: isSuper, error: superErr } = await supabase.rpc('is_superadmin');
        if (!superErr && isSuper === true) {
          setRole('superadmin');
          setTenantId(userProfile?.tenantId || null);
          setVerifiedFromDb(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Abaikan jika RPC tidak tersedia / anon
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
          setRole('owner');
          setTenantId(resolvedTid);
          setVerifiedFromDb(true);
          setLoading(false);
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
              setRole(rpcRole.toLowerCase());
              setTenantId(resolvedTid);
              setVerifiedFromDb(true);
              setLoading(false);
              return;
            }
          } catch (rErr) {
            // Fallback ke kolom users_staff yang diverifikasi
          }

          setRole(cleanRole);
          setTenantId(resolvedTid);
          setVerifiedFromDb(true);
          setLoading(false);
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
            setRole(rpcRole.toLowerCase());
            setTenantId(fallbackTenantId);
            setVerifiedFromDb(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          // ignore
        }
      }

      // Jika tidak terdaftar di database, set role null (fail-closed)
      setRole(null);
      setTenantId(fallbackTenantId || null);
      setVerifiedFromDb(true);
    } catch (err) {
      console.error('[useAuthRole] Verification error:', err);
      setRole(null);
      setTenantId(null);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (isMounted) {
        verifyRoleFromDatabase(user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        verifyRoleFromDatabase(session?.user || null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [verifyRoleFromDatabase]);

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
      const { data: { user } } = await supabase.auth.getUser();
      await verifyRoleFromDatabase(user);
    },
  };
}
