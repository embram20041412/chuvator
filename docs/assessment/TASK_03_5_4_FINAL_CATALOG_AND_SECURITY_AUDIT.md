# CHUVATOR — TASK 03.5.4
# FINAL CATALOG RECONCILIATION & TENANT HELPER SECURITY AUDIT

- **Task ID:** `TASK 03.5.4`
- **Target Migration Package:** `docs/assessment/sql/task03_5/` (Task 03.5.3 Measurement Method Standardization)
- **Audit Scope:** Strictly Read-Only Production Migration-Readiness Audit (Catalog Reconciliation, `public.athlete_belongs_to_tenant()` Security Audit, and Task 03.5.3 Rollback Readiness Verification)
- **Execution Mode:** Workspace Static & Codebase Audit Only — Zero Production DDL/DML, Zero Function/Permission Changes, Zero Backfills
- **Overall Production Migration Readiness Verdict:** **BLOCKED / NOT READY FOR PRODUCTION EXECUTION** (3 pre-execution blockers remain — see Section D.2)

---

## EXECUTIVE SUMMARY

This audit completes the three remaining Production migration-readiness checks for **Assessment Battery Task 03.5.3**:

1. **Section A — Official 18-Test Catalog Reconciliation (`src/config/footballTestBatteryCatalog.js` vs Production `public.athlete_test_results`):**
   - All **18 official objective tests** and their canonical measurement methods (`STOPWATCH_MANUAL`, `SMARTPHONE_VIDEO`, `PHYSICAL_MEASURING_TOOL`, `MANUAL_COUNT`) were extracted from `src/config/footballTestBatteryCatalog.js` and verified to be 100% aligned with `src/services/assessmentBatteryService.js` and `docs/assessment/sql/task03_5/01_task03_5_measurement_method_standardization.sql`.
   - Against the **5 known Production test IDs** (`TST-AGL-ARW`, `TST-BAL-STK`, `TST-MOB-SAR`, `TST-SPR-10M`, `TST-SSB-WAP`), **0 unknown test IDs** exist (`PASS — No mismatch found` within the 5-record subset).
   - **Legacy `NULL` preservation:** The 4 known records with `measurement_method IS NULL` are preserved as `NULL` without backfill or reinterpretation (`PASS`).
   - **Full-table Production verification (`NOT VERIFIED`):** Because this workspace has no live connection to Production Supabase, full-table row count beyond the 5 known records, exact row-level pairing of the 1 non-null `STOPWATCH_MANUAL` record, and JSONB metadata conflict absence across live rows are marked **`NOT VERIFIED` (source information unavailable in workspace)**, with read-only preflight queries provided in Section A.4.

