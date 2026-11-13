import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOOTBALL_TEST_BATTERY_CATALOG,
  SPRINT_MEASUREMENT_METHODS,
  SPRINT_MEASUREMENT_METHOD_SPECS,
  getTestDefinitionById
} from '../config/footballTestBatteryCatalog.js';

import {
  createInitialTestEntryDraft,
  validateAndComputeTestBatteryEntry
} from '../utils/testBatteryValidator.js';

import {
  computeAgeYearsAtTestDate,
  deriveStandardAgeGroup,
  buildStandardizedAthleteTestContext,
  buildSprint10mLongitudinalProgress,
  recapitulateSprint10mRawData
} from './sprint10mNormsAnalytics.js';

import {
  saveAthleteTestResult,
  getAthleteTestResults,
  getTenantSprint10mNormsRecapitulation,
  clearTenantLocalTestBatteryStore
} from './assessmentBatteryService.js';

function createMockTenantSupabaseDb(initialRows = []) {
  const rows = [...initialRows];

  const createQueryBuilder = () => {
    const eqFilters = {};
    let isDelete = false;
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
      delete() {
        isDelete = true;
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
      maybeSingle() {
        const matched = rows.find((r) =>
          Object.entries(eqFilters).every(([k, v]) => String(r[k]) === String(v))
        );
        return Promise.resolve({ data: matched || null, error: null });
      },
      then(resolve) {
        const matched = rows.filter((r) =>
          Object.entries(eqFilters).every(([k, v]) => String(r[k]) === String(v))
        );
        if (isDelete) {
          return resolve({ data: matched, error: null });
        }
        const sorted = [...matched].sort((a, b) => {
          const d = String(b.test_date || '').localeCompare(String(a.test_date || ''));
          if (d !== 0) return d;
          return String(b.created_at || '').localeCompare(String(a.created_at || ''));
        });
        return resolve({ data: sorted, error: null });
      }
    };
    return builder;
  };

  return {
    rows,
    client: {
      from(tableName) {
        assert.equal(tableName, 'athlete_test_results');
        return createQueryBuilder();
      }
    }
  };
}

test('Task 03.3 (1): Standarisasi Protokol TST-SPR-10M mencakup 8 komponen wajib & tidak mengubah 17 tes lain', () => {
  const spr10m = getTestDefinitionById('TST-SPR-10M');
  assert.ok(spr10m);
  assert.equal(spr10m.indicatorId, 'FTB-UNI-PHY-01');
  assert.equal(spr10m.requiresMeasurementMethod, true);
  assert.deepEqual(spr10m.supportedMeasurementMethods, [
    SPRINT_MEASUREMENT_METHODS.STOPWATCH_MANUAL,
    SPRINT_MEASUREMENT_METHODS.SMARTPHONE_VIDEO
  ]);

  const proto = spr10m.standardizedProtocol;
  assert.ok(proto);
  assert.ok(proto.trackPreparation.includes('10,00 meter'));
  assert.ok(proto.startFinishPlacement.includes('0,00 m'));
  assert.ok(proto.startingStance.includes('Standing Split-Stance'));
  assert.ok(proto.startCommand.includes('SIAP'));
  assert.ok(proto.timeRecordingRules.STOPWATCH_MANUAL);
  assert.ok(proto.timeRecordingRules.SMARTPHONE_VIDEO);
  assert.ok(proto.trialsRule.includes('2 percobaan'));
  assert.ok(proto.finalResultDetermination.includes('MIN'));
  assert.equal( Array.isArray(proto.invalidOrRepeatConditions), true);
  assert.equal(proto.invalidOrRepeatConditions.length >= 4, true);

  // Pastikan ke-17 tes lainnya tetap utuh dan tidak mewajibkan measurementMethod sprint
  const other17 = FOOTBALL_TEST_BATTERY_CATALOG.filter((t) => t.testId !== 'TST-SPR-10M');
  assert.equal(other17.length, 17);
  other17.forEach((t) => {
    assert.equal(Boolean(t.requiresMeasurementMethod), false);
  });
});

