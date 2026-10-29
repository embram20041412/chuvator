import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckCircle, Receipt } from 'lucide-react';

/**
 * GlobalReceiptModal (Universal Thermal Receipt Generator)
 * 
 * Komponen modal cetak struk kasir universal yang dapat digunakan lintas modul:
 * - Event Command Center (Pendaftaran Peserta)
 * - POS Kasir & F&B
 * - Court Booking & Sewa Lapangan
 * - Sport Academy (SPP / Registrasi Siswa)
 * 
 * @param {boolean} isOpen - Status buka/tutup modal
 * @param {function} onClose - Handler menutup modal
 * @param {object} transactionData - Data transaksi untuk struk
 */
export default function GlobalReceiptModal({ isOpen, onClose, transactionData, tenantData }) {
  // Tutup dengan tombol Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !transactionData) return null;

  const tenant = tenantData || transactionData?.tenantData;

  const {
    receiptNo = `TRX-${Date.now().toString().slice(-6)}`,
    date = new Date().toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    cashierName = 'Kasir Utama',
    storeName = 'CHUA SPORT CORE',
    storeAddress = 'Jl. Wates Km. 5, GOR Arena Utama',
    storePhone = 'WA: 0812-3456-7890',
    items = [],
    total = 0,
    paymentMethod = 'Cash',
    amountPaid = total,
    change = 0,
    status = 'LUNAS',
    customerName = '',
    notes = ''
  } = transactionData;

  // Dynamic Tenant Evaluation - Prioritize tenant profile settings over legacy placeholders
  const receiptTitle = tenant?.receiptHeaderName || tenant?.name || (transactionData?.storeName && transactionData.storeName !== 'CHUA SPORT CORE' ? transactionData.storeName : 'NAMA ARENA');
  const receiptSub = tenant?.sportsType ? `${tenant.sportsType} ARENA & ACADEMY` : (transactionData?.storeSub || '');
  const receiptAddress = tenant?.receiptAddress || tenant?.address || (transactionData?.storeAddress && transactionData.storeAddress !== 'Jl. Wates Km. 5, GOR Arena Utama' ? transactionData.storeAddress : 'Alamat Belum Diatur');
  const receiptContact = tenant?.receiptContact 
    ? (tenant.receiptContact.startsWith('WA') || tenant.receiptContact.startsWith('Telp') ? tenant.receiptContact : `WA: ${tenant.receiptContact}`)
    : (tenant?.phone ? `WA: ${tenant.phone}` : (transactionData?.storePhone && transactionData.storePhone !== 'WA: 0812-3456-7890' ? transactionData.storePhone : 'WA: -'));
  const receiptFooterNote = tenant?.receiptFooterNote || transactionData?.footerNote;

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(Number(val) || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const modalContent = (
    <>
      {/* CSS @media print terisolasi khusus cetak printer thermal (58mm/80mm) */}
      <style>{`
        @media print {
          /* Sembunyikan seluruh tampilan aplikasi di layar browser */
          body * {
            visibility: hidden !important;
          }
          /* Hanya tampilkan container struk thermal */
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
            padding: 8px 12px !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            font-family: 'Courier New', Courier, monospace, monospace !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          /* Hilangkan header, footer, & margin bawaan dialog print browser */
          @page {
            margin: 0mm !important;
            size: auto !important;
          }
        }
      `}</style>

      {/* Modal Backdrop & Container */}
      <div className="fixed inset-0 z-[999] overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-5 space-y-4 shadow-2xl relative my-auto">
          
          {/* Header Dialog (Tidak ikut dicetak) */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Universal Thermal Receipt</h3>
                <p className="text-[11px] text-slate-500">Preview Struk Kasir (Printer 58mm / 80mm)</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Bar (Tidak ikut dicetak) */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ Cetak Struk Thermal</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>

          {/* =================================================================== */}
          {/* AREA STRUK FISIK KASIR (DITARGETKAN OLEH ID PRINT)                 */}
          {/* =================================================================== */}
          <div className="p-3 bg-slate-100/70 rounded-2xl border border-slate-200 flex justify-center overflow-x-auto">
            <div
              id="thermal-receipt-printable"
              className="w-full max-w-[310px] bg-white text-slate-900 font-mono text-[11px] leading-tight p-4 shadow-sm border border-slate-300 rounded-lg select-none space-y-2.5"
            >
              {/* a. HEADER */}
              <div className="text-center space-y-0.5">
                <h4 className="font-black text-sm tracking-wider uppercase">{receiptTitle}</h4>
                {receiptSub && (
                  <div className="font-bold text-[10px] uppercase text-slate-700">{receiptSub}</div>
                )}
                <div className="text-[10px] text-slate-600">{receiptAddress}</div>
                <div className="text-[10px] text-slate-600">{receiptContact}</div>
              </div>

              {/* Garis Putus-putus */}
              <div className="border-b border-dashed border-slate-400 my-1" />

              {/* b. META TRANSAKSI */}
              <div className="text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>No. Struk</span>
                  <span className="font-bold">{receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal</span>
                  <span>{date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir</span>
                  <span>{cashierName}</span>
                </div>
                {customerName && (
                  <div className="flex justify-between">
                    <span>Pelanggan/Tim</span>
                    <span className="font-bold truncate max-w-[170px] text-right">{customerName}</span>
                  </div>
                )}
              </div>

              {/* Garis Putus-putus */}
              <div className="border-b border-dashed border-slate-400 my-1" />

              {/* c. DAFTAR ITEMS */}
              <div className="space-y-1.5 py-0.5">
                {items.length === 0 ? (
                  <div className="flex justify-between text-[11px]">
                    <span>Item Transaksi</span>
                    <span className="font-bold">{formatRupiah(total)}</span>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-bold text-[11px] text-slate-900 leading-snug">
                        {item.name}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-700 pl-1">
                        <span>
                          {item.qty || 1} x {formatRupiah(item.price || item.subtotal || total)}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatRupiah(item.subtotal || (item.qty ? item.qty * item.price : total))}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Garis Putus-putus */}
              <div className="border-b border-dashed border-slate-400 my-1" />

              {/* d. TOTAL & PEMBAYARAN */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between font-black text-sm pt-0.5">
                  <span>TOTAL</span>
                  <span>{formatRupiah(total)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Metode Bayar</span>
                  <span className="font-bold uppercase">{paymentMethod}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Dibayar</span>
                  <span>{formatRupiah(amountPaid || total)}</span>
                </div>
                {Number(change) > 0 && (
                  <div className="flex justify-between text-[10px]">
                    <span>Kembali</span>
                    <span>{formatRupiah(change)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] items-center pt-0.5">
                  <span>Status</span>
                  <span className="font-black px-1.5 py-0.5 bg-slate-900 text-white rounded text-[9px] tracking-wider">
                    {status}
                  </span>
                </div>
              </div>

              {notes && (
                <>
                  <div className="border-b border-dashed border-slate-400 my-1" />
                  <div className="text-[10px] text-slate-600 italic">
                    Catatan: {notes}
                  </div>
                </>
              )}

              {/* Garis Putus-putus */}
              <div className="border-b border-dashed border-slate-400 my-1" />

              {/* e. FOOTER */}
              <div className="text-center text-[10px] space-y-1 text-slate-700 pt-1">
                {receiptFooterNote ? (
                  <div className="whitespace-pre-line font-medium text-slate-800 leading-snug">
                    {receiptFooterNote}
                  </div>
                ) : (
                  <>
                    <div className="font-bold">*** TERIMA KASIH ***</div>
                    <div>Selamat Bertanding &amp; Junjung Sportivitas</div>
                    <div className="text-[9px] text-slate-500 leading-tight">
                      Barang / layanan yang sudah dibayar tidak dapat ditukar atau dikembalikan
                    </div>
                  </>
                )}
                <div className="text-[8px] text-slate-400 pt-1">
                  Chua Sport Core OS &bull; POS &amp; Arena System
                </div>
              </div>

            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400">
            Tip: Atur ukuran kertas ke <strong>58mm</strong> atau <strong>80mm</strong> pada printer thermal kasir Anda.
          </div>

        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
