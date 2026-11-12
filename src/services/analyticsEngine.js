import {
  FOOTBALL_CORE_CATEGORIES,
  FOOTBALL_POSITIONS,
  resolveIndicatorScore,
  calculateCategoryAverage,
  calculateOverallScore,
  getFilteredIndicatorsForCategory,
  getPositionIndicatorsForTier
} from '../config/footballAssessmentData';

import {
  FUTSAL_CORE_CATEGORIES,
  FUTSAL_POSITIONS,
  getFilteredFutsalIndicatorsForCategory,
  getFutsalPositionIndicatorsForTier
} from '../config/futsalAssessmentData';

import {
  BADMINTON_CORE_CATEGORIES,
  BADMINTON_EVENT_INDICATORS,
  getFilteredBadmintonIndicatorsForCategory,
  getBadmintonEventSpecificConfigForTier
} from '../config/badmintonAssessmentData';

/**
 * =========================================================================
 * CHUVATOR ANALYTICS ENGINE (PHASE 2.0)
 * =========================================================================
 * Pure, deterministic calculation engine for multi-sport athlete analytics.
 * Strictly preserves Phase 1.0 foundations:
 * - Missing score (null) === UNTESTED (Never converted to 0)
 * - Score 0 is a valid score
 * - Distinct metric separation: Performance Score, Evaluation Coverage, Data Completeness, Development Trend
 * - Sport-separated registries (Football, Futsal, Badminton)
 */

// Helper to convert tier strings or numbers to 1-4 numeric tier
export function toNumericTier(tierInput) {
  if (typeof tierInput === 'number' && tierInput >= 1 && tierInput <= 4) return tierInput;
  const str = String(tierInput || '').trim().toUpperCase();
  if (str === '1' || str === 'TIER 1' || str.includes('TIER_1') || str.includes('FASE 1') || str.includes('FASE_1') || str.includes('FILANESIA_F1') || str.includes('F1') || str.includes('U6_U9') || str.includes('U-6') || str.includes('U-9')) return 1;
  if (str === '2' || str === 'TIER 2' || str.includes('TIER_2') || str.includes('FASE 2') || str.includes('FASE_2') || str.includes('FILANESIA_F2') || str.includes('F2') || str.includes('U10_U12') || str.includes('U10_U13') || str.includes('U-10') || str.includes('U-12') || str.includes('U-13')) return 2;
  if (str === '3' || str === 'TIER 3' || str.includes('TIER_3') || str.includes('FASE 3') || str.includes('FASE_3') || str.includes('FILANESIA_F3') || str.includes('F3') || str.includes('U13_U15') || str.includes('U14_U17') || str.includes('U-13') || str.includes('U-15') || str.includes('U-17')) return 3;
  if (str === '4' || str === 'TIER 4' || str.includes('TIER_4') || str.includes('FASE 4') || str.includes('FASE_4') || str.includes('FILANESIA_F4') || str.includes('F4') || str.includes('U16_U18') || str.includes('U18_UP') || str.includes('U-18') || str.includes('SENIOR')) return 4;
  return 1;
}

