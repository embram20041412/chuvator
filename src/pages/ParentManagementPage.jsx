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
  Send,
  Trash2
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
    if (selectedStudentIds.length === 0) {
      setFormError('Minimal pilih satu siswa untuk dihubungkan.');
      return;
    }
    
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
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

  const handleResend = async (parentId) => {
    setActionLoadingId(parentId);
    setActionMessage(null);
    try {
      const res = await parentService.resendInvitation(parentId);
      setActionMessage({ type: 'success', text: res.message || 'Email pemulihan berhasil dikirim.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Gagal mengirim email pemulihan.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
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
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manajemen Wali Murid V2.6.1</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Kelola siklus hidup akun portal wali murid, verifikasi status Auth, pemulihan undangan, dan hubungan siswa.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-2 self-start cursor-pointer"
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
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <button 
            onClick={fetchParents}
            className="p-2 text-gray-500 hover:text-indigo-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
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
                  <th className="px-6 py-3">Email & Telepon</th>
                  <th className="px-6 py-3">Status Aktivasi (Auth)</th>
                  <th className="px-6 py-3">Siswa Terhubung</th>
                  <th className="px-6 py-3 text-right">Aksi & Pemulihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredParents.map((parent) => {
                  const status = parent.status;
                  let badge = { label: 'Menunggu Aktivasi', color: 'bg-amber-50 text-amber-700 border-amber-200' };
                  if (status === 'active') {
                    badge = { label: 'Aktif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                  } else if (status === 'unverifiable') {
                    badge = { label: 'Tidak Dapat Diverifikasi', color: 'bg-red-50 text-red-700 border-red-200' };
                  }

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
                          <div className="flex items-center space-x-1.5 mt-1 text-gray-500">
                            <Phone className="w-3 h-3 text-gray-400" />
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
                            <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold border border-indigo-100">
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
                          onClick={() => handleResend(parent.id)}
                          disabled={actionLoadingId === parent.id}
                          title="Kirim ulang email pemulihan"
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition inline-flex items-center space-x-1 disabled:opacity-50"
                        >
                          {actionLoadingId === parent.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          <span>Pemulihan Email</span>
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl relative my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-gray-900">Tambah Akun Wali Murid Baru</h3>
              </div>
              <button onClick={closeAndReset} className="p-1.5 hover:bg-gray-100 rounded-full transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {successResult ? (
              <div className="p-10 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">Akun Berhasil Dibuat!</h4>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    Undangan akses telah dikirimkan ke email <strong className="text-gray-800">{successResult.data?.email}</strong>.<br />
                    Wali murid dapat mengaktifkan akun melalui tautan email.
                  </p>
                </div>
                <button 
                  onClick={closeAndReset}
                  className="px-8 py-2.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition text-sm"
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
                          className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
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
                          className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase px-1">Nomor WhatsApp / HP</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                          type="tel"
                          placeholder="08123456..."
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
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
                            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
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
                        className="w-full px-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
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
                                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                                : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                            }`}
                          >
                            <div className="text-left overflow-hidden">
                              <p className="font-bold text-xs text-gray-800 truncate">{student.name}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">KK Akhiran: ****{student.kkLast4}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                              selectedStudentIds.includes(student.studentId)
                                ? 'border-indigo-600 bg-indigo-600'
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
                      <span>Proses ini akan mengundang wali murid via email dan menghubungkan data siswa secara otomatis.</span>
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting || selectedStudentIds.length === 0}
                      className="w-full sm:w-auto px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20"
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
