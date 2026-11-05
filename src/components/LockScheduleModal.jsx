import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../config/supabase';
import {
  X,
  Calendar,
  Lock,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import {
  expandScheduleSlots,
  detectScheduleConflicts,
  formatIndonesianDate
} from '../utils/scheduleGenerator';

export default function LockScheduleModal({
  isOpen,
  onClose,
  academyClass,
  tenantId,
  courts = [],
  onSuccess
}) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Default rentang tanggal: 30 hari ke depan untuk periode rutin
  const defaultEnd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  })();
  const [endDate, setEndDate] = useState(defaultEnd);

  const [generating, setGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  // State Bentrok & Saran
  const [conflictData, setConflictData] = useState(null);
  // conflictData structure:
  // {
  //   conflictDetails: { date, start_time, end_time, customer_name, booking_type, court_name },
  //   suggestionCourt: { id, name } | null
  // }

  if (!isOpen || !academyClass) return null;

  const schedules = Array.isArray(academyClass.schedules) ? academyClass.schedules : [];

  const executeLockSchedule = async (overrideCourtId = null) => {
    setGeneralError(null);
    setSuccessMsg(null);

    if (!startDate || !endDate) {
      setGeneralError('Tanggal mulai dan selesai wajib diisi.');
      return;
    }

    if (startDate > endDate) {
      setGeneralError('Tanggal mulai tidak boleh lebih besar dari tanggal selesai.');
      return;
    }

    if (schedules.length === 0) {
      setGeneralError('Blueprint jadwal kelas ini belum diatur. Silakan atur hari dan jam di form kelas terlebih dahulu.');
      return;
    }

    setGenerating(true);

    try {
      // 1. PANGGIL SUPABASE RPC TERLEBIH DAHULU
      const rpcPayload = {
        p_tenant_id: tenantId,
        p_class_id: academyClass.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_schedules: schedules,
        p_override_court_id: overrideCourtId || null
      };

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('generate_academy_schedule', rpcPayload);

      // JIKA RPC BERHASIL DI-EXECUTE DI DATABASE
      if (!rpcErr && rpcRes) {
        if (rpcRes.success === false && rpcRes.error === 'CONFLICT') {
          // Bentrok terdeteksi oleh RPC PostgreSQL
          setConflictData({
            conflictDetails: rpcRes.conflict_details,
            suggestionCourt: rpcRes.suggestion_court
          });
          setGenerating(false);
          return;
        }

        if (rpcRes.success) {
          setConflictData(null);
          setSuccessMsg(rpcRes.message || `Berhasil mengunci ${rpcRes.total_inserted} sesi jadwal lapangan.`);
          window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
          if (onSuccess) onSuccess(rpcRes);
          setTimeout(() => {
            onClose();
          }, 1800);
          return;
        }

        if (rpcRes.success === false) {
          setGeneralError(rpcRes.message || 'Gagal memproses jadwal lapangan.');
          setGenerating(false);
          return;
        }
      }

      // 2. CLIENT FALLBACK (JIKA RPC BELUM DI-DEPLOY / SKEMA CACHE SCHEMA ERROR PGRST202)
      // Menjamin pengalaman pengguna dan pengujian berjalan tanpa hambatan
      if (rpcErr && (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('schema cache') || rpcErr.code === '42883')) {
        console.info('[LockScheduleModal] RPC not yet present in remote cache, executing client-side atomic collision check fallback...');

        // Ambil data bookings dan courts dari Supabase
        const { data: existingBookingsData, error: bErr } = await supabase
          .from('bookings')
          .select('id, court_id, court_name, date, start_time, end_time, customer_name, booking_type, status')
          .eq('tenant_id', tenantId)
          .gte('date', startDate)
          .lte('date', endDate);

        if (bErr) throw bErr;

        let activeCourts = courts;
        if (!activeCourts || activeCourts.length === 0) {
          const { data: courtsData } = await supabase
            .from('courts')
            .select('id, name, sport, is_active')
            .eq('tenant_id', tenantId);
          activeCourts = courtsData || [];
        }

        // Expand slot jadwal
        const plannedSlots = expandScheduleSlots(startDate, endDate, schedules, overrideCourtId, activeCourts);
        if (plannedSlots.length === 0) {
          setGeneralError('Tidak ada jadwal yang cocok dengan hari pada rentang tanggal yang dipilih.');
          setGenerating(false);
          return;
        }

        // Deteksi collision & saran lapangan
        const collisionCheck = detectScheduleConflicts(
          plannedSlots,
          existingBookingsData || [],
          activeCourts,
          academyClass.sport
        );

        if (collisionCheck.conflict) {
          setConflictData({
            conflictDetails: collisionCheck.conflictDetails,
            suggestionCourt: collisionCheck.suggestionCourt
          });
          setGenerating(false);
          return;
        }

        // Jika tidak ada bentrok: simpan ke bookings
        const bookingsToInsert = (collisionCheck.validSlots || []).map(slot => ({
          tenant_id: tenantId,
          class_id: academyClass.id,
          court_id: slot.courtId,
          court_name: slot.courtName,
          date: slot.date,
          booking_date: slot.date,
          start_time: slot.startTime,
          end_time: slot.endTime,
          booking_type: 'ACADEMY',
          customer_name: `Akademi: ${academyClass.className}`,
          customer_phone: '-',
          status: 'Lunas',
          total_price: 0,
          price: 0,
          payment_method: 'Internal GOR',
          notes: `Rutin Otomatis Kelas ${academyClass.className}`,
          created_at: new Date().toISOString()
        }));

        const { error: insErr } = await supabase.from('bookings').insert(bookingsToInsert);
        if (insErr) throw insErr;

        setConflictData(null);
        setSuccessMsg(`Berhasil mengunci ${bookingsToInsert.length} sesi jadwal lapangan.`);
        window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
        if (onSuccess) onSuccess({ success: true, total_inserted: bookingsToInsert.length });
        setTimeout(() => {
          onClose();
        }, 1800);
        return;
      }

      // Jika error RPC lainnya yang bukan missing function
      if (rpcErr) {
        throw rpcErr;
      }
    } catch (err) {
      console.error('[LockScheduleModal] Error:', err);
      setGeneralError(err.message || 'Terjadi kesalahan sistem saat mengunci jadwal.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeLockSchedule(null);
  };

  const handleAcceptSuggestion = () => {
    if (conflictData?.suggestionCourt?.id) {
      executeLockSchedule(conflictData.suggestionCourt.id);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-schedule-title"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#162320] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#354944] text-[#C89D32] rounded-xl border border-[#C89D32]/30 shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 id="lock-schedule-title" className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Kunci Jadwal Lapangan Akademi
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Smart Routine Booking & Collision Suggestion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
            
            {/* Info Badge Kelas */}
            <div className="p-3 bg-[#354944]/10 dark:bg-[#354944]/20 border border-[#354944]/20 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#354944] dark:text-[#C89D32]">
                  {academyClass.className || academyClass.name}
                </p>
                <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded-md bg-white/70 dark:bg-black/30 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-white/10">
                  {academyClass.sport || 'Umum'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                Pelatih: <span className="font-semibold">{academyClass.coachName || academyClass.coach_name || 'Pelatih Utama'}</span>
              </p>
              
              {/* Jadwal Blueprint */}
              <div className="mt-2 pt-2 border-t border-[#354944]/10 dark:border-white/10 flex flex-wrap gap-1.5">
                {schedules.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium"
                  >
                    📅 {s.day} ({s.startTime || s.start_time} - {s.endTime || s.end_time})
                  </span>
                ))}
              </div>
            </div>

            {/* Error Message Umum */}
            {generalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs rounded-xl font-medium flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 🔴 ALERT PERINGATAN BENTROK (MERAH) */}
            {conflictData?.conflictDetails && (
              <div
                data-testid="conflict-alert"
                className="p-4 bg-red-50 dark:bg-red-950/50 border-2 border-red-400 dark:border-red-700 rounded-2xl text-red-900 dark:text-red-200 animate-in fade-in duration-200 space-y-2"
              >
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-red-800 dark:text-red-300">
                      ⚠️ Gagal! Lapangan [{conflictData.conflictDetails.court_name}] sudah terpakai pada [
                      {formatIndonesianDate(conflictData.conflictDetails.date)}] jam [
                      {conflictData.conflictDetails.start_time} - {conflictData.conflictDetails.end_time}] untuk acara [
                      {conflictData.conflictDetails.booking_type === 'ACADEMY' ? 'Kelas Akademi' : (conflictData.conflictDetails.customer_name || 'Penyewa Reguler')}].
                    </p>
                    <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-1">
                      Transaksi generator dibatalkan secara atomik demi mencegah tabrakan slot lapangan.
                    </p>
                  </div>
                </div>

                {/* 🟢/🟡 KOTAK SARAN LAPANGAN ALTERNATIF (HIJAU/KUNING) */}
                {conflictData.suggestionCourt ? (
                  <div
                    data-testid="suggestion-card"
                    className="mt-3 p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-600 rounded-xl text-amber-900 dark:text-amber-200 space-y-2.5"
                  >
                    <div className="flex items-start space-x-2">
                      <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold leading-relaxed">
                        💡 Saran: Lapangan <span className="font-bold underline text-amber-950 dark:text-amber-100">[{conflictData.suggestionCourt.name}]</span> tersedia kosong untuk seluruh rentang tanggal ini. Ingin memindahkan kelas ke lapangan ini?
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAcceptSuggestion}
                      disabled={generating}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memindahkan & Mengunci...</span>
                        </>
                      ) : (
                        <>
                          <span>Ya, Pindah & Kunci Jadwal ke [{conflictData.suggestionCourt.name}]</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 p-2 bg-red-100/60 dark:bg-red-900/40 rounded-lg text-[11px] text-red-800 dark:text-red-300">
                    ℹ️ Tidak ada lapangan alternatif lain yang kosong untuk seluruh slot tanggal ini. Silakan sesuaikan jam atau hari kelas.
                  </div>
                )}
              </div>
            )}

            {/* Input Rentang Tanggal */}
            <div className="space-y-3">
              <div>
                <label htmlFor="lock-start-date" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Dari Tanggal <span className="text-[#354944] dark:text-[#C89D32]">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="lock-start-date"
                    name="startDate"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-medium"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lock-end-date" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Sampai Tanggal <span className="text-[#354944] dark:text-[#C89D32]">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="lock-end-date"
                    name="endDate"
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-[#354944] font-medium"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Jadwal akan dikunci langsung ke sistem reservasi venue (<code className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">bookings</code>) dengan status <strong className="text-slate-700 dark:text-slate-200">Lunas</strong> dan tipe <strong className="text-slate-700 dark:text-slate-200">ACADEMY</strong>, sehingga tidak dapat disewa ulang oleh kasir atau pelanggan umum.
            </p>
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
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memeriksa & Mengunci...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kunci Jadwal Lapangan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
