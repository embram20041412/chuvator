-- =============================================================================
-- CHUVATOR — TASK 03.4.3: SUPABASE DATABASE MIGRATION READINESS (REMEDIATED)
-- 03_security_functions_and_triggers.sql (FAIL-CLOSED SECURITY FUNCTIONS, TRIGGERS & BACKFILL)
-- =============================================================================
-- PERBAIKAN KEAMANAN & INTEGRITAS DATA ATAS TEMUAN AUDIT TASK 03.4.2:
--   1. get_strict_tenant_member_role():
--      - Memblokir Superadmin baik via platform_superadmins maupun public.is_superadmin().
--      - Memeriksa status aktif tenant (`is_active` dan `status`) secara aman.
--      - Memeriksa status aktif staf (`COALESCE(s.is_active, FALSE) = TRUE` dan `status`).
--      - Menolak role 'owner'/'superadmin' yang disisipkan ilegal di users_staff.
--   2. athlete_belongs_to_tenant():
--      - Anti-Enumerasi RPC PostgREST: memvalidasi keanggotaan tenant pemanggil
--        (`get_strict_tenant_member_role`) saat dipanggil dari role `authenticated`/`anon`.
--      - Memvalidasi konsistensi relasional `student.academy_id`, `class.academy_id`,
--        dan `student.tenant_id`.
--   3. coach_can_manage_student():
--      - FAIL-CLOSED 100%: Menolak pelatih apabila tidak memiliki profil aktif
--        tertaut di `public.coaches` (`v_coach_id IS NULL -> RETURN FALSE`), apabila
--        tidak memiliki kelas aktif (`is_archived = FALSE`), apabila `students.class_id IS NULL`,
--        atau apabila `check_class_id` tidak sama persis dengan `students.class_id`.
--   4. validate_and_protect_athlete_test_results():
--      - Memvalidasi kepemilikan `coach_id` terhadap `tenant_id`, status aktif pelatih,
--        serta menolak spoofing `coach_id` oleh role `coach`.
--      - Mengunci penuh kolom audit & identitas pada UPDATE: `id`, `tenant_id`,
--        `student_id`, `created_at`, `recorded_by_user_id` (termasuk NULL -> UUID),
--        `recorded_by_name`, `test_id`, dan `indicator_id`.
--      - Menormalisasi whitespace (`''`/`'   '` -> `NULL`) dan menyinkronkan ulang
--        `measurement_method`, `age_group`, `age_years_at_test`, `test_period`
--        baik saat `INSERT` maupun saat `derived_metrics` berubah pada `UPDATE`.
--   5. Kepemilikan `OWNER TO postgres` eksplisit & Backfill sebelum trigger dibuat
--      agar `updated_at` historis TIDAK pernah tertimpa saat migrasi.
-- =============================================================================

BEGIN;

