import React, { useState, useMemo } from 'react';
import useArenaData from '../../../hooks/useArenaData';
import { voidBooking, voidTransaction } from '../../../services/supabaseArenaService';
import { filterDataByTime } from '../../../components/DateRangeFilter';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import { 
  DollarSign, 
  Inbox, 
  Calendar, 
  Filter, 
  Search, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  X, 
  Loader2,
  CalendarRange,
  ArrowDownRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { 
  Booking3DIcon, 
  Kasir3DIcon, 
  Akademi3DIcon, 
  Keuangan3DIcon 
} from '../../../components/icons/App3DIcons';

/**
 * Helper check for active vs voided records (identical to FinancePage.jsx)
 */
export const isRecordActive = (item) => {
  const status = String(item?.status || '').toUpperCase();
  return status !== 'VOID' && status !== 'BATAL' && status !== 'CANCELLED' && !item?.isVoid;
};

/**
 * Helper check for booking-linked transaction (deduplication criteria)
 * Returns true if transaction is linked to a booking via bookingId or booking_id.
 */
export const isBookingLinkedTx = (t) => Boolean(t?.bookingId || t?.booking_id);

/**
 * MobileFinanceMain Component
 * Mobile-First Financial Administration for CHUVATOR Sports Arena & Academy ERP.
 * Strictly scoped under .chua-mobile-app with >=44px touch targets and native mobile ergonomics.
 */
export default function MobileFinanceMain({ userProfile }) {
  const { bookings, transactions, isLoading, refetch } = useArenaData(userProfile);

  // Time Range Filter: 'today' | 'week' | 'month' | 'custom'
  const [timeFilter, setTimeFilter] = useState('today');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });
  const [tempCustomDate, setTempCustomDate] = useState({ start: '', end: '' });

  // Category Filter: 'ALL' | 'SEWA' | 'POS' | 'SPP'
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Bottom Sheets State
  const [showTimeFilterSheet, setShowTimeFilterSheet] = useState(false);
  const [selectedLedgerItem, setSelectedLedgerItem] = useState(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showVoidConfirmSheet, setShowVoidConfirmSheet] = useState(false);
  const [itemToVoid, setItemToVoid] = useState(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Filter Data by Time Period
  const filteredBookings = useMemo(() => {
    return filterDataByTime(bookings, 'bookingDate', timeFilter, customDate);
  }, [bookings, timeFilter, customDate]);

  const filteredTransactions = useMemo(() => {
    return filterDataByTime(transactions, 'createdAt', timeFilter, customDate);
  }, [transactions, timeFilter, customDate]);

  // Active records for KPI revenue calculations (strictly excludes VOID)
  const activeBookings = useMemo(() => filteredBookings.filter(isRecordActive), [filteredBookings]);
  const activeTransactions = useMemo(() => filteredTransactions.filter(isRecordActive), [filteredTransactions]);

  // 1. Calculate KPI Metrics based on active records (identical to FinancePage.jsx)
  const bookingRevenue = useMemo(() => {
    return activeBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
  }, [activeBookings]);

  // Standalone POS transactions exclude booking-linked transactions and SPP
  const posRevenue = useMemo(() => {
    return activeTransactions
      .filter((t) => !isBookingLinkedTx(t) && t.itemCategory !== 'SPP & Pendaftaran Akademi' && t.itemCategory !== 'SPP Akademi')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [activeTransactions]);

  const sppRevenue = useMemo(() => {
    return activeTransactions
      .filter((t) => t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [activeTransactions]);

  const totalGrossRevenue = useMemo(() => {
    return bookingRevenue + posRevenue + sppRevenue;
  }, [bookingRevenue, posRevenue, sppRevenue]);

  // 2. Merge Filtered Bookings & Transactions into Single Integrated Ledger History (identical to FinancePage.jsx)
  // Deduplication: Booking-linked transactions are excluded from transactions mapping so they do NOT appear as duplicate Kasir POS row
  const mergedLedger = useMemo(() => {
    const bItems = filteredBookings.map((b) => {
      const isVoid = !isRecordActive(b);
      return {
        id: `booking-${b.id}`,
        rawId: b.id,
        collectionName: 'bookings',
        type: 'SEWA',
        categoryLabel: 'Sewa Lapangan',
        title: b.customerName || 'Pelanggan Lapangan',
        detail: `${b.courtName || `Lapangan ${b.courtNumber || ''}`} (${b.startTime || '08:00'} - ${b.endTime || '09:00'})`,
        amount: Number(b.price) || 0,
        date: b.bookingDate || b.date || 'Hari ini',
        rawDate: b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : (b.bookingDate ? new Date(b.bookingDate) : new Date()),
        isVoid,
        voidedBy: b.voidedBy || null,
        voidedAt: b.voidedAt || null,
        voidReason: b.voidReason || null
      };
    });

    const standaloneTransactions = filteredTransactions.filter((t) => !isBookingLinkedTx(t));

    const tItems = standaloneTransactions.map((t) => {
      const isSPP = t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi';
      const isVoid = !isRecordActive(t);
      return {
        id: `tx-${t.id}`,
        rawId: t.id,
        collectionName: 'transactions',
        type: isSPP ? 'SPP' : 'POS',
        categoryLabel: isSPP ? 'SPP Akademi' : 'Kasir POS',
        title: t.itemName || 'Transaksi Kasir',
        detail: `Metode: ${t.paymentMethod || 'QRIS / Cash'}`,
        amount: Number(t.amount) || 0,
        date: t.createdAt?.seconds 
          ? new Date(t.createdAt.seconds * 1000).toLocaleDateString('id-ID')
          : 'Hari ini',
        rawDate: t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000) : new Date(),
        isVoid,
        voidedBy: t.voidedBy || null,
        voidedAt: t.voidedAt || null,
        voidReason: t.voidReason || null
      };
    });

    return [...bItems, ...tItems].sort((a, b) => b.rawDate - a.rawDate);
  }, [filteredBookings, filteredTransactions]);

  // Filtered Ledger by Category & Search Query
  const displayedLedger = useMemo(() => {
    return mergedLedger.filter((item) => {
      if (filterCategory !== 'ALL' && item.type !== filterCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchDetail = (item.detail || '').toLowerCase().includes(q);
        const matchCategory = (item.categoryLabel || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDetail && !matchCategory) {
          return false;
        }
      }
      return true;
    });
  }, [mergedLedger, filterCategory, searchQuery]);

  // Handle open void confirmation
  const handleInitiateVoid = (item, e) => {
    if (e) e.stopPropagation();
    if (item.isVoid) return;
    setItemToVoid(item);
    setVoidReasonInput('Pembatalan transaksi oleh Pengelola GOR');
    setShowVoidConfirmSheet(true);
  };

  // Execute VOID operation with guard against duplicate submission
  const handleConfirmVoid = async () => {
    if (!itemToVoid || itemToVoid.isVoid || isSubmittingVoid) return;

    try {
      setIsSubmittingVoid(true);
      const voidPayload = {
        voidedBy: userProfile?.displayName || userProfile?.name || userProfile?.email || 'Admin',
        voidReason: voidReasonInput.trim() || 'Pembatalan transaksi oleh Pengelola GOR'
      };

      if (itemToVoid.collectionName === 'bookings') {
        await voidBooking(itemToVoid.rawId, voidPayload);
      } else if (itemToVoid.collectionName === 'transactions') {
        await voidTransaction(itemToVoid.rawId, voidPayload);
      }

      setFeedbackMessage({
        type: 'success',
        text: `Transaksi "${itemToVoid.title}" berhasil di-VOID (dibatalkan).`
      });

      setShowVoidConfirmSheet(false);
      setShowDetailSheet(false);
      setItemToVoid(null);

      if (refetch) {
        refetch();
      }
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
    } catch (err) {
      console.error('Error voiding transaction:', err);
      setFeedbackMessage({
        type: 'error',
        text: `Gagal membatalkan transaksi: ${err.message || 'Terjadi kesalahan sistem'}`
      });
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  // Formatter for time filter badge
  const getTimeFilterLabel = () => {
    if (timeFilter === 'today') return 'Hari Ini';
    if (timeFilter === 'week') return 'Minggu Ini';
    if (timeFilter === 'month') return 'Bulan Ini';
    if (timeFilter === 'custom') {
      if (customDate.start && customDate.end) {
        return `${customDate.start} s/d ${customDate.end}`;
      }
      return 'Kustom';
    }
    return 'Hari Ini';
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3.5 animate-pulse">
        <div className="h-44 bg-slate-200 rounded-[18px] w-full" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-24 bg-slate-200 rounded-xl" />
          <div className="h-24 bg-slate-200 rounded-xl" />
          <div className="h-24 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-10 bg-slate-200 rounded-xl w-full" />
        <div className="space-y-2 pt-2">
          <div className="h-20 bg-slate-200 rounded-xl w-full" />
          <div className="h-20 bg-slate-200 rounded-xl w-full" />
          <div className="h-20 bg-slate-200 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  const activeCount = mergedLedger.filter((i) => !i.isVoid).length;
  const voidCount = mergedLedger.filter((i) => i.isVoid).length;

  return (
    <div className="space-y-4 px-3.5 py-2 text-slate-800">
      
      {/* FEEDBACK TOAST BANNER */}
      {feedbackMessage && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm transition-all ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button 
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Tutup pesan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. FINANCIAL HERO CARD (Modern Mobile Banking Style) */}
      <div className="bg-[#101D38] text-white rounded-[18px] p-4 shadow-lg relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-12 -bottom-10 w-24 h-24 rounded-full bg-[#2455E8]/20 pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Keuangan3DIcon className="w-4 h-4 text-amber-300" />
              </div>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Total Omset Bersih
              </span>
            </div>

            {/* Time Filter Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setTempCustomDate(customDate);
                setShowTimeFilterSheet(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-[11px] font-bold text-slate-100 transition-all cursor-pointer min-h-[32px]"
            >
              <Calendar className="w-3 h-3 text-amber-300" />
              <span>{getTimeFilterLabel()}</span>
            </button>
          </div>

          <div>
            <p className="text-2xl font-black font-mono tracking-tight text-white tabular-nums">
              Rp {totalGrossRevenue.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Pendapatan aktif (di luar transaksi VOID)
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-slate-300">
              <strong className="text-white font-mono">{activeCount}</strong> Transaksi Aktif
            </span>
            {voidCount > 0 && (
              <span className="text-rose-300 font-medium">
                {voidCount} Transaksi VOID
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. THREE KPI BREAKDOWN CARDS */}
      <div className="grid grid-cols-3 gap-2">
        {/* Sewa Lapangan */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-tight truncate">
              Sewa Court
            </span>
            <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Booking3DIcon className="w-3 h-3" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs font-bold font-mono text-slate-900 truncate tabular-nums">
              Rp {bookingRevenue.toLocaleString('id-ID')}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 truncate">
              {activeBookings.length} booking
            </p>
          </div>
        </div>

        {/* Kasir POS */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-tight truncate">
              Kasir POS
            </span>
            <div className="w-5 h-5 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Kasir3DIcon className="w-3 h-3" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs font-bold font-mono text-slate-900 truncate tabular-nums">
              Rp {posRevenue.toLocaleString('id-ID')}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 truncate">
              {activeTransactions.filter((t) => !isBookingLinkedTx(t) && t.itemCategory !== 'SPP & Pendaftaran Akademi' && t.itemCategory !== 'SPP Akademi').length} item
            </p>
          </div>
        </div>

        {/* SPP Akademi */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-tight truncate">
              SPP Akademi
            </span>
            <div className="w-5 h-5 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Akademi3DIcon className="w-3 h-3" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs font-bold font-mono text-[#2455E8] truncate tabular-nums">
              Rp {sppRevenue.toLocaleString('id-ID')}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 truncate">
              {activeTransactions.filter((t) => t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi').length} pembayaran
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & CATEGORY FILTER TABS */}
      <div className="space-y-2">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari transaksi, pelanggan, atau metode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#2455E8] focus:ring-1 focus:ring-[#2455E8] text-slate-800 placeholder-slate-400 shadow-2xs min-h-[44px]"
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

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[36px] ${
              filterCategory === 'ALL'
                ? 'bg-[#101D38] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Semua ({mergedLedger.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('SEWA')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[36px] ${
              filterCategory === 'SEWA'
                ? 'bg-[#16A779] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Sewa ({filteredBookings.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('POS')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[36px] ${
              filterCategory === 'POS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            POS ({filteredTransactions.filter((t) => !isBookingLinkedTx(t) && t.itemCategory !== 'SPP & Pendaftaran Akademi' && t.itemCategory !== 'SPP Akademi').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('SPP')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[36px] ${
              filterCategory === 'SPP'
                ? 'bg-[#2455E8] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            SPP ({filteredTransactions.filter((t) => t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi').length})
          </button>
        </div>
      </div>

      {/* 4. UNIFIED FINANCIAL LEDGER LIST */}
      <div className="space-y-2 pb-6">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700">
            Riwayat Transaksi ({displayedLedger.length})
          </span>
          <span className="text-[10px] text-slate-400">
            Urut waktu terbaru
          </span>
        </div>

        {displayedLedger.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-700">
              Tidak ada data transaksi
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Tidak ditemukan riwayat kas pada periode atau kategori yang dipilih.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedLedger.map((item) => {
              let categoryBadge = 'bg-slate-100 text-slate-700 border-slate-200';
              if (item.type === 'SEWA') categoryBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
              if (item.type === 'POS') categoryBadge = 'bg-purple-50 text-purple-800 border-purple-200';
              if (item.type === 'SPP') categoryBadge = 'bg-blue-50 text-blue-800 border-blue-200';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedLedgerItem(item);
                    setShowDetailSheet(true);
                  }}
                  className={`bg-white border rounded-[18px] p-3.5 shadow-2xs transition-all active:scale-99 cursor-pointer ${
                    item.isVoid 
                      ? 'border-rose-200 bg-rose-50/20 opacity-80' 
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${categoryBadge}`}>
                          {item.categoryLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.date}
                        </span>
                        {item.isVoid && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                            VOID
                          </span>
                        )}
                      </div>

                      <p className={`text-xs font-bold text-slate-900 truncate ${item.isVoid ? 'line-through text-slate-400' : ''}`}>
                        {item.title}
                      </p>

                      <p className="text-[11px] text-slate-500 truncate">
                        {item.detail}
                      </p>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <span className={`text-xs font-black font-mono block tabular-nums ${
                        item.isVoid ? 'line-through text-slate-400' : 'text-[#101D38]'
                      }`}>
                        + Rp {item.amount.toLocaleString('id-ID')}
                      </span>

                      {!item.isVoid ? (
                        <button
                          type="button"
                          onClick={(e) => handleInitiateVoid(item, e)}
                          className="px-2 py-1 rounded-md text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer min-h-[28px]"
                        >
                          <Ban className="w-2.5 h-2.5" />
                          <span>Void</span>
                        </button>
                      ) : (
                        <span className="text-[9px] font-bold text-rose-500 block uppercase">
                          Dibatalkan
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

      {/* 5. TIME RANGE FILTER BOTTOM SHEET */}
      <MobileBottomSheet
        isOpen={showTimeFilterSheet}
        onClose={() => setShowTimeFilterSheet(false)}
        title="Pilih Rentang Waktu"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-500">
            Tentukan periode transaksi yang ingin dihitung ke dalam laporan keuangan.
          </p>

          {/* Quick Presets */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'week', label: 'Minggu Ini' },
              { id: 'month', label: 'Bulan Ini' }
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setTimeFilter(preset.id);
                  setShowTimeFilterSheet(false);
                }}
                className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer min-h-[48px] ${
                  timeFilter === preset.id
                    ? 'bg-[#2455E8] text-white border-[#2455E8] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <CalendarRange className="w-4 h-4 text-[#2455E8]" />
              <span>Rentang Tanggal Khusus</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  Mulai Dari
                </label>
                <input
                  type="date"
                  value={tempCustomDate.start}
                  onChange={(e) => setTempCustomDate((prev) => ({ ...prev, start: e.target.value }))}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#2455E8] font-medium min-h-[44px]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  Sampai Dengan
                </label>
                <input
                  type="date"
                  value={tempCustomDate.end}
                  onChange={(e) => setTempCustomDate((prev) => ({ ...prev, end: e.target.value }))}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#2455E8] font-medium min-h-[44px]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCustomDate(tempCustomDate);
                setTimeFilter('custom');
                setShowTimeFilterSheet(false);
              }}
              className="w-full py-3 bg-[#101D38] hover:bg-[#101D38]/90 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer min-h-[48px]"
            >
              Terapkan Rentang Kustom
            </button>
          </div>
        </div>
      </MobileBottomSheet>

      {/* 6. TRANSACTION DETAIL BOTTOM SHEET */}
      <MobileBottomSheet
        isOpen={showDetailSheet}
        onClose={() => {
          setShowDetailSheet(false);
          setSelectedLedgerItem(null);
        }}
        title="Rincian Transaksi"
      >
        {selectedLedgerItem && (
          <div className="space-y-4 pt-1">
            {/* Header info */}
            <div className={`p-3.5 rounded-2xl border ${
              selectedLedgerItem.isVoid ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200">
                  {selectedLedgerItem.categoryLabel}
                </span>
                <span className={`text-[10px] font-bold ${selectedLedgerItem.isVoid ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {selectedLedgerItem.isVoid ? 'Dibatalkan (VOID)' : 'Terkonfirmasi'}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 mt-2">
                {selectedLedgerItem.title}
              </h4>
              <p className="text-xl font-black font-mono text-[#101D38] mt-1 tabular-nums">
                Rp {selectedLedgerItem.amount.toLocaleString('id-ID')}
              </p>
            </div>

            {/* Meta details list */}
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-400">ID Referensi</span>
                <span className="font-mono font-medium text-slate-700">{selectedLedgerItem.id}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-400">Tanggal Transaksi</span>
                <span className="font-medium text-slate-700">{selectedLedgerItem.date}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-400">Detail / Keterangan</span>
                <span className="font-medium text-slate-700 text-right max-w-[200px] truncate">{selectedLedgerItem.detail}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-400">Sumber Koleksi</span>
                <span className="font-mono font-medium text-slate-700">{selectedLedgerItem.collectionName}</span>
              </div>
            </div>

            {/* VOID Metadata audit trail if voided */}
            {selectedLedgerItem.isVoid && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Jejak Audit Pembatalan (VOID)</span>
                </div>
                <div className="space-y-1 text-slate-600 text-[11px]">
                  <p>
                    <strong>Dibatalkan oleh:</strong> {selectedLedgerItem.voidedBy || 'Admin'}
                  </p>
                  {selectedLedgerItem.voidedAt && (
                    <p>
                      <strong>Waktu:</strong> {new Date(selectedLedgerItem.voidedAt).toLocaleString('id-ID')}
                    </p>
                  )}
                  {selectedLedgerItem.voidReason && (
                    <p>
                      <strong>Alasan:</strong> {selectedLedgerItem.voidReason}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Void Trigger button if record is still active */}
            {!selectedLedgerItem.isVoid && (
              <button
                type="button"
                onClick={() => {
                  handleInitiateVoid(selectedLedgerItem);
                }}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px]"
              >
                <Ban className="w-4 h-4" />
                <span>Batalkan Transaksi Ini (VOID)</span>
              </button>
            )}
          </div>
        )}
      </MobileBottomSheet>

      {/* 7. VOID CONFIRMATION BOTTOM SHEET */}
      <MobileBottomSheet
        isOpen={showVoidConfirmSheet}
        onClose={() => {
          if (!isSubmittingVoid) {
            setShowVoidConfirmSheet(false);
            setItemToVoid(null);
          }
        }}
        title="Konfirmasi Pembatalan Transaksi"
      >
        {itemToVoid && (
          <div className="space-y-4 pt-1">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-1.5 text-xs text-rose-900">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Peringatan Pembatalan (VOID)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Anda akan membatalkan transaksi <strong>"{itemToVoid.title}"</strong> senilai <strong>Rp {itemToVoid.amount.toLocaleString('id-ID')}</strong>.
              </p>
              <p className="text-[10px] text-rose-700/80">
                Transaksi ini akan ditandai VOID dan dikeluarkan dari rekap pendapatan tanpa menghapus jejak audit.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Alasan Pembatalan (Audit Trail)
              </label>
              <textarea
                rows={3}
                value={voidReasonInput}
                onChange={(e) => setVoidReasonInput(e.target.value)}
                placeholder="Tulis alasan pembatalan..."
                className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmittingVoid}
                onClick={() => {
                  setShowVoidConfirmSheet(false);
                  setItemToVoid(null);
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[48px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingVoid}
                onClick={handleConfirmVoid}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[48px] disabled:opacity-50"
              >
                {isSubmittingVoid ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Ya, Batalkan Transaksi</span>
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
