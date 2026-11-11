import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Mail,
  User,
  Phone,
  CreditCard,
  X,
  ChevronRight,
  Info,
  Trash2,
  MessageSquare,
  Copy,
  ExternalLink,
  Check,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { parentService } from '../../../services/parentService';
import MobileLoadingState from '../../components/MobileLoadingState';

export const RELATIONSHIP_OPTIONS = [
  { value: 'father', label: 'Ayah (Father)' },
  { value: 'mother', label: 'Ibu (Mother)' },
  { value: 'guardian', label: 'Wali (Guardian)' },
  { value: 'other', label: 'Lainnya (Other)' }
];

/**
 * Canonical Tenant ID Resolver for CHUVATOR Mobile Admin
 * Strictly resolves from:
 * - profile.tenant.id
 * - profile.tenantId
 * - profile.tenant.tenant_id
 * NEVER falls back to userProfile.id or userProfile.uid.
 */
export function resolveTenantId(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const raw = profile.tenant?.id || profile.tenantId || profile.tenant?.tenant_id || null;
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

/**
 * Strict Fail-Closed Tenant Isolation Filter for parent records.
 * - Requires a valid non-empty activeTenantId (otherwise returns []).
 * - Requires each parent record to have a valid non-empty tenant_id or tenantId.
 * - Rejects records with null, undefined, empty string, or whitespace-only tenant ID.
 * - Rejects records whose tenant ID differs from activeTenantId.
 */
export function filterParentsByTenant(parents, activeTenantId) {
  if (!activeTenantId || !Array.isArray(parents)) return [];
  const normalizedTenant = String(activeTenantId).trim();
  if (!normalizedTenant) return [];

  return parents.filter((parent) => {
    if (!parent || typeof parent !== 'object') return false;
    const rawTenantId =
      parent.tenant_id !== undefined && parent.tenant_id !== null && String(parent.tenant_id).trim() !== ''
        ? parent.tenant_id
        : parent.tenantId;
    if (rawTenantId === null || rawTenantId === undefined) return false;
    const normalizedRecordTenant = String(rawTenantId).trim();
    if (!normalizedRecordTenant) return false;
    return normalizedRecordTenant === normalizedTenant;
  });
}

/**
 * Filter parents by search query (matches name/full_name, email, and WhatsApp phone)
 * and optional status filter.
 */
export function filterParentsList(parents, searchQuery = '', statusFilter = 'ALL') {
  if (!Array.isArray(parents)) return [];
  const q = String(searchQuery || '').trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');

  return parents.filter((parent) => {
    if (!parent || typeof parent !== 'object') return false;

    if (statusFilter && statusFilter !== 'ALL') {
      const meta = getParentInvitationStatusMeta(parent);
      if (meta.code !== statusFilter) return false;
    }

    if (!q) return true;

    const name = String(parent.name || parent.full_name || '').toLowerCase();
    const email = String(parent.email || '').toLowerCase();
    const phone = String(parent.phone || '').toLowerCase();
    const phoneDigits = phone.replace(/\D/g, '');

    const matchesName = name.includes(q);
    const matchesEmail = email.includes(q);
    const matchesPhoneRaw = phone.includes(q);
    const matchesPhoneDigits =
      qDigits.length >= 3 &&
      (phoneDigits.includes(qDigits) ||
        (qDigits.startsWith('0') && phoneDigits.includes('62' + qDigits.slice(1))));

    return matchesName || matchesEmail || matchesPhoneRaw || matchesPhoneDigits;
  });
}

/**
 * Validate 16-digit Kartu Keluarga (KK) number
 */
export function validateKKNumber(kk) {
  const raw = String(kk ?? '').trim();
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length !== 16) {
    return {
      valid: false,
      normalized: digitsOnly,
      message: 'Nomor KK harus tepat 16 digit.'
    };
  }
  return {
    valid: true,
    normalized: digitsOnly,
    message: null
  };
}

/**
 * Validate and normalize WhatsApp phone number matching existing desktop & backend rules:
 * - Strips non-digits
 * - 08... -> 628...
 * - 8...  -> 628...
 * - Length must be 10..15 digits
 * - Indonesian numbers starting with 62 must start with 628
 */
export function validateAndNormalizeParentPhone(phone) {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return {
      valid: false,
      normalized: '',
      message: 'Nomor WhatsApp wajib diisi.'
    };
  }

  const cleanedPhone = phone.trim().replace(/\D/g, '');
  if (!cleanedPhone) {
    return {
      valid: false,
      normalized: '',
      message: 'Nomor WhatsApp tidak valid. Masukkan nomor seluler yang valid (contoh: 08123456789).'
    };
  }

  let normalizedPhone = cleanedPhone;
  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '62' + normalizedPhone.slice(1);
  } else if (normalizedPhone.startsWith('8')) {
    normalizedPhone = '62' + normalizedPhone;
  }

  if (
    normalizedPhone.length < 10 ||
    normalizedPhone.length > 15 ||
    (normalizedPhone.startsWith('62') && !normalizedPhone.startsWith('628'))
  ) {
    return {
      valid: false,
      normalized: normalizedPhone,
      message: 'Nomor WhatsApp tidak valid. Masukkan nomor seluler yang valid (contoh: 08123456789).'
    };
  }

  return {
    valid: true,
    normalized: normalizedPhone,
    message: null
  };
}

/**
 * Build payload for parentService.createParentAccount(payload)
 * Strictly preserves existing API contract:
 * { name, email, phone, kk, relationship, studentIds }
 * Does NOT inject synthetic tenantId fields.
 */
export function buildCreateParentPayload({ name, email, phone, kk, relationship, studentIds }) {
  const phoneResult = validateAndNormalizeParentPhone(phone);
  const kkResult = validateKKNumber(kk);
  const validRels = ['father', 'mother', 'guardian', 'other'];
  const cleanRel = validRels.includes(relationship) ? relationship : 'guardian';
  const uniqueStudentIds = Array.isArray(studentIds)
    ? Array.from(new Set(studentIds.filter((id) => typeof id === 'string' && id.trim() !== '')))
    : [];

  return {
    name: String(name ?? '').trim(),
    email: String(email ?? '').trim(),
    phone: phoneResult.normalized,
    kk: kkResult.normalized,
    relationship: cleanRel,
    studentIds: uniqueStudentIds
  };
}

/**
 * Map parent invitation/account status to presentation metadata
 * Supports: READY_TO_SEND, SENT_MANUALLY, ACTIVATED, EXPIRED
 */
