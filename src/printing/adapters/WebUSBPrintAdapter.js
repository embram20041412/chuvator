/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 4.1: WebUSB Direct ESC/POS Print Adapter (Phase 4.1 Final Correction Patch)
 *
 * Catatan Teknis Standar:
 * ESC/POS® adalah set perintah proprietary yang dikembangkan oleh Seiko Epson Corporation
 * (bukan standar ISO/IEC). Dukungan perintah ESC/POS, code page (tabel karakter),
 * dan pemotong kertas otomatis (auto-cutter) bergantung pada kompatibilitas firmware
 * dan spesifikasi fisik masing-masing vendor printer.
 *
 * Adapter ini mengomunikasikan data biner ESC/POS secara langsung ke printer thermal USB:
 * - Memeriksa Secure Context (HTTPS / localhost) dan ketersediaan WebUSB API.
 * - Mengidentifikasi USB Interface Class 7 (Printer Class) atau interface vendor-specific
 *   yang terverifikasi sebagai printer thermal kompatibel.
 * - Menerapkan antrean eksekusi serial (Mutex) untuk mencegah dua transfer USB berjalan bersamaan.
 * - Mengalirkan buffer byte ESC/POS terenkode dalam chunk terkontrol (default 512 byte).
 * - Menangani timeout transfer secara aman tanpa melepaskan interface secara mendadak saat transfer in-flight.
 * - Mensinkronisasikan lifecycle status koneksi dengan PrinterConnectionManager.
 */

import {
  PRINT_ADAPTERS,
  PRINT_EXECUTION_STATUS
} from '../types/printTypes.js';
import {
  checkSecureContext,
  mapUsbDeviceToMetadata
} from '../hardware/PrinterDiscovery.js';
import {
  encodeEscPosDocument
} from '../templates/EscPosEncoder.js';
import {
  normalizePrintDocument
} from '../templates/ReceiptTemplateEngine.js';

/**
 * Timeout wrapper for USB async operations
 */
export async function withTimeout(promise, ms = 10000, timeoutMessage = 'Timeout operasi WebUSB.') {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutMessage);
      err.isTimeout = true;
      reject(err);
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Checks whether a device is a confirmed printer vendor or product by name/vendor ID
 */
export function isKnownPrinterVendorOrName(device) {
  if (!device) return false;

  const vendorId = Number(device.vendorId);
  const KNOWN_PRINTER_VENDORS = new Set([
    0x04b8, // EPSON
    0x0519, // Star Micronics
    0x154f, // BIXOLON
    0x0dd4, // Custom Engineering
    0x0483, // STMicroelectronics / Xprinter OEM
    0x1cbe, // Rongta
    0x0fe6, // ZJiang
    0x1fc9, // NXP / Thermal Controller
    0x04e8, // Samsung / BIXOLON
    0x04e6  // SCM / POS
  ]);

  if (KNOWN_PRINTER_VENDORS.has(vendorId)) {
    return true;
  }

  const nameStr = `${device.productName || ''} ${device.manufacturerName || ''}`.toLowerCase();
  const PRINTER_KEYWORDS = [
    'printer', 'pos', 'thermal', 'receipt', 'epson', 'xprinter',
    'star', 'bixolon', 'citizen', 'sewoo', 'zjiang', 'rongta',
    'gprinter', 'hoin', 'milestone', 'custom', 'tsc', 'godex',
    'tm-t', 'rp-', 'xp-'
  ];

  return PRINTER_KEYWORDS.some((kw) => nameStr.includes(kw));
}

/**
 * Dynamically inspects USB device configurations, interfaces, and endpoints.
 * Prioritizes USB Class 7 (Printer Class).
 * For vendor-specific interfaces (Class 255), requires explicit printer confirmation.
 *
 * @param {any} device WebUSB USBDevice object
 * @param {any} [options]
 * @returns {{ configurationValue: number, interfaceNumber: number, alternateSetting: number, endpointNumber: number, endpointType: string, packetSize: number, interfaceClass: number, isPrinterClass: boolean, isVendorSpecific: boolean } | null}
 */
