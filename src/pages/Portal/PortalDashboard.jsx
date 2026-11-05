import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  LogOut, 
  CreditCard, 
  QrCode, 
  User, 
  Calendar, 
  BookOpen, 
  Sparkles, 
  ShieldCheck, 
  ChevronRight,
  ChevronDown,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Receipt,
  Loader2,
  MapPin,
  CalendarDays,
  XCircle,
  Activity,
  Trophy,
  Medal,
  Star,
  Target,
  TrendingUp,
  Quote,
  Home,
  Users,
  HeartPulse,
  Bell,
  Megaphone,
  Check
} from 'lucide-react';
import { getStudentInitials, calculateAge } from '../../utils/helpers';

/**
 * Helper to format number into IDR currency format
 */
const formatRupiah = (val) => {
  if (val === null || val === undefined || typeof val !== 'number' || isNaN(val) || !Number.isFinite(val)) {
    return '-';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);
};

/**
 * Helper to format attendance date into Indonesian locale
 */
const formatAttendanceDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

/**
 * Helper to format session date into uppercase Indonesian locale (e.g. "JUMAT, 17 NOV 2026")
 */
const formatSessionDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(d.getTime())) return String(dateStr).toUpperCase();
    const formatted = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
    return formatted.toUpperCase();
  } catch {
    return String(dateStr).toUpperCase();
  }
};

/**
 * Helper to determine evaluation score label and style
 */
