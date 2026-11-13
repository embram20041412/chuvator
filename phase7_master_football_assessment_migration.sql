-- =========================================================================
-- CHUVATOR (CHUA SPORT CORE) — MASTER TEST LIBRARY & ASSESSMENT ENGINE
-- Target: Supabase PostgreSQL (Migration & RLS Security)
-- Tabel:
--   1. public.master_football_tests_catalog
--   2. public.athlete_test_sessions
--   3. public.athlete_indicator_scores
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABEL: public.master_football_tests_catalog
-- Menyimpan kamus master tes objektif (TIME, ACCURACY, REPS, DISTANCE)
-- dan observasi terstruktur (RUBRIC 1-5) untuk seluruh pilar sepakbola.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.master_football_tests_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_code TEXT NOT NULL UNIQUE,
    test_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN ('Fisik', 'Teknik', 'Taktik', 'Mental', 'Komunikasi', 'Spesifik Posisi', 'Perkembangan')
    ),
    indicator_key TEXT NOT NULL,
    position_code TEXT DEFAULT NULL,
    measurement_type TEXT NOT NULL CHECK (
        measurement_type IN ('TIME', 'ACCURACY', 'REPS', 'RUBRIC', 'DISTANCE')
    ),
    unit TEXT NOT NULL,
    is_lower_better BOOLEAN NOT NULL DEFAULT false,
    min_tier INTEGER NOT NULL DEFAULT 1 CHECK (min_tier BETWEEN 1 AND 4),
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_football_tests_cat_tier
    ON public.master_football_tests_catalog (category, min_tier);

CREATE INDEX IF NOT EXISTS idx_master_football_tests_indicator
    ON public.master_football_tests_catalog (indicator_key);

-- =========================================================================
-- 2. TABEL: public.athlete_test_sessions
-- Menyimpan sesi hasil tes mentah atlet dengan konversi instan 1-100
-- (TANPA PENDING_CALIBRATION).
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.athlete_test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    athlete_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    evaluator_id UUID DEFAULT NULL,
    test_code TEXT NOT NULL REFERENCES public.master_football_tests_catalog(test_code) ON DELETE RESTRICT,
    raw_value_1 NUMERIC(10, 2) NOT NULL,
    raw_value_2 NUMERIC(10, 2) DEFAULT NULL,
    errors_count INTEGER NOT NULL DEFAULT 0 CHECK (errors_count >= 0),
    calculated_score INTEGER NOT NULL CHECK (calculated_score BETWEEN 1 AND 100),
    testing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_test_sessions_lookup
    ON public.athlete_test_sessions (tenant_id, athlete_id, testing_date DESC);

CREATE INDEX IF NOT EXISTS idx_athlete_test_sessions_test_code
    ON public.athlete_test_sessions (test_code);

-- =========================================================================
-- 3. TABEL: public.athlete_indicator_scores
-- Menyimpan skor akhir agregat (1-100) per indikator yang dibaca langsung
-- oleh Grafik Polar Area & Rapor Atlet.
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

CREATE OR REPLACE FUNCTION public.trg_touch_athlete_indicator_scores_updated_at()
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
    EXECUTE FUNCTION public.trg_touch_athlete_indicator_scores_updated_at();

-- =========================================================================
-- 4. KEBIJAKAN ROW-LEVEL SECURITY (RLS) MULTI-TENANT ISOLATION
-- =========================================================================
ALTER TABLE public.master_football_tests_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_football_tests_catalog FORCE ROW LEVEL SECURITY;

ALTER TABLE public.athlete_test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.athlete_indicator_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_indicator_scores FORCE ROW LEVEL SECURITY;

-- Katalog Master Tes: Dapat dibaca semua user terautentikasi, dimodifikasi oleh Superadmin
DROP POLICY IF EXISTS "master_football_tests_catalog_select_policy" ON public.master_football_tests_catalog;
CREATE POLICY "master_football_tests_catalog_select_policy"
    ON public.master_football_tests_catalog
    FOR SELECT
    USING (auth.uid() IS NOT NULL OR public.is_superadmin());

