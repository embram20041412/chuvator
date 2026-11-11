import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WebUSBPrintAdapter,
  findPrinterUsbInterfaceAndEndpoint,
  withTimeout
} from '../src/printing/adapters/WebUSBPrintAdapter.js';
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

function createMockUsbDevice(options: any = {}) {
  const isPrinterClass = options.isPrinterClass ?? true;
  const hasOutEndpoint = options.hasOutEndpoint ?? true;
  const transferStatus = options.transferStatus || 'ok';
  const throwOnTransfer = options.throwOnTransfer || null;
  const throwOnOpen = options.throwOnOpen || null;
  const throwOnClaim = options.throwOnClaim || null;

  const logs: string[] = [];

  const endpoints = [];
  if (hasOutEndpoint) {
    endpoints.push({
      direction: 'out',
      type: 'bulk',
      endpointNumber: 1,
      packetSize: 64
    });
  }

  const ifaceClass = isPrinterClass ? 7 : 255;

  const device = {
    vendorId: options.vendorId ?? 0x04b8,
    productId: options.productId ?? 0x0202,
    productName: options.productName || 'Epson TM-T82X',
    manufacturerName: 'EPSON',
    serialNumber: 'EP-001',
    opened: false,
    configurations: [
      {
        configurationValue: 1,
        interfaces: [
          {
            interfaceNumber: 0,
            alternates: [
              {
                alternateSetting: 0,
                interfaceClass: ifaceClass,
                endpoints
              }
            ]
          }
        ]
      }
    ],
    async open() {
      logs.push('open');
      if (throwOnOpen) throw throwOnOpen;
      this.opened = true;
    },
    async close() {
      logs.push('close');
      this.opened = false;
    },
    async selectConfiguration(val: number) {
      logs.push(`selectConfiguration:${val}`);
    },
    async claimInterface(ifaceNo: number) {
      logs.push(`claimInterface:${ifaceNo}`);
      if (throwOnClaim) throw throwOnClaim;
    },
    async releaseInterface(ifaceNo: number) {
      logs.push(`releaseInterface:${ifaceNo}`);
    },
    async transferOut(endpointNo: number, data: Uint8Array) {
      logs.push(`transferOut:${endpointNo}:${data.byteLength}`);
      if (throwOnTransfer) throw throwOnTransfer;
      return {
        status: transferStatus,
        bytesWritten: data.byteLength
      };
    },
    _logs: logs
  };

  return device;
}

function createMockNavigatorUsb(mockDevice: any = null) {
  return {
    userAgent: 'Chrome/124.0',
    usb: {
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

test('Phase 4.1.1 - Browser without WebUSB API fails gracefully with UNSUPPORTED_DEVICE', async () => {
  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: { userAgent: 'Safari/17.0' }
  });

  assert.equal(adapter.isSupported(), false);

  const res = await adapter.print({
    docType: DOC_TYPES.THERMAL_RECEIPT,
    tenantIdentity: { headerName: 'GOR Test' },
    items: [{ name: 'Sewa Lapangan', price: 50000, qty: 1 }],
    summary: { total: 50000 }
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE);
  assert.ok(res.message.includes('tidak mendukung WebUSB API'));
});

test('Phase 4.1.2 - Browser in non-secure context fails with PERMISSION_DENIED', async () => {
  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: false, location: { protocol: 'http:', hostname: '192.168.1.50' } },
    envNavigator: createMockNavigatorUsb()
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

test('Phase 4.1.3 - User cancels WebUSB device selection popup', async () => {
  const err = new Error('No device selected');
  err.name = 'NotFoundError';

  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: {
      userAgent: 'Chrome/124.0',
      usb: {
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

test('Phase 4.1.4 - WebUSB device not found when no device is paired or provided', async () => {
  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(null)
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

test('Phase 4.1.5 - USB device without compatible interface fails with UNSUPPORTED_DEVICE', async () => {
  const mockDevice = createMockUsbDevice({ isPrinterClass: false, hasOutEndpoint: false });

  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(mockDevice)
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
  assert.ok(res.message.includes('tidak memiliki interface printer'));
});

test('Phase 4.1.6 - USB device without OUT endpoint fails with UNSUPPORTED_DEVICE', async () => {
  const mockDevice = createMockUsbDevice({ isPrinterClass: true, hasOutEndpoint: false });
  const info = findPrinterUsbInterfaceAndEndpoint(mockDevice);
  assert.equal(info, null);
});

test('Phase 4.1.7 & 4.1.8 & 4.1.9 - Connection, claim interface, and single chunk transfer success', async () => {
  const mockDevice = createMockUsbDevice();

  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(mockDevice)
  });

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'ARENA SPORT CENTER' },
      items: [{ name: 'Sewa Lapangan Badminton', price: 75000, qty: 1, subtotal: 75000 }],
      summary: { total: 75000, amountPaid: 100000, changeAmount: 25000 }
    },
    { device: mockDevice, chunkSize: 4096 }
  );

  assert.equal(res.ok, true);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.SUCCESS);
  assert.equal(res.physicalPrintConfirmed, false);
  assert.ok(res.bytesWritten! > 0);
  assert.ok(mockDevice._logs.includes('open'));
  assert.ok(mockDevice._logs.includes('claimInterface:0'));
  assert.ok(mockDevice._logs.some((l) => l.startsWith('transferOut:1:')));
  assert.ok(mockDevice._logs.includes('releaseInterface:0'));
  assert.ok(mockDevice._logs.includes('close'));
});

test('Phase 4.1.10 - Multi-chunk transfer splits large ESC/POS payload correctly', async () => {
  const mockDevice = createMockUsbDevice();

  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(mockDevice)
  });

  const items = Array.from({ length: 15 }, (_, i) => ({
    name: `Produk Makanan Minuman Kasir Item #${i + 1}`,
    price: 15000,
    qty: 2,
    subtotal: 30000
  }));

  const res = await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'SUPERMARKET SPORT CENTER' },
      items,
      summary: { total: 450000, amountPaid: 500000, changeAmount: 50000 }
    },
    { device: mockDevice, chunkSize: 128 } // Force small 128-byte chunks
  );

  assert.equal(res.ok, true);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.SUCCESS);
  const transferLogs = mockDevice._logs.filter((l) => l.startsWith('transferOut:1:'));
  assert.ok(transferLogs.length > 2); // Multi-chunk executed
});

