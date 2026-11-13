/**
 * ============================================================================
 * CHUVATOR — SPRINT 10M (TST-SPR-10M) CONTEXT, LONGITUDINAL & NORM RECAP ENGINE
 * (TASK 03.3: DATA COLLECTION & TEST PROTOCOL STANDARDIZATION)
 * ============================================================================
 * Modul murni (pure & deterministic) untuk:
 * 1. Menurunkan konteks atlet & pengujian (`ageGroup`, `ageYearsAtTest`, `birthDate`,
 *    `developmentTier`, `positionCode`, `measurementMethod`, `recordedBy`) dari sumber
 *    data yang sudah tersedia tanpa menduplikasi tabel master atlet.
 * 2. Mengelola analisis perkembangan longitudinal waktu sprint 10m atlet antar-tanggal
 *    dengan memisahkan secara ketat `STOPWATCH_MANUAL` dan `SMARTPHONE_VIDEO`.
 * 3. Menyusun rekapitulasi data mentah `TST-SPR-10M` yang dikelompokkan berdasarkan
 *    Kelompok Usia, Development Tier, Metode Pengukuran, Tenant, dan Periode Tes
 *    sebagai fondasi penyusunan norma performa masa mendatang (tanpa mengarang norma).
 * ============================================================================
 */

import {
  MEASUREMENT_METHODS,
  SPRINT_MEASUREMENT_METHODS,
  getTestDefinitionById,
  isStandardMeasurementMethod
} from '../config/footballTestBatteryCatalog.js';
import { roundToDecimals } from '../utils/testBatteryValidator.js';
import { normalizeAgeGroupCode } from './assessmentScoreConverter.js';

export const UNSPECIFIED_MEASUREMENT_METHOD = 'UNSPECIFIED';

/**
 * Menghitung usia atlet (tahun bulat) pada saat tanggal pelaksanaan tes (`testDate`)
 * berdasarkan tanggal lahir (`birthDate`).
 */
export function computeAgeYearsAtTestDate(birthDateStr, testDateStr) {
  if (!birthDateStr || typeof birthDateStr !== 'string') return null;
  const cleanBirth = birthDateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanBirth)) return null;

  const refDateStr =
    testDateStr && typeof testDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(testDateStr.trim())
      ? testDateStr.trim()
      : new Date().toISOString().split('T')[0];

  const [bYear, bMonth, bDay] = cleanBirth.split('-').map(Number);
  const [tYear, tMonth, tDay] = refDateStr.split('-').map(Number);

  let age = tYear - bYear;
  if (tMonth < bMonth || (tMonth === bMonth && tDay < bDay)) {
    age -= 1;
  }

  if (!Number.isFinite(age) || age < 3 || age > 65) return null;
  return age;
}

/**
 * Menentukan kode kelompok usia standar SSB (`U-8`, `U-10`, `U-12`, `U-14`, `U-16`, `U-18`, `SENIOR`)
 * dari usia pada tanggal tes, string kelompok usia eksplisit, atau Development Tier.
 */
export function deriveStandardAgeGroup({
  ageGroup = null,
  birthDate = null,
  testDate = null,
  developmentTier = null
} = {}) {
  const explicitGroup = normalizeAgeGroupCode(ageGroup);
  if (explicitGroup) {
    if (/^U(\d{1,2})$/.test(explicitGroup)) {
      return `U-${explicitGroup.slice(1)}`;
    }
    return explicitGroup;
  }

  const ageYears = computeAgeYearsAtTestDate(birthDate, testDate);
  if (typeof ageYears === 'number') {
    if (ageYears <= 8) return 'U-8';
    if (ageYears <= 10) return 'U-10';
    if (ageYears <= 12) return 'U-12';
    if (ageYears <= 14) return 'U-14';
    if (ageYears <= 16) return 'U-16';
    if (ageYears <= 18) return 'U-18';
    return 'SENIOR';
  }

  const tierStr = String(developmentTier || '').trim().toUpperCase();
  if (tierStr === 'TIER_1_GRASSROOTS' || tierStr === 'TIER_1') return 'U-8';
  if (tierStr === 'TIER_2_FOUNDATION' || tierStr === 'TIER_2') return 'U-12';
  if (tierStr === 'TIER_3_YOUTH_DEV' || tierStr === 'TIER_3') return 'U-16';
  if (tierStr === 'TIER_4_ELITE_PRO' || tierStr === 'TIER_4') return 'U-18';

  return 'UNSPECIFIED_AGE';
}

/**
 * Menurunkan metadata konteks atlet & pengujian secara lengkap tanpa menduplikasi
 * sumber data master atlet.
 */
