-- ============================================================================
-- CHUVATOR PARENT PORTAL V3.3 — STANDALONE POST-MIGRATION VERIFICATION SCRIPT
-- Target Environment: Supabase STAGING / PRODUCTION (PostgreSQL 15+)
-- File Name: chuvator_parent_portal_v3_3_verification.sql
-- Mode: READ-ONLY AUDIT & INTEGRITY CHECKING
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========== CHUVATOR V3.3 POST-MIGRATION VERIFICATION STARTED ==========';
END $$;

-- 1. Table existence, RLS state (Enabled & Forced), and direct table privileges
SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
  AND c.relname IN ('parent_invitations', 'parent_continuation_tickets');

-- 2. Verify student_id column on parent_invitations
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'parent_invitations'
  AND column_name = 'student_id';

-- 3. Verify direct table privileges (Revoked from PUBLIC, anon, authenticated)
SELECT 
    table_name, 
    grantee, 
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('parent_invitations', 'parent_continuation_tickets');

-- 4. Verify composite foreign key constraints on V3 tables (including student_id FK)
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('parent_invitations', 'parent_continuation_tickets');

-- 5. Verify baseline status check constraint on parent_accounts (pending, active, suspended)
SELECT 
    conname AS constraint_name, 
    pg_catalog.pg_get_constraintdef(oid) AS constraint_definition
FROM pg_catalog.pg_constraint 
WHERE conname = 'chk_parent_accounts_status';

-- 6. Verify 6 RPC routines, SECURITY DEFINER, and search_path settings
SELECT 
    p.proname AS rpc_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS rpc_signature,
    p.prosecdef AS is_security_definer,
    p.proconfig AS search_path_config
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

-- 7. Verify RPC Execute permissions (Granted exclusively to service_role)
SELECT 
    routine_name, 
    grantee, 
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_parent_invitation',
    'get_parent_invitation_info',
    'create_parent_continuation_ticket',
    'claim_parent_invitation_by_ticket',
    'revoke_parent_invitation',
    'recover_parent_session'
  );

-- 8. Unfiltered record inspection for parent_accounts (Preserved baseline data)
SELECT 
    id,
    tenant_id,
    email,
    auth_uid,
    status,
    created_by,
    activated_by,
    activated_at,
    created_at,
    updated_at
FROM public.parent_accounts
ORDER BY created_at DESC;

-- 9. Unfiltered record inspection for parent_student_links (Confirmed actual schema)
SELECT 
    id,
    tenant_id,
    parent_account_id,
    student_id,
    relationship,
    status,
    verified_at,
    created_at,
    updated_at
FROM public.parent_student_links
ORDER BY created_at DESC;
