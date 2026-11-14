// =========================================================================
// CHUVATOR — MASTER FOOTBALL ASSESSMENT ENGINE (SPORTS SCIENCE & SCORING)
// Mengintegrasikan tes objektif (TIME, ACCURACY, REPS, DISTANCE) dan
// observasi subjektif terstruktur (RUBRIC 1-5) menjadi skor tunggal 1-100.
// TANPA PENDING_CALIBRATION: Setiap input dikonversi instan via Piecewise Linear.
// =========================================================================

export const FOOTBALL_ASSESSMENT_TIERS = {
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

export const SCORE_ANCHOR_POINTS = {
  poor: 25,
  fair: 55,
  good: 80,
  elite: 96
};

export const RUBRIC_ANCHORED_SCORES = {
  1: 35,
  2: 52,
  3: 70,
  4: 84,
  5: 95
};

export const ASSESSMENT_CATEGORIES = [
  { key: 'ALL', label: 'Semua Kategori' },
  { key: 'Fisik', label: 'Fisik' },
  { key: 'Teknik', label: 'Teknik' },
  { key: 'Taktik', label: 'Taktik' },
  { key: 'Mental', label: 'Mental' },
  { key: 'Komunikasi', label: 'Komunikasi' },
  { key: 'Spesifik Posisi', label: 'Posisi Khusus' }
];

/**
 * Master Football Tests Catalog (selaras dengan `public.master_football_tests_catalog`)
 */
export const MASTER_FOOTBALL_TESTS_CATALOG = [
  // ======================== 1. FISIK (PHYSICAL) ========================
  {
    id: '22222222-2222-4222-8222-000000000001',
    test_code: 'PHY01',
    test_name: 'Sprint 10m Acceleration',
    category: 'Fisik',
    indicator_key: 'akselerasi',
    indicator_label: 'Akselerasi',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: true,
    errorPenalty: 0,
    weight: 1.0,
    inputLabel1: 'Percobaan 1 (detik)',
    inputLabel2: 'Percobaan 2 (opsional)',
    min_tier: 1,
    description: 'Waktu akselerasi eksplosif 0–10 meter dari start berdiri (diambil waktu tercepat).'
  },
  {
    id: '22222222-2222-4222-8222-000000000002',
    test_code: 'PHY02',
    test_name: 'Flying Sprint 30m Top Speed',
    category: 'Fisik',
    indicator_key: 'kecepatan_maksimal',
    indicator_label: 'Kecepatan Maksimal',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: true,
    errorPenalty: 0,
    weight: 1.0,
    inputLabel1: 'Percobaan 1 (detik)',
    inputLabel2: 'Percobaan 2 (opsional)',
    min_tier: 2,
    description: 'Catatan waktu sprint 30 meter penuh untuk mengukur top speed atlet.'
  },
  {
    id: '22222222-2222-4222-8222-000000000003',
    test_code: 'PHY03',
    test_name: 'Illinois Agility Test',
    category: 'Fisik',
    indicator_key: 'kelincahan',
    indicator_label: 'Kelincahan',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: true,
    errorPenalty: 0.25,
    weight: 1.0,
    inputLabel1: 'Percobaan 1 (detik)',
    inputLabel2: 'Percobaan 2 (opsional)',
    min_tier: 1,
    description: 'Lintasan kelincahan slalom & putaran 180° (+0.25 detik per cone jatuh).'
  },
  {
    id: '22222222-2222-4222-8222-000000000004',
    test_code: 'PHY04',
    test_name: '505 Change of Direction Test',
    category: 'Fisik',
    indicator_key: 'perubahan_arah',
    indicator_label: 'Perubahan Arah',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: true,
    errorPenalty: 0.2,
    weight: 1.0,
    inputLabel1: 'Waktu 505 Kanan (d)',
    inputLabel2: 'Waktu 505 Kiri (d)',
    min_tier: 2,
    description: 'Ketajaman deselerasi dan potong arah 180 derajat pada jarak 5 meter.'
  },
  {
    id: '22222222-2222-4222-8222-000000000005',
    test_code: 'PHY05',
    test_name: 'Visual Signal Reaction Sprint (5m)',
    category: 'Fisik',
    indicator_key: 'reaksi',
    indicator_label: 'Reaksi',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: true,
    errorPenalty: 0,
    weight: 1.0,
    inputLabel1: 'Waktu Reaksi 1 (d)',
    inputLabel2: 'Waktu Reaksi 2 (d)',
    min_tier: 2,
    description: 'Kecepatan reaksi sprint 5 meter merespons isyarat visual pelatih.'
  },
  {
    id: '22222222-2222-4222-8222-000000000006',
    test_code: 'PHY06',
    test_name: 'Yo-Yo Intermittent Recovery Distance',
    category: 'Fisik',
    indicator_key: 'daya_tahan',
    indicator_label: 'Daya Tahan',
    position_code: null,
    measurement_type: 'DISTANCE',
    unit: 'meter',
    is_lower_better: false,
    errorPenalty: 0,
    weight: 1.0,
    inputLabel1: 'Jarak Kumulatif (m)',
    inputLabel2: 'Target / Cadangan (m)',
    min_tier: 3,
    description: 'Total jarak tempuh kumulatif (meter) pada Yo-Yo Intermittent Recovery Test.'
  },
  {
    id: '22222222-2222-4222-8222-000000000007',
    test_code: 'PHY07',
    test_name: 'Standing Broad Jump (Explosive Power)',
    category: 'Fisik',
    indicator_key: 'daya_ledak',
    indicator_label: 'Daya Ledak',
    position_code: null,
    measurement_type: 'DISTANCE',
    unit: 'cm',
    is_lower_better: false,
    errorPenalty: 0,
    weight: 1.0,
    inputLabel1: 'Lompatan 1 (cm)',
    inputLabel2: 'Lompatan 2 (opsional)',
    min_tier: 3,
    description: 'Jarak lompatan jauh tanpa awalan (cm) mengukur daya ledak otot tungkai.'
  },
  {
    id: '22222222-2222-4222-8222-000000000008',
    test_code: 'PHY08',
    test_name: 'Countermovement Vertical Jump',
    category: 'Fisik',
    indicator_key: 'lompatan',
    indicator_label: 'Lompatan',
    position_code: null,
    measurement_type: 'DISTANCE',
    unit: 'cm',
    is_lower_better: false,
    errorPenalty: 0,
    weight: 1.0,
    inputLabel1: 'Tinggi Lompat 1 (cm)',
    inputLabel2: 'Tinggi Lompat 2 (cm)',
    min_tier: 2,
    description: 'Tinggi raihan lompatan vertikal maksimal (cm) untuk duel udara.'
  },
  {
    id: '22222222-2222-4222-8222-000000000009',
    test_code: 'PHY09',
    test_name: 'Single-Leg Balance Hold',
    category: 'Fisik',
    indicator_key: 'keseimbangan',
    indicator_label: 'Keseimbangan',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: false,
    errorPenalty: 2,
    weight: 1.0,
    inputLabel1: 'Durasi Kaki Kanan (d)',
    inputLabel2: 'Durasi Kaki Kiri (d)',
    min_tier: 1,
    description: 'Durasi menahan keseimbangan satu kaki stabil (semakin lama semakin baik).'
  },
  {
    id: '22222222-2222-4222-8222-000000000010',
    test_code: 'PHY10',
    test_name: '60s Push-Up & Core Stability Reps',
    category: 'Fisik',
    indicator_key: 'kekuatan_tubuh',
    indicator_label: 'Kekuatan Tubuh',
    position_code: null,
    measurement_type: 'REPS',
    unit: 'repetisi',
    is_lower_better: false,
    errorPenalty: 1,
    weight: 1.0,
    inputLabel1: 'Repetisi Valid (60d)',
    inputLabel2: 'Percobaan 2 (opsional)',
    min_tier: 3,
    description: 'Jumlah repetisi bersih kekuatan tubuh atas & core selama 60 detik.'
  },
  {
    id: '22222222-2222-4222-8222-000000000011',
    test_code: 'PHY11',
    test_name: '1-Minute Heart Rate Recovery Drop',
    category: 'Fisik',
    indicator_key: 'pemulihan',
    indicator_label: 'Pemulihan',
    position_code: null,
    measurement_type: 'REPS',
    unit: 'bpm drop',
    is_lower_better: false,
    errorPenalty: 0,
    weight: 1.0,
    inputLabel1: 'Penurunan BPM (1 mnt)',
    inputLabel2: 'Cadangan (opsional)',
    min_tier: 4,
    description: 'Selisih penurunan detak jantung (BPM) 1 menit setelah latihan intensitas puncak.'
  },
  {
    id: '22222222-2222-4222-8222-000000000012',
    test_code: 'PHY12',
    test_name: 'Dynamic Balance Test',
    category: 'Fisik',
    indicator_key: 'keseimbangan',
    indicator_label: 'Keseimbangan',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: false,
    errorPenalty: 1,
    weight: 1.0,
    inputLabel1: 'Durasi Stabil 1 (detik)',
    inputLabel2: 'Durasi Stabil 2 (opsional)',
    min_tier: 1,
    description: 'Tes keseimbangan dinamis satu kaki dengan transisi gerak (semakin lama durasi bertahan, semakin baik).'
  },

  // ======================== 2. TEKNIK (TECHNICAL) ========================
  {
    id: '22222222-2222-4222-8222-000000000101',
    test_code: 'TEC01',
    test_name: 'Wall First-Touch & Ball Control (30s)',
    category: 'Teknik',
    indicator_key: 'kontrol_bola',
    indicator_label: 'Kontrol Bola',
    position_code: null,
    measurement_type: 'REPS',
    unit: 'sentuhan',
    is_lower_better: false,
    errorPenalty: 1,
    weight: 1.0,
    inputLabel1: 'Jumlah Kontrol Bersih',
    inputLabel2: 'Percobaan 2 (opsional)',
    min_tier: 1,
    description: 'Jumlah pantulan umpan & kontrol bersih ke dinding dalam durasi 30 detik.'
  },
  {
    id: '22222222-2222-4222-8222-000000000102',
    test_code: 'TEC02',
    test_name: 'Directional First-Touch Box Trap',
    category: 'Teknik',
    indicator_key: 'sentuhan_pertama',
    indicator_label: 'Sentuhan Pertama',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'sukses/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Sentuhan Terarah Sukses',
    inputLabel2: 'Total Percobaan',
    min_tier: 1,
    description: 'Kontrol sentuhan pertama mengarahkan bola keluar zona sempit dalam 1 gerakan.'
  },
  {
    id: '22222222-2222-4222-8222-000000000103',
    test_code: 'TEC03',
    test_name: 'Short Passing Gate Accuracy (10m)',
    category: 'Teknik',
    indicator_key: 'passing_pendek',
    indicator_label: 'Passing Pendek',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 12,
    weight: 1.0,
    inputLabel1: 'Umpan Masuk Gerbang',
    inputLabel2: 'Total Percobaan',
    min_tier: 1,
    description: 'Akurasi umpan pendek mendatar melewati gerbang cone 1.5m pada jarak 10m.'
  },
  {
    id: '22222222-2222-4222-8222-000000000104',
    test_code: 'TEC04',
    test_name: 'Long Lofted Pass Target Zone (30m)',
    category: 'Teknik',
    indicator_key: 'passing_jauh',
    indicator_label: 'Passing Jauh',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Umpan Masuk Zona 5x5m',
    inputLabel2: 'Total Percobaan',
    min_tier: 2,
    description: 'Akurasi umpan lambung jarak 25–30 meter mendarat tepat di grid target.'
  },
  {
    id: '22222222-2222-4222-8222-000000000105',
    test_code: 'TEC05',
    test_name: 'Figure-8 Slalom Dribbling Time',
    category: 'Teknik',
    indicator_key: 'dribbling',
    indicator_label: 'Dribbling',
    position_code: null,
    measurement_type: 'TIME',
    unit: 'detik',
    is_lower_better: true,
    errorPenalty: 0.25,
    weight: 0.6,
    inputLabel1: 'Waktu Slalom 1 (detik)',
    inputLabel2: 'Waktu Slalom 2 (opsional)',
    min_tier: 1,
    description: 'Waktu menggiring bola melewati 8 cone (+0.25d per cone jatuh). Mendukung agregasi Dribbling.'
  },
  {
    id: '22222222-2222-4222-8222-000000000106',
    test_code: 'TEC06',
    test_name: 'High-Speed Dribble Gate Retention',
    category: 'Teknik',
    indicator_key: 'dribbling',
    indicator_label: 'Dribbling',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'lolos/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 0.4,
    inputLabel1: 'Lolos Gerbang Bersih',
    inputLabel2: 'Total Percobaan',
    min_tier: 2,
    description: 'Kontrol bola melewati gerbang saat lari cepat. Digabung agregat bersama TEC05 ke indikator Dribbling.'
  },
  {
    id: '22222222-2222-4222-8222-000000000107',
    test_code: 'TEC07',
    test_name: 'Finishing Corner Target Accuracy',
    category: 'Teknik',
    indicator_key: 'finishing',
    indicator_label: 'Finishing',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'gol/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 0.6,
    inputLabel1: 'Tembakan Sudut Masuk',
    inputLabel2: 'Total Percobaan',
    min_tier: 1,
    description: 'Tembakan penempatan ke sudut gawang dari tepi kotak penalti (10 percobaan).'
  },
  {
    id: '22222222-2222-4222-8222-000000000108',
    test_code: 'TEC08',
    test_name: 'One-Touch Composure Finishing',
    category: 'Teknik',
    indicator_key: 'finishing',
    indicator_label: 'Finishing',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'gol/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 0.4,
    inputLabel1: 'Gol Satu Sentuhan',
    inputLabel2: 'Total Umpan Tarik',
    min_tier: 2,
    description: 'Penyelesaian satu sentuhan dari umpan cut-back. Digabung agregat bersama TEC07 ke indikator Finishing.'
  },
  {
    id: '22222222-2222-4222-8222-000000000109',
    test_code: 'TEC09',
    test_name: 'In-Swing & Out-Swing Crossing Accuracy',
    category: 'Teknik',
    indicator_key: 'crossing',
    indicator_label: 'Crossing',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Crossing Tepat Zona',
    inputLabel2: 'Total Percobaan',
    min_tier: 3,
    description: 'Akurasi umpan silang dari sayap dalam keadaan bergerak ke zona target penalti.'
  },
  {
    id: '22222222-2222-4222-8222-000000000110',
    test_code: 'TEC10',
    test_name: '1v1 Defensive Duels & Clean Tackle',
    category: 'Teknik',
    indicator_key: 'tackling',
    indicator_label: 'Tackling',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'menang/duel',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Duel 1v1 Dimenangkan',
    inputLabel2: 'Total Duel 1v1',
    min_tier: 2,
    description: 'Keberhasilan menghentikan lawan & merebut bola bersih pada kanal 1v1.'
  },
  {
    id: '22222222-2222-4222-8222-000000000111',
    test_code: 'TEC11',
    test_name: 'Weak-Foot Passing & Shooting Precision',
    category: 'Teknik',
    indicator_key: 'kaki_lemah',
    indicator_label: 'Kaki Lemah',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Eksekusi Kaki Lemah Tepat',
    inputLabel2: 'Total Percobaan',
    min_tier: 2,
    description: 'Akurasi distribusi & tembakan menggunakan kaki non-dominan.'
  },
  {
    id: '22222222-2222-4222-8222-000000000112',
    test_code: 'TEC12',
    test_name: 'Directional Heading Target Test',
    category: 'Teknik',
    indicator_key: 'heading',
    indicator_label: 'Heading',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Sundulan Tepat Sasaran',
    inputLabel2: 'Total Umpan Lambung',
    min_tier: 3,
    description: 'Ketepatan mengarahkan sundulan dari umpan lambung ke zona target.'
  },
  {
    id: '22222222-2222-4222-8222-000000000113',
    test_code: 'TEC13',
    test_name: 'First Touch Box Trap',
    category: 'Teknik',
    indicator_key: 'sentuhan_pertama',
    indicator_label: 'Sentuhan Pertama',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'sukses/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Trap Dalam Kotak Sukses',
    inputLabel2: 'Total Percobaan',
    min_tier: 1,
    description: 'Kontrol sentuhan pertama menghentikan bola di dalam area kotak target dalam satu sentuhan bersih.'
  },

  // ======================== 3. TAKTIK (TACTICAL) ========================
  {
    id: '22222222-2222-4222-8222-000000000201',
    test_code: 'TAC01',
    test_name: 'Defensive Positioning & Zonal Marking',
    category: 'Taktik',
    indicator_key: 'posisi_bertahan',
    indicator_label: 'Posisi Bertahan',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Penempatan posisi bertahan, penjagaan jarak antar-lini, dan penutupan jalur umpan.'
  },
  {
    id: '22222222-2222-4222-8222-000000000202',
    test_code: 'TAC02',
    test_name: 'Offensive Support & Triangle Creation',
    category: 'Taktik',
    indicator_key: 'posisi_menyerang',
    indicator_label: 'Posisi Menyerang',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Penempatan posisi saat tim menguasai bola untuk membentuk sudut dukungan segitiga.'
  },
  {
    id: '22222222-2222-4222-8222-000000000203',
    test_code: 'TAC03',
    test_name: 'Off-Ball Space Creation',
    category: 'Taktik',
    indicator_key: 'membuka_ruang',
    indicator_label: 'Membuka Ruang',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Pergerakan tanpa bola untuk menarik lawan dan menciptakan ruang eksploitasi.'
  },
  {
    id: '22222222-2222-4222-8222-000000000204',
    test_code: 'TAC04',
    test_name: 'Game Scanning & Anticipation Rate',
    category: 'Taktik',
    indicator_key: 'membaca_permainan',
    indicator_label: 'Membaca Permainan',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 2,
    description: 'Kebiasaan memindai ruang (head-scanning) sebelum bola datang & membaca alur lawan.'
  },
  {
    id: '22222222-2222-4222-8222-000000000205',
    test_code: 'TAC05',
    test_name: 'Rondo 4v2 Decision Making Success',
    category: 'Taktik',
    indicator_key: 'pengambilan_keputusan',
    indicator_label: 'Pengambilan Keputusan',
    position_code: null,
    measurement_type: 'ACCURACY',
    unit: 'tepat/keputusan',
    is_lower_better: false,
    defaultTotal: 15,
    weight: 1.0,
    inputLabel1: 'Keputusan Progresif Tepat',
    inputLabel2: 'Total Aksi Rondo',
    min_tier: 2,
    description: 'Persentase ketepatan keputusan 1–2 sentuhan dalam simulasi rondo bertekanan.'
  },
  {
    id: '22222222-2222-4222-8222-000000000206',
    test_code: 'TAC06',
    test_name: 'Coordinated Pressing & Counter-Press',
    category: 'Taktik',
    indicator_key: 'pressing',
    indicator_label: 'Pressing',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 3,
    description: 'Agresivitas terukur menutup ruang lawan dan reaksi counter-pressing 3 detik.'
  },
  {
    id: '22222222-2222-4222-8222-000000000207',
    test_code: 'TAC07',
    test_name: 'Defensive-to-Attacking Transition Speed',
    category: 'Taktik',
    indicator_key: 'transisi_menyerang',
    indicator_label: 'Transisi Menyerang',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 3,
    description: 'Kecepatan eksploitasi ruang depan sesaat setelah tim berhasil merebut bola.'
  },
  {
    id: '22222222-2222-4222-8222-000000000208',
    test_code: 'TAC08',
    test_name: 'Space Creation Observation',
    category: 'Taktik',
    indicator_key: 'membuka_ruang',
    indicator_label: 'Membuka Ruang',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Observasi kemampuan manipulasi ruang tanpa bola, menciptakan celah passing, dan timing pergerakan.'
  },

  // ======================== 4. MENTAL (RUBRIC 1-5) ========================
  {
    id: '22222222-2222-4222-8222-000000000301',
    test_code: 'MEN01',
    test_name: 'Match Focus & Tactical Concentration',
    category: 'Mental',
    indicator_key: 'fokus',
    indicator_label: 'Fokus',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Konsistensi perhatian atlet selama instruksi, drill, dan situasi bola mati.'
  },
  {
    id: '22222222-2222-4222-8222-000000000302',
    test_code: 'MEN02',
    test_name: 'On-Ball Courage & Self-Confidence',
    category: 'Mental',
    indicator_key: 'percaya_diri',
    indicator_label: 'Percaya Diri',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Keberanian menerima bola di bawah tekanan dan mengambil inisiatif positif.'
  },
  {
    id: '22222222-2222-4222-8222-000000000303',
    test_code: 'MEN03',
    test_name: 'Fighting Spirit & Error Recovery',
    category: 'Mental',
    indicator_key: 'daya_juang',
    indicator_label: 'Daya Juang',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 2,
    description: 'Daya juang memenangkan bola kembali dan ketangguhan bangkit dari kesalahan.'
  },
  {
    id: '22222222-2222-4222-8222-000000000304',
    test_code: 'MEN04',
    test_name: 'Composure Under High Pressing',
    category: 'Mental',
    indicator_key: 'tahan_tekanan',
    indicator_label: 'Tahan Tekanan',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 3,
    description: 'Ketenangan emosional & kejelasan eksekusi saat ditekan lawan di area krusial.'
  },
  {
    id: '22222222-2222-4222-8222-000000000305',
    test_code: 'MEN05',
    test_name: 'Pressure Performance Test',
    category: 'Mental',
    indicator_key: 'percaya_diri',
    indicator_label: 'Percaya Diri',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Observasi keberanian meminta bola di bawah tekanan tinggi dan keyakinan mengambil keputusan.'
  },

  // ======================== 5. KOMUNIKASI (RUBRIC 1-5) ========================
  {
    id: '22222222-2222-4222-8222-000000000401',
    test_code: 'COM01',
    test_name: 'Verbal Pitch Communication',
    category: 'Komunikasi',
    indicator_key: 'komunikasi_verbal',
    indicator_label: 'Komunikasi Verbal',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Volume, kejelasan, dan ketepatan waktu instruksi vokal kepada rekan setim.'
  },
  {
    id: '22222222-2222-4222-8222-000000000402',
    test_code: 'COM02',
    test_name: 'Teammate Support & Body Language',
    category: 'Komunikasi',
    indicator_key: 'dukungan_rekan',
    indicator_label: 'Dukungan Rekan',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Sikap saling mendukung, bahasa tubuh positif, dan kolaborasi konstruktif.'
  },
  {
    id: '22222222-2222-4222-8222-000000000403',
    test_code: 'COM03',
    test_name: 'Tactical Unit Leadership',
    category: 'Komunikasi',
    indicator_key: 'kepemimpinan',
    indicator_label: 'Kepemimpinan',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 3,
    description: 'Kepemimpinan mengorganisasi lini permainan dan menjaga standar kerja tim.'
  },
  {
    id: '22222222-2222-4222-8222-000000000404',
    test_code: 'COM04',
    test_name: 'Partner Support Observation',
    category: 'Komunikasi',
    indicator_key: 'dukungan_rekan',
    indicator_label: 'Dukungan Rekan',
    position_code: null,
    measurement_type: 'RUBRIC',
    unit: 'level 1-5',
    is_lower_better: false,
    weight: 1.0,
    min_tier: 1,
    description: 'Observasi konsistensi memberi apresiasi vokal, bahasa tubuh positif, dan dukungan kolektif antarpemain.'
  },

  // ======================== 6. SPESIFIK POSISI ========================
  {
    id: '22222222-2222-4222-8222-000000000501',
    test_code: 'POS_GK01',
    test_name: 'GK Reflex Shot-Stopping Drill',
    category: 'Spesifik Posisi',
    indicator_key: 'refleks',
    indicator_label: 'Refleks',
    position_code: 'GK',
    measurement_type: 'ACCURACY',
    unit: 'tepis/tembakan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Penyelamatan Sukses',
    inputLabel2: 'Total Tembakan',
    min_tier: 1,
    description: '[Khusus GK] Penyelamatan refleks jarak dekat dari rangkaian tembakan cepat.'
  },
  {
    id: '22222222-2222-4222-8222-000000000502',
    test_code: 'POS_GK02',
    test_name: 'GK Side-Volley & Throw Distribution',
    category: 'Spesifik Posisi',
    indicator_key: 'distribusi_kaki',
    indicator_label: 'Distribusi Kaki',
    position_code: 'GK',
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Distribusi Tepat Zona',
    inputLabel2: 'Total Distribusi',
    min_tier: 1,
    description: '[Khusus GK] Akurasi distribusi bola kiper memulai serangan ke zona target.'
  },
  {
    id: '22222222-2222-4222-8222-000000000503',
    test_code: 'POS_CB01',
    test_name: 'CB Aerial Duel & Recovery Clearance',
    category: 'Spesifik Posisi',
    indicator_key: 'duel_bertahan',
    indicator_label: 'Duel Bertahan',
    position_code: 'CB',
    measurement_type: 'ACCURACY',
    unit: 'menang/duel',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Duel & Clearance Bersih',
    inputLabel2: 'Total Bola Masuk',
    min_tier: 1,
    description: '[Khusus CB] Ketangguhan duel bertahan & sapuan terarah dari bola daerah.'
  },
  {
    id: '22222222-2222-4222-8222-000000000504',
    test_code: 'POS_FB01',
    test_name: 'Fullback / Wingback Overlap Cross Drill',
    category: 'Spesifik Posisi',
    indicator_key: 'overlap',
    indicator_label: 'Overlap',
    position_code: 'LB/RB',
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Overlap & Cross Sukses',
    inputLabel2: 'Total Overlap',
    min_tier: 1,
    description: '[Khusus LB/RB & WB] Timing lari overlap sayap diikuti umpan silang akurat.'
  },
  {
    id: '22222222-2222-4222-8222-000000000505',
    test_code: 'POS_CM01',
    test_name: 'Midfield Line-Breaking Through Pass',
    category: 'Spesifik Posisi',
    indicator_key: 'distribusi_bola',
    indicator_label: 'Distribusi Bola',
    position_code: 'CM',
    measurement_type: 'ACCURACY',
    unit: 'tembus/umpan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Umpan Tembus Lini',
    inputLabel2: 'Total Percobaan',
    min_tier: 1,
    description: '[Khusus DM/CM/AM] Ketepatan umpan progresif membelah blok lawan di lini tengah.'
  },
  {
    id: '22222222-2222-4222-8222-000000000508',
    test_code: 'POS_CM02',
    test_name: 'Targeted Ball Distribution',
    category: 'Spesifik Posisi',
    indicator_key: 'distribusi_bola',
    indicator_label: 'Distribusi Bola',
    position_code: 'CM',
    measurement_type: 'ACCURACY',
    unit: 'tepat/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Distribusi Tepat Target',
    inputLabel2: 'Total Percobaan',
    min_tier: 1,
    description: '[Khusus DM/CM/AM] Akurasi distribusi bola ke zona sasaran sayap dan antar-lini di bawah tempo.'
  },
  {
    id: '22222222-2222-4222-8222-000000000506',
    test_code: 'POS_WNG01',
    test_name: 'Winger Cut-Inside & Far-Post Shot',
    category: 'Spesifik Posisi',
    indicator_key: 'cut_inside',
    indicator_label: 'Cut Inside',
    position_code: 'WFR/WFL',
    measurement_type: 'ACCURACY',
    unit: 'gol/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Cut-Inside & Shot Tepat',
    inputLabel2: 'Total Percobaan',
    min_tier: 1,
    description: '[Khusus Winger] Penetrasi diagonal dari sayap dan penyelesaian ke tiang jauh.'
  },
  {
    id: '22222222-2222-4222-8222-000000000507',
    test_code: 'POS_ST01',
    test_name: 'Striker Box Movement & First-Time Finish',
    category: 'Spesifik Posisi',
    indicator_key: 'gerak_di_kotak_penalti',
    indicator_label: 'Gerak di Kotak Penalti',
    position_code: 'ST',
    measurement_type: 'ACCURACY',
    unit: 'gol/percobaan',
    is_lower_better: false,
    defaultTotal: 10,
    weight: 1.0,
    inputLabel1: 'Penyelesaian Kotak Masuk',
    inputLabel2: 'Total Peluang',
    min_tier: 1,
    description: '[Khusus ST/SS] Pergerakan melepaskan diri di kotak penalti & eksekusi klinis.'
  }
];

/**
 * Norma Benchmark 4 Tier Usia Sepakbola per `test_code`.
 * Setiap tier memiliki 4 titik anchor: { poor, fair, good, elite }.
 */
export const FOOTBALL_TEST_BENCHMARKS = {
  // FISIK
  PHY01: {
    1: { poor: 2.85, fair: 2.50, good: 2.22, elite: 2.00 },
    2: { poor: 2.55, fair: 2.26, good: 2.02, elite: 1.84 },
    3: { poor: 2.30, fair: 2.06, good: 1.86, elite: 1.70 },
    4: { poor: 2.12, fair: 1.92, good: 1.76, elite: 1.62 }
  },
  PHY02: {
    1: { poor: 6.80, fair: 6.10, good: 5.50, elite: 5.00 },
    2: { poor: 5.95, fair: 5.40, good: 4.90, elite: 4.50 },
    3: { poor: 5.20, fair: 4.75, good: 4.35, elite: 4.00 },
    4: { poor: 4.75, fair: 4.38, good: 4.05, elite: 3.78 }
  },
  PHY03: {
    1: { poor: 21.5, fair: 19.6, good: 18.0, elite: 16.6 },
    2: { poor: 19.8, fair: 18.2, good: 16.8, elite: 15.6 },
    3: { poor: 18.4, fair: 17.0, good: 15.8, elite: 14.8 },
    4: { poor: 17.4, fair: 16.2, good: 15.1, elite: 14.2 }
  },
  PHY04: {
    1: { poor: 3.45, fair: 3.15, good: 2.88, elite: 2.65 },
    2: { poor: 3.15, fair: 2.88, good: 2.62, elite: 2.42 },
    3: { poor: 2.88, fair: 2.64, good: 2.42, elite: 2.24 },
    4: { poor: 2.70, fair: 2.48, good: 2.28, elite: 2.12 }
  },
  PHY05: {
    1: { poor: 1.75, fair: 1.52, good: 1.34, elite: 1.18 },
    2: { poor: 1.58, fair: 1.38, good: 1.22, elite: 1.08 },
    3: { poor: 1.42, fair: 1.25, good: 1.10, elite: 0.98 },
    4: { poor: 1.32, fair: 1.16, good: 1.02, elite: 0.91 }
  },
  PHY06: {
    1: { poor: 240, fair: 400, good: 600, elite: 840 },
    2: { poor: 400, fair: 680, good: 1000, elite: 1360 },
    3: { poor: 720, fair: 1120, good: 1560, elite: 2040 },
    4: { poor: 1080, fair: 1560, good: 2120, elite: 2680 }
  },
  PHY07: {
    1: { poor: 110, fair: 132, good: 155, elite: 178 },
    2: { poor: 135, fair: 160, good: 185, elite: 210 },
    3: { poor: 165, fair: 192, good: 220, elite: 248 },
    4: { poor: 190, fair: 218, good: 246, elite: 275 }
  },
  PHY08: {
    1: { poor: 18, fair: 24, good: 30, elite: 36 },
    2: { poor: 24, fair: 31, good: 38, elite: 45 },
    3: { poor: 32, fair: 40, good: 48, elite: 56 },
    4: { poor: 38, fair: 47, good: 55, elite: 64 }
  },
  PHY09: {
    1: { poor: 10, fair: 18, good: 28, elite: 40 },
    2: { poor: 15, fair: 26, good: 38, elite: 52 },
    3: { poor: 22, fair: 35, good: 50, elite: 65 },
    4: { poor: 30, fair: 45, good: 60, elite: 78 }
  },
  PHY10: {
    1: { poor: 10, fair: 16, good: 24, elite: 32 },
    2: { poor: 15, fair: 24, good: 33, elite: 42 },
    3: { poor: 22, fair: 32, good: 44, elite: 56 },
    4: { poor: 30, fair: 42, good: 54, elite: 68 }
  },
  PHY11: {
    1: { poor: 12, fair: 20, good: 28, elite: 38 },
    2: { poor: 15, fair: 24, good: 34, elite: 44 },
    3: { poor: 18, fair: 28, good: 38, elite: 50 },
    4: { poor: 22, fair: 32, good: 44, elite: 56 }
  },
  PHY12: {
    1: { poor: 15, fair: 25, good: 40, elite: 60 },
    2: { poor: 25, fair: 40, good: 60, elite: 90 },
    3: { poor: 35, fair: 55, good: 80, elite: 120 },
    4: { poor: 45, fair: 70, good: 100, elite: 150 }
  },

  // TEKNIK
  TEC01: {
    1: { poor: 6, fair: 11, good: 16, elite: 22 },
    2: { poor: 10, fair: 15, good: 21, elite: 27 },
    3: { poor: 14, fair: 20, good: 26, elite: 33 },
    4: { poor: 18, fair: 24, good: 30, elite: 37 }
  },
  TEC02: {
    1: { poor: 25, fair: 48, good: 70, elite: 88 },
    2: { poor: 35, fair: 58, good: 78, elite: 92 },
    3: { poor: 45, fair: 68, good: 84, elite: 95 },
    4: { poor: 55, fair: 75, good: 88, elite: 97 }
  },
  TEC03: {
    1: { poor: 25, fair: 50, good: 72, elite: 90 },
    2: { poor: 35, fair: 58, good: 78, elite: 92 },
    3: { poor: 45, fair: 68, good: 84, elite: 95 },
    4: { poor: 55, fair: 75, good: 88, elite: 97 }
  },
  TEC04: {
    1: { poor: 15, fair: 35, good: 58, elite: 80 },
    2: { poor: 25, fair: 45, good: 68, elite: 86 },
    3: { poor: 35, fair: 58, good: 76, elite: 91 },
    4: { poor: 45, fair: 66, good: 82, elite: 94 }
  },
  TEC05: {
    1: { poor: 16.5, fair: 13.8, good: 11.4, elite: 9.6 },
    2: { poor: 14.2, fair: 12.0, good: 10.1, elite: 8.6 },
    3: { poor: 12.4, fair: 10.6, good: 9.1, elite: 7.8 },
    4: { poor: 11.2, fair: 9.7, good: 8.4, elite: 7.3 }
  },
  TEC06: {
    1: { poor: 30, fair: 50, good: 70, elite: 88 },
    2: { poor: 40, fair: 60, good: 78, elite: 92 },
    3: { poor: 50, fair: 70, good: 85, elite: 95 },
    4: { poor: 60, fair: 78, good: 90, elite: 98 }
  },
  TEC07: {
    1: { poor: 20, fair: 40, good: 65, elite: 85 },
    2: { poor: 25, fair: 50, good: 72, elite: 90 },
    3: { poor: 35, fair: 58, good: 78, elite: 92 },
    4: { poor: 45, fair: 65, good: 82, elite: 95 }
  },
  TEC08: {
    1: { poor: 20, fair: 40, good: 62, elite: 82 },
    2: { poor: 25, fair: 48, good: 70, elite: 88 },
    3: { poor: 35, fair: 58, good: 76, elite: 91 },
    4: { poor: 45, fair: 66, good: 82, elite: 94 }
  },
  TEC09: {
    1: { poor: 15, fair: 35, good: 55, elite: 78 },
    2: { poor: 25, fair: 45, good: 65, elite: 84 },
    3: { poor: 32, fair: 55, good: 74, elite: 90 },
    4: { poor: 42, fair: 64, good: 80, elite: 93 }
  },
  TEC10: {
    1: { poor: 25, fair: 45, good: 68, elite: 85 },
    2: { poor: 35, fair: 55, good: 75, elite: 90 },
    3: { poor: 45, fair: 65, good: 82, elite: 94 },
    4: { poor: 55, fair: 72, good: 86, elite: 96 }
  },
  TEC11: {
    1: { poor: 15, fair: 35, good: 55, elite: 75 },
    2: { poor: 25, fair: 45, good: 66, elite: 84 },
    3: { poor: 35, fair: 56, good: 75, elite: 90 },
    4: { poor: 45, fair: 65, good: 82, elite: 94 }
  },
  TEC12: {
    1: { poor: 20, fair: 40, good: 60, elite: 80 },
    2: { poor: 28, fair: 48, good: 68, elite: 86 },
    3: { poor: 35, fair: 58, good: 76, elite: 90 },
    4: { poor: 45, fair: 66, good: 82, elite: 94 }
  },
  TEC13: {
    1: { poor: 25, fair: 48, good: 70, elite: 88 },
    2: { poor: 35, fair: 58, good: 78, elite: 92 },
    3: { poor: 45, fair: 68, good: 84, elite: 95 },
    4: { poor: 55, fair: 75, good: 88, elite: 97 }
  },

  // TAKTIK (Objective Rondo Test)
  TAC05: {
    1: { poor: 30, fair: 50, good: 70, elite: 88 },
    2: { poor: 40, fair: 60, good: 78, elite: 92 },
    3: { poor: 50, fair: 70, good: 85, elite: 95 },
    4: { poor: 60, fair: 78, good: 90, elite: 97 }
  },

  // SPESIFIK POSISI
  POS_GK01: {
    1: { poor: 25, fair: 45, good: 68, elite: 86 },
    2: { poor: 35, fair: 55, good: 75, elite: 90 },
    3: { poor: 45, fair: 65, good: 82, elite: 94 },
    4: { poor: 55, fair: 72, good: 86, elite: 96 }
  },
  POS_GK02: {
    1: { poor: 25, fair: 45, good: 68, elite: 86 },
    2: { poor: 35, fair: 55, good: 75, elite: 90 },
    3: { poor: 45, fair: 66, good: 82, elite: 94 },
    4: { poor: 55, fair: 74, good: 88, elite: 96 }
  },
  POS_CB01: {
    1: { poor: 25, fair: 45, good: 68, elite: 85 },
    2: { poor: 35, fair: 55, good: 75, elite: 90 },
    3: { poor: 45, fair: 65, good: 82, elite: 94 },
    4: { poor: 55, fair: 74, good: 88, elite: 96 }
  },
  POS_FB01: {
    1: { poor: 20, fair: 40, good: 62, elite: 82 },
    2: { poor: 28, fair: 50, good: 70, elite: 88 },
    3: { poor: 38, fair: 60, good: 78, elite: 92 },
    4: { poor: 48, fair: 68, good: 84, elite: 95 }
  },
  POS_CM01: {
    1: { poor: 25, fair: 45, good: 68, elite: 85 },
    2: { poor: 35, fair: 56, good: 76, elite: 90 },
    3: { poor: 45, fair: 66, good: 84, elite: 94 },
    4: { poor: 55, fair: 75, good: 88, elite: 96 }
  },
  POS_CM02: {
    1: { poor: 25, fair: 45, good: 68, elite: 85 },
    2: { poor: 35, fair: 56, good: 76, elite: 90 },
    3: { poor: 45, fair: 66, good: 84, elite: 94 },
    4: { poor: 55, fair: 75, good: 88, elite: 96 }
  },
  POS_WNG01: {
    1: { poor: 20, fair: 40, good: 62, elite: 82 },
    2: { poor: 28, fair: 48, good: 70, elite: 88 },
    3: { poor: 36, fair: 58, good: 76, elite: 91 },
    4: { poor: 45, fair: 66, good: 82, elite: 94 }
  },
  POS_ST01: {
    1: { poor: 20, fair: 42, good: 65, elite: 85 },
    2: { poor: 30, fair: 52, good: 74, elite: 90 },
    3: { poor: 40, fair: 62, good: 80, elite: 93 },
    4: { poor: 50, fair: 70, good: 85, elite: 96 }
  }
};

/**
 * Indikator Kategori "Perkembangan Atlet" yang terhubung otomatis ke Modul Presensi (`academy_attendance`)
 */
export const ATTENDANCE_DEVELOPMENT_INDICATORS = [
  {
    code: 'DEV01',
    indicator_key: 'kehadiran_latihan',
    indicator_label: 'Kehadiran Latihan',
    min_tier: 1,
    description: 'Persentase kehadiran riil atlet dari tabel presensi akademi (academy_attendance).'
  },
  {
    code: 'DEV02',
    indicator_key: 'kepatuhan_program',
    indicator_label: 'Kepatuhan Program',
    min_tier: 1,
    description: 'Tingkat kepatuhan mengikuti jadwal program latihan efektif tanpa absen tanpa keterangan (Alpa).'
  },
  {
    code: 'DEV03',
    indicator_key: 'konsistensi_kehadiran',
    indicator_label: 'Konsistensi Kehadiran',
    min_tier: 1,
    description: 'Stabilitas konsistensi presensi atlet selama periode berjalan di kelas akademi.'
  }
];

/**
 * Kamus Pemetaan `indicator_key` (snake_case) ke Label Indikator CHUVATOR (Polar Area & Accordion)
 */
export const MASTER_INDICATOR_KEY_TO_LABEL = MASTER_FOOTBALL_TESTS_CATALOG.reduce(
  (acc, item) => {
    acc[item.indicator_key] = item.indicator_label;
    return acc;
  },
  {
    akselerasi: 'Akselerasi',
    kecepatan_maksimal: 'Kecepatan Maksimal',
    kelincahan: 'Kelincahan',
    perubahan_arah: 'Perubahan Arah',
    reaksi: 'Reaksi',
    daya_tahan: 'Daya Tahan',
    daya_ledak: 'Daya Ledak',
    lompatan: 'Lompatan',
    keseimbangan: 'Keseimbangan',
    kekuatan_tubuh: 'Kekuatan Tubuh',
    pemulihan: 'Pemulihan',
    kontrol_bola: 'Kontrol Bola',
    sentuhan_pertama: 'Sentuhan Pertama',
    passing_pendek: 'Passing Pendek',
    passing_jauh: 'Passing Jauh',
    dribbling: 'Dribbling',
    finishing: 'Finishing',
    crossing: 'Crossing',
    tackling: 'Tackling',
    kaki_lemah: 'Kaki Lemah',
    heading: 'Heading',
    posisi_bertahan: 'Posisi Bertahan',
    posisi_menyerang: 'Posisi Menyerang',
    membuka_ruang: 'Membuka Ruang',
    membaca_permainan: 'Membaca Permainan',
    pengambilan_keputusan: 'Pengambilan Keputusan',
    pressing: 'Pressing',
    transisi_menyerang: 'Transisi Menyerang',
    fokus: 'Fokus',
    percaya_diri: 'Percaya Diri',
    daya_juang: 'Daya Juang',
    tahan_tekanan: 'Tahan Tekanan',
    komunikasi_verbal: 'Komunikasi Verbal',
    dukungan_rekan: 'Dukungan Rekan',
    kepemimpinan: 'Kepemimpinan',
    kehadiran_latihan: 'Kehadiran Latihan',
    kepatuhan_program: 'Kepatuhan Program',
    konsistensi_kehadiran: 'Konsistensi Kehadiran',
    refleks: 'Refleks',
    distribusi_kaki: 'Distribusi Kaki',
    duel_bertahan: 'Duel Bertahan',
    overlap: 'Overlap',
    distribusi_bola: 'Distribusi Bola',
    cut_inside: 'Cut Inside',
    gerak_di_kotak_penalti: 'Gerak di Kotak Penalti'
  }
);

/**
 * Kamus Pemetaan Label Indikator -> `indicator_key` (snake_case)
 */
export const MASTER_LABEL_TO_INDICATOR_KEY = Object.entries(MASTER_INDICATOR_KEY_TO_LABEL).reduce(
  (acc, [snakeKey, label]) => {
    acc[label] = snakeKey;
    acc[String(label).toLowerCase()] = snakeKey;
    acc[snakeKey] = snakeKey;
    return acc;
  },
  {}
);

/**
 * Normalisasi input nama/kunci indikator menjadi `indicator_key` (snake_case) yang seragam 100%.
 * Contoh: "Akselerasi" -> "akselerasi", "Kontrol Bola" -> "kontrol_bola", "Kehadiran Latihan" -> "kehadiran_latihan"
 */
export function normalizeIndicatorKey(keyOrLabel = '') {
  if (!keyOrLabel) return '';
  const trimmed = String(keyOrLabel).trim();
  if (MASTER_LABEL_TO_INDICATOR_KEY[trimmed]) {
    return MASTER_LABEL_TO_INDICATOR_KEY[trimmed];
  }
  const lower = trimmed.toLowerCase();
  if (MASTER_LABEL_TO_INDICATOR_KEY[lower]) {
    return MASTER_LABEL_TO_INDICATOR_KEY[lower];
  }
  return lower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Ambil skor indikator dari objek `scores` baik berdasarkan `indicator_key` (snake_case) maupun label tampilan.
 */
export function resolveIndicatorScore(scoresMap = {}, keyOrLabel = '', defaultScore = 0) {
  if (!scoresMap || !keyOrLabel) return defaultScore;
  const snakeKey = normalizeIndicatorKey(keyOrLabel);
  const label = MASTER_INDICATOR_KEY_TO_LABEL[snakeKey] || String(keyOrLabel).trim();

  if (scoresMap[snakeKey] !== undefined && scoresMap[snakeKey] !== null && scoresMap[snakeKey] !== '') {
    const val = typeof scoresMap[snakeKey] === 'object' ? scoresMap[snakeKey].score : scoresMap[snakeKey];
    const num = Number(val);
    if (Number.isFinite(num) && num > 0) return Math.max(1, Math.min(100, Math.round(num)));
  }

  if (scoresMap[label] !== undefined && scoresMap[label] !== null && scoresMap[label] !== '') {
    const val = typeof scoresMap[label] === 'object' ? scoresMap[label].score : scoresMap[label];
    const num = Number(val);
    if (Number.isFinite(num) && num > 0) return Math.max(1, Math.min(100, Math.round(num)));
  }

  if (scoresMap[keyOrLabel] !== undefined && scoresMap[keyOrLabel] !== null && scoresMap[keyOrLabel] !== '') {
    const val = typeof scoresMap[keyOrLabel] === 'object' ? scoresMap[keyOrLabel].score : scoresMap[keyOrLabel];
    const num = Number(val);
    if (Number.isFinite(num) && num > 0) return Math.max(1, Math.min(100, Math.round(num)));
  }

  return defaultScore;
}

/**
 * Deskripsi Perilaku Nyata Lapangan (Anchored Scale 1–5) untuk Tes RUBRIC
 */
export const FOOTBALL_RUBRIC_ANCHORS = {
  posisi_bertahan: {
    1: { label: 'Pasif & Kehilangan Mark', desc: 'Sering terpaku pada bola dan membiarkan lawan bebas di ruang berbahaya.' },
    2: { label: 'Reaktif Terlambat', desc: 'Baru bergeser menutup ruang setelah lawan menguasai bola.' },
    3: { label: 'Disiplin Zona Dasar', desc: 'Menjaga jarak kawalan dan berada di sisi dalam gawang secara konsisten.' },
    4: { label: 'Antisipatif & Rapat', desc: 'Aktif menutup jalur umpan (passing lane) dan menjaga kerapatan blok.' },
    5: { label: 'Komando Pertahanan Elit', desc: 'Membaca ancaman lebih awal, mengunci ruang lawan, dan mengatur garis belakang.' }
  },
  posisi_menyerang: {
    1: { label: 'Statis di Belakang Lawan', desc: 'Tertutup bayangan bek lawan sehingga sulit menerima umpan.' },
    2: { label: 'Bergerak Setelah Dipanggil', desc: 'Baru membuka sudut dukungan setelah rekan kesulitan.' },
    3: { label: 'Tersedia di Sudut Aman', desc: 'Konsisten menyediakan opsi operan sederhana bagi pembawa bola.' },
    4: { label: 'Aktif Membentuk Segitiga', desc: 'Bergerak dinamis di ruang antarlini menciptakan keunggulan jumlah.' },
    5: { label: 'Proaktif Membongkar Blok', desc: 'Selalu berada di posisi progresif untuk mempercepat tempo serangan.' }
  },
  membuka_ruang: {
    1: { label: 'Bergerombol dengan Bola', desc: 'Bergerombol mengikuti bola sehingga mempersempit ruang bermain tim.' },
    2: { label: 'Lari Satu Arah', desc: 'Pergerakan tanpa bola mudah ditebak dan kurang tepat waktu.' },
    3: { label: 'Menjaga Lebar & Kedalaman', desc: 'Mempertahankan bentuk lapangan agar sirkulasi bola tetap lancar.' },
    4: { label: 'Timing Lari Cerdas', desc: 'Menarik bek lawan keluar posisi untuk membuka ruang bagi rekan.' },
    5: { label: 'Manipulasi Ruang Elit & Timing Sempurna', desc: 'Manipulasi ruang elit dengan eksploitasi blind-side lawan dan timing sempurna.' }
  },
  membaca_permainan: {
    1: { label: 'Tanpa Scanning', desc: 'Menerima bola tanpa menoleh lebih dulu sehingga mudah kehilangan bola.' },
    2: { label: 'Reaksi Lambat', desc: 'Baru melihat situasi sekitar setelah bola menyentuh kaki.' },
    3: { label: 'Scanning Dasar', desc: 'Sesekali menoleh sebelum menerima bola di area longgar.' },
    4: { label: 'Antisipasi Cepat', desc: 'Memindai ruang 1–2 kali sebelum bola tiba dan siap mengambil keputusan.' },
    5: { label: 'Visi 360 Derajat', desc: 'Membaca alur 2 langkah ke depan dan selalu berada selangkah lebih cepat.' }
  },
  pressing: {
    1: { label: 'Berjalan Saat Bola Hilang', desc: 'Pasif dan tidak segera bereaksi saat tim kehilangan bola.' },
    2: { label: 'Pressing Tanpa Arah', desc: 'Mengejar bola sendirian tanpa menutup jalur umpan lawan.' },
    3: { label: 'Transisi Segera', desc: 'Cepat kembali ke posisi bertahan atau menekan pembawa bola terdekat.' },
    4: { label: 'Pressing Cover Bayangan', desc: 'Menekan lawan sambil menutup jalur umpan ke area tengah.' },
    5: { label: 'Pemicu Counter-Pressing', desc: 'Memimpin tekanan kolektif instan 3 detik pasca kehilangan bola.' }
  },
  transisi_menyerang: {
    1: { label: 'Lambat Menyadari Transisi', desc: 'Tetap diam saat tim berhasil merebut bola.' },
    2: { label: 'Umpan Balik Pasif', desc: 'Cenderung menghentikan laju serangan balik dengan operan ke belakang.' },
    3: { label: 'Dukungan Maju Standar', desc: 'Ikut berlari naik membantu serangan saat bola berhasil direbut.' },
    4: { label: 'Progresi Cepat', desc: 'Segera mencari ruang kosong di depan untuk opsi serangan balik cepat.' },
    5: { label: 'Eksploitasi Transisi Kilat', desc: 'Mengubah pertahanan menjadi peluang gol dalam hitungan detik.' }
  },
  fokus: {
    1: { label: 'Mudah Terdistraksi', desc: 'Sering kehilangan fokus saat penjelasan taktik atau bola mati.' },
    2: { label: 'Fokus Fluktuatif', desc: 'Konsentrasi menurun drastis saat kelelahan atau di akhir sesi.' },
    3: { label: 'Fokus Stabil', desc: 'Mengikuti instruksi latihan dan menjaga tugas posisi dengan baik.' },
    4: { label: 'Siaga Tinggi', desc: 'Responsif pada setiap perubahan peluit dan situasi transisi.' },
    5: { label: 'Konsentrasi Penuh 90 Menit', desc: 'Tajam dan disiplin menjaga detail taktis sepanjang sesi.' }
  },
  percaya_diri: {
    1: { label: 'Ragu / Takut Minta Bola', desc: 'Ragu atau takut meminta bola serta menghindari inisiatif saat ditekan.' },
    2: { label: 'Hanya Nyaman Tanpa Tekanan', desc: 'Tampil berani hanya ketika berada di ruang bebas tanpa kawalan lawan.' },
    3: { label: 'Percaya Diri Standar', desc: 'Berani menerima dan mengalirkan bola sesuai instruksi tim.' },
    4: { label: 'Inisiatif Kuat', desc: 'Berani meminta bola, melewati lawan 1v1, dan mencoba umpan terobosan.' },
    5: { label: 'Berani di Tekanan Tinggi & Pengambil Keputusan', desc: 'Berani meminta bola di tekanan tinggi dan menjadi pengambil keputusan utama tim.' }
  },
  daya_juang: {
    1: { label: 'Mudah Menyerah', desc: 'Berhenti mengejar setelah kalah duel atau salah mengumpan.' },
    2: { label: 'Butuh Dorongan Pelatih', desc: 'Baru meningkatkan usaha setelah ditegur dari pinggir lapangan.' },
    3: { label: 'Kerja Keras Konsisten', desc: 'Menyelesaikan setiap drill dan duel dengan usaha penuh.' },
    4: { label: 'Resiliensi Tinggi', desc: 'Langsung berusaha merebut bola kembali setelah melakukan kesalahan.' },
    5: { label: 'Determinasi TanpaBatas', desc: 'Menjadi motor semangat juang tim di setiap perebutan bola.' }
  },
  tahan_tekanan: {
    1: { label: 'Panik Saat Ditekan', desc: 'Sering membuang bola sembarangan ketika lawan mendekat.' },
    2: { label: 'Tergesa-gesa', desc: 'Akurasi menurun tajam saat berada di ruang sempit.' },
    3: { label: 'Cukup Tenang', desc: 'Mampu mengamankan bola dari tekanan satu pemain lawan.' },
    4: { label: 'Stabil di Ruang Sempit', desc: 'Melindungi bola dan keluar dari tekanan dengan kontrol rapi.' },
    5: { label: 'Klinis di Momen Krusial', desc: 'Semakin tenang dan akurat pada situasi pertandingan bertekanan tinggi.' }
  },
  komunikasi_verbal: {
    1: { label: 'Pasif / Diam', desc: 'Hampir tidak pernah memberi aba-aba atau meminta bola.' },
    2: { label: 'Vokal Terbatas', desc: 'Bersuara pelan hanya ketika meminta operan di ruang terbuka.' },
    3: { label: 'Komunikasi Dasar Jelas', desc: 'Memberi panggilan "man-on", "waktu", dan meminta bola secara jelas.' },
    4: { label: 'Informatif & Aktif', desc: 'Mengarahkan pergerakan rekan sebelum bola berpindah.' },
    5: { label: 'Proaktif & Vokal', desc: 'Mengatur organisasi lini secara lantang, tepat waktu, dan konstruktif.' }
  },
  dukungan_rekan: {
    1: { label: 'Individualis / Menyalahkan Teman', desc: 'Bersikap individualis dan menyalahkan teman ketika terjadi kesalahan.' },
    2: { label: 'Kurang Peduli Sekitar', desc: 'Kurang memberi respons suportif pada keberhasilan atau kesulitan rekan setim.' },
    3: { label: 'Kooperatif', desc: 'Memberi apresiasi dan bekerja sama dengan baik di dalam tim.' },
    4: { label: 'Suportif & Membangun', desc: 'Aktif menyemangati rekan agar segera bangkit dari kesalahan.' },
    5: { label: 'Pemersatu Tim & Vokal Memberi Apresiasi', desc: 'Pemersatu tim yang konsisten menjaga atmosfer positif dan vokal memberi apresiasi.' }
  },
  kepemimpinan: {
    1: { label: 'Pasif Mengikuti Arus', desc: 'Selalu menunggu instruksi pemain lain untuk bergerak.' },
    2: { label: 'Fokus Diri Sendiri', desc: 'Disiplin secara individu namun belum mengarahkan rekan sekitar.' },
    3: { label: 'Koordinator Sektor', desc: 'Mampu mengatur komunikasi dengan 1–2 rekan di dekatnya.' },
    4: { label: 'Komandan Lini', desc: 'Mengatur keseimbangan formasi dan menjaga disiplin unitnya.' },
    5: { label: 'Kapten & Teladan Taktis', desc: 'Memimpin ritme permainan, standar kerja, dan mentalitas tim.' }
  }
};

/**
 * Cari definisi tes berdasarkan `test_code`, `id`, atau `indicator_key`
 */
export function resolveMasterFootballTest(codeOrKey) {
  if (!codeOrKey) return null;
  const normalized = String(codeOrKey).trim();
  return (
    MASTER_FOOTBALL_TESTS_CATALOG.find(
      (t) =>
        t.test_code.toUpperCase() === normalized.toUpperCase() ||
        t.id === normalized ||
        t.indicator_key === normalized
    ) || null
  );
}

/**
 * Interpolasi linier sepotong-sepotong (Piecewise Linear) untuk anchor X naik.
 */
function interpolatePiecewiseAscending(val, anchors) {
  if (!Array.isArray(anchors) || anchors.length === 0) return 1;
  if (val <= anchors[0].x) return anchors[0].y;
  const last = anchors[anchors.length - 1];
  if (val >= last.x) return last.y;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (val >= a.x && val <= b.x) {
      if (b.x === a.x) return b.y;
      const ratio = (val - a.x) / (b.x - a.x);
      return a.y + ratio * (b.y - a.y);
    }
  }
  return last.y;
}

/**
 * Konversi metrik di mana nilai lebih kecil = lebih baik (cth: Sprint, Agility, Slalom Dribble).
 */
function interpolateLowerIsBetter(metricValue, benchmark) {
  const { poor, fair, good, elite } = benchmark;
  const worstFloor = poor * 1.35;
  const bestPeak = Math.max(0.35, elite * 0.88);

  const anchors = [
    { x: -worstFloor, y: 1 },
    { x: -poor, y: SCORE_ANCHOR_POINTS.poor },
    { x: -fair, y: SCORE_ANCHOR_POINTS.fair },
    { x: -good, y: SCORE_ANCHOR_POINTS.good },
    { x: -elite, y: SCORE_ANCHOR_POINTS.elite },
    { x: -bestPeak, y: 100 }
  ];

  return interpolatePiecewiseAscending(-metricValue, anchors);
}

/**
 * Konversi metrik di mana nilai lebih besar = lebih baik (ACCURACY %, REPS, DISTANCE, Balance Hold).
 */
function interpolateHigherIsBetter(metricValue, benchmark, maxCeiling = null) {
  const { poor, fair, good, elite } = benchmark;
  const topVal =
    maxCeiling !== null
      ? Math.max(elite + 1, maxCeiling)
      : Math.max(elite + 2, elite * 1.22);

  const anchors = [
    { x: 0, y: 1 },
    { x: poor, y: SCORE_ANCHOR_POINTS.poor },
    { x: fair, y: SCORE_ANCHOR_POINTS.fair },
    { x: good, y: SCORE_ANCHOR_POINTS.good },
    { x: elite, y: SCORE_ANCHOR_POINTS.elite },
    { x: topVal, y: 100 }
  ];

  return interpolatePiecewiseAscending(metricValue, anchors);
}

/**
 * Konversi instan skala Rubrik 1-5 ke skor tetap (35, 52, 70, 84, 95).
 */
export function convertRubricLevelToScore(level) {
  if (level === '' || level === null || level === undefined) return null;
  const num = Number(level);
  if (!Number.isFinite(num) || num <= 0) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(num)));
  return RUBRIC_ANCHORED_SCORES[rounded] || 70;
}

