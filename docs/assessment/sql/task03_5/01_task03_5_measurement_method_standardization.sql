-- =============================================================================
-- CHUVATOR — TASK 03.5.3: MEASUREMENT METHOD STANDARDIZATION (FINAL GAP CLOSURE)
-- 01_task03_5_measurement_method_standardization.sql
-- =============================================================================
-- TARGET        : Supabase PostgreSQL CHUVATOR (`public.athlete_test_results`)
-- STATUS        : READY FOR ADMIN REVIEW & EXECUTION (JANGAN DIEKSEKUSI OTOMATIS)
-- SIFAT         : Transaksional (BEGIN ... COMMIT), Idempoten, Non-Destruktif.
-- ACUAN PRODUKSI:
--   Mempertahankan utuh seluruh proteksi fungsi & trigger produksi CHUVATOR:
--     - public.get_strict_tenant_member_role(TEXT)
--     - public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID)
--     - public.coach_can_manage_student(TEXT, UUID, UUID)
--     - public.validate_and_protect_athlete_test_results()
--     - Trigger BEFORE INSERT OR UPDATE: trg_validate_and_protect_athlete_test_results
-- JAMINAN DATA  :
--   1. TIDAK mengubah, menimpa, atau backfill 5 record eksisting (13 Nov 2026)
--      maupun baris historis lain yang memiliki `measurement_method IS NULL`.
--   2. Menambahkan constraint kompatibilitas metode 18 tes
--      (`chk_athlete_test_results_measurement_method_compatibility`) dan
--      menangani constraint lama `chk_athlete_test_results_spr10m_method` secara
--      aman (dicabut setelah constraint 18 tes aktif dalam 1 transaksi agar tidak
--      terjadi konflik/duplikasi aturan).
--   3. Menegakkan 8 aturan trigger (INSERT wajib metode valid 18 tes, dual-method
--      eksplisit, single-method auto-default, tolak 23514 metode invalid/salah,
--      UPDATE kolom lain menjaga legacy NULL, larang kosongkan non-null -> NULL,
--      cegah bypass/kontradiksi via JSONB derived_metrics & auxiliary_inputs,
--      serta menjaga SECURITY DEFINER, search_path, OWNER TO postgres, RLS & GRANTS).
-- =============================================================================

BEGIN;

-- 1. Pastikan tabel target dan fungsi keamanan inti produksi tersedia sebelum menerapkan Task 03.5
DO $$
BEGIN
    IF to_regclass('public.athlete_test_results') IS NULL THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIHENTIKAN: Tabel public.athlete_test_results belum tersedia. Jalankan paket migrasi TASK 03.4 terlebih dahulu.'
            USING ERRCODE = '42P01';
    END IF;

    IF to_regprocedure('public.get_strict_tenant_member_role(text)') IS NULL
       OR to_regprocedure('public.athlete_belongs_to_tenant(uuid,text,uuid,uuid)') IS NULL
       OR to_regprocedure('public.coach_can_manage_student(text,uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIHENTIKAN: Fungsi keamanan produksi (get_strict_tenant_member_role / athlete_belongs_to_tenant / coach_can_manage_student) belum lengkap.'
            USING ERRCODE = '42883';
    END IF;
END $$;

-- 2. Pastikan kolom measurement_method tersedia (idempoten)
ALTER TABLE public.athlete_test_results
    ADD COLUMN IF NOT EXISTS measurement_method TEXT NULL;

-- 3. Validasi Non-Destruktif Data Eksisting Sebelum Menambah Constraint
--    (Memastikan tidak ada nilai non-null tidak kompatibel; baris NULL tetap dibiarkan NULL)
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
          )
      );

    IF v_incompatible_count > 0 THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIHENTIKAN: Ditemukan % baris eksisting dengan nilai non-null measurement_method atau test_id di luar protokol 18 tes. Periksa melalui script inspeksi terlebih dahulu (tidak dilakukan penimpaan paksa).',
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
                    )
                )
            );
    END IF;
END $$;

-- 5. Penanganan Aman Constraint Lama `chk_athlete_test_results_spr10m_method`
--    Dicabut SETELAH `chk_athlete_test_results_measurement_method_compatibility` aktif
--    di dalam transaksi yang sama agar aturan TST-SPR-10M tetap terlindungi penuh
--    tanpa potensi konflik definisi constraint lama di database produksi.
ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_spr10m_method;

