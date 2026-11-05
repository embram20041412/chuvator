/**
 * Smart Routine Booking & Collision Suggestion Utility
 * Pure business logic decoupled for unit testing and client fallback.
 */

export interface ScheduleItem {
  id?: string;
  day: string; // 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  courtId?: string;
  court_id?: string;
  courtName?: string;
  court_name?: string;
}

export interface CourtItem {
  id: string;
  name: string;
  sport?: string;
  is_active?: boolean;
  court_number?: string;
}

export interface ExistingBooking {
  id: string;
  court_id?: string;
  courtId?: string;
  court_name?: string;
  courtName?: string;
  date: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  customer_name?: string;
  customerName?: string;
  booking_type?: string;
  bookingType?: string;
  status?: string;
}

export interface PlannedSlot {
  date: string;
  startTime: string;
  endTime: string;
  courtId: string;
  courtName: string;
  dayName: string;
}

export interface ConflictDetails {
  date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  booking_type: string;
  court_name: string;
}

export interface SuggestionCourt {
  id: string;
  name: string;
}

export interface CollisionCheckResult {
  conflict: boolean;
  conflictDetails?: ConflictDetails;
  suggestionCourt?: SuggestionCourt | null;
  validSlots?: PlannedSlot[];
}

export const INDONESIAN_DAYS: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu'
};

export const DAY_STRING_TO_NUM: Record<string, number> = {
  'senin': 1,
  'monday': 1,
  'selasa': 2,
  'tuesday': 2,
  'rabu': 3,
  'wednesday': 3,
  'kamis': 4,
  'thursday': 4,
  'jumat': 5,
  'friday': 5,
  'sabtu': 6,
  'saturday': 6,
  'minggu': 7,
  'sunday': 7
};

/**
 * Checks if two time windows overlap
 * Formula: (startA < endB && endA > startB)
 */
export function isTimeOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && endA > startB;
}

/**
 * Expands recurring schedules into specific dates between startDate and endDate
 */
export function expandScheduleSlots(
  startDateStr: string,
  endDateStr: string,
  schedules: ScheduleItem[],
  overrideCourtId?: string | null,
  courts: CourtItem[] = []
): PlannedSlot[] {
  if (!startDateStr || !endDateStr || !Array.isArray(schedules) || schedules.length === 0) {
    return [];
  }

  const courtMap = new Map<string, string>();
  courts.forEach(c => courtMap.set(c.id, c.name));

  const slots: PlannedSlot[] = [];
  const curr = new Date(startDateStr);
  const end = new Date(endDateStr);

  // Normalize hours for clean comparison
  curr.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // getDay() gives 0 for Sunday, 1 for Monday ... 6 for Saturday
    // Convert to ISO Day of Week: 1 = Monday ... 7 = Sunday
    const jsDay = curr.getDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    const dayName = INDONESIAN_DAYS[isoDow];

    for (const sched of schedules) {
      const schedDayRaw = String(sched.day || '').trim().toLowerCase();
      const schedDow = DAY_STRING_TO_NUM[schedDayRaw];

      if (schedDow === isoDow) {
        const startTime = sched.startTime || sched.start_time || '15:00';
        const endTime = sched.endTime || sched.end_time || '17:00';
        const courtId = overrideCourtId || sched.courtId || sched.court_id || '';
        const courtName =
          (overrideCourtId && courtMap.get(overrideCourtId)) ||
          sched.courtName ||
          sched.court_name ||
          courtMap.get(courtId) ||
          'Lapangan Utama';

        if (courtId) {
          slots.push({
            date: dateStr,
            startTime,
            endTime,
            courtId,
            courtName,
            dayName
          });
        }
      }
    }

    curr.setDate(curr.getDate() + 1);
  }

  return slots;
}

/**
 * Analyzes planned slots against existing bookings, detects collisions,
 * and searches available courts for a smart alternative suggestion.
 */
export function detectScheduleConflicts(
  plannedSlots: PlannedSlot[],
  existingBookings: ExistingBooking[],
  allCourts: CourtItem[] = [],
  classSport?: string
): CollisionCheckResult {
  if (plannedSlots.length === 0) {
    return { conflict: false, validSlots: [] };
  }

  // Active bookings filter (exclude cancelled/voided)
  const activeBookings = existingBookings.filter(b => {
    const s = String(b.status || '').toLowerCase();
    return s !== 'dibatalkan' && s !== 'cancelled' && s !== 'void';
  });

  // 1. Check if any planned slot conflicts with target court
  let firstConflict: ExistingBooking | null = null;
  let conflictedSlot: PlannedSlot | null = null;

  for (const slot of plannedSlots) {
    for (const b of activeBookings) {
      const bCourtId = b.court_id || b.courtId;
      const bDate = b.date;
      const bStart = b.start_time || b.startTime || '00:00';
      const bEnd = b.end_time || b.endTime || '23:59';

      if (bCourtId === slot.courtId && bDate === slot.date) {
        if (isTimeOverlapping(slot.startTime, slot.endTime, bStart, bEnd)) {
          firstConflict = b;
          conflictedSlot = slot;
          break;
        }
      }
    }
    if (firstConflict) break;
  }

  // If no conflict, all slots are valid!
  if (!firstConflict || !conflictedSlot) {
    return {
      conflict: false,
      validSlots: plannedSlots
    };
  }

  // 2. Conflict detected! Prepare conflict details
  const conflictDetails: ConflictDetails = {
    date: conflictedSlot.date,
    start_time: firstConflict.start_time || firstConflict.startTime || conflictedSlot.startTime,
    end_time: firstConflict.end_time || firstConflict.endTime || conflictedSlot.endTime,
    customer_name: firstConflict.customer_name || firstConflict.customerName || 'Penyewa Reguler',
    booking_type: firstConflict.booking_type || firstConflict.bookingType || 'REGULAR',
    court_name: conflictedSlot.courtName
  };

  // 3. Search for alternative court suggestion
  // Must be active, same sport (if specified), and different from the conflicted court
  const conflictedCourtId = conflictedSlot.courtId;
  const candidateCourts = allCourts.filter(c => {
    if (c.id === conflictedCourtId) return false;
    if (c.is_active === false) return false;
    if (classSport && c.sport) {
      return c.sport.trim().toLowerCase() === classSport.trim().toLowerCase();
    }
    return true;
  });

  let suggestionCourt: SuggestionCourt | null = null;

  for (const candidate of candidateCourts) {
    let candidateHasConflict = false;

    for (const slot of plannedSlots) {
      for (const b of activeBookings) {
        const bCourtId = b.court_id || b.courtId;
        const bDate = b.date;
        const bStart = b.start_time || b.startTime || '00:00';
        const bEnd = b.end_time || b.endTime || '23:59';

        if (bCourtId === candidate.id && bDate === slot.date) {
          if (isTimeOverlapping(slot.startTime, slot.endTime, bStart, bEnd)) {
            candidateHasConflict = true;
            break;
          }
        }
      }
      if (candidateHasConflict) break;
    }

    // Found an alternative court that is 100% free for all slots!
    if (!candidateHasConflict) {
      suggestionCourt = {
        id: candidate.id,
        name: candidate.name
      };
      break;
    }
  }

  return {
    conflict: true,
    conflictDetails,
    suggestionCourt
  };
}

/**
 * Format a date string into Indonesian format e.g. "Jumat, 17 Nov 2026"
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
