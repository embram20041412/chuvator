import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Copy, 
  Send,
  Info
} from 'lucide-react';
import { createStaffInvitation } from '../services/staffService';

export default function StaffAndWorkerManagement({ userProfile }) {
  const tenantId = userProfile?.tenantId || userProfile?.tenant?.id || 'demo-tenant-id';

  // Staff Registration Form State
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('kasir');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regResult, setRegResult] = useState(null); // { type: 'success' | 'error', message: string, inviteUrl?: string }
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!staffEmail || !staffName) return;

    setIsSubmitting(true);
    setRegResult(null);

    try {
      const res = await createStaffInvitation({
        email: staffEmail,
        fullName: staffName,
        displayName: staffName,
        role: staffRole,
        tenantId: tenantId
      });

      setRegResult({
        type: 'success',
        message: `Tautan undangan untuk ${staffEmail} berhasil diterbitkan via RPC create_staff_invitation!`,
        inviteUrl: res.inviteUrl,
        expiresAt: res.expiresAt
      });

      setStaffEmail('');
      setStaffName('');
    } catch (err) {
      console.error('[StaffAndWorkerManagement] Invitation failed:', err);
      setRegResult({
        type: 'error',
        message: err.message || 'Gagal membuat undangan staf di database.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-6 text-left">
      {/* CARD 1: PANDUAN ARSITEKTUR RLS SUPABASE */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-center space-x-2.5 border-b border-gray-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="font-bold text-sm text-[#333333]">Arsitektur Resmi: Supabase RLS &amp; RPC</h3>
            <p className="text-xs text-gray-500">Pendaftaran staf berbasis zero-trust database RPC tanpa perantara Service Role Key</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Sistem CHUVATOR menggunakan mekanisme undangan berbasis PostgreSQL SECURITY DEFINER RPC (<code>create_staff_invitation</code> &amp; <code>claim_staff_invitation</code>). Auth UID tidak dapat di-binding langsung oleh klien, melainkan diverifikasi melalui token kriptografi 32-byte ber-hash SHA-256.
        </p>
      </div>

      {/* CARD 2: FORM UNDANGAN STAF BARU */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex items-center space-x-2.5 border-b border-gray-100 pb-3">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-sm text-[#333333]">Buat Undangan Staf Baru</h3>
            <p className="text-xs text-gray-500">Menerbitkan token undangan resmi database untuk staf arena</p>
          </div>
        </div>

        {regResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
            regResult.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center space-x-2 font-bold">
              {regResult.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{regResult.message}</span>
            </div>

            {regResult.inviteUrl && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-2">
                  <input
                    id="staff-generated-invite-url"
                    name="inviteUrl"
                    aria-label="Tautan Undangan Staf"
                    type="text"
                    readOnly
                    value={regResult.inviteUrl}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-green-300 rounded-lg font-mono text-gray-700 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(regResult.inviteUrl)}
                    className="px-3 py-2 bg-green-700 hover:bg-green-800 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'Tersalin!' : 'Salin Tautan'}</span>
                  </button>
                </div>
                <div className="flex items-start space-x-1.5 text-[11px] text-green-900 bg-white/70 p-2 rounded-lg">
                  <Info className="w-3.5 h-3.5 text-green-700 shrink-0 mt-0.5" />
                  <span>Kirimkan tautan ini ke calon staf. Calon staf akan membuka tautan, memverifikasi email, dan mengklaim akunnya.</span>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="staff-worker-name-input" className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Lengkap Staf</label>
              <input
                id="staff-worker-name-input"
                name="staffName"
                autoComplete="name"
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Budi Kasir"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label htmlFor="staff-worker-email-input" className="block text-xs font-bold text-gray-700 uppercase mb-1">Email Staf</label>
              <input
                id="staff-worker-email-input"
                name="staffEmail"
                autoComplete="email"
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="staf@chuasport.com"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="staff-worker-role-select" className="block text-xs font-bold text-gray-700 uppercase mb-1">Role Akses (RBAC)</label>
              <select
                id="staff-worker-role-select"
                name="staffRole"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-blue-700"
              >
                <option value="kasir">Kasir (POS &amp; Struk)</option>
                <option value="coach">Pelatih Akademi</option>
                <option value="staff">Staf Lapangan</option>
                <option value="admin">Admin Cabang</option>
              </select>
            </div>

            <div>
              <label htmlFor="staff-worker-tenant-id-input" className="block text-xs font-bold text-gray-700 uppercase mb-1">Tenant ID</label>
              <input
                id="staff-worker-tenant-id-input"
                name="tenantId"
                type="text"
                disabled
                value={tenantId}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-200/60 border border-gray-200 rounded-xl text-gray-600 font-mono font-bold cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat Undangan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Terbitkan Undangan Staf</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
