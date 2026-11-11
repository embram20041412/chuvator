import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Setup Mock Window for Node.js test environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1024,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    location: { origin: 'https://chuvator.pages.dev', search: '?tab=profil' }
  };
}

import { supabase } from '../src/config/supabase.js';
import { updateTenantProfile } from '../src/services/supabaseArenaService.js';
import PengaturanPage from '../src/pages/PengaturanPage.jsx';

import MobileTenantProfileMain, {
  resolveTenantId,
  resolveIsolatedTenantProfile,
  validateTenantProfileInput,
  validateLogoFile,
  buildTenantProfileUpdatePayload,
  SUPPORTED_SPORTS
} from '../src/mobile/pages/admin/MobileTenantProfileMain.jsx';

import MobilePaymentSettingsMain, {
  normalizeBankAccountsFromTenant,
  validateBankAccountsInput,
  validateQrisFile,
  readQrisFileAsBase64,
  buildPaymentSettingsUpdatePayload,
  MAX_QRIS_SIZE_BYTES
} from '../src/mobile/pages/admin/MobilePaymentSettingsMain.jsx';

test('CHUVATOR — Phase 4.5.4 Mobile Tenant Profile & Payment Settings Test Suite', async (t) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const mockOwnerProfile = {
    tenantId: 'tenant-gor-101',
    role: 'owner',
    displayName: 'Bapak Owner GOR',
    email: 'owner@juarasport.id',
    tenant: {
      id: 'tenant-gor-101',
      name: 'GOR Juara Badminton',
      phone: '081234567890',
      address: 'Jl. Stadion Utama No. 10, Kediri',
      sportsType: 'Badminton',
      logoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tenants/tenant-gor-101/logos/logo.png',
      bankAccounts: [
        { bankName: 'BCA', accountNumber: '8830123456', accountName: 'PT Chua Sport' },
        { bankName: 'Mandiri', accountNumber: '140009876543', accountName: 'PT Chua Sport' }
      ],
      bankName: 'BCA',
      bankAccountNumber: '8830123456',
      bankAccountName: 'PT Chua Sport',
      qrisUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      qrisImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }
  };

  const mockProfileNoTenant = {
    id: 'user-auth-uuid-999',
    uid: 'user-auth-uuid-999',
    role: 'owner',
    displayName: 'User Tanpa Tenant'
  };

  // Seed query cache for active tenant
  queryClient.setQueryData(['arenaData', 'tenant-gor-101'], {
    tenantProfile: mockOwnerProfile.tenant,
    courts: [
      { id: 'c-1', tenantId: 'tenant-gor-101', name: 'Lapangan 1 (Vinyl)', sport: 'Badminton', price: 90000, isActive: true }
    ],
    bookings: [],
    transactions: []
  });

  /* ========================================================================= */
  /* 1 & 2. TENANT ID RESOLUTION & NO USER ID FALLBACK                         */
  /* ========================================================================= */

  await t.test('TEST 1: Tenant ID valid dapat diresolusikan dari tenant.id, tenantId, dan tenant.tenant_id', () => {
    assert.equal(resolveTenantId({ tenant: { id: 'tenant-alpha-1' } }), 'tenant-alpha-1');
    assert.equal(resolveTenantId({ tenantId: 'tenant-beta-2' }), 'tenant-beta-2');
    assert.equal(resolveTenantId({ tenant: { tenant_id: 'tenant-gamma-3' } }), 'tenant-gamma-3');
  });

  await t.test('TEST 2: User ID (id / uid) TIDAK digunakan sebagai fallback tenant ID', () => {
    assert.equal(resolveTenantId(mockProfileNoTenant), null);
    assert.equal(resolveTenantId({ id: 'uid-123', uid: 'uid-123', tenant: {} }), null);
    assert.equal(resolveTenantId(null), null);
    assert.equal(resolveTenantId(undefined), null);
    assert.equal(resolveTenantId({ tenantId: '   ' }), null);
  });

  /* ========================================================================= */
  /* 3. MISSING TENANT ID PREVENTS QUERY AND SAVE                              */
  /* ========================================================================= */

  await t.test('TEST 3: Tenant ID kosong mencegah query dan penyimpanan pada MobileTenantProfileMain & MobilePaymentSettingsMain', () => {
    (globalThis as any).window.innerWidth = 375;

    const htmlProfileNoTenant = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=profil'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(MobileTenantProfileMain, { userProfile: mockProfileNoTenant })
        )
      )
    );

    assert.ok(htmlProfileNoTenant.includes('mobile-tenant-profile-no-tenant'));
    assert.ok(htmlProfileNoTenant.includes('Konteks Cabang (Tenant) Tidak Ditemukan'));
    assert.equal(queryClient.getQueryData(['arenaData', 'user-auth-uuid-999']), undefined, 'Query tidak boleh dijalankan dengan user UID');

    const htmlPaymentNoTenant = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=pembayaran'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(MobilePaymentSettingsMain, { userProfile: mockProfileNoTenant })
        )
      )
    );

    assert.ok(htmlPaymentNoTenant.includes('mobile-payment-settings-no-tenant'));
    assert.ok(htmlPaymentNoTenant.includes('Konteks Cabang (Tenant) Tidak Ditemukan'));
  });

  /* ========================================================================= */
  /* 4, 5, 6, 7. ROUTING & VIEWPORT INTEGRATION (SSR COMPONENT RENDER)         */
  /* ========================================================================= */

  await t.test('TEST 4: Mobile (375px) + tab=profil merender MobileTenantProfileMain', () => {
    (globalThis as any).window.innerWidth = 375;

    const html = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=profil'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile })
        )
      )
    );

    assert.ok(html.includes('mobile-tenant-profile-main'));
    assert.ok(html.includes('chua-mobile-app'));
    assert.ok(html.includes('GOR Juara Badminton'));
    assert.ok(html.includes('Jl. Stadion Utama No. 10, Kediri'));
    assert.ok(html.includes('081234567890'));
    assert.ok(html.includes('Simpan Profil GOR'));
  });

  await t.test('TEST 5: Mobile (375px) + tab=pembayaran merender MobilePaymentSettingsMain', () => {
    (globalThis as any).window.innerWidth = 375;

    const html = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=pembayaran'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile })
        )
      )
    );

    assert.ok(html.includes('mobile-payment-settings-main'));
    assert.ok(html.includes('chua-mobile-app'));
    assert.ok(html.includes('Rekening Bank &amp; QRIS Statis') || html.includes('Rekening Bank & QRIS Statis'));
    assert.ok(html.includes('8830123456'));
    assert.ok(html.includes('140009876543'));
    assert.ok(html.includes('Simpan Rekening &amp; QRIS') || html.includes('Simpan Rekening & QRIS'));
  });

  await t.test('TEST 6: Mobile (375px) + tab=tarif tetap menggunakan MobileCourtPricingMain (Phase 4.5.3)', () => {
    (globalThis as any).window.innerWidth = 375;

    const html = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile })
        )
      )
    );

    assert.ok(html.includes('chua-mobile-app'));
    assert.ok(html.includes('Tarif &amp; Fasilitas Lapangan') || html.includes('Tarif & Fasilitas Lapangan'));
    assert.ok(html.includes('Lapangan 1 (Vinyl)'));
    assert.ok(html.includes('Simpan Semua Tarif'));
  });

  await t.test('TEST 7: Desktop (1024px) tetap menggunakan PengaturanDesktopMain pada seluruh tab (profil, pembayaran, tarif)', () => {
    (globalThis as any).window.innerWidth = 1024;

    for (const tab of ['profil', 'pembayaran', 'tarif']) {
      const htmlDesktop = renderToString(
        React.createElement(MemoryRouter, { initialEntries: [`/pengaturan?tab=${tab}`] },
          React.createElement(QueryClientProvider, { client: queryClient },
            React.createElement(PengaturanPage, { userProfile: mockOwnerProfile })
          )
        )
      );

      assert.ok(htmlDesktop.includes('Kelola profil arena, QRIS, rekening bank'));
      assert.equal(htmlDesktop.includes('chua-mobile-app'), false, `Desktop tab=${tab} tidak boleh merender chua-mobile-app`);
      assert.equal(htmlDesktop.includes('mobile-tenant-profile-main'), false);
      assert.equal(htmlDesktop.includes('mobile-payment-settings-main'), false);
    }
  });

  /* ========================================================================= */
  /* 8. CROSS-TENANT PROFILE ISOLATION                                         */
  /* ========================================================================= */

  await t.test('TEST 8: Data profil tenant tidak tercampur dengan tenant lain (resolveIsolatedTenantProfile & SSR Render)', () => {
    const foreignTenantData = {
      id: 'tenant-rival-999',
      name: 'GOR Rival Bocor',
      phone: '08999999999',
      address: 'Jl. Rival No. 99',
      bankAccounts: [{ bankName: 'BRI', accountNumber: '999999999', accountName: 'Rival Corp' }]
    };

    // Jika fetchedTenantProfile berasal dari tenant lain, resolveIsolatedTenantProfile menolak objek tersebut
    const isolated = resolveIsolatedTenantProfile(
      foreignTenantData,
      { tenantId: 'tenant-gor-101', tenant: { id: 'tenant-rival-999', name: 'GOR Rival Bocor' } },
      'tenant-gor-101'
    );
    assert.equal(isolated, null, 'Data profil milik tenant berbeda wajib ditolak');

    // Jika fetchedTenantProfile cocok dengan activeTenantId, diterima
    const validIsolated = resolveIsolatedTenantProfile(
      mockOwnerProfile.tenant,
      mockOwnerProfile,
      'tenant-gor-101'
    );
    assert.equal(validIsolated?.id, 'tenant-gor-101');

    // Verifikasi pada saat render SSR apabila cache berisi data tenant asing
    const contaminatedQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    contaminatedQueryClient.setQueryData(['arenaData', 'tenant-isolated-202'], {
      tenantProfile: foreignTenantData, // Data bocor milik tenant-rival-999
      courts: [],
      bookings: [],
      transactions: []
    });

    (globalThis as any).window.innerWidth = 375;
    const htmlIsolatedProfile = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=profil'] },
        React.createElement(QueryClientProvider, { client: contaminatedQueryClient },
          React.createElement(MobileTenantProfileMain, {
            userProfile: { tenantId: 'tenant-isolated-202', role: 'owner' }
          })
        )
      )
    );

    assert.equal(htmlIsolatedProfile.includes('GOR Rival Bocor'), false, 'Nama GOR milik tenant lain tidak boleh dirender');
    assert.equal(htmlIsolatedProfile.includes('08999999999'), false, 'Nomor telepon milik tenant lain tidak boleh dirender');
  });

  /* ========================================================================= */
  /* 9. PROFILE UPDATE PAYLOAD & SERVICE CONTRACT                              */
  /* ========================================================================= */

  await t.test('TEST 9: Payload update profil mengikuti kontrak service aktual updateTenantProfile', async () => {
    const profilePayload = buildTenantProfileUpdatePayload({
      name: '  GOR Juara Baru  ',
      logoUrl: 'https://res.cloudinary.com/demo/image/upload/logo_baru.png',
      address: '  Jl. Pahlawan No. 45, Kediri  ',
      phone: '  081122334455  ',
      sportsType: 'Futsal'
    });

    assert.equal(profilePayload.name, 'GOR Juara Baru');
    assert.equal(profilePayload.logoUrl, 'https://res.cloudinary.com/demo/image/upload/logo_baru.png');
    assert.equal(profilePayload.address, 'Jl. Pahlawan No. 45, Kediri');
    assert.equal(profilePayload.phone, '081122334455');
    assert.equal(profilePayload.sportsType, 'Futsal');
    assert.ok(typeof profilePayload.updatedAt === 'string');

    // Verifikasi kompatibilitas langsung dengan updateTenantProfile di supabaseArenaService.js
    const originalFrom = supabase.from.bind(supabase);
    let capturedUpdate: any = null;

    (supabase as any).from = (tableName: string) => ({
      update: (dbPayload: Record<string, any>) => ({
        eq: (_col: string, val: string) => ({
          select: () => ({
            maybeSingle: async () => {
              capturedUpdate = { table: tableName, tenantId: val, dbPayload };
              return { data: { id: val, ...dbPayload }, error: null };
            }
          })
        })
      })
    });

    try {
      const updated = await updateTenantProfile('tenant-gor-101', profilePayload);
      assert.ok(capturedUpdate !== null);
      assert.equal(capturedUpdate.table, 'tenants');
      assert.equal(capturedUpdate.tenantId, 'tenant-gor-101');
      assert.equal(capturedUpdate.dbPayload.name, 'GOR Juara Baru');
      assert.equal(capturedUpdate.dbPayload.phone, '081122334455');
      assert.equal(capturedUpdate.dbPayload.address, 'Jl. Pahlawan No. 45, Kediri');
      assert.equal(capturedUpdate.dbPayload.sports_type, 'Futsal');
      assert.equal(capturedUpdate.dbPayload.logo_url, 'https://res.cloudinary.com/demo/image/upload/logo_baru.png');
      assert.equal(updated.name, 'GOR Juara Baru');
      assert.equal(updated.sportsType, 'Futsal');
    } finally {
      (supabase as any).from = originalFrom;
    }
  });

  /* ========================================================================= */
  /* 10. LOGO UPLOAD VALIDATION & MECHANISM                                    */
  /* ========================================================================= */

  await t.test('TEST 10: Upload logo mengikuti validasi dan mekanisme yang sudah ada (tenants/{tenantId}/logos)', () => {
    // Validasi file kosong
    assert.equal(validateLogoFile(null).valid, false);

    // Validasi tipe non-gambar
    assert.equal(
      validateLogoFile({ name: 'dokumen.pdf', type: 'application/pdf', size: 100 * 1024 }).valid,
      false
    );

    // Validasi ukuran > 5 MB
    assert.equal(
      validateLogoFile({ name: 'besar.png', type: 'image/png', size: 6 * 1024 * 1024 }).valid,
      false
    );

    // Validasi gambar valid (PNG / JPG / WebP <= 5 MB)
    assert.equal(
      validateLogoFile({ name: 'logo.png', type: 'image/png', size: 400 * 1024 }).valid,
      true
    );
    assert.equal(
      validateLogoFile({ name: 'logo.webp', type: 'image/webp', size: 800 * 1024 }).valid,
      true
    );
    assert.ok(SUPPORTED_SPORTS.includes('Badminton'));
    assert.ok(SUPPORTED_SPORTS.includes('Futsal'));
  });

  /* ========================================================================= */
  /* 11. BANK ACCOUNT STRUCTURE & COMPATIBILITY                                */
  /* ========================================================================= */

  await t.test('TEST 11: Data rekening mempertahankan struktur yang kompatibel dengan sistem (multi-rekening & legacy fields)', async () => {
    // 1. Normalisasi dari array bankAccounts
    const normalizedMulti = normalizeBankAccountsFromTenant(mockOwnerProfile.tenant);
    assert.equal(normalizedMulti.length, 2);
    assert.deepEqual(normalizedMulti[0], {
      bankName: 'BCA',
      accountNumber: '8830123456',
      accountName: 'PT Chua Sport'
    });

    // 2. Normalisasi fallback dari kolom tunggal legacy (bankName, bankAccountNumber, bankAccountName)
    const normalizedLegacy = normalizeBankAccountsFromTenant({
      bankName: 'BRI',
      bankAccountNumber: '0011223344',
      bankAccountName: 'GOR Lama'
    });
    assert.equal(normalizedLegacy.length, 1);
    assert.deepEqual(normalizedLegacy[0], {
      bankName: 'BRI',
      accountNumber: '0011223344',
      accountName: 'GOR Lama'
    });

    // 3. Payload pembayaran menjaga sinkronisasi bankAccounts dan kolom utama bankName/bankAccountNumber/bankAccountName
    const paymentPayload = buildPaymentSettingsUpdatePayload({
      bankAccounts: [
        { bankName: '  BNI  ', accountNumber: '  1122334455  ', accountName: '  Arena Kediri  ' },
        { bankName: '  BCA  ', accountNumber: '  9988776655  ', accountName: '  Arena Kediri 2  ' }
      ],
      qrisImageBase64: 'data:image/png;base64,AAA='
    });

    assert.equal(paymentPayload.bankAccounts.length, 2);
    assert.equal(paymentPayload.bankName, 'BNI');
    assert.equal(paymentPayload.bankAccountNumber, '1122334455');
    assert.equal(paymentPayload.bankAccountName, 'Arena Kediri');
    assert.equal(paymentPayload.qrisUrl, 'data:image/png;base64,AAA=');
    assert.equal(paymentPayload.qrisImageBase64, 'data:image/png;base64,AAA=');

    // 4. Verifikasi kompatibilitas dengan updateTenantProfile di supabaseArenaService.js
    const originalFrom = supabase.from.bind(supabase);
    let capturedDbPayload: any = null;

    (supabase as any).from = () => ({
      update: (dbPayload: Record<string, any>) => ({
        eq: (_col: string, val: string) => ({
          select: () => ({
            maybeSingle: async () => {
              capturedDbPayload = dbPayload;
              return { data: { id: val, ...dbPayload }, error: null };
            }
          })
        })
      })
    });

    try {
      await updateTenantProfile('tenant-gor-101', paymentPayload);
      assert.ok(capturedDbPayload !== null);
      assert.equal(capturedDbPayload.bank_name, 'BNI');
      assert.equal(capturedDbPayload.bank_account_number, '1122334455');
      assert.equal(capturedDbPayload.bank_account_name, 'Arena Kediri');
      assert.equal(capturedDbPayload.bank_accounts.length, 2);
      assert.equal(capturedDbPayload.qris_url, 'data:image/png;base64,AAA=');
      assert.equal(capturedDbPayload.qris_image_base64, 'data:image/png;base64,AAA=');
    } finally {
      (supabase as any).from = originalFrom;
    }
  });

  /* ========================================================================= */
  /* 12. QRIS UPLOAD VALIDATION & BASE64 MECHANISM                             */
  /* ========================================================================= */

  await t.test('TEST 12: Upload QRIS mempertahankan mekanisme Base64 dan batasan ukuran 800 KB', async () => {
    assert.equal(MAX_QRIS_SIZE_BYTES, 800 * 1024);

    // Tolak file bukan gambar
    const nonImage = validateQrisFile({ name: 'qris.pdf', type: 'application/pdf', size: 100 * 1024 });
    assert.equal(nonImage.valid, false);
    assert.match(nonImage.message || '', /PNG\/JPG\/JPEG/);

    // Tolak file > 800 KB
    const tooLarge = validateQrisFile({ name: 'qris-hd.png', type: 'image/png', size: 850 * 1024 });
    assert.equal(tooLarge.valid, false);
    assert.match(tooLarge.message || '', /800 KB/);

    // Terima file gambar <= 800 KB
    const validFile = { name: 'qris-toko.png', type: 'image/png', size: 250 * 1024 };
    assert.equal(validateQrisFile(validFile).valid, true);

    // Uji konversi Base64 melalui FileReader
    class MockFileReader {
      result: string | null = null;
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_file: any) {
        this.result = 'data:image/png;base64,MOCK_QRIS_BASE64_DATA';
        if (this.onloadend) this.onloadend();
      }
    }

    const base64Result = await readQrisFileAsBase64(validFile, MockFileReader as any);
    assert.equal(base64Result, 'data:image/png;base64,MOCK_QRIS_BASE64_DATA');
  });

  /* ========================================================================= */
  /* 13. LOADING, EMPTY, VALIDATION, SUCCESS & ERROR STATES                    */
  /* ========================================================================= */

  await t.test('TEST 13: Loading, Empty, dan Validation States pada MobileTenantProfileMain & MobilePaymentSettingsMain', () => {
    // A. Validasi Input Profil GOR
    const invalidProfile = validateTenantProfileInput({
      name: '   ',
      phone: '',
      address: 'Jl. Merdeka',
      sportsType: 'Badminton'
    });
    assert.equal(invalidProfile.valid, false);
    assert.ok(invalidProfile.errors.name);
    assert.ok(invalidProfile.errors.phone);
    assert.equal(invalidProfile.errors.address, undefined);

    const validProfile = validateTenantProfileInput({
      name: 'GOR Nusantara',
      phone: '08123456789',
      address: 'Jl. Nusantara No. 1',
      sportsType: 'Badminton'
    });
    assert.equal(validProfile.valid, true);

    // B. Validasi Input Rekening Bank
    const invalidBanks: any = validateBankAccountsInput([
      { bankName: 'BCA', accountNumber: '', accountName: 'PT Chua' }
    ]);
    assert.equal(invalidBanks.valid, false);
    assert.ok(invalidBanks.itemErrors[0].accountNumber);

    const validBanks = validateBankAccountsInput([
      { bankName: 'BCA', accountNumber: '8830123456', accountName: 'PT Chua' }
    ]);
    assert.equal(validBanks.valid, true);

    // C. Loading State pada kedua komponen saat data belum ada di cache
    const unseededQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const loadingProfile = {
      tenantId: 'tenant-loading-999',
      role: 'owner',
      tenant: { id: 'tenant-loading-999', name: 'GOR Memuat' }
    };

    (globalThis as any).window.innerWidth = 375;

    const htmlProfileLoading = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=profil'] },
        React.createElement(QueryClientProvider, { client: unseededQueryClient },
          React.createElement(MobileTenantProfileMain, { userProfile: loadingProfile })
        )
      )
    );
    assert.ok(htmlProfileLoading.includes('mobile-tenant-profile-loading'));
    assert.ok(htmlProfileLoading.includes('Memuat data profil GOR...'));

    const htmlPaymentLoading = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=pembayaran'] },
        React.createElement(QueryClientProvider, { client: unseededQueryClient },
          React.createElement(MobilePaymentSettingsMain, { userProfile: loadingProfile })
        )
      )
    );
    assert.ok(htmlPaymentLoading.includes('mobile-payment-settings-loading'));
    assert.ok(htmlPaymentLoading.includes('Memuat pengaturan rekening &amp; QRIS...') || htmlPaymentLoading.includes('Memuat pengaturan rekening & QRIS...'));

    // D. Empty QRIS / Default Bank State saat tenant belum memiliki rekening & QRIS
    const emptyPaymentClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    emptyPaymentClient.setQueryData(['arenaData', 'tenant-empty-pay'], {
      tenantProfile: { id: 'tenant-empty-pay', name: 'GOR Baru', bankAccounts: [], qrisUrl: null },
      courts: [],
      bookings: [],
      transactions: []
    });

    const htmlEmptyPayment = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=pembayaran'] },
        React.createElement(QueryClientProvider, { client: emptyPaymentClient },
          React.createElement(MobilePaymentSettingsMain, {
            userProfile: { tenantId: 'tenant-empty-pay', role: 'owner', tenant: { id: 'tenant-empty-pay', name: 'GOR Baru' } }
          })
        )
      )
    );
    assert.ok(htmlEmptyPayment.includes('Belum Ada QRIS'));
    assert.ok(htmlEmptyPayment.includes('Belum Diatur'));
    assert.ok(htmlEmptyPayment.includes('Rekening #1'));
  });
});
