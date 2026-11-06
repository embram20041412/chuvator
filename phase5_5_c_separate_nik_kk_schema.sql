-- =============================================================================
-- CHUVATOR — FASE 5.5-C (DEPRECATED LEGACY ALIAS SCHEMA FILE)
-- PEMISAHAN IDENTITAS SISWA: NIK (16 DIGIT) DAN NO_KK (16 DIGIT)
-- File: phase5_5_c_separate_nik_kk_schema.sql
-- Status: DEPRECATED / ALIAS SPECIFICATION (MIGRATION KANONIS REGULAR: phase5_5_c_nik_no_kk_separation.sql)
-- 
-- PERINGATAN KANONIKALITAS:
-- File ini dipertahankan murni untuk referensi kompatibilitas histori repository.
-- DDL KANONIS RESMI UNTUK EKSEKUSI ADALAH: phase5_5_c_nik_no_kk_separation.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. DDL: Tambah kolom 'nik' pada public.students (NULLABLE)
-- Menyimpan Nomor Induk Kependudukan resmi atlet/siswa.
-- -----------------------------------------------------------------------------
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS nik VARCHAR(16) NULL;

-- -----------------------------------------------------------------------------
-- 2. DDL: Tambah kolom 'no_kk' pada public.students (NULLABLE)
-- Menyimpan Nomor Kartu Keluarga resmi keluarga siswa (sumber derivasi kk_hmac).
-- -----------------------------------------------------------------------------
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS no_kk VARCHAR(16) NULL;

-- -----------------------------------------------------------------------------
-- 3. CONSTRAINT: Validasi Format 16 Digit Angka Murni (NULL-Safe)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_students_nik_format' 
          AND conrelid = 'public.students'::regclass
    ) THEN
        ALTER TABLE public.students
        ADD CONSTRAINT chk_students_nik_format 
        CHECK (nik IS NULL OR nik ~ '^[0-9]{16}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_students_no_kk_format'
          AND conrelid = 'public.students'::regclass
    ) THEN
        ALTER TABLE public.students
        ADD CONSTRAINT chk_students_no_kk_format 
        CHECK (no_kk IS NULL OR no_kk ~ '^[0-9]{16}$');
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. INDEKS: Optimasi Pencarian berdasarkan tenant_id dan no_kk
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_tenant_no_kk 
ON public.students (tenant_id, no_kk);

CREATE INDEX IF NOT EXISTS idx_students_tenant_nik 
ON public.students (tenant_id, nik);

-- -----------------------------------------------------------------------------
-- 5. TRIGGER INVALIDASI ATOMIK SAAT NOMOR KK BERUBAH
-- Memastikan jika no_kk berubah (atau dikosongkan), kk_hmac dan kk_last4
-- otomatis di-set ke NULL di lapisan database untuk mencegah desinkronisasi hash.
-- Perubahan kolom 'nik' saja TIDAK menyentuh atau menginvalidasi kk_hmac/kk_last4.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_invalidate_student_kk_hmac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- 1. Operasi INSERT: Selalu set kk_hmac dan kk_last4 ke NULL.
    -- Database trigger tidak mempercayai nilai HMAC arbitrer yang dikirim saat pembuatan baris siswa baru.
    IF (TG_OP = 'INSERT') THEN
        NEW.kk_hmac := NULL;
        NEW.kk_last4 := NULL;
    -- 2. Operasi UPDATE: Jika no_kk berubah, selalu set kk_hmac dan kk_last4 ke NULL.
    ELSIF (TG_OP = 'UPDATE' AND OLD.no_kk IS DISTINCT FROM NEW.no_kk) THEN
        NEW.kk_hmac := NULL;
        NEW.kk_last4 := NULL;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_invalidate_student_kk_hmac() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_invalidate_student_kk_hmac() TO service_role, postgres;

DROP TRIGGER IF EXISTS trg_invalidate_student_kk_hmac ON public.students;
CREATE TRIGGER trg_invalidate_student_kk_hmac
    BEFORE INSERT OR UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_invalidate_student_kk_hmac();

-- -----------------------------------------------------------------------------
-- 6. CATATAN KOMPATIBILITAS (BACKWARDS COMPATIBILITY)
-- - Kolom public.students.nik_kk DIPERTAHANKAN dan TIDAK DIHAPUS.
-- - Seluruh pembacaan historis tetap berjalan normal.
-- - Data lama nik_kk berstatus 'UNVERIFIED' sampai verifikasi manual selesai.
-- -----------------------------------------------------------------------------

COMMIT;
