import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOOTBALL_CORE_CATEGORIES,
  FOOTBALL_POSITIONS,
  TIER_1_POSITIONS,
  detectTierFromAge,
  resolveIndicatorScore,
  calculateCategoryAverage,
  calculateOverallScore
} from './footballAssessmentData.js';

import {
  FUTSAL_CORE_CATEGORIES,
  FUTSAL_POSITIONS,
  FUTSAL_TIER_1_POSITIONS,
  detectFutsalTierFromAge
} from './futsalAssessmentData.js';

import {
  BADMINTON_CORE_CATEGORIES,
  BADMINTON_EVENT_INDICATORS,
  detectBadmintonTierFromAge,
  detectPbsiLevelFromAge
} from './badmintonAssessmentData.js';

import { calculateAge } from '../utils/helpers.js';

const VALID_TYPES = new Set([
  'OBJECTIVE_TEST',
  'OBSERVATION_RUBRIC',
  'DEVELOPMENT_TRACKING',
  'ADMINISTRATIVE_DATA',
  'READINESS_CONTEXT'
]);

test('A. Resolver & Missing Score — Canonical Priority, Legacy Fallback, Valid 0, and Null Untested', () => {
  const sampleIndicator = {
    id: 'FTB-UNI-PHY-01',
    name: 'Akselerasi',
    type: 'OBJECTIVE_TEST',
    legacy_keys: ['Akselerasi', 'Acceleration (5-10m)']
  };

  // 1. Missing score must return null (UNTESTED), never 0
  assert.equal(resolveIndicatorScore({}, sampleIndicator), null);
  assert.equal(resolveIndicatorScore(null, sampleIndicator), null);
  assert.equal(resolveIndicatorScore({ 'FTB-UNI-PHY-01': null }, sampleIndicator), null);
  assert.equal(resolveIndicatorScore({ 'FTB-UNI-PHY-01': undefined }, sampleIndicator), null);
  assert.equal(resolveIndicatorScore({ 'FTB-UNI-PHY-01': '' }, sampleIndicator), null);

  // 2. Explicit score 0 must remain valid numeric 0
  assert.equal(resolveIndicatorScore({ 'FTB-UNI-PHY-01': 0 }, sampleIndicator), 0);
  assert.equal(resolveIndicatorScore({ 'FTB-UNI-PHY-01': '0' }, sampleIndicator), 0);
  assert.equal(resolveIndicatorScore({ Akselerasi: 0 }, sampleIndicator), 0);

  // 3. Historical legacy keys remain readable without mutating the input object
  const legacyScores = Object.freeze({ 'Acceleration (5-10m)': 78 });
  assert.equal(resolveIndicatorScore(legacyScores, sampleIndicator), 78);

  const nameScores = Object.freeze({ Akselerasi: 84 });
  assert.equal(resolveIndicatorScore(nameScores, sampleIndicator), 84);

  // 4. Canonical ID takes strict priority over current name and legacy keys (including when canonical is 0)
  assert.equal(
    resolveIndicatorScore(
      { 'FTB-UNI-PHY-01': 92, Akselerasi: 70, 'Acceleration (5-10m)': 65 },
      sampleIndicator
    ),
    92
  );
  assert.equal(
    resolveIndicatorScore(
      { 'FTB-UNI-PHY-01': 0, Akselerasi: 85 },
      sampleIndicator
    ),
    0
  );

  // 5. Category average and overall score do NOT treat untested (null) indicators as 0
  const indicators = FOOTBALL_CORE_CATEGORIES.fisik.indicators; // 18 indicators
  const partialScores = {
    'FTB-UNI-PHY-01': 80,
    'FTB-UNI-PHY-02': 90
  };
  // Only 2 of 18 indicators are rated -> average must be (80 + 90) / 2 = 85, NOT (80 + 90) / 18 = 9
  assert.equal(calculateCategoryAverage(partialScores, indicators), 85);

  // When an explicit 0 is present among rated indicators, it IS included in the average
  const scoresWithExplicitZero = {
    'FTB-UNI-PHY-01': 90,
    'FTB-UNI-PHY-02': 60,
    'FTB-UNI-PHY-03': 0
  };
  // 3 rated indicators: (90 + 60 + 0) / 3 = 50
  assert.equal(calculateCategoryAverage(scoresWithExplicitZero, indicators), 50);

  // Completely untested category returns null
  assert.equal(calculateCategoryAverage({}, indicators), null);

  // Overall score ignores null (untested) categories and includes explicit 0 categories
  assert.equal(calculateOverallScore([80, 90, null, null, null, null, null]), 85);
  assert.equal(calculateOverallScore([80, 0, null]), 40);
  assert.equal(calculateOverallScore([null, null, null]), null);
});

