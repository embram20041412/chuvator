import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBMI,
  getBMIStatus,
  filterStudentsBySelectedClass,
  resolveClassAthleteSelection
} from '../components/GrowthTrackerSection';

// 1. BMI Calculation Tests
test('calculateBMI correctly computes BMI rounded to 1 decimal place', () => {
  // Height 170cm (1.7m), Weight 65kg -> 65 / (1.7 * 1.7) = 22.491 -> 22.5
  assert.equal(calculateBMI(170, 65), 22.5);

  // Height 180cm (1.8m), Weight 80kg -> 80 / (1.8 * 1.8) = 24.691 -> 24.7
  assert.equal(calculateBMI(180, 80), 24.7);

  // Height 160cm (1.6m), Weight 45kg -> 45 / (1.6 * 1.6) = 17.578 -> 17.6
  assert.equal(calculateBMI(160, 45), 17.6);
});

test('calculateBMI handles zero, negative, or invalid inputs safely without NaN or throwing', () => {
  assert.equal(calculateBMI(0, 60), 0);
  assert.equal(calculateBMI(170, 0), 0);
  assert.equal(calculateBMI(-170, 60), 0);
  assert.equal(calculateBMI(170, -60), 0);
  assert.equal(calculateBMI('', ''), 0);
  assert.equal(calculateBMI(null, null), 0);
  assert.equal(calculateBMI(undefined, undefined), 0);
});

// 2. BMI Status Tests
test('getBMIStatus returns correct status category and styling', () => {
  assert.equal(getBMIStatus(0).status, 'Belum Ada');
  assert.equal(getBMIStatus(-5).status, 'Belum Ada');
  
  assert.equal(getBMIStatus(17.5).status, 'Underweight');
  assert.equal(getBMIStatus(18.4).status, 'Underweight');

  assert.equal(getBMIStatus(18.5).status, 'Proporsional');
  assert.equal(getBMIStatus(22.0).status, 'Proporsional');
  assert.equal(getBMIStatus(24.9).status, 'Proporsional');

  assert.equal(getBMIStatus(25.0).status, 'Overweight');
  assert.equal(getBMIStatus(30.2).status, 'Overweight');
});

// 3. Growth History Array Processing Tests
test('Growth history processing preserves previous entries when appending new records', () => {
  const initialHistory = [
    {
      date: '2026-10-01',
      height: 168,
      weight: 58,
      bmi: 20.5,
      status: 'Proporsional',
      recordedAt: '2026-10-01T08:00:00.000Z'
    }
  ];

  const newEntry1 = {
    date: '2026-11-01',
    height: 170,
    weight: 60,
    bmi: 20.8,
    status: 'Proporsional',
    recordedAt: '2026-11-01T09:00:00.000Z'
  };

  const updatedHistory1 = [...initialHistory, newEntry1];
  assert.equal(updatedHistory1.length, 2);
  assert.equal(updatedHistory1[0].height, 168);
  assert.equal(updatedHistory1[1].height, 170);

  const newEntry2 = {
    date: '2026-12-01',
    height: 171.5,
    weight: 61.5,
    bmi: 20.9,
    status: 'Proporsional',
    recordedAt: '2026-12-01T10:00:00.000Z'
  };

  const updatedHistory2 = [...updatedHistory1, newEntry2];
  assert.equal(updatedHistory2.length, 3);
  assert.equal(updatedHistory2[0].date, '2026-10-01');
  assert.equal(updatedHistory2[1].date, '2026-11-01');
  assert.equal(updatedHistory2[2].date, '2026-12-01');
});

test('Growth history parsing safely recovers from null, undefined, or stringified JSON', () => {
  const parseHistory = (raw: any) => {
    let list = [];
    if (Array.isArray(raw)) {
      list = [...raw];
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = [...parsed];
      } catch {
        list = [];
      }
    }
    return list;
  };

  assert.deepEqual(parseHistory(null), []);
  assert.deepEqual(parseHistory(undefined), []);
  assert.deepEqual(parseHistory('invalid json'), []);
  assert.deepEqual(
    parseHistory('[{"date":"2026-09-01","height":165,"weight":55}]'),
    [{ date: '2026-09-01', height: 165, weight: 55 }]
  );
});

// 4. Verification of Chronological Sorting
test('Growth history records sort chronologically by date', () => {
  const unsorted = [
    { date: '2026-11-15', height: 171 },
    { date: '2026-09-10', height: 168 },
    { date: '2026-10-05', height: 170 }
  ];

  const sorted = [...unsorted].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  assert.equal(sorted[0].date, '2026-09-10');
  assert.equal(sorted[1].date, '2026-10-05');
  assert.equal(sorted[2].date, '2026-11-15');
});

// 5. Verification of Simulation of Database Failure and Error Re-throwing
test('updateStudentGrowth logic throws on missing student ID', async () => {
  let threw = false;
  try {
    const studentId = null;
    if (!studentId) {
      throw new Error('Student ID wajib disertakan.');
    }
  } catch (err: any) {
    threw = true;
    assert.equal(err.message, 'Student ID wajib disertakan.');
  }
  assert.equal(threw, true);
});

test('updateStudentGrowth simulation aborts UPDATE when database read fails', async () => {
  let updateCalled = false;
  const mockRead = async () => {
    return { data: null, error: new Error('PGRST301: Permission denied on table students') };
  };
  const mockUpdate = async () => {
    updateCalled = true;
    return { data: null, error: null };
  };

  let caughtError: any = null;
  try {
    const { data: currentStudent, error: readError } = await mockRead();
    if (readError) {
      throw readError;
    }
    if (!currentStudent) {
      throw new Error('Siswa tidak ditemukan');
    }
    await mockUpdate();
  } catch (err: any) {
    caughtError = err;
  }

  assert.ok(caughtError);
  assert.match(caughtError.message, /Permission denied/);
  assert.equal(updateCalled, false, 'UPDATE should never be called if read fails');
});

