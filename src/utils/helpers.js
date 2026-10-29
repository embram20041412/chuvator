/**
 * Calculates the exact age of a person in years based on birthDate string (YYYY-MM-DD or ISO string)
 */
export const calculateAge = (birthDate) => {
  if (!birthDate) return '-';
  const today = new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '-';
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : '-';
};

/**
 * Returns initials (1-2 uppercase characters) from a full name
 */
export const getStudentInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Parses schedule data from a class object or raw schedule string
 * into a structured array of day items: [{ day, time, court }]
 */
export const parseScheduleItems = (clsOrString) => {
  if (!clsOrString) return [];

  // 1. Check if structured schedules array exists on class object
  if (typeof clsOrString === 'object' && Array.isArray(clsOrString.schedules) && clsOrString.schedules.length > 0) {
    return clsOrString.schedules.map((s) => {
      const day = s.day || s.hari || 'Hari';
      let time = '';
      if (s.startTime && s.endTime) {
        time = `${s.startTime} - ${s.endTime}`;
      } else if (s.time || s.jam) {
        time = s.time || s.jam;
      }
      const court = s.courtName || s.court || s.lapangan || '';
      return { day, time, court };
    });
  }

  // 2. Fallback to schedule string
  const rawStr = typeof clsOrString === 'string' ? clsOrString : (clsOrString?.schedule || '');
  if (!rawStr || rawStr === '-') return [];

  // Split by semicolon ';' or newline '\n'
  const parts = rawStr.split(/[;\n]+/).map((p) => p.trim()).filter(Boolean);

  const items = [];
  parts.forEach((part) => {
    // Pattern A: "Senin (14:00-17:00, Lapangan Badminton 1)"
    const matchParen = part.match(/^([^()]+)\(([^()]+)\)$/);
    if (matchParen) {
      const day = matchParen[1].replace(/[:;-]/g, '').trim();
      const insideParen = matchParen[2].trim();
      
      const parenTokens = insideParen.split(',').map((t) => t.trim());
      let time = '';
      let court = '';
      
      if (parenTokens.length >= 2) {
        time = parenTokens[0];
        court = parenTokens.slice(1).join(', ');
      } else if (parenTokens.length === 1) {
        if (/\d{1,2}[:.]\d{2}/.test(parenTokens[0])) {
          time = parenTokens[0];
        } else {
          court = parenTokens[0];
        }
      }

      items.push({ day, time, court });
      return;
    }

    // Pattern B: "Senin: 14:00 - 17:00 (Lapangan Badminton 1)"
    const matchColon = part.match(/^([^:]+):(.+)$/);
    if (matchColon) {
      const day = matchColon[1].trim();
      let rest = matchColon[2].trim();
      let court = '';
      const matchCourtInRest = rest.match(/\(([^()]+)\)/);
      if (matchCourtInRest) {
        court = matchCourtInRest[1].trim();
        rest = rest.replace(/\(([^()]+)\)/, '').trim();
      }
      items.push({ day, time: rest, court });
      return;
    }

    // Fallback: Day + Rest of string
    items.push({ day: part, time: '', court: '' });
  });

  return items;
};

export { getClassAgeGroupWeight, sortClassesByAgeGroup } from '../config/tierCurriculumConfig';

