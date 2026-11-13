import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTER_FOOTBALL_TESTS_CATALOG,
  calculateAssessmentScore,
  convertRubricLevelToScore,
  aggregateIndicatorScores,
  getMasterTestsForContext,
  buildWizardResumeStorageKey,
  computeWizardSessionProgress,
  resolveWizardStepTransition,
  convertAttendanceRateToScore,
  calculateAthleteAttendanceMetrics,
  normalizeIndicatorKey,
  resolveIndicatorScore,
  buildBaselineIndicatorScoresForAthlete
} from './footballAssessmentEngine.js';

test('calculateAssessmentScore returns null for blank inputs and never returns PENDING_CALIBRATION', () => {
  assert.equal(calculateAssessmentScore({ testCode: 'PHY01', tier: 2, rawValues: {} }), null);
  assert.equal(
    calculateAssessmentScore({ testCode: 'PHY01', tier: 2, rawValues: { raw_value_1: '' } }),
    null
  );
  assert.equal(
    calculateAssessmentScore({ testCode: 'PHY01', tier: 2, rawValues: { raw_value_1: -1 } }),
    null
  );
});

test('calculateAssessmentScore converts ACCURACY tests (TEC03, TEC07) across tiers into integer 1-100', () => {
  // TEC03 Short Passing Gate Accuracy in Tier 2: benchmark { poor: 35, fair: 58, good: 78, elite: 92 }
  // 10/10 = 100% -> 100
  const perfect = calculateAssessmentScore({
    testCode: 'TEC03',
    tier: 2,
    rawValues: { raw_value_1: 10, raw_value_2: 10 }
  });
  assert.equal(perfect, 100);

  // 8/10 = 80% -> between good (78 -> 80) and elite (92 -> 96) => ~82
  const goodScore = calculateAssessmentScore({
    testCode: 'TEC03',
    tier: 2,
    rawValues: { raw_value_1: 8, raw_value_2: 10 }
  });
  assert.ok(goodScore !== null && goodScore >= 80 && goodScore <= 86);

  // Same 8/10 in Tier 4 (U17+) has stricter norms than Tier 1 (U6-U9)
  const tier1Score = calculateAssessmentScore({
    testCode: 'TEC07',
    tier: 1,
    rawValues: { raw_value_1: 7, raw_value_2: 10 }
  });
  const tier4Score = calculateAssessmentScore({
    testCode: 'TEC07',
    tier: 4,
    rawValues: { raw_value_1: 7, raw_value_2: 10 }
  });
  assert.ok(tier1Score !== null && tier4Score !== null);
  assert.ok(tier1Score > tier4Score);
});

test('calculateAssessmentScore handles TIME with is_lower_better=true (fastest trial + cone error penalty)', () => {
  // PHY01 Sprint 10m in Tier 3: { poor: 2.30, fair: 2.06, good: 1.86, elite: 1.70 }
  // Trial 1 = 1.98s, Trial 2 = 1.86s -> picks fastest 1.86s -> exact good anchor = 80
  const score = calculateAssessmentScore({
    testCode: 'PHY01',
    tier: 3,
    rawValues: { raw_value_1: 1.98, raw_value_2: 1.86, errors_count: 0 }
  });
  assert.equal(score, 80);

  // TEC05 Figure-8 Slalom Dribbling Time in Tier 2: { poor: 14.2, fair: 12.0, good: 10.1, elite: 8.6 }
  const cleanScore = calculateAssessmentScore({
    testCode: 'TEC05',
    tier: 2,
    rawValues: { raw_value_1: 9.8, errors_count: 0 }
  });
  const penalizedScore = calculateAssessmentScore({
    testCode: 'TEC05',
    tier: 2,
    rawValues: { raw_value_1: 9.8, errors_count: 3 } // +0.75s penalty
  });
  assert.ok(cleanScore !== null && penalizedScore !== null);
  assert.ok(cleanScore > penalizedScore);
});

test('calculateAssessmentScore handles TIME with is_lower_better=false (PHY09 Single-Leg Balance Hold)', () => {
  // PHY09 in Tier 2: { poor: 15, fair: 26, good: 38, elite: 52 }
  // Longer duration = higher score; picks max of 2 trials
  const score = calculateAssessmentScore({
    testCode: 'PHY09',
    tier: 2,
    rawValues: { raw_value_1: 30, raw_value_2: 38, errors_count: 0 }
  });
  assert.equal(score, 80);
});

