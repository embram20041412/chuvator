import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import supabaseAcademyService from '../services/supabaseAcademyService';
import { calculateAge, getStudentInitials, parseScheduleItems } from '../utils/helpers';
import useArenaData from '../hooks/useArenaData';
import useUserAccessScope from '../hooks/useUserAccessScope';
import { updateCoachPassword } from '../services/coachAuthService';
import { isTennisSport } from '../config/tennisAssessmentData';
import { sortClassesByAgeGroup } from '../config/tierCurriculumConfig';

import SppPaymentModal from '../components/SppPaymentModal';
import GlobalReceiptModal from '../components/GlobalReceiptModal';
import StudentDetailModal from '../components/StudentDetailModal';
import StudentRegistrationModal from '../components/StudentRegistrationModal';
import CoachModal from '../components/CoachModal';
import ClassModal from '../components/ClassModal';
import CreateAcademyModal from '../components/CreateAcademyModal';
import GenerateAcademyScheduleModal from '../components/GenerateAcademyScheduleModal';
import IdCardGenerator from '../components/IdCardGenerator';
import AttendanceSection from '../components/AttendanceSection';
import EvaluationSection from '../components/EvaluationSection';
import GrowthTrackerSection from '../components/GrowthTrackerSection';
import AcademyDashboard from '../components/AcademyDashboard';
// import { Dashboard3DIcon, Akademi3DIcon } from '../components/icons/App3DIcons';
import { 
  GraduationCap, 
  UserPlus, 
  CheckCircle2, 
  X, 
  Phone, 
  User, 
  FileText, 
  MapPin, 
  Upload, 
  School, 
  Eye, 
  TrendingUp,
  IdCard,

  CreditCard, 
  Calendar,
  Trophy,
  Users,
  Award,
  BookOpen,
  MessageCircle,
  LayoutDashboard,
  ClipboardCheck,
  Plus,
  Inbox,
  Sparkles,
  Lock,
  Edit3,
  ChevronDown,
  ChevronUp,
  Building2,
  Clock
} from 'lucide-react';
import { Dashboard3DIcon, Akademi3DIcon, Booking3DIcon, Kasir3DIcon, Event3DIcon, Keuangan3DIcon, AIInsight3DIcon, Pengaturan3DIcon } from '../components/icons/App3DIcons';

// SPORT CATEGORY OPTIONS DICTIONARY FOR MULTI-ACADEMY WORKSPACE (Enterprise Fase 11 Part 1)
export const sportCategoryOptions = [
  { id: 'racket', label: 'Racket Sports', sports: ['Badminton', 'Tenis', 'Padel', 'Squash', 'Tenis Meja'] },
  { id: 'field', label: 'Field & Team Sports', sports: ['SepakBola', 'Futsal', 'Minisoccer'] },
  { id: 'court', label: 'Court Team Sports', sports: ['BolaBasket 5v5', 'BolaBasket 3v3'] },
  { id: 'net', label: 'Net Team Sports', sports: ['Bola Voli indoor', 'Bola Voli pasir', 'Sepak Takraw'] }
];

/**
 * Utility to calculate SPP Arrears status based on Billing Cycle & Due Date
 */
export function calculateSppStatus(student, sppBillingStartDay = 1, sppDueDay = 10) {
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7); // Format "YYYY-MM"
  const currentDay = today.getDate();

  const startDay = Number(sppBillingStartDay) || 1;
  const dueDay = Number(sppDueDay) || 10;

  // a. Siswa sudah lunas untuk bulan ini
  if (student?.lastPaidMonth === currentMonth) {
    return {
      isPaid: true,
      statusText: 'LUNAS BULAN INI',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold',
      daysOverdue: 0
    };
  }

  // b. Siswa belum lunas untuk bulan ini
  if (currentDay >= startDay) {
    if (currentDay > dueDay) {
      const daysOverdue = currentDay - dueDay;
      return {
        isPaid: false,
        statusText: `MENUNGGAK ${daysOverdue} HARI`,
        badgeClass: 'bg-red-100 text-red-800 border border-red-200 font-black animate-pulse',
        daysOverdue
      };
    } else {
      return {
        isPaid: false,
        statusText: 'BELUM DIBAYAR',
        badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200 font-extrabold',
        daysOverdue: 0
      };
    }
  } else {
    // Belum masuk masa penagihan bulan ini
    return {
      isPaid: false,
      statusText: 'BELUM DIBAYAR',
      badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200 font-extrabold',
      daysOverdue: 0
    };
  }
}

/**
 * Helper formatter nomor WhatsApp internasional (+628...)
 */
export const formatWhatsAppNumber = (phone) => {
  if (!phone) return '';
  let formatted = phone.replace(/\D/g, ''); // Hapus karakter non-angka
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.substring(1);
  }
  return formatted;
};

/**
 * Utility to format WhatsApp Web Direct Link
 */
export function formatWhatsAppUrl(phone, studentName, arenaName) {
  if (!phone) return '#';
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  const msg = `Halo Bapak/Ibu Wali dari ${studentName}, ini dari admin ${arenaName || 'Akademi'}.`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
}

