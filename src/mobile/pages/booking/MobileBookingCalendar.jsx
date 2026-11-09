import React, { useState } from 'react';
import { Calendar, Plus, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';

const OPERATIONAL_HOURS = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '12:00', end: '13:00' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
  { start: '17:00', end: '18:00' },
  { start: '18:00', end: '19:00' },
  { start: '19:00', end: '20:00' },
  { start: '20:00', end: '21:00' },
  { start: '21:00', end: '22:00' },
  { start: '22:00', end: '23:00' },
];

export default function MobileBookingCalendar({
  courts = [],
  bookings = [],
  selectedDate,
  onSelectDate,
  onOpenBookingForSlot,
  onSelectBooking
}) {
  const [selectedCourtFilter, setSelectedCourtFilter] = useState('ALL');

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];

  const filteredCourts = selectedCourtFilter === 'ALL'
    ? courts
    : courts.filter((c) => c.id === selectedCourtFilter);

  return (
    <div className="space-y-4 text-left">
      
      {/* DATE STRIP & QUICK PICKER */}
      <div className="bg-white dark:bg-[#14211E] p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C89D32]" />
            <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Pilih Tanggal Jadwal
            </h3>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
          />
        </div>

        {/* Quick Date Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-0.5">
          <button
            type="button"
            onClick={() => onSelectDate(todayStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              selectedDate === todayStr
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Hari Ini
          </button>

          <button
            type="button"
            onClick={() => onSelectDate(tomorrowStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              selectedDate === tomorrowStr
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Besok
          </button>

          <button
            type="button"
            onClick={() => onSelectDate(dayAfterStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
              selectedDate === dayAfterStr
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Lusa
          </button>
        </div>
      </div>

      {/* COURT FILTER TABS */}
      {courts.length > 1 && (
        <div className="flex overflow-x-auto no-scrollbar gap-2 px-1">
          <button
            type="button"
            onClick={() => setSelectedCourtFilter('ALL')}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              selectedCourtFilter === 'ALL'
                ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                : 'bg-white dark:bg-[#14211E] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10'
            }`}
          >
            Semua Lapangan ({courts.length})
          </button>
          {courts.map((court) => (
            <button
              key={court.id}
              type="button"
              onClick={() => setSelectedCourtFilter(court.id)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                selectedCourtFilter === court.id
                  ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                  : 'bg-white dark:bg-[#14211E] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10'
              }`}
            >
              {court.name}
            </button>
          ))}
        </div>
      )}

      {/* COURTS SLOT GRID */}
      {filteredCourts.length === 0 ? (
        <div className="bg-white dark:bg-[#14211E] p-8 rounded-2xl text-center border border-slate-200/80 dark:border-white/10">
          <p className="text-xs font-bold text-slate-500">Tidak ada lapangan yang terdaftar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCourts.map((court) => {
            const courtPriceFormatted = court.price
              ? `Rp ${Number(court.price).toLocaleString('id-ID')}/jam`
              : 'Tarif Belum Diatur';

            return (
              <div
                key={court.id}
                className="bg-white dark:bg-[#14211E] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3"
              >
                {/* Court Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#354944]/10 dark:bg-white/10 text-[#354944] dark:text-[#C89D32] flex items-center justify-center font-bold text-xs shrink-0 border border-[#354944]/20">
                      {court.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">{court.name}</h4>
                      <p className="text-[10px] font-mono font-semibold text-[#354944] dark:text-[#C89D32]">{courtPriceFormatted}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg uppercase">
                    {court.sport || 'Sports'}
                  </span>
                </div>

                {/* Slot Grid (3 columns on mobile) */}
                <div className="grid grid-cols-3 gap-2">
                  {OPERATIONAL_HOURS.map((slot) => {
                    const activeBooking = bookings.find((b) => {
                      const matchCourt = b.courtId === court.id || b.courtName === court.name;
                      const matchDate = (b.bookingDate === selectedDate || b.date === selectedDate);
                      if (!matchCourt || !matchDate) return false;
                      if (b.isVoid || b.status === 'VOID' || b.status === 'BATAL') return false;

                      const slotTime = slot.start;
                      const bStart = b.startTime || '08:00';
                      const bEnd = b.endTime || '09:00';

                      return slotTime >= bStart && slotTime < bEnd;
                    });

                    const now = new Date();
                    const isToday = selectedDate === todayStr;
                    const isBeforeToday = selectedDate < todayStr;
                    const currentHour = now.getHours();
                    const slotHour = parseInt(slot.start.split(':')[0], 10);
                    const isPast = isBeforeToday || (isToday && slotHour <= currentHour);

                    if (activeBooking) {
                      return (
                        <div
                          key={slot.start}
                          onClick={() => onSelectBooking(activeBooking)}
                          className={`p-2 rounded-xl border flex flex-col justify-between space-y-1 shadow-2xs select-none cursor-pointer transition-transform active:scale-95 ${
                            isPast ? 'bg-slate-700 border-slate-600 opacity-90 text-white' : 'bg-[#354944] border-[#2B3D38] text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[10px] tracking-tight font-mono">
                              {slot.start}
                            </span>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-slate-400' : 'bg-[#C89D32] animate-pulse'}`} />
                          </div>
                          <p className="text-[9px] font-bold text-[#E5B640] truncate leading-tight">
                            {activeBooking.customerName}
                          </p>
                        </div>
                      );
                    }

                    if (isPast) {
                      return (
                        <div
                          key={slot.start}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-slate-400 flex flex-col justify-between space-y-1 select-none opacity-50 cursor-not-allowed"
                        >
                          <span className="font-semibold text-[10px] tracking-tight font-mono text-slate-400">
                            {slot.start}
                          </span>
                          <span className="text-[9px] font-medium text-slate-400">Lewat</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => onOpenBookingForSlot(court, slot)}
                        className="p-2 rounded-xl bg-[#FFF8E1] dark:bg-[#C89D32]/10 hover:bg-[#FFE082]/60 dark:hover:bg-[#C89D32]/20 border border-[#FFE082] dark:border-[#C89D32]/30 text-[#C89D32] flex flex-col justify-between space-y-1 transition-all shadow-2xs cursor-pointer text-left active:scale-95"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-[#A67F22] dark:text-[#E5B640] tracking-tight font-mono">
                            {slot.start}
                          </span>
                          <Plus className="w-3 h-3 text-[#C89D32]" />
                        </div>
                        <span className="text-[9px] font-extrabold text-[#C89D32]">Buka</span>
                      </button>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
