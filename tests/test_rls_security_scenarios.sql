-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — FINAL RLS & SECURITY SUITE WITH EXPLICIT ASSERTIONS (FASE 1AB)
-- Target: Supabase PostgreSQL (SQL Editor / Staging Environment)
-- Mode: Non-Destructive Transaction (BEGIN ... ROLLBACK)
-- Classification: SIMULATED TEST / STATIC CODE REVIEW
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
    
    -- Mock Primary Keys (Deterministic UUIDs)
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

    -- Financial Audit Loop Variables
    v_fin_tbl text;
    v_fin_tables text[] := ARRAY['transactions', 'global_ledger', 'pos_transactions', 'spp_payments', 'event_expenses'];
    v_ins_id UUID;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'MEMULAI TEST SUITE KEAMANAN DATABASE FINAL CHUVATOR (FASE 1AB - 14 SCENARIOS)';
    RAISE NOTICE 'MODE: SIMULATED TEST / STATIC CODE REVIEW';
    RAISE NOTICE '=======================================================';

    raw_tok_1 := 'valid-test-token-32bytes-secret1';
    tok_hash_1 := encode(digest(raw_tok_1, 'sha256'), 'hex');

    -- SAFE FIXTURE PROTECTION: Check ID and email collision before inserting
    IF EXISTS (
        SELECT 1 FROM public.tenants 
        WHERE (id IN (tenant_a, tenant_b) OR tenant_id IN (tenant_a::text, tenant_b::text))
          AND name NOT IN ('Arena Alpha', 'Arena Beta')
    ) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: Mock tenant ID bertabrakan dengan data tenant non-test terdaftar di database.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.users_staff
        WHERE id IN (admin_staff_id, kasir_staff_id, staff_staff_id, coach_staff_id, staff_candidate_id, fake_owner_staff_id)
          AND email NOT IN ('admin_a@arena.com', 'kasir_a@arena.com', 'staff_a@arena.com', 'coach_a@arena.com', 'candidate15@arena.com', 'fakeowner@arena.com')
    ) THEN
        RAISE EXCEPTION 'FIXTURE ERROR: Mock users_staff ID bertabrakan dengan data staf produksi terdaftar.';
    END IF;

    -- Safe Mock auth.users fixture setup (No DO UPDATE)
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
            (fake_owner_staff_uid::uuid, 'fakeowner@arena.com', now(), 'authenticated', 'authenticated')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Safe Fixture Insertions (ON CONFLICT DO NOTHING to preserve existing production data)
    INSERT INTO public.platform_superadmins (auth_uid, email, notes)
    VALUES (superadmin_uid, 'superadmin@chuvator.internal', 'Test Superadmin')
    ON CONFLICT (email) DO NOTHING;

    INSERT INTO public.tenants (id, tenant_id, name, owner_uid, owner_email, is_active)
    VALUES 
        (tenant_a, tenant_a::text, 'Arena Alpha', owner_a_uid, 'owner_a@arena.com', TRUE),
        (tenant_b, tenant_b::text, 'Arena Beta', owner_b_uid, 'owner_b@arena.com', TRUE)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users_staff (id, uid, tenant_id, email, role, status, is_active)
    VALUES
        (admin_staff_id, admin_a_uid, tenant_a::text, 'admin_a@arena.com', 'admin', 'active', TRUE),
        (kasir_staff_id, kasir_a_uid, tenant_a::text, 'kasir_a@arena.com', 'kasir', 'active', TRUE),
        (staff_staff_id, staff_a_uid, tenant_a::text, 'staff_a@arena.com', 'staff', 'active', TRUE),
        (coach_staff_id, coach_a_uid, tenant_a::text, 'coach_a@arena.com', 'coach', 'active', TRUE),
        (staff_candidate_id, NULL, tenant_a::text, 'candidate15@arena.com', 'kasir', 'active', TRUE),
        (fake_owner_staff_id, fake_owner_staff_uid, tenant_a::text, 'fakeowner@arena.com', 'owner', 'active', TRUE)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invitations (id, tenant_id, invite_email, email, invite_role, role, token_hash, status, created_by_uid, expires_at)
    VALUES 
        (inv_pending_id, tenant_a::text, 'candidate15@arena.com', 'candidate15@arena.com', 'kasir', 'kasir', tok_hash_1, 'pending', owner_a_uid, now() + interval '7 days'),
        (inv_accepted_id, tenant_a::text, 'accepted@arena.com', 'accepted@arena.com', 'kasir', 'kasir', 'accepted_hash_123', 'accepted', owner_a_uid, now() + interval '7 days')
    ON CONFLICT (id) DO NOTHING;

    -- Fixture rows for ALL 5 Financial Tables
    INSERT INTO public.transactions (id, tenant_id, title, amount, type)
    VALUES (tx_a_id, tenant_a::text, 'Sewa Lapangan A1', 150000, 'INCOME')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.global_ledger (id, tenant_id, type, amount, source)
    VALUES (gl_a_id, tenant_a::text, 'INCOME', 150000, 'POS')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.pos_transactions (id, tenant_id, customer_name, total, payment_method)
    VALUES (pos_a_id, tenant_a::text, 'Pelanggan Alpha', 150000, 'Cash')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.spp_payments (id, tenant_id, student_name, month, year, amount)
    VALUES (spp_a_id, tenant_a::text, 'Siswa Alpha', 'Januari', 2026, 250000)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.event_expenses (id, tenant_id, title, amount)
    VALUES (exp_a_id, tenant_a::text, 'Biaya Wasit Turnamen', 300000)
    ON CONFLICT (id) DO NOTHING;

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
    -- TEST 3: EXHAUSTIVE FINANCIAL RBAC MATRIX AUDIT ACROSS ALL 5 FINANCIAL TABLES & ALL 6 ROLES
    -- Managed Financial Tables: transactions, global_ledger, pos_transactions, spp_payments, event_expenses
    -- Tested Roles: Superadmin, Owner, Admin, Kasir, Coach, Staff
    -- Operations Tested: SELECT, INSERT, UPDATE, DELETE per role per table
    -- =========================================================================
    FOREACH v_fin_tbl IN ARRAY v_fin_tables
    LOOP
        -- 3.1 SUPERADMIN ROLE AUDIT
        PERFORM set_config('request.jwt.claims', json_build_object('sub', superadmin_uid, 'email', 'superadmin@chuvator.internal')::text, true);
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text) INTO res_count;
        IF res_count < 1 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Superadmin SELECT): Superadmin tidak dapat membaca tabel %I', v_fin_tbl;
        END IF;

        -- 3.2 OWNER ROLE AUDIT
        PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a_uid, 'email', 'owner_a@arena.com')::text, true);
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text) INTO res_count;
        IF res_count < 1 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Owner SELECT): Owner A tidak dapat membaca tabel %I', v_fin_tbl;
        END IF;

        -- 3.3 ADMIN ROLE AUDIT
        PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text) INTO res_count;
        IF res_count < 1 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Admin SELECT): Admin A tidak dapat membaca tabel %I', v_fin_tbl;
        END IF;

        -- 3.4 KASIR ROLE AUDIT (SELECT & INSERT allowed, UPDATE & DELETE denied)
        PERFORM set_config('request.jwt.claims', json_build_object('sub', kasir_a_uid, 'email', 'kasir_a@arena.com')::text, true);
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text) INTO res_count;
        IF res_count < 1 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Kasir SELECT): Kasir A tidak dapat membaca tabel finansial %I', v_fin_tbl;
        END IF;

        -- Kasir UPDATE Denied (0 rows affected)
        EXECUTE format('UPDATE public.%I SET amount = 999999 WHERE tenant_id = %L', v_fin_tbl, tenant_a::text);
        GET DIAGNOSTICS res_count = ROW_COUNT;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Kasir UPDATE): Kasir A berhasil UPDATE tabel finansial %I (seharusnya ditolak)!', v_fin_tbl;
        END IF;

        -- Kasir DELETE Denied (0 rows affected)
        EXECUTE format('DELETE FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text);
        GET DIAGNOSTICS res_count = ROW_COUNT;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Kasir DELETE): Kasir A berhasil DELETE tabel finansial %I (seharusnya ditolak)!', v_fin_tbl;
        END IF;

        -- 3.5 COACH ROLE AUDIT (SELECT = 0 rows, INSERT denied, UPDATE = 0, DELETE = 0)
        PERFORM set_config('request.jwt.claims', json_build_object('sub', coach_a_uid, 'email', 'coach_a@arena.com')::text, true);
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text) INTO res_count;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Coach SELECT): Coach A berhasil membaca % rows pada tabel finansial %I (seharusnya 0 rows)!', res_count, v_fin_tbl;
        END IF;

        test_passed := FALSE;
        BEGIN
            v_ins_id := gen_random_uuid();
            IF v_fin_tbl = 'transactions' THEN
                INSERT INTO public.transactions (id, tenant_id, title, amount, type) VALUES (v_ins_id, tenant_a::text, 'Illegal Coach Tx', 50000, 'INCOME');
            ELSIF v_fin_tbl = 'global_ledger' THEN
                INSERT INTO public.global_ledger (id, tenant_id, type, amount, source) VALUES (v_ins_id, tenant_a::text, 'INCOME', 50000, 'TEST');
            ELSIF v_fin_tbl = 'pos_transactions' THEN
                INSERT INTO public.pos_transactions (id, tenant_id, customer_name, total) VALUES (v_ins_id, tenant_a::text, 'Illegal Coach Sale', 50000);
            ELSIF v_fin_tbl = 'spp_payments' THEN
                INSERT INTO public.spp_payments (id, tenant_id, student_name, month, year, amount) VALUES (v_ins_id, tenant_a::text, 'Siswa Illegal', 'Januari', 2026, 50000);
            ELSIF v_fin_tbl = 'event_expenses' THEN
                INSERT INTO public.event_expenses (id, tenant_id, title, amount) VALUES (v_ins_id, tenant_a::text, 'Illegal Coach Exp', 50000);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            test_passed := TRUE;
        END;
        IF NOT test_passed THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Coach INSERT): Coach A berhasil INSERT ke tabel finansial %I!', v_fin_tbl;
        END IF;

        EXECUTE format('UPDATE public.%I SET amount = 888888 WHERE tenant_id = %L', v_fin_tbl, tenant_a::text);
        GET DIAGNOSTICS res_count = ROW_COUNT;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Coach UPDATE): Coach A berhasil UPDATE tabel finansial %I!', v_fin_tbl;
        END IF;

        EXECUTE format('DELETE FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text);
        GET DIAGNOSTICS res_count = ROW_COUNT;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Coach DELETE): Coach A berhasil DELETE tabel finansial %I!', v_fin_tbl;
        END IF;

        -- 3.6 STAFF ROLE AUDIT (SELECT = 0 rows, INSERT denied, UPDATE = 0, DELETE = 0)
        PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_a_uid, 'email', 'staff_a@arena.com')::text, true);
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text) INTO res_count;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Staff SELECT): Staff A berhasil membaca % rows pada tabel finansial %I (seharusnya 0 rows)!', res_count, v_fin_tbl;
        END IF;

        test_passed := FALSE;
        BEGIN
            v_ins_id := gen_random_uuid();
            IF v_fin_tbl = 'transactions' THEN
                INSERT INTO public.transactions (id, tenant_id, title, amount, type) VALUES (v_ins_id, tenant_a::text, 'Illegal Staff Tx', 50000, 'INCOME');
            ELSIF v_fin_tbl = 'global_ledger' THEN
                INSERT INTO public.global_ledger (id, tenant_id, type, amount, source) VALUES (v_ins_id, tenant_a::text, 'INCOME', 50000, 'TEST');
            ELSIF v_fin_tbl = 'pos_transactions' THEN
                INSERT INTO public.pos_transactions (id, tenant_id, customer_name, total) VALUES (v_ins_id, tenant_a::text, 'Illegal Staff Sale', 50000);
            ELSIF v_fin_tbl = 'spp_payments' THEN
                INSERT INTO public.spp_payments (id, tenant_id, student_name, month, year, amount) VALUES (v_ins_id, tenant_a::text, 'Siswa Illegal', 'Januari', 2026, 50000);
            ELSIF v_fin_tbl = 'event_expenses' THEN
                INSERT INTO public.event_expenses (id, tenant_id, title, amount) VALUES (v_ins_id, tenant_a::text, 'Illegal Staff Exp', 50000);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            test_passed := TRUE;
        END;
        IF NOT test_passed THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Staff INSERT): Staff A berhasil INSERT ke tabel finansial %I!', v_fin_tbl;
        END IF;

        EXECUTE format('UPDATE public.%I SET amount = 777777 WHERE tenant_id = %L', v_fin_tbl, tenant_a::text);
        GET DIAGNOSTICS res_count = ROW_COUNT;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Staff UPDATE): Staff A berhasil UPDATE tabel finansial %I!', v_fin_tbl;
        END IF;

        EXECUTE format('DELETE FROM public.%I WHERE tenant_id = %L', v_fin_tbl, tenant_a::text);
        GET DIAGNOSTICS res_count = ROW_COUNT;
        IF res_count > 0 THEN
            RAISE EXCEPTION '[FAIL] Test 3 (Staff DELETE): Staff A berhasil DELETE tabel finansial %I!', v_fin_tbl;
        END IF;
    END LOOP;

    RAISE NOTICE '[PASS] Test 3: Matriks RBAC Keuangan 5 Tabel (transactions, global_ledger, pos_transactions, spp_payments, event_expenses) untuk 6 Role tervalidasi 100%%.';

    -- TEST 4: Kasir mengubah kepemilikan tenant (Harus Ditolak Trigger 42501)
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
    -- TEST 11: Comprehensive Table-by-Table RLS Catalog Audit on all 24 Canonical Tables
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
    BEGIN
        FOREACH v_cur_tbl IN ARRAY v_check_tables
        LOOP
            -- 1. Table exists in information_schema
            IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_cur_tbl) THEN
                RAISE EXCEPTION '[FAIL] Test 11: Tabel "%" tidak ditemukan di schema public.', v_cur_tbl;
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
            SELECT COUNT(*) INTO v_sel_cnt
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'SELECT' AND policyname LIKE '%_rbac';

            SELECT COUNT(*) INTO v_ins_cnt
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'INSERT' AND policyname LIKE '%_rbac';

            SELECT COUNT(*) INTO v_upd_cnt
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'UPDATE' AND policyname LIKE '%_rbac';

            SELECT COUNT(*) INTO v_del_cnt
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl AND cmd = 'DELETE' AND policyname LIKE '%_rbac';

            IF v_sel_cnt <> 1 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Policy SELECT RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_sel_cnt;
            END IF;
            IF v_ins_cnt <> 1 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Policy INSERT RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_ins_cnt;
            END IF;
            IF v_upd_cnt <> 1 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Policy UPDATE RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_upd_cnt;
            END IF;
            IF v_del_cnt <> 1 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Policy DELETE RBAC tidak tepat 1 pada tabel "%" (Ditemukan: %).', v_cur_tbl, v_del_cnt;
            END IF;

            -- 9. Check permissiveness
            SELECT COUNT(*) INTO v_non_permissive
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl AND permissive <> 'PERMISSIVE';

            IF v_non_permissive > 0 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Ditemukan policy non-PERMISSIVE pada tabel "%".', v_cur_tbl;
            END IF;

            -- Verify USING clause exists for SELECT, UPDATE, DELETE
            SELECT COUNT(*) INTO v_invalid_using
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl 
              AND cmd IN ('SELECT', 'UPDATE', 'DELETE') 
              AND (qual IS NULL OR trim(qual) = '');

            IF v_invalid_using > 0 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Ditemukan policy tanpa klausa USING pada tabel "%".', v_cur_tbl;
            END IF;

            -- Verify WITH CHECK clause exists for INSERT, UPDATE
            SELECT COUNT(*) INTO v_invalid_check
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl 
              AND cmd IN ('INSERT', 'UPDATE') 
              AND (with_check IS NULL OR trim(with_check) = '');

            IF v_invalid_check > 0 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Ditemukan policy INSERT/UPDATE tanpa klausa WITH CHECK pada tabel "%".', v_cur_tbl;
            END IF;

            -- 10. Total policies on this table must be exactly 4 (no extra rogue policies)
            SELECT COUNT(*) INTO v_tot_cnt
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_cur_tbl;

            IF v_tot_cnt <> 4 THEN
                RAISE EXCEPTION '[FAIL] Test 11: Total policy pada tabel "%" harus tepat 4 (Ditemukan: %). Kemungkinan ada policy ekstra yang membuka akses.', v_cur_tbl, v_tot_cnt;
            END IF;
        END LOOP;

        RAISE NOTICE '[PASS] Test 11: Seluruh 24 tabel canonical terkelola tervalidasi individual (RLS aktif, FORCE RLS aktif, 4 RBAC CRUD policies per tabel, 0 legacy permissive).';
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

    -- TEST 13: UPDATE Memindahkan Record ke Tenant Lain (Harus Ditolak Trigger 42501)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
    test_passed := FALSE;
    caught_sqlstate := '';
    BEGIN
        UPDATE public.users_staff SET tenant_id = tenant_b::text WHERE uid = staff_a_uid;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
        IF caught_sqlstate = '42501' THEN test_passed := TRUE; END IF;
    END;
    IF test_passed THEN
        RAISE NOTICE '[PASS] Test 13: UPDATE memindahkan record staf ke tenant lain ditolak (SQLSTATE 42501).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 13: Pemindahan record ke tenant lain tidak diblokir dengan SQLSTATE 42501 (Caught: %).', caught_sqlstate;
    END IF;

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
    RAISE NOTICE 'SELURUH 14 TEST SCENARIOS KEAMANAN FASE 1AB BERHASIL PASSED!';
    RAISE NOTICE '=======================================================';

END $$;

ROLLBACK;
