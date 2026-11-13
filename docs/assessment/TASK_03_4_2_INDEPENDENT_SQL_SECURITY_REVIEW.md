# CHUVATOR — TASK 03.4.2: INDEPENDENT SQL SECURITY & PRODUCTION SAFETY REVIEW

**Tanggal Pemeriksaan:** 2026-11-12  
**Objek Pemeriksaan:** Paket Migrasi SQL `docs/assessment/sql/task03_4/` (8 File)  
**Target Database:** Supabase PostgreSQL CHUVATOR (`public.athlete_test_results`)  
**Metode Audit:** Inspeksi Kode Statis Independen Baris-demi-Baris (Zero Trust terhadap klaim laporan sebelumnya)  
**Status Eksekusi Production:** `NOT VERIFIED` (Tidak ada DDL/DML yang dijalankan ke Supabase production)  
**Keputusan Akhir:** **`NOT READY — CORRECTIONS REQUIRED`**

---

## 1. Ringkasan Eksekutif

Pemeriksaan independen telah dilakukan terhadap seluruh 8 file SQL pada `docs/assessment/sql/task03_4/` tanpa mengubah satu pun file dalam paket migrasi dan tanpa mempercayai klaim kelulusan dari laporan sebelumnya (`TASK_03_4_SUPABASE_MIGRATION_READINESS_REPORT.md` maupun unit test regex lokal).

Meskipun struktur dasar tabel, transaksi atomik pada master script (`00_master_task03_4_assessment_battery_migration.sql`), dan mekanisme non-destruktif pada rollback telah dirancang dengan baik, audit menemukan **11 temuan nyata (4 High/Critical Security & Access Control Flaws, 4 Medium Data Integrity & Operational Risks, dan 3 Verification Suite Deficiencies)** yang membuktikan bahwa beberapa klaim keamanan pada laporan sebelumnya belum terpenuhi secara aktual di dalam kode SQL:

1. **[CRITICAL — `FAILED`] Celah Fail-Open pada `coach_can_manage_student()` untuk Pelatih Tanpa Profil `coaches` atau Tanpa Kelas Aktif:**
   - Pada `00_master` baris 351–353 (`03_security` baris 211–213), jika akun ber-role `coach` di `users_staff` belum memiliki baris tertaut di `public.coaches` (`v_coach_id IS NULL`), fungsi mengembalikan **`RETURN TRUE`** (fail-open).
   - Pada `00_master` baris 368–401 (`03_security` baris 230–265), jika pelatih memiliki profil di `public.coaches` tetapi **tidak memiliki kelas aktif yang ditugaskan** (`v_has_assigned_classes = FALSE`, misalnya pelatih baru atau semua kelasnya diarsipkan), blok pemeriksaan kelas dilewati seluruhnya dan fungsi mengembalikan **`RETURN TRUE`**. Akibatnya, pelatih tanpa kelas aktif justru memperoleh hak tulis (`INSERT`/`UPDATE`/`DELETE`) ke **seluruh atlet di seluruh kelas milik pelatih lain** dalam tenant tersebut.
2. **[HIGH — `FAILED`] Kebocoran Akses Baca (`SELECT`) Lintas-Kelas dan Lintas-Akademi untuk Role `coach`:**
   - Laporan sebelumnya mengklaim bahwa *Coach (Di Luar Cakupan)* berstatus `DENIED (0 row)` pada `SELECT`. Faktanya, `athlete_test_results_select_policy` pada `00_master` baris 573–580 (`04_rls` baris 22–29) **tidak memanggil `coach_can_manage_student()`**, melainkan hanya memeriksa `get_strict_tenant_member_role(tenant_id) IN ('owner', 'admin', 'coach', 'staff', 'kasir')` dan `athlete_belongs_to_tenant(...)`. Pelatih di Kelas A1 dapat membaca seluruh hasil tes atlet Kelas A2 maupun akademi lain dalam tenant yang sama.
3. **[HIGH — `FAILED`] Eksposur RPC Lintas-Tenant pada `athlete_belongs_to_tenant()` (`SECURITY DEFINER` Oracle):**
   - Fungsi `public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID)` (`00_master` baris 250–304, `03_security` baris 105–159) berstatus `SECURITY DEFINER` dan diberi `GRANT EXECUTE ... TO authenticated` (`00_master` baris 513). Karena berada di schema `public`, Supabase PostgREST mengeksposnya sebagai endpoint `/rest/v1/rpc/athlete_belongs_to_tenant`. Fungsi ini **tidak memeriksa `auth.uid()` maupun keanggotaan tenant pemanggil**, sehingga user terautentikasi dari Tenant A (atau bahkan user outsider tanpa tenant) dapat memanggil RPC tersebut secara langsung untuk mengenumerasi apakah `student_id`, `class_id`, atau `academy_id` tertentu milik Tenant B.
4. **[HIGH — `FAILED`] Tidak Ada Validasi Kepemilikan Tenant pada Kolom `coach_id` Lintas-Tenant:**
   - Tabel `public.athlete_test_results` memiliki kolom `coach_id UUID NULL REFERENCES public.coaches(id)` (`00_master` baris 60). Baik `athlete_belongs_to_tenant()` maupun trigger `validate_and_protect_athlete_test_results()` (`00_master` baris 442) chỉ memvalidasi `student_id`, `class_id`, dan `academy_id`, tetapi **sama sekali tidak memeriksa apakah `NEW.coach_id` milik `NEW.tenant_id`**. User di Tenant A dapat menyisipkan `coach_id` milik Tenant B.
5. **[MEDIUM — `FAILED`] Jendela Eksposur Tabel Tanpa RLS Jika Modul `02`–`05` Dieksekusi Bertahap:**
   - File komponen `02_core_table_and_indexes.sql` membuat tabel `public.athlete_test_results` tanpa `ENABLE ROW LEVEL SECURITY` dan tanpa `REVOKE ALL FROM PUBLIC, anon`. Pengaktifan RLS baru dilakukan di `04_rls_policies_and_grants.sql`. Selain itu, file `02`, `03`, `04`, dan `05` tidak dibungkus `BEGIN ... COMMIT`. Jika eksekusi bertahap berhenti setelah `02` atau gagal di `03`, tabel baru akan terbuka tanpa RLS di production.

