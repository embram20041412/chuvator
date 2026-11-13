/**
 * Kamus Indikator & Konfigurasi Khusus: Athlete Development Assessment — Futsal Edition
 * Dilengkapi Sistem Kurikulum Berjenjang Futsal Berdasarkan Usia (Futsal Age-Stage LTAD)
 */

export function isFutsalSport(selectedClass, activeAcademy) {
  const candidates = [
    selectedClass?.sport,
    selectedClass?.sportCategory,
    selectedClass?.sportName,
    selectedClass?.className,
    selectedClass?.name,
    selectedClass?.category,
    selectedClass?.tenantName,
    selectedClass?.academyName,
    activeAcademy?.sport,
    activeAcademy?.sportCategory,
    activeAcademy?.sportName,
    activeAcademy?.category,
    activeAcademy?.name,
    activeAcademy?.workspaceName,
    activeAcademy?.tenantName,
    activeAcademy?.title
  ].filter(Boolean).map((s) => String(s).toLowerCase());

  return candidates.some((str) => str.includes('futsal'));
}

// 1. Definisi 4 Tier Kurikulum Futsal Berdasarkan Usia
export const FUTSAL_LTAD_TIERS = {
  1: {
    tier: 1,
    id: 'TIER1_FUTSAL',
    label: 'Tier 1 Futsal — Usia Dini (U-5 s.d. U-7)',
    shortBadge: 'Tier 1 Futsal: Usia Dini (U-5 - U-7)',
    ageGroupLabel: 'Usia Dini (U-5 s.d. U-7)',
    focusDescription: 'Stimulasi Gerak Dasar, Kecintaan Bola & Kelincahan Refleks Ruang Sempit',
    color: 'emerald'
  },
  2: {
    tier: 2,
    id: 'TIER2_FUTSAL',
    label: 'Tier 2 Futsal — Usia Anak (U-8 s.d. U-12)',
    shortBadge: 'Tier 2 Futsal: Usia Anak (U-8 - U-12)',
    ageGroupLabel: 'Usia Anak (U-8 s.d. U-12)',
    focusDescription: 'Teknik Dasar Futsal: Passing, Kontrol Telapak Kaki (Sole Control), Dribbling & Duel 1v1',
    color: 'blue'
  },
  3: {
    tier: 3,
    id: 'TIER3_FUTSAL',
    label: 'Tier 3 Futsal — Usia Remaja (U-13 s.d. U-16)',
    shortBadge: 'Tier 3 Futsal: Usia Remaja (U-13 - U-16)',
    ageGroupLabel: 'Usia Remaja (U-13 s.d. U-16)',
    focusDescription: 'Pemahaman Peran Posisi Anchor/Flank/Pivot, Rotasi Taktik, Power Play & Fisik Spesifik',
    color: 'purple'
  },
  4: {
    tier: 4,
    id: 'TIER4_FUTSAL',
    label: 'Tier 4 Futsal — High Performance / Pro Standard (U-17+)',
    shortBadge: 'Tier 4 Futsal: Pemuda / Pro (U-17+)',
    ageGroupLabel: 'Usia Pemuda / Pro (U-17 s.d. Pro)',
    focusDescription: 'Kompetisi Pelajar/Elit, Liga Futsal Nusantara & Standar Tim Pro Futsal League',
    color: 'amber'
  }
};

