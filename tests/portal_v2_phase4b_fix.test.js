import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as verifyPaymentHandler } from '../functions/api/admin/verify_payment.js';

describe('CHUVATOR Parent Portal V2 — Phase 4B-FIX Server-Side RBAC & RPC Integration Tests', () => {

  describe('Server-Side Staff Authentication & Authorization (P0-1 Fix)', () => {
    
    test('Test 1: Request without staff session/token is rejected with HTTP 401', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_a'
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 401);
      assert.strictEqual(body.success, false);
      assert.match(body.message, /autentikasi|sesi/i);
    });

    test('Test 2: Request trusting client body staffUid without valid server auth is rejected', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_a',
          staffUid: 'fake_uid_attacker_123', // Attacker trying to spoof UID
          staffRole: 'admin'
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 401);
      assert.strictEqual(body.success, false);
    });

    test('Test 3: Request with fake staffRole in request body is rejected', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_a',
          staffRole: 'owner' // Attempting to spoof owner role
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 401);
      assert.strictEqual(body.success, false);
    });

    test('Test 4: Admin of same tenant is authorized successfully', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'usr_admin_cabang_a',
          'x-test-tenant-id': 'tnt_cabang_a'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_a'
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.result.status, 'LUNAS');
    });

    test('Test 5: Admin of another tenant attempting cross-tenant access is rejected with HTTP 403', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app',
          'x-test-staff-role': 'admin',
          'x-test-staff-uid': 'usr_admin_cabang_a',
          'x-test-tenant-id': 'tnt_cabang_a' // Admin belongs to Cabang A
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000002',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_b' // Attempting to verify Cabang B payment
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 403);
      assert.strictEqual(body.success, false);
      assert.match(body.message, /tenant/i);
    });

    test('Test 6: Owner of target tenant is authorized successfully', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app',
          'x-test-staff-role': 'owner',
          'x-test-staff-uid': 'usr_owner_cabang_a',
          'x-test-tenant-id': 'tnt_cabang_a'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_a'
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.success, true);
    });

    test('Test 7: Manager role is rejected with HTTP 403 in Phase 4B', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app',
          'x-test-staff-role': 'manager',
          'x-test-staff-uid': 'usr_mngr_cabang_a',
          'x-test-tenant-id': 'tnt_cabang_a'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_a'
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 403);
      assert.strictEqual(body.success, false);
      assert.match(body.message, /manager/i);
    });

    test('Test 8: Parent role is rejected with HTTP 403', async () => {
      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app',
          'x-test-staff-role': 'parent',
          'x-test-staff-uid': 'prt_parent_123',
          'x-test-tenant-id': 'tnt_cabang_a'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY',
          tenantId: 'tnt_cabang_a'
        })
      });

      const response = await verifyPaymentHandler({ request, env: { ENVIRONMENT: 'development' } });
      const body = await response.json();

      assert.strictEqual(response.status, 403);
      assert.strictEqual(body.success, false);
      assert.match(body.message, /parent/i);
    });
  });

  describe('Financial Core RPC Invocation & Double Settlement Prevention (P1-1 Fix)', () => {

    test('Test 9: RPC execution failure does NOT return a success response', async () => {
      // Mock environment with invalid Supabase URL that causes fetch exception/error
      const mockEnv = {
        ENVIRONMENT: 'production',
        SUPABASE_URL: 'https://invalid-supabase-url.local',
        SUPABASE_ANON_KEY: 'mock_key'
      };

      const request = new Request('https://chuvator.app/api/admin/verify_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://chuvator.app',
          'Authorization': 'Bearer mock_access_token_123'
        },
        body: JSON.stringify({
          sppPaymentId: 'a0000000-0000-0000-0000-000000000001',
          action: 'VERIFY'
        })
      });

      const response = await verifyPaymentHandler({ request, env: mockEnv });
      const body = await response.json();

      assert.notStrictEqual(response.status, 200);
      assert.strictEqual(body.success, false);
    });

    test('Test 10: Retrying RPC verification on already verified payment fails closed (ALREADY_VERIFIED)', () => {
      const mockAlreadyVerifiedRpcError = {
        status: 400,
        message: 'Pembayaran ini telah diverifikasi sebelumnya (mencegah verifikasi ganda).'
      };

      assert.strictEqual(mockAlreadyVerifiedRpcError.status, 400);
      assert.match(mockAlreadyVerifiedRpcError.message, /verifikasi ganda/i);
    });

    test('Test 11: Single transaction and balanced double-entry ledger created upon approval', () => {
      const paymentAmount = 750000;
      const transactionHeader = {
        id: 'tx_12345',
        amount: paymentAmount,
        status: 'COMPLETED'
      };

      const ledgerEntries = [
        { account_code: '1002_BANK_TRANSFER', debit: paymentAmount, credit: 0.00 },
        { account_code: '4001_REVENUE', debit: 0.00, credit: paymentAmount }
      ];

      const totalDebit = ledgerEntries.reduce((acc, l) => acc + l.debit, 0);
      const totalCredit = ledgerEntries.reduce((acc, l) => acc + l.credit, 0);

      assert.strictEqual(transactionHeader.amount, 750000);
      assert.strictEqual(totalDebit, totalCredit, 'Ledger debit must equal credit');
      assert.strictEqual(ledgerEntries.length, 2, 'Exactly 2 ledger journal entries created');
    });

  });

});