// Helper to standardize category display label (DISC-02)
export function getCategoryDisplayLabel(categoryKey, { uppercase = false } = {}) {
  if (categoryKey === 'spesifik_posisi') {
    return uppercase ? 'KHUSUS POSISI' : 'Khusus Posisi';
  }
  const formatted = String(categoryKey || '').replace(/_/g, ' ');
  if (uppercase) return formatted.toUpperCase();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Helper to get all indicators for a specific sport, tier, and role/position
export function getSportIndicatorsRegistry(sport = 'football', activeTier = 'TIER_1_U6_U9', roleOrPosition = null) {
  const normalizedSport = String(sport || 'football').toLowerCase();
  const numTier = toNumericTier(activeTier);

  let categoriesMap = {};
  let positionIndicators = [];

  const isValidRole = roleOrPosition &&
    roleOrPosition !== 'POSITION_UNVERIFIED' &&
    typeof roleOrPosition === 'string' &&
    roleOrPosition.trim() !== '';

  const cleanRole = isValidRole ? roleOrPosition.trim() : null;

  if (normalizedSport.includes('futsal')) {
    Object.keys(FUTSAL_CORE_CATEGORIES).forEach((k) => {
      categoriesMap[k] = getFilteredFutsalIndicatorsForCategory(k, numTier);
    });
    if (cleanRole) {
      const res = getFutsalPositionIndicatorsForTier(cleanRole, numTier);
      positionIndicators = res?.indicators || (Array.isArray(res) ? res : []);
    }
  } else if (normalizedSport.includes('badminton') || normalizedSport.includes('bulutangkis')) {
    Object.keys(BADMINTON_CORE_CATEGORIES).forEach((k) => {
      categoriesMap[k] = getFilteredBadmintonIndicatorsForCategory(k, numTier);
    });
    if (cleanRole && BADMINTON_EVENT_INDICATORS[cleanRole]) {
      const eventConfig = getBadmintonEventSpecificConfigForTier(cleanRole, numTier);
      positionIndicators = eventConfig?.indicators || (Array.isArray(eventConfig) ? eventConfig : []);
    }
  } else {
    // Default Football
    Object.keys(FOOTBALL_CORE_CATEGORIES).forEach((k) => {
      categoriesMap[k] = getFilteredIndicatorsForCategory(k, numTier);
    });
    if (cleanRole) {
      const res = getPositionIndicatorsForTier(cleanRole, numTier);
      positionIndicators = res?.indicators || (Array.isArray(res) ? res : []);
    }
  }

  // Flatten all universal indicators
  const universalIndicators = [];
  const categoryKeys = Object.keys(categoriesMap);

  categoryKeys.forEach((catKey) => {
    const list = categoriesMap[catKey] || [];
    list.forEach((ind) => universalIndicators.push({ ...ind, categoryKey: catKey }));
  });

  return {
    categoriesMap,
    categoryKeys,
    universalIndicators,
    positionIndicators,
    allIndicators: [...universalIndicators, ...positionIndicators]
  };
}

/**
 * MODULE 1 & 2: ATHLETE PERFORMANCE & CATEGORY ANALYTICS
 * Analyzes single evaluation scores against full registry.
 */
export function analyzeAthletePerformance({
  scores = {},
  sport = 'football',
  activeTier = 'TIER_1_U6_U9',
  playerRole = null
}) {
  const registry = getSportIndicatorsRegistry(sport, activeTier, playerRole);
  const categoryAnalysis = {};
  let totalRegistryIndicators = 0;
  let totalEvaluatedCount = 0;
  let totalUntestedCount = 0;
  const evaluatedIndicatorList = [];

  registry.categoryKeys.forEach((catKey) => {
    const rawList = registry.categoriesMap[catKey] || [];
    let catEvaluated = 0;
    let catUntested = 0;
    let catSum = 0;
    const indicatorDetails = [];

    rawList.forEach((ind) => {
      totalRegistryIndicators++;
      const val = resolveIndicatorScore(scores, ind);
      const isEvaluated = val !== null && val !== undefined && !Number.isNaN(val);

      if (isEvaluated) {
        catEvaluated++;
        totalEvaluatedCount++;
        catSum += val;
        const detail = {
          id: ind.id,
          name: ind.name,
          categoryKey: catKey,
          score: val,
          status: 'EVALUATED',
          legacyKeys: ind.legacy_keys || []
        };
        indicatorDetails.push(detail);
        evaluatedIndicatorList.push(detail);
      } else {
        catUntested++;
        totalUntestedCount++;
        indicatorDetails.push({
          id: ind.id,
          name: ind.name,
          categoryKey: catKey,
          score: null,
          status: 'UNTESTED',
          legacyKeys: ind.legacy_keys || []
        });
      }
    });

    const categoryAverage = catEvaluated > 0 ? Math.round(catSum / catEvaluated) : null;
    const completenessPercent = rawList.length > 0 ? Math.round((catEvaluated / rawList.length) * 100) : 0;

    categoryAnalysis[catKey] = {
      categoryKey: catKey,
      displayName: getCategoryDisplayLabel(catKey, { uppercase: false }),
      label: getCategoryDisplayLabel(catKey, { uppercase: true }),
      categoryAverage,
      totalCount: rawList.length,
      evaluatedCount: catEvaluated,
      untestedCount: catUntested,
      completenessPercent,
      indicators: indicatorDetails
    };
  });

  // Position / Event specific category analysis if applicable
  if (registry.positionIndicators.length > 0) {
    let posEvaluated = 0;
    let posUntested = 0;
    let posSum = 0;
    const posDetails = [];

    registry.positionIndicators.forEach((ind) => {
      totalRegistryIndicators++;
      const val = resolveIndicatorScore(scores, ind);
      const isEvaluated = val !== null && val !== undefined && !Number.isNaN(val);

      if (isEvaluated) {
        posEvaluated++;
        totalEvaluatedCount++;
        posSum += val;
        const detail = {
          id: ind.id,
          name: ind.name,
          categoryKey: 'spesifik_posisi',
          score: val,
          status: 'EVALUATED',
          legacyKeys: ind.legacy_keys || []
        };
        posDetails.push(detail);
        evaluatedIndicatorList.push(detail);
      } else {
        posUntested++;
        totalUntestedCount++;
        posDetails.push({
          id: ind.id,
          name: ind.name,
          categoryKey: 'spesifik_posisi',
          score: null,
          status: 'UNTESTED',
          legacyKeys: ind.legacy_keys || []
        });
      }
    });

    const posAverage = posEvaluated > 0 ? Math.round(posSum / posEvaluated) : null;
    const posCompleteness = registry.positionIndicators.length > 0
      ? Math.round((posEvaluated / registry.positionIndicators.length) * 100)
      : 0;

    categoryAnalysis.spesifik_posisi = {
      categoryKey: 'spesifik_posisi',
      displayName: 'Khusus Posisi',
      label: 'KHUSUS POSISI',
      categoryAverage: posAverage,
      totalCount: registry.positionIndicators.length,
      evaluatedCount: posEvaluated,
      untestedCount: posUntested,
      completenessPercent: posCompleteness,
      indicators: posDetails
    };
  }

  // Calculate Overall Performance Score (Average of valid category averages)
  const validCatAverages = Object.values(categoryAnalysis)
    .map((c) => c.categoryAverage)
    .filter((avg) => avg !== null && avg !== undefined);

  const overallScore = validCatAverages.length > 0
    ? Math.round(validCatAverages.reduce((acc, v) => acc + v, 0) / validCatAverages.length)
    : null;

  // Evaluation Coverage Metric (%)
  const evaluationCoverage = totalRegistryIndicators > 0
    ? Math.round((totalEvaluatedCount / totalRegistryIndicators) * 100)
    : 0;

  // Sort evaluated indicators to determine Top Strengths & Bottom Weaknesses
  const sortedEvaluated = [...evaluatedIndicatorList].sort((a, b) => b.score - a.score);
  const strengths = sortedEvaluated.slice(0, 3);
  const weaknesses = sortedEvaluated.length >= 3
    ? [...sortedEvaluated].reverse().slice(0, 3)
    : [];

  return {
    overallScore,
    evaluationCoverage,
    totalRegistryIndicators,
    totalEvaluatedCount,
    totalUntestedCount,
    categoryAnalysis,
    strengths,
    weaknesses,
    evaluatedIndicatorList
  };
}

/**
 * MODULE 3: POSITION & EVENT SPECIFIC ANALYTICS
 */
export function analyzePositionEventPerformance({
  scores = {},
  sport = 'football',
  activeTier = 'TIER_1_U6_U9',
  roleOrPosition = null
}) {
  const isUnverified = !roleOrPosition ||
    roleOrPosition === 'POSITION_UNVERIFIED' ||
    typeof roleOrPosition !== 'string' ||
    roleOrPosition.trim() === '';

  if (isUnverified) {
    return {
      roleOrPosition: 'POSITION_UNVERIFIED',
      isVerified: false,
      warning: 'Posisi atlet belum terverifikasi pada sesi evaluasi maupun profil.',
      positionAverage: null,
      totalCount: 0,
      evaluatedCount: 0,
      untestedCount: 0,
      coveragePercent: 0,
      indicators: []
    };
  }

  const cleanRole = roleOrPosition.trim();
  const registry = getSportIndicatorsRegistry(sport, activeTier, cleanRole);
  const indicators = registry.positionIndicators || [];

  if (indicators.length === 0) {
    return {
      roleOrPosition: cleanRole,
      isVerified: false,
      warning: `Tidak ditemukan indikator spesifik untuk posisi ${cleanRole} pada tier yang dipilih.`,
      positionAverage: null,
      totalCount: 0,
      evaluatedCount: 0,
      untestedCount: 0,
      coveragePercent: 0,
      indicators: []
    };
  }

  let evaluatedCount = 0;
  let untestedCount = 0;
  let sum = 0;
  const list = [];

  indicators.forEach((ind) => {
    const val = resolveIndicatorScore(scores, ind);
    if (val !== null && val !== undefined && !Number.isNaN(val)) {
      evaluatedCount++;
      sum += val;
      list.push({ id: ind.id, name: ind.name, score: val, status: 'EVALUATED' });
    } else {
      untestedCount++;
      list.push({ id: ind.id, name: ind.name, score: null, status: 'UNTESTED' });
    }
  });

  const positionAverage = evaluatedCount > 0 ? Math.round(sum / evaluatedCount) : null;
  const coveragePercent = indicators.length > 0 ? Math.round((evaluatedCount / indicators.length) * 100) : 0;

  return {
    roleOrPosition: cleanRole,
    isVerified: true,
    warning: null,
    positionAverage,
    totalCount: indicators.length,
    evaluatedCount,
    untestedCount,
    coveragePercent,
    indicators: list
  };
}

/**
 * MODULE 4: ATHLETE DEVELOPMENT PROGRESS
 * Evaluates development trends across historical evaluation sessions with longitudinal integrity.
 */
export function analyzeAthleteDevelopment({
  evaluations = [],
  sport = 'football',
  activeTier = 'TIER_1_U6_U9',
  playerRole = null
}) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return {
      hasHistory: false,
      evaluationTimeline: [],
      overallDelta: 0,
      categoryDeltas: {},
      trendDirection: 'INSUFFICIENT_DATA',
      trendClassification: 'INSUFFICIENT_DATA',
      coverageShift: 0,
      significantCoverageShift: false,
      positionChanged: false,
      tierChanged: false,
      contextMismatch: false
    };
  }

  // Always sort chronologically (oldest date to newest date)
  const sortedEvals = [...evaluations].sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));

  let sportChanged = false;
  let positionChanged = false;
  let tierChanged = false;

  const initialSport = sortedEvals[0]?.sport || sport;
  const initialTier = sortedEvals[0]?.activeTier || activeTier;
  const initialRole = sortedEvals[0]?.playerRole || sortedEvals[0]?.position || playerRole;

  const timeline = sortedEvals.map((ev, index) => {
    const evSport = ev.sport || sport;
    const evTier = ev.activeTier || activeTier;
    const evRole = ev.playerRole || ev.position || playerRole || 'POSITION_UNVERIFIED';

    if (evSport && String(evSport).toLowerCase() !== String(initialSport).toLowerCase()) {
      sportChanged = true;
    }
    if (evTier && toNumericTier(evTier) !== toNumericTier(initialTier)) {
      tierChanged = true;
    }
    const safeInitialRole = (initialRole && typeof initialRole === 'string' && initialRole.trim() !== '') ? initialRole.trim() : 'POSITION_UNVERIFIED';
    const safeEvRole = (evRole && typeof evRole === 'string' && evRole.trim() !== '') ? evRole.trim() : 'POSITION_UNVERIFIED';
    if (safeEvRole.toUpperCase() !== safeInitialRole.toUpperCase()) {
      positionChanged = true;
    }

    const perf = analyzeAthletePerformance({
      scores: ev.scores || {},
      sport: evSport,
      activeTier: evTier,
      playerRole: safeEvRole !== 'POSITION_UNVERIFIED' ? safeEvRole : null
    });

    return {
      index,
      id: ev.id,
      date: ev.date || (ev.createdAt ? ev.createdAt.split('T')[0] : 'N/A'),
      overallScore: perf.overallScore,
      evaluationCoverage: perf.evaluationCoverage,
      categoryAnalysis: perf.categoryAnalysis,
      coachNote: ev.coachNote || ev.notes || '',
      sport: evSport,
      activeTier: evTier,
      playerRole: safeEvRole
    };
  });

  const firstEval = timeline[0];
  const latestEval = timeline[timeline.length - 1];

  const overallDelta = (latestEval.overallScore !== null && firstEval.overallScore !== null)
    ? latestEval.overallScore - firstEval.overallScore
    : 0;

  const coverageShift = Math.abs(latestEval.evaluationCoverage - firstEval.evaluationCoverage);
  const significantCoverageShift = coverageShift >= 25;

  const categoryDeltas = {};
  const allCatKeys = new Set([
    ...Object.keys(firstEval.categoryAnalysis || {}),
    ...Object.keys(latestEval.categoryAnalysis || {})
  ]);

  allCatKeys.forEach((catKey) => {
    // Skip position-specific category if position changed between evaluations
    if (positionChanged && catKey === 'spesifik_posisi') {
      categoryDeltas[catKey] = {
        firstAvg: firstEval.categoryAnalysis[catKey]?.categoryAverage ?? null,
        latestAvg: latestEval.categoryAnalysis[catKey]?.categoryAverage ?? null,
        delta: null,
        mismatchNote: 'Posisi atlet berubah antar evaluasi, delta indikator posisi diabaikan'
      };
      return;
    }

    const firstAvg = firstEval.categoryAnalysis[catKey]?.categoryAverage;
    const latestAvg = latestEval.categoryAnalysis[catKey]?.categoryAverage;

    if (firstAvg !== null && latestAvg !== null && firstAvg !== undefined && latestAvg !== undefined) {
      categoryDeltas[catKey] = {
        firstAvg,
        latestAvg,
        delta: latestAvg - firstAvg
      };
    } else {
      categoryDeltas[catKey] = {
        firstAvg: firstAvg ?? null,
        latestAvg: latestAvg ?? null,
        delta: null
      };
    }
  });

  // Trend classification rules:
  // - length < 2: INSUFFICIENT_DATA
  // - length === 2: PRELIMINARY_TREND (Need >= 3 points for operational baseline)
  // - length >= 3: ESTABLISHED_TREND (Operational threshold for trend classification)
  let trendClassification = 'ESTABLISHED_TREND';
  let trendDirection = 'STABLE';

  if (timeline.length < 2) {
    trendClassification = 'INSUFFICIENT_DATA';
    trendDirection = 'INSUFFICIENT_DATA';
  } else {
    if (timeline.length === 2) {
      trendClassification = 'PRELIMINARY_TREND';
    }
    if (overallDelta > 2) trendDirection = 'IMPROVING';
    else if (overallDelta < -2) trendDirection = 'DECLINING';
  }

  return {
    hasHistory: timeline.length > 1,
    timelineCount: timeline.length,
    evaluationTimeline: timeline,
    latestOverallScore: latestEval.overallScore,
    firstOverallScore: firstEval.overallScore,
    overallDelta,
    categoryDeltas,
    trendDirection,
    trendClassification,
    coverageShift,
    significantCoverageShift,
    positionChanged,
    tierChanged,
    contextMismatch: Boolean(sportChanged || positionChanged || tierChanged)
  };
}