2. **Section B — Security Audit of `public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID)`:**
   - **Two historical definitions exist in the repository** and must be distinguished:
     - **Task 03.0 Definition (`phase_task03_athlete_test_battery_migration.sql` lines 148–204):** **VULNERABLE (`FAIL` if still active in Production).** Does **not** validate `auth.uid()` or caller membership in `check_tenant_id`, and grants `EXECUTE` to `authenticated`. Any authenticated user can invoke `POST /rest/v1/rpc/athlete_belongs_to_tenant` as a **cross-tenant student/class/academy enumeration oracle**.
     - **Task 03.4.3 Remediated Definition (`docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql` lines 112–233):** **HARDENED AGAINST CROSS-TENANT ENUMERATION (`PASS` for cross-tenant boundary).** Enforces `v_caller_role := public.get_strict_tenant_member_role(check_tenant_id)` whenever `auth.uid() IS NOT NULL OR current_user = 'authenticated'`, returning `FALSE` for any caller outside `check_tenant_id`.
   - **Residual Findings on Task 03.4.3 Definition:**
     - **Finding B-1 (Blocker if Production runs Task 03.0 helper):** `01_task03_5_measurement_method_standardization.sql` only checks `to_regprocedure('public.athlete_belongs_to_tenant(uuid,text,uuid,uuid)') IS NOT NULL`; it does **not** verify whether Production has the Task 03.4.3 hardened body or the Task 03.0 vulnerable body.
     - **Finding B-2 (Low/Medium — Intra-Tenant RPC Probing by `kasir`/`staff`):** Because `GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated` is granted, active non-admin members (`kasir`, `staff`) within the **same** tenant can invoke `/rest/v1/rpc/athlete_belongs_to_tenant` directly to probe whether arbitrary `student_id`, `class_id`, and `academy_id` UUIDs exist in their tenant.
     - **Critical Dependency & Regression Warning on `GRANT EXECUTE TO authenticated`:** The frontend (`src/`) **never** calls `athlete_belongs_to_tenant` via RPC (`0` call sites). However, all **4 RLS policies** on `public.athlete_test_results` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) invoke `public.athlete_belongs_to_tenant(...)` directly in their `USING` / `WITH CHECK` clauses. In PostgreSQL, RLS policy expressions execute under the querying role (`authenticated`). **Revoking `EXECUTE` from `authenticated` without first refactoring the 4 RLS policies will immediately break all `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries on `public.athlete_test_results` with `ERROR: 42501: permission denied for function athlete_belongs_to_tenant`.**

3. **Section C — Task 03.5.3 Rollback Readiness (`docs/assessment/sql/task03_5/03_task03_5_rollback.sql`):**
   - Against the captured Production Task 03.4 baseline metadata (`owner = postgres`, `SECURITY DEFINER = true`, `search_path = public, extensions, pg_temp`, `Baseline MD5 = c4f37f81c56d05486bfde58fd645971f`):
   - **6 of 8 rollback criteria `PASS`**, **1 criterion is `PARTIAL / FAIL`**, and **1 criterion is `FAIL (BLOCKER)`**:
     - `03_task03_5_rollback.sql` still contains the placeholder `'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5'` and an empty comment block in Section `[B]` (`/* PASTE EXACT OUTPUT OF pg_get_functiondef(...) HERE */`).
     - Even though the expected baseline MD5 (`c4f37f81c56d05486bfde58fd645971f`) is now known, `pg_get_functiondef()` computes its MD5 over the exact canonical DDL text stored in `pg_proc.prosrc` on Production (exact whitespace, comments, and line breaks). Per strict engineering rules, an approximate function definition **must not** be substituted. The verbatim output of `SELECT pg_get_functiondef('public.validate_and_protect_athlete_test_results()'::regprocedure);` from Production must be pasted into Section `[B]` and `'c4f37f81c56d05486bfde58fd645971f'` set in Sections `[A]` and `[E]` before Task 03.5.3 is executed on Production.

---

## SECTION A — OFFICIAL 18-TEST CATALOG RECONCILIATION

### A.1 Official 18-Test Catalog & Measurement Method Matrix

Source of truth inspected: `src/config/footballTestBatteryCatalog.js` (`FOOTBALL_TEST_BATTERY_CATALOG`, lines 269–1236) and `MEASUREMENT_METHOD_METADATA` (lines 71–116).

| # | Official `test_id` | Canonical `indicator_id` | Test Name | Category | Scoring Model | Unit | Direction | Catalog `requiresMeasurementMethod` Flag | Permitted `supportedMeasurementMethods` (SQL & Service) | `defaultMeasurementMethod` | SQL Insert / Update Enforcement (`01_task03_5`) |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `TST-SPR-10M` | `FTB-UNI-PHY-01` | Akselerasi (Sprint 10m) | `physical` | `MULTI_TRIAL_BEST_MIN` | `s` | `LOWER_IS_BETTER` | `true` | `STOPWATCH_MANUAL`, `SMARTPHONE_VIDEO` | `STOPWATCH_MANUAL` | Dual-method: explicit choice required; must be `STOPWATCH_MANUAL` or `SMARTPHONE_VIDEO` |
| 2 | `TST-AGL-ARW` | `FTB-UNI-PHY-02` | Kelincahan (Arrowhead Agility) | `physical` | `BILATERAL_AVERAGE` | `s` | `LOWER_IS_BETTER` | `false` | `STOPWATCH_MANUAL` | `STOPWATCH_MANUAL` | Single-method: must be `STOPWATCH_MANUAL` |
| 3 | `TST-BAL-STK` | `FTB-UNI-PHY-03` | Keseimbangan (Stork Balance) | `physical` | `BILATERAL_BEST_AVERAGE` | `s` | `HIGHER_IS_BETTER` | `false` | `STOPWATCH_MANUAL` | `STOPWATCH_MANUAL` | Single-method: must be `STOPWATCH_MANUAL` |
| 4 | `TST-MOB-SAR` | `FTB-UNI-PHY-04` | Mobilitas (Sit and Reach) | `physical` | `MULTI_TRIAL_BEST_MAX` | `cm` | `HIGHER_IS_BETTER` | `false` | `PHYSICAL_MEASURING_TOOL` | `PHYSICAL_MEASURING_TOOL` | Single-method: must be `PHYSICAL_MEASURING_TOOL` |
| 5 | `TST-SPR-30M` | `FTB-UNI-PHY-06` | Kecepatan Maksimal (Sprint 30m) | `physical` | `MULTI_TRIAL_BEST_MIN` | `s` | `LOWER_IS_BETTER` | `false` *(Note 1)* | `STOPWATCH_MANUAL`, `SMARTPHONE_VIDEO` | `STOPWATCH_MANUAL` | Dual-method: explicit choice required; must be `STOPWATCH_MANUAL` or `SMARTPHONE_VIDEO` |
| 6 | `TST-RXN-RLR` | `FTB-UNI-PHY-07` | Reaksi (Ruler Drop Reaction) | `physical` | `MULTI_TRIAL_AVERAGE` | `cm` | `LOWER_IS_BETTER` | `false` | `PHYSICAL_MEASURING_TOOL` | `PHYSICAL_MEASURING_TOOL` | Single-method: must be `PHYSICAL_MEASURING_TOOL` |
| 7 | `TST-JMP-VER` | `FTB-UNI-PHY-08` | Lompatan (Vertical Jump) | `physical` | `VERTICAL_JUMP_DELTA` | `cm` | `HIGHER_IS_BETTER` | `false` | `PHYSICAL_MEASURING_TOOL` | `PHYSICAL_MEASURING_TOOL` | Single-method: must be `PHYSICAL_MEASURING_TOOL` |
| 8 | `TST-COD-505` | `FTB-UNI-PHY-09` | Perubahan Arah (505 COD) | `physical` | `BILATERAL_AVERAGE` | `s` | `LOWER_IS_BETTER` | `false` | `STOPWATCH_MANUAL` | `STOPWATCH_MANUAL` | Single-method: must be `STOPWATCH_MANUAL` |
| 9 | `TST-END-BLP` | `FTB-UNI-PHY-10` | Daya Tahan (Bleep Test) | `physical` | `BLEEP_SHUTTLE_LEVEL` | `m` | `HIGHER_IS_BETTER` | `false` | `MANUAL_COUNT` | `MANUAL_COUNT` | Single-method: must be `MANUAL_COUNT` |
| 10 | `TST-PWR-SBJ` | `FTB-UNI-PHY-11` | Daya Ledak (Standing Broad Jump) | `physical` | `MULTI_TRIAL_BEST_MAX` | `cm` | `HIGHER_IS_BETTER` | `false` | `PHYSICAL_MEASURING_TOOL` | `PHYSICAL_MEASURING_TOOL` | Single-method: must be `PHYSICAL_MEASURING_TOOL` |
| 11 | `TST-STR-PU1` | `FTB-UNI-PHY-12` | Kekuatan Tubuh (Push-Up 1 Menit) | `physical` | `SINGLE_TRIAL_MAX` | `reps` | `HIGHER_IS_BETTER` | `false` | `MANUAL_COUNT` | `MANUAL_COUNT` | Single-method: must be `MANUAL_COUNT` |
| 12 | `TST-COR-PLK` | `FTB-UNI-PHY-13` | Kekuatan Inti (Plank Hold) | `physical` | `SINGLE_TRIAL_MAX` | `s` | `HIGHER_IS_BETTER` | `false` | `STOPWATCH_MANUAL` | `STOPWATCH_MANUAL` | Single-method: must be `STOPWATCH_MANUAL` |
| 13 | `TST-RSA-630` | `FTB-UNI-PHY-14` | Sprint Berulang (RSA 6x30m) | `physical` | `RSA_6X30M` | `s` | `LOWER_IS_BETTER` | `false` | `STOPWATCH_MANUAL` | `STOPWATCH_MANUAL` | Single-method: must be `STOPWATCH_MANUAL` |
| 14 | `TST-SHT-DST` | `FTB-UNI-TEC-07` | Kekuatan Tembakan (Shot Distance) | `technical` | `MULTI_TRIAL_BEST_MAX` | `m` | `HIGHER_IS_BETTER` | `false` | `PHYSICAL_MEASURING_TOOL` | `PHYSICAL_MEASURING_TOOL` | Single-method: must be `PHYSICAL_MEASURING_TOOL` |
| 15 | `TST-SSB-WAP` | `FTB-SSB-OUT-02` | Koordinasi Mata-Kaki (Wall Pass) | `position_specific` | `MULTI_TRIAL_BEST_MAX` | `reps` | `HIGHER_IS_BETTER` | `false` | `MANUAL_COUNT` | `MANUAL_COUNT` | Single-method: must be `MANUAL_COUNT` |
| 16 | `TST-SSB-GK-02` | `FTB-SSB-GK-02` | Koordinasi Tangan-Mata (GK Catch) | `position_specific` | `MULTI_TRIAL_BEST_MAX` | `reps` | `HIGHER_IS_BETTER` | `false` | `MANUAL_COUNT` | `MANUAL_COUNT` | Single-method: must be `MANUAL_COUNT` |
| 17 | `TST-SSB-GK-03` | `FTB-SSB-GK-03` | Ketangkasan Gerak Dasar (GK Agility) | `position_specific` | `MULTI_TRIAL_BEST_MIN` | `s` | `LOWER_IS_BETTER` | `false` | `STOPWATCH_MANUAL` | `STOPWATCH_MANUAL` | Single-method: must be `STOPWATCH_MANUAL` |
| 18 | `TST-WF-TLA` | `FTB-POS-WF-01` | Akselerasi Sayap (Touchline Sprint) | `position_specific` | `MULTI_TRIAL_BEST_MIN` | `s` | `LOWER_IS_BETTER` | `false` | `STOPWATCH_MANUAL` | `STOPWATCH_MANUAL` | Single-method: must be `STOPWATCH_MANUAL` |

*Note 1 (`TST-SPR-30M`):* Although the static catalog entry sets `requiresMeasurementMethod: false`, `resolveTestMeasurementMethodConfig()` in `src/config/footballTestBatteryCatalog.js` (line 1252) derives `hasMultipleMeasurementMethods = supportedMeasurementMethods.length > 1` (`true` for `TST-SPR-30M`), and `validateAthleteTestSubmission()` in `src/services/assessmentBatteryService.js` (line 214) requires an explicit measurement method without silent fallback whenever `supportedMeasurementMethods.length > 1`. This matches the SQL trigger and `CHECK` constraint in `01_task03_5_measurement_method_standardization.sql`.

**Summary Distribution Across the 18 Official Tests:**
- **Dual-Method Tests (2):** `TST-SPR-10M`, `TST-SPR-30M` (`STOPWATCH_MANUAL`, `SMARTPHONE_VIDEO`)
- **Single-Method `STOPWATCH_MANUAL` Tests (7):** `TST-AGL-ARW`, `TST-BAL-STK`, `TST-COD-505`, `TST-COR-PLK`, `TST-RSA-630`, `TST-SSB-GK-03`, `TST-WF-TLA`
- **Single-Method `PHYSICAL_MEASURING_TOOL` Tests (5):** `TST-MOB-SAR`, `TST-RXN-RLR`, `TST-JMP-VER`, `TST-PWR-SBJ`, `TST-SHT-DST`
- **Single-Method `MANUAL_COUNT` Tests (4):** `TST-END-BLP`, `TST-STR-PU1`, `TST-SSB-WAP`, `TST-SSB-GK-02`

---

### A.2 Production `athlete_test_results` Data Reconciliation

**Known Production Evidence Provided:**
- 5 known records across test IDs:
  1. `TST-AGL-ARW`
  2. `TST-BAL-STK`
  3. `TST-MOB-SAR`
  4. `TST-SPR-10M`
  5. `TST-SSB-WAP`
- Measurement method distribution across the 5 known records:
  - **1 record** has `measurement_method = 'STOPWATCH_MANUAL'`
  - **4 records** have `measurement_method IS NULL`
- **Scope Boundary:** We do **not** assume that these 5 known records still represent the entire Production `public.athlete_test_results` table at migration time without running a live read-only count/reconciliation query.

| # | Reconciliation Dimension | Known 5-Record Subset Finding | Full Production Table Status | Detailed Analysis & Distinction (`No mismatch found` vs `Not verified`) |
| :- | :--- | :--- | :--- | :--- |
| 1 | **Unknown `test_id`s** | **No mismatch found (0 unknown)** | **`NOT VERIFIED`** *(live table row count/distinct `test_id` not queried from workspace)* | Within the 5 known Production records (`TST-AGL-ARW`, `TST-BAL-STK`, `TST-MOB-SAR`, `TST-SPR-10M`, `TST-SSB-WAP`), **no mismatch found** — all 5 exist in the official 18-test catalog. Whether any additional rows with unknown `test_id`s were inserted in Production after the 5-record snapshot is **not verified because live Production query output is unavailable in workspace**. |
| 2 | **Valid `test_id`s** | **No mismatch found (5 of 5 valid)** | **`NOT VERIFIED`** *(beyond the 5 known rows)* | All 5 known `test_id`s map 1-to-1 to official catalog entries: `TST-SPR-10M` (`FTB-UNI-PHY-01`), `TST-AGL-ARW` (`FTB-UNI-PHY-02`), `TST-BAL-STK` (`FTB-UNI-PHY-03`), `TST-MOB-SAR` (`FTB-UNI-PHY-04`), and `TST-SSB-WAP` (`FTB-SSB-OUT-02`). |
| 3 | **Non-null incompatible `measurement_method`s** | **Conditionally compatible if `STOPWATCH_MANUAL` is on `TST-SPR-10M`, `TST-AGL-ARW`, or `TST-BAL-STK`** | **`NOT VERIFIED`** *(exact `(id, test_id, measurement_method)` pairing unavailable in workspace)* | In the 5-record subset, 1 row has `STOPWATCH_MANUAL`. Under pre-Task 03.5 application logic (`Task 03.3/03.4`), only `TST-SPR-10M` persisted a non-null `measurement_method` (`STOPWATCH_MANUAL` / `SMARTPHONE_VIDEO`), while all other 17 tests persisted `NULL`. For `TST-SPR-10M` (as well as `TST-AGL-ARW` and `TST-BAL-STK`), `STOPWATCH_MANUAL` is **compatible** (**No mismatch found** if attached to any of those 3 tests). However, if `STOPWATCH_MANUAL` were attached to `TST-MOB-SAR` (requires `PHYSICAL_MEASURING_TOOL`) or `TST-SSB-WAP` (requires `MANUAL_COUNT`), `01_task03_5_measurement_method_standardization.sql` Section `[A]` would abort with `ERRCODE 23514`. Exact row pairing on live Production is **not verified because row-level Production query output is unavailable in workspace**. |
| 4 | **Legacy `NULL` `measurement_method`s** | **4 legacy `NULL` records identified & preserved** | **`PASS` (Design) / `NOT VERIFIED` (Live count)** | All 4 known `NULL` records (`TST-AGL-ARW`, `TST-BAL-STK`, `TST-MOB-SAR`, `TST-SSB-WAP`) are **preserved as `NULL`**. `chk_athlete_test_results_measurement_method_compatibility` explicitly allows `measurement_method IS NULL`, and `validate_and_protect_athlete_test_results()` permits `UPDATE` on legacy `NULL` rows when other columns change. No automatic backfill or reinterpretation is performed. |
| 5 | **JSONB `measurementMethod` conflicts** | **`NOT VERIFIED`** | **`NOT VERIFIED`** *(live JSONB payloads unavailable in workspace)* | The JSONB fields (`derived_metrics->>'measurementMethod'`, `derived_metrics->'athleteTestContext'->>'measurementMethod'`, `auxiliary_inputs->>'measurementMethod'`) of the live Production rows are **not verified because source JSONB payloads from Production are unavailable in workspace**. Note: `chk_athlete_test_results_measurement_method_compatibility` only checks the `measurement_method` column on existing rows at `ALTER TABLE` time, whereas JSONB consistency is enforced by `validate_and_protect_athlete_test_results()` on future `INSERT` or `UPDATE` operations. However, if any legacy row has a conflicting JSONB `measurementMethod` and that row is later `UPDATE`d, the trigger will require consistency if `measurement_method` is non-null. |

---

### A.3 Legacy `NULL` Preservation Guarantees

1. **Zero Data Modification in Migration:** `docs/assessment/sql/task03_5/01_task03_5_measurement_method_standardization.sql` contains zero `UPDATE` or `DELETE` statements on `public.athlete_test_results`.
2. **Table `CHECK` Constraint Allows Legacy `NULL`:** `chk_athlete_test_results_measurement_method_compatibility` begins with `CHECK (measurement_method IS NULL OR (...))`, allowing all existing legacy `NULL` records to coexist with strict validation on new rows.
3. **Trigger Protects Legacy `NULL` on Non-Method Updates:** In `public.validate_and_protect_athlete_test_results()`, when `TG_OP = 'UPDATE'` and `OLD.measurement_method IS NULL` and `NEW.measurement_method IS NULL`, the row remains `NULL` without error when updating `notes`, `raw_Result`, `test_date`, etc. Once upgraded to a valid non-null method, downgrading back to `NULL` is blocked (`SQLSTATE 23514`).
4. **Analytics Isolation:** `src/services/assessmentBatteryService.js` (`resolveMeasurementMethodComparisonGroup`, lines 50–67) isolates legacy `NULL` records into `'UNSPECIFIED_MEASUREMENT_METHOD'` so they are never mixed with standardized `STOPWATCH_MANUAL`, `SMARTPHONE_VIDEO`, `PHYSICAL_MEASURING_TOOL`, or `MANUAL_COUNT` series.

---

### A.4 Read-Only Production Reconciliation SQL Query (To Run Before Task 03.5 Migration)

Execute this strictly read-only query in the Supabase SQL Editor before applying Task 03.5.3 to transition the `NOT VERIFIED` items to `PASS`:

```sql
-- READ-ONLY PREFLIGHT RECONCILIATION QUERY FOR PRODUCTION athlete_test_results
WITH official_catalog (test_id, indicator_id, permitted_methods) AS (
  VALUES
    ('TST-SPR-10M',   'FTB-UNI-PHY-01', ARRAY['STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO']),
    ('TST-SPR-30M',   'FTB-UNI-PHY-06', ARRAY['STOPWATCH_MANUAL', 'SMARTPHONE_VIDEO']),
    ('TST-AGL-ARW',   'FTB-UNI-PHY-02', ARRAY['STOPWATCH_MANUAL']),
    ('TST-BAL-STK',   'FTB-UNI-PHY-03', ARRAY['STOPWATCH_MANUAL']),
    ('TST-COD-505',   'FTB-UNI-PHY-09', ARRAY['STOPWATCH_MANUAL']),
    ('TST-COR-PLK',   'FTB-UNI-PHY-13', ARRAY['STOPWATCH_MANUAL']),
    ('TST-RSA-630',   'FTB-UNI-PHY-14', ARRAY['STOPWATCH_MANUAL']),
    ('TST-SSB-GK-03', 'FTB-SSB-GK-03', ARRAY['STOPWATCH_MANUAL']),
    ('TST-WF-TLA',    'FTB-POS-WF-01', ARRAY['STOPWATCH_MANUAL']),
    ('TST-MOB-SAR',   'FTB-UNI-PHY-04', ARRAY['PHYSICAL_MEASURING_TOOL']),
    ('TST-RXN-RLR',   'FTB-UNI-PHY-07', ARRAY['PHYSICAL_MEASURING_TOOL']),
    ('TST-JMP-VER',   'FTB-UNI-PHY-08', ARRAY['PHYSICAL_MEASURING_TOOL']),
    ('TST-PWR-SBJ',   'FTB-UNI-PHY-11', ARRAY['PHYSICAL_MEASURING_TOOL']),
    ('TST-SHT-DST',   'FTB-UNI-TEC-07', ARRAY['PHYSICAL_MEASURING_TOOL']),
    ('TST-END-BLP',   'FTB-UNI-PHY-10', ARRAY['MANUAL_COUNT']),
    ('TST-STR-PU1',   'FTB-UNI-PHY-12', ARRAY['MANUAL_COUNT']),
    ('TST-SSB-WAP',   'FTB-SSB-OUT-02', ARRAY['MANUAL_COUNT']),
    ('TST-SSB-GK-02', 'FTB-SSB-GK-02', ARRAY['MANUAL_COUNT'])
)
SELECT
  r.id,
  r.tenant_id,
  r.test_id,
  r.indicator_id,
  r.measurement_method,
  NULLIF(BTRIM(r.derived_metrics->>'measurementMethod'), '') AS dm_method,
  NULLIF(BTRIM(r.derived_metrics->'athleteTestContext'->>'measurementMethod'), '') AS ctx_method,
  NULLIF(BTRIM(r.auxiliary_inputs->>'measurementMethod'), '') AS aux_method,
  CASE
    WHEN c.test_id IS NULL THEN 'FAIL_UNKNOWN_TEST_ID'
    WHEN r.measurement_method IS NULL THEN 'PASS_LEGACY_NULL'
    WHEN r.measurement_method = ANY(c.permitted_methods) THEN 'PASS_COMPATIBLE_NON_NULL'
    ELSE 'FAIL_INCOMPATIBLE_NON_NULL_METHOD'
  END AS column_compatibility_status,
  CASE
    WHEN (
      NULLIF(BTRIM(r.derived_metrics->>'measurementMethod'), '') IS NOT NULL
      AND r.measurement_method IS NOT NULL
      AND NULLIF(BTRIM(r.derived_metrics->>'measurementMethod'), '') <> r.measurement_method
    ) OR (
      NULLIF(BTRIM(r.derived_metrics->'athleteTestContext'->>'measurementMethod'), '') IS NOT NULL
      AND r.measurement_method IS NOT NULL
      AND NULLIF(BTRIM(r.derived_metrics->'athleteTestContext'->>'measurementMethod'), '') <> r.measurement_method
    ) OR (
      NULLIF(BTRIM(r.auxiliary_inputs->>'measurementMethod'), '') IS NOT NULL
      AND r.measurement_method IS NOT NULL
      AND NULLIF(BTRIM(r.auxiliary_inputs->>'measurementMethod'), '') <> r.measurement_method
    ) THEN 'FAIL_JSONB_COLUMN_CONFLICT'
    WHEN (
      r.measurement_method IS NULL AND (
        (NULLIF(BTRIM(r.derived_metrics->>'measurementMethod'), '') IS NOT NULL AND NOT (NULLIF(BTRIM(r.derived_metrics->>'measurementMethod'), '') = ANY(c.permitted_methods)))
        OR (NULLIF(BTRIM(r.derived_metrics->'athleteTestContext'->>'measurementMethod'), '') IS NOT NULL AND NOT (NULLIF(BTRIM(r.derived_metrics->'athleteTestContext'->>'measurementMethod'), '') = ANY(c.permitted_methods)))
        OR (NULLIF(BTRIM(r.auxiliary_inputs->>'measurementMethod'), '') IS NOT NULL AND NOT (NULLIF(BTRIM(r.auxiliary_inputs->>'measurementMethod'), '') = ANY(c.permitted_methods)))
      )
    ) THEN 'WARN_LEGACY_NULL_HAS_INCOMPATIBLE_JSONB_METHOD'
    ELSE 'PASS_NO_JSONB_CONFLICT'
  END AS jsonb_conflict_status
