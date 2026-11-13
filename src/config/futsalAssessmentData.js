// =====================================================================
// KAMUS DATA "ATHLETE DEVELOPMENT ASSESSMENT" (4-TIER LTAD FUTSAL)
// =====================================================================

export const FUTSAL_TIER_CONFIGS = {
  1: {
    tier: 1,
    label: 'Tier 1: Usia Dini Futsal (Usia 6–12 Tahun)',
    shortLabel: 'Tier 1 — Usia Dini',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    desc: 'Stimulasi motorik, kontrol telapak kaki (sole control), kegembiraan bermain, dan pengenalan ruang lapangan kecil.'
  },
  2: {
    tier: 2,
    label: 'Tier 2: Youth Futsal (Usia 13–15 Tahun)',
    shortLabel: 'Tier 2 — Youth',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    desc: 'Pengenalan 4 posisi dasar (Kiper, Fixo, Ala, Pivot), teknik cepat, dan dasar rotasi.'
  },
  3: {
    tier: 3,
    label: 'Tier 3: Junior Futsal (Usia 16–19 Tahun)',
    shortLabel: 'Tier 3 — Junior',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    desc: 'Pematangan peran spesifik & Universal, profil gaya bermain (STY01–STY14), transisi cepat, dan kompetisi Junior/U-19.'
  },
  4: {
    tier: 4,
    label: 'Tier 4: Fase Profesional (Usia > 19 Tahun / >= 20 Tahun)',
    shortLabel: 'Tier 4 — Profesional',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    desc: 'Standar performa tinggi, taktik kompleks (Power Play & Counter-Pressing), dan kesiapan kompetisi profesional.'
  }
};

export function detectFutsalTierFromAge(ageInput) {
  if (ageInput === undefined || ageInput === null || ageInput === '') return 1;
  let parsed = 0;
  if (typeof ageInput === 'number') {
    parsed = ageInput;
  } else {
    const digits = String(ageInput).replace(/\D/g, '');
    parsed = parseInt(digits, 10) || 0;
  }

  if (parsed <= 0) return 1;
  if (parsed <= 12) return 1; // Usia Dini (6-12 Thn)
  if (parsed >= 13 && parsed <= 15) return 2; // Youth (13-15 Thn)
  if (parsed >= 16 && parsed <= 19) return 3; // Junior (16-19 Thn)
  return 4; // Fase Profesional (> 19 / >= 20 Thn)
}

export const FUTSAL_POSITIONS = [
  {
    code: 'GK',
    label: 'GK — Goalkeeper / Kiper',
    shortLabel: 'Kiper (GK)',
    indicators: [
      'Refleks', 'Posisi Kiper', 'Tangkapan', 'Menepis Bola', 'Duel 1 on 1',
      'Blok Kaki', 'Distribusi Tangan', 'Distribusi Kaki', 'Antisipasi', 'Komunikasi Kiper',
      'Power Play', 'Keputusan Keluar'
    ]
  },
  {
    code: 'FIXO',
    label: 'FIXO — Fixo / Anchor',
    shortLabel: 'Fixo / Anchor',
    indicators: [
      'Posisi Bertahan', 'Interception', 'Timing Tekel', 'Duel Bertahan', 'Cover Rekan',
      'Blok Tembakan', 'Membaca Serangan', 'Distribusi Bola', 'Build-up', 'Umpan Progresif',
      'Kontrol Tempo', 'Transisi Bertahan'
    ]
  },
  {
    code: 'ALA',
    label: 'ALA — Ala / Flank',
    shortLabel: 'Ala / Flank',
    indicators: [
      'Dribbling Sayap', 'Akselerasi Sayap', 'Passing Cepat', 'Kombinasi Serangan', 'Cut Inside',
      'Tembakan Sayap', 'Gerak Tanpa Bola', 'Pressing Sayap', 'Tracking Back', 'Rotasi Posisi',
      'Transisi Cepat', 'Duel Satu Lawan Satu'
    ]
  },
  {
    code: 'PIVOT',
    label: 'PIVOT — Pivot',
    shortLabel: 'Pivot',
    indicators: [
      'Proteksi Bola', 'Hold-up Play', 'Kontrol Membelakangi', 'Finishing', 'Tembakan Cepat',
      'Putaran Pivot', 'Link-up Play', 'Umpan Pantul', 'Posisi Serang', 'Duel Fisik',
      'Pressing Depan', 'Keputusan Akhir'
    ]
  },
  {
    code: 'UNIVERSAL',
    label: 'UNIVERSAL — Universal',
    shortLabel: 'Universal',
    indicators: [
      'Fleksibilitas Posisi', 'Adaptasi Peran', 'Teknik Menyeluruh', 'Pemahaman Taktik', 'Transisi Peran',
      'Keputusan Situasional', 'Koordinasi Tim', 'Konsistensi Lintas Posisi', 'Adaptasi Formasi', 'Fleksibilitas Bertahan'
    ]
  }
];