-- A. Resolusi Peran Anggota Tenant Murni (Tanpa Bypass Superadmin Platform)
CREATE OR REPLACE FUNCTION public.get_strict_tenant_member_role(check_tenant_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid TEXT;
    v_staff_role TEXT;
    v_is_superadmin BOOLEAN := FALSE;
BEGIN
    IF check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN NULL;
    END IF;

    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN NULL;
    END IF;

    -- 1. Blokir penggunaan operasional Assessment Battery oleh Platform Superadmin
    IF EXISTS (
        SELECT 1 FROM public.platform_superadmins ps
        WHERE ps.auth_uid::text = v_caller_uid
    ) THEN
        RETURN NULL;
    END IF;

    IF to_regprocedure('public.is_superadmin()') IS NOT NULL THEN
        EXECUTE 'SELECT COALESCE(public.is_superadmin(), FALSE)' INTO v_is_superadmin;
        IF v_is_superadmin THEN
            RETURN NULL;
        END IF;
    END IF;

    -- 2. Cek apakah pengguna adalah Owner resmi dari tenant aktif pada public.tenants
    IF EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE (t.tenant_id::text = trim(check_tenant_id) OR t.id::text = trim(check_tenant_id))
          AND t.owner_uid::text = v_caller_uid
          AND COALESCE((to_jsonb(t)->>'is_active')::boolean, TRUE) = TRUE
          AND LOWER(COALESCE(NULLIF(trim(t.status), ''), 'active')) IN ('active', 'aktif')
    ) THEN
        RETURN 'owner';
    END IF;

    -- 3. Cek keanggotaan staf/pelatih aktif pada public.users_staff (fail-closed)
    SELECT LOWER(trim(s.role)) INTO v_staff_role
    FROM public.users_staff s
    WHERE s.tenant_id::text = trim(check_tenant_id)
      AND s.uid::text = v_caller_uid
      AND COALESCE((to_jsonb(s)->>'is_active')::boolean, FALSE) = TRUE
      AND LOWER(COALESCE(NULLIF(trim(s.status), ''), 'inactive')) IN ('active', 'aktif')
      AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE (t.tenant_id::text = trim(check_tenant_id) OR t.id::text = trim(check_tenant_id))
            AND COALESCE((to_jsonb(t)->>'is_active')::boolean, TRUE) = TRUE
            AND LOWER(COALESCE(NULLIF(trim(t.status), ''), 'active')) IN ('active', 'aktif')
      )
    LIMIT 1;

    IF v_staff_role IS NOT NULL THEN
        IF v_staff_role IN ('admin', 'administrator') THEN RETURN 'admin';
        ELSIF v_staff_role IN ('coach', 'pelatih') THEN RETURN 'coach';
        ELSIF v_staff_role IN ('kasir', 'cashier') THEN RETURN 'kasir';
        ELSIF v_staff_role IN ('staff', 'staf') THEN RETURN 'staff';
        ELSE RETURN NULL; -- Menolak 'owner' / 'superadmin' yang disisipkan ke users_staff
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- B. Verifikasi Kepemilikan Relasional & Anti-Enumerasi RPC Lintas-Tenant
CREATE OR REPLACE FUNCTION public.athlete_belongs_to_tenant(
    check_student_id UUID,
    check_tenant_id TEXT,
    check_class_id UUID DEFAULT NULL,
    check_academy_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_uid TEXT;
    v_coach_id UUID;
    v_coach_academy_id UUID;
    v_student_record RECORD;
    v_class_record RECORD;
BEGIN
    IF check_student_id IS NULL OR check_tenant_id IS NULL OR trim(check_tenant_id) = '' THEN
        RETURN FALSE;
    END IF;

    -- Cegah pemanggilan anonim dan cegah enumerasi RPC lintas-tenant dari klien terautentikasi
    IF current_user = 'anon' THEN
        RETURN FALSE;
    END IF;

    IF auth.uid() IS NOT NULL OR current_user = 'authenticated' THEN
        v_caller_role := public.get_strict_tenant_member_role(check_tenant_id);
        IF v_caller_role IS NULL THEN
            RETURN FALSE;
        END IF;
    END IF;

    SELECT s.id, s.tenant_id::text AS tenant_id, s.class_id, s.academy_id
    INTO v_student_record
    FROM public.students s
    WHERE s.id = check_student_id
    LIMIT 1;

    IF v_student_record.id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF trim(v_student_record.tenant_id) <> trim(check_tenant_id) THEN
        RETURN FALSE;
    END IF;

    IF check_academy_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.academies a
            WHERE a.id = check_academy_id
              AND trim(a.tenant_id::text) = trim(check_tenant_id)
        ) THEN
            RETURN FALSE;
        END IF;

        IF v_student_record.academy_id IS NOT NULL AND check_academy_id IS DISTINCT FROM v_student_record.academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    IF check_class_id IS NOT NULL THEN
        SELECT c.id, c.tenant_id::text AS tenant_id, c.academy_id
        INTO v_class_record
        FROM public.academy_classes c
        WHERE c.id = check_class_id
          AND trim(c.tenant_id::text) = trim(check_tenant_id)
        LIMIT 1;

        IF v_class_record.id IS NULL THEN
            RETURN FALSE;
        END IF;

        IF check_academy_id IS NOT NULL AND v_class_record.academy_id IS NOT NULL AND v_class_record.academy_id IS DISTINCT FROM check_academy_id THEN
            RETURN FALSE;
        END IF;

        IF v_student_record.academy_id IS NOT NULL AND v_class_record.academy_id IS NOT NULL AND v_class_record.academy_id IS DISTINCT FROM v_student_record.academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Untuk pemanggilan RPC langsung oleh Coach, batasi probing ke siswa dalam kelas aktif miliknya
    IF v_caller_role = 'coach' THEN
        v_caller_uid := auth.uid()::text;
        SELECT c.id, c.academy_id
        INTO v_coach_id, v_coach_academy_id
        FROM public.coaches c
        WHERE trim(c.tenant_id::text) = trim(check_tenant_id)
          AND NULLIF(trim(to_jsonb(c)->>'auth_uid'), '') = v_caller_uid
          AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
          AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
        LIMIT 1;

        IF v_coach_id IS NULL OR v_student_record.class_id IS NULL THEN
            RETURN FALSE;
        END IF;

        IF v_coach_academy_id IS NOT NULL AND v_student_record.academy_id IS NOT NULL AND v_coach_academy_id <> v_student_record.academy_id THEN
            RETURN FALSE;
        END IF;

        IF check_class_id IS NOT NULL AND check_class_id IS DISTINCT FROM v_student_record.class_id THEN
            RETURN FALSE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.academy_classes cls
            WHERE cls.id = v_student_record.class_id
              AND trim(cls.tenant_id::text) = trim(check_tenant_id)
              AND cls.coach_id = v_coach_id
              AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

