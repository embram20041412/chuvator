import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Check, 
  X, 
  SlidersHorizontal, 
  Sparkles, 
  Save, 
  CheckCircle2 
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
 *   categoryList?: any[],
 *   initialScores?: Record<string, number>,
 *   activeCategoryKey?: string | null,
 *   onSave: (updatedScores: Record<string, number>) => void,
 *   onCancel: () => void,
 *   isArchived?: boolean,
 *   tierLabel?: string
 * }} props
 */
export default function AthleteAssessmentEditView({
  studentName = 'Atlet',
  sportLabel = '',
  categoryList = [],
  initialScores = {},
  activeCategoryKey = null,
  onSave,
  onCancel,
  isArchived = false,
  tierLabel = ''
}) {
  // Local draft state for indicator values
  const [draftScores, setDraftScores] = useState(() => ({ ...initialScores }));
  const [hasChanges, setHasChanges] = useState(false);

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

  // Set preset score for all indicators in a specific category
  const handleDraftCategoryPreset = (catKey, presetScore) => {
    const catObj = categoryList.find((c) => c.key === catKey);
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

  // Calculate live average and grade from draftScores across the 7 categories
  const { draftCategoryList, draftOverallScore, draftGrade, totalIndicators, evaluatedCount } = useMemo(() => {
    let allIndicatorsCount = 0;
    let ratedCount = 0;

    const updatedCategories = categoryList.map((cat) => {
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
  }, [categoryList, draftScores]);

  const handleSaveClick = (e) => {
    if (e) e.preventDefault();
    if (onSave) {
      onSave(draftScores);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. TOP NAVIGATION & SUMMARY BAR */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-colors cursor-pointer shadow-2xs border border-slate-200 shrink-0"
            title="Kembali ke halaman utama asesmen"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-base sm:text-lg text-slate-900 tracking-tight">
                Edit Penilaian Indikator
              </h2>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#101D38] text-[#C89D32] border border-[#C89D32]/40">
                {studentName}
              </span>
              {sportLabel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {sportLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sesuaikan slider atau stepper indikator 7 kategori performa atlet
            </p>
          </div>
        </div>

        {/* Live Draft Score & Actions in Header */}
        <div className="flex items-center gap-2.5 self-end sm:self-center flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Preview Rata-Rata:
            </span>
            <span className="font-mono text-sm sm:text-base font-black text-slate-900 tabular-nums">
              {draftOverallScore} / 100
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${draftGrade.badge}`}>
              {draftGrade.grade}
            </span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
            <span>Batal</span>
          </button>

          <button
            type="button"
            disabled={isArchived}
            onClick={handleSaveClick}
            className="px-4 py-2 text-xs font-extrabold text-white bg-[#101D38] hover:bg-[#1d2d52] rounded-xl border border-[#C89D32]/50 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 text-[#C89D32]" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>

      {/* 2. LEMBAR PENILAIAN INDIKATOR (7 KATEGORI ACCORDION) */}
      <AssessmentIndicatorsAccordion
        categoryList={draftCategoryList}
        scores={draftScores}
        onScoreChange={handleDraftScoreChange}
        onAdjustScore={handleDraftAdjustScore}
        onSetCategoryPreset={handleDraftCategoryPreset}
        activeCategoryKey={activeCategoryKey}
        isArchived={isArchived}
        tierLabel={tierLabel}
      />

      {/* 3. STICKY BOTTOM ACTION BAR */}
      <div className="sticky bottom-3 z-30 bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {evaluatedCount} dari {totalIndicators} indikator dinilai &bull; Estimasi Skor:{' '}
            <strong className="font-mono text-slate-900">{draftOverallScore}/100</strong>
          </span>
          {hasChanges && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
              Ada perubahan belum disimpan
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer text-center"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isArchived}
            onClick={handleSaveClick}
            className="flex-1 sm:flex-none px-5 py-2 text-xs font-black text-white bg-[#101D38] hover:bg-[#1d2d52] rounded-xl border border-[#C89D32]/50 shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 text-[#C89D32]" />
            <span>Simpan Perubahan Nilai</span>
          </button>
        </div>
      </div>
    </div>
  );
}
