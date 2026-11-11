/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: BrowserPrintAdapter
 *
 * Executes printing via an isolated HTML document inside a dedicated off-screen iframe.
 * - Never relies on global `body * { visibility: hidden }` in the main app DOM.
 * - Explicitly sets `@page { size: ...; margin: ...; }` for 58mm, 80mm, A5, and A4.
 * - Never falsely claims physical print completion; reports honest `DIALOG_OPENED` status.
 */

import {
  DOC_TYPES,
  PRINT_ADAPTERS,
  PRINT_EXECUTION_STATUS,
  resolvePaperSpec
} from '../types/printTypes.js';
import {
  formatRupiah,
  normalizePrintDocument
} from '../templates/ReceiptTemplateEngine.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the inner HTML markup for a Thermal Receipt (58mm / 80mm)
 */
function buildThermalBodyHtml(doc) {
  const { tenantIdentity, meta, items, summary, renderOptions } = doc;
  const logoHtml =
    renderOptions.showLogo && tenantIdentity.logoUrl
      ? `<div class="receipt-logo"><img src="${escapeHtml(tenantIdentity.logoUrl)}" alt="Logo" /></div>`
      : '';

  const reprintBanner = meta.isReprint
    ? `<div class="reprint-badge">*** CETAK ULANG (COPY) ***</div>`
    : '';

  const itemsHtml = items
    .map((item) => {
      const descHtml = item.description
        ? `<div class="item-desc">${escapeHtml(item.description)}</div>`
        : '';
      return `
        <div class="item-block">
          <div class="item-name">${escapeHtml(item.name)}</div>
          ${descHtml}
          <div class="row">
            <span>${escapeHtml(`${item.qty || 1} x ${formatRupiah(item.unitPrice)}`)}</span>
            <span class="bold">${escapeHtml(formatRupiah(item.subtotal))}</span>
          </div>
        </div>
      `;
    })
    .join('');

  const cashHtml = renderOptions.showCashBreakdown
    ? `
      <div class="row">
        <span>Dibayar</span>
        <span>${escapeHtml(formatRupiah(summary.amountPaid))}</span>
      </div>
      <div class="row bold">
        <span>Kembalian</span>
        <span>${escapeHtml(formatRupiah(summary.changeAmount))}</span>
      </div>
    `
    : '';

  const notesHtml = summary.notes
    ? `<div class="divider"></div><div class="notes">Catatan: ${escapeHtml(summary.notes)}</div>`
    : '';

  const footerHtml =
    renderOptions.showFooterNote && tenantIdentity.footerNote
      ? `<div class="divider"></div><div class="footer-note">${escapeHtml(tenantIdentity.footerNote)}</div>`
      : '';

  const dateTimeStr = meta.time ? `${meta.date} ${meta.time}` : meta.date;

  return `
    <div class="thermal-container">
      <div class="header">
        ${logoHtml}
        ${tenantIdentity.headerName ? `<div class="header-title">${escapeHtml(tenantIdentity.headerName)}</div>` : ''}
        ${tenantIdentity.subTitle ? `<div class="header-sub">${escapeHtml(tenantIdentity.subTitle)}</div>` : ''}
        ${tenantIdentity.address ? `<div class="header-meta">${escapeHtml(tenantIdentity.address)}</div>` : ''}
        ${tenantIdentity.contact ? `<div class="header-meta">${escapeHtml(tenantIdentity.contact)}</div>` : ''}
        ${reprintBanner}
      </div>

      <div class="divider"></div>

      <div class="meta-section">
        <div class="row"><span>No. Struk</span><span class="bold">${escapeHtml(meta.receiptNo)}</span></div>
        <div class="row"><span>Tanggal</span><span>${escapeHtml(dateTimeStr)}</span></div>
        ${meta.cashierName && meta.cashierName !== '-' ? `<div class="row"><span>Kasir</span><span>${escapeHtml(meta.cashierName)}</span></div>` : ''}
        ${meta.customerName ? `<div class="row"><span>Pelanggan</span><span class="bold">${escapeHtml(meta.customerName)}</span></div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="items-section">
        ${itemsHtml}
      </div>

      <div class="divider-double"></div>

      <div class="summary-section">
        <div class="row total-row">
          <span>TOTAL</span>
          <span>${escapeHtml(formatRupiah(summary.total))}</span>
        </div>
        <div class="row">
          <span>Metode Bayar</span>
          <span class="bold">${escapeHtml(summary.paymentMethod)}</span>
        </div>
        ${cashHtml}
        ${summary.status ? `<div class="row"><span>Status</span><span class="status-pill">${escapeHtml(summary.status)}</span></div>` : ''}
      </div>

      ${notesHtml}
      ${footerHtml}
    </div>
  `;
}

/**
 * Builds the inner HTML markup for Official Receipt (A5) or B2B Invoice (A4)
 */
function buildSheetInvoiceOrReceiptHtml(doc) {
  const { docType, tenantIdentity, meta, items, summary, renderOptions } = doc;
  const isB2B = docType === DOC_TYPES.B2B_INVOICE_A4;
  const docBadgeTitle = isB2B ? 'INVOICE' : 'KWITANSI RESMI';
  const docBadgeSub = isB2B ? 'FAKTUR TAGIHAN B2B SPONSORSHIP' : 'BUKTI PEMBAYARAN RESMI';

  const itemsRowsHtml = items
    .map(
      (item, index) => `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>
          <div class="bold">${escapeHtml(item.name)}</div>
          ${item.description ? `<div class="muted">${escapeHtml(item.description)}</div>` : ''}
        </td>
        <td class="text-center">${escapeHtml(item.unitLabel || String(item.qty || 1))}</td>
        <td class="text-right">${escapeHtml(formatRupiah(item.unitPrice))}</td>
        <td class="text-right bold">${escapeHtml(formatRupiah(item.subtotal))}</td>
      </tr>
    `
    )
    .join('');

  const banksHtml =
    renderOptions.showBankAccounts && tenantIdentity.bankAccounts.length > 0
      ? `
        <div class="bank-box">
          <div class="bank-box-title">INFORMASI REKENING RESMI:</div>
          ${tenantIdentity.bankAccounts
            .map(
              (acc) =>
                `<div class="bank-item"><strong>${escapeHtml(acc.bankName)}</strong> &bull; ${escapeHtml(acc.accountNumber)} (a.n. ${escapeHtml(acc.accountName)})</div>`
            )
            .join('')}
        </div>
      `
      : '';

  const financialSummaryHtml = isB2B && summary.contractValue > 0
    ? `
      <div class="sheet-totals">
        <div class="row"><span>Total Nilai Kontrak:</span><span class="bold">${escapeHtml(formatRupiah(summary.contractValue))}</span></div>
        <div class="row"><span>Sudah Dibayar (Total Paid):</span><span class="bold">${escapeHtml(formatRupiah(summary.totalPaid))}</span></div>
        <div class="row total-row"><span>Sisa Tagihan (Balance Due):</span><span>${escapeHtml(summary.remainingBalance === 0 ? 'LUNAS (Rp 0)' : formatRupiah(summary.remainingBalance))}</span></div>
      </div>
    `
    : `
      <div class="sheet-totals">
        <div class="row total-row"><span>TOTAL PEMBAYARAN:</span><span>${escapeHtml(formatRupiah(summary.total))}</span></div>
        <div class="row"><span>Metode Pembayaran:</span><span class="bold">${escapeHtml(summary.paymentMethod)}</span></div>
        ${renderOptions.showCashBreakdown ? `<div class="row"><span>Dibayar:</span><span>${escapeHtml(formatRupiah(summary.amountPaid))}</span></div><div class="row"><span>Kembalian:</span><span>${escapeHtml(formatRupiah(summary.changeAmount))}</span></div>` : ''}
        <div class="row"><span>Status:</span><span class="bold">${escapeHtml(summary.status)}</span></div>
      </div>
    `;

  return `
    <div class="sheet-container">
      <div class="sheet-header">
        <div class="sheet-brand">
          ${tenantIdentity.headerName ? `<div class="sheet-org-name">${escapeHtml(tenantIdentity.headerName)}</div>` : ''}
          ${tenantIdentity.address ? `<div class="sheet-org-meta">${escapeHtml(tenantIdentity.address)}</div>` : ''}
          ${tenantIdentity.contact ? `<div class="sheet-org-meta">${escapeHtml(tenantIdentity.contact)}${tenantIdentity.email ? ` | ${escapeHtml(tenantIdentity.email)}` : ''}</div>` : ''}
        </div>
        <div class="sheet-doc-type">
          <div class="sheet-doc-title">${docBadgeTitle}</div>
          <div class="sheet-doc-sub">${docBadgeSub}</div>
          ${meta.isReprint ? `<div class="reprint-badge">CETAK ULANG (COPY)</div>` : ''}
        </div>
      </div>

      <div class="sheet-meta-grid">
        <div class="meta-col">
          <div class="meta-heading">${isB2B ? 'DITAGIHKAN KEPADA:' : 'DITERIMA DARI:'}</div>
          <div class="bold">${escapeHtml(meta.customerName || '-')}</div>
          ${meta.customerSubInfo ? `<div class="muted">${escapeHtml(meta.customerSubInfo)}</div>` : ''}
          ${meta.customerPhone ? `<div class="muted">Kontak: ${escapeHtml(meta.customerPhone)}</div>` : ''}
        </div>
        <div class="meta-col text-right">
          <div class="meta-heading">RINCIAN DOKUMEN:</div>
          <div>No. Dokumen: <strong>${escapeHtml(meta.receiptNo)}</strong></div>
          <div>Tanggal: <strong>${escapeHtml(meta.date)}</strong></div>
          ${isB2B ? `<div>Jatuh Tempo: <strong>${escapeHtml(meta.invoiceDueDate)}</strong></div>` : ''}
          ${meta.eventName ? `<div>Event: <strong>${escapeHtml(meta.eventName)}</strong></div>` : ''}
        </div>
      </div>

      <table class="sheet-table">
        <thead>
          <tr>
            <th style="width: 8%;">No</th>
            <th style="width: 47%;">Deskripsi Layanan / Item</th>
            <th style="width: 13%;">Kuantitas</th>
            <th style="width: 16%;">Harga Satuan</th>
            <th style="width: 16%;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>

      <div class="sheet-bottom-grid">
        <div class="sheet-left-notes">
          ${banksHtml}
          ${summary.notes ? `<div class="notes-block"><strong>Catatan:</strong> ${escapeHtml(summary.notes)}</div>` : ''}
          ${tenantIdentity.footerNote ? `<div class="footer-note-sheet">${escapeHtml(tenantIdentity.footerNote)}</div>` : ''}
        </div>
        <div class="sheet-right-summary">
          ${financialSummaryHtml}
          ${
            renderOptions.showSignature
              ? `
                <div class="signature-box">
                  <div>Hormat Kami,</div>
                  <div class="signature-space"></div>
                  <div class="bold signature-line">${escapeHtml(meta.signerName || tenantIdentity.headerName || 'Manajemen')}</div>
                </div>
              `
              : ''
          }
        </div>
      </div>
    </div>
  `;
}

/**
 * Builds the inner HTML markup for Financial Report (A4)
 */
function buildFinancialReportHtml(doc) {
  const { tenantIdentity, meta, items, summary } = doc;
  const rowsHtml = items
    .map(
      (row, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.categoryLabel)}</td>
        <td>
          <div class="bold">${escapeHtml(row.name)}</div>
          ${row.description ? `<div class="muted">${escapeHtml(row.description)}</div>` : ''}
        </td>
        <td class="text-center">${escapeHtml(row.status)}</td>
        <td class="text-right bold">${escapeHtml(formatRupiah(row.amount))}</td>
      </tr>
    `
    )
    .join('');

  return `
    <div class="sheet-container">
      <div class="sheet-header">
        <div class="sheet-brand">
          ${tenantIdentity.headerName ? `<div class="sheet-org-name">${escapeHtml(tenantIdentity.headerName)}</div>` : ''}
          ${tenantIdentity.address ? `<div class="sheet-org-meta">${escapeHtml(tenantIdentity.address)}</div>` : ''}
          ${tenantIdentity.contact ? `<div class="sheet-org-meta">${escapeHtml(tenantIdentity.contact)}</div>` : ''}
        </div>
        <div class="sheet-doc-type">
          <div class="sheet-doc-title">LAPORAN KEUANGAN</div>
          <div class="sheet-doc-sub">GENERAL LEDGER &amp; ARUS KAS TERPADU</div>
          <div class="muted">Tanggal Cetak: ${escapeHtml(meta.date)} ${meta.periodLabel ? `| Periode: ${escapeHtml(meta.periodLabel)}` : ''}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Sewa Lapangan</div>
          <div class="kpi-value">${escapeHtml(formatRupiah(summary.bookingRevenue))}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Kasir POS</div>
          <div class="kpi-value">${escapeHtml(formatRupiah(summary.posRevenue))}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">SPP Akademi</div>
          <div class="kpi-value">${escapeHtml(formatRupiah(summary.sppRevenue))}</div>
        </div>
        <div class="kpi-card kpi-total">
          <div class="kpi-label">Total Pendapatan Bersih</div>
          <div class="kpi-value">${escapeHtml(formatRupiah(summary.totalGrossRevenue))}</div>
        </div>
      </div>

      <table class="sheet-table">
        <thead>
          <tr>
            <th style="width: 6%;">No</th>
            <th style="width: 14%;">Tanggal</th>
            <th style="width: 16%;">Kategori</th>
            <th style="width: 36%;">Deskripsi Transaksi</th>
            <th style="width: 12%;">Status</th>
            <th style="width: 16%;">Nominal</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="6" class="text-center muted">Tidak ada data transaksi pada periode ini.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Generates a complete, isolated HTML5 document string with scoped CSS and @page rules.
 * Completely independent of the main application stylesheet.
 */
export function buildIsolatedPrintHtml(rawOrNormalizedDoc, options = {}) {
  const doc = normalizePrintDocument(rawOrNormalizedDoc, options);
  const paper = resolvePaperSpec(options.paper || doc.paper, doc.docType);
  const isThermal = paper.category === 'thermal';

  let bodyMarkup = '';
  if (isThermal) {
    bodyMarkup = buildThermalBodyHtml(doc);
  } else if (doc.docType === DOC_TYPES.FINANCIAL_REPORT_A4) {
    bodyMarkup = buildFinancialReportHtml(doc);
  } else {
    bodyMarkup = buildSheetInvoiceOrReceiptHtml(doc);
  }

  const contentWidthMm = isThermal ? paper.printableWidthMm : paper.widthMm - paper.marginMm * 2;
  const fontSizePx = paper.id === 'THERMAL_58MM' ? 10 : isThermal ? 11 : 12;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.meta.receiptNo || 'Dokumen Cetak')}</title>
  <style>
    @page {
      size: ${paper.cssPageSize};
      margin: ${paper.marginMm}mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: ${isThermal ? "'Courier New', Courier, monospace" : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
      font-size: ${fontSizePx}px;
      line-height: 1.35;
    }
    .thermal-container {
      width: ${paper.widthMm}mm;
      max-width: ${paper.widthMm}mm;
      padding: 2mm ${Math.max(1, (paper.widthMm - contentWidthMm) / 2)}mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .receipt-logo img {
      max-width: 28mm;
      max-height: 16mm;
      object-fit: contain;
      margin-bottom: 4px;
    }
    .header-title {
      font-weight: 800;
      font-size: ${fontSizePx + 2}px;
      text-transform: uppercase;
    }
    .header-sub {
      font-weight: 700;
      font-size: ${fontSizePx - 1}px;
      text-transform: uppercase;
    }
    .header-meta {
      font-size: ${fontSizePx - 1}px;
      word-break: break-word;
    }
    .reprint-badge {
      display: inline-block;
      margin-top: 4px;
      padding: 1px 4px;
      border: 1px solid #000;
      font-weight: 700;
      font-size: ${fontSizePx - 1}px;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 5px 0;
    }
    .divider-double {
      border-top: 2px solid #000000;
      margin: 5px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      margin: 2px 0;
    }
    .bold {
      font-weight: 700;
    }
    .total-row {
      font-weight: 800;
      font-size: ${fontSizePx + 2}px;
      margin: 4px 0;
    }
    .item-block {
      margin: 4px 0;
    }
    .item-name {
      font-weight: 700;
      word-break: break-word;
    }
    .item-desc {
      font-size: ${fontSizePx - 1}px;
      color: #333333;
    }
    .status-pill {
      font-weight: 800;
      text-transform: uppercase;
    }
    .notes, .footer-note {
      font-size: ${fontSizePx - 1}px;
      text-align: center;
      white-space: pre-line;
      margin-top: 4px;
    }
    /* Sheet Styles (A5 / A4) */
    .sheet-container {
      width: 100%;
      max-width: ${contentWidthMm}mm;
      margin: 0 auto;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .sheet-org-name {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
    }
    .sheet-org-meta {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
    }
    .sheet-doc-type {
      text-align: right;
    }
    .sheet-doc-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .sheet-doc-sub {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
    }
    .sheet-meta-grid {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .meta-heading {
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      margin-bottom: 3px;
    }
    .sheet-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .sheet-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 8px;
      text-align: left;
      font-size: 10px;
    }
    .sheet-table td {
      border-bottom: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: top;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .muted { color: #64748b; font-size: 10px; }
    .sheet-bottom-grid {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 10px;
    }
    .sheet-left-notes {
      flex: 1;
      font-size: 10px;
    }
    .sheet-right-summary {
      width: 45%;
      font-size: 11px;
    }
    .bank-box {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .bank-box-title {
      font-weight: 800;
      font-size: 9px;
      margin-bottom: 4px;
    }
    .signature-box {
      margin-top: 18px;
      text-align: center;
      font-size: 10px;
    }
    .signature-space {
      height: 36px;
    }
    .signature-line {
      border-top: 1px solid #334155;
      display: inline-block;
      min-width: 140px;
      padding-top: 3px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
    }
    .kpi-total {
      background: #f1f5f9;
      font-weight: 700;
    }
    .kpi-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
    }
    .kpi-value {
      font-size: 13px;
      font-weight: 800;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  ${bodyMarkup}
</body>
</html>`;
}

