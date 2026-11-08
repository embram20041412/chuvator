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
 * Generate cryptographically secure claim token with minimum 256 bits of entropy.
 * Returns 64-character lowercase hex string.
 * 
 * @returns {string}
 */
export function generateClaimToken() {
  const bytes = new Uint8Array(32); // 32 bytes = 256 bits of entropy
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error('Crypto getRandomValues is not available in this environment.');
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Construct intermediary invitation claim URL (CHUVATOR owned, non-Supabase).
 * 
 * @param {string} appUrl
 * @param {string} claimToken
 * @returns {string}
 */
export function buildIntermediaryClaimUrl(appUrl, claimToken) {
  const cleanApp = (appUrl || 'https://chuvator.pages.dev').replace(/\/$/, '');
  return `${cleanApp}/portal/claim?token=${encodeURIComponent(claimToken)}`;
}

/**
 * Validate action link and return detailed diagnostic reason.
 * 
 * Reason codes:
 * - ACTION_LINK_MISSING
 * - ACTION_LINK_INVALID_URL
 * - ACTION_LINK_INVALID_SCHEME
 * - ACTION_LINK_WRONG_ORIGIN
 * - ACTION_LINK_WRONG_PATH
 * - ACTION_LINK_TOKEN_MISSING
 * - ACTION_LINK_WRONG_TYPE
 * - ACTION_LINK_REDIRECT_MISSING
 * - ACTION_LINK_REDIRECT_INVALID
 * - ACTION_LINK_REDIRECT_MISMATCH
 * - ACTION_LINK_VALID
 * 
 * @param {string|{supabaseUrl?: string|null, expectedType?: string, appUrl?: string}} [options]
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateSupabaseActionLink(link, options) {
  if (!link || typeof link !== 'string' || !link.trim()) {
    return { valid: false, reason: 'ACTION_LINK_MISSING' };
  }

  const supabaseUrl = typeof options === 'string' ? options : options?.supabaseUrl;
  const expectedType = typeof options === 'object' ? options?.expectedType : null;
  const appUrl = typeof options === 'object' ? options?.appUrl : null;

  let url;
  try {
    url = new URL(link);
  } catch {
    return { valid: false, reason: 'ACTION_LINK_INVALID_URL' };
  }

  // 1. HTTPS Scheme check
  if (url.protocol !== 'https:') {
    return { valid: false, reason: 'ACTION_LINK_INVALID_SCHEME' };
  }

  // 2. Origin check against SUPABASE_URL (Fail-closed: supabaseUrl must be provided and valid)
  if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) {
    return { valid: false, reason: 'ACTION_LINK_WRONG_ORIGIN' };
  }

  try {
    const baseClean = supabaseUrl.trim().replace(/\/$/, '');
    const baseOrigin = new URL(baseClean).origin;
    if (url.origin !== baseOrigin) {
      return { valid: false, reason: 'ACTION_LINK_WRONG_ORIGIN' };
    }
  } catch {
    return { valid: false, reason: 'ACTION_LINK_WRONG_ORIGIN' };
  }

  // 3. Path check: must be /auth/v1/verify
  const cleanPath = url.pathname.replace(/\/$/, '');
  if (cleanPath !== '/auth/v1/verify') {
    return { valid: false, reason: 'ACTION_LINK_WRONG_PATH' };
  }

  // 4. Token query parameter must exist
  const token = url.searchParams.get('token');
  if (!token || !token.trim()) {
    return { valid: false, reason: 'ACTION_LINK_TOKEN_MISSING' };
  }

  // 5. Type query parameter check
  if (expectedType) {
    const linkType = url.searchParams.get('type');
    if (linkType !== expectedType) {
      return { valid: false, reason: 'ACTION_LINK_WRONG_TYPE' };
    }
  }

  // 6. Redirect_to check
  if (appUrl) {
    const redirectTo = url.searchParams.get('redirect_to');
    if (!redirectTo || !redirectTo.trim()) {
      return { valid: false, reason: 'ACTION_LINK_REDIRECT_MISSING' };
    }

    let parsedRedirect;
    try {
      parsedRedirect = new URL(redirectTo);
    } catch {
      return { valid: false, reason: 'ACTION_LINK_REDIRECT_INVALID' };
    }

    try {
      const cleanApp = appUrl.replace(/\/$/, '');
      const expectedRedirectBase = `${new URL(cleanApp).origin}/portal/accept-invitation`;
      const actualRedirectBase = `${parsedRedirect.origin}${parsedRedirect.pathname.replace(/\/$/, '')}`;
      if (actualRedirectBase !== expectedRedirectBase) {
        return { valid: false, reason: 'ACTION_LINK_REDIRECT_MISMATCH' };
      }
    } catch {
      return { valid: false, reason: 'ACTION_LINK_REDIRECT_MISMATCH' };
    }
  }

  return { valid: true, reason: 'ACTION_LINK_VALID' };
}

/**
 * Validate that action link is an authentic HTTPS link from the configured Supabase project.
 * Backward-compatible wrapper over validateSupabaseActionLink.
 * 
 * @param {string} link
 * @param {string|{supabaseUrl?: string|null, expectedType?: string, appUrl?: string}} [options]
 * @returns {boolean}
 */
export function isValidSupabaseActionLink(link, options) {
  return validateSupabaseActionLink(link, options).valid;
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

/**
 * Invoke V3.3 RPC create_parent_invitation
 */
export async function invokeCreateParentInvitation(supabaseUrl, serviceRoleKey, {
  tenantId,
  actorUid,
  parentEmail,
  targetStudentId,
  relationship = 'guardian',
  expiryDays = 7
}) {
  const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/create_parent_invitation`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      p_tenant_id: tenantId,
      p_actor_uid: actorUid,
      p_parent_email: parentEmail,
      p_target_student_id: targetStudentId,
      p_relationship: relationship,
      p_expiry_days: expiryDays
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`RPC create_parent_invitation gagal (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Invoke V3.3 RPC get_parent_invitation_info
 */
export async function invokeGetParentInvitationInfo(supabaseUrl, serviceRoleKey, rawToken) {
  const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_parent_invitation_info`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      p_raw_invitation_token: rawToken
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`RPC get_parent_invitation_info gagal (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Invoke V3.3 RPC create_parent_continuation_ticket
 */
export async function invokeCreateContinuationTicket(supabaseUrl, serviceRoleKey, {
  rawInvitationToken,
  tenantId,
  authUid
}) {
  const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/create_parent_continuation_ticket`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      p_raw_invitation_token: rawInvitationToken,
      p_tenant_id: tenantId,
      p_auth_uid: authUid
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`RPC create_parent_continuation_ticket gagal (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Invoke V3.3 RPC claim_parent_invitation_by_ticket
 */
export async function invokeClaimParentInvitationByTicket(supabaseUrl, serviceRoleKey, {
  rawTicketToken,
  authUid
}) {
  const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/claim_parent_invitation_by_ticket`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      p_raw_ticket_token: rawTicketToken,
      p_auth_uid: authUid
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`RPC claim_parent_invitation_by_ticket gagal (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Invoke V3.3 RPC revoke_parent_invitation
 */
export async function invokeRevokeParentInvitation(supabaseUrl, serviceRoleKey, {
  tenantId,
  actorUid,
  invitationIdOrToken,
  reason = null
}) {
  const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/revoke_parent_invitation`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      p_tenant_id: tenantId,
      p_actor_uid: actorUid,
      p_invitation_id_or_token: invitationIdOrToken,
      p_reason: reason
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`RPC revoke_parent_invitation gagal (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Invoke V3.3 RPC recover_parent_session
 */
export async function invokeRecoverParentSession(supabaseUrl, serviceRoleKey, {
  authUid,
  tenantId
}) {
  const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/recover_parent_session`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      p_auth_uid: authUid,
      p_tenant_id: tenantId
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`RPC recover_parent_session gagal (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data[0] : data;
}

