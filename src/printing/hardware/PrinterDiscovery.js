/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 3: PrinterDiscovery
 *
 * Honest capability detector and explicit user-gesture device discovery for:
 * 1. Browser / System Print
 * 2. WebUSB API
 * 3. Web Bluetooth API (BLE GATT vs Classic SPP distinction)
 * 4. Local Print Bridge (Optional companion indicator)
 *
 * Strictly adheres to web platform security & honesty constraints:
 * - Never claims to silently enumerate OS printers via browser APIs.
 * - Requires explicit user interaction (`requestDevice`) for USB/BLE scanning.
 * - Clearly distinguishes BLE GATT from Bluetooth Classic SPP.
 */

import { sanitizePairedDeviceMetadata } from '../config/PrinterConfiguration.js';

export const COMMON_BLE_PRINTER_SERVICE_UUIDS = Object.freeze([
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE 16-bit Printer Service (0x18F0)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Common POS BLE Printer Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip / ISSC Transparent UART BLE
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000ff00-0000-1000-8000-00805f9b34fb'  // Generic Vendor BLE Thermal Service
]);

/**
 * Checks whether the current runtime environment is a Secure Context (HTTPS or localhost)
 * @param {any} [envWindow]
 */
export function checkSecureContext(envWindow = typeof window !== 'undefined' ? window : null) {
  if (!envWindow) {
    return {
      isSecure: false,
      protocol: 'none',
      reason: 'Lingkungan non-browser (SSR / Node).'
    };
  }

  if (typeof envWindow.isSecureContext === 'boolean') {
    return {
      isSecure: envWindow.isSecureContext,
      protocol: envWindow.location?.protocol || 'unknown',
      reason: envWindow.isSecureContext
        ? 'Konteks aman (HTTPS / localhost) aktif.'
        : 'WebUSB dan Web Bluetooth mewajibkan koneksi HTTPS atau localhost.'
    };
  }

  const protocol = String(envWindow.location?.protocol || '');
  const hostname = String(envWindow.location?.hostname || '');
  const isSecure =
    protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

  return {
    isSecure,
    protocol,
    reason: isSecure
      ? 'Konteks aman (HTTPS / localhost) aktif.'
      : 'WebUSB dan Web Bluetooth mewajibkan koneksi HTTPS atau localhost.'
  };
}

/**
 * Detects browser printing capabilities honestly without fabricating OS printer lists
 * @param {any} [envWindow]
 * @param {any} [envNavigator]
 */
export function detectPrintingCapabilities(
  envWindow = typeof window !== 'undefined' ? window : null,
  envNavigator = typeof navigator !== 'undefined' ? navigator : null
) {
  const secureContext = checkSecureContext(envWindow);
  const userAgent = String(envNavigator?.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent);

  // 1. Browser / System Print
  const browserPrintAvailable = Boolean(
    envWindow && typeof envWindow.print === 'function'
  );

  // 2. WebUSB API
  const webUsbApiPresent = Boolean(
    envNavigator &&
    envNavigator.usb &&
    typeof envNavigator.usb.requestDevice === 'function'
  );
  const webUsbSupported = Boolean(webUsbApiPresent && secureContext.isSecure);

  // 3. Web Bluetooth API (BLE GATT)
  const webBluetoothApiPresent = Boolean(
    envNavigator &&
    envNavigator.bluetooth &&
    typeof envNavigator.bluetooth.requestDevice === 'function'
  );
  const webBluetoothSupported = Boolean(webBluetoothApiPresent && secureContext.isSecure);

  return {
    secureContext,
    browserPrint: {
      adapter: 'browser',
      apiAvailable: browserPrintAvailable,
      supported: browserPrintAvailable,
      canEnumerateOsPrinters: false,
      summary: browserPrintAvailable
        ? 'Tersedia (Melalui Dialog Cetak Sistem Operasi)'
        : 'Tidak tersedia pada lingkungan ini',
      limitationNote:
        'Demi privasi standar web, browser tidak mengizinkan aplikasi web membaca daftar semua printer OS secara langsung. Pemilihan printer Inkjet, Ink Tank, atau Thermal driver OS dilakukan di dalam jendela dialog cetak sistem.'
    },
    webUsb: {
      adapter: 'webusb',
      apiAvailable: webUsbApiPresent,
      supported: webUsbSupported,
      requiresUserGesture: true,
      directTransmissionReadyInPhase: 4,
      summary: webUsbSupported
        ? 'WebUSB API Tersedia (Perlu Izin Eksplisit Pengguna)'
        : !secureContext.isSecure
        ? 'Nonaktif (Memerlukan HTTPS / Secure Context)'
        : isIOS
        ? 'Tidak Didukung di iOS / Safari'
        : 'Tidak Didukung oleh Browser Ini (Gunakan Chrome / Edge Desktop atau Android)',
      limitationNote:
        'Pada Windows, perangkat USB mungkin memerlukan driver kompatibel WinUSB untuk akses langsung, atau gunakan jalur Browser/System Print jika printer sudah menggunakan driver bawaan Windows.'
    },
    webBluetooth: {
      adapter: 'webbluetooth',
      apiAvailable: webBluetoothApiPresent,
      supported: webBluetoothSupported,
      requiresUserGesture: true,
      supportedProtocol: 'BLE_GATT_ONLY',
      classicSppSupported: false,
      directTransmissionReadyInPhase: 4,
      summary: webBluetoothSupported
        ? 'Web Bluetooth API Tersedia (Khusus Printer BLE GATT)'
        : !secureContext.isSecure
        ? 'Nonaktif (Memerlukan HTTPS / Secure Context)'
        : isIOS
        ? 'Tidak Didukung oleh Safari iOS (Gunakan AirPrint / Unduh PDF)'
        : 'Tidak Didukung oleh Browser Ini (Gunakan Chrome / Edge)',
      limitationNote:
        'PENTING: Web Bluetooth hanya mendukung printer thermal dengan chip Bluetooth Low Energy (BLE GATT). Printer thermal yang hanya menggunakan Bluetooth Classic (SPP) tidak akan muncul di pemindaian Web Bluetooth dan harus dicetak melalui Dialog Sistem OS atau Local Print Bridge.'
    },
    localBridge: {
      adapter: 'bridge',
      apiAvailable: true,
      supported: true,
      optional: true,
      readyInPhase: 4,
      summary: 'Tersedia di Phase 4.3 (http://127.0.0.1:9123)',
      limitationNote:
        'Aplikasi pendamping Local Print Bridge menghubungkan printer Bluetooth Classic SPP, OS USB Driver, TCP/IP Network 9100, dan OS Spooler (Inkjet/Ink Tank A4/A5).'
    }
  };
}

