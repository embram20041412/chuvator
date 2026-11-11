/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: Canonical Print Types, Paper Specifications, and Schema Validators
 */

export const DOC_TYPES = Object.freeze({
  THERMAL_RECEIPT: 'THERMAL_RECEIPT',
  OFFICIAL_RECEIPT_A5: 'OFFICIAL_RECEIPT_A5',
  B2B_INVOICE_A4: 'B2B_INVOICE_A4',
  FINANCIAL_REPORT_A4: 'FINANCIAL_REPORT_A4'
});

export const PAPER_SIZES = Object.freeze({
  THERMAL_58MM: Object.freeze({
    id: 'THERMAL_58MM',
    size: '58mm',
    orientation: 'portrait',
    category: 'thermal',
    widthMm: 58,
    heightMm: null, // Roll paper (dynamic height)
    printableWidthMm: 48,
    columns: 32,
    cssPageSize: '58mm auto',
    marginMm: 0,
    label: 'Thermal 58mm (32 Kolom)'
  }),
  THERMAL_80MM: Object.freeze({
    id: 'THERMAL_80MM',
    size: '80mm',
    orientation: 'portrait',
    category: 'thermal',
    widthMm: 80,
    heightMm: null, // Roll paper (dynamic height)
    printableWidthMm: 72,
    columns: 48,
    cssPageSize: '80mm auto',
    marginMm: 0,
    label: 'Thermal 80mm (48 Kolom)'
  }),
  A5_PORTRAIT: Object.freeze({
    id: 'A5_PORTRAIT',
    size: 'a5',
    orientation: 'portrait',
    category: 'sheet',
    widthMm: 148,
    heightMm: 210,
    printableWidthMm: 128,
    columns: 64,
    cssPageSize: '148mm 210mm',
    marginMm: 10,
    label: 'A5 Portrait (148 × 210 mm)'
  }),
  A5_LANDSCAPE: Object.freeze({
    id: 'A5_LANDSCAPE',
    size: 'a5',
    orientation: 'landscape',
    category: 'sheet',
    widthMm: 210,
    heightMm: 148,
    printableWidthMm: 190,
    columns: 80,
    cssPageSize: '210mm 148mm',
    marginMm: 10,
    label: 'A5 Landscape (210 × 148 mm)'
  }),
  A4_PORTRAIT: Object.freeze({
    id: 'A4_PORTRAIT',
    size: 'a4',
    orientation: 'portrait',
    category: 'sheet',
    widthMm: 210,
    heightMm: 297,
    printableWidthMm: 182,
    columns: 80,
    cssPageSize: '210mm 297mm',
    marginMm: 14,
    label: 'A4 Portrait (210 × 297 mm)'
  }),
  A4_LANDSCAPE: Object.freeze({
    id: 'A4_LANDSCAPE',
    size: 'a4',
    orientation: 'landscape',
    category: 'sheet',
    widthMm: 297,
    heightMm: 210,
    printableWidthMm: 269,
    columns: 110,
    cssPageSize: '297mm 210mm',
    marginMm: 14,
    label: 'A4 Landscape (297 × 210 mm)'
  })
});

export const PRINT_ADAPTERS = Object.freeze({
  BROWSER: 'browser',
  PDF: 'pdf',
  ESC_POS: 'escpos',
  // Reserved for Phase 4 Hardware & Bridge Adapters
  WEB_USB: 'webusb',
  WEB_BLUETOOTH: 'webbluetooth',
  LOCAL_BRIDGE: 'bridge'
});

export const PRINT_EXECUTION_STATUS = Object.freeze({
  DIALOG_OPENED: 'DIALOG_OPENED',
  PDF_GENERATED: 'PDF_GENERATED',
  PAYLOAD_BUILT: 'PAYLOAD_BUILT',
  FALLBACK_USED: 'FALLBACK_USED',
  FAILED: 'FAILED'
});

export const MODULE_SOURCES = Object.freeze({
  BOOKING: 'BOOKING',
  POS: 'POS',
  SPP: 'SPP',
  EVENT: 'EVENT',
  SPONSOR: 'SPONSOR',
  FINANCE: 'FINANCE',
  GENERAL: 'GENERAL'
});

/**
 * Default paper preset per document type
 */
export const DEFAULT_PAPER_BY_DOC_TYPE = Object.freeze({
  [DOC_TYPES.THERMAL_RECEIPT]: PAPER_SIZES.THERMAL_80MM,
  [DOC_TYPES.OFFICIAL_RECEIPT_A5]: PAPER_SIZES.A5_LANDSCAPE,
  [DOC_TYPES.B2B_INVOICE_A4]: PAPER_SIZES.A4_PORTRAIT,
  [DOC_TYPES.FINANCIAL_REPORT_A4]: PAPER_SIZES.A4_PORTRAIT
});