---

## 2. Matriks Status Pemeriksaan per Area

| Area Pemeriksaan | Sub-Pemeriksaan | Status | Ringkasan Bukti Aktual |
|---|---|---|---|
| **A. Master Migration** | Kesesuaian isi `00_master` vs `02`, `03`, `04`, `05` | `PASS` | Seluruh statement DDL/DML pada `02`–`05` tercakup dengan urutan yang sama di dalam `00_master`. |
| **A. Master Migration** | Atomisitas transaksi pada `00_master` | `PASS` | Dibungkus `BEGIN;` (baris 17) dan `COMMIT;` (baris 671). Kegagalan di tengah proses membatalkan seluruh perubahan secara atomik. |
| **A. Master Migration** | Keamanan eksekusi bertahap modul `02`–`05` jika gagal di tengah jalan | `FAILED` | Modul `02`–`05` tidak memiliki `BEGIN ... COMMIT`; `02` membuat tabel tanpa langsung mengaktifkan RLS (`ENABLE/FORCE RLS` baru ada di `04`). |
| **B. SECURITY DEFINER & Permissions** | Inventarisasi & `search_path` eksplisit | `PASS` | Ke-4 fungsi menetapkan `SET search_path = public, extensions, pg_temp`. |
| **B. SECURITY DEFINER & Permissions** | Proteksi fungsi internal trigger dari pemanggilan langsung | `PASS` | `REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;` (`00_master` baris 510). |
| **B. SECURITY DEFINER & Permissions** | Pencegahan kebocoran lintas-tenant via fungsi `SECURITY DEFINER` yang dapat dipanggil `authenticated` | `FAILED` | `athlete_belongs_to_tenant()` diberi `GRANT EXECUTE TO authenticated` (`00_master` baris 513) tanpa memvalidasi bahwa `auth.uid()` adalah anggota `check_tenant_id`. |
| **B. SECURITY DEFINER & Permissions** | Eksplisitasi kepemilikan (`OWNER TO`) fungsi `SECURITY DEFINER` | `FAILED` | Tidak ada pernyataan `ALTER FUNCTION ... OWNER TO postgres;` dan tidak ada pemeriksaan preflight atas RLS tabel prasyarat jika dijalankan oleh non-superuser. |
| **C. RLS & Multi-Tenant** | Isolasi Owner Tenant & Admin Tenant | `PASS` (Statis) / `NOT VERIFIED` (Prod) | `get_strict_tenant_member_role()` memverifikasi `tenants.owner_uid` dan `users_staff` aktif, serta menolak akses lintas-tenant. |
| **C. RLS & Multi-Tenant** | Coach dalam kelas yang diizinkan vs Coach di luar kelas | `FAILED` | 1) `SELECT` policy tidak memanggil `coach_can_manage_student()`. 2) `coach_can_manage_student()` fail-open (`RETURN TRUE`) saat `v_coach_id IS NULL` atau `v_has_assigned_classes = FALSE`. |
| **C. RLS & Multi-Tenant** | Cashier (`kasir`) & Staff (`staff`) Read-Only | `PASS` (Statis) / `NOT VERIFIED` (Prod) | Hanya diizinkan pada `SELECT` policy; ditolak pada `INSERT`, `UPDATE`, dan `DELETE` policy. |
| **C. RLS & Multi-Tenant** | Pemblokiran Superadmin / Platform Owner | `PASS` (Statis) / `NOT VERIFIED` (Prod) | Diblokir melalui `platform_superadmins` (`00_master` baris 199–204) dan `public.is_superadmin()` (baris 206–211). |
| **C. RLS & Multi-Tenant** | Non-member, Tenant Inactive, & Spoofing Identitas | `FAILED` | Spoofing `coach_id` lintas-tenant tidak dicegah; mutasi `recorded_by_user_id` saat `OLD.recorded_by_user_id IS NULL` dan mutasi `recorded_by_name` saat `UPDATE` tidak diblokir. |
| **C. RLS & Multi-Tenant** | Kelengkapan & keakuratan skrip `06_post_migration_verification.sql` | `FAILED` | Tidak menguji `SELECT`/`UPDATE`/`DELETE` Coach lintas-kelas, tidak menguji tenant inactive, tidak menguji role `anon`, dan fixture `INSERT` bergantung pada kolom yang tidak diperiksa di preflight. |
| **D. Data Integrity & Backfill** | Imutabilitas `id`, `tenant_id`, `student_id`, `created_at`, `test_id`, `indicator_id` | `PASS` | Dikunci pada trigger `BEFORE UPDATE` (`00_master` baris 418–438). |
| **D. Data Integrity & Backfill** | Proteksi kolom audit (`updated_at`, `recorded_by_user_id`, `recorded_by_name`) & sinkronisasi saat `UPDATE` | `FAILED` | Backfill memicu trigger `BEFORE UPDATE` yang menimpa `updated_at := NOW()` pada seluruh data historis; `recorded_by_name` tidak dikunci; kolom konteks tidak disinkronkan ulang saat `derived_metrics` di-update. |
| **D. Data Integrity & Backfill** | Keamanan `final_raw_value`, `trials`, dan `converted_score` saat backfill | `PASS` | Backfill (`00_master` baris 517–561) sama sekali tidak menyentuh `final_raw_value`, `trials`, maupun `converted_score`. |
| **D. Data Integrity & Backfill** | Ketahanan terhadap data legacy tidak valid | `FAILED` | Input whitespace `'   '` pada `measurement_method` lolos ke constraint `chk_athlete_test_results_spr10m_method` dan memicu error `23514`; `01_preflight_inspection.sql` tidak memeriksa baris eksisting yang melanggar constraint baru. |
| **E. Compatibility & Rollback** | Kompatibilitas terhadap schema CHUVATOR eksisting & `01_preflight_inspection.sql` | `FAILED` | Bagian 8 `01_preflight_inspection.sql` (baris 167–177) langsung melakukan `SELECT` pada tabel prasyarat sehingga akan error `42P01` jika tabel belum ada; tidak memeriksa data eksisting `athlete_test_results`. |
| **E. Compatibility & Rollback** | Sifat fail-closed dan non-destruktif `07_rollback_plan.sql` | `PASS` | Menghapus policy dan mencabut `GRANT` dari `PUBLIC, anon, authenticated` dalam transaksi `BEGIN ... COMMIT` tanpa `DROP TABLE` dan tanpa menghapus baris data. |

