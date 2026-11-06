import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { mapStudentFromSupabase } from '../src/services/supabaseAcademyService.js';
import { onRequestGet as searchStudentsByKK } from '../functions/api/tenant/parents/students.js';
import { onRequestPost as createParentAccount } from '../functions/api/tenant/parents/index.js';
import { computeHMAC } from '../functions/api/tenant/_auth_staff.js';

const MIGRATION_FILE_PATH = path.join(process.cwd(), 'phase5_5_c_nik_no_kk_separation.sql');
const REGISTRATION_MODAL_PATH = path.join(process.cwd(), 'src/components/StudentRegistrationModal.jsx');
const DETAIL_MODAL_PATH = path.join(process.cwd(), 'src/components/StudentDetailModal.jsx');
const BACKFILL_INDEX_PATH = path.join(process.cwd(), 'functions/api/admin/backfill_kk_hmac/index.js');
const BACKFILL_HELPERS_PATH = path.join(process.cwd(), 'functions/api/admin/backfill_helpers.js');

test('CHUVATOR — FASE 5.5-B: Pemisahan Identitas NIK dan Nomor KK', async (t) => {
  const migrationSql = fs.readFileSync(MIGRATION_FILE_PATH, 'utf8');
  const regModalJsx = fs.readFileSync(REGISTRATION_MODAL_PATH, 'utf8');
  const detailModalJsx = fs.readFileSync(DETAIL_MODAL_PATH, 'utf8');
  const backfillIndexJs = fs.readFileSync(BACKFILL_INDEX_PATH, 'utf8');
  const backfillHelpersJs = fs.readFileSync(BACKFILL_HELPERS_PATH, 'utf8');

  // =========================================================================
  // 1. ADDITIVE MIGRATION INTEGRITY & SAFETY
  // =========================================================================

  await t.test('1. Migration Additive: Menambahkan kolom nik dan no_kk tanpa mutasi data', () => {
    assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS nik VARCHAR\(16\) NULL;/);
    assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS no_kk VARCHAR\(16\) NULL;/);
    assert.match(migrationSql, /chk_students_nik_format/);
    assert.match(migrationSql, /chk_students_no_kk_format/);
    assert.match(migrationSql, /idx_students_tenant_nik/);
    assert.match(migrationSql, /idx_students_tenant_no_kk/);

    // KETENTUAN MUTLAK: Dilarang auto-copy dari nik_kk ke no_kk
    assert.doesNotMatch(migrationSql, /UPDATE\s+public\.students\s+SET\s+no_kk\s*=\s*nik_kk/i);
    assert.doesNotMatch(migrationSql, /DROP\s+COLUMN\s+nik_kk/i);
  });

  // =========================================================================
  // 2. FORM PENDAFTARAN & DETAIL SISWA
  // =========================================================================

  await t.test('2. Form Pendaftaran: State nik dan no_kk terpisah, divalidasi 16 digit', () => {
    // State terpisah
    assert.match(regModalJsx, /const \[nik, setNik\] = useState\(''\);/);
    assert.match(regModalJsx, /const \[noKk, setNoKk\] = useState\(''\);/);

    // Input terpisah dengan id masing-masing
    assert.match(regModalJsx, /id="nik"/);
    assert.match(regModalJsx, /id="noKk"/);
    assert.match(regModalJsx, /NIK Siswa \(Nomor Induk Kependudukan\)/);
    assert.match(regModalJsx, /Nomor Kartu Keluarga \(Nomor KK\)/);

    // Validasi 16 digit angka
    assert.ok(regModalJsx.includes('trimmedNik && !/^\\d{16}$/.test(trimmedNik)'));
    assert.ok(regModalJsx.includes('trimmedNoKk && !/^\\d{16}$/.test(trimmedNoKk)'));

    // Payload menyimpan nik dan noKk ke kolom yang tepat
    assert.match(regModalJsx, /nik:\s*trimmedNik \|\| null/);
    assert.match(regModalJsx, /noKk:\s*trimmedNoKk \|\| null/);
  });

  await t.test('3. Detail Siswa: Menampilkan NIK Siswa dan Nomor KK secara terpisah', () => {
    assert.match(detailModalJsx, /NIK Siswa:\s*<strong[^>]*>\{currentStudent\.nik \|\| '-'\}/);
    assert.match(detailModalJsx, /Nomor KK:\s*<strong[^>]*>\{currentStudent\.noKk/);
    assert.doesNotMatch(detailModalJsx, /NIK\/KK:/);
  });

  await t.test('4. Service Mapping: mapStudentFromSupabase memetakan nik, noKk, dan nikKk', () => {
    const rawRow = {
      id: 'student-uuid-1',
      tenant_id: 'tenant-1',
      student_name: 'Budi Santoso',
      nik: '3201012345670001',
      no_kk: '3201019876540002',
      nik_kk: '3201019876540002'
    };

    const mapped = mapStudentFromSupabase(rawRow);
    assert.strictEqual(mapped.nik, '3201012345670001');
    assert.strictEqual(mapped.noKk, '3201019876540002');
    assert.strictEqual(mapped.nikKk, '3201019876540002');
  });

  // =========================================================================
  // 3. PORTAL WALI MURID (PENCARIAN KK & PENDAFTARAN WALI)
  // =========================================================================

  await t.test('5. Pencarian KK: Hanya menampilkan siswa yang kk_hmac-nya cocok (Tanpa Fallback Seluruh Siswa)', async () => {
    const testSecret = 'secret-test-chuvator';
    const testKK = '3201019876540002';
    const expectedHmac = await computeHMAC(testKK, testSecret);

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'staff-uid', email: 'erizamaulana.bramantya@gmail.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('kk_hmac=eq.')) {
        if (urlStr.includes(encodeURIComponent(expectedHmac!))) {
          return new Response(
            JSON.stringify([
              { id: 'student-1', name: 'Anak Kandung', birth_date: '2015-01-01', kk_last4: '0002' }
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    try {
      const req = new Request(`http://localhost:3000/api/tenant/parents/students?kk=${testKK}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-staff-token',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid',
          'x-test-tenant-id': 'tenant-1'
        }
      });

      const res = await searchStudentsByKK({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'production',
          SUPABASE_URL: 'http://mock.local',
          SUPABASE_ANON_KEY: 'test-key'
        }
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.data.length, 1);
      assert.strictEqual(data.data[0].studentId, 'student-1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('6. Pencarian KK: Nol Data Demo di Lingkungan Production', async () => {
    const testSecret = 'secret-test-chuvator';
    const testKK = '1234567890123456';

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'staff-uid', email: 'erizamaulana.bramantya@gmail.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const req = new Request(`http://localhost:3000/api/tenant/parents/students?kk=${testKK}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-staff-token',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid',
          'x-test-tenant-id': 'tenant-1'
        }
      });

      const res = await searchStudentsByKK({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'production',
          SUPABASE_URL: 'http://mock.local',
          SUPABASE_ANON_KEY: 'test-key'
        }
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      // Di production, siswa kosong tetap kosong (tidak boleh mengembalikan demo data!)
      assert.strictEqual(data.data.length, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('7. Pembuatan Akun Wali: Menolak jika HMAC siswa belum tersedia (STUDENT_HMAC_UNAVAILABLE)', async () => {
    const testSecret = 'secret-test-chuvator';
    const testKK = '3201019876540002';

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'staff-uid', email: 'erizamaulana.bramantya@gmail.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/students?id=in.')) {
        // Siswa ada tapi kk_hmac bernilai NULL (belum backfill/verifikasi)
        return new Response(
          JSON.stringify([
            { id: 'student-no-hmac-1', name: 'Siswa Belum HMAC', tenant_id: 'tenant-1', kk_hmac: null }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const req = new Request('http://localhost:3000/api/tenant/parents', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-staff-token',
          'Content-Type': 'application/json',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid',
          'x-test-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          name: 'Ibu Budi',
          email: 'ibu.budi@example.com',
          phone: '081234567890',
          kk: testKK,
          studentIds: ['student-no-hmac-1']
        })
      });

      const res = await createParentAccount({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'production',
          SUPABASE_URL: 'http://mock.local',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-key'
        }
      });

      assert.strictEqual(res.status, 400);
      const data: any = await res.json();
      assert.strictEqual(data.code, 'STUDENT_HMAC_UNAVAILABLE');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('8. Pembuatan Akun Wali: Menolak jika Nomor KK tidak cocok dengan HMAC siswa (HMAC_MISMATCH)', async () => {
    const testSecret = 'secret-test-chuvator';
    const testKK = '3201019876540002'; // Input KK
    const differentKKHmac = await computeHMAC('1111222233334444', testSecret); // HMAC KK lain

    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'staff-uid', email: 'erizamaulana.bramantya@gmail.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/students?id=in.')) {
        return new Response(
          JSON.stringify([
            { id: 'student-diff-hmac', name: 'Siswa KK Lain', tenant_id: 'tenant-1', kk_hmac: differentKKHmac }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const req = new Request('http://localhost:3000/api/tenant/parents', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-staff-token',
          'Content-Type': 'application/json',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid',
          'x-test-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          name: 'Ibu Budi',
          email: 'ibu.budi@example.com',
          phone: '081234567890',
          kk: testKK,
          studentIds: ['student-diff-hmac']
        })
      });

      const res = await createParentAccount({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'production',
          SUPABASE_URL: 'http://mock.local',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-key'
        }
      });

      assert.strictEqual(res.status, 400);
      const data: any = await res.json();
      assert.strictEqual(data.code, 'HMAC_MISMATCH');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // =========================================================================
  // 4. BACKFILL AUDIT: MEMASTIKAN SUMBER KK ADALAH no_kk (BUKAN nik_kk)
  // =========================================================================

  await t.test('9. Backfill Audit: Mekanisme backfill membaca no_kk yang terverifikasi', () => {
    assert.match(backfillIndexJs, /select=id,tenant_id,no_kk,kk_hmac,kk_last4/);
    assert.match(backfillIndexJs, /const rawKK = student\.no_kk;/);

    assert.match(backfillHelpersJs, /select=id,tenant_id,no_kk,(nik_kk,)?kk_hmac,kk_last4/);
    assert.match(backfillHelpersJs, /const rawKK = s\.no_kk;/);

    // Memastikan nik_kk tidak lagi digunakan sebagai sumber backfill
    assert.doesNotMatch(backfillIndexJs, /const rawKK = student\.nik_kk;/);
    assert.doesNotMatch(backfillHelpersJs, /const rawKK = s\.nik_kk;/);
  });

  // =========================================================================
  // 5. REGRESSION: PENGHENTIAN TOTAL DUAL-WRITE & INVALIDASI ATOMIK
  // =========================================================================

  await t.test('10. Penghentian Total Dual-Write: Kolom nik_kk tidak ditulis pada create/update', () => {
    const serviceJs = fs.readFileSync(path.join(process.cwd(), 'src/services/supabaseAcademyService.js'), 'utf8');

    // 1. StudentRegistrationModal tidak menyertakan nikKk dalam payload
    assert.doesNotMatch(regModalJsx, /nikKk:\s*\(trimmedNik/);
    assert.doesNotMatch(regModalJsx, /nikKk:\s*trimmed/);

    // 2. createStudent tidak menulis nik_kk ke database
    assert.doesNotMatch(serviceJs, /dbPayload\s*=\s*\{[\s\S]*?nik_kk:/);

    // 3. updateStudent tidak menulis nik_kk ke database
    assert.doesNotMatch(serviceJs, /mapped\.nik_kk\s*=/);

    // 4. mapStudentFromSupabase hanya membaca kolom fisik nik_kk tanpa sintesis fallback
    assert.match(serviceJs, /nikKk:\s*row\.nik_kk\s*\|\|\s*'',/);
    assert.doesNotMatch(serviceJs, /nikKk:\s*row\.nik_kk\s*\|\|\s*row\.nik/);
  });

  await t.test('11. Konsistensi Perubahan NIK: Perubahan NIK TIDAK mengubah atau menginvalidasi HMAC', () => {
    const serviceJs = fs.readFileSync(path.join(process.cwd(), 'src/services/supabaseAcademyService.js'), 'utf8');

    // Blok updateFields.nik hanya menyetel mapped.nik
    const nikBlockMatch = serviceJs.match(/if\s*\(updateFields\.nik\s*!==\s*undefined\)\s*\{([\s\S]*?)\}/);
    assert.ok(nikBlockMatch, 'Blok updateFields.nik harus ada');
    const nikBlock = nikBlockMatch[1];
    assert.doesNotMatch(nikBlock, /mapped\.kk_hmac/);
    assert.doesNotMatch(nikBlock, /mapped\.kk_last4/);

    // Trigger SQL hanya mengecek OLD.no_kk IS DISTINCT FROM NEW.no_kk
    assert.match(migrationSql, /IF\s*\(OLD\.no_kk\s+IS\s+DISTINCT\s+FROM\s+NEW\.no_kk\)\s+THEN/i);
    assert.doesNotMatch(migrationSql, /OLD\.nik\s+IS\s+DISTINCT\s+FROM\s+NEW\.nik/i);
  });

  await t.test('12. Invalidation Konsistensi Nomor KK: Perubahan no_kk otomatis menginvalidasi HMAC di database & service', () => {
    const serviceJs = fs.readFileSync(path.join(process.cwd(), 'src/services/supabaseAcademyService.js'), 'utf8');

    // 1. Pada level service: updateFields.noKk mereset kk_hmac dan kk_last4 ke null jika tidak ada hash baru
    assert.match(serviceJs, /mapped\.kk_hmac\s*=\s*null;/);
    assert.match(serviceJs, /mapped\.kk_last4\s*=\s*null;/);

    // 2. Pada level database: Trigger atomik sebelum update
    assert.match(migrationSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.fn_invalidate_student_kk_hmac\(\)/i);
    assert.match(migrationSql, /CREATE\s+TRIGGER\s+trg_invalidate_student_kk_hmac/i);
    assert.match(migrationSql, /BEFORE\s+UPDATE\s+ON\s+public\.students/i);
    assert.match(migrationSql, /NEW\.kk_hmac\s*:=\s*NULL;/);
    assert.match(migrationSql, /NEW\.kk_last4\s*:=\s*NULL;/);
  });

  await t.test('13. Kegagalan Komputasi HMAC: Mencegah hash lama tertinggal untuk Nomor KK baru', () => {
    // Simulasi trigger DB: Jika KK berubah dan tidak ada hash baru yang berbeda disertakan,
    // hash lama wajib di-NULL-kan
    const simulateTrigger = (oldRow: any, newRow: any) => {
      const row = { ...newRow };
      if (oldRow.no_kk !== row.no_kk) {
        if (row.kk_hmac === oldRow.kk_hmac) {
          row.kk_hmac = null;
          row.kk_last4 = null;
        }
      }
      return row;
    };

    const initialStudent = {
      id: 'student-1',
      nik: '3201010000000001',
      no_kk: '3201010000000002',
      kk_hmac: 'old_hmac_hash_64_characters_long_abcdef1234567890abcdef1234567890ab',
      kk_last4: '0002'
    };

    // Kasus 1: no_kk diubah tanpa menyediakan hash baru -> hash lama gugur
    const updatedStudent1 = simulateTrigger(initialStudent, {
      ...initialStudent,
      no_kk: '3201019999999999' // KK baru
    });
    assert.strictEqual(updatedStudent1.kk_hmac, null, 'Hash lama wajib di-NULL-kan');
    assert.strictEqual(updatedStudent1.kk_last4, null, 'Last4 lama wajib di-NULL-kan');

    // Kasus 2: nik saja yang diubah -> hash KK tetap utuh
    const updatedStudent2 = simulateTrigger(initialStudent, {
      ...initialStudent,
      nik: '3201018888888888' // NIK baru
    });
    assert.strictEqual(updatedStudent2.kk_hmac, initialStudent.kk_hmac, 'Hash KK tidak boleh berubah saat NIK berubah');
    assert.strictEqual(updatedStudent2.kk_last4, '0002', 'Last4 KK tidak boleh berubah saat NIK berubah');
  });

  await t.test('14. Portal Wali: Menolak HMAC kosong atau kedaluwarsa secara konsisten', async () => {
    const testSecret = 'secret-test-chuvator';
    const testKK = '3201019876540002';

    // Permintaan pembuatan akun wali dengan siswa yang HMAC-nya kosong/invalid
    const originalFetch = global.fetch;
    (global as any).fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'staff-uid', email: 'erizamaulana.bramantya@gmail.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.includes('/rest/v1/students?id=in.')) {
        return new Response(
          JSON.stringify([
            { id: 'student-empty-hmac', name: 'Siswa Tanpa Hash', tenant_id: 'tenant-1', kk_hmac: '' }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    try {
      const req = new Request('http://localhost:3000/api/tenant/parents', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-staff-token',
          'Content-Type': 'application/json',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'admin-uid',
          'x-test-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          name: 'Ibu Budi',
          email: 'ibu.budi@example.com',
          phone: '081234567890',
          kk: testKK,
          studentIds: ['student-empty-hmac']
        })
      });

      const res = await createParentAccount({
        request: req,
        env: {
          KK_HMAC_SECRET: testSecret,
          ENVIRONMENT: 'production',
          SUPABASE_URL: 'http://mock.local',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-key'
        }
      });

      assert.strictEqual(res.status, 400);
      const data: any = await res.json();
      assert.strictEqual(data.code, 'STUDENT_HMAC_UNAVAILABLE');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
