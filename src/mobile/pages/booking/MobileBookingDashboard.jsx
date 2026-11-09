import React from 'react';
import { 
  Calendar, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  DollarSign, 
  Building2,
  TrendingUp,
  User
} from 'lucide-react';
import { Booking3DIcon } from '../../../components/icons/App3DIcons';

export default function MobileBookingDashboard({
  courts = [],
  bookings = [],
  selectedDate,
  onSelectDate,
  onOpenCreateModal,
  onSelectBooking,
  onSwitchTab
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const isTodaySelected = selectedDate === todayStr;

  // Filter today's bookings
  const todaysBookings = bookings.filter(
    (b) => (b.bookingDate === selectedDate || b.date === selectedDate)
  );

  const activeBookings = todaysBookings.filter(
    (b) => !b.isVoid && b.status !== 'VOID' && b.status !== 'BATAL'
  );

  const lunasCount = activeBookings.filter(
    (b) => (b.paymentStatus || '').toLowerCase() === 'lunas' || b.status === 'Lunas'
  ).length;

  const pendingCount = activeBookings.length - lunasCount;

  const totalRevenueToday = activeBookings.reduce(
    (acc, b) => acc + Number(b.totalPrice || b.price || 0), 0
  );

  return (
    <div className="space-y-4 text-left">

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Bookings Card */}
        <div className="bg-gradient-to-br from-[#354944] to-[#253632] text-white p-4 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C89D32]">
              Reservasi Hari Ini
            </span>
            <Booking3DIcon className="w-7 h-7 drop-shadow-xs" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono tracking-tight">
              {activeBookings.length} <span className="text-xs font-normal text-slate-300">Slot</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-300 font-medium">
              <span className="text-emerald-400 font-bold">{lunasCount} Lunas</span>
              <span>•</span>
              <span className="text-amber-300 font-bold">{pendingCount} Pending</span>
            </div>
          </div>
        </div>

        {/* Total Revenue Card */}
        <div className="bg-white dark:bg-[#14211E] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Est. Omset Booking
            </span>
            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              💰
            </div>
          </div>
          <div>
            <div className="text-lg font-black font-mono text-slate-900 dark:text-slate-100 tracking-tight">
              Rp {totalRevenueToday.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Tanggal: {selectedDate}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BANNER */}
      <div className="bg-white dark:bg-[#14211E] p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Aksi Cepat Booking
          </h3>
          <span className="text-[10px] font-bold text-[#C89D32] bg-[#C89D32]/10 px-2 py-0.5 rounded-full">
            Mobile Core
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="p-3 rounded-xl bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5 text-[#C89D32] mb-1" />
            <span className="text-[10px] font-bold leading-tight">+ Booking Baru</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchTab('calendar')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 flex flex-col items-center justify-center text-center shadow-2xs cursor-pointer active:scale-95 transition-transform"
          >
            <Calendar className="w-5 h-5 text-[#354944] dark:text-[#C89D32] mb-1" />
            <span className="text-[10px] font-bold leading-tight">Slot Jam</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchTab('list')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 flex flex-col items-center justify-center text-center shadow-2xs cursor-pointer active:scale-95 transition-transform"
          >
            <Clock className="w-5 h-5 text-indigo-500 mb-1" />
            <span className="text-[10px] font-bold leading-tight">Riwayat</span>
          </button>
        </div>
      </div>

      {/* TODAY'S UPCOMING BOOKINGS LIST */}
      <div className="bg-white dark:bg-[#14211E] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Jadwal Hari Ini ({selectedDate})
            </h3>
            <p className="text-[10px] text-slate-400">Daftar reservasi aktif di arena</p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab('list')}
            className="text-xs text-[#354944] dark:text-[#C89D32] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Semua</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeBookings.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10 space-y-2">
            <span className="text-3xl">📅</span>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Belum ada booking untuk tanggal ini.</p>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-3.5 py-1.5 bg-[#354944] text-white text-xs font-bold rounded-lg border-b-2 border-[#C89D32] cursor-pointer"
            >
              + Tambah Booking Sekarang
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeBookings.slice(0, 5).map((b) => {
              const isPaid = (b.paymentStatus || '').toLowerCase() === 'lunas' || b.status === 'Lunas';
              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBooking(b)}
                  className="p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#354944]/10 dark:bg-white/10 text-[#354944] dark:text-[#C89D32] flex items-center justify-center font-bold text-xs shrink-0 border border-[#354944]/20">
                      {b.courtName ? b.courtName.charAt(0) : 'L'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{b.customerName}</h4>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {b.courtName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-[#C89D32]" />
                        <span>{b.startTime} - {b.endTime}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 block">
                      Rp {Number(b.totalPrice || b.price || 0).toLocaleString('id-ID')}
                    </span>
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                      isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isPaid ? 'Lunas' : 'Pending'}
                    </span>
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
