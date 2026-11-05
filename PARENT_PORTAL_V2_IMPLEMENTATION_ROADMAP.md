# CHUVATOR PARENT PORTAL V2 — IMPLEMENTATION ROADMAP
**Document Version:** 2.0  
**Status:** ARCHITECTURE FROZEN  
**Audit Date:** 4 November 2026  

---

## IMPLEMENTATION PHASES & MILESTONES

```
+-----------------------------------------------------------------------------------+
| PHASE 1: PRODUCT SCOPE & ARCHITECTURE FREEZE (CURRENT PHASE - COMPLETED)          |
| - Audit existing repository code, database tables, and edge endpoints.             |
| - Produce frozen scope & architectural specification documents.                  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 2: FINANCIAL CORE DATABASE ROUTINES & DDL MIGRATION (FASE 2B-3 EXECUTION)   |
| - Execute Fail-Fast DDL migration script (01_phase2b3_schema_migration.sql).      |
| - Install PL/pgSQL routines (pos_checkout_spp_atomic, admin_refund_spp_payment).  |
| - Apply RLS & FORCE RLS policies (03_phase2b3_security_policies.sql).             |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 3: EDGE FUNCTIONS V2 ENDPOINT WIRING (/api/portal/v2/*)                      |
| - Implement /api/portal/v2/announcements.js for reading academy announcements.    |
| - Implement /api/portal/v2/upload_receipt.js for transfer proof upload.           |
| - Wire billing.js to parent_get_billing RPC routine.                              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 4: FRONTEND UI ENHANCEMENT & MULTI-CHILD SWITCHER                          |
| - Integrate active student switcher for parents with multiple linked children.     |
| - Enhance QRIS & Bank Transfer modal with receipt upload attachment UI.           |
| - Add PDF Report Card export button for student evaluation cards.                 |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 5: END-TO-END INTEGRATION TESTING & PRODUCTION STAGING ROLLOUT             |
| - Execute 30-scenario automated integration test suite in staging environment.    |
| - Conduct pre-deployment catalog verification queries (04_phase2b3_validation).   |
| - Production deployment with telemetry & log monitoring.                          |
+-----------------------------------------------------------------------------------+
```

---

## PHASE MILESTONE DELIVERABLES

| Phase | Core Deliverable | Acceptance Criteria | Target Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Scope & Architecture Specs | 7 Markdown documents frozen & verified. | **COMPLETED** |
| **Phase 2** | DB Migration & PL/pgSQL RPCs | Schema migration and 4 RPCs installed with RLS. | Pending PO Sign-off |
| **Phase 3** | Edge API Endpoints | Cloudflare functions connected to Supabase RPCs. | Pending Phase 2 |
| **Phase 4** | Frontend Dashboard Polish | Mobile-responsive dashboard with multi-child switch. | Pending Phase 3 |
| **Phase 5** | Production Staging Verification | 30/30 test suite passing on live staging DB. | Pending Phase 4 |
