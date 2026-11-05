import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, ShieldCheck, FileText, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';

/**
 * AdminPaymentVerificationModal Component (FASE 4B)
 * Admin Tenant and Owner Tenant manual payment verification interface.
 * Allows inspecting uploaded receipt image, student details, official bill amount,
 * and approving (VERIFY -> LUNAS) or rejecting with mandatory reason (REJECT -> DITOLAK).
 */
export default function AdminPaymentVerificationModal({
  isOpen,
  onClose,
  paymentData,
  tenantId,
  staffRole,
  staffUid,
  onVerificationComplete
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !paymentData) return null;

  const isAuthorizedRole = ['owner', 'admin'].includes(String(staffRole || '').toLowerCase());

  const handleApprove = async () => {
    if (!isAuthorizedRole || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/verify_payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          sppPaymentId: paymentData.id,
          action: 'VERIFY',
          notes: 'Disetujui oleh Admin/Owner Tenant',
          staffRole,
          staffUid
        })
      });

      const res = await response.json().catch(() => ({}));
      if (response.ok && res.success) {
        if (onVerificationComplete) onVerificationComplete(res);
        onClose();
      } else {
        setErrorMessage(res.message || 'Gagal memproses persetujuan pembayaran.');
      }
    } catch (err) {
      console.error('Approve payment error:', err);
      setErrorMessage('Terjadi kesalahan jaringan saat menyetujui pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!isAuthorizedRole || isSubmitting) return;
    if (!rejectionReason.trim()) {
      setErrorMessage('Catatan alasan penolakan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/verify_payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          sppPaymentId: paymentData.id,
          action: 'REJECT',
          notes: rejectionReason.trim(),
          staffRole,
          staffUid
        })
      });

      const res = await response.json().catch(() => ({}));
      if (response.ok && res.success) {
        if (onVerificationComplete) onVerificationComplete(res);
        onClose();
      } else {
        setErrorMessage(res.message || 'Gagal memproses penolakan pembayaran.');
      }
    } catch (err) {
      console.error('Reject payment error:', err);
      setErrorMessage('Terjadi kesalahan jaringan saat menolak pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Verifikasi Pembayaran Manual</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Khusus Owner &amp; Admin Tenant
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* RBAC Warning if not Owner/Admin */}
          {!isAuthorizedRole && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Akses Ditolak: Hak verifikasi pembayaran hanya dimiliki oleh <strong>Owner Tenant</strong> dan <strong>Admin Tenant</strong>. Role '{staffRole || 'Staff'}' tidak memiliki wewenang ini.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[11px]">{errorMessage}</p>
            </div>
          )}

          {/* Rincian Tagihan & Siswa */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Siswa:</span>
              <span className="font-bold text-slate-900 text-xs">{paymentData.studentName || 'Nama Siswa'}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Nominal Resmi:</span>
              <span className="font-mono font-black text-blue-700 text-sm">
                Rp {Number(paymentData.amount || 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Metode / Waktu:</span>
              <span className="text-slate-700 font-medium text-[11px]">
                {paymentData.paymentMethod || 'TRANSFER BANK'}
              </span>
            </div>
          </div>

          {/* Bukti Pembayaran Preview */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Gambar / File Bukti Transfer:</span>
            </label>
            <div className="bg-slate-100 p-2 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-40">
              {paymentData.receiptUrl ? (
                <img
                  src={paymentData.receiptUrl}
                  alt="Bukti Transfer Pembayaran"
                  className="max-h-56 object-contain rounded-xl shadow-xs"
                />
              ) : (
                <div className="py-6 text-center text-slate-400 space-y-1">
                  <FileText className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-[11px]">Tidak ada lampiran bukti transfer</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Input Alasan Penolakan */}
          {showRejectForm && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 animate-in fade-in duration-150">
              <label htmlFor="rejection-reason" className="font-bold text-amber-900 text-[11px] block">
                Catatan Alasan Penolakan (Wajib):
              </label>
              <textarea
                id="rejection-reason"
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Bukti transfer tidak terbaca / nominal tidak sesuai rekening bank"
                className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}

        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          {!showRejectForm ? (
            <>
              <button
                type="button"
                disabled={!isAuthorizedRole || isSubmitting}
                onClick={() => setShowRejectForm(true)}
                className="flex-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Tolak Pembayaran</span>
              </button>

              <button
                type="button"
                disabled={!isAuthorizedRole || isSubmitting}
                onClick={handleApprove}
                className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Setujui (LUNAS)</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowRejectForm(false)}
                className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={!isAuthorizedRole || isSubmitting || !rejectionReason.trim()}
                onClick={handleReject}
                className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span>Konfirmasi Penolakan</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
