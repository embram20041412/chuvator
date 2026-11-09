import React, { useState } from 'react';
import useArenaData from '../../../hooks/useArenaData';
import MobileBookingDashboard from './MobileBookingDashboard';
import MobileBookingCalendar from './MobileBookingCalendar';
import MobileBookingList from './MobileBookingList';
import MobileCreateBookingSheet from './MobileCreateBookingSheet';
import MobileBookingDetailDrawer from './MobileBookingDetailDrawer';
import BookingPaymentModal from '../../../components/BookingPaymentModal';
import { Booking3DIcon } from '../../../components/icons/App3DIcons';
import { Plus, LayoutDashboard, Calendar, ListFilter } from 'lucide-react';

export default function MobileBookingMain({ userProfile }) {
  const { courts, bookings, isLoading, refetch } = useArenaData(userProfile);

  // Active Sub Tab: 'dashboard' | 'calendar' | 'list'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Selected Date Filter (default today)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Create Booking Sheet State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [slotCourtId, setSlotCourtId] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('08:00');

  // Booking Detail Drawer State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  // Payment Modal State (for Kasir & Transaction Logger integration)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingBookingData, setPendingBookingData] = useState(null);

  // Open Create Booking for specific slot
  const handleOpenBookingForSlot = (court, slot) => {
    setSlotCourtId(court.id);
    setSlotStartTime(slot.start);
    setShowCreateSheet(true);
  };

  // Open Create Booking general button
  const handleOpenCreateGeneral = () => {
    if (courts && courts.length > 0) {
      setSlotCourtId(courts[0].id);
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (selectedDate === todayStr) {
      const nextHour = Math.min(22, Math.max(8, now.getHours() + 1));
      setSlotStartTime(`${String(nextHour).padStart(2, '0')}:00`);
    } else {
      setSlotStartTime('08:00');
    }
    setShowCreateSheet(true);
  };

  // Proceed to Payment Modal
  const handleProceedToPayment = (bookingData) => {
    setPendingBookingData(bookingData);
    setShowCreateSheet(false);
    setShowPaymentModal(true);
  };

  // Open Detail Drawer
  const handleSelectBooking = (booking) => {
    setSelectedBooking(booking);
    setShowDetailDrawer(true);
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#354944] border-t-[#C89D32] rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Memuat data booking &amp; lapangan...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">

      {/* MOBILE PAGE HEADER */}
      <div className="bg-white dark:bg-[#14211E] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Booking3DIcon className="w-10 h-10 shrink-0 drop-shadow-xs" />
          <div className="text-left">
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
              Booking Lapangan
            </h1>
            <p className="text-[11px] text-slate-500">Kelola reservasi &amp; slot arena</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateGeneral}
          disabled={courts.length === 0}
          className="px-3.5 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white text-xs font-bold rounded-xl border-b-2 border-[#C89D32] shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4 text-[#C89D32]" />
          <span>+ Booking</span>
        </button>
      </div>

      {/* SUB-NAV PILLS */}
      <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/80 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#354944] text-white shadow-xs border-b-2 border-[#C89D32]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Ringkasan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-[#354944] text-white shadow-xs border-b-2 border-[#C89D32]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Slot Jam</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'list'
              ? 'bg-[#354944] text-white shadow-xs border-b-2 border-[#C89D32]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Daftar</span>
        </button>
      </div>

      {/* SUB-TAB CONTENTS */}
      {activeTab === 'dashboard' && (
        <MobileBookingDashboard
          courts={courts}
          bookings={bookings}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenCreateModal={handleOpenCreateGeneral}
          onSelectBooking={handleSelectBooking}
          onSwitchTab={setActiveTab}
        />
      )}

      {activeTab === 'calendar' && (
        <MobileBookingCalendar
          courts={courts}
          bookings={bookings}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenBookingForSlot={handleOpenBookingForSlot}
          onSelectBooking={handleSelectBooking}
        />
      )}

      {activeTab === 'list' && (
        <MobileBookingList
          bookings={bookings}
          onSelectBooking={handleSelectBooking}
          onOpenCreateModal={handleOpenCreateGeneral}
        />
      )}

      {/* CREATE BOOKING SHEET */}
      <MobileCreateBookingSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        userProfile={userProfile}
        initialCourtId={slotCourtId}
        initialDate={selectedDate}
        initialStartTime={slotStartTime}
        onProceedToPayment={handleProceedToPayment}
        onBookingSuccess={() => {
          if (refetch) refetch();
        }}
      />

      {/* BOOKING DETAIL DRAWER */}
      <MobileBookingDetailDrawer
        isOpen={showDetailDrawer}
        onClose={() => setShowDetailDrawer(false)}
        booking={selectedBooking}
        userProfile={userProfile}
        onBookingUpdated={() => {
          if (refetch) refetch();
        }}
      />

      {/* PAYMENT MODAL (KASIR & TRANSACTION LOGGER) */}
      <BookingPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        userProfile={userProfile}
        pendingBookingData={pendingBookingData}
        onPaymentSuccess={(savedBooking) => {
          console.log('Mobile Booking & Payment completed:', savedBooking);
          if (refetch) refetch();
        }}
      />

    </div>
  );
}
