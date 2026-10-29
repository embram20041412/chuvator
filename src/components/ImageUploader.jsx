import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { uploadToCloudinary } from '../services/uploadService';

/**
 * ImageUploader Component
 * Komponen reusable untuk mengunggah gambar/dokumen ke Cloudinary Unsigned Upload.
 * 
 * Props:
 * - value: string (URL gambar/dokumen yang sudah tersimpan)
 * - onUploadSuccess: function(secureUrl, resultData) (callback saat upload berhasil)
 * - onRemove: function() (callback saat file dihapus)
 * - label: string (label judul input)
 * - accept: string (tipe file yang diterima, default 'image/*')
 * - folder: string (opsional: folder Cloudinary)
 * - helperText: string (teks bantuan di bawah input)
 * - disabled: boolean
 */
export default function ImageUploader({
  value = '',
  onUploadSuccess,
  onRemove,
  label = 'Unggah Foto/Dokumen',
  accept = 'image/*',
  folder = 'chua_sport',
  helperText = 'Format: JPG, PNG, WEBP, atau PDF (Maks. 5MB)',
  disabled = false,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(value);
  const fileInputRef = useRef(null);

  // Sync internal preview with incoming value prop if changed
  React.useEffect(() => {
    setPreviewUrl(value);
  }, [value]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setErrorMessage(null);
    setIsUploading(true);

    // Buat object URL lokal sementara untuk preview kilat jika gambar
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);
    }

    try {
      const result = await uploadToCloudinary(file, { folder });
      setPreviewUrl(result.secure_url);
      if (onUploadSuccess) {
        onUploadSuccess(result.secure_url, result);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setErrorMessage(err.message || 'Gagal mengunggah file. Silakan coba lagi.');
      // Kembalikan ke URL sebelumnya jika gagal
      setPreviewUrl(value);
    } finally {
      setIsUploading(false);
      // Reset input agar file yang sama bisa dipilih kembali jika diinginkan
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setPreviewUrl('');
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onRemove) {
      onRemove();
    }
  };

  const handleTriggerClick = () => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const isCurrentFileImage = previewUrl && (
    previewUrl.startsWith('blob:') || 
    previewUrl.startsWith('data:image') || 
    /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(previewUrl) ||
    previewUrl.includes('/image/upload/')
  );

  return (
    <div className="space-y-2 text-left w-full">
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label}
        </label>
      )}

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {/* Area Unggah / Preview */}
      <div className="relative">
        {previewUrl ? (
          /* JIKA SUDAH ADA GAMBAR/DOKUMEN */
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            {/* Thumbnail Mini */}
            <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 border border-slate-300/80 shadow-2xs relative">
              {isCurrentFileImage ? (
                <img
                  src={previewUrl}
                  alt="Thumbnail Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <span className="text-[9px] font-bold uppercase mt-0.5">Dokumen</span>
                </div>
              )}

              {/* Overlay saat sedang mengunggah ulang */}
              {isUploading && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Info & Tombol Aksi */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800 truncate">
                  {isUploading ? 'Sedang mengunggah...' : 'File Tersedia'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate font-mono">
                {previewUrl.startsWith('blob:') ? 'File lokal terpilih' : previewUrl}
              </p>

              {/* Tombol Ganti & Hapus */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleTriggerClick}
                  disabled={disabled || isUploading}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Ganti File</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled || isUploading}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* JIKA BELUM ADA GAMBAR: DROPZONE / TOMBOL UNGGAH */
          <div
            onClick={handleTriggerClick}
            className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
              isUploading
                ? 'bg-blue-50/50 border-blue-300'
                : 'bg-slate-50/60 hover:bg-white border-slate-200 hover:border-blue-400'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                <span className="text-xs font-bold text-blue-700">
                  Sedang mengunggah ke Cloudinary...
                </span>
                <span className="text-[11px] text-slate-400">Mohon tunggu sebentar</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Klik untuk memilih foto atau dokumen
                  </p>
                  {helperText && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {helperText}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pesan Kesalahan */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
