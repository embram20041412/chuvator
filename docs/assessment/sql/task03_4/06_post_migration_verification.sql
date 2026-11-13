-- =============================================================================
-- CHUVATOR — TASK 03.4.3: SUPABASE DATABASE MIGRATION READINESS (REMEDIATED)
-- 06_post_migration_verification.sql (CATALOG AUDIT & 19-SCENARIO SECURITY SUITE)
-- =============================================================================
-- BAGIAN A: Kueri Verifikasi Katalog Read-Only (Aman dijalankan langsung).
-- BAGIAN B: Simulasi Pengujian Keamanan & Integritas 19 Skenario Lengkap
--           di dalam transaksi NON-DESTRUKTIF (`BEGIN; ... ROLLBACK;`).
-- PRASYARAT BAGIAN B:
--   Dijalankan oleh role `postgres` / superuser pada Supabase SQL Editor
--   atau lingkungan staging agar `set_config('role', 'authenticated'/'anon', true)`
--   dan `request.jwt.claims` dapat mensimulasikan setiap peran tanpa mengubah data.
-- =============================================================================

-- =============================================================================
-- BAGIAN A: READ-ONLY CATALOG VERIFICATION
-- =============================================================================

-- A1. Verifikasi Tabel, RLS, dan FORCE RLS
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

-- A5. Verifikasi Fungsi SECURITY DEFINER, Owner, search_path, & Privilege Eksekusi
SELECT
    p.proname AS function_name,
    pg_get_userbyid(p.proowner) AS owner_role,
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

-- A7. Inspeksi Foreign Key coaches.auth_uid_fkey & Struktur Aktual auth.users (Kolom, Constraint, Trigger, Dependency)
SELECT
    con.conname AS constraint_name,
    ns_src.nspname AS source_schema,
    rel_src.relname AS source_table,
    att_src.attname AS source_column,
    ns_ref.nspname AS target_schema,
    rel_ref.relname AS target_table,
    att_ref.attname AS target_column,
    pg_catalog.format_type(att_ref.atttypid, att_ref.atttypmod) AS target_column_type,
    pg_catalog.pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class rel_src ON rel_src.oid = con.conrelid
JOIN pg_catalog.pg_namespace ns_src ON ns_src.oid = rel_src.relnamespace
JOIN pg_catalog.pg_attribute att_src ON att_src.attrelid = con.conrelid AND att_src.attnum = con.conkey[1]
JOIN pg_catalog.pg_class rel_ref ON rel_ref.oid = con.confrelid
JOIN pg_catalog.pg_namespace ns_ref ON ns_ref.oid = rel_ref.relnamespace
JOIN pg_catalog.pg_attribute att_ref ON att_ref.attrelid = con.confrelid AND att_ref.attnum = con.confkey[1]
WHERE ns_src.nspname = 'public'
  AND rel_src.relname = 'coaches'
  AND con.contype = 'f'
ORDER BY con.conname;

SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY ordinal_position;

SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_catalog.pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
ORDER BY con.conname;

SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS enabled_mode,
    pg_catalog.pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT
    ns_src.nspname AS dependent_schema,
    rel_src.relname AS dependent_table,
    con.conname AS fk_constraint_name,
    pg_catalog.pg_get_constraintdef(con.oid) AS fk_definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class rel_src ON rel_src.oid = con.conrelid
JOIN pg_catalog.pg_namespace ns_src ON ns_src.oid = rel_src.relnamespace
JOIN pg_catalog.pg_class rel_ref ON rel_ref.oid = con.confrelid
JOIN pg_catalog.pg_namespace ns_ref ON ns_ref.oid = rel_ref.relnamespace
WHERE ns_ref.nspname = 'auth'
  AND rel_ref.relname = 'users'
  AND con.contype = 'f'
ORDER BY ns_src.nspname, rel_src.relname, con.conname;

-- =============================================================================
-- BAGIAN B: NON-DESTRUCTIVE 19-SCENARIO VERIFICATION SUITE (BEGIN ... ROLLBACK)
-- =============================================================================
BEGIN;

