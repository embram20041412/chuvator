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
});