test('Phase 4.1.11 - Transfer error from USB endpoint returns TRANSFER_ERROR', async () => {
  const mockDevice = createMockUsbDevice({ transferStatus: 'stall' });

  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(mockDevice)
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
  assert.equal(res.status, PRINT_EXECUTION_STATUS.TRANSFER_ERROR);
  assert.ok(res.message.includes('stall'));
});

test('Phase 4.1.12 - Unexpected disconnection during transfer returns DEVICE_DISCONNECTED and notifies manager', async () => {
  const disconnectErr = new Error('The device was disconnected');
  disconnectErr.name = 'DeviceDisconnectedError';

  const mockDevice = createMockUsbDevice({ throwOnTransfer: disconnectErr });
  const storage = createMemoryStorage();
  const manager = new PrinterConnectionManager({ storage });

  const adapter = new WebUSBPrintAdapter({
    connectionManager: manager,
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(mockDevice)
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
  assert.equal(res.status, PRINT_EXECUTION_STATUS.DEVICE_DISCONNECTED);
  assert.equal(manager.getState().status, 'DISCONNECTED');
  assert.ok(manager.getState().errorMessage?.includes('terputus'));
});

test('Phase 4.1.13 - Interface release and connection close cleanup always execute in finally block', async () => {
  const mockDevice = createMockUsbDevice({ transferStatus: 'stall' });

  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(mockDevice)
  });

  await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'GOR Test' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { device: mockDevice }
  );

  assert.ok(mockDevice._logs.includes('releaseInterface:0'));
  assert.ok(mockDevice._logs.includes('close'));
  assert.equal(mockDevice.opened, false);
});

test('Phase 4.1.14 - Fallback to Browser/System Print via PrintEngine when WebUSB unavailable or requested', async () => {
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

  const engine = new PrintEngine({ browserAdapter: mockBrowserAdapter });

  const res = await engine.printDocument(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'FALLBACK GOR' },
      items: [{ name: 'Item', price: 10000, qty: 1 }],
      summary: { total: 10000 }
    },
    { adapter: PRINT_ADAPTERS.BROWSER }
  );

  assert.equal(res.ok, true);
  assert.equal(res.status, PRINT_EXECUTION_STATUS.DIALOG_OPENED);
  assert.equal(capturedDocs.length, 1);
  assert.equal(capturedDocs[0].tenantIdentity.headerName, 'FALLBACK GOR');
});

test('Phase 4.1.15 - Multi-tenant switching preserves WebUSB adapter capabilities without leaking tenant identity', async () => {
  const mockDevice = createMockUsbDevice();

  const adapter = new WebUSBPrintAdapter({
    envWindow: { isSecureContext: true, location: { protocol: 'https:' } },
    envNavigator: createMockNavigatorUsb(mockDevice)
  });

  // Print Tenant A
  await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'AKADEMI SEPAK BOLA UTAMA' },
      items: [{ name: 'SPP Bulan Nopember', price: 250000, qty: 1 }],
      summary: { total: 250000 }
    },
    { device: mockDevice }
  );

  // Print Tenant B
  await adapter.print(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: { headerName: 'ARENA BADMINTON BERSAMA' },
      items: [{ name: 'Sewa Lapangan 2 Jam', price: 120000, qty: 1 }],
      summary: { total: 120000 }
    },
    { device: mockDevice }
  );

  assert.equal(mockDevice._logs.filter((l) => l === 'open').length, 2);
  assert.equal(mockDevice._logs.filter((l) => l === 'close').length, 2);
});
