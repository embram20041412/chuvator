/**
 * CHUVATOR — MULTI-TENANT ASSESSMENT BATTERY STORAGE SERVICE
 * Mengelola penyimpanan dan pembacaan hasil pengukuran tes lapangan mentah
 * (public.athlete_test_results) dengan penegakan isolasi multi-tenant yang ketat.
 *
 * Prinsip Keamanan Multi-Tenant:
 * 1. tenant_id WAJIB diturunkan dari sesi/konteks autentikasi aktif (sessionTenantId).
 * 2. Apabila payload mencantumkan tenant_id yang berbeda dengan sessionTenantId,
 *    operasi langsung ditolak dengan kode error 42501 (Cross-Tenant Violation).
 * 3. Semua query baca/tulis/hapus selalu memfilter berdasarkan tenant_id yang terverifikasi.
 * 4. Karena eksekusi DDL langsung terhadap Supabase produksi dilarang tanpa persetujuan,
 *    service ini menggunakan tabel `public.athlete_test_results` sebagai jalur utama dan
 *    menyediakan penyimpanan lokal terisolasi per-tenant apabila tabel belum dimigrasikan
 *    pada database target atau saat berjalan pada mode pratinjau demo.
 */

import { supabase } from '../config/supabase.js';
import { validateAndComputeTestBatteryEntry } from '../utils/testBatteryValidator.js';
import { getTestDefinitionById } from '../config/footballTestBatteryCatalog.js';

const LOCAL_STORE_PREFIX = 'chuvator_athlete_test_results_v1::';

// Penyimpanan in-memory cadangan untuk lingkungan Node.js (unit test) tanpa window.localStorage
const memoryTenantStores = new Map();

/**
 * Mengambil kunci penyimpanan lokal yang terpartisi ketat per tenant_id
 */
function getTenantStorageKey(verifiedTenantId) {
  return `${LOCAL_STORE_PREFIX}${verifiedTenantId}`;
}

/**
 * Membaca daftar record dari penyimpanan lokal milik satu tenant spesifik
 */
function readTenantLocalStore(verifiedTenantId) {
  if (!verifiedTenantId) return [];
  const key = getTenantStorageKey(verifiedTenantId);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Filter berlapis untuk memastikan tidak ada kebocoran antar-tenant
      return parsed.filter((row) => row && row.tenant_id === verifiedTenantId);
    }
  } catch {
    // Fallback ke memory store jika localStorage diblokir
  }

  const memRows = memoryTenantStores.get(key) || [];
  return memRows.filter((row) => row && row.tenant_id === verifiedTenantId);
}

/**
 * Menulis daftar record ke penyimpanan lokal milik satu tenant spesifik
 */
function writeTenantLocalStore(verifiedTenantId, records) {
  if (!verifiedTenantId) return;
  const key = getTenantStorageKey(verifiedTenantId);
  const safeRecords = (Array.isArray(records) ? records : []).filter(
    (row) => row && row.tenant_id === verifiedTenantId
  );

  memoryTenantStores.set(key, safeRecords);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(safeRecords));
    }
  } catch {
    // Abaikan error kuota di browser; memoryTenantStores tetap sinkron selama sesi
  }
}

/**
 * Reset penyimpanan lokal/memori untuk keperluan pengujian terisolasi
 */