FROM public.athlete_test_results r
LEFT JOIN official_catalog c ON c.test_id = r.test_id
ORDER BY r.created_at ASC;
```

---

## SECTION B — SECURITY AUDIT OF `public.athlete_belongs_to_tenant()`

### B.1 Function Definitions & Security Metadata Inventory

A repository-wide audit (`grep -rn "athlete_belongs_to_tenant"`) identified **two distinct SQL definitions** across the migration history:

#### 1. Initial Task 03.0 Definition (`phase_task03_athlete_test_battery_migration.sql`, lines 148–204)
- **Signature:** `public.athlete_belongs_to_tenant(check_student_id UUID, check_tenant_id TEXT, check_class_id UUID DEFAULT NULL, check_academy_id UUID DEFAULT NULL) RETURNS BOOLEAN`
- **Owner / Security / `search_path`:** `SECURITY DEFINER`, `SET search_path = public, extensions, pg_temp` (no explicit `ALTER FUNCTION ... OWNER TO postgres` in `phase_task03`).
- **ACL:** `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated;`
- **Body Characteristics:**
  - Checks whether `check_student_id` exists in `public.students` with `tenant_id::text = v_norm_tenant`.
  - Optionally checks whether `check_academy_id` exists in `public.academies` with `tenant_id::text = v_norm_tenant` (without checking `student.academy_id = check_academy_id`).
  - Optionally checks whether `check_class_id` exists in `public.academy_classes` with `tenant_id::text = v_norm_tenant` (without checking `student.class_id = check_class_id`).
  - **CRITICAL OMISSION:** Never checks `auth.uid()` or `public.get_strict_tenant_member_role(check_tenant_id)`.

#### 2. Remediated Task 03.4.3 Definition (`docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql` lines 112–233 & `00_master_task03_4_assessment_battery_migration.sql` lines 344–465)
- **Signature:** `public.athlete_belongs_to_tenant(check_student_id UUID, check_tenant_id TEXT, check_class_id UUID DEFAULT NULL, check_academy_id UUID DEFAULT NULL) RETURNS BOOLEAN`
- **Owner:** `postgres` (`ALTER FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) OWNER TO postgres;`)
- **`SECURITY DEFINER`:** `true`
- **`search_path`:** `SET search_path = public, extensions, pg_temp`
- **ACL:**
  ```sql
  REVOKE ALL ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated;
  ```
- **Schema Qualification & `search_path` Safety Assessment:**
  - Per audit criteria, `SECURITY DEFINER` with `search_path` containing `public` is **not** classified as a vulnerability by itself.
  - Every object referenced inside the Task 03.4.3 function body is **explicitly schema-qualified**:
    - `public.get_strict_tenant_member_role(v_norm_tenant)` (line 141)
    - `public.students s` (line 152)
    - `public.academies a` (line 164)
    - `public.academy_classes ac` (line 178)
    - `public.coaches c` (line 201)
  - `pg_temp` is placed **last** in `search_path = public, extensions, pg_temp`, preventing temporary table/function shadowing by unprivileged roles, and in Supabase PostgreSQL, the `authenticated` and `anon` roles do not have `CREATE` privileges on `schema public`.
  - **Verdict on `SECURITY DEFINER` + `search_path`:** **SAFE (`PASS`)**.

---

### B.2 Complete Repository Call-Site Inventory

| Call Site Category | File & Line Reference | Invocation Pattern | Executing PostgreSQL Role (`current_user`) | Needs `GRANT EXECUTE TO authenticated`? |
| :--- | :--- | :--- | :--- | :--- |
| **1. Frontend / Node.js Services (`src/`)** | *None (`0` matches across `src/`)* | Never called via `supabase.rpc('athlete_belongs_to_tenant', ...)` | N/A | **No** |
| **2. SQL Helper Function (`coach_can_manage_student`)** | `docs/assessment/sql/task03_4/03_security_functions_and_triggers.sql` lines 261 & 269 | `public.athlete_belongs_to_tenant(check_student_id, v_norm_tenant, check_class_id, NULL)` | `postgres` (`coach_can_manage_student` is `SECURITY DEFINER` owned by `postgres`) | **No** |
| **3. SQL Trigger Function (`validate_and_protect_athlete_test_results`)** | `03_security_functions_and_triggers.sql` line 408; `01_task03_5_measurement_method_standardization.sql` line 191 | `public.athlete_belongs_to_tenant(NEW.student_id, v_norm_tenant, NEW.class_id, NEW.academy_id)` | `postgres` (trigger function is `SECURITY DEFINER` owned by `postgres`) | **No** |
| **4. RLS Policy: `athlete_test_results_select_policy`** | `docs/assessment/sql/task03_4/04_rls_policies_and_grants.sql` line 55 | `USING (... AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id) AND ...)` | `authenticated` *(RLS expressions run as the table-querying role)* | **YES (Required while referenced in RLS)** |
| **5. RLS Policy: `athlete_test_results_insert_policy`** | `04_rls_policies_and_grants.sql` line 77 | `WITH CHECK (... AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id) AND ...)` | `authenticated` | **YES (Required while referenced in RLS)** |
| **6. RLS Policy: `athlete_test_results_update_policy`** | `04_rls_policies_and_grants.sql` lines 99 & 110 | `USING (...)` and `WITH CHECK (...)` | `authenticated` | **YES (Required while referenced in RLS)** |
| **7. RLS Policy: `athlete_test_results_delete_policy`** | `04_rls_policies_and_grants.sql` line 132 | `USING (... AND public.athlete_belongs_to_tenant(student_id, tenant_id::text, class_id, academy_id) AND ...)` | `authenticated` | **YES (Required while referenced in RLS)** |

---

### B.3 Answers to the 5 Mandatory Security Audit Questions

#### Question 1: Does `public.athlete_belongs_to_tenant()` validate the caller's `auth.uid()` and active tenant membership?

- **In Task 03.4.3 (`03_security_functions_and_triggers.sql` lines 135–145): YES (with an important execution-context nuance).**
  ```sql
  IF current_user = 'anon' THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NOT NULL OR current_user = 'authenticated' THEN
    v_caller_role := public.get_strict_tenant_member_role(v_norm_tenant);
    IF v_caller_role IS NULL THEN
      RETURN FALSE;
    END IF;
  END IF;
  ```
  - When called directly via PostgREST RPC (`/rest/v1/rpc/athlete_belongs_to_tenant`) or inside an RLS policy by an `authenticated` user, `current_user = 'authenticated'` is `TRUE` and `auth.uid()` is non-null. The function calls `public.get_strict_tenant_member_role(v_norm_tenant)`, which verifies `auth.uid() IS NOT NULL` and checks active membership (`status = 'active'` or legacy `'ACTIVE'`) in `public.tenant_members` or `public.coaches` for `check_tenant_id`.
  - When called inside `validate_and_protect_athlete_test_results()` or `coach_can_manage_student()` (both `SECURITY DEFINER` owned by `postgres`), `current_user` switches to `'postgres'`, **not** `'authenticated'`. However, in any JWT-authenticated Supabase request, `auth.uid()` (which reads `current_setting('request.jwt.claim.sub', true)`) remains populated, so `auth.uid() IS NOT NULL` is still `TRUE` and tenant membership is still enforced. (Only in a SQL Editor / superuser session where both `auth.uid() IS NULL` and `current_user = 'postgres'` is the caller check bypassed, which is deliberate so verification scripts and admin maintenance can run).
- **In Task 03.0 (`phase_task03_athlete_test_battery_migration.sql` lines 148–204): NO.**
  - The Task 03.0 version has zero `auth.uid()` or `get_strict_tenant_member_role` checks.
  - **Production Status (`NOT VERIFIED`):** While the user confirmed `athlete_belongs_to_tenant()` exists in Production as a required dependency of `validate_and_protect_athlete_test_results()`, its exact body/MD5 on Production was not included in the captured metadata. Moreover, `01_task03_5_measurement_method_standardization.sql` (line 45) only checks `to_regprocedure('public.athlete_belongs_to_tenant(uuid,text,uuid,uuid)') IS NOT NULL` and does not verify whether Production's `athlete_belongs_to_tenant()` has been upgraded from Task 03.0 to Task 03.4.3.

---

#### Question 2: Can an authenticated user test student ownership across another tenant?

- **If Production runs the Task 03.4.3 definition: NO (`PASS`).**
  - Any authenticated user who is not an active member of `check_tenant_id` has `v_caller_role IS NULL` and immediately receives `FALSE` at line 143 before `public.students`, `public.academies`, or `public.academy_classes` are ever queried.
- **If Production still runs the Task 03.0 definition: YES (`FAIL — CRITICAL CROSS-TENANT ORACLE`).**
  - Under the Task 03.0 definition, an authenticated user belonging to Tenant A can call `supabase.rpc('athlete_belongs_to_tenant', { check_student_id: '<uuid>', check_tenant_id: '<tenant_b_id>' })` and receive `TRUE` whenever that student belongs to Tenant B.

---

#### Question 3: Can its return value be used as a cross-tenant enumeration oracle?

- **Cross-Tenant Enumeration Oracle:**
  - **Task 03.4.3 Definition:** **NO (`PASS`).** Cross-tenant calls unconditionally return `FALSE` in constant-structure preflight before touching target tenant tables.
  - **Task 03.0 Definition:** **YES (`FAIL`).** Directly leaks whether `(check_student_id, check_tenant_id, check_class_id, check_academy_id)` exist in any foreign tenant.
- **Intra-Tenant Enumeration / Probing Oracle (Residual Finding Even in Task 03.4.3 — `LOW / MEDIUM`):**
  - Because `GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated` is granted, PostgREST exposes `/rest/v1/rpc/athlete_belongs_to_tenant` to all authenticated users.
  - Inside `public.get_strict_tenant_member_role(check_tenant_id)` (`03_security_functions_and_triggers.sql` line 55), valid active roles in `tenant_members` include `'owner'`, `'admin'`, `'staff'`, `'kasir'`, and `'coach'`.
  - Although `'kasir'` and `'staff'` have **no** access to `public.athlete_test_results` (blocked by RLS policies which restrict access to `'owner'`, `'admin'`, and `'coach'`), an active `'kasir'` or `'staff'` user in Tenant A receives `v_caller_role IN ('kasir', 'staff')` (`NOT NULL`) inside `athlete_belongs_to_tenant()`.
  - Furthermore, in lines 175–229 of `03_security_functions_and_triggers.sql`:
    - When `v_caller_role = 'coach'`, the function checks that `check_student_id` is in the coach's assigned `class_id` or `academy_id`.
    - When `v_caller_role <> 'coach'` (which includes `'owner'`, `'admin'`, `'staff'`, and `'kasir'`), lines 175–194 only check that `check_class_id` belongs to the tenant and matches `student.academy_id`, **without** checking `check_class_id = v_student_record.class_id`, and return `TRUE` for any student in the tenant!
  - Consequently, an authenticated `'kasir'` or `'staff'` user (or a `'coach'` probing students within their assigned academy) can call `rpc('athlete_belongs_to_tenant')` directly to enumerate valid `(student_id, academy_id, class_id)` combinations within their own tenant even if table-level RLS on `students` would restrict them.

---

#### Question 4: Which application RPCs, RLS policies, triggers, or helper functions depend on it?

1. **Application RPCs (`src/`):** **None (0 dependencies).** Neither `src/services/assessmentBatteryService.js` nor any other file in `src/` calls `athlete_belongs_to_tenant`.
2. **SQL Helper Functions (1 dependency):**
   - `public.coach_can_manage_student(check_tenant_id TEXT, check_student_id UUID, check_class_id UUID)` calls `public.athlete_belongs_to_tenant(...)` at lines 261 and 269 of `03_security_functions_and_triggers.sql`.
3. **SQL Trigger Functions (1 dependency):**
   - `public.validate_and_protect_athlete_test_results()` calls `public.athlete_belongs_to_tenant(NEW.student_id, v_norm_tenant, NEW.class_id, NEW.academy_id)` on every `INSERT` and `UPDATE` to `public.athlete_test_results`.
4. **RLS Policies on `public.athlete_test_results` (4 dependencies):**
   - `athlete_test_results_select_policy` (`USING`)
   - `athlete_test_results_insert_policy` (`WITH CHECK`)
   - `athlete_test_results_update_policy` (`USING` and `WITH CHECK`)
   - `athlete_test_results_delete_policy` (`USING`)

---

#### Question 5: Is direct `EXECUTE` permission for `authenticated` actually necessary?

- **Technical Answer:**
  1. **For Frontend/Application RPC calls:** **NO.** The application never calls `/rest/v1/rpc/athlete_belongs_to_tenant`.
  2. **For Trigger (`validate_and_protect_athlete_test_results`) and Helper (`coach_can_manage_student`) execution:** **NO.** Both functions are `SECURITY DEFINER` owned by `postgres`, so they invoke `athlete_belongs_to_tenant()` as `postgres`.
  3. **For the Current 4 RLS Policies on `public.athlete_test_results`:** **YES — strictly required as long as those 4 RLS policies reference `public.athlete_belongs_to_tenant(...)` directly.**
     - In PostgreSQL, functions called directly inside a table's `POLICY ... USING (...)` or `WITH CHECK (...)` expression are evaluated using the privileges of the session user querying the table (`authenticated`), **not** the table owner (`postgres`).
     - Therefore, under the current RLS policy definitions in `04_rls_policies_and_grants.sql`, `GRANT EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) TO authenticated` **is technically required** so that `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `public.athlete_test_results` do not fail with `permission denied for function athlete_belongs_to_tenant`.

