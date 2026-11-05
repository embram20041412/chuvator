-- =============================================================================
-- CHUVATOR PARENT PORTAL V2 — FASE 4B
-- DDL MIGRATION & PL/PGSQL RPC ROUTINES: 06_phase4b_manual_payment_schema.sql
-- Status: PREPARED MIGRATION SPECIFICATION (DO NOT EXECUTE DIRECTLY ON PROD)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ALTER TABLE: spp_payments
-- Ensure tracking fields exist for receipt uploads, rejection reasons, and submission timestamps.
-- -----------------------------------------------------------------------------

ALTER TABLE public.spp_payments 
    ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'TRANSFER_BANK',
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

-- -----------------------------------------------------------------------------
-- 2. UPDATED RPC: admin_verify_spp_payment
-- Restricts verification strictly to 'owner' and 'admin' roles (EXCLUDES 'manager', 'kasir', 'staff', 'parent').
-- Supports VERIFY and REJECT with mandatory notes/rejection_reason and atomic ledger entries.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_verify_spp_payment(
    p_tenant_id TEXT,
    p_spp_payment_id UUID,
    p_action TEXT, -- 'VERIFY', 'REJECT', 'CORRECT'
    p_notes TEXT DEFAULT NULL,
    p_correction_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth_uid TEXT := auth.uid()::text;
    v_staff_name TEXT;
    v_staff_email TEXT;
    v_staff_role TEXT;
    v_payment RECORD;
    v_prev_verification_status TEXT;
    v_new_verification_status TEXT;
    v_verification_id UUID;
    v_tx_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Auth & Strict RBAC Check (Owner and Admin ONLY for Phase 4B)
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT name, email, role INTO v_staff_name, v_staff_email, v_staff_role
    FROM public.users_staff
    WHERE uid = v_auth_uid AND tenant_id = p_tenant_id AND status = 'active';

    IF v_staff_role IS NULL THEN
        SELECT 'owner', name, COALESCE(email, v_auth_uid || '@tenant.local') INTO v_staff_role, v_staff_name, v_staff_email
        FROM public.tenants
        WHERE id = p_tenant_id AND owner_uid = v_auth_uid;
    END IF;

    IF v_staff_role IS NULL OR v_staff_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION '403 REJECTED: Payment verification strictly prohibited for role %', COALESCE(v_staff_role, 'NONE') USING ERRCODE = '42501';
    END IF;

    IF p_action NOT IN ('VERIFY', 'REJECT', 'CORRECT') THEN
        RAISE EXCEPTION 'INVALID_ACTION: Action must be VERIFY, REJECT, or CORRECT' USING ERRCODE = '22023';
    END IF;

    IF p_action = 'REJECT' AND (p_notes IS NULL OR trim(p_notes) = '') THEN
        RAISE EXCEPTION 'REJECTION_REASON_REQUIRED: Notes/reason is mandatory when rejecting payment' USING ERRCODE = '22023';
    END IF;

    -- 2. Lock target payment FOR UPDATE to prevent race conditions
    SELECT * INTO v_payment 
    FROM public.spp_payments 
    WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Payment % does not exist in tenant %', p_spp_payment_id, p_tenant_id USING ERRCODE = '23503';
    END IF;

    IF v_payment.verification_status = 'verified' AND p_action = 'VERIFY' THEN
        RAISE EXCEPTION 'ALREADY_VERIFIED: Payment % has already been verified', p_spp_payment_id USING ERRCODE = '22000';
    END IF;

    v_prev_verification_status := COALESCE(v_payment.verification_status, 'unverified');

    IF p_action = 'VERIFY' THEN
        v_new_verification_status := 'verified';
    ELSIF p_action = 'REJECT' THEN
        v_new_verification_status := 'rejected';
    ELSIF p_action = 'CORRECT' THEN
        v_new_verification_status := 'verified';
    END IF;

    -- 3. Append-Only audit entry in spp_payment_verifications
    v_verification_id := gen_random_uuid();

    INSERT INTO public.spp_payment_verifications (
        id, tenant_id, spp_payment_id, verification_action, previous_status,
        new_status, notes, verified_by_uid, verified_by_email, verified_by_role,
        correction_reference_id, created_at
    ) VALUES (
        v_verification_id, p_tenant_id, p_spp_payment_id, p_action, v_prev_verification_status,
        v_new_verification_status, p_notes, v_auth_uid, v_staff_email, v_staff_role,
        p_correction_reference_id, now()
    );

    -- 4. Update spp_payments status atomically
    IF p_action = 'VERIFY' THEN
        v_tx_id := gen_random_uuid();

        -- Create parent transaction header
        INSERT INTO public.transactions (
            id, tenant_id, student_id, amount, payment_method, status, is_void, created_at
        ) VALUES (
            v_tx_id, p_tenant_id, v_payment.student_id, v_payment.amount, COALESCE(v_payment.payment_method, 'TRANSFER_BANK'), 'COMPLETED', false, now()
        );

        -- Update payment to LUNAS and verified
        UPDATE public.spp_payments
        SET verification_status = 'verified',
            status = 'LUNAS',
            transaction_id = v_tx_id,
            rejection_reason = NULL
        WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id;

        -- Write Global Ledger entries (Bank/Cash vs Revenue)
        INSERT INTO public.global_ledger (
            id, tenant_id, transaction_id, account_code, debit, credit, description, created_at
        ) VALUES 
        (gen_random_uuid(), p_tenant_id, v_tx_id, '1002_BANK_TRANSFER', v_payment.amount, 0.00, 'SPP Manual Verification Payment ID ' || p_spp_payment_id, now()),
        (gen_random_uuid(), p_tenant_id, v_tx_id, '4001_REVENUE', 0.00, v_payment.amount, 'SPP Sales Revenue Payment ID ' || p_spp_payment_id, now());

    ELSIF p_action = 'REJECT' THEN
        -- Rejection DOES NOT create transaction or ledger revenue entries!
        UPDATE public.spp_payments
        SET verification_status = 'rejected',
            status = 'BELUM_LUNAS',
            rejection_reason = p_notes
        WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'verification_id', v_verification_id,
        'previous_status', v_prev_verification_status,
        'new_status', v_new_verification_status,
        'action', p_action,
        'notes', p_notes
    );

    RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. NEW RPC: parent_submit_manual_payment_proof
