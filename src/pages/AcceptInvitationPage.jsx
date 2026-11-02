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
  Sparkles
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { logoutUser } from '../services/authService';
import { getInvitationInfo, claimStaffInvitation } from '../services/staffService';

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  // Invitation info state
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [invitation, setInvitation] = useState(null); // { is_valid, tenant_id, tenant_name, masked_email, invite_role, expires_at, message }
  const [errorMsg, setErrorMsg] = useState(null);

  // Current Auth User state
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccessNotice, setAuthSuccessNotice] = useState(null);

  // Claiming state
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

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
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim().toLowerCase(),
        password: passwordInput,
      });

      if (error) throw error;
      setCurrentUser(data.user);
    } catch (err) {
      console.error('[AcceptInvitationPage] Login error:', err);
      setAuthError(err.message || 'Gagal masuk. Periksa email dan kata sandi Anda.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 4. Handler Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessNotice(null);
    setAuthLoading(true);

    try {
      const cleanEmail = emailInput.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: passwordInput,
        options: {
          data: {
            role: invitation?.invite_role || 'staff',
            invited_tenant_id: invitation?.tenant_id,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        setCurrentUser(data.user);
      } else {
        setAuthSuccessNotice(
          'Pendaftaran akun berhasil! Silakan periksa kotak masuk email Anda dan klik tautan verifikasi sebelum mengklaim undangan.'
        );
      }
    } catch (err) {
      console.error('[AcceptInvitationPage] Sign up error:', err);
      setAuthError(err.message || 'Gagal mendaftar akun baru.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 5. Handler Klaim Undangan via RPC claim_staff_invitation
  const handleClaim = async () => {
    if (!token.trim()) return;
    setClaiming(true);
    setErrorMsg(null);

    try {
      await claimStaffInvitation(token.trim());
      setClaimSuccess(true);

      // Redirect setelah sukses
      setTimeout(() => {
        const role = (invitation?.invite_role || '').toLowerCase();
        if (role === 'coach' || role === 'pelatih') {
          navigate('/akademi');
        } else {
          navigate('/dashboard');
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
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    setCurrentUser(null);
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
              /* Bagian B: Pengguna Belum Login -> Form Otentikasi */
              <div className="space-y-4 pt-2">
                <div className="flex border-b border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthError(null); }}
                    className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                      authMode === 'login'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1. Masuk Akun yang Ada
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                    className={`flex-1 py-2 font-bold transition border-b-2 cursor-pointer ${
                      authMode === 'signup'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    2. Buat Akun Baru
                  </button>
                </div>

                {authError && (
                  <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {authSuccessNotice && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-xl text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{authSuccessNotice}</span>
                  </div>
                )}

                <form onSubmit={authMode === 'login' ? handleLogin : handleSignUp} className="space-y-3">
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
                    <label htmlFor="invite-auth-password" className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        id="invite-auth-password"
                        name="password"
                        type="password"
                        autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
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
                        <span>Memproses Otentikasi...</span>
                      </>
                    ) : (
                      <>
                        <span>{authMode === 'login' ? 'Masuk & Lanjutkan' : 'Daftar & Konfirmasi'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
