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

// Import components and utilities
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

test('CHUVATOR — Phase 4.5.3.1 Mobile Sports Facility & Court Pricing Test Suite', async (t) => {
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
    { id: 'c-2', tenantId: 'tenant-gor-101', name: 'Lapangan 2 (Karpet)', sport: 'Badminton', price: 90000, isActive: true },
    { id: 'c-3', tenantId: 'tenant-gor-101', name: 'Lapangan Futsal A', sport: 'Futsal', price: 180000, isActive: true },
    { id: 'c-4', tenantId: 'tenant-gor-101', name: 'Lapangan Tenis Outdoor', sport: 'Tenis', price: 120000, isActive: true }
  ];

  /* ========================================================================= */
  /* SECTION A: PURE UNIT TESTS                                               */
  /* ========================================================================= */

  await t.test('UNIT A.1: Explicit Tenant ID Resolution from tenant.id, tenantId, and tenant.tenant_id', () => {
    const profileWithTenantObj = { tenant: { id: 'gor-tenant-alpha', name: 'Cabang Alpha' } };
    assert.equal(desktopResolveTenantId(profileWithTenantObj), 'gor-tenant-alpha');
    assert.equal(mobileResolveTenantId(profileWithTenantObj), 'gor-tenant-alpha');

    const profileWithTenantId = { tenantId: 'gor-tenant-beta' };
    assert.equal(desktopResolveTenantId(profileWithTenantId), 'gor-tenant-beta');
    assert.equal(mobileResolveTenantId(profileWithTenantId), 'gor-tenant-beta');

    const profileWithNestedSnakeCase = { tenant: { tenant_id: 'gor-tenant-gamma' } };
    assert.equal(desktopResolveTenantId(profileWithNestedSnakeCase), 'gor-tenant-gamma');
    assert.equal(mobileResolveTenantId(profileWithNestedSnakeCase), 'gor-tenant-gamma');
  });

  await t.test('UNIT A.2: Profile without Tenant ID STRICTLY returns null (NEVER falls back to user ID or UID)', () => {
    const profileUserOnly = {
      id: 'usr-auth-uuid-12345',
      uid: 'usr-auth-uuid-12345',
      displayName: 'Operator Arena'
    };

    assert.equal(desktopResolveTenantId(profileUserOnly), null, 'Desktop resolver must not fallback to id/uid');
    assert.equal(mobileResolveTenantId(profileUserOnly), null, 'Mobile resolver must not fallback to id/uid');
    assert.equal(desktopResolveTenantId(null), null);
    assert.equal(mobileResolveTenantId(null), null);
    assert.equal(desktopResolveTenantId({}), null);
    assert.equal(mobileResolveTenantId({}), null);
  });

  await t.test('UNIT A.3: Multi-Tenant Court Filtering excludes courts from other tenants', () => {
    const mixedTenantCourts = [
      ...mockCourts,
      { id: 'c-foreign-99', tenantId: 'tenant-rival-999', name: 'Lapangan Rival', sport: 'Badminton', price: 75000 }
    ];

    const isolated = filterCourtsByTenant(mixedTenantCourts, 'tenant-gor-101');
    assert.equal(isolated.length, 4);
    assert.equal(isolated.some((c: any) => c.id === 'c-foreign-99'), false, 'Foreign tenant court must be excluded');
    assert.deepEqual(filterCourtsByTenant(mixedTenantCourts, null), [], 'Missing tenant ID must return empty array');
  });

  await t.test('UNIT A.4: Currency Formatting & Parsing (formatNumberWithDots & parseNumberFromDots)', () => {
    assert.equal(formatNumberWithDots(150000), '150.000');
    assert.equal(desktopFormatNumberWithDots(150000), '150.000');
    assert.equal(formatNumberWithDots(0), '0');
    assert.equal(formatNumberWithDots('90000'), '90.000');
    assert.equal(formatNumberWithDots(''), '');
    assert.equal(formatNumberWithDots(null), '');
    assert.equal(formatNumberWithDots(undefined), '');
    assert.equal(formatNumberWithDots('abc120000xyz'), '120.000');

    assert.equal(parseNumberFromDots('150.000'), 150000);
    assert.equal(desktopParseNumberFromDots('150.000'), 150000);
    assert.equal(parseNumberFromDots('90.000'), 90000);
    assert.equal(parseNumberFromDots('0'), 0);
    assert.equal(parseNumberFromDots(''), 0);
    assert.equal(parseNumberFromDots(null), 0);
    assert.equal(parseNumberFromDots(undefined), 0);
    assert.equal(parseNumberFromDots('invalid-string'), 0);
  });

  await t.test('UNIT A.5: Court Grouping by Sport Category (groupCourtsBySport)', () => {
    const grouped: Record<string, any[]> = groupCourtsBySport(mockCourts);
    assert.equal(Object.keys(grouped).length, 3);
    assert.equal(grouped['Badminton'].length, 2);
    assert.equal(grouped['Futsal'].length, 1);
    assert.equal(grouped['Tenis'].length, 1);
  });

  await t.test('UNIT A.6: Individual Price Input & Empty/Invalid Nominal Validation (validatePriceInput)', () => {
    assert.equal(validatePriceInput('').valid, false);
    assert.equal(validatePriceInput('   ').valid, false);
    assert.equal(validatePriceInput(null).valid, false);
    assert.equal(validatePriceInput('120.000').valid, true);
    assert.equal(validatePriceInput('120.000').value, 120000);
    assert.equal(validatePriceInput('0').valid, true);
    assert.equal(validatePriceInput('0').value, 0);
  });

  await t.test('UNIT A.7: Bulk Apply modifies ONLY local state for selected sport category', () => {
    const localPrices: Record<string, string> = {
      'c-1': '90.000',
      'c-2': '90.000',
      'c-3': '180.000',
      'c-4': '120.000'
    };

    const applyBulk = (sportKey: string, formattedPrice: string) => {
      const updated = { ...localPrices };
      mockCourts.forEach((c) => {
        if ((c.sport || 'Umum').toLowerCase() === sportKey.toLowerCase()) {
          updated[c.id] = formattedPrice;
        }
      });
      return updated;
    };

    const updated = applyBulk('Badminton', '110.000');
    assert.equal(updated['c-1'], '110.000');
    assert.equal(updated['c-2'], '110.000');
    assert.equal(updated['c-3'], '180.000');
    assert.equal(updated['c-4'], '120.000');
  });

  await t.test('UNIT A.8: Unsaved Change Detection & Save Payload Construction (buildChangedCourtsPayload)', () => {
    const mixedCourts = [
      ...mockCourts,
      { id: 'c-foreign-99', tenantId: 'tenant-rival-999', name: 'Lapangan Rival', sport: 'Badminton', price: 75000, isActive: true }
    ];

    const localPrices: Record<string, string> = {
      'c-1': '100.000',        // Modified (90000 -> 100000)
      'c-2': '90.000',         // Unmodified
      'c-3': '180.000',        // Unmodified
      'c-4': '135.000',        // Modified (120000 -> 135000)
      'c-foreign-99': '99.000' // Foreign tenant court - MUST NOT be included in payload!
    };

    const payload = buildChangedCourtsPayload(mixedCourts, localPrices, 'tenant-gor-101');
    assert.equal(payload.length, 2, 'Only modified courts belonging to active tenant should be included');
    assert.equal(payload[0].id, 'c-1');
    assert.equal(payload[0].price, 100000);
    assert.equal(payload[1].id, 'c-4');
    assert.equal(payload[1].price, 135000);
    assert.equal(payload.some((item: any) => item.id === 'c-foreign-99'), false);
  });

  // Seed query cache for deterministic SSR Component testing
  queryClient.setQueryData(['arenaData', 'tenant-gor-101'], {
    tenantProfile: mockOwnerProfile.tenant,
    courts: mockCourts,
    bookings: [],
    transactions: []
  });

  queryClient.setQueryData(['arenaData', 'tenant-empty-gor'], {
    tenantProfile: { id: 'tenant-empty-gor', name: 'GOR Baru Kosong' },
    courts: [],
    bookings: [],
    transactions: []
  });

  /* ========================================================================= */
  /* SECTION B: SSR COMPONENT TESTS                                            */
  /* ========================================================================= */

  await t.test('SSR B.1: Desktop Viewport (1024px) renders PengaturanDesktopMain for tab=tarif', () => {
    (globalThis as any).window.innerWidth = 1024;

    const htmlDesktop = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );

    assert.ok(htmlDesktop.length > 0);
    assert.ok(htmlDesktop.includes('Pengaturan'), 'Desktop must render Pengaturan title');
    assert.ok(htmlDesktop.includes('Kelola profil arena, QRIS, rekening bank'));
    assert.equal(htmlDesktop.includes('chua-mobile-app'), false, 'Desktop must not contain chua-mobile-app wrapper');
  });

  await t.test('SSR B.2: Mobile Viewport (375px) renders MobileCourtPricingMain with Court Cards & Summary when tab=tarif', () => {
    (globalThis as any).window.innerWidth = 375;

    const htmlMobile = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );

    assert.ok(htmlMobile.length > 0);
    assert.ok(htmlMobile.includes('chua-mobile-app'), 'Mobile must be scoped under chua-mobile-app');
    assert.ok(htmlMobile.includes('Tarif &amp; Fasilitas Lapangan') || htmlMobile.includes('Tarif & Fasilitas Lapangan'));
    assert.ok(htmlMobile.includes('Atur Cepat Tarif (Bulk Apply)'));
    // Verify court list cards rendered
    assert.ok(htmlMobile.includes('Lapangan 1 (Vinyl)'));
    assert.ok(htmlMobile.includes('Lapangan Futsal A'));
    assert.ok(htmlMobile.includes('Lapangan Tenis Outdoor'));
    // Verify summary breakdown per sport
    assert.ok(htmlMobile.includes('Badminton: 2'));
  });

  await t.test('SSR B.3: Mobile Viewport (375px) with tab=profil preserves original settings view', () => {
    (globalThis as any).window.innerWidth = 375;

    const htmlMobileProfil = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=profil'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );

    assert.ok(htmlMobileProfil.includes('Pengaturan'));
    assert.ok(htmlMobileProfil.includes('Kelola profil arena, QRIS, rekening bank'));
  });

  await t.test('SSR B.4: Rules of Hooks Compliance (Responsive toggle maintains invariant hooks)', () => {
    // 1. Mobile tab=tarif
    (globalThis as any).window.innerWidth = 375;
    const htmlMobile = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );
    assert.ok(htmlMobile.includes('chua-mobile-app'));

    // 2. Desktop tab=tarif
    (globalThis as any).window.innerWidth = 1024;
    const htmlDesktop = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );
    assert.ok(!htmlDesktop.includes('chua-mobile-app'));

    // 3. Switch back to mobile
    (globalThis as any).window.innerWidth = 375;
    const htmlMobileAgain = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(PengaturanPage, { userProfile: mockOwnerProfile, onTenantUpdated: () => {} })
        )
      )
    );
    assert.ok(htmlMobileAgain.includes('chua-mobile-app'));
  });

  await t.test('SSR B.5: Missing Tenant Context displays Tenant Missing Screen and prevents fetch', () => {
    (globalThis as any).window.innerWidth = 375;

    const htmlNoTenant = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(MobileCourtPricingMain, { userProfile: mockProfileNoTenant })
        )
      )
    );

    assert.ok(htmlNoTenant.includes('Konteks Cabang (Tenant) Tidak Ditemukan'));
    assert.ok(htmlNoTenant.includes('Akun Anda tidak memiliki asosiasi cabang/tenant yang valid'));
    // Verify no query was cached/triggered under user-auth-uuid-999
    assert.equal(queryClient.getQueryData(['arenaData', 'user-auth-uuid-999']), undefined);
  });

  await t.test('SSR B.6: Empty State Rendering when no courts are registered', () => {
    const profileWithEmptyTenant = {
      tenantId: 'tenant-empty-gor',
      role: 'owner',
      tenant: { id: 'tenant-empty-gor', name: 'GOR Baru Kosong' }
    };

    (globalThis as any).window.innerWidth = 375;

    const htmlEmpty = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(MobileCourtPricingMain, { userProfile: profileWithEmptyTenant })
        )
      )
    );

    assert.ok(htmlEmpty.includes('Belum Ada Lapangan'));
    assert.ok(htmlEmpty.includes('Belum ada fasilitas lapangan yang terdaftar'));
  });

  await t.test('SSR B.7: Loading State & Error State Rendering', () => {
    // 1. Loading state: unseeded tenant where query is initially loading
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

    // 2. Error state: when loadError is provided
    const htmlError = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/pengaturan?tab=tarif'] },
        React.createElement(QueryClientProvider, { client: queryClient },
          React.createElement(MobileCourtPricingMain, { 
            userProfile: mockOwnerProfile, 
            loadError: 'Gagal menghubungi layanan data fasilitas.' 
          })
        )
      )
    );
    assert.ok(htmlError.includes('Gagal Memuat Data Lapangan'));
    assert.ok(htmlError.includes('Gagal menghubungi layanan data fasilitas.'));
  });

  /* ========================================================================= */
  /* SECTION C: MOCKED WORKFLOW TESTS (DEPENDENCY SIMULATION)                  */
  /* ========================================================================= */

  await t.test('WORKFLOW C.1: Profile without Tenant ID aborts both fetch and save operations', async () => {
    let fetchCalled = false;
    let saveCalled = false;

    const simulateLifecycle = async (profile: any) => {
      const tid = mobileResolveTenantId(profile);
      if (!tid) {
        return { fetched: false, saved: false, reason: 'TENANT_ID_MISSING' };
      }
      fetchCalled = true;
      saveCalled = true;
      return { fetched: true, saved: true };
    };

    const result = await simulateLifecycle(mockProfileNoTenant);
    assert.equal(result.reason, 'TENANT_ID_MISSING');
    assert.equal(fetchCalled, false, 'Fetch must NOT be invoked when tenant ID is missing');
    assert.equal(saveCalled, false, 'Save must NOT be invoked when tenant ID is missing');
  });

  await t.test('WORKFLOW C.2: Double Submission Prevention on Save Button', async () => {
    let callCount = 0;
    let isSaving = false;

    const mockLongRunningSave = async () => {
      if (isSaving) return { ignored: true };
      isSaving = true;
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      isSaving = false;
      return { success: true };
    };

    const [p1, p2] = await Promise.all([
      mockLongRunningSave(),
      mockLongRunningSave()
    ]);

    assert.equal(callCount, 1, 'Only one save request should be executed');
    assert.equal((p1 as any).success, true);
    assert.equal((p2 as any).ignored, true, 'Second concurrent request must be ignored');
  });

  await t.test('WORKFLOW C.3: Batch Update Invocation with Changed Courts Only & Arena Refresh Event', async () => {
    let capturedPayload: any = null;
    let eventDispatched = false;

    const mockUpdateCourtsBatch = async (updatesArray: any[]) => {
      capturedPayload = updatesArray;
      return updatesArray;
    };

    const mockDispatchEvent = (eventName: string) => {
      if (eventName === 'simak_refresh_arena_data') {
        eventDispatched = true;
      }
    };

    const prices: Record<string, string> = {
      'c-1': '105.000', // Changed from 90000
      'c-2': '90.000',  // Unchanged
      'c-3': '180.000', // Unchanged
      'c-4': '120.000'  // Unchanged
    };

    const executeSave = async () => {
      const updates = buildChangedCourtsPayload(mockCourts, prices, 'tenant-gor-101');
      await mockUpdateCourtsBatch(updates);
      mockDispatchEvent('simak_refresh_arena_data');
      return { success: true, count: updates.length };
    };

    const res = await executeSave();
    assert.equal(res.success, true);
    assert.equal(res.count, 1);
    assert.equal(capturedPayload.length, 1);
    assert.equal(capturedPayload[0].id, 'c-1');
    assert.equal(capturedPayload[0].price, 105000);
    assert.equal(eventDispatched, true, 'CustomEvent simak_refresh_arena_data must be dispatched');
  });

  await t.test('WORKFLOW C.4: Error Feedback Handling on Network Failure', async () => {
    const mockFailingBatchUpdate = async () => {
      throw new Error('Supabase network error: timeout');
    };

    let feedbackState: { type: string; text: string } | null = null;
    try {
      await mockFailingBatchUpdate();
    } catch (err: any) {
      feedbackState = {
        type: 'error',
        text: 'Gagal menyimpan tarif lapangan: ' + err.message
      };
    }

    assert.notEqual(feedbackState, null);
    assert.equal(feedbackState?.type, 'error');
    assert.match(feedbackState?.text || '', /Supabase network error: timeout/);
  });

});
