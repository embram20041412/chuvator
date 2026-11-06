-- =============================================================================
-- CHUVATOR — FASE 5.5-B (HARDENING V10)
-- RUNTIME VERIFICATION SCRIPT (READ-ONLY)
-- Purpose: Audit schema integrity after migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VERIFY COLUMNS (students table)
-- -----------------------------------------------------------------------------
SELECT 
    'COLUMN' AS type,
    column_name, 
    data_type, 
    character_maximum_length AS length, 
    is_nullable,
    CASE 
        WHEN column_name = 'kk_hmac' AND data_type = 'character varying' AND character_maximum_length = 64 THEN 'PASS'
        WHEN column_name = 'kk_last4' AND data_type = 'character varying' AND character_maximum_length = 4 THEN 'PASS'
        ELSE 'FAIL'
    END AS status
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'students' 
  AND column_name IN ('kk_hmac', 'kk_last4')
ORDER BY column_name;

-- -----------------------------------------------------------------------------
-- 2. VERIFY KK INDEX (students table)
-- -----------------------------------------------------------------------------
SELECT
    'INDEX' AS type,
    c_idx.relname AS name,
    am.amname AS method,
    i.indisunique AS is_unique,
    i.indisvalid AS is_valid,
    (
        SELECT array_agg(a.attname::text ORDER BY x.pos)
        FROM generate_series(0, i.indnkeyatts - 1) AS x(pos)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[x.pos]
    ) AS columns,
    CASE 
        WHEN am.amname = 'btree' 
         AND i.indisvalid = true 
         AND (
                SELECT array_agg(a.attname::text ORDER BY x.pos)
                FROM generate_series(0, i.indnkeyatts - 1) AS x(pos)
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[x.pos]
             ) = ARRAY['tenant_id', 'kk_hmac']
        THEN 'PASS' ELSE 'FAIL'
    END AS status
FROM pg_index i
JOIN pg_class c_idx ON c_idx.oid = i.indexrelid
JOIN pg_class c_tbl ON c_tbl.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c_idx.relnamespace
JOIN pg_am am ON am.oid = c_idx.relam
WHERE n.nspname = 'public' AND c_idx.relname = 'idx_students_tenant_kk_hmac'
  AND c_tbl.relname = 'students';

-- -----------------------------------------------------------------------------
-- 3. VERIFY UNIQUE CONSTRAINTS
-- -----------------------------------------------------------------------------
SELECT
    'CONSTRAINT' AS type,
    con.conname AS name,
    c_tbl.relname AS table,
    con.convalidated AS validated,
    (
        SELECT array_agg(a.attname::text ORDER BY x.pos)
        FROM unnest(con.conkey) WITH ORDINALITY AS x(colnum, pos)
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.colnum
    ) AS columns,
    CASE 
        WHEN con.conname = 'uq_parent_accounts_tenant_email' 
         AND (SELECT array_agg(a.attname::text ORDER BY x.pos) FROM unnest(con.conkey) WITH ORDINALITY AS x(colnum, pos) JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.colnum) = ARRAY['tenant_id', 'email']
        THEN 'PASS'
        WHEN con.conname = 'uq_parent_accounts_tenant_auth_uid' 
         AND (SELECT array_agg(a.attname::text ORDER BY x.pos) FROM unnest(con.conkey) WITH ORDINALITY AS x(colnum, pos) JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.colnum) = ARRAY['tenant_id', 'auth_uid']
        THEN 'PASS'
        WHEN con.conname = 'uq_parent_student_links_composite' 
         AND (SELECT array_agg(a.attname::text ORDER BY x.pos) FROM unnest(con.conkey) WITH ORDINALITY AS x(colnum, pos) JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.colnum) = ARRAY['tenant_id', 'parent_account_id', 'student_id']
        THEN 'PASS'
        ELSE 'FAIL'
    END AS status
FROM pg_constraint con
JOIN pg_class c_tbl ON c_tbl.oid = con.conrelid
JOIN pg_namespace n ON n.oid = con.connamespace
WHERE n.nspname = 'public'
  AND con.conname IN (
    'uq_parent_accounts_tenant_email',
    'uq_parent_accounts_tenant_auth_uid',
    'uq_parent_student_links_composite'
  )
  AND con.contype = 'u'
ORDER BY con.conname;
