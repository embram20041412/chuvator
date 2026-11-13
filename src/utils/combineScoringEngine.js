// =========================================================================
// CHUVATOR — SCOUTING COMBINE & ASSESSMENT SCORING ENGINE (SEPAKBOLA)
// Piecewise Linear Interpolation across 4 Football Age Tiers (U6-U9 .. U17+)
// Zero PENDING_CALIBRATION: every field input converts instantaneously to 1-100.
// =========================================================================

export const FOOTBALL_COMBINE_TIERS = {
  1: {
    tier: 1,
    code: 'TIER_1',
    ageRange: 'U6–U9 (6–9 Thn)',
    label: 'Tier 1: U6–U9 (Joy Phase)',
    shortLabel: 'Tier 1 · U6–U9'
  },
  2: {
    tier: 2,
    code: 'TIER_2',
    ageRange: 'U10–U12 (10–12 Thn)',
    label: 'Tier 2: U10–U12 (Skill Phase)',
    shortLabel: 'Tier 2 · U10–U12'
  },
  3: {
    tier: 3,
    code: 'TIER_3',
    ageRange: 'U13–U16 (13–16 Thn)',
    label: 'Tier 3: U13–U16 (Tactical Phase)',
    shortLabel: 'Tier 3 · U13–U16'
  },
  4: {
    tier: 4,
    code: 'TIER_4',
    ageRange: 'U17+ (17+ Thn)',
    label: 'Tier 4: U17+ (Performance Phase)',
    shortLabel: 'Tier 4 · U17+'
  }
};

// Target scores mapped to the 4 benchmark anchor points
export const BENCHMARK_SCORE_ANCHORS = {
  poor: 25,
  fair: 55,
  good: 80,
  elite: 96
};

// Anchored 1-5 Rubric level to 1-100 score mapping
export const RUBRIC_LEVEL_SCORE_MAP = {
  1: 35,
  2: 52,
  3: 70,
  4: 84,
  5: 95
};

/**
 * Master catalog of Football Combine Battery Tests & Rubrics.
 * IDs match `public.assessment_tests_catalog` SQL seed rows.
 */
