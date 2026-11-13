-- =============================================================================
-- CHUVATOR — TASK 03.5: NON-DESTRUCTIVE ROLLBACK SCRIPT
-- 03_task03_5_rollback.sql
-- =============================================================================
-- PRINSIP:
--   - Hanya mencabut constraint kompatibilitas Task 03.5 jika diperlukan.
--   - TIDAK melakukan DROP TABLE, TRUNCATE, atau penghapusan data hasil tes.
-- =============================================================================

BEGIN;

ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility;

COMMIT;
