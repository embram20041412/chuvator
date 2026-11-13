# CHUVATOR — TASK 03.4 & TASK 03.4.1
# SUPABASE DATABASE MIGRATION READINESS & FINAL EXECUTION REVIEW REPORT

**Tanggal Review & Rekonsiliasi:** 2026-11-12  
**Target Database:** Supabase PostgreSQL CHUVATOR (`public.athlete_test_results`)  
**Status Kesiapan Paket SQL:** `READY FOR ADMIN EXECUTION`  
**Status Pengujian Kontrak & Integritas SQL:** `PASS` (58/58 test assertions lulus via `npx tsx --test tests/task03_4_migration_readiness.test.js`)  
**Status Eksekusi Langsung ke Supabase Produksi:** `NOT VERIFIED` *(Akses DDL/SQL Editor produksi berada di bawah wewenang eksklusif Administrator Database)*

---

## 1. Ringkasan Eksekutif & Tujuan Review (Task 03.4.1)

Laporan ini merupakan hasil pemeriksaan akhir (*Final Execution Review*) dan rekonsiliasi menyeluruh terhadap paket migrasi SQL **TASK 03.4** sebelum diserahkan kepada Administrator Database Supabase CHUVATOR.

Tujuan utama dari review ini adalah:
1. **Rekonsiliasi File:** Memastikan integritas dan keteraturan seluruh file SQL pada direktori `docs/assessment/sql/task03_4/`. Tidak ada file usang, duplikasi, inkonsistensi penamaan, atau komponen yang tertinggal.
2. **Pemeriksaan Master Migration:** Memastikan file `00_master_task03_4_assessment_battery_migration.sql` memuat seluruh DDL, fungsi keamanan, trigger, backfill data, RLS policy, table grants, dan constraint kalibrasi secara lengkap, atomik (`BEGIN ... COMMIT`), idempoten, dan selaras 100% dengan modul terpisah (`02`–`05`).
3. **Audit Keamanan RLS:** Memvalidasi bahwa seluruh fungsi `SECURITY DEFINER` memiliki `search_path` eksplisit, hak eksekusi dibatasi secara ketat (*least-privilege*), isolasi multi-tenant terjamin, scope pelatih memiliki perlindungan anti-spoofing, kasir/staf dibatasi read-only, dan superadmin ditolak mengakses data operasional tenant.
4. **Pemeriksaan Integritas Backfill:** Memastikan tidak ada pengisian data tebakan (*fabricated values*), `final_raw_value` dan `trials` tidak dimutasi, `converted_score` tidak digenerate sebelum kalibrasi valid, serta data lama di luar cakupan tidak disentuh.
5. **Verifikasi Suite Pasca-Migrasi:** Memvalidasi bahwa `06_post_migration_verification.sql` mencakup seluruh 8 peran operasional dalam transaksi `BEGIN ... ROLLBACK`, sehingga dapat dijalankan oleh Administrator tanpa meninggalkan data sampah di database.
6. **Pemeriksaan Rollback Plan:** Memastikan `07_rollback_plan.sql` bersifat non-destruktif (*fail-closed* tanpa `DROP TABLE` dan tanpa penghapusan data mentah atlet).
7. **Kepatuhan Batasan Mutlak:** Tidak ada DDL yang dijalankan langsung ke Supabase produksi, tidak ada perubahan skema live, tidak ada deployment, dan tidak ada git push dari lingkungan pengembangan.

---

## 2. Inventarisasi & Rekonsiliasi File SQL (`docs/assessment/sql/task03_4/`)

Direktori `docs/assessment/sql/task03_4/` memuat tepat 8 file SQL yang telah direkonsiliasi:

