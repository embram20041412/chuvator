# CHUVATOR — PHASE 2.0 TEST EVIDENCE & REGRESSION REPORT

## 1. Executive Test Summary

- **Analytics Engine Unit Tests (`src/services/analyticsEngine.test.js`)**: **13 / 13 PASS (100%)**
- **Phase 1.0 Acceptance Regression Tests (`src/config/phase1Acceptance.test.js`)**: **3 / 3 PASS (100%)**
- **Applet Compilation (`npm run build`)**: **PASS (0 Errors)**
- **TypeScript Check (`tsc --noEmit`)**: **PASS (0 Errors)**

---

## 2. Analytics Engine Test Suite Execution Output

Perintah: `npx --yes tsx --test src/services/analyticsEngine.test.js`

```text
TAP version 13
# Subtest: 1. Missing score (null) === UNTESTED vs Valid 0 score
ok 1 - 1. Missing score (null) === UNTESTED vs Valid 0 score
# Subtest: 2. Partial vs Complete evaluation coverage
ok 2 - 2. Partial vs Complete evaluation coverage
# Subtest: 3. Tenant Isolation Negative Test (Tenant A vs Tenant B)
ok 3 - 3. Tenant Isolation Negative Test (Tenant A vs Tenant B)
# Subtest: 4. Cross-sport comparison rejection
ok 4 - 4. Cross-sport comparison rejection
# Subtest: 5. Position/event mismatch handling
ok 5 - 5. Position/event mismatch handling
# Subtest: 6. Insufficient longitudinal data handling
ok 6 - 6. Insufficient longitudinal data handling
# Subtest: 7. Chronological ordering of evaluations
ok 7 - 7. Chronological ordering of evaluations
# Subtest: 8. Invalid score detection (>100 or <0 or NaN)
ok 8 - 8. Invalid score detection (>100 or <0 or NaN)
# Subtest: 9. Empty dataset handling
ok 9 - 9. Empty dataset handling
# Subtest: 10. Historical legacy score resolution
ok 10 - 10. Historical legacy score resolution
# Subtest: 11. Integration Contract for Desktop and Mobile components
ok 11 - 11. Integration Contract for Desktop and Mobile components
# Subtest: 12. Report payload completeness
ok 12 - 12. Report payload completeness
# Subtest: 13. Longitudinal Integrity: Position change, tier change, coverage shift, and established trend rules
ok 13 - 13. Longitudinal Integrity: Position change, tier change, coverage shift, and established trend rules
1..13
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 440.078376
```

---

## 3. Phase 1.0 Acceptance Regression Test Output

Perintah: `npx --yes tsx --test src/config/phase1Acceptance.test.js`

```text
TAP version 13
# Subtest: A. Resolver & Missing Score — Canonical Priority, Legacy Fallback, Valid 0, and Null Untested
ok 1 - A. Resolver & Missing Score — Canonical Priority, Legacy Fallback, Valid 0, and Null Untested
# Subtest: B. Registry Reconciliation — Exact Counts, Uniqueness, and Metadata Completeness
ok 2 - B. Registry Reconciliation — Exact Counts, Uniqueness, and Metadata Completeness
# Subtest: D. Age & Tier Regression Testing — ISO, Empty, Invalid, DD/MM/YYYY, and Future Dates
ok 3 - D. Age & Tier Regression Testing — ISO, Empty, Invalid, DD/MM/YYYY, and Future Dates
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 499.228396
```

---

## 4. Build and Typecheck Evidence

- **`compile_applet`**: `Build succeeded - the applet is compiled`
- **`lint_applet`**: `Linting completed successfully` (`$ tsc --noEmit`)