DROP POLICY IF EXISTS "master_football_tests_catalog_write_policy" ON public.master_football_tests_catalog;
CREATE POLICY "master_football_tests_catalog_write_policy"
    ON public.master_football_tests_catalog
    FOR ALL
    USING (public.is_superadmin())
    WITH CHECK (public.is_superadmin());

-- Sesi Tes Atlet: Isolasi ketat berdasarkan tenant_id
DROP POLICY IF EXISTS "athlete_test_sessions_select_policy" ON public.athlete_test_sessions;
CREATE POLICY "athlete_test_sessions_select_policy"
    ON public.athlete_test_sessions
    FOR SELECT
    USING (public.is_superadmin() OR public.user_has_tenant_access(tenant_id::text));

DROP POLICY IF EXISTS "athlete_test_sessions_insert_policy" ON public.athlete_test_sessions;
CREATE POLICY "athlete_test_sessions_insert_policy"
    ON public.athlete_test_sessions
    FOR INSERT
    WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));

DROP POLICY IF EXISTS "athlete_test_sessions_update_policy" ON public.athlete_test_sessions;
CREATE POLICY "athlete_test_sessions_update_policy"
    ON public.athlete_test_sessions
    FOR UPDATE
    USING (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text))
    WITH CHECK (public.is_superadmin() OR public.user_can_manage_academy(tenant_id::text));

DROP POLICY IF EXISTS "athlete_test_sessions_delete_policy" ON public.athlete_test_sessions;
CREATE POLICY "athlete_test_sessions_delete_policy"
    ON public.athlete_test_sessions
    FOR DELETE
    USING (public.is_superadmin() OR public.user_is_tenant_admin_or_owner(tenant_id::text));

-- Skor Indikator Atlet: Isolasi ketat berdasarkan tenant_id
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
-- 5. SEED DATA MASTER TEST LIBRARY SEPAKBOLA (3 PILAR UTAMA)
-- =========================================================================
INSERT INTO public.master_football_tests_catalog
    (test_code, test_name, category, indicator_key, position_code, measurement_type, unit, is_lower_better, min_tier, description)
