import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Timer,
  Target,
  Activity,
  CheckCircle2,
  Save,
  RotateCcw,
  Calendar,
  Layers,
  MessageSquare,
  TrendingUp,
  Crosshair,
  Search,
  Brain,
  Shield,
  SlidersHorizontal,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Play,
  SkipForward,
  Check,
  X,
  MoreVertical,
  AlertTriangle,
  Edit3,
  User
} from 'lucide-react';
import {
  FOOTBALL_ASSESSMENT_TIERS,
  MASTER_FOOTBALL_TESTS_CATALOG,
  FOOTBALL_TEST_BENCHMARKS,
  FOOTBALL_RUBRIC_ANCHORS,
  RUBRIC_ANCHORED_SCORES,
  calculateAssessmentScore,
  getMasterTestsForContext
} from '../utils/footballAssessmentEngine';
import scoutingCombineService from '../services/scoutingCombineService';
import MobileBottomSheet from '../mobile/components/MobileBottomSheet';

const CATEGORY_PILLS = [
  { id: 'ALL', label: 'Semua Domain', shortLabel: 'Semua', icon: Layers },
  { id: 'Fisik', label: 'Fisik', shortLabel: 'Fisik', icon: Activity },
  { id: 'Teknik', label: 'Teknik', shortLabel: 'Teknik', icon: Target },
  { id: 'Taktik', label: 'Taktik', shortLabel: 'Taktik', icon: Brain },
  { id: 'Mental', label: 'Mental', shortLabel: 'Mental', icon: Shield },
  { id: 'Komunikasi', label: 'Komunikasi', shortLabel: 'Komunikasi', icon: MessageSquare },
  { id: 'Perkembangan', label: 'Perkembangan', shortLabel: 'Perkembangan', icon: TrendingUp },
  { id: 'Spesifik Posisi', label: 'Khusus Posisi', shortLabel: 'Khusus Posisi', icon: Crosshair }
];

const DOMAIN_ORDER = [
  'Fisik',
  'Teknik',
  'Taktik',
  'Mental',
  'Komunikasi',
  'Perkembangan',
  'Spesifik Posisi'
];

const DOMAIN_THEME_MAP = {
  Fisik: {
    label: 'Fisik',
    color: '#10B981',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
    icon: Activity
  },
  Teknik: {
    label: 'Teknik',
    color: '#2455E8',
    badgeClass: 'bg-[#2455E8]/10 text-[#2455E8] border-[#2455E8]/25',
    icon: Target
  },
  Taktik: {
    label: 'Taktik',
    color: '#8B5CF6',
    badgeClass: 'bg-purple-500/10 text-purple-700 border-purple-500/25',
    icon: Brain
  },
  Mental: {
    label: 'Mental',
    color: '#F59E0B',
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
    icon: Shield
  },
  Komunikasi: {
    label: 'Komunikasi',
    color: '#0EA5E9',
    badgeClass: 'bg-sky-500/10 text-sky-700 border-sky-500/25',
    icon: MessageSquare
  },
  Perkembangan: {
    label: 'Perkembangan',
    color: '#EC4899',
    badgeClass: 'bg-pink-500/10 text-pink-700 border-pink-500/25',
    icon: TrendingUp
  },
  'Spesifik Posisi': {
    label: 'Khusus Posisi',
    color: '#6366F1',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25',
    icon: Crosshair
  }
};

const DOMAIN_BADGE_STYLE = {
  Fisik: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
  Teknik: 'bg-[#2455E8]/10 text-[#2455E8] border-[#2455E8]/25',
  Taktik: 'bg-purple-500/10 text-purple-700 border-purple-500/25',
  Mental: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
  Komunikasi: 'bg-sky-500/10 text-sky-700 border-sky-500/25',
  Perkembangan: 'bg-pink-500/10 text-pink-700 border-pink-500/25',
  'Spesifik Posisi': 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25'
};

const DOMAIN_LABEL_MAP = {
  Fisik: 'Fisik',
  Teknik: 'Teknik',
  Taktik: 'Taktik',
  Mental: 'Mental',
  Komunikasi: 'Komunikasi',
  Perkembangan: 'Perkembangan',
  'Spesifik Posisi': 'Khusus Posisi'
};

const FOOTBALL_AGE_GROUP_OPTIONS = Object.values(FOOTBALL_ASSESSMENT_TIERS).map((t) => ({
  id: t.code,
  tier: t.tier,
  label: t.label,
  shortLabel: t.shortLabel || `Fase ${t.tier}`
}));

const RUBRIC_LEVEL_TITLES = {
  1: 'Perlu Pembinaan Dasar',
  2: 'Mulai Berkembang',
  3: 'Standar Akademi',
  4: 'Sangat Baik & Konsisten',
  5: 'Dominan / Elit'
};

function getScoreGradeInfo(score) {
  const num = Number(score) || 0;
  if (num >= 85) {
    return {
      grade: 'A',
      label: 'Sangat Baik',
      badgeClass: 'bg-[#16A779]/10 text-[#16A779] border-[#16A779]/30'
    };
  }
  if (num >= 75) {
    return {
      grade: 'B',
      label: 'Baik',
      badgeClass: 'bg-[#2455E8]/10 text-[#2455E8] border-[#2455E8]/30'
    };
  }
  if (num >= 60) {
    return {
      grade: 'C',
      label: 'Cukup',
      badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/30'
    };
  }
  return {
    grade: 'D',
    label: 'Perlu Pembinaan',
    badgeClass: 'bg-rose-500/10 text-rose-700 border-rose-500/30'
  };
}

function resolveRubricAnchorsList(test) {
  const anchorsObj = FOOTBALL_RUBRIC_ANCHORS[test?.test_code] || {};
  return [1, 2, 3, 4, 5].map((lvl) => ({
    level: lvl,
    score: RUBRIC_ANCHORED_SCORES[lvl] || lvl * 20,
    title: RUBRIC_LEVEL_TITLES[lvl] || `Level ${lvl}`,
    description:
      anchorsObj[lvl] ||
      `Observasi performa pelatih pada level ${lvl} dari skala 1–5.`
  }));
}

function formatCompactDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

const WIZARD_DRAFT_STORAGE_PREFIX = 'chuvator_master_test_draft_v1';

/**
 * FootballAssessmentHub — Master Test Library
 * Antarmuka Pengujian Lapangan & Observasi Rubrik Terstandar (Skala 1–100)
 * Desain Mobile-First & Desktop Profesional sesuai sistem desain CHUVATOR.
 * @param {any} props
 */
