import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeKK, computeHMAC } from '../functions/api/tenant/_auth_staff.js';
import { onRequestGet as searchStudentsGet } from '../functions/api/tenant/parents/students.js';
import { onRequestPost as createParentPost } from '../functions/api/tenant/parents/index.js';
import { performDryRunAnalysis } from '../functions/api/admin/backfill_helpers.js';
import { mapStudentFromSupabase } from '../src/services/supabaseAcademyService.js';

const SCHEMA_5_5_C_PATH = path.join(process.cwd(), 'phase5_5_c_separate_nik_kk_schema.sql');

test('CHUVATOR — FASE 5.5-C: Pemisahan Identitas NIK dan Nomor KK', async (t) => {
  const schemaSql = fs.readFileSync(SCHEMA_5_5_C_PATH, 'utf8');

  // =========================================================================
  // 1. ADDITIVE SCHEMA SQL VERIFICATION
  // =========================================================================

  await t.test('1. Additive SQL: Menambah nik & no_kk tanpa menghapus nik_kk', () => {
    // Menambahkan kolom nik dan no_kk sebagai NULLABLE
    assert.match(schemaSql, /ALTER TABLE public\.students\s+ADD COLUMN IF NOT EXISTS nik VARCHAR\(16\) NULL;/);
    assert.match(schemaSql, /ALTER TABLE public\.students\s+ADD COLUMN IF NOT EXISTS no_kk VARCHAR\(16\) NULL;/);

    // Mempertahankan kolom nik_kk
    assert.match(schemaSql, /Kolom public\.students\.nik_kk DIPERTAHANKAN dan TIDAK DIHAPUS/);
    assert.doesNotMatch(schemaSql, /DROP COLUMN [^;]*nik_kk/i);

    // Validasi format NULL-safe 16 digit
    assert.match(schemaSql, /chk_students_nik_format[\s\S]*?CHECK \(nik IS NULL OR nik ~ '\^\[0-9\]\{16\}\$'\)/);
    assert.match(schemaSql, /chk_students_no_kk_format[\s\S]*?CHECK \(no_kk IS NULL OR no_kk ~ '\^\[0-9\]\{16\}\$'\)/);
  });

  // =========================================================================
  // 2. DATA MAPPING & FORM SEPARATION
  // =========================================================================

  await t.test('2. Mapping Siswa: nik dan noKk terpetakan secara independen', () => {
    const mockRow = {
      id: 'student-uuid-1',
      tenant_id: 'tenant-1',
      student_name: 'Budi Pratama',
      nik: '3201123456780001',
      no_kk: '3201987654320002',
      nik_kk: '3201987654320002',
      kk_hmac: 'a'.repeat(64),
      kk_last4: '0002'
    };

    const mapped = mapStudentFromSupabase(mockRow);
    assert.strictEqual(mapped.nik, '3201123456780001');
    assert.strictEqual(mapped.noKk, '3201987654320002');
    assert.strictEqual(mapped.nikKk, '3201987654320002');
    assert.notStrictEqual(mapped.nik, mapped.noKk, 'NIK and KK must not be swapped');
  });

  await t.test('3. UI Registration Form: Memisahkan state NIK dan No KK', () => {
    const regModalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/StudentRegistrationModal.jsx'), 'utf8');
    assert.match(regModalCode, /const \[nik, setNik\] = useState\(''\);/);
    assert.match(regModalCode, /const \[noKk, setNoKk\] = useState\(''\);/);
    assert.match(regModalCode, /nik:\s*(trimmedNik|nik\.trim\(\))/);
    assert.match(regModalCode, /noKk:\s*(trimmedNoKk|noKk\.trim\(\))/);
    assert.match(regModalCode, /NIK Siswa \(16 Digit\)/);
    assert.match(regModalCode, /Nomor Kartu Keluarga \/ KK/);
  });

  await t.test('4. UI Detail Siswa: Menampilkan NIK dan No KK sebagai dua info terpisah', () => {
    const detailModalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/StudentDetailModal.jsx'), 'utf8');
    assert.match(detailModalCode, /NIK Siswa:\s*<strong[^>]*>\{currentStudent\.nik \|\| '-'\}/);
    assert.match(detailModalCode, /Nomor KK:\s*<strong[^>]*>\{currentStudent\.noKk \|\| currentStudent\.no_kk/);
  });

  // =========================================================================
  // 3. PENCARIAN KK PORTAL WALI (ANTI-INSECURE FALLBACK)
  // =========================================================================

  await t.test('5. Pencarian KK: Menghitung HMAC dari KK dan HANYA mengembalikan siswa yang cocok', async () => {
    const testSecret = 'secret-test-chuvator-phase-5-5-b';
    const testKK = '3201123456789012';
    const expectedHmac = await computeHMAC(testKK, testSecret);

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes(`/rest/v1/students?kk_hmac=eq.${expectedHmac}`)) {
        return new Response(
          JSON.stringify([
            { id: 'student-matched-1', name: 'Ahmad Faiz', birth_date: '2015-01-01', kk_last4: '9012' }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const req = new Request(`http://localhost:3000/api/tenant/parents/students?kk=${testKK}`, {
        method: 'GET',
        headers: {
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid-1',
          'x-test-tenant-id': 'tenant-chua'
        }
      });

      const res = await searchStudentsGet({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'test',
          SUPABASE_URL: 'http://mock-supabase.local',
          SUPABASE_ANON_KEY: 'test-anon-key'
        }
      });

      assert.strictEqual(res.status, 200);
      const body: any = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.length, 1);
      assert.strictEqual(body.data[0].studentId, 'student-matched-1');
      assert.strictEqual(body.data[0].kkLast4, '9012');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('6. Pencarian KK: Menolak fallback query seluruh siswa jika query HMAC gagal', async () => {
    const testSecret = 'secret-test-chuvator-phase-5-5-b';
    const testKK = '3201123456789012';

    let attemptedFallbackQuery = false;
    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('kk_hmac=eq.')) {
        // Simulasi error Supabase pada kolom kk_hmac
        return new Response(JSON.stringify({ message: 'column does not exist' }), { status: 400 });
      }
      if (urlStr.includes('/rest/v1/students?select=id,name,birth_date')) {
        attemptedFallbackQuery = true;
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const req = new Request(`http://localhost:3000/api/tenant/parents/students?kk=${testKK}`, {
        method: 'GET',
        headers: {
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid-1',
          'x-test-tenant-id': 'tenant-chua'
        }
      });

      const res = await searchStudentsGet({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'test',
          SUPABASE_URL: 'http://mock-supabase.local',
          SUPABASE_ANON_KEY: 'test-anon-key'
        }
      });

      assert.strictEqual(res.status, 200);
      const body: any = await res.json();
      assert.strictEqual(body.data.length, 0, 'Must return empty array on failed query, never arbitrary students');
      assert.strictEqual(attemptedFallbackQuery, false, 'Insecure fallback query must never be executed');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('7. Pencarian KK: Nol data demo pada lingkungan produksi', async () => {
    const testSecret = 'secret-test-chuvator-phase-5-5-b';
    const testKK = '3201123456789012';

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'admin-uid-1', email: 'erizamaulana.bramantya@gmail.com' }), { status: 200 });
      }
      if (urlStr.includes('kk_hmac=eq.')) {
        // Tidak menemukan siswa di DB
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const req = new Request(`http://localhost:3000/api/tenant/parents/students?kk=${testKK}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-valid-token'
        }
      });

      const res = await searchStudentsGet({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'production',
          SUPABASE_URL: 'http://mock-supabase.local',
          SUPABASE_ANON_KEY: 'test-anon-key'
        }
      });

      assert.strictEqual(res.status, 200);
      const body: any = await res.json();
      assert.strictEqual(body.data.length, 0, 'Production must never synthesize demo students');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 4. PEMBUATAN AKUN WALI & VERIFIKASI HMAC SISWA
  // =========================================================================

  await t.test('8. Pembuatan Akun Wali: Menolak jika kk_hmac siswa belum tersedia (NULL)', async () => {
    const testSecret = 'secret-test-chuvator-phase-5-5-b';
    const testKK = '3201123456789012';

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/students?id=in.')) {
        return new Response(
          JSON.stringify([
            // Siswa ditemukan tetapi kk_hmac NULL (belum diverifikasi/belum backfill)
            { id: 'student-unverified-1', name: 'Rafi', tenant_id: 'tenant-1', kk_hmac: null }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const req = new Request('http://localhost:3000/api/tenant/parents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid-1',
          'x-test-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          name: 'Ibu Siti',
          email: 'siti@example.com',
          phone: '08123456789',
          kk: testKK,
          studentIds: ['student-unverified-1']
        })
      });

      const res = await createParentPost({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'test',
          SUPABASE_URL: 'http://mock-supabase.local',
          SUPABASE_ANON_KEY: 'test-anon-key'
        }
      });

      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'STUDENT_HMAC_UNAVAILABLE');
      assert.match(body.message, /belum memiliki hash Nomor KK/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('9. Pembuatan Akun Wali: Menolak jika kk_hmac siswa tidak cocok dengan nomor KK', async () => {
    const testSecret = 'secret-test-chuvator-phase-5-5-b';
    const testKK = '3201123456789012';
    const wrongHmac = 'b'.repeat(64);

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/students?id=in.')) {
        return new Response(
          JSON.stringify([
            { id: 'student-mismatch-1', name: 'Doni', tenant_id: 'tenant-1', kk_hmac: wrongHmac }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const req = new Request('http://localhost:3000/api/tenant/parents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid-1',
          'x-test-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          name: 'Bapak Joko',
          email: 'joko@example.com',
          phone: '08123456789',
          kk: testKK,
          studentIds: ['student-mismatch-1']
        })
      });

      const res = await createParentPost({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'test',
          SUPABASE_URL: 'http://mock-supabase.local',
          SUPABASE_ANON_KEY: 'test-anon-key'
        }
      });

      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.code, 'HMAC_MISMATCH');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 5. AUDIT BACKFILL: no_kk SEBAGAI SUMBER TUNGGAL TERVERIFIKASI
  // =========================================================================

  await t.test('10. Backfill Helpers: Hanya menggunakan no_kk terverifikasi sebagai sumber KK', async () => {
    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      if (String(url).includes('/rest/v1/students')) {
        return new Response(
          JSON.stringify([
            // Siswa 1: Punya no_kk terverifikasi
            { id: 's-1', tenant_id: 't-1', no_kk: '1234567890123456', nik_kk: '1234567890123456', kk_hmac: null, kk_last4: null },
            // Siswa 2: Hanya punya nik_kk lama, belum diverifikasi ke no_kk
            { id: 's-2', tenant_id: 't-1', no_kk: null, nik_kk: '9999999999999999', kk_hmac: null, kk_last4: null },
            // Siswa 3: no_kk tidak valid (5 digit)
            { id: 's-3', tenant_id: 't-1', no_kk: '12345', nik_kk: '12345', kk_hmac: null, kk_last4: null }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const summary = await performDryRunAnalysis('http://mock-supabase.local', 'test-key', 'test-secret', 'global');
      assert.strictEqual(summary.totalStudents, 3);
      // Siswa 2 dan 3 invalid/unverified source KK
      assert.strictEqual(summary.categories.MISSING_NO_KK, 1);
      assert.strictEqual(summary.categories.INVALID_NO_KK, 1);
      // Kandidat backfill hanya 1 (Siswa 1)
      assert.strictEqual(summary.eligibleCandidates, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('11. Backfill Execution Index: Menolak nik_kk sebagai sumber dan mencatat UNVERIFIED_NO_KK', () => {
    const indexJs = fs.readFileSync(path.join(process.cwd(), 'functions/api/admin/backfill_kk_hmac/index.js'), 'utf8');
    assert.match(indexJs, /const rawKK = student\.no_kk;/);
    assert.match(indexJs, /UNVERIFIED_NO_KK/);
    assert.doesNotMatch(indexJs, /const rawKK = student\.nik_kk;/);
  });
});
