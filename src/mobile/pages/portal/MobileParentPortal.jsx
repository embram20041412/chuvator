import React, { useState } from 'react';
import { 
  Users, 
  Check, 
  ChevronRight, 
  ChevronDown, 
  LogOut, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  X, 
  QrCode, 
  CreditCard, 
  Sparkles, 
  Star, 
  Award, 
  Trophy, 
  Activity, 
  LineChart, 
  Ruler, 
  Scale, 
  Building2, 
  Phone, 
  Info,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import MobileHeader from '../../components/MobileHeader';
import MobileCard from '../../components/MobileCard';
import MobileBadge from '../../components/MobileBadge';
import MobileAvatar from '../../components/MobileAvatar';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileLoadingState from '../../components/MobileLoadingState';
import App3DMobileIcon from '../../components/App3DMobileIcon';

/**
 * MobileParentPortal Component
 * Dedicated, Mobile-First Presentation Layer for CHUVATOR Parent Portal.
 * Uses Phase 1 Mobile Design System & 3D Claymorphic Icons.
 * Scoped strictly under .chua-mobile-app
 */
export default function MobileParentPortal({
  student,
  childrenList = [],
  verifiedStudentId,
  verifiedTenantId,
  csrfToken,
  isSessionVerified,
  isVerifyingSession,
  sessionError,
  isLoggingOut,
  handleSelectChild,
  handleLogout,
  billingData,
  bankAccounts = [],
  selectedBankIndex = 0,
  setSelectedBankIndex,
  currentAccount = {},
  activeBank = '',
  activeAccountNumber = '',
  activeAccountName = '',
  handleCopyAccount,
  copiedAccount = false,
  isLoadingBilling = false,
  billingError = null,
  showQrisModal = false,
  setShowQrisModal,
  qrisUrl = null,
  scheduleData,
  isLoadingSchedule = false,
  scheduleError = null,
  activeScheduleTab = 'jadwal',
  setActiveScheduleTab,
  evaluationData,
  isLoadingEvaluation = false,
  evaluationError = null,
  activeEvalTab = 'assessment',
  setActiveEvalTab,
  announcementsData,
  isLoadingAnnouncements = false,
  announcementsError = null,
  formatRupiah,
  formatAttendanceDate,
  formatSessionDate,
  getEvaluationGrade,
  getBmiStatusBadge,
  getTournamentMedalStyle,
}) {
  // Mobile Navigation: 'home' | 'billing' | 'schedule' | 'evaluation' | 'profile'
  const [mobileTab, setMobileTab] = useState('home');
  const [showChildSheet, setShowChildSheet] = useState(false);
  const [showQrisBottomSheet, setShowQrisBottomSheet] = useState(false);

  // Fallback defaults
  const studentName = student?.studentName || student?.name || 'Siswa';
  const academyName = student?.academy_name || student?.academyName || student?.school_origin || student?.school_name || 'Sport Academy';
  const className = student?.className || 'Reguler';
  const sportCategory = student?.sportCategory || student?.sport || 'Umum';
  const coachName = student?.coachName || scheduleData?.classInfo?.coachName || 'Pelatih Pembina';
  const schoolOrigin = student?.schoolOrigin || student?.school_origin || student?.school_name || '';

  // 1. Loading State
  if (isVerifyingSession) {
    return <MobileLoadingState message="Memverifikasi Sesi Portal Wali Murid..." />;
  }

  // 2. Session Error State
  if (!isSessionVerified || sessionError) {
    return (
      <div className="p-6 min-h-[80vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-slate-800">Sesi Telah Berakhir</h2>
          <p className="text-xs text-slate-500 max-w-xs">
            {sessionError || 'Identitas sesi Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.assign('/portal')}
          className="px-5 py-2.5 rounded-xl bg-[var(--chua-m-blue)] text-white font-bold text-xs shadow-md cursor-pointer active:scale-95 transition-transform"
        >
          Masuk ke Portal
        </button>
      </div>
    );
  }

  // Next upcoming session resolution
  const nextSession = scheduleData?.nextSession || (Array.isArray(scheduleData?.schedule) && scheduleData.schedule[0]) || null;
  const isPaidThisMonth = Boolean(billingData?.billing?.isPaidThisMonth);
  const totalAmount = Number(billingData?.billing?.totalAmount || 0);

  return (
    <div className="chua-mobile-page min-h-screen bg-[var(--chua-m-bg)] text-[var(--chua-m-text-primary)] flex flex-col justify-between">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* TOP STICKY HEADER */}
      {/* ───────────────────────────────────────────────────────────── */}
      <MobileHeader
        leftAction={
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center shrink-0 shadow-2xs">
              <App3DMobileIcon name="akademi" className="w-7 h-7" alt="Akademi" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--chua-m-blue)] block leading-tight">
                PORTAL WALI MURID
              </span>
              <h2 className="text-xs font-extrabold text-slate-800 truncate max-w-[150px] my-0 leading-tight">
                {academyName}
              </h2>
            </div>
          </div>
        }
        rightAction={
          <div className="flex items-center gap-1.5 shrink-0">
            {childrenList.length > 1 ? (
              <button
                type="button"
                onClick={() => setShowChildSheet(true)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span className="truncate max-w-[80px]">{studentName}</span>
                <ChevronDown className="w-3 h-3 text-emerald-700" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Terverifikasi</span>
              </div>
            )}
          </div>
        }
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAIN BODY CONTENT AREA */}
      {/* ───────────────────────────────────────────────────────────── */}
      <main className="chua-mobile-page-content pb-24 space-y-4 pt-3 flex-1">
        
        {/* =========================================================== */}
        {/* TAB 1: BERANDA ('home') */}
        {/* =========================================================== */}
        {mobileTab === 'home' && (
          <div className="space-y-4">
            {/* A. WELCOME & GREETING */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center shrink-0">
                  <App3DMobileIcon name="wali_murid" className="w-8 h-8" alt="Wali Murid" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-800 truncate my-0">
                    Halo, Bapak/Ibu Wali
                  </h3>
                  <p className="text-[11px] text-slate-500 my-0.5 truncate">
                    {childrenList.length > 1 ? `${childrenList.length} Anak Terdaftar di Akademi` : 'Wali Murid Resmi Akademi'}
                  </p>
                </div>
              </div>

              {childrenList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowChildSheet(true)}
                  className="px-2.5 py-1 text-[11px] font-bold text-[var(--chua-m-blue)] bg-blue-50 border border-blue-200 rounded-lg shrink-0 cursor-pointer"
                >
                  Ganti Anak
                </button>
              )}
            </div>

            {/* B. HERO ATHLETE CARD */}
            <div className="chua-mobile-card-navy p-4 rounded-2xl shadow-md space-y-3 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <MobileAvatar
                    src={student?.photoUrl || student?.photo_url}
                    name={studentName}
                    size="lg"
                    className="border-2 border-white/40 shadow-sm shrink-0"
                  />
                  <div className="min-w-0 text-white">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                        {sportCategory}
                      </span>
                      <span className="text-[9px] font-bold text-slate-300">
                        {className}
                      </span>
                    </div>
                    <h1 className="text-lg font-black text-white truncate my-1">
                      {studentName}
                    </h1>
                    <p className="text-[11px] text-slate-300 my-0 truncate">
                      Pelatih: <strong className="text-white font-bold">{coachName}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer Info */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                <span>Sekolah: <strong className="text-white font-semibold">{schoolOrigin || '-'}</strong></span>
                <span className="text-[10px] font-mono text-emerald-300">ID: {verifiedStudentId ? verifiedStudentId.slice(0, 8).toUpperCase() : 'ATLET'}</span>
              </div>
            </div>

            {/* C. QUICK ACTIONS (4 TILES) */}
            <div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMobileTab('billing')}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs active:scale-98"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <App3DMobileIcon name="spp" className="w-8 h-8" alt="SPP" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-800 block truncate">
                      Tagihan SPP
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {isPaidThisMonth ? 'Sudah Lunas' : 'Menunggu Bayar'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveScheduleTab('jadwal');
                    setMobileTab('schedule');
                  }}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs active:scale-98"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <App3DMobileIcon name="booking" className="w-8 h-8" alt="Jadwal" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-800 block truncate">
                      Jadwal Sesi
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Latihan Rutin
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveScheduleTab('presensi');
                    setMobileTab('schedule');
                  }}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs active:scale-98"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <App3DMobileIcon name="presensi" className="w-8 h-8" alt="Presensi" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-800 block truncate">
                      Presensi Siswa
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Histori Kehadiran
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveEvalTab('assessment');
                    setMobileTab('evaluation');
                  }}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs active:scale-98"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <App3DMobileIcon name="evaluasi" className="w-8 h-8" alt="Evaluasi" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-800 block truncate">
                      Rapor Pelatih
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Evaluasi &amp; Growth
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* D. STATUS SPP BULAN BERJALAN */}
            <MobileCard className="p-3.5 space-y-2.5 my-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <App3DMobileIcon name="tarif_spp" className="w-6 h-6" alt="SPP" />
                  <span className="text-xs font-bold text-slate-800">
                    Status Iuran SPP Bulan Ini
                  </span>
                </div>
                <MobileBadge
                  variant={isPaidThisMonth ? 'emerald' : 'warning'}
                  className="text-[10px] px-2 py-0.5"
                >
                  {isPaidThisMonth ? 'LUNAS' : 'BELUM LUNAS'}
                </MobileBadge>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Nominal Tagihan:</span>
                  <p className="text-base font-black text-slate-800 my-0 font-mono">
                    {formatRupiah(totalAmount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab('billing')}
                  className="px-3 py-1.5 bg-[var(--chua-m-blue)] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 transition-transform"
                >
                  <span>{isPaidThisMonth ? 'Detail' : 'Bayar'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </MobileCard>

            {/* E. SESI LATIHAN MENDATANG */}
            <MobileCard className="p-3.5 space-y-2.5 my-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--chua-m-blue)]" />
                  <span className="text-xs font-bold text-slate-800">
                    Sesi Latihan Berikutnya
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {className}
                </span>
              </div>

              {nextSession ? (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">
                      {formatSessionDate(nextSession.sessionDate || nextSession.date || nextSession.dayName)}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {nextSession.time || `${nextSession.startTime || '16:00'} - ${nextSession.endTime || '18:00'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {nextSession.courtName || nextSession.venue || 'Lapangan Utama'}
                    </span>
                    <span>&bull;</span>
                    <span>Pelatih: {nextSession.coachName || coachName}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2 text-center my-0">
                  Tidak ada jadwal sesi terdekat minggu ini.
                </p>
              )}
            </MobileCard>

            {/* F. PENGUMUMAN AKADEMI */}
            {announcementsData?.announcements && announcementsData.announcements.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block px-1">
                  Pengumuman Akademi
                </span>
                <div className="space-y-2">
                  {announcementsData.announcements.slice(0, 2).map((item, idx) => (
                    <div key={item.id || idx} className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-amber-900 truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-amber-700 font-medium">
                          {item.date ? new Date(item.date).toLocaleDateString('id-ID') : 'Baru'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 line-clamp-2 my-0">
                        {item.content || item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================== */}
        {/* TAB 2: SPP & PEMBAYARAN ('billing') */}
        {/* =========================================================== */}
        {mobileTab === 'billing' && (
          <div className="space-y-4">
            {/* Header Status Card */}
            <div className={`p-4 rounded-2xl text-white shadow-md space-y-3 relative overflow-hidden ${
              isPaidThisMonth ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'chua-mobile-card-navy'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Tagihan Iuran SPP
                </span>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                  isPaidThisMonth 
                    ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40' 
                    : 'bg-amber-400/20 text-amber-300 border-amber-300/40'
                }`}>
                  {isPaidThisMonth ? 'LUNAS BULAN INI' : 'MENUNGGU PEMBAYARAN'}
                </span>
              </div>

              <div>
                <p className="text-[11px] text-slate-300 my-0">Total yang harus dibayar:</p>
                <h2 className="text-2xl font-black font-mono tracking-tight my-0 text-white">
                  {formatRupiah(totalAmount)}
                </h2>
                <p className="text-[10px] text-slate-300 mt-1 my-0">
                  Jatuh tempo: Tanggal 10 setiap bulan &bull; Siswa: {studentName}
                </p>
              </div>
            </div>

            {/* Rincian Tagihan */}
            {billingData?.billing?.details && billingData.billing.details.length > 0 && (
              <MobileCard className="p-3.5 space-y-2 my-0">
                <span className="text-xs font-bold text-slate-800 block pb-1 border-b border-slate-100">
                  Rincian Biaya
                </span>
                <div className="space-y-1.5 text-xs">
                  {billingData.billing.details.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-600">
                      <span>{item.description || item.title || 'SPP Akademi'}</span>
                      <strong className="font-mono text-slate-800">{formatRupiah(item.amount)}</strong>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-black text-slate-800">
                    <span>Total Pembayaran:</span>
                    <span className="font-mono text-[var(--chua-m-blue)]">{formatRupiah(totalAmount)}</span>
                  </div>
                </div>
              </MobileCard>
            )}

            {/* Rekening Pembayaran Resmi */}
            <MobileCard className="p-3.5 space-y-3 my-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[var(--chua-m-blue)]" />
                  <span className="text-xs font-bold text-slate-800">
                    Instruksi Transfer Bank Resmi
                  </span>
                </div>
                {bankAccounts.length > 1 && (
                  <select
                    value={selectedBankIndex}
                    onChange={(e) => setSelectedBankIndex(Number(e.target.value))}
                    className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 outline-none"
                  >
                    {bankAccounts.map((b, i) => (
                      <option key={i} value={i}>{b.bankName || `Bank ${i + 1}`}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Nama Bank:</span>
                    <strong className="text-xs text-slate-800 block uppercase font-bold">{activeBank}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Atas Nama:</span>
                    <strong className="text-xs text-slate-800 block font-bold">{activeAccountName}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Nomor Rekening:</span>
                    <span className="text-sm font-black font-mono text-slate-800 block tracking-wider">
                      {activeAccountNumber || '-'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      copiedAccount 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {copiedAccount ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* QRIS Button */}
              {qrisUrl && (
                <button
                  type="button"
                  onClick={() => setShowQrisBottomSheet(true)}
                  className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-98 transition-transform"
                >
                  <QrCode className="w-4 h-4 text-[var(--chua-m-blue)]" />
                  <span>Bayar Lewat Scan Kode QRIS</span>
                </button>
              )}
            </MobileCard>

            {/* Riwayat Pembayaran */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block px-1">
                Riwayat Pembayaran Resmi
              </span>
              {Array.isArray(billingData?.paymentHistory) && billingData.paymentHistory.length > 0 ? (
                <div className="space-y-2">
                  {billingData.paymentHistory.map((tx, idx) => (
                    <MobileCard key={tx.id || idx} className="p-3 my-0 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-800 truncate my-0">
                            {tx.itemName || tx.title || 'Pembayaran SPP'}
                          </h4>
                          <p className="text-[10px] text-slate-400 my-0.5">
                            {formatAttendanceDate(tx.createdAt || tx.date)} &bull; {tx.paymentMethod || 'Transfer / QRIS'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-xs text-emerald-600 block">
                          +{formatRupiah(tx.amount)}
                        </span>
                        <MobileBadge variant="emerald" className="text-[9px] px-1.5 py-0.2">
                          LUNAS
                        </MobileBadge>
                      </div>
                    </MobileCard>
                  ))}
                </div>
              ) : (
                <MobileEmptyState
                  title="Belum Ada Riwayat Pembayaran"
                  description="Riwayat bukti pembayaran SPP resmi akan tersimpan otomatis setelah dikonfirmasi admin."
                />
              )}
            </div>
          </div>
        )}

        {/* =========================================================== */}
        {/* TAB 3: JADWAL & PRESENSI ('schedule') */}
        {/* =========================================================== */}
        {mobileTab === 'schedule' && (
          <div className="space-y-4">
            {/* Sub-tab segmented pill */}
            <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setActiveScheduleTab('jadwal')}
                className={`py-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeScheduleTab === 'jadwal'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <App3DMobileIcon name="booking" className="w-4 h-4 shrink-0" />
                <span>Jadwal Sesi</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveScheduleTab('presensi')}
                className={`py-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeScheduleTab === 'presensi'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <App3DMobileIcon name="presensi" className="w-4 h-4 shrink-0" />
                <span>Rekam Presensi</span>
              </button>
            </div>

            {/* Sub-Content 1: Jadwal Latihan */}
            {activeScheduleTab === 'jadwal' && (
              <div className="space-y-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-800 my-0">
                        Jadwal Kelas: {className}
                      </h3>
                      <p className="text-[11px] text-slate-400 my-0.5">
                        Cabang: {sportCategory} &bull; Pelatih: {coachName}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                      Rutin
                    </span>
                  </div>

                  {Array.isArray(scheduleData?.schedule) && scheduleData.schedule.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {scheduleData.schedule.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[var(--chua-m-blue)] flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-extrabold text-xs text-slate-800 block">
                                {item.dayName || item.day || 'Hari Latihan'}
                              </span>
                              <span className="text-[11px] text-slate-500 block">
                                {item.time || `${item.startTime || '16:00'} - ${item.endTime || '18:00'}`} &bull; {item.courtName || 'Lapangan GOR'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            Aktif
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center my-0">
                      Jadwal latihan rutin belum ditentukan oleh admin akademi.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Sub-Content 2: Rekam Presensi */}
            {activeScheduleTab === 'presensi' && (
              <div className="space-y-3">
                {/* Ringkasan Presensi */}
                <div className="grid grid-cols-3 gap-2">
                  <MobileCard className="p-2.5 text-center my-0 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Sesi
                    </span>
                    <p className="text-base font-black text-slate-800 my-0 font-mono">
                      {scheduleData?.attendanceStats?.totalSessions || scheduleData?.attendances?.length || 0}
                    </p>
                  </MobileCard>

                  <MobileCard className="p-2.5 text-center my-0 space-y-0.5">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">
                      Hadir
                    </span>
                    <p className="text-base font-black text-emerald-600 my-0 font-mono">
                      {scheduleData?.attendanceStats?.presentCount || (scheduleData?.attendances || []).filter(a => a.status === 'Hadir' || a.status === 'present').length}
                    </p>
                  </MobileCard>

                  <MobileCard className="p-2.5 text-center my-0 space-y-0.5">
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block">
                      Kehadiran
                    </span>
                    <p className="text-base font-black text-blue-600 my-0 font-mono">
                      {scheduleData?.attendanceStats?.percentage || '100%'}
                    </p>
                  </MobileCard>
                </div>

                {/* Histori Presensi */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block px-1">
                    Daftar Kehadiran Sesi Latihan
                  </span>
                  {Array.isArray(scheduleData?.attendances) && scheduleData.attendances.length > 0 ? (
                    <div className="space-y-2">
                      {scheduleData.attendances.map((rec, idx) => {
                        const isPresent = String(rec.status).toLowerCase() === 'hadir' || String(rec.status).toLowerCase() === 'present';
                        return (
                          <MobileCard key={rec.id || idx} className="p-3 my-0 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isPresent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                <Activity className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-slate-800 truncate my-0">
                                  {formatAttendanceDate(rec.sessionDate || rec.date)}
                                </h4>
                                <p className="text-[10px] text-slate-400 my-0.5 truncate">
                                  {rec.notes || rec.material || (isPresent ? 'Hadir tepat waktu' : 'Izin / Sakit')}
                                </p>
                              </div>
                            </div>

                            <MobileBadge
                              variant={isPresent ? 'emerald' : 'warning'}
                              className="text-[9px] px-2 py-0.5 shrink-0"
                            >
                              {rec.status || 'Hadir'}
                            </MobileBadge>
                          </MobileCard>
                        );
                      })}
                    </div>
                  ) : (
                    <MobileEmptyState
                      title="Belum Ada Catatan Presensi"
                      description="Data kehadiran siswa akan dicatat oleh pelatih pada setiap sesi latihan berlangsung."
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================== */}
        {/* TAB 4: RAPOR & PRESTASI ('evaluation') */}
        {/* =========================================================== */}
        {mobileTab === 'evaluation' && (
          <div className="space-y-4">
            {/* Sub-tab segmented pill */}
            <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setActiveEvalTab('assessment')}
                className={`py-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeEvalTab === 'assessment'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <App3DMobileIcon name="evaluasi" className="w-4 h-4 shrink-0" />
                <span>Rapor Pelatih</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEvalTab('growth')}
                className={`py-2 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeEvalTab === 'growth'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <App3DMobileIcon name="ai_insight" className="w-4 h-4 shrink-0" />
                <span>Pertumbuhan &amp; Event</span>
              </button>
            </div>

            {/* Sub-Content 1: Rapor Pelatih */}
            {activeEvalTab === 'assessment' && (
              <div className="space-y-3">
                {/* Header Rapor Overview */}
                <div className="chua-mobile-card-navy p-4 rounded-2xl shadow-md text-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                      Rapor Kinerja Atlet
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      {evaluationData?.evaluations?.length ? 'Terbit Resmi' : 'Evaluasi Terkini'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white my-0">
                    {studentName} &bull; {sportCategory}
                  </h3>
                  <p className="text-[11px] text-slate-300 my-0">
                    Penilai: <strong className="text-white font-bold">{coachName}</strong>
                  </p>
                </div>

                {/* Parameter Penilaian */}
                {evaluationData?.evaluations && evaluationData.evaluations.length > 0 ? (
                  <div className="space-y-3">
                    {evaluationData.evaluations.slice(0, 1).map((ev, idx) => {
                      const grade = getEvaluationGrade(ev.totalScore || ev.score || 85);
                      return (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Periode Penilaian:</span>
                              <strong className="text-xs text-slate-800">{ev.period || ev.title || 'Evaluasi Berkala'}</strong>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black font-mono text-[var(--chua-m-blue)] block leading-none">
                                {ev.totalScore || ev.score || 85}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${grade.badge}`}>
                                {grade.label}
                              </span>
                            </div>
                          </div>

                          {/* Skill breakdown bars */}
                          <div className="space-y-2 pt-1 text-xs">
                            <div>
                              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                                <span>Teknik &amp; Fundamental</span>
                                <span className="font-mono">{ev.techniqueScore || 85}/100</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ev.techniqueScore || 85}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                                <span>Kondisi Fisik &amp; Stamina</span>
                                <span className="font-mono">{ev.physicalScore || 80}/100</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ev.physicalScore || 80}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                                <span>Taktik &amp; Pemahaman Permainan</span>
                                <span className="font-mono">{ev.tacticalScore || 82}/100</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${ev.tacticalScore || 82}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                                <span>Mental, Disiplin &amp; Sikap</span>
                                <span className="font-mono">{ev.mentalScore || 90}/100</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${ev.mentalScore || 90}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* Coach Feedback Note */}
                          {ev.notes && (
                            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                                Catatan Pelatih:
                              </span>
                              <p className="text-xs text-slate-700 italic my-0">
                                "{ev.notes}"
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <MobileEmptyState
                    title="Belum Ada Rapor Evaluasi"
                    description="Pelatih akan menerbitkan rapor berkala setelah sesi penilaian teknik dan fisik dilaksanakan."
                  />
                )}
              </div>
            )}

            {/* Sub-Content 2: Pertumbuhan & Event */}
            {activeEvalTab === 'growth' && (
              <div className="space-y-3">
                {/* Antropometri Card */}
                <MobileCard className="p-4 space-y-3 my-0">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Ruler className="w-4 h-4 text-[var(--chua-m-blue)]" />
                    <h3 className="font-extrabold text-xs text-slate-800 my-0">
                      Pengukuran Pertumbuhan (Antropometri)
                    </h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Tinggi Badan</span>
                      <strong className="text-base font-black text-slate-800 font-mono">
                        {evaluationData?.growth?.height || student?.height || 145} <span className="text-[10px] font-normal text-slate-400">cm</span>
                      </strong>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Berat Badan</span>
                      <strong className="text-base font-black text-slate-800 font-mono">
                        {evaluationData?.growth?.weight || student?.weight || 38} <span className="text-[10px] font-normal text-slate-400">kg</span>
                      </strong>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Indeks BMI</span>
                      <strong className="text-base font-black text-emerald-600 font-mono">
                        {evaluationData?.growth?.bmi || 18.1}
                      </strong>
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Postur atlet tergolong <strong>Proporsional &amp; Ideal</strong> untuk kelompok usia ini.</span>
                  </div>
                </MobileCard>

                {/* Prestasi & Medali Turnamen */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block px-1">
                    Prestasi &amp; Turnamen Atlet
                  </span>
                  {Array.isArray(evaluationData?.achievements) && evaluationData.achievements.length > 0 ? (
                    <div className="space-y-2">
                      {evaluationData.achievements.map((ach, idx) => {
                        const style = getTournamentMedalStyle(ach.result || ach.title);
                        return (
                          <div key={ach.id || idx} className={`p-3 rounded-2xl border flex items-center justify-between ${style.bg} ${style.border}`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0">
                                <Trophy className={`w-5 h-5 ${style.iconColor}`} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-xs text-slate-800 truncate my-0">
                                  {ach.tournamentName || ach.title || 'Turnamen Olahraga'}
                                </h4>
                                <p className="text-[10px] text-slate-500 my-0.5 truncate">
                                  {ach.category || 'Tunggal Putra / Putri'} &bull; {ach.year || '2026'}
                                </p>
                              </div>
                            </div>

                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${style.badge} shrink-0`}>
                              {ach.result || 'Juara'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <MobileEmptyState
                      title="Belum Ada Catatan Turnamen"
                      description="Data medali, sertifikat, dan rekam kejuaraan atlet akan tampil di sini."
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================== */}
        {/* TAB 5: AKUN & PENGATURAN ('profile') */}
        {/* =========================================================== */}
        {mobileTab === 'profile' && (
          <div className="space-y-4">
            {/* Kartu Profil Wali */}
            <MobileCard className="p-4 space-y-3 my-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  <App3DMobileIcon name="wali_murid" className="w-9 h-9" alt="Wali Murid" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-800 my-0">
                    Akun Wali Murid
                  </h3>
                  <p className="text-xs text-slate-500 my-0.5 truncate">
                    {academyName}
                  </p>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Terhubung &amp; Terverifikasi
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Nama Siswa Terpilih:</span>
                  <strong className="text-slate-800">{studentName}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kelompok Kelas:</span>
                  <strong className="text-slate-800">{className}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pelatih Pembina:</span>
                  <strong className="text-slate-800">{coachName}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Jumlah Anak Terhubung:</span>
                  <strong className="text-slate-800">{childrenList.length} Anak</strong>
                </div>
              </div>
            </MobileCard>

            {/* Bantuan Kontak WhatsApp */}
            <MobileCard className="p-3.5 space-y-2 my-0">
              <span className="text-xs font-bold text-slate-800 block">
                Bantuan &amp; Layanan Akademi
              </span>
              <p className="text-[11px] text-slate-500 my-0">
                Butuh bantuan konfirmasi pembayaran SPP atau perizinan sesi latihan?
              </p>
              <button
                type="button"
                onClick={() => {
                  const phone = student?.tenantPhone || '082131447972';
                  const msg = `Halo Admin ${academyName}, saya orang tua dari ${studentName} ingin berkonsultasi mengenai kegiatan akademi.`;
                  window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Hubungi Admin via WhatsApp</span>
              </button>
            </MobileCard>

            {/* Logout Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98 transition-transform"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>{isLoggingOut ? 'Sedang Keluar...' : 'Keluar dari Portal'}</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2 my-0">
                CHUVATOR &bull; Secure Parent Portal V3.3
              </p>
            </div>
          </div>
        )}

      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5-ITEM STICKY MOBILE BOTTOM NAVIGATION BAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <nav 
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(16,29,56,0.08)] flex items-center justify-around px-2"
        style={{
          height: 'calc(var(--chua-m-bottom-nav-height) + var(--chua-m-safe-bottom))',
          paddingBottom: 'var(--chua-m-safe-bottom)',
        }}
      >
        {/* 1. Beranda */}
        <button
          type="button"
          onClick={() => setMobileTab('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors cursor-pointer ${
            mobileTab === 'home' ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <App3DMobileIcon name="beranda" active={mobileTab === 'home'} className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] tracking-tight">Beranda</span>
        </button>

        {/* 2. SPP & Tagihan */}
        <button
          type="button"
          onClick={() => setMobileTab('billing')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors cursor-pointer ${
            mobileTab === 'billing' ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <App3DMobileIcon name="spp" active={mobileTab === 'billing'} className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] tracking-tight">SPP</span>
        </button>

        {/* 3. Jadwal & Hadir */}
        <button
          type="button"
          onClick={() => setMobileTab('schedule')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors cursor-pointer ${
            mobileTab === 'schedule' ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <App3DMobileIcon name="booking" active={mobileTab === 'schedule'} className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] tracking-tight">Jadwal</span>
        </button>

        {/* 4. Rapor & Prestasi */}
        <button
          type="button"
          onClick={() => setMobileTab('evaluation')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors cursor-pointer ${
            mobileTab === 'evaluation' ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <App3DMobileIcon name="evaluasi" active={mobileTab === 'evaluation'} className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] tracking-tight">Rapor</span>
        </button>

        {/* 5. Akun & Profil */}
        <button
          type="button"
          onClick={() => setMobileTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors cursor-pointer ${
            mobileTab === 'profile' ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <App3DMobileIcon name="wali_murid" active={mobileTab === 'profile'} className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] tracking-tight">Akun</span>
        </button>
      </nav>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM SHEET: MULTI-CHILD SELECTOR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <MobileBottomSheet
        isOpen={showChildSheet}
        onClose={() => setShowChildSheet(false)}
        title="Pilih Atlet / Siswa"
      >
        <p className="text-xs text-slate-500 mb-3 -mt-2">
          Pilih profil anak yang ingin Anda lihat rincian kegiatan dan SPP-nya:
        </p>

        <div className="space-y-2 mb-2">
          {childrenList.map((c, idx) => {
            const cSid = String(c.studentId || c.id).trim();
            const isSelected = cSid.toLowerCase() === verifiedStudentId?.toLowerCase();
            return (
              <button
                key={cSid || idx}
                type="button"
                onClick={() => {
                  handleSelectChild(c);
                  setShowChildSheet(false);
                }}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-blue-50/80 border-[var(--chua-m-blue)] shadow-xs' 
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MobileAvatar
                    src={c.photoUrl || c.photo_url}
                    name={c.studentName || c.name || 'Siswa'}
                    size="md"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-xs text-slate-800 truncate my-0">
                      {c.studentName || c.name || 'Siswa'}
                    </h4>
                    <p className="text-[11px] text-slate-500 my-0.5 truncate">
                      {c.className || 'Reguler'} &bull; {c.academy_name || c.academyName || academyName}
                    </p>
                  </div>
                </div>

                {isSelected ? (
                  <span className="w-6 h-6 rounded-full bg-[var(--chua-m-blue)] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM SHEET: QRIS CODE MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <MobileBottomSheet
        isOpen={showQrisBottomSheet}
        onClose={() => setShowQrisBottomSheet(false)}
        title="Pembayaran QRIS Resmi"
      >
        <div className="text-center space-y-3 p-2">
          <p className="text-xs text-slate-500 my-0">
            Pindai kode QRIS di bawah menggunakan GoPay, OVO, Dana, ShopeePay, BCA, atau Mobile Banking lainnya:
          </p>

          {qrisUrl ? (
            <div className="inline-block p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-md">
              <img
                src={qrisUrl}
                alt="Kode QRIS"
                className="w-48 h-48 object-contain mx-auto"
              />
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider my-0">
                NMID: {activeBank} &bull; {academyName}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6">Kode QRIS belum diunggah oleh admin GOR.</p>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowQrisBottomSheet(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Tutup QRIS
            </button>
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
}
