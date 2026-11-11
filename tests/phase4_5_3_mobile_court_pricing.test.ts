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
    location: { origin: 'https://chuvator.pages.dev', search: '?tab=tarif' }
  };
}

import { supabase } from '../src/config/supabase.js';
import { updateCourtsBatch } from '../src/services/supabaseArenaService.js';

import PengaturanPage, { 
  PengaturanDesktopMain, 
  resolveTenantId as desktopResolveTenantId,
  formatNumberWithDots as desktopFormatNumberWithDots,
  parseNumberFromDots as desktopParseNumberFromDots
} from '../src/pages/PengaturanPage.jsx';

import MobileCourtPricingMain, { 
  resolveTenantId as mobileResolveTenantId,
  formatNumberWithDots,
  parseNumberFromDots,
  filterCourtsByTenant,
  groupCourtsBySport,
  validatePriceInput,
  buildChangedCourtsPayload
} from '../src/mobile/pages/admin/MobileCourtPricingMain.jsx';

test('CHUVATOR — Phase 4.5.3.1.1 Mobile Court Pricing Final Correction & Source Verification Suite', async (t) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const mockOwnerProfile = {
    tenantId: 'tenant-gor-101',
    role: 'owner',
    displayName: 'Bapak Owner GOR',
    tenant: { id: 'tenant-gor-101', name: 'GOR Juara Badminton' }
  };

  const mockProfileNoTenant = {
    id: 'user-auth-uuid-999',
    uid: 'user-auth-uuid-999',
    role: 'owner',
    displayName: 'User Tanpa Tenant'
  };

  const mockCourts = [
    { id: 'c-1', tenantId: 'tenant-gor-101', name: 'Lapangan 1 (Vinyl)', sport: 'Badminton', price: 90000, isActive: true },
    { id: 'c-2', tenant_id: 'tenant-gor-101', name: 'Lapangan 2 (Karpet)', sport: 'Badminton', price: 90000, isActive: true },
    { id: 'c-3', tenantId: 'tenant-gor-101', name: 'Lapangan Futsal A', sport: 'Futsal', price: 180000, isActive: true },
    { id: 'c-4', tenant_id: 'tenant-gor-101', name: 'Lapangan Tenis Outdoor', sport: 'Tenis', price: 120000, isActive: true }
  ];

  /* ========================================================================= */
  /* SECTION A: UNIT TESTS                                                     */
  /* ========================================================================= */

  await t.test('UNIT 1: Data tanpa tenant ID ditolak oleh filterCourtsByTenant dan buildChangedCourtsPayload', () => {
    const courtsWithoutTenantId = [
      { id: 'c-no-tenant-1', name: 'Lapangan Tanpa Tenant 1', sport: 'Badminton', price: 80000 },
      { id: 'c-no-tenant-2', tenantId: null, name: 'Lapangan Null Tenant', sport: 'Futsal', price: 150000 },
      { id: 'c-no-tenant-3', tenant_id: '', name: 'Lapangan Empty String Tenant', sport: 'Tenis', price: 100000 },
      { id: 'c-no-tenant-4', tenantId: '   ', name: 'Lapangan Whitespace Tenant', sport: 'Badminton', price: 95000 }
    ];

    const filtered = filterCourtsByTenant(courtsWithoutTenantId, 'tenant-gor-101');
    assert.equal(filtered.length, 0, 'Seluruh data lapangan tanpa tenant ID wajib ditolak');

    const payload = buildChangedCourtsPayload(
      courtsWithoutTenantId,
      {
        'c-no-tenant-1': '100.000',
        'c-no-tenant-2': '175.000',
        'c-no-tenant-3': '125.000',
        'c-no-tenant-4': '110.000'
      },
      'tenant-gor-101'
    );
    assert.equal(payload.length, 0, 'Data tanpa tenant ID tidak boleh masuk ke payload penyimpanan');
  });

  await t.test('UNIT 2: Data tenant berbeda ditolak oleh filterCourtsByTenant dan buildChangedCourtsPayload', () => {
    const foreignTenantCourts = [
      { id: 'c-other-1', tenantId: 'tenant-rival-999', name: 'Lapangan Rival 1', sport: 'Badminton', price: 75000 },
      { id: 'c-other-2', tenant_id: 'tenant-cabang-lain-888', name: 'Lapangan Cabang Lain', sport: 'Futsal', price: 160000 }
    ];

    const filtered = filterCourtsByTenant(foreignTenantCourts, 'tenant-gor-101');
    assert.equal(filtered.length, 0, 'Seluruh data lapangan milik tenant berbeda wajib ditolak');

    const payload = buildChangedCourtsPayload(
      foreignTenantCourts,
      { 'c-other-1': '95.000', 'c-other-2': '200.000' },
      'tenant-gor-101'
    );
    assert.equal(payload.length, 0, 'Data milik tenant berbeda tidak boleh masuk ke payload penyimpanan');
  });

  await t.test('UNIT 3: Data tenant aktif diterima (mendukung properti tenantId maupun tenant_id)', () => {
    const mixedDataset = [
      ...mockCourts,
      { id: 'c-no-tenant', name: 'Lapangan Tanpa Tenant', sport: 'Badminton', price: 70000 },
      { id: 'c-foreign', tenantId: 'tenant-other-777', name: 'Lapangan Tenant Lain', sport: 'Futsal', price: 140000 }
    ];

    const accepted = filterCourtsByTenant(mixedDataset, 'tenant-gor-101');
    assert.equal(accepted.length, 4, 'Hanya 4 lapangan milik tenant-gor-101 yang boleh diterima');
    assert.deepEqual(
      accepted.map((c: any) => c.id),
      ['c-1', 'c-2', 'c-3', 'c-4']
    );
  });

  await t.test('UNIT 4 & 5: Payload penyimpanan HANYA berisi id dan price serta TIDAK mengandung atribut lain', () => {
    const localPrices: Record<string, string> = {
      'c-1': '105.000', // berubah dari 90000 -> 105000
      'c-2': '90.000',  // tidak berubah
      'c-3': '195.000', // berubah dari 180000 -> 195000
      'c-4': '120.000'  // tidak berubah
    };

    const payload = buildChangedCourtsPayload(mockCourts, localPrices, 'tenant-gor-101');
    assert.equal(payload.length, 2, 'Hanya 2 lapangan yang berubah yang boleh masuk ke payload');

    for (const item of payload) {
      const keys = Object.keys(item).sort();
      assert.deepEqual(keys, ['id', 'price'], 'Objek payload hanya boleh memiliki key id dan price');
      assert.equal('name' in item, false, 'Payload tidak boleh mengandung name');
      assert.equal('sport' in item, false, 'Payload tidak boleh mengandung sport');
      assert.equal('isActive' in item, false, 'Payload tidak boleh mengandung isActive');
      assert.equal('tenantId' in item, false, 'Payload tidak boleh mengandung tenantId');
      assert.equal('tenant_id' in item, false, 'Payload tidak boleh mengandung tenant_id');
    }

    assert.deepEqual(payload, [
      { id: 'c-1', price: 105000 },
      { id: 'c-3', price: 195000 }
    ]);
  });

  await t.test('UNIT 6: Perubahan tarif dengan payload minimal { id, price } dapat disimpan menggunakan service updateCourtsBatch yang sudah ada', async () => {
    const localPrices: Record<string, string> = {
      'c-1': '110.000', // berubah dari 90000 -> 110000
      'c-2': '90.000',  // tetap
      'c-3': '180.000', // tetap
      'c-4': '140.000'  // berubah dari 120000 -> 140000
    };

    const minimalPayload = buildChangedCourtsPayload(mockCourts, localPrices, 'tenant-gor-101');
    assert.deepEqual(minimalPayload, [
      { id: 'c-1', price: 110000 },
      { id: 'c-4', price: 140000 }
    ]);

    // Intercept supabase.from('courts').update(dbPayload).eq('id', courtId) to verify real updateCourtsBatch + updateCourt execution
    const originalFrom = supabase.from.bind(supabase);
    const capturedDbUpdates: Array<{ table: string; courtId: string; dbPayload: Record<string, any> }> = [];

    (supabase as any).from = (tableName: string) => {
      return {
        update: (dbPayload: Record<string, any>) => ({
          eq: (col: string, val: string) => ({
            select: () => ({
              maybeSingle: async () => {
                capturedDbUpdates.push({ table: tableName, courtId: val, dbPayload });
                return {
                  data: { id: val, tenant_id: 'tenant-gor-101', price: dbPayload.price, updated_at: dbPayload.updated_at },
                  error: null
                };
              }
            })
          })
        })
      };
    };

    try {
      const result = await updateCourtsBatch(minimalPayload);
      assert.equal(result.length, 2, 'updateCourtsBatch harus mengembalikan hasil untuk 2 lapangan');
      assert.equal(capturedDbUpdates.length, 2, 'updateCourt harus mengeksekusi 2 update ke tabel courts');

      // Pastikan dbPayload yang dikirim oleh updateCourt ke Supabase hanya berisi price dan updated_at
      assert.equal(capturedDbUpdates[0].table, 'courts');
      assert.equal(capturedDbUpdates[0].courtId, 'c-1');
      assert.equal(capturedDbUpdates[0].dbPayload.price, 110000);
      assert.deepEqual(Object.keys(capturedDbUpdates[0].dbPayload).sort(), ['price', 'updated_at']);

      assert.equal(capturedDbUpdates[1].table, 'courts');
      assert.equal(capturedDbUpdates[1].courtId, 'c-4');
      assert.equal(capturedDbUpdates[1].dbPayload.price, 140000);
      assert.deepEqual(Object.keys(capturedDbUpdates[1].dbPayload).sort(), ['price', 'updated_at']);
    } finally {
      (supabase as any).from = originalFrom;
    }
  });

  await t.test('UNIT 7: Resolusi Tenant ID, Format Titik Ribuan, Validasi Input, dan Pengelompokan Cabang Olahraga', () => {
    assert.equal(mobileResolveTenantId(mockOwnerProfile), 'tenant-gor-101');
    assert.equal(desktopResolveTenantId(mockOwnerProfile), 'tenant-gor-101');
    assert.equal(mobileResolveTenantId(mockProfileNoTenant), null);
    assert.equal(desktopResolveTenantId(mockProfileNoTenant), null);

    assert.equal(formatNumberWithDots(150000), '150.000');
    assert.equal(desktopFormatNumberWithDots(150000), '150.000');
    assert.equal(parseNumberFromDots('150.000'), 150000);
    assert.equal(desktopParseNumberFromDots('150.000'), 150000);

    assert.equal(validatePriceInput('').valid, false);
    assert.equal(validatePriceInput('125.000').valid, true);
    assert.equal(validatePriceInput('125.000').value, 125000);

    const grouped: Record<string, any[]> = groupCourtsBySport(mockCourts);
    assert.equal(grouped['Badminton'].length, 2);
    assert.equal(grouped['Futsal'].length, 1);
    assert.equal(grouped['Tenis'].length, 1);
  });

  /* ========================================================================= */
  /* SECTION B: COMPONENT TESTS (REAL REACT SSR RENDERING)                     */
  /* ========================================================================= */

  // Seed query cache with mixed courts (active tenant + no-tenant + foreign tenant)
  // to verify component-level strict tenant filtering during actual React render
  queryClient.setQueryData(['arenaData', 'tenant-gor-101'], {
    tenantProfile: mockOwnerProfile.tenant,
    courts: [
      ...mockCourts,
      { id: 'c-leak-no-tenant', name: 'Lapangan Bocor Tanpa Tenant', sport: 'Badminton', price: 50000 },
      { id: 'c-leak-foreign', tenantId: 'tenant-lain-999', name: 'Lapangan Bocor Tenant Lain', sport: 'Futsal', price: 60000 }
    ],
    bookings: [],
    transactions: []
  });

  queryClient.setQueryData(['arenaData', 'tenant-empty-gor'], {
    tenantProfile: { id: 'tenant-empty-gor', name: 'GOR Baru Kosong' },
    courts: [],
    bookings: [],
    transactions: []
  });

  await t.test('COMPONENT 1: Mobile Viewport (375px) pada tab=tarif merender MobileCourtPricingMain dan memfilter hanya lapangan milik tenant aktif', () => {
    (globalThis as any).window.innerWidth = 375;

    const htmlMobile = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );

    assert.ok(htmlMobile.includes('chua-mobile-app'), 'Mobile UI harus berada di dalam scope chua-mobile-app');
    assert.ok(htmlMobile.includes('Tarif &amp; Fasilitas Lapangan') || htmlMobile.includes('Tarif & Fasilitas Lapangan'));
    assert.ok(htmlMobile.includes('Lapangan 1 (Vinyl)'));
    assert.ok(htmlMobile.includes('Lapangan 2 (Karpet)'));
    assert.ok(htmlMobile.includes('Lapangan Futsal A'));
    assert.ok(htmlMobile.includes('Lapangan Tenis Outdoor'));

    // Pastikan lapangan tanpa tenant ID dan lapangan tenant lain TIDAK dirender
    assert.equal(htmlMobile.includes('Lapangan Bocor Tanpa Tenant'), false, 'Lapangan tanpa tenant ID wajib ditolak saat render');
    assert.equal(htmlMobile.includes('Lapangan Bocor Tenant Lain'), false, 'Lapangan tenant berbeda wajib ditolak saat render');

    // Pastikan tautan kembali ke Pengaturan GOR tersedia
    assert.ok(htmlMobile.includes('/pengaturan?tab=profil'), 'Tautan navigasi kembali ke menu pengaturan harus tersedia');
  });

  await t.test('COMPONENT 2: Kejujuran Error vs Empty State (Tidak mengklaim loadError palsu dan menjelaskan bahwa getCourts mengembalikan [] saat kosong maupun saat kueri gagal)', () => {
    const profileWithEmptyResult = {
      tenantId: 'tenant-empty-gor',
      role: 'owner',
      tenant: { id: 'tenant-empty-gor', name: 'GOR Baru Kosong' }
    };

    (globalThis as any).window.innerWidth = 375;

    // 1. Bahkan jika prop loadError asing diberikan dari luar, MobileCourtPricingMain tidak merender error state palsu
    const htmlWhenEmpty = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(MobileCourtPricingMain, {
            userProfile: profileWithEmptyResult,
            ...({ loadError: 'Error palsu yang tidak ada di useArenaData' } as any)
          })
        )
      )
    );

    assert.equal(
      htmlWhenEmpty.includes('Error palsu yang tidak ada di useArenaData'),
      false,
      'MobileCourtPricingMain tidak boleh merender prop loadError palsu karena useArenaData tidak mengembalikan loadError'
    );
    assert.ok(
      htmlWhenEmpty.includes('Tidak Ada Data Lapangan Tersedia'),
      'Harus menampilkan judul status jujur ketika array courts kosong'
    );
    assert.ok(
      htmlWhenEmpty.includes('Belum ada fasilitas lapangan terdaftar pada cabang ini, atau data tidak dapat dimuat dari server saat ini'),
      'Harus menjelaskan secara jujur bahwa daftar kosong dapat berarti belum ada lapangan atau kueri gagal pada getCourts'
    );
    assert.ok(
      htmlWhenEmpty.includes('Muat Ulang Data'),
      'Harus menyediakan tombol Muat Ulang Data (refetch) pada saat daftar kosong'
    );

    // 2. Loading state tetap terpisah secara akurat ketika query pertama kali berjalan
    const unseededQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const unseededProfile = {
      tenantId: 'tenant-loading-gor',
      role: 'owner',
      tenant: { id: 'tenant-loading-gor', name: 'GOR Memuat' }
    };

    const htmlLoading = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: unseededQueryClient },
          React.createElement(MobileCourtPricingMain, { userProfile: unseededProfile })
        )
      )
    );
    assert.ok(htmlLoading.includes('Memuat daftar lapangan fasilitas...'));
  });

  await t.test('COMPONENT 3: Missing Tenant Context menampilkan layar peringatan dan mencegah query', () => {
    (globalThis as any).window.innerWidth = 375;

    const htmlNoTenant = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(MobileCourtPricingMain, { userProfile: mockProfileNoTenant })
        )
      )
    );

    assert.ok(htmlNoTenant.includes('Konteks Cabang (Tenant) Tidak Ditemukan'));
    assert.ok(htmlNoTenant.includes('Kembali ke Pengaturan'));
    assert.equal(queryClient.getQueryData(['arenaData', 'user-auth-uuid-999']), undefined);
  });

  await t.test('COMPONENT 4: Tidak ada regresi Desktop (1024px) dan tab non-tarif pada Mobile tetap merender PengaturanDesktopMain', () => {
    // 1. Desktop (1024px) pada tab=tarif tetap merender PengaturanDesktopMain
    (globalThis as any).window.innerWidth = 1024;
    const htmlDesktopTarif = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );

    assert.ok(htmlDesktopTarif.includes('Pengaturan'));
    assert.ok(htmlDesktopTarif.includes('Kelola profil arena, QRIS, rekening bank'));
    assert.equal(htmlDesktopTarif.includes('chua-mobile-app'), false, 'Desktop tidak boleh menggunakan wrapper chua-mobile-app');

    // 2. Mobile (375px) pada tab yang belum memiliki mobile UI khusus (spp_struk, master_pricing) merender PengaturanDesktopMain
    (globalThis as any).window.innerWidth = 375;
    for (const nonMobileTab of ['spp_struk', 'master_pricing']) {
      const htmlOtherTab = renderToString(
        React.createElement(MemoryRouter, { initialEntries: [`/pengaturan?tab=${nonMobileTab}`] },
          React.createElement(QueryClientProvider, { client: queryClient },
            React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
          )
        )
      );
      assert.ok(htmlOtherTab.includes('Pengaturan'), `Tab ${nonMobileTab} harus tetap merender PengaturanDesktopMain`);
      assert.equal(htmlOtherTab.includes('chua-mobile-app'), false, `Tab ${nonMobileTab} belum diklaim memiliki mobile UI tersendiri`);
    }
  });
});
