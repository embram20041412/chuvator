# CHUVATOR — FOOTBALL ASSESSMENT BATTERY
## TASK 02: OBJECTIVE INDICATOR TO TEST MAPPING

**Dokumen:** `docs/assessment/FOOTBALL_OBJECTIVE_TEST_MAPPING.md`  
**Peran:** Senior Software Engineer & Assessment Data Analyst  
**Tanggal Penyusunan:** 12 November 2026  
**Status Kepatuhan:** READ-ONLY / DOCUMENTATION ONLY (Strict Change Control Compliant)  
**Referensi Induk:** `docs/assessment/FOOTBALL_ACTIVE_INDICATOR_INVENTORY.md` & `src/config/footballAssessmentData.js`

---

## 1. IDENTIFIKASI 18 INDIKATOR BERTIPE OBJECTIVE_TEST

Berdasarkan inventarisasi faktual kode sumber CHUVATOR pada `docs/assessment/FOOTBALL_ACTIVE_INDICATOR_INVENTORY.md`, ditemukan tepat **18 indikator** berklasifikasi `type: "OBJECTIVE_TEST"` dari total 218 indikator aktif dalam registry. Indikator-indikator ini memiliki konstruk performa yang dapat diukur secara kuantitatif melalui pengujian fisik dan keterampilan terstandarisasi, berbeda dari 187 indikator `OBSERVATION_RUBRIC` yang dinilai melalui pengamatan subjektif pelatih.

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

## 2. MATRIKS PEMETAAN INDIKATOR KE METODE TES PRAKTIS SSB

Prinsip perancangan tes disesuaikan dengan realitas operasional Sekolah Sepak Bola (SSB) di Indonesia:
1. **Peralatan Murah & Tersedia Lokal:** Menggunakan kerucut (*cones*), meteran gulung 30–50 meter, stopwatch digital/smartphone, peluit, kapur/lakban, penggaris kayu/plastik 30–60 cm, dan bola resmi. Menghilangkan ketergantungan pada *radar gun*, *timing gate laser*, atau alat laboratorium biomekanika.
2. **Keterlaksanaan oleh 1–2 Pelatih:** Protokol dirancang agar sesi penilaian 20–25 atlet dapat diselesaikan dalam durasi 60–90 menit sesi latihan reguler.
3. **Konstruk Valid & Terpisah:** Menghindari tumpang-tindih konstruk dan melarang *double counting*.

### Matriks Pemetaan Tes

| Canonical ID | Nama Indikator | Kode Tes | Nama Metode Pengujian Lapangan | Satuan Data Mentah | Peralatan Utama |
|---|---|:---:|---|:---:|---|
| `FTB-UNI-PHY-01` | Akselerasi | **TST-SPR-10M** | 10-Meter Standing Sprint Test | Detik (s) | Stopwatch, Cones, Meteran |
| `FTB-UNI-PHY-02` | Kelincahan | **TST-AGL-ARW** | Arrowhead Agility Test (Filanesia Standard) | Detik (s) | 6 Cones, Stopwatch, Meteran |
| `FTB-UNI-PHY-03` | Keseimbangan | **TST-BAL-STK** | Stork Balance Stand Test | Detik (s) | Stopwatch, Matras/Rumput datar |
| `FTB-UNI-PHY-04` | Mobilitas | **TST-MOB-SAR** | Modified Sit-and-Reach Test (Floor/Wall) | Centimeter (cm) | Meteran gulung, Dinding/Bantalan |
| `FTB-UNI-PHY-06` | Kecepatan Maksimal | **TST-SPR-30M** | 30-Meter Sprint Test (Split 10–30m Top-Speed) | Detik (s) | Stopwatch, Cones, Meteran |
| `FTB-UNI-PHY-07` | Reaksi | **TST-RXN-RLR** | Ruler Drop Reaction Test | Centimeter (cm) | Penggaris 50–60 cm / Mistar |
| `FTB-UNI-PHY-08` | Lompatan | **TST-JMP-VER** | Vertical Jump Test (Sargent Wall Chalk Jump) | Centimeter (cm) | Dinding datar, Kapur tulis, Meteran |
| `FTB-UNI-PHY-09` | Perubahan Arah | **TST-COD-505** | 5-0-5 Change of Direction (COD) Test | Detik (s) | Cones, Stopwatch, Meteran |
| `FTB-UNI-PHY-10` | Daya Tahan | **TST-END-BLP** | 20m Multi-Stage Shuttle Run (Bleep / Beep Test) | Level + Shuttle (atau Meter) | Audio Beep MP3/Smartphone, Cones |
| `FTB-UNI-PHY-11` | Daya Ledak | **TST-PWR-SBJ** | Standing Broad Jump (Lompat Jauh Tanpa Awalan)| Centimeter (cm) | Meteran gulung, Lakban/Kapur |
| `FTB-UNI-PHY-12` | Kekuatan Tubuh | **TST-STR-PU1** | 60-Second Push-Up Test (Cadence/Form Checked) | Repetisi (reps) | Stopwatch, Matras/Rumput |
| `FTB-UNI-PHY-13` | Kekuatan Inti | **TST-COR-PLK** | Prone Forearm Plank Hold Test | Detik (s) | Stopwatch, Matras/Rumput |
| `FTB-UNI-PHY-14` | Sprint Berulang | **TST-RSA-630** | Bangsbo Repeated Sprint Ability (6 x 30m, Rec 20s) | Detik total & % Fatigue | Stopwatch, Cones, Lembar catat |
| `FTB-UNI-TEC-07` | Kekuatan Tembakan | **TST-SHT-DST** | Max Carry Distance Test (Alternatif Radar Praktis) | Meter (m) | Bola standar, Meteran, Cones |
| `FTB-SSB-OUT-02` | Koordinasi Mata-Kaki | **TST-SSB-WAP** | 30-Second Wall-Pass Alternating Feet Test | Repetisi sukses (reps) | Dinding/Bangku, Bola, Cones, Stopwatch |
| `FTB-SSB-GK-02` | Koordinasi Tangan-Mata | **TST-SSB-TOS** | 30-Second Wall Toss & Catch Test (Tenis/Mini Bola) | Tangkapan sukses (reps) | Dinding, Bola kecil/tenis, Stopwatch |
| `FTB-SSB-GK-03` | Ketangkasan Gerak Dasar | **TST-SSB-LAT** | 4-Cone Lateral Footwork & Low Catch Course | Detik (s) | 4 Cones, Bola, Stopwatch |
| `FTB-POS-WF-01` | Akselerasi Sayap | **TST-WF-TLA** | 20m Touchline Channel Sprint (Wide Acceleration) | Detik (s) | Cones koridor sayap, Stopwatch |

---

## 3. SPESIFIKASI PROTOKOL PENGUJIAN LAPANGAN

Berikut adalah spesifikasi lengkap 18 pengujian lapangan yang dapat dijalankan secara konsisten oleh staf pelatih SSB:

---

