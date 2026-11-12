import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal, 
  LayoutGrid, 
  CheckCircle2, 
  Minus, 
  Plus, 
  Star,
  Target
} from 'lucide-react';
import { getCategoryTheme } from './ScoutingPolarAreaPanel';

// ============================================================================
// SINGLE INDICATOR CARD (SLIDER + STEPPER, MOBILE-FIRST 44PX TOUCH TARGETS)
// ============================================================================
export function AccordionIndicatorCard({
  title,
  value = 0,
  isSpecial = false,
  onScoreChange,
  onAdjust,
  isArchived = false,
  accentColor = '#10B981'
}) {
  const numVal = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className={`p-3 bg-white border ${isSpecial ? 'border-indigo-200/90' : 'border-slate-200/90'} rounded-2xl space-y-2 shadow-2xs`}>
      <div className="flex items-center justify-between text-xs font-bold gap-2">
        <span className="text-slate-800 truncate" title={title}>
          {isSpecial && <Star className="w-3 h-3 text-indigo-500 fill-indigo-200 inline mr-1" />}
          {title}
        </span>

        {/* Stepper Buttons (-5 / +5) with 44px touch target */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={isArchived}
            onClick={() => onAdjust(-5)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-black flex items-center justify-center text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Kurangi 5"
            aria-label={`Kurangi 5 ${title}`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <span 
            className="w-9 text-center font-black font-mono text-sm tabular-nums"
            style={{ color: accentColor }}
          >
            {numVal}
          </span>

          <button
            type="button"
            disabled={isArchived}
            onClick={() => onAdjust(5)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-black flex items-center justify-center text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Tambah 5"
            aria-label={`Tambah 5 ${title}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slider Input */}
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        disabled={isArchived}
        value={numVal}
        onChange={(e) => onScoreChange(e.target.value)}
        className="w-full cursor-pointer h-2 bg-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ accentColor }}
        aria-label={`Skor ${title}`}
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT: AssessmentIndicatorsAccordion
// ============================================================================
/**
 * @param {{
 *   categoryList?: any[],
 *   scores?: Record<string, number>,
 *   onScoreChange?: (name: string, val: any) => void,
 *   onAdjustScore?: (name: string, delta: number) => void,
 *   onSetCategoryPreset?: (key: string, val: number) => void,
 *   activeCategoryKey?: string | null,
 *   isArchived?: boolean,
 *   tierLabel?: string
 * }} props
 */
export default function AssessmentIndicatorsAccordion({
  categoryList = [],
  scores = {},
  onScoreChange,
  onAdjustScore,
  onSetCategoryPreset,
  activeCategoryKey = null,
  isArchived = false,
  tierLabel = '',
  isMobile = false,
  defaultOpenFirst = true
}) {
  // Open only the focused category or the first category by default (avoid opening all at once)
  const [openKeys, setOpenKeys] = useState(() => {
    const initial = {};
    if (activeCategoryKey) {
      initial[activeCategoryKey] = true;
    } else if (defaultOpenFirst && categoryList.length > 0) {
      initial[categoryList[0].key] = true;
    }
    return initial;
  });

  // Focus solely on activeCategoryKey when user navigates via chart sector
  useEffect(() => {
    if (activeCategoryKey) {
      setOpenKeys({ [activeCategoryKey]: true });
    }
  }, [activeCategoryKey]);

  const toggleCategory = (key) => {
    setOpenKeys((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isAllOpen = categoryList.length > 0 && categoryList.every((c) => openKeys[c.key]);

  const handleToggleAll = () => {
    if (isAllOpen) {
      setOpenKeys({});
    } else {
      const all = {};
      categoryList.forEach((c) => {
        all[c.key] = true;
      });
      setOpenKeys(all);
    }
  };

  const getCategoryStats = (indicators = []) => {
    const total = indicators.length;
    if (total === 0) return { total: 0, rated: 0, isCompleted: true };
    const rated = indicators.filter((ind) => {
      const s = scores[ind];
      return s !== undefined && s !== null && s > 0;
    }).length;
    return {
      total,
      rated,
      isCompleted: rated === total && total > 0
    };
  };

  if (isMobile) {
    return (
      <div className="chua-m-eval-card space-y-3">
        {/* MOBILE HEADER & TOGGLE ALL */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E7EBF2]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-[10px] bg-[#101D38] text-white flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-[#16A779]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[13px] text-[#17233D] leading-tight truncate my-0">
                7 Indikator Penilaian
              </h3>
              <p className="text-[11px] text-[#68758B] font-medium leading-tight truncate my-0 mt-0.5">
                {tierLabel || 'Ketuk kategori untuk membuka rincian indikator'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleAll}
            className="chua-m-eval-secondary-btn shrink-0"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#2455E8]" />
            <span>{isAllOpen ? 'Tutup Semua' : 'Buka Semua'}</span>
          </button>
        </div>

        {/* MOBILE PROGRESSIVE DISCLOSURE ACCORDION LIST */}
        <div className="space-y-2">
          {categoryList.map((cat, idx) => {
            const theme = getCategoryTheme(cat.key);
            const IconComp = theme.icon || Target;
            const isOpen = Boolean(openKeys[cat.key]);
            const indicators = cat.indicators || [];
            const stats = getCategoryStats(indicators);
            const score = Math.max(0, Math.min(100, Number(cat.score) || 0));
            const displayLabel = /^\d+\./.test(String(cat.label).trim())
              ? cat.label
              : `${idx + 1}. ${cat.label}`;

            return (
              <div
                key={cat.key}
                className={`chua-m-eval-accordion-item ${
                  isOpen ? 'chua-m-eval-accordion-item-open' : ''
                }`}
              >
                {/* ACCORDION HEADER BUTTON */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.key)}
                  className="chua-m-eval-accordion-header"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 text-white font-bold"
                      style={{ backgroundColor: isOpen ? '#2455E8' : theme.color }}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[13px] text-[#17233D] truncate leading-snug">
                          {displayLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[11px] font-medium text-[#68758B] whitespace-nowrap">
                          {stats.rated}/{stats.total} Indikator
                        </span>
                        {stats.isCompleted && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#16A779] whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Lengkap</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Category Score + Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-baseline gap-0.5 bg-[#F5F7FC] px-2.5 py-1 rounded-[10px] border border-[#E7EBF2]">
                      <span
                        className="font-mono text-[13px] font-extrabold tabular-nums"
                        style={{ color: score > 0 ? theme.color : '#17233D' }}
                      >
                        {score}
                      </span>
                      <span className="text-[10px] font-bold text-[#68758B]">/100</span>
                    </div>

                    <span className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[#68758B]">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#2455E8]" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                </button>

                {/* ACCORDION BODY */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="p-3 bg-[#FFFFFF] space-y-2.5"
                    >
                      {/* Category Quick Presets inside open body */}
                      {!isArchived && onSetCategoryPreset && (
                        <div className="bg-[#F5F7FC] p-2 rounded-[12px] border border-[#E7EBF2] space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#68758B] block">
                            Preset Cepat Kategori Ini:
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSetCategoryPreset(cat.key, 0)}
                              className="chua-m-eval-preset-btn bg-rose-50 text-rose-700 border border-rose-200"
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => onSetCategoryPreset(cat.key, 50)}
                              className="chua-m-eval-preset-btn bg-white text-[#17233D] border border-[#E7EBF2]"
                            >
                              50
                            </button>
                            <button
                              type="button"
                              onClick={() => onSetCategoryPreset(cat.key, 75)}
                              className="chua-m-eval-preset-btn bg-blue-50 text-[#2455E8] border border-blue-200"
                            >
                              75
                            </button>
                            <button
                              type="button"
                              onClick={() => onSetCategoryPreset(cat.key, 90)}
                              className="chua-m-eval-preset-btn bg-emerald-50 text-[#16A779] border border-emerald-200"
                            >
                              90
                            </button>
                          </div>
                        </div>
                      )}

                      {indicators.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#68758B]">
                          Tidak ada indikator aktif pada jenjang ini.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {indicators.map((indName) => (
                            <AccordionIndicatorCard
                              key={indName}
                              title={indName}
                              value={scores[indName] !== undefined ? scores[indName] : 0}
                              isSpecial={cat.isSpecial}
                              onScoreChange={(val) => onScoreChange(indName, val)}
                              onAdjust={(delta) => onAdjustScore(indName, delta)}
                              isArchived={isArchived}
                              accentColor={theme.color}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3.5 sm:p-5 space-y-3 shadow-xs">
      {/* HEADER & TOGGLE ALL BAR */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-tight truncate">
              Lembar Penilaian Indikator (7 Kategori)
            </h3>
            {tierLabel && (
              <p className="text-[10px] text-slate-500 font-medium truncate">
                {tierLabel}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleAll}
          className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 flex items-center gap-1.5"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isAllOpen ? 'Tutup Semua' : 'Buka Semua'}</span>
        </button>
      </div>

      {/* ACCORDION ITEMS */}
      <div className="space-y-2.5">
        {categoryList.map((cat, idx) => {
          const theme = getCategoryTheme(cat.key);
          const IconComp = theme.icon || Target;
          const isOpen = Boolean(openKeys[cat.key]);
          const indicators = cat.indicators || [];
          const stats = getCategoryStats(indicators);
          const score = Math.max(0, Math.min(100, Number(cat.score) || 0));
          const displayLabel = /^\d+\./.test(String(cat.label).trim())
            ? cat.label
            : `${idx + 1}. ${cat.label}`;

          return (
            <div
              key={cat.key}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isOpen ? 'border-slate-300 shadow-2xs bg-slate-50/40' : 'border-slate-200/90 bg-white'
              }`}
            >
              {/* ACCORDION HEADER */}
              <div
                onClick={() => toggleCategory(cat.key)}
                className="p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none bg-white hover:bg-slate-50/80 min-h-[52px]"
              >
                {/* Left: Category Title & Count */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold"
                    style={{ backgroundColor: theme.color }}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                        {displayLabel}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {stats.total} Indikator
                      </span>
                      {stats.isCompleted ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{stats.rated}/{stats.total}</span>
                        </span>
                      ) : stats.rated > 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {stats.rated}/{stats.total}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right: Category Score, Presets, & Toggle */}
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-baseline gap-1 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                    <span 
                      className="font-mono text-sm font-black tabular-nums"
                      style={{ color: theme.color }}
                    >
                      {score}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">/100</span>
                  </div>

                  {!isArchived && onSetCategoryPreset && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 0)}
                        className="min-h-[38px] sm:min-h-[36px] px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 transition-all cursor-pointer"
                        title="Reset kategori ke 0"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 50)}
                        className="min-h-[38px] sm:min-h-[36px] px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 border border-slate-200 transition-all cursor-pointer"
                      >
                        50
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 75)}
                        className="min-h-[38px] sm:min-h-[36px] px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200 transition-all cursor-pointer"
                      >
                        75
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 90)}
                        className="min-h-[38px] sm:min-h-[36px] px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                      >
                        90
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.key)}
                    className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label={`Buka/tutup ${cat.label}`}
                  >
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* ACCORDION BODY */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="border-t border-slate-200/70 p-3 sm:p-4 bg-slate-50/50"
                  >
                    {indicators.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        Tidak ada indikator aktif pada jenjang ini.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {indicators.map((indName) => (
                          <AccordionIndicatorCard
                            key={indName}
                            title={indName}
                            value={scores[indName] !== undefined ? scores[indName] : 0}
                            isSpecial={cat.isSpecial}
                            onScoreChange={(val) => onScoreChange(indName, val)}
                            onAdjust={(delta) => onAdjustScore(indName, delta)}
                            isArchived={isArchived}
                            accentColor={theme.color}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