-- Allows parents to attach receipt_url to an SPP payment record,
-- setting verification_status = 'unverified' (WAITING_VERIFICATION).
-- DOES NOT mark payment as LUNAS or write ledger entries.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.parent_submit_manual_payment_proof(
    p_tenant_id TEXT,
    p_student_id UUID,
    p_spp_payment_id UUID,
    p_receipt_url TEXT,
    p_payment_method TEXT DEFAULT 'TRANSFER_BANK'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth_uid TEXT := auth.uid()::text;
    v_parent_id UUID;
    v_payment RECORD;
    v_result JSONB;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Parent must be authenticated' USING ERRCODE = '42501';
    END IF;

    -- 1. Validate Parent-Student Relationship
    SELECT psl.parent_id INTO v_parent_id
    FROM public.parent_student_links psl
    JOIN public.parent_accounts pa ON psl.parent_id = pa.id
    WHERE (pa.auth_uid = v_auth_uid OR pa.email = v_auth_uid)
      AND psl.student_id = p_student_id
      AND psl.tenant_id = p_tenant_id
      AND psl.status = 'active';

    IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN: Sesi orang tua tidak terhubung dengan siswa % pada tenant %', p_student_id, p_tenant_id USING ERRCODE = '42501';
    END IF;

    IF p_receipt_url IS NULL OR trim(p_receipt_url) = '' THEN
        RAISE EXCEPTION 'RECEIPT_URL_REQUIRED: URL atau lampiran bukti pembayaran wajib diisi' USING ERRCODE = '22023';
    END IF;

    -- 2. Lock target payment FOR UPDATE
    SELECT * INTO v_payment
    FROM public.spp_payments
    WHERE id = p_spp_payment_id AND student_id = p_student_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Tagihan % tidak ditemukan', p_spp_payment_id USING ERRCODE = '23503';
    END IF;

    IF v_payment.status = 'LUNAS' OR v_payment.verification_status = 'verified' THEN
        RAISE EXCEPTION 'ALREADY_PAID: Tagihan % telah lunas terverifikasi', p_spp_payment_id USING ERRCODE = '22000';
    END IF;

    -- 3. Update payment record to WAITING_VERIFICATION (unverified)
    UPDATE public.spp_payments
    SET receipt_url = p_receipt_url,
        payment_method = COALESCE(p_payment_method, 'TRANSFER_BANK'),
        verification_status = 'unverified',
        submitted_at = now(),
        rejection_reason = NULL
    WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id;

    v_result := jsonb_build_object(
        'success', true,
        'spp_payment_id', p_spp_payment_id,
        'status', 'WAITING_VERIFICATION',
        'verification_status', 'unverified',
        'receipt_url', p_receipt_url,
        'submitted_at', now()
    );

    RETURN v_result;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.admin_verify_spp_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_submit_manual_payment_proof TO authenticated;

COMMIT;
-- =============================================================================
-- END OF SCHEMA & ROUTINES SPECIFICATION
-- =============================================================================
