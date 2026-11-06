-- =============================================================================
-- CHUVATOR — FASE 5.5-B (HARDENING V10)
-- RUNTIME VERIFICATION SCRIPT (READ-ONLY)
-- Purpose: Strict schema integrity audit based on V10 baseline.
-- =============================================================================

WITH 
-- -----------------------------------------------------------------------------
-- 1. Expected Metadata
-- -----------------------------------------------------------------------------
expected AS (
    SELECT 'COLUMN'::text AS type, 'students.kk_hmac'::text AS obj, 'students'::text AS tbl, 'kk_hmac'::text AS name, ARRAY['tenant_id']::text[] AS cols
    UNION ALL SELECT 'COLUMN', 'students.kk_last4', 'students', 'kk_last4', NULL
    UNION ALL SELECT 'INDEX', 'students.idx_students_tenant_kk_hmac', 'students', 'idx_students_tenant_kk_hmac', ARRAY['tenant_id', 'kk_hmac']
    UNION ALL SELECT 'CONSTRAINT', 'parent_accounts.uq_parent_accounts_tenant_email', 'parent_accounts', 'uq_parent_accounts_tenant_email', ARRAY['tenant_id', 'email']
    UNION ALL SELECT 'CONSTRAINT', 'parent_accounts.uq_parent_accounts_tenant_auth_uid', 'parent_accounts', 'uq_parent_accounts_tenant_auth_uid', ARRAY['tenant_id', 'auth_uid']
    UNION ALL SELECT 'CONSTRAINT', 'parent_student_links.uq_parent_student_links_composite', 'parent_student_links', 'uq_parent_student_links_composite', ARRAY['tenant_id', 'parent_account_id', 'student_id']
),

-- -----------------------------------------------------------------------------
-- 2. Actual Catalog Data
-- -----------------------------------------------------------------------------
actual_columns AS (
    SELECT table_name, column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
),
actual_indexes AS (
    SELECT 
        c_tbl.relname AS table_name,
        c_idx.relname AS index_name,
        am.amname, i.*
    FROM pg_index i
    JOIN pg_class c_idx ON c_idx.oid = i.indexrelid
    JOIN pg_class c_tbl ON c_tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c_idx.relnamespace
    JOIN pg_am am ON am.oid = c_idx.relam
    WHERE n.nspname = 'public'
),
actual_constraints AS (
    SELECT 
        c_tbl.relname AS table_name,
        con.conname,
        con.contype, con.convalidated, con.condeferrable, con.condeferred, con.conkey, con.conrelid,
        i.indisunique AS idx_unique,
        i.indisvalid AS idx_valid,
        i.indisready AS idx_ready,
        i.indislive AS idx_live,
        i.indimmediate AS idx_immediate,
        i.indnatts AS idx_natts,
        i.indnkeyatts AS idx_nkeyatts,
        i.indkey AS idx_key,
        am.amname AS idx_am
    FROM pg_constraint con
    JOIN pg_class c_tbl ON c_tbl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    LEFT JOIN pg_index i ON i.indexrelid = con.conindid
    LEFT JOIN pg_am am ON am.oid = (SELECT relam FROM pg_class WHERE oid = i.indexrelid)
    WHERE n.nspname = 'public' AND con.contype = 'u'
),

