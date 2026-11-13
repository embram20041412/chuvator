-- =============================================================================
-- CHUVATOR — TASK 03.4.3: CONSOLIDATED MASTER MIGRATION SQL (REMEDIATED)
-- 00_master_task03_4_assessment_battery_migration.sql
-- =============================================================================
-- TARGET        : Supabase PostgreSQL CHUVATOR (`public.athlete_test_results`)
-- STATUS        : READY FOR ADMIN EXECUTION (JANGAN DIEKSEKUSI OTOMATIS OLEH APP)
-- SIFAT         : Transaksional (BEGIN ... COMMIT), Idempoten, Non-Destruktif,
--                 Fail-Closed 100%, Backward-Compatible dengan Task 03 / 03.1 / 03.2 / 03.3.
-- URUTAN MODUL  :
--   [1] Dependency Preflight Gate (halting if core tables missing)
--   [2] Core Table (Immediate Fail-Closed RLS + REVOKE), Legacy Sanitization & Indexes
--   [3] Hardened Fail-Closed Security Functions, OWNER TO postgres, Anti-Spoofing Trigger & Safe Backfill
--   [4] Strict RLS Policies (Scope-Restricted Coach SELECT/WRITE) & Table Grants
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
-- [2] CORE TABLE, FAIL-CLOSED LOCKDOWN, OPTIONAL INDEXED CONTEXT COLUMNS & INDEXES
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

-- Fail-closed lockdown langsung setelah pembuatan tabel
ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon, authenticated;

-- Upgrade idempoten jika tabel sudah ada dari Task 03
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS measurement_method TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_years_at_test INTEGER NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS age_group TEXT NULL;
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS test_period TEXT NULL;

-- Lepas trigger lama sementara bila ada sebelum sanitasi konteks agar updated_at historis utuh
DROP TRIGGER IF EXISTS trg_protect_athlete_test_results_columns ON public.athlete_test_results;
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;

-- Sanitasi aman nilai legacy kosong / whitespace / non-kanonik pada kolom konteks sebelum constraint
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
-- [3] HARDENED SECURITY FUNCTIONS, OWNER, TRIGGER & SAFE BACKFILL
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
          AND LOWER(COALESCE(NULLIF(trim(t.status), ''), 'active')) IN ('active', 'aktif')
    ) THEN
        RETURN 'owner';
    END IF;

    SELECT LOWER(trim(s.role)) INTO v_staff_role
    FROM public.users_staff s
    WHERE s.tenant_id::text = trim(check_tenant_id)
      AND s.uid::text = v_caller_uid
      AND COALESCE((to_jsonb(s)->>'is_active')::boolean, FALSE) = TRUE
      AND LOWER(COALESCE(NULLIF(trim(s.status), ''), 'inactive')) IN ('active', 'aktif')
      AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE (t.tenant_id::text = trim(check_tenant_id) OR t.id::text = trim(check_tenant_id))
            AND COALESCE((to_jsonb(t)->>'is_active')::boolean, TRUE) = TRUE
            AND LOWER(COALESCE(NULLIF(trim(t.status), ''), 'active')) IN ('active', 'aktif')
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
    v_caller_role TEXT;
    v_caller_uid TEXT;
    v_coach_id UUID;
    v_coach_academy_id UUID;
    v_student_record RECORD;
    v_class_record RECORD;