-- 6. Rekonsiliasi Fungsi Trigger `validate_and_protect_athlete_test_results()`
--    Mempertahankan seluruh proteksi produksi + mengintegrasikan standarisasi 18 tes & anti-bypass JSONB.
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
    v_conflict_method TEXT;
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

    -- Pastikan INSERT baru hanya memakai 18 test_id resmi Assessment Battery
    -- (Evaluasi non-objective-test disimpan di public.academy_evaluations; baris historis tidak diubah).
    IF TG_OP = 'INSERT' AND (
        NEW.test_id IS NULL OR NEW.test_id NOT IN (
            'TST-SPR-10M', 'TST-SPR-30M',
            'TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA',
            'TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST',
            'TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02'
        )
    ) THEN
        RAISE EXCEPTION 'test_id (%) tidak terdaftar pada katalog resmi 18 tes Assessment Battery.',
            COALESCE(NEW.test_id, 'NULL')
            USING ERRCODE = '23514';
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

    -- Ekstraksi & Normalisasi measurement_method kolom + seluruh jalur JSONB
    v_raw_top_method := NULLIF(UPPER(trim(COALESCE(NEW.measurement_method, ''))), '');
    v_dm_method := NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->>'measurementMethod', ''))), '');
    v_ctx_nested_method := NULLIF(UPPER(trim(COALESCE(NEW.derived_metrics->'athleteTestContext'->>'measurementMethod', ''))), '');
    v_aux_method := NULLIF(UPPER(trim(COALESCE(NEW.auxiliary_inputs->>'measurementMethod', ''))), '');
    v_ctx_method := COALESCE(v_dm_method, v_ctx_nested_method, v_aux_method);

    IF TG_OP = 'INSERT' THEN
        -- Cegah kontradiksi/bypass antar key JSONB (derived_metrics, athleteTestContext, auxiliary_inputs)
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

        -- Jika kolom utama berubah ATAU ada mutasi pada jalur JSONB mana pun,
        -- seluruh key JSONB non-null pada 3 jalur wajib saling konsisten.
        IF (NEW.measurement_method IS DISTINCT FROM OLD.measurement_method) OR v_method_json_changed THEN
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

            -- Periksa SELURUH nilai non-NULL pada 3 jalur JSONB walaupun JSONB tidak ikut berubah
            v_conflict_method := COALESCE(
                CASE WHEN v_dm_method IS NOT NULL AND v_dm_method IS DISTINCT FROM v_raw_top_method THEN v_dm_method ELSE NULL END,
                CASE WHEN v_ctx_nested_method IS NOT NULL AND v_ctx_nested_method IS DISTINCT FROM v_raw_top_method THEN v_ctx_nested_method ELSE NULL END,
                CASE WHEN v_aux_method IS NOT NULL AND v_aux_method IS DISTINCT FROM v_raw_top_method THEN v_aux_method ELSE NULL END
            );
            IF v_conflict_method IS NOT NULL THEN
                RAISE EXCEPTION 'Inkonsistensi measurement_method kolom (%) dengan JSONB (%) saat UPDATE untuk test_id %.',
                    v_raw_top_method, v_conflict_method, NEW.test_id
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

    -- Penegakan kompatibilitas di level trigger untuk setiap nilai non-NULL
    -- (Record legacy dengan measurement_method NULL pada UPDATE kolom lain tetap diizinkan)
    IF NEW.measurement_method IS NOT NULL THEN
        IF NEW.measurement_method NOT IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO', 'PHYSICAL_MEASURING_TOOL', 'MANUAL_COUNT')
           OR (NEW.test_id IN ('TST-SPR-10M', 'TST-SPR-30M') AND NEW.measurement_method NOT IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO'))
           OR (NEW.test_id IN ('TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA') AND NEW.measurement_method <> 'STOPWATCH_MANUAL')
           OR (NEW.test_id IN ('TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST') AND NEW.measurement_method <> 'PHYSICAL_MEASURING_TOOL')
           OR (NEW.test_id IN ('TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02') AND NEW.measurement_method <> 'MANUAL_COUNT')
           OR (NEW.test_id NOT IN (
               'TST-SPR-10M', 'TST-SPR-30M',
               'TST-AGL-ARW', 'TST-BAL-STK', 'TST-COD-505', 'TST-COR-PLK', 'TST-RSA-630', 'TST-SSB-GK-03', 'TST-WF-TLA',
               'TST-MOB-SAR', 'TST-RXN-RLR', 'TST-JMP-VER', 'TST-PWR-SBJ', 'TST-SHT-DST',
               'TST-END-BLP', 'TST-STR-PU1', 'TST-SSB-WAP', 'TST-SSB-GK-02'
           ))
        THEN
            RAISE EXCEPTION 'measurement_method (%) tidak dikenal atau tidak kompatibel untuk test_id %.',
                NEW.measurement_method, NEW.test_id
                USING ERRCODE = '23514';
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

-- 7. Pastikan Trigger Aktif `trg_validate_and_protect_athlete_test_results` Terpasang
--    sebagai BEFORE INSERT OR UPDATE tanpa mengubah baris data eksisting.
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;
CREATE TRIGGER trg_validate_and_protect_athlete_test_results
    BEFORE INSERT OR UPDATE ON public.athlete_test_results
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_and_protect_athlete_test_results();

-- 8. Penetapan Kepemilikan `postgres` (Fail-Closed) & Least-Privilege Function Grants
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIBATALKAN (ROLLBACK): Role wajib "postgres" tidak ditemukan pada pg_roles.'
            USING ERRCODE = '42501';
    END IF;
END $$;

ALTER FUNCTION public.validate_and_protect_athlete_test_results() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

-- 9. Verifikasi Eksplisit Pasca CREATE OR REPLACE FUNCTION (ROLLBACK otomatis bila gagal)
DO $$
DECLARE
    v_fn_oid OID;
    v_owner TEXT;
    v_secdef BOOLEAN;
    v_config TEXT[];
    v_public_exec BOOLEAN;
    v_anon_exec BOOLEAN;
    v_auth_exec BOOLEAN;
    v_trig_active BOOLEAN;
BEGIN
    v_fn_oid := to_regprocedure('public.validate_and_protect_athlete_test_results()');
    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIBATALKAN: Fungsi public.validate_and_protect_athlete_test_results() tidak ditemukan.'
            USING ERRCODE = '42883';
    END IF;

    SELECT
        pg_get_userbyid(p.proowner),
        p.prosecdef,
        p.proconfig,
        has_function_privilege('public', p.oid, 'EXECUTE'),
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
    INTO
        v_owner,
        v_secdef,
        v_config,
        v_public_exec,
        v_anon_exec,
        v_auth_exec
    FROM pg_proc p
    WHERE p.oid = v_fn_oid;

    IF v_owner IS DISTINCT FROM 'postgres' THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIBATALKAN (ROLLBACK): Owner fungsi trigger adalah %, wajib postgres.', v_owner
            USING ERRCODE = '42501';
    END IF;

    IF v_secdef IS NOT TRUE THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIBATALKAN (ROLLBACK): SECURITY DEFINER harus aktif pada validate_and_protect_athlete_test_results().'
            USING ERRCODE = '42501';
    END IF;

    IF NOT ('search_path=public, extensions, pg_temp' = ANY(COALESCE(v_config, ARRAY[]::text[]))) THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIBATALKAN (ROLLBACK): search_path fungsi trigger tidak sesuai (%).', array_to_string(v_config, '; ')
            USING ERRCODE = '42501';
    END IF;

    IF v_public_exec OR v_anon_exec OR v_auth_exec THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIBATALKAN (ROLLBACK): Hak EXECUTE fungsi trigger bocor (public=%, anon=%, authenticated=%).',
            v_public_exec, v_anon_exec, v_auth_exec
            USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'athlete_test_results'
          AND t.tgname = 'trg_validate_and_protect_athlete_test_results'
          AND t.tgfoid = v_fn_oid
          AND t.tgenabled <> 'D'
          AND NOT t.tgisinternal
    ) INTO v_trig_active;

    IF NOT v_trig_active THEN
        RAISE EXCEPTION 'MIGRASI TASK 03.5 DIBATALKAN (ROLLBACK): Trigger trg_validate_and_protect_athlete_test_results tidak aktif atau tidak tertaut ke fungsi trigger terbaru.'
            USING ERRCODE = '42501';
    END IF;
END $$;

COMMIT;
