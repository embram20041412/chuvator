import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  Dumbbell, 
  Zap, 
  Brain, 
  Shield, 
  MessageSquare, 
  Activity, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Edit3
} from 'lucide-react';

// ============================================================================
// OPTA-INSPIRED SPORTS TECH CATEGORY THEME CONFIGURATION
// ============================================================================
export const OPTA_CATEGORY_CONFIG = {
  fisik: {
    key: 'fisik',
    label: 'Kondisi Fisik',
    shortLabel: 'Fisik',
    color: '#10B981',       // Emerald
    hoverColor: '#059669',
    lightBg: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    activeBorder: 'border-emerald-500',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
    icon: Dumbbell,
    desc: 'Vitalitas, daya tahan aerobik/anaerobik, sprint, & kekuatan fisik.'
  },
  teknik: {
    key: 'teknik',
    label: 'Kemampuan Teknik',
    shortLabel: 'Teknik',
    color: '#2455E8',       // Electric Blue
    hoverColor: '#1d4ed8',
    lightBg: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    activeBorder: 'border-blue-500',
    textColor: 'text-blue-700 dark:text-blue-400',
    barColor: 'bg-blue-600',
    icon: Zap,
    desc: 'Sentuhan pertama, akurasi operan, dribel, dan eksekusi bola.'
  },
  taktik: {
    key: 'taktik',
    label: 'Pemahaman Taktik',
    shortLabel: 'Taktik',
    color: '#8B5CF6',       // Purple / Violet
    hoverColor: '#7c3aed',
    lightBg: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    activeBorder: 'border-purple-500',
    textColor: 'text-purple-700 dark:text-purple-400',
    barColor: 'bg-purple-500',
    icon: Brain,
    desc: 'Visi lapangan, positioning ruang, transisi, dan decision making.'
  },
  mental: {
    key: 'mental',
    label: 'Mentalitas',
    shortLabel: 'Mental',
    color: '#F59E0B',       // Amber / Gold
    hoverColor: '#d97706',
    lightBg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    activeBorder: 'border-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
    barColor: 'bg-amber-500',
    icon: Shield,
    desc: 'Resiliensi, konsentrasi, sportivitas, determinasi, & leadership.'
  },
  komunikasi: {
    key: 'komunikasi',
    label: 'Komunikasi Lapangan',
    shortLabel: 'Komunikasi',
    color: '#0EA5E9',       // Sky Blue / Cyan
    hoverColor: '#0284c7',
    lightBg: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    activeBorder: 'border-sky-500',
    textColor: 'text-sky-700 dark:text-sky-400',
    barColor: 'bg-sky-500',
    icon: MessageSquare,
    desc: 'Komando vokal, instruksi rotasi, & konektivitas antar lini tim.'
  },
  perkembangan: {
    key: 'perkembangan',
    label: 'Perkembangan Atlet',
    shortLabel: 'Perkembangan',
    color: '#EC4899',       // Rose / Pink
    hoverColor: '#db2777',
    lightBg: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    activeBorder: 'border-pink-500',
    textColor: 'text-pink-700 dark:text-pink-400',
    barColor: 'bg-pink-500',
    icon: Activity,
    desc: 'Adaptabilitas latihan, konsistensi progres, & kepatuhan disiplin.'
  },
  posisi: {
    key: 'posisi',
    label: 'Khusus Posisi',
    shortLabel: 'Khusus Posisi',
    color: '#6366F1',       // Indigo / Deep Blue
    hoverColor: '#4f46e5',
    lightBg: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    activeBorder: 'border-indigo-500',
    textColor: 'text-indigo-700 dark:text-indigo-400',
    barColor: 'bg-indigo-500',
    icon: Target,
    desc: 'Indikator spesifik sesuai peran taktis dan formasi atlet.'
  }
};

export const getCategoryTheme = (key = '') => {
  const normalized = String(key).toLowerCase();
  if (normalized.includes('fisik')) return OPTA_CATEGORY_CONFIG.fisik;
  if (normalized.includes('teknik')) return OPTA_CATEGORY_CONFIG.teknik;
  if (normalized.includes('taktik')) return OPTA_CATEGORY_CONFIG.taktik;
  if (normalized.includes('mental')) return OPTA_CATEGORY_CONFIG.mental;
  if (normalized.includes('komunikasi')) return OPTA_CATEGORY_CONFIG.komunikasi;
  if (normalized.includes('perkembangan')) return OPTA_CATEGORY_CONFIG.perkembangan;
  if (normalized.includes('posisi')) return OPTA_CATEGORY_CONFIG.posisi;
  return OPTA_CATEGORY_CONFIG.posisi;
};

