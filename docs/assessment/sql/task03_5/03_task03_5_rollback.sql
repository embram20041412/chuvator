-- =============================================================================
-- CHUVATOR — TASK 03.5.3: NON-DESTRUCTIVE ROLLBACK SCRIPT (FAIL-CLOSED)
-- 03_task03_5_rollback.sql
-- =============================================================================
-- STATUS KEAMANAN ROLLBACK: BELUM AMAN / BELUM LENGKAP SECARA OTOMATIS
-- ALASAN FAKTUAL:
--   Definisi fungsi trigger baseline Task 03.4 (`public.validate_and_protect_athlete_test_results()`)
--   sebelum Task 03.5 TIDAK tersedia sebagai snapshot terpisah di repository
--   (`docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql` dan
--   `00_master_task03_4_assessment_battery_migration.sql` telah dimodifikasi in-place
--   saat Task 03.5, dan workspace ini tidak memiliki riwayat `.git`).
--   Skrip ini secara sadar TIDAK membuat ulang fungsi baseline berdasarkan perkiraan.
--
-- PROSEDUR WAJIB SEBELUM MIGRASI & SEBELUM ROLLBACK:
--   1. Sebelum menjalankan `01_task03_5_measurement_method_standardization.sql`,
--      Administrator WAJIB mengambil snapshot verbatim definisi fungsi baseline
--      dari Supabase Production:
--        SELECT
--            pg_get_functiondef('public.validate_and_protect_athlete_test_results()'::regprocedure) AS baseline_def,
--            md5(pg_get_functiondef('public.validate_and_protect_athlete_test_results()'::regprocedure)) AS baseline_md5;
--   2. Jika rollback diperlukan, tempelkan hasil `CREATE OR REPLACE FUNCTION ...`
--      verbatim dari snapshot tersebut pada bagian [B] di bawah, lalu isi nilai
--      `v_expected_baseline_md5` dengan `baseline_md5` hasil tangkapan Production.
--
-- JAMINAN NON-DESTRUKTIF:
--   - TIDAK melakukan DROP TABLE, TRUNCATE, atau DELETE data hasil tes maupun
--     5 record Production (13 Nov 2026).
--   - TIDAK menghapus RLS policies pada `public.athlete_test_results`.
--   - TIDAK mengubah fungsi keamanan tenant lain (`get_strict_tenant_member_role`,
--     `athlete_belongs_to_tenant`, `coach_can_manage_student`).
-- =============================================================================

BEGIN;

-- [A] Fail-Closed Guard: Cegah eksekusi rollback parsial sebelum snapshot baseline Production diisi
DO $$
DECLARE
    v_expected_baseline_md5 TEXT := 'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5';
BEGIN
    IF v_expected_baseline_md5 = 'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5' THEN
        RAISE EXCEPTION 'ROLLBACK BELUM AMAN / DIBATALKAN: Definisi fungsi trigger baseline Task 03.4 sebelum Task 03.5 tidak tersedia di repository. Ambil snapshot `pg_get_functiondef(''public.validate_and_protect_athlete_test_results()''::regprocedure)` dan `md5(...)` dari Production sebelum migrasi, tempelkan ke bagian [B], dan isi `v_expected_baseline_md5` sebelum menjalankan rollback.'
            USING ERRCODE = '42883';
    END IF;
END $$;

-- [B] Pemulihan Verbatim Fungsi Trigger Baseline Task 03.4
--     TEMPELKAN `CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results() ...`
--     hasil `pg_get_functiondef(...)` Production sebelum Task 03.5 di bawah baris ini:
--     (DILARANG membuat ulang definisi fungsi berdasarkan perkiraan!)

-- [C] Pemulihan Constraint Baseline Task 03.4 Sebelum Mencabut Constraint Task 03.5
DO $$
BEGIN
    IF to_regclass('public.athlete_test_results') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'chk_athlete_test_results_spr10m_method'
             AND conrelid = 'public.athlete_test_results'::regclass
       ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_spr10m_method
            CHECK (
                test_id <> 'TST-SPR-10M'
                OR measurement_method IS NULL
                OR measurement_method IN ('STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO')
            );
    END IF;
END $$;

ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility;

-- [D] Pemulihan Kondisi Trigger, Owner, & Least-Privilege Grants Sebelum Task 03.5
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;
CREATE TRIGGER trg_validate_and_protect_athlete_test_results
    BEFORE INSERT OR UPDATE ON public.athlete_test_results
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_and_protect_athlete_test_results();

ALTER FUNCTION public.validate_and_protect_athlete_test_results() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;

-- [E] Verifikasi Identitas Definisi Fungsi Hasil Rollback == Baseline Sebelum Task 03.5
DO $$
DECLARE
    v_expected_baseline_md5 TEXT := 'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5';
    v_fn_oid OID;
    v_actual_def TEXT;
    v_actual_md5 TEXT;
    v_owner TEXT;
    v_secdef BOOLEAN;
    v_config TEXT[];
    v_trig_active BOOLEAN;
BEGIN
    v_fn_oid := to_regprocedure('public.validate_and_protect_athlete_test_results()');
    IF v_fn_oid IS NULL THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL: Fungsi public.validate_and_protect_athlete_test_results() tidak ditemukan.';
    END IF;

    v_actual_def := pg_get_functiondef(v_fn_oid);
    v_actual_md5 := md5(v_actual_def);

    IF v_actual_md5 IS DISTINCT FROM v_expected_baseline_md5 THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL (ROLLBACK OTOMATIS): MD5 definisi fungsi hasil rollback (%) tidak identik dengan baseline Production sebelum Task 03.5 (%).',
            v_actual_md5, v_expected_baseline_md5
            USING ERRCODE = '42501';
    END IF;

    SELECT pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
    INTO v_owner, v_secdef, v_config
    FROM pg_proc p
    WHERE p.oid = v_fn_oid;

    IF v_owner IS DISTINCT FROM 'postgres'
       OR v_secdef IS NOT TRUE
       OR NOT ('search_path=public, extensions, pg_temp' = ANY(COALESCE(v_config, ARRAY[]::text[])))
       OR has_function_privilege('public', v_fn_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_fn_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'ROLLBACK GAGAL: Owner/SECURITY DEFINER/search_path/grants fungsi trigger hasil rollback tidak sesuai baseline keamanan.';
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
        RAISE EXCEPTION 'ROLLBACK GAGAL: Trigger trg_validate_and_protect_athlete_test_results tidak aktif pasca-rollback.';
    END IF;
END $$;

COMMIT;
