import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { runKkHmacDryRun } from '../src/services/backfillService.js';
import { supabase } from '../src/services/supabaseClient.js';

test('CHUVATOR — FASE 5.5-C: SaaS Admin KK HMAC Dry-Run UI & Service Integration Suite', async (t) => {

  // =========================================================================
  // 1. SERVICE HELPER TESTS: runKkHmacDryRun() Contract
  // =========================================================================

  await t.test('1. Service Helper: Issues POST to /api/admin/backfill_kk_hmac?dryRun=true with Bearer auth token', async () => {
    const originalFetch = global.fetch;
    const originalGetSession = supabase.auth.getSession;

    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    // Mock Supabase Session
    supabase.auth.getSession = async () => ({
      data: {
        session: {
          access_token: 'mock-superadmin-jwt-token-12345',
          token_type: 'bearer',
          user: { id: 'super-admin-uid', email: 'admin@chua.com' }
        }
      },
      error: null
    }) as any;

    // Mock Fetch
    global.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          mode: 'DRY_RUN',
          message: 'Analisis simulasi selesai (100% read-only).',
          data: {
            totalStudents: 150,
            validSourceKK: 120,
            invalidSourceKK: 30,
            backfillCandidates: 50,
            categories: {
              ELIGIBLE: 50,
              ALREADY_VALID: 60,
              INVALID_SOURCE: 30,
              MISSING_LAST4: 0,
              CORRUPT_HMAC: 5,
              HMAC_MISMATCH: 5
            },
            timestamp: '2026-11-06T12:00:00.000Z'
          }
        })
      } as any;
    }) as any;

    try {
      const res: any = await runKkHmacDryRun({ tenantId: 'global' });

      assert.ok(capturedUrl.includes('/api/admin/backfill_kk_hmac?dryRun=true'), 'URL harus memuat endpoint dan query param dryRun=true');
      assert.strictEqual(capturedMethod, 'POST', 'HTTP method harus POST');
      assert.strictEqual(capturedHeaders['Authorization'], 'Bearer mock-superadmin-jwt-token-12345', 'Header Authorization Bearer token wajib dikirim');
      assert.strictEqual(capturedBody?.dryRun, true, 'Body JSON wajib memuat dryRun: true');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.totalStudents, 150);
      assert.strictEqual(res.data.categories.ELIGIBLE, 50);
    } finally {
      global.fetch = originalFetch;
      supabase.auth.getSession = originalGetSession;
    }
  });

  await t.test('2. Service Helper: Handles HTTP Error response and throws structured Error', async () => {
    const originalFetch = global.fetch;

    global.fetch = (async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        code: 'FORBIDDEN_SUPERADMIN_ONLY',
        message: 'Akses ditolak. Operasi administratif backfill hanya diizinkan untuk superadmin.'
      })
    })) as any;

    try {
      await runKkHmacDryRun();
      assert.fail('runKkHmacDryRun harus melempar error saat HTTP 403');
    } catch (err: any) {
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.code, 'FORBIDDEN_SUPERADMIN_ONLY');
      assert.match(err.message, /Akses ditolak/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 2. UI CODE & CONTRACT AUDIT: SaasAdminPage.jsx
  // =========================================================================

  await t.test('3. UI Contract: SaasAdminPage.jsx contains "Jalankan Dry-Run KK HMAC" button & read-only modal', () => {
    const pageJsx = fs.readFileSync(path.join(process.cwd(), 'src/pages/SaasAdminPage.jsx'), 'utf8');

    // 1. Memastikan tombol dengan label persis "Jalankan Dry-Run KK HMAC" tersedia
    assert.match(pageJsx, /Jalankan Dry-Run KK HMAC/);

    // 2. Memastikan modal konfirmasi berisi penjelasan 100% READ-ONLY tanpa mutasi
    assert.match(pageJsx, /100% AMAN & READ-ONLY/i);
    assert.match(pageJsx, /Tanpa Perubahan Database/i);

    // 3. Memastikan pemanggilan API menggunakan runKkHmacDryRun
    assert.match(pageJsx, /runKkHmacDryRun/);

    // 4. Memastikan seluruh 6 kategori hasil dry-run dirender pada UI
    assert.match(pageJsx, /dryrun-category-ELIGIBLE/);
    assert.match(pageJsx, /dryrun-category-ALREADY_VALID/);
    assert.match(pageJsx, /dryrun-category-INVALID_SOURCE/);
    assert.match(pageJsx, /dryrun-category-MISSING_LAST4/);
    assert.match(pageJsx, /dryrun-category-CORRUPT_HMAC/);
    assert.match(pageJsx, /dryrun-category-HMAC_MISMATCH/);

    // 5. Memastikan tidak ada tampilan PII (NIK, No. KK, HMAC secret)
    assert.doesNotMatch(pageJsx, /student\.nik/);
    assert.doesNotMatch(pageJsx, /student\.no_kk/);
    assert.doesNotMatch(pageJsx, /KK_HMAC_SECRET/);
  });
});
