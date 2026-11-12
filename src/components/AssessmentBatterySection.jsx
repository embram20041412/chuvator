import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Timer,
  Ruler,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  ClipboardCheck,
  History,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ShieldAlert,
  Trash2,
  Sparkles,
  FileSpreadsheet,
  SlidersHorizontal,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

import {
  FOOTBALL_TEST_BATTERY_CATALOG,
  TEST_INPUT_SCHEMA_TYPES,
  DEVELOPMENT_TIERS,
  FOOTBALL_POSITIONS,
  TIER_1_POSITIONS,
  getTestDefinitionById,
  getTestsWithAthleteApplicability,
  normalizeTierIdentifier,
  detectTierFromAge
} from '../config/footballTestBatteryCatalog.js';

import {
  createInitialTestEntryDraft,
  validateAndComputeTestBatteryEntry,
  computeBleepCumulativeMetrics
} from '../utils/testBatteryValidator.js';

import {
  saveAthleteTestResult,
  getAthleteTestResults,
  getLatestTestResultsByIndicatorMap,
  deleteAthleteTestResult
} from '../services/assessmentBatteryService.js';

/**
 * Menentukan Development Tier atlet dari kelas aktif atau usia atlet
 */
function resolveAthleteTierKey(student, selectedClass) {
  const classTierCode = selectedClass?.tierCode || selectedClass?.tier_code || '';
  const classTierLabel = selectedClass?.tierLabel || selectedClass?.tier_label || selectedClass?.className || '';

  if (classTierCode || classTierLabel) {
    const combined = `${classTierCode} ${classTierLabel}`.toUpperCase();
    if (combined.includes('TIER_1') || combined.includes('FASE 1') || combined.includes('JOY') || combined.includes('U-8') || combined.includes('KU-8')) {
      return 'TIER_1_GRASSROOTS';
    }
    if (combined.includes('TIER_2') || combined.includes('FASE 2') || combined.includes('SKILL') || combined.includes('U-10') || combined.includes('U-12') || combined.includes('KU-10') || combined.includes('KU-12')) {
      return 'TIER_2_FOUNDATION';
    }
    if (combined.includes('TIER_3') || combined.includes('FASE 3') || combined.includes('TACTICAL') || combined.includes('U-14') || combined.includes('U-15') || combined.includes('U-16') || combined.includes('KU-14')) {
      return 'TIER_3_YOUTH_DEV';
    }
    if (combined.includes('TIER_4') || combined.includes('FASE 4') || combined.includes('PERFORMANCE') || combined.includes('U-18') || combined.includes('KU-18') || combined.includes('SENIOR')) {
      return 'TIER_4_ELITE_PRO';
    }
  }

  const birthOrAge = student?.birthDate || student?.birth_date || student?.age;
  const detectedNum = detectTierFromAge(birthOrAge);
  if (typeof detectedNum === 'number') {
    return normalizeTierIdentifier(detectedNum);
  }
  return 'TIER_2_FOUNDATION';
}

/**
 * Menentukan kode posisi atlet dari profil siswa
 */
function resolveAthletePositionCode(student, tierKey) {
  const rawRole = String(student?.playerRole || student?.player_role || student?.position || '').trim().toUpperCase();
  if (tierKey === 'TIER_1_GRASSROOTS') {
    if (rawRole.includes('GK') || rawRole.includes('KIPER') || rawRole.includes('PENJAGA GAWANG')) {
      return 'GK_SSB';
    }
    return 'OUTFIELD_SSB';
  }

  if (!rawRole || rawRole === 'ALL-ROUNDER' || rawRole === 'POSITION_UNVERIFIED') {
    return 'CM';
  }
  if (rawRole === 'WFR' || rawRole === 'WFL' || rawRole === 'LW' || rawRole === 'RW' || rawRole === 'WFR/WFL') {
    return 'WFR/WFL';
  }
  if (rawRole === 'LB' || rawRole === 'RB' || rawRole === 'LB/RB') {
    return 'LB/RB';
  }
  if (rawRole === 'LM' || rawRole === 'RM' || rawRole === 'LM/RM') {
    return 'LM/RM';
  }
  return rawRole;
}

