import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  TEST_INPUT_SCHEMA_TYPES,
  SPRINT_MEASUREMENT_METHODS
} from '../src/config/footballTestBatteryCatalog.js';
import { SCORE_CALIBRATION_STATUS } from '../src/services/assessmentScoreConverter.js';

const SQL_DIR = path.resolve(process.cwd(), 'docs/assessment/sql/task03_4');

const EXPECTED_FILES = [
  '00_master_task03_4_assessment_battery_migration.sql',
  '01_preflight_inspection.sql',
  '02_core_table_and_indexes.sql',
  '03_security_functions_and_triggers.sql',
  '04_rls_policies_and_grants.sql',
  '05_calibration_compatibility.sql',
  '06_post_migration_verification.sql',
  '07_rollback_plan.sql'
];

function readSql(filename) {
  return fs.readFileSync(path.join(SQL_DIR, filename), 'utf8');
}

test('Task 03.4 (1): Seluruh 8 file paket migrasi SQL tersedia dan tidak kosong', () => {
  for (const file of EXPECTED_FILES) {
    const fullPath = path.join(SQL_DIR, file);
    assert.equal(fs.existsSync(fullPath), true, `File SQL hilang: ${file}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.trim().length > 200, `File SQL terlalu pendek: ${file}`);
  }
});

test('Task 03.4 (2): 01_preflight_inspection.sql bersifat 100% read-only tanpa DDL/DML destruktif', () => {
  const preflight = readSql('01_preflight_inspection.sql');
  assert.equal(/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/i.test(preflight), false);
  for (const depTable of [
    'platform_superadmins',
    'tenants',
    'users_staff',
    'academies',
    'academy_classes',
    'coaches',
    'students',
    'athlete_test_results'
  ]) {
    assert.ok(preflight.includes(`'${depTable}'`), `Preflight harus mengecek tabel ${depTable}`);
  }
});

test('Task 03.4 (3): Master SQL kompatibel 100% dengan seluruh kolom payload assessmentBatteryService & Task 03.3', () => {
  const master = readSql('00_master_task03_4_assessment_battery_migration.sql');
  const serviceSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/services/assessmentBatteryService.js'),
    'utf8'
  );

  // Ekstrak key dbRow dari assessmentBatteryService.js
  const dbRowMatch = serviceSource.match(/const dbRow = \{([\s\S]*?)\};/);
  assert.ok(dbRowMatch, 'dbRow harus ditemukan di assessmentBatteryService.js');
  const dbRowKeys = [...dbRowMatch[1].matchAll(/^\s{4}([a-z0-9_]+):/gm)].map((m) => m[1]);
  assert.ok(dbRowKeys.length >= 25, `Jumlah key dbRow minimal 25 (aktual: ${dbRowKeys.length})`);

  for (const col of dbRowKeys) {
    assert.ok(
      new RegExp(`\\b${col}\\b`).test(master),
      `Kolom payload service "${col}" tidak ditemukan di Master SQL`
    );
  }

  // Pastikan 4 kolom konteks terindeks Task 03.3/03.4 juga tersedia & disinkronkan
  for (const ctxCol of ['measurement_method', 'age_years_at_test', 'age_group', 'test_period']) {
    assert.ok(master.includes(ctxCol), `Kolom konteks "${ctxCol}" harus ada di Master SQL`);
  }

  // Pastikan seluruh indeks yang dibutuhkan query aplikasi tersedia
  for (const idxName of [
    'idx_athlete_test_results_tenant_student_date',
    'idx_athlete_test_results_tenant_indicator',
    'idx_athlete_test_results_tenant_class',
    'idx_athlete_test_results_tenant_test_date',
    'idx_athlete_test_results_norms_recap',
    'idx_athlete_test_results_calibration_status'
  ]) {
    assert.ok(master.includes(idxName), `Index "${idxName}" harus ada di Master SQL`);
  }
});

test('Task 03.4 (4): Master SQL memenuhi seluruh kontrol keamanan RLS, RBAC, Trigger Immutability & Function Grants', () => {
  const master = readSql('00_master_task03_4_assessment_battery_migration.sql');

  // RLS & FORCE RLS
  assert.ok(master.includes('ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;'));
  assert.ok(master.includes('ALTER TABLE public.athlete_test_results FORCE ROW LEVEL SECURITY;'));
  assert.ok(master.includes('REVOKE ALL ON TABLE public.athlete_test_results FROM PUBLIC, anon;'));
  assert.ok(master.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.athlete_test_results TO authenticated;'));

  // 4 Policies TO authenticated & tanpa ekspresi permisif
  for (const pol of [
    'athlete_test_results_select_policy',
    'athlete_test_results_insert_policy',
    'athlete_test_results_update_policy',
    'athlete_test_results_delete_policy'
  ]) {
    assert.ok(master.includes(pol), `Policy "${pol}" wajib ada`);
  }
  assert.equal(/USING\s*\(\s*true\s*\)/i.test(master), false, 'Dilarang ada USING (true)');
  assert.equal(/WITH CHECK\s*\(\s*true\s*\)/i.test(master), false, 'Dilarang ada WITH CHECK (true)');

  // SECURITY DEFINER + safe search_path + REVOKE FROM PUBLIC, anon
  assert.ok(master.includes('SET search_path = public, extensions, pg_temp'));
  assert.ok(master.includes('REVOKE ALL ON FUNCTION public.get_strict_tenant_member_role(TEXT) FROM PUBLIC, anon;'));
  assert.ok(master.includes('REVOKE ALL ON FUNCTION public.athlete_belongs_to_tenant(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;'));
  assert.ok(master.includes('REVOKE ALL ON FUNCTION public.coach_can_manage_student(TEXT, UUID, UUID) FROM PUBLIC, anon;'));
  assert.ok(master.includes('REVOKE ALL ON FUNCTION public.validate_and_protect_athlete_test_results() FROM PUBLIC, anon, authenticated;'));

  // Anti-spoofing class & tenant & immutability
  assert.ok(master.includes('IF v_student_class_id IS NULL THEN'));
  assert.ok(master.includes('IF NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id') || master.includes('OLD.recorded_by_user_id IS NOT NULL AND NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id'));
  assert.ok(master.includes('IF NEW.test_id IS DISTINCT FROM OLD.test_id'));
  assert.ok(master.includes('IF NEW.indicator_id IS DISTINCT FROM OLD.indicator_id'));
});

test('Task 03.4 (5): Kompatibilitas Calibration Status & Measurement Method selaras dengan Converter & Catalog', () => {
  const calSql = readSql('05_calibration_compatibility.sql');
  const coreSql = readSql('02_core_table_and_indexes.sql');

  for (const status of Object.values(SCORE_CALIBRATION_STATUS)) {
    assert.ok(coreSql.includes(`'${status}'`), `coreSql harus mendukung status ${status}`);
    assert.ok(calSql.includes(`'${status}'`), `calSql harus mendukung status ${status}`);
  }
  assert.ok(calSql.includes('chk_athlete_test_results_calibration_consistency'));

  for (const method of Object.values(SPRINT_MEASUREMENT_METHODS)) {
    assert.ok(coreSql.includes(`'${method}'`), `coreSql harus mendukung metode ${method}`);
  }

  // Pastikan tidak ada UNIQUE constraint yang memblokir longitudinal atau dua metode di tanggal sama
  assert.equal(/UNIQUE\s*\([^)]*student_id[^)]*test_date/i.test(coreSql), false);
  assert.ok(Object.keys(TEST_INPUT_SCHEMA_TYPES).length >= 9);
});

test('Task 03.4 (6): Post-migration verification mencakup 8 skenario peran dalam BEGIN..ROLLBACK & Rollback aman tanpa DROP TABLE', () => {
  const verifySql = readSql('06_post_migration_verification.sql');
  const rollbackSql = readSql('07_rollback_plan.sql');

  assert.ok(verifySql.includes('BEGIN;'));
  assert.ok(verifySql.includes('ROLLBACK;'));
  for (let i = 1; i <= 8; i += 1) {
    assert.ok(verifySql.includes(`TEST ${i}:`), `Skenario TEST ${i} wajib ada di verification SQL`);
  }

  // Rollback tidak boleh melakukan DROP TABLE / TRUNCATE destruktif secara otomatis
  const activeRollbackLines = rollbackSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.equal(/\bDROP\s+TABLE\b/i.test(activeRollbackLines), false, 'Rollback aman dilarang menjalankan DROP TABLE aktif');
  assert.equal(/\bTRUNCATE\b/i.test(activeRollbackLines), false, 'Rollback aman dilarang menjalankan TRUNCATE');
});
