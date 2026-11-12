/**
 * CHUVATOR — FOOTBALL ASSESSMENT BATTERY CATALOG (PHASE 1: RAW TEST DATA CAPTURE)
 * Single Source of Truth untuk 18 tes lapangan objektif (OBJECTIVE_TEST)
 * yang terhubung langsung ke canonical indicator IDs pada footballAssessmentData.js.
 *
 * Referensi Dokumen:
 * - docs/assessment/FOOTBALL_ACTIVE_INDICATOR_INVENTORY.md (Task 01)
 * - docs/assessment/FOOTBALL_OBJECTIVE_TEST_MAPPING.md (Task 02 & Task 02.1)
 */

import {
  TIER_CONFIGS,
  FOOTBALL_CORE_CATEGORIES,
  FOOTBALL_POSITIONS,
  TIER_1_POSITIONS,
  TIER_2_POSITIONS,
  detectTierFromAge
} from './footballAssessmentData.js';

export const DEVELOPMENT_TIERS = {
  TIER_1_GRASSROOTS: { tier: 1, name: TIER_CONFIGS[1].shortLabel, fullLabel: TIER_CONFIGS[1].label },
  TIER_2_FOUNDATION: { tier: 2, name: TIER_CONFIGS[2].shortLabel, fullLabel: TIER_CONFIGS[2].label },
  TIER_3_YOUTH_DEV: { tier: 3, name: TIER_CONFIGS[3].shortLabel, fullLabel: TIER_CONFIGS[3].label },
  TIER_4_ELITE_PRO: { tier: 4, name: TIER_CONFIGS[4].shortLabel, fullLabel: TIER_CONFIGS[4].label }
};

/**
 * Daftar konstanta tipe skema input untuk form pencatatan di lapangan
 */
export const TEST_INPUT_SCHEMA_TYPES = {
  MULTI_TRIAL_BEST_MIN: 'MULTI_TRIAL_BEST_MIN',       // N percobaan, nilai terbaik = terendah (waktu s)
  MULTI_TRIAL_BEST_MAX: 'MULTI_TRIAL_BEST_MAX',       // N percobaan, nilai terbaik = tertinggi (jarak cm/m, reps)
  MULTI_TRIAL_AVERAGE: 'MULTI_TRIAL_AVERAGE',         // N percobaan, nilai akhir = rata-rata (mis. Ruler Drop)
  BILATERAL_AVERAGE: 'BILATERAL_AVERAGE',             // Kiri & Kanan wajib diisi, nilai akhir = rata-rata
  BILATERAL_BEST_AVERAGE: 'BILATERAL_BEST_AVERAGE',   // Kanan (1-2x) & Kiri (1-2x), rata-rata dari terbaik Kanan & terbaik Kiri
  VERTICAL_JUMP_DELTA: 'VERTICAL_JUMP_DELTA',         // Raihan berdiri H1 + 2 percobaan lompat H2 -> Selisih terbaik (H2 - H1)
  BLEEP_SHUTTLE_LEVEL: 'BLEEP_SHUTTLE_LEVEL',         // Input Level & Shuttle terakhir -> konversi ke total jarak (meter)
  SINGLE_TRIAL_MAX: 'SINGLE_TRIAL_MAX',               // 1 percobaan durasi/repetisi maksimal (Push-up 60s, Plank hold)
  RSA_6X30M: 'RSA_6X30M'                              // 6 repetisi wajib sprint 30m -> Total Sprint Time (s) & Fatigue Index (%)
};

/**
 * Tabel standar Bleep Test (20m Multistage Fitness Test - Leger Protocol)
 * Jumlah shuttle per level dari Level 1 hingga Level 21 (20 meter per shuttle).
 */
export const BLEEP_LEVEL_SHUTTLES = {
  1: 7,
  2: 8,
  3: 8,
  4: 9,
  5: 9,
  6: 10,
  7: 10,
  8: 11,
  9: 11,
  10: 11,
  11: 12,
  12: 12,
  13: 13,
  14: 13,
  15: 13,
  16: 14,
  17: 14,
  18: 15,
  19: 15,
  20: 15,
  21: 16
};

/**
 * Katalog 18 Tes Objektif Sepak Bola (Single Source of Truth)
 */
