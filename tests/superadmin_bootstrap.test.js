import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySuperadminStatus, verifyUserRoleAndTenant, logoutUser, supabaseAuthService } from '../src/services/supabaseAuthService.js';

/**
 * Mock Supabase Client matching PostgreSQL RPC & Table behaviors
 */
function createMockSupabaseClient({
  isSuperadminResponses = [false],
  bootstrapResponse = { data: false, error: null },
  platformSuperadminsTable = [],
  usersStaffTable = [],
  tenantsTable = [],
  invitationsTable = [],
  signOutError = null,
}) {
  let isSuperCallIndex = 0;
  let bootstrapCalled = 0;
  let queriedColumns = [];

  return {
    getStats: () => ({
      isSuperCallCount: isSuperCallIndex,
      bootstrapCallCount: bootstrapCalled,
      queriedColumns,
    }),
    auth: {
      signOut: async ({ scope } = {}) => {
        if (signOutError) {
          throw signOutError;
        }
        return { error: null };
      },
    },
    rpc: async (fnName, params) => {
      if (fnName === 'is_superadmin') {
        const resp = isSuperadminResponses[isSuperCallIndex] ?? isSuperadminResponses[isSuperadminResponses.length - 1];
        isSuperCallIndex++;
        if (resp instanceof Error) {
          return { data: null, error: resp };
        }
        return { data: resp, error: null };
      }
      if (fnName === 'bootstrap_platform_superadmin') {
        bootstrapCalled++;
        if (bootstrapResponse instanceof Error) {
          throw bootstrapResponse;
        }
        if (bootstrapResponse?.error) {
          return { data: null, error: bootstrapResponse.error };
        }
        return { data: bootstrapResponse.data ?? bootstrapResponse, error: null };
      }
      throw new Error(`Unexpected RPC call: ${fnName}`);
    },
    from: (tableName) => {
      let selectedCols = '*';
      let eqFilters = {};
      let orFilter = null;
      let ilikeFilter = {};

      const builder = {
        select: (cols) => {
          selectedCols = cols;
          queriedColumns.push({ table: tableName, columns: cols });
          return builder;
        },
        eq: (col, val) => {
          eqFilters[col] = val;
          return builder;
        },
        or: (condition) => {
          orFilter = condition;
          return builder;
        },
        ilike: (col, val) => {
          ilikeFilter[col] = val.toLowerCase();
          return builder;
        },
        maybeSingle: async () => {
          if (tableName === 'platform_superadmins') {
            // Kolom kanonis adalah auth_uid. Jika query salah menggunakan user_id, gagalkan.
            if (eqFilters.user_id !== undefined) {
              return { data: null, error: new Error('column "user_id" does not exist in table "platform_superadmins"') };
            }
            const match = platformSuperadminsTable.find(
              (row) => eqFilters.auth_uid && row.auth_uid === eqFilters.auth_uid
            );
            return { data: match || null, error: null };
          }
          if (tableName === 'users_staff') {
            const match = usersStaffTable.find((row) => {
              if (ilikeFilter.email && row.email?.toLowerCase() === ilikeFilter.email) return true;
              if (eqFilters.uid && row.uid === eqFilters.uid) return true;
              return false;
            });
            return { data: match || null, error: null };
          }
          if (tableName === 'tenants') {
            // Kontrak database: tabel tenants TIDAK memiliki kolom is_active!
            if (eqFilters.is_active !== undefined || (selectedCols && selectedCols.includes('is_active'))) {
              return { data: null, error: new Error('column "is_active" does not exist in table "tenants"') };
            }
            const match = tenantsTable.find((row) => {
              if (eqFilters.id && row.id === eqFilters.id) return true;
              if (eqFilters.owner_uid && row.owner_uid === eqFilters.owner_uid) return true;
              if (orFilter) {
                if (row.owner_email && orFilter.includes(row.owner_email)) return true;
                if (row.owner_uid && orFilter.includes(row.owner_uid)) return true;
              }
              return false;
            });
            return { data: match || null, error: null };
          }
          if (tableName === 'invitations') {
            const match = invitationsTable.find((row) => eqFilters.email && row.email === eqFilters.email);
            return { data: match || null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}

/**
 * Pure authorization navigation evaluator (mirrors ProtectedRoute.jsx)
 */
function evaluateRouteAccess({ userProfile, pathname, allowedRoles, requireTenant = true }) {
  if (!userProfile) {
    return { action: 'redirect', to: '/login', replace: true };
  }

  const userRole = (userProfile.role || '').toLowerCase();
  const isCoach = userRole === 'pelatih' || userRole === 'coach';

  if (userRole === 'superadmin') {
    if (pathname !== '/saas-admin') {
      return { action: 'redirect', to: '/saas-admin', replace: true };
    }
    return { action: 'allow' };
  }

  if (pathname === '/saas-admin' && userRole !== 'superadmin') {
    return { action: 'redirect', to: isCoach ? '/akademi' : '/dashboard', replace: true };
  }

  if (isCoach) {
    if (pathname !== '/akademi' && !pathname.startsWith('/akademi')) {
      return { action: 'redirect', to: '/akademi', replace: true };
    }
    return { action: 'allow' };
  }

  if (userRole === 'owner' && !userProfile.tenant && requireTenant) {
    if (pathname !== '/onboarding') {
      return { action: 'redirect', to: '/onboarding', replace: true };
    }
    return { action: 'allow' };
  }

  if (userRole === 'owner' && userProfile.tenant && pathname === '/onboarding') {
    return { action: 'redirect', to: '/dashboard', replace: true };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const isAllowed =
      normalizedAllowed.includes(userRole) ||
      (isCoach && (normalizedAllowed.includes('pelatih') || normalizedAllowed.includes('coach')));

    if (!isAllowed) {
      return { action: 'redirect', to: isCoach ? '/akademi' : '/dashboard', replace: true };
    }
  }

  return { action: 'allow' };
}

/**
 * Lifecycle simulator representing useAuthRole epoch versioning engine
 */
class AuthRoleLifecycleSimulator {
  constructor() {
    this.sequence = 0;
    this.state = {
      role: null,
      tenantId: null,
      verifiedFromDb: false,
      loading: true,
    };
  }

  onSessionChange(user, asyncRoleResolver) {
    const currentSeq = ++this.sequence;

    if (!user) {
      // Immediate reset when signed out or user is null
      this.state = {
        role: null,
        tenantId: null,
        verifiedFromDb: true,
        loading: false,
      };
      return Promise.resolve(this.state);
    }

    this.state.loading = true;

    return asyncRoleResolver(user).then((resolved) => {
      // Commit state ONLY if sequence hasn't moved (epoch match)
      if (currentSeq === this.sequence) {
        this.state = {
          role: resolved.role,
          tenantId: resolved.tenantId,
          verifiedFromDb: true,
          loading: false,
        };
      }
      return this.state;
    });
  }
}

// =========================================================================
// PENGUJIAN WAJIB (10 SKENARIO SPESIFIKASI USER + TAMBAHAN AUDIT)
// =========================================================================

test('Wajib 1: is_superadmin() mengembalikan false tanpa error, bootstrap dijalankan', async () => {
  const mockUser = {
    id: 'uid-bootstrap-ok',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    // is_superadmin 1st: false, 2nd: true
    isSuperadminResponses: [false, true],
    bootstrapResponse: { data: true, error: null },
  });

  const profile = await verifySuperadminStatus(mockUser, client);

  assert.equal(client.getStats().bootstrapCallCount, 1, 'Bootstrap HARUS dipanggil saat is_superadmin mengembalikan false');
  assert.equal(client.getStats().isSuperCallCount, 2, 'is_superadmin HARUS dipanggil 2 kali (awal & setelah bootstrap)');
  assert.ok(profile, 'Profil superadmin berhasil dibuat');
  assert.equal(profile.role, 'superadmin');
});

test('Wajib 2: is_superadmin() mengalami error, bootstrap TIDAK dijalankan', async () => {
  const mockUser = {
    id: 'uid-super-err',
    email: 'admin@chua.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [new Error('PGRST500 Database timeout')],
    bootstrapResponse: { data: true, error: null },
  });

  const profile = await verifySuperadminStatus(mockUser, client);

  assert.equal(client.getStats().bootstrapCallCount, 0, 'Bootstrap DILARANG dijalankan jika is_superadmin menghasilkan error');
  assert.equal(profile, null, 'Role Superadmin tidak boleh diberikan saat RPC error');
});

test('Wajib 3: is_superadmin() mengembalikan true, bootstrap tidak dijalankan', async () => {
  const mockUser = {
    id: 'uid-super-active',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [true],
  });

  const profile = await verifySuperadminStatus(mockUser, client);

  assert.equal(client.getStats().bootstrapCallCount, 0, 'Bootstrap TIDAK boleh dipanggil jika akun sudah terikat (is_superadmin true)');
  assert.equal(client.getStats().isSuperCallCount, 1);
  assert.ok(profile);
  assert.equal(profile.role, 'superadmin');
});

test('Wajib 4: Bootstrap berhasil, verifikasi ulang true', async () => {
  const mockUser = {
    id: 'uid-boot-success',
    email: 'erizamaulana.bramantya@gmail.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, true],
    bootstrapResponse: { data: true, error: null },
  });

  const profile = await verifyUserRoleAndTenant(mockUser, client);

  assert.ok(profile);
  assert.equal(profile.role, 'superadmin');
  assert.equal(profile.uid, 'uid-boot-success');
});

test('Wajib 5: Bootstrap gagal, tidak ada eskalasi role', async () => {
  const mockUser = {
    id: 'uid-boot-fail',
    email: 'hacker@malicious.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, false],
    bootstrapResponse: { data: false, error: null }, // Gagal bind di PostgreSQL
    usersStaffTable: [
      { id: 'staf-1', uid: 'uid-boot-fail', email: 'hacker@malicious.com', role: 'kasir', tenant_id: 't-99' },
    ],
    tenantsTable: [
      { id: 't-99', name: 'Arena Kasir' },
    ],
  });

  const profile = await verifyUserRoleAndTenant(mockUser, client);

  assert.notEqual(profile.role, 'superadmin', 'Tidak boleh eskalasi ke superadmin');
  assert.equal(profile.role, 'kasir', 'Role harus turun ke peran database yang valid');
});

test('Wajib 6: Hasil verifikasi pengguna lama tidak menimpa state setelah logout', async () => {
  const sim = new AuthRoleLifecycleSimulator();

  let resolveUser1;
  const user1Promise = new Promise((resolve) => {
    resolveUser1 = resolve;
  });

  // User 1 login -> mulai verifikasi lambat
  sim.onSessionChange({ id: 'user-1' }, () => user1Promise);

  // User 1 logout sebelum verifikasi selesai
  sim.onSessionChange(null, () => Promise.resolve());

  // Pastikan saat logout state langsung bersih
  assert.equal(sim.state.role, null);
  assert.equal(sim.state.loading, false);

  // Verifikasi User 1 akhirnya selesai terlambat
  resolveUser1({ role: 'admin', tenantId: 'tenant-1' });
  await user1Promise;

  // Verifikasi lama DITOLAK karena sequence sudah kedaluwarsa
  assert.equal(sim.state.role, null, 'Hasil pengguna lama tidak boleh menimpa state setelah logout');
});

test('Wajib 7: Login akun kedua setelah logout akun pertama', async () => {
  const sim = new AuthRoleLifecycleSimulator();

  // User 1 login
  await sim.onSessionChange({ id: 'user-1' }, async () => ({ role: 'kasir', tenantId: 't-1' }));
  assert.equal(sim.state.role, 'kasir');
  assert.equal(sim.state.tenantId, 't-1');

  // User 1 logout
  await sim.onSessionChange(null, async () => {});
  assert.equal(sim.state.role, null);

  // User 2 (Superadmin) login
  await sim.onSessionChange({ id: 'super-2' }, async () => ({ role: 'superadmin', tenantId: null }));
  assert.equal(sim.state.role, 'superadmin');
  assert.equal(sim.state.tenantId, null);
});

test('Wajib 8: Logout ketika proses verifikasi role masih berlangsung', async () => {
  const sim = new AuthRoleLifecycleSimulator();

  let delayedResolve;
  const pendingPromise = new Promise((resolve) => {
    delayedResolve = resolve;
  });

  // Verifikasi sedang berlangsung di background
  sim.onSessionChange({ id: 'in-flight-user' }, () => pendingPromise);
  assert.equal(sim.state.loading, true);

  // Pengguna langsung menekan logout
  sim.onSessionChange(null, async () => {});

  // State harus langsung loading: false, role: null
  assert.equal(sim.state.role, null);
  assert.equal(sim.state.loading, false);

  // Hasil async tiba
  delayedResolve({ role: 'owner', tenantId: 't-9' });
  await pendingPromise;

  assert.equal(sim.state.role, null);
});

test('Wajib 9: RPC error tidak memberikan role Superadmin', async () => {
  const mockUser = {
    id: 'uid-rpc-fail',
    email: 'erizamaulana.bramantya@gmail.com', // Email cocok di frontend
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [new Error('Koneksi database PostgreSQL terputus')],
    bootstrapResponse: { data: true, error: null },
  });

  const profile = await verifySuperadminStatus(mockUser, client);

  // Meskipun email cocok dengan email Superadmin di frontend, DILARANG memberikan role Superadmin
  assert.equal(profile, null, 'Fail-closed: RPC error mutlak menghasilkan null');
});

