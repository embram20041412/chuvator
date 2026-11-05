# CHUVATOR PARENT PORTAL V2 — FASE 2B-3A
# MASTER IMPLEMENTATION SPECIFICATION & FINANCIAL CONTRACT

**Product Name:** CHUVATOR Parent Portal V2  
**Target Environment:** Supabase Production (`wqnhlmvvyhpctmaukwyj.supabase.co`)  
**Specification Version:** 2B-3A.1.0  
**Mode Constraint:** SPECIFICATION ONLY — STRICT READ-ONLY (Zero DDL/DML executed on Production)  
**Final Gate Status:** `SPECIFICATION COMPLETE` (Awaiting Product Owner Approval for FASE 2B-3B Execution)

---

## 1. EXECUTIVE SUMMARY & AUDIT CONTEXT

This master specification consolidates all empirical catalog evidence, database architectural contracts, authorization models, financial accounting state machines, and idempotency guarantees established across audit phases **FASE 2B-2A through FASE 2B-2S**.

### Verified Empirical Catalog Baseline (Production PostgreSQL):
1. **`users_staff`**: Authenticated staff users are linked via `uid` (TEXT, corresponding to `auth.uid()`) and `tenant_id` (TEXT). Column `user_id` does NOT exist in production (`42703`). Active filter: `status = 'active'`. Role values: `'owner'`, `'admin'`, `'manager'`, `'kasir'`, `'staff'`.
2. **`tenants`**: Primary key is `id` (UUID), tenant identifier is `tenant_id` (TEXT). Active filter: `status IN ('active', 'aktif')`. Columns `is_active` and `timezone` do NOT exist (`42703`).
3. **`spp_payments`**: Contains existing live payments. FK `student_id → students.id` is currently `ON DELETE CASCADE`. Columns `transaction_id`, `verification_status`, and `period_status` do NOT exist yet in live DB (`42703`) and will be created via DDL.
4. **`transactions`**: Primary key is `id` (UUID). UNIQUE constraint on `(id, tenant_id)` will be added to enable tenant-isolated composite FKs.
5. **`pos_transactions`**: Contains POS receipt details. Unique constraint `uq_pos_transactions_tenant_receipt` on `(tenant_id, receipt_no)` will be added.
6. **`global_ledger`**: Double-entry journal storing financial debits and credits per transaction.

---

## 2. BINDING PRODUCT DECISIONS

The following three binding product decisions govern all database routines, security policies, and edge API handlers:

```
+-----------------------------------------------------------------------------------+
| DECISION-01: FINANCIAL RBAC MATRIX                                                |
| - Owner / Admin / Manager : Full access (POS Checkout, Refund, VOID, Verification)|
| - Kasir (Cashier)        : POS Checkout ONLY                                      |
| - Staff                  : REJECTED from all financial routines                   |
+-----------------------------------------------------------------------------------+
| DECISION-02: SEPARATE OVERPAYMENT BALANCE                                         |
| - overpayment_balance = GREATEST(0, net_paid - monthly_fee)                       |
| - Overpayment balance is NOT automatically carried forward to future months.      |
| - Refund Priority: Refund FIRST reduces overpayment balance. Sisa refund reduces  |
|   the fee-clearing payment amount.                                                 |
+-----------------------------------------------------------------------------------+
| DECISION-03: ATOMIC 1-TRANSACTION REFUND                                          |
| - Refunds are executed in 1 single atomic PostgreSQL transaction block.           |
| - Any failure during logging, payment status update, or ledger journaling         |
|   triggers a 100% full transaction ROLLBACK.                                      |
+-----------------------------------------------------------------------------------+
```

---

## 3. DATABASE MIGRATION SPECIFICATION

The migration is defined in `01_phase2b3_schema_migration.sql`:

1. **Unique Constraints for Composite FK Targets**:
   - `CONSTRAINT uq_transactions_id_tenant UNIQUE (id, tenant_id)` on `public.transactions`.
   - `CONSTRAINT uq_spp_payments_id_tenant UNIQUE (id, tenant_id)` on `public.spp_payments`.
