import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { initInvitationSessionCallback } from '../../utils/portalAuthCallback.js';
import {
  ShieldCheck,
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  ChevronRight
} from 'lucide-react';

/**
 * PortalAcceptInvitation - Page for parents to set their first password
 * after clicking the invitation link.
 */
export default function PortalAcceptInvitation() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isVerifying, setIsVerifying] = useState(true);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const sessionReceivedRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const { cleanup } = initInvitationSessionCallback({
      supabaseClient: supabase,
      locationObj: typeof window !== 'undefined' ? window.location : null,
      onSuccess: (activeSession, activeUser) => {
        setSession(activeSession);
        setUser(activeUser);
        setErrorMsg(null);
        setIsVerifying(false);
      },
      onError: (errMsg) => {
        setErrorMsg(errMsg);
        setIsVerifying(false);
      },
      timeoutMs: 5000,
      sessionReceivedRef,
      timeoutRef
    });

    return () => {
      cleanup();
    };
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validations
    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal harus 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setErrorMsg(`Gagal memperbarui kata sandi: ${updateError.message}`);
        setIsLoading(false);
        return;
      }

      setSuccessMsg('Kata sandi berhasil dikonfigurasi. Menyiapkan sesi portal...');

      // 2. Establish Parent Portal V2 Session via Backend
      // We use the existing login endpoint with the newly set password
      const loginResponse = await fetch('/api/portal/v2/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          password: password
        })
      });

      const loginData = await loginResponse.json().catch(() => ({}));

      if (loginResponse.ok && loginData.success) {
        setSuccessMsg('Aktivasi sukses! Mengalihkan ke dashboard...');
        // Clear Supabase local session to rely on V2 cookie only (optional but safer)
        await supabase.auth.signOut();
        
        // Short delay for user to read success
        setTimeout(() => {
          navigate('/portal/dashboard', { replace: true });
        }, 1500);
      } else {
        setErrorMsg(loginData.message || 'Berhasil update password, namun gagal membuat sesi portal. Silakan coba login manual.');
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan sistem saat memproses aktivasi.');
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-8 text-center bg-slate-50 min-h-[500px]">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">MEMVERIFIKASI UNDANGAN</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 sm:p-8 bg-slate-50 text-slate-900 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[11px] font-bold tracking-wide mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Portal Wali Murid • Aktivasi Akun</span>
        </div>

        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
          <GraduationCap className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Selamat Datang!
        </h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
          Silakan buat kata sandi baru untuk mengaktifkan akses Anda ke portal wali murid.
        </p>
      </div>

      <div className="max-w-sm mx-auto w-full">
        {/* Email Info Card */}
        {user && (
          <div className="mb-6 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-500">
              <Mail className="w-5 h-5" />
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Akun</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{user.email}</p>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1 leading-relaxed font-medium">
              {errorMsg}
              {errorMsg.includes('kedaluwarsa') && (
                <button 
                  onClick={() => navigate('/portal')}
                  className="block mt-2 font-bold text-red-800 underline underline-offset-2"
                >
                  Kembali ke Halaman Login
                </button>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="flex-1 leading-relaxed font-medium">
              {successMsg}
            </div>
          </div>
        )}

        {/* Password Form */}
        {!successMsg && user && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-500 uppercase px-1">Kata Sandi Baru</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-500 uppercase px-1">Konfirmasi Kata Sandi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  disabled={isLoading}
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword}
              className="w-full mt-6 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:shadow-none cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Aktivasi...</span>
                </>
              ) : (
                <>
                  <span>Aktifkan Akun Sekarang</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto py-6 text-center">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
          Powered by CHUVATOR Sports CORE
        </p>
      </div>
    </div>
  );
}
