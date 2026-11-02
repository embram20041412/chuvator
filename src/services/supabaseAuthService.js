import { supabase } from '../config/supabase.js';

export const SUPER_ADMIN_EMAIL = 'erizamaulana.bramantya@gmail.com';

/**
 * Memverifikasi status Super Admin platform secara tepercaya melalui RPC PostgreSQL:
 * 1. Panggil is_superadmin() -> jika true, langsung otorisasi.
 * 2. Jika false (misal login pertama kali atau auth_uid belum terikat), panggil bootstrap_platform_superadmin()
 * 3. Jika bootstrap mengembalikan true/sukses, panggil kembali is_superadmin() untuk mengonfirmasi database.
 * 4. Fallback pencarian tabel hanya menggunakan kolom kanonis 'auth_uid', BUKAN 'user_id'.
 * 5. Fail-closed: jika RPC error atau gagal, kembalikan null (tidak boleh eskalasi peran).
 */
export async function verifySuperadminStatus(user, client = supabase) {
  if (!user) return null;

  const userId = user.id || user.uid;
  if (!userId) return null;

  const meta = user.user_metadata || {};
  const photoURL = user.photoURL || meta.avatar_url || meta.picture || null;
  const displayName = user.displayName || meta.full_name || meta.name || user.email?.split('@')[0] || 'Super Admin';

  try {
    // Langkah 1: Cek langsung via RPC is_superadmin()
    const { data: isSuper, error: superErr } = await client.rpc('is_superadmin');
    if (!superErr && isSuper === true) {
      return {
        uid: userId,
        id: userId,
        displayName: displayName || 'Super Admin',
        email: user.email,
        photoURL,
        role: 'superadmin',
        tenant: null,
        tenantId: null,
        isStaff: false,
      };
    }

    // Langkah 2: Jika belum terikat (auth_uid masih NULL), panggil bootstrap_platform_superadmin()
    if (!isSuper) {
      try {
        const { data: bootResult, error: bootErr } = await client.rpc('bootstrap_platform_superadmin');
        if (!bootErr && (bootResult === true || bootResult?.success === true)) {
          // Langkah 3: Re-verifikasi dengan is_superadmin() untuk memastikan baris database telah terikat
          const { data: recheckSuper, error: recheckErr } = await client.rpc('is_superadmin');
          if (!recheckErr && recheckSuper === true) {
            return {
              uid: userId,
              id: userId,
              displayName: displayName || 'Super Admin',
              email: user.email,
              photoURL,
              role: 'superadmin',
              tenant: null,
              tenantId: null,
              isStaff: false,
            };
          }
        }
      } catch (bootEx) {
        console.warn('[verifySuperadminStatus] Exception during bootstrap_platform_superadmin:', bootEx);
      }
    }

    // Langkah 4: Fallback opsional ke tabel platform_superadmins hanya dengan kolom kanonis 'auth_uid'
    // CATATAN KEAMANAN: Tabel platform_superadmins TIDAK MEMILIKI kolom user_id. Gunakan auth_uid.
    try {
      const { data: superadminRow, error: rowErr } = await client
        .from('platform_superadmins')
        .select('id, auth_uid, email')
        .eq('auth_uid', userId)
        .maybeSingle();

      if (!rowErr && superadminRow && superadminRow.auth_uid === userId) {
        return {
          uid: userId,
          id: userId,
          displayName: displayName || 'Super Admin',
          email: user.email,
          photoURL,
          role: 'superadmin',
          tenant: null,
          tenantId: null,
          isStaff: false,
        };
      }
    } catch (tableCheckErr) {
      console.warn('[verifySuperadminStatus] platform_superadmins table check warning:', tableCheckErr);
    }
  } catch (superCheckErr) {
    console.warn('[verifySuperadminStatus] Superadmin DB verification check warning:', superCheckErr);
  }

  return null;
}

/**
 * Validates Supabase user email & ID against authorization rules (Strict Invite-Only Enforcement):
 * 1. Super Admin -> 'superadmin' via verified RPC & platform_superadmins binding
 * 2. Check Supabase `users_staff` -> 'admin' / 'pelatih' / 'kasir'
 * 3. Check Supabase `tenants` -> Existing Tenant Owner (direct to Dashboard)
 * 4. Check Supabase `invitations` -> Invited user (allowed to access Onboarding)
 * 5. Uninvited user -> Blocked & auto sign-out
 */
