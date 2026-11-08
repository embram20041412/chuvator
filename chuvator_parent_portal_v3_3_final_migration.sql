-- ============================================================================
-- CHUVATOR PARENT PORTAL V3.3 — FINAL CONSOLIDATED MIGRATION SCRIPT
-- Target Environment: Supabase STAGING / PRODUCTION (PostgreSQL 15+)
-- File Name: chuvator_parent_portal_v3_3_final_migration.sql
-- Mode: TRANSACTIONAL MIGRATION EXECUTION
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: ATOMIC IN-TRANSACTION PREFLIGHT VALIDATION (FAIL-CLOSED)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_has_composite_key BOOLEAN := FALSE;
    v_old_constraint_valid BOOLEAN := FALSE;
    v_inv_table_exists BOOLEAN := FALSE;
    v_tkt_table_exists BOOLEAN := FALSE;
    v_func_count INT := 0;
BEGIN
    -- Step 1.1: Verify extensions.digest and extensions.gen_random_bytes availability
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p 
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'extensions' AND p.proname = 'digest'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p 
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'extensions' AND p.proname = 'gen_random_bytes'
    ) THEN
        RAISE EXCEPTION 'PREFLIGHT_FAILED: Required extensions.digest() and extensions.gen_random_bytes() functions not found.';
    END IF;

    -- Step 1.2: Structural preflight check for composite unique key (tenant_id, id) on parent_accounts
    SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON c.conrelid = t.oid
        JOIN pg_catalog.pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'parent_accounts'
          AND c.contype IN ('u', 'p')
          AND ARRAY(
              SELECT a.attname::text
              FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
              ORDER BY k.ord
          ) = ARRAY['tenant_id', 'id']::text[]
    ) INTO v_has_composite_key;

    IF NOT v_has_composite_key THEN
        SELECT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_index i
            JOIN pg_catalog.pg_class t ON i.indrelid = t.oid
            JOIN pg_catalog.pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public'
              AND t.relname = 'parent_accounts'
              AND i.indisunique = TRUE
              AND ARRAY(
                  SELECT a.attname::text
                  FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
                  JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
                  ORDER BY k.ord
              ) = ARRAY['tenant_id', 'id']::text[]
        ) INTO v_has_composite_key;
    END IF;

    IF NOT v_has_composite_key THEN
        RAISE EXCEPTION 'PREFLIGHT_FAILED: public.parent_accounts MUST have a unique constraint or index with exact column sequence (tenant_id, id).';
    END IF;

    -- Step 1.3: Fail-closed check for table collision
    SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'parent_invitations') INTO v_inv_table_exists;
    SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'parent_continuation_tickets') INTO v_tkt_table_exists;

    IF v_inv_table_exists OR v_tkt_table_exists THEN
        RAISE EXCEPTION 'PREFLIGHT_FAILED: Table collision detected. parent_invitations or parent_continuation_tickets already exists.';
    END IF;

    -- Step 1.4: Fail-closed check for RPC collisions
    SELECT COUNT(*) INTO v_func_count
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_parent_invitation',
        'get_parent_invitation_info',
        'create_parent_continuation_ticket',
        'claim_parent_invitation_by_ticket',
        'revoke_parent_invitation',
        'recover_parent_session'
      );

    IF v_func_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT_FAILED: Function collision detected. One or more Parent Portal V3 RPC signatures already exist.';
    END IF;

    -- Step 1.5: Fail-closed check for index collisions
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid 
        WHERE n.nspname = 'public' AND c.relname IN (
            'idx_uq_parent_accounts_tenant_lower_email',
            'idx_parent_invitations_single_pending',
            'idx_tickets_single_active',
            'idx_tickets_active_lookup'
        )
    ) THEN
        RAISE EXCEPTION 'PREFLIGHT_FAILED: Index collision detected. One or more V3 indexes already exist.';
    END IF;

    -- Step 1.6: Exact structural verification of existing chk_parent_accounts_status constraint definition
    SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class rel ON con.conrelid = rel.oid
        JOIN pg_catalog.pg_namespace nsp ON rel.relnamespace = nsp.oid
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'parent_accounts'
          AND con.conname = 'chk_parent_accounts_status'
          AND con.contype = 'c'
          AND con.convalidated = TRUE
          AND pg_catalog.pg_get_constraintdef(con.oid) = 'CHECK ((status = ANY (ARRAY[''pending''::text, ''active''::text, ''suspended''::text])))'
    ) INTO v_old_constraint_valid;

    IF NOT v_old_constraint_valid THEN
        RAISE EXCEPTION 'PREFLIGHT_FAILED: Existing constraint chk_parent_accounts_status does not match exact expected baseline definition.';
    END IF;

    RAISE NOTICE 'PREFLIGHT SUCCESSFUL: Baseline criteria, extension functions, composite unique key, and collision guards verified.';
