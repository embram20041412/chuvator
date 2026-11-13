/**
 * CHUVATOR — MULTI-TENANT ASSESSMENT BATTERY STORAGE SERVICE (TASK 03.1 HARDENED)
 * Mengelola penyimpanan dan pembacaan hasil pengukuran tes lapangan mentah
 * pada tabel `public.athlete_test_results` dengan prinsip:
 *
 * 1. SUPABASE SEBAGAI SATU-SATUNYA JALUR PENYIMPANAN TENANT RIIL:
 *    - Untuk seluruh pengguna tenant riil (`tenantId !== 'demo-tenant-1'`), seluruh
 *      operasi simpan, baca, dan hapus dieksekusi langsung ke Supabase PostgreSQL.
 *    - TIDAK ADA pengalihan otomatis (silent fallback) ke `localStorage` apabila
 *      tabel belum tersedia (`42P01` / `PGRST205`), RLS menolak (`42501`), atau jaringan gagal.
 *    - Kegagalan database selalu menghasilkan error eksplisit dan TIDAK PERNAH
 *      mengembalikan status sukses palsu.
 *
 * 2. PEMISAHAN KETAT MODE DEMO / PRATINJAU:
 *    - `localStorage` hanya boleh digunakan pada sesi demo pratinjau yang teridentifikasi
 *      secara eksplisit (`tenantId === 'demo-tenant-1'` dengan penanda sesi demo).
 *    - Data demo dan data tenant riil terpisah 100% dan tidak pernah digabungkan.
 *
 * 3. KEAMANAN MULTI-TENANT & KONTEKS OPERASIONAL TENANT:
 *    - Fasilitas Assessment Battery hanya tersedia dalam konteks operasional tenant
 *      (Owner, Admin, Pelatih/Coach untuk tulis; Staf/Kasir hanya baca sesuai RLS).
 *    - Akun Superadmin / Platform Owner diblokir dari penggunaan operasional fitur ini.
 *    - Memvalidasi kesesuaian `tenant_id`, kepemilikan `student_id` terhadap `tenant_id`,
 *      dan cakupan kelas pelatih (coach scope).
 */

import { supabase } from '../config/supabase.js';
import { validateAndComputeTestBatteryEntry } from '../utils/testBatteryValidator.js';
import { getTestDefinitionById } from '../config/footballTestBatteryCatalog.js';

export const EXPLICIT_DEMO_TENANT_ID = 'demo-tenant-1';
const DEMO_LOCAL_STORE_KEY = 'chuvator_demo_only_test_results_v1::demo-tenant-1';

// Penyimpanan in-memory khusus untuk pengujian unit mode demo di lingkungan Node.js
const demoMemoryStore = new Map();

const ALLOWED_WRITE_ROLES = new Set(['owner', 'admin', 'administrator', 'coach', 'pelatih']);
const ALLOWED_READ_ROLES = new Set(['owner', 'admin', 'administrator', 'coach', 'pelatih', 'staff', 'staf', 'kasir', 'cashier']);

/**
 * Mengecek secara ketat apakah sesi saat ini adalah Mode Demo / Pratinjau eksplisit.
 * Mode Demo HANYA berlaku jika:
 * 1. tenant_id adalah 'demo-tenant-1', DAN
 * 2. Konteks autentikasi secara eksplisit merupakan profil demo ('demo-tenant-admin' / isDemoMode: true)
 *    atau URL pratinjau lokal memuat parameter `?autostart=1` atau `?demo=1`.
 *
 * Tenant riil TIDAK PERNAH dianggap sebagai mode demo dalam kondisi apa pun.
 */
