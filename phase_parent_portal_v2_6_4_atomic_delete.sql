-- Phase Parent Portal V2.6.4: Atomic Database Deletion RPC
-- Executes atomic deletion of parent_student_links and parent_accounts within a single transaction.

CREATE OR REPLACE FUNCTION public.parent_portal_atomic_delete(
    p_tenant_id UUID,
    p_parent_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    deleted_links_count INT,
    deleted_parent_id UUID,
    error_message TEXT
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_links_count INT := 0;
    v_parent_exists BOOLEAN := FALSE;
BEGIN
    -- Validate input parameters
    IF p_tenant_id IS NULL OR p_parent_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, NULL::UUID, 'Invalid parameters: tenant_id and parent_id cannot be null.'::TEXT;
        RETURN;
    END IF;

    -- Check if parent account exists and matches tenant
    SELECT EXISTS (
        SELECT 1 FROM public.parent_accounts
        WHERE id = p_parent_id AND tenant_id = p_tenant_id
    ) INTO v_parent_exists;

    IF NOT v_parent_exists THEN
        RETURN QUERY SELECT FALSE, 0, NULL::UUID, 'Parent account not found or tenant mismatch.'::TEXT;
        RETURN;
    END IF;

    -- 1. Delete dependent parent_student_links first
    WITH deleted_links AS (
        DELETE FROM public.parent_student_links
        WHERE parent_account_id = p_parent_id AND tenant_id = p_tenant_id
        RETURNING id
    )
    SELECT count(*) INTO v_links_count FROM deleted_links;

    -- 2. Delete parent_accounts record
    DELETE FROM public.parent_accounts
    WHERE id = p_parent_id AND tenant_id = p_tenant_id;

    -- Return success result
    RETURN QUERY SELECT TRUE, v_links_count, p_parent_id, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
    -- Automatic transaction rollback on any error
    RETURN QUERY SELECT FALSE, 0, NULL::UUID, SQLERRM::TEXT;
END;
$$;

-- Security hardening: Revoke and Grant EXECUTE permissions
REVOKE EXECUTE ON FUNCTION public.parent_portal_atomic_delete(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.parent_portal_atomic_delete(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.parent_portal_atomic_delete(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.parent_portal_atomic_delete(UUID, UUID) TO service_role;
