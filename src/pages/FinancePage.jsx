import React, { useState } from 'react';
import useArenaData from '../hooks/useArenaData';
import { voidBooking, voidTransaction } from '../services/supabaseArenaService';
import { 
  DollarSign, 
  Inbox, 
  ArrowUpRight, 
  Filter, 
  Download, 
  Sparkles,
  AlertTriangle,
  Ban
} from 'lucide-react';
import {
  Booking3DIcon,
  Kasir3DIcon,
  Akademi3DIcon,
  Keuangan3DIcon
} from '../components/icons/App3DIcons';

import DateRangeFilter, { filterDataByTime } from '../components/DateRangeFilter';

export default function FinancePage({ userProfile }) {
  const { bookings, transactions, isLoading, refetch } = useArenaData(userProfile);

  // Time Range Filter States
  const [timeFilter, setTimeFilter] = useState('today'); // 'today', 'week', 'month', 'custom'
  const [customDate, setCustomDate] = useState({ start: '', end: '' });

  // Category Filter
  const [filterCategory, setFilterCategory] = useState('ALL'); // 'ALL' | 'SEWA' | 'POS' | 'SPP'

  // Helper check for active vs voided records
  const isRecordActive = (item) => {
    const status = String(item.status || '').toUpperCase();
    return status !== 'VOID' && status !== 'BATAL' && status !== 'CANCELLED' && !item.isVoid;
  };

  // Filter Data by Time Period
  const filteredBookings = filterDataByTime(bookings, 'bookingDate', timeFilter, customDate);
  const filteredTransactions = filterDataByTime(transactions, 'createdAt', timeFilter, customDate);

  // Active records for KPI revenue calculations (strictly excludes VOID)
  const activeBookings = filteredBookings.filter(isRecordActive);
  const activeTransactions = filteredTransactions.filter(isRecordActive);

  // 1. Calculate KPI Metrics based on active records
  const bookingRevenue = activeBookings.reduce((sum, b) => sum + (b.price || 0), 0);

  const posRevenue = activeTransactions
    .filter((t) => t.itemCategory !== 'SPP & Pendaftaran Akademi' && t.itemCategory !== 'SPP Akademi')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const sppRevenue = activeTransactions
    .filter((t) => t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalGrossRevenue = bookingRevenue + posRevenue + sppRevenue;

  // 2. Merge Filtered Bookings & Transactions into Single Integrated Ledger History (Includes VOID for audit trail)
  const mergedLedger = [
    ...filteredBookings.map((b) => {
      const isVoid = !isRecordActive(b);
      return {
        id: `booking-${b.id}`,
        rawId: b.id,
        collectionName: 'bookings',
        type: 'SEWA',
        categoryLabel: 'Sewa Lapangan',
        title: b.customerName || 'Pelanggan Lapangan',
        detail: `${b.courtName || `Lapangan ${b.courtNumber}`} (${b.startTime || '08:00'} - ${b.endTime || '09:00'})`,
        amount: b.price || 0,
        date: b.bookingDate || b.date || 'Hari ini',
        rawDate: b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(),
        isVoid,
        voidedBy: b.voidedBy || null,
        voidedAt: b.voidedAt || null,
        voidReason: b.voidReason || null
      };
    }),
    ...filteredTransactions.map((t) => {
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
        amount: t.amount || 0,
        date: t.createdAt?.seconds 
          ? new Date(t.createdAt.seconds * 1000).toLocaleDateString('id-ID')
          : 'Hari ini',
        rawDate: t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000) : new Date(),
        isVoid,
        voidedBy: t.voidedBy || null,
        voidedAt: t.voidedAt || null,
        voidReason: t.voidReason || null
      };
    })
  ].sort((a, b) => b.rawDate - a.rawDate);

  // Filtered Ledger by Category
  const filteredLedger = mergedLedger.filter((item) => {
    if (filterCategory === 'ALL') return true;
    return item.type === filterCategory;
  });

  // Soft-Delete / Void Handler (preserves audit trail)
  const handleVoidTransaction = async (item) => {
    if (item.isVoid) return;
    const confirmVoid = window.confirm(
      `Apakah Anda yakin ingin melakukan VOID/Pembatalan pada transaksi "${item.title}"?\n\nTransaksi akan ditandai VOID dan dikeluarkan dari rekap pendapatan tanpa menghapus jejak audit.`
    );
    if (!confirmVoid) return;

    try {
      const voidPayload = {
        voidedBy: userProfile?.displayName || userProfile?.name || userProfile?.email || 'Admin',
        voidReason: 'Pembatalan transaksi oleh Pengelola GOR'
      };

      if (item.collectionName === 'bookings') {
        await voidBooking(item.rawId, voidPayload);
      } else if (item.collectionName === 'transactions') {
        await voidTransaction(item.rawId, voidPayload);
      }

      if (refetch) {
        refetch();
      }
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
    } catch (err) {
      console.error('Error voiding transaction in Supabase:', err);
      alert('Gagal melakukan pembatalan transaksi: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-xs text-gray-500 font-medium">
        Memuat laporan keuangan terpadu...
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#333333]">
      
      {/* HEADER BANNER TOPOGRAPHY CARD (Warm Mustard Gold) */}
      <div className="bg-[#C89D32] text-white bg-topography-waves rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="z-10">
          <div className="flex items-center space-x-2 text-white/90 font-bold text-xs uppercase tracking-widest">
            <Keuangan3DIcon className="w-5 h-5 shrink-0" />
            <span>Laporan Arus Kas Terpadu (General Ledger)</span>
          </div>
          <p className="text-xs text-white/80 font-medium mt-1">Total Pendapatan Bersih (Tidak Termasuk Transaksi VOID)</p>
          <h1 className="text-3xl font-black font-mono tracking-tight text-white mt-1">
            Rp {totalGrossRevenue.toLocaleString('id-ID')}
          </h1>
        </div>

        <div className="bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl px-4 py-2.5 text-center sm:text-right shrink-0 z-10">
          <p className="text-[10px] uppercase tracking-wider text-white/80 font-extrabold">Transaksi Aktif</p>
          <p className="text-base font-black font-mono text-white">{mergedLedger.filter((i) => !i.isVoid).length} Aktif ({mergedLedger.filter((i) => i.isVoid).length} VOID)</p>
        </div>
      </div>

      {/* TIME RANGE FILTER PANEL */}
      <DateRangeFilter
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        customDate={customDate}
        setCustomDate={setCustomDate}
      />

      {/* 3 KPI SUMMARY CARDS (Deep Slate Teal Topography Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* a. Pendapatan Sewa Lapangan */}
        <div className="bg-[#354944] text-white bg-topography-waves rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] font-extrabold text-white/80 uppercase tracking-widest">Sewa Lapangan</span>
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
              <Booking3DIcon className="w-6 h-6 shrink-0" />
            </div>
          </div>
          <div className="z-10 mt-2">
            <p className="text-2xl font-black font-mono tracking-tight text-white">
              Rp {bookingRevenue.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="border-t border-white/20 pt-2 text-[11px] font-bold text-white/80 z-10 truncate mt-2">
            {activeBookings.length} Reservasi Terkonfirmasi
          </div>
        </div>

        {/* b. Pendapatan Kasir POS */}
        <div className="bg-[#354944] text-white bg-topography-waves rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] font-extrabold text-white/80 uppercase tracking-widest">Kasir POS (Retail &amp; F&amp;B)</span>
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
              <Kasir3DIcon className="w-6 h-6 shrink-0" />
            </div>
          </div>
          <div className="z-10 mt-2">
            <p className="text-2xl font-black font-mono tracking-tight text-white">
              Rp {posRevenue.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="border-t border-white/20 pt-2 text-[11px] font-bold text-white/80 z-10 truncate mt-2">
            {activeTransactions.filter((t) => t.itemCategory !== 'SPP & Pendaftaran Akademi' && t.itemCategory !== 'SPP Akademi').length} Penjualan Retail &amp; F&amp;B
          </div>
        </div>

        {/* c. Pendapatan SPP Akademi */}
        <div className="bg-[#354944] text-white bg-topography-waves rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] font-extrabold text-white/80 uppercase tracking-widest">Akademi (SPP)</span>
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
              <Akademi3DIcon className="w-6 h-6 shrink-0" />
            </div>
          </div>
          <div className="z-10 mt-2">
            <p className="text-2xl font-black font-mono tracking-tight text-[#D4A73A]">
              Rp {sppRevenue.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="border-t border-white/20 pt-2 text-[11px] font-bold text-white/80 z-10 truncate mt-2">
            {activeTransactions.filter((t) => t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi').length} Pembayaran Iuran Siswa
          </div>
        </div>

      </div>

      {/* INTEGRATED TRANSACTIONS HISTORY LEDGER WITH TICKET NOTCHES */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div>
            <h2 className="font-black text-base text-slate-900 dark:text-slate-100">Histori Transaksi Terpadu &amp; Audit Trail</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gabungan arus kas masuk dari Sewa Lapangan, Kasir POS, &amp; SPP Akademi</p>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterCategory === 'ALL'
                  ? 'bg-[#354944] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Semua ({mergedLedger.length})
            </button>
            <button
              onClick={() => setFilterCategory('SEWA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterCategory === 'SEWA'
                  ? 'bg-[#354944] text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              Sewa ({filteredBookings.length})
            </button>
            <button
              onClick={() => setFilterCategory('POS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterCategory === 'POS'
                  ? 'bg-[#354944] text-white'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 hover:bg-purple-100'
              }`}
            >
              POS ({filteredTransactions.filter((t) => t.itemCategory !== 'SPP & Pendaftaran Akademi' && t.itemCategory !== 'SPP Akademi').length})
            </button>
            <button
              onClick={() => setFilterCategory('SPP')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterCategory === 'SPP'
                  ? 'bg-[#C89D32] text-white'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
              }`}
            >
              SPP ({filteredTransactions.filter((t) => t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi').length})
            </button>
          </div>
        </div>

        {filteredLedger.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center flex flex-col items-center justify-center p-6">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tidak ada riwayat transaksi keuangan pada periode ini</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Gunakan panel filter waktu di atas untuk melihat rentang tanggal lainnya atau catat transaksi baru.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLedger.map((item) => {
              let badgeStyle = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
              if (item.type === 'SEWA') badgeStyle = 'bg-[#354944]/15 text-[#354944] dark:text-[#C89D32] border border-[#354944]/30';
              if (item.type === 'POS') badgeStyle = 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200/80';
              if (item.type === 'SPP') badgeStyle = 'bg-[#C89D32]/15 text-[#C89D32] border border-[#C89D32]/30';

              return (
                <div 
                  key={item.id} 
                  className={`ticket-notch-container relative border p-3.5 rounded-2xl transition-all ${
                    item.isVoid 
                      ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 opacity-75' 
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span className="ticket-notch-left" />
                  <span className="ticket-notch-right" />
                  <div className="flex items-center justify-between pl-2 pr-2">
                    <div className="space-y-1 overflow-hidden pr-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider ${badgeStyle}`}>
                          {item.categoryLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{item.date}</span>
                        {item.isVoid && (
                          <span className="bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider">
                            VOID / DIBATALKAN
                          </span>
                        )}
                      </div>
                      <p className={`font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate ${item.isVoid ? 'line-through text-slate-400' : ''}`}>
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.detail} {item.isVoid && item.voidedBy ? `• Void oleh ${item.voidedBy}` : ''}
                      </p>
                    </div>

                    <div className="text-right shrink-0 flex items-center space-x-3">
                      <div>
                        <span className={`font-black font-mono text-xs sm:text-sm block ${item.isVoid ? 'line-through text-slate-400' : 'text-[#354944] dark:text-[#C89D32]'}`}>
                          + Rp {item.amount.toLocaleString('id-ID')}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider ${item.isVoid ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {item.isVoid ? 'Dibatalkan' : 'Terkonfirmasi'}
                        </span>
                      </div>

                      {!item.isVoid && (
                        <button
                          type="button"
                          onClick={() => handleVoidTransaction(item)}
                          title="Void / Batalkan Transaksi ini"
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-[10px] font-bold rounded-lg border border-red-200 dark:border-red-800 transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Void</span>
                        </button>
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
  );
}