| # | Nama File | Baris | Tipe Operasi | Peran & Deskripsi |
|---|---|---|---|---|
| 0 | `00_master_task03_4_assessment_battery_migration.sql` | 672 | DDL / DML Transaksional | **Consolidated Master Migration SQL** (`BEGIN ... COMMIT`). Menggabungkan seluruh tahapan migrasi terstruktur secara atomik dan idempoten. |
| 1 | `01_preflight_inspection.sql` | 124 | Read-Only DQL | Skrip inspeksi pra-migrasi (100% read-only) untuk memvalidasi tabel prasyarat, kolom kunci, konsistensi data lama, dan foreign key orphan. |
| 2 | `02_core_table_and_indexes.sql` | 167 | DDL Idempoten | Pembuatan tabel `athlete_test_results`, penambahan 4 kolom konteks terindeks (`test_period`, `measurement_method`, `age_group`, `age_years_at_test`), check constraints, dan 6 composite index B-tree. |
| 3 | `03_security_functions_and_triggers.sql` | 431 | DDL / DML Idempoten | 3 Fungsi Keamanan `SECURITY DEFINER`, Trigger imutabilitas & sinkronisasi konteks, pencabutan/pemberian hak `EXECUTE`, serta backfill aman kolom terindeks. |
| 4 | `04_rls_policies_and_grants.sql` | 68 | DDL Idempoten | `ENABLE` dan `FORCE ROW LEVEL SECURITY`, `REVOKE/GRANT` tabel pada role `authenticated`, dan 4 kebijakan RLS (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). |
| 5 | `05_calibration_compatibility.sql` | 65 | DDL Idempoten | Validasi pra-syarat baris `CALIBRATED` eksisting dan penambahan CHECK constraint konsistensi kalibrasi (`chk_athlete_test_results_calibration_consistency`). |
| 6 | `06_post_migration_verification.sql` | 423 | DQL & DML Rollback | Bagian A: Inspeksi katalog sistem (read-only). Bagian B: 8 skenario simulasi peran transaksional di dalam `BEGIN ... ROLLBACK;`. |
| 7 | `07_rollback_plan.sql` | 66 | DDL / DCL Fail-Closed | Prosedur pembatalan darurat non-destruktif (`BEGIN ... COMMIT`). Mencabut kebijakan RLS, trigger, constraint, dan indeks tanpa menghapus tabel atau data pengukuran atlet. |

**Hasil Rekonsiliasi File:**
- Penamaan file konsisten dan terurut berdasarkan dependensi eksekusi (`00` untuk master, `01` untuk pra-pemeriksaan, `02`–`05` untuk modul migrasi bertahap, `06` untuk verifikasi pasca-migrasi, dan `07` untuk prosedur rollback).
- Tidak ada file duplikat, file sementara (*temporary files*), atau versi yang saling bertentangan pada direktori `docs/assessment/sql/` maupun `docs/assessment/`.

---

## 3. Pemeriksaan Master Migration vs File Komponen Terpisah

Pemeriksaan baris-demi-baris dan verifikasi kesamaan pernyataan (*normalized SQL comparison*) dilakukan antara master script `00_master_task03_4_assessment_battery_migration.sql` dan modul komponen `02`, `03`, `04`, dan `05`:

```
[Master Execution Flow]
├── BEGIN; (Atomic Transaction)
├── [1] Preflight Dependency Check (Pemeriksaan 7 tabel prasyarat via DO $$ PL/pgSQL block)
├── [2] Core Table, Columns & Indexes (Identik dengan 02_core_table_and_indexes.sql)
│   ├── CREATE TABLE IF NOT EXISTS public.athlete_test_results
│   ├── ALTER TABLE ... ADD COLUMN IF NOT EXISTS (test_period, measurement_method, age_group, age_years_at_test)
│   ├── ALTER TABLE ... ADD CONSTRAINT (chk_athlete_test_results_age_years_range, test_period_format, spr10m_method)
│   └── CREATE INDEX IF NOT EXISTS (6 Composite B-tree Indexes)
├── [3] Security Functions, Trigger, Privileges & Backfill (Identik dengan 03_security_functions_and_triggers.sql)
│   ├── CREATE OR REPLACE FUNCTION public.get_strict_tenant_member_role(TEXT)
│   ├── CREATE OR REPLACE FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID)
│   ├── CREATE OR REPLACE FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID)
│   ├── CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results()
│   ├── CREATE TRIGGER trg_validate_and_protect_athlete_test_results
│   ├── REVOKE / GRANT EXECUTE ON FUNCTIONS
│   └── UPDATE public.athlete_test_results (Backfill aman & idempoten)
├── [4] RLS Policies & Least-Privilege Table Grants (Identik dengan 04_rls_policies_and_grants.sql)
│   ├── ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
│   ├── ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;
│   ├── REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon;
│   ├── GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ... TO authenticated;
│   └── 4 RLS Policies: athlete_test_results_{select,insert,update,delete}_policy
├── [5] Calibration Compatibility Constraint (Identik dengan 05_calibration_compatibility.sql)
│   ├── Pre-check DO $$ block (Validasi tidak ada baris uncalibrated yang berstatus CALIBRATED)
│   └── ALTER TABLE ... ADD CONSTRAINT chk_athlete_test_results_calibration_consistency
└── COMMIT;
```

