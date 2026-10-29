import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import supabaseAcademyService from '../services/supabaseAcademyService';
import { calculateAge } from '../utils/helpers';

import { 
  Award, 
  Star, 
  Calendar, 
  User, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Filter,
  UserCheck,
  Loader2,
  Target,
  Layers,
  Info,
  Zap,
  Dumbbell,
  Activity,
  Brain,
  Shield,
  Sparkles,
  BarChart2,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Sliders,
  SlidersHorizontal,
  Compass,
  LayoutGrid,
  Radio,
  History,
  RotateCcw,
  GraduationCap,
  Flame,
  Edit3,
  Check,
  X
} from 'lucide-react';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';

import {
  FOOTBALL_POSITIONS,
  FOOTBALL_PLAYING_STYLES,
  FOOTBALL_CORE_CATEGORIES,
  TIER_CONFIGS,
  detectTierFromAge,
  getFilteredIndicatorsForCategory,
  getPositionIndicatorsForTier,
  getAvailablePositionsForTier,
  isFootballOrMinisoccer,
  getPositionConfig,
  getStyleConfig,
  SECONDARY_FOOTBALL_POSITIONS
} from '../config/footballAssessmentData';

import {
  FUTSAL_POSITIONS,
  FUTSAL_PLAYING_STYLES,
  FUTSAL_CORE_CATEGORIES,
  FUTSAL_TIER_CONFIGS,
  detectFutsalTierFromAge,
  getFilteredFutsalIndicatorsForCategory,
  getAvailableFutsalPositionsForTier,
  getFutsalPositionIndicatorsForTier,
  isFutsalSport,
  getFutsalPositionConfig,
  getFutsalStyleConfig
} from '../config/futsalAssessmentData';

import {
  BADMINTON_EVENT_TYPES,
  BADMINTON_PLAYING_STYLES,
  BADMINTON_DOUBLES_SPECS,
  BADMINTON_CORE_CATEGORIES,
  BADMINTON_EVENT_INDICATORS,
  BADMINTON_TIER_CONFIGS,
  PBSI_AGE_LEVELS,
  isBadmintonSport,
  isDoublesEvent,
  getBadmintonEventConfig,
  getBadmintonStyleConfig,
  getBadmintonDoublesSpecConfig,
  detectBadmintonTierFromAge,
  detectPbsiLevelFromAge,
  getAvailableBadmintonEventsForTier,
  getFilteredBadmintonIndicatorsForCategory,
  getBadmintonEventSpecificConfigForTier,
  isStyleUnlockedForTier,
  isDoublesSpecUnlockedForTier
} from '../config/badmintonAssessmentData';

import { isTennisSport } from '../config/tennisAssessmentData';
import TennisAssessmentView from './TennisAssessmentView';

// =====================================================================
// RESTRUKTURISASI MATRIKS KPI 4-PILAR UNTUK CABANG OLAHRAGA LAIN
// =====================================================================
export const SPORT_KPI_MATRIX = {
  'racket': {
    label: 'Racket Sports (Badminton, Tenis, Padel)',
    pillars: {
      fisik: ['Footwork', 'Stamina Reli', 'Explosive Power'],
      teknik: ['Akurasi Servis', 'Kekuatan Smash', 'Dropshot / Netting', 'Defense / Block'],
      taktik: ['Ball Placement', 'Antisipasi Lawan', 'Court Coverage'],
      mental: ['Ketenangan Poin Kritis', 'Fokus', 'Fighting Spirit']
    },
    roles: ['Singles Specialist', 'Doubles Front Court', 'Doubles Rear Court']
  },
  'field': {
    label: 'Field & Team Sports (Olahraga Lapangan Lain)',
    pillars: {
      fisik: ['VO2 Max (Kardio)', 'Sprint & Acceleration', 'Body Balance'],
      teknik: ['Passing Accuracy', 'Dribbling & First Touch', 'Shooting / Finishing', 'Tackling / Intercepting'],
      taktik: ['Positioning', 'Kecepatan Transisi', 'Visi & Decision Making'],
      mental: ['Kerja Sama Tim', 'Komunikasi Lapangan', 'Disiplin Taktik']
    },
    roles: ['Goalkeeper / Keeper', 'Defender / Anchor', 'Midfielder / Playmaker', 'Flank / Winger', 'Forward / Pivot']
  },
  'court': {
    label: 'Court Team Sports (Basket 5x5 & 3x3)',
    pillars: {
      fisik: ['Vertical Jump', 'Lateral Quickness', 'Stamina Lari Bolak-Balik'],
      teknik: ['Shooting Accuracy (FG, 3PT, FT)', 'Ball Handling & Dribel', 'Passing Accuracy', 'Rebounding'],
      taktik: ['Spacing & Ruang', 'Eksekusi Pick & Roll', 'Rotasi Pertahanan (Help Defense)', 'Transisi Fast Break'],
      mental: ['Hustle', 'Kepemimpinan', 'Shot Clock Awareness']
    },
    roles: ['Point Guard', 'Shooting Guard / Wing', 'Center / Big Man']
  },
  'net': {
    label: 'Net Team Sports (Voli Indoor, Voli Pasir, Sepak Takraw)',
    pillars: {
      fisik: ['Jumping Power (Daya Ledak)', 'Waktu Reaksi (Reaction Time)', 'Fleksibilitas Tubuh'],
      teknik: ['Kualitas Servis', 'Receive / Digging (Bola Pertama)', 'Kualitas Set / Tosser', 'Smash / Spike', 'Blocking'],
      taktik: ['Membaca Serangan Lawan', 'Rotasi & Coverage', 'Variasi Serangan'],
      mental: ['Komunikasi Lapangan', 'Kepercayaan Diri', 'Resiliensi (Bangkit Eror)']
    },
    roles: ['Setter', 'Smasher / Open Spiker', 'Libero / Defender']
  }
};

export const CATEGORY_KPI_DICTIONARY = SPORT_KPI_MATRIX;

export const ROLE_SPECIFIC_KPIS = {
  'Singles Specialist': ['Court Coverage', 'Patience & Rally Construction'],
  'Doubles Front Court': ['Interception Reflex', 'Quick Tap & Drive'],
  'Doubles Rear Court': ['Jump Smash Power', 'Backcourt Defense Rotation'],
  'Goalkeeper': ['Shot Stopping & Reflex', 'Distribution & Throw-in'],
  'Goalkeeper / Keeper': ['Shot Stopping & Reflex', 'Distribution & Throw-in'],
  'Anchor / Defender': ['Tackling / Intercept', 'Defensive Positioning'],
  'Defender / Anchor': ['Tackling / Intercept', 'Defensive Positioning'],
  'Midfielder / Playmaker': ['Passing Range & Ball Retention', 'Box-to-Box Stamina & Pressing'],
  'Midfielder': ['Passing Range & Ball Retention', 'Box-to-Box Stamina & Pressing'],
  'Flank / Winger': ['Sprint Speed & Crossing', '1v1 Dribble Penetration'],
  'Forward / Pivot': ['Finishing / Target Hold', 'First Touch Under Pressure'],
  'Pivot / Striker': ['Finishing / Target Hold', 'First Touch Under Pressure'],
  'Attacker / Pivot': ['Finishing / Target Hold', 'First Touch Under Pressure'],
  'Point Guard': ['Court Vision & Assist', 'Pace & Ball Control'],
  'Shooting Guard / Wing': ['3-Point Accuracy', 'Perimeter Defense'],
  'Center / Big Man': ['Post Moves & Hook', 'Rim Protection / Blocks'],
  'Setter': ['Set Precision & Deception', 'Second Ball Attack'],
  'Smasher / Open Spiker': ['Vertical Jump & Spike Angle', 'Tooling the Block'],
  'Libero / Defender': ['Dig Reflex & Diving', 'Free Ball Reception Quality']
};

export function resolveSportCategoryKey(selectedClass, activeAcademy) {
  if (selectedClass?.sportCategory && SPORT_KPI_MATRIX[selectedClass.sportCategory]) {
    return selectedClass.sportCategory;
  }
  const acadCat = activeAcademy?.category || activeAcademy?.sportCategory;
  if (acadCat && SPORT_KPI_MATRIX[acadCat]) {
    return acadCat;
  }
  const sportName = (selectedClass?.sport || activeAcademy?.sport || '').toLowerCase();
  if (['badminton', 'tenis', 'padel', 'squash', 'tenis meja', 'bulutangkis'].some((s) => sportName.includes(s))) {
    return 'racket';
  }
  if (['basket', 'basketball'].some((s) => sportName.includes(s))) {
    return 'court';
  }
  if (['voli', 'volleyball', 'takraw'].some((s) => sportName.includes(s))) {
    return 'net';
  }
  return 'field';
}

