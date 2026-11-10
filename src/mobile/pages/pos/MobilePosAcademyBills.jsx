import React from 'react';
import { 
  GraduationCap, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  User, 
  Phone,
  Inbox
} from 'lucide-react';

export default function MobilePosAcademyBills({
  bills = [],
  cart = [],
  searchQuery,
  onSearchChange,
  onAddToCart,
  isLoading
}) {
  const filteredBills = bills.filter((bill) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (bill.name || '').toLowerCase().includes(q) ||
      (bill.studentName || '').toLowerCase().includes(q) ||
      (bill.className || '').toLowerCase().includes(q) ||
      (bill.parentName || '').toLowerCase().includes(q) ||
      (bill.parentPhone || '').toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center space-y-2">
        <div className="w-7 h-7 border-3 border-[#354944] border-t-[#C89D32] rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500">Memuat tagihan SPP &amp; pendaftaran siswa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      
      {/* SEARCH BAR */}
      <div className="bg-white dark:bg-[#14211E] p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nama siswa, kelompok kelas, atau HP wali..."
            className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
          />
        </div>
      </div>

      {/* BILLS LIST */}
      {filteredBills.length === 0 ? (
        <div className="bg-white dark:bg-[#14211E] p-8 rounded-2xl text-center border border-slate-200/80 dark:border-white/10 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300">
            Tidak ada tagihan menunggak.
          </h3>
          <p className="text-[11px] text-slate-400">
            Semua siswa akademi telah menyelesaikan kewajiban pembayaran SPP &amp; Pendaftaran.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredBills.map((bill) => {
            const isAdded = cart.some((c) => c.id === bill.id);
            const isRegistration = bill.type === 'registration';

            return (
              <div
                key={bill.id}
                onClick={() => !isAdded && onAddToCart(bill)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs select-none ${
                  isAdded
                    ? 'bg-[#354944]/10 dark:bg-white/10 border-[#354944] dark:border-[#C89D32] ring-2 ring-[#354944]/20'
                    : 'bg-white dark:bg-[#14211E] border-slate-200/80 dark:border-white/10 hover:border-[#354944]/40 active:scale-95'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                    isRegistration
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                  }`}>
                    {isRegistration ? '📋' : '🎓'}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {bill.studentName || bill.name}
                      </h4>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                        isRegistration 
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200' 
                          : 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200'
                      }`}>
                        {isRegistration ? 'Pendaftaran' : 'SPP'}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                      {bill.className ? `Kelas: ${bill.className}` : bill.name} {bill.month ? `(${bill.month})` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1 pl-2">
                  <span className="text-xs font-black font-mono text-slate-900 dark:text-slate-100 block">
                    Rp {Number(bill.price || 0).toLocaleString('id-ID')}
                  </span>

                  <button
                    type="button"
                    disabled={isAdded}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-xl transition-all ${
                      isAdded
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-default'
                        : 'bg-[#354944] text-white hover:bg-[#2B3D38]'
                    }`}
                  >
                    {isAdded ? 'Sudah di Keranjang' : '+ Tambah'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
