/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 3: PrinterConnectionManager
 *
 * Manages printer connection lifecycle states:
 * - DISCONNECTED
 * - CONNECTING
 * - CONNECTED
 * - ERROR
 *
 * Provides connect, disconnect, and unexpected-disconnection recovery.
 * Note: Direct ESC/POS byte transmission over USB/BLE is intentionally deferred to Phase 4.
 */

import {
  CONNECTION_STATUS,
  loadWorkstationPrinterConfig,
  saveWorkstationPrinterConfig
} from '../config/PrinterConfiguration.js';
import {
  mapUsbDeviceToMetadata,
  mapBluetoothDeviceToMetadata,
  requestUsbPrinterByUserGesture,
  requestBluetoothPrinterByUserGesture
} from './PrinterDiscovery.js';

export { CONNECTION_STATUS };

export class PrinterConnectionManager {
  constructor(options = {}) {
    this.storage = options.storage || null;
    this.envWindow = options.envWindow || (typeof window !== 'undefined' ? window : null);
    this.envNavigator = options.envNavigator || (typeof navigator !== 'undefined' ? navigator : null);

    const initialConfig = loadWorkstationPrinterConfig({ storage: this.storage }).config;

    /** @type {{ status: string, adapter: string, deviceMetadata: any, printerDisplayName: string, directEscPosTransmissionReady: boolean, statusMessage: string, errorMessage: string | null, updatedAt: string }} */
    this.state = {
      status: CONNECTION_STATUS.DISCONNECTED,
      adapter: initialConfig.preferredAdapter || 'browser',
      deviceMetadata: initialConfig.pairedDeviceMetadata || null,
      printerDisplayName: initialConfig.printerDisplayName || 'Browser / System Print',
      directEscPosTransmissionReady: false,
      statusMessage: 'Siap melalui Dialog Cetak Browser / Sistem OS.',
      errorMessage: null,
      updatedAt: new Date().toISOString()
    };

    this.activeDeviceHandle = null;
    this.listeners = new Set();
    this._boundBleDisconnect = null;

    this._attachGlobalHardwareListeners();
  }

  _attachGlobalHardwareListeners() {
    if (this.envNavigator?.usb && typeof this.envNavigator.usb.addEventListener === 'function') {
      this._usbDisconnectListener = (event) => {
        const disconnectedDevice = event?.device;
        if (!disconnectedDevice) return;
        const meta = mapUsbDeviceToMetadata(disconnectedDevice);
        if (
          this.state.deviceMetadata &&
          (this.state.deviceMetadata.id === meta?.id ||
            (this.state.deviceMetadata.vendorId === meta?.vendorId &&
              this.state.deviceMetadata.productId === meta?.productId))
        ) {
          this.handleUnexpectedDisconnect(
            `Perangkat USB "${this.state.deviceMetadata.name}" terputus secara fisik.`
          );
        }
      };
      this.envNavigator.usb.addEventListener('disconnect', this._usbDisconnectListener);
    }
  }

  getState() {
    return { ...this.state };
  }

