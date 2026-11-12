# CHUVATOR — FOOTBALL ASSESSMENT BATTERY
## TASK 02.1: OBJECTIVE TEST MAPPING SPECIFICATION & CORRECTION

**Dokumen:** `docs/assessment/FOOTBALL_OBJECTIVE_TEST_MAPPING.md`  
**Versi:** 2.1 (Penyempurnaan Protokol Lapangan, Validitas Konstruk, & Spesifikasi Kalibrasi)  
**Peran:** Senior Software Engineer & Assessment Data Analyst  
**Tanggal:** 12 November 2026  
**Status Kepatuhan:** READ-ONLY / DOCUMENTATION ONLY (Strict Change Control Compliant)  
**Referensi Induk:** `docs/assessment/FOOTBALL_ACTIVE_INDICATOR_INVENTORY.md` & `src/config/footballAssessmentData.js`

---

## 1. IDENTIFIKASI RESMI 18 INDIKATOR OBJECTIVE_TEST

Berdasarkan inventarisasi faktual kode sumber CHUVATOR pada `docs/assessment/FOOTBALL_ACTIVE_INDICATOR_INVENTORY.md`, ditemukan tepat **18 indikator** berklasifikasi `type: "OBJECTIVE_TEST"` dari total 218 indikator aktif dalam registry. Indikator-indikator ini memiliki konstruk performa yang dapat diukur secara kuantitatif melalui pengujian fisik dan keterampilan terstandarisasi.

### Tabel Master 18 Indikator OBJECTIVE_TEST

| No | Canonical ID | Nama Indikator | Kategori | Posisi yang Berlaku | Development Tier | Source File & Lokasi Kode |
|:--:|---|---|---|---|---|---|
| 1 | `FTB-UNI-PHY-01` | **Akselerasi** | Physical / Fisik | Universal (Semua) | Tier 1, 2, 3, 4 (minTier: 1) | `src/config/footballAssessmentData.js:362` |
| 2 | `FTB-UNI-PHY-02` | **Kelincahan** | Physical / Fisik | Universal (Semua) | Tier 1, 2, 3, 4 (minTier: 1) | `src/config/footballAssessmentData.js:363` |
| 3 | `FTB-UNI-PHY-03` | **Keseimbangan** | Physical / Fisik | Universal (Semua) | Tier 1, 2, 3, 4 (minTier: 1) | `src/config/footballAssessmentData.js:364` |
| 4 | `FTB-UNI-PHY-04` | **Mobilitas** | Physical / Fisik | Universal (Semua) | Tier 1, 2, 3, 4 (minTier: 1) | `src/config/footballAssessmentData.js:365` |
| 5 | `FTB-UNI-PHY-06` | **Kecepatan Maksimal** | Physical / Fisik | Universal (Semua) | Tier 2, 3, 4 (minTier: 2) | `src/config/footballAssessmentData.js:367` |
| 6 | `FTB-UNI-PHY-07` | **Reaksi** | Physical / Fisik | Universal (Semua) | Tier 2, 3, 4 (minTier: 2) | `src/config/footballAssessmentData.js:368` |
| 7 | `FTB-UNI-PHY-08` | **Lompatan** | Physical / Fisik | Universal (Semua) | Tier 2, 3, 4 (minTier: 2) | `src/config/footballAssessmentData.js:369` |
| 8 | `FTB-UNI-PHY-09` | **Perubahan Arah** | Physical / Fisik | Universal (Semua) | Tier 2, 3, 4 (minTier: 2) | `src/config/footballAssessmentData.js:370` |
| 9 | `FTB-UNI-PHY-10` | **Daya Tahan** | Physical / Fisik | Universal (Semua) | Tier 3, 4 (minTier: 3) | `src/config/footballAssessmentData.js:371` |
| 10 | `FTB-UNI-PHY-11` | **Daya Ledak** | Physical / Fisik | Universal (Semua) | Tier 3, 4 (minTier: 3) | `src/config/footballAssessmentData.js:372` |
| 11 | `FTB-UNI-PHY-12` | **Kekuatan Tubuh** | Physical / Fisik | Universal (Semua) | Tier 3, 4 (minTier: 3) | `src/config/footballAssessmentData.js:373` |
| 12 | `FTB-UNI-PHY-13` | **Kekuatan Inti** | Physical / Fisik | Universal (Semua) | Tier 3, 4 (minTier: 3) | `src/config/footballAssessmentData.js:374` |
| 13 | `FTB-UNI-PHY-14` | **Sprint Berulang** | Physical / Fisik | Universal (Semua) | Tier 4 (minTier: 4) | `src/config/footballAssessmentData.js:375` |
| 14 | `FTB-UNI-TEC-07` | **Kekuatan Tembakan** | Technical / Teknik | Universal (Semua) | Tier 2, 3, 4 (minTier: 2) | `src/config/footballAssessmentData.js:394` |
| 15 | `FTB-SSB-OUT-02` | **Koordinasi Mata-Kaki** | Khusus Posisi (Grassroots) | `OUTFIELD_SSB` (Pemain Lapangan) | Tier 1 (minTier: 1) | `src/config/footballAssessmentData.js:308` |
| 16 | `FTB-SSB-GK-02` | **Koordinasi Tangan-Mata** | Khusus Posisi (Grassroots) | `GK_SSB` (Kiper Cilik) | Tier 1 (minTier: 1) | `src/config/footballAssessmentData.js:320` |
| 17 | `FTB-SSB-GK-03` | **Ketangkasan Gerak Dasar**| Khusus Posisi (Grassroots) | `GK_SSB` (Kiper Cilik) | Tier 1 (minTier: 1) | `src/config/footballAssessmentData.js:321` |
| 18 | `FTB-POS-WF-01` | **Akselerasi Sayap** | Khusus Posisi (Standard) | `WFR/WFL` (Winger / Sayap) | Tier 3, 4 (minTier: 3) | `src/config/footballAssessmentData.js:249` |

