import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  ClipboardCheck, 
  LayoutDashboard,
  Building2,
  Lock,
  Plus
} from 'lucide-react';

import useArenaData from '../../../hooks/useArenaData';
import useUserAccessScope from '../../../hooks/useUserAccessScope';
import supabaseAcademyService, { mapCoachFromSupabase } from '../../../services/supabaseAcademyService';
import { supabase } from '../../../config/supabase';
import { calculateSppStatus, formatWhatsAppNumber, formatWhatsAppUrl } from '../../../pages/AcademyPage';
import { sortClassesByAgeGroup } from '../../../config/tierCurriculumConfig';
import { isTennisSport } from '../../../config/tennisAssessmentData';
import { updateCoachPassword } from '../../../services/coachAuthService';

// Reusable existing desktop components
import AcademyDashboard from '../../../components/AcademyDashboard';
import AcademyClasses from '../../../components/AcademyClasses';
import AttendanceSection from '../../../components/AttendanceSection';
import EvaluationSection from '../../../components/EvaluationSection';
import GrowthTrackerSection from '../../../components/GrowthTrackerSection';
import CoachModal from '../../../components/CoachModal';
import ClassModal from '../../../components/ClassModal';
import CreateAcademyModal from '../../../components/CreateAcademyModal';
import LockScheduleModal from '../../../components/LockScheduleModal';

// Dedicated mobile student management
import MobileStudentManagement from '../students/MobileStudentManagement';
import App3DMobileIcon from '../../components/App3DMobileIcon';

/**
 * MobileAcademyHub Component
 * Unified, single-navigation Mobile Presentation for Akademi Module.
 * Fully integrates all 5 tabs: Dasbor, Siswa & SPP, Pelatih, Kelas, Presensi.
 * Scoped strictly under .chua-mobile-app
 */
