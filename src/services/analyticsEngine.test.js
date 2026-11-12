import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeAthletePerformance,
  analyzePositionEventPerformance,
  analyzeAthleteDevelopment,
  compareAthletes,
  analyzeAcademyTeamPerformance,
  generateAnalyticsReport,
  analyzeDataQuality,
  toNumericTier,
  getCategoryDisplayLabel,
  getSportIndicatorsRegistry
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

// =========================================================================
// PHASE 2.0.8 MANDATORY REGRESSION TEST SUITE (10 SCENARIOS)
// =========================================================================

// SCENARIO 1: Evaluation record has position, profile has different position -> Evaluation record position wins
test('16. (Phase 2.0.8) DISC-01: Evaluation record position wins over profile position', () => {
  const athleteProfile = { id: 'ath-st', name: 'Striker Boy', playerRole: 'CB', position: 'CB' };
  const evalSnapshot = {
    id: 'eval-snap-1',
    studentId: 'ath-st',
    playerRole: 'ST',
    activeTier: 3,
    scores: { 'FTB-POS-ST-01': 92, 'FTB-POS-ST-02': 88 }
  };

  // Determine effectiveRole as in AnalyticsSection
  const effectiveRole = evalSnapshot.playerRole || athleteProfile.playerRole;
  assert.equal(effectiveRole, 'ST');

  const posAnalysis = analyzePositionEventPerformance({
    scores: evalSnapshot.scores,
    sport: 'football',
    activeTier: evalSnapshot.activeTier,
    roleOrPosition: effectiveRole
  });

  assert.equal(posAnalysis.roleOrPosition, 'ST');
  assert.equal(posAnalysis.isVerified, true);
  assert.equal(posAnalysis.warning, null);
  assert.ok(posAnalysis.indicators.some(i => i.id === 'FTB-POS-ST-01'));
  // Negative assertion: CB indicator must NOT be loaded
  assert.ok(!posAnalysis.indicators.some(i => i.id === 'FTB-POS-CB-01'));
});

// SCENARIO 2: Evaluation record has no position, profile has valid position -> Profile position used
test('17. (Phase 2.0.8) DISC-01: Profile position fallback when evaluation has no position', () => {
  const athleteProfile = { id: 'ath-cm', name: 'Midfielder', playerRole: 'CM' };
  const evalSnapshot = {
    id: 'eval-snap-2',
    studentId: 'ath-cm',
    playerRole: null,
    position: null,
    activeTier: 2,
    scores: { 'FTB-POS-CM-01': 80 }
  };

  const evalRole = evalSnapshot.playerRole || evalSnapshot.position;
  const effectiveRole = (evalRole && typeof evalRole === 'string' && evalRole.trim() !== '' && evalRole.trim() !== 'POSITION_UNVERIFIED')
    ? evalRole.trim()
    : (athleteProfile.playerRole || athleteProfile.position || 'POSITION_UNVERIFIED');

  assert.equal(effectiveRole, 'CM');

  const posAnalysis = analyzePositionEventPerformance({
    scores: evalSnapshot.scores,
    sport: 'football',
    activeTier: evalSnapshot.activeTier,
    roleOrPosition: effectiveRole
  });

  assert.equal(posAnalysis.roleOrPosition, 'CM');
  assert.equal(posAnalysis.isVerified, true);
  assert.equal(posAnalysis.warning, null);
  assert.ok(posAnalysis.indicators.some(i => i.id === 'FTB-POS-CM-01'));
});

// SCENARIO 3: Neither has position -> Status POSITION_UNVERIFIED, no hardcoded 'CB' fallback
test('18. (Phase 2.0.8) DISC-01: Neither has position -> POSITION_UNVERIFIED (No CB fallback)', () => {
  const athleteProfile = { id: 'ath-unverified', name: 'No Role Athlete', playerRole: null };
  const evalSnapshot = {
    id: 'eval-snap-3',
    studentId: 'ath-unverified',
    playerRole: null,
    position: null,
    activeTier: 2,
    scores: {}
  };

  const evalRole = evalSnapshot.playerRole || evalSnapshot.position;
  const profileRole = athleteProfile.playerRole || athleteProfile.position;
  const effectiveRole = (evalRole && typeof evalRole === 'string' && evalRole.trim() !== '' && evalRole.trim() !== 'POSITION_UNVERIFIED')
    ? evalRole.trim()
    : ((profileRole && typeof profileRole === 'string' && profileRole.trim() !== '' && profileRole.trim() !== 'POSITION_UNVERIFIED') ? profileRole.trim() : 'POSITION_UNVERIFIED');

  assert.equal(effectiveRole, 'POSITION_UNVERIFIED');

  const posAnalysis = analyzePositionEventPerformance({
    scores: evalSnapshot.scores,
    sport: 'football',
    activeTier: evalSnapshot.activeTier,
    roleOrPosition: effectiveRole
  });

  // Strict verification: Must NOT fall back to 'CB'
  assert.equal(posAnalysis.roleOrPosition, 'POSITION_UNVERIFIED');
  assert.equal(posAnalysis.isVerified, false);
  assert.equal(posAnalysis.positionAverage, null);
  assert.equal(posAnalysis.indicators.length, 0);
  assert.ok(posAnalysis.warning.includes('Posisi atlet belum terverifikasi'));
});

