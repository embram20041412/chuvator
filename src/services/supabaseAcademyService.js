import { supabase } from '../config/supabase';

/**
 * =========================================================================
 * SUPABASE ACADEMY SERVICE (POSTGRESQL MULTI-TENANT ARCHITECTURE)
 * =========================================================================
 * Layanan komunikasi data berbasis relational database Supabase.
 * Mengelola academy_classes, students, academy_evaluations, dan academy_attendance.
 */

// -------------------------------------------------------------------------
// DATA MAPPING HELPERS (SNAKE_CASE <-> CAMEL_CASE)
// -------------------------------------------------------------------------

export function mapClassFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    academyId: row.academy_id,
    className: row.class_name,
    sport: row.sport,
    coachName: row.coach_name,
    createdAt: row.created_at,
    schedule: row.schedule || '',
    maxQuota: row.max_quota || 20,
    tierCode: row.tier_code || 'ALL_AGE',
    tierLabel: row.tier_label || 'Umum / Lintas Usia'
  };
}

export function mapStudentFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    academyId: row.academy_id,
    classId: row.class_id,
    studentName: row.student_name,
    name: row.student_name,
    birthDate: row.birth_date,
    playerRole: row.player_role,
    position: row.player_role,
    sportCategory: row.sport_category,
    sppStatus: row.spp_status,
    createdAt: row.created_at,
    className: row.academy_classes?.class_name || row.class_name || '',
    coachName: row.academy_classes?.coach_name || row.coach_name || '',
    phone: row.phone || row.parent_phone || '',
    parentPhone: row.parent_phone || row.phone || '',
    parentName: row.parent_name || '',
    monthlyFee: row.monthly_fee || 350000,
    lastPaidMonth: row.last_paid_month || null
  };
}

export function mapEvaluationFromSupabase(row, extra = {}) {
  if (!row) return null;
  const createdAtStr = row.created_at || new Date().toISOString();
  const dateStr = extra.date || (createdAtStr ? createdAtStr.split('T')[0] : new Date().toISOString().split('T')[0]);

  return {
    ...extra,
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    classId: row.class_id,
    studentId: row.student_id,
    activeTier: row.active_tier,
    overallScore: row.overall_score,
    pillarScores: row.pillar_scores || {},
    scores: row.scores || {},
    coachNote: row.coach_note || row.notes || '',
    evaluator: row.evaluator || 'Pelatih',
    createdAt: row.created_at,
    date: dateStr,
    studentName: extra.studentName || row.students?.student_name || row.student_name || 'Siswa',
    playerRole: extra.playerRole || row.students?.player_role || row.player_role || '',
    specialization: extra.specialization || row.specialization || 'N/A',
    styleCode: extra.styleCode || row.style_code || 'N/A',
    className: extra.className || row.academy_classes?.class_name || row.class_name || '',
    sport: extra.sport || row.academy_classes?.sport || row.sport || ''
  };
}

// -------------------------------------------------------------------------
// 1. KELAS AKADEMI (academy_classes)
// -------------------------------------------------------------------------

export async function getClasses(tenantId, academyId = null) {
  if (!tenantId) return [];

  let query = supabase
    .from('academy_classes')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('class_name', { ascending: true });

  if (academyId) {
    query = query.eq('academy_id', academyId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase getClasses Error]:', error);
    return [];
  }
  return (data || []).map(mapClassFromSupabase);
}

export async function createClass({
  tenantId,
  academyId,
  className,
  sport,
  coachName,
  tierCode,
  tierLabel
}) {
  const payload = {
    tenant_id: tenantId,
    academy_id: academyId || null,
    class_name: className,
    sport: sport || 'General',
    coach_name: coachName || 'Pelatih Utama'
  };

  const { data, error } = await supabase
    .from('academy_classes')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('[Supabase createClass Error]:', error);
    throw error;
  }
  return mapClassFromSupabase({ ...data, tierCode, tierLabel });
}

export async function updateClass(classId, updatePayload) {
  const mapped = {};
  if (updatePayload.className !== undefined) mapped.class_name = updatePayload.className;
  if (updatePayload.sport !== undefined) mapped.sport = updatePayload.sport;
  if (updatePayload.coachName !== undefined) mapped.coach_name = updatePayload.coachName;
  if (updatePayload.academyId !== undefined) mapped.academy_id = updatePayload.academyId;

  const { data, error } = await supabase
    .from('academy_classes')
    .update(mapped)
    .eq('id', classId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase updateClass Error]:', error);
    throw error;
  }
  return mapClassFromSupabase(data);
}

