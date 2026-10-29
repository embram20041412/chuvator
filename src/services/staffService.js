import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { supabase } from '../config/supabase';
import { auth } from '../firebase';

/**
 * Registrasi Staf/Pelatih oleh Owner menggunakan "Secondary Firebase App"
 * Ini menjamin akun Owner utama TIDAK ter-logout saat mendaftarkan staf baru.
 */
export async function registerStaffByOwner({ name, email, password, role, tenantId }) {
  if (!name || !email || !password || !role || !tenantId) {
    throw new Error('Semua data (Nama, Email, Password, Role, Tenant ID) wajib diisi.');
  }

  if (role !== 'admin' && role !== 'pelatih') {
    throw new Error('Role staf tidak valid. Harus "admin" atau "pelatih".');
  }

  const secondaryAppName = `SecondaryStaffApp_${Date.now()}`;
  let secondaryApp = null;

  try {
    // 1. Inisialisasi App Firebase Kedua khusus untuk Pendaftaran Staf
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // 2. Buat akun Auth staf di Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth, 
      email.trim(), 
      password
    );
    const newStaffUser = userCredential.user;

    // 3. Simpan data profil staf ke Supabase tabel `users_staff`
    const staffData = {
      uid: newStaffUser.uid,
      name: name.trim(),
      display_name: name.trim(),
      email: email.toLowerCase().trim(),
      role: role,
      tenant_id: tenantId,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabase.from('users_staff').upsert([staffData]);
    if (insertErr) console.warn('[Supabase users_staff insert]:', insertErr);

    // 4. Logout dari Secondary Auth untuk keamanan
    await signOut(secondaryAuth);

    return {
      uid: newStaffUser.uid,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
      tenantId
    };

  } catch (error) {
    console.error('Error registering staff:', error);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Email ini sudah terdaftar di sistem. Gunakan email lain.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password terlalu lemah. Gunakan minimal 6 karakter.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Format email tidak valid.');
    }
    throw error;
  } finally {
    // Clean up secondary Firebase app instance
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch (cleanupErr) {
        console.warn('Warning deleting secondary app:', cleanupErr);
      }
    }
  }
}

/**
 * Ambil dokumen profil staf dari Supabase `users_staff`
 */
export async function getStaffProfile(uid) {
  try {
    const { data, error } = await supabase
      .from('users_staff')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        uid: data.uid,
        name: data.name || data.display_name,
        displayName: data.display_name || data.name,
        email: data.email,
        role: data.role,
        tenantId: data.tenant_id
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching staff profile from Supabase:', error);
    return null;
  }
}

/**
 * Login Staf via Email & Password menggunakan Firebase Auth utama
 */
export async function loginStaffWithEmail(email, password) {
  if (!email || !password) {
    throw new Error('Email dan kata sandi wajib diisi.');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const firebaseUser = userCredential.user;

    // Ambil profil staf dari Supabase `users_staff`
    const staffProfile = await getStaffProfile(firebaseUser.uid);

    if (!staffProfile) {
      await signOut(auth);
      const err = new Error('Akun staf tidak ditemukan dalam sistem.');
      err.code = 'STAFF_NOT_FOUND';
      throw err;
    }

    return {
      uid: firebaseUser.uid,
      displayName: staffProfile.name || firebaseUser.displayName || 'Staf CHUA',
      email: firebaseUser.email,
      role: staffProfile.role,
      tenantId: staffProfile.tenantId,
      isStaff: true
    };
  } catch (error) {
    console.error('Login staff error:', error);
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
      throw new Error('Email atau kata sandi tidak cocok.');
    }
    throw error;
  }
}

/**
 * Mengambil seluruh daftar staf untuk tenant tertentu
 */
export async function getStaffListByTenant(tenantId) {
  if (!tenantId) return [];

  try {
    const { data, error } = await supabase
      .from('users_staff')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return (data || []).map((s) => ({
      id: s.id,
      uid: s.uid,
      name: s.name || s.display_name,
      displayName: s.display_name || s.name,
      email: s.email,
      role: s.role,
      tenantId: s.tenant_id,
      createdAt: s.created_at
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