export function isExplicitDemoSession(authContext, resolvedTenantId = null) {
  const tid =
    resolvedTenantId ||
    authContext?.tenantId ||
    authContext?.tenant_id ||
    authContext?.tenant?.id ||
    (typeof authContext === 'string' ? authContext : null);

  if (!tid || String(tid).trim() !== EXPLICIT_DEMO_TENANT_ID) {
    return false;
  }

  if (typeof authContext === 'object' && authContext !== null) {
    if (authContext.isDemoMode === false) return false;
    if (
      authContext.isDemoMode === true ||
      authContext.uid === 'demo-tenant-admin' ||
      authContext.id === 'demo-tenant-admin' ||
      authContext.email === 'manager@chuasport.com'
    ) {
      return true;
    }
  }

  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('autostart') === '1' || params.get('demo') === '1') {
      return true;
    }
  }

  return false;
}

/**
 * Membaca daftar record HANYA dari ruang penyimpanan demo ('demo-tenant-1')
 */
function readDemoOnlyLocalStore() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DEMO_LOCAL_STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((row) => row && row.tenant_id === EXPLICIT_DEMO_TENANT_ID);
    }
  } catch {
    // Fallback ke demoMemoryStore pada environment tanpa window.localStorage
  }

  const memRows = demoMemoryStore.get(DEMO_LOCAL_STORE_KEY) || [];
  return memRows.filter((row) => row && row.tenant_id === EXPLICIT_DEMO_TENANT_ID);
}

/**
 * Menulis daftar record HANYA ke ruang penyimpanan demo ('demo-tenant-1')
 */
function writeDemoOnlyLocalStore(records) {
  const safeRecords = (Array.isArray(records) ? records : []).filter(
    (row) => row && row.tenant_id === EXPLICIT_DEMO_TENANT_ID
  );

  demoMemoryStore.set(DEMO_LOCAL_STORE_KEY, safeRecords);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEMO_LOCAL_STORE_KEY, JSON.stringify(safeRecords));
    }
  } catch {
    // Abaikan error kuota di browser; demoMemoryStore tetap sinkron
  }
}

/**
 * Membersihkan ruang penyimpanan lokal khusus mode demo
 */
