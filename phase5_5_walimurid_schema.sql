-- =============================================================================
-- CHUVATOR — FASE 5.5-B
-- WALIMURID DATABASE SCHEMA & KK IDENTITY IMPLEMENTATION
-- Status: IMPLEMENTATION (FOR SUPABASE SQL EDITOR)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. IDENTITAS KELUARGA (KK) PADA TABEL STUDENTS
-- Menambahkan kolom identitas keluarga berbasis HMAC untuk privasi data.
-- -----------------------------------------------------------------------------

DO $$ 
BEGIN
    -- Tambah kolom kk_hmac jika belum ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'kk_hmac'
    ) THEN
        ALTER TABLE public.students ADD COLUMN kk_hmac VARCHAR(64);
        COMMENT ON COLUMN public.students.kk_hmac IS 'HMAC-SHA-256 dari nomor KK yang sudah dinormalisasi (16 digit).';
    END IF;

    -- Tambah kolom kk_last4 jika belum ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'kk_last4'
    ) THEN
        ALTER TABLE public.students ADD COLUMN kk_last4 VARCHAR(4);
        COMMENT ON COLUMN public.students.kk_last4 IS '4 digit terakhir nomor KK untuk verifikasi visual terbatas.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. INDEKS PENCARIAN KK
-- Mempercepat pencarian kelompok keluarga dalam satu tenant.
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_students_tenant_kk_hmac 
ON public.students (tenant_id, kk_hmac);


-- -----------------------------------------------------------------------------
-- 3. CONSTRAINT UNIK RELASI WALIMURID
-- Memastikan integritas data akun wali murid dan hubungan dengan siswa.
-- -----------------------------------------------------------------------------

DO $$ 
BEGIN
    -- Unique constraint pada parent_accounts (tenant_id, email)
    -- Mencegah duplikasi email login dalam satu tenant.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_parent_accounts_tenant_email'
    ) THEN
        ALTER TABLE public.parent_accounts 
        ADD CONSTRAINT uq_parent_accounts_tenant_email UNIQUE (tenant_id, email);
    END IF;

    -- Unique constraint pada parent_accounts (tenant_id, auth_uid)
    -- Mencegah satu user Supabase Auth memiliki banyak profil dalam satu tenant.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_parent_accounts_tenant_auth_uid'
    ) THEN
        ALTER TABLE public.parent_accounts 
        ADD CONSTRAINT uq_parent_accounts_tenant_auth_uid UNIQUE (tenant_id, auth_uid);
    END IF;

    -- Unique constraint pada parent_student_links (tenant_id, parent_account_id, student_id)
    -- Mencegah duplikasi hubungan antara orang tua dan siswa yang sama.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_parent_student_links_composite'
    ) THEN
        ALTER TABLE public.parent_student_links 
        ADD CONSTRAINT uq_parent_student_links_composite UNIQUE (tenant_id, parent_account_id, student_id);
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 4. VERIFIKASI KEAMANAN (AUDIT ONLY)
-- Menampilkan status kebijakan RLS untuk memastikan tidak ada akses FOR ALL luas.
-- -----------------------------------------------------------------------------

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('students', 'parent_accounts', 'parent_student_links')
ORDER BY tablename, policyname;

COMMIT;

-- =============================================================================
-- END OF FASE 5.5-B MIGRATION
-- =============================================================================