/**
 * Allowed paper options in ReceiptPreviewModal per document type
 */
export function getAvailablePapersForDocType(docType) {
  switch (docType) {
    case DOC_TYPES.THERMAL_RECEIPT:
      return [
        PAPER_SIZES.THERMAL_58MM,
        PAPER_SIZES.THERMAL_80MM,
        PAPER_SIZES.A5_LANDSCAPE,
        PAPER_SIZES.A5_PORTRAIT
      ];
    case DOC_TYPES.OFFICIAL_RECEIPT_A5:
      return [
        PAPER_SIZES.A5_LANDSCAPE,
        PAPER_SIZES.A5_PORTRAIT,
        PAPER_SIZES.A4_PORTRAIT,
        PAPER_SIZES.THERMAL_80MM,
        PAPER_SIZES.THERMAL_58MM
      ];
    case DOC_TYPES.B2B_INVOICE_A4:
      return [
        PAPER_SIZES.A4_PORTRAIT,
        PAPER_SIZES.A4_LANDSCAPE,
        PAPER_SIZES.A5_LANDSCAPE
      ];
    case DOC_TYPES.FINANCIAL_REPORT_A4:
      return [
        PAPER_SIZES.A4_PORTRAIT,
        PAPER_SIZES.A4_LANDSCAPE
      ];
    default:
      return Object.values(PAPER_SIZES);
  }
}

/**
 * Resolves a paper specification from a preset key, size/orientation object, or docType default
 */
export function resolvePaperSpec(paperInput, docType = DOC_TYPES.THERMAL_RECEIPT) {
  if (!paperInput) {
    return { ...(DEFAULT_PAPER_BY_DOC_TYPE[docType] || PAPER_SIZES.THERMAL_80MM) };
  }

  if (typeof paperInput === 'string') {
    const normalized = paperInput.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (PAPER_SIZES[normalized]) {
      return { ...PAPER_SIZES[normalized] };
    }
    if (normalized === '58MM' || normalized === '58') {
      return { ...PAPER_SIZES.THERMAL_58MM };
    }
    if (normalized === '80MM' || normalized === '80') {
      return { ...PAPER_SIZES.THERMAL_80MM };
    }
    if (normalized === 'A5') {
      return { ...PAPER_SIZES.A5_LANDSCAPE };
    }
    if (normalized === 'A4') {
      return { ...PAPER_SIZES.A4_PORTRAIT };
    }
  }

  if (typeof paperInput === 'object') {
    if (paperInput.id && PAPER_SIZES[paperInput.id]) {
      return {
        ...PAPER_SIZES[paperInput.id],
        ...paperInput
      };
    }

    const rawSize = String(paperInput.size || '').toLowerCase();
    const rawOrientation = String(paperInput.orientation || 'portrait').toLowerCase();

    if (rawSize === '58mm' || rawSize === '58') {
      return { ...PAPER_SIZES.THERMAL_58MM };
    }
    if (rawSize === '80mm' || rawSize === '80') {
      return { ...PAPER_SIZES.THERMAL_80MM };
    }
    if (rawSize === 'a5') {
      return rawOrientation === 'landscape'
        ? { ...PAPER_SIZES.A5_LANDSCAPE }
        : { ...PAPER_SIZES.A5_PORTRAIT };
    }
    if (rawSize === 'a4') {
      return rawOrientation === 'landscape'
        ? { ...PAPER_SIZES.A4_LANDSCAPE }
        : { ...PAPER_SIZES.A4_PORTRAIT };
    }
  }

  return { ...(DEFAULT_PAPER_BY_DOC_TYPE[docType] || PAPER_SIZES.THERMAL_80MM) };
}

/**
 * Validates whether an object conforms to the canonical NormalizedPrintDocument schema
 */
export function validateNormalizedPrintDocument(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    return { valid: false, errors: ['Document must be a non-null object'] };
  }

  const requiredKeys = [
    'docType',
    'tenantIdentity',
    'meta',
    'items',
    'summary',
    'paper',
    'renderOptions'
  ];

  for (const key of requiredKeys) {
    if (doc[key] === undefined || doc[key] === null) {
      errors.push(`Missing required field: ${key}`);
    }
  }

  if (doc.docType && !Object.values(DOC_TYPES).includes(doc.docType)) {
    errors.push(`Invalid docType: ${doc.docType}`);
  }

  if (doc.items && !Array.isArray(doc.items)) {
    errors.push('Field "items" must be an array');
  }

  if (doc.paper && typeof doc.paper === 'object') {
    if (!doc.paper.columns || typeof doc.paper.columns !== 'number') {
      errors.push('Field "paper.columns" must be a valid number');
    }
    if (!doc.paper.widthMm || typeof doc.paper.widthMm !== 'number') {
      errors.push('Field "paper.widthMm" must be a valid number');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
