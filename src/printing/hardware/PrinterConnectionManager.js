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
  mapBridgeDeviceToMetadata,
  requestUsbPrinterByUserGesture,
  requestBluetoothPrinterByUserGesture
} from './PrinterDiscovery.js';
import {
  findPrinterUsbInterfaceAndEndpoint
} from '../adapters/WebUSBPrintAdapter.js';
import {
  findWritableGattCharacteristic
} from '../adapters/BluetoothBLEPrintAdapter.js';
import {
  LocalPrintBridgeAdapter
} from '../adapters/LocalPrintBridgeAdapter.js';

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
    this.activeEndpointInfo = null;
    this.isInterfaceClaimed = false;
    this.listeners = new Set();
    this._boundBleDisconnect = null;
    this._usbDisconnectListener = null;

    this._attachGlobalHardwareListeners();
  }

  _attachGlobalHardwareListeners() {
    if (this.envNavigator?.usb && typeof this.envNavigator.usb.addEventListener === 'function') {
      if (this._usbDisconnectListener && typeof this.envNavigator.usb.removeEventListener === 'function') {
        this.envNavigator.usb.removeEventListener('disconnect', this._usbDisconnectListener);
      }
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
      if (!usbDevice.opened && typeof usbDevice.open === 'function') {
        await usbDevice.open();
      }

      let endpointInfo = findPrinterUsbInterfaceAndEndpoint(usbDevice);
      if (!endpointInfo && Array.isArray(usbDevice.configurations) && usbDevice.configurations.length > 0) {
        const firstConfig = usbDevice.configurations[0];
        if (typeof usbDevice.selectConfiguration === 'function') {
          await usbDevice.selectConfiguration(firstConfig.configurationValue ?? 1);
        }
        endpointInfo = findPrinterUsbInterfaceAndEndpoint(usbDevice);
      }

      if (!endpointInfo) {
        if (usbDevice.opened && typeof usbDevice.close === 'function') {
          try {
            await usbDevice.close();
          } catch {}
        }
        return this._setState({
          status: CONNECTION_STATUS.ERROR,
          adapter: 'webusb',
          deviceMetadata: metadata,
          printerDisplayName: metadata.name,
          directEscPosTransmissionReady: false,
          statusMessage: `Perangkat USB "${metadata.name}" tidak memiliki interface printer atau endpoint OUT yang kompatibel.`,
          errorMessage: 'Interface atau endpoint printer USB tidak kompatibel.'
        });
      }

      if (typeof usbDevice.claimInterface === 'function') {
        await usbDevice.claimInterface(endpointInfo.interfaceNumber);
      }

      this.activeDeviceHandle = usbDevice;
      this.activeEndpointInfo = endpointInfo;
      this.isInterfaceClaimed = true;

      return this._setState({
        status: CONNECTION_STATUS.CONNECTED,
        adapter: 'webusb',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: true,
        statusMessage: `Perangkat USB "${metadata.name}" berhasil terhubung dan antarmuka berhasil diklaim untuk pencetakan ESC/POS langsung.`,
        errorMessage: null
      });
    } catch (err) {
      if (usbDevice && usbDevice.opened && typeof usbDevice.close === 'function') {
        try {
          await usbDevice.close();
        } catch {}
      }
      this.activeDeviceHandle = null;
      this.activeEndpointInfo = null;
      this.isInterfaceClaimed = false;

      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        adapter: 'webusb',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: false,
        statusMessage: `Gagal membuka koneksi dan mengklaim interface USB "${metadata.name}": ${err?.message || String(err)}`,
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

      let gattServer = btDevice.gatt || null;
      if (gattServer && typeof gattServer.connect === 'function' && !gattServer.connected) {
        gattServer = await gattServer.connect();
      }

      let targetGatt = null;
      if (gattServer && gattServer.connected) {
        targetGatt = await findWritableGattCharacteristic(gattServer);
      }

      if (!targetGatt || !targetGatt.characteristic) {
        if (gattServer && gattServer.connected && typeof gattServer.disconnect === 'function') {
          try {
            gattServer.disconnect();
          } catch {}
        }
        return this._setState({
          status: CONNECTION_STATUS.ERROR,
          adapter: 'webbluetooth',
          deviceMetadata: metadata,
          printerDisplayName: metadata.name,
          directEscPosTransmissionReady: false,
          statusMessage: `Perangkat BLE "${metadata.name}" tersambung tetapi tidak memiliki Service atau Characteristic penulisan yang valid.`,
          errorMessage: 'Characteristic penulisan BLE tidak ditemukan.'
        });
      }

      this.activeDeviceHandle = btDevice;
      this.activeGattServer = gattServer;
      this.activeGattService = targetGatt.service;
      this.activeGattCharacteristic = targetGatt.characteristic;
      this.activeGattWriteMethod = targetGatt.writeMethod;
      this.isGattConnected = true;

      return this._setState({
        status: CONNECTION_STATUS.CONNECTED,
        adapter: 'webbluetooth',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: true,
        statusMessage: `Perangkat BLE "${metadata.name}" berhasil terhubung dan GATT Characteristic teridentifikasi untuk pencetakan ESC/POS langsung.`,
        errorMessage: null
      });
    } catch (err) {
      if (btDevice?.gatt?.connected && typeof btDevice.gatt.disconnect === 'function') {
        try {
          btDevice.gatt.disconnect();
        } catch {}
      }
      this.activeDeviceHandle = null;
      this.activeGattServer = null;
      this.activeGattService = null;
      this.activeGattCharacteristic = null;
      this.isGattConnected = false;

      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        adapter: 'webbluetooth',
        deviceMetadata: metadata,
        printerDisplayName: metadata.name,
        directEscPosTransmissionReady: false,
        statusMessage: `Gagal menyambungkan ke perangkat BLE "${metadata.name}": ${err?.message || String(err)}`,
        errorMessage: err?.message || String(err)
      });
    }
  }

  /**
   * Pairs and connects to Local Print Bridge service (Phase 4.3)
   */
  async pairAndConnectLocalBridge(options = {}) {
    const bridgeUrl = options.bridgeUrl || 'http://127.0.0.1:9123';
    this._setState({
      status: CONNECTION_STATUS.CONNECTING,
      adapter: 'bridge',
      statusMessage: `Menghubungkan ke Local Print Bridge di ${bridgeUrl}...`,
      errorMessage: null
    });

    try {
      const bridgeAdapter = options.bridgeAdapter || new LocalPrintBridgeAdapter({ bridgeUrl, ...options });
      const health = await bridgeAdapter.checkHealth();

      if (!health.online) {
        return this._setState({
          status: CONNECTION_STATUS.ERROR,
          adapter: 'bridge',
          directEscPosTransmissionReady: false,
          statusMessage: health.message,
          errorMessage: health.message
        });
      }

      const pairRes = await bridgeAdapter.pair(options.token);
      const meta = mapBridgeDeviceToMetadata(options.device || {
        id: 'bridge-local-daemon',
        name: options.printerDisplayName || 'Local Print Bridge (Bluetooth Classic SPP / USB OS)',
        type: options.printerType || 'bluetooth_spp'
      });

      return this._setState({
        status: CONNECTION_STATUS.CONNECTED,
        adapter: 'bridge',
        deviceMetadata: meta,
        printerDisplayName: meta.name,
        directEscPosTransmissionReady: true,
        statusMessage: `Local Print Bridge terhubung di ${bridgeUrl}. Transmisi pencetakan langsung aktif.`,
        errorMessage: null
      });
    } catch (err) {
      return this._setState({
        status: CONNECTION_STATUS.ERROR,
        adapter: 'bridge',
        directEscPosTransmissionReady: false,
        statusMessage: `Gagal terhubung ke Local Print Bridge: ${err?.message || String(err)}`,
        errorMessage: err?.message || String(err)
      });
    }
  }

  /**
   * Connects to a selected bridge printer device
   */
  connectPermittedBridgeDevice(bridgeDevice, providedMeta = null) {
    const metadata = providedMeta || mapBridgeDeviceToMetadata(bridgeDevice);
    return this._setState({
      status: CONNECTION_STATUS.CONNECTED,
      adapter: 'bridge',
      deviceMetadata: metadata,
      printerDisplayName: metadata?.name || 'Local Print Bridge Printer',
      directEscPosTransmissionReady: true,
      statusMessage: `Printer Local Print Bridge "${metadata?.name}" berhasil dipilih.`,
      errorMessage: null
    });
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
        if (this.isInterfaceClaimed && this.activeEndpointInfo && typeof this.activeDeviceHandle.releaseInterface === 'function') {
          try {
            await this.activeDeviceHandle.releaseInterface(this.activeEndpointInfo.interfaceNumber);
          } catch {
            // Ignore release error
          }
        }
        if (this.activeDeviceHandle.opened && typeof this.activeDeviceHandle.close === 'function') {
          await this.activeDeviceHandle.close();
        }
      }
    } catch {
      // Ignore hardware close error during disconnect
    } finally {
      this.activeDeviceHandle = null;
      this.activeEndpointInfo = null;
      this.activeGattServer = null;
      this.activeGattService = null;
      this.activeGattCharacteristic = null;
      this.isInterfaceClaimed = false;
      this.isGattConnected = false;
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
    this.activeEndpointInfo = null;
    this.activeGattServer = null;
    this.activeGattService = null;
    this.activeGattCharacteristic = null;
    this.isInterfaceClaimed = false;
    this.isGattConnected = false;
    this._boundBleDisconnect = null;
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
