import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as supabaseAcademyService from '../services/supabaseAcademyService';
import { createCoachWithAccount } from '../services/coachAuthService';
import { supabase } from '../config/supabase';
import { X, User, Phone, Award, Dumbbell, MapPin, Loader2, FileText, Check, Camera, Upload, Trash2, Mail, Lock } from 'lucide-react';
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
  const [coachPassword, setCoachPassword] = useState('');
  const [sportSpecialty, setSportSpecialty] = useState(uniqueSports?.[0] || 'Badminton');
  const [license, setLicense] = useState('');

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

  // Pre-fill form if editing coach, or reset if creating
  useEffect(() => {
    if (coachToEdit && isOpen) {
      setCoachName(coachToEdit.name || coachToEdit.coachName || '');
      setNickname(coachToEdit.nickname || '');
      setNik(coachToEdit.nik || '');
      setCoachPhone(coachToEdit.phone || '');
      setSportSpecialty(coachToEdit.sportSpecialty || coachToEdit.sport || uniqueSports?.[0] || 'Badminton');
      setLicense(coachToEdit.license || '');
      setPhotoPreview(coachToEdit.photoUrl || coachToEdit.photo_url || '');
      setPhotoFile(null);

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
      setCoachName('');
      setNickname('');
      setNik('');
      setCoachPhone('');
      setSportSpecialty(uniqueSports?.[0] || 'Badminton');
      setLicense('');
      setPhotoPreview('');
      setPhotoFile(null);
      setSelectedProvince(null);
      setSelectedRegency(null);
      setSelectedDistrict(null);
      setSelectedVillage(null);
      setAddressDetail('');
      setErrorMsg(null);
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
    if (!coachName.trim() || !tenantId) {
      setErrorMsg('Nama lengkap pelatih wajib diisi.');
      return;
    }

    if (nik && nik.trim().length !== 16) {
      setErrorMsg('Nomor KTP (NIK) harus 16 digit.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      let finalPhotoUrl = coachToEdit?.photoUrl || null;

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
        name: coachName.trim(),
        nickname: nickname.trim(),
        nik: nik.trim(),
        phone: coachPhone.trim(),
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
        const updatedCoach = await supabaseAcademyService.updateCoach(coachToEdit.id, coachData);
        if (onCoachUpdated) {
          onCoachUpdated(updatedCoach || { id: coachToEdit.id, ...coachData });
        }
      } else {
        if (coachEmail && coachPassword) {
          const res = await createCoachWithAccount({
            tenantId,
            academyId: resolvedAcademyId,
            name: coachName.trim(),
            phone: coachPhone.trim(),
            email: coachEmail.trim(),
            password: coachPassword,
            sportSpecialty: sportSpecialty || 'Pelatih Utama',
            license: license.trim() || null,
            photoUrl: finalPhotoUrl,
            nickname: nickname.trim(),
            nik: nik.trim(),
            address: coachData.address
          });
          if (onCoachAdded) {
            onCoachAdded(res.coach || { id: `coach_${Date.now()}`, ...coachData });
          }
        } else {
          const createdCoach = await supabaseAcademyService.createCoach(coachData);
          
          // Sinkronisasi otomatis ke users_staff & invitations jika email disertakan
          if (coachEmail && tenantId) {
            const cleanEmail = coachEmail.trim().toLowerCase();
            const cleanName = coachName.trim();
            try {
              await supabase.from('users_staff').upsert([{
                tenant_id: tenantId,
                email: cleanEmail,
                name: cleanName,
                full_name: cleanName,
                role: 'coach',
                status: 'active',
                is_active: true,
                created_at: new Date().toISOString()
              }], { onConflict: 'email,tenant_id' });

              await supabase.from('invitations').upsert([{
                tenant_id: tenantId,
                email: cleanEmail,
                role: 'coach',
                status: 'accepted',
                created_at: new Date().toISOString()
              }], { onConflict: 'email,tenant_id' });
            } catch (syncErr) {
              console.warn('[CoachModal] Sync users_staff & invitations note:', syncErr);
            }
          }

          if (onCoachAdded) {
            onCoachAdded(createdCoach || { id: `coach_${Date.now()}`, ...coachData });
          }
        }
      }

      onClose();
      // Reset form
      setCoachName('');
      setNickname('');
      setNik('');
      setCoachPhone('');
      setCoachEmail('');
      setCoachPassword('');
      setLicense('');
      setPhotoPreview('');
      setPhotoFile(null);
      setSelectedProvince(null);
      setSelectedRegency(null);
      setSelectedDistrict(null);
      setSelectedVillage(null);
      setAddressDetail('');
    } catch (err) {
      console.error('Error saving coach:', err);
      setErrorMsg(`Gagal ${isEditing ? 'mengupdate' : 'menambahkan'} pelatih. Silakan coba lagi.`);
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
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium shrink-0">
            {errorMsg}
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

                {!isEditing && (
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-3">
                    <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Akun Login Pelatih (Opsional)</span>
                    </p>
                    <div>
                      <label htmlFor="coachEmail" className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                        Email Login Pelatih
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          id="coachEmail"
                          name="coachEmail"
                          type="email"
                          value={coachEmail}
                          onChange={(e) => setCoachEmail(e.target.value)}
                          placeholder="pelatih@chuasport.com"
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944]"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="coachPassword" className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                        Kata Sandi Awal
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          id="coachPassword"
                          name="coachPassword"
                          type="password"
                          minLength={6}
                          value={coachPassword}
                          onChange={(e) => setCoachPassword(e.target.value)}
                          placeholder="Minimal 6 Karakter"
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#162320] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#354944]"
                        />
                      </div>
                    </div>
                  </div>
                )}

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
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