/**
 * BrowserPrintAdapter class implementing the unified Adapter interface
 */
export class BrowserPrintAdapter {
  constructor() {
    this.name = PRINT_ADAPTERS.BROWSER;
  }

  isSupported() {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.print === 'function';
  }

  /**
   * Executes printing via an isolated hidden iframe so the host app DOM and styles remain untouched.
   */
  async print(rawOrNormalizedDoc, options = {}) {
    const doc = normalizePrintDocument(rawOrNormalizedDoc, options);
    const htmlContent = buildIsolatedPrintHtml(doc, options);

    if (!this.isSupported()) {
      return {
        ok: false,
        status: PRINT_EXECUTION_STATUS.FAILED,
        adapter: this.name,
        physicalPrintConfirmed: false,
        htmlContent,
        message: 'Lingkungan saat ini tidak mendukung dialog cetak browser (window.print tidak tersedia).'
      };
    }

    return new Promise((resolve) => {
      let iframe = null;
      try {
        // Remove any previous stale print iframe
        const existing = document.getElementById('chuvator-isolated-print-iframe');
        if (existing && existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }

        iframe = document.createElement('iframe');
        iframe.id = 'chuvator-isolated-print-iframe';
        iframe.title = 'Isolated Print Frame';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';

        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const iframeWin = iframe.contentWindow;

        if (!iframeDoc || !iframeWin) {
          throw new Error('Gagal menginisialisasi dokumen cetak terisolasi pada browser.');
        }

        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        let hasTriggered = false;
        const triggerPrintDialog = () => {
          if (hasTriggered) return;
          hasTriggered = true;

          try {
            iframeWin.focus();
            iframeWin.print();

            // Clean up iframe after print dialog lifecycle
            setTimeout(() => {
              if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            }, 2000);

            resolve({
              ok: true,
              status: PRINT_EXECUTION_STATUS.DIALOG_OPENED,
              adapter: this.name,
              physicalPrintConfirmed: false,
              paper: doc.paper,
              docType: doc.docType,
              message:
                'Dialog cetak browser berhasil dibuka. Penyelesaian cetak fisik dikelola oleh sistem operasi dan printer yang dipilih pengguna.'
            });
          } catch (printErr) {
            if (iframe && iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
            resolve({
              ok: false,
              status: PRINT_EXECUTION_STATUS.FAILED,
              adapter: this.name,
              physicalPrintConfirmed: false,
              error: printErr?.message || String(printErr),
              message: 'Browser gagal membuka dialog cetak. Silakan gunakan tombol Unduh PDF sebagai alternatif.'
            });
          }
        };

        // Trigger once iframe finishes loading resources or after a short timeout guard
        iframe.onload = () => {
          setTimeout(triggerPrintDialog, 80);
        };
        setTimeout(triggerPrintDialog, 250);
      } catch (err) {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        resolve({
          ok: false,
          status: PRINT_EXECUTION_STATUS.FAILED,
          adapter: this.name,
          physicalPrintConfirmed: false,
          error: err?.message || String(err),
          message: 'Gagal menyiapkan dokumen cetak pada browser.'
        });
      }
    });
  }
}

export default BrowserPrintAdapter;