-- -----------------------------------------------------------------------------
-- 3. Audit Execution
-- -----------------------------------------------------------------------------
audit_results AS (
    SELECT 
        e.type, e.obj AS object_name,
        CASE
            WHEN e.type = 'COLUMN' THEN (
                SELECT CASE 
                    WHEN COUNT(*) = 0 THEN 'FAIL (Missing)'
                    WHEN COUNT(*) > 1 THEN 'FAIL (Duplicate definition in catalog)'
                    ELSE (
                        SELECT CASE
                            WHEN data_type != 'character varying' THEN 'FAIL (Type mismatch: expected character varying, got ' || data_type || ')'
                            WHEN character_maximum_length IS DISTINCT FROM (CASE WHEN e.name = 'kk_hmac' THEN 64 ELSE 4 END) THEN 'FAIL (Length mismatch)'
                            WHEN is_nullable != 'YES' THEN 'FAIL (Must be nullable)'
                            ELSE 'PASS'
                        END
                        FROM actual_columns WHERE table_name = e.tbl AND column_name = e.name
                    )
                END
                FROM actual_columns WHERE table_name = e.tbl AND column_name = e.name
            )
            WHEN e.type = 'INDEX' THEN (
                SELECT CASE
                    WHEN COUNT(*) = 0 THEN 'FAIL (Missing)'
                    WHEN COUNT(*) > 1 THEN 'FAIL (Multiple indexes with same name in public)'
                    ELSE (
                        SELECT CASE
                            WHEN table_name != 'students' THEN 'FAIL (Attached to wrong table: ' || table_name || ')'
                            WHEN amname != 'btree' THEN 'FAIL (Not btree)'
                            WHEN indisvalid = false OR indisready = false OR indislive = false THEN 'FAIL (Operational state invalid)'
                            WHEN indpred IS NOT NULL OR indexprs IS NOT NULL THEN 'FAIL (Partial or Expression index detected)'
                            WHEN indnatts != indnkeyatts THEN 'FAIL (Contains INCLUDE columns)'
                            WHEN indnkeyatts != 2 THEN 'FAIL (Key count mismatch: expected 2, got ' || indnkeyatts || ')'
                            WHEN (
                                SELECT array_agg(a.attname::text ORDER BY x.pos)
                                FROM generate_series(0, indnkeyatts - 1) AS x(pos)
                                JOIN pg_attribute a ON a.attrelid = indrelid AND a.attnum = indkey[x.pos]
                            ) IS DISTINCT FROM e.cols THEN 'FAIL (Column sequence mismatch)'
                            ELSE 'PASS'
                        END
                        FROM actual_indexes WHERE table_name = e.tbl AND index_name = e.name
                    )
                END
                FROM actual_indexes WHERE table_name = e.tbl AND index_name = e.name
            )
            WHEN e.type = 'CONSTRAINT' THEN (
                SELECT CASE
                    WHEN COUNT(*) = 0 THEN 'FAIL (Missing)'
                    WHEN COUNT(*) > 1 THEN 'FAIL (Duplicate constraints with same name in public)'
                    ELSE (
                        SELECT CASE
                            WHEN table_name != e.tbl THEN 'FAIL (Attached to wrong table)'
                            WHEN contype != 'u' THEN 'FAIL (Not a UNIQUE constraint)'
                            WHEN convalidated = false THEN 'FAIL (Constraint not validated)'
                            WHEN condeferrable = true OR condeferred = true THEN 'FAIL (Deferrable/Deferred not allowed)'
                            WHEN idx_am IS DISTINCT FROM 'btree' THEN 'FAIL (Backing index missing or not btree)'
                            WHEN idx_unique = false THEN 'FAIL (Backing index not unique)'
                            WHEN idx_valid = false OR idx_ready = false OR idx_live = false OR idx_immediate = false THEN 'FAIL (Backing index operational state invalid)'
                            WHEN idx_natts != idx_nkeyatts THEN 'FAIL (Backing index has INCLUDE columns)'
                            WHEN (idx_key::int2[])[1:idx_nkeyatts] IS DISTINCT FROM conkey THEN 'FAIL (Backing index key alignment mismatch)'
                            WHEN (
                                SELECT array_agg(a.attname::text ORDER BY x.pos)
                                FROM unnest(conkey) WITH ORDINALITY AS x(colnum, pos)
                                JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = x.colnum
                            ) IS DISTINCT FROM e.cols THEN 'FAIL (Column sequence mismatch)'
                            ELSE 'PASS'
                        END
                        FROM actual_constraints WHERE table_name = e.tbl AND conname = e.name
                    )
                END
                FROM actual_constraints WHERE table_name = e.tbl AND conname = e.name
            )
        END AS status
    FROM expected e
)

-- -----------------------------------------------------------------------------
-- 4. Final Output
-- -----------------------------------------------------------------------------
SELECT type, object_name, status FROM audit_results
UNION ALL
SELECT 
    'SUMMARY' AS type, 
    'Overall Integrity' AS object_name, 
    CASE WHEN COUNT(*) FILTER (WHERE status = 'PASS') = 6 THEN 'PASS (All 6 objects verified)' ELSE 'FAIL (One or more objects failed audit)' END
FROM audit_results
ORDER BY type DESC, object_name;