/**
 * Fungsi Utama Konversi Skor Tes Lapangan / Rubrik secara Instan (1-100).
 * TIDAK PERNAH mengembalikan PENDING_CALIBRATION.
 *
 * @param {object} params
 * @param {string} params.testCode - Kode tes (misal 'PHY01', 'TEC03', 'MEN01')
 * @param {number} [params.tier=2] - Tier usia atlet (1..4)
 * @param {object} [params.rawValues={}] - { raw_value_1, raw_value_2, errors_count }
 * @param {object|null} [params.testMeta=null] - Override metadata tes opsional
 * @returns {number|null} Skor integer 1-100, atau null bila input utama belum diisi
 */
export function calculateAssessmentScore({
  testCode,
  tier = 2,
  rawValues = {},
  testMeta = null
} = {}) {
  const test = testMeta || resolveMasterFootballTest(testCode);
  if (!test) return null;

  const normalizedTier = Math.max(1, Math.min(4, Number(tier) || 2));

  const v1Raw =
    rawValues.raw_value_1 ??
    rawValues.rawValue1 ??
    rawValues.successful ??
    rawValues.trial1 ??
    rawValues.value ??
    '';
  const v2Raw =
    rawValues.raw_value_2 ??
    rawValues.rawValue2 ??
    rawValues.total ??
    rawValues.trial2 ??
    '';
  const errRaw =
    rawValues.errors_count ??
    rawValues.errorsCount ??
    rawValues.errors ??
    0;

  if (v1Raw === '' || v1Raw === null || v1Raw === undefined) {
    return null;
  }

  const v1 = Number(v1Raw);
  if (!Number.isFinite(v1) || v1 < 0) return null;

  const v2 =
    v2Raw !== '' && v2Raw !== null && v2Raw !== undefined && Number.isFinite(Number(v2Raw))
      ? Number(v2Raw)
      : null;
  const errors = Math.max(0, Number(errRaw) || 0);

  // 1. Tipe RUBRIC (1-5 -> 35, 52, 70, 84, 95)
  if (test.measurement_type === 'RUBRIC') {
    return convertRubricLevelToScore(v1);
  }

  const benchmarkByTier =
    FOOTBALL_TEST_BENCHMARKS[test.test_code] || FOOTBALL_TEST_BENCHMARKS[testCode];
  const benchmark = benchmarkByTier?.[normalizedTier] || benchmarkByTier?.[2] || benchmarkByTier?.[1];
  if (!benchmark) return null;

  let calculated = 1;

  // 2. Tipe ACCURACY: (successful / total) * 100
  if (test.measurement_type === 'ACCURACY') {
    let totalAttempts = test.defaultTotal || 10;
    if (v2 !== null && v2 > 0) {
      totalAttempts = v2;
    } else if (errors > 0) {
      totalAttempts = v1 + errors;
    }
    const safeTotal = Math.max(1, totalAttempts);
    const clampedSuccess = Math.max(0, Math.min(v1, safeTotal));
    const accuracyPct = (clampedSuccess / safeTotal) * 100;
    calculated = interpolateHigherIsBetter(accuracyPct, benchmark, 100);
  }
  // 3. Tipe TIME / DISTANCE / REPS
  else if (
    test.measurement_type === 'TIME' ||
    test.measurement_type === 'DISTANCE' ||
    test.measurement_type === 'REPS'
  ) {
    const isLowerBetter = Boolean(test.is_lower_better);
    const penaltyUnit = Number(test.errorPenalty ?? (isLowerBetter ? 0.25 : 0.5));

    if (isLowerBetter) {
      if (v1 <= 0) return null;
      const validTrial2 = v2 !== null && v2 > 0 ? v2 : null;
      const fastestTrial = validTrial2 !== null ? Math.min(v1, validTrial2) : v1;
      const effectiveMetric = fastestTrial + errors * penaltyUnit;
      calculated = interpolateLowerIsBetter(effectiveMetric, benchmark);
    } else {
      const validTrial2 = v2 !== null && v2 >= 0 ? v2 : null;
      const bestTrial = validTrial2 !== null ? Math.max(v1, validTrial2) : v1;
      const effectiveMetric = Math.max(0, bestTrial - errors * penaltyUnit);
      calculated = interpolateHigherIsBetter(effectiveMetric, benchmark);
    }
  } else {
    return null;
  }

  return Math.max(1, Math.min(100, Math.round(calculated)));
}

