import React, { useState, useEffect, useCallback } from 'react';
import { 
  getAttendance, 
  recordAttendanceSession, 
  deleteAttendanceSession 
} from '../services/supabaseAcademyService';
import { calculateAge } from '../utils/helpers';
import { 
  ClipboardCheck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  User,
  Loader2,
  Check,
  Archive
} from 'lucide-react';

export default function AttendanceSection({ selectedClass, students = [], tenantId, isMobile = false }) {
  // Identifikasi status kelas arsip secara eksplisit
  const isArchived = Boolean(selectedClass?.isArchived === true);
  // 1. SETUP STATE & FILTERING DATA
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [coachAttendance, setCoachAttendance] = useState(true);
  const [studentAttendance, setStudentAttendance] = useState({});

  const [sessionNotes, setSessionNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Unsaved vs Saved session state tracking
  const [hasInteracted, setHasInteracted] = useState(false);
  const [savedSnapshotsByDate, setSavedSnapshotsByDate] = useState({});

  // History State
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  const [showInactiveStudents, setShowInactiveStudents] = useState(false);

  // Filter students by selected class & activity status with fallback matching
  const assignedClassStudents = students.filter((student) => {
    if (student.classId && selectedClass?.id && student.classId === selectedClass.id) return true;
    if (selectedClass?.className && student.className === selectedClass.className) return true;
    return false;
  });

  const targetStudents = assignedClassStudents;

  const classStudents = targetStudents.filter((student) => {
    const isInactive = 
      student.status === 'Non-Aktif' || 
      student.status === 'Nonaktif' || 
      student.status === 'Belum Aktif' || 
      student.status === 'inactive' || 
      student.isActive === false;
    if (!showInactiveStudents && isInactive) return false;
    return true;
  });

  // Default all students in class to 'Hadir' on load / class change
  useEffect(() => {
    const defaultMap = {};
    classStudents.forEach((st) => {
      defaultMap[st.id] = 'Hadir';
    });
    setStudentAttendance(defaultMap);
    setCoachAttendance(true);
    setHasInteracted(false);
  }, [selectedClass?.id, students.length, showInactiveStudents]);

  // Reset catatan sementara & pesan saat berpindah kelas
  useEffect(() => {
    setSessionNotes('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setHasInteracted(false);
    setSavedSnapshotsByDate({});
  }, [selectedClass?.id]);

  // Fetch attendance history from Supabase
  const fetchAttendanceHistory = useCallback(async () => {
    if (!tenantId || !selectedClass?.id) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    try {
      const list = await getAttendance(tenantId, selectedClass.id);
      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setHistory(list);
    } catch (err) {
      console.error('Error fetching academy_attendance from Supabase:', err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [tenantId, selectedClass?.id]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  // Handler update status presensi siswa individual
  const handleStudentStatusChange = (studentId, status) => {
    if (isArchived) return;
    setHasInteracted(true);
    setStudentAttendance((prev) => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Quick action: Set all students status
  const handleSetAllStudents = (status) => {
    if (isArchived) return;
    setHasInteracted(true);
    const updated = {};
    classStudents.forEach((st) => {
      updated[st.id] = status;
    });
    setStudentAttendance(updated);
  };

  // Live Attendance Summary (real-time calculation from current state)
  const liveSummary = {
    hadir: classStudents.filter((st) => (studentAttendance[st.id] || 'Hadir') === 'Hadir').length,
    izin: classStudents.filter((st) => studentAttendance[st.id] === 'Izin').length,
    sakit: classStudents.filter((st) => studentAttendance[st.id] === 'Sakit').length,
    alpa: classStudents.filter((st) => studentAttendance[st.id] === 'Alpa' || studentAttendance[st.id] === 'Alpha').length
  };

  // Snapshot & Dirty-State Derived Flags
  const currentSnapshot = JSON.stringify({
    date: attendanceDate,
    coachAttendance,
    notes: sessionNotes.trim(),
    students: classStudents.map((st) => ({
      id: st.id,
      status: studentAttendance[st.id] || 'Hadir'
    }))
  });

  const hasSavedSnapshotForDate = Boolean(savedSnapshotsByDate[attendanceDate]);
  const isMatchingSavedSnapshot = hasSavedSnapshotForDate && savedSnapshotsByDate[attendanceDate] === currentSnapshot;
  const hasHistoryForDate = history.some((sess) => sess.date === attendanceDate);
  const isAlreadyRecordedAndUnchanged = isMatchingSavedSnapshot || (hasHistoryForDate && !hasInteracted);
  const hasUnsavedChanges = classStudents.length > 0 && !isArchived && hasInteracted && !isMatchingSavedSnapshot;
  const isSaveDisabled = isArchived || isSaving || !selectedClass?.id || classStudents.length === 0 || isAlreadyRecordedAndUnchanged;

  // 3. LOGIKA PENYIMPANAN (FIRESTORE / SUPABASE)
  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (isArchived) {
      setErrorMsg('Tidak dapat menyimpan presensi: Kelas ini telah diarsipkan (mode baca-saja).');
      return;
    }
    if (!selectedClass?.id || !tenantId) return;

    if (!attendanceDate) {
      setErrorMsg('Tanggal presensi wajib dipilih.');
      return;
    }

    if (classStudents.length === 0) {
      setErrorMsg('Belum ada siswa terdaftar di kelas ini untuk dicatat presensinya.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const recordsPayload = classStudents.map((st) => ({
      studentId: st.id,
      studentName: st.studentName || 'Siswa',
      status: studentAttendance[st.id] || 'Hadir'
    }));

    const summary = {
      hadir: recordsPayload.filter((r) => r.status === 'Hadir').length,
      izin: recordsPayload.filter((r) => r.status === 'Izin').length,
      sakit: recordsPayload.filter((r) => r.status === 'Sakit').length,
      alpa: recordsPayload.filter((r) => r.status === 'Alpa' || r.status === 'Alpha').length
    };

    const coachNameDisplay = selectedClass.coachName || selectedClass.coach || 'Pelatih Utama';

    try {
      const savedSession = await recordAttendanceSession({
        tenantId,
        academyId: selectedClass.academyId || '',
        classId: selectedClass.id,
        className: selectedClass.className || selectedClass.name || 'Kelas Akademi',
        sport: selectedClass.sport || '',
        coachName: coachNameDisplay,
        coachAttended: coachAttendance,
        date: attendanceDate,
        notes: sessionNotes.trim(),
        students: recordsPayload,
        summary
      });

      const postSaveSnapshot = JSON.stringify({
        date: attendanceDate,
        coachAttendance,
        notes: '',
        students: classStudents.map((st) => ({
          id: st.id,
          status: studentAttendance[st.id] || 'Hadir'
        }))
      });

      setSavedSnapshotsByDate((prev) => ({ ...prev, [attendanceDate]: postSaveSnapshot }));
      setHasInteracted(false);
      setHistory((prev) => [savedSession, ...prev]);
      setSuccessMsg(`Presensi tanggal ${attendanceDate} berhasil disimpan!`);
      setSessionNotes('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to save academy_attendance in Supabase:', err);
      setErrorMsg('Gagal menyimpan data presensi: ' + (err.message || 'Silakan coba lagi.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (id, dateStr) => {
    if (isArchived) {
      alert('Tidak dapat menghapus riwayat: Kelas ini telah diarsipkan (mode baca-saja).');
      return;
    }
    if (!window.confirm(`Hapus catatan presensi tanggal ${dateStr}?`)) return;
    try {
      await deleteAttendanceSession(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setSavedSnapshotsByDate((prev) => {
        const next = { ...prev };
        delete next[dateStr];
        return next;
      });
    } catch (err) {
      console.error('Failed to delete attendance history from Supabase:', err);
      alert('Gagal menghapus riwayat presensi: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  // =========================================================================
  // MOBILE ATTENDANCE EXPERIENCE (PHASE B) — HANYA AKTIF KETIKA isMobile=true
  // =========================================================================
  if (isMobile) {
    return (
      <div className="space-y-2.5 pb-20 text-left">
        {/* BANNER MODE ARSIP */}
        {isArchived && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl font-medium flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Kelas diarsipkan. Presensi dalam mode baca-saja.</span>
          </div>
        )}

        {/* NOTIFIKASI BERHASIL / GAGAL */}
        {successMsg && (
          <div role="status" className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-2xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A779] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-2xl font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveAttendance} className="space-y-2.5">
          {/* A. KONTEKS SESI & B. RINGKASAN PRESENSI */}
          <div className="chua-m-att-card space-y-2.5">
            {/* Baris Konteks Sesi Ringkas & Status Penyimpanan */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 flex items-center gap-1.5 text-xs font-semibold text-[#68758B] truncate">
                <span className="font-bold text-[#17233D] truncate">
                  {selectedClass?.coachName ? selectedClass.coachName : 'Sesi Latihan'}
                </span>
                {selectedClass?.tierLabel && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span className="truncate">{selectedClass.tierLabel}</span>
                  </>
                )}
              </div>

              {/* Status Sesi Aktual */}
              <div className="shrink-0 text-right">
                {isArchived ? (
                  <span className="text-[11px] font-bold text-amber-700">Baca-Saja</span>
                ) : isSaving ? (
                  <span className="text-[11px] font-bold text-[#2455E8]">Menyimpan...</span>
                ) : hasUnsavedChanges ? (
                  <span className="text-[11px] font-bold text-amber-600">Belum Disimpan</span>
                ) : isAlreadyRecordedAndUnchanged ? (
                  <span className="text-[11px] font-bold text-[#16A779]">Presensi Tersimpan</span>
                ) : (
                  <span className="text-[11px] font-semibold text-[#68758B]">Belum Diisi</span>
                )}
              </div>
            </div>

            {/* Kontrol Tanggal & Kehadiran Pelatih (Touch Target >= 44px, Tanpa Truncation) */}
            <div className="flex items-center gap-2">
              <label htmlFor="attendance-session-date" className="chua-m-att-control-box flex-1 min-w-0 cursor-pointer">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Calendar className="w-4 h-4 text-[#2455E8] shrink-0" />
                  <input
                    id="attendance-session-date"
                    name="attendanceDate"
                    aria-label="Tanggal Presensi"
                    type="date"
                    required
                    disabled={isArchived}
                    value={attendanceDate}
                    onChange={(e) => {
                      setAttendanceDate(e.target.value);
                      setHasInteracted(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="w-full bg-transparent border-none text-xs font-bold text-[#17233D] focus:outline-none p-0 min-w-0 disabled:opacity-60"
                  />
                </div>
              </label>

              <div className="chua-m-att-control-box shrink-0">
                <span className="text-xs font-semibold text-[#17233D] whitespace-nowrap">Pelatih Hadir</span>
                <button
                  type="button"
                  role="switch"
                  aria-label="Pelatih Hadir"
                  disabled={isArchived}
                  aria-checked={coachAttendance}
                  onClick={() => {
                    if (!isArchived) {
                      setCoachAttendance(!coachAttendance);
                      setHasInteracted(true);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 focus:outline-none ${
                    isArchived ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  } ${coachAttendance ? 'bg-[#16A779]' : 'bg-slate-300'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-150 shadow-xs ${
                      coachAttendance ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Catatan Sesi */}
            <div>
              <input
                id="attendance-session-notes"
                name="sessionNotes"
                aria-label="Catatan atau Materi Latihan Hari Ini"
                type="text"
                disabled={isArchived}
                value={sessionNotes}
                onChange={(e) => {
                  setSessionNotes(e.target.value);
                  setHasInteracted(true);
                }}
                placeholder={isArchived ? 'Catatan sesi dinonaktifkan (kelas diarsipkan)' : 'Catatan / materi latihan hari ini (opsional)...'}
                className="chua-m-att-notes-input disabled:opacity-60"
              />
            </div>

            {/* B. RINGKASAN PRESENSI LANGSUNG (HADIR, IZIN, SAKIT, ALPA) */}
            <div className="chua-m-att-summary-grid" aria-label="Ringkasan Presensi">
              <div className="chua-m-att-summary-item">
                <span className="text-base font-extrabold text-[#16A779] tabular-nums leading-tight">
                  {liveSummary.hadir}
                </span>
                <span className="text-[11px] font-semibold text-[#68758B] mt-0.5">Hadir</span>
              </div>
              <div className="chua-m-att-summary-item">
                <span className="text-base font-extrabold text-[#2455E8] tabular-nums leading-tight">
                  {liveSummary.izin}
                </span>
                <span className="text-[11px] font-semibold text-[#68758B] mt-0.5">Izin</span>
              </div>
              <div className="chua-m-att-summary-item">
                <span className="text-base font-extrabold text-[#D97706] tabular-nums leading-tight">
                  {liveSummary.sakit}
                </span>
                <span className="text-[11px] font-semibold text-[#68758B] mt-0.5">Sakit</span>
              </div>
              <div className="chua-m-att-summary-item">
                <span className="text-base font-extrabold text-[#DC4545] tabular-nums leading-tight">
                  {liveSummary.alpa}
                </span>
                <span className="text-[11px] font-semibold text-[#68758B] mt-0.5">Alpa</span>
              </div>
            </div>
          </div>

          {/* C. DAFTAR SISWA & D. INPUT PRESENSI CEPAT */}
          <div className="chua-m-att-card space-y-2.5">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-[#17233D] my-0">
                  Siswa ({classStudents.length})
                </h4>

                <label
                  htmlFor="attendance-show-inactive-students"
                  className="min-h-[32px] inline-flex items-center gap-1 text-[11px] font-semibold text-[#68758B] cursor-pointer select-none px-2 py-0.5 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2]"
                >
                  <input
                    id="attendance-show-inactive-students"
                    name="showInactiveStudents"
                    type="checkbox"
                    checked={showInactiveStudents}
                    onChange={(e) => setShowInactiveStudents(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-300 text-[#2455E8] focus:ring-[#2455E8] cursor-pointer"
                  />
                  <span>Non-Aktif</span>
                </label>
              </div>

              {!isArchived && classStudents.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetAllStudents('Hadir')}
                    className="min-h-[32px] px-2 py-0.5 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2] text-[11px] font-bold text-[#16A779] cursor-pointer active:scale-95 transition-transform"
                  >
                    Semua Hadir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllStudents('Izin')}
                    className="min-h-[32px] px-2 py-0.5 rounded-lg bg-[#F5F7FC] border border-[#E7EBF2] text-[11px] font-bold text-[#2455E8] cursor-pointer active:scale-95 transition-transform"
                  >
                    Semua Izin
                  </button>
                </div>
              )}
            </div>

            {/* Empty State: Belum Ada Siswa */}
            {!selectedClass ? (
              <div className="py-7 px-4 border border-dashed border-[#E7EBF2] rounded-2xl text-center bg-[#F5F7FC]/60 space-y-1.5">
                <User className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-[#17233D] my-0">
                  Pilih Kelas Terlebih Dahulu
                </p>
                <p className="text-[11px] text-[#68758B] my-0">
                  Ketuk pemilih kelas di atas untuk menampilkan daftar siswa.
                </p>
              </div>
            ) : classStudents.length === 0 ? (
              <div className="py-7 px-4 border border-dashed border-[#E7EBF2] rounded-2xl text-center bg-[#F5F7FC]/60 space-y-1.5">
                <User className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-[#17233D] my-0">
                  Belum ada siswa terdaftar di kelas ini.
                </p>
                <p className="text-[11px] text-[#68758B] my-0">
                  {assignedClassStudents.length > 0 && !showInactiveStudents
                    ? 'Terdapat siswa non-aktif. Centang "Tampilkan Non-Aktif" untuk melihat.'
                    : 'Tambahkan siswa ke kelas ini melalui tab Siswa.'}
                </p>
              </div>
            ) : (
              <div className="chua-m-att-student-list">
                {classStudents.map((st, idx) => {
                  const rawStatus = studentAttendance[st.id] || 'Hadir';
                  const currentStatus = rawStatus === 'Alpha' ? 'Alpa' : rawStatus;
                  const isInactive =
                    st.status === 'Non-Aktif' ||
                    st.status === 'Nonaktif' ||
                    st.status === 'Belum Aktif' ||
                    st.status === 'inactive' ||
                    st.isActive === false;
                  const studentAge = calculateAge(st.birthDate);
                  const metaItems = [];
                  if (studentAge !== '-') metaItems.push(`${studentAge} thn`);
                  if (isInactive) metaItems.push('Non-Aktif');

                  const statusTextColor =
                    currentStatus === 'Hadir'
                      ? 'text-[#16A779]'
                      : currentStatus === 'Izin'
                      ? 'text-[#2455E8]'
                      : currentStatus === 'Sakit'
                      ? 'text-[#D97706]'
                      : 'text-[#DC4545]';

                  return (
                    <div key={st.id} className="chua-m-att-student-row">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs font-bold text-[#68758B] tabular-nums shrink-0 w-5">
                            {idx + 1}.
                          </span>
                          <div className="min-w-0 flex-1 truncate">
                            <span className="font-bold text-sm text-[#17233D] truncate block leading-snug">
                              {st.studentName}
                            </span>
                            {metaItems.length > 0 && (
                              <span className="text-[11px] text-[#68758B] font-medium block truncate">
                                {metaItems.join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`text-xs font-bold shrink-0 ${statusTextColor}`}>
                          {currentStatus}
                        </span>
                      </div>

                      {/* 4-Status Direct Segmented Buttons (Touch Target >= 44px) */}
                      <div className="chua-m-att-status-grid" role="group" aria-label={`Status presensi ${st.studentName}`}>
                        <button
                          type="button"
                          disabled={isArchived}
                          aria-pressed={currentStatus === 'Hadir'}
                          onClick={() => handleStudentStatusChange(st.id, 'Hadir')}
                          className={`chua-m-att-status-btn ${
                            currentStatus === 'Hadir' ? 'chua-m-att-status-btn-hadir' : ''
                          }`}
                        >
                          Hadir
                        </button>

                        <button
                          type="button"
                          disabled={isArchived}
                          aria-pressed={currentStatus === 'Izin'}
                          onClick={() => handleStudentStatusChange(st.id, 'Izin')}
                          className={`chua-m-att-status-btn ${
                            currentStatus === 'Izin' ? 'chua-m-att-status-btn-izin' : ''
                          }`}
                        >
                          Izin
                        </button>

                        <button
                          type="button"
                          disabled={isArchived}
                          aria-pressed={currentStatus === 'Sakit'}
                          onClick={() => handleStudentStatusChange(st.id, 'Sakit')}
                          className={`chua-m-att-status-btn ${
                            currentStatus === 'Sakit' ? 'chua-m-att-status-btn-sakit' : ''
                          }`}
                        >
                          Sakit
                        </button>

                        <button
                          type="button"
                          disabled={isArchived}
                          aria-pressed={currentStatus === 'Alpa'}
                          onClick={() => handleStudentStatusChange(st.id, 'Alpa')}
                          className={`chua-m-att-status-btn ${
                            currentStatus === 'Alpa' ? 'chua-m-att-status-btn-alpa' : ''
                          }`}
                        >
                          Alpa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* E. TOMBOL SIMPAN (STICKY BOTTOM ACTION) */}
          {!isArchived && (
            <div className="chua-m-att-sticky-save">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#17233D] truncate">
                  {isSaving
                    ? 'Menyimpan presensi...'
                    : hasUnsavedChanges
                    ? 'Perubahan belum disimpan'
                    : isAlreadyRecordedAndUnchanged
                    ? 'Presensi sudah tersimpan'
                    : `Presensi (${classStudents.length} Siswa)`}
                </div>
                <div className="text-[11px] text-[#68758B] font-medium truncate tabular-nums">
                  {classStudents.length > 0
                    ? `${liveSummary.hadir} Hadir · ${liveSummary.izin} Izin · ${liveSummary.sakit} Sakit · ${liveSummary.alpa} Alpa`
                    : 'Belum ada siswa dalam kelas'}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaveDisabled}
                className="chua-m-att-save-btn"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : isAlreadyRecordedAndUnchanged ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Tersimpan</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Presensi</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        {/* RIWAYAT PRESENSI */}
        <div className="chua-m-att-card space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#E7EBF2] pb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#68758B]" />
              <h4 className="font-bold text-xs text-[#17233D] my-0">
                Riwayat Presensi ({history.length})
              </h4>
            </div>
          </div>

          {loadingHistory ? (
            <p className="py-5 text-center text-xs text-[#68758B] font-medium my-0">
              Memuat riwayat presensi...
            </p>
          ) : history.length === 0 ? (
            <div className="py-5 text-center space-y-1">
              <p className="text-xs font-semibold text-[#17233D] my-0">
                Belum ada data presensi
              </p>
              <p className="text-[11px] text-[#68758B] my-0">
                Rekam presensi yang disimpan akan tampil di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((sess) => {
                const isExpanded = expandedSessionId === sess.id;
                const sum = sess.summary || {};
                const sessionStudents = sess.students || sess.students_data || [];
                const coachWasPresent = sess.coachAttended ?? sess.coach_attended ?? true;

                return (
                  <div
                    key={sess.id}
                    className="border border-[#E7EBF2] rounded-xl overflow-hidden bg-white"
                  >
                    <div
                      onClick={() => setExpandedSessionId(isExpanded ? null : sess.id)}
                      className="min-h-[48px] px-3 py-2.5 bg-[#F5F7FC]/70 cursor-pointer flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-bold text-[#17233D] truncate">
                          <Calendar className="w-3.5 h-3.5 text-[#2455E8] shrink-0" />
                          <span>{sess.date}</span>
                          <span className="text-[#68758B] font-normal">&middot;</span>
                          <span className="text-[11px] font-medium text-[#68758B] truncate">
                            {coachWasPresent ? 'Pelatih Hadir' : 'Pelatih Absen'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#68758B] font-medium mt-0.5 tabular-nums truncate">
                          {sum.hadir || 0} Hadir · {sum.izin || 0} Izin · {sum.sakit || 0} Sakit · {sum.alpa || 0} Alpa
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHistory(sess.id, sess.date);
                            }}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#68758B] hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            aria-label={`Hapus presensi tanggal ${sess.date}`}
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <span className="text-[#68758B] p-1">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3 border-t border-[#E7EBF2] bg-white space-y-2 text-xs">
                        {sess.notes && (
                          <p className="text-[#68758B] italic my-0 text-[11px]">
                            Catatan: &ldquo;{sess.notes}&rdquo;
                          </p>
                        )}
                        <div className="divide-y divide-[#E7EBF2]">
                          {sessionStudents.map((rec, idx) => {
                            const stStatus = rec.status === 'Alpha' ? 'Alpa' : (rec.status || 'Hadir');
                            const stColor =
                              stStatus === 'Hadir'
                                ? 'text-[#16A779]'
                                : stStatus === 'Izin'
                                ? 'text-[#2455E8]'
                                : stStatus === 'Sakit'
                                ? 'text-[#D97706]'
                                : 'text-[#DC4545]';
                            return (
                              <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                                <span className="font-medium text-[#17233D] truncate">{rec.studentName}</span>
                                <span className={`text-[11px] font-bold shrink-0 ${stColor}`}>
                                  {stStatus}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 text-left font-sans">
      
      {/* BANNER INFORMASI MODE BACA-SAJA UNTUK KELAS ARSIP */}
      {isArchived && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-xl font-medium flex items-center gap-2.5 shadow-2xs">
          <Archive className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          <span>Kelas ini telah diarsipkan. Mode baca-saja aktif untuk peninjauan riwayat presensi.</span>
        </div>
      )}

      {/* FORM PRESENSI UTAMA (CLEAN & MINIMALIST) */}
      <div className={`rounded-xl p-3 sm:p-3.5 border shadow-2xs space-y-3 ${
        isArchived 
          ? 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800' 
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
      }`}>
        
        {/* CONTROL BAR INLINE: DATE PICKER + TOGGLE SWITCH KEHADIRAN PELATIH */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-[#354944] dark:text-[#C89D32] shrink-0" />
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              {isArchived ? 'Presensi Sesi Latihan (Mode Baca-Saja)' : 'Presensi Sesi Latihan'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Picker Input */}
            <div className="relative flex items-center">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
              <input
                id="attendance-session-date"
                name="attendanceDate"
                aria-label="Tanggal Presensi"
                type="date"
                required
                disabled={isArchived}
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="pl-6 pr-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white focus:outline-none focus:border-[#354944] font-medium text-slate-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-75"
              />
            </div>

            {/* TOGGLE SWITCH ELEGAN (GAYA iOS/MANTINE) - PELATIH HADIR */}
            <label className={`inline-flex items-center gap-1.5 select-none bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 ${isArchived ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Pelatih Hadir</span>
              <button
                type="button"
                role="switch"
                disabled={isArchived}
                aria-checked={coachAttendance}
                onClick={() => {
                  if (!isArchived) setCoachAttendance(!coachAttendance);
                }}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                  isArchived ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                } ${
                  coachAttendance ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out shadow-2xs ${
                    coachAttendance ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* FEEDBACK NOTIFICATION ALERTS */}
        {successMsg && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveAttendance} className="space-y-3">
          
          {/* CATATAN / MATERI SESI */}
          <div>
            <input
              id="attendance-session-notes"
              name="sessionNotes"
              aria-label="Catatan atau Materi Latihan Hari Ini"
              type="text"
              disabled={isArchived}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder={isArchived ? "Catatan sesi dinonaktifkan (kelas diarsipkan)" : "Catatan / materi latihan hari ini (opsional)..."}
              className="w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white focus:outline-none focus:border-[#354944] text-slate-700 dark:text-slate-200 font-medium disabled:cursor-not-allowed disabled:opacity-75"
            />
          </div>

          {/* DAFTAR PRESENSI SISWA */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Siswa ({classStudents.length})
                </span>

                {/* TOGGLE SISWA BELUM AKTIF / NON-AKTIF */}
                <label htmlFor="attendance-show-inactive-students" className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input
                    id="attendance-show-inactive-students"
                    name="showInactiveStudents"
                    type="checkbox"
                    checked={showInactiveStudents}
                    onChange={(e) => setShowInactiveStudents(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-300 text-[#354944] focus:ring-[#354944] cursor-pointer"
                  />
                  <span>Tampilkan Non-Aktif</span>
                </label>
              </div>

              {/* Quick action buttons - Hanya aktif pada kelas aktif */}
              {!isArchived && classStudents.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSetAllStudents('Hadir')}
                    className="text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                  >
                    Set Semua Hadir
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => handleSetAllStudents('Izin')}
                    className="text-amber-600 hover:text-amber-700 font-bold cursor-pointer"
                  >
                    Set Semua Izin
                  </button>
                </div>
              )}
            </div>

            {/* IF NO STUDENTS IN CLASS */}
            {classStudents.length === 0 ? (
              <div className="py-5 border border-dashed border-slate-200 rounded-xl text-center p-3 bg-slate-50/50">
                <User className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-600">
                  Belum ada siswa terdaftar di kelas ini.
                </p>
              </div>
            ) : (
              /* CLEAN COMPACT STUDENT LIST */
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {classStudents.map((st, idx) => {
                  const currentStatus = studentAttendance[st.id] || 'Hadir';
                  const isInactive = 
                    st.status === 'Non-Aktif' || 
                    st.status === 'Nonaktif' || 
                    st.status === 'Belum Aktif' || 
                    st.status === 'inactive' || 
                    st.isActive === false;

                  return (
                    <div 
                      key={st.id} 
                      className="py-1.5 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">{st.studentName}</p>
                            {isInactive && (
                              <span className="px-1 py-0.2 text-[8px] font-bold uppercase bg-slate-200 text-slate-600 rounded">
                                Non-Aktif
                              </span>
                            )}
                          </div>
                          {calculateAge(st.birthDate) !== '-' && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              Usia: {calculateAge(st.birthDate)} thn
                            </p>
                          )}
                        </div>
                      </div>

                      {/* SEGMENTED CONTROL (HADIR, IZIN, SAKIT, ALPA) */}
                      <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 p-0.5 rounded-lg grid grid-cols-4 sm:flex items-center gap-0.5 shrink-0">
                        
                        {/* 1. HADIR */}
                        <button
                          type="button"
                          disabled={isArchived}
                          onClick={() => handleStudentStatusChange(st.id, 'Hadir')}
                          className={`py-0.5 px-2 rounded text-[11px] font-medium transition-all text-center ${
                            isArchived ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                          } ${
                            currentStatus === 'Hadir'
                              ? 'bg-emerald-500 text-white shadow-2xs font-bold'
                              : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          Hadir
                        </button>

                        {/* 2. IZIN */}
                        <button
                          type="button"
                          disabled={isArchived}
                          onClick={() => handleStudentStatusChange(st.id, 'Izin')}
                          className={`py-0.5 px-2 rounded text-[11px] font-medium transition-all text-center ${
                            isArchived ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                          } ${
                            currentStatus === 'Izin'
                              ? 'bg-[#354944] text-white shadow-2xs font-bold'
                              : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          Izin
                        </button>

                        {/* 3. SAKIT */}
                        <button
                          type="button"
                          disabled={isArchived}
                          onClick={() => handleStudentStatusChange(st.id, 'Sakit')}
                          className={`py-0.5 px-2 rounded text-[11px] font-medium transition-all text-center ${
                            isArchived ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                          } ${
                            currentStatus === 'Sakit'
                              ? 'bg-amber-500 text-white shadow-2xs font-bold'
                              : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          Sakit
                        </button>

                        {/* 4. ALPA */}
                        <button
                          type="button"
                          disabled={isArchived}
                          onClick={() => handleStudentStatusChange(st.id, 'Alpa')}
                          className={`py-0.5 px-2 rounded text-[11px] font-medium transition-all text-center ${
                            isArchived ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                          } ${
                            currentStatus === 'Alpa' || currentStatus === 'Alpha'
                              ? 'bg-rose-500 text-white shadow-2xs font-bold'
                              : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          Alpa
                        </button>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SIMPAN PRESENSI BUTTON (DESKTOP) */}
          <div className="pt-0.5 hidden lg:flex justify-end">
            <button
              type="submit"
              disabled={isArchived || isSaving || classStudents.length === 0}
              className={`px-4 py-1.5 border-b-2 font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 ${
                isArchived
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-400 dark:border-slate-700 cursor-not-allowed opacity-80'
                  : 'bg-[#354944] hover:bg-[#2B3D38] border-[#C89D32] text-white cursor-pointer disabled:opacity-50'
              }`}
              title={isArchived ? 'Mode baca-saja: Kelas diarsipkan' : 'Simpan Presensi'}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Menyimpan...</span>
                </>
              ) : isArchived ? (
                <span>Presensi Terkunci (Mode Baca-Saja)</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Presensi</span>
                </>
              )}
            </button>
          </div>

          {/* FLOATING SAVE BAR FOR MOBILE (< 1024px) - HANYA PADA KELAS AKTIF */}
          {!isArchived && (
            <div className="lg:hidden fixed bottom-16 inset-x-4 z-30 bg-[#354944] text-white py-3 px-4 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm border-b-2 border-[#C89D32]">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#C89D32]" />
                <span>Presensi ({classStudents.length} Siswa)</span>
              </div>
              <button
                type="submit"
                disabled={isSaving || classStudents.length === 0}
                className="px-4 py-1.5 bg-[#C89D32] hover:bg-[#b58c2b] text-slate-900 font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          )}

        </form>
      </div>

      {/* RIWAYAT PRESENSI */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <h4 className="font-bold text-xs text-slate-800">
              Riwayat Presensi ({history.length})
            </h4>
          </div>
        </div>

        {loadingHistory ? (
          <p className="py-4 text-center text-xs text-slate-400 font-medium">Memuat riwayat...</p>
        ) : history.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            Belum ada rekam presensi disimpan.
          </p>
        ) : (
          <div className="space-y-1.5">
            {history.map((sess) => {
              const isExpanded = expandedSessionId === sess.id;
              const sum = sess.summary || {};

              return (
                <div 
                  key={sess.id} 
                  className="border border-slate-200/80 rounded-xl overflow-hidden bg-white hover:border-slate-300 transition-all"
                >
                  <div 
                    onClick={() => setExpandedSessionId(isExpanded ? null : sess.id)}
                    className="p-2.5 bg-slate-50/60 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 font-semibold text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>{sess.date}</span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 text-[11px]">
                        {sess.coachName || 'Pelatih'} {sess.coachAttended ? '(Hadir)' : '(Absen)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* SUMMARY BADGES */}
                      <div className="flex items-center gap-1 text-[10px] font-medium">
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200/60">
                          {sum.hadir || 0} Hadir
                        </span>
                        {(sum.izin || 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200/60">
                            {sum.izin} Izin
                          </span>
                        )}
                        {(sum.sakit || 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200/60">
                            {sum.sakit} Sakit
                          </span>
                        )}
                        {(sum.alpa || 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-200/60">
                            {sum.alpa} Alpa
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHistory(sess.id, sess.date);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-slate-400">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* EXPANDED BREAKDOWN PER STUDENT */}
                  {isExpanded && (
                    <div className="p-2.5 border-t border-slate-100 bg-white space-y-1.5 text-xs">
                      {sess.notes && (
                        <p className="text-slate-500 italic mb-1 text-[11px]">
                          Catatan: "{sess.notes}"
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                        {sess.students?.map((rec, idx) => {
                          let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          if (rec.status === 'Izin') badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                          if (rec.status === 'Sakit') badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
                          if (rec.status === 'Alpa' || rec.status === 'Alpha') badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';

                          return (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100 text-xs">
                              <span className="font-medium text-slate-700">{rec.studentName}</span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${badgeStyle}`}>
                                {rec.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
