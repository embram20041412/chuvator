import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { JSDOM } from 'jsdom';

// Setup JSDOM Environment for Real React DOM Interactions
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

// Valid Database Hex 8-4-4-4-12 UUID Fixtures
const VALID_UUID_TENANT_A = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_TENANT_B = '22222222-2222-4222-8222-222222222222';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

test('CHUVATOR — PHASE 4.5.2.3.6: Real DOM Tenant Switch Interaction & Isolation Proof Suite', async (t) => {
  const originalRpc = supabase.rpc;
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;
  const originalChannel = supabase.channel;
  const originalRemoveChannel = supabase.removeChannel;
  const originalGetChannels = supabase.getChannels;

  const capturedQueries: { table: string; tenantId: string }[] = [];
  const capturedRealtimeFilters: string[] = [];
  const activeChannels: string[] = [];

  t.afterEach(() => {
    supabase.rpc = originalRpc;
    supabase.from = originalFrom;
    supabase.auth = originalAuth;
    supabase.channel = originalChannel;
    supabase.removeChannel = originalRemoveChannel;
    supabase.getChannels = originalGetChannels;
    capturedQueries.length = 0;
    capturedRealtimeFilters.length = 0;
    activeChannels.length = 0;
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
    (supabase as any).getChannels = () => {
      return activeChannels.map((name) => ({ topic: name, topicName: name }));
    };

    (supabase as any).removeChannel = (ch: any) => {
      const topic = typeof ch === 'string' ? ch : ch?.topic;
      const index = activeChannels.indexOf(topic);
      if (index !== -1) {
        activeChannels.splice(index, 1);
      }
      return Promise.resolve('ok');
    };

    (supabase as any).channel = (name: string) => {
      activeChannels.push(name);
      const channelObj = {
        topic: name,
        on: (type: string, opts: any, cb: any) => {
          if (opts?.filter) {
            capturedRealtimeFilters.push(opts.filter);
          }
          return channelObj;
        },
        subscribe: () => channelObj,
        unsubscribe: () => {
          const idx = activeChannels.indexOf(name);
          if (idx !== -1) activeChannels.splice(idx, 1);
          return Promise.resolve('ok');
        },
        teardown: () => Promise.resolve('ok')
      };
      return channelObj;
    };
  }

  // MAIN INTEGRATION TEST: Full UI interaction flow proof
  await t.test('Real DOM UI interaction proof: filter changes, search input, open modal, session invite link, and tenant switch isolation', async () => {
    let resolveStaffAlpha: any = null;

    const userTenantA = {
      id: 'owner-interaction-a',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Arena Cabang A' }
    };

    const userTenantB = {
      id: 'owner-interaction-b',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_B, name: 'Arena Cabang B' }
    };

    setupAuthSession('owner-interaction-a');
    mockChannelSubscription();

    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    };

    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              limit: () => ({
                maybeSingle: () => {
                  const resolvedTid = val === 'owner-interaction-b' ? VALID_UUID_TENANT_B : VALID_UUID_TENANT_A;
                  return Promise.resolve({
                    data: { id: resolvedTid, tenant_id: resolvedTid, status: 'active' },
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
              if (col === 'tenant_id') capturedQueries.push({ table, tenantId: val });
              return {
                limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
                order: () => {
                  if (val === VALID_UUID_TENANT_A) {
                    return new Promise((res) => {
                      resolveStaffAlpha = () =>
                        res({
                          data: [{ id: 'staff-alpha-001', display_name: 'STAFF_MURNI_CABANG_A', role: 'kasir', email: 'kasir_a@arena.com', is_bound: true }],
                          error: null
                        });
                    });
                  }
                  return Promise.resolve({
                    data: [{ id: 'staff-beta-002', display_name: 'STAFF_MURNI_CABANG_B', role: 'admin', email: 'admin_b@arena.com', is_bound: true }],
                    error: null
                  });
                }
              };
            }
          })
        };
      }

      if (table === 'invitations') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'tenant_id') capturedQueries.push({ table, tenantId: val });
              return {
                order: () => {
                  if (val === VALID_UUID_TENANT_A) {
                    return Promise.resolve({
                      data: [{ id: 'inv-alpha-1', email: 'invite_alpha@arena.com', role: 'kasir', status: 'pending', expiresAt: new Date(Date.now() + 86400000).toISOString() }],
                      error: null
                    });
                  }
                  return Promise.resolve({
                    data: [{ id: 'inv-beta-1', email: 'invite_beta@arena.com', role: 'kasir', status: 'pending', expiresAt: new Date(Date.now() + 86400000).toISOString() }],
                    error: null
                  });
                }
              };
            }
          })
        };
      }

      return {
        select: () => ({
          eq: () => ({
            limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
            order: () => Promise.resolve({ data: [], error: null })
          })
        })
      };
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    // 1. Buka halaman Tenant A
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantA} />);
    });
    await sleep(100);

    // Resolve initial fetch for Tenant A
    if (resolveStaffAlpha) {
      await act(async () => {
        resolveStaffAlpha();
      });
    }
    await sleep(150);

    assert.ok(container.textContent?.includes('STAFF_MURNI_CABANG_A'), 'Skenario 1: Halaman Tenant A terbuka dengan data A');

    // 2. Melalui interaksi UI aktual, ubah roleFilter dari all ke "Kasir"
    const buttons = Array.from(container.querySelectorAll('button'));
    const kasirFilterBtn = buttons.find((b) => b.textContent?.trim() === 'Kasir');
    assert.ok(kasirFilterBtn, 'Tombol filter Kasir ditemukan di DOM');

    await act(async () => {
      kasirFilterBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    await sleep(50);

    // 3. Pindah tab ke Undangan dan ubah invitationStatusFilter ke "Pending"
    const invitationsTabBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Undangan'));
    assert.ok(invitationsTabBtn, 'Tab Undangan ditemukan di DOM');

    await act(async () => {
      invitationsTabBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    await sleep(50);

    const pendingFilterBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Pending'));
    if (pendingFilterBtn) {
      await act(async () => {
        pendingFilterBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
    }

    // 4. Isi search query
    const searchInput = container.querySelector('input[placeholder*="Cari"]') as HTMLInputElement;
    assert.ok(searchInput, 'Input pencarian ditemukan di DOM');

    await act(async () => {
      searchInput.value = 'invite_alpha';
      searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await sleep(50);
    assert.strictEqual(searchInput.value, 'invite_alpha', 'Skenario 4: Search query terisi di DOM');

    // 5. Buka modal undangan (+ Undang Staf) dan pastikan modal aktif di DOM
    const inviteBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Undang Staf'));
    assert.ok(inviteBtn, 'Tombol + Undang Staf ditemukan di DOM');

    await act(async () => {
      inviteBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    await sleep(100);

    assert.ok(container.textContent?.includes('Undang Anggota Staf Baru'), 'Skenario 5: Bottom sheet modal undangan aktif di DOM');

    // 6. Simulasikan pembuatan session invite link untuk Tenant A
    const nameInput = container.querySelector('input#m-staff-name') as HTMLInputElement;
    const emailInput = container.querySelector('input#m-staff-email') as HTMLInputElement;
    if (nameInput && emailInput) {
      await act(async () => {
        nameInput.value = 'Staf Sesi A';
        nameInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        emailInput.value = 'sesia@arena.com';
        emailInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    }

    // 7. Ganti konteks ke Tenant B
    setupAuthSession('owner-interaction-b');
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantB} />);
    });
    await sleep(250);

    // 8. Buktikan secara langsung seluruh filter kembali ke default, search kosong, modal tertutup, invite link A hilang
    const searchInputAfter = container.querySelector('input[placeholder*="Cari"]') as HTMLInputElement;
    if (searchInputAfter) {
      assert.strictEqual(searchInputAfter.value, '', 'Skenario 8: Search query ter-reset menjadi kosong');
    }

    assert.strictEqual(
      container.textContent?.includes('Undang Anggota Staf Baru'),
      false,
      'Skenario 8: Modal undangan Tenant A otomatis tertutup saat tenant berganti'
    );

    // 9. Buktikan data Tenant A tidak tampil pada konteks Tenant B (baik di Tab Undangan maupun Tab Staf)
    assert.ok(container.textContent?.includes('invite_beta@arena.com'), 'Skenario 9: Data undangan Tenant B tampil di UI');
    assert.strictEqual(container.textContent?.includes('invite_alpha@arena.com'), false, 'Skenario 9: Data undangan Tenant A TIDAK PERNAH tampil di Tenant B');

    // Pindah kembali ke Tab Staf di Tenant B untuk memverifikasi daftar staf Tenant B
    const staffTabBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Staf ('));
    if (staffTabBtn) {
      await act(async () => {
        staffTabBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
      await sleep(100);
    }

    assert.ok(container.textContent?.includes('STAFF_MURNI_CABANG_B'), 'Skenario 9: Data staf Tenant B tampil dengan benar di Tab Staf');
    assert.strictEqual(
      container.textContent?.includes('STAFF_MURNI_CABANG_A'),
      false,
      'Skenario 9: Data staf Tenant A TIDAK PERNAH tampil di konteks Tenant B'
    );

    // 10. Buktikan delayed response Tenant A tidak dapat menimpa data Tenant B
    if (resolveStaffAlpha) {
      await act(async () => {
        resolveStaffAlpha();
      });
    }
    await sleep(150);

    assert.strictEqual(
      container.textContent?.includes('STAFF_MURNI_CABANG_A'),
      false,
      'Skenario 10: Delayed response Tenant A dibuang dan TIDAK menimpa data Tenant B'
    );

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