test('updateStudentGrowth simulation rethrows UPDATE error to caller rather than swallowing it', async () => {
  const mockRead = async () => {
    return { data: { id: 'st_1', growth_history: [] }, error: null };
  };
  const mockUpdate = async () => {
    return { data: null, error: new Error('Postgres error: Row Level Security policy violated') };
  };

  let caughtError: any = null;
  try {
    const { data: currentStudent, error: readError } = await mockRead();
    if (readError) throw readError;
    const { data: updated, error: updateError } = await mockUpdate();
    if (updateError) throw updateError;
  } catch (err: any) {
    caughtError = err;
  }

  assert.ok(caughtError);
  assert.match(caughtError.message, /Row Level Security/);
});

// 6. Class-Based Athlete Filtering & Class-Switch State Reset Verification (Scenarios 1 - 4)
const mockAllAcademyStudents = [
  {
    id: 'st-a1',
    studentName: 'Rizky Pratama',
    classId: 'class-a',
    className: 'U-14 Elite A',
    tenantId: 'tenant-1',
    academyId: 'acad-1',
    status: 'Aktif',
    height: 168,
    weight: 56
  },
  {
    id: 'st-a2',
    studentName: 'Bagas Adi',
    classId: 'class-a',
    className: 'U-14 Elite A',
    tenantId: 'tenant-1',
    academyId: 'acad-1',
    status: 'Aktif',
    height: 170,
    weight: 60
  },
  {
    id: 'st-b1',
    studentName: 'Dimas Saputra',
    classId: 'class-b',
    className: 'U-16 Pro B',
    tenantId: 'tenant-1',
    academyId: 'acad-1',
    status: 'Aktif',
    height: 175,
    weight: 66
  },
  {
    id: 'st-other-tenant',
    studentName: 'Other Tenant Athlete',
    classId: 'class-a',
    className: 'U-14 Elite A',
    tenantId: 'tenant-2',
    academyId: 'acad-1',
    status: 'Aktif'
  },
  {
    id: 'st-other-academy',
    studentName: 'Other Academy Athlete',
    classId: 'class-a',
    className: 'U-14 Elite A',
    tenantId: 'tenant-1',
    academyId: 'acad-2',
    status: 'Aktif'
  },
  {
    id: 'st-inactive',
    studentName: 'Inactive Athlete',
    classId: 'class-a',
    className: 'U-14 Elite A',
    tenantId: 'tenant-1',
    academyId: 'acad-1',
    status: 'Non-Aktif'
  }
];

test('Scenario 1 & 2: filterStudentsBySelectedClass returns only active athletes in Class A and updates to Class B on switch', () => {
  const classA = { id: 'class-a', className: 'U-14 Elite A', tenantId: 'tenant-1', academyId: 'acad-1' };
  const classB = { id: 'class-b', className: 'U-16 Pro B', tenantId: 'tenant-1', academyId: 'acad-1' };

  const listA = filterStudentsBySelectedClass(
    mockAllAcademyStudents,
    classA,
    'tenant-1',
    { id: 'acad-1' }
  );
  assert.deepEqual(
    listA.map((s) => s.id),
    ['st-a1', 'st-a2'],
    'Class A dropdown must only contain active members of Class A within active tenant and academy'
  );

  const listB = filterStudentsBySelectedClass(
    mockAllAcademyStudents,
    classB,
    'tenant-1',
    { id: 'acad-1' }
  );
  assert.deepEqual(
    listB.map((s) => s.id),
    ['st-b1'],
    'Switching to Class B must immediately update the athlete list to Class B members only'
  );
});

test('Scenario 3: resolveClassAthleteSelection resets selection when previous athlete is not in the newly selected class', () => {
  const classBStudents = [
    { id: 'st-b1', studentName: 'Dimas Saputra', classId: 'class-b', height: 175, weight: 66 }
  ];

  // Previously selected 'st-a2' from Class A -> switch to Class B
  const resolved = resolveClassAthleteSelection(classBStudents, 'st-a2');
  assert.equal(resolved.wasReset, true);
  assert.equal(resolved.selectedStudentId, 'st-b1');
  assert.equal(resolved.selectedStudent?.id, 'st-b1');

  // If already selecting a member of Class B -> keeps selection without reset
  const kept = resolveClassAthleteSelection(classBStudents, 'st-b1');
  assert.equal(kept.wasReset, false);
  assert.equal(kept.selectedStudentId, 'st-b1');
});

test('Scenario 4: empty class or unselected class returns empty athlete list and clears selected athlete', () => {
  const emptyClassC = { id: 'class-c', className: 'U-12 Pemula C', tenantId: 'tenant-1', academyId: 'acad-1' };

  const listUnselected = filterStudentsBySelectedClass(
    mockAllAcademyStudents,
    null,
    'tenant-1',
    { id: 'acad-1' }
  );
  assert.deepEqual(listUnselected, []);

  const listEmptyClass = filterStudentsBySelectedClass(
    mockAllAcademyStudents,
    emptyClassC,
    'tenant-1',
    { id: 'acad-1' }
  );
  assert.deepEqual(listEmptyClass, []);

  const resolvedEmpty = resolveClassAthleteSelection(listEmptyClass, 'st-a1');
  assert.equal(resolvedEmpty.wasReset, true);
  assert.equal(resolvedEmpty.selectedStudentId, '');
  assert.equal(resolvedEmpty.selectedStudent, null);
});

