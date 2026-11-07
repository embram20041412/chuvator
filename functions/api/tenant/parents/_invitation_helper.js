/**
 * Helper Module for Parent Portal WhatsApp-Only Invitations (V2.6.11 Audit Hotfix)
 * Provides strict phone validation & normalization, fail-closed tenant lookup,
 * secure action link verification, dynamic templating, and invitation status resolution.
 */

/**
 * Validate and normalize WhatsApp phone number.
 * - Rejects empty, null, or non-string inputs.
 * - Strips non-digit characters (allowing +, space, hyphens in raw input).
 * - Normalizes Indonesian numbers:
 *   - 08... -> 628...
 *   - 8...  -> 628...
 *   - +62... -> 62...
 * - Length validation (E.164 without '+'):
 *   - Total digits: 10 to 15 digits.
 *   - Indonesian mobile numbers starting with 62 must start with 628.
 * 
 * @param {string} phone
 * @returns {{ valid: boolean, normalized: string, error?: string }}
 */
export function validateAndNormalizeWhatsAppNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp wajib diisi.' };
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp wajib diisi.' };
  }

  // Reject input with invalid characters
  if (/[^0-9+\s\-()]/.test(trimmed)) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp hanya boleh memuat angka dan karakter telepon.' };
  }

  let cleaned = trimmed.replace(/\D/g, '');
  if (!cleaned) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp wajib memuat digit angka.' };
  }

  // Normalize Indonesian prefixes
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  // Length check: E.164 specifies max 15 digits, min 10 digits
  if (cleaned.length < 10) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp terlalu pendek (minimal 10 digit).' };
  }
  if (cleaned.length > 15) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp terlalu panjang (maksimal 15 digit).' };
  }

  // Indonesian mobile numbers check (must start with 628)
  if (cleaned.startsWith('62') && !cleaned.startsWith('628')) {
    return { valid: false, normalized: '', error: 'Nomor WhatsApp Indonesia harus berupa nomor seluler (contoh: 08123456789).' };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Normalize phone number to WhatsApp international format (E.164 without '+').
 * Returns empty string if invalid.
 * 
 * @param {string} phone
 * @returns {string}
 */
export function normalizeWhatsAppNumber(phone) {
  const result = validateAndNormalizeWhatsAppNumber(phone);
  return result.valid ? result.normalized : '';
}

/**
 * Dynamic WhatsApp message template for Parent Portal invitation.
 * STRICT TEMPLATE (Section C):
 * - Primary identity is tenant name.
 * - Platform name is CHUVATOR.
 * - No sensitive student info or KK numbers.
 */
export function generateWhatsAppMessage({ parentName, tenantName, actionLink }) {
  const pName = (parentName || 'Orang Tua / Wali').trim();
  const tName = (tenantName || '').trim();
  const link = (actionLink || '').trim();

  return `Assalamu'alaikum Bapak/Ibu ${pName},

Kami dari ${tName} menginformasikan bahwa akun Parent Portal untuk Bapak/Ibu telah disiapkan.

Melalui Parent Portal, Bapak/Ibu dapat mengakses informasi siswa, perkembangan latihan, serta evaluasi anak yang terdaftar di ${tName}.

Untuk mengaktifkan akun, silakan klik tautan berikut:

${link}

Silakan buat password akun dan ikuti petunjuk selanjutnya.

Apabila mengalami kendala, Bapak/Ibu dapat menghubungi Admin ${tName}.

Terima kasih.

${tName}
Platform layanan: CHUVATOR`;
}

/**
 * Construct safe wa.me URL with strict UTF-8 URI encoding.
 * Throws or returns empty if phone number is not valid.
 * 
 * @param {string} phone
 * @param {string} message
 * @returns {string}
 */
export function buildWhatsAppUrl(phone, message) {
  const check = validateAndNormalizeWhatsAppNumber(phone);
  if (!check.valid) {
    throw new Error(`Nomor WhatsApp tidak valid untuk URL wa.me: ${check.error}`);
  }
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${check.normalized}?text=${encodedText}`;
}

/**
 * Validate that action link:
 * - Is valid HTTPS
 * - Origin strictly matches SUPABASE_URL origin
 * - Path is the official Supabase verification endpoint (/auth/v1/verify)
 * - Contains a valid non-empty token
 * - Has matching action type ('invite' or 'recovery') if specified
 * - Has redirect_to matching APP_URL/portal/accept-invitation if specified
 * 
 * @param {string} link
 * @param {string|{supabaseUrl: string, expectedType?: string, appUrl?: string}} options
 * @returns {boolean}
 */
export function isValidSupabaseActionLink(link, options) {
  if (!link || typeof link !== 'string') return false;

  const supabaseUrl = typeof options === 'string' ? options : options?.supabaseUrl;
  const expectedType = typeof options === 'object' ? options?.expectedType : null;
  const appUrl = typeof options === 'object' ? options?.appUrl : null;

  if (!supabaseUrl) return false;

  try {
    const url = new URL(link);
    if (url.protocol !== 'https:') return false;

    // Origin check against SUPABASE_URL
    const baseClean = supabaseUrl.replace(/\/$/, '');
    const baseOrigin = new URL(baseClean).origin;
    if (url.origin !== baseOrigin) return false;

    // Path check: must be /auth/v1/verify
    const cleanPath = url.pathname.replace(/\/$/, '');
    if (cleanPath !== '/auth/v1/verify') return false;

    // Token query parameter must exist
    const token = url.searchParams.get('token');
    if (!token || !token.trim()) return false;

    // Type query parameter check
    if (expectedType) {
      const linkType = url.searchParams.get('type');
      if (linkType !== expectedType) return false;
    }

    // Redirect_to check
    if (appUrl) {
      const redirectTo = url.searchParams.get('redirect_to');
      if (!redirectTo) return false;
      const parsedRedirect = new URL(redirectTo);
      const cleanApp = appUrl.replace(/\/$/, '');
      const expectedRedirectBase = `${new URL(cleanApp).origin}/portal/accept-invitation`;
      const actualRedirectBase = `${parsedRedirect.origin}${parsedRedirect.pathname.replace(/\/$/, '')}`;
      if (actualRedirectBase !== expectedRedirectBase) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve verified tenant name strictly from database.
 * FAIL-CLOSED: No generic fallback ("Chua Sport Academy" or client input).
 * Throws on missing tenant ID, query error, non-existent tenant, or empty name.
 * 
 * @param {string} supabaseUrl
 * @param {string} serviceRoleKey
 * @param {string} tenantId
 * @returns {Promise<string>}
 */
export async function getVerifiedTenantName(supabaseUrl, serviceRoleKey, tenantId) {
  if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
    const err = new Error('Tenant ID wajib disertakan dan tidak boleh kosong.');
    /** @type {any} */ (err).code = 'TENANT_ID_REQUIRED';
    throw err;
  }

  const cleanTenantId = tenantId.trim();
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/tenants?id=eq.${encodeURIComponent(cleanTenantId)}&select=id,name`;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });
  } catch (_) {
    const err = new Error('Gagal menghubungi database untuk verifikasi tenant.');
    /** @type {any} */ (err).code = 'TENANT_LOOKUP_FAILED';
    throw err;
  }

  if (!resp.ok) {
    const err = new Error('Gagal memverifikasi identitas tenant dari database.');
    /** @type {any} */ (err).code = 'TENANT_LOOKUP_FAILED';
    throw err;
  }

  const data = await resp.json().catch(() => []);
  if (!Array.isArray(data) || data.length === 0) {
    const err = new Error(`Tenant dengan ID '${cleanTenantId}' tidak ditemukan.`);
    /** @type {any} */ (err).code = 'TENANT_NOT_FOUND';
    throw err;
  }

  const tenantName = data[0]?.name ? String(data[0].name).trim() : '';
  if (!tenantName) {
    const err = new Error('Nama tenant di database tidak boleh kosong.');
    /** @type {any} */ (err).code = 'TENANT_NAME_EMPTY';
    throw err;
  }

  return tenantName;
}

