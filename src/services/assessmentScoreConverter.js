/**
 * ============================================================================
 * CHUVATOR — FOOTBALL ASSESSMENT SCORE CONVERSION ENGINE (TASK 03.2)
 * ============================================================================
 * Modul murni (pure & deterministic) untuk mengonversi hasil pengukuran mentah
 * Assessment Battery menjadi skor indikator 1–100.
 *
 * CAKUPAN TAHAP PERTAMA (TASK 03.2):
 * - Test ID          : TST-SPR-10M (10m Linear Sprint Test)
 * - Indicator ID     : FTB-UNI-PHY-01 (Akselerasi)
 * - Satuan Hasil     : detik ('s')
 * - Arah Penilaian   : LOWER_IS_BETTER (semakin rendah/cepat waktu sprint, semakin tinggi skor)
 *
 * PRINSIP UTAMA:
 * 1. Data pengukuran mentah adalah fakta; skor 1–100 adalah hasil interpretasi.
 * 2. Nilai mentah (`finalRawValue` dan `trials`) TIDAK BOLEH diubah/dimutasi.
 * 3. DILARANG mengarang norma fiktif untuk U8, U10, U12, U14, U16, U18, atau Senior.
 * 4. Jika parameter kalibrasi (`tEliteSec` & `tBaseSec`) belum tersedia pada konfigurasi,
 *    converter tetap berjalan deterministik dan menghasilkan:
 *    `calibrationStatus: 'PENDING_CALIBRATION'` dan `convertedScore: null`.
 * ============================================================================
 */

import {
  isRawInputEmpty,
  parseStrictNumericValue,
  roundToDecimals
} from '../utils/testBatteryValidator.js';

export const SCORE_CALIBRATION_STATUS = {
  PENDING_CALIBRATION: 'PENDING_CALIBRATION',
  CALIBRATED: 'CALIBRATED',
  NEEDS_FURTHER_DESIGN: 'NEEDS_FURTHER_DESIGN'
};

export const SUPPORTED_CONVERTER_TESTS = {
  'TST-SPR-10M': {
    testId: 'TST-SPR-10M',
    indicatorId: 'FTB-UNI-PHY-01',
    indicatorName: 'Akselerasi',
    unit: 's',
    direction: 'LOWER_IS_BETTER',
    minValidRawSec: 1.0,
    maxValidRawSec: 10.0,
    formulaExpression:
      'clamp(1, 100, round(100 - ((T - tEliteSec) / (tBaseSec - tEliteSec)) * 99))'
  }
};

export const CALIBRATION_AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SENIOR'];

export const CALIBRATION_DEVELOPMENT_TIERS = [
  'TIER_1_GRASSROOTS',
  'TIER_2_FOUNDATION',
  'TIER_3_YOUTH_DEV',
  'TIER_4_ELITE_PRO'
];

/**
 * Helper pembuat slot parameter kalibrasi kosong (belum terkalibrasi).
 * Sesuai mandat Task 03.2: Dilarang mengisi angka norma fiktif sebelum data acuan resmi tersedia.
 */
function createUncalibratedSprint10mSlot(scopeType, scopeKey, label) {
  return {
    scopeType,
    scopeKey,
    label,
    testId: 'TST-SPR-10M',
    indicatorId: 'FTB-UNI-PHY-01',
    unit: 's',
    direction: 'LOWER_IS_BETTER',
    isCalibrated: false,
    tEliteSec: null, // Waktu acuan untuk Skor 100 (detik) — menunggu kalibrasi resmi
    tBaseSec: null,  // Waktu acuan untuk Skor 1 (detik) — menunggu kalibrasi resmi
    timingMethod: null,
    normSource: null,
    updatedAt: null
  };
}

/**
 * Konfigurasi Parameter Kalibrasi Default (Production Safe — Tanpa Norma Fiktif).
 * Struktur ini dapat diperluas per kelompok usia (U8..Senior) maupun Development Tier (Tier 1..4).
 */
