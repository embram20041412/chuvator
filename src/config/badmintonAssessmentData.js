// =====================================================================
// KAMUS DATA "ATHLETE DEVELOPMENT ASSESSMENT" (4-TIER LTAD BADMINTON)
// =====================================================================

export function isBadmintonSport(selectedClass, activeAcademy) {
  const isTableTennis = (str) => str.includes('meja') || str.includes('table');

  const acadStr = (activeAcademy?.sport || activeAcademy?.name || '').toLowerCase();
  const clsStr = (selectedClass?.sport || selectedClass?.name || selectedClass?.className || '').toLowerCase();

  // Jika akademi atau kelas mengindikasikan Tenis lapangan (bukan tenis meja), tolak Badminton
  if (!isTableTennis(acadStr) && (acadStr.includes('tenis') || acadStr.includes('tennis'))) {
    return false;
  }
  if (!isTableTennis(clsStr) && (clsStr.includes('tenis') || clsStr.includes('tennis'))) {
    return false;
  }

  const sportCandidate = (
    selectedClass?.sport ||
    selectedClass?.sportName ||
    selectedClass?.category ||
    activeAcademy?.sport ||
    activeAcademy?.category ||
    activeAcademy?.sportCategory ||
    ''
  ).toLowerCase();

  return ['badminton', 'bulutangkis', 'bulu tangkis'].some((s) =>
    sportCandidate.includes(s)
  );
}

// ---------------------------------------------------------------------
// 4-TIER LTAD BADMINTON CONFIGURATIONS
// ---------------------------------------------------------------------
export const BADMINTON_TIER_CONFIGS = {
  1: {
    tier: 1,
    label: 'Tier 1: Usia Dini & Pra-Usia Dini (Usia <= 10 Tahun)',
    shortLabel: 'Tier 1 — Usia Dini',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    desc: 'Pengenalan dasar motorik, koordinasi, fun-badminton, dan pengenalan atmosfer turnamen lokal.'
  },
  2: {
    tier: 2,
    label: 'Tier 2: Anak-Anak / Sirnas U-13 (Usia 11–13 Tahun)',
    shortLabel: 'Tier 2 — Anak-Anak',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    desc: 'Mulai bersaing di sirkuit regional dan nasional seperti Sirnas (Sirkuit Nasional U-13).'
  },
  3: {
    tier: 3,
    label: 'Tier 3: Pemula & Remaja / Sirnas U-15 & U-17 (Usia 14–17 Tahun)',
    shortLabel: 'Tier 3 — Pemula & Remaja',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    desc: 'Pemantapan teknik dasar, penguatan fisik intensif, dan pemantauan oleh pemandu bakat klub nasional.'
  },
  4: {
    tier: 4,
    label: 'Tier 4: Taruna & Dewasa / Sirnas U-19 & Pro (Usia >= 18 Tahun)',
    shortLabel: 'Tier 4 — Taruna & Pro',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    desc: 'Kategori junior tertinggi hingga level profesional nasional/internasional.'
  }
};

