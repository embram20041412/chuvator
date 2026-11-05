-- =========================================================================
-- CHUVATOR PARENT PORTAL V2 — PHASE 1C TENANT RLS FOR PARENTS (REVISED)
-- Target: Supabase PostgreSQL
-- Purpose: Mengizinkan orang tua membaca profil tenant (hanya tenant tempat anaknya aktif)
-- Fix: Menggunakan psl.parent_account_id untuk relasi parent_accounts
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS "tenants_parent_select" ON public.tenants;

CREATE POLICY "tenants_parent_select" ON public.tenants
FOR SELECT USING (
    id::text IN (
        SELECT psl.tenant_id FROM public.parent_student_links psl
        JOIN public.parent_accounts pa ON psl.parent_account_id = pa.id
        WHERE (pa.auth_uid = auth.uid()::text OR LOWER(pa.email) = LOWER(auth.jwt()->>'email'))
          AND psl.status = 'active'
    )
    OR tenant_id::text IN (
        SELECT psl.tenant_id FROM public.parent_student_links psl
        JOIN public.parent_accounts pa ON psl.parent_account_id = pa.id
        WHERE (pa.auth_uid = auth.uid()::text OR LOWER(pa.email) = LOWER(auth.jwt()->>'email'))
          AND psl.status = 'active'
    )
);

COMMIT;