export async function verifyUserRoleAndTenant(user, client = supabase) {
  if (!user) {
    throw new Error('User tidak valid.');
  }

  const userId = user.id || user.uid;
  const normalizedEmail = user.email ? user.email.toLowerCase().trim() : '';
  const meta = user.user_metadata || {};
  const photoURL = user.photoURL || meta.avatar_url || meta.picture || null;
  const displayName = user.displayName || meta.full_name || meta.name || user.email?.split('@')[0] || 'User';

  // 1. Check if Platform Superadmin via trusted PostgreSQL RPC and verified bootstrap
  const superAdminProfile = await verifySuperadminStatus(user, client);
  if (superAdminProfile) {
    return superAdminProfile;
  }

  // 2. Check if user exists in Supabase `users_staff` by UID/ID or email
  try {
    let staffData = null;
    if (userId) {
      const { data: staffByUid } = await client
        .from('users_staff')
        .select('*')
        .or(`uid.eq.${userId},id.eq.${userId}`)
        .maybeSingle();
      if (staffByUid) staffData = staffByUid;
    }

    if (!staffData && normalizedEmail) {
      const { data: staffByEmail } = await client
        .from('users_staff')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      if (staffByEmail) staffData = staffByEmail;
    }

    if (staffData) {
      let tenantData = null;
      if (staffData.tenant_id) {
        try {
          const { data: tRow } = await client
            .from('tenants')
            .select('*')
            .eq('id', staffData.tenant_id)
            .maybeSingle();
          if (tRow) tenantData = tRow;
        } catch (tErr) {
          console.warn('Warning fetching tenant for staff:', tErr);
        }
      }

      return {
        uid: userId,
        id: userId,
        displayName: staffData.name || staffData.full_name || displayName || 'Staf CHUA',
        email: user.email || staffData.email,
        photoURL,
        role: staffData.role || 'kasir',
        tenantId: staffData.tenant_id,
        tenant: tenantData,
        isStaff: true,
      };
    }
  } catch (staffErr) {
    console.warn('Error checking users_staff in Supabase:', staffErr);
  }

  // 3. Check if user has an existing tenant in `tenants` by ID or owner_email
  let tenantData = null;
  let tenantId = null;

  try {
    const { data: directTenant } = await client
      .from('tenants')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (directTenant) {
      tenantData = directTenant;
      tenantId = directTenant.id;
    } else if (normalizedEmail) {
      const { data: tenantByEmail } = await client
        .from('tenants')
        .select('*')
        .or(`owner_email.eq.${normalizedEmail},owner_uid.eq.${userId}`)
        .maybeSingle();

      if (tenantByEmail) {
        tenantData = tenantByEmail;
        tenantId = tenantByEmail.id;
      }
    }
  } catch (tenantErr) {
    console.warn('Error checking tenant in Supabase:', tenantErr);
  }

  // If user ALREADY HAS an active tenant, enter Dashboard directly (no onboarding needed)
  if (tenantData && tenantId) {
    return {
      uid: userId,
      id: userId,
      displayName: displayName || tenantData.name || 'Tenant Owner',
      email: user.email,
      photoURL,
      role: 'owner',
      tenant: tenantData,
      tenantId: tenantId,
      isStaff: false,
    };
  }

  // 4. Check Official Invitation (`invitations`) for Onboarding Access
  let invitationInfo = null;
  if (normalizedEmail) {
    try {
      const { data: invRow } = await client
        .from('invitations')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (invRow) {
        invitationInfo = invRow;
      }
    } catch (invErr) {
      console.warn('Error checking invitations in Supabase:', invErr);
    }
  }

  // If email IS found in invitations, allow access to Onboarding Page
  if (invitationInfo) {
    return {
      uid: userId,
      id: userId,
      displayName: displayName || 'Tenant Owner',
      email: user.email,
      photoURL,
      role: invitationInfo.role || 'owner',
      tenant: null,
      tenantId: userId,
      isStaff: false,
      invitation: invitationInfo,
    };
  }

  // 5. IF NOT IN invitations, NOT IN tenants, AND NOT IN users_staff:
  // Jika pengguna sedang berada pada rute penerimaan undangan, jangan sign-out paksa
  const isAcceptingInvite = typeof window !== 'undefined' && 
    (window.location.pathname.includes('/accept-invitation') || window.location.pathname.includes('/invite'));

  if (isAcceptingInvite) {
    return {
      uid: userId,
      id: userId,
      displayName: displayName || 'Calon Anggota',
      email: user.email,
      photoURL,
      role: 'guest',
      tenant: null,
      tenantId: null,
      isStaff: false,
      isPendingClaim: true,
    };
  }

  // STRICT FAIL-CLOSED ACCESS DENIED:
  // Do NOT invoke supabase.auth.signOut() here to prevent triggering re-entrant onAuthStateChange events!
  const uninvitedErr = new Error(
    `Akses Ditolak: Email Anda (${user.email || 'tanpa email'}) belum terdaftar dalam daftar undangan resmi CHUA SPORT CORE. Silakan hubungi Administrator Sistem untuk mendapatkan akses.`
  );
  uninvitedErr.code = 'UNAUTHORIZED_EMAIL';
  throw uninvitedErr;
}