test('B. Registry Reconciliation — Exact Counts, Uniqueness, and Metadata Completeness', () => {
  const globalIds = new Set();

  const validateIndicatorList = (list, contextLabel) => {
    for (const ind of list) {
      assert.equal(typeof ind, 'object', `Indicator in ${contextLabel} must be an object`);
      assert.ok(ind.id && typeof ind.id === 'string' && ind.id.trim().length > 0, `Empty ID in ${contextLabel}`);
      assert.ok(ind.name && typeof ind.name === 'string' && ind.name.trim().length > 0, `Empty name for ${ind.id}`);
      assert.ok(VALID_TYPES.has(ind.type), `Invalid type "${ind.type}" for ${ind.id}`);
      assert.ok(Array.isArray(ind.legacy_keys) && ind.legacy_keys.length > 0, `Missing legacy_keys for ${ind.id}`);
      assert.ok(!globalIds.has(ind.id), `Duplicate canonical ID detected: ${ind.id}`);
      globalIds.add(ind.id);
    }
  };

  // 1. Football: 84 Universal + 125 Position-Specific + 10 SSB = 219
  const ftbUniList = Object.values(FOOTBALL_CORE_CATEGORIES).flatMap((c) => c.indicators);
  const ftbPosList = FOOTBALL_POSITIONS.flatMap((p) => p.indicators);
  const ftbSsbList = TIER_1_POSITIONS.flatMap((p) => p.indicators);

  assert.equal(ftbUniList.length, 84, 'Football Universal must be exactly 84');
  assert.equal(ftbPosList.length, 125, 'Football Position-Specific must be exactly 125');
  assert.equal(ftbSsbList.length, 10, 'Football SSB must be exactly 10');

  validateIndicatorList(ftbUniList, 'Football Universal');
  validateIndicatorList(ftbPosList, 'Football Position-Specific');
  validateIndicatorList(ftbSsbList, 'Football SSB');

  // 2. Futsal: 77 Universal + 58 Position-Specific + 10 SSB = 145
  const ftsUniList = Object.values(FUTSAL_CORE_CATEGORIES).flatMap((c) => c.indicators);
  const ftsPosList = FUTSAL_POSITIONS.flatMap((p) => p.indicators);
  const ftsSsbList = FUTSAL_TIER_1_POSITIONS.flatMap((p) => p.indicators);

  assert.equal(ftsUniList.length, 77, 'Futsal Universal must be exactly 77');
  assert.equal(ftsPosList.length, 58, 'Futsal Position-Specific must be exactly 58');
  assert.equal(ftsSsbList.length, 10, 'Futsal SSB must be exactly 10');

  validateIndicatorList(ftsUniList, 'Futsal Universal');
  validateIndicatorList(ftsPosList, 'Futsal Position-Specific');
  validateIndicatorList(ftsSsbList, 'Futsal SSB');

  // 3. Badminton: 73 Universal + 48 Event-Specific = 121
  const bdmUniList = Object.values(BADMINTON_CORE_CATEGORIES).flatMap((c) => c.indicators);
  const bdmEvtList = Object.values(BADMINTON_EVENT_INDICATORS).flatMap((e) => e.indicators);

  assert.equal(bdmUniList.length, 73, 'Badminton Universal must be exactly 73');
  assert.equal(bdmEvtList.length, 48, 'Badminton Event-Specific must be exactly 48');

  validateIndicatorList(bdmUniList, 'Badminton Universal');
  validateIndicatorList(bdmEvtList, 'Badminton Event-Specific');

  // Total unique canonical IDs across all 3 registries = 219 + 145 + 121 = 485
  assert.equal(globalIds.size, 485);
});

