/**
 * CHUVATOR — FOOTBALL ASSESSMENT BATTERY VALIDATION & CALCULATION ENGINE
 * Pure module (zero UI / DB coupling) untuk memvalidasi input lapangan mentah,
 * menegakkan aturan validitas percobaan, serta menghitung nilai akhir dan metrik turunan
 * tanpa memanipulasi data mentah secara diam-diam.
 */

import {
  TEST_INPUT_SCHEMA_TYPES,
  BLEEP_LEVEL_SHUTTLES,
  SPRINT_MEASUREMENT_METHODS,
  getTestDefinitionById
} from '../config/footballTestBatteryCatalog.js';

/**
 * Memeriksa apakah nilai input benar-benar kosong (bukan angka 0).
 * PENTING: Input kosong ('', null, undefined, spasi) TIDAK BOLEH dianggap 0.
 */
export function isRawInputEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

/**
 * Mem-parsing nilai numerik secara ketat tanpa mengubah string kosong menjadi 0.
 */
export function parseStrictNumericValue(rawValue) {
  if (isRawInputEmpty(rawValue)) {
    return { isValidNumber: false, isEmpty: true, numericValue: null };
  }
  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) {
      return { isValidNumber: false, isEmpty: false, numericValue: null };
    }
    return { isValidNumber: true, isEmpty: false, numericValue: rawValue };
  }
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().replace(',', '.');
    if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(normalized)) {
      return { isValidNumber: false, isEmpty: false, numericValue: null };
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return { isValidNumber: false, isEmpty: false, numericValue: null };
    }
    return { isValidNumber: true, isEmpty: false, numericValue: parsed };
  }
  return { isValidNumber: false, isEmpty: false, numericValue: null };
}

/**
 * Pembulatan tampilan desimal yang deterministik untuk pelaporan (tanpa mengubah rawValue asli)
 */
