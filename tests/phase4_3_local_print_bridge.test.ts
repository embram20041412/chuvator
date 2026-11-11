/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 4.3: Local Print Bridge & Bluetooth Classic SPP Unit Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRINT_ADAPTERS,
  PRINT_EXECUTION_STATUS,
  DOC_TYPES
} from '../src/printing/types/printTypes.js';
import { PrintEngine } from '../src/printing/core/PrintEngine.js';
import { LocalPrintBridgeAdapter } from '../src/printing/adapters/LocalPrintBridgeAdapter.js';
import { PrinterConnectionManager, CONNECTION_STATUS } from '../src/printing/hardware/PrinterConnectionManager.js';
import { createBridgeServer } from '../local-print-bridge/src/server/bridgeServer.js';

test('Phase 4.3 — LocalPrintBridgeAdapter Core Unit Tests', async (t) => {
  await t.test('1. Instantiates with default or custom bridge URL and token', () => {
    const adapter = new LocalPrintBridgeAdapter({
      bridgeUrl: 'http://127.0.0.1:9123',
      token: 'test-token-xyz'
    });

    assert.equal(adapter.name, 'LocalPrintBridgeAdapter');
    assert.equal(adapter.adapterKey, PRINT_ADAPTERS.LOCAL_BRIDGE);
    assert.equal(adapter.bridgeUrl, 'http://127.0.0.1:9123');
    assert.equal(adapter.token, 'test-token-xyz');
  });

  await t.test('2. checkHealth returns OFFLINE when bridge server is unreachable', async () => {
    const adapter = new LocalPrintBridgeAdapter({
      bridgeUrl: 'http://127.0.0.1:9999',
      fetchImpl: async () => {
        throw new Error('Connection refused');
      }
    });

    const health = await adapter.checkHealth();
    assert.equal(health.online, false);
    assert.equal(health.status, 'UNREACHABLE');
    assert.match(health.message, /Tidak dapat terhubung/);
  });

  await t.test('3. checkHealth returns ONLINE when bridge server responds with HTTP 200', async () => {
    const adapter = new LocalPrintBridgeAdapter({
      bridgeUrl: 'http://127.0.0.1:9123',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ONLINE',
          version: '1.0.0',
          requireAuth: true
        })
      })
    });

    const health = await adapter.checkHealth();
    assert.equal(health.online, true);
    assert.equal(health.status, 'ONLINE');
    assert.equal(health.version, '1.0.0');
  });

  await t.test('4. pair registers and stores security token', async () => {
    const adapter = new LocalPrintBridgeAdapter({
      bridgeUrl: 'http://127.0.0.1:9123',
      fetchImpl: async (url: any, opts: any) => {
        const body = JSON.parse(opts?.body || '{}');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            token: body.token || 'newly-generated-token',
            message: 'Pairing token berhasil didaftarkan.'
          })
        };
      }
    });

    const res = await adapter.pair('requested-token-99');
    assert.equal(res.ok, true);
    assert.equal(res.token, 'requested-token-99');
    assert.equal(adapter.token, 'requested-token-99');
  });

  await t.test('5. discoverPrinters returns printer list from bridge', async () => {
    const adapter = new LocalPrintBridgeAdapter({
      bridgeUrl: 'http://127.0.0.1:9123',
      token: 'valid-token-123',
      fetchImpl: async (url: any, opts: any) => {
        assert.equal(opts?.headers?.['X-Bridge-Token'], 'valid-token-123');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            count: 2,
            printers: [
              { id: 'bt-spp-1', name: 'Bluetooth SPP Thermal Printer', type: 'bluetooth_spp' },
              { id: 'usb-drv-1', name: 'Epson USB Driver', type: 'usb_driver' }
            ]
          })
        };
      }
    });

    const res = await adapter.discoverPrinters();
    assert.equal(res.ok, true);
    assert.equal(res.printers.length, 2);
    assert.equal(res.printers[0].name, 'Bluetooth SPP Thermal Printer');
  });

  await t.test('6. print sends base64 ESC/POS payload to bridge and returns SUCCESS', async () => {
    let capturedBody: any = null;
    const adapter = new LocalPrintBridgeAdapter({
      bridgeUrl: 'http://127.0.0.1:9123',
      token: 'valid-token-123',
      fetchImpl: async (url: any, opts: any) => {
        capturedBody = JSON.parse(opts?.body || '{}');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            jobId: 'job_test_123',
            status: 'COMPLETED',
            message: 'Pekerjaan cetak berhasil dikirim.'
          })
        };
      }
    });

    const sampleDoc = {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      receiptNo: 'REC-BRIDGE-001',
      date: '11 Nov 2026',
      time: '14:00',
      cashierName: 'Kasir Bridge',
      customerName: 'Pelanggan SPP',
      items: [
        { name: 'Item Test Bridge', qty: 1, unitPrice: 50000, subtotal: 50000 }
      ],
      total: 50000
    };

    const res = await adapter.print(sampleDoc, {
      printerType: 'bluetooth_spp',
      serialPath: 'COM3'
    });

    assert.equal(res.ok, true);
    assert.equal(res.status, PRINT_EXECUTION_STATUS.SUCCESS);
    assert.equal(res.adapter, PRINT_ADAPTERS.LOCAL_BRIDGE);
    assert.equal(res.physicalPrintConfirmed, true);
    assert.equal(res.jobId, 'job_test_123');
    assert.ok(capturedBody && capturedBody.escPosBase64);
    assert.equal(capturedBody?.printerType, 'bluetooth_spp');
  });
});

