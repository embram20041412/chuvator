import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  FOOTBALL_TEST_BATTERY_CATALOG,
  MEASUREMENT_METHODS,
  MEASUREMENT_METHOD_SPECS,
  getSupportedMeasurementMethodsForTest,
  getDefaultMeasurementMethodForTest,
  isStandardMeasurementMethod,
  isMeasurementMethodSupportedForTest
} from '../src/config/footballTestBatteryCatalog.js';

import {
  createInitialTestEntryDraft,
  validateAndComputeTestBatteryEntry
} from '../src/utils/testBatteryValidator.js';

import {
  UNSPECIFIED_MEASUREMENT_METHOD,
  extractRecordMeasurementMethod,
  areMeasurementMethodsCompatible,
  buildSprint10mLongitudinalProgress,
  buildTestLongitudinalProgress,
  recapitulateSprint10mRawData,
  recapitulateAssessmentBatteryRawData
} from '../src/services/sprint10mNormsAnalytics.js';

import {
  saveAthleteTestResult,
  mapTestResultRowToModel,
  getTenantAssessmentTestRecords,
  getTenantAssessmentNormsRecapitulation,
  clearTenantLocalTestBatteryStore
} from '../src/services/assessmentBatteryService.js';

function createMockSupabase(initialRows = []) {
  const rows = [...initialRows];

  const createQueryBuilder = () => {
    const eqFilters = {};
    let insertedRows = null;

    const builder = {
      select() {
        return builder;
      },
      insert(newRows) {
        insertedRows = newRows.map((r) => ({ ...r }));
        rows.push(...insertedRows);
        return builder;
      },
      eq(col, val) {
        eqFilters[col] = val;
        return builder;
      },
      order() {
        return builder;
      },
      single() {
        if (insertedRows && insertedRows.length > 0) {
          return Promise.resolve({ data: insertedRows[0], error: null });
        }
        return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
      },
      then(resolve) {
        const matched = rows.filter((r) =>
          Object.entries(eqFilters).every(([k, v]) => String(r[k]) === String(v))
        );
        return resolve({ data: matched, error: null });
      }
    };
    return builder;
  };

  return {
    rows,
    client: {
      from(table) {
        assert.equal(table, 'athlete_test_results');
        return createQueryBuilder();
      }
    }
  };
}

test('Task 03.5 (1): Seluruh 18 tes Assessment Battery terpetakan ke 4 kategori metode standar sesuai protokol aktual', () => {
  assert.equal(FOOTBALL_TEST_BATTERY_CATALOG.length, 18);
  assert.deepEqual(Object.keys(MEASUREMENT_METHODS).sort(), [
    'MANUAL_COUNT',
    'PHYSICAL_MEASURING_TOOL',
    'SMARTPHONE_VIDEO',
    'STOPWATCH_MANUAL'
  ]);

  for (const methodCode of Object.values(MEASUREMENT_METHODS)) {
    assert.ok(MEASUREMENT_METHOD_SPECS[methodCode], `Spec hilang untuk ${methodCode}`);
    assert.equal(isStandardMeasurementMethod(methodCode), true);
  }

  const expectedMapping = {
    'TST-SPR-10M': ['STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'],
    'TST-SPR-30M': ['STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'],
    'TST-AGL-ARW': ['STOPWATCH_MANUAL'],
    'TST-BAL-STK': ['STOPWATCH_MANUAL'],
    'TST-COD-505': ['STOPWATCH_MANUAL'],
    'TST-COR-PLK': ['STOPWATCH_MANUAL'],
    'TST-RSA-630': ['STOPWATCH_MANUAL'],
    'TST-SSB-GK-03': ['STOPWATCH_MANUAL'],
    'TST-WF-TLA': ['STOPWATCH_MANUAL'],
    'TST-MOB-SAR': ['PHYSICAL_MEASURING_TOOL'],
    'TST-RXN-RLR': ['PHYSICAL_MEASURING_TOOL'],
    'TST-JMP-VER': ['PHYSICAL_MEASURING_TOOL'],
    'TST-PWR-SBJ': ['PHYSICAL_MEASURING_TOOL'],
    'TST-SHT-DST': ['PHYSICAL_MEASURING_TOOL'],
    'TST-END-BLP': ['MANUAL_COUNT'],
    'TST-STR-PU1': ['MANUAL_COUNT'],
    'TST-SSB-WAP': ['MANUAL_COUNT'],
    'TST-SSB-GK-02': ['MANUAL_COUNT']
  };

  assert.equal(Object.keys(expectedMapping).length, 18);

  for (const testDef of FOOTBALL_TEST_BATTERY_CATALOG) {
    const expectedSupported = expectedMapping[testDef.testId];
    assert.ok(expectedSupported, `Test ${testDef.testId} tidak ada di pemetaan Task 03.5`);
    assert.deepEqual(getSupportedMeasurementMethodsForTest(testDef.testId), expectedSupported);
    assert.equal(getDefaultMeasurementMethodForTest(testDef.testId), expectedSupported[0]);

    // SMARTPHONE_VIDEO hanya boleh muncul di TST-SPR-10M & TST-SPR-30M
    if (testDef.testId !== 'TST-SPR-10M' && testDef.testId !== 'TST-SPR-30M') {
      assert.equal(
        isMeasurementMethodSupportedForTest(testDef.testId, MEASUREMENT_METHODS.SMARTPHONE_VIDEO),
        false,
        `${testDef.testId} tidak boleh mendukung SMARTPHONE_VIDEO`
      );
    }

    const draft = createInitialTestEntryDraft(testDef.testId, '2026-11-12');
    assert.equal(
      draft.measurementMethod,
      expectedSupported[0],
      `Draft awal ${testDef.testId} wajib terisi ${expectedSupported[0]}`
    );
  }
});

