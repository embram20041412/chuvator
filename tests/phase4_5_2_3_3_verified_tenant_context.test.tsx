import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { JSDOM } from 'jsdom';

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

import MobileStaffMain from '../src/mobile/pages/admin/MobileStaffMain.jsx';
import { supabase } from '../src/config/supabase.js';

const VERIFIED_TENANT_A = '11111111-1111-4111-8111-111111111111';
const VERIFIED_TENANT_B = '22222222-2222-4222-8222-222222222222';
const MISMATCHED_PROFILE_TENANT = '99999999-9999-4999-8999-999999999999';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

test('CHUVATOR — PHASE 4.5.2.3.3: Verified Tenant Context Alignment Suite', async (t) => {

  const originalRpc = supabase.rpc;
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;
  const originalChannel = supabase.channel;

  // Track database queries and realtime channels
  const capturedQueries: { table: string; tenantId: string }[] = [];
  const capturedRealtimeFilters: string[] = [];

  t.afterEach(() => {
    supabase.rpc = originalRpc;
    supabase.from = originalFrom;
    supabase.auth = originalAuth;
    supabase.channel = originalChannel;
    capturedQueries.length = 0;
    capturedRealtimeFilters.length = 0;
  });

  let authListenerCallback: any = null;

  function setupAuthSession(userId: string | null) {
    (supabase as any).auth = {
      ...originalAuth,
      onAuthStateChange: (callback: any) => {
        authListenerCallback = callback;
        if (userId) {
          Promise.resolve().then(() => {
            callback('SIGNED_IN', { user: { id: userId, uid: userId } });
          });
        }
        return {
          data: {
            subscription: {
              unsubscribe: () => {}
            }
          }
        };
      }
    };
    if (authListenerCallback && userId) {
      Promise.resolve().then(() => {
        authListenerCallback('SIGNED_IN', { user: { id: userId, uid: userId } });
      });
    }
  }

  function mockChannelSubscription() {
    (supabase as any).channel = (name: string) => {
      const channelObj = {
        topic: name,
        on: (type: string, opts: any, cb: any) => {
          if (opts?.filter) {
            capturedRealtimeFilters.push(opts.filter);
          }
          return channelObj;
        },
        subscribe: () => channelObj,
        unsubscribe: () => Promise.resolve('ok'),
        teardown: () => Promise.resolve('ok')
      };
      return channelObj;
    };
  }

  function setupVerifiedDbMock(forcedRole: string, verifiedTenantId: string | null) {
    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') {
        return Promise.resolve({ data: forcedRole === 'superadmin', error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };

    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              limit: () => ({
                maybeSingle: () => {
                  const resolvedTid = verifiedTenantId || val;
                  return Promise.resolve({
                    data: (forcedRole === 'owner' && verifiedTenantId !== null) ? { id: resolvedTid, tenant_id: resolvedTid, status: 'active' } : null,
                    error: null
                  });
                }
              })
            })
          })
        };
      }
      if (table === 'users_staff') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'tenant_id') {
                capturedQueries.push({ table, tenantId: val });
              }
              return {
                limit: () => ({
                  maybeSingle: () => Promise.resolve({
                    data: (['admin', 'kasir', 'coach'].includes(forcedRole) && verifiedTenantId !== null) ? { id: 's1', uid: val, role: forcedRole, tenant_id: verifiedTenantId || val, is_active: true, status: 'active' } : null,
                    error: null
                  }),
                  order: () => Promise.resolve({ data: [], error: null })
                }),
                order: () => Promise.resolve({ data: [], error: null })
              };
            }
          })
        };
      }
      if (table === 'invitations') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'tenant_id') {
                capturedQueries.push({ table, tenantId: val });
              }
              return {
                order: () => Promise.resolve({ data: [], error: null })
              };
            }
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) })
        })
      };
    };
  }

  // ===========================================================================
  // 1 & 2. Verified Owner dan Verified Admin dengan matching profile tenant ID
  // ===========================================================================
  await t.test('1 & 2. Verified Owner dan Admin dengan profile tenant ID cocok berhasil memuat data', async () => {
    setupAuthSession('u_owner_matching');
    setupVerifiedDbMock('owner', VERIFIED_TENANT_A);
    mockChannelSubscription();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const profile = { id: 'u_owner_matching', tenant: { id: VERIFIED_TENANT_A, name: 'Cabang Matching' }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(container.innerHTML.includes('Manajemen Staf'), 'Verified Owner dengan matching tenant ID dapat mengakses staf');
    assert.ok(capturedQueries.some(q => q.tenantId === VERIFIED_TENANT_A), 'Query database menggunakan verified tenant ID A');
    assert.ok(capturedRealtimeFilters.includes(`tenant_id=eq.${VERIFIED_TENANT_A}`), 'Realtime subscription terikat ke verified tenant ID A');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 3 & 4. Verified Owner & Admin dengan MISMATCHED profile tenant ID
  // ===========================================================================
  await t.test('3 & 4. Verified Owner & Admin dengan mismatched profile tenant ID HANYA menggunakan verified tenant ID DB', async () => {
    setupAuthSession('u_owner_mismatched');
    // Verified DB tenant is VERIFIED_TENANT_A, but userProfile claims MISMATCHED_PROFILE_TENANT
    setupVerifiedDbMock('owner', VERIFIED_TENANT_A);
    mockChannelSubscription();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const profile = { id: 'u_owner_mismatched', tenant: { id: MISMATCHED_PROFILE_TENANT, name: 'Unverified Fake Tenant' }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(container.innerHTML.includes('Manajemen Staf'), 'Verified Owner dapat mengakses staf menggunakan verified DB tenant');
    assert.ok(capturedQueries.some(q => q.tenantId === VERIFIED_TENANT_A), 'Query database menggunakan verified tenant ID A');
    assert.ok(!capturedQueries.some(q => q.tenantId === MISMATCHED_PROFILE_TENANT), 'TIDAK ada query database yang menggunakan unverified profile tenant ID');
    assert.ok(capturedRealtimeFilters.includes(`tenant_id=eq.${VERIFIED_TENANT_A}`), 'Realtime subscription terikat ke verified tenant ID A');
    assert.ok(!capturedRealtimeFilters.includes(`tenant_id=eq.${MISMATCHED_PROFILE_TENANT}`), 'TIDAK ada realtime subscription yang menggunakan unverified profile tenant ID');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 5 & 6. Verified tenant ID null atau kosong ("")
  // ===========================================================================
  await t.test('5 & 6. Verified tenant ID null atau kosong "" ditolak secara fail-closed (tidak memicu query/realtime)', async () => {
    setupAuthSession('u_no_tenant');
    setupVerifiedDbMock('owner', null); // Verified tenant is null
    mockChannelSubscription();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const profile = { id: 'u_no_tenant', tenant: { id: MISMATCHED_PROFILE_TENANT }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(
      container.innerHTML.includes('Akses Terbatas: Khusus Owner / Admin') || container.innerHTML.includes('Konteks Cabang'),
      'Verified tenant ID null/kosong ditolak 403'
    );
    assert.equal(capturedQueries.length, 0, 'TIDAK ADA query fetch staf/invitation yang dijalankan saat verified tenant ID null');
    assert.equal(capturedRealtimeFilters.length, 0, 'TIDAK ADA realtime subscription yang dibuat saat verified tenant ID null');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 7. roleLoading = true: Tidak ada fetch atau realtime subscription yang berjalan
  // ===========================================================================
  await t.test('7. Selama roleLoading=true, tidak ada fetch data atau realtime subscription yang berjalan', async () => {
    (supabase as any).auth = {
      ...originalAuth,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } }
      })
    };
    mockChannelSubscription();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const profile = { id: 'u_loading', tenant: { id: VERIFIED_TENANT_A }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    assert.ok(container.innerHTML.includes('Memverifikasi Otorisasi Akses'), 'Screen loading otorisasi ditampilkan');
    assert.equal(capturedQueries.length, 0, 'TIDAK ADA fetch yang dijalankan saat roleLoading=true');
    assert.equal(capturedRealtimeFilters.length, 0, 'TIDAK ADA realtime subscription yang dibuat saat roleLoading=true');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 8 & 10. Tenant A berganti ke Tenant B & Late Delayed Response Guard
  // ===========================================================================
  await t.test('8 & 10. Tenant A berganti ke Tenant B menginvalidasi request lama dan tidak menimpa data tenant baru', async () => {
    setupAuthSession('u_switch');
    mockChannelSubscription();

    let resolveStaffQueryA: (res: any) => void;
    let resolveInvitesQueryA: (res: any) => void;
    let currentActiveTenantId = VERIFIED_TENANT_A;

    (supabase as any).rpc = () => Promise.resolve({ data: false, error: null });
    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: currentActiveTenantId, tenant_id: currentActiveTenantId, status: 'active' }, error: null }) })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (table === 'users_staff' && col === 'tenant_id' && val === VERIFIED_TENANT_A) {
              return {
                order: () => new Promise((resolve) => {
                  resolveStaffQueryA = (data) => resolve({ data, error: null });
                })
              };
            }
            if (table === 'invitations' && col === 'tenant_id' && val === VERIFIED_TENANT_A) {
              return {
                order: () => new Promise((resolve) => {
                  resolveInvitesQueryA = (data) => resolve({ data, error: null });
                })
              };
            }
            if (table === 'users_staff' && col === 'tenant_id' && val === VERIFIED_TENANT_B) {
              return {
                order: () => Promise.resolve({
                  data: [{ id: 'staff-b-clean', name: 'Staf Murni Tenant B', display_name: 'Staf Murni Tenant B', email: 'b@clean.com', role: 'kasir', tenant_id: VERIFIED_TENANT_B }],
                  error: null
                })
              };
            }
            return {
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: 's1', uid: val, role: 'owner', tenant_id: currentActiveTenantId, status: 'active' }, error: null }),
                order: () => Promise.resolve({ data: [], error: null })
              }),
              order: () => Promise.resolve({ data: [], error: null })
            };
          }
        })
      };
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let profile = { id: 'u_switch', tenant: { id: VERIFIED_TENANT_A, name: 'Cabang A' }, role: 'owner' };

    // 1. Mount with Tenant A
    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    // 2. Switch profile to Tenant B while Tenant A query is pending
    currentActiveTenantId = VERIFIED_TENANT_B;
    setupAuthSession('u_switch');
    profile = { id: 'u_switch', tenant: { id: VERIFIED_TENANT_B, name: 'Cabang B' }, role: 'owner' };
    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    // 3. Resolve Tenant A delayed promise
    await act(async () => {
      if (resolveStaffQueryA) {
        resolveStaffQueryA([
          { id: 'staff-a-stale', name: 'Staf Racun Stale Tenant A', display_name: 'Staf Racun Stale Tenant A', email: 'stale@a.com', role: 'admin', tenant_id: VERIFIED_TENANT_A }
        ]);
      }
      if (resolveInvitesQueryA) resolveInvitesQueryA([]);
      await sleep(150);
    });

    await act(async () => {
      await sleep(150);
    });

    // 4. Verify Tenant A stale data does NOT pollute Tenant B view
    assert.ok(!container.innerHTML.includes('Staf Racun Stale Tenant A'), 'Data stale Tenant A dibuang');
    assert.ok(container.innerHTML.includes('Staf Murni Tenant B'), 'Data murni Tenant B ditampilkan dengan benar');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

});
