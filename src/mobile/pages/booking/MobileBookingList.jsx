import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight,
  Inbox
} from 'lucide-react';

export default function MobileBookingList({
  bookings = [],
  onSelectBooking,
  onOpenCreateModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'LUNAS' | 'PENDING' | 'VOID'

  const filteredBookings = bookings.filter((b) => {
    // Status Filter
    const isVoid = b.isVoid || b.status === 'VOID' || b.status === 'BATAL';
    const isPaid = (b.paymentStatus || '').toLowerCase() === 'lunas' || b.status === 'Lunas';

    if (statusFilter === 'LUNAS' && (!isPaid || isVoid)) return false;
    if (statusFilter === 'PENDING' && (isPaid || isVoid)) return false;
    if (statusFilter === 'VOID' && !isVoid) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (b.customerName || '').toLowerCase().includes(q);
      const matchPhone = (b.customerPhone || '').includes(q);
      const matchCourt = (b.courtName || '').toLowerCase().includes(q);
      const matchDate = (b.bookingDate || b.date || '').includes(q);
      return matchName || matchPhone || matchCourt || matchDate;
    }

    return true;
  });

  return (
    <div className="space-y-4 text-left">
      
      {/* SEARCH & FILTER HEADER */}
      <div className="bg-white dark:bg-[#14211E] p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama pemesan, HP, atau lapangan..."
            className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-0.5">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'ALL'
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Semua ({bookings.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('LUNAS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'LUNAS'
                ? 'bg-emerald-700 text-white border-b-2 border-emerald-400 shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Lunas
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white border-b-2 border-amber-300 shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Pending
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('VOID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              statusFilter === 'VOID'
                ? 'bg-red-700 text-white border-b-2 border-red-400 shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Dibatalkan
          </button>
        </div>
      </div>

      {/* BOOKINGS LIST */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white dark:bg-[#14211E] p-8 rounded-2xl text-center border border-slate-200/80 dark:border-white/10 space-y-3">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
              Tidak ada data booking ditemukan.
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'Coba kata kunci pencarian lain.' : 'Belum ada reservasi tercatat.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="px-4 py-2 bg-[#354944] text-white text-xs font-bold rounded-xl border-b-2 border-[#C89D32] cursor-pointer"
          >
            + Buat Booking Baru
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const isVoid = b.isVoid || b.status === 'VOID' || b.status === 'BATAL';
            const isPaid = (b.paymentStatus || '').toLowerCase() === 'lunas' || b.status === 'Lunas';

            return (
              <div
                key={b.id}
                onClick={() => onSelectBooking(b)}
                className={`p-4 bg-white dark:bg-[#14211E] hover:bg-slate-50 dark:hover:bg-slate-900/60 rounded-2xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  isVoid
                    ? 'border-red-200 dark:border-red-950/60 opacity-75'
                    : 'border-slate-200/80 dark:border-white/10'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                    isVoid
                      ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-[#354944]/10 text-[#354944] dark:bg-white/10 dark:text-[#C89D32]'
                  }`}>
                    {b.courtName ? b.courtName.charAt(0) : 'L'}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {b.customerName}
                      </h4>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                        {b.courtName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#C89D32]" />
                        {b.bookingDate || b.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        {b.startTime} - {b.endTime}
                      </span>
                    </div>

                    {b.customerPhone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Phone className="w-3 h-3" />
                        <span>{b.customerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1 pl-2">
                  <span className="text-xs font-black font-mono text-slate-900 dark:text-slate-100 block">
                    Rp {Number(b.totalPrice || b.price || 0).toLocaleString('id-ID')}
                  </span>

                  {isVoid ? (
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                      Dibatalkan
                    </span>
                  ) : isPaid ? (
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Lunas
                    </span>
                  ) : (
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
