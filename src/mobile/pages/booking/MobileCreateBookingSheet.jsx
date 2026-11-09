import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  DollarSign, 
  Calculator, 
  AlertTriangle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import supabaseArenaService from '../../../services/supabaseArenaService';
import useArenaData from '../../../hooks/useArenaData';

export default function MobileCreateBookingSheet({
  isOpen,
  onClose,
  userProfile,
  initialCourtId,
  initialDate,
  initialStartTime,
  onProceedToPayment,
  onBookingSuccess
}) {
  const { courts } = useArenaData(userProfile);
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  const [selectedCourtId, setSelectedCourtId] = useState(initialCourtId || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingDate, setBookingDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState(initialStartTime || '08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const [durationHours, setDurationHours] = useState(1);
  const [calculatedPrice, setCalculatedPrice] = useState(0);

  const [isCheckingConflict, setIsCheckingConflict] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto select first court if none selected
  useEffect(() => {
    if (courts && courts.length > 0 && !selectedCourtId) {
      setSelectedCourtId(courts[0].id);
    }
  }, [courts, selectedCourtId]);

  // Update initial parameters when props change
  useEffect(() => {
    if (initialCourtId) setSelectedCourtId(initialCourtId);
    if (initialDate) setBookingDate(initialDate);
    if (initialStartTime) {
      setStartTime(initialStartTime);
      const [h, m] = initialStartTime.split(':').map(Number);
      const nextHStr = String((h + 1) % 24).padStart(2, '0');
      const nextMStr = String(m || 0).padStart(2, '0');
      setEndTime(`${nextHStr}:${nextMStr}`);
    }
  }, [initialCourtId, initialDate, initialStartTime]);

  // Dynamic Price Calculator & Duration
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
        diffMinutes = 60;
      }

      const hours = Math.max(1, Math.round(diffMinutes / 60));
      setDurationHours(hours);
      setCalculatedPrice(hourlyRate * hours);
    } else {
      setDurationHours(1);
      setCalculatedPrice(hourlyRate);
    }
  }, [selectedCourtId, startTime, endTime, courts]);

  // Conflict Check Effect
  useEffect(() => {
    if (!tenantId || !selectedCourtId || !bookingDate || !startTime || !endTime) return;

    let isMounted = true;
    const checkConflict = async () => {
      setIsCheckingConflict(true);
      try {
        const conflict = await supabaseArenaService.checkCourtBookingConflict(
          tenantId,
          selectedCourtId,
          bookingDate,
          startTime,
          endTime
        );
        if (isMounted) {
          setHasConflict(conflict);
        }
      } catch (err) {
        console.warn('Conflict check error:', err);
      } finally {
        if (isMounted) setIsCheckingConflict(false);
      }
    };

    checkConflict();
    return () => { isMounted = false; };
  }, [tenantId, selectedCourtId, bookingDate, startTime, endTime]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
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
    if (hasConflict) {
      setErrorMsg('Slot waktu ini sudah terisi. Silakan pilih jam atau tanggal lain.');
      return;
    }

    // Time Travel Check
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
    const bookingPayload = {
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
      notes: notes.trim(),
      status: 'Lunas',
      paymentStatus: 'lunas',
      paymentMethod: 'QRIS'
    };

    if (onProceedToPayment) {
      onProceedToPayment(bookingPayload);
    } else {
      try {
        setSubmitting(true);
        const saved = await supabaseArenaService.createBooking(bookingPayload);
        if (onBookingSuccess) onBookingSuccess(saved);
        onClose();
      } catch (err) {
        console.error('Failed to create booking:', err);
        setErrorMsg(err.message || 'Gagal menyimpan pemesanan.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const selectedCourtObj = courts.find((c) => c.id === selectedCourtId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden my-0 sm:my-auto max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in slide-in-from-bottom duration-250">
        
        {/* Handle Bar */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              Buat Booking Lapangan
            </h2>
            <p className="text-[11px] text-slate-500">Pilih lapangan, jadwal jam, &amp; data pemesan</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-2xl font-semibold shrink-0 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Sheet Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">

            {/* Lapangan Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Pilih Lapangan <span className="text-[#C89D32]">*</span>
              </label>
              <select
                value={selectedCourtId}
                onChange={(e) => setSelectedCourtId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
              >
                {courts.length === 0 ? (
                  <option value="">Belum ada lapangan terdaftar</option>
                ) : (
                  courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.sport || 'Sports'}) - Rp {Number(c.price || 0).toLocaleString('id-ID')}/jam
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Nama Pemesan & Phone */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Pemesan <span className="text-[#C89D32]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama pelanggan / pemesan"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                  />
                </div>
              </div>
            </div>

            {/* Tanggal & Jam Selector */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Tanggal Booking <span className="text-[#C89D32]">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Jam Mulai <span className="text-[#C89D32]">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Jam Selesai <span className="text-[#C89D32]">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                  />
                </div>
              </div>

              {/* Conflict Alert indicator */}
              {isCheckingConflict ? (
                <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 pt-1">
                  <div className="w-3 h-3 border-2 border-[#354944] border-t-transparent rounded-full animate-spin" />
                  <span>Memeriksa ketersediaan slot...</span>
                </div>
              ) : hasConflict ? (
                <div className="p-2.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs rounded-xl font-bold flex items-center gap-1.5 border border-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Slot bentrok! Lapangan sudah terisi pada jam ini.</span>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Slot lapangan tersedia!</span>
                </div>
              )}
            </div>

            {/* Pricing Summary Box */}
            <div className="p-4 bg-[#354944]/10 dark:bg-[#354944]/25 border border-[#354944]/30 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calculator className="w-4 h-4 text-[#354944] dark:text-[#C89D32]" />
                  <span>Kalkulasi Sewa:</span>
                </span>
                <span className="font-bold font-mono">
                  {durationHours} Jam x Rp {Number(selectedCourtObj?.price || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-[#354944]/20">
                <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">Total Biaya:</span>
                <span className="text-lg font-black text-[#354944] dark:text-[#C89D32] font-mono">
                  Rp {calculatedPrice.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Catatan Opsional
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Sewa raket, bola tambahan, atau keperluan event..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
              />
            </div>

          </div>

          {/* Sticky Sheet Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || hasConflict || isCheckingConflict || courts.length === 0}
              className="flex-1 py-3 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{submitting ? 'Memproses...' : 'Lanjut Pembayaran'}</span>
              <ChevronRight className="w-4 h-4 text-[#C89D32]" />
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