export const DEFAULT_SCORE_CALIBRATION_CONFIG = Object.freeze({
  version: '1.0.0-task03.2',
  tests: Object.freeze({
    'TST-SPR-10M': Object.freeze({
      testId: 'TST-SPR-10M',
      indicatorId: 'FTB-UNI-PHY-01',
      indicatorName: 'Akselerasi',
      unit: 's',
      direction: 'LOWER_IS_BETTER',
      byAgeGroup: Object.freeze({
        U8: Object.freeze(createUncalibratedSprint10mSlot('AGE_GROUP', 'U8', 'KU-8 / U8 (6–8 Tahun)')),
        U10: Object.freeze(createUncalibratedSprint10mSlot('AGE_GROUP', 'U10', 'KU-10 / U10 (9–10 Tahun)')),
        U12: Object.freeze(createUncalibratedSprint10mSlot('AGE_GROUP', 'U12', 'KU-12 / U12 (11–12 Tahun)')),
        U14: Object.freeze(createUncalibratedSprint10mSlot('AGE_GROUP', 'U14', 'KU-14 / U14 (13–14 Tahun)')),
        U16: Object.freeze(createUncalibratedSprint10mSlot('AGE_GROUP', 'U16', 'KU-16 / U16 (15–16 Tahun)')),
        U18: Object.freeze(createUncalibratedSprint10mSlot('AGE_GROUP', 'U18', 'KU-18 / U18 (17–18 Tahun)')),
        SENIOR: Object.freeze(createUncalibratedSprint10mSlot('AGE_GROUP', 'SENIOR', 'Senior / Pro (18+ Tahun)'))
      }),
      byDevelopmentTier: Object.freeze({
        TIER_1_GRASSROOTS: Object.freeze(
          createUncalibratedSprint10mSlot('DEVELOPMENT_TIER', 'TIER_1_GRASSROOTS', 'Tier 1 — Joy Phase (U6–U9)')
        ),
        TIER_2_FOUNDATION: Object.freeze(
          createUncalibratedSprint10mSlot('DEVELOPMENT_TIER', 'TIER_2_FOUNDATION', 'Tier 2 — Skill Acquisition (U10–U12)')
        ),
        TIER_3_YOUTH_DEV: Object.freeze(
          createUncalibratedSprint10mSlot('DEVELOPMENT_TIER', 'TIER_3_YOUTH_DEV', 'Tier 3 — Game Training (U13–U15)')
        ),
        TIER_4_ELITE_PRO: Object.freeze(
          createUncalibratedSprint10mSlot('DEVELOPMENT_TIER', 'TIER_4_ELITE_PRO', 'Tier 4 — Performance Phase (U16–Senior)')
        )
      }),
      defaultNorm: Object.freeze(
        createUncalibratedSprint10mSlot('DEFAULT', 'DEFAULT', 'Norma Umum (Semua Jenjang)')
      )
    })
  })
});

/**
 * Membuat salinan konfigurasi kalibrasi baru dengan menyuntikkan parameter acuan (`tEliteSec`, `tBaseSec`)
 * pada kelompok usia atau development tier tertentu tanpa memutasi konfigurasi default.
 *
 * @param {Object} sprint10mOverrides - `{ byAgeGroup: { U14: { tEliteSec, tBaseSec, ... } }, byDevelopmentTier: { ... }, defaultNorm: { ... } }`
 */
