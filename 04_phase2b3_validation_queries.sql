-- =============================================================================
-- CHUVATOR PARENT PORTAL V2 — FASE 2B-3
-- READ-ONLY POSTGRESQL CATALOG VALIDATION QUERIES: 04_phase2b3_validation_queries.sql
-- Status: SPECIFICATION DRAFT (FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VERIFY RLS AND FORCE RLS STATUS ACROSS ALL 12 CORE TABLES
-- -----------------------------------------------------------------------------
SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'pos_idempotency_keys', 'spp_payment_verifications', 'spp_refunds',
    'spp_payments', 'transactions', 'pos_transactions', 'global_ledger',
    'students', 'tenants', 'users_staff', 'parent_accounts', 'parent_student_links'
  )
ORDER BY c.relname;


-- -----------------------------------------------------------------------------
-- 2. VERIFY PRIMARY KEYS, FOREIGN KEYS, UNIQUE INDEXES & CHECK CONSTRAINTS
-- -----------------------------------------------------------------------------
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'pos_idempotency_keys', 'spp_payment_verifications', 'spp_refunds',
    'spp_payments', 'transactions', 'pos_transactions', 'global_ledger'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;


-- -----------------------------------------------------------------------------
-- 3. VERIFY RPC SECURITY DEFINER, SEARCH PATH, OWNER & EXECUTE GRANTS
-- -----------------------------------------------------------------------------
SELECT 
    p.proname AS function_name,
    pg_get_userbyid(p.proowner) AS owner,
    p.prosecdef AS is_security_definer,
    p.proconfig AS search_path_config,
    array_to_string(p.proacl, ', ') AS acl_permissions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'pos_checkout_spp_atomic',
    'admin_refund_spp_payment',
    'admin_verify_spp_payment',
    'parent_get_billing'
  );


-- -----------------------------------------------------------------------------
-- 4. VERIFY RLS POLICIES FOR ALL CORE TABLES
-- -----------------------------------------------------------------------------
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- -----------------------------------------------------------------------------
-- 5. PRE-FLIGHT DATA SANITY AND ORPHAN CHECK QUERIES
-- -----------------------------------------------------------------------------
-- Check 5A: Negative or Zero Amounts in spp_payments
SELECT id, tenant_id, amount, status 
FROM public.spp_payments 
WHERE amount <= 0;

-- Check 5B: Duplicate Active Parent-Student Links
SELECT parent_id, student_id, tenant_id, COUNT(*) 
FROM public.parent_student_links 
WHERE status = 'active'
GROUP BY parent_id, student_id, tenant_id 
HAVING COUNT(*) > 1;

-- Check 5C: Active Staff Accounts with Missing/Invalid UIDs
SELECT id, tenant_id, name, email, role, status 
FROM public.users_staff 
WHERE status = 'active' AND (uid IS NULL OR uid = '');

-- Check 5D: Transactions marked VOID but having payments
SELECT t.id AS transaction_id, t.tenant_id, p.id AS spp_payment_id, p.status AS payment_status
FROM public.transactions t
JOIN public.spp_payments p ON p.transaction_id = t.id AND p.tenant_id = t.tenant_id
WHERE t.is_void = true AND p.status NOT IN ('VOID', 'REFUNDED');

-- =============================================================================
-- END OF CATALOG VALIDATION QUERIES
-- =============================================================================
