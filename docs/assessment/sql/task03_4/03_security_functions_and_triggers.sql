-- =============================================================================
-- CHUVATOR — TASK 03.4: SUPABASE DATABASE MIGRATION READINESS
-- 03_security_functions_and_triggers.sql (SECURITY FUNCTIONS, TRIGGERS & PRIVILEGES)
-- =============================================================================
-- PENYEMPURNAAN KEAMANAN ATAS ARTIFAK TASK 03:
--   1. get_strict_tenant_member_role():
--      - Memblokir Superadmin baik via platform_superadmins maupun public.is_superadmin().
--      - Memeriksa status aktif tenant (`is_active` dan `status`) secara aman.
--      - Memeriksa status aktif staf (`COALESCE(s.is_active, FALSE) = TRUE` dan `status`).
--      - Menolak role 'owner'/'superadmin' yang disisipkan ilegal di users_staff.
--   2. athlete_belongs_to_tenant():
--      - Memastikan student_id, class_id, dan academy_id benar-benar milik tenant_id.
--   3. coach_can_manage_student():
--      - Memperketat validasi kelas pelatih: memeriksa kelas asli siswa (students.class_id)
--        MAUPUN check_class_id agar pelatih tidak dapat memalsukan class_id milik dirinya
--        untuk mengakses atlet dari kelas pelatih lain, serta menolak akses kelas tak bertuan
--        saat pelatih memiliki daftar kelas yang ditugaskan.
--   4. validate_and_protect_athlete_test_results():
--      - Mengunci kolom audit & identitas pada UPDATE: id, tenant_id, student_id,
--        created_at, recorded_by_user_id, test_id, indicator_id.
--      - Memaksa recorded_by_user_id = auth.uid() pada INSERT bila auth.uid() tersedia.
--      - Menyinkronkan kolom konteks terindeks (measurement_method, age_years_at_test,
--        age_group, test_period) secara otomatis dari derived_metrics & test_date tanpa
--        memodifikasi data percobaan mentah (`trials`, `final_raw_value`).
--   5. Pembatasan Hak Eksekusi Fungsi (REVOKE FROM PUBLIC, anon).
-- =============================================================================

-- A. Resolusi Peran Anggota Tenant Murni (Tanpa Bypass Superadmin Platform)
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

    -- 1. Blokir penggunaan operasional Assessment Battery oleh Platform Superadmin
    IF EXISTS (
        SELECT 1 FROM public.platform_superadmins ps
        WHERE ps.auth_uid::text = v_caller_uid
    ) THEN
        RETURN NULL;
    END IF;

    -- Sinkronisasi dengan fungsi kanonik is_superadmin() jika tersedia
    IF to_regprocedure('public.is_superadmin()') IS NOT NULL THEN
        EXECUTE 'SELECT COALESCE(public.is_superadmin(), FALSE)' INTO v_is_superadmin;
        IF v_is_superadmin THEN
            RETURN NULL;
        END IF;
    END IF;

    -- 2. Cek apakah pengguna adalah Owner resmi dari tenant aktif pada public.tenants
    IF EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE (t.tenant_id::text = trim(check_tenant_id) OR t.id::text = trim(check_tenant_id))
          AND t.owner_uid::text = v_caller_uid
          AND COALESCE((to_jsonb(t)->>'is_active')::boolean, TRUE) = TRUE
          AND LOWER(COALESCE(t.status, 'active')) IN ('active', 'aktif')
    ) THEN
        RETURN 'owner';
    END IF;

    -- 3. Cek keanggotaan staf/pelatih aktif pada public.users_staff (fail-closed)
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
        ELSE RETURN NULL; -- Menolak 'owner' / 'superadmin' yang disisipkan ke users_staff
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- B. Verifikasi Kepemilikan Relasional student_id, class_id, dan academy_id terhadap tenant_id
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

-- C. Verifikasi Cakupan Hak Akses Pelatih (Coach Scope) terhadap Atlet
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

    -- Selain owner/admin/coach (mis. kasir, staff) DILARANG melakukan mutasi data tes
    IF v_role <> 'coach' THEN
        RETURN FALSE;
    END IF;

    IF NOT public.athlete_belongs_to_tenant(check_student_id, check_tenant_id, check_class_id, NULL) THEN
        RETURN FALSE;
    END IF;

    v_caller_uid := auth.uid()::text;

    -- Ambil profil coach berdasarkan auth_uid (aman bila auth_uid belum tersedia di skema lama)
    SELECT c.id, c.academy_id
    INTO v_coach_id, v_coach_academy_id
    FROM public.coaches c
    WHERE trim(c.tenant_id::text) = trim(check_tenant_id)
      AND (to_jsonb(c)->>'auth_uid') = v_caller_uid
    LIMIT 1;

    -- Jika pelatih belum terikat ke record spesifik pada public.coaches, izinkan selama masih 1 tenant
    IF v_coach_id IS NULL THEN
        RETURN TRUE;
    END IF;

    SELECT s.academy_id, s.class_id
    INTO v_student_academy_id, v_student_class_id
    FROM public.students s
    WHERE s.id = check_student_id
      AND trim(s.tenant_id::text) = trim(check_tenant_id)
    LIMIT 1;

    -- 1. Cek batas academy_id pelatih vs akademi siswa
    IF v_coach_academy_id IS NOT NULL AND v_student_academy_id IS NOT NULL THEN
        IF v_coach_academy_id <> v_student_academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- 2. Cek apakah pelatih ditugaskan ke kelas-kelas aktif spesifik di academy_classes
    SELECT EXISTS (
        SELECT 1 FROM public.academy_classes cls
        WHERE trim(cls.tenant_id::text) = trim(check_tenant_id)
          AND cls.coach_id = v_coach_id
          AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE
    ) INTO v_has_assigned_classes;

    IF v_has_assigned_classes THEN
        -- Anti-spoofing: Cek kelas aktual siswa (v_student_class_id)
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

        -- Jika payload juga menyertakan class_id, wajib dimiliki oleh coach yang sama
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

-- D. Trigger Integritas Lintas-Tabel, Imutabilitas Audit, & Sinkronisasi Konteks Terindeks
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

    -- Pastikan student_id, class_id, dan academy_id milik NEW.tenant_id
    IF NOT public.athlete_belongs_to_tenant(NEW.student_id, NEW.tenant_id, NEW.class_id, NEW.academy_id) THEN
        RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): student_id %, class_id %, atau academy_id % bukan milik tenant %.',
            NEW.student_id, NEW.class_id, NEW.academy_id, NEW.tenant_id
            USING ERRCODE = '42501';
    END IF;

    -- Paksa recorded_by_user_id sesuai auth.uid() saat INSERT dari sesi pengguna terautentikasi
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
    END IF;

    -- Sinkronkan test_period (YYYY-MM) secara deterministik dari test_date
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
            NEW.measurement_method := UPPER(v_ctx_method);
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

-- E. Pembatasan Hak Eksekusi Fungsi (Least-Privilege Function Grants)
REVOKE ALL ON FUNCTION public.get_strict_tenant_member_role(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_strict_tenant_member_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) TO authenticated;

-- F. Backfill Aman & Idempoten untuk Baris Eksisting yang Belum Memiliki Kolom Konteks Terindeks
UPDATE public.athlete_test_results
SET
    test_period = COALESCE(test_period, to_char(test_date, 'YYYY-MM')),
    measurement_method = COALESCE(
        measurement_method,
        UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')),
        UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')),
        UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
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
