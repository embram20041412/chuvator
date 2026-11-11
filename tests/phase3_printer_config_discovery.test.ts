import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKSTATION_PRINTER_CONFIG_KEY,
  USER_PRINT_PREFS_PREFIX,
  DEFAULT_WORKSTATION_PRINTER_CONFIG,
  sanitizeWorkstationPrinterConfig,
  loadWorkstationPrinterConfig,
  saveWorkstationPrinterConfig,
  resetWorkstationPrinterConfig,
  isSuperuserPlatformRole,
  loadUserPrintPreferences,
  saveUserPrintPreferences
} from '../src/printing/config/PrinterConfiguration.js';

import {
  detectPrintingCapabilities,
  getPermittedUsbDevices,
  getPermittedBluetoothDevices
} from '../src/printing/hardware/PrinterDiscovery.js';

import {
  PrinterConnectionManager
} from '../src/printing/hardware/PrinterConnectionManager.js';

import {
  DOC_TYPES,
  PRINT_ADAPTERS
} from '../src/printing/types/printTypes.js';

import {
  PrintEngine
} from '../src/printing/core/PrintEngine.js';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, val: string) {
      store.set(key, String(val));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    dump() {
      return Object.fromEntries(store.entries());
    }
  };
}

test('Phase 3.1 - Save & load workstation printer configuration from localStorage', () => {
  const storage = createMemoryStorage();

  const initialRes = loadWorkstationPrinterConfig({ storage });
  assert.equal(initialRes.isDefault, true);
  assert.equal(initialRes.config.preferredAdapter, 'browser');
  assert.equal(initialRes.config.receiptPaperSize, '80mm');
  assert.equal(initialRes.config.documentPaperSize, 'A4');
  assert.equal(initialRes.config.preferredDocumentOrientation, 'portrait');
  assert.equal(initialRes.config.autoPrintAfterCheckout, false);

  const savedRes = saveWorkstationPrinterConfig(
    {
      preferredAdapter: 'webusb',
      receiptPaperSize: '58mm',
      documentPaperSize: 'A5',
      preferredDocumentOrientation: 'landscape',
      autoPrintAfterCheckout: true,
      printerDisplayName: 'Epson TM-T82X Kasir 1',
      pairedDeviceMetadata: {
        transport: 'webusb',
        vendorId: 0x04b8,
        productId: 0x0202,
        productName: 'TM-T82X'
      }
    },
    { storage }
  );

  assert.equal(savedRes.ok, true);
  assert.equal(savedRes.config.preferredAdapter, 'webusb');
  assert.equal(savedRes.config.receiptPaperSize, '58mm');
  assert.equal(savedRes.config.documentPaperSize, 'A5');
  assert.equal(savedRes.config.preferredDocumentOrientation, 'landscape');
  assert.equal(savedRes.config.autoPrintAfterCheckout, true);
  assert.equal(savedRes.config.printerDisplayName, 'Epson TM-T82X Kasir 1');
  assert.equal(savedRes.config.pairedDeviceMetadata?.vendorId, 0x04b8);

  const reloadedRes = loadWorkstationPrinterConfig({ storage });
  assert.equal(reloadedRes.isDefault, false);
  assert.deepEqual(reloadedRes.config, savedRes.config);
});

test('Phase 3.2 - Corrupted JSON in localStorage self-heals to default configuration without throwing', () => {
  const storage = createMemoryStorage({
    [WORKSTATION_PRINTER_CONFIG_KEY]: '{corrupted_json: true, "receiptPaperSize": 58mm'
  });

  const recoveredRes = loadWorkstationPrinterConfig({ storage });
  assert.equal(recoveredRes.wasCorrupted, true);
  assert.equal(recoveredRes.config.preferredAdapter, DEFAULT_WORKSTATION_PRINTER_CONFIG.preferredAdapter);
  assert.equal(recoveredRes.config.receiptPaperSize, DEFAULT_WORKSTATION_PRINTER_CONFIG.receiptPaperSize);
  assert.equal(recoveredRes.config.documentPaperSize, DEFAULT_WORKSTATION_PRINTER_CONFIG.documentPaperSize);

  // Corrupted key was cleaned up
  assert.equal(storage.getItem(WORKSTATION_PRINTER_CONFIG_KEY), null);
});

