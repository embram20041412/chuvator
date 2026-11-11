/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 4.3: LocalPrintBridgeAdapter
 *
 * Frontend web application adapter communicating with Local Print Bridge service (http://127.0.0.1:9123)
 * for Bluetooth Classic SPP, USB OS Driver, Network TCP/IP, and OS Print Spoolers.
 */

import {
  PRINT_ADAPTERS,
  PRINT_EXECUTION_STATUS,
  validateNormalizedPrintDocument
} from '../types/printTypes.js';
import {
  normalizePrintDocument
} from '../templates/ReceiptTemplateEngine.js';
import { encodeEscPosDocument } from '../templates/EscPosEncoder.js';

export const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:9123';

export class LocalPrintBridgeAdapter {
  constructor(options = {}) {
    this.name = 'LocalPrintBridgeAdapter';
    this.adapterKey = PRINT_ADAPTERS.LOCAL_BRIDGE; // 'bridge'
    this.bridgeUrl = (options.bridgeUrl || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
    this.token = options.token || options.bridgeToken || null;
    this.fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.timeoutMs = options.timeoutMs || 10000;
  }

  setToken(token) {
    this.token = token ? String(token).trim() : null;
  }

  setBridgeUrl(url) {
    if (url) {
      this.bridgeUrl = String(url).replace(/\/+$/, '');
    }
  }

  /**
   * Helper method to perform HTTP fetch with timeout handling
   */
  async _fetchWithTimeout(url, options = {}) {
    if (!this.fetchImpl) {
      throw new Error('Environment fetch API tidak tersedia.');
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs)
      : null;

    try {
      const response = await this.fetchImpl(url, {
        ...options,
        signal: controller?.signal
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Permintaan ke Local Print Bridge (${url}) mengalami timeout.`);
      }
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Checks whether the Local Print Bridge service is running and healthy
   */
  async checkHealth() {
    try {
      const res = await this._fetchWithTimeout(`${this.bridgeUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        timeoutMs: 3000
      });

      if (!res.ok) {
        return {
          online: false,
          status: 'OFFLINE',
          message: `Local Print Bridge merespons dengan HTTP ${res.status}.`
        };
      }

      const json = await res.json();
      return {
        online: true,
        status: json.status || 'ONLINE',
        version: json.version || '1.0.0',
        requireAuth: json.requireAuth ?? true,
        message: `Local Print Bridge aktif di ${this.bridgeUrl}.`
      };
    } catch (err) {
      return {
        online: false,
        status: 'UNREACHABLE',
        message: `Tidak dapat terhubung ke Local Print Bridge di ${this.bridgeUrl}. Pastikan service bridge sudah dijalankan (npm start di folder local-print-bridge).`
      };
    }
  }

  /**
   * Registers or pairs a security token with the bridge
   * @param {string | null} [requestedToken]
   */
  async pair(requestedToken = null) {
    try {
      const res = await this._fetchWithTimeout(`${this.bridgeUrl}/api/v1/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ token: requestedToken }),
        timeoutMs: 5000
      });

      if (!res.ok) {
        return {
          ok: false,
          message: `Gagal melakukan pairing token (HTTP ${res.status}).`
        };
      }

      const json = await res.json();
      if (json.token) {
        this.setToken(json.token);
      }

      return {
        ok: true,
        token: json.token,
        message: json.message || 'Pairing token bridge berhasil.'
      };
    } catch (err) {
      return {
        ok: false,
        message: `Gagal menyambungkan pairing bridge: ${err.message}`
      };
    }
  }

  /**
   * Fetches the list of printers connected to the bridge workstation
   */
  async discoverPrinters() {
    if (!this.token) {
      // Try pairing automatically if no token is set
      const pairRes = await this.pair();
      if (!pairRes.ok) {
        return {
          ok: false,
          printers: [],
          message: 'Token otentikasi Local Print Bridge belum dikonfigurasi.'
        };
      }
    }

    try {
      const res = await this._fetchWithTimeout(`${this.bridgeUrl}/api/v1/printers`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Bridge-Token': this.token || ''
        },
        timeoutMs: 5000
      });

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          printers: [],
          message: 'Token otentikasi bridge tidak valid. Silakan lakukan pairing ulang.'
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          printers: [],
          message: `Gagal memindai printer bridge (HTTP ${res.status}).`
        };
      }

      const json = await res.json();
      return {
        ok: true,
        printers: json.printers || [],
        count: json.count || 0,
        message: `Berhasil menemukan ${json.printers?.length || 0} printer pada Local Print Bridge.`
      };
    } catch (err) {
      return {
        ok: false,
        printers: [],
        message: `Gagal terhubung ke Local Print Bridge saat discovery: ${err.message}`
      };
    }
  }

  /**
   * Core adapter method: prints a NormalizedPrintDocument via the Local Print Bridge service.
   * @param {any} rawInput
   * @param {object} options
   */
  async print(rawInput, options = {}) {
    const normalizedDoc = normalizePrintDocument(rawInput, options);
    const validation = validateNormalizedPrintDocument(normalizedDoc);

    if (!validation.valid) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.FAILED,
        adapter: this.adapterKey,
        physicalPrintConfirmed: false,
        errors: validation.errors,
        message: `Dokumen cetak tidak valid: ${validation.errors.join(', ')}`
      };
    }

    const isThermal = normalizedDoc.paper.category === 'thermal';
    let escPosBase64 = null;

    if (isThermal) {
      const escPosEncoded = encodeEscPosDocument(normalizedDoc, {
        columns: normalizedDoc.paper.columns,
        cutPaper: normalizedDoc.renderOptions.cutPaper,
        feedLines: normalizedDoc.renderOptions.feedLines,
        ...(options.escPosOptions || {})
      });
      if (escPosEncoded && escPosEncoded.bytes) {
        if (typeof Buffer !== 'undefined') {
          escPosBase64 = Buffer.from(escPosEncoded.bytes).toString('base64');
        } else {
          let binary = '';
          const bytes = new Uint8Array(escPosEncoded.bytes);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          escPosBase64 = typeof btoa === 'function' ? btoa(binary) : null;
        }
      }
    }

    const activeToken = options.token || options.bridgeToken || this.token;
    if (!activeToken) {
      // Auto pair if needed
      const autoPair = await this.pair();
      if (!autoPair.ok) {
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.FAILED,
          adapter: this.adapterKey,
          physicalPrintConfirmed: false,
          message: 'Token otentikasi Local Print Bridge belum dikonfigurasi.'
        };
      }
    }

    const payloadBody = {
      printerType: options.printerType || (isThermal ? 'bluetooth_spp' : 'os_spooler'),
      connectionDetails: options.connectionDetails || {
        path: options.serialPath || options.comPort || 'COM3',
        printerName: options.printerName || 'Default OS Printer'
      },
      escPosBase64,
      payload: normalizedDoc
    };

    try {
      const res = await this._fetchWithTimeout(`${this.bridgeUrl}/api/v1/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Bridge-Token': activeToken || this.token || ''
        },
        body: JSON.stringify(payloadBody),
        timeoutMs: options.timeoutMs || this.timeoutMs
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        return {
          ok: false,
          status: PRINT_EXECUTION_STATUS.TRANSFER_ERROR,
          adapter: this.adapterKey,
          physicalPrintConfirmed: false,
          message: errorJson.message || `Local Print Bridge mengembalikan error HTTP ${res.status}.`
        };
      }

      const json = await res.json();
      return {
        ok: true,
        status: PRINT_EXECUTION_STATUS.SUCCESS,
        adapter: this.adapterKey,
        physicalPrintConfirmed: true,
        jobId: json.jobId,
        jobStatus: json.status,
        message: json.message || `Pekerjaan cetak ${normalizedDoc.receiptNo} berhasil dikirim ke Local Print Bridge.`
      };
    } catch (err) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.TRANSFER_ERROR,
        adapter: this.adapterKey,
        physicalPrintConfirmed: false,
        message: `Gagal mengirim dokumen ke Local Print Bridge: ${err.message}`
      };
    }
  }
}

export default LocalPrintBridgeAdapter;
