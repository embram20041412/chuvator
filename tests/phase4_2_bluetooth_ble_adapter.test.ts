import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BluetoothBLEPrintAdapter,
  findWritableGattCharacteristic,
  normalizeUuid
} from '../src/printing/adapters/BluetoothBLEPrintAdapter.js';
import {
  DOC_TYPES,
  PRINT_ADAPTERS,
  PRINT_EXECUTION_STATUS
} from '../src/printing/types/printTypes.js';
import {
  PrintEngine
} from '../src/printing/core/PrintEngine.js';
import {
  PrinterConnectionManager
} from '../src/printing/hardware/PrinterConnectionManager.js';

function createMockBleDevice(options: any = {}) {
  const isGattSupported = options.isGattSupported ?? true;
  const hasService = options.hasService ?? true;
  const hasWritableChar = options.hasWritableChar ?? true;
  const writeMode = options.writeMode || 'withResponse'; // 'withResponse' | 'withoutResponse' | 'none'
  const throwOnConnect = options.throwOnConnect || null;
  const throwOnWrite = options.throwOnWrite || null;

  const logs: string[] = [];

  const charProps = {
    write: writeMode === 'withResponse',
    writeWithoutResponse: writeMode === 'withoutResponse',
    read: false,
    notify: false
  };

  const characteristic = {
    uuid: '00002ab6-0000-1000-8000-00805f9b34fb',
    properties: charProps,
    async writeValueWithResponse(data: Uint8Array) {
      logs.push(`writeValueWithResponse:${data.byteLength}`);
      if (throwOnWrite) throw throwOnWrite;
    },
    async writeValueWithoutResponse(data: Uint8Array) {
      logs.push(`writeValueWithoutResponse:${data.byteLength}`);
      if (throwOnWrite) throw throwOnWrite;
    },
    async writeValue(data: Uint8Array) {
      logs.push(`writeValue:${data.byteLength}`);
      if (throwOnWrite) throw throwOnWrite;
    }
  };

  const service = {
    uuid: '000018f0-0000-1000-8000-00805f9b34fb',
    async getCharacteristics() {
      logs.push('getCharacteristics');
      return hasWritableChar ? [characteristic] : [];
    }
  };

  const gattServer = {
    connected: false,
    async connect() {
      logs.push('connect');
      if (throwOnConnect) throw throwOnConnect;
      this.connected = true;
      return this;
    },
    disconnect() {
      logs.push('disconnect');
      this.connected = false;
    },
    async getPrimaryServices() {
      logs.push('getPrimaryServices');
      return hasService ? [service] : [];
    },
    async getPrimaryService(uuid: string) {
      logs.push(`getPrimaryService:${uuid}`);
      if (hasService) return service;
      throw new Error('Service not found');
    }
  };

  const listeners = new Map<string, Function>();

  const device = {
    id: options.id || 'ble-dev-1',
    name: options.name || 'RPP02N-BLE Printer',
    gatt: isGattSupported ? gattServer : null,
    addEventListener(evt: string, fn: Function) {
      listeners.set(evt, fn);
    },
    removeEventListener(evt: string, fn: Function) {
      listeners.delete(evt);
    },
    _listeners: listeners,
    _logs: logs,
    _gattServer: gattServer
  };

  return device;
}

function createMockNavigatorBluetooth(mockDevice: any = null) {
  return {
    userAgent: 'Chrome/124.0',
    bluetooth: {
      getDevices: async () => (mockDevice ? [mockDevice] : []),
      requestDevice: async () => mockDevice || {}
    }
  };
}

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k)
  };
}

test('Phase 4.2.1 - Browser without Web Bluetooth API fails gracefully with UNSUPPORTED_DEVICE', async () => {
  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: { userAgent: 'Safari/17.0' }
  });

  assert.equal(adapter.isSupported(), false);

  const res = await adapter.print({
    docType: DOC_TYPES.THERMAL_RECEIPT,
    tenantIdentity: { headerName: 'GOR Test' },
    items: [{ name: 'Item', price: 10000, qty: 1 }],
    summary: { total: 10000 }
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE);
  assert.ok(res.message.includes('tidak mendukung Web Bluetooth API'));
});

test('Phase 4.2.2 - Browser in non-secure context fails with PERMISSION_DENIED', async () => {
  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: false, location: { protocol: 'http:', hostname: '192.168.1.100' } },
    envNavigator: createMockNavigatorBluetooth()
  });

  const res = await adapter.print({
    docType: DOC_TYPES.THERMAL_RECEIPT,
    tenantIdentity: { headerName: 'GOR Test' },
    items: [{ name: 'Item', price: 10000, qty: 1 }],
    summary: { total: 10000 }
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.PERMISSION_DENIED);
  assert.ok(res.message.includes('konteks aman'));
});