/**
 * MODULE 5: ATHLETE COMPARISON
 * Side-by-side comparison of 2 athletes on comparable indicators.
 */
export function compareAthletes({
  athleteA = {},
  athleteB = {},
  sport = 'football',
  sportA = null,
  sportB = null,
  activeTier = 'TIER_1_U6_U9'
}) {
  const finalSportA = String(sportA || athleteA.sport || sport || 'football').toLowerCase();
  const finalSportB = String(sportB || athleteB.sport || sport || 'football').toLowerCase();

  // 1. Cross-Sport Comparison Rejection
  if (finalSportA !== finalSportB) {
    return {
      isComparable: false,
      errorReason: 'CROSS_SPORT_MISMATCH',
      message: `Perbandingan antar cabang olahraga tidak diizinkan (${finalSportA.toUpperCase()} vs ${finalSportB.toUpperCase()}).`
    };
  }

  const perfA = analyzeAthletePerformance({
    scores: athleteA.scores || {},
    sport: finalSportA,
    activeTier,
    playerRole: athleteA.playerRole
  });

  const perfB = analyzeAthletePerformance({
    scores: athleteB.scores || {},
    sport: finalSportB,
    activeTier,
    playerRole: athleteB.playerRole
  });

  // 2. Position/Event Mismatch Flag
  const positionMismatch = (athleteA.playerRole || '') !== (athleteB.playerRole || '');

  const categoryComparison = {};
  const commonCatKeys = new Set([
    ...Object.keys(perfA.categoryAnalysis),
    ...Object.keys(perfB.categoryAnalysis)
  ]);

  let totalComparableIndicators = 0;

  commonCatKeys.forEach((catKey) => {
    // Skip position specific category if position mismatch exists
    if (positionMismatch && catKey === 'spesifik_posisi') {
      categoryComparison[catKey] = {
        categoryKey: catKey,
        displayName: getCategoryDisplayLabel(catKey, { uppercase: false }),
        label: getCategoryDisplayLabel(catKey, { uppercase: true }),
        avgA: perfA.categoryAnalysis[catKey]?.categoryAverage ?? null,
        avgB: perfB.categoryAnalysis[catKey]?.categoryAverage ?? null,
        diff: null,
        mismatchNote: 'Posisi/Event berbeda, indikator khusus tidak dapat dibandingkan'
      };
      return;
    }

    const avgA = perfA.categoryAnalysis[catKey]?.categoryAverage ?? null;
    const avgB = perfB.categoryAnalysis[catKey]?.categoryAverage ?? null;
    const diff = (avgA !== null && avgB !== null) ? avgA - avgB : null;

    const countA = perfA.categoryAnalysis[catKey]?.evaluatedCount || 0;
    const countB = perfB.categoryAnalysis[catKey]?.evaluatedCount || 0;
    totalComparableIndicators += Math.min(countA, countB);

    categoryComparison[catKey] = {
      categoryKey: catKey,
      displayName: getCategoryDisplayLabel(catKey, { uppercase: false }),
      label: getCategoryDisplayLabel(catKey, { uppercase: true }),
      avgA,
      avgB,
      diff
    };
  });

  const overallDiff = (perfA.overallScore !== null && perfB.overallScore !== null)
    ? perfA.overallScore - perfB.overallScore
    : null;

  return {
    isComparable: true,
    sport: finalSportA,
    positionMismatch,
    comparableIndicatorsCount: totalComparableIndicators,
    athleteA: { name: athleteA.name || athleteA.studentName || 'Atlet A', role: athleteA.playerRole, perf: perfA },
    athleteB: { name: athleteB.name || athleteB.studentName || 'Atlet B', role: athleteB.playerRole, perf: perfB },
    overallDiff,
    categoryComparison
  };
}

