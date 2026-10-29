/**
 * LTAD (Long-Term Athlete Development) & Age-Stage Progressive Disclosure Configuration
 * Khusus Cabang Olahraga Sepakbola & Minisoccer
 */

// 1. Definisi Tier Kurikulum Berdasarkan Usia
export const FOOTBALL_LTAD_TIERS = {
  1: {
    tier: 1,
    id: 'TIER1',
    label: 'Tier 1 — Foundation: Usia Dini / SSB (<= 12 Thn)',
    shortBadge: 'Tier 1: Foundation (SSB)',
    ageGroupLabel: 'Usia Dini / SSB (U-6 s.d. U-12)',
    focusDescription: 'Pengenalan Bola, Motorik Dasar, Keberanian 1v1 & Kegembiraan Bermain (Joy of Playing)',
    color: 'emerald'
  },
  2: {
    tier: 2,
    id: 'TIER2',
    label: 'Tier 2 — Learning to Train: U-13 (13 Thn)',
    shortBadge: 'Tier 2: Learning to Train (U-13)',
    ageGroupLabel: 'Pengembangan Lini Dasar (U-13)',
    focusDescription: 'Spesialisasi 4 Lini Utama, Teknik Dasar Spesifik & Persepsi Ruang Formasi',
    color: 'blue'
  },
  3: {
    tier: 3,
    id: 'TIER3',
    label: 'Tier 3 — Training to Compete: U-15 (14 - 15 Thn)',
    shortBadge: 'Tier 3: Training to Compete (U-15)',
    ageGroupLabel: 'Pengembangan Taktik & Peran (U-15)',
    focusDescription: 'Hierarki Sub-Posisi, Taktik Tim, Transisi Cepat & Ketahanan Mental Kompetisi',
    color: 'purple'
  },
  4: {
    tier: 4,
    id: 'TIER4',
    label: 'Tier 4 — High Performance / Elite: U-16 s.d. Profesional (16+ Thn)',
    shortBadge: 'Tier 4: Elite / Pro (U-16+)',
    ageGroupLabel: 'Kompetisi Elit & Pre-Professional (U-16 s.d. Pro)',
    focusDescription: 'Pematangan Taktik Elit, Peran Spesifik Lanjutan, Tuntutan Fisik Tinggi & Kesiapan Pro',
    color: 'indigo'
  }
};

// 2. Fungsi Deteksi Otomatis Tier berdasarkan Usia / Tanggal Lahir / Nama Kelas
export function detectFootballTier(student, selectedClass) {
  // Cek apakah ada age / birthDate pada student
  let age = null;

  if (typeof student?.age === 'number' && student.age > 0) {
    age = student.age;
  } else if (student?.birthDate) {
    const birthYear = new Date(student.birthDate).getFullYear();
    if (!isNaN(birthYear) && birthYear > 1900) {
      age = new Date().getFullYear() - birthYear;
    }
  }

  // Cek juga dari nama kelas (e.g., "U-12", "U13", "SSB", "U-15", "Pro", "Senior")
  const className = (selectedClass?.className || selectedClass?.name || '').toUpperCase();

  if (className.includes('SSB') || className.includes('U-8') || className.includes('U-10') || className.includes('U-12') || className.includes('U8') || className.includes('U10') || className.includes('U12')) {
    if (!age || age <= 12) return 1;
  }
  if (className.includes('U-13') || className.includes('U13')) {
    if (!age || age === 13) return 2;
  }
  if (className.includes('U-15') || className.includes('U15') || className.includes('U-14') || className.includes('U14')) {
    if (!age || (age >= 14 && age <= 15)) return 3;
  }
  if (className.includes('U-16') || className.includes('U-17') || className.includes('U-18') || className.includes('U-20') || className.includes('PRO') || className.includes('SENIOR')) {
    if (!age || age >= 16) return 4;
  }

  // Fallback berdasarkan Usia Angka
  if (age !== null) {
    if (age <= 12) return 1;
    if (age === 13) return 2;
    if (age >= 14 && age <= 15) return 3;
    if (age >= 16) return 4;
  }

  // Default fallback jika tidak ada data usia = Tier 3 (U-15)
  return 3;
}

// Helper untuk mendapatkan label deskriptif jenjang usia
export function getFootballAgeStageLabel(tier, student) {
  const config = FOOTBALL_LTAD_TIERS[tier] || FOOTBALL_LTAD_TIERS[3];
  return `${config.ageGroupLabel}`;
}