/**
 * Maps a raw Local Print Bridge device object into safe workstation metadata
 */
export function mapBridgeDeviceToMetadata(bridgeDevice) {
  if (!bridgeDevice) return null;
  return sanitizePairedDeviceMetadata({
    id: bridgeDevice.id || `bridge-${Date.now()}`,
    name: bridgeDevice.name || 'Local Print Bridge Printer',
    manufacturerName: bridgeDevice.type || 'Local Bridge',
    transport: 'bridge',
    vendorId: null,
    productId: null,
    pairedAt: new Date().toISOString(),
    connectionDetails: bridgeDevice.connectionDetails || {}
  });
}

/**
 * Maps a raw WebUSB USBDevice object into safe workstation metadata
 */
export function mapUsbDeviceToMetadata(usbDevice) {
  if (!usbDevice) return null;
  const vendorHex = usbDevice.vendorId
    ? usbDevice.vendorId.toString(16).padStart(4, '0').toUpperCase()
    : '0000';
  const productHex = usbDevice.productId
    ? usbDevice.productId.toString(16).padStart(4, '0').toUpperCase()
    : '0000';

  return sanitizePairedDeviceMetadata({
    id: usbDevice.serialNumber || `usb-${vendorHex}-${productHex}`,
    name:
      usbDevice.productName ||
      `USB Printer (${vendorHex}:${productHex})`,
    manufacturerName: usbDevice.manufacturerName || '',
    transport: 'webusb',
    vendorId: usbDevice.vendorId ?? null,
    productId: usbDevice.productId ?? null,
    pairedAt: new Date().toISOString()
  });
}

/**
 * Maps a raw Web Bluetooth BluetoothDevice object into safe workstation metadata
 */
export function mapBluetoothDeviceToMetadata(btDevice) {
  if (!btDevice) return null;
  return sanitizePairedDeviceMetadata({
    id: btDevice.id || `ble-${Date.now()}`,
    name: btDevice.name || 'Bluetooth BLE Printer',
    manufacturerName: '',
    transport: 'webbluetooth',
    vendorId: null,
    productId: null,
    pairedAt: new Date().toISOString()
  });
}

/**
 * Returns USB devices that the user has previously granted permission to in this browser
 * (Does not open a popup; safe to call on settings load)
 * @param {any} [envNavigator]
 */
export async function getPermittedUsbDevices(
  envNavigator = typeof navigator !== 'undefined' ? navigator : null
) {
  if (!envNavigator?.usb || typeof envNavigator.usb.getDevices !== 'function') {
    return [];
  }

  try {
    const devices = await envNavigator.usb.getDevices();
    if (!Array.isArray(devices)) return [];
    return devices
      .map((dev) => ({
        rawDevice: dev,
        metadata: mapUsbDeviceToMetadata(dev)
      }))
      .filter((item) => item.metadata !== null);
  } catch {
    return [];
  }
}

/**
 * Returns Bluetooth BLE devices that the user has previously granted permission to
 * (Only supported in browsers implementing navigator.bluetooth.getDevices)
 * @param {any} [envNavigator]
 */