---

## 3. Uraian Detail Pemeriksaan per Bagian (A – E)

### A. MASTER MIGRATION (`00_master_task03_4_assessment_battery_migration.sql`)

1. **Pencocokan Isi Master dengan File Komponen (`PASS`):**
   - Blok `[1]` (`00_master` baris 24–49) dan `[2]` (`00_master` baris 54–174) identik secara fungsional dan urutan statement dengan `02_core_table_and_indexes.sql` (baris 13–166).
   - Blok `[3]` (`00_master` baris 179–561) identik secara fungsional dan urutan statement dengan `03_security_functions_and_triggers.sql` (baris 29–430).
   - Blok `[4]` (`00_master` baris 566–618) identik dengan `04_rls_policies_and_grants.sql` (baris 13–67).
   - Blok `[5]` (`00_master` baris 623–669) identik dengan `05_calibration_compatibility.sql` (baris 18–64).
   - Tidak ditemukan statement yang hilang, berubah urutan, atau terduplikasi di dalam `00_master`.

2. **Ketergantungan Antarobjek & Konsekuensi Kegagalan Transaksi:**
   - Pada `00_master_task03_4_assessment_battery_migration.sql`, seluruh operasi dibungkus dalam satu transaksi `BEGIN;` (baris 17) hingga `COMMIT;` (baris 671). Apabila terjadi kegagalan pada langkah mana pun (misalnya preflight gate gagal di baris 45 atau validasi kalibrasi gagal di baris 644), PostgreSQL membatalkan seluruh DDL dan DML secara utuh (*all-or-nothing*).
   - **Temuan Masalah (`FAILED` — Eksekusi Komponen Terpisah):** File komponen `02_core_table_and_indexes.sql`, `03_security_functions_and_triggers.sql`, `04_rls_policies_and_grants.sql`, dan `05_calibration_compatibility.sql` tidak memiliki `BEGIN ... COMMIT`. Lebih berbahaya lagi, `02_core_table_and_indexes.sql` membuat tabel `public.athlete_test_results` (baris 44) tanpa mengaktifkan RLS dan tanpa mencabut default privileges dari `anon`/`PUBLIC`. Jika Administrator menjalankan skrip secara bertahap (Opsi B pada laporan kesiapan sebelumnya) dan eksekusi berhenti setelah `02` atau gagal saat backfill di `03`, tabel `public.athlete_test_results` akan tertinggal dalam kondisi **RLS mati (`rowsecurity = false`)** di database production.

---

### B. SECURITY DEFINER DAN PERMISSIONS

#### Inventarisasi Fungsi `SECURITY DEFINER`

| Nama Fungsi & Signature | Lokasi (`00_master` / `03_security`) | `search_path` | `REVOKE` | `GRANT EXECUTE` | Dipanggil Oleh |
|---|---|---|---|---|---|
| `public.get_strict_tenant_member_role(check_tenant_id TEXT)` | Baris 179–248 / Baris 29–102 | `public, extensions, pg_temp` | `PUBLIC, anon` | `authenticated` | RLS Policies & `coach_can_manage_student` |
| `public.athlete_belongs_to_tenant(check_student_id UUID, check_tenant_id TEXT, check_class_id UUID, check_academy_id UUID)` | Baris 250–304 / Baris 105–159 | `public, extensions, pg_temp` | `PUBLIC, anon` | `authenticated` | RLS Policies, `coach_can_manage_student`, & Trigger |
| `public.coach_can_manage_student(check_tenant_id TEXT, check_student_id UUID, check_class_id UUID)` | Baris 306–403 / Baris 162–267 | `public, extensions, pg_temp` | `PUBLIC, anon` | `authenticated` | RLS Policies (`INSERT`, `UPDATE`, `DELETE`) |
| `public.validate_and_protect_athlete_test_results()` | Baris 405–497 / Baris 270–365 | `public, extensions, pg_temp` | `PUBLIC, anon, authenticated` | *(Tidak ada — internal trigger)* | Trigger `trg_validate_and_protect_athlete_test_results` |

#### Evaluasi Keamanan `SECURITY DEFINER`:
- **Fungsi Internal Trigger (`PASS`):** `validate_and_protect_athlete_test_results()` telah dicabut hak eksekusinya dari `PUBLIC, anon, authenticated` (`00_master` baris 510, `03_security` baris 379), sehingga tidak dapat dipanggil langsung oleh klien.
- **Risiko Privilege Escalation & Cross-Tenant Information Disclosure via PostgREST RPC (`FAILED`):**
  - Pada Supabase, setiap fungsi di schema `public` yang memiliki `GRANT EXECUTE TO authenticated` secara otomatis dapat dipanggil oleh klien manapun yang login melalui HTTP POST `/rest/v1/rpc/<function_name>`.
  - Fungsi `public.athlete_belongs_to_tenant()` berjalan sebagai `SECURITY DEFINER` (mem-bypass RLS pada `public.students`, `public.academy_classes`, dan `public.academies`), namun **tidak memvalidasi apakah `auth.uid()` memiliki hak akses pada `check_tenant_id`** (`00_master` baris 263–303).
  - Akibatnya, pengguna dari Tenant A (atau akun terautentikasi tanpa tenant sekalipun) dapat memanggil `rpc('athlete_belongs_to_tenant', ...)` untuk menguji apakah suatu UUID siswa, kelas, atau akademi terdaftar pada Tenant B.
- **Kepemilikan Fungsi (`OWNER`) (`FAILED`):**
  - Tidak ada deklarasi eksplisit `ALTER FUNCTION ... OWNER TO postgres;` pada `00_master` maupun `03_security_functions_and_triggers.sql`. Jika migrasi dijalankan oleh role admin yang tidak memiliki atribut `BYPASSRLS`, kueri di dalam fungsi `SECURITY DEFINER` terhadap `platform_superadmins`, `tenants`, `users_staff`, `coaches`, `academy_classes`, dan `students` dapat terblokir oleh RLS tabel-tabel tersebut.

---

### C. RLS DAN MULTI-TENANT

