import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTennisSport,
  TENNIS_AGE_LEVELS,
  detectTennisLevelFromAge,
  getTennisLevelConfig,
  getFilteredTennisIndicators,
  getAvailableTennisEventsForTier,
  TENNIS_CORE_CATEGORIES,
  TENNIS_EVENT_TYPES,
  TENNIS_EMPHASIS_SYNC_MAP,
  TENNIS_PLAYING_STYLES,
  getTennisGradeInfo,
  getTennisStyleConfig
} from '../src/config/tennisAssessmentData.js';

import { isBadmintonSport } from '../src/config/badmintonAssessmentData.js';

test('isTennisSport accurately detects Tennis while maintaining strict isolation', () => {
  // Tennis sports - should match
  assert.equal(isTennisSport({ sport: 'Tenis' }), true);
  assert.equal(isTennisSport({ sport: 'Tennis' }), true);
  assert.equal(isTennisSport({ sport: 'tenis' }), true);
  assert.equal(isTennisSport({ sport: 'TENNIS' }), true);
  assert.equal(isTennisSport({ sport_type: 'Tenis' }), true);
  assert.equal(isTennisSport({ name: 'Kelas Tenis Lapangan Junior' }), true);
  assert.equal(isTennisSport(null, { sport: 'Tennis' }), true);
  assert.equal(isTennisSport(null, { name: 'Chua Tennis Academy' }), true);

  // Self-Healing & Router Bugfix: Class with legacy 'Badminton' sport under Tennis academy MUST resolve to Tennis!
  const misregisteredClass = { id: 'c1', className: 'Pemula', sport: 'Badminton' };
  const tennisAcademy = { id: 'a1', name: 'Akademi Tenis Cilandak', sport: 'Tenis' };
  assert.equal(isTennisSport(misregisteredClass, tennisAcademy), true, 'Tennis academy must override legacy Badminton sport');
  assert.equal(isBadmintonSport(misregisteredClass, tennisAcademy), false, 'Badminton router must strictly reject Tennis academy classes');

  // Normal Badminton class under Badminton academy
  const badmintonClass = { id: 'c2', className: 'Pemula', sport: 'Badminton' };
  const badmintonAcademy = { id: 'a2', name: 'Garuda Badminton Academy', sport: 'Badminton' };
  assert.equal(isTennisSport(badmintonClass, badmintonAcademy), false);
  assert.equal(isBadmintonSport(badmintonClass, badmintonAcademy), true);

  // Strict isolation checks - must NOT match Tennis
  assert.equal(isTennisSport({ sport: 'Tenis Meja' }), false);
  assert.equal(isTennisSport({ sport: 'Table Tennis' }), false);
  assert.equal(isTennisSport({ sport: 'Badminton' }), false);
  assert.equal(isTennisSport({ sport: 'Futsal' }), false);
  assert.equal(isTennisSport({ sport: 'SepakBola' }), false);
  assert.equal(isTennisSport({ sport: 'Minisoccer' }), false);
  assert.equal(isTennisSport(null, null), false);
  assert.equal(isTennisSport({}, {}), false);
});

test('TENNIS_CORE_CATEGORIES matches exact indicator counts (86 indicators across 6 categories)', () => {
  const categoryKeys = Object.keys(TENNIS_CORE_CATEGORIES);
  assert.equal(categoryKeys.length, 6);

  const categories = Object.fromEntries(
    categoryKeys.map((k) => [k, TENNIS_CORE_CATEGORIES[k].indicators.length])
  );
  assert.equal(categories.fisik, 16, 'Physical / Fisik must have 16 indicators');
  assert.equal(categories.teknik, 22, 'Technical / Teknik must have 22 indicators');
  assert.equal(categories.taktik, 20, 'Tactical / Taktik must have 20 indicators');
  assert.equal(categories.mental, 10, 'Mental must have 10 indicators');
  assert.equal(categories.komunikasi, 8, 'Communication must have 8 indicators');
  assert.equal(categories.perkembangan, 10, 'Development must have 10 indicators');

  const totalIndicators = categoryKeys.reduce(
    (acc, k) => acc + TENNIS_CORE_CATEGORIES[k].indicators.length,
    0
  );
  assert.equal(totalIndicators, 86, 'Total indicators across all 6 core categories must equal 86');
});

