import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Phone, Hash, ArrowRight, Loader2, ShieldCheck, AlertCircle, Lock, Calendar } from 'lucide-react';

export default function PortalLogin() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentPin, setParentPin] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!studentId.trim() || !parentPhone.trim()) {
      setError('Mohon isi ID Siswa dan Nomor HP Wali Murid.');
      return;
    }

    if (!parentPin.trim() && !birthDate.trim()) {
      setError('Mohon isi PIN Akses Wali (6 Digit) ATAU Tanggal Lahir Siswa untuk verifikasi keamanan.');
      return;
    }

    if (parentPin.trim() && parentPin.trim().length !== 6) {
      setError('PIN Akses Wali harus berupa 6 digit angka.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/portal/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: studentId.trim(),
          parentPhone: parentPhone.trim(),
          parentPin: parentPin.trim() || undefined,
          birthDate: birthDate.trim() || undefined
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success && data.student) {
        // Simpan data profil siswa aktif ke localStorage
        localStorage.setItem('activeStudent', JSON.stringify(data.student));
        // Redirect ke dashboard portal wali murid
        navigate('/portal/dashboard');
      } else {
        // HTTP 401/500 atau kredensial tidak cocok
        setError(data.message || data.details || data.error || 'Kredensial tidak ditemukan atau verifikasi keamanan gagal.');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setError('Gagal terhubung ke server. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 bg-gradient-to-b from-slate-50 via-white to-slate-50 min-h-screen">
      {/* Top Brand & Title */}
      <div className="pt-4 text-center">
        <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
          <GraduationCap className="w-8 h-8" />
        </div>
        <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider mb-2 border border-blue-100">
          Portal Wali Murid
        </span>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Masuk ke Akun Siswa
        </h1>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
          Pantau perkembangan latihan, kehadiran, tagihan SPP, dan prestasi ananda secara langsung.
        </p>
      </div>

      {/* Login Form */}
      <div className="my-auto py-6">
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Input ID Siswa */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold text-slate-700">
              ID Siswa (Firestore Doc ID) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                disabled={loading}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Contoh: s7X9mK2..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              ID dapat dilihat pada Kartu Anggota / ID Card digital siswa.
            </p>
          </div>

          {/* Input Nomor HP Wali */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold text-slate-700">
              Nomor WhatsApp / HP Wali <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                required
                disabled={loading}
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Gunakan nomor HP yang terdaftar saat registrasi siswa di akademi.
            </p>
          </div>

          {/* PIN Akses atau Tanggal Lahir Siswa (Verifikasi Keamanan 2FA) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3 text-left">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Verifikasi Identitas Keamanan <span className="text-red-500">*</span></span>
              </label>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                Wajib Isi Salah Satu
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* PIN Akses Wali 6-Digit */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  PIN Akses Wali (6 Digit)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  disabled={loading}
                  value={parentPin}
                  onChange={(e) => setParentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 123456"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              {/* Tanggal Lahir Siswa */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Atau Tanggal Lahir Siswa
                </label>
                <input
                  type="date"
                  disabled={loading}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Portal memverifikasi PIN 6-Digit atau Tanggal Lahir Siswa untuk mencegah akses tidak sah.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Error Message Display di bawah Form */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span className="font-medium text-red-600">{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Bottom Footer Note */}
      <div className="pb-2 text-center text-slate-400 text-[11px] space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-slate-500 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Akses Terenkripsi &amp; Resmi</span>
        </div>
        <p>CHUA SPORT CORE &bull; Sistem Manajemen Akademi</p>
      </div>
    </div>
  );
}
