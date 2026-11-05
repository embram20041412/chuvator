-- =============================================================================
-- CHUVATOR PARENT PORTAL V2 — FASE 2B-3
-- SECURITY & RLS POLICIES DRAFT: 03_phase2b3_security_policies.sql
-- Status: SPECIFICATION DRAFT (FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ENABLE RLS AND FORCE RLS ON ALL TABLES
-- Ensures even table owners and authenticated roles are bound by tenant isolation policies.
-- -----------------------------------------------------------------------------

ALTER TABLE public.pos_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_idempotency_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE public.spp_payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_payment_verifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.spp_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_refunds FORCE ROW LEVEL SECURITY;

ALTER TABLE public.spp_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.global_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_ledger FORCE ROW LEVEL SECURITY;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;

ALTER TABLE public.users_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_staff FORCE ROW LEVEL SECURITY;

ALTER TABLE public.parent_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links FORCE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 2. REVOKE DIRECT DML TABLE ACCESS FROM AUTHENTICATED AND ANON
-- Financial mutations MUST pass through SECURITY DEFINER RPC routines only.
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.pos_idempotency_keys FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.spp_payment_verifications FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.spp_refunds FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.spp_payments FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.transactions FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.pos_transactions FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.global_ledger FROM anon, authenticated, public;

-- Grant READ-ONLY (SELECT) to authenticated users subject to RLS
GRANT SELECT ON TABLE public.pos_idempotency_keys TO authenticated;
GRANT SELECT ON TABLE public.spp_payment_verifications TO authenticated;
GRANT SELECT ON TABLE public.spp_refunds TO authenticated;
GRANT SELECT ON TABLE public.spp_payments TO authenticated;
GRANT SELECT ON TABLE public.transactions TO authenticated;
GRANT SELECT ON TABLE public.pos_transactions TO authenticated;
GRANT SELECT ON TABLE public.global_ledger TO authenticated;
GRANT SELECT ON TABLE public.students TO authenticated;
GRANT SELECT ON TABLE public.users_staff TO authenticated;
GRANT SELECT ON TABLE public.parent_accounts TO authenticated;
GRANT SELECT ON TABLE public.parent_student_links TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. RLS TENANT ISOLATION POLICIES (SELECT ONLY)
-- -----------------------------------------------------------------------------

-- Helper Policy Definition function
DO $$
BEGIN
    -- spp_payments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_spp_payments_select') THEN
        CREATE POLICY tenant_isolation_spp_payments_select ON public.spp_payments
        FOR SELECT TO authenticated
        USING (tenant_id = (SELECT tenant_id FROM public.users_staff WHERE uid = auth.uid() AND status = 'active' LIMIT 1));
    END IF;

    -- spp_refunds (Append-only: NO update/delete policies created)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_spp_refunds_select') THEN
        CREATE POLICY tenant_isolation_spp_refunds_select ON public.spp_refunds
        FOR SELECT TO authenticated
        USING (tenant_id = (SELECT tenant_id FROM public.users_staff WHERE uid = auth.uid() AND status = 'active' LIMIT 1));
    END IF;

    -- spp_payment_verifications (Append-only: NO update/delete policies created)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_spp_verifications_select') THEN
        CREATE POLICY tenant_isolation_spp_verifications_select ON public.spp_payment_verifications
        FOR SELECT TO authenticated
        USING (tenant_id = (SELECT tenant_id FROM public.users_staff WHERE uid = auth.uid() AND status = 'active' LIMIT 1));
    END IF;

    -- transactions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_transactions_select') THEN
        CREATE POLICY tenant_isolation_transactions_select ON public.transactions
        FOR SELECT TO authenticated
        USING (tenant_id = (SELECT tenant_id FROM public.users_staff WHERE uid = auth.uid() AND status = 'active' LIMIT 1));
    END IF;

    -- pos_transactions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_pos_transactions_select') THEN
        CREATE POLICY tenant_isolation_pos_transactions_select ON public.pos_transactions
        FOR SELECT TO authenticated
        USING (tenant_id = (SELECT tenant_id FROM public.users_staff WHERE uid = auth.uid() AND status = 'active' LIMIT 1));
    END IF;

    -- global_ledger
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_global_ledger_select') THEN
        CREATE POLICY tenant_isolation_global_ledger_select ON public.global_ledger
        FOR SELECT TO authenticated
        USING (tenant_id = (SELECT tenant_id FROM public.users_staff WHERE uid = auth.uid() AND status = 'active' LIMIT 1));
    END IF;

    -- pos_idempotency_keys
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_pos_idempotency_select') THEN
        CREATE POLICY tenant_isolation_pos_idempotency_select ON public.pos_idempotency_keys
        FOR SELECT TO authenticated
        USING (tenant_id = (SELECT tenant_id FROM public.users_staff WHERE uid = auth.uid() AND status = 'active' LIMIT 1));
    END IF;
END $$;

COMMIT;
-- =============================================================================
-- END OF SECURITY & RLS POLICIES SCRIPT
-- =============================================================================
