import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as supabaseAcademyService from '../services/supabaseAcademyService';
import { createCoachWithAccount } from '../services/coachAuthService';
import { formatInvitationExpiry } from '../services/staffService';
import { supabase } from '../config/supabase';
import { 
  X, 
  User, 
  Phone, 
  Award, 
  Dumbbell, 
  MapPin, 
  Loader2, 
  FileText, 
  Check, 
  Camera, 
  Upload, 
  Trash2, 
  Mail, 
  Clock, 
  Info, 
  Copy, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { uploadToCloudinary } from '../services/uploadService';

export default function CoachModal({
  isOpen,
  onClose,
  userProfile,
  activeAcademy = null,
  activeAcademyId = null,
  academies = [],
  uniqueSports,
  coachToEdit = null,
  onCoachAdded,
  onCoachUpdated
}) {
  const isEditing = Boolean(coachToEdit);
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  // Selected Academy Penugasan State
  const defaultAcademyId = 
    activeAcademy?.id || 
    activeAcademyId || 
    coachToEdit?.academyId || 
    coachToEdit?.academy_id || 
    (academies && academies[0]?.id) || 
    localStorage.getItem('activeAcademyId') || 
    '';

  const [selectedAcademyId, setSelectedAcademyId] = useState(defaultAcademyId);

  useEffect(() => {
    if (isOpen) {
      const fallbackId = 
        activeAcademy?.id || 
        activeAcademyId || 
        coachToEdit?.academyId || 
        coachToEdit?.academy_id || 
        (academies && academies[0]?.id) || 
        localStorage.getItem('activeAcademyId') || 
        '';
      setSelectedAcademyId(fallbackId);
    }
  }, [isOpen, activeAcademy?.id, activeAcademyId, coachToEdit, academies]);

  // Form Fields
  const [coachName, setCoachName] = useState('');
  const [nickname, setNickname] = useState('');
  const [nik, setNik] = useState('');
  const [coachPhone, setCoachPhone] = useState('');
  const [coachEmail, setCoachEmail] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [sportSpecialty, setSportSpecialty] = useState(uniqueSports?.[0] || 'Badminton');
  const [license, setLicense] = useState('');

  // Undangan Staff Modal & Warning State
  const [inviteSuccessData, setInviteSuccessData] = useState(null);
  const [inviteWarningMsg, setInviteWarningMsg] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Foto Profil Pelatih State (Opsional untuk ID Card & Barcode)
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
  const [addressDetail, setAddressDetail] = useState('');

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const resetForm = () => {
    setCoachName('');
    setNickname('');
    setNik('');
    setCoachPhone('');
    setCoachEmail('');
    setSendInvite(true);
    setLicense('');
    setPhotoPreview('');
    setPhotoFile(null);
    setSelectedProvince(null);
    setSelectedRegency(null);
    setSelectedDistrict(null);
    setSelectedVillage(null);
    setAddressDetail('');
    setErrorMsg(null);
  };

  // Pre-fill form if editing coach, or reset if creating
  useEffect(() => {
    if (coachToEdit && isOpen) {
      setCoachName(coachToEdit.name || coachToEdit.coachName || '');
      setNickname(coachToEdit.nickname || '');
      setNik(coachToEdit.nik || '');
      setCoachPhone(coachToEdit.phone || '');
      setCoachEmail(coachToEdit.email || '');
      setSendInvite(false);
      setSportSpecialty(coachToEdit.sportSpecialty || coachToEdit.sport || uniqueSports?.[0] || 'Badminton');
      setLicense(coachToEdit.license || '');
      setPhotoPreview(coachToEdit.photoUrl || coachToEdit.photo_url || '');
      setPhotoFile(null);
      setInviteSuccessData(null);
      setInviteWarningMsg(null);

      // Hydration: Parsing objek JSON dari coach.address dan pecah kembali ke state masing-masing
      let parsedAddress = {};
      if (typeof coachToEdit.address === 'string') {
        try {
          parsedAddress = JSON.parse(coachToEdit.address);
        } catch (e) {
          parsedAddress = { detail: coachToEdit.address };
        }
      } else if (typeof coachToEdit.address === 'object' && coachToEdit.address !== null) {
        parsedAddress = coachToEdit.address;
      }

      const provName = parsedAddress.provinsi || parsedAddress.province || '';
      const cityName = parsedAddress.kota || parsedAddress.city || '';
      const distName = parsedAddress.kecamatan || parsedAddress.district || '';
      const vilName = parsedAddress.kelurahan || parsedAddress.village || '';
      const detailStr = parsedAddress.detail || parsedAddress.detailAlamat || '';

      setSelectedProvince(provName ? { name: provName } : null);
      setSelectedRegency(cityName ? { name: cityName } : null);
      setSelectedDistrict(distName ? { name: distName } : null);
      setSelectedVillage(vilName ? { name: vilName } : null);
      setAddressDetail(detailStr);
      setErrorMsg(null);
    } else if (!coachToEdit && isOpen) {
      resetForm();
      setSportSpecialty(uniqueSports?.[0] || 'Badminton');
      setInviteSuccessData(null);
      setInviteWarningMsg(null);
    }
  }, [coachToEdit?.id, isOpen]);

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

  if (!isOpen) return null;

  const handleSubmitCoach = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const cleanName = coachName.trim();
    if (!cleanName) {
      setErrorMsg('Nama lengkap pelatih wajib diisi.');
      return;
    }

    if (!tenantId) {
      setErrorMsg('ID Tenant tidak ditemukan. Pastikan profil GOR Anda telah aktif.');
      return;
    }

    if (nik && nik.trim().length !== 16) {
      setErrorMsg('Nomor KTP (NIK) harus 16 digit.');
      return;
    }

    const cleanEmail = coachEmail.trim().toLowerCase();
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setErrorMsg('Format email pelatih tidak valid.');
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg(null);
    setInviteWarningMsg(null);

    try {
      let finalPhotoUrl = coachToEdit?.photoUrl || coachToEdit?.photo_url || null;

      if (photoFile) {
        const uploadRes = await uploadToCloudinary(photoFile, {
          folder: `tenants/${tenantId}/coaches`
        });
        finalPhotoUrl = uploadRes.secure_url;
      } else if (!photoPreview) {
        finalPhotoUrl = null;
      }

      const resolvedAcademyId = 
        selectedAcademyId || 
        activeAcademy?.id || 
        activeAcademyId || 
        coachToEdit?.academyId || 
        coachToEdit?.academy_id || 
        (academies && academies[0]?.id) || 
        localStorage.getItem('activeAcademyId') || 
        null;

      if (!resolvedAcademyId && !isEditing) {
        setErrorMsg('ID Akademi tidak valid atau belum dipilih. Pastikan akademi telah dipilih sebelum mendaftar pelatih.');
        setSubmitting(false);
        return;
      }

      const resolvedAcademyName = 
        (academies && academies.find(a => a.id === resolvedAcademyId)?.name) || 
        activeAcademy?.name || 
        coachToEdit?.academyName || 
        '';

      const coachData = {
        tenantId,
        academyId: resolvedAcademyId,
        academyName: resolvedAcademyName,
        name: cleanName,
        nickname: nickname.trim(),
        nik: nik.trim(),
        phone: coachPhone.trim(),
        email: cleanEmail || null,
        sportSpecialty,
        license: license.trim() || null,
        photoUrl: finalPhotoUrl,
        address: {
          provinsi: selectedProvince?.name || coachToEdit?.address?.provinsi || coachToEdit?.address?.province || '',
          kota: selectedRegency?.name || coachToEdit?.address?.kota || coachToEdit?.address?.city || '',
          kecamatan: selectedDistrict?.name || coachToEdit?.address?.kecamatan || coachToEdit?.address?.district || '',
          kelurahan: selectedVillage?.name || coachToEdit?.address?.kelurahan || coachToEdit?.address?.village || '',
          detail: addressDetail.trim()
        }
      };

      if (isEditing) {
        // --- PRIORITAS 1: MODE EDIT PELATIH ---
        // Hanya update profil di tabel coaches, TIDAK melakukan insert dan TIDAK menerbitkan undangan baru
        const updatedCoach = await supabaseAcademyService.updateCoach(coachToEdit.id, coachData);
        if (onCoachUpdated) {
          onCoachUpdated(updatedCoach || { id: coachToEdit.id, ...coachData });
        }
        onClose();
        resetForm();
      } else {
        // --- PRIORITAS 1 & 2: MODE TAMBAH PELATIH BARU ---
        // Simpan profil pelatih ke public.coaches, dan jika email diisi serta sendInvite aktif, terbitkan undangan staf
        const shouldSendInvite = Boolean(cleanEmail && sendInvite);
        const res = await createCoachWithAccount({
          tenantId,
          academyId: resolvedAcademyId,
          name: cleanName,
          phone: coachPhone.trim(),
          email: cleanEmail,
          sportSpecialty: sportSpecialty || 'Pelatih Utama',
          license: license.trim() || null,
          photoUrl: finalPhotoUrl,
          nickname: nickname.trim(),
          nik: nik.trim(),
          address: coachData.address,
          sendInvite: shouldSendInvite,
        });

        if (onCoachAdded) {
          onCoachAdded(res.coach || { id: `coach_${Date.now()}`, ...coachData });
        }

        if (res.inviteUrl) {
          // Skenario A: Profil berhasil & undangan berhasil -> Buka persistent modal sukses
          setInviteSuccessData({
            inviteUrl: res.inviteUrl,
            email: cleanEmail,
            role: 'coach',
            tenantName: userProfile?.tenant?.name || 'Cabang Aktif',
            expiresAt: res.invitation?.expiresAt || res.invitation?.expires_at,
            createdAt: res.invitation?.createdAt || res.invitation?.created_at || new Date().toISOString(),
          });
          resetForm();
        } else if (res.invitationError) {
          // Skenario B / D: Profil berhasil disimpan, tetapi undangan gagal atau sudah tersedia
          setInviteWarningMsg(
            `Profil pelatih berhasil disimpan ke Data Master, namun undangan akun login belum diterbitkan: ${res.invitationError}. Anda dapat memeriksa atau menerbitkan undangan melalui menu Pengaturan > Staf & Pelatih.`
          );
          resetForm();
        } else {
          // Profil berhasil disimpan tanpa undangan (email kosong atau checkbox tidak dicentang)
          onClose();
          resetForm();
        }
      }
    } catch (err) {
      console.error('Error saving coach:', err);
      setErrorMsg(`Gagal ${isEditing ? 'mengupdate' : 'menambahkan'} pelatih: ${err.message || 'Silakan coba lagi.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lg:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#162320] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden my-auto text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Sticky / Fixed) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {isEditing ? 'Edit Data & Lisensi Pelatih' : 'Pendaftaran Pelatih Baru (HR Data Master)'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEditing
                ? 'Perbarui identitas, kontak, lisensi, foto, & alamat pelatih'
                : 'Lengkapi identitas legal KTP, kontak, lisensi, foto, & alamat administratif Emsifa'}
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

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium shrink-0 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="font-bold px-1 hover:text-red-900">&times;</button>
          </div>
        )}

        {inviteWarningMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-xl font-medium shrink-0 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Profil Berhasil Disimpan (Status Undangan Diperhatikan)</p>
                <p className="text-[11px] leading-relaxed">{inviteWarningMsg}</p>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setInviteWarningMsg(null);
                  onClose();
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Tutup &amp; Selesai
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitCoach} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Body (Scrollable) */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* AREA UNGGAH FOTO PROFIL PELATIH (OPSIONAL - UNTUK ID CARD & BARCODE) */}
            <div className="p-4 bg-slate-50 dark:bg-[#1e2f2b] border border-slate-200/90 dark:border-white/10 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-left">
              <div className="relative shrink-0">
                {photoPreview ? (
                  <div className="relative group">
                    <img
                      src={photoPreview}
                      alt="Preview Pelatih"
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
                  Foto Profil Pelatih <span className="text-gray-400 font-normal">(Opsional)</span>
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2.5">
                  Foto ini akan otomatis digunakan pada <strong>ID Card resmi</strong> instruktur dan sistem <strong>Barcode</strong> kehadiran.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <label htmlFor="coach-photo-file" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#162320] hover:bg-[#354944]/10 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoPreview ? 'Ganti Foto' : 'Unggah Foto'}</span>
                    <input
                      id="coach-photo-file"
                      name="photoFile"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              
              {/* KOLOM KIRI: DATA PRIBADI & LEGAL */}
              <div className="space-y-3.5">
                <div className="border-b border-gray-100 dark:border-white/10 pb-2">
                  <h4 className="text-xs font-bold text-[#354944] dark:text-[#C89D32] uppercase tracking-wider flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Identitas &amp; Legal Pelatih</span>
                  </h4>
                </div>

                <div>
                  <label htmlFor="selectedAcademyId" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Akademi Penugasan <span className="text-[#C89D32]">*</span>
                  </label>
                  {academies && academies.length > 1 ? (
                    <select
                      id="selectedAcademyId"
                      name="selectedAcademyId"
                      value={selectedAcademyId}
                      onChange={(e) => setSelectedAcademyId(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                    >
                      {academies.map((ac) => (
                        <option key={ac.id} value={ac.id}>
                          {ac.name} ({ac.sport || 'Umum'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-between">
                      <span className="truncate">{activeAcademy?.name || (academies && academies[0]?.name) || 'Akademi Aktif'}</span>
                      <span className="text-[10px] bg-[#354944]/10 dark:bg-[#C89D32]/20 text-[#354944] dark:text-[#C89D32] px-2 py-0.5 rounded font-bold shrink-0 ml-2">
                        Akademi Terpilih
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="coachName" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Nama Lengkap Pelatih <span className="text-[#C89D32]">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="coachName"
                      name="coachName"
                      type="text"
                      required
                      value={coachName}
                      onChange={(e) => setCoachName(e.target.value)}
                      placeholder="Nama lengkap sesuai KTP"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="nickname" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Nama Panggilan
                  </label>
                  <input
                    id="nickname"
                    name="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Nama panggilan harian"
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                  />
                </div>

                <div>
                  <label htmlFor="nik" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Nomor KTP (NIK)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="nik"
                      name="nik"
                      type="text"
                      maxLength={16}
                      value={nik}
                      onChange={(e) => setNik(e.target.value)}
                      placeholder="16 digit NIK KTP"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="coachPhone" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Nomor WhatsApp <span className="text-[#C89D32]">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="coachPhone"
                      name="coachPhone"
                      type="tel"
                      required
                      value={coachPhone}
                      onChange={(e) => setCoachPhone(e.target.value)}
                      placeholder="081234567890"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl space-y-3">
                  <div>
                    <label htmlFor="coachEmail" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Email Login Pelatih (Untuk Identitas &amp; Undangan Akun)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        id="coachEmail"
                        name="coachEmail"
                        type="email"
                        value={coachEmail}
                        onChange={(e) => setCoachEmail(e.target.value)}
                        placeholder="pelatih@chuasport.com (Opsional)"
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944] font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      Boleh dikosongkan jika Anda hanya ingin mencatat profil pelatih tanpa memberikan akses login sistem.
                    </p>
                  </div>

                  {!isEditing && coachEmail.trim() && (
                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendInvite}
                          onChange={(e) => setSendInvite(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300 text-[#354944] focus:ring-[#354944] h-4 w-4"
                        />
                        <div className="text-left">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            Terbitkan undangan akun login sekarang
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-relaxed">
                            Sistem akan membuat token undangan resmi via PostgreSQL RPC (masa berlaku dinamis 7 hari). Pelatih akan mengatur kata sandinya sendiri saat mengklaim tautan.
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sportSpecialty" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Cabang Olahraga
                    </label>
                    <select
                      id="sportSpecialty"
                      name="sportSpecialty"
                      value={sportSpecialty}
                      onChange={(e) => setSportSpecialty(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-bold text-slate-800 dark:text-slate-100"
                    >
                      {uniqueSports?.length > 0 ? (
                        uniqueSports.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))
                      ) : (
                        <option value="Badminton">Badminton</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="license" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Lisensi / Sertifikasi
                    </label>
                    <div className="relative">
                      <Award className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        id="license"
                        name="license"
                        type="text"
                        value={license}
                        onChange={(e) => setLicense(e.target.value)}
                        placeholder="Lisensi B / BWF"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN: ALAMAT BERJENJANG EMSIFA */}
              <div className="space-y-3.5">
                <div className="border-b border-gray-100 dark:border-white/10 pb-2">
                  <h4 className="text-xs font-bold text-[#354944] dark:text-[#C89D32] uppercase tracking-wider flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Domisili &amp; Alamat (Emsifa API)</span>
                  </h4>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label htmlFor="province" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Provinsi</label>
                    <select
                      id="province"
                      name="province"
                      value={selectedProvince?.id || ''}
                      onChange={handleProvinceChange}
                      disabled={loadingProvinces}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                    >
                      <option value="">
                        {selectedProvince?.name ? selectedProvince.name : (loadingProvinces ? 'Memuat Provinsi...' : '-- Pilih Provinsi --')}
                      </option>
                      {provinces.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="regency" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Kabupaten / Kota</label>
                    <select
                      id="regency"
                      name="regency"
                      value={selectedRegency?.id || ''}
                      onChange={handleRegencyChange}
                      disabled={!selectedProvince?.id || loadingRegencies}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                    >
                      <option value="">
                        {selectedRegency?.name ? selectedRegency.name : (loadingRegencies ? 'Memuat Kab/Kota...' : '-- Pilih Kabupaten/Kota --')}
                      </option>
                      {regencies.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="district" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Kecamatan</label>
                    <select
                      id="district"
                      name="district"
                      value={selectedDistrict?.id || ''}
                      onChange={handleDistrictChange}
                      disabled={!selectedRegency?.id || loadingDistricts}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                    >
                      <option value="">
                        {selectedDistrict?.name ? selectedDistrict.name : (loadingDistricts ? 'Memuat Kecamatan...' : '-- Pilih Kecamatan --')}
                      </option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="village" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Kelurahan / Desa</label>
                    <select
                      id="village"
                      name="village"
                      value={selectedVillage?.id || ''}
                      onChange={handleVillageChange}
                      disabled={!selectedDistrict?.id || loadingVillages}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] disabled:opacity-50"
                    >
                      <option value="">
                        {selectedVillage?.name ? selectedVillage.name : (loadingVillages ? 'Memuat Kelurahan...' : '-- Pilih Kelurahan --')}
                      </option>
                      {villages.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="addressDetail" className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Detail Alamat Rumah</label>
                    <textarea
                      id="addressDetail"
                      name="addressDetail"
                      rows={2}
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                      placeholder="Nama jalan, nomor rumah, RT/RW, blok..."
                      className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#1a2925] border border-gray-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-[#162320] focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] resize-none"
                    />
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Footer (Sticky / Fixed) */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{photoFile ? 'Menyimpan data & mengunggah foto...' : 'Menyimpan data...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Simpan Perubahan Pelatih' : 'Simpan Pelatih'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>

      {/* PERSISTENT SUCCESS MODAL UNTUK UNDANGAN PELATIH (TETAP TERBUKA SAMPAI DITUTUP OWNER) */}
      {inviteSuccessData && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left relative">
            <button
              type="button"
              onClick={() => {
                setInviteSuccessData(null);
                onClose();
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Undangan Pelatih Berhasil Dibuat
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Profil pelatih tersimpan &amp; token undangan resmi telah diterbitkan via PostgreSQL RPC.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Email Penerima:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{inviteSuccessData.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Role yang Diberikan:</span>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold rounded uppercase text-[10px]">
                  Pelatih / Coach Akademi
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Nama Tenant / GOR:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{inviteSuccessData.tenantName}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Masa Berlaku:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatInvitationExpiry(inviteSuccessData.expiresAt, inviteSuccessData.createdAt)}
                  </span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="coach-modal-invite-url" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                URL Undangan Lengkap
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="coach-modal-invite-url"
                  name="modalInviteUrl"
                  type="text"
                  readOnly
                  value={inviteSuccessData.inviteUrl}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (inviteSuccessData.inviteUrl) {
                      navigator.clipboard.writeText(inviteSuccessData.inviteUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  {copiedLink ? (
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

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-900 dark:text-amber-300 flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Penting:</strong> Salin dan bagikan tautan ini ke pelatih. Tautan ini tetap tersedia selama dialog ini terbuka. Setelah dialog ditutup, tautan tidak dapat dimunculkan kembali demi alasan keamanan token.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setInviteSuccessData(null);
                  onClose();
                }}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
