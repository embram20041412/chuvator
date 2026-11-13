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
    const digits = String(ageInput).replace(/\D/g, '');
    parsed = parseInt(digits, 10) || 0;
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
    indicators: ['Refleks', 'Distribusi Kaki']
  },
  {
    code: 'CB',
    label: 'CB — Bek Tengah (CB)',
    shortLabel: 'Bek Tengah (CB)',
    specializations: ['Stopper', 'Ball-playing defender'],
    indicators: ['Duel Bertahan', 'Posisi Bertahan', 'Kontrol Bola']
  },
  {
    code: 'LB/RB',
    label: 'LB/RB — Bek Sayap (LB/RB)',
    shortLabel: 'Bek Sayap (LB/RB)',
    specializations: ['Defensive fullback', 'Attacking fullback'],
    indicators: ['Overlap', 'Kelincahan', 'Passing Pendek']
  },
  {
    code: 'WB',
    label: 'WB — Wingback',
    shortLabel: 'Wingback (WB)',
    specializations: ['Wide runner', 'Attacking wingback'],
    indicators: ['Overlap', 'Akselerasi', 'Dribbling']
  },
  {
    code: 'DM',
    label: 'DM — Gelandang Bertahan (DM)',
    shortLabel: 'Gelandang Bertahan (DM)',
    specializations: ['Ball-winner', 'Deep-lying playmaker'],
    indicators: ['Distribusi Bola', 'Posisi Bertahan', 'Passing Pendek']
  },
  {
    code: 'CM',
    label: 'CM — Gelandang Tengah (CM)',
    shortLabel: 'Gelandang Tengah (CM)',
    specializations: ['Box-to-box', 'Playmaker'],
    indicators: ['Distribusi Bola', 'Passing Pendek', 'Sentuhan Pertama']
  },
  {
    code: 'AM',
    label: 'AM — Gelandang Serang (AM)',
    shortLabel: 'Gelandang Serang (AM)',
    specializations: ['Creator', 'Advanced playmaker'],
    indicators: ['Distribusi Bola', 'Membuka Ruang', 'Finishing']
  },
  {
    code: 'LM/RM',
    label: 'LM/RM — Gelandang Sayap (LM/RM)',
    shortLabel: 'Gelandang Sayap (LM/RM)',
    specializations: ['Wide creator', 'Tracking winger'],
    indicators: ['Cut Inside', 'Dribbling', 'Passing Pendek']
  },
  {
    code: 'WFR/WFL',
    label: 'WFR/WFL — Sayap / Winger (WFR/WFL)',
    shortLabel: 'Winger / Sayap (WFR/WFL)',
    specializations: ['Inverted winger', 'Touchline winger'],
    indicators: ['Cut Inside', 'Dribbling', 'Akselerasi']
  },
  {
    code: 'SS',
    label: 'SS — Second Striker / Penyerang Kedua (SS)',
    shortLabel: 'Second Striker (SS)',
    specializations: ['Link-up forward', 'Shadow striker'],
    indicators: ['Gerak di Kotak Penalti', 'Finishing', 'Membuka Ruang']
  },
  {
    code: 'ST',
    label: 'ST — Striker (ST)',
    shortLabel: 'Striker (ST)',
    specializations: ['Target man', 'Poacher', 'Pressing forward'],
    indicators: ['Gerak di Kotak Penalti', 'Finishing', 'Posisi Menyerang']
  }
];

