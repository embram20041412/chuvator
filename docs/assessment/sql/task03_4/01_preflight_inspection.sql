-- =============================================================================
-- CHUVATOR — TASK 03.4.3: SUPABASE DATABASE MIGRATION READINESS
-- 01_preflight_inspection.sql (100% READ-ONLY & SCHEMA-RESILIENT PREFLIGHT)
-- =============================================================================
-- TUJUAN:
--   Memeriksa kondisi aktual database Supabase CHUVATOR SEBELUM menjalankan
--   migrasi Assessment Battery (`public.athlete_test_results`).
-- SIFAT & JAMINAN:
--   1. 100% READ-ONLY (hanya query SELECT ke pg_catalog, information_schema,
--      serta dynamic SELECT terproteksi via pg_catalog.query_to_xml).
--   2. TIDAK mengubah data, TIDAK membuat objek, dan TIDAK menghapus objek.
--   3. Tahan terhadap kondisi tabel/kolom belum tersedia (tidak memicu 42P01
--      atau 42703 saat tabel prasyarat atau athlete_test_results belum ada).
--   4. Mengidentifikasi data legacy yang berpotensi menggagalkan migrasi.
-- =============================================================================

-- 1. Cek Keberadaan Tabel Prasyarat Inti & Tabel Target
SELECT
    req.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS table_status,
    CASE
        WHEN t.table_name IS NOT NULL THEN 'OK — Tabel tersedia.'
        WHEN req.table_name = 'athlete_test_results' THEN 'INFO — Tabel target baru akan dibuat oleh migrasi.'
        ELSE 'BLOCKER — Jalankan migrasi dasar CHUVATOR sebelum migrasi Assessment Battery.'
    END AS recommendation
FROM (
    VALUES
        ('platform_superadmins'),
        ('tenants'),
        ('users_staff'),
        ('academies'),
        ('academy_classes'),
        ('coaches'),
        ('students'),
        ('academy_evaluations'),
        ('athlete_test_results')
) AS req(table_name)
LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public'
   AND t.table_name = req.table_name
ORDER BY req.table_name;

-- 2. Cek Kolom Kritis pada Tabel Prasyarat (Dependency Contract Audit)
SELECT
    req.table_name,
    req.column_name,
    req.importance,
    CASE WHEN c.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS column_status,
    c.data_type,
    c.is_nullable,
    CASE
        WHEN c.column_name IS NOT NULL THEN 'OK'
        WHEN req.importance = 'CRITICAL_FOR_COACH_SCOPE' THEN 'BLOCKER — Jalankan Phase 1 Security Hardening agar coaches.auth_uid tersedia untuk scope pelatih fail-closed.'
        WHEN req.importance = 'REQUIRED' THEN 'BLOCKER — Kolom wajib prasyarat belum tersedia.'
        ELSE 'WARNING — Kolom opsional belum tersedia; fungsi migrasi memakai fallback to_jsonb() yang aman.'
    END AS recommendation
FROM (
    VALUES
        ('platform_superadmins', 'auth_uid', 'REQUIRED'),
        ('platform_superadmins', 'email', 'REQUIRED'),
        ('tenants', 'id', 'REQUIRED'),
        ('tenants', 'tenant_id', 'REQUIRED'),
        ('tenants', 'owner_uid', 'REQUIRED'),
        ('tenants', 'status', 'REQUIRED'),
        ('tenants', 'is_active', 'OPTIONAL_JSONB_SAFE'),
        ('users_staff', 'id', 'REQUIRED'),
        ('users_staff', 'uid', 'REQUIRED'),
        ('users_staff', 'tenant_id', 'REQUIRED'),
        ('users_staff', 'role', 'REQUIRED'),
        ('users_staff', 'status', 'REQUIRED'),
        ('users_staff', 'is_active', 'OPTIONAL_JSONB_SAFE'),
        ('academies', 'id', 'REQUIRED'),
        ('academies', 'tenant_id', 'REQUIRED'),
        ('academy_classes', 'id', 'REQUIRED'),
        ('academy_classes', 'tenant_id', 'REQUIRED'),
        ('academy_classes', 'academy_id', 'REQUIRED'),
        ('academy_classes', 'coach_id', 'REQUIRED'),
        ('academy_classes', 'is_archived', 'OPTIONAL_JSONB_SAFE'),
        ('coaches', 'id', 'REQUIRED'),
        ('coaches', 'tenant_id', 'REQUIRED'),
        ('coaches', 'academy_id', 'REQUIRED'),
        ('coaches', 'status', 'REQUIRED'),
        ('coaches', 'auth_uid', 'CRITICAL_FOR_COACH_SCOPE'),
        ('students', 'id', 'REQUIRED'),
        ('students', 'tenant_id', 'REQUIRED'),
        ('students', 'academy_id', 'REQUIRED'),
        ('students', 'class_id', 'REQUIRED'),
        ('students', 'birth_date', 'REQUIRED')
) AS req(table_name, column_name, importance)
LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = req.table_name
   AND c.column_name = req.column_name
