import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  LogOut,
  Users,
  Building2,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

/**
 * PortalLoginV2 - Parent Portal Login Page (Fase 2.1)
 *
 * Menggunakan Supabase Auth melalui Cloudflare Pages Function V2:
 * - POST /api/portal/v2/login
 * - GET  /api/portal/v2/session
 * - POST /api/portal/v2/logout
 *
 * Prinsip Keamanan Frontend:
 * 1. Tanpa token di localStorage / sessionStorage (Session dikelola via HttpOnly cookie portal_session_v2).
 * 2. Password dihapus dari state React segera setelah pengiriman request.
 * 3. CSRF token hanya disimpan di memory React state untuk request terproteksi (seperti logout).
 * 4. Isolasi total dari Portal V1.
 */
export default function PortalLoginV2() {
  // Form input state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & error handling
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
        // Sesi tidak ada atau expired
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

    // Validasi input di sisi klien
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

      // Hapus password dari state memori segera setelah dikirim demi keamanan
      setPassword('');

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        // Simpan CSRF token ke memory state
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }

        // Ambil data user dari login response atau konfirmasi ulang sesi
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
          // Fallback verifikasi sesi via GET /api/portal/v2/session
          await checkActiveSession();
        }

        setInfoMsg('Autentikasi berhasil. Sesi portal aktif.');
      } else {
        // Pemetaan pesan kesalahan berdasarkan HTTP status code
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
            setErrorMsg(data.message || 'Terlalu banyak percobaan login dari jaringan Anda. Mohon tunggu beberapa saat sebelum mencoba kembali.');
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
      // Bersihkan password pada exception
      setPassword('');
      setErrorMsg('Gagal terhubung ke server autentikasi. Pastikan koneksi internet Anda stabil.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Menangani logout dari sesi V2
   */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const headers = {
        'Accept': 'application/json'
      };

      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch('/api/portal/v2/logout', {
        method: 'POST',
        headers,
        credentials: 'include'
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setSessionData(null);
        setCsrfToken(null);
        setEmail('');
        setPassword('');
        setInfoMsg('Anda telah berhasil keluar dari akun wali.');
      } else {
        // Tetap hapus sesi lokal jika cookie sudah invalid
        setSessionData(null);
        setCsrfToken(null);
        setInfoMsg('Sesi telah diakhiri.');
      }
    } catch (err) {
      console.error('Logout error:', err);
      // Bersihkan memori klien
      setSessionData(null);
      setCsrfToken(null);
      setInfoMsg('Sesi lokal telah dibersihkan.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 1. Tampilan Loading saat pemeriksaan sesi awal
  if (isCheckingSession) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-8 text-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white min-h-[500px]">
        <div className="w-12 h-12 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">CHUVATOR SECURITY</p>
        <p className="text-xs text-slate-400 mt-1">Memeriksa status sesi wali murid...</p>
      </div>
    );
  }

  // 2. Tampilan Konfirmasi Sesi Aktif (Jika sudah login)
  if (sessionData) {
    const childrenList = sessionData.children || [];
    const childrenCount = childrenList.length;

    return (
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 min-h-screen">
        {/* Header Sesi Aktif */}
        <div className="pt-2 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold tracking-wide mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sesi Aktif Terverifikasi (V2)</span>
          </div>

          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
            <UserCheck className="w-7 h-7" />
          </div>

          <h1 className="text-xl font-bold text-white tracking-tight">
            Portal Wali Murid
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono break-all">
            {sessionData.email}
          </p>
        </div>

        {/* Ringkasan Akun & Siswa Terhubung */}
        <div className="my-6 space-y-4">
          {/* Card Info Wali */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                Jumlah Siswa Terhubung
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {childrenCount} Siswa
              </span>
            </div>
          </div>

          {/* Daftar Siswa */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Daftar Siswa Terdaftar:
            </p>

            {childrenList.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                Belum ada data siswa yang dihubungkan ke akun ini.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {childrenList.map((child, index) => (
                  <div
                    key={child.studentId || index}
                    className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/70 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <h3 className="text-sm font-semibold text-white">
                            {child.studentName || 'Nama Siswa'}
                          </h3>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pl-6">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{child.academyName || 'Akademi Olahraga'}</span>
                          {child.className && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400">{child.className}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {child.studentId && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                          ID: {child.studentId.substring(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Integrasi Tahap 2.2 Info */}
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-200">Autentikasi Supabase Auth V2 Berhasil.</span>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                Sesi aman dikelola melalui HttpOnly Cookie. Modul Dashboard V2 lengkap akan diaktifkan pada Fase 2.2.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 pb-4 space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 active:bg-slate-800 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                <span>Mengakhiri Sesi...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Keluar dari Akun (Logout)</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 3. Tampilan Form Login V2 (Ketika belum login / sesi kosong)
  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 min-h-screen">
      {/* Top Brand & Header */}
      <div className="pt-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold tracking-wide mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Parent Portal V2 • Supabase Auth</span>
        </div>

        <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/20 mb-3">
          <GraduationCap className="w-7 h-7" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Portal Wali Murid
        </h1>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
          Masuk menggunakan email dan kata sandi akun wali untuk memantau data perkembangan anak.
        </p>
      </div>

      {/* Main Login Form */}
      <div className="my-auto py-4">
        {/* Notifikasi Alert Error */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              {errorMsg}
            </div>
          </div>
        )}

        {/* Notifikasi Info / Sukses */}
        {infoMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              {infoMsg}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          {/* Input Email */}
          <div className="space-y-1.5">
            <label htmlFor="portal-v2-email" className="block text-xs font-semibold text-slate-300">
              Email Wali Murid <span className="text-red-400">*</span>
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
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition disabled:opacity-50"
              />
            </div>
          </div>

          {/* Input Password */}
          <div className="space-y-1.5">
            <label htmlFor="portal-v2-password" className="block text-xs font-semibold text-slate-300">
              Kata Sandi <span className="text-red-400">*</span>
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
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Akun...</span>
              </>
            ) : (
              <span>Masuk ke Portal V2</span>
            )}
          </button>
        </form>

        {/* Security & Info Footer */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Koneksi Terenkripsi AES-GCM
          </span>
          <button
            type="button"
            onClick={checkActiveSession}
            className="flex items-center gap-1 hover:text-slate-200 transition text-[11px] cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Cek Sesi
          </button>
        </div>
      </div>

      {/* Brand Footer */}
      <div className="pt-2 pb-4 text-center">
        <p className="text-[11px] text-slate-400">
          CHUVATOR Sports Academy ERP System
        </p>
      </div>
    </div>
  );
}
