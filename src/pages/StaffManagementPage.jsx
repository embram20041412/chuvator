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
  Link as LinkIcon,
  Info,
  X,
  Send,
  Filter
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { 
  createStaffInvitation, 
  getStaffListByTenant, 
  getInvitationsByTenant, 
  revokeStaffInvitation, 
  deleteStaffDoc
} from '../services/staffService';
import useAuthRole from '../hooks/useAuthRole';

export default function StaffManagementPage({ userProfile }) {
  const { canManageStaff, canInviteAdmins, loading: roleLoading } = useAuthRole(userProfile);
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.id || userProfile?.uid;
  const tenantName = userProfile?.tenant?.name || 'Cabang Aktif';

  // Navigation tab inside Staff Management: 'staff_list' | 'invitations_list'
  const [activeTab, setActiveTab] = useState('staff_list');

  // Form states
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [staffRole, setStaffRole] = useState('kasir'); // 'kasir' | 'coach' | 'admin' | 'staff'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // In-Memory Storage for Invite Links created during this browser session
  // Key: invitationId, Value: inviteUrl
  const [sessionInviteLinks, setSessionInviteLinks] = useState({});

  // Confirmation Modals State
  const [inviteSuccessModal, setInviteSuccessModal] = useState(null); 
  // { inviteUrl, email, role, tenantName, expiresAt, invitationId }

  const [revokeConfirmModal, setRevokeConfirmModal] = useState(null); 
  // { id, email }

  const [copiedModalLink, setCopiedModalLink] = useState(false);
  const [copiedTableLinkId, setCopiedTableLinkId] = useState(null);

  // List states
  const [staffList, setStaffList] = useState([]);
  const [allInvitations, setAllInvitations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [invitationStatusFilter, setInvitationStatusFilter] = useState('all'); // 'all' | 'pending' | 'accepted' | 'expired' | 'revoked'
  const [revokingId, setRevokingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Fetch staff list & invitations
  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    try {
      const [staffResult, invitesResult] = await Promise.all([
        getStaffListByTenant(tenantId),
        getInvitationsByTenant(tenantId),
      ]);
      setStaffList(staffResult);
      setAllInvitations(invitesResult);
    } catch (error) {
      console.error('[StaffManagementPage] Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();

    if (!tenantId) return;

    // Realtime listener untuk tabel users_staff & invitations
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

    // Penegakan Hierarki RBAC
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

      const invId = result.invitationId || result.invitation?.invitation_id || result.invitation?.id;
      
      // Simpan raw link di session state aman (diindeks berdasarkan ID dan Email)
      if (result.inviteUrl) {
        setSessionInviteLinks((prev) => ({
          ...prev,
          ...(invId ? { [invId]: result.inviteUrl } : {}),
          [cleanEmail]: result.inviteUrl,
        }));
      }

      // TAMPILKAN MODAL DIALOG KONFIRMASI (Bukan toast sementara)
      setInviteSuccessModal({
        inviteUrl: result.inviteUrl,
        email: cleanEmail,
        role: result.role,
        tenantName: tenantName,
        expiresAt: result.expiresAt,
        invitationId: invId,
      });

      // Reset Form Input
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

  // Handler Konfirmasi Pembatalan Undangan via RPC revoke_staff_invitation
  const executeRevokeInvitation = async (invitationId, invEmail) => {
    setRevokingId(invitationId);
    try {
      await revokeStaffInvitation(invitationId);
      setActionNotice(`Undangan untuk ${invEmail} berhasil dibatalkan.`);
      setTimeout(() => setActionNotice(null), 4000);
      setRevokeConfirmModal(null);
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

  const handleCopyModalLink = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedModalLink(true);
    setTimeout(() => setCopiedModalLink(false), 2500);
  };

  const handleCopyTableLink = (invId, url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedTableLinkId(invId);
    setTimeout(() => setCopiedTableLinkId(null), 2500);
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

  const filteredInvitations = allInvitations.filter((inv) => {
    const matchesStatus = invitationStatusFilter === 'all' || inv.status === invitationStatusFilter;
    const matchesSearch = (inv.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = allInvitations.filter((inv) => inv.status === 'pending').length;

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
          type="button"
          onClick={fetchData}
          disabled={loadingData}
          className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition flex items-center space-x-1.5 self-start cursor-pointer disabled:opacity-50 shadow-2xs"
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

      {/* Grid: Form Undangan Baru & Protokol Keamanan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1-2: Form Buat Undangan */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2.5 border-b border-gray-100 pb-3">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-gray-800">Undang Anggota Staf / Pelatih Baru</h2>
              <p className="text-xs text-gray-500">
                Penerbitan token undangan berbasis database RPC tepercaya (<code>create_staff_invitation</code>).
              </p>
            </div>
          </div>

          {formError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
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
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-gray-800 cursor-pointer"
                >
                  <option value="kasir">Kasir (Transaksi POS &amp; Jadwal Lapangan)</option>
                  <option value="coach">Pelatih (Manajemen Kelas &amp; Siswa Akademi)</option>
                  <option value="staff">Staf Operasional (Akses Umum Operasional)</option>
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
                  value={tenantName}
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
                    <Send className="w-3.5 h-3.5" />
                    <span>Terbitkan Undangan Staf</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Kolom 3: Panduan Keamanan */}
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
              <li>Admin tidak dapat mengundang pengguna lain menjadi Owner / Superadmin.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* TABS UTAMA: STAFT AKTIF VS UNDANGAN STAFF */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-gray-200 gap-3 pb-2">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('staff_list')}
              className={`px-4 py-2 font-bold text-xs rounded-xl transition flex items-center space-x-2 cursor-pointer ${
                activeTab === 'staff_list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Daftar Staf Cabang ({staffList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invitations_list')}
              className={`px-4 py-2 font-bold text-xs rounded-xl transition flex items-center space-x-2 cursor-pointer relative ${
                activeTab === 'invitations_list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Undangan Staff ({allInvitations.length})</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                id="staff-invitation-search-query"
                name="searchQuery"
                type="text"
                placeholder={activeTab === 'staff_list' ? "Cari nama / email staf..." : "Cari email undangan..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 w-52 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: DAFTAR ANGGOTA STAF AKTIF */}
        {activeTab === 'staff_list' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-700" />
                <h2 className="text-sm font-bold text-gray-800">
                  Daftar Staf Cabang ({filteredStaff.length})
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <label htmlFor="staff-role-filter" className="text-xs font-semibold text-gray-500">Filter Role:</label>
                <select
                  id="staff-role-filter"
                  name="roleFilter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
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
                        <td className="px-4 py-3 text-gray-600 font-mono">{staff.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded uppercase text-[10px] border border-blue-200">
                            {staff.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {staff.isBound ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] flex items-center space-x-1 w-max">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Terikat Auth UID</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] flex items-center space-x-1 w-max">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Menunggu Klaim</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-[11px]">
                          {staff.createdAt
                            ? new Date(staff.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
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
        )}

        {/* TAB 2: UNGGAN STAFF (UNDANGAN PENDING & RIWAYAT UNDANGAN) */}
        {activeTab === 'invitations_list' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h2 className="text-sm font-bold text-gray-800">
                  Daftar Undangan Staff ({filteredInvitations.length})
                </h2>
              </div>

              {/* Status Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 flex items-center space-x-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Status:</span>
                </span>
                <select
                  id="invitation-status-filter"
                  name="invitationStatusFilter"
                  value={invitationStatusFilter}
                  onChange={(e) => setInvitationStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-gray-700 cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Pending ({allInvitations.filter(i => i.status === 'pending').length})</option>
                  <option value="accepted">Accepted / Diterima ({allInvitations.filter(i => i.status === 'accepted').length})</option>
                  <option value="expired">Kedaluwarsa ({allInvitations.filter(i => i.status === 'expired').length})</option>
                  <option value="revoked">Dibatalkan / Revoked ({allInvitations.filter(i => i.status === 'revoked').length})</option>
                </select>

                <button
                  type="button"
                  onClick={fetchData}
                  disabled={loadingData}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingData ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {loadingData ? (
              <div className="p-8 text-center text-xs text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                <span>Memuat daftar undangan...</span>
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                Tidak ada data undangan dengan filter yang dipilih.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-4 py-3">Email Penerima</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Tanggal Dibuat</th>
                      <th className="px-4 py-3">Masa Berlaku</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Tindakan / Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredInvitations.map((inv) => {
                      const sessionUrl = sessionInviteLinks[inv.id] || sessionInviteLinks[inv.email];
                      const isPending = inv.status === 'pending';

                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-4 py-3 font-semibold text-gray-900 font-mono">
                            {inv.email}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded uppercase text-[10px]">
                              {inv.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-[11px]">
                            {inv.createdAt
                              ? new Date(inv.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-[11px]">
                            {inv.expiresAt
                              ? new Date(inv.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {inv.status === 'pending' && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] inline-flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>Pending</span>
                              </span>
                            )}
                            {inv.status === 'accepted' && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px] inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Accepted</span>
                              </span>
                            )}
                            {inv.status === 'expired' && (
                              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 font-bold rounded text-[10px]">
                                Kedaluwarsa
                              </span>
                            )}
                            {inv.status === 'revoked' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                                Revoked (Dibatalkan)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {/* SALIN TAUTAN HANYA JIKA RAW TOKEN TERSEDIA SECARA AMAN DI MEMORI SESI */}
                              {sessionUrl ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopyTableLink(inv.id, sessionUrl)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                                  title="Salin tautan undangan aktif dari memori sesi"
                                >
                                  {copiedTableLinkId === inv.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>Tersalin!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Salin Tautan</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span 
                                  className="text-[10px] text-gray-400 italic cursor-help"
                                  title="Tautan hanya tersedia saat undangan pertama kali dibuat. Buat undangan baru jika tautan hilang."
                                >
                                  Tautan hanya di memori awal
                                </span>
                              )}

                              {/* BATALKAN UNDANGAN (HANYA UNTUK STATUS PENDING) */}
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => setRevokeConfirmModal({ id: inv.id, email: inv.email })}
                                  disabled={revokingId === inv.id}
                                  className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition inline-flex items-center space-x-1 cursor-pointer border border-red-100 disabled:opacity-50"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>Batalkan</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: DIALOG KONFIRMASI UNDANGAN BERHASIL DIBUAT */}
      {inviteSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left relative">
            <button
              type="button"
              onClick={() => setInviteSuccessModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              aria-label="Tutup Dialog Undangan"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Undangan Staf Berhasil Diterbitkan!
                </h3>
                <p className="text-xs text-gray-500">
                  Token undangan resmi telah dibuat di database Supabase RLS.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-gray-500 font-medium">Email Penerima:</span>
                <span className="font-bold text-gray-900 font-mono">{inviteSuccessModal.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-gray-500 font-medium">Role yang Diundang:</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded uppercase text-[10px]">
                  {inviteSuccessModal.role}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-gray-500 font-medium">Nama Tenant / GOR:</span>
                <span className="font-bold text-gray-800">{inviteSuccessModal.tenantName}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 font-medium">Masa Berlaku:</span>
                <span className="font-semibold text-amber-700 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {inviteSuccessModal.expiresAt 
                      ? `7 Hari (s.d. ${new Date(inviteSuccessModal.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`
                      : '7 Hari'}
                  </span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="modal-invite-url-input" className="block text-xs font-bold text-gray-700 uppercase">
                Tautan Undangan Lengkap
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="modal-invite-url-input"
                  name="modalInviteUrl"
                  type="text"
                  readOnly
                  value={inviteSuccessModal.inviteUrl}
                  className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl font-mono text-gray-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyModalLink(inviteSuccessModal.inviteUrl)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  {copiedModalLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Tautan</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Penting:</strong> Salin dan bagikan tautan ini ke penerima. Tautan ini tetap tersedia selama dialog ini terbuka. Setelah dialog ditutup dan halaman di-refresh, tautan tidak dapat dimunculkan kembali demi keamanan token.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInviteSuccessModal(null)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DIALOG KONFIRMASI PEMBATALAN UNDANGAN */}
      {revokeConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left relative">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-gray-900">
                Batalkan Undangan Staf?
              </h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin membatalkan undangan untuk <strong className="text-gray-900 font-mono">{revokeConfirmModal.email}</strong>? Tautan yang pernah diterbitkan tidak akan bisa digunakan lagi untuk mengklaim akun staf.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokeConfirmModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeRevokeInvitation(revokeConfirmModal.id, revokeConfirmModal.email)}
                disabled={revokingId === revokeConfirmModal.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {revokingId === revokeConfirmModal.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ya, Batalkan Undangan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