ORDER BY req.table_name, req.column_name;

-- 3. Cek Ekstensi yang Dibutuhkan (pgcrypto)
SELECT
    extname AS extension_name,
    extversion,
    n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname IN ('pgcrypto', 'uuid-ossp');

-- 4. Cek Status Eksisting Kolom public.athlete_test_results (Kosong bila tabel belum ada)
SELECT
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'athlete_test_results'
ORDER BY c.ordinal_position;

-- 5. Cek Fungsi RBAC Inti & Helper Assessment Battery Eksisting (beserta Owner & Privileges)
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    p.proconfig AS function_config,
    pg_get_userbyid(p.proowner) AS owner_role,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'is_superadmin',
      'get_user_tenant_role',
      'get_strict_tenant_member_role',
      'athlete_belongs_to_tenant',
      'coach_can_manage_student',
      'validate_and_protect_athlete_test_results'
  )
ORDER BY p.proname;

-- 6. Cek Status RLS, Kebijakan, Constraints, Trigger, & Indeks Eksisting (Aman walau tabel belum ada)
SELECT
    t.tablename,
    t.rowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN (
      'tenants', 'users_staff', 'academies', 'academy_classes',
      'coaches', 'students', 'academy_evaluations', 'athlete_test_results'
  )
ORDER BY t.tablename;

SELECT
    tablename,
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
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'athlete_test_results'
ORDER BY con.conname;

SELECT
    t.tgname AS trigger_name,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'athlete_test_results'
  AND NOT t.tgisinternal;

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'athlete_test_results'
ORDER BY indexname;

-- 7. Cek Integritas Data Referensial & Pengikatan Coach (Tahan Tabel/Kolom Missing via query_to_xml)
WITH integrity_checks AS (
    SELECT
        'students_missing_tenant' AS check_name,
        CASE
            WHEN to_regclass('public.students') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'tenant_id') THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END AS check_status,
        CASE
            WHEN to_regclass('public.students') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'tenant_id')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.students WHERE tenant_id IS NULL OR trim(tenant_id::text) = ''''',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END AS issue_count,
        'Setiap atlet wajib memiliki tenant_id valid.' AS recommendation

    UNION ALL
    SELECT
        'academy_classes_missing_tenant',
        CASE
            WHEN to_regclass('public.academy_classes') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academy_classes' AND column_name = 'tenant_id') THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.academy_classes') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academy_classes' AND column_name = 'tenant_id')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.academy_classes WHERE tenant_id IS NULL OR trim(tenant_id::text) = ''''',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'Setiap kelas wajib memiliki tenant_id valid.'

    UNION ALL
    SELECT
        'coaches_missing_tenant',
        CASE
            WHEN to_regclass('public.coaches') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'tenant_id') THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.coaches') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'tenant_id')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.coaches WHERE tenant_id IS NULL OR trim(tenant_id::text) = ''''',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'Setiap pelatih wajib memiliki tenant_id valid.'

    UNION ALL
    SELECT
        'tenants_missing_canonical_tenant_id',
        CASE
            WHEN to_regclass('public.tenants') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'tenant_id') THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.tenants') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'tenant_id')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.tenants WHERE tenant_id IS NULL OR trim(tenant_id::text) = ''''',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'Setiap tenant wajib memiliki kolom kanonik tenants.tenant_id terisi.'

    UNION ALL
    SELECT
        'coaches_missing_auth_uid',
        CASE
            WHEN to_regclass('public.coaches') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'auth_uid') THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.coaches') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'auth_uid')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.coaches WHERE auth_uid IS NULL OR trim(auth_uid::text) = ''''',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'WARNING: Pelatih tanpa coaches.auth_uid akan ditolak (fail-closed) oleh coach_can_manage_student(). Tautkan auth_uid pelatih sebelum rilis.'

    UNION ALL
    SELECT
        'active_coach_staff_without_coaches_profile',
        CASE
            WHEN to_regclass('public.users_staff') IS NULL OR to_regclass('public.coaches') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'auth_uid') THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.users_staff') IS NOT NULL
             AND to_regclass('public.coaches') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'auth_uid')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.users_staff s WHERE LOWER(trim(COALESCE(s.role, ''''))) IN (''coach'', ''pelatih'') AND COALESCE((to_jsonb(s)->>''is_active'')::boolean, FALSE) = TRUE AND s.uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.coaches c WHERE trim(c.tenant_id::text) = trim(s.tenant_id::text) AND c.auth_uid::text = s.uid::text)',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'WARNING: Akun staf coach aktif tanpa profil coaches.auth_uid yang cocok tidak akan memiliki akses Assessment Battery hingga ditautkan.'
)
SELECT
    check_name,
    check_status,
    issue_count,
    CASE
        WHEN check_status <> 'CHECKED' THEN check_status
        WHEN COALESCE(issue_count, 0) = 0 THEN 'PASS'
        WHEN check_name IN ('coaches_missing_auth_uid', 'active_coach_staff_without_coaches_profile') THEN 'WARNING'
        ELSE 'BLOCKER'
    END AS severity_status,
    recommendation
