import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import useArenaData from '../hooks/useArenaData';
import TenantBackfillControlCard from '../components/TenantBackfillControlCard';
import { updateTenantProfile, updateCourt, updateCourtsBatch } from '../services/supabaseArenaService';
import { logoutUser } from '../services/authService';
import { 
  registerNewStaff,
  registerStaffByOwner, 
  getStaffListByTenant, 
  getInvitationsByTenant,
  getPendingInvitationsByTenant,
  revokeStaffInvitation,
  deleteStaffDoc,
  resendStaffInvitation,
  formatInvitationExpiry
} from '../services/staffService';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Dumbbell, 
  Save, 
  CheckCircle2, 
  AlertCircle,
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
  Moon,
  Mail,
  Clock,
  Ban,
  X,
  Copy,
  Check,
  Info,
  Send
} from 'lucide-react';
import { Pengaturan3DIcon } from '../components/icons/App3DIcons';
import { useTheme } from '../context/ThemeContext';
import useMobileViewport from '../mobile/hooks/useMobileViewport';
import MobileCourtPricingMain from '../mobile/pages/admin/MobileCourtPricingMain';
import MobileTenantProfileMain from '../mobile/pages/admin/MobileTenantProfileMain';
import MobilePaymentSettingsMain from '../mobile/pages/admin/MobilePaymentSettingsMain';
import PrinterSettingsPanel from '../printing/components/PrinterSettingsPanel';

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

/**
 * PengaturanDesktopMain Component
 * Original untouched desktop settings & court pricing interface.
 * All hooks are called unconditionally at the top level of this component.
 */
