import { supabase } from '../config/supabase';

/**
 * Registrasi Staf Baru oleh Owner menggunakan Supabase Auth & PostgreSQL Table `users_staff`.
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.role
 * @param {string} params.tenantId
 * @param {string} params.fullName
 * @param {string} [params.displayName]
 * @param {string} [params.name]
 */
export async function registerNewStaff({ email, password, role, tenantId, fullName, displayName, name }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanFullName = String(fullName || displayName || name || '').trim();
  const normalizedRole = String(role || 'kasir').toLowerCase().trim();
  const assignedRole = normalizedRole === 'coach' ? 'pelatih' : normalizedRole;

  if (!cleanEmail || !password || !cleanFullName || !tenantId) {
    throw new Error('Semua data (Email, Password, Role, Tenant ID, Nama Lengkap) wajib diisi.');
  }

  // Langkah A: Daftarkan kredensial ke Supabase Auth secara langsung
  let userId = `staff-${Date.now()}`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: cleanEmail,
    password: password,
    options: {
      data: {
        tenant_id: tenantId,
        role: assignedRole,
        full_name: cleanFullName,
      },
    },
  });

  if (authError) {
    console.warn('[staffService] Auth SignUp note:', authError.message);
    const msg = (authError.message || '').toLowerCase();
    if (
      msg.includes('already registered') ||
      msg.includes('already exists') ||
      authError.status === 422 ||
      authError.code === 'user_already_exists'
    ) {
      console.info(`[staffService] User "${cleanEmail}" sudah terdaftar di Auth. Melanjutkan penyambungan profil staf & undangan.`);
      try {
        const { data: existingStaff } = await supabase
          .from('users_staff')
          .select('uid')
          .eq('email', cleanEmail)
          .maybeSingle();
        if (existingStaff?.uid) {
          userId = existingStaff.uid;
        }
      } catch (e) {
        console.warn('[staffService] Fetch existing staff UID note:', e);
      }
    } else {
      throw new Error(`Gagal membuat akun Auth: ${authError.message}`);
    }
  } else {
    userId = authData.user?.id || userId;
  }

  // Langkah B: Masukkan data profil staf ke tabel public.users_staff di Supabase
  const staffRecord = {
    uid: userId,
    tenant_id: tenantId,
    email: cleanEmail,
    name: cleanFullName,
    full_name: cleanFullName,
    display_name: cleanFullName,
    role: assignedRole,
    status: 'active',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const { data: dbData, error: dbError } = await supabase
    .from('users_staff')
    .upsert([staffRecord], { onConflict: 'email,tenant_id' })
    .select()
    .single();

  if (dbError) {
    console.warn('[staffService] Warning upserting users_staff:', dbError.message);
  }

  // Langkah C: Catat juga ke tabel invitations untuk audit riwayat GOR (HANYA KOLOM SKEMA STANDAR)
  try {
    await supabase.from('invitations').upsert([
      {
        tenant_id: tenantId,
        email: cleanEmail,
        role: assignedRole,
        status: 'accepted',
        created_at: new Date().toISOString()
      },
    ], { onConflict: 'email,tenant_id' });
  } catch (invErr) {
    console.warn('[staffService] Invitations note:', invErr);
  }

  return { success: true, data: dbData || staffRecord, authData };
}

// Export alias functions untuk kompatibilitas penuh dengan komponen UI
export async function createStaff(params) {
  return registerNewStaff(params);
}

export async function registerStaffByOwner(params) {
  return registerNewStaff(params);
}

/**
 * Ambil dokumen profil staf dari Supabase `users_staff`
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
    console.error('Error fetching staff profile from Supabase:', error);
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

  try {
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

    // Ambil profil staf dari Supabase `users_staff`
    const staffProfile = await getStaffProfile(user.id);

    if (!staffProfile) {
      // Periksa apakah user adalah staf berdasarkan email
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
      const err = new Error('Akun staf tidak terdaftar dalam database staf aktif.');
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
  } catch (error) {
    console.error('Login staff error:', error);
    throw error;
  }
}

/**
 * Mengambil seluruh daftar staf untuk tenant tertentu langsung dari Supabase
 */
export async function getStaffListByTenant(tenantId) {
  if (!tenantId) return [];

  try {
    const { data, error } = await supabase
      .from('users_staff')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((s) => ({
      id: s.id,
      uid: s.uid || s.id,
      name: s.name || s.display_name || s.full_name,
      displayName: s.display_name || s.name,
      email: s.email,
      role: s.role,
      tenantId: s.tenant_id,
      status: s.status || 'active',
      createdAt: s.created_at,
    }));
  } catch (error) {
    console.error('Error fetching staff list from Supabase:', error);
    return [];
  }
}

/**
 * Hapus akun staf dari Supabase `users_staff`
 */
export async function deleteStaffDoc(staffUid) {
  if (!staffUid) return;

  try {
    const { error } = await supabase
      .from('users_staff')
      .delete()
      .or(`id.eq.${staffUid},uid.eq.${staffUid}`);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting staff doc from Supabase:', error);
    throw error;
  }
}

/**
 * Mengirim ulang email konfirmasi atau tautan undangan staf melalui Supabase Auth
 */
export async function resendStaffInvitation(email) {
  if (!email) throw new Error('Alamat email staf wajib diisi.');
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });

    if (error) {
      console.warn('[staffService] Supabase auth.resend warning:', error.message);
      // Jika terjadi error dari API resend, tetap perbarui updated_at di invitations
    }

    // Perbarui timestamp di tabel invitations
    await supabase.from('invitations')
      .update({ updated_at: new Date().toISOString() })
      .eq('email', cleanEmail);

    return { success: true, email: cleanEmail };
  } catch (err) {
    console.error('Gagal mengirim ulang undangan staf:', err);
    throw err;
  }
}
