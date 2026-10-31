import { createClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

// URL dan Anon Key untuk isolated client (tidak menimpa sesi Owner aktif saat mendaftarkan staf)
const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wqnhlmvvyhpctmaukwyj.supabase.co';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';

/**
 * Registrasi Staf/Pelatih oleh Owner menggunakan Supabase.
 * Menggunakan endpoint server /api/create-staff ATAU isolated Supabase sign-up client (persistSession: false)
 * sehingga akun Owner yang sedang aktif TIDAK PERNAH ter-logout atau tertimpa sesi baru.
 */
export async function registerStaffByOwner({ name, email, password, role, tenantId }) {
  if (!name || !email || !password || !role || !tenantId) {
    throw new Error('Semua data (Nama, Email, Password, Role, Tenant ID) wajib diisi.');
  }

  const normalizedRole = role.toLowerCase().trim();
  const validRoles = ['admin', 'kasir', 'pelatih', 'coach'];
  if (!validRoles.includes(normalizedRole)) {
    throw new Error('Role staf tidak valid. Harus "admin", "kasir", atau "pelatih".');
  }

  const cleanName = name.trim();
  const cleanEmail = email.toLowerCase().trim();
  const assignedRole = normalizedRole === 'coach' ? 'pelatih' : normalizedRole;

  // 1. Coba daftarkan melalui endpoint server /api/create-staff (Full-Stack Backend)
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (token) {
      const response = await fetch('/api/create-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          displayName: cleanName,
          role: assignedRole,
          tenantId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const staffUid = result.data?.uid || null;

        // Pastikan record profil staf di users_staff tersimpan dengan status 'active'
        const staffRecord = {
          uid: staffUid || `staff-${Date.now()}`,
          name: cleanName,
          full_name: cleanName,
          display_name: cleanName,
          email: cleanEmail,
          role: assignedRole,
          tenant_id: tenantId,
          status: 'active',
          is_active: true,
          created_at: new Date().toISOString(),
        };

        await supabase.from('users_staff').upsert([staffRecord], { onConflict: 'email,tenant_id' });

        // Record ke tabel invitations untuk riwayat GOR
        try {
          await supabase.from('invitations').upsert([{
            email: cleanEmail,
            tenant_id: tenantId,
            role: assignedRole,
            status: 'accepted',
            created_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
          }], { onConflict: 'email,tenant_id' });
        } catch (invErr) {
          console.warn('[Supabase invitations upsert]:', invErr);
        }

        return {
          uid: staffUid,
          name: cleanName,
          email: cleanEmail,
          role: assignedRole,
          tenantId,
          status: 'active'
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        // Jika email sudah terdaftar atau error validasi spesifik, teruskan pesan
        if (response.status === 409 || errorData.error === 'EMAIL_ALREADY_EXISTS') {
          throw new Error(`Email "${cleanEmail}" sudah terdaftar di sistem. Harap gunakan alamat email lain.`);
        }
        if (response.status === 400 || response.status === 403) {
          throw new Error(errorData.message || 'Gagal mendaftarkan staf via server backend.');
        }
      }
    }
  } catch (backendErr) {
    // Jika backendErr adalah error validasi (409 atau 400), jangan fallback, lempar langsung
    if (backendErr.message && (backendErr.message.includes('sudah terdaftar') || backendErr.message.includes('Hanya Owner'))) {
      throw backendErr;
    }
    console.warn('[staffService] /api/create-staff tidak tersedia, menggunakan isolated Supabase client fallback:', backendErr);
  }

  // 2. Fallback: Gunakan Isolated Client Supabase (persistSession: false)
  const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let staffUid = null;

  try {
    const { data: authData, error: authError } = await isolatedClient.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          display_name: cleanName,
          role: assignedRole,
          tenant_id: tenantId,
        },
      },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered')) {
        throw new Error(`Email "${cleanEmail}" sudah terdaftar di sistem. Gunakan email lain.`);
      }
      console.warn('[staffService] Isolated signUp error/note:', authError.message);
      staffUid = `staff-${Date.now()}`;
    } else {
      staffUid = authData?.user?.id || `staff-${Date.now()}`;
    }
  } catch (signUpErr) {
    if (signUpErr.message && signUpErr.message.includes('sudah terdaftar')) {
      throw signUpErr;
    }
    console.warn('[staffService] signUp caught:', signUpErr);
    staffUid = `staff-${Date.now()}`;
  }

  // 3. Simpan data profil staf ke Supabase tabel `users_staff` (WAJIB selalu tersimpan dengan status 'active')
  const staffRecord = {
    uid: staffUid || `staff-${Date.now()}`,
    name: cleanName,
    full_name: cleanName,
    display_name: cleanName,
    email: cleanEmail,
    role: assignedRole,
    tenant_id: tenantId,
    status: 'active',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const { error: insertStaffErr } = await supabase
    .from('users_staff')
    .upsert([staffRecord], { onConflict: 'email,tenant_id' });

  if (insertStaffErr) {
    console.warn('[Supabase users_staff insert error]:', insertStaffErr);
  }

  // 4. Catat juga pada tabel `invitations` untuk audit pendaftaran staf / riwayat GOR
  try {
    await supabase.from('invitations').upsert([{
      email: cleanEmail,
      tenant_id: tenantId,
      role: assignedRole,
      status: 'accepted',
      created_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    }], { onConflict: 'email,tenant_id' });
  } catch (invErr) {
    console.warn('[Supabase invitations upsert]:', invErr);
  }

  return {
    uid: staffUid,
    name: cleanName,
    email: cleanEmail,
    role: assignedRole,
    tenantId,
    status: 'active',
  };
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

      await supabase.auth.signOut();
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
