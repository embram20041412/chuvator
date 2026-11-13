-- =============================================================================
-- CHUVATOR — TASK 03.5.3: VERIFICATION SCRIPT (READ-ONLY + BEGIN ... ROLLBACK)
-- 02_task03_5_verification.sql
-- =============================================================================
-- CATATAN:
--   - Skrip ini TIDAK melakukan perubahan permanen (100% ROLLBACK).
--   - Bagian A: Audit katalog read-only (constraint, trigger aktif, 4 fungsi
--     keamanan, OWNER, search_path, grants, RLS, FORCE RLS, & distribusi test_id).
--   - Bagian B: Simulasi transaksional `BEGIN ... ROLLBACK` yang menguji seluruh
--     skenario wajib Task 03.5.3:
--       0. Pra-syarat skema, trigger aktif BEFORE INSERT OR UPDATE, OWNER = postgres,
--          SECURITY DEFINER, search_path, & least-privilege grants.
--       1. INSERT metode valid untuk seluruh 18 tes (termasuk dua metode untuk
--          TST-SPR-10M & TST-SPR-30M, serta auto-default untuk 16 tes tunggal).
--       2. INSERT dengan measurement_method NULL / whitespace pada dual-method (23514).
--       3. INSERT dengan metode tidak dikenal (23514) & konflik 3-jalur JSONB (23514).
--       4. INSERT dengan metode salah (23514) & test_id tidak terdaftar (23514).
--       5. (Digabung pada #2) INSERT dual-method tanpa pilihan eksplisit (23514).
--       6. Legacy NULL: update kolom lain tetap NULL; isi manual tanpa bersih JSONB
--          kontradiktif ditolak (23514); isi manual eksplisit valid/selaras berhasil.
--       7. UPDATE mengubah metode non-null menjadi NULL ditolak (23514).
--       8. Konsistensi Kolom–JSONB pada UPDATE (5 skenario + JSONB-tanpa-kolom +
--          konflik 3-jalur JSONB: derived_metrics, athleteTestContext, auxiliary_inputs).
--       9. Isolasi multi-tenant (lintas-tenant SELECT/WRITE/student_id ditolak).
--      10. Otorisasi lengkap: Coach in-class & out-of-class (SELECT/INSERT/UPDATE/DELETE),
--          Kasir (SELECT/INSERT/UPDATE/DELETE), dan Anon (SELECT/INSERT/UPDATE/DELETE).
--      11. Imutabilitas kolom audit & identitas (id, tenant_id, student_id,
--          created_at, recorded_by_user_id, recorded_by_name, test_id, indicator_id).
--      12. Pemeriksaan rollback non-destruktif constraint + status jujur baseline fungsi.
-- =============================================================================

-- BAGIAN A (READ-ONLY): Inspeksi Constraint, Trigger, Fungsi Keamanan, RLS & Data
SELECT
    conname,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.athlete_test_results'::regclass
  AND conname IN (
      'chk_athlete_test_results_spr10m_method',
      'chk_athlete_test_results_measurement_method_compatibility'
  )
ORDER BY conname;

SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS enabled_mode,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'athlete_test_results'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT
    p.proname AS function_name,
    pg_get_userbyid(p.proowner) AS owner_role,
    p.prosecdef AS is_security_definer,
    p.proconfig AS search_path_config,
    has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute,
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

SELECT
    t.schemaname,
    t.tablename,
    t.rowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename = 'athlete_test_results';

SELECT
    test_id,
    COALESCE(measurement_method, 'NULL (LEGACY)') AS measurement_method,
    COUNT(*) AS total_rows
FROM public.athlete_test_results
GROUP BY test_id, COALESCE(measurement_method, 'NULL (LEGACY)')
ORDER BY test_id, measurement_method;

-- Audit eksistensi test_id di luar katalog resmi 18 tes (jika ada pada data historis)
SELECT
    test_id,
    COUNT(*) AS total_rows
FROM public.athlete_test_results
WHERE test_id NOT IN (
    'TST-SPR-10M', 'TST-SPR-30M',
    'TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA',
    'TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST',
    'TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02'
)
GROUP BY test_id
ORDER BY test_id;

-- BAGIAN B (SIMULASI TRANSAKSIONAL BEGIN ... ROLLBACK)
BEGIN;

DO $$
DECLARE
    v_tenant_a TEXT := 't035-tenant-a-verify';
    v_tenant_b TEXT := 't035-tenant-b-verify';
    v_tenant_a_uuid UUID := '35000000-0000-4000-8000-00000000000a';
    v_tenant_b_uuid UUID := '35000000-0000-4000-8000-00000000000b';

    v_owner_a_uid TEXT := '35000000-0000-4000-8000-000000000101';
    v_owner_b_uid TEXT := '35000000-0000-4000-8000-000000000102';
    v_coach_a1_uid UUID := '35000000-0000-4000-8000-000000000103';
    v_coach_a2_uid UUID := '35000000-0000-4000-8000-000000000104';
    v_kasir_a_uid TEXT := '35000000-0000-4000-8000-000000000105';

    v_acad_a UUID := '35000000-0000-4000-8000-000000000201';
    v_acad_b UUID := '35000000-0000-4000-8000-000000000202';
    v_coach_a1_id UUID := '35000000-0000-4000-8000-000000000301';
    v_coach_a2_id UUID := '35000000-0000-4000-8000-000000000302';
    v_class_a1_id UUID := '35000000-0000-4000-8000-000000000401';
    v_class_a2_id UUID := '35000000-0000-4000-8000-000000000402';
    v_class_b1_id UUID := '35000000-0000-4000-8000-000000000403';
    v_stu_a1_id UUID := '35000000-0000-4000-8000-000000000501';
    v_stu_a2_id UUID := '35000000-0000-4000-8000-000000000502';
    v_stu_b1_id UUID := '35000000-0000-4000-8000-000000000503';

    v_res_id UUID := '35000000-0000-4000-8000-000000000601';
    v_res_dual_id UUID := '35000000-0000-4000-8000-000000000602';
    v_legacy_id UUID := '35000000-0000-4000-8000-000000000603';
    v_res_b_id UUID := '35000000-0000-4000-8000-000000000604';
    v_res_coach_id UUID := '35000000-0000-4000-8000-000000000605';
    v_res_a2_id UUID := '35000000-0000-4000-8000-000000000606';
    v_res_coach_del_id UUID := '35000000-0000-4000-8000-000000000607';
    v_res_clean_dual_id UUID := '35000000-0000-4000-8000-000000000608';
    v_legacy_clean_id UUID := '35000000-0000-4000-8000-000000000609';
    v_res_agl_id UUID := '35000000-0000-4000-8000-00000000060a';
    v_res_aux_only_id UUID := '35000000-0000-4000-8000-00000000060b';

    v_has_tenants_is_active BOOLEAN;
    v_has_staff_is_active BOOLEAN;
    v_auth_missing_req_cols TEXT;
    v_fn_oid OID;
    v_fn_owner TEXT;
    v_fn_secdef BOOLEAN;
    v_fn_config TEXT[];
    v_trig_def TEXT;
    v_method TEXT;
    v_dm_val TEXT;
    v_ctx_val TEXT;
    v_aux_val TEXT;
    v_count INT;
    v_before_rows INT;
    v_after_rows INT;
    v_policy_count INT;
    v_affected INT;
    v_spr10m_old_def TEXT;
    v_test RECORD;
BEGIN
    -- =========================================================================
    -- 0. PRA-SYARAT SKEMA, OWNERSHIP, SECURITY DEFINER, GRANTS & TRIGGER AKTIF
    -- =========================================================================
    SELECT COALESCE(string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position), '')
    INTO v_auth_missing_req_cols
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND is_nullable = 'NO'
      AND column_default IS NULL
      AND is_identity = 'NO'
      AND is_generated = 'NEVER'
      AND column_name NOT IN ('id', 'email', 'email_confirmed_at', 'aud', 'role');

    IF v_auth_missing_req_cols <> '' THEN
        RAISE EXCEPTION 'PRASYARAT FIXTURE auth.users: Kolom NOT NULL tanpa default terdeteksi (%).', v_auth_missing_req_cols;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.athlete_test_results'::regclass
          AND conname = 'chk_athlete_test_results_measurement_method_compatibility'
    ) THEN
        RAISE EXCEPTION 'FAIL (0A): Constraint chk_athlete_test_results_measurement_method_compatibility belum terpasang.';
    END IF;

    SELECT pg_get_constraintdef(oid) INTO v_spr10m_old_def
    FROM pg_constraint
    WHERE conrelid = 'public.athlete_test_results'::regclass
      AND conname = 'chk_athlete_test_results_spr10m_method';

    IF v_spr10m_old_def IS NOT NULL AND (
        v_spr10m_old_def NOT ILIKE '%SMARTPHONE_VIDEO%'
        OR v_spr10m_old_def NOT ILIKE '%measurement_method IS NULL%'
    ) THEN
        RAISE EXCEPTION 'FAIL (0B): Constraint lama chk_athlete_test_results_spr10m_method berkonflik (%).', v_spr10m_old_def;
    END IF;

    v_fn_oid := to_regprocedure('public.validate_and_protect_athlete_test_results()');
    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION 'FAIL (0C): Fungsi public.validate_and_protect_athlete_test_results() tidak ditemukan.';
    END IF;

    SELECT pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
    INTO v_fn_owner, v_fn_secdef, v_fn_config
    FROM pg_proc p
    WHERE p.oid = v_fn_oid;

    IF v_fn_owner IS DISTINCT FROM 'postgres' THEN
        RAISE EXCEPTION 'FAIL (0D): Owner fungsi trigger adalah %, wajib postgres.', v_fn_owner;
    END IF;
    IF v_fn_secdef IS NOT TRUE THEN
        RAISE EXCEPTION 'FAIL (0E): SECURITY DEFINER harus TRUE pada validate_and_protect_athlete_test_results().';
    END IF;
    IF NOT ('search_path=public, extensions, pg_temp' = ANY(COALESCE(v_fn_config, ARRAY[]::text[]))) THEN
        RAISE EXCEPTION 'FAIL (0F): search_path fungsi trigger tidak sesuai (%).', array_to_string(v_fn_config, '; ');
    END IF;
    IF has_function_privilege('public', v_fn_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_fn_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL (0G): Hak EXECUTE fungsi trigger tidak boleh diberikan ke PUBLIC/anon/authenticated.';
    END IF;

    SELECT pg_get_triggerdef(t.oid) INTO v_trig_def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'athlete_test_results'
      AND t.tgname = 'trg_validate_and_protect_athlete_test_results'
      AND t.tgfoid = v_fn_oid
      AND t.tgenabled <> 'D'
      AND NOT t.tgisinternal;

    IF v_trig_def IS NULL OR v_trig_def NOT ILIKE '%BEFORE INSERT OR UPDATE%' THEN
        RAISE EXCEPTION 'FAIL (0H): Trigger trg_validate_and_protect_athlete_test_results tidak aktif atau bukan BEFORE INSERT OR UPDATE (%).', COALESCE(v_trig_def, 'NULL');
    END IF;

    -- Anti-collision fixture check
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id IN (v_tenant_a_uuid, v_tenant_b_uuid)) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION pada public.tenants.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM auth.users
        WHERE id IN (v_owner_a_uid::uuid, v_owner_b_uid::uuid, v_coach_a1_uid, v_coach_a2_uid, v_kasir_a_uid::uuid)
           OR LOWER(email) IN (
               'verify-owner-a-035@chuvator.test', 'verify-owner-b-035@chuvator.test',
               'verify-coach-a1-035@chuvator.test', 'verify-coach-a2-035@chuvator.test',
               'verify-kasir-a-035@chuvator.test'
           )
    ) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION pada auth.users.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'is_active'
    ) INTO v_has_tenants_is_active;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users_staff' AND column_name = 'is_active'
    ) INTO v_has_staff_is_active;

    -- Siapkan fixture auth.users & tenant (selaras skema CHUVATOR aktual)
    INSERT INTO auth.users (id, email, email_confirmed_at, aud, role)
    VALUES
        (v_owner_a_uid::uuid,  'verify-owner-a-035@chuvator.test',  NOW(), 'authenticated', 'authenticated'),
        (v_owner_b_uid::uuid,  'verify-owner-b-035@chuvator.test',  NOW(), 'authenticated', 'authenticated'),
        (v_coach_a1_uid,       'verify-coach-a1-035@chuvator.test', NOW(), 'authenticated', 'authenticated'),
        (v_coach_a2_uid,       'verify-coach-a2-035@chuvator.test', NOW(), 'authenticated', 'authenticated'),
        (v_kasir_a_uid::uuid,  'verify-kasir-a-035@chuvator.test',  NOW(), 'authenticated', 'authenticated');

    INSERT INTO public.tenants (id, tenant_id, name, owner_uid, status)
    VALUES
        (v_tenant_a_uuid, v_tenant_a, 'Verify Task 03.5 SSB A', v_owner_a_uid, 'active'),
        (v_tenant_b_uuid, v_tenant_b, 'Verify Task 03.5 SSB B', v_owner_b_uid, 'active');

    IF v_has_tenants_is_active THEN
        EXECUTE 'UPDATE public.tenants SET is_active = TRUE WHERE id IN ($1, $2)' USING v_tenant_a_uuid, v_tenant_b_uuid;
    END IF;

    INSERT INTO public.users_staff (uid, tenant_id, email, name, role, status)
    VALUES
        (v_coach_a1_uid::text, v_tenant_a, 'verify-coach-a1-035@chuvator.test', 'Coach A1 035', 'coach', 'active'),
        (v_coach_a2_uid::text, v_tenant_a, 'verify-coach-a2-035@chuvator.test', 'Coach A2 035', 'coach', 'active'),
        (v_kasir_a_uid,        v_tenant_a, 'verify-kasir-a-035@chuvator.test',  'Kasir A 035',  'kasir', 'active');

    IF v_has_staff_is_active THEN
        EXECUTE 'UPDATE public.users_staff SET is_active = TRUE WHERE tenant_id = $1' USING v_tenant_a;
    END IF;

    INSERT INTO public.academies (id, tenant_id, academy_name, name)
    VALUES
        (v_acad_a, v_tenant_a, 'Verify Academy A 03.5', 'Verify Academy A 03.5'),
        (v_acad_b, v_tenant_b, 'Verify Academy B 03.5', 'Verify Academy B 03.5');

    INSERT INTO public.coaches (id, tenant_id, academy_id, name, status, auth_uid)
    VALUES
        (v_coach_a1_id, v_tenant_a, v_acad_a, 'Coach A1 035', 'active', v_coach_a1_uid),
        (v_coach_a2_id, v_tenant_a, v_acad_a, 'Coach A2 035', 'active', v_coach_a2_uid);

    INSERT INTO public.academy_classes (id, tenant_id, academy_id, class_name, coach_id)
    VALUES
        (v_class_a1_id, v_tenant_a, v_acad_a, 'Verify Class U-12 A1', v_coach_a1_id),
        (v_class_a2_id, v_tenant_a, v_acad_a, 'Verify Class U-14 A2', v_coach_a2_id),
        (v_class_b1_id, v_tenant_b, v_acad_b, 'Verify Class U-12 B1', NULL);

    INSERT INTO public.students (id, tenant_id, academy_id, class_id, student_name, birth_date)
    VALUES
        (v_stu_a1_id, v_tenant_a, v_acad_a, v_class_a1_id, 'Atlet Uji A1 03.5', '2014-06-10'),
        (v_stu_a2_id, v_tenant_a, v_acad_a, v_class_a2_id, 'Atlet Uji A2 03.5', '2012-06-10'),
        (v_stu_b1_id, v_tenant_b, v_acad_b, v_class_b1_id, 'Atlet Uji B1 03.5', '2014-06-10');

    -- Seed 1 record Tenant B & 2 record legacy pre-Task 03.5 dengan measurement_method NULL
    EXECUTE 'ALTER TABLE public.athlete_test_results DISABLE TRIGGER trg_validate_and_protect_athlete_test_results';
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, measurement_method,
        recorded_by_user_id, recorded_by_name,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES
    (
        v_legacy_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, NULL,
        NULL, 'Legacy Recorder',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-13', 'MULTI_TRIAL_BEST_MIN', 2.20, 's', '2.20 s', 'MIN',
        '{"measurementMethod":"HAND_TIMER_LEGACY"}'::jsonb
    ),
    (
        v_legacy_clean_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, NULL,
        NULL, 'Legacy Clean Recorder',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-13', 'MULTI_TRIAL_BEST_MIN', 2.25, 's', '2.25 s', 'MIN',
        '{}'::jsonb
    );
    EXECUTE 'ALTER TABLE public.athlete_test_results ENABLE TRIGGER trg_validate_and_protect_athlete_test_results';

    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, measurement_method,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method
    ) VALUES (
        v_res_b_id, v_tenant_b, v_acad_b, v_class_b1_id, v_stu_b1_id, 'STOPWATCH_MANUAL',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.09, 's', '2.09 s', 'MIN'
    );

    -- Uji sebagai role `authenticated` (Owner Tenant A)
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);

    -- =========================================================================
    -- 1. INSERT METODE VALID UNTUK SELURUH 18 TES (TERMASUK DUAL-METHOD & AUTO-DEFAULT 16 TES)
    -- =========================================================================
    FOR v_test IN
        SELECT * FROM (VALUES
            ('TST-SPR-10M',    'FTB-UNI-PHY-01', 'Akselerasi',            'physical',          'MULTI_TRIAL_BEST_MIN',   2.11, 's',    '2.11 s',    'MIN', 'STOPWATCH_MANUAL'),
            ('TST-SPR-10M',    'FTB-UNI-PHY-01', 'Akselerasi',            'physical',          'MULTI_TRIAL_BEST_MIN',   2.04, 's',    '2.04 s',    'MIN', 'SMARTPHONE_VIDEO'),
            ('TST-SPR-30M',    'FTB-UNI-PHY-06', 'Kecepatan Maksimal',    'physical',          'MULTI_TRIAL_BEST_MIN',   4.35, 's',    '4.35 s',    'MIN', 'STOPWATCH_MANUAL'),
            ('TST-SPR-30M',    'FTB-UNI-PHY-06', 'Kecepatan Maksimal',    'physical',          'MULTI_TRIAL_BEST_MIN',   4.28, 's',    '4.28 s',    'MIN', 'SMARTPHONE_VIDEO'),
            ('TST-AGL-ARW',    'FTB-UNI-PHY-02', 'Kelincahan',            'physical',          'BILATERAL_AVERAGE',     16.20, 's',    '16.20 s',   'AVG', 'STOPWATCH_MANUAL'),
            ('TST-BAL-STK',    'FTB-UNI-PHY-03', 'Keseimbangan',          'physical',          'BILATERAL_BEST_AVERAGE',18.50, 's',    '18.50 s',   'AVG', 'STOPWATCH_MANUAL'),
            ('TST-COD-505',    'FTB-UNI-PHY-09', 'Perubahan Arah',        'physical',          'BILATERAL_AVERAGE',      2.45, 's',    '2.45 s',    'AVG', 'STOPWATCH_MANUAL'),
            ('TST-COR-PLK',    'FTB-UNI-PHY-13', 'Kekuatan Inti',         'physical',          'SINGLE_TRIAL_MAX',      95.00, 's',    '95 s',      'MAX', 'STOPWATCH_MANUAL'),
            ('TST-RSA-630',    'FTB-UNI-PHY-14', 'Sprint Berulang',       'physical',          'RSA_6X30M',             27.40, 's',    '27.40 s',   'SUM', 'STOPWATCH_MANUAL'),
            ('TST-SSB-GK-03',  'FTB-SSB-GK-03',  'Ketangkasan Gerak Dasar','position_specific','MULTI_TRIAL_BEST_MIN',   5.12, 's',    '5.12 s',    'MIN', 'STOPWATCH_MANUAL'),
            ('TST-WF-TLA',     'FTB-POS-WF-01',  'Akselerasi Sayap',      'position_specific', 'MULTI_TRIAL_BEST_MIN',   3.18, 's',    '3.18 s',    'MIN', 'STOPWATCH_MANUAL'),
            ('TST-MOB-SAR',    'FTB-UNI-PHY-04', 'Mobilitas',             'physical',          'MULTI_TRIAL_BEST_MAX',  31.50, 'cm',   '31.5 cm',   'MAX', 'PHYSICAL_MEASURING_TOOL'),
            ('TST-RXN-RLR',    'FTB-UNI-PHY-07', 'Reaksi',                'physical',          'MULTI_TRIAL_AVERAGE',   14.50, 'cm',   '14.5 cm',   'AVG', 'PHYSICAL_MEASURING_TOOL'),
            ('TST-JMP-VER',    'FTB-UNI-PHY-08', 'Lompatan',              'physical',          'VERTICAL_JUMP_DELTA',   42.00, 'cm',   '42.0 cm',   'MAX', 'PHYSICAL_MEASURING_TOOL'),
            ('TST-PWR-SBJ',    'FTB-UNI-PHY-11', 'Daya Ledak',            'physical',          'MULTI_TRIAL_BEST_MAX', 198.00, 'cm',   '198.0 cm',  'MAX', 'PHYSICAL_MEASURING_TOOL'),
            ('TST-SHT-DST',    'FTB-UNI-TEC-07', 'Kekuatan Tembakan',     'technical',         'MULTI_TRIAL_BEST_MAX',  36.50, 'm',    '36.5 m',    'MAX', 'PHYSICAL_MEASURING_TOOL'),
            ('TST-END-BLP',    'FTB-UNI-PHY-10', 'Daya Tahan',            'physical',          'BLEEP_SHUTTLE_LEVEL', 1240.00, 'm',    '1240 m',    'SUM', 'MANUAL_COUNT'),
            ('TST-STR-PU1',    'FTB-UNI-PHY-12', 'Kekuatan Tubuh',        'physical',          'SINGLE_TRIAL_MAX',      34.00, 'reps', '34 reps',   'MAX', 'MANUAL_COUNT'),
            ('TST-SSB-WAP',    'FTB-SSB-OUT-02', 'Koordinasi Mata-Kaki',  'position_specific', 'MULTI_TRIAL_BEST_MAX',  19.00, 'reps', '19 reps',   'MAX', 'MANUAL_COUNT'),
            ('TST-SSB-GK-02',  'FTB-SSB-GK-02',  'Koordinasi Tangan-Mata','position_specific', 'MULTI_TRIAL_BEST_MAX',  22.00, 'reps', '22 reps',   'MAX', 'MANUAL_COUNT')
        ) AS t(test_id, indicator_id, indicator_name, category_id, input_schema_type, final_raw_value, final_unit, final_display_value, aggregation_method, expected_method)
    LOOP
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method, derived_metrics
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, v_test.expected_method,
            v_test.test_id, v_test.indicator_id, v_test.indicator_name, v_test.category_id,
            '2026-11-12', v_test.input_schema_type, v_test.final_raw_value, v_test.final_unit,
            v_test.final_display_value, v_test.aggregation_method,
            jsonb_build_object('measurementMethod', v_test.expected_method)
        );

        IF v_test.test_id NOT IN ('TST-SPR-10M', 'TST-SPR-30M') THEN
            INSERT INTO public.athlete_test_results (
                tenant_id, academy_id, class_id, student_id, measurement_method,
                test_id, indicator_id, indicator_name, category_id,
                test_date, input_schema_type, final_raw_value, final_unit,
                final_display_value, aggregation_method
            ) VALUES (
                v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, NULL,
                v_test.test_id, v_test.indicator_id, v_test.indicator_name, v_test.category_id,
                '2026-11-12', v_test.input_schema_type, v_test.final_raw_value, v_test.final_unit,
                v_test.final_display_value, v_test.aggregation_method
            )
            RETURNING measurement_method INTO v_method;

            IF v_method IS DISTINCT FROM v_test.expected_method THEN
                RAISE EXCEPTION 'FAIL (1B): Auto-default % seharusnya %, aktual: %', v_test.test_id, v_test.expected_method, v_method;
            END IF;
        END IF;
    END LOOP;

    -- Baris referensi milik Owner A untuk uji UPDATE / JSONB / RLS / imutabilitas
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, measurement_method,
        recorded_by_name, test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics, auxiliary_inputs
    ) VALUES
    (
        v_res_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, '   ',
        'Owner A', 'TST-MOB-SAR', 'FTB-UNI-PHY-04', 'Mobilitas', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MAX', 31.5, 'cm', '31.5 cm', 'MAX', '{}'::jsonb, '{}'::jsonb
    ),
    (
        v_res_dual_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
        'Owner A', 'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.12, 's', '2.12 s', 'MIN',
        '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"measurementMethod":"STOPWATCH_MANUAL"}}'::jsonb,
        '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
    ),
    (
        v_res_clean_dual_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
        'Owner A', 'TST-SPR-30M', 'FTB-UNI-PHY-06', 'Kecepatan Maksimal', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 4.31, 's', '4.31 s', 'MIN',
        '{}'::jsonb, '{}'::jsonb
    ),
    (
        v_res_aux_only_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
        'Owner A', 'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.13, 's', '2.13 s', 'MIN',
        '{}'::jsonb, '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
    ),
    (
        v_res_agl_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
        'Owner A', 'TST-AGL-ARW', 'FTB-UNI-PHY-02', 'Kelincahan', 'physical',
        '2026-11-12', 'BILATERAL_AVERAGE', 16.10, 's', '16.10 s', 'AVG',
        '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb, '{}'::jsonb
    ),
    (
        v_res_a2_id, v_tenant_a, v_acad_a, v_class_a2_id, v_stu_a2_id, 'STOPWATCH_MANUAL',
        'Owner A', 'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.07, 's', '2.07 s', 'MIN',
        '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb, '{}'::jsonb
    );

    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_res_id;
    IF v_method <> 'PHYSICAL_MEASURING_TOOL' THEN
        RAISE EXCEPTION 'FAIL (1C): TST-MOB-SAR whitespace harus menjadi PHYSICAL_MEASURING_TOOL, aktual: %', v_method;
    END IF;

    -- =========================================================================
    -- 2 & 5. INSERT METHOD NULL / TANPA PILIHAN EKSPLISIT PADA DUAL-METHOD (23514)
    -- =========================================================================
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, NULL,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.15, 's', '2.15 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL (2A): INSERT TST-SPR-10M dengan measurement_method NULL wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, '   ',
            'TST-SPR-30M', 'FTB-UNI-PHY-06', 'Kecepatan Maksimal', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 4.30, 's', '4.30 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL (2B): INSERT TST-SPR-30M tanpa pilihan metode eksplisit wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- =========================================================================
    -- 3. INSERT DENGAN METHOD TIDAK DIKENAL & KONFLIK 3-JALUR JSONB (23514)
    -- =========================================================================
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method, derived_metrics
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, NULL,
            'TST-SPR-30M', 'FTB-UNI-PHY-06', 'Kecepatan Maksimal', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 4.30, 's', '4.30 s', 'MIN',
            '{"measurementMethod":"LASER_GATE"}'::jsonb
        );
        RAISE EXCEPTION 'FAIL (3A): INSERT metode JSONB tidak dikenal (LASER_GATE) wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method, auxiliary_inputs
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.15, 's', '2.15 s', 'MIN',
            '{"measurementMethod":"SMARTPHONE_VIDEO"}'::jsonb
        );
        RAISE EXCEPTION 'FAIL (3B): Kontradiksi kolom STOPWATCH_MANUAL vs auxiliary_inputs SMARTPHONE_VIDEO wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- Konflik 3-jalur JSONB pada INSERT (derived_metrics vs athleteTestContext vs auxiliary_inputs)
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method, derived_metrics, auxiliary_inputs
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.15, 's', '2.15 s', 'MIN',
            '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"measurementMethod":"SMARTPHONE_VIDEO"}}'::jsonb,
            '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
        );
        RAISE EXCEPTION 'FAIL (3C): Konflik 3-jalur JSONB pada INSERT wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- =========================================================================
    -- 4. INSERT METHOD SALAH & TEST_ID TIDAK TERDAFTAR (23514)
    -- =========================================================================
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
            'TST-SSB-WAP', 'FTB-SSB-OUT-02', 'Koordinasi Mata-Kaki', 'position_specific',
            '2026-11-12', 'MULTI_TRIAL_BEST_MAX', 18, 'reps', '18 reps', 'MAX'
        );
        RAISE EXCEPTION 'FAIL (4A): TST-SSB-WAP dengan STOPWATCH_MANUAL wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'SMARTPHONE_VIDEO',
            'TST-AGL-ARW', 'FTB-UNI-PHY-02', 'Kelincahan', 'physical',
            '2026-11-12', 'BILATERAL_AVERAGE', 16.5, 's', '16.5 s', 'AVG'
        );
        RAISE EXCEPTION 'FAIL (4B): TST-AGL-ARW dengan SMARTPHONE_VIDEO wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'MANUAL_COUNT',
            'TST-MOB-SAR', 'FTB-UNI-PHY-04', 'Mobilitas', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MAX', 30.0, 'cm', '30.0 cm', 'MAX'
        );
        RAISE EXCEPTION 'FAIL (4C): TST-MOB-SAR dengan MANUAL_COUNT wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- Penolakan test_id di luar katalog resmi 18 tes
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
            'TST-UNREGISTERED-99', 'FTB-UNK-01', 'Tes Tidak Terdaftar', 'physical',
            '2026-11-12', 'SINGLE_TRIAL_MAX', 10.0, 's', '10.0 s', 'MAX'
        );
        RAISE EXCEPTION 'FAIL (4D): INSERT test_id tidak terdaftar (TST-UNREGISTERED-99) wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- =========================================================================
    -- 6. LEGACY NULL: UPDATE KOLOM LAIN TETAP NULL & PENGISIAN METODE EKSPLISIT
    -- =========================================================================
    UPDATE public.athlete_test_results
    SET notes = 'Verifikasi legacy NULL tetap utuh saat update notes'
    WHERE id IN (v_legacy_id, v_legacy_clean_id);

    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_legacy_id;
    IF v_method IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL (6A): Legacy NULL tidak boleh berubah menjadi %, harus tetap NULL', v_method;
    END IF;
    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_legacy_clean_id;
    IF v_method IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL (6A-2): Legacy NULL clean tidak boleh berubah menjadi %, harus tetap NULL', v_method;
    END IF;

    -- Mengisi kolom pada legacy NULL yang masih memiliki JSONB bertentangan (HAND_TIMER_LEGACY) tanpa membersihkan JSONB wajib ditolak (23514)
    BEGIN
        UPDATE public.athlete_test_results
        SET measurement_method = 'STOPWATCH_MANUAL'
        WHERE id = v_legacy_id;
        RAISE EXCEPTION 'FAIL (6B): Mengisi kolom pada legacy NULL sementara JSONB masih HAND_TIMER_LEGACY wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- Mengisi legacy NULL secara eksplisit dengan metode valid & JSONB selaras/bersih wajib berhasil
    UPDATE public.athlete_test_results
    SET measurement_method = 'STOPWATCH_MANUAL'
    WHERE id = v_legacy_clean_id;

    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_legacy_clean_id;
    IF v_method IS DISTINCT FROM 'STOPWATCH_MANUAL' THEN
        RAISE EXCEPTION 'FAIL (6C): Pengisian eksplisit metode valid pada legacy NULL (JSONB bersih) gagal (%).', COALESCE(v_method, 'NULL');
    END IF;

    UPDATE public.athlete_test_results
    SET measurement_method = 'STOPWATCH_MANUAL',
        derived_metrics = '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
    WHERE id = v_legacy_id;

    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_legacy_id;
    IF v_method IS DISTINCT FROM 'STOPWATCH_MANUAL' THEN
        RAISE EXCEPTION 'FAIL (6D): Pengisian eksplisit metode valid + sinkronisasi JSONB pada legacy NULL gagal (%).', COALESCE(v_method, 'NULL');
    END IF;

    -- =========================================================================
    -- 7. UPDATE MENGUBAH METHOD NON-NULL MENJADI NULL DITOLAK (23514)
    -- =========================================================================
    BEGIN
        UPDATE public.athlete_test_results SET measurement_method = NULL WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (7A): UPDATE menghapus measurement_method non-null ke NULL wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results SET measurement_method = '   ' WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (7B): UPDATE measurement_method ke whitespace wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results SET derived_metrics = '{}'::jsonb WHERE id = v_res_dual_id;
        RAISE EXCEPTION 'FAIL (7C): UPDATE mengosongkan measurementMethod via JSONB wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- =========================================================================
    -- 8. KONSISTENSI KOLOM–JSONB PADA UPDATE (5 SKENARIO WAJIB + 3 JALUR JSONB)
    -- =========================================================================
    -- 8A-1. Kolom berubah (STOPWATCH_MANUAL -> SMARTPHONE_VIDEO), JSONB lama TIDAK berubah -> DITOLAK (23514)
    BEGIN
        UPDATE public.athlete_test_results
        SET measurement_method = 'SMARTPHONE_VIDEO'
        WHERE id = v_res_dual_id;
        RAISE EXCEPTION 'FAIL (8A-1): UPDATE kolom saja tanpa mengubah JSONB lama (STOPWATCH_MANUAL) wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- 8A-2. Kolom berubah sementara hanya auxiliary_inputs lama berisi metode berbeda (JSONB tidak diubah) -> DITOLAK (23514)
    BEGIN
        UPDATE public.athlete_test_results
        SET measurement_method = 'SMARTPHONE_VIDEO'
        WHERE id = v_res_aux_only_id;
        RAISE EXCEPTION 'FAIL (8A-2): UPDATE kolom saja sementara auxiliary_inputs lama masih STOPWATCH_MANUAL wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- 8A-3. Kontrol positif: UPDATE kolom saja ketika seluruh jalur JSONB kosong ({}) -> BERHASIL
    UPDATE public.athlete_test_results
    SET measurement_method = 'SMARTPHONE_VIDEO'
    WHERE id = v_res_clean_dual_id;

    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_res_clean_dual_id;
    IF v_method IS DISTINCT FROM 'SMARTPHONE_VIDEO' THEN
        RAISE EXCEPTION 'FAIL (8A-3): UPDATE metode valid pada baris tanpa JSONB method seharusnya berhasil (%).', v_method;
    END IF;

    -- 8B-1. Kolom dan JSONB berubah dengan metode berbeda (SMARTPHONE_VIDEO vs STOPWATCH_MANUAL) -> DITOLAK (23514)
    BEGIN
        UPDATE public.athlete_test_results
        SET measurement_method = 'SMARTPHONE_VIDEO',
            derived_metrics = '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"measurementMethod":"SMARTPHONE_VIDEO"}}'::jsonb,
            auxiliary_inputs = '{"measurementMethod":"SMARTPHONE_VIDEO"}'::jsonb
        WHERE id = v_res_dual_id;
        RAISE EXCEPTION 'FAIL (8B-1): UPDATE kolom SMARTPHONE_VIDEO + derived_metrics STOPWATCH_MANUAL wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- 8B-2. Mutasi campuran kolom valid + JSONB invalid -> DITOLAK (23514)
    BEGIN
        UPDATE public.athlete_test_results
        SET measurement_method = 'SMARTPHONE_VIDEO',
            derived_metrics = '{"measurementMethod":"LASER_GATE"}'::jsonb
        WHERE id = v_res_dual_id;
        RAISE EXCEPTION 'FAIL (8B-2): Mutasi campuran kolom valid + JSONB invalid wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- 8B-3. Konflik 3-jalur JSONB pada UPDATE (tanpa mengubah kolom atau sambil mengubah JSONB) -> DITOLAK (23514)
    BEGIN
        UPDATE public.athlete_test_results
        SET derived_metrics = '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"measurementMethod":"SMARTPHONE_VIDEO"}}'::jsonb,
            auxiliary_inputs = '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
        WHERE id = v_res_dual_id;
        RAISE EXCEPTION 'FAIL (8B-3): Konflik 3-jalur JSONB pada UPDATE wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- 8C. Kolom dan seluruh 3 jalur JSONB diubah dengan metode SAMA (SMARTPHONE_VIDEO) -> BERHASIL
    UPDATE public.athlete_test_results
    SET measurement_method = 'SMARTPHONE_VIDEO',
        derived_metrics = '{"measurementMethod":"SMARTPHONE_VIDEO","athleteTestContext":{"measurementMethod":"SMARTPHONE_VIDEO"}}'::jsonb,
        auxiliary_inputs = '{"measurementMethod":"SMARTPHONE_VIDEO"}'::jsonb
    WHERE id = v_res_dual_id;

    SELECT
        measurement_method,
        derived_metrics->>'measurementMethod',
        derived_metrics->'athleteTestContext'->>'measurementMethod',
        auxiliary_inputs->>'measurementMethod'
    INTO v_method, v_dm_val, v_ctx_val, v_aux_val
    FROM public.athlete_test_results
    WHERE id = v_res_dual_id;

    IF v_method <> 'SMARTPHONE_VIDEO'
       OR v_dm_val <> 'SMARTPHONE_VIDEO'
       OR v_ctx_val <> 'SMARTPHONE_VIDEO'
       OR v_aux_val <> 'SMARTPHONE_VIDEO' THEN
        RAISE EXCEPTION 'FAIL (8C): UPDATE selaras kolom + 3 jalur JSONB gagal (col=%, dm=%, ctx=%, aux=%).',
            v_method, v_dm_val, v_ctx_val, v_aux_val;
    END IF;

    -- 8D-1. UPDATE JSONB TANPA mengubah kolom (semua 3 jalur selaras ke STOPWATCH_MANUAL) -> menyinkronkan kolom
    UPDATE public.athlete_test_results
    SET derived_metrics = '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"measurementMethod":"STOPWATCH_MANUAL"}}'::jsonb,
        auxiliary_inputs = '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
    WHERE id = v_res_dual_id;

    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_res_dual_id;
    IF v_method IS DISTINCT FROM 'STOPWATCH_MANUAL' THEN
        RAISE EXCEPTION 'FAIL (8D-1): UPDATE JSONB tanpa kolom harus menyinkronkan kolom menjadi STOPWATCH_MANUAL (%).', v_method;
    END IF;

    -- 8D-2. UPDATE JSONB TANPA mengubah kolom memakai metode tidak kompatibel -> DITOLAK (23514)
    BEGIN
        UPDATE public.athlete_test_results
        SET auxiliary_inputs = '{"measurementMethod":"SMARTPHONE_VIDEO"}'::jsonb
        WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (8D-2a): Mutasi auxiliary_inputs SMARTPHONE_VIDEO pada TST-MOB-SAR wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results
        SET derived_metrics = '{"measurementMethod":"SMARTPHONE_VIDEO"}'::jsonb
        WHERE id = v_res_agl_id;
        RAISE EXCEPTION 'FAIL (8D-2b): Mutasi derived_metrics SMARTPHONE_VIDEO pada TST-AGL-ARW tanpa mengubah kolom wajib ditolak!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    -- =========================================================================
    -- 9. ISOLASI TENANT
    -- =========================================================================
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL (9A): Kebocoran SELECT lintas-tenant (% baris Tenant B terbaca Owner A).', v_count;
    END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_b1_id, 'STOPWATCH_MANUAL',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.05, 's', '2.05 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL (9B): Penyisipan student_id lintas-tenant wajib ditolak (42501)!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    UPDATE public.athlete_test_results SET notes = 'Cross tenant spoof' WHERE id = v_res_b_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL (9C): Owner A berhasil UPDATE baris Tenant B!';
    END IF;

    -- =========================================================================
    -- 10. OTORISASI LENGKAP: COACH (IN-CLASS & OUT-OF-CLASS), KASIR & ANON
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coach_a1_uid::text, 'role', 'authenticated')::text, true);

    -- 10A. Coach A1 In-Class (v_stu_a1_id): INSERT, SELECT, UPDATE, DELETE harus diizinkan
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, measurement_method,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method
    ) VALUES
    (
        v_res_coach_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.08, 's', '2.08 s', 'MIN'
    ),
    (
        v_res_coach_del_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.09, 's', '2.09 s', 'MIN'
    );

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE id = v_res_coach_id;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FAIL (10A-1): Coach A1 gagal SELECT data siswa kelasnya sendiri!';
    END IF;

    UPDATE public.athlete_test_results SET notes = 'Update valid oleh Coach A1 in-class' WHERE id = v_res_coach_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
        RAISE EXCEPTION 'FAIL (10A-2): Coach A1 gagal UPDATE data siswa kelasnya sendiri (ROW_COUNT=%)!', v_affected;
    END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_coach_del_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
        RAISE EXCEPTION 'FAIL (10A-3): Coach A1 gagal DELETE data siswa kelasnya sendiri (ROW_COUNT=%)!', v_affected;
    END IF;

    -- 10B. Coach A1 Out-of-Class (v_stu_a2_id / v_res_a2_id): SELECT=0, INSERT=42501, UPDATE=0, DELETE=0
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE student_id = v_stu_a2_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL (10B-1): Coach A1 dapat SELECT data siswa Kelas A2!';
    END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a2_id, 'STOPWATCH_MANUAL',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.08, 's', '2.08 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL (10B-2): Coach A1 berhasil INSERT siswa kelas A2!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    UPDATE public.athlete_test_results SET notes = 'Out of class tamper' WHERE id = v_res_a2_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL (10B-3): Coach A1 berhasil UPDATE siswa kelas A2!';
    END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_a2_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL (10B-4): Coach A1 berhasil DELETE siswa kelas A2!';
    END IF;

    -- Coach A1 dilarang menyisipkan coach_id Coach A2
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, coach_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, v_coach_a2_id, 'STOPWATCH_MANUAL',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.08, 's', '2.08 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL (10B-5): Coach A1 berhasil spoofing coach_id milik Coach A2!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    -- 10C. Kasir (Read-Only Tenant A): SELECT diizinkan, INSERT=42501, UPDATE=0, DELETE=0
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kasir_a_uid, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE id = v_res_id;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FAIL (10C-1): Kasir seharusnya diizinkan SELECT data Tenant A!';
    END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.08, 's', '2.08 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL (10C-2): Kasir berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    UPDATE public.athlete_test_results SET notes = 'Kasir tamper' WHERE id = v_res_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL (10C-3): Kasir berhasil UPDATE!';
    END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL (10C-4): Kasir berhasil DELETE!';
    END IF;

    -- 10D. Role `anon`: SELECT, INSERT, UPDATE, DELETE wajib ditolak (42501)
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{}', true);

    BEGIN
        PERFORM COUNT(*) FROM public.athlete_test_results;
        RAISE EXCEPTION 'FAIL (10D-1): Anon berhasil SELECT public.athlete_test_results!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, 'STOPWATCH_MANUAL',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.08, 's', '2.08 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL (10D-2): Anon berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results SET notes = 'Anon tamper' WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (10D-3): Anon berhasil UPDATE!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        DELETE FROM public.athlete_test_results WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (10D-4): Anon berhasil DELETE!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    -- =========================================================================
    -- 11. IMUTABILITAS KOLOM AUDIT & IDENTITAS
    -- =========================================================================
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);

    BEGIN
        UPDATE public.athlete_test_results
        SET recorded_by_user_id = v_owner_a_uid::uuid
        WHERE id = v_legacy_id;
        RAISE EXCEPTION 'FAIL (11A): Mutasi recorded_by_user_id (NULL->UUID) wajib ditolak (42501)!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results
        SET recorded_by_name = 'Hijacked Recorder'
        WHERE id = v_legacy_id;
        RAISE EXCEPTION 'FAIL (11B): Mutasi recorded_by_name wajib ditolak (42501)!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results
        SET tenant_id = v_tenant_b
        WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (11C): Mutasi tenant_id wajib ditolak (42501)!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results
        SET test_id = 'TST-SPR-30M'
        WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (11D): Mutasi test_id wajib ditolak (42501)!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results
        SET indicator_id = 'FTB-UNI-PHY-99'
        WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL (11E): Mutasi indicator_id wajib ditolak (42501)!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    -- =========================================================================
    -- 12. SIMULASI ROLLBACK NON-DESTRUKTIF CONSTRAINT + STATUS BASELINE JUJUR
    -- =========================================================================
    RESET ROLE;
    SELECT COUNT(*) INTO v_before_rows FROM public.athlete_test_results;

    BEGIN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_spr10m_method
            CHECK (
                test_id <> 'TST-SPR-10M'
                OR measurement_method IS NULL
                OR measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
            );
        ALTER TABLE public.athlete_test_results
            DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility;

        SELECT COUNT(*) INTO v_after_rows FROM public.athlete_test_results;
        SELECT COUNT(*) INTO v_policy_count
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'athlete_test_results';

        IF v_after_rows <> v_before_rows THEN
            RAISE EXCEPTION 'FAIL (12A): Jumlah baris berubah pasca-rollback constraint (% -> %)!', v_before_rows, v_after_rows;
        END IF;
        IF v_policy_count < 4 THEN
            RAISE EXCEPTION 'FAIL (12B): RLS policies berkurang pasca-rollback constraint (%).', v_policy_count;
        END IF;

        -- Rollback subtransaksi simulasi DDL constraint agar kondisi pasca-migrasi tetap dapat diaudit sebelum ROLLBACK utama
        RAISE EXCEPTION '__REVERT_ROLLBACK_CONSTRAINT_SIM__' USING ERRCODE = 'P0001';
    EXCEPTION
        WHEN SQLSTATE 'P0001' THEN
            IF SQLERRM <> '__REVERT_ROLLBACK_CONSTRAINT_SIM__' THEN
                RAISE;
            END IF;
    END;

    RAISE NOTICE '[INFO] Simulasi rollback constraint (chk_athlete_test_results_spr10m_method) non-destruktif; namun pemulihan fungsi trigger baseline Task 03.4 BELUM AMAN / BELUM TERVERIFIKASI tanpa snapshot pg_get_functiondef() Production pra-Task 03.5.';
    RAISE NOTICE '[PASS] ALL 12 TASK 03.5.3 VERIFICATION CHECKS PASSED (ROLLED BACK CLEANLY).';
END $$;

ROLLBACK;