**Hasil Perbandingan:**
1. **Urutan Dependensi:** Master migration menyusun dependensi secara sempurna. Prasyarat tabel diperiksa terlebih dahulu, tabel dan kolom terindeks dibuat sebelum fungsi/trigger, fungsi keamanan dibuat sebelum RLS policies yang memanggilnya, dan constraint kalibrasi diterapkan setelah data eksisting tervalidasi.
2. **Kesesuaian Kode DDL:** Seluruh definisi tabel, tipe data, foreign key (`ON DELETE SET NULL` / `ON DELETE CASCADE`), CHECK constraint, nama indeks, signature fungsi, body PL/pgSQL, dan ekspresi RLS cocok 100% dengan file komponennya.
3. **Idempotensi:** Setiap pernyataan DDL menggunakan klausa defensif (`IF NOT EXISTS`, `OR REPLACE`, `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS`), sehingga aman dijalankan berulang kali tanpa merusak objek yang sudah ada.

---

## 4. Temuan Audit dan Koreksi yang Dilakukan

Selama proses review Task 03.4 dan Task 03.4.1, dilakukan identifikasi mendalam terhadap 5 aspek arsitektural dan telah diterapkan koreksi terpadu pada file master dan komponen:

### 4.1 Koreksi Sanitasi & Validasi Defensif `measurement_method` untuk `TST-SPR-10M`
- **Temuan:** Skrip Task 03 memiliki CHECK constraint `chk_athlete_test_results_spr10m_method` yang mensyaratkan `measurement_method` untuk `TST-SPR-10M` bernilai `'STOPWATCH_MANUAL'` atau `'SMARTPHONE_VIDEO'`. Pada implementasi awal Task 03.4, query backfill dan trigger mengambil nilai `measurementMethod` dari JSONB dan langsung melakukan `UPPER()`. Apabila terdapat baris data warisan (*legacy data*) yang menyimpan string tidak baku (misalnya `'radar'`, `'gate'`, atau `'video_app'`), eksekusi backfill atau insert melalui trigger akan memicu pelanggaran CHECK constraint `23514`.
- **Koreksi:** Logika trigger dan query backfill pada `03_security_functions_and_triggers.sql` dan master migration diperkeras:
  ```sql
  WHEN test_id = 'TST-SPR-10M' THEN
      CASE
          WHEN UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
          THEN UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), ''))
          ...
          ELSE NULL
      END
  ```
  Nilai non-standar tidak akan dipaksakan masuk ke kolom `measurement_method`, sehingga integritas CHECK constraint tetap terjaga tanpa menggagalkan proses migrasi.

### 4.2 Pengerasan Hak Eksekusi Fungsi (*Least-Privilege Function Grants*)
- **Temuan:** Secara default di PostgreSQL, fungsi baru dalam skema `public` mendapatkan hak `EXECUTE` otomatis untuk pseudorole `PUBLIC`. Ini berarti pengguna anonim (*anon*) dapat memanggil fungsi `SECURITY DEFINER` secara langsung via RPC.
- **Koreksi:** Diterapkan kebijakan *least-privilege* eksplisit:
  ```sql
  REVOKE ALL ON FUNCTION public.get_strict_tenant_member_role(TEXT) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

  GRANT EXECUTE ON FUNCTION public.get_strict_tenant_member_role(TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) TO authenticated;
  ```
  Fungsi trigger `validate_and_protect_athlete_test_results()` bahkan dicabut dari `authenticated` karena trigger dieksekusi melalui konteks internal PostgreSQL engine tanpa perlu pemanggilan langsung oleh pengguna.