test('Phase 3.3 - Unavailable or throwing localStorage falls back gracefully to in-memory config', () => {
  const throwingStorage = {
    getItem() {
      throw new Error('QuotaExceeded or Private Browsing blocked');
    },
    setItem() {
      throw new Error('QuotaExceeded or Private Browsing blocked');
    },
    removeItem() {
      throw new Error('QuotaExceeded or Private Browsing blocked');
    }
  };

  resetWorkstationPrinterConfig({ storage: throwingStorage });

  const updatedRes = saveWorkstationPrinterConfig(
    {
      receiptPaperSize: '58mm',
      documentPaperSize: 'A5',
      printerDisplayName: 'Mobile Kasir Printer'
    },
    { storage: throwingStorage }
  );

  assert.equal(updatedRes.ok, true);
  assert.equal(updatedRes.isPersistent, false);
  assert.equal(updatedRes.config.receiptPaperSize, '58mm');
  assert.equal(updatedRes.config.documentPaperSize, 'A5');

  // Verify in-memory fallback when no custom storage is available
  const memLoad = loadWorkstationPrinterConfig({ storage: null });
  assert.equal(memLoad.config.receiptPaperSize, '58mm');
  assert.equal(memLoad.config.printerDisplayName, 'Mobile Kasir Printer');
});

test('Phase 3.4 - Strict separation between workstation config, tenant identity, and user preferences + Superuser guard', () => {
  const storage = createMemoryStorage();

  // Attempt to inject tenant identity & sensitive tokens into workstation printer config
  const maliciousPayload = {
    preferredAdapter: 'browser',
    receiptPaperSize: '58mm',
    tenantId: 'tenant-123',
    receiptHeaderName: 'GOR Hacked Name',
    receiptAddress: 'Jl. Rahasia',
    bankAccounts: [{ bankName: 'BCA', accountNumber: '111' }],
    accessToken: 'secret-jwt-token',
    pairedDeviceMetadata: {
      transport: 'webbluetooth',
      deviceName: 'RPP02N',
      secretKey: 'should-not-exist'
    }
  };

  const sanitized = sanitizeWorkstationPrinterConfig(maliciousPayload);
  assert.equal('tenantId' in sanitized, false);
  assert.equal('receiptHeaderName' in sanitized, false);
  assert.equal('receiptAddress' in sanitized, false);
  assert.equal('bankAccounts' in sanitized, false);
  assert.equal('accessToken' in sanitized, false);
  assert.equal('secretKey' in (sanitized.pairedDeviceMetadata || {}), false);
  assert.equal(sanitized.pairedDeviceMetadata?.name, 'RPP02N');

  // Superuser role detection
  assert.equal(isSuperuserPlatformRole({ role: 'superuser' }), true);
  assert.equal(isSuperuserPlatformRole({ role: 'superadmin' }), true);
  assert.equal(isSuperuserPlatformRole({ role: 'platform_owner' }), true);
  assert.equal(isSuperuserPlatformRole({ role: 'owner', tenantId: 'tenant-1' }), false);

  // Superuser without tenant cannot save workstation or tenant print preferences
  const superuserWsSave = saveWorkstationPrinterConfig(
    { receiptPaperSize: '58mm' },
    { storage, userProfile: { id: 'su-1', role: 'superuser' } }
  );
  assert.equal(superuserWsSave.ok, false);
  assert.equal(superuserWsSave.reason, 'SUPERUSER_NO_PHYSICAL_PRINTER_SCOPE');

  const superuserPrefs = saveUserPrintPreferences(
    'tenant-A',
    'su-1',
    { defaultReceiptFormat: 'OFFICIAL_RECEIPT_A5' },
    { storage, userProfile: { id: 'su-1', role: 'superuser' } }
  );
  assert.equal(superuserPrefs.ok, false);

  // Regular tenant staff can save isolated preferences per tenant
  const staffUser = { id: 'user-99', role: 'admin', tenantId: 'tenant-A' };
  const prefsTenantA = saveUserPrintPreferences(
    'tenant-A',
    'user-99',
    { defaultReceiptFormat: 'OFFICIAL_RECEIPT_A5', autoOpenPreviewAfterCheckout: false },
    { storage, userProfile: staffUser }
  );
  assert.equal(prefsTenantA.ok, true);
  assert.equal(prefsTenantA.prefs.defaultReceiptFormat, 'OFFICIAL_RECEIPT_A5');

  const prefsTenantB = loadUserPrintPreferences('tenant-B', 'user-99', { storage });
  assert.equal(prefsTenantB.defaultReceiptFormat, 'THERMAL_RECEIPT'); // Remains default in Tenant B
  assert.ok(storage.getItem(`${USER_PRINT_PREFS_PREFIX}_tenant-A_user-99`));
});

