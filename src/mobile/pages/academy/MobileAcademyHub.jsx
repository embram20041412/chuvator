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
  Plus,
  ChevronDown,
  CheckCircle2,
  Search,
  BookOpen
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

// Dedicated mobile student management & mobile UI primitives
import MobileStudentManagement from '../students/MobileStudentManagement';
import MobileBottomSheet from '../../components/MobileBottomSheet';

/**
 * MobileAcademyHub Component
 * Phase A — Redesigned Mobile Navigation & Context Hierarchy for Akademi Module.
 * Hierarchy:
 * 1. Header Akademi
 * 2. Compact Workspace Selector (Bottom Sheet)
 * 3. Navigasi Utama (Dasbor, Siswa, Kelas, Presensi, Pelatih)
 * 4. Context Kelas (Compact Class Selector Bottom Sheet with Search when on Presensi)
 * 5. Sub-Navigation Presensi ([ Presensi ] [ Evaluasi ] [ Growth ])
 * 6. Konten Halaman
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
  const subTabParam = searchParams.get('subtab');

  const resolveSubTab = (raw) => {
    if (raw === 'evaluasi') return 'evaluasi';
    if (raw === 'antropometri' || raw === 'growth') return 'antropometri';
    return 'presensi';
  };

  const [activeTab, setActiveTab] = useState(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      if (isCoachOnly && (tabParam === 'dasbor' || tabParam === 'siswa' || tabParam === 'pelatih')) {
        return 'kelas';
      }
      return tabParam;
    }
    return isCoachOnly ? 'kelas' : 'dasbor';
  });

  // Sub-tabs & selector sheet states
  const [classSubTab, setClassSubTab] = useState('active'); // 'active' | 'archived'
  const [attendanceSubTab, setAttendanceSubTab] = useState(() => resolveSubTab(subTabParam)); // 'presensi' | 'evaluasi' | 'antropometri'
  const [selectedClassId, setSelectedClassId] = useState('');
  const [showWorkspaceSheet, setShowWorkspaceSheet] = useState(false);
  const [showClassSheet, setShowClassSheet] = useState(false);
  const [classSearchQuery, setClassSearchQuery] = useState('');

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
    if (subTabParam) {
      setAttendanceSubTab(resolveSubTab(subTabParam));
    }
  }, [tabParam, subTabParam, isCoachOnly]);

  const handleTabChange = (tab) => {
    if (isCoachOnly && (tab === 'dasbor' || tab === 'siswa' || tab === 'pelatih')) return;
    setActiveTab(tab);
    if (tab === 'presensi') {
      setSearchParams({ tab, subtab: attendanceSubTab });
    } else {
      setSearchParams({ tab });
    }
  };

  const handleAttendanceSubTabChange = (subTab) => {
    setAttendanceSubTab(subTab);
    setSearchParams({ tab: 'presensi', subtab: subTab });
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

  // Handle Workspace Switch with Clean Context Reset
  const handleSelectWorkspace = (newAcademyId) => {
    if (!newAcademyId || isCoachOnly) return;
    setActiveAcademyId(newAcademyId);
    localStorage.setItem('activeAcademyId', newAcademyId);
    setSelectedClassId('');
    setShowWorkspaceSheet(false);
    fetchCoaches(newAcademyId);
    fetchArchivedClasses(newAcademyId);
  };

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

  // Filtered Attendance Classes for Searchable Class Bottom Sheet
  const filteredAttendanceClasses = useMemo(() => {
    const q = classSearchQuery.trim().toLowerCase();
    if (!q) return attendanceClasses;
    const filterFn = (cls) =>
      (cls.className || '').toLowerCase().includes(q) ||
      (cls.sport || '').toLowerCase().includes(q) ||
      (cls.coachName || '').toLowerCase().includes(q);
    return {
      active: attendanceClasses.active.filter(filterFn),
      archived: attendanceClasses.archived.filter(filterFn),
      all: attendanceClasses.all.filter(filterFn)
    };
  }, [attendanceClasses, classSearchQuery]);

  // Auto-select first class if none selected or when switching workspaces
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

  // Primary Navigation Items
  const navItems = useMemo(() => {
    const items = [
      { id: 'dasbor', label: 'Dasbor', icon: LayoutDashboard, coachAllowed: false },
      { id: 'siswa', label: 'Siswa', icon: Users, coachAllowed: false },
      { id: 'kelas', label: 'Kelas', icon: BookOpen, coachAllowed: true },
      { id: 'presensi', label: 'Presensi', icon: ClipboardCheck, coachAllowed: true },
      { id: 'pelatih', label: 'Pelatih', icon: GraduationCap, coachAllowed: false }
    ];
    return isCoachOnly ? items.filter((i) => i.coachAllowed) : items;
  }, [isCoachOnly]);

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
    <div className="chua-m-academy-container">
      {/* Feedback Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-semibold flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-700 font-bold px-1">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-700 font-bold px-1">✕</button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. HEADER AKADEMI                                    */}
      {/* ==================================================== */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[#101D38] tracking-tight my-0 truncate">
            Akademi Olahraga
          </h1>
        </div>

        {isCoachOnly ? (
          <button
            type="button"
            onClick={() => {
              setPwdErr(null);
              setPwdMsg(null);
              setShowCoachPasswordModal(true);
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E7EBF2] text-[#17233D] font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Ganti Password"
          >
            <Lock className="w-3.5 h-3.5 text-[#68758B]" />
            <span>Password</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreateAcademyModal(true)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#101D38] text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>
        )}
      </div>

      {/* ==================================================== */}
      {/* 2. COMPACT WORKSPACE SELECTOR                        */}
      {/* ==================================================== */}
      <button
        type="button"
        disabled={isCoachOnly}
        onClick={() => {
          if (!isCoachOnly) setShowWorkspaceSheet(true);
        }}
        className={`chua-m-workspace-selector ${isCoachOnly ? 'cursor-default' : 'cursor-pointer'}`}
        aria-label="Pilih Workspace Akademi"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[#17233D] truncate leading-snug">
            {activeAcademy?.name || 'Pilih Workspace Akademi'}
          </div>
          <div className="text-xs text-[#68758B] font-medium truncate mt-0.5 flex items-center gap-1.5">
            <span>{activeAcademy?.sport || 'Umum'}</span>
            <span aria-hidden="true">&middot;</span>
            <span className={!isCoachOnly ? 'text-[#2455E8] font-semibold' : ''}>
              {isCoachOnly ? `${activeClasses.length} Kelas Aktif` : 'Pilih Workspace'}
            </span>
          </div>
        </div>

        {!isCoachOnly && (
          <div className="w-8 h-8 rounded-xl bg-[#F5F7FC] border border-[#E7EBF2] flex items-center justify-center shrink-0 text-[#2455E8]">
            <ChevronDown className="w-4 h-4" />
          </div>
        )}
      </button>

      {/* ==================================================== */}
      {/* 3. NAVIGASI UTAMA AKADEMI (5 TABS, NO H-SCROLL)       */}
      {/* ==================================================== */}
      <nav className="chua-m-primary-nav" aria-label="Navigasi Utama Akademi">
        <div className={`grid ${isCoachOnly ? 'grid-cols-2' : 'grid-cols-5'} gap-1`}>
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`chua-m-primary-nav-btn ${isActive ? 'chua-m-primary-nav-btn-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <IconComponent
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#2455E8]' : 'text-[#68758B]'
                  }`}
                />
                <span className="truncate max-w-full">{item.label}</span>
                {isActive && (
                  <span
                    className="w-4 h-0.5 rounded-full bg-[#2455E8] mt-0.5"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ==================================================== */}
      {/* 4. CONTEXT KELAS & 5. SUB-NAVIGATION PRESENSI        */}
      {/* ==================================================== */}
      {activeTab === 'presensi' && (
        <div className="space-y-2.5">
          {/* 4. Compact Class Selector */}
          <button
            type="button"
            onClick={() => {
              setClassSearchQuery('');
              setShowClassSheet(true);
            }}
            className="chua-m-class-selector cursor-pointer"
            aria-label="Pilih Kelas Latihan"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-bold text-[#17233D] truncate leading-snug">
                {selectedClass ? selectedClass.className : 'Pilih Kelas Latihan'}
              </div>
              <div className="text-[11px] text-[#68758B] font-medium truncate mt-0.5 flex items-center gap-1.5">
                <span className="truncate">
                  {selectedClass
                    ? `${selectedClass.sport || activeAcademy?.sport || 'Olahraga'}${
                        selectedClass.schedule ? ` · ${selectedClass.schedule}` : ''
                      }${selectedClass.isArchived ? ' · Arsip' : ''}`
                    : 'Belum ada kelas dipilih'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold text-[#2455E8] shrink-0">
              <span>Pilih Kelas</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>

          {/* 5. Segmented Sub-Navigation: [ Presensi ] [ Evaluasi ] [ Growth ] */}
          <div className="chua-m-segmented-subnav" role="tablist" aria-label="Sub-navigasi Presensi">
            <button
              type="button"
              role="tab"
              aria-selected={attendanceSubTab === 'presensi'}
              onClick={() => handleAttendanceSubTabChange('presensi')}
              className={`chua-m-segmented-subnav-btn ${
                attendanceSubTab === 'presensi' ? 'chua-m-segmented-subnav-btn-active' : ''
              }`}
            >
              <span>Presensi</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={attendanceSubTab === 'evaluasi'}
              onClick={() => handleAttendanceSubTabChange('evaluasi')}
              className={`chua-m-segmented-subnav-btn ${
                attendanceSubTab === 'evaluasi' ? 'chua-m-segmented-subnav-btn-active' : ''
              }`}
            >
              <span>Evaluasi</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={attendanceSubTab === 'antropometri'}
              onClick={() => handleAttendanceSubTabChange('antropometri')}
              className={`chua-m-segmented-subnav-btn ${
                attendanceSubTab === 'antropometri' ? 'chua-m-segmented-subnav-btn-active' : ''
              }`}
            >
              <span>Growth</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. KONTEN HALAMAN                                    */}
      {/* ==================================================== */}

      {/* TAB CONTENT 1: DASBOR AKADEMI */}
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
            isMobile={true}
          />
        </div>
      )}

      {/* TAB CONTENT 2: SISWA & SPP */}
      {activeTab === 'siswa' && !isCoachOnly && (
        <div>
          <MobileStudentManagement
            userProfile={userProfile}
            activeAcademyId={activeAcademy?.id || activeAcademyId}
            onStudentsChanged={fetchAllData}
          />
        </div>
      )}

      {/* TAB CONTENT 3: KELAS & JADWAL */}
      {activeTab === 'kelas' && (
        <div className="bg-white p-3.5 rounded-[16px] border border-[#E7EBF2] shadow-[0_2px_8px_rgba(16,29,56,0.04)] space-y-3">
          {/* Sub-header: Toggle Kelas Aktif / Arsip & Buat Kelas */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center p-1 bg-[#F5F7FC] rounded-xl border border-[#E7EBF2]">
              <button
                type="button"
                onClick={() => setClassSubTab('active')}
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  classSubTab === 'active'
                    ? 'bg-[#2455E8] text-white font-bold shadow-xs'
                    : 'text-[#68758B]'
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
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  classSubTab === 'archived'
                    ? 'bg-[#2455E8] text-white font-bold shadow-xs'
                    : 'text-[#68758B]'
                }`}
              >
                Arsip ({activeArchivedClasses.length})
              </button>
            </div>

            {canManageClasses && classSubTab === 'active' && (
              <button
                type="button"
                onClick={handleOpenCreateClass}
                className="min-h-[38px] px-3 py-1.5 bg-[#101D38] hover:opacity-90 text-white font-semibold text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kelas</span>
              </button>
            )}
          </div>

          {/* Render Actual AcademyClasses List */}
          {(classSubTab === 'active' ? loadingClasses : false) ? (
            <p className="py-8 text-center text-xs text-[#68758B] font-medium">Memuat data kelas...</p>
          ) : (classSubTab === 'active' ? activeClasses : activeArchivedClasses).length === 0 ? (
            <div className="py-8 text-center border border-dashed border-[#E7EBF2] rounded-2xl p-4 space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-[#17233D] my-0">
                {classSubTab === 'active' ? 'Belum Ada Kelas Latihan Aktif' : 'Belum Ada Kelas yang Diarsipkan'}
              </p>
              <p className="text-[11px] text-[#68758B] my-0">
                {canManageClasses && classSubTab === 'active'
                  ? 'Ketuk tombol "Tambah Kelas" untuk membuat kelompok latihan baru.'
                  : 'Kelas akademi akan muncul setelah ditambahkan oleh admin.'}
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

      {/* TAB CONTENT 4: PRESENSI, EVALUASI & GROWTH (ISI INTERNAL TETAP) */}
      {activeTab === 'presensi' && (
        <div>
          {attendanceSubTab === 'presensi' && (
            <AttendanceSection
              selectedClass={selectedClass}
              students={activeStudents}
              tenantId={tenantId}
              isMobile={true}
            />
          )}

          {attendanceSubTab === 'evaluasi' && (
            <EvaluationSection
              selectedClass={selectedClass}
              students={activeStudents}
              tenantId={tenantId}
              activeAcademy={activeAcademy}
              userProfile={userProfile}
              isMobile={true}
            />
          )}

          {attendanceSubTab === 'antropometri' && (
            <GrowthTrackerSection
              selectedClass={selectedClass}
              students={activeStudents}
              tenantId={tenantId}
              activeAcademy={activeAcademy}
              userProfile={userProfile}
              onStudentUpdated={() => fetchAllData()}
            />
          )}
        </div>
      )}

      {/* TAB CONTENT 5: TIM PELATIH */}
      {activeTab === 'pelatih' && !isCoachOnly && (
        <div className="bg-white p-3.5 rounded-[16px] border border-[#E7EBF2] shadow-[0_2px_8px_rgba(16,29,56,0.04)] space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E7EBF2]">
            <div>
              <h3 className="font-bold text-sm text-[#17233D] my-0">
                Tim Pelatih ({activeCoaches.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCoach(null);
                setShowCoachModal(true);
              }}
              className="min-h-[38px] px-3 py-1.5 bg-[#2455E8] hover:opacity-90 text-white font-semibold text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Pelatih</span>
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

      {/* BOTTOM SHEET: WORKSPACE SELECTOR */}
      <MobileBottomSheet
        isOpen={showWorkspaceSheet}
        onClose={() => setShowWorkspaceSheet(false)}
        title="Pilih Workspace Akademi"
      >
        <div className="space-y-3">
          {academies.length === 0 ? (
            <p className="text-xs text-[#68758B] py-4 text-center my-0">
              Belum ada workspace akademi terdaftar.
            </p>
          ) : (
            <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-0.5">
              {academies.map((ac) => {
                const isSelected = ac.id === (activeAcademy?.id || activeAcademyId);
                return (
                  <button
                    key={ac.id}
                    type="button"
                    onClick={() => handleSelectWorkspace(ac.id)}
                    className={`w-full min-h-[52px] p-3 rounded-2xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#2455E8]/[0.06] border-[#2455E8] text-[#17233D]'
                        : 'bg-white border-[#E7EBF2] text-[#17233D] hover:bg-[#F5F7FC]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold text-[#17233D] truncate">
                        {ac.name}
                      </div>
                      <div className="text-[11px] font-medium text-[#68758B] truncate mt-0.5">
                        {ac.sport || 'Olahraga Umum'}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#2455E8] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!isCoachOnly && (
            <button
              type="button"
              onClick={() => {
                setShowWorkspaceSheet(false);
                setShowCreateAcademyModal(true);
              }}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#101D38] text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Workspace Akademi Baru</span>
            </button>
          )}
        </div>
      </MobileBottomSheet>

      {/* BOTTOM SHEET: CLASS SELECTOR (WITH SEARCH) */}
      <MobileBottomSheet
        isOpen={showClassSheet}
        onClose={() => setShowClassSheet(false)}
        title="Pilih Kelas Latihan"
      >
        <div className="space-y-3">
          {attendanceClasses.all.length > 3 && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#68758B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={classSearchQuery}
                onChange={(e) => setClassSearchQuery(e.target.value)}
                placeholder="Cari nama kelas atau pelatih..."
                className="w-full min-h-[44px] pl-10 pr-3 py-2 text-xs bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl text-[#17233D] outline-none focus:border-[#2455E8]"
              />
            </div>
          )}

          {filteredAttendanceClasses.all.length === 0 ? (
            <p className="text-xs text-[#68758B] py-6 text-center my-0">
              {classSearchQuery.trim()
                ? 'Tidak ada kelas yang cocok dengan pencarian.'
                : 'Belum ada kelas latihan tersedia pada workspace ini.'}
            </p>
          ) : (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-0.5">
              {filteredAttendanceClasses.active.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-[#68758B] px-1">
                    Kelas Aktif ({filteredAttendanceClasses.active.length})
                  </div>
                  {filteredAttendanceClasses.active.map((cls) => {
                    const isSelected = cls.id === selectedClassId;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setSelectedClassId(cls.id);
                          setShowClassSheet(false);
                        }}
                        className={`w-full min-h-[50px] p-3 rounded-2xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#2455E8]/[0.06] border-[#2455E8] text-[#17233D]'
                            : 'bg-white border-[#E7EBF2] text-[#17233D] hover:bg-[#F5F7FC]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-[#17233D] truncate">
                            {cls.className}
                          </div>
                          <div className="text-[11px] font-medium text-[#68758B] truncate mt-0.5">
                            {cls.sport || activeAcademy?.sport || 'Umum'}
                            {cls.coachName ? ` · Pelatih: ${cls.coachName}` : ''}
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[#2455E8] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredAttendanceClasses.archived.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-[#68758B] px-1">
                    Arsip Kelas ({filteredAttendanceClasses.archived.length})
                  </div>
                  {filteredAttendanceClasses.archived.map((cls) => {
                    const isSelected = cls.id === selectedClassId;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setSelectedClassId(cls.id);
                          setShowClassSheet(false);
                        }}
                        className={`w-full min-h-[50px] p-3 rounded-2xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#2455E8]/[0.06] border-[#2455E8] text-[#17233D]'
                            : 'bg-white border-[#E7EBF2] text-[#17233D] hover:bg-[#F5F7FC]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-[#17233D] truncate">
                            {cls.className}
                          </div>
                          <div className="text-[11px] font-medium text-[#68758B] truncate mt-0.5">
                            {cls.sport || activeAcademy?.sport || 'Umum'} · Arsip
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[#2455E8] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </MobileBottomSheet>

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
