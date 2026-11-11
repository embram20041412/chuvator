/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: ReceiptTemplateEngine
 *
 * Normalizes raw transaction/document payloads from Booking, POS, SPP, Event,
 * Sponsorship B2B Invoice, and Financial Reports into the canonical
 * NormalizedPrintDocument schema, and formats 32-col (58mm) / 48-col (80mm) lines.
 */

import {
  DOC_TYPES,
  MODULE_SOURCES,
  resolvePaperSpec
} from '../types/printTypes.js';

/**
 * Formats a numeric value into Indonesian Rupiah string (e.g. "Rp 150.000")
 * Uses deterministic dot-separated thousands formatting so output is identical
 * across browsers, OS locales, and headless environments.
 */
export function formatRupiah(value, options = {}) {
  const { withPrefix = true } = options;
  const num = Number(value);
  const safeNum = Number.isFinite(num) ? Math.round(num) : 0;
  const isNegative = safeNum < 0;
  const absStr = Math.abs(safeNum)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!withPrefix) {
    return isNegative ? `-${absStr}` : absStr;
  }
  return isNegative ? `-Rp ${absStr}` : `Rp ${absStr}`;
}

/**
 * Truncates text to a maximum character length
 */
export function truncateText(text, maxLength, ellipsis = '...') {
  const str = String(text ?? '').trim();
  if (!maxLength || maxLength <= 0) return '';
  if (str.length <= maxLength) return str;
  if (maxLength <= ellipsis.length) return str.slice(0, maxLength);
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Wraps long text into an array of lines where each line has length <= maxWidth.
 * Handles both multi-word strings and single unbroken long tokens (> maxWidth).
 */
export function wrapText(text, maxWidth = 32) {
  const width = Math.max(8, Number(maxWidth) || 32);
  const raw = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];

  const paragraphs = raw.split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (word.length > width) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        let cursor = 0;
        while (cursor < word.length) {
          const chunk = word.slice(cursor, cursor + width);
          if (chunk.length === width) {
            lines.push(chunk);
          } else {
            currentLine = chunk;
          }
          cursor += width;
        }
      } else if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= width) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Centers text within a fixed column width (32 or 48 columns)
 */
export function centerText(text, totalColumns = 32) {
  const cols = Math.max(8, Number(totalColumns) || 32);
  const wrapped = wrapText(text, cols);
  return wrapped.map((line) => {
    const padTotal = Math.max(0, cols - line.length);
    const padLeft = Math.floor(padTotal / 2);
    return ' '.repeat(padLeft) + line;
  });
}

/**
 * Formats a left label and right value into exact column width (e.g., 32 or 48).
 * Guarantees that the right value (such as a Rupiah amount) is never truncated,
 * wrapping the left label across lines if needed.
 */
export function formatTwoColumns(leftText, rightText, totalColumns = 32) {
  const cols = Math.max(16, Number(totalColumns) || 32);
  const left = String(leftText ?? '').trim();
  const right = String(rightText ?? '').trim();

  if (!right) {
    return wrapText(left, cols);
  }

  if (!left) {
    const padLeft = Math.max(0, cols - right.length);
    return [' '.repeat(padLeft) + right];
  }

  const minGap = 1;
  if (left.length + minGap + right.length <= cols) {
    const spaces = cols - left.length - right.length;
    return [left + ' '.repeat(spaces) + right];
  }

  // If left text is long, wrap left text into a safe left column width,
  // and place rightText on the final line (or next line if rightText is very wide)
  const maxLeftColWidth = Math.max(8, cols - right.length - 2);
  if (maxLeftColWidth >= 10) {
    const wrappedLeft = wrapText(left, maxLeftColWidth);
    return wrappedLeft.map((line, idx) => {
      if (idx === wrappedLeft.length - 1) {
        const spaces = Math.max(1, cols - line.length - right.length);
        return line + ' '.repeat(spaces) + right;
      }
      return line;
    });
  }

  // Fallback when rightText is long or takes nearly the entire width:
  // wrap leftText across full width, and wrap rightText (right-aligned per line) so no line ever exceeds cols
  const leftLines = wrapText(left, cols);
  const rightLines = wrapText(right, cols).map((rLine) => {
    const padRight = Math.max(0, cols - rLine.length);
    return ' '.repeat(padRight) + rLine;
  });
  return [...leftLines, ...rightLines];
}