function getScoreGrade(score) {
  if (score >= 85) return { grade: 'A (Sangat Baik)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (score >= 75) return { grade: 'B (Baik)', badge: 'bg-[#354944]/10 text-[#354944] border-[#354944]/30' };
  if (score >= 60) return { grade: 'C (Cukup)', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { grade: 'D (Perlu Bimbingan)', badge: 'bg-rose-100 text-rose-800 border-rose-300' };
}

function formatDateIndonesian(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
}

// =====================================================================
// MAIN COMPONENT EXPORT
// =====================================================================
export default function EvaluationSection({ selectedClass, students = [], tenantId, activeAcademy }) {
  // Filter students in current active class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.classId === selectedClass?.id);
  }, [students, selectedClass?.id]);

  // Firestore fetch-once evaluation history (limited to 100 docs)
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [filterStudentId, setFilterStudentId] = useState('ALL');

  const fetchHistory = useCallback(async () => {
    if (!tenantId || !selectedClass?.id) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const list = await supabaseAcademyService.getEvaluationsByClass(tenantId, selectedClass.id, 100);
      setHistory(list);
    } catch (err) {
      console.error('[Supabase getEvaluationsByClass Error]:', err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [tenantId, selectedClass?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleEvaluationSaved = (newEval) => {
    if (newEval && newEval.id) {
      setHistory((prev) => [newEval, ...prev.filter((h) => h.id !== newEval.id)]);
    } else {
      fetchHistory();
    }
  };

  const handleDeleteEvaluation = async (id, studentName) => {
    if (!window.confirm(`Hapus data rapor evaluasi untuk ${studentName}?`)) return;
    try {
      await supabaseAcademyService.deleteEvaluation(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Failed to delete evaluation from Supabase:', err);
    }
  };

  const isFootball = useMemo(() => {
    return isFootballOrMinisoccer(selectedClass, activeAcademy);
  }, [selectedClass, activeAcademy]);

  const isFutsal = useMemo(() => {
    return isFutsalSport(selectedClass, activeAcademy);
  }, [selectedClass, activeAcademy]);

  const isBadminton = useMemo(() => {
    return isBadmintonSport(selectedClass, activeAcademy);
  }, [selectedClass, activeAcademy]);

  const isTennis = useMemo(() => {
    return isTennisSport(selectedClass, activeAcademy);
  }, [selectedClass, activeAcademy]);

  const effectiveSelectedClass = useMemo(() => {
    if (!selectedClass) return null;
    if (isTennis && (!selectedClass.sport || selectedClass.sport.toLowerCase() !== 'tenis')) {
      return { ...selectedClass, sport: 'Tenis' };
    }
    return selectedClass;
  }, [selectedClass, isTennis]);

  if (isTennis) {
    return (
      <TennisAssessmentView
        selectedClass={effectiveSelectedClass}
        students={classStudents}
        tenantId={tenantId}
        activeAcademy={activeAcademy}
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        onDeleteEvaluation={handleDeleteEvaluation}
        onEvaluationSaved={handleEvaluationSaved}
      />
    );
  }

  if (isBadminton) {
    return (
      <BadmintonAssessmentView
        selectedClass={selectedClass}
        students={classStudents}
        tenantId={tenantId}
        activeAcademy={activeAcademy}
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        onDeleteEvaluation={handleDeleteEvaluation}
        onEvaluationSaved={handleEvaluationSaved}
      />
    );
  }

  if (isFutsal) {
    return (
      <FutsalAssessmentView
        selectedClass={selectedClass}
        students={classStudents}
        tenantId={tenantId}
        activeAcademy={activeAcademy}
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        onDeleteEvaluation={handleDeleteEvaluation}
        onEvaluationSaved={handleEvaluationSaved}
      />
    );
  }

  if (isFootball) {
    return (
      <FootballAssessmentView
        selectedClass={selectedClass}
        students={classStudents}
        tenantId={tenantId}
        activeAcademy={activeAcademy}
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        onDeleteEvaluation={handleDeleteEvaluation}
        onEvaluationSaved={handleEvaluationSaved}
      />
    );
  }

  return (
    <Standard4PillarView
      selectedClass={selectedClass}
      classStudents={classStudents}
      tenantId={tenantId}
      activeAcademy={activeAcademy}
      history={history}
      loadingHistory={loadingHistory}
      filterStudentId={filterStudentId}
      setFilterStudentId={setFilterStudentId}
      onDeleteEvaluation={handleDeleteEvaluation}
      onEvaluationSaved={handleEvaluationSaved}
    />
  );
}

// =====================================================================
// COMPONENT 1: ATHLETE DEVELOPMENT ASSESSMENT KHUSUS FUTSAL (4-TIER LTAD)
// =====================================================================
function FutsalAssessmentView({
  selectedClass,
  students,
  tenantId,
  activeAcademy,
  history,
  loadingHistory,
  filterStudentId,
  setFilterStudentId,
  onDeleteEvaluation,
  onEvaluationSaved
}) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().split('T')[0]);

  const selectedStudent = useMemo(() => {
    if (students.length === 0) return null;
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  // DETEKSI OTOMATIS TIER FUTSAL DARI USIA + OVERRIDE DROPDOWN
  const [overrideFutsalTier, setOverrideFutsalTier] = useState('AUTO');

  // Sinkronisasi otomatis tier futsal dengan kelompok umur kelas terpilih
  useEffect(() => {
    if (selectedClass?.tierCode && selectedClass.tierCode !== 'ALL_AGE') {
      const code = selectedClass.tierCode;
      if (code === 'U-8' || code === 'U-10' || code === 'U-12') {
        setOverrideFutsalTier('1');
      } else if (code === 'U-14') {
        setOverrideFutsalTier('2');
      } else if (code === 'U-16') {
        setOverrideFutsalTier('3');
      } else if (code === 'U-18') {
        setOverrideFutsalTier('4');
      } else if (['1', '2', '3', '4'].includes(String(code))) {
        setOverrideFutsalTier(String(code));
      }
    } else if (selectedClass?.minAge || selectedClass?.maxAge) {
      const midAge = Math.round(((selectedClass.minAge || 6) + (selectedClass.maxAge || 12)) / 2);
      const tierNum = detectFutsalTierFromAge(midAge);
      setOverrideFutsalTier(String(tierNum));
    }
  }, [selectedClass?.id, selectedClass?.tierCode, selectedClass?.minAge, selectedClass?.maxAge]);

  const studentAge = useMemo(() => {
    if (!selectedStudent) return 0;
    if (selectedStudent.birthDate) {
      const calculated = calculateAge(selectedStudent.birthDate);
      if (calculated !== '-') {
        const num = parseInt(String(calculated).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    const rawAge = selectedStudent.age || selectedStudent.umur;
    if (rawAge) {
      const num = parseInt(String(rawAge).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) return num;
    }
    return 10;
  }, [selectedStudent]);

  const detectedFutsalTier = useMemo(() => {
    return detectFutsalTierFromAge(studentAge);
  }, [studentAge]);

  const activeFutsalTier = useMemo(() => {
    if (overrideFutsalTier && overrideFutsalTier !== 'AUTO') {
      return parseInt(overrideFutsalTier, 10);
    }
    return detectedFutsalTier;
  }, [overrideFutsalTier, detectedFutsalTier]);

  const futsalTierConfig = FUTSAL_TIER_CONFIGS[activeFutsalTier] || FUTSAL_TIER_CONFIGS[1];

  // Position, Specialization, StyleCode for Futsal
  const [selectedPosition, setSelectedPosition] = useState('FIXO');
  const [selectedStyleCode, setSelectedStyleCode] = useState('STY01');

  // Active Category Tab & Modal States
  const [activeTab, setActiveTab] = useState('fisik');
  const [showAllAtOnce, setShowAllAtOnce] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalCategoryKey, setActiveModalCategoryKey] = useState('fisik');
  const [showAllInline, setShowAllInline] = useState(false);

  // Scores state: { [indicatorName]: number }
  const [scores, setScores] = useState({});
  const [coachNote, setCoachNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Status indicator loading state
  const [showMobileRadar, setShowMobileRadar] = useState(true);

  const sportName = selectedClass?.sport || activeAcademy?.sport || 'Futsal';

  // Memoized latest evaluation doc for current student
  const latestEvalDoc = useMemo(() => {
    if (!selectedStudent?.id || !history || history.length === 0) return null;
    const studentHistory = history.filter((h) => h.studentId === selectedStudent.id);
    if (studentHistory.length === 0) return null;
    studentHistory.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    return studentHistory[0];
  }, [selectedStudent?.id, history]);

  // Available positions depending on activeFutsalTier
  const availablePositions = useMemo(() => {
    return getAvailableFutsalPositionsForTier(activeFutsalTier);
  }, [activeFutsalTier]);

  // Position-Specific Indicators Config for Futsal depending on activeFutsalTier
  const currentPosIndicatorsConfig = useMemo(() => {
    return getFutsalPositionIndicatorsForTier(selectedPosition, activeFutsalTier);
  }, [selectedPosition, activeFutsalTier]);

  // Ensure selectedPosition is valid for activeFutsalTier
  useEffect(() => {
    if (activeFutsalTier === 1) {
      if (!['COURT_DASAR', 'GK_DASAR'].includes(selectedPosition)) {
        setSelectedPosition('COURT_DASAR');
      }
    } else if (activeFutsalTier === 2) {
      if (!['GK', 'FIXO', 'ALA', 'PIVOT'].includes(selectedPosition)) {
        setSelectedPosition('FIXO');
      }
    } else {
      if (['COURT_DASAR', 'GK_DASAR'].includes(selectedPosition)) {
        setSelectedPosition(selectedStudent?.playerRole || selectedStudent?.position || 'FIXO');
      }
    }
  }, [activeFutsalTier, selectedStudent]);

  // LOGIKA TRANSISI & RESET STATE SETIAP KALI SISWA BERUBAH
  useEffect(() => {
    if (!selectedStudent?.id) {
      setScores({});
      return;
    }

    setCoachNote('');
    setErrorMsg(null);
    setSuccessMsg(null);

    if (latestEvalDoc) {
      setScores(latestEvalDoc.scores || {});

      const posCode = latestEvalDoc.playerRole || selectedStudent.playerRole || selectedStudent.position || (activeFutsalTier === 1 ? 'COURT_DASAR' : 'FIXO');
      setSelectedPosition(posCode);

      const styleVal = latestEvalDoc.styleCode || selectedStudent.styleCode || 'STY01';
      setSelectedStyleCode(styleVal);
    } else {
      // Siswa Baru: Default 0
      setScores({});

      const posCode = selectedStudent.playerRole || selectedStudent.position || (activeFutsalTier === 1 ? 'COURT_DASAR' : 'FIXO');
      setSelectedPosition(posCode);
      setSelectedStyleCode(selectedStudent.styleCode || 'STY01');
    }
  }, [selectedStudent?.id, latestEvalDoc?.id]);

  // Filtered Indicator Names for each of the 6 Futsal Core Categories based on minTier <= activeFutsalTier
  const filteredCategoryIndicators = useMemo(() => {
    return {
      fisik: getFilteredFutsalIndicatorsForCategory('fisik', activeFutsalTier),
      teknik: getFilteredFutsalIndicatorsForCategory('teknik', activeFutsalTier),
      taktik: getFilteredFutsalIndicatorsForCategory('taktik', activeFutsalTier),
      mental: getFilteredFutsalIndicatorsForCategory('mental', activeFutsalTier),
      perkembangan: getFilteredFutsalIndicatorsForCategory('perkembangan', activeFutsalTier),
      komunikasi: getFilteredFutsalIndicatorsForCategory('komunikasi', activeFutsalTier)
    };
  }, [activeFutsalTier]);

  // 7-Axis Calculated Average Scores for Futsal
  const axisScores = useMemo(() => {
    const calcCategoryAvg = (indicatorList) => {
      if (!indicatorList || indicatorList.length === 0) return 0;
      const total = indicatorList.reduce((sum, ind) => {
        const val = scores[ind] !== undefined ? scores[ind] : 0;
        return sum + val;
      }, 0);
      return Math.round(total / indicatorList.length);
    };

    const fisik = calcCategoryAvg(filteredCategoryIndicators.fisik);
    const teknik = calcCategoryAvg(filteredCategoryIndicators.teknik);
    const taktik = calcCategoryAvg(filteredCategoryIndicators.taktik);
    const mental = calcCategoryAvg(filteredCategoryIndicators.mental);
    const perkembangan = calcCategoryAvg(filteredCategoryIndicators.perkembangan);
    const komunikasi = calcCategoryAvg(filteredCategoryIndicators.komunikasi);
    const khususPosisi = calcCategoryAvg(currentPosIndicatorsConfig.indicators);

    const overall = Math.round((fisik + teknik + taktik + mental + perkembangan + komunikasi + khususPosisi) / 7);

    return {
      fisik,
      teknik,
      taktik,
      mental,
      perkembangan,
      komunikasi,
      khususPosisi,
      overall
    };
  }, [scores, filteredCategoryIndicators, currentPosIndicatorsConfig]);

  // Structured Category List for Interactive Cards & Focus Modal
  const futsalCategoryList = useMemo(() => [
    { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: filteredCategoryIndicators.fisik.length, score: axisScores.fisik, indicators: filteredCategoryIndicators.fisik },
    { key: 'teknik', label: '2. Kemampuan Teknik', shortLabel: 'Teknik', count: filteredCategoryIndicators.teknik.length, score: axisScores.teknik, indicators: filteredCategoryIndicators.teknik },
    { key: 'taktik', label: '3. Pemahaman Taktik', shortLabel: 'Taktik', count: filteredCategoryIndicators.taktik.length, score: axisScores.taktik, indicators: filteredCategoryIndicators.taktik },
    { key: 'mental', label: '4. Mentalitas', shortLabel: 'Mental', count: filteredCategoryIndicators.mental.length, score: axisScores.mental, indicators: filteredCategoryIndicators.mental },
    { key: 'perkembangan', label: '5. Perkembangan Atlet', shortLabel: 'Perkembangan', count: filteredCategoryIndicators.perkembangan.length, score: axisScores.perkembangan, indicators: filteredCategoryIndicators.perkembangan },
    { key: 'komunikasi', label: '6. Komunikasi Lapangan', shortLabel: 'Komunikasi', count: filteredCategoryIndicators.komunikasi.length, score: axisScores.komunikasi, indicators: filteredCategoryIndicators.komunikasi },
    { key: 'posisi', label: `7. Khusus Posisi (${currentPosIndicatorsConfig.shortLabel || 'Posisi'})`, shortLabel: 'Khusus Posisi', count: currentPosIndicatorsConfig.indicators.length, score: axisScores.khususPosisi, indicators: currentPosIndicatorsConfig.indicators, isSpecial: true }
  ], [filteredCategoryIndicators, currentPosIndicatorsConfig, axisScores]);

  const handleSetCategoryPreset = (catKey, presetScore) => {
    const catObj = futsalCategoryList.find((c) => c.key === catKey);
    if (!catObj || !catObj.indicators) return;

    setScores((prev) => {
      const updated = { ...prev };
      catObj.indicators.forEach((ind) => {
        updated[ind] = presetScore;
      });
      return updated;
    });
  };

  // Recharts radar data for Futsal
  const radarData = useMemo(() => [
    { subject: 'Fisik', A: axisScores.fisik, fullMark: 100 },
    { subject: 'Teknik', A: axisScores.teknik, fullMark: 100 },
    { subject: 'Taktik', A: axisScores.taktik, fullMark: 100 },
    { subject: 'Mental', A: axisScores.mental, fullMark: 100 },
    { subject: 'Perkembangan', A: axisScores.perkembangan, fullMark: 100 },
    { subject: 'Komunikasi', A: axisScores.komunikasi, fullMark: 100 },
    { subject: 'Khusus Posisi', A: axisScores.khususPosisi, fullMark: 100 },
  ], [axisScores]);

  // Adjust score with +/- 5
  const handleAdjustScore = (indicatorName, delta) => {
    setScores((prev) => {
      const curr = prev[indicatorName] !== undefined ? prev[indicatorName] : 0;
      const nextVal = Math.min(100, Math.max(0, curr + delta));
      return { ...prev, [indicatorName]: nextVal };
    });
  };

  const handleScoreChange = (indicatorName, value) => {
    setScores((prev) => ({
      ...prev,
      [indicatorName]: Math.min(100, Math.max(0, Number(value) || 0))
    }));
  };

  const handleSetAllGlobalValue = (val) => {
    const activeIndicators = [];
    Object.values(filteredCategoryIndicators).forEach((arr) => {
      activeIndicators.push(...arr);
    });
    activeIndicators.push(...currentPosIndicatorsConfig.indicators);

    const nextState = { ...scores };
    activeIndicators.forEach((ind) => {
      nextState[ind] = val;
    });
    setScores(nextState);

    setSuccessMsg(`Seluruh indikator aktif Futsal Tier ${activeFutsalTier} (${activeIndicators.length}) di-set ke ${val}.`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };


  const handleGenerateDraft = () => {
    if (!selectedStudent) return;

    const categoriesList = [
      { name: 'Kondisi Fisik', score: axisScores.fisik },
      { name: 'Kemampuan Teknik', score: axisScores.teknik },
      { name: 'Pemahaman Taktik Futsal', score: axisScores.taktik },
      { name: 'Mentalitas', score: axisScores.mental },
      { name: 'Perkembangan Atlet', score: axisScores.perkembangan },
      { name: 'Komunikasi Rotasi', score: axisScores.komunikasi },
      { name: `Indikator Khusus (${currentPosIndicatorsConfig.shortLabel})`, score: axisScores.khususPosisi },
    ];

    const sorted = [...categoriesList].sort((a, b) => b.score - a.score);
    const topPillar = sorted[0];
    const bottomPillar = sorted[sorted.length - 1];
    const overall = axisScores.overall;

    let draft = '';

    if (activeFutsalTier === 1 || activeFutsalTier === 2) {
      // Tier 1 & 2 Futsal: Focus on fun, sole control, motor skills, basic rotation without complex STY
      let summaryText = 'menunjukkan antusiasme dan kesenangan bermain Futsal yang tinggi.';
      if (overall < 50) summaryText = 'dalam tahap pengenalan kontrol sole (telapak kaki) dan gerak dasar lapangan kecil.';
      else if (overall >= 75) summaryText = 'sangat berbakat dengan kontrol telapak kaki dan kelincahan ruang sempit yang luar biasa.';

      draft = `[Rapor Perkembangan Futsal ${futsalTierConfig.shortLabel}]\n` +
        `Atlet ${selectedStudent.studentName} berada pada tahap ${futsalTierConfig.label} (${currentPosIndicatorsConfig.label}). Atlet ${summaryText}\n\n` +
        `Aspek yang paling berkembang: ${topPillar.name} (Skor: ${topPillar.score}/100).\n` +
        `Fokus pembinaan selanjutnya: ${bottomPillar.name} (Skor: ${bottomPillar.score}/100).\n\n` +
        `Rata-rata perkembangan Futsal saat ini: ${overall}/100.`;
    } else {
      // Tier 3 & 4: Focus on tactical position, specialization, and STY01-STY14
      const styleObj = getFutsalStyleConfig(selectedStyleCode);
      let summaryText = 'sangat baik dan menunjukkan penguasaan rotasi permainan yang matang.';
      if (overall < 60) summaryText = 'membutuhkan pembinaan teknik dasar dan rotasi intensif.';
      else if (overall < 80) summaryText = 'cukup solid dengan progres positif.';

      draft = `[Rapor Taktis Futsal ${futsalTierConfig.shortLabel} - ${currentPosIndicatorsConfig.shortLabel}]\n` +
        `Atlet ${selectedStudent.studentName} dievaluasi pada posisi Futsal ${currentPosIndicatorsConfig.label} dengan profil gaya bermain ${styleObj.code} — ${styleObj.name} (${styleObj.desc}).\n\n` +
        `Keunggulan utama ditunjukkan pada ${topPillar.name} (Skor: ${topPillar.score}/100). Aspek yang perlu ditingkatkan adalah ${bottomPillar.name} (Skor: ${bottomPillar.score}/100).\n\n` +
        `Secara keseluruhan, performa atlet dinilai ${summaryText} (Skor Total: ${overall}/100).`;
    }

    setCoachNote(draft);
  };

  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedClass?.id || !tenantId) return;
    if (!selectedStudent?.id) {
      setErrorMsg('Pilih siswa atlet dari daftar untuk dievaluasi.');
      return;
    }
    if (!evaluationDate) {
      setErrorMsg('Tanggal evaluasi wajib diisi.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const evaluatorName = selectedClass.coachName || selectedClass.coach || 'Pelatih Utama';

    const activeIndicators = [];
    Object.values(filteredCategoryIndicators).forEach((arr) => {
      activeIndicators.push(...arr);
    });
    activeIndicators.push(...currentPosIndicatorsConfig.indicators);

    const finalScores = {};
    activeIndicators.forEach((ind) => {
      finalScores[ind] = scores[ind] !== undefined ? scores[ind] : 0;
    });

    const styleObj = getFutsalStyleConfig(selectedStyleCode);

    try {
      const savedEval = await supabaseAcademyService.createEvaluation({
        tenantId,
        academyId: selectedClass.academyId || activeAcademy?.id || '',
        classId: selectedClass.id,
        className: selectedClass.className || selectedClass.name || 'Kelas Futsal',
        sportCategory: 'futsal',
        sportCategoryLabel: `Futsal (${futsalTierConfig.shortLabel})`,
        sportName: 'Futsal',
        sport: 'Futsal',
        activeTier: activeFutsalTier,
        curriculumTier: activeFutsalTier,
        tierLabel: futsalTierConfig.label,
        ageStage: futsalTierConfig.shortLabel,
        playerRole: selectedPosition,
        specialization: activeFutsalTier >= 3 ? currentPosIndicatorsConfig.shortLabel : 'Eksplorasi Futsal',
        styleCode: activeFutsalTier >= 3 ? selectedStyleCode : 'N/A',
        styleLabel: activeFutsalTier >= 3 ? styleObj.name : 'N/A',
        studentId: selectedStudent.id,
        studentName: selectedStudent.studentName || 'Siswa',
        date: evaluationDate,
        scores: finalScores,
        pillarScores: {
          fisik: axisScores.fisik,
          teknik: axisScores.teknik,
          taktik: axisScores.taktik,
          mental: axisScores.mental,
          perkembangan: axisScores.perkembangan,
          komunikasi: axisScores.komunikasi,
          khususPosisi: axisScores.khususPosisi,
          position: axisScores.khususPosisi,
          overall: axisScores.overall
        },
        overallScore: axisScores.overall,
        coachNote: coachNote.trim(),
        evaluator: evaluatorName
      });

      setSuccessMsg(`Assessment Futsal (${futsalTierConfig.shortLabel}) untuk ${selectedStudent.studentName} berhasil disimpan!`);
      setCoachNote('');
      if (onEvaluationSaved) onEvaluationSaved(savedEval);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to save futsal assessment to Supabase:', err);
      setErrorMsg('Gagal menyimpan assessment Futsal. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const evaluatedStudentIdsToday = new Set(
    history.filter((h) => h.date === evaluationDate).map((h) => h.studentId)
  );

  const overallGrade = getScoreGrade(axisScores.overall);

  return (
    <div className="space-y-6 text-left">
      {/* 1. COMPACT HEADER BAR */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        {/* MOBILE COMPACT TITLE BAR (< 1024px) */}
        <div className="flex lg:hidden items-center justify-between pb-2.5 border-b border-slate-100">
          <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
            Evaluasi Atlet
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#354944]/10 text-[#354944] border border-[#354944]/20">
              Futsal
            </span>
            {latestEvalDoc ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Terisi ({formatDateIndonesian(latestEvalDoc.date)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold">
                <span>Belum Ada</span>
              </span>
            )}
          </div>
        </div>

        {/* DESKTOP TITLE BAR (>= 1024px) */}
        <div className="hidden lg:flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#354944] text-white flex items-center justify-center font-bold shrink-0 shadow-xs border border-[#C89D32]/40">
              <Flame className="w-5 h-5 text-[#C89D32]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
                Athlete Development Assessment
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#354944]/10 text-[#354944] border border-[#354944]/20">
                Futsal
              </span>
            </div>
          </div>

          <div className="self-start sm:self-center">
            {loadingHistory ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Memuat riwayat...</span>
              </span>
            ) : latestEvalDoc ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Riwayat Terakhir Terpasang (Tanggal: {formatDateIndonesian(latestEvalDoc.date)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Belum ada riwayat (Mulai dari 0)</span>
              </span>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {students.length === 0 ? (
          <div className="py-8 border border-dashed border-slate-200 rounded-2xl text-center p-6 bg-slate-50/50">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Belum ada siswa terdaftar di kelas Futsal ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* INPUT FILTER AREA (2 BARIS KOMPAK DI MOBILE) */}
            <div className="bg-slate-50/90 p-3 sm:p-4 rounded-2xl border border-slate-200/90 space-y-2.5">
              {/* Baris 1: Pilih Atlet (1 Kolom Penuh) */}
              <div>
                <label className="block text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#354944]" />
                  <span>Pilih Atlet ({students.length})</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedStudent?.id || ''}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 shadow-2xs cursor-pointer appearance-none pr-8"
                  >
                    {students.map((st) => {
                      const isEvaluatedToday = evaluatedStudentIdsToday.has(st.id);
                      const pos = st.playerRole || st.position || 'FIXO';
                      return (
                        <option key={st.id} value={st.id}>
                          {isEvaluatedToday ? '✓ [Terisi] ' : ''}{st.studentName} — Posisi: {pos}
                        </option>
                      );
                    })}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Baris 2: Tanggal Evaluasi & Jenjang Evaluasi (2 Kolom Berdampingan) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#354944]" />
                    <span>Tanggal</span>
                  </label>
                  <input
                    type="date"
                    value={evaluationDate}
                    onChange={(e) => setEvaluationDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 shadow-2xs cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-[#354944]" />
                    <span>Jenjang</span>
                  </label>
                  <select
                    value={overrideFutsalTier}
                    onChange={(e) => setOverrideFutsalTier(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-[#354944] shadow-2xs cursor-pointer truncate"
                  >
                    <option value="AUTO">Otomatis: Tier {detectedFutsalTier} ({studentAge} Thn)</option>
                    <option value="1">Tier 1 — Usia Dini (6–12 Thn)</option>
                    <option value="2">Tier 2 — Youth (13–15 Thn)</option>
                    <option value="3">Tier 3 — Junior (16–19 Thn)</option>
                    <option value="4">Tier 4 — Profesional (&gt;19 Thn)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. PANEL ATAS: SCOUTING RADAR & KONFIGURASI POSISI */}
            {selectedStudent && (
              <form onSubmit={handleSaveEvaluation} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  
                  {/* RADAR 7-AXIS */}
                  <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-md flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-[#C89D32]" />
                        <span className="text-xs font-black uppercase tracking-wider text-white">
                          Scouting Radar
                        </span>
                      </div>

                      {/* Header kanan: Skor Realtime & Toggle Mobile */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#C89D32] bg-slate-800 px-2 py-0.5 rounded-full border border-white/10">
                          {axisScores.overall}/100
                        </span>
                        <span className={`lg:hidden px-2 py-0.5 text-[10px] font-bold rounded-full ${overallGrade.badge}`}>
                          {overallGrade.grade.split(' ')[0]}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowMobileRadar(!showMobileRadar)}
                          className="lg:hidden text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-lg border border-white/10 transition-colors cursor-pointer"
                        >
                          {showMobileRadar ? 'Lipat ▴' : 'Buka ▾'}
                        </button>
                      </div>
                    </div>

                    {showMobileRadar && (
                      <div className="h-56 sm:h-64 w-full flex items-center justify-center my-auto">
                        <ResponsiveContainer width="100%" height={230}>
                          <RadarChart cx="50%" cy="50%" outerRadius="62%" data={radarData} margin={{ top: 8, right: 15, bottom: 8, left: 15 }}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 700 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={false} />
                            <Radar
                              name="Skor Futsal"
                              dataKey="A"
                              stroke="#C89D32"
                              fill="#354944"
                              fillOpacity={0.65}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-300 bg-slate-800/80 p-2.5 rounded-xl flex items-center justify-between border border-white/5">
                      <span className="text-slate-400">Rata-Rata (7 Kategori):</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[#C89D32] font-black text-xs">{axisScores.overall} / 100</strong>
                        <span className="text-[10px] font-bold text-slate-400">({overallGrade.grade})</span>
                      </div>
                    </div>
                  </div>

                  {/* KONFIGURASI POSISI & PERAN */}
                  <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs h-full flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      {/* Header Kartu */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-orange-600" />
                          <span>Konfigurasi Posisi &amp; Peran</span>
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-bold">
                          {futsalTierConfig.shortLabel}
                        </span>
                      </div>

                      {/* Banner Skor Realtime & Predikat Evaluasi */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                              Skor Realtime
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-xl font-black text-slate-900 tracking-tight">
                                {axisScores.overall}
                              </span>
                              <span className="text-xs font-bold text-slate-400">/ 100</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 text-xs font-black rounded-lg border shadow-2xs shrink-0 ${overallGrade.badge}`}>
                            {overallGrade.grade}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 rounded-full transition-all duration-300" 
                            style={{ width: `${Math.min(100, Math.max(0, axisScores.overall))}%` }} 
                          />
                        </div>
                      </div>

                      {/* Dropdown Posisi & Gaya Bermain */}
                      <div className="space-y-3">
                        {/* POSISI FUTSAL */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                            1. Posisi Pemain
                          </label>
                          <select
                            value={selectedPosition}
                            onChange={(e) => setSelectedPosition(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-slate-800 cursor-pointer"
                          >
                            {availablePositions.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* STY DROPDOWN - RENDER ONLY IF ACTIVE FUTSAL TIER >= 3 */}
                        {activeFutsalTier >= 3 && (
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                              2. Profil Gaya Bermain (STY)
                            </label>
                            <select
                              value={selectedStyleCode}
                              onChange={(e) => setSelectedStyleCode(e.target.value)}
                              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-slate-800 cursor-pointer"
                            >
                              {FUTSAL_PLAYING_STYLES.map((st) => (
                                <option key={st.code} value={st.code}>
                                  {st.code} &mdash; {st.name} ({st.desc})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BAR KONTROL PRESET SKOR CEPAT (DI BAGIAN BAWAH KARTU) */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-orange-600" />
                        <span>Preset Nilai Cepat:</span>
                      </span>

                      <div className="grid grid-cols-4 gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(0)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                          title="Reset semua indikator ke 0"
                        >
                          <RotateCcw className="w-3 h-3 shrink-0" />
                          <span>Reset</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(50)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                        >
                          Standard
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(75)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200 transition-all cursor-pointer shadow-2xs"
                        >
                          Good
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(90)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                        >
                          Elite
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* PANEL RINGKASAN SKOR KATEGORI (GRID 2 KOLOM DI MOBILE) */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-[#354944]" />
                        <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                          Ringkasan Skor Kategori
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-slate-600 sm:hidden">
                        Rata-Rata: <strong className="text-slate-900 font-black">{axisScores.overall}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 mr-1 hidden sm:inline">
                        Rata-Rata: <strong className="text-slate-900 font-black">{axisScores.overall} / 100</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveModalCategoryKey(futsalCategoryList[0]?.key);
                          setIsModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none px-3 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#C89D32]" />
                        <span>✎ Edit Penilaian</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAllInline(!showAllInline)}
                        className={`flex-1 sm:flex-none px-3 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          showAllInline
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>{showAllInline ? 'Tutup' : 'Buka Semua'}</span>
                      </button>
                    </div>
                  </div>

                  {/* GRID 2 KOLOM DI MOBILE (< 1024px), 3 KOLOM DI DESKTOP */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
                    {futsalCategoryList.map((cat, idx) => {
                      const isFilled = (cat.score || 0) > 0;
                      return (
                        <div
                          key={cat.key}
                          onClick={() => {
                            setActiveModalCategoryKey(cat.key);
                            setIsModalOpen(true);
                          }}
                          className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90 hover:border-[#354944] hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <span className="font-bold text-xs text-slate-900 block leading-tight line-clamp-1" title={cat.label}>
                              {idx + 1}. {cat.label}
                            </span>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 font-medium">
                                {cat.count} Indikator
                              </span>
                              {isFilled ? (
                                <span className="text-emerald-700 font-extrabold">✓ Terisi</span>
                              ) : (
                                <span className="text-slate-400 font-medium">Kosong</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Skor</span>
                              <span className="text-sm font-extrabold text-slate-900 font-mono">
                                {cat.score || 0}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#354944] rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, cat.score || 0))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. SUB-TABS 7 KATEGORI (OPSIONAL HANYA SAAT showAllInline = true) */}
                {showAllInline && (
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5 animate-fadeIn">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-orange-600" />
                      <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                        Lembar Penilaian Futsal ({futsalTierConfig.shortLabel})
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAllAtOnce(!showAllAtOnce)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                        showAllAtOnce
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>{showAllAtOnce ? 'Tutup (Kembali ke Tab)' : 'Tampilkan Semua Sekaligus'}</span>
                    </button>
                  </div>

                  {!showAllAtOnce && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setActiveTab('fisik')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                          activeTab === 'fisik'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-rose-50/60 text-rose-900 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <Dumbbell className="w-3.5 h-3.5" />
                        <span>Fisik ({filteredCategoryIndicators.fisik.length})</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'fisik' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'}`}>
                          {axisScores.fisik}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('teknik')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                          activeTab === 'teknik'
                            ? 'bg-[#354944] text-white border-[#354944] shadow-xs'
                            : 'bg-[#354944]/10 text-[#354944] border-[#354944]/20 hover:bg-[#354944]/20'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Teknik ({filteredCategoryIndicators.teknik.length})</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'teknik' ? 'bg-[#2B3D38] text-white' : 'bg-[#354944]/20 text-[#354944]'}`}>
                          {axisScores.teknik}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('taktik')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                          activeTab === 'taktik'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-purple-50/60 text-purple-900 border-purple-200 hover:bg-purple-100'
                        }`}
                      >
                        <Brain className="w-3.5 h-3.5" />
                        <span>Taktik ({filteredCategoryIndicators.taktik.length})</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'taktik' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-900'}`}>
                          {axisScores.taktik}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('mental')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                          activeTab === 'mental'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-emerald-50/60 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Mental ({filteredCategoryIndicators.mental.length})</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'mental' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
                          {axisScores.mental}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('komunikasi')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                          activeTab === 'komunikasi'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-amber-50/60 text-amber-900 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Komunikasi ({filteredCategoryIndicators.komunikasi.length})</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'komunikasi' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                          {axisScores.komunikasi}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('perkembangan')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                          activeTab === 'perkembangan'
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                            : 'bg-cyan-50/60 text-cyan-900 border-cyan-200 hover:bg-cyan-100'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Perkembangan ({filteredCategoryIndicators.perkembangan.length})</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'perkembangan' ? 'bg-cyan-700 text-white' : 'bg-cyan-200 text-cyan-900'}`}>
                          {axisScores.perkembangan}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('posisi')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                          activeTab === 'posisi'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-indigo-50/60 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Khusus Posisi ({currentPosIndicatorsConfig.indicators.length})</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'posisi' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-900'}`}>
                          {axisScores.khususPosisi}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="space-y-6">
                    {Object.entries(FUTSAL_CORE_CATEGORIES).map(([catKey, catConfig]) => {
                      if (!showAllAtOnce && activeTab !== catKey) return null;
                      const activeInds = filteredCategoryIndicators[catKey] || [];

                      return (
                        <div key={catKey} className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${catConfig.badgeColor}`} />
                              <span>{catConfig.title}</span>
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white border border-slate-200 text-slate-800">
                              Rata-rata: {axisScores[catKey]} / 100
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                            {activeInds.map((ind) => {
                              const val = scores[ind] !== undefined ? scores[ind] : 0;
                              return (
                                <IndicatorCard
                                  key={ind}
                                  title={ind}
                                  value={val}
                                  onScoreChange={(v) => handleScoreChange(ind, v)}
                                  onAdjust={(delta) => handleAdjustScore(ind, delta)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {(showAllAtOnce || activeTab === 'posisi') && (
                      <div className="p-4 sm:p-5 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                        <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                            <Star className="w-4 h-4 text-indigo-600 fill-indigo-100" />
                            <span>Khusus Posisi: {currentPosIndicatorsConfig.label}</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Rata-rata: {axisScores.khususPosisi} / 100
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                          {currentPosIndicatorsConfig.indicators.map((ind) => {
                            const val = scores[ind] !== undefined ? scores[ind] : 0;
                            return (
                              <IndicatorCard
                                key={ind}
                                title={ind}
                                value={val}
                                isSpecial
                                onScoreChange={(v) => handleScoreChange(ind, v)}
                                onAdjust={(delta) => handleAdjustScore(ind, delta)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* 4. CATATAN & SIMPAN */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#354944]" />
                      <span>Catatan Evaluasi Pelatih ({futsalTierConfig.shortLabel})</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateDraft}
                      className="px-3.5 py-1.5 bg-[#354944]/10 hover:bg-[#354944]/20 text-[#354944] border border-[#354944]/20 text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#C89D32]" />
                      <span>Buat Draf Analisis Otomatis</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={coachNote}
                    onChange={(e) => setCoachNote(e.target.value)}
                    placeholder={`Contoh: Atlet ${selectedStudent.studentName} sangat kuat pada posisi ${currentPosIndicatorsConfig.shortLabel} dengan kontrol sole dan rotasi passing cepat. Perlu peningkatan stamina transisi.`}
                    className="w-full px-4 py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-medium text-slate-800 leading-relaxed"
                  />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <p className="text-[11px] text-slate-400">
                      * Hasil assessment Futsal ini tersimpan permanen dan otomatis dapat diakses oleh Wali Murid di Portal Resmi.
                    </p>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto px-8 py-3.5 bg-[#354944] hover:bg-[#2B3D38] text-white font-black text-xs rounded-2xl border-b-2 border-[#C89D32] shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Menyimpan Assessment Futsal...</span>
                        </>
                      ) : (
                        <>
                          <Award className="w-4 h-4 text-[#C89D32]" />
                          <span>Simpan Assessment Futsal ({futsalTierConfig.shortLabel})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* MODAL FOKUS PENILAIAN KATEGORI */}
                <CategoryAssessmentModal
                  isOpen={isModalOpen}
                  onClose={() => setIsModalOpen(false)}
                  categoryList={futsalCategoryList}
                  activeCategoryKey={activeModalCategoryKey}
                  setActiveCategoryKey={setActiveModalCategoryKey}
                  scores={scores}
                  onScoreChange={handleScoreChange}
                  onAdjustScore={handleAdjustScore}
                  onSetCategoryPreset={handleSetCategoryPreset}
                />

              </form>
            )}
          </div>
        )}
      </div>

      {/* 5. RIWAYAT EVALUASI */}
      <HistorySection
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        students={students}
        onDeleteEvaluation={onDeleteEvaluation}
      />
    </div>
  );
}

// =====================================================================
// COMPONENT: ATHLETE DEVELOPMENT ASSESSMENT KHUSUS BADMINTON / BULUTANGKIS
// =====================================================================
function BadmintonAssessmentView({
  selectedClass,
  students,
  tenantId,
  activeAcademy,
  history,
  loadingHistory,
  filterStudentId,
  setFilterStudentId,
  onDeleteEvaluation
}) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().split('T')[0]);

  const selectedStudent = useMemo(() => {
    if (students.length === 0) return null;
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  // DETEKSI OTOMATIS TIER BADMINTON & LEVEL PBSI DARI USIA + OVERRIDE DROPDOWN
  const [overrideBadmintonTier, setOverrideBadmintonTier] = useState('AUTO');

  // Sinkronisasi otomatis tier badminton dengan kelompok umur kelas terpilih
  useEffect(() => {
    if (selectedClass?.tierCode && selectedClass.tierCode !== 'ALL_AGE') {
      const code = selectedClass.tierCode;
      if (code === 'LEVEL_1' || code === 'LEVEL_2' || code === 'U-8' || code === 'U-10' || code === 'U-12') {
        setOverrideBadmintonTier('1');
      } else if (code === 'LEVEL_3' || code === 'U-14') {
        setOverrideBadmintonTier('2');
      } else if (code === 'LEVEL_4' || code === 'LEVEL_5' || code === 'U-16') {
        setOverrideBadmintonTier('3');
      } else if (code === 'LEVEL_6' || code === 'U-18') {
        setOverrideBadmintonTier('4');
      } else if (['1', '2', '3', '4'].includes(String(code))) {
        setOverrideBadmintonTier(String(code));
      }
    } else if (selectedClass?.minAge || selectedClass?.maxAge) {
      const midAge = Math.round(((selectedClass.minAge || 6) + (selectedClass.maxAge || 12)) / 2);
      const tierNum = detectBadmintonTierFromAge(midAge);
      setOverrideBadmintonTier(String(tierNum));
    }
  }, [selectedClass?.id, selectedClass?.tierCode, selectedClass?.minAge, selectedClass?.maxAge]);

  const studentAge = useMemo(() => {
    if (!selectedStudent) return 0;
    if (selectedStudent.birthDate) {
      const calculated = calculateAge(selectedStudent.birthDate);
      if (calculated !== '-') {
        const num = parseInt(String(calculated).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    const rawAge = selectedStudent.age || selectedStudent.umur;
    if (rawAge) {
      const num = parseInt(String(rawAge).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) return num;
    }
    return 10;
  }, [selectedStudent]);

  const detectedBadmintonTier = useMemo(() => {
    return detectBadmintonTierFromAge(studentAge);
  }, [studentAge]);

  const activeBadmintonTier = useMemo(() => {
    if (overrideBadmintonTier && overrideBadmintonTier !== 'AUTO') {
      return parseInt(overrideBadmintonTier, 10);
    }
    return detectedBadmintonTier;
  }, [overrideBadmintonTier, detectedBadmintonTier]);

  const badmintonTierConfig = BADMINTON_TIER_CONFIGS[activeBadmintonTier] || BADMINTON_TIER_CONFIGS[1];
  const pbsiLevelInfo = useMemo(() => detectPbsiLevelFromAge(studentAge), [studentAge]);

  // Event Number Code (BASIC_SINGLE, MS, WS, MD, WD, XD)
  const [eventCode, setEventCode] = useState('MS');
  const [styleCode, setStyleCode] = useState('STY01');
  const [doublesSpecCode, setDoublesSpecCode] = useState('SPC01');

  // Available events based on activeBadmintonTier
  const availableEvents = useMemo(() => {
    return getAvailableBadmintonEventsForTier(activeBadmintonTier);
  }, [activeBadmintonTier]);

  // Feature unlock flags by activeBadmintonTier
  const isStyleUnlocked = isStyleUnlockedForTier(activeBadmintonTier);
  const isDoublesSpecUnlocked = isDoublesSpecUnlockedForTier(activeBadmintonTier);

  // Health & Recovery Profile (Non-Scoring)
  const [healthPhysicalReadiness, setHealthPhysicalReadiness] = useState('Fit 100%');
  const [healthInjuryNotes, setHealthInjuryNotes] = useState('');
  const [healthRecoveryQuality, setHealthRecoveryQuality] = useState('Bagus (8+ Jam)');
  const [showRecoveryNotes, setShowRecoveryNotes] = useState(false);
  const [showMobileRadar, setShowMobileRadar] = useState(true);

  // Active Category Tab & Modal States
  const [activeTab, setActiveTab] = useState('fisik');
  const [showAllAtOnce, setShowAllAtOnce] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalCategoryKey, setActiveModalCategoryKey] = useState('fisik');
  const [showAllInline, setShowAllInline] = useState(false);

  // Scores state: { [indicatorName]: number }
  const [scores, setScores] = useState({});
  const [coachNote, setCoachNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Memoized latest evaluation doc for current student in Badminton
  const latestEvalDoc = useMemo(() => {
    if (!selectedStudent?.id || !history || history.length === 0) return null;
    const studentHistory = history.filter((h) => h.studentId === selectedStudent.id);
    if (studentHistory.length === 0) return null;
    studentHistory.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    return studentHistory[0];
  }, [selectedStudent?.id, history]);

  // Validate eventCode when activeBadmintonTier changes
  useEffect(() => {
    if (activeBadmintonTier === 1) {
      if (eventCode !== 'BASIC_SINGLE') {
        setEventCode('BASIC_SINGLE');
      }
    } else if (activeBadmintonTier === 2) {
      if (!['MS', 'WS', 'MD', 'WD'].includes(eventCode)) {
        setEventCode('MS');
      }
    } else {
      if (eventCode === 'BASIC_SINGLE') {
        setEventCode(selectedStudent?.playerRole || 'MS');
      }
    }
  }, [activeBadmintonTier, selectedStudent]);

  const isDoubles = isDoublesEvent(eventCode);
  const eventConfig = getBadmintonEventConfig(eventCode);
  const styleConfig = getBadmintonStyleConfig(styleCode);
  const doublesSpecConfig = getBadmintonDoublesSpecConfig(doublesSpecCode);
  const eventSpecificConfig = getBadmintonEventSpecificConfigForTier(eventCode, activeBadmintonTier);

  // Automatically adjust activeTab if switching to Singles or Tier 1 while on 'komunikasi' tab
  useEffect(() => {
    if ((!isDoubles || activeBadmintonTier < 2) && activeTab === 'komunikasi') {
      setActiveTab('fisik');
    }
  }, [isDoubles, activeBadmintonTier, activeTab]);

  // LOGIKA TRANSISI & RESET STATE SETIAP KALI SISWA BERUBAH
  useEffect(() => {
    if (!selectedStudent?.id) {
      setScores({});
      return;
    }

    setCoachNote('');
    setErrorMsg(null);
    setSuccessMsg(null);

    if (latestEvalDoc) {
      setScores(latestEvalDoc.scores || {});

      const defaultEv = activeBadmintonTier === 1 ? 'BASIC_SINGLE' : 'MS';
      const evCode = latestEvalDoc.eventCode || latestEvalDoc.playerRole || selectedStudent.playerRole || selectedStudent.position || defaultEv;
      setEventCode(evCode);

      const stCode = latestEvalDoc.styleCode || selectedStudent.styleCode || 'STY01';
      setStyleCode(stCode);

      const dSpec = latestEvalDoc.doublesSpecCode || latestEvalDoc.specialization || selectedStudent.specialization || 'SPC01';
      setDoublesSpecCode(dSpec);

      setHealthPhysicalReadiness(latestEvalDoc.healthPhysicalReadiness || 'Fit 100%');
      setHealthInjuryNotes(latestEvalDoc.healthInjuryNotes || '');
      setHealthRecoveryQuality(latestEvalDoc.healthRecoveryQuality || 'Bagus (8+ Jam)');
    } else {
      // Siswa Baru: Default 0
      setScores({});

      const defaultEv = activeBadmintonTier === 1 ? 'BASIC_SINGLE' : 'MS';
      const evCode = selectedStudent.playerRole || selectedStudent.position || defaultEv;
      setEventCode(evCode);
      setStyleCode(selectedStudent.styleCode || 'STY01');
      setDoublesSpecCode(selectedStudent.specialization || 'SPC01');

      setHealthPhysicalReadiness('Fit 100%');
      setHealthInjuryNotes('');
      setHealthRecoveryQuality('Bagus (8+ Jam)');
    }
  }, [selectedStudent?.id, latestEvalDoc?.id]);

  // Category Indicators filtered by minTier <= activeBadmintonTier
  const filteredCategoryIndicators = useMemo(() => {
    return {
      fisik: getFilteredBadmintonIndicatorsForCategory('fisik', activeBadmintonTier, isDoubles),
      teknik: getFilteredBadmintonIndicatorsForCategory('teknik', activeBadmintonTier, isDoubles),
      taktik: getFilteredBadmintonIndicatorsForCategory('taktik', activeBadmintonTier, isDoubles),
      mental: getFilteredBadmintonIndicatorsForCategory('mental', activeBadmintonTier, isDoubles),
      komunikasi: getFilteredBadmintonIndicatorsForCategory('komunikasi', activeBadmintonTier, isDoubles),
      perkembangan: getFilteredBadmintonIndicatorsForCategory('perkembangan', activeBadmintonTier, isDoubles),
      khususNomor: eventSpecificConfig.indicators
    };
  }, [activeBadmintonTier, isDoubles, eventSpecificConfig]);

  // Dynamic Radar & Pillar Average Scores Calculation
  const axisScores = useMemo(() => {
    const calcCategoryAvg = (indicatorList) => {
      if (!indicatorList || indicatorList.length === 0) return 0;
      const total = indicatorList.reduce((sum, ind) => {
        const val = scores[ind] !== undefined ? scores[ind] : 0;
        return sum + val;
      }, 0);
      return Math.round(total / indicatorList.length);
    };

    const fisik = calcCategoryAvg(filteredCategoryIndicators.fisik);
    const teknik = calcCategoryAvg(filteredCategoryIndicators.teknik);
    const taktik = calcCategoryAvg(filteredCategoryIndicators.taktik);
    const mental = calcCategoryAvg(filteredCategoryIndicators.mental);
    const perkembangan = calcCategoryAvg(filteredCategoryIndicators.perkembangan);
    const khususNomor = calcCategoryAvg(filteredCategoryIndicators.khususNomor);

    if (isDoubles && activeBadmintonTier >= 2) {
      const komunikasi = calcCategoryAvg(filteredCategoryIndicators.komunikasi);
      const overall = Math.round((fisik + teknik + taktik + mental + perkembangan + komunikasi + khususNomor) / 7);
      return {
        fisik,
        teknik,
        taktik,
        mental,
        perkembangan,
        komunikasi,
        khususNomor,
        overall
      };
    } else {
      const overall = Math.round((fisik + teknik + taktik + mental + perkembangan + khususNomor) / 6);
      return {
        fisik,
        teknik,
        taktik,
        mental,
        perkembangan,
        komunikasi: undefined,
        khususNomor,
        overall
      };
    }
  }, [scores, filteredCategoryIndicators, isDoubles, activeBadmintonTier]);

  // Structured Category List for Interactive Cards & Focus Modal
  const badmintonCategoryList = useMemo(() => {
    const list = [
      { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: filteredCategoryIndicators.fisik.length, score: axisScores.fisik, indicators: filteredCategoryIndicators.fisik },
      { key: 'teknik', label: '2. Kemampuan Teknik', shortLabel: 'Teknik', count: filteredCategoryIndicators.teknik.length, score: axisScores.teknik, indicators: filteredCategoryIndicators.teknik },
      { key: 'taktik', label: '3. Pemahaman Taktik', shortLabel: 'Taktik', count: filteredCategoryIndicators.taktik.length, score: axisScores.taktik, indicators: filteredCategoryIndicators.taktik },
      { key: 'mental', label: '4. Mentalitas', shortLabel: 'Mental', count: filteredCategoryIndicators.mental.length, score: axisScores.mental, indicators: filteredCategoryIndicators.mental }
    ];

    if (isDoubles && activeBadmintonTier >= 2) {
      list.push({ key: 'komunikasi', label: '5. Komunikasi Lapangan', shortLabel: 'Komunikasi', count: filteredCategoryIndicators.komunikasi.length, score: axisScores.komunikasi || 0, indicators: filteredCategoryIndicators.komunikasi });
    }

    list.push(
      { key: 'perkembangan', label: `${isDoubles && activeBadmintonTier >= 2 ? '6' : '5'}. Perkembangan Atlet`, shortLabel: 'Perkembangan', count: filteredCategoryIndicators.perkembangan.length, score: axisScores.perkembangan, indicators: filteredCategoryIndicators.perkembangan },
      { key: 'khususNomor', label: `${isDoubles && activeBadmintonTier >= 2 ? '7' : '6'}. Khusus Nomor (${eventSpecificConfig.shortLabel || 'Nomor'})`, shortLabel: 'Khusus Nomor', count: filteredCategoryIndicators.khususNomor.length, score: axisScores.khususNomor, indicators: filteredCategoryIndicators.khususNomor, isSpecial: true }
    );

    return list;
  }, [filteredCategoryIndicators, axisScores, isDoubles, activeBadmintonTier, eventSpecificConfig]);

  const handleSetCategoryPreset = (catKey, presetScore) => {
    const catObj = badmintonCategoryList.find((c) => c.key === catKey);
    if (!catObj || !catObj.indicators) return;

    setScores((prev) => {
      const updated = { ...prev };
      catObj.indicators.forEach((ind) => {
        updated[ind] = presetScore;
      });
      return updated;
    });
  };

  // Recharts radar data for Badminton
  const radarData = useMemo(() => {
    const list = [
      { subject: 'Fisik', A: axisScores.fisik, fullMark: 100 },
      { subject: 'Teknik', A: axisScores.teknik, fullMark: 100 },
      { subject: 'Taktik', A: axisScores.taktik, fullMark: 100 },
      { subject: 'Mental', A: axisScores.mental, fullMark: 100 },
      { subject: 'Progres', A: axisScores.perkembangan, fullMark: 100 },
    ];
    if (isDoubles && activeBadmintonTier >= 2) {
      list.push({ subject: 'Komunikasi', A: axisScores.komunikasi || 0, fullMark: 100 });
    }
    list.push({ subject: 'Khusus', A: axisScores.khususNomor, fullMark: 100 });
    return list;
  }, [axisScores, isDoubles, activeBadmintonTier]);

  const handleAdjustScore = (indicatorName, delta) => {
    setScores((prev) => {
      const curr = prev[indicatorName] !== undefined ? prev[indicatorName] : 0;
      const nextVal = Math.min(100, Math.max(0, curr + delta));
      return { ...prev, [indicatorName]: nextVal };
    });
  };

  const handleScoreChange = (indicatorName, value) => {
    setScores((prev) => ({
      ...prev,
      [indicatorName]: Math.min(100, Math.max(0, Number(value) || 0))
    }));
  };

  const handleSetAllGlobalValue = (val) => {
    const activeIndicators = [];
    Object.values(filteredCategoryIndicators).forEach((arr) => {
      activeIndicators.push(...arr);
    });

    const nextState = { ...scores };
    activeIndicators.forEach((ind) => {
      nextState[ind] = val;
    });
    setScores(nextState);

    setSuccessMsg(`Seluruh indikator aktif Badminton Tier ${activeBadmintonTier} (${activeIndicators.length}) di-set ke ${val}.`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };


  const handleGenerateDraft = () => {
    if (!selectedStudent) return;

    const categoriesList = [
      { name: 'Kondisi Fisik', score: axisScores.fisik },
      { name: 'Teknik Pukulan & Footwork', score: axisScores.teknik },
      { name: 'Pemahaman Taktik Reli', score: axisScores.taktik },
      { name: 'Mentalitas Bertanding', score: axisScores.mental },
      { name: 'Perkembangan Atlet', score: axisScores.perkembangan },
      { name: `Khusus (${eventSpecificConfig.shortLabel})`, score: axisScores.khususNomor }
    ];

    if (isDoubles && activeBadmintonTier >= 2) {
      categoriesList.push({ name: 'Komunikasi & Rotasi Pasangan', score: axisScores.komunikasi || 0 });
    }

    const sorted = [...categoriesList].sort((a, b) => b.score - a.score);
    const topPillar = sorted[0];
    const bottomPillar = sorted[sorted.length - 1];
    const overall = axisScores.overall;

    let draft = '';

    if (activeBadmintonTier === 1) {
      // Tier 1: Focus on motor coordination, racket swing, footwork rhythm, fun-badminton
      let summaryText = 'menunjukkan antusiasme dan kegembiraan bermain bulu tangkis yang tinggi.';
      if (overall < 50) summaryText = 'berada dalam tahap pengenalan ayunan raket dasar dan koordinasi motorik mata-tangan.';
      else if (overall >= 75) summaryText = 'sangat baik dalam kelincahan langkah dasar (footwork rhythm) dan keberanian memukul kok.';

      draft = `[Rapor Development Badminton — ${badmintonTierConfig.shortLabel} (${pbsiLevelInfo.name})]\n` +
        `Atlet ${selectedStudent.studentName} berada pada jenjang ${pbsiLevelInfo.name} (${pbsiLevelInfo.ageRange}). Atlet ${summaryText}\n\n` +
        `• Keunggulan Utama: ${topPillar.name} (Skor: ${topPillar.score}/100)\n` +
        `• Area Perhatian Pembinaan: ${bottomPillar.name} (Skor: ${bottomPillar.score}/100)\n\n` +
        `Fokus Pembinaan: ${pbsiLevelInfo.focus}\n` +
        `Rata-Rata Performa Dasar: ${overall}/100.`;
    } else if (activeBadmintonTier === 2) {
      // Tier 2: Sirnas U-13 / Anak-Anak
      let summaryText = 'menunjukkan konsistensi teknik dasar dan kesiapan mengikuti Sirnas U-13 yang baik.';
      if (overall < 60) summaryText = 'membutuhkan pemantapan footwork dan servis konsisten sebelum turnamen resmi.';

      draft = `[Rapor Development Badminton — ${badmintonTierConfig.shortLabel} (${pbsiLevelInfo.name})]\n` +
        `Atlet ${selectedStudent.studentName} dievaluasi pada Nomor ${eventConfig.label}.\n` +
        `Atlet ${summaryText}\n\n` +
        `• Keunggulan Utama: ${topPillar.name} (Skor: ${topPillar.score}/100)\n` +
        `• Area Perbaikan Fokus: ${bottomPillar.name} (Skor: ${bottomPillar.score}/100)\n\n` +
        `Fokus Sirnas U-13: ${pbsiLevelInfo.focus}\n` +
        `Rata-Rata Performa: ${overall}/100.`;
    } else {
      // Tier 3 & Tier 4: Pemula, Remaja, Taruna & Dewasa
      let summaryText = 'menunjukkan kontrol permainan dan kesiapan bertanding tingkat tinggi.';
      if (overall < 60) summaryText = 'membutuhkan penguatan variasi pukulan dan daya tahan fisik intensif.';
      else if (overall < 80) summaryText = 'cukup solid dengan potensi transisi taktik menyerang-bertahan yang positif.';

      let specText = '';
      if (isDoubles) {
        specText = ` | Spesialisasi Ganda: ${doublesSpecConfig.name} (${doublesSpecConfig.code})`;
      }

      draft = `[Rapor Development Badminton — ${badmintonTierConfig.shortLabel} (${pbsiLevelInfo.name})]\n` +
        `Atlet ${selectedStudent.studentName} dievaluasi pada Nomor ${eventConfig.label}.\n` +
        `Gaya Bermain: ${styleConfig.name} (${styleConfig.code})${specText}.\n\n` +
        `Atlet ${summaryText}\n` +
        `• Keunggulan Utama: ${topPillar.name} (Skor: ${topPillar.score}/100)\n` +
        `• Area Perbaikan Fokus: ${bottomPillar.name} (Skor: ${bottomPillar.score}/100)\n\n` +
        `Fokus Pembinaan: ${pbsiLevelInfo.focus}\n` +
        `Rata-Rata Performa ${isDoubles ? '7-Axis (Ganda)' : '6-Axis (Tunggal)'}: ${overall}/100.`;
    }

    let healthSection = `\n\n[Profil Pendukung Kesehatan & Pemulihan (Non-Scoring)]\n` +
      `- Kesiapan Fisik: ${healthPhysicalReadiness}\n` +
      `- Catatan Cedera: ${healthInjuryNotes || 'Tidak Ada Keluhan'}\n` +
      `- Kualitas Pemulihan: ${healthRecoveryQuality}\n` +
      `*(Catatan pendukung kesehatan tidak mempengaruhi skor performa angka)*`;

    setCoachNote(draft + healthSection);
  };

  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      setErrorMsg('Silakan pilih atlet terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        tenantId,
        classId: selectedClass?.id || '',
        className: selectedClass?.className || '',
        sport: 'Badminton',
        studentId: selectedStudent.id,
        studentName: selectedStudent.studentName,
        date: evaluationDate,
        activeTier: activeBadmintonTier,
        pbsiLevel: pbsiLevelInfo.name,
        overallScore: axisScores.overall,
        eventCode: eventCode,
        playerRole: eventCode,
        styleCode: isStyleUnlocked ? styleCode : 'N/A',
        doublesSpecCode: (isDoubles && isDoublesSpecUnlocked) ? doublesSpecCode : 'N/A',
        specialization: (isDoubles && isDoublesSpecUnlocked) ? doublesSpecConfig.name : 'N/A',
        scores: scores,
        healthPhysicalReadiness,
        healthInjuryNotes,
        healthRecoveryQuality,
        pillarScores: {
          fisik: axisScores.fisik,
          teknik: axisScores.teknik,
          taktik: axisScores.taktik,
          mental: axisScores.mental,
          perkembangan: axisScores.perkembangan,
          komunikasi: (isDoubles && activeBadmintonTier >= 2) ? axisScores.komunikasi : undefined,
          khususPosisi: axisScores.khususNomor
        },
        coachNote: coachNote,
        evaluator: 'Pelatih Badminton'
      };

      const savedEval = await supabaseAcademyService.createEvaluation(payload);

      setSuccessMsg(`Rapor Badminton (${pbsiLevelInfo.name}) untuk ${selectedStudent.studentName} berhasil disimpan!`);
      if (onEvaluationSaved) onEvaluationSaved(savedEval);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error saving Badminton evaluation to Supabase:', err);
      setErrorMsg('Gagal menyimpan evaluasi. Periksa koneksi Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const gradeInfo = getScoreGrade(axisScores.overall);

  return (
    <div className="space-y-6 text-left">
      {/* 1. COMPACT HEADER BAR */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        {/* MOBILE COMPACT TITLE BAR (< 1024px) */}
        <div className="flex lg:hidden items-center justify-between pb-2.5 border-b border-slate-100">
          <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
            Evaluasi Atlet
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#354944]/10 text-[#354944] border border-[#354944]/20">
              Badminton
            </span>
            {latestEvalDoc ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Terisi ({formatDateIndonesian(latestEvalDoc.date)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold">
                <span>Belum Ada</span>
              </span>
            )}
          </div>
        </div>

        {/* DESKTOP TITLE BAR (>= 1024px) */}
        <div className="hidden lg:flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#354944] text-white flex items-center justify-center font-bold shrink-0 shadow-xs border border-[#C89D32]/40">
              <Target className="w-5 h-5 text-[#C89D32]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
                Athlete Development Assessment
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#354944]/10 text-[#354944] border border-[#354944]/20">
                Badminton
              </span>
            </div>
          </div>

          <div className="self-start sm:self-center">
            {loadingHistory ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Memuat riwayat...</span>
              </span>
            ) : latestEvalDoc ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Riwayat Terakhir Terpasang (Tanggal: {formatDateIndonesian(latestEvalDoc.date)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Belum ada riwayat (Mulai dari 0)</span>
              </span>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {students.length === 0 ? (
          <div className="py-8 border border-dashed border-slate-200 rounded-2xl text-center p-6 bg-slate-50/50">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Belum ada siswa terdaftar di kelas Badminton ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* INPUT FILTER AREA (2 BARIS KOMPAK DI MOBILE) */}
            <div className="bg-slate-50/90 p-3 sm:p-4 rounded-2xl border border-slate-200/90 space-y-2.5">
              {/* Baris 1: Pilih Atlet (1 Kolom Penuh) */}
              <div>
                <label className="block text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#354944]" />
                  <span>Pilih Atlet ({students.length})</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 shadow-2xs cursor-pointer appearance-none pr-8"
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.studentName} ({st.age || st.umur || calculateAge(st.birthDate)} Thn)
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Baris 2: Tanggal Evaluasi & Jenjang Evaluasi (2 Kolom Berdampingan) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#354944]" />
                    <span>Tanggal</span>
                  </label>
                  <input
                    type="date"
                    value={evaluationDate}
                    onChange={(e) => setEvaluationDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 shadow-2xs cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-[#354944]" />
                    <span>Jenjang</span>
                  </label>
                  <select
                    value={overrideBadmintonTier}
                    onChange={(e) => setOverrideBadmintonTier(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-[#354944] shadow-2xs cursor-pointer truncate"
                  >
                    <option value="AUTO">Otomatis: Tier {detectedBadmintonTier} ({pbsiLevelInfo.name})</option>
                    <option value="1">Tier 1 — Usia Dini (&le;10 Thn)</option>
                    <option value="2">Tier 2 — Anak-Anak (11–13 Thn)</option>
                    <option value="3">Tier 3 — Pemula/Remaja (14–17 Thn)</option>
                    <option value="4">Tier 4 — Taruna/Pro (&ge;18 Thn)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. PANEL ATAS: SCOUTING RADAR & KONFIGURASI NOMOR */}
            {selectedStudent && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* RADAR CHART */}
                  <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-md flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-[#C89D32]" />
                        <span className="text-xs font-black uppercase tracking-wider text-white">
                          Scouting Radar
                        </span>
                      </div>

                      {/* Header kanan: Skor Realtime & Toggle Mobile */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#C89D32] bg-slate-800 px-2 py-0.5 rounded-full border border-white/10">
                          {axisScores.overall}/100
                        </span>
                        <span className={`lg:hidden px-2 py-0.5 text-[10px] font-bold rounded-full ${gradeInfo.badge}`}>
                          {gradeInfo.grade.split(' ')[0]}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowMobileRadar(!showMobileRadar)}
                          className="lg:hidden text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-lg border border-white/10 transition-colors cursor-pointer"
                        >
                          {showMobileRadar ? 'Lipat ▴' : 'Buka ▾'}
                        </button>
                      </div>
                    </div>

                    {showMobileRadar && (
                      <div className="h-56 sm:h-64 w-full flex items-center justify-center my-auto">
                        <ResponsiveContainer width="100%" height={230}>
                          <RadarChart cx="50%" cy="50%" outerRadius="62%" data={radarData} margin={{ top: 8, right: 15, bottom: 8, left: 15 }}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 700 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={false} />
                            <Radar
                              name="Performa"
                              dataKey="A"
                              stroke="#C89D32"
                              fill="#354944"
                              fillOpacity={0.65}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-300 bg-slate-800/80 p-2.5 rounded-xl flex items-center justify-between border border-white/5">
                      <span className="text-slate-400">Rata-Rata ({radarData.length} Kategori):</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[#C89D32] font-black text-xs">{axisScores.overall} / 100</strong>
                        <span className="text-[10px] font-bold text-slate-400">({gradeInfo.grade})</span>
                      </div>
                    </div>
                  </div>

                  {/* KONFIGURASI NOMOR & PERAN + HEALTH PANEL */}
                  <div className="lg:col-span-7 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3.5">
                    <div className="space-y-3.5">
                      {/* Header Kartu */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-[#354944]" />
                          <span>Konfigurasi Nomor &amp; Peran</span>
                        </span>
                        <span className="text-[10px] text-[#354944] bg-[#354944]/10 px-2.5 py-1 rounded-full font-bold border border-[#354944]/20">
                          {eventConfig.shortLabel}
                        </span>
                      </div>

                      {/* Banner Skor Realtime & Predikat Evaluasi */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                              Skor Realtime
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-xl font-black text-slate-900 tracking-tight">
                                {axisScores.overall}
                              </span>
                              <span className="text-xs font-bold text-slate-400">/ 100</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 text-xs font-black rounded-lg border shadow-2xs shrink-0 ${gradeInfo.badge}`}>
                            {gradeInfo.grade}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#354944] rounded-full transition-all duration-300" 
                            style={{ width: `${Math.min(100, Math.max(0, axisScores.overall))}%` }} 
                          />
                        </div>
                      </div>

                      {/* Dropdown Nomor & Peran */}
                      <div className="space-y-2.5">
                        {/* NOMOR PERTANDINGAN */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                            1. Nomor Pertandingan
                          </label>
                          <select
                            value={eventCode}
                            onChange={(e) => setEventCode(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 cursor-pointer"
                          >
                            {availableEvents.map((ev) => (
                              <option key={ev.code} value={ev.code}>
                                {ev.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* STY DROPDOWN - RENDER ONLY IF UNLOCKED */}
                        {isStyleUnlocked && (
                          <div>
                            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                              2. Profil Gaya Bermain (STY)
                            </label>
                            <select
                              value={styleCode}
                              onChange={(e) => setStyleCode(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 cursor-pointer"
                            >
                              {BADMINTON_PLAYING_STYLES.map((st) => (
                                <option key={st.code} value={st.code}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* SPESIALISASI GANDA - RENDER ONLY IF DOUBLES & UNLOCKED */}
                        {isDoubles && isDoublesSpecUnlocked && (
                          <div>
                            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                              3. Spesialisasi Nomor Ganda
                            </label>
                            <select
                              value={doublesSpecCode}
                              onChange={(e) => setDoublesSpecCode(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 cursor-pointer"
                            >
                              {BADMINTON_DOUBLES_SPECS.map((sp) => (
                                <option key={sp.code} value={sp.code}>
                                  {sp.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* HEALTH & RECOVERY PANEL (COLLAPSIBLE ON MOBILE) */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                        <div
                          onClick={() => setShowRecoveryNotes(!showRecoveryNotes)}
                          className="flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Activity className="w-3.5 h-3.5 text-[#354944] shrink-0" />
                            <h4 className="text-xs font-extrabold text-slate-800 truncate">
                              Catatan Fisik &amp; Pemulihan
                            </h4>
                            <span className="text-[10px] text-slate-500 font-semibold truncate hidden sm:inline">
                              ({healthPhysicalReadiness} • {healthRecoveryQuality})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-bold text-[#354944] sm:hidden">
                              {healthPhysicalReadiness.split(' ')[0]}
                            </span>
                            <button
                              type="button"
                              className="text-slate-400 p-0.5 rounded cursor-pointer"
                              aria-label="Toggle recovery notes"
                            >
                              {showRecoveryNotes ? (
                                <ChevronUp className="w-4 h-4 text-slate-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-600" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Content */}
                        <div className={`${showRecoveryNotes ? 'block' : 'hidden lg:block'} pt-2 border-t border-slate-200/70 space-y-2`}>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Kesiapan Fisik:</label>
                              <select
                                value={healthPhysicalReadiness}
                                onChange={(e) => setHealthPhysicalReadiness(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-xl font-normal text-slate-800 focus:outline-none"
                              >
                                <option value="Fit 100%">Fit 100% (Prima)</option>
                                <option value="Sangat Fit">Sangat Fit</option>
                                <option value="Kelelahan Ringan">Kelelahan Ringan</option>
                                <option value="Kelelahan Sedang">Kelelahan Sedang</option>
                                <option value="Perlu Istirahat">Perlu Istirahat</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Kualitas Tidur:</label>
                              <select
                                value={healthRecoveryQuality}
                                onChange={(e) => setHealthRecoveryQuality(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-xl font-normal text-slate-800 focus:outline-none"
                              >
                                <option value="Bagus (8+ Jam)">Bagus (8+ Jam)</option>
                                <option value="Cukup (6-7 Jam)">Cukup (6-7 Jam)</option>
                                <option value="Kurang (<6 Jam)">Kurang (&lt;6 Jam)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">Riwayat Cedera:</label>
                            <input
                              type="text"
                              value={healthInjuryNotes}
                              onChange={(e) => setHealthInjuryNotes(e.target.value)}
                              placeholder="Misal: Bebas cedera / nyeri lutut..."
                              className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-xl font-normal text-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BAR KONTROL PRESET SKOR CEPAT (1 BARIS 4 KOLOM DI MOBILE) */}
                    <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-[#354944]" />
                        <span>Preset Nilai Cepat:</span>
                      </span>

                      <div className="grid grid-cols-4 gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(0)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                          title="Reset semua indikator ke 0"
                        >
                          <RotateCcw className="w-3 h-3 shrink-0" />
                          <span>Reset</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(50)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                        >
                          Standard
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(75)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200 transition-all cursor-pointer shadow-2xs"
                        >
                          Good
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllGlobalValue(90)}
                          className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                        >
                          Elite
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* PANEL RINGKASAN SKOR KATEGORI (GRID 2 KOLOM DI MOBILE) */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-[#354944]" />
                        <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                          Ringkasan Skor Kategori
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-slate-600 sm:hidden">
                        Rata-Rata: <strong className="text-slate-900 font-black">{axisScores.overall}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 mr-1 hidden sm:inline">
                        Rata-Rata: <strong className="text-slate-900 font-black">{axisScores.overall} / 100</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveModalCategoryKey(badmintonCategoryList[0]?.key);
                          setIsModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none px-3 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#C89D32]" />
                        <span>✎ Edit Penilaian</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAllInline(!showAllInline)}
                        className={`flex-1 sm:flex-none px-3 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          showAllInline
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>{showAllInline ? 'Tutup' : 'Buka Semua'}</span>
                      </button>
                    </div>
                  </div>

                  {/* GRID 2 KOLOM DI MOBILE (< 1024px), 3 KOLOM DI DESKTOP */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
                    {badmintonCategoryList.map((cat, idx) => {
                      const isFilled = (cat.score || 0) > 0;
                      return (
                        <div
                          key={cat.key}
                          onClick={() => {
                            setActiveModalCategoryKey(cat.key);
                            setIsModalOpen(true);
                          }}
                          className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90 hover:border-[#354944] hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <span className="font-bold text-xs text-slate-900 block leading-tight line-clamp-1" title={cat.label}>
                              {idx + 1}. {cat.label}
                            </span>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 font-medium">
                                {cat.count} Indikator
                              </span>
                              {isFilled ? (
                                <span className="text-emerald-700 font-extrabold">✓ Terisi</span>
                              ) : (
                                <span className="text-slate-400 font-medium">Kosong</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Skor</span>
                              <span className="text-sm font-extrabold text-slate-900 font-mono">
                                {cat.score || 0}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#354944] rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, cat.score || 0))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SUB-TAB KATEGORI & SLIDER INDIKATOR (OPSIONAL HANYA SAAT showAllInline = true) */}
      {selectedStudent && showAllInline && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5 animate-fadeIn">
          {/* Sub-Tab Navigation Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Tab 1: Fisik */}
              <button
                type="button"
                onClick={() => setActiveTab('fisik')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'fisik' && !showAllAtOnce
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>Fisik</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                  activeTab === 'fisik' && !showAllAtOnce ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                }`}>
                  {filteredCategoryIndicators.fisik.length}
                </span>
              </button>

              {/* Tab 2: Teknik */}
              <button
                type="button"
                onClick={() => setActiveTab('teknik')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'teknik' && !showAllAtOnce
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>Teknik</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                  activeTab === 'teknik' && !showAllAtOnce ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  {filteredCategoryIndicators.teknik.length}
                </span>
              </button>

              {/* Tab 3: Taktik */}
              <button
                type="button"
                onClick={() => setActiveTab('taktik')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'taktik' && !showAllAtOnce
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>Taktik</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                  activeTab === 'taktik' && !showAllAtOnce ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                }`}>
                  {filteredCategoryIndicators.taktik.length}
                </span>
              </button>

              {/* Tab 4: Mental */}
              <button
                type="button"
                onClick={() => setActiveTab('mental')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'mental' && !showAllAtOnce
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>Mental</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                  activeTab === 'mental' && !showAllAtOnce ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {filteredCategoryIndicators.mental.length}
                </span>
              </button>

              {/* Tab 5: Komunikasi (HIDE COMPLETELY IF NOT DOUBLES OR TIER < 2) */}
              {isDoubles && activeBadmintonTier >= 2 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('komunikasi')}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'komunikasi' && !showAllAtOnce
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>Komunikasi</span>
                  <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                    activeTab === 'komunikasi' && !showAllAtOnce ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {filteredCategoryIndicators.komunikasi.length}
                  </span>
                </button>
              )}

              {/* Tab 6: Perkembangan */}
              <button
                type="button"
                onClick={() => setActiveTab('perkembangan')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'perkembangan' && !showAllAtOnce
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>Perkembangan</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                  activeTab === 'perkembangan' && !showAllAtOnce ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-800'
                }`}>
                  {filteredCategoryIndicators.perkembangan.length}
                </span>
              </button>

              {/* Tab 7: Khusus Nomor */}
              <button
                type="button"
                onClick={() => setActiveTab('khususNomor')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'khususNomor' && !showAllAtOnce
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                <span>Khusus Nomor</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                  activeTab === 'khususNomor' && !showAllAtOnce ? 'bg-white/20 text-white' : 'bg-teal-200 text-teal-900'
                }`}>
                  {filteredCategoryIndicators.khususNomor.length}
                </span>
              </button>
            </div>

            {/* Toggle Show All At Once */}
            <button
              type="button"
              onClick={() => setShowAllAtOnce(!showAllAtOnce)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showAllAtOnce
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{showAllAtOnce ? 'Tampilan Per-Tab' : 'Tampilkan Semua Sekaligus'}</span>
            </button>
          </div>

          {/* Render Active Category Sliders Grid */}
          <div className="space-y-6">
            {(() => {
              const renderGridForCategory = (catKey, catTitle, indicatorList, badgeColor = 'bg-slate-100 text-slate-800') => {
                if (!indicatorList || indicatorList.length === 0) return null;

                return (
                  <div key={catKey} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 text-xs font-black uppercase rounded-lg ${badgeColor}`}>
                          {catTitle}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">
                          ({indicatorList.length} Indikator Aktif)
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white border border-slate-200 text-slate-800">
                        Rata-rata: {axisScores[catKey] !== undefined ? axisScores[catKey] : 0} / 100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {indicatorList.map((indicatorName) => {
                        const val = scores[indicatorName] !== undefined ? scores[indicatorName] : 0;
                        const scoreGrade = getScoreGrade(val);

                        return (
                          <div
                            key={indicatorName}
                            className="p-3 bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-teal-300 rounded-2xl transition-all space-y-2 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 leading-snug">
                                {indicatorName}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg border ${scoreGrade.badge}`}>
                                {val} / 100
                              </span>
                            </div>

                            {/* Slider + Quick Adjustment Buttons */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleAdjustScore(indicatorName, -5)}
                                title="Kurangi 5"
                                className="p-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={val}
                                onChange={(e) => handleScoreChange(indicatorName, e.target.value)}
                                className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                              />

                              <button
                                type="button"
                                onClick={() => handleAdjustScore(indicatorName, 5)}
                                title="Tambah 5"
                                className="p-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold hover:text-emerald-600 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              if (showAllAtOnce) {
                return (
                  <div className="space-y-8">
                    {renderGridForCategory('fisik', '1. Fisik / Physical', filteredCategoryIndicators.fisik, 'bg-rose-100 text-rose-900 border border-rose-300')}
                    {renderGridForCategory('teknik', '2. Teknik / Technical', filteredCategoryIndicators.teknik, 'bg-blue-100 text-blue-900 border border-blue-300')}
                    {renderGridForCategory('taktik', '3. Taktik / Tactical', filteredCategoryIndicators.taktik, 'bg-purple-100 text-purple-900 border border-purple-300')}
                    {renderGridForCategory('mental', '4. Mental / Psychology', filteredCategoryIndicators.mental, 'bg-emerald-100 text-emerald-900 border border-emerald-300')}
                    {isDoubles && activeBadmintonTier >= 2 && renderGridForCategory('komunikasi', '5. Komunikasi (Khusus Ganda)', filteredCategoryIndicators.komunikasi, 'bg-amber-100 text-amber-900 border border-amber-300')}
                    {renderGridForCategory('perkembangan', '6. Perkembangan / Development', filteredCategoryIndicators.perkembangan, 'bg-cyan-100 text-cyan-900 border border-cyan-300')}
                    {renderGridForCategory('khususNomor', `7. Khusus Nomor (${eventSpecificConfig.shortLabel})`, filteredCategoryIndicators.khususNomor, 'bg-teal-100 text-teal-900 border border-teal-300')}
                  </div>
                );
              }

              // Per Tab view
              switch (activeTab) {
                case 'fisik':
                  return renderGridForCategory('fisik', '1. Fisik / Physical', filteredCategoryIndicators.fisik, 'bg-rose-100 text-rose-900 border border-rose-300');
                case 'teknik':
                  return renderGridForCategory('teknik', '2. Teknik / Technical', filteredCategoryIndicators.teknik, 'bg-blue-100 text-blue-900 border border-blue-300');
                case 'taktik':
                  return renderGridForCategory('taktik', '3. Taktik / Tactical', filteredCategoryIndicators.taktik, 'bg-purple-100 text-purple-900 border border-purple-300');
                case 'mental':
                  return renderGridForCategory('mental', '4. Mental / Psychology', filteredCategoryIndicators.mental, 'bg-emerald-100 text-emerald-900 border border-emerald-300');
                case 'komunikasi':
                  return isDoubles && activeBadmintonTier >= 2 ? renderGridForCategory('komunikasi', '5. Komunikasi (Khusus Ganda)', filteredCategoryIndicators.komunikasi, 'bg-amber-100 text-amber-900 border border-amber-300') : null;
                case 'perkembangan':
                  return renderGridForCategory('perkembangan', '6. Perkembangan / Development', filteredCategoryIndicators.perkembangan, 'bg-cyan-100 text-cyan-900 border border-cyan-300');
                case 'khususNomor':
                  return renderGridForCategory('khususNomor', `7. Khusus Nomor (${eventSpecificConfig.shortLabel})`, filteredCategoryIndicators.khususNomor, 'bg-teal-100 text-teal-900 border border-teal-300');
                default:
                  return renderGridForCategory('fisik', '1. Fisik / Physical', filteredCategoryIndicators.fisik, 'bg-rose-100 text-rose-900 border border-rose-300');
              }
            })()}
          </div>
        </div>
      )}

      {/* 4. CATATAN EVALUASI & TOMBOL SIMPAN */}
      {selectedStudent && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4.5 h-4.5 text-[#354944]" />
              <h3 className="font-extrabold text-sm text-slate-900">
                Catatan Pelatih ({pbsiLevelInfo.name})
              </h3>
            </div>

            <button
              type="button"
              onClick={handleGenerateDraft}
              className="px-3 py-1.5 text-xs font-extrabold bg-[#354944]/10 hover:bg-[#354944]/20 text-[#354944] border border-[#354944]/30 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C89D32]" />
              <span>Buat Draf Analisis Otomatis</span>
            </button>
          </div>

          <textarea
            value={coachNote}
            onChange={(e) => setCoachNote(e.target.value)}
            rows={5}
            placeholder="Tuliskan umpan balik pelatih, keunggulan pukulan, area perbaikan footwork/taktik, dan rekomendasi program latihan..."
            className="w-full p-4 text-xs font-medium bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#354944] leading-relaxed text-slate-800 placeholder:text-slate-400"
          />

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveEvaluation}
              disabled={isSaving}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#354944] hover:bg-[#2B3D38] active:bg-[#1E2E2A] text-white border-b-2 border-[#C89D32] font-black text-sm rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#C89D32]" />
                  <span>Menyimpan Rapor Badminton...</span>
                </>
              ) : (
                <>
                  <Award className="w-4.5 h-4.5 text-[#C89D32]" />
                  <span>Simpan Assessment Badminton ({badmintonTierConfig.shortLabel})</span>
                </>
              )}
            </button>
          </div>

          {/* MODAL FOKUS PENILAIAN KATEGORI */}
          <CategoryAssessmentModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            categoryList={badmintonCategoryList}
            activeCategoryKey={activeModalCategoryKey}
            setActiveCategoryKey={setActiveModalCategoryKey}
            scores={scores}
            onScoreChange={handleScoreChange}
            onAdjustScore={handleAdjustScore}
            onSetCategoryPreset={handleSetCategoryPreset}
          />
        </div>
      )}

      {/* 5. RIWAYAT EVALUASI BADMINTON */}
      <HistorySection
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        students={students}
        onDeleteEvaluation={onDeleteEvaluation}
      />
    </div>
  );
}

// =====================================================================
// COMPONENT 2: ATHLETE DEVELOPMENT ASSESSMENT (4-TIER LTAD CURRICULUM SEPAKBOLA & MINISOCCER)
// =====================================================================
function FootballAssessmentView({
  selectedClass,
  students,
  tenantId,
  activeAcademy,
  history,
  loadingHistory,
  filterStudentId,
  setFilterStudentId,
  onDeleteEvaluation,
  onEvaluationSaved
}) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().split('T')[0]);

  const selectedStudent = useMemo(() => {
    if (students.length === 0) return null;
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  // DETEKSI OTOMATIS TIER DARI USIA + MANUAL OVERRIDE DROPDOWN
  const [overrideTier, setOverrideTier] = useState('AUTO');

  // Sinkronisasi otomatis tier sepakbola dengan kelompok umur kelas terpilih
  useEffect(() => {
    if (selectedClass?.tierCode && selectedClass.tierCode !== 'ALL_AGE') {
      const code = String(selectedClass.tierCode).toUpperCase().replace(/\s+/g, '');
      if (['FILANESIA_F1', 'F1', 'U-8', 'U8', 'U10', 'U-10', '1'].includes(code)) setOverrideTier('FILANESIA_F1');
      else if (['FILANESIA_F2', 'F2', 'U12', 'U-12', '2'].includes(code)) setOverrideTier('FILANESIA_F2');
      else if (['FILANESIA_F3', 'F3', 'U14', 'U-14', 'U16', 'U-16', '3'].includes(code)) setOverrideTier('FILANESIA_F3');
      else if (['FILANESIA_F4', 'F4', 'U18', 'U-18', '4'].includes(code)) setOverrideTier('FILANESIA_F4');
    } else if (selectedClass?.className || selectedClass?.name) {
      const className = String(selectedClass.className || selectedClass.name).toUpperCase();
      if (className.includes('FASE 1') || className.includes('JOY') || className.includes('KEGEMBIRAAN') || className.includes('U-8') || className.includes('U8')) setOverrideTier('FILANESIA_F1');
      else if (className.includes('FASE 2') || className.includes('SKILL') || className.includes('U-10') || className.includes('U10') || className.includes('U-12') || className.includes('U12')) setOverrideTier('FILANESIA_F2');
      else if (className.includes('FASE 3') || className.includes('TAKTIK') || className.includes('TACTICAL') || className.includes('U-14') || className.includes('U14') || className.includes('U-16') || className.includes('U16')) setOverrideTier('FILANESIA_F3');
      else if (className.includes('FASE 4') || className.includes('PERFORMANCE') || className.includes('PENAMPILAN') || className.includes('U-18') || className.includes('U18') || className.includes('SENIOR')) setOverrideTier('FILANESIA_F4');
      else if (selectedClass?.minAge || selectedClass?.maxAge) {
        const midAge = Math.round(((selectedClass.minAge || 6) + (selectedClass.maxAge || 12)) / 2);
        if (midAge <= 9) setOverrideTier('FILANESIA_F1');
        else if (midAge <= 12) setOverrideTier('FILANESIA_F2');
        else if (midAge <= 16) setOverrideTier('FILANESIA_F3');
        else setOverrideTier('FILANESIA_F4');
      }
    } else if (selectedClass?.minAge || selectedClass?.maxAge) {
      const midAge = Math.round(((selectedClass.minAge || 6) + (selectedClass.maxAge || 12)) / 2);
      if (midAge <= 9) setOverrideTier('FILANESIA_F1');
      else if (midAge <= 12) setOverrideTier('FILANESIA_F2');
      else if (midAge <= 16) setOverrideTier('FILANESIA_F3');
      else setOverrideTier('FILANESIA_F4');
    }
  }, [selectedClass?.id, selectedClass?.tierCode, selectedClass?.minAge, selectedClass?.maxAge, selectedClass?.className, selectedClass?.name]);

  const studentAge = useMemo(() => {
    if (!selectedStudent) return 0;
    if (selectedStudent.birthDate) {
      const calculated = calculateAge(selectedStudent.birthDate);
      if (calculated !== '-') {
        const num = parseInt(String(calculated).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    const rawAge = selectedStudent.age || selectedStudent.umur;
    if (rawAge) {
      const num = parseInt(String(rawAge).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) return num;
    }
    return 10;
  }, [selectedStudent]);

  const detectedTier = useMemo(() => {
    return detectTierFromAge(studentAge);
  }, [studentAge]);

  const detectedTierCode = useMemo(() => {
    if (studentAge <= 9) return 'Fase 1 (Joy Phase)';
    if (studentAge <= 12) return 'Fase 2 (Skill Phase)';
    if (studentAge <= 16) return 'Fase 3 (Tactical Phase)';
    return 'Fase 4 (Performance Phase)';
  }, [studentAge]);

  const activeTier = useMemo(() => {
    if (overrideTier && overrideTier !== 'AUTO') {
      if (['FILANESIA_F1', 'F1', 'U8', 'U-8', 'U10', 'U-10', '1'].includes(String(overrideTier))) return 1;
      if (['FILANESIA_F2', 'F2', 'U12', 'U-12', '2'].includes(String(overrideTier))) return 2;
      if (['FILANESIA_F3', 'F3', 'U14', 'U-14', 'U16', 'U-16', '3'].includes(String(overrideTier))) return 3;
      if (['FILANESIA_F4', 'F4', 'U18', 'U-18', '4'].includes(String(overrideTier))) return 4;
      const parsed = parseInt(overrideTier, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) return parsed;
    }
    return detectedTier;
  }, [overrideTier, detectedTier]);

  const tierConfig = useMemo(() => {
    const base = TIER_CONFIGS[activeTier] || TIER_CONFIGS[1];
    if (['FILANESIA_F1', 'F1', 'U8', 'U-8', 'U10'].includes(overrideTier)) {
      return { ...base, label: 'U-8 & U-10 (Usia 6–9 Thn) — Fase Kegembiraan / Joy Phase', shortLabel: 'Fase 1 — Joy Phase' };
    }
    if (['FILANESIA_F2', 'F2', 'U12', 'U-12'].includes(overrideTier)) {
      return { ...base, label: 'U-10 & U-12 (Usia 10–12 Thn) — Fase Pengembangan Skill / Skill Phase', shortLabel: 'Fase 2 — Skill Phase' };
    }
    if (['FILANESIA_F3', 'F3', 'U14', 'U-14', 'U16', 'U-16'].includes(overrideTier)) {
      return { ...base, label: 'U-14 & U-16 (Usia 13–16 Thn) — Fase Taktik / Tactical Phase', shortLabel: 'Fase 3 — Tactical Phase' };
    }
    if (['FILANESIA_F4', 'F4', 'U18', 'U-18'].includes(overrideTier)) {
      return { ...base, label: 'U-18 / Senior (Usia 17+ Thn) — Fase Penampilan / Performance Phase', shortLabel: 'Fase 4 — Performance Phase' };
    }
    return base;
  }, [activeTier, overrideTier]);

  // Position, Secondary Position, Specialization, StyleCode
  const [selectedPosition, setSelectedPosition] = useState('ST');
  const [secondaryPosition, setSecondaryPosition] = useState('NONE');
  const [selectedSpecialization, setSelectedSpecialization] = useState('Poacher');
  const [selectedStyleCode, setSelectedStyleCode] = useState('STY07');

  // Active Category Tab & Modal States
  const [activeTab, setActiveTab] = useState('fisik');
  const [showAllAtOnce, setShowAllAtOnce] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalCategoryKey, setActiveModalCategoryKey] = useState('fisik');
  const [showAllInline, setShowAllInline] = useState(false);

  // Scores state: { [indicatorName]: number }
  const [scores, setScores] = useState({});
  const [coachNote, setCoachNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Memoized latest evaluation doc for current student in Football
  const latestEvalDoc = useMemo(() => {
    if (!selectedStudent?.id || !history || history.length === 0) return null;
    const studentHistory = history.filter((h) => h.studentId === selectedStudent.id);
    if (studentHistory.length === 0) return null;
    studentHistory.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    return studentHistory[0];
  }, [selectedStudent?.id, history]);

  const [showMobileRadar, setShowMobileRadar] = useState(true);

  const sportName = selectedClass?.sport || activeAcademy?.sport || 'SepakBola / Minisoccer';

  // Dynamic sport name (SepakBola vs Minisoccer)
  const detectedSport = useMemo(() => {
    const raw = (selectedClass?.sport || activeAcademy?.sport || activeAcademy?.category || selectedClass?.category || activeAcademy?.name || '').toLowerCase();
    if (raw.includes('mini') || raw.includes('soccer')) {
      return 'Minisoccer';
    }
    return 'SepakBola';
  }, [selectedClass, activeAcademy]);

  // Available positions based on activeTier
  const availablePositions = useMemo(() => {
    return getAvailablePositionsForTier(activeTier);
  }, [activeTier]);

  // Position-Specific Indicators Config based on activeTier
  const currentPosIndicatorsConfig = useMemo(() => {
    return getPositionIndicatorsForTier(selectedPosition, activeTier);
  }, [selectedPosition, activeTier]);

  // Ensure selectedPosition is valid for activeTier
  useEffect(() => {
    if (activeTier === 1) {
      if (!['OUTFIELD_SSB', 'GK_SSB'].includes(selectedPosition)) {
        setSelectedPosition('OUTFIELD_SSB');
      }
    } else if (activeTier === 2) {
      if (!['GK', 'CB', 'CM', 'ST'].includes(selectedPosition)) {
        setSelectedPosition('CM');
      }
    } else {
      if (['OUTFIELD_SSB', 'GK_SSB'].includes(selectedPosition)) {
        setSelectedPosition(selectedStudent?.playerRole || selectedStudent?.position || 'ST');
      }
    }
  }, [activeTier, selectedStudent]);

  // LOGIKA TRANSISI & RESET STATE SETIAP KALI SISWA / KELAS BERUBAH
  useEffect(() => {
    if (!selectedStudent?.id) {
      setScores({});
      return;
    }

    setCoachNote('');
    setErrorMsg(null);
    setSuccessMsg(null);

    if (latestEvalDoc) {
      setScores(latestEvalDoc.scores || {});

      // Restore position/secondaryPosition/spec/style
      const posCode = latestEvalDoc.playerRole || selectedStudent.playerRole || selectedStudent.position || (activeTier === 1 ? 'OUTFIELD_SSB' : activeTier === 2 ? 'CM' : 'ST');
      setSelectedPosition(posCode);

      const secPosCode = latestEvalDoc.secondaryPosition || selectedStudent.secondaryPosition || 'NONE';
      setSecondaryPosition(secPosCode);

      const posConfig = getPositionConfig(posCode);
      const specVal = latestEvalDoc.specialization || selectedStudent.specialization || (posConfig.specializations ? posConfig.specializations[0] : 'Poacher');
      setSelectedSpecialization(specVal);

      const styleVal = latestEvalDoc.styleCode || selectedStudent.styleCode || 'STY07';
      setSelectedStyleCode(styleVal);
    } else {
      // Siswa Baru: Inisialisasi dari 0
      setScores({});

      const posCode = selectedStudent.playerRole || selectedStudent.position || (activeTier === 1 ? 'OUTFIELD_SSB' : activeTier === 2 ? 'CM' : 'ST');
      setSelectedPosition(posCode);

      const secPosCode = selectedStudent.secondaryPosition || 'NONE';
      setSecondaryPosition(secPosCode);

      const posConfig = getPositionConfig(posCode);
      setSelectedSpecialization(selectedStudent.specialization || (posConfig.specializations ? posConfig.specializations[0] : 'Poacher'));
      setSelectedStyleCode(selectedStudent.styleCode || 'STY07');
    }
  }, [selectedStudent?.id, latestEvalDoc?.id]);

  const handlePositionChange = (newCode) => {
    setSelectedPosition(newCode);
    if (activeTier >= 3) {
      const cfg = getPositionConfig(newCode);
      if (cfg.specializations && cfg.specializations.length > 0) {
        setSelectedSpecialization(cfg.specializations[0]);
      }
    }
  };

  // Filtered Indicator Names for each of the 6 Core Categories based on minTier <= activeTier
  const filteredCategoryIndicators = useMemo(() => {
    return {
      fisik: getFilteredIndicatorsForCategory('fisik', activeTier),
      teknik: getFilteredIndicatorsForCategory('teknik', activeTier),
      taktik: getFilteredIndicatorsForCategory('taktik', activeTier),
      mental: getFilteredIndicatorsForCategory('mental', activeTier),
      komunikasi: getFilteredIndicatorsForCategory('komunikasi', activeTier),
      perkembangan: getFilteredIndicatorsForCategory('perkembangan', activeTier)
    };
  }, [activeTier]);

  // 7-Axis Calculated Average Scores (Only counting active indicators in activeTier)
  const axisScores = useMemo(() => {
    const calcCategoryAvg = (indicatorList) => {
      if (!indicatorList || indicatorList.length === 0) return 0;
      const total = indicatorList.reduce((sum, ind) => {
        const val = scores[ind] !== undefined ? scores[ind] : 0;
        return sum + val;
      }, 0);
      return Math.round(total / indicatorList.length);
    };

    const fisik = calcCategoryAvg(filteredCategoryIndicators.fisik);
    const teknik = calcCategoryAvg(filteredCategoryIndicators.teknik);
    const taktik = calcCategoryAvg(filteredCategoryIndicators.taktik);
    const mental = calcCategoryAvg(filteredCategoryIndicators.mental);
    const komunikasi = calcCategoryAvg(filteredCategoryIndicators.komunikasi);
    const perkembangan = calcCategoryAvg(filteredCategoryIndicators.perkembangan);
    const khususPosisi = calcCategoryAvg(currentPosIndicatorsConfig.indicators);

    const overall = Math.round((fisik + teknik + taktik + mental + komunikasi + perkembangan + khususPosisi) / 7);

    return {
      fisik,
      teknik,
      taktik,
      mental,
      komunikasi,
      perkembangan,
      khususPosisi,
      overall
    };
  }, [scores, filteredCategoryIndicators, currentPosIndicatorsConfig]);

  // Structured Category List for Interactive Cards & Focus Modal
  const footballCategoryList = useMemo(() => [
    { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: filteredCategoryIndicators.fisik.length, score: axisScores.fisik, indicators: filteredCategoryIndicators.fisik },
    { key: 'teknik', label: '2. Kemampuan Teknik', shortLabel: 'Teknik', count: filteredCategoryIndicators.teknik.length, score: axisScores.teknik, indicators: filteredCategoryIndicators.teknik },
    { key: 'taktik', label: '3. Pemahaman Taktik', shortLabel: 'Taktik', count: filteredCategoryIndicators.taktik.length, score: axisScores.taktik, indicators: filteredCategoryIndicators.taktik },
    { key: 'mental', label: '4. Mentalitas', shortLabel: 'Mental', count: filteredCategoryIndicators.mental.length, score: axisScores.mental, indicators: filteredCategoryIndicators.mental },
    { key: 'komunikasi', label: '5. Komunikasi Lapangan', shortLabel: 'Komunikasi', count: filteredCategoryIndicators.komunikasi.length, score: axisScores.komunikasi, indicators: filteredCategoryIndicators.komunikasi },
    { key: 'perkembangan', label: '6. Perkembangan Atlet', shortLabel: 'Perkembangan', count: filteredCategoryIndicators.perkembangan.length, score: axisScores.perkembangan, indicators: filteredCategoryIndicators.perkembangan },
    { key: 'posisi', label: `7. Khusus Posisi (${currentPosIndicatorsConfig.shortLabel || selectedPosition})`, shortLabel: 'Khusus Posisi', count: currentPosIndicatorsConfig.indicators.length, score: axisScores.khususPosisi, indicators: currentPosIndicatorsConfig.indicators, isSpecial: true }
  ], [filteredCategoryIndicators, currentPosIndicatorsConfig, axisScores, selectedPosition]);

  const handleSetCategoryPreset = (catKey, presetScore) => {
    const catObj = footballCategoryList.find((c) => c.key === catKey);
    if (!catObj || !catObj.indicators) return;

    setScores((prev) => {
      const updated = { ...prev };
      catObj.indicators.forEach((ind) => {
        updated[ind] = presetScore;
      });
      return updated;
    });
  };

  // Recharts radar data for 7 corners
  const radarData = useMemo(() => [
    { subject: 'Fisik', A: axisScores.fisik, fullMark: 100 },
    { subject: 'Teknik', A: axisScores.teknik, fullMark: 100 },
    { subject: 'Taktik', A: axisScores.taktik, fullMark: 100 },
    { subject: 'Mental', A: axisScores.mental, fullMark: 100 },
    { subject: 'Komunikasi', A: axisScores.komunikasi, fullMark: 100 },
    { subject: 'Perkembangan', A: axisScores.perkembangan, fullMark: 100 },
    { subject: 'Khusus Posisi', A: axisScores.khususPosisi, fullMark: 100 },
  ], [axisScores]);

  // Adjust score handler with +/- 5 step
  const handleAdjustScore = (indicatorName, delta) => {
    setScores((prev) => {
      const curr = prev[indicatorName] !== undefined ? prev[indicatorName] : 0;
      const nextVal = Math.min(100, Math.max(0, curr + delta));
      return { ...prev, [indicatorName]: nextVal };
    });
  };

  // Direct slider change
  const handleScoreChange = (indicatorName, value) => {
    setScores((prev) => ({
      ...prev,
      [indicatorName]: Math.min(100, Math.max(0, Number(value) || 0))
    }));
  };

  // Set All Active Indicators To Specific Value
  const handleSetAllGlobalValue = (val) => {
    const activeIndicators = [];
    Object.values(filteredCategoryIndicators).forEach((arr) => {
      activeIndicators.push(...arr);
    });
    activeIndicators.push(...currentPosIndicatorsConfig.indicators);

    const nextState = { ...scores };
    activeIndicators.forEach((ind) => {
      nextState[ind] = val;
    });
    setScores(nextState);

    setSuccessMsg(`Seluruh indikator aktif Tier ${activeTier} (${activeIndicators.length}) di-set ke ${val}.`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };


  // Generate Auto-Draft Coach Note
  const handleGenerateDraft = () => {
    if (!selectedStudent) return;

    const categoriesList = [
      { name: 'Kondisi Fisik', score: axisScores.fisik },
      { name: 'Kemampuan Teknik', score: axisScores.teknik },
      { name: 'Pemahaman Taktik', score: axisScores.taktik },
      { name: 'Mentalitas', score: axisScores.mental },
      { name: 'Komunikasi Lapangan', score: axisScores.komunikasi },
      { name: 'Perkembangan Atlet', score: axisScores.perkembangan },
      { name: `Indikator Khusus (${currentPosIndicatorsConfig.shortLabel})`, score: axisScores.khususPosisi },
    ];

    const sorted = [...categoriesList].sort((a, b) => b.score - a.score);
    const topPillar = sorted[0];
    const bottomPillar = sorted[sorted.length - 1];
    const overall = axisScores.overall;

    let draft = '';

    if (activeTier === 1 || activeTier === 2) {
      let summaryText = 'menunjukkan antusiasme dan kesenangan bermain yang tinggi.';
      if (overall < 50) summaryText = 'dalam tahap penyesuaian gerak motorik dan pengenalan bola.';
      else if (overall >= 75) summaryText = 'sangat berbakat dengan kontrol motorik dan antusiasme luar biasa.';

      draft = `[Rapor Perkembangan ${tierConfig.shortLabel}]\n` +
        `Atlet ${selectedStudent.studentName} berada pada tahap ${tierConfig.label} (${currentPosIndicatorsConfig.label}). Atlet ${summaryText}\n\n` +
        `Aspek yang paling berkembang: ${topPillar.name} (Skor: ${topPillar.score}/100).\n` +
        `Fokus pembinaan selanjutnya: ${bottomPillar.name} (Skor: ${bottomPillar.score}/100).\n\n` +
        `Rata-rata perkembangan saat ini: ${overall}/100.`;
    } else {
      const styleObj = getStyleConfig(selectedStyleCode);
      let summaryText = 'sangat memuaskan dan siap bersaing di laga kompetitif.';
      if (overall < 60) summaryText = 'membutuhkan pembinaan intensif dan disiplin latihan tambahan.';
      else if (overall < 80) summaryText = 'cukup baik dengan progres positif yang konsisten.';

      const secText = secondaryPosition && secondaryPosition !== 'NONE' ? ` (Posisi Sekunder: ${secondaryPosition})` : '';

      draft = `[Rapor Taktis ${tierConfig.shortLabel} - ${selectedPosition}${secText}]\n` +
        `Atlet ${selectedStudent.studentName} dievaluasi pada posisi utama ${selectedPosition}${secondaryPosition && secondaryPosition !== 'NONE' ? ` serta posisi sekunder ${secondaryPosition}` : ''} dengan spesialisasi "${selectedSpecialization}" dan profil gaya bermain ${styleObj.code} — ${styleObj.name} (${styleObj.desc}).\n\n` +
        `Keunggulan utama ditunjukkan pada ${topPillar.name} (Skor: ${topPillar.score}/100). Aspek yang perlu ditingkatkan adalah ${bottomPillar.name} (Skor: ${bottomPillar.score}/100).\n\n` +
        `Secara keseluruhan, performa atlet dinilai ${summaryText} (Skor Total: ${overall}/100).`;
    }

    setCoachNote(draft);
  };

  // Save evaluation to Firestore
  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedClass?.id || !tenantId) return;
    if (!selectedStudent?.id) {
      setErrorMsg('Pilih siswa atlet dari daftar untuk dievaluasi.');
      return;
    }
    if (!evaluationDate) {
      setErrorMsg('Tanggal evaluasi wajib diisi.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const evaluatorName = selectedClass.coachName || selectedClass.coach || 'Pelatih Utama';

    const activeIndicators = [];
    Object.values(filteredCategoryIndicators).forEach((arr) => {
      activeIndicators.push(...arr);
    });
    activeIndicators.push(...currentPosIndicatorsConfig.indicators);

    const finalScores = {};
    activeIndicators.forEach((ind) => {
      finalScores[ind] = scores[ind] !== undefined ? scores[ind] : 0;
    });

    const styleObj = getStyleConfig(selectedStyleCode);

    try {
      const savedEval = await supabaseAcademyService.createEvaluation({
        tenantId,
        academyId: selectedClass.academyId || activeAcademy?.id || '',
        classId: selectedClass.id,
        className: selectedClass.className || selectedClass.name || 'Kelas Akademi',
        sportCategory: 'sepakbola',
        sportCategoryLabel: `Athlete Development Assessment (${tierConfig.shortLabel})`,
        sportName: sportName,
        sport: selectedClass.sport || sportName,
        activeTier: activeTier,
        tierLabel: tierConfig.label,
        playerRole: selectedPosition,
        secondaryPosition: activeTier >= 3 ? secondaryPosition : 'NONE',
        specialization: activeTier >= 3 ? selectedSpecialization : 'Eksplorasi/Dasar',
        styleCode: activeTier >= 3 ? selectedStyleCode : 'N/A',
        styleLabel: activeTier >= 3 ? styleObj.name : 'N/A',
        studentId: selectedStudent.id,
        studentName: selectedStudent.studentName || 'Siswa',
        date: evaluationDate,
        scores: finalScores,
        pillarScores: {
          fisik: axisScores.fisik,
          teknik: axisScores.teknik,
          taktik: axisScores.taktik,
          mental: axisScores.mental,
          komunikasi: axisScores.komunikasi,
          perkembangan: axisScores.perkembangan,
          khususPosisi: axisScores.khususPosisi,
          position: axisScores.khususPosisi,
          overall: axisScores.overall
        },
        overallScore: axisScores.overall,
        coachNote: coachNote.trim(),
        evaluator: evaluatorName
      });

      setSuccessMsg(`Assessment (${tierConfig.shortLabel}) untuk ${selectedStudent.studentName} berhasil disimpan!`);
      setCoachNote('');
      if (onEvaluationSaved) onEvaluationSaved(savedEval);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to save assessment to Supabase:', err);
      setErrorMsg('Gagal menyimpan assessment evaluasi. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const evaluatedStudentIdsToday = new Set(
    history.filter((h) => h.date === evaluationDate).map((h) => h.studentId)
  );

  const overallGrade = getScoreGrade(axisScores.overall);

  return (
    <div className="space-y-6 text-left">
      {/* HEADER BAR */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        
        {/* MOBILE COMPACT TITLE BAR (< 1024px) */}
        <div className="flex lg:hidden items-center justify-between pb-2.5 border-b border-slate-100">
          <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
            Evaluasi Atlet
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#354944]/10 text-[#354944] border border-[#354944]/20">
              {detectedSport}
            </span>
            {latestEvalDoc ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Terisi ({formatDateIndonesian(latestEvalDoc.date)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold">
                <span>Belum Ada</span>
              </span>
            )}
          </div>
        </div>

        {/* DESKTOP TITLE BAR (>= 1024px) */}
        <div className="hidden lg:flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#354944] text-white flex items-center justify-center font-bold shrink-0 shadow-xs border border-[#C89D32]/40">
              <Compass className="w-5 h-5 text-[#C89D32]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
                Athlete Development Assessment
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#354944]/10 text-[#354944] border border-[#354944]/20">
                {detectedSport}
              </span>
            </div>
          </div>

          <div className="self-start sm:self-center">
            {loadingHistory ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Memuat riwayat...</span>
              </span>
            ) : latestEvalDoc ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Riwayat Terakhir Terpasang (Tanggal: {formatDateIndonesian(latestEvalDoc.date)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Belum ada riwayat (Mulai dari 0)</span>
              </span>
            )}
          </div>
        </div>

        {/* ALERTS */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {students.length === 0 ? (
          <div className="py-8 border border-dashed border-slate-200 rounded-2xl text-center p-6 bg-slate-50/50">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Belum ada siswa terdaftar di kelas ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* INPUT FILTER AREA (2 BARIS KOMPAK DI MOBILE) */}
            <div className="bg-slate-50/90 p-3 sm:p-4 rounded-2xl border border-slate-200/90 space-y-2.5">
              {/* Baris 1: Pilih Atlet (1 Kolom Penuh) */}
              <div>
                <label className="block text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#354944]" />
                  <span>Pilih Atlet ({students.length})</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedStudent?.id || ''}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 shadow-2xs cursor-pointer appearance-none pr-8"
                  >
                    {students.map((st) => {
                      const isEvaluatedToday = evaluatedStudentIdsToday.has(st.id);
                      const pos = st.playerRole || st.position || 'ST';
                      const secPos = st.secondaryPosition && st.secondaryPosition !== 'NONE' ? ` / ${st.secondaryPosition}` : '';
                      return (
                        <option key={st.id} value={st.id}>
                          {isEvaluatedToday ? '✓ [Terisi] ' : ''}{st.studentName} — Posisi: {pos}{secPos}
                        </option>
                      );
                    })}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Baris 2: Tanggal Evaluasi & Jenjang Evaluasi (2 Kolom Berdampingan) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#354944]" />
                    <span>Tanggal</span>
                  </label>
                  <input
                    type="date"
                    value={evaluationDate}
                    onChange={(e) => setEvaluationDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 shadow-2xs cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-[#354944]" />
                    <span>Jenjang</span>
                  </label>
                  <select
                    value={overrideTier}
                    onChange={(e) => setOverrideTier(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-[#354944] shadow-2xs cursor-pointer truncate"
                  >
                    <option value="AUTO">Otomatis: {detectedTierCode} ({studentAge} Thn)</option>
                    <option value="FILANESIA_F1">Fase 1: U-8 &amp; U-10 (Usia 6–9 Thn) • Fase Kegembiraan (Joy Phase)</option>
                    <option value="FILANESIA_F2">Fase 2: U-10 &amp; U-12 (Usia 10–12 Thn) • Fase Skill Phase</option>
                    <option value="FILANESIA_F3">Fase 3: U-14 &amp; U-16 (Usia 13–16 Thn) • Fase Taktik 4-3-3</option>
                    <option value="FILANESIA_F4">Fase 4: U-18 / Senior (Usia 17+ Thn) • Fase Penampilan (Performance)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PANEL ATAS */}
      {selectedStudent && (
        <form onSubmit={handleSaveEvaluation} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* RADAR 7-AXIS */}
            <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-md flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#C89D32]" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Scouting Radar
                  </span>
                </div>

                {/* Header kanan: Skor Realtime & Toggle Mobile */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#C89D32] bg-slate-800 px-2 py-0.5 rounded-full border border-white/10">
                    {axisScores.overall}/100
                  </span>
                  <span className={`lg:hidden px-2 py-0.5 text-[10px] font-bold rounded-full ${overallGrade.badge}`}>
                    {overallGrade.grade.split(' ')[0]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMobileRadar(!showMobileRadar)}
                    className="lg:hidden text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-lg border border-white/10 transition-colors cursor-pointer"
                  >
                    {showMobileRadar ? 'Lipat ▴' : 'Buka ▾'}
                  </button>
                </div>
              </div>

              {showMobileRadar && (
                <div className="h-56 sm:h-64 w-full flex items-center justify-center my-auto">
                  <ResponsiveContainer width="100%" height={230}>
                    <RadarChart cx="50%" cy="50%" outerRadius="62%" data={radarData} margin={{ top: 8, right: 15, bottom: 8, left: 15 }}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 700 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={false} />
                      <Radar
                        name="Skor Atlet"
                        dataKey="A"
                        stroke="#C89D32"
                        fill="#354944"
                        fillOpacity={0.65}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="text-[11px] text-slate-300 bg-slate-800/80 p-2.5 rounded-xl flex items-center justify-between border border-white/5">
                <span className="text-slate-400">Rata-Rata (7 Kategori):</span>
                <div className="flex items-center gap-1.5">
                  <strong className="text-[#C89D32] font-black text-xs">{axisScores.overall} / 100</strong>
                  <span className="text-[10px] font-bold text-slate-400">({overallGrade.grade})</span>
                </div>
              </div>
            </div>

            {/* TAKTIS SEPAKBOLA */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs h-full flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <span>Konfigurasi Posisi &amp; Peran</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
                    Tier {activeTier}
                  </span>
                </div>

                {/* Banner Skor Realtime & Predikat Evaluasi */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Skor Realtime
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-slate-900 tracking-tight">
                          {axisScores.overall}
                        </span>
                        <span className="text-xs font-bold text-slate-400">/ 100</span>
                      </div>
                    </div>
                    {(() => {
                      const g = getScoreGrade(axisScores.overall);
                      return (
                        <span className={`px-2.5 py-1 text-xs font-black rounded-lg border shadow-2xs shrink-0 ${g.badge}`}>
                          {g.grade}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.max(0, axisScores.overall))}%` }} 
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      1. Posisi / Peran Bermain (Utama)
                    </label>
                    <select
                      value={selectedPosition}
                      onChange={(e) => handlePositionChange(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer"
                    >
                      {availablePositions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    {activeTier < 3 && (
                      <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 font-medium flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Fokus pengembangan skill individu pada posisi utama ({tierConfig.shortLabel}).</span>
                      </div>
                    )}
                  </div>

                  {/* POSISI KEDUA / ALTERNATIF (SECONDARY POSITION) - HANYA DITAMPILKAN FASE 3 KE ATAS */}
                  {activeTier >= 3 && (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>2. Posisi Kedua / Alternatif (Secondary Position)</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 lowercase">
                          fleksibilitas taktis
                        </span>
                      </label>
                      <select
                        value={secondaryPosition}
                        onChange={(e) => setSecondaryPosition(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer"
                      >
                        {SECONDARY_FOOTBALL_POSITIONS.map((sp) => (
                          <option key={sp.code} value={sp.code}>
                            {sp.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activeTier >= 3 && (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Spesialisasi Peran
                      </label>
                      <select
                        value={selectedSpecialization}
                        onChange={(e) => setSelectedSpecialization(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer"
                      >
                        {(getPositionConfig(selectedPosition).specializations || []).map((spec) => (
                          <option key={spec} value={spec}>
                            {spec}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activeTier >= 3 && (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Profil Gaya Bermain Taktis (STY)
                      </label>
                      <select
                        value={selectedStyleCode}
                        onChange={(e) => setSelectedStyleCode(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer"
                      >
                        {FOOTBALL_PLAYING_STYLES.map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.code} — {st.name} ({st.desc})
                          </option>
                        ))}
                      </select>

                      {getStyleConfig(selectedStyleCode) && (
                        <div className="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs flex items-center gap-2">
                          <Radio className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-extrabold text-emerald-950">
                              {getStyleConfig(selectedStyleCode).code} — {getStyleConfig(selectedStyleCode).name}:
                            </span>{' '}
                            <span className="text-emerald-800 font-medium">{getStyleConfig(selectedStyleCode).desc}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* BAR KONTROL PRESET SKOR CEPAT (DI BAGIAN BAWAH KARTU) */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Preset Nilai Cepat:</span>
                </span>

                <div className="grid grid-cols-4 gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => handleSetAllGlobalValue(0)}
                    className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                    title="Reset semua indikator ke 0"
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllGlobalValue(50)}
                    className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllGlobalValue(75)}
                    className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200 transition-all cursor-pointer shadow-2xs"
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllGlobalValue(90)}
                    className="py-1.5 px-1 text-[11px] font-bold rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                  >
                    Elite
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PANEL RINGKASAN SKOR KATEGORI (GRID 2 KOLOM DI MOBILE) */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#354944]" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                    Ringkasan Skor Kategori
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-600 sm:hidden">
                  Rata-Rata: <strong className="text-slate-900 font-black">{axisScores.overall}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 mr-1 hidden sm:inline">
                  Rata-Rata: <strong className="text-slate-900 font-black">{axisScores.overall} / 100</strong>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModalCategoryKey(footballCategoryList[0]?.key);
                    setIsModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#C89D32]" />
                  <span>✎ Edit Penilaian</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAllInline(!showAllInline)}
                  className={`flex-1 sm:flex-none px-3 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    showAllInline
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{showAllInline ? 'Tutup' : 'Buka Semua'}</span>
                </button>
              </div>
            </div>

            {/* GRID 2 KOLOM DI MOBILE (< 1024px), 3 KOLOM DI DESKTOP */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
              {footballCategoryList.map((cat, idx) => {
                const isFilled = (cat.score || 0) > 0;
                return (
                  <div
                    key={cat.key}
                    onClick={() => {
                      setActiveModalCategoryKey(cat.key);
                      setIsModalOpen(true);
                    }}
                    className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90 hover:border-[#354944] hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <span className="font-bold text-xs text-slate-900 block leading-tight line-clamp-1" title={cat.label}>
                        {idx + 1}. {cat.label}
                      </span>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-medium">
                          {cat.count} Indikator
                        </span>
                        {isFilled ? (
                          <span className="text-emerald-700 font-extrabold">✓ Terisi</span>
                        ) : (
                          <span className="text-slate-400 font-medium">Kosong</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Skor</span>
                        <span className="text-sm font-extrabold text-slate-900 font-mono">
                          {cat.score || 0}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#354944] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, cat.score || 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SUB-TABS 7 KATEGORI (OPSIONAL HANYA SAAT showAllInline = true) */}
          {showAllInline && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  Lembar Penilaian Indikator
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowAllAtOnce(!showAllAtOnce)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                  showAllAtOnce
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{showAllAtOnce ? 'Tutup (Kembali ke Tab)' : 'Tampilkan Semua Sekaligus'}</span>
              </button>
            </div>

            {!showAllAtOnce && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveTab('fisik')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    activeTab === 'fisik'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-rose-50/60 text-rose-900 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <Dumbbell className="w-3.5 h-3.5" />
                  <span>Fisik ({filteredCategoryIndicators.fisik.length})</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'fisik' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'}`}>
                    {axisScores.fisik}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('teknik')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    activeTab === 'teknik'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Teknik ({filteredCategoryIndicators.teknik.length})</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'teknik' ? 'bg-blue-700 text-white' : 'bg-blue-200 text-blue-900'}`}>
                    {axisScores.teknik}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('taktik')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    activeTab === 'taktik'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-purple-50/60 text-purple-900 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Taktik ({filteredCategoryIndicators.taktik.length})</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'taktik' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-900'}`}>
                    {axisScores.taktik}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('mental')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    activeTab === 'mental'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-emerald-50/60 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Mental ({filteredCategoryIndicators.mental.length})</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'mental' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
                    {axisScores.mental}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('komunikasi')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    activeTab === 'komunikasi'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50/60 text-amber-900 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Komunikasi ({filteredCategoryIndicators.komunikasi.length})</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'komunikasi' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                    {axisScores.komunikasi}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('perkembangan')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    activeTab === 'perkembangan'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                      : 'bg-cyan-50/60 text-cyan-900 border-cyan-200 hover:bg-cyan-100'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Perkembangan ({filteredCategoryIndicators.perkembangan.length})</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'perkembangan' ? 'bg-cyan-700 text-white' : 'bg-cyan-200 text-cyan-900'}`}>
                    {axisScores.perkembangan}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('posisi')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    activeTab === 'posisi'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-indigo-50/60 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Khusus Posisi ({currentPosIndicatorsConfig.indicators.length})</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${activeTab === 'posisi' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-900'}`}>
                    {axisScores.khususPosisi}
                  </span>
                </button>
              </div>
            )}

            <div className="space-y-6">
              {Object.entries(FOOTBALL_CORE_CATEGORIES).map(([catKey, catConfig]) => {
                if (!showAllAtOnce && activeTab !== catKey) return null;
                const activeInds = filteredCategoryIndicators[catKey] || [];

                return (
                  <div key={catKey} className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${catConfig.badgeColor}`} />
                        <span>{catConfig.title}</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white border border-slate-200 text-slate-800">
                        Rata-rata: {axisScores[catKey]} / 100
                      </span>
                    </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                            {activeInds.map((ind) => {
                              const val = scores[ind] !== undefined ? scores[ind] : 0;
                              return (
                                <IndicatorCard
                                  key={ind}
                                  title={ind}
                                  value={val}
                                  onScoreChange={(v) => handleScoreChange(ind, v)}
                                  onAdjust={(delta) => handleAdjustScore(ind, delta)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {(showAllAtOnce || activeTab === 'posisi') && (
                      <div className="p-4 sm:p-5 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                        <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                            <Star className="w-4 h-4 text-indigo-600 fill-indigo-100" />
                            <span>Indikator Khusus: {currentPosIndicatorsConfig.label} ({currentPosIndicatorsConfig.indicators.length} Indikator)</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Rata-rata: {axisScores.khususPosisi} / 100
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                          {currentPosIndicatorsConfig.indicators.map((ind) => {
                            const val = scores[ind] !== undefined ? scores[ind] : 0;
                            return (
                              <IndicatorCard
                                key={ind}
                                title={ind}
                                value={val}
                                isSpecial
                                onScoreChange={(v) => handleScoreChange(ind, v)}
                                onAdjust={(delta) => handleAdjustScore(ind, delta)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

                {/* CATATAN & SIMPAN */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#354944]" />
                      <span>Catatan Evaluasi Taktis &amp; Rekomendasi Pelatih ({tierConfig.shortLabel})</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateDraft}
                      className="px-3.5 py-1.5 bg-[#354944]/10 hover:bg-[#354944]/20 text-[#354944] border border-[#354944]/30 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#C89D32]" />
                      <span>Buat Draf Analisis Otomatis</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={coachNote}
                    onChange={(e) => setCoachNote(e.target.value)}
                    placeholder={`Contoh: Atlet ${selectedStudent.studentName} menunjukkan penempatan posisi dan timing finishing yang tajam. Perlu peningkatan koordinasi pressing.`}
                    className="w-full px-4 py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-medium text-slate-800 leading-relaxed"
                  />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <p className="text-[11px] text-slate-400">
                      * Hasil assessment ini tersimpan permanen dan otomatis dapat diakses oleh Wali Murid di Portal Resmi.
                    </p>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto px-8 py-3.5 bg-[#354944] hover:bg-[#2B3D38] text-white font-black text-xs rounded-2xl border-b-2 border-[#C89D32] shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Menyimpan Assessment...</span>
                        </>
                      ) : (
                        <>
                          <Award className="w-4 h-4 text-[#C89D32]" />
                          <span>Simpan Assessment ({tierConfig.shortLabel})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* MODAL FOKUS PENILAIAN KATEGORI */}
                <CategoryAssessmentModal
                  isOpen={isModalOpen}
                  onClose={() => setIsModalOpen(false)}
                  categoryList={footballCategoryList}
                  activeCategoryKey={activeModalCategoryKey}
                  setActiveCategoryKey={setActiveModalCategoryKey}
                  scores={scores}
                  onScoreChange={handleScoreChange}
                  onAdjustScore={handleAdjustScore}
                  onSetCategoryPreset={handleSetCategoryPreset}
                />

              </form>
            )}

      {/* RIWAYAT */}
      <HistorySection
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        students={students}
        onDeleteEvaluation={onDeleteEvaluation}
      />
    </div>
  );
}

// =====================================================================
// COMPONENT: CATEGORY ASSESSMENT MODAL / FOCUS DRAWER
// =====================================================================
export function CategoryAssessmentModal({
  isOpen,
  onClose,
  categoryList = [],
  activeCategoryKey,
  setActiveCategoryKey,
  scores = {},
  onScoreChange,
  onAdjustScore,
  onSetCategoryPreset
}) {
  const [currentKey, setCurrentKey] = useState(activeCategoryKey || categoryList[0]?.key);

  useEffect(() => {
    if (activeCategoryKey) {
      setCurrentKey(activeCategoryKey);
    } else if (!currentKey && categoryList.length > 0) {
      setCurrentKey(categoryList[0].key);
    }
  }, [activeCategoryKey, categoryList]);

  // Overall average
  const overallAvg = useMemo(() => {
    if (!categoryList || categoryList.length === 0) return 0;
    const sum = categoryList.reduce((acc, c) => acc + (c.score || 0), 0);
    return Math.round(sum / categoryList.length);
  }, [categoryList]);

  // Active Category Index & Object
  const activeIndex = useMemo(() => {
    const idx = categoryList.findIndex((c) => c.key === currentKey);
    return idx >= 0 ? idx : 0;
  }, [categoryList, currentKey]);

  const activeCategory = categoryList[activeIndex] || categoryList[0];

  const handleSelectCategory = (key) => {
    setCurrentKey(key);
    if (setActiveCategoryKey) setActiveCategoryKey(key);
  };

  const handlePrevCategory = () => {
    if (activeIndex > 0) {
      handleSelectCategory(categoryList[activeIndex - 1].key);
    }
  };

  const handleNextCategory = () => {
    if (activeIndex < categoryList.length - 1) {
      handleSelectCategory(categoryList[activeIndex + 1].key);
    }
  };

  // Helper to compute progress per category
  const getCategoryProgress = (cat) => {
    const indicators = cat?.indicators || [];
    const total = indicators.length;
    if (total === 0) return { total: 0, rated: 0, percent: 100, isCompleted: true };
    const rated = indicators.filter((ind) => {
      const s = scores[ind];
      return s !== undefined && s !== null && s > 0;
    }).length;
    const percent = Math.round((rated / total) * 100);
    const isCompleted = rated === total && total > 0;
    return { total, rated, percent, isCompleted };
  };

  const completedCategoriesCount = categoryList.filter(
    (c) => getCategoryProgress(c).isCompleted
  ).length;

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lg:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white dark:bg-[#162320] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden my-auto text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#121c19]/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#354944] text-white flex items-center justify-center font-bold shrink-0 border-2 border-[#C89D32] shadow-sm">
              <Edit3 className="w-5 h-5 text-[#C89D32]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 tracking-tight">
                  Edit &amp; Input Penilaian Indikator
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#354944]/10 dark:bg-[#C89D32]/10 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20 dark:border-[#C89D32]/20">
                  {categoryList.length} Kategori
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {completedCategoriesCount}/{categoryList.length} Selesai
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pilih kategori di menu kiri, isi nilai indikator per kategori, dan gunakan navigasi berikutnya untuk alur kerja cepat.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Rata-rata:</span>
              <span className="font-mono font-black text-sm text-[#354944] dark:text-[#C89D32]">
                {overallAvg} / 100
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Tutup Jendela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MOBILE HORIZONTAL CATEGORY SELECTOR (< md) */}
        <div className="flex md:hidden items-center gap-1.5 overflow-x-auto p-2.5 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-white/10 scrollbar-none shrink-0">
          {categoryList.map((cat, idx) => {
            const isActive = cat.key === activeCategory?.key;
            const { total, rated, isCompleted } = getCategoryProgress(cat);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleSelectCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border ${
                  isActive
                    ? 'bg-[#354944] text-white border-[#354944] shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{idx + 1}. {cat.shortLabel || cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  isCompleted 
                    ? (isActive ? 'bg-emerald-500/30 text-emerald-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300')
                    : (isActive ? 'bg-black/20 text-[#C89D32]' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400')
                }`}>
                  {rated}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* BODY MODAL: MASTER-DETAIL SPLIT VIEW */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT SIDE VERTICAL CATEGORY MENU (w-64 DESKTOP) */}
          <div className="hidden md:flex flex-col w-64 shrink-0 border-r border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-900/70 p-3 space-y-2 overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between px-2 pb-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Pilih Kategori
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {completedCategoriesCount}/{categoryList.length} lengkap
              </span>
            </div>

            {categoryList.map((cat, idx) => {
              const isActive = cat.key === activeCategory?.key;
              const { total, rated, percent, isCompleted } = getCategoryProgress(cat);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleSelectCategory(cat.key)}
                  className={`w-full text-left p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col gap-2 border ${
                    isActive
                      ? 'bg-[#354944] text-white border-[#354944] shadow-md ring-2 ring-[#C89D32]/30'
                      : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100/90 dark:hover:bg-slate-700/70 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-[#C89D32] text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="truncate font-extrabold">{cat.shortLabel || cat.label}</span>
                    </div>

                    {/* Score badge */}
                    <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-lg shrink-0 ${
                      isActive ? 'bg-black/25 text-[#C89D32]' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    }`}>
                      {cat.score || 0}
                    </span>
                  </div>

                  {/* Progress Bar & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 bg-slate-200/80 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : percent > 0
                            ? (isActive ? 'bg-[#C89D32]' : 'bg-amber-500')
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isCompleted ? (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{rated}/{total}</span>
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-white/10 text-slate-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {rated}/{total}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT EXCLUSIVE CATEGORY DETAIL PANEL */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-left">
            {activeCategory ? (
              <div
                key={activeCategory.key}
                className="space-y-4 animate-fade-category"
              >
                {/* ACTIVE CATEGORY HEADER */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#354944] text-white flex items-center justify-center font-black text-sm shrink-0 border-2 border-[#C89D32] shadow-xs">
                      {activeIndex + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                          {activeCategory.label}
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200/70 dark:bg-slate-700 border border-slate-300/80 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                          {(activeCategory.indicators || []).length} Indikator
                        </span>
                        {getCategoryProgress(activeCategory).isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Lengkap</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Fokus penilaian kategori {activeIndex + 1} dari {categoryList.length}.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Realtime Category Score Badge */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-400">Skor Kategori:</span>
                      <span className="font-mono font-black text-sm text-[#354944] dark:text-[#C89D32]">
                        {activeCategory.score || 0} / 100
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 px-1 hidden sm:inline">Preset:</span>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(activeCategory.key, 0)}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-[10px] sm:text-[11px] rounded-lg border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                        title="Reset semua nilai di kategori ini ke 0"
                      >
                        Reset 0
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(activeCategory.key, 50)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[10px] sm:text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
                      >
                        50
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(activeCategory.key, 75)}
                        className="px-2 py-1 bg-[#354944]/10 hover:bg-[#354944]/20 dark:bg-[#C89D32]/20 text-[#354944] dark:text-[#C89D32] font-bold text-[10px] sm:text-[11px] rounded-lg border border-[#354944]/20 dark:border-[#C89D32]/30 transition-colors cursor-pointer"
                      >
                        75
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(activeCategory.key, 90)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] sm:text-[11px] rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                      >
                        90
                      </button>
                    </div>
                  </div>
                </div>

                {/* ONLY RENDER ACTIVE CATEGORY'S INDICATORS */}
                {(activeCategory.indicators || []).length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    Tidak ada indikator aktif untuk kategori ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(activeCategory.indicators || []).map((ind) => {
                      const val = scores[ind] !== undefined ? scores[ind] : 0;
                      return (
                        <IndicatorCard
                          key={ind}
                          title={ind}
                          value={val}
                          isSpecial={activeCategory.isSpecial}
                          onScoreChange={(v) => onScoreChange(ind, v)}
                          onAdjust={(delta) => onAdjustScore(ind, delta)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

        </div>

        {/* FOOTER MODAL: STEPPER NAVIGATION (PREV / NEXT) & DONE BUTTON */}
        <div className="sticky bottom-0 px-6 py-4 bg-slate-50/90 dark:bg-[#121c19]/90 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* STEPPER BUTTONS */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={handlePrevCategory}
              disabled={activeIndex === 0}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                activeIndex === 0
                  ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-600 dark:border-slate-800 cursor-not-allowed opacity-50'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>← Kategori Sebelumnya</span>
            </button>

            <button
              type="button"
              onClick={handleNextCategory}
              disabled={activeIndex === categoryList.length - 1}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                activeIndex === categoryList.length - 1
                  ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-600 dark:border-slate-800 cursor-not-allowed opacity-50'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs cursor-pointer'
              }`}
            >
              <span>Kategori Berikutnya →</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-[11px] font-bold text-slate-400 hidden lg:inline ml-2">
              Kategori {activeIndex + 1} dari {categoryList.length}
            </span>
          </div>

          {/* DONE ACTION */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#354944] hover:bg-[#2B3D38] text-white text-xs sm:text-sm font-extrabold rounded-xl border-b-2 border-[#C89D32] shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-[#C89D32]" />
              <span>✓ Selesai &amp; Tutup</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

// =====================================================================
// COMPONENT: INDIVIDUAL INDICATOR CARD WITH +/- BUTTONS & TOUCH SLIDER
// =====================================================================
function IndicatorCard({ title, value, isSpecial = false, onScoreChange, onAdjust }) {
  return (
    <div className={`p-3.5 bg-white border ${isSpecial ? 'border-indigo-200 hover:border-indigo-400' : 'border-slate-200/90 hover:border-slate-300'} rounded-2xl space-y-2 shadow-2xs transition-all`}>
      <div className="flex items-center justify-between text-xs font-bold gap-2">
        <span className="text-slate-800 truncate" title={title}>
          {isSpecial && <Star className="w-3 h-3 text-indigo-500 fill-indigo-200 inline mr-1" />}
          {title}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onAdjust(-5)}
            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center text-xs transition-colors cursor-pointer"
            title="Kurangi 5"
          >
            <Minus className="w-3 h-3" />
          </button>

          <span className={`w-8 text-center font-black text-sm ${isSpecial ? 'text-indigo-600' : 'text-emerald-600'}`}>
            {value}
          </span>

          <button
            type="button"
            onClick={() => onAdjust(5)}
            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center text-xs transition-colors cursor-pointer"
            title="Tambah 5"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(e) => onScoreChange(e.target.value)}
        className={`w-full cursor-pointer h-1.5 bg-slate-200 rounded-lg ${isSpecial ? 'accent-indigo-600' : 'accent-emerald-600'}`}
      />
    </div>
  );
}

// =====================================================================
// COMPONENT 3: STANDARD 4-PILLAR EVALUATION ENGINE (FOR OTHER SPORTS)
// =====================================================================
function Standard4PillarView({
  selectedClass,
  classStudents,
  tenantId,
  activeAcademy,
  history,
  loadingHistory,
  filterStudentId,
  setFilterStudentId,
  onDeleteEvaluation,
  onEvaluationSaved
}) {
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const selectedStudent = useMemo(() => {
    if (classStudents.length === 0) return null;
    return classStudents.find((s) => s.id === selectedStudentId) || classStudents[0];
  }, [classStudents, selectedStudentId]);

  const sportCategoryKey = useMemo(() => {
    return resolveSportCategoryKey(selectedClass, activeAcademy);
  }, [selectedClass, activeAcademy]);

  const categoryConfig = SPORT_KPI_MATRIX[sportCategoryKey] || SPORT_KPI_MATRIX['field'];
  const sportName = selectedClass?.sport || activeAcademy?.sport || categoryConfig.label;

  const playerRole = selectedStudent?.playerRole || selectedStudent?.position || '';

  const pillars = categoryConfig.pillars || { fisik: [], teknik: [], taktik: [], mental: [] };
  const roleKPIs = useMemo(() => (playerRole && ROLE_SPECIFIC_KPIS[playerRole]) || [], [playerRole]);

  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scores, setScores] = useState({});
  const [coachNote, setCoachNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalCategoryKey, setActiveModalCategoryKey] = useState('fisik');

  // Memoized latest evaluation doc for current student in Standard4PillarView
  const latestEvalDoc = useMemo(() => {
    if (!selectedStudent?.id || !history || history.length === 0) return null;
    const studentHistory = history.filter((h) => h.studentId === selectedStudent.id);
    if (studentHistory.length === 0) return null;
    studentHistory.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    return studentHistory[0];
  }, [selectedStudent?.id, history]);

  useEffect(() => {
    if (!selectedStudent?.id) {
      setScores({});
      return;
    }

    setCoachNote('');
    setErrorMsg(null);
    setSuccessMsg(null);

    if (latestEvalDoc) {
      setScores(latestEvalDoc.scores || {});
    } else {
      setScores({});
    }
  }, [selectedStudent?.id, latestEvalDoc?.id]);

  const pillarScores = useMemo(() => {
    const computeAvg = (kpiList) => {
      if (!kpiList || kpiList.length === 0) return 0;
      const total = kpiList.reduce((sum, kpi) => sum + (scores[kpi] !== undefined ? scores[kpi] : 0), 0);
      return Math.round(total / kpiList.length);
    };

    const fisik = computeAvg(pillars.fisik);
    const teknik = computeAvg(pillars.teknik);
    const taktik = computeAvg(pillars.taktik);
    const mental = computeAvg(pillars.mental);
    const position = computeAvg(roleKPIs);
    const overall = Math.round((fisik + teknik + taktik + mental + position) / 5);

    const allActiveKPIs = Array.from(new Set([
      ...(pillars.fisik || []),
      ...(pillars.teknik || []),
      ...(pillars.taktik || []),
      ...(pillars.mental || []),
      ...roleKPIs
    ]));

    return { fisik, teknik, taktik, mental, position, overall, allActiveKPIs };
  }, [pillars, roleKPIs, scores]);

  const overallScore = pillarScores.overall;

  const radarData = useMemo(() => [
    { subject: 'Fisik', A: pillarScores.fisik, fullMark: 100 },
    { subject: 'Teknik', A: pillarScores.teknik, fullMark: 100 },
    { subject: 'Taktik', A: pillarScores.taktik, fullMark: 100 },
    { subject: 'Mental', A: pillarScores.mental, fullMark: 100 },
    { subject: 'Posisi', A: pillarScores.position, fullMark: 100 }
  ], [pillarScores]);

  const standardCategoryList = useMemo(() => {
    const list = [
      { key: 'fisik', label: '1. Kondisi Fisik', shortLabel: 'Fisik', count: (pillars.fisik || []).length, score: pillarScores.fisik, indicators: pillars.fisik || [] },
      { key: 'teknik', label: '2. Kemampuan Teknik', shortLabel: 'Teknik', count: (pillars.teknik || []).length, score: pillarScores.teknik, indicators: pillars.teknik || [] },
      { key: 'taktik', label: '3. Pemahaman Taktik', shortLabel: 'Taktik', count: (pillars.taktik || []).length, score: pillarScores.taktik, indicators: pillars.taktik || [] },
      { key: 'mental', label: '4. Mentalitas', shortLabel: 'Mental', count: (pillars.mental || []).length, score: pillarScores.mental, indicators: pillars.mental || [] },
    ];
    if (roleKPIs && roleKPIs.length > 0) {
      list.push({
        key: 'position',
        label: `5. Spesifik Posisi (${playerRole || 'Peran'})`,
        shortLabel: 'Posisi',
        count: roleKPIs.length,
        score: pillarScores.position,
        indicators: roleKPIs,
        isSpecial: true
      });
    }
    return list;
  }, [pillars, roleKPIs, pillarScores, playerRole]);

  const handleSetCategoryPreset = (categoryKey, presetVal) => {
    const cat = standardCategoryList.find((c) => c.key === categoryKey);
    if (!cat) return;
    setScores((prev) => {
      const next = { ...prev };
      cat.indicators.forEach((ind) => {
        next[ind] = presetVal;
      });
      return next;
    });
  };

  const handleScoreChange = (kpiName, value) => {
    setScores((prev) => ({
      ...prev,
      [kpiName]: Math.min(100, Math.max(0, Number(value) || 0))
    }));
  };

  const handleSetAllValues = (val) => {
    const nextState = {};
    pillarScores.allActiveKPIs.forEach((kpi) => {
      nextState[kpi] = val;
    });
    setScores(nextState);
  };

  const handleGenerateDraft = () => {
    if (!selectedStudent) return;
    const items = [
      { name: 'Kondisi Fisik', score: pillarScores.fisik },
      { name: 'Kemampuan Teknik', score: pillarScores.teknik },
      { name: 'Pemahaman Taktik', score: pillarScores.taktik },
      { name: 'Mentalitas', score: pillarScores.mental },
      { name: `Spesifik Posisi (${playerRole || 'Peran'})`, score: pillarScores.position }
    ];
    const sorted = [...items].sort((a, b) => b.score - a.score);
    setCoachNote(`Atlet ${selectedStudent.studentName} (${playerRole || 'Umum'}) tertinggi pada ${sorted[0].name} (Skor: ${sorted[0].score}/100) dan perlu pengembangan pada ${sorted[sorted.length - 1].name} (Skor: ${sorted[sorted.length - 1].score}/100).`);
  };

  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedClass?.id || !tenantId || !selectedStudent?.id) return;
    setIsSaving(true);
    const finalScores = {};
    pillarScores.allActiveKPIs.forEach((kpi) => {
      finalScores[kpi] = scores[kpi] !== undefined ? scores[kpi] : 0;
    });

    try {
      const savedEval = await supabaseAcademyService.createEvaluation({
        tenantId,
        classId: selectedClass.id,
        className: selectedClass.className || 'Kelas Akademi',
        sportCategory: sportCategoryKey,
        sportCategoryLabel: categoryConfig.label,
        sportName,
        playerRole: playerRole || 'Umum',
        studentId: selectedStudent.id,
        studentName: selectedStudent.studentName,
        date: evaluationDate,
        scores: finalScores,
        pillarScores: {
          fisik: pillarScores.fisik,
          teknik: pillarScores.teknik,
          taktik: pillarScores.taktik,
          mental: pillarScores.mental,
          position: pillarScores.position,
          overall: pillarScores.overall
        },
        overallScore: pillarScores.overall,
        coachNote: coachNote.trim(),
        evaluator: selectedClass.coachName || 'Pelatih'
      });
      setSuccessMsg(`Rapor ${selectedStudent.studentName} berhasil disimpan!`);
      setCoachNote('');
      if (onEvaluationSaved) onEvaluationSaved(savedEval);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to save evaluation to Supabase:', err);
      setErrorMsg('Gagal menyimpan evaluasi.');
    } finally {
      setIsSaving(false);
    }
  };

  const evaluatedStudentIdsToday = new Set(
    history.filter((h) => h.date === evaluationDate).map((h) => h.studentId)
  );

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Engine Evaluasi Performa Atlet</h3>
              <p className="text-xs text-slate-500">{categoryConfig.label} &bull; {selectedClass?.className}</p>
            </div>
          </div>

          <div>
            {loadingHistory ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Memuat riwayat...</span>
              </span>
            ) : latestEvalDoc ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Riwayat Terakhir Terpasang (Tanggal: {formatDateIndonesian(latestEvalDoc.date)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Belum ada riwayat (Mulai dari 0)</span>
              </span>
            )}
          </div>
        </div>

        {successMsg && <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl">{successMsg}</div>}
        {errorMsg && <div className="p-3 bg-rose-50 text-rose-800 text-xs font-bold rounded-xl">{errorMsg}</div>}

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pilih Siswa</label>
              <select
                value={selectedStudent?.id || ''}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold cursor-pointer"
              >
                {classStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {evaluatedStudentIdsToday.has(st.id) ? '✓ ' : ''}{st.studentName} ({st.playerRole || st.position || 'Umum'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tanggal</label>
              <input
                type="date"
                value={evaluationDate}
                onChange={(e) => setEvaluationDate(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold"
              />
            </div>
          </div>
        </div>

        {selectedStudent && (
          <form onSubmit={handleSaveEvaluation} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3">
                  <span className="text-xs font-bold uppercase text-indigo-400">Scouting Radar</span>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                        <Radar name="Skor" dataKey="A" stroke="#818cf8" fill="#6366f1" fillOpacity={0.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* PANEL RINGKASAN SKOR KATEGORI (FULL-WIDTH INTERACTIVE CARDS) */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/80 pb-2.5">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-[#354944]" />
                        <span>Ringkasan Skor Kategori</span>
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Klik kartu kategori atau tombol di kanan untuk mengisi indikator
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-600 mr-1">
                        Rata-Rata: <strong className="text-slate-900 font-black">{pillarScores.overall} / 100</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveModalCategoryKey(standardCategoryList[0]?.key);
                          setIsModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] rounded-xl font-bold text-xs shadow-sm shadow-[#354944]/20 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#C89D32]" />
                        <span>✎ Edit / Input Penilaian</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {standardCategoryList.map((cat) => {
                      return (
                        <div
                          key={cat.key}
                          onClick={() => {
                            setActiveModalCategoryKey(cat.key);
                            setIsModalOpen(true);
                          }}
                          className="bg-white p-3 rounded-xl border border-slate-200/90 hover:border-[#354944] shadow-2xs transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="space-y-0.5 min-w-0">
                              <span className="text-xs font-bold text-slate-800 block leading-snug">
                                {cat.label}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium block">
                                {cat.count} Indikator
                              </span>
                            </div>
                            <span className="text-xs font-black text-slate-900 shrink-0 ml-1 font-mono">
                              {cat.score || 0} <span className="text-[10px] font-normal text-slate-400">/ 100</span>
                            </span>
                          </div>

                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#354944] rounded-full transition-all duration-300" 
                              style={{ width: `${Math.min(100, Math.max(0, cat.score || 0))}%` }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <span className="text-xs font-bold uppercase text-slate-800">Kategori Key Performance</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleSetAllValues(0)} className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold">Reset (0)</button>
                      <button type="button" onClick={() => handleSetAllValues(50)} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold">50</button>
                      <button type="button" onClick={() => handleSetAllValues(75)} className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-bold">75</button>
                      <button type="button" onClick={() => handleSetAllValues(90)} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-bold">90</button>
                    </div>
                  </div>

                  {Object.entries(pillars).map(([pillarKey, kpiList]) => (
                    <div key={pillarKey} className="space-y-2">
                      <span className="text-[11px] font-extrabold uppercase text-slate-600">{pillarKey}</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {kpiList.map((kpi) => (
                          <div key={kpi} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="truncate">{kpi}</span>
                              <span className="text-indigo-600">{scores[kpi] !== undefined ? scores[kpi] : 0}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={scores[kpi] !== undefined ? scores[kpi] : 0}
                              onChange={(e) => handleScoreChange(kpi, e.target.value)}
                              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-800">Catatan Pelatih</label>
                <button type="button" onClick={handleGenerateDraft} className="text-xs font-bold text-indigo-600">⚡ Buat Draf</button>
              </div>
              <textarea
                rows={3}
                value={coachNote}
                onChange={(e) => setCoachNote(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#354944] text-white font-bold text-xs rounded-xl border-b-2 border-[#C89D32] shadow-sm cursor-pointer"
              >
                Simpan Evaluasi
              </button>
            </div>

            {/* MODAL FOKUS PENILAIAN KATEGORI */}
            <CategoryAssessmentModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              categoryList={standardCategoryList}
              activeCategoryKey={activeModalCategoryKey}
              setActiveCategoryKey={setActiveModalCategoryKey}
              scores={scores}
              onScoreChange={handleScoreChange}
              onAdjustScore={(ind, delta) => {
                setScores((prev) => {
                  const curr = prev[ind] !== undefined ? prev[ind] : 0;
                  return { ...prev, [ind]: Math.min(100, Math.max(0, curr + delta)) };
                });
              }}
              onSetCategoryPreset={handleSetCategoryPreset}
            />
          </form>
        )}
      </div>

      <HistorySection
        history={history}
        loadingHistory={loadingHistory}
        filterStudentId={filterStudentId}
        setFilterStudentId={setFilterStudentId}
        students={classStudents}
        onDeleteEvaluation={onDeleteEvaluation}
      />
    </div>
  );
}

// =====================================================================
// REUSABLE HISTORY SECTION
// =====================================================================
function HistorySection({
  history,
  loadingHistory,
  filterStudentId,
  setFilterStudentId,
  students,
  onDeleteEvaluation
}) {
  const filteredHistory = filterStudentId === 'ALL'
    ? history
    : history.filter((h) => h.studentId === filterStudentId);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Award className="w-4.5 h-4.5 text-emerald-600" />
          <h3 className="font-extrabold text-sm text-slate-900">
            Riwayat Rapor Assessment Tersimpan ({filteredHistory.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterStudentId}
            onChange={(e) => setFilterStudentId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Semua Siswa Kelas Ini</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>{st.studentName}</option>
            ))}
          </select>
        </div>
      </div>

      {loadingHistory ? (
        <p className="py-8 text-center text-xs text-slate-400 font-medium">Memuat riwayat assessment...</p>
      ) : filteredHistory.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl p-4">
          Belum ada rekam assessment disimpan untuk siswa/kelas ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHistory.map((item) => {
            const ps = item.pillarScores || {};
            const gradeInfo = getScoreGrade(item.overallScore || 0);

            return (
              <div 
                key={item.id} 
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-400 transition-all space-y-3 relative group shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900">{item.studentName}</h4>
                      {item.playerRole && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {item.playerRole} {item.specialization && item.specialization !== 'N/A' && item.specialization !== 'Eksplorasi/Dasar' && item.specialization !== 'Eksplorasi Futsal' ? `• ${item.specialization}` : ''}
                        </span>
                      )}
                      {item.activeTier && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                          Tier {item.activeTier}
                        </span>
                      )}
                      {item.styleCode && item.styleCode !== 'N/A' && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-slate-800 text-slate-100">
                          {item.styleCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      <span>Tgl: {formatDateIndonesian(item.date)}</span> &bull; 
                      <span>Pelatih: {item.evaluator || 'Pelatih'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 text-xs font-black rounded-xl border ${gradeInfo.badge}`}>
                      {item.overallScore || 0} / 100
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteEvaluation(item.id, item.studentName)}
                      title="Hapus Evaluasi"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Breakdown Badges */}
                {ps.fisik !== undefined && ps.komunikasi !== undefined ? (
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 text-[9px] text-center font-bold">
                    <div className="p-1 bg-rose-50 text-rose-800 rounded-lg border border-rose-100">
                      <span className="block text-[7px] uppercase font-black text-rose-600">Fisik</span>
                      <span>{ps.fisik}</span>
                    </div>
                    <div className="p-1 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                      <span className="block text-[7px] uppercase font-black text-blue-600">Teknik</span>
                      <span>{ps.teknik}</span>
                    </div>
                    <div className="p-1 bg-purple-50 text-purple-800 rounded-lg border border-purple-100">
                      <span className="block text-[7px] uppercase font-black text-purple-600">Taktik</span>
                      <span>{ps.taktik}</span>
                    </div>
                    <div className="p-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100">
                      <span className="block text-[7px] uppercase font-black text-emerald-600">Mental</span>
                      <span>{ps.mental}</span>
                    </div>
                    <div className="p-1 bg-cyan-50 text-cyan-800 rounded-lg border border-cyan-100">
                      <span className="block text-[7px] uppercase font-black text-cyan-600">Dev.</span>
                      <span>{ps.perkembangan}</span>
                    </div>
                    <div className="p-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-100">
                      <span className="block text-[7px] uppercase font-black text-amber-600">Kom.</span>
                      <span>{ps.komunikasi}</span>
                    </div>
                    <div className="p-1 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-100 col-span-2 sm:col-span-1">
                      <span className="block text-[7px] uppercase font-black text-indigo-600">Posisi</span>
                      <span>{ps.khususPosisi || ps.position}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-1 text-[10px] text-center font-bold">
                    <div className="p-1.5 bg-rose-50 text-rose-800 rounded-lg">Fisik: {ps.fisik || 0}</div>
                    <div className="p-1.5 bg-blue-50 text-blue-800 rounded-lg">Teknik: {ps.teknik || 0}</div>
                    <div className="p-1.5 bg-purple-50 text-purple-800 rounded-lg">Taktik: {ps.taktik || 0}</div>
                    <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">Mental: {ps.mental || 0}</div>
                    <div className="p-1.5 bg-indigo-50 text-indigo-800 rounded-lg">Posisi: {ps.position || 0}</div>
                  </div>
                )}

                {item.coachNote && (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 leading-relaxed whitespace-pre-line">
                    <strong className="block text-[10px] uppercase font-black text-emerald-800 mb-0.5">Catatan Pelatih:</strong>
                    "{item.coachNote}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