test('Task 03.3 (2): Validasi metode pengukuran (STOPWATCH_MANUAL vs SMARTPHONE_VIDEO) & konsistensi pencatatan percobaan', () => {
  assert.ok(SPRINT_MEASUREMENT_METHOD_SPECS.STOPWATCH_MANUAL);
  assert.ok(SPRINT_MEASUREMENT_METHOD_SPECS.SMARTPHONE_VIDEO);

  const initialDraft = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-12');
  assert.equal(initialDraft.measurementMethod, 'STOPWATCH_MANUAL');

  // Valid dengan STOPWATCH_MANUAL
  const validStopwatch = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    measurementMethod: 'STOPWATCH_MANUAL',
    trials: [
      { trialNumber: 1, rawInput: '2.14', isValid: true },
      { trialNumber: 2, rawInput: '2.08', isValid: true }
    ]
  });
  assert.equal(validStopwatch.isValid, true);
  assert.equal(validStopwatch.normalizedRecord.measurementMethod, 'STOPWATCH_MANUAL');
  assert.equal(validStopwatch.normalizedRecord.finalRawValue, 2.08);
  assert.equal(validStopwatch.normalizedRecord.trials.length, 2);

  // Valid dengan SMARTPHONE_VIDEO
  const validVideo = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    measurementMethod: 'SMARTPHONE_VIDEO',
    trials: [
      { trialNumber: 1, rawInput: '2.21', isValid: true },
      { trialNumber: 2, rawInput: '2.16', isValid: true }
    ]
  });
  assert.equal(validVideo.isValid, true);
  assert.equal(validVideo.normalizedRecord.measurementMethod, 'SMARTPHONE_VIDEO');
  assert.equal(validVideo.normalizedRecord.finalRawValue, 2.16);

  // Menolak metode pengukuran kosong ('') atau null atau tidak didukung ('LASER_GATE')
  const emptyMethod = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    measurementMethod: '',
    trials: [
      { trialNumber: 1, rawInput: '2.10', isValid: true },
      { trialNumber: 2, rawInput: '2.05', isValid: true }
    ]
  });
  assert.equal(emptyMethod.isValid, false);
  assert.ok(emptyMethod.fieldErrors.measurementMethod);

  const unsupportedMethod = validateAndComputeTestBatteryEntry({
    testId: 'TST-SPR-10M',
    testDate: '2026-11-12',
    unit: 's',
    measurementMethod: 'LASER_TIMING_GATE',
    trials: [
      { trialNumber: 1, rawInput: '2.10', isValid: true },
      { trialNumber: 2, rawInput: '2.05', isValid: true }
    ]
  });
  assert.equal(unsupportedMethod.isValid, false);
  assert.ok(unsupportedMethod.fieldErrors.measurementMethod);
});

