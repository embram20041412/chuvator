import React, { useState, useEffect } from 'react';
import useArenaData from '../hooks/useArenaData';
import NewBookingModal from '../components/NewBookingModal';
import BookingPaymentModal from '../components/BookingPaymentModal';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Inbox, 
  Calendar 
} from 'lucide-react';
import { Booking3DIcon } from '../components/icons/App3DIcons';

// Operational Time Slots: 08:00 to 23:00 (15 hourly slots)
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

export default function BookingPage({ userProfile }) {
  const { courts, bookings, isLoading } = useArenaData(userProfile);

  // Date Filter (default today)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Accordion Expand/Collapse State (default collapsed {})
  const [expandedCourts, setExpandedCourts] = useState({});

  // New Booking Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedModalCourtId, setSelectedModalCourtId] = useState('');
  const [selectedModalStartTime, setSelectedModalStartTime] = useState('08:00');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingBookingData, setPendingBookingData] = useState(null);

  // Toggle Accordion
  const toggleAccordion = (courtId) => {
    setExpandedCourts((prev) => ({
      ...prev,
      [courtId]: !prev[courtId]
    }));
  };

  // Open Smart Booking Modal for slot
  const handleOpenBookingForSlot = (court, slot) => {
    setSelectedModalCourtId(court.id);
    setSelectedModalStartTime(slot.start);
    setShowModal(true);
  };

  // When NewBookingModal finishes, pass to Payment Modal
  const handleProceedToPayment = (bookingData) => {
    setPendingBookingData(bookingData);
    setShowModal(false);
    setShowPaymentModal(true);
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-xs text-gray-500 font-medium">
        Memuat kalender &amp; fasilitas lapangan...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#333333]">
      
      {/* PAGE HEADER & DATE FILTER */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-row flex-wrap sm:flex-nowrap justify-between items-center gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Booking3DIcon className="w-12 h-12 shrink-0 drop-shadow-2xs" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Booking Lapangan</h1>
            <p className="text-xs text-slate-500 truncate hidden sm:block">Kelola reservasi &amp; slot operasional arena</p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Date Selector */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-[#C89D32] shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (courts.length > 0) {
                setSelectedModalCourtId(courts[0].id);
              }
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              if (selectedDate === todayStr) {
                const nextHour = Math.min(22, Math.max(8, now.getHours() + 1));
                setSelectedModalStartTime(`${String(nextHour).padStart(2, '0')}:00`);
              } else {
                setSelectedModalStartTime('08:00');
              }
              setShowModal(true);
            }}
            disabled={courts.length === 0}
            className="px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white font-bold text-xs rounded-xl border-b-2 border-[#C89D32] shadow-sm transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>+ Booking Baru</span>
          </button>
        </div>
      </div>

      {/* ZERO MOCK DATA EMPTY STATE UI FOR COURTS */}
      {courts.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-100 text-center flex flex-col items-center justify-center">
          <Inbox className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-800">Belum ada fasilitas lapangan terdaftar.</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
            Gunakan menu Pengaturan GOR untuk mengkonfigurasi daftar lapangan &amp; tarif jam arena Anda.
          </p>
        </div>
      ) : (
        /* CARD GRID FOR COURTS (2 COLUMNS DESKTOP) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {courts.map((court) => {
            const courtPriceFormatted = court.price
              ? `Rp ${Number(court.price).toLocaleString('id-ID')}/jam`
              : 'Tarif Belum Diatur';

            return (
              <div
                key={court.id}
                className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-between space-y-4"
              >
                {/* Court Card Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#354944]/10 text-[#354944] rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border border-[#354944]/20">
                      {court.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="font-bold text-sm sm:text-base text-slate-800">{court.name}</h2>
                        <span className="px-2 py-0.5 bg-[#354944]/10 text-[#354944] font-bold text-[10px] rounded-md uppercase border border-[#354944]/20">
                          {court.sport || 'Sports'}
                        </span>
                      </div>
                      <p className="text-xs text-[#354944] font-bold mt-0.5">{courtPriceFormatted}</p>
                    </div>
                  </div>
                </div>

                {/* Slots Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>Slot Operasional ({selectedDate}):</span>
                    <span className="text-[10px] text-[#C89D32] font-bold">Gold = Tersedia</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {OPERATIONAL_HOURS.map((slot) => {
                      const activeBooking = bookings.find((b) => {
                        const matchCourt = b.courtId === court.id || b.courtName === court.name;
                        const matchDate = (b.bookingDate === selectedDate || b.date === selectedDate);
                        if (!matchCourt || !matchDate) return false;

                        const slotTime = slot.start;
                        const bStart = b.startTime || '08:00';
                        const bEnd = b.endTime || '09:00';

                        return slotTime >= bStart && slotTime < bEnd;
                      });

                      const now = new Date();
                      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                      const isToday = selectedDate === todayStr;
                      const isBeforeToday = selectedDate < todayStr;
                      const currentHour = now.getHours();
                      const slotHour = parseInt(slot.start.split(':')[0], 10);
                      const isPast = isBeforeToday || (isToday && slotHour <= currentHour);

                      if (activeBooking) {
                        return (
                          <div
                            key={slot.start}
                            className={`p-2 rounded-xl text-white border flex flex-col justify-between space-y-1 shadow-2xs select-none ${
                              isPast ? 'bg-slate-700 border-slate-600 opacity-80' : 'bg-[#354944] border-[#2B3D38]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-[11px] tracking-tight">
                                {slot.start}
                              </span>
                              <span className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-slate-400' : 'bg-[#C89D32] animate-pulse'}`} />
                            </div>
                            <p className="text-[10px] font-bold text-[#E5B640] truncate leading-tight">
                              {activeBooking.customerName}
                            </p>
                          </div>
                        );
                      }

                      if (isPast) {
                        return (
                          <div
                            key={slot.start}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-400 flex flex-col justify-between space-y-1 select-none cursor-not-allowed opacity-60"
                            title="Waktu telah terlewat"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[11px] text-slate-400 tracking-tight">
                                {slot.start}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">
                              Lewat
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={slot.start}
                          onClick={() => handleOpenBookingForSlot(court, slot)}
                          className="p-2 rounded-xl bg-[#FFF8E1] hover:bg-[#FFE082]/60 border border-[#FFE082] text-[#C89D32] flex flex-col justify-between space-y-1 transition-all shadow-2xs cursor-pointer text-left font-medium"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[11px] text-[#A67F22] tracking-tight">
                              {slot.start}
                            </span>
                            <Plus className="w-3 h-3 text-[#C89D32]" />
                          </div>
                          <span className="text-[10px] font-bold text-[#C89D32]">
                            Buka
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* SMART BOOKING MODAL */}
      <NewBookingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        userProfile={userProfile}
        initialCourtId={selectedModalCourtId}
        initialDate={selectedDate}
        initialStartTime={selectedModalStartTime}
        onProceedToPayment={handleProceedToPayment}
      />

      {/* PAYMENT MODAL (KASIR & TRANSACTION LOGGER) */}
      <BookingPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        userProfile={userProfile}
        pendingBookingData={pendingBookingData}
        onPaymentSuccess={(savedBooking) => {
          console.log('Booking & Payment successfully completed:', savedBooking);
        }}
      />

    </div>
  );
}
