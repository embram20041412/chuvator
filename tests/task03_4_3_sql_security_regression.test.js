import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SQL_DIR = path.resolve(process.cwd(), 'docs/assessment/sql/task03_4');

function readSql(filename) {
  return fs.readFileSync(path.join(SQL_DIR, filename), 'utf8');
}

function stripSqlCommentsAndWhitespace(sql) {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\bBEGIN\s*;/gi, '')
    .replace(/\bCOMMIT\s*;/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBodyBetween(source, startMarker, endMarker) {
  const startIdx = source.indexOf(startMarker);
  assert.ok(startIdx !== -1, `Marker awal tidak ditemukan: ${startMarker}`);
  const afterStart = source.slice(startIdx + startMarker.length);
  if (!endMarker) return afterStart;
  const endIdx = afterStart.indexOf(endMarker);
  assert.ok(endIdx !== -1, `Marker akhir tidak ditemukan: ${endMarker}`);
  return afterStart.slice(0, endIdx);
}

test('Task 03.4.3 (A): Eksekusi transaksional BEGIN..COMMIT & proteksi RLS fail-closed langsung pada 02..05', () => {
  for (const file of [
    '00_master_task03_4_assessment_battery_migration.sql',
    '02_core_table_and_indexes.sql',
    '03_security_functions_and_triggers.sql',
    '04_rls_policies_and_grants.sql',
    '05_calibration_compatibility.sql'
  ]) {
    const sql = readSql(file);
    assert.ok(/^\s*(?:--[^\n]*\n)*\s*BEGIN;/m.test(sql), `${file} wajib diawali BEGIN;`);
    assert.ok(/COMMIT;\s*$/m.test(sql), `${file} wajib diakhiri COMMIT;`);
  }

  // Temuan #5: 02_core_table_and_indexes.sql wajib mengunci RLS + REVOKE langsung setelah CREATE TABLE
  const coreSql = readSql('02_core_table_and_indexes.sql');
  const createPos = coreSql.indexOf('CREATE TABLE IF NOT EXISTS public.athlete_test_results');
  const enableRlsPos = coreSql.indexOf('ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;');
  const forceRlsPos = coreSql.indexOf('ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;');
  const revokePos = coreSql.indexOf('REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon, authenticated;');
  const idxPos = coreSql.indexOf('CREATE INDEX IF NOT EXISTS idx_athlete_test_results_tenant_student_date');

  assert.ok(createPos > 0);
  assert.ok(enableRlsPos > createPos && enableRlsPos < idxPos, 'ENABLE RLS harus langsung setelah CREATE TABLE di 02');
  assert.ok(forceRlsPos > createPos && forceRlsPos < idxPos, 'FORCE RLS harus langsung setelah CREATE TABLE di 02');
  assert.ok(revokePos > createPos && revokePos < idxPos, 'REVOKE ALL harus langsung setelah CREATE TABLE di 02');
});

test('Task 03.4.3 (B): Konsistensi 100% isi & urutan statement antara 00_master dan modul 02..05', () => {
  const master = readSql('00_master_task03_4_assessment_battery_migration.sql');
  const mod02 = readSql('02_core_table_and_indexes.sql').replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;', '');
  const mod03 = readSql('03_security_functions_and_triggers.sql');
  const mod04 = readSql('04_rls_policies_and_grants.sql');
  const mod05 = readSql('05_calibration_compatibility.sql');

  const masterSec12 = extractBodyBetween(
    master,
    '-- [1] DEPENDENCY PREFLIGHT GATE',
    '-- [3] HARDENED SECURITY FUNCTIONS, OWNER, TRIGGER & SAFE BACKFILL'
  );
  const masterSec3 = extractBodyBetween(
    master,
    '-- [3] HARDENED SECURITY FUNCTIONS, OWNER, TRIGGER & SAFE BACKFILL',
    '-- [4] STRICT RLS POLICIES & LEAST-PRIVILEGE TABLE GRANTS'
  );
  const masterSec4 = extractBodyBetween(
    master,
    '-- [4] STRICT RLS POLICIES & LEAST-PRIVILEGE TABLE GRANTS',
    '-- [5] CALIBRATION & SCORE ENGINE COMPATIBILITY'
  );
  const masterSec5 = extractBodyBetween(
    master,
    '-- [5] CALIBRATION & SCORE ENGINE COMPATIBILITY',
    null
  );

  assert.equal(
    stripSqlCommentsAndWhitespace(masterSec12),
    stripSqlCommentsAndWhitespace(mod02),
    'Blok [1]+[2] pada 00_master wajib identik dengan 02_core_table_and_indexes.sql'
  );
  assert.equal(
    stripSqlCommentsAndWhitespace(masterSec3),
    stripSqlCommentsAndWhitespace(mod03),
    'Blok [3] pada 00_master wajib identik dengan 03_security_functions_and_triggers.sql'
  );
  assert.equal(
    stripSqlCommentsAndWhitespace(masterSec4),
    stripSqlCommentsAndWhitespace(mod04),
    'Blok [4] pada 00_master wajib identik dengan 04_rls_policies_and_grants.sql'
  );
  assert.equal(
    stripSqlCommentsAndWhitespace(masterSec5),
    stripSqlCommentsAndWhitespace(mod05),
    'Blok [5] pada 00_master wajib identik dengan 05_calibration_compatibility.sql'
  );
});

test('Task 03.4.3 (C — Temuan #1 & #2): coach_can_manage_student() 100% Fail-Closed & Policy SELECT membatasi Coach ke kelasnya', () => {
  for (const file of ['03_security_functions_and_triggers.sql', '00_master_task03_4_assessment_battery_migration.sql']) {
    const sql = readSql(file);
    const fnBody = extractBodyBetween(sql, 'CREATE OR REPLACE FUNCTION public.coach_can_manage_student(', 'CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results(');

    // Dilarang ada bypass fail-open
    assert.equal(/v_has_assigned_classes/i.test(fnBody), false, `${file}: v_has_assigned_classes bypass harus dihapus`);
    assert.equal(/IF\s+v_coach_id\s+IS\s+NULL\s+THEN\s+RETURN\s+TRUE/i.test(fnBody), false, `${file}: v_coach_id IS NULL dilarang RETURN TRUE`);
    assert.ok(/IF\s+v_coach_id\s+IS\s+NULL\s+THEN\s+RETURN\s+FALSE;/i.test(fnBody), `${file}: v_coach_id IS NULL wajib RETURN FALSE`);
    assert.ok(/IF\s+v_student_class_id\s+IS\s+NULL\s+THEN\s+RETURN\s+FALSE;/i.test(fnBody), `${file}: v_student_class_id IS NULL wajib RETURN FALSE`);
    assert.ok(/check_class_id\s+IS\s+DISTINCT\s+FROM\s+v_student_class_id/i.test(fnBody), `${file}: wajib memblokir mismatch check_class_id vs v_student_class_id`);
    assert.ok(/COALESCE\(\(to_jsonb\(cls\)->>'is_archived'\)::boolean,\s*FALSE\)\s*=\s*FALSE/i.test(fnBody), `${file}: wajib mengecualikan kelas arsip`);
  }

  // Temuan #2: Policy SELECT wajib memanggil coach_can_manage_student untuk role coach
  for (const file of ['04_rls_policies_and_grants.sql', '00_master_task03_4_assessment_battery_migration.sql']) {
    const sql = readSql(file);
    const selectPolicy = extractBodyBetween(sql, 'CREATE POLICY athlete_test_results_select_policy', 'DROP POLICY IF EXISTS athlete_test_results_insert_policy');
    assert.ok(selectPolicy.includes("IN ('owner', 'admin', 'staff', 'kasir')"), `${file}: SELECT policy harus tetap mengizinkan owner/admin/staff/kasir`);
    assert.ok(selectPolicy.includes("= 'coach'") && selectPolicy.includes('public.coach_can_manage_student(tenant_id::text, student_id, class_id)'), `${file}: SELECT policy wajib membatasi coach via coach_can_manage_student`);
  }
});

test('Task 03.4.3 (D — Temuan #3, #4 & #8): Anti-enumerasi RPC, Validasi coach_id & academy_id, dan OWNER TO postgres', () => {
  for (const file of ['03_security_functions_and_triggers.sql', '00_master_task03_4_assessment_battery_migration.sql']) {
    const sql = readSql(file);
    const belongsFn = extractBodyBetween(sql, 'CREATE OR REPLACE FUNCTION public.athlete_belongs_to_tenant(', 'CREATE OR REPLACE FUNCTION public.coach_can_manage_student(');

    assert.ok(belongsFn.includes("IF current_user = 'anon' THEN"), `${file}: athlete_belongs_to_tenant wajib menolak anon`);
    assert.ok(belongsFn.includes('v_caller_role := public.get_strict_tenant_member_role(check_tenant_id);'), `${file}: athlete_belongs_to_tenant wajib memvalidasi caller role untuk RPC`);
    assert.ok(belongsFn.includes('check_academy_id IS DISTINCT FROM v_student_record.academy_id'), `${file}: wajib memvalidasi konsistensi student.academy_id`);
    assert.ok(belongsFn.includes('v_class_record.academy_id IS DISTINCT FROM v_student_record.academy_id'), `${file}: wajib memvalidasi konsistensi class.academy_id vs student.academy_id`);

    // Validasi coach_id dan audit lock penuh di trigger
    const trigFn = extractBodyBetween(sql, 'CREATE OR REPLACE FUNCTION public.validate_and_protect_athlete_test_results(', 'OWNER TO postgres');
    assert.ok(trigFn.includes('NEW.coach_id'), `${file}: trigger wajib memvalidasi coach_id`);
    assert.ok(trigFn.includes('c.id = NEW.coach_id') && trigFn.includes('trim(c.tenant_id::text) = trim(NEW.tenant_id)'), `${file}: trigger wajib memastikan coach_id milik NEW.tenant_id`);
    assert.ok(trigFn.includes('IF NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id THEN'), `${file}: mutasi recorded_by_user_id (termasuk NULL->UUID) wajib dilarang`);
    assert.equal(trigFn.includes('OLD.recorded_by_user_id IS NOT NULL'), false, `${file}: celah OLD.recorded_by_user_id IS NOT NULL harus dihapus`);
    assert.ok(trigFn.includes('IF NEW.recorded_by_name IS DISTINCT FROM OLD.recorded_by_name THEN'), `${file}: mutasi recorded_by_name wajib dilarang`);

    // Temuan #8: OWNER TO postgres untuk seluruh fungsi SECURITY DEFINER
    for (const fnSig of [
      'public.get_strict_tenant_member_role(TEXT)',
      'public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID)',
      'public.coach_can_manage_student(TEXT, UUID, UUID)',
      'public.validate_and_protect_athlete_test_results()'
    ]) {
      assert.ok(sql.includes(`ALTER FUNCTION ${fnSig} OWNER TO postgres;`), `${file}: OWNER TO postgres wajib ditetapkan pada ${fnSig}`);
    }
  }
});

test('Task 03.4.3 (E — Temuan #6 & #7): Backfill tidak memicu trigger updated_at, nested CASE integer cast, & sinkronisasi UPDATE JSONB', () => {
  for (const file of ['03_security_functions_and_triggers.sql', '00_master_task03_4_assessment_battery_migration.sql']) {
    const sql = readSql(file);

    const dropTrigBeforeBackfill = sql.lastIndexOf('DROP TRIGGER IF EXISTS trg_validate_and_protect_athlete_test_results ON public.athlete_test_results;');
    const backfillPos = sql.indexOf('-- Backfill aman konteks terindeks') !== -1
      ? sql.indexOf('-- Backfill aman konteks terindeks')
      : sql.indexOf('UPDATE public.athlete_test_results');
    const createTrigPos = sql.indexOf('CREATE TRIGGER trg_validate_and_protect_athlete_test_results');

    assert.ok(dropTrigBeforeBackfill !== -1 && backfillPos !== -1 && createTrigPos !== -1);
    assert.ok(dropTrigBeforeBackfill < backfillPos, `${file}: DROP TRIGGER harus sebelum UPDATE backfill`);
    assert.ok(backfillPos < createTrigPos, `${file}: CREATE TRIGGER harus SETELAH UPDATE backfill agar updated_at historis utuh`);

    // Nested CASE around ::integer cast in backfill
    const backfillSql = sql.slice(backfillPos, createTrigPos);
    assert.equal(/\)\s*~\s*'\^\\d\{1,2\}\$'\s+AND\s+.*::integer/i.test(backfillSql), false, `${file}: Dilarang menggabung regex dan ::integer cast dalam 1 AND pada backfill`);
    assert.ok(/CASE\s+WHEN[\s\S]*~\s*'\^\\d\{1,2\}\$'\s+THEN\s+CASE\s+WHEN[\s\S]*::integer\s+BETWEEN\s+3\s+AND\s+65/i.test(backfillSql), `${file}: Backfill wajib memakai nested CASE`);

    // Pastikan backfill tidak pernah menyentuh updated_at, final_raw_value, trials, converted_score
    assert.equal(/\bupdated_at\s*=/i.test(backfillSql), false);
    assert.equal(/\bfinal_raw_value\s*=/i.test(backfillSql), false);
    assert.equal(/\btrials\s*=/i.test(backfillSql), false);
    assert.equal(/\bconverted_score\s*=/i.test(backfillSql), false);

    // Sinkronisasi ulang konteks pada UPDATE saat derived_metrics/auxiliary_inputs berubah
    assert.ok(sql.includes('v_method_json_changed'), `${file}: trigger wajib mendeteksi perubahan metode di derived_metrics saat UPDATE`);
    assert.ok(sql.includes('v_age_group_json_changed'), `${file}: trigger wajib mendeteksi perubahan ageGroup di derived_metrics saat UPDATE`);
    assert.ok(sql.includes('v_age_years_json_changed'), `${file}: trigger wajib mendeteksi perubahan ageYearsAtTest di derived_metrics saat UPDATE`);
  }

  // Pastikan 02 melakukan sanitasi measurement_method whitespace sebelum constraint
  const coreSql = readSql('02_core_table_and_indexes.sql');
  const sanitizePos = coreSql.indexOf('UPDATE public.athlete_test_results');
  const constraintPos = coreSql.indexOf('chk_athlete_test_results_spr10m_method');
  assert.ok(sanitizePos > 0 && sanitizePos < constraintPos, '02 wajib menormalisasi whitespace measurement_method sebelum constraint');
});

