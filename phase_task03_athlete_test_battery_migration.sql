-- =============================================================================
-- CHUVATOR — TASK 03 & TASK 03.1: ASSESSMENT BATTERY PERSISTENCE & RLS HARDENING
-- Migration Artifact: public.athlete_test_results
-- =============================================================================
-- CATATAN PENTING (PRODUCTION SAFETY):
-- 1. File SQL ini adalah artefak skema database, fungsi otorisasi multi-tenant,
--    trigger integritas relasional, dan kebijakan Row Level Security (RLS) untuk
--    penyimpanan hasil pengukuran tes lapangan mentah (Assessment Battery).
-- 2. JANGAN dieksekusi secara otomatis oleh aplikasi frontend.
-- 3. Administrator database harus menerapkan file ini melalui Supabase SQL Editor
--    atau pipeline migrasi resmi setelah memverifikasi prasyarat tabel inti
--    (public.tenants, public.users_staff, public.academies, public.academy_classes,
--     public.coaches, public.students).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABEL UTAMA: public.athlete_test_results
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

    -- Status Validitas & Kalibrasi (Fase 1: Tanpa Konversi Skor Fiktif)
    attempt_status TEXT NOT NULL DEFAULT 'VALID'
        CHECK (attempt_status IN ('VALID', 'PARTIAL_VALID')),
    calibration_status TEXT NOT NULL DEFAULT 'PENDING_CALIBRATION'
        CHECK (calibration_status IN ('PENDING_CALIBRATION', 'READY_FOR_CALIBRATION', 'NEEDS_FURTHER_DESIGN')),
    converted_score NUMERIC NULL
        CHECK (converted_score IS NULL OR (converted_score >= 1 AND converted_score <= 100)),

    notes TEXT NULL DEFAULT '',
    surface_condition TEXT NULL DEFAULT 'Rumput Alami Standar',
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

