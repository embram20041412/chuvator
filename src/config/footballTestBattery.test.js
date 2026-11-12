import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOOTBALL_TEST_BATTERY_CATALOG,
  getTestDefinitionById,
  getTestDefinitionByIndicatorId,
  isTestApplicableToAthlete,
  verifyCatalogAgainstIndicatorRegistry
} from './footballTestBatteryCatalog.js';

import {
  isRawInputEmpty,
  parseStrictNumericValue,
  computeBleepCumulativeMetrics,
  createInitialTestEntryDraft,
  validateAndComputeTestBatteryEntry
} from '../utils/testBatteryValidator.js';

import {
  saveAthleteTestResult,
  getAthleteTestResults,
  getLatestTestResultsByIndicatorMap,
  deleteAthleteTestResult,
  clearTenantLocalTestBatteryStore
} from '../services/assessmentBatteryService.js';

test('Catalog Integrity: Seluruh 18 indikator OBJECTIVE_TEST terdaftar dengan canonical ID yang konsisten', () => {
  const audit = verifyCatalogAgainstIndicatorRegistry();
  assert.equal(audit.totalCatalogTests, 18, 'Katalog wajib memiliki tepat 18 tes objektif');
  assert.equal(audit.isValid, true, `Mismatches ditemukan: ${audit.mismatches.join('; ')}`);

  const expectedIndicatorIds = [
    'FTB-UNI-PHY-01',
    'FTB-UNI-PHY-02',
    'FTB-UNI-PHY-03',
    'FTB-UNI-PHY-04',
    'FTB-UNI-PHY-06',
    'FTB-UNI-PHY-07',
    'FTB-UNI-PHY-08',
    'FTB-UNI-PHY-09',
    'FTB-UNI-PHY-10',
    'FTB-UNI-PHY-11',
    'FTB-UNI-PHY-12',
    'FTB-UNI-PHY-13',
    'FTB-UNI-PHY-14',
    'FTB-UNI-TEC-07',
    'FTB-SSB-OUT-02',
    'FTB-SSB-GK-02',
    'FTB-SSB-GK-03',
    'FTB-POS-WF-01'
  ];

  expectedIndicatorIds.forEach((indId) => {
    const def = getTestDefinitionByIndicatorId(indId);
    assert.ok(def, `Definisi tes untuk indikator ${indId} harus ditemukan`);
    assert.equal(def.indicatorId, indId);
    assert.ok(def.testId && def.testName && def.unit && def.finalResultMethod);
    assert.ok(Array.isArray(def.equipment) && def.equipment.length > 0);
    assert.ok(Array.isArray(def.instructions) && def.instructions.length > 0);
    assert.ok(Array.isArray(def.validityRules) && def.validityRules.length > 0);
  });

  // Pastikan TST-SHT-DST (Kekuatan Tembakan) memiliki penanda NEEDS_FURTHER_DESIGN sesuai Task 02.1
  const shotTest = getTestDefinitionByIndicatorId('FTB-UNI-TEC-07');
  assert.equal(shotTest.mappingReadiness, 'NEEDS_FURTHER_DESIGN');
});

test('Applicability Filter: Menyaring kesesuaian tes berdasarkan Development Tier dan Posisi Atlet', () => {
  const ssbGkTest = getTestDefinitionByIndicatorId('FTB-SSB-GK-02');
  const wingTest = getTestDefinitionByIndicatorId('FTB-POS-WF-01');
  const rsaTest = getTestDefinitionByIndicatorId('FTB-UNI-PHY-14');

  // GK SSB pada Tier 1 harus cocok untuk FTB-SSB-GK-02
  assert.equal(isTestApplicableToAthlete(ssbGkTest, 'TIER_1_GRASSROOTS', 'GK').isApplicable, true);
  // Pemain Outfield (CM) pada Tier 1 tidak cocok untuk FTB-SSB-GK-02
  assert.equal(isTestApplicableToAthlete(ssbGkTest, 'TIER_1_GRASSROOTS', 'CM').isApplicable, false);

  // Wing Forward (WFR) pada Tier 3 cocok untuk FTB-POS-WF-01
  assert.equal(isTestApplicableToAthlete(wingTest, 'TIER_3_YOUTH_DEV', 'WFR').isApplicable, true);
  // Center Back (CB) pada Tier 3 tidak cocok untuk FTB-POS-WF-01
  assert.equal(isTestApplicableToAthlete(wingTest, 'TIER_3_YOUTH_DEV', 'CB').isApplicable, false);

  // RSA 6x30m hanya berlaku pada Tier 4
  assert.equal(isTestApplicableToAthlete(rsaTest, 'TIER_2_FOUNDATION', 'CM').isApplicable, false);
  assert.equal(isTestApplicableToAthlete(rsaTest, 'TIER_4_ELITE_PRO', 'CM').isApplicable, true);
});