export const FOOTBALL_TEST_BATTERY_CATALOG = [
  // ===========================================================================
  // 1. FTB-UNI-PHY-01 — Akselerasi
  // ===========================================================================
  {
    testId: 'TST-SPR-10M',
    testName: '10m Linear Sprint Test',
    shortName: 'Sprint 10m',
    indicatorId: 'FTB-UNI-PHY-01',
    indicatorName: 'Akselerasi',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Kecepatan & Eksplosivitas Awal',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_1_GRASSROOTS', 'TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U6–Senior (6–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MIN,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1', 'Percobaan 2'],
    valueConstraints: { min: 1.0, max: 10.0, step: 0.01, decimals: 2 },
    restBetweenTrialsSec: 120,
    equipment: [
      'Meteran gulung minimal 15m',
      '4 kerucut (cone) penanda garis Start & Finish',
      'Stopwatch digital (0.01s) atau kamera HP (30/60 fps)'
    ],
    fieldSetup: 'Lintasan lurus datar 10 meter di atas rumput dengan area pengereman bebas minimal 10 meter setelah garis akhir.',
    instructions: [
      'Atlet berdiri dengan posisi split-stance (satu kaki di depan tepat di belakang garis Start, tanpa gerakan berayun/rocking).',
      'Pencatat waktu berdiri di garis Finish (10m). Waktu dimulai tepat saat kaki belakang atlet terangkat dari tanah (atau gunakan aba-aba visual ayunan bendera/tangan).',
      'Atlet berlari secepat mungkin melewati garis 10m tanpa melambat sebelum melewati garis akhir.',
      'Berikan istirahat jalan kaki kembali dan pemulihan 2–3 menit sebelum Percobaan 2.'
    ],
    validityRules: [
      'Tidak sah apabila atlet mencuri start (rolling start) atau kaki menginjak melewati garis Start.',
      'Tidak sah apabila atlet terpeleset saat tolakan awal atau melambat sebelum garis Finish.',
      'Catatan metodologi: Stopwatch manual memiliki human reaction error ±0.15–0.24 detik; disarankan pencatat tetap sama atau verifikasi frame video HP.'
    ],
    finalResultMethod: 'Nilai Terbaik (Waktu Tercepat / Minimum dari 2 percobaan sah)',
    formulaDescription: 'Final = min(T1, T2) dalam detik (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma persentil per kelompok usia (U8, U10, U12, U14, U16, U18+) dan protokol alat (Stopwatch vs Video HP).'
  },

  // ===========================================================================
  // 2. FTB-UNI-PHY-02 — Kelincahan
  // ===========================================================================
  {
    testId: 'TST-AGL-ARW',
    testName: 'Arrowhead Agility Test',
    shortName: 'Arrowhead Agility',
    indicatorId: 'FTB-UNI-PHY-02',
    indicatorName: 'Kelincahan',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Kelincahan & Manuver Ruang',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_1_GRASSROOTS', 'TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U6–Senior (6–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.BILATERAL_AVERAGE,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 2,
    trialLabels: ['Percobaan 1 (Belok Kiri)', 'Percobaan 2 (Belok Kanan)'],
    trialSides: ['LEFT', 'RIGHT'],
    valueConstraints: { min: 4.0, max: 30.0, step: 0.01, decimals: 2 },
    restBetweenTrialsSec: 180,
    equipment: [
      'Meteran gulung',
      '6 kerucut (cone): 2 di gerbang Start/Finish, 1 di titik tengah A (10m), 1 di kiri B (5m), 1 di kanan C (5m), 1 di ujung depan D (15m dari Start)',
      'Stopwatch digital (0.01s)'
    ],
    fieldSetup: 'Gerbang Start/Finish selebar 1.5m. Cone A lurus 10m di depan Start. Cone B (kiri) dan C (kanan) berjarak 5m tegak lurus dari Cone A. Cone D berada 5m lurus di depan Cone A (15m dari Start).',
    instructions: [
      'Atlet mulai dari belakang garis Start dalam posisi siap sprint.',
      'Percobaan 1 (Arah Kiri): Lari lurus 10m memutari luar Cone A -> belok ke luar Cone B (kiri) -> menuju memutari luar Cone D (ujung jauh) -> sprint lurus kembali ke garis Finish.',
      'Istirahat pemulihan 2–3 menit.',
      'Percobaan 2 (Arah Kanan): Lari lurus 10m memutari luar Cone A -> belok ke luar Cone C (kanan) -> menuju memutari luar Cone D -> sprint lurus kembali ke garis Finish.'
    ],
    validityRules: [
      'Kedua arah (Belok Kiri dan Belok Kanan) wajib diselesaikan secara sah untuk menghitung rata-rata kelincahan simetris.',
      'Tidak sah apabila atlet menabrak/menggeser cone, memotong jalur di bagian dalam cone, atau melompati atas cone.'
    ],
    finalResultMethod: 'Rata-rata waktu arah Kiri dan arah Kanan: (T_kiri + T_kanan) / 2',
    formulaDescription: 'Final = (T_left + T_right) / 2 dalam detik (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma persentil waktu rata-rata Arrowhead per kelompok usia.'
  },

  // ===========================================================================
  // 3. FTB-UNI-PHY-03 — Keseimbangan
  // ===========================================================================
  {
    testId: 'TST-BAL-STK',
    testName: 'Stork Stand Balance Test (Bilateral)',
    shortName: 'Stork Balance',
    indicatorId: 'FTB-UNI-PHY-03',
    indicatorName: 'Keseimbangan',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Stabilitas Postural & Propriosepsi',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_1_GRASSROOTS', 'TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U6–Senior (6–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.BILATERAL_BEST_AVERAGE,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 2,
    trialLabels: ['Tumpuan Kaki Kanan (Terbaik)', 'Tumpuan Kaki Kiri (Terbaik)'],
    trialSides: ['RIGHT', 'LEFT'],
    valueConstraints: { min: 0.5, max: 60.0, step: 0.1, decimals: 1 },
    restBetweenTrialsSec: 45,
    equipment: [
      'Stopwatch digital',
      'Permukaan lantai atau lapangan datar dan keras (tanpa sepatu berpul tinggi saat tes atau di atas alas datar)'
    ],
    fieldSetup: 'Area datar bebas hambatan. Atlet bertolak pinggang dengan kedua tangan di krista iliaka (pinggul).',
    instructions: [
      'Atlet berdiri satu kaki (mulai dengan Kaki Kanan), telapak kaki bebas ditempelkan pada sisi dalam lutut kaki tumpu, kedua tangan di pinggang.',
      'Saat aba-aba "Mulai", atlet mengangkat tumit kaki tumpu (berjinjit pada bola kaki/forefoot) dan mempertahankan posisi seimbang maksimal hingga 60 detik.',
      'Waktu dihentikan segera ketika tangan lepas dari pinggang, kaki tumpu bergeser/melompat, kaki bebas lepas dari lutut, atau tumit menyentuh lantai.',
      'Lakukan untuk Kaki Kanan dan Kaki Kiri (masing-masing boleh diulang hingga 2x bila goyah di awal, catat hasil terbaik tiap kaki).'
    ],
    validityRules: [
      'Waktu langsung berhenti saat posisi tangan lepas dari pinggul, tumit menyentuh tanah, atau kaki tumpu berpindah titik.',
      'Batas plafon maksimal per percobaan adalah 60.0 detik.',
      'Wajib mencatat hasil Kaki Kanan dan Kaki Kiri.'
    ],
    finalResultMethod: 'Rata-rata durasi terbaik Kaki Kanan dan Kaki Kiri (maksimal 60.0 detik)',
    formulaDescription: 'Final = (Best_Right + Best_Left) / 2 dalam detik (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan parameter batas atas durasi (T_max = 60s) per jenjang usia.'
  },

  // ===========================================================================
  // 4. FTB-UNI-PHY-04 — Mobilitas
  // ===========================================================================
  {
    testId: 'TST-MOB-SAR',
    testName: 'V-Sit and Reach Flexibility Test',
    shortName: 'V-Sit & Reach',
    indicatorId: 'FTB-UNI-PHY-04',
    indicatorName: 'Mobilitas',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Fleksibilitas Rantai Posterior',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_1_GRASSROOTS', 'TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U6–Senior (6–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MAX,
    unit: 'cm',
    unitLabel: 'sentimeter (cm)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1', 'Percobaan 2'],
    valueConstraints: { min: 0.5, max: 65.0, step: 0.5, decimals: 1 },
    restBetweenTrialsSec: 30,
    equipment: [
      'Meteran lantai / pita ukur 60 cm',
      'Lakban penanda garis tumit pada angka 25.0 cm',
      'Matras tipis atau lantai datar'
    ],
    fieldSetup: 'Tempelkan pita ukur lurus di lantai. Rekatkan lakban melintang tepat pada angka 25.0 cm sebagai garis batas tumit (sehingga nilai selalu positif dan menghindari kebingungan angka minus).',
    instructions: [
      'Atlet duduk tanpa sepatu dengan kedua tungkai lurus membuka huruf V (jarak antar tumit 30 cm) tepat di atas garis lakban 25.0 cm.',
      'Kedua telapak tangan ditumpuk sejajar (ujung jari tengah berhimpit).',
      'Dorong badan dan tangan perlahan ke depan sejauh mungkin sepanjang pita ukur sambil menghembuskan napas, tahan posisi terjauh selama 2 detik.',
      'Catat angka sentimeter tepat di ujung jari tengah (25.0 cm berarti sejajar tumit; >25.0 cm melewati tumit).'
    ],
    validityRules: [
      'Tidak sah apabila salah satu lutut menekuk/terangkat dari lantai.',
      'Tidak sah apabila gerakan dilakukan dengan menyentak/memantul (ballistic bouncing) atau satu tangan lebih maju dari tangan lainnya.',
      'Catatan konstruk: Mengukur fleksibilitas hamstring & punggung bawah (posterior chain), bukan mobilitas rotasi panggul/engkel penuh.'
    ],
    finalResultMethod: 'Nilai Terbaik (Jangkauan Terjauh / Maksimum dari 2 percobaan sah, skala garis tumit = 25.0 cm)',
    formulaDescription: 'Final = max(D1, D2) dalam cm (titik nol tumit = 25.0 cm)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan parameter rentang fleksibilitas (skala tumit 25 cm) per kelompok usia.'
  },

  // ===========================================================================
  // 5. FTB-UNI-PHY-06 — Kecepatan Maksimal
  // ===========================================================================
  {
    testId: 'TST-SPR-30M',
    testName: '30m Linear Sprint Test',
    shortName: 'Sprint 30m',
    indicatorId: 'FTB-UNI-PHY-06',
    indicatorName: 'Kecepatan Maksimal',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Kecepatan Puncak (Top-End Speed)',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U9–Senior (9–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MIN,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1', 'Percobaan 2'],
    valueConstraints: { min: 3.0, max: 15.0, step: 0.01, decimals: 2 },
    restBetweenTrialsSec: 180,
    equipment: [
      'Meteran gulung 30m+',
      '4 kerucut (cone) untuk gerbang Start (0m) & Finish (30m)',
      'Stopwatch digital (0.01s) atau kamera HP (30/60 fps)'
    ],
    fieldSetup: 'Lintasan lurus datar sepanjang 30 meter dengan zona perlambatan aman minimal 15 meter setelah garis Finish.',
    instructions: [
      'Atlet mengambil posisi berdiri split-stance tepat di belakang garis Start (0m).',
      'Pencatat waktu berdiri di garis Finish (30m).',
      'Saat kaki belakang atlet bergerak meninggalkan tanah (atau aba-aba bendera), stopwatch dinyalakan dan atlet berlari maksimal hingga melewati garis 30m.',
      'Istirahat pemulihan penuh 3 menit sebelum Percobaan 2.'
    ],
    validityRules: [
      'Tidak sah apabila terjadi rolling start, terpeleset, atau melambat sebelum melewati garis 30m.',
      'Jangan menggabungkan pengambilan split 10m dan 30m hanya dengan 1 pelatih ber-stopwatch tunggal; lakukan terpisah atau gunakan 2 pencatat / rekaman video HP.'
    ],
    finalResultMethod: 'Nilai Terbaik (Waktu Tercepat / Minimum dari 2 percobaan sah)',
    formulaDescription: 'Final = min(T1, T2) dalam detik (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma persentil waktu sprint 30m per kelompok usia (Tier 2–4).'
  },

  // ===========================================================================
  // 6. FTB-UNI-PHY-07 — Reaksi
  // ===========================================================================
  {
    testId: 'TST-RXN-RLR',
    testName: 'Ruler Drop Visuomotor Reaction Test',
    shortName: 'Ruler Drop Test',
    indicatorId: 'FTB-UNI-PHY-07',
    indicatorName: 'Reaksi',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Kecepatan Reaksi Visuomotor',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U9–Senior (9–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_AVERAGE,
    unit: 'cm',
    unitLabel: 'sentimeter (cm)',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 3,
    minValidTrialsCount: 3,
    trialLabels: ['Percobaan 1', 'Percobaan 2', 'Percobaan 3'],
    valueConstraints: { min: 1.0, max: 50.0, step: 0.5, decimals: 1 },
    restBetweenTrialsSec: 15,
    equipment: [
      'Penggaris kaku / mistar kayu atau plastik panjang 50 cm (skala mm/cm jelas)',
      'Meja atau tumpuan lengan agar tangan atlet stabil'
    ],
    fieldSetup: 'Atlet duduk atau berdiri dengan lengan bawah dominan bertumpu di tepi meja. Ibu jari dan telunjuk membuka berjarak 4 cm tepat sejajar angka 0 cm di bagian bawah penggaris.',
    instructions: [
      'Pelatih memegang ujung atas penggaris (angka 50 cm) secara vertikal sehingga angka 0 cm berada tepat di antara ibu jari dan telunjuk atlet tanpa menyentuhnya.',
      'Tanpa aba-aba suara dan dengan jeda acak 1–4 detik, pelatih melepaskan penggaris.',
      'Atlet menjepit penggaris secepat mungkin hanya dengan merapatkan ibu jari dan telunjuk (lengan tidak boleh ikut turun mengejar penggaris).',
      'Catat angka cm tepat di batas atas ibu jari atlet untuk 3 percobaan sah.'
    ],
    validityRules: [
      'Tidak sah apabila atlet menebak/menjepit sebelum penggaris dilepas, jarak jari awal kurang dari 4 cm, atau tangan bergerak turun mengejar penggaris.',
      'Tidak sah apabila penggaris terlepas jatuh ke lantai (ulangi percobaan).',
      'Sistem otomatis menghitung estimasi waktu reaksi (ms) menggunakan rumus gravitasi: t = sqrt(2 * d / 980) * 1000.'
    ],
    finalResultMethod: 'Rata-rata jarak tangkap dari 3 percobaan sah (cm) beserta turunan waktu reaksi (ms)',
    formulaDescription: 'd_avg = (d1 + d2 + d3) / 3 (cm); t_ms = sqrt((2 * d_avg) / 980) * 1000',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan parameter konversi jarak tangkap (cm) / waktu reaksi (ms) per kelompok usia.'
  },

  // ===========================================================================
  // 7. FTB-UNI-PHY-08 — Lompatan
  // ===========================================================================
  {
    testId: 'TST-JMP-VER',
    testName: 'Sargent Vertical Jump (Wall Chalk Reach)',
    shortName: 'Vertical Jump',
    indicatorId: 'FTB-UNI-PHY-08',
    indicatorName: 'Lompatan',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Daya Ledak Vertikal Tungkai',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U9–Senior (9–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.VERTICAL_JUMP_DELTA,
    unit: 'cm',
    unitLabel: 'sentimeter (cm)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Tinggi Lompatan 1 (H2-1)', 'Tinggi Lompatan 2 (H2-2)'],
    auxiliaryFields: [
      {
        key: 'standingReachCm',
        label: 'Tinggi Raihan Berdiri (H1)',
        unit: 'cm',
        min: 100,
        max: 280,
        step: 0.5,
        required: true,
        helpText: 'Tinggi ujung jari tengah saat berdiri rata menyamping di dinding (cm).'
      }
    ],
    valueConstraints: { min: 105.0, max: 360.0, step: 0.5, decimals: 1 },
    restBetweenTrialsSec: 60,
    equipment: [
      'Dinding rata minimal tinggi 3.5 meter',
      'Meteran pita ditempel vertikal di dinding',
      'Kapur tulis bubuk atau ujung jari dibasahi air untuk menandai titik sentuh'
    ],
    fieldSetup: 'Atlet berdiri menyamping dekat dinding pada permukaan lantai datar dan tidak licin.',
    instructions: [
      'Ukur Tinggi Raihan Berdiri (H1): Atlet berdiri menyamping dinding, kedua telapak kaki rata di lantai, angkat satu tangan lurus ke atas sejauh mungkin dan catat titik ujung jari (H1 dalam cm).',
      'Percobaan Lompatan (H2): Dari posisi berdiri diam (tanpa langkah awalan), atlet menekuk lutut dan mengayunkan lengan (countermovement) lalu melompat vertikal setinggi mungkin dan menyentuh dinding pada titik puncak lompatan.',
      'Catat tinggi titik sentuh lompatan (H2) untuk 2 percobaan dengan istirahat 60 detik. Sistem otomatis menghitung selisih lompatan bersih: Delta H = max(H2) - H1.'
    ],
    validityRules: [
      'Tidak sah apabila atlet mengambil langkah awalan (step-in / run-up) sebelum melompat.',
      'Tinggi lompatan (H2) wajib lebih besar daripada Tinggi Raihan Berdiri (H1).'
    ],
    finalResultMethod: 'Selisih Lompatan Bersih Terbaik: Delta H = max(H2_1, H2_2) - H1 (cm)',
    formulaDescription: 'Final = max(H2_1, H2_2) - H1 dalam cm',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma tinggi lompatan vertikal bersih (cm) per kelompok usia (Tier 2–4).'
  },

  // ===========================================================================
  // 8. FTB-UNI-PHY-09 — Perubahan Arah
  // ===========================================================================
  {
    testId: 'TST-COD-505',
    testName: '505 Change of Direction (COD) Test',
    shortName: '505 COD Test',
    indicatorId: 'FTB-UNI-PHY-09',
    indicatorName: 'Perubahan Arah',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Deselerasi & Akselerasi Berbalik 180°',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U9–Senior (9–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.BILATERAL_AVERAGE,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 2,
    trialLabels: ['Putaran Kaki Kanan (5m Masuk + 5m Balik)', 'Putaran Kaki Kiri (5m Masuk + 5m Balik)'],
    trialSides: ['RIGHT', 'LEFT'],
    valueConstraints: { min: 1.5, max: 10.0, step: 0.01, decimals: 2 },
    restBetweenTrialsSec: 120,
    equipment: [
      'Meteran gulung',
      '6 kerucut (cone): Garis Awal (0m), Garis Timing (10m), dan Garis Putar Balik (15m)',
      'Stopwatch digital (0.01s)'
    ],
    fieldSetup: 'Tiga garis sejajar: Garis A (Start lari 0m), Garis B (Garis Timing pada jarak 10m), dan Garis C (Garis Putar Balik 180° pada jarak 15m). Pencatat waktu berdiri tepat di Garis B (10m).',
    instructions: [
      'Atlet berlari membangun kecepatan dari Garis A (0m) menuju Garis C (15m).',
      'Stopwatch DINYALAKAN saat tubuh atlet melewati Garis B (10m) menuju Garis C.',
      'Atlet wajib menginjak atau melewati Garis C (15m) dengan satu kaki tumpu, berbalik 180 derajat, dan sprint kembali melewati Garis B (10m) tempat stopwatch DIHENTIKAN.',
      'Lakukan 1 percobaan sah dengan tumpuan kaki Kanan dan 1 percobaan sah dengan tumpuan kaki Kiri (istirahat 2 menit).'
    ],
    validityRules: [
      'Tidak sah apabila kaki tumpu berbalik sebelum menyentuh/melewati Garis C (15m).',
      'Tidak sah apabila atlet terpeleset saat mengerem/berbalik atau melambat sebelum Garis B (10m) pada saat mulai.',
      'Kedua kaki tumpu (Kanan & Kiri) wajib dicatat.'
    ],
    finalResultMethod: 'Rata-rata waktu 505 kaki tumpu Kanan dan Kiri: (T_kanan + T_kiri) / 2',
    formulaDescription: 'Final = (T_right + T_left) / 2 dalam detik (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma waktu 505 COD (detik) per kelompok usia (Tier 2–4).'
  },

  // ===========================================================================
  // 9. FTB-UNI-PHY-10 — Daya Tahan
  // ===========================================================================
  {
    testId: 'TST-END-BLP',
    testName: '20m Multistage Fitness Test (Bleep Test)',
    shortName: 'Bleep Test 20m',
    indicatorId: 'FTB-UNI-PHY-10',
    indicatorName: 'Daya Tahan',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Kapasitas Aerobik (VO2max Proxy)',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U12–Senior (12–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.BLEEP_SHUTTLE_LEVEL,
    unit: 'm',
    unitLabel: 'meter (m) [Level.Shuttle]',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 1,
    minValidTrialsCount: 1,
    trialLabels: ['Hasil Akhir Bleep Test'],
    auxiliaryFields: [
      {
        key: 'levelReached',
        label: 'Level Terakhir yang Diselesaikan',
        unit: 'Level',
        min: 1,
        max: 21,
        step: 1,
        required: true,
        helpText: 'Level terakhir (1 s/d 21) yang berhasil dicapai atlet sebelum berhenti.'
      },
      {
        key: 'shuttleReached',
        label: 'Shuttle Terakhir pada Level Tersebut',
        unit: 'Shuttle',
        min: 1,
        max: 16,
        step: 1,
        required: true,
        helpText: 'Nomor balikan (shuttle) terakhir yang berhasil diselesaikan tepat saat bunyi beep.'
      }
    ],
    valueConstraints: { min: 20, max: 4940, step: 20, decimals: 0 },
    restBetweenTrialsSec: 0,
    equipment: [
      'Meteran gulung 20m',
      'Kerucut (cone) pembatas jalur lari bolak-balik 20 meter',
      'File audio standar 20m Bleep Test (Leger Protocol) dan speaker portable'
    ],
    fieldSetup: 'Dua garis sejajar berjarak tepat 20.0 meter di permukaan datar yang tidak licin.',
    instructions: [
      'Atlet berlari bolak-balik sejauh 20 meter mengikuti irama bunyi "beep" dari audio standar (kecepatan awal 8.5 km/jam dan meningkat 0.5 km/jam setiap naik level).',
      'Atlet wajib menginjak atau melewati garis 20m dengan satu kaki sebelum atau tepat saat bunyi beep, dan menunggu bunyi beep sebelum berbalik apabila tiba lebih cepat.',
      'Peringatan 1 diberikan jika atlet gagal mencapai garis 20m (kurang >2 meter) saat bunyi beep.',
      'Tes dihentikan bagi atlet apabila gagal mencapai garis tepat waktu pada 2 shuttle berturut-turut, atau berhenti sukarela. Catat Level dan Shuttle terakhir yang sah.'
    ],
    validityRules: [
      'Wajib dihentikan setelah 2 kali kegagalan mencapai garis 20m secara berturut-turut.',
      'Protokol keselamatan: Segera hentikan tes jika atlet menunjukkan tanda pusing ekstrem, pucat, mual, atau kehilangan koordinasi langkah.',
      'Sistem otomatis mengonversi pasangan (Level, Shuttle) menjadi Total Jarak Kumulatif dalam meter (20m x jumlah kumulatif shuttle).'
    ],
    finalResultMethod: 'Total Jarak Kumulatif (meter) dari konversi tabel standar Level & Shuttle terakhir yang sah',
    formulaDescription: 'Total_Meters = Total_Cumulative_Shuttles * 20 (m)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma total jarak Bleep Test (meter) untuk Tier 3 (U12–U15) dan Tier 4 (U16+).'
  },

  // ===========================================================================
  // 10. FTB-UNI-PHY-11 — Daya Ledak
  // ===========================================================================
  {
    testId: 'TST-PWR-SBJ',
    testName: 'Standing Broad Jump (Lompat Jauh Tanpa Awalan)',
    shortName: 'Standing Broad Jump',
    indicatorId: 'FTB-UNI-PHY-11',
    indicatorName: 'Daya Ledak',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Daya Ledak Horizontal Tungkai',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U12–Senior (12–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MAX,
    unit: 'cm',
    unitLabel: 'sentimeter (cm)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1', 'Percobaan 2'],
    valueConstraints: { min: 50.0, max: 350.0, step: 1.0, decimals: 1 },
    restBetweenTrialsSec: 60,
    equipment: [
      'Meteran pita minimal 3.5 meter ditempel di lantai/rumput datar',
      'Garis batas tolakan (lakban atau cone)'
    ],
    fieldSetup: 'Garis tolakan (0 cm) dengan meteran membentang lurus ke depan sepanjang 3.5 meter di atas permukaan datar yang tidak licin.',
    instructions: [
      'Atlet berdiri dengan ujung kedua sepatu tepat di belakang garis tolakan (0 cm), kaki dibuka selebar bahu.',
      'Dengan menekuk lutut dan mengayunkan kedua lengan, atlet melompat ke depan sejauh mungkin menggunakan tolakan dua kaki secara bersamaan.',
      'Atlet wajib mendarat dengan kedua kaki secara seimbang tanpa jatuh ke belakang atau menyentuhkan tangan ke tanah.',
      'Ukur jarak tegak lurus dari garis tolakan (0 cm) ke bagian tumit paling belakang saat mendarat.'
    ],
    validityRules: [
      'Tidak sah apabila ujung sepatu menginjak melewati garis tolakan (0 cm) saat lepas landas.',
      'Tidak sah apabila atlet terjatuh ke belakang, melangkah mundur, atau menumpukan tangan di belakang tumit saat mendarat.'
    ],
    finalResultMethod: 'Nilai Terbaik (Jarak Lompatan Terjauh / Maksimum dari 2 percobaan sah)',
    formulaDescription: 'Final = max(D1, D2) dalam cm',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma jarak Standing Broad Jump (cm) untuk Tier 3 dan Tier 4.'
  },

  // ===========================================================================
  // 11. FTB-UNI-PHY-12 — Kekuatan Tubuh
  // ===========================================================================
  {
    testId: 'TST-STR-PU1',
    testName: '60-Second Push-Up Endurance Test',
    shortName: 'Push-Up 60 Detik',
    indicatorId: 'FTB-UNI-PHY-12',
    indicatorName: 'Kekuatan Tubuh',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Kekuatan & Daya Tahan Otot Tubuh Atas',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U12–Senior (12–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.SINGLE_TRIAL_MAX,
    unit: 'reps',
    unitLabel: 'repetisi (reps)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 1,
    minValidTrialsCount: 1,
    trialLabels: ['Total Repetisi Sah (60 Detik)'],
    valueConstraints: { min: 1, max: 120, step: 1, decimals: 0 },
    restBetweenTrialsSec: 0,
    equipment: [
      'Stopwatch digital (timer 60 detik)',
      'Kerucut kecil (tinggi ~8–10 cm) atau kepalan tangan asisten tepat di bawah tulang dada (sternum) atlet sebagai target kedalaman',
      'Matras atau rumput datar'
    ],
    fieldSetup: 'Area datar dengan penanda kedalaman (cone pendek/kepalan tangan) di bawah dada atlet.',
    instructions: [
      'Atlet mengambil posisi plank tinggi: tangan selebar bahu, kepala-bahu-pinggul-tumit membentuk satu garis lurus.',
      'Saat timer 60 detik dimulai, atlet menurunkan tubuh hingga dada menyentuh target (siku membentuk sudut ≤90°), lalu mendorong kembali hingga kedua siku lurus penuh.',
      'Istirahat hanya diperbolehkan dalam posisi plank lurus di atas (lutut/perut tidak boleh menyentuh lantai).',
      'Hanya repetisi dengan rentang gerak penuh dan garis tubuh lurus yang dihitung.'
    ],
    validityRules: [
      'Repetisi TIDAK dihitung apabila dada tidak mencapai target kedalaman, siku tidak lurus penuh di atas, atau pinggul melengkung/terangkat.',
      'Tes langsung dihentikan sebelum 60 detik apabila lutut/perut/dada beristirahat di tanah atau atlet mengalami nyeri bahu/pergelangan tangan.'
    ],
    finalResultMethod: 'Total repetisi sah yang diselesaikan dalam waktu maksimal 60 detik',
    formulaDescription: 'Final = Valid_Reps (reps)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma jumlah repetisi Push-Up 60 detik untuk Tier 3 dan Tier 4.'
  },

  // ===========================================================================
  // 12. FTB-UNI-PHY-13 — Kekuatan Inti
  // ===========================================================================
  {
    testId: 'TST-COR-PLK',
    testName: 'Prone Forearm Plank Hold Test',
    shortName: 'Forearm Plank Hold',
    indicatorId: 'FTB-UNI-PHY-13',
    indicatorName: 'Kekuatan Inti',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Stabilitas Isometrik Otot Inti (Core)',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U12–Senior (12–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.SINGLE_TRIAL_MAX,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 1,
    minValidTrialsCount: 1,
    trialLabels: ['Durasi Tahan Plank Sah (Detik)'],
    valueConstraints: { min: 1, max: 240, step: 1, decimals: 0 },
    restBetweenTrialsSec: 0,
    equipment: [
      'Stopwatch digital',
      'Matras olahraga atau rumput datar'
    ],
    fieldSetup: 'Permukaan datar dengan matras untuk menopang kedua siku dan lengan bawah.',
    instructions: [
      'Atlet mengambil posisi prone forearm plank: kedua siku tepat berada vertikal di bawah bahu, lengan bawah sejajar, bertumpu pada ujung jari kaki.',
      'Kepala, punggung atas, pinggul, dan tumit membentuk garis lurus netral. Stopwatch dinyalakan saat posisi stabil.',
      'Jika pinggul turun (hip sag) atau terangkat tinggi (pike), pelatih memberikan maksimal 1 kali peringatan koreksi ("Luruskan pinggul") dalam waktu 2 detik.',
      'Stopwatch dihentikan saat atlet gagal mempertahankan postur netral pada pelanggaran kedua, menyentuhkan lutut/perut ke lantai, atau mencapai batas plafon 240 detik (4 menit).'
    ],
    validityRules: [
      'Maksimal 1 kali peringatan koreksi postur (≤2 detik); pelanggaran postur kedua langsung menghentikan waktu.',
      'Protokol keselamatan: Segera hentikan tes jika atlet mengeluhkan nyeri tajam pada punggung bawah (lumbar).',
      'Plafon durasi maksimal: 240 detik.'
    ],
    finalResultMethod: 'Total durasi tahan posisi plank yang sah dalam detik (maksimal 240 detik)',
    formulaDescription: 'Final = Hold_Duration (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma durasi Forearm Plank (detik) untuk Tier 3 dan Tier 4.'
  },

  // ===========================================================================
  // 13. FTB-UNI-PHY-14 — Sprint Berulang
  // ===========================================================================
  {
    testId: 'TST-RSA-630',
    testName: 'Bangsbo Repeated Sprint Ability (6 x 30m RSA)',
    shortName: '6x30m RSA Test',
    indicatorId: 'FTB-UNI-PHY-14',
    indicatorName: 'Sprint Berulang',
    sport: 'Sepak Bola',
    categoryId: 'physical',
    categoryLabel: 'Fisik',
    subcategory: 'Daya Tahan Kecepatan & Pemulihan Antar-Sprint',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_4_ELITE_PRO'],
    ageApplicability: 'U16–Senior (16+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.RSA_6X30M,
    unit: 's',
    unitLabel: 'detik (s) [+ FI %]',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 6,
    minValidTrialsCount: 6,
    trialLabels: [
      'Sprint 1 (30m)',
      'Sprint 2 (30m)',
      'Sprint 3 (30m)',
      'Sprint 4 (30m)',
      'Sprint 5 (30m)',
      'Sprint 6 (30m)'
    ],
    valueConstraints: { min: 3.0, max: 15.0, step: 0.01, decimals: 2 },
    restBetweenTrialsSec: 25,
    equipment: [
      'Meteran gulung 30m',
      'Kerucut (cone) untuk Gerbang A (0m) dan Gerbang B (30m)',
      '2 Stopwatch digital (Stopwatch 1 untuk waktu sprint S_i, Stopwatch 2 untuk siklus recovery 25 detik)',
      'Formulir/aplikasi pencatat 6 repetisi'
    ],
    fieldSetup: 'Lintasan lurus 30 meter dengan gerbang Start/Finish di kedua ujung (memungkinkan sprint bolak-balik dari ujung tempat mendarat setelah 25 detik recovery).',
    instructions: [
      'Atlet melakukan 6 kali sprint maksimal sejauh 30 meter dengan jeda pemulihan aktif tepat 25 detik di antara setiap sprint.',
      'Catat waktu masing-masing repetisi secara berurutan: S1, S2, S3, S4, S5, dan S6 (dalam detik, 2 desimal).',
      'Segera setelah melewati garis 30m, hitung mundur 25 detik dimulai; atlet melakukan pengereman dan bersiap di garis untuk sprint arah sebaliknya tepat saat 25 detik habis.',
      'Sistem otomatis menghitung Total Sprint Time (S_total = jumlah S1..S6), Waktu Sprint Terbaik (S_best), dan Fatigue Index (FI% = ((S_total / (6 * S_best)) - 1) * 100%).'
    ],
    validityRules: [
      'Keenam repetisi (S1 s/d S6) WAJIB diselesaikan dan dicatat lengkap; jika kurang dari 6 repetisi maka hasil tes RSA tidak sah.',
      'Tidak sah apabila atlet sengaja menahan kecepatan pada Sprint 1 (pacing): waktu S1 tidak boleh lebih lambat >10% dari waktu sprint 30m tunggal atlet.',
      'Tidak sah apabila atlet terlambat memulai sprint berikutnya melebihi batas recovery 25 detik.'
    ],
    finalResultMethod: 'Total Sprint Time (S_total = Σ S1..S6 dalam detik) dengan metrik pendamping wajib Fatigue Index (FI %)',
    formulaDescription: 'S_total = sum(S1..S6); S_best = min(S1..S6); FI% = ((S_total / (6 * S_best)) - 1) * 100',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan parameter batas S_total dan Fatigue Index (%) khusus atlet Tier 4 (U16+).'
  },

  // ===========================================================================
  // 14. FTB-UNI-TEC-07 — Kekuatan Tembakan
  // ===========================================================================
  {
    testId: 'TST-SHT-DST',
    testName: 'Maximal Instep Drive Carry Distance (Proxy Lapangan)',
    shortName: 'Max Ball Carry Distance',
    indicatorId: 'FTB-UNI-TEC-07',
    indicatorName: 'Kekuatan Tembakan',
    sport: 'Sepak Bola',
    categoryId: 'technical',
    categoryLabel: 'Teknik',
    subcategory: 'Impuls Tendangan & Transfer Momentum Kaki-Bola',
    applicablePosition: 'UNIVERSAL',
    applicablePositionLabel: 'Universal (Semua Posisi)',
    applicableTiers: ['TIER_2_FOUNDATION', 'TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U9–Senior (9–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MAX,
    unit: 'm',
    unitLabel: 'meter (m)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1 (Titik Jatuh Pertama)', 'Percobaan 2 (Titik Jatuh Pertama)'],
    valueConstraints: { min: 3.0, max: 85.0, step: 0.5, decimals: 1 },
    restBetweenTrialsSec: 60,
    equipment: [
      'Bola sepak sesuai standar usia (Size 4 untuk U9–U12, Size 5 untuk U13+) dengan tekanan standar',
      'Meteran gulung 50–100m dan kerucut penanda koridor setiap 5 meter'
    ],
    fieldSetup: 'Koridor lapangan lurus selebar 10 meter dengan garis tendang (0m) dan penanda jarak setiap 5m di sisi koridor.',
    instructions: [
      'Bola diletakkan diam di titik tengah garis tendang (0m).',
      'Atlet mengambil awalan bebas (maksimal 4–5 langkah) dan menendang bola sekuat mungkin ke arah koridor depan.',
      'Asisten pelatih mengamati dan menandai titik jatuh pertama bola di tanah (first bounce / carry distance, BUKAN jarak gelinding bola).',
      'Ukur jarak lurus dari garis 0m ke titik jatuh pertama bola dalam meter (ketelitian 0.5m) untuk 2 percobaan sah.'
    ],
    validityRules: [
      'Tidak sah apabila titik jatuh pertama bola keluar dari lebar koridor 10 meter atau tendangan menyusur tanah (grounder) karena salah perkenaan.',
      'Hanya diizinkan dilakukan pada kondisi tidak berangin kencang.',
      'PERINGATAN VALIDITAS KONSTRUK (NEEDS_FURTHER_DESIGN): Jarak lambung bola adalah proxy tidak langsung yang dipengaruhi sudut peluncuran (~35–42°), backspin, dan angin, sehingga berbeda dari kecepatan bola tembakan datar (ball exit velocity km/jam).'
    ],
    finalResultMethod: 'Nilai Terbaik (Jarak Jatuh Pertama Terjauh / Maksimum dari 2 percobaan sah dalam koridor 10m)',
    formulaDescription: 'Final = max(D1, D2) dalam meter (m)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'NEEDS_FURTHER_DESIGN',
    methodologicalNote: 'Proxy tidak langsung (Indirect Aerodynamic Proxy). Mengukur gabungan impuls kaki-bola dan sudut angkat, bukan kecepatan bola murni (radar gun).',
    normRequirement: 'Membutuhkan standarisasi ukuran bola per usia dan kalibrasi terpisah dari pengukuran radar kecepatan tembakan.'
  },

  // ===========================================================================
  // 15. FTB-SSB-OUT-02 — Koordinasi Mata-Kaki
  // ===========================================================================
  {
    testId: 'TST-SSB-WAP',
    testName: '30-Second Alternating Wall Pass Control Test',
    shortName: 'Wall Pass 30 Detik',
    indicatorId: 'FTB-SSB-OUT-02',
    indicatorName: 'Koordinasi Mata-Kaki',
    sport: 'Sepak Bola',
    categoryId: 'position_specific',
    categoryLabel: 'Khusus Posisi',
    subcategory: 'Fundamental Koordinasi Outfield Grassroots (SSB)',
    applicablePosition: 'OUTFIELD_SSB',
    applicablePositionLabel: 'Pemain Lapangan SSB (Outfield U6–U11)',
    applicableTiers: ['TIER_1_GRASSROOTS'],
    ageApplicability: 'U6–U8 (Grassroots / SSB Awal)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MAX,
    unit: 'reps',
    unitLabel: 'pantulan sah (reps)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1 (30 Detik)', 'Percobaan 2 (30 Detik)'],
    valueConstraints: { min: 1, max: 60, step: 1, decimals: 0 },
    restBetweenTrialsSec: 60,
    equipment: [
      'Bola sepak Size 3 atau Size 4 (sesuai usia Grassroots) + 1 bola cadangan di sisi kotak',
      'Dinding rata atau papan pantul (rebounder) lebar minimal 2 meter',
      '4 kerucut pembentuk kotak kontrol 1.5m x 1.5m pada jarak 2.0 meter dari dinding',
      'Stopwatch digital (timer 30 detik)'
    ],
    fieldSetup: 'Garis batas tendang berjarak 2.0 meter dari dinding dengan zona kotak berdiri 1.5m x 1.5m.',
    instructions: [
      'Atlet berdiri di dalam kotak kontrol (2.0 meter dari dinding) bersama bola.',
      'Saat timer 30 detik dimulai, atlet menendang bola ke dinding dan mengontrol/memantulkannya kembali dari belakang garis 2.0 meter.',
      'Atlet boleh menggunakan 1 atau 2 sentuhan dan dianjurkan bergantian kaki kanan/kiri.',
      'Hitung jumlah pantulan dinding sah yang berhasil dilakukan dari dalam kotak kontrol selama 30 detik (2 percobaan).'
    ],
    validityRules: [
      'Pantulan TIDAK dihitung apabila bola ditendang saat kaki melewati garis batas 2.0 meter ke arah dinding.',
      'Pantulan tidak dihitung apabila bola keluar jauh dari kotak kontrol atau disentuh dengan tangan.'
    ],
    finalResultMethod: 'Nilai Terbaik (Jumlah Pantulan Sah Terbanyak dari 2 percobaan 30 detik)',
    formulaDescription: 'Final = max(R1, R2) dalam repetisi (reps)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma jumlah pantulan 30 detik untuk kelompok usia Grassroots Tier 1 (U6–U8).'
  },

  // ===========================================================================
  // 16. FTB-SSB-GK-02 — Koordinasi Tangan-Mata
  // ===========================================================================
  {
    testId: 'TST-SSB-GK-02',
    testName: '30-Second Wall Toss & Catch Test (GK Grassroots)',
    shortName: 'Wall Toss & Catch 30s',
    indicatorId: 'FTB-SSB-GK-02',
    indicatorName: 'Koordinasi Tangan-Mata',
    sport: 'Sepak Bola',
    categoryId: 'position_specific',
    categoryLabel: 'Khusus Posisi',
    subcategory: 'Fundamental Penjaga Gawang Grassroots (SSB)',
    applicablePosition: 'GK_SSB',
    applicablePositionLabel: 'Penjaga Gawang SSB (GK Grassroots)',
    applicableTiers: ['TIER_1_GRASSROOTS'],
    ageApplicability: 'U6–U8 (Grassroots / SSB Awal)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MAX,
    unit: 'reps',
    unitLabel: 'tangkapan sah (reps)',
    direction: 'HIGHER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1 (30 Detik)', 'Percobaan 2 (30 Detik)'],
    valueConstraints: { min: 1, max: 60, step: 1, decimals: 0 },
    restBetweenTrialsSec: 60,
    equipment: [
      'Bola sepak Size 3 atau Size 4',
      'Dinding rata',
      'Garis batas berdiri berjarak 1.5 meter dari dinding',
      'Stopwatch digital (timer 30 detik)'
    ],
    fieldSetup: 'Garis batas berdiri ditandai sejajar sejauh 1.5 meter di depan dinding rata.',
    instructions: [
      'Kiper berdiri di belakang garis 1.5 meter menghadap dinding sambil memegang bola.',
      'Saat timer 30 detik dimulai, kiper melempar bola ke dinding setinggi dada/kepala dan menangkap pantulannya secara bersih dengan kedua tangan ("W" atau "Basket catch").',
      'Ulangi terus-menerus selama 30 detik. Lakukan 2 percobaan dengan istirahat 60 detik.'
    ],
    validityRules: [
      'Tangkapan TIDAK dihitung apabila bola terlepas jatuh ke tanah, kiper menginjak melewati garis 1.5 meter, atau bola hanya ditepis tanpa tertangkap terkontrol.'
    ],
    finalResultMethod: 'Nilai Terbaik (Jumlah Tangkapan Bersih Terbanyak dari 2 percobaan 30 detik)',
    formulaDescription: 'Final = max(C1, C2) dalam tangkapan sah (reps)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma tangkapan 30 detik untuk kiper Grassroots Tier 1 (U6–U8).'
  },

  // ===========================================================================
  // 17. FTB-SSB-GK-03 — Ketangkasan Gerak Dasar
  // ===========================================================================
  {
    testId: 'TST-SSB-GK-03',
    testName: 'GK Lateral Cone Touch & Floor Get-Up Agility Test',
    shortName: 'GK Lateral & Get-Up',
    indicatorId: 'FTB-SSB-GK-03',
    indicatorName: 'Ketangkasan Gerak Dasar',
    sport: 'Sepak Bola',
    categoryId: 'position_specific',
    categoryLabel: 'Khusus Posisi',
    subcategory: 'Footwork Lateral & Bangkit Cepat Kiper Grassroots',
    applicablePosition: 'GK_SSB',
    applicablePositionLabel: 'Penjaga Gawang SSB (GK Grassroots)',
    applicableTiers: ['TIER_1_GRASSROOTS'],
    ageApplicability: 'U6–U8 (Grassroots / SSB Awal)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MIN,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1', 'Percobaan 2'],
    valueConstraints: { min: 2.0, max: 25.0, step: 0.01, decimals: 2 },
    restBetweenTrialsSec: 90,
    equipment: [
      '3 kerucut (cone): Cone Tengah (0m), Cone Kiri (2m), dan Cone Kanan (2m)',
      'Meteran gulung',
      'Stopwatch digital (0.01s)'
    ],
    fieldSetup: 'Tiga cone sejajar di garis gawang: Cone Tengah di titik 0m, Cone Kiri berjarak 2.0m di kiri, dan Cone Kanan berjarak 2.0m di kanan (total bentang 4.0 meter).',
    instructions: [
      'Kiper memulai tes dalam posisi duduk bersila atau telungkup dada menyentuh rumput tepat di belakang Cone Tengah.',
      'Saat aba-aba "Ya", stopwatch dinyalakan: kiper bangkit berdiri secepat mungkin -> bergerak menyamping (side-shuffle menghadap depan) ke Kanan dan menyentuh puncak Cone Kanan dengan tangan -> side-shuffle melintasi 4m ke Kiri dan menyentuh puncak Cone Kiri -> kembali melewati garis Cone Tengah.',
      'Stopwatch dihentikan tepat saat dada kiper kembali melewati garis Cone Tengah. Lakukan 2 percobaan (istirahat 90 detik).'
    ],
    validityRules: [
      'Tidak sah apabila puncak Cone Kanan atau Cone Kiri tidak tersentuh tangan.',
      'Tidak sah apabila kiper berlari memutar badan (harus tetap menghadap ke depan / side-shuffle).'
    ],
    finalResultMethod: 'Nilai Terbaik (Waktu Tercepat / Minimum dari 2 percobaan sah)',
    formulaDescription: 'Final = min(T1, T2) dalam detik (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma waktu ketangkasan kiper Grassroots Tier 1 (U6–U8).'
  },

  // ===========================================================================
  // 18. FTB-POS-WF-01 — Akselerasi Sayap
  // ===========================================================================
  {
    testId: 'TST-WF-TLA',
    testName: '20m Wing Touchline Curvilinear Acceleration Test',
    shortName: 'Wing Acceleration 20m',
    indicatorId: 'FTB-POS-WF-01',
    indicatorName: 'Akselerasi Sayap',
    sport: 'Sepak Bola',
    categoryId: 'position_specific',
    categoryLabel: 'Khusus Posisi',
    subcategory: 'Eksplosivitas Koridor Sayap (Wing Forward)',
    applicablePosition: 'WFR/WFL',
    applicablePositionLabel: 'Penyerang Sayap (WFR / WFL)',
    applicableTiers: ['TIER_3_YOUTH_DEV', 'TIER_4_ELITE_PRO'],
    ageApplicability: 'U12–Senior (12–17+ Tahun)',
    inputSchemaType: TEST_INPUT_SCHEMA_TYPES.MULTI_TRIAL_BEST_MIN,
    unit: 's',
    unitLabel: 'detik (s)',
    direction: 'LOWER_IS_BETTER',
    requiredTrialsCount: 2,
    minValidTrialsCount: 1,
    trialLabels: ['Percobaan 1 (Sisi Sayap Dominan)', 'Percobaan 2 (Sisi Sayap Dominan)'],
    valueConstraints: { min: 2.0, max: 12.0, step: 0.01, decimals: 2 },
    restBetweenTrialsSec: 120,
    equipment: [
      'Meteran gulung 20m',
      '6 kerucut (cone): Garis Start menghadap dalam, Cone Belok pada jarak 5m (sudut 45° ke koridor tepi), dan Gerbang Finish pada jarak 20m sejajar garis tepi (touchline)',
      'Stopwatch digital (0.01s)'
    ],
    fieldSetup: 'Simulasi koridor sayap: Titik Start (0m) berjarak 3m di dalam garis tepi lapangan. Cone A (5m) berada di koridor tepi membentuk sudut buka 45°, dilanjutkan jalur lurus 15m menyusuri koridor garis tepi hingga Garis Finish (total 20m).',
    instructions: [
      'Atlet berdiri di Titik Start dalam posisi badan terbuka (half-turn / menerima umpan terobosan di sisi sayap).',
      'Saat kaki belakang bergerak (atau aba-aba bendera), atlet melakukan akselerasi eksplosif 5m pertama membuka ke Cone A di koridor garis tepi, lalu melanjutkan sprint lurus 15m menyusuri touchline melewati Garis Finish (20m).',
      'Lakukan 2 percobaan pada koridor sayap posisi atlet (WFR atau WFL) dengan istirahat 2 menit.'
    ],
    validityRules: [
      'Tidak sah apabila terjadi rolling start, memotong di bagian dalam Cone A, atau keluar melewati garis tepi lapangan (out of bounds).'
    ],
    finalResultMethod: 'Nilai Terbaik (Waktu Tercepat / Minimum dari 2 percobaan sah)',
    formulaDescription: 'Final = min(T1, T2) dalam detik (s)',
    calibrationStatus: 'PENDING_CALIBRATION',
    mappingReadiness: 'READY_FOR_CALIBRATION',
    normRequirement: 'Membutuhkan norma waktu akselerasi sayap 20m untuk posisi WFR/WFL pada Tier 3 dan Tier 4.'
  }
];

