-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — PHASE 6: SCOUTING COMBINE & ASSESSMENT BATTERY
-- Target: Supabase PostgreSQL (SQL Editor / Migration Pipeline)
-- Fitur: Assessment Tests Catalog, Athlete Test Results, & Indicator Scores
-- Keamanan: Multi-Tenant Row-Level Security (Tenant Isolation & RBAC)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABEL: public.assessment_tests_catalog
-- Menyimpan daftar master tes lapangan (Teknik, Fisik, Taktik, Mental, Komunikasi)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.assessment_tests_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_type TEXT NOT NULL DEFAULT 'football' CHECK (sport_type IN ('football')),
    category TEXT NOT NULL CHECK (category IN ('Teknik', 'Fisik', 'Taktik', 'Mental', 'Komunikasi')),
    indicator_key TEXT NOT NULL,
    test_name TEXT NOT NULL,
    measurement_type TEXT NOT NULL CHECK (measurement_type IN ('TIME', 'ACCURACY', 'REPS', 'RUBRIC')),
    unit TEXT NOT NULL,
    description TEXT NOT NULL,
    min_tier INTEGER NOT NULL DEFAULT 1 CHECK (min_tier BETWEEN 1 AND 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_tests_catalog_sport_cat
    ON public.assessment_tests_catalog (sport_type, category, min_tier);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_tests_catalog_indicator_key
    ON public.assessment_tests_catalog (sport_type, indicator_key);

-- =========================================================================
-- 2. TABEL: public.athlete_test_results
-- Menyimpan hasil mentah tes lapangan yang dicatat pelatih (skor instan 1-100)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    athlete_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES public.assessment_tests_catalog(id) ON DELETE RESTRICT,
    evaluator_id UUID,
    raw_value_1 NUMERIC(10, 2) NOT NULL,
    raw_value_2 NUMERIC(10, 2),
    errors_count INTEGER NOT NULL DEFAULT 0 CHECK (errors_count >= 0),
    calculated_score INTEGER NOT NULL CHECK (calculated_score BETWEEN 1 AND 100),
    testing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_athlete
    ON public.athlete_test_results (tenant_id, athlete_id, testing_date DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_results_test_id
    ON public.athlete_test_results (test_id);

-- =========================================================================
-- 3. TABEL: public.athlete_indicator_scores
-- Menyimpan skor akhir per indikator yang dibaca oleh Grafik Polar Area / Rapor
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_indicator_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    athlete_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    indicator_key TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 100),
    source TEXT NOT NULL CHECK (source IN ('battery_test', 'coach_manual')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_athlete_indicator_scores_tenant_athlete_key
        UNIQUE (tenant_id, athlete_id, indicator_key)
);

CREATE INDEX IF NOT EXISTS idx_athlete_indicator_scores_lookup
    ON public.athlete_indicator_scores (tenant_id, athlete_id);

-- Trigger otomatis memperbarui updated_at saat skor indikator di-upsert
CREATE OR REPLACE FUNCTION public.trg_set_athlete_indicator_scores_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_athlete_indicator_scores_updated_at ON public.athlete_indicator_scores;
CREATE TRIGGER set_athlete_indicator_scores_updated_at
    BEFORE UPDATE ON public.athlete_indicator_scores
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_set_athlete_indicator_scores_updated_at();

-- =========================================================================
-- 4. KEBIJAKAN ROW-LEVEL SECURITY (RLS) & ISOLASI TENANT
-- =========================================================================

ALTER TABLE public.assessment_tests_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_tests_catalog FORCE ROW LEVEL SECURITY;

ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;

ALTER TABLE public.athlete_indicator_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_indicator_scores FORCE ROW LEVEL SECURITY;

-- Kebijakan Katalog Master Tes (Read-only untuk pengguna terautentikasi, tulis khusus Superadmin)
DROP POLICY IF EXISTS "assessment_tests_catalog_select_rbac" ON public.assessment_tests_catalog;
CREATE POLICY "assessment_tests_catalog_select_rbac"
    ON public.assessment_tests_catalog
    FOR SELECT
    USING (auth.uid() IS NOT NULL OR public.is_superadmin());

DROP POLICY IF EXISTS "assessment_tests_catalog_insert_rbac" ON public.assessment_tests_catalog;
CREATE POLICY "assessment_tests_catalog_insert_rbac"
    ON public.assessment_tests_catalog
    FOR INSERT
    WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "assessment_tests_catalog_update_rbac" ON public.assessment_tests_catalog;
CREATE POLICY "assessment_tests_catalog_update_rbac"
    ON public.assessment_tests_catalog
    FOR UPDATE
    USING (public.is_superadmin())
    WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "assessment_tests_catalog_delete_rbac" ON public.assessment_tests_catalog;
CREATE POLICY "assessment_tests_catalog_delete_rbac"
    ON public.assessment_tests_catalog
    FOR DELETE
    USING (public.is_superadmin());

-- Kebijakan Hasil Tes Lapangan (Isolasi ketat berdasarkan tenant_id & otoritas akademi)
DROP POLICY IF EXISTS "athlete_test_results_select_rbac" ON public.athlete_test_results;
CREATE POLICY "athlete_test_results_select_rbac"
    ON public.athlete_test_results
    FOR SELECT
    USING (public.is_superadmin() OR public.user_has_tenant_access(tenant_id::text));

DROP POLICY IF EXISTS "athlete_test_results_insert_rbac" ON public.athlete_test_results;
CREATE POLICY "athlete_test_results_insert_rbac"
    ON public.athlete_test_results
    FOR INSERT
    WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));