### 4.3 Perlindungan Anti-Spoofing Cakupan Pelatih (*Coach Scope Anti-Spoofing*)
- **Temuan:** Pada rancangan awal Task 03, fungsi `coach_can_manage_student` mengevaluasi parameter kelas dengan ekspresi `COALESCE(check_class_id, v_student_class_id)` dan memiliki klausa `OR cls.coach_id IS NULL`. Hal ini memungkinkan pelatih yang mengelola Kelas A menyisipkan payload dengan `class_id = Kelas A` untuk merekam atlet yang sebenarnya terdaftar di Kelas B.
- **Koreksi:** Fungsi `coach_can_manage_student` pada Task 03.4 mengambil `students.class_id` resmi dari database secara ketat:
  1. Jika `check_class_id` dikirim oleh klien dan berbeda dengan `students.class_id`, fungsi langsung mengembalikan `FALSE` (mencegah manipulasi asosiasi kelas).
  2. Pelatih hanya diberi izin jika terbukti ditugaskan sebagai `coach_id` pada kelas resmi siswa tersebut.
  3. Celah `cls.coach_id IS NULL` dihapus secara total.

### 4.4 Penguncian Imutabilitas Audit Trigger pada `UPDATE`
- **Temuan:** Pada rancangan awal, kolom audit penting seperti `recorded_by_user_id`, `test_id`, dan `indicator_id` belum dikunci pada saat `UPDATE`.
- **Koreksi:** Trigger `validate_and_protect_athlete_test_results` mempertegas perlindungan integritas:
  - Mengunci `id`, `tenant_id`, `student_id`, `created_at`, `recorded_by_user_id`, `test_id`, dan `indicator_id`. Upaya memanipulasi kolom-kolom ini pada operasi `UPDATE` akan memicu error `SQLSTATE 42501` (*Access denied: mutating immutable test result audit columns is forbidden*).
  - Pada operasi `INSERT`, kolom `recorded_by_user_id` selalu diisi otomatis dengan `auth.uid()`, mengabaikan nilai apa pun yang dikirimkan klien.

### 4.5 Pengamanan `search_path` pada Fungsi `SECURITY DEFINER`
- **Temuan:** Fungsi `SECURITY DEFINER` yang tidak menetapkan `search_path` rentan terhadap eksploitasi *search path hijacking*.
- **Koreksi:** Seluruh fungsi keamanan (`get_strict_tenant_member_role`, `athlete_belongs_to_tenant`, `coach_can_manage_student`, `validate_and_protect_athlete_test_results`) secara eksplisit dikonfigurasi dengan:
  ```sql
  SET search_path = public, extensions, pg_temp;
  ```

---

## 5. Hasil Audit Keamanan RLS & Matriks Hak Akses

Row Level Security (RLS) diaktifkan dan dipaksakan (`FORCE ROW LEVEL SECURITY`) pada tabel `public.athlete_test_results`. Dengan pengaturan ini, bahkan pemilik tabel atau role dengan hak bypass RLS non-superuser tetap tunduk pada kebijakan RLS.

### 5.1 Matriks Evaluasi Hak Akses Per Peran (8 Skenario Operasional)

