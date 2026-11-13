-- =============================================================================
-- CHUVATOR — TASK 03.5.2: NON-DESTRUCTIVE ROLLBACK SCRIPT
-- 03_task03_5_rollback.sql
-- =============================================================================
-- PRINSIP:
--   - Mencabut constraint kompatibilitas Task 03.5 (`chk_athlete_test_results_measurement_method_compatibility`)
--     dan memulihkan constraint baseline Task 03.4 (`chk_athlete_test_results_spr10m_method`)
--     apabila rollback diperlukan.
--   - TIDAK melakukan DROP TABLE, TRUNCATE, atau penghapusan data hasil tes.
--   - TIDAK mencabut trigger `trg_validate_and_protect_athlete_test_results`,
--     fungsi keamanan produksi, ataupun RLS policies.
-- =============================================================================

BEGIN;

ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility;

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

COMMIT;
