# PARENT PORTAL V2 — FASE 4B
## DOKUMEN SPESIFIKASI KEAMANAN STORAGE BUCKET (STORAGE SECURITY)
**Dokumen Security:** `PARENT_PORTAL_V2_PHASE4B_STORAGE_SECURITY.md`  
**Status Security:** SPECIFICATION PREPARED & TESTED  
**Target Bucket:** `payment_proofs` (Supabase Storage)

---

### 1. KONFIGURASI STORAGE BUCKET `payment_proofs`

- **Bucket Name**: `payment_proofs`
- **Public Access**: `DISABLED` (Private Bucket Wajib).
- **Max File Size**: 5.242.880 bytes (5 MB).
- **MIME Types Allowed**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **File Structure Naming**: `{tenant_id}/{student_id}/{spp_payment_id}_{randomToken}.{ext}`.

---

### 2. POLICY ROW LEVEL SECURITY (RLS) `storage.objects`

```sql
-- 1. Policy Insert: Parent terautentikasi mengunggah bukti ke folder sendiri
CREATE POLICY "Parents Upload Own Payment Proof"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'payment_proofs' AND
    (storage.foldername(name))[1] = (
        SELECT tenant_id FROM public.parent_student_links 
        WHERE parent_id = auth.uid() LIMIT 1
    )
);

-- 2. Policy Select: Admin/Owner membaca bukti tenant milik sendiri via Signed URL
CREATE POLICY "Admin Owner Read Tenant Payment Proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'payment_proofs' AND
    EXISTS (
        SELECT 1 FROM public.users_staff 
        WHERE uid = auth.uid()::text 
          AND tenant_id = (storage.foldername(name))[1]
          AND role IN ('owner', 'admin')
          AND status = 'active'
    )
);

-- 3. Zero Delete Policy
-- Tidak ada Policy DELETE atau UPDATE yang dibuat. Parent DILARANG menghapus/menimpa bukti yang telah dikirim.
```
