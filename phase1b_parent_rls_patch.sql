-- =========================================================================
-- CHUVATOR PARENT PORTAL V2 — PHASE 1B RLS PATCH
-- Target: Supabase PostgreSQL
-- Purpose: Grant SELECT access to Parents for relevant operational data
-- =========================================================================

BEGIN;

-- 1. Helper function untuk mendapatkan daftar student_id anak dari parent yang sedang login
-- SECURITY DEFINER ensures this runs with elevated privileges to check parent links.
CREATE OR REPLACE FUNCTION public.get_parent_authorized_students(p_tenant_id TEXT)
RETURNS SETOF UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT psl.student_id 
    FROM public.parent_student_links psl 
    JOIN public.parent_accounts pa ON psl.parent_id = pa.id 
    WHERE (pa.auth_uid = auth.uid()::text OR LOWER(pa.email) = LOWER(auth.jwt()->>'email')) 
      AND psl.tenant_id = p_tenant_id 
      AND psl.status = 'active'; 
END; 
$$;

-- 2. Tambahkan Policy SELECT untuk Parents pada tabel operasional
-- Multiple policies on the same table combine with OR.

-- Tabel students
DROP POLICY IF EXISTS "students_parent_select" ON public.students;
CREATE POLICY "students_parent_select" ON public.students
FOR SELECT USING ( id IN (SELECT public.get_parent_authorized_students(tenant_id::text)) );

-- Tabel spp_payments
DROP POLICY IF EXISTS "spp_payments_parent_select" ON public.spp_payments;
CREATE POLICY "spp_payments_parent_select" ON public.spp_payments
FOR SELECT USING ( student_id IN (SELECT public.get_parent_authorized_students(tenant_id::text)) );

-- Tabel academy_attendance
DROP POLICY IF EXISTS "attendance_parent_select" ON public.academy_attendance;
CREATE POLICY "attendance_parent_select" ON public.academy_attendance
FOR SELECT USING ( student_id IN (SELECT public.get_parent_authorized_students(tenant_id::text)) );

-- Tabel academy_evaluations
DROP POLICY IF EXISTS "evaluations_parent_select" ON public.academy_evaluations;
CREATE POLICY "evaluations_parent_select" ON public.academy_evaluations
FOR SELECT USING ( student_id IN (SELECT public.get_parent_authorized_students(tenant_id::text)) );

-- Tabel academy_classes (Hanya kelas yang diikuti anak)
DROP POLICY IF EXISTS "classes_parent_select" ON public.academy_classes;
CREATE POLICY "classes_parent_select" ON public.academy_classes
FOR SELECT USING (
    id IN (
        SELECT class_id FROM public.students 
        WHERE id IN (SELECT public.get_parent_authorized_students(academy_classes.tenant_id::text))
    )
);

-- Tabel coaches (Hanya pelatih yang mengajar kelas anak)
DROP POLICY IF EXISTS "coaches_parent_select" ON public.coaches;
CREATE POLICY "coaches_parent_select" ON public.coaches
FOR SELECT USING (
    id IN (
        SELECT coach_id FROM public.academy_classes 
        WHERE id IN (
            SELECT class_id FROM public.students 
            WHERE id IN (SELECT public.get_parent_authorized_students(coaches.tenant_id::text))
        )
    )
);

-- 3. Tambahkan Policy SELECT untuk Parent Profil & Links (agar bisa otorisasi mandiri)
DROP POLICY IF EXISTS "parent_accounts_self_select" ON public.parent_accounts;
CREATE POLICY "parent_accounts_self_select" ON public.parent_accounts
FOR SELECT USING ( auth_uid = auth.uid()::text OR LOWER(email) = LOWER(auth.jwt()->>'email') );

DROP POLICY IF EXISTS "parent_student_links_self_select" ON public.parent_student_links;
CREATE POLICY "parent_student_links_self_select" ON public.parent_student_links
FOR SELECT USING ( 
    parent_id IN (
        SELECT id FROM public.parent_accounts 
        WHERE auth_uid = auth.uid()::text OR LOWER(email) = LOWER(auth.jwt()->>'email')
    )
);

-- 4. Create announcements table (GAP-01)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT DEFAULT 'Umum',
    author TEXT,
    is_important BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'published',
    publish_date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for tenant isolation
CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON public.announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_date ON public.announcements(publish_date DESC);

-- 5. Add status column to academy_evaluations for publication control
ALTER TABLE public.academy_evaluations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';

-- 6. Enable RLS for announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policy for Staff (All access to their tenant)
DROP POLICY IF EXISTS "announcements_staff_policy" ON public.announcements;
CREATE POLICY "announcements_staff_policy" ON public.announcements
FOR ALL USING (user_has_tenant_access(tenant_id::text));

-- 8. RLS Policy for Parents (Select only)
DROP POLICY IF EXISTS "announcements_parent_select" ON public.announcements;
CREATE POLICY "announcements_parent_select" ON public.announcements
FOR SELECT USING (
    tenant_id IN (
        SELECT DISTINCT psl.tenant_id 
        FROM public.parent_student_links psl
        JOIN public.parent_accounts pa ON psl.parent_id = pa.id
        WHERE (pa.auth_uid = auth.uid()::text OR LOWER(pa.email) = LOWER(auth.jwt()->>'email'))
          AND psl.status = 'active'
    )
    AND status = 'published'
);

COMMIT;
