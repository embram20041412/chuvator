import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dumbbell, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Loader2, 
  Inbox, 
  RotateCcw, 
  Search,
  RefreshCw
} from 'lucide-react';
import useArenaData from '../../../hooks/useArenaData';
import { updateCourtsBatch } from '../../../services/supabaseArenaService';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileLoadingState from '../../components/MobileLoadingState';

/**
 * Canonical Tenant ID Resolver for CHUVATOR Sports Facility & Court Pricing
 * Strictly follows tenant hierarchy: profile.tenant.id, profile.tenantId, profile.tenant.tenant_id.
 * NEVER falls back to userProfile.id or userProfile.uid (User ID is NOT a Tenant ID).
 */
export const resolveTenantId = (profile) => {
  if (!profile) return null;
  return profile.tenant?.id || profile.tenantId || profile.tenant?.tenant_id || null;
};

/**
 * Utility: Format number into dot-separated Indonesian currency string (e.g. 150000 -> "150.000")
 */
export function formatNumberWithDots(val) {
  if (val === null || val === undefined || val === '') return '';
  const numStr = String(val).replace(/\D/g, '');
  if (!numStr) return '';
  return Number(numStr).toLocaleString('id-ID');
}

/**
 * Utility: Parse dot-separated currency string back to integer (e.g. "150.000" -> 150000)
 */
export function parseNumberFromDots(val) {
  if (val === null || val === undefined || val === '') return 0;
  const numStr = String(val).replace(/\D/g, '');
  return Number(numStr) || 0;
}

/**
 * Strict Multi-Tenant Court Filter
 * Ensures only courts belonging to the active tenant are displayed or modified.
 * Rejects any court with a mismatched tenantId / tenant_id.
 */
export function filterCourtsByTenant(courtsList, activeTenantId) {
  if (!activeTenantId || !Array.isArray(courtsList)) return [];
  return courtsList.filter((c) => {
    if (!c) return false;
    const courtTenantId = c.tenantId || c.tenant_id;
    if (courtTenantId) {
      return String(courtTenantId) === String(activeTenantId);
    }
    return true;
  });
}

/**
 * Group courts by sport category
 */
export function groupCourtsBySport(courtsList) {
  const map = {};
  if (!Array.isArray(courtsList)) return map;
  courtsList.forEach((c) => {
    const sportKey = c.sport || 'Umum';
    if (!map[sportKey]) map[sportKey] = [];
    map[sportKey].push(c);
  });
  return map;
}

/**
 * Validate formatted price input string
 */
export function validatePriceInput(formattedValue) {
  if (formattedValue === null || formattedValue === undefined || String(formattedValue).trim() === '') {
    return { valid: false, reason: 'EMPTY', message: 'Nominal tarif tidak boleh kosong.' };
  }
  const numericValue = parseNumberFromDots(formattedValue);
  if (isNaN(numericValue) || numericValue < 0) {
    return { valid: false, reason: 'INVALID', message: 'Nominal tarif tidak valid.' };
  }
  return { valid: true, reason: null, value: numericValue };
}

/**
 * Build batch update payload containing ONLY modified courts belonging to activeTenantId
 */
export function buildChangedCourtsPayload(courtsList, courtPricesMap, activeTenantId) {
  const validTenantCourts = filterCourtsByTenant(courtsList, activeTenantId);
  const changed = validTenantCourts.filter((c) => {
    const currentInputFormatted = courtPricesMap?.[c.id];
    if (currentInputFormatted === undefined) return false;
    const currentVal = parseNumberFromDots(currentInputFormatted);
    const originalVal = Number(c.price || 0);
    return currentVal !== originalVal;
  });

  return changed.map((c) => ({
    id: c.id,
    name: c.name,
    sport: c.sport,
    price: parseNumberFromDots(courtPricesMap[c.id] ?? c.price),
    isActive: c.isActive !== false
  }));
}

/**
 * MobileCourtPricingMain Component
 * Dedicated Mobile-First Presentation Layer for Facility Courts & Pricing Management.
 * Strictly scoped under .chua-mobile-app with >=44px touch targets and native mobile ergonomics.
 * @param {{ userProfile?: any, loadError?: any }} props
 */