test('Phase 4.3 — PrintEngine & ConnectionManager Integration', async (t) => {
  await t.test('1. PrintEngine registers LocalPrintBridgeAdapter under "bridge"', () => {
    const mockBridgeAdapter = new LocalPrintBridgeAdapter({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, jobId: 'job_1', status: 'COMPLETED' })
      })
    });

    const engine = new PrintEngine({
      localBridgeAdapter: mockBridgeAdapter
    });

    assert.ok(engine.getAdapter(PRINT_ADAPTERS.LOCAL_BRIDGE));
    assert.equal(engine.getAdapter('bridge'), mockBridgeAdapter);
  });

  await t.test('2. PrintEngine.printDocument routes to LocalPrintBridgeAdapter when adapter="bridge"', async () => {
    const mockBridgeAdapter = new LocalPrintBridgeAdapter({
      token: 'test-token',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, jobId: 'job_99', status: 'COMPLETED' })
      })
    });

    const engine = new PrintEngine({
      localBridgeAdapter: mockBridgeAdapter
    });

    const sampleDoc = {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      receiptNo: 'REC-ROUTER-001',
      date: '11 Nov 2026',
      time: '14:00',
      items: [{ name: 'Test Route', qty: 1, unitPrice: 10000, subtotal: 10000 }],
      total: 10000
    };

    const res = await engine.printDocument(sampleDoc, { adapter: 'bridge' });
    assert.equal(res.ok, true);
    assert.equal(res.adapter, 'bridge');
    assert.equal(res.jobId, 'job_99');
  });

  await t.test('3. PrinterConnectionManager handles pairAndConnectLocalBridge successfully', async () => {
    const manager = new PrinterConnectionManager();
    const mockBridgeAdapter = new LocalPrintBridgeAdapter({
      fetchImpl: async (url: any) => {
        if (typeof url === 'string' && url.endsWith('/health')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'ONLINE', version: '1.0.0', requireAuth: true })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: 'paired-token-xyz', message: 'Paired' })
        };
      }
    });

    const nextState = await manager.pairAndConnectLocalBridge({
      bridgeAdapter: mockBridgeAdapter,
      token: 'test-pairing-token'
    });

    assert.equal(nextState.status, CONNECTION_STATUS.CONNECTED);
    assert.equal(nextState.adapter, 'bridge');
    assert.equal(nextState.directEscPosTransmissionReady, true);
    assert.match(nextState.statusMessage, /Local Print Bridge terhubung/);
  });
});

test('Phase 4.3 — End-to-End Bridge HTTP Server Integration', async (t) => {
  const bridge = createBridgeServer({
    config: { port: 9875, host: '127.0.0.1', version: '1.0.0', allowedOrigins: ['*'] }
  });

  await bridge.listen(9875, '127.0.0.1');

  await t.test('Full Flow: Health -> Pair -> Discover -> Print Job', async () => {
    const adapter = new LocalPrintBridgeAdapter({
      bridgeUrl: 'http://127.0.0.1:9875'
    });

    // 1. Health check
    const health = await adapter.checkHealth();
    assert.equal(health.online, true);

    // 2. Pair token
    const pairRes = await adapter.pair('e2e-token-abc');
    assert.equal(pairRes.ok, true);

    // 3. Discover printers
    const discoveryRes = await adapter.discoverPrinters();
    assert.equal(discoveryRes.ok, true);
    assert.ok(discoveryRes.printers.length > 0);

    // 4. Submit print job
    const sampleDoc = {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      receiptNo: 'REC-E2E-001',
      date: '11 Nov 2026',
      time: '14:30',
      cashierName: 'Admin E2E',
      customerName: 'Test SPP Printer',
      items: [{ name: 'Kopi Susu Gula Aren', qty: 2, unitPrice: 18000, subtotal: 36000 }],
      total: 36000
    };

    const printRes = await adapter.print(sampleDoc, {
      printerType: 'bluetooth_spp',
      serialPath: 'COM3'
    });

    assert.equal(printRes.ok, true);
    assert.equal(printRes.status, PRINT_EXECUTION_STATUS.SUCCESS);
    assert.ok(printRes.jobId);
  });

  await bridge.close();
});