export function roundToDecimals(num, decimals = 2) {
  if (!Number.isFinite(num)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Menghitung total shuttle kumulatif dan total jarak (meter) pada 20m Bleep Test (Leger Protocol)
 */
export function computeBleepCumulativeMetrics(levelReached, shuttleReached) {
  const levelParsed = parseStrictNumericValue(levelReached);
  const shuttleParsed = parseStrictNumericValue(shuttleReached);

  if (!levelParsed.isValidNumber || !shuttleParsed.isValidNumber) {
    return {
      isValid: false,
      error: 'Level dan Shuttle terakhir wajib diisi dengan angka bulat positif.'
    };
  }

  const level = levelParsed.numericValue;
  const shuttle = shuttleParsed.numericValue;

  if (!Number.isInteger(level) || !Number.isInteger(shuttle)) {
    return {
      isValid: false,
      error: 'Level dan Shuttle harus berupa bilangan bulat (tanpa desimal).'
    };
  }

  if (level <= 0 || shuttle <= 0) {
    return {
      isValid: false,
      error: 'Level dan Shuttle tidak boleh bernilai 0 atau negatif.'
    };
  }

  const maxShuttlesInLevel = BLEEP_LEVEL_SHUTTLES[level];
  if (!maxShuttlesInLevel) {
    return {
      isValid: false,
      error: `Level ${level} berada di luar rentang standar Bleep Test (Level 1 s/d 21).`
    };
  }

  if (shuttle > maxShuttlesInLevel) {
    return {
      isValid: false,
      error: `Level ${level} pada standar 20m Bleep Test maksimal memiliki ${maxShuttlesInLevel} shuttle (input: Shuttle ${shuttle}).`
    };
  }

  let priorShuttles = 0;
  for (let lvl = 1; lvl < level; lvl += 1) {
    priorShuttles += BLEEP_LEVEL_SHUTTLES[lvl] || 0;
  }

  const cumulativeShuttles = priorShuttles + shuttle;
  const cumulativeDistanceMeters = cumulativeShuttles * 20;

  return {
    isValid: true,
    level,
    shuttle,
    maxShuttlesInLevel,
    cumulativeShuttles,
    cumulativeDistanceMeters,
    formattedLevelShuttle: `Level ${level} • Shuttle ${shuttle}`
  };
}

/**
 * Membuat template state awal form pencatatan berdasarkan definisi tes di katalog
 */
export function createInitialTestEntryDraft(testId, existingDate = null) {
  const testDef = getTestDefinitionById(testId);
  if (!testDef) return null;

  const todayStr = existingDate || new Date().toISOString().split('T')[0];

  const trials = Array.from({ length: testDef.requiredTrialsCount }, (_, idx) => ({
    trialNumber: idx + 1,
    label: testDef.trialLabels?.[idx] || `Percobaan ${idx + 1}`,
    side: testDef.trialSides?.[idx] || null,
    rawInput: '',
    unit: testDef.unit,
    isValid: true,
    invalidReason: ''
  }));

  const auxiliaryInputs = {};
  if (Array.isArray(testDef.auxiliaryFields)) {
    testDef.auxiliaryFields.forEach((field) => {
      auxiliaryInputs[field.key] = '';
    });
  }

  const defaultMeasurementMethod = testDef.requiresMeasurementMethod
    ? testDef.defaultMeasurementMethod || SPRINT_MEASUREMENT_METHODS.STOPWATCH_MANUAL
    : null;

  return {
    testId: testDef.testId,
    indicatorId: testDef.indicatorId,
    testDate: todayStr,
    unit: testDef.unit,
    measurementMethod: defaultMeasurementMethod,
    trials,
    auxiliaryInputs,
    notes: '',
    surfaceCondition: 'Rumput Alami Standar'
  };
}

/**
 * Validasi komprehensif dan perhitungan hasil akhir untuk satu sesi pencatatan tes lapangan.
 *
 * Aturan Keras:
 * 1. Input kosong tidak boleh dianggap 0.
 * 2. Angka negatif tidak boleh disimpan.
 * 3. Nilai 0 tidak boleh disimpan untuk pengukuran waktu/jarak/repetisi tes ini.
 * 4. Satuan (unit) harus eksplisit dan sesuai dengan definisi katalog tes.
 * 5. Percobaan gagal dapat ditandai tidak valid (isValid: false), namun setiap slot percobaan wajib
 *    diisi nilainya ATAU ditandai tidak valid beserta alasannya (tidak boleh dibiarkan setengah jalan).
 * 6. Nilai mentah pada setiap percobaan tidak boleh diubah secara diam-diam.
 */
export function validateAndComputeTestBatteryEntry(payload) {
  const errors = [];
  const fieldErrors = {};

  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      errors: ['Data input tes tidak ditemukan.'],
      fieldErrors
    };
  }

  const testDef = getTestDefinitionById(payload.testId);
  if (!testDef) {
    return {
      isValid: false,
      errors: [`Definisi tes dengan ID "${payload.testId || ''}" tidak terdaftar dalam katalog.`],
      fieldErrors
    };
  }

  // Validasi satuan pengukuran eksplisit
  const submittedUnit = typeof payload.unit === 'string' ? payload.unit.trim() : '';
  if (!submittedUnit) {
    errors.push(`Satuan pengukuran wajib disertakan (${testDef.unitLabel}).`);
    fieldErrors.unit = 'Satuan pengukuran wajib diisi.';
  } else if (submittedUnit !== testDef.unit) {
    errors.push(`Satuan pengukuran tidak sesuai: menerima "${submittedUnit}", seharusnya "${testDef.unit}".`);
    fieldErrors.unit = `Satuan harus "${testDef.unit}".`;
  }

  // Validasi tanggal tes
  const testDate = typeof payload.testDate === 'string' ? payload.testDate.trim() : '';
  if (!testDate || !/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
    errors.push('Tanggal pelaksanaan tes wajib diisi dengan format YYYY-MM-DD.');
    fieldErrors.testDate = 'Tanggal tes tidak valid.';
  }

  // Validasi metode pengukuran wajib untuk tes yang mensyaratkan pembedaan alat (mis. TST-SPR-10M: STOPWATCH_MANUAL vs SMARTPHONE_VIDEO)
  let resolvedMeasurementMethod = null;
  if (testDef.requiresMeasurementMethod) {
    const supportedMethods = Array.isArray(testDef.supportedMeasurementMethods)
      ? testDef.supportedMeasurementMethods
      : [SPRINT_MEASUREMENT_METHODS.STOPWATCH_MANUAL, SPRINT_MEASUREMENT_METHODS.SMARTPHONE_VIDEO];

    const rawMethod =
      payload.measurementMethod !== undefined
        ? payload.measurementMethod
        : payload.auxiliaryInputs?.measurementMethod !== undefined
          ? payload.auxiliaryInputs.measurementMethod
          : undefined;

    if (rawMethod === undefined && payload.requireExplicitMeasurementMethod !== true) {
      resolvedMeasurementMethod =
        testDef.defaultMeasurementMethod || SPRINT_MEASUREMENT_METHODS.STOPWATCH_MANUAL;
    } else if (isRawInputEmpty(rawMethod)) {
      errors.push(
        `Metode pengukuran waktu wajib dipilih untuk ${testDef.shortName} (${supportedMethods.join(' atau ')}).`
      );
      fieldErrors.measurementMethod = 'Metode pengukuran wajib dipilih.';
    } else {
      const normalizedMethod = String(rawMethod).trim().toUpperCase();
      if (!supportedMethods.includes(normalizedMethod)) {
        errors.push(
          `Metode pengukuran "${rawMethod}" tidak didukung untuk ${testDef.shortName}. Pilih salah satu: ${supportedMethods.join(', ')}.`
        );
        fieldErrors.measurementMethod = `Metode harus salah satu dari: ${supportedMethods.join(', ')}.`;
      } else {
        resolvedMeasurementMethod = normalizedMethod;
      }
    }
  } else if (payload.measurementMethod && typeof payload.measurementMethod === 'string') {
    resolvedMeasurementMethod = payload.measurementMethod.trim().toUpperCase();
  }

  const schemaType = testDef.inputSchemaType;
  const constraints = testDef.valueConstraints || {};
  const auxInputs = payload.auxiliaryInputs && typeof payload.auxiliaryInputs === 'object'
    ? payload.auxiliaryInputs
    : {};

  // ===========================================================================
  // KHUSUS SKEMA BLEEP TEST (Level & Shuttle)
  // ===========================================================================
  if (schemaType === TEST_INPUT_SCHEMA_TYPES.BLEEP_SHUTTLE_LEVEL) {
    const levelRaw = auxInputs.levelReached;
    const shuttleRaw = auxInputs.shuttleReached;

    if (isRawInputEmpty(levelRaw)) {
      errors.push('Level terakhir Bleep Test wajib diisi (input kosong tidak dianggap 0).');
      fieldErrors['aux.levelReached'] = 'Level wajib diisi.';
    }
    if (isRawInputEmpty(shuttleRaw)) {
      errors.push('Shuttle terakhir Bleep Test wajib diisi (input kosong tidak dianggap 0).');
      fieldErrors['aux.shuttleReached'] = 'Shuttle wajib diisi.';
    }

    if (errors.length > 0) {
      return { isValid: false, errors, fieldErrors };
    }

    const bleepCalc = computeBleepCumulativeMetrics(levelRaw, shuttleRaw);
    if (!bleepCalc.isValid) {
      errors.push(bleepCalc.error);
      fieldErrors['aux.shuttleReached'] = bleepCalc.error;
      return { isValid: false, errors, fieldErrors };
    }

    const normalizedTrials = [
      {
        trialNumber: 1,
        label: 'Hasil Akhir Bleep Test',
        side: null,
        rawInput: `${bleepCalc.level}.${bleepCalc.shuttle}`,
        numericValue: bleepCalc.cumulativeDistanceMeters,
        unit: testDef.unit,
        isValid: true,
        invalidReason: null
      }
    ];

    return {
      isValid: true,
      errors: [],
      fieldErrors: {},
      normalizedRecord: {
        testId: testDef.testId,
        testName: testDef.testName,
        indicatorId: testDef.indicatorId,
        indicatorName: testDef.indicatorName,
        categoryId: testDef.categoryId,
        testDate,
        inputSchemaType: schemaType,
        trials: normalizedTrials,
        auxiliaryInputs: {
          levelReached: bleepCalc.level,
          shuttleReached: bleepCalc.shuttle
        },
        finalRawValue: bleepCalc.cumulativeDistanceMeters,
        finalUnit: testDef.unit,
        finalDisplayValue: `${bleepCalc.cumulativeDistanceMeters} m (${bleepCalc.formattedLevelShuttle})`,
        aggregationMethod: testDef.finalResultMethod,
        derivedMetrics: {
          levelReached: bleepCalc.level,
          shuttleReached: bleepCalc.shuttle,
          cumulativeShuttles: bleepCalc.cumulativeShuttles,
          cumulativeDistanceMeters: bleepCalc.cumulativeDistanceMeters
        },
        attemptStatus: 'VALID',
        calibrationStatus: 'PENDING_CALIBRATION',
        mappingReadiness: testDef.mappingReadiness,
        convertedScore: null
      }
    };
  }

  // ===========================================================================
  // VALIDASI AUXILIARY INPUTS UNTUK VERTICAL JUMP (Standing Reach H1)
  // ===========================================================================
  let standingReachCm = null;
  if (schemaType === TEST_INPUT_SCHEMA_TYPES.VERTICAL_JUMP_DELTA) {
    const rawH1 = auxInputs.standingReachCm;
    if (isRawInputEmpty(rawH1)) {
      errors.push('Tinggi Raihan Berdiri (H1) wajib diisi sebelum menghitung tinggi lompatan bersih.');
      fieldErrors['aux.standingReachCm'] = 'Tinggi Raihan Berdiri (H1) wajib diisi.';
    } else {
      const parsedH1 = parseStrictNumericValue(rawH1);
      if (!parsedH1.isValidNumber) {
        errors.push('Tinggi Raihan Berdiri (H1) harus berupa angka yang valid.');
        fieldErrors['aux.standingReachCm'] = 'Angka H1 tidak valid.';
      } else if (parsedH1.numericValue <= 0) {
        errors.push('Tinggi Raihan Berdiri (H1) tidak boleh bernilai negatif atau 0.');
        fieldErrors['aux.standingReachCm'] = 'Tidak boleh <= 0.';
      } else if (parsedH1.numericValue < 100 || parsedH1.numericValue > 280) {
        errors.push('Tinggi Raihan Berdiri (H1) berada di luar batas wajar manusia (100–280 cm).');
        fieldErrors['aux.standingReachCm'] = 'Rentang wajar H1: 100–280 cm.';
      } else {
        standingReachCm = parsedH1.numericValue;
      }
    }
  }

  // ===========================================================================
  // VALIDASI DAFTAR PERCOBAAN (TRIALS)
  // ===========================================================================
  const rawTrials = Array.isArray(payload.trials) ? payload.trials : [];
  if (rawTrials.length !== testDef.requiredTrialsCount) {
    errors.push(
      `Tes "${testDef.testName}" mewajibkan tepat ${testDef.requiredTrialsCount} slot percobaan (diterima: ${rawTrials.length}).`
    );
    fieldErrors.trials = `Wajib terdapat ${testDef.requiredTrialsCount} slot percobaan.`;
    return { isValid: false, errors, fieldErrors };
  }

  const normalizedTrials = [];
  const validNumericTrials = [];

  rawTrials.forEach((trialItem, idx) => {
    const trialNum = idx + 1;
    const trialLabel = testDef.trialLabels?.[idx] || `Percobaan ${trialNum}`;
    const expectedSide = testDef.trialSides?.[idx] || null;
    const isTrialMarkedValid = trialItem?.isValid !== false;
    const rawInput = trialItem?.rawInput;
    const invalidReason = typeof trialItem?.invalidReason === 'string' ? trialItem.invalidReason.trim() : '';

    if (!isTrialMarkedValid) {
      // Percobaan ditandai TIDAK SAH (scratch / foul / terpeleset)
      let optionalNumeric = null;
      if (!isRawInputEmpty(rawInput)) {
        const parsedOpt = parseStrictNumericValue(rawInput);
        if (parsedOpt.isValidNumber && parsedOpt.numericValue < 0) {
          errors.push(`${trialLabel}: Angka negatif (${rawInput}) tidak diizinkan walaupun percobaan ditandai tidak sah.`);
          fieldErrors[`trial.${idx}`] = 'Angka negatif tidak diizinkan.';
        } else if (parsedOpt.isValidNumber) {
          optionalNumeric = parsedOpt.numericValue;
        }
      }

      normalizedTrials.push({
        trialNumber: trialNum,
        label: trialLabel,
        side: expectedSide,
        rawInput: isRawInputEmpty(rawInput) ? null : String(rawInput).trim(),
        numericValue: optionalNumeric,
        unit: testDef.unit,
        isValid: false,
        invalidReason: invalidReason || 'Percobaan ditandai tidak sah oleh pelatih'
      });
      return;
    }

    // Jika percobaan berstatus SAH (isValid === true), nilai TIDAK BOLEH kosong
    if (isRawInputEmpty(rawInput)) {
      errors.push(
        `${trialLabel} belum diisi. Masukkan nilai hasil pengukuran atau tandai percobaan sebagai "Tidak Sah" jika gagal.`
      );
      fieldErrors[`trial.${idx}`] = `${trialLabel} wajib diisi (input kosong tidak dianggap 0).`;
      return;
    }

    const parsed = parseStrictNumericValue(rawInput);
    if (!parsed.isValidNumber) {
      errors.push(`${trialLabel} berisi format angka yang tidak valid ("${rawInput}").`);
      fieldErrors[`trial.${idx}`] = 'Format angka tidak valid.';
      return;
    }

    const numVal = parsed.numericValue;

    // Larangan keras angka negatif
    if (numVal < 0) {
      errors.push(`${trialLabel}: Nilai negatif (${numVal}) tidak diperbolehkan.`);
      fieldErrors[`trial.${idx}`] = 'Nilai negatif tidak diperbolehkan.';
      return;
    }

    // Larangan nilai 0 untuk waktu/jarak/repetisi
    if (numVal === 0) {
      errors.push(
        `${trialLabel}: Nilai 0 tidak valid untuk pengukuran ${testDef.shortName}. Tandai percobaan sebagai "Tidak Sah" apabila percobaan gagal.`
      );
      fieldErrors[`trial.${idx}`] = 'Nilai 0 tidak sah; tandai "Tidak Sah" jika percobaan gagal.';
      return;
    }

    // Batas kewajaran fisik (min/max constraint)
    if (typeof constraints.min === 'number' && numVal < constraints.min) {
      errors.push(
        `${trialLabel}: Nilai ${numVal} ${testDef.unit} berada di bawah batas minimum fisik yang wajar (${constraints.min} ${testDef.unit}).`
      );
      fieldErrors[`trial.${idx}`] = `Minimum wajar: ${constraints.min} ${testDef.unit}.`;
      return;
    }

    if (typeof constraints.max === 'number' && numVal > constraints.max) {
      errors.push(
        `${trialLabel}: Nilai ${numVal} ${testDef.unit} melebihi batas maksimum protokol tes (${constraints.max} ${testDef.unit}).`
      );
      fieldErrors[`trial.${idx}`] = `Maksimum protokol: ${constraints.max} ${testDef.unit}.`;
      return;
    }

    // Aturan bilangan bulat untuk repetisi (reps)
    if (testDef.unit === 'reps' && !Number.isInteger(numVal)) {
      errors.push(`${trialLabel}: Jumlah repetisi harus berupa bilangan bulat (tanpa desimal).`);
      fieldErrors[`trial.${idx}`] = 'Repetisi harus bilangan bulat.';
      return;
    }

    // Aturan khusus Vertical Jump: H2 harus lebih besar dari H1
    if (schemaType === TEST_INPUT_SCHEMA_TYPES.VERTICAL_JUMP_DELTA && standingReachCm !== null) {
      if (numVal <= standingReachCm) {
        errors.push(
          `${trialLabel}: Tinggi sentuh lompatan H2 (${numVal} cm) harus lebih tinggi daripada Tinggi Raihan Berdiri H1 (${standingReachCm} cm).`
        );
        fieldErrors[`trial.${idx}`] = `Harus > H1 (${standingReachCm} cm).`;
        return;
      }
    }

    const cleanTrial = {
      trialNumber: trialNum,
      label: trialLabel,
      side: expectedSide,
      rawInput: String(rawInput).trim(),
      numericValue: numVal,
      unit: testDef.unit,
      isValid: true,
      invalidReason: null
    };

    normalizedTrials.push(cleanTrial);
    validNumericTrials.push(cleanTrial);
  });

  if (errors.length > 0) {
    return { isValid: false, errors, fieldErrors };
  }

  // Periksa jumlah minimum percobaan sah (mis. RSA wajib 6 sah, Bilateral wajib 2 sah, Ruler Drop wajib 3 sah)
  if (validNumericTrials.length < testDef.minValidTrialsCount) {
    errors.push(
      `Tes "${testDef.testName}" membutuhkan minimal ${testDef.minValidTrialsCount} percobaan yang sah (saat ini baru ${validNumericTrials.length} percobaan sah).`
    );
    fieldErrors.trials = `Minimal ${testDef.minValidTrialsCount} percobaan harus berstatus sah.`;
    return { isValid: false, errors, fieldErrors };
  }

  // ===========================================================================
  // PERHITUNGAN HASIL AKHIR & METRIK TURUNAN BERDASARKAN TIPE SKEMA
  // ===========================================================================
  const decimals = typeof constraints.decimals === 'number' ? constraints.decimals : 2;
  let finalRawValue = null;
  let finalDisplayValue = '';
  let derivedMetrics = {};

  switch (schemaType) {
    case TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MIN: {
      const bestMin = Math.min(...validNumericTrials.map((t) => t.numericValue));
      finalRawValue = roundToDecimals(bestMin, decimals);
      finalDisplayValue = `${finalRawValue} ${testDef.unit}`;
      derivedMetrics = {
        bestValue: finalRawValue,
        validTrialsCount: validNumericTrials.length,
        totalTrialsCount: normalizedTrials.length
      };
      break;
    }

    case TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MAX: {
      const bestMax = Math.max(...validNumericTrials.map((t) => t.numericValue));
      finalRawValue = roundToDecimals(bestMax, decimals);
      finalDisplayValue = `${finalRawValue} ${testDef.unit}`;
      derivedMetrics = {
        bestValue: finalRawValue,
        validTrialsCount: validNumericTrials.length,
        totalTrialsCount: normalizedTrials.length
      };
      if (testDef.testId === 'TST-MOB-SAR') {
        derivedMetrics.relativeToHeelLineCm = roundToDecimals(finalRawValue - 25.0, 1);
      }
      break;
    }

    case TEST_INPUT_SCHEMA_TYPES.SINGLE_TRIAL_MAX: {
      const val = validNumericTrials[0].numericValue;
      finalRawValue = roundToDecimals(val, decimals);
      finalDisplayValue = `${finalRawValue} ${testDef.unit}`;
      derivedMetrics = {
        validTrialsCount: 1
      };
      break;
    }

    case TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_AVERAGE: {
      const sum = validNumericTrials.reduce((acc, t) => acc + t.numericValue, 0);
      const avg = sum / validNumericTrials.length;
      finalRawValue = roundToDecimals(avg, decimals);
      derivedMetrics = {
        averageValue: finalRawValue,
        bestValue: roundToDecimals(Math.min(...validNumericTrials.map((t) => t.numericValue)), decimals),
        validTrialsCount: validNumericTrials.length
      };

      // Khusus Ruler Drop Test (TST-RXN-RLR): hitung waktu reaksi dalam milidetik (ms)
      if (testDef.testId === 'TST-RXN-RLR') {
        const reactionTimeMs = Math.sqrt((2 * avg) / 980) * 1000;
        const roundedMs = roundToDecimals(reactionTimeMs, 1);
        derivedMetrics.estimatedReactionTimeMs = roundedMs;
        finalDisplayValue = `${finalRawValue} cm (~${roundedMs} ms)`;
      } else {
        finalDisplayValue = `${finalRawValue} ${testDef.unit}`;
      }
      break;
    }

    case TEST_INPUT_SCHEMA_TYPES.BILATERAL_AVERAGE:
    case TEST_INPUT_SCHEMA_TYPES.BILATERAL_BEST_AVERAGE: {
      const leftTrial = validNumericTrials.find((t) => t.side === 'LEFT');
      const rightTrial = validNumericTrials.find((t) => t.side === 'RIGHT');

      if (!leftTrial || !rightTrial) {
        return {
          isValid: false,
          errors: [`Tes "${testDef.testName}" mewajibkan hasil sah untuk kedua sisi (Kanan dan Kiri).`],
          fieldErrors: { trials: 'Kedua sisi (Kanan & Kiri) wajib sah.' }
        };
      }

      const avg = (leftTrial.numericValue + rightTrial.numericValue) / 2;
      const asymmetryDiff = Math.abs(leftTrial.numericValue - rightTrial.numericValue);
      const asymmetryPct = (asymmetryDiff / Math.max(leftTrial.numericValue, rightTrial.numericValue)) * 100;

      finalRawValue = roundToDecimals(avg, decimals);
      finalDisplayValue = `${finalRawValue} ${testDef.unit} (Ka: ${rightTrial.numericValue}${testDef.unit} | Ki: ${leftTrial.numericValue}${testDef.unit})`;
      derivedMetrics = {
        rightValue: rightTrial.numericValue,
        leftValue: leftTrial.numericValue,
        averageValue: finalRawValue,
        bilateralDiff: roundToDecimals(asymmetryDiff, decimals),
        asymmetryPercent: roundToDecimals(asymmetryPct, 1)
      };
      break;
    }

    case TEST_INPUT_SCHEMA_TYPES.VERTICAL_JUMP_DELTA: {
      const bestJumpReachCm = Math.max(...validNumericTrials.map((t) => t.numericValue));
      const deltaCm = bestJumpReachCm - standingReachCm;
      finalRawValue = roundToDecimals(deltaCm, decimals);
      finalDisplayValue = `${finalRawValue} cm (H2: ${bestJumpReachCm} cm − H1: ${standingReachCm} cm)`;
      derivedMetrics = {
        standingReachCm,
        bestJumpReachCm,
        netVerticalJumpCm: finalRawValue,
        trialDeltasCm: validNumericTrials.map((t) => ({
          trialNumber: t.trialNumber,
          jumpReachCm: t.numericValue,
          netJumpCm: roundToDecimals(t.numericValue - standingReachCm, decimals)
        }))
      };
      break;
    }

    case TEST_INPUT_SCHEMA_TYPES.RSA_6X30M: {
      const sprintTimes = validNumericTrials.map((t) => t.numericValue);
      const totalSprintTime = sprintTimes.reduce((acc, v) => acc + v, 0);
      const bestSprintTime = Math.min(...sprintTimes);
      const worstSprintTime = Math.max(...sprintTimes);
      const meanSprintTime = totalSprintTime / 6;
      const idealTotalTime = 6 * bestSprintTime;
      const fatigueIndexPct = ((totalSprintTime / idealTotalTime) - 1) * 100;

      finalRawValue = roundToDecimals(totalSprintTime, 2);
      const roundedFi = roundToDecimals(fatigueIndexPct, 2);
      finalDisplayValue = `${finalRawValue} s (FI: ${roundedFi}% | Best: ${roundToDecimals(bestSprintTime, 2)} s)`;
      derivedMetrics = {
        totalSprintTimeSec: finalRawValue,
        bestSprintTimeSec: roundToDecimals(bestSprintTime, 2),
        worstSprintTimeSec: roundToDecimals(worstSprintTime, 2),
        meanSprintTimeSec: roundToDecimals(meanSprintTime, 2),
        fatigueIndexPercent: roundedFi,
        sprintBreakdownSec: sprintTimes
      };
      break;
    }

    default: {
      return {
        isValid: false,
        errors: [`Skema perhitungan "${schemaType}" belum dikenali.`],
        fieldErrors
      };
    }
  }

  const hasInvalidTrial = normalizedTrials.some((t) => !t.isValid);
  const finalDerivedMetrics = resolvedMeasurementMethod
    ? { ...derivedMetrics, measurementMethod: resolvedMeasurementMethod }
    : derivedMetrics;

  return {
    isValid: true,
    errors: [],
    fieldErrors: {},
    normalizedRecord: {
      testId: testDef.testId,
      testName: testDef.testName,
      indicatorId: testDef.indicatorId,
      indicatorName: testDef.indicatorName,
      categoryId: testDef.categoryId,
      testDate,
      measurementMethod: resolvedMeasurementMethod,
      inputSchemaType: schemaType,
      trials: normalizedTrials,
      auxiliaryInputs: schemaType === TEST_INPUT_SCHEMA_TYPES.VERTICAL_JUMP_DELTA
        ? { standingReachCm }
        : resolvedMeasurementMethod
          ? { measurementMethod: resolvedMeasurementMethod }
          : {},
      finalRawValue,
      finalUnit: testDef.unit,
      finalDisplayValue,
      aggregationMethod: testDef.finalResultMethod,
      derivedMetrics: finalDerivedMetrics,
      attemptStatus: hasInvalidTrial ? 'PARTIAL_VALID' : 'VALID',
      calibrationStatus: 'PENDING_CALIBRATION',
      mappingReadiness: testDef.mappingReadiness,
      convertedScore: null
    }
  };
}
