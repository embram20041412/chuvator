import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  Usb,
  Bluetooth,
  Globe,
  Server,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Save,
  Unplug,
  FileText,
  Receipt,
  Info,
  Eye
} from 'lucide-react';
import { DOC_TYPES, PRINT_ADAPTERS } from '../types/printTypes.js';
import {
  CONNECTION_STATUS,
  isSuperuserPlatformRole,
  loadWorkstationPrinterConfig,
  saveWorkstationPrinterConfig,
  loadUserPrintPreferences,
  saveUserPrintPreferences
} from '../config/PrinterConfiguration.js';
import {
  detectPrintingCapabilities,
  getPermittedUsbDevices,
  getPermittedBluetoothDevices
} from '../hardware/PrinterDiscovery.js';
import { defaultPrinterConnectionManager } from '../hardware/PrinterConnectionManager.js';
import { defaultPrintEngine } from '../core/PrintEngine.js';
import ReceiptPreviewModal from './ReceiptPreviewModal.jsx';

/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 3: PrinterSettingsPanel
 *
 * Workstation printer configuration, capability discovery, USB/BLE pairing,
 * connection status monitor, and Test Print (Thermal 58mm/80mm & Inkjet/Ink Tank A4/A5).
 * Strictly separates local workstation hardware configuration from active tenant receipt identity.
 */