// 2. Fungsi Deteksi Otomatis Tier Futsal berdasarkan Usia / Tanggal Lahir / Nama Kelas
export function detectFutsalTier(student, selectedClass) {
  let age = null;

  if (typeof student?.age === 'number' && student.age > 0) {
    age = student.age;
  } else if (student?.birthDate) {
    const birthYear = new Date(student.birthDate).getFullYear();
    if (!isNaN(birthYear) && birthYear > 1900) {
      age = new Date().getFullYear() - birthYear;
    }
  }

  const className = (selectedClass?.className || selectedClass?.name || '').toUpperCase();

  if (className.includes('U-5') || className.includes('U-6') || className.includes('U-7') || className.includes('U5') || className.includes('U6') || className.includes('U7') || className.includes('DINI') || className.includes('KIDS')) {
    if (!age || age <= 7) return 1;
  }
  if (className.includes('U-8') || className.includes('U-9') || className.includes('U-10') || className.includes('U-11') || className.includes('U-12') || className.includes('U8') || className.includes('U10') || className.includes('U12')) {
    if (!age || (age >= 8 && age <= 12)) return 2;
  }
  if (className.includes('U-13') || className.includes('U-14') || className.includes('U-15') || className.includes('U-16') || className.includes('U13') || className.includes('U15') || className.includes('U16') || className.includes('REMAJA')) {
    if (!age || (age >= 13 && age <= 16)) return 3;
  }
  if (className.includes('U-17') || className.includes('U-18') || className.includes('U-19') || className.includes('U-20') || className.includes('PRO') || className.includes('NUSA') || className.includes('SENIOR') || className.includes('LIGA')) {
    if (!age || age >= 17) return 4;
  }

  // Fallback berdasarkan usia angka
  if (age !== null) {
    if (age <= 7) return 1;
    if (age >= 8 && age <= 12) return 2;
    if (age >= 13 && age <= 16) return 3;
    if (age >= 17) return 4;
  }

  // Default fallback jika data belum ada = Tier 3 (U-13 s.d. U-16 Remaja)
  return 3;
}

export function getFutsalAgeStageLabel(tier) {
  const config = FUTSAL_LTAD_TIERS[tier] || FUTSAL_LTAD_TIERS[3];
  return `${config.ageGroupLabel}`;
}

// 3. Posisi Mode Khusus Tier 1 Futsal (Usia Dini U-5 s.d. U-7)
export const TIER1_FUTSAL_EXPLORATION_POSITION = {
  id: 'EXPLORATION',
  label: 'Eksplorasi Bermain & Motorik Futsal (Semua Lini)',
  title: 'Stimulasi Gerak Dasar & Refleks Ruang Sempit',
  metrics: [
    'Koordinasi Mata-Kaki & Pengenalan Bola',
    'Kelincahan Refleks Ruang Sempit (Change of Direction Dasar)',
    'Keseimbangan Tubuh & Gerak Lokomotor',
    'Keberanian Menggiring & Menendang Bola',
    'Kecintaan terhadap Bola & Kegembiraan Bermain (Joy of Playing)'
  ]
};

// 4. Posisi Rotasi Khusus Tier 2 Futsal (Usia Anak U-8 s.d. U-12)
export const TIER2_FUTSAL_BASIC_ROTATIONS = {
  OUTFIELD: {
    id: 'OUTFIELD',
    label: 'Outfield Player (Rotasi Court Player)',
    shortLabel: 'Court Player',
    title: 'Fundamental Teknik & Duel 1v1 Futsal (Court Player)',
    metrics: [
      'Kontrol Telapak Kaki (Sole Control Fundamental)',
      'Dribbling Ruang Sempit',
      'Keberanian Duel 1v1 (Attacking & Defending)',
      'Passing & Receiving Dasar',
      'Pergerakan Cari Ruang Bebas'
    ]
  },
  GK_BASE: {
    id: 'GK_BASE',
    label: 'Goalkeeper Dasar (Pengenalan Kiper Futsal)',
    shortLabel: 'GK Dasar',
    title: 'Fundamental Teknik & Refleks Kiper Futsal',
    metrics: [
      'Keberanian Menutup Ruang Tembak',
      'Refleks Tangan & Kaki Dasar',
      'Tangkapan & Blok Bola Rendah',
      'Lemparan Distribusi Dasar',
      'Keberanian Komunikasi'
    ]
  }
};

