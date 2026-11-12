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
    const ageStr = String(ageInput);
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

  if (parsed > 100) {
    const currentYear = new Date().getFullYear();
    if (parsed >= 1900 && parsed <= currentYear) {
      parsed = currentYear - parsed;
    } else {
      parsed = 10;
    }
  }

  if (parsed <= 0) return 1;
  if (parsed <= 10) return 1; // Pra-Usia Dini & Usia Dini (<=10)
  if (parsed >= 11 && parsed <= 13) return 2; // Anak-Anak (11-13)
  if (parsed >= 14 && parsed <= 17) return 3; // Pemula & Remaja (14-17)
  return 4; // Taruna & Dewasa (>=18)
}

export function detectPbsiLevelFromAge(ageInput) {
  const parsed = detectBadmintonTierFromAge(ageInput);
  // Re-detect actual age for finer pbsi level
  let age = 10;
  if (typeof ageInput === 'number') age = ageInput;
  else if (String(ageInput).includes('-') || String(ageInput).includes('/')) {
     const birthDate = new Date(ageInput);
     if (!isNaN(birthDate.getTime())) {
       const today = new Date();
       age = today.getFullYear() - birthDate.getFullYear();
       const m = today.getMonth() - birthDate.getMonth();
       if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
     }
  } else {
     age = parseInt(String(ageInput).replace(/\D/g, ''), 10) || 10;
  }
  
  if (age > 100) {
    const cy = new Date().getFullYear();
    if (age >= 1900 && age <= cy) age = cy - age;
    else age = 10;
  }

  if (age <= 8) return PBSI_AGE_LEVELS[0]; // Pra-Usia Dini
  if (age <= 10) return PBSI_AGE_LEVELS[1]; // Usia Dini
  if (age <= 13) return PBSI_AGE_LEVELS[2]; // Anak-Anak
  if (age <= 15) return PBSI_AGE_LEVELS[3]; // Pemula
  if (age <= 17) return PBSI_AGE_LEVELS[4]; // Remaja
  if (age === 18) return PBSI_AGE_LEVELS[5]; // Taruna
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
      { id: 'BDM-UNI-PHY-01', name: 'Akselerasi', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Akselerasi'] },
      { id: 'BDM-UNI-PHY-02', name: 'Reaksi', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Reaksi'] },
      { id: 'BDM-UNI-PHY-03', name: 'Kelincahan', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Kelincahan'] },
      { id: 'BDM-UNI-PHY-04', name: 'Gerak Lapangan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak Lapangan'] },
      { id: 'BDM-UNI-PHY-05', name: 'Keseimbangan', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Keseimbangan'] },
      { id: 'BDM-UNI-PHY-06', name: 'Deselerasi', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Deselerasi'] },
      { id: 'BDM-UNI-PHY-07', name: 'Daya Ledak Kaki', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Daya Ledak Kaki'] },
      { id: 'BDM-UNI-PHY-08', name: 'Kekuatan Lunge', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kekuatan Lunge'] },
      { id: 'BDM-UNI-PHY-09', name: 'Kontrol Pendaratan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Pendaratan'] },
      { id: 'BDM-UNI-PHY-10', name: 'Kekuatan Inti', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Kekuatan Inti'] },
      { id: 'BDM-UNI-PHY-11', name: 'Daya Tahan', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Daya Tahan'] },
      { id: 'BDM-UNI-PHY-12', name: 'Gerak Berulang', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Gerak Berulang'] },
      { id: 'BDM-UNI-PHY-13', name: 'Pemulihan Antar-Reli', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pemulihan Antar-Reli'] },
      { id: 'BDM-UNI-PHY-14', name: 'Daya Tahan Bahu', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Daya Tahan Bahu'] },
      { id: 'BDM-UNI-PHY-15', name: 'Daya Tahan Genggaman', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Daya Tahan Genggaman'] }
    ]
  },
  teknik: {
    key: 'teknik',
    label: 'Teknik / Technical',
    indicators: [
      { id: 'BDM-UNI-TEC-01', name: 'Pegangan Raket (Grip Versatility)', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pegangan Raket (Grip Versatility)'] },
      { id: 'BDM-UNI-TEC-02', name: 'Footwork Lapangan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Footwork Lapangan'] },
      { id: 'BDM-UNI-TEC-03', name: 'Servis Pendek', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Servis Pendek'] },
      { id: 'BDM-UNI-TEC-04', name: 'Servis Panjang / Flick', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Servis Panjang / Flick'] },
      { id: 'BDM-UNI-TEC-05', name: 'Lob / Clear', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Lob / Clear'] },
      { id: 'BDM-UNI-TEC-06', name: 'Return Servis', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Return Servis'] },
      { id: 'BDM-UNI-TEC-07', name: 'Net Shot (Permainan Net)', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Net Shot (Permainan Net)'] },
      { id: 'BDM-UNI-TEC-08', name: 'Drop Shot', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Drop Shot'] },
      { id: 'BDM-UNI-TEC-09', name: 'Smash Penuh', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Smash Penuh'] },
      { id: 'BDM-UNI-TEC-10', name: 'Konsistensi Pukulan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Konsistensi Pukulan'] },
      { id: 'BDM-UNI-TEC-11', name: 'Net Kill / Tangkisan Net', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Net Kill / Tangkisan Net'] },
      { id: 'BDM-UNI-TEC-12', name: 'Half-Smash / Clip Smash', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Half-Smash / Clip Smash'] },
      { id: 'BDM-UNI-TEC-13', name: 'Drive Datar', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Drive Datar'] },
      { id: 'BDM-UNI-TEC-14', name: 'Pertahanan Blok / Lift', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pertahanan Blok / Lift'] },
      { id: 'BDM-UNI-TEC-15', name: 'Pukulan Backhand Overhead', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pukulan Backhand Overhead'] },
      { id: 'BDM-UNI-TEC-16', name: 'Deception (Teknik Tipuan Pukulan)', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Deception (Teknik Tipuan Pukulan)'] }
    ]
  },
  taktik: {
    key: 'taktik',
    label: 'Taktik / Tactical',
    indicators: [
      { id: 'BDM-UNI-TAC-01', name: 'Timing Split-Step', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Timing Split-Step'] },
      { id: 'BDM-UNI-TAC-02', name: 'Posisi Pemulihan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Pemulihan'] },
      { id: 'BDM-UNI-TAC-03', name: 'Cakupan Lapangan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cakupan Lapangan'] },
      { id: 'BDM-UNI-TAC-04', name: 'Antisipasi', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Antisipasi'] },
      { id: 'BDM-UNI-TAC-05', name: 'Pilihan Pukulan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pilihan Pukulan'] },
      { id: 'BDM-UNI-TAC-06', name: 'Bangun Serangan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Bangun Serangan'] },
      { id: 'BDM-UNI-TAC-07', name: 'Kontrol Reli', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Reli'] },
      { id: 'BDM-UNI-TAC-08', name: 'Penutupan Poin', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Penutupan Poin'] },
      { id: 'BDM-UNI-TAC-09', name: 'Rotasi Ganda', minTier: 2, type: 'OBSERVATION_RUBRIC', isDoublesOnly: true, legacy_keys: ['Rotasi Ganda'] },
      { id: 'BDM-UNI-TAC-10', name: 'Pembagian Area', minTier: 2, type: 'OBSERVATION_RUBRIC', isDoublesOnly: true, legacy_keys: ['Pembagian Area'] },
      { id: 'BDM-UNI-TAC-11', name: 'Eksploitasi Kelemahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Eksploitasi Kelemahan'] },
      { id: 'BDM-UNI-TAC-12', name: 'Variasi Tempo', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Variasi Tempo'] },
      { id: 'BDM-UNI-TAC-13', name: 'Transisi Menyerang', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Menyerang'] },
      { id: 'BDM-UNI-TAC-14', name: 'Transisi Bertahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Bertahan'] },
      { id: 'BDM-UNI-TAC-15', name: 'Adaptasi Taktik', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Adaptasi Taktik'] },
      { id: 'BDM-UNI-TAC-16', name: 'Baca Tipuan', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Baca Tipuan'] },
      { id: 'BDM-UNI-TAC-17', name: 'Keputusan Tekanan', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Tekanan'] },
      { id: 'BDM-UNI-TAC-18', name: 'Manajemen Pertandingan', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Manajemen Pertandingan'] }
    ]
  },
  mental: {
    key: 'mental',
    label: 'Mental / Psychology',
    indicators: [
      { id: 'BDM-UNI-MEN-01', name: 'Fokus', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Fokus'] },
      { id: 'BDM-UNI-MEN-02', name: 'Percaya Diri', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Percaya Diri'] },
      { id: 'BDM-UNI-MEN-03', name: 'Daya Juang', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Daya Juang'] },
      { id: 'BDM-UNI-MEN-04', name: 'Kontrol Emosi', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Emosi'] },
      { id: 'BDM-UNI-MEN-05', name: 'Disiplin Taktik', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Disiplin Taktik'] },
      { id: 'BDM-UNI-MEN-06', name: 'Ketahanan Tekanan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Ketahanan Tekanan'] },
      { id: 'BDM-UNI-MEN-07', name: 'Reset Mental', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Reset Mental'] },
      { id: 'BDM-UNI-MEN-08', name: 'Konsistensi Mental', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Konsistensi Mental'] }
    ]
  },
  komunikasi: {
    key: 'komunikasi',
    label: 'Komunikasi (Khusus Ganda)',
    indicators: [
      { id: 'BDM-UNI-COM-01', name: 'Komunikasi Verbal', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Komunikasi Verbal'] },
      { id: 'BDM-UNI-COM-02', name: 'Isyarat Pasangan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Isyarat Pasangan'] },
      { id: 'BDM-UNI-COM-03', name: 'Koordinasi Gerak', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Gerak'] },
      { id: 'BDM-UNI-COM-04', name: 'Dukungan Mental', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dukungan Mental'] },
      { id: 'BDM-UNI-COM-05', name: 'Kepercayaan Pasangan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kepercayaan Pasangan'] },
      { id: 'BDM-UNI-COM-06', name: 'Pembagian Tanggung Jawab', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pembagian Tanggung Jawab'] },
      { id: 'BDM-UNI-COM-07', name: 'Respons Pasangan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Pasangan'] },
      { id: 'BDM-UNI-COM-08', name: 'Adaptasi Pasangan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Adaptasi Pasangan'] }
    ]
  },
  perkembangan: {
    key: 'perkembangan',
    label: 'Perkembangan / Development',
    indicators: [
      { id: 'BDM-UNI-DEV-01', name: 'Kehadiran Latihan', minTier: 1, type: 'ADMINISTRATIVE_DATA', legacy_keys: ['Kehadiran Latihan'] },
      { id: 'BDM-UNI-DEV-02', name: 'Respons Latihan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Latihan'] },
      { id: 'BDM-UNI-DEV-03', name: 'Kemajuan Teknik', minTier: 1, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Kemajuan Teknik'] },
      { id: 'BDM-UNI-DEV-04', name: 'Kepatuhan Program', minTier: 2, type: 'ADMINISTRATIVE_DATA', legacy_keys: ['Kepatuhan Program'] },
      { id: 'BDM-UNI-DEV-05', name: 'Kemajuan Fisik', minTier: 2, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Kemajuan Fisik'] },
      { id: 'BDM-UNI-DEV-06', name: 'Pencapaian Target', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Pencapaian Target'] },
      { id: 'BDM-UNI-DEV-07', name: 'Kesiapan Bertanding', minTier: 3, type: 'READINESS_CONTEXT', legacy_keys: ['Kesiapan Bertanding'] },
      { id: 'BDM-UNI-DEV-08', name: 'Evaluasi Mandiri', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Evaluasi Mandiri'] }
    ]
  }
};

export function getFilteredBadmintonIndicatorsForCategory(catKey, activeTier, isDoubles) {
  const cat = BADMINTON_CORE_CATEGORIES[catKey];
  if (!cat) return [];

  if (catKey === 'komunikasi') {
    if (!isDoubles || activeTier < 2) return [];
    return cat.indicators
      .filter((ind) => ind.minTier <= activeTier);
  }

  return cat.indicators
    .filter((ind) => {
      if (ind.minTier > activeTier) return false;
      if (ind.isDoublesOnly && !isDoubles) return false;
      return true;
    });
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
      { id: 'BDM-EVT-BAS-01', name: 'Koordinasi Mata-Tangan & Ayunan Raket', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Mata-Tangan & Ayunan Raket'] },
      { id: 'BDM-EVT-BAS-02', name: 'Kelincahan Langkah Dasar (Footwork Rhythm)', type: 'OBJECTIVE_TEST', legacy_keys: ['Kelincahan Langkah Dasar (Footwork Rhythm)'] },
      { id: 'BDM-EVT-BAS-03', name: 'Keberanian Memukul & Menjangkau Kok', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Memukul & Menjangkau Kok'] },
      { id: 'BDM-EVT-BAS-04', name: 'Pengenalan Aturan & Area Lapangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pengenalan Aturan & Area Lapangan'] },
      { id: 'BDM-EVT-BAS-05', name: 'Antusiasme & Kesenangan Bermain (Fun-Badminton)', type: 'READINESS_CONTEXT', legacy_keys: ['Antusiasme & Kesenangan Bermain (Fun-Badminton)'] }
    ]
  },
  MS: {
    code: 'MS',
    label: 'Khusus Tunggal Putra (MS)',
    shortLabel: 'Tunggal Putra',
    indicators: [
      { id: 'BDM-EVT-MS-01', name: 'Dominasi Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dominasi Serangan'] },
      { id: 'BDM-EVT-MS-02', name: 'Smash Penentu', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Smash Penentu'] },
      { id: 'BDM-EVT-MS-03', name: 'Kontrol Reli Panjang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Reli Panjang'] },
      { id: 'BDM-EVT-MS-04', name: 'Cakupan Lapangan Tunggal', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cakupan Lapangan Tunggal'] },
      { id: 'BDM-EVT-MS-05', name: 'Serangan dari Belakang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan dari Belakang'] },
      { id: 'BDM-EVT-MS-06', name: 'Counterattack', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Counterattack'] },
      { id: 'BDM-EVT-MS-07', name: 'Variasi Arah', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Variasi Arah'] },
      { id: 'BDM-EVT-MS-08', name: 'Kontrol Tempo Tunggal', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Tempo Tunggal'] }
    ]
  },
  WS: {
    code: 'WS',
    label: 'Khusus Tunggal Putri (WS)',
    shortLabel: 'Tunggal Putri',
    indicators: [
      { id: 'BDM-EVT-WS-01', name: 'Konsistensi Reli', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Konsistensi Reli'] },
      { id: 'BDM-EVT-WS-02', name: 'Ketahanan Reli', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Ketahanan Reli'] },
      { id: 'BDM-EVT-WS-03', name: 'Akurasi Penempatan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Akurasi Penempatan'] },
      { id: 'BDM-EVT-WS-04', name: 'Transisi Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Serangan'] },
      { id: 'BDM-EVT-WS-05', name: 'Variasi Tempo', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Variasi Tempo'] },
      { id: 'BDM-EVT-WS-06', name: 'Pertahanan Tunggal', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pertahanan Tunggal'] },
      { id: 'BDM-EVT-WS-07', name: 'Kontrol Area Belakang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Area Belakang'] },
      { id: 'BDM-EVT-WS-08', name: 'Efektivitas Poin', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Efektivitas Poin'] }
    ]
  },
  MD: {
    code: 'MD',
    label: 'Khusus Ganda Putra (MD)',
    shortLabel: 'Ganda Putra',
    indicators: [
      { id: 'BDM-EVT-MD-01', name: 'Tekanan Servis', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tekanan Servis'] },
      { id: 'BDM-EVT-MD-02', name: 'Return Menyerang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Return Menyerang'] },
      { id: 'BDM-EVT-MD-03', name: 'Dominasi Depan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dominasi Depan'] },
      { id: 'BDM-EVT-MD-04', name: 'Serangan Belakang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan Belakang'] },
      { id: 'BDM-EVT-MD-05', name: 'Kecepatan Drive', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kecepatan Drive'] },
      { id: 'BDM-EVT-MD-06', name: 'Pertahanan Ganda', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pertahanan Ganda'] },
      { id: 'BDM-EVT-MD-07', name: 'Rotasi Serang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Rotasi Serang'] },
      { id: 'BDM-EVT-MD-08', name: 'Transisi Formasi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Formasi'] },
      { id: 'BDM-EVT-MD-09', name: 'Tekanan Beruntun', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tekanan Beruntun'] }
    ]
  },
  WD: {
    code: 'WD',
    label: 'Khusus Ganda Putri (WD)',
    shortLabel: 'Ganda Putri',
    indicators: [
      { id: 'BDM-EVT-WD-01', name: 'Kontrol Depan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Depan'] },
      { id: 'BDM-EVT-WD-02', name: 'Penempatan Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Penempatan Serangan'] },
      { id: 'BDM-EVT-WD-03', name: 'Pertahanan Beruntun', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pertahanan Beruntun'] },
      { id: 'BDM-EVT-WD-04', name: 'Kontrol Reli Ganda', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Reli Ganda'] },
      { id: 'BDM-EVT-WD-05', name: 'Rotasi Pasangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Rotasi Pasangan'] },
      { id: 'BDM-EVT-WD-06', name: 'Serangan Celah', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan Celah'] },
      { id: 'BDM-EVT-WD-07', name: 'Konsistensi Pasangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Konsistensi Pasangan'] },
      { id: 'BDM-EVT-WD-08', name: 'Transisi Formasi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Formasi'] },
      { id: 'BDM-EVT-WD-09', name: 'Penguasaan Area', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Penguasaan Area'] }
    ]
  },
  XD: {
    code: 'XD',
    label: 'Khusus Ganda Campuran (XD)',
    shortLabel: 'Ganda Campuran',
    indicators: [
      { id: 'BDM-EVT-XD-01', name: 'Kontrol Depan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Depan'] },
      { id: 'BDM-EVT-XD-02', name: 'Serangan Belakang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan Belakang'] },
      { id: 'BDM-EVT-XD-03', name: 'Rotasi Campuran', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Rotasi Campuran'] },
      { id: 'BDM-EVT-XD-04', name: 'Pembagian Area', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pembagian Area'] },
      { id: 'BDM-EVT-XD-05', name: 'Kombinasi Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kombinasi Serangan'] },
      { id: 'BDM-EVT-XD-06', name: 'Pertahanan Pasangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pertahanan Pasangan'] },
      { id: 'BDM-EVT-XD-07', name: 'Transisi Formasi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Formasi'] },
      { id: 'BDM-EVT-XD-08', name: 'Sinkronisasi Gerak', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sinkronisasi Gerak'] },
      { id: 'BDM-EVT-XD-09', name: 'Strategi Pasangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Strategi Pasangan'] }
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
