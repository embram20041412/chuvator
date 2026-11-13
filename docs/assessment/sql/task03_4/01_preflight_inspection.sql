-- =============================================================================
-- CHUVATOR — TASK 03.4: SUPABASE DATABASE MIGRATION READINESS
-- 01_preflight_inspection.sql (100% READ-ONLY PREFLIGHT INSPECTION)
-- =============================================================================
-- TUJUAN:
--   Memeriksa kondisi aktual database Supabase CHUVATOR SEBELUM menjalankan
--   migrasi Assessment Battery (`public.athlete_test_results`).
-- SIFAT:
--   100% READ-ONLY (hanya query SELECT ke information_schema & pg_catalog).
--   TIDAK melakukan DDL maupun DML.
-- =============================================================================

-- 1. Cek Keberadaan Tabel Prasyarat Inti & Tabel Target
SELECT
    req.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS table_status
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
    CASE WHEN c.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS column_status,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM (
    VALUES
        ('platform_superadmins', 'auth_uid'),
        ('platform_superadmins', 'email'),
        ('tenants', 'id'),
        ('tenants', 'tenant_id'),
        ('tenants', 'owner_uid'),
        ('tenants', 'status'),
        ('tenants', 'is_active'),
        ('users_staff', 'id'),
        ('users_staff', 'uid'),
        ('users_staff', 'tenant_id'),
        ('users_staff', 'role'),
        ('users_staff', 'status'),
        ('users_staff', 'is_active'),
        ('academies', 'id'),
        ('academies', 'tenant_id'),
        ('academy_classes', 'id'),
        ('academy_classes', 'tenant_id'),
        ('academy_classes', 'academy_id'),
        ('academy_classes', 'coach_id'),
        ('academy_classes', 'is_archived'),
        ('coaches', 'id'),
        ('coaches', 'tenant_id'),
        ('coaches', 'academy_id'),
        ('coaches', 'auth_uid'),
        ('students', 'id'),
        ('students', 'tenant_id'),
        ('students', 'academy_id'),
        ('students', 'class_id'),
        ('students', 'birth_date')
) AS req(table_name, column_name)
LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = req.table_name
   AND c.column_name = req.column_name
ORDER BY req.table_name, req.column_name;

-- 3. Cek Ekstensi yang Dibutuhkan (pgcrypto untuk gen_random_uuid jika versi PG < 13)
SELECT
    extname AS extension_name,
    extversion,
    n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname IN ('pgcrypto', 'uuid-ossp');

-- 4. Cek Status Eksisting public.athlete_test_results (jika sudah pernah dibuat)
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

-- 5. Cek Fungsi RBAC Inti & Helper Assessment Battery Eksisting
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    p.proconfig AS function_config,
    pg_get_userbyid(p.proowner) AS owner_role
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

-- 6. Cek Status RLS & Kebijakan Eksisting pada athlete_test_results dan Tabel Terkait
SELECT
    tablename,
    rowsecurity AS rls_enabled,
    forcerowsecurity AS force_rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'tenants', 'users_staff', 'academies', 'academy_classes',
      'coaches', 'students', 'academy_evaluations', 'athlete_test_results'
  )
ORDER BY tablename;

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

-- 7. Cek Trigger & Indeks Eksisting pada public.athlete_test_results
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

-- 8. Cek Integritas Data Referensial Tabel Prasyarat (Orphan / Missing tenant_id)
SELECT 'students_missing_tenant' AS check_name, COUNT(*) AS issue_count
FROM public.students WHERE tenant_id IS NULL OR trim(tenant_id::text) = ''
UNION ALL
SELECT 'academy_classes_missing_tenant', COUNT(*)
FROM public.academy_classes WHERE tenant_id IS NULL OR trim(tenant_id::text) = ''
UNION ALL
SELECT 'coaches_missing_tenant', COUNT(*)
FROM public.coaches WHERE tenant_id IS NULL OR trim(tenant_id::text) = ''
UNION ALL
SELECT 'tenants_missing_canonical_tenant_id', COUNT(*)
FROM public.tenants WHERE tenant_id IS NULL OR trim(tenant_id::text) = '';
