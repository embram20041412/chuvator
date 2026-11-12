# CHUVATOR — FOOTBALL ACTIVE INDICATOR INVENTORY
**Dokumen:** `docs/assessment/FOOTBALL_ACTIVE_INDICATOR_INVENTORY.md`  
**Peran:** Senior Software Engineer & Assessment Data Analyst  
**Tanggal Inventarisasi:** 12 November 2026  
**Status Mode:** READ-ONLY Inspection (Strict Change Control Compliant)  
**Workspace Commit/Restore Verification:** Selesai diverifikasi terhadap source code aktual

---

## 1. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)

Inventarisasi aktual ini dilakukan secara langsung terhadap source code aplikasi CHUVATOR setelah restore untuk mendata seluruh indikator penilaian performa sepak bola (*Athlete Development Assessment*). Hasil audit ini menyajikan data faktual yang tersimpan dalam *codebase* tanpa mengandalkan angka atau asumsi dari laporan fase sebelumnya.

### 1.1 Metrik Kunci Hasil Audit
* **Total Indikator yang Ditemukan:** **218 indikator**
* **Total Indikator Aktif dalam Registry:** **218 indikator** (seluruh indikator berstatus aktif dan terpanggil secara terstruktur sesuai matriks tier dan posisi atlet).
* **Indikator Universal (Core Categories):** **84 indikator** (berlaku untuk semua posisi atlet pada rentang tier masing-masing).
* **Indikator Position-Specific:** **134 indikator**, terbagi atas:
  * **10 indikator** Grassroots Exploration / Usia Dini (Tier 1: 5 outfield, 5 kiper).
  * **124 indikator** Spesifik Posisi Reguler (Tier 2–4: 11 kode posisi taktis).
* **Klasifikasi Metodologi Pengukuran (Measurement Type):**
  * `OBSERVATION_RUBRIC`: **187 indikator** (penilaian observasi kualitatif pelatih skala 0–100).
  * `OBJECTIVE_TEST`: **18 indikator** (pengukuran kuantitatif fisik/teknik terukur).
  * `DEVELOPMENT_TRACKING`: **6 indikator** (progres longitudinal perkembangan atlet).
  * `READINESS_CONTEXT`: **5 indikator** (kesiapan fisik, kebugaran, dan antusiasme).
  * `ADMINISTRATIVE_DATA`: **2 indikator** (kehadiran latihan dan kepatuhan program).

---

## 2. SOURCE INSPECTION & ARSITEKTUR KODE SUMBER

Pemeriksaan source code dilakukan pada file-file utama berikut:

### 2.1 File Registry Utama
* **File:** `src/config/footballAssessmentData.js`
  * Baris 5–34: `TIER_CONFIGS` — Master 4-Tier LTAD (*Long-Term Athlete Development*) Kurikulum Filanesia PSSI.
  * Baris 36–84: `detectTierFromAge(ageInput)` — Algoritma deteksi jenjang otomatis berdasarkan usia kronologis atau tanggal lahir.
  * Baris 86–299: `FOOTBALL_POSITIONS` — Master registry 11 posisi standar (GK, CB, LB/RB, WB, DM, CM, AM, LM/RM, WFR/WFL, SS, ST) beserta total 124 indikator posisi.
  * Baris 301–326: `TIER_1_POSITIONS` — Registry 2 posisi eksplorasi Tier 1 (`OUTFIELD_SSB` dan `GK_SSB`) masing-masing 5 indikator.
  * Baris 328–333: `TIER_2_POSITIONS` — Filter pembatasan 4 posisi dasar untuk Tier 2 (`GK`, `CB`, `CM`, `ST`).
  * Baris 335–350: `FOOTBALL_PLAYING_STYLES` — 14 profil gaya bermain taktis (`STY01` s/d `STY14`).
  * Baris 352–498: `FOOTBALL_CORE_CATEGORIES` — Kamus 6 kategori inti universal dengan atribut `minTier`, `type`, dan `legacy_keys` (84 indikator).
  * Baris 500–509: `getFilteredIndicatorsForCategory(categoryKey, activeTier)` — Logika pemfilteran indikator universal (`ind.minTier <= activeTier`).
  * Baris 511–541: `getPositionIndicatorsForTier(code, activeTier)` — Logika pemfilteran pemotongan (*slicing*) indikator posisi berdasarkan tier.
  * Baris 543–550: `getAvailablePositionsForTier(activeTier)` — Penentuan posisi yang tersedia di UI sesuai tier.
  * Baris 552–559: `isFootballOrMinisoccer(selectedClass, activeAcademy)` — Logika seleksi cabor sepak bola/minisoccer.
  * Baris 575–591: `SECONDARY_FOOTBALL_POSITIONS` — Registry pilihan posisi sekunder (*hybrid roles*).

### 2.2 Konfigurasi Kurikulum & Jenjang Usia
* **File:** `src/config/tierCurriculumConfig.js`
  * Baris 14–65: `SPORT_TIERS_CONFIG.football` — Konfigurasi standar Filanesia PSSI (Fase 1: 6–9 thn, Fase 2: 10–12 thn, Fase 3: 13–16 thn, Fase 4: 17+ thn, serta ALL_AGE).
  * Baris 391–425: `getClassAgeGroupWeight(cls)` — Pemetaan bobot pengurutan kelompok umur kelas akademi.

