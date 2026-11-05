# CHUVATOR PARENT PORTAL V2 — GAP ANALYSIS REPORT
**Document Version:** 2.0  
**Status:** ARCHITECTURE FROZEN  
**Audit Date:** 4 November 2026  

---

## EXECUTIVE GAP ANALYSIS SUMMARY

An in-depth audit of the existing codebase (`src/`, `functions/api/portal/`, database scripts, and test suites) was performed to identify gaps between the current implementation and the target **Parent Portal V2 Scope and Architecture**.

---

## DETAILED GAP ITEMIZATION TABLE

| Gap ID | Component / File | Specific Function / Table | Actual Condition | Identified Gap | Severity | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | `functions/api/portal/announcements.js` | `announcements` Table | UI component present in portal layout, but Edge API endpoint `/api/portal/announcements` is NOT yet implemented in `/functions/api/portal/`. | Parents cannot read academy announcements or holiday notices in dashboard. | **MEDIUM** | Implement `/functions/api/portal/announcements.js` querying `announcements` table filtered by `tenant_id`. |
| **GAP-02** | `functions/api/portal/upload_receipt.js` | `spp_payment_verifications` | Transfer bank account info displayed in portal, but file upload endpoint `/api/portal/upload_receipt` is NOT yet wired to cloud storage. | Parents cannot attach image proof of transfer directly in portal. | **MEDIUM** | Implement `/functions/api/portal/upload_receipt.js` using object storage and recording `spp_payment_verifications` entry. |
| **GAP-03** | `src/pages/Portal/PortalDashboard.jsx` | Student Switcher UI | `localStorage.getItem('activeStudent')` used for initial display profile, but multi-child switcher UI drop-down is missing when a parent has multiple linked students. | Parents with >1 children in academy cannot switch active view without re-logging in. | **LOW** | Add student drop-down selector in `PortalDashboard.jsx` header powered by `parent_student_links`. |
| **GAP-04** | `functions/api/portal/billing.js` | `parent_get_billing` RPC | `/api/portal/billing` currently queries Firestore/REST collections. When switching to PostgreSQL backend, it must invoke `parent_get_billing` RPC routine. | Edge endpoint needs transition from legacy REST query payload to PostgreSQL RPC call. | **HIGH** | Wire `billing.js` to call `parent_get_billing` RPC routine using Bearer service access. |
| **GAP-05** | `01_phase2b3_schema_migration.sql` (Lines 13–30) | DDL Migration Script | Preflight queries use standard `SELECT` statements inside transaction block without `RAISE EXCEPTION`. | Preflight check does not fail fast if dirty data exists before `ALTER TABLE`. | **MEDIUM** | Wrap preflight check in `DO $$ BEGIN IF EXISTS (...) THEN RAISE EXCEPTION ... END IF; END $$;` block. |
| **GAP-06** | `02_phase2b3_rpc_routines.sql` (Lines 83–96) | `pos_checkout_spp_atomic` RPC | Idempotency lookup checks `IF status = 'COMPLETED' THEN RETURN response_payload` without verifying `payload_hash`. | Reusing idempotency key with different request payload returns original cached response instead of error. | **HIGH** | Add validation: `IF v_existing_idempotency.payload_hash != v_payload_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH'; END IF;`. |

---

## SUMMARY OF GAP SEVERITIES

- **CRITICAL Gaps:** 0 (Core architecture, authentication, and session encryption are active and solid).
- **HIGH Gaps:** 2 (GAP-04: Transitioning billing API to PostgreSQL RPC, GAP-06: Idempotency payload hash mismatch check).
- **MEDIUM Gaps:** 3 (GAP-01: Announcements endpoint, GAP-02: Receipt upload endpoint, GAP-05: DDL Fail-Fast preflight script).
- **LOW Gaps:** 1 (GAP-03: Multi-child UI selector drop-down).