export default function MobileCourtPricingMain({ userProfile, loadError = null }) {
  const tenantId = resolveTenantId(userProfile);
  const tenantName = userProfile?.tenant?.name || 'Cabang Aktif';

  // Guard: Pass null to useArenaData when explicit tenantId is missing so useArenaData
  // never falls back to userProfile.uid or triggers an unauthorized fetch.
  const safeArenaProfile = useMemo(() => {
    if (!tenantId) return null;
    return userProfile;
  }, [userProfile, tenantId]);

  const { courts: rawCourts, isLoading, refetch } = useArenaData(safeArenaProfile);

  // Tenant-isolated Courts: strictly bound to active tenant to prevent cross-tenant contamination
  const courts = useMemo(() => {
    return filterCourtsByTenant(rawCourts, tenantId);
  }, [rawCourts, tenantId]);

  // Editable local state for court prices: { [courtId]: formattedString }
  const [courtPrices, setCourtPrices] = useState({});

  // Local state for bulk pricing inputs per sport category: { [sportKey]: formattedString }
  const [bulkPrices, setBulkPrices] = useState({});

  // UI States
  const [savingAllPrices, setSavingAllPrices] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
  const [selectedSportFilter, setSelectedSportFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync courts prices into local state
  useEffect(() => {
    if (courts && courts.length > 0) {
      setCourtPrices((prev) => {
        const next = { ...prev };
        courts.forEach((c) => {
          if (next[c.id] === undefined) {
            next[c.id] = c.price ? formatNumberWithDots(c.price) : '0';
          }
        });
        return next;
      });
    }
  }, [courts]);

  // Group courts by sport
  const courtsBySport = useMemo(() => {
    return groupCourtsBySport(courts);
  }, [courts]);

  // Calculate unsaved courts
  const unsavedCourts = useMemo(() => {
    if (!tenantId || !courts || courts.length === 0) return [];
    return courts.filter((c) => {
      const currentInputFormatted = courtPrices[c.id];
      if (currentInputFormatted === undefined) return false;
      if (String(currentInputFormatted).trim() === '') return true;
      const currentVal = parseNumberFromDots(currentInputFormatted);
      const originalVal = Number(c.price || 0);
      return currentVal !== originalVal;
    });
  }, [courts, courtPrices, tenantId]);

  // Detect any court with empty/invalid price input
  const invalidCourts = useMemo(() => {
    if (!courts || courts.length === 0) return [];
    return courts.filter((c) => {
      const currentInputFormatted = courtPrices[c.id];
      if (currentInputFormatted === undefined) return false;
      return !validatePriceInput(currentInputFormatted).valid;
    });
  }, [courts, courtPrices]);

  // Pricing statistics
  const pricingStats = useMemo(() => {
    if (!courts || courts.length === 0) {
      return { min: 0, max: 0, avg: 0, sportCount: 0 };
    }
    const prices = courts.map((c) => Number(c.price || 0));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / prices.length);
    const sportCount = Object.keys(courtsBySport).length;
    return { min, max, avg, sportCount };
  }, [courts, courtsBySport]);

  // Filtered courts list
  const filteredCourts = useMemo(() => {
    return courts.filter((court) => {
      const matchesSport = selectedSportFilter === 'all' || (court.sport || 'Umum') === selectedSportFilter;
      const matchesSearch = (court.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (court.sport || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSport && matchesSearch;
    });
  }, [courts, selectedSportFilter, searchQuery]);

  // Handlers
  const handlePriceInputChange = (courtId, value) => {
    const formatted = formatNumberWithDots(value);
    setCourtPrices((prev) => ({
      ...prev,
      [courtId]: formatted
    }));
  };

  const handleRevertCourtPrice = (courtId, originalPrice) => {
    setCourtPrices((prev) => ({
      ...prev,
      [courtId]: originalPrice ? formatNumberWithDots(originalPrice) : '0'
    }));
  };

  const handleBulkPriceInputChange = (sportKey, value) => {
    const formatted = formatNumberWithDots(value);
    setBulkPrices((prev) => ({
      ...prev,
      [sportKey]: formatted
    }));
  };

  const handleApplyBulkPrice = (sportKey) => {
    const formattedPrice = bulkPrices[sportKey];
    const validation = validatePriceInput(formattedPrice);
    if (!validation.valid || validation.value <= 0) {
      setFeedback({
        type: 'error',
        text: `Masukkan nominal tarif bulk yang valid untuk ${sportKey} (lebih dari Rp 0).`
      });
      return;
    }

    setCourtPrices((prev) => {
      const updated = { ...prev };
      courts.forEach((c) => {
        const cSport = c.sport || 'Umum';
        if (cSport.toLowerCase() === sportKey.toLowerCase()) {
          updated[c.id] = formattedPrice;
        }
      });
      return updated;
    });

    setFeedback({
      type: 'info',
      text: `Tarif Rp ${formattedPrice}/jam diterapkan ke seluruh lapangan ${sportKey} (Draft lokal). Tekan tombol Simpan Semua Tarif di bawah untuk menyimpan perubahan.`
    });
  };

  const handleSaveAllCourtPrices = async () => {
    if (!tenantId) {
      setFeedback({
        type: 'error',
        text: 'Konteks cabang (Tenant ID) tidak tersedia. Penyimpanan dibatalkan.'
      });
      return;
    }

    if (invalidCourts.length > 0) {
      setFeedback({
        type: 'error',
        text: `Terdapat ${invalidCourts.length} lapangan dengan input tarif kosong atau tidak valid. Mohon lengkapi nominal tarif terlebih dahulu.`
      });
      return;
    }

    if (unsavedCourts.length === 0) {
      setFeedback({
        type: 'info',
        text: 'Semua tarif lapangan sudah sesuai dengan data terbaru. Tidak ada perubahan yang perlu disimpan.'
      });
      return;
    }

    if (savingAllPrices) return; // Prevent double submission

    setSavingAllPrices(true);
    setFeedback(null);

    try {
      const updatesArray = buildChangedCourtsPayload(courts, courtPrices, tenantId);
      if (updatesArray.length === 0) {
        setSavingAllPrices(false);
        return;
      }

      await updateCourtsBatch(updatesArray);

      // Refresh application arena data
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      }
      if (refetch) {
        await refetch();
      }

      setFeedback({
        type: 'success',
        text: `Berhasil menyimpan pembaruan tarif untuk ${updatesArray.length} lapangan!`
      });
    } catch (err) {
      console.error('[MobileCourtPricingMain] Batch update error:', err);
      setFeedback({
        type: 'error',
        text: 'Gagal menyimpan tarif lapangan: ' + (err.message || 'Terjadi kesalahan sistem.')
      });
    } finally {
      setSavingAllPrices(false);
    }
  };

  // Auto-dismiss feedback message after 5s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // 1. SPECIAL CASE: Missing Tenant Context Screen
  if (!tenantId) {
    return (
      <div className="chua-mobile-app min-h-screen bg-[#F5F7FC] p-4 flex items-center justify-center text-[#17233D]">
        <div className="bg-white border border-amber-200 rounded-[18px] p-6 text-center max-w-sm shadow-xs space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#17233D]">Konteks Cabang (Tenant) Tidak Ditemukan</h2>
          <p className="text-xs text-[#68758B] leading-relaxed">
            Akun Anda tidak memiliki asosiasi cabang/tenant yang valid. Hubungi administrator sistem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chua-mobile-app min-h-screen bg-[#F5F7FC] text-[#17233D] pb-40">
      {/* 1. TOP HEADER & HERO BANNER (DASHBOARD RINGKAS FASILITAS) */}
      <div className="bg-[#101D38] text-white p-4 rounded-[18px] shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Dumbbell className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-white leading-snug my-0">
                  Tarif &amp; Fasilitas Lapangan
                </h1>
                <p className="text-[11px] text-slate-300 font-medium truncate">
                  {tenantName}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {unsavedCourts.length > 0 ? (
                <span className="px-2.5 py-1 bg-amber-400 text-slate-950 text-[10px] font-extrabold rounded-lg inline-block whitespace-nowrap">
                  {unsavedCourts.length} Belum Disimpan
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-white/10 text-emerald-300 text-[10px] font-bold rounded-lg inline-block whitespace-nowrap">
                  Tersinkronisasi
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics Grid: Total Lapangan, Cabor, Ringkasan Tarif, Unsaved */}
          <div className="grid grid-cols-3 gap-2 pt-1 items-stretch">
            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-slate-300 font-medium block leading-tight">Total Lapangan</span>
              <div className="mt-1.5">
                <span className="text-base font-extrabold text-white font-mono tabular-nums block leading-none">
                  {isLoading ? '...' : courts.length}
                </span>
                <span className="text-[9px] text-slate-300 mt-1 block">Terdaftar</span>
              </div>
            </div>

            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-slate-300 font-medium block leading-tight">Cabang Olahraga</span>
              <div className="mt-1.5">
                <span className="text-base font-extrabold text-white font-mono tabular-nums block leading-none">
                  {isLoading ? '...' : pricingStats.sportCount}
                </span>
                <span className="text-[9px] text-slate-300 mt-1 block">Cabor Aktif</span>
              </div>
            </div>

            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10 flex flex-col justify-between">
              <span className="text-[10px] text-slate-300 font-medium block leading-tight">Perubahan Tarif</span>
              <div className="mt-1.5">
                <span className="text-base font-extrabold text-amber-300 font-mono tabular-nums block leading-none">
                  {unsavedCourts.length}
                </span>
                <span className="text-[9px] text-slate-300 mt-1 block">Belum Disimpan</span>
              </div>
            </div>
          </div>

          {/* Ringkasan Tarif & Rincian Lapangan per Cabang Olahraga */}
          {!isLoading && courts.length > 0 && (
            <div className="bg-white/8 rounded-[14px] p-2.5 border border-white/10 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-200">
                <span className="text-slate-300">Ringkasan Tarif / Jam:</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  Rp {pricingStats.min.toLocaleString('id-ID')} – Rp {pricingStats.max.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 text-[10px] pt-1 border-t border-white/10">
                <span>Rata-rata: Rp {pricingStats.avg.toLocaleString('id-ID')}/jam</span>
                <span className="truncate max-w-[180px]">
                  {Object.entries(courtsBySport)
                    .map(([sport, list]) => `${sport}: ${list.length}`)
                    .join(' · ')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 2. FEEDBACK ALERT BANNER */}
        {feedback && (
          <div 
            role="status"
            className={`p-3.5 rounded-[18px] text-xs font-semibold flex items-start gap-2.5 shadow-xs border transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                : feedback.type === 'error'
                  ? 'bg-rose-50 text-rose-950 border-rose-200'
                  : 'bg-blue-50 text-blue-950 border-blue-200'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#16A779] shrink-0 mt-0.5" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            {feedback.type === 'info' && <Sparkles className="w-4 h-4 text-[#2455E8] shrink-0 mt-0.5" />}
            <span className="flex-1 leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {/* 3. UNSAVED CHANGES WARNING BANNER */}
        {unsavedCourts.length > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-[18px] flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-amber-950 leading-tight my-0">
                {unsavedCourts.length} perubahan tarif belum disimpan ke database
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveAllCourtPrices}
              disabled={savingAllPrices || invalidCourts.length > 0}
              className="min-h-[44px] px-3.5 py-2 bg-[#2455E8] hover:bg-[#1d44c7] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        )}

        {/* 4. BULK APPLY SECTION PER CABANG OLAHRAGA */}
        {!loadError && courts.length > 0 && (
          <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2455E8] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-extrabold text-[#17233D] uppercase tracking-wide my-0">
                    Atur Cepat Tarif (Bulk Apply)
                  </h2>
                  <p className="text-[11px] text-[#68758B] my-0">
                    Ubah tarif seluruh lapangan per cabor (tersimpan setelah klik Simpan Semua Tarif)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {Object.entries(courtsBySport).map(([sportKey, sportCourts]) => {
                const currentBulkInput = bulkPrices[sportKey] || '';
                return (
                  <div 
                    key={sportKey}
                    className="p-3 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[14px] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#17233D] flex items-center gap-1.5">
                        <Dumbbell className="w-3.5 h-3.5 text-[#2455E8]" />
                        <span>{sportKey}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-[#68758B] font-mono tabular-nums">
                        {sportCourts.length} Lapangan
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="text-xs font-bold text-[#68758B] absolute left-3.5 top-3.5">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Contoh: 120.000"
                          value={currentBulkInput}
                          onChange={(e) => handleBulkPriceInputChange(sportKey, e.target.value)}
                          className="w-full h-12 pl-9 pr-3 text-xs bg-white border border-[#E7EBF2] text-[#17233D] rounded-xl focus:outline-none focus:border-[#2455E8] font-bold font-mono tabular-nums shadow-2xs"
                          aria-label={`Bulk tarif ${sportKey}`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyBulkPrice(sportKey)}
                        className="h-12 min-w-[96px] px-4 bg-[#101D38] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        Terapkan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. SEARCH & SPORT FILTER TABS */}
        {!loadError && courts.length > 0 && (
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
              <input
                type="text"
                placeholder="Cari nama lapangan atau cabang olahraga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Cari lapangan"
                className="w-full h-12 pl-10 pr-3 text-xs bg-white border border-[#E7EBF2] rounded-[14px] text-[#17233D] placeholder:text-[#68758B] focus:outline-none focus:border-[#2455E8] shadow-2xs"
              />
            </div>

            {/* Filter Cabor Horizontal Carousel */}
            <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
              <button
                type="button"
                onClick={() => setSelectedSportFilter('all')}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
                  selectedSportFilter === 'all'
                    ? 'bg-[#101D38] text-white border-[#101D38] shadow-2xs'
                    : 'bg-white text-[#68758B] border-[#E7EBF2] hover:text-[#17233D]'
                }`}
              >
                Semua ({courts.length})
              </button>
              {Object.entries(courtsBySport).map(([sportKey, sCourts]) => (
                <button
                  key={sportKey}
                  type="button"
                  onClick={() => setSelectedSportFilter(sportKey)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
                    selectedSportFilter === sportKey
                      ? 'bg-[#101D38] text-white border-[#101D38] shadow-2xs'
                      : 'bg-white text-[#68758B] border-[#E7EBF2] hover:text-[#17233D]'
                  }`}
                >
                  {sportKey} ({sCourts.length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6. DAFTAR LAPANGAN INDIVIDUAL (MOBILE CARDS) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold text-[#68758B] uppercase tracking-wider my-0">
              Daftar Lapangan &amp; Tarif Individual
            </h3>
            <span className="text-[11px] text-[#68758B] font-mono tabular-nums">
              {filteredCourts.length} / {courts.length} Lapangan
            </span>
          </div>

          {loadError ? (
            <div className="bg-white border border-rose-200 rounded-[18px] p-6 text-center shadow-xs space-y-3">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#17233D] my-0">Gagal Memuat Data Lapangan</h4>
              <p className="text-xs text-[#68758B] max-w-xs mx-auto leading-relaxed">
                {typeof loadError === 'string' ? loadError : (loadError?.message || 'Terjadi gangguan jaringan saat mengambil daftar fasilitas lapangan.')}
              </p>
              {refetch && (
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="min-h-[44px] px-4 py-2 bg-[#2455E8] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Muat Ulang</span>
                </button>
              )}
            </div>
          ) : isLoading ? (
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-6 text-center shadow-xs">
              <MobileLoadingState message="Memuat daftar lapangan fasilitas..." />
            </div>
          ) : courts.length === 0 ? (
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-6 text-center shadow-xs">
              <MobileEmptyState
                title="Belum Ada Lapangan"
                description="Belum ada fasilitas lapangan yang terdaftar pada cabang ini. Lengkapi fasilitas melalui form onboarding atau administrator."
                icon={<Inbox className="w-8 h-8 text-slate-400" />}
              />
            </div>
          ) : filteredCourts.length === 0 ? (
            <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-6 text-center shadow-xs">
              <MobileEmptyState
                title="Tidak Ada Lapangan Cocok"
                description="Tidak ada lapangan yang sesuai dengan kata kunci pencarian atau filter cabang olahraga."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCourts.map((court) => {
                const currentPriceInput = courtPrices[court.id] !== undefined
                  ? courtPrices[court.id]
                  : formatNumberWithDots(court.price || 0);
                const validation = validatePriceInput(currentPriceInput);
                const parsedVal = parseNumberFromDots(currentPriceInput);
                const originalVal = Number(court.price || 0);
                const isChanged = !validation.valid || parsedVal !== originalVal;

                return (
                  <div
                    key={court.id}
                    className={`bg-white rounded-[18px] p-4 border transition-all shadow-xs ${
                      !validation.valid
                        ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/10'
                        : isChanged
                          ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/20'
                          : 'border-[#E7EBF2]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-sm text-[#17233D] my-0 leading-tight">
                            {court.name}
                          </h4>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-xs font-semibold text-[#68758B]">
                            {court.sport || 'Umum'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#68758B] mt-1 mb-0">
                          Tarif tersimpan:{' '}
                          <span className="font-bold text-[#17233D] font-mono tabular-nums">
                            Rp {originalVal.toLocaleString('id-ID')}/jam
                          </span>
                        </p>
                      </div>

                      {isChanged && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2 py-1 text-[10px] font-extrabold rounded-lg border ${
                            !validation.valid
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-900 border-amber-200'
                          }`}>
                            {!validation.valid ? 'Nominal Kosong' : 'Belum Disimpan'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevertCourtPrice(court.id, court.price)}
                            className="min-h-[44px] min-w-[44px] rounded-xl text-[#68758B] hover:text-[#17233D] bg-[#F5F7FC] border border-[#E7EBF2] flex items-center justify-center cursor-pointer"
                            title="Kembalikan ke tarif tersimpan"
                            aria-label={`Batalkan perubahan ${court.name}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Input Tarif Baru */}
                    <div className="space-y-1.5">
                      <label 
                        htmlFor={`mobile-court-price-${court.id}`}
                        className="text-[11px] font-bold text-[#68758B] block"
                      >
                        Tarif Baru per Jam
                      </label>
                      <div className="relative">
                        <span className="text-xs font-bold text-[#68758B] absolute left-3.5 top-3.5">Rp</span>
                        <input
                          id={`mobile-court-price-${court.id}`}
                          type="text"
                          inputMode="numeric"
                          value={currentPriceInput}
                          onChange={(e) => handlePriceInputChange(court.id, e.target.value)}
                          placeholder="Masukkan nominal tarif"
                          className={`w-full h-12 pl-9 pr-3 text-xs rounded-xl font-mono tabular-nums font-extrabold text-[#17233D] focus:outline-none transition-colors ${
                            !validation.valid
                              ? 'bg-white border-2 border-rose-400 focus:border-rose-500'
                              : isChanged
                                ? 'bg-white border-2 border-amber-400 focus:border-[#2455E8]'
                                : 'bg-[#F5F7FC] border border-[#E7EBF2] focus:bg-white focus:border-[#2455E8]'
                          }`}
                          aria-label={`Tarif per jam ${court.name}`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-[#68758B] font-medium">Pratinjau Tarif:</span>
                        {validation.valid ? (
                          <span className="font-extrabold text-[#2455E8] font-mono tabular-nums">
                            Rp {parsedVal.toLocaleString('id-ID')} / jam
                          </span>
                        ) : (
                          <span className="font-bold text-rose-600">
                            {validation.message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 7. STICKY BOTTOM ACTION BAR (SIMPAN SEMUA TARIF) */}
      <div className="fixed bottom-[74px] left-3 right-3 z-30 bg-white/95 backdrop-blur-md border border-[#E7EBF2] rounded-[18px] p-3 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#68758B] block leading-tight">
              Status Perubahan
            </span>
            <span className="text-xs font-extrabold text-[#17233D] block truncate">
              {invalidCourts.length > 0 ? (
                <span className="text-rose-600">{invalidCourts.length} Input Tidak Valid</span>
              ) : unsavedCourts.length > 0 ? (
                <span className="text-amber-700">{unsavedCourts.length} Lapangan Diubah</span>
              ) : (
                <span className="text-[#68758B]">Tidak ada perubahan</span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveAllCourtPrices}
            disabled={savingAllPrices || unsavedCourts.length === 0 || invalidCourts.length > 0}
            className="h-12 px-5 bg-[#2455E8] hover:bg-[#1d44c7] text-white text-xs font-extrabold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 min-w-[176px] whitespace-nowrap"
          >
            {savingAllPrices ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Semua Tarif {unsavedCourts.length > 0 ? `(${unsavedCourts.length})` : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
