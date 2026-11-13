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
  clearTenantLocalTestBatteryStore,
  isExplicitDemoSession
} from '../services/assessmentBatteryService.js';

/**
 * Helper pembuat mock Supabase client yang mensimulasikan tabel PostgreSQL
 * public.athlete_test_results beserta pemeriksaan tenant_id di level query.
 */
function createStatefulSupabaseStub({ simulateError = null } = {}) {
  const rows = [];
  let idSeq = 1;

  const buildChain = (contextTenantId) => {
    const filters = {};
    let op = 'select';
    let insertPayload = null;

    const chain = {
      select() {
        if (op !== 'insert' && op !== 'delete') op = 'select';
        return chain;
      },
      insert(payloadArr) {
        op = 'insert';
        insertPayload = Array.isArray(payloadArr) ? payloadArr[0] : payloadArr;
        return chain;
      },
      delete() {
        op = 'delete';
        return chain;
      },
      eq(col, val) {
        filters[col] = val;
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      async single() {
        if (simulateError) {
          return { data: null, error: simulateError };
        }
        if (op === 'insert') {
          if (contextTenantId && insertPayload.tenant_id !== contextTenantId) {
            return {
              data: null,
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "athlete_test_results"'
              }
            };
          }
          const created = {
            id: `00000000-0000-4000-8000-${String(idSeq++).padStart(12, '0')}`,
            ...insertPayload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          rows.push(created);
          return { data: created, error: null };
        }
        return { data: null, error: null };
      },
      async maybeSingle() {
        if (simulateError) {
          return { data: null, error: simulateError };
        }
        if (op === 'delete') {
          const idx = rows.findIndex((r) => {
            if (contextTenantId && r.tenant_id !== contextTenantId) return false;
            return Object.entries(filters).every(([k, v]) => String(r[k]) === String(v));
          });
          if (idx === -1) return { data: null, error: null };
          const [removed] = rows.splice(idx, 1);
          return { data: { id: removed.id }, error: null };
        }
        return { data: null, error: null };
      },
      then(resolve, reject) {
        if (simulateError) {
          return Promise.resolve({ data: null, error: simulateError }).then(resolve, reject);
        }
        const matched = rows
          .filter((r) => {
            if (contextTenantId && r.tenant_id !== contextTenantId) return false;
            return Object.entries(filters).every(([k, v]) => String(r[k]) === String(v));
          })
          .sort((a, b) => String(b.test_date).localeCompare(String(a.test_date)));
        return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
      }
    };

    return chain;
  };

  return {
    rows,
    forTenant(tenantId) {
      return {
        from(tableName) {
          assert.equal(tableName, 'athlete_test_results');
          return buildChain(tenantId);
        }
      };
    }
  };
}

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

  const shotTest = getTestDefinitionByIndicatorId('FTB-UNI-TEC-07');
  assert.equal(shotTest.mappingReadiness, 'NEEDS_FURTHER_DESIGN');
});

