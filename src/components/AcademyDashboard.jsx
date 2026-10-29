import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  GraduationCap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  MessageCircle,
  Plus,
  BookOpen,
  Calendar,
  Sparkles,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import {
  Akademi3DIcon,
  Keuangan3DIcon
} from './icons/App3DIcons';

// Helper format mata uang Rupiah
function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

// Custom Tooltip untuk Donut Chart SPP
const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/80 text-xs">
        <p className="font-extrabold text-slate-300">{data.name}</p>
        <p className="font-black text-sm text-white mt-0.5">
          {data.value} Siswa ({data.payload?.percent || 0}%)
        </p>
        <p className="text-[10px] text-emerald-400 mt-0.5 font-bold">
          Total: {formatRupiah(data.payload?.amount || 0)}
        </p>
      </div>
    );
  }
  return null;
};

// Custom Tooltip untuk Bar Chart Distribusi Kelas
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/80 text-xs min-w-[150px]">
        <p className="font-extrabold text-slate-300 border-b border-slate-800 pb-1">{label}</p>
        <p className="font-black text-sm text-[#D4A73A] mt-1">
          {data.value} Siswa Terdaftar
        </p>
        {data.payload?.coach && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            Pelatih: <strong className="text-white">{data.payload.coach}</strong>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function AcademyDashboard({
  activeAcademy,
  activeStudents = [],
  activeClasses = [],
  activeCoaches = [],
  sppBillingStartDay = 1,
  sppDueDay = 10,
  calculateSppStatus,
  handleSendWABilling,
  onAddStudent,
  onAddClass,
  onPaySpp,
  onViewStudentDetail
}) {
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // =====================================================================
  // 1. HITUNG METRIK UTAMA DENGAN useMemo (TERISOLASI PADA activeAcademy)
  // =====================================================================
  const {
    totalStudents,
    paidStudents,
    unpaidStudents,
    paidStudentsCount,
    unpaidStudentsCount,
    collectionRate,
    potentialRevenue,
    actualRevenue,
    unpaidRevenue,
    pieData,
    classDistributionData
  } = useMemo(() => {
    const total = activeStudents.length;
    let paidCount = 0;
    let potRev = 0;
    let actRev = 0;
    const paidList = [];
    const unpaidList = [];

    activeStudents.forEach((st) => {
      const fee = Number(st.monthlyFee || st.tuitionFee || 0);
      potRev += fee;

      // Status SPP logic
      let sppInfo = null;
      if (typeof calculateSppStatus === 'function') {
        sppInfo = calculateSppStatus(st, sppBillingStartDay, sppDueDay);
      } else {
        const isPaidCheck =
          st.lastPaidMonth === currentMonth ||
          st.paymentStatus === 'lunas' ||
          st.sppStatus === 'Lunas';
        sppInfo = {
          isPaid: isPaidCheck,
          statusText: isPaidCheck ? 'LUNAS BULAN INI' : 'MENUNGGAK',
          badgeClass: isPaidCheck
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : 'bg-red-100 text-red-800 border-red-200'
        };
      }

      const isPaid = Boolean(
        st.lastPaidMonth === currentMonth ||
        st.paymentStatus === 'lunas' ||
        st.sppStatus === 'Lunas' ||
        sppInfo?.isPaid
      );

      if (isPaid) {
        paidCount++;
        actRev += fee;
        paidList.push({ ...st, sppInfo });
      } else {
        unpaidList.push({ ...st, sppInfo });
      }
    });

    const unpCount = total - paidCount;
    const rate = total > 0 ? Math.round((paidCount / total) * 100) : 0;
    const unpRev = Math.max(0, potRev - actRev);

    // Data Donut Chart SPP
    const pie = [
      {
        name: 'SPP Lunas',
        value: paidCount,
        percent: rate,
        amount: actRev,
        color: '#C89D32' // Warm Mustard Gold
      },
      {
        name: 'SPP Menunggak',
        value: unpCount,
        percent: total > 0 ? 100 - rate : 0,
        amount: unpRev,
        color: '#354944' // Deep Slate Teal
      }
    ];

    // Data Bar Chart Distribusi Kelas
    const classDist = (activeClasses || []).map((cls) => {
      const studentCount = activeStudents.filter((st) => st.classId === cls.id).length;
      return {
        name: cls.className || 'Kelas',
        count: studentCount,
        coach: cls.coachName || '-'
      };
    });

    // Urutkan siswa menunggak berdasarkan hari keterlambatan / nama
    unpaidList.sort((a, b) => (b.sppInfo?.daysOverdue || 0) - (a.sppInfo?.daysOverdue || 0));

    return {
      totalStudents: total,
      paidStudents: paidList,
      unpaidStudents: unpaidList,
      paidStudentsCount: paidCount,
      unpaidStudentsCount: unpCount,
      collectionRate: rate,
      potentialRevenue: potRev,
      actualRevenue: actRev,
      unpaidRevenue: unpRev,
      pieData: pie,
      classDistributionData: classDist
    };
  }, [activeStudents, activeClasses, sppBillingStartDay, sppDueDay, calculateSppStatus, currentMonth]);

  // Jika belum ada akademi aktif atau siswa masih 0
  if (!activeAcademy) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200/80 dark:border-slate-800 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 bg-[#354944]/10 text-[#354944] dark:text-[#C89D32] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Akademi3DIcon className="w-10 h-10" />
        </div>
        <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">Pilih Akademi Terlebih Dahulu</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Silakan buat atau pilih akademi di atas untuk melihat ringkasan metrik analitik dan laporan kinerja.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* =============================================================== */}
      {/* HEADER BANNER AKADEMI SPESIFIK & SIKLUS PENAGIHAN               */}
      {/* =============================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl lg:rounded-3xl p-3.5 sm:px-6 sm:py-4 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-3 lg:gap-4">
        <div className="flex items-center space-x-3 z-10 min-w-0 w-full md:w-auto">
          <div className="hidden sm:flex w-11 h-11 bg-[#354944]/10 border border-[#354944]/20 rounded-2xl items-center justify-center shrink-0 p-1.5 text-[#354944] dark:text-[#C89D32]">
            <Akademi3DIcon className="w-7 h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
              <h2 className="text-xs sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                Dasbor BI &amp; Analytics &bull; {activeAcademy.name}
              </h2>
              <span className="px-2 py-0.5 bg-[#C89D32]/15 text-[#C89D32] border border-[#C89D32]/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                {activeAcademy.categoryLabel || activeAcademy.category || 'Akademi'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-1.5 sm:space-x-2 flex-wrap gap-y-0.5 font-medium">
              <span>Siklus: Tgl <strong className="text-slate-800 dark:text-slate-200">{sppBillingStartDay}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span>Jatuh Tempo: Tgl <strong className="text-slate-800 dark:text-slate-200">{sppDueDay}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span className="inline-flex items-center px-1.5 py-0.2 bg-[#354944]/10 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20 rounded text-[10px] font-bold">{activeClasses.length} Kelas</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 z-10 shrink-0 w-full md:w-auto">
          {onAddStudent && (
            <button
              onClick={onAddStudent}
              className="bg-[#C89D32] hover:bg-[#B38A28] text-white px-3 py-2 sm:px-4 sm:py-2.5 text-xs font-bold rounded-xl sm:rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Daftar Siswa</span>
            </button>
          )}
          {onAddClass && (
            <button
              onClick={onAddClass}
              className="bg-[#354944] hover:bg-[#2B3D38] text-white px-3 py-2 sm:px-4 sm:py-2.5 text-xs font-bold rounded-xl sm:rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Buat Kelas</span>
            </button>
          )}
        </div>
      </div>

      {/* =============================================================== */}
      {/* 1. BAGIAN ATAS (SCORECARDS METRIK UTAMA TOPOGRAPHY CARDS)        */}
      {/* =============================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4">
        {/* CARD 1: TOTAL SISWA AKTIF (Warm Mustard Gold Highlight) */}
        <div className="bg-[#C89D32] text-white bg-topography-waves rounded-2xl lg:rounded-3xl p-3.5 lg:p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[105px] lg:min-h-[120px]">
          <div className="flex items-center justify-between z-10">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Total Siswa Aktif</p>
            <div className="w-7 h-7 lg:w-10 lg:h-10 bg-white/15 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
              <GraduationCap className="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
          </div>
          <div className="z-10 mt-1.5 lg:mt-2">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-lg sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-white">{totalStudents}</span>
              <span className="text-[10px] lg:text-xs font-bold text-white/80">Atlet</span>
            </div>
          </div>
          <div className="border-t border-white/20 pt-1.5 lg:pt-2 text-[10px] lg:text-[11px] font-bold text-white/80 z-10 truncate mt-1.5">
            {activeClasses.length} Kelas &bull; {activeCoaches.length} Pelatih
          </div>
        </div>

        {/* CARD 2: TINGKAT PELUNASAN SPP (%) */}
        <div className="bg-[#354944] text-white bg-topography-waves rounded-2xl lg:rounded-3xl p-3.5 lg:p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[105px] lg:min-h-[120px]">
          <div className="flex items-center justify-between z-10">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Tingkat Pelunasan</p>
            <div className="w-7 h-7 lg:w-10 lg:h-10 bg-white/15 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
              <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
          </div>
          <div className="z-10 mt-1.5 lg:mt-2">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-lg sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-[#D4A73A]">
                {collectionRate}%
              </span>
              <span className="text-[10px] lg:text-xs font-bold text-white/80">Bulan Ini</span>
            </div>
          </div>
          <div className="border-t border-white/20 pt-1.5 lg:pt-2 flex items-center justify-between text-[10px] lg:text-[11px] font-bold z-10 mt-1.5">
            <span className="text-white/90">{paidStudentsCount} Lunas</span>
            <span className="text-white/60">{unpaidStudentsCount} Menunggak</span>
          </div>
        </div>

        {/* CARD 3: PENDAPATAN AKTUAL SPP */}
        <div className="bg-[#354944] text-white bg-topography-waves rounded-2xl lg:rounded-3xl p-3.5 lg:p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[105px] lg:min-h-[120px]">
          <div className="flex items-center justify-between z-10">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Pendapatan SPP Masuk</p>
            <div className="w-7 h-7 lg:w-10 lg:h-10 bg-white/15 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
              <Keuangan3DIcon className="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
          </div>
          <div className="z-10 mt-1.5 lg:mt-2">
            <p className="text-base sm:text-xl font-black font-mono tracking-tight text-white truncate">
              {formatRupiah(actualRevenue)}
            </p>
          </div>
          <div className="border-t border-white/20 pt-1.5 lg:pt-2 text-[10px] lg:text-[11px] font-bold text-white/80 z-10 truncate mt-1.5">
            Potensi: {formatRupiah(potentialRevenue)}
          </div>
        </div>

        {/* CARD 4: TOTAL TUNGGAKAN SPP */}
        <div className="bg-[#354944] text-white bg-topography-waves rounded-2xl lg:rounded-3xl p-3.5 lg:p-5 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[105px] lg:min-h-[120px]">
          <div className="flex items-center justify-between z-10">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Total Tunggakan</p>
            <div className="w-7 h-7 lg:w-10 lg:h-10 bg-white/15 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xs text-white">
              <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 text-amber-300" />
            </div>
          </div>
          <div className="z-10 mt-1.5 lg:mt-2">
            <p className="text-base sm:text-xl font-black font-mono tracking-tight text-amber-300 truncate">
              {formatRupiah(unpaidRevenue)}
            </p>
          </div>
          <div className="border-t border-white/20 pt-1.5 lg:pt-2 text-[10px] lg:text-[11px] font-bold text-white/80 z-10 truncate mt-1.5">
            {unpaidStudentsCount} Siswa Belum Lunas
          </div>
        </div>
      </div>

      {/* =============================================================== */}
      {/* 2. BAGIAN TENGAH (CHARTS: DONUT SPP & BAR KELAS)                 */}
      {/* =============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* CHART 1: DONUT CHART PROPORSI SPP (5 COLS) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3 min-h-[260px]">
          <div className="border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-[#354944]" />
              <span>Proporsi SPP Bulan Ini</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Rasio siswa lunas vs menunggak pada siklus aktif
            </p>
          </div>

          {/* Donut Chart with Center Text */}
          <div className="h-48 w-full relative flex items-center justify-center">
            {totalStudents === 0 ? (
              <div className="text-center p-4">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Belum ada siswa di akademi ini</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Circle Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Pelunasan
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    {collectionRate}%
                  </span>
                  <span className="text-[9px] font-bold text-slate-500">
                    {paidStudentsCount}/{totalStudents} Siswa
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Legend Details */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
            <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100/70">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-bold text-slate-800">SPP Lunas</span>
              </div>
              <div className="mt-1">
                <span className="font-extrabold text-emerald-700 block text-xs">{formatRupiah(actualRevenue)}</span>
                <span className="text-[10px] text-slate-500 font-medium">{paidStudentsCount} Siswa ({collectionRate}%)</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-rose-50/60 border border-rose-100/70">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="font-bold text-slate-800">SPP Menunggak</span>
              </div>
              <div className="mt-1">
                <span className="font-extrabold text-rose-700 block text-xs">{formatRupiah(unpaidRevenue)}</span>
                <span className="text-[10px] text-slate-500 font-medium">{unpaidStudentsCount} Siswa ({totalStudents > 0 ? 100 - collectionRate : 0}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* CHART 2: BAR CHART DISTRIBUSI SISWA PER KELAS (7 COLS) */}
        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3 min-h-[260px]">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#354944]" />
                <span>Distribusi Siswa per Kelas</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kapasitas dan populasi siswa antar kelas di {activeAcademy.name}
              </p>
            </div>
            <span className="text-[10px] font-bold text-[#354944] bg-[#354944]/10 px-2 py-0.5 rounded-md border border-[#354944]/20">
              {activeClasses.length} Kelas
            </span>
          </div>

          <div className="h-48 w-full pt-1">
            {classDistributionData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                <BookOpen className="w-7 h-7 text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-600">Belum ada kelas dibuat</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tambahkan kelompok atau kelas latihan untuk melihat sebaran atlet.
                </p>
                {onAddClass && (
                  <button
                    onClick={onAddClass}
                    className="mt-2 px-2.5 py-1 bg-[#354944] text-white hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    + Buat Kelas
                  </button>
                )}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Siswa"
                    fill="#354944"
                    barSize={20}
                    radius={[12, 12, 12, 12]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Catatan Ringkas */}
          <div className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
            <span>Rata-rata siswa per kelas: <strong>{activeClasses.length > 0 ? (totalStudents / activeClasses.length).toFixed(1) : 0} Siswa</strong></span>
            <span>Total Pelatih: <strong>{activeCoaches.length} Orang</strong></span>
          </div>
        </div>
      </div>

      {/* =============================================================== */}
      {/* 3. BAGIAN BAWAH (QUICK ACTION: SISWA MENUNGGAK SPP BULAN INI)   */}
      {/* =============================================================== */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Daftar Siswa Menunggak SPP Bulan Ini
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  {unpaidStudents.length} Siswa
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kirim pesan tagihan otomatis via WhatsApp untuk mempercepat arus kas akademi
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block">Total Belum Tertagih:</span>
            <span className="text-xs font-extrabold text-rose-600">{formatRupiah(unpaidRevenue)}</span>
          </div>
        </div>

        {unpaidStudents.length === 0 ? (
          <div className="py-8 border-2 border-dashed border-emerald-200 bg-emerald-50/30 rounded-xl text-center flex flex-col items-center justify-center p-5">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-xs font-extrabold text-emerald-800">
              Luar Biasa! Semua Siswa Telah Lunas
            </p>
            <p className="text-[11px] text-emerald-600 max-w-md mt-0.5">
              Tidak ada tagihan SPP yang menunggak untuk akademi {activeAcademy.name} pada periode siklus bulan ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3">Kelas &amp; Pelatih</th>
                  <th className="py-2.5 px-3">Kontak Wali</th>
                  <th className="py-2.5 px-3">Status Tunggakan</th>
                  <th className="py-2.5 px-3 text-right">Nominal SPP</th>
                  <th className="py-2.5 px-3 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {unpaidStudents.map((st) => {
                  const sppInfo = st.sppInfo || {};
                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => onViewStudentDetail && onViewStudentDetail(st)}
                    >
                      {/* Nama Siswa */}
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-800 hover:text-[#C89D32] transition-colors">
                          {st.studentName || st.name}
                        </p>
                        {st.nikKk && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">NIK: {st.nikKk}</p>
                        )}
                      </td>

                      {/* Kelas & Pelatih */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-[#354944]/10 text-[#354944] font-bold text-[10px] rounded-md inline-block">
                          {st.className || 'Reguler'}
                        </span>
                        {st.coachName && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Pelatih: <strong className="text-slate-600">{st.coachName}</strong>
                          </p>
                        )}
                      </td>

                      {/* Kontak Wali */}
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-700">{st.parentName || 'Orang Tua'}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {st.parentPhone || st.phone || '-'}
                        </p>
                      </td>

                      {/* Status Tunggakan */}
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase inline-block ${sppInfo.badgeClass || 'bg-rose-100 text-rose-800'}`}>
                          {sppInfo.statusText || 'MENUNGGAK'}
                        </span>
                      </td>

                      {/* Nominal SPP */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-bold text-rose-600 block">
                          {formatRupiah(st.monthlyFee || st.tuitionFee)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium uppercase">Per Bulan</span>
                      </td>

                      {/* Aksi Cepat: Tagih via WA & Bayar */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* TOMBOL TAGIH VIA WHATSAPP */}
                          <button
                            type="button"
                            onClick={() => handleSendWABilling(st, activeAcademy?.name)}
                            className="flex items-center gap-1 bg-green-50 text-green-700 hover:bg-green-100 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-green-200 transition-colors cursor-pointer shadow-2xs"
                            title="Kirim Tagihan SPP via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <span>Tagih via WA</span>
                          </button>

                          {/* TOMBOL BAYAR SEKARANG (OPSIONAL) */}
                          {onPaySpp && (
                            <button
                              type="button"
                              onClick={() => onPaySpp(st)}
                              className="px-2.5 py-1 bg-[#354944] text-white hover:bg-[#2B3D38] rounded-lg text-[11px] font-bold border-b-2 border-[#C89D32] transition-colors cursor-pointer shadow-2xs"
                              title="Bayar SPP Sekarang"
                            >
                              Bayar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
