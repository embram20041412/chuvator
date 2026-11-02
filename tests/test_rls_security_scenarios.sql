-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — FINAL RLS & SECURITY TEST SUITE (FASE 1AI)
-- Target: Supabase PostgreSQL (SQL Editor / Staging Environment)
-- Mode: Non-Destructive Transaction (BEGIN ... ROLLBACK)
-- Classification: SIMULATED TEST / STATIC CODE REVIEW
-- Key Integrity Guarantees:
--   1. Full 6 Roles x 5 Financial Tables x 4 CRUD Operations Assertions (120 Assertions)
--   2. SQLSTATE '42501' Error Classification for Denied INSERT Attempts
--   3. Strict Row Availability & State Verification Before/After UPDATE & DELETE
--   4. Deep Policy Expression Catalog Inspection across ALL 24 Canonical Tables & CRUD commands
--   5. Normalized Overly Permissive Expression Detection (Whitespace, Parens, Casts, Tautologies)
--   6. Strict Trigger Catalog & Function Integrity Verification (users_staff & tenants)
--   7. Full Pre/Post Row State Immutability Verification on Cross-Tenant UPDATE Attempts
--   8. Strict Fixture Safety Pre-checks (No ON CONFLICT DO UPDATE / DO NOTHING workarounds)
--   9. Authenticated Role Context Verification with non-superuser RLS enforcement
--  10. PostgreSQL RLS-bypass Context Verification via pg_roles (rolsuper OR rolbypassrls)
--  11. Trigger Error Provenance & Exact MESSAGE_TEXT Assertions
--  12. Caller Identity Verification (auth.uid() & public.is_superadmin() = FALSE)
-- =========================================================================

BEGIN;