// ---------------------------------------------------------------------
// 7 JENJANG RESMI PBSI / SIRNAS
// ---------------------------------------------------------------------
export const PBSI_AGE_LEVELS = [
  {
    code: 'LEVEL_1',
    name: 'Pra-Usia Dini',
    ageRange: 'Di bawah 8 tahun (<=8 Thn)',
    tier: 1,
    focus: 'Pengenalan dasar motorik, koordinasi, dan fun-badminton.'
  },
  {
    code: 'LEVEL_2',
    name: 'Usia Dini',
    ageRange: 'Di bawah 11 tahun (9–10 Thn)',
    tier: 1,
    focus: 'Awal masuk klub resmi dan pengenalan atmosfer turnamen lokal.'
  },
  {
    code: 'LEVEL_3',
    name: 'Anak-Anak (Sirnas U-13)',
    ageRange: 'Di bawah 13/14 tahun (11–13 Thn)',
    tier: 2,
    focus: 'Mulai bersaing di sirkuit regional dan nasional seperti Sirnas (Sirkuit Nasional U-13).'
  },
  {
    code: 'LEVEL_4',
    name: 'Pemula (Sirnas U-15)',
    ageRange: 'Di bawah 15/16 tahun (14–15 Thn)',
    tier: 3,
    focus: 'Pemantapan teknik dasar dan penguatan fisik dasar secara intensif.'
  },
  {
    code: 'LEVEL_5',
    name: 'Remaja (Sirnas U-17)',
    ageRange: 'Di bawah 17/18 tahun (16–17 Thn)',
    tier: 3,
    focus: 'Mulai dipantau oleh pemandu bakat klub-klub besar nasional.'
  },
  {
    code: 'LEVEL_6',
    name: 'Taruna (Sirnas U-19)',
    ageRange: 'Di bawah 19 tahun (18 Thn)',
    tier: 4,
    focus: 'Kategori junior tertinggi. Pintu gerbang utama menuju level profesional.'
  },
  {
    code: 'LEVEL_7',
    name: 'Dewasa - Bebas / Umum',
    ageRange: 'Usia >= 19 Thn',
    tier: 4,
    focus: 'Kategori tertinggi di tingkat nasional, siap bersaing secara profesional.'
  }
];

export function detectBadmintonTierFromAge(ageInput) {
  if (ageInput === undefined || ageInput === null || ageInput === '') return 1;
  let parsed = 0;
  if (typeof ageInput === 'number') {
    parsed = ageInput;
  } else {
    const digits = String(ageInput).replace(/\D/g, '');
    parsed = parseInt(digits, 10) || 0;
  }

  if (parsed <= 0) return 1;
  if (parsed <= 10) return 1; // Pra-Usia Dini & Usia Dini (<=10)
  if (parsed >= 11 && parsed <= 13) return 2; // Anak-Anak (11-13)
  if (parsed >= 14 && parsed <= 17) return 3; // Pemula & Remaja (14-17)
  return 4; // Taruna & Dewasa (>=18)
}

export function detectPbsiLevelFromAge(ageInput) {
  if (ageInput === undefined || ageInput === null || ageInput === '') return PBSI_AGE_LEVELS[0];
  let parsed = 0;
  if (typeof ageInput === 'number') {
    parsed = ageInput;
  } else {
    const digits = String(ageInput).replace(/\D/g, '');
    parsed = parseInt(digits, 10) || 0;
  }

  if (parsed <= 8) return PBSI_AGE_LEVELS[0]; // Pra-Usia Dini
  if (parsed <= 10) return PBSI_AGE_LEVELS[1]; // Usia Dini
  if (parsed <= 13) return PBSI_AGE_LEVELS[2]; // Anak-Anak
  if (parsed <= 15) return PBSI_AGE_LEVELS[3]; // Pemula
  if (parsed <= 17) return PBSI_AGE_LEVELS[4]; // Remaja
  if (parsed === 18) return PBSI_AGE_LEVELS[5]; // Taruna
  return PBSI_AGE_LEVELS[6]; // Dewasa
}