test('calculateAssessmentScore handles DISTANCE (PHY06 Yo-Yo & PHY07 Broad Jump) and REPS (TEC01, PHY10)', () => {
  // PHY06 Yo-Yo in Tier 3: { poor: 720, fair: 1120, good: 1560, elite: 2040 }
  const yoyoGood = calculateAssessmentScore({
    testCode: 'PHY06',
    tier: 3,
    rawValues: { raw_value_1: 1560 }
  });
  assert.equal(yoyoGood, 80);

  // TEC01 Wall First-Touch in Tier 2: { poor: 10, fair: 15, good: 21, elite: 27 }
  const repsElite = calculateAssessmentScore({
    testCode: 'TEC01',
    tier: 2,
    rawValues: { raw_value_1: 27, errors_count: 0 }
  });
  assert.equal(repsElite, 96);
});

test('calculateAssessmentScore & convertRubricLevelToScore convert RUBRIC 1-5 to exact anchored scores', () => {
  assert.equal(convertRubricLevelToScore(1), 35);
  assert.equal(convertRubricLevelToScore(2), 52);
  assert.equal(convertRubricLevelToScore(3), 70);
  assert.equal(convertRubricLevelToScore(4), 84);
  assert.equal(convertRubricLevelToScore(5), 95);

  assert.equal(
    calculateAssessmentScore({ testCode: 'MEN01', tier: 1, rawValues: { raw_value_1: 4 } }),
    84
  );
  assert.equal(
    calculateAssessmentScore({ testCode: 'TAC01', tier: 3, rawValues: { raw_value_1: 5 } }),
    95
  );
});

test('aggregateIndicatorScores combines multi-test indicators (Dribbling TEC05+TEC06 & Finishing TEC07+TEC08)', () => {
  // TEC05 has weight 0.6, TEC06 has weight 0.4 -> both map to 'dribbling'
  // If TEC05 = 80 and TEC06 = 90 -> weighted average = 80*0.6 + 90*0.4 = 48 + 36 = 84
  const aggregated = aggregateIndicatorScores([
    { test_code: 'TEC05', calculated_score: 80 },
    { test_code: 'TEC06', calculated_score: 90 },
    { test_code: 'PHY01', calculated_score: 88 }
  ]);

  assert.ok(aggregated.dribbling);
  assert.equal(aggregated.dribbling.score, 84);
  assert.equal(aggregated.dribbling.indicator_label, 'Dribbling');
  assert.equal(aggregated.dribbling.tests_count, 2);
  assert.deepEqual(aggregated.dribbling.test_codes, ['TEC05', 'TEC06']);

  assert.ok(aggregated.akselerasi);
  assert.equal(aggregated.akselerasi.score, 88);
  assert.equal(aggregated.akselerasi.tests_count, 1);
});

test('all 38 tests in MASTER_FOOTBALL_TESTS_CATALOG produce valid 1-100 integer scores', () => {
  assert.ok(MASTER_FOOTBALL_TESTS_CATALOG.length >= 38);
  for (const testItem of MASTER_FOOTBALL_TESTS_CATALOG) {
    const sampleRaw =
      testItem.measurement_type === 'RUBRIC'
        ? { raw_value_1: 4 }
        : testItem.measurement_type === 'ACCURACY'
          ? { raw_value_1: 8, raw_value_2: 10 }
          : testItem.measurement_type === 'TIME'
            ? { raw_value_1: testItem.is_lower_better ? 2.1 : 35 }
            : { raw_value_1: 40 };

    const score = calculateAssessmentScore({
      testCode: testItem.test_code,
      tier: 4,
      rawValues: sampleRaw
    });
    assert.equal(typeof score, 'number', `Test ${testItem.test_code} did not return a number`);
    assert.ok(score !== null && score >= 1 && score <= 100, `Test ${testItem.test_code} out of range: ${score}`);
  }

  const tier1Tests = getMasterTestsForContext({ tier: 1, category: 'ALL' });
  const tier4Tests = getMasterTestsForContext({ tier: 4, category: 'ALL' });
  assert.ok(tier4Tests.length > tier1Tests.length);
});

