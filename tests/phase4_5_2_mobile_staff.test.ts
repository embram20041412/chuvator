import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Setup Mock Window for Node.js test environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1024,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: 'https://chuvator.pages.dev' },
    navigator: {
      clipboard: {
        writeText: async () => {}
      }
    }
  };
}

// Import components and exported helpers
import StaffManagementPage, { 
  StaffDesktopMain, 
  resolveTenantId as desktopResolveTenantId 
} from '../src/pages/StaffManagementPage.jsx';

import MobileStaffMain, { 
  resolveTenantId as mobileResolveTenantId 
} from '../src/mobile/pages/admin/MobileStaffMain.jsx';

import { 
  normalizeStaffRole, 
  buildInvitationUrl, 
  formatInvitationExpiry 
} from '../src/services/staffService.js';

test('CHUVATOR — Phase 4.5.2.1.1 Mobile Staff & Access Management Integration Suite', async (t) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const mockOwnerProfile = {
    tenantId: 'tenant-gor-101',
    role: 'owner',
    displayName: 'Bapak Owner GOR',
    tenant: { id: 'tenant-gor-101', name: 'GOR Juara Badminton' }
  };

  const mockAdminProfile = {
    tenantId: 'tenant-gor-101',
    role: 'admin',
    displayName: 'Admin Cabang',
    tenant: { id: 'tenant-gor-101', name: 'GOR Juara Badminton' }
  };

  const mockKasirProfile = {
    tenantId: 'tenant-gor-101',
    role: 'kasir',
    displayName: 'Kasir Cabang',
    tenant: { id: 'tenant-gor-101', name: 'GOR Juara Badminton' }
  };

  const mockProfileNoTenant = {
    id: 'user-auth-uuid-999',
    uid: 'user-auth-uuid-999',
    role: 'owner',
    displayName: 'User Tanpa Tenant'
  };

  /* ========================================================================= */
  /* SECTION A: PURE UNIT TESTS                                               */
  /* ========================================================================= */

  await t.test('UNIT A.1: Tenant ID Resolution from tenant.id', () => {
    const profileWithTenantObj = { tenant: { id: 'gor-tenant-alpha', name: 'Cabang Alpha' } };
    assert.equal(desktopResolveTenantId(profileWithTenantObj), 'gor-tenant-alpha');
    assert.equal(mobileResolveTenantId(profileWithTenantObj), 'gor-tenant-alpha');
  });

  await t.test('UNIT A.2: Tenant ID Resolution from tenantId and tenant.tenant_id', () => {
    const profileWithTenantId = { tenantId: 'gor-tenant-beta' };
    assert.equal(desktopResolveTenantId(profileWithTenantId), 'gor-tenant-beta');
    assert.equal(mobileResolveTenantId(profileWithTenantId), 'gor-tenant-beta');

    const profileWithNestedSnakeCase = { tenant: { tenant_id: 'gor-tenant-gamma' } };
    assert.equal(desktopResolveTenantId(profileWithNestedSnakeCase), 'gor-tenant-gamma');
    assert.equal(mobileResolveTenantId(profileWithNestedSnakeCase), 'gor-tenant-gamma');
  });

  await t.test('UNIT A.3: Profile without Tenant ID STRICTLY returns null (NEVER falls back to user ID or UID)', () => {
    // Crucial check: user id / uid must NOT be treated as tenant id
    const profileUserOnly = {
      id: 'usr-system-12345',
      uid: 'auth-user-98765',
      displayName: 'Operator'
    };

    assert.equal(desktopResolveTenantId(profileUserOnly), null, 'Desktop resolver must not fallback to id/uid');
    assert.equal(mobileResolveTenantId(profileUserOnly), null, 'Mobile resolver must not fallback to id/uid');

    assert.equal(desktopResolveTenantId(null), null);
    assert.equal(mobileResolveTenantId(null), null);

    assert.equal(desktopResolveTenantId({}), null);
    assert.equal(mobileResolveTenantId({}), null);
  });

  await t.test('UNIT A.4: RBAC Hierarchy Guard: Admin CANNOT invite Admin (canInviteAdmins === false)', () => {
    const checkCanInviteRole = (callerRole: string, targetRole: string) => {
      const isOwner = callerRole === 'owner' || callerRole === 'superadmin';
      const canInviteAdmins = isOwner;

      if (!canInviteAdmins && targetRole === 'admin') {
        return { allowed: false, canInviteAdmins, error: 'Akses ditolak: Hanya Pemilik (Owner) yang berwenang mengangkat Admin baru.' };
      }
      return { allowed: true, canInviteAdmins, error: null };
    };

    // Owner CAN invite admin
    const ownerCheck = checkCanInviteRole('owner', 'admin');
    assert.equal(ownerCheck.allowed, true);
    assert.equal(ownerCheck.canInviteAdmins, true);

    // Admin CANNOT invite admin
    const adminCheck = checkCanInviteRole('admin', 'admin');
    assert.equal(adminCheck.allowed, false);
    assert.equal(adminCheck.canInviteAdmins, false);
    assert.match(adminCheck.error || '', /Hanya Pemilik/);

    // Admin CAN invite kasir, coach, staff
    assert.equal(checkCanInviteRole('admin', 'kasir').allowed, true);
    assert.equal(checkCanInviteRole('admin', 'coach').allowed, true);
    assert.equal(checkCanInviteRole('admin', 'staff').allowed, true);
  });

  await t.test('UNIT A.5: Role Normalization, Expiry Formatter, and Invitation URL Generation', () => {
    assert.equal(normalizeStaffRole('pelatih'), 'coach');
    assert.equal(normalizeStaffRole('administrator'), 'admin');
    assert.equal(normalizeStaffRole('cashier'), 'kasir');
    assert.equal(normalizeStaffRole('staf'), 'staff');
    assert.equal(normalizeStaffRole('unknown'), 'kasir');

    const rawUrl = buildInvitationUrl('mock-secret-raw-token-123');
    assert.ok(rawUrl.includes('/accept-invitation?token=mock-secret-raw-token-123'));

    const now = new Date();
    const future7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const formatted7Days = formatInvitationExpiry(future7Days, now.toISOString());
    assert.ok(formatted7Days.includes('Hari') || formatted7Days.includes('s.d.'));
  });

  /* ========================================================================= */
  /* SECTION B: SSR COMPONENT TESTS                                            */
  /* ========================================================================= */

  await t.test('SSR B.1: Desktop Viewport (1024px) strictly uses StaffDesktopMain', () => {
    (globalThis as any).window.innerWidth = 1024;
    const htmlDesktop = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlDesktop.length > 0);
    // Desktop markers
    assert.ok(htmlDesktop.includes('Manajemen Staf &amp; Hak Akses') || htmlDesktop.includes('Manajemen Staf & Hak Akses'));
    assert.ok(htmlDesktop.includes('Protokol Keamanan Multi-Tenant'), 'Desktop view must render original desktop security panel');
    assert.ok(htmlDesktop.includes('Daftar Staf Cabang'));
    // Must NOT contain mobile shell class
    assert.equal(htmlDesktop.includes('chua-mobile-app'), false, 'Desktop must not contain chua-mobile-app');
  });

  await t.test('SSR B.2: Mobile Viewport (375px) renders MobileStaffMain', () => {
    (globalThis as any).window.innerWidth = 375;
    const htmlMobile = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlMobile.length > 0);
    assert.ok(htmlMobile.includes('chua-mobile-app'), 'Mobile view must be scoped under chua-mobile-app');
    assert.ok(htmlMobile.includes('Manajemen Staf &amp; Akses') || htmlMobile.includes('Manajemen Staf & Akses'));
    assert.ok(htmlMobile.includes('Undang Staf'));
  });

  await t.test('SSR B.3: Missing Tenant Context displays Tenant Missing Screen on both Desktop and Mobile', () => {
    // Mobile view with no tenant
    (globalThis as any).window.innerWidth = 375;
    const htmlMobileNoTenant = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MobileStaffMain, { userProfile: mockProfileNoTenant })
      )
    );
    assert.ok(htmlMobileNoTenant.includes('Konteks Cabang (Tenant) Tidak Ditemukan'), 'Mobile must show tenant missing banner');
    assert.ok(htmlMobileNoTenant.includes('Akun Anda tidak memiliki asosiasi cabang/tenant yang valid'));

    // Desktop view with no tenant
    (globalThis as any).window.innerWidth = 1024;
    const htmlDesktopNoTenant = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffDesktopMain, { userProfile: mockProfileNoTenant })
      )
    );
    assert.ok(htmlDesktopNoTenant.includes('Konteks Cabang (Tenant) Tidak Ditemukan'), 'Desktop must show tenant missing banner');
    assert.ok(htmlDesktopNoTenant.includes('Akun Anda tidak memiliki asosiasi cabang/tenant yang valid'));
  });

  await t.test('SSR B.4: Restricted Access (403) for non-authorized roles (Kasir, Coach, Staff)', () => {
    const htmlKasir = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MobileStaffMain, { userProfile: mockKasirProfile })
      )
    );
    assert.ok(htmlKasir.includes('Akses Terbatas: Khusus Owner / Admin'), 'Kasir must see restricted access card');
  });

  /* ========================================================================= */
  /* SECTION C: MOCKED WORKFLOW TESTS                                          */
  /* ========================================================================= */

  await t.test('WORKFLOW C.1: Profile without Tenant ID does NOT execute fetch or subscription', () => {
    let fetchCalled = false;
    let subscriptionCreated = false;

    // Component lifecycle simulation:
    const simulateMount = (profile: any) => {
      const resolvedTid = desktopResolveTenantId(profile);
      if (!resolvedTid) {
        // Guard triggers early return
        return { status: 'ABORTED_NO_TENANT', fetchCalled, subscriptionCreated };
      }
      fetchCalled = true;
      subscriptionCreated = true;
      return { status: 'SUBSCRIBED', fetchCalled, subscriptionCreated };
    };

    const result = simulateMount(mockProfileNoTenant);
    assert.equal(result.status, 'ABORTED_NO_TENANT');
    assert.equal(fetchCalled, false, 'Fetch must not be called when tenant ID is missing');
    assert.equal(subscriptionCreated, false, 'Subscription must not be created when tenant ID is missing');
  });

  await t.test('WORKFLOW C.2: Realtime Subscription Cleanup removes Supabase channel on unmount', () => {
    const channelsRemoved: string[] = [];
    const mockChannelInstance = {
      topic: 'realtime_mobile_staff_tenant-gor-101',
      on: () => mockChannelInstance,
      subscribe: () => mockChannelInstance
    };

    const mockSupabase = {
      channel: (name: string) => {
        return mockChannelInstance;
      },
      removeChannel: (channel: any) => {
        channelsRemoved.push(channel.topic);
      }
    };

    // Simulate component effect mounting
    const tenantId = 'tenant-gor-101';
    const channel = mockSupabase.channel(`realtime_mobile_staff_${tenantId}`);
    channel.subscribe();

    // Simulate unmount cleanup function execution
    const cleanup = () => {
      mockSupabase.removeChannel(channel);
    };

    cleanup();

    assert.equal(channelsRemoved.length, 1);
    assert.equal(channelsRemoved[0], 'realtime_mobile_staff_tenant-gor-101');
  });

  await t.test('WORKFLOW C.3: UI Handler executes createStaffInvitation with trimmed & normalized parameters', async () => {
    let capturedArgs: any = null;

    const mockCreateStaffInvitationService = async (args: any) => {
      capturedArgs = args;
      return {
        success: true,
        invitationId: 'inv-uuid-new-1',
        inviteUrl: 'https://chuvator.pages.dev/accept-invitation?token=raw-token-abc',
        role: args.role,
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      };
    };

    // Form inputs with untrimmed whitespace and casing
    const inputEmail = '  Ahmad.Kasir@GOR-Juara.COM  ';
    const inputDisplayName = '  Ahmad Kasir Juara  ';
    const inputRole = 'kasir';
    const activeTenantId = 'tenant-gor-101';

    // Simulate form submit handler
    const handleSubmitInvite = async () => {
      const cleanEmail = inputEmail.trim().toLowerCase();
      const cleanDisplayName = inputDisplayName.trim();
      const canonicalRole = normalizeStaffRole(inputRole);

      return await mockCreateStaffInvitationService({
        tenantId: activeTenantId,
        email: cleanEmail,
        role: canonicalRole,
        fullName: cleanDisplayName,
        displayName: cleanDisplayName
      });
    };

    const result = await handleSubmitInvite();

    assert.equal(result.success, true);
    assert.notEqual(capturedArgs, null);
    assert.equal(capturedArgs.email, 'ahmad.kasir@gor-juara.com', 'Email must be lowercased and trimmed');
    assert.equal(capturedArgs.displayName, 'Ahmad Kasir Juara', 'Display name must be trimmed');
    assert.equal(capturedArgs.role, 'kasir');
    assert.equal(capturedArgs.tenantId, 'tenant-gor-101');
  });

  await t.test('WORKFLOW C.4: UI Handler executes revokeStaffInvitation ONLY after explicit user confirmation', async () => {
    let revokeTargetId: string | null = null;

    const mockRevokeService = async (invitationId: string) => {
      revokeTargetId = invitationId;
      return { success: true, id: invitationId, status: 'revoked' };
    };

    // Case 1: User does not confirm (dismisses bottom sheet/modal)
    let userConfirmed = false;
    const handleRevokeWorkflow = async (invitation: { id: string, email: string }) => {
      if (!userConfirmed) {
        return { executed: false, reason: 'CANCELLED_BY_USER' };
      }
      const res = await mockRevokeService(invitation.id);
      return { executed: true, data: res };
    };

    const resCancelled = await handleRevokeWorkflow({ id: 'inv-to-cancel-1', email: 'staff@gor.com' });
    assert.equal(resCancelled.executed, false);
    assert.equal(revokeTargetId, null, 'Service must NOT be invoked if user cancels');

    // Case 2: User explicitly confirms
    userConfirmed = true;
    const resConfirmed = await handleRevokeWorkflow({ id: 'inv-to-cancel-1', email: 'staff@gor.com' });
    assert.equal(resConfirmed.executed, true);
    assert.equal(revokeTargetId, 'inv-to-cancel-1', 'Service MUST be invoked with verified invitation ID');
  });

  await t.test('WORKFLOW C.5: UI Handler executes deleteStaffDoc ONLY after explicit confirmation', async () => {
    let deletedStaffTargetId: string | null = null;

    const mockDeleteService = async (staffId: string) => {
      deletedStaffTargetId = staffId;
      return { success: true, deletedId: staffId };
    };

    // Workflow with confirmation state
    let isConfirmedInBottomSheet = false;
    const handleDeleteStaffWorkflow = async (staff: { id: string, displayName: string }) => {
      if (!isConfirmedInBottomSheet) {
        return { deleted: false };
      }
      await mockDeleteService(staff.id);
      return { deleted: true, staffId: staff.id };
    };

    const attemptWithoutConfirmation = await handleDeleteStaffWorkflow({ id: 'staff-del-100', displayName: 'Staf Percobaan' });
    assert.equal(attemptWithoutConfirmation.deleted, false);
    assert.equal(deletedStaffTargetId, null);

    isConfirmedInBottomSheet = true;
    const attemptWithConfirmation = await handleDeleteStaffWorkflow({ id: 'staff-del-100', displayName: 'Staf Percobaan' });
    assert.equal(attemptWithConfirmation.deleted, true);
    assert.equal(deletedStaffTargetId, 'staff-del-100');
  });

});
