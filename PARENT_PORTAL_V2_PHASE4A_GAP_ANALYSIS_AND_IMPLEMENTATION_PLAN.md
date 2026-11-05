# PARENT PORTAL V2 — FASE 4A
## ANALISIS GAP & RANCANGAN IMPLEMENTASI PEMBAYARAN MANUAL
**Dokumen Spec & Plan:** `PARENT_PORTAL_V2_PHASE4A_GAP_ANALYSIS_AND_IMPLEMENTATION_PLAN.md`  
**Status Mode:** READ-ONLY GAP ANALYSIS & IMPLEMENTATION PLAN  
**Target Project:** CHUVATOR Parent Portal V2

---

### 1. MATRIKS GAP TEKNIS PEMBAYARAN MANUAL

Berdasarkan hasil audit menyeluruh terhadap repositori dan Financial Core:

| ID Gap | Nama Komponen Gap | Kategori Risk | Dampak Operasional | Solusi Teknis / Remediasi FASE 4B |
| :---: | :--- | :---: | :--- | :--- |
| **GAP-02** | Missing Upload Receipt Endpoint | **MEDIUM** | Parent belum dapat mengunggah foto bukti transfer langsung dari portal UI. | Membuat handler Edge `/functions/api/portal/upload_receipt.js` terhubung ke Storage Bucket `payment_proofs`. |
| **GAP-P4M-01**| Missing Submit Proof RPC | **MEDIUM** | Perlu RPC khusus untuk mencatat bukti transfer & menyetel `verification_status = 'unverified'`. | Membuat RPC PL/pgSQL `parent_submit_manual_payment_proof`. |
| **GAP-P4M-02**| Admin Verification UI Wireup | **LOW** | Modal verifikasi bukti transfer di Admin Portal perlu disambungkan ke RPC `admin_verify_spp_payment`. | Memastikan komponen Admin Dashboard memanggil RPC `admin_verify_spp_payment` saat tombol Setujui/Tolak ditekan. |
| **GAP-06** | Idempotency Key Payload Check | **LOW** | RPC `pos_checkout_spp_atomic` perlu menambahkan pengecekan `payload_hash` pada idempotency key. | Memperbarui `02_phase2b3_rpc_routines.sql` dengan validasi `payload_hash`. |

---

### 2. URUTAN TAHAP EKSEKUSI IMPLEMENTASI FASE 4B (4 TAHAP TERKONTROLI)

```
[ Tahap 1: Setup Storage Bucket ] ---> [ Tahap 2: Endpoint Upload & Submit ]
                                                    |
[ Tahap 4: End-to-End Test ] <--- [ Tahap 3: Verification UI Wiring ] <------+
```

#### TAHAP 1: Konfigurasi Storage Bucket `payment_proofs`
- Membuat private storage bucket `payment_proofs` di Supabase Storage.
- Menerapkan Row Level Security (RLS) pada `storage.objects` agar hanya parent terhubung yang dapat mengunggah dan Admin/Owner tenant yang dapat membaca via Signed URL.

#### TAHAP 2: Pembangunan Backend Edge API Upload & Submit Proof
- Pembangunan `/functions/api/portal/upload_receipt.js`:
  - Otorisasi sesi V2, validasi file (MIME type `image/jpeg`, `image/png`, `application/pdf`, max 5MB), upload ke bucket `payment_proofs`, dan pengembalian URL file terenkripsi/signed.
- Pembangunan RPC `parent_submit_manual_payment_proof`:
  - Menyimpan `receipt_url` pada `spp_payments` dan menetapkan status `verification_status = 'unverified'` (Status Portal: `MENUNGGU VERIFIKASI`).

#### TAHAP 3: Wiring UI Verifikasi Admin/Owner Tenant
- Menghubungkan halaman verifikasi pembayaran pada Admin Portal ke RPC `admin_verify_spp_payment`.
- Memastikan tindakan `VERIFY` mengubah status tagihan menjadi `LUNAS` dan tindakan `REJECT` menyimpan catatan alasan penolakan pada audit trail.

#### TAHAP 4: End-to-End Verification & Integration Test
- Pengujian simulasi alur pembayaran manual:
  1. Parent mengunggah bukti transfer -> Status berubah menjadi `MENUNGGU VERIFIKASI`.
  2. Tagihan tetap dalam status belum lunas di Financial Core.
  3. Admin/Owner menyetujui -> Status berubah secara atomic menjadi `LUNAS`.
  4. Audit trail tercatat permanen di `spp_payment_verifications`.

---

### 3. REKOMENDASI KEPUTUSAN FINAL GATE FASE 4A

```
===============================================================================
             STATUS FINAL GATE: CONDITIONALLY READY FOR PHASE 4B
===============================================================================
```

#### ALASAN KEPUTUSAN GATE:
1. **Arsitektur Pembayaran Manual Jelas & Aman**: Seluruh alur 10-langkah pembayaran manual (QRIS Statis & Transfer Bank) serta verifikasi Admin/Owner telah dispesifikasikan secara presisi.
2. **Financial Core & RPC Siap**: RPC `admin_verify_spp_payment` sudah **DEPLOYED** di Supabase Production dan siap digunakan untuk verifikasi atomic oleh Admin/Owner.
3. **Kondisi Prasyarat FASE 4B**: Membutuhkan pembuatan Storage Bucket `payment_proofs` dan handler `/api/portal/upload_receipt.js`.

---
*Laporan Audit FASE 4A Selesai. Seluruh pekerjaan dihentikan. Tidak ada perubahan kode, DDL/DML, atau deployment yang dilakukan selama FASE 4A.*
