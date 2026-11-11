/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: EscPosEncoder
 *
 * Catatan Teknis Standar:
 * ESC/POS® adalah set perintah proprietary yang dikembangkan oleh Seiko Epson Corporation
 * (bukan standar ISO/IEC). Dukungan perintah ESC/POS, code page (tabel karakter),
 * dan pemotong kertas otomatis (auto-cutter) bergantung pada kompatibilitas firmware
 * dan spesifikasi fisik masing-masing vendor printer.
 *
 * Pure JS ESC/POS formatter and byte-stream encoder for 58mm (32-col) and 80mm (48-col)
 * thermal printers. Supports configurable hardware capability profiles so printers
 * with limited ESC/POS dialects can safely fall back to software padding / LF feeds
 * and optional paper cutting.
 */

import {
  formatRupiah,
  wrapText,
  centerText,
  formatTwoColumns,
  normalizePrintDocument
} from './ReceiptTemplateEngine.js';

export const ESC_POS_COMMANDS = Object.freeze({
  INIT: [0x1b, 0x40], // ESC @
  LF: [0x0a], // Line Feed
  CR: [0x0d], // Carriage Return
  ALIGN_LEFT: [0x1b, 0x61, 0x00], // ESC a 0
  ALIGN_CENTER: [0x1b, 0x61, 0x01], // ESC a 1
  ALIGN_RIGHT: [0x1b, 0x61, 0x02], // ESC a 2
  BOLD_ON: [0x1b, 0x45, 0x01], // ESC E 1
  BOLD_OFF: [0x1b, 0x45, 0x00], // ESC E 0
  CUT_FULL: [0x1d, 0x56, 0x00], // GS V 0
  CUT_PARTIAL: [0x1d, 0x56, 0x42, 0x00] // GS V 66 0
});

export const PRINTER_CAPABILITY_PROFILES = Object.freeze({
  STANDARD: Object.freeze({
    id: 'standard',
    supportsInit: true,
    supportsHardwareAlign: true,
    supportsHardwareBold: true,
    supportsEscFeedCommand: true,
    supportsPaperCut: true
  }),
  COMPATIBLE_SAFE: Object.freeze({
    id: 'compatible_safe',
    supportsInit: true,
    supportsHardwareAlign: false, // Uses software space padding (32/48 cols)
    supportsHardwareBold: true,
    supportsEscFeedCommand: false, // Uses standard LF (0x0A) bytes
    supportsPaperCut: false
  }),
  TEXT_ONLY: Object.freeze({
    id: 'text_only',
    supportsInit: false,
    supportsHardwareAlign: false,
    supportsHardwareBold: false,
    supportsEscFeedCommand: false,
    supportsPaperCut: false
  })
});

/**
 * Sanitizes Unicode characters into single-byte printable ASCII for thermal printers
 */
export function sanitizeThermalAscii(input) {
  const str = String(input ?? '');
  const normalized = str
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[•·]/g, '*')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  let result = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code === 0x0a || (code >= 0x20 && code <= 0x7e)) {
      result += normalized[i];
    } else {
      result += '?';
    }
  }
  return result;
}

export class EscPosEncoder {
  constructor(options = {}) {
    const profileKey = String(options.profile || 'STANDARD').toUpperCase();
    const baseProfile =
      PRINTER_CAPABILITY_PROFILES[profileKey] ||
      PRINTER_CAPABILITY_PROFILES.STANDARD;

    this.columns = Number(options.columns) === 48 ? 48 : (Number(options.columns) || 32);
    this.capabilities = {
      ...baseProfile,
      ...(options.capabilities || {})
    };
    this.cutPaper = Boolean(options.cutPaper ?? false);
    this.cutMode = options.cutMode === 'full' ? 'full' : 'partial';
    this.feedLinesCount = Number.isFinite(Number(options.feedLines))
      ? Math.max(0, Number(options.feedLines))
      : 3;

    this.buffer = [];
    this.commandLog = [];
    this.textLines = [];
    this.currentAlign = 'left';
    this.isBold = false;
  }

