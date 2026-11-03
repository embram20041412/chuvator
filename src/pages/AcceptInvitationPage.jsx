import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Lock, 
  Mail, 
  ArrowRight, 
  Building2, 
  UserCheck, 
  LogOut,
  RefreshCw,
  Sparkles,
  KeyRound,
  Info
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { logoutUser } from '../services/authService';
import { getInvitationInfo, claimStaffInvitation } from '../services/staffService';

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || searchParams.get('t') || '';

  // Invitation info state
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [invitation, setInvitation] = useState(null); // { is_valid, tenant_id, tenant_name, masked_email, invite_role, expires_at, message }
  const [errorMsg, setErrorMsg] = useState(null);

  // Current Auth User state
  const [currentUser, setCurrentUser] = useState(null);
  
  // Auth Modes: 'login' | 'signup' | 'forgot' | 'update_password'
  const [authMode, setAuthMode] = useState('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccessNotice, setAuthSuccessNotice] = useState(null);

  // Claiming state
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Detect password reset flow from URL (?reset=1 or hash fragment)
  useEffect(() => {
    const isReset = searchParams.get('reset') === '1' || window.location.hash.includes('type=recovery');
    if (isReset) {
      setAuthMode('update_password');
    }
  }, [searchParams]);

  // 1. Fetch info undangan via RPC get_invitation_info
  useEffect(() => {
    async function loadInfo() {
      if (!token.trim()) {
        setErrorMsg('Token undangan tidak ditemukan. Pastikan Anda mengklik tautan lengkap.');
        setLoadingInfo(false);
        return;
      }

      setLoadingInfo(true);
      setErrorMsg(null);
      try {
        const info = await getInvitationInfo(token.trim());
        if (!info || info.is_valid === false) {
          setErrorMsg(info?.message || 'Undangan tidak ditemukan atau token tidak valid.');
          setInvitation(null);
        } else {
          setInvitation(info);
        }
      } catch (err) {
        console.error('[AcceptInvitationPage] Error loading info:', err);
        setErrorMsg(err.message || 'Gagal memverifikasi token undangan.');
      } finally {
        setLoadingInfo(false);
      }
    }

    loadInfo();
  }, [token]);

  // 2. Track Supabase Auth session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 3. Handler Sign In
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    
    if (!cleanEmail || !passwordInput) {
      setAuthError('Alamat email dan kata sandi wajib diisi.');
      return;
    }

    setAuthError(null);
    setAuthSuccessNotice(null);
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordInput,
      });

      if (error) {
        // Task 3: Penanganan 'Invalid login credentials' secara spesifik
        if (
          error.message?.toLowerCase().includes('invalid login credentials') ||
          error.status === 400
        ) {
          setAuthError('Email atau kata sandi tidak cocok. Jika Anda lupa kata sandi akun ini, silakan gunakan fitur "Lupa Password" di bawah.');
          return;
        }
        throw error;
      }

      setCurrentUser(data.user);
      setAuthSuccessNotice(`Berhasil masuk sebagai ${data.user.email}! Silakan klik tombol "Klaim Undangan" di bawah untuk mengaktifkan akses.`);
    } catch (err) {
      console.error('[AcceptInvitationPage] Login error:', err);
      setAuthError(err.message || 'Gagal masuk. Periksa email dan kata sandi Anda.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 4. Handler Sign Up
  const handleSignUp = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    
    if (!cleanEmail || !passwordInput) {
      setAuthError('Alamat email dan kata sandi wajib diisi.');
      return;
    }

    if (passwordInput.length < 6) {
      setAuthError('Kata sandi minimal 6 karakter.');
      return;
    }

    setAuthError(null);
    setAuthSuccessNotice(null);
    setAuthLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`;
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: passwordInput,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            role: invitation?.invite_role || 'staff',
            invited_tenant_id: invitation?.tenant_id,
          },
        },
      });

      if (error) {
        // Task 4: Penanganan 'User already registered' / 422
        if (
          error.message?.toLowerCase().includes('already registered') ||
          error.message?.toLowerCase().includes('already exists') ||
          error.status === 422
        ) {
          setAuthMode('login');
          setAuthError(
            `Email "${cleanEmail}" sudah terdaftar di sistem. Silakan masuk menggunakan kata sandi Anda di bawah ini, atau gunakan tombol "Lupa Password" jika lupa kata sandi.`
          );
          return;
        }
        throw error;
      }

      if (data.session) {
        setCurrentUser(data.user);
        setAuthSuccessNotice('Pendaftaran akun berhasil! Anda telah masuk otomatis. Silakan klaim undangan di bawah.');
      } else {
        setAuthSuccessNotice(
          'Pendaftaran akun berhasil! Tautan konfirmasi telah dikirim ke email Anda. Silakan verifikasi email Anda, lalu buka kembali tautan undangan untuk mengklaim akun.'
        );
      }
    } catch (err) {
      console.error('[AcceptInvitationPage] Sign up error:', err);
      setAuthError(err.message || 'Gagal mendaftar akun baru.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 5. Handler Forgot Password (resetPasswordForEmail)
  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();

    if (!cleanEmail) {
      setAuthError('Masukkan alamat email Anda terlebih dahulu.');
      return;
    }

    setAuthError(null);
    setAuthSuccessNotice(null);
    setAuthLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}&reset=1`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setAuthSuccessNotice(
        `Tautan pemulihan kata sandi telah dikirim ke email ${cleanEmail}. Silakan periksa kotak masuk (atau folder spam), buka tautan tersebut untuk memperbarui kata sandi, lalu klaim undangan Anda.`
      );
    } catch (err) {
      console.error('[AcceptInvitationPage] Reset password error:', err);
      setAuthError(err.message || 'Gagal mengirim email reset password.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 6. Handler Update Password (after arriving from reset link)
  const handleUpdatePassword = async (e) => {
    if (e) e.preventDefault();
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setAuthError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    setAuthError(null);
    setAuthSuccessNotice(null);
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPasswordInput,
      });

      if (error) throw error;

      setCurrentUser(data.user);
      setAuthMode('login');
      setAuthSuccessNotice('Kata sandi Anda berhasil diperbarui! Silakan klik tombol "Klaim Undangan" di bawah.');
    } catch (err) {
      console.error('[AcceptInvitationPage] Update password error:', err);
      setAuthError(err.message || 'Gagal memperbarui kata sandi.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 7. Handler Klaim Undangan via RPC claim_staff_invitation
  const handleClaim = async () => {
    if (!token.trim()) {
      setErrorMsg('Token undangan tidak valid atau kosong.');
      return;
    }

    if (!currentUser) {
      setErrorMsg('Anda harus masuk atau mendaftar akun terlebih dahulu sebelum mengklaim undangan.');
      return;
    }

    setClaiming(true);
    setErrorMsg(null);

    try {
      await claimStaffInvitation(token.trim());
      setClaimSuccess(true);

      // Redirect berdasarkan role setelah klaim berhasil
      setTimeout(() => {
        const role = (invitation?.invite_role || '').toLowerCase();
        if (role === 'coach' || role === 'pelatih') {
          navigate('/akademi', { replace: true });
        } else if (role === 'kasir') {
          navigate('/kasir', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 2000);
    } catch (err) {
      console.error('[AcceptInvitationPage] Claim error:', err);
      setErrorMsg(err.message || 'Gagal mengklaim undangan. Pastikan email Anda cocok dan telah diverifikasi.');
    } finally {
      setClaiming(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setAuthSuccessNotice(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setErrorMsg('Gagal keluar dari sesi: ' + (err.message || 'Terjadi kesalahan jaringan'));
    }
  };

  const roleLabels = {
    admin: 'Admin Cabang Operasional',
    kasir: 'Kasir & Layanan POS',
    coach: 'Pelatih / Coach Akademi',
    staff: 'Staf Operasional',
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg space-y-6 text-left">
        
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Penerimaan Undangan Resmi • CHUVATOR</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white pt-2">
            Aktivasi Akses Staf
          </h1>
          <p className="text-xs text-slate-400">
            Sistem otorisasi multi-tenant dengan verifikasi kriptografi PostgreSQL RLS.
          </p>
        </div>

        {/* State 1: Loading Info Undangan */}
        {loadingInfo && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-xs font-medium text-slate-300">Memverifikasi token undangan di database...</p>
          </div>
        )}

        {/* State 2: Undangan Tidak Valid / Error */}
        {!loadingInfo && errorMsg && !invitation && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-red-200">Undangan Tidak Dapat Digunakan</h2>
              <p className="text-xs text-red-300/80 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
              >
                <span>Ke Halaman Masuk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* State 3: Klaim Berhasil */}
        {claimSuccess && (
          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-8 text-center space-y-4 animate-fadeIn">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-emerald-100">Undangan Berhasil Diklaim!</h2>
              <p className="text-xs text-emerald-200/80">
                Akun Anda telah resmi terikat ke tenant <strong>{invitation?.tenant_name}</strong> sebagai{' '}
                <strong>{invitation?.invite_role?.toUpperCase()}</strong>.
              </p>
            </div>
            <p className="text-[11px] text-slate-400 animate-pulse">Mengalihkan ke modul kerja Anda...</p>
          </div>
        )}

        {/* State 4: Undangan Valid & Siap Diklaim */}
        {!loadingInfo && invitation && !claimSuccess && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-7 shadow-xl space-y-6">
            
            {/* Info Tenant & Peran */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Arena / Tenant</span>
                </span>
                <span className="text-xs font-bold text-white">{invitation.tenant_name}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Peran Ditugaskan</span>
                </span>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-bold text-xs rounded uppercase border border-blue-500/30">
                  {roleLabels[invitation.invite_role] || invitation.invite_role}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Email Terdaftar</span>
                </span>
                <span className="text-xs font-mono text-amber-300">{invitation.masked_email}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Berlaku hingga</span>
                </span>
                <span>
                  {new Date(invitation.expires_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Bagian A: Pengguna Sudah Login */}
            {currentUser ? (
              <div className="space-y-4 pt-2">
                <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Masuk sebagai:</span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-red-400 hover:text-red-300 font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Ganti Akun</span>
                    </button>
                  </div>
                  <p className="font-mono font-bold text-white">{currentUser.email}</p>
                </div>

                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {claiming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Mengklaim &amp; Mengikat Auth UID...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Klaim Undangan &amp; Masuk ke Sistem</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Bagian B: Form Otentikasi */
              <div className="space-y-4 pt-2">
                
                {/* Tab Switcher: Login | Signup | Forgot */}
                {authMode !== 'update_password' && (
                  <div className="flex border-b border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); setAuthError(null); setAuthSuccessNotice(null); }}
                      className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                        authMode === 'login'
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      1. Masuk Akun
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAuthMode('signup'); setAuthError(null); setAuthSuccessNotice(null); }}
                      className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                        authMode === 'signup'
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      2. Buat Akun Baru
                    </button>
                  </div>
                )}

                {/* Notifikasi Error Otentikasi */}
                {authError && (
                  <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{authError}</span>
                  </div>
                )}

                {/* Notifikasi Sukses / Petunjuk */}
                {authSuccessNotice && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-xl text-xs flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{authSuccessNotice}</span>
                  </div>
                )}

                {/* MODE 1: LOGIN AKUN TERDAFTAR */}
                {authMode === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="p-2.5 bg-blue-950/30 border border-blue-800/40 rounded-xl text-[11px] text-blue-200 flex items-start space-x-2">
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Jika email Anda sudah pernah terdaftar di CHUVATOR, gunakan formulir ini untuk masuk.</span>
                    </div>

                    <div>
                      <label htmlFor="invite-auth-email" className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Alamat Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          id="invite-auth-email"
                          name="email"
                          type="email"
                          autoComplete="username"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="staf@email.com"
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="invite-auth-password" className="block text-[11px] font-bold text-slate-300 uppercase">
                          Kata Sandi
                        </label>
                        <button
                          type="button"
                          onClick={() => { setAuthMode('forgot'); setAuthError(null); setAuthSuccessNotice(null); }}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
                        >
                          Lupa Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          id="invite-auth-password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          minLength={6}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Kata sandi akun Anda"
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses Otentikasi...</span>
                        </>
                      ) : (
                        <>
                          <span>Masuk &amp; Lanjutkan</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* MODE 2: BUAT AKUN BARU */}
                {authMode === 'signup' && (
                  <form onSubmit={handleSignUp} className="space-y-3">
                    <div className="p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-xl text-[11px] text-slate-300 flex items-start space-x-2">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Gunakan formulir ini hanya jika Anda belum pernah memiliki akun di sistem CHUVATOR.</span>
                    </div>

                    <div>
                      <label htmlFor="invite-signup-email" className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Alamat Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          id="invite-signup-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="staf@email.com"
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="invite-signup-password" className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Buat Kata Sandi Baru
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          id="invite-signup-password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={6}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Minimal 6 karakter"
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Mendaftarkan Akun...</span>
                        </>
                      ) : (
                        <>
                          <span>Daftar &amp; Konfirmasi</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* MODE 3: LUPA PASSWORD / RESET PASSWORD EMAIL */}
                {authMode === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-3">
                    <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-200 flex items-start space-x-2">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>Masukkan email terdaftar Anda untuk menerima tautan pemulihan kata sandi Supabase Auth.</span>
                    </div>

                    <div>
                      <label htmlFor="invite-forgot-email" className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Alamat Email Akun
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          id="invite-forgot-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="staf@email.com"
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => { setAuthMode('login'); setAuthError(null); }}
                        className="text-xs text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
                      >
                        &larr; Kembali ke Masuk
                      </button>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mengirim...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Kirim Tautan Reset</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* MODE 4: ATUR KATA SANDI BARU (SETELAH KLIK TAUTAN RESET PASSWORD) */}
                {authMode === 'update_password' && (
                  <form onSubmit={handleUpdatePassword} className="space-y-3">
                    <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-[11px] text-emerald-200 flex items-start space-x-2">
                      <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Anda membuka tautan pemulihan kata sandi. Silakan masukkan kata sandi baru Anda di bawah.</span>
                    </div>

                    <div>
                      <label htmlFor="invite-new-password" className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Kata Sandi Baru
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          id="invite-new-password"
                          name="newPassword"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={6}
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder="Minimal 6 karakter"
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Memperbarui Kata Sandi...</span>
                        </>
                      ) : (
                        <>
                          <span>Simpan Kata Sandi Baru</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
