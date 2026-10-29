import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../config/supabase';
import { X, Calendar, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

const DAYS_MAP = {
  'Minggu': 0,
  'Senin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Kamis': 4,
  'Jumat': 5,
  'Sabtu': 6
};

export default function GenerateAcademyScheduleModal({
  isOpen,
  onClose,
  academyClass,
  tenantId
}) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Default end date 7 days from today
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() + 7);
  const [endDate, setEndDate] = useState(defaultEnd.toISOString().split('T')[0]);

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen || !academyClass) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!startDate || !endDate) {
      setErrorMsg('Tanggal mulai dan selesai wajib diisi.');
      return;
    }

    if (startDate > endDate) {
      setErrorMsg('Tanggal mulai tidak boleh lebih besar dari tanggal selesai.');
      return;
    }

    if (!academyClass.schedules || academyClass.schedules.length === 0) {
      setErrorMsg('Blueprint jadwal kelas ini kosong.');
      return;
    }

    setGenerating(true);

    try {
      // 1. AMBIL DATA BOOKING EKSISTING SEBELUM GENERATE (Cegah Bentrok Turnamen & Booking Kasir)
      const { data: bookingsData, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (bError) console.warn('[Supabase getBookings for conflict]:', bError);
      
      const existingBookings = (bookingsData || []).map((b) => ({
        id: b.id,
        courtId: b.court_id || b.courtId,
        date: b.date || b.bookingDate,
        startTime: b.start_time || b.startTime,
        endTime: b.end_time || b.endTime,
        status: b.status
      }));

      // 2. Generate date range
      const datesToProcess = [];
      let curr = new Date(startDate);
      const end = new Date(endDate);

      while (curr <= end) {
        datesToProcess.push(new Date(curr).toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      const bookingsToInsert = [];
      let successCount = 0;
      let skippedCount = 0;

      // 3. LOOP PEMBUATAN JADWAL DENGAN SMART CONFLICT DETECTION
      datesToProcess.forEach((dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay(); // 0-6

        academyClass.schedules.forEach((item) => {
          const targetDayNum = DAYS_MAP[item.day];
          if (targetDayNum === dayOfWeek && item.courtId) {
            const newSchedule = {
              courtId: item.courtId,
              date: dateStr,
              startTime: item.startTime,
              endTime: item.endTime
            };

            // Logika Overlap Waktu
            const isConflict = existingBookings.some((b) => {
              const bCourtId = b.courtId;
              const bDate = b.date || b.bookingDate;

              if (bCourtId !== newSchedule.courtId || bDate !== newSchedule.date) {
                return false;
              }

              // Abaikan booking yang sudah dibatalkan
              if (b.status === 'Dibatalkan' || b.status === 'Cancelled') {
                return false;
              }

              const bStart = b.startTime || '00:00';
              const bEnd = b.endTime || '23:59';

              // Persinggungan waktu
              return newSchedule.startTime < bEnd && newSchedule.endTime > bStart;
            });

            if (isConflict) {
              skippedCount++;
            } else {
              successCount++;
              bookingsToInsert.push({
                tenant_id: tenantId,
                class_id: academyClass.id,
                court_id: item.courtId,
                court_name: item.courtName || 'Lapangan',
                date: dateStr,
                start_time: item.startTime,
                end_time: item.endTime,
                booking_type: 'ACADEMY',
                customer_name: `Akademi: ${academyClass.className}`,
                customer_phone: '-',
                status: 'Lunas', // Locked
                total_price: 0,
                price: 0,
                payment_method: 'Internal GOR',
                created_at: new Date().toISOString()
              });
            }
          }
        });
      });

      if (bookingsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('bookings').insert(bookingsToInsert);
        if (insErr) {
          console.error('[Supabase batch insert bookings error]:', insErr);
          throw insErr;
        }
        window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      }

      // 4. TAMPILKAN SUMMARY ALERT & NOTIFIKASI
      const summaryMsg = `Sinkronisasi Selesai! Berhasil dibuat: ${successCount} sesi. Dilewati (Bentrok/Libur Turnamen): ${skippedCount} sesi.`;
      setSuccessMsg(summaryMsg);

      // Sesuai instruksi: Tampilkan alert
      try {
        window.alert(summaryMsg);
      } catch (e) {
        console.warn('Alert suppressed in iframe:', e);
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error generating academy schedule with conflict detection:', err);
      setErrorMsg('Gagal men-generate jadwal. Silakan coba lagi.');
    } finally {
      setGenerating(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Sticky) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#354944] text-[#C89D32] rounded-xl border border-[#C89D32]/30 shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Kunci Jadwal Lapangan</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Smart Conflict Detection (Auto-skip jika bentrok turnamen)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
            <div className="p-3 bg-[#354944]/10 border border-[#354944]/20 rounded-xl">
              <p className="text-xs font-bold text-[#354944] dark:text-[#C89D32]">{academyClass.className}</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                Cabor: {academyClass.sport} • Pelatih: {academyClass.coachName}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs rounded-xl font-medium flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-xs">{successMsg}</span>
              </div>
            )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Dari Tanggal <span className="text-[#354944] dark:text-[#C89D32]">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Sampai Tanggal <span className="text-[#354944] dark:text-[#C89D32]">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Sistem akan memindai rentang tanggal dan secara cerdas melewati jadwal jika bertabrakan dengan jadwal turnamen atau reservasi lapangan lain.
            </p>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end space-x-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={generating}
            className="px-5 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{generating ? 'Memeriksa & Mengunci...' : 'Generate & Blokir Lapangan'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
);

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
