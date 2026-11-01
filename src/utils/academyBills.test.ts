import test from 'node:test';
import assert from 'node:assert/strict';
import { mapAcademyBills } from './academyBills.js';

test('mapAcademyBills maps unpaid registration fee for student', () => {
  const students = [
    {
      id: 'student-1',
      studentName: 'Arkananta Bima',
      registrationFee: 75000,
      registrationFeePaid: false,
      sppStatus: 'Lunas',
      lastPaidMonth: '2026-11'
    }
  ];

  const bills = mapAcademyBills({
    students,
    pendingSppPayments: [],
    currentMonth: '2026-11',
    currentMonthName: 'November 2026'
  });

  assert.equal(bills.length, 1);
  assert.equal(bills[0].id, 'REG-student-1');
  assert.equal(bills[0].name, 'Pendaftaran - Arkananta Bima');
  assert.equal(bills[0].price, 75000);
  assert.equal(bills[0].type, 'registration');
  assert.equal(bills[0].category, 'Tagihan SPP');
  assert.equal(bills[0].student_id, 'student-1');
});

test('mapAcademyBills maps unpaid monthly SPP for student', () => {
  const students = [
    {
      id: 'student-2',
      studentName: 'Cindy Claudia',
      registrationFee: 75000,
      registrationFeePaid: true,
      monthlyFee: 350000,
      sppStatus: 'Belum Lunas',
      lastPaidMonth: '2026-10'
    }
  ];

  const bills = mapAcademyBills({
    students,
    pendingSppPayments: [],
    currentMonth: '2026-11',
    currentMonthName: 'November 2026'
  });

  assert.equal(bills.length, 1);
  assert.equal(bills[0].id, 'SPP-student-2-2026-11');
  assert.equal(bills[0].name, 'SPP November 2026 - Cindy Claudia');
  assert.equal(bills[0].price, 350000);
  assert.equal(bills[0].type, 'spp');
  assert.equal(bills[0].category, 'Tagihan SPP');
  assert.equal(bills[0].student_id, 'student-2');
});

test('mapAcademyBills maps both registration and SPP if both unpaid', () => {
  const students = [
    {
      id: 'student-3',
      studentName: 'Dimas Aditya',
      registrationFee: 100000,
      registrationFeePaid: false,
      monthlyFee: 400000,
      sppStatus: 'Belum Lunas',
      lastPaidMonth: null
    }
  ];

  const bills = mapAcademyBills({
    students,
    pendingSppPayments: [],
    currentMonth: '2026-11',
    currentMonthName: 'November 2026'
  });

  assert.equal(bills.length, 2);
  const regBill = bills.find((b) => b.type === 'registration');
  const sppBill = bills.find((b) => b.type === 'spp');

  assert.ok(regBill, 'Registration bill should exist');
  assert.ok(sppBill, 'SPP bill should exist');
  assert.equal(regBill.price, 100000);
  assert.equal(sppBill.price, 400000);
});

test('mapAcademyBills maps pending spp_payments record', () => {
  const pendingSppPayments = [
    {
      id: 'spp-rec-99',
      student_id: 'student-4',
      student_name: 'Farhan Rizky',
      amount: 300000,
      paid_month: 'Oktober 2026',
      status: 'pending'
    }
  ];

  const bills = mapAcademyBills({
    students: [],
    pendingSppPayments,
    currentMonth: '2026-11',
    currentMonthName: 'November 2026'
  });

  assert.equal(bills.length, 1);
  assert.equal(bills[0].id, 'SPP-spp-rec-99');
  assert.equal(bills[0].name, 'SPP Oktober 2026 - Farhan Rizky');
  assert.equal(bills[0].price, 300000);
  assert.equal(bills[0].type, 'spp');
});

test('mapAcademyBills excludes fully paid students', () => {
  const students = [
    {
      id: 'student-5',
      studentName: 'Eka Pratama',
      registrationFeePaid: true,
      monthlyFee: 350000,
      sppStatus: 'Lunas',
      lastPaidMonth: '2026-11'
    }
  ];

  const bills = mapAcademyBills({
    students,
    pendingSppPayments: [],
    currentMonth: '2026-11',
    currentMonthName: 'November 2026'
  });

  assert.equal(bills.length, 0);
});