export const COMBINE_TEST_CATALOG = [
  // ======================== TEKNIK ========================
  {
    id: '11111111-1111-4111-8111-000000000001',
    sport_type: 'football',
    category: 'Teknik',
    indicator_key: 'finishing',
    indicator_label: 'Finishing',
    test_name: 'Finishing Target Test',
    measurement_type: 'ACCURACY',
    unit: 'gol/percobaan',
    defaultTotal: 10,
    inputLabel1: 'Tembakan Gol / Sukses',
    inputLabel2: 'Total Percobaan',
    description: 'Tembakan terarah ke sudut gawang dari tepi kotak penalti (standar 10 percobaan).',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    sport_type: 'football',
    category: 'Teknik',
    indicator_key: 'passing_pendek',
    indicator_label: 'Passing Pendek',
    test_name: 'Short Passing Gate Accuracy',
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    defaultTotal: 12,
    inputLabel1: 'Umpan Lolos Gerbang',
    inputLabel2: 'Total Percobaan',
    description: 'Umpan mendatar melewati gerbang cone selebar 1.5m pada jarak 10 meter.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    sport_type: 'football',
    category: 'Teknik',
    indicator_key: 'dribbling',
    indicator_label: 'Dribbling',
    test_name: 'Slalom Cone Dribbling',
    measurement_type: 'TIME',
    unit: 'detik',
    errorPenaltySeconds: 0.25,
    inputLabel1: 'Percobaan 1 (detik)',
    inputLabel2: 'Percobaan 2 (opsional)',
    description: 'Menggiring bola melewati 6 cone berjarak 2m secepat mungkin (+0.25d per cone jatuh).',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    sport_type: 'football',
    category: 'Teknik',
    indicator_key: 'kontrol_bola',
    indicator_label: 'Kontrol Bola',
    test_name: 'Wall First-Touch & Control (30s)',
    measurement_type: 'REPS',
    unit: 'repetisi',
    inputLabel1: 'Jumlah Pantulan Bersih',
    inputLabel2: 'Percobaan 2 (opsional)',
    description: 'Jumlah pantulan umpan & kontrol bersih ke dinding dalam durasi 30 detik.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    sport_type: 'football',
    category: 'Teknik',
    indicator_key: 'passing_jauh',
    indicator_label: 'Passing Jauh',
    test_name: 'Long Pass Target Zone',
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    defaultTotal: 8,
    inputLabel1: 'Umpan Masuk Zona',
    inputLabel2: 'Total Percobaan',
    description: 'Umpan lambung terukur ke zona target 5x5m pada jarak 25–35 meter.',
    min_tier: 2
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    sport_type: 'football',
    category: 'Teknik',
    indicator_key: 'crossing',
    indicator_label: 'Crossing',
    test_name: 'Flank Crossing Accuracy',
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    defaultTotal: 8,
    inputLabel1: 'Crossing Tepat Sasaran',
    inputLabel2: 'Total Percobaan',
    description: 'Umpan silang dari sisi sayap menuju zona penalti (tiang dekat/jauh).',
    min_tier: 3
  },

  // ======================== FISIK ========================
  {
    id: '11111111-1111-4111-8111-000000000101',
    sport_type: 'football',
    category: 'Fisik',
    indicator_key: 'akselerasi',
    indicator_label: 'Akselerasi',
    test_name: '10m Sprint Acceleration',
    measurement_type: 'TIME',
    unit: 'detik',
    errorPenaltySeconds: 0,
    inputLabel1: 'Waktu 1 (detik)',
    inputLabel2: 'Waktu 2 (opsional)',
    description: 'Catatan waktu lari ledak jarak 10 meter dari posisi start diam (diambil waktu terbaik).',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000102',
    sport_type: 'football',
    category: 'Fisik',
    indicator_key: 'kelincahan',
    indicator_label: 'Kelincahan',
    test_name: 'T-Test / Illinois Agility Run',
    measurement_type: 'TIME',
    unit: 'detik',
    errorPenaltySeconds: 0.25,
    inputLabel1: 'Waktu 1 (detik)',
    inputLabel2: 'Waktu 2 (opsional)',
    description: 'Tes kelincahan perubahan arah lari maju, geser samping, dan mundur.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000103',
    sport_type: 'football',
    category: 'Fisik',
    indicator_key: 'kecepatan_maksimal',
    indicator_label: 'Kecepatan Maksimal',
    test_name: '30m Top Speed Sprint',
    measurement_type: 'TIME',
    unit: 'detik',
    errorPenaltySeconds: 0,
    inputLabel1: 'Waktu 1 (detik)',
    inputLabel2: 'Waktu 2 (opsional)',
    description: 'Sprint jarak 30 meter mengukur kecepatan maksimal atlet di ruang terbuka.',
    min_tier: 2
  },
  {
    id: '11111111-1111-4111-8111-000000000104',
    sport_type: 'football',
    category: 'Fisik',
    indicator_key: 'daya_ledak',
    indicator_label: 'Daya Ledak',
    test_name: '30s Plyometric Jump Reps',
    measurement_type: 'REPS',
    unit: 'repetisi',
    inputLabel1: 'Total Lompatan Valid',
    inputLabel2: 'Percobaan 2 (opsional)',
    description: 'Jumlah lompatan eksplosif maksimal dalam 30 detik dengan pendaratan seimbang.',
    min_tier: 3
  },
  {
    id: '11111111-1111-4111-8111-000000000105',
    sport_type: 'football',
    category: 'Fisik',
    indicator_key: 'daya_tahan',
    indicator_label: 'Daya Tahan',
    test_name: '20m Shuttle Endurance Run',
    measurement_type: 'REPS',
    unit: 'shuttle',
    inputLabel1: 'Total Shuttle Selesai',
    inputLabel2: 'Target / Cadangan (opsional)',
    description: 'Total shuttle lari bolak-balik 20 meter yang berhasil diselesaikan mengikuti tempo.',
    min_tier: 3
  },

  // ======================== TAKTIK (RUBRIC) ========================
  {
    id: '11111111-1111-4111-8111-000000000201',
    sport_type: 'football',
    category: 'Taktik',
    indicator_key: 'posisi_bertahan',
    indicator_label: 'Posisi Bertahan',
    test_name: 'Rubrik Posisi Bertahan',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Menjaga jarak dengan lawan, menutup jalur umpan, dan posisi aman saat tanpa bola.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000202',
    sport_type: 'football',
    category: 'Taktik',
    indicator_key: 'posisi_menyerang',
    indicator_label: 'Posisi Menyerang',
    test_name: 'Rubrik Posisi Menyerang',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Mencari ruang kosong dan membentuk segitiga umpan saat tim menguasai bola.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000203',
    sport_type: 'football',
    category: 'Taktik',
    indicator_key: 'membuka_ruang',
    indicator_label: 'Membuka Ruang',
    test_name: 'Rubrik Membuka Ruang',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Pergerakan tanpa bola untuk menarik penjagaan lawan dan membuka jalur progresi.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000204',
    sport_type: 'football',
    category: 'Taktik',
    indicator_key: 'pengambilan_keputusan',
    indicator_label: 'Pengambilan Keputusan',
    test_name: 'Rubrik Pengambilan Keputusan',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Ketepatan memilih opsi umpan, dribel, atau tembakan sesuai situasi permainan.',
    min_tier: 2
  },
  {
    id: '11111111-1111-4111-8111-000000000205',
    sport_type: 'football',
    category: 'Taktik',
    indicator_key: 'pressing',
    indicator_label: 'Pressing',
    test_name: 'Rubrik Pressing & Transisi',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Kecepatan reaksi menekan lawan saat kehilangan bola dan menjaga kerapatan blok.',
    min_tier: 3
  },

  // ======================== MENTAL (RUBRIC) ========================
  {
    id: '11111111-1111-4111-8111-000000000301',
    sport_type: 'football',
    category: 'Mental',
    indicator_key: 'fokus',
    indicator_label: 'Fokus',
    test_name: 'Rubrik Fokus & Konsentrasi',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Konsistensi konsentrasi atlet sepanjang latihan dan momen transisi bola mati.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000302',
    sport_type: 'football',
    category: 'Mental',
    indicator_key: 'percaya_diri',
    indicator_label: 'Percaya Diri',
    test_name: 'Rubrik Kepercayaan Diri',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Keberanian menerima bola, mengambil inisiatif 1v1, dan tampil tenang di lapangan.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000303',
    sport_type: 'football',
    category: 'Mental',
    indicator_key: 'daya_juang',
    indicator_label: 'Daya Juang',
    test_name: 'Rubrik Daya Juang & Resiliensi',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Kecepatan bangkit setelah melakukan kesalahan dan etos mengejar bola hingga akhir.',
    min_tier: 2
  },
  {
    id: '11111111-1111-4111-8111-000000000304',
    sport_type: 'football',
    category: 'Mental',
    indicator_key: 'tahan_tekanan',
    indicator_label: 'Tahan Tekanan',
    test_name: 'Rubrik Ketahanan Tekanan',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Ketenangan menjaga kualitas keputusan saat berada di bawah pressing ketat lawan.',
    min_tier: 3
  },

  // ======================== KOMUNIKASI (RUBRIC) ========================
  {
    id: '11111111-1111-4111-8111-000000000401',
    sport_type: 'football',
    category: 'Komunikasi',
    indicator_key: 'komunikasi_verbal',
    indicator_label: 'Komunikasi Verbal',
    test_name: 'Rubrik Komunikasi Verbal',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Kejelasan panggilan vokal meminta bola, informasi man-on, dan koordinasi penjagaan.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000402',
    sport_type: 'football',
    category: 'Komunikasi',
    indicator_key: 'dukungan_rekan',
    indicator_label: 'Dukungan Rekan',
    test_name: 'Rubrik Dukungan Rekan',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Respons positif, apresiasi, dan dorongan membangun saat rekan tim melakukan aksi.',
    min_tier: 1
  },
  {
    id: '11111111-1111-4111-8111-000000000403',
    sport_type: 'football',
    category: 'Komunikasi',
    indicator_key: 'kepemimpinan',
    indicator_label: 'Kepemimpinan',
    test_name: 'Rubrik Kepemimpinan Lapangan',
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    description: 'Inisiatif mengatur organisasi garis pertahanan/serangan dan menjadi penggerak tim.',
    min_tier: 3
  }
];