export function clearTenantLocalTestBatteryStore(tenantId = EXPLICIT_DEMO_TENANT_ID) {
  if (tenantId === EXPLICIT_DEMO_TENANT_ID) {
    demoMemoryStore.delete(DEMO_LOCAL_STORE_KEY);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(DEMO_LOCAL_STORE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Memverifikasi dan menurunkan tenant_id serta peran dari konteks pengguna aktif.
 * - Menolak penggunaan operasional oleh Superadmin / Platform Owner (42501).
 * - Menolak setiap ketidakcocokan tenant_id antara sesi dan payload (42501).
 * - Memeriksa hak akses baca/tulis berdasarkan peran anggota tenant.
 */
export function verifyAndResolveTenantId(authContext, requestedTenantId = null, options = {}) {
  if (!authContext) {
    const err = new Error('Akses ditolak (42501): Sesi pengguna tidak ditemukan. Silakan login kembali.');
    err.code = '42501';
    throw err;
  }

  // 1. Blokir penggunaan oleh Platform Superadmin / Platform Owner
  if (typeof authContext === 'object') {
    const rawRole = String(authContext.role || '').toLowerCase().trim();
    if (
      rawRole === 'superadmin' ||
      authContext.isSuperAdmin === true ||
      authContext.isSuperadmin === true
    ) {
      const err = new Error(
        'Akses ditolak (42501): Fasilitas Assessment Battery hanya tersedia dalam konteks operasional tenant akademi, bukan untuk akun Superadmin / Platform Owner.'
      );
      err.code = '42501';
      throw err;
    }

    // 2. Periksa hak akses peran (RBAC) jika role tersedia pada authContext
    if (rawRole) {
      if (options.requireWritePermission && !ALLOWED_WRITE_ROLES.has(rawRole)) {
        const err = new Error(
          `Akses ditolak (42501): Peran "${authContext.role}" tidak memiliki izin untuk menyimpan atau menghapus hasil tes lapangan.`
        );
        err.code = '42501';
        throw err;
      }
      if (!ALLOWED_READ_ROLES.has(rawRole)) {
        const err = new Error(
          `Akses ditolak (42501): Peran "${authContext.role}" tidak memiliki akses ke modul Assessment Battery.`
        );
        err.code = '42501';
        throw err;
      }
    }
  }

  const sessionTenantId =
    authContext?.tenantId ||
    authContext?.tenant_id ||
    authContext?.tenant?.id ||
    (typeof authContext === 'string' ? authContext : null);

  if (!sessionTenantId || typeof sessionTenantId !== 'string' || sessionTenantId.trim() === '') {
    const err = new Error('Akses ditolak (42501): Konteks tenant_id dari sesi autentikasi aktif tidak ditemukan.');
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
      `Pelanggaran Isolasi Multi-Tenant (42501): Tidak diizinkan mengakses atau memodifikasi data milik tenant "${requestedTenantId}" dari sesi tenant "${cleanSessionTenant}".`
    );
    err.code = '42501';
    throw err;
  }

  return cleanSessionTenant;
}

/**
 * Memverifikasi cakupan hak akses pelatih (Coach Scope) terhadap siswa/kelas yang dikelolanya
 */
export function verifyCoachStudentScope(authContext, targetPayload, verifiedTenantId) {
  if (!authContext || typeof authContext !== 'object') return;

  // Pastikan studentTenantId (jika ada pada objek siswa) identik dengan verifiedTenantId
  const studentTenant =
    targetPayload?.studentTenantId ||
    targetPayload?.student?.tenantId ||
    targetPayload?.student?.tenant_id;

  if (studentTenant && String(studentTenant).trim() !== '' && String(studentTenant).trim() !== verifiedTenantId) {
    const err = new Error(
      `Pelanggaran Isolasi Multi-Tenant (42501): Atlet milik tenant "${studentTenant}" tidak dapat diakses oleh sesi tenant "${verifiedTenantId}".`
    );
    err.code = '42501';
    throw err;
  }

  const rawRole = String(authContext.role || '').toLowerCase().trim();
  if (rawRole !== 'coach' && rawRole !== 'pelatih') {
    return;
  }

  // Jika pelatih memiliki batas academyId spesifik pada profilnya atau dari useUserAccessScope
  const coachAcademyId =
    authContext.coachAcademyId ||
    authContext.coachProfile?.academy_id ||
    authContext.coachProfile?.academyId;
  const allowedAcademyIds = Array.isArray(authContext.allowedAcademyIds)
    ? authContext.allowedAcademyIds
    : coachAcademyId
      ? [coachAcademyId]
      : null;

  const targetAcademyId =
    targetPayload?.academyId ||
    targetPayload?.student?.academyId ||
    targetPayload?.student?.academy_id;

  if (Array.isArray(allowedAcademyIds) && allowedAcademyIds.length > 0 && targetAcademyId) {
    const allowedAcademySet = new Set(allowedAcademyIds.map((id) => String(id).trim()));
    if (!allowedAcademySet.has(String(targetAcademyId).trim())) {
      const err = new Error(
        'Akses ditolak (42501): Pelatih tidak memiliki wewenang atas atlet di luar akademi yang dikelolanya.'
      );
      err.code = '42501';
      throw err;
    }
  }

  // Jika pelatih memiliki daftar kelas yang ditugaskan secara eksplisit (allowedClassIds / assignedClassIds)
  const rawClassList = Array.isArray(authContext.allowedClassIds)
    ? authContext.allowedClassIds
    : Array.isArray(authContext.assignedClassIds)
      ? authContext.assignedClassIds
      : null;

  if (Array.isArray(rawClassList) && rawClassList.length > 0) {
    const targetClassId =
      targetPayload?.classId ||
      targetPayload?.student?.classId ||
      targetPayload?.student?.class_id;
    if (targetClassId) {
      const allowedSet = new Set(rawClassList.map((id) => String(id).trim()));
      if (!allowedSet.has(String(targetClassId).trim())) {
        const err = new Error(
          'Akses ditolak (42501): Pelatih hanya dapat mencatat atau memodifikasi hasil tes untuk atlet pada kelas yang dikelolanya.'
        );
        err.code = '42501';
        throw err;
      }
    }
  }
}

/**
 * Menerjemahkan error Supabase/PostgreSQL menjadi pesan kegagalan yang jujur, jelas,
 * dan tidak pernah menyembunyikan kegagalan penyimpanan.
 */
export function formatDatabasePersistenceError(error, actionLabel = 'memproses data tes') {
  const code = String(error?.code || 'DB_ERROR');
  const rawMessage = String(error?.message || error?.details || 'Terjadi kesalahan komunikasi database.');
  const lowerMsg = rawMessage.toLowerCase();

  let friendlyMessage;

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    (lowerMsg.includes('athlete_test_results') &&
      (lowerMsg.includes('does not exist') || lowerMsg.includes('schema cache') || lowerMsg.includes('not find')))
  ) {
    friendlyMessage =
      `Gagal ${actionLabel}: Tabel database "public.athlete_test_results" belum tersedia di Supabase (${code}). ` +
      'Data TIDAK disimpan ke penyimpanan lokal untuk menjaga keandalan data produksi. ' +
      'Silakan minta Administrator Database menjalankan migrasi phase_task03_athlete_test_battery_migration.sql.';
  } else if (code === '42501' || lowerMsg.includes('row-level security') || lowerMsg.includes('permission denied')) {
    friendlyMessage =
      `Akses ditolak oleh kebijakan keamanan database (RLS 42501) saat ${actionLabel}: ` +
      'Pastikan Anda masuk sebagai anggota resmi tenant pemilik atlet ini dan memiliki hak akses yang sesuai. Data TIDAK disimpan.';
  } else {
    friendlyMessage = `Gagal ${actionLabel} pada database Supabase (${code}): ${rawMessage}. Data TIDAK disimpan.`;
  }

  const wrapped = new Error(friendlyMessage);
  wrapped.code = code;
  wrapped.originalError = error;
  wrapped.isPersistenceFailure = true;
  return wrapped;
}

/**
 * Memetakan baris database/store (`snake_case`) menjadi objek aplikasi (`camelCase`)
 */
export function mapTestResultRowToModel(row, persistenceSource = 'SUPABASE_DB') {
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
    updatedAt: row.updated_at,
    persistenceSource
  };
}

