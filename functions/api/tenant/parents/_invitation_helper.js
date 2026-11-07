/**
 * Helper Module for Parent Portal WhatsApp-Only Invitations (V2.6.11 Migration)
 * Provides phone normalization, dynamic message templating, link verification,
 * and invitation status resolution.
 */

/**
 * Normalize phone number to WhatsApp international format (E.164 without '+').
 * Primary target: Indonesian numbers (08... -> 628...).
 */
export function normalizeWhatsAppNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('0')) {
    return '62' + cleaned.slice(1);
  }
  if (cleaned.startsWith('8')) {
    return '62' + cleaned;
  }
  return cleaned;
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
  const tName = (tenantName || 'Akademi').trim();
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
 */
export function buildWhatsAppUrl(phone, message) {
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  const encodedText = encodeURIComponent(message);
  if (normalizedPhone) {
    return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Validate that action link is an authentic HTTPS link from the configured Supabase project.
 */
export function isValidSupabaseActionLink(link, supabaseUrl) {
  if (!link || typeof link !== 'string') return false;
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:') return false;
    const baseClean = supabaseUrl.replace(/\/$/, '');
    const urlOrigin = url.origin;
    const baseOrigin = new URL(baseClean).origin;
    return urlOrigin === baseOrigin;
  } catch {
    return false;
  }
}

/**
 * Resolve tenant name from database to prevent client-supplied tampering.
 */
export async function getVerifiedTenantName(supabaseUrl, serviceRoleKey, tenantId) {
  if (!tenantId || tenantId === 'global') {
    return 'Chua Sport Academy';
  }

  try {
    const url = `${supabaseUrl}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}&select=name`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => []);
      if (Array.isArray(data) && data.length > 0 && data[0].name) {
        return data[0].name.trim();
      }
    }
  } catch (_) {
    // Fail safe to default name
  }

  return 'Chua Sport Academy';
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

  // Check TTL expiration if createdAt is provided
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
