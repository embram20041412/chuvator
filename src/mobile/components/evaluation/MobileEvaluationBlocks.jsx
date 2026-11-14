import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  CheckCircle2,
  Sparkles,
  Trash2,
  Eye,
  X,
  Users,
  Award,
  MessageSquare,
  Loader2,
  AlertCircle,
  Edit3,
  GraduationCap,
  Layers,
  ArrowRight
} from 'lucide-react';
import MobileBottomSheet from '../MobileBottomSheet';
import { getCategoryTheme } from '../../../components/ScoutingPolarAreaPanel';

function formatShortDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name = '') {
  const parts = String(name || 'Atlet')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * 1. MobileEvaluationContextBar
 * Header & Konteks Atlet untuk Mobile (<= 767px)
 * Dilengkapi Bottom Sheet pemilihan atlet, prev/next, tanggal evaluasi, dan fase usia.
 */
export function MobileEvaluationContextBar({
  selectedClass,
  activeAcademy,
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
  sportLabel = '',
  studentAge = null,
  compactMode = false
}) {
  const [showAthleteSheet, setShowAthleteSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentIdx = useMemo(() => {
    if (!selectedStudent?.id) return -1;
    return students.findIndex((s) => s.id === selectedStudent.id);
  }, [students, selectedStudent?.id]);

  const handlePrevStudent = () => {
    if (currentIdx > 0 && onSelectStudentId) {
      onSelectStudentId(students[currentIdx - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (currentIdx >= 0 && currentIdx < students.length - 1 && onSelectStudentId) {
      onSelectStudentId(students[currentIdx + 1].id);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((st) => {
      const name = (st.studentName || st.name || '').toLowerCase();
      const role = (st.playerRole || st.position || '').toLowerCase();
      return name.includes(q) || role.includes(q);
    });
  }, [students, searchQuery]);

  const latestScoreByStudentId = useMemo(() => {
    const map = {};
    (history || []).forEach((h) => {
      if (!h.studentId) return;
      if (!map[h.studentId]) {
        map[h.studentId] = h;
      }
    });
    return map;
  }, [history]);

  const academyName = activeAcademy?.name || sportLabel || 'Akademi';
  const className = selectedClass?.className || 'Kelas Latihan';

  return (
    <div className="chua-m-eval-card space-y-2">
      {/* Top Row: Title, Academy & Class Context (Hidden in compactMode to avoid duplicate header height) */}
      {!compactMode && (
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7EBF2]">
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-[#17233D] tracking-tight my-0">
              Evaluasi Atlet
            </h2>
            <p className="text-[11px] font-medium text-[#68758B] truncate my-0 mt-0.5">
              {academyName} &bull; {className}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {positionBadge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2455E8]/10 text-[#2455E8]">
                {positionBadge}
              </span>
            )}
            {isArchived && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Arsip
              </span>
            )}
          </div>
        </div>
      )}

      {/* Athlete Selector Row: Prev + BottomSheet Trigger + Next */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handlePrevStudent}
          disabled={currentIdx <= 0}
          aria-label="Atlet Sebelumnya"
          className="chua-m-eval-nav-icon-btn"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowAthleteSheet(true)}
          className="chua-m-eval-athlete-trigger flex-1 min-w-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#101D38] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {getInitials(selectedStudent?.studentName || selectedStudent?.name)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2455E8]">
                  Atlet {currentIdx >= 0 ? `${currentIdx + 1}/${students.length}` : ''}
                </span>
                {studentAge ? (
                  <span className="text-[10px] font-semibold text-[#68758B]">
                    &bull; {studentAge} Thn
                  </span>
                ) : null}
                {selectedStudent && evaluatedStudentIdsToday.has(selectedStudent.id) && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-[#16A779] border border-emerald-200 shrink-0">
                    Terisi
                  </span>
                )}
              </div>
              <p className="text-[13px] font-bold text-[#17233D] truncate my-0">
                {selectedStudent?.studentName || selectedStudent?.name || 'Pilih Atlet'}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-[#68758B] shrink-0" />
        </button>

        <button
          type="button"
          onClick={handleNextStudent}
          disabled={currentIdx < 0 || currentIdx >= students.length - 1}
          aria-label="Atlet Berikutnya"
          className="chua-m-eval-nav-icon-btn"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Controls Row: Date & Development Phase (Only shown in full report mode) */}
      {!compactMode && (
        <div
          className={`grid gap-2 ${
            tierOptions && tierOptions.length > 0 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <div className="chua-m-eval-control-pill min-h-[44px]">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Calendar className="w-3.5 h-3.5 text-[#2455E8] shrink-0" />
              <input
                type="date"
                aria-label="Tanggal Evaluasi"
                disabled={isArchived}
                value={evaluationDate || ''}
                onChange={(e) => onChangeDate && onChangeDate(e.target.value)}
                className="w-full bg-transparent text-[12px] font-bold text-[#17233D] focus:outline-none cursor-pointer disabled:opacity-60"
              />
            </div>
          </div>

          {tierOptions && tierOptions.length > 0 && (
            <div className="chua-m-eval-control-pill min-h-[44px]">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <GraduationCap className="w-3.5 h-3.5 text-[#16A779] shrink-0" />
                <select
                  aria-label="Fase Usia Evaluasi"
                  disabled={isArchived}
                  value={tierValue || 'AUTO'}
                  onChange={(e) => onChangeTier && onChangeTier(e.target.value)}
                  className="w-full bg-transparent text-[12px] font-bold text-[#17233D] focus:outline-none truncate cursor-pointer disabled:opacity-60"
                >
                  {tierOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Sheet: Pilih Atlet */}
      <MobileBottomSheet
        isOpen={showAthleteSheet}
        onClose={() => {
          setShowAthleteSheet(false);
          setSearchQuery('');
        }}
        title="Pilih Atlet Evaluasi"
        subtitle={`${students.length} atlet terdaftar di ${className}`}
      >
        <div className="space-y-3">
          {students.length > 4 && (
            <div className="chua-mobile-search-bar !mb-2">
              <Search className="w-4 h-4 chua-mobile-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau posisi atlet..."
                className="chua-mobile-input-field chua-mobile-search-input !h-[48px] !text-[13px]"
              />
            </div>
          )}

          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-0.5">
            {filteredStudents.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#68758B] font-medium">
                Atlet tidak ditemukan.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const isSelected = st.id === selectedStudent?.id;
                const isEvaluatedToday = evaluatedStudentIdsToday.has(st.id);
                const latestDoc = latestScoreByStudentId[st.id];
                const pos = st.playerRole || st.position || '';

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      if (onSelectStudentId) onSelectStudentId(st.id);
                      setShowAthleteSheet(false);
                      setSearchQuery('');
                    }}
                    className={`w-full min-h-[54px] p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2455E8]/8 border-[#2455E8]'
                        : 'bg-[#FFFFFF] border-[#E7EBF2] active:bg-[#F5F7FC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-[#2455E8] text-white'
                            : 'bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2]'
                        }`}
                      >
                        {getInitials(st.studentName || st.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#17233D] truncate my-0">
                          {st.studentName || st.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {pos && (
                            <span className="text-[10px] font-semibold text-[#68758B]">
                              Posisi: {pos}
                            </span>
                          )}
                          {latestDoc?.overallScore !== undefined && (
                            <span className="text-[10px] font-bold text-[#2455E8] font-mono">
                              &bull; Skor: {latestDoc.overallScore}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEvaluatedToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#16A779] border border-emerald-200">
                          Terisi
                        </span>
                      )}
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#2455E8]" />}
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
 * 2. MobileScoreHeroCard
 * Ringkasan Performa Atlet (Skor Keseluruhan, Grade, Cakupan Indikator, Evaluasi Terakhir)
 */
export function MobileScoreHeroCard({
  studentName,
  overallScore = 0,
  gradeText = 'B',
  positionLabel = '',
  tacticalRoleLabel = '',
  tierShortLabel = '',
  latestEvalDate = null,
  evaluationDate = null,
  measuredCount = 0,
  totalIndicators = 0,
  onOpenEdit,
  isArchived = false
}) {
  const cleanGradeCode = String(gradeText || 'B').split(' ')[0];
  const hasScore = overallScore > 0 || measuredCount > 0;

  return (
    <div className="chua-m-eval-score-hero space-y-3">
      {/* Top Row: Athlete Name, Role & Score */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {positionLabel && (
              <span className="chua-m-eval-score-badge-pill bg-[#2455E8] text-white">
                {positionLabel}
              </span>
            )}
            {tierShortLabel && (
              <span className="chua-m-eval-score-badge-pill bg-white/12 text-slate-200">
                {tierShortLabel}
              </span>
            )}
          </div>

          <h3 className="text-[16px] font-extrabold text-white tracking-tight truncate my-0">
            {studentName || 'Atlet'}
          </h3>

          {tacticalRoleLabel && (
            <p className="text-[11px] text-slate-300 font-medium truncate my-0">
              {tacticalRoleLabel}
            </p>
          )}
        </div>

        {/* Big Numeric Score Pill */}
        <div className="bg-white/10 border border-white/15 rounded-2xl px-3.5 py-2 text-right shrink-0">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-300">
            Skor Rapor
          </span>
          <div className="flex items-baseline justify-end gap-0.5 mt-0.5">
            <span className="font-mono text-2xl font-black text-white leading-none tabular-nums">
              {hasScore ? overallScore : '—'}
            </span>
            {hasScore && <span className="text-[10px] font-bold text-slate-300">/100</span>}
          </div>
          <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-[#16A779]/25 text-emerald-300 border border-[#16A779]/40">
            {hasScore ? `Grade ${cleanGradeCode}` : 'Belum Diukur'}
          </span>
        </div>
      </div>

      {/* Metadata Strip: Indikator Terukur & Evaluasi Terakhir */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/12">
        <div className="bg-white/8 rounded-xl px-2.5 py-1.5 border border-white/10">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-300">
            Cakupan Indikator
          </span>
          <span className="font-mono text-[12px] font-extrabold text-white tabular-nums">
            {totalIndicators > 0 ? `${measuredCount} / ${totalIndicators} Terukur` : `${measuredCount} Terukur`}
          </span>
        </div>
        <div className="bg-white/8 rounded-xl px-2.5 py-1.5 border border-white/10">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-300">
            Evaluasi Terakhir
          </span>
          <span className="text-[11px] font-bold text-white truncate block">
            {latestEvalDate ? formatShortDateIndo(latestEvalDate) : 'Belum Ada'}
          </span>
        </div>
      </div>

      {/* Optional Quick Edit Action */}
      {onOpenEdit && !isArchived && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onOpenEdit}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/15 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Konfigurasi Posisi & Peran</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 3. MobileDomainPerformanceSummary
 * Ringkasan 7 Domain Performa untuk Mobile (<= 767px) dengan Rincian Indikator Collapsible
 * @param {any} props
 */
export function MobileDomainPerformanceSummary({
  categoryList = [],
  measuredIndicatorMap = {},
  scores = {},
  expandedDomainId = null,
  onToggleDomain,
  activeCategoryKey,
  onSelectDomain,
  onScoreChange,
  onAdjustScore,
  isArchived = false,
  tierLabel = '',
  lockedToMasterLibrary = true,
  onOpenMasterLibrary,
  renderDomainIndicators
}) {
  const currentOpenKey =
    expandedDomainId !== undefined ? expandedDomainId : activeCategoryKey;

  const handleToggle = (key) => {
    if (onToggleDomain) {
      onToggleDomain(key);
    } else if (onSelectDomain) {
      onSelectDomain(currentOpenKey === key ? null : key);
    }
  };

  return (
    <div className="chua-m-eval-card space-y-2.5">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7EBF2]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#2455E8]" />
          <h3 className="text-[14px] font-bold text-[#17233D] my-0">
            Ringkasan Domain Performa
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-[#68758B]">
          {categoryList.length} Domain
        </span>
      </div>

      <div className="space-y-2.5">
        {categoryList.map((cat) => {
          const theme = getCategoryTheme(cat.key);
          const indicators = cat.indicators || [];
          const measuredInDomain = indicators.filter((ind) => {
            const rec = measuredIndicatorMap?.[ind];
            const scoreVal = scores?.[ind];
            return (
              (rec && Number(rec.score) > 0 && rec.hasAttendanceData !== false) ||
              (scoreVal !== undefined && scoreVal !== null && Number(scoreVal) > 0)
            );
          }).length;

          const isExpanded = currentOpenKey === cat.key;
          const catScore = Math.max(0, Math.min(100, Math.round(Number(cat.score) || 0)));

          return (
            <div
              key={`m-domain-summary-${cat.key}`}
              data-testid={`mobile-domain-card-${cat.key}`}
              className={`p-3 rounded-xl border transition-all w-full overflow-hidden ${
                isExpanded
                  ? 'bg-[#F5F7FC] border-[#2455E8] shadow-[0_2px_10px_rgba(36,85,232,0.08)]'
                  : 'bg-[#FFFFFF] border-[#E7EBF2]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: theme.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#17233D] truncate my-0">
                      {cat.shortLabel || cat.label}
                    </p>
                    <p className="text-[11px] text-[#68758B] font-medium my-0">
                      {measuredInDomain}/{indicators.length} indikator terukur
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className="font-mono text-[15px] font-extrabold tabular-nums"
                    style={{ color: catScore > 0 ? theme.color : '#68758B' }}
                  >
                    {catScore > 0 ? catScore : '—'}
                  </span>
                  <button
                    type="button"
                    data-testid={`domain-detail-btn-${cat.key}`}
                    aria-expanded={isExpanded}
                    onClick={() => handleToggle(cat.key)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      isExpanded
                        ? 'bg-[#2455E8] text-white border-[#2455E8]'
                        : 'bg-[#F5F7FC] hover:bg-[#2455E8]/10 text-[#2455E8] border-[#E7EBF2]'
                    }`}
                  >
                    <span>Detail</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="w-full h-1.5 bg-[#E7EBF2] rounded-full overflow-hidden mt-2.5">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${catScore}%`,
                    backgroundColor: theme.color
                  }}
                />
              </div>

              {isExpanded &&
                renderDomainIndicators &&
                renderDomainIndicators(cat.key, {
                  onScoreChange,
                  onAdjustScore,
                  isArchived,
                  tierLabel,
                  lockedToMasterLibrary,
                  onOpenMasterLibrary
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 4. MobileAiAndCoachNotesSection
 * Catatan Pelatih, Draf Analisis, dan CTA Simpan Evaluasi
 */
export function MobileAiAndCoachNotesSection({
  studentId = '',
  studentName = '',
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
  return (
    <div className="space-y-3">
      {/* Coach Notes Card */}
      <div className="chua-m-eval-card space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-[10px] bg-[#2455E8]/10 text-[#2455E8] flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-[13px] text-[#17233D] leading-tight my-0">
                Catatan Evaluasi Pelatih
              </h4>
              <p className="text-[11px] text-[#68758B] font-medium leading-tight my-0 mt-0.5 truncate">
                Umpan balik teknis & perkembangan untuk {studentName || 'atlet'}
              </p>
            </div>
          </div>

          {!isArchived && onGenerateAiDraft && (
            <button
              type="button"
              onClick={() => onGenerateAiDraft()}
              className="chua-m-eval-secondary-btn shrink-0 !px-2.5 !min-h-[38px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2455E8]" />
              <span>Buat Draf</span>
            </button>
          )}
        </div>

        <textarea
          aria-label="Catatan Evaluasi Pelatih"
          disabled={isArchived}
          rows={3}
          value={coachNote}
          onChange={(e) => onChangeCoachNote && onChangeCoachNote(e.target.value)}
          placeholder={`Tuliskan evaluasi dan saran latihan untuk ${studentName || 'atlet'}...`}
          className="w-full p-3 text-[13px] bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl focus:bg-white focus:outline-none focus:border-[#2455E8] font-medium text-[#17233D] leading-relaxed disabled:opacity-60"
        />

        {/* Inline Feedback Messages */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[#DC4545] text-[12px] font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#16A779] text-[12px] font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Primary Save Action */}
        <div className="pt-1 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <span
              className={`font-bold ${
                hasUnsavedChanges ? 'text-amber-600' : 'text-[#68758B]'
              }`}
            >
              {isArchived
                ? 'Mode baca-saja (Kelas diarsipkan)'
                : hasUnsavedChanges
                ? 'Ada perubahan penilaian siap disimpan'
                : latestEvalDate
                ? `Tersimpan terakhir: ${formatShortDateIndo(latestEvalDate)}`
                : 'Siap menyimpan rapor evaluasi'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving || isArchived}
            className="chua-m-eval-primary-btn"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : isArchived ? (
              <span>Evaluasi Terkunci</span>
            ) : (
              <>
                <Award className="w-4 h-4" />
                <span>{saveButtonLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 5. MobileEvaluationHistorySection
 * Riwayat Evaluasi Atlet untuk Mobile (<= 767px)
 */
export function MobileEvaluationHistorySection({
  history = [],
  loadingHistory = false,
  filterStudentId = 'ALL',
  setFilterStudentId,
  students = [],
  onDeleteEvaluation,
  isArchived = false,
  getScoreGradeFn
}) {
  const [expandedIds, setExpandedIds] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filteredHistory = useMemo(() => {
    if (!filterStudentId || filterStudentId === 'ALL') return history;
    return history.filter((h) => h.studentId === filterStudentId);
  }, [history, filterStudentId]);

  const toggleDetail = (id) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="chua-m-eval-card space-y-3">
      {/* Header & Athlete Filter */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E7EBF2]">
        <div className="min-w-0">
          <h3 className="font-bold text-[14px] text-[#17233D] leading-tight my-0">
            Riwayat Evaluasi Atlet
          </h3>
          <p className="text-[11px] text-[#68758B] font-medium my-0 mt-0.5">
            {filteredHistory.length} catatan evaluasi tersimpan
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl px-2.5 py-1.5 min-h-[44px] max-w-[170px]">
          <Users className="w-3.5 h-3.5 text-[#68758B] shrink-0" />
          <select
            aria-label="Filter Riwayat Atlet"
            value={filterStudentId}
            onChange={(e) => setFilterStudentId && setFilterStudentId(e.target.value)}
            className="w-full bg-transparent text-[11px] font-bold text-[#17233D] focus:outline-none truncate cursor-pointer"
          >
            <option value="ALL">Semua Atlet ({students.length})</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>
                {st.studentName || st.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History List */}
      {loadingHistory ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#68758B] font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-[#2455E8]" />
          <span>Memuat riwayat evaluasi...</span>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-6 text-center bg-[#F5F7FC] rounded-xl border border-dashed border-[#E7EBF2] p-4">
          <p className="text-xs font-semibold text-[#68758B] my-0">
            Belum ada riwayat evaluasi untuk filter ini.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredHistory.map((item) => {
            const isExpanded = !!expandedIds[item.id];
            const scoreEntries = Object.entries(item.scores || {});
            const overallScore =
              item.overallScore ??
              (scoreEntries.length > 0
                ? Math.round(
                    scoreEntries.reduce((a, b) => a + Number(b[1] || 0), 0) /
                      scoreEntries.length
                  )
                : 0);
            const gradeObj = getScoreGradeFn
              ? getScoreGradeFn(overallScore)
              : { grade: 'B' };
            const cleanGrade = String(gradeObj.grade || 'B').split(' ')[0];

            return (
              <div
                key={item.id}
                className="rounded-[14px] border border-[#E7EBF2] bg-[#FFFFFF] overflow-hidden"
              >
                <div className="p-3 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-bold text-[#17233D] truncate">
                        {item.studentName}
                      </span>
                      {item.playerRole && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#2455E8]/10 text-[#2455E8]">
                          {item.playerRole}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#68758B] font-medium">
                      <span>{formatShortDateIndo(item.date)}</span>
                      {item.tierLabel && (
                        <>
                          <span>&bull;</span>
                          <span className="truncate">{item.tierLabel}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="px-2.5 py-1.5 rounded-lg bg-[#101D38] text-white text-right">
                      <span className="font-mono text-xs font-black tabular-nums">
                        {overallScore}
                      </span>
                      <span className="text-[9px] text-emerald-300 font-bold ml-1">
                        {cleanGrade}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleDetail(item.id)}
                      className="min-w-[44px] min-h-[44px] rounded-xl border border-[#E7EBF2] bg-[#F5F7FC] text-[#17233D] flex items-center justify-center cursor-pointer"
                      aria-label="Lihat Detail Riwayat"
                    >
                      {isExpanded ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4 text-[#2455E8]" />
                      )}
                    </button>

                    {!isArchived &&
                      onDeleteEvaluation &&
                      (confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteEvaluation(item.id, item.studentName);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[44px] px-2.5 rounded-xl bg-[#DC4545] text-white text-[11px] font-bold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[44px] px-2.5 rounded-xl bg-[#F5F7FC] border border-[#E7EBF2] text-[#68758B] text-[11px] font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="min-w-[44px] min-h-[44px] rounded-xl border border-rose-200 bg-rose-50 text-[#DC4545] flex items-center justify-center cursor-pointer"
                          aria-label="Hapus Evaluasi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 bg-[#F5F7FC] border-t border-[#E7EBF2] space-y-2.5">
                    {item.coachNote && (
                      <div className="p-2.5 rounded-lg bg-white border border-[#E7EBF2] text-[12px] text-[#17233D] leading-relaxed">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#68758B] mb-0.5">
                          Catatan Pelatih:
                        </span>
                        {item.coachNote}
                      </div>
                    )}

                    {scoreEntries.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {scoreEntries.map(([ind, val]) => (
                          <div
                            key={ind}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E7EBF2] flex items-center justify-between gap-1.5"
                          >
                            <span className="text-[11px] font-semibold text-[#17233D] truncate">
                              {ind}
                            </span>
                            <span className="font-mono text-[11px] font-extrabold text-[#2455E8] shrink-0 tabular-nums">
                              {val}
                            </span>
                          </div>
                        ))}
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
  );
}
