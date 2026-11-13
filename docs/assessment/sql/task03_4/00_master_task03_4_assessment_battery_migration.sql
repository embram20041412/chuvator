-- =============================================================================
-- CHUVATOR — TASK 03.4: CONSOLIDATED MASTER MIGRATION SQL
-- 00_master_task03_4_assessment_battery_migration.sql
-- =============================================================================
-- TARGET        : Supabase PostgreSQL CHUVATOR (`public.athlete_test_results`)
-- STATUS        : READY FOR ADMIN EXECUTION (JANGAN DIEKSEKUSI OTOMATIS OLEH APP)
-- SIFAT         : Transaksional (BEGIN ... COMMIT), Idempoten, Non-Destruktif,
--                 Backward-Compatible dengan Task 03 / 03.1 / 03.2 / 03.3.
-- URUTAN MODUL  :
--   [1] Dependency Preflight Gate (halting if core tables missing)
--   [2] Core Table, Indexed Context Columns & Performance Indexes
--   [3] Hardened Security Functions, Anti-Spoofing Coach Scope, Trigger & Function Grants
--   [4] Strict RLS Policies (ENABLE + FORCE RLS) & Table Grants
--   [5] Calibration Consistency & Longitudinal Compatibility Checks
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- [1] DEPENDENCY PREFLIGHT GATE
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- [2] CORE TABLE, OPTIONAL INDEXED CONTEXT COLUMNS & INDEXES
-- -----------------------------------------------------------------------------
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

-- Upgrade idempoten jika tabel sudah ada dari Task 03
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS measurement_method TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_years_at_test INTEGER NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_group TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS test_period TEXT NULL;

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