/**
 * Resolves active tenant identity strictly from the provided tenant / arena object.
 * Never injects hardcoded company or arena names.
 */
export function resolveTenantIdentity(tenantSource = {}) {
  const src = tenantSource || {};

  const headerName = String(
    src.receiptHeaderName ||
    src.receipt_header_name ||
    src.headerName ||
    src.name ||
    src.storeName ||
    ''
  ).trim();

  const subTitle = String(
    src.subTitle ||
    src.storeSub ||
    (src.sportsType ? `${src.sportsType}` : '')
  ).trim();

  const address = String(
    src.receiptAddress ||
    src.receipt_address ||
    src.address ||
    src.alamat ||
    src.storeAddress ||
    ''
  ).trim();

  const contact = String(
    src.receiptContact ||
    src.receipt_contact ||
    src.phone ||
    src.whatsapp ||
    src.whatsappNumber ||
    src.contact ||
    src.storePhone ||
    ''
  ).trim();

  const email = String(src.email || '').trim();

  const footerNote = String(
    src.receiptFooterNote ||
    src.receipt_footer_note ||
    src.receiptFooterText ||
    src.receipt_footer_text ||
    src.footerNote ||
    ''
  ).trim();

  const logoUrl = String(
    src.logoUrl ||
    src.logo_url ||
    src.logo ||
    ''
  ).trim();

  const ownerName = String(
    src.ownerName ||
    src.owner_name ||
    src.picName ||
    ''
  ).trim();

  // Extract all active bank accounts configured by tenant
  const bankAccounts = [];
  if (Array.isArray(src.bankAccounts) && src.bankAccounts.length > 0) {
    src.bankAccounts.forEach((acc) => {
      const bankName = String(acc?.bankName || '').trim();
      const accountNumber = String(acc?.accountNumber || '').trim();
      const accountName = String(acc?.accountName || acc?.accountHolder || headerName || '').trim();
      if (bankName || accountNumber) {
        bankAccounts.push({
          bankName: bankName || '-',
          accountNumber: accountNumber || '-',
          accountName: accountName || '-'
        });
      }
    });
  } else if (src.bankName || src.bankAccountNumber || src.bank_account_number) {
    bankAccounts.push({
      bankName: String(src.bankName || src.bank_name || '-').trim(),
      accountNumber: String(src.bankAccountNumber || src.bank_account_number || '-').trim(),
      accountName: String(
        src.bankAccountName ||
        src.bank_account_name ||
        src.bankAccountHolder ||
        headerName ||
        '-'
      ).trim()
    });
  }

  return {
    tenantId: src.id || src.tenantId || src.tenant_id || null,
    headerName,
    subTitle,
    address,
    contact,
    email,
    footerNote,
    logoUrl,
    ownerName,
    bankAccounts
  };
}

/**
 * Infers module source if not explicitly provided
 */
function inferModuleSource(raw = {}, docType) {
  if (raw.moduleSource) return String(raw.moduleSource).toUpperCase();
  if (docType === DOC_TYPES.B2B_INVOICE_A4) return MODULE_SOURCES.SPONSOR;
  if (docType === DOC_TYPES.FINANCIAL_REPORT_A4) return MODULE_SOURCES.FINANCE;

  const receiptNo = String(raw.receiptNo || raw.receipt_no || '').toUpperCase();
  if (receiptNo.startsWith('POS-')) return MODULE_SOURCES.POS;
  if (receiptNo.startsWith('AKD-') || receiptNo.startsWith('SPP-')) return MODULE_SOURCES.SPP;
  if (receiptNo.startsWith('EVT-')) return MODULE_SOURCES.EVENT;
  if (raw.schedule || raw.courtName || raw.bookingDate) return MODULE_SOURCES.BOOKING;
  return MODULE_SOURCES.GENERAL;
}

