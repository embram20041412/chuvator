-- ============================================================================
-- CHUVATOR PARENT PORTAL V3.3 — FULL RPC SCRIPT FOR CREATE_PARENT_INVITATION
-- File: patch_invitation_rpc_owner_fix.sql
-- Description: Complete PL/pgSQL function wrapper for create_parent_invitation with
--              Tenant Owner RBAC fallback and Primary Key Index Optimization.
--              Ready to copy-paste directly into Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_parent_invitation(
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
    WHERE tenant_id = p_tenant_id
      AND parent_account_id = v_parent_id
      AND status = 'pending';

    -- Lock order 3: Invalidate active continuation tickets linked to expired invitations
    UPDATE public.parent_continuation_tickets
    SET status = 'invalidated'
    WHERE tenant_id = p_tenant_id
      AND parent_account_id = v_parent_id
      AND status = 'active';

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

REVOKE ALL ON FUNCTION public.create_parent_invitation(TEXT, UUID, TEXT, UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_parent_invitation(TEXT, UUID, TEXT, UUID, TEXT, INT) TO service_role;