DO $$
DECLARE
    -- Tenant Fixtures
    v_tenant_a TEXT := 't034-tenant-a-verify';
    v_tenant_b TEXT := 't034-tenant-b-verify';
    v_tenant_c TEXT := 't034-tenant-c-inactive';
    v_tenant_a_uuid UUID := '34000000-0000-4000-8000-00000000000a';
    v_tenant_b_uuid UUID := '34000000-0000-4000-8000-00000000000b';
    v_tenant_c_uuid UUID := '34000000-0000-4000-8000-00000000000c';

    -- Actor UIDs (platform_superadmins.auth_uid, tenants.owner_uid, users_staff.uid bertipe TEXT;
    -- coaches.auth_uid bertipe UUID pada database target)
    v_superadmin_uid     TEXT := '34000000-0000-4000-8000-000000000101';
    v_owner_a_uid        TEXT := '34000000-0000-4000-8000-000000000102';
    v_admin_a_uid        TEXT := '34000000-0000-4000-8000-000000000103';
    v_coach_a1_uid       UUID := '34000000-0000-4000-8000-000000000104';
    v_coach_a2_uid       UUID := '34000000-0000-4000-8000-000000000105';
    v_kasir_a_uid        TEXT := '34000000-0000-4000-8000-000000000106';
    v_staff_a_uid        TEXT := '34000000-0000-4000-8000-000000000107';
    v_outsider_uid       TEXT := '34000000-0000-4000-8000-000000000108';
    v_inactive_staff_uid TEXT := '34000000-0000-4000-8000-000000000109';
    v_coach_noclass_uid  UUID := '34000000-0000-4000-8000-000000000110';
    v_coach_unlinked_uid UUID := '34000000-0000-4000-8000-000000000111';
    v_owner_c_uid        TEXT := '34000000-0000-4000-8000-000000000112';
    v_coach_b1_uid       UUID := '34000000-0000-4000-8000-000000000198';
    v_owner_b_uid        TEXT := '34000000-0000-4000-8000-000000000199';

    -- Domain Fixtures
    v_acad_a         UUID := '34000000-0000-4000-8000-000000000201';
    v_acad_a_other   UUID := '34000000-0000-4000-8000-000000000203';
    v_acad_b         UUID := '34000000-0000-4000-8000-000000000202';
    v_acad_c         UUID := '34000000-0000-4000-8000-000000000204';
    v_coach_a1_id    UUID := '34000000-0000-4000-8000-000000000301';
    v_coach_a2_id    UUID := '34000000-0000-4000-8000-000000000302';
    v_coach_noclass_id UUID := '34000000-0000-4000-8000-000000000303';
    v_coach_b1_id    UUID := '34000000-0000-4000-8000-000000000304';
    v_class_a1_id    UUID := '34000000-0000-4000-8000-000000000401';
    v_class_a2_id    UUID := '34000000-0000-4000-8000-000000000402';
    v_class_b1_id    UUID := '34000000-0000-4000-8000-000000000403';
    v_class_c1_id    UUID := '34000000-0000-4000-8000-000000000404';
    v_stu_a1_id      UUID := '34000000-0000-4000-8000-000000000501';
    v_stu_a2_id      UUID := '34000000-0000-4000-8000-000000000502';
    v_stu_b1_id      UUID := '34000000-0000-4000-8000-000000000503';
    v_stu_c1_id      UUID := '34000000-0000-4000-8000-000000000504';

    v_res_owner_id     UUID := '34000000-0000-4000-8000-000000000601';
    v_res_owner_del_id UUID := '34000000-0000-4000-8000-000000000606';
    v_res_admin_id     UUID := '34000000-0000-4000-8000-000000000602';
    v_res_coach_id     UUID := '34000000-0000-4000-8000-000000000603';
    v_res_coach_vid_id UUID := '34000000-0000-4000-8000-000000000604';
    v_res_b_id         UUID := '34000000-0000-4000-8000-000000000605';
    v_res_c_id         UUID := '34000000-0000-4000-8000-000000000607';
    v_res_null_rec_id  UUID := '34000000-0000-4000-8000-000000000608';
    v_res_ws_id        UUID := '34000000-0000-4000-8000-000000000609';
    v_res_legacy_id    UUID := '34000000-0000-4000-8000-000000000610';

    v_count INT;
    v_affected INT;
    v_bool BOOLEAN;
    v_bound_coach UUID;
    v_sync_method TEXT;
    v_sync_period TEXT;
    v_sync_age_grp TEXT;
    v_sync_age_yrs INT;
    v_has_coaches_auth_uid BOOLEAN;
    v_has_tenants_tenant_id BOOLEAN;
    v_has_tenants_is_active BOOLEAN;
    v_has_staff_is_active BOOLEAN;
    v_has_auth_users BOOLEAN;
    v_fk_name TEXT;
    v_fk_target_schema TEXT;
    v_fk_target_table TEXT;
    v_fk_target_col TEXT;
    v_fk_target_col_type TEXT;
    v_auth_missing_req_cols TEXT;
    v_passed_scenarios INT := 0;
