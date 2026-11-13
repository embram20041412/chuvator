-- =============================================================================
-- CHUVATOR — TASK 03.4: SUPABASE DATABASE MIGRATION READINESS
-- 02_core_table_and_indexes.sql (IDEMPOTENT CORE TABLE, COLUMNS & INDEXES)
-- =============================================================================
-- PRINSIP:
--   1. Idempoten & Non-Destruktif (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
--   2. Mempertahankan kompatibilitas penuh dengan Task 03, 03.1, 03.2, 03.3.
--   3. Menambahkan kolom konteks terindeks opsional (measurement_method,
--      age_years_at_test, age_group, test_period) tanpa menduplikasi tabel students.
--   4. Tidak membatasi riwayat longitudinal (berbagai sesi tanggal & metode tersimpan terpisah).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 1. Validasi Keberadaan Tabel Prasyarat Wajib Sebelum Membuat FK
DO $$
DECLARE
    v_missing TEXT[];
BEGIN
    SELECT array_agg(req_tbl)
    INTO v_missing
    FROM unnest(ARRAY[
        'platform_superadmins',
        'tenants',
        'users_staff',
        'academies',
        'academy_classes',
        'coaches',
        'students'
    ]) AS req_tbl
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = req_tbl
    );

    IF v_missing IS NOT NULL AND array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'MIGRASI DIHENTIKAN: Tabel prasyarat berikut belum tersedia di schema public: %',
            array_to_string(v_missing, ', ')
            USING ERRCODE = '42P01';
    END IF;
END $$;

-- 2. Definisi Tabel Utama: public.athlete_test_results
CREATE TABLE IF NOT EXISTS public.athlete_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (char_length(trim(tenant_id)) > 0),
    academy_id UUID NULL REFERENCES public.academies(id) ON DELETE SET NULL,
    class_id UUID NULL REFERENCES public.academy_classes(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    coach_id UUID NULL REFERENCES public.coaches(id) ON DELETE SET NULL,
    recorded_by_user_id UUID NULL,
    recorded_by_name TEXT NULL,

    -- Referensi Katalog Tes & Indikator Kanonik (Single Source of Truth)
    test_id TEXT NOT NULL CHECK (char_length(trim(test_id)) > 0),
    indicator_id TEXT NOT NULL CHECK (char_length(trim(indicator_id)) > 0),
    indicator_name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    development_tier TEXT NULL,
    position_code TEXT NULL,

    -- Konteks Pelaksanaan & Metode Pengukuran Terindeks (Task 03.3 / 03.4)
    measurement_method TEXT NULL,
    age_years_at_test INTEGER NULL,
    age_group TEXT NULL,
    test_period TEXT NULL,

    -- Data Mentah & Percobaan (Trials)
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    input_schema_type TEXT NOT NULL DEFAULT 'MULTI_TRIAL',
    trials JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(trials) = 'array'),
    auxiliary_inputs JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(auxiliary_inputs) = 'object'),

    -- Hasil Akhir Mentah & Metrik Turunan
    final_raw_value NUMERIC NULL
        CHECK (final_raw_value IS NULL OR final_raw_value > 0),
    final_unit TEXT NOT NULL CHECK (char_length(trim(final_unit)) > 0),
    final_display_value TEXT NOT NULL,
    aggregation_method TEXT NOT NULL,
    derived_metrics JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(derived_metrics) = 'object'),

    -- Status Validitas & Kalibrasi
    attempt_status TEXT NOT NULL DEFAULT 'VALID'
        CHECK (attempt_status IN ('VALID', 'PARTIAL_VALID')),
    calibration_status TEXT NOT NULL DEFAULT 'PENDING_CALIBRATION'
        CHECK (calibration_status IN ('PENDING_CALIBRATION', 'CALIBRATED', 'READY_FOR_CALIBRATION', 'NEEDS_FURTHER_DESIGN')),
    converted_score NUMERIC NULL
        CHECK (converted_score IS NULL OR (converted_score >= 1 AND converted_score <= 100)),

    notes TEXT NULL DEFAULT '',
    surface_condition TEXT NULL DEFAULT 'Rumput Alami Standar',
    weather_notes TEXT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Penambahan Kolom Konteks Opsional (Idempoten jika tabel Task 03 sudah ada sebelumnya)
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS measurement_method TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_years_at_test INTEGER NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_group TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS test_period TEXT NULL;

-- 4. Constraints Non-Destruktif untuk Kolom Konteks Tambahan
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_age_years_range'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_age_years_range
            CHECK (age_years_at_test IS NULL OR (age_years_at_test >= 3 AND age_years_at_test <= 65));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_test_period_format'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_test_period_format
            CHECK (test_period IS NULL OR test_period ~ '^\d{4}-\d{2}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_spr10m_method'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_spr10m_method
            CHECK (
                test_id <> 'TST-SPR-10M'
                OR measurement_method IS NULL
                OR measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
            );
    END IF;
END $$;

-- 5. Indeks Performa Kueri Longitudinal, Filter Tenant, & Rekapitulasi Norma
CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_student_date
    ON public.athlete_test_results (tenant_id, student_id, test_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_indicator
    ON public.athlete_test_results (tenant_id, indicator_id, test_date DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_class
    ON public.athlete_test_results (tenant_id, class_id, test_date DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_test_date
    ON public.athlete_test_results (tenant_id, test_id, test_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_norms_recap
    ON public.athlete_test_results (tenant_id, test_id, age_group, development_tier, measurement_method, test_period);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_calibration_status
    ON public.athlete_test_results (tenant_id, test_id, calibration_status);