Pemeriksaan aktual terhadap keempat policy RLS pada `04_rls_policies_and_grants.sql` (baris 21–67) dan `00_master` (baris 572–618) beserta fungsi pendukungnya menghasilkan evaluasi per peran sebagai berikut:

1. **Owner Tenant (`PASS` secara statis / `NOT VERIFIED` di production):**
   - Diverifikasi melalui `public.tenants` dengan syarat `(t.tenant_id::text = trim(check_tenant_id) OR t.id::text = trim(check_tenant_id)) AND t.owner_uid::text = v_caller_uid` serta status tenant aktif (`00_master` baris 213–221).
   - Memiliki akses `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` hanya untuk baris yang memenuhi `athlete_belongs_to_tenant(student_id, tenant_id, class_id, academy_id)`.
2. **Admin Tenant (`PASS` secara statis / `NOT VERIFIED` di production):**
   - Diverifikasi melalui `public.users_staff` dengan `role IN ('admin', 'administrator')`, `is_active = TRUE`, `status IN ('active', 'aktif')`, dan tenant aktif (`00_master` baris 223–238).
   - Memiliki akses penuh (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) di dalam batas tenant-nya.
3. **Coach dalam Kelas yang Diizinkan (`PASS` secara statis / `NOT VERIFIED` di production):**
   - Jika profil pelatih ada di `public.coaches` (`auth_uid = auth.uid()`) dan ditugaskan sebagai `coach_id` pada kelas siswa (`academy_classes.coach_id = v_coach_id`), pelatih dapat melakukan `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` pada siswa di kelasnya.
4. **Coach di Luar Kelas (`FAILED`):**
   - **Masalah 1 (`SELECT` Lintas-Kelas & Lintas-Akademi Terbuka):** `athlete_test_results_select_policy` (`00_master` baris 573–580, `04_rls` baris 22–29) **tidak memanggil `coach_can_manage_student()`**. Pelatih Kelas A1 dapat melakukan `SELECT` terhadap seluruh data hasil tes siswa Kelas A2 maupun siswa dari `academy_id` berbeda di dalam tenant yang sama. Ini bertentangan langsung dengan matriks klaim pada laporan Task 03.4.1.
   - **Masalah 2 (Fail-Open saat `v_coach_id IS NULL`):** Pada `coach_can_manage_student()` (`00_master` baris 351–353, `03_security` baris 211–213), jika pelatih di `users_staff` belum ditautkan ke baris `public.coaches` melalui `auth_uid`, fungsi mengeksekusi `IF v_coach_id IS NULL THEN RETURN TRUE; END IF;`. Pelatih tersebut langsung lolos melakukan `INSERT`, `UPDATE`, dan `DELETE` ke seluruh kelas di tenant tersebut.
   - **Masalah 3 (Fail-Open saat `v_has_assigned_classes = FALSE`):** Pada `coach_can_manage_student()` (`00_master` baris 368–401, `03_security` baris 230–265), jika pelatih memiliki baris di `public.coaches` tetapi belum ditugaskan ke kelas mana pun (atau seluruh kelasnya berstatus `is_archived = TRUE`), variabel `v_has_assigned_classes` bernilai `FALSE`. Karena blok validasi kelas dibungkus `IF v_has_assigned_classes THEN ... END IF;`, fungsi melewati seluruh pengecekan kelas dan langsung mengeksekusi `RETURN TRUE;` di baris 401 (`00_master`). Pelatih yang tidak memegang kelas justru bisa mengubah/menghapus hasil tes atlet milik pelatih lain.
   - **Masalah 4 (Kelas Arsip pada Pengecekan Kelas Siswa):** Pada `00_master` baris 380–397 (`03_security` baris 243–261), kueri yang memeriksa kecocokan `v_student_class_id` dan `check_class_id` tidak menyertakan filter `AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE`. Jika seorang pelatih memiliki 1 kelas aktif (Kelas A1) dan 1 kelas yang sudah diarsipkan (Kelas A0), pelatih tersebut masih diizinkan memodifikasi data pada Kelas A0 yang sudah diarsipkan.
   - **Masalah 5 (Ketidaksesuaian `check_class_id` vs `v_student_class_id`):** Pada `00_master` baris 389–398 (`03_security` baris 253–262), jika seorang pelatih mengajar dua kelas (`Kelas A1` dan `Kelas A2`), pelatih tersebut diizinkan menyisipkan hasil tes untuk siswa `Kelas A1` dengan mencantumkan `class_id = Kelas A2` (tidak memaksa `check_class_id = v_student_class_id`).
5. **Cashier (`kasir`) & Staff (`staff`) (`PASS` secara statis / `NOT VERIFIED` di production):**
   - `get_strict_tenant_member_role()` mengembalikan `'kasir'` atau `'staff'`.
   - Keduanya diizinkan pada `athlete_test_results_select_policy` (`00_master` baris 578), tetapi ditolak pada `INSERT`, `UPDATE`, dan `DELETE` karena ketiga policy mutasi mensyaratkan `IN ('owner', 'admin', 'coach')` serta `coach_can_manage_student(...)`.
6. **Superadmin / Platform Owner (`PASS` secara statis / `NOT VERIFIED` di production):**
   - `get_strict_tenant_member_role()` memeriksa tabel `public.platform_superadmins` (`00_master` baris 199–204) dan fungsi `public.is_superadmin()` (baris 206–211) terlebih dahulu sebelum memeriksa `tenants` atau `users_staff`. Jika terdeteksi sebagai superadmin, fungsi langsung mengembalikan `NULL`, sehingga seluruh operasi `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` ditolak (inclusi jika superadmin tersebut kebetulan terdaftar di `users_staff`).