export const FUTSAL_TIER_1_POSITIONS = [
  {
    code: 'COURT_DASAR',
    label: 'Eksplorasi Pemain Lapangan (Rotasi Court Player)',
    shortLabel: 'Eksplorasi Court Player',
    indicators: [
      'Pengenalan Telapak Kaki (Sole Feeling)',
      'Kelincahan Ruang Sempit',
      'Keberanian Duel 1v1',
      'Semangat Rotasi Bermain',
      'Kesenangan Bermain'
    ]
  },
  {
    code: 'GK_DASAR',
    label: 'Pengenalan Penjaga Gawang (GK Dasar)',
    shortLabel: 'Pengenalan Kiper',
    indicators: [
      'Keberanian Menangkap & Memblok Bola',
      'Refleks Tangan-Kaki Dasar',
      'Lemparan Distribusi Dasar',
      'Keberanian Suara/Komunikasi',
      'Kesenangan Bermain'
    ]
  }
];

export const FUTSAL_TIER_2_POSITIONS = [
  { code: 'GK', label: 'GK — Kiper Dasar', shortLabel: 'Kiper (GK)' },
  { code: 'FIXO', label: 'FIXO — Fixo / Anchor Dasar', shortLabel: 'Fixo / Anchor' },
  { code: 'ALA', label: 'ALA — Ala / Flank Dasar', shortLabel: 'Ala / Flank' },
  { code: 'PIVOT', label: 'PIVOT — Pivot Dasar', shortLabel: 'Pivot' }
];

export const FUTSAL_PLAYING_STYLES = [
  { code: 'STY01', name: 'Defensive Fixo', desc: 'Fokus menjaga pertahanan' },
  { code: 'STY02', name: 'Playmaker Fixo', desc: 'Mengatur serangan dari belakang' },
  { code: 'STY03', name: 'Pressing Fixo', desc: 'Agresif merebut bola' },
  { code: 'STY04', name: 'Winger Ala', desc: 'Menyerang melalui sisi' },
  { code: 'STY05', name: 'Inverted Ala', desc: 'Bergerak dari sisi ke tengah' },
  { code: 'STY06', name: 'Two-way Ala', desc: 'Aktif menyerang dan bertahan' },
  { code: 'STY07', name: 'Target Pivot', desc: 'Menjadi tumpuan serangan' },
  { code: 'STY08', name: 'Mobile Pivot', desc: 'Aktif bergerak mencari ruang' },
  { code: 'STY09', name: 'Finisher Pivot', desc: 'Fokus penyelesaian peluang' },
  { code: 'STY10', name: 'Link-up Pivot', desc: 'Menghubungkan permainan' },
  { code: 'STY11', name: 'Shot-stopper', desc: 'Fokus menghentikan tembakan' },
  { code: 'STY12', name: 'Sweeper-keeper', desc: 'Aktif membantu pertahanan di luar gawang' },
  { code: 'STY13', name: 'Hybrid Player', desc: 'Mampu menjalankan beberapa peran' },
  { code: 'STY14', name: 'Flying Goalkeeper', desc: 'Kiper yang maju sebagai pemain tambahan' }
];