VALUES
    -- PILAR 1: PHYSICAL ASSESSMENT (Fisik Objektif)
    ('PHY01', 'Sprint 10m Acceleration', 'Fisik', 'akselerasi', NULL, 'TIME', 'detik', true, 1, 'Tes ledakan lari 0–10 meter dari posisi start berdiri (diambil waktu tercepat dari 2 percobaan).'),
    ('PHY02', 'Flying Sprint 30m Top Speed', 'Fisik', 'kecepatan_maksimal', NULL, 'TIME', 'detik', true, 2, 'Tes kecepatan maksimal jarak 30 meter penuh dari posisi diam.'),
    ('PHY03', 'Illinois Agility Test', 'Fisik', 'kelincahan', NULL, 'TIME', 'detik', true, 1, 'Tes kelincahan slalom & putaran 180 derajat (+0.25d penalti per cone tersenggol).'),
    ('PHY04', '505 Change of Direction Test', 'Fisik', 'perubahan_arah', NULL, 'TIME', 'detik', true, 2, 'Tes deselerasi tajam dan akselerasi balik 180 derajat pada garis 5 meter.'),
    ('PHY05', 'Visual Signal Reaction Sprint (5m)', 'Fisik', 'reaksi', NULL, 'TIME', 'detik', true, 2, 'Waktu reaksi lari 5 meter merespons sinyal visual pelatih.'),
    ('PHY06', 'Yo-Yo Intermittent Recovery Distance', 'Fisik', 'daya_tahan', NULL, 'DISTANCE', 'meter', false, 3, 'Total jarak kumulatif (meter) yang ditempuh pada tes Yo-Yo Intermittent Recovery Level 1.'),
    ('PHY07', 'Standing Broad Jump', 'Fisik', 'daya_ledak', NULL, 'DISTANCE', 'cm', false, 3, 'Jarak lompatan horizontal dua kaki dari posisi berdiri (cm) mengukur daya ledak tungkai.'),
    ('PHY08', 'Countermovement Vertical Jump', 'Fisik', 'lompatan', NULL, 'DISTANCE', 'cm', false, 2, 'Tinggi lompatan vertikal maksimal (cm) dari posisi berdiri.'),
    ('PHY09', 'Single-Leg Balance Hold', 'Fisik', 'keseimbangan', NULL, 'TIME', 'detik', false, 1, 'Durasi mempertahankan keseimbangan satu kaki stabil dengan mata fokus (detik).'),
    ('PHY10', '60s Push-Up & Core Stability Reps', 'Fisik', 'kekuatan_tubuh', NULL, 'REPS', 'repetisi', false, 3, 'Jumlah repetisi bersih push-up/plank dinamis selama 60 detik.'),
    ('PHY11', '1-Minute Heart Rate Recovery Drop', 'Fisik', 'pemulihan', NULL, 'REPS', 'bpm drop', false, 4, 'Penurunan detak jantung (BPM) dalam 60 detik pertama pasca beban maksimal.'),

    -- PILAR 2A: TECHNICAL ASSESSMENT (Keterampilan Objektif)
    ('TEC01', 'Wall First-Touch & Ball Control (30s)', 'Teknik', 'kontrol_bola', NULL, 'REPS', 'sentuhan', false, 1, 'Jumlah kontrol & pantulan bola bersih ke dinding dalam waktu 30 detik.'),
    ('TEC02', 'Directional First-Touch Box Trap', 'Teknik', 'sentuhan_pertama', NULL, 'ACCURACY', 'sukses/percobaan', false, 1, 'Persentase sentuhan pertama terarah keluar dari zona tekan ke ruang target (10 percobaan).'),
    ('TEC03', 'Short Passing Gate Accuracy (10m)', 'Teknik', 'passing_pendek', NULL, 'ACCURACY', 'tepat/percobaan', false, 1, 'Umpan mendatar melewati gerbang cone 1.5m pada jarak 10 meter (12 percobaan).'),
    ('TEC04', 'Long Lofted Pass Target Zone (30m)', 'Teknik', 'passing_jauh', NULL, 'ACCURACY', 'tepat/percobaan', false, 2, 'Umpan lambung jarak 30 meter mendarat di dalam grid target 5x5m (10 percobaan).'),
    ('TEC05', 'Figure-8 Slalom Dribbling Time', 'Teknik', 'dribbling', NULL, 'TIME', 'detik', true, 1, 'Waktu menggiring bola melewati lintasan 8 cone (+0.25d penalti per cone jatuh).'),
    ('TEC06', 'High-Speed Dribble Gate Retention', 'Teknik', 'dribbling', NULL, 'ACCURACY', 'lolos/percobaan', false, 2, 'Keberhasilan melewati gerbang kontrol saat dribel kecepatan tinggi (10 percobaan).'),
    ('TEC07', 'Finishing Corner Target Accuracy', 'Teknik', 'finishing', NULL, 'ACCURACY', 'gol/percobaan', false, 1, 'Tembakan terarah ke sudut atas/bawah gawang dari batas kotak penalti (10 percobaan).'),
    ('TEC08', 'One-Touch Composure Finishing', 'Teknik', 'finishing', NULL, 'ACCURACY', 'gol/percobaan', false, 2, 'Penyelesaian satu sentuhan dari umpan tarik mendatar di dalam kotak penalti (10 percobaan).'),
    ('TEC09', 'In-Swing & Out-Swing Crossing Accuracy', 'Teknik', 'crossing', NULL, 'ACCURACY', 'tepat/percobaan', false, 3, 'Umpan silang dari koridor sayap menuju zona target tiang dekat/jauh (10 percobaan).'),
    ('TEC10', '1v1 Defensive Duels & Clean Tackle', 'Teknik', 'tackling', NULL, 'ACCURACY', 'menang/duel', false, 2, 'Persentase keberhasilan merebut bola atau menghentikan lawan di kanal 1v1 (10 duel).'),
    ('TEC11', 'Weak-Foot Passing & Shooting Precision', 'Teknik', 'kaki_lemah', NULL, 'ACCURACY', 'tepat/percobaan', false, 2, 'Ketepatan umpan dan tembakan menggunakan kaki non-dominan ke sasaran (10 percobaan).'),
    ('TEC12', 'Directional Heading Target Test', 'Teknik', 'heading', NULL, 'ACCURACY', 'tepat/percobaan', false, 3, 'Ketepatan sundulan terarah ke gawang/target dari umpan lambung (10 percobaan).'),

    -- PILAR 2B: TACTICAL ASSESSMENT (Simulasi Permainan & Rubrik Taktik)
    ('TAC01', 'Defensive Positioning & Zonal Marking', 'Taktik', 'posisi_bertahan', NULL, 'RUBRIC', 'level 1-5', false, 1, 'Observasi orientasi tubuh, jarak kawalan, dan penutupan jalur umpan saat bertahan.'),
    ('TAC02', 'Offensive Support & Triangle Creation', 'Taktik', 'posisi_menyerang', NULL, 'RUBRIC', 'level 1-5', false, 1, 'Observasi pergerakan membuka sudut dukungan dan menciptakan segitiga umpan.'),
    ('TAC03', 'Off-Ball Space Creation', 'Taktik', 'membuka_ruang', NULL, 'RUBRIC', 'level 1-5', false, 1, 'Kemampuan menarik bek lawan dan membuka ruang progresi bagi rekan setim.'),
    ('TAC04', 'Game Scanning & Anticipation Rate', 'Taktik', 'membaca_permainan', NULL, 'RUBRIC', 'level 1-5', false, 2, 'Frekuensi menoleh (scanning) sebelum menerima bola dan antisipasi bola kedua.'),
    ('TAC05', 'Rondo 4v2 Decision Making Success', 'Taktik', 'pengambilan_keputusan', NULL, 'ACCURACY', 'tepat/keputusan', false, 2, 'Persentase keputusan umpan/kontrol progresif yang tepat di bawah tekanan rondo (15 aksi).'),
    ('TAC06', 'Coordinated Pressing & Counter-Press', 'Taktik', 'pressing', NULL, 'RUBRIC', 'level 1-5', false, 3, 'Kecepatan reaksi menekan dalam 3 detik pasca kehilangan bola dan menutup opsi lawan.'),
    ('TAC07', 'Defensive-to-Attacking Transition Speed', 'Taktik', 'transisi_menyerang', NULL, 'RUBRIC', 'level 1-5', false, 3, 'Kecepatan mengubah struktur dari bertahan ke serangan balik vertikal.'),

    -- PILAR 3A: MENTAL & KOMUNIKASI (Anchored Rubric 1-5 -> 35..95)
    ('MEN01', 'Match Focus & Tactical Concentration', 'Mental', 'fokus', NULL, 'RUBRIC', 'level 1-5', false, 1, 'Konsistensi fokus atlet sepanjang sesi latihan, instruksi, dan situasi bola mati.'),
    ('MEN02', 'On-Ball Courage & Self-Confidence', 'Mental', 'percaya_diri', NULL, 'RUBRIC', 'level 1-5', false, 1, 'Keberanian meminta bola di ruang sempit dan mengambil inisiatif 1v1.'),
    ('MEN03', 'Fighting Spirit & Error Recovery', 'Mental', 'daya_juang', NULL, 'RUBRIC', 'level 1-5', false, 2, 'Resiliensi bangkit setelah melakukan kesalahan dan determinasi mengejar bola.'),
    ('MEN04', 'Composure Under High Pressing', 'Mental', 'tahan_tekanan', NULL, 'RUBRIC', 'level 1-5', false, 3, 'Ketenangan menjaga akurasi teknik saat di-pressing ketat pada momen krusial.'),
    ('COM01', 'Verbal Pitch Communication', 'Komunikasi', 'komunikasi_verbal', NULL, 'RUBRIC', 'level 1-5', false, 1, 'Kejelasan panggilan vokal ("man-on", "turn", "time") dan instruksi penempatan posisi.'),
    ('COM02', 'Teammate Support & Body Language', 'Komunikasi', 'dukungan_rekan', NULL, 'RUBRIC', 'level 1-5', false, 1, 'Apresiasi positif, dorongan moral, dan bahasa tubuh konstruktif terhadap rekan.'),
    ('COM03', 'Tactical Unit Leadership', 'Komunikasi', 'kepemimpinan', NULL, 'RUBRIC', 'level 1-5', false, 3, 'Inisiatif mengorganisasi garis pertahanan/serangan dan menjaga disiplin kolektif.'),

    -- PILAR 3B: POSITION-SPECIFIC BATTERY (GK, CB, FB/WB, DM/CM/AM, Winger, ST)
    ('POS_GK01', 'GK Reflex Shot-Stopping Drill', 'Spesifik Posisi', 'refleks', 'GK', 'ACCURACY', 'tepis/tembakan', false, 2, 'Keberhasilan kiper menepis/menangkap tembakan jarak dekat beruntun (10 tembakan).'),
    ('POS_GK02', 'GK Side-Volley & Throw Distribution', 'Spesifik Posisi', 'distribusi_kaki', 'GK', 'ACCURACY', 'tepat/percobaan', false, 2, 'Ketepatan distribusi bola kiper ke zona target bek sayap/gelandang (10 percobaan).'),
    ('POS_CB01', 'CB Aerial Duel & Recovery Clearance', 'Spesifik Posisi', 'duel_bertahan', 'CB', 'ACCURACY', 'menang/duel', false, 2, 'Kemenangan duel udara & sapuan bersih ke zona aman dari umpan silang (10 duel).'),
    ('POS_FB01', 'Fullback / Wingback Overlap Cross Drill', 'Spesifik Posisi', 'overlap', 'LB/RB', 'ACCURACY', 'tepat/percobaan', false, 2, 'Ketepatan umpan silang setelah sprint overlap 25 meter di koridor sayap (10 percobaan).'),
    ('POS_CM01', 'Midfield Line-Breaking Through Pass', 'Spesifik Posisi', 'distribusi_bola', 'CM', 'ACCURACY', 'tembus/umpan', false, 2, 'Keberhasilan umpan progresif membelah garis pertahanan lawan ke zona serang (10 percobaan).'),
    ('POS_WNG01', 'Winger Cut-Inside & Far-Post Shot', 'Spesifik Posisi', 'cut_inside', 'WFR/WFL', 'ACCURACY', 'gol/percobaan', false, 3, 'Akselerasi dari sayap, cut-inside melewati cone, dan tembakan ke tiang jauh (10 percobaan).'),
    ('POS_ST01', 'Striker Box Movement & First-Time Finish', 'Spesifik Posisi', 'gerak_di_kotak_penalti', 'ST', 'ACCURACY', 'gol/percobaan', false, 2, 'Pergerakan lepas dari kawalan bek di kotak penalti diikuti penyelesaian satu sentuhan (10 percobaan).')
ON CONFLICT (test_code) DO UPDATE SET
    test_name = EXCLUDED.test_name,
    category = EXCLUDED.category,
    indicator_key = EXCLUDED.indicator_key,
    position_code = EXCLUDED.position_code,
    measurement_type = EXCLUDED.measurement_type,
    unit = EXCLUDED.unit,
    is_lower_better = EXCLUDED.is_lower_better,
    min_tier = EXCLUDED.min_tier,
    description = EXCLUDED.description;