---

### B.4 Structured Security Findings, Attack Scenarios & Remediation Proposals

*(Note: Per strict Task 03.5.4 boundaries, no permissions or function definitions have been modified in this task.)*

#### Finding B-1: Unverified Production `athlete_belongs_to_tenant()` Version (Task 03.0 vs Task 03.4.3)
- **Severity:** **HIGH / BLOCKER (until verified on Production)**
- **Exact Attack Scenario:**
  - If `public.athlete_belongs_to_tenant()` in Production was created by an earlier deployment (`phase_task03_athlete_test_battery_migration.sql`) and was not replaced with the Task 03.4.3 body, an attacker with any valid `authenticated` account in Tenant A can send:
    ```http
    POST /rest/v1/rpc/athlete_belongs_to_tenant HTTP/1.1
    Authorization: Bearer <Tenant_A_User_JWT>
    Content-Type: application/json

    {
      "check_student_id": "<target_student_uuid>",
      "check_tenant_id": "<target_tenant_b_uuid>",
      "check_class_id": null,
      "check_academy_id": null
    }
    ```
  - The function executes as `postgres` (`SECURITY DEFINER`), bypasses RLS on `public.students`, and returns `true` if the student belongs to Tenant B.
- **Affected Roles:** Any `authenticated` user (`owner`, `admin`, `coach`, `staff`, `kasir`, or even a user with zero tenant memberships).
- **Affected Tenant Boundary:** **Cross-tenant boundary** across `public.students`, `public.academies`, and `public.academy_classes`.
- **Minimal Remediation Proposal:**
  - Before or during Task 03.5 deployment, inspect `pg_get_functiondef('public.athlete_belongs_to_tenant(uuid,text,uuid,uuid)'::regprocedure)` in Production and verify it contains the Task 03.4.3 `public.get_strict_tenant_member_role(v_norm_tenant)` guard and strict `v_caller_role IN ('owner', 'admin', 'coach')` check.

