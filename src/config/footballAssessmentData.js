// =====================================================================
// KAMUS DATA "ATHLETE DEVELOPMENT ASSESSMENT" (4-TIER LTAD CURRICULUM)
// =====================================================================

export const TIER_CONFIGS = {
  1: {
    tier: 1,
    label: 'U-8 & U-10 (Usia 6–9 Thn) — Fase Kegembiraan / Joy Phase',
    shortLabel: 'Fase 1 — Joy Phase (U-8 & U-10)',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    desc: 'Fokus 4v4, tanpa posisi kaku, pengenalan bola, gerak dasar motorik, dan kegembiraan bermain.'
  },
  2: {
    tier: 2,
    label: 'U-10 & U-12 (Usia 10–12 Thn) — Fase Pengembangan Skill / Skill Phase',
    shortLabel: 'Fase 2 — Skill Phase (U-10 & U-12)',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    desc: 'Fokus 4 core skills (passing, dribbling, 1v1, finishing), format 7v7, dan small-sided games.'
  },
  3: {
    tier: 3,
    label: 'U-14 & U-16 (Usia 13–16 Thn) — Fase Taktik / Tactical Phase',
    shortLabel: 'Fase 3 — Tactical Phase (U-14 & U-16)',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    desc: 'Fokus 11v11, zonal pressing, formasi 4-3-3 Filanesia PSSI, transisi bermain, dan koordinasi unit tim.'
  },
  4: {
    tier: 4,
    label: 'U-18 / Senior (Usia 17+ Thn) — Fase Penampilan / Performance Phase',
    shortLabel: 'Fase 4 — Performance Phase (U-18 / Senior)',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    desc: 'Fokus kematangan kompetitif, performa tinggi, efektivitas taktis, dan jenjang profesional.'
  }
};

export function detectTierFromAge(ageInput) {
  if (ageInput === undefined || ageInput === null || ageInput === '') return 1;
  
  let parsed = 0;
  if (typeof ageInput === 'number') {
    parsed = ageInput;
  } else {
    const ageStr = String(ageInput);
    // If it looks like a date (ISO 2010-01-01 or DD/MM/YYYY)
    if (ageStr.includes('-') || ageStr.includes('/')) {
      try {
        const birthDate = new Date(ageStr);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          parsed = age;
        } else {
          parsed = parseInt(ageStr.replace(/\D/g, ''), 10) || 0;
        }
      } catch (e) {
        parsed = parseInt(ageStr.replace(/\D/g, ''), 10) || 0;
      }
    } else {
      const digits = ageStr.replace(/\D/g, '');
      parsed = parseInt(digits, 10) || 0;
    }
  }

  // Safety: if parsed looks like a year (e.g. 2010) or mangled date value > 100
  if (parsed > 100) {
    // If it's a year like 2010, calculate age from current year
    const currentYear = new Date().getFullYear();
    if (parsed >= 1900 && parsed <= currentYear) {
      parsed = currentYear - parsed;
    } else {
      parsed = 10; // Default fallback to reasonable age
    }
  }

  if (parsed <= 0) return 1;
  if (parsed <= 9) return 1;  // Fase 1: Joy Phase (Usia 6-9 Thn)
  if (parsed <= 12) return 2; // Fase 2: Skill Phase (Usia 10-12 Thn)
  if (parsed <= 16) return 3; // Fase 3: Tactical Phase (Usia 13-16 Thn)
  return 4;                   // Fase 4: Performance Phase (Usia 17+ Thn)
}

