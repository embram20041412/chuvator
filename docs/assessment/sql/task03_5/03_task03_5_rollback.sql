-- =============================================================================
-- CHUVATOR — TASK 03.5.5: EXACT PRODUCTION BASELINE RESTORATION & ROLLBACK SCRIPT
-- 03_task03_5_rollback.sql
-- =============================================================================
-- AUTHORITATIVE PRODUCTION BASELINE METADATA:
--   - Function              : public.validate_and_protect_athlete_test_results()
--   - Owner                 : postgres
--   - SECURITY DEFINER      : true
--   - search_path           : public, extensions, pg_temp
--   - Baseline MD5          : c4f37f81c56d05486bfde58fd645971f
--   - Captured Timestamp    : 2026-11-13 08:29:33.18679+00
--   - Raw Baseline ACL      : {postgres=X/postgres,service_role=X/postgres}
--     * postgres            : EXECUTE (NOT GRANTABLE)
--     * service_role        : EXECUTE (NOT GRANTABLE)
--     * authenticated       : NO EXECUTE
--     * anon                : NO EXECUTE
--     * PUBLIC              : NO EXECUTE
--
-- JAMINAN NON-DESTRUKTIF & FAIL-CLOSED:
--   - Verifikasi identitas objek & hash definisi baseline (c4f37f81c56d05486bfde58fd645971f)
--     dijalankan pada langkah [A] SEBELUM mutasi skema apa pun dilakukan.
--   - TIDAK melakukan DROP TABLE, TRUNCATE, atau DELETE terhadap data hasil tes
--     pada `public.athlete_test_results`.
--   - TIDAK menghapus atau melemahkan RLS policies maupun table grants pada
--     `public.athlete_test_results`.
--   - TIDAK mengubah fungsi keamanan tenant Task 03.4 (`get_strict_tenant_member_role`,
--     `athlete_belongs_to_tenant`, `coach_can_manage_student`).
--   - Membatalkan seluruh transaksi (ROLLBACK otomatis) jika salah satu verifikasi
--     pra-mutasi maupun pasca-restorasi gagal.
-- =============================================================================

BEGIN;

-- [A] Preflight & Pre-Mutation Baseline Hash Verification Gate
--     Memverifikasi keberadaan fungsi/objek saat ini dan membuktikan bahwa definisi
--     fungsi baseline yang disuplai menghasilkan MD5 c4f37f81c56d05486bfde58fd645971f
--     SEBELUM perubahan skema apa pun dijalankan.
DO $$
DECLARE
    v_expected_baseline_md5 CONSTANT TEXT := 'c4f37f81c56d05486bfde58fd645971f';
    v_fn_oid OID;
    v_baseline_header TEXT;
    v_baseline_prosrc_lf TEXT;
    v_baseline_prosrc_crlf TEXT;
    v_canonical_baseline_def TEXT;
    v_computed_baseline_md5 TEXT;