test('Task 03.3 (3): Konteks atlet lengkap (studentId, tenantId, tanggal lahir/kelompok usia, tier, posisi, tanggal, metode, trials, hasil akhir, pencatat)', async () => {
  const ageAtTest = computeAgeYearsAtTestDate('2015-05-10', '2026-11-12');
  assert.equal(ageAtTest, 11);

  const derivedGroup = deriveStandardAgeGroup({
    birthDate: '2015-05-10',
    testDate: '2026-11-12',
    developmentTier: 'TIER_2_FOUNDATION'
  });
  assert.equal(derivedGroup, 'U-12');

  const mockDb = createMockTenantSupabaseDb();
  const coachAuth = {
    uid: 'coach-user-101',
    id: 'coach-user-101',
    tenantId: 'tenant-ssb-garuda',
    role: 'coach',
    fullName: 'Coach Bima Sakti',
    coachId: 'coach-profile-88',
    isDemoMode: false
  };

  const savedRecord = await saveAthleteTestResult(
    coachAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-11-12',
      unit: 's',
      measurementMethod: 'SMARTPHONE_VIDEO',
      studentId: 'stu-garuda-09',
      studentBirthDate: '2015-05-10',
      developmentTier: 'TIER_2_FOUNDATION',
      positionCode: 'WFR/WFL',
      trials: [
        { trialNumber: 1, rawInput: '2.18', isValid: true },
        { trialNumber: 2, rawInput: '2.11', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  assert.equal(savedRecord.studentId, 'stu-garuda-09');
  assert.equal(savedRecord.tenantId, 'tenant-ssb-garuda');
  assert.equal(savedRecord.studentBirthDate, '2015-05-10');
  assert.equal(savedRecord.ageYearsAtTest, 11);
  assert.equal(savedRecord.ageGroup, 'U-12');
  assert.equal(savedRecord.developmentTier, 'TIER_2_FOUNDATION');
  assert.equal(savedRecord.positionCode, 'WFR/WFL');
  assert.equal(savedRecord.testDate, '2026-11-12');
  assert.equal(savedRecord.testPeriod, '2026-11');
  assert.equal(savedRecord.measurementMethod, 'SMARTPHONE_VIDEO');
  assert.equal(savedRecord.trials.length, 2);
  assert.equal(savedRecord.finalRawValue, 2.11);
  assert.equal(savedRecord.recordedByUserId, 'coach-user-101');
  assert.equal(savedRecord.recordedByName, 'Coach Bima Sakti');
  assert.equal(savedRecord.coachId, 'coach-profile-88');
  assert.equal(savedRecord.calibrationStatus, 'PENDING_CALIBRATION');
  assert.equal(savedRecord.convertedScore, null);
});

test('Task 03.3 (4): Penyimpanan longitudinal pada tanggal berbeda tanpa menimpa & pemisahan delta antar-metode pengukuran', async () => {
  const mockDb = createMockTenantSupabaseDb();
  const coachAuth = {
    uid: 'coach-user-101',
    tenantId: 'tenant-ssb-garuda',
    role: 'coach',
    fullName: 'Coach Bima',
    isDemoMode: false
  };

  // Sesi 1 (Januari): STOPWATCH_MANUAL -> 2.15 s
  await saveAthleteTestResult(
    coachAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-01-15',
      unit: 's',
      measurementMethod: 'STOPWATCH_MANUAL',
      studentId: 'stu-garuda-01',
      studentBirthDate: '2014-03-20',
      developmentTier: 'TIER_2_FOUNDATION',
      positionCode: 'CM',
      trials: [
        { trialNumber: 1, rawInput: '2.20', isValid: true },
        { trialNumber: 2, rawInput: '2.15', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  // Sesi 2 (Maret): STOPWATCH_MANUAL -> 2.07 s (Membaik -0.08 s dibanding Sesi 1)
  await saveAthleteTestResult(
    coachAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-03-15',
      unit: 's',
      measurementMethod: 'STOPWATCH_MANUAL',
      studentId: 'stu-garuda-01',
      studentBirthDate: '2014-03-20',
      developmentTier: 'TIER_2_FOUNDATION',
      positionCode: 'CM',
      trials: [
        { trialNumber: 1, rawInput: '2.11', isValid: true },
        { trialNumber: 2, rawInput: '2.07', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  // Sesi 3 (Mei): SMARTPHONE_VIDEO -> 2.19 s (Metode berbeda! Harus menjadi BASELINE untuk SMARTPHONE_VIDEO, bukan dianggap melambat dibanding Stopwatch)
  await saveAthleteTestResult(
    coachAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-05-15',
      unit: 's',
      measurementMethod: 'SMARTPHONE_VIDEO',
      studentId: 'stu-garuda-01',
      studentBirthDate: '2014-03-20',
      developmentTier: 'TIER_2_FOUNDATION',
      positionCode: 'CM',
      trials: [
        { trialNumber: 1, rawInput: '2.24', isValid: true },
        { trialNumber: 2, rawInput: '2.19', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  // Sesi 4 (Juli): SMARTPHONE_VIDEO -> 2.12 s (Membaik -0.07 s dibanding Sesi 3 SMARTPHONE_VIDEO)
  await saveAthleteTestResult(
    coachAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-07-15',
      unit: 's',
      measurementMethod: 'SMARTPHONE_VIDEO',
      studentId: 'stu-garuda-01',
      studentBirthDate: '2014-03-20',
      developmentTier: 'TIER_2_FOUNDATION',
      positionCode: 'CM',
      trials: [
        { trialNumber: 1, rawInput: '2.16', isValid: true },
        { trialNumber: 2, rawInput: '2.12', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  // Pastikan ke-4 hasil tersimpan terpisah (tidak saling menimpa)
  const history = await getAthleteTestResults(coachAuth, 'stu-garuda-01', {
    supabaseClient: mockDb.client
  });
  assert.equal(history.length, 4);

  const longitudinal = buildSprint10mLongitudinalProgress(history);
  assert.equal(longitudinal.totalSessions, 4);
  assert.equal(longitudinal.hasMixedMethods, true);
  assert.deepEqual(longitudinal.methodsUsed.sort(), ['SMARTPHONE_VIDEO', 'STOPWATCH_MANUAL']);

  // Urutan kronologis dari paling awal ke paling baru
  assert.equal(longitudinal.entries[0].testDate, '2026-01-15');
  assert.equal(longitudinal.entries[0].measurementMethod, 'STOPWATCH_MANUAL');
  assert.equal(longitudinal.entries[0].progressionDirection, 'BASELINE');
  assert.equal(longitudinal.entries[0].deltaFromPrevSameMethodSec, null);

  assert.equal(longitudinal.entries[1].testDate, '2026-03-15');
  assert.equal(longitudinal.entries[1].measurementMethod, 'STOPWATCH_MANUAL');
  assert.equal(longitudinal.entries[1].progressionDirection, 'IMPROVED');
  assert.equal(longitudinal.entries[1].deltaFromPrevSameMethodSec, -0.08);
  assert.equal(longitudinal.entries[1].prevSameMethodDate, '2026-01-15');

  // Sesi ke-3 beralih ke SMARTPHONE_VIDEO -> tidak dibandingkan dengan Stopwatch!
  assert.equal(longitudinal.entries[2].testDate, '2026-05-15');
  assert.equal(longitudinal.entries[2].measurementMethod, 'SMARTPHONE_VIDEO');
  assert.equal(longitudinal.entries[2].progressionDirection, 'BASELINE');
  assert.equal(longitudinal.entries[2].deltaFromPrevSameMethodSec, null);

  // Sesi ke-4 SMARTPHONE_VIDEO dibandingkan dengan Sesi ke-3 SMARTPHONE_VIDEO
  assert.equal(longitudinal.entries[3].testDate, '2026-07-15');
  assert.equal(longitudinal.entries[3].measurementMethod, 'SMARTPHONE_VIDEO');
  assert.equal(longitudinal.entries[3].progressionDirection, 'IMPROVED');
  assert.equal(longitudinal.entries[3].deltaFromPrevSameMethodSec, -0.07);
  assert.equal(longitudinal.entries[3].prevSameMethodDate, '2026-05-15');
});

test('Task 03.3 (5): Rekapitulasi data mentah TST-SPR-10M berdasarkan kelompok usia, tier, metode pengukuran, tenant, dan periode tes', async () => {
  const mockDb = createMockTenantSupabaseDb();
  const tenantAAuth = {
    uid: 'admin-tenant-a',
    tenantId: 'tenant-ssb-a',
    role: 'admin',
    fullName: 'Admin SSB A',
    isDemoMode: false
  };

  // Simpan 3 sampel U-12 STOPWATCH_MANUAL pada periode 2026-11
  const stopwatchSamples = [
    { studentId: 'stu-a1', birthDate: '2015-02-01', t1: '2.10', t2: '2.04' },
    { studentId: 'stu-a2', birthDate: '2015-06-15', t1: '2.20', t2: '2.14' },
    { studentId: 'stu-a3', birthDate: '2015-09-20', t1: '2.30', t2: '2.24' }
  ];

  for (const s of stopwatchSamples) {
    await saveAthleteTestResult(
      tenantAAuth,
      {
        testId: 'TST-SPR-10M',
        testDate: '2026-11-10',
        unit: 's',
        measurementMethod: 'STOPWATCH_MANUAL',
        studentId: s.studentId,
        studentBirthDate: s.birthDate,
        developmentTier: 'TIER_2_FOUNDATION',
        positionCode: 'CM',
        trials: [
          { trialNumber: 1, rawInput: s.t1, isValid: true },
          { trialNumber: 2, rawInput: s.t2, isValid: true }
        ]
      },
      { supabaseClient: mockDb.client }
    );
  }

  // Simpan 2 sampel U-12 SMARTPHONE_VIDEO pada periode 2026-11 (harus berada di grup rekapitulasi terpisah!)
  const videoSamples = [
    { studentId: 'stu-a4', birthDate: '2015-04-11', t1: '2.18', t2: '2.12' },
    { studentId: 'stu-a5', birthDate: '2015-08-19', t1: '2.26', t2: '2.20' }
  ];

  for (const s of videoSamples) {
    await saveAthleteTestResult(
      tenantAAuth,
      {
        testId: 'TST-SPR-10M',
        testDate: '2026-11-12',
        unit: 's',
        measurementMethod: 'SMARTPHONE_VIDEO',
        studentId: s.studentId,
        studentBirthDate: s.birthDate,
        developmentTier: 'TIER_2_FOUNDATION',
        positionCode: 'ST',
        trials: [
          { trialNumber: 1, rawInput: s.t1, isValid: true },
          { trialNumber: 2, rawInput: s.t2, isValid: true }
        ]
      },
      { supabaseClient: mockDb.client }
    );
  }

  // Simpan 1 sampel U-16 (TIER_3_YOUTH_DEV) STOPWATCH_MANUAL pada periode 2026-10
  await saveAthleteTestResult(
    tenantAAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-10-05',
      unit: 's',
      measurementMethod: 'STOPWATCH_MANUAL',
      studentId: 'stu-a6',
      studentBirthDate: '2011-03-10',
      developmentTier: 'TIER_3_YOUTH_DEV',
      positionCode: 'CB',
      trials: [
        { trialNumber: 1, rawInput: '1.92', isValid: true },
        { trialNumber: 2, rawInput: '1.88', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  // Rekapitulasi seluruh data TST-SPR-10M milik tenant-ssb-a
  const fullRecap = await getTenantSprint10mNormsRecapitulation(
    tenantAAuth,
    {},
    { supabaseClient: mockDb.client }
  );

  assert.equal(fullRecap.totalMatchingRecords, 6);
  // Harus terbagi menjadi 3 grup berbeda (U-12 Stopwatch 2026-11, U-12 Video 2026-11, U-16 Stopwatch 2026-10)
  assert.equal(fullRecap.groups.length, 3);

  const u12StopwatchGroup = fullRecap.groups.find(
    (g) => g.ageGroup === 'U-12' && g.measurementMethod === 'STOPWATCH_MANUAL'
  );
  assert.ok(u12StopwatchGroup);
  assert.equal(u12StopwatchGroup.sampleCount, 3);
  assert.equal(u12StopwatchGroup.uniqueStudentCount, 3);
  assert.equal(u12StopwatchGroup.fastestRawSec, 2.04);
  assert.equal(u12StopwatchGroup.medianRawSec, 2.14);
  assert.equal(u12StopwatchGroup.meanRawSec, 2.14);
  assert.equal(u12StopwatchGroup.slowestRawSec, 2.24);
  assert.deepEqual(u12StopwatchGroup.rawValuesSec, [2.04, 2.14, 2.24]);

  const u12VideoGroup = fullRecap.groups.find(
    (g) => g.ageGroup === 'U-12' && g.measurementMethod === 'SMARTPHONE_VIDEO'
  );
  assert.ok(u12VideoGroup);
  assert.equal(u12VideoGroup.sampleCount, 2);
  assert.equal(u12VideoGroup.fastestRawSec, 2.12);
  assert.equal(u12VideoGroup.medianRawSec, 2.16);
  assert.equal(u12VideoGroup.slowestRawSec, 2.2);

  // Uji filter spesifik berdasarkan metode pengukuran & periode
  const filteredVideoOnly = await getTenantSprint10mNormsRecapitulation(
    tenantAAuth,
    { measurementMethod: 'SMARTPHONE_VIDEO', testPeriod: '2026-11' },
    { supabaseClient: mockDb.client }
  );
  assert.equal(filteredVideoOnly.totalMatchingRecords, 2);
  assert.equal(filteredVideoOnly.groups.length, 1);
  assert.equal(filteredVideoOnly.groups[0].measurementMethod, 'SMARTPHONE_VIDEO');
});

test('Task 03.3 (6): Isolasi multi-tenant pada rekapitulasi norma & riwayat longitudinal', async () => {
  clearTenantLocalTestBatteryStore();
  const mockDb = createMockTenantSupabaseDb();

  const tenantAAuth = {
    uid: 'coach-a',
    tenantId: 'tenant-ssb-alpha',
    role: 'coach',
    fullName: 'Coach Alpha',
    isDemoMode: false
  };

  const tenantBAuth = {
    uid: 'coach-b',
    tenantId: 'tenant-ssb-beta',
    role: 'coach',
    fullName: 'Coach Beta',
    isDemoMode: false
  };

  await saveAthleteTestResult(
    tenantAAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-11-12',
      unit: 's',
      measurementMethod: 'STOPWATCH_MANUAL',
      studentId: 'stu-alpha-1',
      studentBirthDate: '2014-01-10',
      developmentTier: 'TIER_2_FOUNDATION',
      positionCode: 'CM',
      trials: [
        { trialNumber: 1, rawInput: '2.09', isValid: true },
        { trialNumber: 2, rawInput: '2.05', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  await saveAthleteTestResult(
    tenantBAuth,
    {
      testId: 'TST-SPR-10M',
      testDate: '2026-11-12',
      unit: 's',
      measurementMethod: 'SMARTPHONE_VIDEO',
      studentId: 'stu-beta-1',
      studentBirthDate: '2014-01-10',
      developmentTier: 'TIER_2_FOUNDATION',
      positionCode: 'CM',
      trials: [
        { trialNumber: 1, rawInput: '2.25', isValid: true },
        { trialNumber: 2, rawInput: '2.19', isValid: true }
      ]
    },
    { supabaseClient: mockDb.client }
  );

  // Tenant Alpha hanya melihat sampel miliknya sendiri
  const alphaRecap = await getTenantSprint10mNormsRecapitulation(
    tenantAAuth,
    {},
    { supabaseClient: mockDb.client }
  );
  assert.equal(alphaRecap.totalMatchingRecords, 1);
  assert.equal(alphaRecap.groups[0].tenantId, 'tenant-ssb-alpha');
  assert.equal(alphaRecap.groups[0].fastestRawSec, 2.05);

  // Tenant Alpha ditolak (42501) jika mencoba meminta rekapitulasi milik Tenant Beta
  await assert.rejects(
    async () => {
      await getTenantSprint10mNormsRecapitulation(
        tenantAAuth,
        { tenantId: 'tenant-ssb-beta' },
        { supabaseClient: mockDb.client }
      );
    },
    (err) => err.code === '42501'
  );

  // Fungsi murni recapitulateSprint10mRawData juga memfilter ketat expectedTenantId jika diberikan array campuran
  const mixedRecords = mockDb.rows.map((r) => ({
    ...r,
    tenantId: r.tenant_id,
    testId: r.test_id,
    finalRawValue: r.final_raw_value
  }));
  const pureIsolated = recapitulateSprint10mRawData(mixedRecords, {
    expectedTenantId: 'tenant-ssb-beta'
  });
  assert.equal(pureIsolated.totalMatchingRecords, 1);
  assert.equal(pureIsolated.groups[0].tenantId, 'tenant-ssb-beta');
});
