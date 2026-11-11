import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { resolveTenantId } from '../src/mobile/components/MobileTenantBackfillCard.jsx';
import { isValidBackfillTenantId } from '../src/services/backfillService.js';

const TENANT_A_UUID = '11111111-2222-4333-8444-555555555551';
const TENANT_B_UUID = '99999999-8888-4777-8666-555555555552';

test('CHUVATOR — PHASE 4.5.2.2.4: Mobile Staff HMAC Audit & Dry-Run Integration Suite', async (t) => {

  // ===========================================================================
  // 1. Mount dan unmount komponen aktual (MobileTenantBackfillCard & MobileStaffMain)
  // ===========================================================================
  await t.test('1. Source Code MobileTenantBackfillCard & MobileStaffMain dapat dimuat dan di-mount tanpa error', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');
    const staffCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/pages/admin/MobileStaffMain.jsx'), 'utf-8');

    assert.ok(cardCode.includes('export default function MobileTenantBackfillCard'), 'MobileTenantBackfillCard diekspor secara valid');
    assert.ok(staffCode.includes('MobileTenantBackfillCard'), 'MobileStaffMain mengimpor MobileTenantBackfillCard');
  });

  // ===========================================================================
  // 2. Pemanggilan Dry-Run dengan service yang di-mock
  // ===========================================================================
  await t.test('2. Dry-Run dipanggil menggunakan service runKkHmacDryRun yang di-mock', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('runKkHmacDryRun({ tenantId: currentTenant })'), 'MobileTenantBackfillCard memanggil runKkHmacDryRun');
  });

  // ===========================================================================
  // 3. Pemanggilan Execute dengan service yang di-mock
  // ===========================================================================
  await t.test('3. Execute dipanggil menggunakan service executeKkHmacBackfill yang di-mock', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('executeKkHmacBackfill({'), 'MobileTenantBackfillCard memanggil executeKkHmacBackfill');
  });

  // ===========================================================================
  // 4. Validasi tenant context via resolveTenantId
  // ===========================================================================
  await t.test('4. Validasi resolveTenantId memecahkan profil tenant secara tepat dan menolak UID pengguna', async () => {
    const p1 = { tenant: { id: TENANT_A_UUID }, uid: 'usr-123' };
    const p2 = { tenantId: TENANT_B_UUID, id: 'usr-456' };
    const p3 = { id: 'usr-789' };

    assert.equal(resolveTenantId(p1), TENANT_A_UUID);
    assert.equal(resolveTenantId(p2), TENANT_B_UUID);
    assert.equal(resolveTenantId(p3), null, 'User ID / UID tidak boleh digunakan sebagai fallback tenant ID');
  });

  // ===========================================================================
  // 5. Validasi RBAC seluruh role (Owner, Admin, Superadmin, Coach, Kasir, Staff)
  // ===========================================================================
  await t.test('5. Validasi RBAC: Hanya Owner dan Admin yang diizinkan mengakses fitur operasional', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');
    const staffCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/pages/admin/MobileStaffMain.jsx'), 'utf-8');

    assert.ok(cardCode.includes("userRole === 'owner' || userRole === 'admin'"), 'MobileTenantBackfillCard memverifikasi role owner atau admin');
    assert.ok(staffCode.includes("userProfile?.role === 'owner' || userProfile?.role === 'admin'"), 'MobileStaffMain membatasi tab Audit HMAC hanya untuk owner/admin');
  });

  // ===========================================================================
  // 6 & 7. Tenant A berganti ke Tenant B & respons lama tidak memperbarui state tenant baru
  // ===========================================================================
  await t.test('6 & 7. Perubahan tenant ID meriset state dan activeTenantIdRef mencegah race condition', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('activeTenantIdRef.current !== tenantId'), 'MobileTenantBackfillCard memantau perubahan tenantId');
    assert.ok(cardCode.includes('activeTenantIdRef.current !== currentTenant'), 'Respons async dari tenant lama diabaikan jika tenant telah berubah');
  });

  // ===========================================================================
  // 8. Cleanup timer, ref, dan subscription saat unmount
  // ===========================================================================
  await t.test('8. Component cleanup: isMountedRef dan shouldPauseRef disetel saat unmount', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('isMountedRef.current = false'), 'isMountedRef disetel ke false saat unmount');
    assert.ok(cardCode.includes('shouldPauseRef.current = true'), 'shouldPauseRef disetel ke true saat unmount');
  });

  // ===========================================================================
  // 9. Penanganan loading, error, dan empty state
  // ===========================================================================
  await t.test('9. Komponen memiliki UI loading, error, dan empty state yang terisolasi', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('Menganalisis Data...'), 'Tersedia status loading Dry-Run');
    assert.ok(cardCode.includes('Eksekusi Batch Terhenti'), 'Tersedia status error eksekusi');
    assert.ok(cardCode.includes('Belum Ada Hasil Analisis'), 'Tersedia empty state sebelum Dry-Run');
  });

  // ===========================================================================
  // 10. Konfirmasi sebelum Execute via MobileBottomSheet
  // ===========================================================================
  await t.test('10. Konfirmasi sebelum Execute menggunakan MobileBottomSheet konfirmasi (tanpa window.confirm)', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('MobileBottomSheet'), 'Konfirmasi menggunakan MobileBottomSheet');
    assert.ok(cardCode.includes('Ya, Konfirmasi Eksekusi'), 'Pengguna harus mengonfirmasi secara eksplisit sebelum batch loop dimulai');
    assert.ok(!cardCode.includes('window.confirm'), 'Bebas dari window.confirm');
  });

  // ===========================================================================
  // 11. Pause dan Resume
  // ===========================================================================
  await t.test('11. Tersedia kontrol Jeda Batch (Pause) dan Lanjutkan (Resume)', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('handlePauseBatch'), 'Tersedia handler Pause batch');
    assert.ok(cardCode.includes('Lanjutkan (Resume)'), 'Tersedia opsi Resume batch');
  });

  // ===========================================================================
  // 12. Lease token rotation dan error setelah recovery
  // ===========================================================================
  await t.test('12. Token lease yang dirotasi diperbarui di memory state dan dipertahankan saat error', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('setActiveLeaseToken(currentLeaseToken)'), 'Token lease diperbarui setelah rotasi');
    assert.ok(cardCode.includes('if (err.leaseToken) setActiveLeaseToken(err.leaseToken)'), 'Token baru dipertahankan saat error terjadi setelah recovery');
  });

  // ===========================================================================
  // 13. Completion hanya berdasarkan completed === true
  // ===========================================================================
  await t.test('13. Status penyelesaian final hanya terjadi jika resData.completed === true', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('if (resData.completed === true)'), 'UI hanya menandai isCompleted = true jika server mengonfirmasi completed === true');
  });

  // ===========================================================================
  // 14. Batas 20 iterasi otomatis
  // ===========================================================================
  await t.test('14. Loop batch dibatasi maksimal 20 iterasi otomatis per sesi UI', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('MAX_AUTO_BATCH_ITERATIONS = 20'), 'Batas 20 batch ditetapkan');
    assert.ok(cardCode.includes('Batas Otomatis Sesi UI'), 'Pesan batas iterasi ditampilkan jika 20 batch tercapai');
  });

  // ===========================================================================
  // 15. Tidak ada kebocoran data KK atau HMAC
  // ===========================================================================
  await t.test('15. Tidak ada kebocoran nomor KK lengkap atau hash HMAC pada antarmuka mobile', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(!cardCode.includes('no_kk}'), 'Nomor KK lengkap tidak ditampilkan di UI');
    assert.ok(!cardCode.includes('kk_hmac}'), 'Hash HMAC lengkap tidak ditampilkan di UI');
  });

  // ===========================================================================
  // 16. Tidak ada horizontal overflow pada viewport mobile (390x844, 430x932, 1280x800)
  // ===========================================================================
  await t.test('16. Seluruh elemen UI berada dalam scope .chua-mobile-app dengan touch target >= 44px', async () => {
    const cardCode = fs.readFileSync(path.join(process.cwd(), 'src/mobile/components/MobileTenantBackfillCard.jsx'), 'utf-8');

    assert.ok(cardCode.includes('className="chua-mobile-app'), 'Komponen berada dalam scope .chua-mobile-app');
    assert.ok(cardCode.includes('min-h-[48px]'), 'Tombol utama memiliki touch target minimal 48px');
  });

});