/**
 * Norma Benchmark 4 Tier Usia Sepakbola (U6-U9, U10-U12, U13-U16, U17+).
 * - ACCURACY: nilai dalam persentase (%) keberhasilan [0..100], makin tinggi makin baik.
 * - TIME: nilai dalam detik, makin kecil (cepat) makin baik (poor > fair > good > elite).
 * - REPS: nilai dalam repetisi/shuttle, makin tinggi makin baik (poor < fair < good < elite).
 */
export const COMBINE_BENCHMARKS = {
  // Finishing Target Test (% keberhasilan tembakan)
  '11111111-1111-4111-8111-000000000001': {
    1: { poor: 20, fair: 40, good: 65, elite: 85 },
    2: { poor: 25, fair: 50, good: 72, elite: 90 },
    3: { poor: 35, fair: 58, good: 78, elite: 92 },
    4: { poor: 45, fair: 65, good: 82, elite: 95 }
  },
  // Short Passing Gate Accuracy (%)
  '11111111-1111-4111-8111-000000000002': {
    1: { poor: 25, fair: 50, good: 72, elite: 90 },
    2: { poor: 35, fair: 58, good: 78, elite: 92 },
    3: { poor: 45, fair: 68, good: 84, elite: 95 },
    4: { poor: 55, fair: 75, good: 88, elite: 97 }
  },
  // Slalom Cone Dribbling (detik - lebih cepat lebih baik)
  '11111111-1111-4111-8111-000000000003': {
    1: { poor: 16.5, fair: 13.8, good: 11.4, elite: 9.6 },
    2: { poor: 14.2, fair: 12.0, good: 10.1, elite: 8.6 },
    3: { poor: 12.4, fair: 10.6, good: 9.1, elite: 7.8 },
    4: { poor: 11.2, fair: 9.7, good: 8.4, elite: 7.3 }
  },
  // Wall First-Touch & Control (repetisi/30s)
  '11111111-1111-4111-8111-000000000004': {
    1: { poor: 6, fair: 11, good: 16, elite: 22 },
    2: { poor: 10, fair: 15, good: 21, elite: 27 },
    3: { poor: 14, fair: 20, good: 26, elite: 33 },
    4: { poor: 18, fair: 24, good: 30, elite: 37 }
  },
  // Long Pass Target Zone (%)
  '11111111-1111-4111-8111-000000000005': {
    1: { poor: 15, fair: 35, good: 58, elite: 80 },
    2: { poor: 25, fair: 45, good: 68, elite: 86 },
    3: { poor: 35, fair: 58, good: 76, elite: 91 },
    4: { poor: 45, fair: 66, good: 82, elite: 94 }
  },
  // Flank Crossing Accuracy (%)
  '11111111-1111-4111-8111-000000000006': {
    1: { poor: 15, fair: 35, good: 55, elite: 78 },
    2: { poor: 25, fair: 45, good: 65, elite: 84 },
    3: { poor: 32, fair: 55, good: 74, elite: 90 },
    4: { poor: 42, fair: 64, good: 80, elite: 93 }
  },
  // 10m Sprint Acceleration (detik - lebih cepat lebih baik)
  '11111111-1111-4111-8111-000000000101': {
    1: { poor: 2.85, fair: 2.50, good: 2.22, elite: 2.00 },
    2: { poor: 2.55, fair: 2.26, good: 2.02, elite: 1.84 },
    3: { poor: 2.30, fair: 2.06, good: 1.86, elite: 1.70 },
    4: { poor: 2.12, fair: 1.92, good: 1.76, elite: 1.62 }
  },
  // T-Test / Illinois Agility Run (detik - lebih cepat lebih baik)
  '11111111-1111-4111-8111-000000000102': {
    1: { poor: 15.2, fair: 13.6, good: 12.1, elite: 10.9 },
    2: { poor: 13.8, fair: 12.4, good: 11.1, elite: 10.0 },
    3: { poor: 12.4, fair: 11.2, good: 10.1, elite: 9.2 },
    4: { poor: 11.5, fair: 10.4, good: 9.5, elite: 8.7 }
  },
  // 30m Top Speed Sprint (detik - lebih cepat lebih baik)
  '11111111-1111-4111-8111-000000000103': {
    1: { poor: 6.80, fair: 6.10, good: 5.50, elite: 5.00 },
    2: { poor: 5.95, fair: 5.40, good: 4.90, elite: 4.50 },
    3: { poor: 5.20, fair: 4.75, good: 4.35, elite: 4.00 },
    4: { poor: 4.75, fair: 4.38, good: 4.05, elite: 3.78 }
  },
  // 30s Plyometric Jump Reps (repetisi)
  '11111111-1111-4111-8111-000000000104': {
    1: { poor: 12, fair: 18, good: 24, elite: 30 },
    2: { poor: 16, fair: 22, good: 28, elite: 35 },
    3: { poor: 20, fair: 27, good: 34, elite: 42 },
    4: { poor: 24, fair: 31, good: 38, elite: 46 }
  },
  // 20m Shuttle Endurance Run (shuttle)
  '11111111-1111-4111-8111-000000000105': {
    1: { poor: 12, fair: 22, good: 32, elite: 44 },
    2: { poor: 20, fair: 32, good: 46, elite: 60 },
    3: { poor: 32, fair: 48, good: 66, elite: 86 },
    4: { poor: 45, fair: 64, good: 85, elite: 108 }
  }
};