/**
 * Fungsi Penggabungan Agregat Indikator (Multi-Test Indicator Aggregation).
 * Apabila satu `indicator_key` (misal 'dribbling' dari TEC05 + TEC06, atau 'finishing' dari TEC07 + TEC08)
 * didukung oleh lebih dari satu tes pada sesi yang sama, fungsi ini menggabungkan skor
 * menggunakan rata-rata tertimbang (weighted average) menjadi satu skor indikator bulat (1-100).
 *
 * @param {Array<{ test_code?: string, testCode?: string, indicator_key?: string, indicatorKey?: string, calculated_score: number, weight?: number }>} sessionEntries
 * @returns {Record<string, { indicator_key: string, indicator_label: string, score: number, test_codes: string[], tests_count: number, source: string }>}
 */
export function aggregateIndicatorScores(sessionEntries = []) {
  if (!Array.isArray(sessionEntries) || sessionEntries.length === 0) {
    return {};
  }

  const buckets = {};

  sessionEntries.forEach((entry) => {
    if (!entry) return;
    const rawScore = Number(entry.calculated_score ?? entry.score);
    if (!Number.isFinite(rawScore) || rawScore <= 0) return;

    const code = entry.test_code || entry.testCode || '';
    const testMeta = resolveMasterFootballTest(code);
    const indicatorKey =
      entry.indicator_key || entry.indicatorKey || testMeta?.indicator_key;
    if (!indicatorKey) return;

    const weight =
      Number(entry.weight) > 0
        ? Number(entry.weight)
        : Number(testMeta?.weight) > 0
          ? Number(testMeta.weight)
          : 1.0;

    if (!buckets[indicatorKey]) {
      buckets[indicatorKey] = {
        indicator_key: indicatorKey,
        indicator_label:
          entry.indicator_label ||
          entry.indicatorLabel ||
          testMeta?.indicator_label ||
          MASTER_INDICATOR_KEY_TO_LABEL[indicatorKey] ||
          indicatorKey,
        weightedSum: 0,
        totalWeight: 0,
        test_codes: []
      };
    }

    const clampedScore = Math.max(1, Math.min(100, Math.round(rawScore)));
    buckets[indicatorKey].weightedSum += clampedScore * weight;
    buckets[indicatorKey].totalWeight += weight;
    if (code && !buckets[indicatorKey].test_codes.includes(code)) {
      buckets[indicatorKey].test_codes.push(code);
    }
  });

  const aggregated = {};
  Object.keys(buckets).forEach((key) => {
    const b = buckets[key];
    const finalScore =
      b.totalWeight > 0
        ? Math.max(1, Math.min(100, Math.round(b.weightedSum / b.totalWeight)))
        : 1;

    aggregated[key] = {
      indicator_key: b.indicator_key,
      indicator_label: b.indicator_label,
      score: finalScore,
      test_codes: b.test_codes,
      tests_count: b.test_codes.length || 1,
      source: 'battery_test'
    };
  });

  return aggregated;
}