test('Task 03.5 (2): Validasi & penyimpanan dbRow.measurement_method otomatis untuk tes beragam metode (termasuk Bleep Test & Vertical Jump)', async () => {
  const mockDb = createMockSupabase();
  const coachAuth = {
    uid: 'coach-035',
    tenantId: 'tenant-035',
    role: 'coach',
    fullName: 'Coach Standardized',
    isDemoMode: false
  };

  const samples = [
    {
      expectedMethod: 'STOPWATCH_MANUAL',
      payload: {
        testId: 'TST-AGL-ARW',
        testDate: '2026-11-12',
        unit: 's',
        studentId: 'stu-1',
        trials: [
          { trialNumber: 1, rawInput: '16.40', isValid: true },
          { trialNumber: 2, rawInput: '16.20', isValid: true }
        ]
      }
    },
    {
      expectedMethod: 'STOPWATCH_MANUAL',
      payload: {
        testId: 'TST-BAL-STK',
        testDate: '2026-11-12',
        unit: 's',
        studentId: 'stu-1',
        trials: [
          { trialNumber: 1, rawInput: '18.5', isValid: true },
          { trialNumber: 2, rawInput: '16.5', isValid: true }
        ]
      }
    },
    {
      expectedMethod: 'PHYSICAL_MEASURING_TOOL',
      payload: {
        testId: 'TST-MOB-SAR',
        testDate: '2026-11-12',
        unit: 'cm',
        studentId: 'stu-1',
        trials: [
          { trialNumber: 1, rawInput: '31.5', isValid: true },
          { trialNumber: 2, rawInput: '33.0', isValid: true }
        ]
      }
    },
    {
      expectedMethod: 'MANUAL_COUNT',
      payload: {
        testId: 'TST-SSB-WAP',
        testDate: '2026-11-12',
        unit: 'reps',
        studentId: 'stu-1',
        trials: [
          { trialNumber: 1, rawInput: '18', isValid: true },
          { trialNumber: 2, rawInput: '21', isValid: true }
        ]
      }
    },
    {
      expectedMethod: 'MANUAL_COUNT',
      payload: {
        testId: 'TST-END-BLP',
        testDate: '2026-11-12',
        unit: 'm',
        studentId: 'stu-1',
        auxiliaryInputs: { levelReached: 6, shuttleReached: 5 }
      }
    },
    {
      expectedMethod: 'PHYSICAL_MEASURING_TOOL',
      payload: {
        testId: 'TST-JMP-VER',
        testDate: '2026-11-12',
        unit: 'cm',
        studentId: 'stu-1',
        auxiliaryInputs: { standingReachCm: 195 },
        trials: [
          { trialNumber: 1, rawInput: '235', isValid: true },
          { trialNumber: 2, rawInput: '238', isValid: true }
        ]
      }
    },
    {
      expectedMethod: 'SMARTPHONE_VIDEO',
      payload: {
        testId: 'TST-SPR-30M',
        testDate: '2026-11-12',
        unit: 's',
        measurementMethod: 'SMARTPHONE_VIDEO',
        studentId: 'stu-1',
        trials: [
          { trialNumber: 1, rawInput: '4.45', isValid: true },
          { trialNumber: 2, rawInput: '4.38', isValid: true }
        ]
      }
    }
  ];

  for (let i = 0; i < samples.length; i += 1) {
    const { expectedMethod, payload } = samples[i];
    const saved = await saveAthleteTestResult(coachAuth, payload, { supabaseClient: mockDb.client });
    assert.equal(saved.measurementMethod, expectedMethod);
    assert.equal(mockDb.rows[i].measurement_method, expectedMethod);
    assert.equal(mockDb.rows[i].derived_metrics.measurementMethod, expectedMethod);
    assert.equal(mockDb.rows[i].calibration_status, 'PENDING_CALIBRATION');
    assert.equal(mockDb.rows[i].converted_score, null);
  }
});