7. **Pengguna Non-Member, Tenant Inactive, dan Spoofing Identitas (`FAILED`):**
   - **Non-Member & Tenant Inactive (`PASS` secara statis):** Ditolak karena `get_strict_tenant_member_role()` memvalidasi `COALESCE((to_jsonb(t)->>'is_active')::boolean, TRUE) = TRUE` dan `LOWER(COALESCE(t.status, 'active')) IN ('active', 'aktif')` baik untuk Owner (baris 217–218) maupun Staff (baris 232–233).
   - **Spoofing `coach_id` Lintas-Tenant (`FAILED`):** Tidak ada validasi bahwa `NEW.coach_id` pada `athlete_test_results` berasal dari `NEW.tenant_id`.
   - **Spoofing `recorded_by_user_id` & `recorded_by_name` (`FAILED`):** Pada `UPDATE` (`00_master` baris 430), kondisi `IF OLD.recorded_by_user_id IS NOT NULL AND NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id` mengizinkan pengubahan `recorded_by_user_id` menjadi UUID sembarang apabila nilai awalnya `NULL`. Selain itu, kolom `recorded_by_name` dapat diubah bebas saat `UPDATE` oleh pengguna lain tanpa terkunci pada pencatat awal.
8. **Pemisahan Katalog Policy vs Simulasi Role vs Konteks Autentikasi Production (`FAILED` pada kelengkapan skrip `06` / `NOT VERIFIED` di production):**
   - Skrip `06_post_migration_verification.sql` memisahkan Bagian A (pemeriksaan katalog `pg_tables`, `pg_policies`, `pg_proc`) dan Bagian B (simulasi role menggunakan `set_config('role', 'authenticated', true)` dan `set_config('request.jwt.claims', ...)`).
   - Namun, Bagian B memiliki celah pengujian:
     - Test 4 (baris 291–309) hanya menguji `INSERT` oleh Coach di luar kelas, dan **tidak menguji `SELECT`, `UPDATE`, maupun `DELETE`** terhadap baris milik kelas lain.
     - Test 1 (baris 218–245) tidak menguji `UPDATE` dan `DELETE` oleh Owner meskipun komentarnya menyebutkan `(INSERT, SELECT, UPDATE, DELETE)`.
     - Test 3 (baris 267–289) tidak menguji `UPDATE` dan `DELETE` oleh Coach dalam cakupan kelas.
     - Test 5 (baris 312–335) tidak menguji `UPDATE` dan `DELETE` oleh Kasir.
     - Test 6 (baris 337–352) tidak menguji `INSERT` dan `UPDATE` oleh Staff.
     - Test 8 (baris 380–416) tidak menguji skenario **tenant inactive** dan tidak menguji role **`anon`**.
     - Baris 162–188 menyisipkan fixture ke kolom `platform_superadmins.notes`, `tenants.name`, `tenants.owner_email`, `academies.academy_name`, `academies.sport`, dan `coaches.auth_uid` secara langsung. Jika dijalankan pada schema lama di mana `coaches.auth_uid` atau `platform_superadmins.notes` belum ada, skrip verifikasi akan gagal dengan error kolom tidak ditemukan (`42703`).

---

### D. DATA INTEGRITY DAN BACKFILL

1. **Proteksi `tenant_id` dan `student_id` (`PASS`):**
   - Pada `INSERT`, RLS (`WITH CHECK`) dan trigger (`00_master` baris 442) memvalidasi bahwa `student_id` benar-benar milik `tenant_id`.
   - Pada `UPDATE`, trigger (`00_master` baris 421–426) memblokir segala bentuk perubahan pada `tenant_id` maupun `student_id` dengan `SQLSTATE 42501`.
2. **Validitas Relasi `class_id` dan `academy_id` terhadap Siswa (`FAILED`):**
   - Di dalam `athlete_belongs_to_tenant()` (`00_master` baris 268–300, `03_security` baris 123–155), meskipun fungsi mengambil `s.class_id` dan `s.academy_id` dari `public.students` ke dalam `v_student_record`, fungsi tersebut **hanya memeriksa apakah `check_class_id` dan `check_academy_id` milik `check_tenant_id`**, tetapi tidak memeriksa apakah `check_academy_id` konsisten dengan `v_student_record.academy_id` atau apakah `check_class_id` berada di dalam `check_academy_id`.
3. **Proteksi Identitas Pencatat dan Kolom Audit (`FAILED`):**
   - Trigger `trg_validate_and_protect_athlete_test_results` dibuat pada `00_master` baris 502 (`03_security` baris 370) **sebelum** statement `UPDATE public.athlete_test_results` untuk backfill dijalankan pada baris 517 (`03_security` baris 386).
   - Karena trigger memiliki pernyataan `IF TG_OP = 'UPDATE' THEN ... NEW.updated_at := NOW(); END IF;` (`00_master` baris 439), eksekusi backfill saat migrasi akan **menimpa kolom audit `updated_at` pada seluruh baris historis** menjadi waktu migrasi dieksekusi.
   - Selain itu, seperti dicatat pada Bagian C.7, mutasi `recorded_by_user_id` dari `NULL` ke UUID palsu serta mutasi `recorded_by_name` pada `UPDATE` belum dicegah.
4. **Keamanan Raw Measurement (`final_raw_value`), `trials`, dan `converted_score` saat Backfill (`PASS`):**
   - Statement `UPDATE` backfill (`00_master` baris 517–561, `03_security` baris 386–430) hanya mengubah `test_period`, `measurement_method`, `age_group`, dan `age_years_at_test`.
   - `final_raw_value`, `trials`, `auxiliary_inputs`, `derived_metrics`, `calibration_status`, dan `converted_score` **tidak pernah disentuh atau diubah** oleh proses backfill.
   - Constraint `chk_athlete_test_results_calibration_consistency` (`00_master` baris 655–667, `05_calibration` baris 50–62) secara ketat menjamin bahwa `converted_score` wajib `NULL` selama `calibration_status` bernilai `'PENDING_CALIBRATION'`, `'READY_FOR_CALIBRATION'`, atau `'NEEDS_FURTHER_DESIGN'`, dan hanya boleh berisi angka `1..100` jika `calibration_status = 'CALIBRATED'`.
