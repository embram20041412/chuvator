import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mail
} from 'lucide-react';

/**
 * PortalClaimInvitation - Intermediary landing page for Parent Portal activation.
 * 
 * Protects Supabase single-use OTP links and V3.3 invitation tokens from crawler pre-fetching.
 */
export default function PortalClaimInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!token) return;

    if (token.startsWith('inv_')) {
      setIsFetchingInfo(true);
      fetch(`/api/portal/invitation/info?token=${encodeURIComponent(token)}`)
        .then(res => res.json())
        .then(data => {
          setIsFetchingInfo(false);
          if (data.success && data.invitation) {
            setInvitationInfo(data.invitation);
          } else {
            setErrorMsg(data.message || 'Undangan tidak ditemukan atau token tidak valid.');
          }
        })
        .catch(() => {
          setIsFetchingInfo(false);
        });
    }
  }, [token]);

  const handleProceedActivation = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (!token || !token.trim()) {
      setErrorMsg('Tautan aktivasi tidak valid atau token tidak ditemukan.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (token.startsWith('inv_')) {
        // Redirect directly to accept-invitation page with token for password setting & claim
        navigate(`/portal/accept-invitation?token=${encodeURIComponent(token.trim())}`);
        return;
      }

      const response = await fetch('/api/portal/invitation/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ token: token.trim() })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success && data.actionLink) {
        window.location.href = data.actionLink;
      } else if (response.ok && data.success) {
        navigate(`/portal/accept-invitation?token=${encodeURIComponent(token.trim())}`);
      } else {
        setErrorMsg(
          data.message || 'Tautan aktivasi tidak valid, telah kedaluwarsa, atau sudah digunakan.'
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
          <span>Parent Portal • Verifikasi Aman</span>
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
          Selamat datang di Parent Portal. Tekan tombol di bawah untuk melanjutkan aktivasi dan pembuatan kata sandi akun Anda.
        </p>

        {/* Masked Email Info Card */}
        {invitationInfo?.maskedEmail && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3 text-left">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Akun</p>
              <p className="text-sm font-bold text-slate-800">{invitationInfo.maskedEmail}</p>
            </div>
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
                className="mt-2 font-bold text-red-800 underline underline-offset-2 block"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          </div>
        )}

        {/* Explicit Action Button */}
        <form onSubmit={handleProceedActivation} className="space-y-4">
          <button
            type="submit"
            disabled={isLoading || isFetchingInfo || !token}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading || isFetchingInfo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyiapkan Sesi Aktivasi...</span>
              </>
            ) : (
              <>
                <span>Lanjutkan ke Aktivasi Akun</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <span className="font-semibold text-slate-500">Platform Layanan:</span>
          <span className="font-bold tracking-wider text-slate-600">CHUVATOR</span>
        </div>
      </div>
    </div>
  );
}