export default function MobileAcademyHub({ userProfile }) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;
  const accessScope = useUserAccessScope(userProfile);
  const { isCoachOnly, coachProfile, isOwner, isSuperAdmin, role } = accessScope;

  const { tenantProfile, courts } = useArenaData(userProfile);
  const arenaName = tenantProfile?.name || 'Sports Arena';
  const sppBillingStartDay = tenantProfile?.sppBillingStartDay ?? 1;
  const sppDueDay = tenantProfile?.sppDueDay ?? 10;

  const uniqueSports = Array.from(new Set(courts.map((c) => c.sport).filter(Boolean)));

  // Role permissions
  const canManageClasses = useMemo(() => {
    if (Boolean(isSuperAdmin) || Boolean(isOwner)) return true;
    const rawRole = String(role || userProfile?.role || '').toLowerCase().trim();
    return rawRole === 'superadmin' || rawRole === 'owner' || rawRole === 'admin';
  }, [isSuperAdmin, isOwner, role, userProfile?.role]);

  // URL Query Parameters Sync
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['dasbor', 'siswa', 'pelatih', 'kelas', 'presensi'];
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      if (isCoachOnly && (tabParam === 'dasbor' || tabParam === 'siswa' || tabParam === 'pelatih')) {
        return 'kelas';
      }
      return tabParam;
    }
    return isCoachOnly ? 'kelas' : 'dasbor';
  });

  // Keep state synced with URL changes (back/forward buttons)
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      if (isCoachOnly && (tabParam === 'dasbor' || tabParam === 'siswa' || tabParam === 'pelatih')) {
        setActiveTab('kelas');
      } else {
        setActiveTab(tabParam);
      }
    } else if (!tabParam) {
      setActiveTab(isCoachOnly ? 'kelas' : 'dasbor');
    }
  }, [tabParam, isCoachOnly]);

  const handleTabChange = (tab) => {
    if (isCoachOnly && (tab === 'dasbor' || tab === 'siswa' || tab === 'pelatih')) return;
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Academies & Active Workspace
  const [academies, setAcademies] = useState([]);
  const [activeAcademyId, setActiveAcademyId] = useState(() => localStorage.getItem('activeAcademyId') || '');
  const [loadingAcademies, setLoadingAcademies] = useState(true);

  // Data States
  const [students, setStudents] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [academyClasses, setAcademyClasses] = useState([]);
  const [archivedClasses, setArchivedClasses] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [coachesError, setCoachesError] = useState(null);

  // Sub-tabs & modal states
  const [classSubTab, setClassSubTab] = useState('active'); // 'active' | 'archived'
  const [attendanceSubTab, setAttendanceSubTab] = useState('presensi'); // 'presensi' | 'evaluasi' | 'antropometri'
  const [selectedClassId, setSelectedClassId] = useState('');

  // Modals
  const [showCreateAcademyModal, setShowCreateAcademyModal] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [editingCoach, setEditingCoach] = useState(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [generateModalClass, setGenerateModalClass] = useState(null);

  // Coach Self-Service Password Modal
  const [showCoachPasswordModal, setShowCoachPasswordModal] = useState(false);
  const [newCoachPassword, setNewCoachPassword] = useState('');
  const [confirmCoachPassword, setConfirmCoachPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdErr, setPwdErr] = useState(null);

  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch Coaches
  const fetchCoaches = useCallback(async (customAcademyId = null) => {
    if (!tenantId) return;
    const targetAcId = customAcademyId || activeAcademyId || null;
    setLoadingCoaches(true);
    setCoachesError(null);
    try {
      let query = supabase.from('coaches').select('*').eq('tenant_id', tenantId);
      if (targetAcId) {
        query = query.eq('academy_id', targetAcId);
      }
      const { data, error } = await query.order('name', { ascending: true });
      if (error) {
        setCoachesError(error.message);
        setCoaches([]);
      } else {
        setCoaches((data || []).map(mapCoachFromSupabase));
      }
    } catch (err) {
      setCoachesError(err.message);
      setCoaches([]);
    } finally {
      setLoadingCoaches(false);
    }
  }, [tenantId, activeAcademyId]);

  // Fetch Archived Classes
  const fetchArchivedClasses = useCallback(async (targetAcId) => {
    if (!tenantId) return;
    try {
      const acId = targetAcId !== undefined ? targetAcId : activeAcademyId;
      const data = await supabaseAcademyService.getClasses(tenantId, acId, null, { onlyArchived: true });
      setArchivedClasses(data || []);
    } catch (err) {
      console.warn('Error fetching archived classes:', err);
      setArchivedClasses([]);
    }
  }, [tenantId, activeAcademyId]);

  // Unified Fetch Data
  const fetchAllData = useCallback(async () => {
    if (!tenantId) return;
    setLoadingStudents(true);
    setLoadingClasses(true);
    setLoadingAcademies(true);
    try {
      const [studentsData, classesData, academiesData] = await Promise.all([
        supabaseAcademyService.getStudents(tenantId),
        supabaseAcademyService.getClasses(tenantId),
        supabaseAcademyService.getAcademies(tenantId)
      ]);

      setStudents(studentsData || []);
      setAcademyClasses(classesData || []);

      let currentTargetId = activeAcademyId;
      if (academiesData && academiesData.length > 0) {
        setAcademies(academiesData);
        if (isCoachOnly && coachProfile?.academy_id) {
          currentTargetId = coachProfile.academy_id;
        } else {
          const storedId = localStorage.getItem('activeAcademyId');
          const found = academiesData.find((a) => a.id === storedId);
          currentTargetId = found ? found.id : academiesData[0].id;
        }
        setActiveAcademyId(currentTargetId);
        localStorage.setItem('activeAcademyId', currentTargetId);
      }

      await fetchCoaches(currentTargetId);
      await fetchArchivedClasses(currentTargetId);
    } catch (err) {
      console.error('Error fetching mobile academy data:', err);
    } finally {
      setLoadingStudents(false);
      setLoadingClasses(false);
      setLoadingAcademies(false);
    }
  }, [tenantId, activeAcademyId, isCoachOnly, coachProfile?.academy_id, fetchCoaches, fetchArchivedClasses]);

  useEffect(() => {
    fetchAllData();
  }, [tenantId]);

  // Active Academy
  const activeAcademy = useMemo(() => {
    return academies.find((a) => a.id === activeAcademyId) || (academies.length > 0 ? academies[0] : null);
  }, [academies, activeAcademyId]);

  const isCurrentAcademyTennis = useMemo(() => {
    return isTennisSport(null, activeAcademy);
  }, [activeAcademy]);

  // Active Coaches
  const activeCoaches = useMemo(() => {
    if (!activeAcademy) return coaches;
    return coaches.filter((c) => {
      const cAcId = c.academyId || c.academy_id;
      if (!cAcId) return true;
      return String(cAcId).toLowerCase() === String(activeAcademy.id).toLowerCase();
    });
  }, [activeAcademy, coaches]);

  // Active Classes
  const activeClasses = useMemo(() => {
    if (!activeAcademy) return [];
    let rawList = academyClasses
      .filter((c) => c.academyId === activeAcademy.id)
      .map((c) => {
        if (isCurrentAcademyTennis && (!c.sport || c.sport.toLowerCase() === 'badminton' || !c.sport.toLowerCase().includes('tenis'))) {
          return { ...c, sport: 'Tenis' };
        }
        return c;
      });

    if (isCoachOnly) {
      if (!coachProfile) return [];
      const cId = coachProfile.id;
      const cEmail = coachProfile.email ? coachProfile.email.toLowerCase() : '';
      const cName = coachProfile.name ? coachProfile.name.toLowerCase() : '';

      rawList = rawList.filter((c) => {
        const coachIdMatch = cId && (c.coachId === cId || c.coach_id === cId);
        const coachEmailMatch = cEmail && (c.coachEmail?.toLowerCase() === cEmail || c.coach_email?.toLowerCase() === cEmail);
        const coachNameMatch = cName && c.coachName && c.coachName.toLowerCase() === cName;
        return Boolean(coachIdMatch || coachEmailMatch || coachNameMatch);
      });
    }

    return sortClassesByAgeGroup(rawList);
  }, [activeAcademy, academyClasses, isCurrentAcademyTennis, isCoachOnly, coachProfile]);

  // Active Archived Classes
  const activeArchivedClasses = useMemo(() => {
    if (!activeAcademy) return [];
    let rawList = archivedClasses.filter((c) => c.academyId === activeAcademy.id);
    if (isCoachOnly) {
      if (!coachProfile) return [];
      const cId = coachProfile.id;
      const cEmail = coachProfile.email ? coachProfile.email.toLowerCase() : '';
      const cName = coachProfile.name ? coachProfile.name.toLowerCase() : '';

      rawList = rawList.filter((c) => {
        const coachIdMatch = cId && (c.coachId === cId || c.coach_id === cId);
        const coachEmailMatch = cEmail && (c.coachEmail?.toLowerCase() === cEmail || c.coach_email?.toLowerCase() === cEmail);
        const coachNameMatch = cName && c.coachName && c.coachName.toLowerCase() === cName;
        return Boolean(coachIdMatch || coachEmailMatch || coachNameMatch);
      });
    }
    return sortClassesByAgeGroup(rawList);
  }, [activeAcademy, archivedClasses, isCoachOnly, coachProfile]);

  // Active Students
  const rawActiveStudents = activeAcademy ? students.filter((s) => s.academyId === activeAcademy.id) : [];
  const activeStudents = useMemo(() => {
    if (!isCoachOnly || !coachProfile) return rawActiveStudents;
    const allowedClassIds = new Set([...activeClasses, ...activeArchivedClasses].map((c) => c.id));
    return rawActiveStudents.filter((s) => s.classId && allowedClassIds.has(s.classId));
  }, [rawActiveStudents, isCoachOnly, coachProfile, activeClasses, activeArchivedClasses]);

  // Attendance Classes
  const attendanceClasses = useMemo(() => {
    const activeList = activeClasses.map((cls) => ({ ...cls, isArchived: false }));
    const archivedList = activeArchivedClasses.map((cls) => ({ ...cls, isArchived: true }));
    return {
      active: activeList,
      archived: archivedList,
      all: [...activeList, ...archivedList]
    };
  }, [activeClasses, activeArchivedClasses]);

  // Auto-select first class if none selected
  useEffect(() => {
    const allAvailable = attendanceClasses.all;
    if (allAvailable.length > 0) {
      const isValid = allAvailable.some((c) => c.id === selectedClassId);
      if (!isValid) {
        setSelectedClassId(activeClasses.length > 0 ? activeClasses[0].id : allAvailable[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [activeAcademyId, activeClasses, activeArchivedClasses, selectedClassId, attendanceClasses.all]);

  const selectedClass = useMemo(() => {
    return attendanceClasses.all.find((c) => c.id === selectedClassId) || null;
  }, [attendanceClasses.all, selectedClassId]);

  // Handlers for Class Management
  const handleOpenCreateClass = () => {
    if (!canManageClasses) {
      setErrorMsg('Akses ditolak: Hanya Owner, Admin, atau Superadmin yang memiliki izin membuat kelas baru.');
      setTimeout(() => setErrorMsg(null), 3500);
      return;
    }
    setEditingClass(null);
    setShowClassModal(true);
  };

  const handleEditClass = (classData) => {
    if (!canManageClasses) {
      setErrorMsg('Akses ditolak: Hanya Owner, Admin, atau Superadmin yang memiliki izin mengedit kelas.');
      setTimeout(() => setErrorMsg(null), 3500);
      return;
    }
    setEditingClass(classData);
    setShowClassModal(true);
  };

  const handleArchiveClass = async (classId, className = 'kelas ini') => {
    if (!canManageClasses) return;
    if (!window.confirm(`Yakin ingin mengarsipkan "${className}"?`)) return;
    try {
      await supabaseAcademyService.archiveClass(classId);
      setSuccessMsg(`Kelas "${className}" berhasil diarsipkan.`);
      fetchAllData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengarsipkan kelas.');
      setTimeout(() => setErrorMsg(null), 3500);
    }
  };

  const handleUnarchiveClass = async (classId, className = 'kelas ini') => {
    if (!canManageClasses) return;
    if (!window.confirm(`Yakin ingin memulihkan "${className}"?`)) return;
    try {
      await supabaseAcademyService.unarchiveClass(classId);
      setSuccessMsg(`Kelas "${className}" berhasil dipulihkan.`);
      fetchAllData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memulihkan kelas.');
      setTimeout(() => setErrorMsg(null), 3500);
    }
  };

  // WhatsApp Billing Handler
  const handleSendWABilling = (student) => {
    const phone = formatWhatsAppNumber(student?.parentPhone || student?.phone);
    if (!phone) return;
    const fee = 'Rp ' + Number(student?.monthlyFee || 350000).toLocaleString('id-ID');
    const targetAcademy = activeAcademy?.name || arenaName || 'Chua Sport Academy';
    const sName = student?.studentName || student?.name || 'Siswa';

    let rekeningText = 'Transfer ke Rekening Kasir / Admin Arena';
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

  // Coach Self-Service Password Handler
  const handleUpdateSelfPassword = async (e) => {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);
    if (!newCoachPassword || newCoachPassword.length < 6) {
      setPwdErr('Password baru minimal 6 karakter.');
      return;
    }
    if (newCoachPassword !== confirmCoachPassword) {
      setPwdErr('Konfirmasi password tidak cocok.');
      return;
    }
    setUpdatingPassword(true);
    try {
      await updateCoachPassword(newCoachPassword);
      setPwdMsg('Password berhasil diperbarui! Silakan gunakan password baru pada login berikutnya.');
      setNewCoachPassword('');
      setConfirmCoachPassword('');
      setTimeout(() => {
        setShowCoachPasswordModal(false);
        setPwdMsg(null);
      }, 2500);
    } catch (err) {
      setPwdErr(err.message || 'Gagal mengubah password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-bold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* TOP HEADER: WORKSPACE INFO & SELECTOR */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
              <App3DMobileIcon name="akademi" className="w-8 h-8" alt={activeAcademy?.name || 'Akademi'} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {activeAcademy?.sport || 'General Sports'}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {activeStudents.length} Siswa &bull; {activeClasses.length} Kelas
                </span>
              </div>
              <h2 className="text-sm font-extrabold text-slate-800 truncate my-0">
                {activeAcademy?.name || 'Akademi Olahraga'}
              </h2>
            </div>
          </div>

          {/* Action buttons */}
          {isCoachOnly ? (
            <button
              type="button"
              onClick={() => {
                setPwdErr(null);
                setPwdMsg(null);
                setShowCoachPasswordModal(true);
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
              title="Ganti Password"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Password</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateAcademyModal(true)}
              className="p-2 rounded-xl bg-[var(--chua-m-navy)] text-white font-bold text-xs flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Akademi</span>
            </button>
          )}
        </div>

        {/* Dropdown Workspace Switcher */}
        {academies.length > 1 && !isCoachOnly && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Workspace:</span>
            <select
              value={activeAcademyId}
              onChange={(e) => {
                const newId = e.target.value;
                setActiveAcademyId(newId);
                localStorage.setItem('activeAcademyId', newId);
                fetchCoaches(newId);
                fetchArchivedClasses(newId);
              }}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none max-w-[200px] truncate"
            >
              {academies.map((ac) => (
                <option key={ac.id} value={ac.id}>
                  {ac.name} ({ac.sport || 'Umum'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SINGLE PRIMARY MOBILE NAVIGATION (5 TABS) */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
        {!isCoachOnly && (
          <button
            type="button"
            onClick={() => handleTabChange('dasbor')}
            className={`flex-1 min-w-[76px] py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'dasbor'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <App3DMobileIcon name="ai_insight" active={activeTab === 'dasbor'} className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Dasbor</span>
          </button>
        )}

        {!isCoachOnly && (
          <button
            type="button"
            onClick={() => handleTabChange('siswa')}
            className={`flex-1 min-w-[76px] py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'siswa'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <App3DMobileIcon name="siswa" active={activeTab === 'siswa'} className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Siswa</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => handleTabChange('kelas')}
          className={`flex-1 min-w-[76px] py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'kelas'
              ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <App3DMobileIcon name="booking" active={activeTab === 'kelas'} className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Kelas</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('presensi')}
          className={`flex-1 min-w-[76px] py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'presensi'
              ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <App3DMobileIcon name="presensi" active={activeTab === 'presensi'} className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Presensi</span>
        </button>

        {!isCoachOnly && (
          <button
            type="button"
            onClick={() => handleTabChange('pelatih')}
            className={`flex-1 min-w-[76px] py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pelatih'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <App3DMobileIcon name="staf_pelatih" active={activeTab === 'pelatih'} className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Pelatih</span>
          </button>
        )}
      </div>

      {/* ==================================================== */}
      {/* TAB CONTENT 1: DASBOR AKADEMI (DATA AKTUAL) */}
      {/* ==================================================== */}
      {activeTab === 'dasbor' && !isCoachOnly && (
        <div>
          <AcademyDashboard
            activeAcademy={activeAcademy}
            activeStudents={activeStudents}
            activeClasses={activeClasses}
            activeCoaches={activeCoaches}
            sppBillingStartDay={sppBillingStartDay}
            sppDueDay={sppDueDay}
            calculateSppStatus={calculateSppStatus}
            handleSendWABilling={handleSendWABilling}
            onAddStudent={() => handleTabChange('siswa')}
            onAddClass={handleOpenCreateClass}
            onPaySpp={() => handleTabChange('siswa')}
            onViewStudentDetail={() => handleTabChange('siswa')}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB CONTENT 2: SISWA & SPP */}
      {/* ==================================================== */}
      {activeTab === 'siswa' && !isCoachOnly && (
        <div>
          <MobileStudentManagement userProfile={userProfile} />
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB CONTENT 3: KELAS & JADWAL (DATA AKTUAL) */}
      {/* ==================================================== */}
      {activeTab === 'kelas' && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          {/* Sub-header: Toggle Kelas Aktif / Arsip & Buat Kelas */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setClassSubTab('active')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  classSubTab === 'active'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Aktif ({activeClasses.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setClassSubTab('archived');
                  fetchArchivedClasses();
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  classSubTab === 'archived'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Arsip ({activeArchivedClasses.length})
              </button>
            </div>

            {canManageClasses && classSubTab === 'active' && (
              <button
                type="button"
                onClick={handleOpenCreateClass}
                className="px-2.5 py-1.5 bg-[var(--chua-m-emerald)] hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Kelas</span>
              </button>
            )}
          </div>

          {/* Render Actual AcademyClasses List */}
          {(classSubTab === 'active' ? loadingClasses : false) ? (
            <p className="py-8 text-center text-xs text-slate-500 font-medium">Memuat data kelas...</p>
          ) : (classSubTab === 'active' ? activeClasses : activeArchivedClasses).length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl p-4 space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700 my-0">
                {classSubTab === 'active' ? 'Belum Ada Kelas Latihan Aktif' : 'Belum Ada Kelas yang Diarsipkan'}
              </p>
              <p className="text-[11px] text-slate-400 my-0">
                {canManageClasses && classSubTab === 'active'
                  ? 'Klik tombol "+ Kelas" di atas untuk menambahkan kelompok latihan.'
                  : 'Kelas akademi akan otomatis muncul setelah ditambahkan oleh admin.'}
              </p>
            </div>
          ) : (
            <AcademyClasses
              classes={classSubTab === 'active' ? activeClasses : activeArchivedClasses}
              classSubTab={classSubTab}
              canManageClasses={canManageClasses}
              onEditClass={handleEditClass}
              onArchiveClass={handleArchiveClass}
              onUnarchiveClass={handleUnarchiveClass}
              onOpenGenerateSchedule={(cls) => setGenerateModalClass(cls)}
              students={activeStudents}
              tenantId={tenantId}
            />
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB CONTENT 4: PRESENSI, EVALUASI & GROWTH (DATA AKTUAL) */}
      {/* ==================================================== */}
      {activeTab === 'presensi' && (
        <div className="space-y-3">
          {/* Sub-tab Pill Navigation */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setAttendanceSubTab('presensi')}
                className={`py-1.5 px-1 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                  attendanceSubTab === 'presensi'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <App3DMobileIcon name="presensi" className="w-3.5 h-3.5 shrink-0" />
                <span>Presensi</span>
              </button>
              <button
                type="button"
                onClick={() => setAttendanceSubTab('evaluasi')}
                className={`py-1.5 px-1 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                  attendanceSubTab === 'evaluasi'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <App3DMobileIcon name="evaluasi" className="w-3.5 h-3.5 shrink-0" />
                <span>Evaluasi</span>
              </button>
              <button
                type="button"
                onClick={() => setAttendanceSubTab('antropometri')}
                className={`py-1.5 px-1 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                  attendanceSubTab === 'antropometri'
                    ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <App3DMobileIcon name="ai_insight" className="w-3.5 h-3.5 shrink-0" />
                <span>Growth</span>
              </button>
            </div>

            {/* Class Selector Dropdown for Attendance / Assessment */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Pilih Kelas:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none"
              >
                <option value="">-- Pilih Kelas Latihan --</option>
                {attendanceClasses.active.length > 0 && (
                  <optgroup label="── Kelas Aktif ──">
                    {attendanceClasses.active.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.className} ({cls.sport || 'Umum'})
                      </option>
                    ))}
                  </optgroup>
                )}
                {attendanceClasses.archived.length > 0 && (
                  <optgroup label="── Arsip Kelas ──">
                    {attendanceClasses.archived.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.className} (Arsip)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Render Actual Attendance Component */}
          {attendanceSubTab === 'presensi' && (
            <AttendanceSection
              selectedClass={selectedClass}
              students={activeStudents}
              tenantId={tenantId}
            />
          )}

          {/* Render Actual Evaluation Component */}
          {attendanceSubTab === 'evaluasi' && (
            <EvaluationSection
              selectedClass={selectedClass}
              students={activeStudents}
              tenantId={tenantId}
              userProfile={userProfile}
            />
          )}

          {/* Render Actual Growth Tracker Component */}
          {attendanceSubTab === 'antropometri' && (
            <GrowthTrackerSection
              selectedClass={selectedClass}
              students={activeStudents}
              tenantId={tenantId}
              userProfile={userProfile}
            />
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB CONTENT 5: TIM PELATIH (DATA AKTUAL) */}
      {/* ==================================================== */}
      {activeTab === 'pelatih' && !isCoachOnly && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 my-0">
                Tim Pelatih ({activeCoaches.length})
              </h3>
              <p className="text-[11px] text-slate-400 my-0.5">
                Pelatih dan instruktur resmi {activeAcademy?.name || 'akademi'}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCoach(null);
                setShowCoachModal(true);
              }}
              className="px-2.5 py-1.5 bg-[var(--chua-m-emerald)] hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pelatih</span>
            </button>
          </div>

          {coachesError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium">
              Gagal menyinkronkan data pelatih: {coachesError}
            </div>
          )}

          {loadingCoaches ? (
            <p className="py-8 text-center text-xs text-slate-500 font-medium">Memuat data pelatih...</p>
          ) : activeCoaches.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl p-4 space-y-2">
              <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700 my-0">Belum Ada Pelatih Terdaftar</p>
              <p className="text-[11px] text-slate-400 my-0">
                Daftarkan pelatih untuk memimpin kelas latihan akademi Anda.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeCoaches.map((c) => (
                <div key={c.id} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {c.photoUrl ? (
                        <img
                          src={c.photoUrl}
                          alt={c.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#354944]/30 shadow-2xs"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextElementSibling) {
                              e.target.nextElementSibling.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-10 h-10 rounded-full bg-[var(--chua-m-navy)] text-white font-black flex items-center justify-center text-xs shrink-0 border border-white/20 shadow-2xs ${
                          c.photoUrl ? 'hidden' : 'flex'
                        }`}
                      >
                        {c.name ? c.name.slice(0, 2).toUpperCase() : 'CO'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-800 truncate my-0">
                          {c.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 my-0.5 truncate">
                          {c.phone || 'Tanpa No. WhatsApp'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[var(--chua-m-blue)] border border-blue-200 uppercase">
                        {c.sportSpecialty || 'Pelatih'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCoach(c);
                          setShowCoachModal(true);
                        }}
                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 text-xs font-bold"
                        title="Edit Pelatih"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: COACH MANAGEMENT */}
      <CoachModal
        isOpen={showCoachModal}
        onClose={() => {
          setShowCoachModal(false);
          setEditingCoach(null);
        }}
        userProfile={userProfile}
        activeAcademy={activeAcademy}
        activeAcademyId={activeAcademyId}
        academies={academies}
        uniqueSports={uniqueSports}
        coachToEdit={editingCoach}
        onCoachAdded={() => {
          setShowCoachModal(false);
          setEditingCoach(null);
          setSuccessMsg('Pelatih baru berhasil didaftarkan!');
          fetchAllData();
        }}
        onCoachUpdated={() => {
          setShowCoachModal(false);
          setEditingCoach(null);
          setSuccessMsg('Data pelatih berhasil diperbarui!');
          fetchAllData();
        }}
      />

      {/* MODAL: CLASS MANAGEMENT */}
      <ClassModal
        isOpen={showClassModal}
        onClose={() => {
          setShowClassModal(false);
          setEditingClass(null);
        }}
        userProfile={userProfile}
        activeAcademy={activeAcademy}
        activeAcademyId={activeAcademyId}
        uniqueSports={uniqueSports}
        coaches={activeCoaches}
        courts={courts}
        classToEdit={editingClass}
        existingClasses={activeClasses}
        onClassAdded={() => {
          setShowClassModal(false);
          setEditingClass(null);
          setSuccessMsg('Kelas baru berhasil dibuat!');
          fetchAllData();
        }}
        onClassUpdated={() => {
          setShowClassModal(false);
          setEditingClass(null);
          setSuccessMsg('Data kelas berhasil diperbarui!');
          fetchAllData();
        }}
      />

      {/* MODAL: LOCK SCHEDULE MODAL */}
      {generateModalClass && (
        <LockScheduleModal
          isOpen={Boolean(generateModalClass)}
          onClose={() => setGenerateModalClass(null)}
          academyClass={generateModalClass}
          tenantId={tenantId}
          courts={courts}
          onSuccess={() => {
            setGenerateModalClass(null);
            setSuccessMsg('Jadwal rutin latihan berhasil dikunci!');
            fetchAllData();
          }}
        />
      )}

      {/* MODAL: CREATE ACADEMY MODAL */}
      <CreateAcademyModal
        isOpen={showCreateAcademyModal}
        onClose={() => setShowCreateAcademyModal(false)}
        userProfile={userProfile}
        onAcademyCreated={(newAc) => {
          setShowCreateAcademyModal(false);
          setSuccessMsg(`Akademi "${newAc.name}" berhasil dibuat!`);
          fetchAllData();
        }}
      />

      {/* MODAL: COACH SELF-SERVICE PASSWORD */}
      {showCoachPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800 my-0">Ganti Password Pelatih</h3>
              <button
                type="button"
                onClick={() => setShowCoachPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            {pwdMsg && <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl">{pwdMsg}</div>}
            {pwdErr && <div className="p-2.5 bg-red-50 text-red-800 text-xs font-bold rounded-xl">{pwdErr}</div>}
            <form onSubmit={handleUpdateSelfPassword} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Password Baru (min 6 karakter)</label>
                <input
                  type="password"
                  value={newCoachPassword}
                  onChange={(e) => setNewCoachPassword(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmCoachPassword}
                  onChange={(e) => setConfirmCoachPassword(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 outline-none focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={updatingPassword}
                className="w-full py-2.5 rounded-xl bg-[var(--chua-m-navy)] text-white text-xs font-bold cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                {updatingPassword ? 'Memperbarui...' : 'Simpan Password Baru'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