### PROTOKOL 1: 10-Meter Standing Sprint Test (`TST-SPR-10M`)
* **Indikator Terkait:** `FTB-UNI-PHY-01` (Akselerasi — Tier 1–4)
* **1. Tujuan Pengukuran:** Mengukur kapasitas eksplosivitas fase awal perpindahan tubuh dari posisi diam hingga kecepatan transisi 10 meter pertama.
* **2. Peralatan:** 4 buah cone mini, 1 stopwatch digital (resolusi 0.01 detik), 1 meteran gulung 30m.
* **3. Setup Lapangan:** Buat garis start dan garis finis berjarak tepat 10.0 meter di atas rumput lapangan yang kering dan rata. Tempatkan cone penanda di sisi kiri dan kanan pada meter ke-0 dan meter ke-10.
* **4. Instruksi Atlet:** Atlet berdiri di belakang garis start dengan posisi *staggered stance* (satu kaki di depan, condong ke depan). Tanpa aba-aba peluit mundur (reaksi tidak diukur di sini), atlet memulai sprint maksimal begitu siap. Stopwatch dijalankan saat kaki belakang atlet meninggalkan tanah dan dihentikan saat dada atlet memotong garis 10m.
* **5. Jumlah Percobaan:** 2 (dua) kali percobaan.
* **6. Waktu Istirahat:** Minimal 2 menit antar percobaan untuk pemulihan sistem ATP-PC.
* **7. Data Mentah yang Dicatat:** Waktu tempuh terbaik dari 2 percobaan.
* **8. Satuan Pengukuran:** Detik (s) dengan 2 angka di belakang koma (misal: `1.94` detik).
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Start dari posisi diam tanpa gerakan melangkah mundur (*rocking back*), berlari lurus tanpa melambat sebelum garis 10m.
  * *Tidak Valid:* Tergelincir, melangkah mundur sebelum start, atau melambat sebelum garis. Jika tidak valid, atlet diberikan kesempatan ulang setelah istirahat.
* **10. Penentuan Hasil Akhir:** Waktu tercepat (*lowest time*) dari percobaan valid.

---

### PROTOKOL 2: Arrowhead Agility Test (`TST-AGL-ARW`)
* **Indikator Terkait:** `FTB-UNI-PHY-02` (Kelincahan — Tier 1–4)
* **1. Tujuan Pengukuran:** Mengukur kelincahan multi-arah spesifik sepak bola, mencakup kemampuan berakselerasi, deselerasi cepat, dan bermanuver memotong sudut tajam.
* **2. Peralatan:** 6 buah cone, 1 stopwatch, 1 meteran 30m.
* **3. Setup Lapangan:** Formasi panah (*arrowhead*):
  * Garis start/finis di Cone A.
  * Cone B berjarak 10 meter lurus di depan Cone A.
  * Cone C (sisi kiri) berjarak 5 meter miring 45 derajat dari Cone B.
  * Cone D (sisi kanan) berjarak 5 meter miring 45 derajat dari Cone B.
  * Cone E berjarak 15 meter lurus di depan Cone A (5 meter lurus di atas Cone B).
* **4. Instruksi Atlet:** Atlet sprint dari Cone A ke Cone B, memotong ke sisi luar Cone C (atau D untuk sisi kanan), sprint melingkari Cone E dari luar, kembali melingkari Cone B, lalu sprint menembus garis finis di Cone A.
* **5. Jumlah Percobaan:** 2 kali (1 kali rute sisi kiri, 1 kali rute sisi kanan).
* **6. Waktu Istirahat:** 3 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Waktu tempuh rute kiri ($T_{kiri}$) dan waktu rute kanan ($T_{kanan}$).
* **8. Satuan Pengukuran:** Detik (s) dengan 2 desimal.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Mengitari seluruh cone dari sisi luar penanda tanpa menyenggol atau menjatuhkan cone.
  * *Tidak Valid:* Memotong jalur cone, terpeleset parah, atau tidak menyelesaikan rute.
* **10. Penentuan Hasil Akhir:** Rata-rata dari rute kiri dan kanan: $T_{final} = (T_{kiri} + T_{kanan}) / 2$.

---

### PROTOKOL 3: Stork Balance Stand Test (`TST-BAL-STK`)
* **Indikator Terkait:** `FTB-UNI-PHY-03` (Keseimbangan — Tier 1–4)
* **1. Tujuan Pengukuran:** Mengukur keseimbangan statis postural atlet yang krusial untuk kestabilan menendang dan duel fisik satu lawan satu.
* **2. Peralatan:** 1 stopwatch, permukaan tanah/matras datar.
* **3. Setup Lapangan:** Area datar 2x2 meter bebas gangguan.
* **4. Instruksi Atlet:** Atlet berdiri tanpa sepatu (atau memakai kaos kaki) dengan kedua tangan di pinggang. Kaki non-tumpu ditekuk dan telapak kakinya ditempatkan di sisi dalam lutut kaki tumpu. Saat siap, atlet mengangkat tumit kaki tumpu (berjinjit pada bola kaki). Stopwatch dimulai tepat saat tumit terangkat.
* **5. Jumlah Percobaan:** 3 kali percobaan untuk kaki dominan, 3 kali untuk kaki non-dominan.
* **6. Waktu Istirahat:** 45 detik antar percobaan.
* **7. Data Mentah yang Dicatat:** Durasi bertahan dalam posisi jinjit sempurna.
* **8. Satuan Pengukuran:** Detik (s) bulat.
* **9. Kriteria Valid / Tidak Valid:**
  * *Penghentian Pengukuran (Selesai):* Tangan lepas dari pinggang, kaki non-tumpu terlepas dari lutut, tumit kaki tumpu menyentuh tanah, atau kaki tumpu bergeser/melompat dari titik awal.
* **10. Penentuan Hasil Akhir:** Rata-rata waktu terbaik kaki kanan dan kiri: $T_{final} = (\max(R) + \max(L)) / 2$.

---

### PROTOKOL 4: Modified Floor Sit-and-Reach Test (`TST-MOB-SAR`)
* **Indikator Terkait:** `FTB-UNI-PHY-04` (Mobilitas — Tier 1–4)
* **1. Tujuan Pengukuran:** Mengukur fleksibilitas fungsional panggul (*hamstring*) dan punggung bawah untuk pencegahan cedera otot saat peregangan dinamis.
* **2. Peralatan:** 1 meteran gulung, lakban/kapur penanda, dinding/permukaan tegak lurus.
* **3. Setup Lapangan:** Tempelkan meteran di lantai dengan angka 0 menghadap atlet. Garis batas tumit diletakkan tepat pada tanda 25 cm (titik nol kaki).
* **4. Instruksi Atlet:** Atlet duduk di lantai tanpa sepatu, kedua kaki lurus selebar bahu dengan tumit menempel pada garis 25 cm. Kedua tangan diletakkan bertumpuk (ujung jari sejajar). Atlet membungkuk perlahan ke depan sejauh mungkin dengan lutut tetap lurus terkunci, mendorong penanda atau menyentuh skala meteran dan menahan posisi selama 2 detik.
* **5. Jumlah Percobaan:** 3 kali percobaan berturut-turut.
* **6. Waktu Istirahat:** 30 detik antar percobaan.
* **7. Data Mentah yang Dicatat:** Jarak terjauh jangkauan jari dalam centimeter.
* **8. Satuan Pengukuran:** Centimeter (cm) dengan presisi 0.5 cm.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Lutut tidak menekuk, gerakan halus tanpa menghentak (*bouncing*), posisi ditahan 2 detik.
  * *Tidak Valid:* Lutut terangkat, gerakan menyentak tiba-tiba.
* **10. Penentuan Hasil Akhir:** Nilai terjauh (*maximum reach distance*) dari 3 percobaan valid.

---

### PROTOKOL 5: 30-Meter Flying / Linear Sprint Test (`TST-SPR-30M`)
* **Indikator Terkait:** `FTB-UNI-PHY-06` (Kecepatan Maksimal — Tier 2–4)
* **1. Tujuan Pengukuran:** Mengukur kecepatan puncak (*top speed / maximal velocity*) atlet pada lintasan lurus.
* **2. Peralatan:** 6 cones, 1 stopwatch (atau 2 stopwatch jika split manual), meteran 50m.
* **3. Setup Lapangan:** Lintasan lurus 30 meter. Cone diletakkan pada meter ke-0 (start), meter ke-10 (zona transisi), dan meter ke-30 (finis).
* **4. Instruksi Atlet:** Atlet start dari posisi berdiri di meter ke-0, berakselerasi penuh hingga meter ke-30. Waktu tempuh diukur untuk segmen total 0–30 meter (atau interval 10–30 meter jika ada 2 pelatih pengamat).
* **5. Jumlah Percobaan:** 2 kali percobaan.
* **6. Waktu Istirahat:** 4–5 menit agar pemulihan neuromuskular sempurna.
* **7. Data Mentah yang Dicatat:** Waktu tempuh 30 meter dalam detik.
* **8. Satuan Pengukuran:** Detik (s) dengan 2 desimal.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Berlari sprint 100% tanpa perlambatan sebelum melewati garis 30m.
  * *Tidak Valid:* Tergelincir atau melambat sebelum garis finis.
