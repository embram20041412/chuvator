import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Calendar,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Filter,
  Loader2,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Edit3,
  Check,
  Search,
  History
} from 'lucide-react';
import MobileBottomSheet from '../MobileBottomSheet';
import { calculateAge } from '../../../utils/helpers';

function formatDateId(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
}

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A & B. Konteks Evaluasi + Pemilih Atlet Ringkas dengan Bottom Sheet Pencarian
 */
export function MobileEvaluationContextBar({
  selectedClass,
  students = [],
  selectedStudent,
  onSelectStudentId,
  evaluationDate,
  onChangeDate,
  tierValue,
  onChangeTier,
  tierOptions = [],
  evaluatedStudentIdsToday = new Set(),
  history = [],
  isArchived = false,
  positionBadge = '',
  sportLabel = ''
}) {
  const [isAthleteSheetOpen, setIsAthleteSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentIndex = useMemo(() => {
    if (!selectedStudent || students.length === 0) return -1;
    return students.findIndex((s) => s.id === selectedStudent.id);
  }, [students, selectedStudent]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectStudentId(students[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < students.length - 1) {
      onSelectStudentId(students[currentIndex + 1].id);
    }
  };

  const evaluatedStudentIdsAny = useMemo(() => {
    return new Set((history || []).map((h) => h.studentId));
  }, [history]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((st) => {
      const name = String(st.studentName || st.name || '').toLowerCase();
      const pos = String(st.playerRole || st.position || '').toLowerCase();
      return name.includes(q) || pos.includes(q);
    });
  }, [students, searchQuery]);

  const studentAge = useMemo(() => {
    if (!selectedStudent) return null;
    if (selectedStudent.birthDate) {
      const calc = calculateAge(selectedStudent.birthDate);
      if (calc && calc !== '-') return `${calc}`.replace(/\D/g, '') || null;
    }
    return selectedStudent.age || selectedStudent.umur || null;
  }, [selectedStudent]);

  return (
    <div className="chua-m-eval-card space-y-2.5">
      {/* Row 1: Compact Context Meta (Active Class, Sport, Position/Role) */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-[#17233D] truncate">
            {selectedClass?.className || selectedClass?.name || 'Kelas Aktif'}
          </span>
          {sportLabel && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F7FC] text-[#2455E8] border border-[#E7EBF2] shrink-0">
              {sportLabel}
            </span>
          )}
        </div>
        {students.length > 0 && (
          <span className="font-mono text-[11px] font-bold text-[#68758B] shrink-0">
            Atlet {currentIndex >= 0 ? currentIndex + 1 : 1}/{students.length}
          </span>
        )}
      </div>

      {/* Row 2: Compact Searchable Athlete Selector + Quick Prev/Next */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="chua-m-eval-nav-icon-btn"
          aria-label="Atlet sebelumnya"
          title="Atlet sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setIsAthleteSheetOpen(true);
          }}
          className="chua-m-eval-athlete-trigger flex-1 min-w-0"
          aria-label="Pilih atlet evaluasi"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[#101D38] text-white font-bold text-[12px] flex items-center justify-center shrink-0">
              {getInitials(selectedStudent?.studentName || selectedStudent?.name)}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[13px] text-[#17233D] truncate leading-tight">
                {selectedStudent?.studentName || selectedStudent?.name || 'Pilih Atlet'}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#68758B] font-medium truncate mt-0.5">
                {studentAge && <span>{studentAge} Thn</span>}
                {studentAge && positionBadge && <span>&bull;</span>}
                {positionBadge && (
                  <span className="font-bold text-[#2455E8] truncate">{positionBadge}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold text-[#2455E8] shrink-0">
            <span>Ganti</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex < 0 || currentIndex >= students.length - 1}
          className="chua-m-eval-nav-icon-btn"
          aria-label="Atlet berikutnya"
          title="Atlet berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Row 3: Evaluation Date & Curriculum Tier Selector */}
      <div className={`grid ${tierOptions.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
        <div className="chua-m-eval-control-pill">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Calendar className="w-3.5 h-3.5 text-[#2455E8] shrink-0" />
            <input
              type="date"
              aria-label="Tanggal evaluasi"
              disabled={isArchived}
              value={evaluationDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="w-full bg-transparent text-[12px] font-bold text-[#17233D] focus:outline-none cursor-pointer disabled:opacity-60 min-w-0"
            />
          </div>
        </div>

        {tierOptions.length > 0 && (
          <div className="chua-m-eval-control-pill">
            <GraduationCap className="w-3.5 h-3.5 text-[#2455E8] shrink-0" />
            <select
              aria-label="Jenjang evaluasi"
              disabled={isArchived}
              value={tierValue}
              onChange={(e) => onChangeTier(e.target.value)}
              className="w-full bg-transparent text-[12px] font-bold text-[#17233D] focus:outline-none truncate cursor-pointer disabled:opacity-60 min-w-0"
            >
              {tierOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bottom Sheet: Searchable Athlete Selector */}
      <MobileBottomSheet
        isOpen={isAthleteSheetOpen}
        onClose={() => setIsAthleteSheetOpen(false)}
        title={`Pilih Atlet (${students.length})`}
        subtitle={selectedClass?.className || selectedClass?.name || 'Daftar atlet kelas aktif'}
      >
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#68758B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atlet atau posisi..."
              aria-label="Cari nama atlet"
              className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[12px] text-[13px] font-medium text-[#17233D] focus:bg-white focus:border-[#2455E8] focus:outline-none"
            />
          </div>

          {/* Athlete List */}
          <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-0.5">
            {filteredStudents.length === 0 ? (
              <div className="py-6 text-center text-[12px] text-[#68758B] font-medium">
                Atlet tidak ditemukan.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const isSelected = st.id === selectedStudent?.id;
                const isEvaluatedToday = evaluatedStudentIdsToday.has(st.id);
                const hasAnyEval = evaluatedStudentIdsAny.has(st.id);
                const pos = st.playerRole || st.position || '';
                const ageVal = st.birthDate ? calculateAge(st.birthDate) : (st.age || st.umur || '');

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onSelectStudentId(st.id);
                      setIsAthleteSheetOpen(false);
                    }}
                    className={`w-full min-h-[52px] p-2.5 rounded-[12px] border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2455E8]/8 border-[#2455E8]'
                        : 'bg-white border-[#E7EBF2]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-[10px] font-bold text-[12px] flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#2455E8] text-white'
                            : 'bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2]'
                        }`}
                      >
                        {getInitials(st.studentName || st.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[13px] text-[#17233D] truncate">
                          {st.studentName || st.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#68758B] font-medium truncate">
                          {ageVal && ageVal !== '-' && <span>{String(ageVal).replace(/\D/g, '')} Thn</span>}
                          {pos && <span>• {pos}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEvaluatedToday ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#16A779]/15 text-[#16A779]">
                          Hari Ini
                        </span>
                      ) : hasAnyEval ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2]">
                          Terisi
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-[#68758B]">
                          Baru
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-[#2455E8]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
}

/**
 * C. Ringkasan Skor Utama (Chuvator Score 0-100, Grade Aktual, Identitas & Konteks Taktis)
 */
export function MobileScoreHeroCard({
  studentName = '',
  overallScore = 0,
  gradeText = 'B (Baik)',
  positionLabel = '',
  tacticalRoleLabel = '',
  tierShortLabel = '',
  latestEvalDate = null,
  evaluationDate = '',
  onOpenEdit,
  isArchived = false
}) {
  const gradeLetter = String(gradeText).split(' ')[0] || 'B';

  return (
    <div className="chua-m-eval-score-hero space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#93B4FF]">
              Chuvator Score
            </span>
            {latestEvalDate ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#16A779]/20 text-[#6EE7B7] border border-[#16A779]/40">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Riwayat {formatDateId(latestEvalDate)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-slate-300">
                <span>Sesi {formatDateId(evaluationDate)}</span>
              </span>
            )}
          </div>

          <h3 className="font-extrabold text-[16px] text-white leading-snug truncate my-0">
            {studentName}
          </h3>

          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {positionLabel && (
              <span className="px-2 py-0.5 rounded-[8px] text-[11px] font-bold bg-[#2455E8] text-white">
                {positionLabel}
              </span>
            )}
            {tacticalRoleLabel && (
              <span className="px-2 py-0.5 rounded-[8px] text-[11px] font-semibold bg-white/10 text-slate-200 truncate max-w-[180px]">
                {tacticalRoleLabel}
              </span>
            )}
            {tierShortLabel && (
              <span className="px-2 py-0.5 rounded-[8px] text-[11px] font-medium bg-white/10 text-slate-300">
                {tierShortLabel}
              </span>
            )}
          </div>
        </div>

        {/* Focal Score & Grade */}
        <div className="text-right shrink-0 bg-white/8 border border-white/15 rounded-[14px] px-3 py-2">
          <div className="flex items-baseline justify-end gap-0.5">
            <span className="font-mono text-[28px] font-black leading-none text-white tabular-nums">
              {overallScore}
            </span>
            <span className="text-[11px] font-bold text-slate-300">/100</span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#16A779] text-white text-[10px] font-extrabold">
            <span>Grade {gradeLetter}</span>
          </div>
        </div>
      </div>

      {/* Subtle Progress Bar + Quick Edit Trigger */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium truncate">{gradeText}</span>
            <span className="font-mono font-bold text-white">{overallScore}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16A779] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, overallScore))}%` }}
            />
          </div>
        </div>

        {onOpenEdit && !isArchived && (
          <button
            type="button"
            onClick={() => onOpenEdit()}
            className="min-h-[44px] px-3 py-2 rounded-[10px] bg-white text-[#101D38] text-[12px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#2455E8]" />
            <span>Posisi &amp; Preset</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * F & G. Catatan Pelatih dan AI Insight (Terpisah Jelas) + Simpan Evaluasi dengan Status
 */
export function MobileAiAndCoachNotesSection({
  studentId,
  studentName = 'Atlet',
  coachNote = '',
  onChangeCoachNote,
  onGenerateAiDraft,
  isSaving = false,
  isArchived = false,
  hasUnsavedChanges = false,
  latestEvalDate = null,
  errorMsg = null,
  successMsg = null,
  saveButtonLabel = 'Simpan Evaluasi Atlet'
}) {
  const [aiInsight, setAiInsight] = useState('');

  // Reset AI Insight box when switching athletes so previous athlete's draft never leaks
  useEffect(() => {
    setAiInsight('');
  }, [studentId]);

  const handleTriggerAiDraft = () => {
    if (onGenerateAiDraft) {
      const generated = onGenerateAiDraft();
      if (typeof generated === 'string' && generated.trim()) {
        setAiInsight(generated);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. AI INSIGHT & REKOMENDASI CARD (TERPISAH DARI CATATAN MANUAL) */}
      <div className="chua-m-eval-card space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-[10px] bg-[#2455E8]/10 text-[#2455E8] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[13px] text-[#17233D] leading-tight truncate my-0">
                AI Scouting Insight
              </h3>
              <p className="text-[11px] text-[#68758B] font-medium truncate my-0 mt-0.5">
                Analisis otomatis kekuatan &amp; area fokus latihan
              </p>
            </div>
          </div>

          {!isArchived && (
            <button
              type="button"
              onClick={handleTriggerAiDraft}
              className="chua-m-eval-secondary-btn shrink-0 !border-[#2455E8]/30 !text-[#2455E8]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiInsight ? 'Perbarui AI' : 'Buat Draf AI'}</span>
            </button>
          )}
        </div>

        {aiInsight ? (
          <div className="p-3 rounded-[12px] bg-[#F5F7FC] border border-[#E7EBF2] space-y-2">
            <p className="text-[12px] text-[#17233D] font-medium leading-relaxed whitespace-pre-line my-0">
              {aiInsight}
            </p>
          </div>
        ) : (
          <div className="px-3 py-2.5 rounded-[12px] bg-[#F5F7FC] border border-dashed border-[#E7EBF2] text-[11px] text-[#68758B] font-medium">
            Ketuk <strong>Buat Draf AI</strong> untuk menyusun ringkasan analisis berdasarkan skor indikator {studentName}.
          </div>
        )}
      </div>

      {/* 2. CATATAN PELATIH & PENYIMPANAN EVALUASI */}
      <div className="chua-m-eval-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="mobile-evaluation-coach-note"
            className="text-[13px] font-bold text-[#17233D] flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-[#2455E8] shrink-0" />
            <span>Catatan Pelatih</span>
          </label>

          {/* Saved / Unsaved Status Pill */}
          {hasUnsavedChanges ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Belum Disimpan
            </span>
          ) : latestEvalDate ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#16A779] border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Tersimpan ({formatDateId(latestEvalDate)})</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F7FC] text-[#68758B] border border-[#E7EBF2]">
              Belum Ada Riwayat
            </span>
          )}
        </div>

        <textarea
          id="mobile-evaluation-coach-note"
          name="coachNote"
          aria-label="Catatan pelatih"
          disabled={isArchived}
          rows={3}
          value={coachNote}
          onChange={(e) => onChangeCoachNote(e.target.value)}
          placeholder={`Tulis evaluasi dan rekomendasi latihan untuk ${studentName}...`}
          className="w-full p-3 text-[13px] bg-[#F5F7FC] border border-[#E7EBF2] rounded-[12px] focus:bg-white focus:border-[#2455E8] focus:outline-none font-medium text-[#17233D] leading-relaxed disabled:opacity-60"
        />

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[12px] rounded-[12px] font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] rounded-[12px] font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A779] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving || isArchived}
          className="chua-m-eval-primary-btn"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Menyimpan Evaluasi...</span>
            </>
          ) : isArchived ? (
            <span>Evaluasi Terkunci (Baca-Saja)</span>
          ) : (
            <>
              <Award className="w-4 h-4 text-white" />
              <span>{saveButtonLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * G. Riwayat Evaluasi dengan Progressive Disclosure (Tidak Memenuhi Halaman Utama)
 */
export function MobileEvaluationHistorySection({
  history = [],
  loadingHistory = false,
  filterStudentId = 'ALL',
  setFilterStudentId,
  students = [],
  onDeleteEvaluation,
  isArchived = false,
  getScoreGradeFn,
  defaultOpen = false
}) {
  const [isSectionOpen, setIsSectionOpen] = useState(() => Boolean(defaultOpen));
  const [expandedIds, setExpandedIds] = useState({});

  const toggleDetail = (id) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredHistory = useMemo(() => {
    return filterStudentId === 'ALL'
      ? history
      : history.filter((h) => h.studentId === filterStudentId);
  }, [history, filterStudentId]);

  return (
    <div className="chua-m-eval-card !p-0 overflow-hidden">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsSectionOpen(!isSectionOpen)}
        className="w-full min-h-[54px] px-3.5 py-3 flex items-center justify-between gap-2 text-left bg-white cursor-pointer"
        aria-expanded={isSectionOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-[#F5F7FC] border border-[#E7EBF2] text-[#101D38] flex items-center justify-center shrink-0">
            <History className="w-4 h-4 text-[#2455E8]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[13px] text-[#17233D] truncate">
                Riwayat Evaluasi
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F7FC] text-[#2455E8] border border-[#E7EBF2]">
                {filteredHistory.length}
              </span>
            </div>
            <p className="text-[11px] text-[#68758B] font-medium truncate my-0 mt-0.5">
              {isSectionOpen ? 'Ketuk untuk menutup daftar riwayat' : 'Ketuk untuk melihat riwayat penilaian kelas'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-bold text-[#2455E8] shrink-0">
          <span>{isSectionOpen ? 'Tutup' : 'Buka'}</span>
          {isSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isSectionOpen && (
        <div className="p-3.5 pt-3 border-t border-[#E7EBF2] bg-[#F5F7FC]/50 space-y-3">
          {/* Athlete Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-[12px] border border-[#E7EBF2] min-h-[44px]">
            <Filter className="w-3.5 h-3.5 text-[#68758B] shrink-0" />
            <select
              aria-label="Filter riwayat atlet"
              value={filterStudentId}
              onChange={(e) => setFilterStudentId && setFilterStudentId(e.target.value)}
              className="w-full bg-transparent text-[12px] font-bold text-[#17233D] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Atlet ({history.length})</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.studentName || st.name}
                </option>
              ))}
            </select>
          </div>

          {loadingHistory ? (
            <div className="py-5 text-center text-[12px] text-[#68758B] font-medium">
              Memuat riwayat evaluasi...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-5 text-center text-[12px] text-[#68758B] bg-white border border-dashed border-[#E7EBF2] rounded-[12px] p-3">
              Belum ada riwayat evaluasi tersimpan.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((item) => {
                const ps = item.pillarScores || {};
                const gradeInfo = getScoreGradeFn
                  ? getScoreGradeFn(item.overallScore || 0)
                  : { grade: 'B', badge: 'bg-emerald-100 text-emerald-800' };
                const isExpanded = Boolean(expandedIds[item.id]);

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-[14px] border border-[#E7EBF2] bg-white space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-[13px] text-[#17233D] truncate my-0">
                            {item.studentName}
                          </h4>
                          {item.playerRole && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#F5F7FC] text-[#2455E8] border border-[#E7EBF2]">
                              {item.playerRole}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#68758B] flex items-center gap-1 mt-0.5 truncate my-0">
                          <Calendar className="w-3 h-3 text-[#2455E8] shrink-0" />
                          <span>{formatDateId(item.date)}</span>
                          <span>&bull;</span>
                          <span className="truncate">{item.evaluator || 'Pelatih'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="text-right mr-1">
                          <span className="font-mono text-[13px] font-extrabold text-[#17233D] block">
                            {item.overallScore || 0}/100
                          </span>
                          <span className="text-[10px] font-bold text-[#16A779]">
                            Grade {String(gradeInfo.grade).split(' ')[0]}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleDetail(item.id)}
                          className="min-h-[44px] px-2.5 py-1.5 text-[11px] font-bold text-[#17233D] bg-[#F5F7FC] border border-[#E7EBF2] rounded-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Tutup' : 'Detail'}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {!isArchived && onDeleteEvaluation && (
                          <button
                            type="button"
                            onClick={() => onDeleteEvaluation(item.id, item.studentName)}
                            aria-label={`Hapus evaluasi ${item.studentName}`}
                            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#68758B] hover:text-rose-600 bg-[#F5F7FC] rounded-[10px] border border-[#E7EBF2] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 border-t border-[#E7EBF2] space-y-2">
                        {ps.fisik !== undefined && ps.komunikasi !== undefined ? (
                          <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                            <div className="p-1.5 bg-[#F5F7FC] text-[#17233D] rounded-[8px] border border-[#E7EBF2]">
                              <span className="block text-[9px] text-[#68758B]">Fisik</span>
                              <span>{ps.fisik}</span>
                            </div>
                            <div className="p-1.5 bg-[#F5F7FC] text-[#17233D] rounded-[8px] border border-[#E7EBF2]">
                              <span className="block text-[9px] text-[#68758B]">Teknik</span>
                              <span>{ps.teknik}</span>
                            </div>
                            <div className="p-1.5 bg-[#F5F7FC] text-[#17233D] rounded-[8px] border border-[#E7EBF2]">
                              <span className="block text-[9px] text-[#68758B]">Taktik</span>
                              <span>{ps.taktik}</span>
                            </div>
                            <div className="p-1.5 bg-[#F5F7FC] text-[#17233D] rounded-[8px] border border-[#E7EBF2]">
                              <span className="block text-[9px] text-[#68758B]">Mental</span>
                              <span>{ps.mental}</span>
                            </div>
                            <div className="p-1.5 bg-[#F5F7FC] text-[#17233D] rounded-[8px] border border-[#E7EBF2]">
                              <span className="block text-[9px] text-[#68758B]">Dev</span>
                              <span>{ps.perkembangan}</span>
                            </div>
                            <div className="p-1.5 bg-[#F5F7FC] text-[#17233D] rounded-[8px] border border-[#E7EBF2]">
                              <span className="block text-[9px] text-[#68758B]">Kom</span>
                              <span>{ps.komunikasi}</span>
                            </div>
                            <div className="p-1.5 bg-[#F5F7FC] text-[#17233D] rounded-[8px] border border-[#E7EBF2] col-span-2">
                              <span className="block text-[9px] text-[#68758B]">Posisi</span>
                              <span>{ps.khususPosisi || ps.position || 0}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-bold">
                            <div className="p-1.5 bg-[#F5F7FC] rounded-[8px]">Fisik: {ps.fisik || 0}</div>
                            <div className="p-1.5 bg-[#F5F7FC] rounded-[8px]">Teknik: {ps.teknik || 0}</div>
                            <div className="p-1.5 bg-[#F5F7FC] rounded-[8px]">Taktik: {ps.taktik || 0}</div>
                            <div className="p-1.5 bg-[#F5F7FC] rounded-[8px]">Mental: {ps.mental || 0}</div>
                            <div className="p-1.5 bg-[#F5F7FC] rounded-[8px] col-span-2">Posisi: {ps.position || ps.khususPosisi || 0}</div>
                          </div>
                        )}

                        {item.coachNote && (
                          <div className="p-2.5 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[10px] text-[11px] text-[#17233D] leading-relaxed whitespace-pre-line">
                            <strong className="block text-[10px] uppercase font-bold text-[#68758B] mb-0.5">
                              Catatan Pelatih:
                            </strong>
                            {item.coachNote}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