// 5. Posisi Utama Futsal (4 Posisi Inti untuk Tier 3 & Tier 4)
export const FUTSAL_PRIMARY_POSITIONS = {
  GK: {
    id: 'GK',
    label: 'Goalkeeper (GK)',
    shortLabel: 'GK',
    defaultRole: 'Sweeper GK',
    roles: ['Sweeper GK', 'Shot Stopper GK', 'Distributor GK', 'Traditional GK']
  },
  ANCHOR: {
    id: 'ANCHOR',
    label: 'Anchor (Fixo)',
    shortLabel: 'Anchor',
    defaultRole: 'Playmaking Anchor',
    roles: ['Playmaking Anchor', 'Defensive Fixo', 'Ball-Playing Anchor', 'Cover Anchor']
  },
  FLANK: {
    id: 'FLANK',
    label: 'Flank / Ala',
    shortLabel: 'Flank',
    defaultRole: 'Inverted Ala',
    roles: ['Inverted Ala', 'Classic Winger Ala', 'Creative Playmaker Ala', 'Defensive Ala', 'Pacey Ala']
  },
  PIVOT: {
    id: 'PIVOT',
    label: 'Pivot',
    shortLabel: 'Pivot',
    defaultRole: 'Target Pivot',
    roles: ['Target Pivot', 'Mobile/False Pivot', 'Holding Pivot', 'Pressing Pivot']
  }
};

// 6. Opsi Posisi Sekunder & Fleksibilitas Futsal
export const FUTSAL_SECONDARY_OPTIONS = [
  { id: '', label: 'Tidak Ada Posisi Sekunder' },
  { id: 'GK', label: 'Goalkeeper (GK)' },
  { id: 'ANCHOR', label: 'Anchor (Fixo)' },
  { id: 'FLANK', label: 'Flank / Ala' },
  { id: 'PIVOT', label: 'Pivot' },
  { id: 'UNIVERSAL', label: 'Universal / Hybrid Player' }
];