DROP POLICY IF EXISTS "athlete_test_results_update_rbac" ON public.athlete_test_results;
CREATE POLICY "athlete_test_results_update_rbac"
    ON public.athlete_test_results
    FOR UPDATE
    USING (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text))
    WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));

DROP POLICY IF EXISTS "athlete_test_results_delete_rbac" ON public.athlete_test_results;
CREATE POLICY "athlete_test_results_delete_rbac"
    ON public.athlete_test_results
    FOR DELETE
    USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));

-- Kebijakan Skor Indikator Rapor (Isolasi ketat berdasarkan tenant_id & otoritas akademi)
DROP POLICY IF EXISTS "athlete_indicator_scores_select_rbac" ON public.athlete_indicator_scores;
CREATE POLICY "athlete_indicator_scores_select_rbac"
    ON public.athlete_indicator_scores
    FOR SELECT
    USING (public.is_superadmin() OR public.user_has_tenant_access(tenant_id::text));

DROP POLICY IF EXISTS "athlete_indicator_scores_insert_rbac" ON public.athlete_indicator_scores;
CREATE POLICY "athlete_indicator_scores_insert_rbac"
    ON public.athlete_indicator_scores
    FOR INSERT
    WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));

DROP POLICY IF EXISTS "athlete_indicator_scores_update_rbac" ON public.athlete_indicator_scores;
CREATE POLICY "athlete_indicator_scores_update_rbac"
    ON public.athlete_indicator_scores
    FOR UPDATE
    USING (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text))
    WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));

DROP POLICY IF EXISTS "athlete_indicator_scores_delete_rbac" ON public.athlete_indicator_scores;
CREATE POLICY "athlete_indicator_scores_delete_rbac"
    ON public.athlete_indicator_scores
    FOR DELETE
    USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));

-- =========================================================================
-- 5. SEED MASTER KATALOG TES COMBINE SEPAKBOLA (TEKNIK, FISIK, TAKTIK, MENTAL)
-- =========================================================================
INSERT INTO public.assessment_tests_catalog
    (id, sport_type, category, indicator_key, test_name, measurement_type, unit, description, min_tier)