export function createCalibrationConfigWithNorms(sprint10mOverrides = {}) {
  const baseTestCfg = DEFAULT_SCORE_CALIBRATION_CONFIG.tests['TST-SPR-10M'];

  const mergedByAgeGroup = {};
  for (const ageKey of CALIBRATION_AGE_GROUPS) {
    const baseSlot = baseTestCfg.byAgeGroup[ageKey];
    const overrideSlot = sprint10mOverrides?.byAgeGroup?.[ageKey] || null;
    mergedByAgeGroup[ageKey] = overrideSlot
      ? {
          ...baseSlot,
          ...overrideSlot,
          isCalibrated:
            overrideSlot.tEliteSec !== null &&
            overrideSlot.tEliteSec !== undefined &&
            overrideSlot.tBaseSec !== null &&
            overrideSlot.tBaseSec !== undefined
        }
      : { ...baseSlot };
  }

  const mergedByTier = {};
  for (const tierKey of CALIBRATION_DEVELOPMENT_TIERS) {
    const baseSlot = baseTestCfg.byDevelopmentTier[tierKey];
    const overrideSlot = sprint10mOverrides?.byDevelopmentTier?.[tierKey] || null;
    mergedByTier[tierKey] = overrideSlot
      ? {
          ...baseSlot,
          ...overrideSlot,
          isCalibrated:
            overrideSlot.tEliteSec !== null &&
            overrideSlot.tEliteSec !== undefined &&
            overrideSlot.tBaseSec !== null &&
            overrideSlot.tBaseSec !== undefined
        }
      : { ...baseSlot };
  }

  const defaultOverride = sprint10mOverrides?.defaultNorm || null;
  const mergedDefaultNorm = defaultOverride
    ? {
        ...baseTestCfg.defaultNorm,
        ...defaultOverride,
        isCalibrated:
          defaultOverride.tEliteSec !== null &&
          defaultOverride.tEliteSec !== undefined &&
          defaultOverride.tBaseSec !== null &&
          defaultOverride.tBaseSec !== undefined
      }
    : { ...baseTestCfg.defaultNorm };

  return {
    version: sprint10mOverrides.version || '1.0.0-custom',
    tests: {
      'TST-SPR-10M': {
        ...baseTestCfg,
        byAgeGroup: mergedByAgeGroup,
        byDevelopmentTier: mergedByTier,
        defaultNorm: mergedDefaultNorm
      }
    }
  };
}

/**
 * Menormalkan kode kelompok usia ('U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SENIOR')
 */
export function normalizeAgeGroupCode(rawAgeGroup) {
  if (!rawAgeGroup || typeof rawAgeGroup !== 'string') return null;
  const cleaned = rawAgeGroup.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned === 'U8' || cleaned === 'KU8' || cleaned === 'U6' || cleaned === 'U7' || cleaned === 'U9') return 'U8';
  if (cleaned === 'U10' || cleaned === 'KU10' || cleaned === 'U11') return 'U10';
  if (cleaned === 'U12' || cleaned === 'KU12' || cleaned === 'U13') return 'U12';
  if (cleaned === 'U14' || cleaned === 'KU14' || cleaned === 'U15') return 'U14';
  if (cleaned === 'U16' || cleaned === 'KU16' || cleaned === 'U17') return 'U16';
  if (cleaned === 'U18' || cleaned === 'KU18' || cleaned === 'U19' || cleaned === 'U20') return 'U18';
  if (cleaned === 'SENIOR' || cleaned === 'PRO' || cleaned === 'UMUM') return 'SENIOR';
  return null;
}

/**
 * Memvalidasi parameter kalibrasi `TST-SPR-10M` (`tEliteSec` dan `tBaseSec`).
 * Karena `TST-SPR-10M` bersifat `LOWER_IS_BETTER` (semakin rendah waktu semakin baik),
 * maka syarat mutlak matematis adalah: `1.0 <= tEliteSec < tBaseSec <= 10.0`.
 */
