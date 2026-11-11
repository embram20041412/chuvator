import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Phone,
  Dumbbell,
  Save,
  CheckCircle2,
  AlertCircle,
  Upload,
  Loader2,
  RotateCcw,
  RefreshCw,
  Sun,
  Moon,
  LogOut,
  CreditCard
} from 'lucide-react';
import useArenaData from '../../../hooks/useArenaData';
import { updateTenantProfile } from '../../../services/supabaseArenaService';
import { logoutUser } from '../../../services/authService';
import { useTheme } from '../../../context/ThemeContext';
import MobileLoadingState from '../../components/MobileLoadingState';

export const SUPPORTED_SPORTS = [
  'Badminton',
  'Tenis',
  'Padel',
  'Squash',
  'Tenis Meja',
  'SepakBola',
  'Futsal',
  'Minisoccer',
  'BolaBasket 5v5',
  'BolaBasket 3v3',
  'Bola Voli indoor',
  'Bola Voli pasir',
  'Sepak Takraw'
];

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (matches uploadService.js)
const ALLOWED_LOGO_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Canonical Tenant ID Resolver for CHUVATOR Mobile Admin
 * Strictly resolves from profile.tenant.id || profile.tenantId || profile.tenant.tenant_id.
 * NEVER falls back to userProfile.id or userProfile.uid.
 */
export const resolveTenantId = (profile) => {
  if (!profile || typeof profile !== 'object') return null;
  const raw = profile.tenant?.id || profile.tenantId || profile.tenant?.tenant_id || null;
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
};

/**
 * Multi-Tenant Isolation Guard for Tenant Profile Data
 * Returns a tenant profile object ONLY if its id / tenant_id matches activeTenantId.
 * Prevents cross-tenant profile data from ever being rendered or edited.
 */
export function resolveIsolatedTenantProfile(fetchedTenantProfile, userProfile, activeTenantId) {
  if (!activeTenantId) return null;
  const normalizedActive = String(activeTenantId).trim();
  if (!normalizedActive) return null;

  const checkMatch = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const candidateId = candidate.id ?? candidate.tenant_id ?? candidate.tenantId;
    if (!candidateId) return false;
    return String(candidateId).trim() === normalizedActive;
  };

  if (checkMatch(fetchedTenantProfile)) {
    return fetchedTenantProfile;
  }
  if (checkMatch(userProfile?.tenant)) {
    return userProfile.tenant;
  }
  return null;
}

/**
 * Validate Tenant Profile Form Inputs
 */
export function validateTenantProfileInput({ name, phone, address, sportsType }) {
  const errors = {};
  const cleanName = String(name ?? '').trim();
  const cleanPhone = String(phone ?? '').trim();
  const cleanAddress = String(address ?? '').trim();
  const cleanSport = String(sportsType ?? '').trim();

  if (!cleanName) {
    errors.name = 'Nama GOR / Sports Arena wajib diisi.';
  }
  if (!cleanPhone) {
    errors.phone = 'Kontak WhatsApp / nomor telepon wajib diisi.';
  }
  if (!cleanAddress) {
    errors.address = 'Alamat lengkap GOR wajib diisi.';
  }
  if (!cleanSport) {
    errors.sportsType = 'Kategori olahraga utama wajib diisi.';
  }

  const errorMessages = Object.values(errors);
  return {
    valid: errorMessages.length === 0,
    errors,
    message: errorMessages[0] || null
  };
}

/**
 * Validate Logo Image File before Cloudinary upload
 */
