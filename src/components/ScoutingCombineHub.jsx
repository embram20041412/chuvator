import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Timer,
  Target,
  Repeat,
  Zap,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  RotateCcw,
  Calendar,
  UserCheck,
  Award,
  Layers
} from 'lucide-react';
import scoutingCombineService from '../services/scoutingCombineService';
import {
  FOOTBALL_COMBINE_TIERS,
  COMBINE_BENCHMARKS,
  calculateTestScore,
  getScoreClassification,
  getActiveTestsForTier
} from '../utils/combineScoringEngine';

function formatBenchmarkHint(test, tier) {
  const b = COMBINE_BENCHMARKS[test.id]?.[tier];
  if (!b) return '';
  if (test.measurement_type === 'TIME') {
    return `Target Baik: ≤${b.good}d · Elit: ≤${b.elite}d`;
  }
  if (test.measurement_type === 'ACCURACY') {
    return `Target Baik: ${b.good}% · Elit: ${b.elite}%`;
  }
  return `Target Baik: ${b.good} · Elit: ${b.elite}`;
}

function MeasurementIcon({ type }) {
  if (type === 'TIME') return <Timer className="w-4 h-4" />;
  if (type === 'ACCURACY') return <Target className="w-4 h-4" />;
  return <Repeat className="w-4 h-4" />;
}

