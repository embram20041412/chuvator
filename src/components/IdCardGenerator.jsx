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

        {/* Modal Body / Preview Area (Scrollable with max-h-[90vh] on parent) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center bg-slate-50/50 dark:bg-slate-900/40 min-h-0">
          
          {/* CONTAINER UTAMA ID CARD - Lebar terkunci 340px, tinggi OTOMATIS (h-auto), tanpa max-height yang memotong konten */}
          <div
            ref={cardRef}
            className="w-[340px] h-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col mx-auto my-auto select-none"
            style={{
              fontFamily: "'Inter', sans-serif"
            }}
          >
            {/* 1. BAGIAN HEADER (NAVY & GOLD) */}
            <div className="relative bg-[#0A192F] pt-6 pb-6 px-5 flex flex-col items-center text-center border-b-4 border-[#D4AF37]">
              {/* Aksen Lengkung/Geometris Halus di Background Header */}
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:16px_16px]" />

              {/* Lubang Lanyard Simulasi */}
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mb-4 border border-slate-700 z-10" />

              {/* Logo Arena / Akademi */}
              <div className="w-14 h-14 rounded-xl bg-white p-1.5 shadow-md mb-3 flex items-center justify-center z-10">
                <img
                  src={finalTenantLogo || "/logo_3.png"}
                  alt="Logo Arena"
                  className="w-full h-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>

              {/* Nama GOR */}
              <h2 className="text-[#D4AF37] font-extrabold text-lg tracking-wider uppercase leading-snug z-10">
                {finalTenantName || "KEDIRI SPORT ARENA"}
              </h2>

              {/* Alamat & Kontak GOR */}
              <p className="text-slate-200 text-[11px] leading-relaxed mt-1 max-w-[280px] font-normal z-10">
                {finalTenantAddress || "Jalan Letjen Soetoyo No. 20, Kel. Tawang, Kec. Wates, Kab. Kediri, Jawa Timur"}
              </p>
              <p className="text-white text-[11px] font-semibold mt-1 z-10">
                Telp/WA: {finalTenantPhone || "082131447972"}
              </p>
            </div>

            {/* 2. BAGIAN BODY (PUTIH BERSIH - TANPA TABRAKAN) */}
            <div className="bg-gradient-to-b from-slate-50 to-white pt-6 pb-6 px-6 flex flex-col items-center">
              
              {/* Foto Profil & Badge PELATIH */}
              <div className="relative flex flex-col items-center">
                <div className="w-28 h-28 rounded-full border-4 border-[#D4AF37] shadow-lg overflow-hidden bg-slate-200 flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={fullName}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-slate-500">
                      {fullName?.charAt(0) || "P"}
                    </span>
                  )}
                </div>
                {/* Badge PELATIH tepat di bawah batas lingkaran foto */}
                <span className="-mt-3.5 bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-extrabold text-[11px] tracking-widest uppercase px-4 py-1 rounded-full shadow-md border border-white">
                  {role === 'PELATIH' ? 'PELATIH' : role}
                </span>
              </div>

              {/* Nama Lengkap Pelatih */}
              <h3 className="mt-3 text-[#0A192F] font-extrabold text-xl text-center leading-tight">
                {fullName || "Nama Pelatih"}
              </h3>

              {/* Tag Cabang Olahraga & Lisensi */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
                <span className="bg-blue-100 text-blue-900 font-bold text-xs px-3 py-1 rounded-full">
                  {sport || "SepakBola"}
                </span>
                <span className="bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-1 rounded-full">
                  {subInfo || (data?.license ? `Lisensi: ${data.license}` : "Instruktur Resmi")}
                </span>
              </div>

              {/* Kotak QR Code */}
              <div className="mt-5 p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                <QRCode
                  value={documentId}
                  size={110}
                  level="M"
                />
              </div>

              {/* Teks ID Pelatih */}
              <p className="mt-2.5 font-mono text-[10px] font-semibold text-slate-600 tracking-tight text-center break-all px-2">
                ID: {documentId || "N/A"}
              </p>
            </div>

            {/* 3. BAGIAN FOOTER (NAVY & GOLD) */}
            <div className="bg-[#0A192F] px-5 py-3.5 flex items-center justify-between border-t border-slate-800 mt-auto">
              <div className="flex items-center gap-1.5 text-[#D4AF37] font-bold text-xs tracking-wider">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>OFFICIAL PASS</span>
              </div>
              <span className="text-[#D4AF37] font-bold text-xs tracking-wider">
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