5. **Penanganan Data Legacy & Sinkronisasi Kolom Konteks (`FAILED`):**
   - **Masalah Whitespace pada `measurement_method` (`00_master` baris 457–474, `03_security` baris 325–342):** Jika `NEW.measurement_method` berisi string spasi (`'   '`) dan JSONB tidak memuat `measurementMethod`, kondisi `IF NEW.measurement_method IS NULL OR trim(NEW.measurement_method) = ''` terpenuhi, namun karena `v_ctx_method IS NULL`, nilai `NEW.measurement_method` tidak di-reset menjadi `NULL` dan tetap berupa `'   '`. Untuk `TST-SPR-10M`, nilai `'   '` ini akan melanggar constraint `chk_athlete_test_results_spr10m_method` (`23514`). Hal serupa terjadi pada `NEW.age_group` (baris 477–482).
   - **Kolom Konteks Tidak Tersinkronisasi Ulang pada `UPDATE` (`00_master` baris 457–493, `03_security` baris 325–361):** Trigger hanya mengekstrak `measurement_method`, `age_group`, dan `age_years_at_test` dari `derived_metrics` apabila kolom top-level tersebut masih `NULL` atau kosong. Karena aplikasi (`assessmentBatteryService.js`) mengirim perubahan konteks di dalam `derived_metrics` JSONB tanpa menyertakan kolom top-level baru pada payload `UPDATE`, saat sebuah baris di-update (misalnya koreksi `measurementMethod` dari `STOPWATCH_MANUAL` ke `SMARTPHONE_VIDEO`), `NEW.measurement_method` masih menyimpan nilai `OLD.measurement_method` (tidak `NULL`), sehingga perubahan di `derived_metrics` diabaikan oleh trigger dan kolom terindeks menjadi tidak sinkron dengan JSONB.
   - **Urutan Evaluasi Regex dan Cast Integer pada Backfill (`00_master` baris 548–550, `03_security` baris 417–419):** Klausa `WHEN (derived_metrics->'athleteTestContext'->>'ageYearsAtTest') ~ '^\d{1,2}$' AND (derived_metrics->'athleteTestContext'->>'ageYearsAtTest')::integer BETWEEN 3 AND 65` menggabungkan validasi regex dan casting `::integer` dalam satu klausa `AND`. Di PostgreSQL, urutan evaluasi boolean di dalam `AND` tidak dijamin *short-circuit* oleh planner. Sebaiknya dipisahkan menggunakan nested `CASE WHEN ... ~ '^\d{1,2}$' THEN CASE WHEN ...::integer BETWEEN 3 AND 65 THEN ...` agar bebas dari risiko error `22P02 invalid input syntax for type integer` pada data legacy yang kotor.

---

### E. COMPATIBILITY DAN ROLLBACK

1. **Potensi Konflik dengan Schema & Objek CHUVATOR Eksisting:**
   - **Objek Bersama Tetap Aman (`PASS`):** Paket migrasi tidak menghapus atau mengubah tabel inti (`tenants`, `users_staff`, `academies`, `academy_classes`, `coaches`, `students`, `platform_superadmins`) maupun fungsi sistem bersama (`public.is_superadmin()`, `public.get_user_tenant_role()`).
   - **Kelemahan `01_preflight_inspection.sql` (`FAILED`):**
     1. Pada Bagian 8 (`01_preflight_inspection.sql` baris 167–177), kueri langsung menjalankan `SELECT ... FROM public.students`, `public.academy_classes`, `public.coaches`, dan `public.tenants`. Jika salah satu tabel tersebut belum ada di database target, eksekusi `01_preflight_inspection.sql` akan berhenti dengan error `42P01` alih-alih melaporkan status secara bersih.
     2. Apabila tabel `public.athlete_test_results` sudah pernah dibuat sebelumnya (dari Task 03), `01_preflight_inspection.sql` **sama sekali tidak memiliki kueri** untuk memeriksa apakah terdapat baris eksisting yang melanggar constraint baru (`chk_athlete_test_results_calibration_consistency`, `chk_athlete_test_results_spr10m_method`, `chk_athlete_test_results_age_years_range`, `chk_athlete_test_results_test_period_format`) atau baris yang gagal relasi `athlete_belongs_to_tenant()`.
2. **Keamanan Rollback (`07_rollback_plan.sql`) (`PASS` dengan Catatan Operasional):**
   - File `07_rollback_plan.sql` berjalan di dalam transaksi `BEGIN; ... COMMIT;` (baris 16–65).
   - **Benar-benar Fail-Closed:** Menghapus keempat policy RLS (baris 19–22) dan langsung mencabut seluruh hak tabel dari `PUBLIC, anon, authenticated` (`REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon, authenticated;` pada baris 25), terwijl `ENABLE/FORCE ROW LEVEL SECURITY` dari migrasi tetap aktif sehingga tidak ada satu pun akses klien yang bocor pasca-rollback.
   - **Tidak Menghilangkan Riwayat Pengukuran:** Tidak ada `DROP TABLE`, `TRUNCATE`, `DELETE`, maupun `DROP COLUMN`. Seluruh baris data hasil tes atlet dan ke-4 kolom konteks tetap utuh.
   - *Catatan Operasional:* Jika database sebelumnya telah menjalankan Task 03 (`phase_task03_athlete_test_battery_migration.sql`), menjalankan `07_rollback_plan.sql` akan menonaktifkan akses ke `athlete_test_results` sepenuhnya (karena fungsi dan policy Task 03 memiliki nama yang sama dan ikut di-drop pada baris 19–34), bukan mengembalikan policy versi Task 03.

---

## 4. Daftar Temuan & Rekomendasi Koreksi Wajib (Untuk Tahap Berikutnya)

Berikut adalah daftar terperinci seluruh temuan yang harus diperbaiki sebelum paket SQL dapat dinyatakan siap dieksekusi oleh Administrator:

### Temuan #1 — [CRITICAL] Fail-Open pada `coach_can_manage_student()` saat `v_coach_id IS NULL` atau `v_has_assigned_classes = FALSE`
- **File & Baris:**
  - `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`: baris **351–353** dan baris **368–401**
  - `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql`: baris **211–213** dan baris **230–265**
