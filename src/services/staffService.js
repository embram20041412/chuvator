import { supabase } from '../config/supabase.js';

/**
 * Normalisasi peran staf ke nilai kanonis database.
 * Kanonis: 'admin', 'kasir', 'coach', 'staff'
 */
export function normalizeStaffRole(role) {
  const r = String(role || 'kasir').toLowerCase().trim();
  if (r === 'pelatih' || r === 'coach') return 'coach';
  if (r === 'administrator' || r === 'admin') return 'admin';
  if (r === 'cashier' || r === 'kasir') return 'kasir';
  if (r === 'staf' || r === 'staff') return 'staff';
  return 'kasir';
}

/**
 * Membuat tautan undangan lengkap dari raw token.
 */
export function buildInvitationUrl(rawToken) {
  const origin = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://chuvator.pages.dev';
  return `${origin}/accept-invitation?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Format durasi dan tanggal kedaluwarsa undangan secara dinamis dari `expires_at` database.
 * TIDAK meng-hardcode durasi statis (seperti '24 jam' atau '7 hari').
 */
export function formatInvitationExpiry(expiresAt, createdAt) {
  if (!expiresAt) return '-';
  const expDate = new Date(expiresAt);
  if (isNaN(expDate.getTime())) return '-';

  const refDate = createdAt ? new Date(createdAt) : new Date();
  const diffMs = expDate.getTime() - refDate.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffHours / 24);

  let durationText = '';
  if (diffHours > 0) {
    if (diffHours % 24 === 0 || diffDays >= 1) {
      durationText = `${diffDays} Hari`;
    } else {
      durationText = `${diffHours} Jam`;
    }
  }

  const formattedDate = expDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return durationText ? `${durationText} (s.d. ${formattedDate})` : `s.d. ${formattedDate}`;
}

/**
 * Membuat undangan staf baru melalui RPC database resmi:
 * 1. Menyiapkan record calon staf aktif di `users_staff` dengan `uid = NULL`.
 * 2. Memanggil RPC `create_staff_invitation(target_tenant_id, invite_email, invite_role)`.
 * 3. Menghasilkan raw_token dan shareable invitation URL.
 */
export async function createStaffInvitation({ tenantId, email, role, fullName, displayName, name }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanFullName = String(fullName || displayName || name || '').trim();
  const canonicalRole = normalizeStaffRole(role);

  if (!cleanEmail || !tenantId) {
    throw new Error('Email staf dan ID Tenant wajib diisi.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Format email undangan staf tidak valid.');
  }

  // 1. D1: Pre-check apakah sudah ada undangan PENDING/AKTIF untuk tenant_id & email ini
  const { data: existingInvites, error: inviteCheckErr } = await supabase
    .from('invitations')
    .select('id, status, expires_at')
    .eq('tenant_id', String(tenantId))
    .or(`invite_email.ilike.${cleanEmail},email.ilike.${cleanEmail}`)
    .eq('status', 'pending');

  if (!inviteCheckErr && existingInvites && existingInvites.length > 0) {
    const hasActiveUnexpired = existingInvites.some(
      (inv) => !inv.expires_at || new Date(inv.expires_at) > new Date()
    );
    if (hasActiveUnexpired) {
      const err = new Error(`Undangan aktif untuk email ${cleanEmail} sudah tersedia. Silakan cek tab Undangan Staff atau batalkan undangan lama jika ingin menerbitkan yang baru.`);
      err.code = 'INVITATION_ALREADY_EXISTS';
      throw err;
    }
  }

  // 2. D2: Pre-check apakah staf dengan email ini sudah terdaftar dan terikat Auth UID aktif
  const { data: existingStaff, error: fetchErr } = await supabase
    .from('users_staff')
    .select('id, uid, is_active, status, role')
    .eq('tenant_id', String(tenantId))
    .ilike('email', cleanEmail);

  if (fetchErr) {
    console.warn('[staffService] Pre-fetch candidate check warning:', fetchErr.message);
  }

  const boundStaff = (existingStaff || []).find((s) => Boolean(s.uid));
  if (boundStaff) {
    const err = new Error(`Staf dengan email ${cleanEmail} sudah terdaftar dan aktif di cabang ini.`);
    err.code = 'STAFF_ALREADY_BOUND';
    throw err;
  }

  // 3. D3: Jika calon belum ada sama sekali, buat record kandidat baru di `users_staff` dan catat ID-nya untuk rollback jika RPC gagal
  let createdCandidateId = null;
  const matchingUnbound = (existingStaff || []).find(
    (c) => !c.uid && (c.role === canonicalRole || normalizeStaffRole(c.role) === canonicalRole)
  );

  if (!matchingUnbound) {
    const candidateRecord = {
      tenant_id: String(tenantId),
      email: cleanEmail,
      name: cleanFullName || cleanEmail.split('@')[0],
      display_name: cleanFullName || cleanEmail.split('@')[0],
      role: canonicalRole,
      status: 'active',
      is_active: true,
      uid: null, // PENTING: Wajib NULL sampai diklaim via claim_staff_invitation
      created_at: new Date().toISOString(),
    };

    const { data: insertedData, error: insertErr } = await supabase
      .from('users_staff')
      .insert([candidateRecord])
      .select('id')
      .maybeSingle();

    if (insertErr) {
      console.warn('[staffService] Candidate insert warning (will proceed to RPC):', insertErr.message);
    } else if (insertedData?.id) {
      createdCandidateId = insertedData.id;
    }
  }

  // 4. D4: Panggil RPC resmi database create_staff_invitation
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_staff_invitation', {
    target_tenant_id: String(tenantId),
    invite_email: cleanEmail,
    invite_role: canonicalRole,
  });

  if (rpcErr) {
    console.error('[staffService] create_staff_invitation RPC error:', rpcErr);

    // D5: Jika RPC gagal setelah kandidat baru dibuat oleh proses ini, lakukan cleanup kandidat yatim
    if (createdCandidateId) {
      console.info('[staffService] Rolling back orphan candidate record ID:', createdCandidateId);
      try {
        await supabase
          .from('users_staff')
          .delete()
          .eq('id', createdCandidateId)
          .is('uid', null);
      } catch (cleanupErr) {
        console.warn('[staffService] Failed to cleanup orphan candidate:', cleanupErr);
      }
    }

    if (rpcErr.message?.includes('Undangan aktif untuk email ini sudah tersedia')) {
      throw new Error(`Undangan aktif untuk email ${cleanEmail} sudah tersedia. Silakan cek tab Undangan Staff.`);
    }

    throw new Error(rpcErr.message || 'Gagal membuat undangan staf di database.');
  }

  // 5. Tangani respons RPC (RETURNS JSONB)
  let rpcData = rpcResult;
  if (typeof rpcData === 'string') {
    try {
      rpcData = JSON.parse(rpcData);
    } catch (_) {}
  }
  if (Array.isArray(rpcData)) {
    rpcData = rpcData[0] || {};
  }
  if (!rpcData || typeof rpcData !== 'object') {
    rpcData = {};
  }

  const rawToken = rpcData.raw_token || rpcData.rawToken || rpcData.token;
  const invitationId = rpcData.invitation_id || rpcData.id || rpcData.invitationId;
  const expiresAt = rpcData.expires_at || rpcData.expiresAt;

  // Task C: Pastikan raw_token benar-benar tersedia sebelum membentuk inviteUrl
  if (!rawToken) {
    if (createdCandidateId) {
      try {
        await supabase.from('users_staff').delete().eq('id', createdCandidateId).is('uid', null);
      } catch (_) {}
    }
    console.error('[staffService] RPC returned missing raw_token. Raw RPC output:', rpcResult);
    throw new Error('Gagal mendapatkan token mentah dari database RPC (raw_token kosong). Silakan coba lagi.');
  }

  const inviteUrl = buildInvitationUrl(rawToken);

  return {
    success: true,
    invitation: rpcData,
    invitationId: invitationId,
    rawToken: rawToken,
    inviteUrl: inviteUrl,
    expiresAt: expiresAt,
    role: canonicalRole,
    email: cleanEmail,
  };
}

/**
 * Mengambil informasi undangan untuk halaman penerimaan undangan (publik/anon & auth).
 * Memanggil RPC `get_invitation_info(raw_invite_token)`.
 */
export async function getInvitationInfo(rawInviteToken) {
  if (!rawInviteToken) {
    return { is_valid: false, message: 'Token undangan tidak valid atau kosong.' };
  }

  try {
    const { data, error } = await supabase.rpc('get_invitation_info', {
      raw_invite_token: String(rawInviteToken).trim(),
    });

    if (error) {
      console.error('[staffService] get_invitation_info error:', error);
      return { is_valid: false, message: error.message || 'Gagal memverifikasi undangan.' };
    }

    return data || { is_valid: false, message: 'Undangan tidak ditemukan.' };
  } catch (err) {
    console.error('[staffService] get_invitation_info exception:', err);
    return { is_valid: false, message: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Mengklaim undangan staf secara atomik di database:
 * Memanggil RPC `claim_staff_invitation(raw_invite_token)`.
 * Mengikat Auth UID pengguna saat ini ke users_staff dan mengubah status undangan menjadi accepted.
 */
export async function claimStaffInvitation(rawInviteToken) {
  if (!rawInviteToken) {
    throw new Error('Token undangan tidak boleh kosong.');
  }

  const { data, error } = await supabase.rpc('claim_staff_invitation', {
    raw_invite_token: String(rawInviteToken).trim(),
  });

  if (error) {
    console.error('[staffService] claim_staff_invitation error:', error);
    throw new Error(error.message || 'Gagal mengklaim undangan staf.');
  }

  if (data !== true) {
    throw new Error('Klaim undangan gagal. Pastikan email Anda cocok dengan email yang diundang dan sudah diverifikasi.');
  }

  return true;
}

/**
 * Membatalkan undangan staf pending:
 * Memanggil RPC `revoke_staff_invitation(target_invitation_id)`.
 */
export async function revokeStaffInvitation(targetInvitationId) {
  if (!targetInvitationId) {
    throw new Error('ID Undangan wajib disertakan untuk pembatalan.');
  }

  const { data, error } = await supabase.rpc('revoke_staff_invitation', {
    target_invitation_id: targetInvitationId,
  });

  if (error) {
    console.error('[staffService] revoke_staff_invitation error:', error);
    throw new Error(error.message || 'Gagal membatalkan undangan.');
  }

  return data;
}

/**
 * Mengambil daftar staf aktif untuk tenant tertentu langsung dari Supabase.
 */
export async function getStaffListByTenant(tenantId) {
  if (!tenantId) return [];

  try {
    const { data, error } = await supabase
      .from('users_staff')
      .select('*')
      .eq('tenant_id', String(tenantId))
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((s) => ({
      id: s.id,
      uid: s.uid,
      isBound: Boolean(s.uid),
      name: s.name || s.display_name || s.full_name || 'Staf',
      displayName: s.display_name || s.name || 'Staf',
      email: s.email,
      role: s.role,
      tenantId: s.tenant_id,
      status: s.status || 'active',
      isActive: s.is_active !== false,
      phone: s.phone || '',
      avatarUrl: s.avatar_url || s.photo_url || '',
      createdAt: s.created_at,
    }));
  } catch (error) {
    console.error('[staffService] Error fetching staff list:', error);
    return [];
  }
}

/**
 * Mengambil seluruh daftar undangan (pending, accepted, expired, revoked) untuk tenant tertentu.
 */
export async function getInvitationsByTenant(tenantId) {
  if (!tenantId) return [];

  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('id, tenant_id, invite_email, email, invite_role, role, status, expires_at, created_at, created_by_uid')
      .eq('tenant_id', String(tenantId))
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[staffService] Fetch invitations warning:', error.message);
      return [];
    }

    return (data || []).map((inv) => {
      const expiresAt = inv.expires_at;
      const isExpired = expiresAt ? new Date(expiresAt) <= new Date() : false;
      let rawStatus = (inv.status || 'pending').toLowerCase();
      let computedStatus = rawStatus;

      if (rawStatus === 'pending' && isExpired) {
        computedStatus = 'expired';
      }

      return {
        id: inv.id,
        tenantId: inv.tenant_id,
        email: inv.invite_email || inv.email,
        role: inv.invite_role || inv.role,
        status: computedStatus,
        rawStatus: rawStatus,
        expiresAt: expiresAt,
        createdAt: inv.created_at,
        isExpired: isExpired,
      };
    });
  } catch (error) {
    console.warn('[staffService] Error fetching invitations:', error);
    return [];
  }
}

/**
 * Mengambil daftar undangan pending untuk tenant tertentu.
 */
export async function getPendingInvitationsByTenant(tenantId) {
  const invitations = await getInvitationsByTenant(tenantId);
  return invitations.filter((inv) => inv.status === 'pending');
}

/**
 * Hapus akun staf dari Supabase `users_staff`.
 */
export async function deleteStaffDoc(staffId) {
  if (!staffId) return;

  try {
    const { error } = await supabase
      .from('users_staff')
      .delete()
      .or(`id.eq.${staffId},uid.eq.${staffId}`);

    if (error) throw error;
  } catch (error) {
    console.error('[staffService] Error deleting staff:', error);
    throw error;
  }
}

/**
 * Perbarui profil staf (HANYA kolom aman yang diizinkan oleh column grants):
 * name, display_name, phone, avatar_url, notes, updated_at.
 * DILARANG menyertakan uid, tenant_id, role, atau status.
 */
export async function updateStaffProfile(staffId, { name, displayName, phone, avatarUrl, notes }) {
  if (!staffId) throw new Error('ID Staf wajib disertakan.');

  const updatePayload = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updatePayload.name = name ? String(name).trim() : null;
  if (displayName !== undefined) updatePayload.display_name = displayName ? String(displayName).trim() : null;
  if (phone !== undefined) updatePayload.phone = phone ? String(phone).trim() : null;
  if (avatarUrl !== undefined) updatePayload.avatar_url = avatarUrl;
  if (notes !== undefined) updatePayload.notes = notes;

  const { data, error } = await supabase
    .from('users_staff')
    .update(updatePayload)
    .or(`id.eq.${staffId},uid.eq.${staffId}`)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[staffService] updateStaffProfile error:', error);
    throw error;
  }

  return data;
}

/**
 * Ambil dokumen profil staf dari Supabase `users_staff` berdasarkan UID Auth
 */
export async function getStaffProfile(uid) {
  if (!uid) return null;
  try {
    const { data, error } = await supabase
      .from('users_staff')
      .select('*')
      .or(`uid.eq.${uid},id.eq.${uid}`)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        uid: data.uid || data.id,
        name: data.name || data.display_name || data.full_name,
        displayName: data.display_name || data.name,
        email: data.email,
        role: data.role,
        tenantId: data.tenant_id,
        status: data.status,
      };
    }
    return null;
  } catch (error) {
    console.error('[staffService] Error fetching staff profile:', error);
    return null;
  }
}

/**
 * Login Staf via Email & Password menggunakan Supabase Auth
 */
export async function loginStaffWithEmail(email, password) {
  if (!email || !password) {
    throw new Error('Email dan kata sandi wajib diisi.');
  }

  const cleanEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (authError) {
    throw new Error(authError.message || 'Email atau kata sandi tidak cocok.');
  }

  const user = authData?.user;
  if (!user) {
    throw new Error('Pengguna tidak ditemukan setelah login.');
  }

  const staffProfile = await getStaffProfile(user.id);
  if (!staffProfile) {
    const { data: staffByEmail } = await supabase
      .from('users_staff')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (staffByEmail) {
      return {
        uid: user.id,
        displayName: staffByEmail.name || staffByEmail.display_name || user.email,
        email: user.email,
        role: staffByEmail.role,
        tenantId: staffByEmail.tenant_id,
        isStaff: true,
      };
    }

    await supabase.auth.signOut({ scope: 'local' });
    const err = new Error('Akun staf belum terikat atau tidak terdaftar dalam database staf aktif.');
    err.code = 'STAFF_NOT_FOUND';
    throw err;
  }

  return {
    uid: user.id,
    displayName: staffProfile.name || user.email,
    email: user.email,
    role: staffProfile.role,
    tenantId: staffProfile.tenantId,
    isStaff: true,
  };
}

/**
 * Buat ulang / salin ulang tautan undangan staf.
 * Transparan: tidak mengklaim email otomatis terkirim jika layanan email SMTP/SES tidak aktif.
 */
export async function resendStaffInvitation(email, tenantId, role = 'kasir') {
  if (!email) throw new Error('Alamat email staf wajib diisi.');
  const cleanEmail = email.trim().toLowerCase();

  // Buat undangan baru secara resmi via RPC (otomatis menandai pending lama sebagai expired jika masa berlaku habis)
  if (tenantId) {
    return createStaffInvitation({
      tenantId,
      email: cleanEmail,
      role: role || 'kasir',
    });
  }

  return {
    success: true,
    email: cleanEmail,
    note: 'Silakan gunakan tautan undangan yang dibagikan oleh Owner/Admin.',
  };
}

// Kompatibilitas alias untuk komponen yang sudah ada
export const registerNewStaff = createStaffInvitation;
export const createStaff = createStaffInvitation;
export const registerStaffByOwner = createStaffInvitation;

// Stub helpers agar komponen diagnosa lama tidak error jika diimpor
export const WORKER_BASE_URL = '';
export async function checkWorkerHealth() {
  return { ok: false, message: 'Arsitektur menggunakan Supabase RLS & RPC langsung tanpa Express/Worker.' };
}
export async function createStaffMember(params) {
  return createStaffInvitation(params);
}