export function validateLogoFile(file) {
  if (!file) {
    return { valid: false, message: 'Tidak ada file gambar yang dipilih.' };
  }
  const mimeType = String(file.type || '').toLowerCase();
  if (!mimeType.startsWith('image/')) {
    return {
      valid: false,
      message: 'File yang dipilih harus berupa gambar (JPG, PNG, WebP).'
    };
  }
  if (mimeType && !ALLOWED_LOGO_MIMES.includes(mimeType) && mimeType !== 'image/svg+xml') {
    return {
      valid: false,
      message: `Format file "${mimeType}" tidak didukung. Gunakan JPG, PNG, atau WebP.`
    };
  }
  if (typeof file.size === 'number' && file.size > MAX_LOGO_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      message: `Ukuran file logo (${sizeMb} MB) melebihi batas maksimal 5 MB.`
    };
  }
  return { valid: true, message: null };
}

/**
 * Build payload for updateTenantProfile on Profile Tab
 * Matches the field contract expected by updateTenantProfile in supabaseArenaService.js
 */
export function buildTenantProfileUpdatePayload({ name, logoUrl, address, phone, sportsType }) {
  return {
    name: String(name ?? '').trim(),
    logoUrl: logoUrl || '',
    address: String(address ?? '').trim(),
    phone: String(phone ?? '').trim(),
    sportsType: String(sportsType || 'Badminton').trim(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * MobileTenantProfileMain Component
 * Dedicated Mobile-First Presentation Layer for Tenant Profile Settings (tab=profil).
 */
export default function MobileTenantProfileMain({
  userProfile,
  onTenantUpdated = () => {},
  uploadLogoHandler = null,
  saveProfileHandler = null
}) {
  const navigate = useNavigate();
  const { isDark, setTheme } = useTheme();
  const tenantId = resolveTenantId(userProfile);

  // Guard: Prevent useArenaData from falling back to userProfile.uid when tenantId is missing
  const safeArenaProfile = useMemo(() => {
    if (!tenantId) return null;
    return userProfile;
  }, [userProfile, tenantId]);

  const { tenantProfile: rawTenantProfile, isLoading, isFetching, refetch } = useArenaData(safeArenaProfile);

  // Strict multi-tenant isolation: only accept tenant profile matching active tenantId
  const tenant = useMemo(() => {
    return resolveIsolatedTenantProfile(rawTenantProfile, userProfile, tenantId);
  }, [rawTenantProfile, userProfile, tenantId]);

  // Form states (initialized from isolated tenant so cached tab switches have 0ms flash)
  const [name, setName] = useState(() => tenant?.name || '');
  const [address, setAddress] = useState(() => tenant?.address || '');
  const [phone, setPhone] = useState(() => tenant?.phone || '');
  const [sportsType, setSportsType] = useState(() => tenant?.sportsType || 'Badminton');
  const [logoUrl, setLogoUrl] = useState(() => tenant?.logoUrl || '');

  // Baseline saved state for dirty checking and revert
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    name: tenant?.name || '',
    address: tenant?.address || '',
    phone: tenant?.phone || '',
    sportsType: tenant?.sportsType || 'Badminton',
    logoUrl: tenant?.logoUrl || ''
  }));

  // UI states
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
  const [pendingNavPath, setPendingNavPath] = useState(null);
  const [logoutError, setLogoutError] = useState(null);

  const roleDisplay =
    userProfile?.role === 'superadmin' ? 'Super Admin' :
    userProfile?.role === 'owner' ? 'Owner GOR' :
    userProfile?.role === 'admin' ? 'Admin Staf' :
    userProfile?.role === 'pelatih' ? 'Pelatih Akademi' : 'Owner / Pengelola';

  // Sync form state when tenant data arrives or updates
  useEffect(() => {
    if (tenant) {
      const nextSnapshot = {
        name: tenant.name || '',
        address: tenant.address || '',
        phone: tenant.phone || '',
        sportsType: tenant.sportsType || 'Badminton',
        logoUrl: tenant.logoUrl || ''
      };
      setName(nextSnapshot.name);
      setAddress(nextSnapshot.address);
      setPhone(nextSnapshot.phone);
      setSportsType(nextSnapshot.sportsType);
      setLogoUrl(nextSnapshot.logoUrl);
      setSavedSnapshot(nextSnapshot);
    }
  }, [tenant]);

  // Dirty check: detect unsaved changes
  const isDirty = useMemo(() => {
    if (!tenantId) return false;
    return (
      name.trim() !== (savedSnapshot.name || '').trim() ||
      address.trim() !== (savedSnapshot.address || '').trim() ||
      phone.trim() !== (savedSnapshot.phone || '').trim() ||
      sportsType.trim() !== (savedSnapshot.sportsType || 'Badminton').trim()
    );
  }, [tenantId, name, address, phone, sportsType, savedSnapshot]);

  // Browser unload warning when unsaved changes exist
  useEffect(() => {
    if (!isDirty || typeof window === 'undefined') return undefined;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Validation state
  const validation = useMemo(() => {
    return validateTenantProfileInput({ name, phone, address, sportsType });
  }, [name, phone, address, sportsType]);

  // Auto-dismiss feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [feedback]);

  const handleRevertChanges = () => {
    setName(savedSnapshot.name || '');
    setAddress(savedSnapshot.address || '');
    setPhone(savedSnapshot.phone || '');
    setSportsType(savedSnapshot.sportsType || 'Badminton');
    setFeedback({
      type: 'info',
      text: 'Perubahan formulir dikembalikan ke data profil tersimpan.'
    });
  };

  // Logo Upload Handler (uses existing uploadToCloudinary + updateTenantProfile)
  const handleLogoFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!tenantId) {
      setFeedback({
        type: 'error',
        text: 'ID Tenant tidak tersedia. Upload logo dibatalkan.'
      });
      return;
    }

    const fileValidation = validateLogoFile(file);
    if (!fileValidation.valid) {
      setFeedback({
        type: 'error',
        text: fileValidation.message
      });
      return;
    }

    setIsUploadingLogo(true);
    setFeedback(null);

    try {
      let uploadResult;
      if (typeof uploadLogoHandler === 'function') {
        uploadResult = await uploadLogoHandler(file, { tenantId, category: 'logos' });
      } else {
        const { uploadToCloudinary } = await import('../../../services/uploadService');
        uploadResult = await uploadToCloudinary(file, {
          tenantId,
          category: 'logos'
        });
      }

      const cloudUrl = uploadResult?.secure_url;
      if (!cloudUrl) {
        throw new Error('URL logo dari server penyimpanan tidak valid.');
      }

      const saveFn = typeof saveProfileHandler === 'function' ? saveProfileHandler : updateTenantProfile;
      await saveFn(tenantId, { logoUrl: cloudUrl });

      setLogoUrl(cloudUrl);
      setSavedSnapshot((prev) => ({ ...prev, logoUrl: cloudUrl }));

      if (onTenantUpdated && tenant) {
        onTenantUpdated({ ...tenant, logoUrl: cloudUrl });
      }
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      }
      if (refetch) {
        await refetch();
      }

      setFeedback({
        type: 'success',
        text: 'Logo GOR berhasil diunggah dan disimpan!'
      });
    } catch (err) {
      console.error('[MobileTenantProfileMain] Error uploading logo:', err);
      setFeedback({
        type: 'error',
        text: 'Gagal mengunggah logo ke Cloudinary: ' + (err?.message || 'Terjadi kesalahan.')
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Form Save Handler
  const handleSaveProfile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!tenantId) {
      setFeedback({
        type: 'error',
        text: 'Konteks cabang (Tenant ID) tidak tersedia. Penyimpanan dibatalkan.'
      });
      return;
    }

    if (!validation.valid) {
      setFeedback({
        type: 'error',
        text: validation.message
      });
      return;
    }

    if (!isDirty) {
      setFeedback({
        type: 'info',
        text: 'Tidak ada perubahan profil yang perlu disimpan.'
      });
      return;
    }

    if (savingTenant) return;

    setSavingTenant(true);
    setFeedback(null);

    try {
      const payload = buildTenantProfileUpdatePayload({
        name,
        logoUrl,
        address,
        phone,
        sportsType
      });

      const saveFn = typeof saveProfileHandler === 'function' ? saveProfileHandler : updateTenantProfile;
      await saveFn(tenantId, payload);

      const nextSaved = {
        name: payload.name,
        address: payload.address,
        phone: payload.phone,
        sportsType: payload.sportsType,
        logoUrl: payload.logoUrl
      };
      setSavedSnapshot(nextSaved);

      if (onTenantUpdated) {
        onTenantUpdated({ ...(tenant || {}), id: tenantId, ...payload });
      }
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      }
      if (refetch) {
        await refetch();
      }

      setFeedback({
        type: 'success',
        text: 'Pengaturan Profil GOR berhasil disimpan.'
      });
    } catch (err) {
      console.error('[MobileTenantProfileMain] Error updating tenant profile:', err);
      setFeedback({
        type: 'error',
        text: 'Gagal menyimpan profil GOR: ' + (err?.message || 'Silakan coba lagi.')
      });
    } finally {
      setSavingTenant(false);
    }
  };

  const handleGuardedNavigation = (e, targetPath) => {
    if (isDirty) {
      e.preventDefault();
      setPendingNavPath(targetPath);
    }
  };

  const confirmLeaveWithoutSaving = () => {
    const dest = pendingNavPath;
    setPendingNavPath(null);
    if (dest) {
      navigate(dest);
    }
  };

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await logoutUser();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[MobileTenantProfileMain] Logout error:', err);
      setLogoutError(err?.message || 'Gagal keluar dari sistem. Silakan coba kembali.');
    }
  };

  // 1. SPECIAL CASE: Missing Tenant Context
  if (!tenantId) {
    return (
      <div
        data-testid="mobile-tenant-profile-no-tenant"
        className="chua-mobile-app min-h-screen bg-[#F5F7FC] p-4 flex items-center justify-center text-[#17233D]"
      >
        <div className="bg-white border border-amber-200 rounded-[18px] p-6 text-center max-w-sm shadow-xs space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#17233D]">Konteks Cabang (Tenant) Tidak Ditemukan</h2>
          <p className="text-xs text-[#68758B] leading-relaxed">
            Akun Anda tidak memiliki asosiasi cabang/tenant yang valid. Query dan penyimpanan profil dinonaktifkan demi keamanan multi-tenant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="mobile-tenant-profile-main"
      className="chua-mobile-app min-h-screen bg-[#F5F7FC] text-[#17233D] pb-40"
    >
      {/* 0. TOP SHORTCUT BAR & REFRESH */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <Link
            to="/pengaturan?tab=pembayaran"
            onClick={(e) => handleGuardedNavigation(e, '/pengaturan?tab=pembayaran')}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-[#E7EBF2] text-[11px] font-bold text-[#2455E8] inline-flex items-center gap-1.5 no-underline shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>Rekening &amp; QRIS</span>
          </Link>
          <Link
            to="/pengaturan?tab=tarif"
            onClick={(e) => handleGuardedNavigation(e, '/pengaturan?tab=tarif')}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-[#E7EBF2] text-[11px] font-bold text-[#17233D] inline-flex items-center gap-1.5 no-underline shrink-0"
          >
            <Dumbbell className="w-3.5 h-3.5 text-[#2455E8] shrink-0" />
            <span>Tarif Sewa</span>
          </Link>
        </div>

        {refetch && (
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-[#E7EBF2] text-[11px] font-bold text-[#68758B] hover:text-[#17233D] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            aria-label="Muat ulang profil GOR"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-[#2455E8]' : ''}`} />
            <span>Segarkan</span>
          </button>
        )}
      </div>

      {/* 1. HERO HEADER CARD (NAVY #101D38) */}
      <div className="bg-[#101D38] text-white p-4 rounded-[18px] shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo GOR"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-extrabold text-amber-300">
                    {(name || tenant?.name || 'G').trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 block">
                  Identitas Cabang Aktif
                </span>
                <h1 className="text-sm font-extrabold text-white leading-snug my-0.5">
                  {name || tenant?.name || 'Profil Identitas GOR'}
                </h1>
                <p className="text-[11px] text-slate-300 font-medium truncate my-0">
                  {sportsType || 'Badminton'} · {phone || 'Belum ada nomor kontak'}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {isDirty ? (
                <span className="px-2.5 py-1 bg-amber-400 text-slate-950 text-[10px] font-extrabold rounded-lg inline-block whitespace-nowrap">
                  Belum Disimpan
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-white/10 text-emerald-300 text-[10px] font-bold rounded-lg inline-block whitespace-nowrap">
                  Tersinkronisasi
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10">
              <span className="text-[10px] text-slate-300 block">Olahraga Utama</span>
              <span className="text-xs font-extrabold text-white mt-0.5 block truncate">
                {sportsType || 'Badminton'}
              </span>
            </div>
            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10">
              <span className="text-[10px] text-slate-300 block">Status Logo</span>
              <span className="text-xs font-extrabold text-emerald-300 mt-0.5 block truncate">
                {logoUrl ? 'Logo Kustom Aktif' : 'Inisial Standar'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 2. FEEDBACK BANNER */}
        {feedback && (
          <div
            role="status"
            data-testid={`mobile-profile-feedback-${feedback.type}`}
            className={`p-3.5 rounded-[18px] text-xs font-semibold flex items-start gap-2.5 shadow-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                : feedback.type === 'error'
                  ? 'bg-rose-50 text-rose-950 border-rose-200'
                  : 'bg-blue-50 text-blue-950 border-blue-200'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#16A779] shrink-0 mt-0.5" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            {feedback.type === 'info' && <Building2 className="w-4 h-4 text-[#2455E8] shrink-0 mt-0.5" />}
            <span className="flex-1 leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {logoutError && (
          <div
            role="alert"
            className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-[18px] font-semibold flex items-center justify-between gap-2"
          >
            <span>{logoutError}</span>
            <button
              type="button"
              onClick={() => setLogoutError(null)}
              className="min-h-[36px] px-2 font-bold text-rose-700"
            >
              Tutup
            </button>
          </div>
        )}

        {isLoading ? (
          <div
            data-testid="mobile-tenant-profile-loading"
            className="bg-white border border-[#E7EBF2] rounded-[18px] p-6 text-center shadow-xs"
          >
            <MobileLoadingState message="Memuat data profil GOR..." />
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
            {/* 3. LOGO UPLOAD CARD */}
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#17233D] uppercase tracking-wide my-0 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#2455E8]" />
                  <span>Logo &amp; Identitas Visual GOR</span>
                </h2>
                {isUploadingLogo && (
                  <span className="text-[11px] font-bold text-[#2455E8] inline-flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengunggah...</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3.5 p-3 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[14px]">
                <div className="w-14 h-14 rounded-2xl border border-[#E7EBF2] bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Pratinjau Logo GOR"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-black text-[#2455E8]">
                      {(name || 'G').trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-bold text-[#17233D] my-0">
                    {logoUrl ? 'Logo GOR Tersimpan' : 'Belum Ada Logo Khusus'}
                  </p>
                  <p className="text-[11px] text-[#68758B] leading-snug my-0">
                    Format JPG, PNG, atau WebP (Maks. 5 MB). Otomatis diunggah ke Cloudinary &amp; disinkronkan ke header.
                  </p>
                </div>
              </div>

              <label
                htmlFor="mobile-gor-logo-upload"
                className={`min-h-[44px] w-full px-4 py-2.5 rounded-xl border border-[#E7EBF2] bg-[#F5F7FC] hover:bg-slate-100 text-[#17233D] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isUploadingLogo || savingTenant ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#2455E8]" />
                    <span>Sedang Mengunggah Logo...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-[#2455E8]" />
                    <span>{logoUrl ? 'Ganti Logo GOR' : 'Unggah Foto Logo GOR'}</span>
                  </>
                )}
                <input
                  id="mobile-gor-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileSelect}
                  disabled={isUploadingLogo || savingTenant}
                  className="hidden"
                />
              </label>
            </div>

            {/* 4. CORE PROFILE FORM CARD */}
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#17233D] uppercase tracking-wide my-0">
                  Informasi Utama GOR
                </h2>
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleRevertChanges}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2] text-[11px] font-bold text-[#68758B] hover:text-[#17233D] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Nama GOR */}
              <div className="space-y-1.5">
                <label
                  htmlFor="mobile-profile-arena-name"
                  className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                >
                  Nama GOR / Sports Arena <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
                  <input
                    id="mobile-profile-arena-name"
                    name="arenaName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: GOR Juara Badminton"
                    className={`w-full h-12 pl-10 pr-3 text-xs rounded-xl font-bold text-[#17233D] focus:outline-none transition-colors ${
                      validation.errors.name
                        ? 'bg-rose-50/30 border-2 border-rose-400 focus:border-rose-500'
                        : 'bg-[#F5F7FC] border border-[#E7EBF2] focus:bg-white focus:border-[#2455E8]'
                    }`}
                  />
                </div>
                {validation.errors.name && (
                  <p className="text-[11px] font-semibold text-rose-600 my-0">{validation.errors.name}</p>
                )}
              </div>

              {/* Kategori Olahraga Utama */}
              <div className="space-y-2">
                <label
                  htmlFor="mobile-profile-sports-type"
                  className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                >
                  Kategori Olahraga Utama <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Dumbbell className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
                  <input
                    id="mobile-profile-sports-type"
                    name="sportsType"
                    type="text"
                    value={sportsType}
                    onChange={(e) => setSportsType(e.target.value)}
                    placeholder="Pilih atau ketik cabang olahraga utama"
                    className={`w-full h-12 pl-10 pr-3 text-xs rounded-xl font-bold text-[#17233D] focus:outline-none transition-colors ${
                      validation.errors.sportsType
                        ? 'bg-rose-50/30 border-2 border-rose-400 focus:border-rose-500'
                        : 'bg-[#F5F7FC] border border-[#E7EBF2] focus:bg-white focus:border-[#2455E8]'
                    }`}
                  />
                </div>

                {/* Quick Chips for SUPPORTED_SPORTS */}
                <div className="flex overflow-x-auto no-scrollbar gap-1.5 pt-0.5 pb-1">
                  {SUPPORTED_SPORTS.map((sportOption) => {
                    const isSelected = (sportsType || '').toLowerCase() === sportOption.toLowerCase();
                    return (
                      <button
                        key={sportOption}
                        type="button"
                        onClick={() => setSportsType(sportOption)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 border transition-all cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#101D38] text-white border-[#101D38] shadow-2xs'
                            : 'bg-[#F5F7FC] text-[#68758B] border-[#E7EBF2] hover:text-[#17233D]'
                        }`}
                      >
                        {sportOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nomor Telepon / Kontak WhatsApp */}
              <div className="space-y-1.5">
                <label
                  htmlFor="mobile-profile-phone"
                  className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                >
                  Kontak WhatsApp / Telepon <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
                  <input
                    id="mobile-profile-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className={`w-full h-12 pl-10 pr-3 text-xs rounded-xl font-bold font-mono tabular-nums text-[#17233D] focus:outline-none transition-colors ${
                      validation.errors.phone
                        ? 'bg-rose-50/30 border-2 border-rose-400 focus:border-rose-500'
                        : 'bg-[#F5F7FC] border border-[#E7EBF2] focus:bg-white focus:border-[#2455E8]'
                    }`}
                  />
                </div>
                {validation.errors.phone && (
                  <p className="text-[11px] font-semibold text-rose-600 my-0">{validation.errors.phone}</p>
                )}
              </div>

              {/* Alamat Lengkap GOR */}
              <div className="space-y-1.5">
                <label
                  htmlFor="mobile-profile-address"
                  className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                >
                  Alamat Lengkap GOR <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#68758B] absolute left-3.5 top-3.5" />
                  <textarea
                    id="mobile-profile-address"
                    name="address"
                    rows={3}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Masukkan alamat lengkap lokasi arena..."
                    className={`w-full pl-10 pr-3 py-3 text-xs rounded-xl font-semibold text-[#17233D] focus:outline-none transition-colors ${
                      validation.errors.address
                        ? 'bg-rose-50/30 border-2 border-rose-400 focus:border-rose-500'
                        : 'bg-[#F5F7FC] border border-[#E7EBF2] focus:bg-white focus:border-[#2455E8]'
                    }`}
                  />
                </div>
                {validation.errors.address && (
                  <p className="text-[11px] font-semibold text-rose-600 my-0">{validation.errors.address}</p>
                )}
              </div>
            </div>

            {/* 5. ACCOUNT & PREFERENCES CARD (CONSISTENT WITH PENGATURAN) */}
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2455E8] block">
                    {roleDisplay}
                  </span>
                  <h3 className="text-xs font-extrabold text-[#17233D] truncate my-0">
                    {userProfile?.displayName || 'Pengelola GOR'}
                  </h3>
                  <p className="text-[11px] text-[#68758B] font-mono truncate my-0">
                    {userProfile?.email || ''}
                  </p>
                </div>

                <div className="flex items-center bg-[#F5F7FC] p-1 rounded-xl border border-[#E7EBF2] shrink-0">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      !isDark ? 'bg-white text-[#2455E8] shadow-2xs' : 'text-[#68758B]'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Terang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      isDark ? 'bg-[#101D38] text-amber-300 shadow-2xs' : 'text-[#68758B]'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Gelap</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[44px] w-full px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Sistem</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 6. STICKY BOTTOM SAVE BAR (>=44PX TOUCH TARGET) */}
      <div className="fixed bottom-[74px] left-3 right-3 z-30 bg-white/95 backdrop-blur-md border border-[#E7EBF2] rounded-[18px] p-3 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#68758B] block leading-tight">
              Status Profil GOR
            </span>
            <span className="text-xs font-extrabold text-[#17233D] block truncate">
              {!validation.valid ? (
                <span className="text-rose-600">Lengkapi kolom wajib</span>
              ) : isDirty ? (
                <span className="text-amber-700">Perubahan belum disimpan</span>
              ) : (
                <span className="text-[#68758B]">Data tersimpan</span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingTenant || !isDirty || !validation.valid}
            className="min-h-[48px] px-5 bg-[#2455E8] hover:bg-[#1d44c7] text-white text-xs font-extrabold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 min-w-[172px]"
          >
            {savingTenant ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Profil GOR</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 7. UNSAVED CHANGES CONFIRMATION MODAL */}
      {pendingNavPath && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-5 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#17233D] my-0">
                  Perubahan Belum Disimpan
                </h3>
                <p className="text-[11px] text-[#68758B] my-0">
                  Konfirmasi perpindahan halaman
                </p>
              </div>
            </div>

            <p className="text-xs text-[#68758B] leading-relaxed my-0">
              Anda memiliki perubahan profil GOR yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingNavPath(null)}
                className="min-h-[44px] px-3 py-2 bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] text-xs font-bold rounded-xl cursor-pointer"
              >
                Tetap di Sini
              </button>
              <button
                type="button"
                onClick={confirmLeaveWithoutSaving}
                className="min-h-[44px] px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl cursor-pointer"
              >
                Tinggalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