/**
 * Normalizes line items from Booking, POS, SPP, Event, Sponsor, or Finance payloads
 * without recalculating or altering the caller's monetary figures.
 */
function normalizeItems(raw = {}, docType) {
  if (docType === DOC_TYPES.FINANCIAL_REPORT_A4) {
    const ledgerRows = Array.isArray(raw.ledgerEntries)
      ? raw.ledgerEntries
      : Array.isArray(raw.items)
      ? raw.items
      : [];

    return ledgerRows.map((entry, idx) => ({
      id: entry.id || `ledger-${idx + 1}`,
      date: String(entry.date || entry.bookingDate || '-'),
      categoryLabel: String(entry.categoryLabel || entry.type || '-'),
      name: String(entry.title || entry.itemName || entry.name || '-'),
      description: String(entry.detail || entry.description || ''),
      amount: Number(entry.amount ?? entry.price ?? 0),
      status: entry.isVoid ? 'VOID' : String(entry.status || 'AKTIF')
    }));
  }

  if (Array.isArray(raw.items) && raw.items.length > 0) {
    return raw.items.map((item, idx) => {
      const qty = Number(item.qty ?? item.quantity ?? 1);
      // Preserve explicit price and subtotal from payload; only fallback to price if subtotal omitted
      const hasExplicitPrice = item.price !== undefined || item.unitPrice !== undefined;
      const unitPrice = hasExplicitPrice
        ? Number(item.unitPrice ?? item.price ?? 0)
        : Number(item.subtotal ?? item.amount ?? 0);
      const subtotal = item.subtotal !== undefined
        ? Number(item.subtotal)
        : item.amount !== undefined
        ? Number(item.amount)
        : qty * unitPrice;

      return {
        id: item.id || `item-${idx + 1}`,
        name: String(item.name || item.itemName || item.title || `Item ${idx + 1}`).trim(),
        description: String(item.description || item.schedule || item.detail || '').trim(),
        qty,
        unitLabel: String(item.unitLabel || '').trim(),
        unitPrice,
        subtotal
      };
    });
  }

  // Sponsor B2B single package fallback
  if (docType === DOC_TYPES.B2B_INVOICE_A4 && raw.sponsor) {
    const sp = raw.sponsor;
    const billedAmount = Number(
      raw.currentPaymentAmount ??
      raw.billedAmount ??
      raw.total ??
      raw.amount ??
      sp.contractValue ??
      0
    );
    const term = String(raw.paymentTerm || sp.paymentTerm || 'Termin Sponsorship').trim();
    const category = String(sp.category || 'Sponsorship').trim();
    const eventName = String(raw.eventName || sp.eventName || '').trim();
    const benefit = String(raw.sponsorBenefit || sp.benefits || sp.benefit || '').trim();

    const descParts = [
      `Pembayaran: ${term}`,
      `Paket: ${category}`,
      eventName ? `Event: ${eventName}` : null,
      benefit ? `Benefit: ${benefit}` : null
    ].filter(Boolean);

    return [
      {
        id: 'sponsor-item-1',
        name: descParts[0],
        description: descParts.slice(1).join(' | '),
        qty: 1,
        unitLabel: '1 Paket',
        unitPrice: billedAmount,
        subtotal: billedAmount
      }
    ];
  }

  // Single-item transaction fallback (e.g. Booking or single payment payload)
  const singleAmount = Number(
    raw.amount ??
    raw.totalAmount ??
    raw.total ??
    raw.price ??
    0
  );
  const singleName = String(
    raw.itemName ||
    raw.title ||
    raw.courtName ||
    raw.categoryName ||
    'Transaksi Layanan'
  ).trim();
  const singleDesc = String(
    raw.schedule ||
    raw.detail ||
    (raw.startTime && raw.endTime ? `${raw.startTime} - ${raw.endTime}` : '')
  ).trim();

  return [
    {
      id: raw.id || 'item-1',
      name: singleName,
      description: singleDesc,
      qty: 1,
      unitLabel: '',
      unitPrice: singleAmount,
      subtotal: singleAmount
    }
  ];
}