export const TIER_1_POSITIONS = [
  {
    code: 'OUTFIELD_SSB',
    label: 'Eksplorasi Pemain Lapangan (Rotasi Multi-Posisi)',
    shortLabel: 'Eksplorasi Pemain Lapangan',
    indicators: ['Distribusi Bola', 'Kontrol Bola', 'Dribbling']
  },
  {
    code: 'GK_SSB',
    label: 'Pengenalan Penjaga Gawang (GK Dasar)',
    shortLabel: 'Pengenalan Kiper',
    indicators: ['Refleks', 'Distribusi Kaki']
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

// KAMUS 6 KATEGORI DENGAN minTier (1 s.d. 4) & snake_case indicator_key 100% SELARAS DENGAN MASTER TEST LIBRARY
export const FOOTBALL_CORE_CATEGORIES = {
  fisik: {
    key: 'fisik',
    title: 'Physical / Fisik',
    shortTitle: 'Fisik',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    indicators: [
      { key: 'akselerasi', name: 'Akselerasi', minTier: 1 },
      { key: 'kelincahan', name: 'Kelincahan', minTier: 1 },
      { key: 'keseimbangan', name: 'Keseimbangan', minTier: 1 },
      { key: 'kecepatan_maksimal', name: 'Kecepatan Maksimal', minTier: 2 },
      { key: 'perubahan_arah', name: 'Perubahan Arah', minTier: 2 },
      { key: 'reaksi', name: 'Reaksi', minTier: 2 },
      { key: 'lompatan', name: 'Lompatan', minTier: 2 },
      { key: 'daya_tahan', name: 'Daya Tahan', minTier: 3 },
      { key: 'daya_ledak', name: 'Daya Ledak', minTier: 3 },
      { key: 'kekuatan_tubuh', name: 'Kekuatan Tubuh', minTier: 3 },
      { key: 'pemulihan', name: 'Pemulihan', minTier: 4 }
    ]
  },
  teknik: {
    key: 'teknik',
    title: 'Technical / Teknik',
    shortTitle: 'Teknik',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    indicators: [
      { key: 'kontrol_bola', name: 'Kontrol Bola', minTier: 1 },
      { key: 'sentuhan_pertama', name: 'Sentuhan Pertama', minTier: 1 },
      { key: 'passing_pendek', name: 'Passing Pendek', minTier: 1 },
      { key: 'dribbling', name: 'Dribbling', minTier: 1 },
      { key: 'finishing', name: 'Finishing', minTier: 1 },
      { key: 'passing_jauh', name: 'Passing Jauh', minTier: 2 },
      { key: 'tackling', name: 'Tackling', minTier: 2 },
      { key: 'kaki_lemah', name: 'Kaki Lemah', minTier: 2 },
      { key: 'crossing', name: 'Crossing', minTier: 3 },
      { key: 'heading', name: 'Heading', minTier: 3 }
    ]
  },
  taktik: {
    key: 'taktik',
    title: 'Tactical / Taktik',
    shortTitle: 'Taktik',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    indicators: [
      { key: 'posisi_bertahan', name: 'Posisi Bertahan', minTier: 1 },
      { key: 'posisi_menyerang', name: 'Posisi Menyerang', minTier: 1 },
      { key: 'membuka_ruang', name: 'Membuka Ruang', minTier: 1 },
      { key: 'membaca_permainan', name: 'Membaca Permainan', minTier: 2 },
      { key: 'pengambilan_keputusan', name: 'Pengambilan Keputusan', minTier: 2 },
      { key: 'pressing', name: 'Pressing', minTier: 3 },
      { key: 'transisi_menyerang', name: 'Transisi Menyerang', minTier: 3 }
    ]
  },
  mental: {
    key: 'mental',
    title: 'Mental',
    shortTitle: 'Mental',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    indicators: [
      { key: 'fokus', name: 'Fokus', minTier: 1 },
      { key: 'percaya_diri', name: 'Percaya Diri', minTier: 1 },
      { key: 'daya_juang', name: 'Daya Juang', minTier: 2 },
      { key: 'tahan_tekanan', name: 'Tahan Tekanan', minTier: 3 }
    ]
  },
  komunikasi: {
    key: 'komunikasi',
    title: 'Communication / Komunikasi',
    shortTitle: 'Komunikasi',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    indicators: [
      { key: 'komunikasi_verbal', name: 'Komunikasi Verbal', minTier: 1 },
      { key: 'dukungan_rekan', name: 'Dukungan Rekan', minTier: 1 },
      { key: 'kepemimpinan', name: 'Kepemimpinan', minTier: 3 }
    ]
  },
  perkembangan: {
    key: 'perkembangan',
    title: 'Development / Perkembangan',
    shortTitle: 'Perkembangan',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    indicators: [
      { key: 'kehadiran_latihan', name: 'Kehadiran Latihan', minTier: 1 },
      { key: 'kepatuhan_program', name: 'Kepatuhan Program', minTier: 1 },
      { key: 'konsistensi_kehadiran', name: 'Konsistensi Kehadiran', minTier: 1 }
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
    .filter((ind) => ind.minTier <= activeTier)
    .map((ind) => ind.name);
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
      tabTitle: `Gerak Dasar & Posisi (${ssbPos.indicators.length})`,
      indicators: ssbPos.indicators
    };
  }

  const posCfg = getPositionConfig(code);
  const sliced = posCfg.indicators;

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