export async function deleteClass(classId) {
  const { error } = await supabase
    .from('academy_classes')
    .delete()
    .eq('id', classId);

  if (error) {
    console.error('[Supabase deleteClass Error]:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------------------
// 2. SISWA AKADEMI (students)
// -------------------------------------------------------------------------

export async function getStudents(tenantId, academyId = null, classId = null) {
  if (!tenantId) return [];

  let query = supabase
    .from('students')
    .select('*, academy_classes(class_name, sport, coach_name)')
    .eq('tenant_id', tenantId)
    .order('student_name', { ascending: true });

  if (academyId) {
    query = query.eq('academy_id', academyId);
  }
  if (classId) {
    query = query.eq('class_id', classId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase getStudents Error]:', error);
    return [];
  }
  return (data || []).map(mapStudentFromSupabase);
}

export async function createStudent({
  tenantId,
  academyId,
  classId,
  studentName,
  birthDate,
  playerRole,
  sportCategory,
  sppStatus = 'BELUM LUNAS'
}) {
  const payload = {
    tenant_id: tenantId,
    academy_id: academyId || null,
    class_id: classId || null,
    student_name: studentName,
    birth_date: birthDate || null,
    player_role: playerRole || 'All-Rounder',
    sport_category: sportCategory || 'General',
    spp_status: sppStatus
  };

  const { data, error } = await supabase
    .from('students')
    .insert([payload])
    .select('*, academy_classes(class_name, sport, coach_name)')
    .single();

  if (error) {
    console.error('[Supabase createStudent Error]:', error);
    throw error;
  }
  return mapStudentFromSupabase(data);
}

export async function updateStudent(studentId, updateFields) {
  const mapped = {};
  if (updateFields.studentName !== undefined) mapped.student_name = updateFields.studentName;
  if (updateFields.birthDate !== undefined) mapped.birth_date = updateFields.birthDate;
  if (updateFields.playerRole !== undefined) mapped.player_role = updateFields.playerRole;
  if (updateFields.sportCategory !== undefined) mapped.sport_category = updateFields.sportCategory;
  if (updateFields.sppStatus !== undefined) mapped.spp_status = updateFields.sppStatus;
  if (updateFields.classId !== undefined) mapped.class_id = updateFields.classId;
  if (updateFields.paymentStatus !== undefined) mapped.payment_status = updateFields.paymentStatus;
  if (updateFields.lastPaidMonth !== undefined) mapped.last_paid_month = updateFields.lastPaidMonth;
  if (updateFields.height !== undefined) mapped.height = Number(updateFields.height);
  if (updateFields.weight !== undefined) mapped.weight = Number(updateFields.weight);
  if (updateFields.growthHistory !== undefined) mapped.growth_history = updateFields.growthHistory;
  if (updateFields.photoUrl !== undefined) mapped.photo_url = updateFields.photoUrl;

  const { data, error } = await supabase
    .from('students')
    .update(mapped)
    .eq('id', studentId)
    .select('*, academy_classes(class_name, sport, coach_name)')
    .single();

  if (error) {
    console.error('[Supabase updateStudent Error]:', error);
    return { id: studentId, ...updateFields };
  }
  return mapStudentFromSupabase(data);
}

export async function updateStudentGrowth(studentId, { height, weight, growthEntry }) {
  if (!studentId) return;
  const { data: currentStudent } = await supabase
    .from('students')
    .select('growth_history')
    .eq('id', studentId)
    .maybeSingle();

  const currentHistory = currentStudent?.growth_history || [];
  const updatedHistory = growthEntry ? [...currentHistory, growthEntry] : currentHistory;

  const { data, error } = await supabase
    .from('students')
    .update({
      height: Number(height),
      weight: Number(weight),
      growth_history: updatedHistory
    })
    .eq('id', studentId)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[Supabase updateStudentGrowth warning]:', error);
  }
  return data;
}

export async function deleteStudent(studentId) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', studentId);

  if (error) {
    console.error('[Supabase deleteStudent Error]:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------------------
// 3. EVALUASI ATLET (academy_evaluations)
// -------------------------------------------------------------------------

export async function getEvaluationsByClass(tenantId, classId, limitCount = 100) {
  if (!tenantId || !classId) return [];

  const { data, error } = await supabase
    .from('academy_evaluations')
    .select('*, students(student_name, player_role, birth_date), academy_classes(class_name, sport)')
    .eq('tenant_id', tenantId)
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.error('[Supabase getEvaluationsByClass Error]:', error);
    return [];
  }
  return (data || []).map((row) => mapEvaluationFromSupabase(row));
}

export async function createEvaluation(payload) {
  const tenantId = payload.tenantId || payload.tenant_id;
  const classId = payload.classId || payload.class_id;
  const studentId = payload.studentId || payload.student_id;
  const activeTier = payload.activeTier ?? payload.active_tier ?? 1;
  const overallScore = payload.overallScore ?? payload.overall_score ?? 0;
  const pillarScores = payload.pillarScores || payload.pillar_scores || payload.categoryScores || {};
  const scores = payload.scores || {};
  const coachNote = payload.coachNote || payload.coach_note || payload.notes || '';
  const evaluator = payload.evaluator || payload.evaluatorName || 'Pelatih';

  const insertPayload = {
    tenant_id: tenantId,
    class_id: classId,
    student_id: studentId,
    active_tier: Number(activeTier) || 1,
    overall_score: Number(overallScore) || 0,
    pillar_scores: pillarScores,
    scores: scores,
    coach_note: coachNote,
    evaluator: evaluator
  };

  const { data, error } = await supabase
    .from('academy_evaluations')
    .insert([insertPayload])
    .select('*, students(student_name, player_role, birth_date), academy_classes(class_name, sport)')
    .single();

  if (error) {
    console.error('[Supabase createEvaluation Error]:', error);
    throw error;
  }

  // Update student role/tier if provided
  if (payload.playerRole || payload.position) {
    try {
      await supabase
        .from('students')
        .update({ player_role: payload.playerRole || payload.position })
        .eq('id', studentId);
    } catch (e) {
      console.warn('Update student role warning:', e);
    }
  }

  return mapEvaluationFromSupabase(data, payload);
}

export async function deleteEvaluation(evaluationId) {
  const { error } = await supabase
    .from('academy_evaluations')
    .delete()
    .eq('id', evaluationId);

  if (error) {
    console.error('[Supabase deleteEvaluation Error]:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------------------
// 4. PRESENSI ATLET (academy_attendance)
// -------------------------------------------------------------------------

export async function getAttendance(tenantId, classId, date = null) {
  if (!tenantId) return [];

  let query = supabase
    .from('academy_attendance')
    .select('*, students(student_name)')
    .eq('tenant_id', tenantId);

  if (classId) query = query.eq('class_id', classId);
  if (date) query = query.eq('date', date);

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase getAttendance Error]:', error);
    return [];
  }
  return data || [];
}

export async function recordAttendanceBatch({
  tenantId,
  classId,
  date,
  attendanceRecords = []
}) {
  if (!tenantId || !classId || attendanceRecords.length === 0) return [];

  const rows = attendanceRecords.map((r) => ({
    tenant_id: tenantId,
    class_id: classId,
    student_id: r.studentId,
    date: date || new Date().toISOString().split('T')[0],
    status: r.status || 'Hadir'
  }));

  const { data, error } = await supabase
    .from('academy_attendance')
    .insert(rows)
    .select();

  if (error) {
    console.error('[Supabase recordAttendanceBatch Error]:', error);
    throw error;
  }
  return data;
}

export async function recordAttendanceSession({
  tenantId,
  academyId,
  classId,
  className,
  sport,
  coachName,
  coachAttended,
  date,
  notes,
  students: recordsPayload,
  summary
}) {
  const sessionRow = {
    tenant_id: tenantId,
    academy_id: academyId || null,
    class_id: classId,
    date: date || new Date().toISOString().split('T')[0],
    coach_attended: coachAttended,
    notes: notes || '',
    students_data: recordsPayload || [],
    summary: summary || {},
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('academy_attendance')
    .insert([sessionRow])
    .select()
    .single();

  if (error) {
    console.warn('[Supabase recordAttendanceSession warning]:', error);
    return { id: `att_${Date.now()}`, ...sessionRow, students: recordsPayload };
  }

  return {
    ...data,
    id: data.id,
    date: data.date,
    coachName,
    coachAttended,
    notes: data.notes,
    students: recordsPayload,
    summary
  };
}

export async function deleteAttendanceSession(id) {
  if (!id) return;
  const { error } = await supabase
    .from('academy_attendance')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase deleteAttendanceSession Error]:', error);
    throw error;
  }
}

// -------------------------------------------------------------------------
// 5. PELATIH (COACHES) & WORKSPACE AKADEMI (ACADEMIES)
// -------------------------------------------------------------------------

export async function getCoaches(tenantId, academyId = null) {
  if (!tenantId) return [];
  try {
    let query = supabase
      .from('coaches')
      .select('*')
      .eq('tenant_id', tenantId);

    if (academyId) query = query.eq('academy_id', academyId);

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return (data || []).map((c) => ({
      ...c,
      id: c.id,
      tenantId: c.tenant_id,
      academyId: c.academy_id,
      name: c.name,
      nickname: c.nickname || '',
      nik: c.nik || '',
      phone: c.phone || '',
      photoUrl: c.photo_url || '',
      sport: c.sport || c.sport_specialty || '',
      sportSpecialty: c.sport_specialty || c.sport || '',
      license: c.license || '',
      address: c.address || {}
    }));
  } catch {
    return [];
  }
}

export async function createCoach({ tenantId, academyId, name, phone, sport, photoUrl, nickname, nik, license, address }) {
  try {
    const { data, error } = await supabase
      .from('coaches')
      .insert([{
        tenant_id: tenantId,
        academy_id: academyId || null,
        name,
        nickname: nickname || '',
        nik: nik || '',
        phone: phone || '',
        photo_url: photoUrl || '',
        sport: sport || '',
        sport_specialty: sport || '',
        license: license || '',
        address: address || {}
      }])
      .select()
      .single();

    if (error) throw error;
    return { ...data, id: data.id, name: data.name, phone: data.phone, sport: data.sport };
  } catch (err) {
    console.warn('[Supabase createCoach]: table may not exist yet, using local object', err);
    return {
      id: `coach_${Date.now()}`,
      tenantId,
      academyId,
      name,
      phone: phone || '',
      sport: sport || ''
    };
  }
}

export async function updateCoach(coachId, payload) {
  try {
    const dbPayload = {
      name: payload.name,
      nickname: payload.nickname,
      nik: payload.nik,
      phone: payload.phone,
      photo_url: payload.photoUrl,
      sport: payload.sport || payload.sportSpecialty,
      sport_specialty: payload.sportSpecialty || payload.sport,
      license: payload.license,
      address: payload.address,
      updated_at: new Date().toISOString()
    };
    Object.keys(dbPayload).forEach(k => dbPayload[k] === undefined && delete dbPayload[k]);

    const { data, error } = await supabase
      .from('coaches')
      .update(dbPayload)
      .eq('id', coachId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data || { id: coachId, ...payload };
  } catch (err) {
    console.warn('[Supabase updateCoach warning]:', err);
    return { id: coachId, ...payload };
  }
}

export async function getAcademies(tenantId) {
  if (!tenantId) return [];
  try {
    const { data, error } = await supabase
      .from('academies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      return [];
    }
    return (data || []).map((a) => ({
      ...a,
      id: a.id,
      tenantId: a.tenant_id,
      name: a.name,
      category: a.category || 'racket',
      sport: a.sport || '',
      description: a.description || ''
    }));
  } catch {
    return [];
  }
}

export async function createAcademy({ tenantId, name, category, sport, description }) {
  try {
    const { data, error } = await supabase
      .from('academies')
      .insert([{
        tenant_id: tenantId,
        name,
        category: category || 'racket',
        sport: sport || '',
        description: description || ''
      }])
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      id: data.id,
      name: data.name,
      category: data.category,
      sport: data.sport,
      description: data.description
    };
  } catch (err) {
    console.warn('[Supabase createAcademy]: table may not exist yet, using local object', err);
    return {
      id: `acad_${Date.now()}`,
      tenantId,
      name,
      category: category || 'racket',
      sport: sport || '',
      description: description || ''
    };
  }
}

// Aliases for compatibility
export const getSupabaseClasses = getClasses;
export const createSupabaseClass = createClass;
export const updateSupabaseClass = updateClass;
export const deleteSupabaseClass = deleteClass;
export const getSupabaseStudents = getStudents;
export const createSupabaseStudent = createStudent;
export const updateSupabaseStudent = updateStudent;
export const deleteSupabaseStudent = deleteStudent;
export const getSupabaseEvaluations = getEvaluationsByClass;
export const createSupabaseEvaluation = createEvaluation;
export const deleteSupabaseEvaluation = deleteEvaluation;
export const getSupabaseAttendance = getAttendance;
export const recordSupabaseAttendanceBatch = recordAttendanceBatch;

const supabaseAcademyService = {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getEvaluationsByClass,
  createEvaluation,
  deleteEvaluation,
  getAttendance,
  recordAttendanceBatch,
  getCoaches,
  createCoach,
  getAcademies,
  createAcademy
};

export default supabaseAcademyService;