* **10. Penentuan Hasil Akhir:** Waktu tercepat (*fastest time*) dari 2 percobaan.

---

### PROTOKOL 6: Ruler Drop Reaction Test (`TST-RXN-RLR`)
* **Indikator Terkait:** `FTB-UNI-PHY-07` (Reaksi — Tier 2–4)
* **1. Tujuan Pengukuran:** Mengukur waktu reaksi visual dan koordinasi neuromuskular motorik halus tanpa memerlukan alat elektronik mahal.
* **2. Peralatan:** 1 penggaris kayu atau plastik kaku panjang 50–60 cm dengan skala milimeter yang jelas.
* **3. Setup Lapangan:** Atlet duduk di kursi atau berlutut di pinggir meja dengan lengan bawah bertumpu santai di atas meja, pergelangan tangan melewati tepi meja.
* **4. Instruksi Atlet:** Ibu jari dan jari telunjuk atlet terbuka membentuk celah horizontal selebar $\approx 3$ cm. Pelatih memegang ujung atas penggaris secara vertikal sehingga angka 0 cm berada tepat sejajar di antara celah jari atlet. Pelatih melepaskan penggaris secara acak dalam rentang 1–5 detik tanpa aba-aba suara atau gerakan tubuh awal. Atlet harus menangkap penggaris secepat mungkin begitu melihat penggaris mulai jatuh.
* **5. Jumlah Percobaan:** 5 kali percobaan (1 uji coba latihan, 4 percobaan resmi).
* **6. Waktu Istirahat:** 15 detik antar percobaan.
* **7. Data Mentah yang Dicatat:** Posisi skala tangkapan tepat di sisi atas ibu jari atlet dalam centimeter.
* **8. Satuan Pengukuran:** Centimeter (cm) dengan 1 desimal.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Tangan tidak bergerak naik/turun sebelum penggaris jatuh, menangkap secara wajar.
  * *Tidak Valid:* Atlet meremas jari sebelum penggaris dilepas (*anticipatory squeeze*) atau menggeser posisi tangan ke bawah.
* **10. Penentuan Hasil Akhir:** Rata-rata jarak tangkap dari 4 percobaan resmi ($d_{avg}$). Nilai jarak lebih kecil menunjukkan reaksi lebih cepat.

---

### PROTOKOL 7: Sargent Wall Chalk Jump Test (`TST-JMP-VER`)
* **Indikator Terkait:** `FTB-UNI-PHY-08` (Lompatan — Tier 2–4)
* **1. Tujuan Pengukuran:** Mengukur kapasitas daya lenting vertikal (*vertical jump height*) yang esensial untuk duel udara dan heading bola.
* **2. Peralatan:** Dinding lapangan/tiang tegak tinggi, kapur tulis, meteran gulung.
* **3. Setup Lapangan:** Dinding rata vertikal minimal tinggi 3.5 meter. Tempelkan meteran vertikal atau tandai garis skala kapur pada dinding.
* **4. Instruksi Atlet:** Ujung jari dominan atlet dilumuri bubuk kapur. Atlet berdiri menyamping rapat ke dinding, kedua kaki rata di tanah, menjangkau lengan ke atas setinggi mungkin dan menempelkan bekas kapur pertama pada dinding (*Standing Reach Height* / $H_1$). Kemudian atlet mengambil posisi ancang-ancang (menekuk lutut bebas tanpa melangkah) dan melompat setinggi-tingginya sambil menepuk dinding pada puncak lompatan (*Jump Peak Height* / $H_2$).
* **5. Jumlah Percobaan:** 3 kali percobaan.
* **6. Waktu Istirahat:** 1 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Selisih tinggi lompatan: $\Delta H = H_2 - H_1$.
* **8. Satuan Pengukuran:** Centimeter (cm) bulat.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Lompatan dua kaki dari posisi diam tanpa langkah awal (*countermovement jump* tanpa awalan lari).
  * *Tidak Valid:* Mengambil langkah lari awalan atau menyentuh dinding saat fase naik sebelum puncak.
* **10. Penentuan Hasil Akhir:** Selisih tertinggi ($\Delta H_{max}$) dari 3 percobaan valid.

---

### PROTOKOL 8: 5-0-5 Change of Direction Test (`TST-COD-505`)
* **Indikator Terkait:** `FTB-UNI-PHY-09` (Perubahan Arah — Tier 2–4)
* **1. Tujuan Pengukuran:** Mengukur secara spesifik kemampuan deselerasi eksentrik, putaran tubuh 180 derajat, dan re-akselerasi (berbeda dari kelincahan umum).
* **2. Peralatan:** 4 cones, 1 stopwatch, meteran 30m, garis kapur putar 180°.
* **3. Setup Lapangan:** Buat lintasan total 15 meter:
  * Garis start di meter ke-0.
  * Garis sensor/timing manual (Cone A & B) di meter ke-10.
  * Garis batas putar 180° di meter ke-15 (Cone C & D).
* **4. Instruksi Atlet:** Atlet berlari kencang dari meter ke-0. Saat atlet melewati garis meter ke-10, pelatih memulai stopwatch. Atlet sprint hingga meter ke-15, menancapkan satu kaki persis pada atau melewati garis putar, memutar badan 180°, dan sprint kembali melintasi garis meter ke-10 (di mana stopwatch dihentikan).
* **5. Jumlah Percobaan:** 4 kali percobaan (2 kali putaran kaki kanan, 2 kali putaran kaki kiri).
* **6. Waktu Istirahat:** 2 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Waktu tempuh bolak-balik 5m + 5m (total 10m setelah fase ancang-ancang).
* **8. Satuan Pengukuran:** Detik (s) dengan 2 desimal.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Kaki tumpu pemutar wajib menyentuh atau melewati garis putar meter ke-15.
  * *Tidak Valid:* Memutar badan sebelum garis 15 meter atau tergelincir parah.
* **10. Penentuan Hasil Akhir:** Rata-rata waktu terbaik putaran kanan dan putaran kiri: $T_{final} = (\min(Turn_R) + \min(Turn_L)) / 2$.

---

### PROTOKOL 9: 20-Meter Shuttle Run / Beep Test (`TST-END-BLP`)
* **Indikator Terkait:** `FTB-UNI-PHY-10` (Daya Tahan — Tier 3–4)
* **1. Tujuan Pengukuran:** Mengukur kapasitas daya tahan aerobik kardiovaskular maksimal ($VO_2\max$ proxy) atlet dalam pola gerak bolak-balik spesifik sepak bola.
* **2. Peralatan:** File audio Beep Test resmi (MP3 di smartphone), portable speaker, 4 cones penanda, meteran 30m.
* **3. Setup Lapangan:** Dua garis sejajar berjarak tepat 20.0 meter di atas rumput lapangan yang padat dan rata.
* **4. Instruksi Atlet:** Atlet berlari bolak-balik menempuh jarak 20 meter mengikuti ritme nada bip audio yang semakin cepat pada setiap level/menit. Kaki atlet harus menyentuh atau melewati garis 20m tepat saat nada bip berbunyi.
* **5. Jumlah Percobaan:** 1 kali pelaksanaan (dapat dilakukan bersamaan oleh 8–12 atlet sekaligus).
* **6. Waktu Istirahat:** Dilakukan di akhir sesi pengujian (memerlukan pendinginan).
* **7. Data Mentah yang Dicatat:** Level dan Shuttle terakhir yang diselesaikan secara valid (misal: `Level 9.4` atau total meter tempuh).
* **8. Satuan Pengukuran:** Format `Level.Shuttle` atau total jarak tempuh dalam Meter (m).
* **9. Kriteria Valid / Tidak Valid:**
  * *Peringatan:* Jika atlet terlambat mencapai garis sebelum nada bip berbunyi, diberikan 1 kali peringatan.
  * *Eliminasi:* Jika atlet gagal mencapai garis pada nada bip berikutnya secara beruntun, atlet dihentikan dan skor diambil dari shuttle valid terakhir.
