import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { createTenant, createCourtsBatch } from '../services/supabaseArenaService';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Dumbbell, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Plus, 
  Minus, 
  X, 
  Loader2, 
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';

const QUICK_SPORTS_CHIPS = [
  'Badminton',
  'Futsal',
  'Tenis',
  'Padel',
  'Bola Basket',
  'Mini Soccer',
  'Voli',
  'Tenis Meja'
];

export default function OnboardingPage({ userProfile, onTenantCreated }) {
  // Wizard Step State (1, 2, or 3)
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 States: Basic Profile & Invitation
  const [ownerName, setOwnerName] = useState(userProfile?.displayName || '');
  const [arenaName, setArenaName] = useState('');
  const [phone, setPhone] = useState('');
  const [loadingInvitation, setLoadingInvitation] = useState(true);

  // Step 2 States: Emsifa Real API Location
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  const [selectedProvince, setSelectedProvince] = useState(null); // { id, name }
  const [selectedRegency, setSelectedRegency] = useState(null);   // { id, name }
  const [selectedDistrict, setSelectedDistrict] = useState(null);  // { id, name }
  const [selectedVillage, setSelectedVillage] = useState(null);   // { id, name }
  const [addressDetail, setAddressDetail] = useState('');

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  // Step 3 States: Sports & Courts Facilities
  const [selectedSports, setSelectedSports] = useState([
    { sport: 'Badminton', count: 2 }
  ]);
  const [customSportInput, setCustomSportInput] = useState('');

  // Submit Loading
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // 1. Fetch Invitation Data on Mount
  useEffect(() => {
    async function syncInvitationData() {
      if (!userProfile?.email) {
        setLoadingInvitation(false);
        return;
      }
      setLoadingInvitation(true);
      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('email', userProfile.email.toLowerCase().trim())
          .limit(1);
        
        if (error) {
          console.warn('Error fetching invitation data:', error);
        } else if (data && data.length > 0) {
          const invData = data[0];
          if (invData.owner_name || invData.ownerName) {
            setOwnerName(invData.owner_name || invData.ownerName);
          }
          if (invData.phone) {
            setPhone(invData.phone);
          }
        }
      } catch (err) {
        console.error('Error fetching invitation data:', err);
      } finally {
        setLoadingInvitation(false);
      }
    }

    syncInvitationData();
  }, [userProfile?.email]);

  // 2. Fetch Provinces from Emsifa API on Step 2 Mount or Step change
  useEffect(() => {
    if (currentStep === 2 && provinces.length === 0) {
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
  }, [currentStep, provinces.length]);

  // Handle Province Selection Change -> Fetch Regencies
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

    // Reset child locations
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

  // Handle Regency Selection Change -> Fetch Districts
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

  // Handle District Selection Change -> Fetch Villages
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

  // Handle Village Selection Change
  const handleVillageChange = (e) => {
    const vilId = e.target.value;
    if (!vilId) {
      setSelectedVillage(null);
      return;
    }
    const foundVil = villages.find((v) => v.id === vilId);
    setSelectedVillage(foundVil ? { id: foundVil.id, name: foundVil.name } : null);
  };

  // Step 3 Facility Handlers
  const handleAddSportChip = (sportName) => {
    if (!sportName.trim()) return;
    const cleanName = sportName.trim();
    
    // Check if already in list
    const existingIndex = selectedSports.findIndex(
      (item) => item.sport.toLowerCase() === cleanName.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Increase count
      const updated = [...selectedSports];
      updated[existingIndex].count += 1;
      setSelectedSports(updated);
    } else {
      // Add new
      setSelectedSports([...selectedSports, { sport: cleanName, count: 1 }]);
    }
  };

  const handleUpdateSportCount = (index, delta) => {
    const updated = [...selectedSports];
    const newCount = updated[index].count + delta;
    if (newCount <= 0) {
      // Remove if count reaches 0
      updated.splice(index, 1);
    } else {
      updated[index].count = newCount;
    }
    setSelectedSports(updated);
  };

  const handleRemoveSport = (index) => {
    const updated = [...selectedSports];
    updated.splice(index, 1);
    setSelectedSports(updated);
  };

  // Step Navigation Validation
  const handleNextStep = () => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (!arenaName.trim()) {
        setErrorMessage('Nama GOR / Sports Arena wajib diisi.');
        return;
      }
      if (!phone.trim()) {
        setErrorMessage('Nomor WhatsApp wajib diisi.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedProvince) {
        setErrorMessage('Silakan pilih Provinsi.');
        return;
      }
      if (!selectedRegency) {
        setErrorMessage('Silakan pilih Kota / Kabupaten.');
        return;
      }
      if (!selectedDistrict) {
        setErrorMessage('Silakan pilih Kecamatan.');
        return;
      }
      if (!selectedVillage) {
        setErrorMessage('Silakan pilih Kelurahan / Desa.');
        return;
      }
      if (!addressDetail.trim()) {
        setErrorMessage('Alamat jalan / patokan lengkap wajib diisi.');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Step 3 Final Submit & Auto-Generate Courts
  const handleFinalSubmit = async () => {
    setErrorMessage(null);
    if (selectedSports.length === 0) {
      setErrorMessage('Pilih setidaknya satu cabang olahraga dan jumlah lapangan.');
      return;
    }

    setSubmitting(true);

    try {
      // Ambil data sesi pengguna yang sedang login
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Sesi tidak valid. Pengguna harus login sebelum mengaktifkan GOR.');
      }

      // Calculate total courts count
      const totalCourtsCount = selectedSports.reduce((sum, item) => sum + item.count, 0);
      const sportsSummaryList = selectedSports.map((item) => item.sport).join(', ');

      const fullAddressString = `${addressDetail.trim()}, Kel. ${selectedVillage.name}, Kec. ${selectedDistrict.name}, ${selectedRegency.name}, Prov. ${selectedProvince.name}`;

      const tenantPayload = {
        name: arenaName.trim(),
        phone: phone.trim(),
        ownerName: ownerName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Owner',
        address: fullAddressString,
        province: selectedProvince.name,
        regency: selectedRegency.name,
        district: selectedDistrict.name,
        village: selectedVillage.name,
        sportsType: sportsSummaryList,
        courtsCount: totalCourtsCount,
        ownerEmail: user.email,
        ownerUid: user.id, // Injeksi UID otentikasi agar tidak null
        status: 'active'
      };

      // 1. Create Tenant in Supabase
      const createdTenant = await createTenant(tenantPayload);
      const newTenantId = createdTenant.id;

      // 2. Prepare Courts and batch insert to Supabase
      const courtsToCreate = [];
      for (const sportItem of selectedSports) {
        for (let i = 1; i <= sportItem.count; i++) {
          courtsToCreate.push({
            tenantId: newTenantId,
            name: `${sportItem.sport} ${i}`,
            sport: sportItem.sport,
            courtNumber: `${i}`,
            price: 0,
            isActive: true
          });
        }
      }

      if (courtsToCreate.length > 0) {
        await createCourtsBatch(courtsToCreate);
      }

      // 3. Notify Parent & Trigger Dashboard Switch
      if (onTenantCreated) {
        onTenantCreated(createdTenant);
      }
    } catch (err) {
      console.error('Error in Onboarding submission:', err);
      setErrorMessage('Gagal mengaktifkan GOR. Silakan periksa koneksi Anda dan coba lagi.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center px-4 py-8 sm:py-12 text-[#333333]">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 border-b border-gray-100 pb-5">
          <div className="mx-auto w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md shadow-blue-200">
            CSC
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#333333]">Aktivasi GOR &amp; Arena Olahraga</h1>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {loadingInvitation ? (
              <span className="flex items-center justify-center space-x-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Menyiapkan profil undangan...</span>
              </span>
            ) : (
              <>
                Selamat datang, <span className="font-bold text-[#333333]">{ownerName}</span>! Selesaikan 3 langkah mudah untuk membuka sistem ERP CHUA SPORT CORE.
              </>
            )}
          </p>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span className={currentStep === 1 ? 'text-blue-600' : ''}>1. Profil GOR</span>
            <span className={currentStep === 2 ? 'text-blue-600' : ''}>2. Lokasi Emsifa</span>
            <span className={currentStep === 3 ? 'text-blue-600' : ''}>3. Lapangan &amp; Fasilitas</span>
          </div>

          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: currentStep === 1 ? '33.33%' : currentStep === 2 ? '66.66%' : '100%' }}
            />
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
            <X className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* WIZARD STEP 1: PROFIL DASAR & SINKRONISASI UNDANGAN */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center space-x-3 text-xs text-[#333333]">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-bold">Akun Terverifikasi:</p>
                <p className="text-gray-600">{userProfile?.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                Nama GOR / Sports Arena <span className="text-blue-600">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={arenaName}
                  onChange={(e) => setArenaName(e.target.value)}
                  placeholder="contoh: GOR Utama Badminton Center"
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                No. WhatsApp Operasional <span className="text-blue-600">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="081234567890"
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Digunakan untuk konfirmasi booking otomatis ke pelanggan.</p>
            </div>
          </div>
        )}

        {/* WIZARD STEP 2: LOKASI API EMSIFA (100% REAL DATA) */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-600">
              <MapPin className="w-4 h-4" />
              <span>Pilih Wilayah Administrasi Indonesia (Emsifa API)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Provinsi */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Provinsi <span className="text-blue-600">*</span>
                </label>
                <select
                  value={selectedProvince?.id || ''}
                  onChange={handleProvinceChange}
                  disabled={loadingProvinces}
                  className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">{loadingProvinces ? 'Memuat data provinsi...' : '-- Pilih Provinsi --'}</option>
                  {provinces.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kota / Kab */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Kota / Kabupaten <span className="text-blue-600">*</span>
                </label>
                <select
                  value={selectedRegency?.id || ''}
                  onChange={handleRegencyChange}
                  disabled={!selectedProvince || loadingRegencies}
                  className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingRegencies
                      ? 'Memuat data kota...'
                      : !selectedProvince
                      ? 'Pilih Provinsi terlebih dahulu'
                      : '-- Pilih Kota / Kab --'}
                  </option>
                  {regencies.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kecamatan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Kecamatan <span className="text-blue-600">*</span>
                </label>
                <select
                  value={selectedDistrict?.id || ''}
                  onChange={handleDistrictChange}
                  disabled={!selectedRegency || loadingDistricts}
                  className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingDistricts
                      ? 'Memuat data kecamatan...'
                      : !selectedRegency
                      ? 'Pilih Kota terlebih dahulu'
                      : '-- Pilih Kecamatan --'}
                  </option>
                  {districts.map((dist) => (
                    <option key={dist.id} value={dist.id}>
                      {dist.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kelurahan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Kelurahan / Desa <span className="text-blue-600">*</span>
                </label>
                <select
                  value={selectedVillage?.id || ''}
                  onChange={handleVillageChange}
                  disabled={!selectedDistrict || loadingVillages}
                  className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingVillages
                      ? 'Memuat data kelurahan...'
                      : !selectedDistrict
                      ? 'Pilih Kecamatan terlebih dahulu'
                      : '-- Pilih Kelurahan --'}
                  </option>
                  {villages.map((vil) => (
                    <option key={vil.id} value={vil.id}>
                      {vil.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Alamat Jalan Lengkap */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Alamat Jalan &amp; Patokan Lengkap <span className="text-blue-600">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="Jl. Pemuda No. 88, RT 02 / RW 05 (Samping Gedung Serbaguna)"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* WIZARD STEP 3: FASILITAS ARENA DINAMIS & AUTO-GENERATE COURTS */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-blue-600">
                <Dumbbell className="w-4 h-4" />
                <span>Pilih Cabang Olahraga &amp; Jumlah Lapangan</span>
              </div>
            </div>

            {/* Quick Select Chips Horizontal Bar */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Quick Select Chips</p>
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
                {QUICK_SPORTS_CHIPS.map((chip) => {
                  const isSelected = selectedSports.some(
                    (s) => s.sport.toLowerCase() === chip.toLowerCase()
                  );
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAddSportChip(chip)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border shrink-0 flex items-center space-x-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>+ {chip}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Sport Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={customSportInput}
                onChange={(e) => setCustomSportInput(e.target.value)}
                placeholder="Ketik nama olahraga lain (misal: Squash)..."
                className="flex-1 px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (customSportInput.trim()) {
                    handleAddSportChip(customSportInput);
                    setCustomSportInput('');
                  }
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Tambah
              </button>
            </div>

            {/* Selected Sports Compact List */}
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Daftar Lapangan Akan Dibuat Auto-Generate ({selectedSports.reduce((a, b) => a + b.count, 0)} Lapangan Total)
              </p>

              {selectedSports.length === 0 ? (
                <div className="py-6 border-2 border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-400">
                  Belum ada cabang olahraga dipilih. Klik chips di atas untuk menambah.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                  {selectedSports.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <div>
                          <p className="font-bold text-xs text-[#333333]">{item.sport}</p>
                          <p className="text-[10px] text-gray-400">
                            Akan membuat: {item.sport} 1 s/d {item.sport} {item.count}
                          </p>
                        </div>
                      </div>

                      {/* Custom Stepper & Remove */}
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                          <button
                            type="button"
                            onClick={() => handleUpdateSportCount(idx, -1)}
                            className="p-1 hover:bg-white rounded-md text-gray-600 cursor-pointer"
                            title="Kurangi"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 font-extrabold text-xs text-[#333333] min-w-[24px] text-center">
                            {item.count}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateSportCount(idx, 1)}
                            className="p-1 hover:bg-white rounded-md text-gray-600 cursor-pointer"
                            title="Tambah"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSport(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WIZARD BOTTOM NAVIGATION BUTTONS */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={submitting}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex items-center space-x-2 px-6 py-2.5 bg-[#333333] hover:bg-black text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer ml-auto"
            >
              <span>Selanjutnya</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-200 transition-all cursor-pointer disabled:opacity-60 ml-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Mengaktifkan GOR &amp; Auto-Generate Lapangan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aktifkan GOR &amp; Masuk Dashboard</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
