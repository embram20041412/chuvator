import { supabase } from '../config/supabase';

/**
 * =========================================================================
 * SUPABASE ACADEMY SERVICE (POSTGRESQL MULTI-TENANT ARCHITECTURE)
 * =========================================================================
 * Layanan komunikasi data berbasis relational database Supabase.
 * Mengelola academies, academy_classes, coaches, students, academy_evaluations,
 * dan academy_attendance dengan mapping data 100% konsisten (camelCase <-> snake_case).
 */

// -------------------------------------------------------------------------
// HELPER NORMALISASI UUID & TANGGAL (ANTI ERROR POSTGRESQL 22P02)
// -------------------------------------------------------------------------

export const toUuidOrNull = (val) => {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
};

export const toDateOrNull = (val) => (val && String(val).trim() !== '' ? String(val).trim() : null);

// -------------------------------------------------------------------------
// DATA MAPPING HELPERS (SNAKE_CASE <-> CAMEL_CASE)
// -------------------------------------------------------------------------

export function mapAcademyFromSupabase(row) {
  if (!row) return null;
  const rawName = row.name || row.academy_name || '';
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    name: rawName,
    academyName: rawName,
    category: row.category || 'racket',
    categoryLabel: row.category_label || row.categoryLabel || '',
    sportCategory: row.sport_category || row.sportCategory || '',
    sport: row.sport || '',
    description: row.description || '',
    logoUrl: row.logo_url || row.logoUrl || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapClassFromSupabase(row) {
  if (!row) return null;
  const rawClassName = row.class_name || row.name || '';
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    academyId: toUuidOrNull(row.academy_id),
    academyName: row.academy_name || '',
    className: rawClassName,
    name: rawClassName,
    sport: row.sport || 'General',
    coachId: toUuidOrNull(row.coach_id),
    coachName: row.coach_name || '',
    minAge: row.min_age !== null && row.min_age !== undefined ? Number(row.min_age) : 6,
    maxAge: row.max_age !== null && row.max_age !== undefined ? Number(row.max_age) : 99,
    maxQuota: row.max_quota ? Number(row.max_quota) : 20,
    tierCode: row.tier_code || 'ALL_AGE',
    tierLabel: row.tier_label || 'Umum / Lintas Usia',
    schedule: typeof row.schedule === 'string' ? row.schedule : (Array.isArray(row.schedules) ? row.schedules.join(', ') : ''),
    schedules: Array.isArray(row.schedules) ? row.schedules : (Array.isArray(row.schedule) ? row.schedule : []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapCoachFromSupabase(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    academyId: row.academy_id || toUuidOrNull(row.academy_id) || null,
    academyName: row.academy_name || '',
    name: row.name || row.coach_name || '',
    coachName: row.coach_name || row.name || '',
    nickname: row.nickname || '',
    nik: row.nik || '',
    phone: row.phone || '',
    email: row.email || '',
    sportSpecialty: row.sport_specialty || row.sport || '',
    sport: row.sport || row.sport_specialty || '',
    sportCategory: row.sport_category || row.sportCategory || '',
    license: row.license || '',
    photoUrl: row.photo_url || row.photoUrl || '',
    address: typeof row.address === 'object' && row.address !== null
      ? row.address
      : {
          province: row.province || '',
          city: row.city || row.regency || '',
          district: row.district || '',
          village: row.village || '',
          detail: row.address_detail || row.address || ''
        },
    status: row.status || 'Aktif',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapStudentFromSupabase(row) {
  if (!row) return null;
  const rawStudentName = row.student_name || row.name || '';
  return {
    ...row,
    id: row.id,
    tenantId: row.tenant_id,
    studentName: rawStudentName,
    name: rawStudentName,
    birthDate: toDateOrNull(row.birth_date),
    nikKk: row.nik_kk || '',
    schoolOrigin: row.school_origin || '',
    academyId: toUuidOrNull(row.academy_id),
    academyName: row.academy_name || '',
    classId: toUuidOrNull(row.class_id),
    className: row.class_name || (row.academy_classes?.class_name) || '',
    coachName: row.coach_name || (row.academy_classes?.coach_name) || '',
    sportCategory: row.sport_category || '',
    playerRole: row.player_role || 'All-Rounder',
    position: row.player_role || 'All-Rounder',
    parentName: row.parent_name || '',
    parentPhone: row.parent_phone || row.phone || '',
    phone: row.phone || row.parent_phone || row.contact_phone || '',
    contactPhone: row.contact_phone || row.parent_phone || row.phone || '',
    province: row.province || '',
    regency: row.regency || '',
    district: row.district || '',
    village: row.village || '',
    addressDetail: row.address_detail || '',
    joinDate: toDateOrNull(row.join_date),
    registrationFee: Number(row.registration_fee || 0),
    registrationFeePaid: Boolean(row.registration_fee_paid ?? row.is_registration_fee_paid),
    isRegistrationFeePaid: Boolean(row.is_registration_fee_paid ?? row.registration_fee_paid),
    registrationFeePaidAt: row.registration_fee_paid_at || null,
    monthlyFee: Number(row.monthly_fee || 350000),
    paymentStatus: row.payment_status || (row.spp_status === 'Lunas' ? 'lunas' : 'belum lunas'),
    sppStatus: row.spp_status || 'Belum Lunas',
    lastPaidMonth: row.last_paid_month || null,
    lastPaidDate: toDateOrNull(row.last_paid_date),
    lastSppPaidAt: toDateOrNull(row.last_spp_paid_at) || toDateOrNull(row.last_paid_date) || null,
    height: row.height !== null && row.height !== undefined ? Number(row.height) : null,
    weight: row.weight !== null && row.weight !== undefined ? Number(row.weight) : null,
    photoUrl: row.photo_url || null,
    tournaments: Array.isArray(row.tournaments) ? row.tournaments : [],
    growthHistory: Array.isArray(row.growth_history) ? row.growth_history : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
    classId: toUuidOrNull(row.class_id),
    studentId: toUuidOrNull(row.student_id),
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
// 1. WORKSPACE AKADEMI (academies)
// -------------------------------------------------------------------------

export async function getAcademies(tenantId) {
  if (!tenantId) return [];
  try {
    const { data, error } = await supabase
      .from('academies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      console.warn('[Supabase getAcademies Error]:', error);
      return [];
    }
    return (data || []).map(mapAcademyFromSupabase);
  } catch (err) {
    console.warn('[Supabase getAcademies Catch]:', err);
    return [];
  }
}

export async function createAcademy({
  tenantId,
  name,
  academyName,
  category,
  categoryLabel,
  sportCategory,
  sport,
  description,
  logoUrl
}) {
  const finalName = (name || academyName || '').trim();
  const payload = {
    tenant_id: tenantId,
    name: finalName,
    academy_name: finalName,
    category: category || 'racket',
    category_label: categoryLabel || '',
    sport_category: sportCategory || '',
    sport: sport || '',
    description: description || '',
    logo_url: logoUrl || '',
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('academies')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return mapAcademyFromSupabase(data);
  } catch (err) {
    console.warn('[Supabase createAcademy]: fallback object used', err);
    return mapAcademyFromSupabase({
      id: `acad_${Date.now()}`,
      ...payload
    });
  }
}

export async function updateAcademy(academyId, payload) {
  if (!academyId) throw new Error('Academy ID wajib disertakan.');
  const mapped = {};
  if (payload.name !== undefined) {
    mapped.name = payload.name.trim();
    mapped.academy_name = payload.name.trim();
  } else if (payload.academyName !== undefined) {
    mapped.name = payload.academyName.trim();
    mapped.academy_name = payload.academyName.trim();
  }
  if (payload.category !== undefined) mapped.category = payload.category;
  if (payload.categoryLabel !== undefined) mapped.category_label = payload.categoryLabel;
  if (payload.sportCategory !== undefined) mapped.sport_category = payload.sportCategory;
  if (payload.sport !== undefined) mapped.sport = payload.sport;
  if (payload.description !== undefined) mapped.description = payload.description;
  if (payload.logoUrl !== undefined) mapped.logo_url = payload.logoUrl;
  mapped.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('academies')
    .update(mapped)
    .eq('id', academyId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[Supabase updateAcademy Error]:', error);
    throw error;
  }
  return mapAcademyFromSupabase(data || { id: academyId, ...payload });
}

export async function deleteAcademy(academyId) {
  if (!academyId) return true;
  const { error } = await supabase
    .from('academies')
    .delete()
    .eq('id', academyId);

  if (error) {
    console.error('[Supabase deleteAcademy Error]:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------------------
// 2. KELAS AKADEMI (academy_classes)
// -------------------------------------------------------------------------

export async function getClasses(tenantId, academyId = null) {
  if (!tenantId) return [];

  let query = supabase
    .from('academy_classes')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('class_name', { ascending: true });

  const safeAcademyId = toUuidOrNull(academyId);
  if (safeAcademyId) {
    query = query.eq('academy_id', safeAcademyId);
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
  academyName,
  className,
  name,
  sport,
  coachId,
  coachName,
  minAge,
  maxAge,
  maxQuota,
  tierCode,
  tierLabel,
  schedule,
  schedules
}) {
  const finalClassName = (className || name || '').trim();
  const safeAcademyId = toUuidOrNull(academyId);
  const safeCoachId = toUuidOrNull(coachId);
  const safeScheduleStr = typeof schedule === 'string'
    ? schedule
    : (Array.isArray(schedules) ? schedules.join(', ') : '');
  const safeSchedulesArr = Array.isArray(schedules)
    ? schedules
    : (Array.isArray(schedule) ? schedule : []);

  const payload = {
    tenant_id: tenantId,
    academy_id: safeAcademyId,
    academy_name: academyName || '',
    class_name: finalClassName,
    sport: sport || 'General',
    coach_id: safeCoachId,
    coach_name: coachName || 'Pelatih Utama',
    min_age: minAge !== undefined && minAge !== '' && minAge !== null ? Number(minAge) : 6,
    max_age: maxAge !== undefined && maxAge !== '' && maxAge !== null ? Number(maxAge) : 99,
    max_quota: maxQuota ? Number(maxQuota) : 20,
    tier_code: tierCode || 'ALL_AGE',
    tier_label: tierLabel || 'Umum / Lintas Usia',
    schedule: safeScheduleStr,
    schedules: safeSchedulesArr,
    created_at: new Date().toISOString()
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
  return mapClassFromSupabase(data);
}

export async function updateClass(classId, updatePayload) {
  if (!classId) throw new Error('Class ID wajib disertakan.');
  const mapped = {};
  if (updatePayload.className !== undefined || updatePayload.name !== undefined) {
    mapped.class_name = (updatePayload.className || updatePayload.name || '').trim();
  }
  if (updatePayload.sport !== undefined) mapped.sport = updatePayload.sport;
  if (updatePayload.coachId !== undefined) {
    mapped.coach_id = toUuidOrNull(updatePayload.coachId);
  }
  if (updatePayload.coachName !== undefined) mapped.coach_name = updatePayload.coachName;
  if (updatePayload.academyId !== undefined) {
    mapped.academy_id = toUuidOrNull(updatePayload.academyId);
  }
  if (updatePayload.academyName !== undefined) mapped.academy_name = updatePayload.academyName;
  if (updatePayload.minAge !== undefined) {
    mapped.min_age = updatePayload.minAge !== '' && updatePayload.minAge !== null ? Number(updatePayload.minAge) : 6;
  }
  if (updatePayload.maxAge !== undefined) {
    mapped.max_age = updatePayload.maxAge !== '' && updatePayload.maxAge !== null ? Number(updatePayload.maxAge) : 99;
  }
  if (updatePayload.maxQuota !== undefined) mapped.max_quota = Number(updatePayload.maxQuota) || 20;
  if (updatePayload.tierCode !== undefined) mapped.tier_code = updatePayload.tierCode;
  if (updatePayload.tierLabel !== undefined) mapped.tier_label = updatePayload.tierLabel;
  if (updatePayload.schedule !== undefined) {
    mapped.schedule = typeof updatePayload.schedule === 'string'
      ? updatePayload.schedule
      : (Array.isArray(updatePayload.schedule) ? updatePayload.schedule.join(', ') : '');
  }
  if (updatePayload.schedules !== undefined) {
    mapped.schedules = Array.isArray(updatePayload.schedules) ? updatePayload.schedules : [];
  }
  mapped.updated_at = new Date().toISOString();

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
  if (!classId) return true;
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
// 3. PELATIH (COACHES)
// -------------------------------------------------------------------------

export async function getCoaches(tenantId, academyId = null) {
  if (!tenantId) return [];
  try {
    let query = supabase
      .from('coaches')
      .select('*')
      .eq('tenant_id', tenantId);

    const safeAcademyId = academyId ? String(academyId).trim() : null;
    if (safeAcademyId) query = query.eq('academy_id', safeAcademyId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.warn('[Supabase getCoaches Error]:', error);
      return [];
    }
    return (data || []).map(mapCoachFromSupabase);
  } catch (err) {
    console.warn('[Supabase getCoaches Catch]:', err);
    return [];
  }
}

export async function createCoach({
  tenantId,
  academyId,
  academyName,
  name,
  nickname,
  nik,
  phone,
  email,
  sport,
  sportSpecialty,
  sportCategory,
  license,
  photoUrl,
  address,
  status
}) {
  const safeAcademyId = academyId ? String(academyId).trim() : null;
  const payload = {
    tenant_id: tenantId,
    academy_id: safeAcademyId,
    academy_name: academyName || '',
    name: (name || '').trim(),
    coach_name: (name || '').trim(),
    nickname: (nickname || '').trim(),
    nik: (nik || '').trim(),
    phone: (phone || '').trim(),
    email: (email || '').trim(),
    sport: sport || sportSpecialty || '',
    sport_specialty: sportSpecialty || sport || '',
    sport_category: sportCategory || '',
    license: license || '',
    photo_url: photoUrl || '',
    address: address || {},
    status: status || 'Aktif',
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('coaches')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return mapCoachFromSupabase(data);
  } catch (err) {
    console.warn('[Supabase createCoach fallback]:', err);
    return mapCoachFromSupabase({
      id: `coach_${Date.now()}`,
      ...payload
    });
  }
}

export async function updateCoach(coachId, payload) {
  if (!coachId) throw new Error('Coach ID wajib disertakan.');
  const mapped = {};
  if (payload.academyId !== undefined) {
    mapped.academy_id = toUuidOrNull(payload.academyId);
  }
  if (payload.academyName !== undefined) mapped.academy_name = payload.academyName;
  if (payload.name !== undefined) mapped.name = payload.name.trim();
  if (payload.nickname !== undefined) mapped.nickname = payload.nickname.trim();
  if (payload.nik !== undefined) mapped.nik = payload.nik.trim();
  if (payload.phone !== undefined) mapped.phone = payload.phone.trim();
  if (payload.email !== undefined) mapped.email = payload.email.trim();
  if (payload.sport !== undefined || payload.sportSpecialty !== undefined) {
    mapped.sport = payload.sport || payload.sportSpecialty || '';
    mapped.sport_specialty = payload.sportSpecialty || payload.sport || '';
  }
  if (payload.sportCategory !== undefined) mapped.sport_category = payload.sportCategory;
  if (payload.license !== undefined) mapped.license = payload.license;
  if (payload.photoUrl !== undefined) mapped.photo_url = payload.photoUrl;
  if (payload.address !== undefined) mapped.address = payload.address;
  if (payload.status !== undefined) mapped.status = payload.status;
  mapped.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('coaches')
      .update(mapped)
      .eq('id', coachId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return mapCoachFromSupabase(data || { id: coachId, ...payload });
  } catch (err) {
    console.warn('[Supabase updateCoach warning]:', err);
    return mapCoachFromSupabase({ id: coachId, ...payload });
  }
}

export async function deleteCoach(coachId) {
  if (!coachId) return true;
  const { error } = await supabase
    .from('coaches')
    .delete()
    .eq('id', coachId);

  if (error) {
    console.error('[Supabase deleteCoach Error]:', error);
    throw error;
  }
  return true;
}

// -------------------------------------------------------------------------
// 4. SISWA AKADEMI (students)
// -------------------------------------------------------------------------

export async function getStudents(tenantId, academyId = null, classId = null) {
  if (!tenantId) return [];

  // PENTING: Gunakan select('*') tanpa FK join academy_classes(...)
  // agar query tidak error jika class_id bertipe TEXT tanpa FK constraint
  let query = supabase
    .from('students')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('student_name', { ascending: true });

  const safeAcademyId = toUuidOrNull(academyId);
  if (safeAcademyId) {
    query = query.eq('academy_id', safeAcademyId);
  }
  const safeClassId = toUuidOrNull(classId);
  if (safeClassId) {
    query = query.eq('class_id', safeClassId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase getStudents Error]:', error);
    return [];
  }
  return (data || []).map(mapStudentFromSupabase);
}

export async function createStudent(payload) {
  const safeAcademyId = toUuidOrNull(payload.academyId);
  const safeClassId = toUuidOrNull(payload.classId);
  const safeBirthDate = toDateOrNull(payload.birthDate);
  const finalStudentName = (payload.studentName || payload.name || '').trim();

  const dbPayload = {
    tenant_id: payload.tenantId,
    student_name: finalStudentName,
    birth_date: safeBirthDate,
    nik_kk: (payload.nikKk || '').trim(),
    school_origin: (payload.schoolOrigin || '').trim(),
    academy_id: safeAcademyId,
    academy_name: payload.academyName || '',
    class_id: safeClassId,
    class_name: payload.className || '',
    coach_name: payload.coachName || '',
    sport_category: payload.sportCategory || 'General',
    player_role: payload.playerRole || payload.position || 'All-Rounder',
    parent_name: (payload.parentName || '').trim(),
    parent_phone: (payload.parentPhone || payload.phone || '').trim(),
    phone: (payload.phone || payload.parentPhone || payload.contactPhone || '').trim(),
    contact_phone: (payload.contactPhone || payload.parentPhone || payload.phone || '').trim(),
    province: payload.province || '',
    regency: payload.regency || '',
    district: payload.district || '',
    village: payload.village || '',
    address_detail: payload.addressDetail || '',
    join_date: toDateOrNull(payload.joinDate) || new Date().toISOString().split('T')[0],
    registration_fee: payload.registrationFee !== undefined ? Number(payload.registrationFee) : 0,
    registration_fee_paid: Boolean(payload.registrationFeePaid ?? payload.isRegistrationFeePaid),
    is_registration_fee_paid: Boolean(payload.isRegistrationFeePaid ?? payload.registrationFeePaid),
    registration_fee_paid_at: payload.registrationFeePaidAt || null,
    monthly_fee: payload.monthlyFee !== undefined ? Number(payload.monthlyFee) : 350000,
    payment_status: payload.paymentStatus || 'belum lunas',
    spp_status: payload.sppStatus || 'Belum Lunas',
    last_paid_month: payload.lastPaidMonth || null,
    last_paid_date: toDateOrNull(payload.lastPaidDate),
    last_spp_paid_at: toDateOrNull(payload.lastSppPaidAt) || toDateOrNull(payload.lastPaidDate) || null,
    height: payload.height ? Number(payload.height) : null,
    weight: payload.weight ? Number(payload.weight) : null,
    photo_url: payload.photoUrl || null,
    tournaments: Array.isArray(payload.tournaments) ? payload.tournaments : [],
    growth_history: Array.isArray(payload.growthHistory) ? payload.growthHistory : [],
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('students')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error('[Supabase createStudent Error]:', error);
    throw error;
  }
  return mapStudentFromSupabase(data);
}

export async function updateStudent(studentId, updateFields) {
  if (!studentId) throw new Error('Student ID wajib disertakan.');
  const mapped = {};

  if (updateFields.studentName !== undefined) mapped.student_name = (updateFields.studentName || '').trim();
  if (updateFields.name !== undefined && updateFields.studentName === undefined) mapped.student_name = (updateFields.name || '').trim();
  if (updateFields.birthDate !== undefined) {
    mapped.birth_date = toDateOrNull(updateFields.birthDate);
  }
  if (updateFields.nikKk !== undefined) mapped.nik_kk = (updateFields.nikKk || '').trim();
  if (updateFields.schoolOrigin !== undefined) mapped.school_origin = (updateFields.schoolOrigin || '').trim();
  if (updateFields.academyId !== undefined) {
    mapped.academy_id = toUuidOrNull(updateFields.academyId);
  }
  if (updateFields.academyName !== undefined) mapped.academy_name = updateFields.academyName;
  if (updateFields.classId !== undefined) {
    mapped.class_id = toUuidOrNull(updateFields.classId);
  }
  if (updateFields.className !== undefined) mapped.class_name = updateFields.className;
  if (updateFields.coachName !== undefined) mapped.coach_name = updateFields.coachName;
  if (updateFields.sportCategory !== undefined) mapped.sport_category = updateFields.sportCategory;
  if (updateFields.playerRole !== undefined) mapped.player_role = updateFields.playerRole;
  if (updateFields.position !== undefined && updateFields.playerRole === undefined) mapped.player_role = updateFields.position;
  if (updateFields.parentName !== undefined) mapped.parent_name = (updateFields.parentName || '').trim();
  if (updateFields.parentPhone !== undefined) mapped.parent_phone = (updateFields.parentPhone || '').trim();
  if (updateFields.phone !== undefined) mapped.phone = (updateFields.phone || '').trim();
  if (updateFields.contactPhone !== undefined) mapped.contact_phone = (updateFields.contactPhone || '').trim();
  if (updateFields.province !== undefined) mapped.province = updateFields.province;
  if (updateFields.regency !== undefined) mapped.regency = updateFields.regency;
  if (updateFields.district !== undefined) mapped.district = updateFields.district;
  if (updateFields.village !== undefined) mapped.village = updateFields.village;
  if (updateFields.addressDetail !== undefined) mapped.address_detail = updateFields.addressDetail;
  if (updateFields.joinDate !== undefined) mapped.join_date = toDateOrNull(updateFields.joinDate);
  if (updateFields.registrationFee !== undefined) mapped.registration_fee = Number(updateFields.registrationFee);
  if (updateFields.registrationFeePaid !== undefined) {
    mapped.registration_fee_paid = Boolean(updateFields.registrationFeePaid);
    mapped.is_registration_fee_paid = Boolean(updateFields.registrationFeePaid);
  }
  if (updateFields.isRegistrationFeePaid !== undefined) {
    mapped.is_registration_fee_paid = Boolean(updateFields.isRegistrationFeePaid);
    mapped.registration_fee_paid = Boolean(updateFields.isRegistrationFeePaid);
  }
  if (updateFields.registrationFeePaidAt !== undefined) mapped.registration_fee_paid_at = updateFields.registrationFeePaidAt;
  if (updateFields.monthlyFee !== undefined) mapped.monthly_fee = Number(updateFields.monthlyFee);
  if (updateFields.paymentStatus !== undefined) mapped.payment_status = updateFields.paymentStatus;
  if (updateFields.sppStatus !== undefined) mapped.spp_status = updateFields.sppStatus;
  if (updateFields.lastPaidMonth !== undefined) mapped.last_paid_month = updateFields.lastPaidMonth;
  if (updateFields.lastPaidDate !== undefined) mapped.last_paid_date = toDateOrNull(updateFields.lastPaidDate);
  if (updateFields.lastSppPaidAt !== undefined) mapped.last_spp_paid_at = toDateOrNull(updateFields.lastSppPaidAt);
  if (updateFields.height !== undefined) mapped.height = updateFields.height ? Number(updateFields.height) : null;
  if (updateFields.weight !== undefined) mapped.weight = updateFields.weight ? Number(updateFields.weight) : null;
  if (updateFields.photoUrl !== undefined) mapped.photo_url = updateFields.photoUrl;
  if (updateFields.tournaments !== undefined) mapped.tournaments = updateFields.tournaments;
  if (updateFields.growthHistory !== undefined) mapped.growth_history = updateFields.growthHistory;
  mapped.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('students')
    .update(mapped)
    .eq('id', studentId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase updateStudent Error]:', error);
    throw error;
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
      height: height ? Number(height) : null,
      weight: weight ? Number(weight) : null,
      growth_history: updatedHistory,
      updated_at: new Date().toISOString()
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
  if (!studentId) return true;
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
// 5. EVALUASI ATLET (academy_evaluations)
// -------------------------------------------------------------------------

export async function getEvaluationsByClass(tenantId, classId, limitCount = 100) {
  if (!tenantId || !classId) return [];

  const safeClassId = toUuidOrNull(classId) || classId;
  const { data, error } = await supabase
    .from('academy_evaluations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('class_id', safeClassId)
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
  const classId = toUuidOrNull(payload.classId || payload.class_id);
  const studentId = toUuidOrNull(payload.studentId || payload.student_id);
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
    evaluator: evaluator,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('academy_evaluations')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('[Supabase createEvaluation Error]:', error);
    throw error;
  }

  // Update student role/tier if provided
  if (studentId && (payload.playerRole || payload.position)) {
    try {
      await supabase
        .from('students')
        .update({ player_role: payload.playerRole || payload.position, updated_at: new Date().toISOString() })
        .eq('id', studentId);
    } catch (e) {
      console.warn('Update student role warning:', e);
    }
  }

  return mapEvaluationFromSupabase(data, payload);
}

export async function deleteEvaluation(evaluationId) {
  if (!evaluationId) return true;
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
// 6. PRESENSI ATLET (academy_attendance)
// -------------------------------------------------------------------------

export async function getAttendance(tenantId, classId, date = null) {
  if (!tenantId) return [];

  let query = supabase
    .from('academy_attendance')
    .select('*')
    .eq('tenant_id', tenantId);

  const safeClassId = toUuidOrNull(classId) || classId;
  if (safeClassId) query = query.eq('class_id', safeClassId);
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

  const safeClassId = toUuidOrNull(classId);
  const rows = attendanceRecords.map((r) => ({
    tenant_id: tenantId,
    class_id: safeClassId,
    student_id: toUuidOrNull(r.studentId),
    date: toDateOrNull(date) || new Date().toISOString().split('T')[0],
    status: r.status || 'Hadir',
    created_at: new Date().toISOString()
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
    academy_id: toUuidOrNull(academyId),
    class_id: toUuidOrNull(classId),
    date: toDateOrNull(date) || new Date().toISOString().split('T')[0],
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

// Aliases for backwards compatibility
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
export const getSupabaseCoaches = getCoaches;
export const createSupabaseCoach = createCoach;
export const updateSupabaseCoach = updateCoach;
export const deleteSupabaseCoach = deleteCoach;
export const getSupabaseAcademies = getAcademies;
export const createSupabaseAcademy = createAcademy;
export const updateSupabaseAcademy = updateAcademy;
export const deleteSupabaseAcademy = deleteAcademy;

const supabaseAcademyService = {
  getAcademies,
  createAcademy,
  updateAcademy,
  deleteAcademy,
  mapAcademyFromSupabase,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  mapClassFromSupabase,
  getCoaches,
  createCoach,
  updateCoach,
  deleteCoach,
  mapCoachFromSupabase,
  getStudents,
  createStudent,
  updateStudent,
  updateStudentGrowth,
  deleteStudent,
  mapStudentFromSupabase,
  getEvaluationsByClass,
  createEvaluation,
  deleteEvaluation,
  mapEvaluationFromSupabase,
  getAttendance,
  recordAttendanceBatch,
  recordAttendanceSession,
  deleteAttendanceSession,
  toUuidOrNull,
  toDateOrNull
};

export default supabaseAcademyService;