* **10. Penentuan Hasil Akhir:** Nilai `Level.Shuttle` terakhir yang valid, dikonversi ke total shuttle atau estimasi jarak meter.

---

### PROTOKOL 10: Standing Broad Jump Test (`TST-PWR-SBJ`)
* **Indikator Terkait:** `FTB-UNI-PHY-11` (Daya Ledak — Tier 3–4)
* **1. Tujuan Pengukuran:** Mengukur daya ledak (*explosive power*) otot tungkai horizontal dan rantai kinetik tubuh bawah.
* **2. Peralatan:** 1 meteran gulung panjang minimal 5 meter, lakban/kapur garis start.
* **3. Setup Lapangan:** Area rumput datar atau matras lompat. Garis start ditandai dengan kapur/lakban. Bentangkan meteran tegak lurus dari garis start ke arah depan.
* **4. Instruksi Atlet:** Atlet berdiri di belakang garis start dengan kedua kaki sejajar selebar bahu. Atlet mengayunkan lengan ke belakang, menekuk lutut, dan melompat ke depan sejauh-jauhnya dengan menolak menggunakan kedua kaki secara serempak, serta mendarat seimbang dengan kedua kaki tanpa jatuh ke belakang.
* **5. Jumlah Percobaan:** 3 kali percobaan.
* **6. Waktu Istirahat:** 1 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Jarak dari garis start hingga titik kontak tumit (atau bagian tubuh atlet yang paling dekat dengan garis start saat mendarat).
* **8. Satuan Pengukuran:** Centimeter (cm) bulat.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Tolakan dan pendaratan dua kaki secara serentak, tidak jatuh ke belakang.
  * *Tidak Valid:* Melakukan lompatan awalan (*hop step*) sebelum melompat, atau jatuh tersungkur ke belakang menyentuh tanah di belakang tumit.
* **10. Penentuan Hasil Akhir:** Jarak terjauh (*maximum distance*) dari 3 percobaan valid.

---

### PROTOKOL 11: 60-Second Push-Up Test (`TST-STR-PU1`)
* **Indikator Terkait:** `FTB-UNI-PHY-12` (Kekuatan Tubuh — Tier 3–4)
* **1. Tujuan Pengukuran:** Mengukur kekuatan daya tahan otot tubuh bagian atas (*upper body muscular endurance*), khususnya pektoralis, deltoid anterior, dan trisep yang menunjang duel benturan fisik (*body charge*).
* **2. Peralatan:** 1 stopwatch, matras senam atau rumput bersih, 1 cone busa/benda setinggi 10 cm sebagai pengukur kedalaman siku (opsional).
* **3. Setup Lapangan:** Area permukaan datar dan kering.
* **4. Instruksi Atlet:** Atlet mengambil posisi push-up standar: tangan selebar bahu, jari menghadap ke depan, punggung dan kaki lurus membentuk garis kaku dari kepala hingga tumit. Saat aba-aba mulai, atlet menurunkan tubuh hingga siku menekuk minimal 90 derajat (dada berjarak $\approx 10$ cm dari tanah), lalu mendorong kembali ke posisi awal dengan lengan lurus sempurna. Lakukan repetisi sebanyak-banyaknya dalam 60 detik.
* **5. Jumlah Percobaan:** 1 kali percobaan (60 detik).
* **6. Waktu Istirahat:** Selesai dalam 1 sesi.
* **7. Data Mentah yang Dicatat:** Jumlah repetisi push-up yang memenuhi standar form sempurna dalam 60 detik.
* **8. Satuan Pengukuran:** Repetisi (reps).
* **9. Kriteria Valid / Tidak Valid:**
  * *Repetisi Tidak Dihitung:* Punggung melengkung ke bawah (*sagging*), pantat terangkat ke atas (*piking*), siku tidak menekuk 90 derajat, atau lengan tidak mengunci lurus di atas. Istirahat hanya diperbolehkan pada posisi atas (*plank position*).
* **10. Penentuan Hasil Akhir:** Total repetisi valid dalam 60 detik.

---

### PROTOKOL 12: Prone Forearm Plank Hold Test (`TST-COR-PLK`)
* **Indikator Terkait:** `FTB-UNI-PHY-13` (Kekuatan Inti — Tier 3–4)
* **1. Tujuan Pengukuran:** Mengukur kekuatan daya tahan isometrik otot inti tubuh (*core stability: rectus abdominis, transversus, erector spinae*) yang menopang stabilitas rotasi tendangan dan keseimbangan duel.
* **2. Peralatan:** 1 stopwatch, matras atau rumput datar.
* **3. Setup Lapangan:** Area permukaan datar 2x1 meter.
* **4. Instruksi Atlet:** Atlet bertumpu pada kedua lengan bawah (siku tepat di bawah bahu) dan jari kaki. Tubuh harus dijaga lurus sempurna dari kepala, bahu, punggung, pinggul, hingga tumit. Stopwatch dimulai saat posisi sempurna terbentuk. Atlet menahan posisi ini selama mungkin.
* **5. Jumlah Percobaan:** 1 kali percobaan.
* **6. Waktu Istirahat:** Selesai dalam 1 sesi.
* **7. Data Mentah yang Dicatat:** Durasi waktu atlet mampu mempertahankan postur plank sempurna.
* **8. Satuan Pengukuran:** Detik (s) bulat.
* **9. Kriteria Valid / Tidak Valid:**
  * *Peringatan:* Pelatih memberikan 1 kali teguran jika pinggul turun atau naik lebih dari 5 cm.
  * *Penghentian Pengukuran:* Pada teguran kedua, atau saat lutut menyentuh tanah, stopwatch segera dihentikan dan waktu dicatat.
* **10. Penentuan Hasil Akhir:** Total durasi detik bertahan sebelum postur kolaps.

---

### PROTOKOL 13: Bangsbo Repeated Sprint Ability Test (`TST-RSA-630`)
* **Indikator Terkait:** `FTB-UNI-PHY-14` (Sprint Berulang — Tier 4)
* **1. Tujuan Pengukuran:** Mengukur kapasitas ketahanan anaerobik alaktik dan laktik atlet dalam mengulang sprint maksimal berkali-kali dengan waktu pemulihan singkat (karakteristik fisik pertandingan level elite).
* **2. Peralatan:** 6 cones penanda, 2 stopwatch, lembar pencatat RSA, peluit.
* **3. Setup Lapangan:** Lintasan lurus 30 meter dengan zona perlambatan 10 meter di ujungnya.
* **4. Instruksi Atlet:** Atlet melakukan sprint maksimal 30 meter sebanyak 6 kali berturut-turut. Setiap kali finis di 30m, atlet berjalan santai kembali ke garis start dalam waktu istirahat tepat 20 detik sebelum sprint berikutnya dimulai.
* **5. Jumlah Percobaan:** 1 set protokol penuh (6 repetisi sprint 30 meter).
* **6. Waktu Istirahat:** Tepat 20 detik istirahat antar repetisi sprint.
* **7. Data Mentah yang Dicatat:** Waktu tempuh untuk setiap repetisi ($S_1, S_2, S_3, S_4, S_5, S_6$). Dihitung waktu terbaik ($S_{best}$), total waktu kumulatif ($S_{total} = \sum_{i=1}^6 S_i$), dan Persentase Indeks Kelelahan (*Fatigue Index* / $FI\%$).
* **8. Satuan Pengukuran:** Detik (s) untuk waktu, dan Persentase (%) untuk Fatigue Index:
  $$\text{Fatigue Index (\%)} = \left( \frac{S_{total}}{6 \times S_{best}} - 1 \right) \times 100$$
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Atlet sprint 100% pada setiap repetisi dan mematuhi batas istirahat 20 detik secara disiplin.
  * *Tidak Valid:* Atlet sengaja memperlambat sprint awal untuk menghemat tenaga (*pacing*) atau istirahat lebih dari 20 detik.
