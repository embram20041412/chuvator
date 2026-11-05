# PARENT PORTAL V2 — FASE 4B
## DOKUMEN SPESIFIKASI MIGRASI DATABASE (DATABASE MIGRATION)
**Dokumen Migration:** `PARENT_PORTAL_V2_PHASE4B_DATABASE_MIGRATION.md`  
**Status Migration:** PREPARED MIGRATION SPECIFICATION (READY FOR PO APPROVAL)  
**File Migration SQL:** `06_phase4b_manual_payment_schema.sql`

---

### 1. RINGKASAN PERUBAHAN SKEMA DATABASE

Migration SQL `06_phase4b_manual_payment_schema.sql` menyiapkan 3 komponen perbaikan pada Supabase PostgreSQL:

1. **Penambahan Kolom Pelacak pada `spp_payments`**:
   - `receipt_url` TEXT NULL: Menyimpan URL lampiran bukti transfer.
   - `rejection_reason` TEXT NULL: Menyimpan catatan alasan penolakan jika pembayaran ditolak Admin/Owner.
   - `payment_method` TEXT DEFAULT 'TRANSFER_BANK': Metode pembayaran yang dipilih.
   - `submitted_at` TIMESTAMPTZ NULL: Waktu pengunggahan bukti transfer oleh parent.

2. **Pembaruan RPC `admin_verify_spp_payment`**:
   - Memperketat otorisasi verifikasi **HANYA UNTUK ROLE `owner` DAN `admin`** (Menolak `manager`, `kasir`, `staff`, dan `parent`).
   - Menerapkan penolakan wajib menggunakan catatan `p_notes`.
   - Menjamin sifat *atomic* dan penulisan jurnal Global Ledger (`1002_BANK_TRANSFER` vs `4001_REVENUE`) saat `VERIFY`.

3. **RPC Baru `parent_submit_manual_payment_proof`**:
   - Memungkinkan wali murid menautkan URL bukti transfer secara aman.
   - Menyetel `verification_status = 'unverified'` (Tampilan Portal: `MENUNGGU VERIFIKASI`).
   - **TIDAK MENGUBAH** status tagihan menjadi Lunas dan **TIDAK MENULIS** jurnal ledger secara prematur.

---

### 2. INSTRUKSI EKSEKUSI MIGRASI (GATED DEPLOYMENT)

File migration `06_phase4b_manual_payment_schema.sql` dapat dieksekusi melalui Supabase SQL Editor atau CLI setelah memperoleh persetujuan tertulis dari Product Owner:

```bash
# Eksekusi via Supabase CLI (Hanya jika disetujui PO)
supabase db execute --file ./06_phase4b_manual_payment_schema.sql
```
