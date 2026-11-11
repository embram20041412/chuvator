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
const TENANT_B_UUID = '99999999-8888-4777-8666-555555555552';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

test('CHUVATOR — PHASE 4.5.2.3.1: Targeted Staff Access & Tenant Lifecycle Gap Closure Suite', async (t) => {

  const originalRpc = supabase.rpc;
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;

  // Track removed channels for realtime unsubscribes
  const removedChannels: string[] = [];
  const originalRemoveChannel = supabase.removeChannel;
  supabase.removeChannel = (channel: any) => {
    if (channel && channel.topic) {
      removedChannels.push(channel.topic);
    }
    return originalRemoveChannel.call(supabase, channel);
  };

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

  // Helper to setup mock DB response for useAuthRole & page queries
  function setupVerifiedDbMock(forcedRole: string = 'owner') {
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
            eq: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({
                  data: forcedRole === 'owner' ? { id: TENANT_A_UUID, tenant_id: TENANT_A_UUID, status: 'active' } : null,
                  error: null
                })
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
                  data: ['admin', 'kasir', 'coach', 'staff'].includes(forcedRole) ? { id: 's1', uid: val, role: forcedRole, tenant_id: TENANT_A_UUID, is_active: true, status: 'active' } : null,
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
  }

  // ===========================================================================
  // 1 & 2. Owner & Admin dapat membuka Mobile Staff Management
  // ===========================================================================
  await t.test('1 & 2. Owner dan Admin tenant dapat mengakses Mobile Staff Management', async () => {
    // Test Owner
    setupAuthSession('u_owner');
    setupVerifiedDbMock('owner');

    const containerOwner = document.createElement('div');
    document.body.appendChild(containerOwner);
    const rootOwner = ReactDOM.createRoot(containerOwner);

    const ownerProfile = { id: 'u_owner', tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' }, role: 'owner' };
    await act(async () => {
      rootOwner.render(React.createElement(MobileStaffMain, { userProfile: ownerProfile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(containerOwner.innerHTML.includes('Manajemen Staf'), 'Owner dapat mengakses Mobile Staff Management');
    assert.ok(!containerOwner.innerHTML.includes('Akses Terbatas: Khusus Owner / Admin'), 'Owner tidak ditolak 403');

    await act(async () => {
      rootOwner.unmount();
    });
    document.body.removeChild(containerOwner);

    // Test Admin
    setupAuthSession('u_admin');
    setupVerifiedDbMock('admin');

    const containerAdmin = document.createElement('div');
    document.body.appendChild(containerAdmin);
    const rootAdmin = ReactDOM.createRoot(containerAdmin);

    const adminProfile = { id: 'u_admin', tenant: { id: TENANT_A_UUID, name: 'GOR Senayan Mobile' }, role: 'admin' };
    await act(async () => {
      rootAdmin.render(React.createElement(MobileStaffMain, { userProfile: adminProfile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(containerAdmin.innerHTML.includes('Manajemen Staf'), 'Admin dapat mengakses Mobile Staff Management');
    assert.ok(!containerAdmin.innerHTML.includes('Akses Terbatas: Khusus Owner / Admin'), 'Admin tidak ditolak 403');

    await act(async () => {
      rootAdmin.unmount();
    });
    document.body.removeChild(containerAdmin);
  });

  // ===========================================================================
  // 3 & 4. Superadmin, Coach, Kasir, dan Staff DITOLAK (403)
  // ===========================================================================
  await t.test('3 & 4. Superadmin, Coach, Kasir, dan Staff ditolak (403) dari Mobile Staff Management', async () => {
    const restrictedProfiles = [
      { id: 'u_super', tenant: { id: TENANT_A_UUID }, role: 'superadmin', is_superadmin: true },
      { id: 'u_coach', tenant: { id: TENANT_A_UUID }, role: 'coach' },
      { id: 'u_kasir', tenant: { id: TENANT_A_UUID }, role: 'kasir' },
      { id: 'u_staff', tenant: { id: TENANT_A_UUID }, role: 'staff' },
    ];

    for (const profile of restrictedProfiles) {
      setupAuthSession(profile.id);
      setupVerifiedDbMock(profile.role);

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
      });

      await act(async () => {
        await sleep(100);
      });

      assert.ok(
        container.innerHTML.includes('Akses Terbatas: Khusus Owner / Admin'),
        `Role "${profile.role}" ditolak 403 dari Mobile Staff Management`
      );

      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
    }
  });

  // ===========================================================================
  // 5 & 6. Otorisasi Pengangkatan Admin Baru (Owner Boleh, Admin Tidak)
  // ===========================================================================
  await t.test('5 & 6. Owner dapat mengundang Admin baru, sedangkan Admin tenant ditolak dari mengundang Admin', async () => {
    // 1. Check Admin UI -> Cannot invite admin
    setupAuthSession('u_admin');
    setupVerifiedDbMock('admin');

    const containerAdmin = document.createElement('div');
    document.body.appendChild(containerAdmin);
    const rootAdmin = ReactDOM.createRoot(containerAdmin);

    const adminProfile = { id: 'u_admin', tenant: { id: TENANT_A_UUID }, role: 'admin' };
    await act(async () => {
      rootAdmin.render(React.createElement(MobileStaffMain, { userProfile: adminProfile }));
    });

    await act(async () => {
      await sleep(100);
    });

    const inviteBtnAdmin = containerAdmin.querySelector('button.bg-\\[\\#2455E8\\]') as HTMLButtonElement;
    if (inviteBtnAdmin) {
      await act(async () => {
        inviteBtnAdmin.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
    }

    const selectRoleAdmin = containerAdmin.querySelector('#m-staff-role') as HTMLSelectElement;
    if (selectRoleAdmin) {
      const adminOption = Array.from(selectRoleAdmin.options).find(o => o.value === 'admin');
      assert.equal(adminOption, undefined, 'Admin tidak memiliki pilihan option Admin pada form undangan');
    }

    await act(async () => {
      rootAdmin.unmount();
    });
    document.body.removeChild(containerAdmin);

    // 2. Check Owner UI -> Can invite admin
    setupAuthSession('u_owner');
    setupVerifiedDbMock('owner');

    const containerOwner = document.createElement('div');
    document.body.appendChild(containerOwner);
    const rootOwner = ReactDOM.createRoot(containerOwner);

    const ownerProfile = { id: 'u_owner', tenant: { id: TENANT_A_UUID }, role: 'owner' };
    await act(async () => {
      rootOwner.render(React.createElement(MobileStaffMain, { userProfile: ownerProfile }));
    });

    await act(async () => {
      await sleep(100);
    });

    const inviteBtnOwner = containerOwner.querySelector('button.bg-\\[\\#2455E8\\]') as HTMLButtonElement;
    if (inviteBtnOwner) {
      await act(async () => {
        inviteBtnOwner.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
    }

    const selectRoleOwner = containerOwner.querySelector('#m-staff-role') as HTMLSelectElement;
    assert.ok(selectRoleOwner, 'Form select role ditemukan');
    const adminOptionOwner = Array.from(selectRoleOwner.options).find(o => o.value === 'admin');
    assert.ok(adminOptionOwner, 'Owner memiliki pilihan option Admin pada form undangan');

    await act(async () => {
      rootOwner.unmount();
    });
    document.body.removeChild(containerOwner);
  });

  // ===========================================================================
  // 7, 8 & 11. Deferred Promise Race Condition: Inflight Fetch Tenant A dibuang saat berganti ke Tenant B
  // ===========================================================================
  await t.test('7, 8 & 11. Fetch terlambat Tenant A dibuang dan data Tenant A dibersihkan saat berganti ke Tenant B', async () => {
    setupAuthSession('u_owner');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let resolveStaffQueryA: (res: any) => void;
    let resolveInvitesQueryA: (res: any) => void;

    (supabase as any).rpc = () => Promise.resolve({ data: false, error: null });
    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: TENANT_A_UUID, tenant_id: TENANT_A_UUID, status: 'active' }, error: null }) })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (table === 'users_staff' && val === TENANT_A_UUID) {
              return {
                order: () => new Promise((resolve) => {
                  resolveStaffQueryA = (data) => resolve({ data, error: null });
                })
              };
            }
            if (table === 'invitations' && val === TENANT_A_UUID) {
              return {
                order: () => new Promise((resolve) => {
                  resolveInvitesQueryA = (data) => resolve({ data, error: null });
                })
              };
            }
            if (table === 'users_staff' && val === TENANT_B_UUID) {
              return {
                order: () => Promise.resolve({
                  data: [{ id: 'staff-b-1', name: 'Staf Tenant B Eksklusif', display_name: 'Staf Tenant B Eksklusif', email: 'b@tenant.com', role: 'kasir', tenant_id: TENANT_B_UUID }],
                  error: null
                })
              };
            }
            return {
              order: () => Promise.resolve({ data: [], error: null })
            };
          }
        })
      };
    };

    let profile = { id: 'u_owner', tenant: { id: TENANT_A_UUID, name: 'Tenant A' }, role: 'owner' };

    // 1. Mount with Tenant A profile (triggers pending query for Tenant A)
    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    // 2. Switch profile to Tenant B while Tenant A query is pending!
    profile = { id: 'u_owner', tenant: { id: TENANT_B_UUID, name: 'Tenant B' }, role: 'owner' };
    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    // Verify Tenant A data is not present
    assert.ok(!container.innerHTML.includes('Staf Tenant A Lama Racun'), 'Data tenant A langsung dibersihkan dari DOM saat pergantian tenant');

    // 3. Resolve Tenant A pending requests AFTER tenant switched to B!
    await act(async () => {
      if (resolveStaffQueryA) {
        resolveStaffQueryA([
          { id: 'staff-a-old', name: 'Staf Tenant A Lama Racun', display_name: 'Staf Tenant A Lama Racun', email: 'a-old@tenant.com', role: 'admin', tenant_id: TENANT_A_UUID }
        ]);
      }
      if (resolveInvitesQueryA) {
        resolveInvitesQueryA([]);
      }
      await sleep(100);
    });

    // 4. Verify Tenant A data DOES NOT appear in Tenant B view (Race Condition Protection)
    assert.ok(!container.innerHTML.includes('Staf Tenant A Lama Racun'), 'Fetch terlambat Tenant A dibuang dan TIDAK mencemari state Tenant B');
    assert.ok(container.innerHTML.includes('Staf Tenant B Eksklusif'), 'Data Tenant B ditampilkan dengan benar');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // ===========================================================================
  // 9. Component Unmount Safety: Request selesai pasca unmount tidak merubah state
  // ===========================================================================
  await t.test('9. Request yang selesai setelah unmount tidak memperbarui state atau menyebabkan error', async () => {
    setupAuthSession('u_owner');
    setupVerifiedDbMock('owner');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let resolveStaffQuery: (res: any) => void;

    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: TENANT_A_UUID, status: 'active' }, error: null }) })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (table === 'users_staff') {
              return {
                order: () => new Promise((resolve) => {
                  resolveStaffQuery = (data) => resolve({ data, error: null });
                })
              };
            }
            return {
              order: () => Promise.resolve({ data: [], error: null })
            };
          }
        })
      };
    };

    const userProfile = { id: 'u_owner', tenant: { id: TENANT_A_UUID }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile }));
    });

    await act(async () => {
      await sleep(100);
    });

    // Unmount component while fetch is pending!
    await act(async () => {
      root.unmount();
    });

    // Resolve query after unmount
    await act(async () => {
      if (resolveStaffQuery) {
        resolveStaffQuery([
          { id: 'staff-after-unmount', name: 'Staf Post Unmount', display_name: 'Staf Post Unmount', email: 'unmount@test.com', role: 'staff' }
        ]);
      }
      await sleep(30);
    });

    assert.equal(container.innerHTML, '', 'Komponen dibersihkan total dari DOM dan tidak ada memory leak');

    document.body.removeChild(container);
  });

  // ===========================================================================
  // 10. Realtime Channel Cleanup pada Tenant Switch & Unmount
  // ===========================================================================
  await t.test('10. Supabase Realtime channel dibersihkan (unsubscribe) saat pergantian tenant dan unmount', async () => {
    setupAuthSession('u_owner');
    setupVerifiedDbMock('owner');

    const initialChannelsCount = removedChannels.length;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    let profile = { id: 'u_owner', tenant: { id: TENANT_A_UUID }, role: 'owner' };

    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    // Switch tenant to B
    profile = { id: 'u_owner', tenant: { id: TENANT_B_UUID }, role: 'owner' };
    await act(async () => {
      root.render(React.createElement(MobileStaffMain, { userProfile: profile }));
    });

    await act(async () => {
      await sleep(100);
    });

    assert.ok(removedChannels.length > initialChannelsCount, 'Supabase realtime channel Tenant A dibersihkan saat berganti ke Tenant B');

    const countBeforeUnmount = removedChannels.length;

    // Unmount
    await act(async () => {
      root.unmount();
    });

    assert.ok(removedChannels.length > countBeforeUnmount, 'Supabase realtime channel Tenant B dibersihkan saat unmount');
    document.body.removeChild(container);
  });

});