/**
 * Normalizes any transaction, invoice, or report payload into a canonical NormalizedPrintDocument.
 * Strictly preserves transaction monetary fields from payload without independent recalculation.
 */
export function normalizePrintDocument(rawPayload = {}, options = {}) {
  // If already normalized and only paper/options are being updated:
  if (
    rawPayload &&
    rawPayload.docType &&
    rawPayload.tenantIdentity &&
    rawPayload.meta &&
    rawPayload.summary &&
    Array.isArray(rawPayload.items) &&
    !options.forceRebuild
  ) {
    const resolvedPaper = resolvePaperSpec(options.paper || rawPayload.paper, rawPayload.docType);
    return {
      docType: rawPayload.docType,
      tenantIdentity: rawPayload.tenantIdentity,
      meta: rawPayload.meta,
      items: rawPayload.items,
      summary: rawPayload.summary,
      paper: resolvedPaper,
      renderOptions: {
        ...rawPayload.renderOptions,
        ...(options.renderOptions || {})
      }
    };
  }

  const tx = rawPayload?.transaction || rawPayload?.transactionData || rawPayload || {};
  const docType = options.docType || rawPayload.docType || tx.docType || DOC_TYPES.THERMAL_RECEIPT;
  const paper = resolvePaperSpec(options.paper || rawPayload.paper || tx.paper, docType);

  const tenantSource =
    options.tenantProfile ||
    options.tenantData ||
    rawPayload.tenantProfile ||
    rawPayload.tenantData ||
    rawPayload.arena ||
    tx.tenantData ||
    tx.arena ||
    {};

  const tenantIdentity = resolveTenantIdentity(tenantSource);
  const moduleSource = inferModuleSource(tx, docType);
  const items = normalizeItems(tx, docType);

  // Preserve monetary numbers directly from transaction payload
  const hasExplicitTotal =
    tx.total !== undefined ||
    tx.totalAmount !== undefined ||
    tx.amount !== undefined ||
    tx.price !== undefined ||
    tx.billedAmount !== undefined ||
    tx.currentPaymentAmount !== undefined ||
    tx.totalGrossRevenue !== undefined;

  const total = hasExplicitTotal
    ? Number(
        tx.total ??
        tx.totalAmount ??
        tx.amount ??
        tx.price ??
        tx.billedAmount ??
        tx.currentPaymentAmount ??
        tx.totalGrossRevenue ??
        0
      )
    : 0;

  const subtotal = tx.subtotal !== undefined ? Number(tx.subtotal) : total;
  const discount = tx.discount !== undefined ? Number(tx.discount) : 0;
  const tax = tx.tax !== undefined ? Number(tx.tax) : 0;

  // Cash / Amount Paid & Change Amount strictly taken from transaction payload
  const hasAmountPaid = tx.amountPaid !== undefined || tx.cashReceived !== undefined;
  const amountPaid = hasAmountPaid
    ? Number(tx.amountPaid ?? tx.cashReceived ?? 0)
    : total;

  const hasChangeAmount = tx.changeAmount !== undefined || tx.change !== undefined || tx.kembalian !== undefined;
  const changeAmount = hasChangeAmount
    ? Number(tx.changeAmount ?? tx.change ?? tx.kembalian ?? 0)
    : 0;

  const paymentMethod = String(tx.paymentMethod || tx.payment_method || '-').trim();
  const isCashPayment =
    paymentMethod.toLowerCase().includes('tunai') ||
    paymentMethod.toLowerCase().includes('cash');

  const sponsorObj = tx.sponsor || {};
  const contractValue = Number(tx.contractValue ?? sponsorObj.contractValue ?? 0);
  const totalPaid = Number(tx.totalPaid ?? sponsorObj.totalPaid ?? 0);
  const remainingBalance =
    tx.remainingBalance !== undefined
      ? Number(tx.remainingBalance)
      : sponsorObj.remainingBalance !== undefined
      ? Number(sponsorObj.remainingBalance)
      : Math.max(0, contractValue - totalPaid);
  const pendingAmount = Number(tx.pendingAmount ?? sponsorObj.pendingAmount ?? 0);

  const meta = {
    receiptNo: String(
      tx.receiptNo ||
      tx.receipt_no ||
      tx.invoiceNumber ||
      sponsorObj.invoiceNumber ||
      '-'
    ).trim(),
    date: String(
      tx.date ||
      tx.bookingDate ||
      tx.invoiceDate ||
      new Date().toLocaleDateString('id-ID')
    ).trim(),
    time: String(tx.time || '').trim(),
    cashierName: String(tx.cashierName || tx.recordedBy || '-').trim(),
    customerName: String(
      tx.customerName ||
      tx.studentName ||
      tx.participantName ||
      sponsorObj.companyName ||
      sponsorObj.name ||
      ''
    ).trim(),
    customerPhone: String(
      tx.customerPhone ||
      tx.whatsappNumber ||
      sponsorObj.whatsappNumber ||
      ''
    ).trim(),
    customerSubInfo: String(
      tx.customerSubInfo ||
      tx.parentName ||
      sponsorObj.contactPerson ||
      tx.categoryName ||
      ''
    ).trim(),
    sponsorCategory: String(tx.sponsorCategory || sponsorObj.category || '').trim(),
    eventName: String(tx.eventName || sponsorObj.eventName || '').trim(),
    invoiceDueDate: String(tx.invoiceDueDate || sponsorObj.invoiceDueDate || sponsorObj.dueDate || 'Sesuai Kesepakatan').trim(),
    paymentTerm: String(tx.paymentTerm || '').trim(),
    periodLabel: String(tx.periodLabel || tx.timeFilterLabel || '').trim(),
    signerName: String(
      tx.signerName ||
      options.userProfile?.displayName ||
      options.userProfile?.name ||
      tenantIdentity.ownerName ||
      ''
    ).trim(),
    moduleSource,
    isReprint: Boolean(tx.isReprint || options.isReprint),
    reprintTimestamp: tx.reprintTimestamp || options.reprintTimestamp || null
  };

  const summary = {
    subtotal,
    discount,
    tax,
    total,
    paymentMethod,
    isCashPayment,
    amountPaid,
    changeAmount,
    hasCashBreakdown: Boolean(isCashPayment && (hasAmountPaid || hasChangeAmount)),
    status: String(tx.status || (remainingBalance === 0 && contractValue > 0 ? 'LUNAS' : 'LUNAS')).trim(),
    notes: String(tx.notes || '').trim(),
    // B2B Sponsorship summary fields
    contractValue,
    totalPaid,
    remainingBalance,
    pendingAmount,
    // Financial Report summary fields
    bookingRevenue: Number(tx.bookingRevenue ?? 0),
    posRevenue: Number(tx.posRevenue ?? 0),
    sppRevenue: Number(tx.sppRevenue ?? 0),
    totalGrossRevenue: Number(tx.totalGrossRevenue ?? total),
    activeCount: Number(tx.activeCount ?? 0),
    voidCount: Number(tx.voidCount ?? 0)
  };

  const renderOptions = {
    showLogo: options.renderOptions?.showLogo ?? Boolean(tenantIdentity.logoUrl),
    showBankAccounts: options.renderOptions?.showBankAccounts ?? true,
    showCashBreakdown: options.renderOptions?.showCashBreakdown ?? summary.hasCashBreakdown,
    showSignature: options.renderOptions?.showSignature ?? (docType !== DOC_TYPES.THERMAL_RECEIPT),
    showFooterNote: options.renderOptions?.showFooterNote ?? true,
    cutPaper: options.renderOptions?.cutPaper ?? false,
    feedLines: options.renderOptions?.feedLines ?? 3
  };

  return {
    docType,
    tenantIdentity,
    meta,
    items,
    summary,
    paper,
    renderOptions
  };
}

