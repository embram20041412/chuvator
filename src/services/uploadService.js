/**
 * uploadService.js
 * Service utilitas untuk mengunggah file foto/dokumen menggunakan Cloudinary Unsigned Upload REST API.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Mengunggah file (gambar atau dokumen) ke Cloudinary menggunakan Unsigned Upload Preset.
 * @param {File|Blob} file - File yang akan diunggah.
 * @param {Object} [options] - Opsi tambahan (misal: folder atau tags).
 * @returns {Promise<{ secure_url: string, public_id: string, format: string, width?: number, height?: number, rawResponse: any }>}
 */
export async function uploadToCloudinary(file, options = {}) {
  if (!file) {
    throw new Error('Tidak ada file yang dipilih untuk diunggah.');
  }

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error('Konfigurasi Cloudinary belum lengkap:', { CLOUD_NAME, UPLOAD_PRESET });
    throw new Error('Konfigurasi Cloudinary (VITE_CLOUDINARY_CLOUD_NAME atau VITE_CLOUDINARY_UPLOAD_PRESET) belum tersedia di .env.');
  }

  const resourceType = options.resourceType || 'auto';
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('resource_type', 'auto');

  if (options.folder) {
    formData.append('folder', options.folder);
  }
  if (options.tags) {
    formData.append('tags', options.tags);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || `Gagal mengunggah file ke Cloudinary (${response.status})`;
      throw new Error(errorMessage);
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
    console.error('Error saat upload ke Cloudinary:', error);
    throw error;
  }
}

export default {
  uploadToCloudinary,
};
