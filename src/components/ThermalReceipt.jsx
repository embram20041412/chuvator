import React from 'react';

// Komponen ini menerima props data transaksi & profil arena
const ThermalReceipt = React.forwardRef(({ transaction, arena }, ref) => {
  return (
    <div ref={ref} className="bg-white text-black p-4 w-[80mm] mx-auto font-mono text-[12px] leading-tight print:w-[58mm] print:p-0 print:m-0">
      
      {/* KOP STRUK */}
      <div className="text-center mb-3">
        <h2 className="font-bold text-[16px] uppercase">{arena?.name || "KEDIRI SPORT ARENA"}</h2>
        <p className="text-[10px] whitespace-pre-wrap">{arena?.address || "Jl. Letjen Soetoyo No. 20, Wates, Kediri"}</p>
        <p className="text-[10px]">Telp: {arena?.phone || "082131447972"}</p>
      </div>

      <div className="border-t border-black border-dashed my-2" />

      {/* INFO TRANSAKSI */}
      <div className="flex justify-between text-[11px] mb-1">
        <span>Tgl: {transaction?.date || new Date().toLocaleDateString('id-ID')}</span>
        <span>Waktu: {transaction?.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="flex justify-between text-[11px] mb-1">
        <span>No: {transaction?.receiptNo || `TRX-${Math.floor(Date.now() / 1000)}`}</span>
        <span>Kasir: {transaction?.cashierName || "Admin"}</span>
      </div>
      <div className="text-[11px] mb-2">
        Pemesan: <span className="font-bold">{transaction?.customerName || "Member"}</span>
      </div>

      <div className="border-t border-black border-dashed my-2" />

      {/* DETAIL ITEM */}
      <div className="mb-2">
        <div className="font-bold text-[12px] uppercase mb-1">{transaction?.itemName || "Sewa Lapangan"}</div>
        <div className="flex justify-between text-[11px]">
          <span>{transaction?.schedule || "Jadwal"}</span>
          <span>Rp {transaction?.amount?.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="border-t border-black border-dashed my-2" />

      {/* TOTAL & METODE */}
      <div className="flex justify-between font-bold text-[14px] my-1">
        <span>TOTAL</span>
        <span>Rp {transaction?.amount?.toLocaleString('id-ID')}</span>
      </div>
      <div className="flex justify-between text-[11px] mb-2">
        <span>Metode Bayar:</span>
        <span className="uppercase">{transaction?.paymentMethod || "QRIS"}</span>
      </div>

      <div className="border-t border-black border-dashed my-2" />

      {/* FOOTER */}
      <div className="text-center mt-3 text-[10px]">
        <p>Terima kasih atas kunjungan Anda!</p>
        <p>Barang/Jasa yang dibeli tidak dapat di-refund.</p>
        <p className="mt-2 font-bold">CHUA SPORT CORE</p>
      </div>
    </div>
  );
});

export default ThermalReceipt;