export default function FootballAssessmentHub({
  tenantId,
  evaluatorId,
  athletes = [],
  selectedAthleteId = '',
  onSelectAthlete,
  selectedTier = 3,
  onSelectTier,
  selectedPosition = 'CM',
  existingIndicatorScores = {},
  onSyncedToReport,
  isArchived = false,
  classNameLabel = '',
  academyNameLabel = ''
}) {
  const [activeAthleteId, setActiveAthleteId] = useState(
    selectedAthleteId || athletes[0]?.id || ''
  );
  const [activeTier, setActiveTier] = useState(Number(selectedTier) || 3);
  const [testingDate, setTestingDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PENDING'
  const [searchQuery, setSearchQuery] = useState('');

  // Wizard Mode (Guided Step-by-Step Field Testing)
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardPillarFilter, setWizardPillarFilter] = useState('ALL');
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  // Domain Accordion Groups: Mobile opens first domain ('Fisik') by default; Desktop can expand/collapse any domain
  const [openDomains, setOpenDomains] = useState(() => ({
    Fisik: true,
    Teknik: false,
    Taktik: false,
    Mental: false,
    Komunikasi: false,
    Perkembangan: false,
    'Spesifik Posisi': false
  }));

  // Expanded inline input cards on desktop catalog view
  const [expandedTestCodes, setExpandedTestCodes] = useState({});
  const [openGuideCodes, setOpenGuideCodes] = useState({});

  // Mobile Test Detail & Edit Bottom Sheet
  const [detailSheetTestCode, setDetailSheetTestCode] = useState(null);

  // Mobile Filter Bottom Sheet & Session Menu / Reset Confirmation Modal
  const [showMobileFilterSheet, setShowMobileFilterSheet] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // State menyimpan seluruh input tes per test_code
  const [testInputs, setTestInputs] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (selectedAthleteId && selectedAthleteId !== activeAthleteId) {
      setActiveAthleteId(selectedAthleteId);
      setDetailSheetTestCode(null);
      setExpandedTestCodes({});
    }
  }, [selectedAthleteId, activeAthleteId]);

  useEffect(() => {
    if (selectedTier && Number(selectedTier) !== activeTier) {
      setActiveTier(Number(selectedTier));
    }
  }, [selectedTier, activeTier]);

  // Automatically open matching domain group when user selects a specific domain chip
  useEffect(() => {
    if (activeCategory !== 'ALL') {
      setOpenDomains((prev) => ({
        ...prev,
        [activeCategory]: true
      }));
    }
  }, [activeCategory]);

  const draftStorageKey = useMemo(() => {
    if (!activeAthleteId) return null;
    return `${WIZARD_DRAFT_STORAGE_PREFIX}_${tenantId || 'local'}_${activeAthleteId}_${testingDate}`;
  }, [tenantId, activeAthleteId, testingDate]);

  // Load existing session history for athlete or restore draft
  useEffect(() => {
    let isMounted = true;
    if (!activeAthleteId) {
      setTestInputs({});
      setHasSavedDraft(false);
      return;
    }

    let restoredFromDraft = false;
    if (draftStorageKey && typeof window !== 'undefined') {
      try {
        const rawDraft = window.localStorage.getItem(draftStorageKey);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          if (
            parsed &&
            parsed.inputs &&
            Object.keys(parsed.inputs).length > 0
          ) {
            setTestInputs(parsed.inputs);
            if (typeof parsed.wizardIndex === 'number') {
              setWizardIndex(parsed.wizardIndex);
            }
            if (parsed.wizardPillarFilter) {
              setWizardPillarFilter(parsed.wizardPillarFilter);
            }
            setHasSavedDraft(true);
            restoredFromDraft = true;
          }
        }
      } catch {
        // Ignore storage read error
      }
    }

    if (!tenantId) return;

    scoutingCombineService
      .getAthleteTestSessions(tenantId, activeAthleteId)
      .then((sessions) => {
        if (!isMounted) return;
        if (!sessions || sessions.length === 0) {
          if (!restoredFromDraft) {
            setTestInputs({});
          }
          return;
        }
        const hydrated = {};
        sessions.forEach((row) => {
          const code = row.test_code;
          if (!code || hydrated[code]) return;
          const testDef = MASTER_FOOTBALL_TESTS_CATALOG.find(
            (t) => t.test_code === code
          );
          const mType = testDef?.measurement_type || row.measurement_type || 'TIME';
          const v1 = row.raw_value_1 ?? row.raw_value ?? '';
          const v2 = row.raw_value_2 ?? (testDef?.defaultTotal || 10);
          hydrated[code] = {
            rawValue: mType !== 'ACCURACY' && mType !== 'RUBRIC' ? v1 : '',
            successes: mType === 'ACCURACY' ? v1 : '',
            attempts: mType === 'ACCURACY' ? v2 || 10 : 10,
            rubricScore: mType === 'RUBRIC' ? Number(v1) || 0 : 0,
            notes: row.evaluator_notes || ''
          };
        });
        if (!restoredFromDraft) {
          setTestInputs(hydrated);
        } else {
          setTestInputs((prev) => ({ ...hydrated, ...prev }));
        }
      })
      .catch(() => {
        // Silent fallback
      });

    return () => {
      isMounted = false;
    };
  }, [tenantId, activeAthleteId, draftStorageKey]);

  const saveDraftToStorage = useCallback(
    (nextInputs, nextIdx = wizardIndex, nextPillar = wizardPillarFilter) => {
      if (!draftStorageKey || typeof window === 'undefined') return;
      try {
        const nowIso = new Date().toISOString();
        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            inputs: nextInputs,
            wizardIndex: nextIdx,
            wizardPillarFilter: nextPillar,
            updatedAt: nowIso
          })
        );
        setHasSavedDraft(Object.keys(nextInputs || {}).length > 0);
      } catch {
        // Ignore storage quota errors
      }
    },
    [draftStorageKey, wizardIndex, wizardPillarFilter]
  );

  const toggleProtocolGuide = (testCode) => {
    setOpenGuideCodes((prev) => ({
      ...prev,
      [testCode]: !prev[testCode]
    }));
  };

  const toggleExpandTestCard = (testCode) => {
    setExpandedTestCodes((prev) => ({
      ...prev,
      [testCode]: !prev[testCode]
    }));
  };

  const toggleDomainSection = (domainKey) => {
    setOpenDomains((prev) => ({
      ...prev,
      [domainKey]: !prev[domainKey]
    }));
  };

  const updateTestInput = (testCode, patch) => {
    setTestInputs((prev) => {
      const next = {
        ...prev,
        [testCode]: {
          ...(prev[testCode] || {
            rawValue: '',
            attempts: 10,
            successes: '',
            rubricScore: 0,
            notes: ''
          }),
          ...patch
        }
      };
      saveDraftToStorage(next);
      return next;
    });
  };

  // Compute contextual tests for the active tier & position
  const contextualTestsForTierAndPos = useMemo(() => {
    return getMasterTestsForContext({
      tier: activeTier,
      category: 'ALL',
      positionCode: selectedPosition
    });
  }, [activeTier, selectedPosition]);

  const allowedTestCodeSet = useMemo(() => {
    return new Set(contextualTestsForTierAndPos.map((t) => t.test_code));
  }, [contextualTestsForTierAndPos]);

  // Compute live score for every test in the catalog
  const catalogWithLiveScores = useMemo(() => {
    return MASTER_FOOTBALL_TESTS_CATALOG.map((test) => {
      const applicableForTier = allowedTestCodeSet.has(test.test_code);
      const input = testInputs[test.test_code] || {};
      const mType = test.measurement_type || 'TIME';
      const mUnit = test.unit || '';
      const benchmarkByTier = FOOTBALL_TEST_BENCHMARKS[test.test_code] || {};
      const benchmark =
        benchmarkByTier[activeTier] || benchmarkByTier[2] || benchmarkByTier[1] || null;

      let hasValidInput = false;
      let rawDisplay = '';
      let rawValue1 = null;
      let rawValue2 = null;
      let finalScore = 0;

      if (mType === 'ACCURACY') {
        const att = Number(input.attempts ?? test.defaultTotal ?? 10);
        const suc = Number(input.successes);
        if (
          input.successes !== '' &&
          input.successes !== undefined &&
          !Number.isNaN(suc) &&
          att > 0 &&
          suc >= 0
        ) {
          rawValue1 = suc;
          rawValue2 = att;
          const computed = calculateAssessmentScore({
            testCode: test.test_code,
            tier: activeTier,
            rawValues: { raw_value_1: suc, raw_value_2: att },
            testMeta: test
          });
          if (computed !== null) {
            hasValidInput = true;
            finalScore = computed;
            const pct = Math.round((suc / att) * 100);
            rawDisplay = `${suc}/${att} berhasil (${pct}%)`;
          }
        }
      } else if (mType === 'RUBRIC') {
        const rub = Number(input.rubricScore);
        if (rub >= 1 && rub <= 5) {
          rawValue1 = rub;
          const computed = calculateAssessmentScore({
            testCode: test.test_code,
            tier: activeTier,
            rawValues: { raw_value_1: rub },
            testMeta: test
          });
          if (computed !== null) {
            hasValidInput = true;
            finalScore = computed;
            rawDisplay = `Level ${rub}/5 — ${RUBRIC_LEVEL_TITLES[rub] || 'Terukur'}`;
          }
        }
      } else {
        const raw = input.rawValue;
        if (
          raw !== '' &&
          raw !== undefined &&
          raw !== null &&
          !Number.isNaN(Number(raw)) &&
          Number(raw) > 0
        ) {
          rawValue1 = Number(raw);
          const computed = calculateAssessmentScore({
            testCode: test.test_code,
            tier: activeTier,
            rawValues: { raw_value_1: rawValue1 },
            testMeta: test
          });
          if (computed !== null) {
            hasValidInput = true;
            finalScore = computed;
            rawDisplay = `${rawValue1} ${mUnit}`;
          }
        }
      }

      const existingScoreObj =
        existingIndicatorScores?.[test.indicator_key] ||
        existingIndicatorScores?.[test.indicator_label];
      const previousSavedScore =
        existingScoreObj &&
        Number(existingScoreObj.score) > 0 &&
        existingScoreObj.source === 'battery_test'
          ? Math.round(Number(existingScoreObj.score))
          : null;

      return {
        ...test,
        sub_indicator_id: test.indicator_key,
        sub_indicator_name: test.indicator_label,
        input_schema: mType,
        measurement_unit: mUnit,
        protocol_description: test.description || '',
        applicableForTier,
        benchmark,
        input,
        hasValidInput,
        rawDisplay,
        rawValue1,
        rawValue2,
        calcResult: {
          finalScore,
          rawValue: rawValue1,
          unit: mUnit
        },
        previousSavedScore
      };
    });
  }, [testInputs, activeTier, existingIndicatorScores, allowedTestCodeSet]);

  // Filter tests by age tier, category, position, status, and search query
  const filteredTests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogWithLiveScores.filter((item) => {
      if (!item.applicableForTier) return false;

      if (activeCategory !== 'ALL' && item.category !== activeCategory) {
        return false;
      }

      const isCompleted =
        item.hasValidInput ||
        (item.previousSavedScore !== null && item.previousSavedScore > 0);
      if (statusFilter === 'COMPLETED' && !isCompleted) return false;
      if (statusFilter === 'PENDING' && isCompleted) return false;

      if (q) {
        const matchName = (item.test_name || '').toLowerCase().includes(q);
        const matchInd = (item.sub_indicator_name || '').toLowerCase().includes(q);
        const matchDesc = (item.protocol_description || '')
          .toLowerCase()
          .includes(q);
        if (!matchName && !matchInd && !matchDesc) return false;
      }

      return true;
    });
  }, [
    catalogWithLiveScores,
    activeCategory,
    statusFilter,
    searchQuery
  ]);

  // Group filteredTests by the 7 canonical domains
  const groupedDomainTests = useMemo(() => {
    const isUnfilteredCatalog =
      activeCategory === 'ALL' &&
      statusFilter === 'ALL' &&
      searchQuery.trim() === '';

    const devIndicators = [
      {
        code: 'DEV01',
        key: 'kehadiran_latihan',
        label: 'Kehadiran Latihan',
        description: 'Persentase kehadiran latihan reguler dari modul Presensi Akademi.'
      },
      {
        code: 'DEV02',
        key: 'kepatuhan_program',
        label: 'Kepatuhan Program',
        description: 'Tingkat kepatuhan mengikuti jadwal dan program latihan akademi.'
      },
      {
        code: 'DEV03',
        key: 'konsistensi_kehadiran',
        label: 'Konsistensi Kehadiran',
        description: 'Rasio disiplin latihan tanpa ketidakhadiran tanpa keterangan (alpa).'
      }
    ].map((ind) => {
      const savedObj = existingIndicatorScores?.[ind.key];
      const numericScore =
        savedObj && typeof savedObj === 'object'
          ? Number(savedObj.score)
          : Number(savedObj);
      const validScore =
        Number.isFinite(numericScore) && numericScore > 0 ? numericScore : null;
      return {
        ...ind,
        score: validScore
      };
    });

    return DOMAIN_ORDER.map((domainKey) => {
      if (domainKey === 'Perkembangan') {
        const completedDev = devIndicators.filter((d) => d.score !== null).length;
        return {
          domainKey,
          label: DOMAIN_LABEL_MAP[domainKey] || domainKey,
          theme: DOMAIN_THEME_MAP[domainKey] || DOMAIN_THEME_MAP.Perkembangan,
          items: [],
          devIndicators,
          isAttendanceSyncedDomain: true,
          totalCount: devIndicators.length,
          completedCount: completedDev
        };
      }

      const items = filteredTests.filter((t) => t.category === domainKey);
      const completedInGroup = items.filter(
        (t) =>
          t.hasValidInput ||
          (t.previousSavedScore !== null && t.previousSavedScore > 0)
      ).length;
      return {
        domainKey,
        label: DOMAIN_LABEL_MAP[domainKey] || domainKey,
        theme: DOMAIN_THEME_MAP[domainKey] || DOMAIN_THEME_MAP.Fisik,
        items,
        devIndicators: [],
        isAttendanceSyncedDomain: false,
        totalCount: items.length,
        completedCount: completedInGroup
      };
    }).filter(
      (group) =>
        (group.totalCount > 0 && !group.isAttendanceSyncedDomain) ||
        isUnfilteredCatalog ||
        activeCategory === group.domainKey
    );
  }, [filteredTests, activeCategory, statusFilter, searchQuery, existingIndicatorScores]);

  // Count per domain across applicable catalog (for domain filter chips)
  const domainCountsMap = useMemo(() => {
    const relevant = catalogWithLiveScores.filter((t) => t.applicableForTier);
    const map = { ALL: relevant.length };
    DOMAIN_ORDER.forEach((d) => {
      map[d] =
        d === 'Perkembangan'
          ? 3
          : relevant.filter((t) => t.category === d).length;
    });
    return map;
  }, [catalogWithLiveScores]);

  // Wizard sequence list
  const wizardTests = useMemo(() => {
    return catalogWithLiveScores.filter((item) => {
      if (!item.applicableForTier) return false;
      if (
        wizardPillarFilter !== 'ALL' &&
        item.category !== wizardPillarFilter
      ) {
        return false;
      }
      return true;
    });
  }, [catalogWithLiveScores, wizardPillarFilter]);

  const safeWizardIndex = useMemo(() => {
    if (wizardTests.length === 0) return 0;
    return Math.max(0, Math.min(wizardIndex, wizardTests.length - 1));
  }, [wizardIndex, wizardTests.length]);

  const currentWizardTest = wizardTests[safeWizardIndex] || null;

  // Currently selected test for the Mobile Detail / Edit Bottom Sheet
  const activeDetailTest = useMemo(() => {
    if (!detailSheetTestCode) return null;
    return (
      catalogWithLiveScores.find((t) => t.test_code === detailSheetTestCode) ||
      null
    );
  }, [catalogWithLiveScores, detailSheetTestCode]);

  // Dynamic Session Summary Stats (Total Available, Completed, Pending, Progress %, Avg Score)
  const sessionStats = useMemo(() => {
    const relevantCatalog = catalogWithLiveScores.filter(
      (item) => item.applicableForTier
    );

    const measuredNow = relevantCatalog.filter((item) => item.hasValidInput);
    const completedAll = relevantCatalog.filter(
      (item) =>
        item.hasValidInput ||
        (item.previousSavedScore !== null && item.previousSavedScore > 0)
    );

    const totalAvailable = relevantCatalog.length;
    const completedCount = completedAll.length;
    const pendingCount = Math.max(0, totalAvailable - completedCount);
    const progressPct =
      totalAvailable > 0
        ? Math.round((completedCount / totalAvailable) * 100)
        : 0;

    const scoredItems = completedAll
      .map((item) =>
        item.hasValidInput ? item.calcResult.finalScore : item.previousSavedScore
      )
      .filter((v) => Number(v) > 0);

    const avgScore =
      scoredItems.length > 0
        ? Math.round(
            scoredItems.reduce((acc, val) => acc + Number(val), 0) /
              scoredItems.length
          )
        : 0;

    return {
      totalAvailable,
      completedCount,
      pendingCount,
      progressPct,
      measuredNowCount: measuredNow.length,
      avgScore
    };
  }, [catalogWithLiveScores]);

  const handleConfirmResetSession = () => {
    setTestInputs({});
    setWizardIndex(0);
    setHasSavedDraft(false);
    if (draftStorageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore storage error
      }
    }
    setShowResetConfirmModal(false);
    setShowActionMenu(false);
    setToast({
      type: 'info',
      message: 'Input sesi pengujian telah direset.'
    });
  };

  const handleStartOrResumeWizard = (targetTestCode = null) => {
    if (targetTestCode && typeof targetTestCode === 'string') {
      const idx = wizardTests.findIndex((t) => t.test_code === targetTestCode);
      if (idx >= 0) {
        setWizardIndex(idx);
      } else {
        setWizardPillarFilter('ALL');
        const allApplicable = catalogWithLiveScores.filter(
          (item) => item.applicableForTier
        );
        const allIdx = allApplicable.findIndex(
          (t) => t.test_code === targetTestCode
        );
        if (allIdx >= 0) setWizardIndex(allIdx);
      }
    } else if (!hasSavedDraft) {
      const firstUnmeasuredIdx = wizardTests.findIndex(
        (t) => !t.hasValidInput && !t.previousSavedScore
      );
      setWizardIndex(firstUnmeasuredIdx >= 0 ? firstUnmeasuredIdx : 0);
    }
    setDetailSheetTestCode(null);
    setIsWizardMode(true);
  };

  const handleWizardPrev = () => {
    const nextIdx = Math.max(0, safeWizardIndex - 1);
    setWizardIndex(nextIdx);
    saveDraftToStorage(testInputs, nextIdx, wizardPillarFilter);
  };

  const handleWizardSkip = () => {
    if (safeWizardIndex < wizardTests.length - 1) {
      const nextIdx = safeWizardIndex + 1;
      setWizardIndex(nextIdx);
      saveDraftToStorage(testInputs, nextIdx, wizardPillarFilter);
    } else {
      setIsWizardMode(false);
    }
  };

  const handleWizardSaveAndNext = async () => {
    saveDraftToStorage(testInputs, safeWizardIndex, wizardPillarFilter);
    if (safeWizardIndex < wizardTests.length - 1) {
      const nextIdx = safeWizardIndex + 1;
      setWizardIndex(nextIdx);
      saveDraftToStorage(testInputs, nextIdx, wizardPillarFilter);
    } else {
      await handleSaveAllAndSync();
      setIsWizardMode(false);
    }
  };

  const handleSaveAllAndSync = async () => {
    if (!activeAthleteId) {
      setToast({
        type: 'error',
        message: 'Pilih atlet terlebih dahulu sebelum menyimpan sesi tes.'
      });
      return;
    }

    const validItems = catalogWithLiveScores.filter(
      (item) => item.applicableForTier && item.hasValidInput
    );
    if (validItems.length === 0) {
      setToast({
        type: 'error',
        message: 'Masukkan minimal 1 hasil pengukuran tes atau rubrik terlebih dahulu.'
      });
      return;
    }

    setSaving(true);
    setToast(null);
    try {
      const sessionEntries = validItems.map((item) => ({
        test_code: item.test_code,
        test_name: item.test_name,
        indicator_key: item.indicator_key,
        indicator_label: item.indicator_label,
        raw_value_1: item.rawValue1,
        raw_value_2: item.rawValue2,
        errors_count: 0,
        calculated_score: item.calcResult.finalScore,
        testing_date: testingDate
      }));

      const syncResult =
        await scoutingCombineService.saveMasterAssessmentSessionAndSync({
          tenantId,
          athleteId: activeAthleteId,
          evaluatorId,
          tier: activeTier,
          testingDate,
          sessionEntries
        });

      const mergedIndicatorScores = {
        ...(existingIndicatorScores || {}),
        ...(syncResult?.indicatorScoresMap || syncResult?.indicatorScores || {})
      };

      if (onSyncedToReport) {
        onSyncedToReport(mergedIndicatorScores);
      }

      if (draftStorageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(draftStorageKey);
        } catch {
          // Ignore storage error
        }
      }
      setHasSavedDraft(false);

      setToast({
        type: 'success',
        message: `${validItems.length} hasil tes berhasil disimpan dan diperbarui ke Rapor Atlet.`
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Gagal menyimpan sesi pengujian.'
      });
    } finally {
      setSaving(false);
    }
  };

  const tierObj =
    FOOTBALL_ASSESSMENT_TIERS[activeTier] || FOOTBALL_ASSESSMENT_TIERS[3];
  const activeAthleteObj = athletes.find((a) => a.id === activeAthleteId);
  const athleteDisplayName =
    activeAthleteObj?.name || activeAthleteObj?.studentName || 'Atlet Akademi';

  const hasActiveFilters =
    activeCategory !== 'ALL' ||
    statusFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  const allVisibleDomainsOpen = useMemo(() => {
    if (groupedDomainTests.length === 0) return false;
    return groupedDomainTests.every((g) => Boolean(openDomains[g.domainKey]));
  }, [groupedDomainTests, openDomains]);

  const handleToggleAllDomains = () => {
    const nextState = !allVisibleDomainsOpen;
    const nextMap = { ...openDomains };
    groupedDomainTests.forEach((g) => {
      nextMap[g.domainKey] = nextState;
    });
    setOpenDomains(nextMap);
  };

  // Helper function to render the measurement input controls (used in Detail Bottom Sheet, Desktop Inline, & Wizard)
  const renderTestInputForm = (item, isLargeWizard = false) => {
    const gradeInfo = getScoreGradeInfo(item.calcResult.finalScore);
    const inputHeightClass = isLargeWizard ? 'min-h-[52px] text-base' : 'min-h-[48px] text-sm';

    return (
      <div className="space-y-3.5">
        {/* Benchmark Norms Bar */}
        {item.input_schema !== 'RUBRIC' && item.benchmark && (
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] text-center">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#16A779]">
                Target Elit (96+)
              </span>
              <span className="font-mono text-xs font-extrabold text-[#17233D] tabular-nums">
                {item.is_lower_better ? '≤ ' : '≥ '}
                {item.benchmark.elite} {item.measurement_unit}
              </span>
            </div>
            <div className="border-x border-[#E7EBF2] px-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#2455E8]">
                Standar Baik (80)
              </span>
              <span className="font-mono text-xs font-extrabold text-[#17233D] tabular-nums">
                {item.benchmark.good} {item.measurement_unit}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#68758B]">
                Batas Dasar (55)
              </span>
              <span className="font-mono text-xs font-extrabold text-[#17233D] tabular-nums">
                {item.benchmark.fair} {item.measurement_unit}
              </span>
            </div>
          </div>
        )}

        {/* Input Controls by Schema */}
        {item.input_schema === 'TIME' ||
        item.input_schema === 'REPS' ||
        item.input_schema === 'DISTANCE' ? (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#17233D]">
              Hasil Pengukuran ({item.measurement_unit})
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  type="number"
                  step={item.input_schema === 'TIME' ? '0.01' : '0.5'}
                  min="0"
                  disabled={isArchived}
                  data-testid={
                    isLargeWizard
                      ? `wizard-input-${item.test_code}`
                      : `input-${item.test_code}`
                  }
                  value={item.input.rawValue ?? ''}
                  onChange={(e) =>
                    updateTestInput(item.test_code, { rawValue: e.target.value })
                  }
                  placeholder={`Masukkan ${item.measurement_unit}...`}
                  className={`w-full ${inputHeightClass} pl-3.5 pr-16 py-2 rounded-[14px] bg-[#FFFFFF] border border-[#E7EBF2] font-mono font-bold text-[#17233D] focus:outline-none focus:border-[#2455E8] tabular-nums`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#68758B] pointer-events-none">
                  {item.measurement_unit}
                </span>
              </div>

              {item.hasValidInput && (
                <button
                  type="button"
                  onClick={() => updateTestInput(item.test_code, { rawValue: '' })}
                  className="min-h-[48px] px-3.5 rounded-[14px] bg-[#F5F7FC] hover:bg-rose-50 text-[#68758B] hover:text-[#DC4545] border border-[#E7EBF2] text-xs font-bold transition-colors cursor-pointer shrink-0"
                  title="Hapus nilai tes ini"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        ) : item.input_schema === 'ACCURACY' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17233D] mb-1">
                  Percobaan Berhasil
                </label>
                <input
                  type="number"
                  min="0"
                  max={item.input.attempts || 50}
                  disabled={isArchived}
                  data-testid={
                    isLargeWizard
                      ? `wizard-successes-${item.test_code}`
                      : `successes-${item.test_code}`
                  }
                  value={item.input.successes ?? ''}
                  onChange={(e) =>
                    updateTestInput(item.test_code, { successes: e.target.value })
                  }
                  placeholder="Contoh: 8"
                  className={`w-full ${inputHeightClass} px-3.5 py-2 rounded-[14px] bg-[#FFFFFF] border border-[#E7EBF2] font-mono font-bold text-[#17233D] focus:outline-none focus:border-[#2455E8] tabular-nums`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17233D] mb-1">
                  Total Percobaan
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  disabled={isArchived}
                  data-testid={
                    isLargeWizard
                      ? `wizard-attempts-${item.test_code}`
                      : `attempts-${item.test_code}`
                  }
                  value={item.input.attempts ?? item.defaultTotal ?? 10}
                  onChange={(e) =>
                    updateTestInput(item.test_code, { attempts: e.target.value })
                  }
                  className={`w-full ${inputHeightClass} px-3.5 py-2 rounded-[14px] bg-[#FFFFFF] border border-[#E7EBF2] font-mono font-bold text-[#17233D] focus:outline-none focus:border-[#2455E8] tabular-nums`}
                />
              </div>
            </div>
          </div>
        ) : (
          /* RUBRIC 1-5 */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#17233D]">
                Pilih Skala Observasi (1–5)
              </span>
              {item.hasValidInput && (
                <button
                  type="button"
                  onClick={() => updateTestInput(item.test_code, { rubricScore: 0 })}
                  className="text-xs font-semibold text-[#68758B] hover:text-[#DC4545] cursor-pointer"
                >
                  Hapus Pilihan
                </button>
              )}
            </div>
            <div className="space-y-2">
              {resolveRubricAnchorsList(item).map((anchor) => {
                const selected = Number(item.input.rubricScore) === anchor.level;
                return (
                  <button
                    key={anchor.level}
                    type="button"
                    disabled={isArchived}
                    data-testid={
                      isLargeWizard
                        ? `wizard-rubric-${item.test_code}-${anchor.level}`
                        : `rubric-${item.test_code}-${anchor.level}`
                    }
                    onClick={() =>
                      updateTestInput(item.test_code, { rubricScore: anchor.level })
                    }
                    className={`w-full min-h-[52px] text-left p-3 rounded-[14px] border transition-all flex items-start gap-3 cursor-pointer ${
                      selected
                        ? 'bg-[#2455E8]/8 border-[#2455E8] shadow-[0_2px_8px_rgba(36,85,232,0.08)]'
                        : 'bg-[#FFFFFF] border-[#E7EBF2] hover:bg-[#F5F7FC]'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 font-mono ${
                        selected
                          ? 'bg-[#2455E8] text-white'
                          : 'bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2]'
                      }`}
                    >
                      {anchor.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-[#17233D]">
                          {anchor.title}
                        </span>
                        <span className="text-[11px] font-mono font-extrabold text-[#2455E8] shrink-0 tabular-nums">
                          Skor {anchor.score}
                        </span>
                      </div>
                      <p className="text-xs text-[#68758B] leading-snug mt-0.5">
                        {anchor.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Converted Score Preview Bar */}
        <div className="p-3 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#68758B]">
              Skor Konversi Indikator (1–100)
            </span>
            <p className="text-xs font-semibold text-[#17233D] truncate mt-0.5">
              {item.hasValidInput
                ? `Hasil: ${item.rawDisplay}`
                : item.previousSavedScore
                ? `Tersimpan sebelumnya: ${item.previousSavedScore}/100`
                : 'Masukkan nilai pengukuran untuk melihat skor konversi'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.hasValidInput && (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${gradeInfo.badgeClass}`}
              >
                Grade {gradeInfo.grade}
              </span>
            )}
            <span
              className={`font-mono text-lg font-black tabular-nums ${
                item.hasValidInput
                  ? 'text-[#16A779]'
                  : item.previousSavedScore
                  ? 'text-[#2455E8]'
                  : 'text-[#68758B]'
              }`}
            >
              {item.hasValidInput
                ? `${item.calcResult.finalScore}/100`
                : item.previousSavedScore
                ? `${item.previousSavedScore}/100`
                : '—'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="master-test-library-hub"
      className="space-y-3.5 md:space-y-5 text-left pb-4"
    >
      {/* ===================================================================== */}
      {/* A, B, C. SESSION HEADER, UNIFIED PROGRESS & PRIMARY WIZARD ACTION      */}
      {/* ===================================================================== */}
      <div className="bg-[#FFFFFF] rounded-[16px] md:rounded-2xl p-3.5 sm:p-5 border border-[#E7EBF2] shadow-[0_2px_10px_rgba(16,29,56,0.04)] space-y-3.5">
        {/* A. COMPACT SESSION HEADER */}
        <div className="flex items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-[12px] bg-[#101D38] text-white flex items-center justify-center shrink-0">
              <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-[#16A779]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-[15px] sm:text-lg font-extrabold text-[#17233D] tracking-tight truncate">
                  Master Test Library
                </h2>
                {selectedPosition && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#2455E8]/10 text-[#2455E8] shrink-0">
                    {selectedPosition}
                  </span>
                )}
              </div>

              {/* Compact Metadata Line: Athlete Name · Age Tier · Session Date */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] sm:text-xs text-[#68758B] font-medium mt-0.5">
                <span className="font-bold text-[#17233D] truncate max-w-[150px] sm:max-w-none">
                  {athleteDisplayName}
                </span>
                <span aria-hidden="true">&bull;</span>
                <span className="text-[#2455E8] font-semibold">
                  {tierObj?.shortLabel || `Fase ${activeTier}`}
                </span>
                <span aria-hidden="true" className="hidden xs:inline">
                  &bull;
                </span>
                <span className="hidden xs:inline">
                  {formatCompactDateIndo(testingDate)}
                </span>
                {classNameLabel && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline">
                      &bull;
                    </span>
                    <span className="hidden sm:inline truncate">
                      {academyNameLabel ? `${academyNameLabel} — ` : ''}
                      {classNameLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Desktop Date + Desktop Primary CTA + Session Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact Session Date Input */}
            <div className="hidden sm:flex items-center gap-2 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[12px] px-3 min-h-[44px]">
              <Calendar className="w-3.5 h-3.5 text-[#2455E8] shrink-0" />
              <input
                type="date"
                aria-label="Tanggal Sesi Tes"
                value={testingDate}
                disabled={isArchived}
                onChange={(e) => setTestingDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#17233D] focus:outline-none cursor-pointer"
              />
            </div>

            {/* Desktop Primary Action Button (>= 768px) */}
            <button
              type="button"
              onClick={() => {
                if (isWizardMode) {
                  setIsWizardMode(false);
                } else {
                  handleStartOrResumeWizard();
                }
              }}
              className={`hidden md:inline-flex min-h-[44px] px-4 py-2 rounded-[14px] text-xs sm:text-sm font-bold items-center gap-2 transition-all cursor-pointer ${
                isWizardMode
                  ? 'bg-[#101D38] text-white'
                  : 'bg-[#2455E8] hover:bg-[#1D46C7] text-white shadow-[0_4px_12px_rgba(36,85,232,0.2)]'
              }`}
            >
              <Play className="w-4 h-4 shrink-0" />
              <span>
                {isWizardMode
                  ? 'Kembali ke Katalog'
                  : hasSavedDraft
                  ? 'Lanjutkan Wizard Tes'
                  : 'Mulai Wizard Tes'}
              </span>
            </button>

            {/* Session Menu (Reset Sesi) */}
            {!isArchived && (
              <div className="relative">
                <button
                  type="button"
                  data-testid="session-action-menu-btn"
                  onClick={() => setShowActionMenu((prev) => !prev)}
                  aria-label="Menu Sesi"
                  className="min-w-[44px] min-h-[44px] rounded-[12px] bg-[#F5F7FC] hover:bg-[#E7EBF2]/70 border border-[#E7EBF2] text-[#17233D] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showActionMenu && (
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#FFFFFF] border border-[#E7EBF2] shadow-[0_8px_24px_rgba(16,29,56,0.12)] py-2 z-30">
                    {/* Mobile Date Picker inside Menu for compact header */}
                    <div className="px-3.5 py-2 border-b border-[#E7EBF2] sm:hidden">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#68758B] mb-1">
                        Tanggal Sesi
                      </label>
                      <input
                        type="date"
                        aria-label="Tanggal Sesi Tes Mobile"
                        value={testingDate}
                        disabled={isArchived}
                        onChange={(e) => setTestingDate(e.target.value)}
                        className="w-full min-h-[40px] px-2.5 py-1 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2] text-xs font-bold text-[#17233D]"
                      />
                    </div>
                    <button
                      type="button"
                      data-testid="open-reset-session-modal-btn"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowResetConfirmModal(true);
                      }}
                      className="w-full min-h-[44px] px-4 py-2 text-left text-xs font-bold text-[#DC4545] hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 shrink-0" />
                      <span>Reset Sesi Tes</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* B. UNIFIED COMPACT SESSION PROGRESS COMPONENT */}
        <div
          data-testid="session-progress-card"
          className="p-3 sm:p-3.5 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] space-y-2.5"
        >
          {/* Progress Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-[#17233D]">
                Progres Sesi Pengukuran
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#101D38] text-white font-mono text-[11px] font-extrabold tabular-nums">
                {sessionStats.progressPct}%
              </span>
            </div>

            <div className="text-right shrink-0 flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#68758B]">
                Rata-rata Sesi:
              </span>
              <span className="font-mono text-xs font-extrabold text-[#16A779] tabular-nums">
                {sessionStats.avgScore > 0 ? `${sessionStats.avgScore}/100` : '—'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-[#E7EBF2] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16A779] rounded-full transition-all duration-300"
              style={{ width: `${sessionStats.progressPct}%` }}
            />
          </div>

          {/* Compact 3-Column Inline Metrics (Total Tes · Selesai · Belum Diukur) */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-[#FFFFFF] rounded-[10px] py-1.5 px-2 border border-[#E7EBF2]">
              <span className="block text-[10px] font-semibold text-[#68758B]">
                Total Tes
              </span>
              <span className="font-mono text-sm sm:text-base font-extrabold text-[#17233D] tabular-nums">
                {sessionStats.totalAvailable}
              </span>
            </div>

            <div className="bg-[#FFFFFF] rounded-[10px] py-1.5 px-2 border border-[#E7EBF2]">
              <span className="block text-[10px] font-semibold text-[#68758B]">
                Selesai
              </span>
              <span
                data-testid="session-completed-count"
                className="font-mono text-sm sm:text-base font-extrabold text-[#16A779] tabular-nums"
              >
                {sessionStats.completedCount}
              </span>
            </div>

            <div className="bg-[#FFFFFF] rounded-[10px] py-1.5 px-2 border border-[#E7EBF2]">
              <span className="block text-[10px] font-semibold text-[#68758B]">
                Belum Diukur
              </span>
              <span className="font-mono text-sm sm:text-base font-extrabold text-[#17233D] tabular-nums">
                {sessionStats.pendingCount}
              </span>
            </div>
          </div>
        </div>

        {/* C. MOBILE PRIMARY ACTION ("Mulai Wizard Tes") */}
        <button
          type="button"
          data-testid="wizard-mode-toggle"
          onClick={() => {
            if (isWizardMode) {
              setIsWizardMode(false);
            } else {
              handleStartOrResumeWizard();
            }
          }}
          className={`md:hidden w-full min-h-[48px] px-4 py-2.5 rounded-[14px] text-xs font-extrabold flex items-center justify-between gap-2 transition-all cursor-pointer ${
            isWizardMode
              ? 'bg-[#101D38] text-white'
              : 'bg-[#2455E8] active:bg-[#1D46C7] text-white shadow-[0_4px_12px_rgba(36,85,232,0.22)]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Play className="w-3.5 h-3.5 text-white fill-white" />
            </span>
            <span className="text-[13px] font-extrabold tracking-tight">
              {isWizardMode
                ? 'Kembali ke Katalog Tes'
                : hasSavedDraft
                ? 'Lanjutkan Wizard Tes'
                : 'Mulai Wizard Tes'}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-white/85 font-mono tabular-nums">
            {isWizardMode
              ? 'Tutup'
              : `${sessionStats.completedCount}/${sessionStats.totalAvailable} Tes`}
          </span>
        </button>

        {/* Toast Feedback */}
        {toast && (
          <div
            className={`p-3 rounded-[14px] text-xs font-bold flex items-center justify-between gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-[#16A779] border border-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-50 text-[#DC4545] border border-rose-200'
                : 'bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2]'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* G. ASSESSMENT WIZARD MODE (STEP-BY-STEP GUIDED TESTING)               */}
      {/* ===================================================================== */}
      {isWizardMode && currentWizardTest ? (
        <div
          data-testid="wizard-step-card"
          className="bg-[#FFFFFF] rounded-[16px] md:rounded-2xl border border-[#E7EBF2] shadow-[0_4px_16px_rgba(16,29,56,0.06)] overflow-hidden"
        >
          {/* Wizard Header & Progress */}
          <div className="bg-[#101D38] p-3.5 sm:p-5 text-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-[#2455E8] text-white text-xs font-extrabold font-mono tabular-nums">
                  Tes {safeWizardIndex + 1} / {wizardTests.length}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 text-xs font-semibold">
                  {DOMAIN_LABEL_MAP[currentWizardTest.category] ||
                    currentWizardTest.category}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsWizardMode(false)}
                className="min-h-[44px] px-3 py-1.5 rounded-[12px] bg-white/10 hover:bg-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup</span>
              </button>
            </div>

            {/* Domain Quick Filter inside Wizard */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORY_PILLS.map((pill) => {
                const isActive = wizardPillarFilter === pill.id;
                return (
                  <button
                    key={`wiz-filter-${pill.id}`}
                    type="button"
                    onClick={() => {
                      setWizardPillarFilter(pill.id);
                      setWizardIndex(0);
                    }}
                    className={`min-h-[38px] px-3 py-1 rounded-[10px] text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-[#16A779] text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/15'
                    }`}
                  >
                    {pill.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Step Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                <span>Progres Urutan Tes</span>
                <span className="font-mono tabular-nums">
                  {Math.round(((safeWizardIndex + 1) / wizardTests.length) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/12 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#16A779] rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      ((safeWizardIndex + 1) / Math.max(1, wizardTests.length)) * 100
                    )}%`
                  }}
                />
              </div>
            </div>

            {/* Horizontal Step Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {wizardTests.map((t, idx) => {
                const isCurr = idx === safeWizardIndex;
                const isDone =
                  t.hasValidInput ||
                  (t.previousSavedScore !== null && t.previousSavedScore > 0);
                return (
                  <button
                    key={t.test_code}
                    type="button"
                    onClick={() => setWizardIndex(idx)}
                    className={`min-h-[36px] px-2.5 py-1 rounded-[10px] text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      isCurr
                        ? 'bg-white text-[#101D38]'
                        : isDone
                        ? 'bg-[#16A779]/25 text-emerald-200 border border-[#16A779]/40'
                        : 'bg-white/8 text-slate-300 hover:bg-white/15'
                    }`}
                  >
                    <span className="font-mono font-extrabold">{idx + 1}.</span>
                    <span className="max-w-[115px] truncate">{t.test_name}</span>
                    {isDone && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizard Single-Test Body */}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                    DOMAIN_BADGE_STYLE[currentWizardTest.category] ||
                    'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {DOMAIN_LABEL_MAP[currentWizardTest.category] ||
                    currentWizardTest.category}
                </span>
                <span className="text-xs font-semibold text-[#68758B]">
                  Subkategori: {currentWizardTest.sub_indicator_name}
                </span>
              </div>

              <h3 className="text-base sm:text-xl font-extrabold text-[#17233D] tracking-tight">
                {currentWizardTest.test_name}
              </h3>

              <p className="text-xs sm:text-sm text-[#68758B] leading-relaxed">
                {currentWizardTest.protocol_description}
              </p>

              {/* Collapsible Field Guide */}
              {currentWizardTest.field_guide && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => toggleProtocolGuide(currentWizardTest.test_code)}
                    className="min-h-[44px] px-3 py-1.5 rounded-[12px] bg-[#F5F7FC] hover:bg-[#E7EBF2]/60 border border-[#E7EBF2] text-xs font-bold text-[#2455E8] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Instruksi &amp; Panduan Lapangan</span>
                    {openGuideCodes[currentWizardTest.test_code] ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openGuideCodes[currentWizardTest.test_code] && (
                    <div className="mt-2 p-3.5 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] text-xs text-[#17233D] space-y-2">
                      <div>
                        <strong className="font-bold text-[#17233D]">
                          Alat &amp; Persiapan:
                        </strong>{' '}
                        <span className="text-[#68758B]">
                          {currentWizardTest.field_guide.equipment}
                        </span>
                      </div>
                      {Array.isArray(currentWizardTest.field_guide.steps) && (
                        <ol className="list-decimal list-inside space-y-1 text-[#68758B]">
                          {currentWizardTest.field_guide.steps.map((st, i) => (
                            <li key={i}>{st}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Large Touch-Friendly Input Form */}
            {renderTestInputForm(currentWizardTest, true)}
          </div>

          {/* Thumb-Zone Wizard Navigation Footer */}
          <div className="px-3 py-3.5 sm:px-6 bg-[#F5F7FC] border-t border-[#E7EBF2] flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="wizard-prev-btn"
              disabled={safeWizardIndex <= 0}
              onClick={handleWizardPrev}
              className="min-h-[48px] px-3 sm:px-4 py-2.5 rounded-[14px] bg-[#FFFFFF] hover:bg-[#E7EBF2]/50 text-[#17233D] border border-[#E7EBF2] text-xs sm:text-sm font-bold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Sebelumnya</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end min-w-0">
              <button
                type="button"
                data-testid="wizard-skip-btn"
                onClick={handleWizardSkip}
                className="min-h-[48px] px-2.5 sm:px-4 py-2.5 rounded-[14px] bg-[#FFFFFF] hover:bg-[#E7EBF2]/50 text-[#68758B] border border-[#E7EBF2] text-xs sm:text-sm font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>Lewati</span>
                <SkipForward className="w-3.5 h-3.5 shrink-0" />
              </button>

              <button
                type="button"
                data-testid="wizard-next-btn"
                disabled={saving}
                onClick={handleWizardSaveAndNext}
                className="min-h-[48px] px-3.5 sm:px-5 py-2.5 rounded-[14px] bg-[#2455E8] hover:bg-[#1D46C7] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(36,85,232,0.2)] cursor-pointer flex-1 sm:flex-initial whitespace-nowrap"
              >
                {safeWizardIndex < wizardTests.length - 1 ? (
                  <>
                    <span>Simpan &amp; Lanjut</span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 shrink-0" />
                    <span>Simpan Sesi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* D, E, F. CATALOG MODE: SEARCH & FILTER + DOMAIN-GROUPED TEST LIST   */
        /* =================================================================== */
        <>
          {/* D. SEARCH & FILTER BAR */}
          <div className="bg-[#FFFFFF] rounded-[16px] md:rounded-2xl p-3.5 sm:p-4 border border-[#E7EBF2] shadow-[0_2px_10px_rgba(16,29,56,0.04)] space-y-3">
            {/* Row 1: Full-width Search Input + Single Mobile Filter Button / Desktop Toolbar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-[#68758B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama tes atau subkategori..."
                  className="w-full min-h-[44px] sm:min-h-[46px] pl-10 pr-9 py-2 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] text-xs sm:text-sm font-medium text-[#17233D] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#2455E8]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#68758B] hover:text-[#17233D] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Mobile Single Filter Button (< 768px) */}
              <button
                type="button"
                data-testid="mobile-filter-trigger-btn"
                onClick={() => setShowMobileFilterSheet(true)}
                className={`md:hidden min-h-[44px] px-3.5 py-2 rounded-[14px] border text-xs font-bold inline-flex items-center gap-2 shrink-0 transition-colors cursor-pointer ${
                  statusFilter !== 'ALL'
                    ? 'bg-[#2455E8]/10 text-[#2455E8] border-[#2455E8]/30'
                    : 'bg-[#F5F7FC] text-[#17233D] border-[#E7EBF2]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 text-[#2455E8] shrink-0" />
                <span>Filter</span>
                {statusFilter !== 'ALL' && (
                  <span className="w-2 h-2 rounded-full bg-[#2455E8]" />
                )}
              </button>

              {/* Desktop Filter Controls (>= 768px) */}
              <div className="hidden md:flex items-center gap-2.5 shrink-0">
                <select
                  aria-label="Filter Status Tes"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="min-h-[46px] px-3.5 py-2 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] text-xs font-bold text-[#17233D] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#2455E8] cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="COMPLETED">Sudah Diukur</option>
                  <option value="PENDING">Belum Diukur</option>
                </select>

                <select
                  aria-label="Filter Fase Usia"
                  value={activeTier}
                  disabled={isArchived}
                  onChange={(e) => {
                    const nextTier = Number(e.target.value);
                    setActiveTier(nextTier);
                    if (onSelectTier) onSelectTier(nextTier);
                  }}
                  className="min-h-[46px] px-3.5 py-2 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] text-xs font-bold text-[#17233D] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#2455E8] cursor-pointer"
                >
                  {FOOTBALL_AGE_GROUP_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.tier}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Horizontal Scrollable Domain Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {CATEGORY_PILLS.map((pill) => {
                const Icon = pill.icon;
                const isActive = activeCategory === pill.id;
                const count = domainCountsMap[pill.id] ?? 0;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    data-testid={`combine-filter-${pill.id}`}
                    onClick={() => setActiveCategory(pill.id)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-[14px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-[#101D38] text-white shadow-xs'
                        : 'bg-[#F5F7FC] text-[#68758B] hover:text-[#17233D] border border-[#E7EBF2]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{pill.shortLabel}</span>
                    <span
                      className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded-md tabular-nums ${
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'bg-[#FFFFFF] text-[#68758B]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Row 3: Removable Active Filter Chips + Expand/Collapse All */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E7EBF2] flex-wrap">
              {hasActiveFilters ? (
                <div
                  data-testid="active-filter-chips"
                  className="flex items-center gap-1.5 flex-wrap"
                >
                  <span className="text-[11px] font-semibold text-[#68758B]">
                    Filter aktif:
                  </span>
                  {activeCategory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setActiveCategory('ALL')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#2455E8]/10 text-[#2455E8] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{DOMAIN_LABEL_MAP[activeCategory] || activeCategory}</span>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {statusFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#2455E8]/10 text-[#2455E8] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>
                        {statusFilter === 'COMPLETED'
                          ? 'Sudah Diukur'
                          : 'Belum Diukur'}
                      </span>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {searchQuery.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#2455E8]/10 text-[#2455E8] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>&ldquo;{searchQuery.trim()}&rdquo;</span>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('ALL');
                      setStatusFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="text-[11px] font-bold text-[#DC4545] hover:underline px-1.5 py-0.5 cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-medium text-[#68758B]">
                  Menampilkan {filteredTests.length} tes pada {groupedDomainTests.length} domain
                </span>
              )}

              {groupedDomainTests.length > 1 && (
                <button
                  type="button"
                  onClick={handleToggleAllDomains}
                  className="text-[11px] font-bold text-[#2455E8] hover:underline py-1 cursor-pointer ml-auto"
                >
                  {allVisibleDomainsOpen ? 'Tutup Semua Domain' : 'Buka Semua Domain'}
                </button>
              )}
            </div>
          </div>

          {/* E. TEST LIBRARY LIST — GROUPED BY DOMAIN */}
          {groupedDomainTests.length === 0 ? (
            <div className="bg-[#FFFFFF] rounded-[16px] border border-dashed border-[#E7EBF2] p-8 text-center space-y-2">
              <p className="text-sm font-bold text-[#17233D]">
                Tidak ada tes yang cocok dengan filter saat ini.
              </p>
              <p className="text-xs text-[#68758B]">
                Ubah kata kunci pencarian, kategori domain, atau status pengujian.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedDomainTests.map((group) => {
                const DomainIcon = group.theme.icon || Activity;
                const isForceExpanded =
                  activeCategory !== 'ALL' || searchQuery.trim() !== '';
                const isDomainOpen =
                  isForceExpanded || Boolean(openDomains[group.domainKey]);

                return (
                  <div
                    key={group.domainKey}
                    data-testid={`domain-group-${group.domainKey}`}
                    className="bg-[#FFFFFF] rounded-[16px] md:rounded-2xl border border-[#E7EBF2] shadow-[0_2px_8px_rgba(16,29,56,0.03)] overflow-hidden"
                  >
                    {/* Collapsible Domain Group Header */}
                    <button
                      type="button"
                      data-testid={`domain-group-header-${group.domainKey}`}
                      aria-expanded={isDomainOpen}
                      onClick={() => toggleDomainSection(group.domainKey)}
                      className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F5F7FC]/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${group.theme.color}15`,
                            color: group.theme.color
                          }}
                        >
                          <DomainIcon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] sm:text-base font-extrabold text-[#17233D] truncate">
                              {group.label}
                            </h3>
                            <span className="hidden sm:inline text-xs font-semibold text-[#68758B] shrink-0">
                              &bull; {group.totalCount}{' '}
                              {group.isAttendanceSyncedDomain ? 'Indikator' : 'Tes'}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-[#68758B] mt-0.5 truncate">
                            {group.isAttendanceSyncedDomain
                              ? '3 indikator otomatis dari Presensi Akademi'
                              : `${group.completedCount} dari ${group.totalCount} tes selesai diukur`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold tabular-nums ${
                            group.completedCount === group.totalCount &&
                            group.totalCount > 0
                              ? 'bg-[#16A779]/10 text-[#16A779]'
                              : group.completedCount > 0
                              ? 'bg-[#2455E8]/10 text-[#2455E8]'
                              : 'bg-[#F5F7FC] text-[#68758B]'
                          }`}
                        >
                          {group.completedCount}/{group.totalCount}
                        </span>
                        <span className="w-8 h-8 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2] flex items-center justify-center text-[#17233D]">
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isDomainOpen ? 'rotate-180 text-[#2455E8]' : ''
                            }`}
                          />
                        </span>
                      </div>
                    </button>

                    {/* Domain Tests Container */}
                    {isDomainOpen && (
                      <div className="p-3 sm:p-4 pt-2 border-t border-[#E7EBF2] bg-[#F5F7FC]/50">
                        {group.isAttendanceSyncedDomain ? (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {group.devIndicators.map((devInd) => (
                              <div
                                key={devInd.code}
                                className="rounded-[14px] border border-[#E7EBF2] bg-[#FFFFFF] p-3.5 flex flex-col justify-between gap-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[11px] font-semibold text-[#68758B] block">
                                      Perkembangan &bull; {devInd.code}
                                    </span>
                                    <h4 className="text-sm font-extrabold text-[#17233D] mt-0.5">
                                      {devInd.label}
                                    </h4>
                                  </div>
                                  <span className="px-2 py-1 rounded-lg bg-[#16A779]/10 text-[#16A779] text-[10px] font-bold shrink-0">
                                    Otomatis Presensi
                                  </span>
                                </div>
                                <p className="text-xs text-[#68758B] leading-relaxed">
                                  {devInd.description}
                                </p>
                                <div className="pt-2 border-t border-[#E7EBF2] flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-[#68758B]">
                                    Skor Sinkronisasi
                                  </span>
                                  <span className="font-mono text-sm font-black text-[#17233D] tabular-nums">
                                    {devInd.score !== null ? `${devInd.score}/100` : 'Belum Ada Presensi'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {group.items.map((item) => {
                            const isCompleted =
                              item.hasValidInput ||
                              (item.previousSavedScore !== null &&
                                item.previousSavedScore > 0);
                            const displayScore = item.hasValidInput
                              ? item.calcResult.finalScore
                              : item.previousSavedScore;
                            const gradeInfo = displayScore
                              ? getScoreGradeInfo(displayScore)
                              : null;
                            const isExpanded = Boolean(
                              expandedTestCodes[item.test_code]
                            );
                            const isGuideOpen = Boolean(
                              openGuideCodes[item.test_code]
                            );

                            return (
                              <div
                                key={item.test_code}
                                data-testid={`test-card-${item.test_code}`}
                                className={`bg-[#FFFFFF] rounded-[14px] border transition-all p-3.5 sm:p-4 flex flex-col justify-between gap-3 ${
                                  isExpanded
                                    ? 'border-[#2455E8] shadow-[0_2px_10px_rgba(36,85,232,0.08)]'
                                    : isCompleted
                                    ? 'border-[#16A779]/40'
                                    : 'border-[#E7EBF2]'
                                }`}
                              >
                                {/* Compact Card Top Info */}
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2.5">
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-[14px] sm:text-[15px] font-extrabold text-[#17233D] leading-snug">
                                        {item.test_name}
                                      </h4>
                                      <p className="text-[11px] sm:text-xs font-semibold text-[#68758B] mt-0.5 truncate">
                                        Subkategori: {item.sub_indicator_name}
                                      </p>
                                    </div>

                                    {/* Status Measurement Indicator */}
                                    {isCompleted ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#16A779]/10 text-[#16A779] text-[11px] font-bold shrink-0">
                                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                                        <span>Selesai</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F5F7FC] border border-[#E7EBF2] text-[#68758B] text-[11px] font-semibold shrink-0">
                                        Belum Diukur
                                      </span>
                                    )}
                                  </div>

                                  {/* Desktop-only short description (hidden on compact mobile card by default) */}
                                  <p className="hidden md:block text-xs text-[#68758B] leading-relaxed line-clamp-2">
                                    {item.protocol_description}
                                  </p>
                                </div>

                                {/* Compact Bottom Row: Measurement Result + Converted Score + Single Contextual Action */}
                                <div className="pt-2 border-t border-[#E7EBF2] flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    {isCompleted ? (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm sm:text-base font-extrabold text-[#16A779] tabular-nums">
                                          {displayScore}/100
                                        </span>
                                        {gradeInfo && (
                                          <span
                                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${gradeInfo.badgeClass}`}
                                          >
                                            Grade {gradeInfo.grade}
                                          </span>
                                        )}
                                        <span className="text-[11px] font-semibold text-[#17233D] truncate">
                                          &bull;{' '}
                                          {item.hasValidInput
                                            ? item.rawDisplay
                                            : `Tersimpan (${item.measurement_unit})`}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] font-medium text-[#68758B]">
                                        Satuan ukur: <strong className="text-[#17233D]">{item.measurement_unit}</strong>
                                      </span>
                                    )}
                                  </div>

                                  {/* MOBILE Single Contextual Button: Opens Bottom Sheet Detail/Edit */}
                                  <button
                                    type="button"
                                    data-testid={`mobile-test-detail-btn-${item.test_code}`}
                                    onClick={() => setDetailSheetTestCode(item.test_code)}
                                    className={`md:hidden min-h-[44px] px-3.5 py-2 rounded-[12px] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                                      isCompleted
                                        ? 'bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2]'
                                        : 'bg-[#2455E8] text-white'
                                    }`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                    <span>{isCompleted ? 'Detail / Edit' : 'Detail / Input'}</span>
                                  </button>

                                  {/* DESKTOP Contextual Action Buttons (>= 768px) */}
                                  <div className="hidden md:flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandTestCard(item.test_code)}
                                      className={`min-h-[40px] px-3.5 py-1.5 rounded-[12px] text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isExpanded
                                          ? 'bg-[#101D38] text-white'
                                          : isCompleted
                                          ? 'bg-[#F5F7FC] hover:bg-[#2455E8] text-[#17233D] hover:text-white border border-[#E7EBF2]'
                                          : 'bg-[#2455E8] hover:bg-[#1D46C7] text-white'
                                      }`}
                                    >
                                      <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                      <span>
                                        {isExpanded
                                          ? 'Tutup'
                                          : isCompleted
                                          ? 'Detail / Edit'
                                          : 'Input Hasil'}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setDetailSheetTestCode(item.test_code)}
                                      className="min-w-[40px] min-h-[40px] rounded-[12px] bg-[#F5F7FC] hover:bg-[#E7EBF2]/70 text-[#68758B] hover:text-[#17233D] border border-[#E7EBF2] flex items-center justify-center transition-colors cursor-pointer"
                                      title="Lihat instruksi & detail lengkap"
                                      aria-label={`Instruksi ${item.test_name}`}
                                    >
                                      <HelpCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Desktop Inline Expanded Editor */}
                                {isExpanded && (
                                  <div className="hidden md:block pt-3 border-t border-[#E7EBF2] space-y-3">
                                    {item.field_guide && (
                                      <div className="flex items-center justify-between">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleProtocolGuide(item.test_code)
                                          }
                                          className="text-xs font-bold text-[#2455E8] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <HelpCircle className="w-3.5 h-3.5" />
                                          <span>
                                            {isGuideOpen
                                              ? 'Sembunyikan Panduan Lapangan'
                                              : 'Tampilkan Panduan Lapangan'}
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleStartOrResumeWizard(item.test_code)
                                          }
                                          className="text-xs font-bold text-[#68758B] hover:text-[#17233D] inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <Play className="w-3 h-3 text-[#2455E8]" />
                                          <span>Buka di Wizard</span>
                                        </button>
                                      </div>
                                    )}

                                    {isGuideOpen && item.field_guide && (
                                      <div className="p-3 rounded-[12px] bg-[#F5F7FC] border border-[#E7EBF2] text-xs text-[#17233D] space-y-1.5">
                                        <div>
                                          <strong className="font-bold">
                                            Alat &amp; Persiapan:
                                          </strong>{' '}
                                          <span className="text-[#68758B]">
                                            {item.field_guide.equipment}
                                          </span>
                                        </div>
                                        {Array.isArray(item.field_guide.steps) && (
                                          <ol className="list-decimal list-inside space-y-1 text-[#68758B]">
                                            {item.field_guide.steps.map((st, i) => (
                                              <li key={i}>{st}</li>
                                            ))}
                                          </ol>
                                        )}
                                      </div>
                                    )}

                                    {renderTestInputForm(item, false)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* H. COMPACT SESSION SYNCHRONIZATION BAR                                */}
      {/* ===================================================================== */}
      {!isArchived && (
        <div
          data-testid="session-sync-card"
          className="bg-[#FFFFFF] rounded-[16px] md:rounded-2xl p-3.5 sm:p-4 border border-[#E7EBF2] shadow-[0_4px_16px_rgba(16,29,56,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-extrabold text-[#17233D]">
              Sinkronisasi Hasil Sesi ke Rapor Atlet
            </h4>
            <p className="text-[11px] sm:text-xs text-[#68758B] font-medium mt-0.5">
              {sessionStats.measuredNowCount > 0
                ? `${sessionStats.measuredNowCount} hasil tes siap disimpan dan akan otomatis memperbarui Rapor & Polar Area.`
                : 'Hasil pengukuran yang disimpan akan langsung memperbarui skor Rapor & Polar Area.'}
            </p>
          </div>

          <button
            type="button"
            data-testid="save-master-session-btn"
            disabled={saving || sessionStats.measuredNowCount === 0}
            onClick={handleSaveAllAndSync}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-[14px] bg-[#16A779] hover:bg-[#128B64] disabled:bg-[#E7EBF2] disabled:text-[#68758B] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>
              {saving
                ? 'Menyimpan Sesi...'
                : `Simpan Hasil Sesi (${sessionStats.measuredNowCount} Tes)`}
            </span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* F. TEST DETAIL & EDIT BOTTOM SHEET                                    */}
      {/* ===================================================================== */}
      <MobileBottomSheet
        isOpen={Boolean(activeDetailTest)}
        onClose={() => setDetailSheetTestCode(null)}
        title={activeDetailTest?.test_name || 'Detail Tes'}
        subtitle={
          activeDetailTest
            ? `${
                DOMAIN_LABEL_MAP[activeDetailTest.category] ||
                activeDetailTest.category
              } • Subkategori: ${activeDetailTest.sub_indicator_name}`
            : ''
        }
      >
        {activeDetailTest && (
          <div
            data-testid="test-detail-bottom-sheet"
            className="space-y-4 text-left"
          >
            {/* Protocol Description & Field Instructions */}
            <div className="p-3.5 rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#2455E8]">
                  Instruksi Pengukuran
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#FFFFFF] border border-[#E7EBF2] text-[11px] font-bold text-[#17233D]">
                  Satuan: {activeDetailTest.measurement_unit}
                </span>
              </div>

              <p className="text-xs text-[#17233D] leading-relaxed font-medium my-0">
                {activeDetailTest.protocol_description}
              </p>

              {activeDetailTest.field_guide && (
                <div className="pt-2 border-t border-[#E7EBF2] space-y-1.5 text-xs">
                  <div>
                    <strong className="font-bold text-[#17233D]">
                      Alat &amp; Persiapan:
                    </strong>{' '}
                    <span className="text-[#68758B]">
                      {activeDetailTest.field_guide.equipment}
                    </span>
                  </div>
                  {Array.isArray(activeDetailTest.field_guide.steps) && (
                    <ol className="list-decimal list-inside space-y-1 text-[#68758B]">
                      {activeDetailTest.field_guide.steps.map((st, idx) => (
                        <li key={idx}>{st}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>

            {/* Measurement Input & Live Conversion Score */}
            {renderTestInputForm(activeDetailTest, false)}

            {/* Sheet Footer Actions */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                data-testid="detail-sheet-done-btn"
                onClick={() => setDetailSheetTestCode(null)}
                className="w-full min-h-[48px] rounded-[14px] bg-[#2455E8] text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Selesai &amp; Tutup Detail</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleStartOrResumeWizard(activeDetailTest.test_code)
                }
                className="w-full min-h-[44px] rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-[#2455E8]" />
                <span>Buka Tes Ini di Wizard Fokus</span>
              </button>
            </div>
          </div>
        )}
      </MobileBottomSheet>

      {/* ===================================================================== */}
      {/* D. MOBILE ADVANCED FILTER BOTTOM SHEET                                */}
      {/* ===================================================================== */}
      <MobileBottomSheet
        isOpen={showMobileFilterSheet}
        onClose={() => setShowMobileFilterSheet(false)}
        title="Filter Master Test Library"
        subtitle="Sesuaikan status pengukuran dan fase usia kurikulum"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#17233D]">
              Status Pengukuran Tes
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'COMPLETED', label: 'Selesai' },
                { id: 'PENDING', label: 'Belum Diukur' }
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`min-h-[44px] px-3 py-2 rounded-[12px] text-xs font-bold border transition-all cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-[#2455E8] text-white border-[#2455E8]'
                      : 'bg-[#F5F7FC] text-[#17233D] border-[#E7EBF2]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#17233D]">
              Fase Usia Benchmark
            </label>
            <div className="space-y-1.5">
              {FOOTBALL_AGE_GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setActiveTier(opt.tier);
                    if (onSelectTier) onSelectTier(opt.tier);
                  }}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-[12px] border text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    activeTier === opt.tier
                      ? 'bg-[#2455E8]/10 text-[#2455E8] border-[#2455E8]'
                      : 'bg-[#FFFFFF] text-[#17233D] border-[#E7EBF2]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {activeTier === opt.tier && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setActiveCategory('ALL');
                setShowMobileFilterSheet(false);
              }}
              className="w-full min-h-[48px] rounded-[14px] bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] text-xs font-bold cursor-pointer"
            >
              Reset Filter
            </button>
            <button
              type="button"
              onClick={() => setShowMobileFilterSheet(false)}
              className="w-full min-h-[48px] rounded-[14px] bg-[#101D38] text-white text-xs font-bold cursor-pointer"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </MobileBottomSheet>

      {/* RESET SESSION CONFIRMATION MODAL */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#101D38]/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#FFFFFF] rounded-2xl border border-[#E7EBF2] p-5 shadow-[0_16px_40px_rgba(16,29,56,0.18)] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-[#DC4545] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#17233D]">
                  Konfirmasi Reset Sesi Tes
                </h3>
                <p className="text-xs text-[#68758B] leading-relaxed mt-1">
                  Seluruh input pengukuran yang belum disimpan pada sesi ini akan
                  dikosongkan. Skor yang sudah tersimpan di Rapor Atlet tidak akan
                  terhapus.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5F7FC] hover:bg-[#E7EBF2]/70 text-[#17233D] border border-[#E7EBF2] text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="confirm-reset-session-btn"
                onClick={handleConfirmResetSession}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#DC4545] hover:bg-[#C53030] text-white text-xs font-bold cursor-pointer"
              >
                Ya, Reset Sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
