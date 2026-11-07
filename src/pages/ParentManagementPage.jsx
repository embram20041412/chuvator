import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Mail, 
  User, 
  Phone,
  CreditCard,
  X,
  ChevronRight,
  Info,
  Trash2,
  MessageSquare,
  Copy,
  ExternalLink,
  Check
} from 'lucide-react';
import { parentService } from '../services/parentService';

export default function ParentManagementPage({ userProfile }) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;
  
  // List States
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    kk: '',
    relationship: 'guardian'
  });
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [searchResults, setSearchStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  // WhatsApp Modal States
  const [activeWhatsAppModal, setActiveWhatsAppModal] = useState(null);
  const [isGeneratingWhatsApp, setIsGeneratingWhatsApp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isConfirmingSent, setIsConfirmingSent] = useState(false);

  // Action feedback states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchParents = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await parentService.getParentAccounts();
      setParents(data);
    } catch (err) {
      console.error('Error fetching parents:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  const handleSearchStudents = async () => {
    if (formData.kk.length !== 16) {
      setFormError('Nomor KK harus tepat 16 digit.');
      return;
    }
    setFormError(null);
    setIsSearchingStudents(true);
    setSearchStudents([]);
    setSelectedStudentIds([]);
    
    try {
      const result = await parentService.searchStudentsByKK(formData.kk);
      setSearchStudents(result.data || []);
      if (result.data?.length === 0) {
        setFormError('Tidak ditemukan siswa dengan nomor KK tersebut di tenant ini.');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSearchingStudents(false);
    }
  };

  const handleToggleStudent = (id) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.phone || !formData.phone.trim()) {
      setFormError('Nomor WhatsApp wajib diisi.');
      return;
    }

    const cleanedPhone = formData.phone.trim().replace(/\D/g, '');
    let normalizedPhone = cleanedPhone;
    if (normalizedPhone.startsWith('0')) normalizedPhone = '62' + normalizedPhone.slice(1);
    else if (normalizedPhone.startsWith('8')) normalizedPhone = '62' + normalizedPhone;

    if (normalizedPhone.length < 10 || normalizedPhone.length > 15 || (normalizedPhone.startsWith('62') && !normalizedPhone.startsWith('628'))) {
      setFormError('Nomor WhatsApp tidak valid. Masukkan nomor seluler yang valid (contoh: 08123456789).');
      return;
    }

    if (selectedStudentIds.length === 0) {
      setFormError('Minimal pilih satu siswa untuk dihubungkan.');
      return;
    }
    
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        phone: normalizedPhone,
        studentIds: selectedStudentIds
      };
      const result = await parentService.createParentAccount(payload);
      setSuccessResult(result);
      fetchParents();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsAppModal = async (parentId) => {
    setActionLoadingId(parentId);
    setActionMessage(null);
    setIsGeneratingWhatsApp(true);
    setCopiedLink(false);
    setCopiedMessage(false);

    try {
      const res = await parentService.generateWhatsAppInvitation(parentId);
      setActiveWhatsAppModal(res.data || res);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal menyiapkan tautan WhatsApp.' });
    } finally {
      setIsGeneratingWhatsApp(false);
      setActionLoadingId(null);
    }
  };

  const handleConfirmSent = async (parentId) => {
    setIsConfirmingSent(true);
    try {
      await parentService.confirmManualSent(parentId);
      setActionMessage({ type: 'success', text: 'Undangan berhasil ditandai telah dikirim via WhatsApp.' });
      if (activeWhatsAppModal) {
        setActiveWhatsAppModal(prev => ({ ...prev, status: 'SENT_MANUALLY' }));
      }
      fetchParents();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal menandai pengiriman undangan.' });
    } finally {
      setIsConfirmingSent(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleCopyLink = (link) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyMessage = (msg) => {
    if (!msg) return;
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  const handleDelete = async (parentId, parentName) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan pendaftaran dan menghapus akun wali '${parentName}'?`)) {
      return;
    }
    setActionLoadingId(parentId);
    setActionMessage(null);
    try {
      await parentService.deleteParentAccount(parentId);
      setActionMessage({ type: 'success', text: 'Akun wali murid berhasil dihapus secara aman.' });
      fetchParents();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal menghapus akun.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const closeAndReset = () => {
    setShowAddModal(false);
    setFormData({ name: '', email: '', phone: '', kk: '', relationship: 'guardian' });
    setSearchStudents([]);
    setSelectedStudentIds([]);
    setFormError(null);
    setSuccessResult(null);
  };

  const filteredParents = parents.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery)
  );

  const getStatusBadge = (parent) => {
    const rawStatus = parent.invitationStatus || (parent.status === 'active' ? 'ACTIVATED' : 'READY_TO_SEND');
    switch (rawStatus) {
      case 'ACTIVATED':
        return { label: 'Aktif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'SENT_MANUALLY':
        return { label: 'Terkirim (WA)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'EXPIRED':
        return { label: 'Kedaluwarsa', color: 'bg-red-50 text-red-700 border-red-200' };
      case 'READY_TO_SEND':
        return { label: 'Siap Kirim', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: 'Belum Dibuat', color: 'bg-gray-50 text-gray-500 border-gray-200' };
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manajemen Wali Murid</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Kelola akun wali murid, verifikasi status Auth, serta kirim undangan aktivasi manual melalui WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-2 self-start cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Akun Wali</span>
        </button>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2 ${
          actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Cari nama, email, atau no. WA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <button 
            onClick={fetchParents}
            className="p-2 text-gray-500 hover:text-emerald-600 transition"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Memverifikasi status akun wali murid...</p>
            </div>
          ) : filteredParents.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-sm">Belum ada akun wali murid yang terdaftar.</p>
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-6 py-3">Nama Wali Murid</th>
                  <th className="px-6 py-3">Email & WhatsApp</th>
                  <th className="px-6 py-3">Status Undangan</th>
                  <th className="px-6 py-3">Siswa Terhubung</th>
                  <th className="px-6 py-3 text-right">Aksi Undangan WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredParents.map((parent) => {
                  const badge = getStatusBadge(parent);
                  const isActivated = (parent.invitationStatus === 'ACTIVATED') || (parent.status === 'active');

                  return (
                    <tr key={parent.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{parent.name || parent.full_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase">ID: {parent.id.slice(0,8)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span>{parent.email}</span>
                        </div>
                        {parent.phone && (
                          <div className="flex items-center space-x-1.5 mt-1 text-gray-600 font-mono">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{parent.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {parent.links?.map((link, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full font-semibold border border-emerald-100">
                              {link.student?.name}
                            </span>
                          ))}
                          {(!parent.links || parent.links.length === 0) && (
                            <span className="text-gray-400 italic text-[11px]">Belum terhubung</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          onClick={() => handleOpenWhatsAppModal(parent.id)}
                          disabled={actionLoadingId === parent.id}
                          title={isActivated ? "Bagikan tautan pemulihan sandi via WhatsApp" : "Siapkan dan kirim undangan via WhatsApp"}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold transition inline-flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          {actionLoadingId === parent.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>{isActivated ? 'Pemulihan WA' : 'Kirim WA'}</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(parent.id, parent.name || parent.full_name)}
                          disabled={actionLoadingId === parent.id}
                          title="Batalkan pendaftaran & hapus akun secara aman"
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold transition inline-flex items-center space-x-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* WhatsApp Modal */}
      {activeWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl relative my-8 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">
                    {activeWhatsAppModal.isConfirmed ? 'Pemulihan Akun via WhatsApp' : 'Undangan Aktivasi via WhatsApp'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Akademi: <strong className="text-gray-800">{activeWhatsAppModal.tenantName}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveWhatsAppModal(null)} 
                className="p-1.5 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Penerima</span>
                  <span className="font-bold text-gray-800">{activeWhatsAppModal.parentName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Nomor WhatsApp</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {activeWhatsAppModal.phone ? `+${activeWhatsAppModal.phone}` : '(Nomor belum diset)'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                  Pratinjau Pesan Undangan:
                </label>
                <textarea 
                  readOnly 
                  rows={9}
                  value={activeWhatsAppModal.message}
                  className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-2xl font-mono text-gray-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyLink(activeWhatsAppModal.claimUrl)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Tersalin!' : 'Salin Link Aktivasi'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyMessage(activeWhatsAppModal.message)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
                >
                  {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMessage ? 'Pesan Tersalin!' : 'Salin Seluruh Pesan'}</span>
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <a
                href={activeWhatsAppModal.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 text-center"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => handleConfirmSent(activeWhatsAppModal.parentId)}
                disabled={isConfirmingSent || activeWhatsAppModal.status === 'SENT_MANUALLY'}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-1.5"
              >
                {isConfirmingSent ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeWhatsAppModal.status === 'SENT_MANUALLY' ? 'Sudah Ditandai Terkirim' : 'Tandai Sudah Dikirim'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl relative my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-gray-900">Tambah Akun Wali Murid Baru</h3>
              </div>
              <button onClick={closeAndReset} className="p-1.5 hover:bg-gray-100 rounded-full transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {successResult ? (
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">Akun Berhasil Dibuat!</h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Akun wali murid <strong className="text-gray-800">{successResult.data?.email}</strong> telah disiapkan.<br />
                    Tautan aktivasi siap dikirimkan melalui WhatsApp.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Nomor WhatsApp:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {successResult.data?.phone ? `+${successResult.data.phone}` : '(Belum ada nomor)'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    {successResult.data?.whatsappUrl && (
                      <a
                        href={successResult.data.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl text-center flex items-center justify-center space-x-1.5 shadow"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(successResult.data?.claimUrl)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Tersalin' : 'Salin Link'}</span>
                    </button>
                  </div>
                </div>

                <button 
                  onClick={closeAndReset}
                  className="px-8 py-2.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition text-sm cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase px-1">Nama Wali Murid <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                          type="text"
                          required
                          placeholder="e.g. Budi Santoso"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase px-1">Alamat Email <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                          type="email"
                          required
                          placeholder="wali@domain.com"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase px-1">Nomor WhatsApp <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                          type="tel"
                          required
                          placeholder="081234567890"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase px-1">Nomor Kartu Keluarga (16 Digit) <span className="text-red-500">*</span></label>
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <CreditCard className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                          <input 
                            type="text"
                            required
                            maxLength={16}
                            placeholder="351234..."
                            value={formData.kk}
                            onChange={(e) => setFormData({...formData, kk: e.target.value.replace(/\D/g, '')})}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={handleSearchStudents}
                          disabled={isSearchingStudents || formData.kk.length !== 16}
                          className="px-4 py-2 bg-gray-900 text-white text-[11px] font-bold rounded-xl hover:bg-black transition disabled:opacity-50 flex items-center space-x-1.5"
                        >
                          {isSearchingStudents ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          <span>Cari Siswa</span>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase px-1">Hubungan dengan Siswa <span className="text-red-500">*</span></label>
                      <select 
                        required
                        value={formData.relationship}
                        onChange={(e) => setFormData({...formData, relationship: e.target.value})}
                        className="w-full px-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="father">Ayah (Father)</option>
                        <option value="mother">Ibu (Mother)</option>
                        <option value="guardian">Wali (Guardian)</option>
                        <option value="other">Lainnya (Other)</option>
                      </select>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[11px] flex items-start space-x-2 text-left">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-700 uppercase flex items-center justify-between">
                      <span>Daftar Siswa Ditemukan ({searchResults.length})</span>
                      {searchResults.length > 0 && (
                        <span className="text-[10px] text-gray-400 font-normal normal-case">Pilih siswa yang akan dihubungkan ke wali ini</span>
                      )}
                    </h4>
                    
                    {searchResults.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {searchResults.map((student) => (
                          <div 
                            key={student.studentId}
                            onClick={() => handleToggleStudent(student.studentId)}
                            className={`p-3 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between ${
                              selectedStudentIds.includes(student.studentId)
                                ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                                : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                            }`}
                          >
                            <div className="text-left overflow-hidden">
                              <p className="font-bold text-xs text-gray-800 truncate">{student.name}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">KK Akhiran: ****{student.kkLast4}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                              selectedStudentIds.includes(student.studentId)
                                ? 'border-emerald-600 bg-emerald-600'
                                : 'border-gray-300 bg-white'
                            }`}>
                              {selectedStudentIds.includes(student.studentId) && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border-2 border-dashed border-gray-100 rounded-2xl text-center text-gray-400">
                        <Info className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        <p className="text-[11px]">Silakan masukkan 16 digit nomor KK dan klik Cari Siswa untuk memvalidasi.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
                    <div className="text-[11px] text-gray-400 flex items-start space-x-1.5 text-left max-w-xs leading-normal italic">
                      <div className="p-0.5 bg-gray-100 rounded text-gray-500 shrink-0 mt-0.5">
                        <Info className="w-2.5 h-2.5" />
                      </div>
                      <span>Undangan aktivasi akan disiapkan untuk dikirimkan melalui WhatsApp ke nomor wali murid.</span>
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting || selectedStudentIds.length === 0}
                      className="w-full sm:w-auto px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memproses Akun...</span>
                        </>
                      ) : (
                        <>
                          <span>Buat Akun Wali Murid</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
