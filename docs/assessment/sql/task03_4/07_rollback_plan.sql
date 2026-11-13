-- =============================================================================
-- CHUVATOR — TASK 03.4: SUPABASE DATABASE MIGRATION READINESS
-- 07_rollback_plan.sql (SAFE, NON-DESTRUCTIVE ROLLBACK PROCEDURE)
-- =============================================================================
-- PERINGATAN PENTING (PRODUCTION SAFETY):
--   1. Script ini secara default HANYA mencabut kebijakan RLS baru, trigger,
--      constraint tambahan, dan indeks Task 03.4 TANPA MENGHAPUS tabel
--      `public.athlete_test_results` maupun data pengukuran mentah atlet.
--   2. Penghapusan tabel (`DROP TABLE`) DILARANG dijalankan secara otomatis pada
--      database produksi karena akan menghilangkan fakta pengukuran atlet secara permanen.
--   3. Jika penghapusan total tetap diperlukan pada lingkungan staging kosong,
--      administrator harus mengambil pg_dump terlebih dahulu dan melakukannya
--      secara sadar dengan pemeriksaan jumlah baris = 0.
-- =============================================================================

BEGIN;

-- 1. Cabut RLS Policies pada public.athlete_test_results (jika perlu menonaktifkan akses fitur)
DROP POLICY IF EXISTS athlete_test_results_select_policy ON public.athlete_test_results;
DROP POLICY IF EXISTS athlete_test_results_insert_policy ON public.athlete_test_results;
DROP POLICY IF EXISTS athlete_test_results_update_policy ON public.athlete_test_results;
DROP POLICY IF EXISTS athlete_test_results_delete_policy ON public.athlete_test_results;

-- Pastikan akses anon/authenticated juga dicabut jika policy dicabut (fail-closed)
REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon, authenticated;

-- 2. Hapus Trigger & Fungsi Keamanan Task 03.4
DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;
DROP TRIGGER IF EXISTS trg_protect_athlete_test_results_columns ON public.athlete_test_results;

DROP FUNCTION IF EXISTS public.validate_and_protect_athlete_test_results();
DROP FUNCTION IF EXISTS public.coach_can_manage_student(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.get_strict_tenant_member_role(TEXT);

-- 3. Hapus Constraints Tambahan Task 03.4 / 03.5 (Data tetap aman)
ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_calibration_consistency;
ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_measurement_method_compatibility;
ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_spr10m_method;
ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_test_period_format;
ALTER TABLE public.athlete_test_results
    DROP CONSTRAINT IF EXISTS chk_athlete_test_results_age_years_range;

-- 4. Hapus Indeks Tambahan Task 03.4 (Opsional — tabel dan kolom data tetap dipertahankan)
DROP INDEX IF EXISTS public.idx_athlete_test_results_calibration_status;
DROP INDEX IF EXISTS public.idx_athlete_test_results_norms_recap;
DROP INDEX IF EXISTS public.idx_athlete_test_results_tenant_test_date;

-- 5. Pengaman Anti-Penghapusan Data Produksi:
--    Secara eksplisit TIDAK menjalankan DROP TABLE public.athlete_test_results.
--    Jika berada di staging kosong dan ingin menghapus tabel secara manual,
--    verifikasi terlebih dahulu: SELECT COUNT(*) FROM public.athlete_test_results;
DO $$
DECLARE
    v_row_count BIGINT := 0;
BEGIN
    IF to_regclass('public.athlete_test_results') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_row_count FROM public.athlete_test_results;
        RAISE NOTICE 'Rollback aman selesai: kebijakan & trigger dicabut (fail-closed), % baris data pada public.athlete_test_results TETAP DIPERTAHANKAN.', v_row_count;
    END IF;
END $$;

COMMIT;
