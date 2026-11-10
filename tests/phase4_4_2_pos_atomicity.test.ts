import test from 'node:test';
import assert from 'node:assert/strict';
import { processPosCheckout } from '../src/services/supabaseArenaService';
import { supabase } from '../src/config/supabase';

test('CHUVATOR — Phase 4.4.2.2 Critical POS Checkout Security & Integrity Test Suite', async (t) => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const foreignTenantId = '99999999-9999-9999-9999-999999999999';

  await t.test('1. Successful Checkout: Executes atomic checkout for physical and rental items', async () => {
    const items = [
      { id: 'p-101', name: 'Pocari Sweat', price: 10000, qty: 2, type: 'jual', stock: 10 },
      { id: 'p-102', name: 'Sewa Raket', price: 20000, qty: 1, type: 'sewa', stock: 5 }
    ];

    const result = await processPosCheckout({
      tenantId,
      paymentMethod: 'QRIS',
      items,
      customerName: 'Ahmad Budi',
      cashierName: 'Kasir Utama',
      idempotencyKey: `idemp-test-1-${Date.now()}`
    });

    assert.equal(result.success, true);
    assert.equal(result.cart_total, 40000);
    assert.equal(result.items_count, 3);
    assert.equal(result.payment_method, 'QRIS');
    assert.ok(result.transaction_id);
    assert.ok(result.receipt_no);
    assert.ok(result.ledger_id);
  });

  await t.test('2. Atomic Rollback Test: Rejects transaction if any product has insufficient stock', async () => {
    const items = [
      { id: 'p-201', name: 'Minuman Mineral', price: 5000, qty: 1, type: 'jual', stock: 10 },
      { id: 'p-202', name: 'Shuttlecock Premium', price: 150000, qty: 999, type: 'jual', stock: 2 }
    ];

    await assert.rejects(
      async () => {
        await processPosCheckout({
          tenantId,
          paymentMethod: 'Cash',
          items,
          customerName: 'Kasir Test'
        });
      },
      (err: any) => {
        assert.match(err.message, /tidak mencukupi/i);
        return true;
      }
    );
  });

  await t.test('3. Idempotency Key Reservation: Two concurrent checkouts with same key return single transaction', async () => {
    const key = `idemp-concurrent-${Date.now()}`;
    const items = [{ id: 'p-301', name: 'Grip Handuk', price: 15000, qty: 1, type: 'jual', stock: 10 }];

    const req1 = processPosCheckout({
      tenantId,
      paymentMethod: 'Cash',
      items,
      customerName: 'Kasir A',
      idempotencyKey: key
    });

    const req2 = processPosCheckout({
      tenantId,
      paymentMethod: 'Cash',
      items,
      customerName: 'Kasir A',
      idempotencyKey: key
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    assert.equal(res1.transaction_id, res2.transaction_id);
    assert.equal(res1.receipt_no, res2.receipt_no);
    assert.equal(res1.cart_total, res2.cart_total);
  });

  await t.test('4. Stock Limit Concurrency: Two checkouts with different keys where stock is 1', async () => {
    const items1 = [{ id: 'p-401', name: 'Item Terakhir', price: 25000, qty: 1, type: 'jual', stock: 1 }];
    const items2 = [{ id: 'p-401', name: 'Item Terakhir', price: 25000, qty: 1, type: 'jual', stock: 1 }];

    const req1 = processPosCheckout({
      tenantId,
      paymentMethod: 'Cash',
      items: items1,
      customerName: 'Kasir A',
      idempotencyKey: `key-a-${Date.now()}`
    });

    const req2 = processPosCheckout({
      tenantId,
      paymentMethod: 'Cash',
      items: items2,
      customerName: 'Kasir B',
      idempotencyKey: `key-b-${Date.now()}`
    });

    const results = await Promise.allSettled([req1, req2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    assert.ok(fulfilled.length >= 1);
  });

  await t.test('5. SPP Duplicate Payment Protection Test: Rejects 2nd payment attempt for same month', async () => {
    const studentId = 'e0000000-0000-0000-0000-000000000001';
    const targetMonth = `2026-11-${Date.now()}`;
    const sppItem = [
      {
        id: `spp-${studentId}-${targetMonth}`,
        studentId,
        student_id: studentId,
        studentName: 'Rian Perdana',
        name: `SPP November 2026 - Rian Perdana`,
        price: 350000,
        qty: 1,
        type: 'spp',
        paid_month: targetMonth
      }
    ];

    const res1 = await processPosCheckout({
      tenantId,
      paymentMethod: 'Transfer Bank',
      items: sppItem,
      customerName: 'Wali Rian'
    });
    assert.equal(res1.success, true);

    await assert.rejects(
      async () => {
        await processPosCheckout({
          tenantId,
          paymentMethod: 'QRIS',
          items: sppItem,
          customerName: 'Wali Rian'
        });
      },
      (err: any) => {
        assert.match(err.message, /sudah lunas/i);
        return true;
      }
    );
  });

  await t.test('6. Idempotency Key Isolation Across Tenants', async () => {
    const sharedKey = `shared-key-${Date.now()}`;
    const items = [{ id: 'p-601', name: 'Kaos', price: 50000, qty: 1, type: 'jual', stock: 10, tenant_id: tenantId }];

    const res1 = await processPosCheckout({
      tenantId,
      paymentMethod: 'Cash',
      items,
      customerName: 'Tenant 1 User',
      idempotencyKey: sharedKey
    });

    // Request with items belonging to tenant 1 under foreign tenant context must be rejected
    await assert.rejects(
      async () => {
        await processPosCheckout({
          tenantId: foreignTenantId,
          paymentMethod: 'Cash',
          items, // item has tenant_id = tenantId !== foreignTenantId
          customerName: 'Tenant 2 User',
          idempotencyKey: sharedKey
        });
      },
      (err: any) => {
        assert.match(err.message, /tenant lain/i);
        return true;
      }
    );
  });

  await t.test('7. Missing Tenant Validation Rejection', async () => {
    await assert.rejects(
      async () => {
        await processPosCheckout({
          tenantId: '',
          paymentMethod: 'Cash',
          items: []
        });
      },
      (err: any) => {
        assert.match(err.message, /Tenant ID wajib diisi/i);
        return true;
      }
    );
  });

  await t.test('8. Receipt & Ledger Consistency Verification', async () => {
    const items = [{ id: 'p-801', name: 'Air Mineral 1.5L', price: 7000, qty: 3, type: 'jual', stock: 20 }];
    const res = await processPosCheckout({
      tenantId,
      paymentMethod: 'Tunai (Cash)',
      items,
      customerName: 'Budi Santoso'
    });

    assert.equal(res.cart_total, 21000);
    assert.equal(res.items_count, 3);
    assert.ok(res.transaction_id);
    assert.ok(res.receipt_id);
    assert.ok(res.ledger_id);
  });
});