export function validateSprint10mCalibrationParams(params) {
  if (!params || typeof params !== 'object') {
    return {
      isCalibrated: false,
      isInvalidConfig: false,
      status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      reason: 'Objek parameter kalibrasi tidak ditemukan.'
    };
  }

  const rawElite = params.tEliteSec ?? params.eliteSec ?? params.tElite;
  const rawBase = params.tBaseSec ?? params.baseSec ?? params.tBase;

  // Jika kedua parameter bernilai null/undefined/kosong -> belum terkalibrasi (bukan error konfigurasi)
  if (isRawInputEmpty(rawElite) && isRawInputEmpty(rawBase)) {
    return {
      isCalibrated: false,
      isInvalidConfig: false,
      status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      reason: 'Parameter norma acuan (tEliteSec & tBaseSec) belum tersedia.'
    };
  }

  // Jika hanya salah satu yang diisi -> konfigurasi tidak lengkap
  if (isRawInputEmpty(rawElite) || isRawInputEmpty(rawBase)) {
    return {
      isCalibrated: false,
      isInvalidConfig: true,
      status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      reason: 'Parameter kalibrasi tidak lengkap: baik tEliteSec (skor 100) maupun tBaseSec (skor 1) wajib diisi.'
    };
  }

  const parsedElite = parseStrictNumericValue(rawElite);
  const parsedBase = parseStrictNumericValue(rawBase);

  if (!parsedElite.isValidNumber || !parsedBase.isValidNumber) {
    return {
      isCalibrated: false,
      isInvalidConfig: true,
      status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      reason: 'Parameter kalibrasi tEliteSec dan tBaseSec harus berupa angka desimal positif yang valid.'
    };
  }

  const tEliteSec = parsedElite.numericValue;
  const tBaseSec = parsedBase.numericValue;
  const spec = SUPPORTED_CONVERTER_TESTS['TST-SPR-10M'];

  if (tEliteSec <= 0 || tBaseSec <= 0) {
    return {
      isCalibrated: false,
      isInvalidConfig: true,
      status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      reason: 'Parameter tEliteSec dan tBaseSec harus lebih besar dari 0 detik.'
    };
  }

  if (tEliteSec < spec.minValidRawSec || tBaseSec > spec.maxValidRawSec) {
    return {
      isCalibrated: false,
      isInvalidConfig: true,
      status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      reason: `Parameter kalibrasi TST-SPR-10M harus berada dalam rentang fisik wajar (${spec.minValidRawSec}s – ${spec.maxValidRawSec}s).`
    };
  }

  if (tEliteSec >= tBaseSec) {
    return {
      isCalibrated: false,
      isInvalidConfig: true,
      status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      reason: `Pada tes Sprint 10m (LOWER_IS_BETTER), waktu elite tEliteSec (${tEliteSec}s) wajib lebih kecil/cepat daripada batas dasar tBaseSec (${tBaseSec}s).`
    };
  }

  return {
    isCalibrated: true,
    isInvalidConfig: false,
    status: SCORE_CALIBRATION_STATUS.CALIBRATED,
    tEliteSec,
    tBaseSec,
    normSource: params.normSource || null,
    timingMethod: params.timingMethod || null
  };
}

/**
 * Mencari slot parameter kalibrasi `TST-SPR-10M` yang sesuai dengan konteks atlet
 * (Prioritas: 1. parameter eksplisit langsung -> 2. Age Group -> 3. Development Tier -> 4. Default Norm).
 */
export function resolveSprint10mCalibrationNorm(
  context = {},
  calibrationConfig = DEFAULT_SCORE_CALIBRATION_CONFIG
) {
  if (context && (context.tEliteSec !== undefined || context.tBaseSec !== undefined)) {
    const directCheck = validateSprint10mCalibrationParams(context);
    return {
      ...directCheck,
      matchedScopeType: 'DIRECT_PARAMETER',
      matchedScopeKey: 'DIRECT'
    };
  }

  const testConfig =
    calibrationConfig?.tests?.['TST-SPR-10M'] ||
    DEFAULT_SCORE_CALIBRATION_CONFIG.tests['TST-SPR-10M'];

  const normalizedAgeGroup = normalizeAgeGroupCode(context?.ageGroup);
  if (normalizedAgeGroup && testConfig?.byAgeGroup?.[normalizedAgeGroup]) {
    const ageSlot = testConfig.byAgeGroup[normalizedAgeGroup];
    const ageCheck = validateSprint10mCalibrationParams(ageSlot);
    if (ageCheck.isCalibrated || ageCheck.isInvalidConfig) {
      return {
        ...ageCheck,
        matchedScopeType: 'AGE_GROUP',
        matchedScopeKey: normalizedAgeGroup,
        slotLabel: ageSlot.label
      };
    }
  }

  const tierKey = context?.developmentTier ? String(context.developmentTier).trim() : null;
  if (tierKey && testConfig?.byDevelopmentTier?.[tierKey]) {
    const tierSlot = testConfig.byDevelopmentTier[tierKey];
    const tierCheck = validateSprint10mCalibrationParams(tierSlot);
    if (tierCheck.isCalibrated || tierCheck.isInvalidConfig) {
      return {
        ...tierCheck,
        matchedScopeType: 'DEVELOPMENT_TIER',
        matchedScopeKey: tierKey,
        slotLabel: tierSlot.label
      };
    }
  }

  if (testConfig?.defaultNorm) {
    const defaultCheck = validateSprint10mCalibrationParams(testConfig.defaultNorm);
    if (defaultCheck.isCalibrated || defaultCheck.isInvalidConfig) {
      return {
        ...defaultCheck,
        matchedScopeType: 'DEFAULT',
        matchedScopeKey: 'DEFAULT',
        slotLabel: testConfig.defaultNorm.label
      };
    }
  }

  return {
    isCalibrated: false,
    isInvalidConfig: false,
    status: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
    matchedScopeType: normalizedAgeGroup
      ? 'AGE_GROUP'
      : tierKey
        ? 'DEVELOPMENT_TIER'
        : 'UNSPECIFIED',
    matchedScopeKey: normalizedAgeGroup || tierKey || 'UNSPECIFIED',
    reason:
      'Parameter norma kalibrasi (tEliteSec & tBaseSec) untuk kelompok usia/tier ini belum tersedia.'
  };
}