/**
 * Lookup Map berdasarkan testId dan indicatorId
 */
export const TEST_CATALOG_BY_ID = Object.freeze(
  FOOTBALL_TEST_BATTERY_CATALOG.reduce((acc, test) => {
    acc[test.testId] = test;
    return acc;
  }, {})
);

export const TEST_CATALOG_BY_INDICATOR_ID = Object.freeze(
  FOOTBALL_TEST_BATTERY_CATALOG.reduce((acc, test) => {
    acc[test.indicatorId] = test;
    return acc;
  }, {})
);

/**
 * Ambil definisi tes berdasarkan Test ID
 */
export function getTestDefinitionById(testId) {
  if (!testId) return null;
  return TEST_CATALOG_BY_ID[testId] || null;
}

/**
 * Ambil definisi tes berdasarkan Canonical Indicator ID
 */
export function getTestDefinitionByIndicatorId(indicatorId) {
  if (!indicatorId) return null;
  return TEST_CATALOG_BY_INDICATOR_ID[indicatorId] || null;
}

const TIER_NUMBER_TO_KEY = {
  1: 'TIER_1_GRASSROOTS',
  2: 'TIER_2_FOUNDATION',
  3: 'TIER_3_YOUTH_DEV',
  4: 'TIER_4_ELITE_PRO',
  '1': 'TIER_1_GRASSROOTS',
  '2': 'TIER_2_FOUNDATION',
  '3': 'TIER_3_YOUTH_DEV',
  '4': 'TIER_4_ELITE_PRO'
};

