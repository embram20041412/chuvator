import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useArenaData from '../hooks/useArenaData';
import { updateTenantProfile, updateCourt, updateCourtsBatch } from '../services/supabaseArenaService';
import { logoutUser } from '../services/authService';
import { 
  registerStaffByOwner, 
  getStaffListByTenant, 
  deleteStaffDoc 
} from '../services/staffService';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Dumbbell, 
  Save, 
  CheckCircle2, 
  DollarSign, 
  Inbox, 
  QrCode,
  CreditCard,
  Upload,
  Image as ImageIcon,
  Loader2,
  Calendar,
  Printer,
  Trash2,
  Plus,
  GraduationCap,
  Sparkles,
  Lock,
  UserPlus,
  Users,
  ShieldCheck,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { Pengaturan3DIcon } from '../components/icons/App3DIcons';
import { uploadToCloudinary } from '../services/uploadService';
import { useTheme } from '../context/ThemeContext';

const SUPPORTED_SPORTS = [
  'Badminton', 
  'Tenis', 
  'Padel', 
  'Squash', 
  'Tenis Meja', 
  'SepakBola', 
  'Futsal', 
  'Minisoccer', 
  'BolaBasket 5v5', 
  'BolaBasket 3v3', 
  'Bola Voli indoor', 
  'Bola Voli pasir', 
  'Sepak Takraw'
];

export function formatNumberWithDots(val) {
  if (val === null || val === undefined || val === '') return '';
  const numStr = String(val).replace(/\D/g, '');
  if (!numStr) return '';
  return Number(numStr).toLocaleString('id-ID');
}

export function parseNumberFromDots(val) {
  if (val === null || val === undefined || val === '') return 0;
  const numStr = String(val).replace(/\D/g, '');
  return Number(numStr) || 0;
}