FROM integrity_checks;

-- 8. Cek Kesiapan Data Legacy pada public.athlete_test_results (Jika Tabel Sudah Ada)
WITH legacy_audit AS (
    SELECT
        'athlete_test_results_total_rows' AS check_name,
        CASE WHEN to_regclass('public.athlete_test_results') IS NULL THEN 'SKIPPED_TABLE_NOT_YET_CREATED' ELSE 'CHECKED' END AS check_status,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END AS issue_count,
        'Jumlah total baris pengukuran existing sebelum migrasi.' AS recommendation

    UNION ALL
    SELECT
        'legacy_invalid_calibration_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL THEN 'SKIPPED_TABLE_NOT_YET_CREATED'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'calibration_status')
              OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'converted_score')
            THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'calibration_status')
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'converted_score')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results WHERE NOT ((calibration_status = ''CALIBRATED'' AND converted_score IS NOT NULL AND converted_score >= 1 AND converted_score <= 100) OR (calibration_status IN (''PENDING_CALIBRATION'', ''READY_FOR_CALIBRATION'', ''NEEDS_FURTHER_DESIGN'') AND converted_score IS NULL))',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'BLOCKER jika > 0: Perbaiki inkonsistensi calibration_status vs converted_score sebelum menerapkan chk_athlete_test_results_calibration_consistency.'

    UNION ALL
    SELECT
        'legacy_spr10m_invalid_top_method_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL THEN 'SKIPPED_TABLE_NOT_YET_CREATED'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'measurement_method')
            THEN 'SKIPPED_COLUMN_NOT_YET_ADDED'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'measurement_method')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results WHERE test_id = ''TST-SPR-10M'' AND measurement_method IS NOT NULL AND UPPER(trim(measurement_method)) NOT IN (''STOPWATCH_MANUAL'', ''SMARTPHONE_VIDEO'')',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'INFO/WARNING: Jika > 0, nilai whitespace/nonstandar pada measurement_method untuk TST-SPR-10M akan disanitasi aman oleh modul migrasi sebelum constraint diterapkan.'

    UNION ALL
    SELECT
        'legacy_spr10m_nonstandard_jsonb_method_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL THEN 'SKIPPED_TABLE_NOT_YET_CREATED'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'derived_metrics')
            THEN 'SKIPPED_COLUMN_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'derived_metrics')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results WHERE test_id = ''TST-SPR-10M'' AND NULLIF(UPPER(trim(COALESCE(derived_metrics->>''measurementMethod'', derived_metrics->''athleteTestContext''->>''measurementMethod'', auxiliary_inputs->>''measurementMethod'', ''''))), '''') IS NOT NULL AND UPPER(trim(COALESCE(derived_metrics->>''measurementMethod'', derived_metrics->''athleteTestContext''->>''measurementMethod'', auxiliary_inputs->>''measurementMethod'', ''''))) NOT IN (''STOPWATCH_MANUAL'', ''SMARTPHONE_VIDEO'')',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'INFO: Baris TST-SPR-10M dengan metode JSONB nonstandar tidak akan dipaksakan ke kolom measurement_method (tetap NULL demi kepatuhan fakta).'

    UNION ALL
    SELECT
        'legacy_invalid_age_years_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL THEN 'SKIPPED_TABLE_NOT_YET_CREATED'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'age_years_at_test')
            THEN 'SKIPPED_COLUMN_NOT_YET_ADDED'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'age_years_at_test')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results WHERE age_years_at_test IS NOT NULL AND (age_years_at_test < 3 OR age_years_at_test > 65)',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'BLOCKER jika > 0: Nilai age_years_at_test di luar rentang 3..65 akan gagal oleh chk_athlete_test_results_age_years_range.'

    UNION ALL
    SELECT
        'legacy_invalid_test_period_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL THEN 'SKIPPED_TABLE_NOT_YET_CREATED'
            WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'test_period')
            THEN 'SKIPPED_COLUMN_NOT_YET_ADDED'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'athlete_test_results' AND column_name = 'test_period')
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results WHERE test_period IS NOT NULL AND test_period !~ ''^\d{4}-\d{2}$''',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'BLOCKER jika > 0: Nilai test_period tidak berformat YYYY-MM akan gagal oleh chk_athlete_test_results_test_period_format.'

    UNION ALL
    SELECT
        'legacy_orphan_student_or_cross_tenant_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL OR to_regclass('public.students') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL AND to_regclass('public.students') IS NOT NULL
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results r LEFT JOIN public.students s ON s.id = r.student_id WHERE s.id IS NULL OR trim(s.tenant_id::text) <> trim(r.tenant_id::text)',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'BLOCKER jika > 0: Ditemukan baris athlete_test_results dengan student_id tidak cocok terhadap tenant_id pada public.students.'

    UNION ALL
    SELECT
        'legacy_cross_tenant_coach_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL OR to_regclass('public.coaches') IS NULL THEN 'SKIPPED_TABLE_MISSING'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL AND to_regclass('public.coaches') IS NOT NULL
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results r LEFT JOIN public.coaches c ON c.id = r.coach_id WHERE r.coach_id IS NOT NULL AND (c.id IS NULL OR trim(c.tenant_id::text) <> trim(r.tenant_id::text))',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'WARNING/BLOCKER jika > 0: Ditemukan baris athlete_test_results dengan coach_id lintas-tenant atau tidak valid.'

    UNION ALL
    SELECT
        'legacy_null_recorded_by_user_id_rows',
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NULL THEN 'SKIPPED_TABLE_NOT_YET_CREATED'
            ELSE 'CHECKED'
        END,
        CASE
            WHEN to_regclass('public.athlete_test_results') IS NOT NULL
            THEN COALESCE((xpath('/table/row/cnt/text()', query_to_xml(
                'SELECT COUNT(*)::bigint AS cnt FROM public.athlete_test_results WHERE recorded_by_user_id IS NULL',
                false, false, '')))[1]::text::bigint, 0)
            ELSE NULL::bigint
        END,
        'INFO: Baris dengan recorded_by_user_id NULL tetap terlindungi dari mutasi klien pada pembaruan berikutnya.'
)
SELECT
    check_name,
    check_status,
    issue_count,
    CASE
        WHEN check_status <> 'CHECKED' THEN check_status
        WHEN check_name IN ('athlete_test_results_total_rows', 'legacy_spr10m_nonstandard_jsonb_method_rows', 'legacy_null_recorded_by_user_id_rows') THEN 'INFO'
        WHEN COALESCE(issue_count, 0) = 0 THEN 'PASS'
        WHEN check_name = 'legacy_spr10m_invalid_top_method_rows' THEN 'WARNING_AUTO_SANITIZE'
        ELSE 'BLOCKER'
    END AS severity_status,
    recommendation
FROM legacy_audit;