test('Phase 4.2.3 - User cancels Web Bluetooth device selection popup', async () => {
  const err = new Error('User cancelled the chooser');
  err.name = 'NotFoundError';

  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: {
      userAgent: 'Chrome/124.0',
      bluetooth: {
        getDevices: async () => [],
        requestDevice: async () => {
          throw err;
        }
      }
    }
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR Test' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { interactive: true }
  );

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.PERMISSION_DENIED);
  assert.ok(res.message.includes('dibatalkan'));
});

test('Phase 4.2.4 - Bluetooth BLE device not found when no device is paired or provided', async () => {
  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(null)
  });

  const res = await adapter.print({
    docType: DOC_TYPES.THERMAL_RECEIPT,
    tenantIdentity: { headerName: 'GOR Test' },
    items: [{ name: 'Item', price: 10000, qty: 1 }],
    summary: { total: 10000 }
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.DEVICE_NOT_FOUND);
});

test('Phase 4.2.5 - Connection fails when GATT server fails to connect', async () => {
  const mockDevice = createMockBleDevice({ throwOnConnect: new Error('GATT Connection Failed') });

  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR Test' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, false);
  assert.ok(res.status === PRINT_EXECUTION_STATUS.TRANSFER_ERROR || res.status === PRINT_EXECUTION_STATUS.FAILED);
});

test('Phase 4.2.6 - Device without primary BLE printer service fails with UNSUPPORTED_DEVICE', async () => {
  const mockDevice = createMockBleDevice({ hasService: false });

  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR Test' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE);
  assert.ok(res.message.includes('tidak memiliki Service atau Characteristic'));
});

test('Phase 4.2.7 - Device without writable BLE characteristic fails with UNSUPPORTED_DEVICE', async () => {
  const mockDevice = createMockBleDevice({ hasWritableChar: false });

  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR Test' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE);
});

test('Phase 4.2.8 - Write with response (writeValueWithResponse) succeeds', async () => {
  const mockDevice = createMockBleDevice({ writeMode: 'withResponse' });

  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'ARENA BLE SPORT CENTER' },
      items: [{ name: 'Sewa Lapangan Futsal 1 Jam', price: 150000, qty: 1, subtotal: 150000 }],
      summary: { total: 150000, amountPaid: 200000, changeAmount: 50000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, true);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.SUCCESS);
  assert.equal(res.gattInfo?.writeMethod, 'writeWithResponse');
  assert.ok(mockDevice._logs.includes('connect'));
  assert.ok(mockDevice._logs.some((l) => l.startsWith('writeValueWithResponse:')));
});

test('Phase 4.2.9 - Write without response (writeValueWithoutResponse) succeeds', async () => {
  const mockDevice = createMockBleDevice({ writeMode: 'withoutResponse' });

  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'POS BLE APPAREL' },
      items: [{ name: 'Jersey Badminton', price: 120000, qty: 1, subtotal: 120000 }],
      summary: { total: 120000, amountPaid: 120000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, true);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.SUCCESS);
  assert.equal(res.gattInfo?.writeMethod, 'writeWithoutResponse');
  assert.ok(mockDevice._logs.some((l) => l.startsWith('writeValueWithoutResponse:')));
});

test('Phase 4.2.10 - Multi-chunk BLE GATT transfer splits payload into 64-byte chunks', async () => {
  const mockDevice = createMockBleDevice();

  const adapter = new BluetoothBLEPrintAdapter({
    chunkSize: 64, // 64-byte BLE payload limit
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const items = Array.from({ length: 12 }, (_, i) => ({
    name: `Minuman Soda Segar Item #${i + 1}`,
    price: 10000,
    qty: 2,
    subtotal: 20000
  }));

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'KANTIN GOR BLE' },
      items,
      summary: { total: 240000, amountPaid: 250000, changeAmount: 10000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, true);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.SUCCESS);
  const writeLogs = mockDevice._logs.filter((l) => l.startsWith('writeValueWithResponse:'));
  assert.ok(writeLogs.length > 2); // Split into multiple chunks
});

test('Phase 4.2.11 - Serialized transfers via Mutex queue execute sequentially without collisions', async () => {
  const mockDevice = createMockBleDevice();
  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const p1 = adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'TENANT A BLE' },
      items: [{ name: 'Item A', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice }
  );

  const p2 = adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'TENANT B BLE' },
      items: [{ name: 'Item B', price: 20000, qty: 1 }],
      summary: { total: 20000 }
    },
    { device: mockDevice }
  );

  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(mockDevice._logs.filter((l) => l === 'connect').length, 2);
});