// 7. Kamus Indikator 6 Pilar Inti Futsal dengan Tag minFutsalTier (1, 2, 3, 4)
export const FUTSAL_CORE_PILLARS = {
  fisik: {
    id: 'fisik',
    titleTier1: '1. Physical — Stimulasi Gerak & Kelincahan Refleks',
    titleDefault: '1. Physical — Kondisi Fisik Futsal',
    color: 'rose',
    metrics: [
      { name: 'Agility', minFutsalTier: 1 },
      { name: 'Body Balance', minFutsalTier: 1 },
      { name: 'Mobility', minFutsalTier: 1 },
      { name: 'Sprint & Acceleration', minFutsalTier: 1 },
      { name: 'Braking / Deceleration', minFutsalTier: 2 },
      { name: 'VO₂ Max / Cardio', minFutsalTier: 3 },
      { name: 'Repeated Sprint Ability', minFutsalTier: 3 },
      { name: 'Explosive Power', minFutsalTier: 3 },
      { name: 'Strength', minFutsalTier: 3 },
      { name: 'Futsal-Specific Endurance', minFutsalTier: 4 }
    ]
  },
  teknik: {
    id: 'teknik',
    titleTier1: '2. Technical — Sole Control & Ball Feeling',
    titleDefault: '2. Technical — Teknik Futsal',
    color: 'blue',
    metrics: [
      { name: 'Sole Control', minFutsalTier: 1 },
      { name: 'Dribbling & First Touch', minFutsalTier: 1 },
      { name: 'Shooting / Finishing', minFutsalTier: 1 },
      { name: 'Passing Accuracy', minFutsalTier: 2 },
      { name: 'One-Touch Passing', minFutsalTier: 2 },
      { name: 'Wall Pass', minFutsalTier: 2 },
      { name: 'Tackling / Intercepting', minFutsalTier: 2 },
      { name: 'Weak-Foot Proficiency', minFutsalTier: 2 },
      { name: 'Receiving Under Pressure', minFutsalTier: 3 },
      { name: 'Toe-Poke Shooting', minFutsalTier: 3 },
      { name: 'Ball Shielding', minFutsalTier: 3 },
      { name: 'Finishing Cepat', minFutsalTier: 4 }
    ]
  },
  taktik: {
    id: 'taktik',
    titleTier1: '3. Tactical — Persepsi Ruang Sempit & Pengenalan Permainan',
    titleDefault: '3. Tactical & Cognitive — Taktik dan Kognitif',
    color: 'purple',
    metrics: [
      { name: 'Vision & Decision Making', minFutsalTier: 1 },
      { name: 'Positioning', minFutsalTier: 2 },
      { name: 'Scanning', minFutsalTier: 2 },
      { name: 'Support Angle', minFutsalTier: 2 },
      { name: 'Transition Speed', minFutsalTier: 3 },
      { name: 'Rotation Timing', minFutsalTier: 3 },
      { name: 'Defensive Compactness', minFutsalTier: 3 },
      { name: 'Set-Play Understanding', minFutsalTier: 3 },
      { name: 'Pressing Triggers', minFutsalTier: 4 },
      { name: 'Cover Balance', minFutsalTier: 4 },
      { name: 'Overload Creation', minFutsalTier: 4 }
    ]
  },
  mental: {
    id: 'mental',
    titleTier1: '4. Mental — Keberanian 1v1 & Antusiasme',
    titleDefault: '4. Mental — Mentalitas Futsal',
    color: 'emerald',
    metrics: [
      { name: 'Confidence in 1v1', minFutsalTier: 1 },
      { name: 'Coachability', minFutsalTier: 1 },
      { name: 'Concentration', minFutsalTier: 2 },
      { name: 'Emotional Control', minFutsalTier: 2 },
      { name: 'Resilience', minFutsalTier: 3 },
      { name: 'Composure Under Pressure', minFutsalTier: 3 },
      { name: 'Discipline During Substitutions', minFutsalTier: 3 }
    ]
  },
  teamwork: {
    id: 'teamwork',
    titleTier1: '5. Teamwork — Berbagi Bola & Komunikasi Dasar',
    titleDefault: '5. Teamwork & Communication',
    color: 'amber',
    metrics: [
      { name: 'Passing Support', minFutsalTier: 1 },
      { name: 'Cover Communication', minFutsalTier: 2 },
      { name: 'Rotation Coordination', minFutsalTier: 3 },
      { name: 'Substitution Readiness', minFutsalTier: 3 },
      { name: 'Line-of-Press Coordination', minFutsalTier: 4 },
      { name: 'Set-Play Responsibility', minFutsalTier: 4 }
    ]
  },
  health: {
    id: 'health',
    titleTier1: '6. Health & Growth — Kesiapan & Pertumbuhan Usia Dini',
    titleDefault: '6. Kesehatan dan Perkembangan (Health & Development)',
    color: 'teal',
    metrics: [
      { name: 'Availability', minFutsalTier: 1 },
      { name: 'Growth / Maturation', minFutsalTier: 1 },
      { name: 'Sleep / Recovery', minFutsalTier: 1 },
      { name: 'Injury History (Ketahanan Cedera)', minFutsalTier: 3 },
      { name: 'Performance Trend', minFutsalTier: 3 },
      { name: 'Training Load', minFutsalTier: 4 },
      { name: 'Fatigue / Readiness', minFutsalTier: 4 }
    ]
  }
};

// Helper untuk menyaring daftar nama indikator Futsal berdasarkan Tier aktif
export function getFilteredFutsalMetricsForTier(pillarKey, tier) {
  const pillar = FUTSAL_CORE_PILLARS[pillarKey];
  if (!pillar) return [];
  const numericTier = Number(tier) || 3;
  return pillar.metrics
    .filter((m) => (m.minFutsalTier ?? m.minTier ?? 1) <= numericTier)
    .map((m) => m.name);
}