// ---------------------------------------------------------------------
// BADMINTON MATCH EVENTS (NOMOR PERTANDINGAN)
// ---------------------------------------------------------------------
export const BADMINTON_EVENT_TYPES = [
  {
    code: 'BASIC_SINGLE',
    label: 'BASIC_SINGLE — Eksplorasi Tunggal Dasar (Pra-Usia Dini & Usia Dini)',
    shortLabel: 'Tunggal Dasar (Usia Dini)',
    isDoubles: false,
    minTier: 1,
    rolesInfo: 'Mode Eksplorasi: Pembinaan motorik, ayunan raket, dan fun-badminton.'
  },
  {
    code: 'MS',
    label: 'MS — Tunggal Putra',
    shortLabel: 'Tunggal Putra (MS)',
    isDoubles: false,
    minTier: 2,
    rolesInfo: 'Peran: Penyerang, Pengontrol, Counterattacker'
  },
  {
    code: 'WS',
    label: 'WS — Tunggal Putri',
    shortLabel: 'Tunggal Putri (WS)',
    isDoubles: false,
    minTier: 2,
    rolesInfo: 'Peran: Penyerang, Pengontrol, Counterattacker'
  },
  {
    code: 'MD',
    label: 'MD — Ganda Putra',
    shortLabel: 'Ganda Putra (MD)',
    isDoubles: true,
    minTier: 2,
    rolesInfo: 'Peran: Pemain Depan, Pemain Belakang, All-round'
  },
  {
    code: 'WD',
    label: 'WD — Ganda Putri',
    shortLabel: 'Ganda Putri (WD)',
    isDoubles: true,
    minTier: 2,
    rolesInfo: 'Peran: Pemain Depan, Pemain Belakang, All-round'
  },
  {
    code: 'XD',
    label: 'XD — Ganda Campuran',
    shortLabel: 'Ganda Campuran (XD)',
    isDoubles: true,
    minTier: 3,
    rolesInfo: 'Peran: Pemain Depan, Pemain Belakang, Rotasional'
  }
];

export function getAvailableBadmintonEventsForTier(activeTier) {
  if (activeTier === 1) {
    return BADMINTON_EVENT_TYPES.filter((e) => e.code === 'BASIC_SINGLE');
  }
  if (activeTier === 2) {
    return BADMINTON_EVENT_TYPES.filter((e) => ['MS', 'WS', 'MD', 'WD'].includes(e.code));
  }
  return BADMINTON_EVENT_TYPES.filter((e) => e.code !== 'BASIC_SINGLE');
}

export function isDoublesEvent(eventCode) {
  return ['MD', 'WD', 'XD'].includes(eventCode);
}

export function getBadmintonEventConfig(eventCode) {
  return (
    BADMINTON_EVENT_TYPES.find((e) => e.code === eventCode) ||
    BADMINTON_EVENT_TYPES[0]
  );
}

// ---------------------------------------------------------------------
// PLAYING STYLES (STY01 - STY05) & DOUBLES SPECS (SPC01 - SPC04)
// ---------------------------------------------------------------------
export const BADMINTON_PLAYING_STYLES = [
  {
    code: 'STY01',
    name: 'Penyerang',
    label: 'STY01 — Penyerang (Ofensif)',
    desc: 'Mengutamakan tekanan ofensif, smash kuat, dan penyelesaian poin cepat.'
  },
  {
    code: 'STY02',
    name: 'Pengontrol',
    label: 'STY02 — Pengontrol (Kontrol & Placement)',
    desc: 'Mengutamakan kontrol bola, keakuratan penempatan, dan mengatur tempo permainan.'
  },
  {
    code: 'STY03',
    name: 'Counterattacker',
    label: 'STY03 — Counterattacker (Defensif-Serang Balik)',
    desc: 'Menyerang balik secara efektif memanfaatkan kelalaian atau celah dari serangan lawan.'
  },
  {
    code: 'STY04',
    name: 'Variatif',
    label: 'STY04 — Variatif (Deceptive / Tipuan)',
    desc: 'Mengandalkan variasi pukulan, tipuan raket (deception), dan perubahan arah yang tak terduga.'
  },
  {
    code: 'STY05',
    name: 'All-round',
    label: 'STY05 — All-round (Seimbang)',
    desc: 'Seimbang dalam pertahanan, serangan, serta penguasaan teknik di berbagai situasi reli.'
  }
];

export function getBadmintonStyleConfig(styleCode) {
  return (
    BADMINTON_PLAYING_STYLES.find((s) => s.code === styleCode) ||
    BADMINTON_PLAYING_STYLES[0]
  );
}