- **Risiko:** Pelatih yang belum memiliki record tertaut di `public.coaches` (`v_coach_id IS NULL`) atau pelatih yang tidak memiliki kelas aktif yang ditugaskan (`v_has_assigned_classes = FALSE`) mendapatkan hasil evaluasi `RETURN TRUE`. Hal ini memberikan hak `INSERT`, `UPDATE`, dan `DELETE` atas seluruh siswa milik pelatih lain di dalam tenant tersebut (privilege escalation).
- **Rekomendasi Koreksi:**
  - Ubah prinsip otorisasi pelatih menjadi **fail-closed**:
    1. Jika `v_coach_id IS NULL`, kembalikan `RETURN FALSE;` (kecuali jika tidak ada satu pun baris pada `public.coaches` atau `public.academy_classes` di tenant tersebut? Tidak — untuk keamanan produksi, pelatih wajib tertaut ke profil `public.coaches` dan kelas/akademi yang sah, atau minimal jika tenant memiliki kelas ber-pelatih di `academy_classes`, pelatih tanpa kelas aktif wajib `RETURN FALSE`).
    2. Hapus cabang yang meloloskan pelatih ketika `v_has_assigned_classes = FALSE`, sehingga setiap role `coach` wajib memiliki penugasan kelas aktif (`cls.coach_id = v_coach_id AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE`) yang cocok dengan `v_student_class_id`.
    3. Tambahkan filter `AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE` pada kueri verifikasi `v_student_class_id` (baris 380–387) dan pastikan `check_class_id` (jika tidak `NULL`) wajib sama dengan `v_student_class_id`.

### Temuan #2 — [HIGH] Policy `SELECT` Tidak Membatasi Cakupan Kelas/Akademi untuk Role `coach`
- **File & Baris:**
  - `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`: baris **573–580**
  - `docs/assessment/sql/task03_4/04_rls_policies_and_grants.sql`: baris **22–29**
- **Risiko:** Role `coach` dapat membaca (`SELECT`) seluruh hasil tes atlet dari kelas atau akademi lain di dalam tenant yang sama, bertentangan dengan spesifikasi bahwa Coach di luar kelas harus ditolak (`0` baris).
- **Rekomendasi Koreksi:**
  - Perbarui `athlete_test_results_select_policy` agar untuk role `'coach'`, akses baca juga wajib memenuhi `public.coach_can_manage_student(tenant_id::text, student_id, class_id)`:
    ```sql
    USING (
        (
            public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'staff', 'kasir')
            AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        )
        OR (
            public.get_strict_tenant_member_role(tenant_id::text) = 'coach'
            AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
            AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
        )
    )
    ```

### Temuan #3 — [HIGH] Eksposur RPC Lintas-Tenant pada `athlete_belongs_to_tenant()`
- **File & Baris:**
  - `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`: baris **250–304** dan baris **513**
  - `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql`: baris **105–159** dan baris **382**
- **Risiko:** Karena `athlete_belongs_to_tenant()` adalah `SECURITY DEFINER` dan diberi `GRANT EXECUTE TO authenticated`, pengguna mana pun yang login dapat memanggilnya via PostgREST RPC untuk memeriksa keberadaan dan relasi `student_id`, `class_id`, dan `academy_id` milik tenant lain.
- **Rekomendasi Koreksi:**
  - Di awal `athlete_belongs_to_tenant()`, tambahkan pemeriksaan otorisasi pemanggil apabila `auth.uid() IS NOT NULL`:
    ```sql
    IF auth.uid() IS NOT NULL AND public.get_strict_tenant_member_role(check_tenant_id) IS NULL THEN
        RETURN FALSE;
    END IF;
    ```
    *(Dengan `auth.uid() IS NOT NULL`, eksekusi internal oleh admin/migration saat `auth.uid()` kosong tetap berjalan normal, sedangkan pemanggilan oleh role `authenticated` wajib berasal dari anggota aktif `check_tenant_id`).*

### Temuan #4 — [HIGH] Tidak Ada Validasi Kepemilikan Tenant untuk `coach_id` dan Konsistensi Relasi `academy_id`/`class_id` Siswa
- **File & Baris:**
  - `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`: baris **250–304**, **442–446**, **579**, **589**, **600**, **605**, **616**
  - `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql`: baris **105–159**, **308–312**
- **Risiko:** Pengguna di Tenant A dapat menyisipkan `coach_id` milik Tenant B ke dalam baris `athlete_test_results` Tenant A, atau menyisipkan `academy_id` yang berbeda dengan `students.academy_id`.
- **Rekomendasi Koreksi:**
  - Di dalam `athlete_belongs_to_tenant()`, validasi bahwa jika `v_student_record.academy_id IS NOT NULL` dan `check_academy_id IS NOT NULL`, maka `v_student_record.academy_id = check_academy_id`.
  - Di dalam trigger `validate_and_protect_athlete_test_results()` (serta opsional di RLS / helper), jika `NEW.coach_id IS NOT NULL`, pastikan `EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = NEW.coach_id AND trim(c.tenant_id::text) = trim(NEW.tenant_id))`.

### Temuan #5 — [MEDIUM] Eksekusi Modular `02`–`05` Tidak Transaksional & Membuka Tabel Tanpa RLS Sebelum `04`
- **File & Baris:**
  - `docs/assessment/sql/task03_4/02_core_table_and_indexes.sql`: baris **44–99**
  - `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql`: baris **1–431**
  - `docs/assessment/sql/task03_4/04_rls_policies_and_grants.sql`: baris **13–18**
  - `docs/assessment/sql/task03_4/05_calibration_compatibility.sql`: baris **18–65**
- **Risiko:** Jika Administrator menjalankan file secara bertahap (`02` lalu `03` lalu `04`) dan proses terhenti sebelum `04`, tabel `public.athlete_test_results` berada dalam keadaan tanpa RLS dan dengan default grant terbuka.
- **Rekomendasi Koreksi:**
  - Tambahkan `ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;`, `ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;`, dan `REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon, authenticated;` langsung di dalam `02_core_table_and_indexes.sql` tepat setelah `CREATE TABLE IF NOT EXISTS` (sehingga tabel langsung terkunci *fail-closed* sejak detik pertama dibuat, dan baru dibuka untuk `authenticated` beserta policy-nya di `04_rls_policies_and_grants.sql`).
  - Bungkus masing-masing file `02`, `03`, `04`, dan `05` dengan `BEGIN; ... COMMIT;`.

### Temuan #6 — [MEDIUM] Backfill Menimpa `updated_at` Historis & Berisiko Gagal pada Data Legacy
- **File & Baris:**
  - `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`: baris **439**, **457–483**, **502–561**
  - `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql`: baris **304**, **325–350**, **370–430**