/**
 * Klasifikasi skor 1-100 untuk Lencana Live Preview
 */
export function getAssessmentClassification(score) {
  if (score === null || score === undefined || score === '') {
    return {
      label: 'Belum Diukur',
      shortLabel: '-',
      badgeClass:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    };
  }
  const num = Number(score);
  if (!Number.isFinite(num)) {
    return {
      label: 'Belum Diukur',
      shortLabel: '-',
      badgeClass:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    };
  }
  if (num >= 90) {
    return {
      label: 'Elit',
      shortLabel: 'Elit',
      badgeClass:
        'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
    };
  }
  if (num >= 75) {
    return {
      label: 'Baik',
      shortLabel: 'Baik',
      badgeClass:
        'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800'
    };
  }
  if (num >= 55) {
    return {
      label: 'Cukup',
      shortLabel: 'Cukup',
      badgeClass:
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
    };
  }
  return {
    label: 'Perlu Pembinaan',
    shortLabel: 'Kurang',
    badgeClass:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
  };
}

/**
 * Filter daftar tes aktif berdasarkan Tier Usia (1..4), Kategori, dan Posisi Atlet
 * @param {object} [options]
 * @param {number} [options.tier=2]
 * @param {string} [options.category='ALL']
 * @param {string|null} [options.positionCode=null]
 */
