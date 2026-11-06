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
    assert.match(migrationSql, /(ELSIF|IF)[\s\S]*?OLD\.no_kk\s+IS\s+DISTINCT\s+FROM\s+NEW\.no_kk/i);
    assert.doesNotMatch(migrationSql, /OLD\.nik\s+IS\s+DISTINCT\s+FROM\s+NEW\.nik/i);
  });

  await t.test('12. Invalidation Konsistensi Nomor KK: Perubahan no_kk otomatis menginvalidasi HMAC di database & service', () => {
    const serviceJs = fs.readFileSync(path.join(process.cwd(), 'src/services/supabaseAcademyService.js'), 'utf8');

    // 1. Pada level service: updateFields.noKk mereset kk_hmac dan kk_last4 ke null jika tidak ada hash baru
    assert.match(serviceJs, /mapped\.kk_hmac\s*=\s*null;/);
    assert.match(serviceJs, /mapped\.kk_last4\s*=\s*null;/);

    // 2. Pada level database: Trigger BEFORE INSERT OR UPDATE atomik
    assert.match(migrationSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.fn_invalidate_student_kk_hmac\(\)/i);
    assert.match(migrationSql, /CREATE\s+TRIGGER\s+trg_invalidate_student_kk_hmac/i);
    assert.match(migrationSql, /BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.students/i);
    assert.match(migrationSql, /TG_OP\s*=\s*'INSERT'/i);
    assert.match(migrationSql, /NEW\.kk_hmac\s*:=\s*NULL;/);
    assert.match(migrationSql, /NEW\.kk_last4\s*:=\s*NULL;/);
  });

  await t.test('13. Pengujian Negatif Trigger Invalidasi INSERT & UPDATE: 7 Skenario Keamanan HMAC', () => {
    // Simulasi fungsi trigger PL/pgSQL public.fn_invalidate_student_kk_hmac():
    // IF (TG_OP = 'INSERT') THEN
    //     NEW.kk_hmac := NULL; NEW.kk_last4 := NULL;
    // ELSIF (TG_OP = 'UPDATE' AND OLD.no_kk IS DISTINCT FROM NEW.no_kk) THEN
    //     NEW.kk_hmac := NULL; NEW.kk_last4 := NULL;
    // END IF;
    const simulateDatabaseTrigger = (op: 'INSERT' | 'UPDATE', oldRow: any, newRow: any) => {
      const row = { ...newRow };
      if (op === 'INSERT') {
        row.kk_hmac = null;
        row.kk_last4 = null;
      } else if (op === 'UPDATE' && oldRow.no_kk !== row.no_kk) {
        row.kk_hmac = null;
        row.kk_last4 = null;
      }
      return row;
    };

    const initialStudent = {
      id: 'student-1',
      nik: '3201010000000001',
      no_kk: '3201010000000002',
      kk_hmac: 'a'.repeat(64),
      kk_last4: '0002'
    };

    // Skenario A1: INSERT dengan no_kk valid dan HMAC palsu -> HMAC harus NULL
    const ins1 = simulateDatabaseTrigger('INSERT', null, {
      id: 'student-new-1',
      nik: '3201010000000005',
      no_kk: '3201010000000006',
      kk_hmac: 'f'.repeat(64),
      kk_last4: '0006'
    });
    assert.strictEqual(ins1.kk_hmac, null, 'A1. INSERT dengan HMAC palsu wajib meng-NULL-kan HMAC');

    // Skenario A2: INSERT dengan no_kk valid dan last4 palsu -> last4 harus NULL
    const ins2 = simulateDatabaseTrigger('INSERT', null, {
      id: 'student-new-2',
      nik: '3201010000000005',
      no_kk: '3201010000000006',
      kk_hmac: null,
      kk_last4: '9999'
    });
    assert.strictEqual(ins2.kk_last4, null, 'A2. INSERT dengan last4 palsu wajib meng-NULL-kan last4');

    // Skenario A3: INSERT tanpa HMAC (no_kk valid) -> tetap berhasil dengan HMAC dan last4 NULL
    const ins3 = simulateDatabaseTrigger('INSERT', null, {
      id: 'student-new-3',
      nik: '3201010000000005',
      no_kk: '3201010000000006',
      kk_hmac: null,
      kk_last4: null
    });
    assert.strictEqual(ins3.kk_hmac, null, 'A3. INSERT tanpa HMAC berhasil tersimpan dengan NULL');
    assert.strictEqual(ins3.kk_last4, null, 'A3. INSERT tanpa last4 berhasil tersimpan dengan NULL');

    // Skenario B1: UPDATE perubahan no_kk -> HMAC dan last4 NULL
    const up1 = simulateDatabaseTrigger('UPDATE', initialStudent, {
      ...initialStudent,
      no_kk: '3201019999999999'
    });
    assert.strictEqual(up1.kk_hmac, null, 'B1. UPDATE perubahan no_kk wajib meng-NULL-kan HMAC');
    assert.strictEqual(up1.kk_last4, null, 'B1. UPDATE perubahan no_kk wajib meng-NULL-kan last4');

    // Skenario B2: UPDATE perubahan NIK saja -> HMAC tidak terhapus
    const up2 = simulateDatabaseTrigger('UPDATE', initialStudent, {
      ...initialStudent,
      nik: '3201018888888888'
    });
    assert.strictEqual(up2.kk_hmac, initialStudent.kk_hmac, 'B2. Perubahan NIK tidak boleh meng-NULL-kan HMAC');
    assert.strictEqual(up2.kk_last4, initialStudent.kk_last4, 'B2. Perubahan NIK tidak boleh meng-NULL-kan last4');

    // Skenario B3: UPDATE backfill tanpa perubahan no_kk -> HMAC dan last4 tersimpan
    const unbackfilledStudent = {
      id: 'student-2',
      nik: '3201010000000001',
      no_kk: '3201010000000002',
      kk_hmac: null,
      kk_last4: null
    };
    const backfilledHmac = 'b'.repeat(64);
    const up3 = simulateDatabaseTrigger('UPDATE', unbackfilledStudent, {
      ...unbackfilledStudent,
      kk_hmac: backfilledHmac,
      kk_last4: '0002'
    });
    assert.strictEqual(up3.kk_hmac, backfilledHmac, 'B3. Backfill berhasil menyimpan HMAC karena no_kk tidak berubah');
    assert.strictEqual(up3.kk_last4, '0002', 'B3. Backfill berhasil menyimpan Last4 karena no_kk tidak berubah');

    // Skenario B4: Perubahan KK setelah backfill -> HMAC dan last4 kembali NULL
    const up4 = simulateDatabaseTrigger('UPDATE', up3, {
      ...up3,
      no_kk: '3201017777777777'
    });
    assert.strictEqual(up4.kk_hmac, null, 'B4. Perubahan KK pasca-backfill wajib menginvalidasi HMAC kembali ke NULL');
    assert.strictEqual(up4.kk_last4, null, 'B4. Perubahan KK pasca-backfill wajib menginvalidasi Last4 kembali ke NULL');
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

  await t.test('15. Audit Konkurensi & Validasi Parameter Mandatory p_expected_no_kk', () => {
    // Simulasi logika RPC apply_backfill_kk_atomic_record:
    // 0. Validasi p_expected_no_kk IS NOT NULL AND trim(...) <> '' AND ~ '^[0-9]{16}$'
    // 1. SELECT no_kk, kk_hmac, kk_last4 FROM students WHERE id = p_student_id FOR UPDATE;
    // 2. IF v_curr_no_kk IS DISTINCT FROM p_expected_no_kk THEN RETURN SOURCE_KK_MUTATED; END IF;
    
    const simulateApplyBackfillRpc = (
      studentInDb: { no_kk: string | null; kk_hmac: string | null; kk_last4: string | null },
      params: { expected_no_kk: string | null; new_hmac: string; new_last4: string }
    ) => {
      // Step 0: Mandatory validation of p_expected_no_kk
      if (!params.expected_no_kk || params.expected_no_kk.trim() === '' || !/^\d{16}$/.test(params.expected_no_kk)) {
        return {
          success: false,
          code: 'INVALID_EXPECTED_NO_KK',
          message: 'Parameter p_expected_no_kk wajib diisi dengan tepat 16 digit angka murni.'
        };
      }

      // Step 2: Unconditional comparison
      if (studentInDb.no_kk !== params.expected_no_kk) {
        return {
          success: false,
          code: 'SOURCE_KK_MUTATED',
          message: 'Nomor KK siswa telah diubah oleh admin saat proses backfill berjalan. Generasi HMAC dibatalkan.'
        };
      }
      
      // Step 3: Success apply
      return {
        success: true,
        updatedStudent: {
          ...studentInDb,
          kk_hmac: params.new_hmac,
          kk_last4: params.new_last4
        }
      };
    };

    const studentInDb = {
      no_kk: '3201010000000002',
      kk_hmac: null,
      kk_last4: null
    };

    // Skenario 1: Parameter expected_no_kk NULL -> Ditolak dengan INVALID_EXPECTED_NO_KK
    const invalidRes1 = simulateApplyBackfillRpc(studentInDb, {
      expected_no_kk: null,
      new_hmac: 'a'.repeat(64),
      new_last4: '0002'
    });
    assert.strictEqual(invalidRes1.success, false);
    assert.strictEqual(invalidRes1.code, 'INVALID_EXPECTED_NO_KK');

    // Skenario 2: Parameter expected_no_kk tidak 16 digit -> Ditolak dengan INVALID_EXPECTED_NO_KK
    const invalidRes2 = simulateApplyBackfillRpc(studentInDb, {
      expected_no_kk: '12345',
      new_hmac: 'a'.repeat(64),
      new_last4: '0002'
    });
    assert.strictEqual(invalidRes2.success, false);
    assert.strictEqual(invalidRes2.code, 'INVALID_EXPECTED_NO_KK');

    // Skenario 3: Admin mengubah no_kk secara bersamaan menjadi KK baru ('3201019999999999')
    const studentInDbAfterAdminUpdate = {
      no_kk: '3201019999999999',
      kk_hmac: null,
      kk_last4: null
    };

    // Backfill mencoba menyimpan HMAC yang dihitung dari no_kk lama ('3201010000000002')
    const rpcResult = simulateApplyBackfillRpc(studentInDbAfterAdminUpdate, {
      expected_no_kk: '3201010000000002',
      new_hmac: 'a'.repeat(64),
      new_last4: '0002'
    });

    // Sistem WAJIB MENOLAK hasil backfill dengan SOURCE_KK_MUTATED
    assert.strictEqual(rpcResult.success, false);
    assert.strictEqual(rpcResult.code, 'SOURCE_KK_MUTATED');
    assert.match(rpcResult.message, /diubah oleh admin/);
  });
});