BEGIN
    IF check_student_id IS NULL OR check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN FALSE;
    END IF;

    -- Cegah pemanggilan anonim dan cegah enumerasi RPC lintas-tenant dari klien terautentikasi
    IF current_user = 'anon' THEN
        RETURN FALSE;
    END IF;

    IF auth.uid() IS NOT NULL OR current_user = 'authenticated' THEN
        v_caller_role := public.get_strict_tenant_member_role(check_tenant_id);
        IF v_caller_role IS NULL THEN
            RETURN FALSE;
        END IF;
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

    IF check_academy_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.academies a
            WHERE a.id = check_academy_id
              AND trim(a.tenant_id::text) = trim(check_tenant_id)
        ) THEN
            RETURN FALSE;
        END IF;

        IF v_student_record.academy_id IS NOT NULL AND check_academy_id IS DISTINCT FROM v_student_record.academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    IF check_class_id IS NOT NULL THEN
        SELECT c.id, c.tenant_id::text AS tenant_id, c.academy_id
        INTO v_class_record
        FROM public.academy_classes c
        WHERE c.id = check_class_id
          AND trim(c.tenant_id::text) = trim(check_tenant_id)
        LIMIT 1;

        IF v_class_record.id IS NULL THEN
            RETURN FALSE;
        END IF;

        IF check_academy_id IS NOT NULL AND v_class_record.academy_id IS NOT NULL AND v_class_record.academy_id IS DISTINCT FROM check_academy_id THEN
            RETURN FALSE;
        END IF;

        IF v_student_record.academy_id IS NOT NULL AND v_class_record.academy_id IS NOT NULL AND v_class_record.academy_id IS DISTINCT FROM v_student_record.academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Untuk pemanggilan RPC langsung oleh Coach, batasi probing ke siswa dalam kelas aktif miliknya
    IF v_caller_role = 'coach' THEN
        v_caller_uid := auth.uid()::text;
        SELECT c.id, c.academy_id
        INTO v_coach_id, v_coach_academy_id
        FROM public.coaches c
        WHERE trim(c.tenant_id::text) = trim(check_tenant_id)
          AND NULLIF(trim(to_jsonb(c)->>'auth_uid'), '') = v_caller_uid
          AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
          AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
        LIMIT 1;

        IF v_coach_id IS NULL OR v_student_record.class_id IS NULL THEN
            RETURN FALSE;
        END IF;

        IF v_coach_academy_id IS NOT NULL AND v_student_record.academy_id IS NOT NULL AND v_coach_academy_id <> v_student_record.academy_id THEN
            RETURN FALSE;
        END IF;

        IF check_class_id IS NOT NULL AND check_class_id IS DISTINCT FROM v_student_record.class_id THEN
            RETURN FALSE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.academy_classes cls
            WHERE cls.id = v_student_record.class_id
              AND trim(cls.tenant_id::text) = trim(check_tenant_id)
              AND cls.coach_id = v_coach_id
              AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE
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
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN FALSE;
    END IF;

    -- Pelatih wajib memiliki profil aktif tertaut via auth_uid pada public.coaches (FAIL-CLOSED)
    SELECT c.id, c.academy_id
    INTO v_coach_id, v_coach_academy_id
    FROM public.coaches c
    WHERE trim(c.tenant_id::text) = trim(check_tenant_id)
      AND NULLIF(trim(to_jsonb(c)->>'auth_uid'), '') = v_caller_uid
      AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
      AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
    LIMIT 1;

    IF v_coach_id IS NULL THEN
        RETURN FALSE;
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

    IF v_student_class_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF check_class_id IS NOT NULL AND check_class_id IS DISTINCT FROM v_student_class_id THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.academy_classes cls
        WHERE cls.id = v_student_class_id
          AND trim(cls.tenant_id::text) = trim(check_tenant_id)
          AND cls.coach_id = v_coach_id
          AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE
    ) THEN
        RETURN FALSE;
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
    v_caller_role TEXT;
    v_caller_uid TEXT;
    v_caller_coach_id UUID;
    v_student_birth_date DATE;
    v_student_computed_age INTEGER;
    v_ctx_age_text TEXT;
    v_parsed_age INTEGER;
    v_raw_top_method TEXT;
    v_ctx_method TEXT;
    v_default_single_method TEXT;
    v_raw_age_group TEXT;
    v_ctx_age_group TEXT;
    v_json_changed BOOLEAN;
    v_method_json_changed BOOLEAN;
    v_age_group_json_changed BOOLEAN;
    v_age_years_json_changed BOOLEAN;
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
        IF NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id THEN
            RAISE EXCEPTION 'Mutasi recorded_by_user_id pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.recorded_by_name IS DISTINCT FROM OLD.recorded_by_name THEN
            RAISE EXCEPTION 'Mutasi recorded_by_name pada athlete_test_results dilarang.' USING ERRCODE = '42501';
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

    -- Validasi kepemilikan tenant dan status aktif untuk coach_id (anti spoofing lintas-tenant / lintas-pelatih)
    IF NEW.coach_id IS NOT NULL THEN
        IF TG_OP = 'INSERT' OR (NEW.coach_id IS DISTINCT FROM OLD.coach_id) THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.coaches c
                WHERE c.id = NEW.coach_id
                  AND trim(c.tenant_id::text) = trim(NEW.tenant_id)
                  AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
                  AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
            ) THEN
                RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): coach_id % tidak aktif atau bukan milik tenant %.',
                    NEW.coach_id, NEW.tenant_id
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            IF NOT EXISTS (
                SELECT 1 FROM public.coaches c
                WHERE c.id = NEW.coach_id
                  AND trim(c.tenant_id::text) = trim(NEW.tenant_id)
            ) THEN
                RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): coach_id % bukan milik tenant %.',
                    NEW.coach_id, NEW.tenant_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- Jika pemanggil adalah pengguna terautentikasi dengan peran coach, ikat/validasi coach_id miliknya sendiri
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_strict_tenant_member_role(NEW.tenant_id);
        IF v_caller_role = 'coach' THEN
            v_caller_uid := auth.uid()::text;
            SELECT c.id INTO v_caller_coach_id
            FROM public.coaches c
            WHERE trim(c.tenant_id::text) = trim(NEW.tenant_id)
              AND NULLIF(trim(to_jsonb(c)->>'auth_uid'), '') = v_caller_uid
              AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
              AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
            LIMIT 1;

            IF v_caller_coach_id IS NULL THEN
                RAISE EXCEPTION 'Akses ditolak (42501): Akun coach tidak memiliki profil aktif pada public.coaches.' USING ERRCODE = '42501';
            END IF;

            IF TG_OP = 'INSERT' THEN
                IF NEW.coach_id IS NULL THEN
                    NEW.coach_id := v_caller_coach_id;
                ELSIF NEW.coach_id <> v_caller_coach_id THEN
                    RAISE EXCEPTION 'Pelanggaran Keamanan (42501): Coach dilarang menyisipkan coach_id milik pelatih lain.' USING ERRCODE = '42501';
                END IF;
            ELSIF TG_OP = 'UPDATE' AND (NEW.coach_id IS DISTINCT FROM OLD.coach_id) THEN
                RAISE EXCEPTION 'Pelanggaran Keamanan (42501): Coach dilarang mengubah coach_id pada data hasil tes.' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
    END IF;

    IF NEW.test_date IS NOT NULL THEN
        NEW.test_period := to_char(NEW.test_date, 'YYYY-MM');
    END IF;

    -- Default metode tunggal standar untuk 16 tes non-dual-method saat INSERT jika tidak diisi (Task 03.5)
    v_default_single_method := CASE
        WHEN NEW.test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA')
            THEN 'STOPWATCH_MANUAL'
        WHEN NEW.test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST')
            THEN 'PHYSICAL_MEASURING_TOOL'
        WHEN NEW.test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02')
            THEN 'MANUAL_COUNT'
        ELSE NULL
    END;

    -- Normalisasi & Sinkronisasi measurement_method (INSERT maupun UPDATE saat derived_metrics/auxiliary_inputs berubah)
    v_raw_top_method := NULLIF(UPPER(trim(COALESCE(NEW.measurement_method, ''))), '');
    v_ctx_method := COALESCE(
        NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->>'measurementMethod', ''))), ''),
        NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), ''),
        NULLIF(UPPER(trim(COALESCE(NEW.auxiliary_inputs->>'measurementMethod', ''))), '')
    );
    v_json_changed := (TG_OP = 'INSERT')
        OR (NEW.derived_metrics IS DISTINCT FROM OLD.derived_metrics)
        OR (NEW.auxiliary_inputs IS DISTINCT FROM OLD.auxiliary_inputs);
    v_method_json_changed := (TG_OP = 'UPDATE') AND (
        NULLIF(UPPER(trim(COALESCE(OLD.derived_metrics->>'measurementMethod', ''))), '') IS DISTINCT FROM NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->>'measurementMethod', ''))), '')
        OR NULLIF(UPPER(trim(COALESCE(OLD.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), '') IS DISTINCT FROM NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), '')
        OR NULLIF(UPPER(trim(COALESCE(OLD.auxiliary_inputs->>'measurementMethod', ''))), '') IS DISTINCT FROM NULLIF(UPPER(trim(COALESCE(NEW.auxiliary_inputs->>'measurementMethod', ''))), '')
    );

    IF TG_OP = 'UPDATE' AND (NEW.measurement_method IS DISTINCT FROM OLD.measurement_method) THEN
        NEW.measurement_method := v_raw_top_method;
    ELSIF v_method_json_changed THEN
        IF NEW.test_id IN ('TST-SPR-10M', 'TST-SPR-30M') THEN
            IF v_ctx_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO') THEN
                NEW.measurement_method := v_ctx_method;
            ELSE
                NEW.measurement_method := NULL;
            END IF;
        ELSE
            NEW.measurement_method := v_ctx_method;
        END IF;
    ELSIF v_raw_top_method IS NOT NULL THEN
        NEW.measurement_method := v_raw_top_method;
    ELSIF v_json_changed AND v_ctx_method IS NOT NULL THEN
        IF NEW.test_id IN ('TST-SPR-10M', 'TST-SPR-30M') THEN
            IF v_ctx_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO') THEN
                NEW.measurement_method := v_ctx_method;
            ELSE
                NEW.measurement_method := NULL;
            END IF;
        ELSE
            NEW.measurement_method := v_ctx_method;
        END IF;
    ELSIF TG_OP = 'INSERT' AND NEW.measurement_method IS NULL AND v_ctx_method IS NULL AND v_default_single_method IS NOT NULL THEN
        NEW.measurement_method := v_default_single_method;
    ELSE
        NEW.measurement_method := NULL;
    END IF;

    -- Normalisasi & Sinkronisasi age_group (INSERT maupun UPDATE saat derived_metrics berubah)
    v_raw_age_group := NULLIF(trim(COALESCE(NEW.age_group, '')), '');
    v_ctx_age_group := NULLIF(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'ageGroup', '')), '');
    v_age_group_json_changed := (TG_OP = 'UPDATE') AND (
        NULLIF(trim(COALESCE(OLD.derived_metrics->'athleteTestContext'->>'ageGroup', '')), '')
        IS DISTINCT FROM v_ctx_age_group
    );

    IF TG_OP = 'UPDATE' AND (NEW.age_group IS DISTINCT FROM OLD.age_group) THEN
        NEW.age_group := v_raw_age_group;
    ELSIF v_age_group_json_changed THEN
        NEW.age_group := v_ctx_age_group;
    ELSIF v_raw_age_group IS NOT NULL THEN
        NEW.age_group := v_raw_age_group;
    ELSE
        NEW.age_group := v_ctx_age_group;
    END IF;

    -- Sinkronisasi age_years_at_test (prioritas konteks eksplisit 3..65 -> fallback students.birth_date pada test_date)
    v_ctx_age_text := NULLIF(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'ageYearsAtTest', '')), '');
    v_parsed_age := NULL;
    IF v_ctx_age_text IS NOT NULL AND v_ctx_age_text ~ '^\d{1,2}$' THEN
        IF v_ctx_age_text::integer BETWEEN 3 AND 65 THEN
            v_parsed_age := v_ctx_age_text::integer;
        END IF;
    END IF;

    v_age_years_json_changed := (TG_OP = 'UPDATE') AND (
        NULLIF(trim(COALESCE(OLD.derived_metrics->'athleteTestContext'->>'ageYearsAtTest', '')), '')
        IS DISTINCT FROM v_ctx_age_text
    );

    IF TG_OP = 'UPDATE' AND (NEW.age_years_at_test IS DISTINCT FROM OLD.age_years_at_test) THEN
        NULL;
    ELSIF v_age_years_json_changed THEN
        NEW.age_years_at_test := v_parsed_age;
    ELSIF NEW.age_years_at_test IS NULL OR (TG_OP = 'UPDATE' AND NEW.test_date IS DISTINCT FROM OLD.test_date) THEN
        IF v_parsed_age IS NOT NULL AND NOT (TG_OP = 'UPDATE' AND NEW.test_date IS DISTINCT FROM OLD.test_date) THEN
            NEW.age_years_at_test := v_parsed_age;
        ELSE
            SELECT s.birth_date INTO v_student_birth_date
            FROM public.students s
            WHERE s.id = NEW.student_id
            LIMIT 1;

            IF v_student_birth_date IS NOT NULL AND NEW.test_date IS NOT NULL THEN
                v_student_computed_age := EXTRACT(YEAR FROM age(NEW.test_date, v_student_birth_date))::integer;
                IF v_student_computed_age BETWEEN 3 AND 65 THEN
                    NEW.age_years_at_test := v_student_computed_age;
                ELSE
                    NEW.age_years_at_test := v_parsed_age;
                END IF;
            ELSE
                NEW.age_years_at_test := v_parsed_age;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Kepemilikan eksplisit fungsi SECURITY DEFINER & pembatasan hak eksekusi
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        BEGIN
            ALTER FUNCTION public.get_strict_tenant_member_role(TEXT) OWNER TO postgres;
            ALTER FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) OWNER TO postgres;
            ALTER FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) OWNER TO postgres;
            ALTER FUNCTION public.validate_and_protect_athlete_test_results() OWNER TO postgres;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Catatan Admin: Role eksekutor (%) bukan anggota role postgres; pastikan fungsi SECURITY DEFINER dijalankan oleh role berkemampuan BYPASSRLS.', current_user;
        END;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_strict_tenant_member_role(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_strict_tenant_member_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) TO authenticated;