END $$;


-- ----------------------------------------------------------------------------
-- STEP 2: DDL, INDEXES, COMPOSITE UNIQUE KEYS & FOREIGN KEYS
-- ----------------------------------------------------------------------------

-- 2.1 Unique partial index for parent_accounts (tenant_id, lower(email))
CREATE UNIQUE INDEX idx_uq_parent_accounts_tenant_lower_email
ON public.parent_accounts (tenant_id, LOWER(email));

-- 2.2 Table: parent_invitations (With explicit student_id binding)
CREATE TABLE public.parent_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    parent_account_id UUID NOT NULL,
    student_id UUID NOT NULL,
    invitation_token_hash TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoked_by UUID NULL,
    revocation_reason TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'revoked')),
    -- FK 1: Composite reference to parent_accounts
    CONSTRAINT fk_parent_invitations_parent_account
        FOREIGN KEY (tenant_id, parent_account_id)
        REFERENCES public.parent_accounts (tenant_id, id)
        ON DELETE CASCADE,
    -- FK 2: Composite reference to students
    CONSTRAINT fk_parent_invitations_student
        FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students (tenant_id, id)
        ON DELETE CASCADE,
    -- Supporting composite unique key for child FK reference
    CONSTRAINT uq_parent_invitations_tenant_id_id_parent
        UNIQUE (tenant_id, id, parent_account_id)
);

CREATE UNIQUE INDEX idx_parent_invitations_single_pending
ON public.parent_invitations (tenant_id, parent_account_id)
WHERE status = 'pending';