/**
 * MODULE 6: ACADEMY & TEAM ANALYTICS
 * Aggregates group performance across students & evaluations within a tenant.
 */
export function analyzeAcademyTeamPerformance({
  evaluations = [],
  students = [],
  sport = 'football',
  tenantId = null
}) {
  // Enforce Tenant Isolation (Fail-Closed)
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    return {
      error: 'INVALID_TENANT_ID',
      message: 'Tenant ID valid diperlukan untuk agregasi analitik akademi.',
      tenantId: null,
      totalStudents: 0,
      evaluatedStudentsCount: 0,
      untestedStudentsCount: 0,
      coverageRatePercent: 0,
      teamOverallAverage: null,
      teamCategoryAverages: {},
      positionDistribution: {}
    };
  }

  const cleanTenantId = tenantId.trim();

  const filteredStudents = students.filter(
    (s) => Boolean(s && (s.tenantId || s.tenant_id) === cleanTenantId)
  );
  const filteredEvals = evaluations.filter(
    (e) => Boolean(e && (e.tenantId || e.tenant_id) === cleanTenantId)
  );

  const totalStudents = filteredStudents.length;
  const evaluatedStudentIds = new Set(filteredEvals.map((e) => e.studentId).filter(Boolean));
  const evaluatedStudentsCount = evaluatedStudentIds.size;
  const coverageRatePercent = totalStudents > 0
    ? Math.round((evaluatedStudentsCount / totalStudents) * 100)
    : 0;

  // Aggregate category averages across all evaluations
  const categorySums = {};
  const categoryCounts = {};
  let overallScoreSum = 0;
  let overallScoreCount = 0;

  filteredEvals.forEach((ev) => {
    const perf = analyzeAthletePerformance({
      scores: ev.scores || {},
      sport: ev.sport || sport,
      activeTier: ev.activeTier || 'TIER_1_U6_U9',
      playerRole: ev.playerRole
    });

    if (perf.overallScore !== null) {
      overallScoreSum += perf.overallScore;
      overallScoreCount++;
    }

    Object.entries(perf.categoryAnalysis).forEach(([catKey, catData]) => {
      if (catData.categoryAverage !== null) {
        categorySums[catKey] = (categorySums[catKey] || 0) + catData.categoryAverage;
        categoryCounts[catKey] = (categoryCounts[catKey] || 0) + 1;
      }
    });
  });

  const teamCategoryAverages = {};
  Object.keys(categorySums).forEach((catKey) => {
    teamCategoryAverages[catKey] = Math.round(categorySums[catKey] / categoryCounts[catKey]);
  });

  const teamOverallAverage = overallScoreCount > 0
    ? Math.round(overallScoreSum / overallScoreCount)
    : null;

  // Position / Role Distribution
  const positionDistribution = {};
  filteredStudents.forEach((s) => {
    const role = s.playerRole || s.position || 'Unspecified';
    positionDistribution[role] = (positionDistribution[role] || 0) + 1;
  });

  return {
    tenantId,
    totalStudents,
    evaluatedStudentsCount,
    untestedStudentsCount: Math.max(0, totalStudents - evaluatedStudentsCount),
    coverageRatePercent,
    teamOverallAverage,
    teamCategoryAverages,
    positionDistribution
  };
}

