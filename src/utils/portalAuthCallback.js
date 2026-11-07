/**
 * Handles Supabase invitation & recovery callback lifecycle:
 * - Detects URL errors without double-decoding
 * - Supports both invite and recovery callback flows for parent role
 * - Detects auth callback URL indicators (access_token, refresh_token, code, type=recovery, type=invite, token)
 * - Tolerates delayed async session recovery without premature timeout failures
 * - Synchronously tracks session arrival via sessionReceivedRef to prevent race conditions
 * - Prevents duplicate onSuccess calls for the same session key via processedSessionKeyRef
 * - Prevents late getSession() results from overwriting active sessions
 * - Cancels callback timeout as soon as a valid session arrives
 * - Validates role 'parent' (from user_metadata or app_metadata)
 * - Cleans up timeout and subscription on unmount
 * - NO logging of tokens, credentials, or hashes
 */
export function initInvitationSessionCallback({
  supabaseClient,
  locationObj = typeof window !== 'undefined' ? window.location : null,
  onSuccess,
  onError,
  timeoutMs = 5000,
  sessionReceivedRef = { current: false },
  processedSessionKeyRef = { current: null },
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

  // Extract role safely from user_metadata or app_metadata
  const getUserRole = (user) => {
    if (!user) return null;
    return user.user_metadata?.role || user.app_metadata?.role || null;
  };

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

    const sessionKey = currentSession.access_token || currentSession.user?.id || 'valid_session';

    // Prevent duplicate onSuccess execution for the exact same session
    if (sessionReceivedRef.current && processedSessionKeyRef.current === sessionKey) {
      clearTimeoutSafe();
      return;
    }

    const currentUser = currentSession.user;
    const userRole = getUserRole(currentUser);

    if (userRole !== 'parent') {
      clearTimeoutSafe();
      sessionReceivedRef.current = false;
      onError('Akses ditolak. Akun ini bukan merupakan akun wali murid yang diizinkan.');
      return;
    }

    // Mark session received synchronously and cancel any pending timeout
    sessionReceivedRef.current = true;
    processedSessionKeyRef.current = sessionKey;
    clearTimeoutSafe();
    onSuccess(currentSession, currentUser);
  };

  // 3. Subscribe to onAuthStateChange for all auth events (SIGNED_IN, INITIAL_SESSION, PASSWORD_RECOVERY, USER_UPDATED, TOKEN_REFRESHED)
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

        const hashStr = String(locationObj?.hash || '');
        const searchStr = String(locationObj?.search || '');
        const hasUrlToken = locationObj && (
          hashStr.includes('access_token=') ||
          hashStr.includes('refresh_token=') ||
          hashStr.includes('code=') ||
          hashStr.includes('type=recovery') ||
          hashStr.includes('type=invite') ||
          searchStr.includes('access_token=') ||
          searchStr.includes('refresh_token=') ||
          searchStr.includes('code=') ||
          searchStr.includes('type=recovery') ||
          searchStr.includes('type=invite') ||
          searchStr.includes('token=')
        );

        if (!hasUrlToken) {
          clearTimeoutSafe();
          if (!sessionReceivedRef.current) {
            onError('Tautan undangan tidak valid atau telah kedaluwarsa. Silakan hubungi pengelola akademi.');
          }
        } else {
          // Ongoing URL callback parsing: set timeout to allow async session parsing to complete
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