// Map indicator_key -> readable CHUVATOR indicator label (matching footballAssessmentData.js)
export const INDICATOR_KEY_TO_LABEL = COMBINE_TEST_CATALOG.reduce((acc, item) => {
  acc[item.indicator_key] = item.indicator_label;
  return acc;
}, {
  kontrol_bola: 'Kontrol Bola',
  sentuhan_pertama: 'Sentuhan Pertama',
  passing_pendek: 'Passing Pendek',
  dribbling: 'Dribbling',
  finishing: 'Finishing',
  passing_jauh: 'Passing Jauh',
  crossing: 'Crossing',
  akselerasi: 'Akselerasi',
  kelincahan: 'Kelincahan',
  kecepatan_maksimal: 'Kecepatan Maksimal',
  daya_ledak: 'Daya Ledak',
  daya_tahan: 'Daya Tahan',
  posisi_bertahan: 'Posisi Bertahan',
  posisi_menyerang: 'Posisi Menyerang',
  membuka_ruang: 'Membuka Ruang',
  pengambilan_keputusan: 'Pengambilan Keputusan',
  pressing: 'Pressing',
  fokus: 'Fokus',
  percaya_diri: 'Percaya Diri',
  daya_juang: 'Daya Juang',
  tahan_tekanan: 'Tahan Tekanan',
  komunikasi_verbal: 'Komunikasi Verbal',
  dukungan_rekan: 'Dukungan Rekan',
  kepemimpinan: 'Kepemimpinan'
});

/**
 * Anchored 1–5 Rubric Behavioral Descriptions per indicator
 */
