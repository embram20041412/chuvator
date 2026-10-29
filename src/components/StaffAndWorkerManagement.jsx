import React, { useState, useEffect } from 'react';
import { 
  Server, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Terminal, 
  Copy, 
  ShieldCheck, 
  Key, 
  RefreshCw, 
  Send,
  AlertTriangle,
  Info
} from 'lucide-react';
import { checkWorkerHealth, createStaffMember, WORKER_BASE_URL } from '../services/staffService';

export default function StaffAndWorkerManagement({ userProfile }) {
  const tenantId = userProfile?.tenantId || userProfile?.tenant?.id || 'demo-tenant-id';

  // Worker Health State
  const [workerUrl, setWorkerUrl] = useState(WORKER_BASE_URL);
  const [healthStatus, setHealthStatus] = useState(null); // null, 'loading', 'success', 'error'
  const [healthResult, setHealthResult] = useState(null);

  // Staff Registration Form State
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('kasir');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regResult, setRegResult] = useState(null); // { type: 'success' | 'error', message: string, details?: any }

  // Copy notification
  const [copiedCmd, setCopiedCmd] = useState('');

  const handleTestHealth = async () => {
    setHealthStatus('loading');
    setHealthResult(null);

    const res = await checkWorkerHealth(workerUrl);
    if (res.ok) {
      setHealthStatus('success');
      setHealthResult(res.data);
    } else {
      setHealthStatus('error');
      setHealthResult(res);
    }
  };

  useEffect(() => {
    handleTestHealth();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!staffEmail || !staffPassword) return;

    setIsSubmitting(true);
    setRegResult(null);

    try {
      const res = await createStaffMember({
        email: staffEmail,
        password: staffPassword,
        displayName: staffName,
        role: staffRole,
        tenantId: tenantId
      }, workerUrl);

      setRegResult({
        type: 'success',
        message: `Staf ${res.user?.email || staffEmail} berhasil didaftarkan! UID: ${res.uid}`,
        details: res
      });

      setStaffEmail('');
      setStaffPassword('');
      setStaffName('');
    } catch (err) {
      console.error('Registration failed:', err);
      setRegResult({
        type: 'error',
        message: err.message || 'Gagal mendaftarkan staf. Pastikan token & URL Worker valid.',
        details: err.details || null
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(''), 3000);
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* CARD 1: WORKER API HEALTH & URL CONFIG */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <Server className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-sm text-[#333333]">Koneksi Cloudflare Worker Backend</h3>
              <p className="text-xs text-gray-500">Layanan API backend murni untuk pendaftaran staf & RBAC</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
              placeholder="https://chua-sport-backend.embram1989.workers.dev"
              className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-700 w-64 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleTestHealth}
              disabled={healthStatus === 'loading'}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {healthStatus === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Uji Healthcheck</span>
            </button>
          </div>
        </div>

        {/* Health Check Status Indicator */}
        {healthStatus === 'loading' && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Menghubungi endpoint GET /api/health...</span>
          </div>
        )}

        {healthStatus === 'success' && healthResult && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-green-800 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Backend Worker Aktif &amp; Siap Digunakan (Status 200 OK)</span>
              </span>
              <span className="px-2 py-0.5 bg-green-200 text-green-900 font-extrabold rounded-md text-[10px]">
                CORS Terpasang
              </span>
            </div>
            <p className="text-green-700 text-[11px] font-mono">
              Layanan: {healthResult.service} | Environment: {healthResult.environment} | Timestamp: {healthResult.timestamp}
            </p>
          </div>
        )}

        {healthStatus === 'error' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-amber-800 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Worker Belum Dideploy atau URL Belum Terjangkau</span>
            </div>
            <p className="text-amber-700 text-[11px]">
              Jika Anda baru saja membangun kodenya, jalankan perintah deploy di terminal Anda untuk mempublikasikan Cloudflare Worker backend.
            </p>
          </div>
        )}
      </div>

      {/* CARD 2: REGISTER NEW STAFF FORM (POST /api/create-staff) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex items-center space-x-2.5 border-b border-gray-100 pb-3">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-sm text-[#333333]">Pendaftaran Staf Baru (POST /api/create-staff)</h3>
            <p className="text-xs text-gray-500">Mendaftarkan akun staf arena/kasir baru dengan perolehan Custom Claims Role &amp; Tenant ID</p>
          </div>
        </div>

        {regResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2 ${
            regResult.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center space-x-2 font-bold">
              {regResult.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{regResult.message}</span>
            </div>
            {regResult.details && (
              <pre className="p-2 bg-black/5 rounded-lg text-[10px] font-mono overflow-x-auto max-h-36">
                {JSON.stringify(regResult.details, null, 2)}
              </pre>
            )}
          </div>
        )}

        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Lengkap Staf</label>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Budi Kasir"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email Staf</label>
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="staf@chuasport.com"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kata Sandi (Min 6 Karakter)</label>
              <input
                type="password"
                required
                minLength={6}
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="******"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Role Akses (RBAC)</label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-blue-700"
              >
                <option value="kasir">Kasir (POS &amp; Struk)</option>
                <option value="manager">Arena Manager</option>
                <option value="admin">Admin Operasional</option>
                <option value="coach">Pelatih Akademi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tenant ID (Otomatis)</label>
              <input
                type="text"
                disabled
                value={tenantId}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-200/60 border border-gray-200 rounded-xl text-gray-600 font-mono font-bold cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mendaftarkan Staf...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Daftarkan Staf Baru</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* CARD 3: DEPLOYMENT & SECRET COMMANDS INSTRUCTIONS */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
          <Terminal className="w-5 h-5" />
          <span>Panduan Deploy &amp; Konfigurasi Secret Key Cloudflare Worker</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Gunakan perintah berikut di terminal komputer Anda untuk melakukan deploy dan memasukkan kredensial Firebase Service Account Key.
        </p>

        <div className="space-y-3 font-mono text-xs">
          
          {/* STEP 1: DEPLOY COMMAND */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 relative group">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span># 1. Perintah Deploy Worker Backend</span>
              <button
                onClick={() => copyToClipboard('npx wrangler deploy', 'deploy')}
                className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCmd === 'deploy' ? 'Tersalin!' : 'Salin'}</span>
              </button>
            </div>
            <code className="text-green-400 font-bold">npx wrangler deploy</code>
          </div>

          {/* STEP 2: SECRET COMMAND */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 relative group">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span># 2. Perintah Mengatur Secret FIREBASE_SERVICE_ACCOUNT_KEY</span>
              <button
                onClick={() => copyToClipboard('npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY', 'secret')}
                className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCmd === 'secret' ? 'Tersalin!' : 'Salin'}</span>
              </button>
            </div>
            <code className="text-amber-300 font-bold">npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY</code>
            <p className="text-[10px] text-slate-400 mt-1">
              (Tempelkan isi JSON file service account Firebase ketika diminta di prompt terminal).
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