-- -----------------------------------------------------------------------------
-- 2. FUNGSI KEAMANAN MULTI-TENANT & INTEGRITAS RELASIONAL (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

-- A. Resolusi Peran Anggota Tenant Murni (Tanpa Bypass Superadmin Platform)
-- Fasilitas Assessment Battery HANYA tersedia dalam konteks operasional tenant,
-- dan TIDAK boleh digunakan sebagai fitur operasional akun Superadmin/Platform Owner.
CREATE OR REPLACE FUNCTION public.get_strict_tenant_member_role(check_tenant_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_staff_role TEXT;
BEGIN
    IF check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN NULL;
    END IF;

    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN NULL;
    END IF;

    -- Blokir penggunaan operasional Assessment Battery oleh Platform Superadmin
    IF EXISTS (
        SELECT 1 FROM public.platform_superadmins ps
        WHERE ps.auth_uid::text = v_caller_uid
    ) THEN
        RETURN NULL;
    END IF;

    -- 1. Cek apakah pengguna adalah Owner resmi dari tenant aktif pada tabel public.tenants
    IF EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE (t.tenant_id::text = check_tenant_id OR t.id::text = check_tenant_id)
          AND t.owner_uid::text = v_caller_uid
          AND LOWER(COALESCE(t.status, 'active')) IN ('active', 'aktif')
    ) THEN
        RETURN 'owner';
    END IF;

    -- 2. Cek apakah pengguna adalah Staf/Pelatih aktif pada tabel public.users_staff
    SELECT LOWER(trim(s.role)) INTO v_staff_role
    FROM public.users_staff s
    WHERE s.tenant_id::text = check_tenant_id
      AND s.uid::text = v_caller_uid
      AND COALESCE(s.is_active, TRUE) = TRUE
      AND LOWER(COALESCE(s.status, 'active')) IN ('active', 'aktif')
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

-- B. Verifikasi Kepemilikan Relasional student_id, class_id, dan academy_id terhadap tenant_id
-- Mencegah penyisipan student_id milik Tenant B ke dalam baris bertanda tenant_id Tenant A.
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

    IF v_student_record.tenant_id <> trim(check_tenant_id) THEN
        RETURN FALSE;
    END IF;

    -- Jika class_id disertakan, wajib milik tenant yang sama
    IF check_class_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.academy_classes c
            WHERE c.id = check_class_id
              AND c.tenant_id::text = trim(check_tenant_id)
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Jika academy_id disertakan, wajib milik tenant yang sama
    IF check_academy_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.academies a
            WHERE a.id = check_academy_id
              AND a.tenant_id::text = trim(check_tenant_id)
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

-- C. Verifikasi Cakupan Hak Akses Pelatih (Coach Scope) terhadap Atlet yang Dikelolanya
-- Owner & Admin tenant memiliki akses ke seluruh atlet dalam tenant-nya.
-- Pelatih (Coach) memiliki akses ke atlet dalam tenant-nya yang berada pada akademi/kelas
-- yang dikelolanya (jika profil pelatih di public.coaches terikat ke akademi/kelas tertentu).
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

    -- Owner dan Admin tenant berwenang penuh atas seluruh atlet pada tenant tersebut
    IF v_role IN ('owner', 'admin') THEN
        RETURN public.athlete_belongs_to_tenant(check_student_id, check_tenant_id, check_class_id, NULL);
    END IF;

    -- Hanya role coach yang diizinkan di luar owner/admin untuk menulis hasil tes
    IF v_role <> 'coach' THEN
        RETURN FALSE;
    END IF;

    -- Pastikan atlet benar-benar milik tenant tersebut
    IF NOT public.athlete_belongs_to_tenant(check_student_id, check_tenant_id, check_class_id, NULL) THEN
        RETURN FALSE;
    END IF;

    v_caller_uid := auth.uid()::text;

    -- Cek apakah pelatih memiliki record spesifik pada tabel public.coaches
    SELECT c.id, c.academy_id
    INTO v_coach_id, v_coach_academy_id
    FROM public.coaches c
    WHERE c.tenant_id::text = trim(check_tenant_id)
      AND c.auth_uid::text = v_caller_uid
    LIMIT 1;

    -- Jika pelatih belum ditautkan ke baris spesifik di public.coaches, izinkan selama satu tenant
    IF v_coach_id IS NULL THEN
        RETURN TRUE;
    END IF;

    SELECT s.academy_id, s.class_id
    INTO v_student_academy_id, v_student_class_id
    FROM public.students s
    WHERE s.id = check_student_id
      AND s.tenant_id::text = trim(check_tenant_id)
    LIMIT 1;

    -- Jika pelatih terikat ke academy_id tertentu dan atlet memiliki academy_id, wajib cocok
    IF v_coach_academy_id IS NOT NULL AND v_student_academy_id IS NOT NULL THEN
        IF v_coach_academy_id <> v_student_academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Jika pelatih ditugaskan ke kelas-kelas spesifik pada academy_classes, periksa kesesuaian kelas atlet
    SELECT EXISTS (
        SELECT 1 FROM public.academy_classes cls
        WHERE cls.tenant_id::text = trim(check_tenant_id)
          AND cls.coach_id = v_coach_id
          AND COALESCE(cls.is_archived, FALSE) = FALSE
    ) INTO v_has_assigned_classes;

    IF v_has_assigned_classes AND COALESCE(check_class_id, v_student_class_id) IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.academy_classes cls
            WHERE cls.id = COALESCE(check_class_id, v_student_class_id)
              AND cls.tenant_id::text = trim(check_tenant_id)
              AND (cls.coach_id = v_coach_id OR cls.coach_id IS NULL)
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. TRIGGER VALIDASI INTEGRITAS LINTAS-TABEL & PROTEKSI KOLOM
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
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
        NEW.updated_at := NOW();
    END IF;

    -- Pastikan student_id, class_id, dan academy_id benar-benar milik NEW.tenant_id
    IF NOT public.athlete_belongs_to_tenant(NEW.student_id, NEW.tenant_id, NEW.class_id, NEW.academy_id) THEN
        RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): student_id %, class_id %, atau academy_id % bukan milik tenant %.',
            NEW.student_id, NEW.class_id, NEW.academy_id, NEW.tenant_id
            USING ERRCODE = '42501';
    END IF;

    -- Jika auth.uid() tersedia (eksekusi dari sesi terautentikasi), paksa recorded_by_user_id sesuai sesi
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
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

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) — STRICT TENANT-ONLY ISOLATION
-- -----------------------------------------------------------------------------
ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;

-- Cabut hak akses tabel dari anon (pengguna tidak terautentikasi)
REVOKE ALL ON public.athlete_test_results FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_test_results TO authenticated;

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

-- =============================================================================
-- 5. INSTRUKSI PENERAPAN & VERIFIKASI UNTUK ADMINISTRATOR DATABASE
-- =============================================================================
-- Langkah Penerapan:
--   1. Buka Supabase Dashboard -> SQL Editor pada project target.
--   2. Salin dan jalankan seluruh isi file `phase_task03_athlete_test_battery_migration.sql`.
--   3. Jalankan kueri verifikasi baca-saja berikut untuk memastikan tabel, trigger,
--      dan kebijakan RLS telah aktif:
--
--      SELECT schemaname, tablename, rowsecurity, forcerowsecurity
--      FROM pg_tables
--      WHERE schemaname = 'public' AND tablename = 'athlete_test_results';
--
--      SELECT policyname, cmd, roles, qual, with_check
--      FROM pg_policies
--      WHERE schemaname = 'public' AND tablename = 'athlete_test_results';
-- =============================================================================
