/**
 * Handles Supabase invitation callback lifecycle:
 * - Detects URL errors without double-decoding
 * - Synchronously tracks session arrival via sessionReceivedRef to prevent race conditions
 * - Cancels callback timeout as soon as a valid session arrives
 * - Validates role 'parent'
 * - Cleans up timeout and subscription on unmount
 */
export function initInvitationSessionCallback({
  supabaseClient,
  locationObj = typeof window !== 'undefined' ? window.location : null,
  onSuccess,
  onError,
  timeoutMs = 1500,
  sessionReceivedRef = { current: false },
  timeoutRef = { current: null }
}) {
  let isMounted = true;

  const clearTimeoutSafe = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // 1. Check for explicit error parameters in URL (hash or query) without double decoding
  if (locationObj) {
    const hashStr = String(locationObj.hash || '').replace(/^#/, '');
    const searchStr = String(locationObj.search || '').replace(/^\?/, '');
    const hashParams = new URLSearchParams(hashStr);
    const searchParams = new URLSearchParams(searchStr);
    const rawError = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error') || searchParams.get('error');

    if (rawError) {
      clearTimeoutSafe();
      sessionReceivedRef.current = false;
      onError(`Tautan undangan tidak valid atau telah kedaluwarsa: ${rawError}`);
      return {
        cleanup: () => {
          isMounted = false;
          clearTimeoutSafe();
        }
      };
    }
  }

  // 2. Helper to validate user role & handle valid session
  const processSession = (currentSession) => {
    if (!isMounted) return;
    if (!currentSession) {
      if (!sessionReceivedRef.current) {
        clearTimeoutSafe();
        onError('Tautan undangan tidak valid atau telah kedaluwarsa. Silakan hubungi pengelola akademi.');
      }
      return;
    }

    const currentUser = currentSession.user;
    if (currentUser?.user_metadata?.role !== 'parent') {
      clearTimeoutSafe();
      sessionReceivedRef.current = false;
      onError('Akses ditolak. Akun ini bukan merupakan akun wali murid yang diizinkan.');
      return;
    }

    // Mark session received synchronously and cancel any pending timeout
    sessionReceivedRef.current = true;
    clearTimeoutSafe();
    onSuccess(currentSession, currentUser);
  };

  // 3. Subscribe to onAuthStateChange
  let subscription = null;
  if (supabaseClient?.auth?.onAuthStateChange) {
    const authStateRes = supabaseClient.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;
      if (currentSession) {
        processSession(currentSession);
      } else if (event === 'SIGNED_OUT') {
        if (!sessionReceivedRef.current) {
          clearTimeoutSafe();
          onError('Tautan undangan tidak valid atau telah kedaluwarsa. Silakan hubungi pengelola akademi.');
        }
      }
    });
    subscription = authStateRes?.data?.subscription || null;
  }

  // 4. Initial check for Supabase session with timeout tolerance
  const checkSession = async () => {
    try {
      if (!supabaseClient?.auth?.getSession) return;
      const { data: { session: currentSession } = {}, error } = await supabaseClient.auth.getSession();
      if (!isMounted) return;

      if (error) {
        if (!sessionReceivedRef.current) {
          clearTimeoutSafe();
          onError('Tautan undangan tidak valid atau telah kedaluwarsa. Silakan hubungi pengelola akademi.');
        }
        return;
      }

      if (currentSession) {
        processSession(currentSession);
      } else {
        // If session is already received via onAuthStateChange, do not start timeout or overwrite
        if (sessionReceivedRef.current) return;

        const hasUrlToken = locationObj &&
          (String(locationObj.hash || '').includes('access_token=') || String(locationObj.search || '').includes('code='));

        if (!hasUrlToken) {
          clearTimeoutSafe();
          onError('Tautan undangan tidak valid atau telah kedaluwarsa. Silakan hubungi pengelola akademi.');
        } else {
          // Ongoing URL callback parsing: set timeout
          clearTimeoutSafe();
          timeoutRef.current = setTimeout(() => {
            if (isMounted && !sessionReceivedRef.current) {
              onError('Tautan undangan tidak valid atau telah kedaluwarsa. Silakan hubungi pengelola akademi.');
            }
          }, timeoutMs);
        }
      }
    } catch (err) {
      if (isMounted && !sessionReceivedRef.current) {
        clearTimeoutSafe();
        onError('Terjadi kesalahan saat memverifikasi tautan.');
      }
    }
  };

  checkSession();

  return {
    cleanup: () => {
      isMounted = false;
      clearTimeoutSafe();
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    }
  };
}
