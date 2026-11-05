# CHUVATOR PARENT PORTAL V2 — FASE 4B-VERIFY
## FINAL IMPLEMENTATION CORRECTNESS & SECURITY AUDIT REPORT

**MODE AUDIT: STRICT READ-ONLY ANALYSIS**  
**STATUS MIGRATION PRODUCTION: PREPARED SPECIFICATION (NO UNAPPROVED DB MUTATION EXECUTED)**  
**FINAL GATE STATUS: CONDITIONAL PASS — READY AFTER SPECIFIED FIXES**

---

### A. RINGKASAN HASIL AUDIT

Audit penutupan ini dilakukan secara **Strict Read-Only** terhadap seluruh artefak implementasi **FASE 4B Manual Payment Integration** pada CHUVATOR Parent Portal V2.

#### Temuan Utama Ringkas:
1. **Keamanan RBAC Endpoint Admin (`functions/api/admin/verify_payment.js`) — [P0 CRITICAL]**:
   Endpoint Edge `/api/admin/verify_payment` membaca parameter `staffRole` dan `staffUid` dari payload JSON `request.body` yang dikirim oleh browser klien tanpa memverifikasi cookie sesi admin/staff atau token JWT server-side. Hal ini memungkinkan penyerang memanipulasi payload HTTP `{"staffRole": "admin"}` untuk melewati pemeriksaan RBAC di tingkat Edge API.
2. **Discrepancy Engine Database (Firestore REST vs Supabase PostgreSQL RPC) — [P1 HIGH]**:
   Endpoint Edge `verify_payment.js` dan `submit_proof.js` saat ini melakukan `PATCH` langsung ke Google Firestore REST API, sementara skrip migrasi resmi `06_phase4b_manual_payment_schema.sql` menetapkan RPC PostgreSQL PL/pgSQL (`admin_verify_spp_payment` dan `parent_submit_manual_payment_proof`) pada Supabase PostgreSQL (`wqnhlmvvyhpctmaukwyj.supabase.co`).
3. **Penyimpanan Bukti Transfer (Base64 Inline vs Physical Storage Bucket) — [P1 HIGH]**:
   Endpoint `upload_receipt.js` memproses gambar bukti transfer sebagai String Data URI Base64 inline. Physical Supabase Storage Bucket `payment_proofs` beserta RLS policies belum terisi/di-provision pada environment live Supabase production.
4. **Validasi File Magic Bytes — [P2 MEDIUM]**:
   `upload_receipt.js` memvalidasi tipe file berdasarkan string MIME `fileType` dan ekstensi `fileName` dari payload JSON klien, namun belum memeriksa magic bytes (file signature header).
5. **Kualitas Test Suite 22/22 & 71/71 — [VERIFIED IN-MEMORY]**:
   Pengujian `tests/portal_v2_phase4b_manual_payment.test.js` berjalan 100% lulus (22 subtest, 71 total assertion pada suite portal), namun seluruh pengujian berupa *in-memory unit assertions* menggunakan objek simulasi, bukan pengujian integrasi live ke database PostgreSQL Supabase.

---

### B. MATRIKS PEMERIKSAAN SETIAP FILE

