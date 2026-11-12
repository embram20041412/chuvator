-- =============================================================================
-- CHUVATOR — TASK 03: ASSESSMENT BATTERY FOUNDATION (PHASE 1 — RAW TEST DATA CAPTURE)
-- Migration Artifact: public.athlete_test_results
-- =============================================================================
-- CATATAN PENTING (PRODUCTION SAFETY):
-- File SQL ini adalah artefak skema dan kebijakan RLS untuk tabel penyimpanan
-- hasil pengukuran tes lapangan mentah (Assessment Battery / Scouting Combine).
-- JANGAN dieksekusi secara otomatis oleh aplikasi ke produksi tanpa persetujuan
-- penanggung jawab database.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.athlete_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    academy_id UUID NULL REFERENCES public.academies(id) ON DELETE SET NULL,
    class_id UUID NULL REFERENCES public.academy_classes(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    coach_id UUID NULL REFERENCES public.coaches(id) ON DELETE SET NULL,
    recorded_by_user_id UUID NULL,
    recorded_by_name TEXT NULL,

    -- Referensi Katalog Tes & Indikator Kanonik (Single Source of Truth)
    test_id TEXT NOT NULL,
    indicator_id TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    development_tier TEXT NULL,
    position_code TEXT NULL,

    -- Data Mentah & Percobaan (Trials)
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    input_schema_type TEXT NOT NULL DEFAULT 'MULTI_TRIAL',
    trials JSONB NOT NULL DEFAULT '[]'::jsonb,
    auxiliary_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Hasil Akhir Mentah & Metrik Turunan
    final_raw_value NUMERIC NULL,
    final_unit TEXT NOT NULL,
    final_display_value TEXT NOT NULL,
    aggregation_method TEXT NOT NULL,
    derived_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Status Validitas & Kalibrasi (Fase 1: Tanpa Konversi Skor Fiktif)
    attempt_status TEXT NOT NULL DEFAULT 'VALID'
        CHECK (attempt_status IN ('VALID', 'PARTIAL_VALID')),
    calibration_status TEXT NOT NULL DEFAULT 'PENDING_CALIBRATION'
        CHECK (calibration_status IN ('PENDING_CALIBRATION', 'READY_FOR_CALIBRATION', 'NEEDS_FURTHER_DESIGN')),
    converted_score NUMERIC NULL
        CHECK (converted_score IS NULL OR (converted_score >= 1 AND converted_score <= 100)),

    notes TEXT NULL DEFAULT '',
    surface_condition TEXT NULL DEFAULT 'Rumput Alami / Sintetis Standar',
    weather_notes TEXT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk query riwayat atlet per tenant, indikator, dan tanggal tes
CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_student_date
    ON public.athlete_test_results (tenant_id, student_id, test_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_indicator
    ON public.athlete_test_results (tenant_id, indicator_id, test_date DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_class
    ON public.athlete_test_results (tenant_id, class_id, test_date DESC);

-- Trigger proteksi mutasi kolom identitas tenant dan atlet pada UPDATE
CREATE OR REPLACE FUNCTION public.protect_athlete_test_results_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
        RAISE EXCEPTION 'Mutasi tenant_id pada athlete_test_results tidak diizinkan.';
    END IF;
    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
        RAISE EXCEPTION 'Mutasi student_id pada athlete_test_results tidak diizinkan.';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_athlete_test_results_columns ON public.athlete_test_results;
CREATE TRIGGER trg_protect_athlete_test_results_columns
    BEFORE UPDATE ON public.athlete_test_results
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_athlete_test_results_columns();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) — MULTI-TENANT ISOLATION
-- =============================================================================
ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS athlete_test_results_select_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_select_policy
    ON public.athlete_test_results
    FOR SELECT
    TO authenticated
    USING (
        public.is_superadmin()
        OR public.user_has_tenant_access(tenant_id::text)
    );

DROP POLICY IF EXISTS athlete_test_results_insert_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_insert_policy
    ON public.athlete_test_results
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_superadmin()
        OR public.user_can_manage_academy(tenant_id::text)
    );

DROP POLICY IF EXISTS athlete_test_results_update_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_update_policy
    ON public.athlete_test_results
    FOR UPDATE
    TO authenticated
    USING (
        public.is_superadmin()
        OR public.user_can_manage_academy(tenant_id::text)
    )
    WITH CHECK (
        public.is_superadmin()
        OR public.user_can_manage_academy(tenant_id::text)
    );

DROP POLICY IF EXISTS athlete_test_results_delete_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_delete_policy
    ON public.athlete_test_results
    FOR DELETE
    TO authenticated
    USING (
        public.is_superadmin()
        OR public.user_is_tenant_admin_or_owner(tenant_id::text)
    );