/**
 * MODULE 7: ADVANCED REPORTING PAYLOAD GENERATOR
 */
export function generateAnalyticsReport({
  type = 'INDIVIDUAL_ATHLETE',
  athleteData = {},
  analyticsResult = {},
  tenantName = 'CHUVATOR Academy'
}) {
  const generatedAt = new Date().toISOString();

  return {
    reportType: type,
    tenantName,
    generatedAt,
    athleteContext: {
      id: athleteData.id,
      name: athleteData.name || athleteData.studentName,
      className: athleteData.className,
      sport: athleteData.sport || 'Football',
      playerRole: athleteData.playerRole || 'N/A',
      birthDate: athleteData.birthDate || 'N/A'
    },
    metricsSummary: {
      overallScore: analyticsResult.overallScore ?? 'N/A',
      evaluationCoverage: `${analyticsResult.evaluationCoverage ?? 0}%`,
      totalEvaluatedCount: analyticsResult.totalEvaluatedCount ?? 0,
      totalUntestedCount: analyticsResult.totalUntestedCount ?? 0
    },
    categoryAnalysis: analyticsResult.categoryAnalysis || {},
    strengths: analyticsResult.strengths || [],
    weaknesses: analyticsResult.weaknesses || []
  };
}

/**
 * MODULE 8: DATA QUALITY & EVALUATION COVERAGE AUDITOR
 */
