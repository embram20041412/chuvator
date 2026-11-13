import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Shield,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  Calendar,
  UserCheck,
  Layers,
  Award
} from 'lucide-react';
import scoutingCombineService from '../services/scoutingCombineService';
import {
  FOOTBALL_COMBINE_TIERS,
  RUBRIC_LEVEL_SCORE_MAP,
  RUBRIC_BEHAVIOR_DEFINITIONS,
  calculateRubricScore,
  getScoreClassification,
  getActiveTestsForTier
} from '../utils/combineScoringEngine';

const RUBRIC_CATEGORIES = ['Taktik', 'Mental', 'Komunikasi'];

function CategoryIcon({ category }) {
  if (category === 'Taktik') return <Brain className="w-4 h-4" />;
  if (category === 'Mental') return <Shield className="w-4 h-4" />;
  return <MessageSquare className="w-4 h-4" />;
}

export default function RubricAssessmentSheet({
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
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedLevels, setSelectedLevels] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const normalizedTier = Math.max(1, Math.min(4, Number(activeTier) || 1));

  const selectedStudent = useMemo(() => {
    if (!students || students.length === 0) return null;
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  const rubricTests = useMemo(() => {
    return getActiveTestsForTier(normalizedTier, RUBRIC_CATEGORIES);
  }, [normalizedTier]);

  const visibleTests = useMemo(() => {
    if (categoryFilter === 'ALL') return rubricTests;
    return rubricTests.filter((t) => t.category === categoryFilter);
  }, [rubricTests, categoryFilter]);

  useEffect(() => {
    setSelectedLevels({});
    setSyncSuccess(null);
    setSyncError(null);
  }, [selectedStudent?.id]);

  const handleSelectLevel = (testId, level) => {
    if (isArchived) return;
    setSyncSuccess(null);
    setSyncError(null);
    setSelectedLevels((prev) => ({
      ...prev,
      [testId]: level
    }));
  };

  const readyEntries = useMemo(() => {
    return rubricTests
      .map((test) => {
        const level = selectedLevels[test.id];
        if (!level) return null;
        const score = calculateRubricScore(level);
        if (score === null) return null;
        return {
          testId: test.id,
          indicatorKey: test.indicator_key,
          indicatorLabel: test.indicator_label,
          category: test.category,
          measurement_type: 'RUBRIC',
          raw_value_1: Number(level),
          raw_value_2: 5,
          errors_count: 0,
          calculated_score: score
        };
      })
      .filter(Boolean);
  }, [rubricTests, selectedLevels]);

  const handleSaveAndSync = async () => {
    if (isArchived) {
      setSyncError('Kelas ini diarsipkan (mode baca-saja).');
      return;
    }
    if (!selectedStudent?.id || !tenantId) {
      setSyncError('Pilih atlet terlebih dahulu.');
      return;
    }
    if (readyEntries.length === 0) {
      setSyncError('Pilih minimal satu level rubrik (1–5) terlebih dahulu.');
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
        `${readyEntries.length} rubrik perilaku ${selectedStudent.studentName} tersimpan & disinkronkan ke Rapor Polar Area.`
      );

      if (onSyncedToReport) {
        onSyncedToReport(indicatorScoresMap, {
          syncedCount: readyEntries.length,
          sourceType: 'rubric'
        });
      }
    } catch (err) {
      console.error('[RubricAssessmentSheet] Sync error:', err);
      setSyncError(err?.message || 'Gagal menyimpan penilaian rubrik.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-3.5 text-left" data-testid="rubric-assessment-sheet">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-[#162320] rounded-2xl border border-slate-200/90 dark:border-white/10 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#354944] text-white flex items-center justify-center shrink-0 border border-[#C89D32]/50">
              <Brain className="w-4 h-4 text-[#C89D32]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight leading-snug">
                Rubrik Perilaku Lapangan (Taktik, Mental &amp; Komunikasi)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Skala anchored 1–5 (Lv.1=35 · Lv.2=52 · Lv.3=70 · Lv.4=84 · Lv.5=95)
              </p>
            </div>
          </div>
        </div>

        {/* Selectors: compact 1-bar on mobile (athlete/tier already in top context bar), full 3-col on desktop */}
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
              id="rubric-date-input"
              aria-label="Tanggal Observasi"
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
                htmlFor="rubric-athlete-select"
                className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Atlet ({students.length})</span>
              </label>
              <select
                id="rubric-athlete-select"
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
                htmlFor="rubric-tier-select"
                className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Tier Usia</span>
              </label>
              <select
                id="rubric-tier-select"
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
                htmlFor="rubric-date-input"
                className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Tanggal Observasi</span>
              </label>
              <input
                id="rubric-date-input"
                type="date"
                disabled={isArchived}
                value={testingDate}
                onChange={(e) => setTestingDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-[#0C1412] border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#354944]"
              />
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-[#0C1412] rounded-xl">
          {[
            { key: 'ALL', label: `Semua (${rubricTests.length})` },
            { key: 'Taktik', label: 'Taktik' },
            { key: 'Mental', label: 'Mental' },
            { key: 'Komunikasi', label: 'Komunikasi' }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategoryFilter(tab.key)}
              className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer truncate ${
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

      {syncSuccess && (
        <div
          data-testid="rubric-sync-success"
          className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold rounded-2xl flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncSuccess}</span>
        </div>
      )}
      {syncError && (
        <div
          data-testid="rubric-sync-error"
          className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold rounded-2xl flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Rubric Cards */}
      <div className="space-y-3">
        {visibleTests.map((test) => {
          const def = RUBRIC_BEHAVIOR_DEFINITIONS[test.indicator_key];
          const chosenLevel = selectedLevels[test.id] || null;
          const liveScore = chosenLevel ? calculateRubricScore(chosenLevel) : null;
          const classification = getScoreClassification(liveScore);
          const existingRecord = existingIndicatorScores?.[test.indicator_key];

          return (
            <div
              key={test.id}
              data-testid={`rubric-card-${test.indicator_key}`}
              className="bg-white dark:bg-[#162320] rounded-2xl border border-slate-200/90 dark:border-white/10 p-3.5 sm:p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                    <CategoryIcon category={test.category} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {test.indicator_label}
                    </h4>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {test.category} · {test.description}
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

              {/* 1–5 Anchored Level Buttons */}
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const mappedScore = RUBRIC_LEVEL_SCORE_MAP[lvl];
                  const isActive = chosenLevel === lvl;
                  const levelDef = def?.levels?.[lvl];
                  return (
                    <button
                      key={lvl}
                      type="button"
                      disabled={isArchived}
                      data-testid={`rubric-level-${test.indicator_key}-${lvl}`}
                      onClick={() => handleSelectLevel(test.id, lvl)}
                      className={`min-h-[52px] px-1.5 py-2 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-50 ${
                        isActive
                          ? 'bg-[#354944] text-white border-[#C89D32] shadow-sm ring-2 ring-[#C89D32]/40'
                          : 'bg-slate-50 dark:bg-[#0C1412] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/15 hover:border-[#354944]/50'
                      }`}
                      title={levelDef ? `${levelDef.label}: ${levelDef.desc}` : `Level ${lvl}`}
                    >
                      <span className="text-xs sm:text-sm font-black tabular-nums">Lv.{lvl}</span>
                      <span
                        className={`text-[10px] font-mono font-bold tabular-nums ${
                          isActive ? 'text-[#C89D32]' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Skor {mappedScore}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Concrete On-Pitch Behavioral Description & Live Score Preview */}
              <AnimatePresence mode="wait">
                {chosenLevel && def?.levels?.[chosenLevel] ? (
                  <motion.div
                    key={`${test.id}-lv-${chosenLevel}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-2"
                  >
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0C1412] border border-slate-200/80 dark:border-white/10">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Level {chosenLevel}: {def.levels[chosenLevel].label}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                        {def.levels[chosenLevel].desc}
                      </p>
                    </div>

                    <div
                      data-testid={`rubric-live-badge-${test.indicator_key}`}
                      className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${classification.badgeClass}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Award className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-extrabold truncate tabular-nums">
                          Skor Otomatis: {liveScore}/100 - {classification.label}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black tabular-nums shrink-0">
                        {liveScore}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400">
                    Pilih Level 1 ({def?.levels?.[1]?.label || 'Pasif'}) hingga Level 5 ({def?.levels?.[5]?.label || 'Proaktif'}) sesuai observasi di lapangan.
                  </div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Save & Sync CTA */}
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
              ? `${readyEntries.length} rubrik siap disinkronkan`
              : 'Pilih level perilaku pada indikator yang dinilai'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Nilai otomatis memperbarui pilar Taktik, Mental &amp; Komunikasi di Grafik Polar Area.
          </p>
        </div>

        <button
          type="button"
          data-testid="rubric-sync-button"
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
              <span>Simpan &amp; Sinkronkan Rubrik</span>
              <ArrowUpRight className="w-4 h-4 text-[#C89D32]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