---

## 2. EVALUASI KRITIS VALIDITAS KONSTRUK & METODOLOGI LAPANGAN

Penyempurnaan versi 2.1 melakukan evaluasi mendalam terhadap 4 isu krusial metodologi pengujian:

### 2.1 Evaluasi Validitas Tes "Max Ball Carry Distance" untuk Kekuatan Tembakan (`FTB-UNI-TEC-07`)
* **Konstruk Sebenarnya:** *Shot Power* dalam sepak bola modern didefinisikan sebagai **kecepatan pelepasan bola (*ball exit velocity* dalam km/jam)** saat perkenaan kaki (*impact point*). Tembakan sepak bola yang efektif umumnya memiliki sudut elevasi rendah ($\theta < 15^\circ$) dan laju lintasan datar (*driven shot*).
* **Keterbatasan Tes Carry Distance (Jarak Lambung):**
  1. *Sudut Elevasi vs Laju Bola:* Berdasarkan hukum fisika parabola proyektil ($R = \frac{v^2 \sin 2\theta}{g}$), jarak terjauh dicapai pada sudut $\theta \approx 45^\circ$. Atlet yang menendang melambung tinggi (*lofted clearance*) akan mencatatkan jarak lebih jauh daripada atlet yang menembak keras dengan lintasan datar (*powerful low drive*), padahal kecepatan tembakan datar jauh lebih mematikan di gawang.
  2. *Faktor Lingkungan Lapangan:* Kecepatan dan arah angin (*headwind/tailwind*), kelembapan udara, kebasahan rumput, serta tekanan angin bola (apakah 0.7 bar atau 0.9 bar) sangat membiaskan jarak lambung bola.
* **Keputusan Metodologi:**  
  Tes *Max Ball Carry Distance* **TIDAK BOLEH DISEBUT SEBAGAI PENGUKURAN LANGSUNG KEKUATAN TEMBAKAN**. Tes ini hanya berstatus sebagai **`INDIRECT AERODYNAMIC PROXY (LOW-TO-MODERATE CONSTRUCT VALIDITY)`**.  
  *Solusi Praktis SSB:*
  * *Opsi A (Proxy Lapangan Biaya Nol):* Carry Distance (m) tetap dapat dipakai dengan syarat bola resmi standar bertekanan sama (0.85 bar), dilakukan pada kondisi tanpa angin kencang, dengan instruksi *"Tendangan Keras Mengambang"*.
  * *Opsi B (Alternatif Video Smartphone Slow-Motion):* Menggunakan kamera smartphone 60fps/120fps dari tepi kotak penalti (jarak 11 meter ke garis gawang); menghitung selisih waktu frame kontak kaki hingga bola melewati garis gawang ($v = \frac{11\text{ meter}}{\Delta t\text{ detik}} \times 3.6\text{ km/jam}$). Ini menghasilkan exit velocity riil tanpa alat mahal.
  * Status: **`NEEDS FURTHER DESIGN: SHOT POWER MEASUREMENT`** untuk keputusan produk apakah mendukung input km/jam atau meter carry distance.

---

### 2.2 Evaluasi Penggunaan Split 10m & 30m: Stopwatch Manual vs Video Smartphone
* **Keterbatasan Stopwatch Manual:**
  * Waktu reaksi visual manusia rata-rata berada pada rentang **$0.15 - 0.25$ detik**.
  * Sprint 10 meter atlet usia muda hanya berlangsung selama **$1.75 - 2.20$ detik**. Kesalahan reaksi manual sebesar $\pm 0.2$ detik merepresentasikan margin error hingga **$\approx 10\% - 12\%$**, yang dapat menggeser posisi atlet dari persentil 50 ke persentil 85 secara keliru.
  * Jika seorang pelatih berdiri di garis finis 30m dan mencoba menekan tombol split pada meter ke-10, sudut paralaks mata (*parallax error*) dan keterlambatan visual menyebabkan split time 10m sama sekali tidak valid.