export function analyzeDataQuality({
  evaluations = [],
  sport = 'football'
}) {
  let totalEvaluations = evaluations.length;
  let totalScoresRecorded = 0;
  let totalUntestedIndicators = 0;
  let totalMissingLegacyMappings = 0;
  let totalInvalidScores = 0;
  const warningList = [];

  evaluations.forEach((ev, idx) => {
    const scores = ev.scores || {};
    const perf = analyzeAthletePerformance({
      scores,
      sport: ev.sport || sport,
      activeTier: ev.activeTier || 'TIER_1_U6_U9',
      playerRole: ev.playerRole
    });

    totalScoresRecorded += perf.totalEvaluatedCount;
    totalUntestedIndicators += perf.totalUntestedCount;

    if (perf.evaluationCoverage < 30) {
      warningList.push({
        evaluationId: ev.id || `eval_${idx}`,
        studentId: ev.studentId,
        studentName: ev.studentName || 'Siswa',
        issue: 'LOW_COVERAGE',
        message: `Kelengkapan evaluasi sangat rendah (${perf.evaluationCoverage}%)`
      });
    }

    // Check for invalid numeric scores (e.g., negative or > 100)
    Object.entries(scores).forEach(([key, val]) => {
      if (val !== null && val !== undefined && val !== '') {
        const num = Number(val);
        if (Number.isNaN(num) || num < 0 || num > 100) {
          totalInvalidScores++;
          warningList.push({
            evaluationId: ev.id || `eval_${idx}`,
            key,
            value: val,
            issue: 'INVALID_SCORE',
            message: `Nilai "${val}" pada indikator "${key}" tidak valid (harus 0-100)`
          });
        }
      }
    });
  });

  const dataQualityScore = totalEvaluations > 0
    ? Math.max(0, 100 - (warningList.length * 5) - (totalInvalidScores * 10))
    : 100;

  return {
    totalEvaluations,
    totalScoresRecorded,
    totalUntestedIndicators,
    totalMissingLegacyMappings,
    totalInvalidScores,
    dataQualityScore,
    warningList
  };
}
