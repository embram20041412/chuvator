import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  QrCode,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  RefreshCw,
  ArrowLeft,
  Dumbbell
} from 'lucide-react';
import useArenaData from '../../../hooks/useArenaData';
import { updateTenantProfile } from '../../../services/supabaseArenaService';
import MobileLoadingState from '../../components/MobileLoadingState';
import {
  resolveTenantId,
  resolveIsolatedTenantProfile
} from './MobileTenantProfileMain';

export { resolveTenantId, resolveIsolatedTenantProfile };

export const MAX_QRIS_SIZE_BYTES = 800 * 1024; // 800 KB (matches PengaturanPage desktop limit)

/**
 * Normalize bankAccounts state from tenant document
 * Preserves backward compatibility with legacy single-account fields (bankName, bankAccountNumber, bankAccountName).
 */
export function normalizeBankAccountsFromTenant(tenant) {
  if (!tenant || typeof tenant !== 'object') {
    return [{ bankName: '', accountNumber: '', accountName: '' }];
  }
  if (Array.isArray(tenant.bankAccounts) && tenant.bankAccounts.length > 0) {
    return tenant.bankAccounts.map((acc) => ({
      bankName: String(acc?.bankName || ''),
      accountNumber: String(acc?.accountNumber || ''),
      accountName: String(acc?.accountName || '')
    }));
  }
  if (tenant.bankName || tenant.bankAccountNumber || tenant.bankAccountName) {
    return [
      {
        bankName: String(tenant.bankName || ''),
        accountNumber: String(tenant.bankAccountNumber || ''),
        accountName: String(tenant.bankAccountName || '')
      }
    ];
  }
  return [{ bankName: '', accountNumber: '', accountName: '' }];
}

/**
 * Validate Bank Accounts array
 * Ensures every bank account entry has bankName, accountNumber, and accountName filled
 * (unless a single blank row is present alongside a valid QRIS image).
 */
export function validateBankAccountsInput(bankAccounts, options = {}) {
  const { hasQris = false } = options;
  if (!Array.isArray(bankAccounts) || bankAccounts.length === 0) {
    return {
      valid: false,
      itemErrors: [],
      message: 'Minimal satu rekening bank atau QRIS harus tersedia.'
    };
  }

  const itemErrors = bankAccounts.map((acc, index) => {
    const bankName = String(acc?.bankName || '').trim();
    const accountNumber = String(acc?.accountNumber || '').trim();
    const accountName = String(acc?.accountName || '').trim();
    const isCompletelyEmpty = !bankName && !accountNumber && !accountName;

    // Allow a single empty bank row ONLY when QRIS is configured and there is just 1 row
    if (isCompletelyEmpty && bankAccounts.length === 1 && hasQris) {
      return {};
    }

    const rowErr = {};
    if (!bankName) {
      rowErr.bankName = `Nama bank pada Rekening #${index + 1} wajib diisi.`;
    }
    if (!accountNumber) {
      rowErr.accountNumber = `Nomor rekening pada Rekening #${index + 1} wajib diisi.`;
    }
    if (!accountName) {
      rowErr.accountName = `Nama pemilik pada Rekening #${index + 1} wajib diisi.`;
    }
    return rowErr;
  });

  const firstErrorMsg = itemErrors
    .map((errObj) => errObj.bankName || errObj.accountNumber || errObj.accountName)
    .find(Boolean) || null;

  return {
    valid: !firstErrorMsg,
    itemErrors,
    message: firstErrorMsg
  };
}

/**
 * Validate QRIS Static Image File
 * Strictly enforces desktop rules: must be image/* and <= 800 KB.
 */
export function validateQrisFile(file) {
  if (!file) {
    return { valid: false, message: 'Tidak ada file gambar QRIS yang dipilih.' };
  }
  const mimeType = String(file.type || '').toLowerCase();
  if (!mimeType.startsWith('image/')) {
    return {
      valid: false,
      message: 'File yang dipilih harus berupa gambar (PNG/JPG/JPEG).'
    };
  }
  if (typeof file.size === 'number' && file.size > MAX_QRIS_SIZE_BYTES) {
    return {
      valid: false,
      message: 'Ukuran gambar QRIS terlalu besar (Maksimal 800 KB). Silakan kompres atau gunakan gambar yang lebih kecil.'
    };
  }
  return { valid: true, message: null };
}