/**
 * Fungsi Konversi Murni & Deterministik untuk `TST-SPR-10M` (`FTB-UNI-PHY-01` — Akselerasi).
 *
 * Rumus Matematika (LOWER_IS_BETTER):
 *   Score = clamp(1, 100, round(100 - ((T - tEliteSec) / (tBaseSec - tEliteSec)) * 99))
 *
 * - Nilai mentah `rawSeconds` TIDAK diubah.
 * - Jika `rawSeconds` tidak valid (kosong, <= 0, NaN, atau di luar [1.0, 10.0]), ditolak dengan `isValidInput: false`.
 * - Jika kalibrasi belum tersedia, menghasilkan `calibrationStatus: 'PENDING_CALIBRATION'` dan `convertedScore: null`.
 */
export function convertSprint10mRawToScore(rawSeconds, calibrationContextOrParams = {}, calibrationConfig = DEFAULT_SCORE_CALIBRATION_CONFIG) {
  const spec = SUPPORTED_CONVERTER_TESTS['TST-SPR-10M'];

  // 1. Validasi ketat input mentah (tidak boleh kosong, 0, negatif, atau NaN)
  if (isRawInputEmpty(rawSeconds)) {
    return {
      isValidInput: false,
      error: 'Nilai waktu Sprint 10m wajib diisi (input kosong tidak dapat dikonversi).',
      testId: spec.testId,
      indicatorId: spec.indicatorId,
      finalRawValue: null,
      finalUnit: spec.unit,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null
    };
  }

  const parsedRaw = parseStrictNumericValue(rawSeconds);
  if (!parsedRaw.isValidNumber || parsedRaw.numericValue === null) {
    return {
      isValidInput: false,
      error: `Nilai waktu Sprint 10m ("${rawSeconds}") bukan angka yang valid.`,
      testId: spec.testId,
      indicatorId: spec.indicatorId,
      finalRawValue: null,
      finalUnit: spec.unit,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null
    };
  }

  const numericRaw = parsedRaw.numericValue;

  if (numericRaw <= 0) {
    return {
      isValidInput: false,
      error: `Nilai waktu Sprint 10m (${numericRaw}s) tidak boleh bernilai 0 atau negatif.`,
      testId: spec.testId,
      indicatorId: spec.indicatorId,
      finalRawValue: null,
      finalUnit: spec.unit,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null
    };
  }

  if (numericRaw < spec.minValidRawSec || numericRaw > spec.maxValidRawSec) {
    return {
      isValidInput: false,
      error: `Nilai waktu Sprint 10m (${numericRaw}s) berada di luar batas wajar (${spec.minValidRawSec}s – ${spec.maxValidRawSec}s).`,
      testId: spec.testId,
      indicatorId: spec.indicatorId,
      finalRawValue: null,
      finalUnit: spec.unit,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null
    };
  }

  // 2. Resolusi parameter kalibrasi
  const resolvedNorm = resolveSprint10mCalibrationNorm(calibrationContextOrParams, calibrationConfig);

  if (!resolvedNorm.isCalibrated) {
    return {
      isValidInput: true,
      isSupportedTest: true,
      isCalibrated: false,
      testId: spec.testId,
      indicatorId: spec.indicatorId,
      indicatorName: spec.indicatorName,
      finalRawValue: numericRaw, // FAKTA MENTAH TIDAK DIUBAH
      finalUnit: spec.unit,
      direction: spec.direction,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null,
      matchedScopeType: resolvedNorm.matchedScopeType,
      matchedScopeKey: resolvedNorm.matchedScopeKey,
      calibrationParameters: null,
      formulaExpression: spec.formulaExpression,
      reason: resolvedNorm.reason
    };
  }

  // 3. Perhitungan deterministik skor 1–100 (LOWER_IS_BETTER: semakin cepat waktu, semakin tinggi skor)
  const { tEliteSec, tBaseSec } = resolvedNorm;
  const normalizedPosition = (numericRaw - tEliteSec) / (tBaseSec - tEliteSec);
  const rawLinearScore = 100 - normalizedPosition * 99;
  const clampedUnrounded = Math.max(1, Math.min(100, rawLinearScore));
  const convertedScore = Math.max(1, Math.min(100, Math.round(rawLinearScore)));

  return {
    isValidInput: true,
    isSupportedTest: true,
    isCalibrated: true,
    testId: spec.testId,
    indicatorId: spec.indicatorId,
    indicatorName: spec.indicatorName,
    finalRawValue: numericRaw, // FAKTA MENTAH TIDAK DIUBAH
    finalUnit: spec.unit,
    direction: spec.direction,
    calibrationStatus: SCORE_CALIBRATION_STATUS.CALIBRATED,
    convertedScore,
    unroundedScore: roundToDecimals(clampedUnrounded, 2),
    matchedScopeType: resolvedNorm.matchedScopeType,
    matchedScopeKey: resolvedNorm.matchedScopeKey,
    calibrationParameters: {
      tEliteSec,
      tBaseSec,
      normSource: resolvedNorm.normSource || null,
      timingMethod: resolvedNorm.timingMethod || null
    },
    formulaExpression: spec.formulaExpression,
    reason: `Dikonversi secara deterministik dari ${numericRaw}s menggunakan norma [${tEliteSec}s – ${tBaseSec}s].`
  };
}