-- C. Verifikasi Cakupan Hak Akses Pelatih (Coach Scope) — 100% Fail-Closed
CREATE OR REPLACE FUNCTION public.coach_can_manage_student(
    check_tenant_id TEXT,
    check_student_id UUID,
    check_class_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_caller_uid TEXT;
    v_coach_id UUID;
    v_coach_academy_id UUID;
    v_student_academy_id UUID;
    v_student_class_id UUID;
BEGIN
    v_role := public.get_strict_tenant_member_role(check_tenant_id);
    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Owner dan Admin tenant berwenang penuh atas seluruh atlet pada tenant tersebut
    IF v_role IN ('owner', 'admin') THEN
        RETURN public.athlete_belongs_to_tenant(check_student_id, check_tenant_id, check_class_id, NULL);
    END IF;

    -- Selain owner/admin/coach (mis. kasir, staff) DILARANG
    IF v_role <> 'coach' THEN
        RETURN FALSE;
    END IF;

    IF NOT public.athlete_belongs_to_tenant(check_student_id, check_tenant_id, check_class_id, NULL) THEN
        RETURN FALSE;
    END IF;

    v_caller_uid := auth.uid()::text;
    IF v_caller_uid IS NULL OR trim(v_caller_uid) = '' THEN
        RETURN FALSE;
    END IF;

    -- 1. Pelatih wajib memiliki profil aktif tertaut via auth_uid pada public.coaches (FAIL-CLOSED)
    SELECT c.id, c.academy_id
    INTO v_coach_id, v_coach_academy_id
    FROM public.coaches c
    WHERE trim(c.tenant_id::text) = trim(check_tenant_id)
      AND NULLIF(trim(to_jsonb(c)->>'auth_uid'), '') = v_caller_uid
      AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
      AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
    LIMIT 1;

    IF v_coach_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT s.academy_id, s.class_id
    INTO v_student_academy_id, v_student_class_id
    FROM public.students s
    WHERE s.id = check_student_id
      AND trim(s.tenant_id::text) = trim(check_tenant_id)
    LIMIT 1;

    -- 2. Cek batas academy_id pelatih vs akademi siswa
    IF v_coach_academy_id IS NOT NULL AND v_student_academy_id IS NOT NULL THEN
        IF v_coach_academy_id <> v_student_academy_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- 3. Atlet wajib tergabung dalam kelas aktif (bukan tanpa kelas)
    IF v_student_class_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 4. Anti-spoofing class_id: bila payload menyertakan class_id, wajib cocok dengan kelas aktual siswa
    IF check_class_id IS NOT NULL AND check_class_id IS DISTINCT FROM v_student_class_id THEN
        RETURN FALSE;
    END IF;

    -- 5. Kelas aktual siswa wajib aktif (is_archived = FALSE) dan ditugaskan ke pelatih ini
    IF NOT EXISTS (
        SELECT 1 FROM public.academy_classes cls
        WHERE cls.id = v_student_class_id
          AND trim(cls.tenant_id::text) = trim(check_tenant_id)
          AND cls.coach_id = v_coach_id
          AND COALESCE((to_jsonb(cls)->>'is_archived')::boolean, FALSE) = FALSE
    ) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- D. Trigger Integritas Lintas-Tabel, Anti-Spoofing coach_id, Imutabilitas Audit, & Sinkronisasi Konteks
CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_uid TEXT;
    v_caller_coach_id UUID;
    v_student_birth_date DATE;
    v_student_computed_age INTEGER;
    v_ctx_age_text TEXT;
    v_parsed_age INTEGER;
    v_raw_top_method TEXT;
    v_old_top_method TEXT;
    v_dm_method TEXT;
    v_ctx_nested_method TEXT;
    v_aux_method TEXT;
    v_old_dm_method TEXT;
    v_old_ctx_nested_method TEXT;
    v_old_aux_method TEXT;
    v_ctx_method TEXT;
    v_default_single_method TEXT;
    v_raw_age_group TEXT;
    v_ctx_age_group TEXT;
    v_dm_changed BOOLEAN;
    v_ctx_nested_changed BOOLEAN;
    v_aux_changed BOOLEAN;
    v_method_json_changed BOOLEAN;
    v_age_group_json_changed BOOLEAN;
    v_age_years_json_changed BOOLEAN;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Mutasi primary key (id) pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            RAISE EXCEPTION 'Mutasi tenant_id pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'Mutasi student_id pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Mutasi created_at pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id THEN
            RAISE EXCEPTION 'Mutasi recorded_by_user_id pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.recorded_by_name IS DISTINCT FROM OLD.recorded_by_name THEN
            RAISE EXCEPTION 'Mutasi recorded_by_name pada athlete_test_results dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.test_id IS DISTINCT FROM OLD.test_id THEN
            RAISE EXCEPTION 'Mutasi test_id pada baris hasil tes yang sudah tersimpan dilarang.' USING ERRCODE = '42501';
        END IF;
        IF NEW.indicator_id IS DISTINCT FROM OLD.indicator_id THEN
            RAISE EXCEPTION 'Mutasi indicator_id pada baris hasil tes yang sudah tersimpan dilarang.' USING ERRCODE = '42501';
        END IF;
        NEW.updated_at := NOW();
    END IF;

    -- Pastikan student_id, class_id, dan academy_id milik NEW.tenant_id dan konsisten
    IF NOT public.athlete_belongs_to_tenant(NEW.student_id, NEW.tenant_id, NEW.class_id, NEW.academy_id) THEN
        RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): student_id %, class_id %, atau academy_id % bukan milik tenant %.',
            NEW.student_id, NEW.class_id, NEW.academy_id, NEW.tenant_id
            USING ERRCODE = '42501';
    END IF;

    -- Validasi kepemilikan tenant dan status aktif untuk coach_id (anti spoofing lintas-tenant / lintas-pelatih)
    IF NEW.coach_id IS NOT NULL THEN
        IF TG_OP = 'INSERT' OR (NEW.coach_id IS DISTINCT FROM OLD.coach_id) THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.coaches c
                WHERE c.id = NEW.coach_id
                  AND trim(c.tenant_id::text) = trim(NEW.tenant_id)
                  AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
                  AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
            ) THEN
                RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): coach_id % tidak aktif atau bukan milik tenant %.',
                    NEW.coach_id, NEW.tenant_id
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            IF NOT EXISTS (
                SELECT 1 FROM public.coaches c
                WHERE c.id = NEW.coach_id
                  AND trim(c.tenant_id::text) = trim(NEW.tenant_id)
            ) THEN
                RAISE EXCEPTION 'Pelanggaran Integritas Multi-Tenant (42501): coach_id % bukan milik tenant %.',
                    NEW.coach_id, NEW.tenant_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- Jika pemanggil adalah pengguna terautentikasi dengan peran coach, ikat/validasi coach_id miliknya sendiri
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_strict_tenant_member_role(NEW.tenant_id);
        IF v_caller_role = 'coach' THEN
            v_caller_uid := auth.uid()::text;
            SELECT c.id INTO v_caller_coach_id
            FROM public.coaches c
            WHERE trim(c.tenant_id::text) = trim(NEW.tenant_id)
              AND NULLIF(trim(to_jsonb(c)->>'auth_uid'), '') = v_caller_uid
              AND COALESCE((to_jsonb(c)->>'is_active')::boolean, TRUE) = TRUE
              AND LOWER(COALESCE(NULLIF(trim(c.status), ''), 'active')) IN ('active', 'aktif')
            LIMIT 1;

            IF v_caller_coach_id IS NULL THEN
                RAISE EXCEPTION 'Akses ditolak (42501): Akun coach tidak memiliki profil aktif pada public.coaches.' USING ERRCODE = '42501';
            END IF;

            IF TG_OP = 'INSERT' THEN
                IF NEW.coach_id IS NULL THEN
                    NEW.coach_id := v_caller_coach_id;
                ELSIF NEW.coach_id <> v_caller_coach_id THEN
                    RAISE EXCEPTION 'Pelanggaran Keamanan (42501): Coach dilarang menyisipkan coach_id milik pelatih lain.' USING ERRCODE = '42501';
                END IF;
            ELSIF TG_OP = 'UPDATE' AND (NEW.coach_id IS DISTINCT FROM OLD.coach_id) THEN
                RAISE EXCEPTION 'Pelanggaran Keamanan (42501): Coach dilarang mengubah coach_id pada data hasil tes.' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- Paksa recorded_by_user_id sesuai auth.uid() saat INSERT dari sesi pengguna terautentikasi
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
    END IF;

    -- Sinkronkan test_period (YYYY-MM) secara deterministik dari test_date
    IF NEW.test_date IS NOT NULL THEN
        NEW.test_period := to_char(NEW.test_date, 'YYYY-MM');
    END IF;

    -- Default metode tunggal standar untuk 16 tes non-dual-method saat INSERT jika tidak diisi (Task 03.5)
    v_default_single_method := CASE
        WHEN NEW.test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA')
            THEN 'STOPWATCH_MANUAL'
        WHEN NEW.test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST')
            THEN 'PHYSICAL_MEASURING_TOOL'
        WHEN NEW.test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02')
            THEN 'MANUAL_COUNT'
        ELSE NULL
    END;

    -- Normalisasi & Sinkronisasi measurement_method + seluruh jalur JSONB:
    --   * INSERT baru wajib memiliki metode standar kompatibel dengan test_id (tidak boleh NULL atau tidak dikenal).
    --   * UPDATE pada record legacy NULL tetap menjaga NULL selama tidak diubah, dan melarang pengosongan nilai non-null ke NULL.
    v_raw_top_method := NULLIF(UPPER(trim(COALESCE(NEW.measurement_method, ''))), '');
    v_dm_method := NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->>'measurementMethod', ''))), '');
    v_ctx_nested_method := NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), '');
    v_aux_method := NULLIF(UPPER(trim(COALESCE(NEW.auxiliary_inputs->>'measurementMethod', ''))), '');
    v_ctx_method := COALESCE(v_dm_method, v_ctx_nested_method, v_aux_method);

    IF TG_OP = 'INSERT' THEN
        IF (v_dm_method IS NOT NULL AND v_ctx_nested_method IS NOT NULL AND v_dm_method IS DISTINCT FROM v_ctx_nested_method)
           OR (v_dm_method IS NOT NULL AND v_aux_method IS NOT NULL AND v_dm_method IS DISTINCT FROM v_aux_method)
           OR (v_ctx_nested_method IS NOT NULL AND v_aux_method IS NOT NULL AND v_ctx_nested_method IS DISTINCT FROM v_aux_method) THEN
            RAISE EXCEPTION 'Inkonsistensi measurement_method antar metadata JSONB untuk test_id %.',
                NEW.test_id
                USING ERRCODE = '23514';
        END IF;

        IF v_raw_top_method IS NOT NULL THEN
            IF v_ctx_method IS NOT NULL AND v_ctx_method IS DISTINCT FROM v_raw_top_method THEN
                RAISE EXCEPTION 'Inkonsistensi measurement_method kolom (%) dengan JSONB (%) untuk test_id %.',
                    v_raw_top_method, v_ctx_method, NEW.test_id
                    USING ERRCODE = '23514';
            END IF;
            NEW.measurement_method := v_raw_top_method;
        ELSIF v_ctx_method IS NOT NULL THEN
            NEW.measurement_method := v_ctx_method;
        ELSIF v_default_single_method IS NOT NULL THEN
            NEW.measurement_method := v_default_single_method;
        ELSE
            RAISE EXCEPTION 'measurement_method wajib diisi dengan metode pengukuran standar yang kompatibel untuk test_id %.',
                NEW.test_id
                USING ERRCODE = '23514';
        END IF;
    ELSE
        v_old_top_method := NULLIF(UPPER(trim(COALESCE(OLD.measurement_method, ''))), '');
        v_old_dm_method := NULLIF(UPPER(trim(COALESCE(OLD.derived_metrics->>'measurementMethod', ''))), '');
        v_old_ctx_nested_method := NULLIF(UPPER(trim(COALESCE(OLD.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), '');
        v_old_aux_method := NULLIF(UPPER(trim(COALESCE(OLD.auxiliary_inputs->>'measurementMethod', ''))), '');

        v_dm_changed := v_old_dm_method IS DISTINCT FROM v_dm_method;
        v_ctx_nested_changed := v_old_ctx_nested_method IS DISTINCT FROM v_ctx_nested_method;
        v_aux_changed := v_old_aux_method IS DISTINCT FROM v_aux_method;
        v_method_json_changed := v_dm_changed OR v_ctx_nested_changed OR v_aux_changed;

        IF v_method_json_changed THEN
            IF (v_dm_method IS NOT NULL AND v_ctx_nested_method IS NOT NULL AND v_dm_method IS DISTINCT FROM v_ctx_nested_method)
               OR (v_dm_method IS NOT NULL AND v_aux_method IS NOT NULL AND v_dm_method IS DISTINCT FROM v_aux_method)
               OR (v_ctx_nested_method IS NOT NULL AND v_aux_method IS NOT NULL AND v_ctx_nested_method IS DISTINCT FROM v_aux_method) THEN
                RAISE EXCEPTION 'Inkonsistensi measurement_method antar metadata JSONB pada UPDATE untuk test_id %.',
                    NEW.test_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        IF NEW.measurement_method IS DISTINCT FROM OLD.measurement_method THEN
            IF v_raw_top_method IS NULL THEN
                RAISE EXCEPTION 'measurement_method yang sudah tercatat tidak boleh dikosongkan menjadi NULL.'
                    USING ERRCODE = '23514';
            END IF;
            IF v_method_json_changed AND v_ctx_method IS NOT NULL AND v_ctx_method IS DISTINCT FROM v_raw_top_method THEN
                RAISE EXCEPTION 'Inkonsistensi measurement_method kolom (%) dengan JSONB (%) saat UPDATE untuk test_id %.',
                    v_raw_top_method, v_ctx_method, NEW.test_id
                    USING ERRCODE = '23514';
            END IF;
            NEW.measurement_method := v_raw_top_method;
        ELSIF v_method_json_changed THEN
            IF v_ctx_method IS NULL THEN
                IF v_old_top_method IS NOT NULL THEN
                    RAISE EXCEPTION 'measurement_method yang sudah tercatat tidak boleh dikosongkan menjadi NULL melalui metadata JSONB.'
                        USING ERRCODE = '23514';
                END IF;
                NEW.measurement_method := NULL;
            ELSE
                NEW.measurement_method := v_ctx_method;
            END IF;
        ELSE
            NEW.measurement_method := v_old_top_method;
        END IF;
    END IF;

    IF NEW.measurement_method IS NOT NULL THEN
        IF NEW.measurement_method NOT IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO', 'PHYSICAL_MEASURING_TOOL', 'MANUAL_COUNT')
           OR (NEW.test_id IN ('TST-SPR-10M', 'TST-SPR-30M') AND NEW.measurement_method NOT IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'))
           OR (NEW.test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA') AND NEW.measurement_method <> 'STOPWATCH_MANUAL')
           OR (NEW.test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST') AND NEW.measurement_method <> 'PHYSICAL_MEASURING_TOOL')
           OR (NEW.test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02') AND NEW.measurement_method <> 'MANUAL_COUNT')
        THEN
            RAISE EXCEPTION 'measurement_method (%) tidak dikenal atau tidak kompatibel untuk test_id %.',
                NEW.measurement_method, NEW.test_id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Normalisasi & Sinkronisasi age_group (INSERT maupun UPDATE saat derived_metrics berubah)
    v_raw_age_group := NULLIF(trim(COALESCE(NEW.age_group, '')), '');
    v_ctx_age_group := NULLIF(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'ageGroup', '')), '');
    v_age_group_json_changed := (TG_OP = 'UPDATE') AND (
        NULLIF(trim(COALESCE(OLD.derived_metrics->'athleteTestContext'->>'ageGroup', '')), '')
        IS DISTINCT FROM v_ctx_age_group
    );

    IF TG_OP = 'UPDATE' AND (NEW.age_group IS DISTINCT FROM OLD.age_group) THEN
        NEW.age_group := v_raw_age_group;
    ELSIF v_age_group_json_changed THEN
        NEW.age_group := v_ctx_age_group;
    ELSIF v_raw_age_group IS NOT NULL THEN
        NEW.age_group := v_raw_age_group;
    ELSE
        NEW.age_group := v_ctx_age_group;
    END IF;

    -- Sinkronisasi age_years_at_test (prioritas konteks eksplisit 3..65 -> fallback students.birth_date pada test_date)
    v_ctx_age_text := NULLIF(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'ageYearsAtTest', '')), '');
    v_parsed_age := NULL;
    IF v_ctx_age_text IS NOT NULL AND v_ctx_age_text ~ '^\d{1,2}$' THEN
        IF v_ctx_age_text::integer BETWEEN 3 AND 65 THEN
            v_parsed_age := v_ctx_age_text::integer;
        END IF;
    END IF;

    v_age_years_json_changed := (TG_OP = 'UPDATE') AND (
        NULLIF(trim(COALESCE(OLD.derived_metrics->'athleteTestContext'->>'ageYearsAtTest', '')), '')
        IS DISTINCT FROM v_ctx_age_text
    );

    IF TG_OP = 'UPDATE' AND (NEW.age_years_at_test IS DISTINCT FROM OLD.age_years_at_test) THEN
        -- Pertahankan nilai eksplisit baru dari payload UPDATE (tetap dicek constraint 3..65)
        NULL;
    ELSIF v_age_years_json_changed THEN
        NEW.age_years_at_test := v_parsed_age;
    ELSIF NEW.age_years_at_test IS NULL OR (TG_OP = 'UPDATE' AND NEW.test_date IS DISTINCT FROM OLD.test_date) THEN
        IF v_parsed_age IS NOT NULL AND NOT (TG_OP = 'UPDATE' AND NEW.test_date IS DISTINCT FROM OLD.test_date) THEN
            NEW.age_years_at_test := v_parsed_age;
        ELSE
            SELECT s.birth_date INTO v_student_birth_date
            FROM public.students s
            WHERE s.id = NEW.student_id
            LIMIT 1;

            IF v_student_birth_date IS NOT NULL AND NEW.test_date IS NOT NULL THEN
                v_student_computed_age := EXTRACT(YEAR FROM age(NEW.test_date, v_student_birth_date))::integer;
                IF v_student_computed_age BETWEEN 3 AND 65 THEN
                    NEW.age_years_at_test := v_student_computed_age;
                ELSE
                    NEW.age_years_at_test := v_parsed_age;
                END IF;
            ELSE
                NEW.age_years_at_test := v_parsed_age;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- E. Tetapkan Kepemilikan Fungsi SECURITY DEFINER & Hak Eksekusi Least-Privilege
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        BEGIN
            ALTER FUNCTION public.get_strict_tenant_member_role(TEXT) OWNER TO postgres;
            ALTER FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) OWNER TO postgres;
            ALTER FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) OWNER TO postgres;
            ALTER FUNCTION public.validate_and_protect_athlete_test_results() OWNER TO postgres;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Catatan Admin: Role eksekutor (%) bukan anggota role postgres; pastikan fungsi SECURITY DEFINER dijalankan oleh role berkemampuan BYPASSRLS.', current_user;
        END;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_strict_tenant_member_role(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_strict_tenant_member_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) TO authenticated;