export default function AcademyPage({ userProfile }) {
  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-gray-50 dark:bg-slate-900 rounded-3xl p-8">
        <p className="text-red-500 font-medium">Sesi tidak valid atau hak akses tidak ditemukan.</p>
      </div>
    );
  }

  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  // Real-Time Arena Data
  const { tenantProfile, courts } = useArenaData(userProfile);
  const arenaName = tenantProfile?.name || 'Sports Arena';
  const sppBillingStartDay = tenantProfile?.sppBillingStartDay ?? 1;
  const sppDueDay = tenantProfile?.sppDueDay ?? 10;

  // Dynamic Unique Sports list from Courts
  const uniqueSports = Array.from(
    new Set(courts.map((c) => c.sport).filter(Boolean))
  );

  // Multi-Academy Workspace States (Enterprise Fase 11 Part 1)
  const [academies, setAcademies] = useState([]);
  const [activeAcademyId, setActiveAcademyId] = useState(() => {
    return localStorage.getItem('activeAcademyId') || '';
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingAcademies, setLoadingAcademies] = useState(true);

  // Form States for Create Academy Modal
  const [newAcademyName, setNewAcademyName] = useState('');
  const [newAcademyCategory, setNewAcademyCategory] = useState('racket');
  const [newAcademySport, setNewAcademySport] = useState('Badminton');
  const [newAcademyDescription, setNewAcademyDescription] = useState('');
  const [isSavingAcademy, setIsSavingAcademy] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['dasbor', 'siswa', 'pelatih', 'kelas', 'presensi'];
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam && validTabs.includes(tabParam)) ? tabParam : 'dasbor';

  // Access scope & Coach RBAC
  const accessScope = useUserAccessScope(userProfile);
  const { isCoachOnly, coachProfile } = accessScope;

  // Coach Self-Service Password Modal State
  const [showCoachPasswordModal, setShowCoachPasswordModal] = useState(false);
  const [newCoachPassword, setNewCoachPassword] = useState('');
  const [confirmCoachPassword, setConfirmCoachPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdErr, setPwdErr] = useState(null);

  // Active Internal Tab: 'dasbor' | 'siswa' | 'pelatih' | 'kelas' | 'presensi' (Defaults to 'dasbor')
  const [activeAcademyTab, setActiveAcademyTab] = useState(initialTab);
  const [mobileAcademyHubMode, setMobileAcademyHubMode] = useState(true);

  // Guard tab for Coach role: coaches can only access 'kelas' & 'presensi'
  useEffect(() => {
    if (isCoachOnly && (activeAcademyTab === 'dasbor' || activeAcademyTab === 'siswa' || activeAcademyTab === 'pelatih')) {
      setActiveAcademyTab('kelas');
      setSearchParams({ tab: 'kelas' });
    }
  }, [isCoachOnly, activeAcademyTab, setSearchParams]);

  // Sync activeAcademyTab when URL tab parameter changes
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && validTabs.includes(currentTab)) {
      if (isCoachOnly && (currentTab === 'dasbor' || currentTab === 'siswa' || currentTab === 'pelatih')) {
        setActiveAcademyTab('kelas');
      } else {
        setActiveAcademyTab(currentTab);
      }
    } else if (!currentTab) {
      setActiveAcademyTab(isCoachOnly ? 'kelas' : 'dasbor');
    }
  }, [searchParams, isCoachOnly]);

  const handleTabChange = (tab) => {
    if (isCoachOnly && (tab === 'dasbor' || tab === 'siswa' || tab === 'pelatih')) return;
    setActiveAcademyTab(tab);
    setSearchParams({ tab });
  };

  // Smart Collapsible Card State for Student List
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  // Attendance & Evaluation State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [attendanceSubTab, setAttendanceSubTab] = useState('presensi'); // 'presensi' | 'evaluasi'

  // Real-Time States from Firestore
  const [students, setStudents] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [academyClasses, setAcademyClasses] = useState([]);

  // 1. Tentukan Active Academy terlebih dahulu
  const activeAcademy = academies.find((a) => a.id === activeAcademyId) || (academies.length > 0 ? academies[0] : null);

  const isCurrentAcademyTennis = useMemo(() => {
    return isTennisSport(null, activeAcademy);
  }, [activeAcademy]);

  // Dynamic Isolated Sports list for active academy category (Enterprise Fase 11 Part 1)
  const activeAcademyCategoryObj = sportCategoryOptions.find(
    (cat) => cat.id === activeAcademy?.category || cat.id === activeAcademy?.sportCategory
  );
  const activeAcademySports = useMemo(() => {
    const list = [];
    if (activeAcademy?.sport) list.push(activeAcademy.sport);
    if (isCurrentAcademyTennis && !list.includes('Tenis')) list.push('Tenis');
    if (activeAcademyCategoryObj?.sports) {
      activeAcademyCategoryObj.sports.forEach((s) => {
        if (!list.includes(s)) list.push(s);
      });
    }
    if (list.length === 0) {
      return uniqueSports.length > 0 ? uniqueSports : ['Tenis', 'Badminton', 'Futsal'];
    }
    return list;
  }, [activeAcademy?.sport, isCurrentAcademyTennis, activeAcademyCategoryObj, uniqueSports]);

  // 2. STRICT ISOLATION & SELF-HEALING (IN-MEMORY):
  // Hanya ambil data yang academyId-nya persis sama dengan activeAcademy.id.
  // Jika pengguna login sebagai Coach (isCoachOnly), filter kelas & siswa sesuai coachProfile ID / Email.
  const rawActiveStudents = activeAcademy ? students.filter((s) => s.academyId === activeAcademy.id) : [];
  const activeCoaches = activeAcademy ? coaches.filter((c) => c.academyId === activeAcademy.id) : [];

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

    if (isCoachOnly && coachProfile) {
      const cId = coachProfile.id;
      const cEmail = coachProfile.email;
      const cName = coachProfile.name ? coachProfile.name.toLowerCase() : '';

      rawList = rawList.filter((c) => {
        if (cId && (c.coachId === cId || c.coach_id === cId)) return true;
        if (cEmail && (c.coachEmail === cEmail || c.coach_email === cEmail)) return true;
        if (cName && c.coachName && c.coachName.toLowerCase() === cName) return true;
        return false;
      });
    }

    return sortClassesByAgeGroup(rawList);
  }, [activeAcademy, academyClasses, isCurrentAcademyTennis, isCoachOnly, coachProfile]);

  const activeStudents = useMemo(() => {
    if (!isCoachOnly || !coachProfile) return rawActiveStudents;
    const allowedClassIds = new Set(activeClasses.map((c) => c.id));
    return rawActiveStudents.filter((s) => s.classId && allowedClassIds.has(s.classId));
  }, [rawActiveStudents, isCoachOnly, coachProfile, activeClasses]);

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
      console.error('Error updating coach password:', err);
      setPwdErr(err.message || 'Gagal mengubah password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 3. AUTO-FIX / SELF-HEALING MIGRATION:
  // Koreksi data dokumen kelas yang masih terlanjur tertulis non-Tenis pada Akademi Tenis
  useEffect(() => {
    if (!activeAcademy || !isCurrentAcademyTennis || academyClasses.length === 0) return;

    const misregisteredClasses = academyClasses.filter(
      (cls) =>
        cls.academyId === activeAcademy.id &&
        (!cls.sport || cls.sport.toLowerCase() === 'badminton' || !cls.sport.toLowerCase().includes('tenis'))
    );

    if (misregisteredClasses.length > 0) {
      misregisteredClasses.forEach(async (cls) => {
        try {
          await supabaseAcademyService.updateClass(cls.id, { sport: 'Tenis' });
        } catch (err) {
          console.error(`[Auto-Fix Tenis] Gagal mengupdate data kelas ${cls.id}:`, err);
        }
      });
    }
  }, [activeAcademyId, isCurrentAcademyTennis, academyClasses.length]);

  const filteredStudents = activeStudents;
  const filteredCoaches = activeCoaches;
  const filteredClasses = activeClasses;

  // Emit counts to window so sidebar badges stay in exact real-time sync
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('simak_academy_counts', {
        detail: {
          students: filteredStudents.length,
          coaches: filteredCoaches.length,
          classes: filteredClasses.length,
        },
      })
    );
  }, [filteredStudents.length, filteredCoaches.length, filteredClasses.length]);

  // Auto-reset / default selectedClassId when switching active workspace academy
  const sppPaidPercentage = useMemo(() => {
    if (activeStudents.length === 0) return 0;
    let paidCount = 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    activeStudents.forEach((st) => {
      const isPaid = st.lastPaidMonth === currentMonth || st.paymentStatus === 'lunas' || st.sppStatus === 'Lunas';
      if (isPaid) paidCount++;
    });
    return Math.round((paidCount / activeStudents.length) * 100);
  }, [activeStudents]);

  const getActivePageTitle = () => {
    switch (activeAcademyTab) {
      case 'dasbor': return 'Dasbor & Laporan';
      case 'siswa': return 'Siswa & SPP';
      case 'pelatih': return 'Tim Pelatih';
      case 'kelas': return 'Kelas & Jadwal';
      case 'presensi': return 'Presensi & Evaluasi';
      default: return 'Akademi';
    }
  };
  useEffect(() => {
    if (activeClasses.length > 0) {
      const isValidInCurrentAcademy = activeClasses.some((c) => c.id === selectedClassId);
      if (!isValidInCurrentAcademy) {
        setSelectedClassId(activeClasses[0].id);
      }
    } else if (selectedClassId !== '') {
      setSelectedClassId('');
    }
  }, [activeAcademyId, activeClasses.length, selectedClassId]);

  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false); // Student Modal
  const [showCoachModal, setShowCoachModal] = useState(false); // Coach Modal
  const [showClassModal, setShowClassModal] = useState(false); // Class Modal
  const [generateModalClass, setGenerateModalClass] = useState(null); // Generate Schedule Modal

  const [paymentModalStudent, setPaymentModalStudent] = useState(null);
  const [sppReceiptData, setSppReceiptData] = useState(null);
  const [detailModalStudent, setDetailModalStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingCoach, setEditingCoach] = useState(null);
  const [idCardTarget, setIdCardTarget] = useState(null); // { data, role: 'SISWA' | 'PELATIH' }

  // Student Form States
  const [studentName, setStudentName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [nikKk, setNikKk] = useState('');
  const [schoolOrigin, setSchoolOrigin] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentClassId, setStudentClassId] = useState('');
  const [sportCategory, setSportCategory] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthlyFee, setMonthlyFee] = useState('350000');

  // Emsifa Location States
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedRegency, setSelectedRegency] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [addressDetail, setAddressDetail] = useState('');

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [savingStudent, setSavingStudent] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // 0. Listen to Real-Time Academies Collection (Multi-Academy Workspace)
  useEffect(() => {
    if (!tenantId) {
      setLoadingAcademies(false);
      return;
    }
  }, [tenantId]);

  // SINGLE ASYNCHRONOUS DATA FETCHER: Promise.all to Supabase
  const isFetchingRef = React.useRef(false);

  const fetchAcademyData = useCallback(async () => {
    if (!tenantId || isFetchingRef.current) {
      setLoadingStudents(false);
      setLoadingCoaches(false);
      setLoadingClasses(false);
      setLoadingAcademies(false);
      return;
    }

    isFetchingRef.current = true;
    setLoadingStudents(true);
    setLoadingCoaches(true);
    setLoadingClasses(true);
    setLoadingAcademies(true);

    try {
      const [studentsData, classesData, coachesData, academiesData] = await Promise.all([
        supabaseAcademyService.getStudents(tenantId),
        supabaseAcademyService.getClasses(tenantId),
        supabaseAcademyService.getCoaches(tenantId),
        supabaseAcademyService.getAcademies(tenantId)
      ]);

      setStudents(studentsData || []);
      setAcademyClasses(classesData || []);
      setCoaches(coachesData || []);

      if (academiesData && academiesData.length > 0) {
        setAcademies(academiesData);
        const storedId = localStorage.getItem('activeAcademyId');
        const found = academiesData.find((a) => a.id === storedId);
        if (found) {
          setActiveAcademyId((prevId) => (prevId === found.id ? prevId : found.id));
        } else {
          const firstId = academiesData[0].id;
          setActiveAcademyId((prevId) => (prevId === firstId ? prevId : firstId));
          localStorage.setItem('activeAcademyId', firstId);
        }
      } else {
        setAcademies([]);
        setActiveAcademyId('');
      }
    } catch (err) {
      console.error('[Supabase fetchAcademyData Error]:', err);
    } finally {
      isFetchingRef.current = false;
      setLoadingStudents(false);
      setLoadingCoaches(false);
      setLoadingClasses(false);
      setLoadingAcademies(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      fetchAcademyData();
    }
  }, [tenantId, fetchAcademyData]);

  // Keep newAcademySport synced with newAcademyCategory
  useEffect(() => {
    const catObj = sportCategoryOptions.find((c) => c.id === newAcademyCategory);
    if (catObj && catObj.sports.length > 0) {
      if (!catObj.sports.includes(newAcademySport)) {
        setNewAcademySport(catObj.sports[0]);
      }
    }
  }, [newAcademyCategory]);

  // Create New Academy Handler (Supabase)
  const handleCreateAcademy = async (e) => {
    e.preventDefault();
    if (!newAcademyName.trim() || !tenantId) return;

    setIsSavingAcademy(true);
    setErrorMsg(null);
    try {
      const catObj = sportCategoryOptions.find((c) => c.id === newAcademyCategory);
      const newAcad = await supabaseAcademyService.createAcademy({
        tenantId,
        name: newAcademyName.trim(),
        category: newAcademyCategory,
        categoryLabel: catObj?.label || 'Sports',
        sportCategory: newAcademyCategory,
        sport: newAcademySport,
        description: newAcademyDescription.trim()
      });

      // Update state lokal secara optimistik
      setAcademies((prev) => [newAcad, ...prev]);
      setActiveAcademyId(newAcad.id);
      localStorage.setItem('activeAcademyId', newAcad.id);
      setShowCreateModal(false);
      setNewAcademyName('');
      setNewAcademyDescription('');
      setSuccessMsg(`Akademi "${newAcademyName.trim()}" berhasil dibuat! Workspace aktif kini diperbarui.`);
      fetchAcademyData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error creating academy:', err);
      setErrorMsg('Gagal membuat akademi baru. Silakan coba lagi.');
    } finally {
      setIsSavingAcademy(false);
    }
  };

  // Sync sportCategory default value with uniqueSports
  useEffect(() => {
    if (uniqueSports.length > 0 && (!sportCategory || !uniqueSports.includes(sportCategory))) {
      setSportCategory(uniqueSports[0]);
    }
  }, [uniqueSports.length, sportCategory]);

  // Fetch Provinces from Emsifa API when Student Modal opens
  useEffect(() => {
    if (showAddModal && provinces.length === 0) {
      async function fetchProvinces() {
        setLoadingProvinces(true);
        try {
          const res = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
          if (!res.ok) throw new Error('Gagal memuat data provinsi');
          const data = await res.json();
          setProvinces(data || []);
        } catch (err) {
          console.error('Emsifa Provinces Fetch Error:', err);
          setProvinces([]);
        } finally {
          setLoadingProvinces(false);
        }
      }

      fetchProvinces();
    }
  }, [showAddModal, provinces.length]);

  // Emsifa Handlers
  const handleProvinceChange = async (e) => {
    const provId = e.target.value;
    if (!provId) {
      setSelectedProvince(null);
      setRegencies([]);
      setSelectedRegency(null);
      setDistricts([]);
      setSelectedDistrict(null);
      setVillages([]);
      setSelectedVillage(null);
      return;
    }

    const foundProv = provinces.find((p) => p.id === provId);
    setSelectedProvince(foundProv ? { id: foundProv.id, name: foundProv.name } : null);

    setRegencies([]);
    setSelectedRegency(null);
    setDistricts([]);
    setSelectedDistrict(null);
    setVillages([]);
    setSelectedVillage(null);

    setLoadingRegencies(true);
    try {
      const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provId}.json`);
      if (!res.ok) throw new Error('Gagal memuat data kota/kabupaten');
      const data = await res.json();
      setRegencies(data || []);
    } catch (err) {
      console.error('Emsifa Regencies Fetch Error:', err);
      setRegencies([]);
    } finally {
      setLoadingRegencies(false);
    }
  };

  const handleRegencyChange = async (e) => {
    const regId = e.target.value;
    if (!regId) {
      setSelectedRegency(null);
      setDistricts([]);
      setSelectedDistrict(null);
      setVillages([]);
      setSelectedVillage(null);
      return;
    }

    const foundReg = regencies.find((r) => r.id === regId);
    setSelectedRegency(foundReg ? { id: foundReg.id, name: foundReg.name } : null);

    setDistricts([]);
    setSelectedDistrict(null);
    setVillages([]);
    setSelectedVillage(null);

    setLoadingDistricts(true);
    try {
      const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${regId}.json`);
      if (!res.ok) throw new Error('Gagal memuat data kecamatan');
      const data = await res.json();
      setDistricts(data || []);
    } catch (err) {
      console.error('Emsifa Districts Fetch Error:', err);
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const handleDistrictChange = async (e) => {
    const distId = e.target.value;
    if (!distId) {
      setSelectedDistrict(null);
      setVillages([]);
      setSelectedVillage(null);
      return;
    }

    const foundDist = districts.find((d) => d.id === distId);
    setSelectedDistrict(foundDist ? { id: foundDist.id, name: foundDist.name } : null);

    setVillages([]);
    setSelectedVillage(null);

    setLoadingVillages(true);
    try {
      const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${distId}.json`);
      if (!res.ok) throw new Error('Gagal memuat data kelurahan');
      const data = await res.json();
      setVillages(data || []);
    } catch (err) {
      console.error('Emsifa Villages Fetch Error:', err);
      setVillages([]);
    } finally {
      setLoadingVillages(false);
    }
  };

  const handleVillageChange = (e) => {
    const vilId = e.target.value;
    if (!vilId) {
      setSelectedVillage(null);
      return;
    }
    const foundVil = villages.find((v) => v.id === vilId);
    setSelectedVillage(foundVil ? { id: foundVil.id, name: foundVil.name } : null);
  };

  const resetFormState = () => {
    setStudentName('');
    setBirthDate('');
    setNikKk('');
    setSchoolOrigin('');
    setParentName('');
    setParentPhone('');
    setStudentClassId('');
    setSelectedProvince(null);
    setSelectedRegency(null);
    setSelectedDistrict(null);
    setSelectedVillage(null);
    setAddressDetail('');
    setErrorMsg(null);
  };

  const handleStudentClassChange = (classId) => {
    setStudentClassId(classId);
    if (classId) {
      const selected = academyClasses.find((c) => c.id === classId);
      if (selected?.sport) {
        setSportCategory(selected.sport);
      }
    }
  };

  // Add New Student Handler
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!studentName.trim() || !tenantId) {
      setErrorMsg('Nama lengkap siswa wajib diisi.');
      return;
    }

    if (!birthDate) {
      setErrorMsg('Tanggal lahir siswa wajib diisi.');
      return;
    }

    setSavingStudent(true);
    setSuccessMsg(null);

    try {
      const selectedClassObj = academyClasses.find((c) => c.id === studentClassId);

      const newStudent = await supabaseAcademyService.createStudent({
        tenantId,
        academyId: activeAcademy?.id || '',
        classId: studentClassId || null,
        studentName: studentName.trim(),
        birthDate: birthDate,
        playerRole: 'All-Rounder',
        sportCategory: sportCategory || (selectedClassObj?.sport || uniqueSports[0] || 'Umum'),
        sppStatus: 'Belum Lunas'
      });

      // Update state lokal optimistik dan fetch ulang data
      setStudents((prev) => [newStudent, ...prev]);
      setShowAddModal(false);
      resetFormState();
      setSuccessMsg('Siswa baru berhasil didaftarkan ke akademi!');
      fetchAcademyData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error adding student to Supabase:', err);
      setErrorMsg('Gagal mendaftarkan siswa. Silakan coba lagi.');
    } finally {
      setSavingStudent(false);
    }
  };

  // Otomatisasi Penagihan SPP via WhatsApp (Enterprise Fase 11 Part 5)
  const handleSendWABilling = (student, academyName) => {
    const phone = formatWhatsAppNumber(student?.parentPhone || student?.phone);
    if (!phone) {
      if (typeof alert !== 'undefined') {
        alert('Nomor telepon tidak tersedia untuk siswa ini.');
      }
      return;
    }

    // Format mata uang
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
    const fee = formatter.format(student?.monthlyFee || student?.tuitionFee || 0);
    const targetAcademy = academyName || activeAcademy?.name || arenaName || 'Chua Sport Academy';
    const studentName = student?.studentName || student?.name || 'Siswa';

    // Rincian rekening pembayaran dari profil GOR/Tenant
    let rekeningText = 'BCA: 123456789 a.n CHUA SPORT';
    if (tenantProfile?.bankAccounts && tenantProfile.bankAccounts.length > 0) {
      const primaryBank = tenantProfile.bankAccounts[0];
      if (primaryBank.bankName && primaryBank.accountNumber) {
        rekeningText = `${primaryBank.bankName}: ${primaryBank.accountNumber} a.n ${primaryBank.accountName || targetAcademy}`;
      }
    } else if (tenantProfile?.bankAccountNumber) {
      rekeningText = `${tenantProfile.bankName || 'Bank'}: ${tenantProfile.bankAccountNumber} a.n ${tenantProfile.bankAccountName || targetAcademy}`;
    }

    // Template Pesan Penagihan
    const message = `Halo Kak,\nKami dari admin *${targetAcademy}* menginformasikan bahwa terdapat tagihan SPP untuk bulan ini atas nama siswa *${studentName}* senilai *${fee}* yang belum diselesaikan.\n\nPembayaran dapat dilakukan melalui kasir GOR atau transfer ke rekening:\n${rekeningText}\n\nMohon konfirmasi jika sudah melakukan pembayaran dengan melampirkan bukti transfer. Terima kasih banyak! 🙏`;

    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    
    window.open(waUrl, '_blank');
  };

  const getStudentInitials = (name) => {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-3.5 text-slate-800">
      
      {/* ==================================================== */}
      {/* 1. UI WORKSPACE SELECTOR & HEADER (DESKTOP & MOBILE HUB/SUBPAGE) */}
      {/* ==================================================== */}
      {academies.length > 0 && (
        <>
          {/* DESKTOP HEADER (HIDDEN ON MOBILE) */}
          <div className="hidden lg:block bg-white dark:bg-[#14211E] rounded-xl p-3 sm:p-3.5 shadow-xs border border-slate-200/80 dark:border-white/10 mb-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#354944] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 border border-[#C89D32]/40">
                  {activeAcademy?.name ? activeAcademy.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.2 bg-[#354944]/10 dark:bg-white/10 text-[#354944] dark:text-[#C89D32] font-semibold text-[9px] rounded border border-[#354944]/20 uppercase tracking-wider">
                      Workspace
                    </span>
                    <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-medium text-[9px] rounded">
                      {activeAcademy?.sport || 'General Sports'}
                    </span>
                  </div>
                  <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5 truncate">
                    {activeAcademy?.name || 'Akademi Olahraga'}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-lg px-2.5 py-1.5 shadow-2xs">
                  <Building2 className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Akademi Aktif</span>
                    <select
                      value={activeAcademyId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setActiveAcademyId(id);
                        localStorage.setItem('activeAcademyId', id);
                      }}
                      className="bg-transparent text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer truncate pr-2"
                    >
                      {academies.map((ac) => (
                        <option key={ac.id} value={ac.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          {ac.name} ({ac.sport || 'Umum'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isCoachOnly ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPwdErr(null);
                      setPwdMsg(null);
                      setShowCoachPasswordModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#354944] hover:bg-[#2B3D38] text-[#C89D32] font-semibold text-xs rounded-lg border border-[#C89D32]/40 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Ganti Password</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="px-3 py-1.5 bg-[#354944] hover:bg-[#2B3D38] text-white font-semibold text-xs rounded-lg border-b-2 border-[#C89D32] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3 text-[#C89D32]" />
                    <span>+ Akademi Baru</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MOBILE ACADEMY HUB (FULL-SCREEN GRID MENU LAUNCHER WHEN mobileAcademyHubMode === true) */}
          {mobileAcademyHubMode && (
            <div className="block lg:hidden space-y-4 pb-12">
              {/* Hero Section & Floating Workspace Card */}
              <div className="bg-[#354944] text-white pt-4 pb-12 px-5 rounded-3xl shadow-lg relative overflow-hidden space-y-1.5">
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <h2 className="text-lg font-black tracking-tight">{activeAcademy?.name || 'Workspace Akademi'}</h2>
                <p className="text-xs text-slate-300">Pilih menu operasional akademi untuk mulai mengelola.</p>
              </div>

              {/* Floating Workspace Card */}
              <div className="bg-white dark:bg-[#162320] rounded-3xl p-4 shadow-xl border border-slate-100 dark:border-white/10 mt-[-36px] relative z-10 mx-2 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-2xs min-w-0">
                    <Building2 className="w-4 h-4 text-[#354944] dark:text-[#C89D32] shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none mb-0.5">Akademi Aktif</span>
                      <select
                        value={activeAcademyId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setActiveAcademyId(id);
                          localStorage.setItem('activeAcademyId', id);
                        }}
                        className="bg-transparent text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer truncate pr-2 w-full"
                      >
                        {academies.map((ac) => (
                          <option key={ac.id} value={ac.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {ac.name} ({ac.sport || 'Umum'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="px-3 py-2 bg-[#354944] text-white font-bold text-xs rounded-xl border-b-2 border-[#C89D32] shrink-0"
                  >
                    + Baru
                  </button>
                </div>

                {/* 3 Mini Metrics */}
                <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-white/10 pt-3 mt-3 text-center border-t border-slate-100 dark:border-white/10">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Siswa Aktif</span>
                    <strong className="text-sm font-black text-slate-900 dark:text-slate-100">{filteredStudents.length}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Kelas</span>
                    <strong className="text-sm font-black text-slate-900 dark:text-slate-100">{filteredClasses.length}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Pelunasan SPP</span>
                    <strong className="text-sm font-black text-emerald-600">{sppPaidPercentage}%</strong>
                  </div>
                </div>
              </div>

              {/* Grid Menu Utama Akademi */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-1">
                  MENU OPERASIONAL AKADEMI
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setActiveAcademyTab('dasbor'); setMobileAcademyHubMode(false); }}
                    className="bg-white dark:bg-[#162320] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left space-y-2 active:scale-95 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      📊
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Dasbor &amp; Laporan</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Analitik BI &amp; Arus SPP</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveAcademyTab('siswa'); setMobileAcademyHubMode(false); }}
                    className="bg-white dark:bg-[#162320] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left space-y-2 active:scale-95 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="absolute right-2 top-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-black text-[9px]">
                      {filteredStudents.length}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      🎓
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Siswa &amp; SPP</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Data Atlet &amp; Tagihan</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveAcademyTab('pelatih'); setMobileAcademyHubMode(false); }}
                    className="bg-white dark:bg-[#162320] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left space-y-2 active:scale-95 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="absolute right-2 top-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-black text-[9px]">
                      {filteredCoaches.length}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      🏅
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Tim Pelatih</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Data Coach &amp; ID Card</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveAcademyTab('kelas'); setMobileAcademyHubMode(false); }}
                    className="bg-white dark:bg-[#162320] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left space-y-2 active:scale-95 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="absolute right-2 top-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md font-black text-[9px]">
                      {filteredClasses.length}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      📚
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Kelas &amp; Jadwal</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Kelompok &amp; Jam Latihan</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveAcademyTab('presensi'); setMobileAcademyHubMode(false); }}
                    className="col-span-2 bg-[#354944] text-white p-4 rounded-2xl border-b-2 border-[#C89D32] shadow-md text-left space-y-2 active:scale-98 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-[#C89D32]/30 text-[#C89D32] rounded font-black text-[9px] uppercase">
                        Modul Utama
                      </span>
                      <h4 className="font-extrabold text-sm text-white">Presensi, Evaluasi Atlet &amp; Growth Tracker</h4>
                      <p className="text-[11px] text-slate-300">Absensi sesi latihan, rapor teknik/fisik &amp; kurva gizi AI</p>
                    </div>
                    <span className="text-lg font-black text-[#C89D32]">→</span>
                  </button>
                </div>
              </div>

              {/* Pintasan Aksi Cepat */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-1">
                  AKSI CEPAT
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setEditingStudent(null); setShowAddModal(true); }}
                    className="py-3 bg-white dark:bg-[#162320] text-[#354944] dark:text-white border border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                    <span>+ Daftar Siswa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClassModal(true)}
                    className="py-3 bg-white dark:bg-[#162320] text-[#354944] dark:text-white border border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                    <span>+ Buat Kelas</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}



      {/* ==================================================== */}
      {/* 2. UI EMPTY STATE & ONBOARDING (JIKA BELUM ADA AKADEMI) */}
      {/* ==================================================== */}
      {academies.length === 0 && !loadingAcademies && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-xl max-w-3xl mx-auto text-center space-y-8 animate-fadeIn my-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg border-2 border-white">
              <School className="w-12 h-12" />
            </div>
          </div>

          <div className="space-y-3 max-w-lg mx-auto">
            <span className="px-3.5 py-1 bg-blue-50 text-blue-700 text-xs font-black rounded-full border border-blue-200 uppercase tracking-widest inline-block">
              EKOSISTEM SIMAK WORKSPACE
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              Mulai Perjalanan Akademi Anda
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Sistem kami mendukung berbagai cabang olahraga. Bangun ruang akademi pertama Anda sekarang.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h4 className="font-extrabold text-xs text-slate-900">Multi-Cabang Olahraga</h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                Kelola akademi Futsal, Badminton, Basket, Voli, &amp; Tenis dalam 1 akun GOR.
              </p>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h4 className="font-extrabold text-xs text-slate-900">Manajemen Siswa &amp; SPP</h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                Sistem penagihan otomatis, pelacakan tunggakan, &amp; pesan WA wali siswa.
              </p>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h4 className="font-extrabold text-xs text-slate-900">Presensi &amp; Evaluasi</h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                Jadwal kelompok umur, absensi harian pelatih, dan rapor perkembangan atlet.
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mx-auto cursor-pointer"
            >
              <Plus className="w-5 h-5 text-cyan-300" />
              <span>+ Buat Akademi Baru Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. TAB OPERASIONAL (KONTEN TAB AKTIF) */}
      {/* ==================================================== */}
      {academies.length > 0 && (
        <div className={`mt-4 ${mobileAcademyHubMode ? 'hidden lg:block' : 'block'}`}>
          {!mobileAcademyHubMode && (
            <div className="flex lg:hidden items-center justify-between bg-white dark:bg-[#162320] p-3 mb-3.5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => setMobileAcademyHubMode(true)}
                className="flex items-center gap-2 text-xs font-bold text-[#354944] dark:text-white cursor-pointer"
              >
                <div className="bg-[#354944] text-white w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                  ←
                </div>
                <span>Menu Akademi</span>
              </button>
              <div className="text-right">
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-white">{getActivePageTitle()}</h4>
                <p className="text-[10px] text-[#C89D32] font-semibold">{activeAcademy?.name || ''}</p>
              </div>
            </div>
          )}

      {/* TAB 1: DASBOR & LAPORAN (BI & ANALYTICS) */}
      {activeAcademyTab === 'dasbor' && (
        <AcademyDashboard
          activeAcademy={activeAcademy}
          activeStudents={activeStudents}
          activeClasses={activeClasses}
          activeCoaches={activeCoaches}
          sppBillingStartDay={sppBillingStartDay}
          sppDueDay={sppDueDay}
          calculateSppStatus={calculateSppStatus}
          handleSendWABilling={handleSendWABilling}
          onAddStudent={() => setShowAddModal(true)}
          onAddClass={() => setShowClassModal(true)}
          onPaySpp={(st) => setPaymentModalStudent(st)}
          onViewStudentDetail={(st) => setDetailModalStudent(st)}
        />
      )}

      {/* TAB 2: SISWA & SPP */}
      {activeAcademyTab === 'siswa' && (
        <div className="bg-white dark:bg-[#14211E] rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2.5">
            <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-[#354944] dark:text-[#C89D32]" />
              <span>Daftar Siswa ({filteredStudents.length})</span>
            </h2>

            <button
              type="button"
              onClick={() => {
                setEditingStudent(null);
                setShowAddModal(true);
              }}
              className="px-3 py-1.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Siswa Baru</span>
            </button>
          </div>

          {loadingStudents ? (
            <div className="py-12 text-center text-xs text-gray-500 font-medium">Memuat data siswa akademi...</div>
          ) : filteredStudents.length === 0 ? (
            /* MANDATORY ZERO MOCK DATA EMPTY STATE UI */
            <div className="py-12 border-2 border-dashed border-gray-200 rounded-xl text-center flex flex-col items-center justify-center p-6">
              <GraduationCap className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-700">
                Belum ada siswa terdaftar di akademi {activeAcademy?.name || ''}. Tambahkan siswa baru.
              </p>
              <p className="text-xs text-gray-400 max-w-sm mt-1 mb-4">
                Klik tombol "+ Tambah Siswa Baru" di atas untuk mendaftarkan siswa pertama akademi Anda.
              </p>
              <button
                onClick={() => {
                  setEditingStudent(null);
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                + Tambah Siswa Pertama
              </button>
            </div>
          ) : (
            /* DAFTAR SISWA (LIST VIEW / ROW HORIZONTAL MODERN) */
            <div className="space-y-2">
              {filteredStudents.map((st) => {
                const sppInfo = calculateSppStatus(st, sppBillingStartDay, sppDueDay);
                const waUrl = formatWhatsAppUrl(st.parentPhone, st.studentName, arenaName);
                const age = calculateAge(st.birthDate);

                return (
                  <div
                    key={st.id}
                    className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between p-3 border border-slate-200/80 dark:border-white/10 rounded-xl bg-white dark:bg-[#162320] mb-2 hover:border-[#354944]/40 hover:shadow-xs transition-all"
                  >
                    {/* Area 1: Profil Siswa (Kiri) */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Avatar Foto atau Inisial */}
                      {st.photoUrl ? (
                        <img
                          src={st.photoUrl}
                          alt={st.studentName}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[#354944]/30 shadow-2xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#354944] text-white font-bold flex items-center justify-center text-xs flex-shrink-0 border border-[#C89D32]/40 shadow-2xs">
                          {getStudentInitials(st.studentName)}
                        </div>
                      )}

                      {/* Teks: Nama Siswa (tanpa truncate) & Usia / Asal Sekolah */}
                      <div className="min-w-0 flex-1">
                        <h3
                          className="font-bold text-gray-900 whitespace-normal break-words text-sm sm:text-base leading-snug hover:text-[#354944] transition-colors cursor-pointer"
                          onClick={() => setDetailModalStudent(st)}
                          title={st.studentName}
                        >
                          {st.studentName}
                        </h3>
                        <p className="text-xs text-gray-500 break-words whitespace-normal mt-0.5 leading-relaxed">
                          {age !== '-' && (
                            <span>{age} Tahun</span>
                          )}
                          {age !== '-' && st.schoolOrigin && (
                            <span className="mx-1.5 text-gray-400">&bull;</span>
                          )}
                          {st.schoolOrigin && (
                            <span>{st.schoolOrigin}</span>
                          )}
                          {age === '-' && !st.schoolOrigin && (
                            <span className="text-gray-400">-</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Area 2: Info Akademi (Tengah Kiri) */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      {/* Badge Cabang & Kelas Sejajar */}
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-[#354944]/10 text-[#354944] font-semibold text-xs rounded border border-[#354944]/20">
                          {st.sportCategory || activeAcademy?.sport || 'Olahraga'}
                        </span>
                        {st.className && (
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-medium text-xs rounded border border-slate-200">
                            {st.className}
                          </span>
                        )}
                      </div>

                      {/* Teks Abu-abu Kecil dengan Ikon User untuk Nama Pelatih */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <span>Pelatih: </span>
                          <span className="font-medium text-gray-700">{st.coachName || 'Belum Ditentukan'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Area 3: Kontak Wali & Keuangan (Tengah Kanan) */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      {/* Nama Wali & No HP dengan Ikon Phone */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <span>{st.parentName || '-'}</span>
                          {st.parentPhone && (
                            <span className="text-gray-500 text-[11px] ml-1">({st.parentPhone})</span>
                          )}
                        </span>
                      </div>

                      {/* Badge Status SPP */}
                      <div className="mt-0.5">
                        {sppInfo.isPaid ? (
                          <span className="inline-block px-2.5 py-0.5 bg-green-100 text-green-700 font-bold text-[10px] rounded-full uppercase tracking-wider border border-green-200/80">
                            LUNAS BULAN INI
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 bg-rose-100 text-rose-700 font-bold text-[10px] rounded-full uppercase tracking-wider border border-rose-200/80">
                            {sppInfo.statusText || 'MENUNGGAK'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Area 4: Aksi (Kanan) */}
                    <div className="flex items-center gap-2 justify-start lg:justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                      {/* Tombol Utama: Hubungi Wali */}
                      {st.parentPhone ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-lg transition-colors cursor-pointer"
                          title="Hubungi Wali Murid via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Hubungi Wali</span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-50 rounded-lg select-none">
                          <MessageCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <span>Tanpa No. HP</span>
                        </span>
                      )}

                      {/* Tombol Bayar SPP jika belum lunas */}
                      {!sppInfo.isPaid && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalStudent(st)}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-200/80"
                          title="Catat Pembayaran SPP"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}

                      {/* Tombol Ikon Tambahan: ID Card, Detail & Edit */}
                      <button
                        type="button"
                        onClick={() => setIdCardTarget({ data: st, role: 'SISWA' })}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Generate ID Card Siswa"
                      >
                        <IdCard className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailModalStudent(st)}
                        className="p-1.5 text-slate-400 hover:text-[#354944] hover:bg-[#354944]/10 rounded-lg transition-colors cursor-pointer"
                        title="Lihat Detail Siswa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingStudent(st);
                          setShowAddModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Siswa / Pindah Kelas"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PELATIH */}
      {activeAcademyTab === 'pelatih' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm sm:text-base text-slate-800 flex items-center space-x-2" style={{ fontSize: '15px' }}>
              <User className="w-4 h-4 text-[#354944]" />
              <span>Tim Pelatih ({filteredCoaches.length})</span>
            </h2>

            <button
              onClick={() => setShowCoachModal(true)}
              className="px-3.5 py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Tambah Pelatih</span>
            </button>
          </div>

          {loadingCoaches ? (
            <p className="py-12 text-center text-xs text-slate-500">Memuat data pelatih...</p>
          ) : filteredCoaches.length === 0 ? (
            /* EMPTY STATE UNTUK TAB PELATIH */
            <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center p-6">
              <User className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Belum ada pelatih terdaftar di akademi ini.</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                Daftarkan instruktur &amp; pelatih utama untuk memimpin kelas latihan {activeAcademy?.name || 'akademi Anda'}.
              </p>
              <button
                onClick={() => {
                  setEditingCoach(null);
                  setShowCoachModal(true);
                }}
                className="px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                + Tambah Pelatih Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCoaches.map((c) => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#354944]/40 hover:shadow-xs transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-[#354944]/10 text-[#354944] font-bold text-[9px] rounded-md uppercase">
                        {c.sportSpecialty || 'Badminton'}
                      </span>
                      {c.license && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 font-bold text-[9px] rounded-md">
                          {c.license}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIdCardTarget({ data: c, role: 'PELATIH' })}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Generate ID Card Pelatih"
                      >
                        <IdCard className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCoach(c);
                          setShowCoachModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-[#354944] hover:bg-[#354944]/10 rounded-lg transition-colors cursor-pointer"
                        title="Edit Data Pelatih"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {c.photoUrl ? (
                      <img
                        src={c.photoUrl}
                        alt={c.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#354944]/30 shadow-2xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#354944] text-white font-bold flex items-center justify-center text-sm shrink-0 border border-[#C89D32]/40 shadow-2xs">
                        {getStudentInitials(c.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-800 truncate" title={c.name}>
                        {c.name}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5 truncate">
                        <Phone className="w-3 h-3 text-green-600 shrink-0" />
                        <span>{c.phone || 'Tidak ada nomor WhatsApp'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: KELAS & KELOMPOK */}
      {activeAcademyTab === 'kelas' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm sm:text-base text-slate-800 flex items-center space-x-2" style={{ fontSize: '15px' }}>
              <BookOpen className="w-4 h-4 text-[#354944]" />
              <span>Daftar Kelas ({filteredClasses.length})</span>
            </h2>

            <button
              onClick={() => setShowClassModal(true)}
              className="px-3.5 py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Buat Kelas</span>
            </button>
          </div>

          {loadingClasses ? (
            <p className="py-12 text-center text-xs text-slate-500">Memuat daftar kelas...</p>
          ) : filteredClasses.length === 0 ? (
            /* EMPTY STATE UNTUK TAB KELAS */
            <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center p-6">
              <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Belum ada kelas/kelompok latihan.</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                Buat kelas latihan berdasarkan kelompok umur &amp; alokasikan pelatih utama.
              </p>
              <button
                onClick={() => setShowClassModal(true)}
                className="px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                + Buat Kelas Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClasses.map((cls) => {
                const scheduleItems = parseScheduleItems(cls);
                const enrolledCount = filteredStudents.filter((s) => s.classId === cls.id).length;
                const maxQuota = Number(cls.maxQuota) > 0 ? Number(cls.maxQuota) : 20;
                const isFull = enrolledCount >= maxQuota;

                return (
                  <div key={cls.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-4 hover:border-[#354944]/40 transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      {/* Header Kelas */}
                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 bg-[#354944]/10 dark:bg-[#354944]/30 text-[#354944] dark:text-[#C89D32] font-bold text-[10px] rounded-md uppercase border border-[#354944]/20">
                            {cls.sport || 'Sports'}
                          </span>
                          {cls.tierCode && cls.tierCode !== 'ALL_AGE' && (
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-[#C89D32] font-extrabold text-[10px] rounded-md border border-amber-200/80 dark:border-amber-800/60 truncate max-w-[150px]" title={cls.tierLabel || cls.tierCode}>
                              {cls.tierLabel || cls.tierCode}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/50">Aktif</span>
                      </div>

                      {/* Judul & Pelatih */}
                      <div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">{cls.className}</h4>
                        <div className="flex items-center justify-between mt-1 flex-wrap gap-1 text-xs">
                          <p className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Pelatih: <strong className="text-slate-800 dark:text-slate-200">{cls.coachName || 'Pelatih Utama'}</strong></span>
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isFull 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}>
                            Kuota: {enrolledCount}/{maxQuota} Atlet {isFull ? '● Penuh' : ''}
                          </span>
                        </div>
                        {((cls.minAge !== undefined && cls.minAge !== null) || (cls.maxAge !== undefined && cls.maxAge !== null)) && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Target Usia: <strong className="text-slate-600 dark:text-slate-300">{cls.minAge || 0} - {cls.maxAge || 99} Tahun</strong>
                          </p>
                        )}
                      </div>

                      {/* Daftar Jadwal Per Hari (Vertical List) */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32] shrink-0" />
                            <span>Jadwal Latihan Rutin</span>
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {scheduleItems.length} Sesi/Minggu
                          </span>
                        </div>

                        {scheduleItems.length === 0 ? (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                            Belum ada jadwal
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {scheduleItems.map((item, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/70 flex items-center justify-between gap-2 p-2 rounded-lg shadow-2xs text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                                  <span className="text-[#354944] dark:text-[#C89D32] font-bold text-xs shrink-0">📅 {item.day}</span>
                                  {item.time && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600 font-bold text-[10px] hidden sm:inline">&bull;</span>
                                      <span className="bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-slate-200/60 dark:border-slate-600/70 shrink-0">
                                        {item.time}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {item.court && (
                                  <span className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ml-2 shrink-0">
                                    ({item.court})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tombol Kunci Jadwal */}
                    <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setGenerateModalClass(cls)}
                        className="w-full py-2 bg-[#354944]/10 dark:bg-[#354944]/30 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20 hover:bg-[#354944]/20 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                      >
                        <Lock className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                        <span>Kunci Jadwal Lapangan</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PRESENSI & EVALUASI */}
      {activeAcademyTab === 'presensi' && (
        <div className="space-y-6 text-left">
          {/* HERO SECTION BERGRADIEN ELEGAN (#354944) */}
          <div className="hidden lg:block bg-[#354944] text-white p-5 sm:p-6 pb-12 rounded-3xl shadow-lg relative overflow-hidden space-y-2">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-[#C89D32]/20 text-[#C89D32] border border-[#C89D32]/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                Modul Akademik &amp; Asesmen
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {activeAcademy?.name || 'Workspace Aktif'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">Presensi &amp; Evaluasi Atlet</h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Pencatatan presensi harian, rapor asesmen performa komprehensif, dan kurva tumbuh kembang antropometri atlet.
            </p>
          </div>

          {/* KONTANTER KONTEN UTAMA DENGAN EFEK KARTU MENGAMBANG MELENGKUNG */}
          <div className="rounded-3xl lg:rounded-t-3xl bg-[#F8FAF9] dark:bg-[#0F1715] shadow-2xl p-4 sm:p-6 mt-0 lg:mt-[-32px] relative z-10 border border-slate-200/70 dark:border-slate-800 space-y-5">
            
            {/* BARIS KONTROL ATAS: SEGMENTED NAVIGATION PILLS + FILTER DROPDOWN KELAS GLOBAL */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-2.5 bg-white dark:bg-[#162320] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              
              {/* 1. SEGMENTED CONTROL 3 TAB (1 BARIS PENUH TANPA SCROLL) */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 dark:bg-[#111C19] rounded-2xl w-full">
                <button
                  type="button"
                  onClick={() => setAttendanceSubTab('presensi')}
                  className={`text-[11px] font-bold py-2 text-center rounded-xl transition-all cursor-pointer ${
                    attendanceSubTab === 'presensi'
                      ? 'bg-[#354944] text-white shadow-sm border-b-2 border-[#C89D32]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Presensi
                </button>

                <button
                  type="button"
                  onClick={() => setAttendanceSubTab('evaluasi')}
                  className={`text-[11px] font-bold py-2 text-center rounded-xl transition-all cursor-pointer ${
                    attendanceSubTab === 'evaluasi'
                      ? 'bg-[#354944] text-white shadow-sm border-b-2 border-[#C89D32]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Evaluasi Atlet
                </button>

                <button
                  type="button"
                  onClick={() => setAttendanceSubTab('antropometri')}
                  className={`text-[11px] font-bold py-2 text-center rounded-xl transition-all cursor-pointer ${
                    attendanceSubTab === 'antropometri'
                      ? 'bg-[#354944] text-white shadow-sm border-b-2 border-[#C89D32]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Growth Tracker
                </button>
              </div>

              {/* 2. DROPDOWN KELAS SEBAGAI FILTER GLOBAL */}
              <div className="flex items-center gap-2.5 shrink-0 w-full xl:w-80">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">
                  Kelas:
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#354944] focus:ring-2 focus:ring-[#354944]/20 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <option value="">-- Pilih Kelas Latihan --</option>
                  {filteredClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.className} - {cls.sport || 'Umum'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* RENDER CONTENT SESUAI KELAS TERPILIH & MODE TAB AKTIF */}
            {!selectedClassId ? (
              /* EMPTY STATE: BELUM MEMILIH KELAS */
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center p-6 bg-slate-50/50">
                <ClipboardCheck className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  {filteredClasses.length === 0
                    ? 'Belum ada kelas/kelompok latihan terdaftar.'
                    : 'Pilih kelas terlebih dahulu untuk mulai mencatat presensi, evaluasi, atau growth tracking.'}
                </p>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                  {filteredClasses.length === 0
                    ? 'Buat kelas latihan terlebih dahulu di tab "Kelas & Kelompok" untuk mulai mengelola presensi.'
                    : 'Pilih salah satu kelas pada dropdown filter di atas untuk membuka lembar kerja.'}
                </p>
                {filteredClasses.length === 0 && (
                  <button
                    onClick={() => setActiveAcademyTab('kelas')}
                    className="px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm"
                  >
                    + Buat Kelas Baru
                  </button>
                )}
              </div>
            ) : (
              /* KELAS DIPILIH: RINCIAN KELAS RINGKAS & BERSIH (TANPA DUPLIKASI TOMBOL TAB) */
              <div className="space-y-4">
                {(() => {
                  const currentClass = filteredClasses.find((c) => c.id === selectedClassId);
                  if (!currentClass) return null;

                  return (
                    <div className={`${attendanceSubTab === 'evaluasi' || attendanceSubTab === 'antropometri' ? 'hidden lg:flex' : 'flex'} flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2.5`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 tracking-tight">
                          {currentClass.className}
                        </h3>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 bg-[#354944]/10 dark:bg-[#354944]/30 text-[#354944] dark:text-[#C89D32] font-medium text-[11px] rounded-full border border-[#354944]/20">
                            {currentClass.sport || 'Sports'}
                          </span>
                          {currentClass.ageGroup && (
                            <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium text-[11px] rounded-full border border-emerald-100/80 dark:border-emerald-800/50">
                              {currentClass.ageGroup}
                            </span>
                          )}
                        </div>

                        <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block" />

                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1" title="Pelatih">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">{currentClass.coachName || 'Instruktur'}</span>
                          </span>
                          <span className="flex items-center gap-1" title="Jadwal Latihan">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">{currentClass.schedule || '-'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* MEMANGGIL KONTEN UTAMA DENGAN DISPLAY TOGGLE (KEEP-ALIVE CACHE) */}
                {(() => {
                  const currentClass = filteredClasses.find((c) => c.id === selectedClassId);
                  if (!currentClass) return null;

                  return (
                    <div>
                      <div className={attendanceSubTab === 'presensi' ? 'block' : 'hidden'}>
                        <AttendanceSection
                          selectedClass={currentClass}
                          students={filteredStudents}
                          tenantId={tenantId}
                        />
                      </div>

                      <div className={attendanceSubTab === 'evaluasi' ? 'block' : 'hidden'}>
                        <EvaluationSection
                          selectedClass={currentClass}
                          students={filteredStudents}
                          tenantId={tenantId}
                          activeAcademy={activeAcademy}
                        />
                      </div>

                      <div className={attendanceSubTab === 'perkembangan' || (attendanceSubTab !== 'presensi' && attendanceSubTab !== 'evaluasi') ? 'block' : 'hidden'}>
                        <GrowthTrackerSection
                          students={filteredStudents.filter((s) => s.classId === currentClass.id)}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}

      {/* MODAL 1: PENDAFTARAN & EDIT SISWA AKADEMI (RELASIONAL) */}
      <StudentRegistrationModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingStudent(null);
        }}
        academyClasses={filteredClasses}
        activeAcademy={activeAcademy}
        activeAcademyId={activeAcademy?.id}
        tenantId={tenantId}
        uniqueSports={activeAcademySports}
        studentToEdit={editingStudent}
        academyPricing={tenantProfile?.academyPricing}
        onSuccess={(saved) => {
          setSuccessMsg(editingStudent ? `Data siswa ${saved.studentName} berhasil diperbarui!` : 'Siswa baru berhasil didaftarkan ke akademi!');
          fetchAcademyData();
          setTimeout(() => setSuccessMsg(null), 4000);
        }}
      />
      {/* MODAL 2: PEMBAYARAN SPP & PENDAFTARAN AKADEMI */}
      {paymentModalStudent && (
        <SppPaymentModal
          isOpen={!!paymentModalStudent}
          onClose={() => setPaymentModalStudent(null)}
          student={paymentModalStudent}
          userProfile={userProfile}
          onPaymentSuccess={(updatedStudent, receiptData) => {
            setSuccessMsg(`Pembayaran untuk ${updatedStudent.studentName} berhasil dibayar & dicatat!`);
            if (receiptData) {
              setSppReceiptData(receiptData);
            }
            fetchAcademyData();
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      )}

      {/* MODAL 3: STUDENT DETAIL DASHBOARD WITH 3 TABS */}
      {detailModalStudent && (
        <StudentDetailModal
          isOpen={!!detailModalStudent}
          onClose={() => setDetailModalStudent(null)}
          student={detailModalStudent}
          userProfile={userProfile}
          academyClasses={filteredClasses}
          onEditStudent={(st) => {
            setEditingStudent(st);
            setShowAddModal(true);
            setDetailModalStudent(null);
          }}
          onStudentUpdated={(updatedStudent) => {
            setDetailModalStudent(updatedStudent);
            fetchAcademyData();
          }}
          onGenerateIdCard={(st) => {
            setIdCardTarget({ data: st, role: 'SISWA' });
          }}
        />
      )}

      {/* MODAL 4: TAMBAH / EDIT PELATIH */}
      {showCoachModal && (
        <CoachModal
          isOpen={showCoachModal}
          onClose={() => {
            setShowCoachModal(false);
            setEditingCoach(null);
          }}
          userProfile={userProfile}
          activeAcademy={activeAcademy}
          uniqueSports={activeAcademySports}
          coachToEdit={editingCoach}
          onCoachAdded={() => {
            setSuccessMsg('Pelatih baru berhasil ditambahkan!');
            fetchAcademyData();
            setTimeout(() => setSuccessMsg(null), 3000);
          }}
          onCoachUpdated={() => {
            setSuccessMsg('Data pelatih berhasil diperbarui!');
            fetchAcademyData();
            setTimeout(() => setSuccessMsg(null), 3000);
          }}
        />
      )}

      {/* MODAL 5: BUAT KELAS AKADEMI BARU */}
      {showClassModal && (
        <ClassModal
          isOpen={showClassModal}
          onClose={() => setShowClassModal(false)}
          userProfile={userProfile}
          activeAcademy={activeAcademy}
          uniqueSports={activeAcademySports}
          coaches={filteredCoaches}
          courts={courts}
          onClassAdded={() => {
            setSuccessMsg('Kelas baru berhasil dibuat!');
            fetchAcademyData();
            setTimeout(() => setSuccessMsg(null), 3000);
          }}
        />
      )}

      {/* MODAL 6: GENERATE / KUNCI JADWAL LAPANGAN AKADEMI */}
      {generateModalClass && (
        <GenerateAcademyScheduleModal
          isOpen={!!generateModalClass}
          onClose={() => setGenerateModalClass(null)}
          academyClass={generateModalClass}
          tenantId={tenantId}
        />
      )}

      {/* MODAL 7: PEMBUATAN AKADEMI BARU (MULTI-ACADEMY WORKSPACE) */}
      <CreateAcademyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userProfile={userProfile}
        onAcademyCreated={(newId, academyName) => {
          setActiveAcademyId(newId);
          localStorage.setItem('activeAcademyId', newId);
          setSuccessMsg(`Akademi "${academyName}" berhasil dibuat! Workspace aktif kini diperbarui.`);
          fetchAcademyData();
          setTimeout(() => setSuccessMsg(null), 3500);
        }}
      />

      {/* MODAL 8: STRUK THERMAL UNIVERSAL DENGAN PRINTER SIMULATOR */}
      <GlobalReceiptModal
        isOpen={!!sppReceiptData}
        onClose={() => setSppReceiptData(null)}
        transactionData={sppReceiptData}
        tenantData={tenantProfile}
      />

      {/* MODAL 9: GENERATE DIGITAL ID CARD (SISWA & PELATIH) */}
      <IdCardGenerator
        isOpen={Boolean(idCardTarget)}
        onClose={() => setIdCardTarget(null)}
        data={idCardTarget?.data}
        role={idCardTarget?.role || 'SISWA'}
        tenantData={tenantProfile || userProfile?.tenant}
        tenantName={tenantProfile?.name || userProfile?.tenant?.name || arenaName}
        tenantLogo={tenantProfile?.logoUrl || userProfile?.tenant?.logoUrl || ''}
        academyName={activeAcademy?.name || 'Akademi'}
        sportCategory={activeAcademy?.sport || ''}
      />

      {/* MODAL 10: GANTI PASSWORD MANDIRI PELATIH */}
      {showCoachPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#162320] rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#354944] text-[#C89D32] flex items-center justify-center font-bold">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Ubah Password Akun Pelatih</h3>
                  <p className="text-[10px] text-slate-400">Pembaruan kredensial kata sandi mandiri</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCoachPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {pwdErr && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {pwdErr}
              </div>
            )}

            {pwdMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                {pwdMsg}
              </div>
            )}

            <form onSubmit={handleUpdateSelfPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password Baru <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newCoachPassword}
                  onChange={(e) => setNewCoachPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Konfirmasi Password Baru <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmCoachPassword}
                  onChange={(e) => setConfirmCoachPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#354944]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCoachPasswordModal(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white font-bold text-xs rounded-xl border-b-2 border-[#C89D32] shadow-sm disabled:opacity-50"
                >
                  {updatingPassword ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
