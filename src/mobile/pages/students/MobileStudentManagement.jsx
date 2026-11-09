import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  GraduationCap, 
  Search, 
  Filter, 
  Plus, 
  User, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  MessageCircle, 
  CreditCard, 
  IdCard, 
  Edit3, 
  ChevronRight, 
  Building2, 
  X, 
  RefreshCw,
  Users,
  Award
} from 'lucide-react';
import { supabase } from '../../../config/supabase';
import supabaseAcademyService, { 
  mapStudentFromSupabase, 
  mapClassFromSupabase 
} from '../../../services/supabaseAcademyService';
import useArenaData from '../../../hooks/useArenaData';
import useUserAccessScope from '../../../hooks/useUserAccessScope';
import { calculateAge, getStudentInitials } from '../../../utils/helpers';
import { calculateSppStatus, formatWhatsAppNumber } from '../../../pages/AcademyPage';

import MobileCard from '../../components/MobileCard';
import MobileBadge from '../../components/MobileBadge';
import MobileAvatar from '../../components/MobileAvatar';
import MobileSectionHeader from '../../components/MobileSectionHeader';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobilePrimaryButton from '../../components/MobilePrimaryButton';
import MobileSecondaryButton from '../../components/MobileSecondaryButton';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileLoadingState from '../../components/MobileLoadingState';
import MobileBottomSheet from '../../components/MobileBottomSheet';

import StudentDetailModal from '../../../components/StudentDetailModal';
import StudentRegistrationModal from '../../../components/StudentRegistrationModal';
import SppPaymentModal from '../../../components/SppPaymentModal';
import IdCardGenerator from '../../../components/IdCardGenerator';

/**
 * MobileStudentManagement Component
 * Mobile-First Student Management for CHUVATOR Sports Management Application.
 * Scoped strictly under .chua-mobile-app
 */
