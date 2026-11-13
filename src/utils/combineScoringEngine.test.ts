import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBINE_TEST_CATALOG,
  COMBINE_BENCHMARKS,
  RUBRIC_LEVEL_SCORE_MAP,
  calculateTestScore,
  calculateRubricScore,
  getScoreClassification,
  getActiveTestsForTier
} from './combineScoringEngine.js';

const FINISHING_TEST_ID = '11111111-1111-4111-8111-000000000001';
const DRIBBLING_TEST_ID = '11111111-1111-4111-8111-000000000003';
const WALL_TOUCH_TEST_ID = '11111111-1111-4111-8111-000000000004';
const SPRINT_10M_TEST_ID = '11111111-1111-4111-8111-000000000101';
const RUBRIC_VERBAL_ID = '11111111-1111-4111-8111-000000000401';

test('calculateTestScore returns null when raw_value_1 is blank and never returns PENDING_CALIBRATION', () => {
  const resEmpty = calculateTestScore(FINISHING_TEST_ID, 2, { raw_value_1: '', raw_value_2: 10 });
  assert.equal(resEmpty, null);

  const resNull = calculateTestScore(SPRINT_10M_TEST_ID, 2, { raw_value_1: null });
  assert.equal(resNull, null);
});

test('ACCURACY test converts successful/total instantaneously via piecewise linear interpolation', () => {
  // Tier 2 Finishing benchmark: poor=25->25, fair=50->55, good=72->80, elite=90->96
  const scoreFair = calculateTestScore(FINISHING_TEST_ID, 2, { raw_value_1: 5, raw_value_2: 10 });
  assert.equal(scoreFair, 55);

  const scoreElite = calculateTestScore(FINISHING_TEST_ID, 2, { raw_value_1: 9, raw_value_2: 10 });
  assert.equal(scoreElite, 96);

  const scorePerfect = calculateTestScore(FINISHING_TEST_ID, 2, { raw_value_1: 10, raw_value_2: 10 });
  assert.equal(scorePerfect, 100);

  // Supports successful + errors_count inference when raw_value_2 is omitted
  const scoreFromErrors = calculateTestScore(FINISHING_TEST_ID, 2, { raw_value_1: 5, errors_count: 5 });
  assert.equal(scoreFromErrors, 55);

  // Tier 4 is stricter than Tier 1 for same 70% accuracy
  const tier1Score = calculateTestScore(FINISHING_TEST_ID, 1, { raw_value_1: 7, raw_value_2: 10 });
  const tier4Score = calculateTestScore(FINISHING_TEST_ID, 4, { raw_value_1: 7, raw_value_2: 10 });
  assert.ok(tier1Score !== null && tier4Score !== null, 'Expected numeric scores for Tier 1 and Tier 4');
  assert.ok(tier1Score > tier4Score, `Expected Tier 1 (${tier1Score}) > Tier 4 (${tier4Score}) for identical raw accuracy`);
});

test('TIME test scores faster times higher, selects best of 2 trials, and applies error penalty', () => {
  // Tier 2 10m Sprint: poor=2.55->25, fair=2.26->55, good=2.02->80, elite=1.84->96
  assert.equal(calculateTestScore(SPRINT_10M_TEST_ID, 2, { raw_value_1: 2.02 }), 80);
  assert.equal(calculateTestScore(SPRINT_10M_TEST_ID, 2, { raw_value_1: 1.84 }), 96);

  // Trial 2 faster than Trial 1 -> picks best (2.02)
  const bestOfTwo = calculateTestScore(SPRINT_10M_TEST_ID, 2, { raw_value_1: 2.40, raw_value_2: 2.02 });
  assert.equal(bestOfTwo, 80);

  // Slalom dribbling has +0.25s penalty per cone error
  const cleanDribble = calculateTestScore(DRIBBLING_TEST_ID, 2, { raw_value_1: 10.1, errors_count: 0 });
  const penalizedDribble = calculateTestScore(DRIBBLING_TEST_ID, 2, { raw_value_1: 10.1, errors_count: 4 });
  assert.equal(cleanDribble, 80);
  assert.ok(penalizedDribble !== null && cleanDribble !== null, 'Expected numeric scores for dribble test');
  assert.ok(penalizedDribble < cleanDribble, 'Penalized dribble score should be lower than clean dribble score');
});