export function clearTenantLocalTestBatteryStore(tenantId) {
  if (!tenantId) return;
  const key = getTenantStorageKey(tenantId);
  memoryTenantStores.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/**
 * Memverifikasi dan menurunkan tenant_id dari konteks pengguna aktif.
 * Menolak setiap upaya manipulasi tenant_id dari payload luar.
 */
export function verifyAndResolveTenantId(authContext, requestedTenantId = null) {
  const sessionTenantId =
    authContext?.tenantId ||
    authContext?.tenant_id ||
    (typeof authContext === 'string' ? authContext : null);

  if (!sessionTenantId || typeof sessionTenantId !== 'string' || sessionTenantId.trim() === '') {
    const err = new Error('Akses ditolak: Konteks tenant_id dari sesi aktif tidak ditemukan.');
    err.code = '42501';
    throw err;
  }

  const cleanSessionTenant = sessionTenantId.trim();

  if (
    requestedTenantId !== null &&
    requestedTenantId !== undefined &&
    String(requestedTenantId).trim() !== '' &&
    String(requestedTenantId).trim() !== cleanSessionTenant
  ) {
    const err = new Error(
      `Pelanggaran Isolasi Multi-Tenant (42501): Tidak diizinkan mengakses atau menyimpan data milik tenant "${requestedTenantId}" dari sesi tenant "${cleanSessionTenant}".`
    );
    err.code = '42501';
    throw err;
  }

  return cleanSessionTenant;
}

/**
 * Memetakan baris database/store (`snake_case`) menjadi objek aplikasi (`camelCase`)
 */
export function mapTestResultRowToModel(row) {
  if (!row) return null;
  const testDef = getTestDefinitionById(row.test_id);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    academyId: row.academy_id || null,
    classId: row.class_id || null,
    studentId: row.student_id,
    coachId: row.coach_id || null,
    recordedByUserId: row.recorded_by_user_id || null,
    recordedByName: row.recorded_by_name || 'Pelatih',

    testId: row.test_id,
    testName: testDef?.testName || row.test_name || row.test_id,
    shortName: testDef?.shortName || row.test_id,
    indicatorId: row.indicator_id,
    indicatorName: row.indicator_name || testDef?.indicatorName || row.indicator_id,
    categoryId: row.category_id || testDef?.categoryId || 'physical',
    developmentTier: row.development_tier || null,
    positionCode: row.position_code || null,

    testDate: row.test_date,
    inputSchemaType: row.input_schema_type,
    trials: Array.isArray(row.trials) ? row.trials : [],
    auxiliaryInputs: row.auxiliary_inputs && typeof row.auxiliary_inputs === 'object' ? row.auxiliary_inputs : {},

    finalRawValue: row.final_raw_value !== null && row.final_raw_value !== undefined ? Number(row.final_raw_value) : null,
    finalUnit: row.final_unit,
    finalDisplayValue: row.final_display_value,
    aggregationMethod: row.aggregation_method,
    derivedMetrics: row.derived_metrics && typeof row.derived_metrics === 'object' ? row.derived_metrics : {},

    attemptStatus: row.attempt_status || 'VALID',
    calibrationStatus: row.calibration_status || 'PENDING_CALIBRATION',
    mappingReadiness: testDef?.mappingReadiness || 'READY_FOR_CALIBRATION',
    convertedScore: row.converted_score !== null && row.converted_score !== undefined ? Number(row.converted_score) : null,

    notes: row.notes || '',
    surfaceCondition: row.surface_condition || 'Rumput Alami Standar',
    weatherNotes: row.weather_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Mengecek apakah error dari Supabase disebabkan oleh tabel `athlete_test_results`
 * yang belum dimigrasikan pada database remote atau sesi demo tanpa koneksi DB.
 */
function isUnmigratedTableOrOfflineError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error.details || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes('athlete_test_results') ||
    msg.includes('relation') ||
    msg.includes('schema cache') ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  );
}

/**
 * Menyimpan hasil pengukuran tes lapangan mentah untuk seorang atlet.
 *
 * @param {Object} authContext - Konteks sesi aktif ({ tenantId, id, fullName, role })
 * @param {Object} entryPayload - Data hasil tes dari form
 */