export function normalizeTierIdentifier(tierInput) {
  if (!tierInput) return 'TIER_2_FOUNDATION';
  if (TIER_NUMBER_TO_KEY[tierInput]) return TIER_NUMBER_TO_KEY[tierInput];
  const str = String(tierInput).toUpperCase().trim();
  if (str.includes('1') || str.includes('GRASSROOTS') || str.includes('JOY')) return 'TIER_1_GRASSROOTS';
  if (str.includes('2') || str.includes('FOUNDATION') || str.includes('SKILL')) return 'TIER_2_FOUNDATION';
  if (str.includes('3') || str.includes('YOUTH') || str.includes('TACTICAL')) return 'TIER_3_YOUTH_DEV';
  if (str.includes('4') || str.includes('ELITE') || str.includes('PERFORMANCE')) return 'TIER_4_ELITE_PRO';
  return 'TIER_2_FOUNDATION';
}

/**
 * Mengecek apakah posisi atlet cocok dengan applicablePosition pada tes
 * @param {Object} testDef - Definisi tes dari katalog
 * @param {string|number} tierKey - mis. 1..4 atau 'TIER_1_GRASSROOTS', 'TIER_3_YOUTH_DEV', dll.
 * @param {string} athletePositionCode - mis. 'GK', 'CB', 'WFR', 'WFL', 'WFR/WFL', 'OUTFIELD_SSB', 'GK_SSB', 'ST', dll.
 */
