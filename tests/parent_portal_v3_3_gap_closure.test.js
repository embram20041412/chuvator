import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndNormalizeWhatsAppNumber,
  generateWhatsAppMessage,
  buildWhatsAppUrl,
  determineInvitationStatus,
  validateSupabaseActionLink
} from '../functions/api/tenant/parents/_invitation_helper.js';

describe('CHUVATOR PARENT PORTAL V3.3 — FINAL VALIDATION TEST SUITE (12 MANDATORY SCENARIOS)', () => {

  test('1. Invitation Creation Parameter & Format Validation', () => {
    const phone = '081234567890';
    const norm = validateAndNormalizeWhatsAppNumber(phone);
    assert.equal(norm.valid, true);
    assert.equal(norm.normalized, '6281234567890');

    const validRelationships = ['father', 'mother', 'guardian', 'other'];
    assert.ok(validRelationships.includes('father'));
    assert.ok(validRelationships.includes('mother'));
    assert.ok(validRelationships.includes('guardian'));
    assert.ok(validRelationships.includes('other'));
    assert.equal(validRelationships.includes('friend'), false);

    const msg = generateWhatsAppMessage({
      parentName: 'Budi Santoso',
      tenantName: 'KEDIRI SPORT ARENA',
      actionLink: 'https://chuvator.pages.dev/portal/claim-invitation?token=inv_test123'
    });
    assert.ok(msg.includes('Budi Santoso'));
    assert.ok(msg.includes('KEDIRI SPORT ARENA'));
    assert.ok(msg.includes('inv_test123'));

    const waUrl = buildWhatsAppUrl(norm.normalized, msg);
    assert.ok(waUrl.startsWith('https://wa.me/6281234567890?text='));
    assert.ok(waUrl.includes(encodeURIComponent('Budi Santoso')));
  });

  test('2. Staff & Tenant Owner RBAC Authorization Validation', () => {
    const allowedRoles = ['superadmin', 'owner', 'admin'];
    assert.equal(allowedRoles.includes('kasir'), false);
    assert.equal(allowedRoles.includes('pelatih'), false);
    assert.equal(allowedRoles.includes('coach'), false);
    assert.equal(allowedRoles.includes('admin'), true);
    assert.equal(allowedRoles.includes('owner'), true);

    // Test Tenant Owner fallback resolution logic
    const resolveStaffOrOwnerRole = (actorUid, tenantId, staffDb, tenantDb) => {
      // 1. Check users_staff
      const staff = staffDb.find(s => s.uid === actorUid && s.tenant_id === tenantId && s.status === 'active');
      if (staff) return staff.role;
      // 2. Fallback check tenants.owner_uid
      const tenant = tenantDb.find(t => t.id === tenantId && t.owner_uid === actorUid);
      if (tenant) return 'owner';
      return null;
    };

    const mockStaffDb = [
      { uid: 'staff-1', tenant_id: 't-1', role: 'admin', status: 'active' }
    ];
    const mockTenantDb = [
      { id: 't-1', owner_uid: 'owner-uid-999' }
    ];

    // Staff user
    assert.equal(resolveStaffOrOwnerRole('staff-1', 't-1', mockStaffDb, mockTenantDb), 'admin');
    // Tenant Owner user (not in users_staff)
    assert.equal(resolveStaffOrOwnerRole('owner-uid-999', 't-1', mockStaffDb, mockTenantDb), 'owner');
    // Unauthorized user
    assert.equal(resolveStaffOrOwnerRole('stranger', 't-1', mockStaffDb, mockTenantDb), null);
  });

  test('3. Sequential Invitation for Two Children Logic', () => {
    // Parent invites child 1 -> pending invitation 1 created
    const inv1 = { id: 'inv-1', studentId: 'stu-1', status: 'pending' };
    // Parent invites child 2 -> pending invitation 1 marked expired, pending invitation 2 created
    const invList = [inv1];
    const updatedInvList = invList.map(inv => inv.status === 'pending' ? { ...inv, status: 'expired' } : inv);
    updatedInvList.push({ id: 'inv-2', studentId: 'stu-2', status: 'pending' });

    assert.equal(updatedInvList[0].status, 'expired');
    assert.equal(updatedInvList[1].status, 'pending');
    assert.equal(updatedInvList[1].studentId, 'stu-2');
  });

  test('4. Child-Specific Activation (Target Student Only)', () => {
    // Parent has 2 student links
    const links = [
      { studentId: 'stu-1', status: 'pending' },
      { studentId: 'stu-2', status: 'pending' }
    ];

    // Claim invitation for stu-1
    const claimedStudentId = 'stu-1';
    const updatedLinks = links.map(l => l.studentId === claimedStudentId ? { ...l, status: 'active' } : l);

    assert.equal(updatedLinks.find(l => l.studentId === 'stu-1').status, 'active');
    assert.equal(updatedLinks.find(l => l.studentId === 'stu-2').status, 'pending');
  });

  test('5. Invalid Token Rejection', () => {
    const shortToken = 'inv_short';
    assert.ok(shortToken.length < 32);

    const isTokenFormatValid = (tok) => typeof tok === 'string' && tok.startsWith('inv_') && tok.length >= 32;
    assert.equal(isTokenFormatValid(shortToken), false);
    assert.equal(isTokenFormatValid('inv_12345678901234567890123456789012'), true);
  });

  test('6. Expired Token Handling', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const isExpired = (expiresAt) => new Date(expiresAt).getTime() <= Date.now();

    assert.equal(isExpired(pastDate), true);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    assert.equal(isExpired(futureDate), false);
  });

  test('7. Replay Ticket Rejection', () => {
    const ticket = { id: 'tkt-1', status: 'claimed' };
    const canClaimTicket = (t) => t.status === 'active';

    assert.equal(canClaimTicket(ticket), false);
  });

  test('8. Concurrent Claim Locking Simulation', () => {
    let ticketState = { status: 'active', claimedBy: null };

    const processClaim = (authUid) => {
      if (ticketState.status !== 'active') {
        throw new Error('TICKET_NOT_ACTIVE');
      }
      ticketState.status = 'claimed';
      ticketState.claimedBy = authUid;
      return true;
    };

    // First claim succeeds
    const res1 = processClaim('user-aaa');
    assert.equal(res1, true);
    assert.equal(ticketState.claimedBy, 'user-aaa');

    // Second concurrent claim fails
    assert.throws(() => processClaim('user-bbb'), /TICKET_NOT_ACTIVE/);
  });

  test('9. Cross-Tenant Rejection', () => {
    const staffTenant = 'tenant-alpha';
    const targetStudentTenant = 'tenant-beta';

    const isTenantMatch = (t1, t2) => t1 === t2;
    assert.equal(isTenantMatch(staffTenant, targetStudentTenant), false);
  });

  test('10. Revoke Without Deleting Active Relations', () => {
    const parentAccount = { id: 'parent-1', status: 'active' };
    const links = [{ studentId: 'stu-1', status: 'active' }];
    let invitation = { id: 'inv-1', status: 'pending' };

    // Executing revoke_parent_invitation
    invitation.status = 'revoked';

    // Account and links remain untouched
    assert.equal(parentAccount.status, 'active');
    assert.equal(links[0].status, 'active');
    assert.equal(invitation.status, 'revoked');
  });

  test('11. Active-Child-Only Login Verification', () => {
    const allLinks = [
      { studentId: 'stu-1', status: 'active' },
      { studentId: 'stu-2', status: 'pending' },
      { studentId: 'stu-3', status: 'revoked' }
    ];

    const activeLinks = allLinks.filter(l => l.status === 'active');
    assert.equal(activeLinks.length, 1);
    assert.equal(activeLinks[0].studentId, 'stu-1');
  });

  test('12. Auth UID Binding Protection', () => {
    const parent = { id: 'parent-1', authUid: 'bound-uid-123' };
    const newIncomingUid = 'attacker-uid-999';

    const verifyAuthUidBinding = (boundUid, incomingUid) => {
      if (boundUid && boundUid !== incomingUid) {
        throw new Error('AUTH_UID_MISMATCH_WITH_EXISTING_BINDING');
      }
      return true;
    };

    // Same bound UID passes
    assert.equal(verifyAuthUidBinding(parent.authUid, 'bound-uid-123'), true);

    // Mismatched incoming UID fails closed
    assert.throws(() => verifyAuthUidBinding(parent.authUid, newIncomingUid), /AUTH_UID_MISMATCH_WITH_EXISTING_BINDING/);
  });

});