test('Task 03.5 (3): Menolak metode pengukuran yang tidak sesuai protokol tes, kosong, atau tidak dikenal', () => {
  // 1. SMARTPHONE_VIDEO ditolak pada TST-AGL-ARW
  const videoAgility = validateAndComputeTestBatteryEntry({
    testId: 'TST-AGL-ARW',
    testDate: '2026-11-12',
    unit: 's',
    measurementMethod: 'SMARTPHONE_VIDEO',
    trials: [
      { trialNumber: 1, rawInput: '16.50', isValid: true },
      { trialNumber: 2, rawInput: '16.30', isValid: true }
    ]
  });
  assert.equal(videoAgility.isValid, false);
  assert.ok(videoAgility.fieldErrors.measurementMethod);

  // 2. STOPWATCH_MANUAL ditolak pada TST-MOB-SAR (harus PHYSICAL_MEASURING_TOOL)
  const stopwatchMob = validateAndComputeTestBatteryEntry({
    testId: 'TST-MOB-SAR',
    testDate: '2026-11-12',
    unit: 'cm',
    measurementMethod: 'STOPWATCH_MANUAL',
    trials: [
      { trialNumber: 1, rawInput: '30', isValid: true },
      { trialNumber: 2, rawInput: '31', isValid: true }
    ]
  });
  assert.equal(stopwatchMob.isValid, false);
  assert.ok(stopwatchMob.fieldErrors.measurementMethod);

  // 3. STOPWATCH_MANUAL ditolak pada TST-SSB-WAP (harus MANUAL_COUNT)
  const stopwatchWallPass = validateAndComputeTestBatteryEntry({
    testId: 'TST-SSB-WAP',
    testDate: '2026-11-12',
    unit: 'reps',
    measurementMethod: 'STOPWATCH_MANUAL',
    trials: [
      { trialNumber: 1, rawInput: '15', isValid: true },
      { trialNumber: 2, rawInput: '16', isValid: true }
    ]
  });
  assert.equal(stopwatchWallPass.isValid, false);
  assert.ok(stopwatchWallPass.fieldErrors.measurementMethod);

  // 4. STOPWATCH_MANUAL ditolak pada TST-END-BLP (harus MANUAL_COUNT)
  const stopwatchBleep = validateAndComputeTestBatteryEntry({
    testId: 'TST-END-BLP',
    testDate: '2026-11-12',
    unit: 'm',
    measurementMethod: 'STOPWATCH_MANUAL',
    auxiliaryInputs: { levelReached: 5, shuttleReached: 4 }
  });
  assert.equal(stopwatchBleep.isValid, false);
  assert.ok(stopwatchBleep.fieldErrors.measurementMethod);

  // 5. Metode null/whitespace atau LASER_GATE ditolak
  const nullMethod = validateAndComputeTestBatteryEntry({
    testId: 'TST-BAL-STK',
    testDate: '2026-11-12',
    unit: 's',
    measurementMethod: null,
    trials: [
      { trialNumber: 1, rawInput: '12.0', isValid: true },
      { trialNumber: 2, rawInput: '13.0', isValid: true }
    ]
  });
  assert.equal(nullMethod.isValid, false);
  assert.ok(nullMethod.fieldErrors.measurementMethod);

  const laserMethod = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-30M',
    testDate: '2026-11-12',
    unit: 's',
    measurementMethod: 'LASER_GATE',
    trials: [
      { trialNumber: 1, rawInput: '4.20', isValid: true },
      { trialNumber: 2, rawInput: '4.15', isValid: true }
    ]
  });
  assert.equal(laserMethod.isValid, false);
  assert.ok(laserMethod.fieldErrors.measurementMethod);
});

