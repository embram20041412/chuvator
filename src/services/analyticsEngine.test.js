import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeAthletePerformance,
  analyzePositionEventPerformance,
  analyzeAthleteDevelopment,
  compareAthletes,
  analyzeAcademyTeamPerformance,
  generateAnalyticsReport,
  analyzeDataQuality
} from './analyticsEngine.js';

// TEST 1: Missing score versus valid zero
test('1. Missing score (null) === UNTESTED vs Valid 0 score', () => {
  const mockScores = {
    'FTB-UNI-PHY-01': 85,
    'FTB-UNI-PHY-02': 0 // Explicit 0
  };

  const result = analyzeAthletePerformance({
    scores: mockScores,
    sport: 'football',
    activeTier: 1,
    playerRole: 'CB'
  });

  const phyCat = result.categoryAnalysis.fisik;
  assert.equal(phyCat.evaluatedCount, 2);
  assert.equal(phyCat.categoryAverage, 43); // Math.round((85 + 0) / 2) = 43
  assert.equal(phyCat.indicators.find(i => i.id === 'FTB-UNI-PHY-02').score, 0);
  assert.equal(phyCat.indicators.find(i => i.id === 'FTB-UNI-PHY-03').score, null);
});

// TEST 2: Partial versus complete evaluation
test('2. Partial vs Complete evaluation coverage', () => {
  const partialScores = { 'FTB-UNI-PHY-01': 90 };
  const completeScores = {};
  for (let i = 1; i <= 5; i++) {
    completeScores[`FTB-UNI-PHY-0${i}`] = 80;
  }

  const partialRes = analyzeAthletePerformance({ scores: partialScores, sport: 'football', activeTier: 1 });
  const completeRes = analyzeAthletePerformance({ scores: completeScores, sport: 'football', activeTier: 1 });

  assert.ok(partialRes.evaluationCoverage < completeRes.evaluationCoverage);
  assert.equal(partialRes.categoryAnalysis.fisik.completenessPercent, 20); // 1 / 5 = 20%
  assert.equal(completeRes.categoryAnalysis.fisik.completenessPercent, 100); // 5 / 5 = 100%
});

// TEST 3: Tenant A versus Tenant B isolation (Negative Test)
test('3. Tenant Isolation Negative Test (Tenant A vs Tenant B)', () => {
  const students = [
    { id: 's1', name: 'Student Tenant A', tenantId: 'tenant-a' },
    { id: 's2', name: 'Student Tenant B', tenantId: 'tenant-b' }
  ];

  const evaluations = [
    { id: 'e1', studentId: 's1', tenantId: 'tenant-a', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 95 } },
    { id: 'e2', studentId: 's2', tenantId: 'tenant-b', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 40 } }
  ];

  const teamA = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: 'tenant-a' });
  const teamB = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: 'tenant-b' });

  assert.equal(teamA.totalStudents, 1);
  assert.equal(teamA.teamCategoryAverages.fisik, 95);

  assert.equal(teamB.totalStudents, 1);
  assert.equal(teamB.teamCategoryAverages.fisik, 40);

  // Negative assertion: Tenant B data must NOT leak into Tenant A result
  assert.equal(teamA.evaluatedStudentsCount, 1);
  assert.notEqual(teamA.teamCategoryAverages.fisik, 40);
});

// TEST 4: Cross-sport comparison rejection
test('4. Cross-sport comparison rejection', () => {
  const athleteA = { name: 'Footballer', sport: 'football', scores: { 'FTB-UNI-PHY-01': 80 } };
  const athleteB = { name: 'Badminton Player', sport: 'badminton', scores: { 'BDM-UNI-PHY-01': 80 } };

  const comp = compareAthletes({
    athleteA,
    athleteB,
    sportA: 'football',
    sportB: 'badminton'
  });

  assert.equal(comp.isComparable, false);
  assert.equal(comp.errorReason, 'CROSS_SPORT_MISMATCH');
});