export default function MobileStudentManagement({ userProfile }) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;
  const userAccess = useUserAccessScope(userProfile);
  const { isCoachOnly, coachProfile, isOwner, isSuperAdmin } = userAccess;

  const { tenantProfile } = useArenaData(userProfile);
  const arenaName = tenantProfile?.name || 'Chua Sports Arena';
  const sppBillingStartDay = tenantProfile?.sppBillingStartDay ?? 1;
  const sppDueDay = tenantProfile?.sppDueDay ?? 10;

  // Workspace Academies & Active Workspace State
  const [academies, setAcademies] = useState([]);
  const [activeAcademyId, setActiveAcademyId] = useState(() => {
    return localStorage.getItem('activeAcademyId') || '';
  });

  // Data States
  const [students, setStudents] = useState([]);
  const [academyClasses, setAcademyClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [sppFilter, setSppFilter] = useState('all'); // 'all' | 'lunas' | 'tunggakan'
  const [selectedClassFilter, setSelectedClassFilter] = useState(''); // '' for all classes
  const [showFilterBottomSheet, setShowFilterBottomSheet] = useState(false);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [detailModalStudent, setDetailModalStudent] = useState(null);
  const [paymentModalStudent, setPaymentModalStudent] = useState(null);
  const [idCardTarget, setIdCardTarget] = useState(null); // { data, role: 'SISWA' }

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Academies, Classes, and Students
  const fetchAllData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [acadList, classList, studList] = await Promise.all([
        supabaseAcademyService.getAcademies(tenantId),
        supabaseAcademyService.getClasses(tenantId),
        supabaseAcademyService.getStudents(tenantId)
      ]);

      setAcademies(acadList || []);
      setAcademyClasses(classList || []);
      setStudents(studList || []);

      if (acadList && acadList.length > 0) {
        let targetId = activeAcademyId;
        if (isCoachOnly && coachProfile?.academy_id) {
          targetId = coachProfile.academy_id;
        } else {
          const stored = localStorage.getItem('activeAcademyId');
          const found = acadList.find((a) => a.id === stored);
          targetId = found ? found.id : acadList[0].id;
        }
        setActiveAcademyId(targetId);
        localStorage.setItem('activeAcademyId', targetId);
      }
    } catch (err) {
      console.error('Error fetching mobile student data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, activeAcademyId, isCoachOnly, coachProfile?.academy_id]);

  useEffect(() => {
    fetchAllData();
  }, [tenantId]);

  // Current Active Workspace Academy
  const activeAcademy = useMemo(() => {
    return academies.find((a) => a.id === activeAcademyId) || (academies.length > 0 ? academies[0] : null);
  }, [academies, activeAcademyId]);

  // Filtered Students for Active Workspace
  const workspaceStudents = useMemo(() => {
    if (!activeAcademy) return students;
    return students.filter((s) => s.academyId === activeAcademy.id || s.academy_id === activeAcademy.id);
  }, [activeAcademy, students]);

  // Coach Class Guard Integration
  const activeClasses = useMemo(() => {
    if (!activeAcademy) return academyClasses;
    let list = academyClasses.filter((c) => c.academyId === activeAcademy.id);
    if (isCoachOnly && coachProfile) {
      const cId = coachProfile.id;
      const cEmail = (coachProfile.email || '').toLowerCase();
      const cName = (coachProfile.name || '').toLowerCase();
      list = list.filter((c) => {
        const matchId = cId && (c.coachId === cId || c.coach_id === cId);
        const matchEmail = cEmail && (c.coachEmail?.toLowerCase() === cEmail || c.coach_email?.toLowerCase() === cEmail);
        const matchName = cName && c.coachName && c.coachName.toLowerCase() === cName;
        return Boolean(matchId || matchEmail || matchName);
      });
    }
    return list;
  }, [activeAcademy, academyClasses, isCoachOnly, coachProfile]);

  const accessibleStudents = useMemo(() => {
    if (!isCoachOnly || !coachProfile) return workspaceStudents;
    const allowedClassIds = new Set(activeClasses.map((c) => c.id));
    return workspaceStudents.filter((s) => s.classId && allowedClassIds.has(s.classId));
  }, [workspaceStudents, isCoachOnly, coachProfile, activeClasses]);

  // Apply Search & Filters
  const filteredStudents = useMemo(() => {
    return accessibleStudents.filter((student) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sName = (student.studentName || student.name || '').toLowerCase();
        const pName = (student.parentName || '').toLowerCase();
        const pPhone = (student.parentPhone || student.phone || '').toLowerCase();
        const school = (student.schoolOrigin || '').toLowerCase();
        const className = (student.className || '').toLowerCase();

        const match = sName.includes(q) || pName.includes(q) || pPhone.includes(q) || school.includes(q) || className.includes(q);
        if (!match) return false;
      }

      // 2. SPP Status Filter
      if (sppFilter !== 'all') {
        const sppInfo = calculateSppStatus(student, sppBillingStartDay, sppDueDay);
        if (sppFilter === 'lunas' && !sppInfo.isPaid) return false;
        if (sppFilter === 'tunggakan' && sppInfo.isPaid) return false;
      }

      // 3. Class Filter
      if (selectedClassFilter && student.classId !== selectedClassFilter) {
        return false;
      }

      return true;
    });
  }, [accessibleStudents, searchQuery, sppFilter, selectedClassFilter, sppBillingStartDay, sppDueDay]);

  // Calculate Summary Statistics
  const statsSummary = useMemo(() => {
    let paidCount = 0;
    let overdueCount = 0;
    accessibleStudents.forEach((st) => {
      const info = calculateSppStatus(st, sppBillingStartDay, sppDueDay);
      if (info.isPaid) paidCount++;
      else overdueCount++;
    });

    return {
      total: accessibleStudents.length,
      paidCount,
      overdueCount,
      paidPct: accessibleStudents.length > 0 ? Math.round((paidCount / accessibleStudents.length) * 100) : 0
    };
  }, [accessibleStudents, sppBillingStartDay, sppDueDay]);

  // WhatsApp Penagihan Direct Link Handler
  const handleSendWABilling = (student) => {
    const phone = formatWhatsAppNumber(student?.parentPhone || student?.phone);
    if (!phone) {
      showToast('Nomor telepon orang tua belum terdaftar.');
      return;
    }

    const fee = 'Rp ' + Number(student?.monthlyFee || 350000).toLocaleString('id-ID');
    const targetAcademy = activeAcademy?.name || arenaName || 'Chua Sport Academy';
    const sName = student?.studentName || student?.name || 'Siswa';

    let rekeningText = 'BCA: 123456789 a.n CHUA SPORT';
    if (tenantProfile?.bankAccounts && tenantProfile.bankAccounts.length > 0) {
      const primaryBank = tenantProfile.bankAccounts[0];
      if (primaryBank.bankName && primaryBank.accountNumber) {
        rekeningText = `${primaryBank.bankName}: ${primaryBank.accountNumber} a.n ${primaryBank.accountName || targetAcademy}`;
      }
    } else if (tenantProfile?.bankAccountNumber) {
      rekeningText = `${tenantProfile.bankName || 'Bank'}: ${tenantProfile.bankAccountNumber} a.n ${tenantProfile.bankAccountName || targetAcademy}`;
    }

    const message = `Halo Bapak/Ibu Wali dari *${sName}*,\nKami dari admin *${targetAcademy}* menginformasikan tagihan SPP bulan ini senilai *${fee}* yang belum diselesaikan.\n\nPembayaran via kasir GOR atau transfer:\n${rekeningText}\n\nMohon konfirmasi dengan membalas pesan ini beserta bukti transfer. Terima kasih! 🙏`;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  if (isLoading) {
    return <MobileLoadingState message="Memuat daftar siswa akademi..." />;
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs font-semibold flex items-center justify-between border border-slate-700 animate-in fade-in slide-in-from-top duration-200">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-slate-800 rounded-lg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* A. WORKSPACE ACADEMY & PAGE HEADER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--chua-m-navy)] text-white flex items-center justify-center font-black text-base shadow-xs shrink-0 border border-white/20">
              {activeAcademy?.name ? activeAcademy.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {activeAcademy?.sport || 'General Sports'}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {statsSummary.total} Siswa Terdaftar
                </span>
              </div>
              <h1 className="text-base font-extrabold text-slate-800 truncate my-0">
                {activeAcademy?.name || 'Akademi Olahraga'}
              </h1>
            </div>
          </div>

          {/* Add Student Button (Owner/Admin only) */}
          {!isCoachOnly && (
            <button
              type="button"
              onClick={() => {
                setEditingStudent(null);
                setShowAddModal(true);
              }}
              className="p-2.5 rounded-xl bg-[var(--chua-m-emerald)] hover:opacity-90 text-white font-bold text-xs flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Siswa</span>
            </button>
          )}
        </div>

        {/* Multi-Academy Switcher Dropdown (if more than 1 academy exists) */}
        {academies.length > 1 && !isCoachOnly && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Pilih Workspace:</span>
            <select
              value={activeAcademyId}
              onChange={(e) => {
                const newId = e.target.value;
                setActiveAcademyId(newId);
                localStorage.setItem('activeAcademyId', newId);
              }}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {academies.map((ac) => (
                <option key={ac.id} value={ac.id}>
                  {ac.name} ({ac.sport})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* B. SPP STATUS METRICS CARD */}
      <div className="grid grid-cols-3 gap-2">
        <MobileCard className="p-3 space-y-1 text-center my-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Siswa
          </span>
          <p className="text-base font-black text-slate-800 my-0 font-mono">
            {statsSummary.total}
          </p>
        </MobileCard>

        <MobileCard className="p-3 space-y-1 text-center my-0">
          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">
            SPP Lunas
          </span>
          <p className="text-base font-black text-emerald-600 my-0 font-mono">
            {statsSummary.paidCount} <span className="text-[10px] font-normal text-slate-400">({statsSummary.paidPct}%)</span>
          </p>
        </MobileCard>

        <MobileCard className="p-3 space-y-1 text-center my-0">
          <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider block">
            Menunggak
          </span>
          <p className="text-base font-black text-red-600 my-0 font-mono">
            {statsSummary.overdueCount}
          </p>
        </MobileCard>
      </div>

      {/* C. SEARCH BAR & QUICK FILTERS */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <MobileSearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, ortu, sekolah, kelas..."
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilterBottomSheet(true)}
            className={`p-3 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              selectedClassFilter
                ? 'bg-blue-50 border-blue-300 text-[var(--chua-m-blue)]'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Filter Kelas"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSppFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              sppFilter === 'all'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua ({accessibleStudents.length})
          </button>

          <button
            type="button"
            onClick={() => setSppFilter('lunas')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              sppFilter === 'lunas'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            Lunas ({statsSummary.paidCount})
          </button>

          <button
            type="button"
            onClick={() => setSppFilter('tunggakan')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              sppFilter === 'tunggakan'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
            }`}
          >
            Menunggak ({statsSummary.overdueCount})
          </button>

          {selectedClassFilter && (
            <button
              type="button"
              onClick={() => setSelectedClassFilter('')}
              className="px-2.5 py-1.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 flex items-center gap-1 hover:bg-slate-300 cursor-pointer"
            >
              <span>Kelas: {activeClasses.find((c) => c.id === selectedClassFilter)?.className || 'Selected'}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* D. STUDENT CARD LIST */}
      <div>
        <MobileSectionHeader
          title={`Daftar Siswa (${filteredStudents.length})`}
        />

        {filteredStudents.length === 0 ? (
          <MobileEmptyState
            title="Tidak Ada Siswa Ditemukan"
            description={
              searchQuery || sppFilter !== 'all' || selectedClassFilter
                ? 'Coba ubah kata kunci pencarian atau sesuaikan filter Anda.'
                : 'Belum ada siswa terdaftar pada workspace akademi ini.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredStudents.map((student) => {
              const sppInfo = calculateSppStatus(student, sppBillingStartDay, sppDueDay);
              const age = calculateAge(student.birthDate);

              return (
                <MobileCard key={student.id} className="p-3.5 space-y-3 my-0">
                  {/* Top Row: Avatar & Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <MobileAvatar
                        src={student.photoUrl}
                        name={student.studentName || student.name || 'Siswa'}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-sm text-slate-800 truncate my-0">
                            {student.studentName || student.name}
                          </h3>
                          {age !== '-' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {age} Thn
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate my-0.5">
                          {student.className || 'Belum Ditugaskan Kelas'} &bull; {student.sportCategory || 'Sport'}
                        </p>
                      </div>
                    </div>

                    <MobileBadge
                      variant={sppInfo.isPaid ? 'emerald' : sppInfo.daysOverdue > 0 ? 'warning' : 'neutral'}
                      className={`text-[9px] px-2 py-0.5 shrink-0 ${
                        !sppInfo.isPaid && sppInfo.daysOverdue > 0 ? 'bg-red-100 text-red-800 border-red-200 animate-pulse font-extrabold' : ''
                      }`}
                    >
                      {sppInfo.statusText}
                    </MobileBadge>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Wali Siswa:</span>
                      <strong className="text-slate-700 truncate block font-semibold">
                        {student.parentName || '-'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">No. WhatsApp:</span>
                      <strong className="text-slate-700 truncate block font-semibold font-mono">
                        {student.parentPhone || student.phone || '-'}
                      </strong>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      {/* Detail Sheet Button */}
                      <button
                        type="button"
                        onClick={() => setDetailModalStudent(student)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[var(--chua-m-blue)] font-bold text-xs flex items-center gap-1 border border-blue-200 cursor-pointer min-h-[36px]"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>

                      {/* WhatsApp Penagihan Direct Link */}
                      {!sppInfo.isPaid && (student.parentPhone || student.phone) && (
                        <button
                          type="button"
                          onClick={() => handleSendWABilling(student)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 border border-emerald-200 cursor-pointer min-h-[36px]"
                          title="Kirim Tagihan SPP via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WA SPP</span>
                        </button>
                      )}

                      {/* ID Card Generator */}
                      <button
                        type="button"
                        onClick={() => setIdCardTarget({ data: student, role: 'SISWA' })}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 cursor-pointer min-h-[36px] min-w-[36px]"
                        title="Cetak ID Card Siswa"
                      >
                        <IdCard className="w-4 h-4 text-purple-600" />
                      </button>
                    </div>

                    {/* Edit Button (Owner/Admin) */}
                    {!isCoachOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStudent(student);
                          setShowAddModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer min-h-[36px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </MobileCard>
              );
            })}
          </div>
        )}
      </div>

      {/* E. FILTER BOTTOM SHEET */}
      <MobileBottomSheet
        isOpen={showFilterBottomSheet}
        onClose={() => setShowFilterBottomSheet(false)}
        title="Filter Kelas Siswa"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 my-0">
            Pilih kelas untuk menyaring daftar siswa yang ditampilkan:
          </p>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedClassFilter('');
                setShowFilterBottomSheet(false);
              }}
              className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer border ${
                selectedClassFilter === ''
                  ? 'bg-blue-50 border-blue-300 text-[var(--chua-m-blue)]'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Semua Kelas</span>
              {selectedClassFilter === '' && <CheckCircle2 className="w-4 h-4 text-[var(--chua-m-blue)]" />}
            </button>

            {activeClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => {
                  setSelectedClassFilter(cls.id);
                  setShowFilterBottomSheet(false);
                }}
                className={`w-full p-3 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer border ${
                  selectedClassFilter === cls.id
                    ? 'bg-blue-50 border-blue-300 text-[var(--chua-m-blue)]'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="block">{cls.className}</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    Pelatih: {cls.coachName || 'Belum Ditugaskan'} &bull; Usia: {cls.minAge}-{cls.maxAge} Thn
                  </span>
                </div>
                {selectedClassFilter === cls.id && <CheckCircle2 className="w-4 h-4 text-[var(--chua-m-blue)]" />}
              </button>
            ))}
          </div>

          <MobileSecondaryButton
            onClick={() => setShowFilterBottomSheet(false)}
            className="w-full mt-2"
          >
            Tutup
          </MobileSecondaryButton>
        </div>
      </MobileBottomSheet>

      {/* F. STUDENT REGISTRATION / EDIT MODAL */}
      <StudentRegistrationModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingStudent(null);
        }}
        tenantId={tenantId}
        activeAcademyId={activeAcademy?.id || activeAcademyId}
        studentToEdit={editingStudent}
        onStudentSaved={() => {
          setShowAddModal(false);
          setEditingStudent(null);
          showToast('Data siswa berhasil disimpan!');
          fetchAllData();
        }}
      />

      {/* G. STUDENT DETAIL MODAL / SHEET */}
      {detailModalStudent && (
        <StudentDetailModal
          isOpen={Boolean(detailModalStudent)}
          onClose={() => setDetailModalStudent(null)}
          student={detailModalStudent}
          userProfile={userProfile}
          academyClasses={activeClasses}
          onEditStudent={(s) => {
            setDetailModalStudent(null);
            setEditingStudent(s);
            setShowAddModal(true);
          }}
          onStudentUpdated={(updated) => {
            setDetailModalStudent(updated);
            fetchAllData();
          }}
          onGenerateIdCard={(s) => {
            setDetailModalStudent(null);
            setIdCardTarget({ data: s, role: 'SISWA' });
          }}
        />
      )}

      {/* H. SPP PAYMENT MODAL */}
      {paymentModalStudent && (
        <SppPaymentModal
          isOpen={Boolean(paymentModalStudent)}
          onClose={() => setPaymentModalStudent(null)}
          student={paymentModalStudent}
          tenantProfile={tenantProfile}
          userProfile={userProfile}
          onPaymentSuccess={() => {
            setPaymentModalStudent(null);
            showToast('Pembayaran SPP berhasil dicatat!');
            fetchAllData();
          }}
        />
      )}

      {/* I. ID CARD GENERATOR MODAL */}
      {idCardTarget && (
        <IdCardGenerator
          isOpen={Boolean(idCardTarget)}
          onClose={() => setIdCardTarget(null)}
          targetData={idCardTarget.data}
          role={idCardTarget.role}
          tenantName={tenantProfile?.name || arenaName}
        />
      )}
    </div>
  );
}
