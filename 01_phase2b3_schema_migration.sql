-- =============================================================================
-- CHUVATOR PARENT PORTAL V2 — FASE 2B-3
-- DDL MIGRATION SCRIPT DRAFT: 01_phase2b3_schema_migration.sql
-- Status: SPECIFICATION DRAFT (FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PRE-MIGRATION VALIDATION & DIRTY DATA CHECKS
-- Run these checks before applying migration to detect potential violations.
-- -----------------------------------------------------------------------------
-- Check 1: Duplicate (id, tenant_id) in transactions
SELECT id, tenant_id, COUNT(*) 
FROM public.transactions 
GROUP BY id, tenant_id 
HAVING COUNT(*) > 1;

-- Check 2: Duplicate (id, tenant_id) in spp_payments
SELECT id, tenant_id, COUNT(*) 
FROM public.spp_payments 
GROUP BY id, tenant_id 
HAVING COUNT(*) > 1;

-- Check 3: Orphan student references in spp_payments prior to converting FK
SELECT p.id, p.student_id, p.tenant_id 
FROM public.spp_payments p
LEFT JOIN public.students s ON p.student_id = s.id AND p.tenant_id = s.tenant_id
WHERE s.id IS NULL AND p.student_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 1. ADD UNIQUE CONSTRAINTS FOR COMPOSITE FOREIGN KEY TARGETS
-- Enables composite FKs (id, tenant_id) to guarantee tenant-isolation at DB layer.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_transactions_id_tenant'
    ) THEN
        ALTER TABLE public.transactions 
        ADD CONSTRAINT uq_transactions_id_tenant UNIQUE (id, tenant_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_spp_payments_id_tenant'
    ) THEN
        ALTER TABLE public.spp_payments 
        ADD CONSTRAINT uq_spp_payments_id_tenant UNIQUE (id, tenant_id);
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 2. CREATE TABLE: pos_idempotency_keys
-- Unified idempotency key store for POS Checkouts and SPP Refunds.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pos_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    response_payload JSONB NULL,
    error_payload JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_pos_idempotency_op_type 
        CHECK (operation_type IN ('POS_CHECKOUT', 'SPP_REFUND')),
    CONSTRAINT chk_pos_idempotency_status 
        CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT uq_pos_idempotency_tenant_key_op 
        UNIQUE (tenant_id, idempotency_key, operation_type)
);

-- Index for speedy lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_pos_idempotency_tenant_key 
    ON public.pos_idempotency_keys (tenant_id, idempotency_key, operation_type);
CREATE INDEX IF NOT EXISTS idx_pos_idempotency_created 
    ON public.pos_idempotency_keys (created_at);


-- -----------------------------------------------------------------------------
-- 3. ALTER EXISTING TABLE: spp_payments
-- Add tracking fields, verification status, period status, and convert FK to ON DELETE RESTRICT.
-- -----------------------------------------------------------------------------

-- Add transaction_id link
ALTER TABLE public.spp_payments 
    ADD COLUMN IF NOT EXISTS transaction_id UUID NULL;

-- Add verification status tracking
ALTER TABLE public.spp_payments 
    ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';

-- Add period status tracking
ALTER TABLE public.spp_payments 
    ADD COLUMN IF NOT EXISTS period_status TEXT NOT NULL DEFAULT 'current';

-- Add check constraint for verification status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_spp_payments_verification_status'
    ) THEN
        ALTER TABLE public.spp_payments 
        ADD CONSTRAINT chk_spp_payments_verification_status 
        CHECK (verification_status IN ('unverified', 'verified', 'rejected'));
    END IF;
END $$;

-- Add check constraint for period status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_spp_payments_period_status'
    ) THEN
        ALTER TABLE public.spp_payments 
        ADD CONSTRAINT chk_spp_payments_period_status 
        CHECK (period_status IN ('current', 'historical', 'corrected'));
    END IF;
END $$;

-- Convert student_id foreign key from ON DELETE CASCADE to ON DELETE RESTRICT
DO $$
BEGIN
    -- Drop old cascade FK if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spp_payments_student_id_fkey'
    ) THEN
        ALTER TABLE public.spp_payments DROP CONSTRAINT spp_payments_student_id_fkey;
    END IF;
    
    -- Add composite RESTRICT FK if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_spp_payments_student_tenant'
    ) THEN
        ALTER TABLE public.spp_payments 
        ADD CONSTRAINT fk_spp_payments_student_tenant 
        FOREIGN KEY (student_id, tenant_id) 
        REFERENCES public.students(id, tenant_id) 
        ON DELETE RESTRICT;
    END IF;