test('REPS test scales repetisi monotonically and clamps to [1, 100]', () => {
  // Tier 2 Wall First-Touch: poor=10->25, fair=15->55, good=21->80, elite=27->96
  assert.equal(calculateTestScore(WALL_TOUCH_TEST_ID, 2, { raw_value_1: 15 }), 55);
  assert.equal(calculateTestScore(WALL_TOUCH_TEST_ID, 2, { raw_value_1: 21 }), 80);
  assert.equal(calculateTestScore(WALL_TOUCH_TEST_ID, 2, { raw_value_1: 27 }), 96);

  const extremeHigh = calculateTestScore(WALL_TOUCH_TEST_ID, 2, { raw_value_1: 120 });
  const extremeLow = calculateTestScore(WALL_TOUCH_TEST_ID, 2, { raw_value_1: 0 });
  assert.equal(extremeHigh, 100);
  assert.equal(extremeLow, 1);
});

test('RUBRIC mapping matches anchored levels 1=35, 3=70, 5=95 and works via calculateTestScore', () => {
  assert.equal(RUBRIC_LEVEL_SCORE_MAP[1], 35);
  assert.equal(RUBRIC_LEVEL_SCORE_MAP[3], 70);
  assert.equal(RUBRIC_LEVEL_SCORE_MAP[5], 95);

  assert.equal(calculateRubricScore(1), 35);
  assert.equal(calculateRubricScore(2), 52);
  assert.equal(calculateRubricScore(3), 70);
  assert.equal(calculateRubricScore(4), 84);
  assert.equal(calculateRubricScore(5), 95);

  assert.equal(calculateTestScore(RUBRIC_VERBAL_ID, 1, { raw_value_1: 5 }), 95);
  assert.equal(calculateTestScore('komunikasi_verbal', 2, { raw_value_1: 3 }), 70);
});

test('getActiveTestsForTier respects min_tier progression and category filters', () => {
  const tier1TeknikFisik = getActiveTestsForTier(1, ['Teknik', 'Fisik']);
  const tier3TeknikFisik = getActiveTestsForTier(3, ['Teknik', 'Fisik']);

  assert.ok(tier1TeknikFisik.every((t) => (t.min_tier || 1) <= 1));
  assert.ok(tier3TeknikFisik.length > tier1TeknikFisik.length);
  assert.equal(tier1TeknikFisik.some((t) => t.indicator_key === 'crossing'), false);
  assert.equal(tier3TeknikFisik.some((t) => t.indicator_key === 'crossing'), true);

  // Every non-rubric catalog test has benchmarks defined for all 4 tiers
  const benchmarkMap = COMBINE_BENCHMARKS as Record<string, Record<number, unknown>>;
  for (const item of COMBINE_TEST_CATALOG) {
    if (item.measurement_type !== 'RUBRIC') {
      assert.ok(benchmarkMap[item.id], `Missing benchmarks for ${item.test_name}`);
      for (const tier of [1, 2, 3, 4]) {
        assert.ok(benchmarkMap[item.id][tier], `Missing tier ${tier} benchmark for ${item.test_name}`);
      }
    }
  }
});

test('getScoreClassification classifies 1-100 bands consistently', () => {
  assert.equal(getScoreClassification(94).label, 'Elit');
  assert.equal(getScoreClassification(84).label, 'Baik');
  assert.equal(getScoreClassification(68).label, 'Cukup');
  assert.equal(getScoreClassification(40).label, 'Perlu Pembinaan');
  assert.equal(getScoreClassification(null).label, 'Belum Diukur');
});
