import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Check, 
  X, 
  CheckCircle2,
  Target,
  Sliders,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Radio
} from 'lucide-react';
import AssessmentIndicatorsAccordion from './AssessmentIndicatorsAccordion';

export function getScoreGrade(score) {
  if (score >= 85) return { grade: 'A (Sangat Baik)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (score >= 75) return { grade: 'B (Baik)', badge: 'bg-[#354944]/10 text-[#354944] border-[#354944]/30' };
  if (score >= 60) return { grade: 'C (Cukup)', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { grade: 'D (Perlu Bimbingan)', badge: 'bg-rose-100 text-rose-800 border-rose-300' };
}

/**
 * @param {{
 *   studentName?: string,
 *   sportLabel?: string,
 *   sportType?: 'football' | 'futsal',
 *   activeTier?: number,
 *   categoryList?: any[],
 *   initialScores?: Record<string, number>,
 *   activeCategoryKey?: string | null,
 *   selectedPosition?: string,
 *   secondaryPosition?: string,
 *   selectedSpecialization?: string,
 *   selectedStyleCode?: string,
 *   availablePositions?: any[],
 *   secondaryPositions?: any[],
 *   playingStyles?: any[],
 *   getPositionConfigFn?: (code: string) => any,
 *   getStyleConfigFn?: (code: string) => any,
 *   resolvePositionIndicatorsFn?: (posCode: string, tier: number) => { shortLabel?: string, label?: string, indicators?: string[] },
 *   onSave: (updatedScores: Record<string, number>, updatedConfig?: {
 *     selectedPosition: string,
 *     secondaryPosition: string,
 *     selectedSpecialization: string,
 *     selectedStyleCode: string
 *   }) => void,
 *   onCancel: () => void,
 *   isArchived?: boolean,
 *   tierLabel?: string
 * }} props
 */
export default function AthleteAssessmentEditView({
  studentName = 'Atlet',
  sportLabel = '',
  sportType = 'football',
  activeTier = 3,
  categoryList = [],
  initialScores = {},
  activeCategoryKey = null,
  selectedPosition = 'ST',
  secondaryPosition = 'NONE',
  selectedSpecialization = 'Poacher',
  selectedStyleCode = 'STY07',
  availablePositions = [],
  secondaryPositions = [],
  playingStyles = [],
  getPositionConfigFn,
  getStyleConfigFn,
  resolvePositionIndicatorsFn,
  onSave,
  onCancel,
  isArchived = false,
  tierLabel = '',
  isMobile = false,
  lockedToMasterLibrary = false,
  measuredIndicatorMap = {},
  onOpenMasterLibrary = null
}) {
  const isLockedToMaster = Boolean(lockedToMasterLibrary || sportType === 'football');
  // Draft state for indicator scores
  const [draftScores, setDraftScores] = useState(() => ({ ...initialScores }));
  // Draft state for position & tactical role configuration
  const [draftPosition, setDraftPosition] = useState(selectedPosition);
  const [draftSecondaryPosition, setDraftSecondaryPosition] = useState(secondaryPosition);
  const [draftSpecialization, setDraftSpecialization] = useState(selectedSpecialization);
  const [draftStyleCode, setDraftStyleCode] = useState(selectedStyleCode);
  const [hasChanges, setHasChanges] = useState(false);

  // Collapsible toggle for Position & Tactical Role section (open by default unless user entered via specific category shortcut)
  const [showConfigSection, setShowConfigSection] = useState(() => !activeCategoryKey);

  // Handle primary position change in draft
  const handleDraftPositionChange = (newPosCode) => {
    setDraftPosition(newPosCode);
    if (sportType === 'football' && activeTier >= 3 && getPositionConfigFn) {
      const cfg = getPositionConfigFn(newPosCode);
      if (cfg?.specializations?.length > 0) {
        setDraftSpecialization(cfg.specializations[0]);
      }
    }
    setHasChanges(true);
  };

  // Update a single indicator value
  const handleDraftScoreChange = (indicatorName, value) => {
    const num = Math.min(100, Math.max(0, Number(value) || 0));
    setDraftScores((prev) => ({
      ...prev,
      [indicatorName]: num
    }));
    setHasChanges(true);
  };

  // Adjust score with +/- delta
  const handleDraftAdjustScore = (indicatorName, delta) => {
    setDraftScores((prev) => {
      const curr = prev[indicatorName] !== undefined ? prev[indicatorName] : 0;
      const nextVal = Math.min(100, Math.max(0, curr + delta));
      return { ...prev, [indicatorName]: nextVal };
    });
    setHasChanges(true);
  };

  // Resolve dynamic category list (updating category 7 'posisi' if draftPosition changed)
  const effectiveCategoryList = useMemo(() => {
    if (!resolvePositionIndicatorsFn) return categoryList;
    const posConfig = resolvePositionIndicatorsFn(draftPosition, activeTier);
    if (!posConfig || !Array.isArray(posConfig.indicators)) return categoryList;

    return categoryList.map((cat) => {
      if (cat.key === 'posisi') {
        return {
          ...cat,
          label: `7. Khusus Posisi (${posConfig.shortLabel || draftPosition})`,
          count: posConfig.indicators.length,
          indicators: posConfig.indicators
        };
      }
      return cat;
    });
  }, [categoryList, draftPosition, activeTier, resolvePositionIndicatorsFn]);

  // Set preset score for all indicators in a specific category
  const handleDraftCategoryPreset = (catKey, presetScore) => {
    const catObj = effectiveCategoryList.find((c) => c.key === catKey);
    if (!catObj || !catObj.indicators) return;

    setDraftScores((prev) => {
      const updated = { ...prev };
      catObj.indicators.forEach((ind) => {
        updated[ind] = presetScore;
      });
      return updated;
    });
    setHasChanges(true);
  };

  // Set global preset score across all 7 categories
  const handleDraftGlobalPreset = (presetScore) => {
    setDraftScores((prev) => {
      const updated = { ...prev };
      effectiveCategoryList.forEach((cat) => {
        (cat.indicators || []).forEach((ind) => {
          updated[ind] = presetScore;
        });
      });
      return updated;
    });
    setHasChanges(true);
  };

  // Calculate live average and grade from draftScores across the 7 categories
  const { draftCategoryList, draftOverallScore, draftGrade, totalIndicators, evaluatedCount } = useMemo(() => {
    let allIndicatorsCount = 0;
    let ratedCount = 0;

    const updatedCategories = effectiveCategoryList.map((cat) => {
      const inds = cat.indicators || [];
      allIndicatorsCount += inds.length;

      let catTotal = 0;
      inds.forEach((ind) => {
        const val = draftScores[ind] !== undefined ? draftScores[ind] : 0;
        if (val > 0) ratedCount++;
        catTotal += val;
      });

      const catScore = inds.length > 0 ? Math.round(catTotal / inds.length) : (cat.score || 0);
      return {
        ...cat,
        score: catScore
      };
    });

    const sumCatScores = updatedCategories.reduce((sum, c) => sum + (c.score || 0), 0);
    const overall = updatedCategories.length > 0 ? Math.round(sumCatScores / updatedCategories.length) : 0;
    const grade = getScoreGrade(overall);

    return {
      draftCategoryList: updatedCategories,
      draftOverallScore: overall,
      draftGrade: grade,
      totalIndicators: allIndicatorsCount,
      evaluatedCount: ratedCount
    };
  }, [effectiveCategoryList, draftScores]);

  const handleSaveClick = (e) => {
    if (e) e.preventDefault();
    if (onSave) {
      onSave(draftScores, {
        selectedPosition: draftPosition,
        secondaryPosition: draftSecondaryPosition,
        selectedSpecialization: draftSpecialization,
        selectedStyleCode: draftStyleCode
      });
    }
  };

  const currentStyleObj = getStyleConfigFn ? getStyleConfigFn(draftStyleCode) : null;
  const currentPositionSpecs = (sportType === 'football' && getPositionConfigFn)
    ? (getPositionConfigFn(draftPosition)?.specializations || [])
    : [];

  if (isMobile) {
    return (
      <div className="space-y-3 animate-in fade-in duration-150 pb-4">
        {/* 1. MOBILE EDIT HEADER + LIVE SCORE PREVIEW */}
        <div className="chua-m-eval-card flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onCancel}
              className="chua-m-eval-nav-icon-btn"
              title="Kembali"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-4 h-4 text-[#17233D]" />
            </button>

            <div className="min-w-0">
              <h2 className="font-bold text-[14px] text-[#17233D] leading-tight truncate my-0">
                Edit Evaluasi Atlet
              </h2>
              <p className="text-[11px] font-medium text-[#68758B] truncate my-0 mt-0.5">
                {studentName} {sportLabel ? `• ${sportLabel}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#101D38] text-white rounded-[10px] shrink-0">
            <span className="font-mono text-[13px] font-extrabold tabular-nums">
              {draftOverallScore}
            </span>
            <span className="text-[10px] text-slate-300 font-semibold">/100</span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#16A779] text-white">
              {draftGrade.grade.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* 2. COMPACT POSITION & TACTICAL ROLE CARD */}
        {availablePositions.length > 0 && (
          <div className="chua-m-eval-card !p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowConfigSection(!showConfigSection)}
              className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left bg-white cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Target className="w-4 h-4 text-[#2455E8] shrink-0" />
                <span className="text-[13px] font-bold text-[#17233D] truncate">
                  Posisi &amp; Peran Taktis
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F5F7FC] text-[#2455E8] border border-[#E7EBF2]">
                  {draftPosition}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#68758B] shrink-0">
                <span>{showConfigSection ? 'Tutup' : 'Ubah'}</span>
                {showConfigSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showConfigSection && (
              <div className="p-3.5 pt-2.5 border-t border-[#E7EBF2] bg-[#F5F7FC]/60 space-y-2.5">
                {sportType === 'futsal' ? (
                  <div className="space-y-2.5">
                    <div>
                      <label htmlFor="m-edit-futsal-position" className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider mb-1">
                        Posisi Pemain Futsal
                      </label>
                      <select
                        id="m-edit-futsal-position"
                        disabled={isArchived}
                        value={draftPosition}
                        onChange={(e) => handleDraftPositionChange(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 text-[12px] bg-white border border-[#E7EBF2] rounded-[10px] font-bold text-[#17233D]"
                      >
                        {availablePositions.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {activeTier >= 3 && (
                      <div>
                        <label htmlFor="m-edit-futsal-style" className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider mb-1">
                          Gaya Bermain Taktis (STY)
                        </label>
                        <select
                          id="m-edit-futsal-style"
                          disabled={isArchived}
                          value={draftStyleCode}
                          onChange={(e) => {
                            setDraftStyleCode(e.target.value);
                            setHasChanges(true);
                          }}
                          className="w-full min-h-[44px] px-3 py-2 text-[12px] bg-white border border-[#E7EBF2] rounded-[10px] font-bold text-[#17233D]"
                        >
                          {playingStyles.map((st) => (
                            <option key={st.code} value={st.code}>
                              {st.code} — {st.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div>
                      <label htmlFor="m-edit-football-position" className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider mb-1">
                        Posisi Utama
                      </label>
                      <select
                        id="m-edit-football-position"
                        disabled={isArchived}
                        value={draftPosition}
                        onChange={(e) => handleDraftPositionChange(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 text-[12px] bg-white border border-[#E7EBF2] rounded-[10px] font-bold text-[#17233D]"
                      >
                        {availablePositions.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {activeTier >= 3 && secondaryPositions.length > 0 && (
                      <div>
                        <label htmlFor="m-edit-football-sec-pos" className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider mb-1">
                          Posisi Alternatif
                        </label>
                        <select
                          id="m-edit-football-sec-pos"
                          disabled={isArchived}
                          value={draftSecondaryPosition}
                          onChange={(e) => {
                            setDraftSecondaryPosition(e.target.value);
                            setHasChanges(true);
                          }}
                          className="w-full min-h-[44px] px-3 py-2 text-[12px] bg-white border border-[#E7EBF2] rounded-[10px] font-bold text-[#17233D]"
                        >
                          {secondaryPositions.map((sp) => (
                            <option key={sp.code} value={sp.code}>
                              {sp.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {activeTier >= 3 && currentPositionSpecs.length > 0 && (
                      <div>
                        <label htmlFor="m-edit-football-spec" className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider mb-1">
                          Peran Taktis / Spesialisasi
                        </label>
                        <select
                          id="m-edit-football-spec"
                          disabled={isArchived}
                          value={draftSpecialization}
                          onChange={(e) => {
                            setDraftSpecialization(e.target.value);
                            setHasChanges(true);
                          }}
                          className="w-full min-h-[44px] px-3 py-2 text-[12px] bg-white border border-[#E7EBF2] rounded-[10px] font-bold text-[#17233D]"
                        >
                          {currentPositionSpecs.map((spec) => (
                            <option key={spec} value={spec}>
                              {spec}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {activeTier >= 3 && playingStyles.length > 0 && (
                      <div>
                        <label htmlFor="m-edit-football-style" className="block text-[11px] font-bold text-[#68758B] uppercase tracking-wider mb-1">
                          Gaya Bermain (STY)
                        </label>
                        <select
                          id="m-edit-football-style"
                          disabled={isArchived}
                          value={draftStyleCode}
                          onChange={(e) => {
                            setDraftStyleCode(e.target.value);
                            setHasChanges(true);
                          }}
                          className="w-full min-h-[44px] px-3 py-2 text-[12px] bg-white border border-[#E7EBF2] rounded-[10px] font-bold text-[#17233D]"
                        >
                          {playingStyles.map((st) => (
                            <option key={st.code} value={st.code}>
                              {st.code} — {st.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. COMPACT GLOBAL PRESET BAR (HIDDEN WHEN LOCKED TO MASTER LIBRARY) */}
        {!isLockedToMaster && (
          <div className="chua-m-eval-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#17233D] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#2455E8]" />
                <span>Preset Cepat (Semua Kategori)</span>
              </span>
              <span className="text-[11px] font-medium text-[#68758B]">
                {evaluatedCount}/{totalIndicators} terisi
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                disabled={isArchived}
                onClick={() => handleDraftGlobalPreset(0)}
                className="chua-m-eval-preset-btn bg-rose-50 text-rose-700 border border-rose-200 disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={isArchived}
                onClick={() => handleDraftGlobalPreset(50)}
                className="chua-m-eval-preset-btn bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2] disabled:opacity-50"
              >
                Standard
              </button>
              <button
                type="button"
                disabled={isArchived}
                onClick={() => handleDraftGlobalPreset(75)}
                className="chua-m-eval-preset-btn bg-blue-50 text-[#2455E8] border border-blue-200 disabled:opacity-50"
              >
                Good
              </button>
              <button
                type="button"
                disabled={isArchived}
                onClick={() => handleDraftGlobalPreset(90)}
                className="chua-m-eval-preset-btn bg-emerald-50 text-[#16A779] border border-emerald-200 disabled:opacity-50"
              >
                Elite
              </button>
            </div>
          </div>
        )}

        {/* 4. 7-CATEGORY PROGRESSIVE DISCLOSURE ACCORDION */}
        <AssessmentIndicatorsAccordion
          categoryList={draftCategoryList}
          scores={draftScores}
          onScoreChange={handleDraftScoreChange}
          onAdjustScore={handleDraftAdjustScore}
          onSetCategoryPreset={isLockedToMaster ? undefined : handleDraftCategoryPreset}
          activeCategoryKey={activeCategoryKey}
          isArchived={isArchived}
          tierLabel={tierLabel}
          isMobile={true}
          lockedToMasterLibrary={isLockedToMaster}
          measuredIndicatorMap={measuredIndicatorMap}
          onOpenMasterLibrary={onOpenMasterLibrary}
        />

        {/* 5. STICKY BOTTOM ACTION BAR: BATAL & SIMPAN PERUBAHAN */}
        <div className="sticky bottom-[76px] z-30 bg-white/95 backdrop-blur-md p-3 rounded-[16px] border border-[#E7EBF2] shadow-[0_8px_24px_rgba(16,29,56,0.12)] space-y-2">
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <span className="font-semibold text-[#68758B]">
              {hasChanges ? 'Perubahan belum diterapkan' : 'Nilai siap diterapkan'}
            </span>
            <span className="font-bold text-[#17233D] font-mono">
              Preview Skor: {draftOverallScore}/100 ({draftGrade.grade.split(' ')[0]})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[48px] px-3 py-2 text-[13px] font-bold text-[#17233D] bg-[#F5F7FC] rounded-[12px] border border-[#E7EBF2] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#68758B]" />
              <span>Batal</span>
            </button>

            <button
              type="button"
              disabled={isArchived}
              onClick={handleSaveClick}
              className="min-h-[48px] px-3 py-2 text-[13px] font-bold text-white bg-[#2455E8] rounded-[12px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-white" />
              <span>Simpan Nilai</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* 1. HEADER ATLET DAN NAVIGASI KEMBALI */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-slate-200 shrink-0"
            title="Kembali ke halaman utama asesmen"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="font-black text-sm sm:text-base text-slate-900 tracking-tight truncate">
              Edit Penilaian Indikator
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#101D38] text-[#C89D32] border border-[#C89D32]/40">
                {studentName}
              </span>
              {sportLabel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {sportLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 shrink-0">
          <span className="font-mono text-xs sm:text-sm font-black text-slate-900 tabular-nums">
            {draftOverallScore}/100
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${draftGrade.badge}`}>
            {draftGrade.grade.split(' ')[0]}
          </span>
        </div>
      </div>

      {/* 2. KONFIGURASI POSISI DAN PERAN TAKTIS */}
      {availablePositions.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowConfigSection(!showConfigSection)}
            className="w-full p-3.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/80 transition-colors cursor-pointer min-h-[48px]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Target className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                Konfigurasi Posisi &amp; Peran Taktis
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {draftPosition}
              </span>
              {activeTier >= 3 && draftStyleCode && (
                <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {draftStyleCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-500 shrink-0">
              <span className="text-[11px]">{showConfigSection ? 'Tutup' : 'Ubah'}</span>
              {showConfigSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showConfigSection && (
            <div className="px-3.5 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-slate-100 space-y-3">
              {sportType === 'futsal' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edit-futsal-position" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      1. Posisi Pemain Futsal
                    </label>
                    <select
                      id="edit-futsal-position"
                      aria-label="Posisi Pemain Futsal"
                      disabled={isArchived}
                      value={draftPosition}
                      onChange={(e) => handleDraftPositionChange(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 cursor-pointer disabled:opacity-60"
                    >
                      {availablePositions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeTier >= 3 ? (
                    <div>
                      <label htmlFor="edit-futsal-style" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        2. Profil Gaya Bermain Taktis (STY)
                      </label>
                      <select
                        id="edit-futsal-style"
                        aria-label="Profil Gaya Bermain STY"
                        disabled={isArchived}
                        value={draftStyleCode}
                        onChange={(e) => {
                          setDraftStyleCode(e.target.value);
                          setHasChanges(true);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#354944] font-bold text-slate-800 cursor-pointer disabled:opacity-60"
                      >
                        {playingStyles.map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.code} &mdash; {st.name} ({st.desc})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs text-emerald-900 font-medium">
                      <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Tier 1 &amp; 2 fokus pada penguasaan sole control dan rotasi dasar.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Posisi Utama */}
                  <div>
                    <label htmlFor="edit-football-position" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      1. Posisi Utama
                    </label>
                    <select
                      id="edit-football-position"
                      aria-label="Posisi Utama"
                      disabled={isArchived}
                      value={draftPosition}
                      onChange={(e) => handleDraftPositionChange(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer disabled:opacity-60"
                    >
                      {availablePositions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Posisi Alternatif jika Tier >= 3 */}
                  {activeTier >= 3 && secondaryPositions.length > 0 && (
                    <div>
                      <label htmlFor="edit-football-secondary-position" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        2. Posisi Alternatif
                      </label>
                      <select
                        id="edit-football-secondary-position"
                        aria-label="Posisi Alternatif"
                        disabled={isArchived}
                        value={draftSecondaryPosition}
                        onChange={(e) => {
                          setDraftSecondaryPosition(e.target.value);
                          setHasChanges(true);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer disabled:opacity-60"
                      >
                        {secondaryPositions.map((sp) => (
                          <option key={sp.code} value={sp.code}>
                            {sp.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Spesialisasi Peran jika Tier >= 3 */}
                  {activeTier >= 3 && currentPositionSpecs.length > 0 && (
                    <div>
                      <label htmlFor="edit-football-specialization" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        3. Spesialisasi Peran
                      </label>
                      <select
                        id="edit-football-specialization"
                        aria-label="Spesialisasi Peran"
                        disabled={isArchived}
                        value={draftSpecialization}
                        onChange={(e) => {
                          setDraftSpecialization(e.target.value);
                          setHasChanges(true);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer disabled:opacity-60"
                      >
                        {currentPositionSpecs.map((spec) => (
                          <option key={spec} value={spec}>
                            {spec}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Gaya Bermain STY jika Tier >= 3 */}
                  {activeTier >= 3 && playingStyles.length > 0 && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <label htmlFor="edit-football-style" className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        4. Profil Gaya Bermain Taktis (STY)
                      </label>
                      <select
                        id="edit-football-style"
                        aria-label="Profil Gaya Bermain STY"
                        disabled={isArchived}
                        value={draftStyleCode}
                        onChange={(e) => {
                          setDraftStyleCode(e.target.value);
                          setHasChanges(true);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 cursor-pointer disabled:opacity-60"
                      >
                        {playingStyles.map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.code} &mdash; {st.name} ({st.desc})
                          </option>
                        ))}
                      </select>

                      {currentStyleObj && (
                        <div className="mt-2 p-2 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-900 font-medium truncate">
                            <strong>{currentStyleObj.code} ({currentStyleObj.name}):</strong> {currentStyleObj.desc}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. PRESET PENILAIAN CEPAT (HIDDEN WHEN LOCKED TO MASTER LIBRARY) */}
      {!isLockedToMaster && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:px-5 sm:py-3.5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Preset Penilaian Cepat</span>
          </span>

          <div className="grid grid-cols-4 gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={isArchived}
              onClick={() => handleDraftGlobalPreset(0)}
              className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
              title="Reset semua indikator ke 0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              disabled={isArchived}
              onClick={() => handleDraftGlobalPreset(50)}
              className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              Standard
            </button>
            <button
              type="button"
              disabled={isArchived}
              onClick={() => handleDraftGlobalPreset(75)}
              className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200 transition-all cursor-pointer disabled:opacity-50"
            >
              Good
            </button>
            <button
              type="button"
              disabled={isArchived}
              onClick={() => handleDraftGlobalPreset(90)}
              className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-center bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
            >
              Elite
            </button>
          </div>
        </div>
      )}

      {/* 4. LEMBAR PENILAIAN INDIKATOR (7 KATEGORI ACCORDION) */}
      <AssessmentIndicatorsAccordion
        categoryList={draftCategoryList}
        scores={draftScores}
        onScoreChange={handleDraftScoreChange}
        onAdjustScore={handleDraftAdjustScore}
        onSetCategoryPreset={isLockedToMaster ? undefined : handleDraftCategoryPreset}
        activeCategoryKey={activeCategoryKey}
        isArchived={isArchived}
        tierLabel={tierLabel}
        lockedToMasterLibrary={isLockedToMaster}
        measuredIndicatorMap={measuredIndicatorMap}
        onOpenMasterLibrary={onOpenMasterLibrary}
      />

      {/* 5. RINGKASAN ESTIMASI SKOR */}
      <div className="bg-white rounded-2xl p-3.5 sm:px-5 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {evaluatedCount} / {totalIndicators} indikator dinilai
          </span>
          {hasChanges && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-bold">
              Draft belum disimpan
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">
            Preview Rata-Rata:
          </span>
          <span className="font-mono text-sm font-black text-slate-900 tabular-nums">
            {draftOverallScore} / 100
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${draftGrade.badge}`}>
            {draftGrade.grade}
          </span>
        </div>
      </div>

      {/* 6. STICKY ACTION BAR: BATAL DAN SIMPAN */}
      <div className="sticky bottom-2 z-20 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200/90 shadow-lg flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <X className="w-4 h-4 text-slate-500" />
          <span>Batal</span>
        </button>

        <button
          type="button"
          disabled={isArchived}
          onClick={handleSaveClick}
          className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 text-xs font-black text-white bg-[#101D38] hover:bg-[#1d2d52] rounded-xl border border-[#C89D32]/50 shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4 text-[#C89D32]" />
          <span>Simpan Perubahan Nilai</span>
        </button>
      </div>
    </div>
  );
}
