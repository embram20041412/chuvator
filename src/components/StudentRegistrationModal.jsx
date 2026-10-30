import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createStudent, updateStudent, getClasses } from '../services/supabaseAcademyService';
import { 
  X, 
  User, 
  Calendar, 
  FileText, 
  School, 
  Upload, 
  GraduationCap, 
  Phone, 
  MapPin, 
  Loader2, 
  Check,
  Lock,
  AlertTriangle,
  Camera,
  Trash2,
  Sparkles,
  Info
} from 'lucide-react';
import { uploadToCloudinary } from '../services/uploadService';
import { calculateAge } from '../utils/helpers';
import { 
  isStudentAgeMatchClass, 
  getRecommendedTierForStudent,
  sortClassesByAgeGroup
} from '../config/tierCurriculumConfig';

export default function StudentRegistrationModal({
  isOpen,
  onClose,
  academyClasses = [],
  tenantId,
  activeAcademy = null,
  activeAcademyId = '',
  uniqueSports = [],
  studentToEdit = null,
  academyPricing = null,
  onSuccess
}) {
  const isEditing = Boolean(studentToEdit);

  // Form Fields
  const [studentName, setStudentName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [onlyAgeAppropriate, setOnlyAgeAppropriate] = useState(true);
  const [nikKk, setNikKk] = useState('');
  const [schoolOrigin, setSchoolOrigin] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [sportCategory, setSportCategory] = useState(uniqueSports[0] || 'Badminton');
  const [studentClassId, setStudentClassId] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthlyFee, setMonthlyFee] = useState('');
  const [registrationFee, setRegistrationFee] = useState('');
  const [addressDetail, setAddressDetail] = useState('');

  // Foto Profil Siswa State (Opsional untuk ID Card & Barcode)
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
  };

  // Emsifa API Wilayah States
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedRegency, setSelectedRegency] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedVillage, setSelectedVillage] = useState(null);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pricingWarning, setPricingWarning] = useState(null);

  // Fallback classes listener if parent did not provide academyClasses
  const [classesList, setClassesList] = useState(academyClasses);

  // Helper to normalize sport names for case & whitespace insensitive matching
  const normalizeSport = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Auto-fill SPP and Registration fee from Master Data based on selected sportCategory
  useEffect(() => {
    if (!isOpen) return;

    const activePricingMap = academyPricing || {};

    if (sportCategory) {
      let match = activePricingMap[sportCategory];

      if (!match && Object.keys(activePricingMap).length > 0) {
        const normTarget = normalizeSport(sportCategory);
        const matchedKey = Object.keys(activePricingMap).find(
          (key) => normalizeSport(key) === normTarget
        );
        if (matchedKey) {
          match = activePricingMap[matchedKey];
        }
      }

      if (match) {
        if (!studentToEdit || sportCategory !== studentToEdit.sportCategory) {
          setMonthlyFee(String(match.spp ?? 0));
          setRegistrationFee(String(match.registration ?? 0));
        }
        setPricingWarning(null);
      } else {
        if (!studentToEdit || sportCategory !== studentToEdit.sportCategory) {
          setMonthlyFee('0');
          setRegistrationFee('0');
        }
        setPricingWarning(`Tarif Master Data untuk cabang "${sportCategory}" belum diatur di Pengaturan. Biaya disetel ke Rp 0.`);
      }
    }
  }, [sportCategory, academyPricing, isOpen, studentToEdit]);

  useEffect(() => {
    if (academyClasses && academyClasses.length > 0) {
      setClassesList(academyClasses);
    } else if (tenantId && isOpen) {
      const fetchClasses = async () => {
        try {
          const targetAcademyId = activeAcademyId || activeAcademy?.id || null;
          const classesData = await getClasses(tenantId, targetAcademyId);
          setClassesList(classesData);
        } catch (err) {
          console.error('Error fetching academy_classes fallback:', err);
        }
      };
      fetchClasses();
    }
  }, [academyClasses, tenantId, isOpen, activeAcademyId, activeAcademy?.id]);

  // Pre-fill form if editing
  useEffect(() => {
    if (studentToEdit && isOpen) {
      setStudentName(studentToEdit.studentName || '');
      setBirthDate(studentToEdit.birthDate || '');
      setNikKk(studentToEdit.nikKk || '');
      setSchoolOrigin(studentToEdit.schoolOrigin || '');
      setParentName(studentToEdit.parentName || '');
      setParentPhone(studentToEdit.parentPhone || '');
      setSportCategory(studentToEdit.sportCategory || (Array.isArray(uniqueSports) && uniqueSports.length > 0 ? uniqueSports[0] : 'Badminton'));
      setStudentClassId(studentToEdit.classId || '');
      setJoinDate(studentToEdit.joinDate || new Date().toISOString().split('T')[0]);
      setMonthlyFee(studentToEdit.monthlyFee ? String(studentToEdit.monthlyFee) : '');
      setRegistrationFee(studentToEdit.registrationFee ? String(studentToEdit.registrationFee) : '');
      setAddressDetail(studentToEdit.addressDetail || '');
      setSelectedProvince(studentToEdit.province ? { name: studentToEdit.province } : null);
      setSelectedRegency(studentToEdit.regency ? { name: studentToEdit.regency } : null);
      setSelectedDistrict(studentToEdit.district ? { name: studentToEdit.district } : null);
      setSelectedVillage(studentToEdit.village ? { name: studentToEdit.village } : null);
      setPhotoPreview(studentToEdit.photoUrl || '');
      setPhotoFile(null);
    } else if (!studentToEdit && isOpen) {
      // Reset form ONLY when opening modal
      setStudentName('');
      setBirthDate('');
      setNikKk('');
      setSchoolOrigin('');
      setParentName('');
      setParentPhone('');
      setSportCategory(Array.isArray(uniqueSports) && uniqueSports.length > 0 ? uniqueSports[0] : 'Badminton');
      setStudentClassId('');
      setJoinDate(new Date().toISOString().split('T')[0]);
      setAddressDetail('');
      setSelectedProvince(null);
      setSelectedRegency(null);
      setSelectedDistrict(null);
      setSelectedVillage(null);
      setPhotoPreview('');
      setPhotoFile(null);
      setErrorMsg(null);
    }
  }, [studentToEdit?.id, isOpen]);

  // Fetch Provinces from Emsifa API
  useEffect(() => {
    if (isOpen && provinces.length === 0) {
      async function fetchProvinces() {
        setLoadingProvinces(true);
        try {
          const res = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
          if (!res.ok) throw new Error('Gagal memuat data provinsi');
          const data = await res.json();
          setProvinces(data || []);
        } catch (err) {
          console.error('Emsifa Provinces Fetch Error:', err);
          setProvinces([]);
        } finally {
          setLoadingProvinces(false);
        }
      }
      fetchProvinces();
    }
  }, [isOpen, provinces.length]);

  // Emsifa Handlers
  const handleProvinceChange = async (e) => {
    const provId = e.target.value;
    if (!provId) {
      setSelectedProvince(null);
      setRegencies([]);
      setSelectedRegency(null);
      setDistricts([]);
      setSelectedDistrict(null);
      setVillages([]);
      setSelectedVillage(null);
      return;
    }

    const foundProv = provinces.find((p) => p.id === provId);
    setSelectedProvince(foundProv ? { id: foundProv.id, name: foundProv.name } : null);
    setRegencies([]);
    setSelectedRegency(null);
    setDistricts([]);
    setSelectedDistrict(null);
    setVillages([]);
    setSelectedVillage(null);

    setLoadingRegencies(true);
    try {
      const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provId}.json`);
      if (!res.ok) throw new Error('Gagal memuat data kota/kabupaten');
      const data = await res.json();
      setRegencies(data || []);
    } catch (err) {
      console.error('Emsifa Regencies Fetch Error:', err);
      setRegencies([]);
    } finally {
      setLoadingRegencies(false);
    }
  };

  const handleRegencyChange = async (e) => {
    const regId = e.target.value;
    if (!regId) {
      setSelectedRegency(null);
      setDistricts([]);
      setSelectedDistrict(null);
      setVillages([]);
      setSelectedVillage(null);
      return;
    }

    const foundReg = regencies.find((r) => r.id === regId);
    setSelectedRegency(foundReg ? { id: foundReg.id, name: foundReg.name } : null);
    setDistricts([]);
    setSelectedDistrict(null);
    setVillages([]);
    setSelectedVillage(null);

    setLoadingDistricts(true);
    try {
      const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${regId}.json`);
      if (!res.ok) throw new Error('Gagal memuat data kecamatan');
      const data = await res.json();
      setDistricts(data || []);
    } catch (err) {
      console.error('Emsifa Districts Fetch Error:', err);
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const handleDistrictChange = async (e) => {
    const distId = e.target.value;
    if (!distId) {
      setSelectedDistrict(null);
      setVillages([]);
      setSelectedVillage(null);
      return;
    }

    const foundDist = districts.find((d) => d.id === distId);
    setSelectedDistrict(foundDist ? { id: foundDist.id, name: foundDist.name } : null);
    setVillages([]);
    setSelectedVillage(null);

    setLoadingVillages(true);
    try {
      const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${distId}.json`);
      if (!res.ok) throw new Error('Gagal memuat data kelurahan');
      const data = await res.json();
      setVillages(data || []);
    } catch (err) {
      console.error('Emsifa Villages Fetch Error:', err);
      setVillages([]);
    } finally {
      setLoadingVillages(false);
    }
  };

  const handleVillageChange = (e) => {
    const vilId = e.target.value;
    if (!vilId) {
      setSelectedVillage(null);
      return;
    }
    const foundVil = villages.find((v) => v.id === vilId);
    setSelectedVillage(foundVil ? { id: foundVil.id, name: foundVil.name } : null);
  };

  const handleClassSelectionChange = (classId) => {
    setStudentClassId(classId);
    if (classId) {
      const selected = classesList.find((c) => c.id === classId);
      if (selected?.sport) {
        setSportCategory(selected.sport);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!studentName.trim() || !tenantId) {
      setErrorMsg('Nama lengkap siswa wajib diisi.');
      return;
    }

    if (!birthDate) {
      setErrorMsg('Tanggal lahir siswa wajib diisi.');
      return;
    }

    setIsSaving(true);

    try {
      let finalPhotoUrl = studentToEdit?.photoUrl || null;

      if (photoFile) {
        const uploadRes = await uploadToCloudinary(photoFile, {
          folder: `tenants/${tenantId}/students`
        });
        finalPhotoUrl = uploadRes.secure_url;
      } else if (!photoPreview) {
        finalPhotoUrl = null;
      }

      const selectedClassObj = classesList.find((c) => c.id === studentClassId);

      const payload = {
        tenantId,
        academyId: activeAcademy?.id || activeAcademyId || studentToEdit?.academyId || '',
        academyName: activeAcademy?.name || studentToEdit?.academyName || '',
        studentName: studentName.trim(),
        photoUrl: finalPhotoUrl,
        birthDate,
        nikKk: nikKk.trim(),
        schoolOrigin: schoolOrigin.trim(),
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
        sportCategory: sportCategory || (selectedClassObj?.sport || uniqueSports[0] || 'Umum'),
        classId: studentClassId || '',
        className: selectedClassObj?.className || '',
        coachName: selectedClassObj?.coachName || '',
        joinDate,
        monthlyFee: parseFloat(monthlyFee) || 0,
        registrationFee: registrationFee === '' ? 0 : Number(registrationFee),
        province: selectedProvince?.name || studentToEdit?.province || '',
        regency: selectedRegency?.name || studentToEdit?.regency || '',
        district: selectedDistrict?.name || studentToEdit?.district || '',
        village: selectedVillage?.name || studentToEdit?.village || '',
        addressDetail: addressDetail.trim(),
      };

      if (isEditing) {
        const updated = await updateStudent(studentToEdit.id, payload);
        if (onSuccess) {
          onSuccess(updated || { id: studentToEdit.id, ...payload });
        }
      } else {
        const created = await createStudent({
          ...payload,
          sppStatus: 'Belum Lunas'
        });
        if (onSuccess) {
          onSuccess(created || payload);
        }
      }

      onClose();
    } catch (err) {
      console.error('Error saving student in Supabase:', err);
      setErrorMsg(`Gagal ${isEditing ? 'mengupdate' : 'mendaftarkan'} siswa: ${err.message || 'Silakan coba lagi.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentSelectedClass = classesList.find((c) => c.id === studentClassId);

  // Menghitung Usia Siswa Secara Dinamis dari Tanggal Lahir
  const studentAge = useMemo(() => {
    if (!birthDate) return 0;
    const ageStr = calculateAge(birthDate);
    if (!ageStr || ageStr === '-') return 0;
    const num = parseInt(String(ageStr).replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }, [birthDate]);

  // Rekomendasi Kelompok Umur Berdasarkan Usia & Cabang Olahraga
  const recommendedTier = useMemo(() => {
    return studentAge > 0 
      ? getRecommendedTierForStudent(studentAge, sportCategory) 
      : null;
  }, [studentAge, sportCategory]);

  // Daftar Kelas Tersaring (Hanya kelas sesuai umur jika toggle aktif, diurutkan berdasar kelompok umur)
  const filteredClassesList = useMemo(() => {
    const sorted = sortClassesByAgeGroup(classesList);
    if (onlyAgeAppropriate && studentAge > 0) {
      return sorted.filter((cls) => isStudentAgeMatchClass(studentAge, cls));
    }
    return sorted;
  }, [classesList, onlyAgeAppropriate, studentAge]);

  // Verifikasi apakah kelas terpilih di luar kelompok umur
  const isSelectedClassAgeMismatch = Boolean(
    currentSelectedClass && 
    studentAge > 0 && 
    !isStudentAgeMatchClass(studentAge, currentSelectedClass)
  );

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lg:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#162320] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden my-auto text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header (Sticky / Fixed) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {isEditing ? 'Edit Data & Kelas Siswa' : 'Pendaftaran Siswa Akademi Baru'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEditing 
                ? 'Perbarui identitas, penetapan kelas/pelatih, & informasi siswa' 
                : 'Lengkapi identitas siswa, wali murid, kelompok latihan, & alamat administratif Emsifa'}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {pricingWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{pricingWarning}</span>
              </div>
            )}

            {/* AREA UNGGAH FOTO PROFIL SISWA (OPSIONAL - UNTUK ID CARD & BARCODE) */}
            <div className="p-4 bg-slate-50 dark:bg-[#1e2f2b] border border-slate-200/90 dark:border-white/10 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-left">
              <div className="relative shrink-0">
                {photoPreview ? (
                  <div className="relative group">
                    <img
                      src={photoPreview}
                      alt="Preview Siswa"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#354944]/30 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      title="Hapus Foto"
                      className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-sm cursor-pointer transition-transform hover:scale-110"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#354944]/10 border-2 border-dashed border-[#354944]/30 flex flex-col items-center justify-center text-[#354944]">
                    <Camera className="w-6 h-6" />
                    <span className="text-[9px] font-bold mt-0.5">Belum Ada</span>
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left">
                <label className="block text-xs font-bold text-gray-800 dark:text-gray-100 mb-0.5">
                  Foto Profil Siswa <span className="text-gray-400 font-normal">(Opsional)</span>
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2.5">
                  Foto ini akan otomatis digunakan pada <strong>ID Card resmi</strong> dan <strong>Barcode presensi</strong> siswa.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#162320] hover:bg-[#354944]/10 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoPreview ? 'Ganti Foto' : 'Unggah Foto'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                  </label>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors font-medium cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2-KOLOM UTAMA: DATA DIRI & KONTAK/KELAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
              {/* KOLOM KIRI: DATA DIRI SISWA */}
              <div className="space-y-3.5">
                <div className="border-b border-gray-100 dark:border-white/10 pb-2">
                  <h4 className="text-xs font-bold text-[#354944] dark:text-[#C89D32] uppercase tracking-wider flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Data Diri &amp; Identitas Siswa</span>
                  </h4>
                </div>

                <div>
                  <label htmlFor="studentName" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Nama Lengkap Siswa <span className="text-[#C89D32]">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="studentName"
                      name="studentName"
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Nama calon siswa"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="birthDate" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                      Tanggal Lahir Siswa <span className="text-[#C89D32]">*</span>
                    </label>
                    {studentAge > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#354944]/10 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20 flex items-center gap-1 shadow-2xs">
                        <span>Usia: {studentAge} Tahun</span>
                        {recommendedTier && (
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            &bull; {recommendedTier.shortLabel}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="birthDate"
                      name="birthDate"
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-medium text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="nikKk" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    No. Induk Kependudukan (NIK) / No. KK
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="nikKk"
                      name="nikKk"
                      type="text"
                      value={nikKk}
                      onChange={(e) => setNikKk(e.target.value)}
                      placeholder="16 digit NIK atau Nomor Kartu Keluarga"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="schoolOrigin" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Asal Sekolah
                  </label>
                  <div className="relative">
                    <School className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="schoolOrigin"
                      name="schoolOrigin"
                      type="text"
                      value={schoolOrigin}
                      onChange={(e) => setSchoolOrigin(e.target.value)}
                      placeholder="misal: SD Negeri 01 / SMP Nusantara"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Dokumen Lampiran (KK / Akta)
                  </label>
                  <button
                    type="button"
                    onClick={() => alert('Fitur Upload Berkas KK akan tersedia pada Fase Cloud Storage.')}
                    className="w-full py-2.5 px-3 border-2 border-dashed border-gray-300 dark:border-white/20 hover:border-[#354944] bg-gray-50/50 dark:bg-[#1a2925]/50 hover:bg-[#354944]/10 text-gray-600 dark:text-gray-300 hover:text-[#354944] text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Berkas KK (Fase Storage)</span>
                  </button>
                </div>
              </div>

              {/* KOLOM KANAN: KONTAK WALI, KELAS & TARIF SPP */}
              <div className="space-y-3.5">
                <div className="border-b border-gray-100 dark:border-white/10 pb-2">
                  <h4 className="text-xs font-bold text-[#354944] dark:text-[#C89D32] uppercase tracking-wider flex items-center space-x-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Kontak, Kelas &amp; Cabang Akademi</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="parentName" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Nama Wali / Ortu
                    </label>
                    <input
                      id="parentName"
                      name="parentName"
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Nama wali murid"
                      className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                    />
                  </div>

                  <div>
                    <label htmlFor="parentPhone" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      WhatsApp Ortu
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        id="parentPhone"
                        name="parentPhone"
                        type="tel"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                      />
                    </div>
                  </div>
                </div>

                {/* DROPDOWN RELASI KELAS DENGAN SMART AGE FILTER */}
                <div>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <label htmlFor="studentClassId" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                      Pilih Kelas / Kelompok Latihan
                    </label>
                    {studentAge > 0 && (
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#354944] dark:text-[#C89D32] cursor-pointer">
                        <input
                          id="onlyAgeAppropriate"
                          name="onlyAgeAppropriate"
                          type="checkbox"
                          checked={onlyAgeAppropriate}
                          onChange={(e) => setOnlyAgeAppropriate(e.target.checked)}
                          className="rounded text-[#354944] focus:ring-[#354944] w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Hanya Sesuai Umur ({studentAge} Thn)</span>
                      </label>
                    )}
                  </div>

                  <select
                    id="studentClassId"
                    name="studentClassId"
                    value={studentClassId}
                    onChange={(e) => handleClassSelectionChange(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="">-- Pilih Kelas / Kelompok Latihan (Opsional) --</option>
                    {filteredClassesList.map((cls) => {
                      const isMatch = studentAge > 0 ? isStudentAgeMatchClass(studentAge, cls) : true;
                      const ageRangeLabel = cls.minAge || cls.maxAge ? ` (${cls.minAge || 0}-${cls.maxAge || 99} Thn)` : '';
                      return (
                        <option key={cls.id} value={cls.id}>
                          {isMatch && studentAge > 0 && cls.tierCode !== 'ALL_AGE' ? '★ ' : ''}
                          {cls.className} ({cls.sport || 'Umum'}){ageRangeLabel} - Pelatih: {cls.coachName || '-'}
                          {!isMatch ? ' ⚠️ [Di Luar Batas Umur]' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Warning Box jika Kelas Terpilih di Luar Kelompok Umur */}
                  {isSelectedClassAgeMismatch && (
                    <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2 shadow-2xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Perhatian: Di Luar Kelompok Umur Standar</p>
                        <p className="mt-0.5 leading-relaxed">
                          Usia siswa <strong>{studentAge} tahun</strong> di luar rentang target kelas <strong>{currentSelectedClass?.className}</strong> ({currentSelectedClass?.minAge || 0} - {currentSelectedClass?.maxAge || 99} tahun). Penempatan siswa membutuhkan evaluasi &amp; persetujuan Head Coach.
                        </p>
                      </div>
                    </div>
                  )}

                  {currentSelectedClass && (
                    <div className="mt-1.5 px-2.5 py-1.5 bg-[#354944]/10 border border-[#354944]/20 rounded-lg text-[10px] text-[#354944] dark:text-[#C89D32] flex items-center justify-between flex-wrap gap-1">
                      <span>Pelatih: <strong>{currentSelectedClass.coachName || '-'}</strong></span>
                      {currentSelectedClass.tierLabel && (
                        <span>Tier: <strong>{currentSelectedClass.tierLabel}</strong></span>
                      )}
                      <span>Jadwal: <strong>{currentSelectedClass.schedule || '-'}</strong></span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="studentSportCategory" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Cabang Olahraga <span className="text-[#C89D32]">*</span>
                    </label>
                    <select
                      id="studentSportCategory"
                      name="studentSportCategory"
                      value={sportCategory}
                      onChange={(e) => setSportCategory(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-bold text-slate-800 dark:text-slate-100"
                    >
                      {uniqueSports.length === 0 ? (
                        <option value="">Belum ada lapangan terdaftar</option>
                      ) : (
                        uniqueSports.map((sport) => (
                          <option key={sport} value={sport}>
                            {sport}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="joinDate" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Tgl Bergabung <span className="text-[#C89D32]">*</span>
                    </label>
                    <input
                      id="joinDate"
                      name="joinDate"
                      type="date"
                      required
                      value={joinDate}
                      onChange={(e) => setJoinDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="studentMonthlyFee" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                        Tarif SPP (Rp) <span className="text-[#C89D32]">*</span>
                      </label>
                      <span className="px-1.5 py-0.5 bg-[#354944]/10 text-[#354944] dark:text-[#C89D32] text-[9px] font-extrabold rounded flex items-center gap-1 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> Master
                      </span>
                    </div>
                    <div className="relative">
                      <span className="text-xs font-bold text-gray-400 absolute left-3 top-2">Rp</span>
                      <input
                        id="studentMonthlyFee"
                        name="studentMonthlyFee"
                        type="text"
                        readOnly
                        value={Number(monthlyFee || 0).toLocaleString('id-ID')}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-[#354944] dark:text-[#C89D32] cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="studentRegistrationFee" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                        Biaya Daftar (Rp)
                      </label>
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-extrabold rounded flex items-center gap-1 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> Master
                      </span>
                    </div>
                    <div className="relative">
                      <span className="text-xs font-bold text-gray-400 absolute left-3 top-2">Rp</span>
                      <input
                        id="studentRegistrationFee"
                        name="studentRegistrationFee"
                        type="text"
                        readOnly
                        value={Number(registrationFee || 0).toLocaleString('id-ID')}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-slate-800 dark:text-slate-100 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEKSI DOMISILI & ALAMAT (EMSIFA API) - STRUKTUR PENUH LEBAR */}
            <div className="p-4 bg-slate-50 dark:bg-[#1a2925] border border-slate-200/80 dark:border-white/10 rounded-2xl space-y-3 text-left">
              <div className="flex items-center space-x-2 border-b border-gray-200/80 dark:border-white/10 pb-2">
                <MapPin className="w-4 h-4 text-[#354944] dark:text-[#C89D32]" />
                <h4 className="text-xs font-bold text-[#354944] dark:text-[#C89D32] uppercase tracking-wider">
                  Wilayah Domisili Tempat Tinggal Siswa (Emsifa API)
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="studentProvince" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Provinsi
                  </label>
                  <select
                    id="studentProvince"
                    name="studentProvince"
                    value={selectedProvince?.id || ''}
                    onChange={handleProvinceChange}
                    disabled={loadingProvinces}
                    className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                  >
                    <option value="">
                      {selectedProvince?.name ? selectedProvince.name : (loadingProvinces ? 'Memuat...' : '-- Pilih Provinsi --')}
                    </option>
                    {provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="studentRegency" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Kabupaten / Kota
                  </label>
                  <select
                    id="studentRegency"
                    name="studentRegency"
                    value={selectedRegency?.id || ''}
                    onChange={handleRegencyChange}
                    disabled={!selectedProvince?.id || loadingRegencies}
                    className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                  >
                    <option value="">
                      {selectedRegency?.name ? selectedRegency.name : (loadingRegencies ? 'Memuat...' : '-- Pilih Kota/Kab --')}
                    </option>
                    {regencies.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="studentDistrict" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Kecamatan
                  </label>
                  <select
                    id="studentDistrict"
                    name="studentDistrict"
                    value={selectedDistrict?.id || ''}
                    onChange={handleDistrictChange}
                    disabled={!selectedRegency?.id || loadingDistricts}
                    className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                  >
                    <option value="">
                      {selectedDistrict?.name ? selectedDistrict.name : (loadingDistricts ? 'Memuat...' : '-- Pilih Kecamatan --')}
                    </option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="studentVillage" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Kelurahan / Desa
                  </label>
                  <select
                    id="studentVillage"
                    name="studentVillage"
                    value={selectedVillage?.id || ''}
                    onChange={handleVillageChange}
                    disabled={!selectedDistrict?.id || loadingVillages}
                    className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                  >
                    <option value="">
                      {selectedVillage?.name ? selectedVillage.name : (loadingVillages ? 'Memuat...' : '-- Pilih Kelurahan --')}
                    </option>
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="addressDetail" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Detail Alamat Rumah
                </label>
                <textarea
                  id="addressDetail"
                  name="addressDetail"
                  rows={2}
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="Alamat jalan, nomor rumah, RT/RW..."
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Modal Action Buttons (Sticky / Fixed Footer) */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{photoFile ? 'Menyimpan data & mengunggah foto...' : 'Menyimpan data...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Simpan Perubahan Siswa' : 'Daftarkan Siswa'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