export function getMasterTestsForContext({
  tier = 2,
  category = 'ALL',
  positionCode = null
} = {}) {
  const normalizedTier = Math.max(1, Math.min(4, Number(tier) || 2));

  return MASTER_FOOTBALL_TESTS_CATALOG.filter((test) => {
    const tierOk = (test.min_tier || 1) <= normalizedTier;
    const catOk =
      !category || category === 'ALL'
        ? true
        : Array.isArray(category)
          ? category.includes(test.category)
          : test.category === category;

    if (!tierOk || !catOk) return false;

    // Jika pada filter Spesifik Posisi dan positionCode dipilih, tampilkan yang cocok atau relevan
    if (
      test.category === 'Spesifik Posisi' &&
      positionCode &&
      positionCode !== 'ALL' &&
      test.position_code
    ) {
      const posUpper = String(positionCode).toUpperCase();
      if (posUpper.includes('GK')) return test.position_code === 'GK';
      if (posUpper === 'CB') return test.position_code === 'CB';
      if (['LB', 'RB', 'LB/RB', 'WB', 'LWB', 'RWB'].includes(posUpper)) {
        return test.position_code === 'LB/RB';
      }
      if (['DM', 'CM', 'AM', 'DMF', 'CMF', 'AMF', 'OUTFIELD_SSB'].includes(posUpper)) {
        return test.position_code === 'CM';
      }
      if (['LM/RM', 'WFR/WFL', 'LW', 'RW'].includes(posUpper)) {
        return test.position_code === 'WFR/WFL';
      }
      if (['ST', 'SS', 'CF', 'CF/ST'].includes(posUpper)) {
        return test.position_code === 'ST';
      }
    }

    return true;
  });
}