export default function PrinterSettingsPanel({
  userProfile = null,
  tenantProfile = null,
  liveReceiptIdentity = null,
  connectionManager = defaultPrinterConnectionManager,
  printEngine = defaultPrintEngine
}) {
  // Resolve tenantId and userId for isolated user operational preferences
  const activeTenantId =
    tenantProfile?.id ||
    userProfile?.tenant?.id ||
    userProfile?.tenantId ||
    userProfile?.tenant?.tenant_id ||
    null;
  const activeUserId = userProfile?.id || userProfile?.uid || userProfile?.email || 'anonymous';
  const isSuperuserWithoutTenant = isSuperuserPlatformRole(userProfile);

  // Load initial workstation configuration and user preferences
  const initialWorkstation = useMemo(() => loadWorkstationPrinterConfig(), []);
  const initialUserPrefs = useMemo(
    () => loadUserPrintPreferences(activeTenantId, activeUserId),
    [activeTenantId, activeUserId]
  );

  // Workstation Hardware Configuration States
  const [preferredAdapter, setPreferredAdapter] = useState(
    initialWorkstation.config.preferredAdapter
  );
  const [receiptPaperSize, setReceiptPaperSize] = useState(
    initialWorkstation.config.receiptPaperSize
  );
  const [documentPaperSize, setDocumentPaperSize] = useState(
    initialWorkstation.config.documentPaperSize
  );
  const [preferredDocumentOrientation, setPreferredDocumentOrientation] = useState(
    initialWorkstation.config.preferredDocumentOrientation
  );
  const [autoPrintAfterCheckout, setAutoPrintAfterCheckout] = useState(
    initialWorkstation.config.autoPrintAfterCheckout
  );
  const [printerDisplayName, setPrinterDisplayName] = useState(
    initialWorkstation.config.printerDisplayName
  );
  const [pairedDeviceMetadata, setPairedDeviceMetadata] = useState(
    initialWorkstation.config.pairedDeviceMetadata
  );

  // Per-Tenant User Operational Preference States
  const [autoOpenPreviewAfterCheckout, setAutoOpenPreviewAfterCheckout] = useState(
    initialUserPrefs.autoOpenPreviewAfterCheckout
  );

  // Discovery & Connection States
  const [capabilities, setCapabilities] = useState(() => detectPrintingCapabilities());
  const [connectionState, setConnectionState] = useState(() => connectionManager.getState());
  const [permittedUsbList, setPermittedUsbList] = useState([]);
  const [permittedBleList, setPermittedBleList] = useState([]);
  const [feedbackNotice, setFeedbackNotice] = useState(null);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [previewTestDoc, setPreviewTestDoc] = useState(null);

  // Refresh per-tenant user preferences when activeTenantId or activeUserId changes
  useEffect(() => {
    const loadedPrefs = loadUserPrintPreferences(activeTenantId, activeUserId);
    setAutoOpenPreviewAfterCheckout(loadedPrefs.autoOpenPreviewAfterCheckout);
  }, [activeTenantId, activeUserId]);

  // Subscribe to PrinterConnectionManager state transitions
  useEffect(() => {
    const unsubscribe = connectionManager.subscribe((nextState) => {
      setConnectionState(nextState);
      if (nextState.deviceMetadata) {
        setPairedDeviceMetadata(nextState.deviceMetadata);
      }
      if (nextState.printerDisplayName) {
        setPrinterDisplayName(nextState.printerDisplayName);
      }
    });
    return unsubscribe;
  }, [connectionManager]);

  // Refresh capabilities and previously authorized USB/BLE devices
  const refreshHardwareDiscovery = useCallback(async () => {
    setCapabilities(detectPrintingCapabilities());
    const [usbDevices, bleDevices] = await Promise.all([
      getPermittedUsbDevices(),
      getPermittedBluetoothDevices()
    ]);
    setPermittedUsbList(usbDevices);
    setPermittedBleList(bleDevices);
  }, []);

  useEffect(() => {
    refreshHardwareDiscovery();
  }, [refreshHardwareDiscovery]);

  // Build effective tenant identity dynamically from live form edits or active tenant profile
  const effectiveTenantProfile = useMemo(() => {
    const base = tenantProfile || userProfile?.tenant || {};
    if (!liveReceiptIdentity) return base;
    return {
      ...base,
      receiptHeaderName:
        liveReceiptIdentity.receiptHeaderName !== undefined
          ? liveReceiptIdentity.receiptHeaderName
          : base.receiptHeaderName,
      receiptAddress:
        liveReceiptIdentity.receiptAddress !== undefined
          ? liveReceiptIdentity.receiptAddress
          : base.receiptAddress,
      receiptContact:
        liveReceiptIdentity.receiptContact !== undefined
          ? liveReceiptIdentity.receiptContact
          : base.receiptContact,
      receiptFooterNote:
        liveReceiptIdentity.receiptFooterNote !== undefined
          ? liveReceiptIdentity.receiptFooterNote
          : base.receiptFooterNote
    };
  }, [tenantProfile, userProfile, liveReceiptIdentity]);

  // Save Workstation Printer Configuration + User Per-Tenant Preferences
  const handleSavePrinterConfiguration = () => {
    setFeedbackNotice(null);

    const wsResult = saveWorkstationPrinterConfig(
      {
        preferredAdapter,
        receiptPaperSize,
        documentPaperSize,
        preferredDocumentOrientation,
        autoPrintAfterCheckout,
        pairedDeviceMetadata,
        printerDisplayName:
          preferredAdapter === PRINT_ADAPTERS.BROWSER
            ? 'Browser / System Print'
            : pairedDeviceMetadata?.name || printerDisplayName,
        lastConnectionStatus: connectionState.status
      },
      { userProfile }
    );

    if (!wsResult.ok) {
      setFeedbackNotice({
        type: 'error',
        text: wsResult.message || 'Gagal menyimpan konfigurasi printer workstation.'
      });
      return;
    }

    if (activeTenantId) {
      saveUserPrintPreferences(
        activeTenantId,
        activeUserId,
        { autoOpenPreviewAfterCheckout },
        { userProfile }
      );
    }

    setFeedbackNotice({
      type: 'success',
      text: `Konfigurasi printer perangkat lokal berhasil disimpan (${wsResult.config.receiptPaperSize} Thermal & ${wsResult.config.documentPaperSize} ${wsResult.config.preferredDocumentOrientation}). Identitas struk tetap terisolasi mengikuti tenant aktif.`
    });
  };

  // Handle explicit USB pairing via user gesture
  const handlePairUsbPrinter = async () => {
    setFeedbackNotice(null);
    const nextState = await connectionManager.pairAndConnectUsb();
    await refreshHardwareDiscovery();
    if (nextState.status === CONNECTION_STATUS.CONNECTED) {
      setPreferredAdapter(PRINT_ADAPTERS.WEB_USB);
      setFeedbackNotice({
        type: 'info',
        text: nextState.statusMessage
      });
    } else if (nextState.errorMessage) {
      setFeedbackNotice({
        type: 'error',
        text: nextState.errorMessage
      });
    }
  };

  // Handle explicit Bluetooth BLE pairing via user gesture
  const handlePairBluetoothPrinter = async () => {
    setFeedbackNotice(null);
    const nextState = await connectionManager.pairAndConnectBluetooth();
    await refreshHardwareDiscovery();
    if (nextState.status === CONNECTION_STATUS.CONNECTED) {
      setPreferredAdapter(PRINT_ADAPTERS.WEB_BLUETOOTH);
      setFeedbackNotice({
        type: 'info',
        text: nextState.statusMessage
      });
    } else if (nextState.errorMessage) {
      setFeedbackNotice({
        type: 'error',
        text: nextState.errorMessage
      });
    }
  };

  // Handle explicit Local Print Bridge connection
  const handleConnectBridgePrinter = async () => {
    setFeedbackNotice(null);
    const nextState = await connectionManager.pairAndConnectLocalBridge({
      bridgeUrl: 'http://127.0.0.1:9123',
      printerDisplayName: 'Local Print Bridge (Bluetooth Classic SPP / USB OS)'
    });
    await refreshHardwareDiscovery();
    if (nextState.status === CONNECTION_STATUS.CONNECTED) {
      setPreferredAdapter(PRINT_ADAPTERS.LOCAL_BRIDGE);
      setFeedbackNotice({
        type: 'info',
        text: nextState.statusMessage
      });
    } else if (nextState.errorMessage) {
      setFeedbackNotice({
        type: 'error',
        text: nextState.errorMessage
      });
    }
  };

  // Disconnect currently paired/connected device
  const handleDisconnectPrinter = async () => {
    const nextState = await connectionManager.disconnect();
    setFeedbackNotice({
      type: 'info',
      text: nextState.statusMessage
    });
  };

  // Build Test Print Payload (Thermal or A4/A5 Document) using active tenant identity
  const createTestPrintPayload = (mode = 'THERMAL') => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (mode === 'DOCUMENT') {
      const paperPresetId = `${documentPaperSize}_${preferredDocumentOrientation.toUpperCase()}`;
      return {
        rawPayload: {
          docType:
            documentPaperSize === 'A5'
              ? DOC_TYPES.OFFICIAL_RECEIPT_A5
              : DOC_TYPES.B2B_INVOICE_A4,
          receiptNo: `TEST-DOC-${documentPaperSize}-${now.getTime().toString().slice(-4)}`,
          date: dateStr,
          time: timeStr,
          cashierName: userProfile?.displayName || userProfile?.name || 'Administrator',
          customerName: 'Uji Cetak Dokumen Inkjet / Ink Tank',
          customerSubInfo: `Format Kertas: ${documentPaperSize} (${preferredDocumentOrientation})`,
          items: [
            {
              name: `Halaman Uji Cetak Dokumen (${documentPaperSize})`,
              description: 'Verifikasi margin halaman, tabel, dan identitas tenant aktif',
              qty: 1,
              unitPrice: 150000,
              subtotal: 150000
            }
          ],
          total: 150000,
          paymentMethod: 'Browser / System Print',
          status: 'TEST PRINT',
          notes: 'Dokumen ini adalah halaman uji cetak (Test Print) dan bukan transaksi keuangan.'
        },
        options: {
          docType:
            documentPaperSize === 'A5'
              ? DOC_TYPES.OFFICIAL_RECEIPT_A5
              : DOC_TYPES.B2B_INVOICE_A4,
          paper: paperPresetId,
          tenantProfile: effectiveTenantProfile,
          userProfile
        }
      };
    }

    // Default: Thermal Test Print (58mm / 32-col or 80mm / 48-col)
    return {
      rawPayload: {
        docType: DOC_TYPES.THERMAL_RECEIPT,
        receiptNo: `TEST-${receiptPaperSize.toUpperCase()}-${now.getTime().toString().slice(-4)}`,
        date: dateStr,
        time: timeStr,
        cashierName: userProfile?.displayName || userProfile?.name || 'Kasir / Admin',
        customerName: 'Uji Cetak Printer Thermal',
        items: [
          {
            name: `Uji Cetak Kertas Thermal ${receiptPaperSize}`,
            description:
              receiptPaperSize === '58mm'
                ? 'Validasi lebar 32 kolom karakter'
                : 'Validasi lebar 48 kolom karakter',
            qty: 1,
            unitPrice: 100000,
            subtotal: 100000
          },
          {
            name: 'Air Mineral Botol 600ml',
            qty: 2,
            unitPrice: 5000,
            subtotal: 10000
          }
        ],
        total: 110000,
        paymentMethod: 'Tunai (Cash)',
        amountPaid: 120000,
        changeAmount: 10000,
        status: 'TEST PRINT',
        notes: 'Struk uji cetak workstation lokal (Bukan transaksi keuangan).'
      },
      options: {
        docType: DOC_TYPES.THERMAL_RECEIPT,
        paper: receiptPaperSize,
        tenantProfile: effectiveTenantProfile,
        userProfile
      }
    };
  };

  // Execute Test Print via PrintEngine & selected adapter (WebUSB or BrowserPrintAdapter)
  const handleRunTestPrint = async (mode = 'THERMAL') => {
    if (isTestingPrint) return;
    setIsTestingPrint(true);
    setFeedbackNotice(null);

    try {
      const targetAdapter =
        preferredAdapter === PRINT_ADAPTERS.WEB_USB
          ? PRINT_ADAPTERS.WEB_USB
          : preferredAdapter === PRINT_ADAPTERS.WEB_BLUETOOTH
          ? PRINT_ADAPTERS.WEB_BLUETOOTH
          : preferredAdapter === PRINT_ADAPTERS.LOCAL_BRIDGE
          ? PRINT_ADAPTERS.LOCAL_BRIDGE
          : PRINT_ADAPTERS.BROWSER;

      const { rawPayload, options } = createTestPrintPayload(mode);

      const res = await printEngine.printDocument(rawPayload, {
        ...options,
        adapter: targetAdapter
      });

      setFeedbackNotice({
        type: res.ok ? 'success' : 'error',
        text: res.message
      });
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        text: err?.message || 'Gagal menjalankan Test Print.'
      });
    } finally {
      setIsTestingPrint(false);
    }
  };

  const handleOpenTestPreview = (mode = 'THERMAL') => {
    const { rawPayload, options } = createTestPrintPayload(mode);
    const built = printEngine.buildPrintPayload(rawPayload, options);
    setPreviewTestDoc(built.normalizedDoc);
  };

  if (isSuperuserWithoutTenant) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          Akun Superuser Platform tidak memiliki konfigurasi printer fisik tenant untuk menjaga isolasi keamanan multi-tenant.
        </span>
      </div>
    );
  }

  const statusBadgeColor =
    connectionState.status === CONNECTION_STATUS.CONNECTED
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
      : connectionState.status === CONNECTION_STATUS.CONNECTING
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800'
      : connectionState.status === CONNECTION_STATUS.ERROR
      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';

  return (
    <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-[#2455E8]" />
            <span>Perangkat Printer Workstation &amp; Uji Cetak</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pengaturan hardware disimpan pada perangkat ini (Workstation Lokal).
          </p>
        </div>

        {/* CONNECTION STATUS BADGE */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState.status === CONNECTION_STATUS.CONNECTED
                  ? 'bg-emerald-500'
                  : connectionState.status === CONNECTION_STATUS.CONNECTING
                  ? 'bg-blue-500 animate-pulse'
                  : connectionState.status === CONNECTION_STATUS.ERROR
                  ? 'bg-rose-500'
                  : 'bg-slate-400'
              }`}
            />
            <span>{connectionState.status}</span>
          </span>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackNotice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            feedbackNotice.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : feedbackNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
          }`}
        >
          {feedbackNotice.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="leading-snug">{feedbackNotice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: PRINTER METHOD & PAPER SIZE SETTINGS (7 COLS) */}
        <div className="lg:col-span-7 space-y-3 bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
          {/* 1. JALUR CETAK UTAMA */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jalur Cetak Perangkat Ini
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-900/60 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setPreferredAdapter(PRINT_ADAPTERS.BROWSER);
                  connectionManager.connectBrowserSystemPrint();
                }}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  preferredAdapter === PRINT_ADAPTERS.BROWSER
                    ? 'bg-white dark:bg-slate-800 text-[#2455E8] dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="truncate">Browser / OS</span>
              </button>

              <button
                type="button"
                onClick={() => setPreferredAdapter(PRINT_ADAPTERS.WEB_USB)}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  preferredAdapter === PRINT_ADAPTERS.WEB_USB
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Usb className="w-3.5 h-3.5" />
                <span className="truncate">WebUSB</span>
              </button>

              <button
                type="button"
                onClick={() => setPreferredAdapter(PRINT_ADAPTERS.WEB_BLUETOOTH)}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  preferredAdapter === PRINT_ADAPTERS.WEB_BLUETOOTH
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span className="truncate">BLE GATT</span>
              </button>

              <button
                type="button"
                onClick={() => setPreferredAdapter(PRINT_ADAPTERS.LOCAL_BRIDGE)}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  preferredAdapter === PRINT_ADAPTERS.LOCAL_BRIDGE
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span className="truncate">Bridge (9123)</span>
              </button>
            </div>
          </div>

          {/* 2. UKURAN KERTAS THERMAL & DOKUMEN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div>
              <label
                htmlFor="printer-receipt-paper-size"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Struk Thermal
              </label>
              <select
                id="printer-receipt-paper-size"
                value={receiptPaperSize}
                onChange={(e) => setReceiptPaperSize(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                <option value="58mm">Thermal 58mm (32 kol)</option>
                <option value="80mm">Thermal 80mm (48 kol)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="printer-document-paper-size"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Dokumen Biasa
              </label>
              <select
                id="printer-document-paper-size"
                value={documentPaperSize}
                onChange={(e) => setDocumentPaperSize(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="A5">A5 (148 × 210 mm)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="printer-document-orientation"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Orientasi Dokumen
              </label>
              <select
                id="printer-document-orientation"
                value={preferredDocumentOrientation}
                onChange={(e) => setPreferredDocumentOrientation(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>

          {/* 3. PREFERENSI CHECKOUT */}
          <div className="pt-1 flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoPrintAfterCheckout}
                onChange={(e) => setAutoPrintAfterCheckout(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#2455E8] focus:ring-blue-500 cursor-pointer"
              />
              <span>Otomatis cetak setelah pembayaran</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoOpenPreviewAfterCheckout}
                onChange={(e) => setAutoOpenPreviewAfterCheckout(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#2455E8] focus:ring-blue-500 cursor-pointer"
              />
              <span>Pratinjau struk setelah transaksi</span>
            </label>
          </div>

          {/* 4. PAIRING & HARDWARE ACTIONS */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-slate-500 font-medium">Perangkat: </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {pairedDeviceMetadata?.name || printerDisplayName || 'Browser / System Print'}
                </span>
                {pairedDeviceMetadata?.transport && (
                  <span className="ml-1.5 text-[10px] font-mono text-slate-500 uppercase">
                    ({pairedDeviceMetadata.transport})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {capabilities.webUsb.supported && (
                  <button
                    type="button"
                    onClick={handlePairUsbPrinter}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>Cari USB</span>
                  </button>
                )}

                {capabilities.webBluetooth.supported && (
                  <button
                    type="button"
                    onClick={handlePairBluetoothPrinter}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Cari BLE</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConnectBridgePrinter}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Sambung Bridge (9123)</span>
                </button>

                {(connectionState.status === CONNECTION_STATUS.CONNECTED || pairedDeviceMetadata) && (
                  <button
                    type="button"
                    onClick={handleDisconnectPrinter}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    <span>Putuskan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Authorized Devices Summary */}
            {(permittedUsbList.length > 0 || permittedBleList.length > 0) && (
              <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-semibold block mb-1">
                  Perangkat Diizinkan di Browser Ini:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {permittedUsbList.map((item, idx) => (
                    <span
                      key={`usb-${idx}`}
                      className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800 font-mono text-[10px]"
                    >
                      USB: {item.metadata.name}
                    </span>
                  ))}
                  {permittedBleList.map((item, idx) => (
                    <span
                      key={`ble-${idx}`}
                      className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 font-mono text-[10px]"
                    >
                      BLE: {item.metadata.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ACTIONS & TEST PRINT */}
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSavePrinterConfiguration}
              className="px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Konfigurasi Workstation</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={isTestingPrint}
                onClick={() => handleRunTestPrint('THERMAL')}
                className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                title="Uji cetak struk thermal"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Test Thermal ({receiptPaperSize})</span>
              </button>

              <button
                type="button"
                disabled={isTestingPrint}
                onClick={() => handleRunTestPrint('DOCUMENT')}
                className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                title="Uji cetak dokumen Inkjet/Ink Tank"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Test {documentPaperSize} (Inkjet)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenTestPreview('THERMAL')}
                className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                title="Pratinjau struk"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pratinjau</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DIAGNOSTICS (5 COLS) */}
        <div className="lg:col-span-5 space-y-3 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Status Kemampuan Hardware</span>
            </span>
            <button
              type="button"
              onClick={refreshHardwareDiscovery}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              title="Segarkan status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-900">
              <span className="text-slate-600 dark:text-slate-400">HTTPS / Secure Context</span>
              <span className={capabilities.secureContext.isSecure ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-500'}>
                {capabilities.secureContext.isSecure ? 'Aktif' : 'Tidak Aman'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-900">
              <span className="text-slate-600 dark:text-slate-400">Browser / System Print</span>
              <span className="font-semibold text-emerald-600">Didukung</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-900">
              <span className="text-slate-600 dark:text-slate-400">WebUSB API</span>
              <span className={capabilities.webUsb.supported ? 'font-semibold text-emerald-600' : 'text-slate-400'}>
                {capabilities.webUsb.supported ? 'Tersedia' : 'Tidak Didukung'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-900">
              <span className="text-slate-600 dark:text-slate-400">Web Bluetooth BLE</span>
              <span className={capabilities.webBluetooth.supported ? 'font-semibold text-emerald-600' : 'text-slate-400'}>
                {capabilities.webBluetooth.supported ? 'Tersedia' : 'Tidak Didukung'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600 dark:text-slate-400">Local Print Bridge (9123)</span>
              <span className="font-semibold text-blue-600">Tersedia</span>
            </div>
          </div>
        </div>
      </div>

      {/* TEST PRINT PREVIEW MODAL */}
      <ReceiptPreviewModal
        isOpen={Boolean(previewTestDoc)}
        onClose={() => setPreviewTestDoc(null)}
        documentData={previewTestDoc}
        tenantProfile={effectiveTenantProfile}
        userProfile={userProfile}
        printEngine={printEngine}
      />
    </div>
  );
}