### 2.3 Komponen Antarmuka & Penilaian
* **File:** `src/components/EvaluationSection.jsx`
  * Baris 60–72: Impor kamus data evaluasi sepak bola.
  * Baris 326–328 & 402–415: Percabangan rendering komponen `FootballAssessmentView`.
  * Baris 2954–3448: Komponen `FootballAssessmentView` yang menangani seleksi atlet, auto-deteksi tier, manual override, kalkulasi rata-rata 7 pilar, draf AI catatan pelatih, dan penyimpanan data.
  * Baris 3189–3244: Komputasi `filteredCategoryIndicators`, `axisScores`, dan penyusunan struktur `footballCategoryList` (7 pilar: Fisik, Teknik, Taktik, Mental, Komunikasi, Perkembangan, Khusus Posisi).
* **File:** `src/components/FootballEvaluationGrid.jsx`
  * Komponen grid evaluasi sepak bola alternatif yang menggunakan `TIER_CONFIGS`, `FOOTBALL_CORE_CATEGORIES`, dan `resolveScore`.
* **File:** `src/components/AthleteAssessmentEditView.jsx`
  * Modal/view pengisian skor indikator interaktif dengan resolusi dual-key (`id` dan `name` serta `legacy_keys`).
* **File:** `src/components/ScoutingPolarAreaPanel.jsx`
  * Visualisasi radar/polar area untuk 7 pilar performa sepak bola.

### 2.4 Penyimpanan Database (Supabase)
* **File:** `supabase_migration.sql` & `src/services/supabaseAcademyService.js`
  * Tabel: `academy_evaluations`
  * Kolom: `overall_score` (INTEGER), `pillar_scores` (JSONB), `scores` (JSONB).
  * Seluruh nilai indikator disimpan dalam format key-value JSONB menggunakan Canonical ID (`ind.id`).

---

## 3. LOGIKA AKTIVASI, FILTER TIER & POSISI ATLET

Implementasi aktual CHUVATOR membedakan indikator yang aktif melalui 3 tingkat penyaringan (*cascading filters*):

```
[Cabor: Sepakbola/Minisoccer]
          │
          ▼
[Development Tier (1, 2, 3, atau 4)] ──► Filter Kategori Universal (minTier <= activeTier)
          │
          ▼
[Posisi Pemain Terpilih] ───────────────► Filter Khusus Posisi (Berdasarkan Tier)
                                          ├── Tier 1: 5 Indikator (OUTFIELD_SSB / GK_SSB)
                                          ├── Tier 2: 6 Indikator (GK, CB, CM, ST)
                                          ├── Tier 3: 8 Indikator (11 Posisi)
                                          └── Tier 4: Seluruh Indikator Posisi (10–15 Indikator)
```

### 3.1 Penentuan Development Tier vs Usia Kronologis
1. **Deteksi Otomatis (AUTO):** Berdasarkan usia kronologis atlet (`birthDate` atau `age`):
   * Usia $le 9$ tahun: Tier 1 (Joy Phase)
   * Usia $10 - 12$ tahun: Tier 2 (Skill Phase)
   * Usia $13 - 16$ tahun: Tier 3 (Tactical Phase)
   * Usia $ge 17$ tahun: Tier 4 (Performance Phase)
2. **Sinkronisasi Tier Kelas:** Jika kelas memiliki `tierCode` (misal `FILANESIA_F1`, `FILANESIA_F2`, dll.) atau nama kelas memuat kata kunci fase, sistem secara otomatis mengarahkan tier ke konfigurasi kelas.
3. **Manual Override:** Pelatih memiliki opsi dropdown untuk mengubah jenjang (*Override Jenjang*) secara independen dari usia kronologis siswa (misal: atlet berbakat usia 11 tahun yang dinaikkan ke Tier 3).

### 3.2 Kondisi Indikator Aktif, Nonaktif, dan Tidak Berlaku
* **AKTIF:** Indikator universal yang memenuhi `minTier <= activeTier`, DAN indikator posisi terpilih yang masuk dalam batas pemotongan (*slice*) tier tersebut.
* **NONAKTIF (INACTIVE):**
  * Indikator universal dengan `minTier > activeTier` pada sesi evaluasi yang sedang berlangsung.
  * Indikator posisi yang urutan indeksnya melebihi kuota tier (`idx >= 6` pada Tier 2, atau `idx >= 8` pada Tier 3).
* **TIDAK BERLAKU (NOT APPLICABLE):**
  * Indikator posisi lain yang tidak dipilih untuk atlet tersebut (misal: atlet CB tidak mengevaluasi indikator GK, ST, atau AM).
  * Posisi Tier 1 (`OUTFIELD_SSB`, `GK_SSB`) tidak berlaku pada Tier 2, 3, dan 4.
  * Posisi sayap/gelandang serang (`LB/RB`, `WB`, `DM`, `AM`, `LM/RM`, `WFR/WFL`, `SS`) tidak berlaku pada Tier 1 dan Tier 2.

---

## 4. INVENTARIS LENGKAP INDIKATOR AKTIF (MASTER INVENTORY)

Berikut adalah tabel lengkap 218 indikator evaluasi sepak bola yang terdaftar dalam registry aktual (`src/config/footballAssessmentData.js`):