export const BADMINTON_DOUBLES_SPECS = [
  {
    code: 'SPC01',
    name: 'Pemain Depan',
    label: 'SPC01 — Pemain Depan (Net & Intercept)',
    desc: 'Fokus kontrol area net, sambaran cepat, dan pemotong serangan lawan.'
  },
  {
    code: 'SPC02',
    name: 'Pemain Belakang',
    label: 'SPC02 — Pemain Belakang (Backcourt Attacker)',
    desc: 'Fokus gemburan smash beruntun dari area belakang dan penekan reli.'
  },
  {
    code: 'SPC03',
    name: 'Rotasional',
    label: 'SPC03 — Rotasional (Transisi Fleksibel)',
    desc: 'Fleksibel bertukar posisi depan-belakang secara halus saat serangan/pertahanan.'
  },
  {
    code: 'SPC04',
    name: 'All-round Ganda',
    label: 'SPC04 — All-round Ganda',
    desc: 'Mampu bermain dengan performa tinggi baik di depan maupun di belakang lapangan.'
  }
];

export function getBadmintonDoublesSpecConfig(specCode) {
  return (
    BADMINTON_DOUBLES_SPECS.find((s) => s.code === specCode) ||
    BADMINTON_DOUBLES_SPECS[0]
  );
}

export function isStyleUnlockedForTier(activeTier) {
  return activeTier >= 3; // Unlocked at Tier 3 (Pemula U-15)
}

export function isDoublesSpecUnlockedForTier(activeTier) {
  return activeTier >= 3; // Unlocked at Tier 3 (Pemula U-15)
}

