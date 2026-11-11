/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: PDFGenerator
 *
 * Generates downloadable PDF documents using jsPDF and jspdf-autotable for:
 * 1. Thermal PDF (58mm / 32-col and 80mm / 48-col)
 * 2. Official Receipt A5 (Kwitansi Resmi A5 Portrait / Landscape)
 * 3. B2B Sponsorship Invoice A4 (Faktur Tagihan B2B A4 Portrait / Landscape)
 * 4. Financial Report A4 (Laporan Keuangan General Ledger A4 Portrait / Landscape)
 *
 * Strictly read-only: never modifies transaction amounts or database records.
 */

import { jsPDF } from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';
import {
  DOC_TYPES,
  PRINT_EXECUTION_STATUS,
  resolvePaperSpec
} from '../types/printTypes.js';
import {
  formatRupiah,
  formatThermalTextLines,
  normalizePrintDocument
} from '../templates/ReceiptTemplateEngine.js';

try {
  applyPlugin(jsPDF);
} catch {
  // Plugin may already be registered
}

function runAutoTable(doc, tableOptions) {
  if (typeof doc.autoTable === 'function') {
    doc.autoTable(tableOptions);
  } else {
    autoTable(doc, tableOptions);
  }
}

function buildSafeFilename(doc, customFilename = null) {
  if (customFilename) {
    return customFilename.endsWith('.pdf') ? customFilename : `${customFilename}.pdf`;
  }
  const safeNo = String(doc.meta.receiptNo || 'DOKUMEN')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  switch (doc.docType) {
    case DOC_TYPES.OFFICIAL_RECEIPT_A5:
      return `Kwitansi_${safeNo}.pdf`;
    case DOC_TYPES.B2B_INVOICE_A4:
      return `Invoice_B2B_${safeNo}.pdf`;
    case DOC_TYPES.FINANCIAL_REPORT_A4:
      return `Laporan_Keuangan_${safeNo}.pdf`;
    case DOC_TYPES.THERMAL_RECEIPT:
    default:
      return `Struk_${doc.paper.size}_${safeNo}.pdf`;
  }
}

/**
 * 1. Thermal Roll PDF (58mm / 80mm)
 */
function renderThermalPdf(normalizedDoc) {
  const { paper } = normalizedDoc;
  const widthMm = paper.widthMm || 80;
  const cols = paper.columns || (widthMm <= 58 ? 32 : 48);
  const lines = formatThermalTextLines(normalizedDoc, cols);

  const fontSizePt = widthMm <= 58 ? 7.2 : 8.2;
  const lineHeightMm = widthMm <= 58 ? 3.3 : 3.7;
  const topMarginMm = 5;
  const bottomMarginMm = 6;
  const sideMarginMm = widthMm <= 58 ? 3 : 4;
  const calculatedHeightMm = Math.max(
    widthMm + 15,
    topMarginMm + bottomMarginMm + lines.length * lineHeightMm + 6
  );

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, calculatedHeightMm]
  });

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(fontSizePt);
  pdf.setTextColor(0, 0, 0);

  let currentY = topMarginMm + lineHeightMm;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeaderFirstLine = i === 0 && Boolean(normalizedDoc.tenantIdentity.headerName);
    const isTotalLine = line.trim().startsWith('TOTAL ');
    const isReprintLine = line.includes('CETAK ULANG');

    if (isHeaderFirstLine || isTotalLine || isReprintLine) {
      pdf.setFont('courier', 'bold');
    } else {
      pdf.setFont('courier', 'normal');
    }

    pdf.text(line, sideMarginMm, currentY);
    currentY += lineHeightMm;
  }

  return pdf;
}

/**
 * 2. Official Receipt A5 & 3. B2B Invoice A4
 */
