/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 4.2: Bluetooth BLE GATT ESC/POS Print Adapter
 *
 * Catatan Teknis Standar & Keamanan:
 * - ESC/POS® adalah set perintah proprietary yang dikembangkan oleh Seiko Epson Corporation (bukan standar ISO/IEC).
 * - Web Bluetooth API HANYA mendukung Bluetooth Low Energy (BLE GATT) dan TIDAK mendukung Bluetooth Classic SPP.
 * - Adapter ini mengomunikasikan data biner ESC/POS secara langsung ke characteristic BLE GATT printer:
 *   1. Memeriksa Secure Context (HTTPS / localhost) dan ketersediaan Web Bluetooth API.
 *   2. Meminta izin pengguna eksplisit via `navigator.bluetooth.requestDevice()`.
 *   3. Memeriksa GATT Server, Service, dan Characteristic yang mendukung properti `write` atau `writeWithoutResponse`.
 *   4. Menentukan metode penulisan (`writeValueWithResponse` vs `writeValueWithoutResponse`) dan ukuran chunk (default 64 byte).
 *   5. Menjamin antrean eksekusi serial (Mutex) agar operasi GATT tidak saling bertabrakan.
 *   6. Menangani event `gattserverdisconnected` dan mengelola timeout secara aman.
 */

import {
  PRINT_ADAPTERS,
  PRINT_EXECUTION_STATUS
} from '../types/printTypes.js';
import {
  checkSecureContext,
  mapBluetoothDeviceToMetadata,
  COMMON_BLE_PRINTER_SERVICE_UUIDS
} from '../hardware/PrinterDiscovery.js';
import {
  encodeEscPosDocument
} from '../templates/EscPosEncoder.js';
import {
  normalizePrintDocument
} from '../templates/ReceiptTemplateEngine.js';

/**
 * Timeout wrapper for async BLE GATT operations
 */
