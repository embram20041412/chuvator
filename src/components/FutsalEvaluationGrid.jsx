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
  Flame,
  Layers,
  Sparkles
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
  FUTSAL_TIER_CONFIGS,
  FUTSAL_CORE_CATEGORIES,
  FUTSAL_POSITIONS,
  getFilteredFutsalIndicatorsForCategory,
  getFutsalPositionConfig,
  resolveIndicatorScore
} from '../config/futsalAssessmentData';

// Helper for dual-key resolution (ID -> Name -> Legacy Keys -> null)
function resolveScore(scores, indicator) {
  return resolveIndicatorScore(scores, indicator);
}

export default function FutsalEvaluationGrid({
  futsalScores,
  futsalPos,
  activeTier,
  scores,
  handleScoreChange,
  radarData,
  handleOpenMutationModal,
  manualFutsalTierOverride,
  setManualFutsalTierOverride
}) {
  if (!futsalScores) return null;

  const tierConfig = FUTSAL_TIER_CONFIGS[activeTier] || FUTSAL_TIER_CONFIGS[1];
  
  // Use config from new registry
  const posCode = futsalPos.primaryPosition || 'FIXO';
  const posConfig = getFutsalPositionConfig(posCode);

  // Titles
  const tacticalCardTitle = (activeTier === 1)
    ? FUTSAL_CORE_CATEGORIES.taktik.titleTier1
    : FUTSAL_CORE_CATEGORIES.taktik.titleDefault;

  const physicalCardTitle = activeTier === 1
    ? FUTSAL_CORE_CATEGORIES.fisik.titleTier1
    : FUTSAL_CORE_CATEGORIES.fisik.titleDefault;

  const technicalCardTitle = activeTier === 1
    ? FUTSAL_CORE_CATEGORIES.teknik.titleTier1
    : FUTSAL_CORE_CATEGORIES.teknik.titleDefault;

  const mentalCardTitle = activeTier === 1
    ? FUTSAL_CORE_CATEGORIES.mental.titleTier1
    : FUTSAL_CORE_CATEGORIES.mental.titleDefault;

  const teamworkCardTitle = activeTier === 1
    ? FUTSAL_CORE_CATEGORIES.komunikasi.titleTier1
    : FUTSAL_CORE_CATEGORIES.komunikasi.titleDefault;

  const healthCardTitle = activeTier === 1
    ? FUTSAL_CORE_CATEGORIES.perkembangan.titleTier1
    : FUTSAL_CORE_CATEGORIES.perkembangan.titleDefault;

  // Card 7 Title
  let positionCardTitle = `7. Parameter Spesifik Posisi: ${posConfig.shortLabel}`;
  if (activeTier === 1) {
    positionCardTitle = `7. Stimulasi Gerak Dasar & Refleks Ruang Sempit`;
  } else if (activeTier === 2) {
    positionCardTitle = `7. Fundamental Teknik & Duel 1v1 Futsal`;
  }

  // Filtered indicators for 6 pillars based on activeTier
  const physicalIndicators = getFilteredFutsalIndicatorsForCategory('fisik', activeTier);
  const technicalIndicators = getFilteredFutsalIndicatorsForCategory('teknik', activeTier);
  const tacticalIndicators = getFilteredFutsalIndicatorsForCategory('taktik', activeTier);
  const mentalIndicators = getFilteredFutsalIndicatorsForCategory('mental', activeTier);
  const communicationIndicators = getFilteredFutsalIndicatorsForCategory('komunikasi', activeTier);
  const developmentIndicators = getFilteredFutsalIndicatorsForCategory('perkembangan', activeTier);

  return (
    <div className="space-y-6">
      {/* OVERRIDE DROPDOWN CONTROL & TIER FOCUS BADGE (FUTSAL) */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-extrabold`}>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{tierConfig.shortLabel}</span>
            </span>
            <span className="text-xs text-slate-400 font-semibold">&bull; Kurikulum Berjenjang Futsal</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
            <strong>Fokus Pembinaan:</strong> {tierConfig.desc}
          </p>
        </div>

        {/* Override Dropdown */}
        <div className="shrink-0 flex items-center gap-2 bg-slate-800/90 p-2 rounded-xl border border-slate-700">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap pl-1" htmlFor="manual-tier-select">
            Override Jenjang:
          </label>
          <select
            id="manual-tier-select"
            value={manualFutsalTierOverride}
            onChange={(e) => setManualFutsalTierOverride(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="AUTO">⚡ Otomatis Usia Siswa</option>
            <option value="1">Tier 1 — Usia Dini (6–12 Thn)</option>
            <option value="2">Tier 2 — Youth (13–15 Thn)</option>
            <option value="3">Tier 3 — Junior (16–19 Thn)</option>
            <option value="4">Tier 4 — Profesional (&ge; 20 Thn)</option>
          </select>
        </div>
      </div>

      {/* 1. Profil Atlet / Radar */}
      <div className="bg-[#2B3D38] border border-[#354944] rounded-3xl p-5 sm:p-6 text-white shadow-md space-y-3 w-full">
        <div className="flex items-center justify-between border-b border-[#354944] pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#D4A73A] flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#D4A73A]" />
            <span>Profil Atlet / Futsal Scouting Radar</span>
          </span>
          <div className="flex items-center gap-1.5">
            {futsalPos.isFlyingGK && (activeTier >= 3) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <Flame className="w-2.5 h-2.5 text-rose-400" />
                <span>Flying GK</span>
              </span>
            )}
            {futsalPos.primaryPosition === 'UNIVERSAL' && (activeTier >= 3) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Layers className="w-2.5 h-2.5 text-amber-400" />
                <span>Hybrid</span>
              </span>
            )}
          </div>
        </div>

        <div className="h-64 min-h-[250px] w-full flex items-center justify-center min-w-0">
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData} margin={{ top: 10, right: 25, bottom: 10, left: 25 }}>
              <PolarGrid stroke="#4A635D" />
              <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 700 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4A635D" tick={{ fill: '#64748b', fontSize: 8 }} />
              <Radar name="Skor Futsal" dataKey="A" stroke="#D4A73A" fill="#D4A73A" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Ringkasan Skor */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs w-full">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-amber-600" />
            <span>Ringkasan Skor Kategori</span>
          </span>
          <span className="text-xs font-bold text-slate-600">
            Rata-Rata Performa: <strong className="text-slate-900 font-bold">{(futsalScores.overall || 0)} / 100</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          {[
            { label: 'Kondisi Fisik', score: futsalScores.fisik, dot: 'bg-rose-500' },
            { label: 'Kemampuan Teknik', score: futsalScores.teknik, dot: 'bg-blue-500' },
            { label: 'Pemahaman Taktik', score: futsalScores.taktik, dot: 'bg-purple-500' },
            { label: 'Mentalitas', score: futsalScores.mental, dot: 'bg-emerald-500' },
            { label: 'Kerja Sama Tim', score: futsalScores.teamwork, dot: 'bg-amber-500' },
            { label: 'Kesehatan & Dev.', score: futsalScores.health, dot: 'bg-teal-500' },
            { label: `Khusus (${posConfig.shortLabel})`, score: futsalScores.position, dot: 'bg-indigo-500' }
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {/* Physical */}
          <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <Dumbbell className="w-4 h-4 text-rose-600" />
                <span>{physicalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                Rata-rata: {futsalScores.fisik}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {physicalIndicators.map((ind) => {
                const val = resolveScore(scores, ind);
                return (
                  <div key={ind.id} className="p-3 bg-white border border-rose-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={ind.name}>{ind.name}</span>
                      <span className="font-black text-rose-600 text-sm" title={val === null ? 'UNTESTED' : String(val)}>{val !== null ? val : '—'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val ?? 0}
                      onChange={(e) => handleScoreChange(ind.id, e.target.value)}
                      className="w-full accent-rose-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technical */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>{technicalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                Rata-rata: {futsalScores.teknik}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {technicalIndicators.map((ind) => {
                const val = resolveScore(scores, ind);
                return (
                  <div key={ind.id} className="p-3 bg-white border border-blue-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={ind.name}>{ind.name}</span>
                      <span className="font-black text-blue-600 text-sm" title={val === null ? 'UNTESTED' : String(val)}>{val !== null ? val : '—'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val ?? 0}
                      onChange={(e) => handleScoreChange(ind.id, e.target.value)}
                      className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Health & Dev */}
          <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-teal-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-teal-600" />
                <span>{healthCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                Rata-rata: {futsalScores.health}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {developmentIndicators.map((ind) => {
                const val = resolveScore(scores, ind);
                return (
                  <div key={ind.id} className="p-3 bg-white border border-teal-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={ind.name}>{ind.name}</span>
                      <span className="font-black text-teal-600 text-sm" title={val === null ? 'UNTESTED' : String(val)}>{val !== null ? val : '—'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val ?? 0}
                      onChange={(e) => handleScoreChange(ind.id, e.target.value)}
                      className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Tactical */}
          <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-purple-600" />
                <span>{tacticalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                Rata-rata: {futsalScores.taktik}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tacticalIndicators.map((ind) => {
                const val = resolveScore(scores, ind);
                return (
                  <div key={ind.id} className="p-3 bg-white border border-purple-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={ind.name}>{ind.name}</span>
                      <span className="font-black text-purple-600 text-sm" title={val === null ? 'UNTESTED' : String(val)}>{val !== null ? val : '—'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val ?? 0}
                      onChange={(e) => handleScoreChange(ind.id, e.target.value)}
                      className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mental */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>{mentalCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                Rata-rata: {futsalScores.mental}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mentalIndicators.map((ind) => {
                const val = resolveScore(scores, ind);
                return (
                  <div key={ind.id} className="p-3 bg-white border border-emerald-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={ind.name}>{ind.name}</span>
                      <span className="font-black text-emerald-600 text-sm" title={val === null ? 'UNTESTED' : String(val)}>{val !== null ? val : '—'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val ?? 0}
                      onChange={(e) => handleScoreChange(ind.id, e.target.value)}
                      className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teamwork */}
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                <span>{teamworkCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                Rata-rata: {futsalScores.teamwork}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {communicationIndicators.map((ind) => {
                const val = resolveScore(scores, ind);
                return (
                  <div key={ind.id} className="p-3 bg-white border border-amber-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 truncate" title={ind.name}>{ind.name}</span>
                      <span className="font-black text-amber-600 text-sm" title={val === null ? 'UNTESTED' : String(val)}>{val !== null ? val : '—'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val ?? 0}
                      onChange={(e) => handleScoreChange(ind.id, e.target.value)}
                      className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Position Specific */}
          <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-indigo-600" />
                <span>{positionCardTitle}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                Rata-rata: {futsalScores.position}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(futsalScores.posKPIs || []).map((kpi) => {
                // posKPIs are passed as objects or names from parent
                const val = resolveScore(scores, kpi);
                const indId = typeof kpi === 'object' ? kpi.id : kpi;
                const indName = typeof kpi === 'object' ? kpi.name : kpi;
                return (
                  <div key={indId} className="p-3 bg-white border border-indigo-100 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-900 font-extrabold flex items-center gap-1 truncate" title={indName}>
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                        <span className="truncate">{indName}</span>
                      </span>
                      <span className="font-black text-indigo-600 text-sm" title={val === null ? 'UNTESTED' : String(val)}>{val !== null ? val : '—'}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={val ?? 0}
                      onChange={(e) => handleScoreChange(indId, e.target.value)}
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
