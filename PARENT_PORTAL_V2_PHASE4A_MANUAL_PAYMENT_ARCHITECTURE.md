# PARENT PORTAL V2 — FASE 4A
## AUDIT ARSITEKTUR PEMBAYARAN MANUAL (MANUAL PAYMENT ARCHITECTURE)
**Dokumen Spec & Audit:** `PARENT_PORTAL_V2_PHASE4A_MANUAL_PAYMENT_ARCHITECTURE.md`  
**Status Mode:** STRICT READ-ONLY AUDIT  
**Target Project:** `wqnhlmvvyhpctmaukwyj.supabase.co` (CHUVATOR Parent Portal V2)

---

### 1. MODEL PEMBAYARAN RESMI PARENT PORTAL V2

Berdasarkan Keputusan Produk Mengikat dari Product Owner, metode pembayaran resmi Parent Portal V2 saat ini adalah **PEMBAYARAN MANUAL DENGAN VERIFIKASI ADMIN/OWNER**:

1. **QRIS Statis Tenant**: Gambar QRIS resmi milik akademi/tenant.
2. **Transfer Bank Manual**: Transfer ke rekening bank resmi milik tenant.

#### BATASAN RUANG LINGKUP (EXCLUSION):
- **TIDAK MENGGUNAKAN**: Dynamic QRIS, Virtual Account, atau Payment Gateway otomatis (Midtrans, Xendit, Stripe, TriPay).
- **VERIFIKASI WAJIB**: Setiap pembayaran memerlukan verifikasi manual dari Admin Tenant atau Owner Tenant melalui dashboard pengelola.

---

### 2. ALUR ARSITEKTUR PEMBAYARAN MANUAL 10-LANGKAH

```
[ Wali Murid (Portal) ]    [ Edge API / Storage ]     [ Financial Core DB ]     [ Admin / Owner Tenant ]
          |                           |                          |                          |
 1. Lihat Tagihan SPP --------> Read Billing ---------> Query spp_payments                 |
 2. Pilih QRIS/Transfer ------> Tampilkan QRIS/Bank -> Pembacaan tenants                    |
 3. Bayar via Bank/E-Wallet - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ->|
 4. Unggah Bukti Transfer ----> Store File In Bucket -> Attachment Document                |
 5. Buat Konfirmasi ----------> Set Status ------------> 'unverified' / 'MENUNGGU VERIFIKASI'
          |                           |                          |                          |
          |                           | - - - - - - - - - - - - - - - - - - - -> 6. Periksa Bukti
          |                           |                          |               7. Disetujui/Ditolak
          |                           | <================ Exec admin_verify_spp_payment === 8. Eksekusi RPC
          |                           |                          | (LUNAS & Audit Trail)    |
 9. Lihat Status Final <-------- Read Official Status - |                                  |
```

#### DESKRIPSI RINCI 10 LANGKAH:
1. **Lihat Tagihan**: Wali murid memeriksa tagihan resmi anak via Edge API `/api/portal/billing`.
2. **Pilih Metode**: Wali murid memilih QRIS Statis atau Transfer Bank.
3. **Informasi Tenant**: Sistem menampilkan gambar QRIS statis (`tenants.qris_url`) dan daftar rekening bank (`tenants.bank_accounts`).
4. **Pembayaran Luar Sistem**: Wali murid melakukan transfer uang melalui aplikasi m-banking / e-wallet di luar CHUA CORE.
5. **Unggah Bukti**: Wali murid mengunggah foto/file bukti transfer via API `/api/portal/upload_receipt`.
6. **Status Konfirmasi**: Sistem mencatat dokumen pembayaran dengan status **`WAITING_VERIFICATION`** (`verification_status = 'unverified'`).
   > **PRINSIP KRITIS**: Pengiriman bukti **TIDAK OTOMATIS** mengubah tagihan menjadi Lunas!
7. **Pemeriksaan Pengelola**: Admin/Owner Tenant menerima notifikasi konfirmasi dan memeriksa foto bukti serta saldo rekening bank tenant.
8. **Keputusan Verifikasi**: Admin/Owner menyetujui (`VERIFY`) atau menolak (`REJECT` dengan alasan penolakan).
9. **Pencatatan Financial Core**: Jika disetujui, RPC `admin_verify_spp_payment` mengeksekusi pelunasan secara *atomic*, mengubah `verification_status = 'verified'` dan `status = 'LUNAS'`, menulis Jurnal Global Ledger, dan mencatat audit trail immutable di `spp_payment_verifications`.
10. **Status Final Portal**: Parent Portal membaca status resmi `'LUNAS'` dari Financial Core.

---

### 3. KEPATUHAN PRINSIP INTEGRITAS FINANSIAL

- **Single Source of Truth**: Financial Core Supabase PostgreSQL adalah satu-satunya sumber kebenaran status tagihan dan pembayaran.
- **Zero Parent Direct DML**: Wali murid tidak memiliki hak akses mutasi langsung ke tabel `spp_payments` atau `transactions`.
- **Atomic Verification**: Verifikasi dilakukan secara atomic di database melalui RPC `admin_verify_spp_payment`.