* **10. Penentuan Hasil Akhir:** Kombinasi waktu total ($S_{total}$) dan $FI\%$ penurunan performa.

---

### PROTOKOL 14: Practical Maximum Ball Carry Distance Test (`TST-SHT-DST`)
* **Indikator Terkait:** `FTB-UNI-TEC-07` (Kekuatan Tembakan — Tier 2–4)
* **1. Tujuan Pengukuran:** Alternatif lapangan praktis tanpa radar speed gun untuk mengukur kekuatan transfer energi kinetik tembakan kaki (*shot power*) melalui jarak lambung bola di udara (*carry distance*).
* **2. Peralatan:** 3 bola resmi standar (size 4 untuk Tier 2, size 5 untuk Tier 3–4) dengan tekanan angin terkalibrasi sama (0.8–0.9 bar), meteran gulung 50m, 4 cones penanda garis tendang.
* **3. Setup Lapangan:** Lapangan terbuka lebar dengan garis batas tendang di satu sisi. Bentangkan meteran memanjang ke arah tengah lapangan.
* **4. Instruksi Atlet:** Bola diletakkan diam di belakang garis batas tendang. Atlet mengambil ancang-ancang bebas, menendang bola sekuat tenaga melambung ke arah depan. Pelatih mencatat titik jatuh pertama bola (*first landing point*) di tanah (bukan hasil gelindingan).
* **5. Jumlah Percobaan:** 3 kali percobaan untuk kaki terkuat (dominan).
* **6. Waktu Istirahat:** 1 menit antar tendangan.
* **7. Data Mentah yang Dicatat:** Jarak dari garis batas tendang ke titik jatuh pertama bola di tanah dalam meter.
* **8. Satuan Pengukuran:** Meter (m) dengan presisi 0.5 meter.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Bola melambung tinggi tanpa mengenai tanah sebelum jatuh pertama, bola ditendang dari posisi diam.
  * *Tidak Valid:* Kaki tumpu melewati garis batas sebelum kontak bola, bola menggelinding di tanah (*grounder*).
* **10. Penentuan Hasil Akhir:** Jarak terjauh (*maximum carry distance*) dari 3 percobaan valid.

> **Catatan Analis & Evaluasi Gap:**  
> Pengukuran kekuatan tembakan idealnya mengukur kecepatan bola (*ball exit velocity* dalam km/jam) menggunakan radar speed gun atau sensor Doppler. Namun, demi memenuhi mandat operasional SSB Indonesia tanpa alat mahal, tes *Maximum Carry Distance* ini digunakan sebagai proxy terdekat. Status indikator ini ditandai sebagai:  
> **`NEEDS FURTHER DESIGN (MODERATE GAP: FIELD PROXY VS SPEED GUN)`** untuk keputusan manajemen produk apakah SSB tertentu dapat memasukkan data radar jika perangkat tersedia.

---

### PROTOKOL 15: 30-Second Wall-Pass Alternating Feet Test (`TST-SSB-WAP`)
* **Indikator Terkait:** `FTB-SSB-OUT-02` (Koordinasi Mata-Kaki — Tier 1 Grassroots)
* **1. Tujuan Pengukuran:** Mengukur koordinasi motorik mata-kaki, ritme sentuhan, dan kontrol bola dasar pada anak usia 6–9 tahun.
* **2. Peralatan:** Dinding datar/bangku kayu tebal, 1 bola size 3/4, kapur/lakban, 1 stopwatch.
* **3. Setup Lapangan:** Buat target kotak di dinding setinggi 50 cm dari tanah dengan lebar 1.5 meter. Tarik garis batas berdiri di tanah berjarak 1.5 meter dari dinding.
* **4. Instruksi Atlet:** Atlet berdiri di belakang garis batas 1.5 meter. Saat aba-aba mulai, atlet mengoper bola ke kotak target di dinding dengan kaki kanan, mengontrol/menerima pantulan dengan kaki kiri, lalu mengoper kembali dengan kaki kiri, dan menerima dengan kaki kanan (bergantian kaki). Lakukan sebanyak-banyaknya selama 30 detik.
* **5. Jumlah Percobaan:** 2 kali percobaan.
* **6. Waktu Istirahat:** 2 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Jumlah operan-pantul yang berhasil dikontrol bergantian kaki secara valid dalam 30 detik.
* **8. Satuan Pengukuran:** Repetisi sukses (reps).
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Bola mengenai kotak sasaran di dinding dan dioper bergantian kaki dari belakang garis batas.
  * *Tidak Dihitung:* Mengoper menggunakan kaki yang sama dua kali berturut-turut, atau bola melenceng keluar kotak dinding.
* **10. Penentuan Hasil Akhir:** Jumlah repetisi sukses terbanyak (*highest valid count*) dari 2 percobaan.

---

### PROTOKOL 16: 30-Second Wall Toss & Catch Test (`TST-SSB-TOS`)
* **Indikator Terkait:** `FTB-SSB-GK-02` (Koordinasi Tangan-Mata — Tier 1 GK Grassroots)
* **1. Tujuan Pengukuran:** Mengukur ketepatan pelacakan visual dan koordinasi motorik tangan-mata saat menangkap bola pantul pada posisi kiper usia dini.
* **2. Peralatan:** 1 bola tenis atau bola mini size 1/2, dinding datar, 1 stopwatch, lakban penanda.
* **3. Setup Lapangan:** Garis batas di tanah berjarak 2.0 meter dari dinding datar.
* **4. Instruksi Atlet:** Atlet berdiri di belakang garis batas 2m. Atlet melempar bola ke dinding setinggi dada menggunakan tangan kanan lalu menangkap bola pantulan menggunakan kedua tangan (atau tangan kiri), lalu melempar dengan tangan kiri dan menangkap kembali. Lakukan sebanyak-banyaknya dalam 30 detik.
* **5. Jumlah Percobaan:** 2 kali percobaan.
* **6. Waktu Istirahat:** 1 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Jumlah tangkapan bersih tanpa bola jatuh ke tanah dalam 30 detik.
* **8. Satuan Pengukuran:** Tangkapan sukses (reps / catches).
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Tangkapan bersih sebelum bola menyentuh tanah, kaki tetap di belakang garis 2 meter.
  * *Tidak Dihitung:* Bola menyentuh tanah sebelum ditangkap atau bola jatuh lepas dari tangan.
* **10. Penentuan Hasil Akhir:** Jumlah tangkapan sukses terbanyak (*highest catch count*) dari 2 percobaan.

---

