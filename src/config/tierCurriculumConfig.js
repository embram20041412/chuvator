// =====================================================================
// MASTER KONFIGURASI SMART AGE-GROUP & TIER CURRICULUM
// Sinkronisasi Jenjang Usia, Kuota, dan Rapor Evaluasi Multi-Cabor
// =====================================================================

export const normalizeSportString = (str) => {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// 1. DAFTAR TIER & KELOMPOK UMUR BERDASARKAN CABANG OLAHRAGA
export const SPORT_TIERS_CONFIG = {
  // SEPAKBOLA (STANDAR RESMI KURIKULUM FILANESIA PSSI 4-FASE)
  football: [
    {
      code: 'FILANESIA_F1',
      name: 'U-8 & U-10 (Usia 6–9 Thn) — Fase Kegembiraan (Joy Phase)',
      shortLabel: 'Fase 1 — Joy Phase (6-9 Thn)',
      minAge: 6,
      maxAge: 9,
      evaluationTier: 1,
      defaultQuota: 20,
      description: 'Fokus 4v4, tanpa posisi kaku, pengenalan bola, koordinasi motorik, dan kegembiraan bermain.'
    },
    {
      code: 'FILANESIA_F2',
      name: 'U-10 & U-12 (Usia 10–12 Thn) — Fase Pengembangan Skill (Skill Phase)',
      shortLabel: 'Fase 2 — Skill Phase (10-12 Thn)',
      minAge: 10,
      maxAge: 12,
      evaluationTier: 2,
      defaultQuota: 20,
      description: 'Fokus 4 core skills (passing, dribbling, 1v1, finishing), format 7v7, dan small-sided games.'
    },
    {
      code: 'FILANESIA_F3',
      name: 'U-14 & U-16 (Usia 13–16 Thn) — Fase Taktik (Tactical Phase)',
      shortLabel: 'Fase 3 — Taktik 4-3-3 (13-16 Thn)',
      minAge: 13,
      maxAge: 16,
      evaluationTier: 3,
      defaultQuota: 24,
      description: 'Fokus 11v11, zonal pressing, formasi 4-3-3 Filanesia PSSI, transisi bermain, dan unit tim.'
    },
    {
      code: 'FILANESIA_F4',
      name: 'U-18 / Senior (Usia 17+ Thn) — Fase Penampilan (Performance Phase)',
      shortLabel: 'Fase 4 — Penampilan (17+ Thn)',
      minAge: 17,
      maxAge: 99,
      evaluationTier: 4,
      defaultQuota: 25,
      description: 'Fokus kematangan kompetitif, efektivitas taktis, performa tinggi, dan jenjang profesional.'
    },
    {
      code: 'ALL_AGE',
      name: 'Umum / Lintas Usia (Semua Umur)',
      shortLabel: 'Lintas Usia (Bebas)',
      minAge: 4,
      maxAge: 99,
      evaluationTier: 'AUTO',
      defaultQuota: 20,
      description: 'Kelas terbuka untuk semua rentang usia, rekreasi, privat, atau multi-kategori.'
    }
  ],

  // TENIS LAPANGAN (ITF TENNIS10s & TDP PELTI / ITF JUNIORS)
  tennis: [
    {
      code: 'T10_RED',
      name: 'ITF Red Ball (Usia 5 - 8 Thn)',
      shortLabel: 'Red Ball (U-8)',
      minAge: 5,
      maxAge: 8,
      evaluationTier: 'T10_RED',
      defaultQuota: 12,
      description: 'Lapangan 1/4 (11m), bola merah spons/felt 75% lebih lambat, raket 17-23 inci.'
    },
    {
      code: 'T10_ORANGE',
      name: 'ITF Orange Ball (Usia 8 - 9 Thn)',
      shortLabel: 'Orange Ball (U-9)',
      minAge: 8,
      maxAge: 9,
      evaluationTier: 'T10_ORANGE',
      defaultQuota: 12,
      description: 'Lapangan 3/4 (18m), bola oranye 50% lebih lambat, raket 23-25 inci, reli dinamis.'
    },
    {
      code: 'T10_GREEN',
      name: 'ITF Green Ball (Usia 9 - 10 Thn)',
      shortLabel: 'Green Ball (U-10)',
      minAge: 9,
      maxAge: 10,
      evaluationTier: 'T10_GREEN',
      defaultQuota: 14,
      description: 'Lapangan penuh (23.77m), bola hijau 25% lebih lambat, raket 25-26 inci, transisi taktik.'
    },
    {
      code: 'PELTI_KU12',
      name: 'PELTI KU-12 (Usia 11 - 12 Thn)',
      shortLabel: 'KU-12 PELTI',
      minAge: 11,
      maxAge: 12,
      evaluationTier: 'PELTI_KU12',
      defaultQuota: 16,
      description: 'Bola kuning standar regulasi ITF, turnamen resmi TDP PELTI KU-12.'
    },
    {
      code: 'PELTI_KU14',
      name: 'PELTI KU-14 (Usia 13 - 14 Thn)',
      shortLabel: 'KU-14 PELTI',
      minAge: 13,
      maxAge: 14,
      evaluationTier: 'PELTI_KU14',
      defaultQuota: 16,
      description: 'Pengembangan fisik intensif, servis agresif, dan strategi turnamen TDP nasional.'
    },
    {
      code: 'PELTI_KU16',
      name: 'PELTI KU-16 (Usia 15 - 16 Thn)',
      shortLabel: 'KU-16 PELTI',
      minAge: 15,
      maxAge: 16,
      evaluationTier: 'PELTI_KU16',
      defaultQuota: 18,
      description: 'Pematangan variasi spin, mental kompetitif, dan persiapan jenjang junior elite.'
    },
    {
      code: 'PELTI_KU18',
      name: 'PELTI KU-18 / ITF Junior (Usia 17 - 18 Thn)',
      shortLabel: 'KU-18 Elite',
      minAge: 17,
      maxAge: 18,
      evaluationTier: 'PELTI_KU18',
      defaultQuota: 18,
      description: 'Kompetisi sirkuit nasional TDP dan sirkuit internasional ITF World Tennis Juniors.'
    },
    {
      code: 'ALL_AGE',
      name: 'Umum / Lintas Usia (Semua Umur)',
      shortLabel: 'Lintas Usia (Bebas)',
      minAge: 4,
      maxAge: 99,
      evaluationTier: 'AUTO',
      defaultQuota: 16,
      description: 'Kelas terbuka untuk semua rentang usia, kelas rekreasi, privat, atau dewasa.'
    }
  ],

  // BULUTANGKIS / BADMINTON (PBSI / SIRKUIT NASIONAL SIRNAS)
  badminton: [
    {
      code: 'LEVEL_1',
      name: 'Pra-Usia Dini (Usia 5 - 8 Thn)',
      shortLabel: 'Pra-Usia Dini',
      minAge: 5,
      maxAge: 8,
      evaluationTier: 1,
      defaultQuota: 14,
      description: 'Pengenalan dasar koordinasi mata-tangan, footwork santai, pegangan raket (grip).'
    },
    {
      code: 'LEVEL_2',
      name: 'Usia Dini (Usia 9 - 10 Thn)',
      shortLabel: 'Usia Dini (U-11)',
      minAge: 9,
      maxAge: 10,
      evaluationTier: 1,
      defaultQuota: 16,
      description: 'Awal masuk klub resmi, akurasi servis, lob dasar, dan pengenalan turnamen lokal.'
    },
    {
      code: 'LEVEL_3',
      name: 'Anak-Anak Sirnas U-13 (Usia 11 - 13 Thn)',
      shortLabel: 'Anak-Anak (U-13)',
      minAge: 11,
      maxAge: 13,
      evaluationTier: 2,
      defaultQuota: 16,
      description: 'Mulai bersaing di sirkuit regional & Sirkuit Nasional (Sirnas U-13), drop & netting.'
    },
    {
      code: 'LEVEL_4',
      name: 'Pemula Sirnas U-15 (Usia 14 - 15 Thn)',
      shortLabel: 'Pemula (U-15)',
      minAge: 14,
      maxAge: 15,
      evaluationTier: 3,
      defaultQuota: 18,
      description: 'Pemantapan teknik smash, drive, rotasi ganda, dan peningkatan kapasitas kardio.'
    },
    {
      code: 'LEVEL_5',
      name: 'Remaja Sirnas U-17 (Usia 16 - 17 Thn)',
      shortLabel: 'Remaja (U-17)',
      minAge: 16,
      maxAge: 17,
      evaluationTier: 3,
      defaultQuota: 18,
      description: 'Taktik reli cepat, spesialisasi tunggal/ganda, pantauan talent scouting klub elit.'
    },
    {
      code: 'LEVEL_6',
      name: 'Taruna & Dewasa (Usia >= 18 Thn)',
      shortLabel: 'Taruna & Dewasa',
      minAge: 18,
      maxAge: 99,
      evaluationTier: 4,
      defaultQuota: 20,
      description: 'Kategori junior tertinggi Sirnas U-19 hingga level dewasa profesional terbuka.'
    },
    {
      code: 'ALL_AGE',
      name: 'Umum / Lintas Usia (Semua Umur)',
      shortLabel: 'Lintas Usia (Bebas)',
      minAge: 4,
      maxAge: 99,
      evaluationTier: 'AUTO',
      defaultQuota: 16,
      description: 'Kelas terbuka untuk semua rentang usia atau program latihan rekreasi.'
    }
  ],

  // CABANG OLAHRAGA LAIN (BASKET, VOLI, DLL)
  default: [
    {
      code: 'U-10',
      name: 'U-10 Usia Dini (Usia 6 - 10 Thn)',
      shortLabel: 'U-10 Dini',
      minAge: 6,
      maxAge: 10,
      evaluationTier: 1,
      defaultQuota: 20,
      description: 'Pengenalan motorik, kelincahan dasar, dan bermain beregu secara ceria.'
    },
    {
      code: 'U-12',
      name: 'U-12 Pemula (Usia 11 - 12 Thn)',
      shortLabel: 'U-12 Pemula',
      minAge: 11,
      maxAge: 12,
      evaluationTier: 1,
      defaultQuota: 20,
      description: 'Penguasaan teknik dasar cabang olahraga dan peraturan dasar pertandingan.'
    },
    {
      code: 'U-14',
      name: 'U-14 Pengembangan (Usia 13 - 14 Thn)',
      shortLabel: 'U-14 Menengah',
      minAge: 13,
      maxAge: 14,
      evaluationTier: 2,
      defaultQuota: 22,
      description: 'Peningkatan daya tahan fisik, taktik kerja sama tim, dan transisi bermain.'
    },
    {
      code: 'U-16',
      name: 'U-16 Youth (Usia 15 - 16 Thn)',
      shortLabel: 'U-16 Youth',
      minAge: 15,
      maxAge: 16,
      evaluationTier: 3,
      defaultQuota: 24,
      description: 'Pengembangan fisik intensif dan taktik kompetitif tingkat daerah/nasional.'
    },
    {
      code: 'U-18',
      name: 'U-18 Prestasi (Usia 17 - 18 Thn)',
      shortLabel: 'U-18 Prestasi',
      minAge: 17,
      maxAge: 18,
      evaluationTier: 4,
      defaultQuota: 25,
      description: 'Persiapan kejuaraan prestasi, tim pelajar daerah, atau level universitas/senior.'
    },
    {
      code: 'ALL_AGE',
      name: 'Umum / Lintas Usia (Semua Umur)',
      shortLabel: 'Lintas Usia (Bebas)',
      minAge: 4,
      maxAge: 99,
      evaluationTier: 'AUTO',
      defaultQuota: 20,
      description: 'Kelas terbuka untuk semua rentang usia tanpa batasan khusus.'
    }
  ]
};

// 2. DETEKSI KELOMPOK OLAHRAGA
export function getSportCategoryKey(sportName) {
  const norm = normalizeSportString(sportName);
  if (!norm) return 'default';
  
  if (norm.includes('tenis') || norm.includes('tennis')) {
    if (norm.includes('meja') || norm.includes('table')) {
      return 'default';
    }
    return 'tennis';
  }

  if (norm.includes('badminton') || norm.includes('bulutangkis') || norm.includes('bulu')) {
    return 'badminton';
  }

  if (
    norm.includes('sepak') ||
    norm.includes('bola') ||
    norm.includes('soccer') ||
    norm.includes('futsal') ||
    norm.includes('minisoccer')
  ) {
    return 'football';
  }

  return 'default';
}

// 3. MENGAMBIL DAFTAR TIER UNTUK CABANG OLAHRAGA
export function getTiersForSport(sportName) {
  const key = getSportCategoryKey(sportName);
  return SPORT_TIERS_CONFIG[key] || SPORT_TIERS_CONFIG.default;
}

// 4. MEMERIKSA APAKAH USIA SISWA SESUAI DENGAN KELAS
export function isStudentAgeMatchClass(studentAge, cls) {
  if (!cls) return true;
  if (!studentAge || studentAge <= 0) return true;
  
  // Jika kelas bebas / ALL_AGE / tidak diset batas usia, selalu match
  if (cls.tierCode === 'ALL_AGE') return true;
  
  const min = typeof cls.minAge === 'number' ? cls.minAge : (parseInt(cls.minAge, 10) || null);
  const max = typeof cls.maxAge === 'number' ? cls.maxAge : (parseInt(cls.maxAge, 10) || null);
  
  if (min === null && max === null) return true;
  
  if (min !== null && studentAge < min) return false;
  if (max !== null && studentAge > max) return false;
  
  return true;
}

// 5. MENDAPATKAN LABEL REKOMENDASI KATEGORI UMUR SISWA
export function getRecommendedTierForStudent(studentAge, sportName) {
  if (!studentAge || studentAge <= 0) return null;
  const tiers = getTiersForSport(sportName);
  
  // Cari tier spesifik yang cocok (kecualikan ALL_AGE)
  const matched = tiers.find(
    (t) => t.code !== 'ALL_AGE' && studentAge >= t.minAge && studentAge <= t.maxAge
  );

  return matched || tiers[0];
}

// 6. SARAN NAMA KELAS OTOMATIS
export function getSuggestedClassName(sportName, tier) {
  if (!tier) return '';
  const key = getSportCategoryKey(sportName);
  if (key === 'football') {
    if (tier.code === 'FILANESIA_F1') return 'Fase Kegembiraan Joy Phase - Grup A';
    if (tier.code === 'FILANESIA_F2') return 'Fase Skill Phase - Grup A';
    if (tier.code === 'FILANESIA_F3') return 'Fase Taktik 4-3-3 - Grup A';
    if (tier.code === 'FILANESIA_F4') return 'Fase Performance Phase - Prestasi';
  }

  if (key === 'tennis') {
    if (tier.code === 'T10_RED') return 'ITF Red Ball - Grup A';
    if (tier.code === 'T10_ORANGE') return 'ITF Orange Ball - Grup A';
    if (tier.code === 'T10_GREEN') return 'ITF Green Ball - Grup A';
    if (tier.code.startsWith('PELTI_')) return `${tier.shortLabel} - Prestasi`;
    return 'Kelas Tenis - Grup A';
  }

  if (key === 'badminton') {
    if (tier.code === 'LEVEL_1') return 'Pra-Usia Dini - Pemula';
    if (tier.code === 'LEVEL_2') return 'Usia Dini - Kelompok A';
    if (tier.code.startsWith('LEVEL_')) return `${tier.shortLabel} - Prestasi`;
    return 'Kelas Badminton - Grup A';
  }

  if (tier.code === 'ALL_AGE') {
    return 'Kelas Terbuka / Lintas Usia';
  }

  return `${tier.shortLabel} - Grup A`;
}

// 7. HELPER SORTING KELOMPOK UMUR (AGE-GROUP SORT)
export function getClassAgeGroupWeight(cls) {
  if (!cls) return 99;

  // 1. Explicit tierCode or code
  const code = String(cls.tierCode || cls.code || '').toUpperCase().replace(/\s+/g, '');
  if (['FILANESIA_F1', 'F1', 'U-8', 'U8', 'GRASSROOTS', 'LEVEL_1', 'T10_RED', 'JOY_PHASE'].includes(code)) return 1;
  if (['FILANESIA_F2', 'F2', 'U-10', 'U10', 'U-12', 'U12', 'FUNDAMENTAL', 'LEVEL_2', 'T10_ORANGE', 'T10_GREEN', 'SKILL_PHASE'].includes(code)) return 2;
  if (['FILANESIA_F3', 'F3', 'U-14', 'U14', 'U-16', 'U16', 'INTERMEDIATE', 'TACTICAL_PHASE', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'PELTI_KU14', 'PELTI_KU16'].includes(code)) return 3;
  if (['FILANESIA_F4', 'F4', 'U-18', 'U18', 'SENIOR', 'ELITE', 'PERFORMANCE_PHASE', 'LEVEL_6', 'PELTI_KU18'].includes(code)) return 4;
  if (code === 'ALL_AGE') return 98;

  // 2. minAge / maxAge
  const minAge = typeof cls.minAge === 'number' ? cls.minAge : (parseInt(cls.minAge, 10) || null);
  const maxAge = typeof cls.maxAge === 'number' ? cls.maxAge : (parseInt(cls.maxAge, 10) || null);
  if (minAge !== null || maxAge !== null) {
    const age = minAge !== null ? minAge : maxAge;
    if (age <= 8) return 1;
    if (age <= 10) return 2;
    if (age <= 12) return 3;
    if (age <= 14) return 4;
    if (age <= 16) return 5;
    if (age <= 18) return 6;
  }

  // 3. Inspection of className or name or label string
  const str = String(cls.className || cls.name || cls.label || '').toUpperCase();
  if (str.includes('U-8') || str.includes('U8') || str.includes('GRASSROOTS') || str.includes('RED BALL') || str.includes('PRA-USIA DINI')) return 1;
  if (str.includes('U-10') || str.includes('U10') || str.includes('FUNDAMENTAL') || str.includes('ORANGE BALL') || str.includes('GREEN BALL') || str.includes('USIA DINI')) return 2;
  if (str.includes('U-12') || str.includes('U12') || str.includes('GOLDEN AGE') || str.includes('ANAK-ANAK') || str.includes('KU-12')) return 3;
  if (str.includes('U-14') || str.includes('U14') || str.includes('INTERMEDIATE') || str.includes('PEMULA') || str.includes('KU-14')) return 4;
  if (str.includes('U-16') || str.includes('U16') || str.includes('YOUTH') || str.includes('REMAJA') || str.includes('KU-16')) return 5;
  if (str.includes('U-18') || str.includes('U18') || str.includes('SENIOR') || str.includes('ELITE') || str.includes('TARUNA') || str.includes('DEWASA') || str.includes('KU-18')) return 6;

  return 99;
}

export function sortClassesByAgeGroup(classesList = []) {
  if (!Array.isArray(classesList)) return [];
  return [...classesList].sort((a, b) => {
    const weightA = getClassAgeGroupWeight(a);
    const weightB = getClassAgeGroupWeight(b);
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    const nameA = String(a?.className || a?.name || '');
    const nameB = String(b?.className || b?.name || '');
    return nameA.localeCompare(nameB);
  });
}
