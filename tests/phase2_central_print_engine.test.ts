import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOC_TYPES,
  PAPER_SIZES,
  PRINT_EXECUTION_STATUS,
  resolvePaperSpec,
  validateNormalizedPrintDocument
} from '../src/printing/types/printTypes.js';
import {
  formatRupiah,
  wrapText,
  formatTwoColumns,
  normalizePrintDocument,
  formatThermalTextLines
} from '../src/printing/templates/ReceiptTemplateEngine.js';
import {
  EscPosEncoder,
  encodeEscPosDocument,
  ESC_POS_COMMANDS
} from '../src/printing/templates/EscPosEncoder.js';
import {
  BrowserPrintAdapter,
  buildIsolatedPrintHtml
} from '../src/printing/adapters/BrowserPrintAdapter.js';
import {
  generatePDFDocument,
  downloadPDFDocument
} from '../src/printing/pdf/PDFGenerator.js';
import { PrintEngine } from '../src/printing/core/PrintEngine.js';

const MOCK_TENANT_PROFILE = {
  id: 'tenant-nusantara-01',
  name: 'Nusantara Sport Center',
  receiptHeaderName: 'NUSANTARA ARENA SURABAYA',
  receiptAddress: 'Jl. Ahmad Yani No. 108, Wonokromo, Surabaya',
  receiptContact: 'WA: 0811-3344-5566',
  receiptFooterNote: 'Simpan struk ini sebagai bukti pembayaran sah.',
  email: 'admin@nusantara-arena.id',
  ownerName: 'Budi Santoso',
  bankAccounts: [
    {
      bankName: 'BCA',
      accountNumber: '8810992811',
      accountName: 'PT Nusantara Arena Jaya'
    },
    {
      bankName: 'Bank Mandiri',
      accountNumber: '1420099887766',
      accountName: 'PT Nusantara Arena Jaya'
    }
  ]
};