### PROTOKOL 17: 4-Cone Lateral Footwork & Low Catch Course (`TST-SSB-LAT`)
* **Indikator Terkait:** `FTB-SSB-GK-03` (Ketangkasan Gerak Dasar — Tier 1 GK Grassroots)
* **1. Tujuan Pengukuran:** Mengukur ketangkasan gerak kaki menyamping (*lateral footwork*) dan kesiapan posisi tangkapan bola bawah untuk kiper cilik usia 6–9 tahun.
* **2. Peralatan:** 4 cones penanda, 2 bola sepak size 3/4, 1 stopwatch.
* **3. Setup Lapangan:** Buat lintasan gerak lateral dengan 4 cone berjarak 1.2 meter antar cone (total lebar $\approx 3.6$ meter). Pelatih berdiri di depan atlet berjarak 3 meter memegang bola.
* **4. Instruksi Atlet:** Atlet memulai dari cone paling kiri dalam posisi siap kiper (*ready stance*). Atlet melangkah menyamping (*side-shuffle*) melewati sela-sela cone tanpa menyilangkan kaki hingga cone kanan paling ujung, menyentuh cone, lalu meluncur kembali ke tengah untuk menangkap bola mendatar yang digulirkan pelatih dengan tangkapan dua tangan sempurna. Waktu dihitung dari start hingga bola tertangkap aman.
* **5. Jumlah Percobaan:** 2 kali percobaan.
* **6. Waktu Istirahat:** 1.5 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Waktu tempuh rangkaian kelincahan dan tangkapan dalam detik.
* **8. Satuan Pengukuran:** Detik (s) dengan 2 desimal.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Gerakan menyamping sempurna tanpa menyenggol cone dan tangkapan bola aman tanpa terlepas.
  * *Tidak Valid:* Kaki menyilang/tersandung, cone terjatuh, atau bola tangkapan lepas.
* **10. Penentuan Hasil Akhir:** Waktu tercepat (*fastest time*) dari 2 percobaan valid.

---

### PROTOKOL 18: 20-Meter Touchline Channel Sprint Test (`TST-WF-TLA`)
* **Indikator Terkait:** `FTB-POS-WF-01` (Akselerasi Sayap — Tier 3–4 WFR/WFL)
* **1. Tujuan Pengukuran:** Mengukur kapasitas akselerasi linier khusus posisi pemain sayap (*winger*) di koridor sempit tepi lapangan (*touchline channel*) dari posisi transisi menyerang.
* **2. Peralatan:** 4 cones garis batas koridor sayap, 1 stopwatch, meteran 30m.
* **3. Setup Lapangan:** Buat koridor sayap sepanjang 20.0 meter dengan lebar 3.0 meter tepat sejajar dengan garis tepi lapangan (*touchline*).
* **4. Instruksi Atlet:** Atlet berdiri di dalam koridor menghadap ke depan dengan posisi badan menyamping sedikit (posisi menerima umpan terobosan sayap). Saat siap, atlet melakukan sprint maksimal 20 meter menembus garis akhir koridor sayap.
* **5. Jumlah Percobaan:** 2 kali percobaan.
* **6. Waktu Istirahat:** 2.5 menit antar percobaan.
* **7. Data Mentah yang Dicatat:** Waktu tempuh 20 meter di koridor sayap.
* **8. Satuan Pengukuran:** Detik (s) dengan 2 desimal.
* **9. Kriteria Valid / Tidak Valid:**
  * *Valid:* Start dari posisi diam, badan tetap berada di dalam batas koridor sayap 3 meter tanpa melangkah keluar garis tepi.
  * *Tidak Valid:* Melangkah keluar koridor sayap atau melambat sebelum garis 20 meter.
* **10. Penentuan Hasil Akhir:** Waktu tercepat (*fastest time*) dari 2 percobaan valid.

---

## 4. METODE MATEMATIKA KONVERSI DATA MENTAH KE SKOR 1–100

Seluruh data mentah hasil pengujian harus dikonversi menjadi skala nilai terstandarisasi **1 hingga 100** agar dapat masuk secara otomatis ke dalam registry rapor atlet (`scores[canonicalId]`).

### 4.1 Taksonomi Metode Konversi

1. **Inverse Linear Scaling (Semakin Rendah Semakin Baik / Lower-is-Better):**
   * Digunakan untuk parameter waktu tempuh (sprint, kelincahan, waktu tempuh RSA, jarak reaksi jatuh penggaris).
   * Rumus Dasar:
     $$\text{Score} = \text{clamp}\left(1, 100, \text{round}\left(100 - \frac{x - x_{elite}}{x_{base} - x_{elite}} \times (100 - 1)\right)\right)$$
   * Di mana:
     * $x$ = Nilai data mentah atlet (detik / cm).
     * $x_{elite}$ = Nilai ambang batas performa luar biasa (skor 100).
     * $x_{base}$ = Nilai ambang batas performa minimal (skor 1).
     * Fungsi $\text{clamp}(1, 100, v) = \max(1, \min(100, v))$.

2. **Direct Linear Scaling (Semakin Tinggi Semakin Baik / Higher-is-Better):**
   * Digunakan untuk parameter jarak lompatan, jarak tembakan, repetisi push-up, durasi tahanan plank, dan total meter shuttle run.
   * Rumus Dasar:
     $$\text{Score} = \text{clamp}\left(1, 100, \text{round}\left(1 + \frac{x - x_{base}}{x_{elite} - x_{base}} \times (100 - 1)\right)\right)$$
   * Di mana:
     * $x$ = Nilai data mentah atlet (cm / meter / reps / detik).
     * $x_{elite}$ = Nilai batas target elite/maksimal (skor 100).
     * $x_{base}$ = Nilai batas bawah kemampuan awal (skor 1).

3. **Success Rate Scaling (Tingkat Keberhasilan / Target Count):**
   * Digunakan untuk parameter keterampilan koordinasi usia dini berbasis kuantitas repetisi sukses dalam jendela waktu tetap (30 detik).
   * Rumus Dasar:
     $$\text{Score} = \text{clamp}\left(1, 100, \text{round}\left(\frac{\text{Success Count}}{\text{Target Benchmark}} \times 100\right)\right)$$

4. **Piecewise Linear Scaling (Skalasi Multi-Segmen):**
   * Digunakan untuk parameter yang memiliki titik infleksi tajam, seperti Beep Test atau Fatigue Index pada Bangsbo RSA, di mana penurunan performa di bawah persentase tertentu membutuhkan penalti kurva yang lebih terjal.

---

### 4.2 Matriks Metode Konversi per Indikator

| Canonical ID | Nama Indikator | Kode Tes | Tipe Sifat Data | Formula Konversi Terpilih | Parameter yang Dibutuhkan |
|---|---|:---:|:---:|---|---|
| `FTB-UNI-PHY-01` | Akselerasi | TST-SPR-10M | Lower-is-better | Inverse Linear Scaling | $T_{elite}(tier, age), T_{base}(tier, age)$ |
| `FTB-UNI-PHY-02` | Kelincahan | TST-AGL-ARW | Lower-is-better | Inverse Linear Scaling | $T_{elite}(tier, age), T_{base}(tier, age)$ |
| `FTB-UNI-PHY-03` | Keseimbangan | TST-BAL-STK | Higher-is-better | Direct Linear Scaling | $T_{base}(tier, age), T_{elite}(tier, age)$ |
| `FTB-UNI-PHY-04` | Mobilitas | TST-MOB-SAR | Higher-is-better | Direct Linear Scaling | $D_{base}(tier, age), D_{elite}(tier, age)$ |
| `FTB-UNI-PHY-06` | Kecepatan Maksimal | TST-SPR-30M | Lower-is-better | Inverse Linear Scaling | $T_{elite}(tier, age), T_{base}(tier, age)$ |
| `FTB-UNI-PHY-07` | Reaksi | TST-RXN-RLR | Lower-is-better | Inverse Linear Scaling | $D_{elite}(tier, age), D_{base}(tier, age)$ |
| `FTB-UNI-PHY-08` | Lompatan | TST-JMP-VER | Higher-is-better | Direct Linear Scaling | $H_{base}(tier, age), H_{elite}(tier, age)$ |
| `FTB-UNI-PHY-09` | Perubahan Arah | TST-COD-505 | Lower-is-better | Inverse Linear Scaling | $T_{elite}(tier, age), T_{base}(tier, age)$ |
| `FTB-UNI-PHY-10` | Daya Tahan | TST-END-BLP | Higher-is-better | Piecewise Linear (Shuttle/Level)| $L_{base}(tier, age), L_{elite}(tier, age)$ |
| `FTB-UNI-PHY-11` | Daya Ledak | TST-PWR-SBJ | Higher-is-better | Direct Linear Scaling | $D_{base}(tier, age), D_{elite}(tier, age)$ |
| `FTB-UNI-PHY-12` | Kekuatan Tubuh | TST-STR-PU1 | Higher-is-better | Direct Linear Scaling | $R_{base}(tier, age), R_{elite}(tier, age)$ |
| `FTB-UNI-PHY-13` | Kekuatan Inti | TST-COR-PLK | Higher-is-better | Direct Linear Scaling | $T_{base}(tier, age), T_{elite}(tier, age)$ |
| `FTB-UNI-PHY-14` | Sprint Berulang | TST-RSA-630 | Lower-is-better | Piecewise Inverse ($S_{total}$ & $FI\%$) | $Tot_{elite}, Tot_{base}, FI_{elite}, FI_{base}$ |
| `FTB-UNI-TEC-07` | Kekuatan Tembakan | TST-SHT-DST | Higher-is-better | Direct Linear Scaling | $D_{base}(tier, age), D_{elite}(tier, age)$ |
| `FTB-SSB-OUT-02` | Koordinasi Mata-Kaki | TST-SSB-WAP | Higher-is-better | Success Rate Scaling | $R_{base}(T1), R_{target}(T1)$ |
| `FTB-SSB-GK-02` | Koordinasi Tangan-Mata| TST-SSB-TOS | Higher-is-better | Success Rate Scaling | $C_{base}(T1), C_{target}(T1)$ |
| `FTB-SSB-GK-03` | Ketangkasan Gerak | TST-SSB-LAT | Lower-is-better | Inverse Linear Scaling | $T_{elite}(T1), T_{base}(T1)$ |
| `FTB-POS-WF-01` | Akselerasi Sayap | TST-WF-TLA | Lower-is-better | Inverse Linear Scaling | $T_{elite}(tier, age), T_{base}(tier, age)$ |

