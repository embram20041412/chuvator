-- =============================================================================
-- CHUVATOR PARENT PORTAL V2 — FASE 2B-3
-- PL/pgSQL RPC ROUTINES DRAFT: 02_phase2b3_rpc_routines.sql
-- Status: SPECIFICATION DRAFT (FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL)
-- =============================================================================

-- Security & Context Configuration
-- All functions are marked SECURITY DEFINER with fixed safe search_path.

-- -----------------------------------------------------------------------------
-- 1. RPC: pos_checkout_spp_atomic
-- Performs atomic POS Checkout for SPP & Retail items.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pos_checkout_spp_atomic(
    p_tenant_id TEXT,
    p_idempotency_key TEXT,
    p_student_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_subtotal NUMERIC DEFAULT 0.00,
    p_discount NUMERIC DEFAULT 0.00,
    p_tax NUMERIC DEFAULT 0.00,
    p_total_amount NUMERIC DEFAULT 0.00,
    p_amount_tendered NUMERIC DEFAULT 0.00,
    p_payment_method TEXT DEFAULT 'CASH',
    p_notes TEXT DEFAULT NULL,
    p_spp_month TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth_uid TEXT := auth.uid()::text;
    v_staff_id UUID;
    v_staff_name TEXT;
    v_staff_role TEXT;
    v_staff_status TEXT;
    v_tenant_status TEXT;
    v_payload_hash TEXT;
    v_existing_idempotency RECORD;
    v_receipt_no TEXT;
    v_tx_id UUID;
    v_pos_tx_id UUID;
    v_student_name TEXT := NULL;
    v_change_due NUMERIC(12,2);
    v_result JSONB;
BEGIN
    -- 1. Authenticated JWT & Role Verification (DECISION-01)
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT id, name, role, status 
    INTO v_staff_id, v_staff_name, v_staff_role, v_staff_status
    FROM public.users_staff
    WHERE uid = v_auth_uid AND tenant_id = p_tenant_id;

    IF v_staff_role IS NULL OR v_staff_status != 'active' THEN
        RAISE EXCEPTION 'FORBIDDEN: Staff account not found or inactive for tenant %', p_tenant_id USING ERRCODE = '42501';
    END IF;

    IF v_staff_role NOT IN ('owner', 'admin', 'manager', 'kasir') THEN
        RAISE EXCEPTION '403 REJECTED: Financial checkout prohibited for role %', v_staff_role USING ERRCODE = '42501';
    END IF;

    -- Verify active tenant status
    SELECT status INTO v_tenant_status 
    FROM public.tenants 
    WHERE tenant_id = p_tenant_id;

    IF v_tenant_status IS NULL OR v_tenant_status NOT IN ('active', 'aktif') THEN
        RAISE EXCEPTION 'FORBIDDEN: Tenant % is inactive', p_tenant_id USING ERRCODE = '42501';
    END IF;

    -- 2. Idempotency Check & Lock
    v_payload_hash := encode(digest(
        p_tenant_id || ':' || COALESCE(p_student_id::text, '') || ':' || p_total_amount::text || ':' || p_items::text,
        'sha256'
    ), 'hex');

    SELECT * INTO v_existing_idempotency
    FROM public.pos_idempotency_keys
    WHERE tenant_id = p_tenant_id 
      AND idempotency_key = p_idempotency_key 
      AND operation_type = 'POS_CHECKOUT'
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.status = 'COMPLETED' THEN
            RETURN v_existing_idempotency.response_payload;
        ELSIF v_existing_idempotency.status = 'PROCESSING' THEN
            RAISE EXCEPTION 'CONCURRENT_REQUEST: Idempotency key currently processing' USING ERRCODE = '55P03';
        END IF;
    ELSE
        INSERT INTO public.pos_idempotency_keys (
            tenant_id, idempotency_key, operation_type, payload_hash, status
        ) VALUES (
            p_tenant_id, p_idempotency_key, 'POS_CHECKOUT', v_payload_hash, 'PROCESSING'
        );
    END IF;

    -- 3. Business Financial Validation
    IF p_total_amount < 0 OR p_subtotal < 0 OR p_discount < 0 OR p_tax < 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Amounts cannot be negative' USING ERRCODE = '22003';
    END IF;

    IF p_amount_tendered < p_total_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_TENDER: Tendered amount % is less than total %', p_amount_tendered, p_total_amount USING ERRCODE = '22003';
    END IF;

    v_change_due := p_amount_tendered - p_total_amount;

    IF p_student_id IS NOT NULL THEN
        SELECT name INTO v_student_name 
        FROM public.students 
        WHERE id = p_student_id AND tenant_id = p_tenant_id;
        
        IF v_student_name IS NULL THEN
            RAISE EXCEPTION 'STUDENT_NOT_FOUND: Student % does not exist in tenant %', p_student_id, p_tenant_id USING ERRCODE = '23503';
        END IF;
    END IF;

    -- 4. Unique Receipt Number Generation
    v_receipt_no := 'POS-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || lpad(floor(random() * 8999 + 1000)::text, 4, '0');
    v_tx_id := gen_random_uuid();
    v_pos_tx_id := gen_random_uuid();

    -- 5. Atomic Insertion across 4 Tables
    -- A. Main Transaction Record
    INSERT INTO public.transactions (
        id, tenant_id, student_id, amount, payment_method, items, status, is_void
    ) VALUES (
        v_tx_id, p_tenant_id, p_student_id, p_total_amount, p_payment_method, p_items, 'COMPLETED', false
    );

    -- B. POS Receipt Details
    INSERT INTO public.pos_transactions (
        id, tenant_id, transaction_id, receipt_no, cashier_uid, cashier_name,
        subtotal, discount, tax, total_amount, amount_tendered, change_due, notes, created_at
    ) VALUES (
        v_pos_tx_id, p_tenant_id, v_tx_id, v_receipt_no, v_auth_uid, v_staff_name,
        p_subtotal, p_discount, p_tax, p_total_amount, p_amount_tendered, v_change_due, p_notes, now()
    );

    -- C. SPP Payment Record (if SPP payment)
    IF p_spp_month IS NOT NULL AND p_student_id IS NOT NULL THEN
        INSERT INTO public.spp_payments (
            id, tenant_id, student_id, student_name, month, paid_month,
            amount, status, verification_status, period_status, transaction_id, notes
        ) VALUES (
            gen_random_uuid(), p_tenant_id, p_student_id, v_student_name, p_spp_month, p_spp_month,
            p_total_amount, 'LUNAS', 'verified', 'current', v_tx_id, COALESCE(p_notes, 'POS SPP Checkout')
        );
    END IF;

    -- D. Global Ledger Revenue Jurnal
    INSERT INTO public.global_ledger (
        id, tenant_id, transaction_id, account_code, debit, credit, description, created_at
    ) VALUES 
    (gen_random_uuid(), p_tenant_id, v_tx_id, '1001_CASH', p_total_amount, 0.00, 'POS Cash Tendered Receipt ' || v_receipt_no, now()),
    (gen_random_uuid(), p_tenant_id, v_tx_id, '4001_REVENUE', 0.00, p_total_amount, 'POS Sales Revenue Receipt ' || v_receipt_no, now());

    -- 6. Construct Final Result & Cache Idempotency Response
    v_result := jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'receipt_no', v_receipt_no,
        'total_amount', p_total_amount,
        'amount_tendered', p_amount_tendered,
        'change_due', v_change_due,
        'cashier_name', v_staff_name,
        'timestamp', now()
    );

    UPDATE public.pos_idempotency_keys
    SET status = 'COMPLETED',
        response_payload = v_result,
        updated_at = now()
    WHERE tenant_id = p_tenant_id 
      AND idempotency_key = p_idempotency_key 
      AND operation_type = 'POS_CHECKOUT';

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Update idempotency status on failure if key exists
    IF p_idempotency_key IS NOT NULL THEN
        UPDATE public.pos_idempotency_keys
        SET status = 'FAILED',
            error_payload = jsonb_build_object('error', SQLERRM, 'code', SQLSTATE),
            updated_at = now()
        WHERE tenant_id = p_tenant_id 
          AND idempotency_key = p_idempotency_key 
          AND operation_type = 'POS_CHECKOUT';
    END IF;
    RAISE;
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. RPC: admin_refund_spp_payment
-- Performs atomic SPP payment refund with strict lock ordering & overpayment logic.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_refund_spp_payment(
    p_tenant_id TEXT,
    p_spp_payment_id UUID,
    p_refund_amount NUMERIC,
    p_reason TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth_uid TEXT := auth.uid()::text;
    v_staff_name TEXT;
    v_staff_role TEXT;
    v_staff_email TEXT;
    v_payment RECORD;
    v_tx RECORD;
    v_existing_refunds NUMERIC(12,2) := 0.00;
    v_available_balance NUMERIC(12,2);
    v_student_monthly_fee NUMERIC(12,2) := 0.00;
    v_current_net_paid NUMERIC(12,2);
    v_current_overpayment NUMERIC(12,2);
    v_overpayment_refunded NUMERIC(12,2) := 0.00;
    v_fee_refunded NUMERIC(12,2) := 0.00;
    v_refund_no TEXT;
    v_refund_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Authenticated JWT & Role Verification (DECISION-01)
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT name, email, role INTO v_staff_name, v_staff_email, v_staff_role
    FROM public.users_staff
    WHERE uid = v_auth_uid AND tenant_id = p_tenant_id AND status = 'active';

    IF v_staff_role IS NULL OR v_staff_role NOT IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION '403 REJECTED: Financial refund prohibited for role %', COALESCE(v_staff_role, 'NONE') USING ERRCODE = '42501';
    END IF;

    IF p_refund_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Refund amount must be greater than zero' USING ERRCODE = '22003';
    END IF;

    -- 2. Deterministic Lock Hierarchy: Fetch target payment transaction ID
    SELECT * INTO v_payment 
    FROM public.spp_payments 
    WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND: SPP payment % does not exist', p_spp_payment_id USING ERRCODE = '23503';
    END IF;

    -- Lock parent transaction FIRST (FOR UPDATE)
    IF v_payment.transaction_id IS NOT NULL THEN
        SELECT * INTO v_tx 
        FROM public.transactions 
        WHERE id = v_payment.transaction_id AND tenant_id = p_tenant_id 
        FOR UPDATE;

        IF v_tx.is_void = true THEN
            RAISE EXCEPTION 'CANNOT_REFUND_VOID_TRANSACTION: Cannot refund a transaction that is VOID' USING ERRCODE = '22000';
        END IF;
    END IF;

    -- Lock child spp_payment row SECOND (FOR UPDATE)
    SELECT * INTO v_payment 
    FROM public.spp_payments 
    WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id 
    FOR UPDATE;

    IF v_payment.status IN ('VOID', 'REJECTED') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_STATE: Payment status % cannot be refunded', v_payment.status USING ERRCODE = '22000';
    END IF;

    -- 3. Calculate Existing Refunds & Prevent Over-refund
    SELECT COALESCE(SUM(refund_amount), 0.00) INTO v_existing_refunds
    FROM public.spp_refunds
    WHERE spp_payment_id = p_spp_payment_id 
      AND tenant_id = p_tenant_id 
      AND status = 'COMPLETED';

    v_available_balance := v_payment.amount - v_existing_refunds;

    IF p_refund_amount > v_available_balance THEN
        RAISE EXCEPTION 'OVER_REFUND_EXCEEDS_BALANCE: Requested refund % exceeds available balance %', p_refund_amount, v_available_balance USING ERRCODE = '22003';
    END IF;

    -- 4. Calculate Overpayment vs Fee Refund Priority (DECISION-02)
    -- Fetch student's monthly fee setting if available
    SELECT COALESCE(spp_monthly_fee, 0.00) INTO v_student_monthly_fee
    FROM public.students
    WHERE id = v_payment.student_id AND tenant_id = p_tenant_id;

    v_current_net_paid := v_payment.amount - v_existing_refunds;
    v_current_overpayment := GREATEST(0.00, v_current_net_paid - v_student_monthly_fee);

    -- Priority rule: Deduct overpayment balance FIRST
    v_overpayment_refunded := LEAST(p_refund_amount, v_current_overpayment);
    v_fee_refunded := p_refund_amount - v_overpayment_refunded;

    -- 5. Perform Atomic Refund Insertion & Ledger Entry (DECISION-03)
    v_refund_no := 'RFD-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || lpad(floor(random() * 8999 + 1000)::text, 4, '0');
    v_refund_id := gen_random_uuid();

    INSERT INTO public.spp_refunds (
        id, tenant_id, spp_payment_id, transaction_id, refund_no, refund_amount,
        overpayment_refunded, fee_refunded, reason, status, refunded_by_uid,
        refunded_by_email, refunded_by_role, idempotency_key, created_at
    ) VALUES (
        v_refund_id, p_tenant_id, p_spp_payment_id, COALESCE(v_payment.transaction_id, gen_random_uuid()),
        v_refund_no, p_refund_amount, v_overpayment_refunded, v_fee_refunded,
        p_reason, 'COMPLETED', v_auth_uid, v_staff_email, v_staff_role, p_idempotency_key, now()
    );

    -- Update spp_payments status
    IF (v_existing_refunds + p_refund_amount) >= v_payment.amount THEN
        UPDATE public.spp_payments 
        SET status = 'REFUNDED' 
        WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id;
    ELSE
        UPDATE public.spp_payments 
        SET status = 'PARSIAL_REFUND' 
        WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id;
    END IF;

    -- Jurnal Global Ledger (Offset Revenue & Cash Outflow)
    INSERT INTO public.global_ledger (
        id, tenant_id, transaction_id, account_code, debit, credit, description, created_at
    ) VALUES 
    (gen_random_uuid(), p_tenant_id, v_payment.transaction_id, '4001_REFUND_OFFSET', p_refund_amount, 0.00, 'SPP Refund Offset ' || v_refund_no, now()),
    (gen_random_uuid(), p_tenant_id, v_payment.transaction_id, '1001_CASH', 0.00, p_refund_amount, 'SPP Refund Cash Outflow ' || v_refund_no, now());

    v_result := jsonb_build_object(
        'success', true,
        'refund_id', v_refund_id,
        'refund_no', v_refund_no,
        'refund_amount', p_refund_amount,
        'overpayment_refunded', v_overpayment_refunded,
        'fee_refunded', v_fee_refunded,
        'new_payment_status', CASE WHEN (v_existing_refunds + p_refund_amount) >= v_payment.amount THEN 'REFUNDED' ELSE 'PARSIAL_REFUND' END
    );

    RETURN v_result;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. RPC: admin_verify_spp_payment
-- Performs append-only manual/batch verification of SPP payments.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_verify_spp_payment(
    p_tenant_id TEXT,
    p_spp_payment_id UUID,
    p_action TEXT,
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
    v_result JSONB;
BEGIN
    -- Auth & RBAC Check (DECISION-01)
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT name, email, role INTO v_staff_name, v_staff_email, v_staff_role
    FROM public.users_staff
    WHERE uid = v_auth_uid AND tenant_id = p_tenant_id AND status = 'active';

    IF v_staff_role IS NULL OR v_staff_role NOT IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION '403 REJECTED: Payment verification prohibited for role %', COALESCE(v_staff_role, 'NONE') USING ERRCODE = '42501';
    END IF;

    IF p_action NOT IN ('VERIFY', 'REJECT', 'CORRECT') THEN
        RAISE EXCEPTION 'INVALID_ACTION: Action must be VERIFY, REJECT, or CORRECT' USING ERRCODE = '22023';
    END IF;

    -- Lock target payment FOR UPDATE
    SELECT * INTO v_payment 
    FROM public.spp_payments 
    WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Payment % does not exist', p_spp_payment_id USING ERRCODE = '23503';
    END IF;

    v_prev_verification_status := v_payment.verification_status;

    IF p_action = 'VERIFY' THEN
        v_new_verification_status := 'verified';
    ELSIF p_action = 'REJECT' THEN
        v_new_verification_status := 'rejected';
    ELSIF p_action = 'CORRECT' THEN
        v_new_verification_status := 'verified';
    END IF;

    -- Append-Only audit entry in spp_payment_verifications
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

    -- Update target payment
    UPDATE public.spp_payments
    SET verification_status = v_new_verification_status,
        period_status = CASE WHEN p_action = 'CORRECT' THEN 'corrected' ELSE period_status END
    WHERE id = p_spp_payment_id AND tenant_id = p_tenant_id;

    v_result := jsonb_build_object(
        'success', true,
        'verification_id', v_verification_id,
        'previous_status', v_prev_verification_status,
        'new_status', v_new_verification_status,
        'action', p_action
    );

    RETURN v_result;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. RPC: parent_get_billing
-- Retrieves financial billing summary for parent user accounts.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.parent_get_billing(
    p_tenant_id TEXT,
    p_parent_uid TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_effective_parent_uid TEXT := COALESCE(p_parent_uid, auth.uid()::text);
    v_parent_id UUID;
    v_linked_students JSONB;
    v_result JSONB;
BEGIN
    IF v_effective_parent_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
    END IF;

    -- Verify parent account link
    SELECT id INTO v_parent_id
    FROM public.parent_accounts
    WHERE (auth_uid = v_effective_parent_uid OR email = v_effective_parent_uid)
      AND tenant_id = p_tenant_id;

    IF v_parent_id IS NULL THEN
        -- Return empty result if parent account not registered yet
        RETURN jsonb_build_object('success', true, 'students', '[]'::jsonb);
    END IF;

    -- Aggregate cumulative payments, refunds, remaining bills, and overpayments per student
    SELECT jsonb_agg(
        jsonb_build_object(
            'student_id', s.id,
            'student_name', s.name,
            'monthly_fee', COALESCE(s.spp_monthly_fee, 0.00),
            'verified_payments', COALESCE(p.total_verified, 0.00),
            'completed_refunds', COALESCE(r.total_refunded, 0.00),
            'net_paid', GREATEST(0.00, COALESCE(p.total_verified, 0.00) - COALESCE(r.total_refunded, 0.00)),
            'remaining_bill', GREATEST(0.00, COALESCE(s.spp_monthly_fee, 0.00) - (COALESCE(p.total_verified, 0.00) - COALESCE(r.total_refunded, 0.00))),
            'overpayment_balance', GREATEST(0.00, (COALESCE(p.total_verified, 0.00) - COALESCE(r.total_refunded, 0.00)) - COALESCE(s.spp_monthly_fee, 0.00)),
            'billing_status', CASE 
                WHEN COALESCE(s.spp_monthly_fee, 0.00) = 0.00 THEN 'BEBAS_BIAYA'
                WHEN (COALESCE(p.total_verified, 0.00) - COALESCE(r.total_refunded, 0.00)) >= COALESCE(s.spp_monthly_fee, 0.00) THEN 'LUNAS'
                WHEN (COALESCE(p.total_verified, 0.00) - COALESCE(r.total_refunded, 0.00)) > 0.00 THEN 'PARSIAL'
                ELSE 'BELUM_LUNAS'
            END
        )
    ) INTO v_linked_students
    FROM public.parent_student_links psl
    JOIN public.students s ON psl.student_id = s.id AND psl.tenant_id = s.tenant_id
    LEFT JOIN (
        SELECT student_id, tenant_id, SUM(amount) AS total_verified
        FROM public.spp_payments
        WHERE verification_status = 'verified' AND status NOT IN ('VOID', 'REJECTED')
        GROUP BY student_id, tenant_id
    ) p ON s.id = p.student_id AND s.tenant_id = p.tenant_id
    LEFT JOIN (
        SELECT spp.student_id, r.tenant_id, SUM(r.refund_amount) AS total_refunded
        FROM public.spp_refunds r
        JOIN public.spp_payments spp ON r.spp_payment_id = spp.id AND r.tenant_id = spp.tenant_id
        WHERE r.status = 'COMPLETED'
        GROUP BY spp.student_id, r.tenant_id
    ) r ON s.id = r.student_id AND s.tenant_id = r.tenant_id
    WHERE psl.parent_id = v_parent_id AND psl.tenant_id = p_tenant_id AND psl.status = 'active';

    v_result := jsonb_build_object(
        'success', true,
        'parent_id', v_parent_id,
        'students', COALESCE(v_linked_students, '[]'::jsonb)
    );

    RETURN v_result;
END;
$$;

-- Grant execution permissions strictly to authenticated users
REVOKE EXECUTE ON FUNCTION public.pos_checkout_spp_atomic FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_refund_spp_payment FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_verify_spp_payment FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.parent_get_billing FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pos_checkout_spp_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_spp_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_spp_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_get_billing TO authenticated;

-- =============================================================================
-- END OF PL/pgSQL ROUTINES SCRIPT
-- =============================================================================
