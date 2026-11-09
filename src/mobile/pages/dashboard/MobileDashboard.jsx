import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  DollarSign, 
  Calendar, 
  CreditCard, 
  GraduationCap, 
  Users, 
  Trophy, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  Plus, 
  CheckCircle2, 
  Building2, 
  TrendingUp,
  Activity,
  Receipt
} from 'lucide-react';
import { supabase } from '../../../config/supabase';
import useArenaData from '../../../hooks/useArenaData';
import useUserAccessScope from '../../../hooks/useUserAccessScope';
import { classifyTransactionDivision } from '../../../pages/DashboardPage';
import MobileCard from '../../components/MobileCard';
import MobileBadge from '../../components/MobileBadge';
import MobileAvatar from '../../components/MobileAvatar';
import MobileSectionHeader from '../../components/MobileSectionHeader';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileLoadingState from '../../components/MobileLoadingState';

// Helper Currency Formatter
function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

// Helper Date Parser
function parseTxDate(raw) {
  if (!raw) return new Date();
  if (raw.seconds) return new Date(raw.seconds * 1000);
  if (raw instanceof Date) return raw;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * MobileDashboard Component
 * Dedicated Mobile Dashboard for CHUVATOR Sports Management Application.
 * Scoped under .chua-mobile-app
 */
export default function MobileDashboard({ userProfile }) {
  const userAccess = useUserAccessScope(userProfile);
  const { tenantProfile, courts, bookings, transactions, isLoading } = useArenaData(userProfile);

  const [academyCounts, setAcademyCounts] = useState({ students: 0, coaches: 0, classes: 0 });
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'schedule' | 'recent'

  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;
  const tenant = tenantProfile || userProfile?.tenant;
  const tenantName = tenant?.name || 'TAWANG FOOTBALL CLUB';

  // Role Display Label
  const roleDisplay = 
    userProfile?.role === 'superadmin' ? 'Super Admin' :
    userProfile?.role === 'owner' ? 'Owner GOR' :
    userProfile?.role === 'admin' ? 'Admin Staf' :
    userAccess.isCoach ? 'Pelatih Akademi' : 'Staf';

  // On-Demand Supabase Academy Counts
  useEffect(() => {
    if (!tenantId) return;

    const fetchCounts = async () => {
      try {
        const activeAcId = localStorage.getItem('activeAcademyId');
        let studQuery = supabase.from('students').select('id, academy_id').eq('tenant_id', tenantId);
        let coachQuery = supabase.from('coaches').select('id, academy_id').eq('tenant_id', tenantId);
        let clsQuery = supabase
          .from('academy_classes')
          .select('id, academy_id')
          .eq('tenant_id', tenantId)
          .or('is_archived.is.null,is_archived.eq.false');

        if (activeAcId) {
          studQuery = studQuery.eq('academy_id', activeAcId);
          coachQuery = coachQuery.eq('academy_id', activeAcId);
          clsQuery = clsQuery.eq('academy_id', activeAcId);
        }

        const [sRes, cRes, clRes] = await Promise.all([studQuery, coachQuery, clsQuery]);
        setAcademyCounts({
          students: sRes.data?.length || 0,
          coaches: cRes.data?.length || 0,
          classes: clRes.data?.length || 0,
        });
      } catch (err) {
        console.warn('MobileDashboard: Failed to fetch academy counts:', err);
      }
    };

    fetchCounts();
  }, [tenantId]);

  // Merge and sort transactions for today & recent list
  const allMergedTransactions = useMemo(() => {
    const txList = (transactions || []).map((t) => {
      const parsedDate = parseTxDate(t.createdAt);
      const division = classifyTransactionDivision(t);
      return {
        id: t.id ? `TX-${t.id.slice(0, 8).toUpperCase()}` : 'TX-POS',
        rawId: t.id,
        dateObj: parsedDate,
        dateFormatted: parsedDate.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
        }),
        timeFormatted: parsedDate.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        title: t.itemName || t.title || 'Transaksi Kasir POS',
        amount: Number(t.amount || 0),
        division,
        paymentMethod: t.paymentMethod || 'QRIS / Cash',
        status: t.status || 'success',
      };
    });

    const bookingTxList = (bookings || [])
      .filter((b) => b.paymentStatus === 'Lunas' || b.status === 'Confirmed')
      .map((b) => {
        const parsedDate = b.createdAt ? parseTxDate(b.createdAt) : parseTxDate(b.bookingDate || b.date);
        return {
          id: b.id ? `BK-${b.id.slice(0, 8).toUpperCase()}` : 'BK-LAP',
          rawId: b.id,
          dateObj: parsedDate,
          dateFormatted: parsedDate.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
          }),
          timeFormatted: parsedDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          title: `Booking ${b.courtName || `Lapangan ${b.courtNumber || 1}`}`,
          amount: Number(b.price || b.amount || 0),
          division: 'Court/Booking',
          paymentMethod: b.paymentMethod || 'QRIS / Transfer',
          status: 'success',
        };
      });

    return [...txList, ...bookingTxList].sort((a, b) => b.dateObj - a.dateObj);
  }, [transactions, bookings]);

  // Today's metrics calculation
  const todayFinancials = useMemo(() => {
    const today = new Date();
    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const todayTxs = allMergedTransactions.filter((tx) =>
      isSameDay(tx.dateObj, today) && tx.status !== 'pending_clearing' && tx.status !== 'failed'
    );

    const totalRevenue = todayTxs.reduce((sum, tx) => sum + tx.amount, 0);

    let courtRev = 0;
    let posRev = 0;
    let sppRev = 0;

    todayTxs.forEach((tx) => {
      if (tx.division === 'Court/Booking') courtRev += tx.amount;
      else if (tx.division === 'Academy/SPP') sppRev += tx.amount;
      else posRev += tx.amount;
    });

    const todayBookingsCount = (bookings || []).filter((b) => {
      const bDate = b.bookingDate ? new Date(b.bookingDate) : new Date();
      return isSameDay(bDate, today);
    }).length;

    return {
      totalRevenue,
      courtRev,
      posRev,
      sppRev,
      todayCount: todayTxs.length,
      todayBookingsCount,
      todayList: todayTxs,
    };
  }, [allMergedTransactions, bookings]);

  // Today's Bookings Schedule List
  const todayScheduleList = useMemo(() => {
    const today = new Date();
    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    return (bookings || [])
      .filter((b) => {
        const bDate = b.bookingDate ? new Date(b.bookingDate) : parseTxDate(b.createdAt);
        return isSameDay(bDate, today);
      })
      .map((b) => ({
        id: b.id,
        courtName: b.courtName || `Lapangan ${b.courtNumber || 1}`,
        customerName: b.customerName || 'Pelanggan GOR',
        time: `${b.startTime || '08:00'} - ${b.endTime || '09:00'}`,
        status: b.paymentStatus || b.status || 'Confirmed',
        price: Number(b.price || b.amount || 0),
      }))
      .slice(0, 5);
  }, [bookings]);

  if (isLoading) {
    return <MobileLoadingState message="Memuat dasbor operasional..." />;
  }

  return (
    <div className="space-y-4">
      {/* A. WELCOME HEADER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <MobileAvatar
            src={userProfile?.photoURL}
            name={userProfile?.displayName || 'User'}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-sm text-slate-800 truncate my-0">
                Halo, {userProfile?.displayName || 'Manager'}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 truncate my-0.5">
              {tenantName}
            </p>
            <MobileBadge variant="blue" className="text-[9px] px-2 py-0.5">
              {roleDisplay}
            </MobileBadge>
          </div>
        </div>

        <Link
          to="/pengaturan?tab=profil"
          className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors shrink-0"
          title="Pengaturan"
        >
          <Building2 className="w-4 h-4 text-[var(--chua-m-blue)]" />
        </Link>
      </div>

      {/* B. TODAY'S OVERVIEW PROMINENT CARD */}
      {!userAccess.isCoachOnly && (
        <div className="chua-mobile-card-navy p-4 rounded-2xl shadow-md space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-emerald-300 shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-300" />
              </div>
              <span className="text-xs font-bold tracking-wider uppercase text-slate-200">
                Pendapatan Hari Ini
              </span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              {todayFinancials.todayCount} Transaksi
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight my-0 font-mono text-white">
              {formatRupiah(todayFinancials.totalRevenue)}
            </h1>
            <p className="text-[11px] mt-1.5 my-0 text-slate-300">
              Sewa Lapangan: <strong className="font-bold text-white">{formatRupiah(todayFinancials.courtRev)}</strong> &bull; POS: <strong className="font-bold text-white">{formatRupiah(todayFinancials.posRev)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* C. KPI SUMMARY GRID */}
      <div className="grid grid-cols-2 gap-3">
        <MobileCard className="p-3.5 space-y-1 my-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Siswa Akademi
            </span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-slate-800 my-0 font-mono">
            {academyCounts.students} <span className="text-xs font-normal text-slate-400">Siswa</span>
          </p>
          <span className="text-[10px] text-purple-600 font-semibold block">
            {academyCounts.classes} Kelas Aktif
          </span>
        </MobileCard>

        <MobileCard className="p-3.5 space-y-1 my-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Sesi Lapangan
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-[var(--chua-m-blue)] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-slate-800 my-0 font-mono">
            {todayFinancials.todayBookingsCount} <span className="text-xs font-normal text-slate-400">Sesi</span>
          </p>
          <span className="text-[10px] text-[var(--chua-m-blue)] font-semibold block">
            {courts?.length || 0} Lapangan GOR
          </span>
        </MobileCard>
      </div>

      {/* D. QUICK ACTIONS */}
      <div>
        <MobileSectionHeader title="Akses Cepat Operasional" />
        <div className="grid grid-cols-2 gap-2.5">
          {!userAccess.isCoachOnly && (
            <Link
              to="/booking"
              className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 transition-all shadow-2xs text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[var(--chua-m-blue)] flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs text-slate-800 block truncate">
                  Booking Lapangan
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Jadwal &amp; Slot
                </span>
              </div>
            </Link>
          )}

          {!userAccess.isCoachOnly && (
            <Link
              to="/kasir"
              className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 transition-all shadow-2xs text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[var(--chua-m-emerald)] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs text-slate-800 block truncate">
                  Kasir POS
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  F&amp;B &amp; Retail
                </span>
              </div>
            </Link>
          )}

          <Link
            to="/akademi?tab=siswa"
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 transition-all shadow-2xs text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-slate-800 block truncate">
                Siswa &amp; SPP
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Status Tagihan
              </span>
            </div>
          </Link>

          <Link
            to="/akademi?tab=presensi"
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 transition-all shadow-2xs text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-slate-800 block truncate">
                Presensi &amp; Evaluasi
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Sesi Latihan
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* E. TODAY'S SCHEDULE */}
      <div>
        <MobileSectionHeader
          title="Jadwal Hari Ini"
          actionLabel="Lihat Semua"
          onAction={() => window.location.assign('/booking')}
        />

        {todayScheduleList.length === 0 ? (
          <MobileEmptyState
            title="Belum Ada Jadwal Booking Hari Ini"
            description="Slot lapangan hari ini masih kosong atau belum ada pemesanan terdata."
          />
        ) : (
          <div className="space-y-2">
            {todayScheduleList.map((item) => (
              <MobileCard key={item.id} className="p-3 my-0 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[var(--chua-m-blue)] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-800 truncate my-0">
                      {item.courtName} &bull; {item.customerName}
                    </h4>
                    <p className="text-[11px] text-slate-500 my-0.5">
                      {item.time}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold text-xs text-slate-800 block font-mono">
                    {formatRupiah(item.price)}
                  </span>
                  <MobileBadge
                    variant={item.status === 'Lunas' || item.status === 'Confirmed' ? 'emerald' : 'warning'}
                    className="text-[9px] px-1.5 py-0.2"
                  >
                    {item.status}
                  </MobileBadge>
                </div>
              </MobileCard>
            ))}
          </div>
        )}
      </div>

      {/* F. RECENT TRANSACTIONS ACTIVITY */}
      {!userAccess.isCoachOnly && (
        <div>
          <MobileSectionHeader title="Aktivitas Transaksi Terkini" />
          {allMergedTransactions.length === 0 ? (
            <MobileEmptyState
              title="Belum Ada Transaksi"
              description="Riwayat transaksi kasir dan booking akan otomatis muncul di sini."
            />
          ) : (
            <div className="space-y-2">
              {allMergedTransactions.slice(0, 5).map((tx, idx) => (
                <MobileCard key={tx.rawId || idx} className="p-3 my-0 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-[var(--chua-m-blue)]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-800 truncate my-0">
                        {tx.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 my-0.5">
                        {tx.dateFormatted} &bull; {tx.timeFormatted} &bull; {tx.paymentMethod}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs text-emerald-600 block font-mono">
                      +{formatRupiah(tx.amount)}
                    </span>
                    <MobileBadge variant="neutral" className="text-[9px] px-1.5 py-0.2">
                      {tx.division}
                    </MobileBadge>
                  </div>
                </MobileCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