* **Keputusan Operasional SSB:**
  1. **Jalur Operasional 1 (Protokol Terpisah 1 Stopwatch):**  
     Pelatih **WAJIB MEMISAHKAN PENGUJIAN** jika hanya memiliki 1 stopwatch manual:
     * Sesi 1: Tes Sprint 10 Meter berdiri (`TST-SPR-10M`) dengan pelatih berdiri persis sejajar garis finis 10m.
     * Sesi 2: Tes Sprint 30 Meter (`TST-SPR-30M`) dengan pelatih berdiri persis sejajar garis finis 30m.
  2. **Jalur Operasional 2 (Alternatif Video Smartphone — Presisi Tinggi Biaya Nol):**  
     Pelatih dapat menempatkan tripod/smartphone di tepi lintasan (jarak $\approx 15$ meter tegak lurus lintasan) merekam dengan mode 60fps atau 120fps (fitur bawaan smartphone modern). Kerucut dengan tiang penanda diletakkan di meter 0, 10, dan 30.
     * Presisi waktu pada 60fps = $\pm 0.016$ detik ($\pm 16.7$ ms).
     * Presisi waktu pada 120fps = $\pm 0.008$ detik ($\pm 8.3$ ms).
     * Hasil setara dengan *timing gate* elektronik puluhan juta rupiah tanpa biaya tambahan.

---

### 2.3 Evaluasi Kesesuaian Sit-and-Reach terhadap Indikator "Mobilitas" (`FTB-UNI-PHY-04`)
* **Konstruk Sebenarnya:** *Mobilitas sendi* dalam sepak bola mencakup keleluasaan gerak aktif multi-planar (*active multi-joint movement*), stabilitas panggul (*pelvic-hip complex*), rotasi toraks, dan dorsofleksi pergelangan kaki yang dinamis.
* **Konstruk Sit-and-Reach:** Tes Sit-and-Reach secara eksklusif hanya mengukur **fleksibilitas linier pasif rantai posterior (*posterior chain flexibility*)**, yaitu elastisitas otot hamstring dan ekstensi ligamen lumbosakral/tulang belakang bawah.
* **Keterbatasan:** Seorang pemain sayap bisa memiliki skor Sit-and-Reach tinggi (karena tungkai pendek atau lengan panjang) namun memiliki mobilitas panggul (*hip mobility/groin*) yang kaku saat membuka ruang atau melakukan tekel.
* **Keputusan Metodologi:**  
  Menegaskan bahwa tes ini adalah **`UNIDIMENSIONAL FLEXIBILITY PROXY (HAMSTRING & LOWER BACK)`**.  
  *Rekomendasi:* Tetap dipertahankan sebagai tes dasar karena 100% praktis di SSB, namun statusnya diklarifikasi pada laporan atlet sebagai fleksibilitas hamstring/punggung bawah untuk mitigasi risiko cedera tarikan otot (*strain prevention*).

---

### 2.4 Formulasi Eksplisit & Prosedur Pencatatan Bangsbo RSA (`FTB-UNI-PHY-14`)
* **Formula Total Sprint Time ($S_{total}$):**
  $$S_{total} = \sum_{i=1}^{6} S_i = S_1 + S_2 + S_3 + S_4 + S_5 + S_6$$
* **Formula Waktu Terbaik ($S_{best}$):**
  $$S_{best} = \min(S_1, S_2, S_3, S_4, S_5, S_6)$$
* **Formula Waktu Ideal Kumulatif ($S_{ideal}$):**
  $$S_{ideal} = 6 \times S_{best}$$
* **Formula Fatigue Index Persentase ($FI\%$):**
  $$FI(\%) = \left( \frac{S_{total}}{S_{ideal}} - 1 \right) \times 100\% = \left( \frac{\sum_{i=1}^{6} S_i}{6 \times S_{best}} - 1 \right) \times 100\%$$
* **Formula Alternatif Penurunan Kecepatan (*Drop-off Index*):**
  $$\text{Drop-off}(\%) = \left( \frac{S_{terburuk} - S_{best}}{S_{best}} \right) \times 100\%$$
