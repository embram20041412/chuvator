import { test } from 'node:test';
import assert from 'node:assert/strict';

test('CHUVATOR — Phase 4.2 Parent Portal Mobile Redesign Unit & Security Tests', async (t) => {
  // 1. Child Selection Isolation Security Test
  await t.test('1. Child Selection Security: Only authenticated children from session list are selectable', () => {
    const verifiedSessionChildren = [
      { id: 'child-1-uuid', studentId: 'child-1-uuid', studentName: 'Ananda Rizky', tenantId: 'tenant-1-uuid' },
      { id: 'child-2-uuid', studentId: 'child-2-uuid', studentName: 'Aisyah Putri', tenantId: 'tenant-1-uuid' },
    ];

    const canSelectChild = (candidateId: string, allowedChildren: typeof verifiedSessionChildren) => {
      return allowedChildren.some(c => String(c.studentId || c.id).toLowerCase() === candidateId.toLowerCase());
    };

    // Valid child from verified session
    assert.equal(canSelectChild('child-1-uuid', verifiedSessionChildren), true);
    assert.equal(canSelectChild('child-2-uuid', verifiedSessionChildren), true);

    // Unrelated / malicious candidate child ID (e.g. from URL tampering)
    assert.equal(canSelectChild('unauthorized-child-uuid', verifiedSessionChildren), false);
    assert.equal(canSelectChild('another-tenant-student-999', verifiedSessionChildren), false);
    assert.equal(canSelectChild('', verifiedSessionChildren), false);
  });

  // 2. Viewport Breakpoint Logic Test (Mobile <= 767px vs Desktop >= 768px)
  await t.test('2. Viewport Breakpoint Switch: Correctly divides mobile (<=767px) and desktop (>=768px)', () => {
    const checkIsMobile = (width: number, breakpoint = 767) => width <= breakpoint;

    // Mobile Viewports requested in Phase 4.2
    assert.equal(checkIsMobile(360), true, '360px must be mobile');
    assert.equal(checkIsMobile(390), true, '390px must be mobile');
    assert.equal(checkIsMobile(430), true, '430px must be mobile');
    assert.equal(checkIsMobile(767), true, '767px must be mobile');

    // Desktop & Tablet Viewports requested in Phase 4.2
    assert.equal(checkIsMobile(768), false, '768px must be desktop branch');
    assert.equal(checkIsMobile(1024), false, '1024px must be desktop branch');
    assert.equal(checkIsMobile(1366), false, '1366px must be desktop branch');
    assert.equal(checkIsMobile(1440), false, '1440px must be desktop branch');
  });

  // 3. Evaluation Grade Helper Pure Logic
  await t.test('3. Evaluation Grade: Accurately classifies performance score ranges', () => {
    const getEvaluationGrade = (score: number) => {
      const s = Number(score) || 0;
      if (s >= 90) return 'Istimewa';
      if (s >= 80) return 'Sangat Baik';
      if (s >= 70) return 'Baik';
      if (s >= 60) return 'Cukup';
      return 'Perlu Bimbingan';
    };

    assert.equal(getEvaluationGrade(95), 'Istimewa');
    assert.equal(getEvaluationGrade(85), 'Sangat Baik');
    assert.equal(getEvaluationGrade(75), 'Baik');
    assert.equal(getEvaluationGrade(65), 'Cukup');
    assert.equal(getEvaluationGrade(50), 'Perlu Bimbingan');
  });

  // 4. BMI Classification Helper Pure Logic
  await t.test('4. BMI Classification: Accurately classifies body posture categories', () => {
    const getBmiStatus = (status?: string, bmi?: number) => {
      const s = String(status || '').toLowerCase();
      if (s.includes('proporsional') || s.includes('normal') || s.includes('ideal')) return 'Proporsional';
      if (s.includes('under') || s.includes('kurang')) return 'Underweight';
      if (s.includes('over') || s.includes('lebih') || s.includes('obesitas')) return 'Overweight';
      if (bmi && typeof bmi === 'number') {
        if (bmi < 18.5) return 'Underweight';
        if (bmi <= 24.9) return 'Proporsional';
        return 'Overweight';
      }
      return 'Proporsional';
    };

    assert.equal(getBmiStatus('Normal', 20.5), 'Proporsional');
    assert.equal(getBmiStatus(undefined, 17.2), 'Underweight');
    assert.equal(getBmiStatus(undefined, 22.0), 'Proporsional');
    assert.equal(getBmiStatus(undefined, 27.5), 'Overweight');
  });

  // 5. Race-Condition Guard Simulation Test: Sequence ID & activeStudentIdRef
  await t.test('5. Race Condition Guard: Stale in-flight responses are strictly dropped on rapid child switching', () => {
    // Simulated state container with mutable refs
    const refContainer = {
      activeStudentId: 'child-A',
      sequence: 0
    };

    // User triggers request for Child A
    const req1StudentId = 'child-A';
    const req1Seq = ++refContainer.sequence; // 1

    // Simulated rapid user switch to Child B before req 1 finishes
    refContainer.activeStudentId = 'child-B';
    refContainer.sequence++; // 2 (invalidates prior in-flight requests)
    const req2StudentId = 'child-B';
    const req2Seq = ++refContainer.sequence; // 3

    // Validation helper mimicking PortalDashboard response check
    const shouldAcceptResponse = (
      isMounted: boolean,
      callbackSeq: number,
      latestSeq: number,
      currentActiveRef: string,
      requestedStudentId: string
    ) => {
      return (
        isMounted &&
        callbackSeq === latestSeq &&
        currentActiveRef === requestedStudentId
      );
    };

    // Case 1: Delayed Request 1 (Child A) arrives after Child B is active
    const acceptReq1Late = shouldAcceptResponse(
      true,
      req1Seq,
      refContainer.sequence,
      refContainer.activeStudentId,
      req1StudentId
    );
    assert.equal(acceptReq1Late, false, 'Late response for Child A must be rejected when Child B is active');

    // Case 2: Request 2 (Child B) arrives
    const acceptReq2 = shouldAcceptResponse(
      true,
      req2Seq,
      refContainer.sequence,
      refContainer.activeStudentId,
      req2StudentId
    );
    assert.equal(acceptReq2, true, 'Matching response for Child B must be accepted');

    // Case 3: Rapid switch back to Child A (A -> B -> A)
    refContainer.activeStudentId = 'child-A';
    refContainer.sequence++; // 4
    const req3StudentId = 'child-A';
    const req3Seq = ++refContainer.sequence; // 5

    // If ancient Request 1 somehow arrives now, it has seq=1 while currentSeq=5
    const acceptOldReq1 = shouldAcceptResponse(
      true,
      req1Seq,
      refContainer.sequence,
      refContainer.activeStudentId,
      req1StudentId
    );
    assert.equal(acceptOldReq1, false, 'Ancient response from initial Child A request must NOT overwrite state');

    // Request 3 arrives
    const acceptReq3 = shouldAcceptResponse(
      true,
      req3Seq,
      refContainer.sequence,
      refContainer.activeStudentId,
      req3StudentId
    );
    assert.equal(acceptReq3, true, 'Latest Child A response with matching sequence must be accepted');
  });

  // 6. Demo Mode Environment Restriction Test
  await t.test('6. Demo Mode Protection: Restricted to dev/test environments only', () => {
    const isDemoPermitted = (isDevEnv: boolean, hostname: string, queryParam: string | null) => {
      const isAllowedHost = (
        isDevEnv ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.localhost') ||
        hostname.includes('ais-dev-')
      );
      return Boolean(isAllowedHost && (queryParam === '1'));
    };

    // Permitted on dev / local hosts
    assert.equal(isDemoPermitted(true, 'localhost', '1'), true);
    assert.equal(isDemoPermitted(false, 'localhost', '1'), true);
    assert.equal(isDemoPermitted(false, '127.0.0.1', '1'), true);
    assert.equal(isDemoPermitted(false, 'ais-dev-k3ugqrxx4vyuatbx4pinpp-467599567372.asia-east1.run.app', '1'), true);

    // Strictly forbidden on production hosts
    assert.equal(isDemoPermitted(false, 'chuvator.com', '1'), false, 'Demo mode must be disabled on chuvator.com');
    assert.equal(isDemoPermitted(false, 'app.chuvator.com', '1'), false, 'Demo mode must be disabled on app.chuvator.com');
    assert.equal(isDemoPermitted(false, 'sports.arena-tenant.id', '1'), false, 'Demo mode must be disabled on tenant domain');
    assert.equal(isDemoPermitted(false, 'production.run.app', '1'), false);
  });
});
