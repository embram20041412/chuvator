import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CHUVATOR — FASE 5.5-B (HARDENING V10)
 * STATIC SCHEMA ASSERTION TEST
 * 
 * Verifies catalog hardening, deterministic index selection,
 * table-specific constraint guards, and format argument alignment.
 */

const SQL_FILE_PATH = path.join(process.cwd(), 'phase5_5_walimurid_schema.sql');

test('FASE 5.5-B: Final Directed Technical Integrity Checks (V10)', async (t) => {
  const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');

  await t.test('1. SQL is complete without placeholders', () => {
    assert.doesNotMatch(sqlContent, /\.\.\./, 'Placeholder "..." detected');
    assert.doesNotMatch(sqlContent, /<line_number>:/, 'Original line numbers detected in content');
  });

  await t.test('2. Correct catalog detection for indnullsnotdistinct persists', () => {
    assert.match(sqlContent, /FROM pg_catalog\.pg_attribute/);
    assert.match(sqlContent, /attrelid = 'pg_catalog\.pg_index'::regclass/);
  });

  await t.test('3. Dynamic SQL Construction for Compatibility persists', () => {
    assert.match(sqlContent, /v_null_clause := CASE WHEN v_has_nulls_not_distinct/);
    assert.match(sqlContent, /\|\| v_null_clause \|\|/);
  });

  await t.test('4. NULL-safe Column Definition Guards persists', () => {
    assert.match(sqlContent, /character_maximum_length IS DISTINCT FROM 64/);
    assert.match(sqlContent, /character_maximum_length IS DISTINCT FROM 4/);
  });

  await t.test('5. Hardened indkey access (0-indexed int2vector) persists', () => {
    assert.doesNotMatch(sqlContent, /\[1:i\.indnkeyatts\]/, 'V5-style array slicing [1:...] detected. V10 requires 0-indexed access.');
    assert.match(sqlContent, /generate_series\(0, i\.indnkeyatts - 1\)/, 'Missing 0-indexed generate_series for indkey attributes');
    assert.match(sqlContent, /i\.indkey\[x\.pos\]/, 'Missing explicit position access to indkey vector');
  });

  await t.test('6. Explicit Column Order Comparison (= instead of @>) persists', () => {
    assert.doesNotMatch(sqlContent, /@> ARRAY/, 'Set operator (@>) detected. V10 requires explicit order equality (=).');
    assert.doesNotMatch(sqlContent, /<@ ARRAY/, 'Set operator (<@) detected. V10 requires explicit order equality (=).');
    
    // Check v_con_query_base comparison
    assert.match(sqlContent, /\) = %s\s*AND\s*\(/, 'Missing explicit order equality in constraint query template');
    
    // Check v_idx_query_base comparison
    assert.match(sqlContent, /\) = %s\s*ORDER BY c_idx\.relname\s*LIMIT 1/, 'Missing explicit order equality or deterministic ORDER BY in index query template');
  });

  await t.test('7. KK Index Guard Hardening (NULL-safe IS DISTINCT FROM) persists', () => {
    assert.match(
      sqlContent, 
      /\) IS DISTINCT FROM ARRAY\['tenant_id', 'kk_hmac'\]/, 
      'KK index guard must use "IS DISTINCT FROM" for NULL-safe array comparison.'
    );
    assert.match(sqlContent, /n_idx\.nspname = 'public' AND n_tbl\.nspname = 'public'/, 'Missing dual namespace guard for KK index');
    assert.match(sqlContent, /i\.indnatts <> 2/, 'KK index guard missing indnatts check to exclude INCLUDE columns');
  });

  await t.test('8. Deterministic Index Candidate Selection (V8+) persists', () => {
    assert.match(sqlContent, /ORDER BY c_idx\.relname/, 'Missing deterministic ORDER BY relname in v_idx_query_base');
  });

  await t.test('9. Strengthened Table-Specific Constraint Guards (V8+) persists', () => {
    // Check parent_accounts constraint guard
    assert.match(
      sqlContent, 
      /JOIN pg_class c ON c\.oid = con\.conrelid\s*JOIN pg_namespace n ON n\.oid = con\.connamespace\s*WHERE n\.nspname = 'public' AND c\.relname = 'parent_accounts' AND con\.conname = 'uq_parent_accounts_tenant_email'/,
      'Missing table-specific constraint guard for tenant_email'
    );
    // Check parent_student_links constraint guard
    assert.match(
      sqlContent, 
      /WHERE n\.nspname = 'public' AND c\.relname = 'parent_student_links' AND con\.conname = 'uq_parent_student_links_composite'/,
      'Missing table-specific constraint guard for student_links'
    );
  });

  await t.test('10. Relation Identity Check in Constraint Search (V10)', () => {
    assert.match(sqlContent, /i\.indrelid = con\.conrelid/, 'Missing explicit relation identity check in constraint search template');
  });

  await t.test('11. INCLUDE Column Exclusion (V9+) persists', () => {
    const matches = sqlContent.match(/i\.indnatts = i\.indnkeyatts/g);
    assert.strictEqual(matches?.length, 2, 'Missing i.indnatts = i.indnkeyatts validation in both query templates');
  });

  await t.test('12. Dynamic SQL Format Argument Alignment (Full 6 Calls Check - V10)', () => {
    // 1. parent_accounts (tenant_id, email) - con
    assert.match(sqlContent, /format\(v_con_query_base, 'parent_accounts', 2, 'ARRAY\[''tenant_id'', ''email''\]', 'ARRAY\[''tenant_id'', ''email''\]'\)/);
    // 2. parent_accounts (tenant_id, email) - idx
    assert.match(sqlContent, /format\(v_idx_query_base, 'parent_accounts', 2, 'ARRAY\[''tenant_id'', ''email''\]'\)/);
    
    // 3. parent_accounts (tenant_id, auth_uid) - con
    assert.match(sqlContent, /format\(v_con_query_base, 'parent_accounts', 2, 'ARRAY\[''tenant_id'', ''auth_uid''\]', 'ARRAY\[''tenant_id'', ''auth_uid''\]'\)/);
    // 4. parent_accounts (tenant_id, auth_uid) - idx
    assert.match(sqlContent, /format\(v_idx_query_base, 'parent_accounts', 2, 'ARRAY\[''tenant_id'', ''auth_uid''\]'\)/);

    // 5. parent_student_links (composite) - con
    assert.match(sqlContent, /format\(v_con_query_base, 'parent_student_links', 3, 'ARRAY\[''tenant_id'', ''parent_account_id'', ''student_id''\]', 'ARRAY\[''tenant_id'', ''parent_account_id'', ''student_id''\]'\)/);
    // 6. parent_student_links (composite) - idx
    assert.match(sqlContent, /format\(v_idx_query_base, 'parent_student_links', 3, 'ARRAY\[''tenant_id'', ''parent_account_id'', ''student_id''\]'\)/);
  });

  await t.test('13. Duplicate Detection persists', () => {
    assert.match(sqlContent, /GROUP BY tenant_id, email/);
    assert.match(sqlContent, /GROUP BY tenant_id, auth_uid/);
    assert.match(sqlContent, /GROUP BY tenant_id, parent_account_id, student_id/);
  });

  await t.test('15. Expression Unique Index Recognition on lower(email) persists', () => {
    assert.match(sqlContent, /v_found_expr_idx_name TEXT;/);
    assert.match(sqlContent, /c_tbl\.relname = 'parent_accounts'/);
    assert.match(sqlContent, /i\.indkey\[1\] = 0/);
    assert.match(sqlContent, /pg_get_expr\(i\.indexprs, i\.indrelid\)/);
    assert.match(sqlContent, /'loweremail'/);
  });

  await t.test('16. Candidate Search Precedes Name Collision Check (4.1, 4.2, 4.3)', () => {
    assert.match(sqlContent, /v_found_idx_name <> 'uq_parent_accounts_tenant_auth_uid'/);
    assert.match(sqlContent, /v_found_idx_name <> 'uq_parent_student_links_composite'/);
  });

  await t.test('17. Runtime Validation Status', () => {
    console.log('\n[STATUS] PostgreSQL Integration Test (Runtime) NOT AVAILABLE in this environment.');
    console.log('[STATUS] Validation is 100% STATIC (Regex-based Integrity).\n');
  });
});
