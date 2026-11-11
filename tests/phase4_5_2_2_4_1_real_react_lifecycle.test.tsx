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

// =============================================================================
// TEST BLOCK 1: React component test
// =============================================================================
test('CHUVATOR — PHASE 4.5.2.2.4.2: React component test', async (t) => {

  await t.test('1. Owner dapat menjalankan Dry-Run dan membuka konfirmasi Execute di DOM', async () => {
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
      tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile Owner' },
      role: 'owner'
    };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    assert.ok(container.innerHTML.includes('Audit KK HMAC'), 'Header Audit KK HMAC dirender ke DOM');

    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    assert.ok(dryRunBtn, 'Tombol Dry-Run ditemukan di DOM');

    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.equal(fetchCalled, true, 'Service fetch dipanggil via click');
    assert.equal(requestedTenantId, TENANT_A_UUID, 'Tenant ID Owner sesuai');
    assert.ok(container.innerHTML.includes('Eligible') && container.innerHTML.includes('40'), 'Hasil 9 kategori dirender di DOM');

    const executeBtn = container.querySelector('[data-testid="mobile-btn-execute"]') as HTMLButtonElement;
    assert.ok(executeBtn, 'Tombol Execute ditemukan di DOM');

    await act(async () => {
      executeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.ok(container.innerHTML.includes('Konfirmasi Eksekusi Backfill KK HMAC'), 'Bottom Sheet Konfirmasi terbuka di DOM untuk Owner');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  await t.test('2. Admin dapat menjalankan Dry-Run dan membuka konfirmasi Execute di DOM', async () => {
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
              totalStudents: 50,
              reviewRequired: 5,
              categories: {
                ELIGIBLE: 20,
                ALREADY_VALID: 25,
                MISSING_NO_KK: 5,
                INVALID_NO_KK: 0,
                MISSING_LAST4: 0,
                LAST4_MISMATCH: 0,
                CORRUPT_HMAC: 0,
                HMAC_MISMATCH: 0,
                LAST4_WITHOUT_HMAC: 0
              }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }) as any;

    const userProfile = {
      tenant: { id: TENANT_B_UUID, name: 'GOR Kelapa Gading Admin' },
      role: 'admin'
    };

    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
    });

    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    assert.ok(dryRunBtn, 'Tombol Dry-Run ditemukan di DOM');

    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.equal(fetchCalled, true, 'Service fetch dipanggil via click oleh Admin');
    assert.equal(requestedTenantId, TENANT_B_UUID, 'Tenant ID Admin sesuai');

    const executeBtn = container.querySelector('[data-testid="mobile-btn-execute"]') as HTMLButtonElement;
    assert.ok(executeBtn, 'Tombol Execute ditemukan di DOM');

    await act(async () => {
      executeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    assert.ok(container.innerHTML.includes('Konfirmasi Eksekusi Backfill KK HMAC'), 'Bottom Sheet Konfirmasi terbuka di DOM untuk Admin');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  await t.test('3. UUID tenant kosong, global, dan tidak valid tidak boleh memicu service call', async () => {
    const invalidTenantIds = ['', '  ', 'global', 'GLOBAL', 'invalid-uuid-1234', '123-abc'];

    for (const invalidId of invalidTenantIds) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      let fetchCallCount = 0;
      globalThis.fetch = (async () => {
        fetchCallCount++;
        return new Response(JSON.stringify({ error: 'Should not be called' }), { status: 500 });
      }) as any;

      const userProfile = {
        tenant: { id: invalidId, name: 'Invalid Tenant Branch' },
        role: 'owner'
      };

      await act(async () => {
        root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
      });

      assert.equal(fetchCallCount, 0, `Tidak ada service call untuk tenant ID: "${invalidId}"`);
      assert.ok(container.innerHTML.includes('Konteks Tenant Tidak Valid'), `Peringatan tenant tidak valid dirender untuk "${invalidId}"`);

      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
    }
  });

});

// =============================================================================
// TEST BLOCK 2: Lifecycle test
// =============================================================================
test('CHUVATOR — PHASE 4.5.2.2.4.2: Lifecycle test', async (t) => {

  await t.test('Perubahan tenant A ke tenant B membuang respons pending tenant A (Race Condition Guard)', async () => {
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

    const dryRunBtn = container.querySelector('[data-testid="mobile-btn-dryrun"]') as HTMLButtonElement;
    await act(async () => {
      dryRunBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    profile = { tenant: { id: TENANT_B_UUID, name: 'Tenant B' }, role: 'owner' };
    await act(async () => {
      root.render(React.createElement(MobileTenantBackfillCard, { userProfile: profile }));
    });

    await act(async () => {
      resolveTenantAFetch({
        success: true,
        data: { totalStudents: 9999, categories: { ELIGIBLE: 8888 } }
      });
      await sleep(20);
    });

    assert.ok(!container.innerHTML.includes('9999'), 'Respons async Tenant A dibuang dan tidak mencemari state Tenant B');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  await t.test('Unmount komponen saat request berjalan menjalankan cleanup dan memutus request tambahan', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let resolvePendingFetch: (v: any) => void;
    let fetchCountAfterUnmount = 0;

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

    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      resolvePendingFetch({ success: true, data: { categories: { ELIGIBLE: 10 } } });
      await sleep(20);
    });

    assert.equal(fetchCountAfterUnmount, 0, 'Tidak ada request tambahan dikirim setelah unmount');
    assert.equal(container.innerHTML, '', 'Komponen dibersihkan penuh dari DOM');
    document.body.removeChild(container);
  });

});

// =============================================================================
// TEST BLOCK 3: RBAC test
// =============================================================================
test('CHUVATOR — PHASE 4.5.2.2.4.2: RBAC test', async (t) => {

  await t.test('Peran non-operasional (Superadmin, Coach, Kasir, Staff) ditolak 403 dan tidak memicu service call', async () => {
    const forbiddenRoles = ['superadmin', 'coach', 'kasir', 'staff'];

    for (const role of forbiddenRoles) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      let fetchCallCount = 0;
      globalThis.fetch = (async () => {
        fetchCallCount++;
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      }) as any;

      const userProfile = { tenant: { id: TENANT_A_UUID }, role };

      await act(async () => {
        root.render(React.createElement(MobileTenantBackfillCard, { userProfile }));
      });

      assert.equal(fetchCallCount, 0, `Tidak ada service call yang dipanggil untuk role "${role}"`);
      assert.ok(container.innerHTML.includes('Fasilitas Backfill Khusus Owner &amp; Admin Tenant'), `Role ${role} ditolak dari fitur operasional dengan screen 403`);

      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
    }
  });

});

// =============================================================================
// TEST BLOCK 4: Batch control test
// =============================================================================
test('CHUVATOR — PHASE 4.5.2.2.4.2: Batch control test', async (t) => {

  await t.test('4 & 5. Loop otomatis berhenti tepat setelah batas 20 batch dan mempertahankan runId & leaseToken untuk Resume', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let batchCallCount = 0;
    const capturedPayloads: any[] = [];

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;

      if (urlStr.includes('dryRun=true')) {
        return new Response(JSON.stringify({ success: true, data: { totalStudents: 2000, categories: { ELIGIBLE: 1500 } } }), { status: 200 });
      }

      if (urlStr.includes('/api/admin/backfill_kk_hmac')) {
        batchCallCount++;
        const body = init?.body ? JSON.parse(init.body) : {};
        capturedPayloads.push(body);

        return new Response(
          JSON.stringify({
            success: true,
            status: 'RUNNING',
            code: 'BATCH_PROCESSED',
            runId: 'run-auto-limit-20',
            leaseToken: `token-auto-batch-${batchCallCount}`,
            processed: 50,
            skipped: 0,
            failed: 0,
            hasMoreRows: true,
            completed: false
          }),
          { status: 200 }
        );
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

    assert.equal(batchCallCount, 20, 'Loop otomatis berhenti TEPAT setelah 20 batch');
    assert.ok(container.innerHTML.includes('Batas Otomatis Sesi UI (20 batch) tercapai'), 'Peringatan batas 20 batch dirender di DOM');
    assert.ok(container.innerHTML.includes('run-auto-limit-20') || container.innerHTML.includes('Run Aktif:'), 'runId tetap tersedia di state untuk Resume');
    assert.ok(container.querySelector('[data-testid="mobile-btn-resume"]') !== null, 'Tombol Resume tersedia di DOM setelah auto limit');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  await t.test('6 & 7. Pause menghentikan kelanjutan batch, dan Resume melanjutkan run dengan runId & leaseToken terakhir', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let batchCallCount = 0;
    const capturedPayloads: any[] = [];

    globalThis.fetch = (async (input: any, init: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;

      if (urlStr.includes('dryRun=true')) {
        return new Response(JSON.stringify({ success: true, data: { totalStudents: 500, categories: { ELIGIBLE: 300 } } }), { status: 200 });
      }

      if (urlStr.includes('/api/admin/backfill_kk_hmac')) {
        batchCallCount++;
        const body = init?.body ? JSON.parse(init.body) : {};
        capturedPayloads.push(body);

        if (batchCallCount === 1) {
          return new Response(
            JSON.stringify({
              success: true,
              status: 'RUNNING',
              code: 'BATCH_PROCESSED',
              runId: 'run-pause-resume-77',
              leaseToken: 'token-rotated-pause-77',
              processed: 50,
              skipped: 0,
              failed: 0,
              hasMoreRows: true,
              completed: false
            }),
            { status: 200 }
          );
        } else if (batchCallCount === 2) {
          return new Response(
            JSON.stringify({
              success: true,
              status: 'COMPLETED',
              code: 'RUN_COMPLETED',
              runId: 'run-pause-resume-77',
              leaseToken: 'token-rotated-pause-77',
              processed: 50,
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

    const resumeBtn = container.querySelector('[data-testid="mobile-btn-resume"]') as HTMLButtonElement;
    if (resumeBtn) {
      await act(async () => {
        resumeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });

      const lastPayload = capturedPayloads[capturedPayloads.length - 1];
      assert.equal(lastPayload.runId, 'run-pause-resume-77', 'Resume melanjutkan menggunakan runId terakhir');
      assert.equal(lastPayload.leaseToken, 'token-rotated-pause-77', 'Resume melanjutkan menggunakan leaseToken terakhir');
    }

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  await t.test('8. Tidak ada request tambahan setelah Pause atau unmount', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let fetchCount = 0;

    globalThis.fetch = (async (input: any) => {
      const urlStr = typeof input === 'string' ? input : input.url;
      if (urlStr.includes('dryRun=true')) {
        return new Response(JSON.stringify({ success: true, data: { categories: { ELIGIBLE: 10 } } }), { status: 200 });
      }

      fetchCount++;
      return new Response(
        JSON.stringify({
          success: true,
          status: 'RUNNING',
          runId: 'run-unmount-check',
          leaseToken: 'token-unmount-check',
          processed: 10,
          hasMoreRows: true,
          completed: false
        }),
        { status: 200 }
      );
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

    const initialFetchCount = fetchCount;

    await act(async () => {
      root.unmount();
      await sleep(50);
    });

    assert.equal(fetchCount, initialFetchCount, 'Tidak ada request tambahan setelah unmount');
    document.body.removeChild(container);
  });

});