// SCENARIO 4: Evaluation record tier differs from profile tier -> Evaluation tier wins
test('19. (Phase 2.0.8) Snapshot Tier Priority & String Tier Parsing (FILANESIA_F1 vs Tier 3)', () => {
  const profileTier = 3;
  const evalSnapshotTier = 'FILANESIA_F1'; // Legacy string format

  // Numeric tier parsing must correctly recognize FILANESIA_F1 as Tier 1
  assert.equal(toNumericTier(evalSnapshotTier), 1);
  assert.equal(toNumericTier('FILANESIA_F2'), 2);
  assert.equal(toNumericTier('FILANESIA_F3'), 3);
  assert.equal(toNumericTier('FILANESIA_F4'), 4);

  // Evaluation snapshot tier takes precedence over current profile tier
  const activeTier = evalSnapshotTier || profileTier;
  const registry = getSportIndicatorsRegistry('football', activeTier, 'OUTFIELD_SSB');

  // Tier 1 universal physical indicators = 5 (minTier <= 1)
  assert.equal(registry.categoriesMap.fisik.length, 5);
  // Negative check: Tier 3 has 13 physical indicators, must not be used
  assert.notEqual(registry.categoriesMap.fisik.length, 13);
});

// SCENARIO 5: Athlete changes position between evaluation sessions -> Longitudinal analysis flags positionChanged
test('20. (Phase 2.0.8) Position change between evaluations: positionChanged flag & skipped delta', () => {
  const evaluations = [
    {
      id: 'ev-session-1',
      date: '2025-01-10',
      activeTier: 2,
      playerRole: 'CB',
      scores: { 'FTB-POS-CB-01': 70 }
    },
    {
      id: 'ev-session-2',
      date: '2025-02-15',
      activeTier: 2,
      playerRole: 'ST',
      scores: { 'FTB-POS-ST-01': 85 }
    }
  ];

  const dev = analyzeAthleteDevelopment({
    evaluations,
    sport: 'football'
  });

  assert.equal(dev.positionChanged, true);
  assert.equal(dev.contextMismatch, true);
  // Position category delta must be skipped with clear mismatchNote
  const posDelta = dev.categoryDeltas.spesifik_posisi;
  assert.ok(posDelta);
  assert.equal(posDelta.delta, null);
  assert.ok(posDelta.mismatchNote.includes('Posisi atlet berubah'));
});

// SCENARIO 6: Evaluation records from athlete A never pollute athlete B
test('21. (Phase 2.0.8) Record Isolation: Athlete A vs Athlete B evaluation isolation', () => {
  const studentA = { id: 'ath-alpha', name: 'Alpha Player', playerRole: 'GK' };
  const studentB = { id: 'ath-beta', name: 'Beta Player', playerRole: 'ST' };

  const allEvals = [
    { id: 'ev-a', studentId: 'ath-alpha', playerRole: 'GK', scores: { 'FTB-POS-GK-01': 95 } },
    { id: 'ev-b', studentId: 'ath-beta', playerRole: 'ST', scores: { 'FTB-POS-ST-01': 55 } }
  ];

  // Filtering for athlete A
  const evalsA = allEvals.filter(e => e.studentId === studentA.id);
  const evalsB = allEvals.filter(e => e.studentId === studentB.id);

  assert.equal(evalsA.length, 1);
  assert.equal(evalsB.length, 1);

  const perfA = analyzeAthletePerformance({
    scores: evalsA[0].scores,
    sport: 'football',
    activeTier: 2,
    playerRole: evalsA[0].playerRole
  });

  const perfB = analyzeAthletePerformance({
    scores: evalsB[0].scores,
    sport: 'football',
    activeTier: 2,
    playerRole: evalsB[0].playerRole
  });

  // Strict isolation: A has GK indicators, B has ST indicators
  assert.ok(perfA.categoryAnalysis.spesifik_posisi.indicators.some(i => i.id === 'FTB-POS-GK-01'));
  assert.ok(!perfA.categoryAnalysis.spesifik_posisi.indicators.some(i => i.id === 'FTB-POS-ST-01'));

  assert.ok(perfB.categoryAnalysis.spesifik_posisi.indicators.some(i => i.id === 'FTB-POS-ST-01'));
  assert.ok(!perfB.categoryAnalysis.spesifik_posisi.indicators.some(i => i.id === 'FTB-POS-GK-01'));
});

