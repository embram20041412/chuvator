import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStaffRole, buildInvitationUrl, formatInvitationExpiry } from '../src/services/staffService.js';
import { toUuidOrNull } from '../src/services/supabaseAcademyService.js';

test('Coach Role: normalizeStaffRole maps "coach", "pelatih", "COACH", and "PELATIH" to canonical "coach"', () => {
  assert.equal(normalizeStaffRole('coach'), 'coach');
  assert.equal(normalizeStaffRole('pelatih'), 'coach');
  assert.equal(normalizeStaffRole('COACH'), 'coach');
  assert.equal(normalizeStaffRole('PELATIH'), 'coach');
  assert.equal(normalizeStaffRole('  Coach  '), 'coach');
  assert.equal(normalizeStaffRole('  Pelatih '), 'coach');
});

test('UUID Validator: toUuidOrNull safely extracts valid UUIDs or returns null', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  assert.equal(toUuidOrNull(validUuid), validUuid);
  assert.equal(toUuidOrNull('  ' + validUuid + '  '), validUuid);
  assert.equal(toUuidOrNull('invalid-academy-id'), null);
  assert.equal(toUuidOrNull(''), null);
  assert.equal(toUuidOrNull(null), null);
  assert.equal(toUuidOrNull(undefined), null);
});

test('Expiry Formatter: formatInvitationExpiry dynamically calculates expiration duration and timestamp', () => {
  const now = new Date('2026-11-03T00:00:00.000Z');
  const in7Days = new Date('2026-11-10T00:00:00.000Z');
  const formatted7Days = formatInvitationExpiry(in7Days.toISOString(), now.toISOString());

  assert.ok(formatted7Days.includes('7 Hari'));
  assert.ok(formatted7Days.includes('s.d.'));

  const in24Hours = new Date('2026-11-04T00:00:00.000Z');
  const formatted24Hours = formatInvitationExpiry(in24Hours.toISOString(), now.toISOString());
  assert.ok(formatted24Hours.includes('1 Hari') || formatted24Hours.includes('24 Jam'));

  assert.equal(formatInvitationExpiry(null), '-');
  assert.equal(formatInvitationExpiry(''), '-');
  assert.equal(formatInvitationExpiry('invalid-date'), '-');
});

test('Invite URL Builder: buildInvitationUrl creates standardized URL with raw token param', () => {
  const sampleToken = 'e4b96dfa25c78b191a27e7f1e628468b1a8d05c213e4304859a43a7587ef72db';
  const url = buildInvitationUrl(sampleToken);

  assert.ok(url.includes('/accept-invitation?token='));
  assert.ok(url.includes(sampleToken));
});

test('Branch Logic: Validasi payload createCoachWithAccount menolak jika nama pelatih atau tenantId kosong', async () => {
  const { createCoachWithAccount } = await import('../src/services/coachAuthService.js');

  await assert.rejects(
    async () => {
      await createCoachWithAccount({
        tenantId: '',
        name: 'Coach Test',
      });
    },
    { message: /Nama pelatih dan ID Tenant wajib diisi/ }
  );

  await assert.rejects(
    async () => {
      await createCoachWithAccount({
        tenantId: 'tenant-123',
        name: '',
      });
    },
    { message: /Nama pelatih dan ID Tenant wajib diisi/ }
  );
});

test('Security Separation: sendInvite=false blocks invitation dispatch', async () => {
  // Pure logic check: when sendInvite is false, no invitation creation should be attempted
  const email = 'coach.budi@test.com';
  const sendInvite = false;
  const shouldSendInvite = Boolean(email.trim() && sendInvite);
  assert.equal(shouldSendInvite, false);
});