// 8. Kamus Indikator Spesifik Posisi Futsal Penuh
export const FUTSAL_POSITION_METRICS = {
  GK: [
    'Shot-stopping',
    'Goal positioning',
    'Reaction speed',
    'Low-shot defense',
    'Close-range defense',
    'One-on-one defense',
    'Rebound control',
    'Deflection response',
    'Distribution accuracy',
    'Quick distribution decision',
    'Footwork & balance',
    'Build-up participation',
    'Sweeper actions',
    'Communication & organization',
    'Composure under pressure'
  ],
  ANCHOR: [
    'Defensive positioning',
    'Defensive coverage',
    'Interception timing',
    '1v1 defensive ability',
    'Blocking & shot lanes',
    'Pressing resistance',
    'Short-pass accuracy',
    'Line-breaking pass',
    'Build-up decision-making',
    'Transition defense',
    'Defensive balance',
    'Communication & organization',
    'Acceleration & deceleration',
    'Strength & body positioning',
    'Tactical discipline'
  ],
  FLANK: [
    'Short-distance acceleration',
    'Agility & change of direction',
    'Repeated sprint ability',
    'Sole control',
    'Tight-space dribbling',
    '1v1 attacking',
    '1v1 defending',
    'One-touch passing',
    'Wall-pass combination',
    'Passing under pressure',
    'Cut-inside & outside attack',
    'Support-angle creation',
    'Rotation timing',
    'Defensive recovery',
    'Counterpressing',
    'Shooting accuracy',
    'Weak-foot proficiency',
    'Tactical communication'
  ],
  PIVOT: [
    'Hold-up play',
    'Sole control & first touch',
    'Ball shielding',
    'Back-to-goal receiving',
    'Lay-off passing',
    'One-touch combination',
    'Pivot rotation',
    'Space creation',
    'Box positioning',
    'Finishing accuracy',
    'Quick-release shooting',
    'Toe-poke finishing',
    'Turning under pressure',
    'Off-ball movement',
    'Pressing initiation',
    'Defensive transition',
    'Strength & balance',
    'Composure in finishing'
  ]
};

// 9. Kamus Indikator Atribut Fleksibilitas / Universal & Hybrid Player (10 Indikator)
export const FUTSAL_UNIVERSAL_HYBRID_METRICS = [
  'Role adaptability',
  'Positional awareness',
  'Technical versatility',
  'Transition adaptability',
  'Decision-making flexibility',
  'Defensive responsibility',
  'Combination play',
  'Communication',
  'Tactical learning',
  'Performance consistency across roles'
];

// 10. Kalkulasi Bobot Skor Akhir Futsal Berdasarkan Tier
export function calculateFutsalTierOverallScore(pillarScoresMap, posVal, universalVal, isUniversal, tier) {
  const {
    fisik = 75,
    teknik = 75,
    taktik = 75,
    mental = 75,
    teamwork = 75,
    health = 75
  } = pillarScoresMap || {};

  const posScore = posVal !== undefined && posVal !== null ? posVal : 75;

  if (tier === 1) {
    // Tier 1 Futsal (U-5 s.d. U-7): Physical/Motorik & Agility (30%), Technical/Ball Feeling (30%), Mental/Joy (20%), Teamwork (10%), Health/Growth (10%)
    return Math.round(
      fisik * 0.30 +
      teknik * 0.30 +
      mental * 0.20 +
      teamwork * 0.10 +
      health * 0.10
    );
  }

  if (tier === 2) {
    // Tier 2 Futsal (U-8 s.d. U-12): Technical Futsal & 1v1 (35%), Physical/Agility (20%), Mental (15%), Tactical Dasar (10%), Teamwork (10%), Health (10%)
    return Math.round(
      teknik * 0.35 +
      fisik * 0.20 +
      mental * 0.15 +
      taktik * 0.10 +
      teamwork * 0.10 +
      health * 0.10
    );
  }

  // Tier 3 & Tier 4 (U-13 s.d. Pro): 7-Axis (atau 8-Axis) Average
  const scoresArr = [fisik, teknik, taktik, mental, teamwork, health, posScore];
  if (isUniversal && universalVal !== undefined && universalVal !== null) {
    scoresArr.push(universalVal);
  }

  return Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length);
}