test('Strict Empty & Negative Rules: Input kosong TIDAK dianggap 0 dan angka negatif selalu ditolak', () => {
  assert.equal(isRawInputEmpty(''), true);
  assert.equal(isRawInputEmpty('   '), true);
  assert.equal(isRawInputEmpty(null), true);
  assert.equal(isRawInputEmpty(undefined), true);
  assert.equal(parseStrictNumericValue('').isValidNumber, false);
  assert.equal(parseStrictNumericValue('').numericValue, null);

  // Sprint 10m dengan Percobaan 2 dibiarkan kosong tapi berstatus valid -> harus ditolak!
  const emptyTrialResult = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    trials: [
      { trialNumber: 1, rawInput: '2.15', isValid: true },
      { trialNumber: 2, rawInput: '', isValid: true }
    ]
  });
  assert.equal(emptyTrialResult.isValid, false);
  assert.ok(emptyTrialResult.errors.some((e) => e.includes('Percobaan 2 belum diisi')));

  // Input angka negatif -> harus ditolak!
  const negativeResult = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    trials: [
      { trialNumber: 1, rawInput: '-2.10', isValid: true },
      { trialNumber: 2, rawInput: '2.05', isValid: true }
    ]
  });
  assert.equal(negativeResult.isValid, false);
  assert.ok(negativeResult.errors.some((e) => e.includes('negatif')));

  // Input nilai 0 -> harus ditolak!
  const zeroResult = validateAndComputeTestBatteryEntry({
    testId: 'TST-STR-PU1',
    testDate: '2026-11-12',
    unit: 'reps',
    trials: [{ trialNumber: 1, rawInput: '0', isValid: true }]
  });
  assert.equal(zeroResult.isValid, false);
  assert.ok(zeroResult.errors.some((e) => e.includes('Nilai 0 tidak valid')));
});

test('Multi-Trial & Invalid Trial Handling: Menghitung nilai terbaik dan menangani percobaan tidak sah (foul)', () => {
  // 10m Sprint: 2 percobaan sah -> pilih waktu tercepat (minimum)
  const sprintValid = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    trials: [
      { trialNumber: 1, rawInput: '2.18', isValid: true },
      { trialNumber: 2, rawInput: '2.06', isValid: true }
    ]
  });
  assert.equal(sprintValid.isValid, true);
  assert.equal(sprintValid.normalizedRecord.finalRawValue, 2.06);
  assert.equal(sprintValid.normalizedRecord.attemptStatus, 'VALID');
  assert.equal(sprintValid.normalizedRecord.calibrationStatus, 'PENDING_CALIBRATION');
  // Pastikan nilai mentah percobaan tidak dimutasi diam-diam
  assert.equal(sprintValid.normalizedRecord.trials[0].rawInput, '2.18');
  assert.equal(sprintValid.normalizedRecord.trials[1].rawInput, '2.06');

  // 10m Sprint: Percobaan 1 sah (2.14s), Percobaan 2 terpeleset (ditandai isValid: false) -> sah sebagai PARTIAL_VALID
  const sprintPartial = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    trials: [
      { trialNumber: 1, rawInput: '2.14', isValid: true },
      { trialNumber: 2, rawInput: '', isValid: false, invalidReason: 'Terpeleset saat tolakan start' }
    ]
  });
  assert.equal(sprintPartial.isValid, true);
  assert.equal(sprintPartial.normalizedRecord.finalRawValue, 2.14);
  assert.equal(sprintPartial.normalizedRecord.attemptStatus, 'PARTIAL_VALID');
  assert.equal(sprintPartial.normalizedRecord.trials[1].isValid, false);
});