  /**
   * @param {(state: any) => void} listener
   */
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  _setState(patch) {
    this.state = {
      ...this.state,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    saveWorkstationPrinterConfig(
      {
        lastConnectionStatus: this.state.status,
        pairedDeviceMetadata: this.state.deviceMetadata,
        printerDisplayName: this.state.printerDisplayName
      },
      { storage: this.storage }
    );

    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Ignore subscriber error
      }
    }
    return snapshot;
  }

  /**
   * Activates Browser / System Print mode
   */
  connectBrowserSystemPrint() {
    return this._setState({
      status: CONNECTION_STATUS.CONNECTED,
      adapter: 'browser',
      printerDisplayName: 'Browser / System Print (OS Spooler)',
      directEscPosTransmissionReady: false,
      statusMessage:
        'Mode Browser / System Print aktif. Pencetakan dilakukan melalui dialog cetak sistem operasi.',
      errorMessage: null
    });
  }

  /**
   * Pairs and connects a USB printer device (Phase 3 permission & state management;
   * direct ESC/POS transmission is enabled in Phase 4).
   */
  async pairAndConnectUsb(options = {}) {
    this._setState({
      status: CONNECTION_STATUS.CONNECTING,
      adapter: 'webusb',
      statusMessage: 'Meminta izin akses perangkat USB dari pengguna...',
      errorMessage: null
    });

    const discoveryRes = await requestUsbPrinterByUserGesture(
      options,
      this.envWindow,
      this.envNavigator
    );

    if (!discoveryRes.ok) {
      if (discoveryRes.cancelled) {
        return this._setState({
          status: CONNECTION_STATUS.DISCONNECTED,
          statusMessage: discoveryRes.message,
          errorMessage: null
        });
      }
      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        statusMessage: 'Gagal menghubungkan perangkat USB.',
        errorMessage: discoveryRes.message
      });
    }

    return this.connectPermittedUsbDevice(discoveryRes.device, discoveryRes.metadata);
  }

  /**
   * Connects to an already permitted USBDevice object
   */
  async connectPermittedUsbDevice(usbDevice, providedMeta = null) {
    const metadata = providedMeta || mapUsbDeviceToMetadata(usbDevice);
    if (!metadata) {
      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        adapter: 'webusb',
        statusMessage: 'Metadata perangkat USB tidak valid.',
        errorMessage: 'Perangkat USB tidak dikenali.'
      });
    }

    this._setState({
      status: CONNECTION_STATUS.CONNECTING,
      adapter: 'webusb',
      deviceMetadata: metadata,
      printerDisplayName: metadata.name,
      statusMessage: `Menghubungkan ke ${metadata.name}...`,
      errorMessage: null
    });

    try {
      this.activeDeviceHandle = usbDevice || null;
      return this._setState({
        status: CONNECTION_STATUS.CONNECTED,
        adapter: 'webusb',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: false,
        statusMessage: `Perangkat USB "${metadata.name}" terhubung & terdaftar di workstation ini. (Catatan: Transmisi langsung ESC/POS diaktifkan pada Phase 4; Test Print saat ini menggunakan Browser/System Print).`,
        errorMessage: null
      });
    } catch (err) {
      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        adapter: 'webusb',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: false,
        statusMessage: `Gagal membuka koneksi USB ke "${metadata.name}".`,
        errorMessage: err?.message || String(err)
      });
    }
  }

  /**
   * Pairs and connects a Bluetooth BLE printer device (Phase 3 permission & state management;
   * direct ESC/POS transmission is enabled in Phase 4).
   */
  async pairAndConnectBluetooth(options = {}) {
    this._setState({
      status: CONNECTION_STATUS.CONNECTING,
      adapter: 'webbluetooth',
      statusMessage: 'Meminta pemilihan perangkat Bluetooth BLE dari pengguna...',
      errorMessage: null
    });

    const discoveryRes = await requestBluetoothPrinterByUserGesture(
      options,
      this.envWindow,
      this.envNavigator
    );

    if (!discoveryRes.ok) {
      if (discoveryRes.cancelled) {
        return this._setState({
          status: CONNECTION_STATUS.DISCONNECTED,
          statusMessage: discoveryRes.message,
          errorMessage: null
        });
      }
      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        statusMessage: 'Gagal memindai perangkat Bluetooth BLE.',
        errorMessage: discoveryRes.message
      });
    }

    return this.connectPermittedBluetoothDevice(discoveryRes.device, discoveryRes.metadata);
  }

  /**
   * Connects to an already permitted BluetoothDevice object
   */
  async connectPermittedBluetoothDevice(btDevice, providedMeta = null) {
    const metadata = providedMeta || mapBluetoothDeviceToMetadata(btDevice);
    if (!metadata) {
      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        adapter: 'webbluetooth',
        statusMessage: 'Metadata perangkat Bluetooth tidak valid.',
        errorMessage: 'Perangkat Bluetooth tidak dikenali.'
      });
    }

    this._setState({
      status: CONNECTION_STATUS.CONNECTING,
      adapter: 'webbluetooth',
      deviceMetadata: metadata,
      printerDisplayName: metadata.name,
      statusMessage: `Menyambungkan ke perangkat BLE "${metadata.name}"...`,
      errorMessage: null
    });

    try {
      if (btDevice && typeof btDevice.addEventListener === 'function') {
        if (this.activeDeviceHandle && this._boundBleDisconnect && typeof this.activeDeviceHandle.removeEventListener === 'function') {
          this.activeDeviceHandle.removeEventListener('gattserverdisconnected', this._boundBleDisconnect);
        }
        this._boundBleDisconnect = () => {
          this.handleUnexpectedDisconnect(
            `Koneksi Bluetooth BLE ke "${metadata.name}" terputus.`
          );
        };
        btDevice.addEventListener('gattserverdisconnected', this._boundBleDisconnect);
      }

      this.activeDeviceHandle = btDevice || null;

      return this._setState({
        status: CONNECTION_STATUS.CONNECTED,
        adapter: 'webbluetooth',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: false,
        statusMessage: `Perangkat BLE "${metadata.name}" berhasil dipasangkan. (Catatan: Transmisi langsung ESC/POS BLE diaktifkan pada Phase 4; Test Print saat ini menggunakan Browser/System Print).`,
        errorMessage: null
      });
    } catch (err) {
      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        adapter: 'webbluetooth',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: false,
        statusMessage: `Gagal menyambungkan ke perangkat BLE "${metadata.name}".`,
        errorMessage: err?.message || String(err)
      });
    }
  }

  /**
   * Disconnects the active device and resets status to DISCONNECTED
   */
  async disconnect() {
    try {
      if (this.activeDeviceHandle) {
        if (
          this._boundBleDisconnect &&
          typeof this.activeDeviceHandle.removeEventListener === 'function'
        ) {
          this.activeDeviceHandle.removeEventListener(
            'gattserverdisconnected',
            this._boundBleDisconnect
          );
        }
        if (this.activeDeviceHandle.gatt?.connected && typeof this.activeDeviceHandle.gatt.disconnect === 'function') {
          this.activeDeviceHandle.gatt.disconnect();
        }
        if (this.activeDeviceHandle.opened && typeof this.activeDeviceHandle.close === 'function') {
          await this.activeDeviceHandle.close();
        }
      }
    } catch {
      // Ignore hardware close error during disconnect
    } finally {
      this.activeDeviceHandle = null;
      this._boundBleDisconnect = null;
    }

    return this._setState({
      status: CONNECTION_STATUS.DISCONNECTED,
      directEscPosTransmissionReady: false,
      statusMessage: 'Perangkat printer telah diputuskan (Disconnected).',
      errorMessage: null
    });
  }

  /**
   * Handles unexpected physical disconnection (unplugged USB or powered-off BLE printer)
   */
  handleUnexpectedDisconnect(reason = 'Koneksi perangkat printer terputus.') {
    this.activeDeviceHandle = null;
    return this._setState({
      status: CONNECTION_STATUS.DISCONNECTED,
      directEscPosTransmissionReady: false,
      statusMessage: reason,
      errorMessage: reason
    });
  }
}

export const defaultPrinterConnectionManager = new PrinterConnectionManager();

export default PrinterConnectionManager;