-- F. Lepas Trigger SEBELUM Backfill agar updated_at Data Historis TIDAK Pernah Tertimpa
DROP TRIGGER IF EXISTS trg_protect_athlete_test_results_columns ON public.athlete_test_results;
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;

-- G. Backfill Aman & Idempoten (Memakai nested CASE untuk safety cast integer, tanpa menyentuh updated_at/raw/score)
UPDATE public.athlete_test_results
SET
    test_period = COALESCE(test_period, to_char(test_date, 'YYYY-MM')),
    measurement_method = COALESCE(
        NULLIF(UPPER(trim(measurement_method)), ''),
        CASE
            WHEN test_id IN ('TST-SPR-10M', 'TST-SPR-30M') THEN
                CASE
                    WHEN UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
                    THEN UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), ''))
                    WHEN UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
                    THEN UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), ''))
                    WHEN UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), '')) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
                    THEN UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                    ELSE NULL
                END
            WHEN test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA') THEN
                CASE
                    WHEN COALESCE(
                        UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                    ) = 'STOPWATCH_MANUAL' THEN 'STOPWATCH_MANUAL'
                    ELSE NULL
                END
            WHEN test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST') THEN
                CASE
                    WHEN COALESCE(
                        UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                    ) = 'PHYSICAL_MEASURING_TOOL' THEN 'PHYSICAL_MEASURING_TOOL'
                    ELSE NULL
                END
            WHEN test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02') THEN
                CASE
                    WHEN COALESCE(
                        UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                    ) = 'MANUAL_COUNT' THEN 'MANUAL_COUNT'
                    ELSE NULL
                END
            ELSE
                CASE
                    WHEN COALESCE(
                        UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                    ) IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO', 'PHYSICAL_MEASURING_TOOL', 'MANUAL_COUNT')
                    THEN COALESCE(
                        UPPER(NULLIF(trim(derived_metrics->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(derived_metrics->'athleteTestContext'->>'measurementMethod'), '')),
                        UPPER(NULLIF(trim(auxiliary_inputs->>'measurementMethod'), ''))
                    )
                    ELSE NULL
                END
        END
    ),
    age_group = COALESCE(
        NULLIF(trim(age_group), ''),
        NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageGroup'), '')
    ),
    age_years_at_test = COALESCE(
        age_years_at_test,
        CASE
            WHEN NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageYearsAtTest'), '') ~ '^\d{1,2}$' THEN
                CASE
                    WHEN NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageYearsAtTest'), '')::integer BETWEEN 3 AND 65
                    THEN NULLIF(trim(derived_metrics->'athleteTestContext'->>'ageYearsAtTest'), '')::integer
                    ELSE NULL
                END
            ELSE NULL
        END
    )
WHERE test_period IS NULL
   OR (measurement_method IS NULL AND (
       derived_metrics ? 'measurementMethod'
       OR derived_metrics->'athleteTestContext' ? 'measurementMethod'
       OR auxiliary_inputs ? 'measurementMethod'
   ))
   OR (measurement_method IS NOT NULL AND trim(measurement_method) = '')
   OR (age_group IS NULL AND derived_metrics->'athleteTestContext' ? 'ageGroup')
   OR (age_group IS NOT NULL AND trim(age_group) = '')
   OR (age_years_at_test IS NULL AND derived_metrics->'athleteTestContext' ? 'ageYearsAtTest');

-- H. Pasang Trigger Proteksi SETELAH Backfill Selesai
CREATE TRIGGER trg_validate_and_protect_athlete_test_results
    BEFORE INSERT OR UPDATE ON public.athlete_test_results
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_and_protect_athlete_test_results();

COMMIT;