export const RUBRIC_BEHAVIOR_DEFINITIONS = {
  // TAKTIK
  posisi_bertahan: {
    category: 'Taktik',
    title: 'Posisi Bertahan',
    levels: {
      1: { label: 'Pasif & Kehilangan Penjagaan', desc: 'Sering terpaku melihat bola, meninggalkan zona pertahanan, dan memberi ruang bebas bagi lawan.' },
      2: { label: 'Reaktif Terlambat', desc: 'Mulai menutup ruang setelah lawan menerima bola; jarak penjagaan masih sering terlalu jauh.' },
      3: { label: 'Posisi Dasar Konsisten', desc: 'Berada di sisi gawang yang tepat dan menjaga jarak aman, meski sesekali terlambat menggeser blok.' },
      4: { label: 'Antisipatif & Disiplin', desc: 'Aktif memotong jalur umpan sebelum bola dikirim dan menjaga kerapatan antar pemain.' },
      5: { label: 'Kompak & Mengarahkan Lini', desc: 'Membaca ancaman lebih awal, menutup ruang secara presisi, dan vokal mengatur garis pertahanan.' }
    }
  },
  posisi_menyerang: {
    category: 'Taktik',
    title: 'Posisi Menyerang',
    levels: {
      1: { label: 'Statis & Terisolasi', desc: 'Berdiri di belakang bek lawan sehingga tidak tersedia sebagai opsi umpan.' },
      2: { label: 'Bergerak Setelah Dipanggil', desc: 'Baru mencari posisi setelah rekan kesulitan mengumpan; jarak dukungan kurang ideal.' },
      3: { label: 'Tersedia di Sudut Umpan', desc: 'Secara konsisten membuka sudut operan sederhana di area aman.' },
      4: { label: 'Aktif Menciptakan Segitiga', desc: 'Mengatur posisi antar-lini dan memanfaatkan ruang blind-side lawan secara efektif.' },
      5: { label: 'Proaktif & Membongkar Blok', desc: 'Terus menciptakan keunggulan posisi dan mengatur ritme pergerakan serangan tim.' }
    }
  },
  membuka_ruang: {
    category: 'Taktik',
    title: 'Membuka Ruang',
    levels: {
      1: { label: 'Bergerombol di Dekat Bola', desc: 'Cenderung ikut mengejar bola yang dikuasai rekan sehingga mempersempit area main.' },
      2: { label: 'Lari Lurus Terprediksi', desc: 'Melakukan pergerakan tanpa variasi timing atau arah sehingga mudah dibaca bek.' },
      3: { label: 'Menjaga Lebar & Kedalaman', desc: 'Mampu menjaga jarak permainan agar tim memiliki ruang sirkulasi bola.' },
      4: { label: 'Timing Lari Cerdas', desc: 'Menarik bek keluar dari posisinya melalui lari pancingan atau overlap tepat waktu.' },
      5: { label: 'Manipulasi Ruang Elit', desc: 'Membuka celah bagi rekan secara sadar bahkan ketika tidak menerima bola.' }
    }
  },
  pengambilan_keputusan: {
    category: 'Taktik',
    title: 'Pengambilan Keputusan',
    levels: {
      1: { label: 'Terburu-buru / Ragu', desc: 'Sering membuang bola tanpa melihat opsi atau menahan bola terlalu lama hingga direbut.' },
      2: { label: 'Keputusan Satu Arah', desc: 'Hanya memilih opsi paling aman atau memaksakan dribel meski rekan bebas.' },
      3: { label: 'Pilihan Tepat di Ruang Bebas', desc: 'Memilih umpan atau dribel dengan benar ketika tidak mendapat tekanan tinggi.' },
      4: { label: 'Scanning Cepat & Efektif', desc: 'Menoleh sebelum menerima bola dan mengeksekusi opsi terbaik dalam 1–2 sentuhan.' },
      5: { label: 'Progresif & Penentu Tempo', desc: 'Secara konsisten menemukan umpan pemecah lini di bawah tekanan berat.' }
    }
  },
  pressing: {
    category: 'Taktik',
    title: 'Pressing & Transisi',
    levels: {
      1: { label: 'Pasif Saat Kehilangan Bola', desc: 'Berhenti bergerak atau berjalan setelah tim kehilangan penguasaan bola.' },
      2: { label: 'Menekan Sendirian', desc: 'Mengejar bola tanpa sudut tutup yang benar sehingga mudah dilewati lawan.' },
      3: { label: 'Transisi Segera', desc: 'Cepat beralih ke mode bertahan dan menutup jalur progresi tengah.' },
      4: { label: 'Pressing Terarah (Shadow Cover)', desc: 'Menekan pembawa bola sambil menutup opsi umpan terdekat ke area berbahaya.' },
      5: { label: 'Pemicu Counter-Pressing', desc: 'Memimpin tekanan kolektif dalam 3 detik setelah bola hilang dan memaksa kesalahan lawan.' }
    }
  },

  // MENTAL
  fokus: {
    category: 'Mental',
    title: 'Fokus & Konsentrasi',
    levels: {
      1: { label: 'Mudah Terdistraksi', desc: 'Sering kehilangan perhatian saat instruksi pelatih atau momen bola mati.' },
      2: { label: 'Fokus Naik-Turun', desc: 'Tajam di awal sesi namun konsentrasi menurun pada pertengahan hingga akhir latihan.' },
      3: { label: 'Konsentrasi Stabil', desc: 'Mampu mengikuti alur latihan dan tugas posisi dengan konsistensi memadai.' },
      4: { label: 'Siaga Penuh', desc: 'Tetap waspada di momen transisi dan merespons perubahan situasi dengan cepat.' },
      5: { label: 'Konsentrasi Tajam Sepanjang Laga', desc: 'Menjaga atensi detail taktis dari menit pertama hingga peluit akhir tanpa lengah.' }
    }
  },
  percaya_diri: {
    category: 'Mental',
    title: 'Kepercayaan Diri',
    levels: {
      1: { label: 'Takut Menguasai Bola', desc: 'Menghindari menerima umpan dan langsung membuang bola karena takut salah.' },
      2: { label: 'Berani Hanya Saat Unggul', desc: 'Tampil percaya diri ketika unggul jauh, namun ragu-ragu saat situasi ketat.' },
      3: { label: 'Nyaman Bermain Dasar', desc: 'Berani meminta bola dan menjalankan instruksi tanpa kepanikan berlebih.' },
      4: { label: 'Inisiatif Positif', desc: 'Berani mengambil tanggung jawab 1v1 dan mencoba umpan kreatif di momen penting.' },
      5: { label: 'Keyakinan Tinggi & Tenang', desc: 'Selalu meminta bola di situasi sulit dan menularkan ketenangan ke seluruh tim.' }
    }
  },
  daya_juang: {
    category: 'Mental',
    title: 'Daya Juang & Resiliensi',
    levels: {
      1: { label: 'Mudah Menyerah', desc: 'Langsung menghentikan usaha setelah kalah duel atau melakukan kesalahan umpan.' },
      2: { label: 'Butuh Dorongan Eksternal', desc: 'Baru bangkit kembali setelah mendapat teriakan motivasi dari pelatih.' },
      3: { label: 'Usaha Konsisten', desc: 'Terus berusaha mengejar bola dan menyelesaikan drill meski sempat gagal.' },
      4: { label: 'Tangguh Menghadapi Kesalahan', desc: 'Segera merebut bola kembali setelah salah dan menjaga intensitas kerja tinggi.' },
      5: { label: 'Pantang Menyerah Total', desc: 'Menunjukkan etos bertarung tertinggi di setiap duel dan mengangkat semangat tim.' }
    }
  },
  tahan_tekanan: {
    category: 'Mental',
    title: 'Ketahanan Tekanan',
    levels: {
      1: { label: 'Panik di Bawah Pressing', desc: 'Kehilangan kontrol bola dan akurasi ketika lawan mendekat cepat.' },
      2: { label: 'Cenderung Spekulatif', desc: 'Sering menendang bola jauh tanpa target saat ditekan di area sendiri.' },
      3: { label: 'Cukup Terkendali', desc: 'Mampu menjaga kontrol dasar saat berhadapan dengan satu pemain lawan.' },
      4: { label: 'Tenang di Ruang Sempit', desc: 'Menjaga kepala tetap tegak dan melindungi bola meski ditekan dua lawan.' },
      5: { label: 'Klinis di Momen Krusial', desc: 'Justru menampilkan kualitas eksekusi terbaik pada momen paling menegangkan.' }
    }
  },

  // KOMUNIKASI
  komunikasi_verbal: {
    category: 'Komunikasi',
    title: 'Komunikasi Verbal',
    levels: {
      1: { label: 'Pasif / Diam', desc: 'Tidak bersuara sama sekali sepanjang sesi; tidak memberi info kepada rekan.' },
      2: { label: 'Sesekali Meminta Bola', desc: 'Hanya bersuara pelan saat meminta bola di posisi sangat bebas.' },
      3: { label: 'Komunikasi Dasar Jelas', desc: 'Memberi panggilan "man-on", "turn", atau meminta umpan secara terdengar.' },
      4: { label: 'Informatif & Tepat Waktu', desc: 'Memberi instruksi arah gerak dan penjagaan sebelum situasi bahaya terjadi.' },
      5: { label: 'Proaktif & Vokal', desc: 'Menjadi suara pengarah di lapangan dengan panggilan singkat, jelas, dan konstruktif.' }
    }
  },
  dukungan_rekan: {
    category: 'Komunikasi',
    title: 'Dukungan Rekan',
    levels: {
      1: { label: 'Individualistis / Menyalahkan', desc: 'Menunjukkan gestur kesal saat rekan melakukan kesalahan dan enggan bekerja sama.' },
      2: { label: 'Netral / Kurang Terlibat', desc: 'Fokus pada permainan sendiri tanpa memberi apresiasi atau dukungan kepada rekan.' },
      3: { label: 'Kooperatif', desc: 'Menerima umpan balik dengan baik dan memberi tos/apresiasi kepada rekan.' },
      4: { label: 'Aktif Menguatkan Tim', desc: 'Segera menyemangati rekan yang gagal dan membantu menutup celah rekan.' },
      5: { label: 'Perekat Harmoni Tim', desc: 'Selalu membangun energi positif dan menyatukan fokus rekan di setiap kondisi skor.' }
    }
  },
  kepemimpinan: {
    category: 'Komunikasi',
    title: 'Kepemimpinan Lapangan',
    levels: {
      1: { label: 'Mengikuti Arus', desc: 'Menunggu arahan rekan atau pelatih untuk setiap penyesuaian posisi.' },
      2: { label: 'Teladan Usaha Pribadi', desc: 'Berlatih serius namun belum berani mengoordinasikan rekan di sekitarnya.' },
      3: { label: 'Koordinator Zona Terdekat', desc: 'Mengatur pergantian jaga dengan 1–2 pemain di dekat posisinya.' },
      4: { label: 'Pengatur Organisasi Lini', desc: 'Mengomandoi garis pertahanan/tengah agar tetap sejajar dan disiplin.' },
      5: { label: 'Pemimpin Lapangan Sejati', desc: 'Mengorkestrasi tempo, organisasi taktik, dan mentalitas tim secara menyeluruh.' }
    }
  }
};

