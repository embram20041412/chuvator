import React, { useState, useEffect } from 'react';
import useArenaData from '../hooks/useArenaData';
import { 
  checkCourtBookingConflict, 
  createBooking, 
  createTransaction, 
  createLedgerEntry 
} from '../services/supabaseArenaService';
import { X, Calendar, Clock, User, Phone, DollarSign, Calculator, QrCode, CreditCard, Banknote } from 'lucide-react';

export default function BookingPaymentModal({
  isOpen,
  onClose,
  userProfile,
  pendingBookingData,
  onPaymentSuccess
}) {
  const { tenantProfile } = useArenaData(userProfile);
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  const [paymentMethod, setPaymentMethod] = useState('QRIS');
  const [cashReceived, setCashReceived] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Reset cashReceived when modal opens or payment method changes
  useEffect(() => {
    setCashReceived('');
  }, [isOpen, paymentMethod]);

  if (!isOpen || !pendingBookingData) return null;

  const totalBiaya = Number(pendingBookingData.price) || 0;
  const cashNum = Number(cashReceived) || 0;
  const kembalian = cashNum - totalBiaya;

  // Validation: If paymentMethod is Cash, cashReceived must be >= totalBiaya
  const isCashValid = paymentMethod !== 'Cash' || (paymentMethod === 'Cash' && cashNum >= totalBiaya);

  const handleConfirmPayment = async () => {
    if (!isCashValid) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Check for overlapping bookings for same court & date in Supabase
      const hasConflict = await checkCourtBookingConflict(
        tenantId,
        pendingBookingData.courtId,
        pendingBookingData.bookingDate || pendingBookingData.date,
        pendingBookingData.startTime || '08:00',
        pendingBookingData.endTime || '09:00'
      );

      if (hasConflict) {
        throw new Error('Maaf, slot lapangan pada jam tersebut baru saja dipesan oleh pengguna lain.');
      }

      // 2. Insert Booking into Supabase
      const bookingPayload = {
        ...pendingBookingData,
        tenantId,
        paymentMethod,
        status: 'Lunas',
        totalPrice: totalBiaya,
        cashReceived: paymentMethod === 'Cash' ? cashNum : totalBiaya,
        changeAmount: paymentMethod === 'Cash' ? Math.max(0, kembalian) : 0,
      };

      const createdBooking = await createBooking(bookingPayload);

      // 3. Insert Transaction into Supabase
      const txPayload = {
        tenantId,
        bookingId: createdBooking.id,
        itemCategory: 'Sewa Lapangan',
        itemName: `Sewa ${pendingBookingData.courtName} (${pendingBookingData.customerName})`,
        amount: totalBiaya,
        paymentMethod,
        status: 'COMPLETED'
      };
      await createTransaction(txPayload);

      // 4. Insert Global Ledger entry into Supabase
      await createLedgerEntry({
        tenantId,
        type: 'PEMASUKAN',
        source: 'RESERVASI_LAPANGAN',
        description: `Pembayaran Sewa Lapangan ${pendingBookingData.courtName} - ${pendingBookingData.customerName}`,
        amount: totalBiaya,
        paymentMethod,
        referenceId: createdBooking.id,
        status: 'COMPLETED'
      });

      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));

      if (onPaymentSuccess && createdBooking) {
        onPaymentSuccess(createdBooking);
      }

      onClose();
    } catch (err) {
      console.error('Error processing booking payment in Supabase:', err);
      setErrorMsg(err.message || 'Gagal memproses pembayaran. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tenantQris = tenantProfile?.qrisImageBase64 || tenantProfile?.qrisUrl || '';
  const bankName = tenantProfile?.bankName || 'BCA';
  const accountNumber = tenantProfile?.bankAccountNumber || '1234567890';
  const accountHolder = tenantProfile?.bankAccountHolder || tenantProfile?.name || 'GOR Arena';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Sticky) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            <h2 className="font-black text-base text-slate-900 dark:text-slate-100">Pembayaran Sewa Lapangan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selesaikan pembayaran untuk mengonfirmasi reservasi.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium shrink-0">
            {errorMsg}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-semibold">Lapangan</span>
            <span className="font-bold text-gray-900">{pendingBookingData.courtName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-semibold">Pemesan</span>
            <span className="font-bold text-gray-900">{pendingBookingData.customerName} ({pendingBookingData.customerPhone || '-'})</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-semibold">Jadwal</span>
            <span className="font-bold text-gray-900">{pendingBookingData.bookingDate} ({pendingBookingData.startTime} - {pendingBookingData.endTime})</span>
          </div>
          <div className="pt-2.5 border-t border-gray-200 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-gray-700">Total Biaya</span>
            <span className="text-lg font-black text-[#354944]">
              Rp {totalBiaya.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700 uppercase">
            Metode Pembayaran *
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('QRIS')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === 'QRIS'
                  ? 'bg-[#354944]/10 border-[#354944] text-[#354944] shadow-xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <QrCode className="w-5 h-5 mb-1" />
              <span>QRIS</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('Transfer Bank')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === 'Transfer Bank'
                  ? 'bg-[#354944]/10 border-[#354944] text-[#354944] shadow-xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-5 h-5 mb-1" />
              <span>Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('Cash')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === 'Cash'
                  ? 'bg-[#354944]/10 border-[#354944] text-[#354944] shadow-xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Banknote className="w-5 h-5 mb-1" />
              <span>Cash</span>
            </button>
          </div>
        </div>

        {/* Conditional Payment Display */}
        {paymentMethod === 'QRIS' && (
          <div className="p-4 bg-white border border-gray-200 rounded-2xl text-center space-y-2 shadow-2xs">
            <p className="text-xs font-bold text-gray-800">Scan QRIS untuk Pembayaran Instan</p>
            {tenantQris ? (
              <div className="w-44 h-44 mx-auto border border-gray-200 rounded-xl overflow-hidden p-2 bg-white">
                <img src={tenantQris} alt="QRIS Tenant" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-44 h-44 mx-auto bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs text-center p-4">
                QRIS belum diatur di menu Pengaturan
              </div>
            )}
            <p className="text-[10px] text-gray-500">Silakan scan menggunakan m-Banking atau E-Wallet Anda.</p>
          </div>
        )}

        {paymentMethod === 'Transfer Bank' && (
          <div className="p-4 bg-[#354944]/5 border border-[#354944]/20 rounded-2xl space-y-2 text-xs">
            <p className="font-bold text-[#354944]">Informasi Rekening Bank GOR:</p>
            <div className="bg-white p-3 rounded-xl border border-[#354944]/15 space-y-1">
              <p className="text-gray-500 text-[11px]">Bank: <span className="font-bold text-gray-900">{bankName}</span></p>
              <p className="text-gray-500 text-[11px]">No. Rekening: <span className="font-black text-[#354944] text-sm">{accountNumber}</span></p>
              <p className="text-gray-500 text-[11px]">Atas Nama: <span className="font-bold text-gray-900">{accountHolder}</span></p>
            </div>
            <p className="text-[10px] text-[#354944] italic">Transfer sesuai total tagihan dan simpan bukti transfer.</p>
          </div>
        )}

        {paymentMethod === 'Cash' && (
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 text-xs">
            <p className="font-bold text-emerald-900">Kalkulator Pembayaran Tunai (Cash)</p>
            
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Jumlah Uang Diterima (Rp) *
              </label>
              <input
                type="number"
                min="0"
                placeholder="Contoh: 100000"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-gray-300 rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Change Calculator Output */}
            {cashReceived !== '' && (
              <div className="pt-2 border-t border-emerald-100">
                {kembalian < 0 ? (
                  <p className="text-xs font-bold text-red-600">
                    Uang kurang: Rp {Math.abs(kembalian).toLocaleString('id-ID')}
                  </p>
                ) : (
                  <p className="text-sm font-black text-emerald-700">
                    Kembalian: Rp {kembalian.toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        </div>

        {/* Action Buttons (Sticky Footer) */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSubmitting || !isCashValid}
            onClick={handleConfirmPayment}
            className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all ${
              !isCashValid || isSubmitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60 shadow-none'
                : 'bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] cursor-pointer'
            }`}
          >
            {isSubmitting ? 'Memproses...' : 'Konfirmasi & Bayar Lunas'}
          </button>
        </div>

      </div>
    </div>
  );
}
