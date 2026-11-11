import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Calculator, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Receipt,
  Copy,
  Check
} from 'lucide-react';

export default function MobilePosCartSheet({
  isOpen,
  onClose,
  cart = [],
  totalAmount = 0,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  cashierName = 'Kasir',
  arenaData = {},
  onConfirmCheckout,
  isSubmitting = false
}) {
  const [paymentMethod, setPaymentMethod] = useState('Tunai (Cash)');
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('Tunai (Cash)');
      setCashReceivedInput('');
      setCustomerName('');
      setValidationError('');
    }
  }, [isOpen]);

  const isCash = useMemo(() => {
    const lower = paymentMethod.toLowerCase();
    return lower === 'tunai (cash)' || lower.includes('tunai') || lower.includes('cash');
  }, [paymentMethod]);

  const isQris = useMemo(() => {
    const lower = paymentMethod.toLowerCase();
    return lower === 'qris' || (lower.includes('qris') && !lower.includes('transfer'));
  }, [paymentMethod]);

  const isTransfer = useMemo(() => {
    const lower = paymentMethod.toLowerCase();
    return lower === 'transfer bank' || lower.includes('transfer');
  }, [paymentMethod]);

  const cashNum = Number(cashReceivedInput) || 0;
  const changeAmount = cashNum - totalAmount;
  const isCashSufficient = !isCash || (isCash && cashNum >= totalAmount);

  // Quick preset cash denomination buttons
  const quickPresets = useMemo(() => {
    if (totalAmount <= 0) return [];
    const presets = new Set();
    presets.add(totalAmount); // Uang Pas

    const denominations = [10000, 20000, 50000, 100000, 200000, 500000];
    for (const denom of denominations) {
      if (denom >= totalAmount) {
        presets.add(denom);
      }
    }

    const next10k = Math.ceil(totalAmount / 10000) * 10000;
    const next50k = Math.ceil(totalAmount / 50000) * 50000;
    if (next10k > totalAmount) presets.add(next10k);
    if (next50k > totalAmount) presets.add(next50k);

    return Array.from(presets).sort((a, b) => a - b).slice(0, 5);
  }, [totalAmount]);

  const [copiedBankIdx, setCopiedBankIdx] = useState(null);

  const handleCopyBank = (text, idx) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedBankIdx(idx);
      setTimeout(() => setCopiedBankIdx(null), 2000);
    } catch {
      setCopiedBankIdx(idx);
      setTimeout(() => setCopiedBankIdx(null), 2000);
    }
  };

  // Extract all valid, active bank accounts configured by tenant
  const activeBankAccounts = useMemo(() => {
    if (!arenaData) return [];
    const accounts = [];
    if (Array.isArray(arenaData.bankAccounts) && arenaData.bankAccounts.length > 0) {
      arenaData.bankAccounts.forEach((acc) => {
        const bankName = String(acc?.bankName || '').trim();
        const accountNumber = String(acc?.accountNumber || '').trim();
        const accountName = String(acc?.accountName || acc?.accountHolder || '').trim();
        if (bankName || accountNumber) {
          accounts.push({
            bankName: bankName || 'Bank',
            accountNumber: accountNumber || '-',
            accountName: accountName || arenaData.name || 'GOR Arena'
          });
        }
      });
    } else if (arenaData.bankName || arenaData.bankAccountNumber) {
      accounts.push({
        bankName: String(arenaData.bankName || 'Bank').trim(),
        accountNumber: String(arenaData.bankAccountNumber || '-').trim(),
        accountName: String(arenaData.bankAccountName || arenaData.bankAccountHolder || arenaData.name || 'GOR Arena').trim()
      });
    }
    return accounts;
  }, [arenaData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (isCash && cashNum < totalAmount) {
      setValidationError(`Uang diterima kurang Rp ${(totalAmount - cashNum).toLocaleString('id-ID')}`);
      return;
    }

    if (onConfirmCheckout) {
      onConfirmCheckout({
        paymentMethod,
        cashReceived: isCash ? cashNum : totalAmount,
        changeAmount: isCash ? Math.max(0, changeAmount) : 0,
        customerName: customerName.trim() || 'Pelanggan Umum'
      });
    }
  };

  const qrisImage = arenaData?.qrisImageBase64 || arenaData?.qrisUrl || '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden my-0 sm:my-auto max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in slide-in-from-bottom duration-250">
        
        {/* Handle Bar */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#354944] text-[#C89D32] flex items-center justify-center font-bold">
              🛒
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Keranjang Kasir ({cart.length} Item)
              </h2>
              <p className="text-[11px] text-slate-500">Petugas: {cashierName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sheet Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">

          {/* TOTAL BANNER */}
          <div className="p-4 bg-gradient-to-br from-[#354944] to-[#253632] rounded-2xl text-white shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C89D32] block">
                Total Tagihan POS
              </span>
              <span className="text-xs text-slate-300">
                {cart.reduce((a, b) => a + Number(b.qty || 1), 0)} unit item dipilih
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-[#F4D068]">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* CART ITEMS LIST */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              <span>Rincian Item</span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-rose-500 hover:underline cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Keranjang masih kosong. Pilih produk dari katalog.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">
                        @ Rp {Number(item.price).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.type === 'spp' || item.type === 'registration' ? (
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                          1x
                        </span>
                      ) : (
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, -1)}
                            className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, 1)}
                            className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CUSTOMER NAME (OPTIONAL) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nama Pelanggan (Opsional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Pelanggan Umum / Member GOR"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
              />
            </div>
          </div>

          {/* PAYMENT METHOD SELECTOR */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Metode Pembayaran <span className="text-[#C89D32]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('Tunai (Cash)')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isCash
                    ? 'bg-[#354944]/10 border-[#354944] text-[#354944] dark:text-[#C89D32] font-bold shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-bold">Tunai (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('QRIS')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isQris
                    ? 'bg-[#354944]/10 border-[#354944] text-[#354944] dark:text-[#C89D32] font-bold shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4 text-purple-600" />
                <span className="text-[10px] font-bold">QRIS</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Transfer Bank')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isTransfer
                    ? 'bg-[#354944]/10 border-[#354944] text-[#354944] dark:text-[#C89D32] font-bold shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-bold">Transfer Bank</span>
              </button>
            </div>
          </div>

          {/* CASH CALCULATOR */}
          {isCash && (
            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Uang Diterima (Rp) <span className="text-[#C89D32]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ketik nominal uang..."
                  value={cashReceivedInput}
                  onChange={(e) => {
                    setCashReceivedInput(e.target.value);
                    setValidationError('');
                  }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* QUICK CASH PRESET PILLS */}
              <div className="flex flex-wrap gap-1.5">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCashReceivedInput(String(preset));
                      setValidationError('');
                    }}
                    className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      cashNum === preset
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {preset === totalAmount ? 'Uang Pas' : `Rp ${preset.toLocaleString('id-ID')}`}
                  </button>
                ))}
              </div>

              {/* CHANGE OUTPUT */}
              {cashReceivedInput !== '' && (
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/40">
                  {kembalianCalc(cashNum, totalAmount)}
                </div>
              )}
            </div>
          )}

          {isQris && (
            <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-2xl text-center space-y-2">
              <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                Scan QRIS Instan
              </p>
              {qrisImage ? (
                <img src={qrisImage} alt="QRIS Arena" className="w-32 h-32 object-contain mx-auto bg-white p-1 rounded-xl shadow-2xs" />
              ) : (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-purple-200 dark:border-purple-800/50 text-center text-xs space-y-1">
                  <p className="font-bold text-purple-900 dark:text-purple-300">QRIS belum diunggah</p>
                  <p className="text-[10px] text-slate-500">Unggah barcode QRIS melalui menu Pengaturan &gt; Rekening &amp; QRIS.</p>
                </div>
              )}
            </div>
          )}

          {isTransfer && (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200 font-bold">
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Informasi Rekening Transfer Bank:</span>
                </div>
                {activeBankAccounts.length > 0 && (
                  <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    {activeBankAccounts.length} Rekening
                  </span>
                )}
              </div>

              {activeBankAccounts.length === 0 ? (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 text-center space-y-1">
                  <p className="font-bold text-amber-800 dark:text-amber-400 text-xs">
                    Rekening bank belum dikonfigurasi
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Atur nama bank dan nomor rekening pada menu Pengaturan &gt; Rekening &amp; QRIS.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeBankAccounts.map((acc, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1 text-left shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-xs">
                          {acc.bankName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBank(acc.accountNumber, idx)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Salin nomor rekening"
                        >
                          {copiedBankIdx === idx ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5">
                        <span className="font-mono font-black text-blue-700 dark:text-blue-300 text-sm tracking-wider select-all break-all">
                          {acc.accountNumber}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          a.n. <strong className="text-slate-800 dark:text-slate-200 font-semibold">{acc.accountName}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {validationError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-bold flex items-center gap-1.5 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || cart.length === 0 || !isCashSufficient}
            className="flex-1 py-3 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Memproses...' : 'Konfirmasi & Bayar'}</span>
            <ArrowRight className="w-4 h-4 text-[#C89D32]" />
          </button>
        </div>

      </div>
    </div>
  );
}

function kembalianCalc(cashNum, totalAmount) {
  const diff = cashNum - totalAmount;
  if (diff < 0) {
    return (
      <p className="text-xs font-bold text-red-600 dark:text-red-400">
        Uang kurang: Rp {Math.abs(diff).toLocaleString('id-ID')}
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase">Kembalian:</span>
      <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
        Rp {diff.toLocaleString('id-ID')}
      </span>
    </div>
  );
}
