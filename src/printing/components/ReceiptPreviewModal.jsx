import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Download,
  X,
  FileText,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  DOC_TYPES,
  getAvailablePapersForDocType,
  resolvePaperSpec
} from '../types/printTypes.js';
import {
  formatRupiah,
  formatThermalTextLines,
  normalizePrintDocument
} from '../templates/ReceiptTemplateEngine.js';
import { defaultPrintEngine } from '../core/PrintEngine.js';

/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: ReceiptPreviewModal
 *
 * Responsive Desktop & Mobile preview modal supporting:
 * - Document preview (Thermal 58mm/80mm, Official Receipt A5, B2B Invoice A4, Financial Report A4)
 * - Dynamic paper size selection (32 columns for 58mm, 48 columns for 80mm, A5/A4 Portrait & Landscape)
 * - Isolated Browser/System Print execution
 * - Read-only PDF generation & download
 */
export default function ReceiptPreviewModal({
  isOpen,
  onClose,
  documentData,
  tenantProfile = null,
  userProfile = null,
  initialPaper = null,
  printEngine = defaultPrintEngine,
  onPrintComplete = null,
  onPdfDownloaded = null
}) {
  // All React Hooks declared unconditionally at the top level
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  const baseDoc = useMemo(() => {
    if (!documentData) return null;
    return normalizePrintDocument(documentData, {
      tenantProfile: tenantProfile || userProfile?.tenant || null,
      userProfile,
      paper: initialPaper || documentData?.paper
    });
  }, [documentData, tenantProfile, userProfile, initialPaper]);

  const availablePapers = useMemo(() => {
    if (!baseDoc) return [];
    return getAvailablePapersForDocType(baseDoc.docType);
  }, [baseDoc]);

  useEffect(() => {
    if (isOpen && baseDoc) {
      setSelectedPaperId(baseDoc.paper?.id || availablePapers[0]?.id || 'THERMAL_80MM');
      setFeedbackBanner(null);
    }
  }, [isOpen, baseDoc, availablePapers]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeDoc = useMemo(() => {
    if (!baseDoc) return null;
    const paperSpec = resolvePaperSpec(selectedPaperId || baseDoc.paper, baseDoc.docType);
    return {
      ...baseDoc,
      paper: paperSpec
    };
  }, [baseDoc, selectedPaperId]);

  const thermalTextLines = useMemo(() => {
    if (!activeDoc || activeDoc.paper.category !== 'thermal') return [];
    return formatThermalTextLines(activeDoc, activeDoc.paper.columns);
  }, [activeDoc]);

  // Safe conditional return strictly after all hooks
  if (!isOpen || !activeDoc) return null;

  const isThermalView = activeDoc.paper.category === 'thermal';
  const { tenantIdentity, meta, items, summary, paper, renderOptions } = activeDoc;

  const handleBrowserPrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setFeedbackBanner(null);

    try {
      const result = await printEngine.printDocument(activeDoc, {
        paper: activeDoc.paper,
        tenantProfile: tenantProfile || userProfile?.tenant || null,
        userProfile
      });

      setFeedbackBanner({
        type: result.ok ? 'info' : 'error',
        message: result.message
      });

      if (onPrintComplete) {
        onPrintComplete(result);
      }
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        message: err?.message || 'Gagal membuka dialog cetak sistem.'
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    setFeedbackBanner(null);

    try {
      const result = await printEngine.downloadPDF(activeDoc, {
        paper: activeDoc.paper,
        tenantProfile: tenantProfile || userProfile?.tenant || null,
        userProfile
      });

      setFeedbackBanner({
        type: 'success',
        message: `File PDF "${result.filename}" berhasil dibuat dan diunduh.`
      });

      if (onPdfDownloaded) {
        onPdfDownloaded(result);
      }
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        message: err?.message || 'Gagal membuat dokumen PDF.'
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const modalMarkup = (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-0 sm:my-auto">
        
        {/* Mobile Handle Bar */}
        <div className="pt-2.5 pb-1 flex sm:hidden justify-center shrink-0">
          <div className="w-11 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#354944] text-[#C89D32] flex items-center justify-center shrink-0 border border-[#C89D32]/30 shadow-2xs">
              {isThermalView ? <Receipt className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                Pratinjau Dokumen Cetak
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                No: <span className="font-mono font-bold">{meta.receiptNo}</span> &bull; {paper.label}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Tutup Pratinjau"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Size Selector Toolbar */}
        <div className="px-5 py-2.5 bg-slate-100/80 dark:bg-slate-900/90 border-b border-slate-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Ukuran &amp; Format Kertas:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {availablePapers.map((preset) => {
              const isSelected = preset.id === paper.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPaperId(preset.id);
                    setFeedbackBanner(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Honest Status Banner */}
        {feedbackBanner && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl border text-xs flex items-start gap-2 shrink-0 ${
              feedbackBanner.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : feedbackBanner.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}
          >
            {feedbackBanner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{feedbackBanner.message}</span>
          </div>
        )}

        {/* Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/60 flex justify-center">
          {isThermalView ? (
            /* Thermal 58mm (32-col) / 80mm (48-col) Preview */
            <div
              className={`bg-white text-slate-950 font-mono shadow-md border border-slate-300 rounded-lg p-4 select-none h-fit ${
                paper.id === 'THERMAL_58MM'
                  ? 'w-[240px] text-[10.5px]'
                  : 'w-[320px] text-[11px]'
              }`}
            >
              {renderOptions.showLogo && tenantIdentity.logoUrl && (
                <div className="flex justify-center mb-2">
                  <img
                    src={tenantIdentity.logoUrl}
                    alt="Logo Tenant"
                    className="max-h-12 max-w-[110px] object-contain"
                  />
                </div>
              )}
              <pre className="font-mono whitespace-pre overflow-x-auto leading-snug m-0">
                {thermalTextLines.join('\n')}
              </pre>
            </div>
          ) : (
            /* Sheet Preview (A5 / A4) */
            <div className="bg-white text-slate-900 w-full max-w-xl rounded-xl shadow-md border border-slate-300 p-5 sm:p-6 space-y-4 h-fit text-xs">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 gap-4">
                <div>
                  {tenantIdentity.headerName && (
                    <h4 className="font-black text-sm sm:text-base uppercase text-slate-900">
                      {tenantIdentity.headerName}
                    </h4>
                  )}
                  {tenantIdentity.address && (
                    <p className="text-[11px] text-slate-600 mt-0.5">{tenantIdentity.address}</p>
                  )}
                  {tenantIdentity.contact && (
                    <p className="text-[11px] text-slate-600">{tenantIdentity.contact}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-black text-sm sm:text-base text-[#354944] block uppercase">
                    {activeDoc.docType === DOC_TYPES.B2B_INVOICE_A4
                      ? 'INVOICE B2B'
                      : activeDoc.docType === DOC_TYPES.FINANCIAL_REPORT_A4
                      ? 'LAPORAN KEUANGAN'
                      : 'KWITANSI RESMI'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {paper.label}
                  </span>
                  {meta.isReprint && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold text-[9px] rounded">
                      CETAK ULANG (COPY)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    {activeDoc.docType === DOC_TYPES.FINANCIAL_REPORT_A4 ? 'Periode Laporan' : 'Pelanggan / Pihak Terkait'}
                  </span>
                  <span className="font-bold text-slate-900">
                    {activeDoc.docType === DOC_TYPES.FINANCIAL_REPORT_A4
                      ? meta.periodLabel || 'Periode Aktif'
                      : meta.customerName || '-'}
                  </span>
                  {meta.customerSubInfo && (
                    <span className="block text-slate-600 text-[10px]">{meta.customerSubInfo}</span>
                  )}
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Rincian Dokumen</span>
                  <span className="font-mono font-bold text-slate-900 block">No: {meta.receiptNo}</span>
                  <span className="text-slate-600 block">Tanggal: {meta.date}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-2">Deskripsi</th>
                      <th className="p-2 text-center">Qty / Status</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          {item.description && (
                            <div className="text-[10px] text-slate-500">{item.description}</div>
                          )}
                        </td>
                        <td className="p-2 text-center font-mono">
                          {activeDoc.docType === DOC_TYPES.FINANCIAL_REPORT_A4
                            ? item.status
                            : item.unitLabel || `${item.qty || 1}x`}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatRupiah(
                            activeDoc.docType === DOC_TYPES.FINANCIAL_REPORT_A4
                              ? item.amount
                              : item.subtotal
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Bank Info */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2 border-t border-slate-200">
                <div className="space-y-1 text-[10px] text-slate-600 flex-1">
                  {renderOptions.showBankAccounts && tenantIdentity.bankAccounts.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-800 uppercase block">Rekening Resmi Tenant:</span>
                      {tenantIdentity.bankAccounts.map((acc, i) => (
                        <div key={i} className="font-mono">
                          {acc.bankName}: {acc.accountNumber} (a.n. {acc.accountName})
                        </div>
                      ))}
                    </div>
                  )}
                  {tenantIdentity.footerNote && (
                    <div className="italic text-slate-500 pt-1">{tenantIdentity.footerNote}</div>
                  )}
                </div>

                <div className="sm:w-56 space-y-1 text-right">
                  <div className="flex justify-between font-black text-sm text-slate-900">
                    <span>TOTAL:</span>
                    <span className="font-mono">{formatRupiah(summary.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Metode:</span>
                    <span className="font-bold">{summary.paymentMethod}</span>
                  </div>
                  {renderOptions.showCashBreakdown && (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Dibayar:</span>
                        <span className="font-mono">{formatRupiah(summary.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-emerald-700">
                        <span>Kembalian:</span>
                        <span className="font-mono">{formatRupiah(summary.changeAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-[#162320] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-[#354944] dark:text-[#C89D32]" />
              )}
              <span>Unduh PDF</span>
            </button>

            <button
              type="button"
              disabled={isPrinting}
              onClick={handleBrowserPrint}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 text-[#F4D068]" />
              )}
              <span>Cetak (Browser/System)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalMarkup, document.body) : modalMarkup;
}