function renderInvoiceOrOfficialReceiptPdf(normalizedDoc) {
  const { docType, tenantIdentity, meta, items, summary, paper, renderOptions } = normalizedDoc;
  const isB2B = docType === DOC_TYPES.B2B_INVOICE_A4;
  const formatName = paper.size === 'a5' ? 'a5' : 'a4';
  const orientation = paper.orientation === 'landscape' ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: formatName
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const leftMargin = paper.marginMm || 12;
  const rightMargin = pageWidth - leftMargin;

  // Top Accent Bar
  pdf.setFillColor(53, 73, 68); // #354944 Deep Slate Teal
  pdf.rect(0, 0, pageWidth, 4, 'F');

  // Header Left: Tenant Identity
  let currentY = 14;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(formatName === 'a5' ? 12.5 : 14.5);
  pdf.setTextColor(15, 23, 42);
  if (tenantIdentity.headerName) {
    pdf.text(tenantIdentity.headerName.toUpperCase(), leftMargin, currentY);
    currentY += 4.8;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  if (tenantIdentity.address) {
    const addrLines = pdf.splitTextToSize(tenantIdentity.address, Math.min(95, pageWidth * 0.52));
    pdf.text(addrLines, leftMargin, currentY);
    currentY += addrLines.length * 3.8;
  }

  const contactParts = [
    tenantIdentity.contact ? `${tenantIdentity.contact}` : null,
    tenantIdentity.email ? `Email: ${tenantIdentity.email}` : null
  ].filter(Boolean);
  if (contactParts.length > 0) {
    pdf.text(contactParts.join('  |  '), leftMargin, currentY);
    currentY += 4;
  }

  // Header Right: Document Badge
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(formatName === 'a5' ? 14 : 18);
  pdf.setTextColor(53, 73, 68);
  pdf.text(isB2B ? 'INVOICE' : 'KWITANSI RESMI', rightMargin, 14, { align: 'right' });

  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    isB2B ? 'FAKTUR TAGIHAN B2B SPONSORSHIP' : 'BUKTI PEMBAYARAN RESMI',
    rightMargin,
    18.5,
    { align: 'right' }
  );

  if (meta.isReprint) {
    pdf.setTextColor(180, 83, 9);
    pdf.text('*** CETAK ULANG (COPY) ***', rightMargin, 22.5, { align: 'right' });
  }

  const dividerY = Math.max(currentY + 2, 26);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.4);
  pdf.line(leftMargin, dividerY, rightMargin, dividerY);

  // Meta Section
  const metaStartY = dividerY + 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(isB2B ? 'DITAGIHKAN KEPADA (BILLED TO):' : 'DITERIMA DARI:', leftMargin, metaStartY);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text(meta.customerName || '-', leftMargin, metaStartY + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  let leftMetaY = metaStartY + 9.2;
  if (meta.customerSubInfo) {
    pdf.text(meta.customerSubInfo, leftMargin, leftMetaY);
    leftMetaY += 4.2;
  }
  if (meta.customerPhone) {
    pdf.text(`Kontak/WA: ${meta.customerPhone}`, leftMargin, leftMetaY);
    leftMetaY += 4.2;
  }
  if (meta.sponsorCategory) {
    pdf.text(`Kategori: ${meta.sponsorCategory}`, leftMargin, leftMetaY);
    leftMetaY += 4.2;
  }

  // Right Meta Column
  const rightColX = rightMargin - 68;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('RINCIAN DOKUMEN:', rightColX, metaStartY);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text('No. Dokumen', rightColX, metaStartY + 5);
  pdf.text(`: ${meta.receiptNo}`, rightColX + 22, metaStartY + 5);

  pdf.text('Tanggal', rightColX, metaStartY + 9.2);
  pdf.text(`: ${meta.date}`, rightColX + 22, metaStartY + 9.2);

  if (isB2B) {
    pdf.text('Jatuh Tempo', rightColX, metaStartY + 13.4);
    pdf.text(`: ${meta.invoiceDueDate}`, rightColX + 22, metaStartY + 13.4);
  } else {
    pdf.text('Kasir/Petugas', rightColX, metaStartY + 13.4);
    pdf.text(`: ${meta.cashierName}`, rightColX + 22, metaStartY + 13.4);
  }

  // Items Table
  const tableStartY = Math.max(leftMetaY + 3, metaStartY + 18);
  const tableBody = items.map((item, idx) => [
    String(idx + 1),
    item.description ? `${item.name}\n${item.description}` : item.name,
    item.unitLabel || String(item.qty || 1),
    formatRupiah(item.unitPrice),
    formatRupiah(item.subtotal)
  ]);

  runAutoTable(pdf, {
    startY: tableStartY,
    margin: { left: leftMargin, right: leftMargin },
    head: [['No', 'Deskripsi Layanan / Item', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [53, 73, 68],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.2,
      cellPadding: 2.8
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalTableY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY : tableStartY + 24;
  let summaryY = finalTableY + 6;
  const labelX = rightMargin - 76;

  pdf.setFontSize(8.2);
  if (isB2B && summary.contractValue > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.text('TOTAL KONTRAK :', labelX, summaryY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(formatRupiah(summary.contractValue), rightMargin, summaryY, { align: 'right' });

    summaryY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.text('SUDAH DIBAYAR :', labelX, summaryY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(16, 185, 129);
    pdf.text(formatRupiah(summary.totalPaid), rightMargin, summaryY, { align: 'right' });

    summaryY += 6;
    pdf.setFontSize(9.2);
    pdf.setTextColor(summary.remainingBalance === 0 ? 16 : 225, summary.remainingBalance === 0 ? 185 : 29, summary.remainingBalance === 0 ? 129 : 72);
    pdf.text('SISA TAGIHAN :', labelX, summaryY);
    pdf.text(
      summary.remainingBalance === 0 ? 'LUNAS (Rp 0)' : formatRupiah(summary.remainingBalance),
      rightMargin,
      summaryY,
      { align: 'right' }
    );
  } else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('TOTAL PEMBAYARAN :', labelX, summaryY);
    pdf.text(formatRupiah(summary.total), rightMargin, summaryY, { align: 'right' });

    summaryY += 4.8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Metode Bayar :', labelX, summaryY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(summary.paymentMethod, rightMargin, summaryY, { align: 'right' });

    if (renderOptions.showCashBreakdown) {
      summaryY += 4.5;
      pdf.setFont('helvetica', 'normal');
      pdf.text('Uang Diterima :', labelX, summaryY);
      pdf.text(formatRupiah(summary.amountPaid), rightMargin, summaryY, { align: 'right' });

      summaryY += 4.5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Kembalian :', labelX, summaryY);
      pdf.text(formatRupiah(summary.changeAmount), rightMargin, summaryY, { align: 'right' });
    }

    summaryY += 4.8;
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(16, 185, 129);
    pdf.text('Status :', labelX, summaryY);
    pdf.text(summary.status.toUpperCase(), rightMargin, summaryY, { align: 'right' });
  }

  // Bank Accounts Box on Left (Supports Multiple Active Tenant Bank Accounts)
  let footerLeftY = finalTableY + 6;
  if (renderOptions.showBankAccounts && tenantIdentity.bankAccounts.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text('REKENING RESMI PEMBAYARAN:', leftMargin, footerLeftY);
    footerLeftY += 4.2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.8);
    pdf.setTextColor(51, 65, 85);
    tenantIdentity.bankAccounts.forEach((acc) => {
      pdf.text(
        `${acc.bankName} : ${acc.accountNumber} (a.n. ${acc.accountName})`,
        leftMargin,
        footerLeftY
      );
      footerLeftY += 3.8;
    });
  }

  if (summary.notes) {
    footerLeftY += 2;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    const noteLines = pdf.splitTextToSize(`Catatan: ${summary.notes}`, 95);
    pdf.text(noteLines, leftMargin, footerLeftY);
    footerLeftY += noteLines.length * 3.5;
  }

  if (renderOptions.showFooterNote && tenantIdentity.footerNote) {
    footerLeftY += 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    const footLines = pdf.splitTextToSize(tenantIdentity.footerNote, 95);
    pdf.text(footLines, leftMargin, footerLeftY);
  }

  // Signature Block on Right
  if (renderOptions.showSignature) {
    const sigY = summaryY + 8;
    const sigCenterX = rightMargin - 26;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Hormat Kami,', sigCenterX, sigY, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(
      meta.signerName || tenantIdentity.headerName || 'Manajemen',
      sigCenterX,
      sigY + 16,
      { align: 'center' }
    );
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.3);
    pdf.line(sigCenterX - 24, sigY + 17.5, sigCenterX + 24, sigY + 17.5);
  }

  return pdf;
}

/**
 * 4. Financial Report A4 (Laporan Keuangan General Ledger)
 */
function renderFinancialReportPdf(normalizedDoc) {
  const { tenantIdentity, meta, items, summary, paper } = normalizedDoc;
  const orientation = paper.orientation === 'landscape' ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const leftMargin = paper.marginMm || 14;
  const rightMargin = pageWidth - leftMargin;

  pdf.setFillColor(200, 157, 50); // #C89D32 Gold Accent
  pdf.rect(0, 0, pageWidth, 4, 'F');

  let currentY = 14;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  if (tenantIdentity.headerName) {
    pdf.text(tenantIdentity.headerName.toUpperCase(), leftMargin, currentY);
    currentY += 5;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  if (tenantIdentity.address) {
    pdf.text(tenantIdentity.address, leftMargin, currentY);
    currentY += 4;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(53, 73, 68);
  pdf.text('LAPORAN ARUS KAS TERPADU', rightMargin, 14, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Tanggal Cetak: ${meta.date}${meta.periodLabel ? ` | Periode: ${meta.periodLabel}` : ''}`,
    rightMargin,
    19,
    { align: 'right' }
  );

  const kpiY = Math.max(currentY + 4, 25);
  runAutoTable(pdf, {
    startY: kpiY,
    margin: { left: leftMargin, right: leftMargin },
    head: [['Sewa Lapangan', 'Kasir POS (Retail & F&B)', 'SPP Akademi', 'Total Pendapatan Bersih']],
    body: [[
      formatRupiah(summary.bookingRevenue),
      formatRupiah(summary.posRevenue),
      formatRupiah(summary.sppRevenue),
      formatRupiah(summary.totalGrossRevenue)
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [53, 73, 68],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 3
    }
  });

  const ledgerStartY = (pdf.lastAutoTable ? pdf.lastAutoTable.finalY : kpiY + 18) + 6;
  const ledgerRows = items.map((row, idx) => [
    String(idx + 1),
    row.date || '-',
    row.categoryLabel || '-',
    row.description ? `${row.name} (${row.description})` : row.name,
    row.status || 'AKTIF',
    formatRupiah(row.amount)
  ]);

  runAutoTable(pdf, {
    startY: ledgerStartY,
    margin: { left: leftMargin, right: leftMargin },
    head: [['No', 'Tanggal', 'Kategori', 'Deskripsi Transaksi', 'Status', 'Nominal']],
    body: ledgerRows.length > 0 ? ledgerRows : [['-', '-', '-', 'Tidak ada data transaksi', '-', 'Rp 0']],
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 7.8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    }
  });

  return pdf;
}

/**
 * Generates a jsPDF instance and binary output for any NormalizedPrintDocument
 */
export function generatePDFDocument(rawOrNormalizedDoc, options = {}) {
  const doc = normalizePrintDocument(rawOrNormalizedDoc, options);
  const paper = resolvePaperSpec(options.paper || doc.paper, doc.docType);
  const targetDoc = { ...doc, paper };

  let pdfInstance = null;
  if (paper.category === 'thermal') {
    pdfInstance = renderThermalPdf(targetDoc);
  } else if (targetDoc.docType === DOC_TYPES.FINANCIAL_REPORT_A4) {
    pdfInstance = renderFinancialReportPdf(targetDoc);
  } else {
    pdfInstance = renderInvoiceOrOfficialReceiptPdf(targetDoc);
  }

  const filename = buildSafeFilename(targetDoc, options.filename);
  const arrayBuffer = pdfInstance.output('arraybuffer');
  const pdfBytes = new Uint8Array(arrayBuffer);

  return {
    ok: true,
    status: PRINT_EXECUTION_STATUS.PDF_GENERATED,
    doc: pdfInstance,
    pdfBytes,
    byteLength: pdfBytes.byteLength,
    filename,
    paper: targetDoc.paper,
    docType: targetDoc.docType,
    pageCount: pdfInstance.internal.getNumberOfPages(),
    pageSize: {
      widthMm: Math.round(pdfInstance.internal.pageSize.getWidth()),
      heightMm: Math.round(pdfInstance.internal.pageSize.getHeight())
    }
  };
}

/**
 * Generates and downloads a PDF document (safe in both browser and headless/test environments)
 */
export function downloadPDFDocument(rawOrNormalizedDoc, options = {}) {
  const result = generatePDFDocument(rawOrNormalizedDoc, options);

  const canTriggerBrowserDownload =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    options.skipBrowserDownload !== true;

  if (canTriggerBrowserDownload) {
    result.doc.save(result.filename);
  }

  return result;
}

export default {
  generatePDFDocument,
  downloadPDFDocument
};