* **Prosedur Pencatatan Repetisi demi Repetisi:**
  1. *Stopwatch 1 (Sprint Timer):* Menghitung waktu lari 30m repetisi berjalan ($S_i$).
  2. *Stopwatch 2 (Recovery Countdown):* Tepat saat atlet memotong garis 30m, pelatih kedua menyalakan hitung mundur pemulihan 20 detik.
  3. *Prosedur Recovery:* Atlet melakukan deselerasi (jarak 10m) lalu berjalan kembali ke garis start dalam tempo santai.
  4. *Hitung Mundur Aba-aba:* Pelatih mengumumkan hitungan: *"10 detik... 5 detik... 3, 2, 1, GO!"*.
  5. *Pengawasan Pacing:* Jika sprint pertama ($S_1$) atlet lebih lambat $> 5\%$ dari catatan rekor sprint 30m atlet pada tes sebelumnya, tes dibatalkan karena atlet dicurigai sengaja menyimpan tenaga (*pacing violation*).

---

### 2.5 Aturan Validitas Gerakan, Penghentian, dan Keselamatan (Bleep, Push-Up, Plank)

#### A. 20-Meter Shuttle Run / Bleep Test (`TST-END-BLP`)
* **Validitas Gerakan:** Kaki atlet harus menyentuh atau melewati garis 20 meter sebelum atau tepat saat nada bip berbunyi. Pemutaran badan (*turning pivot*) harus bertumpu kuat di atas garis dan berbalik arah, dilarang membuat lintasan melengkung elips (*cutting corners*).
* **Kriteria Penghentian Tes:**
  1. *Peringatan 1:* Jika atlet gagal mencapai garis sebelum nada bip berbunyi (terlambat $< 2$ meter), pelatih memberikan 1 peringatan resmi. Atlet harus mengejar ketertinggalan pada shuttle berikutnya.
  2. *Eliminasi Resmi:* Jika pada shuttle berikutnya secara beruntun atlet kembali gagal mencapai garis tepat waktu, atlet dieliminasi. Skor yang dicatat adalah level dan shuttle valid terakhir.
  3. *Penghentian Mandiri:* Atlet menyerah karena kelelahan ekstrim.
* **Protokol Keselamatan (*Safety Protocol*):**
  * *Skrining Medis:* Atlet dengan riwayat asma akut yang sedang kambuh atau demam dalam 48 jam dilarang mengikuti tes.
  * *Kondisi Lapangan:* Rumput harus kering dan padat untuk mencegah tergelincir pada saat deselerasi putaran 180°.
  * *Tanda Bahaya Medis:* Hentikan tes seketika jika atlet menunjukkan bibir pucat/kebiruan, disorientasi langkah sempoyongan, nyeri dada, atau mual hebat.
  * *Pendinginan Wajib:* Atlet yang tereliminasi **DILARANG LANGSUNG DUDUK ATAU BERBARING DI LAPANGAN**. Atlet wajib berjalan kaki santai minimal 3–5 menit untuk mencegah penurunan tekanan darah mendadak (*venous blood pooling* dan sinkop).

#### B. 60-Second Push-Up Test (`TST-STR-PU1`)
* **Validitas Gerakan:**
  * Posisi awal lengan lurus selebar bahu, tubuh membentuk garis lurus kaku (*rigid plank*) dari kepala hingga tumit.
  * Saat fase turun, siku menekuk minimal 90 derajat (dada turun hingga $\approx 10$ cm dari permukaan tanah).
  * Saat fase naik, siku mengunci lurus sempurna (*full lockout*).
* **Kriteria Penghentian & Repetisi Batal:**
  * *Repetisi Tidak Sah:* Punggung melengkung ke bawah (*hip sag*), pantat mencuat ke atas (*hip pike*), siku tidak menekuk 90°, atau tidak mengunci lurus di atas.
  * *Penghentian Tes:* Berakhir saat waktu 60 detik habis, atlet meletakkan lutut/perut di tanah untuk beristirahat, atau atlet berhenti secara sukarela. Istirahat jeda hanya diizinkan pada posisi atas (*top plank position*).
* **Protokol Keselamatan:** Pemanasan pergelangan tangan (*wrist warm-up*) wajib dilakukan. Jari tangan menghadap lurus ke depan untuk mencegah cedera kompresi sendi karpal.

#### C. Prone Forearm Plank Hold Test (`TST-COR-PLK`)
* **Validitas Gerakan:** Lengan bawah menempel paralel di tanah, siku tepat vertikal di bawah sendi bahu. Tulang belakang netral, panggul stabil tanpa rotasi lateral.
* **Kriteria Penghentian Tes:**
  * *Peringatan Form:* Jika panggul turun melorot (*sagging*) $> 5$ cm atau terangkat naik $> 5$ cm, pelatih memberikan 1 peringatan koreksi lisan.
  * *Penghentian Otomatis:* Stopwatch dihentikan seketika jika terjadi deviasi panggul kedua setelah peringatan, atau jika lutut/paha menyentuh matras/tanah.