// SCENARIO 7: Historical evaluation retains its own snapshot context
test('22. (Phase 2.0.8) Historical Snapshot Context Immutability (Profile update does not mutate historical eval)', () => {
  // Historical eval took place when athlete was Tier 1 and role was OUTFIELD_SSB
  const historicalEval = {
    id: 'hist-eval-01',
    studentId: 'ath-evolving',
    date: '2024-06-01',
    activeTier: 1,
    playerRole: 'OUTFIELD_SSB',
    scores: { 'FTB-SSB-OUT-01': 80 }
  };

  // Athlete profile has since evolved to Tier 4 Striker (ST)
  const currentProfile = {
    id: 'ath-evolving',
    name: 'Evolving Talent',
    activeTier: 4,
    playerRole: 'ST'
  };

  // When analyzing the historical evaluation, snapshot context must govern
  const historicalPerf = analyzeAthletePerformance({
    scores: historicalEval.scores,
    sport: 'football',
    activeTier: historicalEval.activeTier,
    playerRole: historicalEval.playerRole
  });

  assert.equal(historicalPerf.totalRegistryIndicators, 27); // Tier 1 total indicators (22 universal + 5 SSB)
  assert.equal(historicalPerf.categoryAnalysis.spesifik_posisi.totalCount, 5); // 5 SSB indicators
  assert.equal(historicalPerf.categoryAnalysis.spesifik_posisi.indicators[0].id, 'FTB-SSB-OUT-01');
});

// SCENARIO 8: Numeric 0 remains valid, null remains untested
test('23. (Phase 2.0.8) Absolute Metric Fidelity: Score 0 is valid EVALUATED, null is UNTESTED', () => {
  const scores = {
    'FTB-UNI-PHY-01': 0,     // Valid 0 score
    'FTB-UNI-PHY-02': null,  // Untested
    'FTB-UNI-PHY-03': undefined // Untested
  };

  const perf = analyzeAthletePerformance({
    scores,
    sport: 'football',
    activeTier: 1
  });

  const phy = perf.categoryAnalysis.fisik;
  const ind0 = phy.indicators.find(i => i.id === 'FTB-UNI-PHY-01');
  const indNull = phy.indicators.find(i => i.id === 'FTB-UNI-PHY-02');
  const indUndef = phy.indicators.find(i => i.id === 'FTB-UNI-PHY-03');

  assert.equal(ind0.status, 'EVALUATED');
  assert.equal(ind0.score, 0);

  assert.equal(indNull.status, 'UNTESTED');
  assert.equal(indNull.score, null);

  assert.equal(indUndef.status, 'UNTESTED');
  assert.equal(indUndef.score, null);

  // Category average must include the 0 score in its calculation
  assert.equal(phy.evaluatedCount, 1);
  assert.equal(phy.categoryAverage, 0);
});

// SCENARIO 9: 7th pillar label consistency: 'KHUSUS POSISI' (uppercase) and 'Khusus Posisi' (titlecase)
test('24. (Phase 2.0.8) DISC-02: 7th pillar label consistency (KHUSUS POSISI / Khusus Posisi)', () => {
  // Check helper directly
  assert.equal(getCategoryDisplayLabel('spesifik_posisi', { uppercase: true }), 'KHUSUS POSISI');
  assert.equal(getCategoryDisplayLabel('spesifik_posisi', { uppercase: false }), 'Khusus Posisi');

  // Check analyzeAthletePerformance categoryAnalysis output
  const perf = analyzeAthletePerformance({
    scores: { 'FTB-POS-CB-01': 88 },
    sport: 'football',
    activeTier: 2,
    playerRole: 'CB'
  });

  const posCat = perf.categoryAnalysis.spesifik_posisi;
  assert.ok(posCat);
  assert.equal(posCat.label, 'KHUSUS POSISI');
  assert.equal(posCat.displayName, 'Khusus Posisi');

  // Universal category check
  assert.equal(getCategoryDisplayLabel('fisik', { uppercase: true }), 'FISIK');
  assert.equal(getCategoryDisplayLabel('fisik', { uppercase: false }), 'Fisik');
});

// SCENARIO 10: Fail-closed tenant isolation & cross-sport rejection remain PASS
test('25. (Phase 2.0.8) Negative Security & Tenant Isolation: Strict fail-closed & cross-sport checks', () => {
  // 1. Fail-closed on missing/null/empty tenantId
  const teamNoTenant = analyzeAcademyTeamPerformance({
    evaluations: [{ id: 'e1', tenantId: 't1' }],
    students: [{ id: 's1', tenantId: 't1' }],
    sport: 'football',
    tenantId: null
  });
  assert.equal(teamNoTenant.error, 'INVALID_TENANT_ID');

  const teamEmptyTenant = analyzeAcademyTeamPerformance({
    evaluations: [{ id: 'e1', tenantId: 't1' }],
    students: [{ id: 's1', tenantId: 't1' }],
    sport: 'football',
    tenantId: ''
  });
  assert.equal(teamEmptyTenant.error, 'INVALID_TENANT_ID');

  // 2. Cross-sport comparison rejection
  const compMismatch = compareAthletes({
    athleteA: { name: 'Player A', sport: 'futsal' },
    athleteB: { name: 'Player B', sport: 'football' }
  });
  assert.equal(compMismatch.isComparable, false);
  assert.equal(compMismatch.errorReason, 'CROSS_SPORT_MISMATCH');
});

