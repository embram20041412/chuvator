-- ============================================================================
-- CHUVATOR DATABASE MIGRATION & ATOMIC RPC: STUDENT GROWTH TRACKER UPDATE
-- File: phase_growth_tracker_atomic_update.sql
-- ============================================================================
-- Deskripsi:
-- Memastikan pembaruan data antropometri siswa (Tinggi Badan & Berat Badan) 
-- memperbarui kolom skalar (height, weight, height_cm, weight_kg) DAN secara
-- ATOMIK meng-append entri baru ke dalam array JSONB `growth_history`.
--
-- Format Objek entri growth_history:
-- {
--   "date": "YYYY-MM-DD",
--   "height_cm": 170.0,
--   "weight_kg": 65.0,
--   "height": 170.0,
--   "weight": 65.0,
--   "bmi": 22.5,
--   "status": "Proporsional",
--   "notes": "Pengukuran Antropometri",
--   "recordedAt": "ISO TIMESTAMP"
-- }
-- ============================================================================

-- 1. Pastikan kolom height_cm dan weight_kg tersedia pada tabel public.students (jika belum ada)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='height_cm') THEN
        ALTER TABLE public.students ADD COLUMN height_cm NUMERIC(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='weight_kg') THEN
        ALTER TABLE public.students ADD COLUMN weight_kg NUMERIC(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='growth_history') THEN
        ALTER TABLE public.students ADD COLUMN growth_history JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Draf RPC PostgreSQL untuk Pembaruan Atomik Growth History
CREATE OR REPLACE FUNCTION public.portal_update_student_growth(
    p_student_id UUID,
    p_height NUMERIC,
    p_weight NUMERIC,
    p_notes TEXT DEFAULT 'Pengukuran Antropometri',
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_height_cm NUMERIC;
    v_weight_kg NUMERIC;
    v_bmi NUMERIC := NULL;
    v_status TEXT := 'Belum Ada';
    v_height_m NUMERIC;
    v_new_entry JSONB;
    v_existing_history JSONB;
    v_updated_student JSONB;
BEGIN
    v_height_cm := p_height;
    v_weight_kg := p_weight;

    -- Hitung BMI jika data tinggi dan berat valid (> 0)
    IF v_height_cm > 0 AND v_weight_kg > 0 THEN
        v_height_m := v_height_cm / 100.0;
        v_bmi := ROUND((v_weight_kg / (v_height_m * v_height_m))::numeric, 1);
        
        IF v_bmi < 18.5 THEN
            v_status := 'Underweight';
        ELSIF v_bmi <= 24.9 THEN
            v_status := 'Proporsional';
        ELSE
            v_status := 'Overweight';
        END IF;
    END IF;

    -- Buat objek JSON entri baru
    v_new_entry := jsonb_build_object(
        'date', to_char(COALESCE(p_date, CURRENT_DATE), 'YYYY-MM-DD'),
        'height_cm', v_height_cm,
        'weight_kg', v_weight_kg,
        'height', v_height_cm,
        'weight', v_weight_kg,
        'bmi', v_bmi,
        'status', v_status,
        'notes', COALESCE(p_notes, 'Pengukuran Antropometri'),
        'recordedAt', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    -- Lakukan update atomik pada tabel students
    UPDATE public.students
    SET 
        height = v_height_cm,
        height_cm = v_height_cm,
        weight = v_weight_kg,
        weight_kg = v_weight_kg,
        growth_history = COALESCE(growth_history, '[]'::jsonb) || jsonb_build_array(v_new_entry),
        updated_at = NOW()
    WHERE id = p_student_id
    RETURNING row_to_json(students.*)::jsonb INTO v_updated_student;

    IF v_updated_student IS NULL THEN
        RAISE EXCEPTION 'Siswa dengan ID % tidak ditemukan.', p_student_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Data antropometri dan growth_history berhasil diperbarui.',
        'student', v_updated_student,
        'new_entry', v_new_entry
    );
END;
$$;

-- Berikan izin akses RPC ke role authenticated & anon
GRANT EXECUTE ON FUNCTION public.portal_update_student_growth(UUID, NUMERIC, NUMERIC, TEXT, DATE) TO authenticated, anon, service_role;
