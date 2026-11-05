# CHUVATOR PARENT PORTAL V2 — EXISTING ARCHITECTURE INVENTORY
**Document Version:** 2.0  
**Status:** ARCHITECTURE FROZEN  
**Audit Date:** 4 November 2026  

---

## 1. FRONTEND COMPONENT INVENTORY

The Parent Portal frontend is built as a single-page React application powered by Vite, Tailwind CSS, and Lucide React icons.

| Component / File | Purpose & Responsibilities | Key Dependencies | Actual Condition |
| :--- | :--- | :--- | :--- |
| `src/pages/Portal/PortalDashboard.jsx` | Main Parent Portal Dashboard UI. Contains tabbed views for Home, Billing, Schedule, and Evaluations. Executes HTTP session verification and billing API requests. | `lucide-react`, `react-router-dom`, `helpers.js` | **ACTIVE & FUNCTIONAL**. Handles tab navigation, QRIS modal, and bank account list copy. |
| `src/pages/Portal/PortalLoginV2.jsx` | Updated Parent Portal Login Page. Authenticates parent phone/email against `/api/portal/v2/login`. | `lucide-react`, `react-router-dom` | **ACTIVE & FUNCTIONAL**. Stores `portal_session_v2` cookie and CSRF token. |
| `src/pages/Portal/PortalLogin.jsx` | Legacy Parent Login Page. | `lucide-react` | **LEGACY**. Kept for backwards compatibility fallback. |
| `src/App.jsx` | Main Application Router. Configures routes for `/portal`, `/portal/v2`, and `/portal/dashboard`. | `react-router-dom` | **ACTIVE**. Maps portal paths to React components. |

---

## 2. BACKEND & EDGE FUNCTIONS INVENTORY

The backend API is implemented as Cloudflare Pages Functions located in `/functions/api/portal/`, utilizing HttpOnly encrypted session cookies and CSRF headers.

| Endpoint / File | Method | Purpose & Isolation Rules | Auth Requirement |
| :--- | :--- | :--- | :--- |
| `/functions/api/portal/_auth.js` | Module | Core auth helper module. Validates JWT, parses Firestore/Database fields, checks CSRF headers (`X-Portal-CSRF`). | Internal Module |
| `/functions/api/portal/_auth_v2.js` | Module | Enhanced auth helper for V2 cookie sessions (`portal_session_v2`). Enforces strict KV/database session validation. | Internal Module |
| `/functions/api/portal/v2/login.js` | `POST` | Authenticates parent credentials against `parent_accounts` and `parent_student_links`. Generates session cookie and CSRF token. | Public |
| `/functions/api/portal/v2/session.js` | `GET` | Validates active session cookie (`portal_session_v2`) and returns session metadata (studentId, tenantId, csrfToken). | HttpOnly Cookie |
| `/functions/api/portal/v2/logout.js` | `POST` | Invalidates active session in KV/database and clears HttpOnly session cookie. | Session + CSRF |
| `/functions/api/portal/billing.js` | `POST` | Retrieves student billing data, unpaid SPP items, tenant QRIS URL, and bank details. Validates student and tenant matching. | Session + CSRF |
| `/functions/api/portal/schedule.js` | `POST` | Retrieves class schedule and student attendance logs filtered by `studentId` and `tenantId`. | Session + CSRF |
| `/functions/api/portal/evaluations.js` | `POST` | Retrieves coach evaluation scores, progress metrics, and student achievements/medals. | Session + CSRF |

---

## 3. DATABASE TABLES & SCHEMA INVENTORY

The application uses Supabase PostgreSQL as its primary transactional database.

| Table Name | Key Columns | Role in Parent Portal | RLS Status |
| :--- | :--- | :--- | :--- |
| `students` | `id` (UUID), `tenant_id`, `name`, `spp_monthly_fee`, `status`, `school_origin` | Core student profile source. | **RLS & FORCE RLS ENABLED** |
| `parent_accounts` | `id` (UUID), `tenant_id`, `name`, `phone`, `email`, `auth_uid` | Parent account identity source. | **RLS & FORCE RLS ENABLED** |
| `parent_student_links` | `id` (UUID), `tenant_id`, `parent_id`, `student_id`, `status` | Authorization bridge linking parent to authorized students. | **RLS & FORCE RLS ENABLED** |
| `spp_payments` | `id` (UUID), `tenant_id`, `student_id`, `amount`, `status`, `paid_month`, `verification_status` | Source of student SPP billing records and payment status. | **RLS & FORCE RLS ENABLED** |
| `transactions` | `id` (UUID), `tenant_id`, `student_id`, `amount`, `items`, `payment_method`, `status` | Transaction history record. | **RLS & FORCE RLS ENABLED** |
| `pos_transactions` | `id` (UUID), `tenant_id`, `transaction_id`, `receipt_no`, `total_amount` | Receipt details for POS checkouts. | **RLS & FORCE RLS ENABLED** |
| `global_ledger` | `id` (UUID), `tenant_id`, `transaction_id`, `account_code`, `debit`, `credit` | Financial double-entry ledger. | **RLS & FORCE RLS ENABLED** |

---

## 4. SECURITY & AUTHORIZATION INVENTORY

1. **Session Management**:
   - Encrypted HttpOnly cookie `portal_session_v2` prevents client XSS token theft.
   - In-memory CSRF token required in `X-Portal-CSRF` header for all state-changing or data POST requests.
2. **Tenant & Parent-Child Isolation**:
   - Backend functions verify that `session.studentId` matches `body.studentId` and `session.tenantId` matches `body.tenantId`.
   - Direct cross-student or cross-tenant data requests are rejected with `403 Forbidden`.
3. **Database RLS Policies**:
   - All core tables enforce `FORCE ROW LEVEL SECURITY`.
   - Direct DML (`INSERT`, `UPDATE`, `DELETE`) on financial tables is revoked from `authenticated` and `anon` roles.