-- -----------------------------------------------------------------------------
-- [3] HARDENED SECURITY FUNCTIONS, TRIGGERS & FUNCTION GRANTS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_strict_tenant_member_role(check_tenant_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_staff_role TEXT;
    v_is_superadmin BOOLEAN := FALSE;
BEGIN
    IF check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN NULL;
    END IF;

    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.platform_superadmins ps
        WHERE ps.auth_uid::text = v_caller_uid
    ) THEN
        RETURN NULL;
    END IF;

    IF to_regprocedure('public.is_superadmin()') IS NOT NULL THEN
        EXECUTE 'SELECT COALESCE(public.is_superadmin(), FALSE)' INTO v_is_superadmin;
        IF v_is_superadmin THEN
            RETURN NULL;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE (t.tenant_id::text = trim(check_tenant_id) OR t.id::text = trim(check_tenant_id))
          AND t.owner_uid::text = v_caller_uid
          AND COALESCE((to_jsonb(t)->>'is_active')::boolean, TRUE) = TRUE
          AND LOWER(COALESCE(t.status, 'active')) IN ('active', 'aktif')
    ) THEN
        RETURN 'owner';
    END IF;

    SELECT LOWER(trim(s.role)) INTO v_staff_role
    FROM public.users_staff s
    WHERE s.tenant_id::text = trim(check_tenant_id)
      AND s.uid::text = v_caller_uid
      AND COALESCE((to_jsonb(s)->>'is_active')::boolean, FALSE) = TRUE
      AND LOWER(COALESCE(s.status, 'inactive')) IN ('active', 'aktif')
      AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE (t.tenant_id::text = trim(check_tenant_id) OR t.id::text = trim(check_tenant_id))
            AND COALESCE((to_jsonb(t)->>'is_active')::boolean, TRUE) = TRUE
            AND LOWER(COALESCE(t.status, 'active')) IN ('active', 'aktif')
      )
    LIMIT 1;

    IF v_staff_role IS NOT NULL THEN
        IF v_staff_role IN ('admin', 'administrator') THEN RETURN 'admin';
        ELSIF v_staff_role IN ('coach', 'pelatih') THEN RETURN 'coach';
        ELSIF v_staff_role IN ('kasir', 'cashier') THEN RETURN 'kasir';
        ELSIF v_staff_role IN ('staff', 'staf') THEN RETURN 'staff';
        ELSE RETURN NULL;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.athlete_belongs_to_tenant(
    check_student_id UUID,
    check_tenant_id TEXT,
    check_class_id UUID DEFAULT NULL,
    check_academy_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_student_record RECORD;
BEGIN
    IF check_student_id IS NULL OR check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN FALSE;
    END IF;

    SELECT s.id, s.tenant_id::text AS tenant_id, s.class_id, s.academy_id
    INTO v_student_record
    FROM public.students s
    WHERE s.id = check_student_id
    LIMIT 1;

    IF v_student_record.id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF trim(v_student_record.tenant_id) <> trim(check_tenant_id) THEN
        RETURN FALSE;
    END IF;

    IF check_class_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.academy_classes c
            WHERE c.id = check_class_id
              AND trim(c.tenant_id::text) = trim(check_tenant_id)
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    IF check_academy_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.academies a
            WHERE a.id = check_academy_id
              AND trim(a.tenant_id::text) = trim(check_tenant_id)
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_can_manage_student(
    check_tenant_id TEXT,
    check_student_id UUID,
    check_class_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_caller_uid TEXT;
    v_coach_id UUID;
    v_coach_academy_id UUID;
    v_student_academy_id UUID;
    v_student_class_id UUID;
    v_has_assigned_classes BOOLEAN := FALSE;
BEGIN
    v_role := public.get_strict_tenant_member_role(check_tenant_id);
    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_role IN ('owner', 'admin') THEN
        RETURN public.athlete_belongs_to_tenant(check_student_id, check_tenant_id, check_class_id, NULL);
    END IF;

    IF v_role <> 'coach' THEN
        RETURN FALSE;
    END IF;

    IF NOT public.athlete_belongs_to_tenant(check_student_id, check_tenant_id, check_class_id, NULL) THEN
        RETURN FALSE;
    END IF;

    v_caller_uid := auth.uid()::text;

    SELECT c.id, c.academy_id
    INTO v_coach_id, v_coach_academy_id
    FROM public.coaches c
    WHERE trim(c.tenant_id::text) = trim(check_tenant_id)
      AND (to_jsonb(c)->>'auth_uid') = v_caller_uid
    LIMIT 1;

    IF v_coach_id IS NULL THEN
        RETURN TRUE;
    END IF;

    SELECT s.academy_id, s.class_id
    INTO v_student_academy_id, v_student_class_id
    FROM public.students s
    WHERE s.id = check_student_id
      AND trim(s.tenant_id::text) = trim(check_tenant_id)
    LIMIT 1;

    IF v_coach_academy_id IS NOT NULL AND v_student_academy_id IS NOT NULL THEN
        IF v_coach_academy_id <> v_student_academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.academy_classes cls
        WHERE trim(cls.tenant_id::text) = trim(check_tenant_id)
          AND cls.coach_id = v_coach_id
          AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE
    ) INTO v_has_assigned_classes;

    IF v_has_assigned_classes THEN
        IF v_student_class_id IS NULL THEN
            RETURN FALSE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.academy_classes cls
            WHERE cls.id = v_student_class_id
              AND trim(cls.tenant_id::text) = trim(check_tenant_id)
              AND cls.coach_id = v_coach_id
        ) THEN
            RETURN FALSE;
        END IF;

        IF check_class_id IS NOT NULL AND check_class_id <> v_student_class_id THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.academy_classes cls
                WHERE cls.id = check_class_id
                  AND trim(cls.tenant_id::text) = trim(check_tenant_id)
                  AND cls.coach_id = v_coach_id
            ) THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_ctx_age_text TEXT;
    v_parsed_age INTEGER;
    v_ctx_method TEXT;
    v_ctx_age_group TEXT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Mutasi primary key (id) pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            RAISE EXCEPTION 'Mutasi tenant_id pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'Mutasi student_id pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Mutasi created_at pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF OLD.recorded_by_user_id IS NOT NULL AND NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id THEN
            RAISE EXCEPTION 'Mutasi recorded_by_user_id pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.test_id IS DISTINCT FROM OLD.test_id THEN
            RAISE EXCEPTION 'Mutasi test_id pada baris hasil tes yang sudah tersimpan dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.indicator_id IS DISTINCT FROM OLD.indicator_id THEN
            RAISE EXCEPTION 'Mutasi indicator_id pada baris hasil tes yang sudah tersimpan dilarang.' USING ERRCODE = '42501';
        END IF;
        NEW.updated_at := NOW();
    END IF;

    IF NOT public.athlete_belongs_to_tenant(NEW.student_id, NEW.tenant_id, NEW.class_id, NEW.academy_id) THEN
        RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): student_id %, class_id %, atau academy_id % bukan milik tenant %.',
            NEW.student_id, NEW.class_id, NEW.academy_id, NEW.tenant_id
            USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
    END IF;

    IF NEW.test_date IS NOT NULL THEN
        NEW.test_period := to_char(NEW.test_date, 'YYYY-MM');
    END IF;

    -- Sinkronkan measurement_method secara non-destruktif dari derived_metrics / auxiliary_inputs
    IF NEW.measurement_method IS NULL OR trim(NEW.measurement_method) = '' THEN
        v_ctx_method := COALESCE(
            NULLIF(trim(NEW.derived_metrics->>'measurementMethod'), ''),
            NULLIF(trim(NEW.derived_metrics->'athleteTestContext'->>'measurementMethod'), ''),
            NULLIF(trim(NEW.auxiliary_inputs->>'measurementMethod'), '')
        );
        IF v_ctx_method IS NOT NULL THEN
            IF NEW.test_id = 'TST-SPR-10M' THEN
                IF UPPER(v_ctx_method) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO') THEN
                    NEW.measurement_method := UPPER(v_ctx_method);
                END IF;
            ELSE
                NEW.measurement_method := UPPER(v_ctx_method);
            END IF;
        END IF;
    ELSE
        NEW.measurement_method := UPPER(trim(NEW.measurement_method));
    END IF;

    -- Sinkronkan age_group secara non-destruktif dari derived_metrics->'athleteTestContext'
    IF NEW.age_group IS NULL OR trim(NEW.age_group) = '' THEN
        v_ctx_age_group := NULLIF(trim(NEW.derived_metrics->'athleteTestContext'->>'ageGroup'), '');
        IF v_ctx_age_group IS NOT NULL THEN
            NEW.age_group := v_ctx_age_group;
        END IF;
    END IF;

    -- Sinkronkan age_years_at_test secara non-destruktif bila tersedia integer valid (3..65)
    IF NEW.age_years_at_test IS NULL THEN
        v_ctx_age_text := NULLIF(trim(NEW.derived_metrics->'athleteTestContext'->>'ageYearsAtTest'), '');
        IF v_ctx_age_text IS NOT NULL AND v_ctx_age_text ~ '^\d{1,2}$' THEN
            v_parsed_age := v_ctx_age_text::integer;
            IF v_parsed_age >= 3 AND v_parsed_age <= 65 THEN
                NEW.age_years_at_test := v_parsed_age;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_athlete_test_results_columns ON public.athlete_test_results;
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;