export function findPrinterUsbInterfaceAndEndpoint(device, options = {}) {
  if (!device) return null;

  const currentConfig = device.configuration || (device.configurations && device.configurations[0]) || null;
  if (!currentConfig || !Array.isArray(currentConfig.interfaces)) {
    return null;
  }

  const configurationValue = currentConfig.configurationValue ?? 1;

  // Pass 1: Look for USB Class 7 (Printer Class) interface
  for (const iface of currentConfig.interfaces) {
    const alternates = Array.isArray(iface.alternates)
      ? iface.alternates
      : iface.alternate
      ? [iface.alternate]
      : [];

    for (const alt of alternates) {
      if (alt.interfaceClass === 7) {
        const outEndpoint = (alt.endpoints || []).find(
          (ep) => ep.direction === 'out' && (ep.type === 'bulk' || ep.type === 'interrupt')
        );
        if (outEndpoint) {
          return {
            configurationValue,
            interfaceNumber: iface.interfaceNumber,
            alternateSetting: alt.alternateSetting ?? 0,
            endpointNumber: outEndpoint.endpointNumber,
            endpointType: outEndpoint.type,
            packetSize: outEndpoint.packetSize || 64,
            interfaceClass: alt.interfaceClass,
            isPrinterClass: true,
            isVendorSpecific: false
          };
        }
      }
    }
  }

  // Pass 2: Vendor-Specific Interface (Class 255 / 0xFF) with explicit printer confirmation
  const allowOverride = Boolean(options?.allowVendorSpecificOverride);
  const isPrinterConfirmed = isKnownPrinterVendorOrName(device) || allowOverride;

  if (isPrinterConfirmed) {
    for (const iface of currentConfig.interfaces) {
      const alternates = Array.isArray(iface.alternates)
        ? iface.alternates
        : iface.alternate
        ? [iface.alternate]
        : [];

      for (const alt of alternates) {
        if (alt.interfaceClass === 255 || alt.interfaceClass === 0xff) {
          const outEndpoint = (alt.endpoints || []).find(
            (ep) => ep.direction === 'out' && (ep.type === 'bulk' || ep.type === 'interrupt')
          );
          if (outEndpoint) {
            return {
              configurationValue,
              interfaceNumber: iface.interfaceNumber,
              alternateSetting: alt.alternateSetting ?? 0,
              endpointNumber: outEndpoint.endpointNumber,
              endpointType: outEndpoint.type,
              packetSize: outEndpoint.packetSize || 64,
              interfaceClass: alt.interfaceClass,
              isPrinterClass: false,
              isVendorSpecific: true
            };
          }
        }
      }
    }
  }

  return null;
}

export class WebUSBPrintAdapter {
  constructor(options = {}) {
    this.name = PRINT_ADAPTERS.WEB_USB;
    this.chunkSize = Number(options.chunkSize) > 0 ? Number(options.chunkSize) : 512;
    this.timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
    this.connectionManager = options.connectionManager || null;
    this.envWindow = options.envWindow || (typeof window !== 'undefined' ? window : null);
    this.envNavigator = options.envNavigator || (typeof navigator !== 'undefined' ? navigator : null);

    // Promise chain mutex to guarantee serial execution of USB transfers
    this._printMutex = Promise.resolve();
  }

  /**
   * Checks whether WebUSB is supported and allowed in current context
   */
  isSupported() {
    const secure = checkSecureContext(this.envWindow);
    if (!secure.isSecure) return false;
    return Boolean(
      this.envNavigator &&
      this.envNavigator.usb &&
      typeof this.envNavigator.usb.requestDevice === 'function'
    );
  }