test('Specialized Test Schemas: Ruler Drop (3x), Bilateral 505, Sargent Vertical Jump (H2-H1), Bleep Test, dan 6x30m RSA', () => {
  // 1. Ruler Drop (3 percobaan wajib -> rata-rata cm & estimasi ms)
  const rulerDrop = validateAndComputeTestBatteryEntry({
    testId: 'TST-RXN-RLR',
    testDate: '2026-11-12',
    unit: 'cm',
    trials: [
      { trialNumber: 1, rawInput: '15.0', isValid: true },
      { trialNumber: 2, rawInput: '17.0', isValid: true },
      { trialNumber: 3, rawInput: '16.0', isValid: true }
    ]
  });
  assert.equal(rulerDrop.isValid, true);
  assert.equal(rulerDrop.normalizedRecord.finalRawValue, 16);
  // sqrt(2 * 16 / 980) * 1000 = 180.7 ms
  assert.equal(rulerDrop.normalizedRecord.derivedMetrics.estimatedReactionTimeMs, 180.7);

  // 2. Sargent Vertical Jump (H1 = 195 cm, H2_1 = 232 cm, H2_2 = 236.5 cm -> Delta = 41.5 cm)
  const vJump = validateAndComputeTestBatteryEntry({
    testId: 'TST-JMP-VER',
    testDate: '2026-11-12',
    unit: 'cm',
    auxiliaryInputs: { standingReachCm: '195' },
    trials: [
      { trialNumber: 1, rawInput: '232', isValid: true },
      { trialNumber: 2, rawInput: '236.5', isValid: true }
    ]
  });
  assert.equal(vJump.isValid, true);
  assert.equal(vJump.normalizedRecord.finalRawValue, 41.5);
  assert.equal(vJump.normalizedRecord.derivedMetrics.netVerticalJumpCm, 41.5);

  // 3. Bleep Test (Level 8 Shuttle 5 -> Kumulatif 63 shuttle = 1260 meter)
  const bleepCalc = computeBleepCumulativeMetrics(8, 5);
  assert.equal(bleepCalc.isValid, true);
  assert.equal(bleepCalc.cumulativeShuttles, 66); // L1(7)+L2(8)+L3(8)+L4(9)+L5(9)+L6(10)+L7(10) = 61 + 5 = 66
  assert.equal(bleepCalc.cumulativeDistanceMeters, 1320);

  const bleepEntry = validateAndComputeTestBatteryEntry({
    testId: 'TST-END-BLP',
    testDate: '2026-11-12',
    unit: 'm',
    auxiliaryInputs: { levelReached: '8', shuttleReached: '5' },
    trials: []
  });
  assert.equal(bleepEntry.isValid, true);
  assert.equal(bleepEntry.normalizedRecord.finalRawValue, 1320);

  // 4. Bangsbo 6x30m RSA: Wajib 6 repetisi sah; tolak jika salah satu tidak sah
  const rsaIncomplete = validateAndComputeTestBatteryEntry({
    testId: 'TST-RSA-630',
    testDate: '2026-11-12',
    unit: 's',
    trials: [
      { trialNumber: 1, rawInput: '4.40', isValid: true },
      { trialNumber: 2, rawInput: '4.45', isValid: true },
      { trialNumber: 3, rawInput: '4.52', isValid: true },
      { trialNumber: 4, rawInput: '4.60', isValid: true },
      { trialNumber: 5, rawInput: '4.68', isValid: true },
      { trialNumber: 6, rawInput: '', isValid: false, invalidReason: 'Berhenti' }
    ]
  });
  assert.equal(rsaIncomplete.isValid, false);

  const rsaComplete = validateAndComputeTestBatteryEntry({
    testId: 'TST-RSA-630',
    testDate: '2026-11-12',
    unit: 's',
    trials: [
      { trialNumber: 1, rawInput: '4.40', isValid: true },
      { trialNumber: 2, rawInput: '4.45', isValid: true },
      { trialNumber: 3, rawInput: '4.50', isValid: true },
      { trialNumber: 4, rawInput: '4.55', isValid: true },
      { trialNumber: 5, rawInput: '4.60', isValid: true },
      { trialNumber: 6, rawInput: '4.68', isValid: true }
    ]
  });
  assert.equal(rsaComplete.isValid, true);
  // Total = 27.18s; S_best = 4.40s; 6 * 4.40 = 26.40s; FI% = ((27.18 / 26.40) - 1) * 100 = 2.95%
  assert.equal(rsaComplete.normalizedRecord.finalRawValue, 27.18);
  assert.equal(rsaComplete.normalizedRecord.derivedMetrics.bestSprintTimeSec, 4.4);
  assert.equal(rsaComplete.normalizedRecord.derivedMetrics.fatigueIndexPercent, 2.95);
});