  _pushBytes(bytes) {
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i] & 0xff);
    }
    return this;
  }

  _encodeAsciiString(str) {
    const safe = sanitizeThermalAscii(str);
    const bytes = [];
    for (let i = 0; i < safe.length; i++) {
      bytes.push(safe.charCodeAt(i) & 0x7f);
    }
    return bytes;
  }

  initialize() {
    this.currentAlign = 'left';
    this.isBold = false;
    if (this.capabilities.supportsInit) {
      this._pushBytes(ESC_POS_COMMANDS.INIT);
      this.commandLog.push({ type: 'INIT' });
    }
    return this;
  }

  align(mode = 'left') {
    const normalized = ['left', 'center', 'right'].includes(mode) ? mode : 'left';
    this.currentAlign = normalized;

    if (this.capabilities.supportsHardwareAlign) {
      if (normalized === 'center') {
        this._pushBytes(ESC_POS_COMMANDS.ALIGN_CENTER);
      } else if (normalized === 'right') {
        this._pushBytes(ESC_POS_COMMANDS.ALIGN_RIGHT);
      } else {
        this._pushBytes(ESC_POS_COMMANDS.ALIGN_LEFT);
      }
      this.commandLog.push({ type: 'ALIGN', value: normalized });
    }
    return this;
  }

  bold(enabled = true) {
    const active = Boolean(enabled);
    this.isBold = active;

    if (this.capabilities.supportsHardwareBold) {
      this._pushBytes(active ? ESC_POS_COMMANDS.BOLD_ON : ESC_POS_COMMANDS.BOLD_OFF);
      this.commandLog.push({ type: 'BOLD', value: active });
    }
    return this;
  }

  line(rawText = '') {
    const wrapped = wrapText(sanitizeThermalAscii(rawText), this.columns);
    if (wrapped.length === 0) {
      this._pushBytes(ESC_POS_COMMANDS.LF);
      this.textLines.push('');
      return this;
    }

    for (const segment of wrapped) {
      let formattedLine = segment;
      if (!this.capabilities.supportsHardwareAlign) {
        if (this.currentAlign === 'center') {
          formattedLine = centerText(segment, this.columns)[0] || segment;
        } else if (this.currentAlign === 'right') {
          const pad = Math.max(0, this.columns - segment.length);
          formattedLine = ' '.repeat(pad) + segment;
        }
      }
      this._pushBytes(this._encodeAsciiString(formattedLine));
      this._pushBytes(ESC_POS_COMMANDS.LF);
      this.textLines.push(formattedLine);
    }
    return this;
  }

  twoColumns(leftText, rightText) {
    const prevAlign = this.currentAlign;
    if (prevAlign !== 'left') {
      this.align('left');
    }

    const formattedRows = formatTwoColumns(
      sanitizeThermalAscii(leftText),
      sanitizeThermalAscii(rightText),
      this.columns
    );

    for (const row of formattedRows) {
      this._pushBytes(this._encodeAsciiString(row));
      this._pushBytes(ESC_POS_COMMANDS.LF);
      this.textLines.push(row);
    }

    if (prevAlign !== 'left') {
      this.align(prevAlign);
    }
    return this;
  }

  separator(char = '-') {
    const safeChar = String(char || '-')[0];
    const sepLine = safeChar.repeat(this.columns);
    this._pushBytes(this._encodeAsciiString(sepLine));
    this._pushBytes(ESC_POS_COMMANDS.LF);
    this.textLines.push(sepLine);
    return this;
  }

  feed(lines = 1) {
    const count = Math.max(0, Math.min(255, Number(lines) || 0));
    if (count === 0) return this;

    if (this.capabilities.supportsEscFeedCommand) {
      this._pushBytes([0x1b, 0x64, count]); // ESC d n
    } else {
      for (let i = 0; i < count; i++) {
        this._pushBytes(ESC_POS_COMMANDS.LF);
      }
    }
    this.commandLog.push({ type: 'FEED', lines: count });
    return this;
  }

  cut(mode = this.cutMode) {
    if (!this.cutPaper || !this.capabilities.supportsPaperCut) {
      return this;
    }
    const bytes = mode === 'full' ? ESC_POS_COMMANDS.CUT_FULL : ESC_POS_COMMANDS.CUT_PARTIAL;
    this._pushBytes(bytes);
    this.commandLog.push({ type: 'CUT', mode });
    return this;
  }

  encode() {
    return new Uint8Array(this.buffer);
  }
}

