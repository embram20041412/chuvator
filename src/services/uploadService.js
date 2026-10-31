/**
 * uploadService.js
 * Service utilitas untuk mengunggah file foto/dokumen menggunakan Cloudinary Unsigned Upload REST API
 * dengan isolasi multi-tenant dan validasi ketat ukuran serta tipe MIME.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Aturan Batasan File
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/**
 * Validasi MIME type dan ukuran file sebelum dikirim ke Cloudinary
 * @param {File|Blob} file 
 */
function validateFile(file) {
  if (!file) {
    throw new Error('Tidak ada file yang dipilih untuk diunggah.');
  }

  // Jika objek berupa File atau Blob dengan properti type & size
  const mimeType = (file.type || '').toLowerCase();
  const fileSize = file.size;

  if (mimeType) {
    const isAllowedMime = ALLOWED_MIME_TYPES.some(allowed => 
      mimeType === allowed || (allowed === 'image/jpeg' && mimeType === 'image/jpg')
    );

    if (!isAllowedMime) {
      throw new Error(
        `Format file "${mimeType || 'unknown'}" tidak didukung. Format yang diizinkan hanya JPG, PNG, WEBP, dan PDF.`
      );
    }
  }

  if (typeof fileSize === 'number' && fileSize > 0) {
    if (mimeType === 'application/pdf') {
      if (fileSize > MAX_DOC_SIZE_BYTES) {
        const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
        throw new Error(`Ukuran dokumen PDF (${sizeMb}MB) melebihi batas maksimal 10MB.`);
      }
    } else {
      // Default image check (<= 5MB)
      if (fileSize > MAX_IMAGE_SIZE_BYTES) {
        const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
        throw new Error(`Ukuran file gambar (${sizeMb}MB) melebihi batas maksimal 5MB.`);
      }
    }
  }
}

/**
 * Mengunggah file (gambar atau dokumen) ke Cloudinary menggunakan Unsigned Upload Preset.
 * Mendukung isolasi folder berbasis tenant: `tenants/${tenantId}/${category}`.
 * 
 * @param {File|Blob|string} file - File yang akan diunggah (File, Blob, atau Base64 string).
 * @param {Object} [options] - Opsi tambahan:
 *   - tenantId {string}: ID tenant untuk isolasi direktori Cloudinary
 *   - category {string}: Kategori media ('coaches', 'students', 'logos', 'events', 'documents')
 *   - folder {string}: Folder kustom (opsional, jika tidak menggunakan tenantId/category)
 *   - tags {string|string[]}: Tag metadata
 *   - publicId {string}: ID publik custom
 * @returns {Promise<{ secure_url: string, public_id: string, format: string, width?: number, height?: number, resource_type: string, original_filename: string, rawResponse: any }>}
 */
export async function uploadToCloudinary(file, options = {}) {
  // 1. Validasi File Lokal
  validateFile(file);

  // 2. Validasi Environment Variables
  if (!CLOUD_NAME) {
    throw new Error('Konfigurasi Cloudinary gagal: Variabel VITE_CLOUDINARY_CLOUD_NAME belum dikonfigurasi di file .env.');
  }
  if (!UPLOAD_PRESET) {
    throw new Error('Konfigurasi Cloudinary gagal: Variabel VITE_CLOUDINARY_UPLOAD_PRESET belum dikonfigurasi di file .env.');
  }

  // 3. Bangun Struktur Folder Berbasis Tenant untuk Isolasi Media
  let targetFolder = options.folder;
  if (options.tenantId) {
    const cleanTenantId = String(options.tenantId).trim();
    const cleanCategory = String(options.category || 'general').trim().replace(/^\/+|\/+$/g, '');
    targetFolder = `tenants/${cleanTenantId}/${cleanCategory}`;
  } else if (!targetFolder) {
    targetFolder = 'tenants/shared/general';
  }

  // 4. Deteksi otomatis resource_type
  let resourceType = options.resourceType || options.resource_type;
  if (!resourceType) {
    const mimeType = (file?.type || '').toLowerCase();
    if (typeof file === 'string' && file.startsWith('data:image/')) {
      resourceType = 'image';
    } else if (mimeType.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
      resourceType = 'raw';
    } else {
      resourceType = 'auto';
    }
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  if (targetFolder) {
    formData.append('folder', targetFolder);
  }
  if (options.tags) {
    formData.append('tags', Array.isArray(options.tags) ? options.tags.join(',') : options.tags);
  }
  if (options.publicId || options.public_id) {
    formData.append('public_id', options.publicId || options.public_id);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const cloudinaryErrDetail = data?.error?.message || `HTTP Status ${response.status} (${response.statusText})`;
      console.error('[Cloudinary Server Error]:', { status: response.status, error: data?.error });
      throw new Error(`Gagal mengunggah file ke Cloudinary: ${cloudinaryErrDetail}`);
    }

    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
      resource_type: data.resource_type,
      original_filename: data.original_filename,
      rawResponse: data,
    };
  } catch (error) {
    console.error('Error pada uploadToCloudinary:', error);
    throw error;
  }
}

export default {
  uploadToCloudinary,
};