test('Phase 3.5 - Multi-tenant switching on shared workstation preserves hardware config while switching receipt identity', () => {
  const storage = createMemoryStorage();
  const engine = new PrintEngine();

  // Workstation configured for 58mm thermal paper
  saveWorkstationPrinterConfig(
    {
      preferredAdapter: 'browser',
      receiptPaperSize: '58mm',
      documentPaperSize: 'A5',
      printerDisplayName: 'Kasir Lobby Utama'
    },
    { storage }
  );

  const wsConfig = loadWorkstationPrinterConfig({ storage }).config;

  const tenantA = {
    name: 'GOR Bintang Jaya',
    receiptHeaderName: 'GOR BINTANG JAYA SURABAYA',
    receiptAddress: 'Jl. Dharmawangsa No. 10',
    receiptContact: '0811-1111-2222',
    receiptFooterNote: 'Terima kasih dari Bintang Jaya',
    bankAccounts: [{ bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'PT Bintang Jaya' }]
  };

  const tenantB = {
    name: 'Akademi Putra Mandiri',
    receiptHeaderName: 'AKADEMI PUTRA MANDIRI',
    receiptAddress: 'Jl. Pemuda No. 99',
    receiptContact: '0822-9999-8888',
    receiptFooterNote: 'Salam Olahraga Putra Mandiri',
    bankAccounts: [{ bankName: 'Mandiri', accountNumber: '9988776655', accountHolder: 'Yayasan Putra Mandiri' }]
  };

  const payloadA = engine.buildPrintPayload(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: tenantA,
      meta: { transactionCode: 'POS-A01', cashierName: 'Kasir 1', sourceModule: 'POS' },
      items: [{ name: 'Air Mineral', qty: 1, unitPrice: 5000, subtotal: 5000 }],
      summary: { grandTotal: 5000, amountPaid: 5000 }
    },
    { paperSize: wsConfig.receiptPaperSize }
  );

  const payloadB = engine.buildPrintPayload(
    {
      docType: DOC_TYPES.THERMAL_RECEIPT,
      tenantIdentity: tenantB,
      meta: { transactionCode: 'POS-B01', cashierName: 'Kasir 1', sourceModule: 'POS' },
      items: [{ name: 'Air Mineral', qty: 1, unitPrice: 5000, subtotal: 5000 }],
      summary: { grandTotal: 5000, amountPaid: 5000 }
    },
    { paperSize: wsConfig.receiptPaperSize }
  );

  // Both use workstation's 58mm setting
  assert.equal(payloadA.normalizedDoc.paper.size, '58mm');
  assert.equal(payloadB.normalizedDoc.paper.size, '58mm');

  // Neither leaks the other tenant's identity
  const htmlA = payloadA.htmlContent;
  const htmlB = payloadB.htmlContent;

  assert.ok(htmlA.includes('GOR BINTANG JAYA SURABAYA'));
  assert.ok(!htmlA.includes('AKADEMI PUTRA MANDIRI'));

  assert.ok(htmlB.includes('AKADEMI PUTRA MANDIRI'));
  assert.ok(!htmlB.includes('GOR BINTANG JAYA SURABAYA'));
});