/**
 * Convert QRIS File into Base64 Data URL using FileReader (matching desktop mechanism)
 */
export function readQrisFileAsBase64(file, FileReaderImpl = typeof FileReader !== 'undefined' ? FileReader : null) {
  return new Promise((resolve, reject) => {
    const validation = validateQrisFile(file);
    if (!validation.valid) {
      reject(new Error(validation.message));
      return;
    }
    if (!FileReaderImpl) {
      reject(new Error('FileReader tidak tersedia pada environment ini.'));
      return;
    }
    const reader = new FileReaderImpl();
    reader.onloadend = () => {
      if (reader.result) {
        resolve(String(reader.result));
      } else {
        reject(new Error('Gagal membaca data gambar QRIS.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Terjadi kesalahan saat membaca file QRIS.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Build payload for updateTenantProfile on Payment & QRIS Tab
 * Preserves exact schema compatibility with PengaturanPage.jsx and supabaseArenaService.js
 */
export function buildPaymentSettingsUpdatePayload({ bankAccounts, qrisImageBase64 }) {
  const cleanedBankAccounts = (Array.isArray(bankAccounts) ? bankAccounts : []).map((b) => ({
    bankName: String(b?.bankName || '').trim(),
    accountNumber: String(b?.accountNumber || '').trim(),
    accountName: String(b?.accountName || '').trim()
  }));

  const normalizedQris = qrisImageBase64 || '';

  return {
    bankAccounts: cleanedBankAccounts,
    bankName: cleanedBankAccounts[0]?.bankName || '',
    bankAccountNumber: cleanedBankAccounts[0]?.accountNumber || '',
    bankAccountName: cleanedBankAccounts[0]?.accountName || '',
    qrisUrl: normalizedQris,
    qrisImageBase64: normalizedQris,
    updatedAt: new Date().toISOString()
  };
}

/**
 * MobilePaymentSettingsMain Component
 * Dedicated Mobile-First Presentation Layer for Bank Accounts & Static QRIS Settings (tab=pembayaran).
 */
export default function MobilePaymentSettingsMain({
  userProfile,
  onTenantUpdated = () => {},
  savePaymentHandler = null
}) {
  const navigate = useNavigate();
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

  const tenantName = tenant?.name || userProfile?.tenant?.name || 'Cabang Aktif';

  // Form states (initialized from isolated tenant so cached tab switches have 0ms flash)
  const [bankAccounts, setBankAccounts] = useState(() => normalizeBankAccountsFromTenant(tenant));
  const [qrisImageBase64, setQrisImageBase64] = useState(() => tenant?.qrisUrl || tenant?.qrisImageBase64 || '');
  const [qrisFileName, setQrisFileName] = useState('');

  // Baseline saved snapshot for dirty check & revert
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    bankAccounts: normalizeBankAccountsFromTenant(tenant).map((b) => ({ ...b })),
    qrisImageBase64: tenant?.qrisUrl || tenant?.qrisImageBase64 || ''
  }));

  // UI states
  const [savingPayment, setSavingPayment] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
  const [pendingNavPath, setPendingNavPath] = useState(null);

  // Sync form state when tenant data arrives
  useEffect(() => {
    if (tenant) {
      const initialBanks = normalizeBankAccountsFromTenant(tenant);
      const initialQris = tenant.qrisUrl || tenant.qrisImageBase64 || '';
      setBankAccounts(initialBanks);
      setQrisImageBase64(initialQris);
      setQrisFileName('');
      setHasAttemptedSubmit(false);
      setSavedSnapshot({
        bankAccounts: initialBanks.map((b) => ({ ...b })),
        qrisImageBase64: initialQris
      });
    }
  }, [tenant]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!tenantId) return false;
    if ((qrisImageBase64 || '') !== (savedSnapshot.qrisImageBase64 || '')) {
      return true;
    }
    if (bankAccounts.length !== savedSnapshot.bankAccounts.length) {
      return true;
    }
    return bankAccounts.some((acc, idx) => {
      const orig = savedSnapshot.bankAccounts[idx] || {};
      return (
        String(acc.bankName || '').trim() !== String(orig.bankName || '').trim() ||
        String(acc.accountNumber || '').trim() !== String(orig.accountNumber || '').trim() ||
        String(acc.accountName || '').trim() !== String(orig.accountName || '').trim()
      );
    });
  }, [tenantId, bankAccounts, qrisImageBase64, savedSnapshot]);

  const isQrisChanged = useMemo(() => {
    return (qrisImageBase64 || '') !== (savedSnapshot.qrisImageBase64 || '');
  }, [qrisImageBase64, savedSnapshot.qrisImageBase64]);

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

  // Validation
  const validation = useMemo(() => {
    return validateBankAccountsInput(bankAccounts, {
      hasQris: Boolean(qrisImageBase64)
    });
  }, [bankAccounts, qrisImageBase64]);

  const showValidationErrors = isDirty || hasAttemptedSubmit;

  // Count configured bank accounts
  const activeBankCount = useMemo(() => {
    return bankAccounts.filter(
      (b) => String(b.bankName || '').trim() && String(b.accountNumber || '').trim()
    ).length;
  }, [bankAccounts]);

  // Auto-dismiss feedback after 5s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [feedback]);

  // Bank Account Handlers
  const handleBankAccountChange = (index, field, value) => {
    setBankAccounts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddBankAccount = () => {
    setBankAccounts((prev) => [
      ...prev,
      { bankName: '', accountNumber: '', accountName: '' }
    ]);
  };

  const handleRemoveBankAccount = (index) => {
    if (bankAccounts.length <= 1) return;
    setBankAccounts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRevertAll = () => {
    setBankAccounts(savedSnapshot.bankAccounts.map((b) => ({ ...b })));
    setQrisImageBase64(savedSnapshot.qrisImageBase64 || '');
    setQrisFileName('');
    setHasAttemptedSubmit(false);
    setFeedback({
      type: 'info',
      text: 'Perubahan rekening dan QRIS dikembalikan ke data tersimpan.'
    });
  };

  const handleRevertQris = () => {
    setQrisImageBase64(savedSnapshot.qrisImageBase64 || '');
    setQrisFileName('');
  };

  // QRIS FileReader Handler (matches PengaturanPage desktop behavior)
  const handleQrisFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileCheck = validateQrisFile(file);
    if (!fileCheck.valid) {
      setFeedback({
        type: 'error',
        text: fileCheck.message
      });
      return;
    }

    try {
      const base64DataUrl = await readQrisFileAsBase64(file);
      setQrisFileName(file.name || 'qris-image');
      setQrisImageBase64(base64DataUrl);
      setFeedback({
        type: 'info',
        text: `Pratinjau QRIS "${file.name}" siap. Tekan tombol Simpan Rekening & QRIS di bawah untuk menyimpan.`
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Gagal membaca file gambar QRIS.'
      });
    }
  };

  // Save Payment Settings Handler
  const handleSavePaymentSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setHasAttemptedSubmit(true);

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
        text: 'Tidak ada perubahan rekening atau QRIS yang perlu disimpan.'
      });
      return;
    }

    if (savingPayment) return;

    setSavingPayment(true);
    setFeedback(null);

    try {
      const payload = buildPaymentSettingsUpdatePayload({
        bankAccounts,
        qrisImageBase64
      });

      const saveFn = typeof savePaymentHandler === 'function' ? savePaymentHandler : updateTenantProfile;
      await saveFn(tenantId, payload);

      setSavedSnapshot({
        bankAccounts: payload.bankAccounts.map((b) => ({ ...b })),
        qrisImageBase64: payload.qrisImageBase64
      });
      setBankAccounts(payload.bankAccounts.map((b) => ({ ...b })));
      setQrisFileName('');
      setHasAttemptedSubmit(false);

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
        text: 'Informasi Rekening Bank & QRIS berhasil disimpan.'
      });
    } catch (err) {
      console.error('[MobilePaymentSettingsMain] Error saving payment settings:', err);
      setFeedback({
        type: 'error',
        text: 'Gagal menyimpan pengaturan pembayaran: ' + (err?.message || 'Silakan coba lagi.')
      });
    } finally {
      setSavingPayment(false);
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

  // 1. SPECIAL CASE: Missing Tenant Context
  if (!tenantId) {
    return (
      <div
        data-testid="mobile-payment-settings-no-tenant"
        className="chua-mobile-app min-h-screen bg-[#F5F7FC] p-4 flex items-center justify-center text-[#17233D]"
      >
        <div className="bg-white border border-amber-200 rounded-[18px] p-6 text-center max-w-sm shadow-xs space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#17233D]">Konteks Cabang (Tenant) Tidak Ditemukan</h2>
          <p className="text-xs text-[#68758B] leading-relaxed">
            Akun Anda tidak memiliki asosiasi cabang/tenant yang valid. Query dan penyimpanan rekening/QRIS dinonaktifkan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="mobile-payment-settings-main"
      className="chua-mobile-app min-h-screen bg-[#F5F7FC] text-[#17233D] pb-40"
    >
      {/* 0. TOP SHORTCUT BAR & REFRESH */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <Link
            to="/pengaturan?tab=profil"
            onClick={(e) => handleGuardedNavigation(e, '/pengaturan?tab=profil')}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-[#E7EBF2] text-[11px] font-bold text-[#2455E8] inline-flex items-center gap-1.5 no-underline shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Profil GOR</span>
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
            aria-label="Muat ulang data rekening dan QRIS"
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
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-white leading-snug my-0">
                  Rekening Bank &amp; QRIS Statis
                </h1>
                <p className="text-[11px] text-slate-300 font-medium truncate my-0">
                  {tenantName}
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
            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-slate-300 font-medium block">Rekening Transfer</span>
              <div className="mt-1">
                <span className="text-base font-extrabold text-white font-mono tabular-nums block leading-none">
                  {isLoading ? '...' : activeBankCount}
                </span>
                <span className="text-[9px] text-slate-300 mt-1 block">Rekening Terkonfigurasi</span>
              </div>
            </div>

            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-slate-300 font-medium block">Status QRIS Statis</span>
              <div className="mt-1">
                <span className={`text-xs font-extrabold block leading-none ${qrisImageBase64 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {isLoading ? '...' : qrisImageBase64 ? 'QRIS Aktif' : 'Belum Diatur'}
                </span>
                <span className="text-[9px] text-slate-300 mt-1 block">
                  {isQrisChanged ? 'Pratinjau Baru' : 'Pembayaran Kasir & SPP'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 2. FEEDBACK BANNER */}
        {feedback && (
          <div
            role="status"
            data-testid={`mobile-payment-feedback-${feedback.type}`}
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
            {feedback.type === 'info' && <CreditCard className="w-4 h-4 text-[#2455E8] shrink-0 mt-0.5" />}
            <span className="flex-1 leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {isLoading ? (
          <div
            data-testid="mobile-payment-settings-loading"
            className="bg-white border border-[#E7EBF2] rounded-[18px] p-6 text-center shadow-xs"
          >
            <MobileLoadingState message="Memuat pengaturan rekening & QRIS..." />
          </div>
        ) : (
          <form onSubmit={handleSavePaymentSettings} className="space-y-4" noValidate>
            {/* 3. MULTI-BANK ACCOUNTS SECTION */}
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2455E8] flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold text-[#17233D] uppercase tracking-wide my-0">
                      Daftar Rekening Bank Transfer
                    </h2>
                    <p className="text-[11px] text-[#68758B] my-0">
                      Ditampilkan pada tagihan booking &amp; pembayaran SPP
                    </p>
                  </div>
                </div>

                {isDirty && (
                  <button
                    type="button"
                    onClick={handleRevertAll}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2] text-[11px] font-bold text-[#68758B] hover:text-[#17233D] inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {bankAccounts.map((acc, index) => {
                  const rowError = showValidationErrors ? (validation.itemErrors?.[index] || {}) : {};
                  return (
                    <div
                      key={index}
                      data-testid={`mobile-bank-account-card-${index}`}
                      className="p-3.5 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[16px] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-[#17233D] uppercase tracking-wider">
                          {`Rekening #${index + 1}`}
                        </span>
                        {bankAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBankAccount(index)}
                            className="min-h-[38px] px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            aria-label={`Hapus Rekening #${index + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      {/* Nama Bank */}
                      <div className="space-y-1">
                        <label
                          htmlFor={`mobile-bank-name-${index}`}
                          className="block text-[10px] font-bold text-[#68758B] uppercase tracking-wider"
                        >
                          Nama Bank <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id={`mobile-bank-name-${index}`}
                          type="text"
                          value={acc.bankName || ''}
                          onChange={(e) => handleBankAccountChange(index, 'bankName', e.target.value)}
                          placeholder="Contoh: BCA, Mandiri, BRI, BNI"
                          className={`w-full h-12 px-3.5 text-xs bg-white rounded-xl font-bold text-[#17233D] focus:outline-none transition-colors ${
                            rowError.bankName
                              ? 'border-2 border-rose-400 focus:border-rose-500'
                              : 'border border-[#E7EBF2] focus:border-[#2455E8]'
                          }`}
                        />
                        {rowError.bankName && (
                          <p className="text-[11px] font-semibold text-rose-600 my-0">{rowError.bankName}</p>
                        )}
                      </div>

                      {/* Nomor Rekening */}
                      <div className="space-y-1">
                        <label
                          htmlFor={`mobile-bank-number-${index}`}
                          className="block text-[10px] font-bold text-[#68758B] uppercase tracking-wider"
                        >
                          Nomor Rekening <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id={`mobile-bank-number-${index}`}
                          type="text"
                          inputMode="numeric"
                          value={acc.accountNumber || ''}
                          onChange={(e) => handleBankAccountChange(index, 'accountNumber', e.target.value)}
                          placeholder="Contoh: 8830123456"
                          className={`w-full h-12 px-3.5 text-xs bg-white rounded-xl font-mono tabular-nums font-extrabold text-[#17233D] focus:outline-none transition-colors ${
                            rowError.accountNumber
                              ? 'border-2 border-rose-400 focus:border-rose-500'
                              : 'border border-[#E7EBF2] focus:border-[#2455E8]'
                          }`}
                        />
                        {rowError.accountNumber && (
                          <p className="text-[11px] font-semibold text-rose-600 my-0">{rowError.accountNumber}</p>
                        )}
                      </div>

                      {/* Atas Nama Pemilik */}
                      <div className="space-y-1">
                        <label
                          htmlFor={`mobile-bank-owner-${index}`}
                          className="block text-[10px] font-bold text-[#68758B] uppercase tracking-wider"
                        >
                          Atas Nama (Pemilik Rekening) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id={`mobile-bank-owner-${index}`}
                          type="text"
                          value={acc.accountName || ''}
                          onChange={(e) => handleBankAccountChange(index, 'accountName', e.target.value)}
                          placeholder="Contoh: a.n. PT Chua Sport"
                          className={`w-full h-12 px-3.5 text-xs bg-white rounded-xl font-semibold text-[#17233D] focus:outline-none transition-colors ${
                            rowError.accountName
                              ? 'border-2 border-rose-400 focus:border-rose-500'
                              : 'border border-[#E7EBF2] focus:border-[#2455E8]'
                          }`}
                        />
                        {rowError.accountName && (
                          <p className="text-[11px] font-semibold text-rose-600 my-0">{rowError.accountName}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddBankAccount}
                className="min-h-[48px] w-full px-4 py-2.5 bg-white border-2 border-dashed border-blue-300 hover:border-[#2455E8] text-[#2455E8] font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Rekening Lain</span>
              </button>
            </div>

            {/* 4. STATIC QRIS IMAGE SECTION */}
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2455E8] flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold text-[#17233D] uppercase tracking-wide my-0">
                      Gambar Kode QRIS Statis
                    </h2>
                    <p className="text-[11px] text-[#68758B] my-0">
                      Format PNG/JPG (Maks. 800 KB) tersimpan aman di database
                    </p>
                  </div>
                </div>

                {isQrisChanged && (
                  <button
                    type="button"
                    onClick={handleRevertQris}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2] text-[11px] font-bold text-[#68758B] hover:text-[#17233D] inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Batal Ganti</span>
                  </button>
                )}
              </div>

              <div className="p-4 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[16px] flex flex-col items-center text-center space-y-3">
                {qrisImageBase64 ? (
                  <div className="relative">
                    <img
                      src={qrisImageBase64}
                      alt="Preview QRIS"
                      className="w-40 h-40 object-contain rounded-2xl border border-[#E7EBF2] bg-white p-2 shadow-xs"
                    />
                    <span
                      className={`absolute -top-2 -right-2 px-2.5 py-0.5 text-[10px] font-extrabold rounded-full shadow-xs ${
                        isQrisChanged
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-[#16A779] text-white'
                      }`}
                    >
                      {isQrisChanged ? 'Pratinjau Baru' : 'Aktif'}
                    </span>
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-3 text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-1 text-slate-300" />
                    <span className="text-[11px] font-bold text-[#68758B]">Belum Ada QRIS</span>
                  </div>
                )}

                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-bold text-[#17233D] my-0">
                    {qrisImageBase64
                      ? isQrisChanged
                        ? 'Pratinjau QRIS Baru Siap Disimpan'
                        : 'Kode QRIS Statis Aktif'
                      : 'Unggah Kode QRIS Statis GOR'}
                  </p>
                  <p className="text-[11px] text-[#68758B] leading-snug my-0">
                    {qrisFileName
                      ? `File terpilih: ${qrisFileName}`
                      : 'Pilih file gambar QRIS (PNG/JPG/JPEG, maksimal 800 KB) dari perangkat Anda.'}
                  </p>
                </div>

                <label
                  htmlFor="mobile-qris-file-upload"
                  className="min-h-[44px] w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-[#E7EBF2] text-[#17233D] text-xs font-extrabold rounded-xl shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-[#2455E8]" />
                  <span>{qrisImageBase64 ? 'Pilih / Ganti File Gambar QRIS' : 'Pilih File Gambar QRIS...'}</span>
                  <input
                    id="mobile-qris-file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleQrisFileSelect}
                    disabled={savingPayment}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 5. STICKY BOTTOM SAVE BAR (>=44PX TOUCH TARGET) */}
      <div className="fixed bottom-[74px] left-3 right-3 z-30 bg-white/95 backdrop-blur-md border border-[#E7EBF2] rounded-[18px] p-3 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#68758B] block leading-tight">
              Status Pembayaran
            </span>
            <span className="text-xs font-extrabold text-[#17233D] block">
              {showValidationErrors && !validation.valid ? (
                <span className="text-rose-600">Data belum lengkap</span>
              ) : isDirty ? (
                <span className="text-amber-700">Belum disimpan</span>
              ) : (
                <span className="text-[#68758B]">Tersinkronisasi</span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSavePaymentSettings}
            disabled={savingPayment || !isDirty || !validation.valid}
            className="min-h-[48px] px-4 bg-[#2455E8] hover:bg-[#1d44c7] text-white text-xs font-extrabold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {savingPayment ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Rekening &amp; QRIS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6. UNSAVED CHANGES CONFIRMATION MODAL */}
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
              Anda memiliki perubahan rekening bank atau QRIS yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?
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
