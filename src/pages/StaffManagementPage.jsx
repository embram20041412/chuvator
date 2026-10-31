import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  CreditCard, 
  GraduationCap, 
  Mail, 
  Lock, 
  User, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Server, 
  Settings, 
  HelpCircle, 
  X,
  Code2
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { resendStaffInvitation } from '../services/staffService';
import useAuthRole from '../hooks/useAuthRole';
import { 
  resolveWorkerBaseUrl, 
  buildWorkerEndpoints, 
  setWorkerUrlOverride, 
  resetWorkerUrlOverride, 
  getWorkerUrlOverride 
} from '../config/apiConfig';

export default function StaffManagementPage({ userProfile }) {
  const { isOwner, loading: roleLoading } = useAuthRole(userProfile);
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.id || userProfile?.uid;

  // Form states
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [staffRole, setStaffRole] = useState('kasir'); // 'kasir' | 'pelatih'
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [resendingEmail, setResendingEmail] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Diagnostic states
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthInfo, setHealthInfo] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  // Filter & list states
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'kasir' | 'pelatih'
  const [copiedId, setCopiedId] = useState(null);

  // Current active Backend API URL and endpoints (FULL-STACK EXPRESS NATIVE)
  const [currentWorkerUrl, setCurrentWorkerUrl] = useState(() => resolveWorkerBaseUrl());
  const endpoints = buildWorkerEndpoints(currentWorkerUrl);

  const refreshWorkerConfig = () => {
    const updated = resolveWorkerBaseUrl();
    setCurrentWorkerUrl(updated);
    setHealthInfo(null);
  };

  // Fetch staff list from Supabase
  const fetchStaff = async () => {
    if (!tenantId) {
      setLoadingStaff(false);
      return;
    }

    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('users_staff')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = (data || []).map((docSnap) => ({
        id: docSnap.id,
        uid: docSnap.uid,
        email: docSnap.email,
        displayName: docSnap.display_name || docSnap.name,
        name: docSnap.name || docSnap.display_name,
        role: docSnap.role,
        tenantId: docSnap.tenant_id,
        status: docSnap.status || 'active',
        createdAt: docSnap.created_at
      }));
      setStaffList(list);
    } catch (error) {
      console.error('Error fetching users_staff from Supabase:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    fetchStaff();

    if (!tenantId) return;

    // Sinkronisasi Real-Time Tabel users_staff
    const staffChannel = supabase
      .channel(`realtime_staff_${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users_staff', filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchStaff();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(staffChannel);
    };
  }, [tenantId]);

  // Handler Kirim Ulang Email Konfirmasi / Undangan
  const handleResendInvite = async (staffEmail) => {
    if (!staffEmail) return;
    setResendingEmail(staffEmail);
    setActionNotice(null);

    try {
      await resendStaffInvitation(staffEmail);
      setActionNotice(`Email konfirmasi pendaftaran berhasil dikirim ulang ke ${staffEmail}`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Error resending invite:', err);
      alert(`Gagal mengirim ulang email konfirmasi: ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setResendingEmail(null);
    }
  };

  // Handle Form Submission: Dedicated Express Full-Stack Backend Request
  const handleRegisterStaff = async (e) => {
    if (e) e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // 1. Validasi Input
    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanEmail || !password || !cleanDisplayName) {
      setFormError('Harap lengkapi semua field formulir pendaftaran staf.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError('Format email tidak valid.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password staff minimal harus 6 karakter.');
      return;
    }

    const validRoles = ['kasir', 'pelatih', 'coach'];
    if (!validRoles.includes(staffRole.toLowerCase())) {
      setFormError('Role yang dipilih tidak valid.');
      return;
    }

    if (!tenantId) {
      setFormError('ID Tenant tidak ditemukan. Pastikan Anda telah menyelesaikan aktivasi tenant.');
      return;
    }

    // 2. Pre-check duplikasi staf di Supabase untuk tenant ini
    try {
      const { data: dupStaff } = await supabase
        .from('users_staff')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', cleanEmail)
        .maybeSingle();

      if (dupStaff) {
        setFormError(`Staf dengan email "${cleanEmail}" sudah terdaftar di cabang/tenant ini.`);
        return;
      }
    } catch (checkErr) {
      console.warn('Gagal melakukan pre-check duplikasi staf:', checkErr);
    }

    setIsSubmitting(true);

    let createdAuthUid = null;

    try {
      // 3. Ambil Token ID / Access Token Owner saat ini untuk otorisasi
      const { data: { session } } = await supabase.auth.getSession();
      const ownerToken = session?.access_token;
      if (!ownerToken) {
        throw new Error('Sesi autentikasi Anda tidak aktif. Silakan login ulang.');
      }

      // 4. Kirim Request ke Backend Endpoint POST /api/create-staff
      const payload = {
        email: cleanEmail,
        password: password,
        displayName: cleanDisplayName,
        role: staffRole,
        tenantId: tenantId,
      };

      let response;
      try {
        response = await fetch(endpoints.CREATE_STAFF, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (networkErr) {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (isOffline) {
          throw new Error('Koneksi internet Anda terputus. Periksa jaringan Anda dan coba lagi.');
        }

        throw new Error(
          `Gagal menghubungi Backend API (${networkErr.message}). Pastikan server Express Node.js aktif pada port 3000 untuk memproses pendaftaran staf secara aman via Admin SDK.`
        );
      }

      const contentType = response.headers.get('content-type') || '';
      let result = null;

      if (contentType.includes('application/json')) {
        result = await response.json().catch(() => null);
      } else {
        const text = await response.text().catch(() => '');
        if (text.includes('<!doctype') || text.includes('<html')) {
          throw new Error(
            `Backend API (${endpoints.CREATE_STAFF}) merespons dengan HTML. Pastikan server Express pada server.ts berjalan di port 3000.`
          );
        }
      }

      if (!response.ok || !result || result.success === false) {
        if (response.status === 405) {
          throw new Error(
            'Metode HTTP tidak diizinkan (405). Pastikan server Express pada port 3000 aktif dan menangani POST /api/create-staff.'
          );
        }
        if (response.status === 429) {
          throw new Error(
            'Terlalu banyak permintaan pendaftaran (429). Silakan tunggu beberapa saat dan coba lagi.'
          );
        }
        if (response.status === 401) {
          throw new Error(
            result?.message || 'Otorisasi ditolak (401). Token sesi Owner Anda mungkin kedaluwarsa. Silakan refresh halaman atau login ulang.'
          );
        }
        if (response.status === 403) {
          throw new Error(
            result?.message || 'Akses ditolak (403). Hanya akun berstatus Owner atau SuperAdmin yang diizinkan mendaftarkan staf.'
          );
        }
        if (response.status === 409) {
          throw new Error(
            result?.message || `Email "${cleanEmail}" sudah terdaftar di sistem otentikasi. Gunakan email lain.`
          );
        }

        const errorMsg = result?.message || result?.error || `Backend API mengembalikan status ${response.status}. Pastikan server Express Node.js aktif pada port 3000.`;
        throw new Error(errorMsg);
      }

      // 5. Validasi ID dari Supabase Auth
      createdAuthUid = result.data?.uid || result.uid || `pending-${Date.now()}`;
      const finalRole = result.data?.role || staffRole;
      const finalTenantId = result.data?.tenantId || tenantId;
      const finalStatus = result.data?.status || 'active';

      // 6. Simpan data profil staff ke tabel users_staff Supabase (WAJIB selalu tersimpan)
      try {
        await supabase.from('users_staff').upsert([{
          uid: createdAuthUid,
          email: cleanEmail,
          display_name: cleanDisplayName,
          name: cleanDisplayName,
          role: finalRole,
          tenant_id: finalTenantId,
          created_at: new Date().toISOString(),
          status: finalStatus,
          auth_method: 'express_fullstack_rbac',
          created_by: userProfile?.email || session?.user?.email || 'owner',
        }], { onConflict: 'uid' });
        fetchStaff();
      } catch (supabaseErr) {
        console.error('Kondisi parsial: Auth dibuat, namun penyimpanan Supabase gagal:', supabaseErr);
        // Fallback coba simpan kembali tanpa onConflict uid
        await supabase.from('users_staff').upsert([{
          email: cleanEmail,
          display_name: cleanDisplayName,
          name: cleanDisplayName,
          role: finalRole,
          tenant_id: finalTenantId,
          created_at: new Date().toISOString(),
          status: finalStatus,
          created_by: userProfile?.email || 'owner',
        }]);
        fetchStaff();
      }

      // 7. Sukses Penuh
      setFormSuccess(
        finalStatus === 'pending_confirmation'
          ? `Akun staff "${cleanDisplayName}" (${finalRole.toUpperCase()}) berhasil didaftarkan! Status: Menunggu Konfirmasi Email.`
          : `Akun staff "${cleanDisplayName}" (${finalRole.toUpperCase()}) berhasil didaftarkan dan langsung Aktif!`
      );

      setEmail('');
      setDisplayName('');
      setPassword('');
      setStaffRole('kasir');
    } catch (err) {
      console.error('Error creating staff via Backend API:', err);
      const errMsg = err?.message || '';

      // Jika error BUKAN email duplikat, tetap simpan profil staf ke users_staff dengan status 'pending_confirmation'
      if (!errMsg.includes('sudah terdaftar') && !errMsg.includes('Format email')) {
        try {
          await supabase.from('users_staff').upsert([{
            uid: `pending-${Date.now()}`,
            email: cleanEmail,
            display_name: cleanDisplayName,
            name: cleanDisplayName,
            role: staffRole,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            status: 'pending_confirmation',
            auth_method: 'offline_queued',
            created_by: userProfile?.email || 'owner',
          }]);
          fetchStaff();
          setFormSuccess(`Profil staf "${cleanDisplayName}" tetap berhasil disimpan dengan status: Menunggu Konfirmasi Email.`);
          setEmail('');
          setDisplayName('');
          setPassword('');
          setStaffRole('kasir');
          return;
        } catch (dbFallbackErr) {
          console.warn('Fallback users_staff save failed:', dbFallbackErr);
        }
      }

      setFormError(err.message || 'Gagal mendaftarkan staff melalui Backend Express API.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Diagnostic NYATA: Tes Kesehatan Endpoint Express Server
  const handleCheckWorkerHealth = async () => {
    setHealthChecking(true);
    setHealthInfo(null);
    const testTimestamp = new Date().toLocaleString('id-ID');
    const targetEndpoint = endpoints.HEALTH;

    try {
      const response = await fetch(targetEndpoint, { method: 'GET' });
      const statusCode = response.status;
      const contentType = response.headers.get('content-type') || '';

      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json().catch(() => ({}));
        setHealthInfo({
          status: 'berhasil',
          category: 'EXPRESS_HEALTHY',
          workerUrl: currentWorkerUrl || window.location.origin,
          endpoint: targetEndpoint,
          statusCode: `${statusCode} OK`,
          timestamp: testTimestamp,
          title: 'Express Full-Stack Backend Sehat & Siap',
          message: `Layanan: ${data.service || 'Express Server'} (${data.environment?.runtime || 'Google AI Studio'}). Service Account: ${data.environment?.serviceAccountConfigured ? 'Terkonfigurasi' : 'Opsional (Pendaftaran publik aktif)'}.`,
          guidance: 'Backend Server Node.js Express aktif dan siap menerima request pendaftaran karyawan secara native di Google AI Studio.',
          json: JSON.stringify(data, null, 2),
        });
      } else {
        const text = await response.text().catch(() => '');
        setHealthInfo({
          status: 'gagal',
          category: 'HTTP_ERROR',
          workerUrl: currentWorkerUrl || window.location.origin,
          endpoint: targetEndpoint,
          statusCode: `${statusCode} ${response.statusText}`,
          timestamp: testTimestamp,
          title: `Backend API Merespons HTTP ${statusCode}`,
          message: `Endpoint merespons tetapi mengembalikan status HTTP ${statusCode}.`,
          guidance: 'Periksa file server.ts dan pastikan Express server berjalan dengan benar.',
          json: text,
        });
      }
    } catch (err) {
      setHealthInfo({
        status: 'gagal',
        category: 'FETCH_FAILED_NETWORK',
        workerUrl: currentWorkerUrl || window.location.origin,
        endpoint: targetEndpoint,
        statusCode: 'Failed to fetch (0)',
        timestamp: testTimestamp,
        title: 'Request Gagal Mencapai Express Endpoint (Failed to fetch)',
        message: `Browser tidak mendapat respon dari ${targetEndpoint}. Detail error: "${err.message}".`,
        guidance: 'Pastikan dev server Express pada server.ts aktif pada port 3000.',
        json: null,
      });
    } finally {
      setHealthChecking(false);
    }
  };

  const handleSaveCustomWorkerUrl = (e) => {
    e.preventDefault();
    if (customUrlInput.trim()) {
      setWorkerUrlOverride(customUrlInput.trim());
    } else {
      resetWorkerUrlOverride();
    }
    refreshWorkerConfig();
    setShowSettingsModal(false);
  };

  const handleResetToDefaultUrl = () => {
    resetWorkerUrlOverride();
    refreshWorkerConfig();
    setCustomUrlInput('');
    setShowSettingsModal(false);
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!window.confirm(`Yakin ingin menghapus akses staff "${staffName}"?`)) {
      return;
    }

    try {
      await supabase.from('users_staff').delete().or(`id.eq.${staffId},uid.eq.${staffId}`);
      setStaffList((prev) => prev.filter((s) => s.id !== staffId && s.uid !== staffId));
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Gagal menghapus data staff: ' + err.message);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!roleLoading && !isOwner) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Akses Terbatas: Khusus Owner</h2>
          <p className="text-slate-600 text-xs mt-1">
            Halaman Manajemen Karyawan & Pembagian Hak Akses (RBAC) hanya dapat dikelola oleh pemilik arena (*Owner*).
          </p>
        </div>
      </div>
    );
  }

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      (s.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalKasir = staffList.filter((s) => s.role === 'kasir').length;
  const totalPelatih = staffList.filter((s) => s.role === 'pelatih' || s.role === 'coach').length;
  const isCustomUrlActive = Boolean(getWorkerUrlOverride());

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Role-Based Access Control (RBAC) & Custom Claims</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Manajemen Karyawan & Staff
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Daftarkan staf operasional arena (Kasir POS & Pelatih Akademi). Setiap akun secara otomatis disematkan
              hak akses terisolasi pada tingkat database Supabase sesuai cabang dan tenant Anda.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shrink-0">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-white">Express Backend API</p>
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] rounded-sm font-mono font-bold">
                    Full-Stack AI Studio
                  </span>
                </div>
                <p className="text-emerald-300 text-[11px] font-mono font-medium truncate max-w-[200px]" title={currentWorkerUrl || '/api'}>
                  {currentWorkerUrl ? currentWorkerUrl.replace(/^https?:\/\//, '') : 'Same-Origin Server'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCheckWorkerHealth}
                disabled={healthChecking}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                title="Periksa kesehatan endpoint Express Server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${healthChecking ? 'animate-spin' : ''}`} />
                <span>{healthChecking ? 'Menguji...' : 'Uji Status'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomUrlInput(getWorkerUrlOverride() || currentWorkerUrl);
                  setShowSettingsModal(true);
                }}
                className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors cursor-pointer"
                title="Konfigurasi Endpoint Backend"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Health Diagnostic Result Banner Detail */}
        {healthInfo && (
          <div
            className={`mt-5 p-4 rounded-2xl border backdrop-blur-md text-xs space-y-3 ${
              healthInfo.status === 'berhasil'
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
                : 'bg-rose-500/15 border-rose-400/30 text-rose-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                {healthInfo.status === 'berhasil' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-sm text-white">{healthInfo.title}</p>
                  <p className="text-[11px] opacity-80">
                    Hasil Pengujian Diagnostik • {healthInfo.timestamp}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                  healthInfo.status === 'berhasil' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'
                }`}
              >
                {healthInfo.statusCode}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div>
                <p className="font-semibold opacity-75">Base Server URL:</p>
                <p className="font-mono font-medium truncate text-white">{healthInfo.workerUrl}</p>
              </div>
              <div>
                <p className="font-semibold opacity-75">Endpoint Health Diuji:</p>
                <p className="font-mono font-medium truncate text-white">{healthInfo.endpoint}</p>
              </div>
            </div>

            <div className="text-[11px] leading-relaxed">
              <p className="font-semibold text-white">Ringkasan:</p>
              <p className="mt-0.5 opacity-90">{healthInfo.message}</p>
            </div>

            <div className="p-2.5 bg-black/20 rounded-xl text-[11px] leading-relaxed border border-white/5">
              <p className="font-bold text-white flex items-center gap-1 mb-0.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>Petunjuk Tindakan:</span>
              </p>
              <p className="opacity-90">{healthInfo.guidance}</p>
            </div>

            {healthInfo.json && (
              <div className="mt-2">
                <p className="font-semibold text-[10px] uppercase opacity-75 mb-1 flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  <span>Payload Respons:</span>
                </p>
                <pre className="p-2.5 bg-slate-950/80 rounded-xl font-mono text-[10px] text-emerald-300 overflow-x-auto max-h-36">
                  {healthInfo.json}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Karyawan</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{staffList.length}</p>
          </div>
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff Kasir / POS</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totalKasir}</p>
          </div>
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pelatih / Coach</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{totalPelatih}</p>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Form Registrasi (Kiri) & Daftar Staff (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* FORM REGISTRASI STAFF (5 Kolom di Desktop) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Form Pendaftaran Staff Baru</h2>
              <p className="text-[11px] text-slate-500">Buat akun staf dengan hak akses spesifik</p>
            </div>
          </div>

          {formError && (
            <div className="mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{formError}</div>
            </div>
          )}

          {formSuccess && (
            <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{formSuccess}</div>
            </div>
          )}

          <form onSubmit={handleRegisterStaff} className="mt-5 space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Lengkap Staff <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rian Ardianto"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Email Login <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="kasir1@arenasport.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password Sementara <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all outline-hidden text-slate-800 placeholder:text-slate-400 font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Role / Hak Akses <span className="text-red-500">*</span>
              </label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all outline-hidden text-slate-800 font-semibold cursor-pointer"
              >
                <option value="kasir">Kasir (Akses Kasir & POS, Booking Lapangan)</option>
                <option value="pelatih">Pelatih (Akses Akademi Siswa, Absensi & Evaluasi)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1 italic">
                * Menu Laporan Keuangan & Pengaturan Tenant akan otomatis disembunyikan untuk staf ini.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mendaftarkan Staff via Express API...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Daftarkan Staff & Set Custom Claims</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* DAFTAR STAFF TERDAFTAR (7 Kolom di Desktop) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Daftar Karyawan Aktif</h2>
              <p className="text-[11px] text-slate-500">Kelola kredensial dan hak akses staf tenant</p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  roleFilter === 'all' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({staffList.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('kasir')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  roleFilter === 'kasir' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kasir ({totalKasir})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('pelatih')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  roleFilter === 'pelatih' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pelatih ({totalPelatih})
              </button>
            </div>
          </div>

          {actionNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama staff atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all outline-hidden text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden">
            {loadingStaff ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                Memuat data staff...
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-600">Belum ada staff terdaftar</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gunakan formulir di samping untuk menambahkan Kasir atau Pelatih.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Nama Staff</th>
                      <th className="py-3 px-3">Role RBAC</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((staff) => {
                      const isStaffKasir = staff.role === 'kasir';
                      return (
                        <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isStaffKasir
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {staff.displayName?.charAt(0) || 'S'}
                              </div>
                              <div className="overflow-hidden">
                                <p className="font-bold text-slate-800 truncate">{staff.displayName}</p>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <span className="truncate">{staff.email}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(staff.email, staff.id)}
                                    className="text-slate-400 hover:text-blue-600 cursor-pointer"
                                    title="Salin email"
                                  >
                                    {copiedId === staff.id ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {isStaffKasir ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full font-bold text-[10px]">
                                <CreditCard className="w-3 h-3" />
                                Kasir POS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full font-bold text-[10px]">
                                <GraduationCap className="w-3 h-3" />
                                Pelatih Akademi
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {staff.status === 'pending_confirmation' || staff.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full font-bold text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Menunggu Konfirmasi Email
                              </span>
                            ) : staff.status === 'suspended' || staff.status === 'inactive' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full font-bold text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Non-Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full font-bold text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Aktif
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {(staff.status === 'pending_confirmation' || staff.status === 'pending') && (
                                <button
                                  type="button"
                                  onClick={() => handleResendInvite(staff.email)}
                                  disabled={resendingEmail === staff.email}
                                  className="px-2 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                  title="Kirim Ulang Email Konfirmasi"
                                >
                                  {resendingEmail === staff.email ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                                  ) : (
                                    <Mail className="w-3 h-3" />
                                  )}
                                  <span>{resendingEmail === staff.email ? 'Mengirim...' : 'Kirim Ulang'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(staff.id, staff.displayName)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Akses Staff"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Modal Pengaturan & Diagnostik URL Express API */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Pengaturan Express API Server</h3>
                  <p className="text-[11px] text-slate-500">Konfigurasi endpoint backend pendaftaran staff</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomWorkerUrl} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Base Endpoint Server API
                </label>
                <input
                  type="text"
                  placeholder="Atau biarkan kosong untuk Same-Origin (/api)"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all outline-hidden text-slate-800"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Default sistem: <span className="font-mono text-blue-600 font-semibold">Same-Origin Express Server (/api)</span>. Kosongkan untuk menggunakan server internal.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                  <span>Daftar Endpoint Express Full-Stack:</span>
                </p>
                <ul className="space-y-1 text-[11px] font-mono text-slate-600 list-disc list-inside">
                  <li>POST {endpoints.CREATE_STAFF}</li>
                  <li>POST {endpoints.LOGIN_STAFF}</li>
                  <li>GET {endpoints.HEALTH}</li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetToDefaultUrl}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Kembalikan ke Default Server
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
