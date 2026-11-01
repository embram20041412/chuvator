import React from 'react';

/**
 * PosThermalReceipt
 * Komponen struk thermal kasir (POS) 58mm / 80mm.
 * Didesain khusus untuk layout hitam-putih, font monospaced, tanpa margin boros.
 *
 * Props:
 * - transaction: { date, time, receiptNo, cashierName, customerName, items: [{ name, qty, price }], totalAmount, paymentMethod, cashReceived, changeAmount }
 * - arena: { name, address, phone }
 */
const PosThermalReceipt = React.forwardRef(({ transaction, arena }, ref) => {
  const items = transaction?.items || [];
  const isCash = 
    transaction?.paymentMethod?.toLowerCase().includes('tunai') || 
    transaction?.paymentMethod?.toLowerCase().includes('cash');

  return (
    <div 
      ref={ref} 
      id="print-receipt-area"
      className="bg-white text-black p-4 w-[80mm] mx-auto font-mono text-[12px] leading-tight print:w-[58mm] print:p-0 print:m-0"
    >
      {/* KOP STRUK */}
      <div className="text-center mb-3">
        <h2 className="font-bold text-[16px] uppercase tracking-wide">
          {arena?.name || "KEDIRI SPORT ARENA"}
        </h2>
        <p className="text-[10px] whitespace-pre-wrap mt-0.5">
          {arena?.address || "Jl. Letjen Soetoyo No. 20, Wates, Kediri"}
        </p>
        <p className="text-[10px]">
          Telp: {arena?.phone || "082131447972"}
        </p>
      </div>

      <div className="border-t border-black border-dashed my-2" />

      {/* INFO TRANSAKSI */}
      <div className="flex justify-between text-[11px] mb-1">
        <span>Tgl: {transaction?.date || new Date().toLocaleDateString('id-ID')}</span>
        <span>Waktu: {transaction?.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="flex justify-between text-[11px] mb-1">
        <span>No: {transaction?.receiptNo || `POS-${Math.floor(Date.now() / 1000)}`}</span>
        <span>Kasir: {transaction?.cashierName || "Kasir"}</span>
      </div>
      {transaction?.customerName && (
        <div className="text-[11px] mb-1">
          Pelanggan: <span className="font-bold">{transaction.customerName}</span>
        </div>
      )}

      <div className="border-t border-black border-dashed my-2" />

      {/* DAFTAR ITEM KASIR */}
      <div className="space-y-2 mb-2">
        {items.length === 0 ? (
          <div className="text-center text-[10px] italic py-1">Tidak ada item belanja</div>
        ) : (
          items.map((item, idx) => {
            const qty = Number(item.qty || 1);
            const price = Number(item.price || 0);
            const subtotal = qty * price;
            return (
              <div key={item.id || idx} className="text-[11px]">
                <div className="font-bold text-[12px] truncate">{item.name}</div>
                <div className="flex justify-between pl-1">
                  <span>
                    {qty} x Rp {price.toLocaleString('id-ID')}
                  </span>
                  <span className="font-semibold">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-black border-dashed my-2" />

      {/* TOTAL & METODE PEMBAYARAN */}
      <div className="space-y-1 my-1">
        <div className="flex justify-between font-bold text-[14px]">
          <span>TOTAL</span>
          <span>Rp {Number(transaction?.totalAmount || 0).toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between text-[11px] pt-1">
          <span>Metode Bayar:</span>
          <span className="font-semibold uppercase">{transaction?.paymentMethod || "Tunai"}</span>
        </div>

        {isCash && (
          <>
            <div className="flex justify-between text-[11px]">
              <span>Uang Diterima:</span>
              <span>Rp {Number(transaction?.cashReceived || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-[11px] font-bold">
              <span>Kembalian:</span>
              <span>Rp {Number(transaction?.changeAmount || 0).toLocaleString('id-ID')}</span>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-black border-dashed my-2" />

      {/* FOOTER */}
      <div className="text-center mt-3 text-[10px] space-y-0.5">
        <p>Terima kasih atas kunjungan Anda!</p>
        <p>Barang/Jasa yang dibeli tidak dapat di-refund.</p>
        <p className="mt-2 font-bold tracking-wider">CHUA SPORT CORE</p>
      </div>
    </div>
  );
});

export default PosThermalReceipt;