| Canonical ID | Indicator Name | Sport | Category | Subcategory | Position | Development Tier | Age Applicability | Status | Source File |
|---|---|---|---|---|---|---|---|---|---|
| `FTB-UNI-PHY-01` | Akselerasi | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-02` | Kelincahan | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-03` | Keseimbangan | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-04` | Mobilitas | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-05` | Koordinasi Tubuh | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-06` | Kecepatan Maksimal | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-07` | Reaksi | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-08` | Lompatan | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-09` | Perubahan Arah | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-10` | Daya Tahan | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-11` | Daya Ledak | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-12` | Kekuatan Tubuh | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-13` | Kekuatan Inti | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-14` | Sprint Berulang | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-15` | Pemulihan | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-PHY-16` | Intensitas Kerja | Sepakbola / Minisoccer | Physical / Fisik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-01` | Kontrol Bola | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-02` | Sentuhan Pertama | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-03` | Passing Pendek | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-04` | Dribbling | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-05` | Finishing | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-06` | Passing Jauh | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-07` | Kekuatan Tembakan | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-08` | Tackling | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-09` | Interception | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-10` | Clearance | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-11` | Kaki Lemah | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-12` | Umpan Terobosan | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-13` | Proteksi Bola | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-14` | Heading | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-15` | Crossing | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-16` | Bola Mati | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-17` | First Touch Bertekanan | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-18` | Duel Udara | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-19` | Umpan Satu Sentuhan | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TEC-20` | Kontrol di Ruang Sempit | Sepakbola / Minisoccer | Technical / Teknik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-01` | Posisi Bertahan | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-02` | Posisi Menyerang | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-03` | Membuka Ruang | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-04` | Membaca Permainan | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-05` | Pengambilan Keputusan | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-06` | Gerak Tanpa Bola | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-07` | Cover Rekan | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-08` | Disiplin Formasi | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-09` | Transisi Menyerang | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-10` | Transisi Bertahan | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-11` | Pressing | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-12` | Menutup Ruang | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-13` | Progresi Bola | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-14` | Serangan Balik | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-15` | Counter-Pressing | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-16` | Jarak Antarlini | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-17` | Sirkulasi Bola | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-18` | Menjaga Kedalaman | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-19` | Adaptasi Taktik | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-TAC-20` | Keputusan di Bawah Tekanan | Sepakbola / Minisoccer | Tactical / Taktik | UNKNOWN | Universal | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-01` | Fokus | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-02` | Percaya Diri | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-03` | Disiplin | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-04` | Orientasi Tim | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-05` | Kontrol Emosi | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-06` | Daya Juang | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-07` | Respons Kesalahan | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-08` | Tahan Tekanan | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-09` | Konsistensi Mental | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-MEN-10` | Keberanian Duel | Sepakbola / Minisoccer | Mental | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-01` | Komunikasi Verbal | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-02` | Dukungan Rekan | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-03` | Komunikasi Nonverbal | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-04` | Respons Instruksi | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-05` | Koordinasi Lini | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-06` | Kepemimpinan | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-07` | Koordinasi Pressing | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-COM-08` | Koordinasi Bertahan | Sepakbola / Minisoccer | Communication / Komunikasi | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-01` | Kehadiran Latihan | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-02` | Respons Latihan | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-03` | Progres Teknik | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 1, 2, 3, 4 | 6+ Thn (U-8 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-04` | Kepatuhan Program | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-05` | Progres Fisik | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-06` | Progres Taktik | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-07` | Pencapaian Target | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-08` | Kesiapan Bertanding | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-09` | Evaluasi Mandiri | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-UNI-DEV-10` | Konsistensi Performa | Sepakbola / Minisoccer | Development / Perkembangan | UNKNOWN | Universal | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:354-498` |
| `FTB-SSB-OUT-01` | Keberanian Menguasai Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | OUTFIELD_SSB (Eksplorasi Pemain Lapangan) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-OUT-02` | Koordinasi Mata-Kaki | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | OUTFIELD_SSB (Eksplorasi Pemain Lapangan) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-OUT-03` | Ketangkasan Fun Game | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | OUTFIELD_SSB (Eksplorasi Pemain Lapangan) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-OUT-04` | Semangat Mencoba Posisi Baru | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | OUTFIELD_SSB (Eksplorasi Pemain Lapangan) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-OUT-05` | Kesenangan Bermain | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | OUTFIELD_SSB (Eksplorasi Pemain Lapangan) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-GK-01` | Keberanian Menangkap Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK_SSB (Pengenalan Kiper) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-GK-02` | Koordinasi Tangan-Mata | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK_SSB (Pengenalan Kiper) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-GK-03` | Ketangkasan Gerak Dasar | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK_SSB (Pengenalan Kiper) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-GK-04` | Distribusi Bola Dasar | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK_SSB (Pengenalan Kiper) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-SSB-GK-05` | Kesenangan Bermain | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK_SSB (Pengenalan Kiper) | Tier 1 | 6–9 Thn (U-8 & U-10) | Active | `src/config/footballAssessmentData.js:301-326` |
| `FTB-POS-GK-01` | Refleks | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-02` | Posisi Kiper | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-03` | Tangkapan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-04` | Menepis Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-05` | Duel Satu Lawan Satu | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-06` | Distribusi Tangan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-07` | Distribusi Kaki | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-08` | Bola Udara | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-09` | Sweeping | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-10` | Komunikasi Pertahanan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-11` | Antisipasi Tembakan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-12` | Posisi Awal | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-13` | Penalti | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-14` | Keputusan Keluar | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-GK-15` | Build-up Kiper | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | GK (Penjaga Gawang (GK)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-01` | Duel Bertahan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-02` | Duel Udara | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-03` | Interception | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-04` | Timing Tekel | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-05` | Penjagaan Lawan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-06` | Cover Pertahanan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-07` | Posisi Garis Belakang | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-08` | Antisipasi Lari | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-09` | Clearance | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-10` | Umpan Progresif | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-11` | Build-up | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CB-12` | Transisi Bertahan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CB (Bek Tengah (CB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-01` | Duel Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-02` | Bertahan Satu Lawan Satu | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-03` | Overlap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-04` | Underlap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-05` | Akurasi Crossing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-06` | Progresi Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-07` | Recovery Run | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-08` | Cover Sisi | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-09` | Kombinasi Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LB-10` | Transisi Sisi | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LB/RB (Bek Sayap (LB/RB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-01` | Daya Jelajah | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-02` | Overlap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-03` | Underlap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-04` | Crossing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-05` | Duel Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-06` | Recovery Run | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-07` | Transisi Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-08` | Kontrol Lebar | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-09` | Dukungan Serangan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WB-10` | Ketahanan Sisi | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WB (Wingback (WB)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-01` | Proteksi Lini | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-02` | Interception | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-03` | Duel Tengah | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-04` | Screening | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-05` | Sirkulasi Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-06` | Umpan Progresif | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-07` | Orientasi Tubuh | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-08` | Kontrol Tempo | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-09` | Cover Gelandang | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-10` | Transisi Bertahan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-11` | Build-up | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-DM-12` | Disiplin Posisi | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | DM (Gelandang Bertahan (DM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-01` | Distribusi Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-02` | Progresi Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-03` | Umpan Terobosan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-04` | Kontrol Tempo | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-05` | Gerak Tanpa Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-06` | Box-to-Box | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-07` | Duel Tengah | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-08` | Pressing Tengah | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-09` | Dukungan Serangan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-10` | Recovery Bertahan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-11` | Orientasi Tubuh | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-CM-12` | Keputusan Progresif | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | CM (Gelandang Tengah (CM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-01` | Visi Umpan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-02` | Umpan Kunci | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-03` | Umpan Terobosan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-04` | Kontrol Ruang Antarlini | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-05` | Kreativitas | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-06` | Dribbling Ofensif | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-07` | Finishing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-08` | Gerak Antarlini | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-10` | Pressing Depan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-11` | Keputusan Final | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-AM-12` | Kontribusi Gol | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | AM (Gelandang Serang (AM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-01` | Kontrol Sisi | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-02` | Crossing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-03` | Dribbling Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-04` | Kombinasi Sisi | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-05` | Umpan ke Dalam | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-06` | Tracking Back | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-07` | Lebar Permainan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-08` | Transisi Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-09` | Duel 1 on 1 | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-LM-10` | Keputusan Crossing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | LM/RM (Gelandang Sayap (LM/RM)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-01` | Akselerasi Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-02` | Dribbling Ofensif | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-03` | Cut Inside | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-04` | Crossing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-05` | Finishing Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-06` | Umpan Kunci | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-07` | Lari ke Ruang | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-08` | Duel 1 on 1 | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-09` | Pressing Sayap | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-WF-10` | Keputusan Akhir | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | WFR/WFL (Winger / Sayap (WFR/WFL)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-01` | Link-up Play | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-02` | Gerak Antarlini | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-03` | Umpan Kunci | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-04` | Finishing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-05` | Lari Tanpa Bola | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-06` | Kombinasi Penyerang | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-07` | Dribbling Ofensif | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-08` | Tekanan Depan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-09` | Rebound | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-SS-10` | Keputusan Final | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | SS (Second Striker (SS)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-01` | Finishing | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-02` | Penempatan Posisi | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-03` | Lari di Belakang Bek | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-04` | Duel Udara | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-05` | Hold-up Play | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-06` | Link-up Play | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 2, 3, 4 | 10+ Thn (U-10 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-07` | Gerak di Kotak Penalti | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-08` | First-time Shot | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 3, 4 | 13+ Thn (U-14 s/d Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-09` | Tekanan Depan | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-10` | Peluang Menjadi Gol | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-11` | Serangan Tiang Dekat | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |
| `FTB-POS-ST-12` | Serangan Tiang Jauh | Sepakbola / Minisoccer | Position-Specific (Khusus Posisi) | UNKNOWN | ST (Striker (ST)) | Tier 4 | 17+ Thn (U-18 / Senior) | Active | `src/config/footballAssessmentData.js:86-299` |


---

## 5. PEMETAAN USIA & DEVELOPMENT TIER (AGE AND TIER MAPPING)

Berdasarkan implementasi kode pada `getFilteredIndicatorsForCategory` dan `getPositionIndicatorsForTier`, berikut rincian indikator yang berlaku pada setiap Development Tier:

### 5.1 Matriks Indikator Universal per Kategori & Tier

| Kategori Inti | Total Indikator | Tambahan di Tier 1 | Tambahan di Tier 2 | Tambahan di Tier 3 | Tambahan di Tier 4 |
|---|:---:|:---:|:---:|:---:|:---:|
| **Physical / Fisik** | 16 | 5 (minTier: 1) | 4 (minTier: 2) | 4 (minTier: 3) | 3 (minTier: 4) |
| **Technical / Teknik** | 20 | 5 (minTier: 1) | 6 (minTier: 2) | 5 (minTier: 3) | 4 (minTier: 4) |
| **Tactical / Taktik** | 20 | 3 (minTier: 1) | 5 (minTier: 2) | 6 (minTier: 3) | 6 (minTier: 4) |
| **Mental** | 10 | 4 (minTier: 1) | 2 (minTier: 2) | 4 (minTier: 3) | 0 (minTier: 4) |
| **Communication / Komunikasi** | 8 | 2 (minTier: 1) | 2 (minTier: 2) | 4 (minTier: 3) | 0 (minTier: 4) |
| **Development / Perkembangan** | 10 | 3 (minTier: 1) | 2 (minTier: 2) | 5 (minTier: 3) | 0 (minTier: 4) |
| **TOTAL UNIVERSAL** | **84** | **22** | **21** | **28** | **13** |
| **Kumulatif Universal Aktif** | — | **22** | **43** | **71** | **84** |

---

### 5.2 Rincian Tier 1 — U-8 & U-10 (Usia 6–9 Tahun) — Fase Kegembiraan (Joy Phase)
* **Fokus:** 4v4, tanpa posisi kaku, pengenalan bola, koordinasi motorik, dan kegembiraan bermain.
* **Indikator Universal Aktif (22 Indikator):**
  * *Fisik (5):* Akselerasi (`FTB-UNI-PHY-01`), Kelincahan (`FTB-UNI-PHY-02`), Keseimbangan (`FTB-UNI-PHY-03`), Mobilitas (`FTB-UNI-PHY-04`), Koordinasi Tubuh (`FTB-UNI-PHY-05`).
  * *Teknik (5):* Kontrol Bola (`FTB-UNI-TEC-01`), Sentuhan Pertama (`FTB-UNI-TEC-02`), Passing Pendek (`FTB-UNI-TEC-03`), Dribbling (`FTB-UNI-TEC-04`), Finishing (`FTB-UNI-TEC-05`).
  * *Taktik (3):* Posisi Bertahan (`FTB-UNI-TAC-01`), Posisi Menyerang (`FTB-UNI-TAC-02`), Membuka Ruang (`FTB-UNI-TAC-03`).
  * *Mental (4):* Fokus (`FTB-UNI-MEN-01`), Percaya Diri (`FTB-UNI-MEN-02`), Disiplin (`FTB-UNI-MEN-03`), Orientasi Tim (`FTB-UNI-MEN-04`).
  * *Komunikasi (2):* Komunikasi Verbal (`FTB-UNI-COM-01`), Dukungan Rekan (`FTB-UNI-COM-02`).
  * *Perkembangan (3):* Kehadiran Latihan (`FTB-UNI-DEV-01`), Respons Latihan (`FTB-UNI-DEV-02`), Progres Teknik (`FTB-UNI-DEV-03`).
* **Indikator Khusus Posisi Aktif (5 Indikator per atlet):**
  * Pilihan Posisi A: `OUTFIELD_SSB` (Eksplorasi Pemain Lapangan): Keberanian Menguasai Bola (`FTB-SSB-OUT-01`), Koordinasi Mata-Kaki (`FTB-SSB-OUT-02`), Ketangkasan Fun Game (`FTB-SSB-OUT-03`), Semangat Mencoba Posisi Baru (`FTB-SSB-OUT-04`), Kesenangan Bermain (`FTB-SSB-OUT-05`).
  * Pilihan Posisi B: `GK_SSB` (Pengenalan Kiper): Keberanian Menangkap Bola (`FTB-SSB-GK-01`), Koordinasi Tangan-Mata (`FTB-SSB-GK-02`), Ketangkasan Gerak Dasar (`FTB-SSB-GK-03`), Distribusi Bola Dasar (`FTB-SSB-GK-04`), Kesenangan Bermain (`FTB-SSB-GK-05`).
* **Total Indikator yang Dinilai per Atlet pada Tier 1:** **27 indikator** (22 universal + 5 posisi).
* **Indikator Tidak Berlaku di Tier 1:**
  * 62 indikator universal (minTier 2, 3, dan 4).
  * Seluruh 124 indikator posisi standar (`FOOTBALL_POSITIONS`).

---

### 5.3 Rincian Tier 2 — U-10 & U-12 (Usia 10–12 Tahun) — Fase Pengembangan Skill (Skill Phase)
* **Fokus:** 4 core skills (passing, dribbling, 1v1, finishing), format 7v7, pengenalan formasi dan lini dasar.
* **Indikator Universal Aktif (43 Indikator):**
  * 22 indikator Tier 1 + 21 indikator baru (minTier: 2):
  * *Fisik (+4):* Kecepatan Maksimal (`FTB-UNI-PHY-06`), Reaksi (`FTB-UNI-PHY-07`), Lompatan (`FTB-UNI-PHY-08`), Perubahan Arah (`FTB-UNI-PHY-09`).
  * *Teknik (+6):* Passing Jauh (`FTB-UNI-TEC-06`), Kekuatan Tembakan (`FTB-UNI-TEC-07`), Tackling (`FTB-UNI-TEC-08`), Interception (`FTB-UNI-TEC-09`), Clearance (`FTB-UNI-TEC-10`), Kaki Lemah (`FTB-UNI-TEC-11`).
  * *Taktik (+5):* Membaca Permainan (`FTB-UNI-TAC-04`), Pengambilan Keputusan (`FTB-UNI-TAC-05`), Gerak Tanpa Bola (`FTB-UNI-TAC-06`), Cover Rekan (`FTB-UNI-TAC-07`), Disiplin Formasi (`FTB-UNI-TAC-08`).
  * *Mental (+2):* Kontrol Emosi (`FTB-UNI-MEN-05`), Daya Juang (`FTB-UNI-MEN-06`).
  * *Komunikasi (+2):* Komunikasi Nonverbal (`FTB-UNI-COM-03`), Respons Instruksi (`FTB-UNI-COM-04`).
  * *Perkembangan (+2):* Kepatuhan Program (`FTB-UNI-DEV-04`), Progres Fisik (`FTB-UNI-DEV-05`).
* **Indikator Khusus Posisi Aktif (6 Indikator per atlet):**
  * Posisi dibatasi pada 4 peran fundamental (`TIER_2_POSITIONS`): `GK`, `CB`, `CM`, `ST`.
  * Sistem mengambil 6 indikator pertama (`posCfg.indicators.slice(0, 6)`):
    * *GK (6):* Refleks (`FTB-POS-GK-01`), Posisi Kiper (`FTB-POS-GK-02`), Tangkapan (`FTB-POS-GK-03`), Menepis Bola (`FTB-POS-GK-04`), Duel Satu Lawan Satu (`FTB-POS-GK-05`), Distribusi Tangan (`FTB-POS-GK-06`).
    * *CB (6):* Duel Bertahan (`FTB-POS-CB-01`), Duel Udara (`FTB-POS-CB-02`), Interception (`FTB-POS-CB-03`), Timing Tekel (`FTB-POS-CB-04`), Penjagaan Lawan (`FTB-POS-CB-05`), Cover Pertahanan (`FTB-POS-CB-06`).
    * *CM (6):* Distribusi Bola (`FTB-POS-CM-01`), Progresi Bola (`FTB-POS-CM-02`), Umpan Terobosan (`FTB-POS-CM-03`), Kontrol Tempo (`FTB-POS-CM-04`), Gerak Tanpa Bola (`FTB-POS-CM-05`), Box-to-Box (`FTB-POS-CM-06`).
    * *ST (6):* Finishing (`FTB-POS-ST-01`), Penempatan Posisi (`FTB-POS-ST-02`), Lari di Belakang Bek (`FTB-POS-ST-03`), Duel Udara (`FTB-POS-ST-04`), Hold-up Play (`FTB-POS-ST-05`), Link-up Play (`FTB-POS-ST-06`).
* **Total Indikator yang Dinilai per Atlet pada Tier 2:** **49 indikator** (43 universal + 6 posisi).
* **Indikator Tidak Berlaku di Tier 2:**
  * 41 indikator universal (minTier 3 dan 4).
  * Indikator posisi Tier 1 (`OUTFIELD_SSB`, `GK_SSB`).
  * 7 posisi non-dasar (`LB/RB`, `WB`, `DM`, `AM`, `LM/RM`, `WFR/WFL`, `SS`).
  * Indikator posisi ke-7 dst pada GK (9 indikator), CB (6 indikator), CM (6 indikator), ST (6 indikator).

---

### 5.4 Rincian Tier 3 — U-14 & U-16 (Usia 13–16 Tahun) — Fase Taktik (Tactical Phase)
* **Fokus:** 11v11, zonal pressing, formasi 4-3-3 Filanesia PSSI, transisi bermain, dan koordinasi unit tim.
* **Indikator Universal Aktif (71 Indikator):**
  * 43 indikator Tier 2 + 28 indikator baru (minTier: 3):
  * *Fisik (+4):* Daya Tahan (`FTB-UNI-PHY-10`), Daya Ledak (`FTB-UNI-PHY-11`), Kekuatan Tubuh (`FTB-UNI-PHY-12`), Kekuatan Inti (`FTB-UNI-PHY-13`).
  * *Teknik (+5):* Umpan Terobosan (`FTB-UNI-TEC-12`), Proteksi Bola (`FTB-UNI-TEC-13`), Heading (`FTB-UNI-TEC-14`), Crossing (`FTB-UNI-TEC-15`), Bola Mati (`FTB-UNI-TEC-16`).
  * *Taktik (+6):* Transisi Menyerang (`FTB-UNI-TAC-09`), Transisi Bertahan (`FTB-UNI-TAC-10`), Pressing (`FTB-UNI-TAC-11`), Menutup Ruang (`FTB-UNI-TAC-12`), Progresi Bola (`FTB-UNI-TAC-13`), Serangan Balik (`FTB-UNI-TAC-14`).
  * *Mental (+4):* Respons Kesalahan (`FTB-UNI-MEN-07`), Tahan Tekanan (`FTB-UNI-MEN-08`), Konsistensi Mental (`FTB-UNI-MEN-09`), Keberanian Duel (`FTB-UNI-MEN-10`).
  * *Komunikasi (+4):* Koordinasi Lini (`FTB-UNI-COM-05`), Kepemimpinan (`FTB-UNI-COM-06`), Koordinasi Pressing (`FTB-UNI-COM-07`), Koordinasi Bertahan (`FTB-UNI-COM-08`).
  * *Perkembangan (+5):* Progres Taktik (`FTB-UNI-DEV-06`), Pencapaian Target (`FTB-UNI-DEV-07`), Kesiapan Bertanding (`FTB-UNI-DEV-08`), Evaluasi Mandiri (`FTB-UNI-DEV-09`), Konsistensi Performa (`FTB-UNI-DEV-10`).
* **Indikator Khusus Posisi Aktif (8 Indikator per atlet):**
  * Seluruh 11 posisi taktis terbuka.
  * Sistem mengambil 8 indikator pertama (`posCfg.indicators.slice(0, 8)`) dari posisi terpilih.
* **Total Indikator yang Dinilai per Atlet pada Tier 3:** **79 indikator** (71 universal + 8 posisi).
* **Indikator Tidak Berlaku di Tier 3:**
  * 13 indikator universal dengan `minTier === 4`.
  * Indikator posisi ke-9 dst pada posisi terpilih.
  * 10 posisi lain yang tidak dipilih untuk atlet tersebut.

---

### 5.5 Rincian Tier 4 — U-18 / Senior (Usia 17+ Tahun) — Fase Penampilan (Performance Phase)
* **Fokus:** Kematangan kompetitif, performa tinggi, efektivitas taktis, dan jenjang profesional.
* **Indikator Universal Aktif (84 Indikator Penuh):**
  * 71 indikator Tier 3 + 13 indikator baru (minTier: 4):
  * *Fisik (+3):* Sprint Berulang (`FTB-UNI-PHY-14`), Pemulihan (`FTB-UNI-PHY-15`), Intensitas Kerja (`FTB-UNI-PHY-16`).
  * *Teknik (+4):* First Touch Bertekanan (`FTB-UNI-TEC-17`), Duel Udara (`FTB-UNI-TEC-18`), Umpan Satu Sentuhan (`FTB-UNI-TEC-19`), Kontrol di Ruang Sempit (`FTB-UNI-TEC-20`).
  * *Taktik (+6):* Counter-Pressing (`FTB-UNI-TAC-15`), Jarak Antarlini (`FTB-UNI-TAC-16`), Sirkulasi Bola (`FTB-UNI-TAC-17`), Menjaga Kedalaman (`FTB-UNI-TAC-18`), Adaptasi Taktik (`FTB-UNI-TAC-19`), Keputusan di Bawah Tekanan (`FTB-UNI-TAC-20`).
  * *Mental (+0):* Seluruh 10 indikator sudah aktif sejak Tier 3.
  * *Komunikasi (+0):* Seluruh 8 indikator sudah aktif sejak Tier 3.
  * *Perkembangan (+0):* Seluruh 10 indikator sudah aktif sejak Tier 3.
* **Indikator Khusus Posisi Aktif (10 s/d 15 Indikator per atlet):**
  * Seluruh indikator posisi tanpa pemotongan (`posCfg.indicators` penuh).
  * Jumlah indikator per posisi:
    * GK: 15 indikator
    * CB: 12 indikator
    * LB/RB: 10 indikator
    * WB: 10 indikator
    * DM: 12 indikator
    * CM: 12 indikator
    * AM: 11 indikator
    * LM/RM: 10 indikator
    * WFR/WFL: 10 indikator
    * SS: 10 indikator
    * ST: 12 indikator
* **Total Indikator yang Dinilai per Atlet pada Tier 4:**
  * GK: $84 + 15 =$ **99 indikator**
  * CB / DM / CM / ST: $84 + 12 =$ **96 indikator**
  * AM: $84 + 11 =$ **95 indikator**
  * LB/RB / WB / LM/RM / WFR/WFL / SS: $84 + 10 =$ **94 indikator**
* **Indikator Tidak Berlaku di Tier 4:**
  * 10 posisi taktis lain yang tidak dipilih untuk atlet tersebut.
  * Indikator grassroots Tier 1 (`OUTFIELD_SSB`, `GK_SSB`).

---

## 6. TEMUAN ANOMALI, INKONSISTENSI & KONFIGURASI TIDAK JELAS

Pemeriksaan source code secara mendalam mengungkap beberapa konfigurasi faktual yang memerlukan perhatian:

1. **Gap Penomoran ID pada Posisi AM (Gelandang Serang):**
   * Terdapat loncatan ID dari `FTB-POS-AM-08` (`Gerak Antarlini`) langsung ke `FTB-POS-AM-10` (`Pressing Depan`).
   * **ID `FTB-POS-AM-09` hilang/tidak ada** dalam file `src/config/footballAssessmentData.js` baris 207–224. Akibatnya, total indikator posisi AM berjumlah 11 indikator, bukan 12 indikator seperti gelandang lainnya (DM dan CM).
2. **Ketiadaan Indikator Tambahan `minTier: 4` pada Kategori Mental, Komunikasi, dan Perkembangan:**
   * Kategori Mental (10 indikator), Komunikasi (8 indikator), dan Perkembangan (10 indikator) telah mencapai jumlah maksimal pada Tier 3.
   * Tidak ada indikator baru berlabel `minTier: 4` untuk ketiga kategori ini. Ini berarti pada transisi dari Tier 3 ke Tier 4, parameter evaluasi untuk aspek psikologis, sosial, dan administratif tidak mengalami penambahan indikator baru, melainkan mempertahankan indikator Tier 3.
3. **Ketiadaan Subkategori (`subcategory`) Eksplisit:**
   * Di dalam file registry `src/config/footballAssessmentData.js`, objek indikator hanya memiliki atribut `id`, `name`, `minTier`, `type`, dan `legacy_keys`.
   * Tidak terdapat atribut `subcategory` atau pengelompokan tingkat dua. Oleh karena itu, seluruh kolom Subkategori pada inventarisasi diberi label **UNKNOWN** secara faktual.
4. **Mekanisme Dual-Key Resolution (`id` vs `name` vs `legacy_keys`):**
   * Pada `EvaluationSection.jsx` dan `FootballEvaluationGrid.jsx`, terdapat fungsi `resolveIndicatorScore` / `resolveScore` yang melakukan pengecekan berjenjang:
     `scores[indicator.id] ?? scores[indicator.name] ?? scores[legacyKey] ?? 0`.
   * Hal ini membuktikan bahwa database lama menyimpan skor menggunakan nama indikator (bahasa Indonesia), sementara registry baru telah distandarisasi ke Canonical ID (`FTB-*`).
5. **Dua Indikator Posisi Berlabel `OBJECTIVE_TEST` di Luar Kategori Fisik:**
   * `FTB-POS-WF-01` (`Akselerasi Sayap`) pada posisi WFR/WFL diberi tipe `OBJECTIVE_TEST`.
   * `FTB-SSB-OUT-02` (`Koordinasi Mata-Kaki`) dan `FTB-SSB-GK-02` (`Koordinasi Tangan-Mata`) serta `FTB-SSB-GK-03` (`Ketangkasan Gerak Dasar`) pada Tier 1 diberi tipe `OBJECTIVE_TEST`.
   * Sebagian besar indikator posisi lainnya bertipe `OBSERVATION_RUBRIC`.

---

## 7. IMPLIKASI UNTUK PERANCANGAN ASSESSMENT BATTERY (SCOUTING COMBINE)

Sebagai data analyst, hasil inventarisasi ini memberikan landasan strategis untuk perancangan Scouting Combine otomatis:

1. **Kelompok Uji Fisik Terukur (18 Indikator Bertipe `OBJECTIVE_TEST`):**
   * *Universal Fisik (14 Indikator):*
     * Akselerasi (`FTB-UNI-PHY-01`) ➔ Tes Sprint 10m / 20m.
     * Kelincahan (`FTB-UNI-PHY-02`) ➔ Illinois Agility Test / 5-0-5 Agility.
     * Keseimbangan (`FTB-UNI-PHY-03`) ➔ Y-Balance Test / Stork Stand Test.
     * Mobilitas (`FTB-UNI-PHY-04`) ➔ Sit and Reach / Functional Movement Screen (FMS).
     * Kecepatan Maksimal (`FTB-UNI-PHY-06`) ➔ Flying 30m Sprint Test.
     * Reaksi (`FTB-UNI-PHY-07`) ➔ Ruler Drop Test / Light Pod Reaction Test.
     * Lompatan (`FTB-UNI-PHY-08`) ➔ Countermovement Jump (CMJ) / Vertical Jump Test.
     * Perubahan Arah (`FTB-UNI-PHY-09`) ➔ T-Test / Pro Agility Shuttle.
     * Daya Tahan (`FTB-UNI-PHY-10`) ➔ Yo-Yo Intermittent Recovery Test Level 1 (YYIR1) / Bleep Test.
     * Daya Ledak (`FTB-UNI-PHY-11`) ➔ Standing Broad Jump / Medicine Ball Throw.
     * Kekuatan Tubuh (`FTB-UNI-PHY-12`) ➔ Push-up 1 Menit / Handgrip Dynamometer.
     * Kekuatan Inti (`FTB-UNI-PHY-13`) ➔ Plank Test (Detik) / Trunk Curl.
     * Sprint Berulang (`FTB-UNI-PHY-14`) ➔ Repeated Sprint Ability (RSA) 6x30m.
   * *Universal Teknik (1 Indikator):*
     * Kekuatan Tembakan (`FTB-UNI-TEC-07`) ➔ Radar Speed Gun / Sensor Laju Bola (km/jam).
   * *Khusus Posisi (3 Indikator):*
     * Akselerasi Sayap (`FTB-POS-WF-01`) ➔ Sprint Sayap 30m dengan bola/tanpa bola.
     * Koordinasi Mata-Kaki (`FTB-SSB-OUT-02`) ➔ Wall-Pass Juggling Test 30 detik.
     * Koordinasi Tangan-Mata & Ketangkasan GK (`FTB-SSB-GK-02`, `FTB-SSB-GK-03`) ➔ Rebounder Hand-Eye Catch Test.
2. **Kelompok Observasi Pertandingan & Sesi Latihan (187 Indikator `OBSERVATION_RUBRIC`):**
   * Dikonversi menjadi rubrik evaluasi pertandingan small-sided games (SSG 4v4 di Tier 1, 7v7 di Tier 2, 11v11 di Tier 3–4) dengan skala Likert 1–5 terstandarisasi yang dinormalisasi ke skor 0–100.
3. **Kelompok Administratif & Kesiapan (13 Indikator):**
   * Kehadiran latihan (`FTB-UNI-DEV-01`) dan kepatuhan program (`FTB-UNI-DEV-04`) dihitung otomatis dari modul presensi (`academy_attendance`).
   * Kesiapan bertanding (`FTB-UNI-DEV-08`) dan pemulihan (`FTB-UNI-PHY-15`) diintegrasikan dengan pre-training wellness survey.

---
*Laporan ini disusun secara faktual berdasarkan inspeksi source code CHUVATOR tanggal 12 November 2026. Tidak ada perubahan yang dilakukan terhadap source code, database, atau skrip aplikasi.*