2. **New Core Tables**:
   - `pos_idempotency_keys`: Tracks `POS_CHECKOUT` and `SPP_REFUND` idempotency requests with status `PROCESSING`, `COMPLETED`, `FAILED`. Unique constraint `(tenant_id, idempotency_key, operation_type)`.
   - `spp_payment_verifications`: Append-only audit trail for verification actions (`VERIFY`, `REJECT`, `CORRECT`) with actor metadata (`verified_by_uid`, `verified_by_email`, `verified_by_role`).
   - `spp_refunds`: Financial refund log storing `refund_amount`, `overpayment_refunded`, `fee_refunded`, and actor metadata.
3. **Table Modifications (`spp_payments`)**:
   - Add `transaction_id UUID NULL REFERENCES transactions(id, tenant_id)`.
   - Add `verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'rejected'))`.
   - Add `period_status TEXT NOT NULL DEFAULT 'current' CHECK (period_status IN ('current', 'historical', 'corrected'))`.
   - Convert FK `student_id` from `ON DELETE CASCADE` to `ON DELETE RESTRICT` via `CONSTRAINT fk_spp_payments_student_tenant FOREIGN KEY (student_id, tenant_id) REFERENCES students(id, tenant_id) ON DELETE RESTRICT`.
4. **Data Retention Strategy**:
   - Hard deletion of students with financial payment history is blocked by `ON DELETE RESTRICT`.
   - Soft deletion is enforced by setting `students.status = 'archived'`.

---

## 4. FINANCIAL PL/pgSQL RPC SPECIFICATIONS

All routines are defined in `02_phase2b3_rpc_routines.sql` with `SECURITY DEFINER` and `SET search_path = public, extensions, pg_temp`.

### A. `pos_checkout_spp_atomic`
- **Parameters**: `p_tenant_id`, `p_idempotency_key`, `p_student_id`, `p_items`, `p_subtotal`, `p_discount`, `p_tax`, `p_total_amount`, `p_amount_tendered`, `p_payment_method`, `p_notes`, `p_spp_month`.
- **Validation**:
  - Authenticated JWT (`v_auth_uid := auth.uid()`).
  - `users_staff` active role in `('owner', 'admin', 'manager', 'kasir')`. Role `'staff'` rejected (`403 REJECTED`).
  - Active tenant check (`status IN ('active', 'aktif')`).
  - Tendered amount check (`p_amount_tendered >= p_total_amount`).
- **Idempotency**: Payload SHA256 hashed. Status `'PROCESSING'` prevents concurrent duplicate requests. Returns cached response if `'COMPLETED'`.
- **Execution**: Atomic insertion into `transactions`, `pos_transactions`, `spp_payments` (if SPP), and `global_ledger` debit/credit entries.

### B. `admin_refund_spp_payment`
- **Parameters**: `p_tenant_id`, `p_spp_payment_id`, `p_refund_amount`, `p_reason`, `p_idempotency_key`.
- **Validation & Locking Hierarchy**:
  - `users_staff` role in `('owner', 'admin', 'manager')`. Kasir/Staff rejected (`403 REJECTED`).
  - **Deterministic Lock Order**: Fetch payment `transaction_id`. Lock parent `transactions` row FIRST (`FOR UPDATE`), then lock child `spp_payments` row SECOND (`FOR UPDATE`).
  - Prevent refunding VOID transactions (`transactions.is_void = true`).
  - Check total existing completed refunds (`v_existing_refunds`). Reject if `p_refund_amount > (amount - v_existing_refunds)`.
- **DECISION-02 Allocation**:
  - `v_current_overpayment := GREATEST(0, v_current_net_paid - v_monthly_fee)`.
  - `v_overpayment_refunded := LEAST(p_refund_amount, v_current_overpayment)`.
  - `v_fee_refunded := p_refund_amount - v_overpayment_refunded`.
- **Execution**: Inserts `spp_refunds`, updates `spp_payments.status` (`PARSIAL_REFUND` or `REFUNDED`), and inserts balancing debit/credit entries in `global_ledger`.