/**
 * Entry point reusable untuk mengonversi record hasil tes Assessment Battery.
 *
 * - Tahap 1 (Task 03.2): Hanya menangani `TST-SPR-10M` (`FTB-UNI-PHY-01`).
 * - Untuk 17 tes lainnya: Mengembalikan `calibrationStatus: 'PENDING_CALIBRATION'` dan `convertedScore: null`
 *   tanpa mengubah rumus atau nilai mentah 17 tes tersebut.
 */
export function convertTestResultToIndicatorScore(recordOrPayload, options = {}) {
  if (!recordOrPayload || typeof recordOrPayload !== 'object') {
    return {
      isValidInput: false,
      isSupportedTest: false,
      error: 'Data hasil tes tidak ditemukan untuk konversi skor.',
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null
    };
  }

  const testId = String(recordOrPayload.testId || recordOrPayload.test_id || '').trim();
  const indicatorId = String(recordOrPayload.indicatorId || recordOrPayload.indicator_id || '').trim();
  const rawValue =
    recordOrPayload.finalRawValue !== undefined
      ? recordOrPayload.finalRawValue
      : recordOrPayload.final_raw_value;
  const unit = String(
    recordOrPayload.finalUnit || recordOrPayload.final_unit || recordOrPayload.unit || ''
  ).trim();

  // Jika bukan TST-SPR-10M (17 tes lainnya), jangan ubah apapun dan pertahankan PENDING_CALIBRATION
  if (testId !== 'TST-SPR-10M') {
    return {
      isValidInput: true,
      isSupportedTest: false,
      isCalibrated: false,
      testId,
      indicatorId,
      finalRawValue: rawValue ?? null,
      finalUnit: unit || null,
      calibrationStatus:
        recordOrPayload.calibrationStatus ||
        recordOrPayload.calibration_status ||
        SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null,
      reason: `Converter tahap pertama (Task 03.2) dikhususkan untuk TST-SPR-10M (FTB-UNI-PHY-01). Tes "${testId}" tetap PENDING_CALIBRATION.`
    };
  }

  // Validasi kesesuaian indicatorId dan satuan ('s') untuk TST-SPR-10M
  const spec = SUPPORTED_CONVERTER_TESTS['TST-SPR-10M'];
  if (indicatorId && indicatorId !== spec.indicatorId) {
    return {
      isValidInput: false,
      isSupportedTest: true,
      error: `Ketidakcocokan ID Indikator pada TST-SPR-10M: menerima "${indicatorId}", seharusnya "${spec.indicatorId}".`,
      testId,
      indicatorId,
      finalRawValue: rawValue ?? null,
      finalUnit: unit || null,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null
    };
  }

  if (unit && unit !== spec.unit) {
    return {
      isValidInput: false,
      isSupportedTest: true,
      error: `Satuan waktu TST-SPR-10M tidak valid: menerima "${unit}", seharusnya "${spec.unit}" (detik).`,
      testId,
      indicatorId: spec.indicatorId,
      finalRawValue: rawValue ?? null,
      finalUnit: unit,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null,
      unroundedScore: null
    };
  }

  const calibrationConfig = options.calibrationConfig || DEFAULT_SCORE_CALIBRATION_CONFIG;
  const calibrationContext = {
    developmentTier:
      options.developmentTier ||
      recordOrPayload.developmentTier ||
      recordOrPayload.development_tier ||
      null,
    ageGroup:
      options.ageGroup ||
      recordOrPayload.ageGroup ||
      recordOrPayload.age_group ||
      null,
    ...(options.directCalibrationParams || {})
  };

  return convertSprint10mRawToScore(rawValue, calibrationContext, calibrationConfig);
}

