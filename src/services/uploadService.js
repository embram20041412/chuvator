/**
 * uploadService.js
 * Service utilitas untuk mengunggah file foto/dokumen menggunakan Cloudinary Unsigned Upload REST API.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Mengunggah file (gambar atau dokumen) ke Cloudinary menggunakan Unsigned Upload Preset.
 * @param {File|Blob|string} file - File yang akan diunggah (File, Blob, atau Base64 string).
 * @param {Object} [options] - Opsi tambahan (misal: folder, resourceType, tags, publicId).
 * @returns {Promise<{ secure_url: string, public_id: string, format: string, width?: number, height?: number, resource_type: string, original_filename: string, rawResponse: any }>}
 */
export async function uploadToCloudinary(file, options = {}) {
  if (!file) {
    throw new Error('Tidak ada file yang dipilih untuk diunggah.');
  }

  // 1 & 2. Validasi Pengecekan Environment Variables
  if (!CLOUD_NAME) {
    throw new Error('Konfigurasi Cloudinary gagal: Variabel VITE_CLOUDINARY_CLOUD_NAME belum dikonfigurasi di file .env.');
  }
  if (!UPLOAD_PRESET) {
    throw new Error('Konfigurasi Cloudinary gagal: Variabel VITE_CLOUDINARY_UPLOAD_PRESET belum dikonfigurasi di file .env.');
  }

  // 3. Deteksi otomatis resource_type jika tidak dispesifikasikan secara eksplisit
  let resourceType = options.resourceType || options.resource_type;
  if (!resourceType) {
    if (typeof file === 'string' && file.startsWith('data:image/')) {
      resourceType = 'image';
    } else if (file?.type) {
      if (file.type.startsWith('image/')) {
        resourceType = 'image';
      } else if (file.type.startsWith('video/')) {
        resourceType = 'video';
      } else if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('document')) {
        resourceType = 'raw';
      } else {
        resourceType = 'auto';
      }
    } else {
      resourceType = 'auto';
    }
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  if (options.folder) {
    formData.append('folder', options.folder);
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

    // 4. Tangkap respons error dari Cloudinary secara detail jika gagal
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