BEGIN
    -- 1. Pastikan tabel target dan fungsi trigger terinstal saat ini ada
    IF to_regclass('public.athlete_test_results') IS NULL THEN
        RAISE EXCEPTION 'ROLLBACK DIBATALKAN (PRE-MUTATION): Tabel public.athlete_test_results tidak ditemukan.'
            USING ERRCODE = '42P01';
    END IF;

    v_fn_oid := to_regprocedure('public.validate_and_protect_athlete_test_results()');
    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION 'ROLLBACK DIBATALKAN (PRE-MUTATION): Fungsi public.validate_and_protect_athlete_test_results() yang terinstal saat ini tidak ditemukan.'
            USING ERRCODE = '42883';
    END IF;

    -- 2. Pastikan fungsi helper keamanan Task 03.4 dan role target ACL tetap utuh
    IF to_regprocedure('public.get_strict_tenant_member_role(text)') IS NULL
       OR to_regprocedure('public.athlete_belongs_to_tenant(uuid,text,uuid,uuid)') IS NULL
       OR to_regprocedure('public.coach_can_manage_student(text,uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION 'ROLLBACK DIBATALKAN (PRE-MUTATION): Fungsi helper keamanan tenant Task 03.4 tidak lengkap.'
            USING ERRCODE = '42883';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        RAISE EXCEPTION 'ROLLBACK DIBATALKAN (PRE-MUTATION): Role wajib postgres atau service_role tidak ditemukan pada pg_roles.'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Verifikasi bahwa definisi baseline yang disuplai tidak kosong dan cocok dengan MD5 c4f37f81c56d05486bfde58fd645971f
    v_baseline_header :=
        'CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results()' || E'\n' ||
        ' RETURNS trigger' || E'\n' ||
        ' LANGUAGE plpgsql' || E'\n' ||
        ' SECURITY DEFINER' || E'\n' ||
        ' SET search_path TO ''public'', ''extensions'', ''pg_temp''' || E'\n' ||
        'AS $function$';

    v_baseline_prosrc_lf := $baseline_body$
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

    -- Pastikan student_id, class_id, dan academy_id milik NEW.tenant_id dan konsisten
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

    -- Paksa recorded_by_user_id sesuai auth.uid() saat INSERT dari sesi pengguna terautentikasi
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
    END IF;

    -- Sinkronkan test_period (YYYY-MM) secara deterministik dari test_date
    IF NEW.test_date IS NOT NULL THEN
        NEW.test_period := to_char(NEW.test_date, 'YYYY-MM');
    END IF;

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
        IF NEW.test_id = 'TST-SPR-10M' THEN
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
        IF NEW.test_id = 'TST-SPR-10M' THEN
            IF v_ctx_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO') THEN
                NEW.measurement_method := v_ctx_method;
            ELSE
                NEW.measurement_method := NULL;
            END IF;
        ELSE
            NEW.measurement_method := v_ctx_method;
        END IF;
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
        -- Pertahankan nilai eksplisit baru dari payload UPDATE (tetap dicek constraint 3..65)
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
$baseline_body$;

    IF NULLIF(BTRIM(v_baseline_prosrc_lf), '') IS NULL THEN
        RAISE EXCEPTION 'ROLLBACK DIBATALKAN (PRE-MUTATION): Definisi fungsi baseline kosong.'
            USING ERRCODE = '42883';
    END IF;

    v_baseline_prosrc_crlf := replace(replace(v_baseline_prosrc_lf, E'\r\n', E'\n'), E'\n', E'\r\n');
    v_canonical_baseline_def := v_baseline_header || v_baseline_prosrc_crlf || '$function$' || E'\n';
    v_computed_baseline_md5 := md5(v_canonical_baseline_def);

    IF v_computed_baseline_md5 IS DISTINCT FROM v_expected_baseline_md5 THEN
        RAISE EXCEPTION 'ROLLBACK DIBATALKAN SEBELUM MUTASI SKEMA: Hash definisi baseline yang disuplai (%) tidak cocok dengan MD5 baseline Production (%).',
            v_computed_baseline_md5, v_expected_baseline_md5
            USING ERRCODE = '42501';
    END IF;
END $$;

-- [B] Pemulihan Verbatim Fungsi Trigger Baseline Production (Task 03.4.3 Sebelum Task 03.5)
CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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

    -- Pastikan student_id, class_id, dan academy_id milik NEW.tenant_id dan konsisten
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

    -- Paksa recorded_by_user_id sesuai auth.uid() saat INSERT dari sesi pengguna terautentikasi
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
    END IF;

    -- Sinkronkan test_period (YYYY-MM) secara deterministik dari test_date
    IF NEW.test_date IS NOT NULL THEN
        NEW.test_period := to_char(NEW.test_date, 'YYYY-MM');
    END IF;

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
        IF NEW.test_id = 'TST-SPR-10M' THEN
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
        IF NEW.test_id = 'TST-SPR-10M' THEN
            IF v_ctx_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO') THEN
                NEW.measurement_method := v_ctx_method;
            ELSE
                NEW.measurement_method := NULL;
            END IF;
        ELSE
            NEW.measurement_method := v_ctx_method;
        END IF;
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
        -- Pertahankan nilai eksplisit baru dari payload UPDATE (tetap dicek constraint 3..65)
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
$function$;

-- Pastikan pg_proc.prosrc menyimpan line ending kanonik Production (CRLF pada body)
-- bila SQL Editor browser menormalisasi CRLF menjadi LF saat pengiriman statement di atas,
-- sehingga md5(pg_get_functiondef(...)) di PostgreSQL identik 100% dengan c4f37f81c56d05486bfde58fd645971f.
DO $$
DECLARE
    v_fn_oid OID := to_regprocedure('public.validate_and_protect_athlete_test_results()');
    v_prosrc TEXT;
BEGIN
    SELECT p.prosrc INTO v_prosrc
    FROM pg_proc p
    WHERE p.oid = v_fn_oid;

    IF v_prosrc IS NOT NULL AND position(E'\r\n' IN v_prosrc) = 0 THEN
        v_prosrc := replace(v_prosrc, E'\n', E'\r\n');
        EXECUTE
            'CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results()' || E'\n' ||
            ' RETURNS trigger' || E'\n' ||
            ' LANGUAGE plpgsql' || E'\n' ||
            ' SECURITY DEFINER' || E'\n' ||
            ' SET search_path TO ''public'', ''extensions'', ''pg_temp''' || E'\n' ||
            'AS $function$' || v_prosrc || '$function$';
    END IF;
END $$;

-- [C] Pemulihan Constraint Baseline Task 03.4 Sebelum Mencabut Constraint Task 03.5
DO $$
BEGIN
    IF to_regclass('public.athlete_test_results') IS NOT NULL
       AND NOT EXISTS (
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

ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility;

-- [D] Pemulihan Owner, SECURITY DEFINER, search_path, Exact ACL ({postgres=X/postgres,service_role=X/postgres}), & Trigger
ALTER FUNCTION public.validate_and_protect_athlete_test_results() OWNER TO postgres;
ALTER FUNCTION public.validate_and_protect_athlete_test_results() SECURITY DEFINER;
ALTER FUNCTION public.validate_and_protect_athlete_test_results() SET search_path TO 'public', 'extensions', 'pg_temp';

REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.validate_and_protect_athlete_test_results() TO postgres;
GRANT EXECUTE ON FUNCTION public.validate_and_protect_athlete_test_results() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;
CREATE TRIGGER trg_validate_and_protect_athlete_test_results
    BEFORE INSERT OR UPDATE ON public.athlete_test_results
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_and_protect_athlete_test_results();

-- [E] Verifikasi Pasca-Restorasi (Fail-Closed): MD5, Owner, SECURITY DEFINER, search_path, Exact ACL, & Trigger
DO $$
DECLARE
    v_expected_baseline_md5 CONSTANT TEXT := 'c4f37f81c56d05486bfde58fd645971f';
    v_expected_raw_acl CONSTANT TEXT := '{postgres=X/postgres,service_role=X/postgres}';
    v_fn_oid OID;
    v_actual_def TEXT;
    v_actual_md5 TEXT;
    v_owner TEXT;
    v_secdef BOOLEAN;
    v_config TEXT[];
    v_raw_acl TEXT;
    v_trig_active BOOLEAN;
    v_spr10m_chk_exists BOOLEAN;
    v_task035_chk_exists BOOLEAN;
BEGIN
    v_fn_oid := to_regprocedure('public.validate_and_protect_athlete_test_results()');
    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL: Fungsi public.validate_and_protect_athlete_test_results() tidak ditemukan.';
    END IF;

    v_actual_def := pg_get_functiondef(v_fn_oid);
    v_actual_md5 := md5(v_actual_def);

    IF v_actual_md5 IS DISTINCT FROM v_expected_baseline_md5 THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL (ROLLBACK OTOMATIS): MD5 definisi fungsi hasil rollback (%) tidak identik dengan baseline Production sebelum Task 03.5 (%).',
            v_actual_md5, v_expected_baseline_md5
            USING ERRCODE = '42501';
    END IF;

    SELECT pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig, p.proacl::text
    INTO v_owner, v_secdef, v_config, v_raw_acl
    FROM pg_proc p
    WHERE p.oid = v_fn_oid;

    IF v_owner IS DISTINCT FROM 'postgres'
       OR v_secdef IS NOT TRUE
       OR NOT ('search_path=public, extensions, pg_temp' = ANY(COALESCE(v_config, ARRAY[]::text[]))) THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL: Owner (%), SECURITY DEFINER (%), atau search_path (%) fungsi trigger tidak sesuai baseline Production.',
            v_owner, v_secdef, v_config
            USING ERRCODE = '42501';
    END IF;

    IF v_raw_acl IS DISTINCT FROM v_expected_raw_acl
       OR NOT has_function_privilege('postgres', v_fn_oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn_oid, 'EXECUTE')
       OR has_function_privilege('public', v_fn_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_fn_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL: ACL fungsi hasil rollback (%) tidak sesuai baseline Production (%).',
            v_raw_acl, v_expected_raw_acl
            USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'athlete_test_results'
          AND t.tgname = 'trg_validate_and_protect_athlete_test_results'
          AND t.tgfoid = v_fn_oid
          AND t.tgenabled <> 'D'
          AND NOT t.tgisinternal
    ) INTO v_trig_active;

    IF NOT v_trig_active THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL: Trigger trg_validate_and_protect_athlete_test_results tidak aktif pasca-rollback.'
            USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_spr10m_method'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) INTO v_spr10m_chk_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_measurement_method_compatibility'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) INTO v_task035_chk_exists;

    IF NOT v_spr10m_chk_exists OR v_task035_chk_exists THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL: Status constraint tabel tidak sesuai baseline Task 03.4 (spr10m=%, task035=%).',
            v_spr10m_chk_exists, v_task035_chk_exists
            USING ERRCODE = '42501';
    END IF;
END $$;

COMMIT;
