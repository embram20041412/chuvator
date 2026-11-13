import { supabase } from '../config/supabase';
import { toUuidOrNull, toDateOrNull } from './supabaseAcademyService';
import {
  COMBINE_TEST_CATALOG,
  INDICATOR_KEY_TO_LABEL,
  calculateTestScore,
  resolveCombineTest
} from '../utils/combineScoringEngine';

const DEMO_INDICATOR_STORAGE_PREFIX = 'chuvator_demo_combine_indicators_';
const DEMO_RESULTS_STORAGE_PREFIX = 'chuvator_demo_combine_results_';

function isDemoCombineContext(tenantId, athleteId) {
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

function enrichCatalogRow(row) {
  const localMeta = resolveCombineTest(row.id) || resolveCombineTest(row.indicator_key) || {};
  return {
    ...localMeta,
    ...row,
    indicator_key: row.indicator_key || localMeta.indicator_key || '',
    indicator_label:
      row.indicator_label ||
      localMeta.indicator_label ||
      INDICATOR_KEY_TO_LABEL[row.indicator_key] ||
      row.test_name
  };
}

/**
 * Fetch active assessment tests from Supabase `assessment_tests_catalog`,
 * enriched with UI benchmark metadata from `COMBINE_TEST_CATALOG`.
 */
export async function getTestsCatalog({ tenantId = null, sportType = 'football', category = null, tier = 4 } = {}) {
  const normalizedTier = Math.max(1, Math.min(4, Number(tier) || 4));
  const fallbackList = COMBINE_TEST_CATALOG.filter((t) => {
    const sportOk = !sportType || t.sport_type === sportType;
    const tierOk = (t.min_tier || 1) <= normalizedTier;
    const catOk = !category || (Array.isArray(category) ? category.includes(t.category) : t.category === category);
    return sportOk && tierOk && catOk;
  });

  if (tenantId === 'demo-tenant-1' || (tenantId && !toUuidOrNull(tenantId))) {
    return fallbackList;
  }

  try {
    let query = supabase
      .from('assessment_tests_catalog')
      .select('*')
      .eq('sport_type', sportType)
      .lte('min_tier', normalizedTier)
      .order('min_tier', { ascending: true });

    if (category) {
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

    return data.map(enrichCatalogRow);
  } catch {
    return fallbackList;
  }
}

/**
 * Fetch latest indicator scores from `athlete_indicator_scores`.
 * Returns map keyed by `indicator_key`: { [key]: { indicator_key, indicator_label, score, source, updated_at } }
 */
export async function getAthleteIndicatorScores(tenantId, athleteId) {
  if (!tenantId || !athleteId) return {};

  if (isDemoCombineContext(tenantId, athleteId)) {
    const key = `${DEMO_INDICATOR_STORAGE_PREFIX}${tenantId}_${athleteId}`;
    return readLocalJson(key, {});
  }

  const { data, error } = await supabase
    .from('athlete_indicator_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('athlete_id', athleteId);

  if (error) {
    console.warn('[scoutingCombineService] getAthleteIndicatorScores error:', error);
    return {};
  }

  const map = {};
  (data || []).forEach((row) => {
    map[row.indicator_key] = {
      id: row.id,
      indicator_key: row.indicator_key,
      indicator_label: INDICATOR_KEY_TO_LABEL[row.indicator_key] || row.indicator_key,
      score: Math.max(1, Math.min(100, Number(row.score) || 1)),
      source: row.source || 'coach_manual',
      updated_at: row.updated_at
    };
  });
  return map;
}

/**
 * Fetch recent raw combine & rubric test history from `athlete_test_results`.
 */
export async function getAthleteTestResults(tenantId, athleteId, limitCount = 50) {
  if (!tenantId || !athleteId) return [];

  if (isDemoCombineContext(tenantId, athleteId)) {
    const key = `${DEMO_RESULTS_STORAGE_PREFIX}${tenantId}_${athleteId}`;
    const list = readLocalJson(key, []);
    return Array.isArray(list) ? list.slice(0, limitCount) : [];
  }

  const { data, error } = await supabase
    .from('athlete_test_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('athlete_id', athleteId)
    .order('testing_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.warn('[scoutingCombineService] getAthleteTestResults error:', error);
    return [];
  }

  return data || [];
}

/**
 * Persist field test results to `athlete_test_results` and atomically upsert
 * `athlete_indicator_scores` (source = 'battery_test') so the Polar Area report updates immediately.
 */
export async function saveCombineResultsAndSync({
  tenantId,
  athleteId,
  evaluatorId = null,
  testingDate = null,
  tier = 1,
  results = []
}) {
  if (!tenantId || !athleteId) {
    throw new Error('Tenant ID dan Atlet wajib dipilih sebelum menyimpan tes.');
  }
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Minimal satu hasil tes harus diisi sebelum sinkronisasi.');
  }

  const finalDate = toDateOrNull(testingDate) || new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const normalizedEntries = results.map((item) => {
    const testMeta = resolveCombineTest(item.testId || item.test_id || item.indicatorKey);
    const calculated =
      item.calculated_score !== undefined && item.calculated_score !== null
        ? Math.max(1, Math.min(100, Math.round(Number(item.calculated_score))))
        : calculateTestScore(item.testId || item.test_id, tier, item, testMeta);

    if (calculated === null || !Number.isFinite(calculated)) {
      throw new Error(`Skor tes "${testMeta?.test_name || item.testId}" tidak valid.`);
    }

    const indicatorKey = item.indicatorKey || item.indicator_key || testMeta?.indicator_key;
    if (!indicatorKey) {
      throw new Error(`Indicator key tidak ditemukan untuk tes ${item.testId}.`);
    }

    const raw1 = Number(item.raw_value_1);
    const raw2 =
      item.raw_value_2 !== '' && item.raw_value_2 !== null && item.raw_value_2 !== undefined
        ? Number(item.raw_value_2)
        : null;
    const errs = Math.max(0, parseInt(item.errors_count ?? 0, 10) || 0);

    return {
      test_id: testMeta?.id || item.testId || item.test_id,
      indicator_key: indicatorKey,
      indicator_label: item.indicatorLabel || testMeta?.indicator_label || INDICATOR_KEY_TO_LABEL[indicatorKey] || indicatorKey,
      raw_value_1: Number.isFinite(raw1) ? raw1 : 0,
      raw_value_2: raw2 !== null && Number.isFinite(raw2) ? raw2 : null,
      errors_count: errs,
      calculated_score: calculated,
      testing_date: finalDate
    };
  });

  // Demo mode persistence (deterministic localStorage using exact DB schema)
  if (isDemoCombineContext(tenantId, athleteId)) {
    const resultsKey = `${DEMO_RESULTS_STORAGE_PREFIX}${tenantId}_${athleteId}`;
    const indicatorsKey = `${DEMO_INDICATOR_STORAGE_PREFIX}${tenantId}_${athleteId}`;

    const existingResults = readLocalJson(resultsKey, []);
    const newResultRows = normalizedEntries.map((entry, idx) => ({
      id: `demo-res-${Date.now()}-${idx}`,
      tenant_id: tenantId,
      athlete_id: athleteId,
      test_id: entry.test_id,
      evaluator_id: evaluatorId || 'demo-coach',
      raw_value_1: entry.raw_value_1,
      raw_value_2: entry.raw_value_2,
      errors_count: entry.errors_count,
      calculated_score: entry.calculated_score,
      testing_date: entry.testing_date,
      created_at: nowIso
    }));
    writeLocalJson(resultsKey, [...newResultRows, ...existingResults].slice(0, 120));

    const existingIndicators = readLocalJson(indicatorsKey, {});
    const updatedIndicators = { ...existingIndicators };
    normalizedEntries.forEach((entry) => {
      updatedIndicators[entry.indicator_key] = {
        id: updatedIndicators[entry.indicator_key]?.id || `demo-ind-${entry.indicator_key}`,
        tenant_id: tenantId,
        athlete_id: athleteId,
        indicator_key: entry.indicator_key,
        indicator_label: entry.indicator_label,
        score: entry.calculated_score,
        source: 'battery_test',
        updated_at: nowIso
      };
    });
    writeLocalJson(indicatorsKey, updatedIndicators);

    return {
      savedResults: newResultRows,
      indicatorScoresMap: updatedIndicators
    };
  }

  // Real Supabase persistence
  const safeEvaluatorId = toUuidOrNull(evaluatorId);
  const testResultsPayload = normalizedEntries.map((entry) => ({
    tenant_id: tenantId,
    athlete_id: athleteId,
    test_id: entry.test_id,
    evaluator_id: safeEvaluatorId,
    raw_value_1: entry.raw_value_1,
    raw_value_2: entry.raw_value_2,
    errors_count: entry.errors_count,
    calculated_score: entry.calculated_score,
    testing_date: entry.testing_date
  }));

  const { data: insertedResults, error: insertError } = await supabase
    .from('athlete_test_results')
    .insert(testResultsPayload)
    .select();

  if (insertError) {
    console.error('[scoutingCombineService] athlete_test_results insert error:', insertError);
    throw insertError;
  }

  const indicatorPayload = normalizedEntries.map((entry) => ({
    tenant_id: tenantId,
    athlete_id: athleteId,
    indicator_key: entry.indicator_key,
    score: entry.calculated_score,
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

  const latestMap = await getAthleteIndicatorScores(tenantId, athleteId);
  (upsertedIndicators || []).forEach((row) => {
    latestMap[row.indicator_key] = {
      id: row.id,
      indicator_key: row.indicator_key,
      indicator_label: INDICATOR_KEY_TO_LABEL[row.indicator_key] || row.indicator_key,
      score: row.score,
      source: row.source || 'battery_test',
      updated_at: row.updated_at
    };
  });

  return {
    savedResults: insertedResults || [],
    indicatorScoresMap: latestMap
  };
}

const scoutingCombineService = {
  getTestsCatalog,
  getAthleteIndicatorScores,
  getAthleteTestResults,
  saveCombineResultsAndSync
};

export default scoutingCombineService;