export function buildStandardizedAthleteTestContext({
  tenantId,
  studentId,
  studentBirthDate = null,
  ageGroup = null,
  developmentTier = null,
  positionCode = null,
  testDate = null,
  measurementMethod = null,
  recordedByUserId = null,
  recordedByName = null,
  coachId = null
} = {}) {
  const ageYearsAtTest = computeAgeYearsAtTestDate(studentBirthDate, testDate);
  const resolvedAgeGroup = deriveStandardAgeGroup({
    ageGroup,
    birthDate: studentBirthDate,
    testDate,
    developmentTier
  });

  const testPeriod =
    testDate && typeof testDate === 'string' && /^\d{4}-\d{2}/.test(testDate.trim())
      ? testDate.trim().slice(0, 7)
      : 'UNKNOWN_PERIOD';

  return {
    studentId: studentId ? String(studentId).trim() : null,
    tenantId: tenantId ? String(tenantId).trim() : null,
    studentBirthDate: studentBirthDate || null,
    ageYearsAtTest,
    ageGroup: resolvedAgeGroup,
    developmentTier: developmentTier || null,
    positionCode: positionCode || null,
    testDate: testDate || null,
    testPeriod,
    measurementMethod: measurementMethod || null,
    recordedByUserId: recordedByUserId || null,
    recordedByName: recordedByName || 'Pelatih SSB',
    coachId: coachId || null
  };
}

/**
 * Mengekstrak metode pengukuran dari sebuah record hasil tes.
 */