test('Multi-Tenant Storage Isolation: Tenant A tidak dapat membaca, menyimpan, atau menghapus data milik Tenant B', async () => {
  const tenantA = { tenantId: 'ssb-garuda-muda-a', id: 'coach-a1', fullName: 'Coach Hendra' };
  const tenantB = { tenantId: 'ssb-bintang-timur-b', id: 'coach-b1', fullName: 'Coach Riko' };

  clearTenantLocalTestBatteryStore(tenantA.tenantId);
  clearTenantLocalTestBatteryStore(tenantB.tenantId);

  const draft = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-12');
  draft.trials[0].rawInput = '2.12';
  draft.trials[1].rawInput = '2.04';

  // 1. Simpan hasil tes untuk atlet di Tenant A
  const savedA = await saveAthleteTestResult(tenantA, {
    ...draft,
    studentId: 'student-101',
    developmentTier: 'TIER_2_FOUNDATION',
    positionCode: 'WFR',
    forceLocalStore: true
  });

  assert.equal(savedA.tenantId, 'ssb-garuda-muda-a');
  assert.equal(savedA.finalRawValue, 2.04);
  assert.equal(savedA.calibrationStatus, 'PENDING_CALIBRATION');
  assert.equal(savedA.convertedScore, null);

  // 2. Tenant A dapat membaca riwayat atletnya sendiri
  const historyA = await getAthleteTestResults(tenantA, 'student-101', { forceLocalStore: true });
  assert.equal(historyA.length, 1);
  assert.equal(historyA[0].id, savedA.id);

  const latestMapA = await getLatestTestResultsByIndicatorMap(tenantA, 'student-101', { forceLocalStore: true });
  assert.ok(latestMapA['FTB-UNI-PHY-01']);
  assert.equal(latestMapA['FTB-UNI-PHY-01'].finalRawValue, 2.04);

  // 3. Tenant B mencoba membaca studentId yang sama ('student-101') -> harus kosong (terisolasi penuh)
  const historyFromB = await getAthleteTestResults(tenantB, 'student-101', { forceLocalStore: true });
  assert.equal(historyFromB.length, 0);

  // 4. Tenant B mencoba memalsukan payload tenantId menjadi 'ssb-garuda-muda-a' -> wajib ditolak dengan error 42501!
  await assert.rejects(
    async () => {
      await saveAthleteTestResult(tenantB, {
        ...draft,
        tenantId: 'ssb-garuda-muda-a',
        studentId: 'student-101',
        forceLocalStore: true
      });
    },
    (err) => err.code === '42501'
  );

  // 5. Tenant B mencoba menyimpan untuk atlet yang memiliki studentTenantId berbeda -> wajib ditolak dengan 42501!
  await assert.rejects(
    async () => {
      await saveAthleteTestResult(tenantB, {
        ...draft,
        studentId: 'student-101',
        studentTenantId: 'ssb-garuda-muda-a',
        forceLocalStore: true
      });
    },
    (err) => err.code === '42501'
  );

  // 6. Tenant B mencoba menghapus data milik Tenant A -> wajib ditolak dengan 42501 dan data Tenant A tetap utuh
  await assert.rejects(
    async () => {
      await deleteAthleteTestResult(tenantB, savedA.id, {
        tenantId: 'ssb-garuda-muda-a',
        forceLocalStore: true
      });
    },
    (err) => err.code === '42501'
  );

  const historyAAfterAttack = await getAthleteTestResults(tenantA, 'student-101', { forceLocalStore: true });
  assert.equal(historyAAfterAttack.length, 1);

  clearTenantLocalTestBatteryStore(tenantA.tenantId);
  clearTenantLocalTestBatteryStore(tenantB.tenantId);
});