// TEST 5: Position/event mismatch handling
test('5. Position/event mismatch handling', () => {
  const athleteA = { name: 'Defender', playerRole: 'CB', scores: { 'FTB-UNI-PHY-01': 80, 'FTB-POS-CB-01': 90 } };
  const athleteB = { name: 'Striker', playerRole: 'ST', scores: { 'FTB-UNI-PHY-01': 85, 'FTB-POS-ST-01': 88 } };

  const comp = compareAthletes({
    athleteA,
    athleteB,
    sport: 'football',
    activeTier: 2
  });

  assert.equal(comp.isComparable, true);
  assert.equal(comp.positionMismatch, true);
  assert.equal(comp.categoryComparison.spesifik_posisi.diff, null);
  assert.ok(comp.categoryComparison.spesifik_posisi.mismatchNote);
});

// TEST 6: Insufficient longitudinal data handling
test('6. Insufficient longitudinal data handling', () => {
  const singleEval = [{ id: 'e1', date: '2026-01-01', scores: { 'FTB-UNI-PHY-01': 80 } }];
  const devResult = analyzeAthleteDevelopment({ evaluations: singleEval, sport: 'football' });

  assert.equal(devResult.hasHistory, false);
  assert.equal(devResult.trendDirection, 'INSUFFICIENT_DATA');
  assert.equal(devResult.trendClassification, 'INSUFFICIENT_DATA');
});

// TEST 7: Chronological ordering
test('7. Chronological ordering of evaluations', () => {
  const evaluationsOut = [
    { id: 'e2', date: '2026-06-01', scores: { 'FTB-UNI-PHY-01': 90 } },
    { id: 'e1', date: '2026-01-01', scores: { 'FTB-UNI-PHY-01': 70 } }
  ];

  const devResult = analyzeAthleteDevelopment({ evaluations: evaluationsOut, sport: 'football', activeTier: 1 });

  assert.equal(devResult.evaluationTimeline[0].id, 'e1'); // Oldest first
  assert.equal(devResult.evaluationTimeline[1].id, 'e2'); // Newest second
  assert.equal(devResult.overallDelta, 20); // 90 - 70 = +20
  assert.equal(devResult.trendClassification, 'PRELIMINARY_TREND'); // 2 sessions = PRELIMINARY
});

// TEST 8: Invalid score detection
test('8. Invalid score detection (>100 or <0 or NaN)', () => {
  const invalidEvals = [
    { id: 'e1', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 150, 'FTB-UNI-PHY-02': -10, 'FTB-UNI-PHY-03': 'abc' } }
  ];

  const dq = analyzeDataQuality({ evaluations: invalidEvals, sport: 'football' });

  assert.equal(dq.totalInvalidScores, 3);
  assert.ok(dq.dataQualityScore < 100);
});

// TEST 9: Empty dataset handling
test('9. Empty dataset handling', () => {
  const emptyPerf = analyzeAthletePerformance({ scores: {}, sport: 'football' });
  const emptyTeam = analyzeAcademyTeamPerformance({ evaluations: [], students: [], sport: 'football' });
  const emptyDev = analyzeAthleteDevelopment({ evaluations: [], sport: 'football' });

  assert.equal(emptyPerf.overallScore, null);
  assert.equal(emptyPerf.evaluationCoverage, 0);
  assert.equal(emptyTeam.totalStudents, 0);
  assert.equal(emptyTeam.teamOverallAverage, null);
  assert.equal(emptyDev.hasHistory, false);
});

// TEST 10: Historical legacy score resolution
test('10. Historical legacy score resolution', () => {
  const legacyScores = {
    'Akselerasi': 88, // Legacy name key for FTB-UNI-PHY-01
    'Kelincahan': 92  // Legacy name key for FTB-UNI-PHY-02
  };

  const perf = analyzeAthletePerformance({ scores: legacyScores, sport: 'football', activeTier: 1 });
  const phy = perf.categoryAnalysis.fisik;

  assert.equal(phy.evaluatedCount, 2);
  assert.equal(phy.categoryAverage, 90); // Math.round((88 + 92) / 2)
});

// TEST 11: Desktop and Mobile Integration Contract
test('11. Integration Contract for Desktop and Mobile components', () => {
  const sampleEvals = [{ id: 'e1', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 80 } }];
  const sampleStudents = [{ id: 's1', studentName: 'Test Student', playerRole: 'CB' }];

  const report = generateAnalyticsReport({
    type: 'INDIVIDUAL_ATHLETE',
    athleteData: sampleStudents[0],
    analyticsResult: analyzeAthletePerformance({ scores: sampleEvals[0].scores, sport: 'football', activeTier: 1 }),
    tenantName: 'CHUVATOR Main'
  });

  assert.equal(report.athleteContext.name, 'Test Student');
  assert.ok(report.metricsSummary.overallScore);
});

