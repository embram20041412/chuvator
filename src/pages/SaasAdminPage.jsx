import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { logoutUser } from '../services/authService';
import { runKkHmacDryRun } from '../services/backfillService';
import { 
  ShieldCheck, 
  UserPlus, 
  Building2, 
  Mail, 
  Trash2, 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  Inbox, 
  Sparkles,
  RefreshCw,
  FileSearch,
  Database,
  X,
  Loader2,
  Lock,
  Info
} from 'lucide-react';

export default function SaasAdminPage({ userProfile }) {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(true);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('owner');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // States untuk Dry-Run KK HMAC
  const [showDryRunConfirm, setShowDryRunConfirm] = useState(false);
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [dryRunError, setDryRunError] = useState(null);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      setMessage({ type: 'error', text: 'Gagal keluar sistem: ' + (err.message || 'Terjadi kesalahan jaringan') });
    }
  };

  // Fetch Invitations from Supabase
  const fetchInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (err) {
      console.error('Error fetching invitations from Supabase:', err);
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  // Fetch Tenants from Supabase
  const fetchTenants = async () => {
    setLoadingTenants(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (err) {
      console.error('Error fetching tenants from Supabase:', err);
      setTenants([]);
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
    fetchTenants();
  }, []);

  const handleAddInvitation = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setSubmitting(true);
    setMessage(null);

    const emailToInvite = newEmail.trim().toLowerCase();

    try {
      const { error } = await supabase.from('invitations').insert([{
        email: emailToInvite,
        role: newRole,
        created_by: userProfile?.email || 'superadmin',
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;

      setMessage({ type: 'success', text: `Undangan untuk ${emailToInvite} berhasil ditambahkan.` });
      setNewEmail('');
      fetchInvitations();
    } catch (err) {
      console.error('Error adding invitation:', err);
      setMessage({ type: 'error', text: 'Gagal menambahkan undangan.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvitation = async (id, email) => {
    if (!window.confirm(`Hapus undangan untuk ${email}?`)) return;

    try {
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: `Undangan ${email} berhasil dihapus.` });
      fetchInvitations();
    } catch (err) {
      console.error('Error deleting invitation:', err);
      setMessage({ type: 'error', text: 'Gagal menghapus undangan.' });
    }
  };

  // Handler eksekusi Dry-Run KK HMAC
  const handleExecuteDryRun = async () => {
    setShowDryRunConfirm(false);
    setLoadingDryRun(true);
    setDryRunError(null);
    setDryRunResult(null);

    try {
      const res = await runKkHmacDryRun({ tenantId: 'global' });
      setDryRunResult(res.data || res);
      setMessage({ 
        type: 'success', 
        text: res.message || 'Analisis dry-run KK HMAC selesai. Tidak ada perubahan yang dilakukan pada database.' 
      });
    } catch (err) {
      console.error('[Dry-Run Error]:', err);
      setDryRunError(err.message || 'Gagal menjalankan analisis dry-run KK HMAC.');
    } finally {
      setLoadingDryRun(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#333333] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Bar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md shadow-blue-200">
              CSC
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-[#333333]">SaaS Super Admin Control</h1>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Pengelolaan Tenant & Akses Undangan Sistem</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              data-testid="btn-run-dryrun"
              onClick={() => setShowDryRunConfirm(true)}
              disabled={loadingDryRun}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              {loadingDryRun ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menganalisis (Dry-Run)...</span>
                </>
              ) : (
                <>
                  <FileSearch className="w-4 h-4" />
                  <span>Jalankan Dry-Run KK HMAC</span>
                </>
              )}
            </button>

            <button
              onClick={() => { fetchInvitations(); fetchTenants(); }}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer border border-gray-200"
              title="Refresh Data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div className={`p-4 rounded-xl border flex items-center space-x-3 text-sm ${
            message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Panel Alat Audit & Keamanan KK HMAC */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="font-bold text-base text-[#333333]">Audit Keamanan & Dry-Run KK HMAC</h2>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    100% READ-ONLY
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Analisis kesiapan data siswa, keabsahan nomor KK, dan integritas hash HMAC tanpa mengubah isi database.
                </p>
              </div>
            </div>

            <button
              data-testid="btn-card-run-dryrun"
              onClick={() => setShowDryRunConfirm(true)}
              disabled={loadingDryRun}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-2 shrink-0"
            >
              {loadingDryRun ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Proses Analisis...</span>
                </>
              ) : (
                <>
                  <FileSearch className="w-4 h-4" />
                  <span>Jalankan Dry-Run KK HMAC</span>
                </>
              )}
            </button>
          </div>

          {/* Indikator Loading Dry-Run */}
          {loadingDryRun && (
            <div className="p-6 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center space-x-4">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">Sedang Menganalisis Data Siswa (Dry-Run)...</p>
                <p className="text-xs text-indigo-700 mt-0.5">
                  Sistem membaca record siswa via keyset pagination & memvalidasi format HMAC secara terisolasi.
                </p>
              </div>
            </div>
          )}

          {/* Alert Error Dry-Run */}
          {dryRunError && (
            <div data-testid="dryrun-error-alert" className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Gagal Menjalankan Analisis Dry-Run</p>
                <p className="text-xs text-red-700">{dryRunError}</p>
              </div>
            </div>
          )}

          {/* Hasil Analisis Dry-Run (Statistik Agregat Bebas PII) */}
          {dryRunResult && (
            <div data-testid="dryrun-results-panel" className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-gray-700">Waktu Analisis Terakhir:</span>
                  <span>{dryRunResult.timestamp ? new Date(dryRunResult.timestamp).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}</span>
                </div>
                <span className="font-mono text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                  MODE: DRY_RUN
                </span>
              </div>

              {/* Ringkasan Metrik */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Total Siswa</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{dryRunResult.totalStudents ?? 0}</p>
                </div>
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase">KK Sumber Valid</p>
                  <p className="text-xl font-black text-emerald-900 mt-1">{dryRunResult.validSourceKK ?? 0}</p>
                </div>
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[11px] font-bold text-amber-700 uppercase">KK Tidak Valid</p>
                  <p className="text-xl font-black text-amber-900 mt-1">{dryRunResult.invalidSourceKK ?? 0}</p>
                </div>
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <p className="text-[11px] font-bold text-indigo-700 uppercase">Kandidat Backfill</p>
                  <p className="text-xl font-black text-indigo-900 mt-1">{dryRunResult.backfillCandidates ?? 0}</p>
                </div>
              </div>

              {/* Rincian Kategori Kualifikasi (6 Kategori Kunci) */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Rincian Kualifikasi Kategori (6 Kategori)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                  {/* 1. ELIGIBLE */}
                  <div data-testid="dryrun-category-ELIGIBLE" className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900">1. ELIGIBLE</span>
                      <span className="px-2 py-0.5 bg-blue-600 text-white font-bold text-xs rounded-full">
                        {dryRunResult.categories?.ELIGIBLE ?? 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-700">Siap Backfill (No. KK 16 digit valid, HMAC masih kosong)</p>
                  </div>

                  {/* 2. ALREADY_VALID */}
                  <div data-testid="dryrun-category-ALREADY_VALID" className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">2. ALREADY_VALID</span>
                      <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-xs rounded-full">
                        {dryRunResult.categories?.ALREADY_VALID ?? 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700">Sudah Valid (HMAC & Last4 cocok sempurna dengan secret server)</p>
                  </div>

                  {/* 3. INVALID_SOURCE */}
                  <div data-testid="dryrun-category-INVALID_SOURCE" className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900">3. INVALID_SOURCE</span>
                      <span className="px-2 py-0.5 bg-amber-600 text-white font-bold text-xs rounded-full">
                        {dryRunResult.categories?.INVALID_SOURCE ?? 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700">Sumber KK Tidak Valid (no_kk kosong / kurang dari 16 digit)</p>
                  </div>

                  {/* 4. MISSING_LAST4 */}
                  <div data-testid="dryrun-category-MISSING_LAST4" className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900">4. MISSING_LAST4</span>
                      <span className="px-2 py-0.5 bg-purple-600 text-white font-bold text-xs rounded-full">
                        {dryRunResult.categories?.MISSING_LAST4 ?? 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-700">Format HMAC Valid (64 hex) tapi kk_last4 masih kosong</p>
                  </div>

                  {/* 5. CORRUPT_HMAC */}
                  <div data-testid="dryrun-category-CORRUPT_HMAC" className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900">5. CORRUPT_HMAC</span>
                      <span className="px-2 py-0.5 bg-rose-600 text-white font-bold text-xs rounded-full">
                        {dryRunResult.categories?.CORRUPT_HMAC ?? 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700">Format HMAC Rusak (Bukan karakter hex 64 digit yang sah)</p>
                  </div>

                  {/* 6. HMAC_MISMATCH */}
                  <div data-testid="dryrun-category-HMAC_MISMATCH" className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-900">6. HMAC_MISMATCH</span>
                      <span className="px-2 py-0.5 bg-red-600 text-white font-bold text-xs rounded-full">
                        {dryRunResult.categories?.HMAC_MISMATCH ?? 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-red-700">HMAC Tidak Cocok (Beda dengan hasil perhitungan secret server)</p>
                  </div>

                </div>
              </div>

              {/* Jaminan Keamanan PII */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center space-x-2 text-xs text-gray-600">
                <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                <span>
                  <strong>Jaminan Privasi & Keamanan PII:</strong> Hasil analisis ini murni statistik agregat. NIK, Nomor KK lengkap, nilai HMAC, dan secret server tidak pernah ditampilkan atau dikirimkan ke client.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Invite New Owner */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2 mb-4 text-blue-600">
                <UserPlus className="w-5 h-5" />
                <h2 className="font-bold text-base text-[#333333]">Tambah Undangan Access</h2>
              </div>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Pengguna dengan email yang diundang dapat melakukan registrasi dan mengaktifkan Tenant Arena/Akademi.
              </p>

              <form onSubmit={handleAddInvitation} className="space-y-4">
                <div>
                  <label htmlFor="invite-admin-email" className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Email Pengguna
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      id="invite-admin-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="contoh: owner@sportarena.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="invite-admin-role" className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Role Akses
                  </label>
                  <select
                    id="invite-admin-role"
                    name="role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="owner">Tenant Owner (Pemilik Arena)</option>
                    <option value="manager">Arena Manager</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-2"
                >
                  {submitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Kirim Undangan</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Invitations List & Registered Tenants */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Daftar Undangan Access */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-[#333333]">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-base">Daftar Email Diundang ({invitations.length})</h2>
                </div>
              </div>

              {loadingInvitations ? (
                <div className="py-8 text-center text-sm text-gray-500">Memuat daftar undangan...</div>
              ) : invitations.length === 0 ? (
                <div className="py-10 border-2 border-dashed border-gray-200 rounded-xl text-center flex flex-col items-center justify-center p-6">
                  <Inbox className="w-10 h-10 text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-600">Belum ada email undangan terdaftar</p>
                  <p className="text-xs text-gray-400 mt-1">Gunakan formulir di sebelah kiri untuk menambah akses pengguna baru.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 overflow-x-auto">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="py-3.5 flex items-center justify-between hover:bg-gray-50 px-2 rounded-lg transition-colors">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm text-[#333333]">{inv.email}</p>
                        <div className="flex items-center space-x-2 text-[11px] text-gray-500">
                          <span className="capitalize px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-medium">Role: {inv.role}</span>
                          <span>&bull;</span>
                          <span>Diundang oleh: {inv.createdBy || 'Super Admin'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteInvitation(inv.id, inv.email)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Undangan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daftar Tenant Terdaftar */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-[#333333]">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-base">Tenant Terdaftar ({tenants.length})</h2>
                </div>
              </div>

              {loadingTenants ? (
                <div className="py-8 text-center text-sm text-gray-500">Memuat data tenant...</div>
              ) : tenants.length === 0 ? (
                <div className="py-10 border-2 border-dashed border-gray-200 rounded-xl text-center flex flex-col items-center justify-center p-6">
                  <Building2 className="w-10 h-10 text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-600">Belum ada data tenant terdaftar</p>
                  <p className="text-xs text-gray-400 mt-1">Tenant yang mendaftar melalui Onboarding akan muncul di sini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tenants.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-[#333333]">{t.name}</h3>
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-800 font-bold rounded-full">
                          {t.status || 'Aktif'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Pemilik: {t.owner_email || t.ownerEmail || '-'}</p>
                      <p className="text-xs text-gray-500">Alamat: {t.address || '-'}</p>
                      <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-200/60">
                        Cabang: {t.branchesCount || 1} | Lapangan: {t.courts_count ?? t.courtsCount ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Modal Konfirmasi Dry-Run (Read-Only) */}
      {showDryRunConfirm && (
        <div data-testid="dryrun-confirm-modal" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2 text-indigo-600">
                <FileSearch className="w-5 h-5" />
                <h3 className="font-bold text-base text-gray-900">Konfirmasi Dry-Run KK HMAC</h3>
              </div>
              <button
                data-testid="dryrun-confirm-cancel-x"
                onClick={() => setShowDryRunConfirm(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2.5 text-emerald-800 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">100% AMAN & READ-ONLY (Tanpa Perubahan Database)</span>
              </div>
              <p className="leading-relaxed">
                Proses dry-run ini hanya akan membaca dan menganalisis status keabsahan Nomor KK dan ketersediaan hash HMAC dari seluruh data siswa.
              </p>
              <ul className="text-xs space-y-1.5 text-gray-500 list-disc pl-4">
                <li>Sistem <strong>TIDAK AKAN</strong> mengubah, menambah, atau menghapus record database.</li>
                <li>Sistem <strong>TIDAK AKAN</strong> membuat lease, run record, atau audit log.</li>
                <li>Sistem <strong>TIDAK AKAN</strong> mengekspos NIK, KK lengkap, HMAC, atau secret server.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                data-testid="dryrun-confirm-cancel"
                onClick={() => setShowDryRunConfirm(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                data-testid="dryrun-confirm-yes"
                onClick={handleExecuteDryRun}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center space-x-2"
              >
                <FileSearch className="w-4 h-4" />
                <span>Ya, Jalankan Dry-Run</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
