/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: PrintEngine
 *
 * Central execution engine using the Adapter Pattern.
 * Coordinates ReceiptTemplateEngine, BrowserPrintAdapter, PDFGenerator, and EscPosEncoder.
 * Designed so WebUSB, WebBluetooth, and LocalBridge adapters can be registered in Phase 4
 * without changing any transaction module or caller interface.
 */

import {
  PRINT_ADAPTERS,
  PRINT_EXECUTION_STATUS,
  validateNormalizedPrintDocument
} from '../types/printTypes.js';
import {
  normalizePrintDocument,
  formatThermalTextLines
} from '../templates/ReceiptTemplateEngine.js';
import { encodeEscPosDocument } from '../templates/EscPosEncoder.js';
import {
  BrowserPrintAdapter,
  buildIsolatedPrintHtml
} from '../adapters/BrowserPrintAdapter.js';
import {
  WebUSBPrintAdapter
} from '../adapters/WebUSBPrintAdapter.js';
import {
  BluetoothBLEPrintAdapter
} from '../adapters/BluetoothBLEPrintAdapter.js';
import {
  LocalPrintBridgeAdapter
} from '../adapters/LocalPrintBridgeAdapter.js';
import {
  generatePDFDocument,
  downloadPDFDocument
} from '../pdf/PDFGenerator.js';

export class PrintEngine {
  constructor(options = {}) {
    this.adapters = new Map();
    // Register default Phase 2 Browser/System Print Adapter
    this.registerAdapter(
      PRINT_ADAPTERS.BROWSER,
      options.browserAdapter || new BrowserPrintAdapter()
    );
    // Register Phase 4.1 Direct WebUSB Print Adapter
    this.registerAdapter(
      PRINT_ADAPTERS.WEB_USB,
      options.webUsbAdapter || new WebUSBPrintAdapter(options.webUsbOptions || {})
    );
    // Register Phase 4.2 Direct Bluetooth BLE Print Adapter
    const bleAdapter = options.bluetoothBleAdapter || new BluetoothBLEPrintAdapter(options.bluetoothBleOptions || {});
    this.registerAdapter(PRINT_ADAPTERS.WEB_BLUETOOTH, bleAdapter);
    if (PRINT_ADAPTERS.BLUETOOTH_BLE) {
      this.registerAdapter(PRINT_ADAPTERS.BLUETOOTH_BLE, bleAdapter);
    }
    // Register Phase 4.3 Local Print Bridge Adapter
    const bridgeAdapter = options.localBridgeAdapter || new LocalPrintBridgeAdapter(options.localBridgeOptions || {});
    this.registerAdapter(PRINT_ADAPTERS.LOCAL_BRIDGE, bridgeAdapter);
  }

  /**
   * Registers a printer execution adapter (e.g., 'browser', 'webusb', 'webbluetooth', 'bridge')
   */
  registerAdapter(adapterName, adapterInstance) {
    if (!adapterName || !adapterInstance || typeof adapterInstance.print !== 'function') {
      throw new Error(`Invalid print adapter registration for "${adapterName}"`);
    }
    this.adapters.set(String(adapterName).toLowerCase(), adapterInstance);
    return this;
  }

  /**
   * @param {string} [adapterName]
   */
  getAdapter(adapterName = PRINT_ADAPTERS.BROWSER) {
    return this.adapters.get(String(adapterName).toLowerCase()) || null;
  }

  listRegisteredAdapters() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Builds a complete, validated print payload from raw or pre-normalized data.
   * Includes:
   * - normalizedDoc (NormalizedPrintDocument)
   * - validation ({ valid, errors })
   * - thermalLines (32 or 48 column formatted lines)
   * - htmlContent (isolated print HTML document)
   * - escPos (encoded ESC/POS byte stream & metadata)
   */
  buildPrintPayload(rawInput, options = {}) {
    const normalizedDoc = normalizePrintDocument(rawInput, options);
    const validation = validateNormalizedPrintDocument(normalizedDoc);
    const isThermal = normalizedDoc.paper.category === 'thermal';

    const thermalLines = isThermal
      ? formatThermalTextLines(normalizedDoc, normalizedDoc.paper.columns)
      : [];

    const htmlContent = buildIsolatedPrintHtml(normalizedDoc, options);

    const escPos = isThermal
      ? encodeEscPosDocument(normalizedDoc, {
          columns: normalizedDoc.paper.columns,
          cutPaper: normalizedDoc.renderOptions.cutPaper,
          feedLines: normalizedDoc.renderOptions.feedLines,
          ...(options.escPosOptions || {})
        })
      : null;

    return {
      ok: validation.valid,
      status: PRINT_EXECUTION_STATUS.PAYLOAD_BUILT,
      normalizedDoc,
      validation,
      thermalLines,
      htmlContent,
      escPos
    };
  }

  /**
   * Executes printing through the requested adapter (defaults to BrowserPrintAdapter)
   */
  async printDocument(rawInput, options = {}) {
    const adapterKey = String(options.adapter || PRINT_ADAPTERS.BROWSER).toLowerCase();
    const normalizedDoc = normalizePrintDocument(rawInput, options);
    const validation = validateNormalizedPrintDocument(normalizedDoc);

    if (!validation.valid) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.FAILED,
        adapter: adapterKey,
        physicalPrintConfirmed: false,
        errors: validation.errors,
        message: `Dokumen cetak tidak valid: ${validation.errors.join(', ')}`
      };
    }

    if (adapterKey === PRINT_ADAPTERS.PDF) {
      return this.downloadPDF(normalizedDoc, options);
    }

    const adapter = this.getAdapter(adapterKey);
    if (!adapter) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.FAILED,
        adapter: adapterKey,
        physicalPrintConfirmed: false,
        message: `Adapter printer "${adapterKey}" belum terdaftar atau belum diaktifkan.`
      };
    }

    return adapter.print(normalizedDoc, options);
  }

  /**
   * Generates a PDF document and triggers download (unless skipBrowserDownload is set)
   */
  async downloadPDF(rawInput, options = {}) {
    const normalizedDoc = normalizePrintDocument(rawInput, options);
    return downloadPDFDocument(normalizedDoc, options);
  }

  /**
   * Generates PDF bytes and jsPDF instance in memory without triggering browser save dialog
   */
  async generatePDF(rawInput, options = {}) {
    const normalizedDoc = normalizePrintDocument(rawInput, options);
    return generatePDFDocument(normalizedDoc, options);
  }
}

export const defaultPrintEngine = new PrintEngine();

export default defaultPrintEngine;