test('Phase 3.6 - Browser capability detection & USB/Bluetooth discovery helpers', async () => {
  // Non-secure context
  const insecureCaps = detectPrintingCapabilities(
    { isSecureContext: false, print: () => {}, location: { protocol: 'http:', hostname: '192.168.1.20' } },
    { userAgent: 'Mozilla/5.0 Chrome/122.0' }
  );
  assert.equal(insecureCaps.secureContext.isSecure, false);
  assert.equal(insecureCaps.webUsb.supported, false);
  assert.equal(insecureCaps.webBluetooth.supported, false);
  assert.equal(insecureCaps.browserPrint.supported, true);
  assert.equal(insecureCaps.browserPrint.canEnumerateOsPrinters, false);

  // Secure context with WebUSB and Web Bluetooth
  const mockUsbDevice = {
    vendorId: 0x0483,
    productId: 0x5740,
    productName: 'POS-80 Thermal',
    manufacturerName: 'Xprinter',
    serialNumber: 'XP-001',
    opened: false
  };
  const mockBtDevice = {
    id: 'bt-id-99',
    name: 'RPP02N-BLE',
    gatt: { connected: false }
  };

  const secureWindow = {
    isSecureContext: true,
    print: () => {},
    location: { protocol: 'https:', hostname: 'app.chuvator.com' }
  };
  const secureNavigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
    usb: {
      getDevices: async () => [mockUsbDevice],
      requestDevice: async () => mockUsbDevice
    },
    bluetooth: {
      getDevices: async () => [mockBtDevice],
      requestDevice: async () => mockBtDevice
    }
  };

  const secureCaps = detectPrintingCapabilities(secureWindow, secureNavigator);
  assert.equal(secureCaps.secureContext.isSecure, true);
  assert.equal(secureCaps.webUsb.supported, true);
  assert.equal(secureCaps.webBluetooth.supported, true);
  assert.equal(secureCaps.webBluetooth.classicSppSupported, false);
  assert.equal(secureCaps.browserPrint.canEnumerateOsPrinters, false);

  const permittedUsb = await getPermittedUsbDevices(secureNavigator);
  assert.equal(permittedUsb.length, 1);
  assert.equal(permittedUsb[0].metadata?.name, 'POS-80 Thermal');

  const permittedBt = await getPermittedBluetoothDevices(secureNavigator);
  assert.equal(permittedBt.length, 1);
  assert.equal(permittedBt[0].metadata?.name, 'RPP02N-BLE');
});

test('Phase 3.7 - PrinterConnectionManager state transitions (DISCONNECTED, CONNECTING, CONNECTED, ERROR)', async () => {
  const storage = createMemoryStorage();
  const observedStates: string[] = [];

  const mockUsbDevice = {
    vendorId: 0x04b8,
    productId: 0x0e15,
    productName: 'TM-T20II',
    manufacturerName: 'EPSON',
    opened: false,
    open: async function () {
      this.opened = true;
    },
    close: async function () {
      this.opened = false;
    }
  };

  const envWindow = {
    isSecureContext: true,
    print: () => {},
    location: { protocol: 'https:', hostname: 'localhost' }
  };
  const envNavigator = {
    userAgent: 'Chrome/124.0',
    usb: {
      getDevices: async () => [mockUsbDevice],
      requestDevice: async () => mockUsbDevice
    }
  };

  const manager = new PrinterConnectionManager({ storage, envWindow, envNavigator });
  const unsub = manager.subscribe((snap) => {
    observedStates.push(snap.status);
  });

  assert.equal(manager.getState().status, 'DISCONNECTED');

  const connectRes = await manager.pairAndConnectUsb();
  assert.equal(connectRes.status, 'CONNECTED');
  assert.equal(manager.getState().status, 'CONNECTED');
  assert.equal(manager.getState().directEscPosTransmissionReady, false);
  assert.ok(observedStates.includes('CONNECTING'));
  assert.ok(observedStates.includes('CONNECTED'));

  // Unexpected hardware unplug
  manager.handleUnexpectedDisconnect('Kabel USB dicabut');
  assert.equal(manager.getState().status, 'DISCONNECTED');
  assert.ok(manager.getState().errorMessage?.includes('Kabel USB dicabut'));

  // Reconnect and explicit disconnect
  await manager.pairAndConnectUsb();
  assert.equal(manager.getState().status, 'CONNECTED');
  await manager.disconnect();
  assert.equal(manager.getState().status, 'DISCONNECTED');

  unsub();
});