/**
 * Resolve a test definition from COMBINE_TEST_CATALOG by testId or indicator_key.
 */
export function resolveCombineTest(testIdOrKey) {
  if (!testIdOrKey) return null;
  const key = String(testIdOrKey).trim();
  return (
    COMBINE_TEST_CATALOG.find(
      (t) => t.id === key || t.indicator_key === key
    ) || null
  );
}

/**
 * Piecewise linear interpolation helper for ascending anchor arrays.
 * anchors: array of { x: number, y: number } sorted by ascending x.
 */
function interpolateAscending(value, anchors) {
  if (!Array.isArray(anchors) || anchors.length === 0) return 1;
  if (value <= anchors[0].x) return anchors[0].y;
  const last = anchors[anchors.length - 1];
  if (value >= last.x) return last.y;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (value >= a.x && value <= b.x) {
      if (b.x === a.x) return b.y;
      const ratio = (value - a.x) / (b.x - a.x);
      return a.y + ratio * (b.y - a.y);
    }
  }
  return last.y;
}

/**
 * Piecewise linear interpolation for descending time benchmarks (lower seconds = higher score).
 * benchmark: { poor: 3.9, fair: 3.55, good: 3.25, elite: 2.95 }
 */
function interpolateTime(seconds, benchmark) {
  const { poor, fair, good, elite } = benchmark;
  const floorTime = poor * 1.35; // 1 point floor if much slower than poor
  const peakTime = Math.max(0.4, elite * 0.88); // 100 point peak if faster than elite

  // Convert to ascending anchors using negated seconds: -floorTime < -poor < -fair < -good < -elite < -peakTime
  const anchors = [
    { x: -floorTime, y: 1 },
    { x: -poor, y: BENCHMARK_SCORE_ANCHORS.poor },
    { x: -fair, y: BENCHMARK_SCORE_ANCHORS.fair },
    { x: -good, y: BENCHMARK_SCORE_ANCHORS.good },
    { x: -elite, y: BENCHMARK_SCORE_ANCHORS.elite },
    { x: -peakTime, y: 100 }
  ];

  return interpolateAscending(-seconds, anchors);
}

