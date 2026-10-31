import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';
import { 
  X, 
  Download, 
  Loader2, 
  IdCard, 
  ShieldCheck, 
  AlertCircle
} from 'lucide-react';
import { getStudentInitials } from '../utils/helpers';

/**
 * IdCardGenerator Component
 * Generates an elegant printable & downloadable digital ID Card (Member / Staff)
 * with QR Code containing the Firestore Document ID.
 */
export default function IdCardGenerator({
  isOpen,
  onClose,
  data,
  role = 'SISWA', // 'SISWA' | 'PELATIH'
  tenantData = null,
  tenantName = '',
  tenantLogo = '',
  academyName = '',
  sportCategory = ''
}) {
  const cardRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  if (!isOpen || !data) return null;

  const isStudent = role === 'SISWA';
  const fullName = isStudent 
    ? (data.studentName || 'Nama Siswa') 
    : (data.name || 'Nama Pelatih');
  const photoUrl = data.photoUrl || null;
  const documentId = data.id || 'N/A';
  const sport = data.sportCategory || data.sportSpecialty || sportCategory || 'Olahraga';
  const subInfo = isStudent
    ? (data.className ? `Kelas: ${data.className}` : (data.schoolOrigin || 'Akademi Siswa'))
    : (data.license ? `Lisensi: ${data.license}` : (data.specialty || 'Instruktur Resmi'));

  // Resolusi data tenant dari props tenantData dengan fallback
  const finalTenantName = tenantData?.name || tenantName || 'CHUA SPORT CORE';
  const finalTenantLogo = tenantData?.logoUrl || tenantLogo || '';
  const finalTenantAddress = tenantData?.address || tenantData?.alamat || '';
  const finalTenantPhone = tenantData?.phone || tenantData?.whatsapp || tenantData?.noHp || '';

  const handleDownload = async () => {
    if (!cardRef.current || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      // Jeda sejenak untuk memastikan render gambar stabil
      await new Promise((resolve) => setTimeout(resolve, 200));

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        style: { margin: 0 }
      });

      const link = document.createElement('a');
      const safeName = fullName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      link.download = `ID_CARD_${role}_${safeName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Gagal men-generate ID card:', err);
      setDownloadError('Gagal mengunduh kartu. Silakan periksa koneksi atau coba unduh kembali.');
    } finally {
      setIsDownloading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header (Sticky) */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[#D4AF37] bg-[#0a192f] border border-[#D4AF37]/30 shadow-xs">
              <IdCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-tight">
                Generate ID Card {isStudent ? 'Siswa' : 'Pelatih'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kartu anggota digital resmi dengan QR Code terverifikasi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Preview Area (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/40">
          
          {/* THE ID CARD ELEMENT TO BE RENDERED/DOWNLOADED */}
          <div
            ref={cardRef}
            className="w-[340px] h-fit min-h-[520px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col relative border border-slate-200/90 select-none text-slate-800"
            style={{
              fontFamily: "'Inter', sans-serif"
            }}
          >
            {/* Lanyard Clip Slot Simulation */}
            <div className="w-full pt-3 pb-1 flex justify-center bg-[#0a192f]">
              <div className="w-14 h-1.5 rounded-full bg-slate-950/60 border border-white/10 shadow-inner" />
            </div>

            {/* 1. Desain Header (Navy & Emas) - Padding Vertikal Lega & Flex Layout */}
            <div className="relative pt-8 pb-24 px-4 bg-[#0a192f] text-white flex flex-col items-center justify-center text-center gap-2 border-b-2 border-[#D4AF37]">
              {/* Subtle geometric pattern lines */}
              <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="card-geo-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 0 12 L 12 0 L 24 12 L 12 24 Z" fill="none" stroke="#D4AF37" strokeWidth="0.75" />
                      <circle cx="12" cy="12" r="1.5" fill="#D4AF37" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#card-geo-pattern)" />
                </svg>
              </div>

              {/* Baris 1: Logo Tenant (h-12 w-auto object-contain tanpa terpotong) */}
              {finalTenantLogo ? (
                <img
                  src={finalTenantLogo}
                  alt={finalTenantName}
                  crossOrigin="anonymous"
                  className="h-12 w-auto object-contain mx-auto relative z-10 filter drop-shadow"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/20 text-[#D4AF37] font-black text-base flex items-center justify-center mx-auto border border-[#D4AF37]/40 relative z-10 shadow-xs">
                  {finalTenantName ? finalTenantName.charAt(0).toUpperCase() : 'C'}
                </div>
              )}

              {/* Baris 2: Nama GOR ("Kediri Sport Arena") - Warna Emas & text-xl font-bold */}
              <h4 className="text-xl font-bold leading-tight text-[#D4AF37] uppercase tracking-wide px-2 relative z-10 drop-shadow-sm">
                {finalTenantName}
              </h4>

              {/* Baris 3: Alamat & Kontak Tenant (max-w-[250px] mx-auto leading-tight text-center) */}
              <div className="flex flex-col items-center relative z-10">
                {finalTenantAddress && (
                  <p className="text-white text-xs opacity-90 max-w-[250px] mx-auto leading-tight text-center">
                    {finalTenantAddress}
                  </p>
                )}
                {finalTenantPhone && (
                  <p className="text-white text-[11px] opacity-90 font-medium text-center mt-1">
                    Telp/WA: {finalTenantPhone}
                  </p>
                )}
              </div>
            </div>

            {/* 2 & 3. Card Body: Foto Profil Overlap (-mt-16 relative z-10) serta Nama & Tag Identitas */}
            <div className="px-4 pt-0 pb-6 flex flex-col items-center text-center bg-gradient-to-b from-slate-50 via-white to-white flex-1">
              {/* Foto Profil & Badge Posisi (relative z-10 -mt-16) */}
              <div className="relative z-10 -mt-16 mb-6">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={fullName}
                    crossOrigin="anonymous"
                    className="w-28 h-28 rounded-full object-cover border-4 border-[#D4AF37] shadow-xl bg-white"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-black border-4 border-[#D4AF37] bg-[#0a192f] text-[#D4AF37] shadow-xl">
                    {getStudentInitials(fullName)}
                  </div>
                )}
                {/* Badge Posisi Overlapping Menumpuk Tepat di Bawah Tengah Foto */}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-[#D4AF37] text-black font-extrabold text-xs px-5 py-1 rounded-full shadow-md whitespace-nowrap tracking-wider uppercase border border-amber-200/50">
                  {role === 'PELATIH' ? 'PELATIH' : role}
                </span>
              </div>

              {/* 3. Nama & Tag Identitas */}
              <h3 className="text-[#0a192f] font-bold text-xl leading-snug whitespace-normal break-words text-center px-2 mt-1">
                {fullName}
              </h3>

              {/* Tag Kategori: Olahraga & Lisensi */}
              <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                <span className="px-3.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-bold shadow-2xs">
                  {sport}
                </span>
                {subInfo && (
                  <span className="px-3.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold break-words max-w-[200px] shadow-2xs">
                    {subInfo}
                  </span>
                )}
              </div>

              {/* 4. QR Code & ID Transaksi dengan Spasi Lega */}
              <div className="mt-6 pt-2 pb-2 flex flex-col items-center">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-sm">
                  <QRCode
                    value={documentId}
                    size={84}
                    level="M"
                  />
                </div>
                {/* Teks UID/ID Pelatih berukuran kecil di bawah QR Code */}
                <p className="font-mono text-[11px] text-slate-800 font-semibold mt-2 tracking-wider text-center">
                  ID: {documentId}
                </p>
              </div>
            </div>

            {/* 5. Desain Footer (Navy & Emas) - Padding Simetris py-3 */}
            <div className="bg-[#0a192f] rounded-b-2xl border-t border-[#D4AF37]/30 flex justify-between items-center px-5 py-3 select-none">
              <div className="flex items-center gap-1.5 text-[#D4AF37]">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-bold tracking-wider uppercase">
                  OFFICIAL PASS
                </span>
              </div>
              <span className="text-[#D4AF37] text-xs font-extrabold tracking-widest uppercase">
                CHUA CORE
              </span>
            </div>
          </div>

          {/* Feedback error jika download bermasalah */}
          {downloadError && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 max-w-[280px]">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{downloadError}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-500 text-center mt-3">
            Kartu berformat PNG siap cetak berkualitas tinggi.
          </p>
        </div>

        {/* Modal Actions (Sticky Footer) */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-end space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownload}
            className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-[#0a192f] hover:bg-[#122849] border-b-2 border-[#D4AF37] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Gambar...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#D4AF37]" />
                <span>Download Kartu (PNG)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
