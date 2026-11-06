-- =============================================================================
-- CHUVATOR — FASE 5.5-B (HARDENING V10)
-- WALIMURID DATABASE SCHEMA & KK IDENTITY IMPLEMENTATION
-- Status: IMPLEMENTATION (FOR SUPABASE SQL EDITOR)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PRE-MIGRATION AUDIT: DUPLICATE DETECTION
-- Detects duplicates using standard UNIQUE semantics (NULLs are distinct).
-- -----------------------------------------------------------------------------

DO $$ 
DECLARE
    v_dup_count INTEGER;
BEGIN
    -- Audit 1: (tenant_id, email)
    SELECT COUNT(*) INTO v_dup_count FROM (
        SELECT tenant_id, email FROM public.parent_accounts 
        WHERE tenant_id IS NOT NULL AND email IS NOT NULL
        GROUP BY tenant_id, email HAVING COUNT(*) > 1
    ) sub;
    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'MIGRASI DIBATALKAN: Terdeteksi % grup data duplikat (tenant_id, email) pada public.parent_accounts.', v_dup_count;
    END IF;

    -- Audit 2: (tenant_id, auth_uid)
    SELECT COUNT(*) INTO v_dup_count FROM (
        SELECT tenant_id, auth_uid FROM public.parent_accounts 
        WHERE tenant_id IS NOT NULL AND auth_uid IS NOT NULL
        GROUP BY tenant_id, auth_uid HAVING COUNT(*) > 1
    ) sub;
    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'MIGRASI DIBATALKAN: Terdeteksi % grup data duplikat (tenant_id, auth_uid) pada public.parent_accounts.', v_dup_count;
    END IF;

    -- Audit 3: (tenant_id, parent_account_id, student_id)
    SELECT COUNT(*) INTO v_dup_count FROM (
        SELECT tenant_id, parent_account_id, student_id FROM public.parent_student_links 
        WHERE tenant_id IS NOT NULL AND parent_account_id IS NOT NULL AND student_id IS NOT NULL
        GROUP BY tenant_id, parent_account_id, student_id HAVING COUNT(*) > 1
    ) sub;
    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'MIGRASI DIBATALKAN: Terdeteksi % grup relasi duplikat pada public.parent_student_links.', v_dup_count;
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 2. IDENTITAS KELUARGA (KK) PADA TABEL STUDENTS (NULL-SAFE DEFINITION GUARD)
-- -----------------------------------------------------------------------------

DO $$ 
BEGIN
    -- Guard for kk_hmac: Verify type and nullability with NULL-safe length check
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'kk_hmac'
          AND (data_type <> 'character varying' OR character_maximum_length IS DISTINCT FROM 64 OR is_nullable <> 'YES')
    ) THEN
        RAISE EXCEPTION 'MIGRASI DIBATALKAN: Kolom public.students.kk_hmac sudah ada dengan definisi berbeda.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'kk_hmac'
    ) THEN
        ALTER TABLE public.students ADD COLUMN kk_hmac VARCHAR(64);
        COMMENT ON COLUMN public.students.kk_hmac IS 'HMAC-SHA-256 dari nomor KK yang sudah dinormalisasi (16 digit).';
    END IF;

    -- Guard for kk_last4: NULL-safe check
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'kk_last4'
          AND (data_type <> 'character varying' OR character_maximum_length IS DISTINCT FROM 4 OR is_nullable <> 'YES')
    ) THEN
        RAISE EXCEPTION 'MIGRASI DIBATALKAN: Kolom public.students.kk_last4 sudah ada dengan definisi berbeda.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'kk_last4'
    ) THEN
        ALTER TABLE public.students ADD COLUMN kk_last4 VARCHAR(4);
        COMMENT ON COLUMN public.students.kk_last4 IS '4 digit terakhir nomor KK untuk verifikasi visual terbatas.';
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 3. KK INDEX GUARD & CREATION (CATALOG HARDENING V10 - NULL-SAFE ARRAY COMPARE)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    -- Relation-level name guard
    IF EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'idx_students_tenant_kk_hmac'
          AND c.relkind <> 'i'
    ) THEN
        RAISE EXCEPTION 'MIGRASI DIBATALKAN: Nama idx_students_tenant_kk_hmac sudah digunakan oleh relasi lain di public.';
    END IF;

    -- Definition guard (Hardened identity V10: IS DISTINCT FROM for NULL-safety)
    IF EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class c_idx ON c_idx.oid = i.indexrelid
        JOIN pg_class c_tbl ON c_tbl.oid = i.indrelid
        JOIN pg_namespace n_idx ON n_idx.oid = c_idx.relnamespace
        JOIN pg_namespace n_tbl ON n_tbl.oid = c_tbl.relnamespace
        JOIN pg_am am ON am.oid = c_idx.relam
        WHERE n_idx.nspname = 'public' AND n_tbl.nspname = 'public'
          AND c_idx.relname = 'idx_students_tenant_kk_hmac'
          AND (
            c_tbl.relname <> 'students' OR
            i.indisvalid = false OR i.indisready = false OR i.indislive = false OR
            i.indimmediate = false OR i.indisexclusion = true OR
            am.amname <> 'btree' OR
            i.indpred IS NOT NULL OR i.indexprs IS NOT NULL OR
            i.indnkeyatts <> 2 OR
            i.indnatts <> 2 OR
            (
                SELECT array_agg(a.attname::text ORDER BY x.pos)
                FROM generate_series(0, i.indnkeyatts - 1) AS x(pos)
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[x.pos]
            ) IS DISTINCT FROM ARRAY['tenant_id', 'kk_hmac']
          )
    ) THEN
        RAISE EXCEPTION 'MIGRASI DIBATALKAN: Index idx_students_tenant_kk_hmac sudah ada dengan definisi berbeda pada public.students.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'idx_students_tenant_kk_hmac'
    ) THEN
        CREATE INDEX idx_students_tenant_kk_hmac ON public.students (tenant_id, kk_hmac);
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 4. SMART UNIQUE CONSTRAINT AUDIT & ADOPTION (DYNAMIC SQL FOR COMPATIBILITY)
-- -----------------------------------------------------------------------------