test('Phase 4.2.12 - Timeout during BLE transfer returns TIMEOUT status without unsafe in-flight cleanup', async () => {
  const mockDevice = createMockBleDevice();
  // Override characteristic write to hang
  const service = await mockDevice._gattServer.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
  const [char] = await service.getCharacteristics();
  char.writeValueWithResponse = async () => {
    mockDevice._logs.push('writeValueWithResponse:hanging');
    return new Promise(() => {}); // Never resolves
  };

  const storage = createMemoryStorage();
  const manager = new PrinterConnectionManager({ storage });

  const adapter = new BluetoothBLEPrintAdapter({
    connectionManager: manager,
    timeoutMs: 40, // 40ms fast timeout
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR BLE TIMEOUT' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.TIMEOUT);
  assert.equal(manager.getState().status, 'DISCONNECTED');
  assert.equal(mockDevice._logs.includes('disconnect'), false); // Unsafe disconnect skipped in-flight
});

test('Phase 4.1.13 & 4.2.13 - Device disconnect during GATT write returns DEVICE_DISCONNECTED and updates manager', async () => {
  const disconnectErr = new Error('GATT Server is disconnected');
  disconnectErr.name = 'NetworkError';

  const mockDevice = createMockBleDevice({ throwOnWrite: disconnectErr });
  const storage = createMemoryStorage();
  const manager = new PrinterConnectionManager({ storage });

  const adapter = new BluetoothBLEPrintAdapter({
    connectionManager: manager,
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR BLE DISCONNECT' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice }
  );

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.DEVICE_DISCONNECTED);
  assert.equal(manager.getState().status, 'DISCONNECTED');
});

test('Phase 4.2.14 & 4.2.16 - Disconnect and safe cleanup in finally block when keepOpen is false', async () => {
  const mockDevice = createMockBleDevice();

  const adapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockDevice)
  });

  await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR BLE CLEANUP' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice, keepOpen: false }
  );

  assert.ok(mockDevice._logs.includes('connect'));
  assert.ok(mockDevice._logs.includes('disconnect'));
  assert.equal(mockDevice._gattServer.connected, false);
});

test('Phase 4.2.15 - Reconnect after disconnection re-establishes GATT server connection', async () => {
  const mockDevice = createMockBleDevice();
  const storage = createMemoryStorage();
  const manager = new PrinterConnectionManager({ storage });

  // Disconnect manager
  manager.handleUnexpectedDisconnect('Koneksi BLE terputus.');
  assert.equal(manager.getState().status, 'DISCONNECTED');

  // Reconnect
  const reconnectRes = await manager.connectPermittedBluetoothDevice(mockDevice);
  assert.equal(reconnectRes.status, 'CONNECTED');
  assert.equal(manager.getState().status, 'CONNECTED');
  assert.equal(manager.getState().directEscPosTransmissionReady, true);
});

test('Phase 4.2.17 & 4.2.18 - Integration with PrintEngine and Browser/System Print fallback', async () => {
  const capturedDocs: any[] = [];
  const mockBrowserAdapter = {
    print: async (doc: any) => {
      capturedDocs.push(doc);
      return {
        ok: true,
        status: PRINT_EXECUTION_STATUS.DIALOG_OPENED,
        adapter: PRINT_ADAPTERS.BROWSER,
        physicalPrintConfirmed: false
      };
    }
  };

  const mockBleDevice = createMockBleDevice();
  const bleAdapter = new BluetoothBLEPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorBluetooth(mockBleDevice)
  });

  const engine = new PrintEngine({
    browserAdapter: mockBrowserAdapter,
    bluetoothBleAdapter: bleAdapter
  });

  // Execute BLE print via PrintEngine
  const bleRes = await engine.printDocument(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'BLE VIA PRINT ENGINE' },
      items: [{ name: 'Item BLE', price: 50000, qty: 1 }],
      summary: { total: 50000 }
    },
    { adapter: PRINT_ADAPTERS.WEB_BLUETOOTH, device: mockBleDevice }
  );

  assert.equal(bleRes.ok, true);
  assert.equal(bleRes.status, PRINT_EXECUTION_STATUS.SUCCESS);

  // Execute Browser Fallback via PrintEngine
  const browserRes = await engine.printDocument(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'FALLBACK BROWSER' },
      items: [{ name: 'Item Browser', price: 50000, qty: 1 }],
      summary: { total: 50000 }
    },
    { adapter: PRINT_ADAPTERS.BROWSER }
  );

  assert.equal(browserRes.ok, true);
  assert.equal(browserRes.status, PRINT_EXECUTION_STATUS.DIALOG_OPENED);
  assert.equal(capturedDocs.length, 1);
  assert.equal(capturedDocs[0].tenantIdentity.headerName, 'FALLBACK BROWSER');
});