test('CHUVATOR — Phase 2 Central Print Engine & Template Engine Verification', async (t) => {
  await t.test('1. Normalisasi payload Booking, POS, SPP, dan Event ke skema kanonik NormalizedPrintDocument', () => {
    // a. Booking Payload
    const bookingPayload = {
      receiptNo: 'BKG-890123',
      date: '11/11/2026',
      time: '19:00',
      cashierName: 'Kasir Malam',
      customerName: 'Rizky Pratama',
      itemName: 'Sewa Lapangan Futsal Vinyl A',
      schedule: '11/11/2026 (19:00 - 21:00)',
      amount: 300000,
      paymentMethod: 'Tunai (Cash)',
      cashReceived: 350000,
      changeAmount: 50000,
      status: 'LUNAS'
    };

    const bookingDoc = normalizePrintDocument(bookingPayload, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: '58mm'
    });

    assert.equal(validateNormalizedPrintDocument(bookingDoc).valid, true);
    assert.equal(bookingDoc.docType, DOC_TYPES.THERMAL_RECEIPT);
    assert.equal(bookingDoc.meta.moduleSource, 'BOOKING');
    assert.equal(bookingDoc.items.length, 1);
    assert.equal(bookingDoc.items[0].name, 'Sewa Lapangan Futsal Vinyl A');
    assert.equal(bookingDoc.summary.total, 300000);
    assert.equal(bookingDoc.summary.amountPaid, 350000);
    assert.equal(bookingDoc.summary.changeAmount, 50000);

    // b. POS Payload
    const posPayload = {
      receiptNo: 'POS-445566',
      date: '11/11/2026',
      time: '20:15',
      cashierName: 'Siti Aminah',
      customerName: 'Member Umum',
      items: [
        { name: 'Isotonic Drink Blue 500ml', qty: 3, price: 12000, subtotal: 36000 },
        { name: 'Shuttlecock Pro Feather Tube', qty: 1, price: 145000, subtotal: 145000 }
      ],
      totalAmount: 181000,
      paymentMethod: 'Tunai (Cash)',
      cashReceived: 200000,
      changeAmount: 19000
    };

    const posDoc = normalizePrintDocument(posPayload, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: '80mm'
    });

    assert.equal(validateNormalizedPrintDocument(posDoc).valid, true);
    assert.equal(posDoc.meta.moduleSource, 'POS');
    assert.equal(posDoc.items.length, 2);
    assert.equal(posDoc.summary.total, 181000);
    assert.equal(posDoc.summary.amountPaid, 200000);
    assert.equal(posDoc.summary.changeAmount, 19000);

    // c. SPP Akademi Payload
    const sppPayload = {
      receiptNo: 'AKD-778899',
      date: '11 Nov 2026, 15:30',
      cashierName: 'Admin Akademi',
      customerName: 'Dimas Anggara (Wali: Pak Hendra)',
      items: [
        { name: 'Biaya Pendaftaran - Dimas Anggara', qty: 1, price: 150000, subtotal: 150000 },
        { name: 'SPP Akademi (November 2026) - Dimas Anggara', qty: 1, price: 350000, subtotal: 350000 }
      ],
      total: 500000,
      paymentMethod: 'QRIS Statis',
      status: 'LUNAS',
      notes: 'Akademi: Nusantara Youth Football'
    };

    const sppDoc = normalizePrintDocument(sppPayload, {
      tenantProfile: MOCK_TENANT_PROFILE,
      docType: DOC_TYPES.OFFICIAL_RECEIPT_A5
    });

    assert.equal(validateNormalizedPrintDocument(sppDoc).valid, true);
    assert.equal(sppDoc.docType, DOC_TYPES.OFFICIAL_RECEIPT_A5);
    assert.equal(sppDoc.meta.moduleSource, 'SPP');
    assert.equal(sppDoc.summary.total, 500000);
    assert.equal(sppDoc.summary.notes, 'Akademi: Nusantara Youth Football');

    // d. Event Registration Payload
    const eventPayload = {
      receiptNo: 'EVT-990011',
      date: '11 Nov 2026',
      cashierName: 'Panitia Turnamen',
      customerName: 'Garuda Muda FC',
      items: [
        {
          name: 'Registrasi: Piala Nusantara U-16 [Kategori Putra]',
          qty: 1,
          price: 750000,
          subtotal: 750000
        }
      ],
      total: 750000,
      amountPaid: 750000,
      paymentMethod: 'Transfer Bank',
      status: 'LUNAS'
    };

    const eventDoc = normalizePrintDocument(eventPayload, {
      tenantProfile: MOCK_TENANT_PROFILE
    });

    assert.equal(validateNormalizedPrintDocument(eventDoc).valid, true);
    assert.equal(eventDoc.meta.moduleSource, 'EVENT');
    assert.equal(eventDoc.summary.total, 750000);
  });

  await t.test('2. Validasi format nominal Rupiah deterministik', () => {
    assert.equal(formatRupiah(0), 'Rp 0');
    assert.equal(formatRupiah(15000), 'Rp 15.000');
    assert.equal(formatRupiah(1250000), 'Rp 1.250.000');
    assert.equal(formatRupiah(-50000), '-Rp 50.000');
    assert.equal(formatRupiah(350000, { withPrefix: false }), '350.000');
  });

  await t.test('3. Validasi amountPaid, changeAmount, dan total berasal murni dari payload tanpa kalkulasi ulang independen', () => {
    // Even if item subtotals differ due to custom promo/bundle in transaction payload,
    // ReceiptTemplateEngine must strictly preserve the payload's total, amountPaid, and changeAmount.
    const customBundleTx = {
      receiptNo: 'POS-BUNDLE-01',
      items: [
        { name: 'Item A', qty: 2, price: 60000, subtotal: 120000 }
      ],
      total: 99000, // Bundle final price from transaction payload
      paymentMethod: 'Tunai',
      amountPaid: 100000,
      changeAmount: 1000
    };

    const doc = normalizePrintDocument(customBundleTx, {
      tenantProfile: MOCK_TENANT_PROFILE
    });

    assert.equal(doc.summary.total, 99000);
    assert.equal(doc.summary.amountPaid, 100000);
    assert.equal(doc.summary.changeAmount, 1000);
  });

  await t.test('4 & 5. Validasi 32 kolom (Thermal 58mm), 48 kolom (Thermal 80mm), dan wrapping nama produk panjang', () => {
    const longProductTx = {
      receiptNo: 'POS-LONG-99',
      date: '11/11/2026',
      cashierName: 'Kasir Utama',
      customerName: 'Komunitas Badminton Surabaya Barat',
      items: [
        {
          name: 'SEPATU BADMINTON PROFESIONAL CARBON PLATE EDITION ULTRA LIGHTWEIGHT SERIES 2026',
          qty: 2,
          price: 1250000,
          subtotal: 2500000
        }
      ],
      total: 2500000,
      paymentMethod: 'Tunai',
      cashReceived: 2600000,
      changeAmount: 100000
    };

    // 58mm -> 32 columns
    const doc58 = normalizePrintDocument(longProductTx, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: PAPER_SIZES.THERMAL_58MM
    });
    assert.equal(doc58.paper.columns, 32);
    const lines58 = formatThermalTextLines(doc58);
    assert.ok(lines58.length > 10);
    for (const line of lines58) {
      assert.ok(
        line.length <= 32,
        `Line exceeds 32 columns (${line.length}): "${line}"`
      );
    }

    // 80mm -> 48 columns
    const doc80 = normalizePrintDocument(longProductTx, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: PAPER_SIZES.THERMAL_80MM
    });
    assert.equal(doc80.paper.columns, 48);
    const lines80 = formatThermalTextLines(doc80);
    assert.ok(lines80.length > 10);
    for (const line of lines80) {
      assert.ok(
        line.length <= 48,
        `Line exceeds 48 columns (${line.length}): "${line}"`
      );
    }

    // Verify unbroken token wrapping > 32 chars
    const unbrokenWrapped = wrapText('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFG', 32);
    assert.equal(unbrokenWrapped.length, 2);
    assert.equal(unbrokenWrapped[0].length, 32);
    assert.equal(unbrokenWrapped[1].length, 11);

    // Verify two-column alignment preserves right amount intact
    const twoCol32 = formatTwoColumns('TOTAL PEMBAYARAN AKHIR', 'Rp 2.500.000', 32);
    for (const row of twoCol32) {
      assert.ok(row.length <= 32);
    }
    assert.ok(twoCol32[twoCol32.length - 1].endsWith('Rp 2.500.000'));
  });

  await t.test('6. Validasi identitas tenant dinamis dan bebas nilai hardcode', () => {
    const customTenant = {
      receiptHeaderName: 'GARUDA ARENA BANDUNG',
      receiptAddress: 'Jl. Soekarno Hatta No. 45, Bandung',
      receiptContact: '022-7788990',
      receiptFooterNote: 'Terima kasih telah bermain di Garuda Arena Bandung!'
    };

    const docWithTenant = normalizePrintDocument(
      { receiptNo: 'TRX-01', total: 100000 },
      { tenantProfile: customTenant, paper: '58mm' }
    );

    const textWithTenant = formatThermalTextLines(docWithTenant).join('\n');
    assert.ok(textWithTenant.includes('GARUDA ARENA BANDUNG'));
    assert.ok(textWithTenant.includes('Jl. Soekarno Hatta No. 45'));
    assert.ok(textWithTenant.includes('Garuda Arena Bandung!'));
    assert.ok(!textWithTenant.includes('KEDIRI SPORT ARENA'));
    assert.ok(!textWithTenant.includes('CHUA SPORT CORE'));

    // Empty tenant object should not inject hardcoded legacy company names
    const docEmptyTenant = normalizePrintDocument(
      { receiptNo: 'TRX-02', total: 50000 },
      { tenantProfile: {}, paper: '58mm' }
    );
    const textEmptyTenant = formatThermalTextLines(docEmptyTenant).join('\n');
    assert.ok(!textEmptyTenant.includes('KEDIRI SPORT ARENA'));
    assert.ok(!textEmptyTenant.includes('CHUA SPORT CORE'));
  });

  await t.test('7. Validasi ukuran dan orientasi A4 & A5 (Portrait dan Landscape)', () => {
    const a5p = resolvePaperSpec('A5_PORTRAIT');
    assert.equal(a5p.widthMm, 148);
    assert.equal(a5p.heightMm, 210);
    assert.equal(a5p.orientation, 'portrait');

    const a5l = resolvePaperSpec('A5_LANDSCAPE');
    assert.equal(a5l.widthMm, 210);
    assert.equal(a5l.heightMm, 148);
    assert.equal(a5l.orientation, 'landscape');

    const a4p = resolvePaperSpec('A4_PORTRAIT');
    assert.equal(a4p.widthMm, 210);
    assert.equal(a4p.heightMm, 297);
    assert.equal(a4p.orientation, 'portrait');

    const a4l = resolvePaperSpec('A4_LANDSCAPE');
    assert.equal(a4l.widthMm, 297);
    assert.equal(a4l.heightMm, 210);
    assert.equal(a4l.orientation, 'landscape');
  });

  await t.test('8. Validasi PDFGenerator untuk Thermal 58mm/80mm, Kwitansi A5, Invoice B2B A4, dan Laporan Keuangan A4', () => {
    const sampleTx = {
      receiptNo: 'TRX-PDF-100',
      customerName: 'Andi Wijaya',
      items: [{ name: 'Sewa Lapangan Badminton 2 Jam', qty: 1, price: 90000, subtotal: 90000 }],
      total: 90000,
      paymentMethod: 'QRIS'
    };

    // 8a. Thermal 58mm PDF
    const pdf58 = generatePDFDocument(sampleTx, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: PAPER_SIZES.THERMAL_58MM
    });
    assert.equal(pdf58.ok, true);
    assert.equal(pdf58.status, PRINT_EXECUTION_STATUS.PDF_GENERATED);
    assert.equal(pdf58.pageSize.widthMm, 58);
    assert.ok(pdf58.byteLength > 500);

    // 8b. Thermal 80mm PDF
    const pdf80 = generatePDFDocument(sampleTx, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: PAPER_SIZES.THERMAL_80MM
    });
    assert.equal(pdf80.ok, true);
    assert.equal(pdf80.pageSize.widthMm, 80);
    assert.ok(pdf80.byteLength > 500);

    // 8c. Official Receipt A5 Landscape & Portrait
    const pdfA5L = generatePDFDocument(sampleTx, {
      tenantProfile: MOCK_TENANT_PROFILE,
      docType: DOC_TYPES.OFFICIAL_RECEIPT_A5,
      paper: PAPER_SIZES.A5_LANDSCAPE
    });
    assert.equal(pdfA5L.ok, true);
    assert.equal(pdfA5L.pageSize.widthMm, 210);
    assert.equal(pdfA5L.pageSize.heightMm, 148);

    const pdfA5P = generatePDFDocument(sampleTx, {
      tenantProfile: MOCK_TENANT_PROFILE,
      docType: DOC_TYPES.OFFICIAL_RECEIPT_A5,
      paper: PAPER_SIZES.A5_PORTRAIT
    });
    assert.equal(pdfA5P.ok, true);
    assert.equal(pdfA5P.pageSize.widthMm, 148);
    assert.equal(pdfA5P.pageSize.heightMm, 210);

    // 8d. B2B Sponsorship Invoice A4 Portrait
    const sponsorPayload = {
      docType: DOC_TYPES.B2B_INVOICE_A4,
      sponsor: {
        invoiceNumber: 'INV/SPO/2026/001',
        companyName: 'PT Energi Nusantara Tbk',
        contactPerson: 'Bpk. Wahyu',
        whatsappNumber: '081299887766',
        category: 'Platinum Sponsor',
        contractValue: 50000000,
        totalPaid: 25000000
      },
      currentPaymentAmount: 25000000,
      eventName: 'Nusantara Cup 2026',
      paymentTerm: 'Termin 1 (50%)'
    };

    const pdfInvoiceA4 = generatePDFDocument(sponsorPayload, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: PAPER_SIZES.A4_PORTRAIT
    });
    assert.equal(pdfInvoiceA4.ok, true);
    assert.equal(pdfInvoiceA4.pageSize.widthMm, 210);
    assert.equal(pdfInvoiceA4.pageSize.heightMm, 297);
    assert.ok(pdfInvoiceA4.filename.startsWith('Invoice_B2B_'));

    // 8e. Financial Report A4 Landscape
    const financePayload = {
      docType: DOC_TYPES.FINANCIAL_REPORT_A4,
      receiptNo: 'GL-2026-11',
      periodLabel: 'November 2026',
      bookingRevenue: 12000000,
      posRevenue: 4500000,
      sppRevenue: 8000000,
      totalGrossRevenue: 24500000,
      ledgerEntries: [
        { date: '11/11/2026', categoryLabel: 'Sewa Lapangan', title: 'Rizky', detail: 'Lapangan 1', amount: 300000, isVoid: false },
        { date: '11/11/2026', categoryLabel: 'Kasir POS', title: 'Minuman', detail: 'Tunai', amount: 50000, isVoid: false }
      ]
    };

    const pdfFinance = downloadPDFDocument(financePayload, {
      tenantProfile: MOCK_TENANT_PROFILE,
      paper: PAPER_SIZES.A4_LANDSCAPE,
      skipBrowserDownload: true
    });
    assert.equal(pdfFinance.ok, true);
    assert.equal(pdfFinance.pageSize.widthMm, 297);
    assert.equal(pdfFinance.pageSize.heightMm, 210);
  });

  await t.test('9. Validasi CSS cetak terisolasi (BrowserPrintAdapter) & status kejujuran eksekusi', async () => {
    const html58 = buildIsolatedPrintHtml(
      { receiptNo: 'ISO-58', total: 75000 },
      { tenantProfile: MOCK_TENANT_PROFILE, paper: PAPER_SIZES.THERMAL_58MM }
    );

    assert.ok(html58.includes('<!DOCTYPE html>'));
    assert.ok(html58.includes('size: 58mm auto;'));
    assert.ok(!html58.includes('visibility: hidden'));
    assert.ok(html58.includes('NUSANTARA ARENA SURABAYA'));

    const htmlA4 = buildIsolatedPrintHtml(
      { docType: DOC_TYPES.FINANCIAL_REPORT_A4, receiptNo: 'ISO-A4', totalGrossRevenue: 500000 },
      { tenantProfile: MOCK_TENANT_PROFILE, paper: PAPER_SIZES.A4_LANDSCAPE }
    );
    assert.ok(htmlA4.includes('size: 297mm 210mm;'));
    assert.ok(!htmlA4.includes('visibility: hidden'));

    // In Node environment without window.print, BrowserPrintAdapter must gracefully report FAILED and physicalPrintConfirmed: false
    const adapter = new BrowserPrintAdapter();
    const res = await adapter.print(
      { receiptNo: 'ISO-58', total: 75000 },
      { tenantProfile: MOCK_TENANT_PROFILE }
    );
    assert.equal(res.physicalPrintConfirmed, false);
    assert.equal(res.status, PRINT_EXECUTION_STATUS.FAILED);
  });

  await t.test('10. Validasi EscPosEncoder & Central PrintEngine buildPrintPayload', () => {
    const engine = new PrintEngine();
    const payload = engine.buildPrintPayload(
      {
        receiptNo: 'ESC-001',
        customerName: 'Bima Sakti',
        items: [{ name: 'Air Mineral 600ml', qty: 2, price: 5000, subtotal: 10000 }],
        total: 10000,
        paymentMethod: 'Tunai',
        amountPaid: 20000,
        changeAmount: 10000
      },
      {
        tenantProfile: MOCK_TENANT_PROFILE,
        paper: PAPER_SIZES.THERMAL_58MM,
        renderOptions: { cutPaper: true }
      }
    );

    assert.equal(payload.ok, true);
    assert.ok(payload.escPos);
    assert.equal(payload.escPos.columns, 32);
    assert.ok(payload.escPos.byteLength > 50);

    // Check INIT command [0x1B, 0x40] at start
    assert.equal(payload.escPos.bytes[0], ESC_POS_COMMANDS.INIT[0]);
    assert.equal(payload.escPos.bytes[1], ESC_POS_COMMANDS.INIT[1]);

    // Check CUT command was included because cutPaper: true
    const hasCutCommand = payload.escPos.commands.some((c) => c.type === 'CUT');
    assert.equal(hasCutCommand, true);

    // Check compatible_safe profile (no cutPaper, no hardware align, LF feed)
    const safeEncoded = encodeEscPosDocument(payload.normalizedDoc, {
      profile: 'COMPATIBLE_SAFE',
      cutPaper: false
    });
    const hasCutSafe = safeEncoded.commands.some((c) => c.type === 'CUT');
    assert.equal(hasCutSafe, false);
  });
});
