import { supabase } from '../config/supabase';
import { toUuidOrNull, toDateOrNull, getAttendance } from './supabaseAcademyService';
import {
  MASTER_INDICATOR_KEY_TO_LABEL,
  calculateAssessmentScore,
  aggregateIndicatorScores,
  resolveMasterFootballTest,
  getMasterTestsForContext,
  buildWizardResumeStorageKey,
  calculateAthleteAttendanceMetrics,
  buildBaselineIndicatorScoresForAthlete,
  normalizeIndicatorKey
} from '../utils/footballAssessmentEngine';

const DEMO_INDICATOR_STORAGE_PREFIX = 'chuvator_demo_combine_indicators_';
const DEMO_SESSIONS_STORAGE_PREFIX = 'chuvator_demo_master_sessions_';

function isDemoAssessmentContext(tenantId, athleteId) {
  if (!tenantId) return true;
  if (tenantId === 'demo-tenant-1') return true;
  return !toUuidOrNull(tenantId) || !toUuidOrNull(athleteId);
}

function readLocalJson(key, fallback) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[scoutingCombineService] localStorage write failed:', err);
  }
}

function enrichMasterCatalogRow(row) {
  const localMeta =
    resolveMasterFootballTest(row.test_code) ||
    resolveMasterFootballTest(row.id) ||
    resolveMasterFootballTest(row.indicator_key) ||
    {};
  const indicatorKey = row.indicator_key || localMeta.indicator_key || '';
  return {
    ...localMeta,
    ...row,
    test_code: row.test_code || localMeta.test_code,
    indicator_key: indicatorKey,
    indicator_label:
      row.indicator_label ||
      localMeta.indicator_label ||
      MASTER_INDICATOR_KEY_TO_LABEL[indicatorKey] ||
      row.test_name
  };
}

/**
 * Fetch Master Football Tests Catalog from `public.master_football_tests_catalog`
 * with fallback to `MASTER_FOOTBALL_TESTS_CATALOG`.
 */
export async function getMasterFootballCatalog({
  tenantId = null,
  category = 'ALL',
  tier = 4,
  positionCode = null
} = {}) {
  const normalizedTier = Math.max(1, Math.min(4, Number(tier) || 4));
  const fallbackList = getMasterTestsForContext({
    tier: normalizedTier,
    category,
    positionCode
  });

  if (tenantId === 'demo-tenant-1' || (tenantId && !toUuidOrNull(tenantId))) {
    return fallbackList;
  }

  try {
    let query = supabase
      .from('master_football_tests_catalog')
      .select('*')
      .lte('min_tier', normalizedTier)
      .order('test_code', { ascending: true });

    if (category && category !== 'ALL') {
      if (Array.isArray(category)) {
        query = query.in('category', category);
      } else {
        query = query.eq('category', category);
      }
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data) || data.length === 0) {
      return fallbackList;
    }

    return data.map(enrichMasterCatalogRow);
  } catch {
    return fallbackList;
  }
}

/**
 * Automatically query `academy_attendance` records for the athlete and convert
 * their real attendance percentage into `Perkembangan Atlet` indicator scores:
 * - `kehadiran_latihan` (DEV01: Kehadiran Latihan)
 * - `kepatuhan_program` (DEV02: Kepatuhan Program)
 * - `konsistensi_kehadiran` (DEV03: Konsistensi Kehadiran)
 */
export async function syncAthleteAttendanceToDevelopmentIndicators({
  tenantId,
  classId = null,
  athleteId,
  athleteName = ''
} = {}) {
  if (!tenantId || !athleteId) return null;

  let attendanceRows = [];
  try {
    attendanceRows = await getAttendance(tenantId, classId, 120);
  } catch (err) {
    console.warn('[scoutingCombineService] getAttendance fallback:', err);
  }

  const attendanceMetrics = calculateAthleteAttendanceMetrics(
    attendanceRows,
    athleteId,
    athleteName
  );
  const nowIso = new Date().toISOString();
  const syncedIndicators = {};

  Object.entries(attendanceMetrics.indicators).forEach(([indKey, rec]) => {
    syncedIndicators[indKey] = {
      id: `att-ind-${indKey}`,
      tenant_id: tenantId,
      athlete_id: athleteId,
      indicator_key: indKey,
      indicator_label: rec.indicator_label,
      test_code: rec.test_code,
      score: rec.score,
      source: 'attendance_sync',
      attendance_percentage: attendanceMetrics.attendancePercentage,
      badge_text: attendanceMetrics.badgeText,
      updated_at: nowIso
    };
  });

  if (isDemoAssessmentContext(tenantId, athleteId)) {
    const indicatorsKey = `${DEMO_INDICATOR_STORAGE_PREFIX}${tenantId}_${athleteId}`;
    const existing = readLocalJson(indicatorsKey, {});
    const merged = { ...existing, ...syncedIndicators };
    writeLocalJson(indicatorsKey, merged);
  } else {
    try {
      const payload = Object.values(syncedIndicators).map((item) => ({
        tenant_id: tenantId,
        athlete_id: athleteId,
        indicator_key: item.indicator_key,
        score: item.score,
        source: 'attendance_sync',
        updated_at: nowIso
      }));
      await supabase
        .from('athlete_indicator_scores')
        .upsert(payload, { onConflict: 'tenant_id,athlete_id,indicator_key' });
    } catch (err) {
      console.warn('[scoutingCombineService] attendance_sync upsert warning:', err);
    }
  }

  return {
    attendanceMetrics,
    indicators: syncedIndicators
  };
}