test('Task 03.5 (4): Record legacy dengan measurement_method NULL tetap NULL, tidak diasumsikan STOPWATCH_MANUAL, dan terisolasi di longitudinal & rekapitulasi', () => {
  // Simulasi 5 record eksisting tertanggal 2026-11-13 dengan measurement_method NULL
  const legacyDbRows = [
    {
      id: 'leg-1',
      tenant_id: 'tenant-prod-sim',
      student_id: 'stu-leg-1',
      test_id: 'TST-SPR-10M',
      indicator_id: 'FTB-UNI-PHY-01',
      test_date: '2026-11-13',
      measurement_method: null,
      derived_metrics: {},
      auxiliary_inputs: {},
      final_raw_value: 2.15,
      final_unit: 's',
      final_display_value: '2.15 s',
      calibration_status: 'PENDING_CALIBRATION',
      converted_score: null,
      created_at: '2026-11-13T08:00:00Z'
    },
    {
      id: 'leg-2',
      tenant_id: 'tenant-prod-sim',
      student_id: 'stu-leg-1',
      test_id: 'TST-AGL-ARW',
      indicator_id: 'FTB-UNI-PHY-02',
      test_date: '2026-11-13',
      measurement_method: null,
      derived_metrics: {},
      auxiliary_inputs: {},
      final_raw_value: 16.5,
      final_unit: 's',
      final_display_value: '16.5 s',
      calibration_status: 'PENDING_CALIBRATION',
      converted_score: null,
      created_at: '2026-11-13T08:05:00Z'
    }
  ];

  // Pembacaan model tidak pernah mengarang/backfill STOPWATCH_MANUAL
  const mappedLegacy = legacyDbRows.map((r) => mapTestResultRowToModel(r, 'SUPABASE_DB'));
  assert.equal(mappedLegacy[0].measurementMethod, null);
  assert.equal(mappedLegacy[1].measurementMethod, null);
  assert.equal(extractRecordMeasurementMethod(legacyDbRows[0]), null);

  // Kompatibilitas longitudinal menolak NULL
  assert.equal(areMeasurementMethodsCompatible(null, 'STOPWATCH_MANUAL'), false);
  assert.equal(areMeasurementMethodsCompatible(null, null), false);
  assert.equal(areMeasurementMethodsCompatible('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'), false);
  assert.equal(areMeasurementMethodsCompatible('STOPWATCH_MANUAL', 'STOPWATCH_MANUAL'), true);

  // Longitudinal: gabungkan legacy NULL (Nov 13) dengan sesi STOPWATCH_MANUAL baru (Nov 20)
  const mixedHistory = [
    mappedLegacy[0],
    {
      id: 'new-sw-1',
      tenantId: 'tenant-prod-sim',
      studentId: 'stu-leg-1',
      testId: 'TST-SPR-10M',
      testDate: '2026-11-20',
      measurementMethod: 'STOPWATCH_MANUAL',
      finalRawValue: 2.08,
      finalUnit: 's',
      finalDisplayValue: '2.08 s',
      createdAt: '2026-11-20T08:00:00Z'
    },
    {
      id: 'new-sw-2',
      tenantId: 'tenant-prod-sim',
      studentId: 'stu-leg-1',
      testId: 'TST-SPR-10M',
      testDate: '2026-11-27',
      measurementMethod: 'STOPWATCH_MANUAL',
      finalRawValue: 2.04,
      finalUnit: 's',
      finalDisplayValue: '2.04 s',
      createdAt: '2026-11-27T08:00:00Z'
    }
  ];

  const sprLongitudinal = buildSprint10mLongitudinalProgress(mixedHistory);
  assert.equal(sprLongitudinal.hasUnverifiedLegacyRecords, true);
  assert.equal(sprLongitudinal.entries[0].measurementMethod, null);
  assert.equal(sprLongitudinal.entries[0].progressionDirection, 'UNSPECIFIED_METHOD');
  assert.equal(sprLongitudinal.entries[0].deltaFromPrevSameMethodSec, null);

  // Sesi Nov 20 STOPWATCH_MANUAL harus menjadi BASELINE, bukan dibandingkan terhadap legacy NULL Nov 13!
  assert.equal(sprLongitudinal.entries[1].measurementMethod, 'STOPWATCH_MANUAL');
  assert.equal(sprLongitudinal.entries[1].progressionDirection, 'BASELINE');
  assert.equal(sprLongitudinal.entries[1].deltaFromPrevSameMethodSec, null);

  // Sesi Nov 27 dibandingkan dengan Sesi Nov 20 STOPWATCH_MANUAL
  assert.equal(sprLongitudinal.entries[2].progressionDirection, 'IMPROVED');
  assert.equal(sprLongitudinal.entries[2].deltaFromPrevSameMethodSec, -0.04);

  // Rekapitulasi Sprint 10m wajib memisahkan legacy NULL ke bucket UNSPECIFIED (tidak digabung ke STOPWATCH_MANUAL)
  const sprRecap = recapitulateSprint10mRawData(mixedHistory, {
    expectedTenantId: 'tenant-prod-sim'
  });
  assert.equal(sprRecap.totalMatchingRecords, 3);
  assert.equal(sprRecap.groups.length, 2);
  const unspecifiedGroup = sprRecap.groups.find(
    (g) => g.measurementMethod === UNSPECIFIED_MEASUREMENT_METHOD
  );
  const stopwatchGroup = sprRecap.groups.find(
    (g) => g.measurementMethod === MEASUREMENT_METHODS.STOPWATCH_MANUAL
  );
  assert.ok(unspecifiedGroup);
  assert.equal(unspecifiedGroup.sampleCount, 1);
  assert.ok(stopwatchGroup);
  assert.equal(stopwatchGroup.sampleCount, 2);
});

