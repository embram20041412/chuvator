-- =============================================================================
-- CHUVATOR — TASK 03.5: MEASUREMENT METHOD STANDARDIZATION (ADDITIVE MIGRATION)
-- 01_task03_5_measurement_method_standardization.sql
-- =============================================================================
-- TARGET        : Supabase PostgreSQL CHUVATOR (`public.athlete_test_results`)
-- STATUS        : READY FOR ADMIN REVIEW & EXECUTION (JANGAN DIEKSEKUSI OTOMATIS)
-- SIFAT         : Transaksional (BEGIN ... COMMIT), Idempoten, Non-Destruktif.
-- JAMINAN DATA  :
--   1. TIDAK mengubah, menimpa, atau menghapus 5 record eksisting (13 Nov 2026)
--      maupun baris historis lain yang memiliki `measurement_method IS NULL`.
--   2. TIDAK mengasumsikan atau melakukan backfill diam-diam dari NULL ke
--      STOPWATCH_MANUAL pada baris historis.
--   3. Menambahkan constraint kompatibilitas metode per tes untuk seluruh 18 tes
--      Assessment Battery dengan 4 kategori standar:
--        - STOPWATCH_MANUAL
--        - SMARTPHONE_VIDEO
--        - PHYSICAL_MEASURING_TOOL
--        - MANUAL_COUNT
--   4. Memperbarui trigger `validate_and_protect_athlete_test_results()` agar
--      INSERT baru menegakkan standarisasi metode sesuai protokol masing-masing tes.
-- =============================================================================

BEGIN;

-- 1. Pastikan tabel target sudah tersedia sebelum menerapkan penguatan Task 03.5
DO $$
BEGIN
    IF to_regclass('public.athlete_test_results') IS NULL THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIHENTIKAN: Tabel public.athlete_test_results belum tersedia. Jalankan paket migrasi TASK 03.4 terlebih dahulu.'
            USING ERRCODE = '42P01';
    END IF;
END $$;

-- 2. Pastikan kolom measurement_method tersedia (idempoten)
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS measurement_method TEXT NULL;

-- 3. Validasi Non-Destruktif Data Eksisting Sebelum Menambah Constraint
--    (Memastikan tidak ada nilai non-null tidak kompatibel; baris NULL dibiarkan NULL)
DO $$
DECLARE
    v_incompatible_count INTEGER := 0;