// TEST 12: Report Payload Completeness
test('12. Report payload completeness', () => {
  const perf = analyzeAthletePerformance({
    scores: { 'FTB-UNI-PHY-01': 85, 'FTB-UNI-TEC-01': 95 },
    sport: 'football',
    activeTier: 1
  });

  const report = generateAnalyticsReport({
    type: 'INDIVIDUAL_ATHLETE',
    athleteData: { id: 's1', studentName: 'Budi', className: 'U-10', sport: 'football', playerRole: 'CB' },
    analyticsResult: perf,
    tenantName: 'Akademi Utama'
  });

  assert.ok(report.generatedAt);
  assert.equal(report.reportType, 'INDIVIDUAL_ATHLETE');
  assert.equal(report.athleteContext.name, 'Budi');
  assert.ok(report.categoryAnalysis.fisik);
  assert.ok(report.categoryAnalysis.teknik);
});

// TEST 13: Longitudinal Integrity (Position change, tier change, coverage shift, 3-session trend)
test('13. Longitudinal Integrity: Position change, tier change, coverage shift, and robust trend rules', () => {
  const longitudinalEvals = [
    { id: 'e1', date: '2026-01-01', activeTier: 1, playerRole: 'CB', scores: { 'FTB-UNI-PHY-01': 60 } },
    { id: 'e2', date: '2026-03-01', activeTier: 1, playerRole: 'ST', scores: { 'FTB-UNI-PHY-01': 70, 'FTB-UNI-PHY-02': 75 } },
    { id: 'e3', date: '2026-06-01', activeTier: 2, playerRole: 'ST', scores: {
      'FTB-UNI-PHY-01': 85, 'FTB-UNI-PHY-02': 88, 'FTB-UNI-PHY-03': 90, 'FTB-UNI-PHY-04': 92, 'FTB-UNI-PHY-05': 95,
      'FTB-UNI-PHY-06': 90, 'FTB-UNI-PHY-07': 90, 'FTB-UNI-PHY-08': 90, 'FTB-UNI-PHY-09': 90, 'FTB-UNI-TEC-01': 90,
      'FTB-UNI-TEC-02': 90, 'FTB-UNI-TEC-03': 90, 'FTB-UNI-TEC-04': 90, 'FTB-UNI-TEC-05': 90, 'FTB-UNI-TEC-06': 90,
      'FTB-UNI-TEC-07': 90, 'FTB-UNI-TEC-08': 90, 'FTB-UNI-TEC-09': 90, 'FTB-UNI-TEC-10': 90, 'FTB-UNI-TAC-01': 90,
      'FTB-UNI-TAC-02': 90, 'FTB-UNI-TAC-03': 90, 'FTB-UNI-TAC-04': 90, 'FTB-UNI-MEN-01': 90, 'FTB-UNI-MEN-02': 90
    } }
  ];

  const dev = analyzeAthleteDevelopment({
    evaluations: longitudinalEvals,
    sport: 'football',
    activeTier: 1,
    playerRole: 'CB'
  });

  assert.equal(dev.hasHistory, true);
  assert.equal(dev.timelineCount, 3);
  assert.equal(dev.positionChanged, true); // CB -> ST
  assert.equal(dev.tierChanged, true); // Tier 1 -> Tier 2
  assert.equal(dev.contextMismatch, true);
  assert.equal(dev.significantCoverageShift, true); // Shift in evaluated indicators >= 25%
  assert.equal(dev.trendClassification, 'ESTABLISHED_TREND'); // >= 3 sessions = ESTABLISHED_TREND
  assert.equal(dev.trendDirection, 'IMPROVING');
});