| No | Path File | Nama Komponen / Fungsi | Status Audit | Kategori Temuan | Ringkasan Temuan & Rekomendasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `06_phase4b_manual_payment_schema.sql` | Migration DDL & PL/pgSQL RPCs | **VALID (SPEC)** | Normal | Mengatur schema `spp_payments`, RPC `admin_verify_spp_payment` (Owner/Admin only, atomic ledger journal), dan `parent_submit_manual_payment_proof`. Aman tanpa DROP destructive. |
| 2 | `functions/api/portal/upload_receipt.js` | `onRequestPost` | **CONDITIONAL** | P1 (Storage) / P2 (Magic Bytes) | Ukuran 5MB & MIME type tervalidasi. Menggunakan base64 data URI inline. Membutuhkan provisioning bucket Supabase `payment_proofs` & validasi magic bytes. |
| 3 | `functions/api/portal/submit_proof.js` | `onRequestPost` | **CONDITIONAL** | P1 (Firestore Patch vs PostgreSQL) | Memverifikasi sesi V2, CSRF token, dan relasi ortu-siswa. Mengubah status ke `unverified` (`WAITING_VERIFICATION`). Tidak mengubah tagihan menjadi LUNAS. |
| 4 | `functions/api/admin/verify_payment.js` | `onRequestPost` | **REJECTED (NEEDS FIX)** | **P0 (RBAC Security Risk)** | Mempercayai `body.staffRole` dari JSON klien tanpa verifikasi token/sesi staff server-side. Wajib diperbaiki untuk memverifikasi JWT/session token admin. |
| 5 | `src/components/AdminPaymentVerificationModal.jsx` | `AdminPaymentVerificationModal` | **VALID** | UI Component | Memvalidasi role `owner`/`admin` di UI, menampilkan nominal resmi, preview gambar bukti transfer, dan mewajibkan catatan alasan penolakan saat REJECT. |
| 6 | `src/pages/Portal/PortalDashboard.jsx` | `PortalDashboard` | **VALID** | UI Page | Menyediakan 5 tab navigasi, QRIS statis tenant, rekening bank manual, status tagihan riil read-only dari Financial Core, dan switcher multi-anak. |
| 7 | `tests/portal_v2_phase4b_manual_payment.test.js` | Test Suite 22 Scenarios | **VALID (UNIT)** | Unit/Mock | 22 scenario lulus 100%. Pengujian bersifat *in-memory unit assertion*, bukan live integration test ke PostgreSQL production. |
| 8 | `functions/api/portal/_auth_v2.js` | Auth & Rate Limit Module | **VALID** | Infrastructure | Menyediakan enkripsi AES-GCM 256-bit, validasi IP `cf-connecting-ip` (IPv4 & IPv6 RFC compliant), CSRF token verification, dan session KV handling. |
| 9 | `functions/api/portal/billing.js` | `onRequestPost` | **VALID** | Financial Core Read | Mengambil data tagihan SPP riil, QRIS statis, dan rekening bank tenant secara read-only dengan fail-closed tenant validation. |

---

### C. AUDIT MIGRATION DAN RPC (`06_phase4b_manual_payment_schema.sql`)

#### 1. Struktur Skrip Migrasi
- **Batas Operasi**: Skrip dibungkus dalam blok `BEGIN; ... COMMIT;`.
- **Modifikasi Tabel**: Hanya menambahkan 4 kolom pelacak pada `public.spp_payments` tanpa melakukan `DROP` atau perusakan struktur:
  ```sql
  ALTER TABLE public.spp_payments 
      ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL,
      ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'TRANSFER_BANK',
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;
  ```
- **Keamanan Privilege**: Menggunakan `SECURITY DEFINER` dengan pencarian jalur aman `SET search_path = public, extensions, pg_temp;`. Memberikan hak eksekusi teruji: `GRANT EXECUTE ON FUNCTION public.admin_verify_spp_payment TO authenticated;` dan `GRANT EXECUTE ON FUNCTION public.parent_submit_manual_payment_proof TO authenticated;`.

#### 2. Perbandingan RPC `admin_verify_spp_payment` (Draf 02 vs Migrasi 06)

| Parameter / Fitur | Spesifikasi Draf `02_phase2b3_rpc_routines.sql` | Spesifikasi Migrasi `06_phase4b_manual_payment_schema.sql` | Analisis Keamanan & Dampak |
| :--- | :--- | :--- | :--- |
| **Cakupan Peran (RBAC)** | `'owner'`, `'admin'`, `'manager'` | **`'owner'`, `'admin'` SAJA** | **LEBIH KETAT**: Memenuhi keputusan produk FASE 4B. Peran `manager`, `kasir`, `staff`, dan `parent` ditolak (HTTP 403 / SQLERRCODE 42501). |
| **Eksekusi Akuntansi Financial Core** | Hanya memperbarui `verification_status` di `spp_payments`. | **MEMBUAT TRANSAKSI & GENERAL LEDGER** | **LENGKAP**: Pada `VERIFY`, membuat `transactions` (`status='COMPLETED'`), mengubah `spp_payments.status='LUNAS'`, serta mencatat Debit `1002_BANK_TRANSFER` vs Kredit `4001_REVENUE`. |
| **Penanganan Penolakan (`REJECT`)** | Mengubah `verification_status` ke `rejected`. | Mengubah `status='BELUM_LUNAS'`, `verification_status='rejected'`, mewajibkan `rejection_reason`. | **TIDAK ADA JURNAL**: Tidak membuat transaksi atau ledger pendapatan saat pembayaran ditolak. |
| **Pencegahan Concurrency** | Menggunakan `FOR UPDATE` row lock. | Menggunakan `FOR UPDATE` row lock. | **AMAN**: Mencegah race condition ketika dua admin menyetujui pembayaran yang sama secara simultan. |