export async function withTimeout(promise, ms = 10000, timeoutMessage = 'Timeout operasi Bluetooth BLE GATT.') {
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
 * Normalizes UUID strings to lowercase 128-bit standard format for comparison
 */
export function normalizeUuid(uuid) {
  if (!uuid) return '';
  const str = String(uuid).toLowerCase().trim();
  if (str.length === 4) {
    return `0000${str}-0000-1000-8000-00805f9b34fb`;
  }
  return str;
}

/**
 * Inspects a GATT Server to find a writable printer characteristic.
 * Checks primary services against known BLE printer UUIDs and verifies write capabilities.
 *
 * @param {any} gattServer Web Bluetooth BluetoothRemoteGATTServer object
 * @param {any} [options]
 * @returns {Promise<{ service: any, serviceUuid: string, characteristic: any, characteristicUuid: string, writeMethod: 'writeWithResponse' | 'writeWithoutResponse' | 'writeValue' } | null>}
 */
export async function findWritableGattCharacteristic(gattServer, options = {}) {
  if (!gattServer || !gattServer.connected) {
    return null;
  }

  const targetServiceUuids = [
    ...(Array.isArray(options.targetServices) ? options.targetServices : []),
    ...COMMON_BLE_PRINTER_SERVICE_UUIDS
  ].map(normalizeUuid);

  let servicesToInspect = [];

  // Pass 1: Try getPrimaryServices() if available
  if (typeof gattServer.getPrimaryServices === 'function') {
    try {
      const allServices = await gattServer.getPrimaryServices();
      if (Array.isArray(allServices) && allServices.length > 0) {
        servicesToInspect = allServices;
      }
    } catch {
      // Ignore getPrimaryServices error
    }
  }

  // Pass 2: Query targeted primary services by UUID
  if (servicesToInspect.length === 0 && typeof gattServer.getPrimaryService === 'function') {
    for (const uuid of targetServiceUuids) {
      try {
        const srv = await gattServer.getPrimaryService(uuid);
        if (srv) {
          servicesToInspect.push(srv);
        }
      } catch {
        // Ignore individual service lookup error
      }
    }
  }

  // Inspect characteristics of found services
  for (const service of servicesToInspect) {
    let characteristics = [];
    try {
      if (typeof service.getCharacteristics === 'function') {
        characteristics = await service.getCharacteristics();
      }
    } catch {
      continue;
    }

    if (!Array.isArray(characteristics)) continue;

    for (const char of characteristics) {
      const props = char.properties || {};
      const canWriteWithResponse = Boolean(props.write);
      const canWriteWithoutResponse = Boolean(props.writeWithoutResponse);

      if (canWriteWithResponse || canWriteWithoutResponse) {
        const writeMethod = canWriteWithResponse
          ? 'writeWithResponse'
          : 'writeWithoutResponse';

        return {
          service,
          serviceUuid: normalizeUuid(service.uuid),
          characteristic: char,
          characteristicUuid: normalizeUuid(char.uuid),
          writeMethod,
          properties: props
        };
      }
    }
  }

  return null;
}

export class BluetoothBLEPrintAdapter {
  constructor(options = {}) {
    this.name = PRINT_ADAPTERS.WEB_BLUETOOTH || 'webbluetooth';
    this.chunkSize = Number(options.chunkSize) > 0 ? Number(options.chunkSize) : 64; // Safe BLE GATT payload limit
    this.timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
    this.connectionManager = options.connectionManager || null;
    this.envWindow = options.envWindow || (typeof window !== 'undefined' ? window : null);
    this.envNavigator = options.envNavigator || (typeof navigator !== 'undefined' ? navigator : null);

    // Promise chain mutex to guarantee serial execution of BLE GATT transfers
    this._printMutex = Promise.resolve();
  }

  /**
   * Checks whether Web Bluetooth API is supported and allowed in current context
   */
  isSupported() {
    const secure = checkSecureContext(this.envWindow);
    if (!secure.isSecure) return false;
    return Boolean(
      this.envNavigator &&
      this.envNavigator.bluetooth &&
      typeof this.envNavigator.bluetooth.requestDevice === 'function'
    );
  }

  /**
   * Resolves the target BluetoothDevice to use for printing
   */
  async resolveTargetDevice(options = {}) {
    if (options.device) {
      return options.device;
    }

    if (this.connectionManager?.activeDeviceHandle) {
      return this.connectionManager.activeDeviceHandle;
    }

    if (this.envNavigator?.bluetooth && typeof this.envNavigator.bluetooth.getDevices === 'function') {
      try {
        const permitted = await this.envNavigator.bluetooth.getDevices();
        if (Array.isArray(permitted) && permitted.length > 0) {
          if (options.deviceId || options.deviceName) {
            const matched = permitted.find((dev) => {
              const matchId = !options.deviceId || dev.id === options.deviceId;
              const matchName = !options.deviceName || dev.name === options.deviceName;
              return matchId && matchName;
            });
            if (matched) return matched;
          }
          return permitted[0];
        }
      } catch {
        // Ignore permitted device lookup error
      }
    }

    if (options.interactive && this.envNavigator?.bluetooth && typeof this.envNavigator.bluetooth.requestDevice === 'function') {
      const requestOptions = options.acceptAllDevices === false && Array.isArray(options.services)
        ? {
            filters: [{ services: options.services }],
            optionalServices: COMMON_BLE_PRINTER_SERVICE_UUIDS
          }
        : {
            acceptAllDevices: true,
            optionalServices: COMMON_BLE_PRINTER_SERVICE_UUIDS
          };

      return this.envNavigator.bluetooth.requestDevice(requestOptions);
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
   * Internal BLE GATT print execution
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
        message: 'Web Bluetooth mewajibkan konteks aman (HTTPS atau localhost).'
      };
    }

    if (!this.isSupported()) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
        adapter: this.name,
        physicalPrintConfirmed: false,
        reason: 'WEB_BLUETOOTH_NOT_AVAILABLE',
        message: 'Browser atau platform ini tidak mendukung Web Bluetooth API (BLE GATT).'
      };
    }

    // 1. Prepare & Validate Document
    const doc = normalizePrintDocument(rawOrNormalizedDoc, options);

    // 2. Resolve Bluetooth Device
    let device = null;
    try {
      device = await this.resolveTargetDevice(options);
    } catch (discoveryErr) {
      const isCancelled =
        discoveryErr?.name === 'NotFoundError' ||
        String(discoveryErr?.message || '').includes('User cancelled') ||
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
          ? 'Pemilihan perangkat Bluetooth BLE dibatalkan oleh pengguna.'
          : 'Gagal mendeteksi perangkat Bluetooth BLE.'
      };
    }

    if (!device) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.DEVICE_NOT_FOUND,
        adapter: this.name,
        physicalPrintConfirmed: false,
        message: 'Perangkat printer Bluetooth BLE tidak ditemukan atau belum dipasangkan pada workstation ini.'
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

    // Check managed connection status
    const isManagedConnection = Boolean(
      this.connectionManager &&
      this.connectionManager.activeDeviceHandle === device &&
      device.gatt?.connected &&
      this.connectionManager.activeGattCharacteristic
    );

    let connectedByUs = false;
    let gattServer = device.gatt || null;
    let targetGatt = null;
    let timedOutDuringTransfer = false;

    try {
      // 4. Connect GATT Server if not connected
      if (!gattServer || !gattServer.connected) {
        if (!device.gatt || typeof device.gatt.connect !== 'function') {
          return {
            ok: false,
            status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
            adapter: this.name,
            physicalPrintConfirmed: false,
            message: 'Perangkat Bluetooth tidak memiliki antarmuka GATT Server (device.gatt).'
          };
        }
        gattServer = await withTimeout(
          device.gatt.connect(),
          this.timeoutMs,
          'Timeout saat menyambungkan ke GATT Server Bluetooth BLE.'
        );
        connectedByUs = true;
      }

      // 5. Inspect Service & Characteristic
      if (isManagedConnection && this.connectionManager?.activeGattCharacteristic) {
        targetGatt = {
          service: this.connectionManager.activeGattService,
          serviceUuid: normalizeUuid(this.connectionManager.activeGattService?.uuid),
          characteristic: this.connectionManager.activeGattCharacteristic,
          characteristicUuid: normalizeUuid(this.connectionManager.activeGattCharacteristic?.uuid),
          writeMethod: this.connectionManager.activeGattWriteMethod || 'writeWithResponse'
        };
      } else {
        targetGatt = await findWritableGattCharacteristic(gattServer, options);
      }

      if (!targetGatt || !targetGatt.characteristic) {
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
          adapter: this.name,
          physicalPrintConfirmed: false,
          message: 'Perangkat BLE tidak memiliki Service atau Characteristic yang mendukung operasi penulisan (write).'
        };
      }

      const characteristic = targetGatt.characteristic;

      // 6. Stream Data in Controlled Chunks
      const totalBytes = bytes.byteLength;
      const chunkSize = Math.max(16, Number(options.chunkSize) || this.chunkSize);
      let bytesTransferred = 0;

      for (let offset = 0; offset < totalBytes; offset += chunkSize) {
        const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, totalBytes));

        let writePromise = null;
        if (
          targetGatt.writeMethod === 'writeWithoutResponse' &&
          typeof characteristic.writeValueWithoutResponse === 'function'
        ) {
          writePromise = characteristic.writeValueWithoutResponse(chunk);
        } else if (typeof characteristic.writeValueWithResponse === 'function') {
          writePromise = characteristic.writeValueWithResponse(chunk);
        } else if (typeof characteristic.writeValue === 'function') {
          writePromise = characteristic.writeValue(chunk);
        } else {
          return {
            ok: false,
            status: PRINT_EXECUTION_STATUS.UNSUPPORTED_DEVICE,
            adapter: this.name,
            physicalPrintConfirmed: false,
            message: 'Characteristic BLE tidak memiliki fungsi writeValue yang valid.'
          };
        }

        try {
          await withTimeout(
            writePromise,
            this.timeoutMs,
            'Waktu penulisan data ke GATT Characteristic printer BLE habis (Timeout).'
          );
        } catch (writeErr) {
          if (writeErr?.isTimeout) {
            timedOutDuringTransfer = true;
          }
          throw writeErr;
        }

        bytesTransferred += chunk.byteLength;
      }

      const deviceMeta = mapBluetoothDeviceToMetadata(device);

      return {
        ok: true,
        status: PRINT_EXECUTION_STATUS.SUCCESS,
        adapter: this.name,
        physicalPrintConfirmed: false,
        bytesWritten: bytesTransferred,
        totalBytes,
        deviceMetadata: deviceMeta,
        gattInfo: {
          serviceUuid: targetGatt.serviceUuid,
          characteristicUuid: targetGatt.characteristicUuid,
          writeMethod: targetGatt.writeMethod
        },
        paper: doc.paper,
        docType: doc.docType,
        message: `Sebanyak ${bytesTransferred} byte data ESC/POS berhasil dikirim ke GATT Characteristic BLE (${deviceMeta?.name || 'Bluetooth Printer'}).`
      };
    } catch (err) {
      const errName = String(err?.name || '');
      const errMsg = String(err?.message || err || '');

      // Handle Timeout
      if (err?.isTimeout || timedOutDuringTransfer || errMsg.toLowerCase().includes('timeout')) {
        if (this.connectionManager) {
          this.connectionManager.handleUnexpectedDisconnect(
            'Waktu komunikasi data printer Bluetooth BLE habis (Timeout). Koneksi ditandai errored untuk pemulihan.'
          );
        }
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.TIMEOUT,
          adapter: this.name,
          physicalPrintConfirmed: false,
          error: errMsg,
          message: 'Waktu komunikasi data ke printer Bluetooth BLE habis (Timeout).'
        };
      }

      // Handle GATT Disconnection
      const isDisconnected =
        errName === 'NetworkError' ||
        errName === 'DeviceDisconnectedError' ||
        errMsg.toLowerCase().includes('disconnected') ||
        errMsg.toLowerCase().includes('gatt server is disconnected') ||
        errMsg.toLowerCase().includes('terputus');

      if (isDisconnected) {
        if (this.connectionManager && typeof this.connectionManager.handleUnexpectedDisconnect === 'function') {
          this.connectionManager.handleUnexpectedDisconnect(
            'Koneksi GATT printer Bluetooth BLE terputus saat proses pencetakan berlangsung.'
          );
        }
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.DEVICE_DISCONNECTED,
          adapter: this.name,
          physicalPrintConfirmed: false,
          error: errMsg,
          message: 'Koneksi GATT printer Bluetooth BLE terputus secara fisik saat transfer data berlangsung.'
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
          message: 'Akses ke perangkat printer Bluetooth BLE ditolak oleh sistem operasi atau kebijakan browser.'
        };
      }

      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.TRANSFER_ERROR,
        adapter: this.name,
        physicalPrintConfirmed: false,
        error: errMsg,
        message: `Gagal mengirim data ke printer Bluetooth BLE: ${errMsg}`
      };
    } finally {
      // Safe Cleanup ONLY if no active write timed out and connection is not persistently managed
      if (!timedOutDuringTransfer) {
        const keepOpen = Boolean(options.keepOpen || isManagedConnection);
        if (connectedByUs && !keepOpen && gattServer && gattServer.connected) {
          try {
            if (typeof gattServer.disconnect === 'function') {
              gattServer.disconnect();
            }
          } catch {
            // Ignore disconnect error during finally
          }
        }
      }
    }
  }
}

export const defaultBluetoothBLEPrintAdapter = new BluetoothBLEPrintAdapter();

export default BluetoothBLEPrintAdapter;
