-- =========================================================================
-- CHUVATOR PARENT PORTAL V2 — PHASE 1E BOOKINGS RLS FOR PARENTS
-- Target: Supabase PostgreSQL
-- Purpose: Mengizinkan orang tua membaca jadwal lapangan (bookings) khusus kelas anaknya
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS "bookings_parent_select" ON public.bookings;

CREATE POLICY "bookings_parent_select" ON public.bookings
FOR SELECT USING (
    class_id::text IN (
        SELECT class_id::text FROM public.students 
        WHERE id::text IN (
            SELECT psl.student_id::text FROM public.parent_student_links psl
            JOIN public.parent_accounts pa ON psl.parent_id = pa.id
            WHERE (pa.auth_uid = auth.uid()::text OR LOWER(pa.email) = LOWER(auth.jwt()->>'email'))
              AND psl.status = 'active'
        )
    )
);

COMMIT;
