import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  CreditCard, 
  Banknote, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  Calculator, 
  Receipt,
  User,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Copy,
  Check
} from 'lucide-react';

export default function PosCheckoutModal({
  isOpen,
  onClose,
  cart = [],
  totalAmount = 0,
  paymentMethod = 'Tunai (Cash)',
  setPaymentMethod,
  cashierName = 'Kasir',
  arena = {},
  onConfirmPayment,
  isProcessing = false
}) {
  const [selectedMethod, setSelectedMethod] = useState(paymentMethod || 'Tunai (Cash)');
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [validationError, setValidationError] = useState('');

  // Sync external method if changed
  useEffect(() => {
    if (paymentMethod) {
      setSelectedMethod(paymentMethod);
    }
  }, [paymentMethod]);

  // Reset inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setCashReceivedInput('');
      setCustomerName('');
      setValidationError('');
    }
  }, [isOpen]);

  const isCash = useMemo(() => {
    const lower = selectedMethod.toLowerCase();
    return lower === 'tunai (cash)' || lower.includes('tunai') || lower.includes('cash');
  }, [selectedMethod]);

  const isQris = useMemo(() => {
    const lower = selectedMethod.toLowerCase();
    return lower === 'qris' || (lower.includes('qris') && !lower.includes('transfer'));
  }, [selectedMethod]);

  const isTransfer = useMemo(() => {
    const lower = selectedMethod.toLowerCase();
    return lower === 'transfer bank' || lower.includes('transfer');
  }, [selectedMethod]);

  const cashNum = Number(cashReceivedInput) || 0;
  const changeAmount = cashNum - totalAmount;
  const isCashSufficient = !isCash || (isCash && cashNum >= totalAmount);

  // Quick preset buttons for cash
  const quickPresets = useMemo(() => {
    if (totalAmount <= 0) return [];
    const presets = new Set();
    presets.add(totalAmount); // Uang Pas

    // Next 10.000 / 50.000 / 100.000
    const denominations = [10000, 20000, 50000, 100000, 200000, 500000];
    for (const denom of denominations) {
      if (denom >= totalAmount) {
        presets.add(denom);
      }
    }

    // Add rounded up to next 10.000 or 50.000 if not included
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
    if (!arena) return [];
    const accounts = [];
    if (Array.isArray(arena.bankAccounts) && arena.bankAccounts.length > 0) {
      arena.bankAccounts.forEach((acc) => {
        const bankName = String(acc?.bankName || '').trim();
        const accountNumber = String(acc?.accountNumber || '').trim();
        const accountName = String(acc?.accountName || acc?.accountHolder || '').trim();
        if (bankName || accountNumber) {
          accounts.push({
            bankName: bankName || 'Bank',
            accountNumber: accountNumber || '-',
            accountName: accountName || arena.name || 'GOR Arena'
          });
        }
      });
    } else if (arena.bankName || arena.bankAccountNumber) {
      accounts.push({
        bankName: String(arena.bankName || 'Bank').trim(),
        accountNumber: String(arena.bankAccountNumber || '-').trim(),
        accountName: String(arena.bankAccountName || arena.bankAccountHolder || arena.name || 'GOR Arena').trim()
      });
    }
    return accounts;
  }, [arena]);

  if (!isOpen) return null;

  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    if (setPaymentMethod) {
      setPaymentMethod(method);
    }
    setValidationError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isCash && cashNum < totalAmount) {
      setValidationError(`Uang diterima kurang Rp ${(totalAmount - cashNum).toLocaleString('id-ID')}`);
      return;
    }

    if (onConfirmPayment) {
      await onConfirmPayment({
        paymentMethod: selectedMethod,
        cashReceived: isCash ? cashNum : totalAmount,
        changeAmount: isCash ? Math.max(0, changeAmount) : 0,
        customerName: customerName.trim() || 'Pelanggan Umum'
      });
    }
  };

  const qrisImage = arena?.qrisImageBase64 || arena?.qrisUrl || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-category">
      <div className="bg-white dark:bg-[#162320] w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 flex flex-col my-auto max-h-[92vh] overflow-hidden">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/10 bg-[#354944]/5 dark:bg-white/5 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#354944] text-[#C89D32] flex items-center justify-center shadow-xs">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                Konfirmasi Pembayaran Kasir
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kasir: <strong className="text-slate-700 dark:text-slate-300">{cashierName}</strong> &bull; {cart.length} item
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY (SCROLLABLE) */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* TOTAL BANNER */}
          <div className="p-3.5 bg-gradient-to-r from-[#354944] to-[#2B3D38] rounded-xl text-white shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C89D32]">
                Total Tagihan Belanja
              </span>
              <p className="text-[11px] text-slate-200">
                {cart.reduce((a, b) => a + Number(b.qty || 1), 0)} unit barang di keranjang
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl sm:text-2xl font-black font-mono text-[#F4D068] tracking-tight">
                Rp {Number(totalAmount).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* RINGKASAN ITEM (COMPACT ACCORDION / LIST) */}
          <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200/80 dark:border-white/5 space-y-1.5 max-h-32 overflow-y-auto text-xs">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              <span>Item ({cart.length})</span>
              <span>Subtotal</span>
            </div>
            <div className="divide-y divide-slate-200/60 dark:divide-white/5">
              {cart.map((item, idx) => (
                <div key={item.id || idx} className="py-1 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                      x{item.qty} (@ Rp {Number(item.price).toLocaleString('id-ID')})
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    Rp {(Number(item.qty || 1) * Number(item.price || 0)).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* INPUT NAMA PELANGGAN (OPSIONAL) */}
          <div>
            <label htmlFor="pos-customer-name" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Nama Pelanggan (Opsional)
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                id="pos-customer-name"
                name="customerName"
                type="text"
                autoComplete="name"
                placeholder="Pelanggan Umum / Member"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={isProcessing}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#354944] dark:focus:border-[#C89D32]"
              />
            </div>
          </div>

          {/* PILIHAN 3 METODE PEMBAYARAN: CASH, QRIS, TRANSFER BANK */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1.5">
              Pilih Metode Pembayaran
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectMethod('Tunai (Cash)')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isCash 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold ring-1 ring-emerald-500' 
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px]">Tunai (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('QRIS')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isQris 
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-800 dark:text-purple-300 font-bold ring-1 ring-purple-500' 
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-[11px]">QRIS</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('Transfer Bank')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isTransfer 
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-800 dark:text-blue-300 font-bold ring-1 ring-blue-500' 
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-[11px]">Transfer Bank</span>
              </button>
            </div>
          </div>

          {/* DETAIL PER METODE PEMBAYARAN */}
          {isCash && (
            <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
              <div>
                <label htmlFor="pos-cash-received" className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">
                  Uang Diterima dari Pelanggan (Rp) <span className="text-[#C89D32]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                  <input
                    id="pos-cash-received"
                    name="cashReceived"
                    type="number"
                    min="0"
                    placeholder="Masukkan jumlah uang"
                    value={cashReceivedInput}
                    onChange={(e) => {
                      setCashReceivedInput(e.target.value);
                      setValidationError('');
                    }}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#14211E] border border-slate-300 dark:border-white/10 rounded-lg font-mono font-bold text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* QUICK CASH PRESET BUTTONS */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Pecahan Cepat:</span>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setCashReceivedInput(String(preset));
                        setValidationError('');
                      }}
                      className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border transition-all cursor-pointer ${
                        cashNum === preset
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset === totalAmount ? 'Uang Pas' : `Rp ${preset.toLocaleString('id-ID')}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* KALKULASI KEMBALIAN */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-white/10">
                {cashReceivedInput && cashNum < totalAmount ? (
                  <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 text-xs font-semibold p-2 bg-rose-50 dark:bg-rose-950/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Uang masih kurang Rp {(totalAmount - cashNum).toLocaleString('id-ID')}</span>
                  </div>
                ) : cashReceivedInput && cashNum >= totalAmount ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
                        Kembalian:
                      </span>
                    </div>
                    <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
                      Rp {changeAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center italic">
                    Ketik nominal uang atau pilih pecahan cepat di atas.
                  </p>
                )}
              </div>
            </div>
          )}

          {isQris && (
            <div className="p-4 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200">
                  Pembayaran QRIS Instan
                </h4>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-0.5">
                  Tunjukkan barcode QRIS arena kepada pelanggan.
                </p>
              </div>

              {qrisImage ? (
                <div className="inline-block p-2 bg-white rounded-xl shadow-xs border">
                  <img src={qrisImage} alt="QRIS Arena" className="w-36 h-36 object-contain mx-auto" />
                </div>
              ) : (
                <div className="p-3 bg-white dark:bg-[#14211E] rounded-xl border border-dashed border-purple-200 dark:border-purple-800/50 text-center text-xs space-y-1">
                  <p className="font-bold text-purple-900 dark:text-purple-300">QRIS belum diunggah</p>
                  <p className="text-[10px] text-slate-500">Unggah barcode QRIS melalui menu Pengaturan &gt; Rekening &amp; QRIS.</p>
                </div>
              )}
            </div>
          )}

          {isTransfer && (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/40 space-y-2 text-xs">
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
                      className="bg-white dark:bg-[#14211E] p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1 text-left shadow-2xs"
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
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* FOOTER ACTION BUTTONS */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isCashSufficient || isProcessing || (isCash && !cashReceivedInput)}
            className="px-5 py-2.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border-transparent disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-2"
          >
            {isProcessing ? (
              <span>Memproses Pembayaran...</span>
            ) : (
              <>
                <span>Konfirmasi &amp; Lanjut Struk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