test('computeWizardSessionProgress & resolveWizardStepTransition manage Step-by-Step Test Wizard state', () => {
  const storageKey = buildWizardResumeStorageKey('demo-tenant-1', 'athlete-99');
  assert.equal(storageKey, 'chuvator_football_wizard_resume_demo-tenant-1_athlete-99');

  const sampleTests = getMasterTestsForContext({ tier: 2, category: 'Fisik' });
  assert.ok(sampleTests.length >= 5);

  const progress1 = computeWizardSessionProgress({
    wizardTests: sampleTests,
    inputsByCode: {
      PHY01: { raw_value_1: '1.90', raw_value_2: '', errors_count: '0' }
    },
    completedTestCodes: ['PHY01'],
    skippedTestCodes: ['PHY03'],
    currentStepIndex: 0,
    tier: 2
  });

  assert.equal(progress1.currentStepNumber, 1);
  assert.equal(progress1.currentTest?.test_code, 'PHY01');
  assert.ok(progress1.currentLiveScore !== null && progress1.currentLiveScore >= 80);
  assert.equal(progress1.completedCount, 1);
  assert.equal(progress1.skippedCount, 1);

  const stepAfterSave = resolveWizardStepTransition({
    currentStepIndex: 0,
    totalSteps: sampleTests.length,
    testCode: 'PHY01',
    action: 'save_next',
    completedTestCodes: [],
    skippedTestCodes: ['PHY01']
  });
  assert.equal(stepAfterSave.nextStepIndex, 1);
  assert.equal(stepAfterSave.isCompletedAllSteps, false);
  assert.deepEqual(stepAfterSave.completedTestCodes, ['PHY01']);
  assert.deepEqual(stepAfterSave.skippedTestCodes, []);

  const stepAfterSkip = resolveWizardStepTransition({
    currentStepIndex: 1,
    totalSteps: sampleTests.length,
    testCode: sampleTests[1].test_code,
    action: 'skip',
    completedTestCodes: stepAfterSave.completedTestCodes,
    skippedTestCodes: stepAfterSave.skippedTestCodes
  });
  assert.equal(stepAfterSkip.nextStepIndex, 2);
  assert.ok(stepAfterSkip.skippedTestCodes.includes(sampleTests[1].test_code));
});

test('convertAttendanceRateToScore, calculateAthleteAttendanceMetrics, and buildBaselineIndicatorScoresForAthlete ensure zero empty indicators', () => {
  assert.equal(convertAttendanceRateToScore(92), 95);
  assert.equal(convertAttendanceRateToScore(40), 40);

  const sampleAttendance = [
    {
      date: '2025-05-01',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-03',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-05',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-07',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-09',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-11',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-13',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-15',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-17',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Hadir' }]
    },
    {
      date: '2025-05-19',
      records: [{ studentId: 'demo-student-1', studentName: 'Rafa Pratama', status: 'Izin' }]
    }
  ];

  const metrics = calculateAthleteAttendanceMetrics(
    sampleAttendance,
    'demo-student-1',
    'Rafa Pratama'
  );
  assert.equal(metrics.attendancePercentage, 90);
  assert.equal(metrics.badgeText, 'Terhubung Otomatis ke Modul Presensi (90%)');
  assert.equal(metrics.indicators.kehadiran_latihan.score, 95);
  assert.ok(metrics.indicators.kepatuhan_program.score >= 90);
  assert.ok(metrics.indicators.konsistensi_kehadiran.score >= 85);

  assert.equal(normalizeIndicatorKey('Kehadiran Latihan'), 'kehadiran_latihan');
  assert.equal(normalizeIndicatorKey('Kontrol Bola'), 'kontrol_bola');
  assert.equal(normalizeIndicatorKey('Posisi Bertahan'), 'posisi_bertahan');

  const baseline = buildBaselineIndicatorScoresForAthlete({
    athleteId: 'demo-student-1',
    athleteName: 'Rafa Pratama',
    tier: 1,
    attendanceRows: sampleAttendance
  });

  // Verify every indicator in baseline is > 0 and resolveIndicatorScore works with both snake_case and label
  const flatScores: Record<string, number> = {};
  Object.entries(baseline).forEach(([k, v]: [string, any]) => {
    assert.ok(v.score >= 1 && v.score <= 100, `Indicator ${k} invalid score: ${v.score}`);
    flatScores[k] = v.score;
  });

  assert.equal(resolveIndicatorScore(flatScores, 'Kehadiran Latihan'), 95);
  assert.equal(resolveIndicatorScore(flatScores, 'kehadiran_latihan'), 95);
  assert.ok(resolveIndicatorScore(flatScores, 'Akselerasi') > 0);
  assert.ok(resolveIndicatorScore(flatScores, 'Kontrol Bola') > 0);
  assert.ok(resolveIndicatorScore(flatScores, 'Posisi Bertahan') > 0);
  assert.ok(resolveIndicatorScore(flatScores, 'Fokus') > 0);
  assert.ok(resolveIndicatorScore(flatScores, 'Komunikasi Verbal') > 0);
});


