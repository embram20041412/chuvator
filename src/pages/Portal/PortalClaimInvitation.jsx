import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2
} from 'lucide-react';

/**
 * PortalClaimInvitation - Landing & Activation page for Parent Portal V3.3.
 * Handles both /portal/claim-invitation and /portal/accept-invitation.
 */
export default function PortalClaimInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract token from URLSearchParams
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const token = queryParams.get('token') || searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(true);
  const [invitationInfo, setInvitationInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Password state for parent activation
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token || !token.trim()) {
      setIsFetchingInfo(false);
      setErrorMsg('Tautan aktivasi tidak valid atau token tidak ditemukan dalam URL.');
      return;
    }

    setIsFetchingInfo(true);
    setErrorMsg(null);

    // Memanggil endpoint backend Edge Function
    fetch(`/api/portal/invitation/info?token=${encodeURIComponent(token.trim())}`)
      .then(res => res.json())
      .then(data => {
        setIsFetchingInfo(false);
        if (data.success) {
          // Set state data undangan ke form UI
          setInvitationInfo(data.data || data.invitation || data);
        } else {
          // Tampilkan error dari server
          setErrorMsg(data.error || data.message || 'Undangan tidak ditemukan atau token tidak valid.');
        }
      })
      .catch(() => {
        setIsFetchingInfo(false);
        setErrorMsg('Terjadi kendala jaringan saat memverifikasi tautan undangan.');
      });
  }, [token]);

  const handleProceedActivation = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (!token || !token.trim()) {
      setErrorMsg('Tautan aktivasi tidak valid atau token tidak ditemukan.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal harus 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/portal/invitation/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          token: token.trim(),
          password: password.trim()
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setSuccessMsg('Akun berhasil diaktifkan! Menyiapkan sesi portal...');
        const userEmail = data.email || (invitationInfo && (invitationInfo.email || invitationInfo.parent_accounts?.email));
        if (userEmail && password) {
          try {
            const loginResp = await fetch('/api/portal/v2/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({
                email: userEmail,
                password: password.trim()
              })
            });
            const loginData = await loginResp.json().catch(() => ({}));
            if (loginResp.ok && loginData.success) {
              setSuccessMsg('Aktivasi sukses! Mengalihkan ke dashboard...');
              setTimeout(() => {
                navigate('/portal/dashboard', { replace: true });
              }, 1200);
              return;
            }
          } catch (_) {}
        }

        setSuccessMsg(data.message || 'Akun wali murid berhasil diaktifkan! Mengalihkan ke login...');
        setTimeout(() => {
          navigate('/portal', { replace: true });
        }, 1500);
      } else {
        setErrorMsg(
          data.error || data.message || 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
        );
        setIsLoading(false);
      }
    } catch (_) {
      setErrorMsg('Terjadi kendala koneksi saat memproses aktivasi. Silakan periksa jaringan Anda dan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-8 bg-slate-50 text-slate-900 min-h-screen">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-8 text-center animate-fade-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[11px] font-bold tracking-wide mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Parent Portal • Verifikasi Aman V3.3</span>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-5">
          <GraduationCap className="w-8 h-8" />
        </div>

        {/* Header */}
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
          Aktivasi Akun Portal
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto mb-6">
          Selamat datang di Parent Portal{invitationInfo?.tenantName ? ` (${invitationInfo.tenantName})` : ''}. Silakan buat kata sandi baru untuk mengaktifkan akun Anda.
        </p>

        {/* Loading Spinner */}
        {isFetchingInfo && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium tracking-wide">Memverifikasi tautan undangan...</p>
          </div>
        )}

        {/* Masked Email & Tenant Info Card */}
        {!isFetchingInfo && invitationInfo && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Akun</p>
                <p className="text-sm font-bold text-slate-800 truncate">{invitationInfo.maskedEmail || invitationInfo.masked_email}</p>
              </div>
            </div>
            {(invitationInfo.tenantName || invitationInfo.tenant_name) && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{invitationInfo.tenantName || invitationInfo.tenant_name}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">
              <p>{errorMsg}</p>
              <button
                type="button"
                onClick={() => navigate('/portal')}
                className="mt-2 font-bold text-red-800 underline underline-offset-2 block cursor-pointer"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-3 text-left">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">
              <p>{successMsg}</p>
            </div>
          </div>
        )}

        {/* Activation & Password Form */}
        {!isFetchingInfo && invitationInfo && !successMsg && (
          <form onSubmit={handleProceedActivation} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase px-1">
                Kata Sandi Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase px-1">
                Konfirmasi Kata Sandi
              </label>
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
              className="w-full mt-6 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengaktifkan Akun...</span>
                </>
              ) : (
                <>
                  <span>Aktifkan Akun &amp; Simpan Kata Sandi</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer Notice */}
        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <span className="font-semibold text-slate-500">Platform Layanan:</span>
          <span className="font-bold tracking-wider text-slate-600">CHUVATOR</span>
        </div>
      </div>
    </div>
  );
}
