import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal, 
  LayoutGrid, 
  RotateCcw, 
  CheckCircle2, 
  Minus, 
  Plus, 
  Star,
  Target
} from 'lucide-react';
import { getCategoryTheme } from './ScoutingPolarAreaPanel';

// ============================================================================
// SINGLE INDICATOR CARD (SLIDER + STEPPER)
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
    <div className={`p-3 sm:p-3.5 bg-white border ${isSpecial ? 'border-indigo-200/90 hover:border-indigo-400' : 'border-slate-200/90 hover:border-slate-300'} rounded-2xl space-y-2 shadow-2xs transition-all`}>
      <div className="flex items-center justify-between text-xs font-bold gap-2">
        <span className="text-slate-800 truncate" title={title}>
          {isSpecial && <Star className="w-3 h-3 text-indigo-500 fill-indigo-200 inline mr-1" />}
          {title}
        </span>

        {/* Stepper Buttons (-5 / +5) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={isArchived}
            onClick={() => onAdjust(-5)}
            className="w-7 h-7 min-w-[28px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Kurangi 5"
            aria-label={`Kurangi 5 ${title}`}
          >
            <Minus className="w-3 h-3" />
          </button>

          <span 
            className="w-8 text-center font-black font-mono text-sm tabular-nums"
            style={{ color: accentColor }}
          >
            {numVal}
          </span>

          <button
            type="button"
            disabled={isArchived}
            onClick={() => onAdjust(5)}
            className="w-7 h-7 min-w-[28px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Tambah 5"
            aria-label={`Tambah 5 ${title}`}
          >
            <Plus className="w-3 h-3" />
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
        className="w-full cursor-pointer h-1.5 bg-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
  tierLabel = ''
}) {
  // Track open state for each category key
  const [openKeys, setOpenKeys] = useState(() => {
    // Default open first category
    const initial = {};
    if (categoryList.length > 0) {
      initial[categoryList[0].key] = true;
    }
    return initial;
  });

  // Automatically expand activeCategoryKey when requested
  useEffect(() => {
    if (activeCategoryKey) {
      setOpenKeys((prev) => ({ ...prev, [activeCategoryKey]: true }));
    }
  }, [activeCategoryKey]);

  const toggleCategory = (key) => {
    setOpenKeys((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isAllOpen = categoryList.every((c) => openKeys[c.key]);

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

  // Helper to count evaluated indicators
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

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 lg:p-6 space-y-4 shadow-xs">
      {/* HEADER & TOGGLE ALL BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
              Lembar Penilaian Indikator (7 Kategori)
            </h3>
            {tierLabel && (
              <p className="text-[11px] text-slate-500 font-medium">
                Indikator kurikulum aktif: {tierLabel}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border self-start sm:self-center bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 shadow-2xs"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>{isAllOpen ? 'Tutup Semua Kategori' : 'Buka Semua Kategori'}</span>
        </button>
      </div>

      {/* ACCORDION ITEMS */}
      <div className="space-y-3">
        {categoryList.map((cat, idx) => {
          const theme = getCategoryTheme(cat.key);
          const IconComp = theme.icon || Target;
          const isOpen = Boolean(openKeys[cat.key]);
          const indicators = cat.indicators || [];
          const stats = getCategoryStats(indicators);
          const score = Math.max(0, Math.min(100, Number(cat.score) || 0));

          return (
            <div
              key={cat.key}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isOpen ? 'border-slate-300 shadow-xs bg-slate-50/40' : 'border-slate-200/90 bg-white hover:border-slate-300'
              }`}
            >
              {/* ACCORDION HEADER */}
              <div
                onClick={() => toggleCategory(cat.key)}
                className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none bg-white transition-colors hover:bg-slate-50/80"
              >
                {/* Left: Category Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold shadow-2xs"
                    style={{ backgroundColor: theme.color }}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                        {idx + 1}. {cat.label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {stats.total} Indikator
                      </span>
                      {stats.isCompleted ? (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Lengkap ({stats.rated}/{stats.total})</span>
                        </span>
                      ) : stats.rated > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {stats.rated}/{stats.total} Dinilai
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                      {theme.desc}
                    </p>
                  </div>
                </div>

                {/* Right: Score & Quick Presets & Chevron */}
                <div className="flex items-center gap-3 self-end md:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Category Score Badge */}
                  <div className="flex items-baseline gap-1 bg-slate-100/90 px-2.5 py-1 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Skor:</span>
                    <span 
                      className="font-mono text-sm sm:text-base font-black tabular-nums"
                      style={{ color: theme.color }}
                    >
                      {score}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                  </div>

                  {/* Preset Buttons per Category */}
                  {!isArchived && onSetCategoryPreset && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 0)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                        title="Reset kategori ke 0"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 50)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-800 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                        title="Set indikator kategori ke 50"
                      >
                        50
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 75)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200 transition-all cursor-pointer shadow-2xs"
                        title="Set indikator kategori ke 75"
                      >
                        75
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetCategoryPreset(cat.key, 90)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                        title="Set indikator kategori ke 90"
                      >
                        90
                      </button>
                    </div>
                  )}

                  {/* Accordion Chevron Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.key)}
                    className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
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

              {/* ACCORDION BODY (GRID OF INDICATORS) */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-200/70 p-3 sm:p-4 bg-slate-50/50"
                  >
                    {indicators.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Tidak ada indikator aktif pada jenjang/fase ini.
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
