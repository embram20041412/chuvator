# Implementasi Smart Age-Group & Tier Filtering (Modul Akademi)

## Ringkasan Perubahan

### 1. Master Konfigurasi Jenjang Kurikulum Multi-Cabor (`src/config/tierCurriculumConfig.js`)
- Dibuat konfigurasi terpusat kelompok umur dan kurikulum berstandar LTAD (Long-Term Athlete Development) dan federasi resmi:
  - **SepakBola / MiniSoccer / Futsal (FILANESIA / 4-Tier LTAD):** U-8 Grassroots (6-8 thn), U-10 Fundamental (9-10 thn), U-12 Golden Age (11-12 thn), U-14 Intermediate (13-14 thn), U-16 Youth (15-16 thn), U-18 Elite (17-18 thn), dan Umum/Lintas Usia.
  - **Tenis Lapangan (ITF Tennis10s & TDP PELTI / ITF Juniors):** T10_RED (5-8 thn), T10_ORANGE (8-9 thn), T10_GREEN (9-10 thn), PELTI_KU12 (11-12 thn), PELTI_KU14 (13-14 thn), PELTI_KU16 (15-16 thn), PELTI_KU18 (17-18 thn), dan Umum/Lintas Usia.
  - **Bulutangkis / Badminton (PBSI / SIRNAS):** Pra-Usia Dini LEVEL_1 (5-8 thn), Usia Dini LEVEL_2 (9-10 thn), Anak-Anak Sirnas U-13 LEVEL_3 (11-13 thn), Pemula Sirnas U-15 LEVEL_4 (14-15 thn), Remaja Sirnas U-17 LEVEL_5 (16-17 thn), Taruna & Dewasa LEVEL_6 (>=18 thn), dan Umum/Lintas Usia.
  - **Cabang Olahraga Lain:** U-10 Usia Dini (6-10 thn), U-12 Pemula (11-12 thn), U-14 Pengembangan (13-14 thn), U-16 Youth (15-16 thn), U-18 Prestasi (17-18 thn), dan Umum/Lintas Usia.
- Fungsi utilitas: `getTiersForSport`, `isStudentAgeMatchClass`, `getRecommendedTierForStudent`, `getSuggestedClassName`, `normalizeSportString`.

---

### 2. Modal "Buat Kelas / Kelompok Latihan" (`src/components/ClassModal.jsx`)
- **Dropdown Jenjang / Kelompok Umur (Tier):** Terintegrasi dinamis sesuai cabang olahraga yang dipilih atau diwarisi dari akademi aktif.
- **Baris 3 Kolom Input:**
  - `Usia Min (Thn)`
  - `Usia Max (Thn)`
  - `Kuota Siswa (Atlet)` (default 20, disesuaikan per kategori)
- **Auto-Fill & Rekomendasi Nama:** Ketika tier dipilih, usia min/max dan kuota otomatis terisi serta menyarankan nama kelas (misal: `"U-12 Golden Age - Grup A"`, `"ITF Red Ball - Grup A"`).
- **Penyimpanan Firestore:** Kolom `tierCode`, `tierLabel`, `minAge`, `maxAge`, dan `maxQuota` disimpan secara konsisten ke dokumen `academy_classes`.
- **Perbaikan Filter Lapangan (Court Filter):**
  - Menggunakan pencocokan nama cabor ternormalisasi (`normalizeSportString`).
  - Pemisahan visual `<optgroup>` antara Lapangan Khusus Cabor dan Lapangan GOR Lainnya (Fallback).
  - Menampilkan pemberitahuan yang jelas jika GOR belum memiliki data master lapangan dengan kategori cabang olahraga tersebut.

---

### 3. Modal "Pendaftaran Siswa Akademi Baru" (`src/components/StudentRegistrationModal.jsx`)
- **Badge Usia & Kategori Otomatis:** Begitu tanggal lahir siswa dipilih, usia dihitung seketika dan menampilkan badge ringkas: `Usia: 11 Tahun • U-12 Golden Age`.
- **Smart Filter Dropdown Kelas:**
  - Toggle `[x] Hanya Sesuai Umur (X Thn)` (aktif secara default).
  - Menandai kelas yang sesuai kelompok umur dengan tanda bintang emas `★`.
  - Jika toggle dimatikan, opsi di luar rentang umur diberi label `⚠️ [Di Luar Batas Umur]`.
  - Jika admin memilih kelas yang tidak sesuai dengan usia siswa, muncul kartu peringatan amber: *"Perhatian: Di Luar Kelompok Umur Standar. Usia siswa X tahun di luar rentang target kelas Y. Penempatan siswa membutuhkan evaluasi & persetujuan Head Coach."*

---

### 4. Kartu Kelas di Halaman Utama Akademi (`src/pages/AcademyPage.jsx`)
- Menampilkan badge kelompok umur (`tierLabel` atau `tierCode`) pada header kartu kelas.
- Menampilkan kuota terdaftar vs kapasitas maksimal: `Kuota: X/20 Atlet` beserta indikator status penuh (`● Penuh`).
- Menampilkan target rentang usia kelas (`Target Usia: X - Y Tahun`).

---

### 5. Sinkronisasi Otomatis Rapor Evaluasi Atlet (`EvaluationSection.jsx` & `TennisAssessmentView.jsx`)
- Setiap kali kelas dipilih di sub-tab Evaluasi Atlet, tier dan indikator kurikulum otomatis tersinkronisasi dengan `selectedClass.tierCode`:
  - **Tenis (`TennisAssessmentView`):** `overrideTennisLevel` otomatis menyesuaikan ke level ITF Tennis10s / PELTI yang sesuai (`T10_RED`, `T10_ORANGE`, `PELTI_KU12`, dst.).
  - **Futsal (`FutsalAssessmentView`):** `overrideFutsalTier` otomatis menyesuaikan ke Tier 1–4.
  - **Badminton (`BadmintonAssessmentView`):** `overrideBadmintonTier` otomatis menyesuaikan ke Tier 1–4 / Level PBSI.
  - **SepakBola (`FootballAssessmentView`):** `overrideTier` otomatis menyesuaikan ke Tier 1–4.

---

### 6. Verifikasi & Pengujian
- `tsc --noEmit`: 0 error
- `compile_applet`: Build succeeded tanpa error.