/**
 * Formats a NormalizedPrintDocument into fixed-width thermal lines
 * (32 columns for 58mm, 48 columns for 80mm).
 * Every returned line is guaranteed to have length <= columns.
 */
export function formatThermalTextLines(normalizedDoc, overrideColumns = null) {
  const doc = normalizePrintDocument(normalizedDoc);
  const cols = Number(overrideColumns || doc.paper?.columns || 32);
  const sep = '-'.repeat(cols);
  const doubleSep = '='.repeat(cols);
  const lines = [];

  // 1. Header / Tenant Identity
  if (doc.tenantIdentity.headerName) {
    lines.push(...centerText(doc.tenantIdentity.headerName.toUpperCase(), cols));
  }
  if (doc.tenantIdentity.subTitle) {
    lines.push(...centerText(doc.tenantIdentity.subTitle.toUpperCase(), cols));
  }
  if (doc.tenantIdentity.address) {
    lines.push(...centerText(doc.tenantIdentity.address, cols));
  }
  if (doc.tenantIdentity.contact) {
    lines.push(...centerText(doc.tenantIdentity.contact, cols));
  }

  if (doc.meta.isReprint) {
    lines.push(...centerText('*** CETAK ULANG (COPY) ***', cols));
  }

  lines.push(sep);

  // 2. Transaction Metadata
  lines.push(...formatTwoColumns('No. Struk', doc.meta.receiptNo, cols));
  const dateTimeStr = doc.meta.time ? `${doc.meta.date} ${doc.meta.time}` : doc.meta.date;
  lines.push(...formatTwoColumns('Tanggal', dateTimeStr, cols));
  if (doc.meta.cashierName && doc.meta.cashierName !== '-') {
    lines.push(...formatTwoColumns('Kasir', doc.meta.cashierName, cols));
  }
  if (doc.meta.customerName) {
    lines.push(...formatTwoColumns('Pelanggan', doc.meta.customerName, cols));
  }

  lines.push(sep);

  // 3. Items List
  for (const item of doc.items) {
    lines.push(...wrapText(item.name, cols));
    if (item.description) {
      lines.push(...wrapText(item.description, cols));
    }
    const qtyPriceStr = `${item.qty || 1} x ${formatRupiah(item.unitPrice)}`;
    const subtotalStr = formatRupiah(item.subtotal);
    lines.push(...formatTwoColumns(qtyPriceStr, subtotalStr, cols));
  }

  lines.push(doubleSep);

  // 4. Totals & Payment Breakdown
  lines.push(...formatTwoColumns('TOTAL', formatRupiah(doc.summary.total), cols));
  lines.push(...formatTwoColumns('Metode Bayar', doc.summary.paymentMethod, cols));

  if (doc.renderOptions.showCashBreakdown) {
    lines.push(...formatTwoColumns('Dibayar', formatRupiah(doc.summary.amountPaid), cols));
    lines.push(...formatTwoColumns('Kembalian', formatRupiah(doc.summary.changeAmount), cols));
  }

  if (doc.summary.status) {
    lines.push(...formatTwoColumns('Status', doc.summary.status.toUpperCase(), cols));
  }

  if (doc.summary.notes) {
    lines.push(sep);
    lines.push(...wrapText(`Catatan: ${doc.summary.notes}`, cols));
  }

  lines.push(sep);

  // 5. Dynamic Tenant Footer
  if (doc.renderOptions.showFooterNote && doc.tenantIdentity.footerNote) {
    lines.push(...centerText(doc.tenantIdentity.footerNote, cols));
  }

  return lines;
}

export default {
  formatRupiah,
  truncateText,
  wrapText,
  centerText,
  formatTwoColumns,
  resolveTenantIdentity,
  normalizePrintDocument,
  formatThermalTextLines
};
