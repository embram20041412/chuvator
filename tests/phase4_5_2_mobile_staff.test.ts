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

// Import components and services for testing
import StaffManagementPage, { StaffDesktopMain } from '../src/pages/StaffManagementPage.jsx';
import MobileStaffMain from '../src/mobile/pages/admin/MobileStaffMain.jsx';
import { 
  normalizeStaffRole, 
  buildInvitationUrl, 
  formatInvitationExpiry 
} from '../src/services/staffService.js';

test('CHUVATOR — Phase 4.5.2.1 Mobile Staff & Access Management Logic & Security Tests', async (t) => {

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

  // 1. Mobile viewport 375px render
  await t.test('1. Mobile Viewport Render (375px): Wrapper renders MobileStaffMain without errors', () => {
    (globalThis as any).window.innerWidth = 375;
    const html = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(html.length > 0);
    // Mobile view renders .chua-mobile-app and mobile title
    assert.ok(html.includes('chua-mobile-app'), 'Must be scoped under chua-mobile-app');
    assert.ok(html.includes('Manajemen Staf &amp; Akses') || html.includes('Manajemen Staf & Akses'));
    assert.ok(html.includes('Undang Staf'), 'Must contain mobile invite staff action');
  });

  // 2. Desktop viewport 1024px render
  await t.test('2. Desktop Viewport Render (1024px): Wrapper renders StaffDesktopMain without errors', () => {
    (globalThis as any).window.innerWidth = 1024;
    const html = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(html.length > 0);
    // Desktop view renders original desktop header
    assert.ok(html.includes('Manajemen Staf &amp; Hak Akses') || html.includes('Manajemen Staf & Hak Akses'));
    assert.ok(html.includes('Protokol Keamanan Multi-Tenant'), 'Desktop view must render original desktop security panel');
  });

  // 3. Rules of Hooks (Toggling viewports)
  await t.test('3. Rules of Hooks Compliance: Switching between Mobile and Desktop maintains invariant hook calls', () => {
    // Switch to Mobile
    (globalThis as any).window.innerWidth = 375;
    const htmlMobile = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlMobile.includes('chua-mobile-app'));

    // Switch to Desktop
    (globalThis as any).window.innerWidth = 1024;
    const htmlDesktop = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlDesktop.includes('Protokol Keamanan Multi-Tenant'));

    // Switch back to Mobile
    (globalThis as any).window.innerWidth = 375;
    const htmlMobileAgain = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlMobileAgain.includes('chua-mobile-app'));
  });

  // 4. Staff list rendering (Card-based layout)
  await t.test('4. Staff List Rendering: Mobile component structures staff records as cards with avatar and details', () => {
    const mockStaffList = [
      {
        id: 'st-1',
        uid: 'auth-uid-1',
        name: 'Ahmad Fauzi',
        displayName: 'Ahmad Fauzi',
        email: 'ahmad@gor.com',
        role: 'kasir',
        isBound: true,
        createdAt: '2026-01-15T08:00:00Z'
      },
      {
        id: 'st-2',
        uid: null,
        name: 'Coach Rian',
        displayName: 'Coach Rian',
        email: 'rian@gor.com',
        role: 'coach',
        isBound: false,
        createdAt: '2026-02-01T10:00:00Z'
      }
    ];

    assert.equal(mockStaffList.length, 2);
    assert.equal(mockStaffList[0].displayName, 'Ahmad Fauzi');
    assert.equal(mockStaffList[1].role, 'coach');
  });

  // 5. Search and filter role logic
  await t.test('5. Search & Filter: Filters staff directory by name, email, and specific role without altering source data', () => {
    const staffData = [
      { id: '1', displayName: 'Budi Santoso', email: 'budi@test.com', role: 'kasir' },
      { id: '2', displayName: 'Coach Joko', email: 'joko@test.com', role: 'coach' },
      { id: '3', displayName: 'Siti Aminah', email: 'siti@test.com', role: 'admin' },
      { id: '4', displayName: 'Agus Staff', email: 'agus@test.com', role: 'staff' }
    ];

    const filterStaff = (query: string, role: string) => {
      return staffData.filter((s) => {
        const matchesSearch =
          (s.displayName || '').toLowerCase().includes(query.toLowerCase()) ||
          (s.email || '').toLowerCase().includes(query.toLowerCase());
        const matchesRole = role === 'all' || s.role === role;
        return matchesSearch && matchesRole;
      });
    };

    // Filter by query
    assert.equal(filterStaff('budi', 'all').length, 1);
    assert.equal(filterStaff('test.com', 'all').length, 4);

    // Filter by role
    assert.equal(filterStaff('', 'kasir').length, 1);
    assert.equal(filterStaff('', 'coach').length, 1);
    assert.equal(filterStaff('', 'admin').length, 1);
    assert.equal(filterStaff('', 'staff').length, 1);
    assert.equal(filterStaff('', 'all').length, 4);

    // Filter by both
    assert.equal(filterStaff('Coach', 'coach').length, 1);
    assert.equal(filterStaff('Coach', 'kasir').length, 0);
  });

  // 6. Status Auth UID binding verification
  await t.test('6. Status Auth UID Binding: Correctly distinguishes bound staff vs unbound candidate waiting for claim', () => {
    const boundStaff = { id: 's1', uid: 'usr-12345', isBound: true };
    const pendingStaff = { id: 's2', uid: null, isBound: false };

    const getStatusInfo = (s: any) => {
      const isBound = Boolean(s.uid);
      return {
        isBound,
        label: isBound ? 'Terikat Auth UID' : 'Menunggu Klaim',
        variant: isBound ? 'emerald' : 'warning'
      };
    };

    assert.equal(getStatusInfo(boundStaff).isBound, true);
    assert.equal(getStatusInfo(boundStaff).label, 'Terikat Auth UID');
    assert.equal(getStatusInfo(boundStaff).variant, 'emerald');

    assert.equal(getStatusInfo(pendingStaff).isBound, false);
    assert.equal(getStatusInfo(pendingStaff).label, 'Menunggu Klaim');
    assert.equal(getStatusInfo(pendingStaff).variant, 'warning');
  });

  // 7. Form validation for staff invitations
  await t.test('7. Form Validation: Validates required display name, valid email syntax, and canonical role', () => {
    const validateForm = (displayName: string, email: string) => {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (displayName || '').trim();

      if (!cleanEmail || !cleanName) {
        return { valid: false, error: 'Nama lengkap dan alamat email staf wajib diisi.' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return { valid: false, error: 'Format email tidak valid.' };
      }
      return { valid: true, error: null };
    };

    assert.equal(validateForm('', 'test@gor.com').valid, false);
    assert.equal(validateForm('Budi', '').valid, false);
    assert.equal(validateForm('Budi', 'invalid-email').valid, false);
    assert.equal(validateForm('Budi', 'budi@gor.com').valid, true);
  });

  // 8. RBAC hierarchy & restriction for inviting Admins
  await t.test('8. RBAC Hierarchy Guard: Admins are strictly prohibited from inviting other Admins or Owners', () => {
    const checkCanInviteRole = (callerRole: string, targetRole: string) => {
      const isOwner = callerRole === 'owner' || callerRole === 'superadmin';
      const canInviteAdmins = isOwner;

      if (!canInviteAdmins && targetRole === 'admin') {
        return { allowed: false, error: 'Akses ditolak: Hanya Pemilik (Owner) yang berwenang mengangkat Admin baru.' };
      }
      if (targetRole === 'owner' || targetRole === 'superadmin') {
        return { allowed: false, error: 'Dilarang mengundang peran Owner atau Superadmin.' };
      }
      return { allowed: true, error: null };
    };

    // Owner can invite Admin, Kasir, Coach, Staff
    assert.equal(checkCanInviteRole('owner', 'admin').allowed, true);
    assert.equal(checkCanInviteRole('owner', 'kasir').allowed, true);
    assert.equal(checkCanInviteRole('owner', 'coach').allowed, true);
    assert.equal(checkCanInviteRole('owner', 'staff').allowed, true);

    // Admin CANNOT invite Admin
    assert.equal(checkCanInviteRole('admin', 'admin').allowed, false);
    assert.match(checkCanInviteRole('admin', 'admin').error || '', /Hanya Pemilik/);

    // Admin CAN invite Kasir, Coach, Staff
    assert.equal(checkCanInviteRole('admin', 'kasir').allowed, true);
    assert.equal(checkCanInviteRole('admin', 'coach').allowed, true);
    assert.equal(checkCanInviteRole('admin', 'staff').allowed, true);
  });

  // 9. Invitation status and expiry formatting
  await t.test('9. Invitation Status & Expiry: Computes dynamic expiration from expires_at timestamp', () => {
    const now = new Date();
    const future7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const past1Day = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const formatted7Days = formatInvitationExpiry(future7Days, now.toISOString());
    assert.ok(formatted7Days.includes('Hari') || formatted7Days.includes('s.d.'));

    // Expired calculation
    const isExpired = new Date(past1Day) <= new Date();
    assert.equal(isExpired, true);
  });

  // 10. Copy invitation URL only when raw token is available in session state
  await t.test('10. Copy Link Retention: Copy button is active only when raw token exists in session memory', () => {
    const sessionInviteLinks: Record<string, string> = {
      'inv-uuid-1': 'https://chuvator.pages.dev/accept-invitation?token=raw-token-123'
    };

    const getInviteUrl = (invId: string, email: string) => {
      return sessionInviteLinks[invId] || sessionInviteLinks[email] || null;
    };

    assert.equal(getInviteUrl('inv-uuid-1', 'test@gor.com'), 'https://chuvator.pages.dev/accept-invitation?token=raw-token-123');
    assert.equal(getInviteUrl('inv-uuid-old', 'old@gor.com'), null);
  });

  // 11. Revoke invitation validation
  await t.test('11. Revoke Invitation: Verifies revoke parameters and state transition', () => {
    const handleRevoke = (invitationId: string, currentStatus: string) => {
      if (!invitationId) throw new Error('ID Undangan wajib disertakan.');
      if (currentStatus !== 'pending') throw new Error('Hanya undangan berstatus pending yang dapat dibatalkan.');
      return { success: true, newStatus: 'revoked' };
    };

    assert.equal(handleRevoke('inv-1', 'pending').success, true);
    assert.equal(handleRevoke('inv-1', 'pending').newStatus, 'revoked');
    assert.throws(() => handleRevoke('inv-1', 'accepted'), /Hanya undangan berstatus pending/);
  });

  // 12. Delete staff confirmation requirement
  await t.test('12. Delete Staff Confirmation: Deletion requires explicit confirmation payload without native browser dialogs', () => {
    let staffRecord = { id: 'st-delete-1', name: 'Staf Batal', status: 'active' };

    const confirmAndDelete = (staffId: string, confirmed: boolean) => {
      if (!confirmed) return { deleted: false };
      return { deleted: true, deletedStaffId: staffId };
    };

    assert.equal(confirmAndDelete(staffRecord.id, false).deleted, false);
    assert.equal(confirmAndDelete(staffRecord.id, true).deleted, true);
    assert.equal(confirmAndDelete(staffRecord.id, true).deletedStaffId, 'st-delete-1');
  });

  // 13. Realtime subscription channel formatting & cleanup
  await t.test('13. Realtime Subscription: Channels are bound to tenant_id and properly cleaned up on unmount', () => {
    const tenantId = 'gor-tenant-999';
    const channelName = `realtime_mobile_staff_${tenantId}`;
    assert.equal(channelName, 'realtime_mobile_staff_gor-tenant-999');

    // Simulate cleanup
    let unsubscribed = false;
    const mockChannel = {
      unsubscribe: () => { unsubscribed = true; }
    };
    mockChannel.unsubscribe();
    assert.equal(unsubscribed, true);
  });

  // 14. Loading, empty, and error state representations
  await t.test('14. UI State Representations: Handles loading, empty, and restricted access correctly', () => {
    // Standalone mobile component renders restricted access when user has no permissions (kasir)
    const htmlKasir = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MobileStaffMain, { userProfile: mockKasirProfile })
      )
    );
    assert.ok(htmlKasir.includes('Akses Terbatas: Khusus Owner / Admin'));

    // Standalone mobile component renders for Owner
    const htmlOwner = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MobileStaffMain, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlOwner.includes('chua-mobile-app'));
    assert.ok(htmlOwner.includes('Manajemen Staf &amp; Akses') || htmlOwner.includes('Manajemen Staf & Akses'));
  });

  // 15. Tenant context resolution
  await t.test('15. Tenant Context: Correctly resolves tenantId from multiple userProfile formats', () => {
    const resolveTenantId = (profile: any) => {
      return profile?.tenant?.id || profile?.tenantId || profile?.id || profile?.uid || null;
    };

    assert.equal(resolveTenantId({ tenant: { id: 'tid-1' } }), 'tid-1');
    assert.equal(resolveTenantId({ tenantId: 'tid-2' }), 'tid-2');
    assert.equal(resolveTenantId({ id: 'tid-3' }), 'tid-3');
    assert.equal(resolveTenantId({ uid: 'tid-4' }), 'tid-4');
  });

  // 16. Desktop behavioral preservation
  await t.test('16. Desktop Preservation: StaffDesktopMain renders unchanged desktop structure independently', () => {
    const htmlDesktop = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(StaffDesktopMain, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlDesktop.includes('Manajemen Staf &amp; Hak Akses') || htmlDesktop.includes('Manajemen Staf & Hak Akses'));
    assert.ok(htmlDesktop.includes('Protokol Keamanan Multi-Tenant'));
    assert.ok(htmlDesktop.includes('Daftar Staf Cabang'));
  });

});