### C. `admin_verify_spp_payment`
- **Parameters**: `p_tenant_id`, `p_spp_payment_id`, `p_action` (`'VERIFY'`, `'REJECT'`, `'CORRECT'`), `p_notes`, `p_correction_reference_id`.
- **Behavior**: Appends immutable log entry to `spp_payment_verifications` and updates `spp_payments.verification_status`.

### D. `parent_get_billing`
- **Parameters**: `p_tenant_id`, `p_parent_uid`.
- **Accounting Formulas**:
  - `net_paid = verified_payments - completed_refunds`
  - `remaining_bill = GREATEST(0, monthly_fee - net_paid)`
  - `overpayment_balance = GREATEST(0, net_paid - monthly_fee)`
  - Unverified or rejected payments are strictly excluded from `verified_payments`.

---

## 5. SECURITY ARCHITECTURE & RLS POLICIES

Defined in `03_phase2b3_security_policies.sql`:
1. **FORCE RLS**: Active across all 12 core tables.
2. **Direct Table Access Blocked**: Direct `INSERT`, `UPDATE`, `DELETE` grants revoked from `authenticated` and `anon` on all financial tables. All mutations MUST pass through `SECURITY DEFINER` RPC routines.
3. **Append-Only Enforcement**: Tables `spp_refunds` and `spp_payment_verifications` have zero `UPDATE` or `DELETE` RLS policies.
4. **Tenant Isolation**: RLS `SELECT` policies enforce `tenant_id = users_staff.tenant_id`.

---

## 6. FINANCIAL RECONCILIATION & DOUBLE-ENTRY LEDGER

Global ledger entries guarantee `SUM(debit) == SUM(credit)` for every transaction:

| Transaction Type | Debit Account | Credit Account | Description |
| :--- | :--- | :--- | :--- |
| **POS Checkout (Cash)** | `1001_CASH` (Full Amount) | `4001_REVENUE` (Full Amount) | POS Sales Revenue Receipt {receipt_no} |
| **SPP Refund** | `4001_REFUND_OFFSET` (Refund Amount) | `1001_CASH` (Refund Amount) | SPP Refund Cash Outflow {refund_no} |

---

## 7. INTEGRATION TEST MATRIX (30 SCENARIOS)

Test suite implemented in `tests/portal_v2_operational_integration.test.js` covering:
- **Category 1 (Scenarios 01 - 08)**: Static Code & SQL Contract Verification.
- **Category 2 (Scenarios 09 - 11)**: Mocked Business Logic & Accounting Formulas.
- **Category 3 (Scenarios 12 - 14)**: Concurrency & Lock Contention Specifications.
- **Category 4 (Scenarios 15 - 30)**: Operational Integration Scenarios (RBAC, Tenant Isolation, Receipts, Ledger Balance, Append-Only Checks).

---

## 8. DELIVERABLES MANIFEST

The following 6 specification deliverables have been drafted in the repository:

1. `01_phase2b3_schema_migration.sql`: Complete DDL schema migration script with pre/post-flight checks.
2. `02_phase2b3_rpc_routines.sql`: PL/pgSQL implementation of all 4 financial RPC routines.
3. `03_phase2b3_security_policies.sql`: Complete RLS, FORCE RLS, ACL, and append-only policies.
4. `04_phase2b3_validation_queries.sql`: Read-only catalog inspection queries.
5. `05_phase2b3_rollback_plan.md`: Step-by-step deployment, monitoring, and emergency rollback plan.
6. `tests/portal_v2_operational_integration.test.js`: 30-scenario operational integration test suite.

---

## 9. FINAL GATE STATUS

**STATUS: SPECIFICATION COMPLETE**

- All technical specifications, SQL drafts, security policies, and test suites are complete, fully reconciled, and ready for review.
- **Constraint Enforcement Reminder**: Production database migration and code deployment remain strictly **PAUSED** until the Product Owner reviews and issues explicit written sign-off to execute FASE 2B-3B.