// 3. Posisi Khusus Tier 1 (Usia Dini / SSB)
export const TIER1_EXPLORATION_POSITIONS = {
  OUTFIELD: {
    id: 'OUTFIELD',
    label: 'Outfield Player (Rotasi Multi-Posisi)',
    title: 'Keterampilan Gerak Dasar & Eksplorasi Bermain (Outfield)',
    metrics: [
      'Koordinasi Mata-Kaki & Ball Feeling',
      'Kelincahan & Gerak Lokomotor Dasar',
      'Keberanian Menggiring 1v1',
      'Pengenalan Ruang & Arah Serangan',
      'Kegembiraan Bermain (Joy of Playing)'
    ]
  },
  GK_BASE: {
    id: 'GK_BASE',
    label: 'Goalkeeper Dasar (Pengenalan Kiper)',
    title: 'Keterampilan Gerak Dasar Kiper Cilik',
    metrics: [
      'Keberanian Menangkap Bola',
      'Koordinasi Tangan-Mata',
      'Gerak Dasar & Keseimbangan Tubuh',
      'Distribusi Lemparan/Tendangan Dasar',
      'Keberanian Komunikasi'
    ]
  }
};

// 4. Posisi Khusus Tier 2 (U-13 - 4 Lini Utama)
export const TIER2_BASIC_LINE_POSITIONS = {
  GK: {
    id: 'GK',
    label: 'Goalkeeper (Lini Kiper)',
    shortLabel: 'GK',
    title: 'Parameter Dasar Lini Goalkeeper (GK)',
    metrics: [
      'Shot-stopping & Tangkapan Bola',
      'Goal Positioning & Sudut Gawang',
      'Kecepatan Reaksi Sederhana',
      'Distribusi Lemparan & Tendangan',
      'Komunikasi Area Penalti'
    ]
  },
  DEFENDER: {
    id: 'DEFENDER',
    label: 'Defender (Lini Belakang)',
    shortLabel: 'Defender',
    title: 'Parameter Dasar Lini Pertahanan (Defender)',
    metrics: [
      'Posisi Bertahan Dasar (Body Shape)',
      'Teknik Tackling & Intercept',
      'Keberanian Duel Udara / Heading',
      'Umpan Pendek Bangun Serangan',
      'Kedisiplinan Menjaga Lawan'
    ]
  },
  MIDFIELDER: {
    id: 'MIDFIELDER',
    label: 'Midfielder (Lini Tengah)',
    shortLabel: 'Midfielder',
    title: 'Parameter Dasar Lini Tengah (Midfielder)',
    metrics: [
      'Umpan Akurat & Menjaga Bola',
      'First Touch & Orientasi Badan',
      'Stamina Lari Lini Tengah',
      'Dukungan Serangan & Pertahanan',
      'Scanning & Penglihatan Lapangan'
    ]
  },
  FORWARD: {
    id: 'FORWARD',
    label: 'Forward (Lini Depan)',
    shortLabel: 'Forward',
    title: 'Parameter Dasar Lini Depan (Forward)',
    metrics: [
      'Finishing / Dribel Menembak',
      'Keberanian Penetrasi 1v1',
      'Pergerakan Mencari Ruang',
      'First Touch Bawah Tekanan',
      'Pressing Awal Pertahanan'
    ]
  }
};

