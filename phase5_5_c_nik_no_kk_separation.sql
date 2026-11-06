-- =============================================================================
-- CHUVATOR — FASE 5.5-B: ADDITIVE SCHEMA MIGRATION
-- PEMISAHAN IDENTITAS NIK SISWA DAN NOMOR KARTU KELUARGA (KK)
-- File: phase5_5_c_nik_no_kk_separation.sql
-- Status: SPECIFICATION PREPARATION (UNEXECUTED DDL SPECIFICATION)
-- 
-- PRINSIP KEAMANAN:
-- 1. ADDITIVE SAJA: Menambahkan kolom 'nik' dan 'no_kk' tanpa menghapus kolom lama 'nik_kk'.
-- 2. ZERO AUTOMATIC MIGRATION: DILARANG meng-copy nik_kk secara otomatis ke nik atau no_kk.
--    Data historis nik_kk berpotensi berisi NIK, No. KK, atau nomor campuran yang belum
--    terverifikasi asalnya.
-- 3. ZERO DATA MUTATION: Tidak ada UPDATE, INSERT, atau DELETE terhadap data produksi.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PENAMBAHAN KOLOM IDENTITAS EKSPLISIT PADA TABEL public.students
-- -----------------------------------------------------------------------------

-- Kolom NIK Siswa (16 digit angka kependudukan perorangan siswa)
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS nik VARCHAR(16) NULL;

-- Kolom Nomor KK (16 digit angka kartu keluarga keluarga siswa)
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS no_kk VARCHAR(16) NULL;

-- -----------------------------------------------------------------------------
-- 2. CHECK CONSTRAINTS UNTUK INTEGRITAS FORMAT (JIKA DIISI)
-- Nilai boleh NULL (karena pemisahan bertahap), tetapi jika diisi harus tepat 16 digit angka.
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
-- 3. INDEKS PERFORMA PENCARIAN DENGAN ISOLASI TENANT
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_students_tenant_nik 
ON public.students (tenant_id, nik)
WHERE nik IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_tenant_no_kk 
ON public.students (tenant_id, no_kk)
WHERE no_kk IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. TRIGGER INVALIDASI ATOMIK SAAT NOMOR KK BERUBAH
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
    -- Setiap kali no_kk mengalami perubahan nilai (OLD.no_kk IS DISTINCT FROM NEW.no_kk),
    -- WAJIB menginvalidasi kk_hmac dan kk_last4 menjadi NULL secara tanpa syarat.
    -- Trigger database tidak boleh mempercayai nilai HMAC arbitrer yang dikirim bersamaan dengan perubahan no_kk.
    IF (OLD.no_kk IS DISTINCT FROM NEW.no_kk) THEN
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
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_invalidate_student_kk_hmac();

-- -----------------------------------------------------------------------------
-- 5. PERNYATAAN KOMPATIBILITAS DAN RISIKO MIGRASI
-- -----------------------------------------------------------------------------
-- PERINGATAN KESELAMATAN DATA:
-- Kolom 'nik_kk' DIPERTAHANKAN sepenuhnya untuk menjaga kompatibilitas backward
-- aplikasi lawas sampai seluruh proses pendataan ulang selesai.
-- 
-- JANGAN MENJALANKAN OPERASI MUTASI OTOMATIS:
-- DILARANG menyalin isi kolom nik_kk ke kolom no_kk secara kolektif tanpa verifikasi fisik.
-- 
-- Setiap data dari 6 siswa eksisting wajib diverifikasi dokumen fisiknya
-- (apakah nilai 16 digit yang tersimpan di nik_kk merupakan NIK atau No. KK).
-- Pengisian no_kk definitif hanya boleh dilakukan setelah verifikasi tersebut.
-- -----------------------------------------------------------------------------

COMMIT;