export function getParentInvitationStatusMeta(parent) {
  if (!parent || typeof parent !== 'object') {
    return {
      code: 'NOT_CREATED',
      label: 'Belum Dibuat',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      description: 'Undangan belum disiapkan'
    };
  }

  const rawStatus =
    parent.invitationStatus ||
    (parent.status === 'active'
      ? 'ACTIVATED'
      : parent.status === 'expired'
        ? 'EXPIRED'
        : 'READY_TO_SEND');

  switch (rawStatus) {
    case 'ACTIVATED':
      return {
        code: 'ACTIVATED',
        label: 'Aktif',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        description: 'Akun wali telah aktif di Parent Portal'
      };
    case 'SENT_MANUALLY':
      return {
        code: 'SENT_MANUALLY',
        label: 'Terkirim (WA)',
        badgeClass: 'bg-blue-50 text-[#2455E8] border-blue-200',
        description: 'Tautan telah dikonfirmasi dikirim via WhatsApp'
      };
    case 'EXPIRED':
      return {
        code: 'EXPIRED',
        label: 'Kedaluwarsa',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        description: 'Masa berlaku tautan undangan telah berakhir'
      };
    case 'READY_TO_SEND':
      return {
        code: 'READY_TO_SEND',
        label: 'Siap Kirim',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        description: 'Tautan siap dibagikan manual ke WhatsApp wali'
      };
      default:
        return {
          code: 'NOT_CREATED',
          label: 'Belum Dibuat',
          badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
          description: 'Undangan belum dibuat'
        };
    }
  }

export const UNAVAILABLE_STUDENT_NAME_LABEL = 'Nama siswa belum tersedia';

/**
 * Safely extract a student's full name from a student object or link record.
 * - Priority: 1. student_name (and studentName), 2. name as fallback (and full_name/fullName).
 * - NEVER uses id or student_id as a name fallback.
 * - NEVER fabricates dummy student names.
 * - Rejects strings that are raw UUIDs or equal to the record's own ID.
 * @param {any} studentRecord
 * @param {any} [explicitId]
 */
export function resolveStudentNameFromRecord(studentRecord, explicitId = null) {
  if (!studentRecord || typeof studentRecord !== 'object' || Array.isArray(studentRecord)) {
    return null;
  }

  const recordId =
    explicitId ||
    studentRecord.id ||
    studentRecord.student_id ||
    studentRecord.studentId ||
    null;
  const normalizedId = recordId ? String(recordId).trim().toLowerCase() : null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const candidates = [
    studentRecord.student_name,
    studentRecord.studentName,
    studentRecord.name,
    studentRecord.full_name,
    studentRecord.fullName
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      if (uuidRegex.test(trimmed)) continue;
      if (normalizedId && trimmed.toLowerCase() === normalizedId) continue;
      return trimmed;
    }
  }

  return null;
}

/**
 * Normalize and resolve linked students from a parent account record.
 * Supports:
 * - link.student as an object: { student: { id, student_name, name } }
 * - link.student as an array: { student: [{ id, student_name, name }, ...] }
 * - link.students as an object or array
 * - link with flattened student_name / studentName
 * - link.student === null / undefined or missing/blank name -> "Nama siswa belum tersedia"
 * - parent.links === null or parent.linksError === true -> relationLoadFailed: true
 * @param {any} parent
 */
export function resolveParentLinkedStudents(parent) {
  if (!parent || typeof parent !== 'object') {
    return {
      count: 0,
      items: [],
      hasAnyValidName: false,
      allNamesAvailable: false,
      relationLoadFailed: true
    };
  }

  const rawLinks = parent.links !== undefined ? parent.links : parent.parent_student_links;

  if (parent.linksError === true || parent.links_error === true || rawLinks === null) {
    return {
      count: 0,
      items: [],
      hasAnyValidName: false,
      allNamesAvailable: false,
      relationLoadFailed: true
    };
  }

  if (!Array.isArray(rawLinks)) {
    return {
      count: 0,
      items: [],
      hasAnyValidName: false,
      allNamesAvailable: true,
      relationLoadFailed: false
    };
  }

  const items = [];

  rawLinks.forEach((link, linkIndex) => {
    if (!link || typeof link !== 'object') {
      items.push({
        key: `link-missing-${linkIndex}`,
        studentId: null,
        name: null,
        displayName: UNAVAILABLE_STUDENT_NAME_LABEL,
        hasValidName: false,
        kkLast4: null
      });
      return;
    }

    const rawStudentRel = link.student !== undefined ? link.student : link.students;

    if (Array.isArray(rawStudentRel)) {
      if (rawStudentRel.length === 0) {
        items.push({
          key: `link-empty-arr-${linkIndex}`,
          studentId: link.student_id || link.studentId || null,
          name: null,
          displayName: UNAVAILABLE_STUDENT_NAME_LABEL,
          hasValidName: false,
          kkLast4: null
        });
      } else {
        rawStudentRel.forEach((studentItem, subIdx) => {
          const studentId =
            (studentItem && typeof studentItem === 'object'
              ? studentItem.id || studentItem.student_id || studentItem.studentId
              : null) ||
            link.student_id ||
            link.studentId ||
            null;
          const resolvedName = resolveStudentNameFromRecord(studentItem, studentId);
          const kkLast4 =
            studentItem && typeof studentItem === 'object'
              ? studentItem.kk_last4 || studentItem.kkLast4 || null
              : null;

          items.push({
            key: studentId ? `${studentId}-${linkIndex}-${subIdx}` : `link-${linkIndex}-${subIdx}`,
            studentId,
            name: resolvedName,
            displayName: resolvedName || UNAVAILABLE_STUDENT_NAME_LABEL,
            hasValidName: Boolean(resolvedName),
            kkLast4
          });
        });
      }
      return;
    }

    if (rawStudentRel && typeof rawStudentRel === 'object') {
      const studentId =
        rawStudentRel.id ||
        rawStudentRel.student_id ||
        rawStudentRel.studentId ||
        link.student_id ||
        link.studentId ||
        null;
      const resolvedName = resolveStudentNameFromRecord(rawStudentRel, studentId);
      const kkLast4 =
        rawStudentRel.kk_last4 ||
        rawStudentRel.kkLast4 ||
        link.kk_last4 ||
        link.kkLast4 ||
        null;

      items.push({
        key: studentId ? `${studentId}-${linkIndex}` : `link-${linkIndex}`,
        studentId,
        name: resolvedName,
        displayName: resolvedName || UNAVAILABLE_STUDENT_NAME_LABEL,
        hasValidName: Boolean(resolvedName),
        kkLast4
      });
      return;
    }

    // Fallback: check if link itself has flattened student_name / studentName (never link.id or link.student_id)
    const studentId = link.student_id || link.studentId || null;
    const flattenedName = resolveStudentNameFromRecord(
      {
        student_name: link.student_name,
        studentName: link.studentName
      },
      studentId
    );

    items.push({
      key: studentId ? `${studentId}-${linkIndex}` : `link-null-${linkIndex}`,
      studentId,
      name: flattenedName,
      displayName: flattenedName || UNAVAILABLE_STUDENT_NAME_LABEL,
      hasValidName: Boolean(flattenedName),
      kkLast4: link.kk_last4 || link.kkLast4 || null
    });
  });

  const hasAnyValidName = items.some((item) => item.hasValidName);
  const allNamesAvailable = items.length > 0 ? items.every((item) => item.hasValidName) : true;

  return {
    count: items.length,
    items,
    hasAnyValidName,
    allNamesAvailable,
    relationLoadFailed: false
  };
}