/**
 * Menyimpan hasil pengukuran tes lapangan mentah untuk seorang atlet.
 *
 * - Untuk pengguna tenant riil: Wajib tersimpan di tabel Supabase `public.athlete_test_results`.
 *   Jika gagal, langsung melempar error tanpa menyimpan ke localStorage.
 * - Untuk mode demo eksplisit (`demo-tenant-1`): Disimpan di penyimpanan lokal khusus demo.
 *
 * @param {Object} authContext - Konteks sesi aktif ({ tenantId, id, uid, fullName, role, isDemoMode })
 * @param {Object} entryPayload - Data hasil tes dari form
 * @param {Object} options - Opsi tambahan (mis. `{ supabaseClient }` untuk dependency injection pada pengujian)
 */
export async function saveAthleteTestResult(authContext, entryPayload, options = {}) {
  // 1. Verifikasi keras isolasi tenant & izin tulis
  const verifiedTenantId = verifyAndResolveTenantId(
    authContext,
    entryPayload?.tenantId || entryPayload?.tenant_id,
    { requireWritePermission: true }
  );

  // 2. Validasi atribut wajib atlet
  const studentId = entryPayload?.studentId || entryPayload?.student_id;
  if (!studentId || String(studentId).trim() === '') {
    throw new Error('ID Atlet (studentId) wajib disertakan sebelum menyimpan hasil tes.');
  }

  // 3. Validasi hubungan student_id dengan tenant_id & cakupan pelatih (coach scope)
  verifyCoachStudentScope(authContext, entryPayload, verifiedTenantId);

  // 4. Jalankan validasi ketat dan perhitungan nilai akhir mentah (tanpa mutasi input mentah)
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
    coach_id: entryPayload.coachId || authContext?.coachId || null,
    recorded_by_user_id: authContext?.uid || authContext?.id || null,
    recorded_by_name:
      entryPayload.recordedByName ||
      authContext?.fullName ||
      authContext?.displayName ||
      authContext?.email ||
      'Pelatih SSB',

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
    surface_condition:
      typeof entryPayload.surfaceCondition === 'string' && entryPayload.surfaceCondition.trim()
        ? entryPayload.surfaceCondition.trim()
        : 'Rumput Alami Standar',
    weather_notes: typeof entryPayload.weatherNotes === 'string' ? entryPayload.weatherNotes.trim() : '',
    created_at: nowIso,
    updated_at: nowIso
  };

  // 5. CEK MODE: Apakah sesi ini adalah Mode Demo Pratinjau yang eksplisit?
  const isDemoMode = isExplicitDemoSession(authContext, verifiedTenantId);

  if (isDemoMode) {
    const currentDemoRecords = readDemoOnlyLocalStore();
    writeDemoOnlyLocalStore([dbRow, ...currentDemoRecords]);
    return mapTestResultRowToModel(dbRow, 'DEMO_LOCAL_STORAGE');
  }

  // 6. MODE TENANT RIIL: WAJIB SIMPAN KE SUPABASE (TANPA FALLBACK LOCALSTORAGE)
  const dbClient = options.supabaseClient || supabase;
  if (!dbClient) {
    throw formatDatabasePersistenceError(
      { code: 'NO_SUPABASE_CLIENT', message: 'Klien database Supabase tidak terinisialisasi.' },
      'menyimpan hasil pengukuran tes'
    );
  }

  // Jika opsi verifikasi kepemilikan student di database diaktifkan atau tabel students tersedia pada dbClient
  if (options.verifyStudentOwnershipInDb === true && typeof dbClient.from === 'function') {
    const { data: studentRow, error: studentErr } = await dbClient
      .from('students')
      .select('id, tenant_id, class_id, academy_id')
      .eq('id', dbRow.student_id)
      .maybeSingle();

    if (studentErr) {
      throw formatDatabasePersistenceError(studentErr, 'memverifikasi kepemilikan atlet');
    }
    if (!studentRow || String(studentRow.tenant_id).trim() !== verifiedTenantId) {
      const err = new Error(
        `Pelanggaran Isolasi Multi-Tenant (42501): Atlet "${dbRow.student_id}" tidak terdaftar pada tenant "${verifiedTenantId}".`
      );
      err.code = '42501';
      throw err;
    }
  }

  const { data, error } = await dbClient
    .from('athlete_test_results')
    .insert([dbRow])
    .select()
    .single();

  if (error || !data) {
    throw formatDatabasePersistenceError(
      error || { code: 'EMPTY_INSERT_RESPONSE', message: 'Database tidak mengembalikan baris yang disimpan.' },
      'menyimpan hasil pengukuran tes'
    );
  }

  return mapTestResultRowToModel(data, 'SUPABASE_DB');
}

