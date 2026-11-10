import React, { useRef } from 'react';
import { X, CheckCircle2, Printer } from 'lucide-react';
import PosThermalReceipt from '../../../components/PosThermalReceipt';

export default function MobilePosReceiptSheet({
  isOpen,
  onClose,
  transactionData,
  arenaData,
  onFinish
}) {
  const receiptRef = useRef(null);

  if (!isOpen || !transactionData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #mobile-thermal-receipt-printable,
          #mobile-thermal-receipt-printable * {
            visibility: visible !important;
          }
          #mobile-thermal-receipt-printable {
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

      <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden my-0 sm:my-auto max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in slide-in-from-bottom duration-250">
        
        {/* Handle Bar */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/80 dark:bg-emerald-950/40 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Struk Pembayaran Kasir
              </h2>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Transaksi Sukses &amp; Stok Terupdate
              </p>
            </div>
          </div>
          <button
            onClick={onFinish}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Container */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/60 space-y-3">
          <p className="text-[11px] text-slate-500 text-center font-medium">
            Gunakan printer thermal Bluetooth / USB untuk mencetak nota.
          </p>

          <div className="w-full flex justify-center overflow-x-auto p-2 bg-slate-200 dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700">
            <div id="mobile-thermal-receipt-printable" className="bg-white rounded-md shadow-xs">
              <PosThermalReceipt
                ref={receiptRef}
                transaction={transactionData}
                arena={arenaData}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0 flex gap-2.5">
          <button
            type="button"
            onClick={onFinish}
            className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Selesai
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ Cetak Struk</span>
          </button>
        </div>

      </div>
    </div>
  );
}
