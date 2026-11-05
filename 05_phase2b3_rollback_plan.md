# CHUVATOR PARENT PORTAL V2 — FASE 2B-3
## MIGRATION & ROLLBACK PLAN SPECIFICATION

**Document Version:** 1.0  
**Status:** SPECIFICATION DRAFT (FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT PRODUCT OWNER SIGN-OFF)

---

### 1. Preflight Checks & Prerequisites

Before initiating any database migration or RPC deployment on Supabase Production (`wqnhlmvvyhpctmaukwyj.supabase.co`), verify the following prerequisites:

1. **Production Database Backup**:
   Execute full binary database dump prior to DDL execution:
   ```bash
   pg_dump -h db.wqnhlmvvyhpctmaukwyj.supabase.co -U postgres -d postgres -F c -b -v -f backup_pre_phase2b3_$(date +%Y%m%d_%H%M%S).dump
   ```
2. **Catalog Integrity Verification**:
   Execute `04_phase2b3_validation_queries.sql` to confirm zero pre-existing duplicate keys or orphan records.
3. **Product Owner Written Sign-off**:
   Confirm written sign-off from system owner for financial RBAC decisions (DECISION-01, DECISION-02, DECISION-03).

---

### 2. Deployment Sequence

Deployment MUST follow a strict ordered 4-stage pipeline:

```
+-------------------------------------------------------------------+
| Stage 1: DDL Schema Migration (01_phase2b3_schema_migration.sql)  |
+-------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------+
| Stage 2: PL/pgSQL RPC Functions (02_phase2b3_rpc_routines.sql)    |
+-------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------+
| Stage 3: Security & RLS Policies (03_phase2b3_security_policies.sql)|
+-------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------+
| Stage 4: Integration Test & Catalog Verification                  |
+-------------------------------------------------------------------+
```

#### Step 1: DDL Migration Execution
Run `01_phase2b3_schema_migration.sql` inside a single explicit transaction block (`BEGIN; ... COMMIT;`).

#### Step 2: PL/pgSQL Routine Installation
Deploy `02_phase2b3_rpc_routines.sql`. Mark all routines `SECURITY DEFINER` and revoke permissions from `PUBLIC` and `anon`, granting `EXECUTE` strictly to `authenticated`.

#### Step 3: Security Policy Enforcement
Deploy `03_phase2b3_security_policies.sql`. Enable RLS and FORCE RLS on all 12 core tables. Ensure no `UPDATE` or `DELETE` policies exist on append-only financial audit tables (`spp_refunds`, `spp_payment_verifications`).

#### Step 4: Edge Functions Compatibility
Deploy updated Cloudflare Pages Functions (`/api/portal/v2/billing.js`, etc.) configured to invoke the newly installed RPCs via client JWT.

---

### 3. Emergency Rollback Procedures

If any failure, data anomaly, or unexpected exception occurs during or immediately after deployment, follow the emergency rollback procedure below:

#### Scenario A: Failure During DDL Migration (Stage 1)
- Automatic Rollback: Because `01_phase2b3_schema_migration.sql` runs within an explicit `BEGIN; ... COMMIT;` transaction, any error triggers an immediate `ROLLBACK` with zero schema changes persisted.

#### Scenario B: Post-DDL Emergency Schema Reversion
If schema reversion is required post-commit, execute the following script:

```sql
BEGIN;

-- Drop foreign key constraints
ALTER TABLE public.spp_refunds DROP CONSTRAINT IF EXISTS fk_spp_refunds_transaction_tenant;
ALTER TABLE public.spp_refunds DROP CONSTRAINT IF EXISTS fk_spp_refunds_payment_tenant;
ALTER TABLE public.spp_payment_verifications DROP CONSTRAINT IF EXISTS fk_spp_verifications_payment_tenant;
ALTER TABLE public.spp_payments DROP CONSTRAINT IF EXISTS fk_spp_payments_transaction_tenant;
ALTER TABLE public.spp_payments DROP CONSTRAINT IF EXISTS fk_spp_payments_student_tenant;

-- Restore original CASCADE FK on spp_payments.student_id
ALTER TABLE public.spp_payments 
  ADD CONSTRAINT spp_payments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- Drop newly created tables
DROP TABLE IF EXISTS public.spp_refunds CASCADE;
DROP TABLE IF EXISTS public.spp_payment_verifications CASCADE;
DROP TABLE IF EXISTS public.pos_idempotency_keys CASCADE;

-- Drop added constraints
ALTER TABLE public.pos_transactions DROP CONSTRAINT IF EXISTS uq_pos_transactions_tenant_receipt;
ALTER TABLE public.spp_payments DROP CONSTRAINT IF EXISTS chk_spp_payments_period_status;
ALTER TABLE public.spp_payments DROP CONSTRAINT IF EXISTS chk_spp_payments_verification_status;
ALTER TABLE public.spp_payments DROP CONSTRAINT IF EXISTS uq_spp_payments_id_tenant;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS uq_transactions_id_tenant;

-- Drop newly added columns from spp_payments
ALTER TABLE public.spp_payments DROP COLUMN IF EXISTS period_status;
ALTER TABLE public.spp_payments DROP COLUMN IF EXISTS verification_status;
ALTER TABLE public.spp_payments DROP COLUMN IF EXISTS transaction_id;

COMMIT;
```

#### Scenario C: RPC Function Rollback
To immediately revert RPC routines without reverting schema:
```sql
DROP FUNCTION IF EXISTS public.pos_checkout_spp_atomic(TEXT, TEXT, UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_refund_spp_payment(TEXT, UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_verify_spp_payment(TEXT, UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.parent_get_billing(TEXT, TEXT);
```

#### Scenario D: Full Database Restoration
In catastrophic scenario, restore from preflight dump:
```bash
pg_restore -h db.wqnhlmvvyhpctmaukwyj.supabase.co -U postgres -d postgres -c -v backup_pre_phase2b3_TIMESTAMP.dump
```

---

### 4. Post-Deployment Verification & Monitoring Plan

1. **Catalog Integrity Check**: Run `04_phase2b3_validation_queries.sql` and verify:
   - `relrowsecurity` = `true` and `relforcerowsecurity` = `true` across all 12 tables.
   - 4 RPCs present with `is_security_definer = true`.
2. **Automated Test Suite Execution**: Run `npm test` (`tests/portal_v2_operational_integration.test.js`) in staging/canary environment.
3. **Telemetry & Log Monitoring**: Monitor Supabase Postgres Logs for:
   - Exception code `42501` (Forbidden / RBAC violations).
   - Exception code `55P03` (Concurrent idempotency lock contention).
   - Zero deadlock events (`40P01`).
