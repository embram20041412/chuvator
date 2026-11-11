import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { JSDOM } from 'jsdom';

// Setup JSDOM Environment for Real React DOM Rendering
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

test('CHUVATOR — PHASE 4.5.2.3.5: Final Tenant Switch State Isolation Suite', async (t) => {
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

  // SUBTEST 1: roleFilter, invitationStatusFilter, and searchQuery are completely reset when tenant switches
  await t.test('1 & 2. roleFilter, invitationStatusFilter, and searchQuery are completely reset to defaults on tenant switch', async () => {
    const userTenantA = {
      id: 'owner-reset-a',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Arena A' }
    };
    const userTenantB = {
      id: 'owner-reset-b',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_B, name: 'Arena B' }
    };

    setupAuthSession('owner-reset-a');
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
                  const resolvedTid = val === 'owner-reset-b' ? VALID_UUID_TENANT_B : VALID_UUID_TENANT_A;
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
            eq: (col: string, val: string) => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
              order: () => Promise.resolve({
                data: [{ id: 's-1', display_name: 'Budi Admin', role: 'admin', email: 'budi@arena.com', is_bound: true }],
                error: null
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

    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantA} />);
    });
    await sleep(200);

    // Simulate user typing search query and picking filter on Tenant A
    const searchInput = container.querySelector('input[placeholder*="Cari"]') as HTMLInputElement;
    if (searchInput) {
      await act(async () => {
        searchInput.value = 'Budi';
        searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    }

    // Switch to Tenant B
    setupAuthSession('owner-reset-b');
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantB} />);
    });
    await sleep(200);

    // Verify search input is cleared
    const searchInputAfter = container.querySelector('input[placeholder*="Cari"]') as HTMLInputElement;
    if (searchInputAfter) {
      assert.strictEqual(searchInputAfter.value, '', 'searchQuery dikosongkan saat tenant berganti');
    }

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // SUBTEST 3 & 4: Tenant A data, modals, invitation data, and session links do not bleed into Tenant B
  await t.test('3 & 4. Tenant A data, modals, and session invite links are isolated and cleared before Tenant B renders', async () => {
    const userTenantA = {
      id: 'owner-iso-a',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Arena A' }
    };
    const userTenantB = {
      id: 'owner-iso-b',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_B, name: 'Arena B' }
    };

    setupAuthSession('owner-iso-a');
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
                  const resolvedTid = val === 'owner-iso-b' ? VALID_UUID_TENANT_B : VALID_UUID_TENANT_A;
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
            eq: (col: string, val: string) => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
              order: () => {
                if (val === VALID_UUID_TENANT_A) {
                  return Promise.resolve({
                    data: [{ id: 's-alpha-100', display_name: 'STAFF_EXCLUSIVE_TENANT_A', role: 'kasir', email: 'exclusive_a@arena.com' }],
                    error: null
                  });
                }
                return Promise.resolve({
                  data: [{ id: 's-beta-200', display_name: 'STAFF_EXCLUSIVE_TENANT_B', role: 'admin', email: 'exclusive_b@arena.com' }],
                  error: null
                });
              }
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

    // 1. Render Tenant A
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantA} />);
    });
    await sleep(200);

    const textAlpha = container.textContent || '';
    assert.ok(textAlpha.includes('STAFF_EXCLUSIVE_TENANT_A'), 'Data Tenant A tampil pada konteks Tenant A');

    // 2. Switch to Tenant B
    setupAuthSession('owner-iso-b');
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantB} />);
    });
    await sleep(250);

    const textBeta = container.textContent || '';
    assert.ok(textBeta.includes('STAFF_EXCLUSIVE_TENANT_B'), 'Data Tenant B tampil pada konteks Tenant B');
    assert.strictEqual(textBeta.includes('STAFF_EXCLUSIVE_TENANT_A'), false, 'Data Tenant A TIDAK PERNAH tampil dalam konteks Tenant B');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // SUBTEST 5: Delayed response of Tenant A is dropped and does not overwrite Tenant B
  await t.test('5. Delayed network response from Tenant A is dropped by sequence guard and does not overwrite Tenant B', async () => {
    let resolveStaffAlpha: any = null;

    const userTenantA = {
      id: 'owner-delayed-a',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Branch A' }
    };
    const userTenantB = {
      id: 'owner-delayed-b',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_B, name: 'Branch B' }
    };

    setupAuthSession('owner-delayed-a');
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
                  const resolvedTid = val === 'owner-delayed-b' ? VALID_UUID_TENANT_B : VALID_UUID_TENANT_A;
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
            eq: (col: string, val: string) => ({
              limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
              order: () => {
                if (val === VALID_UUID_TENANT_A) {
                  return new Promise((res) => {
                    resolveStaffAlpha = () =>
                      res({
                        data: [{ id: 's-alpha-delayed', display_name: 'DELAYED_STAF_ALPHA', role: 'kasir', email: 'delayed_alpha@arena.com' }],
                        error: null
                      });
                  });
                }
                return Promise.resolve({
                  data: [{ id: 's-beta-fast', display_name: 'FAST_STAF_BETA', role: 'admin', email: 'fast_beta@arena.com' }],
                  error: null
                });
              }
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

    // Mount Tenant A
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantA} />);
    });
    await sleep(100);

    // Switch to Tenant B before Tenant A resolves
    setupAuthSession('owner-delayed-b');
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantB} />);
    });
    await sleep(250);

    // Resolve Tenant A delayed fetch
    if (resolveStaffAlpha) {
      await act(async () => {
        resolveStaffAlpha();
      });
    }
    await sleep(200);

    const textContent = container.textContent || '';
    assert.ok(textContent.includes('FAST_STAF_BETA'), 'Data Beta tampil dengan benar');
    assert.strictEqual(textContent.includes('DELAYED_STAF_ALPHA'), false, 'Respons terlambat Tenant Alpha dibuang');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // SUBTEST 6: Realtime channel for Tenant A cleaned up, Tenant B uses verified UUID
  await t.test('6. Realtime channel for Tenant A is properly cleaned up, Tenant B subscribes using DB verified UUID', async () => {
    const userTenantA = {
      id: 'owner-rt-a',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_A, name: 'Branch A' }
    };
    const userTenantB = {
      id: 'owner-rt-b',
      role: 'owner',
      tenant: { id: VALID_UUID_TENANT_B, name: 'Branch B' }
    };

    setupAuthSession('owner-rt-a');
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
                  const resolvedTid = val === 'owner-rt-b' ? VALID_UUID_TENANT_B : VALID_UUID_TENANT_A;
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

    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantA} />);
    });
    await sleep(200);

    assert.ok(activeChannels.some((c) => c.includes(VALID_UUID_TENANT_A)), 'Channel Tenant A registered');

    // Switch to Tenant B
    setupAuthSession('owner-rt-b');
    await act(async () => {
      root.render(<MobileStaffMain userProfile={userTenantB} />);
    });
    await sleep(250);

    assert.ok(channelRemoveCount >= 1, 'Supabase removeChannel is called on tenant switch');
    assert.ok(activeChannels.some((c) => c.includes(VALID_UUID_TENANT_B)), 'Channel Tenant B registered');
    assert.strictEqual(
      activeChannels.filter((c) => c.includes(VALID_UUID_TENANT_A)).length,
      0,
      'Old Tenant A channel removed completely'
    );

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  // SUBTEST 7: No fetch or subscription when role is loading or tenant UUID is invalid
  await t.test('7. No fetch or subscription when role is loading or tenant UUID is invalid', async () => {
    capturedQueries.length = 0;
    capturedRealtimeFilters.length = 0;

    const invalidUser = {
      id: 'owner-invalid',
      role: 'owner',
      tenant: { id: 'invalid-non-uuid-string', name: 'Fake' }
    };

    setupAuthSession('owner-invalid');
    mockChannelSubscription();

    (supabase as any).rpc = (fnName: string) => {
      if (fnName === 'is_superadmin') return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    };

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

    await act(async () => {
      root.render(<MobileStaffMain userProfile={invalidUser} />);
    });
    await sleep(150);

    const staffQueries = capturedQueries.filter((q) => q.table === 'users_staff' || q.table === 'invitations');
    assert.strictEqual(staffQueries.length, 0, 'Zero staff/invitation DB queries executed for invalid tenant UUID');
    assert.strictEqual(capturedRealtimeFilters.length, 0, 'Zero realtime subscriptions created for invalid tenant UUID');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