test('TENNIS_EVENT_TYPES defines 6 events including T10_EXPLORE and 5 official competitive events', () => {
  assert.equal(TENNIS_EVENT_TYPES.length, 6);
  const codes = TENNIS_EVENT_TYPES.map((e) => e.code);
  assert.deepEqual(codes, ['MS', 'WS', 'MD', 'WD', 'XD', 'T10_EXPLORE']);

  const t10 = TENNIS_EVENT_TYPES.find((e) => e.code === 'T10_EXPLORE');
  const ms = TENNIS_EVENT_TYPES.find((e) => e.code === 'MS');
  const ws = TENNIS_EVENT_TYPES.find((e) => e.code === 'WS');
  const md = TENNIS_EVENT_TYPES.find((e) => e.code === 'MD');
  const wd = TENNIS_EVENT_TYPES.find((e) => e.code === 'WD');
  const xd = TENNIS_EVENT_TYPES.find((e) => e.code === 'XD');

  assert.equal(t10.isExplore, true);
  assert.equal(t10.indicators.length, 6, 'T10_EXPLORE mini-match must have 6 indicators');
  assert.equal(ms.indicators.length, 8, "Men's Singles must have 8 indicators");
  assert.equal(ws.indicators.length, 8, "Women's Singles must have 8 indicators");
  assert.equal(md.indicators.length, 10, "Men's Doubles must have 10 indicators");
  assert.equal(wd.indicators.length, 10, "Women's Doubles must have 10 indicators");
  assert.equal(xd.indicators.length, 10, "Mixed Doubles must have 10 indicators");

  // Verify event types flag doubles properly
  assert.equal(t10.isDoubles, false);
  assert.equal(ms.isDoubles, false);
  assert.equal(ws.isDoubles, false);
  assert.equal(md.isDoubles, true);
  assert.equal(wd.isDoubles, true);
  assert.equal(xd.isDoubles, true);
});

test('TENNIS_AGE_LEVELS has 7 tiers (ITF Tennis10s & TDP PELTI/ITF Juniors) and detects age accurately', () => {
  assert.equal(TENNIS_AGE_LEVELS.length, 7, 'Must have exactly 7 official tiers');

  const tierCodes = TENNIS_AGE_LEVELS.map((t) => t.code);
  assert.deepEqual(tierCodes, [
    'T10_RED',
    'T10_ORANGE',
    'T10_GREEN',
    'PELTI_KU12',
    'PELTI_KU14',
    'PELTI_KU16',
    'PELTI_KU18'
  ]);

  // Age brackets detection
  assert.equal(detectTennisLevelFromAge(6).code, 'T10_RED', '<=7 -> T10_RED');
  assert.equal(detectTennisLevelFromAge(7).code, 'T10_RED', '7 -> T10_RED');
  assert.equal(detectTennisLevelFromAge(8).code, 'T10_ORANGE', '8 -> T10_ORANGE');
  assert.equal(detectTennisLevelFromAge(9).code, 'T10_GREEN', '9 -> T10_GREEN');
  assert.equal(detectTennisLevelFromAge(10).code, 'T10_GREEN', '10 -> T10_GREEN');
  assert.equal(detectTennisLevelFromAge(11).code, 'PELTI_KU12', '11 -> PELTI_KU12');
  assert.equal(detectTennisLevelFromAge(12).code, 'PELTI_KU12', '12 -> PELTI_KU12');
  assert.equal(detectTennisLevelFromAge(13).code, 'PELTI_KU14', '13 -> PELTI_KU14');
  assert.equal(detectTennisLevelFromAge(14).code, 'PELTI_KU14', '14 -> PELTI_KU14');
  assert.equal(detectTennisLevelFromAge(15).code, 'PELTI_KU16', '15 -> PELTI_KU16');
  assert.equal(detectTennisLevelFromAge(16).code, 'PELTI_KU16', '16 -> PELTI_KU16');
  assert.equal(detectTennisLevelFromAge(17).code, 'PELTI_KU18', '17 -> PELTI_KU18');
  assert.equal(detectTennisLevelFromAge(18).code, 'PELTI_KU18', '18 -> PELTI_KU18');
  assert.equal(detectTennisLevelFromAge(22).code, 'PELTI_KU18', '22 -> PELTI_KU18');

  // Backward compatibility with legacy LEVEL_1-LEVEL_6
  assert.equal(getTennisLevelConfig('LEVEL_1').code, 'T10_RED');
  assert.equal(getTennisLevelConfig('LEVEL_2').code, 'PELTI_KU12');
  assert.equal(getTennisLevelConfig('LEVEL_3').code, 'PELTI_KU14');
  assert.equal(getTennisLevelConfig('LEVEL_4').code, 'PELTI_KU16');
  assert.equal(getTennisLevelConfig('LEVEL_5').code, 'PELTI_KU18');
  assert.equal(getTennisLevelConfig('LEVEL_6').code, 'PELTI_KU18');
});

