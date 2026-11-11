import React, { useState, useRef, useEffect, useCallback } from 'react';
import { runKkHmacDryRun, executeKkHmacBackfill, isValidBackfillTenantId } from '../../services/backfillService';
import MobileBottomSheet from './MobileBottomSheet';
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
  Info,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

/**
 * Resolver Tenant ID terpusat untuk Mobile Staff HMAC Backfill
 */
export const resolveTenantId = (profile) => {
  if (!profile) return null;
  return profile.tenant?.id || profile.tenantId || profile.tenant?.tenant_id || null;
};

/**
 * MobileTenantBackfillCard Component
 * CHUVATOR Premium Sports Technology Design System.
 * Mobile-First Audit & Execution for Student KK_HMAC Backfill.
 * Scoped strictly under .chua-mobile-app with >=44px touch targets.
 */
export default function MobileTenantBackfillCard({ userProfile }) {
  const tenantId = resolveTenantId(userProfile);
  const tenantName = userProfile?.tenant?.name || 'Cabang Aktif';
  const userRole = String(userProfile?.role || '').trim().toLowerCase();

  const isTenantValid = isValidBackfillTenantId(tenantId);
  const isRoleAllowed = userRole === 'owner' || userRole === 'admin';
  const canOperate = isTenantValid && isRoleAllowed;

  // Dry-Run Analysis State
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [dryRunError, setDryRunError] = useState(null);

  // Execution Batch State (Memory-Only, No LocalStorage / SessionStorage)
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const [executeError, setExecuteError] = useState(null);

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

  // Bottom Sheet Confirmation State
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

  // Refs for Async Cancellation & Race Condition Protection
  const shouldPauseRef = useRef(false);
  const activeTenantIdRef = useRef(tenantId);
  const isMountedRef = useRef(true);

  // Maximum auto-iterations per UI session (prevents infinite loop)
  const MAX_AUTO_BATCH_ITERATIONS = 20;

  // Update tenant ref & reset state if tenant changes
  useEffect(() => {
    isMountedRef.current = true;
    if (activeTenantIdRef.current !== tenantId) {
      activeTenantIdRef.current = tenantId;
      setDryRunResult(null);
      setDryRunError(null);
      setExecuteResult(null);
      setExecuteError(null);
      setActiveRunId(null);
      setActiveLeaseToken(null);
      setLastCursor(null);
      setIsPaused(false);
      setIsCompleted(false);
      setBatchStats({
        totalProcessed: 0,
        totalSkipped: 0,
        totalFailed: 0,
        lastBatchProcessed: 0,
        lastBatchSkipped: 0,
        lastBatchFailed: 0
      });
    }

    return () => {
      isMountedRef.current = false;
      shouldPauseRef.current = true;
    };
  }, [tenantId]);

  // Run Dry-Run Analysis (100% Read-Only)
  const handleRunDryRun = useCallback(async () => {
    if (!canOperate || loadingDryRun || loadingExecute) return;

    const currentTenant = activeTenantIdRef.current;
    setLoadingDryRun(true);
    setDryRunError(null);

    try {
      const res = await runKkHmacDryRun({ tenantId: currentTenant });
      
      // Guard against tenant switch or component unmount
      if (!isMountedRef.current || activeTenantIdRef.current !== currentTenant) return;

      setDryRunResult(res.data || res);
    } catch (err) {
      if (!isMountedRef.current || activeTenantIdRef.current !== currentTenant) return;
      console.error('[Mobile Dry-Run Error]:', err);
      setDryRunError(err.message || 'Gagal menjalankan analisis dry-run tenant.');
    } finally {
      if (isMountedRef.current && activeTenantIdRef.current === currentTenant) {
        setLoadingDryRun(false);
      }
    }
  }, [canOperate, loadingDryRun, loadingExecute]);

  // Execute Controlled Batch Continuation Loop
  const runBatchLoop = async (initialRunId = activeRunId, initialLeaseToken = activeLeaseToken) => {
    if (!canOperate || loadingExecute) return;

    const currentTenant = activeTenantIdRef.current;
    setLoadingExecute(true);
    setExecuteError(null);
    setIsPaused(false);
    shouldPauseRef.current = false;

    let currentRunId = initialRunId;
    let currentLeaseToken = initialLeaseToken;
    let isDone = false;
    let iterationCount = 0;

    let accumProcessed = batchStats.totalProcessed;
    let accumSkipped = batchStats.totalSkipped;
    let accumFailed = batchStats.totalFailed;

    while (!isDone && !shouldPauseRef.current && iterationCount < MAX_AUTO_BATCH_ITERATIONS) {
      if (!isMountedRef.current || activeTenantIdRef.current !== currentTenant) break;

      iterationCount++;

      try {
        const res = await executeKkHmacBackfill({
          tenantId: currentTenant,
          runId: currentRunId || null,
          leaseToken: currentLeaseToken || null,
          batchSize: 50
        });

        // Guard against race condition on tenant change during fetch
        if (!isMountedRef.current || activeTenantIdRef.current !== currentTenant) break;

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

        // Standard: Status COMPLETED only if server returns completed === true
        if (resData.completed === true) {
          isDone = true;
          setIsCompleted(true);
          setActiveRunId(null);
          setActiveLeaseToken(null);
          break;
        }

        // If no more rows remain but completed !== true
        if (resData.hasMoreRows === false && resData.completed !== true) {
          isDone = true;
          setIsCompleted(false);
          setExecuteError(resData.message || 'Batch selesai diproses namun status COMPLETED belum terkonfirmasi oleh server database.');
          break;
        }
      } catch (err) {
        if (!isMountedRef.current || activeTenantIdRef.current !== currentTenant) break;
        console.error('[Mobile Backfill Execution Error]:', err);
        setExecuteError(err.message || 'Gagal mengeksekusi batch backfill tenant.');
        if (err.runId) setActiveRunId(err.runId);
        if (err.leaseToken) setActiveLeaseToken(err.leaseToken);
        break;
      }
    }

    if (isMountedRef.current && activeTenantIdRef.current === currentTenant) {
      setLoadingExecute(false);

      if (shouldPauseRef.current) {
        setIsPaused(true);
      } else if (iterationCount >= MAX_AUTO_BATCH_ITERATIONS && !isDone) {
        setIsPaused(true);
        setExecuteError(`Batas Otomatis Sesi UI (${MAX_AUTO_BATCH_ITERATIONS} batch) tercapai. Klik "Lanjutkan (Resume)" untuk meneruskan.`);
      }

      // Refresh dry-run counts after batch loop finishes/pauses
      try {
        const res = await runKkHmacDryRun({ tenantId: currentTenant });
        if (isMountedRef.current && activeTenantIdRef.current === currentTenant) {
          setDryRunResult(res.data || res);
        }
      } catch (_) {}
    }
  };

  const handlePauseBatch = () => {
    shouldPauseRef.current = true;
  };

  const handleResetState = () => {
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

  // Restricted Access Screen (403 for Superadmin, Coach, Kasir, Staff)
  if (!isRoleAllowed) {
    return (
      <div className="chua-mobile-app">
        <div className="bg-white border border-slate-200 rounded-[18px] p-4 text-slate-500 text-xs shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Fasilitas Backfill Khusus Owner &amp; Admin Tenant</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed my-0">
            Fitur operasional audit dan backfill data KK siswa ini tidak tersedia untuk peran Superadmin atau staf non-pengelola.
          </p>
        </div>
      </div>
    );
  }

  // Missing Tenant Context Screen
  if (!isTenantValid) {
    return (
      <div className="chua-mobile-app">
        <div className="bg-white border border-amber-200 rounded-[18px] p-4 text-amber-900 text-xs shadow-2xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Konteks Tenant Tidak Valid</span>
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed my-0">
            Identitas tenant tidak tersedia atau bukan format UUID yang valid. Layanan operasional tidak dapat dipanggil.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chua-mobile-app space-y-3.5 text-left text-slate-800">
      
      {/* 1. HERO CONTROL CARD */}
      <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-2xs space-y-3.5">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#2455E8]/10 text-[#2455E8] rounded-xl shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#101D38] leading-tight my-0">
                Audit KK HMAC &amp; Backfill
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[180px]">
                {tenantName}
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 bg-blue-50 text-[#2455E8] border border-blue-200 text-[9px] font-black rounded-full uppercase shrink-0">
            {userRole.toUpperCase()}
          </span>
        </div>

        {/* Operational Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Dry-Run Button */}
          <button
            type="button"
            data-testid="mobile-btn-dryrun"
            onClick={handleRunDryRun}
            disabled={!canOperate || loadingDryRun || loadingExecute}
            className="w-full px-4 py-3 bg-[#101D38]/5 hover:bg-[#101D38]/10 text-[#101D38] font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingDryRun ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#2455E8]" />
                <span>Menganalisis Data...</span>
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4 text-[#2455E8]" />
                <span>Analisis Dry-Run (Read-Only)</span>
              </>
            )}
          </button>

          {/* Execute / Resume / Pause Button */}
          {loadingExecute ? (
            <button
              type="button"
              onClick={handlePauseBatch}
              className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4" />
              <span>Jeda Batch (Pause)</span>
            </button>
          ) : activeRunId ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="mobile-btn-resume"
                onClick={() => runBatchLoop(activeRunId, activeLeaseToken)}
                disabled={!canOperate}
                className="flex-1 px-4 py-3 bg-[#16A779] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer min-h-[48px] flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Lanjutkan (Resume)</span>
              </button>
              <button
                type="button"
                onClick={handleResetState}
                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center shrink-0"
                title="Riset Siklus Run"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="mobile-btn-execute"
              onClick={() => setShowConfirmSheet(true)}
              disabled={!canOperate || (eligibleCount === 0 && !dryRunResult)}
              className={`w-full px-4 py-3 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 min-h-[48px] ${
                !canOperate || (eligibleCount === 0 && !dryRunResult)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-[#16A779] hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>Eksekusi Backfill Data</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. ACTIVE RUN STATUS BADGE */}
      {activeRunId && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between text-xs text-indigo-950 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16A779] animate-pulse shrink-0" />
            <span className="font-bold font-sans">Run Aktif:</span>
            <span className="bg-white px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
              {activeRunId.slice(0, 8)}...
            </span>
          </div>
          {activeLeaseToken && (
            <span className="text-[10px] text-indigo-700">
              Token: ...{activeLeaseToken.slice(-6)}
            </span>
          )}
        </div>
      )}

      {/* 3. PROGRESS STATE DURING EXECUTION */}
      {loadingExecute && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-5 h-5 text-[#16A779] animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-950 my-0">Memproses Batch Backfill (50 record/batch)...</p>
              <p className="text-[10px] text-emerald-700 my-0 mt-0.5">Memperbarui hash HMAC siswa via RPC atomik.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-emerald-200 text-[10px] font-mono text-center">
            <div>
              <span className="block text-slate-400 font-sans uppercase font-bold text-[8px]">Diproses</span>
              <strong className="text-slate-900 text-xs">{batchStats.totalProcessed}</strong>
            </div>
            <div>
              <span className="block text-slate-400 font-sans uppercase font-bold text-[8px]">Dilewati</span>
              <strong className="text-slate-900 text-xs">{batchStats.totalSkipped}</strong>
            </div>
            <div>
              <span className="block text-slate-400 font-sans uppercase font-bold text-[8px]">Gagal</span>
              <strong className="text-rose-600 text-xs">{batchStats.totalFailed}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 4. ERROR ALERT & RESUME RECOVERY */}
      {executeError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2 text-xs text-rose-900">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold my-0">Eksekusi Batch Terhenti</p>
              <p className="text-[11px] text-rose-700 my-0 mt-0.5">{executeError}</p>
            </div>
          </div>
          {activeRunId && activeLeaseToken && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => runBatchLoop(activeRunId, activeLeaseToken)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer min-h-[44px] flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Coba Lagi / Lanjutkan Siklus</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. EXECUTION RESULT SUMMARY */}
      {executeResult && (
        <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
          isCompleted 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-[#16A779] shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-bold my-0">
              {isCompleted ? 'Seluruh Backfill Selesai Dituntaskan' : isPaused ? 'Batch Di-pause Oleh Pengguna' : 'Iterasi Batch Berhasil'}
            </p>
            <p className="text-[11px] opacity-90 my-0 mt-0.5">
              {executeResult.message || `Data KK siswa cabang ${tenantName} telah diperbarui.`}
            </p>
            <div className="text-[10px] font-mono mt-1 flex flex-wrap gap-x-3 opacity-90">
              <span>Batch Ini: {executeResult.lastBatchProcessed ?? executeResult.processed}</span>
              <span>Total Diproses: {batchStats.totalProcessed}</span>
              <span>Skipped: {batchStats.totalSkipped}</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. DRY-RUN RESULTS & HMAC AUDIT DASHBOARD */}
      {dryRunResult ? (
        <div data-testid="mobile-dryrun-results" className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 font-bold text-[#101D38]">
              <Database className="w-4 h-4 text-[#2455E8]" />
              <span>Hasil Analisis Read-Only</span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              {dryRunResult.completedAt ? new Date(dryRunResult.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* 4 Primary Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-slate-200 rounded-[18px] p-3 shadow-2xs">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Siswa</span>
              <strong className="text-base font-black text-slate-900 mt-0.5 block">{dryRunResult.totalStudents ?? 0}</strong>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-[18px] p-3 shadow-2xs">
              <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider block">Already Valid</span>
              <strong className="text-base font-black text-emerald-950 mt-0.5 block">{dryRunResult.categories?.ALREADY_VALID ?? 0}</strong>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-[18px] p-3 shadow-2xs">
              <span className="text-[9px] font-extrabold text-blue-700 uppercase tracking-wider block">Kandidat Eligible</span>
              <strong className="text-base font-black text-blue-950 mt-0.5 block">{eligibleCount}</strong>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-[18px] p-3 shadow-2xs">
              <span className="text-[9px] font-extrabold text-rose-700 uppercase tracking-wider block">Perlu Tinjauan</span>
              <strong className="text-base font-black text-rose-950 mt-0.5 block">{reviewRequired}</strong>
            </div>
          </div>

          {/* Detailed 9-Category Breakdown Grid */}
          <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-3.5 shadow-2xs space-y-2">
            <h4 className="text-xs font-extrabold text-[#101D38] uppercase tracking-wider my-0 border-b border-slate-100 pb-2">
              Rincian Kategori Kualifikasi Data
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-blue-900">Eligible</span>
                <span className="font-black bg-[#2455E8] text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ELIGIBLE ?? 0}</span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-emerald-900">Already Valid</span>
                <span className="font-black bg-[#16A779] text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ALREADY_VALID ?? 0}</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-slate-700">Missing No KK</span>
                <span className="font-black bg-slate-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.MISSING_NO_KK ?? 0}</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-slate-700">Invalid No KK</span>
                <span className="font-black bg-slate-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.INVALID_NO_KK ?? 0}</span>
              </div>
              <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-purple-900">Missing Last4</span>
                <span className="font-black bg-purple-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.MISSING_LAST4 ?? 0}</span>
              </div>
              <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-purple-900">Last4 Mismatch</span>
                <span className="font-black bg-purple-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.LAST4_MISMATCH ?? 0}</span>
              </div>
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-rose-900">Corrupt HMAC</span>
                <span className="font-black bg-rose-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.CORRUPT_HMAC ?? 0}</span>
              </div>
              <div className="p-2 bg-red-50 border border-red-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-red-900">HMAC Mismatch</span>
                <span className="font-black bg-red-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.HMAC_MISMATCH ?? 0}</span>
              </div>
              <div className="p-2 bg-orange-50 border border-orange-200 rounded-xl flex justify-between items-center col-span-2">
                <span className="font-bold text-orange-900">Last4 Without HMAC</span>
                <span className="font-black bg-orange-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.LAST4_WITHOUT_HMAC ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-6 border-2 border-dashed border-slate-200 rounded-[18px] bg-white text-center space-y-1.5 p-4">
          <FileSearch className="w-7 h-7 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-600 my-0">
            Belum Ada Hasil Analisis
          </p>
          <p className="text-[10px] text-slate-400 my-0">
            Tekan "Analisis Dry-Run (Read-Only)" untuk memeriksa kelayakan data KK siswa.
          </p>
        </div>
      )}

      {/* Security Info Banner */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2 text-[10px] text-emerald-900">
        <Info className="w-4 h-4 text-[#16A779] shrink-0 mt-0.5" />
        <span>
          <strong>Keamanan Fencing Token:</strong> Token lease disimpan strictly pada memori state komponen React. Jika tab/aplikasi ditutup, lease lock expired otomatis dalam 120 detik di server.
        </span>
      </div>

      {/* =========================================================================
          CONFIRMATION BOTTOM SHEET BEFORE BACKFILL EXECUTION
          ========================================================================= */}
      <MobileBottomSheet
        isOpen={showConfirmSheet}
        onClose={() => setShowConfirmSheet(false)}
        title="Konfirmasi Eksekusi Backfill KK HMAC"
      >
        <div className="space-y-4 text-left text-slate-800">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold my-0">Tindakan Memperbarui Data</p>
              <p className="text-[11px] text-amber-800 my-0 mt-0.5">
                Proses ini akan memperbarui kolom <code>kk_hmac</code> dan <code>kk_last4</code> pada siswa terdaftar secara atomik di database.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Cabang Tenant:</span>
              <strong className="text-slate-900 font-bold">{tenantName}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200 font-mono text-[11px]">
              <span className="text-slate-500 font-sans">Tenant ID:</span>
              <strong className="text-slate-900 font-bold">{tenantId}</strong>
            </div>
            <div className="flex justify-between py-1 font-mono text-[11px]">
              <span className="text-slate-500 font-sans">Kandidat Eligible:</span>
              <strong className="text-[#2455E8] font-bold text-xs">{eligibleCount} Record</strong>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowConfirmSheet(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[48px]"
            >
              Batal
            </button>
            <button
              type="button"
              data-testid="mobile-btn-confirm-execute"
              onClick={() => {
                setShowConfirmSheet(false);
                runBatchLoop(null, null);
              }}
              className="px-5 py-2.5 bg-[#16A779] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[48px]"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Ya, Konfirmasi Eksekusi</span>
            </button>
          </div>
        </div>
      </MobileBottomSheet>

    </div>
  );
}