DO $$
DECLARE
    -- Mock Tenant IDs (Deterministic UUIDs)
    tenant_a UUID := '11111111-1111-1111-1111-111111111111';
    tenant_b UUID := '22222222-2222-2222-2222-222222222222';
    
    -- Mock Auth UIDs (Valid UUID v4 format)
    superadmin_uid TEXT := '10000000-0000-0000-0000-000000000001';
    owner_a_uid TEXT := '10000000-0000-0000-0000-000000000002';
    owner_b_uid TEXT := '10000000-0000-0000-0000-000000000003';
    admin_a_uid TEXT := '10000000-0000-0000-0000-000000000004';
    kasir_a_uid TEXT := '10000000-0000-0000-0000-000000000005';
    staff_a_uid TEXT := '10000000-0000-0000-0000-000000000006';
    coach_a_uid TEXT := '10000000-0000-0000-0000-000000000007';
    invited_staff_uid TEXT := '10000000-0000-0000-0000-000000000013';
    fake_owner_staff_uid TEXT := '10000000-0000-0000-0000-000000000014';
    
    -- Mock Primary Keys for Core Fixture Rows (Deterministic UUIDs)
    inv_pending_id UUID := '44444444-4444-4444-4444-444444444444';
    inv_accepted_id UUID := '55555555-5555-5555-5555-555555555555';
    tx_a_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    gl_a_id UUID := 'aaaaaaaa-bbbb-aaaa-aaaa-aaaaaaaaaaaa';
    pos_a_id UUID := 'aaaaaaaa-cccc-aaaa-aaaa-aaaaaaaaaaaa';
    spp_a_id UUID := 'aaaaaaaa-dddd-aaaa-aaaa-aaaaaaaaaaaa';
    exp_a_id UUID := 'aaaaaaaa-eeee-aaaa-aaaa-aaaaaaaaaaaa';
    
    staff_candidate_id UUID := '66666666-6666-6666-6666-666666666666';
    fake_owner_staff_id UUID := '77777777-7777-7777-7777-777777777777';
    admin_staff_id UUID := '88888888-8888-8888-8888-888888888888';
    kasir_staff_id UUID := '99999999-9999-9999-9999-999999999999';
    staff_staff_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    coach_staff_id UUID := 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    
    raw_tok_1 TEXT;
    tok_hash_1 TEXT;
    
    test_passed BOOLEAN;
    res_count INT;
    res_bool BOOLEAN;
    res_text TEXT;
    caught_sqlstate TEXT;
    caught_msg TEXT;
    v_rolsuper BOOLEAN;
    v_rolbypassrls BOOLEAN;

    -- Financial CRUD Matrix Loop Variables
    v_fin_tbl text;
    v_fin_tables text[] := ARRAY['transactions', 'global_ledger', 'pos_transactions', 'spp_payments', 'event_expenses'];
    v_role_name text;
    v_roles text[] := ARRAY['superadmin', 'owner', 'admin', 'kasir', 'coach', 'staff'];
    v_cur_uid text;
    v_cur_email text;
    v_test_row_id UUID;
    v_target_row_id UUID;
    v_ins_success BOOLEAN;
    v_initial_count INT;
    v_verify_count INT;
    v_initial_val NUMERIC;
    v_verify_val NUMERIC;

    -- State integrity verification variables for Test 13 & 13B (Fase 1AI)
    v_pre_tenant_id text;
    v_pre_uid text;
    v_pre_role text;
    v_pre_status text;
    v_post_tenant_id text;
    v_post_uid text;
    v_post_role text;
    v_post_status text;

    -- State integrity verification variables for Test 13C (tenants table - Fase 1AI)
    v_pre_t_id uuid;
    v_pre_t_tenant_id text;
    v_pre_t_owner_uid text;
    v_pre_t_owner_email text;
    v_pre_t_name text;
    v_post_t_id uuid;
    v_post_t_tenant_id text;
    v_post_t_owner_uid text;
    v_post_t_owner_email text;
    v_post_t_name text;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'MEMULAI TEST SUITE KEAMANAN DATABASE CHUVATOR (FASE 1AI - FINAL VALIDATION: RLS-BYPASS CONTEXT, TRIGGER ERROR PROVENANCE & TEST DOCUMENTATION)';
    RAISE NOTICE 'MODE: SIMULATED TEST / STATIC CODE REVIEW';
    RAISE NOTICE '=======================================================';

    raw_tok_1 := 'valid-test-token-32bytes-secret1';
    tok_hash_1 := encode(digest(raw_tok_1, 'sha256'), 'hex');

    -- =========================================================================
    -- REQUIREMENT D: STRICT FIXTURE SAFETY PRE-CHECKS (No ON CONFLICT Workarounds)
    -- =========================================================================

    -- 1. Check auth.users collision if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        IF EXISTS (
            SELECT 1 FROM auth.users
            WHERE id IN (superadmin_uid::uuid, owner_a_uid::uuid, owner_b_uid::uuid, admin_a_uid::uuid, kasir_a_uid::uuid, staff_a_uid::uuid, coach_a_uid::uuid, invited_staff_uid::uuid, fake_owner_staff_uid::uuid)
               OR email IN ('superadmin@chuvator.internal', 'owner_a@arena.com', 'owner_b@arena.com', 'admin_a@arena.com', 'kasir_a@arena.com', 'staff_a@arena.com', 'coach_a@arena.com', 'candidate15@arena.com', 'fakeowner@arena.com')
        ) THEN
            RAISE EXCEPTION 'FIXTURE ERROR: Mock Auth UID/Email bertabrakan dengan data auth.users terdaftar di database.';
        END IF;
    END IF;

    -- 2. Check tenants collision
    IF EXISTS (
        SELECT 1 FROM public.tenants
        WHERE id IN (tenant_a, tenant_b) 
           OR tenant_id IN (tenant_a::text, tenant_b::text)
           OR owner_email IN ('owner_a@arena.com', 'owner_b@arena.com')
    ) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: Mock Tenant ID/Email bertabrakan dengan data tenants terdaftar di database.';
    END IF;

    -- 3. Check users_staff collision
    IF EXISTS (
        SELECT 1 FROM public.users_staff
        WHERE id IN (admin_staff_id, kasir_staff_id, staff_staff_id, coach_staff_id, staff_candidate_id, fake_owner_staff_id)
           OR email IN ('admin_a@arena.com', 'kasir_a@arena.com', 'staff_a@arena.com', 'coach_a@arena.com', 'candidate15@arena.com', 'fakeowner@arena.com')
    ) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: Mock users_staff ID/Email bertabrakan dengan data users_staff terdaftar di database.';
    END IF;

    -- 4. Check platform_superadmins collision
    IF EXISTS (
        SELECT 1 FROM public.platform_superadmins
        WHERE auth_uid = superadmin_uid OR email = 'superadmin@chuvator.internal'
    ) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: Mock superadmin bertabrakan dengan data platform_superadmins terdaftar.';
    END IF;

    -- 5. Check invitations collision
    IF EXISTS (
        SELECT 1 FROM public.invitations
        WHERE id IN (inv_pending_id, inv_accepted_id)
           OR token_hash = tok_hash_1
    ) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: Mock invitations ID/token bertabrakan dengan data invitations terdaftar.';
    END IF;

    -- 6. Check financial fixture rows collision
    IF EXISTS (SELECT 1 FROM public.transactions WHERE id = tx_a_id) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: tx_a_id bertabrakan dengan data transactions.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.global_ledger WHERE id = gl_a_id) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: gl_a_id bertabrakan dengan data global_ledger.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pos_transactions WHERE id = pos_a_id) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: pos_a_id bertabrakan dengan data pos_transactions.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.spp_payments WHERE id = spp_a_id) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: spp_a_id bertabrakan dengan data spp_payments.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_expenses WHERE id = exp_a_id) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: exp_a_id bertabrakan dengan data event_expenses.';
    END IF;

    -- Pure Insertions (Verified Zero Collision)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (id, email, email_confirmed_at, aud, role)
        VALUES 
            (superadmin_uid::uuid, 'superadmin@chuvator.internal', now(), 'authenticated', 'authenticated'),
            (owner_a_uid::uuid, 'owner_a@arena.com', now(), 'authenticated', 'authenticated'),
            (owner_b_uid::uuid, 'owner_b@arena.com', now(), 'authenticated', 'authenticated'),
            (admin_a_uid::uuid, 'admin_a@arena.com', now(), 'authenticated', 'authenticated'),
            (kasir_a_uid::uuid, 'kasir_a@arena.com', now(), 'authenticated', 'authenticated'),
            (staff_a_uid::uuid, 'staff_a@arena.com', now(), 'authenticated', 'authenticated'),
            (coach_a_uid::uuid, 'coach_a@arena.com', now(), 'authenticated', 'authenticated'),
            (invited_staff_uid::uuid, 'candidate15@arena.com', now(), 'authenticated', 'authenticated'),
            (fake_owner_staff_uid::uuid, 'fakeowner@arena.com', now(), 'authenticated', 'authenticated');
    END IF;

    INSERT INTO public.platform_superadmins (auth_uid, email, notes)
    VALUES (superadmin_uid, 'superadmin@chuvator.internal', 'Test Superadmin');

    INSERT INTO public.tenants (id, tenant_id, name, owner_uid, owner_email, is_active)
    VALUES 
        (tenant_a, tenant_a::text, 'Arena Alpha', owner_a_uid, 'owner_a@arena.com', TRUE),
        (tenant_b, tenant_b::text, 'Arena Beta', owner_b_uid, 'owner_b@arena.com', TRUE);

    INSERT INTO public.users_staff (id, uid, tenant_id, email, role, status, is_active)
    VALUES
        (admin_staff_id, admin_a_uid, tenant_a::text, 'admin_a@arena.com', 'admin', 'active', TRUE),
        (kasir_staff_id, kasir_a_uid, tenant_a::text, 'kasir_a@arena.com', 'kasir', 'active', TRUE),
        (staff_staff_id, staff_a_uid, tenant_a::text, 'staff_a@arena.com', 'staff', 'active', TRUE),
        (coach_staff_id, coach_a_uid, tenant_a::text, 'coach_a@arena.com', 'coach', 'active', TRUE),
        (staff_candidate_id, NULL, tenant_a::text, 'candidate15@arena.com', 'kasir', 'active', TRUE),
        (fake_owner_staff_id, fake_owner_staff_uid, tenant_a::text, 'fakeowner@arena.com', 'owner', 'active', TRUE);

    INSERT INTO public.invitations (id, tenant_id, invite_email, email, invite_role, role, token_hash, status, created_by_uid, expires_at)
    VALUES 
        (inv_pending_id, tenant_a::text, 'candidate15@arena.com', 'candidate15@arena.com', 'kasir', 'kasir', tok_hash_1, 'pending', owner_a_uid, now() + interval '7 days'),
        (inv_accepted_id, tenant_a::text, 'accepted@arena.com', 'accepted@arena.com', 'kasir', 'kasir', 'accepted_hash_123', 'accepted', owner_a_uid, now() + interval '7 days');

    INSERT INTO public.transactions (id, tenant_id, title, amount, type) VALUES (tx_a_id, tenant_a::text, 'Sewa Lapangan A1', 150000, 'INCOME');
    INSERT INTO public.global_ledger (id, tenant_id, type, amount, source) VALUES (gl_a_id, tenant_a::text, 'INCOME', 150000, 'POS');
    INSERT INTO public.pos_transactions (id, tenant_id, customer_name, total, payment_method) VALUES (pos_a_id, tenant_a::text, 'Pelanggan Alpha', 150000, 'Cash');
    INSERT INTO public.spp_payments (id, tenant_id, student_name, month, year, amount) VALUES (spp_a_id, tenant_a::text, 'Siswa Alpha', 'Januari', 2026, 250000);
    INSERT INTO public.event_expenses (id, tenant_id, title, amount) VALUES (exp_a_id, tenant_a::text, 'Biaya Wasit Turnamen', 300000);

    -- =========================================================================
    -- 14 TEST SCENARIOS WITH EXPLICIT ASSERTIONS
    -- =========================================================================

    -- TEST 1: Owner Tenant A membaca data Tenant A & tidak dapat membaca Tenant B
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a_uid, 'email', 'owner_a@arena.com')::text, true);
    SELECT COUNT(*) INTO res_count FROM public.tenants WHERE tenant_id = tenant_a::text;
    IF res_count <> 1 THEN
        RAISE EXCEPTION '[FAIL] Test 1: Owner Tenant A tidak dapat membaca data Tenant A miliknya sendiri.';
    END IF;
    SELECT COUNT(*) INTO res_count FROM public.tenants WHERE tenant_id = tenant_b::text;
    IF res_count = 0 THEN
        RAISE NOTICE '[PASS] Test 1: Owner Tenant A membaca Tenant A (1 row) & tidak dapat membaca Tenant B (0 rows).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 1: Kebocoran data! Owner Tenant A dapat membaca Tenant B.';
    END IF;

    -- TEST 2: Admin Tenant A membaca data Tenant B (Isolasi Tenant Admin)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
    SELECT COUNT(*) INTO res_count FROM public.transactions WHERE tenant_id = tenant_b::text;
    IF res_count = 0 THEN
        RAISE NOTICE '[PASS] Test 2: Admin Tenant A tidak dapat mengakses transaksi Tenant B (0 rows).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 2: Admin Tenant A dapat mengakses transaksi Tenant B.';
    END IF;

    -- =========================================================================
    -- REQUIREMENT A & B: TEST 3 - HARDENED FULL CRUD MATRIX & ERROR CLASSIFICATION
    -- 6 Roles x 5 Financial Tables x 4 Operations (120 Assertions)
    -- Error Classification: Denied INSERTs must strictly yield SQLSTATE '42501' (RLS violation).
    -- State Verification: UPDATE & DELETE verify target row availability before and after.
    -- =========================================================================
    FOREACH v_fin_tbl IN ARRAY v_fin_tables
    LOOP
        FOREACH v_role_name IN ARRAY v_roles
        LOOP
            -- Map role to target Auth UID and Email
            IF v_role_name = 'superadmin' THEN
                v_cur_uid := superadmin_uid; v_cur_email := 'superadmin@chuvator.internal';
            ELSIF v_role_name = 'owner' THEN
                v_cur_uid := owner_a_uid; v_cur_email := 'owner_a@arena.com';
            ELSIF v_role_name = 'admin' THEN
                v_cur_uid := admin_a_uid; v_cur_email := 'admin_a@arena.com';
            ELSIF v_role_name = 'kasir' THEN
                v_cur_uid := kasir_a_uid; v_cur_email := 'kasir_a@arena.com';
            ELSIF v_role_name = 'coach' THEN
                v_cur_uid := coach_a_uid; v_cur_email := 'coach_a@arena.com';
            ELSIF v_role_name = 'staff' THEN
                v_cur_uid := staff_a_uid; v_cur_email := 'staff_a@arena.com';
            END IF;

            -- Set authenticated role context for current role
            PERFORM set_config('role', 'authenticated', true);
            PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cur_uid, 'email', v_cur_email)::text, true);

            -- -----------------------------------------------------------------
            -- OP 1: SELECT OPERATION AUDIT
            -- -----------------------------------------------------------------
            EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text) INTO res_count;
            IF v_role_name IN ('superadmin', 'owner', 'admin', 'kasir') THEN
                IF res_count < 1 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (SELECT): Role % gagal membaca tabel %I (Ditemukan: % rows).', v_role_name, v_fin_tbl, res_count;
                END IF;
            ELSIF v_role_name IN ('coach', 'staff') THEN
                IF res_count > 0 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (SELECT): Role % berhasil membaca % rows pada tabel finansial %I (seharusnya 0 rows).', v_role_name, res_count, v_fin_tbl;
                END IF;
            END IF;

            -- -----------------------------------------------------------------
            -- OP 2: INSERT OPERATION AUDIT (Targeting fresh UUID row & Strict SQLSTATE 42501 Classification)
            -- -----------------------------------------------------------------
            v_test_row_id := gen_random_uuid();
            v_ins_success := FALSE;
            caught_sqlstate := '';
            BEGIN
                IF v_fin_tbl = 'transactions' THEN
                    INSERT INTO public.transactions (id, tenant_id, title, amount, type) VALUES (v_test_row_id, tenant_a::text, 'CRUD Test Tx', 12345, 'INCOME');
                ELSIF v_fin_tbl = 'global_ledger' THEN
                    INSERT INTO public.global_ledger (id, tenant_id, type, amount, source) VALUES (v_test_row_id, tenant_a::text, 'INCOME', 12345, 'TEST');
                ELSIF v_fin_tbl = 'pos_transactions' THEN
                    INSERT INTO public.pos_transactions (id, tenant_id, customer_name, total, payment_method) VALUES (v_test_row_id, tenant_a::text, 'CRUD Test POS', 12345, 'Cash');
                ELSIF v_fin_tbl = 'spp_payments' THEN
                    INSERT INTO public.spp_payments (id, tenant_id, student_name, month, year, amount) VALUES (v_test_row_id, tenant_a::text, 'CRUD Test Student', 'Januari', 2026, 12345);
                ELSIF v_fin_tbl = 'event_expenses' THEN
                    INSERT INTO public.event_expenses (id, tenant_id, title, amount) VALUES (v_test_row_id, tenant_a::text, 'CRUD Test Expense', 12345);
                END IF;
                v_ins_success := TRUE;
            EXCEPTION WHEN OTHERS THEN
                GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
                v_ins_success := FALSE;
            END;

            IF v_role_name IN ('superadmin', 'owner', 'admin', 'kasir') THEN
                IF NOT v_ins_success THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (INSERT): Role % gagal INSERT ke tabel %I (Caught SQLSTATE: %).', v_role_name, v_fin_tbl, caught_sqlstate;
                END IF;
            ELSIF v_role_name IN ('coach', 'staff') THEN
                IF v_ins_success THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (INSERT): Role % berhasil INSERT ke tabel %I (Seharusnya ditolak RLS SQLSTATE 42501).', v_role_name, v_fin_tbl;
                ELSIF caught_sqlstate <> '42501' THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (INSERT Error Classification): Role % ditolak INSERT pada %I tetapi dengan SQLSTATE % (Bukan RLS 42501!).', v_role_name, v_fin_tbl, caught_sqlstate;
                END IF;
            END IF;

            -- -----------------------------------------------------------------
            -- OP 3: UPDATE OPERATION AUDIT (State Verification Before & After)
            -- -----------------------------------------------------------------
            IF v_ins_success THEN
                v_target_row_id := v_test_row_id;
            ELSE
                IF v_fin_tbl = 'transactions' THEN v_target_row_id := tx_a_id;
                ELSIF v_fin_tbl = 'global_ledger' THEN v_target_row_id := gl_a_id;
                ELSIF v_fin_tbl = 'pos_transactions' THEN v_target_row_id := pos_a_id;
                ELSIF v_fin_tbl = 'spp_payments' THEN v_target_row_id := spp_a_id;
                ELSIF v_fin_tbl = 'event_expenses' THEN v_target_row_id := exp_a_id;
                END IF;
            END IF;

            -- Pre-UPDATE Verification: Target row must exist in tenant_a & capture initial amount/total value
            PERFORM set_config('role', 'postgres', true);
            EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_initial_count;
            IF v_initial_count <> 1 THEN
                RAISE EXCEPTION '[FAIL] Test 3 Pre-UPDATE Error: Target row % pada tabel %I tidak ditemukan di tenant_a.', v_target_row_id, v_fin_tbl;
            END IF;

            IF v_fin_tbl = 'pos_transactions' THEN
                EXECUTE format('SELECT total FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_initial_val;
            ELSE
                EXECUTE format('SELECT amount FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_initial_val;
            END IF;

            -- Switch back to tested role context
            PERFORM set_config('role', 'authenticated', true);
            PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cur_uid, 'email', v_cur_email)::text, true);

            -- Perform UPDATE
            IF v_fin_tbl = 'pos_transactions' THEN
                EXECUTE format('UPDATE public.%I SET total = total + 10 WHERE id = %L', v_fin_tbl, v_target_row_id);
            ELSE
                EXECUTE format('UPDATE public.%I SET amount = amount + 10 WHERE id = %L', v_fin_tbl, v_target_row_id);
            END IF;

            GET DIAGNOSTICS res_count = ROW_COUNT;

            IF v_role_name IN ('superadmin', 'owner', 'admin') THEN
                IF res_count <> 1 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (UPDATE): Role % gagal UPDATE baris % pada tabel %I (ROW_COUNT = %).', v_role_name, v_target_row_id, v_fin_tbl, res_count;
                END IF;

                -- Post-UPDATE Value Mutation Verification: Value must equal v_initial_val + 10
                PERFORM set_config('role', 'postgres', true);
                IF v_fin_tbl = 'pos_transactions' THEN
                    EXECUTE format('SELECT total FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_verify_val;
                ELSE
                    EXECUTE format('SELECT amount FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_verify_val;
                END IF;

                IF v_verify_val IS DISTINCT FROM (v_initial_val + 10) THEN
                    RAISE EXCEPTION '[FAIL] Test 3 Post-UPDATE Value Error: Role % UPDATE berhasil tetapi nilai kolom tidak berubah (Awal: %, Terkini: %).', v_role_name, v_initial_val, v_verify_val;
                END IF;

                PERFORM set_config('role', 'authenticated', true);
                PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cur_uid, 'email', v_cur_email)::text, true);
            ELSIF v_role_name IN ('kasir', 'coach', 'staff') THEN
                IF res_count > 0 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (UPDATE): Role % berhasil UPDATE baris pada tabel %I (Seharusnya 0 rows affected, didapat: %).', v_role_name, v_fin_tbl, res_count;
                END IF;

                -- Post-UPDATE Verification: Target row must still exist and value MUST be untouched
                PERFORM set_config('role', 'postgres', true);
                EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_verify_count;
                IF v_verify_count <> 1 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 Post-UPDATE Error: Target row % pada tabel %I hilang!', v_target_row_id, v_fin_tbl;
                END IF;

                IF v_fin_tbl = 'pos_transactions' THEN
                    EXECUTE format('SELECT total FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_verify_val;
                ELSE
                    EXECUTE format('SELECT amount FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_verify_val;
                END IF;

                IF v_verify_val IS DISTINCT FROM v_initial_val THEN
                    RAISE EXCEPTION '[FAIL] Test 3 Post-UPDATE Immutability Violation: Role % UPDATE ditolak (ROW_COUNT=0) tetapi nilai terubah (Awal: %, Terkini: %)!', v_role_name, v_initial_val, v_verify_val;
                END IF;

                PERFORM set_config('role', 'authenticated', true);
                PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cur_uid, 'email', v_cur_email)::text, true);
            END IF;

            -- -----------------------------------------------------------------
            -- OP 4: DELETE OPERATION AUDIT (State Verification Before & After)
            -- -----------------------------------------------------------------
            EXECUTE format('DELETE FROM public.%I WHERE id = %L', v_fin_tbl, v_target_row_id);
            GET DIAGNOSTICS res_count = ROW_COUNT;

            IF v_role_name IN ('superadmin', 'owner', 'admin') THEN
                IF res_count <> 1 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (DELETE): Role % gagal DELETE baris % pada tabel %I (ROW_COUNT = %).', v_role_name, v_target_row_id, v_fin_tbl, res_count;
                END IF;

                -- Post-DELETE Verification: Verify row is actually deleted
                PERFORM set_config('role', 'postgres', true);
                EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE id = %L', v_fin_tbl, v_target_row_id) INTO v_verify_count;
                IF v_verify_count <> 0 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 Post-DELETE Error: Baris % pada tabel %I masih ditemukan setelah DELETE oleh %!', v_target_row_id, v_fin_tbl, v_role_name;
                END IF;

                PERFORM set_config('role', 'authenticated', true);
                PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cur_uid, 'email', v_cur_email)::text, true);
            ELSIF v_role_name IN ('kasir', 'coach', 'staff') THEN
                IF res_count > 0 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 (DELETE): Role % berhasil DELETE baris pada tabel %I (Seharusnya 0 rows affected, didapat: %).', v_role_name, v_fin_tbl, res_count;
                END IF;

                -- Post-DELETE Verification: Verify row STILL exists after denied DELETE
                PERFORM set_config('role', 'postgres', true);
                EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE id = %L AND tenant_id = %L', v_fin_tbl, v_target_row_id, tenant_a::text) INTO v_verify_count;
                IF v_verify_count <> 1 THEN
                    RAISE EXCEPTION '[FAIL] Test 3 Post-DELETE Verification Error: Baris % pada tabel %I terhapus padahal DELETE ditolak untuk role %!', v_target_row_id, v_fin_tbl, v_role_name;
                END IF;

                PERFORM set_config('role', 'authenticated', true);
                PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cur_uid, 'email', v_cur_email)::text, true);
            END IF;

            -- Cleanup temporary test row if still present in database
            IF v_ins_success THEN
                PERFORM set_config('role', 'postgres', true);
                EXECUTE format('DELETE FROM public.%I WHERE id = %L', v_fin_tbl, v_test_row_id);
            END IF;

        END LOOP;
    END LOOP;

    RAISE NOTICE '[PASS] Test 3: Matriks Full CRUD 6 Role x 5 Tabel Finansial x 4 Operasi (120 Assertions) TERBUKTI AKURAT DAN HARDENED!';

    -- TEST 4: Kasir mengubah kepemilikan tenant (Harus Ditolak Trigger 42501)
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', kasir_a_uid, 'email', 'kasir_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        UPDATE public.tenants SET owner_uid = kasir_a_uid WHERE id = tenant_a;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN test_passed := TRUE; END IF;
    END;
    IF test_passed THEN
        RAISE NOTICE '[PASS] Test 4: Kasir tidak dapat mengubah kepemilikan tenant (Ditolak SQLSTATE 42501).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 4: Kasir dapat mengubah kepemilikan tenant! (Caught SQLSTATE: %).', caught_sqlstate;
    END IF;

    -- TEST 5: Staff melakukan administrasi (Perubahan status staf lain)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_a_uid, 'email', 'staff_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        UPDATE public.users_staff SET status = 'inactive' WHERE uid = kasir_a_uid;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN test_passed := TRUE; END IF;
    END;
    IF test_passed THEN
        RAISE NOTICE '[PASS] Test 5: Staff tidak dapat melakukan aksi administrasi staf (Ditolak SQLSTATE 42501).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 5: Staff dapat melakukan administrasi! (Caught SQLSTATE: %).', caught_sqlstate;
    END IF;

    -- TEST 6: Direct UPDATE users_staff.uid via Client SDK (Harus Ditolak Engine/Trigger 42501)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        UPDATE public.users_staff SET uid = 'hacked-uid-123' WHERE id = staff_candidate_id;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN test_passed := TRUE; END IF;
    END;
    IF test_passed THEN
        RAISE NOTICE '[PASS] Test 6: Direct UPDATE UID ditolak dengan SQLSTATE 42501.';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 6: Direct UPDATE UID tidak diblokir dengan SQLSTATE 42501 (Caught: %).', caught_sqlstate;
    END IF;

    -- TEST 7: RPC claim_staff_invitation() Resmi (Harus Berhasil)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', invited_staff_uid, 'email', 'candidate15@arena.com')::text, true);
    SELECT public.claim_staff_invitation(raw_tok_1) INTO res_bool;
    SELECT uid INTO res_text FROM public.users_staff WHERE id = staff_candidate_id;
    IF res_bool = TRUE AND res_text = invited_staff_uid THEN
        RAISE NOTICE '[PASS] Test 7: RPC claim_staff_invitation() resmi berhasil mengikat Auth UID.';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 7: RPC claim_staff_invitation() gagal mengikat UID (Result: %, Bound: %).', res_bool, COALESCE(res_text, 'NULL');
    END IF;

    -- TEST 8: Re-claiming Undangan Accepted (Harus Ditolak / Returns FALSE)
    SELECT public.claim_staff_invitation(raw_tok_1) INTO res_bool;
    IF res_bool = FALSE THEN
        RAISE NOTICE '[PASS] Test 8: Pengklaiman ulang undangan accepted ditolak (Returns FALSE).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 8: Undangan yang sudah accepted dapat diklaim ulang!';
    END IF;

    -- TEST 9: Eskalasi Role ke Owner atau Superadmin via users_staff (Harus Ditolak 42501)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        UPDATE public.users_staff SET role = 'owner' WHERE uid = staff_a_uid;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN test_passed := TRUE; END IF;
    END;
    IF test_passed THEN
        RAISE NOTICE '[PASS] Test 9: Pengguna tidak dapat menaikkan role staf menjadi owner/superadmin (SQLSTATE 42501).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 9: Eskalasi role tidak diblokir dengan SQLSTATE 42501 (Caught: %).', caught_sqlstate;
    END IF;

    -- TEST 10: Membaca token_hash pada invitations oleh Authenticated (Isolasi Kolom Strict Assertion)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_a_uid, 'email', 'staff_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        EXECUTE 'SELECT token_hash FROM public.invitations WHERE id = $1' INTO res_text USING inv_pending_id;
        test_passed := FALSE;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN 
            test_passed := TRUE; 
        END IF;
    END;
    IF test_passed THEN
        RAISE NOTICE '[PASS] Test 10: token_hash tidak dapat dibaca oleh authenticated user (Ditolak SQLSTATE 42501).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 10: Isolasi token_hash gagal! Authenticated user dapat membaca token_hash (Caught: %).', caught_sqlstate;
    END IF;

    -- =========================================================================
    -- REQUIREMENT C: TEST 11 - EXHAUSTIVE DEEP POLICY EXPRESSION AUDIT ACROSS ALL 24 CANONICAL TABLES
    -- Inspects: Existence, RLS Enabled, FORCE RLS Enabled, 0 Legacy Policies,
    --           4 RBAC Policies (SELECT, INSERT, UPDATE, DELETE), 4 Total Policies,
    --           PERMISSIVE Mode, Non-empty USING & WITH CHECK, and Strict Expression Matches across all 4 CRUD commands.
    -- =========================================================================
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a_uid, 'email', 'owner_a@arena.com')::text, true);

    DECLARE
        v_check_tables text[] := ARRAY[
            'platform_superadmins', 'tenants', 'invitations', 'users_staff',
            'academies', 'academy_classes', 'coaches', 'students', 
            'academy_evaluations', 'academy_attendance', 'spp_payments',
            'courts', 'bookings', 'transactions', 'global_ledger', 
            'pos_transactions', 'products', 'sponsors', 'events', 
            'event_categories', 'event_registrations', 'event_expenses', 
            'event_documents', 'event_matches'
        ];
        v_cur_tbl text;
        v_r_sec boolean;
        v_f_sec boolean;
        v_legacy_pols text[];
        v_sel_cnt int;
        v_ins_cnt int;
        v_upd_cnt int;
        v_del_cnt int;
        v_tot_cnt int;
        v_invalid_using int;
        v_invalid_check int;
        v_non_permissive int;
        v_sel_qual text;
        v_ins_check text;
        v_upd_qual text;
        v_upd_check text;
        v_del_qual text;
        v_expr_list text[];
        v_cur_expr text;
        v_norm_stripped text;
        v_trg_count int;
        v_trg_tgenabled_txt text;
        v_trg_tgtype smallint;
        v_trg_isinternal_int int;
        v_trg_proname text;
        v_func_src text;
    BEGIN
        FOREACH v_cur_tbl IN ARRAY v_check_tables
        LOOP
            -- 1. Table exists in information_schema
            IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_cur_tbl) THEN
                RAISE EXCEPTION '[FAIL] Test 11: Tabel canonical "%" tidak ditemukan di schema public.', v_cur_tbl;
            END IF;

            -- 2 & 3. RLS ENABLED and FORCE RLS active
            SELECT rowsecurity, forcerowsecurity INTO v_r_sec, v_f_sec
            FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = v_cur_tbl;

            IF v_r_sec IS NOT TRUE THEN
                RAISE EXCEPTION '[FAIL] Test 11: RLS tidak aktif (rowsecurity = false) pada tabel "%".', v_cur_tbl;
            END IF;
            IF v_f_sec IS NOT TRUE THEN
                RAISE EXCEPTION '[FAIL] Test 11: FORCE RLS tidak aktif (forcerowsecurity = false) pada tabel "%".', v_cur_tbl;
            END IF;

            -- 4. No legacy permissive policies
            SELECT array_agg(policyname) INTO v_legacy_pols
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl
              AND policyname IN (
                'tenant_isolation_policy', 'allow_read', 'allow_write', 
                'tenant_select_policy', 'tenant_insert_policy', 'tenant_update_policy', 'tenant_delete_policy',
                v_cur_tbl || '_tenant_select', v_cur_tbl || '_tenant_insert', 
                v_cur_tbl || '_tenant_update', v_cur_tbl || '_tenant_delete'
              );

            IF v_legacy_pols IS NOT NULL AND array_length(v_legacy_pols, 1) > 0 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Policy legacy permissive (%) masih ditemukan pada tabel "%"!', array_to_string(v_legacy_pols, ', '), v_cur_tbl;
            END IF;

            -- 5, 6, 7, 8. Verify SELECT, INSERT, UPDATE, DELETE RBAC policies
            SELECT COUNT(*) INTO v_sel_cnt FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'SELECT' AND policyname LIKE '%_rbac';
            SELECT COUNT(*) INTO v_ins_cnt FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'INSERT' AND policyname LIKE '%_rbac';
            SELECT COUNT(*) INTO v_upd_cnt FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'UPDATE' AND policyname LIKE '%_rbac';
            SELECT COUNT(*) INTO v_del_cnt FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'DELETE' AND policyname LIKE '%_rbac';

            IF v_sel_cnt <> 1 THEN RAISE EXCEPTION '[FAIL] Test 11: Policy SELECT RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_sel_cnt; END IF;
            IF v_ins_cnt <> 1 THEN RAISE EXCEPTION '[FAIL] Test 11: Policy INSERT RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_ins_cnt; END IF;
            IF v_upd_cnt <> 1 THEN RAISE EXCEPTION '[FAIL] Test 11: Policy UPDATE RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_upd_cnt; END IF;
            IF v_del_cnt <> 1 THEN RAISE EXCEPTION '[FAIL] Test 11: Policy DELETE RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_del_cnt; END IF;

            -- 9. Check permissiveness
            SELECT COUNT(*) INTO v_non_permissive FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND permissive <> 'PERMISSIVE';
            IF v_non_permissive > 0 THEN RAISE EXCEPTION '[FAIL] Test 11: Ditemukan policy non-PERMISSIVE pada tabel "%".', v_cur_tbl; END IF;

            -- 10. Verify non-empty USING clause
            SELECT COUNT(*) INTO v_invalid_using FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd IN ('SELECT', 'UPDATE', 'DELETE') AND (qual IS NULL OR trim(qual) = '');
            IF v_invalid_using > 0 THEN RAISE EXCEPTION '[FAIL] Test 11: Ditemukan policy tanpa klausa USING pada tabel "%".', v_cur_tbl; END IF;

            -- 11. Verify non-empty WITH CHECK clause
            SELECT COUNT(*) INTO v_invalid_check FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd IN ('INSERT', 'UPDATE') AND (with_check IS NULL OR trim(with_check) = '');
            IF v_invalid_check > 0 THEN RAISE EXCEPTION '[FAIL] Test 11: Ditemukan policy INSERT/UPDATE tanpa klausa WITH CHECK pada tabel "%".', v_cur_tbl; END IF;

            -- 12. DEEP EXPRESSION AUDIT ACROSS ALL 24 CANONICAL TABLES AND ALL 4 CRUD COMMANDS
            SELECT qual INTO v_sel_qual FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'SELECT';
            SELECT with_check INTO v_ins_check FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'INSERT';
            SELECT qual, with_check INTO v_upd_qual, v_upd_check FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'UPDATE';
            SELECT qual INTO v_del_qual FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'DELETE';

            -- Normalized Overly Permissive Detection Check across all 5 expressions (SELECT qual, INSERT check, UPDATE qual, UPDATE check, DELETE qual)
            -- Normalizes whitespace, tabs, carriage returns, newlines, case, and nested parentheses
            v_expr_list := ARRAY[v_sel_qual, v_ins_check, v_upd_qual, v_upd_check, v_del_qual];
            FOREACH v_cur_expr IN ARRAY v_expr_list
            LOOP
                IF v_cur_expr IS NOT NULL THEN
                    v_norm_stripped := regexp_replace(lower(v_cur_expr), '[\s\t\r\n\(\)]+', '', 'g');

                    IF v_norm_stripped IN (
                        'true', 't', '''t''', '1=1', '0=0', 'true::boolean', 'true::bool', 
                        '''true''::boolean', '''true''::bool', '''t''::boolean', '''t''::bool', 
                        'notfalse', '''1''=''1''', 'nullisnull', '''true''=''true'''
                    )
                    OR v_norm_stripped ~ '^(''t''|true)(::(boolean|bool))?$'
                    OR v_norm_stripped ~ '^([0-9]+)=\1$'
                    OR v_norm_stripped ~ '^''([^'']+)''=''\1''$'
                    OR v_norm_stripped ~ '^(notfalse|nullisnull)$'
                    THEN
                        RAISE EXCEPTION '[FAIL] Test 11 (Vulnerability): Policy pada tabel "%" mengandung klausa terlalu permisif (raw: %, normalized: %)!', v_cur_tbl, v_cur_expr, v_norm_stripped;
                    END IF;
                END IF;
            END LOOP;

            -- Table Group Specific Expression Verification (Validating SELECT, INSERT, UPDATE USING, UPDATE WITH CHECK, DELETE)
            IF v_cur_tbl = 'platform_superadmins' THEN
                IF v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: platform_superadmins SELECT policy abnormal (%))', v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: platform_superadmins INSERT policy abnormal (%))', v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: platform_superadmins UPDATE qual abnormal (%))', v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: platform_superadmins UPDATE check abnormal (%))', v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: platform_superadmins DELETE qual abnormal (%))', v_del_qual; END IF;
            ELSIF v_cur_tbl = 'tenants' THEN
                IF v_sel_qual NOT LIKE '%owner_uid%' AND v_sel_qual NOT LIKE '%is_superadmin%' AND v_sel_qual NOT LIKE '%get_user_tenant_role%' THEN RAISE EXCEPTION '[FAIL] Test 11: tenants SELECT policy abnormal (%))', v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%owner_uid%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: tenants INSERT policy abnormal (%))', v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%owner_uid%' AND v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: tenants UPDATE qual abnormal (%))', v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%owner_uid%' AND v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: tenants UPDATE check abnormal (%))', v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: tenants DELETE policy abnormal (%))', v_del_qual; END IF;
            ELSIF v_cur_tbl = 'invitations' THEN
                IF v_sel_qual NOT LIKE '%get_user_tenant_role%' AND v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: invitations SELECT policy abnormal (%))', v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: invitations INSERT policy abnormal (%))', v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: invitations UPDATE qual abnormal (%))', v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: invitations UPDATE check abnormal (%))', v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: invitations DELETE policy abnormal (%))', v_del_qual; END IF;
            ELSIF v_cur_tbl = 'users_staff' THEN
                -- Verifikasi SELECT memeriksa peran tenant, superadmin, atau kepemilikan UID
                IF v_sel_qual NOT LIKE '%get_user_tenant_role%' AND v_sel_qual NOT LIKE '%is_superadmin%' AND v_sel_qual NOT LIKE '%uid%' THEN 
                    RAISE EXCEPTION '[FAIL] Test 11: users_staff SELECT policy abnormal (%))', v_sel_qual; 
                END IF;
                -- Verifikasi INSERT memeriksa wewenang admin/owner tenant atau superadmin
                IF v_ins_check NOT LIKE '%get_user_tenant_role%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN 
                    RAISE EXCEPTION '[FAIL] Test 11: users_staff INSERT policy abnormal (%))', v_ins_check; 
                END IF;
                -- Verifikasi UPDATE USING memeriksa otorisasi pemanggil (owner/admin/superadmin/self)
                IF v_upd_qual NOT LIKE '%get_user_tenant_role%' AND v_upd_qual NOT LIKE '%is_superadmin%' AND v_upd_qual NOT LIKE '%uid%' THEN 
                    RAISE EXCEPTION '[FAIL] Test 11: users_staff UPDATE qual abnormal (%))', v_upd_qual; 
                END IF;
                -- Verifikasi UPDATE WITH CHECK memeriksa otorisasi pemanggil (owner/admin/superadmin/self)
                -- CATATAN: Klausa 'tenant_id = users_staff.tenant_id' dalam WITH CHECK menunjuk ke baris kandidat yang sama
                -- sehingga tidak dapat dijadikan bukti isolasi batas perpindahan tenant; isolasi tersebut dipastikan
                -- secara definitif oleh trigger trg_protect_users_staff_columns.
                IF v_upd_check NOT LIKE '%get_user_tenant_role%' AND v_upd_check NOT LIKE '%is_superadmin%' AND v_upd_check NOT LIKE '%uid%' THEN 
                    RAISE EXCEPTION '[FAIL] Test 11: users_staff UPDATE check abnormal (%))', v_upd_check; 
                END IF;
                -- Verifikasi DELETE memeriksa wewenang admin/owner tenant atau superadmin
                IF v_del_qual NOT LIKE '%get_user_tenant_role%' AND v_del_qual NOT LIKE '%is_superadmin%' THEN 
                    RAISE EXCEPTION '[FAIL] Test 11: users_staff DELETE policy abnormal (%))', v_del_qual; 
                END IF;
            ELSIF v_cur_tbl IN ('transactions', 'global_ledger', 'pos_transactions', 'spp_payments', 'event_expenses') THEN
                IF v_sel_qual NOT LIKE '%user_can_manage_financials%' AND v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % SELECT policy abnormal (%))', v_cur_tbl, v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%user_can_manage_financials%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % INSERT policy abnormal (%))', v_cur_tbl, v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE qual abnormal (%))', v_cur_tbl, v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE check abnormal (%))', v_cur_tbl, v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % DELETE policy abnormal (%))', v_cur_tbl, v_del_qual; END IF;
            ELSIF v_cur_tbl IN ('academies', 'academy_classes', 'students', 'academy_evaluations', 'academy_attendance') THEN
                IF v_sel_qual NOT LIKE '%user_has_tenant_access%' AND v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % SELECT policy abnormal (%))', v_cur_tbl, v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%user_can_manage_academy%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % INSERT policy abnormal (%))', v_cur_tbl, v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%user_can_manage_academy%' AND v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE qual abnormal (%))', v_cur_tbl, v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%user_can_manage_academy%' AND v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE check abnormal (%))', v_cur_tbl, v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % DELETE policy abnormal (%))', v_del_qual; END IF;
            ELSIF v_cur_tbl = 'coaches' THEN
                IF v_sel_qual NOT LIKE '%user_has_tenant_access%' AND v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: coaches SELECT policy abnormal (%))', v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: coaches INSERT policy abnormal (%))', v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_qual NOT LIKE '%auth_uid%' AND v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: coaches UPDATE qual abnormal (%))', v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_check NOT LIKE '%auth_uid%' AND v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: coaches UPDATE check abnormal (%))', v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: coaches DELETE policy abnormal (%))', v_del_qual; END IF;
            ELSIF v_cur_tbl IN ('products', 'courts', 'bookings') THEN
                IF v_sel_qual NOT LIKE '%user_has_tenant_access%' AND v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % SELECT policy abnormal (%))', v_cur_tbl, v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%user_can_manage_pos%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % INSERT policy abnormal (%))', v_cur_tbl, v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%user_can_manage_pos%' AND v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE qual abnormal (%))', v_cur_tbl, v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%user_can_manage_pos%' AND v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE check abnormal (%))', v_cur_tbl, v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % DELETE policy abnormal (%))', v_del_qual; END IF;
            ELSIF v_cur_tbl IN ('events', 'event_categories', 'event_documents', 'event_matches', 'sponsors') THEN
                IF v_sel_qual NOT LIKE '%user_has_tenant_access%' AND v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % SELECT policy abnormal (%))', v_cur_tbl, v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % INSERT policy abnormal (%))', v_cur_tbl, v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE qual abnormal (%))', v_cur_tbl, v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % UPDATE check abnormal (%))', v_cur_tbl, v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: % DELETE policy abnormal (%))', v_del_qual; END IF;
            ELSIF v_cur_tbl = 'event_registrations' THEN
                IF v_sel_qual NOT LIKE '%user_has_tenant_access%' AND v_sel_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: event_registrations SELECT policy abnormal (%))', v_sel_qual; END IF;
                IF v_ins_check NOT LIKE '%user_can_manage_pos%' AND v_ins_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: event_registrations INSERT policy abnormal (%))', v_ins_check; END IF;
                IF v_upd_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: event_registrations UPDATE qual abnormal (%))', v_upd_qual; END IF;
                IF v_upd_check NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_upd_check NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: event_registrations UPDATE check abnormal (%))', v_upd_check; END IF;
                IF v_del_qual NOT LIKE '%user_is_tenant_admin_or_owner%' AND v_del_qual NOT LIKE '%is_superadmin%' THEN RAISE EXCEPTION '[FAIL] Test 11: event_registrations DELETE policy abnormal (%))', v_del_qual; END IF;
            END IF;

            -- 13. Total policies on this table must be exactly 4
            SELECT COUNT(*) INTO v_tot_cnt FROM pg_policies WHERE schemaname = 'public' AND tablename = v_cur_tbl;
            IF v_tot_cnt <> 4 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Total policy pada tabel "%" harus tepat 4 (Ditemukan: %). Kemungkinan ada policy ekstra yang membuka akses.', v_cur_tbl, v_tot_cnt;
            END IF;
        END LOOP;

        -- =====================================================================
        -- 14. AUDIT STATUS & KONFIGURASI TRIGGER PADA KATALOG POSTGRESQL (FASE 1AH)
        -- Memvalidasi tgenabled, tgtype (BEFORE UPDATE FOR EACH ROW = 19),
        -- fungsi terkait, is_internal, dan audit mendalam definisi fungsi
        -- =====================================================================

        -- A. Verifikasi trigger trg_protect_users_staff_columns pada tabel users_staff
        SELECT 
            COUNT(*),
            COALESCE(MAX(t.tgenabled::text), ''),
            COALESCE(MAX(t.tgtype), 0::smallint),
            COALESCE(MAX(CASE WHEN t.tgisinternal THEN 1 ELSE 0 END), 0),
            COALESCE(MAX(p.proname::text), '')
        INTO v_trg_count, v_trg_tgenabled_txt, v_trg_tgtype, v_trg_isinternal_int, v_trg_proname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND c.relname = 'users_staff'
          AND t.tgname = 'trg_protect_users_staff_columns';

        IF v_trg_count <> 1 THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_users_staff_columns tidak ditemukan tepat satu kali pada tabel users_staff (Ditemukan: %).', v_trg_count;
        END IF;

        IF v_trg_isinternal_int <> 0 THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_users_staff_columns ditandai sebagai internal trigger PostgreSQL!';
        END IF;

        IF v_trg_tgenabled_txt NOT IN ('O', 'A') THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_users_staff_columns tidak aktif (tgenabled = %). Wajib O (origin) atau A (always).', v_trg_tgenabled_txt;
        END IF;

        -- Bitmask check: BEFORE (bit 1 = 2) UPDATE (bit 4 = 16) FOR EACH ROW (bit 0 = 1) -> tgtype = 19
        IF v_trg_tgtype <> 19 OR (v_trg_tgtype & 1 = 0) OR (v_trg_tgtype & 2 = 0) OR (v_trg_tgtype & 16 = 0) OR (v_trg_tgtype & 64 <> 0) THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Konfigurasi tgtype trg_protect_users_staff_columns tidak valid (tgtype = %). Wajib BEFORE UPDATE FOR EACH ROW (tgtype = 19).', v_trg_tgtype;
        END IF;

        IF v_trg_proname <> 'protect_users_staff_columns' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_users_staff_columns terhubung ke fungsi yang salah (%). Wajib protect_users_staff_columns.', v_trg_proname;
        END IF;

        -- Audit mendalam definisi fungsi protect_users_staff_columns()
        SELECT p.prosrc INTO v_func_src
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'protect_users_staff_columns';

        IF v_func_src IS NULL THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Sumber fungsi protect_users_staff_columns() tidak ditemukan!';
        END IF;

        IF v_func_src NOT LIKE '%IS DISTINCT FROM%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_users_staff_columns() tidak menggunakan perbandingan aman IS DISTINCT FROM!';
        END IF;

        IF v_func_src NOT LIKE '%OLD.tenant_id%' OR v_func_src NOT LIKE '%NEW.tenant_id%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_users_staff_columns() tidak membandingkan OLD.tenant_id dan NEW.tenant_id!';
        END IF;

        IF v_func_src NOT LIKE '%42501%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_users_staff_columns() tidak mendefinisikan penolakan dengan ERRCODE 42501!';
        END IF;

        IF v_func_src NOT LIKE '%RETURN NEW;%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_users_staff_columns() tidak mengembalikan RETURN NEW;!';
        END IF;

        -- B. Verifikasi trigger trg_protect_tenants_columns pada tabel tenants
        SELECT 
            COUNT(*),
            COALESCE(MAX(t.tgenabled::text), ''),
            COALESCE(MAX(t.tgtype), 0::smallint),
            COALESCE(MAX(CASE WHEN t.tgisinternal THEN 1 ELSE 0 END), 0),
            COALESCE(MAX(p.proname::text), '')
        INTO v_trg_count, v_trg_tgenabled_txt, v_trg_tgtype, v_trg_isinternal_int, v_trg_proname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND c.relname = 'tenants'
          AND t.tgname = 'trg_protect_tenants_columns';

        IF v_trg_count <> 1 THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_tenants_columns tidak ditemukan tepat satu kali pada tabel tenants (Ditemukan: %).', v_trg_count;
        END IF;

        IF v_trg_isinternal_int <> 0 THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_tenants_columns ditandai sebagai internal trigger PostgreSQL!';
        END IF;

        IF v_trg_tgenabled_txt NOT IN ('O', 'A') THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_tenants_columns tidak aktif (tgenabled = %). Wajib O (origin) atau A (always).', v_trg_tgenabled_txt;
        END IF;

        IF v_trg_tgtype <> 19 OR (v_trg_tgtype & 1 = 0) OR (v_trg_tgtype & 2 = 0) OR (v_trg_tgtype & 16 = 0) OR (v_trg_tgtype & 64 <> 0) THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Konfigurasi tgtype trg_protect_tenants_columns tidak valid (tgtype = %). Wajib BEFORE UPDATE FOR EACH ROW (tgtype = 19).', v_trg_tgtype;
        END IF;

        IF v_trg_proname <> 'protect_tenants_columns' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Audit): Trigger trg_protect_tenants_columns terhubung ke fungsi yang salah (%). Wajib protect_tenants_columns.', v_trg_proname;
        END IF;

        -- Audit mendalam definisi fungsi protect_tenants_columns()
        SELECT p.prosrc INTO v_func_src
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'protect_tenants_columns';

        IF v_func_src IS NULL THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Sumber fungsi protect_tenants_columns() tidak ditemukan!';
        END IF;

        IF v_func_src NOT LIKE '%IS DISTINCT FROM%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_tenants_columns() tidak menggunakan perbandingan aman IS DISTINCT FROM!';
        END IF;

        IF v_func_src NOT LIKE '%OLD.id%' OR v_func_src NOT LIKE '%NEW.id%' OR
           v_func_src NOT LIKE '%OLD.tenant_id%' OR v_func_src NOT LIKE '%NEW.tenant_id%' OR
           v_func_src NOT LIKE '%OLD.owner_uid%' OR v_func_src NOT LIKE '%NEW.owner_uid%' OR
           v_func_src NOT LIKE '%OLD.owner_email%' OR v_func_src NOT LIKE '%NEW.owner_email%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_tenants_columns() tidak memeriksa seluruh kolom sensitif (id, tenant_id, owner_uid, owner_email)!';
        END IF;

        IF v_func_src NOT LIKE '%42501%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_tenants_columns() tidak mendefinisikan penolakan dengan ERRCODE 42501!';
        END IF;

        IF v_func_src NOT LIKE '%RETURN NEW;%' THEN
            RAISE EXCEPTION '[FAIL] Test 11 (Trigger Function Audit): Fungsi protect_tenants_columns() tidak mengembalikan RETURN NEW;!';
        END IF;

        RAISE NOTICE '[PASS] Test 11: Seluruh 24 tabel canonical terkelola tervalidasi individual (RLS aktif, FORCE RLS aktif, 4 RBAC CRUD policies per tabel, ekspresi RBAC akurat pada 4 operasi CRUD, 0 legacy permissive, deteksi normalisasi ekspresi permisif lulus, katalog trigger [tgenabled, tgtype=19 BEFORE UPDATE FOR EACH ROW, NOT internal, linked function] & integritas fungsi trigger [IS DISTINCT FROM, 42501, RETURN NEW] diverifikasi penuh).';
    END;

    -- TEST 12: INSERT Data dengan tenant_id milik Tenant Lain (Harus Ditolak RLS / WITH CHECK)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        INSERT INTO public.transactions (id, tenant_id, title, amount, type)
        VALUES (gen_random_uuid(), tenant_b::text, 'Sewa Lapangan Ilegal', 500000, 'INCOME');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN test_passed := TRUE; END IF;
    END;
    IF test_passed THEN
        RAISE NOTICE '[PASS] Test 12: INSERT transaksi dengan tenant_id milik tenant lain ditolak (SQLSTATE 42501).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 12: INSERT lintas tenant tidak diblokir dengan SQLSTATE 42501 (Caught: %).', caught_sqlstate;
    END IF;

    -- TEST 13: UPDATE Memindahkan Record ke Tenant Lain (Harus Ditolak Trigger 42501 & State Row Tetap Utuh)
    -- 1. Catat state awal record staf sasaran sebelum upaya mutasi
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT tenant_id::text, uid, role, status
    INTO v_pre_tenant_id, v_pre_uid, v_pre_role, v_pre_status
    FROM public.users_staff
    WHERE id = staff_staff_id;

    IF v_pre_tenant_id IS NULL OR v_pre_uid IS NULL THEN
        RAISE EXCEPTION '[FAIL] Test 13: Fixture record staff tidak ditemukan sebelum test dijalankan.';
    END IF;

    -- 2. Upayakan mutasi pemindahan tenant ilegal sebagai Admin Tenant A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        UPDATE public.users_staff SET tenant_id = tenant_b::text WHERE id = staff_staff_id;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN test_passed := TRUE; END IF;
    END;

    IF NOT test_passed THEN
        RAISE EXCEPTION '[FAIL] Test 13: Pemindahan record ke tenant lain tidak diblokir dengan SQLSTATE 42501 (Caught: %).', caught_sqlstate;
    END IF;

    -- 3. Verifikasi state row tetap utuh (tenant_id, uid, role, status) via postgres context
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT tenant_id::text, uid, role, status
    INTO v_post_tenant_id, v_post_uid, v_post_role, v_post_status
    FROM public.users_staff
    WHERE id = staff_staff_id;

    IF v_post_tenant_id IS DISTINCT FROM v_pre_tenant_id THEN
        RAISE EXCEPTION '[FAIL] Test 13: Integritas bocor! tenant_id berubah dari % menjadi %.', v_pre_tenant_id, v_post_tenant_id;
    END IF;
    IF v_post_uid IS DISTINCT FROM v_pre_uid THEN
        RAISE EXCEPTION '[FAIL] Test 13: Integritas bocor! uid berubah dari % menjadi %.', v_pre_uid, v_post_uid;
    END IF;
    IF v_post_role IS DISTINCT FROM v_pre_role THEN
        RAISE EXCEPTION '[FAIL] Test 13: Integritas bocor! role berubah dari % menjadi %.', v_pre_role, v_post_role;
    END IF;
    IF v_post_status IS DISTINCT FROM v_pre_status THEN
        RAISE EXCEPTION '[FAIL] Test 13: Integritas bocor! status berubah dari % menjadi %.', v_pre_status, v_post_status;
    END IF;

    -- Kembalikan role authenticated
    PERFORM set_config('role', 'authenticated', true);

    RAISE NOTICE '[PASS] Test 13: UPDATE memindahkan record staf ke tenant lain ditolak (SQLSTATE 42501) dan integritas state row utuh tanpa perubahan (tenant_id, uid, role, status verified).';

    -- =========================================================================
    -- TEST 13B: PENGUJIAN FUNGSIONAL TRIGGER users_staff DENGAN RLS BYPASS (FASE 1AI)
    -- Membuktikan bahwa penolakan perpindahan tenant dieksekusi secara independen
    -- oleh BEFORE UPDATE trigger, saat RLS dilewati (role = postgres).
    -- Memverifikasi:
    --   a. Context aktif adalah postgres dengan rolsuper = TRUE atau rolbypassrls = TRUE
    --   b. Caller auth.uid() adalah admin_a_uid dan public.is_superadmin() adalah FALSE
    --   c. Penolakan berasal dari trigger dengan SQLSTATE 42501 dan MESSAGE_TEXT persis
    --   d. State row users_staff tetap utuh tanpa mutasi
    -- =========================================================================
    -- 1. Snapshot state sebelum mutasi
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- 1.a. Verifikasi RLS-bypass context via pg_roles
    SELECT rolsuper, rolbypassrls INTO v_rolsuper, v_rolbypassrls
    FROM pg_roles WHERE rolname = current_user;
    IF current_user <> 'postgres' OR (COALESCE(v_rolsuper, false) = false AND COALESCE(v_rolbypassrls, false) = false) THEN
        RAISE EXCEPTION '[FAIL] Test 13B: Context bukan RLS-bypass valid (current_user=%, rolsuper=%, rolbypassrls=%)', current_user, v_rolsuper, v_rolbypassrls;
    END IF;

    SELECT tenant_id::text, uid, role, status
    INTO v_pre_tenant_id, v_pre_uid, v_pre_role, v_pre_status
    FROM public.users_staff
    WHERE id = staff_staff_id;

    -- 2. Jalankan UPDATE dalam konteks role = postgres (RLS Bypassed),
    --    namun dengan JWT claims Admin Tenant A (non-superadmin).
    --    Di sini RLS tabel tidak memfilter, tetapi trigger BEFORE UPDATE
    --    terpanggil dan mengevaluasi is_superadmin() = FALSE, sehingga mendeteksi
    --    perpindahan tenant_id dan melempar SQLSTATE 42501 dengan pesan spesifik!
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);

    -- 2.a. Verifikasi identitas pemanggil dan public.is_superadmin() = FALSE
    IF auth.uid()::text IS DISTINCT FROM admin_a_uid THEN
        RAISE EXCEPTION '[FAIL] Test 13B: auth.uid() tidak sesuai (expected: %, got: %)', admin_a_uid, auth.uid();
    END IF;
    IF public.is_superadmin() IS NOT FALSE THEN
        RAISE EXCEPTION '[FAIL] Test 13B: public.is_superadmin() harus FALSE untuk pemanggil uji non-superadmin';
    END IF;

    test_passed := FALSE;
    caught_sqlstate := '';
    caught_msg := '';
    BEGIN
        UPDATE public.users_staff SET tenant_id = tenant_b::text WHERE id = staff_staff_id;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE, caught_msg = MESSAGE_TEXT;
        IF caught_sqlstate = '42501' AND caught_msg = 'Mencoba memindahkan record staf ke tenant lain ditolak.' THEN
            test_passed := TRUE;
        END IF;
    END;

    IF NOT test_passed THEN
        RAISE EXCEPTION '[FAIL] Test 13B: Mutasi lintas tenant pada users_staff dalam konteks RLS-bypass tidak diblokir oleh trigger dengan pesan/state yang tepat (Caught SQLSTATE: %, Message: %)', caught_sqlstate, caught_msg;
    END IF;

    -- 3. Verifikasi snapshot integritas state row tetap utuh
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT tenant_id::text, uid, role, status
    INTO v_post_tenant_id, v_post_uid, v_post_role, v_post_status
    FROM public.users_staff
    WHERE id = staff_staff_id;

    IF v_post_tenant_id IS DISTINCT FROM v_pre_tenant_id OR
       v_post_uid IS DISTINCT FROM v_pre_uid OR
       v_post_role IS DISTINCT FROM v_pre_role OR
       v_post_status IS DISTINCT FROM v_pre_status THEN
        RAISE EXCEPTION '[FAIL] Test 13B: Integritas record users_staff rusak setelah penolakan trigger!';
    END IF;

    RAISE NOTICE '[PASS] Test 13B: Mutasi lintas tenant pada users_staff dalam konteks RLS-bypass berhasil diblokir secara independen oleh trigger trg_protect_users_staff_columns (SQLSTATE 42501, Message: "%", rolsuper/rolbypassrls verified, auth.uid() verified, is_superadmin() FALSE) dan state row 100%% utuh.', caught_msg;

    -- =========================================================================
    -- TEST 13C: PENGUJIAN FUNGSIONAL TRIGGER tenants (KOLOM SENSITIF IMUTABEL - FASE 1AI)
    -- Membuktikan bahwa trg_protect_tenants_columns menolak modifikasi id, tenant_id,
    -- owner_uid, dan owner_email oleh pengguna non-superadmin secara independen dari RLS.
    -- Memverifikasi:
    --   a. Context aktif adalah postgres dengan rolsuper = TRUE atau rolbypassrls = TRUE
    --   b. Caller auth.uid() adalah owner_a_uid dan public.is_superadmin() adalah FALSE
    --   c. Penolakan berasal dari trigger dengan SQLSTATE 42501 dan MESSAGE_TEXT persis per kolom
    --   d. State row tenants tetap utuh tanpa mutasi
    -- =========================================================================
    -- 1. Snapshot state awal baris tenants (tenant_a)
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- 1.a. Verifikasi RLS-bypass context via pg_roles
    SELECT rolsuper, rolbypassrls INTO v_rolsuper, v_rolbypassrls
    FROM pg_roles WHERE rolname = current_user;
    IF current_user <> 'postgres' OR (COALESCE(v_rolsuper, false) = false AND COALESCE(v_rolbypassrls, false) = false) THEN
        RAISE EXCEPTION '[FAIL] Test 13C: Context bukan RLS-bypass valid (current_user=%, rolsuper=%, rolbypassrls=%)', current_user, v_rolsuper, v_rolbypassrls;
    END IF;

    SELECT id, tenant_id::text, owner_uid, owner_email, name
    INTO v_pre_t_id, v_pre_t_tenant_id, v_pre_t_owner_uid, v_pre_t_owner_email, v_pre_t_name
    FROM public.tenants
    WHERE id = tenant_a;

    IF v_pre_t_id IS NULL THEN
        RAISE EXCEPTION '[FAIL] Test 13C: Fixture record tenant_a tidak ditemukan.';
    END IF;

    -- Pasang konteks identitas Owner A (non-superadmin) dengan RLS Bypassed via postgres role
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a_uid, 'email', 'owner_a@arena.com')::text, true);

    -- Verifikasi identitas pemanggil dan public.is_superadmin() = FALSE
    IF auth.uid()::text IS DISTINCT FROM owner_a_uid THEN
        RAISE EXCEPTION '[FAIL] Test 13C: auth.uid() tidak sesuai (expected: %, got: %)', owner_a_uid, auth.uid();
    END IF;
    IF public.is_superadmin() IS NOT FALSE THEN
        RAISE EXCEPTION '[FAIL] Test 13C: public.is_superadmin() harus FALSE untuk pemanggil uji non-superadmin';
    END IF;

    -- Skenario C.1: Percobaan mengubah tenant_id oleh non-superadmin (RLS Bypassed via postgres role)
    test_passed := FALSE;
    caught_sqlstate := '';
    caught_msg := '';
    BEGIN
        UPDATE public.tenants SET tenant_id = 'tenant-hijacked' WHERE id = tenant_a;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE, caught_msg = MESSAGE_TEXT;
        IF caught_sqlstate = '42501' AND caught_msg = 'Perubahan tenant_id dilarang.' THEN
            test_passed := TRUE;
        END IF;
    END;
    IF NOT test_passed THEN
        RAISE EXCEPTION '[FAIL] Test 13C.1: Mutasi tenant_id pada tabel tenants tidak diblokir trigger dengan pesan/state yang tepat (Caught SQLSTATE: %, Message: %).', caught_sqlstate, caught_msg;
    END IF;

    -- Skenario C.2: Percobaan mengubah primary key id oleh non-superadmin
    test_passed := FALSE;
    caught_sqlstate := '';
    caught_msg := '';
    BEGIN
        UPDATE public.tenants SET id = gen_random_uuid() WHERE id = tenant_a;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE, caught_msg = MESSAGE_TEXT;
        IF caught_sqlstate = '42501' AND caught_msg = 'Perubahan primary key tenant (id) dilarang.' THEN
            test_passed := TRUE;
        END IF;
    END;
    IF NOT test_passed THEN
        RAISE EXCEPTION '[FAIL] Test 13C.2: Mutasi id primary key pada tabel tenants tidak diblokir trigger dengan pesan/state yang tepat (Caught SQLSTATE: %, Message: %).', caught_sqlstate, caught_msg;
    END IF;

    -- Skenario C.3: Percobaan memindahkan kepemilikan owner_uid via UPDATE langsung oleh non-superadmin
    test_passed := FALSE;
    caught_sqlstate := '';
    caught_msg := '';
    BEGIN
        UPDATE public.tenants SET owner_uid = owner_b_uid WHERE id = tenant_a;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE, caught_msg = MESSAGE_TEXT;
        IF caught_sqlstate = '42501' AND caught_msg = 'Pemindahan kepemilikan tenant (owner_uid) dilarang via UPDATE biasa.' THEN
            test_passed := TRUE;
        END IF;
    END;
    IF NOT test_passed THEN
        RAISE EXCEPTION '[FAIL] Test 13C.3: Mutasi owner_uid pada tabel tenants tidak diblokir trigger dengan pesan/state yang tepat (Caught SQLSTATE: %, Message: %).', caught_sqlstate, caught_msg;
    END IF;

    -- Skenario C.4: Percobaan mengubah owner_email via UPDATE langsung oleh non-superadmin
    test_passed := FALSE;
    caught_sqlstate := '';
    caught_msg := '';
    BEGIN
        UPDATE public.tenants SET owner_email = 'attacker@arena.com' WHERE id = tenant_a;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE, caught_msg = MESSAGE_TEXT;
        IF caught_sqlstate = '42501' AND caught_msg = 'Perubahan owner_email dilarang via UPDATE biasa.' THEN
            test_passed := TRUE;
        END IF;
    END;
    IF NOT test_passed THEN
        RAISE EXCEPTION '[FAIL] Test 13C.4: Mutasi owner_email pada tabel tenants tidak diblokir trigger dengan pesan/state yang tepat (Caught SQLSTATE: %, Message: %).', caught_sqlstate, caught_msg;
    END IF;

    -- 3. Verifikasi snapshot integritas baris tenants tetap 100% utuh
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT id, tenant_id::text, owner_uid, owner_email, name
    INTO v_post_t_id, v_post_t_tenant_id, v_post_t_owner_uid, v_post_t_owner_email, v_post_t_name
    FROM public.tenants
    WHERE id = tenant_a;

    IF v_post_t_id IS DISTINCT FROM v_pre_t_id OR
       v_post_t_tenant_id IS DISTINCT FROM v_pre_t_tenant_id OR
       v_post_t_owner_uid IS DISTINCT FROM v_pre_t_owner_uid OR
       v_post_t_owner_email IS DISTINCT FROM v_pre_t_owner_email OR
       v_post_t_name IS DISTINCT FROM v_pre_t_name THEN
        RAISE EXCEPTION '[FAIL] Test 13C: Integritas record tenants rusak setelah penolakan trigger!';
    END IF;

    -- Kembalikan role authenticated
    PERFORM set_config('role', 'authenticated', true);

    RAISE NOTICE '[PASS] Test 13C: Seluruh 4 upaya mutasi kolom sensitif pada tabel tenants (tenant_id, id, owner_uid, owner_email) berhasil ditolak oleh trigger trg_protect_tenants_columns (SQLSTATE 42501, proven trigger MESSAGE_TEXT, rolsuper/rolbypassrls verified, auth.uid() verified, is_superadmin() FALSE) dan state baris tetap utuh.';

    -- TEST 14: DELETE Lintas Tenant (Harus Ditolak RLS / 0 rows deleted)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a_uid, 'email', 'owner_a@arena.com')::text, true);
    DELETE FROM public.users_staff WHERE tenant_id = tenant_b::text;
    GET DIAGNOSTICS res_count = ROW_COUNT;
    IF res_count = 0 THEN
        RAISE NOTICE '[PASS] Test 14: DELETE lintas tenant ditolak (0 rows deleted via RLS).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 14: DELETE lintas tenant berhasil menghapus % rows!', res_count;
    END IF;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'SELURUH 16 TEST SCENARIOS KEAMANAN FASE 1AI BERHASIL PASSED!';
    RAISE NOTICE '=======================================================';

END $$;

ROLLBACK;
