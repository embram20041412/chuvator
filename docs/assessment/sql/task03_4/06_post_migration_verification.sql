-- =============================================================================
-- CHUVATOR — TASK 03.4: SUPABASE DATABASE MIGRATION READINESS
-- 06_post_migration_verification.sql (CATALOG AUDIT & ROLE SIMULATION SUITE)
-- =============================================================================
-- BAGIAN A: Kueri Verifikasi Katalog Read-Only (Aman dijalankan langsung).
-- BAGIAN B: Simulasi Pengujian Keamanan Berbasis Peran di dalam transaksi
--           NON-DESTRUKTIF (`BEGIN; ... ROLLBACK;`).
-- PRASYARAT BAGIAN B:
--   Harus dijalankan oleh role `postgres` / superuser pada Supabase SQL Editor
--   atau lingkungan staging agar `set_config('role', 'authenticated', true)`
--   dan `request.jwt.claims` dapat mensimulasikan setiap peran tanpa mengubah data.
-- =============================================================================

-- =============================================================================
-- BAGIAN A: READ-ONLY CATALOG VERIFICATION
-- =============================================================================

-- A1. Verifikasi Tabel, RLS, dan FORCE RLS
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    forcerowsecurity AS force_rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'athlete_test_results';

-- A2. Verifikasi Daftar Kolom & Tipe Data Tabel
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'athlete_test_results'
ORDER BY ordinal_position;

-- A3. Verifikasi Constraints & Indeks
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.athlete_test_results'::regclass
ORDER BY conname;

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'athlete_test_results'
ORDER BY indexname;

-- A4. Verifikasi Trigger
SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS enabled_mode,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'athlete_test_results'
  AND NOT t.tgisinternal;

-- A5. Verifikasi Fungsi SECURITY DEFINER, search_path, & Privilege Eksekusi
SELECT
    p.proname AS function_name,
    p.prosecdef AS is_security_definer,
    p.proconfig AS search_path_config,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'get_strict_tenant_member_role',
      'athlete_belongs_to_tenant',
      'coach_can_manage_student',
      'validate_and_protect_athlete_test_results'
  )
ORDER BY p.proname;

-- A6. Verifikasi Kebijakan RLS & Hak Akses Tabel per Role
SELECT
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'athlete_test_results'
ORDER BY policyname;

SELECT
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'athlete_test_results'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- =============================================================================
-- BAGIAN B: NON-DESTRUCTIVE ROLE-BASED VERIFICATION SUITE (BEGIN ... ROLLBACK)
-- =============================================================================
BEGIN;

DO $$
DECLARE
    -- Tenant Fixtures
    v_tenant_a TEXT := 't034-tenant-a-verify';
    v_tenant_b TEXT := 't034-tenant-b-verify';
    v_tenant_a_uuid UUID := '34000000-0000-4000-8000-00000000000a';
    v_tenant_b_uuid UUID := '34000000-0000-4000-8000-00000000000b';

    -- Actor UIDs
    v_superadmin_uid TEXT := '34000000-0000-4000-8000-000000000101';
    v_owner_a_uid    TEXT := '34000000-0000-4000-8000-000000000102';
    v_admin_a_uid    TEXT := '34000000-0000-4000-8000-000000000103';
    v_coach_a1_uid   TEXT := '34000000-0000-4000-8000-000000000104';
    v_coach_a2_uid   TEXT := '34000000-0000-4000-8000-000000000105';
    v_kasir_a_uid    TEXT := '34000000-0000-4000-8000-000000000106';
    v_staff_a_uid    TEXT := '34000000-0000-4000-8000-000000000107';
    v_outsider_uid   TEXT := '34000000-0000-4000-8000-000000000108';
    v_inactive_uid   TEXT := '34000000-0000-4000-8000-000000000109';

    -- Domain Fixtures
    v_acad_a UUID := '34000000-0000-4000-8000-000000000201';
    v_acad_b UUID := '34000000-0000-4000-8000-000000000202';
    v_coach_a1_id UUID := '34000000-0000-4000-8000-000000000301';
    v_coach_a2_id UUID := '34000000-0000-4000-8000-000000000302';
    v_class_a1_id UUID := '34000000-0000-4000-8000-000000000401';
    v_class_a2_id UUID := '34000000-0000-4000-8000-000000000402';
    v_class_b1_id UUID := '34000000-0000-4000-8000-000000000403';
    v_stu_a1_id   UUID := '34000000-0000-4000-8000-000000000501';
    v_stu_a2_id   UUID := '34000000-0000-4000-8000-000000000502';
    v_stu_b1_id   UUID := '34000000-0000-4000-8000-000000000503';

    v_res_owner_id UUID := '34000000-0000-4000-8000-000000000601';
    v_res_admin_id UUID := '34000000-0000-4000-8000-000000000602';
    v_res_coach_id UUID := '34000000-0000-4000-8000-000000000603';
    v_res_coach_vid_id UUID := '34000000-0000-4000-8000-000000000604';
    v_res_b_id     UUID := '34000000-0000-4000-8000-000000000605';

    v_count INT;
    v_sqlstate TEXT;
    v_sync_method TEXT;
    v_sync_period TEXT;
    v_sync_age_grp TEXT;
