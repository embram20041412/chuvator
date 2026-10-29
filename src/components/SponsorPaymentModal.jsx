import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import useArenaData from '../hooks/useArenaData';
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  Calendar,
  FileText,
  Clock,
  ArrowRight,
  TrendingUp,
  Receipt,
  Landmark,
  FileCheck2,
  AlertTriangle
} from 'lucide-react';
import { DanaSponsor3DIcon } from './icons/App3DIcons';
import { generateSponsorInvoice } from '../utils/invoiceGenerator';

function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

export default function SponsorPaymentModal({
  isOpen,
  onClose,
  sponsor,
  tenantId,
  tenantProfile,
  userProfile,
  onPaymentSuccess
}) {
  const arenaData = useArenaData(userProfile);
  const activeTenantProfile = tenantProfile || arenaData?.tenantProfile || userProfile?.tenant;

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // STATE KHUSUS CEK / BILYET GIRO (FASE 12 PART 2)
  const [giroDetails, setGiroDetails] = useState({
    giroNumber: '',
    bankIssuer: '',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // default +7 hari
  });

  const contractValue = Number(sponsor?.contractValue || 0);
  const currentTotalPaid = Number(sponsor?.totalPaid || 0);
  const currentPendingAmount = Number(sponsor?.pendingAmount || 0);
  const remainingBalance = Math.max(0, contractValue - currentTotalPaid);
  const paymentPercentage = contractValue > 0
    ? Math.min(100, Math.round((currentTotalPaid / contractValue) * 100))
    : 0;

  // =====================================================================
  // 1. REKENING BANK TENANT DINAMIS & METODE PEMBAYARAN (INTRUKSI 1)
  // =====================================================================
  const bankAccounts = useMemo(() => {
    if (Array.isArray(activeTenantProfile?.bankAccounts) && activeTenantProfile.bankAccounts.length > 0) {
      return activeTenantProfile.bankAccounts.filter((b) => b.bankName && b.accountNumber);
    }
    if (activeTenantProfile?.bankAccountNumber) {
      return [{
        bankName: activeTenantProfile.bankName || 'BCA',
        accountNumber: activeTenantProfile.bankAccountNumber,
        accountName: activeTenantProfile.bankAccountName || activeTenantProfile.name || 'Arena Sports'
      }];
    }
    return [
      { bankName: 'BCA', accountNumber: '12345678', accountName: activeTenantProfile?.name || 'CHUA SPORT' }
    ];
  }, [activeTenantProfile]);

  const paymentOptions = useMemo(() => {
    const options = [];

    // Opsi 1: Rekening-rekening Bank Resmi Tenant
    bankAccounts.forEach((acc) => {
      const fullLabel = `Transfer Bank ${acc.bankName} - ${acc.accountNumber} a.n ${acc.accountName || activeTenantProfile?.name || 'Arena'}`;
      options.push({
        id: `bank_${acc.accountNumber}`,
        group: 'Rekening Resmi GOR',
        label: fullLabel,
        value: fullLabel
      });
    });

    // Opsi 2: Default Standar
    options.push({
      id: 'cash',
      group: 'Tunai & Digital',
      label: 'Tunai (Cash)',
      value: 'Tunai (Cash)'
    });
    options.push({
      id: 'qris',
      group: 'Tunai & Digital',
      label: 'QRIS (Statis / Dinamis)',
      value: 'QRIS'
    });
    options.push({
      id: 'giro',
      group: 'Instrumen B2B',
      label: 'Cek / Bilyet Giro',
      value: 'Cek / Bilyet Giro'
    });

    return options;
  }, [bankAccounts, activeTenantProfile]);

  // Cek apakah metode yang dipilih adalah Cek / Bilyet Giro
  const isGiro = paymentMethod === 'Cek / Bilyet Giro';

  // Preset default saat modal dibuka
  useEffect(() => {
    if (sponsor) {
      setErrorMsg(null);
      setSuccessNotice(null);
      setPaymentAmount(remainingBalance > 0 ? String(remainingBalance) : '');
      const defaultNotes = currentTotalPaid === 0
        ? 'DP Termin 1 Sponsorship'
        : remainingBalance <= 0
        ? 'Pelunasan Sponsorship'
        : `Pembayaran Termin ${(sponsor?.paymentHistory?.length || 0) + 1}`;
      setPaymentNotes(defaultNotes);

      // Inisialisasi default payment method ke rekening pertama
      if (paymentOptions.length > 0 && !paymentMethod) {
        setPaymentMethod(paymentOptions[0].value);
      }

      // Reset invoiceDueDate form
      setInvoiceDueDate(sponsor?.invoiceDueDate || sponsor?.dueDate || '');

      // Reset giro form
      setGiroDetails({
        giroNumber: '',
        bankIssuer: '',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }
  }, [sponsor, remainingBalance, currentTotalPaid, paymentOptions]);

  if (!isOpen || !sponsor) return null;

  const handleApplyPreset = (value) => {
    setPaymentAmount(String(Math.min(value, remainingBalance > 0 ? remainingBalance : value)));
  };

  // =====================================================================
  // 2. SUBMIT PEMBAYARAN TERMIN DENGAN PENANGANAN GIRO (INTRUKSI 2 & 3)
  // =====================================================================
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericAmount = parseFloat(paymentAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Masukkan nominal pembayaran yang valid (lebih dari 0).');
      return;
    }

    const activeTenantId = tenantId || activeTenantProfile?.id || userProfile?.tenantId || userProfile?.uid;
    if (!activeTenantId) {
      setErrorMsg('Tenant ID tidak valid. Mohon muat ulang halaman.');
      return;
    }

    // Validasi field conditional giro
    if (isGiro) {
      if (!giroDetails.giroNumber.trim()) {
        setErrorMsg('Nomor Cek / Bilyet Giro wajib diisi.');
        return;
      }
      if (!giroDetails.bankIssuer.trim()) {
        setErrorMsg('Bank Penerbit Cek / Giro wajib diisi.');
        return;
      }
      if (!giroDetails.dueDate) {
        setErrorMsg('Tanggal Jatuh Tempo / Kliring Cek / Giro wajib ditentukan.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Tentukan transactionStatus (Instruksi 3)
      const transactionStatus = isGiro ? 'pending_clearing' : 'success';

      const paymentRecordId = `pay_${Date.now()}`;
      const newPaymentRecord = {
        id: paymentRecordId,
        amount: numericAmount,
        paymentMethod: paymentMethod,
        paymentDetails: paymentMethod, // Detail lengkap rekening/giro/cash
        status: transactionStatus,
        giroData: isGiro ? {
          giroNumber: giroDetails.giroNumber.trim(),
          bankIssuer: giroDetails.bankIssuer.trim(),
          dueDate: giroDetails.dueDate
        } : null,
        notes: paymentNotes.trim() || (isGiro ? 'Pembayaran Bilyet Giro (Menunggu Kliring)' : 'Pembayaran Termin Sponsorship'),
        paidAt: new Date().toISOString(),
        invoiceDueDate: invoiceDueDate || null,
        dueDate: isGiro ? giroDetails.dueDate : (invoiceDueDate || null),
        recordedBy: userProfile?.displayName || userProfile?.name || userProfile?.email || 'Admin GOR'
      };

      const updatedHistory = [
        ...(Array.isArray(sponsor.paymentHistory) ? sponsor.paymentHistory : []),
        newPaymentRecord
      ];

      // KRUSIAL (INTRUKSI 3):
      // Jumlahkan paymentAmount ke totalPaid HANYA JIKA statusnya bukan 'pending_clearing'
      let newTotalPaid = currentTotalPaid;
      let newPendingAmount = currentPendingAmount;
      let newPaymentStatus = sponsor.paymentStatus || 'Unpaid';

      if (transactionStatus === 'success') {
        newTotalPaid = currentTotalPaid + numericAmount;
        newPaymentStatus = newTotalPaid >= contractValue
          ? 'Paid'
          : newTotalPaid > 0
          ? 'Partial'
          : 'Unpaid';
      } else {
        // Status pending_clearing: simpan ke pendingAmount terpisah
        newPendingAmount = currentPendingAmount + numericAmount;
      }

      // Automasi Status CRM (Fase 12 Part 3)
      let newCrmStatus = 'Negosiasi';
      if (newTotalPaid >= contractValue && contractValue > 0) {
        newCrmStatus = 'Lunas';
      } else if (newTotalPaid > 0) {
        newCrmStatus = 'Deal';
      }

      // 1. UPDATE DATA SPONSOR DI SUPABASE
      const sponsorUpdatePayload = {
        total_paid: newTotalPaid,
        pending_amount: newPendingAmount,
        payment_status: newPaymentStatus,
        payment_history: updatedHistory,
        status: newCrmStatus,
        crm_status: newCrmStatus,
        updated_at: new Date().toISOString()
      };

      if (invoiceDueDate) {
        sponsorUpdatePayload.invoice_due_date = invoiceDueDate;
        sponsorUpdatePayload.due_date = invoiceDueDate;
      }

      await supabase.from('sponsors').update(sponsorUpdatePayload).eq('id', sponsor.id);

      // 2. INSERT TRANSAKSI BARU KE TABEL `transactions`
      const transactionPayload = {
        tenant_id: activeTenantId,
        type: 'sponsorship',
        category: 'Event & Sponsorship',
        title: isGiro
          ? `Bilyet Giro Sponsor - ${sponsor.companyName || sponsor.name || 'Mitra'}`
          : `Pembayaran Sponsor - ${sponsor.companyName || sponsor.name || 'Mitra'}`,
        amount: numericAmount,
        payment_method: paymentMethod,
        payment_details: paymentMethod,
        status: transactionStatus,
        giro_data: isGiro ? {
          giroNumber: giroDetails.giroNumber.trim(),
          bankIssuer: giroDetails.bankIssuer.trim(),
          dueDate: giroDetails.dueDate
        } : null,
        notes: paymentNotes.trim() || (isGiro ? 'Bilyet Giro Menunggu Kliring' : 'Pembayaran Termin B2B'),
        invoice_due_date: invoiceDueDate || null,
        sponsor_id: sponsor.id,
        sponsor_name: sponsor.companyName || sponsor.name || '',
        event_id: sponsor.eventId || '',
        event_name: sponsor.eventName || 'Sponsor Global',
        created_at: new Date().toISOString()
      };

      await supabase.from('transactions').insert([transactionPayload]);
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));

      if (isGiro) {
        setSuccessNotice(`Bilyet Giro ${formatRupiah(numericAmount)} berhasil dicatat dengan status Menunggu Kliring (Pending Clearing)!`);
      } else {
        setSuccessNotice(`Pembayaran ${formatRupiah(numericAmount)} berhasil dicatat & masuk ke Buku Kas Global!`);
      }

      if (onPaymentSuccess) {
        onPaymentSuccess({
          ...sponsor,
          totalPaid: newTotalPaid,
          pendingAmount: newPendingAmount,
          paymentStatus: newPaymentStatus,
          paymentHistory: updatedHistory,
          status: newCrmStatus,
          crmStatus: newCrmStatus,
          ...(invoiceDueDate ? { invoiceDueDate, dueDate: invoiceDueDate } : {})
        });
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Error recording sponsor payment:', err);
      handleFirestoreError(err, 'create', 'transactions');
      setErrorMsg('Gagal mencatat pembayaran sponsor. Silakan periksa koneksi dan coba lagi.');
      setIsSubmitting(false);
    }
  };

  // Helper Aksi Cepat: Cairkan / Kliringkan Giro dari Riwayat
  const handleClearGiroRecord = async (giroItem) => {
    if (!window.confirm(`Konfirmasi kliring/pencairan Giro ${giroItem?.giroData?.giroNumber || ''} senilai ${formatRupiah(giroItem.amount)}? Dana akan diakui sebagai Total Cair.`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const clearedAmount = Number(giroItem.amount || 0);
      const newTotalPaid = (Number(sponsor.totalPaid) || 0) + clearedAmount;
      const newPendingAmount = Math.max(0, (Number(sponsor.pendingAmount) || 0) - clearedAmount);
      const newPaymentStatus = newTotalPaid >= contractValue ? 'Paid' : 'Partial';

      const updatedHistory = (sponsor.paymentHistory || []).map((h) => {
        if (h.id === giroItem.id) {
          return {
            ...h,
            status: 'success',
            clearedAt: new Date().toISOString()
          };
        }
        return h;
      });

      // Automasi Status CRM saat kliring (Fase 12 Part 3)
      let newCrmStatus = 'Negosiasi';
      if (newTotalPaid >= contractValue && contractValue > 0) {
        newCrmStatus = 'Lunas';
      } else if (newTotalPaid > 0) {
        newCrmStatus = 'Deal';
      }

      const updatePayload = {
        total_paid: newTotalPaid,
        pending_amount: newPendingAmount,
        payment_status: newPaymentStatus,
        payment_history: updatedHistory,
        status: newCrmStatus,
        crm_status: newCrmStatus,
        updated_at: new Date().toISOString()
      };

      await supabase.from('sponsors').update(updatePayload).eq('id', sponsor.id);

      // Catat juga entri pencairan kas ke transactions
      const activeTenantId = tenantId || activeTenantProfile?.id || userProfile?.tenantId || userProfile?.uid;
      await supabase.from('transactions').insert([{
        tenant_id: activeTenantId,
        type: 'sponsorship',
        category: 'Event & Sponsorship',
        title: `Kliring Giro - ${sponsor.companyName || sponsor.name} (${giroItem?.giroData?.giroNumber || 'BG'})`,
        amount: clearedAmount,
        payment_method: `Kliring Giro ${giroItem?.giroData?.bankIssuer || ''}`,
        payment_details: `Cek/Giro No ${giroItem?.giroData?.giroNumber || ''} Telah Cair`,
        status: 'success',
        created_at: new Date().toISOString(),
        sponsor_id: sponsor.id,
        sponsor_name: sponsor.companyName || sponsor.name || '',
        event_id: sponsor.eventId || '',
        event_name: sponsor.eventName || 'Sponsor Global',
        notes: `Pencairan kliring giro tanggal ${new Date().toLocaleDateString('id-ID')}`
      }]);
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));

      setSuccessNotice(`Giro senilai ${formatRupiah(clearedAmount)} berhasil dicairkan! Total dana cair kini bertambah.`);

      if (onPaymentSuccess) {
        onPaymentSuccess({
          ...sponsor,
          totalPaid: newTotalPaid,
          pendingAmount: newPendingAmount,
          paymentStatus: newPaymentStatus,
          paymentHistory: updatedHistory,
          status: newCrmStatus,
          crmStatus: newCrmStatus
        });
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Error clearing giro record:', err);
      setErrorMsg('Gagal memproses kliring giro.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* HEADER MODAL (Sticky) */}
        <div className="bg-gradient-to-r from-[#354944] via-[#2B3D38] to-[#1E2C28] text-white p-5 sm:p-6 flex items-center justify-between relative overflow-hidden shrink-0 border-b-2 border-[#C89D32]">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center space-x-3.5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0 p-1.5">
              <DanaSponsor3DIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight">
                  Pencatatan Pembayaran Sponsor (B2B)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#C89D32] text-slate-900 border border-[#C89D32]/50 shadow-xs">
                  {sponsor.category || 'Sponsorship'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium truncate max-w-xs sm:max-w-md mt-0.5">
                {sponsor.companyName || sponsor.name} &bull; {sponsor.eventName || 'Sponsor Global'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitPayment} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* FINANCIAL SUMMARY SCORECARD */}
            <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                {/* Total Nilai Kontrak */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                    Nilai Kontrak
                  </span>
                  <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 block mt-0.5 truncate">
                    {formatRupiah(contractValue)}
                  </span>
                </div>

                {/* Sudah Terbayar (Cair) */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Sudah Cair
                  </span>
                  <span className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5 truncate">
                    {formatRupiah(currentTotalPaid)}
                  </span>
                </div>

                {/* Sisa Tagihan */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-rose-200 dark:border-rose-800 shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
                    Sisa Tagihan
                  </span>
                  <span className="font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400 block mt-0.5 truncate">
                    {formatRupiah(remainingBalance)}
                  </span>
                </div>
              </div>

              {/* Menunggu Kliring Giro (Jika Ada) */}
              {currentPendingAmount > 0 && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                    <span className="font-bold">Giro Menunggu Kliring:</span>
                  </div>
                  <span className="font-black text-amber-700 dark:text-amber-300">{formatRupiah(currentPendingAmount)}</span>
                </div>
              )}

              {/* Progress Bar Kontrak */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Status Pelunasan Kontrak</span>
                  <span className={paymentPercentage >= 100 ? 'text-emerald-600' : 'text-[#C89D32]'}>
                    {paymentPercentage}% ({remainingBalance === 0 ? 'LUNAS' : 'TERMIN AKTIF'})
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      paymentPercentage >= 100 ? 'bg-emerald-500' : 'bg-[#C89D32]'
                    }`}
                    style={{ width: `${paymentPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* FORM PENCATATAN TERMIN FIELDS */}
            <div className="p-5 sm:p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* INPUT NOMINAL PEMBAYARAN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nominal Pembayaran Termin (Rp) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                Rp
              </span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Contoh: 15000000"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* Quick Preset Buttons */}
            {remainingBalance > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(remainingBalance)}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-200 transition-colors cursor-pointer"
                >
                  Pelunasan Sisa ({formatRupiah(remainingBalance)})
                </button>
                {contractValue > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(contractValue * 0.5)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      DP 50% ({formatRupiah(contractValue * 0.5)})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(contractValue * 0.3)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      DP 30% ({formatRupiah(contractValue * 0.3)})
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* METODE PEMBAYARAN DINAMIS (INTRUKSI 1) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Metode Pembayaran (Rekening GOR / Tunai / Giro) *</span>
              {paymentMethod.startsWith('Transfer Bank') && (
                <span className="text-[10px] text-blue-600 font-semibold lowercase">
                  (tersimpan untuk invoice)
                </span>
              )}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <optgroup label="Rekening Bank Resmi GOR / Tenant">
                {paymentOptions.filter((o) => o.group === 'Rekening Resmi GOR').map((opt) => (
                  <option key={opt.id} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Tunai, QRIS & Instrumen B2B">
                {paymentOptions.filter((o) => o.group !== 'Rekening Resmi GOR').map((opt) => (
                  <option key={opt.id} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* =============================================================== */}
          {/* 3. CONDITIONAL FORM UNTUK CEK / BILYET GIRO (INTRUKSI 2)        */}
          {/* =============================================================== */}
          {isGiro && (
            <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center space-x-2 text-amber-900 border-b border-amber-200 pb-2">
                <Landmark className="w-4.5 h-4.5 text-amber-700 shrink-0" />
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider">
                    Informasi Instrumen Cek / Bilyet Giro
                  </h4>
                  <p className="text-[10px] text-amber-700">
                    Wajib diisi lengkap untuk proses rekonsiliasi dan kliring bank
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* NOMOR CEK / GIRO */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nomor Cek / Bilyet Giro *
                  </label>
                  <input
                    type="text"
                    required={isGiro}
                    value={giroDetails.giroNumber}
                    onChange={(e) => setGiroDetails({ ...giroDetails, giroNumber: e.target.value })}
                    placeholder="Contoh: BG-9821034"
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* BANK PENERBIT */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bank Penerbit *
                  </label>
                  <input
                    type="text"
                    required={isGiro}
                    value={giroDetails.bankIssuer}
                    onChange={(e) => setGiroDetails({ ...giroDetails, bankIssuer: e.target.value })}
                    placeholder="Contoh: Bank Mandiri / BCA"
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* TANGGAL JATUH TEMPO / KLIRING */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tanggal Jatuh Tempo / Kliring *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required={isGiro}
                    value={giroDetails.dueDate}
                    onChange={(e) => setGiroDetails({ ...giroDetails, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* PERINGATAN PENDING CLEARING */}
              <div className="flex items-start space-x-2 text-[11px] text-amber-800 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  Pembayaran dengan Bilyet Giro akan disimpan dengan status <strong>Pending Clearing</strong>. Dana belum dihitung ke <em>Total Cair</em> hingga bilyet giro berhasil dikliringkan.
                </p>
              </div>
            </div>
          )}

          {/* CATATAN & JATUH TEMPO INVOICE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan / Keterangan Termin
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Contoh: DP 50% Termin 1 - Kontrak No. 042/SPON/2026"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Tanggal Jatuh Tempo Invoice</span>
                <span className="text-[10px] text-slate-400 font-normal lowercase">(opsional)</span>
              </label>
              <input
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* RIWAYAT TERMIN SEBELUMNYA & STATUS KLIRING */}
          {Array.isArray(sponsor?.paymentHistory) && sponsor.paymentHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Riwayat Pembayaran Termin &amp; Bilyet Giro ({sponsor.paymentHistory.length})
              </span>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {sponsor.paymentHistory.map((h, idx) => {
                  const isPendingGiro = h.status === 'pending_clearing';
                  return (
                    <div
                      key={h.id || idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        isPendingGiro
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <p className="font-extrabold text-slate-800 truncate">
                            {h.notes || `Termin #${idx + 1}`}
                          </p>
                          {isPendingGiro ? (
                            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md text-[9px] font-black uppercase">
                              Pending Kliring
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-black uppercase">
                              Cair
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {h.paidAt ? new Date(h.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} &bull; {h.paymentDetails || h.paymentMethod}
                        </p>
                        {isPendingGiro && h.giroData && (
                          <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                            No. Giro: <strong>{h.giroData.giroNumber}</strong> ({h.giroData.bankIssuer}) &bull; Jatuh Tempo: {h.giroData.dueDate}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className={`font-black ${isPendingGiro ? 'text-amber-700' : 'text-emerald-600'}`}>
                          {isPendingGiro ? '~ ' : '+ '} {formatRupiah(h.amount)}
                        </span>

                        {/* Tombol Cairkan / Kliringkan jika masih pending */}
                        {isPendingGiro && (
                          <button
                            type="button"
                            onClick={() => handleClearGiroRecord(h)}
                            disabled={isSubmitting}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black rounded-md shadow-2xs transition-colors cursor-pointer"
                            title="Konfirmasi kliring giro sekarang"
                          >
                            Cairkan Giro
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const currentAmount = parseFloat(paymentAmount) || remainingBalance || contractValue;
                const term = paymentNotes.trim() || (isGiro ? 'Bilyet Giro (Pending)' : (remainingBalance <= currentAmount ? 'Pelunasan Sponsorship' : 'Termin Sponsorship'));
                const benefits = sponsor.benefits || sponsor.benefit || 'Publikasi Brand, Media Partner';
                generateSponsorInvoice(
                  sponsor,
                  activeTenantProfile,
                  sponsor.eventName,
                  currentAmount,
                  invoiceDueDate,
                  term,
                  benefits,
                  userProfile
                );
              }}
              className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center space-x-1.5"
              title="Cetak Invoice PDF Resmi"
            >
              <FileText className="w-4 h-4 text-[#C89D32]" />
              <span>Cetak Invoice</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                <Receipt className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Mencatat Transaksi...'
                    : isGiro
                    ? 'Catat Bilyet Giro (Pending)'
                    : 'Simpan Pembayaran Termin'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
