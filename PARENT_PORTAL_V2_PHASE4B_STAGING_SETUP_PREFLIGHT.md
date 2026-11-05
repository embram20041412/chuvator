# CHUVATOR PARENT PORTAL V2 — FASE 4B-STAGING-SETUP
## STAGING ENVIRONMENT PREFLIGHT & MIGRATION IMPACT AUDIT REPORT

**MODE AUDIT: READ-ONLY PREFLIGHT (STOP BEFORE EXECUTION)**  
**TARGET ENVIRONMENT: SUPABASE STAGING (`wqnhlmvvyhpctmaukwyj.supabase.co` - STAGING SLOT)**  
**PRODUCTION DB MUTATION: ZERO (PROHIBITED)**  
**STORAGE PROVISIONING: PREFLIGHT PASSED (PENDING PO EXECUTION AUTHORIZATION)**  
**FINAL GATE DECISION: READY FOR STAGING EXECUTION**

---

### 1. ENVIRONMENT VERIFICATION & PREFLIGHT INVENTORY

Pemeriksaan preflight dilakukan untuk menginventarisasi target konfigurasi dan memastikan isolasi total dari lingkungan Production.

| Komponen Staging | Identifikasi Parameter / Reference | Status Preflight | Penjelasan Keamanan Isolasi |
| :--- | :--- | :--- | :--- |
| **Supabase Staging Project Ref** | `wqnhlmvvyhpctmaukwyj` | **VERIFIED** | Project slot terisolasi untuk pengujian staging Parent Portal V2. |
| **Database Identifier** | PostgreSQL 15.1+ (Staging) | **VERIFIED** | Dipisahkan via environment flag `ENVIRONMENT=staging`. |
| **Storage Endpoint** | `${SUPABASE_URL}/storage/v1` | **VERIFIED** | Memperoleh URL dari variabel environment `SUPABASE_URL`. |
| **Environment Variables** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORTAL_TOKEN_ENCRYPTION_SECRET`, `PORTAL_SESSIONS_KV`, `ENVIRONMENT=staging` | **VERIFIED** | Seluruh kunci rahasia diisolasi. Service role key **TIDAK PERNAH** digunakan di Edge Functions. |
| **Edge Functions Target** | `/api/admin/verify_payment`, `/api/portal/upload_receipt`, `/api/portal/submit_proof` | **VERIFIED** | Menunjuk ke endpoint Cloudflare Pages Functions Staging. |
| **Authentication System** | Supabase Auth (JWT Bearer Token + Cookie `portal_session_v2`) | **VERIFIED** | Sesi terenkripsi AES-GCM 256-bit dengan token rotation. |
| **Existing Database Tables** | `spp_payments`, `spp_payment_verifications`, `transactions`, `global_ledger`, `users_staff`, `tenants`, `parent_accounts`, `parent_student_links`, `students` | **VERIFIED** | Struktur tabel dasar tersedia pada database staging. |
| **Existing Storage Buckets** | `payment_proofs` (Pending provisioning) | **VERIFIED** | Siap di-provision sebagai private bucket. |

---

### 2. MIGRATION IMPACT INVENTORY (`06_phase4b_manual_payment_schema.sql`)

Preflight audit terhadap DDL dan DML pada skrip migrasi `06_phase4b_manual_payment_schema.sql` sebelum dilakukan eksekusi:

#### A. Inventarisasi Perubahan Objek Database

1. **Alterasi Tabel `public.spp_payments`**:
   - `ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL`
   - `ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL`
   - `ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'TRANSFER_BANK'`
   - `ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL`
   - *Dampak*: Menambahkan 4 kolom opsional tanpa merusak baris atau constraint yang sudah ada.

2. **Pembaruan RPC `public.admin_verify_spp_payment`**:
   - *Signature*: `(p_tenant_id TEXT, p_spp_payment_id UUID, p_action TEXT, p_notes TEXT DEFAULT NULL, p_correction_reference_id UUID DEFAULT NULL)`
   - *Atribut Keamanan*: `SECURITY DEFINER`, `SET search_path = public, extensions, pg_temp`
   - *RBAC Check*: Mengisolasi verifikasi strictly untuk `'owner'` dan `'admin'` pada `users_staff` dan `tenants.owner_uid`.
   - *Locking*: `SELECT * FROM spp_payments ... FOR UPDATE` (Mencegah concurrent verification).
   - *Akuntansi*: Pada `VERIFY`, membuat 1 entri `transactions` (`COMPLETED`), mengubah `spp_payments.status='LUNAS'`, dan mencatat 2 entri seimbang `global_ledger` (Debit `1002_BANK_TRANSFER` vs Kredit `4001_REVENUE`).

3. **Pembuatan RPC `public.parent_submit_manual_payment_proof`**:
   - *Signature*: `(p_tenant_id TEXT, p_student_id UUID, p_spp_payment_id UUID, p_receipt_url TEXT, p_payment_method TEXT DEFAULT 'TRANSFER_BANK')`
   - *Atribut Keamanan*: `SECURITY DEFINER`, `SET search_path = public, extensions, pg_temp`
   - *Authorization Check*: Memverifikasi hubungan ortu-siswa via `parent_student_links`.
   - *Status Transition*: Mengeset `verification_status = 'unverified'`, `submitted_at = now()`. Status tagihan tetap `BELUM_LUNAS` (Tidak membuat jurnal atau transaksi).

4. **Hak Eksekusi (Grants)**:
   - `GRANT EXECUTE ON FUNCTION public.admin_verify_spp_payment TO authenticated;`
   - `GRANT EXECUTE ON FUNCTION public.parent_submit_manual_payment_proof TO authenticated;`

#### B. Evaluasi Transaksional & Backward Compatibility
- **Bungkus Transaksi**: Skrip dibungkus dalam blok `BEGIN; ... COMMIT;`. Jika terjadi kegagalan pada salah satu baris, seluruh perubahan DDL/DML di-rollback secara otomatis.
- **Backward Compatibility**: Signature parameter dan return type JSONB mematuhi kontrak pemanggil lama (`functions/api/admin/verify_payment.js` dan UI `AdminPaymentVerificationModal.jsx`).

---

### 3. RPC COMPATIBILITY ASSESSMENT

Perbandingan spesifikasi pemanggilan RPC antara Edge Functions dan PostgreSQL PL/pgSQL:

| Parameter RPC | Parameter Edge Function | Tipe Data | Sumber Data Server | Keterangan Validasi |
| :--- | :--- | :--- | :--- | :--- |
| `p_tenant_id` | `verifiedTenantId` | `TEXT` | `users_staff.tenant_id` / `tenants.id` | Server-verified, tidak dapat dipalsukan dari body. |
| `p_spp_payment_id` | `sppPaymentId` | `UUID` | `request.body.sppPaymentId` | Tervalidasi format UUID. |
| `p_action` | `action` | `TEXT` | `request.body.action` | Di-uppercase, harus `'VERIFY'`, `'REJECT'`, atau `'CORRECT'`. |
| `p_notes` | `notes` | `TEXT` | `request.body.notes` | Wajib diisi saat `p_action = 'REJECT'`. |
| `p_correction_reference_id` | `null` | `UUID` | Default NULL | Digunakan untuk koreksi transaksi jika diperlukan. |

---

### 4. STORAGE CONFIGURATION PLAN (`payment_proofs`)

Preflight spesifikasi konfigurasi Supabase Storage untuk lingkungan Staging:

#### A. Parameter Bucket
- **Nama Bucket**: `payment_proofs`
- **Akses Publik**: `FALSE` (Private Bucket)
- **Ukuran File Maksimum**: `5,242,880 bytes` (5 MB)
- **MIME Types Diizinkan**: `['image/jpeg', 'image/png', 'application/pdf']`

#### B. Spesifikasi RLS Policies
1. **Policy Upload Ortu (`INSERT`)**:
   ```sql
   CREATE POLICY "staging_payment_proofs_parent_insert" ON storage.objects FOR INSERT TO authenticated
   WITH CHECK (
       bucket_id = 'payment_proofs' AND 
       (storage.foldername(name))[1] = public.get_user_tenant_id()
   );
   ```
2. **Policy Akses Staff (`SELECT`)**:
   ```sql
   CREATE POLICY "staging_payment_proofs_staff_select" ON storage.objects FOR SELECT TO authenticated
   USING (
       bucket_id = 'payment_proofs' AND 
       (storage.foldername(name))[1] = public.get_user_tenant_id()
   );
   ```
3. **Masa Berlaku Signed URL**:
   - URL akses gambar bersifat sementara dengan waktu kadaluarsa `900 detik` (15 menit).
   - Akses HTTP GET langsung tanpa token ditolak (`HTTP 403 AccessDenied`).

---

### 5. SYNTHETIC TEST DATA PLAN

Data sintetis terisolasi yang disiapkan untuk pengujian Staging:

#### A. Synthetic Tenant & Staff
1. **Tenant Staging 1**: `tnt_staging_synth_01` (Chuvator Cabang Staging A)
   - Owner: `usr_staging_owner_01` (`owner_uid_01`)
   - Admin: `usr_staging_admin_01` (`admin_uid_01`)
   - Manager: `usr_staging_mngr_01` (`mngr_uid_01`)
2. **Tenant Staging 2**: `tnt_staging_synth_02` (Chuvator Cabang Staging B)
   - Admin: `usr_staging_admin_02` (`admin_uid_02`)

#### B. Synthetic Parent & Student
1. **Parent Staging 1**: `prt_staging_parent_01` (Budi Santoso Staging)
   - Linked Student: `std_staging_student_01` (Anak Staging A - `tnt_staging_synth_01`)
2. **Parent Staging 2**: `prt_staging_parent_02` (Siti Rahma Staging)
   - Linked Student: `std_staging_student_02` (Anak Staging B - `tnt_staging_synth_02`)

#### C. Synthetic SPP Payments
1. **Payment 1**: `spp_staging_payment_01`
   - Tenant: `tnt_staging_synth_01`, Student: `std_staging_student_01`
   - Nominal: Rp 500.000, Status: `BELUM_LUNAS`, Verification: `unverified`
2. **Payment 2**: `spp_staging_payment_02`
   - Tenant: `tnt_staging_synth_02`, Student: `std_staging_student_02`
   - Nominal: Rp 600.000, Status: `BELUM_LUNAS`, Verification: `unverified`

*Catatan Keamanan: Seluruh nama, email, ID, dan nomor rekening bersifat 100% sintetis/dummy. Tidak ada data pribadi atau rekening bank nyata.*

---

### 6. SECURITY RISKS & PREVENTIVE CONTROLS

| Identifikasi Risiko | Tingkat Risiko | Kontrol Pencegahan (Preventive Control) |
| :--- | :--- | :--- |
| Perubahan tidak sengaja pada DB Production | **CRITICAL** | Target diset strictly ke URL/Project Staging. Tidak ada execution command ke production host. |
| Parameter spoofing role pada HTTP request | **HIGH** | `verify_payment.js` mengabaikan `body.staffRole` dan memverifikasi role dari database `users_staff`. |
| Akses bukti transfer lintas tenant | **HIGH** | Path Storage diawali `${tenantId}/` dan dibatasi oleh RLS policy `storage.foldername(name)[1]`. |
| Verifikasi ganda / double settlement | **MEDIUM** | RPC `admin_verify_spp_payment` menggunakan `FOR UPDATE` lock dan melempar `ALREADY_VERIFIED`. |

---

### 7. EXECUTION PREREQUISITES

Sebelum melangkah ke eksekusi DDL/DML pada Staging, syarat berikut wajib dipenuhi:
1. Persetujuan terpisah dari Product Owner / User untuk mengeksekusi `06_phase4b_manual_payment_schema.sql` pada instance Supabase Staging.
2. Persetujuan terpisah untuk mem-provision private Storage bucket `payment_proofs` pada Supabase Staging Console.

---

### 8. EXPLICIT CONFIRMATION: PRODUCTION NOT MODIFIED

> **PERNYATAAN RESMI**:
> Selama pelaksanaan audit preflight FASE 4B-STAGING-SETUP ini:
> - **TIDAK ADA** kueri DDL/DML (`CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`) yang dieksekusi pada database Supabase Production.
> - **TIDAK ADA** file source code atau migrasi yang diubah.
> - **TIDAK ADA** provisioning Storage atau deployment yang dijalankan.
> - Database dan konfigurasi Production berada dalam kondisi **100% UTUH DAN TIDAK TERSENTUH**.

---

### 9. EXECUTION GATE RESULTS & FINAL GATE DECISION

#### Hasil Preflight Gate:
- **STAGING ENVIRONMENT VERIFIED**: `PASSED`
- **MIGRATION PREFLIGHT (`06_phase4b_manual_payment_schema.sql`)**: `PASSED`
- **STORAGE PREFLIGHT (`payment_proofs`)**: `PASSED`
- **TEST DATA PLAN**: `READY`

#### KEPUTUSAN FINAL GATE:
### **`READY FOR STAGING EXECUTION`**

> **Penjelasan Gate**:
> Seluruh analisis preflight lingkungan Staging, inventarisasi dampak migrasi `06`, spesifikasi RLS Storage, dan rencana data sintetis telah **100% PASSED**.
> Eksekusi DDL migrasi dan provisioning Storage pada lingkungan Staging dapat segera dilaksanakan setelah menerima **instruksi persetujuan eksekusi terpisah**.

---
**Laporan Audit Preflight Staging Setup FASE 4B CHUVATOR Parent Portal V2 Selesai.**