export function PengaturanDesktopMain({ userProfile, onTenantUpdated = () => {} }) {
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

  const [logoutError, setLogoutError] = useState(null);

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await logoutUser();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      setLogoutError(err?.message || 'Gagal keluar dari sistem. Silakan coba kembali.');
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
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [sessionInviteLinks, setSessionInviteLinks] = useState({});
  const [inviteSuccessModal, setInviteSuccessModal] = useState(null);
  const [revokeConfirmModal, setRevokeConfirmModal] = useState(null);
  const [copiedModalLink, setCopiedModalLink] = useState(false);
  const [copiedTableLinkId, setCopiedTableLinkId] = useState(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffSuccessMsg, setStaffSuccessMsg] = useState(null);
  const [staffErrorMsg, setStaffErrorMsg] = useState(null);
  const [registeringStaff, setRegisteringStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('admin');
  const [resendingStaffEmail, setResendingStaffEmail] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  useEffect(() => {
    if (tenant?.id && activeTab === 'staf') {
      fetchStaffList();

      // Realtime listener untuk users_staff & invitations di tenant aktif
      const channel = supabase
        .channel(`realtime_pengaturan_staff_${tenant.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users_staff', filter: `tenant_id=eq.${tenant.id}` },
          () => {
            fetchStaffList();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invitations', filter: `tenant_id=eq.${tenant.id}` },
          () => {
            fetchStaffList();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [tenant?.id, activeTab]);

  const fetchStaffList = async () => {
    if (!tenant?.id) return;
    setLoadingStaff(true);
    try {
      const [list, invites] = await Promise.all([
        getStaffListByTenant(tenant.id),
        getInvitationsByTenant(tenant.id)
      ]);
      setStaffList(list);
      setPendingInvitations(invites);
    } catch (err) {
      console.error('Error fetching staff list and invitations:', err);
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

    const cleanEmail = newStaffEmail.trim().toLowerCase();
    const cleanName = newStaffName.trim();

    if (!cleanName || !cleanEmail) {
      setStaffErrorMsg('Nama lengkap dan email staf wajib diisi.');
      return;
    }

    setRegisteringStaff(true);
    setStaffSuccessMsg(null);
    setStaffErrorMsg(null);

    try {
      const res = await registerNewStaff({
        fullName: cleanName,
        name: cleanName,
        email: cleanEmail,
        role: newStaffRole,
        tenantId: tenant.id
      });

      const invId = res.invitationId || res.invitation?.invitation_id || res.invitation?.id;

      if (res?.inviteUrl) {
        setSessionInviteLinks((prev) => ({
          ...prev,
          ...(invId ? { [invId]: res.inviteUrl } : {}),
          [cleanEmail]: res.inviteUrl,
        }));

        setInviteSuccessModal({
          inviteUrl: res.inviteUrl,
          email: cleanEmail,
          role: res.role || newStaffRole,
          tenantName: tenant?.name || userProfile?.tenant?.name || 'Cabang Aktif',
          expiresAt: res.expiresAt,
          createdAt: res.invitation?.created_at || new Date().toISOString(),
          invitationId: invId,
        });
      }

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffRole('admin');

      fetchStaffList();
    } catch (err) {
      console.error('Error registering staff in PengaturanPage:', err);
      setStaffErrorMsg(err.message || 'Gagal mendaftarkan akun staf.');
    } finally {
      setRegisteringStaff(false);
    }
  };

  const executeRevokeInvitation = async (invitationId, invEmail) => {
    setRevokingId(invitationId);
    try {
      await revokeStaffInvitation(invitationId);
      setStaffSuccessMsg(`Undangan untuk ${invEmail} berhasil dibatalkan.`);
      setTimeout(() => setStaffSuccessMsg(null), 4000);
      setRevokeConfirmModal(null);
      fetchStaffList();
    } catch (err) {
      console.error('Error revoking invitation in PengaturanPage:', err);
      setStaffErrorMsg('Gagal membatalkan undangan: ' + err.message);
    } finally {
      setRevokingId(null);
    }
  };

  const handleResendInvite = async (staffEmail) => {
    if (!staffEmail) return;
    setResendingStaffEmail(staffEmail);
    try {
      const res = await resendStaffInvitation(staffEmail, tenant?.id);
      if (res?.inviteUrl) {
        setStaffSuccessMsg(`Tautan undangan untuk ${staffEmail} berhasil disalin ke clipboard: ${res.inviteUrl}`);
        try {
          navigator.clipboard?.writeText(res.inviteUrl);
        } catch (_) {}
      } else {
        setStaffSuccessMsg(`Tautan undangan untuk ${staffEmail} berhasil diproses.`);
      }
      setTimeout(() => setStaffSuccessMsg(null), 8000);
    } catch (err) {
      console.error('Error resending invite in PengaturanPage:', err);
      setStaffErrorMsg(`Gagal memproses undangan: ${err.message || 'Terjadi kesalahan sistem'}`);
      setTimeout(() => setStaffErrorMsg(null), 5000);
    } finally {
      setResendingStaffEmail(null);
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
      const { uploadToCloudinary } = await import('../services/uploadService');
      const uploadResult = await uploadToCloudinary(file, {
        tenantId: tenant.id,
        category: 'logos',
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
    <div className="space-y-3.5 max-w-5xl mx-auto text-slate-800 dark:text-slate-200">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-xl p-3 sm:p-3.5 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Pengaturan3DIcon className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-2xs" />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Pengaturan</h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Kelola profil arena, QRIS, rekening bank, struk thermal kasir, dan tarif lapangan</p>
          </div>
        </div>
      </div>

      {/* KARTU INFORMASI AKUN & LOGOUT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {userProfile?.photoURL ? (
            <img 
              src={userProfile.photoURL} 
              alt="Avatar" 
              className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0" 
            />
          ) : (
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
              {(userProfile?.displayName || 'Najwa Sheinara').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                {userProfile?.displayName || 'Najwa Sheinara'}
              </h3>
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0">
                {roleDisplay}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
              {userProfile?.email || 'sheinaranajwa0@gmail.com'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          {/* THEME SELECTOR PILL (Terang / Light vs Gelap / Dark) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                !isDark 
                  ? 'bg-white text-blue-600 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Aktifkan Mode Terang (Light Mode)"
            >
              <Sun className={`w-3 h-3 ${!isDark ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>Terang</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-900 text-amber-400 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Aktifkan Mode Gelap (Dark Mode)"
            >
              <Moon className={`w-3 h-3 ${isDark ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>Gelap</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </div>

      {logoutError && (
        <div role="alert" className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs rounded-xl font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{logoutError}</span>
          </div>
          <button type="button" onClick={() => setLogoutError(null)} className="font-bold px-1 hover:text-rose-600">&times;</button>
        </div>
      )}

      {tenantSuccessMsg && (
        <div className="p-2.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 text-green-800 dark:text-green-300 text-xs rounded-xl font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <span>{tenantSuccessMsg}</span>
        </div>
      )}

      {tenantErrorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold">
          {tenantErrorMsg}
        </div>
      )}

      {/* TAB CONTENT CONTAINER */}
      <form onSubmit={handleUpdateTenant} className="mt-4">
        
        {/* TAB 1: PROFIL IDENTITAS GOR */}
        {activeTab === 'profil' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-3.5 text-left animate-fadeIn">
            <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-white/10 pb-2.5 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Tab 1: Profil Identitas GOR</span>
            </h2>

            {/* UNGGAH LOGO GOR */}
            <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-2.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                Logo GOR / Identitas Visual Arena
              </label>

              {/* Pratinjau Logo */}
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 bg-white dark:bg-slate-800">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Pratinjau Logo GOR"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center font-black text-lg">
                      {name?.trim() ? name.trim().charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {logoUrl ? 'Logo GOR Aktif' : 'Belum Ada Logo Khusus (Menggunakan Inisial)'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Format: JPG, PNG, WebP, SVG. Logo otomatis diunggah ke Cloudinary dan disinkronkan ke header &amp; dashboard.
                  </p>
                </div>
              </div>

              {/* Input File & Status */}
              <div>
                <input
  aria-label="pengaturan file 755"
  name="file_755"
  id="pengaturan-file-755"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileSelect}
                  disabled={isUploadingLogo || savingTenant}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none file:mr-2.5 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 dark:file:bg-blue-950/60 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                />
                {isUploadingLogo && (
                  <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sedang mengunggah logo ke Cloudinary...</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="settings-arena-name" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Nama GOR / Sports Arena</label>
              <input
                id="settings-arena-name"
                name="arenaName"
                type="text"
                autoComplete="organization"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="settings-sports-type" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Kategori Olahraga Utama</label>
                <input
                  id="settings-sports-type"
                  name="sportsType"
                  type="text"
                  value={sportsType}
                  onChange={(e) => setSportsType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="settings-arena-phone" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Kontak WhatsApp</label>
                <input
                  id="settings-arena-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="settings-arena-address" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Alamat Lengkap GOR</label>
              <textarea
                id="settings-arena-address"
                name="address"
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-1.5 flex justify-end">
              <button
                type="submit"
                disabled={savingTenant}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
              >
                {savingTenant ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan Profil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: REKENING & QRIS */}
        {activeTab === 'pembayaran' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-3.5 text-left animate-fadeIn">
            <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-white/10 pb-2.5 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Tab 2: Informasi Rekening Bank &amp; QRIS Statis</span>
            </h2>

            {/* INFORMASI REKENING BANK (MULTI-REKENING) */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center space-x-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Informasi Rekening Bank Transfer</span>
              </h3>

              {bankAccounts.map((acc, index) => (
                <div key={index} className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 relative space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Rekening #{index + 1}
                    </span>
                    {bankAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBankAccount(index)}
                        className="p-1 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Hapus Rekening"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nama Bank</label>
                      <input
  aria-label="pengaturan acc bank name"
  name="acc_bankName"
  id="pengaturan-acc-bank-name"
                        type="text"
                        value={acc.bankName || ''}
                        onChange={(e) => handleBankAccountChange(index, 'bankName', e.target.value)}
                        placeholder="BCA, Mandiri, BRI, dll"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nomor Rekening</label>
                      <input
  aria-label="pengaturan acc account number"
  name="acc_accountNumber"
  id="pengaturan-acc-account-number"
                        type="text"
                        value={acc.accountNumber || ''}
                        onChange={(e) => handleBankAccountChange(index, 'accountNumber', e.target.value)}
                        placeholder="8830123456"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Atas Nama (Pemilik)</label>
                      <input
  aria-label="pengaturan acc account name"
  name="acc_accountName"
  id="pengaturan-acc-account-name"
                        type="text"
                        value={acc.accountName || ''}
                        onChange={(e) => handleBankAccountChange(index, 'accountName', e.target.value)}
                        placeholder="a.n. PT Chua Sport"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={handleAddBankAccount}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border-2 border-dashed border-blue-300 hover:border-blue-500 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Rekening Lain</span>
                </button>
              </div>
            </div>

            {/* UPLOAD FILE GAMBAR QRIS STATIS (BASE64) */}
            <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-2.5">
              <h3 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center space-x-1.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>Gambar Kode QRIS Statis</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl">
                {qrisImageBase64 ? (
                  <div className="relative shrink-0">
                    <img
                      src={qrisImageBase64}
                      alt="Preview QRIS"
                      className="w-20 h-20 object-contain rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs p-1 bg-white"
                    />
                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-green-600 text-white font-extrabold text-[8px] rounded-full shadow-2xs">
                      Aktif
                    </span>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-2 text-center text-slate-400 shrink-0">
                    <ImageIcon className="w-5 h-5 mb-0.5 text-slate-300" />
                    <span className="text-[9px] font-semibold">Belum Ada QRIS</span>
                  </div>
                )}

                <div className="space-y-1.5 flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {qrisImageBase64 ? 'Ganti Gambar QRIS Statis' : 'Upload File QRIS Statis'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                    Pilih file gambar QRIS (PNG/JPG) max 800 KB dari perangkat Anda. Tersimpan aman di database.
                  </p>

                  <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer shadow-2xs transition-colors">
                    <Upload className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="truncate max-w-[200px]">{qrisFileName ? `File: ${qrisFileName}` : 'Pilih File Gambar QRIS...'}</span>
                    <input
  aria-label="pengaturan file 977"
  name="file_977"
  id="pengaturan-file-977" type="file" accept="image/*" onChange={handleQrisFileSelect} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-1.5 flex justify-end">
              <button
                type="submit"
                disabled={savingTenant}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
              >
                {savingTenant ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Rekening &amp; QRIS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: TAGIHAN SPP & STRUK KASIR */}
        {activeTab === 'spp_struk' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-5 text-left animate-fadeIn">
            {/* HEADER WITH INTEGRATED PRIMARY SAVE ACTION */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#2455E8]" />
                  <span>Tagihan SPP &amp; Struk Thermal</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Atur jadwal penagihan iuran akademi bulanan dan identitas struk transaksi kasir.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingTenant}
                className="px-4 py-2 bg-[#2455E8] hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-60 shrink-0"
              >
                {savingTenant ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Pengaturan</span>
                  </>
                )}
              </button>
            </div>

            {/* SEKSI 1: SIKLUS TAGIHAN SPP AKADEMI */}
            <div className="space-y-3 bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2455E8]" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Siklus Penagihan SPP Akademi
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Mulai Tagihan <span className="text-slate-400 font-normal">(1 - 28)</span>
                  </label>
                  <input
                    aria-label="pengaturan spp billing start day"
                    name="sppBillingStartDay"
                    id="pengaturan-spp-billing-start-day"
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={sppBillingStartDay}
                    onChange={(e) => setSppBillingStartDay(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Jatuh Tempo <span className="text-slate-400 font-normal">(1 - 28)</span>
                  </label>
                  <input
                    aria-label="pengaturan spp due day"
                    name="sppDueDay"
                    id="pengaturan-spp-due-day"
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={sppDueDay}
                    onChange={(e) => setSppDueDay(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SEKSI 2: IDENTITAS STRUK KASIR & LIVE PREVIEW */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2455E8]" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Identitas Struk Kasir &amp; Live Preview
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* LEFT: FORM EDITOR (7 COLS) */}
                <div className="lg:col-span-7 space-y-3 bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Usaha / Header Struk
                    </label>
                    <input
                      aria-label="pengaturan receipt header name"
                      name="receiptHeaderName"
                      id="pengaturan-receipt-header-name"
                      type="text"
                      value={receiptHeaderName}
                      onChange={(e) => setReceiptHeaderName(e.target.value)}
                      placeholder="Contoh: GOR CHUA SPORT CORE"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Alamat Usaha / GOR
                    </label>
                    <input
                      aria-label="pengaturan receipt address"
                      name="receiptAddress"
                      id="pengaturan-receipt-address"
                      type="text"
                      value={receiptAddress}
                      onChange={(e) => setReceiptAddress(e.target.value)}
                      placeholder="Contoh: Jl. Raya Olahraga No. 88, Jakarta"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Kontak Telepon / WhatsApp
                    </label>
                    <input
                      aria-label="pengaturan receipt contact"
                      name="receiptContact"
                      id="pengaturan-receipt-contact"
                      type="text"
                      value={receiptContact}
                      onChange={(e) => setReceiptContact(e.target.value)}
                      placeholder="Contoh: Telp/WA: 0812-3456-7890"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pesan Catatan Kaki (Footer Struk)
                    </label>
                    <textarea
                      aria-label="pengaturan receipt footer note"
                      name="receiptFooterNote"
                      id="pengaturan-receipt-footer-note"
                      rows={2}
                      value={receiptFooterNote}
                      onChange={(e) => setReceiptFooterNote(e.target.value)}
                      placeholder="Contoh: Terima kasih atas kunjungan Anda. Selamat berolahraga!"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* RIGHT: AUTHENTIC THERMAL PREVIEW (5 COLS) */}
                <div className="lg:col-span-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      Pratinjau Struk Kasir
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Thermal 80mm</span>
                  </div>

                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs font-mono text-xs text-slate-800 dark:text-slate-200 space-y-2 relative select-none">
                    {/* Header */}
                    <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-2">
                      <p className="font-bold text-xs uppercase text-slate-900 dark:text-slate-100 leading-tight">
                        {receiptHeaderName || 'NAMA GOR / TENANT'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        {receiptAddress || 'Alamat Belum Diatur'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        {receiptContact || 'Telp: 08xx-xxxx-xxxx'}
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5 py-1">
                      <div className="flex justify-between">
                        <span>No. Nota:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">#INV-2026-001</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tanggal:</span>
                        <span>{new Date().toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kasir:</span>
                        <span>Kasir Utama</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700" />

                    {/* Items */}
                    <div className="space-y-1 text-[10px] py-1">
                      <div className="flex justify-between font-semibold">
                        <span>Sewa Lapangan 1 (2 Jam)</span>
                        <span>Rp 100.000</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Air Mineral 600ml (2x)</span>
                        <span>Rp 10.000</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700" />

                    {/* Total & Payment */}
                    <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-slate-100 py-1">
                      <span>TOTAL:</span>
                      <span>Rp 110.000</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Metode:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">QRIS Statis</span>
                    </div>

                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700" />

                    {/* Footer Note */}
                    <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 pt-1 leading-tight">
                      {receiptFooterNote || 'Terima kasih atas kunjungan Anda!'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEKSI 3: KONFIGURASI PERANGKAT PRINTER WORKSTATION LOKAL */}
            <PrinterSettingsPanel
              userProfile={userProfile}
              tenantProfile={tenant}
              liveReceiptIdentity={{
                receiptHeaderName,
                receiptAddress,
                receiptContact,
                receiptFooterNote
              }}
            />
          </div>
        )}

      </form>

      {/* TAB 4: TARIF LAPANGAN */}
      {activeTab === 'tarif' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-3.5 text-left animate-fadeIn mt-3.5">
          
          {/* HEADER & MAIN SAVE ACTION */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-3">
            <div>
              <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Pengaturan Tarif Lapangan (Rp / Jam)</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Atur tarif sewa reguler per jam untuk masing-masing lapangan secara individual atau massal per cabang olahraga.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {unsavedCourts.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[10px] font-bold rounded-md border border-amber-200/80 dark:border-amber-800/60 animate-pulse">
                  {unsavedCourts.length} Belum Disimpan
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveAllCourtPrices}
                disabled={savingAllPrices || isLoading}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                {savingAllPrices ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Semua Tarif {unsavedCourts.length > 0 ? `(${unsavedCourts.length})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {courtSuccessMsg && (
            <div className="p-2.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 text-green-800 dark:text-green-300 text-xs rounded-xl font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
              <span>{courtSuccessMsg}</span>
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-slate-500 py-3">Memuat daftar lapangan...</p>
          ) : courts.length === 0 ? (
            <div className="py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center p-4 flex flex-col items-center">
              <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-1.5" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Belum ada lapangan terdaftar. Lengkapi fasilitas di onboarding.</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* BULK APPLY SECTION PER CABANG OLAHRAGA */}
              <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Atur Cepat per Cabang Olahraga (Bulk Apply)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Ketik nominal lalu terapkan ke seluruh lapangan pada cabor pilihan
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-0.5">
                  {Object.entries(courtsBySport).map(([sportKey, sportCourts]) => {
                    const currentBulkInput = bulkPrices[sportKey] || '';
                    return (
                      <div key={sportKey} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase flex items-center space-x-1">
                            <Dumbbell className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>{sportKey}</span>
                          </span>
                          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[9px] font-bold rounded border border-blue-100 dark:border-blue-900/40">
                            {sportCourts.length} Lapangan
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="relative">
                            <span className="text-[11px] font-bold text-slate-400 absolute left-2.5 top-1.5">Rp</span>
                            <input
  aria-label="e.g. 150.000"
  name="currentBulkInput"
  id="pengaturan-current-bulk-input"
                              type="text"
                              placeholder="e.g. 150.000"
                              value={currentBulkInput}
                              onChange={(e) => handleBulkPriceInputChange(sportKey, e.target.value)}
                              className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 font-bold font-mono"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyBulkPrice(sportKey)}
                            disabled={!currentBulkInput}
                            className="w-full py-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[10px] font-bold rounded-md transition-colors cursor-pointer disabled:opacity-40"
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Daftar Lapangan &amp; Input Tarif Individual
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Total: {courts.length} Lapangan</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  {courts.map((court) => {
                    const currentPriceInput = courtPrices[court.id] !== undefined ? courtPrices[court.id] : formatNumberWithDots(court.price || 0);
                    const parsedInputVal = parseNumberFromDots(currentPriceInput);
                    const isChanged = parsedInputVal !== Number(court.price || 0);

                    return (
                      <div key={court.id} className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${isChanged ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'}`}>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">{court.name}</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[9px] rounded uppercase">
                              {court.sport || 'Sports'}
                            </span>
                            {isChanged && (
                              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-extrabold text-[9px] rounded uppercase border border-amber-200 dark:border-amber-800">
                                Ada Perubahan
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Tarif Tersimpan: <span className="font-semibold text-slate-600 dark:text-slate-300 font-mono">Rp {Number(court.price || 0).toLocaleString('id-ID')}/jam</span>
                          </p>
                        </div>

                        <div className="flex items-center space-x-2.5">
                          <div className="flex flex-col items-start sm:items-end">
                            <div className="relative">
                              <span className="text-[11px] font-bold text-slate-400 absolute left-2.5 top-1.5">Rp</span>
                              <input
  aria-label="pengaturan current price input"
  name="currentPriceInput"
  id="pengaturan-current-price-input"
                                type="text"
                                value={currentPriceInput}
                                onChange={(e) => handlePriceInputChange(court.id, e.target.value)}
                                className={`w-36 pl-7 pr-2.5 py-1 text-xs border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none font-extrabold font-mono text-slate-900 dark:text-slate-100 ${isChanged ? 'bg-white dark:bg-slate-900 border-amber-300 ring-1 ring-amber-200' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus:border-blue-500'}`}
                              />
                            </div>
                            <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
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
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAllCourtPrices}
                  disabled={savingAllPrices || isLoading}
                  className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {savingAllPrices ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Menyimpan Semua Tarif...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
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
        <form onSubmit={handleUpdateTenant} className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-3.5 text-left animate-fadeIn mt-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2.5">
            <div>
              <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Master Data: Tarif Akademi per Cabang Olahraga</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Atur tarif SPP bulanan dan biaya pendaftaran (uang pangkal). Data ini ditarik otomatis pada form siswa baru.
              </p>
            </div>
            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded border border-blue-100 dark:border-blue-900/40 shrink-0 font-mono">
              Total: {Object.keys(academyPricing || {}).length} Cabang
            </span>
          </div>

          {/* LIST PRICING PER CABANG OLAHRAGA */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {Object.entries(academyPricing || {}).map(([sport, pricing]) => (
                <div key={sport} className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-2 relative group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Dumbbell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{sport}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSportPricing(sport)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors cursor-pointer"
                      title="Hapus Cabang"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        SPP Bulanan (Rp)
                      </label>
                      <div className="relative">
                        <span className="text-[11px] font-bold text-slate-400 absolute left-2 top-1.5">Rp</span>
                        <input
  aria-label="pengaturan pricing spp0"
  name="pricing_spp0"
  id="pengaturan-pricing-spp0"
                          type="number"
                          min="0"
                          step="any"
                          value={pricing.spp ?? 0}
                          onChange={(e) => handleAcademyPricingChange(sport, 'spp', e.target.value)}
                          className="w-full pl-7 pr-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-500 font-bold font-mono text-blue-700 dark:text-blue-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Pendaftaran / Pangkal (Rp)
                      </label>
                      <div className="relative">
                        <span className="text-[11px] font-bold text-slate-400 absolute left-2 top-1.5">Rp</span>
                        <input
  aria-label="pengaturan pricing registration0"
  name="pricing_registration0"
  id="pengaturan-pricing-registration0"
                          type="number"
                          min="0"
                          step="any"
                          value={pricing.registration ?? 0}
                          onChange={(e) => handleAcademyPricingChange(sport, 'registration', e.target.value)}
                          className="w-full pl-7 pr-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-500 font-bold font-mono text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TAMBAH CABANG OLAHRAGA BARU */}
          <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-2">
            <h3 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Master Tarif Cabang Baru</span>
            </h3>

            <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Nama Cabang</label>
                <select
  aria-label="pengaturan new sport name"
  name="newSportName"
  id="pengaturan-new-sport-name"
                  value={newSportName}
                  onChange={(e) => setNewSportName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="" disabled>-- Pilih Cabang --</option>
                  {SUPPORTED_SPORTS.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">SPP Bulanan (Rp)</label>
                <input
  aria-label="e.g. 300000"
  name="newSportSpp"
  id="pengaturan-new-sport-spp"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 300000"
                  value={newSportSpp}
                  onChange={(e) => setNewSportSpp(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-bold font-mono text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Pendaftaran (Rp)</label>
                <input
  aria-label="e.g. 150000"
  name="newSportReg"
  id="pengaturan-new-sport-reg"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 150000"
                  value={newSportReg}
                  onChange={(e) => setNewSportReg(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-bold font-mono text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleAddSportPricing}
                  className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-1.5 flex justify-end">
            <button
              type="submit"
              disabled={savingTenant}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
            >
              {savingTenant ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Master Data Tarif</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 6: KELOLA STAF & PELATIH (CLIENT-SIDE RBAC) */}
      {activeTab === 'staf' && (
        <div className="space-y-3.5 text-left animate-fadeIn mt-3.5">
          
          {/* CARD AUDIT & CONTROLLED BACKFILL KK HMAC */}
          {(userProfile?.role === 'owner' || userProfile?.role === 'admin') && (
            <TenantBackfillControlCard
              tenantId={tenant?.id || userProfile?.tenantId || null}
              tenantName={tenant?.name || 'Tenant Admin'}
              userRole={userProfile?.role || 'owner'}
            />
          )}

          {/* CARD 1: FORM TERBITKAN UNDANGAN STAFF (NO PASSWORD FIELD) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2.5">
              <div>
                <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Terbitkan Undangan Staff Baru (Owner Portal)</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Menerbitkan token undangan berbasis database RPC tepercaya. Penerima undangan akan mengatur kata sandinya sendiri saat mengklaim akun.
                </p>
              </div>
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[9px] font-bold rounded border border-blue-100 dark:border-blue-900/40 shrink-0">
                PostgreSQL RPC
              </span>
            </div>

            {staffSuccessMsg && (
              <div className="p-2.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 text-green-800 dark:text-green-300 text-xs rounded-xl font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span>{staffSuccessMsg}</span>
              </div>
            )}

            {staffErrorMsg && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{staffErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRegisterStaff} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="settings-staff-name" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Nama Lengkap Staf / Pelatih <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="settings-staff-name"
                    name="newStaffName"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="e.g. Coach Agus or Budi Admin"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="settings-staff-email" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Alamat Email Staf <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="settings-staff-email"
                    name="newStaffEmail"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="staf@chuasport.com"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 font-medium font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="settings-staff-role" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Role / Hak Akses RBAC <span className="text-red-500">*</span>
                </label>
                <select
                  id="settings-staff-role"
                  name="newStaffRole"
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-blue-500 font-bold cursor-pointer"
                >
                  <option value="admin">1. admin (Booking, POS, Akademi, Event &amp; Keuangan)</option>
                  <option value="kasir">2. kasir (POS &amp; Transaksi Lapangan)</option>
                  <option value="pelatih">3. pelatih (HANYA Modul Akademi)</option>
                  <option value="staff">4. staff (Akses Operasional Lapangan)</option>
                </select>
              </div>

              <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg text-[10px] text-blue-800 dark:text-blue-300 leading-relaxed flex items-start space-x-2">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Alur Pendaftaran Murni Undangan:</strong> Owner menerbitkan tautan undangan aman &rarr; staf membuka tautan &rarr; staf mendaftar/masuk dengan kata sandinya sendiri &rarr; mengklaim akun. Kata sandi tidak ditentukan oleh Owner.
                </span>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={registeringStaff}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
                >
                  {registeringStaff ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Menerbitkan Undangan...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Terbitkan Undangan Staff</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* CARD 2: DAFTAR UNDANGAN STAFF PENDING & TAUTAN UNDANGAN */}
          {pendingInvitations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 shadow-2xs border border-amber-200/80 dark:border-amber-900/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2.5">
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Daftar Undangan Staff ({pendingInvitations.length})</span>
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Menunggu staf mengklaim akun
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden text-xs">
                {pendingInvitations.map((inv) => {
                  const sessionUrl = sessionInviteLinks[inv.id] || sessionInviteLinks[inv.email];
                  const isPending = inv.status === 'pending';

                  return (
                    <div key={inv.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{inv.email}</span>
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[9px] rounded uppercase border border-blue-200 dark:border-blue-900/40">
                            {inv.role}
                          </span>
                          {inv.status === 'pending' && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[9px] rounded">
                              Pending
                            </span>
                          )}
                          {inv.status === 'accepted' && (
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] rounded">
                              Accepted
                            </span>
                          )}
                          {inv.status === 'expired' && (
                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[9px] rounded">
                              Kedaluwarsa
                            </span>
                          )}
                          {inv.status === 'revoked' && (
                            <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold text-[9px] rounded">
                              Dibatalkan
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Dibuat: {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('id-ID') : '-'} • Masa Berlaku: {formatInvitationExpiry(inv.expiresAt, inv.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 self-end sm:self-center">
                        {sessionUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(sessionUrl);
                              setCopiedTableLinkId(inv.id);
                              setTimeout(() => setCopiedTableLinkId(null), 2500);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 rounded-md text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                          >
                            {copiedTableLinkId === inv.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Salin Tautan</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span 
                            className="text-[10px] text-slate-400 italic cursor-help"
                            title="Tautan hanya tersedia saat undangan pertama kali dibuat. Buat undangan baru jika tautan hilang."
                          >
                            Tautan hanya di memori awal
                          </span>
                        )}

                        {isPending && (
                          <button
                            type="button"
                            onClick={() => setRevokeConfirmModal({ id: inv.id, email: inv.email })}
                            disabled={revokingId === inv.id}
                            className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 rounded-md text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Batalkan</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CARD 3: DAFTAR STAF TERDAFTAR IN USERS_STAFF */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2.5">
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Daftar Staf &amp; Pelatih Terdaftar</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-400 font-mono">
                Total: {staffList.length} Akun
              </span>
            </div>

            {loadingStaff ? (
              <p className="text-xs text-slate-500 py-3">Memuat daftar staf...</p>
            ) : staffList.length === 0 ? (
              <div className="py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center p-4 flex flex-col items-center">
                <Users className="w-7 h-7 text-slate-300 dark:text-slate-700 mb-1.5" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Belum ada staf atau pelatih terdaftar.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Gunakan formulir di atas untuk menerbitkan undangan baru.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
                {staffList.map((staf) => (
                  <div key={staf.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">{staf.name}</span>
                        <span className={`px-2 py-0.5 font-bold text-[9px] rounded uppercase ${
                          staf.role === 'admin' 
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40' 
                            : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40'
                        }`}>
                          {staf.role === 'admin' ? 'Admin Staf' : 'Pelatih Akademi'}
                        </span>

                        {staf.isBound ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 font-bold text-[9px] rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Terikat Auth UID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 font-bold text-[9px] rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Menunggu Klaim
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">{staf.email}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                        UID: {staf.uid || staf.id} • Terdaftar: {staf.createdAt ? new Date(staf.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(staf.id, staf.email)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-md text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Hapus Akses Staf"
                      >
                        <Trash2 className="w-3 h-3" />
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

      {/* PERSISTENT SUCCESS MODAL (DIALOG KONFIRMASI UNDANGAN BERHASIL) */}
      {inviteSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left relative">
            <button
              type="button"
              onClick={() => setInviteSuccessModal(null)}
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
                  Undangan Staff Berhasil Dibuat
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Token undangan resmi telah dibuat di database PostgreSQL Supabase RLS.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Email Penerima:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{inviteSuccessModal.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Role yang Diberikan:</span>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold rounded uppercase text-[10px]">
                  {inviteSuccessModal.role}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Nama Tenant / GOR:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{inviteSuccessModal.tenantName}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Masa Berlaku:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatInvitationExpiry(inviteSuccessModal.expiresAt, inviteSuccessModal.createdAt)}
                  </span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="pengaturan-modal-invite-url" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                URL Undangan Lengkap
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="pengaturan-modal-invite-url"
                  name="modalInviteUrl"
                  type="text"
                  readOnly
                  value={inviteSuccessModal.inviteUrl}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (inviteSuccessModal.inviteUrl) {
                      navigator.clipboard.writeText(inviteSuccessModal.inviteUrl);
                      setCopiedModalLink(true);
                      setTimeout(() => setCopiedModalLink(false), 2500);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  {copiedModalLink ? (
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
                <strong>Penting:</strong> Salin dan bagikan tautan ini ke penerima. Tautan ini tetap tersedia selama dialog ini terbuka. Setelah dialog ditutup dan halaman di-refresh, tautan tidak dapat dimunculkan kembali demi alasan keamanan token.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInviteSuccessModal(null)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REVOKE CONFIRMATION */}
      {revokeConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left relative">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Batalkan Undangan Staff?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin membatalkan undangan untuk <strong className="text-slate-900 dark:text-slate-100 font-mono">{revokeConfirmModal.email}</strong>? Tautan yang pernah diterbitkan tidak akan bisa digunakan lagi untuk mengklaim akun staf.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokeConfirmModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeRevokeInvitation(revokeConfirmModal.id, revokeConfirmModal.email)}
                disabled={revokingId === revokeConfirmModal.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {revokingId === revokeConfirmModal.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ya, Batalkan Undangan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Canonical Tenant ID Resolver for Pengaturan & Court Pricing
 * Strictly follows tenant hierarchy: profile.tenant.id, profile.tenantId, profile.tenant.tenant_id.
 * NEVER falls back to userProfile.id or userProfile.uid (User ID is NOT a Tenant ID).
 */
export const resolveTenantId = (profile) => {
  if (!profile) return null;
  return profile.tenant?.id || profile.tenantId || profile.tenant?.tenant_id || null;
};

/**
 * PengaturanPage (Viewport & Tab Wrapper)
 * Adheres strictly to React Rules of Hooks.
 * Unconditionally calls useMobileViewport(767) and useSearchParams() at top level.
 * - Mobile (<=767px) + tab=profil     -> MobileTenantProfileMain
 * - Mobile (<=767px) + tab=pembayaran -> MobilePaymentSettingsMain
 * - Mobile (<=767px) + tab=tarif      -> MobileCourtPricingMain
 * - Other tabs & Desktop (>=768px)    -> PengaturanDesktopMain
 */
export default function PengaturanPage({ userProfile, onTenantUpdated = () => {} }) {
  const isMobile = useMobileViewport(767);
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'profil';

  if (isMobile && currentTab === 'profil') {
    return (
      <MobileTenantProfileMain
        userProfile={userProfile}
        onTenantUpdated={onTenantUpdated}
      />
    );
  }

  if (isMobile && currentTab === 'pembayaran') {
    return (
      <MobilePaymentSettingsMain
        userProfile={userProfile}
        onTenantUpdated={onTenantUpdated}
      />
    );
  }

  if (isMobile && currentTab === 'tarif') {
    return <MobileCourtPricingMain userProfile={userProfile} />;
  }

  return (
    <PengaturanDesktopMain 
      userProfile={userProfile} 
      onTenantUpdated={onTenantUpdated} 
    />
  );
}