const getEvaluationGrade = (score) => {
  const s = Number(score) || 0;
  if (s >= 90) return { label: 'Istimewa', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-600' };
  if (s >= 80) return { label: 'Sangat Baik', badge: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-600' };
  if (s >= 70) return { label: 'Baik', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', text: 'text-cyan-600' };
  if (s >= 60) return { label: 'Cukup', badge: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-600' };
  return { label: 'Perlu Bimbingan', badge: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-600' };
};

/**
 * Helper to style achievement and medal badges based on tournament result
 */
const getTournamentMedalStyle = (resultStr) => {
  const r = String(resultStr || '').toLowerCase();
  if (r.includes('1') || r.includes('emas') || r.includes('gold') || r.includes('pertama')) {
    return {
      bg: 'bg-amber-50/60',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      iconColor: 'text-amber-500'
    };
  }
  if (r.includes('2') || r.includes('perak') || r.includes('silver') || r.includes('kedua')) {
    return {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      badge: 'bg-slate-200 text-slate-800 border-slate-300',
      iconColor: 'text-slate-500'
    };
  }
  if (r.includes('3') || r.includes('perunggu') || r.includes('bronze') || r.includes('ketiga')) {
    return {
      bg: 'bg-orange-50/60',
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
      iconColor: 'text-orange-500'
    };
  }
  return {
    bg: 'bg-blue-50/60',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconColor: 'text-blue-500'
  };
};

export default function PortalDashboard() {
  const navigate = useNavigate();

  // 1. Initial State: Stored active student
  const initialStudent = (() => {
    try {
      const stored = localStorage.getItem('activeStudent');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('Gagal membaca data activeStudent:', e);
      return null;
    }
  })();

  const [student, setStudent] = useState(initialStudent);
  const [childrenList, setChildrenList] = useState([]);
  const [showChildSwitcher, setShowChildSwitcher] = useState(false);

  // Verified Backend Session Identity & CSRF Token State
  const [verifiedStudentId, setVerifiedStudentId] = useState(null);
  const [verifiedTenantId, setVerifiedTenantId] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // State Penagihan, QRIS, & Bank
  const [billingData, setBillingData] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankIndex, setSelectedBankIndex] = useState(0);
  const [bankDetails, setBankDetails] = useState({ bank: '', number: '', name: '' });
  const [isLoadingBilling, setIsLoadingBilling] = useState(true);
  const [billingError, setBillingError] = useState(null);
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // State Jadwal & Presensi
  const [scheduleData, setScheduleData] = useState(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [scheduleError, setScheduleError] = useState(null);
  const [activeScheduleTab, setActiveScheduleTab] = useState('jadwal'); // 'jadwal' | 'presensi'

  // State Evaluasi & Prestasi
  const [evaluationData, setEvaluationData] = useState(null);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(true);
  const [evaluationError, setEvaluationError] = useState(null);
  const [activeEvalTab, setActiveEvalTab] = useState('evaluasi'); // 'evaluasi' | 'prestasi'

  // State Pengumuman (Announcements GAP-01)
  const [announcementsData, setAnnouncementsData] = useState(null);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState(null);

  // State Navigation: 'home' | 'billing' | 'schedule' | 'evaluation' | 'announcements'
  const [activeTab, setActiveTab] = useState('home');

  // 2. STRICT SESSION IDENTITY & MULTI-CHILD RESOLUTION (/api/portal/v2/session or /api/portal/session)
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      setIsVerifyingSession(true);
      setSessionError(null);

      try {
        // Try V2 session first
        let response = await fetch('/api/portal/v2/session', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });

        let isV2 = true;
        if (!response.ok) {
          isV2 = false;
          response = await fetch('/api/portal/session', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
          });
        }

        if (response.ok) {
          const res = await response.json().catch(() => ({}));
          const sessionObj = res.session || {};
          const cList = Array.isArray(sessionObj.children) && sessionObj.children.length > 0
            ? sessionObj.children
            : (sessionObj.studentId ? [{
                studentId: sessionObj.studentId,
                tenantId: sessionObj.tenantId,
                studentName: student?.studentName || 'Siswa',
                className: student?.className || 'Reguler',
                academyName: student?.academyName || 'Sport Academy'
              }] : []);

          if (isMounted && res.authenticated && sessionObj.csrfToken && cList.length > 0) {
            setChildrenList(cList);
            setCsrfToken(sessionObj.csrfToken);

            // Select initial student if not set or match against children list
            let selectedChild = cList[0];
            if (student?.id) {
              const matched = cList.find(c => String(c.studentId || c.id).toLowerCase() === String(student.id).toLowerCase());
              if (matched) selectedChild = matched;
            }

            const activeSid = String(selectedChild.studentId || selectedChild.id).trim();
            const activeTid = String(selectedChild.tenantId || '').trim();

            const normalizedStudent = {
              id: activeSid,
              studentId: activeSid,
              tenantId: activeTid,
              studentName: selectedChild.studentName || selectedChild.name || student?.studentName || 'Nama Siswa',
              className: selectedChild.className || student?.className || 'Reguler',
              coachName: selectedChild.coachName || selectedChild.coach_name || student?.coachName || student?.coach_name || null,
              sportCategory: selectedChild.sportCategory || selectedChild.sport || student?.sportCategory || 'Badminton',
              academyName: selectedChild.academyName || student?.academyName || 'Sport Academy',
              photoUrl: selectedChild.photoUrl || student?.photoUrl || null,
              birthDate: selectedChild.birthDate || student?.birthDate || null,
              schoolOrigin: selectedChild.schoolOrigin || student?.schoolOrigin || ''
            };

            setStudent(normalizedStudent);
            localStorage.setItem('activeStudent', JSON.stringify(normalizedStudent));

            setVerifiedStudentId(activeSid);
            setVerifiedTenantId(activeTid);
            setIsSessionVerified(true);
            setIsVerifyingSession(false);
            return;
          }
        }

        // Session invalid, expired, or failed
        if (isMounted) {
          localStorage.removeItem('activeStudent');
          sessionStorage.clear();
          setVerifiedStudentId(null);
          setVerifiedTenantId(null);
          setIsSessionVerified(false);
          setCsrfToken(null);
          setSessionError('Identitas sesi Anda tidak valid. Silakan login kembali.');
          setIsVerifyingSession(false);
        }
      } catch (err) {
        console.error('Portal Session verification error:', err);
        if (isMounted) {
          localStorage.removeItem('activeStudent');
          sessionStorage.clear();
          setVerifiedStudentId(null);
          setVerifiedTenantId(null);
          setIsSessionVerified(false);
          setCsrfToken(null);
          setSessionError('Gagal memverifikasi sesi dengan server. Silakan login kembali.');
          setIsVerifyingSession(false);
        }
      }
    };

    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Multi-Child Switcher Handler
  const handleSelectChild = (child) => {
    const activeSid = String(child.studentId || child.id).trim();
    const activeTid = String(child.tenantId || '').trim();

    const normalizedStudent = {
      id: activeSid,
      studentId: activeSid,
      tenantId: activeTid,
      studentName: child.studentName || child.name || 'Nama Siswa',
      className: child.className || 'Reguler',
      coachName: child.coachName || child.coach_name || null,
      sportCategory: child.sportCategory || child.sport || 'Badminton',
      academyName: child.academyName || 'Sport Academy',
      photoUrl: child.photoUrl || null,
      birthDate: child.birthDate || null,
      schoolOrigin: child.schoolOrigin || ''
    };

    // Immediately clear previous child's evaluations & portal states to prevent stale flash
    setEvaluationData(null);
    setIsLoadingEvaluation(true);
    setEvaluationError(null);

    setBillingData(null);
    setIsLoadingBilling(true);
    setBillingError(null);

    setScheduleData(null);
    setIsLoadingSchedule(true);
    setScheduleError(null);

    setAnnouncementsData(null);
    setIsLoadingAnnouncements(true);
    setAnnouncementsError(null);

    setStudent(normalizedStudent);
    localStorage.setItem('activeStudent', JSON.stringify(normalizedStudent));
    setVerifiedStudentId(activeSid);
    setVerifiedTenantId(activeTid);
    setShowChildSwitcher(false);
  };

  // 3. FETCH BILLING DATA
  useEffect(() => {
    if (!isSessionVerified || !csrfToken || !verifiedStudentId || !verifiedTenantId) return;
    let isMounted = true;

    const fetchBilling = async () => {
      setIsLoadingBilling(true);
      setBillingError(null);

      try {
        const response = await fetch('/api/portal/billing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Portal-CSRF': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            studentId: verifiedStudentId,
            tenantId: verifiedTenantId
          })
        });

        if (response.ok) {
          const res = await response.json().catch(() => null);
          const isValidPayload = Boolean(
            res &&
            res.success === true &&
            res.billing &&
            typeof res.billing.totalAmount === 'number' &&
            Number.isFinite(res.billing.totalAmount) &&
            res.billing.totalAmount >= 0 &&
            typeof res.billing.isPaidThisMonth === 'boolean' &&
            Array.isArray(res.billing.details)
          );

          if (isMounted && isValidPayload) {
            setBillingData(res);

            const list = Array.isArray(res.bankAccounts) && res.bankAccounts.length > 0
              ? res.bankAccounts
              : (Array.isArray(res.tenant?.bankAccounts) && res.tenant.bankAccounts.length > 0
                ? res.tenant.bankAccounts
                : (res.bankDetails?.number || res.bankDetails?.bank
                  ? [{ bankName: res.bankDetails.bank || 'Bank', accountNumber: res.bankDetails.number || '', accountName: res.bankDetails.name || '' }]
                  : []));

            setBankAccounts(list);
            setSelectedBankIndex(0);

            if (res.bankDetails) {
              setBankDetails({
                bank: res.bankDetails.bank || '',
                number: res.bankDetails.number || '',
                name: res.bankDetails.name || ''
              });
            }
            setIsLoadingBilling(false);
            return;
          }
        }

        if (isMounted) {
          setBillingData(null);
          setBillingError('Gagal memuat data penagihan dari server.');
        }
      } catch (err) {
        console.error('Billing fetch error:', err);
        if (isMounted) {
          setBillingData(null);
          setBillingError('Gagal terhubung ke server penagihan.');
        }
      } finally {
        if (isMounted) setIsLoadingBilling(false);
      }
    };

    fetchBilling();
    return () => {
      isMounted = false;
    };
  }, [isSessionVerified, csrfToken, verifiedStudentId, verifiedTenantId]);

  // 4. FETCH JADWAL & PRESENSI
  useEffect(() => {
    if (!isSessionVerified || !csrfToken || !verifiedStudentId || !verifiedTenantId) return;
    let isMounted = true;

    const fetchSchedule = async () => {
      setIsLoadingSchedule(true);
      setScheduleError(null);

      try {
        const response = await fetch('/api/portal/schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Portal-CSRF': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            studentId: verifiedStudentId,
            tenantId: verifiedTenantId
          })
        });

        if (response.ok) {
          const res = await response.json();
          if (isMounted && res.success) {
            setScheduleData(res);
            setIsLoadingSchedule(false);
            return;
          }
        }

        if (isMounted) {
          setScheduleError('Gagal memuat jadwal & presensi dari server.');
        }
      } catch (err) {
        console.error('Schedule fetch error:', err);
        if (isMounted) {
          setScheduleError('Gagal terhubung ke server jadwal latihan.');
        }
      } finally {
        if (isMounted) setIsLoadingSchedule(false);
      }
    };

    fetchSchedule();
    return () => {
      isMounted = false;
    };
  }, [isSessionVerified, csrfToken, verifiedStudentId, verifiedTenantId]);

  // 5. FETCH EVALUASI & PRESTASI
  useEffect(() => {
    if (!isSessionVerified || !csrfToken || !verifiedStudentId || !verifiedTenantId) return;
    let isMounted = true;
    const targetStudentId = verifiedStudentId;
    const targetTenantId = verifiedTenantId;

    const fetchEvaluations = async () => {
      setIsLoadingEvaluation(true);
      setEvaluationError(null);

      try {
        const response = await fetch('/api/portal/evaluations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Portal-CSRF': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            studentId: targetStudentId,
            tenantId: targetTenantId
          })
        });

        if (response.ok) {
          const res = await response.json();
          // Verify response still matches active target student (prevent stale out-of-order responses)
          if (isMounted && res.success && targetStudentId === verifiedStudentId) {
            setEvaluationData(res);
            setIsLoadingEvaluation(false);
            return;
          }
        }

        if (isMounted && targetStudentId === verifiedStudentId) {
          setEvaluationError('Gagal memuat evaluasi pelatih dari server.');
        }
      } catch (err) {
        console.error('Evaluations fetch error:', err);
        if (isMounted && targetStudentId === verifiedStudentId) {
          setEvaluationError('Gagal terhubung ke server evaluasi.');
        }
      } finally {
        if (isMounted && targetStudentId === verifiedStudentId) {
          setIsLoadingEvaluation(false);
        }
      }
    };

    fetchEvaluations();
    return () => {
      isMounted = false;
    };
  }, [isSessionVerified, csrfToken, verifiedStudentId, verifiedTenantId]);

  // 6. FETCH PENGUMUMAN AKADEMI (GAP-01)
  useEffect(() => {
    if (!isSessionVerified || !csrfToken || !verifiedStudentId || !verifiedTenantId) return;
    let isMounted = true;

    const fetchAnnouncements = async () => {
      setIsLoadingAnnouncements(true);
      setAnnouncementsError(null);

      try {
        const response = await fetch('/api/portal/announcements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Portal-CSRF': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            studentId: verifiedStudentId,
            tenantId: verifiedTenantId
          })
        });

        if (response.ok) {
          const res = await response.json();
          if (isMounted && res.success) {
            setAnnouncementsData(res);
            setIsLoadingAnnouncements(false);
            return;
          }
        }

        if (isMounted) {
          setAnnouncementsData({ announcements: [] });
        }
      } catch (err) {
        console.error('Announcements fetch error:', err);
        if (isMounted) {
          setAnnouncementsData({ announcements: [] });
        }
      } finally {
        if (isMounted) setIsLoadingAnnouncements(false);
      }
    };

    fetchAnnouncements();
    return () => {
      isMounted = false;
    };
  }, [isSessionVerified, csrfToken, verifiedStudentId, verifiedTenantId]);

  // 7. FETCH PROFIL SISWA (Untuk Menarik Nama Pelatih Asli)
  useEffect(() => {
    if (!isSessionVerified || !verifiedStudentId) return;
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        const activeStudentId = student?.id || student?.studentId || verifiedStudentId;
        const response = await fetch('/api/portal/profile?studentId=' + encodeURIComponent(activeStudentId), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            ...(csrfToken ? { 'X-Portal-CSRF': csrfToken } : {})
          },
          credentials: 'include'
        });

        if (response.ok) {
          const res = await response.json().catch(() => null);
          const studentProfile = res?.data || res?.student;
          if (isMounted && res && res.success && studentProfile) {
            const academyClass = studentProfile.academy_classes || {};
            const coach = academyClass.coaches || {};
            const resolvedCoachName = studentProfile.coach_name || studentProfile.coachName || coach.name || academyClass.coach_name || null;
            const resolvedClassName = studentProfile.class_name || studentProfile.className || academyClass.class_name || null;
            const resolvedPhotoUrl = studentProfile.photo_url || studentProfile.photoUrl || null;

            setStudent(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                studentName: studentProfile.student_name || studentProfile.studentName || prev.studentName,
                className: resolvedClassName || prev.className,
                coachName: resolvedCoachName || prev.coachName || null,
                sportCategory: studentProfile.sport_category || studentProfile.sportCategory || prev.sportCategory,
                photoUrl: resolvedPhotoUrl || prev.photoUrl,
                photo_url: resolvedPhotoUrl || prev.photo_url,
                tenantName: studentProfile.tenant_name || studentProfile.academy_name || prev.tenantName,
                academyName: studentProfile.tenant_name || studentProfile.academy_name || prev.academyName
              };
            });
          }
        }
      } catch (err) {
        console.warn('Profile fetch note:', err.message);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [isSessionVerified, csrfToken, verifiedStudentId]);

  // Sync Coach Name dari Jadwal jika profil belum memiliki nama pelatih
  useEffect(() => {
    if (scheduleData?.classInfo?.coachName) {
      setStudent(prev => {
        if (!prev) return prev;
        if (!prev.coachName || prev.coachName !== scheduleData.classInfo.coachName) {
          return { ...prev, coachName: scheduleData.classInfo.coachName };
        }
        return prev;
      });
    }
  }, [scheduleData]);

  const isBillingValid = Boolean(
    billingData &&
    billingData.success === true &&
    billingData.billing &&
    typeof billingData.billing.totalAmount === 'number' &&
    Number.isFinite(billingData.billing.totalAmount) &&
    billingData.billing.totalAmount >= 0 &&
    typeof billingData.billing.isPaidThisMonth === 'boolean' &&
    Array.isArray(billingData.billing.details)
  );

  // Logout Handler
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const response = await fetch('/api/portal/v2/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-Portal-CSRF': csrfToken } : {})
        },
        credentials: 'include'
      }).catch(() => fetch('/api/portal/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-Portal-CSRF': csrfToken } : {})
        },
        credentials: 'include'
      }));

      localStorage.removeItem('activeStudent');
      sessionStorage.clear();
      navigate('/portal', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('activeStudent');
      sessionStorage.clear();
      navigate('/portal', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // LOADING STATE
  if (isVerifyingSession) {
    return (
      <div className="flex-1 min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <h2 className="text-sm font-bold text-slate-800">Memverifikasi Keamanan Sesi Portal...</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Menghubungkan ke enkripsi portal resmi CHUA SPORT CORE
        </p>
      </div>
    );
  }

  // REDIRECT IF NOT VERIFIED
  if (!student || !isSessionVerified) {
    return <Navigate to="/portal" replace />;
  }

  const studentName = student.student_name || student.studentName || 'Nama Siswa';
  const photoUrl = student.photo_url || student.photoUrl || scheduleData?.student?.photo_url || null;
  const academyName = student.academy_name || student.academyName || scheduleData?.student?.academy_name || scheduleData?.student?.academyName || scheduleData?.classInfo?.academyName || 'Chua Sport Academy';
  const sportCategory = student.sport_category || student.sportCategory || 'Badminton';
  const className = student.class_name || student.className || scheduleData?.student?.class_name || scheduleData?.classInfo?.className || 'Reguler';
  const coachName = student.coach_name || student.coachName || scheduleData?.student?.coach_name || scheduleData?.classInfo?.coachName || null;
  const age = calculateAge(student.birthDate);

  const totalAmount = isBillingValid ? billingData.billing.totalAmount : null;
  const billingDetails = isBillingValid ? billingData.billing.details : [];
  const isPaid = isBillingValid ? billingData.billing.isPaidThisMonth : null;
  const qrisUrl = billingData?.tenant?.qris_url || billingData?.tenant?.qrisUrl || billingData?.tenant?.qris_image_base64 || billingData?.tenant?.qrisImageBase64 || scheduleData?.tenant?.qris_url || scheduleData?.tenant?.qris_image_base64 || null;

  const handleOpenQrisModal = () => {
    setShowQrisModal(true);
  };

  const effectiveBankList = Array.isArray(billingData?.tenant?.bank_accounts) && billingData.tenant.bank_accounts.length > 0
    ? billingData.tenant.bank_accounts
    : (Array.isArray(billingData?.bankAccounts) && billingData.bankAccounts.length > 0
      ? billingData.bankAccounts
      : (Array.isArray(billingData?.tenant?.bankAccounts) && billingData.tenant.bankAccounts.length > 0
        ? billingData.tenant.bankAccounts
        : (bankAccounts.length > 0 
          ? bankAccounts 
          : ((billingData?.tenant?.bank_account_number || billingData?.tenant?.bank_name || bankDetails.number)
            ? [{
                bankName: billingData?.tenant?.bank_name || bankDetails.bank || 'Bank Transfer',
                accountNumber: String(billingData?.tenant?.bank_account_number || bankDetails.number || ''),
                accountName: billingData?.tenant?.bank_account_name || bankDetails.name || academyName
              }]
            : []))));

  const currentAccount = effectiveBankList[selectedBankIndex] || effectiveBankList[0] || {
    bankName: billingData?.tenant?.bank_name || bankDetails.bank || billingData?.bankDetails?.bank || 'Bank Transfer',
    accountNumber: String(billingData?.tenant?.bank_account_number || bankDetails.number || billingData?.bankDetails?.number || ''),
    accountName: billingData?.tenant?.bank_account_name || bankDetails.name || billingData?.bankDetails?.name || academyName
  };

  const activeBank = currentAccount.bankName || 'TRANSFER BANK';
  const activeAccountNumber = currentAccount.accountNumber || '';
  const activeAccountName = currentAccount.accountName || academyName;

  const handleCopyAccount = () => {
    if (activeAccountNumber) {
      navigator.clipboard.writeText(activeAccountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-800 relative pb-24">
      {/* 1. HEADER & MULTI-CHILD SWITCHER */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-900 tracking-tight leading-tight">
              PORTAL WALI MURID
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
              {academyName}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Multi-Child Switcher Trigger */}
          {childrenList.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowChildSwitcher(!showChildSwitcher)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200/80 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="truncate max-w-[90px]">{studentName}</span>
                <ChevronDown className="w-3 h-3 text-blue-500" />
              </button>

              {/* Child Switcher Dropdown */}
              {showChildSwitcher && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Pilih Siswa ({childrenList.length} Anak)
                    </p>
                  </div>
                  {childrenList.map((c, idx) => {
                    const cSid = String(c.studentId || c.id).trim();
                    const isSelected = cSid.toLowerCase() === verifiedStudentId?.toLowerCase();
                    return (
                      <button
                        key={cSid || idx}
                        type="button"
                        onClick={() => handleSelectChild(c)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/70 text-blue-700 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <div className="truncate">
                          <p className="truncate">{c.studentName || c.name || 'Siswa'}</p>
                          <p className="text-[10px] text-slate-400 truncate">{c.className || c.academyName || 'Cabang'}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold rounded-xl border border-slate-200/80 hover:border-rose-200 transition-colors cursor-pointer"
            title="Keluar dari Portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* CONTAINER BODY UTAMA BERBASIS TAB */}
      <main className="p-4 sm:p-5 space-y-4 flex-1">
        
        {/* ============================================================== */}
        {/* TAB 1: BERANDA ('home') */}
        {/* ============================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* 2. KARTU PROFIL UTAMA (GROUP 1: PROFIL ANAK & GROUP 7: KELAS/PROGRAM) */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white p-5 shadow-lg shadow-blue-600/15">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-center justify-between gap-2 mb-3.5 relative z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-wider border border-white/20">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>{sportCategory}</span>
                </span>
                <span className="text-[11px] font-bold text-blue-100/90 truncate max-w-[160px]">
                  {academyName}
                </span>
              </div>

              <div className="flex items-start gap-3.5 relative z-10">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/60 shadow-md bg-white/20 shrink-0 flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Profil"
                      className="w-full h-full object-cover rounded-full"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-xl">
                      {getStudentInitials(studentName)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-black text-white leading-tight break-words">
                    {studentName}
                  </h2>
                  <p className="text-[11px] text-blue-100/90 mt-0.5 font-medium">
                    {age !== '-' ? `${age} Tahun` : 'Siswa Aktif'}
                    {student.schoolOrigin ? ` • ${student.schoolOrigin}` : ''}
                  </p>
                  <p className="text-[10px] font-mono text-blue-200 mt-1 tracking-wider opacity-90">
                    ID: {student.id}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-2 gap-2 relative z-10 text-xs">
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 flex items-center gap-2 border border-white/10">
                  <BookOpen className="w-4 h-4 text-blue-200 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-blue-200 font-bold">Kelas &amp; Program</p>
                    <p className="font-bold text-white text-[11px] truncate">{className}</p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 flex items-center gap-2 border border-white/10">
                  <User className="w-4 h-4 text-blue-200 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-blue-200 font-bold">Pelatih Utama</p>
                    <p className="font-bold text-white text-[11px] truncate">{coachName || 'Belum Ditugaskan'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RINGKASAN CEPAT STATUS SISWA */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ringkasan Informasi Siswa
                </h3>
                <span className="text-[10px] text-slate-400">Pembaruan Realtime</span>
              </div>

              {/* Status SPP / Keuangan Card */}
              <div
                onClick={() => setActiveTab('billing')}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isLoadingBilling ? 'bg-slate-50 text-slate-400 border border-slate-200' :
                    !isBillingValid ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                    (isBillingValid && isPaid === true) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-100' :
                    'bg-amber-50 text-amber-600 border border-amber-100 group-hover:bg-amber-100'
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Status Iuran SPP
                    </p>
                    <p className="font-black text-slate-800 text-sm truncate">
                      {isLoadingBilling ? 'Memuat data tagihan...' :
                       !isBillingValid ? 'Gagal Muat Data Tagihan' :
                       (isBillingValid && isPaid === true) ? 'Lunas (Tidak Ada Tunggakan)' :
                       (isBillingValid && isPaid === false) ? formatRupiah(totalAmount) :
                       'Gagal Muat Data Tagihan'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {isLoadingBilling ? 'Menghubungkan ke server...' :
                       !isBillingValid ? (billingError || 'Data tagihan belum dapat diverifikasi') :
                       (isBillingValid && isPaid === true) ? 'Iuran bulan ini telah terverifikasi' :
                       (isBillingValid && isPaid === false) ? `${billingDetails.length} komponen tagihan aktif` :
                       'Data tagihan belum dapat diverifikasi'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0 pl-2">
                  <span className="text-[11px] font-bold text-blue-600 group-hover:underline">Buka</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Status Jadwal & Kehadiran Card */}
              <div
                onClick={() => setActiveTab('schedule')}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0 group-hover:bg-blue-100 transition-colors">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Sesi Latihan &amp; Presensi
                    </p>
                    <p className="font-black text-slate-800 text-sm truncate">
                      {scheduleData?.stats?.attendanceRate ? `${scheduleData.stats.attendanceRate} Kehadiran` : 'Jadwal Aktif'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {scheduleData?.classInfo?.className || className} &bull; {scheduleData?.schedules?.length || 0} Sesi/Minggu
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0 pl-2">
                  <span className="text-[11px] font-bold text-blue-600 group-hover:underline">Buka</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Status Rapor & Prestasi Card */}
              <div
                onClick={() => setActiveTab('evaluation')}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0 group-hover:bg-purple-100 transition-colors">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Prestasi &amp; Rapor Evaluasi
                    </p>
                    <p className="font-black text-slate-800 text-sm truncate">
                      {evaluationData?.latestEvaluation ? `Rapor Pelatih: Skor ${evaluationData.latestEvaluation.overallScore}/100` : 'Rapor Belum Dirilis'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {evaluationData?.achievements?.length ? `${evaluationData.achievements.length} Medali & Kejuaraan` : 'Perkembangan 4 pilar atlet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0 pl-2">
                  <span className="text-[11px] font-bold text-blue-600 group-hover:underline">Buka</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Status Pengumuman Terbaru Card (GROUP 8) */}
              <div
                onClick={() => setActiveTab('announcements')}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0 group-hover:bg-amber-100 transition-colors">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Pengumuman Akademi
                    </p>
                    <p className="font-black text-slate-800 text-sm truncate">
                      {announcementsData?.announcements?.length ? `${announcementsData.announcements.length} Pengumuman` : 'Pengumuman Resmi'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {announcementsData?.announcements?.[0]?.title || 'Informasi terbaru dari akademi'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0 pl-2">
                  <span className="text-[11px] font-bold text-blue-600 group-hover:underline">Buka</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS GRID */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-1.5 transition-all shadow-2xs cursor-pointer group active:scale-95"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-600 flex items-center justify-center transition-colors">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Keuangan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-1.5 transition-all shadow-2xs cursor-pointer group active:scale-95"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Jadwal</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('evaluation')}
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-1.5 transition-all shadow-2xs cursor-pointer group active:scale-95"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-50 group-hover:bg-purple-100 text-purple-600 flex items-center justify-center transition-colors">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Rapor</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('announcements')}
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-1.5 transition-all shadow-2xs cursor-pointer group active:scale-95"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-600 flex items-center justify-center transition-colors">
                  <Bell className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Info</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: KEUANGAN / SPP ('billing') — GROUP 9 & GROUP 10 */}
        {/* ============================================================== */}
        {activeTab === 'billing' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* SEKSI ADMINISTRASI SPP DENGAN TOTAL TAGIHAN RIIL */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Administrasi Iuran &amp; Tagihan (Read-Only)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Tagihan riil dari CHUA CORE Financial Engine
                    </p>
                  </div>
                </div>

                {isLoadingBilling ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold border border-slate-200">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>MEMUAT</span>
                  </span>
                ) : !isBillingValid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-extrabold border border-rose-200">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>GAGAL MUAT</span>
                  </span>
                ) : (isBillingValid && isPaid === true) ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>LUNAS</span>
                  </span>
                ) : (isBillingValid && isPaid === false) ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold border border-amber-200 animate-pulse">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>BELUM LUNAS</span>
                  </span>
                ) : null}
              </div>

              {!isBillingValid && !isLoadingBilling ? (
                <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl space-y-2 text-rose-800 text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Gagal Memuat Data Keuangan Resmi</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    {billingError || 'Data tagihan tidak dapat diverifikasi dari server.'}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Total Tagihan Belum Lunas
                      </p>
                      <p className="text-xl font-black text-slate-900 mt-0.5">
                        {isLoadingBilling ? '...' : (isBillingValid && isPaid === false) ? formatRupiah(totalAmount) : (isBillingValid && isPaid === true) ? formatRupiah(0) : '-'}
                      </p>
                    </div>

                    <div className="text-right">
                      {isLoadingBilling ? (
                        <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menghitung...</span>
                        </div>
                      ) : (isBillingValid && isPaid === true) ? (
                        <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-lg border border-emerald-200">
                          Semua Lunas
                        </span>
                      ) : (isBillingValid && isPaid === false) ? (
                        <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-lg border border-amber-200/80">
                          {billingDetails.length} Tagihan Aktif
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Rincian Komponen Tagihan */}
                  {isBillingValid && isPaid === false && billingDetails.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-200/70 space-y-1.5 text-xs">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Rincian Biaya Belum Dibayar:
                      </p>
                      <div className="space-y-1">
                        {billingDetails.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-700 text-xs">
                            <span className="truncate pr-2 font-medium">{item.name}</span>
                            <span className="font-bold text-slate-900 shrink-0 font-mono">
                              {formatRupiah(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!isBillingValid || isLoadingBilling}
                onClick={handleOpenQrisModal}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <QrCode className="w-4 h-4" />
                <span>Lihat Informasi QRIS / Rekening Transfer</span>
                <ChevronRight className="w-4 h-4 opacity-80" />
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-normal">
                Parent Portal V2 bersifat Read-Only. Pembayaran dilakukan via QRIS atau Transfer Bank langsung ke rekening akademi.
              </p>
            </div>

            {/* GROUP 10: RIWAYAT PEMBAYARAN SPP */}
            {billingData?.paymentHistory && billingData.paymentHistory.length > 0 && (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Riwayat Pembayaran (Group 10)
                    </h3>
                    <p className="text-[11px] text-slate-400">Bukti transaksi tersimpan dari Financial Core</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {billingData.paymentHistory.map((item, idx) => (
                    <div key={item.id || idx} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">{item.description || item.itemName || 'Iuran SPP Akademi'}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatAttendanceDate(item.paymentDate)} &bull; {item.paymentMethod || 'Transfer / QRIS'}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600 font-mono">
                        {formatRupiah(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: JADWAL & PRESENSI ('schedule') — GROUP 2, GROUP 3, GROUP 4 */}
        {/* ============================================================== */}
        {activeTab === 'schedule' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Jadwal Latihan &amp; Presensi
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {scheduleData?.classInfo?.className || className} &bull; {coachName ? `Coach ${coachName}` : 'Belum Ditugaskan'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-Tabs: Jadwal vs Presensi */}
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveScheduleTab('jadwal')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeScheduleTab === 'jadwal'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Jadwal Sesi ({
                      (scheduleData?.upcoming_sessions && scheduleData.upcoming_sessions.length > 0)
                        ? scheduleData.upcoming_sessions.length
                        : (scheduleData?.schedules?.length || 0)
                    })
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScheduleTab('presensi')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeScheduleTab === 'presensi'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Catatan Presensi ({scheduleData?.attendances?.length || 0})</span>
                </button>
              </div>

              {/* GROUP 2: JADWAL LATIHAN */}
              {activeScheduleTab === 'jadwal' && (
                <div className="space-y-2.5">
                  {isLoadingSchedule ? (
                    <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1.5">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Memuat jadwal sesi latihan...</span>
                    </div>
                  ) : (() => {
                    const effectiveSessions = (scheduleData?.upcoming_sessions && scheduleData.upcoming_sessions.length > 0)
                      ? scheduleData.upcoming_sessions
                      : (Array.isArray(scheduleData?.schedules) ? scheduleData.schedules : []);

                    if (effectiveSessions.length === 0) {
                      return (
                        <div className="py-7 px-4 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <p className="text-xs font-bold text-slate-800">
                            Belum Ada Jadwal Terdekat
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                            Belum ada jadwal latihan terdekat yang dikunci oleh pelatih.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {effectiveSessions.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="p-3 bg-slate-50 hover:bg-blue-50/40 rounded-xl border border-slate-100 transition-colors flex items-center justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-extrabold rounded-md uppercase">
                                  {s.date ? formatSessionDate(s.date) : (s.day ? String(s.day).toUpperCase() : 'JADWAL RUTIN')}
                                </span>
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {s.start_time || s.startTime || '15:00'} - {s.end_time || s.endTime || '17:00'} WIB
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{s.court_name || s.courtName || 'Lapangan Utama'}</span>
                              </p>
                            </div>

                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold shrink-0">
                              {s.status || (s.date ? 'Terkunci' : 'Rutin')}
                            </span>
                          </div>
                        ))}
                        
                        <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
                          <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>Pastikan atlet hadir 15 menit sebelum sesi dimulai dengan seragam resmi akademi.</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* GROUP 3: KEHADIRAN & GROUP 4: RIWAYAT AKTIVITAS */}
              {activeScheduleTab === 'presensi' && (
                <div className="space-y-3">
                  {isLoadingSchedule ? (
                    <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1.5">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Memuat catatan presensi...</span>
                    </div>
                  ) : (
                    <>
                      {scheduleData?.stats && (
                        <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                          <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <p className="text-[9px] uppercase font-bold text-emerald-600">Hadir</p>
                            <p className="text-sm font-black text-emerald-800 mt-0.5">{scheduleData.stats.hadir}</p>
                          </div>
                          <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl">
                            <p className="text-[9px] uppercase font-bold text-amber-600">Izin</p>
                            <p className="text-sm font-black text-amber-800 mt-0.5">{scheduleData.stats.izin}</p>
                          </div>
                          <div className="p-2 bg-violet-50 border border-violet-100 rounded-xl">
                            <p className="text-[9px] uppercase font-bold text-violet-600">Sakit</p>
                            <p className="text-sm font-black text-violet-800 mt-0.5">{scheduleData.stats.sakit}</p>
                          </div>
                          <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl">
                            <p className="text-[9px] uppercase font-bold text-rose-600">Alpha</p>
                            <p className="text-sm font-black text-rose-800 mt-0.5">{scheduleData.stats.alpha}</p>
                          </div>
                        </div>
                      )}

                      {scheduleData?.attendances && scheduleData.attendances.length > 0 ? (
                        <div className="divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                          {scheduleData.attendances.map((item, idx) => {
                            const st = String(item.status || '').toLowerCase();
                            const isHadir = st.includes('hadir');
                            const isIzin = st.includes('izin');
                            const isSakit = st.includes('sakit');
                            const isAlpha = st.includes('alpa') || st.includes('alpha');

                            return (
                              <div key={item.id || idx} className="py-2.5 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-800">
                                    {formatAttendanceDate(item.date)}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {item.className || className} {item.notes ? `• ${item.notes}` : ''}
                                  </p>
                                </div>

                                {isHadir && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 shrink-0">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Hadir</span>
                                  </span>
                                )}
                                {isIzin && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 shrink-0">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Izin</span>
                                  </span>
                                )}
                                {isSakit && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-200 shrink-0">
                                    <AlertCircle className="w-3 h-3 text-violet-600" />
                                    <span>Sakit</span>
                                  </span>
                                )}
                                {isAlpha && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200 shrink-0">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>Alpha</span>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-7 px-4 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <p className="text-xs font-bold text-slate-800">
                            Belum Ada Rekam Presensi
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                            Data kehadiran sesi latihan atlet akan tercatat secara otomatis setelah pelatih melakukan absensi.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: PRESTASI & EVALUASI PELATIH ('evaluation') — GROUP 5 & GROUP 6 */}
        {/* ============================================================== */}
        {activeTab === 'evaluation' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Prestasi &amp; Evaluasi Pelatih
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Rapor performa 4-6 pilar atlet &amp; kejuaraan
                    </p>
                  </div>
                </div>

                {evaluationData?.latestEvaluation ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-extrabold border border-blue-200">
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                    <span>Skor {evaluationData.latestEvaluation.overallScore}/100</span>
                  </span>
                ) : null}
              </div>

              {/* Sub-Tabs: Evaluasi vs Prestasi */}
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveEvalTab('evaluasi')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeEvalTab === 'evaluasi'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Evaluasi Pelatih ({evaluationData?.evaluations?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEvalTab('prestasi')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeEvalTab === 'prestasi'
                      ? 'bg-white text-amber-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Prestasi ({evaluationData?.achievements?.length || 0})</span>
                </button>
              </div>

              {/* GROUP 5: PERKEMBANGAN & GROUP 6: HASIL EVALUASI */}
              {activeEvalTab === 'evaluasi' && (
                <div className="space-y-3">
                  {isLoadingEvaluation ? (
                    <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1.5">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Memuat catatan evaluasi pelatih...</span>
                    </div>
                  ) : evaluationError ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{evaluationError}</span>
                    </div>
                  ) : evaluationData?.latestEvaluation ? (
                    <div className="space-y-3">
                      {/* Kartu Rapor Utama */}
                      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl p-3.5 border border-slate-200 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                Rapor Evaluasi Terkini
                              </span>
                              <span className="text-[10px] text-slate-400">&bull;</span>
                              <span className="text-[11px] font-bold text-slate-700">
                                {evaluationData.latestEvaluation.date ? formatAttendanceDate(evaluationData.latestEvaluation.date) : 'Belum tersedia'}
                              </span>
                            </div>
                            <p className="text-xs font-black text-slate-800 mt-0.5">
                              {evaluationData.latestEvaluation.evaluator || 'Pelatih'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {evaluationData.latestEvaluation.className || className || 'Reguler'} &bull; {evaluationData.latestEvaluation.sport || sportCategory || 'Olahraga'}
                            </p>
                          </div>

                          {evaluationData.latestEvaluation.overallScore !== null && evaluationData.latestEvaluation.overallScore !== undefined ? (
                            (() => {
                              const grade = getEvaluationGrade(evaluationData.latestEvaluation.overallScore);
                              return (
                                <div className="text-right shrink-0">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${grade.badge}`}>
                                    {grade.label}
                                  </span>
                                  <p className="text-xs font-mono font-black text-slate-900 mt-0.5">
                                    {evaluationData.latestEvaluation.overallScore} <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
                                  </p>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400 italic">Nilai belum tersedia</span>
                            </div>
                          )}
                        </div>

                        {/* Pilar-Pilar Perkembangan Anak */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-600 flex items-center gap-1">
                                <Target className="w-3 h-3 text-blue-500" />
                                Teknik
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {evaluationData.latestEvaluation.pillarScores?.teknik !== null && evaluationData.latestEvaluation.pillarScores?.teknik !== undefined
                                  ? evaluationData.latestEvaluation.pillarScores.teknik
                                  : <span className="text-[10px] font-normal text-slate-400 italic">-</span>}
                              </span>
                            </div>
                            {evaluationData.latestEvaluation.pillarScores?.teknik !== null && evaluationData.latestEvaluation.pillarScores?.teknik !== undefined && (
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(0, evaluationData.latestEvaluation.pillarScores.teknik))}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-600 flex items-center gap-1">
                                <Activity className="w-3 h-3 text-emerald-500" />
                                Fisik
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {evaluationData.latestEvaluation.pillarScores?.fisik !== null && evaluationData.latestEvaluation.pillarScores?.fisik !== undefined
                                  ? evaluationData.latestEvaluation.pillarScores.fisik
                                  : <span className="text-[10px] font-normal text-slate-400 italic">-</span>}
                              </span>
                            </div>
                            {evaluationData.latestEvaluation.pillarScores?.fisik !== null && evaluationData.latestEvaluation.pillarScores?.fisik !== undefined && (
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(0, evaluationData.latestEvaluation.pillarScores.fisik))}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-600 flex items-center gap-1">
                                <Star className="w-3 h-3 text-purple-500" />
                                Mental
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {evaluationData.latestEvaluation.pillarScores?.mental !== null && evaluationData.latestEvaluation.pillarScores?.mental !== undefined
                                  ? evaluationData.latestEvaluation.pillarScores.mental
                                  : <span className="text-[10px] font-normal text-slate-400 italic">-</span>}
                              </span>
                            </div>
                            {evaluationData.latestEvaluation.pillarScores?.mental !== null && evaluationData.latestEvaluation.pillarScores?.mental !== undefined && (
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(0, evaluationData.latestEvaluation.pillarScores.mental))}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-600 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-amber-500" />
                                Taktik
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {evaluationData.latestEvaluation.pillarScores?.taktik !== null && evaluationData.latestEvaluation.pillarScores?.taktik !== undefined
                                  ? evaluationData.latestEvaluation.pillarScores.taktik
                                  : <span className="text-[10px] font-normal text-slate-400 italic">-</span>}
                              </span>
                            </div>
                            {evaluationData.latestEvaluation.pillarScores?.taktik !== null && evaluationData.latestEvaluation.pillarScores?.taktik !== undefined && (
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(0, evaluationData.latestEvaluation.pillarScores.taktik))}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Catatan Pelatih */}
                        {evaluationData.latestEvaluation.coachNote ? (
                          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                              <Quote className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Catatan &amp; Arahan Pelatih:</span>
                            </div>
                            <p className="text-slate-700 italic text-[11px] leading-relaxed pl-5">
                              &ldquo;{evaluationData.latestEvaluation.coachNote}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-400 italic">
                            Belum ada catatan khusus dari pelatih.
                          </div>
                        )}
                      </div>

                      {/* Riwayat Evaluasi Sebelumnya */}
                      {evaluationData.evaluations.length > 1 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Riwayat Rapor Sebelumnya ({evaluationData.evaluations.length - 1})
                          </p>
                          <div className="divide-y divide-slate-100 text-xs max-h-48 overflow-y-auto">
                            {evaluationData.evaluations.slice(1).map((ev, idx) => (
                              <div key={ev.id || idx} className="py-2 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-800 text-[11px]">
                                    {ev.date ? formatAttendanceDate(ev.date) : 'Tanggal tidak tersedia'} &bull; {ev.evaluator || 'Pelatih'}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                    {ev.coachNote || 'Evaluasi latihan berkala'}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                                  {ev.overallScore !== null && ev.overallScore !== undefined ? `Skor ${ev.overallScore}` : 'Nilai pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-7 px-4 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                        <Target className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        Belum ada evaluasi dirilis oleh pelatih
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                        Evaluasi pilar teknik, fisik, mental, dan taktik atlet akan ditampilkan di sini setelah pelatih merilis rapor latihan resmi.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB PRESTASI */}
              {activeEvalTab === 'prestasi' && (
                <div className="space-y-2.5">
                  {isLoadingEvaluation ? (
                    <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1.5">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                      <span>Memuat daftar prestasi atlet...</span>
                    </div>
                  ) : (evaluationData?.achievements && evaluationData.achievements.length > 0) ? (
                    <div className="space-y-2">
                      {evaluationData.achievements.map((ach, idx) => {
                        const style = getTournamentMedalStyle(ach.result);
                        return (
                          <div
                            key={ach.id || idx}
                            className={`p-3 rounded-xl border ${style.border} ${style.bg} transition-all flex items-start justify-between gap-3`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl bg-white flex items-center justify-center border ${style.border} shrink-0 shadow-2xs`}>
                                <Trophy className={`w-4 h-4 ${style.iconColor}`} />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                                  {ach.name}
                                </h4>
                                <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                  <span>{ach.date}</span>
                                  {ach.category && (
                                    <>
                                      <span>&bull;</span>
                                      <span>{ach.category}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${style.badge}`}>
                              {ach.result}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-7 px-4 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        Belum ada catatan prestasi
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                        Daftar kejuaraan, medali, dan piagam yang diraih atlet akan tampil secara otomatis di sini.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: PENGUMUMAN AKADEMI ('announcements') — GROUP 8 */}
        {/* ============================================================== */}
        {activeTab === 'announcements' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Pengumuman Akademi (Group 8)
                  </h3>
                  <p className="text-[11px] text-slate-400">Informasi resmi dari pengelola cabang {academyName}</p>
                </div>
              </div>

              {isLoadingAnnouncements ? (
                <div className="py-6 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1.5">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                  <span>Memuat pengumuman akademi...</span>
                </div>
              ) : (announcementsData?.announcements && announcementsData.announcements.length > 0) ? (
                <div className="space-y-3">
                  {announcementsData.announcements.map((ann, idx) => (
                    <div
                      key={ann.id || idx}
                      className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-2 hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase">
                              {ann.category || 'Umum'}
                            </span>
                            {ann.isImportant && (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-extrabold uppercase">
                                Penting
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mt-1">{ann.title}</h4>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatAttendanceDate(ann.date)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                        {ann.content}
                      </p>

                      <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Oleh: {ann.author || 'Pengelola Akademi'}</span>
                        <span>{academyName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 px-4 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Belum Ada Pengumuman Terbaru
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                    Pengumuman resmi terkait latihan, libur, turnamen, dan iuran akan muncul di sini.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* FOOTER INFORMASI */}
      <footer className="p-4 text-center text-slate-400 text-[10px] border-t border-slate-200 bg-white mb-2">
        <div className="flex items-center justify-center gap-1 text-slate-600 font-semibold mb-0.5">
          <ShieldCheck className="w-3 h-3 text-blue-600" />
          <span>PORTAL RESMI WALI MURID</span>
        </div>
        <p>CHUA SPORT CORE &bull; Sistem Terpadu Manajemen Akademi</p>
      </footer>

      {/* FIXED BOTTOM NAVIGATION BAR (5 TABS) */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex justify-around items-center shadow-2xl">
        {/* Tab 1: Beranda */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Home className={`w-4 h-4 mb-0.5 transition-transform ${activeTab === 'home' ? 'text-blue-400 scale-110' : 'text-slate-400'}`} />
          <span className="text-[9px] tracking-tight">Beranda</span>
        </button>

        {/* Tab 2: Keuangan */}
        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'billing'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <CreditCard className={`w-4 h-4 mb-0.5 transition-transform ${activeTab === 'billing' ? 'text-blue-400 scale-110' : 'text-slate-400'}`} />
            {isBillingValid === true && isPaid === false && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-slate-900" />
            )}
          </div>
          <span className="text-[9px] tracking-tight">Keuangan</span>
        </button>

        {/* Tab 3: Jadwal */}
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <CalendarDays className={`w-4 h-4 mb-0.5 transition-transform ${activeTab === 'schedule' ? 'text-blue-400 scale-110' : 'text-slate-400'}`} />
          <span className="text-[9px] tracking-tight">Jadwal</span>
        </button>

        {/* Tab 4: Rapor */}
        <button
          type="button"
          onClick={() => setActiveTab('evaluation')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'evaluation'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Trophy className={`w-4 h-4 mb-0.5 transition-transform ${activeTab === 'evaluation' ? 'text-blue-400 scale-110' : 'text-slate-400'}`} />
          <span className="text-[9px] tracking-tight">Rapor</span>
        </button>

        {/* Tab 5: Info / Pengumuman */}
        <button
          type="button"
          onClick={() => setActiveTab('announcements')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'announcements'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Bell className={`w-4 h-4 mb-0.5 transition-transform ${activeTab === 'announcements' ? 'text-blue-400 scale-110' : 'text-slate-400'}`} />
          <span className="text-[9px] tracking-tight">Info</span>
        </button>
      </nav>

      {/* MODAL QRIS PEMBAYARAN */}
      {showQrisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Informasi Pembayaran (Read-Only)</h3>
                  <p className="text-[10px] text-blue-100">{academyName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQrisModal(false)}
                className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                aria-label="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5">
              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700/60 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Total Tagihan Riil
                </p>
                <p className="text-2xl font-black text-amber-300 mt-0.5 font-mono">
                  {formatRupiah(totalAmount)}
                </p>
                <p className="text-[11px] text-slate-300 mt-1">
                  Untuk Siswa: <strong className="text-white">{studentName}</strong>
                </p>
              </div>

              {billingDetails && billingDetails.length > 0 && (
                <div className="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Rincian Biaya:
                    </p>
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">
                      {billingDetails.length} Item
                    </span>
                  </div>

                  <div className="space-y-1.5 divide-y divide-slate-700/50">
                    {billingDetails.map((item, idx) => (
                      <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-slate-200">
                        <span className="truncate pr-2 text-[11px] font-medium">{item.name}</span>
                        <span className="font-mono font-bold text-amber-300 shrink-0 text-xs">
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white p-4 rounded-2xl shadow-inner flex flex-col items-center justify-center">
                {qrisUrl ? (
                  <>
                    <img
                      src={qrisUrl}
                      alt="QRIS Pembayaran Resmi"
                      crossOrigin="anonymous"
                      className="w-full max-h-56 object-contain rounded-lg"
                    />
                    <div className="mt-3 flex items-center gap-1.5 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>QRIS Terverifikasi Resmi</span>
                    </div>
                  </>
                ) : (
                  <div className="py-7 px-4 text-center flex flex-col items-center justify-center text-slate-600">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      QRIS Sedang Disiapkan
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[210px] leading-relaxed">
                      Pengelola arena belum mengunggah gambar QRIS. Silakan gunakan opsi transfer bank di bawah ini.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/80 space-y-3 text-left text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Alternatif Transfer Bank
                  </p>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full font-extrabold uppercase border border-blue-500/30">
                    {activeBank || 'TRANSFER BANK'}
                  </span>
                </div>

                {effectiveBankList.length > 1 && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">
                        Pilih Rekening Bank:
                      </span>
                      <span className="text-blue-300 font-bold">
                        {effectiveBankList.length} Bank Tersedia
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {effectiveBankList.map((acc, idx) => {
                        const isSelected = idx === selectedBankIndex;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedBankIndex(idx);
                              setCopiedAccount(false);
                            }}
                            className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-start gap-0.5 text-left border ${
                              isSelected
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-600/30 ring-1 ring-blue-300'
                                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:text-white'
                            }`}
                          >
                            <span className="text-[11px] font-black tracking-tight flex items-center gap-1">
                              <CreditCard className="w-3 h-3 shrink-0 opacity-80" />
                              {acc.bankName || `Bank ${idx + 1}`}
                            </span>
                            <span className={`text-[9px] font-mono truncate w-full ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              {acc.accountNumber || '-'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-0.5">
                  <label htmlFor="portal-target-account-number" className="text-[10px] text-slate-400 font-medium block">
                    Nomor Rekening Tujuan ({activeBank}):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="portal-target-account-number"
                      name="targetAccountNumber"
                      type="text"
                      readOnly
                      value={activeAccountNumber || ''}
                      placeholder={activeAccountNumber ? '' : 'Nomor rekening belum diatur'}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-hidden select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      disabled={!activeAccountNumber}
                      className="shrink-0 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                      title="Salin Nomor Rekening"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedAccount ? 'Tersalin!' : 'Salin'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-300 pt-0.5 font-medium">
                    a.n. <strong className="text-white font-semibold">{activeAccountName || academyName}</strong>
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center leading-normal">
                Transfer dapat dilakukan dari aplikasi mobile banking seluruh bank di Indonesia.
              </p>
            </div>

            <div className="p-4 border-t border-slate-800/80 bg-slate-900 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowQrisModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
