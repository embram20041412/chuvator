-- =============================================================================
-- CHUVATOR — FASE 5.5-B
-- RUNTIME VERIFICATION SCRIPT: BACKFILL AUDIT INFRASTRUCTURE (READ-ONLY)
-- File: phase5_5_b_backfill_verification.sql
-- Purpose: Read-only verification of backfill audit tables, indexes, and RPC routines.
-- =============================================================================

WITH expected_objects AS (
    SELECT 'TABLE'::text AS obj_type, 'backfill_kk_runs'::text AS obj_name
    UNION ALL SELECT 'TABLE', 'backfill_kk_audit'
    UNION ALL SELECT 'INDEX', 'idx_backfill_runs_status_lease'
    UNION ALL SELECT 'INDEX', 'idx_backfill_audit_run_student'
    UNION ALL SELECT 'INDEX', 'idx_backfill_audit_tenant_student'
    UNION ALL SELECT 'ROUTINE', 'acquire_backfill_kk_lease'
    UNION ALL SELECT 'ROUTINE', 'heartbeat_backfill_kk_lease'
    UNION ALL SELECT 'ROUTINE', 'apply_backfill_kk_atomic_record'
    UNION ALL SELECT 'ROUTINE', 'record_backfill_kk_skip'
    UNION ALL SELECT 'ROUTINE', 'rollback_backfill_kk_atomic'
    UNION ALL SELECT 'ROUTINE', 'complete_backfill_kk_run'
),
actual_tables AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
),
actual_indexes AS (
    SELECT c.relname AS index_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'i'
),
actual_routines AS (
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
)
SELECT 
    e.obj_type,
    e.obj_name,
    CASE 
        WHEN e.obj_type = 'TABLE' AND EXISTS (SELECT 1 FROM actual_tables WHERE table_name = e.obj_name) THEN 'READY'
        WHEN e.obj_type = 'INDEX' AND EXISTS (SELECT 1 FROM actual_indexes WHERE index_name = e.obj_name) THEN 'READY'
        WHEN e.obj_type = 'ROUTINE' AND EXISTS (SELECT 1 FROM actual_routines WHERE routine_name = e.obj_name) THEN 'READY'
        ELSE 'PENDING_DEPLOYMENT'
    END AS status
FROM expected_objects e
ORDER BY e.obj_type, e.obj_name;