BEGIN
    -- 0. Pra-syarat Skema Fixture & Validasi FK coaches_auth_uid_fkey -> auth.users(id)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name = 'auth_uid'
    ) INTO v_has_coaches_auth_uid;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'tenant_id'
    ) INTO v_has_tenants_tenant_id;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'is_active'
    ) INTO v_has_tenants_is_active;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users_staff' AND column_name = 'is_active'
    ) INTO v_has_staff_is_active;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) INTO v_has_auth_users;

    IF NOT v_has_coaches_auth_uid OR NOT v_has_tenants_tenant_id OR NOT v_has_auth_users THEN
        RAISE EXCEPTION 'PRASYARAT SIMULASI BELUM TERPENUHI: coaches.auth_uid (%), tenants.tenant_id (%), atau auth.users (%) belum tersedia.',
            v_has_coaches_auth_uid, v_has_tenants_tenant_id, v_has_auth_users;
    END IF;

    SELECT
        con.conname,
        ns_ref.nspname,
        rel_ref.relname,
        att_ref.attname,
        pg_catalog.format_type(att_ref.atttypid, att_ref.atttypmod)
    INTO
        v_fk_name,
        v_fk_target_schema,
        v_fk_target_table,
        v_fk_target_col,
        v_fk_target_col_type
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel_src ON rel_src.oid = con.conrelid
    JOIN pg_catalog.pg_namespace ns_src ON ns_src.oid = rel_src.relnamespace
    JOIN pg_catalog.pg_attribute att_src ON att_src.attrelid = con.conrelid AND att_src.attnum = con.conkey[1]
    JOIN pg_catalog.pg_class rel_ref ON rel_ref.oid = con.confrelid
    JOIN pg_catalog.pg_namespace ns_ref ON ns_ref.oid = rel_ref.relnamespace
    JOIN pg_catalog.pg_attribute att_ref ON att_ref.attrelid = con.confrelid AND att_ref.attnum = con.confkey[1]
    WHERE ns_src.nspname = 'public'
      AND rel_src.relname = 'coaches'
      AND con.contype = 'f'
      AND (con.conname = 'coaches_auth_uid_fkey' OR att_src.attname = 'auth_uid')
    ORDER BY (con.conname = 'coaches_auth_uid_fkey') DESC
    LIMIT 1;

    IF v_fk_name IS NOT NULL AND (
        v_fk_target_schema IS DISTINCT FROM 'auth'
        OR v_fk_target_table IS DISTINCT FROM 'users'
        OR v_fk_target_col IS DISTINCT FROM 'id'
    ) THEN
        RAISE EXCEPTION 'KETIDAKSESUAIAN SKEMA FK %: Target aktual adalah %.%(%), bukan auth.users(id).',
            v_fk_name, v_fk_target_schema, v_fk_target_table, v_fk_target_col;
    END IF;

    -- Pastikan auth.users tidak memiliki kolom NOT NULL tanpa default di luar (id, email, email_confirmed_at, aud, role)
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
        RAISE EXCEPTION 'PRASYARAT FIXTURE auth.users: Kolom NOT NULL tanpa default terdeteksi (%). Sesuaikan daftar kolom INSERT auth.users sebelum eksekusi.',
            v_auth_missing_req_cols;
    END IF;

    -- 1. Pastikan tidak ada collision fixture pada auth.users, tenants, users_staff, platform_superadmins, & coaches
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id IN (v_tenant_a_uuid, v_tenant_b_uuid, v_tenant_c_uuid)) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION: Tenant fixture UUID sudah ada di database.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM auth.users
        WHERE id IN (
            v_superadmin_uid::uuid, v_owner_a_uid::uuid, v_owner_b_uid::uuid, v_owner_c_uid::uuid,
            v_admin_a_uid::uuid, v_coach_a1_uid, v_coach_a2_uid, v_coach_noclass_uid,
            v_coach_unlinked_uid, v_coach_b1_uid, v_kasir_a_uid::uuid, v_staff_a_uid::uuid,
            v_inactive_staff_uid::uuid, v_outsider_uid::uuid
        )
           OR LOWER(email) IN (
            'verify-superadmin-t034@chuvator.test', 'owner-a-t034@chuvator.test',
            'owner-b-t034@chuvator.test', 'owner-c-t034@chuvator.test',
            'admin-a@chuvator.test', 'coach-a1@chuvator.test',
            'coach-a2@chuvator.test', 'coach-noclass@chuvator.test',
            'coach-unlinked@chuvator.test', 'coach-b1@chuvator.test',
            'kasir-a@chuvator.test', 'staff-a@chuvator.test',
            'inactive-a@chuvator.test', 'outsider-t034@chuvator.test'
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION: UID atau email fixture sudah terdaftar di auth.users.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.coaches
        WHERE id IN (v_coach_a1_id, v_coach_a2_id, v_coach_noclass_id, v_coach_b1_id)
           OR auth_uid IN (v_coach_a1_uid, v_coach_a2_uid, v_coach_noclass_uid, v_coach_b1_uid)
    ) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION: Coach fixture ID/auth_uid sudah ada di public.coaches.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.users_staff
        WHERE uid IN (
            v_admin_a_uid, v_coach_a1_uid::text, v_coach_a2_uid::text, v_coach_noclass_uid::text,
            v_coach_unlinked_uid::text, v_kasir_a_uid, v_staff_a_uid, v_inactive_staff_uid
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE COLLISION: UID fixture staf sudah ada di public.users_staff.';
    END IF;

    -- 2. Siapkan fixture auth.users (pola resmi tests/test_rls_security_scenarios.sql dalam BEGIN..ROLLBACK) sebelum INSERT public.coaches
    INSERT INTO auth.users (id, email, email_confirmed_at, aud, role)
    VALUES
        (v_superadmin_uid::uuid,     'verify-superadmin-t034@chuvator.test', now(), 'authenticated', 'authenticated'),
        (v_owner_a_uid::uuid,        'owner-a-t034@chuvator.test',           now(), 'authenticated', 'authenticated'),
        (v_owner_b_uid::uuid,        'owner-b-t034@chuvator.test',           now(), 'authenticated', 'authenticated'),
        (v_owner_c_uid::uuid,        'owner-c-t034@chuvator.test',           now(), 'authenticated', 'authenticated'),
        (v_admin_a_uid::uuid,        'admin-a@chuvator.test',                now(), 'authenticated', 'authenticated'),
        (v_coach_a1_uid,             'coach-a1@chuvator.test',               now(), 'authenticated', 'authenticated'),
        (v_coach_a2_uid,             'coach-a2@chuvator.test',               now(), 'authenticated', 'authenticated'),
        (v_coach_noclass_uid,        'coach-noclass@chuvator.test',          now(), 'authenticated', 'authenticated'),
        (v_coach_unlinked_uid,       'coach-unlinked@chuvator.test',         now(), 'authenticated', 'authenticated'),
        (v_coach_b1_uid,             'coach-b1@chuvator.test',               now(), 'authenticated', 'authenticated'),
        (v_kasir_a_uid::uuid,        'kasir-a@chuvator.test',                now(), 'authenticated', 'authenticated'),
        (v_staff_a_uid::uuid,        'staff-a@chuvator.test',                now(), 'authenticated', 'authenticated'),
        (v_inactive_staff_uid::uuid, 'inactive-a@chuvator.test',             now(), 'authenticated', 'authenticated'),
        (v_outsider_uid::uuid,       'outsider-t034@chuvator.test',          now(), 'authenticated', 'authenticated');

    INSERT INTO public.platform_superadmins (auth_uid, email)
    VALUES (v_superadmin_uid, 'verify-superadmin-t034@chuvator.test');

    INSERT INTO public.tenants (id, tenant_id, name, owner_uid, status)
    VALUES
        (v_tenant_a_uuid, v_tenant_a, 'SSB Verify Tenant A', v_owner_a_uid, 'active'),
        (v_tenant_b_uuid, v_tenant_b, 'SSB Verify Tenant B', v_owner_b_uid, 'active'),
        (v_tenant_c_uuid, v_tenant_c, 'SSB Verify Tenant C Inactive', v_owner_c_uid, 'inactive');

    IF v_has_tenants_is_active THEN
        EXECUTE 'UPDATE public.tenants SET is_active = FALSE WHERE id = $1' USING v_tenant_c_uuid;
    END IF;

    INSERT INTO public.users_staff (uid, tenant_id, email, name, role, status)
    VALUES
        (v_admin_a_uid,              v_tenant_a, 'admin-a@chuvator.test',        'Admin A',        'admin', 'active'),
        (v_coach_a1_uid::text,       v_tenant_a, 'coach-a1@chuvator.test',       'Coach A1',       'coach', 'active'),
        (v_coach_a2_uid::text,       v_tenant_a, 'coach-a2@chuvator.test',       'Coach A2',       'coach', 'active'),
        (v_coach_noclass_uid::text,  v_tenant_a, 'coach-noclass@chuvator.test',  'Coach NoClass',  'coach', 'active'),
        (v_coach_unlinked_uid::text, v_tenant_a, 'coach-unlinked@chuvator.test', 'Coach Unlinked', 'coach', 'active'),
        (v_kasir_a_uid,              v_tenant_a, 'kasir-a@chuvator.test',        'Kasir A',        'kasir', 'active'),
        (v_staff_a_uid,              v_tenant_a, 'staff-a@chuvator.test',        'Staff A',        'staff', 'active'),
        (v_inactive_staff_uid,       v_tenant_a, 'inactive-a@chuvator.test',     'Inactive A',     'coach', 'inactive');

    IF v_has_staff_is_active THEN
        EXECUTE 'UPDATE public.users_staff SET is_active = TRUE WHERE tenant_id = $1 AND uid <> $2'
            USING v_tenant_a, v_inactive_staff_uid;
        EXECUTE 'UPDATE public.users_staff SET is_active = FALSE WHERE uid = $1'
            USING v_inactive_staff_uid;
    END IF;

    INSERT INTO public.academies (id, tenant_id, academy_name, name)
    VALUES
        (v_acad_a,       v_tenant_a, 'Akademi A Utama', 'Akademi A Utama'),
        (v_acad_a_other, v_tenant_a, 'Akademi A Cabang', 'Akademi A Cabang'),
        (v_acad_b,       v_tenant_b, 'Akademi B', 'Akademi B'),
        (v_acad_c,       v_tenant_c, 'Akademi C', 'Akademi C');

    -- Pastikan seluruh parent coach auth_uid tersedia pada auth.users(id) sebelum INSERT public.coaches
    SELECT COUNT(*) INTO v_count
    FROM auth.users
    WHERE id IN (v_coach_a1_uid, v_coach_a2_uid, v_coach_noclass_uid, v_coach_b1_uid);

    IF v_count <> 4 THEN
        RAISE EXCEPTION 'PRASYARAT FIXTURE FK coaches_auth_uid_fkey: Hanya % dari 4 parent user coach yang tersedia di auth.users.', v_count;
    END IF;

    INSERT INTO public.coaches (id, tenant_id, academy_id, name, status, auth_uid)
    VALUES
        (v_coach_a1_id,      v_tenant_a, v_acad_a, 'Coach A1',       'active', v_coach_a1_uid),
        (v_coach_a2_id,      v_tenant_a, v_acad_a, 'Coach A2',       'active', v_coach_a2_uid),
        (v_coach_noclass_id, v_tenant_a, v_acad_a, 'Coach No Class', 'active', v_coach_noclass_uid),
        (v_coach_b1_id,      v_tenant_b, v_acad_b, 'Coach B1',       'active', v_coach_b1_uid);

    INSERT INTO public.academy_classes (id, tenant_id, academy_id, class_name, coach_id)
    VALUES
        (v_class_a1_id, v_tenant_a, v_acad_a, 'Kelas U12 A1', v_coach_a1_id),
        (v_class_a2_id, v_tenant_a, v_acad_a, 'Kelas U14 A2', v_coach_a2_id),
        (v_class_b1_id, v_tenant_b, v_acad_b, 'Kelas U12 B1', v_coach_b1_id),
        (v_class_c1_id, v_tenant_c, v_acad_c, 'Kelas U12 C1', NULL);

    INSERT INTO public.students (id, tenant_id, academy_id, class_id, student_name, birth_date)
    VALUES
        (v_stu_a1_id, v_tenant_a, v_acad_a, v_class_a1_id, 'Atlet A1', '2014-05-10'),
        (v_stu_a2_id, v_tenant_a, v_acad_a, v_class_a2_id, 'Atlet A2', '2012-03-14'),
        (v_stu_b1_id, v_tenant_b, v_acad_b, v_class_b1_id, 'Atlet B1', '2014-07-20'),
        (v_stu_c1_id, v_tenant_c, v_acad_c, v_class_c1_id, 'Atlet C1', '2014-08-01');

    -- Seed record Tenant B, Tenant C (inactive), & record legacy Tenant A tanpa recorded_by_user_id
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, coach_id,
        recorded_by_user_id, recorded_by_name,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES
    (
        v_res_b_id, v_tenant_b, v_acad_b, v_class_b1_id, v_stu_b1_id, v_coach_b1_id,
        NULL, 'Pelatih B',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-01', 'MULTI_TRIAL_BEST_MIN', 2.05, 's',
        '2.05 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"ageGroup":"U-12","ageYearsAtTest":12}}'::jsonb
    ),
    (
        v_res_c_id, v_tenant_c, v_acad_c, v_class_c1_id, v_stu_c1_id, NULL,
        NULL, 'Pelatih C',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-02', 'MULTI_TRIAL_BEST_MIN', 2.15, 's',
        '2.15 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
    ),
    (
        v_res_null_rec_id, v_tenant_a, v_acad_a, v_class_a2_id, v_stu_a2_id, v_coach_a2_id,
        NULL, 'Legacy Recorder',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-05', 'MULTI_TRIAL_BEST_MIN', 2.08, 's',
        '2.08 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"ageGroup":"U-14","ageYearsAtTest":14}}'::jsonb
    );

    -- Switch ke role `authenticated` untuk menguji RLS nyata
    PERFORM set_config('role', 'authenticated', true);

    -- =========================================================================
    -- TEST 1: TENANT OWNER (INSERT, SELECT, UPDATE, DELETE + Sync & Isolasi Tenant)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);

    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id,
        recorded_by_name,
        test_id, indicator_id, indicator_name, category_id, development_tier,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES
    (
        v_res_owner_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
        'Owner A',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical', 'TIER_2_FOUNDATION',
        '2026-10-15', 'MULTI_TRIAL_BEST_MIN', 2.12, 's',
        '2.12 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL","athleteTestContext":{"ageGroup":"U-12","ageYearsAtTest":12}}'::jsonb
    ),
    (
        v_res_owner_del_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
        'Owner A',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical', 'TIER_2_FOUNDATION',
        '2026-10-15', 'MULTI_TRIAL_BEST_MIN', 2.19, 's',
        '2.19 s', 'MIN', '{"measurementMethod":"SMARTPHONE_VIDEO","athleteTestContext":{"ageGroup":"U-12","ageYearsAtTest":12}}'::jsonb
    );

    SELECT measurement_method, test_period, age_group, age_years_at_test
    INTO v_sync_method, v_sync_period, v_sync_age_grp, v_sync_age_yrs
    FROM public.athlete_test_results WHERE id = v_res_owner_id;

    IF v_sync_method <> 'STOPWATCH_MANUAL' OR v_sync_period <> '2026-10' OR v_sync_age_grp <> 'U-12' OR v_sync_age_yrs <> 12 THEN
        RAISE EXCEPTION 'FAIL TEST 1A: Sinkronisasi kolom konteks gagal (% / % / % / %).', v_sync_method, v_sync_period, v_sync_age_grp, v_sync_age_yrs;
    END IF;

    UPDATE public.athlete_test_results SET notes = 'Owner A Update OK' WHERE id = v_res_owner_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN RAISE EXCEPTION 'FAIL TEST 1B: Owner A gagal UPDATE row sendiri.'; END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_owner_del_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN RAISE EXCEPTION 'FAIL TEST 1C: Owner A gagal DELETE row sendiri.'; END IF;

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_b;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL TEST 1D: Owner A dapat membaca data Tenant B.'; END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 1: Tenant Owner INSERT/SELECT/UPDATE/DELETE & isolasi tenant B';

    -- =========================================================================
    -- TEST 2: TENANT ADMIN (INSERT, SELECT, UPDATE, DELETE pada Tenant A)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_a_uid, 'role', 'authenticated')::text, true);

    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, recorded_by_name,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES (
        v_res_admin_id, v_tenant_a, v_acad_a, v_class_a2_id, v_stu_a2_id, 'Admin A',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-16', 'MULTI_TRIAL_BEST_MIN', 1.98, 's',
        '1.98 s', 'MIN', '{"measurementMethod":"SMARTPHONE_VIDEO","athleteTestContext":{"ageGroup":"U-14","ageYearsAtTest":14}}'::jsonb
    );

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_a;
    IF v_count < 2 THEN RAISE EXCEPTION 'FAIL TEST 2A: Admin A gagal SELECT data Tenant A.'; END IF;

    UPDATE public.athlete_test_results SET notes = 'Verifikasi Admin OK' WHERE id = v_res_admin_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN RAISE EXCEPTION 'FAIL TEST 2B: Admin A gagal UPDATE.'; END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 2: Tenant Admin INSERT/SELECT/UPDATE Tenant A';

    -- =========================================================================
    -- TEST 3: COACH DALAM CAKUPAN KELAS (SELECT/INSERT/UPDATE/DELETE + Multi-Metode)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coach_a1_uid::text, 'role', 'authenticated')::text, true);

    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id, coach_id, recorded_by_name,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES
    (
        v_res_coach_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, NULL, 'Coach A1',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-20', 'MULTI_TRIAL_BEST_MIN', 2.09, 's',
        '2.09 s', 'MIN', '{"measurementMethod":"STOPWATCH_MANUAL"}'::jsonb
    ),
    (
        v_res_coach_vid_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, v_coach_a1_id, 'Coach A1',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-20', 'MULTI_TRIAL_BEST_MIN', 2.21, 's',
        '2.21 s', 'MIN', '{"measurementMethod":"SMARTPHONE_VIDEO"}'::jsonb
    );

    SELECT coach_id INTO v_bound_coach FROM public.athlete_test_results WHERE id = v_res_coach_id;
    IF v_bound_coach IS DISTINCT FROM v_coach_a1_id THEN
        RAISE EXCEPTION 'FAIL TEST 3A: coach_id NULL pada INSERT oleh Coach A1 wajib otomatis diikat ke v_coach_a1_id.';
    END IF;

    UPDATE public.athlete_test_results SET notes = 'Coach A1 Update OK' WHERE id = v_res_coach_vid_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN RAISE EXCEPTION 'FAIL TEST 3B: Coach A1 gagal UPDATE hasil siswa kelasnya.'; END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_coach_vid_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN RAISE EXCEPTION 'FAIL TEST 3C: Coach A1 gagal DELETE hasil siswa kelasnya.'; END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 3: Coach in-scope SELECT/INSERT/UPDATE/DELETE & multi-metode longitudinal';

    -- =========================================================================
    -- TEST 4: COACH DI KELAS LAIN (SELECT=0, INSERT=42501, UPDATE=0, DELETE=0)
    -- =========================================================================
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE student_id = v_stu_a2_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL TEST 4A: Kebocoran SELECT! Coach A1 dapat melihat % baris siswa Kelas A2.', v_count;
    END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a2_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-21', 'MULTI_TRIAL_BEST_MIN', 2.01, 's', '2.01 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 4B: Coach A1 berhasil INSERT siswa kelas A2 dengan spoofing class A1!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    UPDATE public.athlete_test_results SET notes = 'Spoof' WHERE id = v_res_admin_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN RAISE EXCEPTION 'FAIL TEST 4C: Coach A1 berhasil UPDATE siswa kelas A2!'; END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_admin_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN RAISE EXCEPTION 'FAIL TEST 4D: Coach A1 berhasil DELETE siswa kelas A2!'; END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 4: Coach out-of-class ditolak SELECT/INSERT/UPDATE/DELETE (0 rows & 42501)';

    -- =========================================================================
    -- TEST 5: COACH TANPA KELAS AKTIF (FAIL-CLOSED: SELECT=0, INSERT=42501)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coach_noclass_uid::text, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_a;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL TEST 5A: Fail-Open! Coach tanpa kelas aktif dapat membaca % baris.', v_count;
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
            '2026-10-21', 'MULTI_TRIAL_BEST_MIN', 2.02, 's', '2.02 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 5B: Fail-Open! Coach tanpa kelas aktif berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 5: Coach tanpa kelas aktif ditolak penuh (fail-closed)';

    -- =========================================================================
    -- TEST 6: COACH TANPA RELASI public.coaches (FAIL-CLOSED: SELECT=0, INSERT=42501)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coach_unlinked_uid::text, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_a;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL TEST 6A: Fail-Open! Coach tanpa profil coaches dapat membaca % baris.', v_count;
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
            '2026-10-21', 'MULTI_TRIAL_BEST_MIN', 2.03, 's', '2.03 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 6B: Fail-Open! Coach tanpa profil coaches berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 6: Coach tanpa relasi public.coaches ditolak penuh (fail-closed)';

    -- =========================================================================
    -- TEST 7: KASIR (SELECT boleh, INSERT/UPDATE/DELETE wajib ditolak)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kasir_a_uid, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_a;
    IF v_count < 1 THEN RAISE EXCEPTION 'FAIL TEST 7A: Kasir tidak dapat membaca hasil tes tenant sendiri.'; END IF;

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
        RAISE EXCEPTION 'FAIL TEST 7B: Kasir berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    UPDATE public.athlete_test_results SET notes = 'Kasir Spoof' WHERE id = v_res_owner_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN RAISE EXCEPTION 'FAIL TEST 7C: Kasir berhasil UPDATE!'; END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_owner_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN RAISE EXCEPTION 'FAIL TEST 7D: Kasir berhasil DELETE!'; END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 7: Kasir read-only (SELECT allowed, WRITE rejected)';

    -- =========================================================================
    -- TEST 8: STAFF (SELECT boleh, INSERT/UPDATE/DELETE wajib ditolak)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_a_uid, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results WHERE tenant_id = v_tenant_a;
    IF v_count < 1 THEN RAISE EXCEPTION 'FAIL TEST 8A: Staff tidak dapat membaca hasil tes tenant sendiri.'; END IF;

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
        RAISE EXCEPTION 'FAIL TEST 8B: Staff berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    UPDATE public.athlete_test_results SET notes = 'Staff Spoof' WHERE id = v_res_owner_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN RAISE EXCEPTION 'FAIL TEST 8C: Staff berhasil UPDATE!'; END IF;

    DELETE FROM public.athlete_test_results WHERE id = v_res_owner_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 0 THEN RAISE EXCEPTION 'FAIL TEST 8D: Staff berhasil DELETE!'; END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 8: Staff read-only (SELECT allowed, WRITE rejected)';

    -- =========================================================================
    -- TEST 9: SUPERADMIN / PLATFORM OWNER (Diblokir total SELECT/INSERT/UPDATE/DELETE)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_superadmin_uid, 'role', 'authenticated')::text, true);

    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL TEST 9A: Superadmin membaca % baris!', v_count; END IF;

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
        RAISE EXCEPTION 'FAIL TEST 9B: Superadmin berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 9: Superadmin diblokir total dari operasional Assessment Battery';

    -- =========================================================================
    -- TEST 10: OUTSIDER & STAFF NON-AKTIF (Diblokir total)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider_uid, 'role', 'authenticated')::text, true);
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL TEST 10A: Outsider dapat membaca data.'; END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_inactive_staff_uid, 'role', 'authenticated')::text, true);
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL TEST 10B: Staff non-aktif dapat membaca data.'; END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 10: Outsider & staf non-aktif ditolak total';

    -- =========================================================================
    -- TEST 11: TENANT NON-AKTIF (Owner tenant inactive ditolak total)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_c_uid, 'role', 'authenticated')::text, true);
    SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL TEST 11A: Owner tenant non-aktif dapat membaca data!'; END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_c, v_acad_c, v_class_c1_id, v_stu_c1_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-23', 'MULTI_TRIAL_BEST_MIN', 2.00, 's', '2.00 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 11B: Owner tenant non-aktif berhasil INSERT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 11: Tenant non-aktif ditolak total';

    -- =========================================================================
    -- TEST 12: ROLE anon (Tabel & Fungsi SECURITY DEFINER wajib 42501)
    -- =========================================================================
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{}', true);

    BEGIN
        SELECT COUNT(*) INTO v_count FROM public.athlete_test_results;
        RAISE EXCEPTION 'FAIL TEST 12A: Role anon dapat melakukan SELECT!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        PERFORM public.athlete_belongs_to_tenant(v_stu_a1_id, v_tenant_a, v_class_a1_id, v_acad_a);
        RAISE EXCEPTION 'FAIL TEST 12B: Role anon dapat mengeksekusi athlete_belongs_to_tenant!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    PERFORM set_config('role', 'authenticated', true);
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 12: Role anon diblokir pada tabel & fungsi';

    -- =========================================================================
    -- TEST 13: ANTI-ENUMERASI RPC athlete_belongs_to_tenant()
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);
    SELECT public.athlete_belongs_to_tenant(v_stu_b1_id, v_tenant_b, v_class_b1_id, v_acad_b) INTO v_bool;
    IF v_bool IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'FAIL TEST 13A: Owner A berhasil mengenumerasi student Tenant B via RPC!';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider_uid, 'role', 'authenticated')::text, true);
    SELECT public.athlete_belongs_to_tenant(v_stu_a1_id, v_tenant_a, v_class_a1_id, v_acad_a) INTO v_bool;
    IF v_bool IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'FAIL TEST 13B: Outsider berhasil mengenumerasi student Tenant A via RPC!';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coach_a1_uid::text, 'role', 'authenticated')::text, true);
    SELECT public.athlete_belongs_to_tenant(v_stu_a2_id, v_tenant_a, v_class_a2_id, v_acad_a) INTO v_bool;
    IF v_bool IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'FAIL TEST 13C: Coach A1 berhasil mengenumerasi student Kelas A2 via RPC!';
    END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 13: Anti-enumerasi RPC athlete_belongs_to_tenant terverifikasi';

    -- =========================================================================
    -- TEST 14: SPOOFING tenant_id, student_id & academy_id LINTAS-BATAS
    -- =========================================================================
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
        RAISE EXCEPTION 'FAIL TEST 14A: Spoofing student_id Tenant B berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a_other, v_class_a1_id, v_stu_a1_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-24', 'MULTI_TRIAL_BEST_MIN', 2.00, 's', '2.00 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 14B: Inkonsistensi academy_id terhadap students.academy_id berhasil disisipkan!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 14: Spoofing tenant_id, student_id, & academy_id ditolak';

    -- =========================================================================
    -- TEST 15: SPOOFING coach_id LINTAS-TENANT & LINTAS-PELATIH
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, coach_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, v_coach_b1_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-24', 'MULTI_TRIAL_BEST_MIN', 2.00, 's', '2.00 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 15A: Penyisipan coach_id milik Tenant B berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coach_a1_uid::text, 'role', 'authenticated')::text, true);
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id, coach_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id, v_coach_a2_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-24', 'MULTI_TRIAL_BEST_MIN', 2.00, 's', '2.00 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 15B: Coach A1 berhasil menyisipkan coach_id milik Coach A2!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 15: Spoofing coach_id lintas-tenant & lintas-pelatih ditolak';

    -- =========================================================================
    -- TEST 16: IMUTABILITAS AUDIT (recorded_by_user_id NULL->UUID, recorded_by_name, tenant_id)
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a_uid, 'role', 'authenticated')::text, true);

    BEGIN
        UPDATE public.athlete_test_results
        SET recorded_by_user_id = v_owner_a_uid::uuid
        WHERE id = v_res_null_rec_id;
        RAISE EXCEPTION 'FAIL TEST 16A: Mutasi recorded_by_user_id dari NULL ke UUID berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results
        SET recorded_by_name = 'Hijacked Name'
        WHERE id = v_res_null_rec_id;
        RAISE EXCEPTION 'FAIL TEST 16B: Mutasi recorded_by_name berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results SET tenant_id = v_tenant_b WHERE id = v_res_owner_id;
        RAISE EXCEPTION 'FAIL TEST 16C: Mutasi tenant_id berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;

    BEGIN
        UPDATE public.athlete_test_results SET test_id = 'TST-SPR-20M' WHERE id = v_res_owner_id;
        RAISE EXCEPTION 'FAIL TEST 16D: Mutasi test_id berhasil!';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 16: Imutabilitas kolom audit & identitas terverifikasi penuh';

    -- =========================================================================
    -- TEST 17: SINKRONISASI ULANG KONTEKS SAAT UPDATE derived_metrics
    -- =========================================================================
    UPDATE public.athlete_test_results
    SET derived_metrics = '{"measurementMethod":"SMARTPHONE_VIDEO","athleteTestContext":{"ageGroup":"U-14","ageYearsAtTest":13}}'::jsonb
    WHERE id = v_res_owner_id;

    SELECT measurement_method, age_group, age_years_at_test
    INTO v_sync_method, v_sync_age_grp, v_sync_age_yrs
    FROM public.athlete_test_results WHERE id = v_res_owner_id;

    IF v_sync_method <> 'SMARTPHONE_VIDEO' OR v_sync_age_grp <> 'U-14' OR v_sync_age_yrs <> 13 THEN
        RAISE EXCEPTION 'FAIL TEST 17: Sinkronisasi ulang kolom konteks saat UPDATE derived_metrics gagal (% / % / %).',
            v_sync_method, v_sync_age_grp, v_sync_age_yrs;
    END IF;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 17: Re-sinkronisasi kolom konteks saat UPDATE derived_metrics terverifikasi';

    -- =========================================================================
    -- TEST 18: SANITASI measurement_method WHITESPACE & LEGACY NONSTANDAR
    -- =========================================================================
    INSERT INTO public.athlete_test_results (
        id, tenant_id, academy_id, class_id, student_id,
        measurement_method,
        test_id, indicator_id, indicator_name, category_id,
        test_date, input_schema_type, final_raw_value, final_unit,
        final_display_value, aggregation_method, derived_metrics
    ) VALUES
    (
        v_res_ws_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
        '   ',
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-25', 'MULTI_TRIAL_BEST_MIN', 2.18, 's', '2.18 s', 'MIN', '{}'::jsonb
    ),
    (
        v_res_legacy_id, v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
        NULL,
        'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
        '2026-10-26', 'MULTI_TRIAL_BEST_MIN', 2.25, 's', '2.25 s', 'MIN',
        '{"measurementMethod":"HAND_TIMER_LEGACY"}'::jsonb
    );

    SELECT measurement_method INTO v_sync_method FROM public.athlete_test_results WHERE id = v_res_ws_id;
    IF v_sync_method IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL TEST 18A: Whitespace measurement_method harus dinormalisasi ke NULL, aktual: %', v_sync_method;
    END IF;

    SELECT measurement_method INTO v_sync_method FROM public.athlete_test_results WHERE id = v_res_legacy_id;
    IF v_sync_method IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL TEST 18B: Metode JSONB nonstandar TST-SPR-10M harus tetap NULL, aktual: %', v_sync_method;
    END IF;

    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            measurement_method,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
            'INVALID_METHOD_X',
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-27', 'MULTI_TRIAL_BEST_MIN', 2.20, 's', '2.20 s', 'MIN'
        );
        RAISE EXCEPTION 'FAIL TEST 18C: Nilai eksplisit measurement_method tidak valid pada TST-SPR-10M wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 18: Sanitasi whitespace/legacy & proteksi metode TST-SPR-10M terverifikasi';

    -- =========================================================================
    -- TEST 19: KONSISTENSI KALIBRASI & PROTEKSI FAKTA MENTAH
    -- =========================================================================
    BEGIN
        INSERT INTO public.athlete_test_results (
            tenant_id, academy_id, class_id, student_id,
            test_id, indicator_id, indicator_name, category_id,
            test_date, input_schema_type, final_raw_value, final_unit,
            final_display_value, aggregation_method,
            calibration_status, converted_score
        ) VALUES (
            v_tenant_a, v_acad_a, v_class_a1_id, v_stu_a1_id,
            'TST-SPR-10M', 'FTB-UNI-PHY-01', 'Akselerasi', 'physical',
            '2026-10-28', 'MULTI_TRIAL_BEST_MIN', 2.10, 's', '2.10 s', 'MIN',
            'PENDING_CALIBRATION', 85
        );
        RAISE EXCEPTION 'FAIL TEST 19A: PENDING_CALIBRATION dengan converted_score non-null wajib ditolak (23514)!';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;
    v_passed_scenarios := v_passed_scenarios + 1;
    RAISE NOTICE '[PASS] TEST 19: Konsistensi status kalibrasi & skor terverifikasi';

    PERFORM set_config('role', 'postgres', true);
    IF v_passed_scenarios <> 19 THEN
        RAISE EXCEPTION 'JUMLAH SKENARIO VERIFIKASI TIDAK LENGKAP: % / 19', v_passed_scenarios;
    END IF;
    RAISE NOTICE 'ALL 19 ROLE-BASED SECURITY, INTEGRITY & COMPATIBILITY SCENARIOS PASSED (ROLLED BACK CLEANLY).';
END $$;

ROLLBACK;