export default function PengaturanPage({ userProfile, onTenantUpdated }) {
  const navigate = useNavigate();
  const { theme, isDark, setTheme } = useTheme();
  const { tenantProfile, courts, isLoading } = useArenaData(userProfile);
  const tenant = tenantProfile || userProfile?.tenant;
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['profil', 'pembayaran', 'spp_struk', 'tarif', 'master_pricing', 'staf'];
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam && validTabs.includes(tabParam)) ? tabParam : 'profil';

  // Tab Navigation State (Synced with Sidebar and URL)
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync activeTab when URL tab parameter changes
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && validTabs.includes(currentTab)) {
      setActiveTab(currentTab);
    } else if (!currentTab) {
      setActiveTab('profil');
    }
  }, [searchParams]);

  const roleDisplay = 
    userProfile?.role === 'superadmin' ? 'Super Admin' :
    userProfile?.role === 'owner' ? 'Owner GOR' :
    userProfile?.role === 'admin' ? 'Admin Staf' :
    userProfile?.role === 'pelatih' ? 'Pelatih Akademi' : 'Owner / Pengelola';

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Multi-Bank Accounts State & Handlers
  const [bankAccounts, setBankAccounts] = useState([
    { bankName: '', accountNumber: '', accountName: '' }
  ]);

  const handleBankAccountChange = (index, field, value) => {
    setBankAccounts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddBankAccount = () => {
    setBankAccounts((prev) => [...prev, { bankName: '', accountNumber: '', accountName: '' }]);
  };

  const handleRemoveBankAccount = (index) => {
    setBankAccounts((prev) => prev.filter((_, i) => i !== index));
  };

  // Form & Notification States
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [sportsType, setSportsType] = useState('Badminton');
  const [logoUrl, setLogoUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [receiptHeaderName, setReceiptHeaderName] = useState('');
  const [receiptAddress, setReceiptAddress] = useState('');
  const [receiptContact, setReceiptContact] = useState('');
  const [receiptFooterNote, setReceiptFooterNote] = useState('');
  const [qrisImageBase64, setQrisImageBase64] = useState('');
  const [qrisFileName, setQrisFileName] = useState('');
  const [sppBillingStartDay, setSppBillingStartDay] = useState(1);
  const [sppDueDay, setSppDueDay] = useState(10);
  const [courtPrices, setCourtPrices] = useState({});
  const [savingCourtId, setSavingCourtId] = useState(null);
  const [courtSuccessMsg, setCourtSuccessMsg] = useState(null);
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantSuccessMsg, setTenantSuccessMsg] = useState('');
  const [tenantErrorMsg, setTenantErrorMsg] = useState(null);

  // Master Data: Tarif Akademi States
  const [academyPricing, setAcademyPricing] = useState({});
  const [newSportName, setNewSportName] = useState('');
  const [newSportSpp, setNewSportSpp] = useState('');
  const [newSportReg, setNewSportReg] = useState('');

  // Staff Management (Client-Side RBAC) States
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffSuccessMsg, setStaffSuccessMsg] = useState(null);
  const [staffErrorMsg, setStaffErrorMsg] = useState(null);
  const [registeringStaff, setRegisteringStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('admin');

  useEffect(() => {
    if (tenant?.id && activeTab === 'staf') {
      fetchStaffList();
    }
  }, [tenant?.id, activeTab]);

  const fetchStaffList = async () => {
    if (!tenant?.id) return;
    setLoadingStaff(true);
    try {
      const list = await getStaffListByTenant(tenant.id);
      setStaffList(list);
    } catch (err) {
      console.error('Error fetching staff list:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleRegisterStaff = async (e) => {
    e.preventDefault();
    if (!tenant?.id) {
      setStaffErrorMsg('ID Tenant belum dimuat. Pastikan profil GOR telah dibuat.');
      return;
    }

    setRegisteringStaff(true);
    setStaffSuccessMsg(null);
    setStaffErrorMsg(null);

    try {
      await registerStaffByOwner({
        name: newStaffName,
        email: newStaffEmail,
        password: newStaffPassword,
        role: newStaffRole,
        tenantId: tenant.id
      });

      setStaffSuccessMsg(`Berhasil mendaftarkan ${newStaffRole === 'admin' ? 'Admin Staf' : 'Pelatih Akademi'} (${newStaffEmail})!`);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffRole('admin');

      fetchStaffList();
      setTimeout(() => setStaffSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error registering staff:', err);
      setStaffErrorMsg(err.message || 'Gagal mendaftarkan akun staf.');
    } finally {
      setRegisteringStaff(false);
    }
  };

  const handleDeleteStaff = async (staffUid, staffEmail) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akses staf (${staffEmail})?`)) return;

    try {
      await deleteStaffDoc(staffUid);
      setStaffSuccessMsg(`Akun staf (${staffEmail}) berhasil dihapus.`);
      fetchStaffList();
      setTimeout(() => setStaffSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error deleting staff doc:', err);
      setStaffErrorMsg('Gagal menghapus dokumen staf.');
    }
  };

  // CRUD Handlers for Master Data Tarif Akademi
  const handleAcademyPricingChange = (sport, field, val) => {
    setAcademyPricing((prev) => ({
      ...prev,
      [sport]: {
        ...prev[sport],
        [field]: Number(val) || 0
      }
    }));
  };

  const handleAddSportPricing = () => {
    const trimmed = newSportName.trim();
    if (!trimmed) {
      setTenantErrorMsg('Silakan pilih cabang olahraga terlebih dahulu dari daftar!');
      return;
    }
    setTenantErrorMsg(null);
    setAcademyPricing((prev) => ({
      ...prev,
      [trimmed]: {
        spp: Number(newSportSpp) || 0,
        registration: Number(newSportReg) || 0
      }
    }));
    setNewSportName('');
    setNewSportSpp('');
    setNewSportReg('');
  };

  const handleDeleteSportPricing = (sport) => {
    setAcademyPricing((prev) => {
      const copy = { ...prev };
      delete copy[sport];
      return copy;
    });
  };

  // Sync tenant profile form values when tenant changes
  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      setLogoUrl(tenant.logoUrl || '');
      setAddress(tenant.address || '');
      setPhone(tenant.phone || '');
      setSportsType(tenant.sportsType || 'Badminton');
      setBankName(tenant.bankName || '');
      setBankAccountNumber(tenant.bankAccountNumber || '');
      setBankAccountName(tenant.bankAccountName || '');
      if (Array.isArray(tenant.bankAccounts) && tenant.bankAccounts.length > 0) {
        setBankAccounts(tenant.bankAccounts);
      } else if (tenant.bankName || tenant.bankAccountNumber || tenant.bankAccountName) {
        setBankAccounts([{
          bankName: tenant.bankName || '',
          accountNumber: tenant.bankAccountNumber || '',
          accountName: tenant.bankAccountName || ''
        }]);
      } else {
        setBankAccounts([{ bankName: '', accountNumber: '', accountName: '' }]);
      }
      setReceiptHeaderName(tenant.receiptHeaderName || tenant.name || '');
      setReceiptAddress(tenant.receiptAddress || tenant.address || '');
      setReceiptContact(tenant.receiptContact || tenant.phone || '');
      setReceiptFooterNote(
        tenant.receiptFooterNote || 'Terima kasih atas kunjungan Anda. Selamat berolahraga!'
      );
      setQrisImageBase64(tenant.qrisUrl || tenant.qrisImageBase64 || '');
      setSppBillingStartDay(tenant.sppBillingStartDay ?? 1);
      setSppDueDay(tenant.sppDueDay ?? 10);
      setAcademyPricing(tenant.academyPricing || {});
    }
  }, [tenant]);

  // Sync courts prices into local editable state
  useEffect(() => {
    if (courts && courts.length > 0) {
      const priceMap = {};
      courts.forEach((c) => {
        priceMap[c.id] = c.price ? formatNumberWithDots(c.price) : '0';
      });
      setCourtPrices(priceMap);
    }
  }, [courts]);

  // Logo GOR Cloudinary Upload Handler
  const handleLogoFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setTenantErrorMsg('File yang dipilih harus berupa gambar (JPG, PNG, WebP, SVG).');
      return;
    }

    if (!tenant?.id) {
      setTenantErrorMsg('ID Tenant belum ditemukan.');
      return;
    }

    setIsUploadingLogo(true);
    setTenantErrorMsg(null);
    setTenantSuccessMsg(null);

    try {
      const uploadResult = await uploadToCloudinary(file, {
        folder: 'chua_sport_tenant_logos',
      });
      const cloudUrl = uploadResult.secure_url;
      setLogoUrl(cloudUrl);

      // Simpan langsung ke dokumen tenant di Supabase
      await updateTenantProfile(tenant.id, {
        logoUrl: cloudUrl,
      });

      setTenantSuccessMsg('Logo GOR berhasil diunggah dan disimpan!');
      if (onTenantUpdated) {
        onTenantUpdated({ ...tenant, logoUrl: cloudUrl });
      }
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      setTimeout(() => setTenantSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error uploading tenant logo:', err);
      setTenantErrorMsg('Gagal mengunggah logo ke Cloudinary: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // FileReader Handler to convert chosen image file into Base64 string
  const handleQrisFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setTenantErrorMsg('File yang dipilih harus berupa gambar (PNG/JPG/JPEG).');
      return;
    }

    // Limit size to 800 KB to fit comfortably within Firestore document limit (1 MB)
    if (file.size > 800 * 1024) {
      setTenantErrorMsg('Ukuran gambar QRIS terlalu besar (Maksimal 800 KB). Silakan kompres atau gunakan gambar yang lebih kecil.');
      return;
    }

    setTenantErrorMsg(null);
    setQrisFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setQrisImageBase64(String(reader.result));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    if (!tenant?.id) return;

    setSavingTenant(true);
    setTenantSuccessMsg(null);
    setTenantErrorMsg(null);

    try {
      // Update Tenant Document in Supabase
      const cleanedBankAccounts = bankAccounts.map((b) => ({
        bankName: (b.bankName || '').trim(),
        accountNumber: (b.accountNumber || '').trim(),
        accountName: (b.accountName || '').trim()
      }));

      const updatedData = {
        name: name.trim(),
        logoUrl: logoUrl || '',
        address: address.trim(),
        phone: phone.trim(),
        sportsType,
        bankAccounts: cleanedBankAccounts,
        bankName: cleanedBankAccounts[0]?.bankName || '',
        bankAccountNumber: cleanedBankAccounts[0]?.accountNumber || '',
        bankAccountName: cleanedBankAccounts[0]?.accountName || '',
        receiptHeaderName: receiptHeaderName.trim(),
        receiptAddress: receiptAddress.trim(),
        receiptContact: receiptContact.trim(),
        receiptFooterNote: receiptFooterNote.trim(),
        qrisUrl: qrisImageBase64,
        qrisImageBase64: qrisImageBase64,
        sppBillingStartDay: Math.min(28, Math.max(1, Number(sppBillingStartDay) || 1)),
        sppDueDay: Math.min(28, Math.max(1, Number(sppDueDay) || 10)),
        academyPricing: academyPricing || {},
        updatedAt: new Date().toISOString()
      };

      await updateTenantProfile(tenant.id, updatedData);

      setTenantSuccessMsg('Pengaturan GOR berhasil disimpan.');
      if (onTenantUpdated) {
        onTenantUpdated({ ...tenant, ...updatedData });
      }
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      setTimeout(() => setTenantSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error updating tenant profile in Supabase:', err);
      setTenantErrorMsg('Gagal menyimpan profil GOR: ' + (err.message || 'Silakan coba lagi.'));
    } finally {
      setSavingTenant(false);
    }
  };

  const handlePriceInputChange = (courtId, value) => {
    const formatted = formatNumberWithDots(value);
    setCourtPrices((prev) => ({
      ...prev,
      [courtId]: formatted
    }));
  };

  const [bulkPrices, setBulkPrices] = useState({});
  const [savingAllPrices, setSavingAllPrices] = useState(false);

  const handleBulkPriceInputChange = (sportKey, value) => {
    const formatted = formatNumberWithDots(value);
    setBulkPrices((prev) => ({
      ...prev,
      [sportKey]: formatted
    }));
  };

  const handleApplyBulkPrice = (sportKey) => {
    const formattedPrice = bulkPrices[sportKey];
    if (!formattedPrice) return;

    setCourtPrices((prev) => {
      const updated = { ...prev };
      (courts || []).forEach((c) => {
        const cSport = c.sport || 'Umum';
        if (cSport.toLowerCase() === sportKey.toLowerCase()) {
          updated[c.id] = formattedPrice;
        }
      });
      return updated;
    });

    setCourtSuccessMsg(`Tarif Rp ${formattedPrice}/jam diterapkan ke semua lapangan ${sportKey}. Klik "Simpan Semua Tarif" untuk memperbarui.`);
    setTimeout(() => setCourtSuccessMsg(null), 4000);
  };

  const courtsBySport = useMemo(() => {
    const map = {};
    if (!courts) return map;
    courts.forEach((c) => {
      const sportKey = c.sport || 'Umum';
      if (!map[sportKey]) map[sportKey] = [];
      map[sportKey].push(c);
    });
    return map;
  }, [courts]);

  const unsavedCourts = useMemo(() => {
    if (!courts || courts.length === 0) return [];
    return courts.filter((c) => {
      const currentInputFormatted = courtPrices[c.id];
      if (currentInputFormatted === undefined) return false;
      const currentVal = parseNumberFromDots(currentInputFormatted);
      const originalVal = Number(c.price || 0);
      return currentVal !== originalVal;
    });
  }, [courts, courtPrices]);

  const handleSaveAllCourtPrices = async () => {
    if (unsavedCourts.length === 0) {
      setCourtSuccessMsg('Semua tarif lapangan sudah sesuai dengan data terbaru.');
      setTimeout(() => setCourtSuccessMsg(null), 3000);
      return;
    }

    setSavingAllPrices(true);
    setCourtSuccessMsg(null);

    try {
      const updatesArray = unsavedCourts.map((c) => ({
        id: c.id,
        name: c.name,
        sport: c.sport,
        price: parseNumberFromDots(courtPrices[c.id] ?? c.price),
        isActive: c.isActive !== false
      }));

      await updateCourtsBatch(updatesArray);

      setCourtSuccessMsg(`Berhasil menyimpan tarif untuk ${updatesArray.length} lapangan!`);
      window.dispatchEvent(new CustomEvent('simak_refresh_arena_data'));
      setTimeout(() => setCourtSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error batch updating court prices in Supabase:', err);
      alert('Gagal menyimpan tarif lapangan: ' + (err.message || 'Silakan coba lagi'));
    } finally {
      setSavingAllPrices(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto text-[#333333]">
      
      {/* HEADER */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex items-center gap-4">
        <Pengaturan3DIcon className="w-14 h-14 shrink-0 drop-shadow-2xs" />
        <div>
          <h1 className="text-xl font-bold text-[#333333]">Pengaturan</h1>
          <p className="text-xs text-gray-500 mt-0.5">Kelola profil arena, gambar Kode QRIS, rekening bank, dan tarif per jam lapangan</p>
        </div>
      </div>

      {/* KARTU INFORMASI AKUN & LOGOUT */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {userProfile?.photoURL ? (
            <img 
              src={userProfile.photoURL} 
              alt="Avatar" 
              className="w-11 h-11 rounded-full border border-slate-200 object-cover shrink-0" 
            />
          ) : (
            <div className="w-11 h-11 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
              {(userProfile?.displayName || 'Najwa Sheinara').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-slate-800 truncate">
                {userProfile?.displayName || 'Najwa Sheinara'}
              </h3>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0">
                {roleDisplay}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {userProfile?.email || 'sheinaranajwa0@gmail.com'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
          {/* THEME SELECTOR PILL (Terang / Light vs Gelap / Dark) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                !isDark 
                  ? 'bg-white text-blue-600 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Aktifkan Mode Terang (Light Mode)"
            >
              <Sun className={`w-3.5 h-3.5 ${!isDark ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>Terang</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-900 text-amber-400 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Aktifkan Mode Gelap (Dark Mode)"
            >
              <Moon className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>Gelap</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </div>

      {tenantSuccessMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{tenantSuccessMsg}</span>
        </div>
      )}

      {tenantErrorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold">
          {tenantErrorMsg}
        </div>
      )}

      {/* TAB CONTENT CONTAINER */}
      <form onSubmit={handleUpdateTenant} className="mt-4">
        
        {/* TAB 1: PROFIL IDENTITAS GOR */}
        {activeTab === 'profil' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5 text-left animate-fadeIn">
            <h2 className="font-bold text-base text-[#333333] border-b border-gray-100 pb-3 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Tab 1: Profil Identitas GOR</span>
            </h2>

            {/* UNGGAH LOGO GOR */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Logo GOR / Identitas Visual Arena
              </label>

              {/* Pratinjau Logo */}
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Pratinjau Logo GOR"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-xl">
                      {name?.trim() ? name.trim().charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-bold text-gray-800">
                    {logoUrl ? 'Logo GOR Aktif' : 'Belum Ada Logo Khusus (Menggunakan Inisial)'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Format: JPG, PNG, WebP, SVG. Logo otomatis diunggah ke Cloudinary dan ditampilkan pada Header &amp; Dashboard menggantikan logo CSC.
                  </p>
                </div>
              </div>

              {/* Input File & Status */}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileSelect}
                  disabled={isUploadingLogo || savingTenant}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer bg-white"
                />
                {isUploadingLogo && (
                  <p className="mt-1.5 text-xs text-blue-600 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sedang mengunggah logo ke Cloudinary &amp; menyimpan ke Firestore...</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama GOR / Sports Arena</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kategori Olahraga Utama</label>
                <input
                  type="text"
                  value={sportsType}
                  onChange={(e) => setSportsType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kontak WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Alamat Lengkap GOR</label>
              <textarea
                rows={3}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingTenant}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-60"
              >
                {savingTenant ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan Profil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: REKENING & QRIS */}
        {activeTab === 'pembayaran' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-6 text-left animate-fadeIn">
            <h2 className="font-bold text-base text-[#333333] border-b border-gray-100 pb-3 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Tab 2: Informasi Rekening Bank &amp; QRIS Statis</span>
            </h2>

            {/* INFORMASI REKENING BANK (MULTI-REKENING) */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4" />
                <span>Informasi Rekening Bank Transfer</span>
              </h3>

              {bankAccounts.map((acc, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Rekening #{index + 1}
                    </span>
                    {bankAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBankAccount(index)}
                        className="p-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Hapus Rekening"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nama Bank</label>
                      <input
                        type="text"
                        value={acc.bankName || ''}
                        onChange={(e) => handleBankAccountChange(index, 'bankName', e.target.value)}
                        placeholder="BCA, Mandiri, BRI, dll"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nomor Rekening</label>
                      <input
                        type="text"
                        value={acc.accountNumber || ''}
                        onChange={(e) => handleBankAccountChange(index, 'accountNumber', e.target.value)}
                        placeholder="8830123456"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Atas Nama (Pemilik)</label>
                      <input
                        type="text"
                        value={acc.accountName || ''}
                        onChange={(e) => handleBankAccountChange(index, 'accountName', e.target.value)}
                        placeholder="a.n. PT Chua Sport"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={handleAddBankAccount}
                  className="px-4 py-2.5 bg-white border-2 border-dashed border-blue-300 hover:border-blue-500 text-blue-700 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Rekening Lain</span>
                </button>
              </div>
            </div>

            {/* UPLOAD FILE GAMBAR QRIS STATIS (BASE64) */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center space-x-1.5">
                <QrCode className="w-4 h-4" />
                <span>Gambar Kode QRIS Statis</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                {qrisImageBase64 ? (
                  <div className="relative shrink-0">
                    <img
                      src={qrisImageBase64}
                      alt="Preview QRIS"
                      className="w-28 h-28 object-contain rounded-xl border border-gray-200 shadow-xs p-1 bg-white"
                    />
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-600 text-white font-extrabold text-[9px] rounded-full shadow-2xs">
                      Aktif
                    </span>
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center p-2 text-center text-gray-400 shrink-0">
                    <ImageIcon className="w-6 h-6 mb-1 text-gray-300" />
                    <span className="text-[10px] font-semibold">Belum Ada QRIS</span>
                  </div>
                )}

                <div className="space-y-2 flex-1">
                  <p className="text-xs font-bold text-[#333333]">
                    {qrisImageBase64 ? 'Ganti Gambar QRIS Statis' : 'Upload File QRIS Statis'}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    Pilih file gambar QRIS (PNG/JPG) max 800 KB dari perangkat Anda. Tersimpan aman di Firestore.
                  </p>

                  <label className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 hover:border-blue-500 hover:text-blue-600 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer shadow-2xs transition-colors">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>{qrisFileName ? `File: ${qrisFileName}` : 'Pilih File Gambar QRIS...'}</span>
                    <input type="file" accept="image/*" onChange={handleQrisFileSelect} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingTenant}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-60"
              >
                {savingTenant ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Rekening &amp; QRIS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: TAGIHAN SPP & STRUK KASIR */}
        {activeTab === 'spp_struk' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-6 text-left animate-fadeIn">
            <h2 className="font-bold text-base text-[#333333] border-b border-gray-100 pb-3 flex items-center space-x-2">
              <Printer className="w-4 h-4 text-blue-600" />
              <span>Tab 3: Tagihan SPP Akademi &amp; Struk Kasir Thermal</span>
            </h2>

            {/* PENGATURAN TAGIHAN SPP AKADEMI */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Calendar className="w-4 h-4" />
                <span>Pengaturan Tagihan SPP Akademi</span>
              </h3>
              <p className="text-[11px] text-gray-500">
                Konfigurasi siklus penagihan iuran SPP bulanan siswa akademi dan tanggal jatuh tempo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    Tanggal Mulai Tagihan (Tiap Bulan)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="28"
                      required
                      value={sppBillingStartDay}
                      onChange={(e) => setSppBillingStartDay(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-[#333333]"
                    />
                    <span className="text-[10px] text-gray-400 absolute right-3 top-2.5">Tgl 1 - 28</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    Tanggal Jatuh Tempo (Tiap Bulan)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="28"
                      required
                      value={sppDueDay}
                      onChange={(e) => setSppDueDay(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-[#333333]"
                    />
                    <span className="text-[10px] text-gray-400 absolute right-3 top-2.5">Tgl 1 - 28</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PENGATURAN STRUK KASIR THERMAL & LIVE PREVIEW */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Printer className="w-4 h-4" />
                <span>Pengaturan Struk Kasir Thermal &amp; Live Preview</span>
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* LEFT: FORM EDITOR (7 COLS) */}
                <div className="lg:col-span-7 space-y-3 bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                      Nama Usaha / Header Struk
                    </label>
                    <input
                      type="text"
                      value={receiptHeaderName}
                      onChange={(e) => setReceiptHeaderName(e.target.value)}
                      placeholder="e.g. GOR CHUA SPORT CORE"
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-[#333333]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                      Alamat Lengkap Usaha / Lapangan
                    </label>
                    <input
                      type="text"
                      value={receiptAddress}
                      onChange={(e) => setReceiptAddress(e.target.value)}
                      placeholder="e.g. Jl. Raya Olahraga No. 88, Jakarta"
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium text-[#333333]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                      Kontak / No. Telepon / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={receiptContact}
                      onChange={(e) => setReceiptContact(e.target.value)}
                      placeholder="e.g. Telp / WA: 0812-3456-7890"
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium text-[#333333]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                      Pesan Catatan Kaki (Footer Note Struk)
                    </label>
                    <textarea
                      rows={2}
                      value={receiptFooterNote}
                      onChange={(e) => setReceiptFooterNote(e.target.value)}
                      placeholder="e.g. Terima kasih atas kunjungan Anda. Selamat berolahraga!"
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium text-[#333333]"
                    />
                  </div>
                </div>

                {/* RIGHT: LIVE PREVIEW CARD (5 COLS) */}
                <div className="lg:col-span-5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                    <span className="flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Live Preview Struk Thermal</span>
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">80mm Paper</span>
                  </div>

                  <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 shadow-sm font-mono text-[11px] text-slate-800 space-y-2 relative overflow-hidden select-none">
                    <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                      <p className="font-extrabold text-xs uppercase tracking-tight text-slate-900 leading-tight">
                        {receiptHeaderName || 'NAMA GOR / TENANT'}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {receiptAddress || 'Alamat Belum Diatur'}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {receiptContact || 'Telp: 08xx-xxxx-xxxx'}
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-600 space-y-0.5 py-1">
                      <div className="flex justify-between">
                        <span>No. Nota:</span>
                        <span className="font-bold">#INV-2026-001</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tanggal:</span>
                        <span>{new Date().toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kasir:</span>
                        <span>Admin Kasir</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-slate-300 my-1" />

                    <div className="space-y-1 text-[10px] py-1">
                      <div className="flex justify-between">
                        <span>Sewa Lapangan 1 (2 Jam)</span>
                        <span>Rp 100.000</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Air Mineral 600ml (2x)</span>
                        <span>Rp 10.000</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-slate-300 my-1" />

                    <div className="flex justify-between text-xs font-black text-slate-900 py-0.5">
                      <span>TOTAL:</span>
                      <span>Rp 110.000</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Metode:</span>
                      <span className="font-bold text-slate-700">QRIS Statis</span>
                    </div>

                    <div className="border-b border-dashed border-slate-300 my-1" />

                    <div className="text-center text-[10px] text-slate-500 italic pt-1 leading-tight">
                      {receiptFooterNote || 'Terima kasih atas kunjungan Anda!'}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingTenant}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-60"
              >
                {savingTenant ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Tagihan SPP &amp; Struk</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </form>

      {/* TAB 4: TARIF LAPANGAN */}
      {activeTab === 'tarif' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-6 text-left animate-fadeIn mt-4">
          
          {/* HEADER & MAIN SAVE ACTION */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-[#333333] flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span>Pengaturan Tarif Lapangan (Rp / Jam)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Atur tarif sewa reguler per jam untuk masing-masing lapangan secara individual atau massal per cabang olahraga.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {unsavedCourts.length > 0 && (
                <span className="px-3 py-1.5 bg-amber-50 text-amber-800 text-xs font-extrabold rounded-xl border border-amber-200/80 animate-pulse">
                  {unsavedCourts.length} Belum Disimpan
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveAllCourtPrices}
                disabled={savingAllPrices || isLoading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                {savingAllPrices ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Menyimpan Semua Tarif...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-cyan-200" />
                    <span>Simpan Semua Tarif {unsavedCourts.length > 0 ? `(${unsavedCourts.length})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {courtSuccessMsg && (
            <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>{courtSuccessMsg}</span>
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-gray-500 py-4">Memuat daftar lapangan...</p>
          ) : courts.length === 0 ? (
            <div className="py-8 border-2 border-dashed border-gray-200 rounded-xl text-center p-6 flex flex-col items-center">
              <Inbox className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-600">Belum ada lapangan terdaftar. Lengkapi fasilitas di onboarding.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* BULK APPLY SECTION PER CABANG OLAHRAGA */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                      Atur Cepat per Cabang Olahraga (Bulk Apply)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Ketik nominal lalu terapkan ke seluruh lapangan pada cabor pilihan
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                  {Object.entries(courtsBySport).map(([sportKey, sportCourts]) => {
                    const currentBulkInput = bulkPrices[sportKey] || '';
                    return (
                      <div key={sportKey} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 uppercase flex items-center space-x-1">
                            <Dumbbell className="w-3.5 h-3.5 text-blue-600" />
                            <span>{sportKey}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md border border-blue-100">
                            {sportCourts.length} Lapangan
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="relative">
                            <span className="text-xs font-bold text-gray-400 absolute left-3 top-2.5">Rp</span>
                            <input
                              type="text"
                              placeholder="e.g. 150.000"
                              value={currentBulkInput}
                              onChange={(e) => handleBulkPriceInputChange(sportKey, e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-[#333333]"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyBulkPrice(sportKey)}
                            disabled={!currentBulkInput}
                            className="w-full py-1.5 bg-slate-800 hover:bg-black text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                          >
                            Terapkan ke Semua {sportKey}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DAFTAR LAPANGAN INDIVIDUAL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                    Daftar Lapangan &amp; Input Tarif Individual
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Total: {courts.length} Lapangan</span>
                </div>

                <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  {courts.map((court) => {
                    const currentPriceInput = courtPrices[court.id] !== undefined ? courtPrices[court.id] : formatNumberWithDots(court.price || 0);
                    const parsedInputVal = parseNumberFromDots(currentPriceInput);
                    const isChanged = parsedInputVal !== Number(court.price || 0);

                    return (
                      <div key={court.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isChanged ? 'bg-amber-50/40' : 'hover:bg-gray-50/50'}`}>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-[#333333]">{court.name}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-bold text-[10px] rounded-md uppercase">
                              {court.sport || 'Sports'}
                            </span>
                            {isChanged && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold text-[10px] rounded-md uppercase border border-amber-200">
                                Ada Perubahan
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Tarif Tersimpan: <span className="font-semibold text-gray-600">Rp {Number(court.price || 0).toLocaleString('id-ID')}/jam</span>
                          </p>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col items-start sm:items-end">
                            <div className="relative">
                              <span className="text-xs font-bold text-gray-400 absolute left-3 top-2.5">Rp</span>
                              <input
                                type="text"
                                value={currentPriceInput}
                                onChange={(e) => handlePriceInputChange(court.id, e.target.value)}
                                className={`w-40 pl-8 pr-3 py-2 text-xs border rounded-xl focus:bg-white focus:outline-none font-extrabold text-[#333333] ${isChanged ? 'bg-white border-amber-300 ring-2 ring-amber-100' : 'bg-gray-50 border-gray-200 focus:border-blue-500'}`}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-blue-600 mt-1">
                              Pratinjau: Rp {parsedInputVal.toLocaleString('id-ID')} / jam
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BOTTOM MAIN SAVE BUTTON */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAllCourtPrices}
                  disabled={savingAllPrices || isLoading}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-200 transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {savingAllPrices ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan Semua Tarif...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-cyan-200" />
                      <span>Simpan Semua Tarif {unsavedCourts.length > 0 ? `(${unsavedCourts.length} Perubahan)` : ''}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {/* TAB 5: MASTER DATA TARIF AKADEMI */}
      {activeTab === 'master_pricing' && (
        <form onSubmit={handleUpdateTenant} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-6 text-left animate-fadeIn mt-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="font-bold text-base text-[#333333] flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <span>Master Data: Tarif Akademi per Cabang Olahraga</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Atur tarif SPP bulanan dan biaya pendaftaran (uang pangkal). Data ini ditarik otomatis dan dikunci pada form pendaftaran siswa baru.
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 shrink-0">
              Total: {Object.keys(academyPricing || {}).length} Cabang
            </span>
          </div>

          {/* LIST PRICING PER CABANG OLAHRAGA */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(academyPricing || {}).map(([sport, pricing]) => (
                <div key={sport} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 relative group hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Dumbbell className="w-4 h-4 text-blue-600" />
                      <span>{sport}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSportPricing(sport)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Cabang"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        SPP Bulanan (Rp)
                      </label>
                      <div className="relative">
                        <span className="text-xs font-bold text-gray-400 absolute left-2.5 top-2">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={pricing.spp ?? 0}
                          onChange={(e) => handleAcademyPricingChange(sport, 'spp', e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 font-bold text-blue-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Pendaftaran / Pangkal (Rp)
                      </label>
                      <div className="relative">
                        <span className="text-xs font-bold text-gray-400 absolute left-2.5 top-2">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={pricing.registration ?? 0}
                          onChange={(e) => handleAcademyPricingChange(sport, 'registration', e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TAMBAH CABANG OLAHRAGA BARU */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Tambah Master Tarif Cabang Baru</span>
            </h3>

            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Nama Cabang</label>
                <select
                  value={newSportName}
                  onChange={(e) => setNewSportName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-800 cursor-pointer"
                >
                  <option value="" disabled>-- Pilih Cabang Olahraga --</option>
                  {SUPPORTED_SPORTS.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">SPP Bulanan (Rp)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 300000"
                  value={newSportSpp}
                  onChange={(e) => setNewSportSpp(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Pendaftaran (Rp)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 150000"
                  value={newSportReg}
                  onChange={(e) => setNewSportReg(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-800"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleAddSportPricing}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingTenant}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-60"
            >
              {savingTenant ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Master Data Tarif</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 6: KELOLA STAF & PELATIH (CLIENT-SIDE RBAC) */}
      {activeTab === 'staf' && (
        <div className="space-y-6 text-left animate-fadeIn mt-4">
          {/* CARD 1: FORM PENDAFTARAN STAF (SECONDARY FIREBASE APP) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="font-bold text-base text-[#333333] flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <span>Daftarkan Staf Baru (Owner Portal)</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Registrasi staf/pelatih menggunakan metode Secondary Firebase App. Sesuai arsitektur, akun Owner Anda tidak akan ter-logout.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100 shrink-0">
                Secondary Firebase App
              </span>
            </div>

            {staffSuccessMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{staffSuccessMsg}</span>
              </div>
            )}

            {staffErrorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold">
                {staffErrorMsg}
              </div>
            )}

            <form onSubmit={handleRegisterStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Nama Lengkap Staf / Pelatih
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coach Agus or Budi Admin"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-[#333333]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Email Akun Staf
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="staf@chuasport.com"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-[#333333]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Kata Sandi (Password)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 Karakter"
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-[#333333]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Role / Hak Akses RBAC
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="admin">1. admin (Booking, Akademi, Event &amp; Keuangan)</option>
                    <option value="pelatih">2. pelatih (HANYA Modul Akademi)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                <strong>Ketentuan Hak Akses Role RBAC:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><strong>Admin Staf ("admin"):</strong> Memiliki akses ke modul Booking, Akademi, Event &amp; Turnamen, dan Keuangan.</li>
                  <li><strong>Pelatih ("pelatih"):</strong> HANYA memiliki akses ke modul Akademi. Menu lainnya otomatis disembunyikan.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={registeringStaff}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-60"
                >
                  {registeringStaff ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Mendaftarkan Staf...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Daftarkan Staf Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* CARD 2: DAFTAR STAF TERDAFTAR IN USERS_STAFF */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Daftar Staf &amp; Pelatih Terdaftar (Koleksi users_staff)</span>
              </h3>
              <span className="text-xs font-bold text-gray-400">
                Total: {staffList.length} Akun
              </span>
            </div>

            {loadingStaff ? (
              <p className="text-xs text-gray-500 py-4">Memuat daftar staf...</p>
            ) : staffList.length === 0 ? (
              <div className="py-8 border-2 border-dashed border-gray-200 rounded-xl text-center p-6 flex flex-col items-center">
                <Users className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-600">Belum ada staf atau pelatih terdaftar.</p>
                <p className="text-[11px] text-gray-400 mt-1">Gunakan formulir di atas untuk mendaftarkan staf baru.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {staffList.map((staf) => (
                  <div key={staf.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-800">{staf.name}</span>
                        <span className={`px-2 py-0.5 font-bold text-[10px] rounded-md uppercase ${
                          staf.role === 'admin' 
                            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                            : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}>
                          {staf.role === 'admin' ? 'Admin Staf' : 'Pelatih Akademi'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">{staf.email}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">UID: {staf.uid || staf.id}</p>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(staf.id, staf.email)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Akses</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


