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

  // 1. TANGANI SIGN UP SUPABASE AUTH
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
      console.warn('[coachAuthService] Auth SignUp note:', authError.message);
      const msg = (authError.message || '').toLowerCase();
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        authError.status === 422 ||
        authError.code === 'user_already_exists'
      ) {
        // User sudah terdaftar di Supabase Auth -> Jangan gagalkan seluruh proses,
        // lanjutkan upsert data undangan dan penyambungan pengguna ke tenant.
        console.info(`[coachAuthService] User email "${cleanEmail}" sudah terdaftar di Auth. Melanjutkan penyambungan tenant & undangan.`);
        try {
          const { data: existingStaff } = await supabase
            .from('users_staff')
            .select('uid')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (existingStaff?.uid) {
            authUid = existingStaff.uid;
          }
        } catch (e) {
          console.warn('[coachAuthService] Fetch existing staff UID note:', e);
        }
      }
    } else {
      authUid = authData.user?.id || null;
    }
  }

  // 2. SINKRONISASI OTOMATIS: Insert / Upsert ke public.users_staff & public.invitations
  if (cleanEmail) {
    // Sinkronisasi ke public.users_staff
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

    // Sinkronisasi ke public.invitations (HANYA MENGGUNAKAN KOLOM SKEMA STANDAR: tenant_id, email, role, status, created_at)
    try {
      const invRecord = {
        tenant_id: tenantId,
        email: cleanEmail,
        role: 'coach',
        status: 'accepted',
        created_at: new Date().toISOString()
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

  // 3. INSERT / UPSERT KE TABEL public.coaches
  const cleanAcademyId = academyId ? String(academyId).trim() : null;
  const coachPayload = {
    tenant_id: tenantId,
    academy_id: cleanAcademyId,
    name: cleanName,
    coach_name: cleanName,
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

  let coachData = null;
  const { data: insertedCoach, error: coachError } = await supabase
    .from('coaches')
    .insert([coachPayload])
    .select()
    .single();

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
        const updatePayload = {
          sport_specialty: chosenSpecialty,
          coach_name: cleanName,
          updated_at: new Date().toISOString()
        };
        if (cleanAcademyId) updatePayload.academy_id = cleanAcademyId;
        if (authUid) updatePayload.auth_uid = authUid;

        await supabase
          .from('coaches')
          .update(updatePayload)
          .eq('id', existingCoach.id);
      } else {
        throw new Error(`Gagal menyimpan data pelatih: ${coachError.message}`);
      }
    } else {
      throw new Error(`Gagal menyimpan data pelatih: ${coachError.message}`);
    }
  } else {
    coachData = insertedCoach;
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