* **Protokol Keselamatan:**
  * *Pernapasan Ritmis:* Pelatih wajib menginstruksikan atlet untuk tetap bernapas teratur. **DILARANG MENAHAN NAPAS (*Valsalva Maneuver*)** yang dapat memicu lonjakan tekanan darah mendadak dan pusing.
  * Hentikan tes seketika jika atlet merasakan nyeri tusuk pada lumbar/tulang belakang bawah.

---

## 3. SPESIFIKASI LENGKAP 18 METODE PENGUJIAN LAPANGAN

Berikut adalah ringkasan operasional dari seluruh 18 tes lapangan praktis:

| Kode Tes | Nama Tes | Indikator Terkait | Satuan | Prosedur Pelatih Tanpa Alat Lab | Kriteria Validitas Utama |
|:---:|---|---|:---:|---|---|
| **TST-SPR-10M** | 10m Standing Sprint | `FTB-UNI-PHY-01` | s | 2 percobaan terpisah, stopwatch manual di garis 10m atau video HP 60fps | Start diam tanpa melangkah mundur |
| **TST-AGL-ARW** | Arrowhead Agility | `FTB-UNI-PHY-02` | s | Formasi 6 cone (15x10m), 1 rute kiri + 1 rute kanan, rata-rata | Mengitari sisi luar cone tanpa menyenggol |
| **TST-BAL-STK** | Stork Balance Stand | `FTB-UNI-PHY-03` | s | Jinjit 1 kaki tumpu, tangan di pinggang, 3 percobaan per kaki | Tumit tidak boleh turun menyentuh tanah |
| **TST-MOB-SAR** | Floor Sit-and-Reach | `FTB-UNI-PHY-04` | cm | Duduk di lantai kaki lurus, meteran skala tumit 25 cm, tahan 2 detik | Lutut wajib lurus terkunci di tanah |
| **TST-SPR-30M** | 30m Linear Sprint | `FTB-UNI-PHY-06` | s | 2 percobaan lari 30m penuh, istirahat 4 menit, ambil tercepat | Lari 100% tanpa perlambatan sebelum finis |
| **TST-RXN-RLR** | Ruler Drop Reaction | `FTB-UNI-PHY-07` | cm | Mistar 50–60 cm jatuh acak 1–5 detik, tangkap di celah jari 3 cm | Tangan tidak boleh bergerak sebelum mistar jatuh |
| **TST-JMP-VER** | Sargent Jump (Kapur)| `FTB-UNI-PHY-08` | cm | Jari kapur, tandai jangkauan berdiri ($H_1$) dan puncak lompat ($H_2$) | Lompatan 2 kaki tanpa awalan lari |
| **TST-COD-505** | 5-0-5 COD Test | `FTB-UNI-PHY-09` | s | Lari 10m, putar 180° di 15m, sprint balik melintasi 10m (2R + 2L) | Kaki wajib menyentuh/melewati garis putar 15m |
| **TST-END-BLP** | 20m Bleep Test | `FTB-UNI-PHY-10` | Lvl.Sht | Audio bip HP + speaker, lari bolak-balik 20m grup 8–12 atlet | Eliminasi pada kegagalan garis 2x berturut-turut |
| **TST-PWR-SBJ** | Standing Broad Jump | `FTB-UNI-PHY-11` | cm | Lompat horizontal 2 kaki serempak dari diam, ukur ke tumit terdekat | Tolakan & pendaratan 2 kaki tanpa jatuh mundur |
| **TST-STR-PU1** | 60s Push-Up Test | `FTB-UNI-PHY-12` | reps | Posisi plank lurus, siku tekuk 90°, hitung repetisi sah 60 detik | Tubuh wajib lurus sempurna tanpa hip sag |
| **TST-COR-PLK** | Forearm Plank Hold | `FTB-UNI-PHY-13` | s | Tumpuan lengan bawah & ujung kaki, tubuh kaku garis lurus | Stopwatch berhenti saat panggul turun/naik 5 cm |
| **TST-RSA-630** | Bangsbo RSA (6x30m)| `FTB-UNI-PHY-14` | s & % | 6 sprint 30m maksimal, istirahat tepat 20 detik, hitung $S_{tot}$ & $FI\%$ | Dilarang pacing di repetisi awal |
| **TST-SHT-DST** | Carry Distance *(Proxy)*| `FTB-UNI-TEC-07`| m | Tendang bola diam 0.85 bar sekuatnya, ukur titik jatuh pertama | Bola wajib melambung tanpa menyentuh tanah |
| **TST-SSB-WAP** | 30s Wall-Pass | `FTB-SSB-OUT-02`| reps | Oper pantul dinding 1.5m bergantian kaki kanan-kiri selama 30 detik | Target kotak dinding 1.5x0.5m |
| **TST-SSB-TOS** | 30s Wall Toss & Catch| `FTB-SSB-GK-02`| reps | Lempar bola tenis ke dinding 2m dan tangkap bersih dalam 30 detik | Tangkapan sebelum bola menyentuh tanah |
| **TST-SSB-LAT** | 4-Cone Lateral Kiper| `FTB-SSB-GK-03` | s | Gerak lateral 4 cone (3.6m) lalu tangkap bola mendatar pelatih | Kaki dilarang menyilang, bola tertangkap aman |
| **TST-WF-TLA** | 20m Touchline Sprint| `FTB-POS-WF-01` | s | Sprint 20m di koridor sempit sayap selebar 3m, posisi start serong | Tetap berada di dalam batas koridor sayap |