// ---------------------------------------------------------------------
// CORE CATEGORIES DICTIONARY WITH minTier PROPERTIES
// ---------------------------------------------------------------------
export const BADMINTON_CORE_CATEGORIES = {
  fisik: {
    key: 'fisik',
    label: 'Fisik / Physical',
    indicators: [
      { name: 'Akselerasi', minTier: 1 },
      { name: 'Reaksi', minTier: 1 },
      { name: 'Kelincahan', minTier: 1 },
      { name: 'Gerak Lapangan', minTier: 1 },
      { name: 'Keseimbangan', minTier: 1 },
      { name: 'Deselerasi', minTier: 2 },
      { name: 'Daya Ledak Kaki', minTier: 2 },
      { name: 'Kekuatan Lunge', minTier: 2 },
      { name: 'Kontrol Pendaratan', minTier: 2 },
      { name: 'Kekuatan Inti', minTier: 3 },
      { name: 'Daya Tahan', minTier: 3 },
      { name: 'Gerak Berulang', minTier: 3 },
      { name: 'Pemulihan Antar-Reli', minTier: 3 },
      { name: 'Daya Tahan Bahu', minTier: 4 },
      { name: 'Daya Tahan Genggaman', minTier: 4 }
    ]
  },
  teknik: {
    key: 'teknik',
    label: 'Teknik / Technical',
    indicators: [
      { name: 'Pegangan Raket (Grip Versatility)', minTier: 1 },
      { name: 'Footwork Lapangan', minTier: 1 },
      { name: 'Servis Pendek', minTier: 1 },
      { name: 'Servis Panjang / Flick', minTier: 1 },
      { name: 'Lob / Clear', minTier: 1 },
      { name: 'Return Servis', minTier: 2 },
      { name: 'Net Shot (Permainan Net)', minTier: 2 },
      { name: 'Drop Shot', minTier: 2 },
      { name: 'Smash Penuh', minTier: 2 },
      { name: 'Konsistensi Pukulan', minTier: 2 },
      { name: 'Net Kill / Tangkisan Net', minTier: 3 },
      { name: 'Half-Smash / Clip Smash', minTier: 3 },
      { name: 'Drive Datar', minTier: 3 },
      { name: 'Pertahanan Blok / Lift', minTier: 3 },
      { name: 'Pukulan Backhand Overhead', minTier: 4 },
      { name: 'Deception (Teknik Tipuan Pukulan)', minTier: 4 }
    ]
  },
  taktik: {
    key: 'taktik',
    label: 'Taktik / Tactical',
    indicators: [
      { name: 'Timing Split-Step', minTier: 1 },
      { name: 'Posisi Pemulihan', minTier: 1 },
      { name: 'Cakupan Lapangan', minTier: 1 },
      { name: 'Antisipasi', minTier: 2 },
      { name: 'Pilihan Pukulan', minTier: 2 },
      { name: 'Bangun Serangan', minTier: 2 },
      { name: 'Kontrol Reli', minTier: 2 },
      { name: 'Penutupan Poin', minTier: 2 },
      { name: 'Rotasi Ganda', minTier: 2, isDoublesOnly: true },
      { name: 'Pembagian Area', minTier: 2, isDoublesOnly: true },
      { name: 'Eksploitasi Kelemahan', minTier: 3 },
      { name: 'Variasi Tempo', minTier: 3 },
      { name: 'Transisi Menyerang', minTier: 3 },
      { name: 'Transisi Bertahan', minTier: 3 },
      { name: 'Adaptasi Taktik', minTier: 3 },
      { name: 'Baca Tipuan', minTier: 4 },
      { name: 'Keputusan Tekanan', minTier: 4 },
      { name: 'Manajemen Pertandingan', minTier: 4 }
    ]
  },
  mental: {
    key: 'mental',
    label: 'Mental / Psychology',
    indicators: [
      { name: 'Fokus', minTier: 1 },
      { name: 'Percaya Diri', minTier: 1 },
      { name: 'Daya Juang', minTier: 1 },
      { name: 'Kontrol Emosi', minTier: 2 },
      { name: 'Disiplin Taktik', minTier: 2 },
      { name: 'Ketahanan Tekanan', minTier: 3 },
      { name: 'Reset Mental', minTier: 3 },
      { name: 'Konsistensi Mental', minTier: 3 }
    ]
  },
  komunikasi: {
    key: 'komunikasi',
    label: 'Komunikasi (Khusus Ganda)',
    indicators: [
      { name: 'Komunikasi Verbal', minTier: 2 },
      { name: 'Isyarat Pasangan', minTier: 2 },
      { name: 'Koordinasi Gerak', minTier: 2 },
      { name: 'Dukungan Mental', minTier: 2 },
      { name: 'Kepercayaan Pasangan', minTier: 3 },
      { name: 'Pembagian Tanggung Jawab', minTier: 3 },
      { name: 'Respons Pasangan', minTier: 3 },
      { name: 'Adaptasi Pasangan', minTier: 3 }
    ]
  },
  perkembangan: {
    key: 'perkembangan',
    label: 'Perkembangan / Development',
    indicators: [
      { name: 'Kehadiran Latihan', minTier: 1 },
      { name: 'Respons Latihan', minTier: 1 },
      { name: 'Kemajuan Teknik', minTier: 1 },
      { name: 'Kepatuhan Program', minTier: 2 },
      { name: 'Kemajuan Fisik', minTier: 2 },
      { name: 'Pencapaian Target', minTier: 3 },
      { name: 'Kesiapan Bertanding', minTier: 3 },
      { name: 'Evaluasi Mandiri', minTier: 3 }
    ]
  }
};

export function getFilteredBadmintonIndicatorsForCategory(catKey, activeTier, isDoubles) {
  const cat = BADMINTON_CORE_CATEGORIES[catKey];
  if (!cat) return [];

  if (catKey === 'komunikasi') {
    if (!isDoubles || activeTier < 2) return [];
    return cat.indicators
      .filter((ind) => ind.minTier <= activeTier)
      .map((ind) => ind.name);
  }

  return cat.indicators
    .filter((ind) => {
      if (ind.minTier > activeTier) return false;
      if (ind.isDoublesOnly && !isDoubles) return false;
      return true;
    })
    .map((ind) => ind.name);
}