/**
 * Mengambil seluruh riwayat hasil tes lapangan milik seorang atlet.
 *
 * - Untuk pengguna tenant riil: Membaca HANYA dari tabel Supabase `public.athlete_test_results`.
 *   Tidak pernah menggabungkan dengan localStorage dan melempar error jika database gagal.
 * - Untuk mode demo eksplisit (`demo-tenant-1`): Membaca dari penyimpanan lokal khusus demo.
 */
export async function getAthleteTestResults(authContext, studentId, options = {}) {
  const verifiedTenantId = verifyAndResolveTenantId(authContext, options?.tenantId, {
    requireWritePermission: false
  });
  if (!studentId) return [];

  verifyCoachStudentScope(authContext, options, verifiedTenantId);

  const cleanStudentId = String(studentId).trim();
  const isDemoMode = isExplicitDemoSession(authContext, verifiedTenantId);

  if (isDemoMode) {
    const demoRows = readDemoOnlyLocalStore().filter((row) => {
      if (row.tenant_id !== EXPLICIT_DEMO_TENANT_ID) return false;
      if (String(row.student_id) !== cleanStudentId) return false;
      if (options.testId && row.test_id !== options.testId) return false;
      if (options.indicatorId && row.indicator_id !== options.indicatorId) return false;
      return true;
    });

    const sortedDemo = demoRows.sort((a, b) => {
      const dateCompare = String(b.test_date || '').localeCompare(String(a.test_date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

    return sortedDemo.map((r) => mapTestResultRowToModel(r, 'DEMO_LOCAL_STORAGE'));
  }

  // MODE TENANT RIIL: HANYA BACA DARI SUPABASE
  const dbClient = options.supabaseClient || supabase;
  if (!dbClient) {
    throw formatDatabasePersistenceError(
      { code: 'NO_SUPABASE_CLIENT', message: 'Klien database Supabase tidak terinisialisasi.' },
      'memuat riwayat hasil tes'
    );
  }

  let query = dbClient
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
  if (error) {
    throw formatDatabasePersistenceError(error, 'memuat riwayat hasil tes');
  }

  const safeRows = (Array.isArray(data) ? data : []).filter(
    (row) => row && String(row.tenant_id).trim() === verifiedTenantId && String(row.student_id).trim() === cleanStudentId
  );

  return safeRows.map((r) => mapTestResultRowToModel(r, 'SUPABASE_DB'));
}

/**
 * Mengambil hasil tes terbaru per canonical indicator_id untuk seorang atlet
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
 * Menghapus satu riwayat hasil tes atlet (hanya untuk tenant yang sama dengan hak akses tulis)
 */
export async function deleteAthleteTestResult(authContext, resultId, options = {}) {
  const verifiedTenantId = verifyAndResolveTenantId(authContext, options?.tenantId, {
    requireWritePermission: true
  });
  if (!resultId) {
    throw new Error('ID hasil tes wajib disertakan untuk penghapusan.');
  }

  verifyCoachStudentScope(authContext, options, verifiedTenantId);

  const isDemoMode = isExplicitDemoSession(authContext, verifiedTenantId);

  if (isDemoMode) {
    const existingDemo = readDemoOnlyLocalStore();
    const targetInDemo = existingDemo.find((r) => r.id === resultId && r.tenant_id === EXPLICIT_DEMO_TENANT_ID);
    if (!targetInDemo) {
      const err = new Error('Data hasil tes tidak ditemukan pada sesi demo atau akses ditolak.');
      err.code = '42501';
      throw err;
    }

    writeDemoOnlyLocalStore(existingDemo.filter((r) => r.id !== resultId));
    return { success: true, deletedId: resultId, persistenceSource: 'DEMO_LOCAL_STORAGE' };
  }

  // MODE TENANT RIIL: HAPUS LANGSUNG DI SUPABASE
  const dbClient = options.supabaseClient || supabase;
  if (!dbClient) {
    throw formatDatabasePersistenceError(
      { code: 'NO_SUPABASE_CLIENT', message: 'Klien database Supabase tidak terinisialisasi.' },
      'menghapus hasil tes'
    );
  }

  const { data, error } = await dbClient
    .from('athlete_test_results')
    .delete()
    .eq('id', resultId)
    .eq('tenant_id', verifiedTenantId)
    .select('id');

  if (error) {
    throw formatDatabasePersistenceError(error, 'menghapus hasil tes');
  }

  if (!Array.isArray(data) || data.length === 0) {
    const err = new Error(
      'Penghapusan gagal (42501): Data hasil tes tidak ditemukan pada tenant ini atau akses ditolak oleh kebijakan RLS.'
    );
    err.code = '42501';
    throw err;
  }

  return { success: true, deletedId: resultId, persistenceSource: 'SUPABASE_DB' };
}
