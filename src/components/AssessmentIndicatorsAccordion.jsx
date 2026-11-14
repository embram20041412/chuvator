import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Sliders,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  CalendarCheck
} from 'lucide-react';
import { getCategoryTheme } from './ScoutingPolarAreaPanel';
import {
  MASTER_FOOTBALL_TESTS_CATALOG,
  normalizeIndicatorKey,
  MASTER_INDICATOR_KEY_TO_LABEL
} from '../utils/footballAssessmentEngine';

function getScoreBadge(score) {
  if (score >= 85) {
    return {
      grade: 'A',
      label: 'Sangat Baik',
      badge: 'bg-[#16A779]/10 text-[#16A779] border-[#16A779]/30'
    };
  }
  if (score >= 75) {
    return {
      grade: 'B',
      label: 'Baik',
      badge: 'bg-[#2455E8]/10 text-[#2455E8] border-[#2455E8]/30'
    };
  }
  if (score >= 60) {
    return {
      grade: 'C',
      label: 'Cukup',
      badge: 'bg-amber-500/10 text-amber-700 border-amber-500/30'
    };
  }
  return {
    grade: 'D',
    label: 'Perlu Pembinaan',
    badge: 'bg-rose-500/10 text-rose-700 border-rose-500/30'
  };
}

const ATTENDANCE_INDICATOR_KEYS = new Set([
  'kehadiran_latihan',
  'kepatuhan_program',
  'konsistensi_kehadiran',
  'disiplin_kehadiran',
  'kehadiran_disiplin',
  'konsistensi_latihan',
  'Kehadiran Latihan',
  'Kepatuhan Program',
  'Konsistensi Kehadiran',
  'Disiplin & Kehadiran',
  'Kehadiran & Disiplin',
  'Konsistensi Latihan'
]);

/**
 * AssessmentIndicatorsAccordion
 * Menampilkan rincian indikator evaluasi per domain (7 Domain Performa)
 * dengan desain bersih, responsif (Desktop & Mobile), dan bebas jargon teknis internal.
 * @param {any} props
 */