CREATE TRIGGER trg_validate_and_protect_athlete_test_results
    BEFORE INSERT OR UPDATE ON public.athlete_test_results
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_and_protect_athlete_test_results();

REVOKE ALL ON FUNCTION public.get_strict_tenant_member_role(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_strict_tenant_member_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) TO authenticated;

-- Backfill aman konteks terindeks untuk baris eksisting
UPDATE public.athlete_test_results
SET
    test_period = COALESCE(test_period, to_char(test_date, 'YYYY-MM')),
    measurement_method = COALESCE(
        measurement_method,
        CASE
            WHEN test_id = 'TST-SPR-10M' THEN
                CASE
                    WHEN UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
                    THEN UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), ''))
                    WHEN UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
                    THEN UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), ''))
                    WHEN UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), '')) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
                    THEN UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                    ELSE NULL
                END
            ELSE
                COALESCE(
                    UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')),
                    UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')),
                    UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                )
        END
    ),
    age_group = COALESCE(
        age_group,
        NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageGroup'), '')
    ),
    age_years_at_test = COALESCE(
        age_years_at_test,
        CASE
            WHEN (derived_metrics->'athleteTestContext'->>'ageYearsAtTest') ~ '^\d{1,2}$'
             AND (derived_metrics->'athleteTestContext'->>'ageYearsAtTest')::integer BETWEEN 3 AND 65
            THEN (derived_metrics->'athleteTestContext'->>'ageYearsAtTest')::integer
            ELSE NULL
        END
    )