-- Lepas trigger SEBELUM backfill agar updated_at historis tidak pernah tertimpa
DROP TRIGGER IF EXISTS trg_protect_athlete_test_results_columns ON public.athlete_test_results;
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;

-- Backfill aman konteks terindeks untuk baris eksisting (memakai nested CASE untuk safety cast integer)
UPDATE public.athlete_test_results
SET
    test_period = COALESCE(test_period, to_char(test_date, 'YYYY-MM')),
    measurement_method = COALESCE(
        NULLIF(UPPER(trim(measurement_method)), ''),
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
        NULLIF(trim(age_group), ''),
        NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageGroup'), '')
    ),
    age_years_at_test = COALESCE(
        age_years_at_test,
        CASE
            WHEN NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageYearsAtTest'), '') ~ '^\d{1,2}$' THEN
                CASE
                    WHEN NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageYearsAtTest'), '')::integer BETWEEN 3 AND 65
                    THEN NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageYearsAtTest'), '')::integer
                    ELSE NULL
                END
            ELSE NULL
        END
    )
WHERE test_period IS NULL
   OR (measurement_method IS NULL AND (
       derived_metrics ? 'measurementMethod'
       OR derived_metrics->'athleteTestContext' ? 'measurementMethod'
       OR auxiliary_inputs ? 'measurementMethod'
   ))
   OR (measurement_method IS NOT NULL AND trim(measurement_method) = '')
   OR (age_group IS NULL AND derived_metrics->'athleteTestContext' ? 'ageGroup')
   OR (age_group IS NOT NULL AND trim(age_group) = '')
   OR (age_years_at_test IS NULL AND derived_metrics->'athleteTestContext' ? 'ageYearsAtTest');

-- Pasang trigger proteksi SETELAH backfill selesai
CREATE TRIGGER trg_validate_and_protect_athlete_test_results
    BEFORE INSERT OR UPDATE ON public.athlete_test_results
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_and_protect_athlete_test_results();

-- -----------------------------------------------------------------------------
-- [4] STRICT RLS POLICIES & LEAST-PRIVILEGE TABLE GRANTS
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
        (
            public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'staff', 'kasir')
            AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        )
        OR (
            public.get_strict_tenant_member_role(tenant_id::text) = 'coach'
            AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
            AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
        )
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