// 5. Kamus 6 Pilar Inti dengan Atribut minTier (1, 2, 3, 4)
export const FOOTBALL_LTAD_CORE_PILLARS = {
  fisik: {
    id: 'fisik',
    titleTier1: '1. Physical — Gerak Motorik & Kelincahan Dasar',
    titleDefault: '1. Physical — Kondisi Fisik',
    color: 'rose',
    metrics: [
      { name: 'Body Balance', minTier: 1 },
      { name: 'Agility', minTier: 1 },
      { name: 'Mobility', minTier: 1 },
      { name: 'Sprint & Acceleration', minTier: 1 },
      { name: 'VO₂ Max / Cardio', minTier: 2 },
      { name: 'Strength', minTier: 3 },
      { name: 'Power', minTier: 3 },
      { name: 'Repeated Sprint Ability', minTier: 3 },
      { name: 'Deceleration', minTier: 4 }
    ]
  },
  teknik: {
    id: 'teknik',
    titleTier1: '2. Technical — Ball Feeling & Teknik Dasar',
    titleDefault: '2. Technical — Kemampuan Teknik',
    color: 'blue',
    metrics: [
      { name: 'Dribbling & First Touch', minTier: 1 },
      { name: 'Passing Accuracy', minTier: 1 },
      { name: 'Shooting / Finishing', minTier: 1 },
      { name: 'Weak Foot', minTier: 2 },
      { name: 'Tackling / Intercepting', minTier: 2 },
      { name: 'Heading', minTier: 2 },
      { name: 'Receiving Orientation', minTier: 3 },
      { name: 'Crossing', minTier: 3 },
      { name: 'Progressive Passing', minTier: 4 },
      { name: 'Ball Control Under Pressure', minTier: 4 }
    ]
  },
  taktik: {
    id: 'taktik',
    titleTier1: '3. Tactical — Pengenalan Permainan & Persepsi Ruang',
    titleDefault: '3. Tactical & Cognitive — Taktik dan Kognitif',
    color: 'purple',
    metrics: [
      { name: 'Spatial Awareness', minTier: 1 },
      { name: 'Vision & Decision Making', minTier: 1 },
      { name: 'Positioning', minTier: 2 },
      { name: 'Off-Ball Movement', minTier: 2 },
      { name: 'Understanding of Formation', minTier: 2 },
      { name: 'Transition Speed', minTier: 3 },
      { name: 'Scanning', minTier: 3 },
      { name: 'Anticipation', minTier: 3 },
      { name: 'Pressing Triggers', minTier: 4 }
    ]
  },
  mental: {
    id: 'mental',
    titleTier1: '4. Mental — Antusiasme & Keberanian Bermain',
    titleDefault: '4. Mental — Mentalitas & Karakter',
    color: 'emerald',
    metrics: [
      { name: 'Confidence', minTier: 1 },
      { name: 'Motivation', minTier: 1 },
      { name: 'Coachability', minTier: 1 },
      { name: 'Concentration', minTier: 2 },
      { name: 'Emotional Control', minTier: 2 },
      { name: 'Resilience', minTier: 3 },
      { name: 'Goal Setting', minTier: 3 }
    ]
  },
  teamwork: {
    id: 'teamwork',
    titleTier1: '5. Teamwork — Kebersamaan & Komunikasi Cilik',
    titleDefault: '5. Teamwork & Communication',
    color: 'amber',
    metrics: [
      { name: 'Teamwork', minTier: 1 },
      { name: 'On-Field Communication', minTier: 1 },
      { name: 'Coordination', minTier: 2 },
      { name: 'Cover Support', minTier: 2 },
      { name: 'Tactical Discipline', minTier: 3 },
      { name: 'Leadership', minTier: 3 },
      { name: 'Accountability', minTier: 4 }
    ]
  },
  health: {
    id: 'health',
    titleTier1: '6. Health & Growth — Kesiapan & Pertumbuhan Usia Dini',
    titleDefault: '6. Health, Recovery & Development',
    color: 'teal',
    metrics: [
      { name: 'Ketersediaan Latihan', minTier: 1 },
      { name: 'Pertumbuhan / Maturasi', minTier: 1 },
      { name: 'Sleep / Recovery', minTier: 1 },
      { name: 'Performance Trend', minTier: 2 },
      { name: 'Injury History', minTier: 2 },
      { name: 'Fatigue / Readiness', minTier: 3 },
      { name: 'Recovery', minTier: 3 },
      { name: 'Training Load', minTier: 4 }
    ]
  }
};

// Helper untuk menyaring daftar nama indikator berdasarkan Tier aktif
export function getFilteredMetricsForTier(pillarKey, tier) {
  const pillar = FOOTBALL_LTAD_CORE_PILLARS[pillarKey];
  if (!pillar) return [];
  return pillar.metrics
    .filter((m) => m.minTier <= tier)
    .map((m) => m.name);
}

// 6. Kalkulasi Bobot Skor Akhir Berdasarkan Tier (Dynamic Overall Score Weighting)
export function calculateTierOverallScore(pillarScoresMap, positionScore, tier) {
  const {
    fisik = 75,
    teknik = 75,
    taktik = 75,
    mental = 75,
    teamwork = 75,
    health = 75
  } = pillarScoresMap || {};

  const posVal = positionScore !== undefined && positionScore !== null ? positionScore : 75;

  if (tier === 1) {
    // Tier 1 (SSB): Technical (30%), Physical/Motorik (20%), Mental/Joy (20%), Teamwork (15%), Health/Growth (10%), Tactical/Game Sense (5%)
    return Math.round(
      teknik * 0.30 +
      fisik * 0.20 +
      mental * 0.20 +
      teamwork * 0.15 +
      health * 0.10 +
      posVal * 0.05
    );
  }

  if (tier === 2) {
    // Tier 2 (U-13): Technical (25%), Tactical (15%), Physical (15%), Mental (15%), Teamwork (10%), Health (10%), Position Specific (10%)
    return Math.round(
      teknik * 0.25 +
      taktik * 0.15 +
      fisik * 0.15 +
      mental * 0.15 +
      teamwork * 0.10 +
      health * 0.10 +
      posVal * 0.10
    );
  }

  // Tier 3 & Tier 4 (U-15 s.d. Pro): Proportional 7-Axis Average
  return Math.round((fisik + teknik + taktik + mental + teamwork + health + posVal) / 7);
}
