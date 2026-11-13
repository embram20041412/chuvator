import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Timer,
  Target,
  Repeat,
  Ruler,
  ClipboardCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  UserCheck,
  Activity,
  RotateCcw,
  Award,
  ShieldCheck,
  Rocket,
  Play,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Save,
  X,
  Lock,
  Minus,
  Plus
} from 'lucide-react';
import {
  FOOTBALL_ASSESSMENT_TIERS,
  FOOTBALL_TEST_BENCHMARKS,
  ASSESSMENT_CATEGORIES,
  RUBRIC_ANCHORED_SCORES,
  FOOTBALL_RUBRIC_ANCHORS,
  ATTENDANCE_DEVELOPMENT_INDICATORS,
  calculateAssessmentScore,
  aggregateIndicatorScores,
  getAssessmentClassification,
  computeWizardSessionProgress,
  resolveWizardStepTransition
} from '../utils/footballAssessmentEngine';
import {
  getMasterFootballCatalog,
  saveMasterAssessmentSessionAndSync,
  loadWizardResumeState,
  saveWizardResumeState,
  clearWizardResumeState
} from '../services/scoutingCombineService';

const CATEGORY_STYLES = {
  Fisik: {
    pillActive: 'bg-sky-700 text-white border-sky-700 dark:bg-sky-600 dark:border-sky-500',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    accentBorder: 'border-l-sky-600'
  },
  Teknik: {
    pillActive: 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-600 dark:border-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    accentBorder: 'border-l-emerald-600'
  },
  Taktik: {
    pillActive: 'bg-indigo-700 text-white border-indigo-700 dark:bg-indigo-600 dark:border-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    accentBorder: 'border-l-indigo-600'
  },
  Mental: {
    pillActive: 'bg-amber-600 text-white border-amber-600 dark:bg-amber-500 dark:border-amber-400',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    accentBorder: 'border-l-amber-500'
  },
  Komunikasi: {
    pillActive: 'bg-violet-700 text-white border-violet-700 dark:bg-violet-600 dark:border-violet-500',
    badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
    accentBorder: 'border-l-violet-600'
  },
  'Spesifik Posisi': {
    pillActive: 'bg-rose-700 text-white border-rose-700 dark:bg-rose-600 dark:border-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    accentBorder: 'border-l-rose-600'
  }
};

function getMeasurementTypeMeta(type) {
  switch (type) {
    case 'TIME':
      return { icon: Timer, label: 'Stopwatch / Durasi' };
    case 'ACCURACY':
      return { icon: Target, label: 'Akurasi Target' };
    case 'REPS':
      return { icon: Repeat, label: 'Repetisi' };
    case 'DISTANCE':
      return { icon: Ruler, label: 'Jarak / Lompatan' };
    case 'RUBRIC':
      return { icon: ClipboardCheck, label: 'Rubrik 1–5' };
    default:
      return { icon: Activity, label: type };
  }
}

