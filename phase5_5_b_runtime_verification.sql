-- =============================================================================
-- CHUVATOR — FASE 5.5-B (HARDENING V10)
-- RUNTIME VERIFICATION SCRIPT (READ-ONLY)
-- Purpose: Exhaustive schema integrity audit using PostgreSQL catalogs.
-- =============================================================================

WITH 
-- -----------------------------------------------------------------------------
-- 1. Expected Schema Definitions
-- -----------------------------------------------------------------------------
expected_columns AS (
    SELECT 'students'::text AS tbl, 'kk_hmac'::text AS col, 'character varying'::text AS dtype, 64::int AS len
    UNION ALL
    SELECT 'students'::text, 'kk_last4'::text, 'character varying'::text, 4::int
),
expected_indexes AS (
    SELECT 'students'::text AS tbl, 'idx_students_tenant_kk_hmac'::text AS name, ARRAY['tenant_id', 'kk_hmac']::text[] AS cols
),
expected_constraints AS (
    SELECT 'parent_accounts'::text AS tbl, 'uq_parent_accounts_tenant_email'::text AS name, ARRAY['tenant_id', 'email']::text[] AS cols
    UNION ALL
    SELECT 'parent_accounts'::text, 'uq_parent_accounts_tenant_auth_uid'::text, ARRAY['tenant_id', 'auth_uid']::text[]
    UNION ALL
    SELECT 'parent_student_links'::text, 'uq_parent_student_links_composite'::text, ARRAY['tenant_id', 'parent_account_id', 'student_id']::text[]
),

-- -----------------------------------------------------------------------------
-- 2. Audit Logic
-- -----------------------------------------------------------------------------
column_audit AS (
    SELECT 
        'COLUMN' AS type,
        e.tbl || '.' || e.col AS object_name,
        CASE 
            WHEN c.column_name IS NULL THEN 'FAIL (Missing Column)'
            WHEN c.data_type != e.dtype THEN 'FAIL (Type mismatch: expected ' || e.dtype || ', got ' || c.data_type || ')'
            WHEN c.character_maximum_length IS DISTINCT FROM e.len THEN 'FAIL (Length mismatch: expected ' || e.len || ', got ' || COALESCE(c.character_maximum_length::text, 'NULL') || ')'
            WHEN c.is_nullable != 'YES' THEN 'FAIL (Must be nullable)'
            ELSE 'PASS'
        END AS status
    FROM expected_columns e
    LEFT JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = e.col
),
index_audit AS (
    SELECT
        'INDEX' AS type,
        e.tbl || '.' || e.name AS object_name,
        CASE 
            WHEN i.indexrelid IS NULL THEN 'FAIL (Missing Index)'
            WHEN am.amname != 'btree' THEN 'FAIL (Access method not btree)'
            WHEN i.indisunique = false THEN 'FAIL (Must be unique)'
            WHEN i.indisvalid = false OR i.indisready = false OR i.indislive = false OR i.indimmediate = false THEN 'FAIL (Operational state invalid)'
            WHEN i.indisexclusion = true THEN 'FAIL (Is exclusion index)'
            WHEN i.indpred IS NOT NULL THEN 'FAIL (Is partial index)'
            WHEN i.indexprs IS NOT NULL THEN 'FAIL (Is expression index)'
            WHEN i.indnatts != i.indnkeyatts THEN 'FAIL (Contains INCLUDE columns)'
            WHEN i.indnkeyatts != array_length(e.cols, 1) THEN 'FAIL (Column count mismatch)'
            WHEN (
                SELECT array_agg(a.attname::text ORDER BY x.pos)
                FROM generate_series(0, i.indnkeyatts - 1) AS x(pos)
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[x.pos]
            ) IS DISTINCT FROM e.cols THEN 'FAIL (Column order or identity mismatch)'
            ELSE 'PASS'
        END AS status
    FROM expected_indexes e
    LEFT JOIN (
        pg_index i 
        JOIN pg_class c_idx ON c_idx.oid = i.indexrelid
        JOIN pg_class c_tbl ON c_tbl.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c_idx.relnamespace
        JOIN pg_am am ON am.oid = c_idx.relam
    ) ON n.nspname = 'public' AND c_idx.relname = e.name AND c_tbl.relname = e.tbl
),
constraint_audit AS (
    SELECT
        'CONSTRAINT' AS type,
        e.tbl || '.' || e.name AS object_name,
        CASE 
            WHEN con.oid IS NULL THEN 'FAIL (Missing Constraint)'
            WHEN con.contype != 'u' THEN 'FAIL (Not a UNIQUE constraint)'
            WHEN con.convalidated = false THEN 'FAIL (Not validated)'
            WHEN con.condeferrable = true OR con.condeferred = true THEN 'FAIL (Deferrable/Deferred detected)'
            WHEN i.indexrelid IS NULL THEN 'FAIL (Missing backing index)'
            WHEN i.indisvalid = false OR i.indisready = false OR i.indislive = false OR i.indimmediate = false THEN 'FAIL (Backing index state invalid)'
            WHEN i.indnatts != i.indnkeyatts THEN 'FAIL (Backing index contains INCLUDE columns)'
            WHEN (i.indkey::int2[])[1:i.indnkeyatts] IS DISTINCT FROM con.conkey THEN 'FAIL (Indkey vs Conkey alignment mismatch)'
            WHEN (
                SELECT array_agg(a.attname::text ORDER BY x.pos)
                FROM unnest(con.conkey) WITH ORDINALITY AS x(colnum, pos)
                JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.colnum
            ) IS DISTINCT FROM e.cols THEN 'FAIL (Column order or identity mismatch)'
            ELSE 'PASS'
        END AS status
    FROM expected_constraints e
    LEFT JOIN (
        pg_constraint con
        JOIN pg_class c_tbl ON c_tbl.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = con.connamespace
        JOIN pg_index i ON i.indexrelid = con.conindid
    ) ON n.nspname = 'public' AND con.conname = e.name AND c_tbl.relname = e.tbl
),
all_checks AS (
    SELECT * FROM column_audit
    UNION ALL
    SELECT * FROM index_audit
    UNION ALL
    SELECT * FROM constraint_audit
)

-- -----------------------------------------------------------------------------
-- 3. Final Output & Global Summary
-- -----------------------------------------------------------------------------
SELECT * FROM all_checks
UNION ALL
SELECT 
    'SUMMARY' AS type,
    'Global Integrity' AS object_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM all_checks WHERE status LIKE 'FAIL%') THEN 'FAIL (See details above)'
        ELSE 'PASS (100%)'
    END AS status
ORDER BY type, object_name;