test('D. Age & Tier Regression Testing — ISO, Empty, Invalid, DD/MM/YYYY, and Future Dates', () => {
  // 1. Valid ISO birthDate (YYYY-MM-DD)
  assert.equal(detectTierFromAge('2018-06-15'), 1);
  assert.equal(detectTierFromAge('2015-06-15'), 2);
  assert.equal(detectTierFromAge('2012-06-15'), 3);
  assert.equal(detectTierFromAge('2005-06-15'), 4);

  assert.equal(detectFutsalTierFromAge('2016-06-15'), 1);
  assert.equal(detectFutsalTierFromAge('2012-06-15'), 2);
  assert.equal(detectFutsalTierFromAge('2009-06-15'), 3);
  assert.equal(detectFutsalTierFromAge('2003-06-15'), 4);

  assert.equal(detectBadmintonTierFromAge('2017-06-15'), 1);
  assert.equal(detectBadmintonTierFromAge('2014-06-15'), 2);
  assert.equal(detectBadmintonTierFromAge('2010-06-15'), 3);
  assert.equal(detectBadmintonTierFromAge('2004-06-15'), 4);

  assert.equal(typeof calculateAge('2014-05-15'), 'number');

  // 2. Empty birthDate ('', null, undefined, '   ', '-') -> AGE_UNVERIFIED (never fallback to 10)
  for (const emptyInput of ['', null, undefined, '   ', '-']) {
    assert.equal(detectTierFromAge(emptyInput), 'AGE_UNVERIFIED');
    assert.equal(detectFutsalTierFromAge(emptyInput), 'AGE_UNVERIFIED');
    assert.equal(detectBadmintonTierFromAge(emptyInput), 'AGE_UNVERIFIED');
    assert.equal(detectPbsiLevelFromAge(emptyInput).status, 'AGE_UNVERIFIED');
    assert.equal(calculateAge(emptyInput), '-');
  }

  // 3. Invalid birthDate ('invalid-date', 'abc-12', '2026-13-45', '31/02/2015', 0, -5, 99999)
  for (const invalidInput of ['invalid-date', 'abc-12', '2026-13-45', '31/02/2015', 0, -5, 99999]) {
    assert.equal(detectTierFromAge(invalidInput), 'AGE_UNVERIFIED', `Failed for ${invalidInput}`);
    assert.equal(detectFutsalTierFromAge(invalidInput), 'AGE_UNVERIFIED', `Failed for ${invalidInput}`);
    assert.equal(detectBadmintonTierFromAge(invalidInput), 'AGE_UNVERIFIED', `Failed for ${invalidInput}`);
    assert.equal(detectPbsiLevelFromAge(invalidInput).status, 'AGE_UNVERIFIED', `Failed for ${invalidInput}`);
    assert.equal(calculateAge(invalidInput), '-');
  }

  // 4. System date formats (DD/MM/YYYY and DD-MM-YYYY)
  assert.equal(detectTierFromAge('15/05/2015'), 2);
  assert.equal(detectFutsalTierFromAge('15/05/2015'), 1);
  assert.equal(detectBadmintonTierFromAge('15/05/2015'), 2);
  assert.equal(typeof calculateAge('15/05/2015'), 'number');

  // 5. Future birthDate ('2030-01-01', '01/01/2030') -> AGE_UNVERIFIED
  for (const futureInput of ['2030-01-01', '01/01/2030', '2099-12-31']) {
    assert.equal(detectTierFromAge(futureInput), 'AGE_UNVERIFIED');
    assert.equal(detectFutsalTierFromAge(futureInput), 'AGE_UNVERIFIED');
    assert.equal(detectBadmintonTierFromAge(futureInput), 'AGE_UNVERIFIED');
    assert.equal(detectPbsiLevelFromAge(futureInput).status, 'AGE_UNVERIFIED');
    assert.equal(calculateAge(futureInput), '-');
  }
});
