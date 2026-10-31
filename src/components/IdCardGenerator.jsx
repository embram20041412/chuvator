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
  const photoUrl = data.photoUrl || data.photo_url || null;
  const documentId = data.id || 'N/A';
  const sport = data.sportCategory || data.sportSpecialty || data.sport_specialty || data.sport || sportCategory || 'Olahraga';
  const subInfo = isStudent
    ? (data.className ? `Kelas: ${data.className}` : (data.schoolOrigin || 'Akademi Siswa'))
    : (data.license ? `Lisensi: ${data.license}` : (data.specialty || 'Instruktur Resmi'));

  // Resolusi data tenant dari props tenantData dengan fallback
  const finalTenantName = tenantData?.name || tenantName || 'CHUA SPORT CORE';
  const finalTenantLogo = tenantData?.logoUrl || tenantData?.logo_url || tenantLogo || '';
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
      <div className="bg-white dark:bg-[#162320] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
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

        {/* Modal Body / Preview Area (Scrollable with max-h-[92vh] on parent container) */}
        <div className="flex-1 overflow-y-auto py-4 px-2 flex flex-col items-center bg-slate-50/50 dark:bg-slate-900/40">
          
          {/* KARTU ID CARD - Wajib ada shrink-0 dan h-auto agar tidak pernah terpotong */}
          <div
            ref={cardRef}
            className="w-[360px] h-auto shrink-0 bg-[#F4F5F7] rounded-[24px] shadow-2xl overflow-hidden border border-slate-300 flex flex-col mx-auto select-none"
            style={{
              fontFamily: "'Inter', sans-serif"
            }}
          >
            {/* 1. HEADER NAVY DENGAN GARIS GEOMETRIS EMAS */}
            <div className="relative bg-gradient-to-b from-[#0B1D3A] to-[#071326] pt-5 pb-4 px-5 flex flex-col items-center text-center overflow-hidden shrink-0">
              
              {/* SVG Garis Geometris Emas di Sudut Kiri & Kanan (Persis Desain Referensi) */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 360 190"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Garis Geometris Kiri */}
                <path d="M-10 35 L95 -10 L45 195 L-10 120 Z" stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.55" />
                <path d="M-10 95 L115 -10" stroke="#D4AF37" strokeWidth="1.2" strokeOpacity="0.4" />
                <path d="M-10 135 L65 195" stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.55" />
                {/* Garis Geometris Kanan */}
                <path d="M370 35 L265 -10 L315 195 L370 120 Z" stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.55" />
                <path d="M370 95 L245 -10" stroke="#D4AF37" strokeWidth="1.2" strokeOpacity="0.4" />
                <path d="M370 135 L295 195" stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.55" />
              </svg>

              {/* Logo Arena (Tanpa Kotak Putih Kaku) */}
              <div className="relative z-10 w-14 h-14 rounded-xl bg-[#0F2547]/90 border border-[#D4AF37]/40 p-1.5 shadow-lg mb-2.5 flex items-center justify-center">
                <img
                  src={finalTenantLogo || "/logo_3.png"}
                  alt="Logo Arena"
                  className="w-full h-full object-contain drop-shadow"
                  crossOrigin="anonymous"
                />
              </div>

              {/* Nama GOR dengan Gradien Emas */}
              <h2 className="relative z-10 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#DFB843] bg-clip-text text-transparent font-extrabold text-[22px] tracking-wide leading-tight">
                {finalTenantName || "Kediri Sport Arena"}
              </h2>

              {/* Alamat & Telp */}
              <p className="relative z-10 text-white text-[11.5px] leading-snug mt-1.5 max-w-[310px] font-normal">
                {finalTenantAddress || "Jalan Letjen soetoyo no 20, Kel. TAWANG, Kec. WATES, KABUPATEN KEDIRI, Prov. JAWA TIMUR"}
              </p>
              <p className="relative z-10 text-white text-[12px] font-semibold mt-0.5">
                Telp/WA : <span className="font-bold">{finalTenantPhone || "082131447972"}</span>
              </p>
            </div>

            {/* PITA PEMBATAS GRADIEN EMAS METALIK */}
            <div className="h-2.5 w-full bg-gradient-to-r from-[#B38728] via-[#FBF5B7] to-[#AA771C] shrink-0 shadow-sm" />

            {/* 2. BODY KARTU (PROFIL, TAGS, QR CODE, ID) */}
            <div className="pt-5 pb-4 px-6 flex flex-col items-center shrink-0">
              
              {/* Foto Profil dengan Cincin Gradien Emas & Badge PELATIH */}
              <div className="relative flex flex-col items-center">
                <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-[#B38728] via-[#F7E08B] to-[#C59B27] shadow-md">
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-200 flex items-center justify-center border-2 border-white">
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
                </div>

                {/* Kapsul PELATIH Menumpuk Presisi di Bawah Foto */}
                <div className="-mt-3.5 z-10 bg-gradient-to-b from-[#F9D976] via-[#E5B23A] to-[#C88A1B] text-slate-950 font-extrabold text-[12px] tracking-wider uppercase px-6 py-1 rounded-full shadow-md border border-[#FFF3B0]/60">
                  {role === 'PELATIH' ? 'PELATIH' : role}
                </div>
              </div>

              {/* Nama Pelatih */}
              <h3 className="mt-2.5 text-[#0A192F] font-extrabold text-[22px] text-center leading-tight">
                {fullName || "Aji Santoso"}
              </h3>

              {/* Baris Pill Cabang Olahraga & Instruktur/Lisensi */}
              <div className="flex items-center justify-center gap-2.5 mt-2.5 w-full">
                <span className="bg-[#DCEBFF] text-[#0D3B7A] font-bold text-[13px] px-4 py-1.5 rounded-xl shadow-xs">
                  {sport || "SepakBola"}
                </span>
                <span className="bg-[#E5E7EB] text-[#4B5563] font-medium text-[13px] px-4 py-1.5 rounded-xl shadow-xs">
                  {subInfo || (data?.license ? `Lisensi: ${data.license}` : "Instruktur Resmi")}
                </span>
              </div>

              {/* Bingkai QR Code Presisi */}
              <div className="mt-4 p-2.5 bg-white rounded-2xl border-2 border-slate-300 shadow-xs flex items-center justify-center w-36 h-36 shrink-0">
                {documentId ? (
                  <QRCode
                    value={documentId}
                    size={128}
                    level="M"
                  />
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(documentId || 'CHUA-CORE')}`}
                    crossOrigin="anonymous"
                    className="w-32 h-32 object-contain"
                    alt="QR Code"
                  />
                )}
              </div>

              {/* Baris ID Pelatih Satu Baris Tegas */}
              <p className="mt-3 font-mono text-[11px] font-bold text-slate-900 tracking-tight text-center whitespace-nowrap">
                ID: {documentId || "4af6c54b-0d82-4da9-bbc1-3f583da16c25"}
              </p>
            </div>

            {/* 3. FOOTER NAVY & GOLD */}
            <div className="bg-[#071326] px-5 py-3 flex items-center justify-between shrink-0 mt-auto">
              <div className="flex items-center gap-1.5 text-[#E5C158] font-bold text-[12px] tracking-wider">
                <svg className="w-4 h-4 text-[#E5C158]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>OFFICIAL PASS</span>
              </div>
              <span className="text-[#E5C158] font-medium text-[12px] tracking-wider">
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
