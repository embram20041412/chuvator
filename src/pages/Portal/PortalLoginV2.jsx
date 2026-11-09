import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

/**
 * PortalLoginV2 - Parent Portal Login Page (Centered Single Column Light Theme)
 *
 * Menggunakan Supabase Auth melalui Cloudflare Pages Function V2:
 * - POST /api/portal/v2/login
 * - GET  /api/portal/v2/session
 * - POST /api/portal/v2/logout
 */
export default function PortalLoginV2() {
  const navigate = useNavigate();
  // Form input state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & error handling
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);

  // Authenticated state (kept strictly in React memory)
  const [sessionData, setSessionData] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);

  /**
   * Memeriksa sesi aktif ke backend V2
   */
  const checkActiveSession = useCallback(async () => {
    setIsCheckingSession(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/portal/v2/session', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.authenticated && data.session) {
        setSessionData(data.session);
        if (data.session.csrfToken) {
          setCsrfToken(data.session.csrfToken);
        }
      } else {
        setSessionData(null);
        setCsrfToken(null);
      }
    } catch (err) {
      console.warn('Gagal memverifikasi sesi portal v2:', err);
      setSessionData(null);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  // Cek sesi saat komponen pertama kali dimuat
  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  /**
   * Menangani submit form login V2
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail) {
      setErrorMsg('Alamat email wajib diisi.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Format alamat email tidak valid.');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('Kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/portal/v2/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword
        })
      });

      setPassword('');
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }

        if (data.user) {
          setSessionData({
            authUserId: data.user.authUserId,
            email: data.user.email,
            accessibleTenants: data.user.accessibleTenants || [],
            children: data.user.children || [],
            csrfToken: data.csrfToken || null,
            expiresAt: data.expiresAt
          });
        } else {
          await checkActiveSession();
        }

        setInfoMsg('Autentikasi berhasil. Mengalihkan ke dashboard...');
        navigate('/portal/dashboard', { replace: true });
      } else {
        switch (response.status) {
          case 400:
            setErrorMsg(data.message || 'Permintaan tidak valid. Mohon periksa kembali input Anda.');
            break;
          case 401:
            setErrorMsg(data.message || 'Email atau kata sandi tidak sesuai.');
            break;
          case 403:
            setErrorMsg(data.message || 'Akun Anda belum terdaftar atau belum dihubungkan dengan data siswa oleh pihak pengelola.');
            break;
          case 429:
            setErrorMsg(data.message || 'Terlalu banyak percobaan login dari jaringan Anda. Mohon tunggu beberapa saat.');
            break;
          case 500:
          case 503:
            setErrorMsg(data.message || 'Layanan autentikasi sedang mengalami kendala. Silakan coba beberapa saat lagi.');
            break;
          default:
            setErrorMsg(data.message || 'Terjadi kesalahan saat memproses login. Silakan coba kembali.');
            break;
        }
      }
    } catch (err) {
      console.error('Portal v2 login request failed:', err);
      setPassword('');
      setErrorMsg('Gagal terhubung ke server autentikasi. Pastikan koneksi internet Anda stabil.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Tampilan Loading saat pemeriksaan sesi awal (Light Theme)
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-8 text-center text-slate-800">
        <div className="w-12 h-12 border-3 border-emerald-200 border-t-emerald-800 rounded-full animate-spin mb-4" />
        <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">CHUVATOR SECURITY</p>
        <p className="text-xs text-slate-500 mt-1">Memeriksa status sesi wali murid...</p>
      </div>
    );
  }

  // 2. Jika sudah ada sesi aktif V2, alihkan secara otomatis ke Dashboard V2
  if (sessionData) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  // 3. Tampilan Light Theme Single-Column Centered Layout
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-2 sm:p-6 font-sans text-slate-800">
      <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-5 sm:p-10 flex flex-col justify-between">
        
        {/* Header Brand (Centered) */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>PORTAL WALI MURID V2</span>
          </div>

          <div className="w-14 h-14 bg-emerald-800 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-900/20 my-1">
            <GraduationCap className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Portal Wali Murid
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Akademi Olahraga CHUVATOR
            </p>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed pt-1 max-w-xs">
            Masuk menggunakan email dan kata sandi akun wali untuk memantau data perkembangan atlet.
          </p>
        </div>

        {/* Form Login Body */}
        <div className="my-6">
          {/* Notifikasi Alert Error */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium text-left">
                {errorMsg}
              </div>
            </div>
          )}

          {/* Notifikasi Info / Sukses */}
          {infoMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium text-left">
                {infoMsg}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Input Email */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="portal-v2-email" className="block text-xs font-bold text-slate-700">
                Email Wali Murid <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="portal-v2-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="nama@email.com"
                  disabled={isLoading}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition disabled:opacity-50 shadow-2xs font-medium"
                />
              </div>
            </div>

            {/* Input Password */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="portal-v2-password" className="block text-xs font-bold text-slate-700">
                Kata Sandi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="portal-v2-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Masukkan kata sandi akun"
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition disabled:opacity-50 shadow-2xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button (Hijau / Emerald Dark) */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-900/20 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <span>Masuk ke Portal Wali</span>
              )}
            </button>
          </form>
        </div>

        {/* Security & Info Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5 text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            Koneksi Terenkripsi 256-bit AES
          </span>
          <button
            type="button"
            onClick={checkActiveSession}
            className="flex items-center gap-1 hover:text-emerald-800 transition cursor-pointer text-slate-500"
          >
            <RefreshCw className="w-3 h-3" />
            Cek Sesi
          </button>
        </div>
      </div>
    </div>
  );
}
