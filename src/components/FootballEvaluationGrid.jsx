import React from 'react';
import {
  BarChart2,
  Dumbbell,
  Activity,
  HeartPulse,
  Brain,
  Shield,
  Users,
  Zap,
  Star,
  RefreshCw,
  Award,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import {
  FOOTBALL_LTAD_TIERS,
  TIER1_EXPLORATION_POSITIONS,
  TIER2_BASIC_LINE_POSITIONS,
  FOOTBALL_LTAD_CORE_PILLARS,
  getFilteredMetricsForTier
} from './footballLtadConstants';
import { FOOTBALL_POSITION_HIERARCHY } from './EvaluationSection';

export default function FootballEvaluationGrid({
  footballScores,
  footballPos,
  activeTier,
  scores,
  handleScoreChange,
  radarData,
  handleOpenMutationModal,
  manualTierOverride,
  setManualTierOverride
}) {
  if (!footballScores) return null;

  const tierConfig = FOOTBALL_LTAD_TIERS[activeTier] || FOOTBALL_LTAD_TIERS[3];

  // Title for Tactical Card
  const tacticalCardTitle = activeTier === 1
    ? FOOTBALL_LTAD_CORE_PILLARS.taktik.titleTier1
    : FOOTBALL_LTAD_CORE_PILLARS.taktik.titleDefault;

  // Title for Physical Card
  const physicalCardTitle = activeTier === 1
    ? FOOTBALL_LTAD_CORE_PILLARS.fisik.titleTier1
    : FOOTBALL_LTAD_CORE_PILLARS.fisik.titleDefault;

  // Title for Technical Card
  const technicalCardTitle = activeTier === 1
    ? FOOTBALL_LTAD_CORE_PILLARS.teknik.titleTier1
    : FOOTBALL_LTAD_CORE_PILLARS.teknik.titleDefault;

  // Title for Mental Card
  const mentalCardTitle = activeTier === 1
    ? FOOTBALL_LTAD_CORE_PILLARS.mental.titleTier1
    : FOOTBALL_LTAD_CORE_PILLARS.mental.titleDefault;

  // Title for Teamwork Card
  const teamworkCardTitle = activeTier === 1
    ? FOOTBALL_LTAD_CORE_PILLARS.teamwork.titleTier1
    : FOOTBALL_LTAD_CORE_PILLARS.teamwork.titleDefault;

  // Title for Health Card
  const healthCardTitle = activeTier === 1
    ? FOOTBALL_LTAD_CORE_PILLARS.health.titleTier1
    : FOOTBALL_LTAD_CORE_PILLARS.health.titleDefault;

  // Card 7 Position Specific Title
  let positionCardTitle = `7. Parameter Spesifik Posisi: ${footballScores.activePosLabel}`;
  if (activeTier === 1) {
    positionCardTitle = `7. ${footballScores.posCardTitle || 'Keterampilan Gerak Dasar & Eksplorasi Bermain'}`;
  } else if (activeTier === 2) {
    positionCardTitle = `7. ${footballScores.posCardTitle || 'Parameter Dasar Lini'}`;
  }

  // Filtered metrics for each pillar based on activeTier
  const physicalMetrics = getFilteredMetricsForTier('fisik', activeTier);
  const technicalMetrics = getFilteredMetricsForTier('teknik', activeTier);
  const tacticalMetrics = getFilteredMetricsForTier('taktik', activeTier);
  const mentalMetrics = getFilteredMetricsForTier('mental', activeTier);
  const teamworkMetrics = getFilteredMetricsForTier('teamwork', activeTier);
  const healthMetrics = getFilteredMetricsForTier('health', activeTier);

  return (
    <div className="space-y-6">
      {/* OVERRIDE DROPDOWN CONTROL & TIER FOCUS BADGE */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{tierConfig.shortBadge}</span>
            </span>
            <span className="text-xs text-slate-400 font-semibold">&bull; Kurikulum LTAD Berjenjang Usia</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
            <strong>Fokus Pembinaan:</strong> {tierConfig.focusDescription}
          </p>
        </div>

        {/* Override Dropdown */}
        <div className="shrink-0 flex items-center gap-2 bg-slate-800/90 p-2 rounded-xl border border-slate-700">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap pl-1">
            Override Jenjang:
          </label>
          <select
            value={manualTierOverride}
            onChange={(e) => setManualTierOverride(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="AUTO">⚡ Otomatis Usia Siswa</option>
            <option value="1">Tier 1 — Usia Dini / SSB (&le; 12 Thn)</option>
            <option value="2">Tier 2 — Learning to Train (U-13)</option>
            <option value="3">Tier 3 — Training to Compete (U-15)</option>
            <option value="4">Tier 4 — Elite / Pro (U-16+)</option>
          </select>
        </div>
      </div>

      {/* 1. Profil Atlet / 7-Axis Scouting Radar */}
      <div className="bg-[#2B3D38] border border-[#354944] rounded-3xl p-5 sm:p-6 text-white shadow-md space-y-3 w-full">
        <div className="flex items-center justify-between border-b border-[#354944] pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#D4A73A] flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#D4A73A]" />
            <span>Profil Atlet / 7-Axis Scouting Radar ({tierConfig.shortBadge})</span>
          </span>
          <span className="text-[10px] text-slate-400 font-semibold">Kurikulum LTAD Modern</span>
        </div>

        {/* Recharts Container */}
        <div className="h-64 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData} margin={{ top: 10, right: 25, bottom: 10, left: 25 }}>
              <PolarGrid stroke="#4A635D" />
              <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 700 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4A635D" tick={{ fill: '#64748b', fontSize: 8 }} />
              <Radar name="Skor Atlet" dataKey="A" stroke="#D4A73A" fill="#D4A73A" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. PANEL RINGKASAN SKOR KATEGORI (FULL-WIDTH STANDALONE CARD) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs w-full">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            <span>Ringkasan Skor Kategori</span>
          </span>
          <span className="text-xs font-bold text-slate-600">
            Rata-Rata Performa: <strong className="text-slate-900 font-bold">{(footballScores.overall || 0)} / 100</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          {[
            { label: 'Kondisi Fisik', score: footballScores.fisik, dot: 'bg-rose-500' },
            { label: 'Kemampuan Teknik', score: footballScores.teknik, dot: 'bg-blue-500' },
            { label: 'Pemahaman Taktik', score: footballScores.taktik, dot: 'bg-purple-500' },
            { label: 'Mentalitas', score: footballScores.mental, dot: 'bg-emerald-500' },
            { label: 'Kerja Sama Tim', score: footballScores.teamwork, dot: 'bg-amber-500' },
            { label: 'Kesehatan & Dev.', score: footballScores.health, dot: 'bg-teal-500' },
            { label: `Khusus (${footballScores.shortPosPill || 'Posisi'})`, score: footballScores.position, dot: 'bg-indigo-500' },
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                <span className="text-xs font-semibold text-slate-700 truncate" title={item.label}>
                  {item.label}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-900 shrink-0">
                {item.score || 0} <span className="text-[10px] font-normal text-slate-400">/ 100</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2-COLUMN GRID UNTUK DETAIL SLIDER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* KOLOM KIRI (Physical, Technical) */}
        <div className="space-y-6">

          {/* 2. Pilar 1: Physical — Kondisi Fisik */}
          <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <Dumbbell className="w-4 h-4 text-rose-600" />
                <span>{physicalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                Rata-rata: {footballScores.fisik}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {physicalMetrics.map((kpi) => {
                const val = scores[kpi] !== undefined ? scores[kpi] : 75;
                return (
                  <div key={kpi} className="p-3 bg-white border border-rose-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={kpi}>{kpi}</span>
                      <span className="font-black text-rose-600 text-sm">{val}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => handleScoreChange(kpi, e.target.value)}
                      className="w-full accent-rose-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Pilar 2: Technical — Kemampuan Teknik */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>{technicalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                Rata-rata: {footballScores.teknik}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {technicalMetrics.map((kpi) => {
                const val = scores[kpi] !== undefined ? scores[kpi] : 75;
                return (
                  <div key={kpi} className="p-3 bg-white border border-blue-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={kpi}>{kpi}</span>
                      <span className="font-black text-blue-600 text-sm">{val}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => handleScoreChange(kpi, e.target.value)}
                      className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Pilar 6: Health & Development */}
          <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-teal-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-teal-600" />
                <span>{healthCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                Rata-rata: {footballScores.health}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {healthMetrics.map((kpi) => {
                const val = scores[kpi] !== undefined ? scores[kpi] : 75;
                return (
                  <div key={kpi} className="p-3 bg-white border border-teal-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={kpi}>{kpi}</span>
                      <span className="font-black text-teal-600 text-sm">{val}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => handleScoreChange(kpi, e.target.value)}
                      className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* =================================================================== */}
        {/* KOLOM KANAN (Tactical, Mental, Teamwork, Position Specific) */}
        {/* =================================================================== */}
        <div className="space-y-6">
          
          {/* 1. Pilar 3: Tactical & Cognitive */}
          <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-purple-600" />
                <span>{tacticalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                Rata-rata: {footballScores.taktik}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tacticalMetrics.map((kpi) => {
                const val = scores[kpi] !== undefined ? scores[kpi] : 75;
                return (
                  <div key={kpi} className="p-3 bg-white border border-purple-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={kpi}>{kpi}</span>
                      <span className="font-black text-purple-600 text-sm">{val}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => handleScoreChange(kpi, e.target.value)}
                      className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Pilar 4: Mental — Mentalitas */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>{mentalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                Rata-rata: {footballScores.mental}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mentalMetrics.map((kpi) => {
                const val = scores[kpi] !== undefined ? scores[kpi] : 75;
                return (
                  <div key={kpi} className="p-3 bg-white border border-emerald-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={kpi}>{kpi}</span>
                      <span className="font-black text-emerald-600 text-sm">{val}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => handleScoreChange(kpi, e.target.value)}
                      className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Pilar 5: Teamwork & Communication */}
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                <span>{teamworkCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                Rata-rata: {footballScores.teamwork}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teamworkMetrics.map((kpi) => {
                const val = scores[kpi] !== undefined ? scores[kpi] : 75;
                return (
                  <div key={kpi} className="p-3 bg-white border border-amber-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={kpi}>{kpi}</span>
                      <span className="font-black text-amber-600 text-sm">{val}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => handleScoreChange(kpi, e.target.value)}
                      className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Pilar 7: Parameter Spesifik Posisi (Beradaptasi dengan Tier) */}
          <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-indigo-600" />
                <span>{positionCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                Rata-rata: {footballScores.position}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {footballScores.posKPIs.map((kpi) => {
                const val = scores[kpi] !== undefined ? scores[kpi] : 75;
                return (
                  <div key={kpi} className="p-3 bg-white border border-indigo-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-900 font-extrabold flex items-center gap-1 truncate" title={kpi}>
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                        <span className="truncate">{kpi}</span>
                      </span>
                      <span className="font-black text-indigo-600 text-sm">{val}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val}
                      onChange={(e) => handleScoreChange(kpi, e.target.value)}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
