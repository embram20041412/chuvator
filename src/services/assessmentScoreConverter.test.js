import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SCORE_CALIBRATION_CONFIG,
  CALIBRATION_AGE_GROUPS,
  CALIBRATION_DEVELOPMENT_TIERS,
  SCORE_CALIBRATION_STATUS,
  createCalibrationConfigWithNorms,
  validateSprint10mCalibrationParams,
  resolveSprint10mCalibrationNorm,
  convertSprint10mRawToScore,
  convertTestResultToIndicatorScore,
  recalculateRecordScoreWithCalibration
} from './assessmentScoreConverter.js';

import { createInitialTestEntryDraft } from '../utils/testBatteryValidator.js';
import {
  saveAthleteTestResult,
  getAthleteTestResults,
  getLatestTestResultsByIndicatorMap
} from './assessmentBatteryService.js';

/**
 * Helper stub database Supabase berstatus (stateful) untuk menguji integrasi
 * penyimpanan `final_raw_value`, `converted_score`, dan `calibration_status`
 * serta isolasi antar-tenant.
 */
function createStatefulSupabaseStub() {
  const rows = [];
  let seq = 1;

  const buildChain = (sessionTenantId) => {
    const filters = {};
    let op = 'select';
    let insertPayload = null;

    const chain = {
      select() {
        if (op !== 'insert') op = 'select';
        return chain;
      },
      insert(arr) {
        op = 'insert';
        insertPayload = Array.isArray(arr) ? arr[0] : arr;
        return chain;
      },
      eq(col, val) {
        filters[col] = val;
        return chain;
      },
      order() {
        return chain;
      },
      async single() {
        if (op === 'insert') {
          if (sessionTenantId && insertPayload.tenant_id !== sessionTenantId) {
            return {
              data: null,
              error: { code: '42501', message: 'RLS violation on athlete_test_results' }
            };
          }
          const savedRow = {
            id: `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`,
            ...insertPayload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          rows.push(savedRow);
          return { data: savedRow, error: null };
        }
        return { data: null, error: null };
      },
      then(resolve, reject) {
        const matched = rows
          .filter((r) => {
            if (sessionTenantId && r.tenant_id !== sessionTenantId) return false;
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
        from(table) {
          assert.equal(table, 'athlete_test_results');
          return buildChain(tenantId);
        }
      };
    }
  };
}

test('Task 03.2 (1): Default Calibration Config bebas norma fiktif dan menghasilkan PENDING_CALIBRATION (convertedScore = null)', () => {
  const sprintCfg = DEFAULT_SCORE_CALIBRATION_CONFIG.tests['TST-SPR-10M'];
  assert.ok(sprintCfg, 'Konfigurasi TST-SPR-10M harus tersedia');
  assert.equal(sprintCfg.indicatorId, 'FTB-UNI-PHY-01');
  assert.equal(sprintCfg.unit, 's');
  assert.equal(sprintCfg.direction, 'LOWER_IS_BETTER');

  // Pastikan seluruh kelompok usia (U8..SENIOR) memiliki struktur namun TIDAK berisi angka fiktif
  for (const ageKey of CALIBRATION_AGE_GROUPS) {
    const slot = sprintCfg.byAgeGroup[ageKey];
    assert.ok(slot, `Slot kelompok usia ${ageKey} harus terdefinisi`);
    assert.equal(slot.isCalibrated, false);
    assert.equal(slot.tEliteSec, null);
    assert.equal(slot.tBaseSec, null);
  }

  // Pastikan seluruh Development Tier (Tier 1..4) memiliki struktur namun TIDAK berisi angka fiktif
  for (const tierKey of CALIBRATION_DEVELOPMENT_TIERS) {
    const slot = sprintCfg.byDevelopmentTier[tierKey];
    assert.ok(slot, `Slot tier ${tierKey} harus terdefinisi`);
    assert.equal(slot.isCalibrated, false);
    assert.equal(slot.tEliteSec, null);
    assert.equal(slot.tBaseSec, null);
  }

  // Jalankan converter dengan konfigurasi default (belum ada norma) -> wajib PENDING_CALIBRATION & convertedScore = null
  const uncalibratedResult = convertSprint10mRawToScore(2.04, {
    ageGroup: 'U14',
    developmentTier: 'TIER_3_YOUTH_DEV'
  });

  assert.equal(uncalibratedResult.isValidInput, true);
  assert.equal(uncalibratedResult.isSupportedTest, true);
  assert.equal(uncalibratedResult.isCalibrated, false);
  assert.equal(uncalibratedResult.finalRawValue, 2.04);
  assert.equal(uncalibratedResult.calibrationStatus, SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION);
  assert.equal(uncalibratedResult.convertedScore, null);
  assert.equal(uncalibratedResult.unroundedScore, null);
});

test('Task 03.2 (2): Waktu lebih cepat menghasilkan skor lebih tinggi & waktu lebih lambat menghasilkan skor lebih rendah saat kalibrasi tersedia', () => {
  // Buat konfigurasi kalibrasi uji eksplisit untuk U14 (mis. tEliteSec = 1.75s, tBaseSec = 2.74s; rentang = 0.99s)
  const customCalibrationCfg = createCalibrationConfigWithNorms({
    byAgeGroup: {
      U14: {
        tEliteSec: 1.75,
        tBaseSec: 2.74,
        timingMethod: 'SMARTPHONE_VIDEO_60FPS',
        normSource: 'Test Verification Parameter Set'
      }
    }
  });

  // 1. Batas elite (<= 1.75s) -> Skor 100
  const atElite = convertSprint10mRawToScore(1.75, { ageGroup: 'U14' }, customCalibrationCfg);
  const fasterThanElite = convertSprint10mRawToScore(1.68, { ageGroup: 'U14' }, customCalibrationCfg);
  assert.equal(atElite.calibrationStatus, SCORE_CALIBRATION_STATUS.CALIBRATED);
  assert.equal(atElite.convertedScore, 100);
  assert.equal(fasterThanElite.convertedScore, 100);
  assert.equal(fasterThanElite.finalRawValue, 1.68); // Fakta mentah tetap 1.68, tidak di-clamp ke 1.75!

  // 2. Batas bawah (>= 2.74s) -> Skor 1
  const atBase = convertSprint10mRawToScore(2.74, { ageGroup: 'U14' }, customCalibrationCfg);
  const slowerThanBase = convertSprint10mRawToScore(2.95, { ageGroup: 'U14' }, customCalibrationCfg);
  assert.equal(atBase.convertedScore, 1);
  assert.equal(slowerThanBase.convertedScore, 1);
  assert.equal(slowerThanBase.finalRawValue, 2.95); // Fakta mentah tetap 2.95!

  // 3. Monotonisitas ketat: Waktu lebih cepat -> skor lebih tinggi; waktu lebih lambat -> skor lebih rendah
  const fastTime = convertSprint10mRawToScore(1.90, { ageGroup: 'U14' }, customCalibrationCfg);
  const mediumTime = convertSprint10mRawToScore(2.15, { ageGroup: 'U14' }, customCalibrationCfg);
  const slowTime = convertSprint10mRawToScore(2.45, { ageGroup: 'U14' }, customCalibrationCfg);

  assert.ok(
    fastTime.convertedScore > mediumTime.convertedScore,
    `Waktu cepat 1.90s (${fastTime.convertedScore}) harus memiliki skor lebih tinggi dari 2.15s (${mediumTime.convertedScore})`
  );
  assert.ok(
    mediumTime.convertedScore > slowTime.convertedScore,
    `Waktu menengah 2.15s (${mediumTime.convertedScore}) harus memiliki skor lebih tinggi dari 2.45s (${slowTime.convertedScore})`
  );

  // Verifikasi akurasi rumus matematika:
  // Untuk T = 1.95s dengan tElite=1.75, tBase=2.74 (selisih = 0.99):
  // 100 - ((1.95 - 1.75) / 0.99) * 99 = 100 - (0.20 / 0.99) * 99 = 100 - 20 = 80
  const exactCheck = convertSprint10mRawToScore(1.95, { ageGroup: 'U14' }, customCalibrationCfg);
  assert.equal(exactCheck.convertedScore, 80);
  assert.equal(exactCheck.unroundedScore, 80);
});

test('Task 03.2 (3): Nilai mentah tidak pernah berubah & konversi bersifat deterministik', () => {
  const customCalibrationCfg = createCalibrationConfigWithNorms({
    byDevelopmentTier: {
      TIER_3_YOUTH_DEV: {
        tEliteSec: 1.80,
        tBaseSec: 2.60,
        normSource: 'Tier 3 Verification Parameter'
      }
    }
  });

  const inputRecord = Object.freeze({
    testId: 'TST-SPR-10M',
    indicatorId: 'FTB-UNI-PHY-01',
    finalRawValue: 2.05,
    finalUnit: 's',
    developmentTier: 'TIER_3_YOUTH_DEV',
    trials: Object.freeze([
      Object.freeze({ trialNumber: 1, rawInput: '2.14', numericValue: 2.14, isValid: true }),
      Object.freeze({ trialNumber: 2, rawInput: '2.05', numericValue: 2.05, isValid: true })
    ])
  });

  // Panggil berulang kali untuk membuktikan determinisme & tidak adanya mutasi pada objek yang di-freeze
  const run1 = convertTestResultToIndicatorScore(inputRecord, {
    calibrationConfig: customCalibrationCfg
  });
  const run2 = convertTestResultToIndicatorScore(inputRecord, {
    calibrationConfig: customCalibrationCfg
  });
  const run3 = convertTestResultToIndicatorScore(inputRecord, {
    calibrationConfig: customCalibrationCfg
  });

  assert.deepEqual(run1, run2);
  assert.deepEqual(run2, run3);
  assert.equal(run1.finalRawValue, 2.05);
  assert.equal(inputRecord.finalRawValue, 2.05);
  assert.equal(inputRecord.trials[0].rawInput, '2.14');
  assert.equal(inputRecord.trials[1].rawInput, '2.05');
});

test('Task 03.2 (4): Nilai tidak valid & parameter kalibrasi tidak valid ditolak dengan tegas', () => {
  const customCalibrationCfg = createCalibrationConfigWithNorms({
    defaultNorm: { tEliteSec: 1.70, tBaseSec: 2.70 }
  });

  // 1. Input kosong ('', null, undefined) ditolak (tidak dianggap 0!)
  assert.equal(convertSprint10mRawToScore('', {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore('   ', {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore(null, {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore(undefined, {}, customCalibrationCfg).isValidInput, false);

  // 2. Angka 0, negatif, NaN, atau di luar rentang fisik [1.0s, 10.0s] ditolak
  assert.equal(convertSprint10mRawToScore(0, {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore(-2.05, {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore(Number.NaN, {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore('abc', {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore(0.45, {}, customCalibrationCfg).isValidInput, false);
  assert.equal(convertSprint10mRawToScore(14.5, {}, customCalibrationCfg).isValidInput, false);

  // 3. Ketidakcocokan satuan ('cm' bukan 's') atau indicatorId ('FTB-UNI-PHY-02' bukan 'FTB-UNI-PHY-01') ditolak
  const wrongUnit = convertTestResultToIndicatorScore(
    {
      testId: 'TST-SPR-10M',
      indicatorId: 'FTB-UNI-PHY-01',
      finalRawValue: 2.05,
      finalUnit: 'cm'
    },
    { calibrationConfig: customCalibrationCfg }
  );
  assert.equal(wrongUnit.isValidInput, false);

  const wrongIndicator = convertTestResultToIndicatorScore(
    {
      testId: 'TST-SPR-10M',
      indicatorId: 'FTB-UNI-PHY-99',
      finalRawValue: 2.05,
      finalUnit: 's'
    },
    { calibrationConfig: customCalibrationCfg }
  );
  assert.equal(wrongIndicator.isValidInput, false);

  // 4. Parameter kalibrasi terbalik (tEliteSec >= tBaseSec) ditolak dan tetap PENDING_CALIBRATION
  const invertedParamsCheck = validateSprint10mCalibrationParams({
    tEliteSec: 2.50,
    tBaseSec: 1.80
  });
  assert.equal(invertedParamsCheck.isCalibrated, false);
  assert.equal(invertedParamsCheck.isInvalidConfig, true);

  // 5. 17 tes lainnya tidak disentuh dan tetap PENDING_CALIBRATION
  const otherTestRes = convertTestResultToIndicatorScore(
    {
      testId: 'TST-AGL-ARW',
      indicatorId: 'FTB-UNI-PHY-02',
      finalRawValue: 8.45,
      finalUnit: 's'
    },
    { calibrationConfig: customCalibrationCfg }
  );
  assert.equal(otherTestRes.isValidInput, true);
  assert.equal(otherTestRes.isSupportedTest, false);
  assert.equal(otherTestRes.calibrationStatus, SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION);
  assert.equal(otherTestRes.convertedScore, null);
  assert.equal(otherTestRes.finalRawValue, 8.45);
});

test('Task 03.2 (5): Integrasi Assessment Battery, Perubahan Konfigurasi Kalibrasi Tanpa Menghapus Data Mentah, dan Isolasi Antar-Tenant', async () => {
  const dbStub = createStatefulSupabaseStub();

  const coachTenantA = {
    tenantId: 'ssb-garuda-muda-a',
    id: '00000000-0000-4000-8000-000000000901',
    role: 'pelatih',
    fullName: 'Coach Hendra'
  };
  const coachTenantB = {
    tenantId: 'ssb-bintang-timur-b',
    id: '00000000-0000-4000-8000-000000000902',
    role: 'pelatih',
    fullName: 'Coach Riko'
  };

  const studentA = '00000000-0000-4000-8000-000000000501';

  // Skenario A: Simpan hasil TST-SPR-10M saat norma belum tersedia (default production config)
  const draftUncalibrated = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-12');
  draftUncalibrated.trials[0].rawInput = '2.16';
  draftUncalibrated.trials[1].rawInput = '2.02';

  const savedUncalibrated = await saveAthleteTestResult(
    coachTenantA,
    {
      ...draftUncalibrated,
      studentId: studentA,
      studentTenantId: 'ssb-garuda-muda-a',
      developmentTier: 'TIER_3_YOUTH_DEV',
      positionCode: 'WFR'
    },
    { supabaseClient: dbStub.forTenant('ssb-garuda-muda-a') }
  );

  assert.equal(savedUncalibrated.finalRawValue, 2.02);
  assert.equal(savedUncalibrated.calibrationStatus, 'PENDING_CALIBRATION');
  assert.equal(savedUncalibrated.convertedScore, null);
  assert.equal(savedUncalibrated.trials[0].rawInput, '2.16');
  assert.equal(savedUncalibrated.trials[1].rawInput, '2.02');

  // Skenario B: Ketika konfigurasi kalibrasi diperbarui kemudian, data mentah yang sudah tersimpan
  // dapat dievaluasi ulang (atau dibaca dengan calibrationConfig baru) TANPA mengubah/menghapus data mentah!
  const calibratedConfigV1 = createCalibrationConfigWithNorms({
    byDevelopmentTier: {
      TIER_3_YOUTH_DEV: {
        tEliteSec: 1.75,
        tBaseSec: 2.74,
        normSource: 'Calibration V1'
      }
    }
  });

  const reevaluatedV1 = recalculateRecordScoreWithCalibration(savedUncalibrated, calibratedConfigV1);
  assert.equal(reevaluatedV1.finalRawValue, 2.02); // Fakta mentah tetap 2.02!
  assert.equal(reevaluatedV1.trials[0].rawInput, '2.16');
  assert.equal(reevaluatedV1.trials[1].rawInput, '2.02');
  assert.equal(reevaluatedV1.calibrationStatus, 'CALIBRATED');
  assert.equal(reevaluatedV1.convertedScore, 73); // 100 - ((2.02 - 1.75)/0.99)*99 = 100 - 27 = 73

  // Ubah lagi konfigurasi kalibrasi ke V2 -> skor berubah, namun data mentah tetap 2.02s utuh!
  const calibratedConfigV2 = createCalibrationConfigWithNorms({
    byDevelopmentTier: {
      TIER_3_YOUTH_DEV: {
        tEliteSec: 1.82,
        tBaseSec: 2.81,
        normSource: 'Calibration V2'
      }
    }
  });
  const reevaluatedV2 = recalculateRecordScoreWithCalibration(savedUncalibrated, calibratedConfigV2);
  assert.equal(reevaluatedV2.finalRawValue, 2.02); // Fakta mentah tidak berubah!
  assert.equal(reevaluatedV2.convertedScore, 80); // 100 - ((2.02 - 1.82)/0.99)*99 = 100 - 20 = 80

  // Skenario C: Simpan hasil TST-SPR-10M baru dengan kalibrasi aktif -> tersimpan terpisah antara final_raw_value dan converted_score
  const draftCalibrated = createInitialTestEntryDraft('TST-SPR-10M', '2026-11-13');
  draftCalibrated.trials[0].rawInput = '1.98';
  draftCalibrated.trials[1].rawInput = '1.92';

  const savedCalibrated = await saveAthleteTestResult(
    coachTenantA,
    {
      ...draftCalibrated,
      studentId: studentA,
      studentTenantId: 'ssb-garuda-muda-a',
      developmentTier: 'TIER_3_YOUTH_DEV',
      positionCode: 'WFR'
    },
    {
      supabaseClient: dbStub.forTenant('ssb-garuda-muda-a'),
      calibrationConfig: calibratedConfigV1
    }
  );

  assert.equal(savedCalibrated.finalRawValue, 1.92);
  assert.equal(savedCalibrated.calibrationStatus, 'CALIBRATED');
  assert.equal(savedCalibrated.convertedScore, 83); // 100 - ((1.92 - 1.75)/0.99)*99 = 100 - 17 = 83

  // Baca kembali riwayat untuk Tenant A
  const historyA = await getAthleteTestResults(coachTenantA, studentA, {
    supabaseClient: dbStub.forTenant('ssb-garuda-muda-a')
  });
  assert.equal(historyA.length, 2);
  assert.equal(historyA[0].finalRawValue, 1.92);
  assert.equal(historyA[0].convertedScore, 83);
  assert.equal(historyA[1].finalRawValue, 2.02);
  assert.equal(historyA[1].convertedScore, null);

  const latestMapA = await getLatestTestResultsByIndicatorMap(coachTenantA, studentA, {
    supabaseClient: dbStub.forTenant('ssb-garuda-muda-a')
  });
  assert.equal(latestMapA['FTB-UNI-PHY-01'].finalRawValue, 1.92);
  assert.equal(latestMapA['FTB-UNI-PHY-01'].convertedScore, 83);

  // Skenario D: Isolasi Multi-Tenant -> Tenant B tidak dapat membaca hasil konversi maupun data mentah milik Tenant A
  const historyFromB = await getAthleteTestResults(coachTenantB, studentA, {
    supabaseClient: dbStub.forTenant('ssb-bintang-timur-b')
  });
  assert.equal(historyFromB.length, 0);
});
