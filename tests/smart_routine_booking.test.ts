import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTimeOverlapping,
  expandScheduleSlots,
  detectScheduleConflicts,
  formatIndonesianDate
} from '../src/utils/scheduleGenerator';

test('isTimeOverlapping detects overlaps correctly', () => {
  // Overlapping cases
  assert.equal(isTimeOverlapping('15:00', '17:00', '16:00', '18:00'), true);
  assert.equal(isTimeOverlapping('16:00', '18:00', '15:00', '17:00'), true);
  assert.equal(isTimeOverlapping('15:00', '17:00', '15:00', '17:00'), true);
  assert.equal(isTimeOverlapping('14:00', '18:00', '15:00', '16:00'), true);

  // Exact touching edge cases (no overlap)
  assert.equal(isTimeOverlapping('15:00', '16:00', '16:00', '17:00'), false);
  assert.equal(isTimeOverlapping('17:00', '18:00', '15:00', '17:00'), false);

  // Disjoint cases
  assert.equal(isTimeOverlapping('08:00', '10:00', '14:00', '16:00'), false);
});

test('expandScheduleSlots expands recurring weekly schedules into calendar dates', () => {
  const schedules = [
    { day: 'Senin', startTime: '16:00', endTime: '18:00', courtId: 'court-1', courtName: 'Lapangan A' },
    { day: 'Kamis', startTime: '16:00', endTime: '18:00', courtId: 'court-1', courtName: 'Lapangan A' }
  ];

  // 2026-11-09 is Monday (Senin), 2026-11-15 is Sunday (Minggu)
  const slots = expandScheduleSlots('2026-11-09', '2026-11-15', schedules, null, [
    { id: 'court-1', name: 'Lapangan A' }
  ]);

  assert.equal(slots.length, 2);
  assert.equal(slots[0].date, '2026-11-09');
  assert.equal(slots[0].dayName, 'Senin');
  assert.equal(slots[0].courtId, 'court-1');
  assert.equal(slots[1].date, '2026-11-12');
  assert.equal(slots[1].dayName, 'Kamis');
});

test('expandScheduleSlots supports court override', () => {
  const schedules = [
    { day: 'Senin', startTime: '16:00', endTime: '18:00', courtId: 'court-1', courtName: 'Lapangan A' }
  ];

  const courts = [
    { id: 'court-1', name: 'Lapangan A' },
    { id: 'court-2', name: 'Lapangan B (Alternatif)' }
  ];

  const slots = expandScheduleSlots('2026-11-09', '2026-11-09', schedules, 'court-2', courts);

  assert.equal(slots.length, 1);
  assert.equal(slots[0].courtId, 'court-2');
  assert.equal(slots[0].courtName, 'Lapangan B (Alternatif)');
});

test('detectScheduleConflicts detects collision and suggests free alternative court', () => {
  const plannedSlots = [
    {
      date: '2026-11-09',
      startTime: '16:00',
      endTime: '18:00',
      courtId: 'court-1',
      courtName: 'Lapangan 1',
      dayName: 'Senin'
    }
  ];

  const existingBookings = [
    {
      id: 'b-1',
      court_id: 'court-1',
      date: '2026-11-09',
      start_time: '15:30',
      end_time: '17:30',
      customer_name: 'Budi (Sewa Reguler)',
      booking_type: 'REGULAR',
      status: 'Lunas'
    }
  ];

  const courts = [
    { id: 'court-1', name: 'Lapangan 1', sport: 'Badminton', is_active: true },
    { id: 'court-2', name: 'Lapangan 2 (Bebas)', sport: 'Badminton', is_active: true }
  ];

  const result = detectScheduleConflicts(plannedSlots, existingBookings, courts, 'Badminton');

  assert.equal(result.conflict, true);
  assert.ok(result.conflictDetails);
  assert.equal(result.conflictDetails?.customer_name, 'Budi (Sewa Reguler)');
  assert.equal(result.conflictDetails?.date, '2026-11-09');

  // Suggestion court must be Court 2 which has no conflict!
  assert.ok(result.suggestionCourt);
  assert.equal(result.suggestionCourt?.id, 'court-2');
  assert.equal(result.suggestionCourt?.name, 'Lapangan 2 (Bebas)');
});

test('detectScheduleConflicts ignores cancelled bookings', () => {
  const plannedSlots = [
    {
      date: '2026-11-09',
      startTime: '16:00',
      endTime: '18:00',
      courtId: 'court-1',
      courtName: 'Lapangan 1',
      dayName: 'Senin'
    }
  ];

  const existingBookings = [
    {
      id: 'b-cancelled',
      court_id: 'court-1',
      date: '2026-11-09',
      start_time: '16:00',
      end_time: '18:00',
      customer_name: 'Pesanan Batal',
      booking_type: 'REGULAR',
      status: 'Dibatalkan'
    }
  ];

  const courts = [
    { id: 'court-1', name: 'Lapangan 1', sport: 'Badminton', is_active: true }
  ];

  const result = detectScheduleConflicts(plannedSlots, existingBookings, courts, 'Badminton');

  assert.equal(result.conflict, false);
  assert.equal(result.validSlots?.length, 1);
});

test('formatIndonesianDate formats correctly', () => {
  const formatted = formatIndonesianDate('2026-11-17');
  assert.match(formatted, /Selasa/i);
  assert.match(formatted, /17/);
  assert.match(formatted, /2026/);
});