/**
 * Fetch latest indicator scores from `public.athlete_indicator_scores`, merged with
 * baseline field test scores and live automated attendance indicators so zero indicators are 0/empty.
 * Returns map keyed by `indicator_key`: { [key]: { indicator_key, indicator_label, score, source, updated_at } }
 */
export async function getAthleteIndicatorScores(tenantId, athleteId, options = {}) {
  if (!tenantId || !athleteId) return {};

  const classId = options.classId || null;
  const athleteName = options.athleteName || '';
  const tier = Math.max(1, Math.min(4, Number(options.tier) || 2));

  let attendanceRows = [];
  try {
    attendanceRows = await getAttendance(tenantId, classId, 120);
  } catch {
    attendanceRows = [];
  }

  const baselineMap = buildBaselineIndicatorScoresForAthlete({
    athleteId,
    athleteName,
    tier,
    attendanceRows
  });

  if (isDemoAssessmentContext(tenantId, athleteId)) {
    const key = `${DEMO_INDICATOR_STORAGE_PREFIX}${tenantId}_${athleteId}`;
    const storedMap = readLocalJson(key, {});
    const merged = { ...baselineMap };

    Object.entries(storedMap || {}).forEach(([rawKey, rec]) => {
      if (!rec) return;
      const canonicalKey = normalizeIndicatorKey(rawKey);
      if (!canonicalKey) return;
      // Preserve live attendance_sync calculation for development indicators
      if (merged[canonicalKey]?.source === 'attendance_sync' && rec.source !== 'attendance_sync') {
        return;
      }
      const numScore = Number(rec.score);
      if (Number.isFinite(numScore) && numScore > 0) {
        merged[canonicalKey] = {
          ...merged[canonicalKey],
          ...rec,
          indicator_key: canonicalKey,
          indicator_label:
            MASTER_INDICATOR_KEY_TO_LABEL[canonicalKey] || rec.indicator_label || canonicalKey,
          score: Math.max(1, Math.min(100, Math.round(numScore)))
        };
      }
    });

    writeLocalJson(key, merged);
    return merged;
  }

  const { data, error } = await supabase
    .from('athlete_indicator_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('athlete_id', athleteId);

  if (error) {
    console.warn('[scoutingCombineService] getAthleteIndicatorScores error:', error);
    return baselineMap;
  }

  const map = { ...baselineMap };
  (data || []).forEach((row) => {
    const canonicalKey = normalizeIndicatorKey(row.indicator_key);
    if (!canonicalKey) return;
    if (map[canonicalKey]?.source === 'attendance_sync' && row.source !== 'attendance_sync') {
      return;
    }
    const numScore = Number(row.score);
    if (Number.isFinite(numScore) && numScore > 0) {
      map[canonicalKey] = {
        ...map[canonicalKey],
        id: row.id,
        indicator_key: canonicalKey,
        indicator_label:
          MASTER_INDICATOR_KEY_TO_LABEL[canonicalKey] || row.indicator_key,
        score: Math.max(1, Math.min(100, Math.round(numScore))),
        source: row.source || 'battery_test',
        updated_at: row.updated_at
      };
    }
  });
  return map;
}

/**
 * Fetch recent raw master test sessions from `public.athlete_test_sessions`.
 */
export async function getAthleteTestSessions(tenantId, athleteId, limitCount = 60) {
  if (!tenantId || !athleteId) return [];

  if (isDemoAssessmentContext(tenantId, athleteId)) {
    const key = `${DEMO_SESSIONS_STORAGE_PREFIX}${tenantId}_${athleteId}`;
    const list = readLocalJson(key, []);
    return Array.isArray(list) ? list.slice(0, limitCount) : [];
  }

  const { data, error } = await supabase
    .from('athlete_test_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('athlete_id', athleteId)
    .order('testing_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.warn('[scoutingCombineService] getAthleteTestSessions error:', error);
    return [];
  }

  return data || [];
}

/**
 * Persist Master Test Library session entries to `public.athlete_test_sessions`
 * and atomically aggregate + upsert `public.athlete_indicator_scores` (source = 'battery_test')
 * so the Athlete Polar Area Chart updates in real time.
 */
export async function saveMasterAssessmentSessionAndSync({
  tenantId,
  athleteId,
  evaluatorId = null,
  testingDate = null,
  tier = 2,
  sessionEntries = []
}) {
  if (!tenantId || !athleteId) {
    throw new Error('Tenant ID dan Atlet wajib dipilih sebelum menyimpan sesi penilaian.');
  }
  if (!Array.isArray(sessionEntries) || sessionEntries.length === 0) {
    throw new Error('Minimal satu hasil tes pada Master Test Library harus diisi sebelum sinkronisasi.');
  }

  const finalDate = toDateOrNull(testingDate) || new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const normalizedSessions = sessionEntries.map((item) => {
    const code = item.test_code || item.testCode || item.testId;
    const testMeta = resolveMasterFootballTest(code);
    const calculated =
      item.calculated_score !== undefined && item.calculated_score !== null
        ? Math.max(1, Math.min(100, Math.round(Number(item.calculated_score))))
        : calculateAssessmentScore({
            testCode: code,
            tier,
            rawValues: item,
            testMeta
          });

    if (calculated === null || !Number.isFinite(calculated)) {
      throw new Error(`Skor tes "${testMeta?.test_name || code}" belum valid.`);
    }

    const indicatorKey = item.indicator_key || item.indicatorKey || testMeta?.indicator_key;
    if (!indicatorKey) {
      throw new Error(`Indikator tidak ditemukan untuk kode tes ${code}.`);
    }

    const raw1 = Number(item.raw_value_1);
    const raw2 =
      item.raw_value_2 !== '' && item.raw_value_2 !== null && item.raw_value_2 !== undefined
        ? Number(item.raw_value_2)
        : null;
    const errs = Math.max(0, parseInt(item.errors_count ?? 0, 10) || 0);

    return {
      test_code: testMeta?.test_code || code,
      test_name: testMeta?.test_name || code,
      indicator_key: indicatorKey,
      indicator_label:
        item.indicator_label ||
        testMeta?.indicator_label ||
        MASTER_INDICATOR_KEY_TO_LABEL[indicatorKey] ||
        indicatorKey,
      weight: Number(testMeta?.weight) > 0 ? Number(testMeta.weight) : 1.0,
      raw_value_1: Number.isFinite(raw1) ? raw1 : 0,
      raw_value_2: raw2 !== null && Number.isFinite(raw2) ? raw2 : null,
      errors_count: errs,
      calculated_score: calculated,
      testing_date: finalDate
    };
  });

  // Aggregate multi-test indicators (e.g., TEC05 + TEC06 -> 'dribbling', TEC07 + TEC08 -> 'finishing')
  const aggregatedIndicatorsMap = aggregateIndicatorScores(normalizedSessions);
  const aggregatedList = Object.values(aggregatedIndicatorsMap);

  // Demo mode persistence
  if (isDemoAssessmentContext(tenantId, athleteId)) {
    const sessionsKey = `${DEMO_SESSIONS_STORAGE_PREFIX}${tenantId}_${athleteId}`;
    const indicatorsKey = `${DEMO_INDICATOR_STORAGE_PREFIX}${tenantId}_${athleteId}`;

    const existingSessions = readLocalJson(sessionsKey, []);
    const newSessionRows = normalizedSessions.map((entry, idx) => ({
      id: `demo-sess-${Date.now()}-${idx}`,
      tenant_id: tenantId,
      athlete_id: athleteId,
      evaluator_id: evaluatorId || 'demo-coach',
      test_code: entry.test_code,
      raw_value_1: entry.raw_value_1,
      raw_value_2: entry.raw_value_2,
      errors_count: entry.errors_count,
      calculated_score: entry.calculated_score,
      testing_date: entry.testing_date,
      created_at: nowIso
    }));
    writeLocalJson(sessionsKey, [...newSessionRows, ...existingSessions].slice(0, 150));

    const existingIndicators = await getAthleteIndicatorScores(tenantId, athleteId, { tier });
    const updatedIndicators = { ...existingIndicators };
    aggregatedList.forEach((agg) => {
      updatedIndicators[agg.indicator_key] = {
        id: updatedIndicators[agg.indicator_key]?.id || `demo-ind-${agg.indicator_key}`,
        tenant_id: tenantId,
        athlete_id: athleteId,
        indicator_key: agg.indicator_key,
        indicator_label: agg.indicator_label,
        score: agg.score,
        test_codes: agg.test_codes,
        tests_count: agg.tests_count,
        source: 'battery_test',
        updated_at: nowIso
      };
    });
    writeLocalJson(indicatorsKey, updatedIndicators);

    return {
      savedSessions: newSessionRows,
      aggregatedIndicators: aggregatedIndicatorsMap,
      indicatorScoresMap: updatedIndicators
    };
  }

  // Real Supabase persistence
  const safeEvaluatorId = toUuidOrNull(evaluatorId);
  const sessionPayload = normalizedSessions.map((entry) => ({
    tenant_id: tenantId,
    athlete_id: athleteId,
    evaluator_id: safeEvaluatorId,
    test_code: entry.test_code,
    raw_value_1: entry.raw_value_1,
    raw_value_2: entry.raw_value_2,
    errors_count: entry.errors_count,
    calculated_score: entry.calculated_score,
    testing_date: entry.testing_date
  }));

  const { data: insertedSessions, error: insertError } = await supabase
    .from('athlete_test_sessions')
    .insert(sessionPayload)
    .select();

  if (insertError) {
    console.error('[scoutingCombineService] athlete_test_sessions insert error:', insertError);
    throw insertError;
  }

  const indicatorPayload = aggregatedList.map((agg) => ({
    tenant_id: tenantId,
    athlete_id: athleteId,
    indicator_key: agg.indicator_key,
    score: agg.score,
    source: 'battery_test',
    updated_at: nowIso
  }));

  const { data: upsertedIndicators, error: upsertError } = await supabase
    .from('athlete_indicator_scores')
    .upsert(indicatorPayload, {
      onConflict: 'tenant_id,athlete_id,indicator_key'
    })
    .select();

  if (upsertError) {
    console.error('[scoutingCombineService] athlete_indicator_scores upsert error:', upsertError);
    throw upsertError;
  }

  const latestMap = await getAthleteIndicatorScores(tenantId, athleteId, { tier });
  (upsertedIndicators || []).forEach((row) => {
    const aggMeta = aggregatedIndicatorsMap[row.indicator_key];
    latestMap[row.indicator_key] = {
      id: row.id,
      indicator_key: row.indicator_key,
      indicator_label:
        aggMeta?.indicator_label ||
        MASTER_INDICATOR_KEY_TO_LABEL[row.indicator_key] ||
        row.indicator_key,
      score: row.score,
      test_codes: aggMeta?.test_codes || [],
      tests_count: aggMeta?.tests_count || 1,
      source: row.source || 'battery_test',
      updated_at: row.updated_at
    };
  });

  return {
    savedSessions: insertedSessions || [],
    aggregatedIndicators: aggregatedIndicatorsMap,
    indicatorScoresMap: latestMap
  };
}

/**
 * Load saved Step-by-Step Test Wizard Resume State for an athlete.
 */
export function loadWizardResumeState(tenantId, athleteId) {
  if (!athleteId) return null;
  const key = buildWizardResumeStorageKey(tenantId || 'demo-tenant-1', athleteId);
  const state = readLocalJson(key, null);
  if (!state || typeof state !== 'object') return null;
  return state;
}

/**
 * Save Step-by-Step Test Wizard Resume State for an athlete so coaches can resume later.
 */
export function saveWizardResumeState(tenantId, athleteId, resumePayload = {}) {
  if (!athleteId) return null;
  const key = buildWizardResumeStorageKey(tenantId || 'demo-tenant-1', athleteId);
  const nextState = {
    tenantId: tenantId || 'demo-tenant-1',
    athleteId,
    currentStepIndex: Math.max(0, Number(resumePayload.currentStepIndex) || 0),
    wizardCategory: resumePayload.wizardCategory || 'ALL',
    testingDate: resumePayload.testingDate || new Date().toISOString().split('T')[0],
    tier: Math.max(1, Math.min(4, Number(resumePayload.tier) || 2)),
    inputsByCode: resumePayload.inputsByCode || {},
    completedTestCodes: Array.isArray(resumePayload.completedTestCodes)
      ? resumePayload.completedTestCodes
      : [],
    skippedTestCodes: Array.isArray(resumePayload.skippedTestCodes)
      ? resumePayload.skippedTestCodes
      : [],
    status: resumePayload.status || 'paused_resume_ready',
    updatedAt: new Date().toISOString()
  };
  writeLocalJson(key, nextState);
  return nextState;
}

/**
 * Clear saved Wizard Resume State for an athlete.
 */
export function clearWizardResumeState(tenantId, athleteId) {
  if (!athleteId) return;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = buildWizardResumeStorageKey(tenantId || 'demo-tenant-1', athleteId);
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn('[scoutingCombineService] clearWizardResumeState error:', err);
  }
}

const scoutingCombineService = {
  getMasterFootballCatalog,
  getAthleteIndicatorScores,
  getAthleteTestSessions,
  saveMasterAssessmentSessionAndSync,
  syncAthleteAttendanceToDevelopmentIndicators,
  loadWizardResumeState,
  saveWizardResumeState,
  clearWizardResumeState
};

export default scoutingCombineService;

