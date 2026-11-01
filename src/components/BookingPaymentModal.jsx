import React, { useState, useEffect, useRef } from 'react';
import useArenaData from '../hooks/useArenaData';
import ThermalReceipt from './ThermalReceipt';
import { 
  checkCourtBookingConflict, 
  createBooking, 
  createTransaction, 
  createLedgerEntry 
} from '../services/supabaseArenaService';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  DollarSign, 
  Calculator, 
  QrCode, 
  CreditCard, 
  Banknote,
  Printer,
  CheckCircle2
} from 'lucide-react';

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

  // Receipt & post-payment state
  const [completedTransaction, setCompletedTransaction] = useState(null);
  const [savedBooking, setSavedBooking] = useState(null);
  const receiptRef = useRef(null);

  // Reset states when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setPaymentMethod('QRIS');
      setCashReceived('');
      setCompletedTransaction(null);
      setSavedBooking(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Reset cashReceived when paymentMethod changes
  useEffect(() => {
    setCashReceived('');
  }, [paymentMethod]);

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

      const now = new Date();
      const receiptData = {
        date: pendingBookingData.bookingDate || now.toLocaleDateString('id-ID'),
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        receiptNo: `TRX-${createdBooking.id ? String(createdBooking.id).slice(-6).toUpperCase() : Math.floor(Date.now() / 1000)}`,
        cashierName: userProfile?.fullName || userProfile?.name || 'Admin',
        customerName: pendingBookingData.customerName || 'Member',
        itemName: `Sewa ${pendingBookingData.courtName || 'Lapangan'}`,
        schedule: `${pendingBookingData.bookingDate || ''} (${pendingBookingData.startTime || ''} - ${pendingBookingData.endTime || ''})`,
        amount: totalBiaya,
        paymentMethod: paymentMethod
      };

      setSavedBooking(createdBooking);
      setCompletedTransaction(receiptData);
    } catch (err) {
      console.error('Error processing booking payment in Supabase:', err);
      setErrorMsg(err.message || 'Gagal memproses pembayaran. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    if (onPaymentSuccess && savedBooking) {
      onPaymentSuccess(savedBooking);
    }
    setCompletedTransaction(null);
    setSavedBooking(null);
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  const tenantQris = tenantProfile?.qrisImageBase64 || tenantProfile?.qrisUrl || '';
  const bankName = tenantProfile?.bankName || 'BCA';
  const accountNumber = tenantProfile?.bankAccountNumber || '1234567890';
  const accountHolder = tenantProfile?.bankAccountHolder || tenantProfile?.name || 'GOR Arena';

  const arenaData = {
    name: tenantProfile?.name || tenantProfile?.receiptHeaderName || 'KEDIRI SPORT ARENA',
    address: tenantProfile?.address || tenantProfile?.alamat || tenantProfile?.receiptAddress || 'Jl. Letjen Soetoyo No. 20, Wates, Kediri',
    phone: tenantProfile?.phone || tenantProfile?.whatsapp || tenantProfile?.receiptContact || '082131447972'
  };

  // =========================================================================
  // VIEW 2: MODAL PRATINJAU STRUK THERMAL (JIKA TRANSAKSI SUDAH SELESAI)
  // =========================================================================
  if (completedTransaction) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #thermal-receipt-printable,
            #thermal-receipt-printable * {
              visibility: visible !important;
            }
            #thermal-receipt-printable {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              box-shadow: none !important;
              border: none !important;
            }
            @page {
              margin: 0mm !important;
              size: auto !important;
            }
          }
        `}</style>

        <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-2xl shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header Dialog */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/80 dark:bg-emerald-950/40 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Pratinjau Struk Pembayaran</h2>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Pembayaran Berhasil &amp; Transaksi Dicatat</p>
              </div>
            </div>
            <button 
              onClick={handleDone} 
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Receipt Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50">
            <div className="w-full text-center space-y-0.5">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Struk Pembayaran Siap Dicetak</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Gunakan printer thermal 58mm / 80mm untuk mencetak bukti bayar.</p>
            </div>

            {/* Printable Container */}
            <div className="w-full flex justify-center overflow-x-auto p-2 bg-slate-200 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700">
              <div id="thermal-receipt-printable" className="bg-white rounded-md shadow-xs">
                <ThermalReceipt
                  ref={receiptRef}
                  transaction={completedTransaction}
                  arena={arenaData}
                />
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center space-x-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDone}
              className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg cursor-pointer transition-colors"
            >
              Selesai
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ Cetak Struk (Print)</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: FORM PEMBAYARAN & KALKULATOR CASH
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-2xl shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Sticky) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Pembayaran Sewa Lapangan</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Selesaikan pembayaran untuk konfirmasi reservasi.</p>
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-left">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Lapangan</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{pendingBookingData.courtName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Pemesan</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{pendingBookingData.customerName} ({pendingBookingData.customerPhone || '-'})</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Jadwal</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{pendingBookingData.bookingDate} ({pendingBookingData.startTime} - {pendingBookingData.endTime})</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300">Total Biaya</span>
              <span className="text-base font-black text-[#354944] dark:text-[#C89D32] font-mono">
                Rp {totalBiaya.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
              Metode Pembayaran *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('QRIS')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'QRIS'
                    ? 'bg-[#354944]/10 border-[#354944] text-[#354944] dark:text-[#C89D32] shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <QrCode className="w-4 h-4 mb-0.5" />
                <span>QRIS</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Transfer Bank')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'Transfer Bank'
                    ? 'bg-[#354944]/10 border-[#354944] text-[#354944] dark:text-[#C89D32] shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-4 h-4 mb-0.5" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'Cash'
                    ? 'bg-[#354944]/10 border-[#354944] text-[#354944] dark:text-[#C89D32] shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Banknote className="w-4 h-4 mb-0.5" />
                <span>Cash</span>
              </button>
            </div>
          </div>

          {/* Conditional Payment Display */}
          {paymentMethod === 'QRIS' && (
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center space-y-1.5 shadow-2xs">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Scan QRIS untuk Pembayaran Instan</p>
              {tenantQris ? (
                <div className="w-36 h-36 mx-auto border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden p-1.5 bg-white">
                  <img src={tenantQris} alt="QRIS Tenant" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-36 h-36 mx-auto bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs text-center p-3">
                  QRIS belum diatur di menu Pengaturan
                </div>
              )}
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Silakan scan menggunakan m-Banking atau E-Wallet.</p>
            </div>
          )}

          {paymentMethod === 'Transfer Bank' && (
            <div className="p-3 bg-[#354944]/5 dark:bg-[#354944]/15 border border-[#354944]/20 rounded-xl space-y-1.5 text-xs">
              <p className="font-bold text-[#354944] dark:text-[#C89D32] text-xs">Informasi Rekening Bank GOR:</p>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-0.5">
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Bank: <span className="font-bold text-slate-900 dark:text-slate-100">{bankName}</span></p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">No. Rekening: <span className="font-black text-[#354944] dark:text-[#C89D32] text-xs font-mono">{accountNumber}</span></p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Atas Nama: <span className="font-bold text-slate-900 dark:text-slate-100">{accountHolder}</span></p>
              </div>
              <p className="text-[10px] text-[#354944] dark:text-[#C89D32] italic">Transfer sesuai total tagihan dan simpan bukti transfer.</p>
            </div>
          )}

          {paymentMethod === 'Cash' && (
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2 text-xs">
              <p className="font-bold text-emerald-900 dark:text-emerald-300 text-xs">Kalkulator Pembayaran Tunai (Cash)</p>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Jumlah Uang Diterima (Rp) *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Contoh: 100000"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Change Calculator Output */}
              {cashReceived !== '' && (
                <div className="pt-1.5 border-t border-emerald-100 dark:border-emerald-900/40">
                  {kembalian < 0 ? (
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">
                      Uang kurang: Rp {Math.abs(kembalian).toLocaleString('id-ID')}
                    </p>
                  ) : (
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 font-mono">
                      Kembalian: Rp {kembalian.toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons (Sticky Footer) */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSubmitting || !isCashValid}
            onClick={handleConfirmPayment}
            className={`flex-1 py-2 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all ${
              !isCashValid || isSubmitting
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60 shadow-none'
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