export default function FootballAssessmentHub({
  tenantId = 'demo-tenant-1',
  evaluatorId = null,
  athletes = [],
  selectedAthleteId = '',
  onSelectAthlete = null,
  selectedTier = 2,
  onSelectTier = null,
  selectedPosition = null,
  existingIndicatorScores = {},
  onSyncedToReport = null,
  isArchived = false
}) {
  const [internalAthleteId, setInternalAthleteId] = useState(selectedAthleteId || athletes[0]?.id || '');
  const [internalTier, setInternalTier] = useState(Number(selectedTier) || 2);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [testingDate, setTestingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [catalogTests, setCatalogTests] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // State nilai mentah per `test_code`: { [test_code]: { raw_value_1, raw_value_2, errors_count } }
  const [inputsByCode, setInputsByCode] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // State Step-by-Step Test Wizard (Focus Mode) & Persistence (Resume State)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [completedTestCodes, setCompletedTestCodes] = useState([]);
  const [skippedTestCodes, setSkippedTestCodes] = useState([]);
  const [savedResumeMeta, setSavedResumeMeta] = useState(null);
  const [wizardFeedback, setWizardFeedback] = useState(null);

  const activeAthleteId = selectedAthleteId || internalAthleteId;
  const activeTier = Number(selectedTier || internalTier) || 2;

  useEffect(() => {
    if (selectedAthleteId) {
      setInternalAthleteId(selectedAthleteId);
    } else if (!internalAthleteId && athletes.length > 0) {
      setInternalAthleteId(athletes[0].id);
    }
  }, [selectedAthleteId, athletes, internalAthleteId]);

  useEffect(() => {
    if (selectedTier) {
      setInternalTier(Number(selectedTier) || 2);
    }
  }, [selectedTier]);

  useEffect(() => {
    let mounted = true;
    async function loadMasterCatalog() {
      setLoadingCatalog(true);
      try {
        const list = await getMasterFootballCatalog({
          tenantId,
          category: 'ALL',
          tier: activeTier,
          positionCode: selectedPosition
        });
        if (mounted) {
          setCatalogTests(list);
        }
      } catch (err) {
        console.error('[FootballAssessmentHub] Gagal memuat Master Test Catalog:', err);
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    }
    loadMasterCatalog();
    return () => {
      mounted = false;
    };
  }, [tenantId, activeTier, selectedPosition]);

  // Pulihkan Resume State (Progres Tes Atlet) dari LocalStorage saat atlet berganti
  useEffect(() => {
    if (!activeAthleteId) {
      setInputsByCode({});
      setCompletedTestCodes([]);
      setSkippedTestCodes([]);
      setWizardStepIndex(0);
      setSavedResumeMeta(null);
      return;
    }

    const resumeData = loadWizardResumeState(tenantId, activeAthleteId);
    if (resumeData && typeof resumeData === 'object') {
      setInputsByCode(resumeData.inputsByCode || {});
      setCompletedTestCodes(Array.isArray(resumeData.completedTestCodes) ? resumeData.completedTestCodes : []);
      setSkippedTestCodes(Array.isArray(resumeData.skippedTestCodes) ? resumeData.skippedTestCodes : []);
      setWizardStepIndex(Math.max(0, Number(resumeData.currentStepIndex) || 0));
      if (resumeData.wizardCategory) {
        setActiveCategory(resumeData.wizardCategory);
      }
      if (resumeData.testingDate) {
        setTestingDate(resumeData.testingDate);
      }
      setSavedResumeMeta(resumeData);
    } else {
      setInputsByCode({});
      setCompletedTestCodes([]);
      setSkippedTestCodes([]);
      setWizardStepIndex(0);
      setSavedResumeMeta(null);
    }
  }, [tenantId, activeAthleteId]);

  const persistResumeSnapshot = (overrides = {}) => {
    if (!activeAthleteId) return null;
    const payload = {
      currentStepIndex: overrides.currentStepIndex ?? wizardStepIndex,
      wizardCategory: overrides.wizardCategory ?? activeCategory,
      testingDate: overrides.testingDate ?? testingDate,
      tier: activeTier,
      inputsByCode: overrides.inputsByCode ?? inputsByCode,
      completedTestCodes: overrides.completedTestCodes ?? completedTestCodes,
      skippedTestCodes: overrides.skippedTestCodes ?? skippedTestCodes,
      status: overrides.status || 'in_progress'
    };
    const saved = saveWizardResumeState(tenantId, activeAthleteId, payload);
    setSavedResumeMeta(saved);
    return saved;
  };

  const handleAthleteChange = (newId) => {
    setInternalAthleteId(newId);
    setFeedback(null);
    setWizardFeedback(null);
    if (typeof onSelectAthlete === 'function') {
      onSelectAthlete(newId);
    }
  };

  const handleTierChange = (newTier) => {
    const parsed = Math.max(1, Math.min(4, Number(newTier) || 2));
    setInternalTier(parsed);
    if (typeof onSelectTier === 'function') {
      onSelectTier(parsed);
    }
  };

  const updateTestInput = (testObj, field, value) => {
    setFeedback(null);
    setWizardFeedback(null);
    setInputsByCode((prev) => {
      const current = prev[testObj.test_code] || {
        raw_value_1: '',
        raw_value_2: testObj.measurement_type === 'ACCURACY' ? String(testObj.defaultTotal || 10) : '',
        errors_count: '0'
      };
      const nextInputs = {
        ...prev,
        [testObj.test_code]: {
          ...current,
          [field]: value
        }
      };
      if (activeAthleteId) {
        const saved = saveWizardResumeState(tenantId, activeAthleteId, {
          currentStepIndex: wizardStepIndex,
          wizardCategory: activeCategory,
          testingDate,
          tier: activeTier,
          inputsByCode: nextInputs,
          completedTestCodes,
          skippedTestCodes,
          status: 'in_progress'
        });
        setSavedResumeMeta(saved);
      }
      return nextInputs;
    });
  };

  const handleResetAll = async () => {
    setInputsByCode({});
    setCompletedTestCodes([]);
    setSkippedTestCodes([]);
    setWizardStepIndex(0);
    setSavedResumeMeta(null);
    setFeedback(null);
    setWizardFeedback(null);
    if (activeAthleteId) {
      await scoutingCombineService.clearAthleteAssessmentData(tenantId, activeAthleteId);
      if (typeof onSyncedToReport === 'function') {
        onSyncedToReport({});
      }
    }
  };

  // Hitung skor instan (1-100) untuk setiap tes tanpa PENDING_CALIBRATION
  const liveScoreMap = useMemo(() => {
    const result = {};
    catalogTests.forEach((test) => {
      const raw = inputsByCode[test.test_code];
      if (!raw || raw.raw_value_1 === '' || raw.raw_value_1 === null || raw.raw_value_1 === undefined) {
        result[test.test_code] = null;
        return;
      }
      const effectiveRaw = {
        raw_value_1: raw.raw_value_1,
        raw_value_2:
          raw.raw_value_2 !== '' && raw.raw_value_2 !== undefined
            ? raw.raw_value_2
            : test.measurement_type === 'ACCURACY'
              ? test.defaultTotal || 10
              : '',
        errors_count: raw.errors_count || 0
      };
      result[test.test_code] = calculateAssessmentScore({
        testCode: test.test_code,
        tier: activeTier,
        rawValues: effectiveRaw,
        testMeta: test
      });
    });
    return result;
  }, [catalogTests, inputsByCode, activeTier]);

  const buildSessionEntriesFromInputs = (customInputs = inputsByCode) => {
    return catalogTests
      .map((test) => {
        const raw = customInputs[test.test_code];
        if (!raw || raw.raw_value_1 === '' || raw.raw_value_1 === null || raw.raw_value_1 === undefined) {
          return null;
        }
        const effectiveRaw = {
          raw_value_1: raw.raw_value_1,
          raw_value_2:
            raw.raw_value_2 !== '' && raw.raw_value_2 !== undefined
              ? raw.raw_value_2
              : test.measurement_type === 'ACCURACY'
                ? test.defaultTotal || 10
                : '',
          errors_count: raw.errors_count || 0
        };
        const score = calculateAssessmentScore({
          testCode: test.test_code,
          tier: activeTier,
          rawValues: effectiveRaw,
          testMeta: test
        });
        if (score === null || score === undefined) return null;
        return {
          test_code: test.test_code,
          test_name: test.test_name,
          indicator_key: test.indicator_key,
          indicator_label: test.indicator_label,
          weight: test.weight || 1.0,
          raw_value_1: Number(raw.raw_value_1),
          raw_value_2:
            raw.raw_value_2 !== '' && raw.raw_value_2 !== undefined
              ? Number(raw.raw_value_2)
              : test.measurement_type === 'ACCURACY'
                ? Number(test.defaultTotal || 10)
                : null,
          errors_count: Math.max(0, parseInt(raw.errors_count ?? 0, 10) || 0),
          calculated_score: score
        };
      })
      .filter(Boolean);
  };

  const readySessionEntries = useMemo(() => {
    return buildSessionEntriesFromInputs(inputsByCode);
  }, [catalogTests, inputsByCode, activeTier]);

  // Agregasi multi-tes per indikator secara real-time (cth: Dribbling dari TEC05 + TEC06)
  const liveAggregatedIndicators = useMemo(() => {
    return aggregateIndicatorScores(readySessionEntries);
  }, [readySessionEntries]);

  const filteredTests = useMemo(() => {
    if (!activeCategory || activeCategory === 'ALL') return catalogTests;
    return catalogTests.filter((t) => t.category === activeCategory);
  }, [catalogTests, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: catalogTests.length };
    catalogTests.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [catalogTests]);

  // Wizard Progress & Active Step Calculation
  const wizardProgress = useMemo(() => {
    return computeWizardSessionProgress({
      wizardTests: filteredTests,
      inputsByCode,
      completedTestCodes,
      skippedTestCodes,
      currentStepIndex: wizardStepIndex,
      tier: activeTier
    });
  }, [filteredTests, inputsByCode, completedTestCodes, skippedTestCodes, wizardStepIndex, activeTier]);

  const handleOpenWizard = (resumeExisting = false) => {
    setWizardFeedback(null);
    if (resumeExisting && savedResumeMeta) {
      const targetIdx = Math.max(
        0,
        Math.min(Math.max(0, filteredTests.length - 1), Number(savedResumeMeta.currentStepIndex) || 0)
      );
      setWizardStepIndex(targetIdx);
    } else if (!resumeExisting && wizardStepIndex >= filteredTests.length) {
      setWizardStepIndex(0);
    }
    setIsWizardOpen(true);
  };

  // Sinkronisasi langsung ke Supabase & Grafik Polar Area
  const syncEntriesToReportAndDatabase = async (entriesToSync) => {
    if (!activeAthleteId || !Array.isArray(entriesToSync) || entriesToSync.length === 0) {
      return null;
    }
    const response = await saveMasterAssessmentSessionAndSync({
      tenantId,
      athleteId: activeAthleteId,
      evaluatorId,
      testingDate,
      tier: activeTier,
      sessionEntries: entriesToSync
    });
    if (typeof onSyncedToReport === 'function') {
      onSyncedToReport(response.indicatorScoresMap, response.savedSessions);
    }
    return response;
  };

  // WIZARD ACTION 1: [ Simpan & Lanjut ➔ ]
  const handleWizardSaveAndNext = async () => {
    const currentTest = wizardProgress.currentTest;
    if (!currentTest) return;

    const currentScore = wizardProgress.currentLiveScore;
    if (currentScore === null || currentScore === undefined) {
      setWizardFeedback({
        type: 'error',
        message: `Masukkan nilai mentah untuk "${currentTest.test_name}" terlebih dahulu, atau tekan "Lewati Tes Ini".`
      });
      return;
    }

    setIsSaving(true);
    setWizardFeedback(null);
    try {
      const entriesToSync = buildSessionEntriesFromInputs(inputsByCode);
      const response = await syncEntriesToReportAndDatabase(entriesToSync);

      const transition = resolveWizardStepTransition({
        currentStepIndex: wizardProgress.safeStepIndex,
        totalSteps: wizardProgress.totalSteps,
        testCode: currentTest.test_code,
        action: 'save_next',
        completedTestCodes,
        skippedTestCodes
      });

      setCompletedTestCodes(transition.completedTestCodes);
      setSkippedTestCodes(transition.skippedTestCodes);
      setWizardStepIndex(transition.nextStepIndex);

      persistResumeSnapshot({
        currentStepIndex: transition.nextStepIndex,
        completedTestCodes: transition.completedTestCodes,
        skippedTestCodes: transition.skippedTestCodes,
        status: transition.isCompletedAllSteps ? 'completed' : 'in_progress'
      });

      const aggItem = response?.aggregatedIndicators?.[currentTest.indicator_key];
      const syncedScoreText = aggItem ? `${aggItem.indicator_label}: ${aggItem.score}/100` : `${currentScore}/100`;

      if (transition.isCompletedAllSteps) {
        setFeedback({
          type: 'success',
          message: `Seluruh langkah Wizard selesai! ${entriesToSync.length} tes lapangan telah disinkronkan ke Grafik Polar Area.`
        });
        setIsWizardOpen(false);
      } else {
        setWizardFeedback({
          type: 'success',
          message: `Tersimpan & disinkronkan ke Polar Area (${syncedScoreText}). Lanjut ke Step ${transition.nextStepIndex + 1}.`
        });
      }
    } catch (err) {
      setWizardFeedback({
        type: 'error',
        message: err?.message || 'Gagal menyimpan dan menyinkronkan tes.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // WIZARD ACTION 2: [ ➔ Lewati Tes Ini ]
  const handleWizardSkipStep = () => {
    const currentTest = wizardProgress.currentTest;
    if (!currentTest) return;

    const transition = resolveWizardStepTransition({
      currentStepIndex: wizardProgress.safeStepIndex,
      totalSteps: wizardProgress.totalSteps,
      testCode: currentTest.test_code,
      action: 'skip',
      completedTestCodes,
      skippedTestCodes
    });

    setCompletedTestCodes(transition.completedTestCodes);
    setSkippedTestCodes(transition.skippedTestCodes);
    setWizardStepIndex(transition.nextStepIndex);
    setWizardFeedback(null);

    persistResumeSnapshot({
      currentStepIndex: transition.nextStepIndex,
      completedTestCodes: transition.completedTestCodes,
      skippedTestCodes: transition.skippedTestCodes,
      status: 'in_progress'
    });
  };

  // WIZARD ACTION 3: [ 💾 Simpan Sesi & Berhenti (Lanjutkan Nanti) ]
  const handleWizardSaveAndStop = async () => {
    setIsSaving(true);
    setWizardFeedback(null);
    try {
      const entriesToSync = buildSessionEntriesFromInputs(inputsByCode);
      if (entriesToSync.length > 0) {
        await syncEntriesToReportAndDatabase(entriesToSync);
      }

      const saved = persistResumeSnapshot({
        currentStepIndex: wizardProgress.safeStepIndex,
        completedTestCodes,
        skippedTestCodes,
        status: 'paused_resume_ready'
      });

      setIsWizardOpen(false);
      setFeedback({
        type: 'success',
        message: `Progres sesi tes disimpan pada Step ${wizardProgress.currentStepNumber} dari ${wizardProgress.totalSteps} (${entriesToSync.length} tes tersinkronkan ke Grafik Polar). Anda dapat melanjutkan kapan saja.`
      });
      return saved;
    } catch (err) {
      setWizardFeedback({
        type: 'error',
        message: err?.message || 'Gagal menyimpan sesi progres tes.'
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndSync = async () => {
    if (!activeAthleteId) {
      setFeedback({
        type: 'error',
        message: 'Pilih atlet terlebih dahulu sebelum menyimpan hasil tes.'
      });
      return;
    }
    if (readySessionEntries.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Isi minimal satu hasil tes atau rubrik untuk menghasilkan skor otomatis (1-100).'
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await syncEntriesToReportAndDatabase(readySessionEntries);

      persistResumeSnapshot({
        status: 'synced'
      });

      const syncedLabels = Object.values(response?.aggregatedIndicators || {})
        .map((item) => `${item.indicator_label} (${item.score})`)
        .join(', ');

      setFeedback({
        type: 'success',
        message: `${readySessionEntries.length} tes lapangan tersimpan & disinkronkan ke Grafik Polar Area: ${syncedLabels}.`
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Gagal menyinkronkan sesi penilaian ke database.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const activeAthleteName = useMemo(() => {
    const found = athletes.find((a) => String(a.id) === String(activeAthleteId));
    return found?.name || found?.full_name || 'Atlet Terpilih';
  }, [athletes, activeAthleteId]);

  const isControlledByParent = Boolean(selectedAthleteId && typeof onSelectAthlete !== 'function');

  const hasResumableSession = Boolean(
    savedResumeMeta &&
      (Object.keys(savedResumeMeta.inputsByCode || {}).length > 0 ||
        (savedResumeMeta.currentStepIndex || 0) > 0 ||
        (savedResumeMeta.skippedTestCodes || []).length > 0)
  );

  // Render Modal Wizard Step-by-Step (Focus Mode 1 Tes per Layar)
  const renderStepByStepWizardModal = () => {
    if (!isWizardOpen) return null;
    const currentTest = wizardProgress.currentTest;
    if (!currentTest) return null;

    const raw = inputsByCode[currentTest.test_code] || {
      raw_value_1: '',
      raw_value_2:
        currentTest.measurement_type === 'ACCURACY' ? String(currentTest.defaultTotal || 10) : '',
      errors_count: '0'
    };
    const liveScore = wizardProgress.currentLiveScore;
    const savedEntry = existingIndicatorScores[currentTest.indicator_key];
    const displayScore = liveScore !== null ? liveScore : savedEntry?.score ?? null;
    const classification = getAssessmentClassification(displayScore);
    const benchmark = FOOTBALL_TEST_BENCHMARKS[currentTest.test_code]?.[activeTier];
    const catStyle = CATEGORY_STYLES[currentTest.category] || CATEGORY_STYLES.Teknik;
    const typeMeta = getMeasurementTypeMeta(currentTest.measurement_type);
    const TypeIcon = typeMeta.icon;
    const rubricAnchors = FOOTBALL_RUBRIC_ANCHORS[currentTest.indicator_key];
    const selectedRubricLevel =
      currentTest.measurement_type === 'RUBRIC' && raw.raw_value_1 !== ''
        ? Number(raw.raw_value_1)
        : null;

    const wizardNode = (
      <div
        data-testid="football-test-wizard-modal"
        className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex flex-col justify-between overflow-y-auto p-2 sm:p-4 lg:p-6"
      >
        <div className="w-full max-w-3xl mx-auto my-auto bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
          {/* 1. WIZARD TOP HEADER & PROGRESS TRACKER */}
          <div className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <Rocket size={12} /> Wizard Sesi Tes Terpandu
                  </span>
                  <span
                    data-testid="wizard-step-counter"
                    className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-[#C89D32] text-slate-950"
                  >
                    Step {wizardProgress.currentStepNumber} dari {wizardProgress.totalSteps}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate mt-1">
                  {activeAthleteName} • {FOOTBALL_ASSESSMENT_TIERS[activeTier]?.shortLabel}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleWizardSaveAndStop}
                data-testid="wizard-close-top-btn"
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Simpan progres dan tutup Wizard"
              >
                <X size={15} />
                <span className="hidden sm:inline">Tutup & Simpan Progres</span>
              </button>
            </div>

            {/* Progress Bar & Step Pills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                <span>
                  Step {wizardProgress.currentStepNumber} dari {wizardProgress.totalSteps}:{' '}
                  <strong className="text-white">{currentTest.test_name}</strong>
                </span>
                <span className="font-mono text-emerald-300">
                  {wizardProgress.completedCount}/{wizardProgress.totalSteps} Terisi ({wizardProgress.progressPercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.max(
                      5,
                      Math.round((wizardProgress.currentStepNumber / wizardProgress.totalSteps) * 100)
                    )}%`
                  }}
                />
              </div>
            </div>

            {/* Step Jump Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
              {filteredTests.map((t, idx) => {
                const isCurrent = idx === wizardProgress.safeStepIndex;
                const hasVal = liveScoreMap[t.test_code] !== null && liveScoreMap[t.test_code] !== undefined;
                const isSkipped = skippedTestCodes.includes(t.test_code) && !hasVal;
                return (
                  <button
                    key={t.test_code}
                    type="button"
                    onClick={() => {
                      setWizardStepIndex(idx);
                      setWizardFeedback(null);
                      persistResumeSnapshot({ currentStepIndex: idx });
                    }}
                    data-testid={`wizard-step-pill-${idx + 1}`}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                      isCurrent
                        ? 'bg-[#C89D32] text-slate-950 border-[#C89D32] shadow-xs'
                        : hasVal
                          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                          : isSkipped
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                            : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>#{idx + 1}</span>
                    <span>{t.test_code}</span>
                    {hasVal && <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. WIZARD FOCUS BODY: SINGLE ACTIVE TEST CARD */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {wizardFeedback && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2 text-xs sm:text-sm font-bold ${
                  wizardFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {wizardFeedback.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{wizardFeedback.message}</span>
              </div>
            )}

            <div
              data-testid="wizard-active-test-card"
              className={`rounded-2xl border-2 border-slate-200 dark:border-slate-800 border-l-8 ${catStyle.accentBorder} bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5 shadow-xs`}
            >
              {/* Test Metadata & Live Automated Score */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-black uppercase bg-slate-900 text-white">
                      {currentTest.test_code}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${catStyle.badge}`}>
                      Kategori: {currentTest.category}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      <TypeIcon size={13} />
                      <span>Indikator Rapor: {currentTest.indicator_label}</span>
                    </span>
                  </div>
                  <h4
                    data-testid="wizard-active-test-title"
                    className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug"
                  >
                    {currentTest.test_name}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {currentTest.description}
                  </p>
                </div>

                {/* Big Live Score Box */}
                <div
                  data-testid="wizard-live-score-box"
                  className={`shrink-0 px-4 py-3 rounded-2xl border text-center min-w-[140px] ${
                    liveScore !== null
                      ? classification.badgeClass
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider">
                    Skor Konversi (1–100)
                  </span>
                  <div className="font-mono text-2xl sm:text-3xl font-black tabular-nums mt-0.5">
                    {liveScore !== null ? `${liveScore}` : savedEntry?.score ? `${savedEntry.score}` : '—'}
                    <span className="text-xs font-bold opacity-75">/100</span>
                  </div>
                  <span className="inline-block text-[11px] font-bold mt-0.5">
                    {liveScore !== null
                      ? `Otomatis • ${classification.label}`
                      : savedEntry?.score
                        ? 'Skor Tersimpan'
                        : 'Menunggu Input'}
                  </span>
                </div>
              </div>

              {/* Benchmark Norms Banner for Objective Tests */}
              {benchmark && currentTest.measurement_type !== 'RUBRIC' && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    Target Norma {FOOTBALL_ASSESSMENT_TIERS[activeTier]?.label}:
                  </span>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                      Cukup: {benchmark.fair}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                      Baik: {benchmark.good}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                      Elit: {benchmark.elite} {currentTest.measurement_type === 'ACCURACY' ? '%' : currentTest.unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Large Mobile-First Field Input Controls */}
              {currentTest.measurement_type === 'RUBRIC' ? (
                <div className="space-y-2.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Pilih Level Observasi Perilaku Atlet (Rubrik 1–5):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((lv) => {
                      const anchoredScore = RUBRIC_ANCHORED_SCORES[lv];
                      const isSelected = selectedRubricLevel === lv;
                      const anchorMeta = rubricAnchors?.[lv];
                      return (
                        <button
                          key={lv}
                          type="button"
                          disabled={isArchived}
                          onClick={() => updateTestInput(currentTest, 'raw_value_1', String(lv))}
                          data-testid={`wizard-rubric-btn-${lv}`}
                          className={`min-h-[64px] p-3 rounded-xl border-2 text-left sm:text-center transition-all cursor-pointer flex sm:flex-col items-center sm:justify-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-md'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <span className="text-sm font-black block">
                              Level {lv} ({anchoredScore} pts)
                            </span>
                            {anchorMeta?.label && (
                              <span
                                className={`text-xs font-bold block mt-0.5 ${
                                  isSelected ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {anchorMeta.label}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedRubricLevel && rubricAnchors?.[selectedRubricLevel] && (
                    <div className="p-3.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs sm:text-sm">
                      <span className="font-extrabold text-emerald-900 dark:text-emerald-300">
                        Deskripsi Level {selectedRubricLevel} ({rubricAnchors[selectedRubricLevel].label} — Skor {RUBRIC_ANCHORED_SCORES[selectedRubricLevel]}):
                      </span>{' '}
                      <span className="text-slate-800 dark:text-slate-200">
                        {rubricAnchors[selectedRubricLevel].desc}
                      </span>
                    </div>
                  )}
                </div>
              ) : currentTest.measurement_type === 'ACCURACY' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      {currentTest.inputLabel1 || 'Percobaan Sukses (Target Masuk)'}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isArchived}
                        onClick={() => {
                          const curr = Math.max(0, Number(raw.raw_value_1) || 0);
                          updateTestInput(currentTest, 'raw_value_1', String(Math.max(0, curr - 1)));
                        }}
                        className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-black text-slate-700 cursor-pointer"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={isArchived}
                        placeholder="cth: 8"
                        value={raw.raw_value_1}
                        onChange={(e) => updateTestInput(currentTest, 'raw_value_1', e.target.value)}
                        data-testid="wizard-input-1"
                        className="flex-1 min-h-[52px] px-4 py-2.5 bg-white dark:bg-slate-900 border-2 border-emerald-500/70 rounded-xl text-lg font-black text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        disabled={isArchived}
                        onClick={() => {
                          const curr = Math.max(0, Number(raw.raw_value_1) || 0);
                          updateTestInput(currentTest, 'raw_value_1', String(curr + 1));
                        }}
                        className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-black text-slate-700 cursor-pointer"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      {currentTest.inputLabel2 || 'Total Percobaan Dilakukan'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={isArchived}
                      placeholder={String(currentTest.defaultTotal || 10)}
                      value={raw.raw_value_2}
                      onChange={(e) => updateTestInput(currentTest, 'raw_value_2', e.target.value)}
                      data-testid="wizard-input-2"
                      className="w-full min-h-[52px] px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-lg font-bold text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      {currentTest.inputLabel1 || `Hasil Utama (${currentTest.unit})`}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={currentTest.measurement_type === 'TIME' ? '0.01' : '1'}
                      disabled={isArchived}
                      placeholder={currentTest.measurement_type === 'TIME' ? 'cth: 1.95' : '0'}
                      value={raw.raw_value_1}
                      onChange={(e) => updateTestInput(currentTest, 'raw_value_1', e.target.value)}
                      data-testid="wizard-input-1"
                      className="w-full min-h-[52px] px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-emerald-500/70 rounded-xl text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      {currentTest.inputLabel2 || 'Trial 2 (Opsional)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={currentTest.measurement_type === 'TIME' ? '0.01' : '1'}
                      disabled={isArchived}
                      placeholder="Opsional"
                      value={raw.raw_value_2}
                      onChange={(e) => updateTestInput(currentTest, 'raw_value_2', e.target.value)}
                      data-testid="wizard-input-2"
                      className="w-full min-h-[52px] px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      Penalti Cone / Error
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isArchived}
                        onClick={() => {
                          const curr = Math.max(0, parseInt(raw.errors_count || 0, 10) || 0);
                          updateTestInput(currentTest, 'errors_count', String(Math.max(0, curr - 1)));
                        }}
                        className="w-12 h-[52px] rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-black text-slate-700 cursor-pointer"
                      >
                        <Minus size={15} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={isArchived}
                        placeholder="0"
                        value={raw.errors_count}
                        onChange={(e) => updateTestInput(currentTest, 'errors_count', e.target.value)}
                        data-testid="wizard-errors-input"
                        className="w-full min-h-[52px] px-2 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-lg font-bold text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        disabled={isArchived}
                        onClick={() => {
                          const curr = Math.max(0, parseInt(raw.errors_count || 0, 10) || 0);
                          updateTestInput(currentTest, 'errors_count', String(curr + 1));
                        }}
                        className="w-12 h-[52px] rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-black text-slate-700 cursor-pointer"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. WIZARD STICKY FOOTER NAVIGATION */}
          <div className="p-4 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex flex-col gap-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Tombol 1: Simpan Sesi & Berhenti (Lanjutkan Nanti) */}
              <button
                type="button"
                disabled={isSaving}
                onClick={handleWizardSaveAndStop}
                data-testid="wizard-save-stop-btn"
                className="min-h-[48px] px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer order-3 sm:order-1"
              >
                <span>💾 Simpan Sesi & Berhenti (Lanjutkan Nanti)</span>
              </button>

              {/* Tombol 2: Lewati Tes Ini */}
              <div className="flex items-center gap-1.5 order-2">
                {wizardProgress.safeStepIndex > 0 && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      const prevIdx = Math.max(0, wizardProgress.safeStepIndex - 1);
                      setWizardStepIndex(prevIdx);
                      setWizardFeedback(null);
                      persistResumeSnapshot({ currentStepIndex: prevIdx });
                    }}
                    data-testid="wizard-prev-btn"
                    className="min-h-[48px] px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    title="Tes Sebelumnya"
                  >
                    <ArrowLeft size={15} />
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleWizardSkipStep}
                  data-testid="wizard-skip-btn"
                  className="flex-1 min-h-[48px] px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>➔ Lewati Tes</span>
                </button>
              </div>

              {/* Tombol 3: Simpan & Lanjut ➔ */}
              <button
                type="button"
                disabled={isSaving || isArchived}
                onClick={handleWizardSaveAndNext}
                data-testid="wizard-save-next-btn"
                className="min-h-[48px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer order-1 sm:order-3"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Menyinkronkan...</span>
                  </>
                ) : (
                  <span>Simpan & Lanjut ➔</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(wizardNode, document.body) : wizardNode;
  };

  return (
    <div
      className="bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      data-testid="football-assessment-hub"
    >
      {renderStepByStepWizardModal()}

      {/* Top Header & Context Bar */}
      <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                <Sparkles size={12} /> Master Test Library & Assessment Engine
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {FOOTBALL_ASSESSMENT_TIERS[activeTier]?.shortLabel}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              Penilaian Objektif Lapangan & Rubrik Terstruktur Sepakbola
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Konversi instan dari waktu stopwatch, akurasi percobaan, jarak/repetisi, & rubrik 1–5 menjadi skor indikator tunggal (1–100).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              disabled={isArchived || filteredTests.length === 0}
              onClick={() => handleOpenWizard(false)}
              data-testid="start-wizard-mode-btn"
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <span>🚀 Mulai Sesi Tes Terpandu (Wizard Mode)</span>
            </button>

            {readySessionEntries.length > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} /> Reset Sesi ({readySessionEntries.length})
              </button>
            )}
          </div>
        </div>

        {/* Resume Saved Wizard Session Banner */}
        {hasResumableSession && (
          <div
            data-testid="wizard-resume-banner"
            className="mt-3 p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-extrabold">Progres Sesi Tes Tersimpan ({activeAthleteName}):</span>{' '}
              Posisi terakhir di <strong>Step {wizardProgress.currentStepNumber} dari {wizardProgress.totalSteps}</strong> ({wizardProgress.completedCount} tes selesai, {wizardProgress.skippedCount} dilewati).
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenWizard(true)}
                data-testid="resume-wizard-mode-btn"
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Play size={13} />
                <span>Lanjutkan Sesi (Step {wizardProgress.currentStepNumber})</span>
              </button>
            </div>
          </div>
        )}

        {/* Selector Controls */}
        {isControlledByParent ? (
          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <UserCheck size={14} className="text-emerald-600" />
                {activeAthleteName}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <div className="inline-flex items-center gap-1">
                <Layers size={13} className="text-emerald-600" />
                <select
                  value={activeTier}
                  onChange={(e) => handleTierChange(e.target.value)}
                  aria-label="Filter Tier Usia"
                  data-testid="master-tier-select"
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {Object.values(FOOTBALL_ASSESSMENT_TIERS).map((t) => (
                    <option key={t.tier} value={t.tier}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <input
                type="date"
                value={testingDate}
                onChange={(e) => setTestingDate(e.target.value)}
                aria-label="Tanggal Sesi Tes"
                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Atlet Sepakbola
              </label>
              <div className="relative">
                <UserCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={activeAthleteId}
                  onChange={(e) => handleAthleteChange(e.target.value)}
                  data-testid="master-athlete-select"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {athletes.length === 0 ? (
                    <option value="">-- Pilih Atlet --</option>
                  ) : (
                    athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>
                        {athlete.name || athlete.full_name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Kelompok Usia (Benchmark Tier)
              </label>
              <div className="relative">
                <Layers size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={activeTier}
                  onChange={(e) => handleTierChange(e.target.value)}
                  data-testid="master-tier-select"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {Object.values(FOOTBALL_ASSESSMENT_TIERS).map((t) => (
                    <option key={t.tier} value={t.tier}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Tanggal Pengujian
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={testingDate}
                  onChange={(e) => setTestingDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* Category Filter Tabs (Mobile-First Horizontal Scroll) */}
        <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1">
          {ASSESSMENT_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.key;
            const count = categoryCounts[cat.key] || 0;
            const styleMeta = CATEGORY_STYLES[cat.key];
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.key);
                  setWizardStepIndex(0);
                }}
                data-testid={`master-category-tab-${cat.key}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? styleMeta?.pillActive || 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600 dark:border-emerald-500'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`mx-4 sm:mx-5 mt-4 p-3.5 rounded-lg border flex items-start gap-2.5 text-xs sm:text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={17} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle size={17} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Multi-Test Aggregation Preview Bar (when any indicator combines >= 2 tests) */}
      {Object.values(liveAggregatedIndicators).some((agg) => agg.tests_count > 1) && (
        <div className="mx-4 sm:mx-5 mt-4 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">
            <Award size={15} className="text-emerald-600 shrink-0" />
            <span>Agregasi Multi-Tes Aktif (Skor Gabungan Tertimbang):</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.values(liveAggregatedIndicators)
              .filter((agg) => agg.tests_count > 1)
              .map((agg) => (
                <span
                  key={agg.indicator_key}
                  data-testid={`aggregated-badge-${agg.indicator_key}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs"
                >
                  {agg.indicator_label}: {agg.score}/100 ({agg.test_codes.join(' + ')})
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Automated Attendance-to-Development Indicators Strip (DEV01, DEV02, DEV03) */}
      <div
        data-testid="master-attendance-development-strip"
        className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-emerald-50/75 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/80 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
            <Lock size={14} className="text-emerald-700 shrink-0" />
            <span>Kategori 6: Perkembangan Atlet (Otomatis dari Modul Presensi Akademi)</span>
          </div>
          {(() => {
            const devRec = existingIndicatorScores?.kehadiran_latihan;
            const hasAtt =
              Boolean(devRec?.hasAttendanceData) ||
              (Number(devRec?.score) > 0 && Number.isFinite(Number(devRec?.attendance_percentage ?? devRec?.attendancePercentage)));
            const attPct = devRec?.attendance_percentage ?? devRec?.attendancePercentage;
            return hasAtt ? (
              <span
                data-testid="badge-linked-attendance"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300"
              >
                {devRec?.badge_text || devRec?.badgeText || `Terhubung Otomatis ke Modul Presensi (${attPct}%)`}
              </span>
            ) : (
              <span
                data-testid="badge-no-attendance"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-300"
              >
                Belum Ada Presensi
              </span>
            );
          })()}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ATTENDANCE_DEVELOPMENT_INDICATORS.map((devInd) => {
            const devCode = devInd.code || devInd.test_code || devInd.indicator_key;
            const rec = existingIndicatorScores?.[devInd.indicator_key];
            const hasAtt =
              Boolean(rec?.hasAttendanceData) ||
              (Number(rec?.score) > 0 && Number.isFinite(Number(rec?.attendance_percentage ?? rec?.attendancePercentage)));
            const scoreVal = hasAtt && Number(rec?.score) > 0 ? Math.round(Number(rec.score)) : 0;
            const attPct = rec?.attendancePercentage ?? rec?.attendance_percentage;
            const badgeText = hasAtt
              ? rec?.badgeText || rec?.badge_text || `Terhubung Otomatis ke Modul Presensi (${attPct}%)`
              : 'Belum Ada Presensi';
            return (
              <div
                key={devCode}
                data-testid={`attendance-dev-card-${devCode}`}
                className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-900 text-white">
                      {devCode}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {devInd.indicator_label}
                    </span>
                  </div>
                  <p className={`text-[10px] font-semibold truncate mt-0.5 ${hasAtt ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {badgeText}
                  </p>
                </div>
                <span className={`font-mono text-sm font-black tabular-nums shrink-0 ${hasAtt ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {scoreVal}/100
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Test Cards Grid */}
      <div className="p-4 sm:p-5">
        {loadingCatalog ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin text-emerald-600" />
            <span>Memuat Master Test Library Sepakbola...</span>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Tidak ada tes untuk filter kategori dan tier usia ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTests.map((test, idx) => {
              const raw = inputsByCode[test.test_code] || {
                raw_value_1: '',
                raw_value_2: test.measurement_type === 'ACCURACY' ? String(test.defaultTotal || 10) : '',
                errors_count: '0'
              };
              const liveScore = liveScoreMap[test.test_code];
              const savedEntry = existingIndicatorScores[test.indicator_key];
              const displayScore = liveScore !== null ? liveScore : savedEntry?.score ?? null;
              const classification = getAssessmentClassification(displayScore);
              const benchmark = FOOTBALL_TEST_BENCHMARKS[test.test_code]?.[activeTier];
              const catStyle = CATEGORY_STYLES[test.category] || CATEGORY_STYLES.Teknik;
              const typeMeta = getMeasurementTypeMeta(test.measurement_type);
              const TypeIcon = typeMeta.icon;
              const rubricAnchors = FOOTBALL_RUBRIC_ANCHORS[test.indicator_key];
              const selectedRubricLevel =
                test.measurement_type === 'RUBRIC' && raw.raw_value_1 !== ''
                  ? Number(raw.raw_value_1)
                  : null;

              return (
                <div
                  key={test.test_code}
                  data-testid={`master-test-card-${test.test_code}`}
                  className={`rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 ${catStyle.accentBorder} bg-white dark:bg-slate-900/50 p-4 flex flex-col justify-between gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors`}
                >
                  {/* Card Top: Code, Title, Live Automated Score Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-slate-900 text-white dark:bg-slate-700 dark:text-slate-100">
                            {test.test_code}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catStyle.badge}`}>
                            {test.category}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            <TypeIcon size={11} />
                            {test.indicator_label}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setWizardStepIndex(idx);
                              setIsWizardOpen(true);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                            title="Buka tes ini di Mode Fokus Wizard"
                          >
                            Fokus Wizard ↗
                          </button>
                        </div>
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {test.test_name}
                        </h5>
                      </div>

                      {/* Animated Live Preview Badge */}
                      <div className="shrink-0 text-right">
                        <AnimatePresence mode="wait">
                          {liveScore !== null ? (
                            <motion.div
                              key={`live-${test.test_code}-${liveScore}`}
                              initial={{ scale: 0.92, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.92, opacity: 0 }}
                              transition={{ duration: 0.16 }}
                              data-testid={`master-live-score-${test.test_code}`}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-extrabold shadow-2xs ${classification.badgeClass}`}
                            >
                              <Sparkles size={12} />
                              <span>
                                Skor Otomatis: {liveScore}/100 ({classification.shortLabel})
                              </span>
                            </motion.div>
                          ) : savedEntry?.score ? (
                            <motion.div
                              key={`saved-${test.test_code}-${savedEntry.score}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                            >
                              <ShieldCheck size={12} className="text-emerald-600" />
                              <span>Tersimpan: {savedEntry.score}/100</span>
                            </motion.div>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                              Siap Input
                            </span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {test.description}
                    </p>

                    {/* Tier Benchmark Target Bar for Objective Tests */}
                    {benchmark && test.measurement_type !== 'RUBRIC' && (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          Norma {FOOTBALL_ASSESSMENT_TIERS[activeTier]?.shortLabel}:
                        </span>
                        <div className="flex items-center gap-2.5 font-mono">
                          <span className="text-amber-700 dark:text-amber-400">
                            Cukup: <strong>{benchmark.fair}</strong>
                          </span>
                          <span className="text-teal-700 dark:text-teal-300">
                            Baik: <strong>{benchmark.good}</strong>
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-300">
                            Elit: <strong>{benchmark.elite}</strong>{' '}
                            {test.measurement_type === 'ACCURACY' ? '%' : test.unit}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Controls by Measurement Type */}
                  {test.measurement_type === 'RUBRIC' ? (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 2, 3, 4, 5].map((lv) => {
                          const anchoredScore = RUBRIC_ANCHORED_SCORES[lv];
                          const isSelected = selectedRubricLevel === lv;
                          const anchorMeta = rubricAnchors?.[lv];
                          return (
                            <button
                              key={lv}
                              type="button"
                              disabled={isArchived}
                              onClick={() => updateTestInput(test, 'raw_value_1', String(lv))}
                              data-testid={`master-rubric-btn-${test.test_code}-${lv}`}
                              className={`min-h-[52px] py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                                isSelected
                                  ? 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-600 dark:border-emerald-500 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="text-xs font-extrabold">Lv.{lv} ({anchoredScore})</span>
                              {anchorMeta?.label && (
                                <span
                                  className={`text-[10px] font-semibold leading-tight line-clamp-1 mt-0.5 ${
                                    isSelected ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {anchorMeta.label}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedRubricLevel && rubricAnchors?.[selectedRubricLevel] ? (
                        <div className="px-3 py-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 text-xs">
                          <span className="font-bold text-emerald-900 dark:text-emerald-300">
                            Lv.{selectedRubricLevel} ({RUBRIC_ANCHORED_SCORES[selectedRubricLevel]} pts) — {rubricAnchors[selectedRubricLevel].label}:
                          </span>{' '}
                          <span className="text-slate-700 dark:text-slate-300">
                            {rubricAnchors[selectedRubricLevel].desc}
                          </span>
                        </div>
                      ) : rubricAnchors ? (
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Panduan Rubrik:</span>{' '}
                          Lv.1 ({rubricAnchors[1]?.label}: 35) • Lv.3 ({rubricAnchors[3]?.label}: 70) • Lv.5 ({rubricAnchors[5]?.label}: 95)
                        </div>
                      ) : null}
                    </div>
                  ) : test.measurement_type === 'ACCURACY' ? (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          {test.inputLabel1 || 'Percobaan Sukses'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isArchived}
                          placeholder="cth: 8"
                          value={raw.raw_value_1}
                          onChange={(e) => updateTestInput(test, 'raw_value_1', e.target.value)}
                          data-testid={`master-input-1-${test.test_code}`}
                          className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          {test.inputLabel2 || 'Total Percobaan'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          disabled={isArchived}
                          placeholder={String(test.defaultTotal || 10)}
                          value={raw.raw_value_2}
                          onChange={(e) => updateTestInput(test, 'raw_value_2', e.target.value)}
                          data-testid={`master-input-2-${test.test_code}`}
                          className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 truncate">
                          {test.inputLabel1 || `Nilai (${test.unit})`}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step={test.measurement_type === 'TIME' ? '0.01' : '1'}
                          disabled={isArchived}
                          placeholder={test.measurement_type === 'TIME' ? '0.00' : '0'}
                          value={raw.raw_value_1}
                          onChange={(e) => updateTestInput(test, 'raw_value_1', e.target.value)}
                          data-testid={`master-input-1-${test.test_code}`}
                          className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 truncate">
                          {test.inputLabel2 || 'Trial 2 (Ops)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step={test.measurement_type === 'TIME' ? '0.01' : '1'}
                          disabled={isArchived}
                          placeholder="Opsional"
                          value={raw.raw_value_2}
                          onChange={(e) => updateTestInput(test, 'raw_value_2', e.target.value)}
                          data-testid={`master-input-2-${test.test_code}`}
                          className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 truncate">
                          Penalti / Error
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isArchived}
                          placeholder="0"
                          value={raw.errors_count}
                          onChange={(e) => updateTestInput(test, 'errors_count', e.target.value)}
                          data-testid={`master-errors-${test.test_code}`}
                          className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="px-4 sm:px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-900 dark:text-white">
            {readySessionEntries.length} tes
          </span>{' '}
          siap dikonversi ke{' '}
          <span className="font-bold text-emerald-700 dark:text-emerald-400">
            {Object.keys(liveAggregatedIndicators).length} indikator
          </span>{' '}
          pada Grafik Polar Area Atlet.
        </div>

        <button
          type="button"
          onClick={handleSaveAndSync}
          disabled={isSaving || isArchived || readySessionEntries.length === 0}
          data-testid="master-hub-sync-button"
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Menyinkronkan ke Grafik Polar...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Simpan & Sinkronkan ke Grafik Polar ({readySessionEntries.length})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