export default function ScoutingCombineHub({
  students = [],
  selectedStudentId = '',
  onSelectStudentId,
  activeTier = 2,
  onChangeTier,
  tenantId,
  evaluatorId = null,
  existingIndicatorScores = {},
  onSyncedToReport,
  isArchived = false,
  isMobile = false
}) {
  const [testingDate, setTestingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'Teknik' | 'Fisik'
  const [catalogTests, setCatalogTests] = useState(() => getActiveTestsForTier(activeTier, ['Teknik', 'Fisik']));
  const [rawInputs, setRawInputs] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const selectedStudent = useMemo(() => {
    if (!students || students.length === 0) return null;
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  const normalizedTier = Math.max(1, Math.min(4, Number(activeTier) || 1));

  // Load tests from Supabase catalog (with built-in fallback) whenever tier changes
  useEffect(() => {
    let active = true;
    const localFiltered = getActiveTestsForTier(normalizedTier, ['Teknik', 'Fisik']);
    setCatalogTests(localFiltered);

    scoutingCombineService
      .getTestsCatalog({ tenantId, sportType: 'football', category: ['Teknik', 'Fisik'], tier: normalizedTier })
      .then((rows) => {
        if (active && Array.isArray(rows) && rows.length > 0) {
          setCatalogTests(rows);
        }
      })
      .catch(() => {
        // fallback already set
      });

    return () => {
      active = false;
    };
  }, [normalizedTier, tenantId]);

  // Reset draft inputs when athlete changes
  useEffect(() => {
    setRawInputs({});
    setSyncSuccess(null);
    setSyncError(null);
  }, [selectedStudent?.id]);

  const visibleTests = useMemo(() => {
    if (categoryFilter === 'ALL') return catalogTests;
    return catalogTests.filter((t) => t.category === categoryFilter);
  }, [catalogTests, categoryFilter]);

  const teknikTests = useMemo(() => visibleTests.filter((t) => t.category === 'Teknik'), [visibleTests]);
  const fisikTests = useMemo(() => visibleTests.filter((t) => t.category === 'Fisik'), [visibleTests]);

  const handleFieldChange = (test, field, value) => {
    setSyncError(null);
    setSyncSuccess(null);
    setRawInputs((prev) => {
      const current = prev[test.id] || {
        raw_value_1: '',
        raw_value_2: test.measurement_type === 'ACCURACY' ? String(test.defaultTotal || 10) : '',
        errors_count: '0'
      };
      return {
        ...prev,
        [test.id]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  // Compute live scores for every active test instantaneously (NO PENDING_CALIBRATION)
  const calculatedMap = useMemo(() => {
    const map = {};
    catalogTests.forEach((test) => {
      const entry = rawInputs[test.id];
      if (!entry || entry.raw_value_1 === '' || entry.raw_value_1 === undefined) {
        map[test.id] = null;
        return;
      }
      const effectiveEntry = {
        raw_value_1: entry.raw_value_1,
        raw_value_2:
          entry.raw_value_2 !== '' && entry.raw_value_2 !== undefined
            ? entry.raw_value_2
            : test.measurement_type === 'ACCURACY'
              ? test.defaultTotal || 10
              : '',
        errors_count: entry.errors_count ?? 0
      };
      map[test.id] = calculateTestScore(test.id, normalizedTier, effectiveEntry, test);
    });
    return map;
  }, [catalogTests, rawInputs, normalizedTier]);

  const readyEntries = useMemo(() => {
    return catalogTests
      .map((test) => {
        const score = calculatedMap[test.id];
        if (score === null || score === undefined) return null;
        const entry = rawInputs[test.id] || {};
        return {
          testId: test.id,
          indicatorKey: test.indicator_key,
          indicatorLabel: test.indicator_label,
          category: test.category,
          measurement_type: test.measurement_type,
          raw_value_1: Number(entry.raw_value_1),
          raw_value_2:
            entry.raw_value_2 !== '' && entry.raw_value_2 !== undefined
              ? Number(entry.raw_value_2)
              : test.measurement_type === 'ACCURACY'
                ? Number(test.defaultTotal || 10)
                : null,
          errors_count: Math.max(0, parseInt(entry.errors_count ?? 0, 10) || 0),
          calculated_score: score
        };
      })
      .filter(Boolean);
  }, [catalogTests, calculatedMap, rawInputs]);

  const handleResetAll = () => {
    setRawInputs({});
    setSyncError(null);
    setSyncSuccess(null);
  };

  const handleSaveAndSync = async () => {
    if (isArchived) {
      setSyncError('Kelas ini diarsipkan (mode baca-saja).');
      return;
    }
    if (!selectedStudent?.id || !tenantId) {
      setSyncError('Pilih atlet terlebih dahulu sebelum menyimpan hasil tes.');
      return;
    }
    if (readyEntries.length === 0) {
      setSyncError('Masukkan minimal satu angka hasil tes lapangan terlebih dahulu.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const { indicatorScoresMap } = await scoutingCombineService.saveCombineResultsAndSync({
        tenantId,
        athleteId: selectedStudent.id,
        evaluatorId,
        testingDate,
        tier: normalizedTier,
        results: readyEntries
      });

      setSyncSuccess(
        `${readyEntries.length} hasil tes combine ${selectedStudent.studentName} tersimpan & disinkronkan ke Rapor Polar Area.`
      );

      if (onSyncedToReport) {
        onSyncedToReport(indicatorScoresMap, {
          syncedCount: readyEntries.length,
          sourceType: 'combine'
        });
      }
    } catch (err) {
      console.error('[ScoutingCombineHub] Sync error:', err);
      setSyncError(err?.message || 'Gagal menyimpan & menyinkronkan hasil tes ke database.');
    } finally {
      setIsSyncing(false);
    }
  };

  const renderTestCard = (test) => {
    const isTeknik = test.category === 'Teknik';
    const entry = rawInputs[test.id] || {
      raw_value_1: '',
      raw_value_2: test.measurement_type === 'ACCURACY' ? String(test.defaultTotal || 10) : '',
      errors_count: '0'
    };
    const liveScore = calculatedMap[test.id];
    const classification = getScoreClassification(liveScore);
    const existingRecord = existingIndicatorScores?.[test.indicator_key];
    const benchmarkHint = formatBenchmarkHint(test, normalizedTier);

    return (
      <div
        key={test.id}
        data-testid={`combine-card-${test.indicator_key}`}
        className="bg-white dark:bg-[#162320] rounded-2xl border border-slate-200/90 dark:border-white/10 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 transition-colors"
      >
        {/* Card Header */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isTeknik
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                }`}
              >
                <MeasurementIcon type={test.measurement_type} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                    {test.test_name}
                  </h4>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Indikator: <span className="text-slate-800 dark:text-slate-200 font-bold">{test.indicator_label}</span>
                  {benchmarkHint ? ` · ${benchmarkHint}` : ''}
                </p>
              </div>
            </div>

            {existingRecord && liveScore === null && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#354944]/10 text-[#354944] dark:bg-[#C89D32]/15 dark:text-[#C89D32] border border-[#354944]/20 tabular-nums">
                <CheckCircle2 className="w-3 h-3" />
                <span>Rapor: {existingRecord.score}</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {test.description}
          </p>
        </div>

        {/* Raw Numeric Inputs (Mobile-First >= 44px touch target) */}
        <div
          className={`grid gap-2 ${
            test.measurement_type === 'TIME' && (test.errorPenaltySeconds || 0) > 0
              ? 'grid-cols-3'
              : 'grid-cols-2'
          }`}
        >
          <div>
            <label
              htmlFor={`combine-v1-${test.id}`}
              className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 truncate"
            >
              {test.inputLabel1 || 'Nilai 1'}
            </label>
            <input
              id={`combine-v1-${test.id}`}
              data-testid={`combine-input-1-${test.indicator_key}`}
              type="number"
              inputMode="decimal"
              step={test.measurement_type === 'TIME' ? '0.01' : '1'}
              min="0"
              disabled={isArchived}
              placeholder={test.measurement_type === 'TIME' ? 'cth: 2.05' : '0'}
              value={entry.raw_value_1}
              onChange={(e) => handleFieldChange(test, 'raw_value_1', e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-extrabold font-mono tabular-nums bg-slate-50 dark:bg-[#0C1412] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#111C19] focus:outline-none focus:ring-2 focus:ring-[#354944] disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor={`combine-v2-${test.id}`}
              className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 truncate"
            >
              {test.inputLabel2 || 'Nilai 2'}
            </label>
            <input
              id={`combine-v2-${test.id}`}
              data-testid={`combine-input-2-${test.indicator_key}`}
              type="number"
              inputMode="decimal"
              step={test.measurement_type === 'TIME' ? '0.01' : '1'}
              min="0"
              disabled={isArchived}
              placeholder={test.measurement_type === 'ACCURACY' ? String(test.defaultTotal || 10) : 'Opsional'}
              value={entry.raw_value_2}
              onChange={(e) => handleFieldChange(test, 'raw_value_2', e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-extrabold font-mono tabular-nums bg-slate-50 dark:bg-[#0C1412] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#111C19] focus:outline-none focus:ring-2 focus:ring-[#354944] disabled:opacity-50"
            />
          </div>

          {test.measurement_type === 'TIME' && (test.errorPenaltySeconds || 0) > 0 && (
            <div>
              <label
                htmlFor={`combine-err-${test.id}`}
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 truncate"
              >
                Cone Jatuh
              </label>
              <input
                id={`combine-err-${test.id}`}
                data-testid={`combine-errors-${test.indicator_key}`}
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                disabled={isArchived}
                value={entry.errors_count}
                onChange={(e) => handleFieldChange(test, 'errors_count', e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-extrabold font-mono tabular-nums bg-slate-50 dark:bg-[#0C1412] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#111C19] focus:outline-none focus:ring-2 focus:ring-[#354944] disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {/* Instant Live Score Preview Badge (Animated via motion) */}
        <AnimatePresence mode="wait">
          {liveScore !== null ? (
            <motion.div
              key={`${test.id}-${liveScore}`}
              initial={{ opacity: 0, scale: 0.94, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              data-testid={`combine-live-badge-${test.indicator_key}`}
              className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${classification.badgeClass}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Award className="w-4 h-4 shrink-0" />
                <span className="text-xs font-extrabold tracking-tight truncate tabular-nums">
                  Skor Otomatis: {liveScore}/100 - {classification.label}
                </span>
              </div>
              <span className="font-mono text-sm font-black tabular-nums shrink-0">
                {liveScore}
              </span>
            </motion.div>
          ) : (
            <div className="px-3 py-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>Isi hasil mentah untuk konversi skor otomatis 1–100</span>
              <span className="font-mono font-bold text-slate-400 tabular-nums">—/100</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-3.5 text-left" data-testid="scouting-combine-hub">
      {/* 1. CONTROL HEADER: ATHLETE, TIER, DATE, CATEGORY FILTER */}
      <div className="bg-white dark:bg-[#162320] rounded-2xl border border-slate-200/90 dark:border-white/10 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#354944] text-white flex items-center justify-center shrink-0 border border-[#C89D32]/50">
              <Timer className="w-4 h-4 text-[#C89D32]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight leading-snug">
                Scouting Combine Battery (Teknik &amp; Fisik)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Konversi instan stopwatch, akurasi &amp; repetisi ke skor 1–100 · {FOOTBALL_COMBINE_TIERS[normalizedTier]?.shortLabel}
              </p>
            </div>
          </div>

          {readyEntries.length > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center gap-1.5 self-start sm:self-center cursor-pointer transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Input ({readyEntries.length})</span>
            </button>
          )}
        </div>

        {/* Selectors Grid: compact 1-bar on mobile (athlete/tier already in top context bar), full 3-col on desktop */}
        {isMobile ? (
          <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-[#0C1412] px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                {selectedStudent?.studentName || 'Pilih Atlet'} · {FOOTBALL_COMBINE_TIERS[normalizedTier]?.shortLabel}
              </p>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Ubah atlet/jenjang di bar konteks atas
              </p>
            </div>
            <input
              id="combine-testing-date"
              aria-label="Tanggal Tes Lapangan"
              type="date"
              disabled={isArchived}
              value={testingDate}
              onChange={(e) => setTestingDate(e.target.value)}
              className="min-h-[38px] px-2 py-1 text-[11px] font-bold bg-white dark:bg-[#162320] border border-slate-200 dark:border-white/15 rounded-lg text-slate-900 dark:text-white shrink-0"
            />
          </div>
        ) : (
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
            <div>
              <label
                htmlFor="combine-athlete-select"
                className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Atlet ({students.length})</span>
              </label>
              <select
                id="combine-athlete-select"
                value={selectedStudent?.id || ''}
                onChange={(e) => onSelectStudentId && onSelectStudentId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-[#0C1412] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#354944] cursor-pointer"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.studentName} — {st.playerRole || st.position || 'ST'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="combine-tier-select"
                className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Tier Norma Benchmark</span>
              </label>
              <select
                id="combine-tier-select"
                value={normalizedTier}
                disabled={isArchived}
                onChange={(e) => onChangeTier && onChangeTier(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-[#0C1412] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#354944] cursor-pointer disabled:opacity-60"
              >
                {Object.values(FOOTBALL_COMBINE_TIERS).map((t) => (
                  <option key={t.tier} value={t.tier}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="combine-testing-date"
                className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Tanggal Tes Lapangan</span>
              </label>
              <input
                id="combine-testing-date"
                type="date"
                disabled={isArchived}
                value={testingDate}
                onChange={(e) => setTestingDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-[#0C1412] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#354944]"
              />
            </div>
          </div>
        )}

        {/* Category Filter Segmented Control */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-[#0C1412] rounded-xl">
          {[
            { key: 'ALL', label: `Semua (${catalogTests.length})` },
            { key: 'Teknik', label: `Teknik (${catalogTests.filter((t) => t.category === 'Teknik').length})` },
            { key: 'Fisik', label: `Fisik (${catalogTests.filter((t) => t.category === 'Fisik').length})` }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategoryFilter(tab.key)}
              className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                categoryFilter === tab.key
                  ? 'bg-[#354944] text-white shadow-2xs border-b-2 border-[#C89D32]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Alerts */}
      {syncSuccess && (
        <div
          data-testid="combine-sync-success"
          className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold rounded-2xl flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncSuccess}</span>
        </div>
      )}
      {syncError && (
        <div
          data-testid="combine-sync-error"
          className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold rounded-2xl flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* 2. TEKNIK TESTS GROUP */}
      {teknikTests.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Tes Lapangan · Kategori Teknik ({teknikTests.length})
              </h4>
            </div>
          </div>
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {teknikTests.map(renderTestCard)}
          </div>
        </section>
      )}

      {/* 3. FISIK TESTS GROUP */}
      {fisikTests.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Tes Lapangan · Kategori Fisik ({fisikTests.length})
              </h4>
            </div>
          </div>
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {fisikTests.map(renderTestCard)}
          </div>
        </section>
      )}

      {/* 4. STICKY / COMPACT SYNC ACTION BAR */}
      <div
        className={`sticky bottom-2 z-20 bg-white/95 dark:bg-[#162320]/95 backdrop-blur-sm rounded-2xl border p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-shadow ${
          readyEntries.length > 0
            ? 'border-[#354944]/40 dark:border-[#C89D32]/40 shadow-lg'
            : 'border-slate-200/90 dark:border-white/10 shadow-sm'
        }`}
      >
        <div className="space-y-0.5">
          <p className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
            {readyEntries.length > 0
              ? `${readyEntries.length} indikator terukur siap disinkronkan`
              : 'Belum ada hasil tes yang diisi'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Skor akan langsung memperbarui grafik Polar Area &amp; rapor utama {selectedStudent?.studentName || 'atlet'}.
          </p>
        </div>

        <button
          type="button"
          data-testid="combine-sync-button"
          disabled={isSyncing || isArchived || readyEntries.length === 0}
          onClick={handleSaveAndSync}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#354944] hover:bg-[#2B3D38] text-white text-xs sm:text-sm font-extrabold border-b-2 border-[#C89D32] shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menyinkronkan...</span>
            </>
          ) : (
            <>
              <span>Simpan &amp; Sinkronkan ke Rapor Atlet</span>
              <ArrowUpRight className="w-4 h-4 text-[#C89D32]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