export const FOOTBALL_POSITIONS = [
  {
    code: 'GK',
    label: 'GK — Penjaga Gawang (Kiper)',
    shortLabel: 'Penjaga Gawang (GK)',
    specializations: ['Shot-stopper', 'Sweeper-keeper'],
    indicators: [
      { id: 'FTB-POS-GK-01', name: 'Refleks', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Refleks'] },
      { id: 'FTB-POS-GK-02', name: 'Posisi Kiper', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Kiper'] },
      { id: 'FTB-POS-GK-03', name: 'Tangkapan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tangkapan'] },
      { id: 'FTB-POS-GK-04', name: 'Menepis Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Menepis Bola'] },
      { id: 'FTB-POS-GK-05', name: 'Duel Satu Lawan Satu', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Satu Lawan Satu'] },
      { id: 'FTB-POS-GK-06', name: 'Distribusi Tangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Distribusi Tangan'] },
      { id: 'FTB-POS-GK-07', name: 'Distribusi Kaki', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Distribusi Kaki'] },
      { id: 'FTB-POS-GK-08', name: 'Bola Udara', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Bola Udara'] },
      { id: 'FTB-POS-GK-09', name: 'Sweeping', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sweeping'] },
      { id: 'FTB-POS-GK-10', name: 'Komunikasi Pertahanan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Komunikasi Pertahanan'] },
      { id: 'FTB-POS-GK-11', name: 'Antisipasi Tembakan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Antisipasi Tembakan'] },
      { id: 'FTB-POS-GK-12', name: 'Posisi Awal', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Awal'] },
      { id: 'FTB-POS-GK-13', name: 'Penalti', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Penalti'] },
      { id: 'FTB-POS-GK-14', name: 'Keputusan Keluar', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Keluar'] },
      { id: 'FTB-POS-GK-15', name: 'Build-up Kiper', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Build-up Kiper'] }
    ]
  },
  {
    code: 'CB',
    label: 'CB — Bek Tengah (CB)',
    shortLabel: 'Bek Tengah (CB)',
    specializations: ['Stopper', 'Ball-playing defender'],
    indicators: [
      { id: 'FTB-POS-CB-01', name: 'Duel Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Bertahan'] },
      { id: 'FTB-POS-CB-02', name: 'Duel Udara', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Udara'] },
      { id: 'FTB-POS-CB-03', name: 'Interception', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Interception'] },
      { id: 'FTB-POS-CB-04', name: 'Timing Tekel', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Timing Tekel'] },
      { id: 'FTB-POS-CB-05', name: 'Penjagaan Lawan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Penjagaan Lawan'] },
      { id: 'FTB-POS-CB-06', name: 'Cover Pertahanan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cover Pertahanan'] },
      { id: 'FTB-POS-CB-07', name: 'Posisi Garis Belakang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Garis Belakang'] },
      { id: 'FTB-POS-CB-08', name: 'Antisipasi Lari', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Antisipasi Lari'] },
      { id: 'FTB-POS-CB-09', name: 'Clearance', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Clearance'] },
      { id: 'FTB-POS-CB-10', name: 'Umpan Progresif', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Progresif'] },
      { id: 'FTB-POS-CB-11', name: 'Build-up', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Build-up'] },
      { id: 'FTB-POS-CB-12', name: 'Transisi Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Bertahan'] }
    ]
  },
  {
    code: 'LB/RB',
    label: 'LB/RB — Bek Sayap (LB/RB)',
    shortLabel: 'Bek Sayap (LB/RB)',
    specializations: ['Defensive fullback', 'Attacking fullback'],
    indicators: [
      { id: 'FTB-POS-LB-01', name: 'Duel Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Sayap'] },
      { id: 'FTB-POS-LB-02', name: 'Bertahan Satu Lawan Satu', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Bertahan Satu Lawan Satu'] },
      { id: 'FTB-POS-LB-03', name: 'Overlap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Overlap'] },
      { id: 'FTB-POS-LB-04', name: 'Underlap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Underlap'] },
      { id: 'FTB-POS-LB-05', name: 'Akurasi Crossing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Akurasi Crossing'] },
      { id: 'FTB-POS-LB-06', name: 'Progresi Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Progresi Sayap'] },
      { id: 'FTB-POS-LB-07', name: 'Recovery Run', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Recovery Run'] },
      { id: 'FTB-POS-LB-08', name: 'Cover Sisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cover Sisi'] },
      { id: 'FTB-POS-LB-09', name: 'Kombinasi Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kombinasi Sayap'] },
      { id: 'FTB-POS-LB-10', name: 'Transisi Sisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Sisi'] }
    ]
  },
  {
    code: 'WB',
    label: 'WB — Wingback',
    shortLabel: 'Wingback (WB)',
    specializations: ['Wide runner', 'Attacking wingback'],
    indicators: [
      { id: 'FTB-POS-WB-01', name: 'Daya Jelajah', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Daya Jelajah'] },
      { id: 'FTB-POS-WB-02', name: 'Overlap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Overlap'] },
      { id: 'FTB-POS-WB-03', name: 'Underlap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Underlap'] },
      { id: 'FTB-POS-WB-04', name: 'Crossing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Crossing'] },
      { id: 'FTB-POS-WB-05', name: 'Duel Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Sayap'] },
      { id: 'FTB-POS-WB-06', name: 'Recovery Run', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Recovery Run'] },
      { id: 'FTB-POS-WB-07', name: 'Transisi Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Sayap'] },
      { id: 'FTB-POS-WB-08', name: 'Kontrol Lebar', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Lebar'] },
      { id: 'FTB-POS-WB-09', name: 'Dukungan Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dukungan Serangan'] },
      { id: 'FTB-POS-WB-10', name: 'Ketahanan Sisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Ketahanan Sisi'] }
    ]
  },
  {
    code: 'DM',
    label: 'DM — Gelandang Bertahan (DM)',
    shortLabel: 'Gelandang Bertahan (DM)',
    specializations: ['Ball-winner', 'Deep-lying playmaker'],
    indicators: [
      { id: 'FTB-POS-DM-01', name: 'Proteksi Lini', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Proteksi Lini'] },
      { id: 'FTB-POS-DM-02', name: 'Interception', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Interception'] },
      { id: 'FTB-POS-DM-03', name: 'Duel Tengah', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Tengah'] },
      { id: 'FTB-POS-DM-04', name: 'Screening', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Screening'] },
      { id: 'FTB-POS-DM-05', name: 'Sirkulasi Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sirkulasi Bola'] },
      { id: 'FTB-POS-DM-06', name: 'Umpan Progresif', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Progresif'] },
      { id: 'FTB-POS-DM-07', name: 'Orientasi Tubuh', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Orientasi Tubuh'] },
      { id: 'FTB-POS-DM-08', name: 'Kontrol Tempo', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Tempo'] },
      { id: 'FTB-POS-DM-09', name: 'Cover Gelandang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cover Gelandang'] },
      { id: 'FTB-POS-DM-10', name: 'Transisi Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Bertahan'] },
      { id: 'FTB-POS-DM-11', name: 'Build-up', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Build-up'] },
      { id: 'FTB-POS-DM-12', name: 'Disiplin Posisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Disiplin Posisi'] }
    ]
  },
  {
    code: 'CM',
    label: 'CM — Gelandang Tengah (CM)',
    shortLabel: 'Gelandang Tengah (CM)',
    specializations: ['Box-to-box', 'Playmaker'],
    indicators: [
      { id: 'FTB-POS-CM-01', name: 'Distribusi Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Distribusi Bola'] },
      { id: 'FTB-POS-CM-02', name: 'Progresi Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Progresi Bola'] },
      { id: 'FTB-POS-CM-03', name: 'Umpan Terobosan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Terobosan'] },
      { id: 'FTB-POS-CM-04', name: 'Kontrol Tempo', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Tempo'] },
      { id: 'FTB-POS-CM-05', name: 'Gerak Tanpa Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak Tanpa Bola'] },
      { id: 'FTB-POS-CM-06', name: 'Box-to-Box', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Box-to-Box'] },
      { id: 'FTB-POS-CM-07', name: 'Duel Tengah', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Tengah'] },
      { id: 'FTB-POS-CM-08', name: 'Pressing Tengah', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pressing Tengah'] },
      { id: 'FTB-POS-CM-09', name: 'Dukungan Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dukungan Serangan'] },
      { id: 'FTB-POS-CM-10', name: 'Recovery Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Recovery Bertahan'] },
      { id: 'FTB-POS-CM-11', name: 'Orientasi Tubuh', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Orientasi Tubuh'] },
      { id: 'FTB-POS-CM-12', name: 'Keputusan Progresif', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Progresif'] }
    ]
  },
  {
    code: 'AM',
    label: 'AM — Gelandang Serang (AM)',
    shortLabel: 'Gelandang Serang (AM)',
    specializations: ['Creator', 'Advanced playmaker'],
    indicators: [
      { id: 'FTB-POS-AM-01', name: 'Visi Umpan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Visi Umpan'] },
      { id: 'FTB-POS-AM-02', name: 'Umpan Kunci', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Kunci'] },
      { id: 'FTB-POS-AM-03', name: 'Umpan Terobosan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Terobosan'] },
      { id: 'FTB-POS-AM-04', name: 'Kontrol Ruang Antarlini', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Ruang Antarlini'] },
      { id: 'FTB-POS-AM-05', name: 'Kreativitas', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kreativitas'] },
      { id: 'FTB-POS-AM-06', name: 'Dribbling Ofensif', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dribbling Ofensif'] },
      { id: 'FTB-POS-AM-07', name: 'Finishing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Finishing'] },
      { id: 'FTB-POS-AM-08', name: 'Gerak Antarlini', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak Antarlini'] },
      { id: 'FTB-POS-AM-10', name: 'Pressing Depan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pressing Depan'] },
      { id: 'FTB-POS-AM-11', name: 'Keputusan Final', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Final'] },
      { id: 'FTB-POS-AM-12', name: 'Kontribusi Gol', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontribusi Gol'] }
    ]
  },
  {
    code: 'LM/RM',
    label: 'LM/RM — Gelandang Sayap (LM/RM)',
    shortLabel: 'Gelandang Sayap (LM/RM)',
    specializations: ['Wide creator', 'Tracking winger'],
    indicators: [
      { id: 'FTB-POS-LM-01', name: 'Kontrol Sisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Sisi'] },
      { id: 'FTB-POS-LM-02', name: 'Crossing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Crossing'] },
      { id: 'FTB-POS-LM-03', name: 'Dribbling Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dribbling Sayap'] },
      { id: 'FTB-POS-LM-04', name: 'Kombinasi Sisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kombinasi Sisi'] },
      { id: 'FTB-POS-LM-05', name: 'Umpan ke Dalam', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan ke Dalam'] },
      { id: 'FTB-POS-LM-06', name: 'Tracking Back', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tracking Back'] },
      { id: 'FTB-POS-LM-07', name: 'Lebar Permainan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Lebar Permainan'] },
      { id: 'FTB-POS-LM-08', name: 'Transisi Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Sayap'] },
      { id: 'FTB-POS-LM-09', name: 'Duel 1 on 1', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel 1 on 1'] },
      { id: 'FTB-POS-LM-10', name: 'Keputusan Crossing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Crossing'] }
    ]
  },
  {
    code: 'WFR/WFL',
    label: 'WFR/WFL — Sayap / Winger (WFR/WFL)',
    shortLabel: 'Winger / Sayap (WFR/WFL)',
    specializations: ['Inverted winger', 'Touchline winger'],
    indicators: [
      { id: 'FTB-POS-WF-01', name: 'Akselerasi Sayap', type: 'OBJECTIVE_TEST', legacy_keys: ['Akselerasi Sayap'] },
      { id: 'FTB-POS-WF-02', name: 'Dribbling Ofensif', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dribbling Ofensif'] },
      { id: 'FTB-POS-WF-03', name: 'Cut Inside', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cut Inside'] },
      { id: 'FTB-POS-WF-04', name: 'Crossing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Crossing'] },
      { id: 'FTB-POS-WF-05', name: 'Finishing Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Finishing Sayap'] },
      { id: 'FTB-POS-WF-06', name: 'Umpan Kunci', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Kunci'] },
      { id: 'FTB-POS-WF-07', name: 'Lari ke Ruang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Lari ke Ruang'] },
      { id: 'FTB-POS-WF-08', name: 'Duel 1 on 1', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel 1 on 1'] },
      { id: 'FTB-POS-WF-09', name: 'Pressing Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pressing Sayap'] },
      { id: 'FTB-POS-WF-10', name: 'Keputusan Akhir', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Akhir'] }
    ]
  },
  {
    code: 'SS',
    label: 'SS — Second Striker / Penyerang Kedua (SS)',
    shortLabel: 'Second Striker (SS)',
    specializations: ['Link-up forward', 'Shadow striker'],
    indicators: [
      { id: 'FTB-POS-SS-01', name: 'Link-up Play', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Link-up Play'] },
      { id: 'FTB-POS-SS-02', name: 'Gerak Antarlini', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak Antarlini'] },
      { id: 'FTB-POS-SS-03', name: 'Umpan Kunci', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Kunci'] },
      { id: 'FTB-POS-SS-04', name: 'Finishing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Finishing'] },
      { id: 'FTB-POS-SS-05', name: 'Lari Tanpa Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Lari Tanpa Bola'] },
      { id: 'FTB-POS-SS-06', name: 'Kombinasi Penyerang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kombinasi Penyerang'] },
      { id: 'FTB-POS-SS-07', name: 'Dribbling Ofensif', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dribbling Ofensif'] },
      { id: 'FTB-POS-SS-08', name: 'Tekanan Depan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tekanan Depan'] },
      { id: 'FTB-POS-SS-09', name: 'Rebound', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Rebound'] },
      { id: 'FTB-POS-SS-10', name: 'Keputusan Final', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Final'] }
    ]
  },
  {
    code: 'ST',
    label: 'ST — Striker (ST)',
    shortLabel: 'Striker (ST)',
    specializations: ['Target man', 'Poacher', 'Pressing forward'],
    indicators: [
      { id: 'FTB-POS-ST-01', name: 'Finishing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Finishing'] },
      { id: 'FTB-POS-ST-02', name: 'Penempatan Posisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Penempatan Posisi'] },
      { id: 'FTB-POS-ST-03', name: 'Lari di Belakang Bek', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Lari di Belakang Bek'] },
      { id: 'FTB-POS-ST-04', name: 'Duel Udara', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Udara'] },
      { id: 'FTB-POS-ST-05', name: 'Hold-up Play', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Hold-up Play'] },
      { id: 'FTB-POS-ST-06', name: 'Link-up Play', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Link-up Play'] },
      { id: 'FTB-POS-ST-07', name: 'Gerak di Kotak Penalti', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak di Kotak Penalti'] },
      { id: 'FTB-POS-ST-08', name: 'First-time Shot', type: 'OBSERVATION_RUBRIC', legacy_keys: ['First-time Shot'] },
      { id: 'FTB-POS-ST-09', name: 'Tekanan Depan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tekanan Depan'] },
      { id: 'FTB-POS-ST-10', name: 'Peluang Menjadi Gol', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Peluang Menjadi Gol'] },
      { id: 'FTB-POS-ST-11', name: 'Serangan Tiang Dekat', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan Tiang Dekat'] },
      { id: 'FTB-POS-ST-12', name: 'Serangan Tiang Jauh', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan Tiang Jauh'] }
    ]
  }
];

export const TIER_1_POSITIONS = [
  {
    code: 'OUTFIELD_SSB',
    label: 'Eksplorasi Pemain Lapangan (Rotasi Multi-Posisi)',
    shortLabel: 'Eksplorasi Pemain Lapangan',
    indicators: [
      { id: 'FTB-SSB-OUT-01', name: 'Keberanian Menguasai Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Menguasai Bola'] },
      { id: 'FTB-SSB-OUT-02', name: 'Koordinasi Mata-Kaki', type: 'OBJECTIVE_TEST', legacy_keys: ['Koordinasi Mata-Kaki'] },
      { id: 'FTB-SSB-OUT-03', name: 'Ketangkasan Fun Game', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Ketangkasan Fun Game'] },
      { id: 'FTB-SSB-OUT-04', name: 'Semangat Mencoba Posisi Baru', type: 'READINESS_CONTEXT', legacy_keys: ['Semangat Mencoba Posisi Baru'] },
      { id: 'FTB-SSB-OUT-05', name: 'Kesenangan Bermain', type: 'READINESS_CONTEXT', legacy_keys: ['Kesenangan Bermain'] }
    ]
  },
  {
    code: 'GK_SSB',
    label: 'Pengenalan Penjaga Gawang (GK Dasar)',
    shortLabel: 'Pengenalan Kiper',
    indicators: [
      { id: 'FTB-SSB-GK-01', name: 'Keberanian Menangkap Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Menangkap Bola'] },
      { id: 'FTB-SSB-GK-02', name: 'Koordinasi Tangan-Mata', type: 'OBJECTIVE_TEST', legacy_keys: ['Koordinasi Tangan-Mata'] },
      { id: 'FTB-SSB-GK-03', name: 'Ketangkasan Gerak Dasar', type: 'OBJECTIVE_TEST', legacy_keys: ['Ketangkasan Gerak Dasar'] },
      { id: 'FTB-SSB-GK-04', name: 'Distribusi Bola Dasar', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Distribusi Bola Dasar'] },
      { id: 'FTB-SSB-GK-05', name: 'Kesenangan Bermain', type: 'READINESS_CONTEXT', legacy_keys: ['Kesenangan Bermain'] }
    ]
  }
];

export const TIER_2_POSITIONS = [
  { code: 'GK', label: 'GK — Penjaga Gawang (Kiper Dasar)', shortLabel: 'Penjaga Gawang (GK)' },
  { code: 'CB', label: 'CB — Lini Belakang (Bek Dasar)', shortLabel: 'Bek Tengah (CB)' },
  { code: 'CM', label: 'CM — Lini Tengah (Gelandang Dasar)', shortLabel: 'Gelandang Tengah (CM)' },
  { code: 'ST', label: 'ST — Lini Depan (Penyerang Dasar)', shortLabel: 'Striker (ST)' }
];

export const FOOTBALL_PLAYING_STYLES = [
  { code: 'STY01', name: 'Playmaker', desc: 'Mengatur dan menciptakan serangan' },
  { code: 'STY02', name: 'Ball-winner', desc: 'Merebut penguasaan bola' },
  { code: 'STY03', name: 'Box-to-box', desc: 'Aktif di area bertahan dan menyerang' },
  { code: 'STY04', name: 'Inverted Winger', desc: 'Sayap yang bergerak ke tengah' },
  { code: 'STY05', name: 'Touchline Winger', desc: 'Sayap yang menjaga lebar' },
  { code: 'STY06', name: 'Target Man', desc: 'Penyerang sebagai tumpuan bola' },
  { code: 'STY07', name: 'Poacher', desc: 'Fokus mencari peluang gol' },
  { code: 'STY08', name: 'Pressing Forward', desc: 'Penyerang dengan tekanan tinggi' },
  { code: 'STY09', name: 'Ball-playing Defender', desc: 'Bek yang aktif membangun serangan' },
  { code: 'STY10', name: 'Sweeper-keeper', desc: 'Kiper yang aktif di luar kotak' },
  { code: 'STY11', name: 'Overlapping Fullback', desc: 'Bek sayap yang aktif melewati pemain depan' },
  { code: 'STY12', name: 'Deep-lying Playmaker', desc: 'Pengatur serangan dari area dalam' },
  { code: 'STY13', name: 'Inverted Fullback', desc: 'Bek sayap yang masuk ke area tengah' },
  { code: 'STY14', name: 'Shadow Striker', desc: 'Gelandang serang yang masuk ke area gol' }
];

// KAMUS 6 KATEGORI DENGAN minTier (1 s.d. 4)
export const FOOTBALL_CORE_CATEGORIES = {
  fisik: {
    key: 'fisik',
    title: 'Physical / Fisik',
    titleTier1: '1. Physical — Gerak Motorik & Kelincahan Dasar',
    titleDefault: '1. Physical — Kondisi Fisik',
    shortTitle: 'Fisik',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    indicators: [
      { id: 'FTB-UNI-PHY-01', name: 'Akselerasi', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Akselerasi'] },
      { id: 'FTB-UNI-PHY-02', name: 'Kelincahan', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Kelincahan'] },
      { id: 'FTB-UNI-PHY-03', name: 'Keseimbangan', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Keseimbangan'] },
      { id: 'FTB-UNI-PHY-04', name: 'Mobilitas', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Mobilitas'] },
      { id: 'FTB-UNI-PHY-05', name: 'Koordinasi Tubuh', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Tubuh'] },
      { id: 'FTB-UNI-PHY-06', name: 'Kecepatan Maksimal', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Kecepatan Maksimal'] },
      { id: 'FTB-UNI-PHY-07', name: 'Reaksi', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Reaksi'] },
      { id: 'FTB-UNI-PHY-08', name: 'Lompatan', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Lompatan'] },
      { id: 'FTB-UNI-PHY-09', name: 'Perubahan Arah', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Perubahan Arah'] },
      { id: 'FTB-UNI-PHY-10', name: 'Daya Tahan', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Daya Tahan'] },
      { id: 'FTB-UNI-PHY-11', name: 'Daya Ledak', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Daya Ledak'] },
      { id: 'FTB-UNI-PHY-12', name: 'Kekuatan Tubuh', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Kekuatan Tubuh'] },
      { id: 'FTB-UNI-PHY-13', name: 'Kekuatan Inti', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Kekuatan Inti'] },
      { id: 'FTB-UNI-PHY-14', name: 'Sprint Berulang', minTier: 4, type: 'OBJECTIVE_TEST', legacy_keys: ['Sprint Berulang'] },
      { id: 'FTB-UNI-PHY-15', name: 'Pemulihan', minTier: 4, type: 'READINESS_CONTEXT', legacy_keys: ['Pemulihan'] },
      { id: 'FTB-UNI-PHY-16', name: 'Intensitas Kerja', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Intensitas Kerja'] }
    ]
  },
  teknik: {
    key: 'teknik',
    title: 'Technical / Teknik',
    titleTier1: '2. Technical — Ball Feeling & Teknik Dasar',
    titleDefault: '2. Technical — Kemampuan Teknik',
    shortTitle: 'Teknik',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    indicators: [
      { id: 'FTB-UNI-TEC-01', name: 'Kontrol Bola', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Bola'] },
      { id: 'FTB-UNI-TEC-02', name: 'Sentuhan Pertama', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sentuhan Pertama'] },
      { id: 'FTB-UNI-TEC-03', name: 'Passing Pendek', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Passing Pendek'] },
      { id: 'FTB-UNI-TEC-04', name: 'Dribbling', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dribbling'] },
      { id: 'FTB-UNI-TEC-05', name: 'Finishing', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Finishing'] },
      { id: 'FTB-UNI-TEC-06', name: 'Passing Jauh', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Passing Jauh'] },
      { id: 'FTB-UNI-TEC-07', name: 'Kekuatan Tembakan', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Kekuatan Tembakan'] },
      { id: 'FTB-UNI-TEC-08', name: 'Tackling', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tackling'] },
      { id: 'FTB-UNI-TEC-09', name: 'Interception', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Interception'] },
      { id: 'FTB-UNI-TEC-10', name: 'Clearance', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Clearance'] },
      { id: 'FTB-UNI-TEC-11', name: 'Kaki Lemah', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kaki Lemah'] },
      { id: 'FTB-UNI-TEC-12', name: 'Umpan Terobosan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Terobosan'] },
      { id: 'FTB-UNI-TEC-13', name: 'Proteksi Bola', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Proteksi Bola'] },
      { id: 'FTB-UNI-TEC-14', name: 'Heading', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Heading'] },
      { id: 'FTB-UNI-TEC-15', name: 'Crossing', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Crossing'] },
      { id: 'FTB-UNI-TEC-16', name: 'Bola Mati', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Bola Mati'] },
      { id: 'FTB-UNI-TEC-17', name: 'First Touch Bertekanan', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['First Touch Bertekanan'] },
      { id: 'FTB-UNI-TEC-18', name: 'Duel Udara', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Udara'] },
      { id: 'FTB-UNI-TEC-19', name: 'Umpan Satu Sentuhan', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Satu Sentuhan'] },
      { id: 'FTB-UNI-TEC-20', name: 'Kontrol di Ruang Sempit', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol di Ruang Sempit'] }
    ]
  },
  taktik: {
    key: 'taktik',
    title: 'Tactical / Taktik',
    titleTier1: '3. Tactical — Pengenalan Permainan & Persepsi Ruang',
    titleDefault: '3. Tactical & Cognitive — Taktik dan Kognitif',
    shortTitle: 'Taktik',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    indicators: [
      { id: 'FTB-UNI-TAC-01', name: 'Posisi Bertahan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Bertahan'] },
      { id: 'FTB-UNI-TAC-02', name: 'Posisi Menyerang', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Menyerang'] },
      { id: 'FTB-UNI-TAC-03', name: 'Membuka Ruang', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Membuka Ruang'] },
      { id: 'FTB-UNI-TAC-04', name: 'Membaca Permainan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Membaca Permainan'] },
      { id: 'FTB-UNI-TAC-05', name: 'Pengambilan Keputusan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pengambilan Keputusan'] },
      { id: 'FTB-UNI-TAC-06', name: 'Gerak Tanpa Bola', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak Tanpa Bola'] },
      { id: 'FTB-UNI-TAC-07', name: 'Cover Rekan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cover Rekan'] },
      { id: 'FTB-UNI-TAC-08', name: 'Disiplin Formasi', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Disiplin Formasi'] },
      { id: 'FTB-UNI-TAC-09', name: 'Transisi Menyerang', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Menyerang'] },
      { id: 'FTB-UNI-TAC-10', name: 'Transisi Bertahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Bertahan'] },
      { id: 'FTB-UNI-TAC-11', name: 'Pressing', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pressing'] },
      { id: 'FTB-UNI-TAC-12', name: 'Menutup Ruang', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Menutup Ruang'] },
      { id: 'FTB-UNI-TAC-13', name: 'Progresi Bola', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Progresi Bola'] },
      { id: 'FTB-UNI-TAC-14', name: 'Serangan Balik', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan Balik'] },
      { id: 'FTB-UNI-TAC-15', name: 'Counter-Pressing', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Counter-Pressing'] },
      { id: 'FTB-UNI-TAC-16', name: 'Jarak Antarlini', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Jarak Antarlini'] },
      { id: 'FTB-UNI-TAC-17', name: 'Sirkulasi Bola', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sirkulasi Bola'] },
      { id: 'FTB-UNI-TAC-18', name: 'Menjaga Kedalaman', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Menjaga Kedalaman'] },
      { id: 'FTB-UNI-TAC-19', name: 'Adaptasi Taktik', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Adaptasi Taktik'] },
      { id: 'FTB-UNI-TAC-20', name: 'Keputusan di Bawah Tekanan', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan di Bawah Tekanan'] }
    ]
  },
  mental: {
    key: 'mental',
    title: 'Mental',
    titleTier1: '4. Mental — Antusiasme & Keberanian Bermain',
    titleDefault: '4. Mental — Mentalitas & Karakter',
    shortTitle: 'Mental',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    indicators: [
      { id: 'FTB-UNI-MEN-01', name: 'Fokus', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Fokus'] },
      { id: 'FTB-UNI-MEN-02', name: 'Percaya Diri', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Percaya Diri'] },
      { id: 'FTB-UNI-MEN-03', name: 'Disiplin', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Disiplin'] },
      { id: 'FTB-UNI-MEN-04', name: 'Orientasi Tim', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Orientasi Tim'] },
      { id: 'FTB-UNI-MEN-05', name: 'Kontrol Emosi', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Emosi'] },
      { id: 'FTB-UNI-MEN-06', name: 'Daya Juang', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Daya Juang'] },
      { id: 'FTB-UNI-MEN-07', name: 'Respons Kesalahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Kesalahan'] },
      { id: 'FTB-UNI-MEN-08', name: 'Tahan Tekanan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tahan Tekanan'] },
      { id: 'FTB-UNI-MEN-09', name: 'Konsistensi Mental', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Konsistensi Mental'] },
      { id: 'FTB-UNI-MEN-10', name: 'Keberanian Duel', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Duel'] }
    ]
  },
  komunikasi: {
    key: 'komunikasi',
    title: 'Communication / Komunikasi',
    titleTier1: '5. Teamwork — Kebersamaan & Komunikasi Cilik',
    titleDefault: '5. Teamwork & Communication',
    shortTitle: 'Komunikasi',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    indicators: [
      { id: 'FTB-UNI-COM-01', name: 'Komunikasi Verbal', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Komunikasi Verbal'] },
      { id: 'FTB-UNI-COM-02', name: 'Dukungan Rekan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dukungan Rekan'] },
      { id: 'FTB-UNI-COM-03', name: 'Komunikasi Nonverbal', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Komunikasi Nonverbal'] },
      { id: 'FTB-UNI-COM-04', name: 'Respons Instruksi', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Instruksi'] },
      { id: 'FTB-UNI-COM-05', name: 'Koordinasi Lini', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Lini'] },
      { id: 'FTB-UNI-COM-06', name: 'Kepemimpinan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kepemimpinan'] },
      { id: 'FTB-UNI-COM-07', name: 'Koordinasi Pressing', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Pressing'] },
      { id: 'FTB-UNI-COM-08', name: 'Koordinasi Bertahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Bertahan'] }
    ]
  },
  perkembangan: {
    key: 'perkembangan',
    title: 'Development / Perkembangan',
    titleTier1: '6. Health & Growth — Kesiapan & Pertumbuhan Usia Dini',
    titleDefault: '6. Health, Recovery & Development',
    shortTitle: 'Perkembangan',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    indicators: [
      { id: 'FTB-UNI-DEV-01', name: 'Kehadiran Latihan', minTier: 1, type: 'ADMINISTRATIVE_DATA', legacy_keys: ['Kehadiran Latihan'] },
      { id: 'FTB-UNI-DEV-02', name: 'Respons Latihan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Latihan'] },
      { id: 'FTB-UNI-DEV-03', name: 'Progres Teknik', minTier: 1, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Progres Teknik'] },
      { id: 'FTB-UNI-DEV-04', name: 'Kepatuhan Program', minTier: 2, type: 'ADMINISTRATIVE_DATA', legacy_keys: ['Kepatuhan Program'] },
      { id: 'FTB-UNI-DEV-05', name: 'Progres Fisik', minTier: 2, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Progres Fisik'] },
      { id: 'FTB-UNI-DEV-06', name: 'Progres Taktik', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Progres Taktik'] },
      { id: 'FTB-UNI-DEV-07', name: 'Pencapaian Target', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Pencapaian Target'] },
      { id: 'FTB-UNI-DEV-08', name: 'Kesiapan Bertanding', minTier: 3, type: 'READINESS_CONTEXT', legacy_keys: ['Kesiapan Bertanding'] },
      { id: 'FTB-UNI-DEV-09', name: 'Evaluasi Mandiri', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Evaluasi Mandiri'] },
      { id: 'FTB-UNI-DEV-10', name: 'Konsistensi Performa', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Konsistensi Performa'] }
    ]
  }
};

/**
 * Filter indicator names for a core category based on activeTier
 */
export function getFilteredIndicatorsForCategory(categoryKey, activeTier) {
  const cat = FOOTBALL_CORE_CATEGORIES[categoryKey];
  if (!cat) return [];
  return cat.indicators
    .filter((ind) => ind.minTier <= activeTier);
}

/**
 * Filter position indicators based on activeTier and position code
 */
export function getPositionIndicatorsForTier(code, activeTier) {
  if (activeTier === 1) {
    const ssbPos = TIER_1_POSITIONS.find((p) => p.code === code) || TIER_1_POSITIONS[0];
    return {
      code: ssbPos.code,
      label: ssbPos.label,
      shortLabel: ssbPos.shortLabel,
      tabTitle: 'Gerak Dasar & Fun Game (5)',
      indicators: ssbPos.indicators
    };
  }

  const posCfg = getPositionConfig(code);
  let sliced = posCfg.indicators;

  if (activeTier === 2) {
    sliced = posCfg.indicators.slice(0, 6);
  } else if (activeTier === 3) {
    sliced = posCfg.indicators.slice(0, 8);
  }

  return {
    code: posCfg.code,
    label: posCfg.label,
    shortLabel: posCfg.shortLabel,
    tabTitle: `Khusus [${posCfg.code}] (${sliced.length})`,
    indicators: sliced
  };
}

/**
 * Get available position list depending on activeTier
 */
export function getAvailablePositionsForTier(activeTier) {
  if (activeTier === 1) return TIER_1_POSITIONS;
  if (activeTier === 2) return TIER_2_POSITIONS;
  return FOOTBALL_POSITIONS;
}

/**
 * Checks if a class or academy sport corresponds to SepakBola, Minisoccer, or Futsal
 */
export function isFootballOrMinisoccer(selectedClass, activeAcademy) {
  const sportName = (selectedClass?.sport || activeAcademy?.sport || selectedClass?.sportCategory || activeAcademy?.category || '').toLowerCase();
  const searchTerms = ['sepakbola', 'sepak bola', 'minisoccer', 'mini soccer', 'soccer'];
  return searchTerms.some((term) => sportName.includes(term));
}

/**
 * Get position object by code
 */
export function getPositionConfig(code) {
  return FOOTBALL_POSITIONS.find((p) => p.code === code) || FOOTBALL_POSITIONS[10];
}

/**
 * Get playing style by code
 */
export function getStyleConfig(code) {
  return FOOTBALL_PLAYING_STYLES.find((s) => s.code === code) || FOOTBALL_PLAYING_STYLES[0];
}

export const SECONDARY_FOOTBALL_POSITIONS = [
  { code: 'NONE', label: 'Tidak Ada / Spesialis Murni' },
  { code: 'GK', label: 'GK — Penjaga Gawang (Kiper)' },
  { code: 'CB', label: 'CB — Bek Tengah (CB)' },
  { code: 'LB', label: 'LB — Left Back (Bek Kiri)' },
  { code: 'RB', label: 'RB — Right Back (Bek Kanan)' },
  { code: 'LWB/RWB', label: 'LWB/RWB — Wingback (LWB/RWB)' },
  { code: 'DMF', label: 'DMF — Defensive Midfielder (Gelandang Bertahan)' },
  { code: 'CMF', label: 'CMF — Central Midfielder (Gelandang Tengah)' },
  { code: 'AMF', label: 'AMF — Attacking Midfielder (Gelandang Serang)' },
  { code: 'LMF/RMF', label: 'LMF/RMF — Wide Midfielder (Gelandang Sayap)' },
  { code: 'LW', label: 'LW — Left Winger (Sayap Kiri)' },
  { code: 'RW', label: 'RW — Right Winger (Sayap Kanan)' },
  { code: 'SS', label: 'SS — Second Striker (Penyerang Kedua)' },
  { code: 'CF/ST', label: 'CF/ST — Center Forward / Striker' }
];