WHERE test_period IS NULL
   OR (measurement_method IS NULL AND (
       derived_metrics ? 'measurementMethod'
       OR derived_metrics->'athleteTestContext' ? 'measurementMethod'
       OR auxiliary_inputs ? 'measurementMethod'
   ))
   OR (age_group IS NULL AND derived_metrics->'athleteTestContext' ? 'ageGroup')
   OR (age_years_at_test IS NULL AND derived_metrics->'athleteTestContext' ? 'ageYearsAtTest');

-- -----------------------------------------------------------------------------
-- [4] RLS POLICIES & LEAST-PRIVILEGE TABLE GRANTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.athlete_test_results TO authenticated;

DROP POLICY IF EXISTS athlete_test_results_select_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_select_policy
    ON public.athlete_test_results
    FOR SELECT
    TO authenticated
    USING (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach', 'staff', 'kasir')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
    );

DROP POLICY IF EXISTS athlete_test_results_insert_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_insert_policy
    ON public.athlete_test_results
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    );

DROP POLICY IF EXISTS athlete_test_results_update_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_update_policy
    ON public.athlete_test_results
    FOR UPDATE
    TO authenticated
    USING (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    )
    WITH CHECK (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    );

DROP POLICY IF EXISTS athlete_test_results_delete_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_delete_policy
    ON public.athlete_test_results
    FOR DELETE
    TO authenticated
    USING (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    );

-- -----------------------------------------------------------------------------
-- [5] CALIBRATION & SCORE ENGINE COMPATIBILITY
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_invalid_calibration_rows INTEGER := 0;
BEGIN
    SELECT COUNT(*)
    INTO v_invalid_calibration_rows
    FROM public.athlete_test_results
    WHERE NOT (
        (
            calibration_status = 'CALIBRATED'
            AND converted_score IS NOT NULL
            AND converted_score >= 1
            AND converted_score <= 100
        )
        OR (
            calibration_status IN ('PENDING_CALIBRATION', 'READY_FOR_CALIBRATION', 'NEEDS_FURTHER_DESIGN')
            AND converted_score IS NULL
        )
    );

    IF v_invalid_calibration_rows > 0 THEN
        RAISE EXCEPTION 'MIGRASI KALIBRASI DIHENTIKAN: Ditemukan % baris pada public.athlete_test_results dengan kombinasi calibration_status dan converted_score yang tidak konsisten.',
            v_invalid_calibration_rows
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_calibration_consistency'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_calibration_consistency
            CHECK (
                (
                    calibration_status = 'CALIBRATED'
                    AND converted_score IS NOT NULL
                    AND converted_score >= 1
                    AND converted_score <= 100
                )
                OR (
                    calibration_status IN ('PENDING_CALIBRATION', 'READY_FOR_CALIBRATION', 'NEEDS_FURTHER_DESIGN')
                    AND converted_score IS NULL
                )
            );
    END IF;
END $$;

COMMIT;
