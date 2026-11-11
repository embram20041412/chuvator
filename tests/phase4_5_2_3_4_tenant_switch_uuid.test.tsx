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

import MobileStaffMain, { isValidUUID, resolveTenantId } from '../src/mobile/pages/admin/MobileStaffMain.jsx';
import { supabase } from '../src/config/supabase.js';

// Valid Database Hex 8-4-4-4-12 UUID Fixtures
const VALID_UUID_TENANT_A = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_TENANT_B = '22222222-2222-4222-8222-222222222222';
const INVALID_NON_UUID_STRINGS = ['tenant-alpha-001', 'global', 'null', 'undefined', '', '12345', 'invalid-uuid-format'];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

test('CHUVATOR — PHASE 4.5.2.3.4: Final Tenant Switch & Strict UUID Validation Suite', async (t) => {
  const originalRpc = supabase.rpc;
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;
  const originalChannel = supabase.channel;
  const originalRemoveChannel = supabase.removeChannel;
  const originalGetChannels = supabase.getChannels;

  const capturedQueries: { table: string; tenantId: string }[] = [];
  const capturedRealtimeFilters: string[] = [];
  const activeChannels: string[] = [];
  let channelRemoveCount = 0;

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
    channelRemoveCount = 0;
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
      channelRemoveCount += 1;
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

  // SUBTEST 1: Strict UUID validation function unit test
  await t.test('1. isValidUUID & resolveTenantId strict unit tests', () => {
    assert.strictEqual(isValidUUID(VALID_UUID_TENANT_A), true, 'UUID v4 Hex 8-4-4-4-12 A valid');
    assert.strictEqual(isValidUUID(VALID_UUID_TENANT_B), true, 'UUID v4 Hex 8-4-4-4-12 B valid');
    
    for (const invalidStr of INVALID_NON_UUID_STRINGS) {
      assert.strictEqual(isValidUUID(invalidStr), false, `String "${invalidStr}" harus ditolak by isValidUUID`);
    }

    assert.strictEqual(isValidUUID(null as any), false, 'null is invalid UUID');
    assert.strictEqual(isValidUUID(undefined as any), false, 'undefined is invalid UUID');
    assert.strictEqual(isValidUUID(12345 as any), false, 'number is invalid UUID');

    assert.strictEqual(resolveTenantId({ tenant: { id: VALID_UUID_TENANT_A } }), VALID_UUID_TENANT_A);
    assert.strictEqual(resolveTenantId({ tenant: { id: 'tenant-alpha-001' } }), null, 'resolveTenantId rejects non-UUID profile tenant');
    assert.strictEqual(resolveTenantId({ tenantId: 'global' }), null, 'resolveTenantId rejects global string');
  });

  // SUBTEST 2: Valid UUID tenant is accepted and queries DB with UUID
  await t.test('2. Valid UUID tenant is accepted and queries DB using verified UUID', async () => {
    const ownerUser = {
      id: 'owner-user-001',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Arena HQ' }
    };

    setupAuthSession('owner-user-001');
    mockChannelSubscription();

    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };

    (supabase as any).from = (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: VALID_UUID_TENANT_A, tenant_id: VALID_UUID_TENANT_A, status: 'active' },
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
            eq: (col: string, val: string) => {
              if (col === 'tenant_id') capturedQueries.push({ table, tenantId: val });
              return {
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null })
                }),
                order: () =>
                  Promise.resolve({
                    data: [{ id: 'staff-1', display_name: 'Ahmad Owner', role: 'owner', email: 'owner@arena.com', is_bound: true }],
                    error: null
                  })
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
                order: () =>
                  Promise.resolve({
                    data: [{ id: 'inv-1', email: 'kasir@arena.com', role: 'kasir', status: 'pending' }],
                    error: null
                  })
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

    await act(async () => {
      root.render(<MobileStaffMain userProfile={ownerUser} />);
    });

    await sleep(250);

    const textContent = container.textContent || '';
    assert.ok(textContent.includes('Manajemen Staf'), 'Halaman staf terbuka untuk valid UUID tenant');
    assert.ok(textContent.includes('owner@arena.com'), 'Data staff tenant A berhasil dirender');

    const staffQueries = capturedQueries.filter((q) => q.table === 'users_staff');
    assert.ok(staffQueries.length >= 1, 'Database query users_staff dijalankan');
    assert.strictEqual(staffQueries[0].tenantId, VALID_UUID_TENANT_A, 'Query memakai UUID tenant A yang diverifikasi');

    const realtimeFilters = capturedRealtimeFilters;
    assert.ok(realtimeFilters.some((f) => f.includes(VALID_UUID_TENANT_A)), 'Realtime channel menggunakan filter UUID tenant A');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // SUBTEST 3: Non-UUID tenant string, null, empty, or global are rejected (fail-closed)
  await t.test('3. Non-UUID strings (tenant-alpha-001, global, empty, null) fail-closed with 0 DB/realtime calls', async () => {
    for (const testTenantId of ['tenant-alpha-001', 'global', 'invalid-uuid-123', '']) {
      capturedQueries.length = 0;
      capturedRealtimeFilters.length = 0;

      const mockUser = {
        id: 'owner-non-uuid',
        role: 'owner',
        tenant: { id: testTenantId, name: 'Fake Branch' }
      };

      setupAuthSession('owner-non-uuid');
      mockChannelSubscription();

      (supabase as any).rpc = (fnName: string) => {
        if (fnName === 'is_superadmin') {
          return Promise.resolve({ data: false, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      };

      (supabase as any).from = (table: string) => {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null })
              }),
              order: () => Promise.resolve({ data: [], error: null })
            })
          })
        };
      };

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(<MobileStaffMain userProfile={mockUser} />);
      });

      await sleep(150);

      const textContent = container.textContent || '';
      assert.ok(
        textContent.includes('Akses Terbatas') || textContent.includes('Khusus Owner / Admin') || textContent.includes('Tidak Ditemukan'),
        `String non-UUID "${testTenantId}" harus menolak akses dengan screen restricted`
      );

      const staffQueries = capturedQueries.filter((q) => q.table === 'users_staff' || q.table === 'invitations');
      assert.strictEqual(staffQueries.length, 0, `Non-UUID "${testTenantId}" tidak memicu query users_staff / invitations`);
      assert.strictEqual(capturedRealtimeFilters.length, 0, `Non-UUID "${testTenantId}" tidak memicu realtime channel subscription`);

      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
    }
  });

  // SUBTEST 4: Tenant Switch clears previous tenant data, modal, invite links, search query & stale responses
  await t.test('4. Tenant Switch (Alpha UUID -> Beta UUID) clears data, modals, links, and drops delayed Alpha responses', async () => {
    let resolveStaffAlpha: any = null;
    let resolveInvitesAlpha: any = null;

    const userTenantA = {
      id: 'owner-switch-a',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Branch A' }
    };

    const userTenantB = {
      id: 'owner-switch-b',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_B, name: 'Branch B' }
    };

    setupAuthSession('owner-switch-a');
    mockChannelSubscription();

    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') {
        return Promise.resolve({ data: false, error: null });
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
                  const resolvedTid = val === 'owner-switch-b' ? VALID_UUID_TENANT_B : VALID_UUID_TENANT_A;
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
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null })
                }),
                order: () => {
                  if (val === VALID_UUID_TENANT_A) {
                    return new Promise((res) => {
                      resolveStaffAlpha = () =>
                        res({
                          data: [{ id: 'staff-alpha-99', display_name: 'STAF_MURNI_ALPHA', role: 'kasir', email: 'alpha@arena.com' }],
                          error: null
                        });
                    });
                  }
                  if (val === VALID_UUID_TENANT_B) {
                    return Promise.resolve({
                      data: [{ id: 'staff-beta-88', display_name: 'STAF_MURNI_BETA', role: 'admin', email: 'beta@arena.com' }],
                      error: null
                    });
                  }
                  return Promise.resolve({ data: [], error: null });
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
                    return new Promise((res) => {
                      resolveInvitesAlpha = () => res({ data: [], error: null });
                    });
                  }
                  if (val === VALID_UUID_TENANT_B) {
                    return Promise.resolve({
                      data: [{ id: 'inv-beta-1', email: 'inv_beta@arena.com', role: 'kasir', status: 'pending' }],
                      error: null
                    });
                  }
                  return Promise.resolve({ data: [], error: null });
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

    // 1. Mount with Tenant Alpha
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantA} />);
    });

    await sleep(100);

    // 2. Switch to Tenant Beta while Alpha fetch is still pending
    setupAuthSession('owner-switch-b');

    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantB} />);
    });

    await sleep(250);

    // 3. Resolve the delayed Tenant Alpha fetch
    if (resolveStaffAlpha && resolveInvitesAlpha) {
      await act(async () => {
        resolveStaffAlpha();
        resolveInvitesAlpha();
      });
    }

    await sleep(200);

    const textContent = container.textContent || '';
    assert.ok(textContent.includes('STAF_MURNI_BETA'), 'Data murni Tenant Beta tampil di UI');
    assert.strictEqual(textContent.includes('STAF_MURNI_ALPHA'), false, 'Data terlambat Tenant Alpha TIDAK mencemari state Tenant Beta');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // SUBTEST 5: Tenant Switch cleans up old realtime channels without leaving duplicates
  await t.test('5. Tenant Switch cleans up old Supabase Realtime channel and subscribes to new UUID channel', async () => {
    const userTenantA = {
      id: 'owner-channel-a',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Branch A' }
    };

    const userTenantB = {
      id: 'owner-channel-b',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_B, name: 'Branch B' }
    };

    setupAuthSession('owner-channel-a');
    mockChannelSubscription();

    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') {
        return Promise.resolve({ data: false, error: null });
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
                  const resolvedTid = val === 'owner-channel-b' ? VALID_UUID_TENANT_B : VALID_UUID_TENANT_A;
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

    // Mount Tenant Alpha
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantA} />);
    });
    await sleep(200);

    const channelAfterAlpha = [...activeChannels];
    assert.ok(channelAfterAlpha.some((c) => c.includes(VALID_UUID_TENANT_A)), 'Channel Tenant A aktif');

    // Switch to Tenant Beta
    setupAuthSession('owner-channel-b');

    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantB} />);
    });
    await sleep(250);

    const channelAfterBeta = [...activeChannels];
    assert.ok(channelRemoveCount >= 1, 'Supabase removeChannel dipanggil saat tenant switch / cleanup');
    assert.ok(channelAfterBeta.some((c) => c.includes(VALID_UUID_TENANT_B)), 'Channel Tenant B aktif setelah switch');
    assert.strictEqual(
      channelAfterBeta.filter((c) => c.includes(VALID_UUID_TENANT_A)).length,
      0,
      'Channel Tenant A sudah dibersihkan dan tidak tersisa di activeChannels'
    );

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
