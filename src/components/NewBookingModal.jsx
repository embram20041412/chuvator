import React, { useState, useEffect } from 'react';
import useArenaData from '../hooks/useArenaData';
import { X, Calendar, Clock, User, Phone, DollarSign, Calculator, CheckCircle2 } from 'lucide-react';

export default function NewBookingModal({
  isOpen,
  onClose,
  userProfile,
  initialCourtId,
  initialDate,
  initialStartTime,
  onProceedToPayment
}) {
  const { courts } = useArenaData(userProfile);
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  // Form States
  const [selectedCourtId, setSelectedCourtId] = useState(initialCourtId || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingDate, setBookingDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState(initialStartTime || '08:00');
  const [endTime, setEndTime] = useState('09:00');

  // Auto-fill initialStartTime and compute endTime (+1 hour) when props change
  useEffect(() => {
    if (initialStartTime) {
      setStartTime(initialStartTime);
      const [h, m] = initialStartTime.split(':').map(Number);
      const nextH = (h + 1) % 24;
      const nextHStr = String(nextH).padStart(2, '0');
      const nextMStr = String(m || 0).padStart(2, '0');
      setEndTime(`${nextHStr}:${nextMStr}`);
    }
  }, [initialStartTime]);

  useEffect(() => {
    if (initialDate) {
      setBookingDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (initialCourtId) {
      setSelectedCourtId(initialCourtId);
    }
  }, [initialCourtId]);

  // Auto-calculated state
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [durationHours, setDurationHours] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Default select first court if none selected
  useEffect(() => {
    if (courts && courts.length > 0 && !selectedCourtId) {
      setSelectedCourtId(courts[0].id);
    }
  }, [courts, selectedCourtId]);

  // SMART CALCULATOR LOGIC
  useEffect(() => {
    const courtObj = courts.find((c) => c.id === selectedCourtId);
    const hourlyRate = courtObj?.price || 0;

    if (startTime && endTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);

      const startMinutes = startH * 60 + (startM || 0);
      const endMinutes = endH * 60 + (endM || 0);

      let diffMinutes = endMinutes - startMinutes;
      if (diffMinutes <= 0) {
        diffMinutes = 60; // fallback min 1 hour if end time <= start time
      }

      const hours = Math.max(1, Math.round(diffMinutes / 60));
      setDurationHours(hours);
      setCalculatedPrice(hourlyRate * hours);
    } else {
      setDurationHours(1);
      setCalculatedPrice(hourlyRate);
    }
  }, [selectedCourtId, startTime, endTime, courts]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim()) {
      setErrorMsg('Nama pemesan wajib diisi.');
      return;
    }
    if (!selectedCourtId || !tenantId) {
      setErrorMsg('Silakan pilih lapangan.');
      return;
    }

    // Time Travel Prevention: Check if booking is in the past
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [startH, startM] = (startTime || '08:00').split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const isPastDate = bookingDate < todayStr;
    const isPastTimeToday = bookingDate === todayStr && (startH < currentHour || (startH === currentHour && (startM || 0) <= currentMinute));

    if (isPastDate || isPastTimeToday) {
      setErrorMsg('Waktu pemesanan sudah terlewat. Silakan pilih waktu yang akan datang.');
      return;
    }

    const selectedCourtObj = courts.find((c) => c.id === selectedCourtId);

    const newBookingData = {
      tenantId,
      courtId: selectedCourtObj?.id || '',
      courtName: selectedCourtObj?.name || 'Lapangan',
      courtNumber: selectedCourtObj?.name || '1',
      sport: selectedCourtObj?.sport || 'Sports',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      bookingDate,
      startTime,
      endTime,
      durationHours,
      price: calculatedPrice,
      status: 'Lunas',
    };

    if (onProceedToPayment) {
      onProceedToPayment(newBookingData);
    }
  };

  const selectedCourtObj = courts.find((c) => c.id === selectedCourtId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-2xl shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Sticky) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Buat Reservasi Baru</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Masukkan detail jadwal untuk menghitung biaya sewa otomatis.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium shrink-0">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-left">
          
          {/* Dropdown Court Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Pilih Lapangan <span className="text-[#C89D32]">*</span>
            </label>
            <select
              value={selectedCourtId}
              onChange={(e) => setSelectedCourtId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-bold"
            >
              {courts.length === 0 ? (
                <option value="">Belum ada lapangan terdaftar</option>
              ) : (
                courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name} ({court.sport || 'Sports'}) - Rp {Number(court.price || 0).toLocaleString('id-ID')}/jam
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Nama Pemesan / Pelanggan <span className="text-[#C89D32]">*</span>
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama pemesan"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Nomor WhatsApp
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-mono"
              />
            </div>
          </div>

          {/* Tanggal & Jam Section */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Tanggal <span className="text-[#C89D32]">*</span>
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-medium font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Mulai <span className="text-[#C89D32]">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Selesai <span className="text-[#C89D32]">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-bold font-mono"
                />
              </div>
            </div>
          </div>

          {/* DYNAMIC CALCULATOR DISPLAY BOX */}
          <div className="p-3 bg-[#354944]/5 dark:bg-[#354944]/15 border border-[#354944]/20 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center space-x-1">
                <Calculator className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Rincian Biaya:</span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {durationHours} Jam Sewa x Rp {Number(selectedCourtObj?.price || 0).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t border-[#354944]/10 dark:border-white/10">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Total Biaya:</span>
              <span className="text-base font-black text-[#354944] dark:text-[#C89D32] font-mono">
                Rp {calculatedPrice.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex space-x-2.5 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || courts.length === 0}
              className="flex-1 py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Lanjut Pembayaran
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