END $$;

-- Composite FK linking spp_payments to transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_spp_payments_transaction_tenant'
    ) THEN
        ALTER TABLE public.spp_payments 
        ADD CONSTRAINT fk_spp_payments_transaction_tenant 
        FOREIGN KEY (transaction_id, tenant_id) 
        REFERENCES public.transactions(id, tenant_id) 
        ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spp_payments_tenant_student_month 
    ON public.spp_payments (tenant_id, student_id, paid_month);


-- -----------------------------------------------------------------------------
-- 4. CREATE TABLE: spp_payment_verifications
-- Append-only audit log for manual or batch SPP payment verifications.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.spp_payment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    spp_payment_id UUID NOT NULL,
    verification_action TEXT NOT NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    notes TEXT NULL,
    verified_by_uid TEXT NOT NULL,
    verified_by_email TEXT NOT NULL,
    verified_by_role TEXT NOT NULL,
    correction_reference_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_spp_verifications_action 
        CHECK (verification_action IN ('VERIFY', 'REJECT', 'CORRECT')),
    CONSTRAINT fk_spp_verifications_payment_tenant 
        FOREIGN KEY (spp_payment_id, tenant_id) 
        REFERENCES public.spp_payments(id, tenant_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_spp_verifications_correction_ref 
        FOREIGN KEY (correction_reference_id) 
        REFERENCES public.spp_payment_verifications(id) 
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_spp_verifications_tenant_payment 
    ON public.spp_payment_verifications (tenant_id, spp_payment_id);


-- -----------------------------------------------------------------------------
-- 5. CREATE TABLE: spp_refunds
-- Financial refund log tracking overpayment and fee allocations.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.spp_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    spp_payment_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    refund_no TEXT NOT NULL,
    refund_amount NUMERIC(12,2) NOT NULL,
    overpayment_refunded NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    fee_refunded NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    refunded_by_uid TEXT NOT NULL,
    refunded_by_email TEXT NOT NULL,
    refunded_by_role TEXT NOT NULL,
    idempotency_key TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_spp_refunds_amount_pos 
        CHECK (refund_amount > 0),
    CONSTRAINT chk_spp_refunds_overpay_nonneg 
        CHECK (overpayment_refunded >= 0),
    CONSTRAINT chk_spp_refunds_fee_nonneg 
        CHECK (fee_refunded >= 0),
    CONSTRAINT chk_spp_refunds_status 
        CHECK (status IN ('COMPLETED', 'FAILED')),
    CONSTRAINT uq_spp_refunds_tenant_no 
        UNIQUE (tenant_id, refund_no),
    CONSTRAINT fk_spp_refunds_payment_tenant 
        FOREIGN KEY (spp_payment_id, tenant_id) 
        REFERENCES public.spp_payments(id, tenant_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_spp_refunds_transaction_tenant 
        FOREIGN KEY (transaction_id, tenant_id) 
        REFERENCES public.transactions(id, tenant_id) 
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_spp_refunds_tenant_payment 
    ON public.spp_refunds (tenant_id, spp_payment_id);
CREATE INDEX IF NOT EXISTS idx_spp_refunds_tenant_tx 
    ON public.spp_refunds (tenant_id, transaction_id);


-- -----------------------------------------------------------------------------
-- 6. ALTER TABLE: pos_transactions (RECEIPT UNIQUENESS CONSTRAINT)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_pos_transactions_tenant_receipt'
    ) THEN
        ALTER TABLE public.pos_transactions 
        ADD CONSTRAINT uq_pos_transactions_tenant_receipt 
        UNIQUE (tenant_id, receipt_no);
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 7. POST-MIGRATION VERIFICATION CHECKS
-- Verify all tables, constraints, and indexes were created properly.
-- -----------------------------------------------------------------------------
SELECT conname, contype 
FROM pg_constraint 
WHERE conname IN (
    'uq_transactions_id_tenant',
    'uq_spp_payments_id_tenant',
    'uq_pos_idempotency_tenant_key_op',
    'chk_spp_payments_verification_status',
    'chk_spp_payments_period_status',
    'fk_spp_payments_student_tenant',
    'fk_spp_payments_transaction_tenant',
    'uq_spp_refunds_tenant_no',
    'uq_pos_transactions_tenant_receipt'
);

COMMIT;
-- =============================================================================
-- END OF DDL MIGRATION SCRIPT
-- =============================================================================