test('Applicability Filter: Menyaring kesesuaian tes berdasarkan Development Tier dan Posisi Atlet', () => {
  const ssbGkTest = getTestDefinitionByIndicatorId('FTB-SSB-GK-02');
  const wingTest = getTestDefinitionByIndicatorId('FTB-POS-WF-01');
  const rsaTest = getTestDefinitionByIndicatorId('FTB-UNI-PHY-14');

  assert.equal(isTestApplicableToAthlete(ssbGkTest, 'TIER_1_GRASSROOTS', 'GK').isApplicable, true);
  assert.equal(isTestApplicableToAthlete(ssbGkTest, 'TIER_1_GRASSROOTS', 'CM').isApplicable, false);

  assert.equal(isTestApplicableToAthlete(wingTest, 'TIER_3_YOUTH_DEV', 'WFR').isApplicable, true);
  assert.equal(isTestApplicableToAthlete(wingTest, 'TIER_3_YOUTH_DEV', 'CB').isApplicable, false);

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
  assert.equal(sprintValid.normalizedRecord.trials[0].rawInput, '2.18');
  assert.equal(sprintValid.normalizedRecord.trials[1].rawInput, '2.06');

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

test('Specialized Test Schemas: Ruler Drop (3x), Sargent Vertical Jump (H2-H1), Bleep Test, dan 6x30m RSA', () => {
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
  assert.equal(rulerDrop.normalizedRecord.derivedMetrics.estimatedReactionTimeMs, 180.7);

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

  const bleepCalc = computeBleepCumulativeMetrics(8, 5);
  assert.equal(bleepCalc.isValid, true);
  assert.equal(bleepCalc.cumulativeShuttles, 66);
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
  assert.equal(rsaComplete.normalizedRecord.finalRawValue, 27.18);
  assert.equal(rsaComplete.normalizedRecord.derivedMetrics.bestSprintTimeSec, 4.4);
  assert.equal(rsaComplete.normalizedRecord.derivedMetrics.fatigueIndexPercent, 2.95);
});

test('Task 03.1 (1 & 2): Real Tenant Database Persistence & Read-Back via Supabase Tanpa Mutasi Diam-diam', async () => {
  const dbStub = createStatefulSupabaseStub();
  const realTenantCoach = {
    tenantId: 'ssb-garuda-muda-a',
    id: '00000000-0000-4000-8000-000000000901',
    role: 'pelatih',
    fullName: 'Coach Hendra'
  };

  assert.equal(isExplicitDemoSession(realTenantCoach), false);

  const draft = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-12');
  draft.trials[0].rawInput = '2.15';
  draft.trials[1].rawInput = '2.03';

  const studentUuid = '00000000-0000-4000-8000-000000000501';

  const saved = await saveAthleteTestResult(
    realTenantCoach,
    {
      ...draft,
      studentId: studentUuid,
      studentTenantId: 'ssb-garuda-muda-a',
      developmentTier: 'TIER_3_YOUTH_DEV',
      positionCode: 'WFR'
    },
    { supabaseClient: dbStub.forTenant('ssb-garuda-muda-a') }
  );

  assert.equal(saved.persistenceSource, 'SUPABASE_DB');
  assert.equal(saved.tenantId, 'ssb-garuda-muda-a');
  assert.equal(saved.studentId, studentUuid);
  assert.equal(saved.finalRawValue, 2.03);
  assert.equal(saved.calibrationStatus, 'PENDING_CALIBRATION');
  assert.equal(saved.convertedScore, null);
  assert.equal(saved.trials[0].rawInput, '2.15');
  assert.equal(saved.trials[1].rawInput, '2.03');

  // Pembacaan kembali riwayat dari database (tanpa bergantung pada browser asal)
  const historyFromDb = await getAthleteTestResults(realTenantCoach, studentUuid, {
    supabaseClient: dbStub.forTenant('ssb-garuda-muda-a')
  });
  assert.equal(historyFromDb.length, 1);
  assert.equal(historyFromDb[0].id, saved.id);
  assert.equal(historyFromDb[0].persistenceSource, 'SUPABASE_DB');
  assert.equal(historyFromDb[0].trials[0].rawInput, '2.15');
  assert.equal(historyFromDb[0].trials[1].rawInput, '2.03');

  const latestMap = await getLatestTestResultsByIndicatorMap(realTenantCoach, studentUuid, {
    supabaseClient: dbStub.forTenant('ssb-garuda-muda-a')
  });
  assert.ok(latestMap['FTB-UNI-PHY-01']);
  assert.equal(latestMap['FTB-UNI-PHY-01'].finalRawValue, 2.03);
});

test('Task 03.1 (3): Kegagalan Database pada Tenant Riil Melempar Error Jelas dan TIDAK Dialihkan ke localStorage', async () => {
  const realTenantOwner = {
    tenantId: 'ssb-garuda-muda-a',
    id: '00000000-0000-4000-8000-000000000902',
    role: 'owner',
    fullName: 'Owner Garuda'
  };
  const studentUuid = '00000000-0000-4000-8000-000000000501';

  const draft = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-12');
  draft.trials[0].rawInput = '2.11';
  draft.trials[1].rawInput = '2.01';

  // Simulasikan tabel belum dimigrasikan (42P01)
  const unmigratedDbStub = createStatefulSupabaseStub({
    simulateError: {
      code: '42P01',
      message: 'relation "public.athlete_test_results" does not exist'
    }
  });

  await assert.rejects(
    async () => {
      await saveAthleteTestResult(
        realTenantOwner,
        {
          ...draft,
          studentId: studentUuid,
          studentTenantId: 'ssb-garuda-muda-a'
        },
        { supabaseClient: unmigratedDbStub.forTenant('ssb-garuda-muda-a') }
      );
    },
    (err) => {
      assert.equal(err.code, '42P01');
      assert.equal(err.isPersistenceFailure, true);
      assert.ok(err.message.includes('Data TIDAK disimpan'));
      assert.ok(err.message.includes('phase_task03_athlete_test_battery_migration.sql'));
      return true;
    }
  );

  // Pembacaan riwayat saat tabel belum tersedia pada tenant riil juga harus melempar error jelas (bukan kembali array kosong diam-diam atau baca localStorage)
  await assert.rejects(
    async () => {
      await getAthleteTestResults(realTenantOwner, studentUuid, {
        supabaseClient: unmigratedDbStub.forTenant('ssb-garuda-muda-a')
      });
    },
    (err) => {
      assert.equal(err.code, '42P01');
      assert.equal(err.isPersistenceFailure, true);
      return true;
    }
  );
});

test('Task 03.1 (4): Pemisahan Ketat Mode Pratinjau Demo dari Mode Tenant Riil', async () => {
  const demoSession = {
    tenantId: 'demo-tenant-1',
    uid: 'demo-tenant-admin',
    role: 'owner',
    isDemoMode: true,
    fullName: 'Coach Demo SSB'
  };
  const realSessionWithoutDemoFlag = {
    tenantId: 'demo-tenant-1',
    uid: 'real-uid-without-demo-flag',
    role: 'owner'
  };
  const realTenantSession = {
    tenantId: 'ssb-real-tenant-01',
    uid: 'real-owner-01',
    role: 'owner',
    isDemoMode: true // Bahkan jika isDemoMode dipalsukan pada tenant riil, tetap harus ditolak dari localStorage!
  };

  assert.equal(isExplicitDemoSession(demoSession), true);
  assert.equal(isExplicitDemoSession(realSessionWithoutDemoFlag), false);
  assert.equal(isExplicitDemoSession(realTenantSession), false);

  clearTenantLocalTestBatteryStore('demo-tenant-1');

  const draft = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-12');
  draft.trials[0].rawInput = '2.20';
  draft.trials[1].rawInput = '2.09';

  const savedDemo = await saveAthleteTestResult(demoSession, {
    ...draft,
    studentId: '00000000-0000-4000-8000-000000000401',
    studentTenantId: 'demo-tenant-1'
  });
  assert.equal(savedDemo.persistenceSource, 'DEMO_LOCAL_STORAGE');

  const demoHistory = await getAthleteTestResults(
    demoSession,
    '00000000-0000-4000-8000-000000000401'
  );
  assert.equal(demoHistory.length, 1);

  // Tenant riil dengan database kosong tidak boleh pernah melihat data demo
  const emptyRealDb = createStatefulSupabaseStub();
  const realHistory = await getAthleteTestResults(
    realTenantSession,
    '00000000-0000-4000-8000-000000000401',
    { supabaseClient: emptyRealDb.forTenant('ssb-real-tenant-01') }
  );
  assert.equal(realHistory.length, 0);
});

test('Task 03.1 (5): Keamanan Multi-Tenant, Scope Pelatih, Hak Akses Role, dan Blokir Operasional Superadmin', async () => {
  const dbStub = createStatefulSupabaseStub();
  const tenantA = {
    tenantId: 'ssb-garuda-muda-a',
    id: '00000000-0000-4000-8000-000000000901',
    role: 'owner',
    fullName: 'Owner A'
  };
  const tenantB = {
    tenantId: 'ssb-bintang-timur-b',
    id: '00000000-0000-4000-8000-000000000902',
    role: 'owner',
    fullName: 'Owner B'
  };
  const studentA = '00000000-0000-4000-8000-000000000501';

  const draft = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-12');
  draft.trials[0].rawInput = '2.12';
  draft.trials[1].rawInput = '2.04';

  const savedA = await saveAthleteTestResult(
    tenantA,
    {
      ...draft,
      studentId: studentA,
      studentTenantId: 'ssb-garuda-muda-a'
    },
    { supabaseClient: dbStub.forTenant('ssb-garuda-muda-a') }
  );

  // 1. Tenant B tidak dapat membaca data Tenant A
  const historyFromB = await getAthleteTestResults(tenantB, studentA, {
    supabaseClient: dbStub.forTenant('ssb-bintang-timur-b')
  });
  assert.equal(historyFromB.length, 0);

  // 2. Tenant B mencoba memalsukan tenantId payload menjadi milik Tenant A -> ditolak 42501
  await assert.rejects(
    async () => {
      await saveAthleteTestResult(
        tenantB,
        {
          ...draft,
          tenantId: 'ssb-garuda-muda-a',
          studentId: studentA
        },
        { supabaseClient: dbStub.forTenant('ssb-bintang-timur-b') }
      );
    },
    (err) => err.code === '42501'
  );

  // 3. Tenant B mencoba menyimpan untuk atlet yang terdaftar di Tenant A -> ditolak 42501
  await assert.rejects(
    async () => {
      await saveAthleteTestResult(
        tenantB,
        {
          ...draft,
          studentId: studentA,
          studentTenantId: 'ssb-garuda-muda-a'
        },
        { supabaseClient: dbStub.forTenant('ssb-bintang-timur-b') }
      );
    },
    (err) => err.code === '42501'
  );

  // 4. Pelatih dengan scope terbatas pada kelas X mencoba menyimpan untuk atlet di kelas Y -> ditolak 42501
  const scopedCoach = {
    tenantId: 'ssb-garuda-muda-a',
    id: '00000000-0000-4000-8000-000000000905',
    role: 'pelatih',
    allowedClassIds: ['00000000-0000-4000-8000-000000000201']
  };
  await assert.rejects(
    async () => {
      await saveAthleteTestResult(
        scopedCoach,
        {
          ...draft,
          studentId: studentA,
          classId: '00000000-0000-4000-8000-000000000299'
        },
        { supabaseClient: dbStub.forTenant('ssb-garuda-muda-a') }
      );
    },
    (err) => err.code === '42501'
  );

  // 5. Role 'kasir' tidak diizinkan menyimpan atau menghapus hasil tes -> ditolak 42501
  const cashierUser = {
    tenantId: 'ssb-garuda-muda-a',
    id: '00000000-0000-4000-8000-000000000906',
    role: 'kasir'
  };
  await assert.rejects(
    async () => {
      await saveAthleteTestResult(
        cashierUser,
        {
          ...draft,
          studentId: studentA
        },
        { supabaseClient: dbStub.forTenant('ssb-garuda-muda-a') }
      );
    },
    (err) => err.code === '42501'
  );

  // 6. Akun Superadmin / Platform Owner ditolak dari fitur operasional Assessment Battery -> ditolak 42501
  const superAdminUser = {
    tenantId: 'ssb-garuda-muda-a',
    id: '00000000-0000-4000-8000-000000000999',
    role: 'superadmin',
    isSuperAdmin: true
  };
  await assert.rejects(
    async () => {
      await getAthleteTestResults(superAdminUser, studentA, {
        supabaseClient: dbStub.forTenant('ssb-garuda-muda-a')
      });
    },
    (err) => err.code === '42501'
  );
  await assert.rejects(
    async () => {
      await saveAthleteTestResult(
        superAdminUser,
        {
          ...draft,
          studentId: studentA
        },
        { supabaseClient: dbStub.forTenant('ssb-garuda-muda-a') }
      );
    },
    (err) => err.code === '42501'
  );

  // 7. Tenant B tidak dapat menghapus data milik Tenant A -> ditolak 42501 & data Tenant A tetap utuh
  await assert.rejects(
    async () => {
      await deleteAthleteTestResult(tenantB, savedA.id, {
        supabaseClient: dbStub.forTenant('ssb-bintang-timur-b')
      });
    },
    (err) => err.code === '42501'
  );

  const historyAfterFailedDelete = await getAthleteTestResults(tenantA, studentA, {
    supabaseClient: dbStub.forTenant('ssb-garuda-muda-a')
  });
  assert.equal(historyAfterFailedDelete.length, 1);
});

test('Task 03.1 (6): Verifikasi Integrasi terhadap Instance Supabase Aktual (Tanpa Klaim Palsu / Tanpa Fallback LocalStorage)', async () => {
  const realTenantProbeContext = {
    tenantId: 'ssb-probe-verification-tenant',
    id: '00000000-0000-4000-8000-000000000888',
    role: 'owner'
  };
  const probeStudentUuid = '00000000-0000-4000-8000-000000000777';

  // Panggil dengan default Supabase client (mengarah ke instance Supabase yang dikonfigurasi di src/config/supabase.js)
  let caughtError = null;
  let returnedRows = null;
  try {
    returnedRows = await getAthleteTestResults(realTenantProbeContext, probeStudentUuid);
  } catch (err) {
    caughtError = err;
  }

  // Jika tabel belum dimigrasikan di Supabase remote (PGRST205 / 42P01) atau ditolak RLS tanpa sesi JWT,
  // service wajib melempar error eksplisit (isPersistenceFailure: true) dan TIDAK boleh diam-diam kembali ke localStorage.
  if (caughtError) {
    assert.equal(caughtError.isPersistenceFailure, true);
    assert.ok(
      caughtError.message.includes('Data TIDAK disimpan') ||
        caughtError.message.includes('gagal diproses pada database Supabase')
    );
  } else {
    assert.ok(Array.isArray(returnedRows));
  }
});