#### 3. Status Eksekusi Production
- **Status Live**: **UNVERIFIED / PENDING APPROVAL**. Skrip `06_phase4b_manual_payment_schema.sql` telah disiapkan sebagai file spesifikasi migrasi, namun **BELUM DIEKSEKUSI** pada database Supabase Production (`wqnhlmvvyhpctmaukwyj.supabase.co`) sesuai batas larangan Strict Read-Only.

---

### D. AUDIT RBAC DAN TENANT ISOLATION

#### 1. Evaluasi RBAC pada Backend Edge Functions
- **P0 Temuan Kritis**: Pada file `functions/api/admin/verify_payment.js`:
  - **Baris 26–31**:
    ```javascript
    const staffRole = String(body.staffRole || body.role || '').toLowerCase();
    const staffUid = String(body.staffUid || body.uid || '').trim();
    ```
  - **Baris 44–52**:
    ```javascript
    if (!['owner', 'admin'].includes(staffRole)) {
      return new Response(JSON.stringify({ success: false, message: 'Akses ditolak...' }), { status: 403 });
    }
    ```
  - **Risiko Keamanan**: Klien HTTP dapat mengirimkan body `{ "staffRole": "admin" }` untuk mengelabui logika Edge Function ini. Edge API tidak memverifikasi token session admin via Supabase Auth `supabaseGetUser` atau cookie staff terenkripsi.
  - **Rekomendasi Perbaikan P0**: Edge Function wajib memverifikasi JWT header (`Authorization: Bearer <token>`) atau cookie sesi staff admin dan memeriksa tabel `users_staff` di PostgreSQL secara server-side sebelum memproses tindakan verifikasi.

#### 2. Isolasi Tenant (Tenant Isolation)
- **Portal Ortu (`upload_receipt.js` & `submit_proof.js`)**:
  - Mengambil daftar anak yang diotorisasi dari sesi terenkripsi (`session.children`).
  - Membandingkan `studentId` dan `tenantId` permintaan dengan daftar anak terotorisasi:
    ```javascript
    const isAuthorized = authorizedChildren.some(child => {
      const cId = String(child.studentId || child.id || '').trim().toLowerCase();
      const tId = String(child.tenantId || '').trim().toLowerCase();
      return cId === studentId.toLowerCase() && (tId === tenantId.toLowerCase() || !tId);
    });
    ```
  - Menolak akses lintas tenant/siswa dengan status HTTP `403 Forbidden`.

---

### E. AUDIT PAYMENT PROOF & STORAGE SECURITY

#### 1. Validasi File pada Endpoint `upload_receipt.js`
- **Batas Ukuran**: Dibatasi maksimum 5 MB (`5 * 1024 * 1024` bytes). Ditolak dengan HTTP `400 Bad Request` jika melebihi.
- **Tipe MIME & Ekstensi**: Memeriksa `ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']` dan ekstensi `['jpg', 'jpeg', 'png', 'webp', 'pdf']`.
- **Penamaan File**: Jalur file aman dibuat dengan format:
  `${tenantId}/${studentId}/${sppPaymentId || 'general'}_${Date.now()}_${randomToken}.${ext}`
- **Temuan Magic Bytes (P2)**: Validasi saat ini mengandalkan string `fileType` dari payload JSON. Disarankan menambahkan pengujian header byte (magic bytes: `FF D8 FF` untuk JPEG, `89 50 4E 47` untuk PNG, `%PDF` untuk PDF).

#### 2. Ketersediaan Storage Bucket Production (P1)
- **Kondisi Implementasi**: Endpoint `upload_receipt.js` saat ini menghasilkan Data URI Base64 inline. Physical Supabase Storage bucket `payment_proofs` (Private Bucket, RLS policy untuk authenticated upload & admin download) belum di-provision secara live.
- **Status Production**: **BLOCKED FOR DEPLOYMENT** hingga bucket `payment_proofs` dan kebijakan RLS dikonfigurasi di Supabase Dashboard.

---

### F. AUDIT SUBMISSION DAN FINANCIAL CORE