  /**
   * Resolves the target USBDevice to use for printing
   */
  async resolveTargetDevice(options = {}) {
    if (options.device) {
      return options.device;
    }

    if (this.connectionManager?.activeDeviceHandle) {
      return this.connectionManager.activeDeviceHandle;
    }

    if (this.envNavigator?.usb && typeof this.envNavigator.usb.getDevices === 'function') {
      try {
        const permitted = await this.envNavigator.usb.getDevices();
        if (Array.isArray(permitted) && permitted.length > 0) {
          if (options.vendorId || options.productId) {
            const matched = permitted.find((dev) => {
              const matchVendor = !options.vendorId || dev.vendorId === options.vendorId;
              const matchProduct = !options.productId || dev.productId === options.productId;
              return matchVendor && matchProduct;
            });
            if (matched) return matched;
          }
          return permitted[0];
        }
      } catch {
        // Ignore permitted device lookup error
      }
    }

    if (options.interactive && this.envNavigator?.usb && typeof this.envNavigator.usb.requestDevice === 'function') {
      const filters = Array.isArray(options.filters) ? options.filters : [];
      return this.envNavigator.usb.requestDevice({ filters });
    }

    return null;
  }

  /**
   * Serialized print entry point using internal mutex lock
   */
  async print(rawOrNormalizedDoc, options = {}) {
    const nextInQueue = this._printMutex.then(
      () => this._doPrint(rawOrNormalizedDoc, options),
      () => this._doPrint(rawOrNormalizedDoc, options)
    );
    this._printMutex = nextInQueue.catch(() => {});
    return nextInQueue;
  }