---

## 5. ANALISIS PEMETAAN MULTI-INDIKATOR & PENCEGAHAN DOUBLE COUNTING

Pemeriksaan silang dilakukan untuk mengidentifikasi apakah sebuah tes fisik dapat menghasilkan data bagi lebih dari satu indikator tanpa menimbulkan bias pengukuran (*anti-double counting*):

### 5.1 Penggabungan Efisien yang Valid
1. **Tes Sprint 30 Meter dengan Split 10 Meter:**
   * Jika pada tes sprint 30 meter (`TST-SPR-30M`) pelatih menggunakan pencatatan waktu antara (*split time* pada meter ke-10):
     * Waktu 0–10 meter = **Akselerasi** (`FTB-UNI-PHY-01`).
     * Waktu 0–30 meter (atau interval 10–30m) = **Kecepatan Maksimal** (`FTB-UNI-PHY-06`).
   * *Justifikasi Konstruk:* Sah secara fisiologis karena akselerasi awal (daya dorong eksplosif dari diam) dan kecepatan puncak (efisiensi kayuhan dan frekuensi langkah maksimal) merupakan dua kapasitas biomotorik yang terbukti independen secara biomekanika olahraga.
   * *Syarat Operasional:* Hanya dapat digabung jika terdapat 2 stopwatch/pelatih atau rekaman video berkecepatan tinggi. Jika hanya ada 1 pelatih dengan 1 stopwatch biasa, tes 10m dan 30m harus dilakukan pada sesi percobaan terpisah.

### 5.2 Pemisahan Konstruk yang Ditegakkan (Pencegahan Double Counting)
1. **Kelincahan (`FTB-UNI-PHY-02`) vs Perubahan Arah (`FTB-UNI-PHY-09`):**
   * *Kelincahan (Agility - Arrowhead Test):* Mengukur kapasitas manuver multi-arah dengan sudut potong tumpul/tajam (45° dan 90°), antisipasi ruang, dan kontinuitas koordinasi langkah dinamis.
   * *Perubahan Arah (COD - 5-0-5 Test):* Mengukur kapasitas deselerasi eksentrik tajam 180° (*braking force*) dan re-akselerasi dari tumpuan satu kaki.
   * *Keputusan:* **DILARANG DIGABUNGKAN.** Kedua tes harus diuji terpisah untuk mencegah kerancuan konstruk biomotorik.
2. **Lompatan (`FTB-UNI-PHY-08`) vs Daya Ledak (`FTB-UNI-PHY-11`):**
   * *Lompatan (Vertical Jump - Sargent Jump):* Mengukur gaya dorong vertikal murni sumbu Y.
   * *Daya Ledak (Standing Broad Jump):* Mengukur transfer gaya horizontal sumbu X dengan keterlibatan rotasi panggul dan dorongan tubuh ke depan.
   * *Keputusan:* **DILARANG DIGABUNGKAN.** Keduanya mewakili sumbu vektor gerak yang berbeda dalam sepak bola.
3. **Akselerasi Universal (`FTB-UNI-PHY-01`) vs Akselerasi Sayap (`FTB-POS-WF-01`):**
   * *Akselerasi Universal (10m Central):* Sprint linear lurus dari garis tengah.
   * *Akselerasi Sayap (20m Touchline Channel):* Dilakukan di koridor sempit tepi lapangan dengan ancang-ancang menyamping (*half-turned stance*).
   * *Keputusan:* Tidak terjadi *double counting* karena `FTB-POS-WF-01` hanya dievaluasi pada atlet dengan posisi sayap (`WFR/WFL`) pada Tier 3–4, sedangkan atlet non-sayap hanya mengevaluasi `FTB-UNI-PHY-01`.

---

## 6. RAW DATA SCHEMA KONSEPTUAL

Untuk memfasilitasi integrasi otomatis ke database CHUVATOR pada fase implementasi mendatang, berikut adalah skema konseptual payload data mentah pengujian (*Assessment Battery Payload*):

```json
{
  "combineSession": {
    "tenantId": "uuid",
    "classId": "uuid",
    "studentId": "uuid",
    "evaluatedAt": "2026-11-12T05:00:00Z",
    "evaluatorId": "coach-uuid",
    "evaluatorName": "Pelatih Kepala",
    "activeTier": 3,
    "playerRole": "WFR"
  },
  "rawTestResults": {
    "TST-SPR-10M": {
      "attempts": [1.98, 1.94],
      "best": 1.94,
      "unit": "s",
      "valid": true
    },
    "TST-AGL-ARW": {
      "leftAttempt": 8.42,
      "rightAttempt": 8.38,
      "average": 8.40,
      "unit": "s",
      "valid": true
    },
    "TST-BAL-STK": {
      "rightLegAttempts": [22, 28, 26],
      "leftLegAttempts": [20, 24, 25],
      "averageBest": 26.5,
      "unit": "s",
      "valid": true
    },
    "TST-MOB-SAR": {
      "attempts": [28.5, 30.0, 31.0],
      "best": 31.0,
      "unit": "cm",
      "valid": true
    },
    "TST-SPR-30M": {
      "attempts": [4.52, 4.45],
      "best": 4.45,
      "unit": "s",
      "valid": true
    },
    "TST-RXN-RLR": {
      "attempts": [18.2, 16.5, 15.8, 17.1],
      "averageDistance": 16.9,
      "unit": "cm",
      "valid": true
    },
    "TST-JMP-VER": {
      "standingReach": 210,
      "jumpPeakAttempts": [252, 255, 256],
      "maxDelta": 46,
      "unit": "cm",
      "valid": true
    },
    "TST-COD-505": {
      "turnRightBest": 2.45,
      "turnLeftBest": 2.49,
      "average": 2.47,
      "unit": "s",
      "valid": true
    },
    "TST-END-BLP": {
      "level": 9,
      "shuttle": 4,
      "totalShuttles": 78,
      "estimatedDistanceMeters": 1560,
      "valid": true
    },
    "TST-PWR-SBJ": {
      "attempts": [198, 204, 206],
      "best": 206,
      "unit": "cm",
      "valid": true
    },
    "TST-STR-PU1": {
      "validReps60s": 38,
      "unit": "reps",
      "valid": true
    },
    "TST-COR-PLK": {
      "holdDurationSeconds": 145,
      "unit": "s",
      "valid": true
    },
    "TST-SHT-DST": {
      "attempts": [38.5, 42.0, 41.0],
      "best": 42.0,
      "unit": "m",
      "valid": true
    },
    "TST-WF-TLA": {
      "attempts": [3.12, 3.08],
      "best": 3.08,
      "unit": "s",
      "valid": true
    }
  },
  "computedIndicatorScores": {
    "FTB-UNI-PHY-01": 85,
    "FTB-UNI-PHY-02": 82,
    "FTB-UNI-PHY-03": 78,
    "FTB-UNI-PHY-04": 80,
    "FTB-UNI-PHY-06": 88,
    "FTB-UNI-PHY-07": 84,
    "FTB-UNI-PHY-08": 81,
    "FTB-UNI-PHY-09": 83,
    "FTB-UNI-PHY-10": 76,
    "FTB-UNI-PHY-11": 85,
    "FTB-UNI-PHY-12": 79,
    "FTB-UNI-PHY-13": 88,
    "FTB-UNI-TEC-07": 82,
    "FTB-POS-WF-01": 87
  }
}
```

