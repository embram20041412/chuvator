import { supabase } from '../config/supabase';

export const SUPER_ADMIN_EMAIL = 'erizamaulana.bramantya@gmail.com';

/**
 * Validates Supabase user email & ID against authorization rules (Strict Invite-Only Enforcement):
 * 1. Super Admin -> 'superadmin' (erizamaulana.bramantya@gmail.com)
 * 2. Check Supabase `users_staff` -> 'admin' / 'pelatih' / 'kasir'
 * 3. Check Supabase `tenants` -> Existing Tenant Owner (direct to Dashboard)
 * 4. Check Supabase `invitations` -> Invited user (allowed to access Onboarding)
 * 5. Uninvited user -> Blocked & auto sign-out
 */
export async function verifyUserRoleAndTenant(user) {
  if (!user) {
    throw new Error('User tidak valid.');
  }

  const userId = user.id || user.uid;
  const normalizedEmail = user.email ? user.email.toLowerCase().trim() : '';
  const meta = user.user_metadata || {};
  const photoURL = user.photoURL || meta.avatar_url || meta.picture || null;
  const displayName = user.displayName || meta.full_name || meta.name || user.email?.split('@')[0] || 'User';

  // 1. Check if Super Admin
  if (normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
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

  // 2. Check if user exists in Supabase `users_staff` by UID/ID or email
  try {
    let staffData = null;
    if (userId) {
      const { data: staffByUid } = await supabase
        .from('users_staff')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (staffByUid) staffData = staffByUid;
    }

    if (!staffData && normalizedEmail) {
      const { data: staffByEmail } = await supabase
        .from('users_staff')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (staffByEmail) staffData = staffByEmail;
    }

    if (staffData) {
      let tenantData = null;
      if (staffData.tenant_id) {
        try {
          const { data: tRow } = await supabase
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
    const { data: directTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (directTenant) {
      tenantData = directTenant;
      tenantId = directTenant.id;
    } else if (normalizedEmail) {
      const { data: tenantByEmail } = await supabase
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
      const { data: invRow } = await supabase
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

  // 5. IF NOT IN invitations, NOT IN tenants, AND NOT IN users_staff: STRICT FAIL-CLOSED ACCESS DENIED!
  await supabase.auth.signOut();
  const uninvitedErr = new Error(
    `Akses Ditolak: Email Anda (${user.email || 'tanpa email'}) belum terdaftar dalam daftar undangan resmi CHUA SPORT CORE. Silakan hubungi Administrator Sistem untuk mendapatkan akses.`
  );
  uninvitedErr.code = 'UNAUTHORIZED_EMAIL';
  throw uninvitedErr;
}

export const supabaseAuthService = {
  async loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true, // Cegah redirect otomatis
      }
    });

    if (error) throw error;

    if (data?.url) {
      const oauthUrl = new URL(data.url);
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vKzNAXC9V52eYH0-Gm9Rcg_23lCtz2P';
      oauthUrl.searchParams.set('apikey', anonKey);

      window.location.href = oauthUrl.toString();
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
    const userProfile = await verifyUserRoleAndTenant(data.user);
    return userProfile;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
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
 * Sign out current user from Supabase
 */
export async function logoutUser() {
  try {
    localStorage.removeItem('demo_user_profile');
  } catch (e) {}
  await supabaseAuthService.logout();
}

/**
 * Subscribe to Supabase auth state changes and verify authorization
 */
export function subscribeToAuthChanges(onUserChanged) {
  // First, check current session on init
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session?.user) {
      try {
        const userProfile = await verifyUserRoleAndTenant(session.user);
        onUserChanged(session.user, userProfile);
      } catch (err) {
        console.warn('Initial session user verification failed:', err.message);
        onUserChanged(null, null, err.message);
      }
    } else {
      onUserChanged(null, null);
    }
  }).catch((err) => {
    console.error('Error fetching initial Supabase auth session:', err);
    onUserChanged(null, null);
  });

  // Listen for auth state changes (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      try {
        const userProfile = await verifyUserRoleAndTenant(session.user);
        onUserChanged(session.user, userProfile);
      } catch (error) {
        console.error('Auth verification failed during auth state change:', error.message);
        onUserChanged(null, null, error.message || 'Akses ditolak. Hubungi Super Admin.');
      }
    } else {
      onUserChanged(null, null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}