BEGIN
    SELECT COUNT(*)
    INTO v_incompatible_count
    FROM public.athlete_test_results
    WHERE measurement_method IS NOT NULL
      AND NOT (
          measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO', 'PHYSICAL_MEASURING_TOOL', 'MANUAL_COUNT')
          AND (
              (test_id IN ('TST-SPR-10M', 'TST-SPR-30M') AND measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'))
              OR (test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA') AND measurement_method = 'STOPWATCH_MANUAL')
              OR (test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST') AND measurement_method = 'PHYSICAL_MEASURING_TOOL')
              OR (test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02') AND measurement_method = 'MANUAL_COUNT')
              OR (test_id NOT IN (
                  'TST-SPR-10M', 'TST-SPR-30M',
                  'TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA',
                  'TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST',
                  'TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02'
              ))
          )
      );

    IF v_incompatible_count > 0 THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIHENTIKAN: Ditemukan % baris eksisting dengan nilai non-null measurement_method yang tidak sesuai protokol 18 tes. Periksa melalui script inspeksi terlebih dahulu (tidak dilakukan penimpaan paksa).',
            v_incompatible_count
            USING ERRCODE = '23514';
    END IF;
END $$;

-- 4. Constraint Kompatibilitas Metode Pengukuran Standar (18 Tes, Izinkan Legacy NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_measurement_method_compatibility'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_measurement_method_compatibility
            CHECK (
                measurement_method IS NULL
                OR (
                    measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO', 'PHYSICAL_MEASURING_TOOL', 'MANUAL_COUNT')
                    AND (
                        (test_id IN ('TST-SPR-10M', 'TST-SPR-30M') AND measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'))
                        OR (test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA') AND measurement_method = 'STOPWATCH_MANUAL')
                        OR (test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST') AND measurement_method = 'PHYSICAL_MEASURING_TOOL')
                        OR (test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02') AND measurement_method = 'MANUAL_COUNT')
                        OR (test_id NOT IN (
                            'TST-SPR-10M', 'TST-SPR-30M',
                            'TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA',
                            'TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST',
                            'TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02'
                        ))
                    )
                )
            );
    END IF;
END $$;

-- 5. Perbarui Fungsi Trigger `validate_and_protect_athlete_test_results()` untuk Standarisasi 18 Tes
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
    v_ctx_method TEXT;
    v_default_single_method TEXT;
    v_raw_age_group TEXT;
    v_ctx_age_group TEXT;
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

    -- Validasi kepemilikan tenant dan status aktif untuk coach_id
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

    -- Ikat/validasi coach_id untuk pengguna terautentikasi dengan peran coach
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

    -- Paksa recorded_by_user_id sesuai auth.uid() saat INSERT dari sesi terautentikasi
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
        NEW.recorded_by_user_id := auth.uid();
    END IF;

    -- Sinkronkan test_period (YYYY-MM) secara deterministik dari test_date
    IF NEW.test_date IS NOT NULL THEN
        NEW.test_period := to_char(NEW.test_date, 'YYYY-MM');
    END IF;

    -- Default metode tunggal standar untuk 16 tes non-dual-method saat INSERT jika tidak diisi
    v_default_single_method := CASE
        WHEN NEW.test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA')
            THEN 'STOPWATCH_MANUAL'
        WHEN NEW.test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST')
            THEN 'PHYSICAL_MEASURING_TOOL'
        WHEN NEW.test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02')
            THEN 'MANUAL_COUNT'
        ELSE NULL
    END;

    -- Normalisasi & Sinkronisasi measurement_method:
    --   * INSERT baru wajib memiliki metode standar kompatibel dengan test_id (tidak boleh NULL atau tidak dikenal).
    --   * UPDATE pada record legacy NULL tetap menjaga NULL selama tidak diubah, dan melarang pengosongan nilai non-null ke NULL.
    v_raw_top_method := NULLIF(UPPER(trim(COALESCE(NEW.measurement_method, ''))), '');
    v_ctx_method := COALESCE(
        NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->>'measurementMethod', ''))), ''),
        NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), ''),
        NULLIF(UPPER(trim(COALESCE(NEW.auxiliary_inputs->>'measurementMethod', ''))), '')
    );
    v_method_json_changed := (TG_OP = 'UPDATE') AND (
        NULLIF(UPPER(trim(COALESCE(OLD.derived_metrics->>'measurementMethod', ''))), '') IS DISTINCT FROM NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->>'measurementMethod', ''))), '')
        OR NULLIF(UPPER(trim(COALESCE(OLD.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), '') IS DISTINCT FROM NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), '')
        OR NULLIF(UPPER(trim(COALESCE(OLD.auxiliary_inputs->>'measurementMethod', ''))), '') IS DISTINCT FROM NULLIF(UPPER(trim(COALESCE(NEW.auxiliary_inputs->>'measurementMethod', ''))), '')
    );

    IF TG_OP = 'INSERT' THEN
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
        IF NEW.measurement_method IS DISTINCT FROM OLD.measurement_method THEN
            IF v_raw_top_method IS NULL THEN
                RAISE EXCEPTION 'measurement_method yang sudah tercatat tidak boleh dikosongkan menjadi NULL.'
                    USING ERRCODE = '23514';
            END IF;
            NEW.measurement_method := v_raw_top_method;
        ELSIF v_method_json_changed THEN
            IF v_ctx_method IS NULL THEN
                IF OLD.measurement_method IS NOT NULL THEN
                    RAISE EXCEPTION 'measurement_method yang sudah tercatat tidak boleh dikosongkan menjadi NULL melalui metadata JSONB.'
                        USING ERRCODE = '23514';
                END IF;
                NEW.measurement_method := NULL;
            ELSE
                NEW.measurement_method := v_ctx_method;
            END IF;
        ELSE
            NEW.measurement_method := NULLIF(UPPER(trim(COALESCE(OLD.measurement_method, ''))), '');
        END IF;
    END IF;

    -- Normalisasi & Sinkronisasi age_group
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

    -- Sinkronisasi age_years_at_test
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

-- 6. Pastikan Kepemilikan & Least-Privilege Function Grants Tetap Terjaga
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        BEGIN
            ALTER FUNCTION public.validate_and_protect_athlete_test_results() OWNER TO postgres;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Catatan Admin: Role eksekutor (%) bukan anggota role postgres; pastikan fungsi SECURITY DEFINER dijalankan oleh role berkemampuan BYPASSRLS.', current_user;
        END;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

COMMIT;