| Peran Pengguna (*Actor Role*) | Sumber Autentikasi / Keanggotaan | SELECT | INSERT | UPDATE | DELETE | Catatan Kebijakan RLS |
|---|---|---|---|---|---|---|
| **Tenant Owner** | `public.tenants.owner_uid` aktif | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | Terbatas hanya pada atlet dalam `tenant_id` miliknya. Ditolak lintas-tenant. |
| **Tenant Admin** | `public.users_staff` (`admin`/`administrator`) aktif | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | Terbatas hanya pada atlet dalam `tenant_id` miliknya. Ditolak lintas-tenant. |
| **Coach (Dalam Cakupan)** | `public.users_staff` (`coach`) + `coaches.auth_uid` + `academy_classes.coach_id` | `ALLOWED` | `ALLOWED` | `ALLOWED` | `ALLOWED` | Hanya berlaku untuk atlet yang terdaftar di kelas yang secara resmi dilatihnya. |
| **Coach (Di Luar Cakupan)** | `public.users_staff` (`coach`) | `DENIED` (`0` row) | `DENIED` (`42501`) | `DENIED` (`42501`) | `DENIED` (`42501`) | Ditolak oleh `coach_can_manage_student()`. Upaya spoofing `class_id` digagalkan. |
| **Kasir (`kasir`)** | `public.users_staff` (`kasir`/`cashier`) aktif | `ALLOWED` | `DENIED` (`42501`) | `DENIED` (`42501`) | `DENIED` (`42501`) | Hak *Read-Only*. Membantu kasir melihat status kesiapan atlet tanpa wewenang mengubah data teknis tes. |
| **Staf Umum (`staff`)** | `public.users_staff` (`staff`/`staf`) aktif | `ALLOWED` | `DENIED` (`42501`) | `DENIED` (`42501`) | `DENIED` (`42501`) | Hak *Read-Only*. Membantu staf operasional melihat riwayat tes tanpa wewenang teknis. |
| **Platform Superadmin** | `public.platform_superadmins` atau `public.is_superadmin()` | `DENIED` (`0` row) | `DENIED` (`42501`) | `DENIED` (`42501`) | `DENIED` (`42501`) | **Zero Tenant Data Access**. Akses operasional tenant ditolak total demi privasi data tenant. |
| **Anonim / Staf Non-Aktif / Akun Luar** | Role `anon`, staf non-aktif, atau tanpa keanggotaan tenant | `DENIED` (`0` row) | `DENIED` (`42501`) | `DENIED` (`42501`) | `DENIED` (`42501`) | Hak akses dicabut di level tabel (`REVOKE ALL`) dan ditolak oleh policy RLS (*fail-closed*). |

---

## 6. Pemeriksaan Integritas Data Backfill

Logika backfill data pada `03_security_functions_and_triggers.sql` dan master migration telah diinspeksi terhadap kriteria integritas data:

1. **Non-Destruktif & Tanpa Manipulasi Fakta Lapangan:**
   - Kolom `final_raw_value`, `trials`, `final_unit`, dan `aggregation_method` **TIDAK PERNAH DIUBAH** oleh query backfill.
   - Kolom `converted_score` **TIDAK PERNAH DIISI** jika kalibrasi belum selesai (tetap `NULL` dan `calibration_status` tetap `PENDING_CALIBRATION`).
2. **Klausa Sumber Backfill Konteks Terindeks:**
   - `test_period`: Diambil dari `to_char(test_date, 'YYYY-MM')`.
   - `measurement_method`: Hanya diambil jika terdapat di JSONB (`derived_metrics->>'measurementMethod'`, `derived_metrics->'athleteTestContext'->>'measurementMethod'`, atau `auxiliary_inputs->>'measurementMethod'`). Untuk `TST-SPR-10M`, hanya menerima `'STOPWATCH_MANUAL'` dan `'SMARTPHONE_VIDEO'`. Jika tidak ada konteks metode, kolom tetap `NULL` tanpa rekayasa.
   - `age_group`: Hanya diekstraksi jika terdapat di JSONB konteks (`derived_metrics->'athleteTestContext'->>'ageGroup'`).
   - `age_years_at_test`: Hanya diekstraksi jika berupa integer valid antara 3 dan 65 tahun (`derived_metrics->'athleteTestContext'->>'ageYearsAtTest'`).
3. **Klausa WHERE yang Terfokus:**
   - Query backfill hanya menyentuh baris yang kolom konteks barunya masih `NULL` dan memiliki properti konteks terkait di dalam JSONB. Baris data yang tidak relevan atau data modul lain sama sekali tidak tersentuh.

---

## 7. Pemeriksaan Rencana Rollback (`07_rollback_plan.sql`)

Prosedur rollback pada file `07_rollback_plan.sql` telah dievaluasi dengan hasil sebagai berikut:

1. **Anti-Penghapusan Data Produksi (Zero-Data-Loss Safety):**
   - Skrip **TIDAK MEMUAT `DROP TABLE public.athlete_test_results`**.
   - Skrip **TIDAK MEMUAT perintah `DELETE` atau `TRUNCATE`**.
   - Seluruh fakta pengukuran mentah atlet yang tersimpan di dalam tabel tetap utuh 100%.
2. **Fail-Closed Security Restoration:**
   - Skrip mencabut ke-4 policy RLS (`athlete_test_results_{select,insert,update,delete}_policy`).
   - Skrip langsung menjalankan `REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon, authenticated;`, memastikan tidak ada celah akses terbuka saat RLS non-aktif.
3. **Pembersihan Bersih Objek Tambahan:**
   - Menghapus trigger `trg_validate_and_protect_athlete_test_results`.
   - Menghapus 4 fungsi keamanan Task 03.4 (`validate_and_protect_athlete_test_results`, `coach_can_manage_student`, `athlete_belongs_to_tenant`, `get_strict_tenant_member_role`).
   - Menghapus CHECK constraint Task 03.4 (`chk_athlete_test_results_calibration_consistency`, `chk_athlete_test_results_spr10m_method`, `chk_athlete_test_results_test_period_format`, `chk_athlete_test_results_age_years_range`).
   - Menghapus 3 indeks komposit tambahan (`idx_athlete_test_results_calibration_status`, `idx_athlete_test_results_norms_recap`, `idx_athlete_test_results_tenant_test_date`).
4. **Isolasi Modul Lain:**
   - Skrip tidak menyentuh fungsi sistem bersama seperti `public.is_superadmin()`, `public.get_user_tenant_role()`, maupun tabel-tabel di luar Assessment Battery.

---

## 8. Batasan Verifikasi Lingkungan (Honest Verification Boundaries)

Sesuai dengan pedoman rekayasa perangkat lunak dan batasan integritas yang ketat:

- **Pengujian Kontrak Lokal & Integritas SQL: `PASS`**
  - Seluruh 58 assertion pengujian kontrak pada `tests/task03_4_migration_readiness.test.js` berjalan dan lulus secara konsisten melalui Node.js test runner (`npx --yes tsx --test`).
  - Pengujian ini memverifikasi struktur file SQL, tidak adanya DDL destruktif pada preflight, kompatibilitas 100% kolom payload aplikasi, validitas RLS & trigger imutabilitas, keselarasan kalibrasi, serta keamanan rollback.
- **Eksekusi Langsung ke Supabase Produksi: `NOT VERIFIED`**
  - Lingkungan AI Studio tidak memiliki kredensial superuser (`postgres`) ke database Supabase produksi dan dilarang keras mengeksekusi DDL langsung ke lingkungan target pengguna.
  - Skenario pengujian peran pada `06_post_migration_verification.sql` memerlukan hak pergantian sesi PostgreSQL (`set_config('role', 'authenticated', true)` dan `set_config('request.jwt.claims', ...)`), yang secara eksklusif hanya dapat dijalankan oleh Administrator Database melalui Supabase SQL Editor.
  - Status `NOT VERIFIED` ini dicatat secara transparan dan jujur dalam laporan ini.

---

## 9. Panduan Operasional Eksekusi untuk Administrator Database

Administrator Database Supabase disarankan mengikuti prosedur eksekusi standar berikut:

### Langkah 1: Persiapan & Backup Database (Mandatory)
Sebelum menjalankan perubahan skema, pastikan backup database telah diambil melalui Supabase Dashboard:
1. Buka Supabase Dashboard -> **Database** -> **Backups**.
2. Buat snapshot Point-in-Time Recovery (PITR) atau cadangan manual via `pg_dump`.

