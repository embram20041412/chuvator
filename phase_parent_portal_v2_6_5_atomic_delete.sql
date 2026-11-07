-- Phase Parent Portal V2.6.5: Atomic Database Deletion RPC with TEXT tenant_id and strict row locking & error sanitization

CREATE OR REPLACE FUNCTION public.parent_portal_atomic_delete(
    p_tenant_id TEXT,
    p_parent_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    deleted_links_count INT,
    deleted_parent_count INT,
    error_code TEXT,
    error_message TEXT
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_links_count INT := 0;
    v_parent_count INT := 0;
    v_locked_id UUID;
BEGIN
    -- Validate input parameters
    IF p_tenant_id IS NULL OR btrim(p_tenant_id) = '' OR p_parent_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'INVALID_PARAMETERS'::TEXT, 'Parameter tenant_id dan parent_id tidak boleh kosong.'::TEXT;
        RETURN;
    END IF;

    -- Lock parent row with SELECT ... FOR UPDATE to ensure isolation and consistent state
    SELECT id INTO v_locked_id
    FROM public.parent_accounts
    WHERE id = p_parent_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_locked_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'PARENT_NOT_FOUND'::TEXT, 'Akun wali murid tidak ditemukan atau tidak sesuai dengan tenant.'::TEXT;
        RETURN;
    END IF;

    -- 1. Delete dependent parent_student_links
    WITH deleted_links AS (
        DELETE FROM public.parent_student_links
        WHERE parent_account_id = p_parent_id AND tenant_id = p_tenant_id
        RETURNING id
    )
    SELECT count(*) INTO v_links_count FROM deleted_links;

    -- 2. Delete parent_accounts record
    WITH deleted_parent AS (
        DELETE FROM public.parent_accounts
        WHERE id = p_parent_id AND tenant_id = p_tenant_id
        RETURNING id
    )
    SELECT count(*) INTO v_parent_count FROM deleted_parent;

    IF v_parent_count <> 1 THEN
        RAISE EXCEPTION 'ATOMIC_DELETE_VERIFICATION_FAILED';
    END IF;

    RETURN QUERY SELECT TRUE, v_links_count, v_parent_count, NULL::TEXT, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
    -- Rollback and return sanitized generic error without leaking internal details
    RETURN QUERY SELECT FALSE, 0, 0, 'DATABASE_TRANSACTION_FAILED'::TEXT, 'Gagal menghapus data secara atomik di database.'::TEXT;
END;
$$;

-- Security hardening: Revoke and Grant EXECUTE permissions
REVOKE EXECUTE ON FUNCTION public.parent_portal_atomic_delete(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.parent_portal_atomic_delete(TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.parent_portal_atomic_delete(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.parent_portal_atomic_delete(TEXT, UUID) TO service_role;