---

## 4. SPESIFIKASI LENGKAP KONVERSI MATEMATIKA KE SKOR 1–100

Sesuai instruksi change control yang ketat: **DILARANG MENCIPTAKAN ANGKA NORMA, BATAS SKOR, ATAU NILAI REGRESI FIKTIF.**  
Oleh karena itu, seluruh formula matematika disajikan dengan parameter acuan eksplisit ($x_{base}$ dan $x_{elite}$) yang siap dikalibrasikan saat dataset normatif resmi tersedia.

### 4.1 Definisi Fungsi Pembatas (*Clamping*)
Semua skor keluaran dibatasi secara matematis pada rentang 1 hingga 100 integer:
$$\text{clamp}_{1}^{100}(v) = \max\Big(1, \min\big(100, \text{round}(v)\big)\Big)$$

---

### 4.2 Spesifikasi Detail untuk Masing-Masing dari 18 Indikator

#### 1. `FTB-UNI-PHY-01` — Akselerasi (10m Sprint)
* **Arah Skor:** `lower-is-better` (waktu lebih kecil = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 100 - \frac{T - T_{elite}}{T_{base} - T_{elite}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:**
  * $T_{elite}$: Waktu sprint 10m tercepat standar elite untuk kelompok usia/tier tersebut (detik).
  * $T_{base}$: Waktu sprint 10m batas bawah kemampuan untuk kelompok usia/tier tersebut (detik).
* **Kebutuhan Norma:** **YA** (Membutuhkan norma berdasarkan Kelompok Usia / Tier Filanesia dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 2. `FTB-UNI-PHY-02` — Kelincahan (Arrowhead Agility)
* **Arah Skor:** `lower-is-better` (waktu lebih kecil = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 100 - \frac{T_{avg} - T_{elite}}{T_{base} - T_{elite}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $T_{elite}(\text{tier, age})$, $T_{base}(\text{tier, age})$ dalam detik.
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia / Tier dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 3. `FTB-UNI-PHY-03` — Keseimbangan (Stork Balance Stand)
* **Arah Skor:** `higher-is-better` (durasi detik bertahan lebih lama = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{T_{avg} - T_{base}}{T_{elite} - T_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $T_{base}(\text{tier, age})$ (detik), $T_{elite}(\text{tier, age})$ (detik).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 4. `FTB-UNI-PHY-04` — Mobilitas (Floor Sit-and-Reach)
* **Arah Skor:** `higher-is-better` (jangkauan centimeter lebih jauh = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{D - D_{base}}{D_{elite} - D_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $D_{base}(\text{tier, age})$ (cm), $D_{elite}(\text{tier, age})$ (cm).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 5. `FTB-UNI-PHY-06` — Kecepatan Maksimal (30m Sprint)
* **Arah Skor:** `lower-is-better` (waktu 30m lebih cepat = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 100 - \frac{T - T_{elite}}{T_{base} - T_{elite}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $T_{elite}(\text{tier, age})$ (detik), $T_{base}(\text{tier, age})$ (detik).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia / Tier dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 6. `FTB-UNI-PHY-07` — Reaksi (Ruler Drop Test)
* **Arah Skor:** `lower-is-better` (jarak centimeter tangkapan lebih pendek = waktu reaksi lebih cepat)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 100 - \frac{d_{avg} - d_{elite}}{d_{base} - d_{elite}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $d_{elite}(\text{tier, age})$ (cm), $d_{base}(\text{tier, age})$ (cm).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia).
* **Status Kalibrasi:** **`READY FOR CALIBRATION`** (Dapat dikonversi langsung ke milidetik via rumus fisika $t = \sqrt{2d/g}$ sebelum diskalakan).

#### 7. `FTB-UNI-PHY-08` — Lompatan (Vertical Jump / Sargent Jump)
* **Arah Skor:** `higher-is-better` (selisih centimeter lebih tinggi = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{\Delta H - \Delta H_{base}}{\Delta H_{elite} - \Delta H_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $\Delta H_{base}(\text{tier, age})$ (cm), $\Delta H_{elite}(\text{tier, age})$ (cm).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia / Tier dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 8. `FTB-UNI-PHY-09` — Perubahan Arah (5-0-5 COD Test)
* **Arah Skor:** `lower-is-better` (waktu putaran 10m bolak-balik lebih cepat = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 100 - \frac{T_{avg} - T_{elite}}{T_{base} - T_{elite}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $T_{elite}(\text{tier, age})$ (detik), $T_{base}(\text{tier, age})$ (detik).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia / Tier).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 9. `FTB-UNI-PHY-10` — Daya Tahan (20m Bleep Test)
* **Arah Skor:** `higher-is-better` (total meter / shuttle tempuh lebih banyak = skor lebih tinggi)
* **Rumus Matematika (Konversi Jarak Shuttle Tempuh):**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{M - M_{base}}{M_{elite} - M_{base}} \times 99 \right)$$
  *Di mana $M$ adalah total meter akumulatif dari Level dan Shuttle yang diselesaikan secara valid.*
* **Parameter Acuan yang Dibutuhkan:** $M_{base}(\text{tier, age})$ (meter), $M_{elite}(\text{tier, age})$ (meter).
* **Kebutuhan Norma:** **YA** (Sangat sensitif terhadap Kelompok Usia / Tier dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 10. `FTB-UNI-PHY-11` — Daya Ledak (Standing Broad Jump)
* **Arah Skor:** `higher-is-better` (jarak lompatan centimeter lebih jauh = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{D - D_{base}}{D_{elite} - D_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $D_{base}(\text{tier, age})$ (cm), $D_{elite}(\text{tier, age})$ (cm).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia / Tier dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 11. `FTB-UNI-PHY-12` — Kekuatan Tubuh (Push-Up 60 Detik)
* **Arah Skor:** `higher-is-better` (jumlah repetisi sempurna lebih banyak = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{R - R_{base}}{R_{elite} - R_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $R_{base}(\text{tier, age})$ (repetisi), $R_{elite}(\text{tier, age})$ (repetisi).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia / Tier dan Jenis Kelamin).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 12. `FTB-UNI-PHY-13` — Kekuatan Inti (Forearm Plank Hold)
* **Arah Skor:** `higher-is-better` (durasi detik bertahan lebih lama = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{T - T_{base}}{T_{elite} - T_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $T_{base}(\text{tier, age})$ (detik), $T_{elite}(\text{tier, age})$ (detik).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 13. `FTB-UNI-PHY-14` — Sprint Berulang (Bangsbo RSA 6x30m)
* **Arah Skor:** `lower-is-better` (waktu total lebih singkat dan Fatigue Index lebih rendah = performa lebih tinggi)
* **Rumus Matematika (Pembobotan 70% Total Time + 30% Fatigue Index):**
  $$\text{Score}_{total} = \text{clamp}_{1}^{100}\left( 100 - \frac{S_{total} - S_{tot\_elite}}{S_{tot\_base} - S_{tot\_elite}} \times 99 \right)$$
  $$\text{Score}_{FI} = \text{clamp}_{1}^{100}\left( 100 - \frac{FI - FI_{elite}}{FI_{base} - FI_{elite}} \times 99 \right)$$
  $$\text{Score} = \text{round}\left( 0.70 \times \text{Score}_{total} + 0.30 \times \text{Score}_{FI} \right)$$
* **Parameter Acuan yang Dibutuhkan:** $S_{tot\_elite}$, $S_{tot\_base}$ (detik), serta $FI_{elite}$, $FI_{base}$ (persentase).
* **Kebutuhan Norma:** **YA** (Khusus Tier 4 / U-18 dan Senior).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 14. `FTB-UNI-TEC-07` — Kekuatan Tembakan (Carry Distance Proxy / Radar)
* **Arah Skor:** `higher-is-better` (jarak meter lebih jauh = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{D - D_{base}}{D_{elite} - D_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $D_{base}(\text{tier, age})$ (meter), $D_{elite}(\text{tier, age})$ (meter).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia / Tier).
* **Status Kalibrasi:** **`NEEDS FURTHER DESIGN / REFERENCE DATA REQUIRED`** (Memerlukan ketetapan apakah proxy jarak meter atau radar km/jam).

#### 15. `FTB-SSB-OUT-02` — Koordinasi Mata-Kaki (30s Wall-Pass Alternating Feet)
* **Arah Skor:** `higher-is-better` (repetisi sukses bergantian kaki lebih banyak = koordinasi lebih baik)
* **Rumus Matematika (Success Rate Scaling):**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{R - R_{base}}{R_{target} - R_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $R_{base}(\text{Tier 1})$ (repetisi dasar), $R_{target}(\text{Tier 1})$ (target repetisi unggul usia 6–9 tahun).
* **Kebutuhan Norma:** **YA** (Khusus Fase Grassroots Tier 1 / Usia 6–9 Tahun).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 16. `FTB-SSB-GK-02` — Koordinasi Tangan-Mata (30s Wall Toss & Catch)
* **Arah Skor:** `higher-is-better` (jumlah tangkapan bola bersih dalam 30 detik lebih banyak = skor lebih tinggi)
* **Rumus Matematika (Success Rate Scaling):**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 1 + \frac{C - C_{base}}{C_{target} - C_{base}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $C_{base}(\text{Tier 1})$ (tangkapan dasar), $C_{target}(\text{Tier 1})$ (target tangkapan unggul kiper cilik).
* **Kebutuhan Norma:** **YA** (Khusus Kiper Tier 1 / Usia 6–9 Tahun).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 17. `FTB-SSB-GK-03` — Ketangkasan Gerak Dasar (4-Cone Lateral Kiper Cilik)
* **Arah Skor:** `lower-is-better` (waktu rangkaian gerak lateral dan tangkapan lebih cepat = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 100 - \frac{T - T_{elite}}{T_{base} - T_{elite}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $T_{elite}(\text{Tier 1})$ (detik), $T_{base}(\text{Tier 1})$ (detik).
* **Kebutuhan Norma:** **YA** (Khusus Kiper Tier 1 / Usia 6–9 Tahun).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

#### 18. `FTB-POS-WF-01` — Akselerasi Sayap (20m Touchline Sprint)
* **Arah Skor:** `lower-is-better` (waktu sprint 20m di koridor sayap lebih cepat = skor lebih tinggi)
* **Rumus Matematika:**
  $$\text{Score} = \text{clamp}_{1}^{100}\left( 100 - \frac{T - T_{elite}}{T_{base} - T_{elite}} \times 99 \right)$$
* **Parameter Acuan yang Dibutuhkan:** $T_{elite}(\text{tier, age})$ (detik), $T_{base}(\text{tier, age})$ (detik).
* **Kebutuhan Norma:** **YA** (Berdasarkan Kelompok Usia Tier 3–4 posisi WFR/WFL).
* **Status Kalibrasi:** **`REFERENCE DATA REQUIRED`**

---

## 5. REKOMENDASI TAHAPAN IMPLEMENTASI (ROADMAP & GAP STATUS)

Berdasarkan kesiapan teknis dan operasional, ke-18 tes dikelompokkan ke dalam 3 tier kesiapan implementasi:

1. **Kelompok Siap Implementasi Lapangan (Tier 1 - High Readiness):**
   * *Tes:* 10m Sprint (`TST-SPR-10M`), 30m Sprint (`TST-SPR-30M`), Stork Balance (`TST-BAL-STK`), Sargent Vertical Jump (`TST-JMP-VER`), Standing Broad Jump (`TST-PWR-SBJ`), Push-Up 60s (`TST-STR-PU1`), Plank Hold (`TST-COR-PLK`), dan Ruler Drop Test (`TST-RXN-RLR`).
   * *Karakteristik:* Protokol sangat mapan, alat 100% ada di semua SSB, minim ambiguitas interpretasi.
2. **Kelompok Siap dengan Kalibrasi Norma Usia (Tier 2 - Moderate Readiness):**
   * *Tes:* Arrowhead Agility (`TST-AGL-ARW`), 5-0-5 COD (`TST-COD-505`), 20m Bleep Test (`TST-END-BLP`), Bangsbo RSA (`TST-RSA-630`), Sit-and-Reach (`TST-MOB-SAR`), Touchline Sprint (`TST-WF-TLA`), dan 3 Tes Grassroots (`TST-SSB-WAP`, `TST-SSB-TOS`, `TST-SSB-LAT`).
   * *Karakteristik:* Protokol lapangan siap pakai, namun sangat bergantung pada tabel acuan normatif usia agar skor 1–100 tidak bias.
3. **Kelompok Membutuhkan Keputusan Produk (Tier 3 - Product Decision Gap):**
   * *Tes:* Kekuatan Tembakan (`TST-SHT-DST`).
   * *Status:* **`NEEDS FURTHER DESIGN`**. Memerlukan penetapan apakah rilis awal menggunakan proxy Carry Distance (meter) atau membuka modul opsional Radar Doppler (km/jam).

---
*Laporan koreksi ini disusun secara profesional dan objektif sesuai kaidah sports science dan pembinaan sepak bola usia dini Indonesia. Tidak ada perubahan yang dilakukan pada source code aplikasi, skema database, atau registry indikator.*