export function extractRecordMeasurementMethod(record) {
  if (!record || typeof record !== 'object') return null;
  const raw =
    record.measurementMethod ??
    record.measurement_method ??
    record.derivedMetrics?.measurementMethod ??
    record.derived_metrics?.measurementMethod ??
    record.derivedMetrics?.athleteTestContext?.measurementMethod ??
    record.derived_metrics?.athleteTestContext?.measurementMethod ??
    record.auxiliaryInputs?.measurementMethod ??
    record.auxiliary_inputs?.measurementMethod ??
    null;

  if (!raw || typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  if (!upper || !isStandardMeasurementMethod(upper)) return null;
  return upper;
}

/**
 * Memeriksa apakah dua sesi pengukuran memiliki metode yang kompatibel untuk perbandingan longitudinal.
 * Aturan keras (Task 03.5):
 * - Hanya metode standar yang valid & terisi eksplisit yang boleh dibandingkan.
 * - Nilai NULL / UNSPECIFIED / non-standar tidak pernah kompatibel untuk dihitung delta-nya,
 *   baik terhadap STOPWATCH_MANUAL maupun sesama record NULL yang tidak terverifikasi.
 */
export function areMeasurementMethodsCompatible(methodA, methodB) {
  if (!isStandardMeasurementMethod(methodA) || !isStandardMeasurementMethod(methodB)) {
    return false;
  }
  return String(methodA).trim().toUpperCase() === String(methodB).trim().toUpperCase();
}

/**
 * Mengekstrak kelompok usia (`ageGroup`) dari record hasil tes tanpa menduplikasi data siswa.
 */
export function extractRecordAgeGroup(record, fallbackStudent = null) {
  if (!record || typeof record !== 'object') return 'UNSPECIFIED_AGE';
  const storedGroup =
    record.ageGroup ||
    record.age_group ||
    record.derivedMetrics?.athleteTestContext?.ageGroup ||
    record.derived_metrics?.athleteTestContext?.ageGroup ||
    null;

  const storedBirthDate =
    record.studentBirthDate ||
    record.derivedMetrics?.athleteTestContext?.studentBirthDate ||
    record.derived_metrics?.athleteTestContext?.studentBirthDate ||
    fallbackStudent?.birthDate ||
    fallbackStudent?.birth_date ||
    null;

  const testDate = record.testDate || record.test_date || null;
  const developmentTier = record.developmentTier || record.development_tier || null;

  return deriveStandardAgeGroup({
    ageGroup: storedGroup,
    birthDate: storedBirthDate,
    testDate,
    developmentTier
  });
}

/**
 * Menyusun analisis perkembangan longitudinal waktu sprint 10m (`TST-SPR-10M`) untuk seorang atlet.
 *
 * Aturan Penting Task 03.3:
 * 1. Setiap sesi tes pada tanggal berbeda dipertahankan sebagai entri terpisah (kronologis).
 * 2. Perhitungan selisih perkembangan waktu (`deltaFromPrevSameMethodSec`) HANYA membandingkan
 *    sesi dengan metode pengukuran yang SAMA (`STOPWATCH_MANUAL` vs `STOPWATCH_MANUAL`, atau
 *    `SMARTPHONE_VIDEO` vs `SMARTPHONE_VIDEO`).
 * 3. Karena arah `TST-SPR-10M` adalah `LOWER_IS_BETTER`:
 *    - `delta < 0` (waktu berkurang, mis. 2.15s -> 2.07s = -0.08s) berarti `IMPROVED` (Lebih Cepat).
 *    - `delta > 0` (waktu bertambah, mis. 2.04s -> 2.10s = +0.06s) berarti `SLOWER` (Lebih Lambat).
 *    - `delta === 0` berarti `UNCHANGED`.
 */
export function buildSprint10mLongitudinalProgress(records = []) {
  const sprintRecords = (Array.isArray(records) ? records : []).filter((r) => {
    const tId = String(r?.testId || r?.test_id || '').trim();
    const rawVal = r?.finalRawValue ?? r?.final_raw_value;
    return tId === 'TST-SPR-10M' && typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal > 0;
  });

  // Urutkan kronologis dari terlama ke terbaru (testDate ASC, createdAt ASC)
  const chronological = [...sprintRecords].sort((a, b) => {
    const dateA = String(a.testDate || a.test_date || '');
    const dateB = String(b.testDate || b.test_date || '');
    const cmpDate = dateA.localeCompare(dateB);
    if (cmpDate !== 0) return cmpDate;
    const createdA = String(a.createdAt || a.created_at || '');
    const createdB = String(b.createdAt || b.created_at || '');
    return createdA.localeCompare(createdB);
  });

  const lastSeenByMethod = {};
  const baselineByMethod = {};
  const methodsSet = new Set();
  const personalBestByMethod = {
    [SPRINT_MEASUREMENT_METHODS.STOPWATCH_MANUAL]: null,
    [SPRINT_MEASUREMENT_METHODS.SMARTPHONE_VIDEO]: null
  };

  let immediatePreviousMethod = null;
  let hasUnverifiedLegacyRecords = false;

  const entries = chronological.map((rec, index) => {
    const rawSec = Number(rec.finalRawValue ?? rec.final_raw_value);
    const extractedMethod = extractRecordMeasurementMethod(rec);
    const isMethodSpecified = isStandardMeasurementMethod(extractedMethod);
    const method = isMethodSpecified ? extractedMethod : null;

    if (isMethodSpecified) {
      methodsSet.add(method);
    } else {
      hasUnverifiedLegacyRecords = true;
    }

    const testDate = rec.testDate || rec.test_date || '';
    const comparableKey = isMethodSpecified ? method : null;

    const methodSwitchedFromImmediatePrevious =
      immediatePreviousMethod !== null &&
      comparableKey !== null &&
      immediatePreviousMethod !== comparableKey;
    if (comparableKey !== null) {
      immediatePreviousMethod = comparableKey;
    }

    const prevSameMethod = comparableKey ? lastSeenByMethod[comparableKey] || null : null;
    const baseSameMethod = comparableKey ? baselineByMethod[comparableKey] || null : null;

    let deltaFromPrevSameMethodSec = null;
    let deltaFromBaselineSameMethodSec = null;
    let progressionDirection = isMethodSpecified ? 'BASELINE' : 'UNSPECIFIED_METHOD';

    if (prevSameMethod && areMeasurementMethodsCompatible(method, prevSameMethod.measurementMethod)) {
      deltaFromPrevSameMethodSec = roundToDecimals(rawSec - prevSameMethod.rawSec, 2);
      if (deltaFromPrevSameMethodSec < 0) {
        progressionDirection = 'IMPROVED';
      } else if (deltaFromPrevSameMethodSec > 0) {
        progressionDirection = 'SLOWER';
      } else {
        progressionDirection = 'UNCHANGED';
      }
    }

    if (baseSameMethod && areMeasurementMethodsCompatible(method, baseSameMethod.measurementMethod)) {
      deltaFromBaselineSameMethodSec = roundToDecimals(rawSec - baseSameMethod.rawSec, 2);
    }

    if (comparableKey) {
      if (!baselineByMethod[comparableKey]) {
        baselineByMethod[comparableKey] = {
          rawSec,
          testDate,
          id: rec.id,
          measurementMethod: comparableKey
        };
      }
      lastSeenByMethod[comparableKey] = {
        rawSec,
        testDate,
        id: rec.id,
        measurementMethod: comparableKey
      };

      const currentBest = personalBestByMethod[comparableKey];
      if (!currentBest || rawSec < currentBest.finalRawValue) {
        personalBestByMethod[comparableKey] = {
          id: rec.id,
          testDate,
          finalRawValue: rawSec,
          finalDisplayValue: `${rawSec} s`,
          measurementMethod: comparableKey
        };
      }
    }

    return {
      sessionOrder: index + 1,
      sessionIndex: index + 1,
      id: rec.id,
      studentId: rec.studentId || rec.student_id,
      tenantId: rec.tenantId || rec.tenant_id,
      testDate,
      measurementMethod: method,
      isMethodSpecified,
      finalRawValue: rawSec,
      finalUnit: 's',
      finalDisplayValue: rec.finalDisplayValue || `${rawSec} s`,
      trials: Array.isArray(rec.trials) ? rec.trials.map((t) => ({ ...t })) : [],
      developmentTier: rec.developmentTier || rec.development_tier || null,
      positionCode: rec.positionCode || rec.position_code || null,
      ageGroup: extractRecordAgeGroup(rec),
      recordedByName: rec.recordedByName || rec.recorded_by_name || 'Pelatih SSB',
      prevSameMethodDate: prevSameMethod ? prevSameMethod.testDate : null,
      deltaFromPrevSameMethodSec,
      deltaFromPreviousSameMethodSec: deltaFromPrevSameMethodSec,
      deltaFromBaselineSameMethodSec,
      progressionDirection,
      trendDirection: progressionDirection,
      methodSwitchedFromImmediatePrevious,
      methodComparisonNote: !isMethodSpecified
        ? 'Catatan legacy belum memiliki metode pengukuran (NULL). Tidak dibandingkan dengan data STOPWATCH_MANUAL atau SMARTPHONE_VIDEO.'
        : methodSwitchedFromImmediatePrevious
          ? `Metode berubah ke ${method}. Selisih waktu dihitung terhadap sesi ${method} sebelumnya (tidak dicampur lintas metode).`
          : null
    };
  });

  const methodsUsed = Array.from(methodsSet);

  return {
    testId: 'TST-SPR-10M',
    indicatorId: 'FTB-UNI-PHY-01',
    totalSessions: entries.length,
    hasMixedMethods: methodsUsed.length > 1,
    hasUnverifiedLegacyRecords,
    methodsUsed,
    entries,
    timeline: entries,
    personalBestByMethod
  };
}

/**
 * Analisis perkembangan longitudinal umum untuk tes apa pun dari 18 katalog Assessment Battery.
 * Memastikan:
 * - Tidak pernah mencampur metode pengukuran yang berbeda (mis. STOPWATCH_MANUAL vs SMARTPHONE_VIDEO).
 * - Record legacy dengan measurement_method NULL tidak dihitung delta-nya terhadap record lain.
 * - Arah perkembangan menghormati `LOWER_IS_BETTER` vs `HIGHER_IS_BETTER`.
 */
export function buildTestLongitudinalProgress(records = [], testId = 'TST-SPR-10M') {
  const testDef = getTestDefinitionById(testId);
  const direction = testDef?.direction || 'LOWER_IS_BETTER';
  const decimals = typeof testDef?.valueConstraints?.decimals === 'number'
    ? testDef.valueConstraints.decimals
    : 2;
  const unit = testDef?.unit || '';

  const testRecords = (Array.isArray(records) ? records : []).filter((r) => {
    const tId = String(r?.testId || r?.test_id || '').trim();
    const rawVal = Number(r?.finalRawValue ?? r?.final_raw_value);
    return tId === testId && Number.isFinite(rawVal) && rawVal > 0;
  });

  const chronological = [...testRecords].sort((a, b) => {
    const dateA = String(a.testDate || a.test_date || '');
    const dateB = String(b.testDate || b.test_date || '');
    const cmpDate = dateA.localeCompare(dateB);
    if (cmpDate !== 0) return cmpDate;
    const createdA = String(a.createdAt || a.created_at || '');
    const createdB = String(b.createdAt || b.created_at || '');
    return createdA.localeCompare(createdB);
  });

  const lastSeenByMethod = {};
  const baselineByMethod = {};
  const methodsSet = new Set();
  const personalBestByMethod = {};
  let hasUnverifiedLegacyRecords = false;
  let immediatePreviousMethod = null;

  const entries = chronological.map((rec, index) => {
    const rawVal = Number(rec.finalRawValue ?? rec.final_raw_value);
    const extractedMethod = extractRecordMeasurementMethod(rec);
    const isMethodSpecified = isStandardMeasurementMethod(extractedMethod);
    const method = isMethodSpecified ? extractedMethod : null;

    if (isMethodSpecified) {
      methodsSet.add(method);
    } else {
      hasUnverifiedLegacyRecords = true;
    }

    const testDate = rec.testDate || rec.test_date || '';
    const comparableKey = isMethodSpecified ? method : null;

    const methodSwitchedFromImmediatePrevious =
      immediatePreviousMethod !== null &&
      comparableKey !== null &&
      immediatePreviousMethod !== comparableKey;
    if (comparableKey !== null) {
      immediatePreviousMethod = comparableKey;
    }

    const prevSameMethod = comparableKey ? lastSeenByMethod[comparableKey] || null : null;
    const baseSameMethod = comparableKey ? baselineByMethod[comparableKey] || null : null;

    let deltaFromPrevSameMethod = null;
    let deltaFromBaselineSameMethod = null;
    let progressionDirection = isMethodSpecified ? 'BASELINE' : 'UNSPECIFIED_METHOD';

    if (prevSameMethod && areMeasurementMethodsCompatible(method, prevSameMethod.measurementMethod)) {
      deltaFromPrevSameMethod = roundToDecimals(rawVal - prevSameMethod.rawVal, decimals);
      if (deltaFromPrevSameMethod === 0) {
        progressionDirection = 'UNCHANGED';
      } else if (direction === 'LOWER_IS_BETTER') {
        progressionDirection = deltaFromPrevSameMethod < 0 ? 'IMPROVED' : 'SLOWER';
      } else {
        progressionDirection = deltaFromPrevSameMethod > 0 ? 'IMPROVED' : 'DECLINED';
      }
    }

    if (baseSameMethod && areMeasurementMethodsCompatible(method, baseSameMethod.measurementMethod)) {
      deltaFromBaselineSameMethod = roundToDecimals(rawVal - baseSameMethod.rawVal, decimals);
    }

    if (comparableKey) {
      if (!baselineByMethod[comparableKey]) {
        baselineByMethod[comparableKey] = { rawVal, testDate, id: rec.id, measurementMethod: comparableKey };
      }
      lastSeenByMethod[comparableKey] = { rawVal, testDate, id: rec.id, measurementMethod: comparableKey };

      const currentBest = personalBestByMethod[comparableKey];
      const isBetter =
        !currentBest ||
        (direction === 'LOWER_IS_BETTER'
          ? rawVal < currentBest.finalRawValue
          : rawVal > currentBest.finalRawValue);
      if (isBetter) {
        personalBestByMethod[comparableKey] = {
          id: rec.id,
          testDate,
          finalRawValue: rawVal,
          finalDisplayValue: rec.finalDisplayValue || `${rawVal} ${unit}`.trim(),
          measurementMethod: comparableKey
        };
      }
    }

    return {
      sessionOrder: index + 1,
      id: rec.id,
      testId,
      studentId: rec.studentId || rec.student_id,
      tenantId: rec.tenantId || rec.tenant_id,
      testDate,
      measurementMethod: method,
      isMethodSpecified,
      finalRawValue: rawVal,
      finalUnit: rec.finalUnit || rec.final_unit || unit,
      finalDisplayValue: rec.finalDisplayValue || `${rawVal} ${unit}`.trim(),
      prevSameMethodDate: prevSameMethod ? prevSameMethod.testDate : null,
      deltaFromPrevSameMethod,
      deltaFromBaselineSameMethod,
      progressionDirection,
      methodSwitchedFromImmediatePrevious
    };
  });

  const methodsUsed = Array.from(methodsSet);
  return {
    testId,
    indicatorId: testDef?.indicatorId || null,
    unit,
    direction,
    totalSessions: entries.length,
    hasMixedMethods: methodsUsed.length > 1,
    hasUnverifiedLegacyRecords,
    methodsUsed,
    entries,
    timeline: entries,
    personalBestByMethod
  };
}

/**
 * Menghitung median dari array angka terurut
 */
function computeSortedMedian(sortedNumbers) {
  if (!Array.isArray(sortedNumbers) || sortedNumbers.length === 0) return null;
  const mid = Math.floor(sortedNumbers.length / 2);
  if (sortedNumbers.length % 2 === 1) {
    return roundToDecimals(sortedNumbers[mid], 2);
  }
  return roundToDecimals((sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2, 2);
}

/**
 * Menyusun rekapitulasi data mentah `TST-SPR-10M` untuk kebutuhan analisis norma performa masa mendatang.
 *
 * Pengelompokan & Pemfilteran mendukung:
 * - Kelompok usia (`ageGroup`: U-8, U-10, U-12, U-14, U-16, U-18, SENIOR)
 * - Development Tier (`developmentTier`: TIER_1..TIER_4)
 * - Metode Pengukuran (`measurementMethod`: STOPWATCH_MANUAL vs SMARTPHONE_VIDEO — WAJIB TERPISAH)
 * - Tenant (`tenantId` — WAJIB TERISOLASI)
 * - Periode Tes (`testPeriod`: YYYY-MM, serta rentang `dateFrom` / `dateTo`)
 *
 * Data mentah (`finalRawValue` dalam detik) tetap menjadi sumber utama fakta.
 */
export function recapitulateSprint10mRawData(records = [], options = {}) {
  const {
    expectedTenantId = null,
    ageGroup = 'ALL',
    developmentTier = 'ALL',
    measurementMethod = 'ALL',
    testPeriod = 'ALL',
    dateFrom = null,
    dateTo = null,
    studentsByIdMap = {}
  } = options;

  const normalizedFilterAgeGroup =
    ageGroup && ageGroup !== 'ALL' ? deriveStandardAgeGroup({ ageGroup }) : 'ALL';

  // 1. Jika expectedTenantId diberikan, tegakkan isolasi multi-tenant keras
  const safeRecords = (Array.isArray(records) ? records : []).filter((rec) => {
    if (!rec || typeof rec !== 'object') return false;
    const recTenant = String(rec.tenantId || rec.tenant_id || '').trim();
    if (expectedTenantId && recTenant !== String(expectedTenantId).trim()) {
      return false;
    }

    const tId = String(rec.testId || rec.test_id || '').trim();
    if (tId !== 'TST-SPR-10M') return false;

    const rawVal = Number(rec.finalRawValue ?? rec.final_raw_value);
    if (!Number.isFinite(rawVal) || rawVal <= 0) return false;

    const extractedMethod = extractRecordMeasurementMethod(rec);
    const recMethod = isStandardMeasurementMethod(extractedMethod)
      ? extractedMethod
      : UNSPECIFIED_MEASUREMENT_METHOD;
    if (measurementMethod && measurementMethod !== 'ALL') {
      const normalizedFilterMethod =
        String(measurementMethod).trim().toUpperCase() === 'NULL'
          ? UNSPECIFIED_MEASUREMENT_METHOD
          : String(measurementMethod).trim().toUpperCase();
      if (recMethod !== normalizedFilterMethod) {
        return false;
      }
    }

    const recTier = String(rec.developmentTier || rec.development_tier || 'UNSPECIFIED_TIER').trim();
    if (developmentTier && developmentTier !== 'ALL' && recTier !== developmentTier) {
      return false;
    }

    const stuId = String(rec.studentId || rec.student_id || '').trim();
    const fallbackStudent = studentsByIdMap?.[stuId] || null;
    const recAgeGroup = extractRecordAgeGroup(rec, fallbackStudent);
    if (
      normalizedFilterAgeGroup &&
      normalizedFilterAgeGroup !== 'ALL' &&
      recAgeGroup !== normalizedFilterAgeGroup
    ) {
      return false;
    }

    const recDate = String(rec.testDate || rec.test_date || '').trim();
    const recPeriod = recDate.length >= 7 ? recDate.slice(0, 7) : 'UNKNOWN_PERIOD';
    if (testPeriod && testPeriod !== 'ALL' && recPeriod !== testPeriod) {
      return false;
    }

    if (dateFrom && recDate && recDate < String(dateFrom).trim()) {
      return false;
    }
    if (dateTo && recDate && recDate > String(dateTo).trim()) {
      return false;
    }

    return true;
  });

  // 2. Kelompokkan berdasarkan: tenantId + ageGroup + developmentTier + measurementMethod + testPeriod
  // Catatan Penting: STOPWATCH_MANUAL, SMARTPHONE_VIDEO, dan UNSPECIFIED (legacy NULL) selalu dipisah!
  const bucketMap = new Map();

  for (const rec of safeRecords) {
    const recTenant = String(rec.tenantId || rec.tenant_id || 'UNKNOWN_TENANT').trim();
    const stuId = String(rec.studentId || rec.student_id || '').trim();
    const fallbackStudent = studentsByIdMap?.[stuId] || null;
    const recAgeGroup = extractRecordAgeGroup(rec, fallbackStudent);
    const recTier = String(rec.developmentTier || rec.development_tier || 'UNSPECIFIED_TIER').trim();
    const extractedMethod = extractRecordMeasurementMethod(rec);
    const recMethod = isStandardMeasurementMethod(extractedMethod)
      ? extractedMethod
      : UNSPECIFIED_MEASUREMENT_METHOD;
    const recDate = String(rec.testDate || rec.test_date || '').trim();
    const recPeriod = recDate.length >= 7 ? recDate.slice(0, 7) : 'UNKNOWN_PERIOD';
    const rawVal = Number(rec.finalRawValue ?? rec.final_raw_value);

    const groupKey = `${recTenant}::${recAgeGroup}::${recTier}::${recMethod}::${recPeriod}`;

    if (!bucketMap.has(groupKey)) {
      bucketMap.set(groupKey, {
        groupKey,
        testId: 'TST-SPR-10M',
        indicatorId: 'FTB-UNI-PHY-01',
        tenantId: recTenant,
        ageGroup: recAgeGroup,
        developmentTier: recTier,
        measurementMethod: recMethod,
        testPeriod: recPeriod,
        unit: 's',
        rawValuesSec: [],
        athleteIdsSet: new Set(),
        records: []
      });
    }

    const bucket = bucketMap.get(groupKey);
    bucket.rawValuesSec.push(rawVal);
    if (stuId) bucket.athleteIdsSet.add(stuId);
    bucket.records.push({
      id: rec.id,
      studentId: stuId,
      testDate: recDate,
      finalRawValue: rawVal,
      measurementMethod: recMethod,
      positionCode: rec.positionCode || rec.position_code || null,
      recordedByName: rec.recordedByName || rec.recorded_by_name || 'Pelatih SSB'
    });
  }

  const groups = Array.from(bucketMap.values())
    .map((b) => {
      const sortedVals = [...b.rawValuesSec].sort((x, y) => x - y);
      const sum = sortedVals.reduce((acc, v) => acc + v, 0);
      const mean = sortedVals.length > 0 ? roundToDecimals(sum / sortedVals.length, 2) : null;
      const median = computeSortedMedian(sortedVals);

      return {
        groupKey: b.groupKey,
        testId: b.testId,
        indicatorId: b.indicatorId,
        tenantId: b.tenantId,
        ageGroup: b.ageGroup,
        developmentTier: b.developmentTier,
        measurementMethod: b.measurementMethod,
        testPeriod: b.testPeriod,
        unit: b.unit,
        sampleCount: sortedVals.length,
        sampleSize: sortedVals.length,
        uniqueStudentCount: b.athleteIdsSet.size,
        uniqueAthletesCount: b.athleteIdsSet.size,
        fastestRawSec: sortedVals.length > 0 ? sortedVals[0] : null,
        slowestRawSec: sortedVals.length > 0 ? sortedVals[sortedVals.length - 1] : null,
        meanRawSec: mean,
        medianRawSec: median,
        rawValuesSec: sortedVals,
        records: b.records,
        calibrationStatus: 'PENDING_CALIBRATION'
      };
    })
    .sort((a, b) => a.groupKey.localeCompare(b.groupKey));

  return {
    testId: 'TST-SPR-10M',
    indicatorId: 'FTB-UNI-PHY-01',
    totalMatchingRecords: safeRecords.length,
    totalRecordsMatched: safeRecords.length,
    totalGroups: groups.length,
    groups
  };
}

/**
 * Rekapitulasi data mentah tergeneralisasi untuk seluruh 18 tes Assessment Battery (Task 03.5).
 * Memisahkan secara ketat berdasarkan `tenantId`, `testId`, `ageGroup`, `developmentTier`,
 * `measurementMethod` (STOPWATCH_MANUAL / SMARTPHONE_VIDEO / PHYSICAL_MEASURING_TOOL / MANUAL_COUNT / UNSPECIFIED),
 * dan `testPeriod`, serta tidak pernah mengarang skor kalibrasi.
 */
export function recapitulateAssessmentBatteryRawData(records = [], options = {}) {
  const {
    expectedTenantId = null,
    testId = 'ALL',
    ageGroup = 'ALL',
    developmentTier = 'ALL',
    measurementMethod = 'ALL',
    testPeriod = 'ALL',
    dateFrom = null,
    dateTo = null,
    studentsByIdMap = {}
  } = options;

  const normalizedFilterAgeGroup =
    ageGroup && ageGroup !== 'ALL' ? deriveStandardAgeGroup({ ageGroup }) : 'ALL';
  const normalizedFilterMethod =
    measurementMethod && measurementMethod !== 'ALL'
      ? String(measurementMethod).trim().toUpperCase() === 'NULL'
        ? UNSPECIFIED_MEASUREMENT_METHOD
        : String(measurementMethod).trim().toUpperCase()
      : 'ALL';

  const safeRecords = (Array.isArray(records) ? records : []).filter((rec) => {
    if (!rec || typeof rec !== 'object') return false;
    const recTenant = String(rec.tenantId || rec.tenant_id || '').trim();
    if (expectedTenantId && recTenant !== String(expectedTenantId).trim()) {
      return false;
    }

    const recTestId = String(rec.testId || rec.test_id || '').trim();
    if (!recTestId) return false;
    if (testId && testId !== 'ALL' && recTestId !== testId) {
      return false;
    }

    const rawVal = Number(rec.finalRawValue ?? rec.final_raw_value);
    if (!Number.isFinite(rawVal) || rawVal <= 0) return false;

    const extractedMethod = extractRecordMeasurementMethod(rec);
    const recMethod = isStandardMeasurementMethod(extractedMethod)
      ? extractedMethod
      : UNSPECIFIED_MEASUREMENT_METHOD;
    if (normalizedFilterMethod !== 'ALL' && recMethod !== normalizedFilterMethod) {
      return false;
    }

    const recTier = String(rec.developmentTier || rec.development_tier || 'UNSPECIFIED_TIER').trim();
    if (developmentTier && developmentTier !== 'ALL' && recTier !== developmentTier) {
      return false;
    }

    const stuId = String(rec.studentId || rec.student_id || '').trim();
    const fallbackStudent = studentsByIdMap?.[stuId] || null;
    const recAgeGroup = extractRecordAgeGroup(rec, fallbackStudent);
    if (
      normalizedFilterAgeGroup &&
      normalizedFilterAgeGroup !== 'ALL' &&
      recAgeGroup !== normalizedFilterAgeGroup
    ) {
      return false;
    }

    const recDate = String(rec.testDate || rec.test_date || '').trim();
    const recPeriod = recDate.length >= 7 ? recDate.slice(0, 7) : 'UNKNOWN_PERIOD';
    if (testPeriod && testPeriod !== 'ALL' && recPeriod !== testPeriod) {
      return false;
    }

    if (dateFrom && recDate && recDate < String(dateFrom).trim()) {
      return false;
    }
    if (dateTo && recDate && recDate > String(dateTo).trim()) {
      return false;
    }

    return true;
  });

  const bucketMap = new Map();

  for (const rec of safeRecords) {
    const recTenant = String(rec.tenantId || rec.tenant_id || 'UNKNOWN_TENANT').trim();
    const recTestId = String(rec.testId || rec.test_id || '').trim();
    const testDef = getTestDefinitionById(recTestId);
    const stuId = String(rec.studentId || rec.student_id || '').trim();
    const fallbackStudent = studentsByIdMap?.[stuId] || null;
    const recAgeGroup = extractRecordAgeGroup(rec, fallbackStudent);
    const recTier = String(rec.developmentTier || rec.development_tier || 'UNSPECIFIED_TIER').trim();
    const extractedMethod = extractRecordMeasurementMethod(rec);
    const recMethod = isStandardMeasurementMethod(extractedMethod)
      ? extractedMethod
      : UNSPECIFIED_MEASUREMENT_METHOD;
    const recDate = String(rec.testDate || rec.test_date || '').trim();
    const recPeriod = recDate.length >= 7 ? recDate.slice(0, 7) : 'UNKNOWN_PERIOD';
    const rawVal = Number(rec.finalRawValue ?? rec.final_raw_value);

    const groupKey = `${recTenant}::${recTestId}::${recAgeGroup}::${recTier}::${recMethod}::${recPeriod}`;

    if (!bucketMap.has(groupKey)) {
      bucketMap.set(groupKey, {
        groupKey,
        testId: recTestId,
        indicatorId: rec.indicatorId || rec.indicator_id || testDef?.indicatorId || null,
        unit: rec.finalUnit || rec.final_unit || testDef?.unit || '',
        direction: testDef?.direction || 'LOWER_IS_BETTER',
        decimals: typeof testDef?.valueConstraints?.decimals === 'number'
          ? testDef.valueConstraints.decimals
          : 2,
        tenantId: recTenant,
        ageGroup: recAgeGroup,
        developmentTier: recTier,
        measurementMethod: recMethod,
        testPeriod: recPeriod,
        rawValues: [],
        athleteIdsSet: new Set(),
        records: []
      });
    }

    const bucket = bucketMap.get(groupKey);
    bucket.rawValues.push(rawVal);
    if (stuId) bucket.athleteIdsSet.add(stuId);
    bucket.records.push({
      id: rec.id,
      studentId: stuId,
      testId: recTestId,
      testDate: recDate,
      finalRawValue: rawVal,
      measurementMethod: recMethod,
      positionCode: rec.positionCode || rec.position_code || null,
      recordedByName: rec.recordedByName || rec.recorded_by_name || 'Pelatih SSB'
    });
  }

  const groups = Array.from(bucketMap.values())
    .map((b) => {
      const sortedVals = [...b.rawValues].sort((x, y) => x - y);
      const sum = sortedVals.reduce((acc, v) => acc + v, 0);
      const mean = sortedVals.length > 0 ? roundToDecimals(sum / sortedVals.length, 2) : null;
      const median = computeSortedMedian(sortedVals);
      const minVal = sortedVals.length > 0 ? sortedVals[0] : null;
      const maxVal = sortedVals.length > 0 ? sortedVals[sortedVals.length - 1] : null;
      const bestVal = b.direction === 'LOWER_IS_BETTER' ? minVal : maxVal;
      const worstVal = b.direction === 'LOWER_IS_BETTER' ? maxVal : minVal;

      return {
        groupKey: b.groupKey,
        testId: b.testId,
        indicatorId: b.indicatorId,
        tenantId: b.tenantId,
        ageGroup: b.ageGroup,
        developmentTier: b.developmentTier,
        measurementMethod: b.measurementMethod,
        isMethodSpecified: b.measurementMethod !== UNSPECIFIED_MEASUREMENT_METHOD,
        testPeriod: b.testPeriod,
        unit: b.unit,
        direction: b.direction,
        sampleCount: sortedVals.length,
        uniqueStudentCount: b.athleteIdsSet.size,
        minRawValue: minVal,
        maxRawValue: maxVal,
        bestRawValue: bestVal,
        worstRawValue: worstVal,
        meanRawValue: mean,
        medianRawValue: median,
        rawValues: sortedVals,
        records: b.records,
        calibrationStatus: 'PENDING_CALIBRATION'
      };
    })
    .sort((a, b) => a.groupKey.localeCompare(b.groupKey));

  return {
    testId,
    totalMatchingRecords: safeRecords.length,
    totalGroups: groups.length,
    groups
  };
}