/**
 * Pure multi-student selection toggle helper
 */
export function toggleStudentSelection(selectedIds = [], studentId) {
  if (!studentId) return Array.isArray(selectedIds) ? [...selectedIds] : [];
  const list = Array.isArray(selectedIds) ? selectedIds : [];
  return list.includes(studentId)
    ? list.filter((item) => item !== studentId)
    : [...list, studentId];
}

/**
 * Workflow helper: Search students by 16-digit KK using existing service
 */
export async function executeSearchStudentsByKK({ tenantId, kk, service = parentService }) {
  if (!tenantId) {
    throw new Error('Konteks tenant tidak tersedia. Pencarian siswa dinonaktifkan.');
  }
  const kkCheck = validateKKNumber(kk);
  if (!kkCheck.valid) {
    throw new Error(kkCheck.message);
  }
  const result = await service.searchStudentsByKK(kkCheck.normalized);
  const students = Array.isArray(result?.data) ? result.data : [];
  return {
    normalizedKK: kkCheck.normalized,
    students,
    isEmpty: students.length === 0
  };
}

/**
 * Workflow helper: Create parent account with double-submission lock & strict validation
 */
export async function executeCreateParentWithLock({
  tenantId,
  formData,
  selectedStudentIds,
  lockRef,
  service = parentService
}) {
  if (!tenantId) {
    throw new Error('Konteks tenant tidak tersedia. Pembuatan akun dibatalkan.');
  }
  if (lockRef && lockRef.current) {
    return { skippedDuplicate: true, result: null };
  }

  const cleanName = String(formData?.name || '').trim();
  const cleanEmail = String(formData?.email || '').trim();
  if (!cleanName) {
    throw new Error('Nama lengkap wali murid wajib diisi.');
  }
  if (!cleanEmail) {
    throw new Error('Alamat email wali murid wajib diisi.');
  }

  const phoneCheck = validateAndNormalizeParentPhone(formData?.phone);
  if (!phoneCheck.valid) {
    throw new Error(phoneCheck.message);
  }

  const kkCheck = validateKKNumber(formData?.kk);
  if (!kkCheck.valid) {
    throw new Error(kkCheck.message);
  }

  if (!Array.isArray(selectedStudentIds) || selectedStudentIds.length === 0) {
    throw new Error('Minimal pilih satu siswa untuk dihubungkan.');
  }

  if (lockRef) {
    lockRef.current = true;
  }

  try {
    const payload = buildCreateParentPayload({
      name: cleanName,
      email: cleanEmail,
      phone: formData.phone,
      kk: kkCheck.normalized,
      relationship: formData.relationship,
      studentIds: selectedStudentIds
    });

    const result = await service.createParentAccount(payload);
    return { skippedDuplicate: false, payload, result };
  } finally {
    if (lockRef) {
      lockRef.current = false;
    }
  }
}

/**
 * Workflow helper: Generate WhatsApp invitation via existing service
 * Note: Generating or copying link/message does NOT mark invitation as SENT_MANUALLY.
 */
export async function executeGenerateWhatsAppInvitation({ tenantId, parentId, service = parentService }) {
  if (!tenantId) {
    throw new Error('Konteks tenant tidak tersedia.');
  }
  if (!parentId) {
    throw new Error('ID akun wali murid wajib disertakan.');
  }
  const res = await service.generateWhatsAppInvitation(parentId);
  const modalPayload = res?.data || res;
  const topStatus =
    res?.status || modalPayload?.status || (modalPayload?.isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND');
  return {
    ...modalPayload,
    status: topStatus
  };
}

/**
 * Workflow helper: Delete parent account ONLY after explicit operator confirmation
 */
export async function executeDeleteParentWithConfirmation({
  tenantId,
  parentId,
  isConfirmed = false,
  service = parentService
}) {
  if (!tenantId) {
    throw new Error('Konteks tenant tidak tersedia.');
  }
  if (!parentId) {
    throw new Error('ID akun wali murid wajib disertakan.');
  }
  if (!isConfirmed) {
    return { deleted: false };
  }
  const res = await service.deleteParentAccount(parentId);
  return { deleted: true, response: res };
}

/**
 * Clipboard helper for copying invitation link or WhatsApp message
 * @param {any} text
 * @param {any} [clipboardImpl]
 */
export async function copyTextToClipboard(text, clipboardImpl = null) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { copied: false, value: '' };
  }
  const targetClipboard =
    clipboardImpl || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
  if (targetClipboard && typeof targetClipboard.writeText === 'function') {
    await targetClipboard.writeText(text);
    return { copied: true, value: text };
  }
  return { copied: false, value: text };
}

/**
 * MobileParentManagementMain Component
 * Dedicated Mobile-First Presentation Layer for Parent Administration (/parents).
 * @param {any} props
 */
