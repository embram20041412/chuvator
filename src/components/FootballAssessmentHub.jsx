import React, { useState, useEffect, useMemo } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import {
  FOOTBALL_ASSESSMENT_TIERS,
  FOOTBALL_TEST_BENCHMARKS,
  ASSESSMENT_CATEGORIES,
  RUBRIC_ANCHORED_SCORES,
  FOOTBALL_RUBRIC_ANCHORS,
  calculateAssessmentScore,
  aggregateIndicatorScores,
  getAssessmentClassification
} from '../utils/footballAssessmentEngine';
import {
  getMasterFootballCatalog,
  saveMasterAssessmentSessionAndSync
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

  const handleAthleteChange = (newId) => {
    setInternalAthleteId(newId);
    setFeedback(null);
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
    setInputsByCode((prev) => {
      const current = prev[testObj.test_code] || {
        raw_value_1: '',
        raw_value_2: testObj.measurement_type === 'ACCURACY' ? String(testObj.defaultTotal || 10) : '',
        errors_count: '0'
      };
      return {
        ...prev,
        [testObj.test_code]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const handleResetAll = () => {
    setInputsByCode({});
    setFeedback(null);
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

  const readySessionEntries = useMemo(() => {
    return catalogTests
      .map((test) => {
        const score = liveScoreMap[test.test_code];
        if (score === null || score === undefined) return null;
        const raw = inputsByCode[test.test_code] || {};
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
  }, [catalogTests, liveScoreMap, inputsByCode]);

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
      const response = await saveMasterAssessmentSessionAndSync({
        tenantId,
        athleteId: activeAthleteId,
        evaluatorId,
        testingDate,
        tier: activeTier,
        sessionEntries: readySessionEntries
      });

      const syncedLabels = Object.values(response.aggregatedIndicators || {})
        .map((item) => `${item.indicator_label} (${item.score})`)
        .join(', ');

      setFeedback({
        type: 'success',
        message: `${readySessionEntries.length} tes lapangan tersimpan & disinkronkan ke Grafik Polar Area: ${syncedLabels}.`
      });

      if (typeof onSyncedToReport === 'function') {
        onSyncedToReport(response.indicatorScoresMap, response.savedSessions);
      }
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

  return (
    <div
      className="bg-white dark:bg-[#161B22] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      data-testid="football-assessment-hub"
    >
      {/* Top Header & Context Bar */}
      <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2 self-start lg:self-center">
            {readySessionEntries.length > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} /> Reset Input ({readySessionEntries.length})
              </button>
            )}
          </div>
        </div>

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
                onClick={() => setActiveCategory(cat.key)}
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
            {filteredTests.map((test) => {
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
                          {test.position_code && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              Posisi: {test.position_code}
                            </span>
                          )}
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
