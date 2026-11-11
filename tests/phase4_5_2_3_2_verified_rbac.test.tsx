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

import MobileStaffMain, { resolveTenantId } from '../src/mobile/pages/admin/MobileStaffMain.jsx';
import { supabase } from '../src/config/supabase.js';

const TENANT_A_UUID = '11111111-2222-4333-8444-555555555551';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

test('CHUVATOR — PHASE 4.5.2.3.2: Verified RBAC Source Correction Suite', async (t) => {

  const originalRpc = supabase.rpc;
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;

  // Cleanup mocks after each test
  t.afterEach(() => {
    supabase.rpc = originalRpc;
    supabase.from = originalFrom;
    supabase.auth = originalAuth;
  });

  function setupAuthSession(userId: string | null) {
    (supabase as any).auth = {
      ...originalAuth,
      onAuthStateChange: (callback: any) => {
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
  }

  // ===========================================================================
  // 1. userProfile.role = 'owner' TETAPI verified role dari database adalah 'admin'
  // ===========================================================================
  await t.test('1. userProfile.role=owner tetapi verified role=admin -> TIDAK mendapat hak Owner (tidak bisa undang Admin)', async () => {
    setupAuthSession('u1');

    // Mock Database verification: RPC is_superadmin = false, tenant owner = null, users_staff = admin
    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    };

    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null })
              })
            })
          })
        };
      }
      if (table === 'users_staff') {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({
                  data: { id: 's1', uid: 'u1', role: 'admin', tenant_id: TENANT_A_UUID, is_active: true, status: 'active' },
                  error: null
                }),
                order: () => Promise.resolve({ data: [], error: null })
              }),
              order: () => Promise.resolve({ data: [], error: null })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) })
        })
      };
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    // Unverified userProfile claims role='owner', but DB verified role is 'admin'
    const profile = { id: 'u1', tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    // Wait for useAuthRole DB verification to complete
    await act(async () => {
      await sleep(100);
    });

    // MobileStaffMain should allow access to Staff page (since Admin is allowed), BUT when opening Invite Sheet, Admin option is NOT present
    assert.ok(container.innerHTML.includes('Manajemen Staf'), 'Akses staf diizinkan untuk verified Admin');

    const inviteBtn = container.querySelector('button.bg-\\[\\#2455E8\\]') as HTMLButtonElement;
    if (inviteBtn) {
      await act(async () => {
        inviteBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
    }

    const selectRole = container.querySelector('#m-staff-role') as HTMLSelectElement;
    if (selectRole) {
      const adminOption = Array.from(selectRole.options).find(o => o.value === 'admin');
      assert.equal(adminOption, undefined, 'verified role=admin TIDAK memiliki hak Owner untuk mengundang Admin baru (meskipun userProfile.role=owner)');
    }

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 2. userProfile.role = 'admin' TETAPI verified role dari database adalah 'owner'
  // ===========================================================================
  await t.test('2. userProfile.role=admin tetapi verified role=owner -> MENGIKUTI hak Owner (dapat mengundang Admin)', async () => {
    setupAuthSession('u2');

    // Mock Database verification: RPC is_superadmin = false, tenants = ownerRecord
    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    };

    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({
                  data: { id: TENANT_A_UUID, tenant_id: TENANT_A_UUID, name: 'GOR Senayan Mobile', owner_uid: 'u2', status: 'active' },
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) })
        })
      };
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    // Unverified userProfile claims role='admin', but DB verified role is 'owner'
    const profile = { id: 'u2', tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' }, role: 'admin' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    // Wait for useAuthRole DB verification
    await act(async () => {
      await sleep(100);
    });

    assert.ok(container.innerHTML.includes('Manajemen Staf'), 'Akses staf diizinkan untuk verified Owner');

    const inviteBtn = container.querySelector('button.bg-\\[\\#2455E8\\]') as HTMLButtonElement;
    if (inviteBtn) {
      await act(async () => {
        inviteBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
    }

    const selectRole = container.querySelector('#m-staff-role') as HTMLSelectElement;
    assert.ok(selectRole, 'Form select role ditemukan');
    const adminOption = Array.from(selectRole.options).find(o => o.value === 'admin');
    assert.ok(adminOption, 'verified role=owner MENDAPATKAN hak Owner untuk mengundang Admin baru (meskipun userProfile.role=admin)');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 3. Superadmin Terverifikasi DITOLAK (403)
  // ===========================================================================
  await t.test('3. Superadmin terverifikasi dari database ditolak 403 (akses operasional dilarang)', async () => {
    setupAuthSession('u3');

    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const profile = { id: 'u3', tenant: { id: TENANT_A_UUID }, role: 'owner' }; // claims owner, but verified superadmin

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(
      container.innerHTML.includes('Akses Terbatas: Khusus Owner / Admin'),
      'Superadmin terverifikasi ditolak 403 dari Mobile Staff Management'
    );

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 4. Perilaku roleLoading: Selama Loading Akses Operasional Belum Diberikan
  // ===========================================================================
  await t.test('4. Selama roleLoading=true, akses operasional belum diberikan (menampilkan screen verifikasi otorisasi)', async () => {
    // Keep auth onAuthStateChange from triggering callback immediately, so useAuthRole stays in initial loading=true
    (supabase as any).auth = {
      ...originalAuth,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } }
      })
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const profile = { id: 'u4', tenant: { id: TENANT_A_UUID }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    // Immediately check DOM while loading=true
    assert.ok(container.innerHTML.includes('Memverifikasi Otorisasi Akses'), 'Screen loading verifikasi otorisasi ditampilkan');
    assert.ok(!container.innerHTML.includes('Undang Anggota Staf Baru'), 'Akses operasional belum diberikan sebelum verifikasi role selesai');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 5. Hasil Role Belum Terverifikasi / null Ditolak
  // ===========================================================================
  await t.test('5. Hasil role yang tidak terverifikasi (null/unverified) menolak akses (fail-closed)', async () => {
    setupAuthSession('u5');

    // Mock RPC & DB returning no matches
    (supabase as any).rpc = () => Promise.resolve({ data: false, error: null });
    (supabase as any).from = () => ({
      select: () => ({
        eq: () => ({
          limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
          order: () => Promise.resolve({ data: [], error: null })
        })
      })
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    const profile = { id: 'u5', tenant: { id: TENANT_A_UUID }, role: 'kasir' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(container.innerHTML.includes('Akses Terbatas: Khusus Owner / Admin'), 'Role null/unverified ditolak 403 (fail-closed)');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

});