/**
 * Mengevaluasi ulang skor konversi sebuah record hasil tes terhadap konfigurasi kalibrasi baru
 * TANPA menghapus atau mengubah data pengukuran mentah (`finalRawValue`, `finalDisplayValue`, `trials`).
 */
export function recalculateRecordScoreWithCalibration(
  record,
  calibrationConfig = DEFAULT_SCORE_CALIBRATION_CONFIG,
  contextOverrides = {}
) {
  if (!record || typeof record !== 'object') return null;

  // Salin secara defensif agar objek record asli beserta trials tidak termutasi
  const preservedTrials = Array.isArray(record.trials)
    ? record.trials.map((t) => ({ ...t }))
    : [];

  const conversion = convertTestResultToIndicatorScore(record, {
    calibrationConfig,
    ...contextOverrides
  });

  if (!conversion.isValidInput) {
    return {
      ...record,
      trials: preservedTrials,
      calibrationStatus: SCORE_CALIBRATION_STATUS.PENDING_CALIBRATION,
      convertedScore: null
    };
  }

  return {
    ...record,
    trials: preservedTrials,
    finalRawValue:
      record.finalRawValue !== undefined ? record.finalRawValue : record.final_raw_value,
    calibrationStatus: conversion.calibrationStatus,
    convertedScore: conversion.convertedScore,
    derivedMetrics: {
      ...(record.derivedMetrics || record.derived_metrics || {}),
      scoreConversion: {
        isSupportedTest: conversion.isSupportedTest,
        isCalibrated: Boolean(conversion.isCalibrated),
        calibrationStatus: conversion.calibrationStatus,
        convertedScore: conversion.convertedScore,
        unroundedScore: conversion.unroundedScore ?? null,
        matchedScopeType: conversion.matchedScopeType || null,
        matchedScopeKey: conversion.matchedScopeKey || null,
        calibrationParameters: conversion.calibrationParameters || null,
        formulaExpression: conversion.formulaExpression || null
      }
    }
  };
}