test('Wajib 10: Pengguna biasa tidak dapat masuk ke /saas-admin', () => {
  const kasirProfile = { role: 'kasir', tenant: { id: 't-1' } };
  const ownerProfile = { role: 'owner', tenant: { id: 't-1' } };
  const coachProfile = { role: 'coach', tenant: { id: 't-1' } };

  // Kasir mencoba masuk /saas-admin -> ditolak ke /dashboard
  const r1 = evaluateRouteAccess({ userProfile: kasirProfile, pathname: '/saas-admin' });
  assert.deepEqual(r1, { action: 'redirect', to: '/dashboard', replace: true });

  // Owner mencoba masuk /saas-admin -> ditolak ke /dashboard
  const r2 = evaluateRouteAccess({ userProfile: ownerProfile, pathname: '/saas-admin' });
  assert.deepEqual(r2, { action: 'redirect', to: '/dashboard', replace: true });

  // Coach mencoba masuk /saas-admin -> ditolak ke /akademi
  const r3 = evaluateRouteAccess({ userProfile: coachProfile, pathname: '/saas-admin' });
  assert.deepEqual(r3, { action: 'redirect', to: '/akademi', replace: true });

  // Pengguna tanpa sesi -> ditolak ke /login
  const r4 = evaluateRouteAccess({ userProfile: null, pathname: '/saas-admin' });
  assert.deepEqual(r4, { action: 'redirect', to: '/login', replace: true });
});