VALUES
    -- TEKNIK (Battery Tests)
    ('11111111-1111-4111-8111-000000000001', 'football', 'Teknik', 'finishing', 'Finishing Target Test', 'ACCURACY', 'gol/percobaan', 'Tembakan terarah ke sudut gawang dari tepi kotak penalti (10 percobaan standar).', 1),
    ('11111111-1111-4111-8111-000000000002', 'football', 'Teknik', 'passing_pendek', 'Short Passing Gate Accuracy', 'ACCURACY', 'tepat/percobaan', 'Umpan mendatar melewati gerbang cone selebar 1.5m pada jarak 10 meter.', 1),
    ('11111111-1111-4111-8111-000000000003', 'football', 'Teknik', 'dribbling', 'Slalom Cone Dribbling', 'TIME', 'detik', 'Menggiring bola melewati 6 cone berjarak 2m secepat mungkin; penalti +0.25d per cone jatuh.', 1),
    ('11111111-1111-4111-8111-000000000004', 'football', 'Teknik', 'kontrol_bola', 'Wall First-Touch & Control (30s)', 'REPS', 'repetisi', 'Jumlah pantulan umpan & kontrol bersih ke dinding dalam durasi 30 detik.', 1),
    ('11111111-1111-4111-8111-000000000005', 'football', 'Teknik', 'passing_jauh', 'Long Pass Target Zone', 'ACCURACY', 'tepat/percobaan', 'Umpan lambung terukur ke zona target 5x5m pada jarak 25–35 meter.', 2),
    ('11111111-1111-4111-8111-000000000006', 'football', 'Teknik', 'crossing', 'Flank Crossing Accuracy', 'ACCURACY', 'tepat/percobaan', 'Umpan silang dari sisi sayap menuju zona penalti (tiang dekat/jauh).', 3),

    -- FISIK (Battery Tests)
    ('11111111-1111-4111-8111-000000000101', 'football', 'Fisik', 'akselerasi', '10m Sprint Acceleration', 'TIME', 'detik', 'Catatan waktu lari ledak jarak 10 meter dari posisi start diam (best of 2 trials).', 1),
    ('11111111-1111-4111-8111-000000000102', 'football', 'Fisik', 'kelincahan', 'T-Test / Illinois Agility Run', 'TIME', 'detik', 'Tes kelincahan perubahan arah lari maju, geser samping, dan mundur.', 1),
    ('11111111-1111-4111-8111-000000000103', 'football', 'Fisik', 'kecepatan_maksimal', '30m Top Speed Sprint', 'TIME', 'detik', 'Sprint jarak 30 meter mengukur kecepatan maksimal atlet di ruang terbuka.', 2),
    ('11111111-1111-4111-8111-000000000104', 'football', 'Fisik', 'daya_ledak', '30s Plyometric Jump Reps', 'REPS', 'repetisi', 'Jumlah lompatan eksplosif maksimal yang diselesaikan dengan teknik mendarat stabil dalam 30 detik.', 3),
    ('11111111-1111-4111-8111-000000000105', 'football', 'Fisik', 'daya_tahan', '20m Shuttle Endurance Run', 'REPS', 'shuttle', 'Total shuttle lari bolak-balik 20 meter sebelum atlet gagal mencapai garis tepat waktu.', 3),

    -- TAKTIK (Rubric 1-5)
    ('11111111-1111-4111-8111-000000000201', 'football', 'Taktik', 'posisi_bertahan', 'Rubrik Posisi Bertahan', 'RUBRIC', 'level 1-5', 'Penilaian observasi menjaga jarak, menutup jalur umpan, dan posisi saat tanpa bola.', 1),
    ('11111111-1111-4111-8111-000000000202', 'football', 'Taktik', 'posisi_menyerang', 'Rubrik Posisi Menyerang', 'RUBRIC', 'level 1-5', 'Penilaian observasi mencari ruang bebas dan sudut dukungan saat tim menguasai bola.', 1),
    ('11111111-1111-4111-8111-000000000203', 'football', 'Taktik', 'membuka_ruang', 'Rubrik Membuka Ruang', 'RUBRIC', 'level 1-5', 'Pergerakan tanpa bola untuk menarik lawan dan menciptakan jalur progresi.', 1),
    ('11111111-1111-4111-8111-000000000204', 'football', 'Taktik', 'pengambilan_keputusan', 'Rubrik Pengambilan Keputusan', 'RUBRIC', 'level 1-5', 'Ketepatan memilih opsi umpan, dribel, atau tembakan di situasi permainan nyata.', 2),
    ('11111111-1111-4111-8111-000000000205', 'football', 'Taktik', 'pressing', 'Rubrik Pressing & Transisi', 'RUBRIC', 'level 1-5', 'Kecepatan reaksi menekan lawan saat kehilangan bola dan menjaga kekompakan blok.', 3),

    -- MENTAL (Rubric 1-5)
    ('11111111-1111-4111-8111-000000000301', 'football', 'Mental', 'fokus', 'Rubrik Fokus & Konsentrasi', 'RUBRIC', 'level 1-5', 'Konsistensi perhatian atlet selama sesi latihan dan situasi transisi permainan.', 1),
    ('11111111-1111-4111-8111-000000000302', 'football', 'Mental', 'percaya_diri', 'Rubrik Kepercayaan Diri', 'RUBRIC', 'level 1-5', 'Keberanian menguasai bola, mencoba aksi 1v1, dan tidak takut melakukan kesalahan.', 1),
    ('11111111-1111-4111-8111-000000000303', 'football', 'Mental', 'daya_juang', 'Rubrik Daya Juang & Resiliensi', 'RUBRIC', 'level 1-5', 'Ketangguhan bangkit setelah melakukan kesalahan atau saat tim dalam posisi tertinggal.', 2),
    ('11111111-1111-4111-8111-000000000304', 'football', 'Mental', 'tahan_tekanan', 'Rubrik Ketahanan Tekanan', 'RUBRIC', 'level 1-5', 'Ketenangan mengeksekusi keputusan saat ditekan ketat lawan di momen krusial.', 3),

    -- KOMUNIKASI (Rubric 1-5)
    ('11111111-1111-4111-8111-000000000401', 'football', 'Komunikasi', 'komunikasi_verbal', 'Rubrik Komunikasi Verbal', 'RUBRIC', 'level 1-5', 'Kejelasan panggilan vokal saat meminta bola, memberi instruksi marking, atau peringatan.', 1),
    ('11111111-1111-4111-8111-000000000402', 'football', 'Komunikasi', 'dukungan_rekan', 'Rubrik Dukungan Rekan', 'RUBRIC', 'level 1-5', 'Bahasa tubuh positif, apresiasi, dan dukungan konstruktif kepada rekan satu tim.', 1),
    ('11111111-1111-4111-8111-000000000403', 'football', 'Komunikasi', 'kepemimpinan', 'Rubrik Kepemimpinan Lapangan', 'RUBRIC', 'level 1-5', 'Inisiatif mengatur koordinasi lini, memberi arahan organisasi, dan menjadi teladan tim.', 3)
ON CONFLICT (id) DO UPDATE SET
    sport_type = EXCLUDED.sport_type,
    category = EXCLUDED.category,
    indicator_key = EXCLUDED.indicator_key,
    test_name = EXCLUDED.test_name,
    measurement_type = EXCLUDED.measurement_type,
    unit = EXCLUDED.unit,
    description = EXCLUDED.description,
    min_tier = EXCLUDED.min_tier;