#### Finding B-2: Intra-Tenant Enumeration & Non-Coach Class Mismatch in Task 03.4.3 `athlete_belongs_to_tenant()`
- **Severity:** **LOW / MEDIUM (Hardening Recommendation)**
- **Exact Attack Scenario:**
  1. **Intra-tenant probing by `kasir` / `staff`:** An active `kasir` or `staff` member of Tenant A invokes `POST /rest/v1/rpc/athlete_belongs_to_tenant` with `check_tenant_id = Tenant A`. Because `get_strict_tenant_member_role` returns `'kasir'` or `'staff'` (non-null), `athlete_belongs_to_tenant()` proceeds to query `public.students`, `public.academies`, and `public.academy_classes` as `SECURITY DEFINER`, allowing `kasir`/`staff` to probe student/academy/class existence even though they have no assessment permissions.
  2. **Non-coach class mismatch:** In `03_security_functions_and_triggers.sql` lines 175–194, when `check_class_id IS NOT NULL` and `v_caller_role IN ('owner', 'admin')`, the function verifies that `check_class_id` belongs to the tenant and matches `v_student_record.academy_id`, but only checks `v_student_record.class_id = check_class_id` inside `IF v_caller_role = 'coach'` (line 216). Thus, an `owner`/`admin` could insert an assessment record associating a student with another `class_id` inside the same academy even when `student.class_id` is set to a different class.