- **Risiko:**
  1. Karena `UPDATE` backfill dijalankan setelah trigger dibuat, baris historis yang terkena backfill akan mengalami perubahan `updated_at := NOW()`.
  2. Nilai whitespace `'   '` pada `NEW.measurement_method` atau `NEW.age_group` tidak dinormalisasi ke `NULL`, sehingga memicu pelanggaran CHECK constraint `chk_athlete_test_results_spr10m_method`.
  3. Klausa `AND` antara regex dan `::integer` pada backfill `age_years_at_test` tidak menggunakan nested `CASE`.
- **Rekomendasi Koreksi:**
  - Jalankan `UPDATE` backfill **sebelum** mengaktifkan perubahan `NEW.updated_at := NOW()`, atau di dalam trigger hanya ubah `NEW.updated_at := NOW()` jika data fungsional berubah (atau ketika bukan operasi backfill kolom konteks).
  - Normalisasi `NEW.measurement_method := NULLIF(UPPER(trim(NEW.measurement_method)), '');` dan `NEW.age_group := NULLIF(trim(NEW.age_group), '');` terlebih dahulu di awal trigger sebelum mengecek `IF NEW.measurement_method IS NULL`.
  - Gunakan nested `CASE WHEN (derived_metrics->'athleteTestContext'->>'ageYearsAtTest') ~ '^\d{1,2}$' THEN CASE WHEN (...) BETWEEN 3 AND 65 THEN ...` pada query backfill.

### Temuan #7 — [MEDIUM] Kolom Konteks Terindeks Tidak Disinkronkan Ulang Saat `UPDATE` dan Celah Kolom Pencatat (`recorded_by_*`)
- **File & Baris:**
  - `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`: baris **430–432**, **448–493**
  - `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql`: baris **295–297**, **315–361**
- **Risiko:**
  1. Saat `UPDATE`, jika `OLD.recorded_by_user_id IS NULL`, pengguna dapat menyuntikkan `recorded_by_user_id` milik orang lain; selain itu `recorded_by_name` tidak dikunci pada `UPDATE`.
  2. Saat `UPDATE` mengubah `derived_metrics` JSONB tanpa mengirim kolom top-level `measurement_method`, `age_group`, atau `age_years_at_test`, kolom terindeks tetap menyimpan nilai lama yang sudah tidak sesuai dengan `derived_metrics`.
- **Rekomendasi Koreksi:**
  - Kunci `NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id` dan `NEW.recorded_by_name IS DISTINCT FROM OLD.recorded_by_name` secara penuh pada `UPDATE`.
  - Pada `UPDATE`, jika `NEW.derived_metrics IS DISTINCT FROM OLD.derived_metrics` atau `NEW.auxiliary_inputs IS DISTINCT FROM OLD.auxiliary_inputs` sementara `NEW.measurement_method IS NOT DISTINCT FROM OLD.measurement_method`, sinkronkan ulang `measurement_method`, `age_group`, dan `age_years_at_test` dari JSONB terbaru.

### Temuan #8 — [MEDIUM] Kepemilikan (`OWNER`) Fungsi `SECURITY DEFINER` Tidak Ditetapkan Eksplisit
- **File & Baris:**
  - `docs/assessment/sql/task03_4/00_master_task03_4_assessment_battery_migration.sql`: baris **179–497**
  - `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql`: baris **29–365**
- **Risiko:** Bergantung pada role eksekutor saat migrasi dijalankan.
- **Rekomendasi Koreksi:**
  - Tambahkan `ALTER FUNCTION ... OWNER TO postgres;` pada keempat fungsi `SECURITY DEFINER`.

### Temuan #9 — [LOW/MEDIUM] Kueri `01_preflight_inspection.sql` Tidak Tahan Tabel Missing & Belum Memeriksa Data Eksisting `athlete_test_results`
- **File & Baris:**
  - `docs/assessment/sql/task03_4/01_preflight_inspection.sql`: baris **166–178**
- **Risiko:** Bagian 8 gagal dengan error `42P01` jika salah satu tabel prasyarat belum ada; außerdem admin tidak mendapat informasi apakah tabel `athlete_test_results` eksisting memiliki baris yang melanggar constraint baru sebelum menjalankan migrasi.
- **Rekomendasi Koreksi:**
  - Tambahkan pengecekan kesiapan data eksisting `athlete_test_results` (jumlah baris yang melanggar aturan kalibrasi, metode `TST-SPR-10M`, rentang `age_years_at_test`, atau relasi tenant) secara kondisional di `01_preflight_inspection.sql`.

### Temuan #10 — [MEDIUM] Cakupan Pengujian Peran pada `06_post_migration_verification.sql` Belum Lengkap & Rentan Gagal Kolom Fixture
- **File & Baris:**
  - `docs/assessment/sql/task03_4/06_post_migration_verification.sql`: baris **162–199** dan baris **218–417**
- **Risiko:**
  1. Tidak menguji `SELECT`, `UPDATE`, dan `DELETE` oleh Coach di luar cakupan kelas (sehingga celah `SELECT` lintas-kelas pada Temuan #2 tidak terdeteksi oleh skrip verifikasi).
  2. Tidak menguji skenario pelatih tanpa kelas aktif (`v_has_assigned_classes = FALSE`).
  3. Tidak menguji skenario tenant non-aktif (`status = 'inactive'` / `is_active = FALSE`).
  4. Tidak menguji akses oleh role `anon`.
  5. Tidak menguji spoofing `coach_id` lintas-tenant.
- **Rekomendasi Koreksi:**
  - Lengkapi Bagian B pada `06_post_migration_verification.sql` untuk menguji seluruh matriks `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` pada setiap peran (Owner, Admin, Coach in-class, Coach out-of-class, Coach unlinked/no-class, Kasir, Staff, Superadmin, Inactive Staff, Inactive Tenant, Outsider, `anon`, dan Cross-Tenant `student_id`/`coach_id` spoofing).

---

## 5. Keputusan Akhir

Berdasarkan temuan aktual di atas, status kesiapan paket migrasi SQL pada `docs/assessment/sql/task03_4/` adalah:

### **3. `NOT READY — CORRECTIONS REQUIRED`**

Paket SQL **tidak boleh dieksekusi ke Supabase production** sebelum ke-10 rekomendasi koreksi di atas diterapkan dan diverifikasi ulang pada tahap berikutnya.