DO $$ 
DECLARE
    v_has_nulls_not_distinct BOOLEAN;
    v_null_clause TEXT;
    v_found_con_name TEXT;
    v_found_idx_name TEXT;
    
    -- Dynamic Query Templates
    v_con_query_base TEXT;
    v_idx_query_base TEXT;
BEGIN
    -- Check catalog capability (PostgreSQL 15+) using pg_attribute directly
    SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute
        WHERE attrelid = 'pg_catalog.pg_index'::regclass
          AND attname = 'indnullsnotdistinct'
          AND NOT attisdropped
    ) INTO v_has_nulls_not_distinct;

    v_null_clause := CASE WHEN v_has_nulls_not_distinct THEN ' AND i.indnullsnotdistinct = false' ELSE '' END;

    -- Query Template A: Equivalent Constraint Search (Hardened V10)
    -- requirement: validated, non-deferrable, non-deferred, btree backing index, matching keys in ORDER
    -- V9 Change: indnatts = indnkeyatts to exclude INCLUDE columns
    -- V10 Change: Explicit relation identity check (i.indrelid = con.conrelid)
    v_con_query_base := '
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class c_tbl ON c_tbl.oid = con.conrelid
        JOIN pg_namespace n_tbl ON n_tbl.oid = c_tbl.relnamespace
        JOIN pg_class c_idx ON c_idx.oid = con.conindid
        JOIN pg_namespace n_idx ON n_idx.oid = c_idx.relnamespace
        JOIN pg_index i ON i.indexrelid = c_idx.oid
        JOIN pg_am am ON am.oid = c_idx.relam
        WHERE n_tbl.nspname = ''public'' AND n_idx.nspname = ''public'' 
          AND c_tbl.relname = %L AND con.contype = ''u''
          AND i.indrelid = con.conrelid
          AND con.convalidated = true AND con.condeferrable = false AND con.condeferred = false
          AND i.indisunique = true AND i.indisvalid = true AND i.indisready = true AND i.indislive = true
          AND i.indimmediate = true AND i.indisexclusion = false AND i.indpred IS NULL AND i.indexprs IS NULL
          AND am.amname = ''btree'' AND i.indnkeyatts = %s AND i.indnatts = i.indnkeyatts ' 
          || v_null_clause || '
          AND (
              SELECT array_agg(a.attname::text ORDER BY x.pos)
              FROM generate_series(0, i.indnkeyatts - 1) AS x(pos)
              JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[x.pos]
          ) = %s
          AND (
              SELECT array_agg(a.attname::text ORDER BY x.pos)
              FROM unnest(con.conkey) WITH ORDINALITY AS x(colnum, pos)
              JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.colnum
          ) = %s
        LIMIT 1';

    -- Query Template B: Adoption Candidate Search (Hardened V10)
    -- V9 Change: indnatts = indnkeyatts to exclude INCLUDE columns
    v_idx_query_base := '
        SELECT c_idx.relname 
        FROM pg_index i
        JOIN pg_class c_idx ON c_idx.oid = i.indexrelid
        JOIN pg_class c_tbl ON c_tbl.oid = i.indrelid
        JOIN pg_namespace n_idx ON n_idx.oid = c_idx.relnamespace
        JOIN pg_namespace n_tbl ON n_tbl.oid = c_tbl.relnamespace
        JOIN pg_am am ON am.oid = c_idx.relam
        WHERE n_tbl.nspname = ''public'' AND n_idx.nspname = ''public'' AND c_tbl.relname = %L
          AND i.indisunique = true AND i.indisvalid = true AND i.indisready = true
          AND i.indislive = true AND i.indimmediate = true AND i.indisexclusion = false
          AND i.indpred IS NULL AND i.indexprs IS NULL
          AND am.amname = ''btree''
          AND i.indnkeyatts = %s AND i.indnatts = i.indnkeyatts '
          || v_null_clause || '
          AND (
                SELECT array_agg(a.attname::text ORDER BY x.pos)
                FROM generate_series(0, i.indnkeyatts - 1) AS x(pos)
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[x.pos]
          ) = %s
        ORDER BY c_idx.relname
        LIMIT 1';

    -- -------------------------------------------------------------------------
    -- 4.1. parent_accounts (tenant_id, email)
    -- -------------------------------------------------------------------------
    v_found_con_name := NULL; v_found_idx_name := NULL;
    
    EXECUTE format(v_con_query_base, 'parent_accounts', 2, 'ARRAY[''tenant_id'', ''email'']', 'ARRAY[''tenant_id'', ''email'']') INTO v_found_con_name;

    IF v_found_con_name IS NULL THEN
        -- Name collision check (Hardened V10: relation level AND table-specific constraint)
        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'uq_parent_accounts_tenant_email')
        OR EXISTS (
            SELECT 1 FROM pg_constraint con 
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = con.connamespace 
            WHERE n.nspname = 'public' AND c.relname = 'parent_accounts' AND con.conname = 'uq_parent_accounts_tenant_email'
        ) THEN
            RAISE EXCEPTION 'MIGRASI DIBATALKAN: Nama uq_parent_accounts_tenant_email sudah digunakan tetapi definisinya tidak sesuai.';
        END IF;

        EXECUTE format(v_idx_query_base, 'parent_accounts', 2, 'ARRAY[''tenant_id'', ''email'']') INTO v_found_idx_name;

        IF v_found_idx_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.parent_accounts ADD CONSTRAINT uq_parent_accounts_tenant_email UNIQUE USING INDEX %I', v_found_idx_name);
        ELSE
            ALTER TABLE public.parent_accounts ADD CONSTRAINT uq_parent_accounts_tenant_email UNIQUE (tenant_id, email);
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- 4.2. parent_accounts (tenant_id, auth_uid)
    -- -------------------------------------------------------------------------
    v_found_con_name := NULL; v_found_idx_name := NULL;

    EXECUTE format(v_con_query_base, 'parent_accounts', 2, 'ARRAY[''tenant_id'', ''auth_uid'']', 'ARRAY[''tenant_id'', ''auth_uid'']') INTO v_found_con_name;

    IF v_found_con_name IS NULL THEN
        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'uq_parent_accounts_tenant_auth_uid')
        OR EXISTS (
            SELECT 1 FROM pg_constraint con 
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = con.connamespace 
            WHERE n.nspname = 'public' AND c.relname = 'parent_accounts' AND con.conname = 'uq_parent_accounts_tenant_auth_uid'
        ) THEN
            RAISE EXCEPTION 'MIGRASI DIBATALKAN: Nama uq_parent_accounts_tenant_auth_uid sudah digunakan tetapi definisinya tidak sesuai.';
        END IF;

        EXECUTE format(v_idx_query_base, 'parent_accounts', 2, 'ARRAY[''tenant_id'', ''auth_uid'']') INTO v_found_idx_name;

        IF v_found_idx_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.parent_accounts ADD CONSTRAINT uq_parent_accounts_tenant_auth_uid UNIQUE USING INDEX %I', v_found_idx_name);
        ELSE
            ALTER TABLE public.parent_accounts ADD CONSTRAINT uq_parent_accounts_tenant_auth_uid UNIQUE (tenant_id, auth_uid);
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- 4.3. parent_student_links (tenant_id, parent_account_id, student_id)
    -- -------------------------------------------------------------------------
    v_found_con_name := NULL; v_found_idx_name := NULL;

    EXECUTE format(v_con_query_base, 'parent_student_links', 3, 'ARRAY[''tenant_id'', ''parent_account_id'', ''student_id'']', 'ARRAY[''tenant_id'', ''parent_account_id'', ''student_id'']') INTO v_found_con_name;

    IF v_found_con_name IS NULL THEN
        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'uq_parent_student_links_composite')
        OR EXISTS (
            SELECT 1 FROM pg_constraint con 
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = con.connamespace 
            WHERE n.nspname = 'public' AND c.relname = 'parent_student_links' AND con.conname = 'uq_parent_student_links_composite'
        ) THEN
            RAISE EXCEPTION 'MIGRASI DIBATALKAN: Nama uq_parent_student_links_composite sudah digunakan tetapi definisinya tidak sesuai.';
        END IF;

        EXECUTE format(v_idx_query_base, 'parent_student_links', 3, 'ARRAY[''tenant_id'', ''parent_account_id'', ''student_id'']') INTO v_found_idx_name;

        IF v_found_idx_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.parent_student_links ADD CONSTRAINT uq_parent_student_links_composite UNIQUE USING INDEX %I', v_found_idx_name);
        ELSE
            ALTER TABLE public.parent_student_links ADD CONSTRAINT uq_parent_student_links_composite UNIQUE (tenant_id, parent_account_id, student_id);
        END IF;
    END IF;
END $$;

COMMIT;
