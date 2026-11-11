import React, { useState } from 'react';
import { runKkHmacDryRun, executeKkHmacBackfill, isValidBackfillTenantId } from '../services/backfillService';
import { 
  ShieldCheck, 
  FileSearch, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database, 
  Lock, 
  X,
  RefreshCw,
  Info
} from 'lucide-react';

export default function TenantBackfillControlCard({ tenantId = null, tenantName = 'Tenant', userRole = 'owner' }) {
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [dryRunError, setDryRunError] = useState(null);

  const [loadingExecute, setLoadingExecute] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const [executeError, setExecuteError] = useState(null);

  const isTenantValid = isValidBackfillTenantId(tenantId);
  const isRoleAllowed = userRole === 'owner' || userRole === 'admin';
  const canOperate = isTenantValid && isRoleAllowed;

  // Run Dry-Run (Read-Only)
  const handleRunDryRun = async () => {
    if (!canOperate || loadingDryRun || loadingExecute) return;
    setLoadingDryRun(true);
    setDryRunError(null);
    setExecuteResult(null);

    try {
      const res = await runKkHmacDryRun({ tenantId });
      setDryRunResult(res.data || res);
    } catch (err) {
      console.error('[Tenant Dry-Run Error]:', err);
      setDryRunError(err.message || 'Gagal menjalankan analisis dry-run tenant.');
    } finally {
      setLoadingDryRun(false);
    }
  };

  // Run Controlled Backfill Execution
  const handleExecuteBackfill = async () => {
    if (!canOperate || eligibleCount === 0 || loadingExecute) return;
    setLoadingExecute(true);
    setExecuteError(null);

    try {
      const res = await executeKkHmacBackfill({ tenantId, batchSize: 50 });
      setExecuteResult(res.data || res);
      // Refresh dry-run after execution to update counts
      await handleRunDryRun();
    } catch (err) {
      console.error('[Tenant Backfill Execution Error]:', err);
      setExecuteError(err.message || 'Gagal mengeksekusi backfill tenant.');
    } finally {
      setLoadingExecute(false);
    }
  };

  const eligibleCount = dryRunResult?.categories?.ELIGIBLE ?? 0;
  const reviewRequired = dryRunResult?.reviewRequired ?? 0;

  if (!isRoleAllowed) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-white/10 flex items-center space-x-3 text-slate-500 text-xs">
        <Lock className="w-5 h-5 text-slate-400 shrink-0" />
        <div>
          <p className="font-bold text-slate-700 dark:text-slate-300">Fasilitas Backfill Khusus Owner & Admin Tenant</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Fitur operasional backfill data siswa ini tidak tersedia untuk peran Superadmin atau staf non-pengelola.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-base text-[#333333]">Audit & Dry-Run Analisis KK HMAC</h3>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full uppercase">
                {tenantName || 'Tenant Admin'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Analisis terisolasi & simulasi pembuatan hash HMAC dari Nomor KK siswa (100% Read-Only).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            data-testid="tenant-btn-dryrun"
            onClick={handleRunDryRun}
            disabled={!canOperate || loadingDryRun || loadingExecute}
            className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs rounded-xl border border-indigo-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5"
            title={!isTenantValid ? "Identitas tenant tidak valid." : "Analisis simulasi read-only."}
          >
            {loadingDryRun ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Menganalisis...</span>
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4 text-indigo-600" />
                <span>Analisis Dry-Run (Read-Only)</span>
              </>
            )}
          </button>

          <button
            data-testid="tenant-btn-execute"
            onClick={handleExecuteBackfill}
            disabled={!canOperate || eligibleCount === 0 || loadingExecute}
            className={`px-4 py-2 font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 ${
              !canOperate || eligibleCount === 0 || loadingExecute
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-emerald-600/20'
            }`}
            title={!isTenantValid ? "Tenant ID belum tersedia." : eligibleCount === 0 ? "Tidak ada kandidat ELIGIBLE untuk dieksekusi." : "Eksekusi backfill data ELIGIBLE secara atomik."}
          >
            {loadingExecute ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengeksekusi...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Eksekusi Backfill</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Execute State */}
      {loadingExecute && (
        <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center space-x-4">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-900">Sedang Mengeksekusi Controlled Backfill KK HMAC...</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Menggunakan lease lock fencing token & RPC atomik `apply_backfill_kk_atomic_record`.
            </p>
          </div>
        </div>
      )}

      {/* Alert Error */}
      {(dryRunError || executeError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Gagal Mengoperasikan Backfill</p>
            <p className="text-xs text-red-700">{dryRunError || executeError}</p>
          </div>
        </div>
      )}

      {/* Alert Sukses Eksekusi */}
      {executeResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Eksekusi Backfill Berhasil</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {executeResult.message || `Berhasil memproses backfill untuk tenant ${tenantName}. Data kandidat ELIGIBLE telah diperbarui secara atomik.`}
            </p>
            {executeResult.processedCount !== undefined && (
              <p className="text-[11px] font-mono text-emerald-800 mt-1">
                Diproses: {executeResult.processedCount} | Berhasil: {executeResult.successCount ?? executeResult.processedCount}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Display Hasil Dry-Run */}
      {dryRunResult ? (
        <div data-testid="tenant-dryrun-results" className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold text-gray-700">Hasil Analisis Read-Only Tenant:</span>
              <span>{dryRunResult.completedAt ? new Date(dryRunResult.completedAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}</span>
            </div>
            <span className="font-mono text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
              TENANT: {tenantId}
            </span>
          </div>

          {/* Grid Ringkasan Metrik */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Siswa</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{dryRunResult.totalStudents ?? 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-700 uppercase">ALREADY_VALID</p>
              <p className="text-lg font-black text-emerald-900 mt-0.5">{dryRunResult.categories?.ALREADY_VALID ?? 0}</p>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-[10px] font-bold text-indigo-700 uppercase">Kandidat ELIGIBLE</p>
              <p className="text-lg font-black text-indigo-900 mt-0.5">{eligibleCount}</p>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-[10px] font-bold text-rose-700 uppercase">Perlu Tinjauan</p>
              <p className="text-lg font-black text-rose-900 mt-0.5">{reviewRequired}</p>
            </div>
          </div>

          {/* Rincian Kategori Kualifikasi */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-blue-900">ELIGIBLE</span>
              <span className="font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ELIGIBLE ?? 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-emerald-900">ALREADY_VALID</span>
              <span className="font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ALREADY_VALID ?? 0}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-slate-900">MISSING_NO_KK</span>
              <span className="font-bold bg-slate-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.MISSING_NO_KK ?? 0}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-slate-900">INVALID_NO_KK</span>
              <span className="font-bold bg-slate-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.INVALID_NO_KK ?? 0}</span>
            </div>
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-purple-900">MISSING_LAST4</span>
              <span className="font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.MISSING_LAST4 ?? 0}</span>
            </div>
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-purple-900">LAST4_MISMATCH</span>
              <span className="font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.LAST4_MISMATCH ?? 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-rose-900">CORRUPT_HMAC</span>
              <span className="font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.CORRUPT_HMAC ?? 0}</span>
            </div>
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-red-900">HMAC_MISMATCH</span>
              <span className="font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.HMAC_MISMATCH ?? 0}</span>
            </div>
            <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-orange-900">LAST4_NO_HMAC</span>
              <span className="font-bold bg-orange-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.LAST4_WITHOUT_HMAC ?? 0}</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex items-center space-x-2 text-[11px] text-emerald-800">
            <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Eksekusi akan memproses data ELIGIBLE secara atomik.
            </span>
          </div>
        </div>
      ) : (
        <div className="py-8 border-2 border-dashed border-gray-200 rounded-xl text-center space-y-2 p-4">
          <FileSearch className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-xs font-semibold text-gray-600">
            Tekan "Analisis Dry-Run (Read-Only)" untuk memeriksa kesiapan data siswa tenant ini.
          </p>
        </div>
      )}

    </div>
  );
}