export default function MobileParentManagementMain({
  userProfile,
  serviceOverride = null,
  initialParents = null,
  initialError = null,
  initialSuccessResult = null,
  initialWhatsAppModal = null,
  initialDeleteTarget = null
}) {
  const activeService = serviceOverride || parentService;
  const tenantId = resolveTenantId(userProfile);
  const tenantName = userProfile?.tenant?.name || 'Akademi / GOR Aktif';

  // List & Fetch States
  const [parents, setParents] = useState(() =>
    Array.isArray(initialParents) ? filterParentsByTenant(initialParents, tenantId) : []
  );
  const [loading, setLoading] = useState(
    () => !Array.isArray(initialParents) && !initialError && Boolean(tenantId)
  );
  const [loadError, setLoadError] = useState(initialError);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add Parent Modal / Sheet States
  const [showAddModal, setShowAddModal] = useState(() => Boolean(initialSuccessResult));
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    kk: '',
    relationship: 'guardian'
  });
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [hasSearchedKK, setHasSearchedKK] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [formError, setFormError] = useState(null);
  const [successResult, setSuccessResult] = useState(initialSuccessResult);

  // WhatsApp Invitation Modal States
  const [activeWhatsAppModal, setActiveWhatsAppModal] = useState(initialWhatsAppModal);
  const [isGeneratingWhatsApp, setIsGeneratingWhatsApp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Delete Confirmation Modal States (replaces window.confirm on mobile)
  const [parentToDelete, setParentToDelete] = useState(initialDeleteTarget);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action feedback states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchParents = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await activeService.getParentAccounts();
      const rawList = Array.isArray(data) ? data : [];
      setParents(filterParentsByTenant(rawList, tenantId));
    } catch (err) {
      console.error('[MobileParentManagementMain] Error fetching parents:', err);
      setLoadError(err?.message || 'Gagal memuat daftar akun wali murid.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, activeService]);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    if (!Array.isArray(initialParents)) {
      fetchParents();
    }
  }, [tenantId, fetchParents, initialParents]);

  // Auto-dismiss actionMessage after 5 seconds
  useEffect(() => {
    if (!actionMessage) return undefined;
    const timer = setTimeout(() => setActionMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  const filteredParents = useMemo(() => {
    return filterParentsList(parents, searchQuery, statusFilter);
  }, [parents, searchQuery, statusFilter]);

  // Summary KPI counts
  const stats = useMemo(() => {
    let activated = 0;
    let readyOrSent = 0;
    let totalLinkedStudents = 0;

    parents.forEach((p) => {
      const meta = getParentInvitationStatusMeta(p);
      if (meta.code === 'ACTIVATED') activated += 1;
      if (meta.code === 'READY_TO_SEND' || meta.code === 'SENT_MANUALLY') readyOrSent += 1;
      totalLinkedStudents += resolveParentLinkedStudents(p).count;
    });

    return {
      total: parents.length,
      activated,
      readyOrSent,
      totalLinkedStudents
    };
  }, [parents]);

  // Search Students by 16-digit KK
  const handleSearchStudents = async () => {
    if (!tenantId) {
      setFormError('Konteks tenant tidak tersedia. Pencarian siswa dinonaktifkan.');
      return;
    }

    const kkCheck = validateKKNumber(formData.kk);
    if (!kkCheck.valid) {
      setFormError(kkCheck.message);
      return;
    }

    setFormError(null);
    setIsSearchingStudents(true);
    setHasSearchedKK(true);
    setSearchResults([]);
    setSelectedStudentIds([]);

    try {
      const result = await activeService.searchStudentsByKK(kkCheck.normalized);
      const list = Array.isArray(result?.data) ? result.data : [];
      setSearchResults(list);
      if (list.length === 0) {
        setFormError('Tidak ditemukan siswa dengan nomor KK tersebut di tenant ini.');
      }
    } catch (err) {
      setFormError(err?.message || 'Gagal mencari data siswa berdasarkan nomor KK.');
    } finally {
      setIsSearchingStudents(false);
    }
  };

  const handleToggleStudent = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((item) => item !== studentId) : [...prev, studentId]
    );
  };

  // Create Parent Account Submit Handler (with strict double-submission prevention)
  const handleSubmitCreateParent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!tenantId) {
      setFormError('Konteks tenant tidak tersedia. Pembuatan akun dibatalkan.');
      return;
    }

    if (isSubmitting || submitLockRef.current) {
      return;
    }

    const cleanName = String(formData.name || '').trim();
    const cleanEmail = String(formData.email || '').trim();

    if (!cleanName) {
      setFormError('Nama lengkap wali murid wajib diisi.');
      return;
    }
    if (!cleanEmail) {
      setFormError('Alamat email wali murid wajib diisi.');
      return;
    }

    const phoneCheck = validateAndNormalizeParentPhone(formData.phone);
    if (!phoneCheck.valid) {
      setFormError(phoneCheck.message);
      return;
    }

    const kkCheck = validateKKNumber(formData.kk);
    if (!kkCheck.valid) {
      setFormError(kkCheck.message);
      return;
    }

    if (selectedStudentIds.length === 0) {
      setFormError('Minimal pilih satu siswa untuk dihubungkan.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    submitLockRef.current = true;

    try {
      const payload = buildCreateParentPayload({
        name: cleanName,
        email: cleanEmail,
        phone: formData.phone,
        kk: kkCheck.normalized,
        relationship: formData.relationship,
        studentIds: selectedStudentIds
      });

      const result = await activeService.createParentAccount(payload);
      setSuccessResult(result);
      setCopiedLink(false);
      setCopiedMessage(false);
      await fetchParents();
    } catch (err) {
      setFormError(err?.message || 'Gagal membuat akun wali murid.');
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  // Generate / Open WhatsApp Invitation Modal
  const handleOpenWhatsAppModal = async (parentId) => {
    if (!tenantId || !parentId) return;
    if (actionLoadingId === parentId || isGeneratingWhatsApp) return;

    setActionLoadingId(parentId);
    setActionMessage(null);
    setIsGeneratingWhatsApp(true);
    setCopiedLink(false);
    setCopiedMessage(false);

    try {
      const res = await activeService.generateWhatsAppInvitation(parentId);
      const modalPayload = res?.data || res;
      const topStatus = res?.status || modalPayload?.status || (modalPayload?.isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND');
      setActiveWhatsAppModal({
        ...modalPayload,
        status: topStatus
      });
      await fetchParents();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Gagal menyiapkan tautan WhatsApp.'
      });
    } finally {
      setIsGeneratingWhatsApp(false);
      setActionLoadingId(null);
    }
  };

  const handleCopyLink = async (link) => {
    if (!link) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleCopyMessage = async (msg) => {
    if (!msg) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg);
      }
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 3000);
      return true;
    } catch (_) {
      return false;
    }
  };

  // Request Delete Confirmation Modal
  const handleRequestDelete = (parent) => {
    if (!tenantId || !parent) return;
    setParentToDelete(parent);
  };

  // Execute Confirmed Delete
  const handleConfirmDelete = async () => {
    if (!tenantId || !parentToDelete?.id || isDeleting) return;
    const targetId = parentToDelete.id;

    setIsDeleting(true);
    setActionLoadingId(targetId);
    setActionMessage(null);

    try {
      await activeService.deleteParentAccount(targetId);
      setParentToDelete(null);
      setActionMessage({
        type: 'success',
        text: `Akun wali murid "${parentToDelete.name || parentToDelete.full_name || parentToDelete.email}" berhasil dihapus secara aman.`
      });
      await fetchParents();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Gagal menghapus akun wali murid.'
      });
    } finally {
      setIsDeleting(false);
      setActionLoadingId(null);
    }
  };

  const closeAndResetAddModal = () => {
    if (isSubmitting) return;
    setShowAddModal(false);
    setFormData({
      name: '',
      email: '',
      phone: '',
      kk: '',
      relationship: 'guardian'
    });
    setHasSearchedKK(false);
    setSearchResults([]);
    setSelectedStudentIds([]);
    setFormError(null);
    setSuccessResult(null);
    setCopiedLink(false);
    setCopiedMessage(false);
  };

  const selectedStudentsList = useMemo(() => {
    return searchResults.filter((s) => selectedStudentIds.includes(s.studentId));
  }, [searchResults, selectedStudentIds]);

  // 1. MISSING TENANT CONTEXT GUARD
  if (!tenantId) {
    return (
      <div
        data-testid="mobile-parent-no-tenant"
        className="chua-mobile-app min-h-screen bg-[#F5F7FC] p-4 flex items-center justify-center text-[#17233D]"
      >
        <div className="bg-white border border-amber-200 rounded-[18px] p-6 text-center max-w-sm shadow-xs space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-[#17233D] my-0">
            Konteks Cabang (Tenant) Tidak Tersedia
          </h2>
          <p className="text-xs text-[#68758B] leading-relaxed my-0">
            Akun Anda tidak memiliki identitas cabang/tenant yang valid. Demi keamanan multi-tenant, pengambilan data wali murid, pencarian KK siswa, dan pembuatan akun dinonaktifkan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="mobile-parent-management-main"
      className="chua-mobile-app min-h-screen bg-[#F5F7FC] text-[#17233D] pb-28"
    >
      {/* 1. HERO HEADER CARD (NAVY #101D38) */}
      <div className="bg-[#101D38] text-white p-4 rounded-[18px] shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 block">
                Portal Wali &amp; Akademi · {tenantName}
              </span>
              <h1 className="text-base font-extrabold text-white leading-snug my-0.5">
                Manajemen Wali Murid
              </h1>
              <p className="text-xs text-slate-300 font-medium leading-relaxed my-0">
                Kelola akun wali, tautkan siswa via KK, dan bagikan tautan aktivasi WhatsApp.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchParents}
              disabled={loading}
              aria-label="Muat ulang daftar wali murid"
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-300' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {/* KPI Summary Grid */}
          <div className="grid grid-cols-3 gap-2 pt-0.5">
            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10">
              <span className="text-[10px] text-slate-300 block">Total Wali</span>
              <span className="text-sm font-extrabold text-white mt-0.5 block tabular-nums">
                {stats.total}
              </span>
            </div>
            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10">
              <span className="text-[10px] text-slate-300 block">Akun Aktif</span>
              <span className="text-sm font-extrabold text-emerald-300 mt-0.5 block tabular-nums">
                {stats.activated}
              </span>
            </div>
            <div className="bg-white/10 p-2.5 rounded-[14px] border border-white/10">
              <span className="text-[10px] text-slate-300 block">Siswa Terkait</span>
              <span className="text-sm font-extrabold text-amber-300 mt-0.5 block tabular-nums">
                {stats.totalLinkedStudents}
              </span>
            </div>
          </div>

          {/* Primary Action Button: Tambah Akun Wali */}
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setSuccessResult(null);
              setShowAddModal(true);
            }}
            className="w-full min-h-[48px] px-4 py-3 bg-[#16A779] hover:bg-[#139068] text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Akun Wali Murid</span>
          </button>
        </div>
      </div>

      {/* 2. SEARCH, FILTER & CONTENT BODY */}
      <div className="pt-3.5 space-y-3.5">
        {/* Action Feedback Banner */}
        {actionMessage && (
          <div
            role="status"
            data-testid={`mobile-parent-feedback-${actionMessage.type}`}
            className={`p-3.5 rounded-[18px] text-xs font-semibold flex items-start gap-2.5 shadow-xs border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                : 'bg-rose-50 text-rose-950 border-rose-200'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#16A779] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-relaxed">{actionMessage.text}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              aria-label="Tutup pesan"
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Status Filter Card */}
        <div className="bg-white border border-[#E7EBF2] rounded-[18px] p-3.5 shadow-xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
            <input
              type="search"
              aria-label="Cari nama, email, atau nomor WhatsApp wali"
              placeholder="Cari nama wali, email, atau no. WA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-9 text-xs bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl font-semibold text-[#17233D] placeholder:text-[#68758B] focus:bg-white focus:outline-none focus:border-[#2455E8]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-2.5 top-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-[#68758B] hover:text-[#17233D]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-0.5">
            {[
              { id: 'ALL', label: `Semua (${parents.length})` },
              { id: 'ACTIVATED', label: 'Aktif' },
              { id: 'READY_TO_SEND', label: 'Siap Kirim' },
              { id: 'SENT_MANUALLY', label: 'Terkirim (WA)' },
              { id: 'EXPIRED', label: 'Kedaluwarsa' }
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition cursor-pointer ${
                    active
                      ? 'bg-[#2455E8] text-white border-[#2455E8] shadow-2xs'
                      : 'bg-[#F5F7FC] text-[#68758B] border-[#E7EBF2] hover:text-[#17233D]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. LIST STATES: LOADING / ERROR / EMPTY / CARDS */}
        {loading ? (
          <div
            data-testid="mobile-parent-loading"
            className="bg-white border border-[#E7EBF2] rounded-[18px] p-6 text-center shadow-xs"
          >
            <MobileLoadingState message="Memverifikasi daftar & status akun wali murid..." />
          </div>
        ) : loadError ? (
          <div
            data-testid="mobile-parent-error"
            className="bg-white border border-rose-200 rounded-[18px] p-5 text-center shadow-xs space-y-3"
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-extrabold text-[#17233D] my-0">
                Gagal Memuat Data Wali Murid
              </h2>
              <p className="text-xs text-[#68758B] leading-relaxed my-0">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={fetchParents}
              className="min-h-[44px] px-4 py-2.5 bg-[#2455E8] text-white text-xs font-extrabold rounded-xl inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : filteredParents.length === 0 ? (
          <div
            data-testid="mobile-parent-empty"
            className="bg-white border border-[#E7EBF2] rounded-[18px] p-6 text-center shadow-xs space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F5F7FC] text-[#2455E8] flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-extrabold text-[#17233D] my-0">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Tidak Ada Wali Murid yang Cocok'
                  : 'Belum Ada Akun Wali Murid'}
              </h2>
              <p className="text-xs text-[#68758B] leading-relaxed my-0">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Coba ubah kata kunci pencarian atau filter status undangan di atas.'
                  : 'Tambahkan akun wali murid baru dan hubungkan dengan data siswa menggunakan 16 digit Nomor KK.'}
              </p>
            </div>
            {(searchQuery || statusFilter !== 'ALL') ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="min-h-[44px] px-4 py-2 bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] text-xs font-bold rounded-xl cursor-pointer"
              >
                Reset Pencarian &amp; Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="min-h-[44px] px-4 py-2.5 bg-[#16A779] text-white text-xs font-extrabold rounded-xl inline-flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Akun Wali Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3" data-testid="mobile-parent-card-list">
            {filteredParents.map((parent) => {
              const statusMeta = getParentInvitationStatusMeta(parent);
              const isActivated = statusMeta.code === 'ACTIVATED';
              const displayName = parent.name || parent.full_name || 'Wali Murid';
              const shortId = parent.id ? String(parent.id).slice(0, 8) : '--------';
              const linkedStudentsMeta = resolveParentLinkedStudents(parent);
              const isBusy = actionLoadingId === parent.id;

              return (
                <article
                  key={parent.id}
                  data-testid={`mobile-parent-card-${parent.id}`}
                  className="bg-white border border-[#E7EBF2] rounded-[18px] p-4 shadow-xs space-y-3.5"
                >
                  {/* Top Row: Identity & Status Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <h2 className="text-sm font-extrabold text-[#17233D] leading-snug my-0">
                        {displayName}
                      </h2>
                      <span className="text-[11px] font-mono text-[#68758B] uppercase block mt-0.5">
                        ID: {shortId}...
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border shrink-0 ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Contact Info Box */}
                  <div className="bg-[#F5F7FC] border border-[#E7EBF2] rounded-[14px] p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-[#17233D]">
                      <Mail className="w-3.5 h-3.5 text-[#68758B] shrink-0" />
                      <span className="font-semibold break-all">{parent.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#17233D]">
                      <Phone className="w-3.5 h-3.5 text-[#16A779] shrink-0" />
                      <span className="font-mono font-bold text-[#17233D]">
                        {parent.phone ? `+${String(parent.phone).replace(/^\+/, '')}` : 'Nomor WA belum diatur'}
                      </span>
                    </div>
                  </div>

                  {/* Linked Students Section */}
                  <div
                    className="space-y-2"
                    data-testid={`mobile-parent-linked-students-${parent.id}`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#68758B] uppercase tracking-wider">
                      <span>
                        {linkedStudentsMeta.relationLoadFailed
                          ? 'Siswa Terhubung'
                          : `Siswa Terhubung (${linkedStudentsMeta.count})`}
                      </span>
                    </div>

                    {linkedStudentsMeta.relationLoadFailed ? (
                      <div
                        data-testid={`mobile-parent-links-error-${parent.id}`}
                        className="px-3 py-2 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Data relasi siswa gagal dimuat</span>
                      </div>
                    ) : linkedStudentsMeta.count > 0 ? (
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="list"
                        aria-label={`Daftar siswa terhubung untuk ${displayName}`}
                      >
                        {linkedStudentsMeta.items.map((studentItem) => (
                          <span
                            key={studentItem.key}
                            role="listitem"
                            data-testid={
                              studentItem.hasValidName
                                ? 'mobile-parent-student-chip-named'
                                : 'mobile-parent-student-chip-unavailable'
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border ${
                              studentItem.hasValidName
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                                : 'bg-amber-50 text-amber-900 border-amber-200 italic'
                            }`}
                          >
                            <User
                              className={`w-3.5 h-3.5 shrink-0 ${
                                studentItem.hasValidName ? 'text-[#16A779]' : 'text-amber-600'
                              }`}
                            />
                            <span className="break-words">{studentItem.displayName}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic text-[#68758B] my-0">
                        Belum ada siswa terhubung
                      </p>
                    )}
                  </div>

                  {/* Action Buttons (Minimum 44px touch targets) */}
                  <div className="pt-1 grid grid-cols-3 gap-2 border-t border-[#E7EBF2]">
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsAppModal(parent.id)}
                      disabled={isBusy}
                      aria-label={`${isActivated ? 'Pemulihan WA' : 'Kirim Undangan WA'} untuk ${displayName}`}
                      className="col-span-2 min-h-[44px] px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-[#16A779]" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-[#16A779] shrink-0" />
                      )}
                      <span>{isActivated ? 'Pemulihan WA' : 'Kirim Undangan WA'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRequestDelete(parent)}
                      disabled={isBusy}
                      aria-label={`Hapus akun wali ${displayName}`}
                      className="col-span-1 min-h-[44px] px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. ADD PARENT ACCOUNT MODAL / SHEET */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-add-parent-title"
          data-testid="mobile-parent-add-modal"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-lg rounded-t-[24px] sm:rounded-[22px] border border-[#E7EBF2] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3.5 bg-[#101D38] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="mobile-add-parent-title" className="text-sm font-extrabold text-white my-0">
                    {successResult ? 'Tautan Aktivasi Siap Dibagikan' : 'Tambah Akun Wali Murid'}
                  </h2>
                  <p className="text-[11px] text-slate-300 my-0">
                    {tenantName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAndResetAddModal}
                aria-label="Tutup formulir wali murid"
                className="min-h-[40px] min-w-[40px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {successResult ? (
                <div className="space-y-4" data-testid="mobile-parent-create-success">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[18px] text-center space-y-2">
                    <div className="w-12 h-12 bg-white text-[#16A779] rounded-full flex items-center justify-center mx-auto shadow-2xs">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-extrabold text-[#17233D] my-0">
                      Akun Wali &amp; Tautan Berhasil Disiapkan
                    </h3>
                    <p className="text-xs text-[#68758B] leading-relaxed my-0">
                      Akun untuk <strong className="text-[#17233D]">{successResult.data?.email}</strong> telah dibuat dengan status{' '}
                      <strong className="text-amber-800">
                        {successResult.data?.status === 'SENT_MANUALLY' ? 'SENT_MANUALLY' : 'READY_TO_SEND'}
                      </strong>.
                    </p>
                  </div>

                  {/* Honest Security Notice: Link creation != automatic WhatsApp delivery */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-[16px] flex items-start gap-2.5 text-xs text-amber-950">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1 leading-relaxed">
                      <p className="font-extrabold my-0">Penting: Undangan Belum Terkirim Otomatis</p>
                      <p className="my-0">
                        Sistem hanya menghasilkan tautan aktivasi. Pengiriman undangan dilakukan secara manual oleh operator melalui WhatsApp menggunakan tombol <strong>Buka WhatsApp</strong> atau dengan menyalin tautan aktivasi di bawah ini.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[16px] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#68758B] font-bold">Nomor WhatsApp:</span>
                      <span className="font-mono font-extrabold text-[#16A779]">
                        {successResult.data?.phone ? `+${successResult.data.phone}` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#68758B] font-bold">Status Undangan:</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[11px]">
                        {successResult.data?.status || 'READY_TO_SEND'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {(successResult.data?.whatsappUrl || successResult.whatsappUrl) && (
                      <a
                        href={successResult.data?.whatsappUrl || successResult.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[48px] px-4 py-3 bg-[#16A779] hover:bg-[#139068] text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 no-underline shadow-xs"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Buka WhatsApp &amp; Kirim Pesan</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyLink(successResult.data?.claimUrl || successResult.claimUrl)}
                      className="min-h-[48px] px-4 py-2.5 bg-[#F5F7FC] hover:bg-slate-100 border border-[#E7EBF2] text-[#17233D] text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-4 h-4 text-[#16A779]" />
                          <span>Tautan Aktivasi Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#2455E8]" />
                          <span>Salin Tautan Aktivasi</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={closeAndResetAddModal}
                    className="w-full min-h-[48px] px-4 py-2.5 bg-[#101D38] text-white text-xs font-extrabold rounded-xl cursor-pointer"
                  >
                    Selesai &amp; Kembali ke Daftar Wali
                  </button>
                </div>
              ) : (
                <form
                  id="mobile-create-parent-form"
                  onSubmit={handleSubmitCreateParent}
                  className="space-y-4"
                  noValidate
                >
                  {formError && (
                    <div
                      role="alert"
                      data-testid="mobile-parent-form-error"
                      className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-[16px] text-xs font-semibold flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{formError}</span>
                    </div>
                  )}

                  {/* Nama Wali Murid */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mobile-parent-name"
                      className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                    >
                      Nama Lengkap Wali Murid <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
                      <input
                        id="mobile-parent-name"
                        type="text"
                        required
                        placeholder="Contoh: Budi Santoso"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-12 pl-10 pr-3 text-xs bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl font-bold text-[#17233D] focus:bg-white focus:outline-none focus:border-[#2455E8]"
                      />
                    </div>
                  </div>

                  {/* Email Wali Murid */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mobile-parent-email"
                      className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                    >
                      Alamat Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
                      <input
                        id="mobile-parent-email"
                        type="email"
                        required
                        placeholder="wali@domain.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-12 pl-10 pr-3 text-xs bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl font-bold text-[#17233D] focus:bg-white focus:outline-none focus:border-[#2455E8]"
                      />
                    </div>
                  </div>

                  {/* Nomor WhatsApp */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mobile-parent-phone"
                      className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                    >
                      Nomor WhatsApp Aktif <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
                      <input
                        id="mobile-parent-phone"
                        type="tel"
                        inputMode="tel"
                        required
                        placeholder="081234567890"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full h-12 pl-10 pr-3 text-xs bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl font-bold font-mono text-[#17233D] focus:bg-white focus:outline-none focus:border-[#2455E8]"
                      />
                    </div>
                    <p className="text-[11px] text-[#68758B] my-0">
                      Otomatis dinormalisasi ke format internasional Indonesia (628...).
                    </p>
                  </div>

                  {/* Hubungan dengan Siswa */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mobile-parent-relationship"
                      className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                    >
                      Hubungan dengan Siswa <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="mobile-parent-relationship"
                      required
                      value={formData.relationship}
                      onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                      className="w-full h-12 px-3.5 text-xs bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl font-bold text-[#17233D] focus:bg-white focus:outline-none focus:border-[#2455E8]"
                    >
                      {RELATIONSHIP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nomor Kartu Keluarga (16 Digit) + Tombol Cari Siswa */}
                  <div className="p-3.5 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[18px] space-y-3">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="mobile-parent-kk"
                        className="text-[11px] font-extrabold text-[#17233D] uppercase tracking-wider"
                      >
                        Nomor Kartu Keluarga (16 Digit) <span className="text-rose-500">*</span>
                      </label>
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          formData.kk.length === 16 ? 'text-[#16A779]' : 'text-[#68758B]'
                        }`}
                      >
                        {formData.kk.length}/16 digit
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <CreditCard className="w-4 h-4 text-[#68758B] absolute left-3.5 top-4" />
                        <input
                          id="mobile-parent-kk"
                          type="text"
                          inputMode="numeric"
                          required
                          maxLength={16}
                          placeholder="Masukkan 16 digit nomor KK..."
                          value={formData.kk}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              kk: e.target.value.replace(/\D/g, '').slice(0, 16)
                            })
                          }
                          className="w-full h-12 pl-10 pr-3 text-xs bg-white border border-[#E7EBF2] rounded-xl font-mono font-bold tracking-wider text-[#17233D] focus:outline-none focus:border-[#2455E8]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSearchStudents}
                        disabled={isSearchingStudents || formData.kk.length !== 16}
                        className="w-full min-h-[48px] px-4 py-2.5 bg-[#101D38] hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSearchingStudents ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                            <span>Mencari Siswa Berdasarkan KK...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 text-amber-300" />
                            <span>Cari Siswa Berdasarkan Nomor KK</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Hasil Pencarian Siswa */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#68758B]">
                        <span>Hasil Pencarian Siswa ({searchResults.length})</span>
                        {selectedStudentIds.length > 0 && (
                          <span className="text-[#16A779] font-extrabold">
                            {selectedStudentIds.length} siswa dipilih
                          </span>
                        )}
                      </div>

                      {searchResults.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                          {searchResults.map((student) => {
                            const isSelected = selectedStudentIds.includes(student.studentId);
                            return (
                              <button
                                key={student.studentId}
                                type="button"
                                onClick={() => handleToggleStudent(student.studentId)}
                                className={`w-full min-h-[52px] p-3 rounded-xl border-2 text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                                  isSelected
                                    ? 'border-[#16A779] bg-emerald-50/70'
                                    : 'border-[#E7EBF2] bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-extrabold text-[#17233D] truncate my-0">
                                    {student.name}
                                  </p>
                                  <p className="text-[11px] text-[#68758B] font-mono my-0 mt-0.5">
                                    KK Akhiran: ****{student.kkLast4 || String(formData.kk).slice(-4)}
                                  </p>
                                </div>
                                <div
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'border-[#16A779] bg-[#16A779] text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 bg-white border border-dashed border-[#E7EBF2] rounded-xl text-center text-[#68758B]">
                          <p className="text-xs my-0">
                            {hasSearchedKK
                              ? 'Tidak ada siswa yang ditemukan untuk nomor KK tersebut.'
                              : 'Masukkan tepat 16 digit nomor KK lalu tekan Cari Siswa.'}
                          </p>
                        </div>
                      )}

                      {/* Ringkasan Siswa Terpilih Sebelum Submit */}
                      {selectedStudentsList.length > 0 && (
                        <div
                          data-testid="mobile-parent-selected-students"
                          className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5"
                        >
                          <span className="text-[11px] font-extrabold text-emerald-900 block">
                            Siswa yang Akan Dihubungkan ({selectedStudentsList.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedStudentsList.map((s) => (
                              <span
                                key={s.studentId}
                                className="px-2.5 py-1 bg-white text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3 text-[#16A779]" />
                                <span>{s.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>

            {!successResult && (
              <div className="p-3.5 bg-white border-t border-[#E7EBF2] shrink-0">
                <button
                  type="submit"
                  form="mobile-create-parent-form"
                  disabled={isSubmitting || selectedStudentIds.length === 0}
                  className="w-full min-h-[50px] px-5 py-3 bg-[#16A779] hover:bg-[#139068] text-white font-extrabold text-xs rounded-xl shadow-sm transition disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses Pembuatan Akun...</span>
                    </>
                  ) : (
                    <>
                      <span>Buat Akun Wali Murid</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. WHATSAPP INVITATION / RECOVERY MODAL */}
      {activeWhatsAppModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-wa-modal-title"
          data-testid="mobile-parent-whatsapp-modal"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-lg rounded-t-[24px] sm:rounded-[22px] border border-[#E7EBF2] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 bg-[#101D38] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="mobile-wa-modal-title" className="text-sm font-extrabold text-white truncate my-0">
                    {activeWhatsAppModal.isConfirmed
                      ? 'Pemulihan Akun via WhatsApp'
                      : 'Undangan Aktivasi via WhatsApp'}
                  </h2>
                  <p className="text-[11px] text-slate-300 truncate my-0">
                    Akademi: {activeWhatsAppModal.tenantName || tenantName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveWhatsAppModal(null)}
                aria-label="Tutup modal WhatsApp"
                className="min-h-[40px] min-w-[40px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
              {/* Recipient & Status Summary */}
              <div className="p-3.5 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[16px] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#68758B] font-bold">Penerima:</span>
                  <span className="font-extrabold text-[#17233D]">
                    {activeWhatsAppModal.parentName || 'Wali Murid'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#68758B] font-bold">Nomor WhatsApp:</span>
                  <span className="font-mono font-extrabold text-[#16A779]">
                    {activeWhatsAppModal.phone ? `+${activeWhatsAppModal.phone}` : '(Nomor belum diatur)'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#68758B] font-bold">Status Undangan:</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white border border-[#E7EBF2] font-extrabold text-[#17233D]">
                    {activeWhatsAppModal.status || (activeWhatsAppModal.isConfirmed ? 'ACTIVATED' : 'READY_TO_SEND')}
                  </span>
                </div>
              </div>

              {/* Explicit Manual Delivery Clarification */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-[14px] flex items-start gap-2 text-xs text-amber-950">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Pembuatan tautan dan penyalinan pesan <strong>bukan</strong> pengiriman otomatis. Pengiriman undangan dilakukan secara manual oleh operator melalui WhatsApp.
                </span>
              </div>

              {/* Message Preview */}
              <div className="space-y-1.5">
                <label
                  htmlFor="mobile-wa-preview-message"
                  className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider"
                >
                  Pratinjau Pesan Undangan:
                </label>
                <textarea
                  id="mobile-wa-preview-message"
                  readOnly
                  rows={7}
                  value={activeWhatsAppModal.message || ''}
                  className="w-full p-3 text-xs bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl font-mono text-[#17233D] focus:outline-none"
                />
              </div>

              {/* Copy Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyLink(activeWhatsAppModal.claimUrl)}
                  className="min-h-[44px] px-3 py-2 bg-[#F5F7FC] hover:bg-slate-100 border border-[#E7EBF2] text-[#17233D] text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-[#16A779]" />
                      <span>Link Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#2455E8]" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyMessage(activeWhatsAppModal.message)}
                  className="min-h-[44px] px-3 py-2 bg-[#F5F7FC] hover:bg-slate-100 border border-[#E7EBF2] text-[#17233D] text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedMessage ? (
                    <>
                      <Check className="w-4 h-4 text-[#16A779]" />
                      <span>Pesan Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#2455E8]" />
                      <span>Salin Pesan</span>
                    </>
                  )}
                </button>
              </div>

              {/* Primary WhatsApp Launch */}
              {activeWhatsAppModal.whatsappUrl && (
                <div className="pt-2 border-t border-[#E7EBF2]">
                  <a
                    href={activeWhatsAppModal.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[48px] px-4 py-3 bg-[#16A779] hover:bg-[#139068] text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 no-underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. DELETE ACCOUNT CONFIRMATION MODAL */}
      {parentToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-delete-parent-title"
          data-testid="mobile-parent-delete-modal"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E7EBF2] rounded-[20px] p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="mobile-delete-parent-title" className="text-sm font-extrabold text-[#17233D] my-0">
                  Konfirmasi Hapus Akun Wali
                </h3>
                <p className="text-[11px] text-[#68758B] my-0">
                  Tindakan ini membatalkan akses &amp; menghapus tautan siswa
                </p>
              </div>
            </div>

            {/* Identity Verification Box */}
            <div className="p-3.5 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[14px] space-y-1.5 text-xs">
              <div className="font-extrabold text-[#17233D]">
                {parentToDelete.name || parentToDelete.full_name || 'Wali Murid'}
              </div>
              <div className="text-[#68758B] break-all">
                Email: <strong className="text-[#17233D]">{parentToDelete.email || '-'}</strong>
              </div>
              <div className="text-[#68758B] font-mono">
                WhatsApp: <strong className="text-[#17233D]">{parentToDelete.phone || '-'}</strong>
              </div>
              <div className="text-[#68758B]">
                Siswa Terhubung:{' '}
                <strong className="text-[#17233D]">
                  {(() => {
                    const linked = resolveParentLinkedStudents(parentToDelete);
                    if (linked.relationLoadFailed) return 'Data relasi siswa gagal dimuat';
                    if (linked.count === 0) return 'Tidak ada';
                    return linked.items.map((item) => item.displayName).join(', ');
                  })()}
                </strong>
              </div>
            </div>

            <p className="text-xs text-[#68758B] leading-relaxed my-0">
              Apakah Anda yakin ingin membatalkan pendaftaran dan menghapus akun wali murid di atas secara permanen?
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setParentToDelete(null)}
                disabled={isDeleting}
                className="min-h-[46px] px-3 py-2.5 bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] text-xs font-extrabold rounded-xl cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[46px] px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Akun</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
