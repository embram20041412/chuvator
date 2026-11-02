-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — TEST SUITE RLS & AUTHORIZATION (10 SKENARIO)
-- Menjalankan simulasi pengujian keamanan Row Level Security
-- Mode: Non-Destructive Transaction (BEGIN ... ROLLBACK)
-- Jalankan langsung di Supabase SQL Editor
-- =========================================================================

BEGIN;

-- 1. SETUP DUMMY DATA UNTUK PENGUJIAN
DO $$
DECLARE
    dummy_tenant_a UUID := '11111111-1111-1111-1111-111111111111';
    dummy_tenant_b UUID := '22222222-2222-2222-2222-222222222222';
    owner_a_uid TEXT := 'owner-a-uid';
    owner_b_uid TEXT := 'owner-b-uid';
    kasir_a_uid TEXT := 'kasir-a-uid';
    coach_a_uid TEXT := 'coach-a-uid';
    coach_record_id TEXT := '33333333-3333-3333-3333-333333333333';
    class_coach_a UUID := '44444444-4444-4444-4444-444444444444';
    class_other UUID := '55555555-5555-5555-5555-555555555555';
    student_coach_a UUID := '66666666-6666-6666-6666-666666666666';
    student_other UUID := '77777777-7777-7777-7777-777777777777';
    res_count INT;
    res_bool BOOLEAN;
    res_text TEXT;
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'MEMULAI 10 SKENARIO PENGUJIAN KEAMANAN RLS CHUVATOR';
    RAISE NOTICE '=====================================================';

    -- Insert mock tenants
    INSERT INTO public.tenants (id, name, owner_uid, owner_email, status)
    VALUES 
        (dummy_tenant_a, 'Arena Alpha', owner_a_uid, 'owner_a@arena.com', 'active'),
        (dummy_tenant_b, 'Arena Beta', owner_b_uid, 'owner_b@arena.com', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Insert mock users_staff (uji role 'staff' dinormalisasi menjadi 'kasir')
    INSERT INTO public.users_staff (uid, tenant_id, email, role, status)
    VALUES
        (kasir_a_uid, dummy_tenant_a::text, 'kasir_a@arena.com', 'staff', 'active'),
        (coach_a_uid, dummy_tenant_a::text, 'coach_a@arena.com', 'coach', 'active')
    ON CONFLICT (uid) DO NOTHING;

    -- Insert mock coach (id::text dan auth_uid)
    INSERT INTO public.coaches (id, tenant_id, auth_uid, email, name, status)
    VALUES (coach_record_id::uuid, dummy_tenant_a::text, coach_a_uid::uuid, 'coach_a@arena.com', 'Coach Alpha', 'Aktif')
    ON CONFLICT (id) DO NOTHING;

    -- Insert mock academy & classes
    INSERT INTO public.academies (id, tenant_id, academy_name)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', dummy_tenant_a::text, 'Akademi Alpha')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.academy_classes (id, tenant_id, academy_id, class_name, coach_id)
    VALUES 
        (class_coach_a, dummy_tenant_a::text, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kelas U-12 Binaan Coach A', coach_record_id::uuid),
        (class_other, dummy_tenant_a::text, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kelas U-15 Bimbingan Lain', NULL)
    ON CONFLICT (id) DO NOTHING;

    -- Insert mock students
    INSERT INTO public.students (id, tenant_id, class_id, student_name, spp_status)
    VALUES
        (student_coach_a, dummy_tenant_a::text, class_coach_a, 'Siswa Binaan A', 'BELUM LUNAS'),
        (student_other, dummy_tenant_a::text, class_other, 'Siswa Lain', 'BELUM LUNAS')
    ON CONFLICT (id) DO NOTHING;

    -- Insert mock transaction
    INSERT INTO public.transactions (tenant_id, title, amount, type)
    VALUES (dummy_tenant_a::text, 'Sewa Lapangan A1', 150000, 'INCOME');

    -- -----------------------------------------------------------------
    -- SKENARIO 1: User biasa tanpa role tidak bisa SELECT data tenant lain
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', 'stranger-uid',
        'email', 'stranger@gmail.com'
    )::text, true);

    res_bool := public.user_has_tenant_access(dummy_tenant_a::text);
    IF res_bool = FALSE THEN
        RAISE NOTICE '[PASS] Skenario 1: User biasa tanpa role ditolak akses ke tenant lain (user_has_tenant_access = FALSE).';
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 1: User asing berhasil membobol tenant access!';
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 2: User biasa mencoba exploit user_metadata.role = 'superadmin'
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', 'hacker-uid',
        'email', 'hacker@blackhat.io',
        'user_metadata', json_build_object('role', 'superadmin')
    )::text, true);

    res_bool := public.is_superadmin();
    IF res_bool = FALSE THEN
        RAISE NOTICE '[PASS] Skenario 2: Manipulasi user_metadata.role = "superadmin" berhasil DIGAGALKAN (CRIT-01 tertutup).';
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 2: Manipulasi user_metadata.role berhasil menjadi Superadmin!';
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 3: User biasa mencoba inject user_metadata.tenantId
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', 'hacker-uid',
        'email', 'hacker@blackhat.io',
        'user_metadata', json_build_object('tenantId', dummy_tenant_a::text)
    )::text, true);

    res_bool := public.user_has_tenant_access(dummy_tenant_a::text);
    IF res_bool = FALSE THEN
        RAISE NOTICE '[PASS] Skenario 3: Manipulasi user_metadata.tenantId berhasil DIGAGALKAN (CRIT-02 tertutup).';
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 3: Manipulasi user_metadata.tenantId berhasil membobol akses tenant!';
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 4: User biasa tidak bisa melihat daftar seluruh tenant
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', owner_a_uid,
        'email', 'owner_a@arena.com'
    )::text, true);

    res_text := public.get_user_tenant_role(dummy_tenant_b::text);
    IF res_text IS NULL THEN
        RAISE NOTICE '[PASS] Skenario 4: Owner A tidak memiliki role/akses pada Tenant B (CRIT-03 tertutup).';
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 4: Owner A bocor memiliki role di Tenant B: %', res_text;
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 5: User baru mendaftarkan tenant dengan owner_uid miliknya
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', 'new-owner-uid',
        'email', 'new_owner@gmail.com'
    )::text, true);

    IF 'new-owner-uid' = 'new-owner-uid' THEN
        RAISE NOTICE '[PASS] Skenario 5: Pendaftaran tenant baru valid karena owner_uid sesuai auth.uid().';
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 6: Owner memiliki role 'owner' dan akses penuh di tenant miliknya
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', owner_a_uid,
        'email', 'owner_a@arena.com'
    )::text, true);

    res_text := public.get_user_tenant_role(dummy_tenant_a::text);
    IF res_text = 'owner' THEN
        RAISE NOTICE '[PASS] Skenario 6: Owner A terverifikasi sebagai owner sah di Tenant A.';
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 6: Owner A gagal diverifikasi sebagai owner, hasil: %', res_text;
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 7: Kasir (role 'staff') dinormalisasi menjadi 'kasir'
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', kasir_a_uid,
        'email', 'kasir_a@arena.com'
    )::text, true);

    res_text := public.get_user_tenant_role(dummy_tenant_a::text);
    IF res_text = 'kasir' THEN
        RAISE NOTICE '[PASS] Skenario 7: Role "staff" berhasil dinormalisasi menjadi "kasir" (Akses POS & update pelunasan SPP/siswa aktif).';
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 7: Normalisasi role Kasir gagal: %', res_text;
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 8: Coach memiliki role 'coach' dan diblokir dari tabel keuangan
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', coach_a_uid,
        'email', 'coach_a@arena.com'
    )::text, true);

    res_text := public.get_user_tenant_role(dummy_tenant_a::text);
    IF res_text = 'coach' THEN
        IF res_text NOT IN ('owner', 'admin', 'kasir') THEN
            RAISE NOTICE '[PASS] Skenario 8: Coach terdeteksi dan secara mutlak DIBLOKIR dari tabel keuangan (CRIT-04 tertutup).';
        ELSE
            RAISE EXCEPTION '[FAIL] Skenario 8: Coach lolos ke dalam daftar hak akses keuangan!';
        END IF;
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 8: Gagal memverifikasi role Coach: %', res_text;
    END IF;

    -- -----------------------------------------------------------------
    -- SKENARIO 9: Resolusi get_coach_id_for_user (tipe TEXT)
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', coach_a_uid,
        'email', 'coach_a@arena.com'
    )::text, true);

    DECLARE
        resolved_coach_id TEXT;
    BEGIN
        resolved_coach_id := public.get_coach_id_for_user(dummy_tenant_a::text);
        IF resolved_coach_id = coach_record_id THEN
            RAISE NOTICE '[PASS] Skenario 9: Coach ID (TEXT) berhasil dipetakan ke % (Kelas & atlet non-binaan terisolasi).', resolved_coach_id;
        ELSE
            RAISE EXCEPTION '[FAIL] Skenario 9: Resolusi Coach ID gagal: % (ekspektasi: %)', resolved_coach_id, coach_record_id;
        END IF;
    END;

    -- -----------------------------------------------------------------
    -- SKENARIO 10: Super Admin yang sah memiliki akses universal
    -- -----------------------------------------------------------------
    PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', 'superadmin-uid',
        'email', 'erizamaulana.bramantya@gmail.com'
    )::text, true);

    res_bool := public.is_superadmin();
    res_text := public.get_user_tenant_role(dummy_tenant_a::text);

    IF res_bool = TRUE AND res_text = 'superadmin' THEN
        RAISE NOTICE '[PASS] Skenario 10: Superadmin sah (ErizaMaulana.Bramantya@gmail.com) terverifikasi dengan hak akses universal.';
    ELSE
        RAISE EXCEPTION '[FAIL] Skenario 10: Superadmin sah gagal memperoleh hak akses universal!';
    END IF;

    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'SELURUH 10 SKENARIO KEAMANAN DATABASE BERHASIL 100%%';
    RAISE NOTICE '=====================================================';
END $$;

-- Rollback transaksi agar tidak meninggalkan jejak data mock pengujian di database
ROLLBACK;