/**
 * Konversi persentase kehadiran latihan (0–100%) menjadi Skor Indikator (1–100).
 * Spesifikasi: Kehadiran 90%+ = Skor 95/100 (hingga 98 untuk 100%), Kehadiran <50% = Skor 40/100.
 */
export function convertAttendanceRateToScore(attendanceRatePercent) {
  const pct = Math.max(0, Math.min(100, Number(attendanceRatePercent) || 0));
  if (pct < 50) {
    return 40;
  }
  if (pct >= 90) {
    if (pct >= 98) return 98;
    if (pct >= 95) return 96;
    return 95;
  }
  if (pct >= 75) {
    // Interpolasi linier 75% (80) s.d. 90% (95)
    return Math.round(80 + ((pct - 75) / 15) * 15);
  }
  // Interpolasi linier 50% (55) s.d. 75% (80)
  return Math.round(55 + ((pct - 50) / 25) * 25);
}

/**
 * Hitung persentase kehadiran riil atlet dari rekaman `academy_attendance`
 * dan konversikan otomatis menjadi skor 1–100 untuk kategori Perkembangan Atlet:
 * - `kehadiran_latihan` (DEV01)
 * - `kepatuhan_program` (DEV02)
 * - `konsistensi_kehadiran` (DEV03)
 *
 * @param {any[]} [attendanceRows]
 * @param {string} [athleteId]
 * @param {string} [athleteName]
 */
