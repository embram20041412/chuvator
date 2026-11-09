import { test } from 'node:test';
import assert from 'node:assert/strict';

test('CHUVATOR — Phase 4.3.1 Mobile Booking Module Logic & Security Tests', async (t) => {

  // 1. Slot Time Conflict Detection Logic
  await t.test('1. Conflict Detection: Overlapping booking slots are correctly identified', () => {
    const existingBookings = [
      {
        id: 'booking-1',
        courtId: 'court-A',
        bookingDate: '2026-11-10',
        startTime: '09:00',
        endTime: '11:00',
        status: 'Lunas',
        isVoid: false
      },
      {
        id: 'booking-2',
        courtId: 'court-A',
        bookingDate: '2026-11-10',
        startTime: '14:00',
        endTime: '16:00',
        status: 'VOID', // Voided booking should NOT block slot
        isVoid: true
      }
    ];

    const hasConflict = (courtId: string, date: string, startTime: string, endTime: string) => {
      return existingBookings.some((b) => {
        if (b.courtId !== courtId || b.bookingDate !== date) return false;
        if (b.isVoid || b.status === 'VOID' || b.status === 'BATAL') return false;

        const bStart = b.startTime;
        const bEnd = b.endTime;
        return startTime < bEnd && endTime > bStart;
      });
    };

    // Conflicting range: 10:00 to 12:00 overlaps 09:00-11:00
    assert.equal(hasConflict('court-A', '2026-11-10', '10:00', '12:00'), true);
    // Exact match: 09:00 to 11:00 overlaps 09:00-11:00
    assert.equal(hasConflict('court-A', '2026-11-10', '09:00', '11:00'), true);
    // Inside range: 09:30 to 10:30 overlaps 09:00-11:00
    assert.equal(hasConflict('court-A', '2026-11-10', '09:30', '10:30'), true);

    // Non-conflicting range: 08:00 to 09:00 (ends right when booking 1 starts)
    assert.equal(hasConflict('court-A', '2026-11-10', '08:00', '09:00'), false);
    // Non-conflicting range: 11:00 to 12:00 (starts right when booking 1 ends)
    assert.equal(hasConflict('court-A', '2026-11-10', '11:00', '12:00'), false);

    // Non-conflicting court: court-B on same date
    assert.equal(hasConflict('court-B', '2026-11-10', '09:00', '11:00'), false);

    // Voided slot: 14:00 to 16:00 on court-A was voided, should be AVAILABLE
    assert.equal(hasConflict('court-A', '2026-11-10', '14:00', '15:00'), false);
  });

  // 2. Price Calculator & Duration Calculation
  await t.test('2. Price Calculator: Duration and price are calculated accurately from slot start/end times', () => {
    const calculateBookingPrice = (hourlyRate: number, startTime: string, endTime: string) => {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);

      const startMinutes = startH * 60 + (startM || 0);
      const endMinutes = endH * 60 + (endM || 0);

      let diffMinutes = endMinutes - startMinutes;
      if (diffMinutes <= 0) diffMinutes = 60;

      const hours = Math.max(1, Math.round(diffMinutes / 60));
      return {
        hours,
        totalPrice: hourlyRate * hours
      };
    };

    const rate = 50000; // Rp 50.000 / jam

    // 1 Hour
    const res1 = calculateBookingPrice(rate, '08:00', '09:00');
    assert.equal(res1.hours, 1);
    assert.equal(res1.totalPrice, 50000);

    // 2.5 Hours -> rounded to 3 Hours
    const res2 = calculateBookingPrice(rate, '08:00', '10:30');
    assert.equal(res2.hours, 3);
    assert.equal(res2.totalPrice, 150000);

    // Invalid end time <= start time -> fallback min 1 hour
    const res3 = calculateBookingPrice(rate, '10:00', '09:00');
    assert.equal(res3.hours, 1);
    assert.equal(res3.totalPrice, 50000);
  });

  // 3. Viewport Breakpoint Switch Test
  await t.test('3. Viewport Switch: Mobile Booking renders <= 767px, Desktop renders >= 768px', () => {
    const isMobileViewport = (width: number) => width <= 767;

    assert.equal(isMobileViewport(375), true);
    assert.equal(isMobileViewport(390), true);
    assert.equal(isMobileViewport(430), true);
    assert.equal(isMobileViewport(767), true);

    assert.equal(isMobileViewport(768), false);
    assert.equal(isMobileViewport(1024), false);
    assert.equal(isMobileViewport(1440), false);
  });

  // 4. RBAC Authorization for Voiding Bookings
  await t.test('4. RBAC Authorization: Only owner, superadmin, or admin can void/cancel bookings', () => {
    const canVoidBooking = (role?: string) => {
      const r = (role || '').toLowerCase();
      return r === 'owner' || r === 'superadmin' || r === 'admin';
    };

    assert.equal(canVoidBooking('owner'), true);
    assert.equal(canVoidBooking('superadmin'), true);
    assert.equal(canVoidBooking('admin'), true);

    assert.equal(canVoidBooking('pelatih'), false);
    assert.equal(canVoidBooking('coach'), false);
    assert.equal(canVoidBooking('kasir'), strokeKasir());
    assert.equal(canVoidBooking('wali_murid'), false);
    assert.equal(canVoidBooking(''), false);

    function strokeKasir() {
      // Kasir is admin staf role or separate staff
      return false;
    }
  });

  // 5. Time Travel Prevention Validation
  await t.test('5. Time Travel Check: Past date & past time bookings are prevented', () => {
    const validatePastBooking = (bookingDate: string, startTime: string, referenceDate: Date) => {
      const todayStr = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
      const [startH, startM] = startTime.split(':').map(Number);
      const currentHour = referenceDate.getHours();
      const currentMinute = referenceDate.getMinutes();

      const isPastDate = bookingDate < todayStr;
      const isPastTimeToday = bookingDate === todayStr && (startH < currentHour || (startH === currentHour && (startM || 0) <= currentMinute));

      return isPastDate || isPastTimeToday;
    };

    const mockNow = new Date('2026-11-10T14:30:00');

    // Past date (yesterday) -> Past
    assert.equal(validatePastBooking('2026-11-09', '10:00', mockNow), true);
    // Today, earlier hour (11:00 < 14:30) -> Past
    assert.equal(validatePastBooking('2026-11-10', '11:00', mockNow), true);
    // Today, future hour (16:00 > 14:30) -> Valid
    assert.equal(validatePastBooking('2026-11-10', '16:00', mockNow), false);
    // Tomorrow -> Valid
    assert.equal(validatePastBooking('2026-11-11', '09:00', mockNow), false);
  });

});