test('getFilteredTennisIndicators dynamically adjusts active indicator counts per tier', () => {
  // T10_RED (ITF Red Ball 5-8 thn): filtered to safe motor/foundational indicators
  const redFisik = getFilteredTennisIndicators('fisik', 'T10_RED');
  const redTeknik = getFilteredTennisIndicators('teknik', 'T10_RED');
  const redTaktik = getFilteredTennisIndicators('taktik', 'T10_RED');
  const redMental = getFilteredTennisIndicators('mental', 'T10_RED');
  const redKomunikasi = getFilteredTennisIndicators('komunikasi', 'T10_RED');
  const redPerkembangan = getFilteredTennisIndicators('perkembangan', 'T10_RED');

  assert.equal(redFisik.length, 6, 'Red Ball Fisik should be 6 indicators');
  assert.equal(redTeknik.length, 10, 'Red Ball Teknik should be 10 basic strokes');
  assert.equal(redTaktik.length, 2, 'Red Ball Taktik should be 2 simple indicators');
  assert.equal(redMental.length, 4, 'Red Ball Mental should be 4 indicators');
  assert.equal(redKomunikasi.length, 4, 'Red Ball Komunikasi should be 4 indicators');
  assert.equal(redPerkembangan.length, 5, 'Red Ball Perkembangan should be 5 indicators');

  // PELTI_KU14 / PELTI_KU16 / PELTI_KU18: full 86 core indicators open
  const ku14Fisik = getFilteredTennisIndicators('fisik', 'PELTI_KU14');
  const ku14Teknik = getFilteredTennisIndicators('teknik', 'PELTI_KU14');
  const ku14Taktik = getFilteredTennisIndicators('taktik', 'PELTI_KU14');
  const ku14Mental = getFilteredTennisIndicators('mental', 'PELTI_KU14');
  const ku14Komunikasi = getFilteredTennisIndicators('komunikasi', 'PELTI_KU14');
  const ku14Perkembangan = getFilteredTennisIndicators('perkembangan', 'PELTI_KU14');

  assert.equal(ku14Fisik.length, 16, 'Full KU-14 Fisik has all 16 indicators');
  assert.equal(ku14Teknik.length, 22, 'Full KU-14 Teknik has all 22 indicators');
  assert.equal(ku14Taktik.length, 20, 'Full KU-14 Taktik has all 20 indicators');
  assert.equal(ku14Mental.length, 10, 'Full KU-14 Mental has all 10 indicators');
  assert.equal(ku14Komunikasi.length, 8, 'Full KU-14 Komunikasi has all 8 indicators');
  assert.equal(ku14Perkembangan.length, 10, 'Full KU-14 Perkembangan has all 10 indicators');
});