BEGIN
    -- 1. Pastikan tidak ada collision fixture pada tenants
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id IN (v_tenant_a_uuid, v_tenant_b_uuid)) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION: Tenant fixture UUID sudah ada di database.';
    END IF;

    -- 2. Siapkan fixture dalam peran postgres (sebelum switch ke authenticated)
    INSERT INTO public.platform_superadmins (auth_uid, email, notes)
    VALUES (v_superadmin_uid, 'verify-superadmin-t034@chuvator.test', 'Task 03.4 Rollback Test Fixture');

    INSERT INTO public.tenants (id, tenant_id, name, owner_uid, owner_email, status)
    VALUES
        (v_tenant_a_uuid, v_tenant_a, 'SSB Verify Tenant A', v_owner_a_uid, 'owner-a@chuvator.test', 'active'),
        (v_tenant_b_uuid, v_tenant_b, 'SSB Verify Tenant B', '34000000-0000-4000-8000-000000000199', 'owner-b@chuvator.test', 'active');

    INSERT INTO public.users_staff (uid, tenant_id, email, name, role, status, is_active)
    VALUES
        (v_admin_a_uid,  v_tenant_a, 'admin-a@chuvator.test',    'Admin A',    'admin',  'active', TRUE),
        (v_coach_a1_uid, v_tenant_a, 'coach-a1@chuvator.test',   'Coach A1',   'coach',  'active', TRUE),
        (v_coach_a2_uid, v_tenant_a, 'coach-a2@chuvator.test',   'Coach A2',   'coach',  'active', TRUE),
        (v_kasir_a_uid,  v_tenant_a, 'kasir-a@chuvator.test',    'Kasir A',    'kasir',  'active', TRUE),
        (v_staff_a_uid,  v_tenant_a, 'staff-a@chuvator.test',    'Staff A',    'staff',  'active', TRUE),
        (v_inactive_uid, v_tenant_a, 'inactive-a@chuvator.test', 'Inactive A', 'coach',  'inactive', FALSE);

    INSERT INTO public.academies (id, tenant_id, academy_name, name, sport)
    VALUES
        (v_acad_a, v_tenant_a, 'Akademi A', 'Akademi A', 'SepakBola'),
        (v_acad_b, v_tenant_b, 'Akademi B', 'Akademi B', 'SepakBola');

    INSERT INTO public.coaches (id, tenant_id, academy_id, name, auth_uid)
    VALUES
        (v_coach_a1_id, v_tenant_a, v_acad_a, 'Coach A1', v_coach_a1_uid),
        (v_coach_a2_id, v_tenant_a, v_acad_a, 'Coach A2', v_coach_a2_uid);

    INSERT INTO public.academy_classes (id, tenant_id, academy_id, class_name, coach_id)
    VALUES
        (v_class_a1_id, v_tenant_a, v_acad_a, 'Kelas U12 A1', v_coach_a1_id),
        (v_class_a2_id, v_tenant_a, v_acad_a, 'Kelas U14 A2', v_coach_a2_id),
        (v_class_b1_id, v_tenant_b, v_acad_b, 'Kelas U12 B1', NULL);

    INSERT INTO public.students (id, tenant_id, academy_id, class_id, student_name, birth_date)
    VALUES
        (v_stu_a1_id, v_tenant_a, v_acad_a, v_class_a1_id, 'Atlet A1', '2014-05-10'),
        (v_stu_a2_id, v_tenant_a, v_acad_a, v_class_a2_id, 'Atlet A2', '2012-03-14'),
        (v_stu_b1_id, v_tenant_b, v_acad_b, v_class_b1_id, 'Atlet B1', '2014-07-20');

    -- Seed 1 record milik Tenant B sebagai target isolasi lintas-tenant
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES (
        v_res_b_id, v_tenant_b, v_acad_b, v_class_b1_id, v_stu_b1_id,
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-01', 'MULTI_TRIAL_BEST_MIN', 2.05, 's',
        '2.05 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"ageGroup":"U-12","ageYearsAtTest":12}}'::jsonb
    );

    -- Switch ke role `authenticated` untuk menguji RLS nyata
    PERFORM set_config('role', 'authenticated', true);

    -- =========================================================================
    -- TEST 1: TENANT OWNER (INSERT, SELECT, UPDATE, DELETE pada Tenant A + Sync Kolom)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);

    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id,
        test_id, indicator_id, indicator_name, category_id, development_tier,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES (
        v_res_owner_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical', 'TIER_2_FOUNDATION',
        '2026-10-15', 'MULTI_TRIAL_BEST_MIN', 2.12, 's',
        '2.12 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"ageGroup":"U-12","ageYearsAtTest":12}}'::jsonb
    );

    SELECT measurement_method, test_period, age_group
    INTO v_sync_method, v_sync_period, v_sync_age_grp
    FROM public.athlete_test_results WHERE id = v_res_owner_id;

    IF v_sync_method <> 'STOPWATCH_MANUAL' OR v_sync_period <> '2026-10' OR v_sync_age_grp <> 'U-12' THEN
        RAISE EXCEPTION 'FAIL TEST 1: Sinkronisasi trigger kolom konteks gagal (% / % / %).', v_sync_method, v_sync_period, v_sync_age_grp;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL TEST 1B: Owner A dapat melihat data Tenant B.';
    END IF;

    -- =========================================================================
    -- TEST 2: TENANT ADMIN (INSERT & UPDATE pada Tenant A)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_a_uid, 'role', 'authenticated')::text, true);

    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES (
        v_res_admin_id, v_tenant_a, v_acad_a, v_class_a2_id, v_stu_a2_id,
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-16', 'MULTI_TRIAL_BEST_MIN', 1.98, 's',
        '1.98 s', 'MIN', '{"measurementMethod":"SMARTPHONE_VIDEO","athleteTestContext":{"ageGroup":"U-14","ageYearsAtTest":14}}'::jsonb
    );

    UPDATE public.athlete_test_results SET notes = 'Verifikasi Admin OK' WHERE id = v_res_admin_id;

    -- =========================================================================
    -- TEST 3: COACH DALAM CAKUPAN KELAS (Class A1 -> Student A1) + Multi-Metode Longitudinal
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coach_a1_uid, 'role', 'authenticated')::text, true);

    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, coach_id,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES
    (
        v_res_coach_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, v_coach_a1_id,
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-20', 'MULTI_TRIAL_BEST_MIN', 2.09, 's',
        '2.09 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
    ),
    (
        v_res_coach_vid_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, v_coach_a1_id,
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-20', 'MULTI_TRIAL_BEST_MIN', 2.21, 's',
        '2.21 s', 'MIN', '{"measurementMethod":"SMARTPHONE_VIDEO"}'::jsonb
    );

    -- =========================================================================
    -- TEST 4: COACH DI LUAR CAKUPAN KELAS (Termasuk Anti-Spoofing class_id A1 untuk Siswa A2)
    -- =========================================================================
    v_sqlstate := NULL;
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a2_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-21', 'MULTI_TRIAL_BEST_MIN', 2.01, 's',
            '2.01 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 4: Coach A1 berhasil menyisipkan hasil untuk atlet di kelas A2!';
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_sqlstate := SQLSTATE;
    END;

    -- =========================================================================
    -- TEST 5: KASIR (SELECT boleh, INSERT/UPDATE/DELETE wajib 42501)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kasir_a_uid, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_a;
    IF v_count < 1 THEN
        RAISE EXCEPTION 'FAIL TEST 5A: Kasir tidak dapat membaca hasil tes tenant sendiri.';
    END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-22', 'MULTI_TRIAL_BEST_MIN', 2.00, 's', '2.00 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 5B: Kasir berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    -- =========================================================================
    -- TEST 6: STAFF (SELECT boleh, INSERT/UPDATE/DELETE wajib 42501)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_a_uid, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_a;
    IF v_count < 1 THEN
        RAISE EXCEPTION 'FAIL TEST 6A: Staff tidak dapat membaca hasil tes tenant sendiri.';
    END IF;

    BEGIN
        DELETE FROM public.athlete_test_results WHERE id = v_res_owner_id;
        IF FOUND THEN
            RAISE EXCEPTION 'FAIL TEST 6B: Staff berhasil DELETE!';
        END IF;
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    -- =========================================================================
    -- TEST 7: SUPERADMIN / PLATFORM OWNER (Diblokir total SELECT & WRITE)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_superadmin_uid, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL TEST 7A: Superadmin masih dapat membaca % baris athlete_test_results.', v_count;
    END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-23', 'MULTI_TRIAL_BEST_MIN', 2.00, 's', '2.00 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 7B: Superadmin berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    -- =========================================================================
    -- TEST 8: PENGGUNA TANPA KEANGGOTAAN AKTIF / INACTIVE STAFF / SPOOFING student_id
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider_uid, 'role', 'authenticated')::text, true);
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL TEST 8A: Outsider dapat membaca data.';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_inactive_uid, 'role', 'authenticated')::text, true);
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL TEST 8B: Staff non-aktif dapat membaca data.';
    END IF;

    -- Spoofing student_id Tenant B dengan tenant_id Tenant A oleh Owner A harus ditolak
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_b1_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-24', 'MULTI_TRIAL_BEST_MIN', 2.00, 's', '2.00 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 8C: Spoofing student_id Tenant B ke Tenant A berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    -- Imutabilitas UPDATE tenant_id oleh Owner A harus ditolak oleh trigger
    BEGIN
        UPDATE public.athlete_test_results SET tenant_id = v_tenant_b WHERE id = v_res_owner_id;
        RAISE EXCEPTION 'FAIL TEST 8D: Mutasi tenant_id pada UPDATE berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    PERFORM set_config('role', 'postgres', true);
    RAISE NOTICE 'ALL 8 ROLE-BASED SECURITY & COMPATIBILITY VERIFICATION SCENARIOS PASSED (ROLLED BACK CLEANLY).';
END $$;

ROLLBACK;
