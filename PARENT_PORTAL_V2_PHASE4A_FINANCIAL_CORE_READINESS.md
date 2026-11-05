# PARENT PORTAL V2 — FASE 4A
## AUDIT KESIAPAN FINANCIAL CORE UNTUK PEMBAYARAN MANUAL
**Dokumen Spec & Readiness:** `PARENT_PORTAL_V2_PHASE4A_FINANCIAL_CORE_READINESS.md`  
**Status Mode:** STRICT READ-ONLY VERIFICATION  
**Target Project:** `wqnhlmvvyhpctmaukwyj.supabase.co` (Supabase PostgreSQL / Financial Core)

---

### 1. INVENTARISASI REPOSITORI & DEPLOYMENT FINANCIAL CORE

Berdasarkan perbandingan antara skema migration (`01_phase2b3_schema_migration.sql`), PL/pgSQL routines (`02_phase2b3_rpc_routines.sql`), dan katalog Supabase Live Database:

| Objek Database | Tipe Objek | Status Deployment | Keterangan & Catatan Audit |
| :--- | :--- | :---: | :--- |
| `spp_payments` | Tabel Utuh | **DEPLOYED (LIVE)** | Menyimpan tagihan, status `verification_status` (`unverified`, `verified`, `rejected`), dan lampiran `receipt_url`. |
| `spp_payment_verifications` | Tabel Utuh | **DEPLOYED (LIVE)** | Tabel audit trail *append-only* untuk merekam setiap tindakan verifikasi Admin/Owner. |
| `transactions` | Tabel Utuh | **DEPLOYED (LIVE)** | Header transaksi keuangan utama. |
| `pos_transactions` | Tabel Utuh | **DEPLOYED (LIVE)** | Rincian resi dan pembayaran POS kasir. |
| `global_ledger` | Tabel Utuh | **DEPLOYED (LIVE)** | Jurnal akuntansi double-entry (Debit & Kredit) tidak terikat. |
| `spp_monthly_bills` | View / Tabel | **DEPLOYED (LIVE)** | Ringkasan tagihan bulanan SPP per siswa. |
| `student_overpayment_balances` | View / Tabel | **DEPLOYED (LIVE)** | Saldo kelebihan pembayaran (terpisah dari SPP berjalan). |
| `pos_idempotency_keys` | Tabel Utuh | **DEPLOYED (LIVE)** | Idempotency store untuk mencegah pemrosesan ganda. |
| `admin_verify_spp_payment` | PL/pgSQL RPC | **DEPLOYED (LIVE)** | **SIAP DIGUNAKAN** untuk verifikasi manual Admin/Owner. |
| `admin_refund_spp_payment` | PL/pgSQL RPC | **DEPLOYED (LIVE)** | **SIAP DIGUNAKAN** untuk refund atomic oleh Admin/Owner. |
| `parent_get_billing` | PL/pgSQL RPC | **DEPLOYED (LIVE)** | **SIAP DIGUNAKAN** untuk pembacaan tagihan read-only. |
| `pos_checkout_spp_atomic` | PL/pgSQL RPC | **DEPLOYED (LIVE)** | **KHUSUS POS KASIR** (Tidak digunakan untuk Portal). |

---

### 2. DEDIKASI KONTRAK RPC UNTUK PEMBAYARAN MANUAL PORTAL

Untuk memfasilitasi pengiriman konfirmasi pembayaran manual dari portal wali murid secara aman tanpa mengubah status tagihan menjadi Lunas secara prematur, satu RPC tipis baru dispesifikasikan untuk FASE 4B:

#### RPC `parent_submit_manual_payment_proof` (FASE 4B)
- **Fungsi**: Memperbarui record `spp_payments` dengan mencantumkan `receipt_url` dan menyetel `verification_status = 'unverified'` (Status Tampilan: `MENUNGGU VERIFIKASI`).
- **Otorisasi**: Memverifikasi hubungan `parent_student_links` antara `auth.uid()` dan `student_id`.
- **Integritas**: **TIDAK MENGUBAH** `status = 'LUNAS'` dan **TIDAK MEMBUAT** entri jurnal ledger. Tagihan tetap dianggap belum lunas hingga disetujui Admin/Owner.

---

### 3. VERIFIKASI SEPARASI STATUS PEMBAYARAN

Sistem Financial Core secara tegas membedakan 4 status pembayaran:

1. **`UNPAID` / `BELUM_LUNAS`**: Default saat tagihan baru terbit dan belum ada bukti transfer diunggah.
2. **`WAITING_VERIFICATION` / `MENUNGGU_VERIFIKASI`**: Status setelah parent mengunggah bukti transfer (`verification_status = 'unverified'`).
3. **`VERIFIED` / `LUNAS`**: Status resmi setelah Admin/Owner mengeksekusi `admin_verify_spp_payment` dengan `p_action = 'VERIFY'`.
4. **`REJECTED`**: Status setelah Admin/Owner mengeksekusi `admin_verify_spp_payment` dengan `p_action = 'REJECT'` (beserta catatan alasan penolakan).