test('Phase 3.8 - Test Print execution via PrintEngine and BrowserPrintAdapter for 58mm, 80mm, A5, and A4', async () => {
  const capturedDocs: Array<{ paperSize: string; orientation: string; headerName: string }> = [];

  const engine = new PrintEngine();
  engine.registerAdapter(PRINT_ADAPTERS.BROWSER, {
    print: async (normalizedDoc: any) => {
      capturedDocs.push({
        paperSize: normalizedDoc.paper.size,
        orientation: normalizedDoc.paper.orientation,
        headerName: normalizedDoc.tenantIdentity.headerName
      });
      return {
        ok: true,
        status: 'DIALOG_OPENED',
        adapter: PRINT_ADAPTERS.BROWSER,
        physicalPrintConfirmed: false,
        paper: normalizedDoc.paper
      };
    }
  });

  const tenant = {
    receiptHeaderName: 'ARENA SPORT CENTER',
    receiptAddress: 'Jl. Stadion No. 1',
    receiptContact: '0812-0000-1111',
    receiptFooterNote: 'Struk Uji Coba Konfigurasi Printer'
  };

  const testCases = [
    { size: '58mm', orientation: 'portrait', docType: DOC_TYPES.THERMAL_RECEIPT },
    { size: '80mm', orientation: 'portrait', docType: DOC_TYPES.THERMAL_RECEIPT },
    { size: 'a5', orientation: 'landscape', docType: DOC_TYPES.OFFICIAL_RECEIPT_A5 },
    { size: 'a4', orientation: 'portrait', docType: DOC_TYPES.B2B_INVOICE_A4 }
  ];

  for (const tc of testCases) {
    const res = await engine.printDocument(
      {
        docType: tc.docType,
        tenantIdentity: tenant,
        meta: {
          transactionCode: `TEST-${tc.size.toUpperCase()}`,
          cashierName: 'Admin Workstation',
          customerName: 'Test Print Verification',
          paymentMethod: 'TUNAI',
          paymentStatus: 'LUNAS',
          sourceModule: 'PRINTER_TEST'
        },
        items: [{ name: `Tes Kertas ${tc.size.toUpperCase()}`, qty: 1, unitPrice: 10000, subtotal: 10000 }],
        summary: { subtotal: 10000, grandTotal: 10000, amountPaid: 10000, changeAmount: 0 }
      },
      {
        adapter: PRINT_ADAPTERS.BROWSER,
        paperSize: tc.size,
        orientation: tc.orientation
      }
    );

    assert.equal(res.ok, true);
    assert.equal(res.physicalPrintConfirmed, false);
  }

  assert.equal(capturedDocs.length, 4);
  assert.equal(capturedDocs[0].paperSize, '58mm');
  assert.equal(capturedDocs[1].paperSize, '80mm');
  assert.equal(capturedDocs[2].paperSize, 'a5');
  assert.equal(capturedDocs[2].orientation, 'landscape');
  assert.equal(capturedDocs[3].paperSize, 'a4');
  assert.equal(capturedDocs[3].headerName, 'ARENA SPORT CENTER');
});