export function isTestApplicableToAthlete(testDef, tierKey, athletePositionCode) {
  if (!testDef) return { isApplicable: false, reason: 'Definisi tes tidak ditemukan' };

  const normalizedTier = normalizeTierIdentifier(tierKey);
  const tierMatch = testDef.applicableTiers.includes(normalizedTier);

  const pos = (athletePositionCode || '').toUpperCase().trim();
  let positionMatch = true;

  if (testDef.applicablePosition === 'UNIVERSAL') {
    positionMatch = true;
  } else if (testDef.applicablePosition === 'OUTFIELD_SSB') {
    positionMatch = pos !== 'GK' && pos !== 'GK_SSB';
  } else if (testDef.applicablePosition === 'GK_SSB') {
    positionMatch = pos === 'GK' || pos === 'GK_SSB';
  } else if (testDef.applicablePosition === 'WFR/WFL') {
    positionMatch =
      pos === 'WFR' ||
      pos === 'WFL' ||
      pos === 'WFR/WFL' ||
      pos === 'LW' ||
      pos === 'RW' ||
      pos === 'WF';
  }

  if (tierMatch && positionMatch) {
    return {
      isApplicable: true,
      tierMatch: true,
      positionMatch: true,
      reason: 'Sesuai dengan jenjang pengembangan (Tier) dan posisi atlet.'
    };
  }

  const reasons = [];
  if (!tierMatch) {
    const tierLabels = testDef.applicableTiers
      .map((t) => DEVELOPMENT_TIERS[t]?.name || t)
      .join(', ');
    reasons.push(`Dirancang untuk jenjang: ${tierLabels}`);
  }
  if (!positionMatch) {
    reasons.push(`Dirancang khusus untuk posisi: ${testDef.applicablePositionLabel}`);
  }

  return {
    isApplicable: false,
    tierMatch,
    positionMatch,
    reason: reasons.join(' • ')
  };
}