// KAMUS 6 KATEGORI UTAMA FUTSAL DENGAN minTier
export const FUTSAL_CORE_CATEGORIES = {
  fisik: {
    key: 'fisik',
    title: 'Physical / Fisik',
    shortTitle: 'Fisik',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    indicators: [
      { name: 'Akselerasi', minTier: 1 },
      { name: 'Kelincahan', minTier: 1 },
      { name: 'Reaksi', minTier: 1 },
      { name: 'Keseimbangan', minTier: 1 },
      { name: 'Kecepatan Sprint', minTier: 2 },
      { name: 'Daya Tahan', minTier: 2 },
      { name: 'Daya Ledak', minTier: 3 },
      { name: 'Kekuatan Inti', minTier: 3 },
      { name: 'Kekuatan Tubuh', minTier: 4 }
    ]
  },
  teknik: {
    key: 'teknik',
    title: 'Technical / Teknik',
    shortTitle: 'Teknik',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    indicators: [
      { name: 'Kontrol Bola', minTier: 1 },
      { name: 'Sentuhan Pertama', minTier: 1 },
      { name: 'Passing Pendek', minTier: 1 },
      { name: 'Dribbling', minTier: 1 },
      { name: 'Sole Control', minTier: 1 },
      { name: 'Passing Cepat', minTier: 2 },
      { name: 'Finishing', minTier: 2 },
      { name: 'Passing dengan Sole', minTier: 2 },
      { name: 'Tackling', minTier: 2 },
      { name: 'Interception', minTier: 2 },
      { name: 'Kaki Lemah', minTier: 2 },
      { name: 'Umpan Terobosan', minTier: 3 },
      { name: 'Proteksi Bola', minTier: 3 },
      { name: 'Kekuatan Tembakan', minTier: 3 },
      { name: 'Feint', minTier: 3 },
      { name: 'Blocking', minTier: 3 },
      { name: 'Tembakan Jarak Jauh', minTier: 4 },
      { name: 'First-time Shot', minTier: 4 },
      { name: 'Kontrol Ruang Sempit', minTier: 4 },
      { name: 'Bola Mati', minTier: 4 }
    ]
  },
  taktik: {
    key: 'taktik',
    title: 'Tactical / Taktik',
    shortTitle: 'Taktik',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    indicators: [
      { name: 'Posisi Menyerang', minTier: 1 },
      { name: 'Posisi Bertahan', minTier: 1 },
      { name: 'Membuka Ruang', minTier: 1 },
      { name: 'Membaca Permainan', minTier: 2 },
      { name: 'Keputusan Bermain', minTier: 2 },
      { name: 'Gerak Tanpa Bola', minTier: 2 },
      { name: 'Cover Rekan', minTier: 2 },
      { name: 'Menutup Jalur', minTier: 2 },
      { name: 'Rotasi Posisi', minTier: 3 },
      { name: 'Transisi Menyerang', minTier: 3 },
      { name: 'Transisi Bertahan', minTier: 3 },
      { name: 'Pressing', minTier: 3 },
      { name: 'Sirkulasi Bola', minTier: 3 },
      { name: 'Serangan Balik', minTier: 3 },
      { name: 'Counter-Pressing', minTier: 4 },
      { name: 'Progresi Bola', minTier: 4 },
      { name: 'Kombinasi Serangan', minTier: 4 },
      { name: 'Pertahanan Kompak', minTier: 4 },
      { name: 'Power Play', minTier: 4 },
      { name: 'Adaptasi Taktik', minTier: 4 }
    ]
  },
  mental: {
    key: 'mental',
    title: 'Mental',
    shortTitle: 'Mental',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    indicators: [
      { name: 'Fokus', minTier: 1 },
      { name: 'Percaya Diri', minTier: 1 },
      { name: 'Disiplin', minTier: 1 },
      { name: 'Orientasi Tim', minTier: 1 },
      { name: 'Kontrol Emosi', minTier: 2 },
      { name: 'Daya Juang', minTier: 2 },
      { name: 'Respons Kesalahan', minTier: 3 },
      { name: 'Tahan Tekanan', minTier: 3 },
      { name: 'Konsistensi Mental', minTier: 3 },
      { name: 'Keberanian Duel', minTier: 3 }
    ]
  },
  perkembangan: {
    key: 'perkembangan',
    title: 'Development / Perkembangan',
    shortTitle: 'Perkembangan',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    indicators: [
      { name: 'Kehadiran Latihan', minTier: 1 },
      { name: 'Respons Latihan', minTier: 1 },
      { name: 'Progres Teknik', minTier: 1 },
      { name: 'Kepatuhan Program', minTier: 2 },
      { name: 'Progres Fisik', minTier: 2 },
      { name: 'Progres Taktik', minTier: 3 },
      { name: 'Pencapaian Target', minTier: 3 },
      { name: 'Kesiapan Bertanding', minTier: 3 },
      { name: 'Evaluasi Mandiri', minTier: 3 },
      { name: 'Konsistensi Performa', minTier: 3 }
    ]
  },
  komunikasi: {
    key: 'komunikasi',
    title: 'Communication / Komunikasi',
    shortTitle: 'Komunikasi',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    indicators: [
      { name: 'Komunikasi Verbal', minTier: 1 },
      { name: 'Dukungan Rekan', minTier: 1 },
      { name: 'Respons Instruksi', minTier: 1 },
      { name: 'Isyarat Nonverbal', minTier: 2 },
      { name: 'Koordinasi Rotasi', minTier: 3 },
      { name: 'Kepemimpinan', minTier: 3 },
      { name: 'Koordinasi Pressing', minTier: 3 },
      { name: 'Koordinasi Bertahan', minTier: 3 }
    ]
  }
};

