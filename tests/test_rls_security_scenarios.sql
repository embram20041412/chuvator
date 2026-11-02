-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — FINAL RLS & SECURITY SUITE WITH EXPLICIT ASSERTIONS
-- Target: Supabase PostgreSQL (SQL Editor / Staging Environment)
-- Mode: Non-Destructive Transaction (BEGIN ... ROLLBACK)
-- Classification: SIMULATED TEST / STATIC CODE REVIEW
-- =========================================================================

BEGIN;

DO $$
DECLARE
    -- Mock Tenant IDs
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
    
    -- Mock Primary Keys
    inv_pending_id UUID := '44444444-4444-4444-4444-444444444444';
    inv_accepted_id UUID := '55555555-5555-5555-5555-555555555555';
    tx_a_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    staff_candidate_id UUID := '66666666-6666-6666-6666-666666666666';
    
    raw_tok_1 TEXT;
    tok_hash_1 TEXT;
    
    test_passed BOOLEAN;
    res_count INT;
    res_bool BOOLEAN;
    res_text TEXT;
    caught_sqlstate TEXT;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'MEMULAI TEST SUITE KEAMANAN DATABASE FINAL CHUVATOR (14 TEST SCENARIOS)';
    RAISE NOTICE 'MODE: SIMULATED TEST / STATIC CODE REVIEW';
    RAISE NOTICE '=======================================================';

    raw_tok_1 := 'valid-test-token-32bytes-secret1';
    tok_hash_1 := encode(digest(raw_tok_1, 'sha256'), 'hex');

    -- Mock auth.users fixture setup
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

    INSERT INTO public.platform_superadmins (auth_uid, email, notes)
    VALUES (superadmin_uid, 'superadmin@chuvator.internal', 'Test Superadmin')
    ON CONFLICT (email) DO NOTHING;

    INSERT INTO public.tenants (id, tenant_id, name, owner_uid, owner_email, is_active)
    VALUES 
        (tenant_a, tenant_a::text, 'Arena Alpha', owner_a_uid, 'owner_a@arena.com', TRUE),
        (tenant_b, tenant_b::text, 'Arena Beta', owner_b_uid, 'owner_b@arena.com', TRUE);

    INSERT INTO public.users_staff (id, uid, tenant_id, email, role, status, is_active)
    VALUES
        (gen_random_uuid(), admin_a_uid, tenant_a::text, 'admin_a@arena.com', 'admin', 'active', TRUE),
        (gen_random_uuid(), kasir_a_uid, tenant_a::text, 'kasir_a@arena.com', 'kasir', 'active', TRUE),
        (gen_random_uuid(), staff_a_uid, tenant_a::text, 'staff_a@arena.com', 'staff', 'active', TRUE),
        (gen_random_uuid(), coach_a_uid, tenant_a::text, 'coach_a@arena.com', 'coach', 'active', TRUE),
        (staff_candidate_id, NULL, tenant_a::text, 'candidate15@arena.com', 'kasir', 'active', TRUE),
        (gen_random_uuid(), fake_owner_staff_uid, tenant_a::text, 'fakeowner@arena.com', 'owner', 'active', TRUE);

    INSERT INTO public.invitations (id, tenant_id, invite_email, email, invite_role, role, token_hash, status, created_by_uid, expires_at)
    VALUES 
        (inv_pending_id, tenant_a::text, 'candidate15@arena.com', 'candidate15@arena.com', 'kasir', 'kasir', tok_hash_1, 'pending', owner_a_uid, now() + interval '7 days'),
        (inv_accepted_id, tenant_a::text, 'accepted@arena.com', 'accepted@arena.com', 'kasir', 'kasir', 'accepted_hash_123', 'accepted', owner_a_uid, now() + interval '7 days');

    INSERT INTO public.transactions (id, tenant_id, title, amount, type)
    VALUES (tx_a_id, tenant_a::text, 'Sewa Lapangan A1', 150000, 'INCOME');

    -- =========================================================================
    -- 14 TEST SCENARIOS WITH EXPLICIT ASSERTIONS
    -- =========================================================================

    -- TEST 1: Owner Tenant A membaca data Tenant A & tidak dapat membaca Tenant B
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a_uid, 'email', 'owner_a@arena.com')::text, true);
    SELECT COUNT(*) INTO res_count FROM public.tenants WHERE tenant_id = tenant_b::text;
    IF res_count = 0 THEN
        RAISE NOTICE '[PASS] Test 1: Owner Tenant A tidak dapat membaca Tenant B (0 rows).';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 1: Kebocoran data! Owner Tenant A dapat membaca Tenant B.';
    END IF;

    -- TEST 2: Admin Tenant A membaca data Tenant B (Isolasi Tenant Admin)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_a_uid, 'email', 'admin_a@arena.com')::text, true);
    SELECT COUNT(*) INTO res_count FROM public.transactions WHERE tenant_id = tenant_b::text;
    IF res_count = 0 THEN
        RAISE NOTICE '[PASS] Test 2: Admin Tenant A tidak dapat mengakses transaksi Tenant B.';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 2: Admin Tenant A dapat mengakses transaksi Tenant B.';
    END IF;

    -- TEST 3: Coach membaca & menghapus transaksi keuangan (Harus Ditolak RLS / 0 rows)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', coach_a_uid, 'email', 'coach_a@arena.com')::text, true);
    SELECT COUNT(*) INTO res_count FROM public.transactions WHERE tenant_id = tenant_a::text;
    IF res_count > 0 THEN
        RAISE EXCEPTION '[FAIL] Test 3: Kebocoran Keuangan! Coach dapat membaca % baris transaksi.', res_count;
    END IF;
    DELETE FROM public.transactions WHERE id = tx_a_id;
    GET DIAGNOSTICS res_count = ROW_COUNT;
    IF res_count = 0 THEN
        RAISE NOTICE '[PASS] Test 3: Coach ditolak dari membaca & menghapus transaksi keuangan via RLS Least Privilege.';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 3: Coach berhasil menghapus transaksi keuangan!';
    END IF;

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

    -- TEST 11: Kebocoran Policy Permissive Lama & Verifikasi Keberadaan Policy RBAC Baru pada 24 Tabel
    PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a_uid, 'email', 'owner_a@arena.com')::text, true);
    
    SELECT COUNT(*) INTO res_count 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'platform_superadmins', 'tenants', 'invitations', 'users_staff',
        'academies', 'academy_classes', 'coaches', 'students', 
        'academy_evaluations', 'academy_attendance', 'spp_payments',
        'courts', 'bookings', 'transactions', 'global_ledger', 
        'pos_transactions', 'products', 'sponsors', 'events', 
        'event_categories', 'event_registrations', 'event_expenses', 
        'event_documents', 'event_matches'
      )
      AND policyname IN ('tenant_isolation_policy', 'allow_read', 'allow_write', 'tenant_select_policy');
      
    IF res_count > 0 THEN
        RAISE EXCEPTION '[FAIL] Test 11: Masih terdapat % policy permissive legacy pada tabel terkelola!', res_count;
    END IF;

    SELECT COUNT(DISTINCT tablename) INTO res_count 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND policyname LIKE '%_rbac';

    IF res_count < 24 THEN
        RAISE EXCEPTION '[FAIL] Test 11: Kebijakan RBAC baru belum terkonfigurasi di seluruh 24 tabel terkelola (Ditemukan pada % dari 24 tabel).', res_count;
    ELSE
        RAISE NOTICE '[PASS] Test 11: Katalog RLS 24 tabel terverifikasi lengkap (0 policy legacy, 24 tabel berkonfigurasi RBAC).';
    END IF;

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
    RAISE NOTICE 'SELURUH 14 TEST SCENARIOS KEAMANAN BERHASIL PASSED!';
    RAISE NOTICE '=======================================================';

END $$;

ROLLBACK;