- **Affected Roles:** Authenticated `kasir` / `staff` (intra-tenant oracle) and `owner` / `admin` (intra-academy class mismatch).
- **Affected Tenant Boundary:** **Intra-tenant boundary only** (strictly confined within the caller's own active tenant).
- **Minimal Remediation Proposal (Future Hardening Task):**
  1. Inside `public.athlete_belongs_to_tenant()`, restrict `v_caller_role` from `IF v_caller_role IS NULL` to `IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'coach') THEN RETURN FALSE; END IF;`.
  2. Move the `IF v_student_record.class_id IS NOT NULL AND v_student_record.class_id <> check_class_id THEN RETURN FALSE; END IF;` check out of the `IF v_caller_role = 'coach'` block so it applies to `owner` and `admin` as well whenever `check_class_id IS NOT NULL`.
- **Potential Regression Risks if Remediated Improperly:**
  - **CRITICAL WARNING:** Do **NOT** simply run `REVOKE EXECUTE ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM authenticated;` while `04_rls_policies_and_grants.sql` still calls `public.athlete_belongs_to_tenant(...)` in `athlete_test_results_select_policy`, `insert_policy`, `update_policy`, and `delete_policy`. Doing so will cause every `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `public.athlete_test_results` by any authenticated user to fail with `ERROR: 42501: permission denied for function athlete_belongs_to_tenant`.
  - Restricting `v_caller_role NOT IN ('owner', 'admin', 'coach')` inside `athlete_belongs_to_tenant()`, by contrast, has **zero regression risk** for legitimate users because `kasir` and `staff` are already denied access to `athlete_test_results` by RLS.

---

## SECTION C — VERIFY TASK 03.5.3 ROLLBACK READINESS

### C.1 Captured Production Task 03.4 Baseline Metadata

The following Production baseline metadata for `public.validate_and_protect_athlete_test_results()` was provided for verification against `docs/assessment/sql/task03_5/03_task03_5_rollback.sql`:

- **Function Owner:** `postgres`
- **`SECURITY DEFINER`:** `true`
- **`search_path`:** `public, extensions, pg_temp`
- **Baseline MD5 (`md5(pg_get_functiondef('public.validate_and_protect_athlete_test_results()'::regprocedure))`):** `c4f37f81c56d05486bfde58fd645971f`

---

### C.2 Criterion-by-Criterion Audit of `docs/assessment/sql/task03_5/03_task03_5_rollback.sql`

| # | Rollback Readiness Criterion | Status | Code Evidence in `03_task03_5_rollback.sql` & Technical Assessment |
| :- | :--- | :--- | :--- |
| 1 | **Restores the exact captured baseline function definition** | **`FAIL` (BLOCKER)** | Section `[B]` (lines 46–49) currently contains only a comment placeholder (`/* PASTE EXACT OUTPUT OF pg_get_functiondef('public.validate_and_protect_athlete_test_results()'::regprocedure) HERE */`) and no `CREATE OR REPLACE FUNCTION` statement. While the target MD5 hash `c4f37f81c56d05486bfde58fd645971f` is known, `pg_get_functiondef()` computes its MD5 over the exact canonical DDL string stored in Production's `pg_proc` catalog (including exact whitespace, header formatting, and comments). Per strict audit instructions, we **must not substitute an approximate function definition** from workspace files. The verbatim SQL text output of `SELECT pg_get_functiondef('public.validate_and_protect_athlete_test_results()'::regprocedure);` from Production must be pasted into Section `[B]`. |
| 2 | **Verifies the baseline MD5 before applying rollback** | **`FAIL / PARTIAL`** | Lines 25 and 95 still hold the placeholder string `'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5'` instead of `'c4f37f81c56d05486bfde58fd645971f'`. Furthermore, Section `[A]` only checks that the placeholder string was replaced (`v_expected_baseline_md5 = 'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5'`), whereas the actual MD5 comparison (`v_actual_md5 IS DISTINCT FROM v_expected_baseline_md5`) happens in Section `[E]` **after** Section `[B]` executes (though inside the same `BEGIN ... COMMIT` transaction, so any mismatch rolls back the entire transaction). |
| 3 | **Restores the correct function owner and security properties** | **`PASS`** *(once `[B]` is populated)* | Section `[D]` (lines 72–73) explicitly runs `ALTER FUNCTION public.validate_and_protect_athlete_test_results() OWNER TO postgres;` and `REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;`. Section `[E]` (lines 125–158) asserts `v_owner = 'postgres'`, `v_secdef = TRUE`, `search_path=public, extensions, pg_temp`, and verifies zero `EXECUTE` grants to `PUBLIC`, `anon`, or `authenticated`. |
| 4 | **Restores the correct trigger definition and enabled state** | **`PASS`** | Section `[D]` (lines 75–81) drops and recreates `trg_validate_and_protect_athlete_test_results` (`BEFORE INSERT OR UPDATE ON public.athlete_test_results FOR EACH ROW EXECUTE FUNCTION public.validate_and_protect_athlete_test_results()`), and Section `[E]` (lines 160–170) verifies `t.tgenabled <> 'D'` and `t.tgfoid = v_fn_oid`. |
| 5 | **Removes only Task 03.5-specific constraints or objects** | **`PASS`** | Section `[C]` (lines 55–66) drops only `chk_athlete_test_results_measurement_method_compatibility` and restores the pre-Task 03.5 constraint `chk_athlete_test_results_spr10m_method`. |
| 6 | **Does not delete assessment records** | **`PASS`** | Contains zero `DELETE`, `TRUNCATE`, `DROP TABLE`, or `DROP COLUMN` statements. All existing rows (both legacy `NULL` and standardized records) remain intact. *(Note: if any non-`TST-SPR-10M` records with `measurement_method IN ('PHYSICAL_MEASURING_TOOL', 'MANUAL_COUNT')` were inserted after Task 03.5 migration, restoring `chk_athlete_test_results_spr10m_method` in `[C]` only restricts `test_id = 'TST-SPR-10M'`, so new non-`TST-SPR-10M` records do not violate `chk_athlete_test_results_spr10m_method` during rollback).* |
| 7 | **Does not weaken existing RLS or tenant isolation** | **`PASS`** | Does not drop, alter, or disable RLS on `public.athlete_test_results`, nor does it modify `get_strict_tenant_member_role`, `athlete_belongs_to_tenant`, `coach_can_manage_student`, or any RLS policy. |
| 8 | **Fails closed if the exact baseline snapshot is missing or mismatched** | **`PASS`** | Wrapped in a single atomic `BEGIN ... COMMIT` transaction. Section `[A]` raises `EXCEPTION` (`ERRCODE = '42883'`) if the MD5 placeholder is unreplaced; Section `[E]` raises `EXCEPTION` (`ERRCODE = '42501'`) if `md5(pg_get_functiondef(v_fn_oid))` does not equal `v_expected_baseline_md5` (`c4f37f81c56d05486bfde58fd645971f`). If Section `[B]` is left empty while the MD5 hash is set to `c4f37f81c56d05486bfde58fd645971f`, running the rollback after Task 03.5 migration will compute the MD5 of the Task 03.5.3 function, see that it differs from `c4f37f81c56d05486bfde58fd645971f`, and **fail closed (aborting the transaction)**. |

---

## SECTION D — FINAL READINESS MATRIX & REMAINING BLOCKERS

### D.1 Explicit Status Summary Matrix (`PASS` / `FAIL` / `NOT VERIFIED`)

| Check ID | Audit Area | Check Description | Status | Basis / Verification Scope |
| :--- | :--- | :--- | :--- | :--- |
| **A-1** | **Catalog Reconciliation** | All 18 official objective tests extracted from `src/config/footballTestBatteryCatalog.js` and matched with SQL migration & service layer | **`PASS`** | Verified in workspace (`src/config/footballTestBatteryCatalog.js`, `src/services/assessmentBatteryService.js`, `01_task03_5_measurement_method_standardization.sql`) |
| **A-2** | **Catalog Reconciliation** | 5 known Production test IDs (`TST-AGL-ARW`, `TST-BAL-STK`, `TST-MOB-SAR`, `TST-SPR-10M`, `TST-SSB-WAP`) are valid official catalog IDs | **`PASS`** | Verified against official 18-test catalog (**No mismatch found** in the 5-record subset) |
| **A-3** | **Catalog Reconciliation** | Legacy `NULL` measurement methods (4 known Production records) are preserved without backfill or reinterpretation | **`PASS`** | Verified in `01_task03_5` `CHECK` constraint, trigger `UPDATE` logic, and service analytics isolation |
| **A-4** | **Production Data Verification** | Full Production `public.athlete_test_results` table row count, absence of unknown `test_id`s beyond the 5 known rows, exact row pairing of the 1 non-null `STOPWATCH_MANUAL` record, and absence of JSONB `measurementMethod` conflicts | **`NOT VERIFIED`** | Source information unavailable in workspace (requires running the read-only SQL query in Section A.4 on Production Supabase) |
| **B-1** | **Tenant Helper Security** | `public.athlete_belongs_to_tenant()` `SECURITY DEFINER`, `postgres` owner, and `search_path = public, extensions, pg_temp` object qualification safety | **`PASS`** | Verified in `03_security_functions_and_triggers.sql` — all tables/functions explicitly schema-qualified (`public.*`) and `pg_temp` placed last |
| **B-2** | **Tenant Helper Security** | Cross-tenant isolation in Task 03.4.3 `public.athlete_belongs_to_tenant()` (`auth.uid()` + `get_strict_tenant_member_role` enforcement) | **`PASS` (Workspace Task 03.4.3) / `NOT VERIFIED` (Live Production body)** | Task 03.4.3 SQL enforces `get_strict_tenant_member_role(check_tenant_id)`. However, whether live Production runs the Task 03.4.3 body or the vulnerable Task 03.0 body is **not verified** in workspace |
| **B-3** | **Tenant Helper Security** | Intra-tenant RPC exposure of `public.athlete_belongs_to_tenant()` to non-assessment roles (`kasir`, `staff`) and non-coach `class_id` check | **`FAIL (LOW/MEDIUM HARDENING GAP)`** | `GRANT EXECUTE TO authenticated` is required by the 4 RLS policies, but `athlete_belongs_to_tenant()` allows `kasir`/`staff` to pass `v_caller_role IS NOT NULL` and skips `student.class_id = check_class_id` when `v_caller_role <> 'coach'` |
| **C-1** | **Rollback Readiness** | `03_task03_5_rollback.sql` contains the exact verbatim Production baseline DDL for `public.validate_and_protect_athlete_test_results()` matching MD5 `c4f37f81c56d05486bfde58fd645971f` | **`FAIL (BLOCKER)`** | Section `[B]` of `03_task03_5_rollback.sql` is still a comment placeholder (`/* PASTE EXACT OUTPUT ... HERE */`), and lines 25 & 95 still hold `'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5'` |
| **C-2** | **Rollback Readiness** | `03_task03_5_rollback.sql` restores owner (`postgres`), `SECURITY DEFINER`, `search_path`, ACL revokes, trigger enabled state, drops only Task 03.5 constraint, preserves data/RLS, and fails closed on MD5 mismatch | **`PASS`** | Verified in `docs/assessment/sql/task03_5/03_task03_5_rollback.sql` Sections `[A]`, `[C]`, `[D]`, and `[E]` |

---

### D.2 Exact Remaining Blockers Before Task 03.5 Migration on Production

Task 03.5.3 **MUST NOT** be executed on Production until the following **3 blockers** are resolved:

1. **BLOCKER 1 — Populate Verbatim Baseline Function DDL and MD5 (`c4f37f81c56d05486bfde58fd645971f`) in `03_task03_5_rollback.sql`:**
   - Run `SELECT pg_get_functiondef('public.validate_and_protect_athlete_test_results()'::regprocedure);` in Production Supabase (read-only).
   - Paste the exact verbatim `CREATE OR REPLACE FUNCTION ...` output into Section `[B]` of `docs/assessment/sql/task03_5/03_task03_5_rollback.sql`.
   - Replace `'REPLACE_WITH_PRE_TASK03_5_PRODUCTION_MD5'` at lines 25 and 95 of `03_task03_5_rollback.sql` with `'c4f37f81c56d05486bfde58fd645971f'`.
2. **BLOCKER 2 — Execute Read-Only Production Data Reconciliation Query (Section A.4):**
   - Run the read-only query in Section A.4 on Production `public.athlete_test_results` to confirm:
     - Total row count and zero `FAIL_UNKNOWN_TEST_ID` rows across the entire live table.
     - The single `STOPWATCH_MANUAL` record belongs to `TST-SPR-10M` (or `TST-AGL-ARW` / `TST-BAL-STK`), producing zero `FAIL_INCOMPATIBLE_NON_NULL_METHOD` rows.
     - Zero `FAIL_JSONB_COLUMN_CONFLICT` rows exist across live JSONB payloads.
3. **BLOCKER 3 — Verify Active Production Definition of `public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID)`:**
   - Run `SELECT pg_get_functiondef('public.athlete_belongs_to_tenant(uuid,text,uuid,uuid)'::regprocedure);` on Production (read-only) to confirm Production is running the **Task 03.4.3** definition (with `public.get_strict_tenant_member_role(v_norm_tenant)`) and **not** the legacy Task 03.0 definition from `phase_task03_athlete_test_battery_migration.sql`.