/**
 * Mengembalikan daftar tes beserta status relevansinya terhadap Tier & Posisi atlet
 */
export function getTestsWithAthleteApplicability(tierKey = 'TIER_2_FOUNDATION', athletePositionCode = 'CM') {
  return FOOTBALL_TEST_BATTERY_CATALOG.map((testDef) => {
    const applicability = isTestApplicableToAthlete(testDef, tierKey, athletePositionCode);
    return {
      ...testDef,
      applicability
    };
  });
}

/**
 * Verifikasi integritas lintas-registry bahwa 18 tes sesuai dengan canonical ID
 * yang didefinisikan pada footballAssessmentData.js
 */
export function verifyCatalogAgainstIndicatorRegistry() {
  const allRegistryIndicators = new Map();

  Object.entries(FOOTBALL_CORE_CATEGORIES).forEach(([catKey, catObj]) => {
    if (Array.isArray(catObj?.indicators)) {
      catObj.indicators.forEach((ind) => {
        allRegistryIndicators.set(ind.id, { ...ind, registryCategory: catKey });
      });
    }
  });

  if (Array.isArray(FOOTBALL_POSITIONS)) {
    FOOTBALL_POSITIONS.forEach((posObj) => {
      if (Array.isArray(posObj?.indicators)) {
        posObj.indicators.forEach((ind) => {
          allRegistryIndicators.set(ind.id, {
            ...ind,
            registryCategory: 'position_specific',
            positionKey: posObj.code
          });
        });
      }
    });
  }

  if (Array.isArray(TIER_1_POSITIONS)) {
    TIER_1_POSITIONS.forEach((ssbObj) => {
      if (Array.isArray(ssbObj?.indicators)) {
        ssbObj.indicators.forEach((ind) => {
          allRegistryIndicators.set(ind.id, {
            ...ind,
            registryCategory: 'position_specific',
            ssbGroup: ssbObj.code
          });
        });
      }
    });
  }

  const mismatches = [];
  FOOTBALL_TEST_BATTERY_CATALOG.forEach((test) => {
    const reg = allRegistryIndicators.get(test.indicatorId);
    if (!reg) {
      mismatches.push(`Indikator ${test.indicatorId} (${test.testId}) tidak ditemukan di registry.`);
    } else if (reg.type !== 'OBJECTIVE_TEST') {
      mismatches.push(`Indikator ${test.indicatorId} bukan bertipe OBJECTIVE_TEST (tipe aktual: ${reg.type}).`);
    }
  });

  return {
    totalCatalogTests: FOOTBALL_TEST_BATTERY_CATALOG.length,
    isValid: mismatches.length === 0 && FOOTBALL_TEST_BATTERY_CATALOG.length === 18,
    mismatches
  };
}

export { TIER_CONFIGS, FOOTBALL_POSITIONS, TIER_1_POSITIONS, TIER_2_POSITIONS, detectTierFromAge };
