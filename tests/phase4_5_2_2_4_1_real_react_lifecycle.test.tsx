import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { JSDOM } from 'jsdom';
import MobileTenantBackfillCard, { resolveTenantId } from '../src/mobile/components/MobileTenantBackfillCard.jsx';
import MobileStaffMain from '../src/mobile/pages/admin/MobileStaffMain.jsx';
import { isValidBackfillTenantId } from '../src/services/backfillService.js';

// Setup JSDOM Global Environment for Real React DOM Rendering
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/app/staff'
});

globalThis.window = dom.window as any;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  writable: true,
  configurable: true
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const TENANT_A_UUID = '11111111-2222-4333-8444-555555555551';
const TENANT_B_UUID = '99999999-8888-4777-8666-555555555552';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

test('CHUVATOR — PHASE 4.5.2.2.4.1: Real React Lifecycle & DOM Component Integration Suite', async (t) => {

  // ===========================================================================
  // 1. Mount dan Render Komponen Aktual dengan React DOM createRoot & act
  // ===========================================================================
  await t.test('1. Komponen MobileTenantBackfillCard benar-benar di-mount ke React DOM tanpa error', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const userProfile = {
      tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' },
      role: 'owner'
    };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    assert.ok(container.innerHTML.includes('Audit KK HMAC'), 'Header Audit KK HMAC dirender ke DOM');
    assert.ok(container.innerHTML.includes('Analisis Dry-Run (Read-Only)'), 'Tombol Dry-Run dirender ke DOM');
    assert.ok(container.innerHTML.includes('GOR Senayan Mobile'), 'Nama tenant dirender ke DOM');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 2. Pemanggilan Dry-Run Setelah Tombol Ditekan & 9 Kategori Aktual (DOM Click)
  // ===========================================================================
  await t.test('2 & 3. Tombol Dry-Run diklik di DOM -> Memanggil service & merender 9 kategori aktual', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let fetchCalled = false;
    let requestedTenantId = '';

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('/api/admin/backfill_kk_hmac') && urlStr.includes('dryRun=true')) {
        fetchCalled = true;
        const urlParams = new URLSearchParams(urlStr.split('?')[1]);
        requestedTenantId = urlParams.get('tenantId') || '';

        return new Response(
          JSON.stringify({
            success: true,
            mode: 'DRY_RUN',
            data: {
              completedAt: new Date().toISOString(),
              totalStudents: 100,
              reviewRequired: 15,
              categories: {
                ELIGIBLE: 40,
                ALREADY_VALID: 45,
                MISSING_NO_KK: 5,
                INVALID_NO_KK: 2,
                MISSING_LAST4: 3,
                LAST4_MISMATCH: 2,
                CORRUPT_HMAC: 1,
                HMAC_MISMATCH: 1,
                LAST4_WITHOUT_HMAC: 1
              }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }) as any;

    const userProfile = {
      tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' },
      role: 'owner'
    };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    assert.ok(dryRunBtn, 'Tombol Dry-Run ditemukan di DOM');

    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.equal(fetchCalled, true, 'Service fetch benar-benar dipanggil via interaksi click');
    assert.equal(requestedTenantId, TENANT_A_UUID, 'Tenant ID yang dikirim sesuai tenant aktif');

    // Verifikasi 9 kategori dirender di DOM
    const html = container.innerHTML;
    assert.ok(html.includes('Eligible') && html.includes('40'), 'Kategori ELIGIBLE: 40');
    assert.ok(html.includes('Already Valid') && html.includes('45'), 'Kategori ALREADY_VALID: 45');
    assert.ok(html.includes('Missing No KK') && html.includes('5'), 'Kategori MISSING_NO_KK: 5');
    assert.ok(html.includes('Invalid No KK') && html.includes('2'), 'Kategori INVALID_NO_KK: 2');
    assert.ok(html.includes('Missing Last4') && html.includes('3'), 'Kategori MISSING_LAST4: 3');
    assert.ok(html.includes('Last4 Mismatch') && html.includes('2'), 'Kategori LAST4_MISMATCH: 2');
    assert.ok(html.includes('Corrupt HMAC') && html.includes('1'), 'Kategori CORRUPT_HMAC: 1');
    assert.ok(html.includes('HMAC Mismatch') && html.includes('1'), 'Kategori HMAC_MISMATCH: 1');
    assert.ok(html.includes('Last4 Without HMAC') && html.includes('1'), 'Kategori LAST4_WITHOUT_HMAC: 1');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 5 & 6. Execute Tidak Berjalan Sebelum Konfirmasi -> Berjalan Setelah Konfirmasi
  // ===========================================================================
  await t.test('5 & 6. Execute tidak berjalan sebelum konfirmasi bottom sheet, dan berjalan setelah dikonfirmasi', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let executeFetchCount = 0;

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;

      if (urlStr.includes('dryRun=true')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalStudents: 10, categories: { ELIGIBLE: 5 } }
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/api/admin/backfill_kk_hmac') && (init?.method || 'POST').toUpperCase() === 'POST') {
        executeFetchCount++;
        return new Response(
          JSON.stringify({
            success: true,
            status: 'COMPLETED',
            code: 'RUN_COMPLETED',
            runId: 'run-act-100',
            leaseToken: 'token-act-100',
            processed: 5,
            skipped: 0,
            failed: 0,
            hasMoreRows: false,
            completed: true
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }) as any;

    const userProfile = {
      tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' },
      role: 'owner'
    };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    // 1. Run Dry-Run first to populate eligible count
    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    // 2. Click Execute Backfill button
    const executeBtn = container.querySelector('[data-testid="mobile-btn-execute"]') as HTMLButtonElement;
    await act(async () => {
      executeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.equal(executeFetchCount, 0, 'executeKkHmacBackfill BELUM dipanggil sebelum Bottom Sheet dikonfirmasi');
    assert.ok(container.innerHTML.includes('Konfirmasi Eksekusi Backfill KK HMAC'), 'Bottom Sheet Konfirmasi terbuka di DOM');

    // 3. Click Confirm inside Bottom Sheet
    const confirmBtn = container.querySelector('[data-testid="mobile-btn-confirm-execute"]') as HTMLButtonElement;
    assert.ok(confirmBtn, 'Tombol konfirmasi ditemukan di Bottom Sheet');

    await act(async () => {
      confirmBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.equal(executeFetchCount, 1, 'executeKkHmacBackfill dipanggil SETELAH Bottom Sheet dikonfirmasi');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 7 & 8. Run ID & Lease Token digunakan pada Batch Berikutnya & Token Rotasi
  // ===========================================================================
  await t.test('7 & 8. Batch 2 otomatis meneruskan runId & leaseToken (termasuk token hasil rotasi) dari Batch 1', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const capturedPayloads: any[] = [];

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;

      if (urlStr.includes('dryRun=true')) {
        return new Response(JSON.stringify({ success: true, data: { totalStudents: 100, categories: { ELIGIBLE: 80 } } }), { status: 200 });
      }

      if (urlStr.includes('/api/admin/backfill_kk_hmac')) {
        const body = JSON.parse(init.body);
        capturedPayloads.push(body);

        if (capturedPayloads.length === 1) {
          // Batch 1: returns runId & rotated leaseToken
          return new Response(
            JSON.stringify({
              success: true,
              status: 'RUNNING',
              code: 'BATCH_PROCESSED',
              runId: 'run-seq-78',
              leaseToken: 'rotated-lease-token-78-new',
              leaseRecovered: true,
              processed: 50,
              skipped: 0,
              failed: 0,
              hasMoreRows: true,
              completed: false
            }),
            { status: 200 }
          );
        } else {
          // Batch 2: final completion
          return new Response(
            JSON.stringify({
              success: true,
              status: 'COMPLETED',
              code: 'RUN_COMPLETED',
              runId: 'run-seq-78',
              leaseToken: 'rotated-lease-token-78-new',
              processed: 30,
              skipped: 0,
              failed: 0,
              hasMoreRows: false,
              completed: true
            }),
            { status: 200 }
          );
        }
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }) as any;

    const userProfile = { tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    const executeBtn = container.querySelector('[data-testid="mobile-btn-execute"]') as HTMLButtonElement;
    await act(async () => {
      executeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    const confirmBtn = container.querySelector('[data-testid="mobile-btn-confirm-execute"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.equal(capturedPayloads.length, 2, 'Dua batch dipanggil secara berurutan');
    assert.equal(capturedPayloads[0].runId, null, 'Batch 1 diawali tanpa runId');
    assert.equal(capturedPayloads[1].runId, 'run-seq-78', 'Batch 2 menerima runId dari Batch 1');
    assert.equal(capturedPayloads[1].leaseToken, 'rotated-lease-token-78-new', 'Batch 2 menggunakan rotated leaseToken dari Batch 1');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 9. Error mempertahankan token terbaru jika server mengembalikannya
  // ===========================================================================
  await t.test('9. Error pasca-recovery mempertahankan token terbaru di state untuk Resume', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let executeCallCount = 0;

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;

      if (urlStr.includes('dryRun=true')) {
        return new Response(JSON.stringify({ success: true, data: { categories: { ELIGIBLE: 50 } } }), { status: 200 });
      }

      if (urlStr.includes('/api/admin/backfill_kk_hmac')) {
        executeCallCount++;
        return new Response(
          JSON.stringify({
            success: false,
            status: 'BATCH_FAILED',
            code: 'APPLY_RPC_FAILED',
            message: 'RPC apply gagal',
            runId: 'run-err-99',
            leaseToken: 'token-err-rotated-99',
            data: { runId: 'run-err-99', leaseToken: 'token-err-rotated-99' }
          }),
          { status: 422 }
        );
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }) as any;

    const userProfile = { tenant: { id: TENANT_A_UUID }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    const executeBtn = container.querySelector('[data-testid="mobile-btn-execute"]') as HTMLButtonElement;
    await act(async () => {
      executeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    const confirmBtn = container.querySelector('[data-testid="mobile-btn-confirm-execute"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.ok(container.innerHTML.includes('Eksekusi Batch Terhenti'), 'Tampilan error dirender');
    assert.ok(container.innerHTML.includes('token-err-rotated-99') || container.innerHTML.includes('Run Aktif:'), 'Konteks token terbaru dipertahankan');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 10 & 11. completed=false vs completed=true
  // ===========================================================================
  await t.test('10 & 11. completed=false tidak dianggap selesai; completed=true membersihkan token dan menandai penyelesaian final', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let mockCompleted = false;

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;

      if (urlStr.includes('dryRun=true')) {
        return new Response(JSON.stringify({ success: true, data: { categories: { ELIGIBLE: 10 } } }), { status: 200 });
      }

      if (urlStr.includes('/api/admin/backfill_kk_hmac')) {
        return new Response(
          JSON.stringify({
            success: true,
            status: mockCompleted ? 'COMPLETED' : 'RUNNING',
            code: mockCompleted ? 'RUN_COMPLETED' : 'BATCH_PROCESSED',
            runId: 'run-comp-10',
            leaseToken: 'token-comp-10',
            hasMoreRows: false,
            completed: mockCompleted
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }) as any;

    const userProfile = { tenant: { id: TENANT_A_UUID }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    // 1. Dry run
    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    // 2. Execute with mockCompleted = false
    mockCompleted = false;
    const executeBtn = container.querySelector('[data-testid="mobile-btn-execute"]') as HTMLButtonElement;
    await act(async () => {
      executeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    const confirmBtn = container.querySelector('[data-testid="mobile-btn-confirm-execute"]') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.ok(container.innerHTML.includes('status COMPLETED belum terkonfirmasi'), 'completed=false tidak dianggap selesai');

    // 3. Execute with mockCompleted = true
    mockCompleted = true;
    const resumeBtn = container.querySelector('[data-testid="mobile-btn-resume"]') as HTMLButtonElement;
    await act(async () => {
      resumeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.ok(container.innerHTML.includes('Seluruh Backfill Selesai Dituntaskan'), 'completed=true menandai penyelesaian final');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 14. Tenant A berganti ke Tenant B: Respons A tidak mengubah state B
  // ===========================================================================
  await t.test('14. Perubahan tenant A ke tenant B membuang respons pending tenant A (Race Condition Guard)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let resolveTenantAFetch: (v: any) => void;

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;

      if (urlStr.includes(TENANT_A_UUID)) {
        return new Promise((resolve) => {
          resolveTenantAFetch = (resObj: any) => resolve(new Response(JSON.stringify(resObj), { status: 200 }));
        });
      }

      if (urlStr.includes(TENANT_B_UUID)) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalStudents: 50, categories: { ELIGIBLE: 5 } }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }) as any;

    let profile = { tenant: { id: TENANT_A_UUID, name: 'Tenant A' }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile: profile }));
    });

    // 1. Trigger Dry-run for Tenant A (pending promise)
    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    // 2. Re-render component with Tenant B profile while Tenant A request is pending!
    profile = { tenant: { id: TENANT_B_UUID, name: 'Tenant B' }, role: 'owner' };
    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile: profile }));
    });

    // 3. Resolve Tenant A pending request
    await act(async () => {
      resolveTenantAFetch({
        success: true,
        data: { totalStudents: 9999, categories: { ELIGIBLE: 8888 } }
      });
      await sleep(20);
    });

    // State MUST NOT contain Tenant A's 9999 students!
    assert.ok(!container.innerHTML.includes('9999'), 'Respons async Tenant A dibuang dan tidak mencemari state Tenant B');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 15 & 16. Unmount & Cleanup Verifikasi Komponen
  // ===========================================================================
  await t.test('15 & 16. Unmount komponen saat request berjalan menjalankan cleanup tanpa memicu state error', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let resolvePendingFetch: (v: any) => void;

    globalThis.fetch = (async () => {
      return new Promise((resolve) => {
        resolvePendingFetch = (resObj: any) => resolve(new Response(JSON.stringify(resObj), { status: 200 }));
      });
    }) as any;

    const userProfile = { tenant: { id: TENANT_A_UUID }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    // Unmount while request is pending!
    await act(async () => {
      root.unmount();
    });

    // Resolve pending request after unmount
    await act(async () => {
      resolvePendingFetch({ success: true, data: { categories: { ELIGIBLE: 10 } } });
      await sleep(20);
    });

    assert.equal(container.innerHTML, '', 'Komponen berhasil di-unmount dan dibersihkan dari DOM');
    document.body.removeChild(container);
  });

  // ===========================================================================
  // RBAC & Responsive Testing
  // ===========================================================================
  await t.test('Pengujian RBAC untuk Superadmin, Coach, Kasir, Staff', async () => {
    const roles = ['superadmin', 'coach', 'kasir', 'staff'];

    for (const role of roles) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      const userProfile = { tenant: { id: TENANT_A_UUID }, role };

      await act(async () => {
        root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
      });

      assert.ok(container.innerHTML.includes('Fasilitas Backfill Khusus Owner &amp; Admin Tenant'), `Role ${role} ditolak dari fitur operasional`);

      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
    }
  });

});
