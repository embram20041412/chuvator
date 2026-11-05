-- =========================================================================
-- CHUVATOR PARENT PORTAL V2 — PHASE 1E BOOKINGS RLS FOR PARENTS (REVISED)
-- Target: Supabase PostgreSQL
-- Fix: Menggunakan nama kolom psl.parent_account_id yang akurat sesuai skema database
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS "bookings_parent_select" ON public.bookings;

CREATE POLICY "bookings_parent_select" ON public.bookings
FOR SELECT USING (
    class_id::text IN (
        SELECT s.class_id::text 
        FROM public.students s
        JOIN public.parent_student_links psl ON (s.id::text = psl.student_id::text)
        JOIN public.parent_accounts pa ON (psl.parent_account_id = pa.id)
        WHERE (pa.auth_uid = auth.uid()::text OR LOWER(pa.email) = LOWER(auth.jwt()->>'email'))
          AND psl.status = 'active'
          AND s.class_id IS NOT NULL
    )
);

COMMIT;