#### 1. Alur Submission Ortu (`submit_proof.js` / `parent_submit_manual_payment_proof`)
- **Pemisahan Konfirmasi vs Status Lunas**:
  - Mengunggah bukti pembayaran **TIDAK PERNAH** mengubah status tagihan menjadi `LUNAS`.
  - Mengunggah bukti pembayaran **TIDAK PERNAH** menciptakan transaksi sukses atau menulis jurnal pendapatan pada `global_ledger`.
  - Status tagihan diset ke `unverified` (Label UI: `MENUNGGU VERIFIKASI`).
- **Integritas Nominal**:
  - Endpoint tidak menerima atau mempercayai nominal pembayaran dari browser klien.
  - Tagihan resmi selalu mengacu pada data tagihan terverifikasi dari Financial Core (`spp_payments.amount`).
- **Pencegahan Konfirmasi Ulang**:
  - RPC `parent_submit_manual_payment_proof` memeriksa apakah tagihan sudah lunas:
    ```sql
    IF v_payment.status = 'LUNAS' OR v_payment.verification_status = 'verified' THEN
        RAISE EXCEPTION 'ALREADY_PAID: Tagihan % telah lunas terverifikasi', p_spp_payment_id USING ERRCODE = '22000';
    END IF;
    ```

---

### G. AUDIT APPROVAL DAN REJECTION

#### 1. Tindakan APPROVE (`VERIFY`)
- Menghasilkan ID Transaksi baru (`v_tx_id = gen_random_uuid()`).
- Membuat entri `transactions` (`status = 'COMPLETED'`, `is_void = false`).
- Mengubah `spp_payments.status = 'LUNAS'` dan `verification_status = 'verified'`.
- Menulis dua entri seimbang pada `global_ledger`:
  - Debit `1002_BANK_TRANSFER`: `v_payment.amount`
  - Kredit `4001_REVENUE`: `v_payment.amount`
- Mencatat jejak audit permanen pada `spp_payment_verifications` (`action = 'VERIFY'`).

#### 2. Tindakan REJECT (`REJECT`)
- Mewajibkan parameter catatan/alasan penolakan (`p_notes`).
- Mengubah `spp_payments.status = 'BELUM_LUNAS'` dan `verification_status = 'rejected'`, serta mengisi `rejection_reason = p_notes`.
- **TIDAK MENULIS** transaksi atau jurnal pendapatan.
- Mencatat jejak audit permanen pada `spp_payment_verifications` (`action = 'REJECT'`).

---

### H. AUDIT IDEMPOTENCY DAN CONCURRENCY

#### 1. Penanganan Concurrency pada Database (Row Locking)
- Baik `admin_verify_spp_payment` maupun `parent_submit_manual_payment_proof` mengeksekusi klausa SQL `FOR UPDATE` saat mengambil data tagihan `spp_payments`:
  ```sql
  SELECT * INTO v_payment 
  FROM public.spp_payments 
  WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id 
  FOR UPDATE;
  ```
- Kebijakan penguncian baris ini menjamin bahwa jika dua admin mengklik tombol "Setujui" pada saat bersamaan, transaksi kedua akan tertahan (wait) hingga transaksi pertama selesai, lalu transaksi kedua akan melempar pengecualian `ALREADY_VERIFIED`.

#### 2. Remediasi Idempotency Key GAP-06
- Skrip migrasi `06_phase4b_manual_payment_schema.sql` mencakup pembaharuan RPC `pos_checkout_spp_atomic` dengan validasi `payload_hash`.
- Jika idempotency key yang sama dikirim ulang dengan payload berbeda, sistem akan mendeteksi ketidakcocokan dan menolak permintaan dengan kesalahan `IDEMPOTENCY_CONFLICT`.

---

### I. EVALUASI KUALITAS TEST SUITE (22/22 & 71/71)

Execution log dari `node --test tests/portal_v2_phase4b_manual_payment.test.js`:
```text
# Subtest: CHUVATOR Parent Portal V2 — Phase 4B Manual Payment Integration Test Suite
  # Subtest: Category 1: Tenant Payment Configuration & Isolation (Tests 1 - 4) -> ok 4
  # Subtest: Category 2: Payment Proof Submission & Validation (Tests 5 - 10) -> ok 6
  # Subtest: Category 3: Admin & Owner Verification Security & RBAC (Tests 11 - 18) -> ok 8
  # Subtest: Category 4: Financial Core Integrity & Idempotency (Tests 19 - 22) -> ok 4
# tests 22, pass 22, fail 0, duration_ms 199.53
```

