import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  CreditCard, 
  Trash2, 
  MessageCircle, 
  AlertTriangle,
  CheckCircle2,
  Building2,
  DollarSign
} from 'lucide-react';
import supabaseArenaService from '../../../services/supabaseArenaService';

export default function MobileBookingDetailDrawer({
  isOpen,
  onClose,
  booking,
  userProfile,
  onBookingUpdated
}) {
  const [isVoiding, setIsVoiding] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !booking) return null;

  const role = userProfile?.role?.toLowerCase() || '';
  const canVoid = role === 'owner' || role === 'superadmin' || role === 'admin';

  const isVoid = booking.isVoid || booking.status === 'VOID' || booking.status === 'BATAL';
  const isPaid = (booking.paymentStatus || '').toLowerCase() === 'lunas' || booking.status === 'Lunas';

  const handleVoidBooking = async () => {
    if (!voidReason.trim()) {
      setErrorMsg('Alasan pembatalan wajib diisi.');
      return;
    }

    try {
      setIsVoiding(true);
      setErrorMsg('');
      await supabaseArenaService.voidBooking(booking.id, {
        voidedBy: userProfile?.displayName || userProfile?.email || 'Admin Mobile',
        voidReason: voidReason.trim()
      });

      if (onBookingUpdated) {
        onBookingUpdated();
      }
      setShowVoidConfirm(false);
      onClose();
    } catch (err) {
      console.error('Failed to void booking:', err);
      setErrorMsg(err.message || 'Gagal membatalkan booking.');
    } finally {
      setIsVoiding(false);
    }
  };

  const whatsappUrl = booking.customerPhone 
    ? `https://wa.me/${booking.customerPhone.replace(/[^0-9]/g, '')}` 
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-250">
        
        {/* Handle Bar */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#354944]/10 dark:bg-white/10 text-[#354944] dark:text-[#C89D32] flex items-center justify-center font-black text-sm">
              ⚽
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100 leading-tight">
                Detail Booking Lapangan
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                ID: #{booking.id?.slice(-8) || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">

          {/* Status Badge Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Reservasi</span>
              <div className="flex items-center gap-2 mt-0.5">
                {isVoid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Dibatalkan / Void
                  </span>
                ) : isPaid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Lunas &amp; Confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Clock className="w-3.5 h-3.5" /> Belum Lunas (Pending)
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Metode Pembayaran</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono mt-0.5 block">
                {booking.paymentMethod || 'QRIS / Cash'}
              </span>
            </div>
          </div>

          {/* Customer & Court Specs */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-[#354944] dark:text-[#C89D32] shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Nama Pemesan</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{booking.customerName}</span>
                </div>
              </div>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Lapangan</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{booking.courtName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Nomor HP</span>
                <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">{booking.customerPhone || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Tanggal</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {booking.bookingDate || booking.date}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Jam Slot</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {booking.startTime} - {booking.endTime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="p-4 bg-[#354944]/10 dark:bg-[#354944]/20 border border-[#354944]/30 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <DollarSign className="w-5 h-5 text-[#354944] dark:text-[#C89D32]" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Total Biaya Sewa</span>
                <span className="text-lg font-black font-mono text-[#354944] dark:text-[#C89D32]">
                  Rp {Number(booking.totalPrice || booking.price || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Notes if present */}
          {booking.notes && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-[10px] uppercase text-slate-400 block mb-0.5">Catatan / Keterangan</span>
              {booking.notes}
            </div>
          )}

          {/* Voided Details */}
          {isVoid && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 space-y-1">
              <span className="font-bold block text-[11px]">Rincian Pembatalan:</span>
              <p>Dibatalkan oleh: <strong>{booking.voidedBy || 'Admin'}</strong></p>
              <p>Alasan: <em>{booking.voidReason || 'Pembatalan transaksi'}</em></p>
            </div>
          )}

          {/* Void Confirmation Section */}
          {canVoid && !isVoid && showVoidConfirm && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Konfirmasi Pembatalan Booking</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-300">
                Tindakan ini akan membatalkan status booking dan membebaskan slot lapangan kembali.
              </p>

              {errorMsg && (
                <div className="p-2 bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 text-xs rounded-lg font-semibold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-red-800 dark:text-red-200 mb-1">
                  Alasan Pembatalan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Misal: Customer minta reschedule / Batal main"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowVoidConfirm(false)}
                  className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleVoidBooking}
                  disabled={isVoiding}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isVoiding ? 'Memproses...' : 'Ya, Batalkan Booking'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0 flex gap-2.5">
          {canVoid && !isVoid && !showVoidConfirm && (
            <button
              type="button"
              onClick={() => setShowVoidConfirm(true)}
              className="flex-1 py-2.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Batalkan Booking</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#354944] hover:bg-[#2B3D38] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