/**
 * Piecewise linear interpolation for ascending higher-is-better metrics (ACCURACY %, REPS).
 */
function interpolateHigherIsBetter(metricValue, benchmark, maxCap = null) {
  const { poor, fair, good, elite } = benchmark;
  const topVal = maxCap !== null ? Math.max(elite + 1, maxCap) : Math.max(elite + 2, elite * 1.25);

  const anchors = [
    { x: 0, y: 1 },
    { x: poor, y: BENCHMARK_SCORE_ANCHORS.poor },
    { x: fair, y: BENCHMARK_SCORE_ANCHORS.fair },
    { x: good, y: BENCHMARK_SCORE_ANCHORS.good },
    { x: elite, y: BENCHMARK_SCORE_ANCHORS.elite },
    { x: topVal, y: 100 }
  ];

  return interpolateAscending(metricValue, anchors);
}

/**
 * Maps an anchored rubric level (1-5) instantaneously to 1-100 score.
 * Level 1 = 35, Level 2 = 52, Level 3 = 70, Level 4 = 84, Level 5 = 95.
 */
export function calculateRubricScore(level) {
  const numeric = Number(level);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(1, Math.min(5, numeric));
  if (RUBRIC_LEVEL_SCORE_MAP[clamped] !== undefined) {
    return RUBRIC_LEVEL_SCORE_MAP[clamped];
  }
  const anchors = [
    { x: 1, y: RUBRIC_LEVEL_SCORE_MAP[1] },
    { x: 2, y: RUBRIC_LEVEL_SCORE_MAP[2] },
    { x: 3, y: RUBRIC_LEVEL_SCORE_MAP[3] },
    { x: 4, y: RUBRIC_LEVEL_SCORE_MAP[4] },
    { x: 5, y: RUBRIC_LEVEL_SCORE_MAP[5] }
  ];
  return Math.max(1, Math.min(100, Math.round(interpolateAscending(clamped, anchors))));
}

