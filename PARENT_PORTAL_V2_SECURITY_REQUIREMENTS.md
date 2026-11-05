# CHUVATOR PARENT PORTAL V2 — SECURITY REQUIREMENTS SPECIFICATION
**Document Version:** 2.0  
**Status:** ARCHITECTURE FROZEN  
**Audit Date:** 4 November 2026  

---

## 1. AUTHORIZATION & TENANT ISOLATION RULES

### Rule 1: Parent-Child Relationship Enforcement
- Every API endpoint serving student data (`billing.js`, `schedule.js`, `evaluations.js`) MUST verify that the authenticated parent (`parent_accounts.id`) possesses an ACTIVE link in `parent_student_links` (`status = 'active'`) to the requested `student_id`.
- Attempts to query `student_id` values not linked to the logged-in parent are blocked immediately with `403 Forbidden`.

### Rule 2: Tenant Isolation Enforcement
- The backend API verifies `session.tenantId` against database records.
- Client requests supplying a different `tenant_id` in request body or headers are rejected (`403 Forbidden`).
- All SQL queries and database RPCs enforce `WHERE tenant_id = p_tenant_id`.

### Rule 3: Direct Financial DML Revocation
- Direct `INSERT`, `UPDATE`, `DELETE` grants on financial tables (`spp_payments`, `transactions`, `pos_transactions`, `spp_refunds`, `global_ledger`) are REVOKED from `authenticated`, `anon`, and `public` roles.
- Financial mutations MUST execute exclusively through `SECURITY DEFINER` routines (`pos_checkout_spp_atomic`, `admin_refund_spp_payment`, `admin_verify_spp_payment`).

---

## 2. SESSION & CSRF SECURITY ARCHITECTURE

1. **HttpOnly Cookie Session (`portal_session_v2`)**:
   - Session tokens are stored in encrypted, HttpOnly, SameSite=Lax cookies.
   - JavaScript running in the browser CANNOT access session tokens, completely mitigating XSS token theft.
2. **In-Memory CSRF Token Validation**:
   - A unique, cryptographically random CSRF token is generated upon login and returned in the JSON body.
   - The frontend stores this CSRF token in component state (in-memory only).
   - Every non-GET API request MUST transmit the header `X-Portal-CSRF: <csrf_token>`.
   - Backend APIs reject requests missing or matching incorrect CSRF tokens (`403 Forbidden`).
3. **Fail-Closed Database Credentials**:
   - Edge functions use environment variables (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SUPABASE_URL`) to authenticate database connections.
   - If credentials or environment variables are missing, endpoints fail closed (`500 Server Configuration Error`) without exposing stack traces or secrets.

---

## 3. FINANCIAL ENDPOINT ACCESS MATRIX (DECISION-01)

| System Routine | Owner | Admin | Manager | Cashier | Parent | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `pos_checkout_spp_atomic` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `admin_refund_spp_payment` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `admin_verify_spp_payment` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `parent_get_billing` | ✅ | ✅ | ✅ | ❌ | ✅ (Linked Children Only) | ❌ |
| Manual Attendance Mutation | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manual Evaluation Mutation | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