  /**
   * Internal print implementation
   */
  async _doPrint(rawOrNormalizedDoc, options = {}) {
    const secureContext = checkSecureContext(this.envWindow);
    if (!secureContext.isSecure) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.PERMISSION_DENIED,
        adapter: this.name,
        physicalPrintConfirmed: false,
        reason: 'INSECURE_CONTEXT',
        message: 'WebUSB mewajibkan konteks aman (HTTPS atau localhost).'
      };
    }

    if (!this.isSupported()) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
        adapter: this.name,
        physicalPrintConfirmed: false,
        reason: 'WEBUSB_NOT_AVAILABLE',
        message: 'Browser atau platform ini tidak mendukung WebUSB API.'
      };
    }

    // 1. Prepare & Validate Document
    const doc = normalizePrintDocument(rawOrNormalizedDoc, options);

    // 2. Resolve USB Device
    let device = null;
    try {
      device = await this.resolveTargetDevice(options);
    } catch (discoveryErr) {
      const isCancelled =
        discoveryErr?.name === 'NotFoundError' ||
        String(discoveryErr?.message || '').includes('No device selected') ||
        String(discoveryErr?.message || '').includes('cancelled');

      return {
        ok: false,
        status: isCancelled
          ? PRINT_EXECUTION_STATUS.PERMISSION_DENIED
          : PRINT_EXECUTION_STATUS.DEVICE_NOT_FOUND,
        adapter: this.name,
        physicalPrintConfirmed: false,
        error: discoveryErr?.message || String(discoveryErr),
        message: isCancelled
          ? 'Pemilihan perangkat printer USB dibatalkan oleh pengguna.'
          : 'Gagal mendeteksi perangkat printer USB.'
      };
    }

    if (!device) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.DEVICE_NOT_FOUND,
        adapter: this.name,
        physicalPrintConfirmed: false,
        message: 'Perangkat printer USB tidak ditemukan atau belum dipasangkan pada workstation ini.'
      };
    }

    // 3. Prepare Binary ESC/POS Data
    let bytes = null;
    if (options.escPosBytes instanceof Uint8Array) {
      bytes = options.escPosBytes;
    } else {
      const columns =
        doc.paper?.columns ||
        (String(doc.paper?.size || '').toLowerCase() === '58mm' ? 32 : 48);

      const encoded = encodeEscPosDocument(doc, {
        columns,
        cutPaper: doc.renderOptions?.cutPaper ?? false,
        feedLines: doc.renderOptions?.feedLines ?? 3,
        ...(options.escPosOptions || {})
      });
      bytes = encoded.bytes;
    }

    if (!bytes || bytes.byteLength === 0) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.FAILED,
        adapter: this.name,
        physicalPrintConfirmed: false,
        message: 'Data byte ESC/POS kosong atau gagal dienkode.'
      };
    }

    // Determine connection reuse vs new connection
    const isManagedConnection = Boolean(
      this.connectionManager &&
      this.connectionManager.activeDeviceHandle === device &&
      device.opened &&
      this.connectionManager.isInterfaceClaimed
    );

    let openedByUs = false;
    let claimedByUs = false;
    let endpointInfo = null;
    let timedOutDuringTransfer = false;

    try {
      // 4. Open Device
      if (!device.opened) {
        if (typeof device.open !== 'function') {
          return {
            ok: false,
            status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
            adapter: this.name,
            physicalPrintConfirmed: false,
            message: 'Objek perangkat USB tidak memiliki fungsi open() yang valid.'
          };
        }
        await withTimeout(device.open(), this.timeoutMs, 'Timeout saat membuka koneksi USB (device.open).');
        openedByUs = true;
      }

      // 5. Inspect Endpoint & Validate Printer Compatibility
      endpointInfo = findPrinterUsbInterfaceAndEndpoint(device, options);
      if (!endpointInfo && Array.isArray(device.configurations) && device.configurations.length > 0) {
        const firstConfig = device.configurations[0];
        if (typeof device.selectConfiguration === 'function') {
          await withTimeout(
            device.selectConfiguration(firstConfig.configurationValue ?? 1),
            this.timeoutMs,
            'Timeout saat memilih konfigurasi USB.'
          );
        }
        endpointInfo = findPrinterUsbInterfaceAndEndpoint(device, options);
      }

      if (!endpointInfo) {
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
          adapter: this.name,
          physicalPrintConfirmed: false,
          message: 'Interface USB tidak teridentifikasi sebagai USB Printer Class (Class 7) atau printer ESC/POS terverifikasi.'
        };
      }

      // 6. Claim Interface
      const isAlreadyClaimed = Boolean(
        options.alreadyClaimed ||
        isManagedConnection
      );

      if (!isAlreadyClaimed) {
        if (typeof device.claimInterface !== 'function') {
          return {
            ok: false,
            status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
            adapter: this.name,
            physicalPrintConfirmed: false,
            message: 'Objek perangkat USB tidak memiliki fungsi claimInterface().'
          };
        }
        await withTimeout(
          device.claimInterface(endpointInfo.interfaceNumber),
          this.timeoutMs,
          'Timeout saat mengklaim interface printer USB.'
        );
        claimedByUs = true;
      }

      // 7. Stream Data in Controlled Chunks
      const totalBytes = bytes.byteLength;
      const chunkSize = Math.max(16, Number(options.chunkSize) || this.chunkSize);
      let bytesTransferred = 0;

      for (let offset = 0; offset < totalBytes; offset += chunkSize) {
        const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, totalBytes));

        const transferPromise = device.transferOut(endpointInfo.endpointNumber, chunk);
        let transferResult;
        try {
          transferResult = await withTimeout(
            transferPromise,
            this.timeoutMs,
            'Waktu transfer data ke endpoint printer USB habis (Timeout).'
          );
        } catch (transferErr) {
          if (transferErr?.isTimeout) {
            timedOutDuringTransfer = true;
          }
          throw transferErr;
        }

        if (transferResult && transferResult.status && transferResult.status !== 'ok') {
          return {
            ok: false,
            status: PRINT_EXECUTION_STATUS.TRANSFER_ERROR,
            adapter: this.name,
            physicalPrintConfirmed: false,
            bytesWritten: bytesTransferred,
            usbStatus: transferResult.status,
            message: `Transfer data USB dihentikan oleh perangkat dengan status: ${transferResult.status}`
          };
        }

        const writtenInChunk =
          typeof transferResult?.bytesWritten === 'number'
            ? transferResult.bytesWritten
            : chunk.byteLength;
        bytesTransferred += writtenInChunk;
      }

      const deviceMeta = mapUsbDeviceToMetadata(device);

      return {
        ok: true,
        status: PRINT_EXECUTION_STATUS.SUCCESS,
        adapter: this.name,
        physicalPrintConfirmed: false,
        bytesWritten: bytesTransferred,
        totalBytes,
        deviceMetadata: deviceMeta,
        paper: doc.paper,
        docType: doc.docType,
        message: `Sebanyak ${bytesTransferred} byte data ESC/POS berhasil dikirim ke endpoint USB ${endpointInfo.endpointNumber} (${deviceMeta?.name || 'Printer USB'}).`
      };
    } catch (err) {
      const errName = String(err?.name || '');
      const errMsg = String(err?.message || err || '');

      // Handle Timeout
      if (err?.isTimeout || timedOutDuringTransfer || errMsg.toLowerCase().includes('timeout')) {
        if (this.connectionManager) {
          this.connectionManager.handleUnexpectedDisconnect(
            'Waktu komunikasi data printer USB habis (Timeout). Koneksi ditandai errored untuk pemulihan.'
          );
        }
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.TIMEOUT,
          adapter: this.name,
          physicalPrintConfirmed: false,
          error: errMsg,
          message: 'Waktu komunikasi data ke printer USB habis (Timeout).'
        };
      }

      // Handle Disconnection
      const isDisconnected =
        errName === 'NetworkError' ||
        errName === 'DeviceDisconnectedError' ||
        errMsg.toLowerCase().includes('disconnected') ||
        errMsg.toLowerCase().includes('device was disconnected') ||
        errMsg.toLowerCase().includes('dicabut');

      if (isDisconnected) {
        if (this.connectionManager && typeof this.connectionManager.handleUnexpectedDisconnect === 'function') {
          this.connectionManager.handleUnexpectedDisconnect(
            'Perangkat USB terputus saat proses pencetakan berlangsung.'
          );
        }
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.DEVICE_DISCONNECTED,
          adapter: this.name,
          physicalPrintConfirmed: false,
          error: errMsg,
          message: 'Perangkat printer USB terputus secara fisik saat transfer data berlangsung.'
        };
      }

      // Handle Permission / Security Errors
      if (errName === 'SecurityError' || errName === 'NotAllowedError') {
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.PERMISSION_DENIED,
          adapter: this.name,
          physicalPrintConfirmed: false,
          error: errMsg,
          message: 'Akses ke perangkat printer USB ditolak oleh sistem operasi atau kebijakan browser.'
        };
      }

      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.TRANSFER_ERROR,
        adapter: this.name,
        physicalPrintConfirmed: false,
        error: errMsg,
        message: `Gagal mengirim data ke printer USB: ${errMsg}`
      };
    } finally {
      // Perform cleanup ONLY if no active transfer timed out (to prevent releasing in-flight interfaces)
      // and only if the connection is not persistently managed by ConnectionManager
      if (!timedOutDuringTransfer) {
        const keepClaimed = Boolean(options.keepClaimed || isManagedConnection);
        const keepOpen = Boolean(options.keepOpen || isManagedConnection);

        if (claimedByUs && !keepClaimed) {
          try {
            if (typeof device.releaseInterface === 'function' && endpointInfo) {
              await device.releaseInterface(endpointInfo.interfaceNumber);
            }
          } catch {
            // Ignore release error during finally
          }
        }

        if (openedByUs && !keepOpen) {
          try {
            if (device.opened && typeof device.close === 'function') {
              await device.close();
            }
          } catch {
            // Ignore close error during finally
          }
        }
      }
    }
  }
}

export const defaultWebUSBPrintAdapter = new WebUSBPrintAdapter();

export default WebUSBPrintAdapter;
