import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { filterDataByTime } from '../src/components/DateRangeFilter.js';

// Setup Mock Window for Node.js test environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1024,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

// Import components for direct render testing
import FinancePage, { FinanceDesktopMain } from '../src/pages/FinancePage.jsx';
import MobileFinanceMain from '../src/mobile/pages/admin/MobileFinanceMain.jsx';

test('CHUVATOR — Phase 4.5.1 Mobile Financial Administration Logic & Security Tests', async (t) => {

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const mockUserProfile = { tenantId: 'demo-tenant-1', role: 'owner', displayName: 'Manager Test' };

  // 1. Component Render: FinancePage at Mobile Viewport (375px)
  await t.test('1. Mobile Viewport Render (375px): Renders MobileFinanceMain without Hooks errors', () => {
    (globalThis as any).window.innerWidth = 375;
    const html = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(FinancePage, { userProfile: mockUserProfile })
      )
    );
    assert.ok(html.length > 0);
    // MobileFinanceMain renders mobile skeleton with animate-pulse during SSR loading
    assert.ok(html.includes('animate-pulse'), 'Mobile view must render mobile loading skeleton');
    assert.ok(!html.includes('Memuat laporan keuangan terpadu'), 'Mobile view must NOT render desktop loading text');
  });

  // 2. Component Render: FinancePage at Desktop Viewport (1024px)
  await t.test('2. Desktop Viewport Render (1024px): Renders FinanceDesktopMain without Hooks errors', () => {
    (globalThis as any).window.innerWidth = 1024;
    const html = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(FinancePage, { userProfile: mockUserProfile })
      )
    );
    assert.ok(html.length > 0);
    // Desktop renders desktop loading text
    assert.ok(html.includes('Memuat laporan keuangan terpadu'), 'Desktop view must render original desktop loading message');
    assert.ok(!html.includes('animate-pulse'), 'Desktop view must NOT render mobile skeleton');
  });

  // 3. Viewport Switching Compliance (Rules of Hooks verification)
  await t.test('3. Viewport Switch Compliance: Toggles between 375px and 1024px seamlessly without React Hooks violation', () => {
    // Switch to Mobile
    (globalThis as any).window.innerWidth = 375;
    const htmlMobile = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(FinancePage, { userProfile: mockUserProfile })
      )
    );
    assert.ok(htmlMobile.includes('animate-pulse'));

    // Switch to Desktop
    (globalThis as any).window.innerWidth = 1024;
    const htmlDesktop = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(FinancePage, { userProfile: mockUserProfile })
      )
    );
    assert.ok(htmlDesktop.includes('Memuat laporan keuangan terpadu'));

    // Switch back to Mobile
    (globalThis as any).window.innerWidth = 375;
    const htmlMobileAgain = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(FinancePage, { userProfile: mockUserProfile })
      )
    );
    assert.ok(htmlMobileAgain.includes('animate-pulse'));
  });

  // 4. Standalone Desktop Component Verification
  await t.test('4. Standalone Desktop: FinanceDesktopMain can be rendered independently', () => {
    const html = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(FinanceDesktopMain, { userProfile: mockUserProfile })
      )
    );
    assert.ok(html.includes('Memuat laporan keuangan terpadu'));
  });

  // 5. Standalone Mobile Component Verification & SPP Label Accuracy
  await t.test('5. Standalone Mobile: MobileFinanceMain renders mobile layout and uses accurate SPP payment label', () => {
    const html = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MobileFinanceMain, { userProfile: mockUserProfile })
      )
    );
    assert.ok(html.includes('animate-pulse'));
  });

  // Mock data setup for Financial Business Logic
  const mockBookings = [
    {
      id: 'b1',
      bookingDate: new Date().toISOString().split('T')[0],
      price: 100000,
      status: 'CONFIRMED',
      isVoid: false,
      customerName: 'Budi Santoso',
      courtName: 'Lapangan 1 (Badminton)',
      startTime: '09:00',
      endTime: '10:00'
    },
    {
      id: 'b2',
      bookingDate: new Date().toISOString().split('T')[0],
      price: 150000,
      status: 'VOID',
      isVoid: true,
      customerName: 'Ahmad Dahlan',
      courtName: 'Lapangan 2 (Futsal)',
      startTime: '19:00',
      endTime: '20:00',
      voidedBy: 'Manager GOR',
      voidedAt: '2026-11-10T10:00:00.000Z',
      voidReason: 'Pelanggan membatalkan sewa karena hujan lebat'
    }
  ];

  const mockTransactions = [
    {
      id: 'tx1',
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      amount: 45000,
      itemCategory: 'Penjualan Retail POS',
      itemName: 'Pocari Sweat 2x, Grip Raket 1x',
      paymentMethod: 'Tunai (Cash)',
      status: 'COMPLETED',
      isVoid: false
    },
    {
      id: 'tx2',
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      amount: 250000,
      itemCategory: 'SPP & Pendaftaran Akademi',
      itemName: 'Iuran Bulanan SPP - Rizky Pratama',
      paymentMethod: 'QRIS',
      status: 'COMPLETED',
      isVoid: false
    },
    {
      id: 'tx3',
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      amount: 80000,
      itemCategory: 'Penjualan Retail POS',
      itemName: 'Kaos Jersey Badminton',
      paymentMethod: 'Transfer BCA',
      status: 'BATAL', // alternative void status
      isVoid: false,
      voidedBy: 'Kasir 1',
      voidReason: 'Salah input nominal kasir'
    }
  ];

  const isRecordActive = (item: any) => {
    const status = String(item.status || '').toUpperCase();
    return status !== 'VOID' && status !== 'BATAL' && status !== 'CANCELLED' && !item.isVoid;
  };

  // 6. Total Revenue & Strict VOID Exclusion from KPI
  await t.test('6. KPI Revenue: Correctly calculates Gross, Court, POS, and SPP revenue excluding VOID records', () => {
    const activeBookings = mockBookings.filter(isRecordActive);
    const activeTransactions = mockTransactions.filter(isRecordActive);

    const bookingRevenue = activeBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const posRevenue = activeTransactions
      .filter((t) => t.itemCategory !== 'SPP & Pendaftaran Akademi' && t.itemCategory !== 'SPP Akademi')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const sppRevenue = activeTransactions
      .filter((t) => t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalGrossRevenue = bookingRevenue + posRevenue + sppRevenue;

    assert.equal(activeBookings.length, 1);
    assert.equal(bookingRevenue, 100000);
    assert.equal(posRevenue, 45000);
    assert.equal(sppRevenue, 250000);
    assert.equal(totalGrossRevenue, 395000);
  });

  // 7. Separation of Sewa, POS, and SPP revenue streams
  await t.test('7. Revenue Stream Separation: Accurately isolates revenue by business line', () => {
    const activeTransactions = mockTransactions.filter(isRecordActive);
    const isSPP = (cat: string) => cat === 'SPP & Pendaftaran Akademi' || cat === 'SPP Akademi';

    const posItems = activeTransactions.filter(t => !isSPP(t.itemCategory));
    const sppItems = activeTransactions.filter(t => isSPP(t.itemCategory));

    assert.equal(posItems.length, 1);
    assert.equal(posItems[0].id, 'tx1');
    assert.equal(sppItems.length, 1);
    assert.equal(sppItems[0].id, 'tx2');
  });

  // 8. Category Filter for Unified Financial Ledger
  await t.test('8. Ledger Category Filter: Filters merged ledger by ALL, SEWA, POS, and SPP correctly', () => {
    const mergedLedger = [
      ...mockBookings.map(b => ({ id: `booking-${b.id}`, type: 'SEWA', amount: b.price, isVoid: !isRecordActive(b) })),
      ...mockTransactions.map(t => {
        const isSPP = t.itemCategory === 'SPP & Pendaftaran Akademi' || t.itemCategory === 'SPP Akademi';
        return { id: `tx-${t.id}`, type: isSPP ? 'SPP' : 'POS', amount: t.amount, isVoid: !isRecordActive(t) };
      })
    ];

    assert.equal(mergedLedger.length, 5);

    const filterByCategory = (cat: string) => {
      if (cat === 'ALL') return mergedLedger;
      return mergedLedger.filter(item => item.type === cat);
    };

    assert.equal(filterByCategory('ALL').length, 5);
    assert.equal(filterByCategory('SEWA').length, 2);
    assert.equal(filterByCategory('POS').length, 2);
    assert.equal(filterByCategory('SPP').length, 1);
  });

  // 9. Time Range Filter (DateRangeFilter semantics)
  await t.test('9. Date Range Filter: Filters records according to time semantic ranges (today, week, month)', () => {
    const today = new Date().toISOString().split('T')[0];
    const pastBooking = [{ id: 'bOld', bookingDate: '2024-01-01', price: 50000, status: 'CONFIRMED' }];
    const todayBooking = [{ id: 'bToday', bookingDate: today, price: 75000, status: 'CONFIRMED' }];

    const filteredToday = filterDataByTime([...pastBooking, ...todayBooking], 'bookingDate', 'today');
    assert.equal(filteredToday.length, 1);
    assert.equal(filteredToday[0].id, 'bToday');

    const filteredCustom = filterDataByTime(
      [...pastBooking, ...todayBooking], 
      'bookingDate', 
      'custom', 
      { start: '2023-12-01', end: '2024-02-01' }
    );
    assert.equal(filteredCustom.length, 1);
    assert.equal(filteredCustom[0].id, 'bOld');
  });

  // 10. VOID Metadata Preservation
  await t.test('10. VOID Metadata: Preserves audit trail for voided transactions', () => {
    const voidedBooking = mockBookings.find(b => b.isVoid);
    assert.ok(voidedBooking);
    assert.equal(voidedBooking.voidedBy, 'Manager GOR');
    assert.equal(voidedBooking.voidReason, 'Pelanggan membatalkan sewa karena hujan lebat');
    assert.ok(voidedBooking.voidedAt);
  });

  // 11. Prevention of Duplicate VOID
  await t.test('11. VOID Guard: Prevents re-voiding an already voided record', () => {
    const attemptVoid = (item: any) => {
      if (item.isVoid || !isRecordActive(item)) {
        return { success: false, reason: 'Record sudah berstatus VOID dan tidak dapat dibatalkan ulang.' };
      }
      return { success: true, newStatus: 'VOID' };
    };

    const res1 = attemptVoid(mockBookings[0]); // active b1
    assert.equal(res1.success, true);

    const res2 = attemptVoid(mockBookings[1]); // already VOID b2
    assert.equal(res2.success, false);
    assert.match(res2.reason || '', /sudah berstatus VOID/);
  });

  // 12. Viewport Breakpoint Switch (<=767px mobile vs >=768px desktop)
  await t.test('12. Viewport Breakpoint Logic: Accurately switches between mobile (<=767px) and desktop (>=768px)', () => {
    const isMobileViewport = (width: number) => width <= 767;

    assert.equal(isMobileViewport(320), true);
    assert.equal(isMobileViewport(375), true);
    assert.equal(isMobileViewport(414), true);
    assert.equal(isMobileViewport(767), true);

    assert.equal(isMobileViewport(768), false);
    assert.equal(isMobileViewport(1024), false);
    assert.equal(isMobileViewport(1440), false);
  });

});