// ---------------------------------------------------------------------
// EVENT SPECIFIC INDICATORS (TAB KE-7) BY TIER EVOLUTION
// ---------------------------------------------------------------------
export const BADMINTON_EVENT_INDICATORS = {
  BASIC_SINGLE: {
    code: 'BASIC_SINGLE',
    label: 'Gerak Dasar & Fun-Badminton (Usia Dini)',
    shortLabel: 'Fun-Badminton',
    indicators: [
      'Koordinasi Mata-Tangan & Ayunan Raket',
      'Kelincahan Langkah Dasar (Footwork Rhythm)',
      'Keberanian Memukul & Menjangkau Kok',
      'Pengenalan Aturan & Area Lapangan',
      'Antusiasme & Kesenangan Bermain (Fun-Badminton)'
    ]
  },
  MS: {
    code: 'MS',
    label: 'Khusus Tunggal Putra (MS)',
    shortLabel: 'Tunggal Putra',
    indicators: [
      'Dominasi Serangan',
      'Smash Penentu',
      'Kontrol Reli Panjang',
      'Cakupan Lapangan Tunggal',
      'Serangan dari Belakang',
      'Counterattack',
      'Variasi Arah',
      'Kontrol Tempo Tunggal'
    ]
  },
  WS: {
    code: 'WS',
    label: 'Khusus Tunggal Putri (WS)',
    shortLabel: 'Tunggal Putri',
    indicators: [
      'Konsistensi Reli',
      'Ketahanan Reli',
      'Akurasi Penempatan',
      'Transisi Serangan',
      'Variasi Tempo',
      'Pertahanan Tunggal',
      'Kontrol Area Belakang',
      'Efektivitas Poin'
    ]
  },
  MD: {
    code: 'MD',
    label: 'Khusus Ganda Putra (MD)',
    shortLabel: 'Ganda Putra',
    indicators: [
      'Tekanan Servis',
      'Return Menyerang',
      'Dominasi Depan',
      'Serangan Belakang',
      'Kecepatan Drive',
      'Pertahanan Ganda',
      'Rotasi Serang',
      'Transisi Formasi',
      'Tekanan Beruntun'
    ]
  },
  WD: {
    code: 'WD',
    label: 'Khusus Ganda Putri (WD)',
    shortLabel: 'Ganda Putri',
    indicators: [
      'Kontrol Depan',
      'Penempatan Serangan',
      'Pertahanan Beruntun',
      'Kontrol Reli Ganda',
      'Rotasi Pasangan',
      'Serangan Celah',
      'Konsistensi Pasangan',
      'Transisi Formasi',
      'Penguasaan Area'
    ]
  },
  XD: {
    code: 'XD',
    label: 'Khusus Ganda Campuran (XD)',
    shortLabel: 'Ganda Campuran',
    indicators: [
      'Kontrol Depan',
      'Serangan Belakang',
      'Rotasi Campuran',
      'Pembagian Area',
      'Kombinasi Serangan',
      'Pertahanan Pasangan',
      'Transisi Formasi',
      'Sinkronisasi Gerak',
      'Strategi Pasangan'
    ]
  }
};

export function getBadmintonEventSpecificConfigForTier(eventCode, activeTier) {
  if (activeTier === 1) {
    return BADMINTON_EVENT_INDICATORS.BASIC_SINGLE;
  }

  const baseConfig = BADMINTON_EVENT_INDICATORS[eventCode] || BADMINTON_EVENT_INDICATORS.MS;

  if (activeTier === 2) {
    // Tier 2: First 5 fundamental indicators
    return {
      ...baseConfig,
      indicators: baseConfig.indicators.slice(0, 5)
    };
  }

  if (activeTier === 3) {
    // Tier 3: First 6 indicators
    return {
      ...baseConfig,
      indicators: baseConfig.indicators.slice(0, 6)
    };
  }

  // Tier 4: 100% full indicators
  return baseConfig;
}
