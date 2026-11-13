-- =============================================================================
-- CHUVATOR — TASK 03.5: VERIFICATION SCRIPT (READ-ONLY + BEGIN ... ROLLBACK)
-- 02_task03_5_verification.sql
-- =============================================================================
-- CATATAN:
--   - Skrip ini TIDAK melakukan perubahan permanen (100% ROLLBACK).
--   - Memverifikasi constraint `chk_athlete_test_results_measurement_method_compatibility`,
--     penolakan metode tidak standar / lintas-tes (23514), auto-standarisasi INSERT
--     untuk tes metode tunggal, serta pelestarian record legacy NULL.
-- =============================================================================

-- BAGIAN A (READ-ONLY): Inspeksi Constraint & Distribusi Data Eksisting
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
    test_id,
    COALESCE(measurement_method, 'NULL (LEGACY)') AS measurement_method,
    COUNT(*) AS total_rows
FROM public.athlete_test_results
GROUP BY test_id, COALESCE(measurement_method, 'NULL (LEGACY)')
ORDER BY test_id, measurement_method;

-- BAGIAN B (SIMULASI TRANSAKSIONAL BEGIN ... ROLLBACK)
BEGIN;

DO $$
DECLARE
    v_tenant TEXT := 'tenant-verify-task035-' || substr(gen_random_uuid()::text, 1, 8);
    v_owner_uid UUID := '35000000-0000-4000-8000-000000000001'::uuid;
    v_acad_id UUID := '35000000-0000-4000-8000-000000000010'::uuid;
    v_class_id UUID := '35000000-0000-4000-8000-000000000020'::uuid;
    v_stu_id UUID := '35000000-0000-4000-8000-000000000030'::uuid;
    v_res_id UUID := '35000000-0000-4000-8000-000000000040'::uuid;
    v_legacy_id UUID := '35000000-0000-4000-8000-000000000050'::uuid;
    v_method TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner_uid) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION pada auth.users untuk %', v_owner_uid;
    END IF;

    INSERT INTO auth.users (id, email, email_confirmed_at, aud, role)
    VALUES (v_owner_uid, 'verify-035@chuvator.test', NOW(), 'authenticated', 'authenticated');

    INSERT INTO public.tenants (tenant_id, name, owner_uid, status, is_active)
    VALUES (v_tenant, 'Verify Task 03.5 SSB', v_owner_uid, 'active', TRUE);

    INSERT INTO public.academies (id, tenant_id, name)
    VALUES (v_acad_id, v_tenant, 'Verify Academy 03.5');

    INSERT INTO public.academy_classes (id, tenant_id, academy_id, name, is_archived)
    VALUES (v_class_id, v_tenant, v_acad_id, 'Verify Class U-12', FALSE);

    INSERT INTO public.students (id, tenant_id, academy_id, class_id, name, birth_date)
    VALUES (v_stu_id, v_tenant, v_acad_id, v_class_id, 'Atlet Uji 03.5', '2014-06-10');

    -- 1. Verifikasi auto-assign metode standar saat INSERT (NULL maupun whitespace) pada tes metode tunggal
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, measurement_method,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method
    ) VALUES (
        v_res_id, v_tenant, v_acad_id, v_class_id, v_stu_id, '   ',
        'TST-MOB-SAR', 'FTB-UNI-PHY-04', 'Mobilitas', 'physical',
        '2026-11-12', 'MULTI_TRIAL_BEST_MAX', 31.5, 'cm', '31.5 cm', 'MAX'
    );

    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_res_id;
    IF v_method <> 'PHYSICAL_MEASURING_TOOL' THEN
        RAISE EXCEPTION 'FAIL: TST-MOB-SAR seharusnya otomatis PHYSICAL_MEASURING_TOOL, aktual: %', v_method;
    END IF;

    -- 2. Verifikasi 4 kategori metode standar pada tes masing-masing
    INSERT INTO public.athlete_test_results (
        tenant_id, academy_id, class_id, student_id, measurement_method,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method
    ) VALUES
    (v_tenant, v_acad_id, v_class_id, v_stu_id, 'STOPWATCH_MANUAL', 'TST-AGL-ARW', 'FTB-UNI-PHY-02', 'Kelincahan', 'physical', '2026-11-12', 'BILATERAL_AVERAGE', 16.2, 's', '16.2 s', 'AVG'),
    (v_tenant, v_acad_id, v_class_id, v_stu_id, 'STOPWATCH_MANUAL', 'TST-BAL-STK', 'FTB-UNI-PHY-03', 'Keseimbangan', 'physical', '2026-11-12', 'BILATERAL_BEST_AVERAGE', 18.5, 's', '18.5 s', 'AVG'),
    (v_tenant, v_acad_id, v_class_id, v_stu_id, 'SMARTPHONE_VIDEO', 'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical', '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.11, 's', '2.11 s', 'MIN'),
    (v_tenant, v_acad_id, v_class_id, v_stu_id, 'MANUAL_COUNT', 'TST-SSB-WAP', 'FTB-SSB-OUT-02', 'Koordinasi Mata-Kaki', 'position_specific', '2026-11-12', 'MULTI_TRIAL_BEST_MAX', 19, 'reps', '19 reps', 'MAX');

    -- 3. Simulasikan record legacy pre-Task 03.5 (measurement_method NULL) dan verifikasi tetap NULL saat UPDATE notes
    EXECUTE 'ALTER TABLE public.athlete_test_results DISABLE TRIGGER trg_validate_and_protect_athlete_test_results';
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, measurement_method,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method
    ) VALUES (
        v_legacy_id, v_tenant, v_acad_id, v_class_id, v_stu_id, NULL,
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-11-13', 'MULTI_TRIAL_BEST_MIN', 2.20, 's', '2.20 s', 'MIN'
    );
    EXECUTE 'ALTER TABLE public.athlete_test_results ENABLE TRIGGER trg_validate_and_protect_athlete_test_results';

    UPDATE public.athlete_test_results SET notes = 'Verifikasi legacy NULL tetap utuh' WHERE id = v_legacy_id;
    SELECT measurement_method INTO v_method FROM public.athlete_test_results WHERE id = v_legacy_id;
    IF v_method IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: Legacy NULL tidak boleh berubah menjadi %, harus tetap NULL', v_method;
    END IF;

    -- 4. Verifikasi penolakan record baru NULL/kosong pada dual-method, metode tidak kompatibel, atau metode tidak dikenal (23514)
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant, v_acad_id, v_class_id, v_stu_id, NULL,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 2.15, 's', '2.15 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL: INSERT baru TST-SPR-10M dengan measurement_method NULL wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method, derived_metrics
        ) VALUES (
            v_tenant, v_acad_id, v_class_id, v_stu_id, NULL,
            'TST-SPR-30M', 'FTB-UNI-PHY-06', 'Kecepatan Maksimal', 'physical',
            '2026-11-12', 'MULTI_TRIAL_BEST_MIN', 4.30, 's', '4.30 s', 'MIN',
            '{"measurementMethod":"LASER_GATE"}'::jsonb
        );
        RAISE EXCEPTION 'FAIL: INSERT baru dengan metode JSONB tidak dikenal (LASER_GATE) wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant, v_acad_id, v_class_id, v_stu_id, 'STOPWATCH_MANUAL',
            'TST-SSB-WAP', 'FTB-SSB-OUT-02', 'Koordinasi Mata-Kaki', 'position_specific',
            '2026-11-12', 'MULTI_TRIAL_BEST_MAX', 18, 'reps', '18 reps', 'MAX'
        );
        RAISE EXCEPTION 'FAIL: TST-SSB-WAP dengan STOPWATCH_MANUAL wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant, v_acad_id, v_class_id, v_stu_id, 'SMARTPHONE_VIDEO',
            'TST-AGL-ARW', 'FTB-UNI-PHY-02', 'Kelincahan', 'physical',
            '2026-11-12', 'BILATERAL_AVERAGE', 16.5, 's', '16.5 s', 'AVG'
        );
        RAISE EXCEPTION 'FAIL: TST-AGL-ARW dengan SMARTPHONE_VIDEO wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results
        SET measurement_method = NULL
        WHERE id = v_res_id;
        RAISE EXCEPTION 'FAIL: UPDATE menghapus measurement_method non-null menjadi NULL wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    RAISE NOTICE '[PASS] ALL TASK 03.5 SQL VERIFICATION CHECKS PASSED (ROLLED BACK CLEANLY).';
END $$;

ROLLBACK;
