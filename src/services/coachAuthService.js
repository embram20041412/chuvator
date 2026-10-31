import { supabase } from '../config/supabase';

/**
 * Mendaftarkan pelatih baru di akademi sekaligus membuatkan akun login Auth, Users Staff, & Invitations
 */
export async function createCoachWithAccount({
  tenantId,
  academyId,
  name,
  phone,
  email,
  password,
  specialty,
  sportSpecialty,
  photoUrl,
  nickname,
  nik,
  license,
  address
}) {
  let authUid = null;
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const cleanName = name ? name.trim() : '';
  const chosenSpecialty = sportSpecialty || specialty || 'Pelatih Utama';

  if (cleanEmail && password) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          tenant_id: tenantId,
          role: 'coach',
          full_name: cleanName
        }
      }
    });

    if (authError) {
      console.warn('Catatan Auth SignUp Coach:', authError.message);
    } else {
      authUid = authData.user?.id || null;
    }
  }

  // SINKRONISASI OTOMATIS: Insert / Upsert ke public.users_staff & public.invitations
  if (cleanEmail) {
    // 1. Sinkronisasi ke public.users_staff
    try {
      const staffRecord = {
        uid: authUid || null,
        tenant_id: tenantId,
        email: cleanEmail,
        name: cleanName,
        full_name: cleanName,
        role: 'coach',
        status: 'active',
        is_active: true,
        created_at: new Date().toISOString()
      };

      const { error: staffErr } = await supabase
        .from('users_staff')
        .upsert([staffRecord], { onConflict: 'email,tenant_id' });

      if (staffErr) {
        console.warn('[coachAuthService] Warning upserting users_staff:', staffErr.message);
        await supabase
          .from('users_staff')
          .update(staffRecord)
          .eq('email', cleanEmail);
      }
    } catch (staffCatch) {
      console.warn('[coachAuthService] Catch upserting users_staff:', staffCatch);
    }

    // 2. Sinkronisasi ke public.invitations
    try {
      const invRecord = {
        tenant_id: tenantId,
        email: cleanEmail,
        role: 'coach',
        status: 'accepted',
        created_at: new Date().toISOString(),
        accepted_at: new Date().toISOString()
      };

      const { error: invErr } = await supabase
        .from('invitations')
        .upsert([invRecord], { onConflict: 'email,tenant_id' });

      if (invErr) {
        console.warn('[coachAuthService] Warning upserting invitations:', invErr.message);
        await supabase
          .from('invitations')
          .update(invRecord)
          .eq('email', cleanEmail);
      }
    } catch (invCatch) {
      console.warn('[coachAuthService] Catch upserting invitations:', invCatch);
    }
  }

  // 3. Insert ke tabel public.coaches (MENGGUNAKAN KOLOM DB sport_specialty, BUKAN specialty)
  const coachPayload = {
    tenant_id: tenantId,
    academy_id: academyId || null,
    name: cleanName,
    phone: phone ? phone.trim() : null,
    email: cleanEmail,
    sport_specialty: chosenSpecialty,
    sport: chosenSpecialty,
    auth_uid: authUid,
    status: 'Aktif',
    created_at: new Date().toISOString()
  };

  if (nickname) coachPayload.nickname = nickname.trim();
  if (nik) coachPayload.nik = nik.trim();
  if (license) coachPayload.license = license.trim();
  if (photoUrl) coachPayload.photo_url = photoUrl;
  if (address) coachPayload.address = address;

  const { data: coachData, error: coachError } = await supabase
    .from('coaches')
    .insert([coachPayload])
    .select()
    .single();

  if (coachError) {
    throw new Error(`Gagal menyimpan data pelatih: ${coachError.message}`);
  }

  return { success: true, coach: coachData };
}

/**
 * Fungsi bagi pelatih untuk mengubah password mandiri setelah login
 */
export async function updateCoachPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error(`Gagal memperbarui kata sandi: ${error.message}`);
  }
  return { success: true, data };
}

export default {
  createCoachWithAccount,
  updateCoachPassword
};
