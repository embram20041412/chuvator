import { jsPDF } from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';

// Pastikan plugin autoTable terpasang ke jsPDF
try {
  applyPlugin(jsPDF);
} catch (e) {
  // Plugin might already be initialized
}

function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

/**
 * Engine Generator PDF Invoice B2B untuk Sponsor / Mitra CRM
 * 
 * @param {Object} sponsor - Data sponsor lengkap
 * @param {Object} tenantProfile - Data profil tenant/GOR
 * @param {string} eventName - Nama event turnamen terkait
 * @param {number|string} currentPaymentAmount - Nominal yang dibayar/ditagihkan saat ini
 * @param {string} invoiceDueDate - Tanggal jatuh tempo invoice (opsional)
 * @param {string} paymentTerm - Detail termin pembayaran (misal: "DP Termin 1" atau "Pelunasan")
 * @param {string} sponsorBenefit - Rincian benefit sponsorship
 * @param {Object} currentUser - Objek profil pengguna admin/owner yang mencetak
 */
export const generateSponsorInvoice = (
  sponsor,
  tenantProfile = {},
  eventName = '',
  currentPaymentAmount = null,
  invoiceDueDate = '',
  paymentTerm = '',
  sponsorBenefit = '',
  currentUser = null
) => {
  if (!sponsor) {
    console.error('Data sponsor tidak ditemukan untuk cetak invoice.');
    return;
  }

  // 1. Inisialisasi Dokumen A4 Portrait (210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const leftMargin = 14;
  const rightMargin = pageWidth - 14; // 196mm

  // Data Normalisasi
  const gorName = tenantProfile?.name || 'CHUA SPORT ARENA';
  const gorAddress = tenantProfile?.address || 'Komplek Gelanggang Olahraga & Pusat Turnamen';
  const gorPhone = tenantProfile?.phone || tenantProfile?.contact || tenantProfile?.whatsappNumber || '0812-3456-7890';
  const gorEmail = tenantProfile?.email || 'finance@chuasport.com';

  const companyName = sponsor.companyName || sponsor.name || 'Mitra Sponsor';
  const contactPerson = sponsor.contactPerson || '-';
  const whatsappNumber = sponsor.whatsappNumber || '-';
  const sponsorCategory = sponsor.category || 'Sponsorship';
  const resolvedEvent = eventName || sponsor.eventName || 'Turnamen Olahraga Nasional';

  const contractValue = Number(sponsor.contractValue || 0);
  const totalPaid = Number(sponsor.totalPaid || 0);
  const remainingBalance = Math.max(0, contractValue - totalPaid);

  // Nominal yang ditagihkan saat ini (currentPaymentAmount)
  const billedAmount = currentPaymentAmount !== null && currentPaymentAmount !== undefined && Number(currentPaymentAmount) > 0
    ? Number(currentPaymentAmount)
    : (remainingBalance > 0 ? remainingBalance : contractValue);

  // Termin Pembayaran
  const resolvedPaymentTerm = paymentTerm && paymentTerm.trim() !== ''
    ? paymentTerm.trim()
    : (sponsor.status === 'Lunas' || remainingBalance === 0 ? 'Pelunasan Sponsorship' : 'Termin Sponsorship');

  // Benefit
  const resolvedBenefit = sponsorBenefit && sponsorBenefit.trim() !== ''
    ? sponsorBenefit.trim()
    : (sponsor.benefits || sponsor.benefit || 'Publikasi Brand, Media Partner');

  // Nomor & Tanggal Faktur
  const invoiceNumber = sponsor.invoiceNumber || `INV/SPO/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
  const invoiceDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Jatuh Tempo (Instruksi: jika kosong, tampilkan "Sesuai Kesepakatan")
  const rawDueDate = invoiceDueDate || sponsor.invoiceDueDate || sponsor.dueDate;
  let formattedDueDate = 'Sesuai Kesepakatan';
  if (rawDueDate) {
    try {
      const parsedDate = new Date(rawDueDate);
      if (!isNaN(parsedDate.getTime())) {
        formattedDueDate = parsedDate.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      } else {
        formattedDueDate = String(rawDueDate);
      }
    } catch {
      formattedDueDate = String(rawDueDate);
    }
  }

  // Nama Penandatangan (Dinamis: currentUser?.displayName || tenantProfile?.ownerName)
  const signerName =
    currentUser?.displayName ||
    currentUser?.name ||
    tenantProfile?.ownerName ||
    tenantProfile?.picName ||
    'Manajemen Pengelola';

  // Bank Info untuk Footer
  const bankAccount = Array.isArray(tenantProfile?.bankAccounts) && tenantProfile.bankAccounts.length > 0
    ? tenantProfile.bankAccounts[0]
    : {
        bankName: tenantProfile?.bankName || 'BCA',
        accountNumber: tenantProfile?.bankAccountNumber || '1234567890',
        accountName: tenantProfile?.bankAccountName || gorName
      };

  // -------------------------------------------------------------------------
  // 2. KOP SURAT (HEADER) - MENJAGA JARAK DAN MENCEGAH PENUMPUKAN TEKS
  // -------------------------------------------------------------------------
  // Garis Aksen Modern di Paling Atas Dokumen
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Nama GOR / Tenant
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(gorName.toUpperCase(), leftMargin, 16);

  // Alamat GOR dengan doc.splitTextToSize (lebar maksimal 100mm agar tidak menabrak teks kanan)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const maxAddressWidth = 100;
  const addressLines = doc.splitTextToSize(gorAddress, maxAddressWidth);
  let currentHeaderY = 21;
  doc.text(addressLines, leftMargin, currentHeaderY);

  // Koordinat Y dinamis untuk telepon & kontak di bawah alamat
  const addressLineHeight = 4.2;
  currentHeaderY += addressLines.length * addressLineHeight;
  doc.text(`Telp/WA: ${gorPhone}  |  Email: ${gorEmail}`, leftMargin, currentHeaderY);

  // Title Kanan: INVOICE & FAKTUR TAGIHAN B2B
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text('INVOICE', rightMargin, 16, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('FAKTUR TAGIHAN B2B SPONSORSHIP', rightMargin, 21, { align: 'right' });

  // Garis Pembatas Header Dinamis
  const headerBottomY = Math.max(currentHeaderY + 5, 30);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(leftMargin, headerBottomY, rightMargin, headerBottomY);

  // -------------------------------------------------------------------------
  // 3. META TAGIHAN & DITAGIHKAN KEPADA (BILLED TO)
  // -------------------------------------------------------------------------
  const metaY = headerBottomY + 7;

  // Kolom Kiri: DITAGIHKAN KEPADA (BILLED TO)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DITAGIHKAN KEPADA (BILLED TO):', leftMargin, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(companyName, leftMargin, metaY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Attn / UP : ${contactPerson}`, leftMargin, metaY + 11);
  doc.text(`Kontak/WA : ${whatsappNumber}`, leftMargin, metaY + 15.5);
  doc.text(`Kategori  : Paket ${sponsorCategory}`, leftMargin, metaY + 20);

  // Kolom Kanan: INFORMASI INVOICE
  const rightColX = rightMargin - 72;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('RINCIAN FAKTUR:', rightColX, metaY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.text('No. Invoice', rightColX, metaY + 6);
  doc.text(`: ${invoiceNumber}`, rightColX + 24, metaY + 6);

  doc.text('Tanggal', rightColX, metaY + 10.5);
  doc.text(`: ${invoiceDate}`, rightColX + 24, metaY + 10.5);

  doc.text('Jatuh Tempo', rightColX, metaY + 15);
  doc.text(`: ${formattedDueDate}`, rightColX + 24, metaY + 15);

  doc.text('Event Terkait', rightColX, metaY + 19.5);
  const truncatedEvent = resolvedEvent.length > 22 ? resolvedEvent.substring(0, 20) + '...' : resolvedEvent;
  doc.text(`: ${truncatedEvent}`, rightColX + 24, metaY + 19.5);

  // -------------------------------------------------------------------------
  // 4. TABEL RINCIAN TAGIHAN (AUTO-TABLE)
  // -------------------------------------------------------------------------
  const tableData = [
    [
      `Pembayaran: ${resolvedPaymentTerm}\nPaket Kerjasama Sponsorship - ${sponsorCategory}\nEvent: ${resolvedEvent}\nBenefit: ${resolvedBenefit}`,
      '1 Paket',
      formatRupiah(billedAmount),
      formatRupiah(billedAmount)
    ]
  ];

  const autoTableFn = typeof doc.autoTable === 'function' ? doc.autoTable.bind(doc) : (opts) => autoTable(doc, opts);

  autoTableFn({
    startY: metaY + 27,
    margin: { left: leftMargin, right: 14 },
    head: [['Deskripsi Layanan / Sponsorship', 'Kuantitas', 'Harga Satuan', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
      cellPadding: 3.5
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalTableY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 125;

  // -------------------------------------------------------------------------
  // 5. RINGKASAN KEUANGAN (RATA KANAN DENGAN JARAK LEBAR BEBAS TUMPUK)
  // -------------------------------------------------------------------------
  const summaryY = finalTableY + 7;
  // Geser labelX lebih ke kiri (rightMargin - 80) agar teks label dan nominal tidak tumpang tindih
  const labelX = rightMargin - 80;
  const valueX = rightMargin;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  // TOTAL KONTRAK
  doc.text('TOTAL KONTRAK :', labelX, summaryY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupiah(contractValue), valueX, summaryY, { align: 'right' });

  // SUDAH DIBAYAR (TOTAL PAID)
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('SUDAH DIBAYAR (TOTAL PAID) :', labelX, summaryY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`- ${formatRupiah(totalPaid)}`, valueX, summaryY + 5.5, { align: 'right' });

  // Garis Pembatas Total
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.line(labelX, summaryY + 8, valueX, summaryY + 8);

  // SISA TAGIHAN (BALANCE DUE)
  const isLunas = remainingBalance === 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(isLunas ? 16 : 225, isLunas ? 185 : 29, isLunas ? 129 : 72);
  doc.text('SISA TAGIHAN (BALANCE DUE) :', labelX, summaryY + 13.5);
  doc.text(isLunas ? 'LUNAS (RP 0)' : formatRupiah(remainingBalance), valueX, summaryY + 13.5, { align: 'right' });

  // -------------------------------------------------------------------------
  // 6. INSTRUKSI PEMBAYARAN & REKENING (FOOTER KIRI)
  // -------------------------------------------------------------------------
  const footerY = Math.max(summaryY + 24, 185);

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(leftMargin, footerY, 100, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('INSTRUKSI PEMBAYARAN:', leftMargin + 4, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Harap melakukan transfer ke rekening resmi berikut:', leftMargin + 4, footerY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Bank       : ${bankAccount.bankName}`, leftMargin + 4, footerY + 16.5);
  doc.text(`No. Rekening : ${bankAccount.accountNumber}`, leftMargin + 4, footerY + 21);
  doc.text(`Atas Nama  : ${bankAccount.accountName || gorName}`, leftMargin + 4, footerY + 25.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`*Cantumkan ref: ${invoiceNumber} saat transfer.`, leftMargin + 4, footerY + 30.5);

  // -------------------------------------------------------------------------
  // 7. RUANG TANDA TANGAN (FOOTER KANAN) - DENGAN NAMA PENANDATANGAN DINAMIS
  // -------------------------------------------------------------------------
  const signatureX = rightMargin - 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Hormat Kami,', signatureX, footerY + 6, { align: 'center' });
  doc.text('Manajemen Pengelola', signatureX, footerY + 10.5, { align: 'center' });

  // Nama Penandatangan (Dinamis: currentUser?.displayName || tenantProfile?.ownerName)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(signerName, signatureX, footerY + 29, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(gorName, signatureX, footerY + 33, { align: 'center' });

  // Garis Bawah di Tanda Tangan
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(signatureX - 25, footerY + 30, signatureX + 25, footerY + 30);

  // -------------------------------------------------------------------------
  // 8. TRIGGER DOWNLOAD PDF
  // -------------------------------------------------------------------------
  const safeSponsorName = (companyName || 'Sponsor').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Invoice_Sponsor_${safeSponsorName}.pdf`);
};