/**
 * Instantaneous score converter (1-100) using Piecewise Linear Interpolation across 4 tiers.
 * Never returns PENDING_CALIBRATION. Returns null only if required raw input is empty/missing.
 *
 * @param {string} testId - Test UUID or indicator_key from COMBINE_TEST_CATALOG
 * @param {number} tier - Football Age Tier (1: U6-U9, 2: U10-U12, 3: U13-U16, 4: U17+)
 * @param {object} rawData - { raw_value_1, raw_value_2, errors_count } (also accepts camelCase aliases)
 * @param {object} [testMetaOverride] - Optional test metadata object when using custom catalog rows
 * @returns {number|null} Integer score in range [1, 100], or null if no primary input provided yet
 */
export function calculateTestScore(testId, tier, rawData = {}, testMetaOverride = null) {
  const test = testMetaOverride || resolveCombineTest(testId);
  if (!test) return null;

  const normalizedTier = Math.max(1, Math.min(4, Number(tier) || 1));
  const v1Raw = rawData.raw_value_1 ?? rawData.rawValue1 ?? rawData.successful ?? rawData.value ?? '';
  const v2Raw = rawData.raw_value_2 ?? rawData.rawValue2 ?? rawData.total ?? '';
  const errRaw = rawData.errors_count ?? rawData.errorsCount ?? rawData.failed ?? 0;

  if (v1Raw === '' || v1Raw === null || v1Raw === undefined) {
    return null;
  }

  const v1 = Number(v1Raw);
  if (!Number.isFinite(v1) || v1 < 0) return null;

  const v2 = v2Raw !== '' && v2Raw !== null && v2Raw !== undefined ? Number(v2Raw) : null;
  const errors = Math.max(0, Number(errRaw) || 0);

  if (test.measurement_type === 'RUBRIC') {
    return calculateRubricScore(v1);
  }

  const benchmarkTable = COMBINE_BENCHMARKS[test.id] || COMBINE_BENCHMARKS[testId];
  const tierBenchmark = benchmarkTable?.[normalizedTier] || benchmarkTable?.[1];
  if (!tierBenchmark) return null;

  let rawScore = 1;

  if (test.measurement_type === 'ACCURACY') {
    // Support explicit total (v2 > 0), or successful + errors, or test.defaultTotal
    let totalAttempts = test.defaultTotal || 10;
    if (v2 !== null && Number.isFinite(v2) && v2 > 0) {
      totalAttempts = v2;
    } else if (errors > 0) {
      totalAttempts = v1 + errors;
    }
    const safeTotal = Math.max(1, totalAttempts);
    const clampedSuccess = Math.min(v1, safeTotal);
    const pct = (clampedSuccess / safeTotal) * 100;
    rawScore = interpolateHigherIsBetter(pct, tierBenchmark, 100);
  } else if (test.measurement_type === 'TIME') {
    if (v1 <= 0) return null;
    const validTrial2 = v2 !== null && Number.isFinite(v2) && v2 > 0 ? v2 : null;
    const bestTrial = validTrial2 !== null ? Math.min(v1, validTrial2) : v1;
    const penaltyPerError = Number(test.errorPenaltySeconds ?? 0.25);
    const effectiveTime = bestTrial + errors * penaltyPerError;
    rawScore = interpolateTime(effectiveTime, tierBenchmark);
  } else if (test.measurement_type === 'REPS') {
    const validTrial2 = v2 !== null && Number.isFinite(v2) && v2 > 0 ? v2 : null;
    const bestReps = validTrial2 !== null ? Math.max(v1, validTrial2) : v1;
    const effectiveReps = Math.max(0, bestReps - errors * 0.5);
    rawScore = interpolateHigherIsBetter(effectiveReps, tierBenchmark);
  } else {
    return null;
  }

  return Math.max(1, Math.min(100, Math.round(rawScore)));
}

/**
 * Returns human-readable tier & score classification badge info.
 */
export function getScoreClassification(score) {
  if (score === null || score === undefined || score === '') {
    return {
      label: 'Belum Diukur',
      shortLabel: '-',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      accentColor: '#64748B'
    };
  }
  const num = Number(score);
  if (!Number.isFinite(num)) {
    return {
      label: 'Belum Diukur',
      shortLabel: '-',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      accentColor: '#64748B'
    };
  }
  if (num >= 90) {
    return {
      label: 'Elit',
      shortLabel: 'Elit',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      accentColor: '#059669'
    };
  }
  if (num >= 75) {
    return {
      label: 'Baik',
      shortLabel: 'Baik',
      badgeClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
      accentColor: '#0D9488'
    };
  }
  if (num >= 55) {
    return {
      label: 'Cukup',
      shortLabel: 'Cukup',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      accentColor: '#D97706'
    };
  }
  return {
    label: 'Perlu Pembinaan',
    shortLabel: 'Kurang',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    accentColor: '#DC2626'
  };
}

/**
 * Filter active tests for a given tier & optional categories list.
 * @param {number} tier
 * @param {string[] | null} [categories]
 */
export function getActiveTestsForTier(tier, categories = null) {
  const normalizedTier = Math.max(1, Math.min(4, Number(tier) || 1));
  return COMBINE_TEST_CATALOG.filter((test) => {
    const tierOk = (test.min_tier || 1) <= normalizedTier;
    const catOk = !categories || categories.includes(test.category);
    return tierOk && catOk;
  });
}