export function calculateAthleteAttendanceMetrics(
  attendanceRows = [],
  athleteId = '',
  athleteName = ''
) {
  const safeId = String(athleteId || '').trim();
  const safeNameLower = String(athleteName || '').trim().toLowerCase();

  let totalSessions = 0;
  let hadirCount = 0;
  let izinCount = 0;
  let sakitCount = 0;
  let alpaCount = 0;

  if (Array.isArray(attendanceRows)) {
    attendanceRows.forEach((row) => {
      if (!row) return;
      // Format 1: Session row dengan array `students_data`, `students`, atau `records`
      const studentsList = Array.isArray(row.students_data)
        ? row.students_data
        : Array.isArray(row.students)
          ? row.students
          : Array.isArray(row.records)
            ? row.records
            : null;

      if (studentsList) {
        const matched = studentsList.find((st) => {
          if (!st) return false;
          const stId = String(st.studentId || st.id || st.student_id || '').trim();
          const stName = String(st.studentName || st.name || st.student_name || '').trim().toLowerCase();
          if (safeId && stId === safeId) return true;
          if (safeNameLower && stName && stName === safeNameLower) return true;
          return false;
        });

        if (matched) {
          totalSessions += 1;
          const status = String(matched.status || 'Hadir').trim().toLowerCase();
          if (status === 'hadir' || status === 'present') hadirCount += 1;
          else if (status === 'izin' || status === 'excused') izinCount += 1;
          else if (status === 'sakit' || status === 'sick') sakitCount += 1;
          else alpaCount += 1;
        }
        return;
      }

      // Format 2: Individual row `{ student_id, status }`
      const rowStudentId = String(row.student_id || row.studentId || '').trim();
      const rowStudentName = String(row.student_name || row.studentName || '').trim().toLowerCase();
      if ((safeId && rowStudentId === safeId) || (safeNameLower && rowStudentName === safeNameLower)) {
        totalSessions += 1;
        const status = String(row.status || 'Hadir').trim().toLowerCase();
        if (status === 'hadir' || status === 'present') hadirCount += 1;
        else if (status === 'izin' || status === 'excused') izinCount += 1;
        else if (status === 'sakit' || status === 'sick') sakitCount += 1;
        else alpaCount += 1;
      }
    });
  }

  // Jika data presensi akademi untuk atlet tersebut kosong / belum ada, JANGAN berikan skor 95 atau 98 secara default.
  if (totalSessions === 0) {
    const noAttendanceBadge = 'Belum Ada Presensi';
    return {
      hasAttendanceData: false,
      totalSessions: 0,
      hadirCount: 0,
      izinCount: 0,
      sakitCount: 0,
      alpaCount: 0,
      attendancePercentage: null,
      compliancePercentage: null,
      consistencyPercentage: null,
      badgeText: noAttendanceBadge,
      indicators: {
        kehadiran_latihan: {
          code: 'DEV01',
          indicator_key: 'kehadiran_latihan',
          indicator_label: 'Kehadiran Latihan',
          score: 0,
          attendancePercentage: null,
          badgeText: noAttendanceBadge,
          hasAttendanceData: false,
          source: 'attendance_sync'
        },
        kepatuhan_program: {
          code: 'DEV02',
          indicator_key: 'kepatuhan_program',
          indicator_label: 'Kepatuhan Program',
          score: 0,
          attendancePercentage: null,
          compliancePercentage: null,
          badgeText: noAttendanceBadge,
          hasAttendanceData: false,
          source: 'attendance_sync'
        },
        konsistensi_kehadiran: {
          code: 'DEV03',
          indicator_key: 'konsistensi_kehadiran',
          indicator_label: 'Konsistensi Kehadiran',
          score: 0,
          attendancePercentage: null,
          consistencyPercentage: null,
          badgeText: noAttendanceBadge,
          hasAttendanceData: false,
          source: 'attendance_sync'
        }
      }
    };
  }

  const attendancePercentage = Math.max(0, Math.min(100, Math.round((hadirCount / totalSessions) * 100)));
  const effectiveComplianceSessions = hadirCount + (izinCount + sakitCount) * 0.75;
  const compliancePercentage = Math.max(
    0,
    Math.min(100, Math.round((effectiveComplianceSessions / totalSessions) * 100))
  );
  const nonAlpaRatio = (totalSessions - alpaCount) / totalSessions;
  const consistencyPercentage = Math.max(
    0,
    Math.min(100, Math.round(((attendancePercentage * 0.65) + (nonAlpaRatio * 100 * 0.35))))
  );

  const kehadiranScore = convertAttendanceRateToScore(attendancePercentage);
  const kepatuhanScore = convertAttendanceRateToScore(compliancePercentage);
  const konsistensiScore = convertAttendanceRateToScore(consistencyPercentage);
  const badgeText = `Terhubung Otomatis ke Modul Presensi (${attendancePercentage}%)`;

  const indicators = {
    kehadiran_latihan: {
      code: 'DEV01',
      indicator_key: 'kehadiran_latihan',
      indicator_label: 'Kehadiran Latihan',
      score: kehadiranScore,
      attendancePercentage,
      badgeText,
      hasAttendanceData: true,
      source: 'attendance_sync'
    },
    kepatuhan_program: {
      code: 'DEV02',
      indicator_key: 'kepatuhan_program',
      indicator_label: 'Kepatuhan Program',
      score: kepatuhanScore,
      attendancePercentage,
      compliancePercentage,
      badgeText,
      hasAttendanceData: true,
      source: 'attendance_sync'
    },
    konsistensi_kehadiran: {
      code: 'DEV03',
      indicator_key: 'konsistensi_kehadiran',
      indicator_label: 'Konsistensi Kehadiran',
      score: konsistensiScore,
      attendancePercentage,
      consistencyPercentage,
      badgeText,
      hasAttendanceData: true,
      source: 'attendance_sync'
    }
  };

  return {
    hasAttendanceData: true,
    totalSessions,
    hadirCount,
    izinCount,
    sakitCount,
    alpaCount,
    attendancePercentage,
    compliancePercentage,
    consistencyPercentage,
    badgeText,
    indicators
  };
}

