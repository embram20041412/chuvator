import { supabase } from './supabaseClient';

/**
 * Mendaftarkan pelatih baru di akademi sekaligus membuatkan akun login Auth & Users Staff
 */
export async function createCoachWithAccount({ tenantId, academyId, name, phone, email, password, specialty }) {
  let authUid = null;

  if (email && password) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

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
      console.warn('Catatan Auth SignUp:', authError.message);
    } else {
      authUid = authData.user?.id || null;
    }

    if (authUid || cleanEmail) {
      await supabase.from('users_staff').upsert([
        {
          uid: authUid || null,
          tenant_id: tenantId,
          email: cleanEmail,
          name: cleanName,
          full_name: cleanName,
          role: 'coach',
          status: 'active',
          is_active: true
        }
      ], { onConflict: 'email,tenant_id' });
    }
  }

  const { data: coachData, error: coachError } = await supabase
    .from('coaches')
    .insert([
      {
        tenant_id: tenantId,
        academy_id: academyId || null,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        specialty: specialty || 'Pelatih Utama',
        auth_uid: authUid
      }
    ])
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
