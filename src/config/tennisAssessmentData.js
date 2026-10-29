// =====================================================================
// DATA & LOGIKA "ATHLETE DEVELOPMENT ASSESSMENT" CABANG TENIS (TENNIS)
// =====================================================================

export function isTennisSport(selectedClass, activeAcademy) {
  const isTableTennis = (str) => str.includes('meja') || str.includes('table');

  const acadSport = (
    activeAcademy?.sport ||
    activeAcademy?.sportName ||
    activeAcademy?.sport_type ||
    activeAcademy?.category ||
    activeAcademy?.sportCategory ||
    ''
  ).toLowerCase().trim();

  const acadName = (activeAcademy?.name || '').toLowerCase().trim();

  const clsSport = (
    selectedClass?.sport ||
    selectedClass?.sportName ||
    selectedClass?.sport_type ||
    selectedClass?.sport_category ||
    selectedClass?.category ||
    ''
  ).toLowerCase().trim();

  const clsName = (
    selectedClass?.name ||
    selectedClass?.className ||
    ''
  ).toLowerCase().trim();

  // Cegah bentrok dengan tenis meja (table tennis)
  if (isTableTennis(acadSport) || isTableTennis(acadName) || isTableTennis(clsSport) || isTableTennis(clsName)) {
    return false;
  }

  // 1. Jika Akademi yang aktif adalah Tenis, maka seluruh kelas di dalamnya adalah Tenis
  const isAcadTennis = ['tenis', 'tennis'].some((s) => acadSport.includes(s) || acadName.includes(s));
  if (isAcadTennis) {
    return true;
  }

  // 2. Jika kelas memiliki penanda Tenis
  const isClsTennis = ['tenis', 'tennis'].some((s) => clsSport.includes(s) || clsName.includes(s));
  if (isClsTennis) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------
// 7 JENJANG USIA & KURIKULUM RESMI (ITF TENNIS10s & TDP PELTI / ITF JUNIORS)
// ---------------------------------------------------------------------
export const TENNIS_AGE_LEVELS = [
  // FASE A: ITF TENNIS10s (ANAK-ANAK < 10 TAHUN, DILARANG BOLA KUNING STANDAR)
  {
    code: 'T10_RED',
    tierGroup: 'TENNIS10S',
    tierNumber: 1,
    tierSub: '1A',
    tierLabel: 'Tier 1A: ITF Red Ball',
    name: 'ITF Red Ball (U-8)',
    shortName: 'Red Ball',
    ageRange: 'Usia 5 – 8 Tahun',
    minAge: 5,
    maxAge: 8,
    ballColor: 'Red',
    courtSize: '11 x 5–6 meter (1/4 Lapangan)',
    ballType: 'Red Felt/Foam (-75% Bounce)',
    racketLength: '17 – 23 Inci',
    focus: 'Koordinasi motorik, kesenangan bermain, & reli dasar tanpa membebani otot',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    ballBadge: 'bg-rose-600 text-white',
    activeIndicators: {
      fisik: [
        'Kelincahan',
        'Reaksi',
        'Keseimbangan',
        'Gerak Multiarah',
        'Mobilitas',
        'Koordinasi Tubuh'
      ],
      teknik: [
        'Servis',
        'Return Servis',
        'Forehand',
        'Backhand',
        'Forehand Volley',
        'Backhand Volley',
        'Groundstroke',
        'Arah Pukulan',
        'Konsistensi Pukulan',
        'Kontak Bola'
      ],
      taktik: [
        'Posisi Dasar',
        'Kontrol Reli'
      ],
      mental: [
        'Fokus',
        'Percaya Diri',
        'Kontrol Emosi',
        'Daya Juang'
      ],
      komunikasi: [
        'Komunikasi Verbal',
        'Isyarat Pasangan',
        'Koordinasi Posisi',
        'Pembagian Area'
      ],
      perkembangan: [
        'Kehadiran Latihan',
        'Kepatuhan Program',
        'Respons Latihan',
        'Progres Teknik',
        'Progres Fisik'
      ]
    }
  },
  {
    code: 'T10_ORANGE',
    tierGroup: 'TENNIS10S',
    tierNumber: 1,
    tierSub: '1B',
    tierLabel: 'Tier 1B: ITF Orange Ball',
    name: 'ITF Orange Ball (U-10)',
    shortName: 'Orange Ball',
    ageRange: 'Usia 8 – 10 Tahun',
    minAge: 8,
    maxAge: 10,
    ballColor: 'Orange',
    courtSize: '18 x 6,5–8,23 meter (Modifikasi)',
    ballType: 'Orange Felt (-50% Bounce)',
    racketLength: '23 – 25 Inci',
    focus: 'Gerak multiarah, konstruksi reli dasar, & pengenalan area modifikasi',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    ballBadge: 'bg-amber-500 text-white',
    activeIndicators: {
      fisik: [
        'Kelincahan',
        'Reaksi',
        'Keseimbangan',
        'Gerak Multiarah',
        'Mobilitas',
        'Koordinasi Tubuh'
      ],
      teknik: [
        'Servis',
        'Return Servis',
        'Forehand',
        'Backhand',
        'Forehand Volley',
        'Backhand Volley',
        'Groundstroke',
        'Arah Pukulan',
        'Konsistensi Pukulan',
        'Kontak Bola'
      ],
      taktik: [
        'Posisi Dasar',
        'Kontrol Reli'
      ],
      mental: [
        'Fokus',
        'Percaya Diri',
        'Kontrol Emosi',
        'Daya Juang'
      ],
      komunikasi: [
        'Komunikasi Verbal',
        'Isyarat Pasangan',
        'Koordinasi Posisi',
        'Pembagian Area'
      ],
      perkembangan: [
        'Kehadiran Latihan',
        'Kepatuhan Program',
        'Respons Latihan',
        'Progres Teknik',
        'Progres Fisik'
      ]
    }
  },
  {
    code: 'T10_GREEN',
    tierGroup: 'TENNIS10S',
    tierNumber: 1,
    tierSub: '1C',
    tierLabel: 'Tier 1C: ITF Green Dot Ball',
    name: 'ITF Green Dot (U-10)',
    shortName: 'Green Dot',
    ageRange: 'Usia 9 – 10 Tahun',
    minAge: 9,
    maxAge: 10,
    ballColor: 'Green',
    courtSize: '23,77 x 8,23 meter (Lapangan Penuh)',
    ballType: 'Green Dot Felt (-25% Bounce)',
    racketLength: '25 – 26 Inci',
    focus: 'Adaptasi ukuran lapangan penuh, kontrol pukulan dasar, & transisi bola kuning',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    ballBadge: 'bg-emerald-600 text-white',
    activeIndicators: {
      fisik: [
        'Akselerasi',
        'Kecepatan Gerak',
        'Kelincahan',
        'Reaksi',
        'Daya Tahan',
        'Kekuatan Inti',
        'Keseimbangan',
        'Pengereman',
        'Gerak Multiarah',
        'Mobilitas',
        'Koordinasi Tubuh'
      ],
      teknik: [
        'Servis',
        'Return Servis',
        'Forehand',
        'Backhand',
        'Forehand Volley',
        'Backhand Volley',
        'Groundstroke',
        'Slice',
        'Topspin',
        'Lob',
        'Overhead',
        'Arah Pukulan',
        'Kedalaman Bola',
        'Konsistensi Pukulan',
        'Pukulan Sambil Bergerak',
        'Kontak Bola'
      ],
      taktik: [
        'Posisi Dasar',
        'Cakupan Lapangan',
        'Membaca Lawan',
        'Pilihan Pukulan',
        'Kontrol Reli',
        'Variasi Arah',
        'Variasi Tempo',
        'Bangun Serangan',
        'Kontrol Baseline',
        'Target Servis',
        'Strategi Return'
      ],
      mental: [
        'Fokus',
        'Percaya Diri',
        'Kontrol Emosi',
        'Disiplin',
        'Daya Juang',
        'Reset Mental'
      ],
      komunikasi: [
        'Komunikasi Verbal',
        'Isyarat Pasangan',
        'Koordinasi Posisi',
        'Pembagian Area',
        'Kepercayaan Pasangan',
        'Respons Pasangan'
      ],
      perkembangan: [
        'Kehadiran Latihan',
        'Kepatuhan Program',
        'Respons Latihan',
        'Progres Teknik',
        'Progres Fisik',
        'Progres Taktik',
        'Pencapaian Target'
      ]
    }
  },

  // FASE B: TDP PELTI & ITF JUNIORS (BOLA KUNING STANDAR DI LAPANGAN PENUH)
  {
    code: 'PELTI_KU12',
    tierGroup: 'PELTI_ITF',
    tierNumber: 2,
    tierSub: '2',
    tierLabel: 'Tier 2: TDP PELTI KU-12',
    name: 'Kelompok Umur 12 Tahun (KU-12)',
    shortName: 'KU-12 PELTI',
    ageRange: 'Usia 11 – 12 Tahun',
    minAge: 11,
    maxAge: 12,
    ballColor: 'Yellow',
    courtSize: '23,77 x 8,23 meter (Lapangan Penuh)',
    ballType: 'Bola Kuning Standar (Yellow Ball)',
    racketLength: '26 – 27 Inci',
    focus: 'Jembatan bola hijau ke bola kuning standar, transisi teknik, & penguatan fisik awal',
    badgeClass: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
    ballBadge: 'bg-amber-400 text-slate-950',
    activeIndicators: {
      fisik: [
        'Akselerasi',
        'Kecepatan Gerak',
        'Kelincahan',
        'Reaksi',
        'Daya Tahan',
        'Daya Ledak Kaki',
        'Kekuatan Inti',
        'Keseimbangan',
        'Pengereman',
        'Gerak Multiarah',
        'Mobilitas',
        'Koordinasi Tubuh'
      ],
      teknik: [
        'Servis',
        'Return Servis',
        'Forehand',
        'Backhand',
        'Forehand Volley',
        'Backhand Volley',
        'Groundstroke',
        'Slice',
        'Topspin',
        'Flat Shot',
        'Lob',
        'Overhead',
        'Approach Shot',
        'Arah Pukulan',
        'Kedalaman Bola',
        'Konsistensi Pukulan',
        'Pukulan Sambil Bergerak',
        'Kontak Bola'
      ],
      taktik: [
        'Posisi Dasar',
        'Cakupan Lapangan',
        'Membaca Lawan',
        'Pilihan Pukulan',
        'Kontrol Reli',
        'Variasi Arah',
        'Variasi Tempo',
        'Bangun Serangan',
        'Bertahan ke Menyerang',
        'Menyerang ke Bertahan',
        'Kontrol Baseline',
        'Permainan Net',
        'Antisipasi Bola',
        'Target Servis',
        'Strategi Return'
      ],
      mental: [
        'Fokus',
        'Percaya Diri',
        'Kontrol Emosi',
        'Disiplin',
        'Daya Juang',
        'Reset Mental',
        'Tahan Tekanan',
        'Konsistensi Mental'
      ],
      komunikasi: [
        'Komunikasi Verbal',
        'Isyarat Pasangan',
        'Koordinasi Posisi',
        'Pembagian Area',
        'Kepercayaan Pasangan',
        'Respons Pasangan',
        'Koordinasi Serangan',
        'Koordinasi Bertahan'
      ],
      perkembangan: [
        'Kehadiran Latihan',
        'Kepatuhan Program',
        'Respons Latihan',
        'Progres Teknik',
        'Progres Fisik',
        'Progres Taktik',
        'Pencapaian Target',
        'Kesiapan Bertanding'
      ]
    }
  },
  {
    code: 'PELTI_KU14',
    tierGroup: 'PELTI_ITF',
    tierNumber: 3,
    tierSub: '3A',
    tierLabel: 'Tier 3A: TDP PELTI / JTI KU-14',
    name: 'Kelompok Umur 14 Tahun (KU-14)',
    shortName: 'KU-14 PELTI',
    ageRange: 'Usia 13 – 14 Tahun',
    minAge: 13,
    maxAge: 14,
    ballColor: 'Yellow',
    courtSize: '23,77 x 8,23 meter (Standar Penuh)',
    ballType: 'Bola Kuning Standar (Yellow Ball)',
    racketLength: '27 Inci (Standar Dewasa)',
    focus: 'TDP PELTI & ITF Junior Tennis Initiative 14&U, pematangan taktik & mental tanding',
    badgeClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    ballBadge: 'bg-yellow-400 text-slate-950',
    activeIndicators: null // null = seluruh 86 indikator aktif penuh
  },
  {
    code: 'PELTI_KU16',
    tierGroup: 'PELTI_ITF',
    tierNumber: 3,
    tierSub: '3B',
    tierLabel: 'Tier 3B: TDP PELTI / Davis Cup Jr KU-16',
    name: 'Kelompok Umur 16 Tahun (KU-16)',
    shortName: 'KU-16 PELTI',
    ageRange: 'Usia 15 – 16 Tahun',
    minAge: 15,
    maxAge: 16,
    ballColor: 'Yellow',
    courtSize: '23,77 x 8,23 meter (Standar Penuh)',
    ballType: 'Bola Kuning Standar (Yellow Ball)',
    racketLength: '27 Inci (Standar Dewasa)',
    focus: 'Junior Davis Cup / Billie Jean King Cup U-16, fisik atletik & strategi lanjut',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    ballBadge: 'bg-yellow-400 text-slate-950',
    activeIndicators: null // null = seluruh 86 indikator aktif penuh
  },
  {
    code: 'PELTI_KU18',
    tierGroup: 'PELTI_ITF',
    tierNumber: 4,
    tierSub: '4',
    tierLabel: 'Tier 4: ITF Juniors & Pro KU-18',
    name: 'Kelompok Umur 18 Tahun / Pro (KU-18)',
    shortName: 'KU-18 & Pro',
    ageRange: 'Usia 17 – 18+ Tahun',
    minAge: 17,
    maxAge: 99,
    ballColor: 'Yellow',
    courtSize: '23,77 x 8,23 meter (Standar Penuh)',
    ballType: 'Bola Kuning Standar (Yellow Ball)',
    racketLength: '27 Inci (Standar Dewasa)',
    focus: 'ITF World Tennis Tour Juniors & transisi profesional, evaluasi performa maksimal',
    badgeClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    ballBadge: 'bg-yellow-400 text-slate-950',
    activeIndicators: null // null = seluruh 86 indikator aktif penuh
  }
];

export function getTennisLevelConfig(code) {
  // Dukungan backward compatibility untuk kode lama LEVEL_1 s.d. LEVEL_6
  const legacyMap = {
    'LEVEL_1': 'T10_RED',
    'LEVEL_2': 'PELTI_KU12',
    'LEVEL_3': 'PELTI_KU14',
    'LEVEL_4': 'PELTI_KU16',
    'LEVEL_5': 'PELTI_KU18',
    'LEVEL_6': 'PELTI_KU18',
    'red_u10': 'T10_RED',
    'orange_u12': 'T10_ORANGE',
    'green_u14': 'T10_GREEN',
    'yellow_u16': 'PELTI_KU14',
    'junior_u18': 'PELTI_KU16',
    'senior_pro': 'PELTI_KU18'
  };

  const resolvedCode = legacyMap[code] || code;
  return TENNIS_AGE_LEVELS.find((l) => l.code === resolvedCode) || TENNIS_AGE_LEVELS[2];
}

export function detectTennisLevelFromAge(ageInput) {
  if (ageInput === undefined || ageInput === null || ageInput === '') return getTennisLevelConfig('T10_GREEN');
  let parsed = 0;
  if (typeof ageInput === 'number') {
    parsed = ageInput;
  } else {
    const digits = String(ageInput).replace(/\D/g, '');
    parsed = parseInt(digits, 10) || 0;
  }

  // Aturan resmi deteksi otomatis usia tenis:
  // <= 7 tahun  -> T10_RED
  // 8 tahun     -> T10_ORANGE
  // 9 - 10 thn  -> T10_GREEN
  // 11 - 12 thn -> PELTI_KU12
  // 13 - 14 thn -> PELTI_KU14
  // 15 - 16 thn -> PELTI_KU16
  // >= 17 thn   -> PELTI_KU18
  if (parsed <= 7) return getTennisLevelConfig('T10_RED');
  if (parsed === 8) return getTennisLevelConfig('T10_ORANGE');
  if (parsed <= 10) return getTennisLevelConfig('T10_GREEN');
  if (parsed <= 12) return getTennisLevelConfig('PELTI_KU12');
  if (parsed <= 14) return getTennisLevelConfig('PELTI_KU14');
  if (parsed <= 16) return getTennisLevelConfig('PELTI_KU16');
  return getTennisLevelConfig('PELTI_KU18');
}

// ---------------------------------------------------------------------
// HELPER FILTER INDIKATOR AKTIF BERDASARKAN JENJANG KURIKULUM TENIS
// ---------------------------------------------------------------------
export function getFilteredTennisIndicators(categoryKey, tierCode) {
  const cat = TENNIS_CORE_CATEGORIES[categoryKey];
  if (!cat) return [];
  const level = getTennisLevelConfig(tierCode);
  if (level?.activeIndicators && level.activeIndicators[categoryKey]) {
    const allowed = new Set(level.activeIndicators[categoryKey]);
    return cat.indicators.filter((ind) => allowed.has(ind));
  }
  return cat.indicators;
}

// ---------------------------------------------------------------------
// 6 KATEGORI UTAMA PENILAIAN TENIS
// ---------------------------------------------------------------------
export const TENNIS_CORE_CATEGORIES = {
  fisik: {
    id: 'fisik',
    label: 'Physical / Fisik',
    shortLabel: 'Fisik',
    iconName: 'Activity',
    description: '16 Indikator parameter ketahanan, kelincahan, kekuatan lengan, dan kebugaran lapangan tenis.',
    indicators: [
      'Akselerasi',
      'Kecepatan Gerak',
      'Kelincahan',
      'Reaksi',
      'Daya Tahan',
      'Daya Ledak Kaki',
      'Kekuatan Inti',
      'Keseimbangan',
      'Pengereman',
      'Gerak Multiarah',
      'Sprint Berulang',
      'Daya Tahan Lengan',
      'Kekuatan Genggaman',
      'Mobilitas',
      'Koordinasi Tubuh',
      'Pemulihan'
    ]
  },
  teknik: {
    id: 'teknik',
    label: 'Technical / Teknik',
    shortLabel: 'Teknik',
    iconName: 'Zap',
    description: '22 Indikator penguasaan stroke, groundstroke, voli, servis, spins, dan presisi pukulan.',
    indicators: [
      'Servis',
      'Return Servis',
      'Forehand',
      'Backhand',
      'Forehand Volley',
      'Backhand Volley',
      'Groundstroke',
      'Slice',
      'Topspin',
      'Flat Shot',
      'Lob',
      'Drop Shot',
      'Passing Shot',
      'Overhead',
      'Smash',
      'Approach Shot',
      'Arah Pukulan',
      'Kedalaman Bola',
      'Konsistensi Pukulan',
      'Pukulan Sambil Bergerak',
      'Kontak Bola',
      'Kaki Non-dominan'
    ]
  },
  taktik: {
    id: 'taktik',
    label: 'Tactical / Taktik',
    shortLabel: 'Taktik',
    iconName: 'Brain',
    description: '20 Indikator membaca lawan, konstruksi poin reli, kontrol ritme, dan strategi baseline/net.',
    indicators: [
      'Posisi Dasar',
      'Cakupan Lapangan',
      'Membaca Lawan',
      'Pilihan Pukulan',
      'Kontrol Reli',
      'Variasi Arah',
      'Variasi Tempo',
      'Bangun Serangan',
      'Bertahan ke Menyerang',
      'Menyerang ke Bertahan',
      'Eksploitasi Kelemahan',
      'Serang Area Terbuka',
      'Kontrol Baseline',
      'Permainan Net',
      'Antisipasi Bola',
      'Adaptasi Taktik',
      'Manajemen Poin',
      'Manajemen Pertandingan',
      'Target Servis',
      'Strategi Return'
    ]
  },
  mental: {
    id: 'mental',
    label: 'Mental / Karakter',
    shortLabel: 'Mental',
    iconName: 'Shield',
    description: '10 Indikator ketangguhan mental, fokus poin kritis, daya juang, dan kontrol emosi pertandingan.',
    indicators: [
      'Fokus',
      'Percaya Diri',
      'Kontrol Emosi',
      'Disiplin',
      'Daya Juang',
      'Reset Mental',
      'Tahan Tekanan',
      'Konsistensi Mental',
      'Mandiri Bertanding',
      'Fokus Poin Kritis'
    ]
  },
  komunikasi: {
    id: 'komunikasi',
    label: 'Communication / Komunikasi (Ganda)',
    shortLabel: 'Komunikasi',
    iconName: 'MessageSquare',
    isDoublesFocus: true,
    description: '8 Indikator kerja sama, isyarat tangan, rotasi posisi, dan koordinasi antarpasangan nomor ganda.',
    indicators: [
      'Komunikasi Verbal',
      'Isyarat Pasangan',
      'Koordinasi Posisi',
      'Pembagian Area',
      'Kepercayaan Pasangan',
      'Respons Pasangan',
      'Koordinasi Serangan',
      'Koordinasi Bertahan'
    ]
  },
  perkembangan: {
    id: 'perkembangan',
    label: 'Development / Perkembangan',
    shortLabel: 'Perkembangan',
    iconName: 'BarChart2',
    description: '10 Indikator kepatuhan program, kehadiran latihan, progres jangka panjang, dan kedewasaan bertanding.',
    indicators: [
      'Kehadiran Latihan',
      'Kepatuhan Program',
      'Respons Latihan',
      'Progres Teknik',
      'Progres Fisik',
      'Progres Taktik',
      'Pencapaian Target',
      'Kesiapan Bertanding',
      'Evaluasi Mandiri',
      'Konsistensi Performa'
    ]
  }
};

// ---------------------------------------------------------------------
// 5 NOMOR PERTANDINGAN RESMI TENIS
// ---------------------------------------------------------------------
export const TENNIS_EVENT_TYPES = [
  {
    code: 'MS',
    name: "Men's Singles",
    label: 'Tunggal Putra (MS)',
    isDoubles: false,
    badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    description: 'Dominasi reli baseline, kekuatan servis, dan daya jelajah solo.',
    indicators: [
      'Dominasi Baseline',
      'Servis Pertama',
      'Return Agresif',
      'Reli Panjang',
      'Serangan Sudut',
      'Forehand Dominan',
      'Pergerakan Lapangan',
      'Tekanan Poin'
    ]
  },
  {
    code: 'WS',
    name: "Women's Singles",
    label: 'Tunggal Putri (WS)',
    isDoubles: false,
    badgeColor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    description: 'Konsistensi penempatan bola, kontrol kedalaman, dan transisi menyerang.',
    indicators: [
      'Konsistensi Reli',
      'Akurasi Penempatan',
      'Kontrol Kedalaman',
      'Variasi Tempo',
      'Pertahanan Baseline',
      'Transisi Menyerang',
      'Cakupan Lapangan',
      'Efektivitas Poin'
    ]
  },
  {
    code: 'MD',
    name: "Men's Doubles",
    label: 'Ganda Putra (MD)',
    isDoubles: true,
    badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    description: 'Dominasi area net, formasi cepat, reaksi voli, dan smash ganda.',
    indicators: [
      'Servis Ganda',
      'Return Menekan',
      'Dominasi Net',
      'Voli Reaksi',
      'Smash Ganda',
      'Lob Bertahan',
      'Formasi Serang',
      'Formasi Bertahan',
      'Pembagian Area',
      'Rotasi Pasangan'
    ]
  },
  {
    code: 'WD',
    name: "Women's Doubles",
    label: 'Ganda Putri (WD)',
    isDoubles: true,
    badgeColor: 'bg-pink-100 dark:bg-pink-950/60 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-700',
    description: 'Kerapatan pertahanan, konsistensi voli, rotasi, dan penempatan bola.',
    indicators: [
      'Servis Ganda',
      'Return Servis',
      'Konsistensi Voli',
      'Kontrol Net',
      'Penempatan Bola',
      'Pertahanan Pasangan',
      'Rotasi Pasangan',
      'Koordinasi Serangan',
      'Pembagian Area',
      'Kontrol Poin'
    ]
  },
  {
    code: 'XD',
    name: 'Mixed Doubles',
    label: 'Ganda Campuran (XD)',
    isDoubles: true,
    badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    description: 'Kombinasi power baseline & sentuhan net, sinkronisasi gerak, dan strategi.',
    indicators: [
      'Servis Ganda',
      'Return Menekan',
      'Dominasi Net',
      'Serangan Belakang',
      'Kombinasi Serangan',
      'Pertahanan Pasangan',
      'Rotasi Pasangan',
      'Pembagian Area',
      'Sinkronisasi Gerak',
      'Strategi Pasangan'
    ]
  },
  {
    code: 'T10_EXPLORE',
    name: 'Eksplorasi Tennis10s',
    label: 'Eksplorasi Tennis10s (Mini-Match)',
    isDoubles: false,
    isExplore: true,
    badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    description: 'Format bermain mini-court Tennis10s, kesenangan reli, sportivitas, dan eksplorasi pukulan.',
    indicators: [
      'Sentuhan Bola',
      'Kesenangan Bermain',
      'Reli Mini Lapangan',
      'Servis Bawah/Atas Ringan',
      'Sportivitas',
      'Antusiasme'
    ]
  }
];

export function getTennisEventConfig(code) {
  return TENNIS_EVENT_TYPES.find((e) => e.code === code) || TENNIS_EVENT_TYPES[0];
}

export const TENNIS10S_OBSERVATIONS = {
  dominantHandAndBackhand: {
    id: 'dominantHandAndBackhand',
    label: 'Tangan Dominan & Backhand',
    options: [
      'Kanan - Backhand 2 Tangan',
      'Kanan - Backhand 1 Tangan',
      'Kidal - Backhand 2 Tangan',
      'Eksplorasi Dua Tangan'
    ]
  },
  gripAdaptation: {
    id: 'gripAdaptation',
    label: 'Adaptasi Grip Dasar',
    options: [
      'Tahap Pengenalan Grip',
      'Mulai Konsisten Eastern/Continental',
      'Transisi Grip Lancar'
    ]
  },
  rallyReadinessAndTransition: {
    id: 'rallyReadinessAndTransition',
    label: 'Kesiapan Reli & Transisi Bola',
    options: [
      'Tahap Kontrol Pantulan Dasar',
      'Mampu Reli Kooperatif 10+ Pukulan',
      'Siap Promosi ke Warna Bola Berikutnya'
    ]
  }
};

export function getAvailableTennisEventsForTier(tierCode) {
  if (tierCode === 'T10_RED' || tierCode === 'T10_ORANGE') {
    return [
      getTennisEventConfig('T10_EXPLORE')
    ];
  }
  if (tierCode === 'T10_GREEN') {
    return [
      getTennisEventConfig('T10_EXPLORE'),
      getTennisEventConfig('MS'),
      getTennisEventConfig('WS')
    ];
  }
  return TENNIS_EVENT_TYPES.filter((e) => ['MS', 'WS', 'MD', 'WD', 'XD'].includes(e.code));
}

// ---------------------------------------------------------------------
// MAP SINKRONISASI INDIKATOR KHUSUS NOMOR KE INDIKATOR UMUM (ANTI-DUPLIKASI)
// ---------------------------------------------------------------------
export const TENNIS_EMPHASIS_SYNC_MAP = {
  'Dominasi Baseline': 'Kontrol Baseline',
  'Pertahanan Baseline': 'Kontrol Baseline',
  'Servis Pertama': 'Servis',
  'Servis Ganda': 'Servis',
  'Return Agresif': 'Return Servis',
  'Return Menekan': 'Return Servis',
  'Reli Panjang': 'Kontrol Reli',
  'Konsistensi Reli': 'Kontrol Reli',
  'Forehand Dominan': 'Forehand',
  'Pergerakan Lapangan': 'Cakupan Lapangan',
  'Cakupan Lapangan': 'Cakupan Lapangan',
  'Variasi Tempo': 'Variasi Tempo',
  'Akurasi Penempatan': 'Kedalaman Bola',
  'Kontrol Kedalaman': 'Kedalaman Bola',
  'Dominasi Net': 'Permainan Net',
  'Kontrol Net': 'Permainan Net',
  'Voli Reaksi': 'Forehand Volley',
  'Smash Ganda': 'Smash',
  'Pembagian Area': 'Pembagian Area',
  'Rotasi Pasangan': 'Koordinasi Posisi',
  'Formasi Serang': 'Koordinasi Serangan',
  'Koordinasi Serangan': 'Koordinasi Serangan',
  'Formasi Bertahan': 'Koordinasi Bertahan',
  'Pertahanan Pasangan': 'Koordinasi Bertahan',
  'Penempatan Bola': 'Arah Pukulan',
  'Transisi Menyerang': 'Bertahan ke Menyerang',
  'Strategi Pasangan': 'Manajemen Pertandingan',
  'Tekanan Poin': 'Fokus Poin Kritis',
  'Efektivitas Poin': 'Manajemen Poin',
  'Kontrol Poin': 'Manajemen Poin',
  'Sentuhan Bola': 'Kontak Bola',
  'Kesenangan Bermain': 'Percaya Diri',
  'Reli Mini Lapangan': 'Kontrol Reli',
  'Servis Bawah/Atas Ringan': 'Servis',
  'Sportivitas': 'Disiplin',
  'Antusiasme': 'Daya Juang'
};

// ---------------------------------------------------------------------
// 10 GAYA BERMAIN TENIS (PLAYING STYLES - OBSERVASI PELATIH / NON-SKOR)
// ---------------------------------------------------------------------
export const TENNIS_PLAYING_STYLES = [
  {
    code: 'STY01',
    name: 'Baseline Aggressor',
    shortName: 'Aggressor',
    tagline: 'Menekan dari garis belakang',
    desc: 'Mengandalkan pukulan groundstroke keras mendalam untuk mendikte tempo dan menekan lawan jauh di belakang baseline.',
    proExample: 'Novak Djokovic / Aryna Sabalenka'
  },
  {
    code: 'STY02',
    name: 'Counterpuncher',
    shortName: 'Counterpuncher',
    tagline: 'Bertahan lalu menyerang balik',
    desc: 'Sangat ulet, kecepatan kaki tinggi, mampu mengembalikan bola sulit dan mengubah situasi bertahan menjadi serangan mendadak.',
    proExample: 'Daniil Medvedev / Caroline Wozniacki'
  },
  {
    code: 'STY03',
    name: 'All-court Player',
    shortName: 'All-court',
    tagline: 'Nyaman di seluruh area lapangan',
    desc: 'Kombinasi fleksibel baseline yang solid, transisi mid-court yang mulus, dan sentuhan touch shot mematikan di depan net.',
    proExample: 'Roger Federer / Carlos Alcaraz'
  },
  {
    code: 'STY04',
    name: 'Serve & Volley',
    shortName: 'Serve & Volley',
    tagline: 'Servis lalu maju ke net',
    desc: 'Strategi ofensif klasik langsung menyerbu ke jaring net seketika setelah servis untuk menyelesaikan reli dengan voli cepat.',
    proExample: 'Pete Sampras / Maxime Cressy'
  },
  {
    code: 'STY05',
    name: 'Net Attacker',
    shortName: 'Net Attacker',
    tagline: 'Aktif membangun serangan di net',
    desc: 'Secara agresif memotong sudut pukulan lawan dan menutup ruang di depan net melalui penempatan drop shot dan punch volley.',
    proExample: 'Nicolas Mahut / Barbora Krejcikova'
  },
  {
    code: 'STY06',
    name: 'Defensive Player',
    shortName: 'Defensive',
    tagline: 'Mengutamakan pertahanan',
    desc: 'Spesialis minim unforced errors, mengutamakan konsistensi topspin tinggi dan kesabaran menunggu kesalahan lawan.',
    proExample: 'Rafael Nadal (clay mode) / Gilles Simon'
  },
  {
    code: 'STY07',
    name: 'Power Player',
    shortName: 'Power Player',
    tagline: 'Mengandalkan pukulan bertenaga',
    desc: 'Kecepatan ayunan raket tinggi, servis mematikan (ace-oriented), dan flat groundstroke berkecepatan tinggi.',
    proExample: 'Jannik Sinner / Elena Rybakina'
  },
  {
    code: 'STY08',
    name: 'Control Player',
    shortName: 'Control Player',
    tagline: 'Mengutamakan kontrol dan penempatan',
    desc: 'Prioritas pada sudut tajam, spin bervariasi (slice & kick), serta kedalaman bola yang memaksa lawan keluar dari court.',
    proExample: 'Iga Swiatek / Diego Schwartzman'
  },
  {
    code: 'STY09',
    name: 'Aggressive Returner',
    shortName: 'Aggressive Returner',
    tagline: 'Aktif menekan lewat return',
    desc: 'Membaca servis lawan dengan cermat, mengambil bola lebih awal (take on the rise) untuk merebut inisiatif reli sejak awal.',
    proExample: 'Andre Agassi / Victoria Azarenka'
  },
  {
    code: 'STY10',
    name: 'All-round Doubles',
    shortName: 'All-round Doubles',
    tagline: 'Fleksibel dalam berbagai peran ganda',
    desc: 'Paham rotasi "I-formation", koordinasi intersepsi net yang tajam, dan komunikasi solid sebagai tandem tim ganda.',
    proExample: 'Bob & Mike Bryan / Sania Mirza'
  }
];

export function getTennisStyleConfig(code) {
  return TENNIS_PLAYING_STYLES.find((s) => s.code === code) || TENNIS_PLAYING_STYLES[0];
}

// ---------------------------------------------------------------------
// PREDIKAT SKOR RESMI
// ---------------------------------------------------------------------
export function getTennisGradeInfo(overall) {
  if (overall === 0 || overall === undefined || overall === null) {
    return {
      label: 'Belum Dinilai',
      badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
    };
  }
  if (overall >= 90) {
    return {
      label: 'Elite Prospect (A+)',
      badgeClass: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
    };
  }
  if (overall >= 80) {
    return {
      label: 'Advanced / Unggulan (A)',
      badgeClass: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
    };
  }
  if (overall >= 70) {
    return {
      label: 'Competitive / Kompeten (B)',
      badgeClass: 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700'
    };
  }
  if (overall >= 50) {
    return {
      label: 'Developing / Berkembang (C)',
      badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
    };
  }
  return {
    label: 'Foundational / Pemula (D)',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
  };
}