export async function saveAthleteTestResult(authContext, entryPayload) {
  // 1. Verifikasi keras isolasi tenant
  const verifiedTenantId = verifyAndResolveTenantId(authContext, entryPayload?.tenantId || entryPayload?.tenant_id);

  // 2. Validasi atribut wajib atlet
  const studentId = entryPayload?.studentId || entryPayload?.student_id;
  if (!studentId || String(studentId).trim() === '') {
    throw new Error('ID Atlet (studentId) wajib disertakan sebelum menyimpan hasil tes.');
  }

  // 3. Validasi apakah objek student (jika disertakan untuk pemeriksaan silang) berasal dari tenant yang sama
  if (
    entryPayload?.studentTenantId &&
    String(entryPayload.studentTenantId).trim() !== '' &&
    String(entryPayload.studentTenantId).trim() !== verifiedTenantId
  ) {
    const err = new Error(
      `Pelanggaran Isolasi Multi-Tenant (42501): Atlet milik tenant "${entryPayload.studentTenantId}" tidak dapat dicatat oleh sesi tenant "${verifiedTenantId}".`
    );
    err.code = '42501';
    throw err;
  }

  // 4. Jalankan validasi ketat dan perhitungan nilai akhir mentah
  const validation = validateAndComputeTestBatteryEntry(entryPayload);
  if (!validation.isValid) {
    const err = new Error(validation.errors[0] || 'Data hasil tes tidak memenuhi syarat validitas.');
    err.validationErrors = validation.errors;
    err.fieldErrors = validation.fieldErrors;
    throw err;
  }

  const norm = validation.normalizedRecord;
  const nowIso = new Date().toISOString();
  const generatedId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `atr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const dbRow = {
    id: generatedId,
    tenant_id: verifiedTenantId,
    academy_id: entryPayload.academyId || null,
    class_id: entryPayload.classId || null,
    student_id: String(studentId).trim(),
    coach_id: entryPayload.coachId || null,
    recorded_by_user_id: authContext?.id || null,
    recorded_by_name: entryPayload.recordedByName || authContext?.fullName || authContext?.email || 'Pelatih SSB',

    test_id: norm.testId,
    indicator_id: norm.indicatorId,
    indicator_name: norm.indicatorName,
    category_id: norm.categoryId,
    development_tier: entryPayload.developmentTier || null,
    position_code: entryPayload.positionCode || null,

    test_date: norm.testDate,
    input_schema_type: norm.inputSchemaType,
    trials: norm.trials,
    auxiliary_inputs: norm.auxiliaryInputs,

    final_raw_value: norm.finalRawValue,
    final_unit: norm.finalUnit,
    final_display_value: norm.finalDisplayValue,
    aggregation_method: norm.aggregationMethod,
    derived_metrics: norm.derivedMetrics,

    attempt_status: norm.attemptStatus,
    calibration_status: 'PENDING_CALIBRATION',
    converted_score: null,

    notes: typeof entryPayload.notes === 'string' ? entryPayload.notes.trim() : '',
    surface_condition: typeof entryPayload.surfaceCondition === 'string' && entryPayload.surfaceCondition.trim()
      ? entryPayload.surfaceCondition.trim()
      : 'Rumput Alami Standar',
    weather_notes: typeof entryPayload.weatherNotes === 'string' ? entryPayload.weatherNotes.trim() : '',
    created_at: nowIso,
    updated_at: nowIso
  };

  // 5. Jika bukan mode demo murni, coba simpan ke tabel Supabase `athlete_test_results` terlebih dahulu
  const isDemoTenant = verifiedTenantId === 'demo-tenant-1' || Boolean(entryPayload.forceLocalStore);

  if (!isDemoTenant && supabase) {
    const { data, error } = await supabase
      .from('athlete_test_results')
      .insert([dbRow])
      .select()
      .single();

    if (!error && data) {
      // Sinkronkan juga ke cache lokal per-tenant agar pembacaan offline tetap konsisten
      const existingLocal = readTenantLocalStore(verifiedTenantId);
      writeTenantLocalStore(verifiedTenantId, [data, ...existingLocal.filter((r) => r.id !== data.id)]);
      return mapTestResultRowToModel(data);
    }

    if (error && !isUnmigratedTableOrOfflineError(error)) {
      throw error;
    }
  }

  // 6. Simpan ke penyimpanan terpartisi per-tenant (saat tabel remote belum dimigrasikan atau mode demo)
  const currentRecords = readTenantLocalStore(verifiedTenantId);
  const updatedRecords = [dbRow, ...currentRecords];
  writeTenantLocalStore(verifiedTenantId, updatedRecords);

  return mapTestResultRowToModel(dbRow);
}

/**
 * Mengambil seluruh riwayat hasil tes lapangan milik seorang atlet dalam satu tenant.
 *
 * @param {Object|string} authContext - Konteks sesi aktif atau tenantId
 * @param {string} studentId - ID atlet
 * @param {Object} options - Filter opsional ({ testId, indicatorId })
 */
export async function getAthleteTestResults(authContext, studentId, options = {}) {
  const verifiedTenantId = verifyAndResolveTenantId(authContext, options?.tenantId);
  if (!studentId) return [];

  const cleanStudentId = String(studentId).trim();
  const isDemoTenant = verifiedTenantId === 'demo-tenant-1' || Boolean(options?.forceLocalStore);

  let remoteRows = [];
  if (!isDemoTenant && supabase) {
    let query = supabase
      .from('athlete_test_results')
      .select('*')
      .eq('tenant_id', verifiedTenantId)
      .eq('student_id', cleanStudentId)
      .order('test_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options.testId) {
      query = query.eq('test_id', options.testId);
    }
    if (options.indicatorId) {
      query = query.eq('indicator_id', options.indicatorId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      remoteRows = data;
    } else if (error && !isUnmigratedTableOrOfflineError(error)) {
      throw error;
    }
  }

  const localRows = readTenantLocalStore(verifiedTenantId).filter((row) => {
    if (row.tenant_id !== verifiedTenantId) return false;
    if (String(row.student_id) !== cleanStudentId) return false;
    if (options.testId && row.test_id !== options.testId) return false;
    if (options.indicatorId && row.indicator_id !== options.indicatorId) return false;
    return true;
  });

  // Gabungkan berdasarkan ID unik dan urutkan dari tanggal terbaru
  const mergedById = new Map();
  [...remoteRows, ...localRows].forEach((row) => {
    if (row && row.id && row.tenant_id === verifiedTenantId) {
      mergedById.set(row.id, row);
    }
  });

  const sortedRows = Array.from(mergedById.values()).sort((a, b) => {
    const dateCompare = String(b.test_date || '').localeCompare(String(a.test_date || ''));
    if (dateCompare !== 0) return dateCompare;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

  return sortedRows.map(mapTestResultRowToModel);
}

/**
 * Mengambil hasil tes terbaru per canonical indicator_id untuk seorang atlet
 * (digunakan untuk menampilkan badge hasil pengukuran terakhir di Katalog Tes maupun Rapor Atlet).
 */
export async function getLatestTestResultsByIndicatorMap(authContext, studentId, options = {}) {
  const allResults = await getAthleteTestResults(authContext, studentId, options);
  const latestMap = {};

  allResults.forEach((record) => {
    if (!latestMap[record.indicatorId]) {
      latestMap[record.indicatorId] = record;
    }
  });

  return latestMap;
}

/**
 * Menghapus satu riwayat hasil tes atlet (hanya untuk tenant yang sama)
 */
export async function deleteAthleteTestResult(authContext, resultId, options = {}) {
  const verifiedTenantId = verifyAndResolveTenantId(authContext, options?.tenantId);
  if (!resultId) {
    throw new Error('ID hasil tes wajib disertakan untuk penghapusan.');
  }

  const isDemoTenant = verifiedTenantId === 'demo-tenant-1' || Boolean(options?.forceLocalStore);

  if (!isDemoTenant && supabase) {
    const { error } = await supabase
      .from('athlete_test_results')
      .delete()
      .eq('id', resultId)
      .eq('tenant_id', verifiedTenantId);

    if (error && !isUnmigratedTableOrOfflineError(error)) {
      throw error;
    }
  }

  const existingLocal = readTenantLocalStore(verifiedTenantId);
  const targetInLocal = existingLocal.find((r) => r.id === resultId);
  if (existingLocal.length > 0 && !targetInLocal && isDemoTenant) {
    const err = new Error('Data hasil tes tidak ditemukan pada tenant aktif atau akses lintas-tenant ditolak.');
    err.code = '42501';
    throw err;
  }

  writeTenantLocalStore(
    verifiedTenantId,
    existingLocal.filter((r) => r.id !== resultId)
  );

  return { success: true, deletedId: resultId };
}