/**
 * Bangun peta skor indikator awal secara ketat (Zero-Data Integrity):
 * Tidak pernah menghasilkan nilai dummy/mock (68, 70, 71, dll.) apabila atlet belum memiliki riwayat tes.
 * Hanya mengembalikan indikator presensi apabila atlet benar-benar memiliki rekaman presensi (`hasAttendanceData === true`).
 *
 * @param {any} [options]
 * @returns {Record<string, any>}
 */
export function buildBaselineIndicatorScoresForAthlete(options = {}) {
  const {
    athleteId = '',
    athleteName = '',
    attendanceRows = []
  } = options;

  if (!Array.isArray(attendanceRows) || attendanceRows.length === 0) {
    return {};
  }

  const attendanceMetrics = calculateAthleteAttendanceMetrics(attendanceRows, athleteId, athleteName);
  if (!attendanceMetrics.hasAttendanceData) {
    return {};
  }

  const resultMap = {};
  const nowIso = new Date().toISOString();
  Object.values(attendanceMetrics.indicators).forEach((attInd) => {
    resultMap[attInd.indicator_key] = {
      id: `attendance-${athleteId}-${attInd.indicator_key}`,
      indicator_key: attInd.indicator_key,
      indicator_label: attInd.indicator_label,
      score: attInd.score,
      attendancePercentage: attInd.attendancePercentage,
      attendance_percentage: attInd.attendancePercentage,
      badgeText: attInd.badgeText,
      badge_text: attInd.badgeText,
      hasAttendanceData: true,
      test_codes: [attInd.code],
      tests_count: 1,
      source: 'attendance_sync',
      updated_at: nowIso
    };
  });

  return resultMap;
}

export const WIZARD_RESUME_STORAGE_PREFIX = 'chuvator_football_wizard_resume_';

/**
 * Buat kunci penyimpanan progres Wizard (Resume State) unik per tenant & atlet.
 */
export function buildWizardResumeStorageKey(tenantId = 'demo-tenant-1', athleteId = 'default') {
  const safeTenant = String(tenantId || 'demo-tenant-1').trim();
  const safeAthlete = String(athleteId || 'default').trim();
  return `${WIZARD_RESUME_STORAGE_PREFIX}${safeTenant}_${safeAthlete}`;
}

/**
 * Hitung ringkasan progres sesi Step-by-Step Test Wizard secara murni (pure function).
 * @param {any} [options]
 */
export function computeWizardSessionProgress(options = {}) {
  const {
    wizardTests = [],
    inputsByCode = {},
    completedTestCodes = [],
    skippedTestCodes = [],
    currentStepIndex = 0,
    tier = 2
  } = options;
  const totalSteps = Array.isArray(wizardTests) ? wizardTests.length : 0;
  if (totalSteps === 0) {
    return {
      totalSteps: 0,
      safeStepIndex: 0,
      currentStepNumber: 0,
      currentTest: null,
      currentLiveScore: null,
      completedCount: 0,
      skippedCount: 0,
      remainingCount: 0,
      progressPercent: 0
    };
  }

  const safeStepIndex = Math.max(0, Math.min(totalSteps - 1, Number(currentStepIndex) || 0));
  const currentTest = wizardTests[safeStepIndex] || null;

  const completedSet = new Set(Array.isArray(completedTestCodes) ? completedTestCodes : []);
  const skippedSet = new Set(Array.isArray(skippedTestCodes) ? skippedTestCodes : []);

  let completedCount = 0;
  let skippedCount = 0;

  wizardTests.forEach((test) => {
    const raw = inputsByCode?.[test.test_code];
    const hasScore =
      raw &&
      raw.raw_value_1 !== '' &&
      raw.raw_value_1 !== null &&
      raw.raw_value_1 !== undefined &&
      calculateAssessmentScore({
        testCode: test.test_code,
        tier,
        rawValues: raw,
        testMeta: test
      }) !== null;

    if (hasScore || completedSet.has(test.test_code)) {
      completedCount += 1;
    } else if (skippedSet.has(test.test_code)) {
      skippedCount += 1;
    }
  });

  let currentLiveScore = null;
  if (currentTest) {
    const raw = inputsByCode?.[currentTest.test_code];
    if (raw && raw.raw_value_1 !== '' && raw.raw_value_1 !== null && raw.raw_value_1 !== undefined) {
      currentLiveScore = calculateAssessmentScore({
        testCode: currentTest.test_code,
        tier,
        rawValues: {
          raw_value_1: raw.raw_value_1,
          raw_value_2:
            raw.raw_value_2 !== '' && raw.raw_value_2 !== undefined
              ? raw.raw_value_2
              : currentTest.measurement_type === 'ACCURACY'
                ? currentTest.defaultTotal || 10
                : '',
          errors_count: raw.errors_count || 0
        },
        testMeta: currentTest
      });
    }
  }

  const remainingCount = Math.max(0, totalSteps - completedCount);
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return {
    totalSteps,
    safeStepIndex,
    currentStepNumber: safeStepIndex + 1,
    currentTest,
    currentLiveScore,
    completedCount,
    skippedCount,
    remainingCount,
    progressPercent
  };
}

/**
 * Resolusi transisi langkah Wizard ('save_next' | 'skip' | 'prev' | 'goto').
 * @param {any} [options]
 */
export function resolveWizardStepTransition(options = {}) {
  const {
    currentStepIndex = 0,
    totalSteps = 1,
    testCode = '',
    action = 'save_next',
    targetStepIndex = 0,
    completedTestCodes = [],
    skippedTestCodes = []
  } = options;
  const safeTotal = Math.max(1, Number(totalSteps) || 1);
  const safeCurrent = Math.max(0, Math.min(safeTotal - 1, Number(currentStepIndex) || 0));
  const completedSet = new Set(Array.isArray(completedTestCodes) ? completedTestCodes : []);
  const skippedSet = new Set(Array.isArray(skippedTestCodes) ? skippedTestCodes : []);

  if (action === 'save_next') {
    if (testCode) {
      completedSet.add(testCode);
      skippedSet.delete(testCode);
    }
    const isLastStep = safeCurrent >= safeTotal - 1;
    return {
      nextStepIndex: isLastStep ? safeCurrent : safeCurrent + 1,
      isCompletedAllSteps: isLastStep,
      completedTestCodes: Array.from(completedSet),
      skippedTestCodes: Array.from(skippedSet)
    };
  }

  if (action === 'skip') {
    if (testCode && !completedSet.has(testCode)) {
      skippedSet.add(testCode);
    }
    const isLastStep = safeCurrent >= safeTotal - 1;
    return {
      nextStepIndex: isLastStep ? safeCurrent : safeCurrent + 1,
      isCompletedAllSteps: isLastStep,
      completedTestCodes: Array.from(completedSet),
      skippedTestCodes: Array.from(skippedSet)
    };
  }

  if (action === 'prev') {
    return {
      nextStepIndex: Math.max(0, safeCurrent - 1),
      isCompletedAllSteps: false,
      completedTestCodes: Array.from(completedSet),
      skippedTestCodes: Array.from(skippedSet)
    };
  }

  const clampedTarget = Math.max(0, Math.min(safeTotal - 1, Number(targetStepIndex) || 0));
  return {
    nextStepIndex: clampedTarget,
    isCompletedAllSteps: false,
    completedTestCodes: Array.from(completedSet),
    skippedTestCodes: Array.from(skippedSet)
  };
}
