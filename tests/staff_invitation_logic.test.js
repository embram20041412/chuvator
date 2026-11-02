import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStaffRole, buildInvitationUrl } from '../src/services/staffService.js';

test('normalizeStaffRole normalizes various inputs to canonical database roles', () => {
  assert.equal(normalizeStaffRole('kasir'), 'kasir');
  assert.equal(normalizeStaffRole('cashier'), 'kasir');
  assert.equal(normalizeStaffRole('KASIR'), 'kasir');

  assert.equal(normalizeStaffRole('pelatih'), 'coach');
  assert.equal(normalizeStaffRole('coach'), 'coach');
  assert.equal(normalizeStaffRole('COACH'), 'coach');

  assert.equal(normalizeStaffRole('admin'), 'admin');
  assert.equal(normalizeStaffRole('administrator'), 'admin');
  assert.equal(normalizeStaffRole('ADMIN'), 'admin');

  assert.equal(normalizeStaffRole('staf'), 'staff');
  assert.equal(normalizeStaffRole('staff'), 'staff');
  assert.equal(normalizeStaffRole('STAFF'), 'staff');

  // Fallback defaults to kasir
  assert.equal(normalizeStaffRole(''), 'kasir');
  assert.equal(normalizeStaffRole(null), 'kasir');
  assert.equal(normalizeStaffRole('unknown_role'), 'kasir');
});

test('buildInvitationUrl constructs clean URL containing the raw token', () => {
  const sampleToken = 'e4b96dfa25c78b191a27e7f1e628468b1a8d05c213e4304859a43a7587ef72db';
  const url = buildInvitationUrl(sampleToken);
  assert.ok(url.includes('/accept-invitation?token='));
  assert.ok(url.includes(sampleToken));
});