test('Task 03.4.3 (F — Temuan #9 & #10): Preflight tahan schema missing/legacy & Verification mencakup 19 skenario lengkap', () => {
  const preflight = readSql('01_preflight_inspection.sql');
  const preflightTopLevelSql = preflight.replace(/'(?:''|[^'])*'/g, "''");
  assert.equal(/\bFROM\s+public\.(students|academy_classes|coaches|tenants|athlete_test_results)\b/i.test(preflightTopLevelSql), false, 'Preflight dilarang query langsung FROM public.<table> tanpa guard to_regclass/query_to_xml');
  assert.ok(preflight.includes('pg_catalog.query_to_xml') || preflight.includes('query_to_xml'));
  assert.ok(preflight.includes('coaches_missing_auth_uid'));
  assert.ok(preflight.includes('legacy_invalid_calibration_rows'));
  assert.ok(preflight.includes('legacy_spr10m_invalid_top_method_rows'));
  assert.ok(preflight.includes('legacy_cross_tenant_coach_rows'));

  const verifySql = readSql('06_post_migration_verification.sql');
  for (let i = 1; i <= 19; i += 1) {
    assert.ok(verifySql.includes(`TEST ${i}:`), `Verification SQL wajib memuat skenario TEST ${i}`);
  }
  assert.ok(verifySql.includes("PERFORM set_config('role', 'anon', true);"), 'Verification SQL wajib menguji role anon');
  assert.ok(verifySql.includes('v_tenant_c'), 'Verification SQL wajib menguji tenant non-aktif');
  assert.ok(verifySql.includes('v_coach_noclass_uid'), 'Verification SQL wajib menguji coach tanpa kelas aktif');
  assert.ok(verifySql.includes('v_coach_unlinked_uid'), 'Verification SQL wajib menguji coach tanpa relasi coaches');
  assert.ok(verifySql.includes('pg_get_userbyid(p.proowner) AS owner_role'), 'Bagian A5 verification wajib mengaudit owner fungsi');
});