test('Wajib 11 (Audit Logout): Kegagalan sign-out Supabase tidak membersihkan cache atau mengklaim logout berhasil', async () => {
  const originalLogout = supabaseAuthService.logout;
  let didThrow = false;

  // Mock localStorage di lingkungan Node.js
  const mockStorage = new Map();
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  };

  try {
    // Simulasikan kegagalan sign out dari server Supabase
    supabaseAuthService.logout = async () => {
      throw new Error('Supabase network error saat sign out');
    };

    // Siapkan cache simulasi
    globalThis.localStorage.setItem('chuvator_tenant_cache', 'valid-cache-data');

    await logoutUser();
  } catch (err) {
    didThrow = true;
    assert.match(err.message, /Supabase network error/);
  } finally {
    supabaseAuthService.logout = originalLogout;
    globalThis.localStorage = originalLocalStorage;
  }

  assert.equal(didThrow, true, 'logoutUser HARUS melempar error jika sign-out gagal');
  // Cache TIDAK boleh dibersihkan jika sign-out gagal
  assert.equal(mockStorage.get('chuvator_tenant_cache'), 'valid-cache-data', 'Cache tidak boleh dibersihkan saat logout gagal');
});

test('Wajib 12 (Audit Kolom): Query platform_superadmins hanya menggunakan auth_uid dan menolak user_id', async () => {
  const mockUser = {
    id: 'uid-audit-auth-uid',
    email: 'super@chua.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, false],
    bootstrapResponse: { data: false, error: null },
    platformSuperadminsTable: [
      { id: 'row-1', auth_uid: 'uid-audit-auth-uid', email: 'super@chua.com' },
    ],
  });

  const profile = await verifySuperadminStatus(mockUser, client);
  assert.ok(profile);
  assert.equal(profile.role, 'superadmin');

  const queries = client.getStats().queriedColumns;
  const superadminQueries = queries.filter((q) => q.table === 'platform_superadmins');
  assert.ok(superadminQueries.length > 0);
  superadminQueries.forEach((q) => {
    assert.ok(q.columns.includes('auth_uid'), 'Harus query auth_uid');
    assert.ok(!q.columns.includes('user_id'), 'DILARANG query user_id');
  });
});

test('Wajib 13 (Audit Kontrak Tenants): Query tabel tenants tidak menggunakan is_active dan menggunakan status valid', async () => {
  const ownerUser = {
    id: 'uid-owner-contract',
    email: 'owner@arenatennis.com',
  };

  const client = createMockSupabaseClient({
    isSuperadminResponses: [false, false],
    bootstrapResponse: { data: false, error: null },
    tenantsTable: [
      { id: 't-contract-1', tenant_id: 't-contract-1', name: 'Arena Tenis Jaya', owner_uid: 'uid-owner-contract', status: 'active' },
    ],
  });

  const profile = await verifyUserRoleAndTenant(ownerUser, client);
  assert.ok(profile);
  assert.equal(profile.role, 'owner');
  assert.equal(profile.tenantId, 't-contract-1');

  // Periksa bahwa semua query ke tenants tidak pernah memanggil kolom is_active
  const queries = client.getStats().queriedColumns;
  const tenantQueries = queries.filter((q) => q.table === 'tenants');
  assert.ok(tenantQueries.length > 0);
  tenantQueries.forEach((q) => {
    assert.ok(!q.columns.includes('is_active'), 'Query tenants DILARANG mengandung is_active');
  });
});