-- 2.3 Table: parent_continuation_tickets
CREATE TABLE public.parent_continuation_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    invitation_id UUID NOT NULL,
    parent_account_id UUID NOT NULL,
    ticket_token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired', 'invalidated')),
    -- FK 1: Composite reference to parent_invitations (tenant_id, id, parent_account_id)
    CONSTRAINT fk_tickets_invitation
        FOREIGN KEY (tenant_id, invitation_id, parent_account_id)
        REFERENCES public.parent_invitations (tenant_id, id, parent_account_id)
        ON DELETE CASCADE,
    -- FK 2: Composite reference to parent_accounts (tenant_id, id)
    CONSTRAINT fk_tickets_parent_account
        FOREIGN KEY (tenant_id, parent_account_id)
        REFERENCES public.parent_accounts (tenant_id, id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_tickets_single_active
ON public.parent_continuation_tickets (tenant_id, parent_account_id)
WHERE status = 'active';

CREATE INDEX idx_tickets_active_lookup
ON public.parent_continuation_tickets (ticket_token_hash)
WHERE status = 'active';


-- ----------------------------------------------------------------------------
-- STEP 3: ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ----------------------------------------------------------------------------
ALTER TABLE public.parent_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_invitations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.parent_continuation_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_continuation_tickets FORCE ROW LEVEL SECURITY;

-- Explicitly revoke direct REST table access from PUBLIC, anon, and authenticated
REVOKE ALL ON TABLE public.parent_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.parent_continuation_tickets FROM PUBLIC, anon, authenticated;

-- Deny all policies for PUBLIC
DROP POLICY IF EXISTS deny_all_parent_invitations ON public.parent_invitations;
CREATE POLICY deny_all_parent_invitations ON public.parent_invitations
FOR ALL TO PUBLIC USING (FALSE);

DROP POLICY IF EXISTS deny_all_parent_continuation_tickets ON public.parent_continuation_tickets;
CREATE POLICY deny_all_parent_continuation_tickets ON public.parent_continuation_tickets
FOR ALL TO PUBLIC USING (FALSE);


-- ----------------------------------------------------------------------------
-- STEP 4: RPC ROUTINES IMPLEMENTATION (SECURITY DEFINER, SET search_path = '')
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- RPC 1: create_parent_invitation (Explicit student_id binding)
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.create_parent_invitation(
    p_tenant_id TEXT,
    p_actor_uid UUID,
    p_parent_email TEXT,
    p_target_student_id UUID,
    p_relationship TEXT DEFAULT 'guardian',
    p_expiry_days INT DEFAULT 7
)
RETURNS TABLE (
    invitation_id UUID,
    raw_invitation_token TEXT,
    parent_account_id UUID,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_email TEXT;
    v_relationship TEXT;
    v_staff_role TEXT := NULL;
    v_parent_id UUID;
    v_parent_status TEXT;
    v_inv_id UUID;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    IF p_tenant_id IS NULL OR pg_catalog.btrim(p_tenant_id) = '' THEN
        RAISE EXCEPTION 'INVALID_TENANT_ID';
    END IF;

    IF p_actor_uid IS NULL THEN
        RAISE EXCEPTION 'INVALID_ACTOR_UID';
    END IF;

    IF p_parent_email IS NULL OR pg_catalog.btrim(p_parent_email) = '' THEN
        RAISE EXCEPTION 'INVALID_PARENT_EMAIL';
    END IF;

    IF p_target_student_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_TARGET_STUDENT_ID';
    END IF;

    -- Validate relationship parameter
    v_relationship := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_relationship, 'guardian')));
    IF v_relationship NOT IN ('father', 'mother', 'guardian', 'other') THEN
        RAISE EXCEPTION 'INVALID_RELATIONSHIP';
    END IF;

    -- Validate expiry days
    IF p_expiry_days IS NOT NULL AND (p_expiry_days < 1 OR p_expiry_days > 30) THEN
        RAISE EXCEPTION 'INVALID_EXPIRY_DAYS';
    END IF;

    v_clean_email := pg_catalog.lower(pg_catalog.btrim(p_parent_email));

    -- 1. Cek di tabel users_staff terlebih dahulu
    SELECT s.role INTO v_staff_role 
    FROM public.users_staff s
    WHERE s.uid = p_actor_uid::text 
      AND s.tenant_id = p_tenant_id::text 
      AND (s.status IS NULL OR s.status = 'active');

    -- 2. Fallback: Cek di tabel tenants jika user adalah Owner
    -- Optimasi Indeks: Menggunakan p_tenant_id::uuid agar index PK t.id bekerja maksimal
    IF v_staff_role IS NULL THEN
        SELECT 'owner' INTO v_staff_role 
        FROM public.tenants t
        WHERE t.id = p_tenant_id::uuid 
          AND t.owner_uid = p_actor_uid::text;
    END IF;

    -- 3. Tolak jika tetap tidak ditemukan
    IF v_staff_role IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED_STAFF_ACTOR_OR_TENANT_MISMATCH' USING ERRCODE = 'P0001';
    END IF;

    -- Validate student existence in tenant
    IF NOT EXISTS (
        SELECT 1 FROM public.students st
        WHERE st.tenant_id = p_tenant_id AND st.id = p_target_student_id
    ) THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND_IN_TENANT';
    END IF;

    -- Lock order 1: Lock parent_accounts
    SELECT pa.id, pa.status INTO v_parent_id, v_parent_status
    FROM public.parent_accounts pa
    WHERE pa.tenant_id = p_tenant_id AND pg_catalog.lower(pa.email) = v_clean_email
    FOR UPDATE;

    IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_NOT_FOUND_OR_UNBOUND';
    END IF;

    IF v_parent_status = 'suspended' THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_SUSPENDED';
    END IF;

    IF v_parent_status NOT IN ('pending', 'active') THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_INVALID_STATUS';
    END IF;

    -- Lock order 2: Lock & expire previous pending invitations for this parent
    UPDATE public.parent_invitations
    SET status = 'expired'
    WHERE parent_invitations.tenant_id = p_tenant_id
      AND parent_invitations.parent_account_id = v_parent_id
      AND parent_invitations.status = 'pending';

    -- Lock order 3: Invalidate active continuation tickets linked to expired invitations
    UPDATE public.parent_continuation_tickets
    SET status = 'invalidated'
    WHERE parent_continuation_tickets.tenant_id = p_tenant_id
      AND parent_continuation_tickets.parent_account_id = v_parent_id
      AND parent_continuation_tickets.status = 'active';

    -- Generate secure invitation token
    v_raw_token := 'inv_' || pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := pg_catalog.encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
    v_expires_at := v_now + (COALESCE(p_expiry_days, 7) || ' days')::pg_catalog.interval;

    INSERT INTO public.parent_invitations (
        tenant_id,
        parent_account_id,
        student_id,
        invitation_token_hash,
        created_by,
        created_at,
        expires_at,
        status
    ) VALUES (
        p_tenant_id,
        v_parent_id,
        p_target_student_id,
        v_token_hash,
        p_actor_uid,
        v_now,
        v_expires_at,
        'pending'
    )
    RETURNING id INTO v_inv_id;

    -- Link student using relationship parameter
    IF NOT EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.tenant_id = p_tenant_id
          AND psl.parent_account_id = v_parent_id
          AND psl.student_id = p_target_student_id
    ) THEN
        INSERT INTO public.parent_student_links (
            tenant_id,
            parent_account_id,
            student_id,
            relationship,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_tenant_id,
            v_parent_id,
            p_target_student_id,
            v_relationship,
            'pending',
            v_now,
            v_now
        );
    END IF;

    RETURN QUERY
    SELECT 
        v_inv_id AS invitation_id,
        v_raw_token AS raw_invitation_token,
        v_parent_id AS parent_account_id,
        v_expires_at AS expires_at;
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 2: get_parent_invitation_info
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.get_parent_invitation_info(
    p_raw_invitation_token TEXT
)
RETURNS TABLE (
    invitation_id UUID,
    tenant_id TEXT,
    parent_account_id UUID,
    masked_email TEXT,
    invitation_status TEXT,
    expires_at TIMESTAMPTZ,
    is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_hash TEXT;
    v_inv RECORD;
    v_masked TEXT;
    v_email_name TEXT;
    v_email_domain TEXT;
BEGIN
    IF p_raw_invitation_token IS NULL OR pg_catalog.btrim(p_raw_invitation_token) = '' OR pg_catalog.length(pg_catalog.btrim(p_raw_invitation_token)) < 32 THEN
        RETURN QUERY SELECT NULL::UUID AS invitation_id, NULL::TEXT AS tenant_id, NULL::UUID AS parent_account_id, NULL::TEXT AS masked_email, 'invalid'::TEXT AS invitation_status, NULL::TIMESTAMPTZ AS expires_at, FALSE AS is_valid;
        RETURN;
    END IF;

    v_token_hash := pg_catalog.encode(extensions.digest(pg_catalog.btrim(p_raw_invitation_token), 'sha256'), 'hex');

    SELECT 
        i.id AS inv_id,
        i.tenant_id AS inv_tenant_id,
        i.parent_account_id AS inv_parent_account_id,
        pa.email AS raw_email,
        i.status AS inv_status,
        i.expires_at AS inv_expires_at
    INTO v_inv
    FROM public.parent_invitations i
    JOIN public.parent_accounts pa ON i.tenant_id = pa.tenant_id AND i.parent_account_id = pa.id
    WHERE i.invitation_token_hash = v_token_hash;

    IF v_inv.inv_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID AS invitation_id, NULL::TEXT AS tenant_id, NULL::UUID AS parent_account_id, NULL::TEXT AS masked_email, 'invalid'::TEXT AS invitation_status, NULL::TIMESTAMPTZ AS expires_at, FALSE AS is_valid;
        RETURN;
    END IF;

    v_email_name := pg_catalog.split_part(v_inv.raw_email, '@', 1);
    v_email_domain := pg_catalog.split_part(v_inv.raw_email, '@', 2);
    
    IF pg_catalog.length(v_email_name) > 2 THEN
        v_masked := pg_catalog.substr(v_email_name, 1, 1) || '***' || pg_catalog.substr(v_email_name, pg_catalog.length(v_email_name), 1) || '@' || v_email_domain;
    ELSE
        v_masked := pg_catalog.substr(v_email_name, 1, 1) || '***@' || v_email_domain;
    END IF;

    RETURN QUERY
    SELECT 
        v_inv.inv_id AS invitation_id,
        v_inv.inv_tenant_id AS tenant_id,
        v_inv.inv_parent_account_id AS parent_account_id,
        v_masked AS masked_email,
        v_inv.inv_status AS invitation_status,
        v_inv.inv_expires_at AS expires_at,
        (v_inv.inv_status = 'pending' AND v_inv.inv_expires_at > pg_catalog.now()) AS is_valid;
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 3: create_parent_continuation_ticket
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.create_parent_continuation_ticket(
    p_raw_invitation_token TEXT,
    p_tenant_id TEXT,
    p_auth_uid UUID
)
RETURNS TABLE (
    ticket_id UUID,
    raw_ticket_token TEXT,
    parent_account_id UUID,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv_hash TEXT;
    v_inv_peek RECORD;
    v_inv RECORD;
    v_parent RECORD;
    v_ticket_id UUID;
    v_raw_ticket TEXT;
    v_ticket_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_hourly_ticket_count INT;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    IF p_raw_invitation_token IS NULL OR pg_catalog.btrim(p_raw_invitation_token) = '' OR pg_catalog.length(pg_catalog.btrim(p_raw_invitation_token)) < 32 THEN
        RAISE EXCEPTION 'INVITATION_TOKEN_ENTROPY_INSUFFICIENT';
    END IF;

    IF p_tenant_id IS NULL OR pg_catalog.btrim(p_tenant_id) = '' THEN
        RAISE EXCEPTION 'INVALID_TENANT_ID';
    END IF;

    IF p_auth_uid IS NULL THEN
        RAISE EXCEPTION 'INVALID_AUTH_UID';
    END IF;

    v_inv_hash := pg_catalog.encode(extensions.digest(pg_catalog.btrim(p_raw_invitation_token), 'sha256'), 'hex');

    -- Initial peek lookup
    SELECT i.id, i.tenant_id, i.parent_account_id, i.student_id, i.status, i.expires_at
    INTO v_inv_peek
    FROM public.parent_invitations i
    WHERE i.invitation_token_hash = v_inv_hash;

    IF v_inv_peek.id IS NULL THEN
        RAISE EXCEPTION 'INVITATION_NOT_FOUND';
    END IF;

    IF v_inv_peek.tenant_id <> p_tenant_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH';
    END IF;

    -- LOCK ORDER 1: Lock parent_accounts
    SELECT pa.id, pa.status, pa.auth_uid, pa.email
    INTO v_parent
    FROM public.parent_accounts pa
    WHERE pa.tenant_id = v_inv_peek.tenant_id
      AND pa.id = v_inv_peek.parent_account_id
    FOR UPDATE;

    IF v_parent.id IS NULL THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_NOT_FOUND';
    END IF;

    IF v_parent.status = 'suspended' THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_SUSPENDED';
    END IF;

    IF v_parent.status NOT IN ('pending', 'active') THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_INVALID_STATUS';
    END IF;

    -- Strict Auth UID binding check
    IF v_parent.auth_uid IS DISTINCT FROM p_auth_uid THEN
        RAISE EXCEPTION 'AUTH_UID_MISMATCH_WITH_EXISTING_BINDING';
    END IF;

    -- Verify Auth user email confirmation and email match
    IF NOT EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = p_auth_uid
          AND u.email_confirmed_at IS NOT NULL
          AND pg_catalog.lower(u.email) = pg_catalog.lower(v_parent.email)
    ) THEN
        RAISE EXCEPTION 'EMAIL_NOT_VERIFIED_OR_MISMATCH';
    END IF;

    -- Rate limiting check: Max 5 tickets per hour per parent/tenant
    SELECT pg_catalog.count(*)::INT INTO v_hourly_ticket_count
    FROM public.parent_continuation_tickets t
    WHERE t.tenant_id = v_inv_peek.tenant_id
      AND t.parent_account_id = v_inv_peek.parent_account_id
      AND t.created_at >= (v_now - pg_catalog.interval '1 hour');

    IF v_hourly_ticket_count >= 5 THEN
        RAISE EXCEPTION 'TICKET_RATE_LIMIT_EXCEEDED';
    END IF;

    -- LOCK ORDER 2: Lock parent_invitations and revalidate
    SELECT i.id, i.tenant_id, i.parent_account_id, i.student_id, i.status, i.expires_at
    INTO v_inv
    FROM public.parent_invitations i
    WHERE i.id = v_inv_peek.id
    FOR UPDATE;

    IF v_inv.status <> 'pending' THEN
        RAISE EXCEPTION 'INVITATION_NOT_PENDING';
    END IF;

    IF v_inv.expires_at <= v_now THEN
        UPDATE public.parent_invitations SET status = 'expired' WHERE id = v_inv.id;
        RAISE EXCEPTION 'INVITATION_EXPIRED';
    END IF;

    -- LOCK ORDER 3: Lock & invalidate active continuation tickets
    UPDATE public.parent_continuation_tickets
    SET status = 'invalidated'
    WHERE tenant_id = v_inv.tenant_id
      AND parent_account_id = v_inv.parent_account_id
      AND status = 'active';

    -- Generate ticket (15 min expiry capped at invitation.expires_at)
    v_raw_ticket := 'tkt_' || pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
    v_ticket_hash := pg_catalog.encode(extensions.digest(v_raw_ticket, 'sha256'), 'hex');
    v_expires_at := LEAST(v_now + pg_catalog.interval '15 minutes', v_inv.expires_at);

    INSERT INTO public.parent_continuation_tickets (
        tenant_id,
        invitation_id,
        parent_account_id,
        ticket_token_hash,
        created_at,
        expires_at,
        status
    ) VALUES (
        v_inv.tenant_id,
        v_inv.id,
        v_inv.parent_account_id,
        v_ticket_hash,
        v_now,
        v_expires_at,
        'active'
    )
    RETURNING id INTO v_ticket_id;

    RETURN QUERY
    SELECT 
        v_ticket_id AS ticket_id,
        v_raw_ticket AS raw_ticket_token,
        v_inv.parent_account_id AS parent_account_id,
        v_expires_at AS expires_at;
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 4: claim_parent_invitation_by_ticket (Targeted student_id link activation)
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.claim_parent_invitation_by_ticket(
    p_raw_ticket_token TEXT,
    p_auth_uid UUID
)
RETURNS TABLE (
    success BOOLEAN,
    tenant_id TEXT,
    parent_account_id UUID,
    claimed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ticket_hash TEXT;
    v_tkt_peek RECORD;
    v_ticket RECORD;
    v_inv RECORD;
    v_parent RECORD;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    IF p_raw_ticket_token IS NULL OR pg_catalog.btrim(p_raw_ticket_token) = '' OR pg_catalog.length(pg_catalog.btrim(p_raw_ticket_token)) < 32 THEN
        RAISE EXCEPTION 'TICKET_TOKEN_ENTROPY_INSUFFICIENT';
    END IF;

    IF p_auth_uid IS NULL THEN
        RAISE EXCEPTION 'INVALID_AUTH_UID';
    END IF;

    v_ticket_hash := pg_catalog.encode(extensions.digest(pg_catalog.btrim(p_raw_ticket_token), 'sha256'), 'hex');

    -- Initial peek lookup
    SELECT t.id, t.tenant_id, t.invitation_id, t.parent_account_id, t.status, t.expires_at
    INTO v_tkt_peek
    FROM public.parent_continuation_tickets t
    WHERE t.ticket_token_hash = v_ticket_hash;

    IF v_tkt_peek.id IS NULL THEN
        RAISE EXCEPTION 'TICKET_NOT_FOUND';
    END IF;

    -- LOCK ORDER 1: Lock parent_accounts
    SELECT pa.id, pa.status, pa.auth_uid
    INTO v_parent
    FROM public.parent_accounts pa
    WHERE pa.tenant_id = v_tkt_peek.tenant_id
      AND pa.id = v_tkt_peek.parent_account_id
    FOR UPDATE;

    IF v_parent.id IS NULL THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_NOT_FOUND';
    END IF;

    IF v_parent.status = 'suspended' THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_SUSPENDED';
    END IF;

    IF v_parent.status NOT IN ('pending', 'active') THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_INVALID_STATUS';
    END IF;

    -- Strict Auth UID binding verification
    IF v_parent.auth_uid IS DISTINCT FROM p_auth_uid THEN
        RAISE EXCEPTION 'AUTH_UID_MISMATCH_WITH_EXISTING_BINDING';
    END IF;

    -- LOCK ORDER 2: Lock parent_invitations & validate pending status, relation match, and fetch student_id
    SELECT i.id, i.tenant_id, i.parent_account_id, i.student_id, i.status, i.expires_at
    INTO v_inv
    FROM public.parent_invitations i
    WHERE i.id = v_tkt_peek.invitation_id
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'INVITATION_NOT_FOUND';
    END IF;

    IF v_inv.tenant_id <> v_tkt_peek.tenant_id OR v_inv.parent_account_id <> v_tkt_peek.parent_account_id THEN
        RAISE EXCEPTION 'INVITATION_TICKET_RELATION_MISMATCH';
    END IF;

    IF v_inv.status <> 'pending' THEN
        RAISE EXCEPTION 'INVITATION_NOT_PENDING';
    END IF;

    IF v_inv.expires_at <= v_now THEN
        UPDATE public.parent_invitations SET status = 'expired' WHERE id = v_inv.id;
        RAISE EXCEPTION 'INVITATION_EXPIRED';
    END IF;

    -- LOCK ORDER 3: Lock parent_continuation_tickets and revalidate
    SELECT t.id, t.tenant_id, t.invitation_id, t.parent_account_id, t.status, t.expires_at
    INTO v_ticket
    FROM public.parent_continuation_tickets t
    WHERE t.id = v_tkt_peek.id
    FOR UPDATE;

    IF v_ticket.status <> 'active' THEN
        RAISE EXCEPTION 'TICKET_NOT_ACTIVE';
    END IF;

    IF v_ticket.expires_at <= v_now THEN
        UPDATE public.parent_continuation_tickets SET status = 'expired' WHERE id = v_ticket.id;
        RAISE EXCEPTION 'TICKET_EXPIRED';
    END IF;

    -- State updates
    UPDATE public.parent_invitations
    SET status = 'claimed',
        claimed_at = v_now
    WHERE id = v_ticket.invitation_id;

    UPDATE public.parent_accounts
    SET status = 'active',
        activated_at = v_now,
        updated_at = v_now
    WHERE tenant_id = v_ticket.tenant_id
      AND id = v_ticket.parent_account_id;

    -- CRITICAL SECURITY FIX: Activate ONLY the parent_student_link bound to this invitation's student_id
    UPDATE public.parent_student_links
    SET status = 'active',
        verified_at = v_now,
        updated_at = v_now
    WHERE tenant_id = v_ticket.tenant_id
      AND parent_account_id = v_ticket.parent_account_id
      AND student_id = v_inv.student_id
      AND status = 'pending';

    UPDATE public.parent_continuation_tickets
    SET status = 'claimed',
        claimed_at = v_now
    WHERE id = v_ticket.id;

    RETURN QUERY
    SELECT 
        TRUE AS success,
        v_ticket.tenant_id AS tenant_id,
        v_ticket.parent_account_id AS parent_account_id,
        v_now AS claimed_at;
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 5: revoke_parent_invitation
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.revoke_parent_invitation(
    p_tenant_id TEXT,
    p_actor_uid UUID,
    p_invitation_id_or_token TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
    invitation_id UUID,
    status TEXT,
    revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_staff_exists BOOLEAN;
    v_token_hash TEXT;
    v_inv_peek RECORD;
    v_inv RECORD;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    IF p_tenant_id IS NULL OR pg_catalog.btrim(p_tenant_id) = '' THEN
        RAISE EXCEPTION 'INVALID_TENANT_ID';
    END IF;

    IF p_actor_uid IS NULL THEN
        RAISE EXCEPTION 'INVALID_ACTOR_UID';
    END IF;

    IF p_invitation_id_or_token IS NULL OR pg_catalog.btrim(p_invitation_id_or_token) = '' THEN
        RAISE EXCEPTION 'INVALID_INVITATION_IDENTIFIER';
    END IF;

    -- Validate staff authorization and tenant binding
    SELECT EXISTS (
        SELECT 1 FROM public.users_staff s
        WHERE s.uid = p_actor_uid::pg_catalog.text
          AND s.tenant_id = p_tenant_id
    ) INTO v_staff_exists;

    IF NOT v_staff_exists THEN
        RAISE EXCEPTION 'UNAUTHORIZED_STAFF_ACTOR_OR_TENANT_MISMATCH';
    END IF;

    -- Identify invitation
    IF p_invitation_id_or_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT i.id, i.tenant_id, i.parent_account_id INTO v_inv_peek
        FROM public.parent_invitations i
        WHERE i.id = p_invitation_id_or_token::UUID AND i.tenant_id = p_tenant_id;
    ELSE
        v_token_hash := pg_catalog.encode(extensions.digest(pg_catalog.btrim(p_invitation_id_or_token), 'sha256'), 'hex');
        SELECT i.id, i.tenant_id, i.parent_account_id INTO v_inv_peek
        FROM public.parent_invitations i
        WHERE i.invitation_token_hash = v_token_hash AND i.tenant_id = p_tenant_id;
    END IF;

    IF v_inv_peek.id IS NULL THEN
        RAISE EXCEPTION 'INVITATION_NOT_FOUND';
    END IF;

    -- LOCK ORDER 1: Lock parent_accounts
    PERFORM 1 FROM public.parent_accounts pa
    WHERE pa.tenant_id = v_inv_peek.tenant_id AND pa.id = v_inv_peek.parent_account_id
    FOR UPDATE;

    -- LOCK ORDER 2: Lock parent_invitations and revalidate pending status
    SELECT i.id, i.status INTO v_inv
    FROM public.parent_invitations i
    WHERE i.id = v_inv_peek.id AND i.tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_inv.status <> 'pending' THEN
        RAISE EXCEPTION 'INVITATION_NOT_PENDING_OR_ALREADY_PROCESSED';
    END IF;

    -- Perform revocation
    UPDATE public.parent_invitations
    SET status = 'revoked',
        revoked_at = v_now,
        revoked_by = p_actor_uid,
        revocation_reason = p_reason
    WHERE id = v_inv_peek.id AND tenant_id = p_tenant_id;

    -- LOCK ORDER 3: Lock & invalidate tickets
    UPDATE public.parent_continuation_tickets
    SET status = 'invalidated'
    WHERE invitation_id = v_inv_peek.id AND tenant_id = p_tenant_id AND status = 'active';

    RETURN QUERY
    SELECT 
        v_inv_peek.id AS invitation_id,
        'revoked'::TEXT AS status,
        v_now AS revoked_at;
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 6: recover_parent_session (ACTIVE PARENTS ONLY)
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.recover_parent_session(
    p_auth_uid UUID,
    p_tenant_id TEXT
)
RETURNS TABLE (
    parent_account_id UUID,
    tenant_id TEXT,
    email TEXT,
    status TEXT,
    student_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_parent RECORD;
    v_count INT;
BEGIN
    IF p_auth_uid IS NULL THEN
        RAISE EXCEPTION 'INVALID_AUTH_UID';
    END IF;

    IF p_tenant_id IS NULL OR pg_catalog.btrim(p_tenant_id) = '' THEN
        RAISE EXCEPTION 'INVALID_TENANT_ID';
    END IF;

    SELECT pa.id, pa.tenant_id, pa.email, pa.status
    INTO v_parent
    FROM public.parent_accounts pa
    WHERE pa.auth_uid = p_auth_uid AND pa.tenant_id = p_tenant_id;

    IF v_parent.id IS NULL THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_NOT_FOUND';
    END IF;

    IF v_parent.status = 'suspended' THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_SUSPENDED';
    END IF;

    IF v_parent.status <> 'active' THEN
        RAISE EXCEPTION 'PARENT_ACCOUNT_NOT_ACTIVE';
    END IF;

    SELECT pg_catalog.count(*)::INT INTO v_count
    FROM public.parent_student_links psl
    WHERE psl.tenant_id = p_tenant_id AND psl.parent_account_id = v_parent.id AND psl.status = 'active';

    RETURN QUERY
    SELECT 
        v_parent.id AS parent_account_id,
        v_parent.tenant_id AS tenant_id,
        v_parent.email AS email,
        v_parent.status AS status,
        v_count AS student_count;
END;
$$;


-- ----------------------------------------------------------------------------
-- STEP 5: GRANT RPC EXECUTE PERMISSIONS EXCLUSIVELY TO SERVICE_ROLE
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_parent_invitation(TEXT, UUID, TEXT, UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_parent_invitation_info(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_parent_continuation_ticket(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_parent_invitation_by_ticket(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_parent_invitation(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_parent_session(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_parent_invitation(TEXT, UUID, TEXT, UUID, TEXT, INT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_invitation_info(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_parent_continuation_ticket(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_parent_invitation_by_ticket(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_parent_invitation(TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_parent_session(UUID, TEXT) TO service_role;

COMMIT;

-- ============================================================================
-- END OF MAIN TRANSACTIONAL MIGRATION
-- ============================================================================
