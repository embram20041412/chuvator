import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { logoutUser } from '../services/authService';
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
  RefreshCw
} from 'lucide-react';

export default function SaasAdminPage({ userProfile }) {
  const [invitations, setInvitations] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(true);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('owner');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

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

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => { fetchInvitations(); fetchTenants(); }}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer border border-gray-200"
              title="Refresh Data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={logoutUser}
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
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Email Pengguna</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="contoh: owner@sportarena.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Role Akses</label>
                  <select
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
                /* EMPTY STATE UI - strictly complying with Rule 2 */
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
                /* EMPTY STATE UI */
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
                      <p className="text-xs text-gray-500">Pemilik: {t.ownerEmail}</p>
                      <p className="text-xs text-gray-500">Alamat: {t.address || '-'}</p>
                      <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-200/60">
                        Cabang: {t.branchesCount || 1} | Lapangan: {t.courtsCount || 0}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