// ============================================================================
// SVG POLAR AREA MATH UTILITIES
// ============================================================================
function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: Number((cx + r * Math.cos(angleInRadians)).toFixed(3)),
    y: Number((cy + r * Math.sin(angleInRadians)).toFixed(3))
  };
}

function describeSectorPath(cx, cy, rIn, rOut, startAngle, endAngle) {
  const safeIn = Math.max(1, rIn);
  const safeOut = Math.max(safeIn + 1, rOut);
  const p1 = polarToCartesian(cx, cy, safeIn, startAngle);
  const p2 = polarToCartesian(cx, cy, safeOut, startAngle);
  const p3 = polarToCartesian(cx, cy, safeOut, endAngle);
  const p4 = polarToCartesian(cx, cy, safeIn, endAngle);
  const arcSweep = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${safeOut} ${safeOut} 0 ${arcSweep} 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${safeIn} ${safeIn} 0 ${arcSweep} 0 ${p1.x} ${p1.y} Z`;
}

// ============================================================================
// MAIN COMPONENT: ScoutingPolarAreaPanel (CHART ONLY)
// ============================================================================
/**
 * @param {{
 *   categoryList?: any[],
 *   overallScore?: number,
 *   overallGrade?: { grade: string, badge?: string },
 *   activeCategoryKey?: string | null,
 *   onSelectCategory?: (key: string) => void,
 *   onOpenEdit?: (key?: string) => void,
 *   isArchived?: boolean,
 *   sportName?: string
 * }} props
 */
export default function ScoutingPolarAreaPanel({
  categoryList = [],
  overallScore = 0,
  overallGrade = { grade: 'B', badge: 'bg-emerald-100 text-emerald-800' },
  activeCategoryKey = null,
  onSelectCategory,
  onOpenEdit,
  isArchived = false,
  sportName = 'Sepakbola / Futsal'
}) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [showMobileChart, setShowMobileChart] = useState(true);

  // Active or hovered category for focal preview
  const currentFocalKey = hoveredKey || activeCategoryKey;
  const currentFocalCategory = useMemo(() => {
    if (!currentFocalKey) return null;
    return categoryList.find((c) => c.key === currentFocalKey) || null;
  }, [categoryList, currentFocalKey]);

  const focalTheme = currentFocalCategory ? getCategoryTheme(currentFocalCategory.key) : null;

  // Chart Dimensions & Geometry
  const svgSize = 420;
  const cx = svgSize / 2; // 210
  const cy = svgSize / 2; // 210
  const innerRadius = 50;
  const maxOuterRadius = 150;
  const usableRadius = maxOuterRadius - innerRadius; // 100px range (1px per score point)

  const numSlices = Math.max(1, categoryList.length);
  const anglePerSlice = 360 / numSlices;

  // Pre-calculate geometry for each category slice
  const sliceData = useMemo(() => {
    return categoryList.map((cat, idx) => {
      const theme = getCategoryTheme(cat.key);
      const score = Math.max(0, Math.min(100, Number(cat.score) || 0));
      
      // Angle calculation: center the first wedge at top (-90 degrees)
      const startAngle = -90 - (anglePerSlice / 2) + idx * anglePerSlice;
      const endAngle = startAngle + anglePerSlice;
      const midAngle = startAngle + anglePerSlice / 2;

      // Dynamic outer radius: minimum 54px so empty slices still indicate an outline
      const outerRadius = innerRadius + (score / 100) * usableRadius;
      const displayRadius = Math.max(innerRadius + 4, outerRadius);

      // Label coordinate outside the 100-mark circle
      const labelRadius = maxOuterRadius + 28;
      const labelPos = polarToCartesian(cx, cy, labelRadius, midAngle);

      return {
        ...cat,
        theme,
        score,
        startAngle,
        endAngle,
        midAngle,
        outerRadius: displayRadius,
        labelPos,
        isHovered: (hoveredKey === cat.key) || (activeCategoryKey === cat.key)
      };
    });
  }, [categoryList, numSlices, anglePerSlice, innerRadius, usableRadius, maxOuterRadius, cx, cy, hoveredKey, activeCategoryKey]);

  // Concentric Scale Circles (25, 50, 75, 100)
  const scaleLevels = [25, 50, 75, 100];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
      {/* 1. HEADER PANEL BAR */}
      <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#101D38] text-white flex items-center justify-center font-bold shrink-0 shadow-2xs border border-[#C89D32]/40">
            <BarChart2 className="w-5 h-5 text-[#C89D32]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                Scouting Polar-Area Chart
              </h3>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#101D38]/5 text-[#101D38] border border-[#101D38]/15">
                Opta Nightingale Rose
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Visualisasi 7 pilar performa atlet &bull; Skala 0 &mdash; 100
            </p>
          </div>
        </div>

        {/* Action Controls & Realtime Score Badge */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100/80 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Rata-Rata:
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-slate-900">
              {overallScore} / 100
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${overallGrade.badge}`}>
              {overallGrade.grade}
            </span>
          </div>

          {/* Dedicated "Edit Penilaian" Navigation Button */}
          {onOpenEdit && !isArchived && (
            <button
              type="button"
              onClick={() => onOpenEdit(currentFocalKey || undefined)}
              className="px-3 py-1 text-xs font-black text-white bg-[#101D38] hover:bg-[#1d2d52] border border-[#C89D32]/40 rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Buka Lembar Penilaian Indikator Lengkap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#C89D32]" />
              <span>Edit Penilaian</span>
            </button>
          )}

          {/* Mobile Collapse Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileChart(!showMobileChart)}
            className="lg:hidden px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {showMobileChart ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px]">Sembunyikan</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px]">Buka Chart</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: FOCUSED POLAR-AREA VISUALIZATION ONLY */}
      {showMobileChart && (
        <div className="p-4 sm:p-6 lg:p-7 flex flex-col items-center justify-center w-full">
          <div className="relative w-full max-w-[380px] sm:max-w-[440px] aspect-square flex items-center justify-center mx-auto">
            
            {/* SVG POLAR AREA VISUALIZATION */}
            <svg 
              viewBox={`0 0 ${svgSize} ${svgSize}`} 
              className="w-full h-full select-none overflow-visible"
            >
              <defs>
                {/* Subtle drop shadows for interactive highlight */}
                <filter id="opta-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                </filter>
                <filter id="center-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.12" />
                </filter>
              </defs>

              {/* A. CONCENTRIC SCALE RINGS (25, 50, 75, 100) */}
              <g className="concentric-rings">
                {scaleLevels.map((lvl) => {
                  const r = innerRadius + (lvl / 100) * usableRadius;
                  return (
                    <g key={`ring-${lvl}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth={lvl === 100 ? '1.5' : '1'}
                        strokeDasharray={lvl === 100 ? 'none' : '3 3'}
                        opacity={lvl === 100 ? 0.9 : 0.65}
                      />
                      {/* Scale Marker Text along Top Radial Axis */}
                      <text
                        x={cx + 4}
                        y={cy - r + 9}
                        fontSize="8.5"
                        fontWeight="700"
                        fill="#94A3B8"
                        className="font-mono"
                      >
                        {lvl}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* B. RADIAL SECTOR DIVIDERS */}
              <g className="radial-dividers">
                {sliceData.map((slice, idx) => {
                  const dividerAngle = slice.startAngle;
                  const pStart = polarToCartesian(cx, cy, innerRadius, dividerAngle);
                  const pEnd = polarToCartesian(cx, cy, maxOuterRadius + 4, dividerAngle);
                  return (
                    <line
                      key={`divider-${idx}`}
                      x1={pStart.x}
                      y1={pStart.y}
                      x2={pEnd.x}
                      y2={pEnd.y}
                      stroke="#CBD5E1"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.7"
                    />
                  );
                })}
              </g>

              {/* C. OPTA ROSE WEDGES (POLAR AREA SECTORS) */}
              <g className="rose-wedges">
                {sliceData.map((slice) => {
                  const isHovered = slice.isHovered;
                  const slicePath = describeSectorPath(
                    cx, 
                    cy, 
                    innerRadius, 
                    isHovered ? slice.outerRadius + 3 : slice.outerRadius, 
                    slice.startAngle, 
                    slice.endAngle
                  );

                  return (
                    <path
                      key={`sector-${slice.key}`}
                      d={slicePath}
                      fill={slice.theme.color}
                      fillOpacity={isHovered ? 0.95 : 0.78}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        filter: isHovered ? 'url(#opta-glow)' : 'none',
                        transformOrigin: `${cx}px ${cy}px`
                      }}
                      onMouseEnter={() => setHoveredKey(slice.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => {
                        if (onSelectCategory) onSelectCategory(slice.key);
                        if (onOpenEdit) onOpenEdit(slice.key);
                      }}
                    >
                      <title>{`${slice.label}: ${slice.score} / 100 — Ketuk untuk edit penilaian`}</title>
                    </path>
                  );
                })}
              </g>

              {/* D. PERIPHERAL CATEGORY LABELS & SCORE PILLS */}
              <g className="category-labels">
                {sliceData.map((slice) => {
                  const isHovered = slice.isHovered;
                  const pos = slice.labelPos;
                  const isRightSide = pos.x > cx + 15;
                  const isLeftSide = pos.x < cx - 15;
                  const textAnchor = isRightSide ? 'start' : isLeftSide ? 'end' : 'middle';

                  return (
                    <g
                      key={`label-${slice.key}`}
                      className="cursor-pointer transition-opacity duration-200"
                      opacity={isHovered ? 1 : 0.85}
                      onMouseEnter={() => setHoveredKey(slice.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => {
                        if (onSelectCategory) onSelectCategory(slice.key);
                        if (onOpenEdit) onOpenEdit(slice.key);
                      }}
                    >
                      {/* Label Text */}
                      <text
                        x={pos.x}
                        y={pos.y - 3}
                        textAnchor={textAnchor}
                        fontSize="9.5"
                        fontWeight={isHovered ? '800' : '700'}
                        fill={isHovered ? slice.theme.color : '#1E293B'}
                        className="tracking-tight select-none"
                      >
                        {slice.shortLabel || slice.label}
                      </text>

                      {/* Numeric Score Tag */}
                      <text
                        x={pos.x}
                        y={pos.y + 9}
                        textAnchor={textAnchor}
                        fontSize="9"
                        fontWeight="800"
                        fill={slice.theme.color}
                        className="font-mono select-none"
                      >
                        {slice.score}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* E. CENTER HUB (OVERALL SCORE & HOVER PREVIEW) */}
              <g 
                className="center-hub select-none cursor-pointer"
                onClick={() => {
                  if (onOpenEdit) onOpenEdit(currentFocalKey || undefined);
                }}
              >
                <title>{onOpenEdit ? "Ketuk untuk edit lembar penilaian indikator" : "Ringkasan Skor"}</title>
                {/* Outer ring of center circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={innerRadius - 2}
                  fill="#FFFFFF"
                  stroke={currentFocalCategory ? focalTheme.color : '#E2E8F0'}
                  strokeWidth="3"
                  filter="url(#center-shadow)"
                  className="transition-colors duration-300"
                />

                {/* Inner subtle decorative ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={innerRadius - 6}
                  fill={currentFocalCategory ? `${focalTheme.color}08` : '#F8FAFC'}
                />

                {currentFocalCategory ? (
                  // PREVIEW ON HOVER / SELECTION
                  <g className="animate-in fade-in duration-150">
                    <text
                      x={cx}
                      y={cy - 12}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="800"
                      fill="#64748B"
                      className="uppercase tracking-wider select-none"
                    >
                      {focalTheme.shortLabel}
                    </text>
                    <text
                      x={cx}
                      y={cy + 8}
                      textAnchor="middle"
                      fontSize="18"
                      fontWeight="900"
                      fill={focalTheme.color}
                      className="font-mono select-none"
                    >
                      {currentFocalCategory.score || 0}
                    </text>
                    <text
                      x={cx}
                      y={cy + 20}
                      textAnchor="middle"
                      fontSize="7.5"
                      fontWeight="800"
                      fill={focalTheme.color}
                      className="select-none"
                    >
                      Ketuk Edit ✎
                    </text>
                  </g>
                ) : (
                  // IDLE OVERALL SCORE DISPLAY
                  <g>
                    <text
                      x={cx}
                      y={cy - 12}
                      textAnchor="middle"
                      fontSize="7.5"
                      fontWeight="800"
                      fill="#64748B"
                      className="uppercase tracking-wider select-none"
                    >
                      OVERALL
                    </text>
                    <text
                      x={cx}
                      y={cy + 7}
                      textAnchor="middle"
                      fontSize="19"
                      fontWeight="900"
                      fill="#0F172A"
                      className="font-mono select-none"
                    >
                      {overallScore}
                    </text>
                    <text
                      x={cx}
                      y={cy + 19}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="800"
                      fill="#059669"
                      className="select-none"
                    >
                      {overallGrade.grade.split(' ')[0]}
                    </text>
                  </g>
                )}
              </g>
            </svg>

          </div>

          {/* Quick Chart Hint */}
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-[#C89D32]" />
            <span>Arahkan kursor atau ketuk irisan pilar untuk membuka lembar edit penilaian indikator</span>
          </div>
        </div>
      )}
    </div>
  );
}