test('Task 03.5 (5): Rekapitulasi & longitudinal umum seluruh tes memisahkan 4 kategori metode & menjaga isolasi tenant', async () => {
  clearTenantLocalTestBatteryStore();
  const mockDb = createMockSupabase();

  const authA = {
    uid: 'admin-a',
    tenantId: 'tenant-a',
    role: 'admin',
    fullName: 'Admin A',
    isDemoMode: false
  };
  const authB = {
    uid: 'admin-b',
    tenantId: 'tenant-b',
    role: 'admin',
    fullName: 'Admin B',
    isDemoMode: false
  };

  await saveAthleteTestResult(
    authA,
    {
      testId: 'TST-MOB-SAR',
      testDate: '2026-11-12',
      unit: 'cm',
      studentId: 'stu-a1',
      developmentTier: 'TIER_2_FOUNDATION',
      trials: [
        { trialNumber: 1, rawInput: '29.0', isValid: true },
        { trialNumber: 2, rawInput: '31.0', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  await saveAthleteTestResult(
    authA,
    {
      testId: 'TST-MOB-SAR',
      testDate: '2026-11-19',
      unit: 'cm',
      studentId: 'stu-a1',
      developmentTier: 'TIER_2_FOUNDATION',
      trials: [
        { trialNumber: 1, rawInput: '32.5', isValid: true },
        { trialNumber: 2, rawInput: '34.0', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  await saveAthleteTestResult(
    authB,
    {
      testId: 'TST-SSB-WAP',
      testDate: '2026-11-12',
      unit: 'reps',
      studentId: 'stu-b1',
      developmentTier: 'TIER_1_GRASSROOTS',
      trials: [
        { trialNumber: 1, rawInput: '17', isValid: true },
        { trialNumber: 2, rawInput: '20', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  const recordsA = await getTenantAssessmentTestRecords(authA, { supabaseClient: mockDb.client });
  assert.equal(recordsA.length, 2);

  // Verifikasi arah HIGHER_IS_BETTER pada buildTestLongitudinalProgress untuk TST-MOB-SAR
  const mobLongitudinal = buildTestLongitudinalProgress(recordsA, 'TST-MOB-SAR');
  assert.equal(mobLongitudinal.totalSessions, 2);
  assert.equal(mobLongitudinal.entries[0].measurementMethod, 'PHYSICAL_MEASURING_TOOL');
  assert.equal(mobLongitudinal.entries[0].progressionDirection, 'BASELINE');
  assert.equal(mobLongitudinal.entries[1].progressionDirection, 'IMPROVED');
  assert.equal(mobLongitudinal.entries[1].deltaFromPrevSameMethod, 3);

  const recapA = await getTenantAssessmentNormsRecapitulation(
    authA,
    { testId: 'TST-MOB-SAR' },
    { supabaseClient: mockDb.client }
  );
  assert.equal(recapA.totalMatchingRecords, 2);
  assert.equal(recapA.groups[0].measurementMethod, 'PHYSICAL_MEASURING_TOOL');
  assert.equal(recapA.groups[0].bestRawValue, 34);

  const recapAllA = recapitulateAssessmentBatteryRawData(
    mockDb.rows.map((r) => ({ ...r })),
    { expectedTenantId: 'tenant-a' }
  );
  assert.equal(recapAllA.totalMatchingRecords, 2);

  await assert.rejects(
    async () => {
      await getTenantAssessmentNormsRecapitulation(
        authA,
        { tenantId: 'tenant-b' },
        { supabaseClient: mockDb.client }
      );
    },
    (err) => err.code === '42501'
  );
});

test('Task 03.5 (6): Paket SQL Task 03.5 bersifat aditif, non-destruktif terhadap baris legacy NULL, dan mencakup 18 tes', () => {
  const sqlDir = path.resolve(process.cwd(), 'docs/assessment/sql/task03_5');
  const migSql = fs.readFileSync(
    path.join(sqlDir, '01_task03_5_measurement_method_standardization.sql'),
    'utf8'
  );
  const verifySql = fs.readFileSync(
    path.join(sqlDir, '02_task03_5_verification.sql'),
    'utf8'
  );
  const rollbackSql = fs.readFileSync(
    path.join(sqlDir, '03_task03_5_rollback.sql'),
    'utf8'
  );

  const stripSqlComments = (sql) =>
    sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
  const migSqlNoComments = stripSqlComments(migSql);
  const verifySqlNoComments = stripSqlComments(verifySql);
  const rollbackSqlNoComments = stripSqlComments(rollbackSql);

  // Transaksional & non-destruktif
  assert.ok(/^\s*BEGIN;/m.test(migSqlNoComments));
  assert.ok(/COMMIT;\s*$/m.test(migSqlNoComments));
  assert.equal(
    /\bUPDATE\s+public\.athlete_test_results\b/i.test(migSqlNoComments),
    false,
    'Migrasi aditif Task 03.5 dilarang meng-UPDATE baris eksisting'
  );
  assert.equal(/\bDELETE\s+FROM\s+public\.athlete_test_results\b/i.test(migSqlNoComments), false);
  assert.equal(/\bDROP\s+TABLE\b/i.test(rollbackSqlNoComments), false);
  assert.equal(/\bTRUNCATE\b/i.test(rollbackSqlNoComments), false);

  // Constraint kompatibilitas mencakup seluruh 4 metode dan seluruh 18 testId
  assert.ok(migSqlNoComments.includes('chk_athlete_test_results_measurement_method_compatibility'));
  assert.ok(migSqlNoComments.includes('measurement_method IS NULL'));
  for (const methodCode of Object.values(MEASUREMENT_METHODS)) {
    assert.ok(migSqlNoComments.includes(`'${methodCode}'`), `SQL harus memuat ${methodCode}`);
  }
  for (const testDef of FOOTBALL_TEST_BATTERY_CATALOG) {
    assert.ok(migSqlNoComments.includes(`'${testDef.testId}'`), `SQL constraint harus mencakup ${testDef.testId}`);
  }

  // Verification SQL menggunakan BEGIN..ROLLBACK tanpa COMMIT
  assert.ok(verifySqlNoComments.includes('BEGIN;'));
  assert.ok(verifySqlNoComments.includes('ROLLBACK;'));
  assert.equal(/\bCOMMIT\s*;/i.test(verifySqlNoComments), false);
});

test('Task 03.5.1 (Audit): Metode tidak dikenal tidak pernah lolos ke model/rekapitulasi & SQL Task 03.5/03.4 menegakkan record baru non-NULL tanpa mengubah legacy NULL', () => {
  // 1. Legacy record dengan metadata JSONB non-standar (mis. HAND_TIMER_LEGACY) harus ternormalisasi menjadi null / UNSPECIFIED
  const legacyUnknownRow = {
    id: 'leg-unknown-1',
    tenant_id: 'tenant-audit',
    student_id: 'stu-audit-1',
    test_id: 'TST-SPR-10M',
    indicator_id: 'FTB-UNI-PHY-01',
    test_date: '2026-11-13',
    measurement_method: null,
    derived_metrics: { measurementMethod: 'HAND_TIMER_LEGACY' },
    auxiliary_inputs: {},
    final_raw_value: 2.17,
    final_unit: 's',
    final_display_value: '2.17 s',
    calibration_status: 'PENDING_CALIBRATION',
    converted_score: null,
    created_at: '2026-11-13T09:00:00Z'
  };

  assert.equal(extractRecordMeasurementMethod(legacyUnknownRow), null);
  const mappedUnknown = mapTestResultRowToModel(legacyUnknownRow, 'SUPABASE_DB');
  assert.equal(mappedUnknown.measurementMethod, null);

  const sprRecap = recapitulateSprint10mRawData([mappedUnknown], {
    expectedTenantId: 'tenant-audit'
  });
  assert.equal(sprRecap.totalMatchingRecords, 1);
  assert.equal(sprRecap.groups[0].measurementMethod, UNSPECIFIED_MEASUREMENT_METHOD);

  const allRecap = recapitulateAssessmentBatteryRawData([legacyUnknownRow], {
    expectedTenantId: 'tenant-audit'
  });
  assert.equal(allRecap.totalMatchingRecords, 1);
  assert.equal(allRecap.groups[0].measurementMethod, UNSPECIFIED_MEASUREMENT_METHOD);
  assert.equal(allRecap.groups[0].isMethodSpecified, false);

  // 2. Audit SQL Task 03.5 & sinkronisasi Task 03.4
  const sql035Dir = path.resolve(process.cwd(), 'docs/assessment/sql/task03_5');
  const sql034Dir = path.resolve(process.cwd(), 'docs/assessment/sql/task03_4');

  const mig035 = fs.readFileSync(
    path.join(sql035Dir, '01_task03_5_measurement_method_standardization.sql'),
    'utf8'
  );
  const trigger034 = fs.readFileSync(
    path.join(sql034Dir, '03_security_functions_and_triggers.sql'),
    'utf8'
  );
  const master034 = fs.readFileSync(
    path.join(sql034Dir, '00_master_task03_4_assessment_battery_migration.sql'),
    'utf8'
  );
  const rollback034 = fs.readFileSync(
    path.join(sql034Dir, '07_rollback_plan.sql'),
    'utf8'
  );

  for (const [label, sql] of [
    ['01_task03_5', mig035],
    ['03_security_functions_and_triggers', trigger034],
    ['00_master', master034]
  ]) {
    assert.ok(
      sql.includes('measurement_method wajib diisi dengan metode pengukuran standar yang kompatibel untuk test_id'),
      `${label}: INSERT baru tanpa metode pada dual-method test wajib ditolak (23514)`
    );
    assert.ok(
      sql.includes('measurement_method yang sudah tercatat tidak boleh dikosongkan menjadi NULL'),
      `${label}: UPDATE mengosongkan measurement_method non-null menjadi NULL wajib ditolak (23514)`
    );
    assert.ok(
      sql.includes('SECURITY DEFINER') &&
        sql.includes('SET search_path = public, extensions, pg_temp') &&
        sql.includes('OWNER TO postgres'),
      `${label}: keamanan SECURITY DEFINER / search_path / owner postgres wajib utuh`
    );
  }

  assert.ok(
    rollback034.includes('DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility;'),
    '07_rollback_plan.sql wajib mencakup DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility'
  );
});

test('Task 03.5.2 (Reconciliation): Integrasi trigger produksi, anti-bypass 3 jalur JSONB, penanganan aman spr10m constraint & skrip verifikasi 11 skenario', () => {
  const sql035Dir = path.resolve(process.cwd(), 'docs/assessment/sql/task03_5');
  const sql034Dir = path.resolve(process.cwd(), 'docs/assessment/sql/task03_4');

  const mig035 = fs.readFileSync(
    path.join(sql035Dir, '01_task03_5_measurement_method_standardization.sql'),
    'utf8'
  );
  const verify035 = fs.readFileSync(
    path.join(sql035Dir, '02_task03_5_verification.sql'),
    'utf8'
  );
  const rollback035 = fs.readFileSync(
    path.join(sql035Dir, '03_task03_5_rollback.sql'),
    'utf8'
  );
  const trigger034 = fs.readFileSync(
    path.join(sql034Dir, '03_security_functions_and_triggers.sql'),
    'utf8'
  );
  const master034 = fs.readFileSync(
    path.join(sql034Dir, '00_master_task03_4_assessment_battery_migration.sql'),
    'utf8'
  );

  // 1. Prasyarat fungsi keamanan produksi & pemasangan trigger aktif BEFORE INSERT OR UPDATE
  assert.ok(mig035.includes("to_regprocedure('public.get_strict_tenant_member_role(text)')"));
  assert.ok(mig035.includes("to_regprocedure('public.athlete_belongs_to_tenant(uuid,text,uuid,uuid)')"));
  assert.ok(mig035.includes("to_regprocedure('public.coach_can_manage_student(text,uuid,uuid)')"));
  assert.ok(
    /CREATE TRIGGER trg_validate_and_protect_athlete_test_results\s+BEFORE INSERT OR UPDATE ON public\.athlete_test_results/i.test(mig035),
    '01_task03_5 wajib memastikan trigger trg_validate_and_protect_athlete_test_results aktif sebagai BEFORE INSERT OR UPDATE'
  );

  // 2. Penanganan aman constraint lama chk_athlete_test_results_spr10m_method (dicabut setelah constraint 18 tes aktif, dipulihkan saat rollback)
  const addCompatPos = mig035.indexOf('ADD CONSTRAINT chk_athlete_test_results_measurement_method_compatibility');
  const dropOldSprPos = mig035.indexOf('DROP CONSTRAINT IF EXISTS chk_athlete_test_results_spr10m_method;');
  assert.ok(addCompatPos > 0 && dropOldSprPos > addCompatPos, '01_task03_5 wajib memasang constraint 18 tes terlebih dahulu sebelum mencabut chk_athlete_test_results_spr10m_method');
  assert.ok(rollback035.includes('chk_athlete_test_results_spr10m_method'), '03_task03_5_rollback wajib memulihkan chk_athlete_test_results_spr10m_method');

  // 3. Anti-bypass 3 jalur JSONB + kompatibilitas level trigger tersinkron di 01_task03_5, 03_security, dan 00_master
  for (const [label, sql] of [
    ['01_task03_5', mig035],
    ['03_security_functions_and_triggers', trigger034],
    ['00_master', master034]
  ]) {
    assert.ok(sql.includes('v_dm_method'), `${label}: wajib mengekstrak derived_metrics->>'measurementMethod'`);
    assert.ok(sql.includes('v_ctx_nested_method'), `${label}: wajib mengekstrak derived_metrics->'athleteTestContext'->>'measurementMethod'`);
    assert.ok(sql.includes('v_aux_method'), `${label}: wajib mengekstrak auxiliary_inputs->>'measurementMethod'`);
    assert.ok(
      sql.includes('Inkonsistensi measurement_method antar metadata JSONB pada UPDATE'),
      `${label}: wajib menolak kontradiksi JSONB antar key pada UPDATE`
    );
    assert.ok(
      sql.includes('Inkonsistensi measurement_method kolom (%) dengan JSONB (%) saat UPDATE'),
      `${label}: wajib menolak mutasi campuran kolom valid + JSONB kontradiktif pada UPDATE`
    );
    assert.ok(
      sql.includes('measurement_method (%) tidak dikenal atau tidak kompatibel untuk test_id %'),
      `${label}: wajib menolak nilai tidak dikenal atau tidak kompatibel di level trigger`
    );
    assert.ok(
      sql.includes('NEW.coach_id IS DISTINCT FROM OLD.coach_id') &&
        sql.includes('NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id') &&
        sql.includes('NEW.recorded_by_name IS DISTINCT FROM OLD.recorded_by_name'),
      `${label}: perlindungan coach_id dan imutabilitas audit wajib utuh`
    );
  }

  // 4. Verifikasi 02_task03_5_verification.sql kompatibel skema aktual & mencakup 18 tes + 11 skenario wajib
  assert.ok(verify035.includes('INSERT INTO public.academy_classes (id, tenant_id, academy_id, class_name, coach_id)'));
  assert.ok(verify035.includes('INSERT INTO public.students (id, tenant_id, academy_id, class_id, student_name, birth_date)'));
  assert.ok(verify035.includes('INSERT INTO auth.users (id, email, email_confirmed_at, aud, role)'));
  assert.ok(verify035.includes('INSERT INTO public.coaches (id, tenant_id, academy_id, name, status, auth_uid)'));
  assert.equal(/\bINSERT INTO public\.academy_classes\s*\([^)]*\bname\b/i.test(verify035), false, 'academy_classes memakai class_name, bukan name');
  assert.equal(/\bINSERT INTO public\.students\s*\([^)]*\bname\b/i.test(verify035), false, 'students memakai student_name, bukan name');

  for (const testDef of FOOTBALL_TEST_BATTERY_CATALOG) {
    assert.ok(
      verify035.includes(`'${testDef.testId}'`),
      `02_task03_5_verification.sql wajib menguji test_id ${testDef.testId}`
    );
  }
  assert.ok(verify035.includes('LASER_GATE'), 'Wajib menguji metode tidak dikenal');
  assert.ok(verify035.includes('athleteTestContext'), 'Wajib menguji bypass JSONB bersarang');
  assert.ok(verify035.includes('auxiliary_inputs'), 'Wajib menguji bypass auxiliary_inputs');
  assert.ok(verify035.includes('recorded_by_user_id'), 'Wajib menguji imutabilitas kolom audit');
  assert.ok(verify035.includes('v_coach_a2_id'), 'Wajib menguji otorisasi/anti-spoofing coach');
  assert.ok(verify035.includes('v_tenant_b'), 'Wajib menguji isolasi tenant');
});