export async function getPermittedBluetoothDevices(
  envNavigator = typeof navigator !== 'undefined' ? navigator : null
) {
  if (!envNavigator?.bluetooth || typeof envNavigator.bluetooth.getDevices !== 'function') {
    return [];
  }

  try {
    const devices = await envNavigator.bluetooth.getDevices();
    if (!Array.isArray(devices)) return [];
    return devices
      .map((dev) => ({
        rawDevice: dev,
        metadata: mapBluetoothDeviceToMetadata(dev)
      }))
      .filter((item) => item.metadata !== null);
  } catch {
    return [];
  }
}

/**
 * Requests a USB printer device via explicit user gesture (`navigator.usb.requestDevice`)
 * @param {any} [options]
 * @param {any} [envWindow]
 * @param {any} [envNavigator]
 */
export async function requestUsbPrinterByUserGesture(
  options = {},
  envWindow = typeof window !== 'undefined' ? window : null,
  envNavigator = typeof navigator !== 'undefined' ? navigator : null
) {
  const capabilities = detectPrintingCapabilities(envWindow, envNavigator);
  if (!capabilities.webUsb.supported) {
    return {
      ok: false,
      reason: 'WEBUSB_NOT_SUPPORTED',
      message: capabilities.webUsb.summary
    };
  }

  try {
    const filters = Array.isArray(options.filters) ? options.filters : [];
    const device = await envNavigator.usb.requestDevice({ filters });
    const metadata = mapUsbDeviceToMetadata(device);

    return {
      ok: true,
      device,
      metadata,
      message: `Perangkat USB "${metadata?.name || 'Printer'}" berhasil dipilih. (Catatan: Transmisi langsung ESC/POS diaktifkan pada Phase 4).`
    };
  } catch (err) {
    const isCancelled = err?.name === 'NotFoundError' || String(err?.message || '').includes('No device selected');
    return {
      ok: false,
      cancelled: isCancelled,
      reason: isCancelled ? 'USER_CANCELLED' : 'USB_REQUEST_FAILED',
      message: isCancelled
        ? 'Pemilihan perangkat USB dibatalkan oleh pengguna.'
        : `Gagal memindai perangkat USB: ${err?.message || 'Periksa koneksi kabel USB.'}`
    };
  }
}

/**
 * Requests a Bluetooth BLE printer device via explicit user gesture (`navigator.bluetooth.requestDevice`)
 * @param {any} [options]
 * @param {any} [envWindow]
 * @param {any} [envNavigator]
 */
export async function requestBluetoothPrinterByUserGesture(
  options = {},
  envWindow = typeof window !== 'undefined' ? window : null,
  envNavigator = typeof navigator !== 'undefined' ? navigator : null
) {
  const capabilities = detectPrintingCapabilities(envWindow, envNavigator);
  if (!capabilities.webBluetooth.supported) {
    return {
      ok: false,
      reason: 'WEBBLUETOOTH_NOT_SUPPORTED',
      message: capabilities.webBluetooth.summary
    };
  }

  try {
    const requestOptions = options.acceptAllDevices === false && Array.isArray(options.services)
      ? {
          filters: [{ services: options.services }],
          optionalServices: COMMON_BLE_PRINTER_SERVICE_UUIDS
        }
      : {
          acceptAllDevices: true,
          optionalServices: COMMON_BLE_PRINTER_SERVICE_UUIDS
        };

    const device = await envNavigator.bluetooth.requestDevice(requestOptions);
    const metadata = mapBluetoothDeviceToMetadata(device);

    return {
      ok: true,
      device,
      metadata,
      message: `Perangkat BLE "${metadata?.name || 'Bluetooth Printer'}" berhasil dipilih. (Catatan: Transmisi langsung ESC/POS BLE diaktifkan pada Phase 4).`
    };
  } catch (err) {
    const isCancelled = err?.name === 'NotFoundError' || String(err?.message || '').includes('User cancelled');
    return {
      ok: false,
      cancelled: isCancelled,
      reason: isCancelled ? 'USER_CANCELLED' : 'BLE_REQUEST_FAILED',
      message: isCancelled
        ? 'Pemilihan perangkat Bluetooth dibatalkan oleh pengguna.'
        : `Gagal memindai perangkat BLE: ${err?.message || 'Pastikan printer menyala dan mendukung BLE GATT (bukan hanya Bluetooth Classic SPP).'}`
    };
  }
}

export default {
  COMMON_BLE_PRINTER_SERVICE_UUIDS,
  checkSecureContext,
  detectPrintingCapabilities,
  mapUsbDeviceToMetadata,
  mapBluetoothDeviceToMetadata,
  mapBridgeDeviceToMetadata,
  getPermittedUsbDevices,
  getPermittedBluetoothDevices,
  requestUsbPrinterByUserGesture,
  requestBluetoothPrinterByUserGesture
};
