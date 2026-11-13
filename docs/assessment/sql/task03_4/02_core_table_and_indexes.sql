-- =============================================================================
-- CHUVATOR — TASK 03.4.3: SUPABASE DATABASE MIGRATION READINESS (REMEDIATED)
-- 02_core_table_and_indexes.sql (TRANSACTIONAL, FAIL-CLOSED CORE TABLE & INDEXES)
-- =============================================================================
-- PRINSIP:
--   1. Transaksional (BEGIN ... COMMIT), Idempoten & Non-Destruktif.
--   2. Fail-Closed sejak detik pembuatan tabel: ENABLE + FORCE ROW LEVEL SECURITY
--      dan REVOKE ALL FROM PUBLIC, anon, authenticated diterapkan LANGSUNG setelah
--      CREATE TABLE IF NOT EXISTS sehingga tidak ada jendela tabel tanpa RLS.
--   3. Mempertahankan kompatibilitas penuh dengan Task 03, 03.1, 03.2, 03.3.
--   4. Sanitasi aman nilai whitespace/kosong pada kolom konteks data eksisting
--      tanpa mengubah fakta pengukuran mentah maupun kolom audit `updated_at`.
-- =============================================================================

BEGIN;

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

-- 2A. FAIL-CLOSED LOCKDOWN SEJAK PEMBUATAN TABEL (Menutup jendela eksekusi modular 02..04)
ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon, authenticated;

-- 3. Penambahan Kolom Konteks Opsional (Idempoten jika tabel Task 03 sudah ada sebelumnya)
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS measurement_method TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_years_at_test INTEGER NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_group TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS test_period TEXT NULL;

-- 3A. Lepas Trigger Lama Sementara Bila Ada Sebelum Sanitasi Konteks Agar updated_at Historis Utuh
DROP TRIGGER IF EXISTS trg_protect_athlete_test_results_columns ON public.athlete_test_results;
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;

-- 3B. Sanitasi Aman Nilai Legacy Kosong / Whitespace / Non-Kanonik pada Kolom Konteks Sebelum Constraint
UPDATE public.athlete_test_results
SET
    measurement_method = CASE
        WHEN measurement_method IS NULL OR trim(measurement_method) = '' THEN NULL
        WHEN test_id IN ('TST-SPR-10M', 'TST-SPR-30M')
             AND UPPER(trim(measurement_method)) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
            THEN UPPER(trim(measurement_method))
        WHEN test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA')
             AND UPPER(trim(measurement_method)) = 'STOPWATCH_MANUAL'
            THEN 'STOPWATCH_MANUAL'
        WHEN test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST')
             AND UPPER(trim(measurement_method)) = 'PHYSICAL_MEASURING_TOOL'
            THEN 'PHYSICAL_MEASURING_TOOL'
        WHEN test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02')
             AND UPPER(trim(measurement_method)) = 'MANUAL_COUNT'
            THEN 'MANUAL_COUNT'
        WHEN test_id IN (
            'TST-SPR-10M', 'TST-SPR-30M',
            'TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA',
            'TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST',
            'TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02'
        ) THEN NULL
        ELSE UPPER(trim(measurement_method))
    END,
    age_group = CASE
        WHEN age_group IS NULL OR trim(age_group) = '' THEN NULL
        ELSE trim(age_group)
    END
WHERE (
    measurement_method IS NOT NULL AND (
        trim(measurement_method) = ''
        OR measurement_method IS DISTINCT FROM UPPER(trim(measurement_method))
        OR (
            test_id IN ('TST-SPR-10M', 'TST-SPR-30M')
            AND UPPER(trim(measurement_method)) NOT IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
        )
        OR (
            test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA')
            AND UPPER(trim(measurement_method)) <> 'STOPWATCH_MANUAL'
        )
        OR (
            test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST')
            AND UPPER(trim(measurement_method)) <> 'PHYSICAL_MEASURING_TOOL'
        )
        OR (
            test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02')
            AND UPPER(trim(measurement_method)) <> 'MANUAL_COUNT'
        )
    )
)
   OR (
    age_group IS NOT NULL AND (
        trim(age_group) = ''
        OR age_group IS DISTINCT FROM trim(age_group)
    )
);

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

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_measurement_method_compatibility'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_measurement_method_compatibility
            CHECK (
                measurement_method IS NULL
                OR (
                    measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO', 'PHYSICAL_MEASURING_TOOL', 'MANUAL_COUNT')
                    AND (
                        (test_id IN ('TST-SPR-10M', 'TST-SPR-30M') AND measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'))
                        OR (test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA') AND measurement_method = 'STOPWATCH_MANUAL')
                        OR (test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST') AND measurement_method = 'PHYSICAL_MEASURING_TOOL')
                        OR (test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02') AND measurement_method = 'MANUAL_COUNT')
                        OR (test_id NOT IN (
                            'TST-SPR-10M', 'TST-SPR-30M',
                            'TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA',
                            'TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST',
                            'TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02'
                        ))
                    )
                )
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

COMMIT;
