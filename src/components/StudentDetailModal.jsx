import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getClasses, updateStudent } from '../services/supabaseAcademyService';
import { getStudentTransactions } from '../services/supabaseArenaService';
import { 
  X, 
  User, 
  Phone, 
  School, 
  FileText, 
  MapPin, 
  GraduationCap, 
  Receipt, 
  Trophy, 
  Plus, 
  CheckCircle2, 
  Inbox, 
  Calendar, 
  DollarSign,
  Award,
  Edit3,
  Check,
  Loader2,
  TrendingUp,
  IdCard
} from 'lucide-react';
import GrowthTrackerSection from './GrowthTrackerSection';
import { calculateAge, sortClassesByAgeGroup } from '../utils/helpers';

export default function StudentDetailModal({
  isOpen,
  onClose,
  student,
  userProfile,
  academyClasses = [],
  onEditStudent,
  onStudentUpdated,
  onGenerateIdCard
}) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  // Active Tab: 'profil' | 'keuangan' | 'turnamen'
  const [activeTab, setActiveTab] = useState('profil');

  // Real-Time Student Transactions History (Tab 2)
  const [studentTransactions, setStudentTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  // Tournament Form States (Tab 3)
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentDate, setTournamentDate] = useState(new Date().toISOString().split('T')[0]);
  const [tournamentResult, setTournamentResult] = useState('Juara 1');
  const [addingTournament, setAddingTournament] = useState(false);
  const [tournamentMsg, setTournamentMsg] = useState(null);

  // Local student state to reflect tournament updates immediately
  const [currentStudent, setCurrentStudent] = useState(student);

  // Class update states
  const [classesList, setClassesList] = useState(academyClasses);
  const [isEditingClass, setIsEditingClass] = useState(false);
  const [editClassId, setEditClassId] = useState(student?.classId || '');
  const [savingClass, setSavingClass] = useState(false);
  const [classUpdateMsg, setClassUpdateMsg] = useState(null);

  useEffect(() => {
    setCurrentStudent(student);
    setEditClassId(student?.classId || '');
  }, [student]);

  // Sync classesList
  useEffect(() => {
    if (academyClasses && academyClasses.length > 0) {
      setClassesList(academyClasses);
    } else if (tenantId && isOpen) {
      getClasses(tenantId).then((list) => {
        setClassesList(list || []);
      }).catch((err) => {
        console.error('Error fetching classes for student modal:', err);
      });
    }
  }, [academyClasses, tenantId, isOpen]);

  const handleSaveClassChange = async () => {
    if (!currentStudent?.id) return;
    setSavingClass(true);
    setClassUpdateMsg(null);
    try {
      const selectedClassObj = classesList.find((c) => c.id === editClassId);
      const updatedFields = {
        classId: editClassId || '',
        className: selectedClassObj?.className || '',
        coachName: selectedClassObj?.coachName || '',
        sportCategory: selectedClassObj?.sport || currentStudent.sportCategory || 'Badminton'
      };

      const updatedObj = await updateStudent(currentStudent.id, updatedFields);

      setCurrentStudent({ ...currentStudent, ...updatedObj, ...updatedFields });
      if (onStudentUpdated) {
        onStudentUpdated({ ...currentStudent, ...updatedObj, ...updatedFields });
      }
      setIsEditingClass(false);
      setClassUpdateMsg('Kelas siswa berhasil diperbarui!');
      setTimeout(() => setClassUpdateMsg(null), 3000);
    } catch (err) {
      console.error('Error updating student class in Supabase:', err);
      alert('Gagal mengupdate kelas siswa: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSavingClass(false);
    }
  };

  // Fetch student transactions from Supabase
  useEffect(() => {
    if (!isOpen || !student?.id || !tenantId) return;

    setLoadingTx(true);
    getStudentTransactions(tenantId, student.id)
      .then((list) => {
        setStudentTransactions(list || []);
      })
      .catch((error) => {
        console.error('Error fetching student transactions from Supabase:', error);
        setStudentTransactions([]);
      })
      .finally(() => {
        setLoadingTx(false);
      });
  }, [isOpen, student?.id, tenantId]);

  if (!isOpen || !currentStudent) return null;

  // Add Tournament Achievement Handler (Tab 3)
  const handleAddTournament = async (e) => {
    e.preventDefault();
    if (!tournamentName.trim() || !currentStudent.id) return;

    setAddingTournament(true);
    setTournamentMsg(null);

    try {
      const newEntry = {
        id: Date.now().toString(),
        name: tournamentName.trim(),
        date: tournamentDate,
        result: tournamentResult,
        createdAt: new Date().toISOString()
      };

      const existingTournaments = currentStudent.tournaments || [];
      const updatedTournaments = [newEntry, ...existingTournaments];

      await updateStudent(currentStudent.id, {
        tournaments: updatedTournaments
      });

      const updatedStudentObj = { ...currentStudent, tournaments: updatedTournaments };
      setCurrentStudent(updatedStudentObj);
      if (onStudentUpdated) {
        onStudentUpdated(updatedStudentObj);
      }

      setTournamentName('');
      setTournamentMsg('Prestasi turnamen berhasil ditambahkan!');
      setTimeout(() => setTournamentMsg(null), 3000);
    } catch (err) {
      console.error('Error adding tournament in Supabase:', err);
      alert('Gagal menambahkan turnamen: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setAddingTournament(false);
    }
  };

  // Full address calculation
  const fullAddress = [
    currentStudent.addressDetail,
    currentStudent.village ? `Kel. ${currentStudent.village}` : null,
    currentStudent.district ? `Kec. ${currentStudent.district}` : null,
    currentStudent.regency,
    currentStudent.province
  ].filter(Boolean).join(', ');

  if (!isOpen || !student) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 lg:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER (Sticky) */}
        <div className="bg-gradient-to-r from-[#1E2B28] to-[#243531] text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-[#354944]">
          <div className="flex items-center space-x-3">
            {currentStudent.photoUrl ? (
              <img
                src={currentStudent.photoUrl}
                alt={currentStudent.studentName}
                className="w-12 h-12 rounded-2xl object-cover shadow-md border-2 border-white/20 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 bg-[#354944] text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md shrink-0 border border-[#C89D32]/40">
                <GraduationCap className="w-6 h-6 text-[#C89D32]" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                <span>{currentStudent.studentName}</span>
                {calculateAge(currentStudent.birthDate) !== '-' && (
                  <span className="px-2 py-0.5 bg-[#C89D32]/20 text-[#D4A73A] border border-[#C89D32]/40 rounded-md text-xs font-semibold">
                    {calculateAge(currentStudent.birthDate)} Thn
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-300">
                Siswa Akademi {currentStudent.sportCategory || 'Badminton'} &bull; Bergabung {currentStudent.joinDate || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onGenerateIdCard && (
              <button
                type="button"
                onClick={() => onGenerateIdCard(currentStudent)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                title="Cetak / Generate ID Card Siswa"
              >
                <IdCard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cetak ID Card</span>
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION BAR */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('profil')}
            className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'profil'
                ? 'border-[#354944] text-[#354944] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profil</span>
          </button>

          <button
            onClick={() => setActiveTab('pertumbuhan')}
            className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'pertumbuhan'
                ? 'border-[#354944] text-[#354944] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Growth & Gizi AI</span>
          </button>

          <button
            onClick={() => setActiveTab('keuangan')}
            className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'keuangan'
                ? 'border-[#354944] text-[#354944] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Histori</span>
          </button>

          <button
            onClick={() => setActiveTab('turnamen')}
            className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'turnamen'
                ? 'border-[#354944] text-[#354944] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Prestasi</span>
          </button>
        </div>

        {/* MODAL CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
          
          {/* TAB 1: PROFIL DEMOGRAFI LENGKAP */}
          {activeTab === 'profil' && (
            <div className="space-y-4 animate-fade-in">
              {classUpdateMsg && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>{classUpdateMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* IDENTITAS SISWA */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Identitas Siswa</p>
                    {onEditStudent && (
                      <button
                        type="button"
                        onClick={() => onEditStudent(currentStudent)}
                        className="text-[11px] font-bold text-[#354944] hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-[#C89D32]" />
                        <span>Edit Profil</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 my-1">
                    {currentStudent.photoUrl ? (
                      <img
                        src={currentStudent.photoUrl}
                        alt={currentStudent.studentName}
                        className="w-12 h-12 rounded-xl object-cover border border-[#354944]/20 shadow-2xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#354944]/10 text-[#354944] font-bold flex items-center justify-center text-sm border border-[#354944]/20 shadow-2xs">
                        {currentStudent.studentName ? currentStudent.studentName.slice(0, 2).toUpperCase() : 'SW'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-[#333333]">{currentStudent.studentName}</p>
                      <p className="text-[11px] text-gray-400">ID Siswa: #{currentStudent.id?.slice(0, 8).toUpperCase() || 'NEW'}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <p className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#354944]" />
                      <span>Tgl Lahir: <strong className="text-[#333333]">{currentStudent.birthDate || '-'}</strong></span>
                    </p>
                    <p className="flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#354944]" />
                      <span>NIK/KK: <strong className="text-[#333333] font-mono">{currentStudent.nikKk || '-'}</strong></span>
                    </p>
                    <p className="flex items-center space-x-1.5">
                      <School className="w-3.5 h-3.5 text-[#354944]" />
                      <span>Asal Sekolah: <strong className="text-[#333333]">{currentStudent.schoolOrigin || '-'}</strong></span>
                    </p>
                    <p className="flex items-center space-x-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-[#354944]" />
                      <span>Kelas / Kelompok: <strong className="text-[#333333]">{currentStudent.className || 'Belum Terdaftar'}</strong></span>
                    </p>
                    <p className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-[#354944]" />
                      <span>Pelatih Utama: <strong className="text-[#333333]">{currentStudent.coachName || 'Belum Ditugaskan'}</strong></span>
                    </p>
                  </div>
                </div>

                {/* KONTAK ORTU */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kontak Orang Tua / Wali</p>
                  <p className="text-sm font-bold text-[#333333]">{currentStudent.parentName || '-'}</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p className="flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-green-600" />
                      <span>WhatsApp: <strong className="text-[#333333]">{currentStudent.parentPhone || '-'}</strong></span>
                    </p>
                    <p className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#354944]" />
                      <span>Bergabung: <strong className="text-[#333333]">{currentStudent.joinDate || '-'}</strong></span>
                    </p>
                  </div>
                </div>

              </div>

              {/* CARD RELASI KELAS & PELATIH + SINKRONISASI UPDATE */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="w-4 h-4 text-[#354944]" />
                    <h5 className="font-bold text-xs text-[#354944] uppercase tracking-wider">
                      Kelas &amp; Pelatih
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingClass(!isEditingClass)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[#354944] border border-[#354944]/30 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Edit3 className="w-3 h-3 text-[#C89D32]" />
                    <span>{isEditingClass ? 'Batal' : 'Ubah / Pindah Kelas'}</span>
                  </button>
                </div>

                {isEditingClass ? (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 animate-fade-in">
                    <label className="block text-[11px] font-bold text-gray-700">
                      Pilih Kelas / Kelompok Latihan Baru:
                    </label>
                    <select
                      value={editClassId}
                      onChange={(e) => setEditClassId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#354944] font-medium text-gray-800"
                    >
                      <option value="">-- Tidak Terikat Kelas --</option>
                      {sortClassesByAgeGroup(classesList).map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.className} ({cls.sport || 'Umum'}) - Pelatih: {cls.coachName || '-'}
                        </option>
                      ))}
                    </select>

                    {editClassId && (() => {
                      const sel = classesList.find((c) => c.id === editClassId);
                      if (!sel) return null;
                      return (
                        <p className="text-[10px] text-gray-500">
                          Pelatih: <strong>{sel.coachName || '-'}</strong> &bull; Jadwal: <strong>{sel.schedule || '-'}</strong>
                        </p>
                      );
                    })()}

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingClass(false)}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={savingClass}
                        onClick={handleSaveClassChange}
                        className="px-4 py-1.5 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] text-xs font-bold rounded-lg flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingClass ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 text-[#C89D32]" />
                            <span>Simpan Kelas</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Kelas Terdaftar</span>
                      <span className="font-bold text-gray-800 text-sm">
                        {currentStudent.className || 'Belum Terdaftar'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Pelatih Penanggung Jawab</span>
                      <span className="font-bold text-gray-800 text-sm">
                        {currentStudent.coachName || 'Belum Ditugaskan'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status SPP & Finansial */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-700">Tarif SPP Bulanan:</p>
                  <p className="text-lg font-black text-[#C89D32]">
                    Rp {Number(currentStudent.monthlyFee || 0).toLocaleString('id-ID')}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-700 mb-1 text-right">Status Terakhir:</p>
                  <span className={`px-3 py-1 font-extrabold rounded-full text-xs uppercase ${
                    currentStudent.sppStatus === 'Lunas'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {currentStudent.sppStatus || 'Belum Lunas'}
                  </span>
                </div>
              </div>

              {/* Alamat Administratif */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-[#354944]" />
                  <span>Alamat Administratif Emsifa</span>
                </p>
                <p className="text-xs text-gray-700 leading-relaxed font-medium">
                  {fullAddress || 'Detail alamat belum dilengkapi.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 1.5: ANTROPOMETRI (GROWTH TRACKER & AI GIZI) */}
          {activeTab === 'pertumbuhan' && (
            <div className="animate-fade-in">
              <GrowthTrackerSection selectedStudent={currentStudent || student} />
            </div>
          )}

          {/* TAB 2: HISTORI PEMBAYARAN KEUANGAN SPP */}
          {activeTab === 'keuangan' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h4 className="font-bold text-xs text-[#333333] uppercase tracking-wider">
                  Riwayat Pembayaran SPP ({studentTransactions.length} Transaksi)
                </h4>
              </div>

              {loadingTx ? (
                <p className="py-8 text-center text-xs text-gray-500">Memuat riwayat transaksi SPP...</p>
              ) : studentTransactions.length === 0 ? (
                <div className="py-10 border-2 border-dashed border-gray-200 rounded-xl text-center p-6 space-y-1">
                  <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-600">Belum ada riwayat pembayaran SPP</p>
                  <p className="text-[10px] text-gray-400">Transaksi SPP yang dibayarkan akan otomatis tercatat di sini.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                  {studentTransactions.map((tx) => (
                    <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-bold text-xs text-[#333333]">{tx.itemName}</p>
                        <div className="flex items-center space-x-2 text-[10px] text-gray-400 mt-0.5">
                          <span>Metode: <strong className="text-gray-600">{tx.paymentMethod}</strong></span>
                          <span>&bull;</span>
                          <span>Catat: {tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString('id-ID') : 'Baru saja'}</span>
                        </div>
                      </div>

                      <span className="font-extrabold text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
                        + Rp {Number(tx.amount || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRESTASI TURNAMEN & REKAP JUARA */}
          {activeTab === 'turnamen' && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Form Tambah Turnamen */}
              <form onSubmit={handleAddTournament} className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4" />
                    <span>Catat Prestasi Turnamen Baru</span>
                  </h4>
                </div>

                {tournamentMsg && (
                  <div className="p-2 bg-green-100 text-green-800 text-xs rounded-lg font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    <span>{tournamentMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Nama Turnamen</label>
                    <input
                      type="text"
                      required
                      value={tournamentName}
                      onChange={(e) => setTournamentName(e.target.value)}
                      placeholder="misal: Kejurda Badminton 2026"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={tournamentDate}
                      onChange={(e) => setTournamentDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Pencapaian / Hasil</label>
                    <select
                      value={tournamentResult}
                      onChange={(e) => setTournamentResult(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 font-bold text-[#333333]"
                    >
                      <option value="Juara 1">🥇 Juara 1 (Gold)</option>
                      <option value="Juara 2">🥈 Juara 2 (Silver)</option>
                      <option value="Juara 3">🥉 Juara 3 (Bronze)</option>
                      <option value="Semifinalist">Semifinalist</option>
                      <option value="8 Besar">Gugur 8 Besar</option>
                      <option value="Peserta">Peserta</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addingTournament}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center space-x-1.5 ml-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addingTournament ? 'Menyimpan...' : '+ Tambah Prestasi'}</span>
                </button>
              </form>

              {/* Tournament Achievements List */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[#333333] uppercase tracking-wider">
                  Riwayat Turnamen Diikuti ({(currentStudent.tournaments || []).length})
                </h4>

                {(!currentStudent.tournaments || currentStudent.tournaments.length === 0) ? (
                  <div className="py-8 border-2 border-dashed border-gray-200 rounded-xl text-center p-4">
                    <Award className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                    <p className="text-xs font-bold text-gray-500">Belum ada riwayat turnamen</p>
                    <p className="text-[10px] text-gray-400">Gunakan form di atas untuk menambahkan pengalaman turnamen siswa.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                    {currentStudent.tournaments.map((t, idx) => (
                      <div key={t.id || idx} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold">
                            <Trophy className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-xs text-[#333333]">{t.name}</p>
                            <p className="text-[10px] text-gray-400">{t.date}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 font-extrabold text-[11px] rounded-lg ${
                          t.result?.includes('Juara 1')
                            ? 'bg-amber-100 text-amber-800'
                            : t.result?.includes('Juara 2')
                            ? 'bg-gray-200 text-gray-800'
                            : t.result?.includes('Juara 3')
                            ? 'bg-amber-800/10 text-amber-900'
                            : 'bg-[#354944]/10 text-[#354944]'
                        }`}>
                          {t.result}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* MODAL FOOTER (Sticky) */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            ID Atlet: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{currentStudent.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {onGenerateIdCard && (
              <button
                type="button"
                onClick={() => onGenerateIdCard(currentStudent)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#354944] hover:bg-[#2B3D38] text-white border-b-2 border-[#C89D32] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <IdCard className="w-4 h-4 text-[#C89D32]" />
                <span>Cetak ID Card</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
