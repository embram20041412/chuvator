import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabaseAuthService } from '../services/supabaseAuthService';
import { AlertCircle, Lock, Mail, UserCheck, ShieldCheck, GraduationCap } from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('email'); // 'email' atau 'google'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Email & Password Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await supabaseAuthService.loginWithGoogle();
      // Supabase OAuth redirect will occur automatically
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      if (err.message && (err.message.includes('Akses Ditolak') || err.message.includes('Akses ditolak'))) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err.message || 'Gagal masuk dengan Google. Silakan coba lagi.');
      }
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Silakan isi email dan kata sandi Anda.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const userProfile = await supabaseAuthService.loginWithEmailAndPassword(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(userProfile);
      }
    } catch (err) {
      console.error('Email Sign-In failed:', err);
      if (err.message && (err.message.includes('Akses Ditolak') || err.message.includes('Akses ditolak'))) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err.message || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 font-sans selection:bg-[#354944] selection:text-white">
      
      {/* KOLOM KIRI (Fokus Login Form) */}
      <div className="bg-white flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 w-full">
        <div className="w-full max-w-sm flex flex-col items-center">
          
          {/* Logo Utama (Borderless) */}
          <div className="mb-2">
            <img 
              src="/logo_2.jpg" 
              alt="CHUA SPORT CORE Logo" 
              className="w-52 max-w-xs h-auto object-contain"
            />
          </div>

          {/* Teks Sambutan Minimalis */}
          <h1 className="text-2xl font-extrabold text-slate-800 mt-6 mb-1 text-center">
            Selamat Datang
          </h1>
          <p className="text-slate-500 mb-6 text-center text-xs">
            Portal Otentikasi Staff &amp; Management Sport Arena
          </p>

          {/* Segmented Control / Tab Switcher */}
          <div className="w-full bg-slate-100 p-1 rounded-2xl flex items-center mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => { setActiveTab('email'); setErrorMessage(null); }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                activeTab === 'email'
                  ? 'bg-[#354944] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email &amp; Sandi</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('google'); setErrorMessage(null); }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                activeTab === 'google'
                  ? 'bg-[#354944] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Akun Google</span>
            </button>
          </div>

          {/* Alert Error jika otentikasi gagal */}
          {errorMessage && (
            <div className="w-full mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start space-x-2.5 text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: FORM LOGIN EMAIL & SANDI (UTAMA UNTUK STAF & PELATIH) */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailSignIn} className="w-full space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Staf / Pelatih
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="nama@chuasport.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] transition-all text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] transition-all text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 bg-[#354944] hover:bg-[#2B3D38] active:bg-[#1E2C28] text-white font-bold text-xs rounded-xl border-b-2 border-[#C89D32] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memverifikasi Sandi...</span>
                  </div>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 text-[#C89D32]" />
                    <span>Masuk ke Sistem Staf</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: GOOGLE SIGN-IN */}
          {activeTab === 'google' && (
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 px-6 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none"
              >
                {loading ? (
                  <div className="flex items-center space-x-2.5">
                    <div className="w-4 h-4 border-2 border-[#354944] border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-600 text-xs">Memproses Akun Google...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Masuk dengan Google (Owner)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tautan ke Portal Wali Murid & Atlet */}
          <div className="mt-5 pt-4 border-t border-slate-100 w-full text-center">
            <Link
              to="/portal"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-[#354944] hover:text-[#2B3D38] bg-[#354944]/10 hover:bg-[#354944]/15 border border-[#354944]/20 rounded-xl transition-all duration-200 group shadow-2xs hover:shadow-xs cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-[#C89D32] group-hover:scale-105 transition-transform" />
              <span>Portal Wali Murid &amp; Atlet ➔</span>
            </Link>
          </div>

        </div>
      </div>

      {/* KOLOM KANAN (Branding Visual Background Image) */}
      <div className="hidden md:flex md:flex-col justify-center relative overflow-hidden bg-[url('/login-bg.jpg')] bg-cover bg-center bg-no-repeat w-full min-h-screen" />

    </div>
  );
}
