import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  User, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  Clock,
  Ban,
  Link,
  Info,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { 
  createStaffInvitation, 
  getStaffListByTenant, 
  getPendingInvitationsByTenant, 
  revokeStaffInvitation, 
  deleteStaffDoc,
  buildInvitationUrl
} from '../services/staffService';
import useAuthRole from '../hooks/useAuthRole';

export default function StaffManagementPage({ userProfile }) {
  const { isOwner, isAdmin, isSuperAdmin, canManageStaff, canInviteAdmins, loading: roleLoading } = useAuthRole(userProfile);
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.id || userProfile?.uid;

  // Form states
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [staffRole, setStaffRole] = useState('kasir'); // 'kasir' | 'coach' | 'admin' | 'staff'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [createdInvite, setCreatedInvite] = useState(null); // { inviteUrl, email, role, expiresAt }
  const [copiedLink, setCopiedLink] = useState(false);

  // List states
  const [staffList, setStaffList] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [revokingId, setRevokingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Fetch staff list & pending invitations
  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    try {
      const [staffResult, invitesResult] = await Promise.all([
        getStaffListByTenant(tenantId),
        getPendingInvitationsByTenant(tenantId),
      ]);
      setStaffList(staffResult);
      setPendingInvitations(invitesResult);
    } catch (error) {
      console.error('[StaffManagementPage] Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();

    if (!tenantId) return;

    // Realtime listener untuk tabel users_staff
    const staffChannel = supabase
      .channel(`realtime_staff_mgmt_${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users_staff', filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations', filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

  return () => {
      supabase.removeChannel(staffChannel);
    };
  }, [tenantId, fetchData]);

  // Handler Submit Buat Undangan Staf Baru
  const handleInviteStaff = async (e) => {
    if (e) e.preventDefault();
    setFormError(null);
    setCreatedInvite(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanEmail || !cleanDisplayName) {
      setFormError('Nama lengkap dan alamat email staf wajib diisi.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError('Format email tidak valid.');
      return;
    }

    // Penegakan Hierarki RBAC:
    // Admin operasional DILARANG mengundang Owner, Admin, atau Superadmin
    if (!canInviteAdmins && staffRole === 'admin') {
      setFormError('Akses ditolak: Hanya Pemilik (Owner) yang berwenang mengangkat Admin baru.');
      return;
    }

    if (!tenantId) {
      setFormError('ID Tenant tidak ditemukan.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createStaffInvitation({
        tenantId,
        email: cleanEmail,
        role: staffRole,
        fullName: cleanDisplayName,
        displayName: cleanDisplayName,
      });

      setCreatedInvite({
        inviteUrl: result.inviteUrl,
        email: cleanEmail,
        role: result.role,
        expiresAt: result.expiresAt,
      });

      setEmail('');
      setDisplayName('');
      setStaffRole('kasir');
      fetchData();
    } catch (err) {
      console.error('[StaffManagementPage] Error inviting staff:', err);
      setFormError(err.message || 'Gagal membuat undangan staf di database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Pembatalan Undangan via RPC revoke_staff_invitation
  const handleRevokeInvitation = async (invitationId, invEmail) => {
    if (!window.confirm(`Yakin ingin membatalkan undangan untuk "${invEmail}"?`)) {
      return;
    }

    setRevokingId(invitationId);
    try {
      await revokeStaffInvitation(invitationId);
      setActionNotice(`Undangan untuk ${invEmail} berhasil dibatalkan.`);
      setTimeout(() => setActionNotice(null), 4000);
      fetchData();
    } catch (err) {
      console.error('[StaffManagementPage] Error revoking invitation:', err);
      alert('Gagal membatalkan undangan: ' + err.message);
    } finally {
      setRevokingId(null);
    }
  };

  // Handler Hapus Akun Staf dari users_staff
  const handleDeleteStaff = async (staffId, staffName) => {
    if (!window.confirm(`Yakin ingin menghapus staf "${staffName}"?`)) {
      return;
    }

    try {
      await deleteStaffDoc(staffId);
      setActionNotice(`Staf "${staffName}" berhasil dihapus.`);
      setTimeout(() => setActionNotice(null), 4000);
      fetchData();
    } catch (err) {
      console.error('[StaffManagementPage] Error deleting staff:', err);
      alert('Gagal menghapus data staf: ' + err.message);
    }
  };

  const handleCopyLink = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!roleLoading && !canManageStaff) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Akses Terbatas: Khusus Owner / Admin</h2>
          <p className="text-slate-600 text-xs mt-1">
            Halaman Manajemen Staf &amp; Undangan hanya dapat diakses oleh Pemilik (*Owner*) atau Admin cabang aktif.
          </p>
        </div>
      </div>
    );
  }

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      (s.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manajemen Staf &amp; Hak Akses</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Kelola anggota staf, pelatih akademi, dan penerbitan tautan undangan resmi Supabase RLS.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loadingData}
          className="px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition flex items-center space-x-1.5 self-start cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {actionNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionNotice}</span>
        </div>
      )}

      {/* Grid: Form Undangan Baru & Status Sukses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1-2: Form Buat Undangan */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2.5 border-b border-gray-100 pb-3">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-gray-800">Undang Anggota Staf / Pelatih Baru</h2>
              <p className="text-xs text-gray-500">
                Penerbitan token undangan berbasis database RPC tepercaya (`create_staff_invitation`).
              </p>
            </div>
          </div>

          {formError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {createdInvite && (
            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 text-xs flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Undangan Berhasil Dibuat untuk {createdInvite.email}!</span>
                </span>
                <span className="px-2 py-0.5 bg-blue-200 text-blue-900 font-bold rounded text-[10px] uppercase">
                  {createdInvite.role}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Salin dan bagikan tautan berikut kepada staf/pelatih. Calon anggota dapat membuka tautan ini untuk membuat kata sandi dan mengaktifkan akun secara mandiri.
              </p>

              <div className="flex items-center space-x-2">
                <input
                  id="created-invite-url"
                  name="inviteUrl"
                  type="text"
                  readOnly
                  value={createdInvite.inviteUrl}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl font-mono text-gray-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(createdInvite.inviteUrl)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Tersalin!' : 'Salin Tautan'}</span>
                </button>
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-blue-800/80 pt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Masa berlaku undangan: 7 hari (hingga {new Date(createdInvite.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}).</span>
              </div>

              <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Catatan Transparan:</strong> Sistem pengiriman email SMTP otomatis belum terkonfigurasi pada arena ini. Harap kirimkan tautan di atas secara langsung melalui WhatsApp atau kanal komunikasi internal Anda.
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleInviteStaff} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invite-staff-display-name" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nama Lengkap Staf <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    id="invite-staff-display-name"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Ahmad Kasir"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="invite-staff-email" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Alamat Email Staf <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    id="invite-staff-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staf@domain.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invite-staff-role" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Peran Akses (RBAC) <span className="text-red-500">*</span>
                </label>
                <select
                  id="invite-staff-role"
                  name="staffRole"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-gray-800"
                >
                  <option value="kasir">Kasir (Transaksi POS &amp; Jadwal Lapangan)</option>
                  <option value="coach">Pelatih (Manajemen Kelas &amp; Siswa Akademi)</option>
                  <option value="staff">Staf Operasional (Akses Umum Operasional)</option>
                  {/* Hanya Owner & Superadmin yang berhak mengangkat Admin */}
                  {canInviteAdmins && (
                    <option value="admin">Admin Cabang (Kelola Staf &amp; Keuangan)</option>
                  )}
                </select>
                {!canInviteAdmins && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    * Pengangkatan Admin baru hanya dapat dilakukan oleh Pemilik (Owner).
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="invite-staff-tenant-name" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Tenant Cabang
                </label>
                <input
                  id="invite-staff-tenant-name"
                  name="tenantName"
                  type="text"
                  disabled
                  value={userProfile?.tenant?.name || tenantId || 'Tenant Aktif'}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-100 border border-gray-200 rounded-xl font-mono text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menerbitkan Undangan...</span>
                  </>
                ) : (
                  <>
                    <Link className="w-3.5 h-3.5" />
                    <span>Terbitkan Tautan Undangan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Kolom 3: Panduan Keamanan & Informasi Hierarki */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Protokol Keamanan Multi-Tenant</span>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <p>
              Setiap undangan diproses melalui fungsi database aman <strong>create_staff_invitation</strong> dengan standar zero-trust:
            </p>
            <ul className="space-y-2 list-disc list-inside text-[11px] text-slate-400">
              <li>Token undangan di-hash menggunakan SHA-256 di database (token mentah tidak disimpan).</li>
              <li>Tautan undangan berlaku selama 7 hari.</li>
              <li>Akun terikat ke Auth UID secara atomik hanya saat pengguna mengklaim undangan via <code>claim_staff_invitation</code>.</li>
              <li>Admin tidak dapat mengangkat diri sendiri atau mengundang pengguna lain menjadi Owner / Superadmin.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* TABEL 1: DAFTAR UNDANGAN PENDING */}
      {pendingInvitations.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-50/60 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Daftar Undangan Pending ({pendingInvitations.length})</span>
            </div>
            <span className="text-[11px] text-amber-700">
              Menunggu staf mengklaim akun
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Email Undangan</th>
                  <th className="px-4 py-3">Peran (Role)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Kedaluwarsa</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingInvitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-amber-50/20 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded uppercase text-[10px]">
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.isExpired ? (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] font-bold">
                          Kedaluwarsa
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-[11px]">
                      {new Date(inv.expiresAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                        disabled={revokingId === inv.id}
                        className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition inline-flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                      >
                        <Ban className="w-3 h-3" />
                        <span>{revokingId === inv.id ? 'Membatalkan...' : 'Batalkan'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABEL 2: DAFTAR ANGGOTA STAF AKTIF */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-800">
              Daftar Staf Cabang ({filteredStaff.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                id="staff-search-query"
                name="searchQuery"
                type="text"
                placeholder="Cari staf..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 w-48"
              />
            </div>

            <select
              id="staff-role-filter"
              name="roleFilter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="kasir">Kasir</option>
              <option value="coach">Pelatih</option>
              <option value="staff">Staf</option>
            </select>
          </div>
        </div>

        {loadingData ? (
          <div className="p-8 text-center text-xs text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
            <span>Memuat daftar staf...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            Tidak ada staf ditemukan. Silakan terbitkan undangan baru di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Nama Lengkap</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Peran (Role)</th>
                  <th className="px-4 py-3">Status Akun</th>
                  <th className="px-4 py-3">Terdaftar</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {staff.displayName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{staff.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded uppercase text-[10px] border border-blue-200">
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {staff.isBound ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] flex items-center space-x-1 w-max">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Terikat UID</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] flex items-center space-x-1 w-max">
                          <Clock className="w-3 h-3" />
                          <span>Menunggu Klaim</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-[11px]">
                      {staff.createdAt
                        ? new Date(staff.createdAt).toLocaleDateString('id-ID')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteStaff(staff.id, staff.displayName)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Hapus Staf"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
