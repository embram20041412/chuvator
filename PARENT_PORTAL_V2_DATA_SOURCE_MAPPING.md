# CHUVATOR PARENT PORTAL V2 — DATA SOURCE MAPPING MATRIX
**Document Version:** 2.0  
**Status:** ARCHITECTURE FROZEN  
**Audit Date:** 4 November 2026  

---

## DATA SOURCE MAPPING MATRIX

| Parent Portal Feature | Source Table / API Route / RPC Routine | Mode (Read/Write) | Availability Status | Operational & Technical Gap | Recommendation |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **Parent Authentication** | `/api/portal/v2/login`<br>Table: `parent_accounts` | Write (Session Init) | **AVAILABLE** | Session cookie `portal_session_v2` requires KV storage for persistent token revocation. | Ensure KV fallback in edge environment for session invalidation. |
| **Session Verification** | `/api/portal/v2/session`<br>Header: `X-Portal-CSRF` | Read-Only | **AVAILABLE** | In-memory CSRF validation verified. | Maintain session TTL refresh handling. |
| **Parent-Child Link** | Table: `parent_student_links`<br>RPC: `parent_get_billing` | Read-Only | **AVAILABLE** | Parent account must be active (`status = 'active'`). | Validate `psl.status = 'active'` in all backend RPCs. |
| **Student Profile** | Table: `students`<br>API: `/api/portal/session` | Read-Only | **AVAILABLE** | Profile photo URL stored as string text; optional cloud storage link. | Standardize default avatar initials fallback when photo URL is missing. |
| **Session Schedule** | Table: `schedules`<br>API: `/api/portal/schedule` | Read-Only | **AVAILABLE** | Schedules filtered by `class_id` and `tenant_id`. | Ensure index on `schedules(tenant_id, class_id)`. |
| **Attendance Records** | Table: `attendance_logs`<br>API: `/api/portal/schedule` | Read-Only | **AVAILABLE** | Attendance rate computed from `present` vs `absent` count. | Cache monthly attendance statistics in Edge function. |
| **Coach Evaluations** | Table: `evaluations`<br>API: `/api/portal/evaluations` | Read-Only | **AVAILABLE** | Evaluates 4 pillars (Physical, Technique, Tactical, Mental). | Format 0-100 scores into standard grade labels (Istimewa, Sangat Baik, etc.). |
| **Achievements & Medals** | Table: `achievements`<br>API: `/api/portal/evaluations` | Read-Only | **AVAILABLE** | Tournament medals and awards listed per student. | Style medals based on Gold/Silver/Bronze keywords. |
| **Announcements** | Table: `announcements`<br>API: `/api/portal/announcements` | Read-Only | **GAP (NOT AVAILABLE)** | UI component present in portal layout, but API endpoint `/api/portal/announcements` not yet wired to database. | Create `/functions/api/portal/announcements.js` reading `announcements` table. |
| **Billing Summary** | Table: `spp_payments`<br>RPC: `parent_get_billing`<br>API: `/api/portal/billing` | Read-Only | **AVAILABLE** | Calculates verified payments vs completed refunds, remaining bill, and overpayment balance. | Ensure unverified or rejected payments are excluded from `verified_payments`. |
| **Payment History** | Table: `spp_payments`, `transactions`<br>API: `/api/portal/billing` | Read-Only | **AVAILABLE** | Historical receipt listing verified payments. | Order receipts by `created_at DESC` with pagination. |
| **QRIS Payment Info** | Table: `tenants`<br>API: `/api/portal/billing` | Read-Only | **AVAILABLE** | Dynamic/static QRIS URL loaded from tenant settings (`qris_url`). | Validate tenant QRIS image URL before rendering in modal popup. |
| **Bank Account Info** | Table: `tenants`<br>API: `/api/portal/billing` | Read-Only | **AVAILABLE** | Reads array of bank accounts (`bank_accounts` JSONB). | Render copyable account numbers with clipboard copy notification. |
| **Transfer Proof Upload** | API: `/api/portal/upload_receipt`<br>Table: `spp_payment_verifications` | Write (Media Upload) | **GAP (PARTIAL)** | File upload endpoint `/api/portal/upload_receipt` needs direct attachment to `spp_payments.receipt_url`. | Implement upload endpoint using edge object storage and append verification log. |
| **Online Payment Gateway** | Payment Gateway Webhook Callback<br>Financial Core RPC | Read-Only Status | **GAP (NOT AVAILABLE)** | Online Gateway integration (e.g. Midtrans/Xendit) not yet wired. Payments currently use QRIS & Manual Transfer. | Keep QRIS & Transfer Bank as active primary payment initiation methods. |
