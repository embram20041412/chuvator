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
      { id: 'FTS-POS-GK-01', name: 'Refleks', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Refleks', 'Reaction speed'] },
      { id: 'FTS-POS-GK-02', name: 'Posisi Kiper', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Kiper', 'Goal positioning'] },
      { id: 'FTS-POS-GK-03', name: 'Tangkapan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tangkapan', 'Shot-stopping'] },
      { id: 'FTS-POS-GK-04', name: 'Menepis Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Menepis Bola', 'Deflection response'] },
      { id: 'FTS-POS-GK-05', name: 'Duel 1 on 1', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel 1 on 1', 'One-on-one defense'] },
      { id: 'FTS-POS-GK-06', name: 'Blok Kaki', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Blok Kaki', 'Low-shot defense'] },
      { id: 'FTS-POS-GK-07', name: 'Distribusi Tangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Distribusi Tangan', 'Distribution accuracy'] },
      { id: 'FTS-POS-GK-08', name: 'Distribusi Kaki', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Distribusi Kaki', 'Quick distribution decision'] },
      { id: 'FTS-POS-GK-09', name: 'Antisipasi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Antisipasi'] },
      { id: 'FTS-POS-GK-10', name: 'Komunikasi Kiper', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Komunikasi Kiper', 'Communication & organization'] },
      { id: 'FTS-POS-GK-11', name: 'Power Play', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Power Play'] },
      { id: 'FTS-POS-GK-12', name: 'Keputusan Keluar', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Keluar', 'Sweeper actions'] }
    ]
  },
  {
    code: 'FIXO',
    label: 'FIXO — Fixo / Anchor',
    shortLabel: 'Fixo / Anchor',
    indicators: [
      { id: 'FTS-POS-FIX-01', name: 'Posisi Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Bertahan', 'Defensive positioning'] },
      { id: 'FTS-POS-FIX-02', name: 'Interception', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Interception', 'Interception timing'] },
      { id: 'FTS-POS-FIX-03', name: 'Timing Tekel', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Timing Tekel'] },
      { id: 'FTS-POS-FIX-04', name: 'Duel Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Bertahan', '1v1 defensive ability'] },
      { id: 'FTS-POS-FIX-05', name: 'Cover Rekan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cover Rekan', 'Defensive coverage'] },
      { id: 'FTS-POS-FIX-06', name: 'Blok Tembakan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Blok Tembakan', 'Blocking & shot lanes'] },
      { id: 'FTS-POS-FIX-07', name: 'Membaca Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Membaca Serangan'] },
      { id: 'FTS-POS-FIX-08', name: 'Distribusi Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Distribusi Bola', 'Short-pass accuracy'] },
      { id: 'FTS-POS-FIX-09', name: 'Build-up', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Build-up', 'Build-up decision-making'] },
      { id: 'FTS-POS-FIX-10', name: 'Umpan Progresif', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Progresif', 'Line-breaking pass'] },
      { id: 'FTS-POS-FIX-11', name: 'Kontrol Tempo', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Tempo'] },
      { id: 'FTS-POS-FIX-12', name: 'Transisi Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Bertahan', 'Transition defense'] }
    ]
  },
  {
    code: 'ALA',
    label: 'ALA — Ala / Flank',
    shortLabel: 'Ala / Flank',
    indicators: [
      { id: 'FTS-POS-ALA-01', name: 'Dribbling Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dribbling Sayap', 'Tight-space dribbling'] },
      { id: 'FTS-POS-ALA-02', name: 'Akselerasi Sayap', type: 'OBJECTIVE_TEST', legacy_keys: ['Akselerasi Sayap', 'Short-distance acceleration'] },
      { id: 'FTS-POS-ALA-03', name: 'Passing Cepat', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Passing Cepat', 'One-touch passing'] },
      { id: 'FTS-POS-ALA-04', name: 'Kombinasi Serangan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kombinasi Serangan', 'Wall-pass combination'] },
      { id: 'FTS-POS-ALA-05', name: 'Cut Inside', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cut Inside', 'Cut-inside & outside attack'] },
      { id: 'FTS-POS-ALA-06', name: 'Tembakan Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tembakan Sayap', 'Shooting accuracy'] },
      { id: 'FTS-POS-ALA-07', name: 'Gerak Tanpa Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak Tanpa Bola', 'Support-angle creation'] },
      { id: 'FTS-POS-ALA-08', name: 'Pressing Sayap', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pressing Sayap', 'Counterpressing'] },
      { id: 'FTS-POS-ALA-09', name: 'Tracking Back', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tracking Back', 'Defensive recovery'] },
      { id: 'FTS-POS-ALA-10', name: 'Rotasi Posisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Rotasi Posisi', 'Rotation timing'] },
      { id: 'FTS-POS-ALA-11', name: 'Transisi Cepat', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Cepat'] },
      { id: 'FTS-POS-ALA-12', name: 'Duel Satu Lawan Satu', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Satu Lawan Satu', '1v1 attacking'] }
    ]
  },
  {
    code: 'PIVOT',
    label: 'PIVOT — Pivot',
    shortLabel: 'Pivot',
    indicators: [
      { id: 'FTS-POS-PIV-01', name: 'Proteksi Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Proteksi Bola', 'Ball shielding'] },
      { id: 'FTS-POS-PIV-02', name: 'Hold-up Play', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Hold-up Play'] },
      { id: 'FTS-POS-PIV-03', name: 'Kontrol Membelakangi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Membelakangi', 'Back-to-goal receiving'] },
      { id: 'FTS-POS-PIV-04', name: 'Finishing', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Finishing', 'Finishing accuracy'] },
      { id: 'FTS-POS-PIV-05', name: 'Tembakan Cepat', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tembakan Cepat', 'Quick-release shooting'] },
      { id: 'FTS-POS-PIV-06', name: 'Putaran Pivot', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Putaran Pivot', 'Pivot rotation'] },
      { id: 'FTS-POS-PIV-07', name: 'Link-up Play', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Link-up Play', 'Lay-off passing'] },
      { id: 'FTS-POS-PIV-08', name: 'Umpan Pantul', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Pantul', 'One-touch combination'] },
      { id: 'FTS-POS-PIV-09', name: 'Posisi Serang', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Serang', 'Box positioning'] },
      { id: 'FTS-POS-PIV-10', name: 'Duel Fisik', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Duel Fisik'] },
      { id: 'FTS-POS-PIV-11', name: 'Pressing Depan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pressing Depan', 'Pressing initiation'] },
      { id: 'FTS-POS-PIV-12', name: 'Keputusan Akhir', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Akhir', 'Composure in finishing'] }
    ]
  },
  {
    code: 'UNIVERSAL',
    label: 'UNIVERSAL — Universal',
    shortLabel: 'Universal',
    indicators: [
      { id: 'FTS-POS-UNI-01', name: 'Fleksibilitas Posisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Fleksibilitas Posisi', 'Role adaptability'] },
      { id: 'FTS-POS-UNI-02', name: 'Adaptasi Peran', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Adaptasi Peran'] },
      { id: 'FTS-POS-UNI-03', name: 'Teknik Menyeluruh', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Teknik Menyeluruh', 'Technical versatility'] },
      { id: 'FTS-POS-UNI-04', name: 'Pemahaman Taktik', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pemahaman Taktik', 'Tactical learning'] },
      { id: 'FTS-POS-UNI-05', name: 'Transisi Peran', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Peran', 'Transition adaptability'] },
      { id: 'FTS-POS-UNI-06', name: 'Keputusan Situasional', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Situasional', 'Decision-making flexibility'] },
      { id: 'FTS-POS-UNI-07', name: 'Koordinasi Tim', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Tim', 'Combination play'] },
      { id: 'FTS-POS-UNI-08', name: 'Konsistensi Lintas Posisi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Konsistensi Lintas Posisi', 'Performance consistency across roles'] },
      { id: 'FTS-POS-UNI-09', name: 'Adaptasi Formasi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Adaptasi Formasi'] },
      { id: 'FTS-POS-UNI-10', name: 'Fleksibilitas Bertahan', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Fleksibilitas Bertahan', 'Defensive responsibility'] }
    ]
  }
];

export const FUTSAL_TIER_1_POSITIONS = [
  {
    code: 'COURT_DASAR',
    label: 'Eksplorasi Pemain Lapangan (Rotasi Court Player)',
    shortLabel: 'Eksplorasi Court Player',
    indicators: [
      { id: 'FTS-SSB-CRT-01', name: 'Pengenalan Telapak Kaki (Sole Feeling)', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pengenalan Telapak Kaki (Sole Feeling)', 'Sole Control Fundamental'] },
      { id: 'FTS-SSB-CRT-02', name: 'Kelincahan Ruang Sempit', type: 'OBJECTIVE_TEST', legacy_keys: ['Kelincahan Ruang Sempit', 'Dribbling Ruang Sempit'] },
      { id: 'FTS-SSB-CRT-03', name: 'Keberanian Duel 1v1', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Duel 1v1', 'Keberanian Duel 1v1 (Attacking & Defending)'] },
      { id: 'FTS-SSB-CRT-04', name: 'Semangat Rotasi Bermain', type: 'READINESS_CONTEXT', legacy_keys: ['Semangat Rotasi Bermain'] },
      { id: 'FTS-SSB-CRT-05', name: 'Kesenangan Bermain', type: 'READINESS_CONTEXT', legacy_keys: ['Kesenangan Bermain'] }
    ]
  },
  {
    code: 'GK_DASAR',
    label: 'Pengenalan Penjaga Gawang (GK Dasar)',
    shortLabel: 'Pengenalan Kiper',
    indicators: [
      { id: 'FTS-SSB-GK-01', name: 'Keberanian Menangkap & Memblok Bola', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Menangkap & Memblok Bola', 'Keberanian Menutup Ruang Tembak'] },
      { id: 'FTS-SSB-GK-02', name: 'Refleks Tangan-Kaki Dasar', type: 'OBJECTIVE_TEST', legacy_keys: ['Refleks Tangan-Kaki Dasar', 'Refleks Tangan & Kaki Dasar'] },
      { id: 'FTS-SSB-GK-03', name: 'Lemparan Distribusi Dasar', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Lemparan Distribusi Dasar'] },
      { id: 'FTS-SSB-GK-04', name: 'Keberanian Suara/Komunikasi', type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Suara/Komunikasi', 'Keberanian Komunikasi'] },
      { id: 'FTS-SSB-GK-05', name: 'Kesenangan Bermain', type: 'READINESS_CONTEXT', legacy_keys: ['Kesenangan Bermain'] }
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

export const FUTSAL_CORE_CATEGORIES = {
  fisik: {
    key: 'fisik',
    title: 'Physical / Fisik',
    titleTier1: '1. Physical — Stimulasi Gerak & Kelincahan Refleks',
    titleDefault: '1. Physical — Kondisi Fisik Futsal',
    shortTitle: 'Fisik',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    indicators: [
      { id: 'FTS-UNI-PHY-01', name: 'Akselerasi', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Akselerasi', 'Sprint & Acceleration'] },
      { id: 'FTS-UNI-PHY-02', name: 'Kelincahan', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Kelincahan', 'Agility'] },
      { id: 'FTS-UNI-PHY-03', name: 'Reaksi', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Reaksi', 'Reaction speed'] },
      { id: 'FTS-UNI-PHY-04', name: 'Keseimbangan', minTier: 1, type: 'OBJECTIVE_TEST', legacy_keys: ['Keseimbangan', 'Body Balance'] },
      { id: 'FTS-UNI-PHY-05', name: 'Kecepatan Sprint', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Kecepatan Sprint', 'Sprint Speed'] },
      { id: 'FTS-UNI-PHY-06', name: 'Daya Tahan', minTier: 2, type: 'OBJECTIVE_TEST', legacy_keys: ['Daya Tahan', 'VO₂ Max / Cardio', 'Futsal-Specific Endurance'] },
      { id: 'FTS-UNI-PHY-07', name: 'Daya Ledak', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Daya Ledak', 'Explosive Power'] },
      { id: 'FTS-UNI-PHY-08', name: 'Kekuatan Inti', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Kekuatan Inti'] },
      { id: 'FTS-UNI-PHY-09', name: 'Kekuatan Tubuh', minTier: 4, type: 'OBJECTIVE_TEST', legacy_keys: ['Kekuatan Tubuh', 'Strength'] }
    ]
  },
  teknik: {
    key: 'teknik',
    title: 'Technical / Teknik',
    titleTier1: '2. Technical — Sole Control & Ball Feeling',
    titleDefault: '2. Technical — Teknik Futsal',
    shortTitle: 'Teknik',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    indicators: [
      { id: 'FTS-UNI-TEC-01', name: 'Kontrol Bola', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Bola', 'Dribbling & First Touch'] },
      { id: 'FTS-UNI-TEC-02', name: 'Sentuhan Pertama', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sentuhan Pertama'] },
      { id: 'FTS-UNI-TEC-03', name: 'Passing Pendek', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Passing Pendek', 'Passing Accuracy'] },
      { id: 'FTS-UNI-TEC-04', name: 'Dribbling', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dribbling'] },
      { id: 'FTS-UNI-TEC-05', name: 'Sole Control', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sole Control'] },
      { id: 'FTS-UNI-TEC-06', name: 'Passing Cepat', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Passing Cepat', 'One-Touch Passing'] },
      { id: 'FTS-UNI-TEC-07', name: 'Finishing', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Finishing', 'Shooting / Finishing'] },
      { id: 'FTS-UNI-TEC-08', name: 'Passing dengan Sole', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Passing dengan Sole'] },
      { id: 'FTS-UNI-TEC-09', name: 'Tackling', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tackling', 'Tackling / Intercepting'] },
      { id: 'FTS-UNI-TEC-10', name: 'Interception', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Interception'] },
      { id: 'FTS-UNI-TEC-11', name: 'Kaki Lemah', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kaki Lemah', 'Weak-Foot Proficiency'] },
      { id: 'FTS-UNI-TEC-12', name: 'Umpan Terobosan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Umpan Terobosan'] },
      { id: 'FTS-UNI-TEC-13', name: 'Proteksi Bola', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Proteksi Bola', 'Ball Shielding'] },
      { id: 'FTS-UNI-TEC-14', name: 'Kekuatan Tembakan', minTier: 3, type: 'OBJECTIVE_TEST', legacy_keys: ['Kekuatan Tembakan', 'Toe-Poke Shooting'] },
      { id: 'FTS-UNI-TEC-15', name: 'Feint', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Feint'] },
      { id: 'FTS-UNI-TEC-16', name: 'Blocking', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Blocking'] },
      { id: 'FTS-UNI-TEC-17', name: 'Tembakan Jarak Jauh', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tembakan Jarak Jauh'] },
      { id: 'FTS-UNI-TEC-18', name: 'First-time Shot', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['First-time Shot', 'Finishing Cepat'] },
      { id: 'FTS-UNI-TEC-19', name: 'Kontrol Ruang Sempit', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Ruang Sempit', 'Receiving Under Pressure'] },
      { id: 'FTS-UNI-TEC-20', name: 'Bola Mati', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Bola Mati'] }
    ]
  },
  taktik: {
    key: 'taktik',
    title: 'Tactical / Taktik',
    titleTier1: '3. Tactical — Persepsi Ruang Sempit & Pengenalan Permainan',
    titleDefault: '3. Tactical & Cognitive — Taktik dan Kognitif',
    shortTitle: 'Taktik',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    indicators: [
      { id: 'FTS-UNI-TAC-01', name: 'Posisi Menyerang', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Menyerang', 'Positioning'] },
      { id: 'FTS-UNI-TAC-02', name: 'Posisi Bertahan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Posisi Bertahan'] },
      { id: 'FTS-UNI-TAC-03', name: 'Membuka Ruang', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Membuka Ruang', 'Support Angle'] },
      { id: 'FTS-UNI-TAC-04', name: 'Membaca Permainan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Membaca Permainan', 'Vision & Decision Making'] },
      { id: 'FTS-UNI-TAC-05', name: 'Keputusan Bermain', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keputusan Bermain', 'Scanning'] },
      { id: 'FTS-UNI-TAC-06', name: 'Gerak Tanpa Bola', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Gerak Tanpa Bola'] },
      { id: 'FTS-UNI-TAC-07', name: 'Cover Rekan', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Cover Rekan', 'Cover Balance'] },
      { id: 'FTS-UNI-TAC-08', name: 'Menutup Jalur', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Menutup Jalur'] },
      { id: 'FTS-UNI-TAC-09', name: 'Rotasi Posisi', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Rotasi Posisi', 'Rotation Timing'] },
      { id: 'FTS-UNI-TAC-10', name: 'Transisi Menyerang', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Menyerang', 'Transition Speed'] },
      { id: 'FTS-UNI-TAC-11', name: 'Transisi Bertahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Transisi Bertahan'] },
      { id: 'FTS-UNI-TAC-12', name: 'Pressing', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pressing', 'Pressing Triggers'] },
      { id: 'FTS-UNI-TAC-13', name: 'Sirkulasi Bola', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Sirkulasi Bola'] },
      { id: 'FTS-UNI-TAC-14', name: 'Serangan Balik', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Serangan Balik'] },
      { id: 'FTS-UNI-TAC-15', name: 'Counter-Pressing', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Counter-Pressing'] },
      { id: 'FTS-UNI-TAC-16', name: 'Progresi Bola', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Progresi Bola', 'Overload Creation'] },
      { id: 'FTS-UNI-TAC-17', name: 'Kombinasi Serangan', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kombinasi Serangan'] },
      { id: 'FTS-UNI-TAC-18', name: 'Pertahanan Kompak', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Pertahanan Kompak', 'Defensive Compactness'] },
      { id: 'FTS-UNI-TAC-19', name: 'Power Play', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Power Play', 'Set-Play Understanding'] },
      { id: 'FTS-UNI-TAC-20', name: 'Adaptasi Taktik', minTier: 4, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Adaptasi Taktik'] }
    ]
  },
  mental: {
    key: 'mental',
    title: 'Mental',
    titleTier1: '4. Mental — Keberanian 1v1 & Antusiasme',
    titleDefault: '4. Mental — Mentalitas Futsal',
    shortTitle: 'Mental',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    indicators: [
      { id: 'FTS-UNI-MEN-01', name: 'Fokus', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Fokus', 'Concentration'] },
      { id: 'FTS-UNI-MEN-02', name: 'Percaya Diri', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Percaya Diri', 'Confidence in 1v1'] },
      { id: 'FTS-UNI-MEN-03', name: 'Disiplin', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Disiplin', 'Coachability'] },
      { id: 'FTS-UNI-MEN-04', name: 'Orientasi Tim', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Orientasi Tim'] },
      { id: 'FTS-UNI-MEN-05', name: 'Kontrol Emosi', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kontrol Emosi', 'Emotional Control'] },
      { id: 'FTS-UNI-MEN-06', name: 'Daya Juang', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Daya Juang', 'Resilience'] },
      { id: 'FTS-UNI-MEN-07', name: 'Respons Kesalahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Kesalahan'] },
      { id: 'FTS-UNI-MEN-08', name: 'Tahan Tekanan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Tahan Tekanan', 'Composure Under Pressure'] },
      { id: 'FTS-UNI-MEN-09', name: 'Konsistensi Mental', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Konsistensi Mental'] },
      { id: 'FTS-UNI-MEN-10', name: 'Keberanian Duel', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Keberanian Duel'] }
    ]
  },
  perkembangan: {
    key: 'perkembangan',
    title: 'Development / Perkembangan',
    titleTier1: '6. Health & Growth — Kesiapan & Pertumbuhan Usia Dini',
    titleDefault: '6. Kesehatan dan Perkembangan (Health & Development)',
    shortTitle: 'Perkembangan',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    indicators: [
      { id: 'FTS-UNI-DEV-01', name: 'Kehadiran Latihan', minTier: 1, type: 'ADMINISTRATIVE_DATA', legacy_keys: ['Kehadiran Latihan', 'Availability'] },
      { id: 'FTS-UNI-DEV-02', name: 'Respons Latihan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Latihan'] },
      { id: 'FTS-UNI-DEV-03', name: 'Progres Teknik', minTier: 1, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Progres Teknik', 'Performance Trend'] },
      { id: 'FTS-UNI-DEV-04', name: 'Kepatuhan Program', minTier: 2, type: 'ADMINISTRATIVE_DATA', legacy_keys: ['Kepatuhan Program'] },
      { id: 'FTS-UNI-DEV-05', name: 'Progres Fisik', minTier: 2, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Progres Fisik', 'Growth / Maturation'] },
      { id: 'FTS-UNI-DEV-06', name: 'Progres Taktik', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Progres Taktik'] },
      { id: 'FTS-UNI-DEV-07', name: 'Pencapaian Target', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Pencapaian Target'] },
      { id: 'FTS-UNI-DEV-08', name: 'Kesiapan Bertanding', minTier: 3, type: 'READINESS_CONTEXT', legacy_keys: ['Kesiapan Bertanding', 'Fatigue / Readiness'] },
      { id: 'FTS-UNI-DEV-09', name: 'Evaluasi Mandiri', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Evaluasi Mandiri'] },
      { id: 'FTS-UNI-DEV-10', name: 'Konsistensi Performa', minTier: 3, type: 'DEVELOPMENT_TRACKING', legacy_keys: ['Konsistensi Performa'] }
    ]
  },
  komunikasi: {
    key: 'komunikasi',
    title: 'Communication / Komunikasi',
    titleTier1: '5. Teamwork — Berbagi Bola & Komunikasi Dasar',
    titleDefault: '5. Teamwork & Communication',
    shortTitle: 'Komunikasi',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    indicators: [
      { id: 'FTS-UNI-COM-01', name: 'Komunikasi Verbal', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Komunikasi Verbal', 'Cover Communication'] },
      { id: 'FTS-UNI-COM-02', name: 'Dukungan Rekan', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Dukungan Rekan', 'Passing Support'] },
      { id: 'FTS-UNI-COM-03', name: 'Respons Instruksi', minTier: 1, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Respons Instruksi'] },
      { id: 'FTS-UNI-COM-04', name: 'Isyarat Nonverbal', minTier: 2, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Isyarat Nonverbal'] },
      { id: 'FTS-UNI-COM-05', name: 'Koordinasi Rotasi', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Rotasi', 'Rotation Coordination'] },
      { id: 'FTS-UNI-COM-06', name: 'Kepemimpinan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Kepemimpinan'] },
      { id: 'FTS-UNI-COM-07', name: 'Koordinasi Pressing', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Pressing', 'Line-of-Press Coordination'] },
      { id: 'FTS-UNI-COM-08', name: 'Koordinasi Bertahan', minTier: 3, type: 'OBSERVATION_RUBRIC', legacy_keys: ['Koordinasi Bertahan', 'Set-Play Responsibility'] }
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
    .filter((ind) => ind.minTier <= activeTier);
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
