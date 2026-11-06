-- =============================================================================
-- CHUVATOR — FASE 5.5-C (ADDITIVE IDENTITY SEPARATION SCHEMA)
-- PEMISAHAN IDENTITAS SISWA: NIK (16 DIGIT) DAN NO_KK (16 DIGIT)
-- File: phase5_5_c_separate_nik_kk_schema.sql
-- Status: PREPARED SPECIFICATION (NOT EXECUTED - ZERO PRODUCTION MUTATION)
-- 
-- PRINSIP KEAMANAN & ARSITEKTUR:
-- 1. ADDITIVE ONLY: Menambahkan kolom baru tanpa menghapus kolom lama nik_kk.
-- 2. NULL-SAFE: Kolom nik dan no_kk bersifat NULLABLE sehingga tidak merusak
--    data historis 6 siswa yang ada saat ini di Supabase wqnhlmvvyhpctmaukwyj.
-- 3. NO AUTO-MIGRATION: Dilarang melakukan migrasi otomatis dari nik_kk ke no_kk
--    atau nik sebelum verifikasi dokumen fisik dilakukan oleh pihak sekolah.
-- 4. FORMAT VALIDATION: Format constraint NULL-safe memastikan jika diisi,
--    wajib tepat 16 digit angka murni (^[0-9]{16}$).
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
    -- Hanya invalidasi jika no_kk mengalami perubahan nilai
    IF (OLD.no_kk IS DISTINCT FROM NEW.no_kk) THEN
        -- Jika update tidak secara bersamaan menyertakan HMAC baru yang berbeda,
        -- reset kk_hmac dan kk_last4 agar hash KK lama tidak tertinggal aktif
        IF (NEW.kk_hmac IS NOT DISTINCT FROM OLD.kk_hmac) THEN
            NEW.kk_hmac := NULL;
            NEW.kk_last4 := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_invalidate_student_kk_hmac() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_invalidate_student_kk_hmac() TO service_role, postgres;

DROP TRIGGER IF EXISTS trg_invalidate_student_kk_hmac ON public.students;
CREATE TRIGGER trg_invalidate_student_kk_hmac
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_invalidate_student_kk_hmac();

-- -----------------------------------------------------------------------------
-- 6. CATATAN KOMPATIBILITAS (BACKWARDS COMPATIBILITY)
-- - Kolom public.students.nik_kk DIPERTAHANKAN dan TIDAK DIHAPUS.
-- - Seluruh pembacaan historis tetap berjalan normal.
-- - Data lama nik_kk berstatus 'UNVERIFIED' sampai verifikasi manual selesai.
-- -----------------------------------------------------------------------------

COMMIT;