export default function AssessmentIndicatorsAccordion({
  categoryList = [],
  scores = {},
  onScoreChange,
  onAdjustScore,
  onSetCategoryPreset,
  activeCategoryKey,
  isArchived = false,
  tierLabel = '',
  isMobile = false,
  defaultOpenFirst = true,
  measuredIndicatorMap = {},
  lockedToMasterLibrary = false,
  onOpenMasterLibrary,
  singleDomainMode = false,
  selectedDomainKey = null,
  onCloseDomain
}) {
  const [openKey, setOpenKey] = useState(() => {
    if (activeCategoryKey) return activeCategoryKey;
    if (defaultOpenFirst && categoryList.length > 0) return categoryList[0].key;
    return null;
  });

  useEffect(() => {
    if (activeCategoryKey !== undefined) {
      setOpenKey(activeCategoryKey);
    }
  }, [activeCategoryKey]);

  const isControlDisabled = isArchived || lockedToMasterLibrary;

  // Map indicator key / label -> clean test name from MASTER_FOOTBALL_TESTS_CATALOG
  const testReferenceMap = useMemo(() => {
    const map = {};
    (MASTER_FOOTBALL_TESTS_CATALOG || []).forEach((test) => {
      if (test?.test_name) {
        if (test.indicator_key && !map[test.indicator_key]) {
          map[test.indicator_key] = test.test_name;
        }
        if (test.indicator_label && !map[test.indicator_label]) {
          map[test.indicator_label] = test.test_name;
        }
      }
    });
    return map;
  }, []);

  const resolveIndicatorInfo = (indItem) => {
    const rawKey = typeof indItem === 'object' ? indItem.id || indItem.key : String(indItem);
    const canonicalKey = normalizeIndicatorKey(rawKey) || rawKey;
    const displayLabel =
      typeof indItem === 'object' && indItem.label
        ? indItem.label
        : MASTER_INDICATOR_KEY_TO_LABEL[canonicalKey] || rawKey;

    const measuredRec =
      measuredIndicatorMap?.[rawKey] ||
      measuredIndicatorMap?.[canonicalKey] ||
      measuredIndicatorMap?.[displayLabel] ||
      null;

    const isAttendanceSync =
      ATTENDANCE_INDICATOR_KEYS.has(rawKey) ||
      ATTENDANCE_INDICATOR_KEYS.has(canonicalKey) ||
      ATTENDANCE_INDICATOR_KEYS.has(displayLabel) ||
      measuredRec?.source === 'attendance_sync';

    const rawScoreVal =
      scores?.[rawKey] ?? scores?.[canonicalKey] ?? scores?.[displayLabel] ?? measuredRec?.score;
    const numericScore = Number(rawScoreVal);
    const hasValidScore =
      rawScoreVal !== null &&
      rawScoreVal !== undefined &&
      !Number.isNaN(numericScore) &&
      numericScore > 0;

    const isMeasured = Boolean(
      (measuredRec && Number(measuredRec.score) > 0 && measuredRec.hasAttendanceData !== false) ||
        (!lockedToMasterLibrary && hasValidScore) ||
        hasValidScore
    );

    const referenceTestName = isAttendanceSync
      ? 'Rekap Kehadiran Latihan'
      : testReferenceMap[canonicalKey] ||
        testReferenceMap[rawKey] ||
        testReferenceMap[displayLabel] ||
        'Pengukuran Lapangan';

    return {
      rawKey,
      canonicalKey,
      displayLabel,
      measuredRec,
      isAttendanceSync,
      isMeasured,
      score: isMeasured ? Math.max(0, Math.min(100, Math.round(numericScore))) : 0,
      referenceTestName
    };
  };

  // Summary of measured vs total indicators across all domains
  const totalSummary = useMemo(() => {
    let measured = 0;
    let total = 0;
    (categoryList || []).forEach((cat) => {
      const indicators = cat?.indicators || [];
      total += indicators.length;
      indicators.forEach((ind) => {
        const info = resolveIndicatorInfo(ind);
        if (info.isMeasured) measured += 1;
      });
    });
    return { measured, total };
  }, [categoryList, scores, measuredIndicatorMap, lockedToMasterLibrary]);

  const handleToggleCategory = (key) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  // ============================================================================
  // SINGLE DOMAIN COLLAPSIBLE MODE (Triggered by 'Detail' button in Domain Summary)
  // ============================================================================
  if (singleDomainMode) {
    if (!selectedDomainKey) return null;
    const selectedCategory = (categoryList || []).find((c) => c.key === selectedDomainKey);
    if (!selectedCategory) return null;

    const theme = getCategoryTheme(selectedCategory.key);
    const catIndicators = selectedCategory.indicators || [];
    const resolvedList = catIndicators.map((ind) => resolveIndicatorInfo(ind));
    const catMeasuredCount = resolvedList.filter((item) => item.isMeasured).length;
    const catScore = Math.max(0, Math.min(100, Math.round(Number(selectedCategory.score) || 0)));
    const catGrade = getScoreBadge(catScore);

    if (isMobile) {
      return (
        <div
          id={`domain-accordion-${selectedCategory.key}`}
          data-testid={`rincian-indikator-domain-${selectedCategory.key}`}
          className="w-full pt-3 mt-2.5 border-t border-[#E7EBF2] space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sliders className="w-3.5 h-3.5 text-[#2455E8] shrink-0" />
              <span className="text-[12px] font-bold text-[#17233D] truncate">
                Rincian Indikator Domain
              </span>
              {lockedToMasterLibrary && (
                <span data-testid="accordion-readonly-badge" className="sr-only">
                  Master Test Library
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold text-[#68758B] tabular-nums shrink-0">
              {catMeasuredCount}/{catIndicators.length} Terukur
            </span>
          </div>

          {resolvedList.length === 0 ? (
            <div className="p-3 text-center text-[12px] text-[#68758B] bg-[#FFFFFF] rounded-xl border border-[#E7EBF2]">
              Belum ada indikator dalam domain ini.
            </div>
          ) : (
            <div className="space-y-2">
              {resolvedList.map((info) => {
                const attendancePct =
                  info.measuredRec?.attendanceRate !== undefined
                    ? Math.round(Number(info.measuredRec.attendanceRate))
                    : info.score;

                return (
                  <div
                    key={`m-single-ind-${selectedCategory.key}-${info.rawKey}`}
                    className="w-full bg-[#FFFFFF] border border-[#E7EBF2] rounded-xl p-3 space-y-2 shadow-[0_1px_3px_rgba(16,29,56,0.03)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#17233D] leading-snug my-0">
                          {info.displayLabel}
                        </p>
                        <p className="text-[11px] text-[#68758B] font-medium mt-0.5 truncate my-0">
                          Referensi: {info.referenceTestName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          data-testid={`indicator-score-${info.canonicalKey}`}
                          className="font-mono text-[15px] font-extrabold tabular-nums"
                          style={{
                            color: info.isMeasured ? theme.color : '#68758B'
                          }}
                        >
                          {info.isMeasured ? info.score : '—'}
                        </span>
                        {info.isMeasured && (
                          <span className="text-[11px] font-semibold text-[#68758B] font-mono">
                            {' '}
                            / 100
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-[#E7EBF2] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${info.isMeasured ? info.score : 0}%`,
                          backgroundColor: info.isMeasured ? theme.color : 'transparent'
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {info.isAttendanceSync ? (
                          <span
                            data-testid="attendance-synced-badge"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2455E8]/10 text-[#2455E8] text-[10px] font-bold"
                          >
                            <CalendarCheck className="w-3 h-3 shrink-0" />
                            {info.isMeasured
                              ? `Presensi ${attendancePct}%`
                              : 'Belum Ada Presensi'}
                          </span>
                        ) : info.isMeasured ? (
                          <span
                            data-testid="indicator-measured-badge"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#16A779]/10 text-[#16A779] text-[10px] font-bold"
                          >
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            Terukur
                          </span>
                        ) : (
                          <span
                            data-testid="indicator-unmeasured-badge"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F5F7FC] text-[#68758B] border border-[#E7EBF2] text-[10px] font-semibold"
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            Belum Diukur
                          </span>
                        )}
                        {lockedToMasterLibrary && (
                          <span data-testid="indicator-locked-badge" className="sr-only">
                            Master Test Library
                          </span>
                        )}
                      </div>

                      {!info.isAttendanceSync && onOpenMasterLibrary && !isArchived && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMasterLibrary(selectedCategory.key, info.canonicalKey)
                          }
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#F5F7FC] hover:bg-[#2455E8] text-[#2455E8] hover:text-white border border-[#E7EBF2] text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                          <span>{info.isMeasured ? 'Lihat Tes' : 'Input Tes'}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Desktop Single-Domain Connected Detail Panel
    return (
      <div
        id={`domain-accordion-${selectedCategory.key}`}
        data-testid={`rincian-indikator-domain-${selectedCategory.key}`}
        className="bg-[#FFFFFF] rounded-2xl border border-[#E7EBF2] shadow-[0_4px_16px_rgba(16,29,56,0.05)] overflow-hidden transition-all"
        style={{ borderTopWidth: '4px', borderTopColor: theme.color }}
      >
        <div className="px-5 py-4 border-b border-[#E7EBF2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFFFF]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-extrabold text-sm text-white shrink-0"
              style={{ backgroundColor: theme.color }}
            >
              {catScore > 0 ? catScore : '—'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-bold text-base text-[#17233D] tracking-tight">
                  Rincian Indikator Domain — {selectedCategory.shortLabel || selectedCategory.label}
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] text-xs font-bold tabular-nums">
                  {catMeasuredCount} / {catIndicators.length} Indikator Terukur
                </span>
                {catScore > 0 && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${catGrade.badge}`}
                  >
                    {catGrade.grade} &bull; {catGrade.label}
                  </span>
                )}
                {tierLabel && (
                  <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#101D38]/6 text-[#17233D] text-xs font-semibold">
                    {tierLabel}
                  </span>
                )}
                {lockedToMasterLibrary && (
                  <span data-testid="accordion-readonly-badge" className="sr-only">
                    Master Test Library
                  </span>
                )}
              </div>
              <p className="text-xs text-[#68758B] font-medium mt-0.5">
                Daftar indikator evaluasi dan referensi pengujian lapangan untuk domain{' '}
                {selectedCategory.shortLabel || selectedCategory.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {onOpenMasterLibrary && !isArchived && (
              <button
                type="button"
                onClick={() => onOpenMasterLibrary(selectedCategory.key)}
                className="min-h-[40px] px-3.5 py-2 text-xs font-bold text-[#2455E8] bg-[#2455E8]/8 hover:bg-[#2455E8]/15 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Buka Master Test Library</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onCloseDomain && (
              <button
                type="button"
                data-testid="close-domain-detail-btn"
                onClick={() => onCloseDomain()}
                className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#68758B] hover:text-[#17233D] bg-[#F5F7FC] hover:bg-[#E7EBF2]/60 rounded-xl border border-[#E7EBF2] transition-colors cursor-pointer"
              >
                Tutup Rincian
              </button>
            )}
          </div>
        </div>

        <div className="p-5 bg-[#F5F7FC]/50">
          {resolvedList.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#68758B] bg-[#FFFFFF] rounded-xl border border-dashed border-[#E7EBF2]">
              Belum ada indikator terdaftar untuk domain ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {resolvedList.map((info) => {
                const attendancePct =
                  info.measuredRec?.attendanceRate !== undefined
                    ? Math.round(Number(info.measuredRec.attendanceRate))
                    : info.score;

                return (
                  <div
                    key={`single-ind-${selectedCategory.key}-${info.rawKey}`}
                    className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E7EBF2] shadow-[0_1px_4px_rgba(16,29,56,0.03)] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h5 className="text-sm font-bold text-[#17233D] leading-snug">
                          {info.displayLabel}
                        </h5>
                        <p className="text-xs text-[#68758B] font-medium mt-0.5 truncate">
                          Referensi: {info.referenceTestName}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          data-testid={`indicator-score-${info.canonicalKey}`}
                          className="font-mono text-base font-extrabold tabular-nums"
                          style={{
                            color: info.isMeasured ? theme.color : '#68758B'
                          }}
                        >
                          {info.isMeasured ? info.score : '—'}
                        </span>
                        {info.isMeasured && (
                          <span className="text-xs font-semibold text-[#68758B] font-mono">
                            {' '}
                            / 100
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-2 bg-[#F5F7FC] border border-[#E7EBF2] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${info.isMeasured ? info.score : 0}%`,
                          backgroundColor: info.isMeasured ? theme.color : 'transparent'
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {info.isAttendanceSync ? (
                          <span
                            data-testid="attendance-synced-badge"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#2455E8]/10 text-[#2455E8] text-[11px] font-bold"
                          >
                            <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                            {info.isMeasured
                              ? `Presensi ${attendancePct}%`
                              : 'Belum Ada Presensi'}
                          </span>
                        ) : info.isMeasured ? (
                          <span
                            data-testid="indicator-measured-badge"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#16A779]/10 text-[#16A779] text-[11px] font-bold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Terukur
                          </span>
                        ) : (
                          <span
                            data-testid="indicator-unmeasured-badge"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F7FC] border border-[#E7EBF2] text-[#68758B] text-[11px] font-semibold"
                          >
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            Belum Diukur
                          </span>
                        )}
                        {lockedToMasterLibrary && (
                          <span data-testid="indicator-locked-badge" className="sr-only">
                            Master Test Library
                          </span>
                        )}
                      </div>

                      {!info.isAttendanceSync && onOpenMasterLibrary && !isArchived && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMasterLibrary(selectedCategory.key, info.canonicalKey)
                          }
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F7FC] hover:bg-[#2455E8] text-[#2455E8] hover:text-white border border-[#E7EBF2] hover:border-[#2455E8] text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                        >
                          <span>{info.isMeasured ? 'Lihat Hasil Tes' : 'Uji di Library'}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // MOBILE RENDERING (<= 767px)
  // ============================================================================
  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders className="w-4 h-4 text-[#2455E8] shrink-0" />
            <h3 className="text-[14px] font-bold text-[#17233D] my-0 truncate">
              Rincian Indikator Domain
            </h3>
            {lockedToMasterLibrary && (
              <span data-testid="accordion-readonly-badge" className="sr-only">
                Master Test Library
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFFFFF] border border-[#E7EBF2] text-[#17233D] text-[11px] font-bold tabular-nums shrink-0">
            {totalSummary.measured}/{totalSummary.total} Terukur
          </span>
        </div>

        <div className="space-y-2.5">
          {categoryList.map((cat) => {
            const isExpanded = openKey === cat.key;
            const theme = getCategoryTheme(cat.key);
            const catIndicators = cat.indicators || [];
            const resolvedList = catIndicators.map((ind) => resolveIndicatorInfo(ind));
            const catMeasuredCount = resolvedList.filter((item) => item.isMeasured).length;
            const catScore = Math.max(0, Math.min(100, Math.round(Number(cat.score) || 0)));
            const catGrade = getScoreBadge(catScore);

            return (
              <div
                key={`m-acc-${cat.key}`}
                id={`domain-accordion-${cat.key}`}
                className={`chua-m-eval-accordion-item ${
                  isExpanded ? 'chua-m-eval-accordion-item-open' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleCategory(cat.key)}
                  aria-expanded={isExpanded}
                  className="chua-m-eval-accordion-header"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-mono font-extrabold text-[12px] text-white shrink-0"
                      style={{ backgroundColor: theme.color }}
                    >
                      {catScore > 0 ? catScore : '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-[13px] text-[#17233D] truncate my-0">
                          {cat.shortLabel || cat.label}
                        </h4>
                        {catScore > 0 && (
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${catGrade.badge}`}
                          >
                            {catGrade.grade}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-[#E7EBF2] rounded-full overflow-hidden max-w-[110px]">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${catScore}%`,
                              backgroundColor: theme.color
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-[#68758B] font-semibold tabular-nums">
                          {catMeasuredCount}/{catIndicators.length} indikator
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 shrink-0 ${
                      isExpanded
                        ? 'bg-[#2455E8] text-white rotate-180'
                        : 'bg-[#F5F7FC] text-[#68758B]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-3 bg-[#FFFFFF] space-y-2.5">
                    {resolvedList.length === 0 ? (
                      <div className="p-4 text-center text-[12px] text-[#68758B]">
                        Belum ada indikator dalam domain ini.
                      </div>
                    ) : (
                      resolvedList.map((info) => {
                        const attendancePct =
                          info.measuredRec?.attendanceRate !== undefined
                            ? Math.round(Number(info.measuredRec.attendanceRate))
                            : info.score;

                        return (
                          <div
                            key={`m-ind-${cat.key}-${info.rawKey}`}
                            className="bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-bold text-[#17233D] leading-snug my-0">
                                  {info.displayLabel}
                                </p>
                                <p className="text-[11px] text-[#68758B] font-medium mt-0.5 truncate my-0">
                                  Referensi: {info.referenceTestName}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  data-testid={`indicator-score-${info.canonicalKey}`}
                                  className="font-mono text-[15px] font-extrabold tabular-nums"
                                  style={{
                                    color: info.isMeasured ? theme.color : '#68758B'
                                  }}
                                >
                                  {info.isMeasured ? info.score : '—'}
                                </span>
                                {info.isMeasured && (
                                  <span className="text-[11px] font-semibold text-[#68758B] font-mono">
                                    {' '}
                                    / 100
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-1.5 bg-[#E7EBF2] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${info.isMeasured ? info.score : 0}%`,
                                  backgroundColor: info.isMeasured ? theme.color : 'transparent'
                                }}
                              />
                            </div>

                            {/* Status & Action Row */}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {info.isAttendanceSync ? (
                                  <span
                                    data-testid="attendance-synced-badge"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2455E8]/10 text-[#2455E8] text-[10px] font-bold"
                                  >
                                    <CalendarCheck className="w-3 h-3 shrink-0" />
                                    {info.isMeasured
                                      ? `Presensi ${attendancePct}%`
                                      : 'Belum Ada Presensi'}
                                  </span>
                                ) : info.isMeasured ? (
                                  <span
                                    data-testid="indicator-measured-badge"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#16A779]/10 text-[#16A779] text-[10px] font-bold"
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    Terukur
                                  </span>
                                ) : (
                                  <span
                                    data-testid="indicator-unmeasured-badge"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E7EBF2] text-[#68758B] text-[10px] font-semibold"
                                  >
                                    <Clock className="w-3 h-3 shrink-0" />
                                    Belum Diukur
                                  </span>
                                )}
                                {lockedToMasterLibrary && (
                                  <span
                                    data-testid="indicator-locked-badge"
                                    className="sr-only"
                                  >
                                    Master Test Library
                                  </span>
                                )}
                              </div>

                              {!info.isAttendanceSync && onOpenMasterLibrary && !isArchived && (
                                <button
                                  type="button"
                                  onClick={() => onOpenMasterLibrary(cat.key, info.canonicalKey)}
                                  className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#2455E8] text-[#2455E8] hover:text-white border border-[#E7EBF2] text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                >
                                  <span>{info.isMeasured ? 'Lihat Tes' : 'Input Tes'}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Unlocked manual controls for non-locked sports */}
                            {!lockedToMasterLibrary && !isArchived && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isControlDisabled || info.score <= 0}
                                  onClick={() =>
                                    onAdjustScore
                                      ? onAdjustScore(info.rawKey, -5)
                                      : onScoreChange &&
                                        onScoreChange(info.rawKey, Math.max(0, info.score - 5))
                                  }
                                  className="chua-m-eval-step-btn"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  disabled={isControlDisabled}
                                  value={info.score}
                                  onChange={(e) =>
                                    onScoreChange && onScoreChange(info.rawKey, e.target.value)
                                  }
                                  className="flex-1 h-2 rounded-lg appearance-none bg-[#E7EBF2]"
                                />
                                <button
                                  type="button"
                                  disabled={isControlDisabled || info.score >= 100}
                                  onClick={() =>
                                    onAdjustScore
                                      ? onAdjustScore(info.rawKey, 5)
                                      : onScoreChange &&
                                        onScoreChange(info.rawKey, Math.min(100, info.score + 5))
                                  }
                                  className="chua-m-eval-step-btn"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================================
  // DESKTOP RENDERING (>= 768px)
  // ============================================================================
  return (
    <div className="bg-[#FFFFFF] rounded-2xl border border-[#E7EBF2] shadow-[0_2px_10px_rgba(16,29,56,0.04)] overflow-hidden">
      {/* Header Bar */}
      <div className="px-5 py-4 border-b border-[#E7EBF2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFFFF]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#101D38] text-white flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4 text-[#16A779]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-base text-[#17233D] tracking-tight">
                Rincian Indikator Domain
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] text-xs font-bold tabular-nums">
                {totalSummary.measured} / {totalSummary.total} Indikator Terukur
              </span>
              {tierLabel && (
                <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#101D38]/6 text-[#17233D] text-xs font-semibold">
                  {tierLabel}
                </span>
              )}
              {lockedToMasterLibrary && (
                <span data-testid="accordion-readonly-badge" className="sr-only">
                  Master Test Library
                </span>
              )}
            </div>
            <p className="text-xs text-[#68758B] font-medium mt-0.5">
              Pilih domain performa untuk melihat skor indikator dan referensi pengujian lapangan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {onOpenMasterLibrary && !isArchived && (
            <button
              type="button"
              onClick={() => onOpenMasterLibrary()}
              className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-[#2455E8] bg-[#2455E8]/8 hover:bg-[#2455E8]/15 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Buka Master Test Library</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          {openKey && (
            <button
              type="button"
              onClick={() => setOpenKey(null)}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-[#68758B] hover:text-[#17233D] bg-[#F5F7FC] hover:bg-[#E7EBF2]/60 rounded-xl border border-[#E7EBF2] transition-colors cursor-pointer"
            >
              Tutup Domain
            </button>
          )}
        </div>
      </div>

      {/* Accordion List */}
      <div className="divide-y divide-[#E7EBF2]">
        {categoryList.map((cat) => {
          const isExpanded = openKey === cat.key;
          const theme = getCategoryTheme(cat.key);
          const catIndicators = cat.indicators || [];
          const resolvedList = catIndicators.map((ind) => resolveIndicatorInfo(ind));
          const catMeasuredCount = resolvedList.filter((item) => item.isMeasured).length;
          const catScore = Math.max(0, Math.min(100, Math.round(Number(cat.score) || 0)));
          const catGrade = getScoreBadge(catScore);

          return (
            <div
              key={`acc-${cat.key}`}
              id={`domain-accordion-${cat.key}`}
              className="transition-colors"
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => handleToggleCategory(cat.key)}
                aria-expanded={isExpanded}
                className={`w-full min-h-[60px] px-5 py-3.5 flex items-center justify-between gap-4 text-left transition-all cursor-pointer ${
                  isExpanded ? 'bg-[#F5F7FC]' : 'bg-[#FFFFFF] hover:bg-[#F5F7FC]/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-extrabold text-sm text-white shrink-0"
                    style={{ backgroundColor: theme.color }}
                  >
                    {catScore > 0 ? catScore : '—'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm sm:text-base text-[#17233D] tracking-tight truncate">
                        {cat.label}
                      </h4>
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#F5F7FC] text-[#68758B] border border-[#E7EBF2] tabular-nums">
                        {catMeasuredCount}/{catIndicators.length} Indikator Terukur
                      </span>
                      {catScore > 0 && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${catGrade.badge}`}
                        >
                          {catGrade.grade} &bull; {catGrade.label}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 flex items-center gap-3 max-w-md">
                      <div className="flex-1 h-1.5 bg-[#E7EBF2] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${catScore}%`,
                            backgroundColor: theme.color
                          }}
                        />
                      </div>
                      <span
                        className="font-mono text-xs font-bold tabular-nums w-14 text-right"
                        style={{ color: catScore > 0 ? theme.color : '#68758B' }}
                      >
                        {catScore > 0 ? `${catScore}/100` : 'Belum'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="hidden sm:inline-block text-xs font-semibold text-[#68758B]">
                    {isExpanded ? 'Sembunyikan' : 'Lihat Rincian'}
                  </span>
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 ${
                      isExpanded
                        ? 'bg-[#2455E8] text-white rotate-180'
                        : 'bg-[#F5F7FC] text-[#68758B] border border-[#E7EBF2]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="p-5 bg-[#F5F7FC]/50 border-t border-[#E7EBF2]">
                  {resolvedList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#68758B] bg-[#FFFFFF] rounded-xl border border-dashed border-[#E7EBF2]">
                      Belum ada indikator terdaftar untuk domain ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {resolvedList.map((info) => {
                        const attendancePct =
                          info.measuredRec?.attendanceRate !== undefined
                            ? Math.round(Number(info.measuredRec.attendanceRate))
                            : info.score;

                        return (
                          <div
                            key={`ind-${cat.key}-${info.rawKey}`}
                            className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E7EBF2] shadow-[0_1px_4px_rgba(16,29,56,0.03)] flex flex-col justify-between gap-3"
                          >
                            {/* Top Row: Indicator Name, Reference Test, and Score */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h5 className="text-sm font-bold text-[#17233D] leading-snug">
                                  {info.displayLabel}
                                </h5>
                                <p className="text-xs text-[#68758B] font-medium mt-0.5 truncate">
                                  Referensi: {info.referenceTestName}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  data-testid={`indicator-score-${info.canonicalKey}`}
                                  className="font-mono text-base font-extrabold tabular-nums"
                                  style={{
                                    color: info.isMeasured ? theme.color : '#68758B'
                                  }}
                                >
                                  {info.isMeasured ? info.score : '—'}
                                </span>
                                {info.isMeasured && (
                                  <span className="text-xs font-semibold text-[#68758B] font-mono">
                                    {' '}
                                    / 100
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-2 bg-[#F5F7FC] border border-[#E7EBF2] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${info.isMeasured ? info.score : 0}%`,
                                  backgroundColor: info.isMeasured ? theme.color : 'transparent'
                                }}
                              />
                            </div>

                            {/* Bottom Row: Status Badge & Action Button */}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {info.isAttendanceSync ? (
                                  <span
                                    data-testid="attendance-synced-badge"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#2455E8]/10 text-[#2455E8] text-[11px] font-bold"
                                  >
                                    <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                                    {info.isMeasured
                                      ? `Presensi ${attendancePct}%`
                                      : 'Belum Ada Presensi'}
                                  </span>
                                ) : info.isMeasured ? (
                                  <span
                                    data-testid="indicator-measured-badge"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#16A779]/10 text-[#16A779] text-[11px] font-bold"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    Terukur
                                  </span>
                                ) : (
                                  <span
                                    data-testid="indicator-unmeasured-badge"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F7FC] border border-[#E7EBF2] text-[#68758B] text-[11px] font-semibold"
                                  >
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    Belum Diukur
                                  </span>
                                )}
                                {lockedToMasterLibrary && (
                                  <span
                                    data-testid="indicator-locked-badge"
                                    className="sr-only"
                                  >
                                    Master Test Library
                                  </span>
                                )}
                              </div>

                              {!info.isAttendanceSync && onOpenMasterLibrary && !isArchived && (
                                <button
                                  type="button"
                                  onClick={() => onOpenMasterLibrary(cat.key, info.canonicalKey)}
                                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F7FC] hover:bg-[#2455E8] text-[#2455E8] hover:text-white border border-[#E7EBF2] hover:border-[#2455E8] text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                                >
                                  <span>{info.isMeasured ? 'Lihat Hasil Tes' : 'Uji di Library'}</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Unlocked manual controls for non-locked sports */}
                            {!lockedToMasterLibrary && !isArchived && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isControlDisabled || info.score <= 0}
                                  onClick={() =>
                                    onAdjustScore
                                      ? onAdjustScore(info.rawKey, -5)
                                      : onScoreChange &&
                                        onScoreChange(info.rawKey, Math.max(0, info.score - 5))
                                  }
                                  className="min-w-[40px] min-h-[40px] rounded-xl bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] flex items-center justify-center cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  disabled={isControlDisabled}
                                  value={info.score}
                                  onChange={(e) =>
                                    onScoreChange && onScoreChange(info.rawKey, e.target.value)
                                  }
                                  className="flex-1 h-2 rounded-lg appearance-none bg-[#E7EBF2]"
                                />
                                <button
                                  type="button"
                                  disabled={isControlDisabled || info.score >= 100}
                                  onClick={() =>
                                    onAdjustScore
                                      ? onAdjustScore(info.rawKey, 5)
                                      : onScoreChange &&
                                        onScoreChange(info.rawKey, Math.min(100, info.score + 5))
                                  }
                                  className="min-w-[40px] min-h-[40px] rounded-xl bg-[#F5F7FC] border border-[#E7EBF2] text-[#17233D] flex items-center justify-center cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
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
        })}
      </div>
    </div>
  );
}
