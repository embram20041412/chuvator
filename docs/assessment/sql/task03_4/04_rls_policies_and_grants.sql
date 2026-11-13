-- =============================================================================
-- CHUVATOR — TASK 03.4.3: SUPABASE DATABASE MIGRATION READINESS (REMEDIATED)
-- 04_rls_policies_and_grants.sql (STRICT RLS POLICIES & TABLE GRANTS)
-- =============================================================================
-- JAMINAN KEAMANAN:
--   1. Transaksional (BEGIN ... COMMIT) dan idempoten.
--   2. ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY aktif pada tabel.
--   3. Akses PUBLIC & anon dicabut sepenuhnya.
--   4. SELECT:
--      - Owner, Admin, Staff, Kasir tenant aktif hanya untuk atlet milik tenant.
--      - Coach HANYA untuk atlet pada kelas aktif miliknya (`coach_can_manage_student`).
--   5. INSERT/UPDATE/DELETE:
--      - Hanya Owner, Admin, dan Coach sesuai `coach_can_manage_student`;
--      - Kasir, Staff, Superadmin, anon, non-member, tenant non-aktif,
--        serta Coach lintas-kelas/tanpa kelas aktif ditolak (42501 / 0 rows).
-- =============================================================================

BEGIN;

ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;

-- Cabut semua hak akses dari PUBLIC dan anon
REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.athlete_test_results TO authenticated;

-- Hapus policy lama jika ada lalu buat ulang secara deterministik & idempoten
DROP POLICY IF EXISTS athlete_test_results_select_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_select_policy
    ON public.athlete_test_results
    FOR SELECT
    TO authenticated
    USING (
        (
            public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'staff', 'kasir')
            AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        )
        OR (
            public.get_strict_tenant_member_role(tenant_id::text) = 'coach'
            AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
            AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
        )
    );

DROP POLICY IF EXISTS athlete_test_results_insert_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_insert_policy
    ON public.athlete_test_results
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    );

DROP POLICY IF EXISTS athlete_test_results_update_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_update_policy
    ON public.athlete_test_results
    FOR UPDATE
    TO authenticated
    USING (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    )
    WITH CHECK (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    );

DROP POLICY IF EXISTS athlete_test_results_delete_policy ON public.athlete_test_results;
CREATE POLICY athlete_test_results_delete_policy
    ON public.athlete_test_results
    FOR DELETE
    TO authenticated
    USING (
        public.get_strict_tenant_member_role(tenant_id::text) IN ('owner', 'admin', 'coach')
        AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id)
        AND public.coach_can_manage_student(tenant_id::text, student_id, class_id)
    );

COMMIT;
