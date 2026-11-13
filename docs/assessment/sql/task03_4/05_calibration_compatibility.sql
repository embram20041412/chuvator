-- =============================================================================
-- CHUVATOR — TASK 03.4.3: SUPABASE DATABASE MIGRATION READINESS (REMEDIATED)
-- 05_calibration_compatibility.sql (CALIBRATION & SCORE ENGINE COMPATIBILITY)
-- =============================================================================
-- PRINSIP TASK 03.2 & 03.3:
--   1. Transaksional (BEGIN ... COMMIT) dan idempoten.
--   2. Data mentah (`final_raw_value`, `trials`) adalah fakta utama dan TIDAK pernah
--      diubah oleh status kalibrasi maupun konversi skor.
--   3. Selama norma performa resmi belum tersedia, hasil tes berstatus
--      `PENDING_CALIBRATION` (atau `READY_FOR_CALIBRATION` / `NEEDS_FURTHER_DESIGN`)
--      dengan `converted_score IS NULL` — DILARANG menyimpan skor fiktif.
--   4. Saat parameter kalibrasi tersedia di masa depan, baris dapat memiliki
--      `calibration_status = 'CALIBRATED'` dan `converted_score BETWEEN 1 AND 100`.
--   5. Tidak ada constraint UNIQUE pada `(tenant_id, student_id, test_id, test_date)`
--      agar pengukuran longitudinal multi-tanggal maupun perbandingan metode
--      (`STOPWATCH_MANUAL` vs `SMARTPHONE_VIDEO`) tidak saling menimpa.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_invalid_calibration_rows INTEGER := 0;
BEGIN
    SELECT COUNT(*)
    INTO v_invalid_calibration_rows
    FROM public.athlete_test_results
    WHERE NOT (
        (
            calibration_status = 'CALIBRATED'
            AND converted_score IS NOT NULL
            AND converted_score >= 1
            AND converted_score <= 100
        )
        OR (
            calibration_status IN ('PENDING_CALIBRATION', 'READY_FOR_CALIBRATION', 'NEEDS_FURTHER_DESIGN')
            AND converted_score IS NULL
        )
    );

    IF v_invalid_calibration_rows > 0 THEN
        RAISE EXCEPTION 'MIGRASI KALIBRASI DIHENTIKAN: Ditemukan % baris pada public.athlete_test_results dengan kombinasi calibration_status dan converted_score yang tidak konsisten.',
            v_invalid_calibration_rows
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_athlete_test_results_calibration_consistency'
          AND conrelid = 'public.athlete_test_results'::regclass
    ) THEN
        ALTER TABLE public.athlete_test_results
            ADD CONSTRAINT chk_athlete_test_results_calibration_consistency
            CHECK (
                (
                    calibration_status = 'CALIBRATED'
                    AND converted_score IS NOT NULL
                    AND converted_score >= 1
                    AND converted_score <= 100
                )
                OR (
                    calibration_status IN ('PENDING_CALIBRATION', 'READY_FOR_CALIBRATION', 'NEEDS_FURTHER_DESIGN')
                    AND converted_score IS NULL
                )
            );
    END IF;
END $$;

COMMIT;