/**
 * High-level helper to encode a NormalizedPrintDocument into ESC/POS bytes and metadata
 */
export function encodeEscPosDocument(rawOrNormalizedDoc, options = {}) {
  const doc = normalizePrintDocument(rawOrNormalizedDoc, options);
  const columns = Number(options.columns || doc.paper?.columns || 32);
  const cutPaper = Boolean(options.cutPaper ?? doc.renderOptions?.cutPaper ?? false);
  const feedLines = Number(options.feedLines ?? doc.renderOptions?.feedLines ?? 3);

  const encoder = new EscPosEncoder({
    ...options,
    columns,
    cutPaper,
    feedLines
  });

  encoder.initialize();

  // 1. Header / Tenant Identity
  encoder.align('center');
  if (doc.tenantIdentity.headerName) {
    encoder.bold(true).line(doc.tenantIdentity.headerName.toUpperCase()).bold(false);
  }
  if (doc.tenantIdentity.subTitle) {
    encoder.line(doc.tenantIdentity.subTitle.toUpperCase());
  }
  if (doc.tenantIdentity.address) {
    encoder.line(doc.tenantIdentity.address);
  }
  if (doc.tenantIdentity.contact) {
    encoder.line(doc.tenantIdentity.contact);
  }
  if (doc.meta.isReprint) {
    encoder.bold(true).line('*** CETAK ULANG (COPY) ***').bold(false);
  }

  encoder.align('left');
  encoder.separator('-');

  // 2. Meta
  encoder.twoColumns('No. Struk', doc.meta.receiptNo);
  const dateTimeStr = doc.meta.time ? `${doc.meta.date} ${doc.meta.time}` : doc.meta.date;
  encoder.twoColumns('Tanggal', dateTimeStr);
  if (doc.meta.cashierName && doc.meta.cashierName !== '-') {
    encoder.twoColumns('Kasir', doc.meta.cashierName);
  }
  if (doc.meta.customerName) {
    encoder.twoColumns('Pelanggan', doc.meta.customerName);
  }

  encoder.separator('-');

  // 3. Items
  for (const item of doc.items) {
    encoder.bold(true).line(item.name).bold(false);
    if (item.description) {
      encoder.line(item.description);
    }
    encoder.twoColumns(
      `${item.qty || 1} x ${formatRupiah(item.unitPrice)}`,
      formatRupiah(item.subtotal)
    );
  }

  encoder.separator('=');

  // 4. Summary & Payment
  encoder.bold(true).twoColumns('TOTAL', formatRupiah(doc.summary.total)).bold(false);
  encoder.twoColumns('Metode Bayar', doc.summary.paymentMethod);

  if (doc.renderOptions.showCashBreakdown) {
    encoder.twoColumns('Dibayar', formatRupiah(doc.summary.amountPaid));
    encoder.bold(true).twoColumns('Kembalian', formatRupiah(doc.summary.changeAmount)).bold(false);
  }

  if (doc.summary.status) {
    encoder.twoColumns('Status', doc.summary.status.toUpperCase());
  }

  if (doc.summary.notes) {
    encoder.separator('-');
    encoder.line(`Catatan: ${doc.summary.notes}`);
  }

  encoder.separator('-');

  // 5. Dynamic Tenant Footer
  if (doc.renderOptions.showFooterNote && doc.tenantIdentity.footerNote) {
    encoder.align('center').line(doc.tenantIdentity.footerNote).align('left');
  }

  encoder.feed(feedLines);
  if (cutPaper) {
    encoder.cut();
  }

  const bytes = encoder.encode();

  return {
    bytes,
    byteLength: bytes.byteLength,
    columns,
    commands: encoder.commandLog,
    textLines: encoder.textLines,
    textPreview: encoder.textLines.join('\n')
  };
}

export default {
  ESC_POS_COMMANDS,
  PRINTER_CAPABILITY_PROFILES,
  EscPosEncoder,
  encodeEscPosDocument,
  sanitizeThermalAscii
};