/**
 * Filter indicator names for a Futsal core category based on activeTier
 */
export function getFilteredFutsalIndicatorsForCategory(categoryKey, activeTier) {
  const cat = FUTSAL_CORE_CATEGORIES[categoryKey];
  if (!cat) return [];
  return cat.indicators
    .filter((ind) => ind.minTier <= activeTier)
    .map((ind) => ind.name);
}

/**
 * Get available Futsal positions list depending on activeTier
 */
export function getAvailableFutsalPositionsForTier(activeTier) {
  if (activeTier === 1) return FUTSAL_TIER_1_POSITIONS;
  if (activeTier === 2) return FUTSAL_TIER_2_POSITIONS;
  return FUTSAL_POSITIONS;
}

/**
 * Get Futsal position indicators depending on activeTier
 */
export function getFutsalPositionIndicatorsForTier(code, activeTier) {
  if (activeTier === 1) {
    const t1 = FUTSAL_TIER_1_POSITIONS.find((p) => p.code === code) || FUTSAL_TIER_1_POSITIONS[0];
    return {
      code: t1.code,
      label: t1.label,
      shortLabel: t1.shortLabel,
      tabTitle: 'Gerak Dasar & Eksplorasi Futsal (5)',
      indicators: t1.indicators
    };
  }

  const posCfg = getFutsalPositionConfig(code);
  let sliced = posCfg.indicators;

  if (activeTier === 2) {
    sliced = posCfg.indicators.slice(0, 6);
  } else if (activeTier === 3) {
    sliced = posCfg.code === 'UNIVERSAL' ? posCfg.indicators.slice(0, 8) : posCfg.indicators.slice(0, 9);
  }

  return {
    code: posCfg.code,
    label: posCfg.label,
    shortLabel: posCfg.shortLabel,
    tabTitle: `Khusus [${posCfg.shortLabel}] (${sliced.length})`,
    indicators: sliced
  };
}

/**
 * Checks if a class or academy sport corresponds specifically to Futsal
 */
export function isFutsalSport(selectedClass, activeAcademy) {
  const sportName = (selectedClass?.sport || activeAcademy?.sport || selectedClass?.sportCategory || activeAcademy?.category || '').toLowerCase();
  return sportName.includes('futsal');
}

/**
 * Get Futsal position config by code
 */
export function getFutsalPositionConfig(code) {
  return FUTSAL_POSITIONS.find((p) => p.code === code) || FUTSAL_POSITIONS[1]; // Default FIXO
}

/**
 * Get Futsal playing style config by code
 */
export function getFutsalStyleConfig(code) {
  return FUTSAL_PLAYING_STYLES.find((s) => s.code === code) || FUTSAL_PLAYING_STYLES[0];
}