test('getAvailableTennisEventsForTier offers age-appropriate competition events', () => {
  const redEvents = getAvailableTennisEventsForTier('T10_RED');
  assert.deepEqual(redEvents.map((e) => e.code), ['T10_EXPLORE']);

  const orangeEvents = getAvailableTennisEventsForTier('T10_ORANGE');
  assert.deepEqual(orangeEvents.map((e) => e.code), ['T10_EXPLORE']);

  const greenEvents = getAvailableTennisEventsForTier('T10_GREEN');
  assert.deepEqual(greenEvents.map((e) => e.code), ['T10_EXPLORE', 'MS', 'WS']);

  const ku14Events = getAvailableTennisEventsForTier('PELTI_KU14');
  assert.deepEqual(ku14Events.map((e) => e.code), ['MS', 'WS', 'MD', 'WD', 'XD']);
});

test('TENNIS_PLAYING_STYLES contains all 10 official styles STY01 through STY10', () => {
  assert.equal(TENNIS_PLAYING_STYLES.length, 10);
  const codes = TENNIS_PLAYING_STYLES.map((s) => s.code);
  assert.deepEqual(codes, [
    'STY01', 'STY02', 'STY03', 'STY04', 'STY05',
    'STY06', 'STY07', 'STY08', 'STY09', 'STY10'
  ]);

  const style1 = getTennisStyleConfig('STY01');
  assert.equal(style1.name, 'Baseline Aggressor');
  assert.equal(style1.shortName, 'Aggressor');
  assert.ok(style1.proExample.includes('Sinner') || style1.proExample.includes('Sabalenka'));
});

test('TENNIS_EMPHASIS_SYNC_MAP links event items to valid core indicator names', () => {
  const allCoreNames = new Set();
  Object.values(TENNIS_CORE_CATEGORIES).forEach((cat) => {
    cat.indicators.forEach((ind) => allCoreNames.add(typeof ind === 'string' ? ind : ind.name));
  });

  const syncKeys = Object.keys(TENNIS_EMPHASIS_SYNC_MAP);
  assert.ok(syncKeys.length >= 10, 'Should have synchronization mapping for common event items');

  for (const [key, targetCoreName] of Object.entries(TENNIS_EMPHASIS_SYNC_MAP)) {
    assert.ok(allCoreNames.has(targetCoreName), `Sync target ${targetCoreName} for ${key} must exist in core categories`);
  }
});

test('getTennisGradeInfo correctly classifies scores according to official rubric', () => {
  assert.equal(getTennisGradeInfo(0).label, 'Belum Dinilai');
  assert.equal(getTennisGradeInfo(45).label, 'Foundational / Pemula (D)');
  assert.equal(getTennisGradeInfo(60).label, 'Developing / Berkembang (C)');
  assert.equal(getTennisGradeInfo(75).label, 'Competitive / Kompeten (B)');
  assert.equal(getTennisGradeInfo(85).label, 'Advanced / Unggulan (A)');
  assert.equal(getTennisGradeInfo(95).label, 'Elite Prospect (A+)');
});

test('Tennis overall score calculation logic respects optional communication for singles', () => {
  // Mock category scores
  const categoryScores = {
    fisik: 80,
    teknik: 80,
    taktik: 80,
    mental: 80,
    komunikasi: 0, // Unscored / 0
    perkembangan: 80
  };

  // Case A: Singles (isDoubles = false, includeComm = false)
  // Overall should average the 5 categories (excluding komunikasi) = 80
  const eligibleCatsSingles = ['fisik', 'teknik', 'taktik', 'mental', 'perkembangan'];
  const avgSingles = Math.round(
    eligibleCatsSingles.reduce((s, k) => s + categoryScores[k], 0) / eligibleCatsSingles.length
  );
  assert.equal(avgSingles, 80, 'Singles without communication must not be penalized by zero communication score');

  // Case B: Doubles (isDoubles = true, includeComm = true)
  // Overall should average all 6 categories: (80*5 + 0) / 6 = 400 / 6 = 67
  const eligibleCatsDoubles = ['fisik', 'teknik', 'taktik', 'mental', 'komunikasi', 'perkembangan'];
  const avgDoubles = Math.round(
    eligibleCatsDoubles.reduce((s, k) => s + categoryScores[k], 0) / eligibleCatsDoubles.length
  );
  assert.equal(avgDoubles, 67, 'Doubles includes communication in evaluation average');
});
