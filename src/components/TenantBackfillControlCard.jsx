import React, { useState, useRef } from 'react';
import { runKkHmacDryRun, executeKkHmacBackfill, isValidBackfillTenantId } from '../services/backfillService';
import { 
  ShieldCheck, 
  FileSearch, 
  Play, 
  Pause,
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database, 
  Lock, 
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

  // Distributed Token & Batch Execution State (Strict Memory-Only, No LocalStorage)
  const [activeRunId, setActiveRunId] = useState(null);
  const [activeLeaseToken, setActiveLeaseToken] = useState(null);
  const [lastCursor, setLastCursor] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [batchStats, setBatchStats] = useState({
    totalProcessed: 0,
    totalSkipped: 0,
    totalFailed: 0,
    lastBatchProcessed: 0,
    lastBatchSkipped: 0,
    lastBatchFailed: 0
  });

  const shouldPauseRef = useRef(false);

  const isTenantValid = isValidBackfillTenantId(tenantId);
  const isRoleAllowed = userRole === 'owner' || userRole === 'admin';
  const canOperate = isTenantValid && isRoleAllowed;

  // Run Dry-Run (Read-Only Analysis)
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

  // Run Batch Continuation Loop (Maximum Batch Size 50)
  const runBatchLoop = async (initialRunId = activeRunId, initialLeaseToken = activeLeaseToken) => {
    if (!canOperate || loadingExecute) return;

    setLoadingExecute(true);
    setExecuteError(null);
    setIsPaused(false);
    shouldPauseRef.current = false;

    let currentRunId = initialRunId;
    let currentLeaseToken = initialLeaseToken;
    let isDone = false;

    let accumProcessed = batchStats.totalProcessed;
    let accumSkipped = batchStats.totalSkipped;
    let accumFailed = batchStats.totalFailed;

    while (!isDone && !shouldPauseRef.current) {
      try {
        const res = await executeKkHmacBackfill({
          tenantId,
          runId: currentRunId || null,
          leaseToken: currentLeaseToken || null,
          batchSize: 50
        });

        const resData = res.data || res;
        currentRunId = resData.runId || res.runId || currentRunId;
        currentLeaseToken = resData.leaseToken || res.leaseToken || currentLeaseToken;

        setActiveRunId(currentRunId);
        setActiveLeaseToken(currentLeaseToken);
        setLastCursor(resData.lastCursor || res.lastCursor || null);

        const bProcessed = resData.processed || 0;
        const bSkipped = resData.skipped || 0;
        const bFailed = resData.failed || 0;

        accumProcessed += bProcessed;
        accumSkipped += bSkipped;
        accumFailed += bFailed;

        const updatedStats = {
          totalProcessed: accumProcessed,
          totalSkipped: accumSkipped,
          totalFailed: accumFailed,
          lastBatchProcessed: bProcessed,
          lastBatchSkipped: bSkipped,
          lastBatchFailed: bFailed
        };
        setBatchStats(updatedStats);

        const execSummary = {
          ...resData,
          runId: currentRunId,
          leaseToken: currentLeaseToken,
          ...updatedStats
        };
        setExecuteResult(execSummary);

        if (resData.completed === true || resData.hasMoreRows === false) {
          isDone = true;
          setIsCompleted(true);
          setActiveRunId(null);
          setActiveLeaseToken(null);
          break;
        }
      } catch (err) {
        console.error('[Tenant Backfill Execution Error]:', err);
        setExecuteError(err.message || 'Gagal mengeksekusi batch backfill tenant.');
        if (err.runId) setActiveRunId(err.runId);
        if (err.leaseToken) setActiveLeaseToken(err.leaseToken);
        break;
      }
    }

    setLoadingExecute(false);
    if (shouldPauseRef.current) {
      setIsPaused(true);
    }

    // Refresh dry-run data after batch execution ends/pauses
    try {
      const res = await runKkHmacDryRun({ tenantId });
      setDryRunResult(res.data || res);
    } catch (_) {}
  };

  const handlePauseBatch = () => {
    shouldPauseRef.current = true;
  };

  const handleResetRunState = () => {
    setActiveRunId(null);
    setActiveLeaseToken(null);
    setLastCursor(null);
    setIsPaused(false);
    setIsCompleted(false);
    setExecuteError(null);
    setExecuteResult(null);
    setBatchStats({
      totalProcessed: 0,
      totalSkipped: 0,
      totalFailed: 0,
      lastBatchProcessed: 0,
      lastBatchSkipped: 0,
      lastBatchFailed: 0
    });
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-slate-800 space-y-5 text-left">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-base text-[#333333] dark:text-slate-100">Audit & Dry-Run Analisis KK HMAC</h3>
              <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-bold rounded-full uppercase">
                {tenantName || 'Tenant Admin'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Analisis terisolasi & eksekusi bertahap batch (50 record/batch) berbasis fencing lease token tepercaya.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
          {/* Tombol Dry-Run */}
          <button
            data-testid="tenant-btn-dryrun"
            onClick={handleRunDryRun}
            disabled={!canOperate || loadingDryRun || loadingExecute}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold text-xs rounded-xl border border-indigo-200 dark:border-indigo-900 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5"
            title={!isTenantValid ? "Identitas tenant tidak valid." : "Analisis simulasi read-only."}
          >
            {loadingDryRun ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Menganalisis...</span>
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Analisis Dry-Run (Read-Only)</span>
              </>
            )}
          </button>

          {/* Kontrol Eksekusi Batch & Resume/Pause */}
          {loadingExecute ? (
            <button
              onClick={handlePauseBatch}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              <span>Jeda Batch</span>
            </button>
          ) : activeRunId ? (
            <div className="flex items-center space-x-2">
              <button
                data-testid="tenant-btn-resume"
                onClick={() => runBatchLoop(activeRunId, activeLeaseToken)}
                disabled={!canOperate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Lanjutkan (Resume)</span>
              </button>
              <button
                onClick={handleResetRunState}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                title="Riset siklus run aktif"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              data-testid="tenant-btn-execute"
              onClick={() => runBatchLoop(null, null)}
              disabled={!canOperate || (eligibleCount === 0 && !dryRunResult)}
              className={`px-4 py-2 font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 ${
                !canOperate || (eligibleCount === 0 && !dryRunResult)
                  ? 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-emerald-600/20'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>Mulai Eksekusi Backfill</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Run Status Badge */}
      {activeRunId && (
        <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-300">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold">Siklus Run Aktif:</span>
            <span className="font-mono text-[11px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
              {activeRunId}
            </span>
          </div>
          {activeLeaseToken && (
            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
              Token Lease: ...{activeLeaseToken.slice(-8)}
            </span>
          )}
        </div>
      )}

      {/* Loading & Progress State */}
      {loadingExecute && (
        <div className="p-5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-3">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Sedang Memproses Batch Backfill KK HMAC...</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                Menggunakan fencing token & RPC atomik. Memproses 50 record per iterasi batch.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
            <div>Diproses (Total): <strong>{batchStats.totalProcessed}</strong></div>
            <div>Dilewati (Total): <strong>{batchStats.totalSkipped}</strong></div>
            <div>Gagal (Total): <strong>{batchStats.totalFailed}</strong></div>
          </div>
        </div>
      )}

      {/* Alert Error & Resume Action */}
      {executeError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl space-y-2 text-red-800 dark:text-red-300 text-sm">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Eksekusi Batch Terhenti</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{executeError}</p>
            </div>
          </div>
          {activeRunId && activeLeaseToken && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => runBatchLoop(activeRunId, activeLeaseToken)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer flex items-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Coba Lagi / Lanjutkan Siklus</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Alert Sukses / Status Eksekusi */}
      {executeResult && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-start space-x-3 text-emerald-800 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">
              {isCompleted ? 'Seluruh Backfill Selesai Dituntaskan' : isPaused ? 'Batch Di-pause Oleh Pengguna' : 'Iterasi Batch Berhasil'}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              {executeResult.message || `Berhasil memproses data tenant ${tenantName}.`}
            </p>
            <div className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              <span>Diproses Batch Ini: {executeResult.lastBatchProcessed ?? executeResult.processed}</span>
              <span>Total Diproses: {batchStats.totalProcessed}</span>
              <span>Total Skipped: {batchStats.totalSkipped}</span>
            </div>
          </div>
        </div>
      )}

      {/* Hasil Dry-Run */}
      {dryRunResult ? (
        <div data-testid="tenant-dryrun-results" className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-gray-700 dark:text-slate-200">Hasil Analisis Read-Only Tenant:</span>
              <span>{dryRunResult.completedAt ? new Date(dryRunResult.completedAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}</span>
            </div>
            <span className="font-mono text-[11px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded font-bold">
              TENANT: {tenantId}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Siswa</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">{dryRunResult.totalStudents ?? 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">ALREADY_VALID</p>
              <p className="text-lg font-black text-emerald-900 dark:text-emerald-200 mt-0.5">{dryRunResult.categories?.ALREADY_VALID ?? 0}</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl">
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">Kandidat ELIGIBLE</p>
              <p className="text-lg font-black text-indigo-900 dark:text-indigo-200 mt-0.5">{eligibleCount}</p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl">
              <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">Perlu Tinjauan</p>
              <p className="text-lg font-black text-rose-900 dark:text-rose-200 mt-0.5">{reviewRequired}</p>
            </div>
          </div>

          {/* Detailed qualification grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-blue-900 dark:text-blue-300">ELIGIBLE</span>
              <span className="font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ELIGIBLE ?? 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-emerald-900 dark:text-emerald-300">ALREADY_VALID</span>
              <span className="font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ALREADY_VALID ?? 0}</span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-slate-900 dark:text-slate-300">MISSING_NO_KK</span>
              <span className="font-bold bg-slate-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.MISSING_NO_KK ?? 0}</span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-slate-900 dark:text-slate-300">INVALID_NO_KK</span>
              <span className="font-bold bg-slate-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.INVALID_NO_KK ?? 0}</span>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-purple-900 dark:text-purple-300">MISSING_LAST4</span>
              <span className="font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.MISSING_LAST4 ?? 0}</span>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-purple-900 dark:text-purple-300">LAST4_MISMATCH</span>
              <span className="font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.LAST4_MISMATCH ?? 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-rose-900 dark:text-rose-300">CORRUPT_HMAC</span>
              <span className="font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.CORRUPT_HMAC ?? 0}</span>
            </div>
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-red-900 dark:text-red-300">HMAC_MISMATCH</span>
              <span className="font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.HMAC_MISMATCH ?? 0}</span>
            </div>
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-orange-900 dark:text-orange-300">LAST4_NO_HMAC</span>
              <span className="font-bold bg-orange-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.LAST4_WITHOUT_HMAC ?? 0}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-center space-y-2 p-4">
          <FileSearch className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto" />
          <p className="text-xs font-semibold text-gray-600 dark:text-slate-400">
            Tekan "Analisis Dry-Run (Read-Only)" untuk memeriksa kesiapan data siswa tenant ini.
          </p>
        </div>
      )}

      {/* Security & Memory Notice */}
      <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 flex items-center space-x-2 text-[11px] text-emerald-800 dark:text-emerald-300">
        <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          <strong>Catatan Keamanan Lifecycle Lease:</strong> Fencing token disimpan strictly pada memori komponen React (tanpa localStorage/sessionStorage). Jika halaman ditutup saat proses terhenti, lock lease akan expired otomatis dalam 120 detik di database dan dapat di-resume kembali dengan aman.
        </span>
      </div>

    </div>
  );
}