#### Analisis Objektif Test Suite:
1. **Sifat Pengujian**: Pengujian bersifat **In-Memory Unit Assertions**. Test suite memverifikasi logika kondisional JavaScript dan struktur objek mock.
2. **Keterbatasan Test Suite**:
   - Test suite **TIDAK** terhubung ke instance database PostgreSQL live.
   - Test suite **TIDAK** mengeksekusi permintaan HTTP riil ke Cloudflare Pages Functions.
   - Test suite **TIDAK** menguji race condition concurrency jaringan yang sebenarnya.
3. **Kesimpulan Kualitas Test**: Pengujian unit sangat baik untuk memvalidasi invariant bisnis dan batas logika, namun **TIDAK DAPAT** dijadikan satu-satunya alasan untuk menyatakan sistem *Ready for Production* tanpa pengujian staging live.

---

### J. DAFTAR BLOCKER BERDASARKAN PRIORITAS

#### Prioritas P0 (Risiko Keamanan / Kritis Integrasi)
1. **P0-1: RBAC Parameter Trust pada `verify_payment.js`**:
   - **Path**: `functions/api/admin/verify_payment.js` (Baris 26-52)
   - **Masalah**: Mengambil `staffRole` dari JSON body tanpa memverifikasi JWT/session token admin.
   - **Perbaikan**: Tambahkan verifikasi token staff server-side sebelum memeriksa role.

#### Prioritas P1 (Menghalangi Deployment Staging/Production)
2. **P1-1: Perbedaan Endpoint Edge vs RPC Supabase PostgreSQL**:
   - **Path**: `functions/api/admin/verify_payment.js` & `functions/api/portal/submit_proof.js`
   - **Masalah**: Endpoint Edge mematch Firestore REST API, sementara Financial Core resmi menggunakan Supabase PostgreSQL RPC `admin_verify_spp_payment` dan `parent_submit_manual_payment_proof`.
   - **Perbaikan**: Arahkan permintaan Edge Functions untuk memanggil Supabase REST RPC via `fetch('${SUPABASE_URL}/rest/v1/rpc/admin_verify_spp_payment', ...)`.
3. **P1-2: Provisioning Bucket Supabase Storage `payment_proofs`**:
   - **Path**: Supabase Storage Config
   - **Masalah**: Bucket physical `payment_proofs` dan kebijakan RLS private bucket belum di-provision di live Supabase.
   - **Perbaikan**: Jalankan provisioning bucket `payment_proofs` dan RLS policy di Supabase Console.

#### Prioritas P2 (Perbaikan Penting Sebelum Go-Live)
4. **P2-1: Validasi Magic Bytes File**:
   - **Path**: `functions/api/portal/upload_receipt.js`
   - **Masalah**: Validasi header file hanya berbasis MIME string dan ekstensi.
   - **Perbaikan**: Periksa byte signature header dari buffer base64 (misal `FF D8 FF`).

#### Prioritas P3 (Penyempurnaan UX & Observabilitas)
5. **P3-1: Logging Audit Trail Admin**:
   - **Path**: `spp_payment_verifications`
   - **Masalah**: Penambahan log audit tambahan untuk IP address pengonfirmasi pembayaran.

---

### K. REKOMENDASI FINAL & KEPUTUSAN GATE

#### KEPUTUSAN FINAL GATE:
### **`CONDITIONAL PASS — READY AFTER SPECIFIED FIXES`**

> **Penjelasan Gate**:
> Implementasi FASE 4B telah memiliki spesifikasi DDL/RPC PostgreSQL yang sangat solid (`06_phase4b_manual_payment_schema.sql`), komponen UI yang lengkap (`AdminPaymentVerificationModal.jsx` & `PortalDashboard.jsx`), serta 22/22 unit test yang lulus.
> Namun, deployment ke lingkungan production **DITAHAN (BLOCKED)** hingga dua perbaikan kritis (P0-1 dan P1-1) diselesaikan pada Edge API Functions dan migrasi database disetujui oleh Product Owner.

---
**Laporan Audit Resmi CHUVATOR Parent Portal V2 — Fase 4B-Verify Selesai.**