---

## 7. RANCANGAN PARAMETER DAN KEBUTUHAN DATA ACUAN (REFERENCE DATA REQUIRED)

Sesuai instruksi change control yang ketat: **DILARANG membuat angka normatif fiktif.**  
Oleh karena itu, seluruh nilai batas konversi ($x_{base}$ dan $x_{elite}$) disiapkan dalam bentuk **template matriks parameter** yang akan diisi secara empiris berdasarkan tabel acuan Filanesia PSSI, Kemenpora, atau data agregat empiris CHUVATOR:

### Matriks Kebutuhan Data Acuan per Kelompok Umur

| Kode Tes | Indikator | Satuan | Ambang Base (Skor 1) | Ambang Elite (Skor 100) | Status Data Acuan |
|---|---|:---:|:---:|:---:|:---:|
| **TST-SPR-10M** | Akselerasi | s | `PARAM_SPR10_BASE(age)` | `PARAM_SPR10_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-AGL-ARW** | Kelincahan | s | `PARAM_ARW_BASE(age)` | `PARAM_ARW_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-BAL-STK** | Keseimbangan | s | `PARAM_STK_BASE(age)` | `PARAM_STK_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-MOB-SAR** | Mobilitas | cm | `PARAM_SAR_BASE(age)` | `PARAM_SAR_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-SPR-30M** | Kecepatan Maksimal | s | `PARAM_SPR30_BASE(age)` | `PARAM_SPR30_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-RXN-RLR** | Reaksi | cm | `PARAM_RLR_BASE(age)` | `PARAM_RLR_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-JMP-VER** | Lompatan | cm | `PARAM_VJMP_BASE(age)` | `PARAM_VJMP_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-COD-505** | Perubahan Arah | s | `PARAM_505_BASE(age)` | `PARAM_505_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-END-BLP** | Daya Tahan | Level/m | `PARAM_BEEP_BASE(age)` | `PARAM_BEEP_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-PWR-SBJ** | Daya Ledak | cm | `PARAM_SBJ_BASE(age)` | `PARAM_SBJ_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-STR-PU1** | Kekuatan Tubuh | reps | `PARAM_PU_BASE(age)` | `PARAM_PU_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-COR-PLK** | Kekuatan Inti | s | `PARAM_PLK_BASE(age)` | `PARAM_PLK_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-RSA-630** | Sprint Berulang | s & % | `PARAM_RSA_BASE(age)` | `PARAM_RSA_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-SHT-DST** | Kekuatan Tembakan | m | `PARAM_SHT_BASE(age)` | `PARAM_SHT_ELITE(age)` | **REFERENCE DATA REQUIRED** |
| **TST-SSB-WAP** | Koordinasi Mata-Kaki| reps | `PARAM_WAP_BASE(T1)` | `PARAM_WAP_TARGET(T1)` | **REFERENCE DATA REQUIRED** |
| **TST-SSB-TOS** | Koordinasi Tangan-Mata| reps | `PARAM_TOS_BASE(T1)` | `PARAM_TOS_TARGET(T1)` | **REFERENCE DATA REQUIRED** |
| **TST-SSB-LAT** | Ketangkasan Gerak | s | `PARAM_LAT_BASE(T1)` | `PARAM_LAT_ELITE(T1)` | **REFERENCE DATA REQUIRED** |
| **TST-WF-TLA** | Akselerasi Sayap | s | `PARAM_WFA_BASE(age)` | `PARAM_WFA_ELITE(age)` | **REFERENCE DATA REQUIRED** |

---

## 8. DAFTAR GAP & KEPUTUSAN PRODUK (PRODUCT DECISION GAPS)

Sebelum modul Scouting Combine diimplementasikan ke dalam kode antarmuka dan database, terdapat beberapa gap strategis yang memerlukan keputusan dari Tim Produk dan Manajemen CHUVATOR:

1. **Gap Kekuatan Tembakan (`FTB-UNI-TEC-07`): Jarak Lambung vs Radar Speed Gun:**
   * *Masalah:* Tes jarak lambung bola (*Carry Distance*) dipengaruhi oleh arah angin dan kondisi kebasahan rumput. Di sisi lain, *speed gun radar* membutuhkan biaya tambahan $\approx$ Rp 1.500.000 – Rp 3.000.000.
   * *Opsi Keputusan:* Menetapkan protokol *Carry Distance* sebagai default, namun menyediakan field opsional *"Radar Speed Gun (km/jam)"* jika akademi memiliki perangkat tersebut. Ditandai sebagai: **`NEEDS FURTHER DESIGN (MODERATE GAP: FIELD PROXY VS SPEED GUN)`**.
2. **Gap Protokol Daya Tahan (`FTB-UNI-PHY-10`): Bleep Test vs Yo-Yo IR1:**
   * *Masalah:* Bleep Test (lari kontinu) lebih umum di SSB lokal, tetapi Yo-Yo Intermittent Recovery Test Level 1 (lari dengan jeda pemulihan 10 detik) lebih mewakili pola interval sepak bola modern.
   * *Opsi Keputusan:* Mendukung input salah satu dari keduanya (Bleep Test atau Yo-Yo IR1) dengan rumus normalisasi terpisah.
3. **Penyimpanan Nilai Ujian Mentah (*Raw Combine Results*):**
   * *Masalah:* Tabel database saat ini (`academy_evaluations`) hanya menyimpan `scores JSONB` yang berisi skor terkonversi 0–100. Nilai mentah (misal: "1.94 detik" atau "46 cm") akan hilang jika tidak disimpan secara terpisah.
   * *Rekomendasi:* Diperlukan penambahan kolom `raw_test_data JSONB` pada skema database `academy_evaluations` pada fase migrasi berikutnya agar orang tua atlet dan tim pelatih dapat melihat rekam jejak angka riil atlet.
4. **Kalibrasi Data Acuan Normatif (Indonesia-Specific Norms):**
   * *Masalah:* Standar fisik Eropa/FIFA sering kali terlalu tinggi untuk rentang populasi rata-rata antropometri anak Indonesia, sehingga berisiko menghasilkan skor terlalu rendah secara artifisial.
   * *Rekomendasi:* Mengadopsi tabel norma Kemenpora / PSSI Filanesia Grassroots untuk penentuan nilai $x_{base}$ dan $x_{elite}$.

---
*Laporan ini disusun secara faktual dan komprehensif berdasarkan inventarisasi 18 indikator objektif CHUVATOR pada 12 November 2026. Tidak ada perubahan yang dilakukan terhadap source code, database, atau logika penilaian aplikasi.*
