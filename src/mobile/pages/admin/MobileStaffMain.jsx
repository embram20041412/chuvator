import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  User, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  Clock, 
  Ban, 
  Share2, 
  Info, 
  X, 
  Send, 
  Filter,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { supabase } from '../../../config/supabase';
import { 
  createStaffInvitation, 
  getStaffListByTenant, 
  getInvitationsByTenant, 
  revokeStaffInvitation, 
  deleteStaffDoc, 
  formatInvitationExpiry 
} from '../../../services/staffService';
import useAuthRole from '../../../hooks/useAuthRole';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileAvatar from '../../components/MobileAvatar';
import MobileBadge from '../../components/MobileBadge';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileTenantBackfillCard from '../../components/MobileTenantBackfillCard';

/**
 * Strict UUID Validator for Database Tenant IDs
 * Ensures tenantId matches canonical hex 8-4-4-4-12 UUID format.
 * Rejects 'global', 'null', 'undefined', empty strings, and non-UUID formats.
 */
export const isValidUUID = (id) => {
  if (!id || typeof id !== 'string') return false;
  const cleanId = id.trim().toLowerCase();
  if (['global', 'null', 'undefined', ''].includes(cleanId)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(cleanId);
};

/**
 * Canonical Tenant ID Resolver for CHUVATOR Mobile Staff
 * Strictly adheres to tenant hierarchy: profile.tenant.id, profile.tenantId, profile.tenant.tenant_id.
 * NEVER falls back to userProfile.id or userProfile.uid (User ID is NOT a Tenant ID).
 */
export const resolveTenantId = (profile) => {
  if (!profile) return null;
  const rawId = profile.tenant?.id || profile.tenantId || profile.tenant?.tenant_id || null;
  return isValidUUID(rawId) ? rawId : null;
};

/**
 * MobileStaffMain Component
 * Mobile-First Staff & Access Management for CHUVATOR Sports Arena & Academy ERP.
 * Strictly scoped under .chua-mobile-app with >=44px touch targets and native mobile ergonomics.
 * Eliminates all window.alert and window.confirm calls with rich bottom sheets.
 */
export default function MobileStaffMain({ userProfile }) {
  const authRole = useAuthRole(userProfile);
  const { 
    role: verifiedRole, 
    tenantId: verifiedTenantId,
    isSuperAdmin: verifiedSuperAdmin, 
    loading: roleLoading 
  } = authRole;

  // Single Source of Truth: Canonical DB-Verified UUID Tenant ID via useAuthRole
  // Strict UUID validation: rejects non-UUID strings, empty, null, undefined, 'global'.
  const rawVerifiedTenantId = String(verifiedTenantId || '').trim();
  const tenantId = isValidUUID(rawVerifiedTenantId) ? rawVerifiedTenantId : null;
  const tenantName = userProfile?.tenant?.name || 'Cabang Aktif';

  // Explicit Verified Role Hierarchy from useAuthRole (NOT userProfile.role directly)
  // Superadmin, Coach, Kasir, and Staff MUST BE DENIED access.
  const canonicalVerifiedRole = String(verifiedRole || '').trim().toLowerCase();
  const isSuperadminVerified = verifiedSuperAdmin || canonicalVerifiedRole === 'superadmin';
  const isOwnerVerified = canonicalVerifiedRole === 'owner' && !isSuperadminVerified;
  const isAdminVerified = canonicalVerifiedRole === 'admin' && !isSuperadminVerified;
  
  // Access decision relies 100% on verified hook result and valid verified tenant context
  const isAllowedStaffManager = (isOwnerVerified || isAdminVerified) && !isSuperadminVerified && !roleLoading && Boolean(tenantId);

  // Hierarchy: Only verified tenant Owner can invite new Admins on Mobile Staff
  const canInviteAdminsMobile = isOwnerVerified && !roleLoading && Boolean(tenantId);

  // Verified user profile context passed to downstream components (e.g., MobileTenantBackfillCard)
  const verifiedUserProfile = useMemo(() => {
    return {
      ...userProfile,
      role: canonicalVerifiedRole,
      tenantId: tenantId,
      tenant: {
        ...(userProfile?.tenant || {}),
        id: tenantId,
        name: tenantName,
      },
    };
  }, [userProfile, canonicalVerifiedRole, tenantId, tenantName]);

  // Refs for Tenant Switching & Component Lifecycle Safety
  const activeTenantIdRef = useRef(tenantId);
  const fetchSeqRef = useRef(0);
  const isMountedRef = useRef(true);

  // Navigation Tabs: 'staff_list' | 'invitations_list'
  const [activeTab, setActiveTab] = useState('staff_list');

  // Data states
  const [staffList, setStaffList] = useState([]);
  const [allInvitations, setAllInvitations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'admin' | 'kasir' | 'coach' | 'staff'
  const [invitationStatusFilter, setInvitationStatusFilter] = useState('all'); // 'all' | 'pending' | 'accepted' | 'expired' | 'revoked'

  // In-Memory Storage for Invite Links created in this browser session (Secure SHA-256 raw token retention)
  const [sessionInviteLinks, setSessionInviteLinks] = useState({});

  // Bottom Sheets State
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showInviteSuccessSheet, setShowInviteSuccessSheet] = useState(false);
  const [inviteSuccessData, setInviteSuccessData] = useState(null);

  const [staffToDelete, setStaffToDelete] = useState(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  const [invitationToRevoke, setInvitationToRevoke] = useState(null);
  const [isRevokingInvitation, setIsRevokingInvitation] = useState(false);

  // Form states inside Invite Sheet
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [staffRole, setStaffRole] = useState('kasir');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [formError, setFormError] = useState(null);

  // Feedback banner state
  const [actionFeedback, setActionFeedback] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // State-during-render Reset Pass: Idiomatic React state adjustment on tenant context change
  // Guarantees zero stale tenant data, modals, links, or filters render before effects run
  const [prevTenantId, setPrevTenantId] = useState(tenantId);
  if (prevTenantId !== tenantId) {
    setPrevTenantId(tenantId);
    setStaffList([]);
    setAllInvitations([]);
    setSessionInviteLinks({});
    setShowInviteSheet(false);
    setShowInviteSuccessSheet(false);
    setInviteSuccessData(null);
    setStaffToDelete(null);
    setInvitationToRevoke(null);
    setSearchQuery('');
    setRoleFilter('all');
    setInvitationStatusFilter('all');
    setActionFeedback(null);
    setFormError(null);
  }

  /**
   * DOCUMENTATION - SERVICE ERROR HANDLING CONTRACT LIMITATION:
   * Note: getStaffListByTenant() and getInvitationsByTenant() in staffService.js
   * catch all query errors and return an empty array ([]).
   * Consequently, the mobile UI receives an empty array for both genuine
   * empty datasets and failed database queries. The mobile interface cannot
   * distinguish between a query failure and zero data records via the current service contract.
   */
  const fetchData = useCallback(async () => {
    const currentTenant = activeTenantIdRef.current;
    if (!currentTenant || !isAllowedStaffManager) {
      if (isMountedRef.current) setLoadingData(false);
      return;
    }

    const currentSeq = fetchSeqRef.current;
    if (isMountedRef.current) setLoadingData(true);

    try {
      const [staffResult, invitesResult] = await Promise.all([
        getStaffListByTenant(currentTenant),
        getInvitationsByTenant(currentTenant),
      ]);

      // Guard: Only update state if component is mounted, tenant hasn't changed, and sequence matches
      if (
        isMountedRef.current &&
        activeTenantIdRef.current === currentTenant &&
        fetchSeqRef.current === currentSeq
      ) {
        setStaffList(staffResult || []);
        setAllInvitations(invitesResult || []);
      }
    } catch (error) {
      if (
        isMountedRef.current &&
        activeTenantIdRef.current === currentTenant &&
        fetchSeqRef.current === currentSeq
      ) {
        console.error('[MobileStaffMain] Error fetching data:', error);
        setActionFeedback({
          type: 'error',
          text: 'Gagal memuat data staf: ' + (error.message || 'Kesalahan jaringan'),
        });
      }
    } finally {
      if (
        isMountedRef.current &&
        activeTenantIdRef.current === currentTenant &&
        fetchSeqRef.current === currentSeq
      ) {
        setLoadingData(false);
      }
    }
  }, [isAllowedStaffManager]);

  useEffect(() => {
    isMountedRef.current = true;

    // Detect tenant change & invalidate inflight requests for previous tenant
    if (activeTenantIdRef.current !== tenantId) {
      activeTenantIdRef.current = tenantId;
      fetchSeqRef.current += 1;
    }

    if (!tenantId || !isAllowedStaffManager) {
      setLoadingData(false);
      return;
    }

    fetchData();

    // Realtime listener for users_staff and invitations of active tenant
    const channelName = `realtime_mobile_staff_${tenantId}`;
    try {
      const existingChannels = (supabase.getChannels ? supabase.getChannels() : []) || [];
      const match = existingChannels.find(
        (c) => c && (c.topic === `realtime:${channelName}` || c.topic === channelName)
      );
      if (match) {
        supabase.removeChannel(match);
      }
    } catch (_) {}

    const staffChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users_staff', filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations', filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      fetchSeqRef.current += 1;
      supabase.removeChannel(staffChannel);
    };
  }, [tenantId, isAllowedStaffManager, fetchData]);

  // Handler: Invite Staff Form Submission
  const handleInviteStaff = async (e) => {
    if (e) e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanEmail || !cleanDisplayName) {
      setFormError('Nama lengkap dan alamat email staf wajib diisi.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError('Format email tidak valid.');
      return;
    }

    // RBAC Hierarchy Enforcement: Only Owner can invite Admin on Mobile Staff
    if (!canInviteAdminsMobile && staffRole === 'admin') {
      setFormError('Akses ditolak: Hanya Pemilik (Owner) yang berwenang mengangkat Admin baru.');
      return;
    }

    if (!tenantId) {
      setFormError('Konteks cabang (Tenant ID) tidak tersedia.');
      return;
    }

    setIsSubmittingInvite(true);

    try {
      const result = await createStaffInvitation({
        tenantId,
        email: cleanEmail,
        role: staffRole,
        fullName: cleanDisplayName,
        displayName: cleanDisplayName,
      });

      const invId = result.invitationId || result.invitation?.invitation_id || result.invitation?.id;

      // Store raw link in memory session state
      if (result.inviteUrl) {
        setSessionInviteLinks((prev) => ({
          ...prev,
          ...(invId ? { [invId]: result.inviteUrl } : {}),
          [cleanEmail]: result.inviteUrl,
        }));
      }

      setInviteSuccessData({
        inviteUrl: result.inviteUrl,
        email: cleanEmail,
        role: result.role,
        tenantName: tenantName,
        expiresAt: result.expiresAt,
        createdAt: result.invitation?.created_at || new Date().toISOString(),
        invitationId: invId,
      });

      // Reset form & switch to success modal
      setEmail('');
      setDisplayName('');
      setStaffRole('kasir');
      setShowInviteSheet(false);
      setShowInviteSuccessSheet(true);

      setActionFeedback({
        type: 'success',
        text: `Undangan untuk ${cleanEmail} berhasil dibuat!`,
      });

      fetchData();
    } catch (err) {
      console.error('[MobileStaffMain] Error inviting staff:', err);
      setFormError(err.message || 'Gagal menerbitkan undangan staf di database.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Handler: Confirm Revoke Invitation (replaces alert/confirm)
  const executeRevokeInvitation = async () => {
    if (!invitationToRevoke) return;

    setIsRevokingInvitation(true);
    try {
      await revokeStaffInvitation(invitationToRevoke.id);
      setActionFeedback({
        type: 'success',
        text: `Undangan untuk ${invitationToRevoke.email} berhasil dibatalkan.`,
      });
      setInvitationToRevoke(null);
      fetchData();
    } catch (err) {
      console.error('[MobileStaffMain] Error revoking invitation:', err);
      setActionFeedback({
        type: 'error',
        text: 'Gagal membatalkan undangan: ' + (err.message || 'Terjadi kesalahan sistem'),
      });
    } finally {
      setIsRevokingInvitation(false);
    }
  };

  // Handler: Confirm Delete Staff (replaces window.confirm)
  const executeDeleteStaff = async () => {
    if (!staffToDelete) return;

    setIsDeletingStaff(true);
    try {
      await deleteStaffDoc(staffToDelete.id);
      setActionFeedback({
        type: 'success',
        text: `Data staf "${staffToDelete.name}" berhasil dihapus.`,
      });
      setStaffToDelete(null);
      fetchData();
    } catch (err) {
      console.error('[MobileStaffMain] Error deleting staff:', err);
      setActionFeedback({
        type: 'error',
        text: 'Gagal menghapus data staf: ' + (err.message || 'Terjadi kesalahan sistem'),
      });
    } finally {
      setIsDeletingStaff(false);
    }
  };

  // Handler: Copy Link with user feedback
  const handleCopyLink = (key, url) => {
    if (!url) return;
    try {
      navigator.clipboard.writeText(url);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Handler: Native Web Share API if available
  const handleShareLink = async (url, emailTarget, roleTarget) => {
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Undangan Staf CHUVATOR - ${tenantName}`,
          text: `Halo, Anda diundang bergabung sebagai staf (${roleTarget?.toUpperCase()}) di ${tenantName}. Silakan buka tautan berikut untuk mengklaim akun Anda:`,
          url: url,
        });
        return;
      } catch (e) {
        // User cancelled or share not allowed, fallback to copy
      }
    }
    // Fallback: Copy to clipboard
    handleCopyLink('modal', url);
  };

  // Auto-dismiss feedback message after 4s
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Filtered lists
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        (s.displayName || s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || s.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [staffList, searchQuery, roleFilter]);

  const filteredInvitations = useMemo(() => {
    return allInvitations.filter((inv) => {
      const matchesStatus = invitationStatusFilter === 'all' || inv.status === invitationStatusFilter;
      const matchesSearch = (inv.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [allInvitations, searchQuery, invitationStatusFilter]);

  const pendingCount = useMemo(() => {
    return allInvitations.filter((inv) => inv.status === 'pending').length;
  }, [allInvitations]);

  // 1. Loading State while useAuthRole verifies role from database (prevents temporary access leak)
  if (roleLoading) {
    return (
      <div className="chua-mobile-app min-h-screen bg-[#F5F7FC] p-4 flex items-center justify-center text-slate-800">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-sm shadow-sm space-y-3">
          <Loader2 className="w-8 h-8 text-[#2455E8] animate-spin mx-auto" />
          <h2 className="text-sm font-bold text-slate-900 my-0">Memverifikasi Otorisasi Akses...</h2>
          <p className="text-xs text-slate-500 leading-relaxed my-0">
            Sistem sedang memverifikasi hak akses akun Anda di basis data cabang.
          </p>
        </div>
      </div>
    );
  }

  // 2. Restricted Access Screen (403 for Superadmin, Kasir, Coach, Staff, or unverified)
  if (!isAllowedStaffManager) {
    return (
      <div className="chua-mobile-app min-h-screen bg-[#F5F7FC] p-4 flex items-center justify-center text-slate-800">
        <div className="bg-white border border-rose-200 rounded-2xl p-6 text-center max-w-sm shadow-sm space-y-3">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Akses Terbatas: Khusus Owner / Admin</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Halaman Manajemen Staf &amp; Hak Akses hanya dapat diakses oleh Pemilik (Owner) atau Admin cabang aktif. Peran Superadmin atau staf non-pengelola tidak memiliki akses ke fasilitas operasional tenant ini.
          </p>
        </div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="chua-mobile-app min-h-screen bg-[#F5F7FC] p-4 flex items-center justify-center text-slate-800">
        <div className="bg-white border border-amber-200 rounded-2xl p-6 text-center max-w-sm shadow-sm space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Konteks Cabang (Tenant) Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Akun Anda tidak memiliki asosiasi cabang/tenant yang valid. Hubungi administrator sistem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chua-mobile-app min-h-screen bg-[#F5F7FC] text-slate-800 pb-24">
      {/* 1. TOP HEADER & HERO BANNER */}
      <div className="bg-[#101D38] text-white p-4 pt-5 rounded-b-[24px] shadow-md relative overflow-hidden">
        {/* Subtle decorative shapes */}
        <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-12 -bottom-10 w-24 h-24 rounded-full bg-[#2455E8]/20 pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-white leading-tight my-0">
                  Manajemen Staf &amp; Akses
                </h1>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5 truncate max-w-[200px]">
                  {tenantName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={loadingData}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-white/10"
              aria-label="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin text-amber-300' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-300">
              <span className="font-bold text-white font-mono">{staffList.length}</span> Staf Aktif
              <span className="mx-1.5 opacity-40">•</span>
              <span className="font-bold text-amber-300 font-mono">{pendingCount}</span> Undangan Pending
            </div>

            {/* Quick Action: Button to open Invite Sheet */}
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setShowInviteSheet(true);
              }}
              className="px-3.5 py-1.5 bg-[#2455E8] hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Undang Staf</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. INLINE FEEDBACK TOAST BANNER */}
      {actionFeedback && (
        <div className="px-3.5 pt-3 animate-fadeIn">
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionFeedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Tutup pesan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. SEGMENTED TABS (STAF AKTIF VS UNDANGAN VS AUDIT HMAC) */}
      <div className="px-3.5 pt-3.5">
        <div className={`grid ${(isOwnerVerified || isAdminVerified) ? 'grid-cols-3' : 'grid-cols-2'} bg-slate-200/70 p-1 rounded-2xl gap-1`}>
          <button
            type="button"
            onClick={() => setActiveTab('staff_list')}
            className={`py-2 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[44px] ${
              activeTab === 'staff_list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staf ({staffList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invitations_list')}
            className={`py-2 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[44px] relative ${
              activeTab === 'invitations_list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Undangan ({allInvitations.length})</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-black rounded-full">
                {pendingCount}
              </span>
            )}
          </button>

          {(isOwnerVerified || isAdminVerified) && (
            <button
              type="button"
              onClick={() => setActiveTab('audit_hmac')}
              className={`py-2 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[44px] ${
                activeTab === 'audit_hmac'
                  ? 'bg-[#101D38] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Audit HMAC</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB CONTENT: AUDIT HMAC */}
      {activeTab === 'audit_hmac' && (
        <div className="px-3.5 pt-3 animate-fadeIn">
          <MobileTenantBackfillCard userProfile={verifiedUserProfile} />
        </div>
      )}

      {/* 4. SEARCH & FILTER CONTROLS */}
      {activeTab !== 'audit_hmac' && (
        <div className="px-3.5 pt-3 space-y-2">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === 'staff_list' ? 'Cari nama atau email staf...' : 'Cari email undangan...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-xs bg-white border border-[#E7EBF2] rounded-xl focus:outline-none focus:border-[#2455E8] focus:ring-1 focus:ring-[#2455E8] text-slate-800 placeholder-slate-400 shadow-2xs min-h-[44px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              aria-label="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Horizontal Filter Chips */}
        {activeTab === 'staff_list' ? (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'Semua Role' },
              { id: 'admin', label: 'Admin' },
              { id: 'kasir', label: 'Kasir' },
              { id: 'coach', label: 'Coach' },
              { id: 'staff', label: 'Staf' },
            ].map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRoleFilter(rf.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[36px] ${
                  roleFilter === rf.id
                    ? 'bg-[#101D38] text-white shadow-xs'
                    : 'bg-white border border-[#E7EBF2] text-slate-600 hover:bg-slate-50'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'Semua Status' },
              { id: 'pending', label: `Pending (${allInvitations.filter((i) => i.status === 'pending').length})` },
              { id: 'accepted', label: `Accepted (${allInvitations.filter((i) => i.status === 'accepted').length})` },
              { id: 'expired', label: `Kedaluwarsa (${allInvitations.filter((i) => i.status === 'expired').length})` },
              { id: 'revoked', label: `Dibatalkan (${allInvitations.filter((i) => i.status === 'revoked').length})` },
            ].map((sf) => (
              <button
                key={sf.id}
                type="button"
                onClick={() => setInvitationStatusFilter(sf.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[36px] ${
                  invitationStatusFilter === sf.id
                    ? 'bg-[#101D38] text-white shadow-xs'
                    : 'bg-white border border-[#E7EBF2] text-slate-600 hover:bg-slate-50'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* 5. TAB 1: STAFF DIRECTORY (CARD-BASED MOBILE PRESENTATION) */}
      {activeTab === 'staff_list' && (
        <div className="px-3.5 pt-2 space-y-2.5">
          {loadingData ? (
            <div className="space-y-2.5 pt-1 animate-pulse">
              <div className="h-24 bg-white border border-slate-200 rounded-2xl w-full" />
              <div className="h-24 bg-white border border-slate-200 rounded-2xl w-full" />
              <div className="h-24 bg-white border border-slate-200 rounded-2xl w-full" />
            </div>
          ) : filteredStaff.length === 0 ? (
            <MobileEmptyState
              title="Tidak Ada Staf Ditemukan"
              description={
                searchQuery || roleFilter !== 'all'
                  ? 'Tidak ada staf yang sesuai dengan kata kunci atau filter yang dipilih.'
                  : 'Belum ada anggota staf di cabang ini. Terbitkan undangan baru sekarang.'
              }
              action={
                <button
                  type="button"
                  onClick={() => setShowInviteSheet(true)}
                  className="px-4 py-2 bg-[#2455E8] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer min-h-[44px]"
                >
                  + Terbitkan Undangan Staf
                </button>
              }
            />
          ) : (
            filteredStaff.map((staff) => {
              const roleDisplay = (staff.role || 'kasir').toUpperCase();
              const roleVariant =
                staff.role === 'admin'
                  ? 'purple'
                  : staff.role === 'coach' || staff.role === 'pelatih'
                  ? 'emerald'
                  : staff.role === 'kasir'
                  ? 'blue'
                  : 'neutral';

              return (
                <div
                  key={staff.id}
                  className="bg-white border border-[#E7EBF2] rounded-2xl p-3.5 shadow-2xs space-y-2.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MobileAvatar
                        src={staff.avatarUrl}
                        name={staff.displayName || staff.name || 'Staf'}
                        size="md"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 truncate my-0">
                          {staff.displayName || staff.name || 'Staf'}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                          {staff.email}
                        </p>
                      </div>
                    </div>

                    {/* Delete action trigger (opens bottom sheet confirmation, eliminating window.confirm) */}
                    <button
                      type="button"
                      onClick={() => setStaffToDelete({ id: staff.id, name: staff.displayName || staff.name || 'Staf' })}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                      title="Hapus Staf"
                      aria-label={`Hapus ${staff.displayName || staff.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Metadata Row: Role, Auth UID Binding, Joined Date */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wider ${
                        roleVariant === 'purple' ? 'bg-purple-100 text-purple-800' :
                        roleVariant === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
                        roleVariant === 'blue' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {roleDisplay}
                      </span>

                      {staff.isBound ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">
                          <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Terikat Auth UID</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 font-bold rounded">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Menunggu Klaim</span>
                        </span>
                      )}
                    </div>

                    <span className="text-slate-400">
                      {staff.createdAt
                        ? new Date(staff.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 6. TAB 2: INVITATIONS DIRECTORY (CARD-BASED MOBILE PRESENTATION) */}
      {activeTab === 'invitations_list' && (
        <div className="px-3.5 pt-2 space-y-2.5">
          {loadingData ? (
            <div className="space-y-2.5 pt-1 animate-pulse">
              <div className="h-28 bg-white border border-slate-200 rounded-2xl w-full" />
              <div className="h-28 bg-white border border-slate-200 rounded-2xl w-full" />
              <div className="h-28 bg-white border border-slate-200 rounded-2xl w-full" />
            </div>
          ) : filteredInvitations.length === 0 ? (
            <MobileEmptyState
              title="Tidak Ada Undangan"
              description={
                searchQuery || invitationStatusFilter !== 'all'
                  ? 'Tidak ada data undangan dengan filter yang Anda tentukan.'
                  : 'Belum ada undangan yang diterbitkan. Anda dapat mengundang staf baru kapan saja.'
              }
              action={
                <button
                  type="button"
                  onClick={() => setShowInviteSheet(true)}
                  className="px-4 py-2 bg-[#2455E8] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer min-h-[44px]"
                >
                  + Terbitkan Undangan Staf
                </button>
              }
            />
          ) : (
            filteredInvitations.map((inv) => {
              const sessionUrl = sessionInviteLinks[inv.id] || sessionInviteLinks[inv.email];
              const isPending = inv.status === 'pending';

              return (
                <div
                  key={inv.id}
                  className="bg-white border border-[#E7EBF2] rounded-2xl p-3.5 shadow-2xs space-y-2.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold font-mono text-slate-900 truncate">
                          {inv.email}
                        </span>
                        <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black rounded uppercase">
                          {inv.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Dibuat:{' '}
                        {inv.createdAt
                          ? new Date(inv.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {inv.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Pending</span>
                        </span>
                      )}
                      {inv.status === 'accepted' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Accepted</span>
                        </span>
                      )}
                      {inv.status === 'expired' && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold text-[10px]">
                          Kedaluwarsa
                        </span>
                      )}
                      {inv.status === 'revoked' && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[10px]">
                          Dibatalkan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expiry info */}
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Masa berlaku: {formatInvitationExpiry(inv.expiresAt, inv.createdAt)}</span>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Secure session invite URL link action */}
                    {sessionUrl ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(inv.id, sessionUrl)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-h-[44px]"
                        >
                          {copiedId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Tautan</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareLink(sessionUrl, inv.email, inv.role)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label="Bagikan Tautan Undangan"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        Tautan hanya ada di memori sesi awal
                      </span>
                    )}

                    {/* Revoke button (opens Bottom Sheet confirmation) */}
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => setInvitationToRevoke({ id: inv.id, email: inv.email })}
                        className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer min-h-[44px]"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Batalkan</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          BOTTOM SHEETS SECTION (ELIMINATES ALL BROWSER POPUPS/ALERTS)
          ========================================================================= */}

      {/* 1. BOTTOM SHEET: FORM BUAT UNDANGAN STAF BARU */}
      <MobileBottomSheet
        isOpen={showInviteSheet}
        onClose={() => {
          if (!isSubmittingInvite) setShowInviteSheet(false);
        }}
        title="Undang Anggota Staf Baru"
      >
        <form onSubmit={handleInviteStaff} className="space-y-3.5 text-left text-slate-800">
          <p className="text-xs text-slate-500 leading-relaxed my-0">
            Penerbitan token undangan resmi database (<code>create_staff_invitation</code>). Token di-hash dengan SHA-256 dan berlaku 7 hari.
          </p>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Nama Lengkap */}
          <div>
            <label htmlFor="m-staff-name" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              Nama Lengkap Staf <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="m-staff-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ahmad Kasir"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:bg-white focus:outline-none focus:border-[#2455E8] min-h-[48px]"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="m-staff-email" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              Alamat Email Staf <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="m-staff-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staf@domain.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:bg-white focus:outline-none focus:border-[#2455E8] font-mono min-h-[48px]"
              />
            </div>
          </div>

          {/* Role Selection (RBAC) */}
          <div>
            <label htmlFor="m-staff-role" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              Peran Akses (RBAC) <span className="text-rose-500">*</span>
            </label>
            <select
              id="m-staff-role"
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:bg-white focus:outline-none focus:border-[#2455E8] font-bold text-slate-800 min-h-[48px]"
            >
              <option value="kasir">Kasir (Transaksi POS &amp; Jadwal Lapangan)</option>
              <option value="coach">Pelatih (Manajemen Kelas &amp; Siswa Akademi)</option>
              <option value="staff">Staf Operasional (Akses Umum Operasional)</option>
              {canInviteAdminsMobile && (
                <option value="admin">Admin Cabang (Kelola Staf &amp; Keuangan)</option>
              )}
            </select>
            {!canInviteAdminsMobile && (
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                * Pengangkatan Admin baru hanya dapat dilakukan oleh Pemilik (Owner).
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmittingInvite}
              onClick={() => setShowInviteSheet(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[48px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingInvite}
              className="px-6 py-2.5 bg-[#2455E8] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
            >
              {isSubmittingInvite ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menerbitkan...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Terbitkan Undangan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </MobileBottomSheet>

      {/* 2. BOTTOM SHEET: DIALOG SUKSES TERBITKAN UNDANGAN & TAUTAN */}
      <MobileBottomSheet
        isOpen={showInviteSuccessSheet}
        onClose={() => setShowInviteSuccessSheet(false)}
        title="Undangan Berhasil Diterbitkan!"
      >
        {inviteSuccessData && (
          <div className="space-y-3.5 text-left text-slate-800">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold my-0">Token Undangan Terdaftar</p>
                <p className="text-[11px] text-emerald-700 my-0">
                  Undangan resmi telah disimpan di Supabase RLS dengan SHA-256 hash.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Email Penerima:</span>
                <span className="font-mono font-bold text-slate-900">{inviteSuccessData.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Role:</span>
                <span className="px-2 py-0.2 bg-blue-100 text-blue-800 font-bold rounded uppercase text-[10px]">
                  {inviteSuccessData.role}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Masa Berlaku:</span>
                <span className="font-semibold text-amber-700">
                  {formatInvitationExpiry(inviteSuccessData.expiresAt, inviteSuccessData.createdAt)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="m-invite-url" className="block text-[11px] font-extrabold text-slate-700 uppercase">
                Tautan Undangan Lengkap
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="m-invite-url"
                  type="text"
                  readOnly
                  value={inviteSuccessData.inviteUrl}
                  className="flex-1 px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-xl font-mono text-slate-800 select-all focus:outline-none min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink('modal', inviteSuccessData.inviteUrl)}
                  className="px-3.5 py-2 bg-[#2455E8] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer min-h-[44px]"
                >
                  {copiedId === 'modal' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Penting:</strong> Salin atau bagikan tautan ini sekarang. Tautan mentah tidak dapat dimunculkan kembali setelah halaman dimuat ulang demi keamanan.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleShareLink(inviteSuccessData.inviteUrl, inviteSuccessData.email, inviteSuccessData.role)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Bagikan</span>
              </button>
              <button
                type="button"
                onClick={() => setShowInviteSuccessSheet(false)}
                className="px-5 py-2 bg-[#101D38] hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[44px]"
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </MobileBottomSheet>

      {/* 3. BOTTOM SHEET: KONFIRMASI HAPUS STAF (MENGGANTIKAN window.confirm) */}
      <MobileBottomSheet
        isOpen={Boolean(staffToDelete)}
        onClose={() => {
          if (!isDeletingStaff) setStaffToDelete(null);
        }}
        title="Hapus Akun Staf?"
      >
        {staffToDelete && (
          <div className="space-y-4 text-left text-slate-800">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-bold my-0">Tindakan Destruktif</p>
                <p className="text-[11px] text-rose-700 my-0">
                  Data staf dan ikatan akun di cabang ini akan dicabut permanen.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed my-0">
              Apakah Anda yakin ingin menghapus staf <strong className="text-slate-900">{staffToDelete.name}</strong>?
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[48px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={executeDeleteStaff}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                {isDeletingStaff ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Staf</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </MobileBottomSheet>

      {/* 4. BOTTOM SHEET: KONFIRMASI BATALKAN UNDANGAN (MENGGANTIKAN MODAL POPUP DESKTOP) */}
      <MobileBottomSheet
        isOpen={Boolean(invitationToRevoke)}
        onClose={() => {
          if (!isRevokingInvitation) setInvitationToRevoke(null);
        }}
        title="Batalkan Undangan Staf?"
      >
        {invitationToRevoke && (
          <div className="space-y-4 text-left text-slate-800">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800">
              <Ban className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold my-0">Pembatalan Token Undangan</p>
                <p className="text-[11px] text-amber-700 my-0">
                  Tautan yang telah diterbitkan tidak akan bisa digunakan lagi.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed my-0">
              Apakah Anda yakin ingin membatalkan undangan untuk{' '}
              <strong className="text-slate-900 font-mono">{invitationToRevoke.email}</strong>?
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isRevokingInvitation}
                onClick={() => setInvitationToRevoke(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[48px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isRevokingInvitation}
                onClick={executeRevokeInvitation}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                {isRevokingInvitation ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ya, Batalkan Undangan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
}