// TEST 14: Strict Fail-Closed Tenant Isolation (Section 3.B Compliance)
test('14. Strict Fail-Closed Tenant Isolation: null, undefined, empty, mixed, missing tenantId', () => {
  const students = [
    { id: 's1', name: 'Tenant A Student 1', tenantId: 'tenant-a' },
    { id: 's2', name: 'Tenant A Student 2', tenantId: 'tenant-a' },
    { id: 's3', name: 'Tenant B Student', tenantId: 'tenant-b' },
    { id: 's4', name: 'No Tenant Student', tenantId: null }
  ];

  const evaluations = [
    { id: 'e1', studentId: 's1', tenantId: 'tenant-a', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 90 } },
    { id: 'e2', studentId: 's2', tenantId: 'tenant-a', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 80 } },
    { id: 'e3', studentId: 's3', tenantId: 'tenant-b', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 30 } },
    { id: 'e4', studentId: 's4', tenantId: null, activeTier: 1, scores: { 'FTB-UNI-PHY-01': 50 } }
  ];

  // 14.1. Valid tenantId ('tenant-a')
  const validRes = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: 'tenant-a' });
  assert.equal(validRes.error, undefined);
  assert.equal(validRes.totalStudents, 2);
  assert.equal(validRes.evaluatedStudentsCount, 2);
  assert.equal(validRes.teamCategoryAverages.fisik, 85); // (90 + 80) / 2

  // 14.2. Null tenantId -> FAIL CLOSED
  const nullRes = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: null });
  assert.equal(nullRes.error, 'INVALID_TENANT_ID');
  assert.equal(nullRes.totalStudents, 0);
  assert.equal(nullRes.evaluatedStudentsCount, 0);
  assert.equal(nullRes.teamOverallAverage, null);

  // 14.3. Undefined tenantId -> FAIL CLOSED
  const undefinedRes = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: undefined });
  assert.equal(undefinedRes.error, 'INVALID_TENANT_ID');
  assert.equal(undefinedRes.totalStudents, 0);
  assert.equal(undefinedRes.evaluatedStudentsCount, 0);

  // 14.4. Empty string tenantId -> FAIL CLOSED
  const emptyRes = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: '' });
  assert.equal(emptyRes.error, 'INVALID_TENANT_ID');
  assert.equal(emptyRes.totalStudents, 0);
  assert.equal(emptyRes.evaluatedStudentsCount, 0);

  // 14.5. Mixed Tenant Data & Missing Evaluation tenantId
  const teamBRes = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: 'tenant-b' });
  assert.equal(teamBRes.totalStudents, 1);
  assert.equal(teamBRes.evaluatedStudentsCount, 1);
  assert.equal(teamBRes.teamCategoryAverages.fisik, 30);
  // Ensure Tenant A and No-Tenant data did NOT leak into Tenant B result
  assert.notEqual(teamBRes.teamCategoryAverages.fisik, 85);

  // 14.6. Empty students and evaluations
  const emptyDataRes = analyzeAcademyTeamPerformance({ evaluations: [], students: [], sport: 'football', tenantId: 'tenant-a' });
  assert.equal(emptyDataRes.totalStudents, 0);
  assert.equal(emptyDataRes.evaluatedStudentsCount, 0);
  assert.equal(emptyDataRes.teamOverallAverage, null);
});