export default function AssessmentBatterySection({
  userProfile,
  activeAcademy,
  selectedClass,
  students = [],
  initialStudent = null,
  initialTestId = null,
  singleStudentMode = false,
  onSavedResult = null
}) {
  const tenantId = userProfile?.tenantId || userProfile?.tenant_id || '';

  // Daftar siswa yang berada pada kelas aktif (atau semua siswa jika singleStudentMode)
  const availableStudents = useMemo(() => {
    if (singleStudentMode && initialStudent) {
      return [initialStudent];
    }
    if (!Array.isArray(students)) return [];
    if (selectedClass?.id) {
      const filtered = students.filter(
        (s) => String(s.classId || s.class_id || '') === String(selectedClass.id)
      );
      if (filtered.length > 0) return filtered;
    }
    return students;
  }, [students, selectedClass, singleStudentMode, initialStudent]);

  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    if (initialStudent?.id) return String(initialStudent.id);
    if (availableStudents.length > 0) return String(availableStudents[0].id);
    return '';
  });

  // Sinkronkan ketika daftar siswa atau initialStudent berubah
  useEffect(() => {
    if (initialStudent?.id) {
      setSelectedStudentId(String(initialStudent.id));
      return;
    }
    if (availableStudents.length > 0) {
      const exists = availableStudents.some((s) => String(s.id) === String(selectedStudentId));
      if (!exists) {
        setSelectedStudentId(String(availableStudents[0].id));
      }
    } else {
      setSelectedStudentId('');
    }
  }, [initialStudent, availableStudents, selectedStudentId]);

  const activeStudent = useMemo(() => {
    if (singleStudentMode && initialStudent) return initialStudent;
    return availableStudents.find((s) => String(s.id) === String(selectedStudentId)) || null;
  }, [singleStudentMode, initialStudent, availableStudents, selectedStudentId]);

  // Tier & Posisi aktif untuk penyaringan katalog tes
  const detectedTierKey = useMemo(
    () => resolveAthleteTierKey(activeStudent, selectedClass),
    [activeStudent, selectedClass]
  );

  const [activeTierKey, setActiveTierKey] = useState(detectedTierKey);
  const [activePositionCode, setActivePositionCode] = useState(() =>
    resolveAthletePositionCode(activeStudent, detectedTierKey)
  );

  useEffect(() => {
    const nextTier = resolveAthleteTierKey(activeStudent, selectedClass);
    setActiveTierKey(nextTier);
    setActivePositionCode(resolveAthletePositionCode(activeStudent, nextTier));
  }, [activeStudent, selectedClass]);

  // Filter Katalog Tes
  const [applicabilityFilter, setApplicabilityFilter] = useState('APPLICABLE_ONLY'); // 'APPLICABLE_ONLY' | 'ALL_18'
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'physical' | 'technical' | 'position_specific'
  const [selectedTestId, setSelectedTestId] = useState(initialTestId || 'TST-SPR-10M');
  const [showProtocolDetail, setShowProtocolDetail] = useState(true);
  const [historyFilterMode, setHistoryFilterMode] = useState('ALL_TESTS'); // 'ALL_TESTS' | 'ACTIVE_TEST'

  // State Form Pengukuran Mentah
  const [entryDraft, setEntryDraft] = useState(() =>
    createInitialTestEntryDraft(initialTestId || 'TST-SPR-10M')
  );
  const [validationErrors, setValidationErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // State Riwayat Tes Atlet
  const [athleteHistory, setAthleteHistory] = useState([]);
  const [latestByIndicator, setLatestByIndicator] = useState({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Daftar tes dengan evaluasi kesesuaian Tier & Posisi
  const testsWithApplicability = useMemo(
    () => getTestsWithAthleteApplicability(activeTierKey, activePositionCode),
    [activeTierKey, activePositionCode]
  );

  const filteredCatalogTests = useMemo(() => {
    return testsWithApplicability.filter((test) => {
      if (applicabilityFilter === 'APPLICABLE_ONLY' && !test.applicability.isApplicable) {
        return false;
      }
      if (categoryFilter !== 'ALL' && test.categoryId !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [testsWithApplicability, applicabilityFilter, categoryFilter]);

  // Pastikan selectedTestId tetap valid saat filter berubah
  useEffect(() => {
    if (filteredCatalogTests.length > 0) {
      const stillVisible = filteredCatalogTests.some((t) => t.testId === selectedTestId);
      if (!stillVisible) {
        setSelectedTestId(filteredCatalogTests[0].testId);
      }
    }
  }, [filteredCatalogTests, selectedTestId]);

  const activeTestDef = useMemo(
    () => getTestDefinitionById(selectedTestId) || FOOTBALL_TEST_BATTERY_CATALOG[0],
    [selectedTestId]
  );

  const activeTestApplicability = useMemo(() => {
    const found = testsWithApplicability.find((t) => t.testId === activeTestDef?.testId);
    return found?.applicability || { isApplicable: true, reason: '' };
  }, [testsWithApplicability, activeTestDef]);

  // Reset form draft ketika memilih tes baru
  useEffect(() => {
    if (activeTestDef) {
      setEntryDraft((prev) => createInitialTestEntryDraft(activeTestDef.testId, prev?.testDate));
      setValidationErrors([]);
      setFieldErrors({});
      setSaveFeedback(null);
    }
  }, [activeTestDef]);

  // Muat riwayat hasil tes atlet
  const loadAthleteHistory = useCallback(async () => {
    if (!tenantId || !activeStudent?.id) {
      setAthleteHistory([]);
      setLatestByIndicator({});
      return;
    }
    setIsLoadingHistory(true);
    try {
      const [historyList, latestMap] = await Promise.all([
        getAthleteTestResults(userProfile, activeStudent.id),
        getLatestTestResultsByIndicatorMap(userProfile, activeStudent.id)
      ]);
      setAthleteHistory(historyList);
      setLatestByIndicator(latestMap);
    } catch (err) {
      console.error('[AssessmentBatterySection] Gagal memuat riwayat tes atlet:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [tenantId, activeStudent?.id, userProfile]);

  useEffect(() => {
    loadAthleteHistory();
  }, [loadAthleteHistory]);

  // Pratinjau hasil perhitungan real-time saat form diisi
  const livePreviewValidation = useMemo(() => {
    if (!entryDraft) return null;
    return validateAndComputeTestBatteryEntry(entryDraft);
  }, [entryDraft]);

  // Pratinjau khusus Bleep Test saat Level & Shuttle diisi
  const liveBleepPreview = useMemo(() => {
    if (activeTestDef?.inputSchemaType !== TEST_INPUT_SCHEMA_TYPES.BLEEP_SHUTTLE_LEVEL) return null;
    const lvl = entryDraft?.auxiliaryInputs?.levelReached;
    const sht = entryDraft?.auxiliaryInputs?.shuttleReached;
    if (!lvl && !sht) return null;
    return computeBleepCumulativeMetrics(lvl, sht);
  }, [activeTestDef, entryDraft]);

  // Handlers perubahan input form
  const handleTrialInputChange = (trialIndex, newRawValue) => {
    setValidationErrors([]);
    setFieldErrors({});
    setSaveFeedback(null);
    setEntryDraft((prev) => {
      if (!prev) return prev;
      const nextTrials = prev.trials.map((t, idx) =>
        idx === trialIndex ? { ...t, rawInput: newRawValue } : t
      );
      return { ...prev, trials: nextTrials };
    });
  };

  const handleTrialValidityToggle = (trialIndex, nextIsValid) => {
    setValidationErrors([]);
    setFieldErrors({});
    setSaveFeedback(null);
    setEntryDraft((prev) => {
      if (!prev) return prev;
      const nextTrials = prev.trials.map((t, idx) =>
        idx === trialIndex
          ? {
              ...t,
              isValid: nextIsValid,
              invalidReason: nextIsValid ? '' : t.invalidReason || 'Percobaan gagal / pelanggaran garis'
            }
          : t
      );
      return { ...prev, trials: nextTrials };
    });
  };

  const handleTrialInvalidReasonChange = (trialIndex, reason) => {
    setEntryDraft((prev) => {
      if (!prev) return prev;
      const nextTrials = prev.trials.map((t, idx) =>
        idx === trialIndex ? { ...t, invalidReason: reason } : t
      );
      return { ...prev, trials: nextTrials };
    });
  };

  const handleAuxInputChange = (fieldKey, value) => {
    setValidationErrors([]);
    setFieldErrors({});
    setSaveFeedback(null);
    setEntryDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        auxiliaryInputs: {
          ...prev.auxiliaryInputs,
          [fieldKey]: value
        }
      };
    });
  };

  const handleSaveTestResult = async (e) => {
    e.preventDefault();
    setValidationErrors([]);
    setFieldErrors({});
    setSaveFeedback(null);

    if (!activeStudent?.id) {
      setValidationErrors(['Pilih atlet terlebih dahulu sebelum menyimpan hasil pengukuran.']);
      return;
    }

    const check = validateAndComputeTestBatteryEntry(entryDraft);
    if (!check.isValid) {
      setValidationErrors(check.errors);
      setFieldErrors(check.fieldErrors || {});
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveAthleteTestResult(userProfile, {
        ...entryDraft,
        academyId: activeAcademy?.id || activeStudent?.academyId || null,
        classId: selectedClass?.id || activeStudent?.classId || null,
        studentId: activeStudent.id,
        studentTenantId: activeStudent.tenantId || activeStudent.tenant_id || tenantId,
        developmentTier: activeTierKey,
        positionCode: activePositionCode
      });

      setSaveFeedback({
        type: 'success',
        message: `Hasil ${activeTestDef.shortName} (${saved.finalDisplayValue}) berhasil disimpan untuk ${activeStudent.studentName || activeStudent.name} dengan status PENDING_CALIBRATION.`
      });

      // Reset input nilai percobaan agar siap untuk pencatatan berikutnya
      setEntryDraft(createInitialTestEntryDraft(activeTestDef.testId, entryDraft.testDate));
      await loadAthleteHistory();

      if (typeof onSavedResult === 'function') {
        onSavedResult(saved);
      }
    } catch (err) {
      if (Array.isArray(err.validationErrors) && err.validationErrors.length > 0) {
        setValidationErrors(err.validationErrors);
        setFieldErrors(err.fieldErrors || {});
      } else {
        setValidationErrors([err.message || 'Gagal menyimpan hasil pengukuran tes.']);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistoryItem = async (recordId) => {
    if (!recordId) return;
    try {
      await deleteAthleteTestResult(userProfile, recordId);
      await loadAthleteHistory();
    } catch (err) {
      setValidationErrors([err.message || 'Gagal menghapus riwayat tes.']);
    }
  };

  const displayedHistory = useMemo(() => {
    if (historyFilterMode === 'ACTIVE_TEST' && activeTestDef) {
      return athleteHistory.filter((h) => h.testId === activeTestDef.testId);
    }
    return athleteHistory;
  }, [athleteHistory, historyFilterMode, activeTestDef]);

  const positionOptions = useMemo(() => {
    if (activeTierKey === 'TIER_1_GRASSROOTS') {
      return TIER_1_POSITIONS;
    }
    return FOOTBALL_POSITIONS;
  }, [activeTierKey]);

  return (
    <div className="space-y-5" data-testid="assessment-battery-section">
      {/* ===================================================================
          HEADER & BANNER PRINSIP PENGUKURAN OBJEKTIF (FASE 1)
         =================================================================== */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 p-4 sm:p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-400/30">
              <Timer className="h-3.5 w-3.5" />
              <span>SCOUTING COMBINE & FIELD TEST BATTERY • FASE 1 (RAW DATA CAPTURE)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Pengukuran Lapangan Indikator Objektif Sepak Bola (18 Tes Standar SSB)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Catat hasil pengukuran mentah (detik, sentimeter, meter, repetisi, atau shuttle) langsung dari lapangan.
              Data disimpan secara autentik dengan status <span className="font-mono font-semibold text-amber-300">PENDING_CALIBRATION</span> tanpa mengarang norma skor 1–100 sebelum kalibrasi populasi tersedia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-300">Cakupan Atlet Ini</div>
              <div className="text-sm font-bold text-emerald-300">
                {Object.keys(latestByIndicator).length} / 18 Indikator Diuji
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================
          BARIS KONTROL ATLET, JENJANG (TIER), DAN POSISI
         =================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Pemilih Atlet */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              1. Atlet yang Diuji
            </label>
            {singleStudentMode && activeStudent ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 min-h-[44px]">
                <UserCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-slate-900 truncate">
                    {activeStudent.studentName || activeStudent.name}
                  </div>
                  <div className="text-xs text-slate-600 truncate">
                    {activeStudent.className || selectedClass?.className || 'Atlet SSB'}
                  </div>
                </div>
              </div>
            ) : (
              <select
                data-testid="battery-student-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none min-h-[44px]"
              >
                {availableStudents.length === 0 ? (
                  <option value="">-- Belum ada atlet di kelas ini --</option>
                ) : (
                  availableStudents.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.studentName || stu.name} ({stu.playerRole || stu.position || 'Umum'})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Pemilih Development Tier */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              2. Jenjang Pengembangan (Development Tier)
            </label>
            <select
              data-testid="battery-tier-select"
              value={activeTierKey}
              onChange={(e) => {
                const nextTier = e.target.value;
                setActiveTierKey(nextTier);
                if (nextTier === 'TIER_1_GRASSROOTS' && activePositionCode !== 'GK_SSB' && activePositionCode !== 'OUTFIELD_SSB') {
                  setActivePositionCode('OUTFIELD_SSB');
                } else if (nextTier !== 'TIER_1_GRASSROOTS' && (activePositionCode === 'OUTFIELD_SSB' || activePositionCode === 'GK_SSB')) {
                  setActivePositionCode(activePositionCode === 'GK_SSB' ? 'GK' : 'CM');
                }
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none min-h-[44px]"
            >
              {Object.entries(DEVELOPMENT_TIERS).map(([tierKey, cfg]) => (
                <option key={tierKey} value={tierKey}>
                  {cfg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pemilih Posisi Atlet */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              3. Konteks Posisi Atlet
            </label>
            <select
              data-testid="battery-position-select"
              value={activePositionCode}
              onChange={(e) => setActivePositionCode(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none min-h-[44px]"
            >
              {positionOptions.map((pos) => (
                <option key={pos.code} value={pos.code}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ===================================================================
          GRID UTAMA: KATALOG 18 TES (KIRI) & FORM INPUT LAPANGAN (KANAN)
         =================================================================== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* KOLOM KIRI: PEMILIH TES DARI 18 KATALOG */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
                <span>Pilih Metode Tes ({filteredCatalogTests.length})</span>
              </h3>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  data-testid="filter-applicable-tests"
                  onClick={() => setApplicabilityFilter('APPLICABLE_ONLY')}
                  className={`rounded-md px-2.5 py-1.5 transition ${
                    applicabilityFilter === 'APPLICABLE_ONLY'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sesuai Atlet
                </button>
                <button
                  type="button"
                  data-testid="filter-all-tests"
                  onClick={() => setApplicabilityFilter('ALL_18')}
                  className={`rounded-md px-2.5 py-1.5 transition ${
                    applicabilityFilter === 'ALL_18'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua (18)
                </button>
              </div>
            </div>

            {/* Filter Kategori Indikator */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'ALL', label: 'Semua Kategori' },
                { key: 'physical', label: 'Fisik (13)' },
                { key: 'technical', label: 'Teknik (1)' },
                { key: 'position_specific', label: 'Khusus Posisi (4)' }
              ].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition min-h-[36px] ${
                    categoryFilter === cat.key
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Daftar Kartu Tes */}
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {filteredCatalogTests.map((testItem) => {
                const isSelected = testItem.testId === activeTestDef?.testId;
                const latestRecord = latestByIndicator[testItem.indicatorId];

                return (
                  <button
                    key={testItem.testId}
                    type="button"
                    data-testid={`test-card-${testItem.testId}`}
                    onClick={() => setSelectedTestId(testItem.testId)}
                    className={`w-full text-left rounded-xl border p-3 transition flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                            {testItem.indicatorId}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {testItem.testId}
                          </span>
                          {testItem.mappingReadiness === 'NEEDS_FURTHER_DESIGN' && (
                            <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                              Proxy Lapangan
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-sm text-slate-900 mt-1">
                          {testItem.indicatorName} — <span className="font-semibold text-slate-700">{testItem.shortName}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                        {testItem.unit}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <span>
                        {testItem.categoryLabel} • {testItem.requiredTrialsCount} percobaan
                      </span>
                      {latestRecord ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 className="h-3 w-3" />
                          Terakhir: {latestRecord.finalDisplayValue}
                        </span>
                      ) : (
                        <span className="text-slate-400">Belum diuji</span>
                      )}
                    </div>

                    {!testItem.applicability.isApplicable && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200 rounded px-2 py-1 mt-0.5">
                        Info Jenjang/Posisi: {testItem.applicability.reason}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: INSTRUKSI PROTOKOL & FORM PENCATATAN DATA MENTAH */}
        <div className="lg:col-span-7 space-y-4">
          {activeTestDef && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Header Tes Aktif */}
              <div className="border-b border-slate-200 bg-slate-900 px-4 py-4 sm:px-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
                      {activeTestDef.testId}
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-slate-200">
                      Indikator: {activeTestDef.indicatorId}
                    </span>
                    <span className="rounded-md bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-200">
                      PENDING_CALIBRATION
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-300">
                    Satuan: <strong className="text-white">{activeTestDef.unitLabel}</strong>
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white mt-2">
                  {activeTestDef.indicatorName}: {activeTestDef.testName}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeTestDef.subcategory} • Berlaku untuk: {activeTestDef.applicablePositionLabel} ({activeTestDef.ageApplicability})
                </p>
              </div>

              {/* Peringatan jika tes di luar tier/posisi atlet saat ini */}
              {!activeTestApplicability.isApplicable && (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Catatan Kesesuaian Kurikulum: </span>
                    {activeTestApplicability.reason}. Anda tetap dapat mencatat data mentah jika diperlukan untuk pemantauan khusus.
                  </div>
                </div>
              )}

              {/* Peringatan Metodologi khusus TST-SHT-DST (Kekuatan Tembakan) */}
              {activeTestDef.mappingReadiness === 'NEEDS_FURTHER_DESIGN' && (
                <div
                  data-testid="methodology-proxy-warning"
                  className="border-b border-amber-300 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5"
                >
                  <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold uppercase tracking-wide text-amber-900">
                      Peringatan Validitas Konstruk — NEEDS FURTHER DESIGN (Indirect Aerodynamic Proxy)
                    </div>
                    <p className="mt-0.5 text-amber-900/90">
                      {activeTestDef.methodologicalNote} Jangan menginterpretasikan jarak lambung bola (meter) sebagai pengukuran langsung kecepatan tembakan (km/jam).
                    </p>
                  </div>
                </div>
              )}

              {/* Panel Instruksi & Prosedur Lapangan (Collapsible) */}
              <div className="border-b border-slate-200 bg-slate-50/70">
                <button
                  type="button"
                  data-testid="toggle-protocol-instructions"
                  onClick={() => setShowProtocolDetail((prev) => !prev)}
                  className="w-full px-4 py-3 sm:px-5 flex items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100/80 transition min-h-[44px]"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                    <span>Prosedur Lapangan, Peralatan & Aturan Validitas Tes</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    {showProtocolDetail ? 'Sembunyikan' : 'Tampilkan'}
                    {showProtocolDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                {showProtocolDetail && (
                  <div className="px-4 pb-4 sm:px-5 space-y-3 text-xs text-slate-700 border-t border-slate-200/80 pt-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-3 border border-slate-200">
                        <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                          <Ruler className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Peralatan Sederhana</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                          {activeTestDef.equipment.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl bg-white p-3 border border-slate-200">
                        <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Setup Lapangan & Istirahat</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{activeTestDef.fieldSetup}</p>
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
                          Jeda Istirahat Antar-Percobaan:{' '}
                          <span className="text-slate-800">
                            {activeTestDef.restBetweenTrialsSec > 0
                              ? `${activeTestDef.restBetweenTrialsSec} detik`
                              : '1 Percobaan Maksimal'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-3 border border-slate-200">
                      <div className="font-bold text-slate-900 mb-1">Instruksi Pelaksanaan Pelatih & Atlet:</div>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                        {activeTestDef.instructions.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-200">
                      <div className="font-bold text-amber-950 mb-1 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-amber-700" />
                        <span>Kriteria Percobaan Sah, Tidak Sah & Keselamatan:</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-amber-900">
                        {activeTestDef.validityRules.map((rule, idx) => (
                          <li key={idx}>{rule}</li>
                        ))}
                      </ul>
                      <div className="mt-2 pt-2 border-t border-amber-200/70 text-[11px] font-semibold text-amber-950">
                        Metode Penentuan Hasil Akhir: <span className="font-mono">{activeTestDef.finalResultMethod}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* FORM INPUT PENGUKURAN MENTAH */}
              {entryDraft && (
                <form onSubmit={handleSaveTestResult} className="p-4 sm:p-5 space-y-4" noValidate>
                  {/* Tanggal & Kondisi Lapangan */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Tanggal Pengukuran
                      </label>
                      <input
                        type="date"
                        data-testid="battery-test-date"
                        value={entryDraft.testDate}
                        onChange={(e) =>
                          setEntryDraft((prev) => ({ ...prev, testDate: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none min-h-[44px]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Kondisi Permukaan Lapangan
                      </label>
                      <select
                        data-testid="battery-surface-select"
                        value={entryDraft.surfaceCondition}
                        onChange={(e) =>
                          setEntryDraft((prev) => ({ ...prev, surfaceCondition: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none min-h-[44px]"
                      >
                        <option value="Rumput Alami Standar (Kering)">Rumput Alami Standar (Kering)</option>
                        <option value="Rumput Sintetis (Artificial Turf)">Rumput Sintetis (Artificial Turf)</option>
                        <option value="Rumput Alami Lembab / Basah">Rumput Alami Lembab / Basah</option>
                        <option value="Lapangan Tanah Padat / Indoor">Lapangan Tanah Padat / Indoor</option>
                      </select>
                    </div>
                  </div>

                  {/* Input Tambahan Wajib (Auxiliary Fields): mis. Tinggi Raihan Berdiri H1 atau Level/Shuttle Bleep Test */}
                  {Array.isArray(activeTestDef.auxiliaryFields) && activeTestDef.auxiliaryFields.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                        Parameter Pengukuran Dasar Wajib
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {activeTestDef.auxiliaryFields.map((aux) => (
                          <div key={aux.key}>
                            <label className="block text-xs font-bold text-slate-800 mb-1">
                              {aux.label} ({aux.unit}) <span className="text-rose-600">*</span>
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                step={aux.step || 'any'}
                                min={aux.min}
                                max={aux.max}
                                data-testid={`aux-input-${aux.key}`}
                                placeholder={`Masukkan ${aux.label} (${aux.unit})`}
                                value={entryDraft.auxiliaryInputs?.[aux.key] ?? ''}
                                onChange={(e) => handleAuxInputChange(aux.key, e.target.value)}
                                className={`w-full rounded-xl border px-3.5 py-2.5 pr-16 text-sm font-bold text-slate-900 bg-white focus:outline-none min-h-[44px] ${
                                  fieldErrors[`aux.${aux.key}`]
                                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                                    : 'border-slate-300 focus:border-emerald-600'
                                }`}
                              />
                              <span className="absolute right-3 font-mono text-xs font-bold text-slate-500">
                                {aux.unit}
                              </span>
                            </div>
                            {aux.helpText && (
                              <p className="text-[11px] text-slate-600 mt-1">{aux.helpText}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Pratinjau Langsung Jarak Kumulatif Bleep Test */}
                      {liveBleepPreview && (
                        <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 text-xs">
                          {liveBleepPreview.isValid ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-950">
                              <span>
                                Konversi Otomatis Leger Protocol: <strong>{liveBleepPreview.formattedLevelShuttle}</strong> ({liveBleepPreview.cumulativeShuttles} balikan x 20m)
                              </span>
                              <span className="font-mono text-sm font-bold text-emerald-700">
                                = {liveBleepPreview.cumulativeDistanceMeters} meter
                              </span>
                            </div>
                          ) : (
                            <div className="text-rose-700 font-semibold">{liveBleepPreview.error}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input Percobaan (Trials) — disembunyikan untuk Bleep Test karena dihitung otomatis dari Level & Shuttle */}
                  {activeTestDef.inputSchemaType !== TEST_INPUT_SCHEMA_TYPES.BLEEP_SHUTTLE_LEVEL && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Input Hasil Mentah Per Percobaan ({entryDraft.trials.length} Slot Wajib)
                        </label>
                        <span className="text-[11px] text-slate-500">
                          Kosong ≠ 0 • Tandai &ldquo;Tidak Sah&rdquo; jika percobaan gagal
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {entryDraft.trials.map((trial, idx) => {
                          const hasErr = Boolean(fieldErrors[`trial.${idx}`]);
                          return (
                            <div
                              key={trial.trialNumber}
                              className={`rounded-xl border p-3 transition ${
                                !trial.isValid
                                  ? 'border-amber-300 bg-amber-50/50'
                                  : hasErr
                                  ? 'border-rose-400 bg-rose-50/30'
                                  : 'border-slate-200 bg-slate-50/70'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-bold text-slate-800">
                                  {trial.label}
                                </span>
                                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
                                  <button
                                    type="button"
                                    data-testid={`trial-valid-btn-${idx}`}
                                    onClick={() => handleTrialValidityToggle(idx, true)}
                                    className={`rounded px-2 py-1 transition ${
                                      trial.isValid
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Sah
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`trial-invalid-btn-${idx}`}
                                    onClick={() => handleTrialValidityToggle(idx, false)}
                                    className={`rounded px-2 py-1 transition ${
                                      !trial.isValid
                                        ? 'bg-amber-600 text-white'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Tidak Sah
                                  </button>
                                </div>
                              </div>

                              {trial.isValid ? (
                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step={activeTestDef.valueConstraints?.step || 'any'}
                                    min={activeTestDef.valueConstraints?.min}
                                    max={activeTestDef.valueConstraints?.max}
                                    data-testid={`trial-input-${idx}`}
                                    placeholder={`Nilai (${activeTestDef.unit})`}
                                    value={trial.rawInput}
                                    onChange={(e) => handleTrialInputChange(idx, e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-12 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none min-h-[44px]"
                                  />
                                  <span className="absolute right-3 font-mono text-xs font-bold text-slate-500">
                                    {activeTestDef.unit}
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    data-testid={`trial-invalid-reason-${idx}`}
                                    placeholder="Alasan tidak sah (mis. terpeleset, curi start)"
                                    value={trial.invalidReason}
                                    onChange={(e) => handleTrialInvalidReasonChange(idx, e.target.value)}
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-950 focus:border-amber-600 focus:outline-none min-h-[40px]"
                                  />
                                </div>
                              )}

                              {hasErr && (
                                <p className="text-[11px] font-semibold text-rose-600 mt-1">
                                  {fieldErrors[`trial.${idx}`]}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* KARTU PRATINJAU HASIL AKHIR MENTAH OTOMATIS */}
                  {livePreviewValidation?.isValid && livePreviewValidation.normalizedRecord && (
                    <div
                      data-testid="live-result-preview"
                      className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Hasil Akhir Mentah Terhitung ({activeTestDef.finalResultMethod})
                        </div>
                        <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
                          {livePreviewValidation.normalizedRecord.finalDisplayValue}
                        </div>
                        {activeTestDef.testId === 'TST-RSA-630' && (
                          <div className="text-xs text-emerald-900 mt-0.5">
                            Total 6 Sprint: <strong>{livePreviewValidation.normalizedRecord.derivedMetrics.totalSprintTimeSec} s</strong> •
                            Sprint Terbaik: <strong>{livePreviewValidation.normalizedRecord.derivedMetrics.bestSprintTimeSec} s</strong> •
                            Fatigue Index: <strong>{livePreviewValidation.normalizedRecord.derivedMetrics.fatigueIndexPercent}%</strong>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                        <span className="rounded-md bg-amber-100 border border-amber-300 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-900">
                          Status: PENDING_CALIBRATION
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Skor 1–100 belum dikonversi (menunggu norma kalibrasi)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Catatan Lapangan Opsional */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Catatan Pengamatan Pelatih (Opsional)
                    </label>
                    <input
                      type="text"
                      data-testid="battery-notes-input"
                      placeholder="Contoh: Menggunakan sepatu pul biasa, angin tenang, pencatat waktu Coach Hendra..."
                      value={entryDraft.notes}
                      onChange={(e) => setEntryDraft((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none min-h-[44px]"
                    />
                  </div>

                  {/* Banner Error Validasi */}
                  {validationErrors.length > 0 && (
                    <div
                      data-testid="battery-validation-error"
                      className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 space-y-1"
                    >
                      <div className="font-bold flex items-center gap-1.5 text-rose-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Hasil pengukuran belum dapat disimpan:</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {validationErrors.map((errMsg, i) => (
                          <li key={i}>{errMsg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Banner Sukses Simpan */}
                  {saveFeedback && (
                    <div
                      data-testid="battery-save-success"
                      className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-950 flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{saveFeedback.message}</span>
                    </div>
                  )}

                  {/* Tombol Simpan & Reset */}
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEntryDraft(createInitialTestEntryDraft(activeTestDef.testId, entryDraft.testDate));
                        setValidationErrors([]);
                        setFieldErrors({});
                        setSaveFeedback(null);
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition min-h-[44px]"
                    >
                      Reset Form
                    </button>

                    <button
                      type="submit"
                      data-testid="battery-save-btn"
                      disabled={isSaving || !activeStudent}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2 min-h-[44px]"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      <span>{isSaving ? 'Menyimpan...' : 'Simpan Hasil Pengukuran Mentah'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          PANEL RIWAYAT PENGUKURAN TES LAPANGAN ATLET
         =================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600" />
              <span>
                Riwayat Hasil Pengukuran Lapangan — {activeStudent?.studentName || activeStudent?.name || 'Atlet'}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Menampilkan rincian setiap percobaan (trials), hasil akhir mentah, dan status kalibrasi indikator.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setHistoryFilterMode('ALL_TESTS')}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  historyFilterMode === 'ALL_TESTS'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Tes ({athleteHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterMode('ACTIVE_TEST')}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  historyFilterMode === 'ACTIVE_TEST'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hanya {activeTestDef?.shortName}
              </button>
            </div>

            <button
              type="button"
              onClick={loadAthleteHistory}
              title="Muat ulang riwayat"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {displayedHistory.length === 0 ? (
          <div
            data-testid="battery-history-empty"
            className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-1"
          >
            <FileSpreadsheet className="h-7 w-7 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-700">
              Belum Ada Riwayat Pengukuran Lapangan
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Pilih salah satu dari 18 tes objektif di atas, masukkan hasil percobaan atlet, lalu klik &ldquo;Simpan Hasil Pengukuran Mentah&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="battery-history-list">
            {displayedHistory.map((item) => (
              <div
                key={item.id}
                data-testid={`battery-history-item-${item.testId}`}
                className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 sm:p-4 flex flex-col gap-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {item.indicatorId}
                      </span>
                      <span className="font-mono text-xs text-slate-500">{item.testId}</span>
                      <span className="text-xs font-semibold text-slate-500">• {item.testDate}</span>
                      <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                        {item.calibrationStatus}
                      </span>
                      {item.attemptStatus === 'PARTIAL_VALID' && (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          Sebagian Percobaan Foul
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      {item.indicatorName} — {item.testName}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Hasil Akhir Mentah
                      </div>
                      <div className="font-mono text-base font-extrabold text-emerald-700">
                        {item.finalDisplayValue}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistoryItem(item.id)}
                      title="Hapus catatan tes ini"
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Rincian Percobaan (Trials) */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/70">
                  {Array.isArray(item.trials) &&
                    item.trials.map((tr) => (
                      <span
                        key={tr.trialNumber}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono ${
                          tr.isValid
                            ? 'bg-white border border-slate-200 text-slate-800'
                            : 'bg-amber-50 border border-amber-200 text-amber-800 line-through'
                        }`}
                      >
                        <strong className="font-sans font-semibold text-slate-500">{tr.label}:</strong>
                        {tr.isValid ? `${tr.rawInput} ${tr.unit}` : `Tidak Sah (${tr.invalidReason || 'Foul'})`}
                      </span>
                    ))}
                </div>

                {(item.notes || item.surfaceCondition) && (
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Permukaan: <strong>{item.surfaceCondition}</strong>
                      {item.notes ? ` • Catatan: "${item.notes}"` : ''}
                    </span>
                    <span>Dicatat oleh: {item.recordedByName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
