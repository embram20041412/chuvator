import React, { useState, useEffect, useMemo } from 'react';
import supabaseAcademyService from '../services/supabaseAcademyService';
import { calculateAge } from '../utils/helpers';

import {
  Award,
  Calendar,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Activity,
  Zap,
  Brain,
  Shield,
  BarChart2,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Target,
  Sliders,
  History,
  Info,
  Check,
  ChevronRight,
  Flame,
  Radio,
  Edit3,
  LayoutGrid
} from 'lucide-react';

import { CategoryAssessmentModal } from './EvaluationSection';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';

import {
  TENNIS_AGE_LEVELS,
  TENNIS_CORE_CATEGORIES,
  TENNIS_EVENT_TYPES,
  TENNIS_PLAYING_STYLES,
  TENNIS_EMPHASIS_SYNC_MAP,
  TENNIS10S_OBSERVATIONS,
  getTennisLevelConfig,
  detectTennisLevelFromAge,
  getFilteredTennisIndicators,
  getTennisEventConfig,
  getAvailableTennisEventsForTier,
  getTennisStyleConfig,
  getTennisGradeInfo
} from '../config/tennisAssessmentData';

export default function TennisAssessmentView({
  selectedClass,
  students = [],
  tenantId,
  activeAcademy,
  history = [],
  loadingHistory = false,
  filterStudentId,
  setFilterStudentId,
  onDeleteEvaluation,
  onEvaluationSaved
}) {
  // 1. STATE SELEKSI SISWA & TANGGAL
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().split('T')[0]);

  const selectedStudent = useMemo(() => {
    if (students.length === 0) return null;
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  // Sync selectedStudentId with initial student
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  // 2. DETEKSI USIA & LEVEL TENIS (7 JENJANG RESMI ITF TENNIS10s & PELTI/ITF JUNIORS)
  const [overrideTennisLevel, setOverrideTennisLevel] = useState('AUTO');

  // Sinkronisasi otomatis level tenis dengan kelompok umur (tier) kelas terpilih
  useEffect(() => {
    if (selectedClass?.tierCode && selectedClass.tierCode !== 'ALL_AGE') {
      const isKnown = TENNIS_AGE_LEVELS.some((l) => l.code === selectedClass.tierCode);
      if (isKnown) {
        setOverrideTennisLevel(selectedClass.tierCode);
      }
    } else if (selectedClass?.minAge || selectedClass?.maxAge) {
      const midAge = Math.round(((selectedClass.minAge || 6) + (selectedClass.maxAge || 12)) / 2);
      const level = detectTennisLevelFromAge(midAge);
      if (level?.code) {
        setOverrideTennisLevel(level.code);
      }
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
    return 12;
  }, [selectedStudent]);

  const detectedTennisLevel = useMemo(() => {
    return detectTennisLevelFromAge(studentAge);
  }, [studentAge]);

  const activeTennisLevel = useMemo(() => {
    if (overrideTennisLevel && overrideTennisLevel !== 'AUTO') {
      return getTennisLevelConfig(overrideTennisLevel);
    }
    return detectedTennisLevel;
  }, [overrideTennisLevel, detectedTennisLevel]);

  // 3. NOMOR PERTANDINGAN (SESUAI DENGAN JENJANG TIER: T10_EXPLORE untuk U-10, MS/WS/MD/WD/XD)
  const availableEvents = useMemo(() => {
    return getAvailableTennisEventsForTier(activeTennisLevel.code);
  }, [activeTennisLevel.code]);

  const isTennis10sTier = activeTennisLevel.tierGroup === 'TENNIS10S';
  const isRedOrOrangeTier = activeTennisLevel.code === 'T10_RED' || activeTennisLevel.code === 'T10_ORANGE';

  const [eventCode, setEventCode] = useState(() => {
    return activeTennisLevel.tierGroup === 'TENNIS10S' ? 'T10_EXPLORE' : 'MS';
  });

  // Sinkronkan eventCode jika tidak valid di jenjang usia aktif (Kunci T10_RED & T10_ORANGE ke T10_EXPLORE)
  useEffect(() => {
    if (isRedOrOrangeTier && eventCode !== 'T10_EXPLORE') {
      setEventCode('T10_EXPLORE');
    } else if (availableEvents.length > 0 && !availableEvents.some((e) => e.code === eventCode)) {
      setEventCode(availableEvents[0].code);
    }
  }, [availableEvents, eventCode, isRedOrOrangeTier]);

  const activeEvent = useMemo(() => getTennisEventConfig(eventCode), [eventCode]);
  const isDoubles = activeEvent.isDoubles;

  // Indikator aktif per kategori yang disaring berdasarkan jenjang usia kurikulum
  const activeIndicatorsByCategory = useMemo(() => {
    return {
      fisik: getFilteredTennisIndicators('fisik', activeTennisLevel.code),
      teknik: getFilteredTennisIndicators('teknik', activeTennisLevel.code),
      taktik: getFilteredTennisIndicators('taktik', activeTennisLevel.code),
      mental: getFilteredTennisIndicators('mental', activeTennisLevel.code),
      komunikasi: getFilteredTennisIndicators('komunikasi', activeTennisLevel.code),
      perkembangan: getFilteredTennisIndicators('perkembangan', activeTennisLevel.code)
    };
  }, [activeTennisLevel.code]);

  // Toggle Komunikasi untuk Nomor Tunggal (Default: False untuk MS/WS/T10_EXPLORE, True untuk MD/WD/XD)
  const [includeCommunicationInSingles, setIncludeCommunicationInSingles] = useState(false);

  // Observasi Fundamental Tennis10s (Khusus Tier 1A, 1B, 1C - Non-skor sesuai LTAD/ITF Tennis10s)
  const [dominantHandAndBackhand, setDominantHandAndBackhand] = useState('Kanan - Backhand 2 Tangan');
  const [gripAdaptation, setGripAdaptation] = useState('Tahap Pengenalan Grip');
  const [rallyReadinessAndTransition, setRallyReadinessAndTransition] = useState('Tahap Kontrol Pantulan Dasar');

  // 4. PROFIL GAYA BERMAIN (OBSERVASI PELATIH - NON-SKOR UNTUK PELTI KU-12 KE ATAS)
  const [primaryStyleCode, setPrimaryStyleCode] = useState('STY01');
  const [secondaryStyleCodes, setSecondaryStyleCodes] = useState(['STY03']);

  const primaryStyle = useMemo(() => getTennisStyleConfig(primaryStyleCode), [primaryStyleCode]);

  const handleToggleSecondaryStyle = (code) => {
    if (code === primaryStyleCode) return; // Tidak boleh sama dengan gaya utama
    setSecondaryStyleCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  // 5. ATURAN ANTI-DUPLIKASI: TOGGLE MODE SINKRONISASI INDIKATOR UMUM
  const [syncEmphasisWithCore, setSyncEmphasisWithCore] = useState(true);

  // 6. SCORES STATE { [indicatorName]: number (0-100) }
  const [scores, setScores] = useState({});
  const [coachNote, setCoachNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Memoized latest evaluation doc for current student in Tennis
  const latestEvalDoc = useMemo(() => {
    if (!selectedStudent?.id || !history || history.length === 0) return null;
    const studentHistory = history.filter((h) => h.studentId === selectedStudent.id);
    if (studentHistory.length === 0) return null;
    studentHistory.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    return studentHistory[0];
  }, [selectedStudent?.id, history]);

  // Tab aktif (fisik, teknik, taktik, mental, komunikasi, perkembangan, khususNomor)
  const [activeTab, setActiveTab] = useState('fisik');
  const [showAllAtOnce, setShowAllAtOnce] = useState(false);
  const [showAllInline, setShowAllInline] = useState(false);

  // Modal Penilaian Indikator (Focus Drawer)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalCategoryKey, setActiveModalCategoryKey] = useState('fisik');

  // Reset / Load history data saat siswa berganti
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
      setCoachNote(latestEvalDoc.notes || latestEvalDoc.coachNote || '');
      setEventCode(latestEvalDoc.eventCode || latestEvalDoc.playerRole || (isTennis10sTier ? 'T10_EXPLORE' : 'MS'));
      setPrimaryStyleCode(latestEvalDoc.primaryStyleCode || latestEvalDoc.styleCode || 'STY01');
      setSecondaryStyleCodes(latestEvalDoc.secondaryStyleCodes || ['STY03']);
      setIncludeCommunicationInSingles(Boolean(latestEvalDoc.includeCommunicationInSingles));
      setDominantHandAndBackhand(latestEvalDoc.dominantHandAndBackhand || 'Kanan - Backhand 2 Tangan');
      setGripAdaptation(latestEvalDoc.gripAdaptation || 'Tahap Pengenalan Grip');
      setRallyReadinessAndTransition(latestEvalDoc.rallyReadinessAndTransition || 'Tahap Kontrol Pantulan Dasar');
    } else {
      setScores({});
      setCoachNote('');
      setEventCode(isTennis10sTier ? 'T10_EXPLORE' : 'MS');
      setPrimaryStyleCode('STY01');
      setSecondaryStyleCodes(['STY03']);
      setIncludeCommunicationInSingles(false);
      setDominantHandAndBackhand('Kanan - Backhand 2 Tangan');
      setGripAdaptation('Tahap Pengenalan Grip');
      setRallyReadinessAndTransition('Tahap Kontrol Pantulan Dasar');
    }
  }, [selectedStudent?.id, latestEvalDoc?.id, isTennis10sTier]);

  // Sinkronisasi otomatis saat nilai skor berubah
  const handleScoreChange = (indicatorName, value) => {
    const clamped = Math.min(100, Math.max(0, parseInt(value, 10) || 0));
    setScores((prev) => {
      const updated = { ...prev, [indicatorName]: clamped };

      // Jika sinkronisasi aktif, sinkronkan antara penekanan nomor & indikator umum
      if (syncEmphasisWithCore) {
        // Cek apakah indicatorName adalah item penekanan yang punya padanan umum
        const mappedCore = TENNIS_EMPHASIS_SYNC_MAP[indicatorName];
        if (mappedCore) {
          updated[mappedCore] = clamped;
        }

        // Cek kebalikannya: apakah indicatorName adalah indikator umum yang dipetakan oleh penekanan nomor aktif
        Object.entries(TENNIS_EMPHASIS_SYNC_MAP).forEach(([emphasisKey, coreKey]) => {
          if (coreKey === indicatorName && activeEvent.indicators.includes(emphasisKey)) {
            updated[emphasisKey] = clamped;
          }
        });
      }

      return updated;
    });
  };

  const handleAdjustDelta = (indicatorName, delta) => {
    const current = scores[indicatorName] !== undefined ? scores[indicatorName] : 0;
    handleScoreChange(indicatorName, current + delta);
  };

  // 7. PRESET NILAI CEPAT (4 TOMBOL: RESET=0, STANDARD=50, GOOD=75, ELITE=90)
  const handleApplyPreset = (presetScore) => {
    const allActiveIndicators = [
      ...activeIndicatorsByCategory.fisik,
      ...activeIndicatorsByCategory.teknik,
      ...activeIndicatorsByCategory.taktik,
      ...activeIndicatorsByCategory.mental,
      ...activeIndicatorsByCategory.komunikasi,
      ...activeIndicatorsByCategory.perkembangan,
      ...activeEvent.indicators
    ];

    const newScores = {};
    allActiveIndicators.forEach((ind) => {
      newScores[ind] = presetScore;
    });
    setScores(newScores);
    setSuccessMsg(`Preset nilai ${presetScore} berhasil diterapkan ke seluruh indikator aktif (${allActiveIndicators.length} item)!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // 8. LOGIKA PERHITUNGAN RATA-RATA SKOR (ANTI-DUPLIKASI & PEMBAGI SESUAI INDIKATOR AKTIF)
  const categoryScores = useMemo(() => {
    const calcCategoryAvg = (indicatorList) => {
      if (!indicatorList || indicatorList.length === 0) return 0;
      const sum = indicatorList.reduce((acc, ind) => {
        const val = scores[ind] !== undefined ? scores[ind] : 0;
        return acc + val;
      }, 0);
      return Math.round(sum / indicatorList.length);
    };

    const fisik = calcCategoryAvg(activeIndicatorsByCategory.fisik);
    const teknik = calcCategoryAvg(activeIndicatorsByCategory.teknik);
    const taktik = calcCategoryAvg(activeIndicatorsByCategory.taktik);
    const mental = calcCategoryAvg(activeIndicatorsByCategory.mental);
    const komunikasi = calcCategoryAvg(activeIndicatorsByCategory.komunikasi);
    const perkembangan = calcCategoryAvg(activeIndicatorsByCategory.perkembangan);
    const penekananNomor = calcCategoryAvg(activeEvent.indicators);

    // Kategori komunikasi dihitung jika ganda (MD/WD/XD) ATAU jika toggle opsi komunikasi diaktifkan di nomor tunggal
    const includeKomunikasi = isDoubles || includeCommunicationInSingles;

    let overall = 0;
    if (includeKomunikasi) {
      overall = Math.round((fisik + teknik + taktik + mental + komunikasi + perkembangan) / 6);
    } else {
      overall = Math.round((fisik + teknik + taktik + mental + perkembangan) / 5);
    }

    return {
      fisik,
      teknik,
      taktik,
      mental,
      komunikasi,
      perkembangan,
      penekananNomor,
      includeKomunikasi,
      overall
    };
  }, [scores, activeIndicatorsByCategory, activeEvent, isDoubles, includeCommunicationInSingles]);

  const gradeInfo = useMemo(() => {
    return getTennisGradeInfo(categoryScores.overall);
  }, [categoryScores.overall]);

  // Data Poligon Radar Recharts
  const radarData = useMemo(() => {
    const data = [
      { subject: 'Fisik', A: categoryScores.fisik, fullMark: 100 },
      { subject: 'Teknik', A: categoryScores.teknik, fullMark: 100 },
      { subject: 'Taktik', A: categoryScores.taktik, fullMark: 100 },
      { subject: 'Mental', A: categoryScores.mental, fullMark: 100 },
      { subject: 'Perkembangan', A: categoryScores.perkembangan, fullMark: 100 }
    ];

    if (categoryScores.includeKomunikasi) {
      data.push({ subject: 'Komunikasi', A: categoryScores.komunikasi, fullMark: 100 });
    }

    data.push({ subject: 'Penekanan Nomor', A: categoryScores.penekananNomor, fullMark: 100 });
    return data;
  }, [categoryScores]);

  // 8.1. LIST KATEGORI TERSTRUKTUR UNTUK KARTU INTERAKTIF & MODAL PENILAIAN
  const tennisCategoryList = useMemo(() => {
    const list = [
      {
        key: 'fisik',
        label: '1. Kondisi Fisik',
        shortLabel: 'Fisik',
        count: activeIndicatorsByCategory.fisik.length,
        score: categoryScores.fisik,
        indicators: activeIndicatorsByCategory.fisik
      },
      {
        key: 'teknik',
        label: '2. Kemampuan Teknik',
        shortLabel: 'Teknik',
        count: activeIndicatorsByCategory.teknik.length,
        score: categoryScores.teknik,
        indicators: activeIndicatorsByCategory.teknik
      },
      {
        key: 'taktik',
        label: '3. Pemahaman Taktik',
        shortLabel: 'Taktik',
        count: activeIndicatorsByCategory.taktik.length,
        score: categoryScores.taktik,
        indicators: activeIndicatorsByCategory.taktik
      },
      {
        key: 'mental',
        label: '4. Mentalitas & Karakter',
        shortLabel: 'Mental',
        count: activeIndicatorsByCategory.mental.length,
        score: categoryScores.mental,
        indicators: activeIndicatorsByCategory.mental
      },
      {
        key: 'perkembangan',
        label: '5. Perkembangan & Biomekanik',
        shortLabel: 'Perkembangan',
        count: activeIndicatorsByCategory.perkembangan.length,
        score: categoryScores.perkembangan,
        indicators: activeIndicatorsByCategory.perkembangan
      }
    ];

    if (categoryScores.includeKomunikasi) {
      list.push({
        key: 'komunikasi',
        label: '6. Komunikasi & Kerjasama Lapangan',
        shortLabel: 'Komunikasi',
        count: activeIndicatorsByCategory.komunikasi.length,
        score: categoryScores.komunikasi,
        indicators: activeIndicatorsByCategory.komunikasi
      });
    }

    list.push({
      key: 'khususNomor',
      label: `7. Khusus Nomor Pertandingan (${activeEvent.shortName || activeEvent.name || 'Nomor'})`,
      shortLabel: 'Khusus Nomor',
      count: activeEvent.indicators.length,
      score: categoryScores.penekananNomor,
      indicators: activeEvent.indicators,
      isSpecial: true
    });

    return list;
  }, [activeIndicatorsByCategory, activeEvent, categoryScores]);

  const handleSetCategoryPreset = (catKey, presetScore) => {
    const catObj = tennisCategoryList.find((c) => c.key === catKey);
    if (!catObj || !catObj.indicators) return;

    setScores((prev) => {
      const updated = { ...prev };
      catObj.indicators.forEach((ind) => {
        updated[ind] = presetScore;
      });
      return updated;
    });
  };

  // 9. SIMPAN EVALUASI KE FIRESTORE
  const handleSaveAssessment = async (e) => {
    if (e) e.preventDefault();
    if (!selectedStudent?.id || !tenantId) return;

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        tenantId,
        academyId: activeAcademy?.id || selectedClass?.academyId || '',
        classId: selectedClass?.id || '',
        studentId: selectedStudent.id,
        studentName: selectedStudent.studentName || selectedStudent.name || 'Atlet Tenis',
        date: evaluationDate,
        sport: 'Tenis',
        tennisLevel: activeTennisLevel.code,
        tennisLevelName: activeTennisLevel.name,
        eventCode,
        eventName: activeEvent.name,
        isDoubles,
        includeCommunicationInSingles,
        // Observasi Fundamental Tennis10s (Non-Skor)
        dominantHandAndBackhand: isTennis10sTier ? dominantHandAndBackhand : (latestEvalDoc?.dominantHandAndBackhand || null),
        gripAdaptation: isTennis10sTier ? gripAdaptation : (latestEvalDoc?.gripAdaptation || null),
        rallyReadinessAndTransition: isTennis10sTier ? rallyReadinessAndTransition : (latestEvalDoc?.rallyReadinessAndTransition || null),
        // Profil Gaya Bermain (Khusus PELTI KU-12 Ke Atas)
        primaryStyleCode: isTennis10sTier ? null : primaryStyleCode,
        primaryStyleName: isTennis10sTier ? null : primaryStyle.name,
        secondaryStyleCodes: isTennis10sTier ? [] : secondaryStyleCodes,
        scores,
        categoryScores: {
          fisik: categoryScores.fisik,
          teknik: categoryScores.teknik,
          taktik: categoryScores.taktik,
          mental: categoryScores.mental,
          komunikasi: categoryScores.komunikasi,
          perkembangan: categoryScores.perkembangan,
          penekananNomor: categoryScores.penekananNomor,
          overall: categoryScores.overall
        },
        gradeLabel: gradeInfo.label,
        notes: coachNote.trim(),
        coachNote: coachNote.trim(),
        evaluator: 'Pelatih Tenis'
      };

      const savedEval = await supabaseAcademyService.createEvaluation(payload);
      setLatestEvalDoc(savedEval);
      setSuccessMsg(`Evaluasi Tenis untuk ${payload.studentName} berhasil disimpan!`);

      if (onEvaluationSaved) onEvaluationSaved(savedEval);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error saving tennis assessment to Supabase:', err);
      setErrorMsg('Gagal menyimpan evaluasi tenis. Silakan periksa koneksi data.');
    } finally {
      setIsSaving(false);
    }
  };

  // Navigasi cepat atlet
  const currentStudentIndex = students.findIndex((s) => s.id === selectedStudent?.id);
  const handleNextStudent = () => {
    if (students.length > 0 && currentStudentIndex < students.length - 1) {
      setSelectedStudentId(students[currentStudentIndex + 1].id);
    }
  };
  const handlePrevStudent = () => {
    if (students.length > 0 && currentStudentIndex > 0) {
      setSelectedStudentId(students[currentStudentIndex - 1].id);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn text-left text-slate-800 dark:text-slate-100">
      
      {/* =================================================================== */}
      {/* 1. BAR KONTROL ATAS SEJAJAR (3 KOLOM) + BADGE TENIS                 */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Title & Sport Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 font-black shrink-0">
              🎾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Athlete Development Assessment
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                  Tenis
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kurikulum komprehensif 6 pilar performa, penekanan 5 nomor resmi &amp; observasi 10 gaya bermain
              </p>
            </div>
          </div>

          {/* Quick Athlete Stepper */}
          {students.length > 1 && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-700/70">
              <button
                type="button"
                onClick={handlePrevStudent}
                disabled={currentStudentIndex <= 0}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all"
              >
                &larr; Prev
              </button>
              <span className="text-[11px] font-mono text-slate-400 px-1 font-semibold">
                {currentStudentIndex + 1} / {students.length}
              </span>
              <button
                type="button"
                onClick={handleNextStudent}
                disabled={currentStudentIndex >= students.length - 1}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>

        {/* 3 Kolom Sejajar: PILIH ATLET, TANGGAL EVALUASI, JENJANG EVALUASI */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          {/* KOLOM 1: PILIH ATLET */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap h-5">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Pilih Atlet ({students.length})</span>
            </label>
            <select
              value={selectedStudent?.id || ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="h-10 w-full px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {st.studentName || st.name} ({calculateAge(st.birthDate) !== '-' ? `${calculateAge(st.birthDate)} Thn` : 'Usia N/A'})
                </option>
              ))}
              {students.length === 0 && (
                <option value="">Belum ada atlet terdaftar di kelas</option>
              )}
            </select>
          </div>

          {/* KOLOM 2: TANGGAL EVALUASI */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap h-5">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Tanggal Evaluasi</span>
            </label>
            <input
              type="date"
              value={evaluationDate}
              onChange={(e) => setEvaluationDate(e.target.value)}
              className="h-10 w-full px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            />
          </div>

          {/* KOLOM 3: JENJANG EVALUASI (ITF / PELTI) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap h-5">
              <Target className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Jenjang Evaluasi Tenis</span>
            </label>
            <select
              value={overrideTennisLevel}
              onChange={(e) => setOverrideTennisLevel(e.target.value)}
              className="h-10 w-full px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
            >
              <option value="AUTO" className="bg-white dark:bg-slate-900 font-bold">
                Otomatis: {detectedTennisLevel.tierLabel} ({studentAge !== '-' ? `${studentAge} Thn` : 'Usia N/A'})
              </option>
              <optgroup label="A. Fase ITF Tennis10s (< 10 Tahun - Bola Modifikasi)">
                {TENNIS_AGE_LEVELS.filter((lvl) => lvl.tierGroup === 'TENNIS10S').map((lvl) => (
                  <option key={lvl.code} value={lvl.code} className="bg-white dark:bg-slate-900">
                    {lvl.tierLabel} • {lvl.name} ({lvl.ageRange})
                  </option>
                ))}
              </optgroup>
              <optgroup label="B. Fase TDP PELTI & ITF Juniors (Lapangan Penuh & Bola Kuning)">
                {TENNIS_AGE_LEVELS.filter((lvl) => lvl.tierGroup === 'PELTI_ITF').map((lvl) => (
                  <option key={lvl.code} value={lvl.code} className="bg-white dark:bg-slate-900">
                    {lvl.tierLabel} • {lvl.name} ({lvl.ageRange})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

        </div>

        {/* =================================================================== */}
        {/* PANEL SPESIFIKASI JENJANG TENIS (ITF TENNIS10s & PELTI SPEC BANNER) */}
        {/* =================================================================== */}
        <div className={`rounded-2xl p-4 border transition-all mt-4 ${activeTennisLevel.badgeClass}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-current/20">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-2xs ${activeTennisLevel.ballBadge}`}>
                {activeTennisLevel.tierLabel}
              </span>
              <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                {activeTennisLevel.name}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                ({activeTennisLevel.ageRange})
              </span>
            </div>

            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white/70 dark:bg-slate-900/70 border border-current/20 text-slate-800 dark:text-slate-200">
              Total Indikator Aktif: {
                activeIndicatorsByCategory.fisik.length +
                activeIndicatorsByCategory.teknik.length +
                activeIndicatorsByCategory.taktik.length +
                activeIndicatorsByCategory.mental.length +
                (categoryScores.includeKomunikasi ? activeIndicatorsByCategory.komunikasi.length : 0) +
                activeIndicatorsByCategory.perkembangan.length
              } Item
            </span>
          </div>

          {/* 4 Chip Spesifikasi Ringkas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3">
            <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-current/15 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                📏 Ukuran Lapangan
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {activeTennisLevel.courtSize}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-current/15 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                🎾 Spesifikasi Bola
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {activeTennisLevel.ballType}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-current/15 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                🏸 Rekomendasi Raket
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {activeTennisLevel.racketLength}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-current/15 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                🎯 Fokus Kurikulum
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2" title={activeTennisLevel.focus}>
                {activeTennisLevel.focus}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* =================================================================== */}
      {/* 2. GRID 2 KOLOM SEIMBANG: RADAR KIRI & KONFIGURASI KANAN            */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* KOLOM KIRI (5 COLS): KARTU GELAP SCOUTING RADAR */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-100 tracking-tight">
                  Scouting Radar Poligon
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60 font-bold">
                {activeEvent.code} &bull; {categoryScores.overall}/100
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Visualisasi keseimbangan 6 pilar performa atlet tenis terhadap penekanan nomor pertandingan.
            </p>
          </div>

          {/* RECHARTS RADAR CHART */}
          <div className="h-64 sm:h-72 w-full flex items-center justify-center my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  stroke="#475569" 
                  tick={{ fill: '#64748b', fontSize: 9 }} 
                />
                <Radar
                  name="Skor Atlet"
                  dataKey="A"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.45}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Fokus: <strong className="text-slate-200">{activeEvent.label}</strong></span>
            <span>Level: <strong className="text-emerald-400">{activeTennisLevel.name}</strong></span>
          </div>
        </div>

        {/* KOLOM KANAN (7 COLS): KONFIGURASI NOMOR & PROFIL GAYA BERMAIN */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
          
          {/* BANNER REALTIME OVERALL SKOR & PREDIKAT */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-0.5">
                Skor Realtime Atlet Tenis
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                  {categoryScores.overall}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 100 PTS</span>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5">
              <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide border shadow-2xs ${gradeInfo.badgeClass}`}>
                {gradeInfo.label}
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {isDoubles ? 'Formula Ganda (6 Pilar)' : categoryScores.includeKomunikasi ? 'Formula Tunggal + Komunikasi' : 'Formula Tunggal (5 Pilar Inti)'}
              </span>
            </div>
          </div>

          {/* 1. PEMILIH NOMOR PERTANDINGAN (SESUAI TIER) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>1. Nomor Pertandingan Resmi</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                {activeEvent.name} ({activeEvent.indicators.length} Indikator Penekanan)
              </span>
            </div>

            {isRedOrOrangeTier ? (
              /* Kunci Khusus Tier 1A & 1B (Red & Orange Ball) */
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs shrink-0">
                    T10_EXPLORE
                  </span>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                      Eksplorasi Tennis10s (Mini-Match)
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                      Fokus reli santai, kegembiraan bermain, &amp; sportivitas motorik anak
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Tier 1C (T10_EXPLORE, MS, WS) atau PELTI KU-12+ (MS, WS, MD, WD, XD) */
              <div className="flex flex-wrap gap-2 w-full">
                {availableEvents.map((ev) => {
                  const isActive = eventCode === ev.code;
                  return (
                    <button
                      key={ev.code}
                      type="button"
                      onClick={() => setEventCode(ev.code)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[70px] ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <span>{ev.code}</span>
                      <span className="text-[9px] font-medium opacity-80 whitespace-nowrap">
                        {ev.isExplore ? 'Tennis10s' : ev.isDoubles ? 'Ganda' : 'Tunggal'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Toggle Komunikasi untuk Nomor Tunggal - Sembunyikan pada Red & Orange Ball */}
            {!isRedOrOrangeTier && !isDoubles && eventCode !== 'T10_EXPLORE' && (
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs mt-1">
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    Kategori Komunikasi dinonaktifkan di nomor tunggal agar nilai 0 tidak mengurangi rata-rata.
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={includeCommunicationInSingles}
                    onChange={(e) => setIncludeCommunicationInSingles(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Aktifkan</span>
                </label>
              </div>
            )}
          </div>

          {/* 2. OBSERVASI FUNDAMENTAL TENNIS10S (TIER 1A/1B/1C) VS PROFIL GAYA BERMAIN (PELTI KU-12+) */}
          {isTennis10sTier ? (
            /* ========================================================= */
            /* A. OBSERVASI FUNDAMENTAL TENNIS10S (TIER RED, ORANGE, GREEN) */
            /* ========================================================= */
            <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-slate-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-slate-800/40 border border-emerald-200/80 dark:border-emerald-800/60">
              <div className="flex items-center gap-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  2. Observasi Fundamental Tennis10s (Non-Skor)
                </label>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Pedoman LTAD &amp; ITF Tennis10s: Usia di bawah 10 tahun berfokus pada adaptasi koordinasi motorik, eksplorasi reli kooperatif, dan pembiasaan grip tanpa spesialisasi gaya bermain dini.
              </p>

              {/* 3 Dropdown Observasi Fundamental disusun sejajar vertikal yang luas & rapi */}
              <div className="grid grid-cols-1 gap-2.5 pt-1">
                {/* 1. Tangan Dominan & Backhand */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200/60 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-300 shrink-0 sm:w-5/12 tracking-wider">
                    1. {TENNIS10S_OBSERVATIONS.dominantHandAndBackhand.label}
                  </span>
                  <select
                    value={dominantHandAndBackhand}
                    onChange={(e) => setDominantHandAndBackhand(e.target.value)}
                    className="w-full sm:w-7/12 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                  >
                    {TENNIS10S_OBSERVATIONS.dominantHandAndBackhand.options.map((opt) => (
                      <option key={opt} value={opt} className="bg-white dark:bg-slate-900">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Adaptasi Grip Dasar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200/60 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-300 shrink-0 sm:w-5/12 tracking-wider">
                    2. {TENNIS10S_OBSERVATIONS.gripAdaptation.label}
                  </span>
                  <select
                    value={gripAdaptation}
                    onChange={(e) => setGripAdaptation(e.target.value)}
                    className="w-full sm:w-7/12 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                  >
                    {TENNIS10S_OBSERVATIONS.gripAdaptation.options.map((opt) => (
                      <option key={opt} value={opt} className="bg-white dark:bg-slate-900">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Kesiapan Reli & Transisi Bola */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200/60 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-300 shrink-0 sm:w-5/12 tracking-wider">
                    3. {TENNIS10S_OBSERVATIONS.rallyReadinessAndTransition.label}
                  </span>
                  <select
                    value={rallyReadinessAndTransition}
                    onChange={(e) => setRallyReadinessAndTransition(e.target.value)}
                    className="w-full sm:w-7/12 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                  >
                    {TENNIS10S_OBSERVATIONS.rallyReadinessAndTransition.options.map((opt) => (
                      <option key={opt} value={opt} className="bg-white dark:bg-slate-900">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* B. PROFIL GAYA BERMAIN (PELTI KU-12, KU-14, KU-16, KU-18) */
            /* ========================================================= */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>2. Profil Gaya Bermain (Observasi Pelatih)</span>
                </label>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                  Non-Skor
                </span>
              </div>

              {/* Gaya Utama (Single select) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Gaya Utama (Pilih 1):</span>
                  <select
                    value={primaryStyleCode}
                    onChange={(e) => setPrimaryStyleCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {TENNIS_PLAYING_STYLES.map((st) => (
                      <option key={st.code} value={st.code} className="bg-white dark:bg-slate-900">
                        {st.name} — {st.tagline}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-[11px] flex flex-col justify-between">
                  <div>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{primaryStyle.name}</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{primaryStyle.desc}</p>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    Pro: {primaryStyle.proExample}
                  </span>
                </div>
              </div>

              {/* Atribut Pendukung (Multi-select chip tags) */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Atribut Pendukung (Multi-Pilih):</span>
                <div className="flex flex-wrap gap-1.5">
                  {TENNIS_PLAYING_STYLES.map((st) => {
                    if (st.code === primaryStyleCode) return null;
                    const isSelected = secondaryStyleCodes.includes(st.code);
                    return (
                      <button
                        key={st.code}
                        type="button"
                        onClick={() => handleToggleSecondaryStyle(st.code)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />}
                        <span>{st.shortName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. PRESET NILAI CEPAT (4 TOMBOL SAJA: RESET=0, STANDARD=50, GOOD=75, ELITE=90) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Preset Nilai Cepat Seluruh Indikator
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleApplyPreset(0)}
                className="py-2 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset (0)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(50)}
                className="py-2 px-2.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-blue-200 dark:border-blue-800/60 flex items-center justify-center gap-1.5"
              >
                <span>Standard (50)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(75)}
                className="py-2 px-2.5 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-center gap-1.5"
              >
                <span>Good (75)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(90)}
                className="py-2 px-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5 text-emerald-500" />
                <span>Elite (90)</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* =================================================================== */}
      {/* 3. KARTU RINGKASAN SKOR KATEGORI TERPISAH (W-FULL GRID 1/2/3 COLS)  */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ringkasan Skor Kategori Performa</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik kartu kategori mana saja atau tombol &quot;Edit / Input Penilaian&quot; untuk mengisi indikator
            </p>
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
              Rata-Rata: <strong className="text-slate-900 dark:text-slate-100 font-black">{categoryScores.overall} / 100</strong>
            </span>

            <button
              type="button"
              onClick={() => {
                setActiveModalCategoryKey(tennisCategoryList[0]?.key);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] rounded-xl font-bold text-xs shadow-sm shadow-[#354944]/20 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#C89D32]" />
              <span>✎ Edit / Input Penilaian</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAllInline(!showAllInline)}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showAllInline
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{showAllInline ? 'Sembunyikan List' : 'Buka Semua di Halaman'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Category Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tennisCategoryList.map((cat) => (
            <div
              key={cat.key}
              onClick={() => {
                setActiveModalCategoryKey(cat.key);
                setIsModalOpen(true);
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 relative group shadow-2xs ${
                cat.isSpecial
                  ? 'bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/40 border-emerald-200 dark:border-emerald-800/80 hover:border-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200/70 dark:border-slate-800 hover:border-[#354944] hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 block leading-snug">
                    {cat.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[#354944] dark:text-[#C89D32] inline-block">
                    {cat.count} Indikator
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-xl font-black font-mono ${cat.isSpecial ? 'text-[#C89D32]' : 'text-[#354944] dark:text-emerald-400'}`}>
                    {cat.score}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block">/ 100</span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      cat.isSpecial ? 'bg-[#C89D32]' : 'bg-[#354944]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, cat.score || 0))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* =================================================================== */}
      {/* 4. TAB NAVIGASI KATEGORI INDIKATOR (SEMBUNYI BY DEFAULT)            */}
      {/* =================================================================== */}
      {showAllInline && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          
          {/* Navigation Tabs Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none">
              
              {/* Tab 1: Fisik */}
              <button
                type="button"
                onClick={() => setActiveTab('fisik')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'fisik' && !showAllAtOnce
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Fisik ({activeIndicatorsByCategory.fisik.length})</span>
              </button>

              {/* Tab 2: Teknik */}
              <button
                type="button"
                onClick={() => setActiveTab('teknik')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'teknik' && !showAllAtOnce
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Teknik ({activeIndicatorsByCategory.teknik.length})</span>
              </button>

              {/* Tab 3: Taktik */}
              <button
                type="button"
                onClick={() => setActiveTab('taktik')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'taktik' && !showAllAtOnce
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Taktik ({activeIndicatorsByCategory.taktik.length})</span>
              </button>

              {/* Tab 4: Mental */}
              <button
                type="button"
                onClick={() => setActiveTab('mental')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'mental' && !showAllAtOnce
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Mental ({activeIndicatorsByCategory.mental.length})</span>
              </button>

              {/* Tab 5: Komunikasi (Ganda) */}
              <button
                type="button"
                onClick={() => setActiveTab('komunikasi')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'komunikasi' && !showAllAtOnce
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Komunikasi ({activeIndicatorsByCategory.komunikasi.length})</span>
                {isDoubles && (
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />
                )}
              </button>

              {/* Tab 6: Perkembangan */}
              <button
                type="button"
                onClick={() => setActiveTab('perkembangan')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'perkembangan' && !showAllAtOnce
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Perkembangan ({activeIndicatorsByCategory.perkembangan.length})</span>
              </button>

              {/* Tab 7: Khusus Nomor */}
              <button
                type="button"
                onClick={() => setActiveTab('khususNomor')}
                className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                  activeTab === 'khususNomor' && !showAllAtOnce
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs'
                    : 'text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-emerald-500" />
                <span>Khusus {activeEvent.code} ({activeEvent.indicators.length})</span>
              </button>

            </div>

            {/* Toggle Tampilkan Semua */}
            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 self-end xl:self-auto bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <input
                type="checkbox"
                checked={showAllAtOnce}
                onChange={(e) => setShowAllAtOnce(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Tampilkan Semua Kategori Sekaligus
              </span>
            </label>

          </div>

          {/* FEEDBACK ALERT MESSAGES */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* KONTEN TAB INDIKATOR                                              */}
          {/* ================================================================= */}
          <div className="space-y-6">
            
            {/* RENDER KHUSUS: TAB PENEKANAN NOMOR */}
            {(showAllAtOnce || activeTab === 'khususNomor') && (
              <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/20 dark:from-slate-800/40 dark:via-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Penekanan Khusus Nomor Pertandingan: {activeEvent.label}
                    </h4>
                  </div>

                  {/* Toggle Anti-Duplikasi */}
                  <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-700 text-xs shadow-2xs">
                    <input
                      type="checkbox"
                      checked={syncEmphasisWithCore}
                      onChange={(e) => setSyncEmphasisWithCore(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      Mode Penekanan / Sinkronisasi Indikator Umum (Anti-Duplikasi)
                    </span>
                  </label>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Indikator berikut merupakan fokus spesifik nomor {activeEvent.name}. Saat Mode Sinkronisasi aktif, nilai indikator yang beririsan dengan kurikulum inti (Teknik/Taktik/Komunikasi) otomatis terhubung tanpa menduplikasi pembagi skor total.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 pt-1">
                  {activeEvent.indicators.map((ind) => (
                    <IndicatorCard
                      key={`emp-${ind}`}
                      name={ind}
                      value={scores[ind] !== undefined ? scores[ind] : 0}
                      onChange={(val) => handleScoreChange(ind, val)}
                      onDelta={(delta) => handleAdjustDelta(ind, delta)}
                      mappedCore={syncEmphasisWithCore ? TENNIS_EMPHASIS_SYNC_MAP[ind] : null}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* RENDER KATEGORI FISIK */}
            {(showAllAtOnce || activeTab === 'fisik') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Physical / Fisik ({activeIndicatorsByCategory.fisik.length} Indikator Aktif)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    Rata-Rata: {categoryScores.fisik} / 100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{TENNIS_CORE_CATEGORIES.fisik.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  {activeIndicatorsByCategory.fisik.map((ind) => (
                    <IndicatorCard
                      key={`fisik-${ind}`}
                      name={ind}
                      value={scores[ind] !== undefined ? scores[ind] : 0}
                      onChange={(val) => handleScoreChange(ind, val)}
                      onDelta={(delta) => handleAdjustDelta(ind, delta)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* RENDER KATEGORI TEKNIK */}
            {(showAllAtOnce || activeTab === 'teknik') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Technical / Teknik ({activeIndicatorsByCategory.teknik.length} Indikator Aktif)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Rata-Rata: {categoryScores.teknik} / 100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{TENNIS_CORE_CATEGORIES.teknik.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  {activeIndicatorsByCategory.teknik.map((ind) => (
                    <IndicatorCard
                      key={`teknik-${ind}`}
                      name={ind}
                      value={scores[ind] !== undefined ? scores[ind] : 0}
                      onChange={(val) => handleScoreChange(ind, val)}
                      onDelta={(delta) => handleAdjustDelta(ind, delta)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* RENDER KATEGORI TAKTIK */}
            {(showAllAtOnce || activeTab === 'taktik') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Tactical / Taktik ({activeIndicatorsByCategory.taktik.length} Indikator Aktif)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                    Rata-Rata: {categoryScores.taktik} / 100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{TENNIS_CORE_CATEGORIES.taktik.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  {activeIndicatorsByCategory.taktik.map((ind) => (
                    <IndicatorCard
                      key={`taktik-${ind}`}
                      name={ind}
                      value={scores[ind] !== undefined ? scores[ind] : 0}
                      onChange={(val) => handleScoreChange(ind, val)}
                      onDelta={(delta) => handleAdjustDelta(ind, delta)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* RENDER KATEGORI MENTAL */}
            {(showAllAtOnce || activeTab === 'mental') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Mental / Karakter ({activeIndicatorsByCategory.mental.length} Indikator Aktif)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    Rata-Rata: {categoryScores.mental} / 100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{TENNIS_CORE_CATEGORIES.mental.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  {activeIndicatorsByCategory.mental.map((ind) => (
                    <IndicatorCard
                      key={`mental-${ind}`}
                      name={ind}
                      value={scores[ind] !== undefined ? scores[ind] : 0}
                      onChange={(val) => handleScoreChange(ind, val)}
                      onDelta={(delta) => handleAdjustDelta(ind, delta)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* RENDER KATEGORI KOMUNIKASI */}
            {(showAllAtOnce || activeTab === 'komunikasi') && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-pink-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Communication / Komunikasi ({activeIndicatorsByCategory.komunikasi.length} Indikator Aktif)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-pink-600 dark:text-pink-400">
                    Rata-Rata: {categoryScores.komunikasi} / 100
                  </span>
                </div>

                {/* Informational badge */}
                <div className="p-3 bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800/60 rounded-xl text-xs text-pink-900 dark:text-pink-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Kategori Komunikasi terutama ditujukan untuk nomor ganda (<strong>MD, WD, XD</strong>). Untuk nomor tunggal (<strong>MS, WS</strong>), kategori ini opsional dan tidak membebani rata-rata jika dibiarkan 0.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  {activeIndicatorsByCategory.komunikasi.map((ind) => (
                    <IndicatorCard
                      key={`komunikasi-${ind}`}
                      name={ind}
                      value={scores[ind] !== undefined ? scores[ind] : 0}
                      onChange={(val) => handleScoreChange(ind, val)}
                      onDelta={(delta) => handleAdjustDelta(ind, delta)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* RENDER KATEGORI PERKEMBANGAN */}
            {(showAllAtOnce || activeTab === 'perkembangan') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-teal-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Development / Perkembangan ({activeIndicatorsByCategory.perkembangan.length} Indikator Aktif)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                    Rata-Rata: {categoryScores.perkembangan} / 100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{TENNIS_CORE_CATEGORIES.perkembangan.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  {activeIndicatorsByCategory.perkembangan.map((ind) => (
                    <IndicatorCard
                      key={`perkembangan-${ind}`}
                      name={ind}
                      value={scores[ind] !== undefined ? scores[ind] : 0}
                      onChange={(val) => handleScoreChange(ind, val)}
                      onDelta={(delta) => handleAdjustDelta(ind, delta)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. CATATAN PELATIH & TOMBOL SIMPAN EVALUASI                         */}
      {/* =================================================================== */}
      <form onSubmit={handleSaveAssessment} className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Catatan Khusus Pelatih &amp; Rekomendasi Latihan Tenis</span>
          </label>
          <textarea
            rows={3}
            value={coachNote}
            onChange={(e) => setCoachNote(e.target.value)}
            placeholder="Tuliskan evaluasi tertulis, kelemahan footwork, target akurasi servis, catatan sparring, atau instruksi turnamen berikutnya..."
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Atlet: <strong className="text-slate-800 dark:text-slate-200">{selectedStudent?.studentName || selectedStudent?.name}</strong></span>
            <span>&bull;</span>
            <span>Nomor: <strong className="text-blue-600 dark:text-blue-400">{activeEvent.code}</strong></span>
            <span>&bull;</span>
            <span>Skor: <strong className="text-emerald-600 dark:text-emerald-400">{categoryScores.overall} ({gradeInfo.label})</strong></span>
          </div>

          <button
            type="submit"
            disabled={isSaving || !selectedStudent?.id}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span>Menyimpan Evaluasi...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Simpan Evaluasi Tenis</span>
              </>
            )}
          </button>
        </div>

        {/* MODAL FOKUS PENILAIAN KATEGORI */}
        <CategoryAssessmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          categoryList={tennisCategoryList}
          activeCategoryKey={activeModalCategoryKey}
          setActiveCategoryKey={setActiveModalCategoryKey}
          scores={scores}
          onScoreChange={handleScoreChange}
          onAdjustScore={handleAdjustDelta}
          onSetCategoryPreset={handleSetCategoryPreset}
        />
      </form>

      {/* =================================================================== */}
      {/* 6. RIWAYAT EVALUASI ATLET TENIS (HISTORICAL ASSESSMENTS)           */}
      {/* =================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
              Riwayat Evaluasi Atlet Tenis ({history.filter((h) => h.sport === 'Tenis' || !h.sport).length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Tersimpan di Cloud Database</span>
        </div>

        {history.filter((h) => h.sport === 'Tenis' || !h.sport).length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            Belum ada riwayat evaluasi cabang Tenis yang tersimpan. Klik &quot;Simpan Evaluasi Tenis&quot; di atas untuk mencatat penilaian pertama.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {history
              .filter((h) => h.sport === 'Tenis' || !h.sport)
              .slice(0, 5)
              .map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                        {item.studentName || 'Atlet'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60">
                        {item.eventCode || 'MS'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        📅 {item.date || 'Tanggal N/A'}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                        &quot;{item.notes}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {item.categoryScores?.overall || item.overall || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold block">/ 100</span>
                    </div>
                    {onDeleteEvaluation && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvaluation(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Dokumen Evaluasi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// SUB-KOMPONEN KARTU SLIDER INDIKATOR DENGAN MICRO-STEPPERS
// ---------------------------------------------------------------------
function IndicatorCard({ name, value, onChange, onDelta, mappedCore }) {
  const getBadgeColor = (val) => {
    if (val >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60';
    if (val >= 75) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60';
    if (val >= 50) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60';
    if (val > 0) return 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    return 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800';
  };

  return (
    <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate" title={name}>
            {name}
          </h5>
          {mappedCore && (
            <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              &harr; Terhubung: {mappedCore}
            </span>
          )}
        </div>
        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black font-mono border ${getBadgeColor(value)}`}>
          {value}
        </span>
      </div>

      {/* Range Slider */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500"
        />
      </div>

      {/* Micro-steppers (-5, -1, +1, +5) */}
      <div className="flex items-center justify-end gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => onDelta(-5)}
          className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded cursor-pointer"
        >
          -5
        </button>
        <button
          type="button"
          onClick={() => onDelta(-1)}
          className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded cursor-pointer"
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => onDelta(1)}
          className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded cursor-pointer"
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => onDelta(5)}
          className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded cursor-pointer"
        >
          +5
        </button>
      </div>
    </div>
  );
}