/**
 * Determine clear invitation status according to Section D:
 * - NOT_CREATED
 * - READY_TO_SEND
 * - SENT_MANUALLY
 * - ACTIVATED
 * - EXPIRED
 * 
 * @param {Object} params
 * @param {boolean} [params.hasAuthUser=false]
 * @param {boolean} [params.isConfirmed=false]
 * @param {boolean} [params.isExpired=false]
 * @param {string|null} [params.manualSentAt=null]
 * @param {string|null} [params.invitationCreatedAt=null]
 * @param {number} [params.expirationTtlSeconds=86400]
 * @returns {'NOT_CREATED'|'READY_TO_SEND'|'SENT_MANUALLY'|'ACTIVATED'|'EXPIRED'}
 */
export function determineInvitationStatus({
  hasAuthUser = false,
  isConfirmed = false,
  isExpired = false,
  manualSentAt = null,
  invitationCreatedAt = null,
  expirationTtlSeconds = 86400
}) {
  if (isConfirmed) {
    return 'ACTIVATED';
  }

  if (!hasAuthUser) {
    return 'NOT_CREATED';
  }

  // Check TTL expiration if invitationCreatedAt (latest generatedAt) is provided
  if (invitationCreatedAt) {
    const createdTime = new Date(invitationCreatedAt).getTime();
    if (!isNaN(createdTime) && (Date.now() - createdTime) > (expirationTtlSeconds * 1000)) {
      return 'EXPIRED';
    }
  }

  if (isExpired) {
    return 'EXPIRED';
  }

  if (manualSentAt) {
    return 'SENT_MANUALLY';
  }

  return 'READY_TO_SEND';
}