// 15. Phase 2.0.6: Athlete Development Assessment Shared Data Contract Across All 8 Modules
test('15. Athlete Development Assessment Integration: Shared history & classStudents across Modules 1-8', () => {
  const tenantId = 'tenant-academy-1';
  const classStudents = [
    { id: 'ath-1', studentName: 'Rizky Pratama', playerRole: 'CM', tenantId },
    { id: 'ath-2', studentName: 'Dimas Aditya', playerRole: 'CM', tenantId }
  ];
  const sharedHistory = [
    {
      id: 'ev-1',
      studentId: 'ath-1',
      studentName: 'Rizky Pratama',
      tenantId,
      classId: 'cls-u15',
      sport: 'football',
      activeTier: 2,
      playerRole: 'CM',
      date: '2026-01-10',
      scores: { 'FTB-UNI-PHY-01': 72, 'FTB-UNI-TEC-01': 75, 'FTB-POS-CM-01': 78 },
      coachNote: 'Evaluasi awal semester'
    },
    {
      id: 'ev-2',
      studentId: 'ath-1',
      studentName: 'Rizky Pratama',
      tenantId,
      classId: 'cls-u15',
      sport: 'football',
      activeTier: 2,
      playerRole: 'CM',
      date: '2026-02-15',
      scores: { 'FTB-UNI-PHY-01': 78, 'FTB-UNI-TEC-01': 80, 'FTB-POS-CM-01': 82 },
      coachNote: 'Evaluasi tengah semester'
    },
    {
      id: 'ev-3',
      studentId: 'ath-1',
      studentName: 'Rizky Pratama',
      tenantId,
      classId: 'cls-u15',
      sport: 'football',
      activeTier: 2,
      playerRole: 'CM',
      date: '2026-03-20',
      scores: { 'FTB-UNI-PHY-01': 84, 'FTB-UNI-TEC-01': 88, 'FTB-POS-CM-01': 90 },
      coachNote: 'Evaluasi akhir kuartal'
    },
    {
      id: 'ev-4',
      studentId: 'ath-2',
      studentName: 'Dimas Aditya',
      tenantId,
      classId: 'cls-u15',
      sport: 'football',
      activeTier: 2,
      playerRole: 'CM',
      date: '2026-03-20',
      scores: { 'FTB-UNI-PHY-01': 76, 'FTB-UNI-TEC-01': 82, 'FTB-POS-CM-01': 80 },
      coachNote: 'Evaluasi kuartal Dimas'
    }
  ];

  const ath1Evals = sharedHistory.filter((h) => h.studentId === 'ath-1');
  const latestAth1 = ath1Evals[ath1Evals.length - 1];
  const latestAth2 = sharedHistory.find((h) => h.studentId === 'ath-2');

  // Module 1 & 2: Performance & Category Analytics
  const perf = analyzeAthletePerformance({
    scores: latestAth1.scores,
    sport: 'football',
    activeTier: latestAth1.activeTier,
    playerRole: latestAth1.playerRole
  });
  assert.ok(perf.overallScore !== null);
  assert.equal(perf.totalEvaluatedCount, 3);

  // Module 3: Position Specific Analytics
  const pos = analyzePositionEventPerformance({
    scores: latestAth1.scores,
    sport: 'football',
    activeTier: latestAth1.activeTier,
    roleOrPosition: 'CM'
  });
  assert.equal(pos.positionAverage, 90);
  assert.equal(pos.evaluatedCount, 1);

  // Module 4: Longitudinal Development Trend (3 sessions -> ESTABLISHED_TREND)
  const dev = analyzeAthleteDevelopment({
    evaluations: ath1Evals,
    sport: 'football'
  });
  assert.equal(dev.hasHistory, true);
  assert.equal(dev.timelineCount, 3);
  assert.equal(dev.trendClassification, 'ESTABLISHED_TREND');
  assert.equal(dev.trendDirection, 'IMPROVING');

  // Module 5: Athlete Comparison
  const comp = compareAthletes({
    athleteA: { id: 'ath-1', name: 'Rizky Pratama', playerRole: 'CM', scores: latestAth1.scores },
    athleteB: { id: 'ath-2', name: 'Dimas Aditya', playerRole: 'CM', scores: latestAth2.scores },
    sport: 'football'
  });
  assert.equal(comp.isComparable, true);
  assert.equal(comp.positionMismatch, false);
  assert.ok(comp.overallDiff > 0);

  // Module 6: Academy & Team Analytics (with strict tenantId)
  const team = analyzeAcademyTeamPerformance({
    evaluations: sharedHistory,
    students: classStudents,
    sport: 'football',
    tenantId
  });
  assert.equal(team.error, undefined);
  assert.equal(team.totalStudents, 2);
  assert.equal(team.evaluatedStudentsCount, 2);
  assert.equal(team.coverageRatePercent, 100);

  // Module 7: Report Generation
  const report = generateAnalyticsReport({
    type: 'INDIVIDUAL_ATHLETE',
    athleteData: classStudents[0],
    analyticsResult: perf,
    tenantName: 'Chua Football Academy'
  });
  assert.equal(report.athleteContext.name, 'Rizky Pratama');
  assert.equal(report.metricsSummary.overallScore, perf.overallScore);

  // Module 8: Data Quality
  const quality = analyzeDataQuality({
    evaluations: sharedHistory,
    sport: 'football'
  });
  assert.equal(quality.totalEvaluations, 4);
  assert.equal(quality.totalInvalidScores, 0);
});

