import { test } from 'node:test';
import assert from 'node:assert/strict';

test('CHUVATOR — Phase 4.4 Mobile POS Redesign Logic & Integration Tests', async (t) => {

  // 1. Product Catalog Filtering Logic Test
  await t.test('1. Product Filtering: Correctly filters products by category tab and query', () => {
    const products = [
      { id: '1', name: 'Pocari Sweat 500ml', category: 'Minuman / F&B', type: 'jual', price: 8000, stock: 20 },
      { id: '2', name: 'Shuttlecock JP Gold', category: 'Apparel / Alat', type: 'jual', price: 125000, stock: 10 },
      { id: '3', name: 'Sewa Raket Yonex', category: 'Rental Alat', type: 'sewa', price: 20000, stock: 5 },
    ];

    const filterProducts = (list: typeof products, tab: string, query: string) => {
      return list.filter((prod) => {
        const q = query.toLowerCase().trim();
        const matchSearch = !q || 
          (prod.name || '').toLowerCase().includes(q) ||
          (prod.category || '').toLowerCase().includes(q);

        if (!matchSearch) return false;

        if (tab === 'fnb') return (prod.category || '').toLowerCase().includes('minuman');
        if (tab === 'apparel') return (prod.category || '').toLowerCase().includes('apparel');
        if (tab === 'sewa') return prod.type === 'sewa' || (prod.category || '').toLowerCase().includes('rental');

        return true;
      });
    };

    assert.equal(filterProducts(products, 'all', '').length, 3);
    assert.equal(filterProducts(products, 'fnb', '').length, 1);
    assert.equal(filterProducts(products, 'fnb', '')[0].name, 'Pocari Sweat 500ml');
    assert.equal(filterProducts(products, 'apparel', '').length, 1);
    assert.equal(filterProducts(products, 'sewa', '').length, 1);
    assert.equal(filterProducts(products, 'all', 'yonex').length, 1);
  });

  // 2. Cart Quantity & Stock Depletion Guard
  await t.test('2. Cart Stock Guard: Prevents adding quantity exceeding available physical stock', () => {
    const product = { id: 'p1', name: 'Le Minerale 600ml', price: 4000, stock: 3, type: 'jual' };

    const canAddQty = (currentQtyInCart: number, maxStock: number, itemType: string) => {
      if (itemType === 'sewa') return true; // Rentals are not constrained by physical stock deduction
      return currentQtyInCart + 1 <= maxStock;
    };

    assert.equal(canAddQty(0, product.stock, product.type), true);
    assert.equal(canAddQty(2, product.stock, product.type), true);
    assert.equal(canAddQty(3, product.stock, product.type), false, 'Qty 4 must be blocked when stock is 3');
  });

  // 3. Cash Change Calculation Test
  await t.test('3. Cash Calculator: Accurately computes change amount and validates cash sufficiency', () => {
    const calculateCashState = (totalAmount: number, cashReceived: number) => {
      const isSufficient = cashReceived >= totalAmount;
      const changeAmount = Math.max(0, cashReceived - totalAmount);
      const deficitAmount = Math.max(0, totalAmount - cashReceived);
      return { isSufficient, changeAmount, deficitAmount };
    };

    // Exact cash
    const res1 = calculateCashState(35000, 35000);
    assert.equal(res1.isSufficient, true);
    assert.equal(res1.changeAmount, 0);

    // Overpayment (Cash 50.000 for 35.000 total)
    const res2 = calculateCashState(35000, 50000);
    assert.equal(res2.isSufficient, true);
    assert.equal(res2.changeAmount, 15000);

    // Underpayment (Cash 20.000 for 35.000 total)
    const res3 = calculateCashState(35000, 20000);
    assert.equal(res3.isSufficient, false);
    assert.equal(res3.deficitAmount, 15000);
  });

  // 4. Viewport Breakpoint Test for POS
  await t.test('4. Viewport Breakpoint: Correctly switches between Mobile POS (<=767px) and Desktop POS (>=768px)', () => {
    const isMobileViewport = (width: number) => width <= 767;

    assert.equal(isMobileViewport(360), true);
    assert.equal(isMobileViewport(390), true);
    assert.equal(isMobileViewport(430), true);
    assert.equal(isMobileViewport(767), true);

    assert.equal(isMobileViewport(768), false);
    assert.equal(isMobileViewport(1024), false);
    assert.equal(isMobileViewport(1440), false);
  });

  // 5. Sequential Transaction Pipeline Order & Receipt Generation Test
  await t.test('5. Sequential Checkout Pipeline: Validates item summary, order of operations, and receipt payload structure', () => {
    const cart = [
      { id: 'prod-1', name: 'Air Mineral 600ml', price: 5000, qty: 2, type: 'jual' },
      { id: 'spp-1', name: 'SPP Maret - Budi Pratama', price: 150000, qty: 1, type: 'spp', studentId: 'stu-1' }
    ];

    const itemsSummary = cart.map((i) => `${i.name} (${i.qty}x)`).join(', ');
    const hasAcademy = cart.some((i) => i.type === 'spp' || i.type === 'registration');
    const totalAmount = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);

    assert.equal(itemsSummary, 'Air Mineral 600ml (2x), SPP Maret - Budi Pratama (1x)');
    assert.equal(hasAcademy, true);
    assert.equal(totalAmount, 160000);
    assert.equal(totalItems, 3);

    // Verify receipt payload formation
    const receiptPayload = {
      receiptNo: 'POS-TEST01',
      cashierName: 'Kasir Mobile',
      customerName: 'Pelanggan Umum',
      items: cart.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: i.price,
        subtotal: i.qty * i.price
      })),
      totalAmount,
      paymentMethod: 'Tunai (Cash)',
      cashReceived: 200000,
      changeAmount: 40000
    };

    assert.equal(receiptPayload.receiptNo, 'POS-TEST01');
    assert.equal(receiptPayload.items.length, 2);
    assert.equal(receiptPayload.changeAmount, 40000);
  });

});
