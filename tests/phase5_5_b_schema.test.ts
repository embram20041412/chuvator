import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CHUVATOR — FASE 5.5-B
 * STATIC SCHEMA ASSERTION TEST
 */

const SQL_FILE_PATH = path.join(process.cwd(), 'phase5_5_walimurid_schema.sql');

test('FASE 5.5-B: Static SQL Integrity Checks', async (t) => {
  const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');

  await t.test('1. KK HMAC column definition exists in students table', () => {
    assert.match(sqlContent, /ALTER TABLE public\.students ADD COLUMN kk_hmac VARCHAR\(64\)/);
    assert.match(sqlContent, /column_name = 'kk_hmac'/);
  });

  await t.test('2. KK Last-4 column definition exists in students table', () => {
    assert.match(sqlContent, /ALTER TABLE public\.students ADD COLUMN kk_last4 VARCHAR\(4\)/);
    assert.match(sqlContent, /column_name = 'kk_last4'/);
  });

  await t.test('3. Tenant-isolated KK HMAC index exists', () => {
    assert.match(sqlContent, /CREATE INDEX IF NOT EXISTS idx_students_tenant_kk_hmac/);
    assert.match(sqlContent, /ON public\.students \(tenant_id, kk_hmac\)/);
  });

  await t.test('4. Unique constraint for parent_accounts (tenant_id, email)', () => {
    assert.match(sqlContent, /CONSTRAINT uq_parent_accounts_tenant_email UNIQUE \(tenant_id, email\)/);
  });

  await t.test('5. Unique constraint for parent_accounts (tenant_id, auth_uid)', () => {
    assert.match(sqlContent, /CONSTRAINT uq_parent_accounts_tenant_auth_uid UNIQUE \(tenant_id, auth_uid\)/);
  });

  await t.test('6. Unique constraint for parent_student_links (tenant_id, parent_account_id, student_id)', () => {
    assert.match(sqlContent, /CONSTRAINT uq_parent_student_links_composite UNIQUE \(tenant_id, parent_account_id, student_id\)/);
  });

  await t.test('7. No raw family card number storage detected', () => {
    // Should only use HMAC or last4
    assert.doesNotMatch(sqlContent, /ADD COLUMN family_card_number/i);
    assert.doesNotMatch(sqlContent, /ADD COLUMN nomor_kk/i);
    assert.doesNotMatch(sqlContent, /ADD COLUMN kk TEXT/i);
  });

  await t.test('8. Idempotency guards (IF NOT EXISTS) are used', () => {
    assert.match(sqlContent, /IF NOT EXISTS/);
    assert.match(sqlContent, /CREATE INDEX IF NOT EXISTS/);
  });

  await t.test('9. No policy FOR ALL detected (Security Baseline)', () => {
    assert.doesNotMatch(sqlContent, /CREATE POLICY.*FOR ALL TO authenticated/);
  });

  await t.test('10. Financial tables are not modified', () => {
    assert.doesNotMatch(sqlContent, /ALTER TABLE public\.transactions/);
    assert.doesNotMatch(sqlContent, /ALTER TABLE public\.global_ledger/);
    assert.doesNotMatch(sqlContent, /ALTER TABLE public\.spp_payments/);
  });
});
