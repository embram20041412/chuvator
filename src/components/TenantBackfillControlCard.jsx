import React, { useState } from 'react';
import { runKkHmacDryRun, executeKkHmacBackfill } from '../services/backfillService';
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

export default function TenantBackfillControlCard({ tenantId = 'global', tenantName = 'Tenant', userRole = 'owner' }) {
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [dryRunError, setDryRunError] = useState(null);

  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const [executeError, setExecuteError] = useState(null);

  // Run Dry-Run (Read-Only)
  const handleRunDryRun = async () => {
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
  const handleConfirmExecute = async () => {
    setShowExecuteConfirm(false);
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

  const eligibleCount = dryRunResult?.categories?.ELIGIBLE ?? dryRunResult?.backfillCandidates ?? 0;

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
              <h3 className="font-bold text-base text-[#333333]">Audit & Controlled Backfill KK HMAC</h3>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full uppercase">
                {tenantName || 'Tenant Admin'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Analisis terisolasi & eksekusi bertahap pembuatan hash HMAC dari Nomor KK siswa.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            data-testid="tenant-btn-dryrun"
            onClick={handleRunDryRun}
            disabled={loadingDryRun || loadingExecute}
            className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs rounded-xl border border-indigo-200 transition-colors cursor-pointer disabled:opacity-60 flex items-center space-x-1.5"
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
            onClick={() => setShowExecuteConfirm(true)}
            disabled={loadingExecute || loadingDryRun || eligibleCount === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
            title={eligibleCount === 0 ? 'Jalankan analisis dry-run terlebih dahulu atau tidak ada kandidat ELIGIBLE' : 'Eksekusi Backfill'}
          >
            {loadingExecute ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengeksekusi...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Eksekusi Backfill ({eligibleCount})</span>
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

      {/* Hasil Eksekusi Terbaru */}
      {executeResult && (
        <div data-testid="tenant-execute-summary" className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Eksekusi Backfill Selesai!</span>
            </div>
            <span className="text-xs font-mono bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
              Status: {executeResult.completed ? 'COMPLETED' : 'PARTIAL'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 bg-white border border-emerald-200 rounded-lg">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Berhasil Diproses</p>
              <p className="text-lg font-black text-emerald-700">{executeResult.processed ?? 0}</p>
            </div>
            <div className="p-2.5 bg-white border border-emerald-200 rounded-lg">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Dilewati (Skipped)</p>
              <p className="text-lg font-black text-amber-700">{executeResult.skipped ?? 0}</p>
            </div>
            <div className="p-2.5 bg-white border border-emerald-200 rounded-lg">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Gagal (Failed)</p>
              <p className="text-lg font-black text-rose-700">{executeResult.failed ?? 0}</p>
            </div>
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
              <span>{dryRunResult.timestamp ? new Date(dryRunResult.timestamp).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}</span>
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
              <p className="text-[10px] font-bold text-emerald-700 uppercase">No. KK Valid</p>
              <p className="text-lg font-black text-emerald-900 mt-0.5">{dryRunResult.validSourceKK ?? 0}</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-[10px] font-bold text-amber-700 uppercase">No. KK Kosong/Invalid</p>
              <p className="text-lg font-black text-amber-900 mt-0.5">{dryRunResult.invalidSourceKK ?? 0}</p>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-[10px] font-bold text-indigo-700 uppercase">Kandidat ELIGIBLE</p>
              <p className="text-lg font-black text-indigo-900 mt-0.5">{eligibleCount}</p>
            </div>
          </div>

          {/* Rincian Kategori Kualifikasi */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-blue-900">ELIGIBLE (Siap)</span>
              <span className="font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ELIGIBLE ?? 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-emerald-900">ALREADY_VALID</span>
              <span className="font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.ALREADY_VALID ?? 0}</span>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-amber-900">INVALID_SOURCE</span>
              <span className="font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.INVALID_SOURCE ?? 0}</span>
            </div>
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-purple-900">MISSING_LAST4</span>
              <span className="font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.MISSING_LAST4 ?? 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-rose-900">CORRUPT_HMAC</span>
              <span className="font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.CORRUPT_HMAC ?? 0}</span>
            </div>
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-red-900">HMAC_MISMATCH</span>
              <span className="font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">{dryRunResult.categories?.HMAC_MISMATCH ?? 0}</span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center space-x-2 text-[11px] text-gray-500">
            <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>
              Privasi terjamin: NIK, No. KK lengkap, HMAC secret, dan identitas individu siswa tidak pernah diekspos di browser.
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

      {/* Modal Konfirmasi Eksekusi Controlled Backfill */}
      {showExecuteConfirm && (
        <div data-testid="execute-confirm-modal" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2 text-emerald-600">
                <Play className="w-5 h-5" />
                <h3 className="font-bold text-base text-gray-900">Konfirmasi Eksekusi Controlled Backfill</h3>
              </div>
              <button
                data-testid="execute-confirm-cancel-x"
                onClick={() => setShowExecuteConfirm(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center space-x-2.5 text-indigo-900 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Terdapat {eligibleCount} kandidat ELIGIBLE siap di-backfill.</span>
              </div>
              <p className="leading-relaxed text-xs">
                Sistem akan memproses pembuatan hash `kk_hmac` dan `kk_last4` menggunakan transaksi atomik database (`apply_backfill_kk_atomic_record`).
              </p>
              <ul className="text-xs space-y-1 text-gray-500 list-disc pl-4">
                <li>Siswa tanpa No. KK (INVALID_SOURCE) akan dilewati secara aman.</li>
                <li>Perubahan No. KK saat proses berlangsung akan dideteksi dan dibatalkan via `p_expected_no_kk`.</li>
                <li>Audit trail append-only dicatat secara permanen di database.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                data-testid="execute-confirm-cancel"
                onClick={() => setShowExecuteConfirm(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                data-testid="execute-confirm-yes"
                onClick={handleConfirmExecute}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Konfirmasi Eksekusi Backfill</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