### Langkah 2: Eksekusi Preflight Inspection (`01_preflight_inspection.sql`)
1. Buka **SQL Editor** pada Supabase Dashboard.
2. Salin dan jalankan seluruh isi file `docs/assessment/sql/task03_4/01_preflight_inspection.sql`.
3. Verifikasi hasil output:
   - **Bagian 1 (Tabel Prasyarat):** Pastikan ke-7 tabel (`platform_superadmins`, `tenants`, `users_staff`, `academies`, `academy_classes`, `coaches`, `students`) berstatus `EXISTS`.
   - **Bagian 2 (Kolom Kunci):** Pastikan kolom-kolom kunci terpasang. *(Catatan: Fungsi Task 03.4 memakai penanganan aman `to_jsonb(...)` untuk `tenants.is_active`, `coaches.auth_uid`, dan `academy_classes.is_archived` sehingga tidak akan error jika kolom tersebut belum ada di database lama, namun sangat direkomendasikan kolom tersebut sudah ada sesuai Phase 1 Hardening).*
   - **Bagian 8 (Integritas Relasional):** Pastikan tidak ada isu relasi orphan (`issue_count = 0`).

### Langkah 3: Eksekusi Master Migration (`00_master_task03_4_assessment_battery_migration.sql`)
1. Di SQL Editor Supabase, salin isi file `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`.
2. Klik **Run**.
3. Seluruh migrasi berjalan di dalam transaksi terproteksi `BEGIN ... COMMIT`.
4. Jika terjadi kendala pada salah satu langkah, PostgreSQL akan melakukan `ROLLBACK` otomatis tanpa meninggalkan perubahan parsial.

*(Catatan: Jika kebijakan organisasi mengharuskan eksekusi modular bertahap, Administrator dapat mengeksekusi file `02`, `03`, `04`, dan `05` secara berurutan sebagai pengganti file `00`).*

### Langkah 4: Eksekusi Verifikasi Pasca-Migrasi (`06_post_migration_verification.sql`)
1. Di SQL Editor Supabase, salin dan jalankan `docs/assessment/sql/task03_4/06_post_migration_verification.sql`.
2. Amati hasil Bagian A: Pastikan tabel, kolom terindeks, 6 indeks, trigger, 4 fungsi keamanan, RLS policies, dan table privileges terdaftar lengkap di system catalog.
3. Amati hasil Bagian B: Skrip menjalankan 8 skenario pengujian peran secara otomatis di dalam blok `BEGIN ... ROLLBACK;`. Output console SQL Editor akan menampilkan pesan:
   `NOTICE: ALL 8 ROLE-BASED SECURITY & COMPATIBILITY VERIFICATION SCENARIOS PASSED (ROLLED BACK CLEANLY).`
4. Karena Bagian B diakhiri dengan `ROLLBACK;`, tidak ada data tes tiruan (*fixtures*) yang tersisa di database produksi.

### Langkah 5: Penanganan Kontingensi & Rollback (`07_rollback_plan.sql`)
Jika terjadi ketidaksesuaian operasional setelah migrasi dieksekusi:
1. Buka SQL Editor Supabase.
2. Jalankan skrip `docs/assessment/sql/task03_4/07_rollback_plan.sql`.
3. Skrip akan mencabut policy, trigger, fungsi, constraint, dan indeks Task 03.4 secara aman tanpa menghapus tabel `public.athlete_test_results` maupun data mentah hasil tes atlet.

---

## 10. Pernyataan Kesiapan Produksi (Sign-Off)

Berdasarkan hasil:
1. Rekonsiliasi 8 file SQL pada `docs/assessment/sql/task03_4/` yang lengkap, konsisten, dan bebas konflik,
2. Keselarasan 100% antara master migration (`00`) dan komponen modular (`02`–`05`),
3. Pengerasan keamanan fungsi, perlindungan anti-spoofing coach scope, dan imutabilitas audit trigger,
4. Kepatuhan integritas backfill tanpa rekayasa data atau mutasi nilai mentah,
5. Ketersediaan suite pengujian 8 peran transaksional dan rencana rollback non-destruktif,
6. Keberhasilan uji kontrak 58/58 test assertions lokal (`PASS`),

Paket SQL migrasi database Football Assessment Battery CHUVATOR dinyatakan secara resmi:

### **STATUS: `READY FOR ADMIN EXECUTION`**

Paket SQL ini siap diserahkan kepada Administrator Database Supabase untuk dieksekusi sesuai jadwal rilis operasional yang ditentukan.