export const supabaseAuthService = {
  /**
   * Initiates Google Sign-In via Supabase OAuth using Authorization Code Flow with PKCE
   */
  async loginWithGoogle() {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('[Supabase OAuth PKCE] Error initiating Google sign-in:', error);
      throw error;
    }

    return data;
  },

  async loginWithEmailAndPassword(email, password) {
    if (!email || !password) {
      throw new Error('Email dan kata sandi harus diisi.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      console.error('Supabase Email/Password Login error:', error);
      throw new Error('Email atau kata sandi tidak cocok.');
    }
    try {
      const userProfile = await verifyUserRoleAndTenant(data.user);
      return userProfile;
    } catch (verifErr) {
      // If user profile verification fails, cleanly sign out from local session
      await supabase.auth.signOut({ scope: 'local' });
      throw verifErr;
    }
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async logout() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('[Supabase Logout] SignOut error:', error);
      throw error;
    }
  },
};

/**
 * Initiates Google Sign-In via Supabase OAuth
 */
export async function loginWithGoogle() {
  return await supabaseAuthService.loginWithGoogle();
}

/**
 * Login Staf dengan Email & Sandi via Supabase Auth
 */
export async function loginWithEmailAndPassword(email, password) {
  return await supabaseAuthService.loginWithEmailAndPassword(email, password);
}

/**
 * Sign out current user from Supabase and clear application storage
 */
export async function logoutUser() {
  try {
    localStorage.removeItem('demo_user_profile');
    localStorage.removeItem('activeStudent');
    localStorage.removeItem('activeAcademyId');
    sessionStorage.clear();
  } catch (e) {
    console.warn('[logoutUser] Storage cleanup warning:', e);
  }
  await supabaseAuthService.logout();
}

// Sequence counter to discard stale async verification requests
let authStateSequence = 0;

/**
 * Subscribe to Supabase auth state changes and verify authorization.
 * Uses sequence counter to prevent race conditions and avoids re-entrant signOut calls.
 */
export function subscribeToAuthChanges(onUserChanged) {
  let isSubscribed = true;

  const handleSessionChange = async (session) => {
    const seq = ++authStateSequence;

    if (!session?.user) {
      if (isSubscribed && seq === authStateSequence) {
        onUserChanged(null, null, null);
      }
      return;
    }

    try {
      const userProfile = await verifyUserRoleAndTenant(session.user);
      if (isSubscribed && seq === authStateSequence) {
        onUserChanged(session.user, userProfile, null);
      }
    } catch (err) {
      console.warn('[subscribeToAuthChanges] Authorization check rejected:', err.message);
      if (isSubscribed && seq === authStateSequence) {
        // Report error cleanly without triggering re-entrant signOut loop
        onUserChanged(null, null, err.message || 'Akses ditolak. Hubungi Super Admin.');
      }
    }
  };

  // 1. Initial session check on mount
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      handleSessionChange(session);
    })
    .catch((err) => {
      console.error('[subscribeToAuthChanges] Initial session check error:', err);
      if (isSubscribed) {
        onUserChanged(null, null, err.message);
      }
    });

  // 2. Listen for auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      ++authStateSequence;
      if (isSubscribed) {
        onUserChanged(null, null, null);
      }
      return;
    }

    handleSessionChange(session);
  });

  return () => {
    isSubscribed = false;
    subscription.unsubscribe();
  };
}

