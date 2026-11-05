# PARENT PORTAL V2 — FASE 4A
## AUDIT KEAMANAN UPLOAD BUKTI PEMBAYARAN (PAYMENT PROOF SECURITY)
**Dokumen Spec & Security:** `PARENT_PORTAL_V2_PHASE4A_PAYMENT_PROOF_SECURITY.md`  
**Status Mode:** STRICT READ-ONLY AUDIT & SECURITY SPECIFICATION  
**Target Project:** `wqnhlmvvyhpctmaukwyj.supabase.co`

---

### 1. HASIL AUDIT DOKUMEN & SPESIFIKASI BUKTI PEMBAYARAN

Berdasarkan inspeksi repositori pada `spp_payments` dan `PARENT_PORTAL_V2_GAP_ANALYSIS.md`:

- **Kolom Lampiran Bukti**: `spp_payments.receipt_url` / `spp_payments.proof_url` (TEXT).
- **Status Pengunggahan**: Saat ini diidentifikasi sebagai **`GAP-02`** (Endpoint `/api/portal/upload_receipt.js` perlu dihubungkan dengan Supabase Storage Bucket).

---

### 2. KEBUTUHAN SPESIFIKASI KEAMANAN STORAGE BUCKET

Untuk memastikan pengunggahan bukti pembayaran aman dan terisolasi, spesifikasi Storage Bucket berikut wajib diterapkan pada FASE 4B:

#### A. Konfigurasi Storage Bucket (`payment_proofs`)
- **Bucket Name**: `payment_proofs` (Private Bucket — Public Read DISABLED).
- **Max File Size**: 5 MB per file.
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **Naming Convention**: `{tenant_id}/{student_id}/{spp_payment_id}_{timestamp}.{ext}`.

#### B. Security & Access Policy (RLS pada `storage.objects`)
1. **Insert Policy (Parent Upload)**:
   - Hanya parent terautentikasi yang terhubung dengan `student_id` via `parent_student_links` yang diizinkan mengunggah file ke folder `tenant_id/student_id/`.
2. **Select Policy (Admin Read & Signed URL)**:
   - File hanya dapat dibaca oleh Admin/Owner dari tenant yang bersangkutan melalui Signed URL berdurasi terbatas (misalnya 15 menit).
3. **No Delete / No Overwrite Policy**:
   - Parent **DILARANG** menghapus atau menimpa (*overwrite*) bukti pembayaran yang sudah diunggah.
   - Setiap bukti pembayaran yang terkirim bersifat permanen untuk keperluan audit trail.

---

### 3. PENCEGAHAN AKSES LINTAS TENANT & MANIPULASI BUKTI

- **Pencegahan Cross-Tenant Leakage**: Jalur file menyertakan `tenant_id`. Policy Storage RLS menolak akses pembacaan file dari user yang memiliki `tenant_id` berbeda.
- **Status Non-Otoritatif**: Bukti pembayaran hanyalah lampiran pendukung verifikasi visual. Adanya bukti pembayaran **TIDAK PERNAH** mengubah status finansial tagihan secara otomatis.
