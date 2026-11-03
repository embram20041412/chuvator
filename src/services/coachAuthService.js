import { supabase } from '../config/supabase';
import { createStaffInvitation } from './staffService';
import { toUuidOrNull } from './supabaseAcademyService';

/**
 * Mendaftarkan pelatih baru di akademi (tabel public.coaches)
 * sekaligus mengundang pelatih melalui sistem undangan resmi database (create_staff_invitation RPC).
 *
 * Catatan Arsitektur & Keamanan:
 * - Data profil pelatih tetap disimpan pada tabel kanonis `coaches`.
 * - Pembuatan akun login TIDAK melakukan direct signUp atau direct upsert ke users_staff/invitations.
 * - Akun pelatih diundang melalui sistem RPC resmi, menghasilkan token aman & tautan undangan yang dapat disalin.
 * - Binding Auth UID dilakukan secara atomik saat pelatih mengklaim undangan via RPC claim_staff_invitation.
 */
export async function createCoachWithAccount({
  tenantId,
  academyId,
  name,
  phone,
  email,
  specialty,
  sportSpecialty,
  photoUrl,
  nickname,
  nik,
  license,
  address,
  sendInvite = true,
}) {
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const cleanName = name ? name.trim() : '';
  const chosenSpecialty = sportSpecialty || specialty || 'Pelatih Utama';
  const cleanAcademyId = toUuidOrNull(academyId);

  if (!cleanName || !tenantId) {
    throw new Error('Nama pelatih dan ID Tenant wajib diisi.');
  }

  // 1. Simpan data pelatih ke tabel kanonis `coaches`
  const coachPayload = {
    tenant_id: tenantId,
    academy_id: cleanAcademyId,
    name: cleanName,
    phone: phone ? phone.trim() : null,
    email: cleanEmail,
    sport_specialty: chosenSpecialty,
    status: 'Aktif',
    created_at: new Date().toISOString(),
  };

  if (nickname) coachPayload.nickname = nickname.trim();
  if (nik) coachPayload.nik = nik.trim();
  if (photoUrl) coachPayload.photo_url = photoUrl;
  if (license !== undefined) coachPayload.license = license ? String(license).trim() : null;
  if (address !== undefined) coachPayload.address = address || null;

  let coachData = null;
  let { data: insertedCoach, error: coachError } = await supabase
    .from('coaches')
    .insert([coachPayload])
    .select()
    .single();

  // Retry logic jika skema Supabase belum memiliki kolom opsional (seperti nickname/nik/photo_url)
  if (coachError && coachError.message && coachError.message.includes('Could not find the')) {
    console.warn('[coachAuthService] Retrying coach insert with core columns due to missing column:', coachError.message);
    const corePayload = {
      tenant_id: tenantId,
      academy_id: cleanAcademyId,
      name: cleanName,
      phone: phone ? phone.trim() : null,
      email: cleanEmail,
      sport_specialty: chosenSpecialty,
      status: 'Aktif',
      created_at: new Date().toISOString(),
    };
    if (license !== undefined) corePayload.license = license ? String(license).trim() : null;
    if (address !== undefined) corePayload.address = address || null;

    const retryRes = await supabase
      .from('coaches')
      .insert([corePayload])
      .select()
      .single();

    if (!retryRes.error) {
      insertedCoach = retryRes.data;
      coachError = null;
    }
  }

  if (coachError) {
    console.warn('[coachAuthService] Warning inserting coach:', coachError.message);
    if (cleanEmail) {
      const { data: existingCoach } = await supabase
        .from('coaches')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingCoach) {
        coachData = existingCoach;
      } else {
        throw new Error(`Gagal menyimpan data pelatih: ${coachError.message}`);
      }
    } else {
      throw new Error(`Gagal menyimpan data pelatih: ${coachError.message}`);
    }
  } else {
    coachData = insertedCoach;
  }

  // 2. Jika email disediakan dan Owner memilih untuk menerbitkan undangan (sendInvite === true),
  // panggil sistem undangan resmi staff dengan peran 'coach' via createStaffInvitation()
  let invitationResult = null;
  let invitationError = null;

  if (cleanEmail && sendInvite) {
    try {
      invitationResult = await createStaffInvitation({
        tenantId,
        email: cleanEmail,
        role: 'coach',
        fullName: cleanName,
        name: cleanName,
      });
    } catch (invErr) {
      console.warn('[coachAuthService] Warning creating coach staff invitation:', invErr.message);
      // PENTING: Profil pelatih yang sudah berhasil disimpan TIDAK DIBATALKAN.
      // Laporkan error undangan secara eksplisit agar UI dapat menanganinya dengan aman.
      invitationError = invErr.message || 'Gagal menerbitkan undangan staf.';
      invitationResult = {
        success: false,
        warning: invErr.message,
        error: invErr.message,
        code: invErr.code || 'INVITATION_FAILED',
      };
    }
  }

  return {
    success: true,
    coach: coachData,
    invitation: invitationResult,
    inviteUrl: invitationResult?.inviteUrl || null,
    invitationError: invitationError,
  };
}

/**
 * Fungsi bagi pelatih untuk mengubah password mandiri setelah login
 */
export async function updateCoachPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(`Gagal memperbarui kata sandi: ${error.message}`);
  }
  return { success: true, data };
}

export default {
  createCoachWithAccount,
  updateCoachPassword,
};
