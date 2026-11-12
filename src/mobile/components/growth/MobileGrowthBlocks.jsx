import React, { useState, useMemo } from 'react';
import {
  Ruler,
  Weight,
  TrendingUp,
  Scale,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  History,
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  ArrowRight
} from 'lucide-react';
import MobileBottomSheet from '../MobileBottomSheet';

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A. Konteks dan Pemilihan Atlet (Mobile)
 */
export function MobileGrowthContextBar({
  selectedClass,
  students = [],
  selectedStudent,
  onSelectStudentId,
  isArchived = false
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

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((st) => {
      const name = String(st.studentName || st.name || '').toLowerCase();
      const pos = String(st.playerRole || st.position || '').toLowerCase();
      return name.includes(q) || pos.includes(q);
    });
  }, [students, searchQuery]);

  return (
    <div className="chua-m-growth-card space-y-3">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-[#17233D] truncate">
            {selectedClass?.className || selectedClass?.name || 'Kelas Aktif'}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F7FC] text-[#2455E8] border border-[#E7EBF2] shrink-0">
            Growth
          </span>
        </div>
        {students.length > 0 && (
          <span className="font-mono text-[11px] font-bold text-[#68758B] shrink-0">
            Atlet {currentIndex >= 0 ? currentIndex + 1 : 1}/{students.length}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="chua-m-eval-nav-icon-btn"
          aria-label="Atlet sebelumnya"
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
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[#101D38] text-white font-bold text-[12px] flex items-center justify-center shrink-0">
              {getInitials(selectedStudent?.studentName || selectedStudent?.name)}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[13px] text-[#17233D] truncate leading-tight">
                {selectedStudent?.studentName || selectedStudent?.name || 'Pilih Atlet'}
              </div>
              <div className="text-[11px] text-[#68758B] font-medium truncate mt-0.5">
                {selectedStudent?.playerRole || selectedStudent?.position || 'Atlet Akademi'}
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
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <MobileBottomSheet
        isOpen={isAthleteSheetOpen}
        onClose={() => setIsAthleteSheetOpen(false)}
        title={`Pilih Atlet (${students.length})`}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#68758B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atlet..."
              className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-[#F5F7FC] border border-[#E7EBF2] rounded-[12px] text-[13px] font-medium text-[#17233D] focus:bg-white focus:border-[#2455E8] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-0.5">
            {filteredStudents.length === 0 ? (
              <div className="py-6 text-center text-[12px] text-[#68758B] font-medium">
                Atlet tidak ditemukan.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const isSelected = st.id === selectedStudent?.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onSelectStudentId(st.id);
                      setIsAthleteSheetOpen(false);
                    }}
                    className={`w-full min-h-[52px] p-2.5 rounded-[12px] border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected ? 'bg-[#2455E8]/8 border-[#2455E8]' : 'bg-white border-[#E7EBF2]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-[10px] font-bold text-[12px] flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#2455E8] text-white' : 'bg-[#F5F7FC] text-[#17233D] border border-[#E7EBF2]'
                      }`}>
                        {getInitials(st.studentName || st.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[13px] text-[#17233D] truncate">
                          {st.studentName || st.name}
                        </div>
                        <div className="text-[11px] text-[#68758B] font-medium truncate">
                          {st.playerRole || st.position || 'Atlet Akademi'}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#2455E8]" />}
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
 * B. Ringkasan Pertumbuhan (Mobile Hero)
 */
export function MobileGrowthHeroCard({
  height = 0,
  weight = 0,
  bmi = 0,
  bmiStatus = {},
  lastMeasuredDate = null
}) {
  return (
    <div className="chua-m-growth-hero space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#93B4FF]">
            Data Antropometri Terakhir
          </span>
          <p className="text-[11px] text-slate-200 font-medium truncate">
            {lastMeasuredDate ? `Pengukuran: ${lastMeasuredDate}` : 'Belum ada data pengukuran'}
          </p>
        </div>
        <div className={`chua-m-growth-bmi-badge shrink-0 ${bmiStatus.color}`}>
          {bmiStatus.status || 'N/A'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="chua-m-growth-summary-item">
          <Ruler className="w-4 h-4 text-[#93B4FF] mb-1" />
          <span className="text-[9px] font-bold uppercase text-[#93B4FF]/80 tracking-tight">Tinggi</span>
          <div className="flex items-baseline gap-0.5 mt-1">
            <span className="font-mono text-[18px] font-black leading-none">{height || '--'}</span>
            <span className="text-[9px] font-bold text-slate-300 uppercase">cm</span>
          </div>
        </div>
        <div className="chua-m-growth-summary-item">
          <Weight className="w-4 h-4 text-[#93B4FF] mb-1" />
          <span className="text-[9px] font-bold uppercase text-[#93B4FF]/80 tracking-tight">Berat</span>
          <div className="flex items-baseline gap-0.5 mt-1">
            <span className="font-mono text-[18px] font-black leading-none">{weight || '--'}</span>
            <span className="text-[9px] font-bold text-slate-300 uppercase">kg</span>
          </div>
        </div>
        <div className="chua-m-growth-summary-item">
          <Scale className="w-4 h-4 text-[#93B4FF] mb-1" />
          <span className="text-[9px] font-bold uppercase text-[#93B4FF]/80 tracking-tight">BMI</span>
          <div className="flex items-baseline gap-0.5 mt-1">
            <span className="font-mono text-[18px] font-black leading-none">{bmi || '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * C. Form Input Pengukuran (Mobile)
 */
export function MobileGrowthInputForm({
  newHeight,
  setNewHeight,
  newWeight,
  setNewWeight,
  recordDate,
  setRecordDate,
  liveBMI,
  liveStatus,
  onSave,
  isSaving,
  isArchived,
  successMsg,
  errorMsg
}) {
  return (
    <div className="chua-m-growth-card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[10px] bg-[#2455E8]/10 text-[#2455E8] flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-[13px] text-[#17233D] leading-tight truncate">
            Input Pengukuran Baru
          </h3>
          <p className="text-[11px] text-[#68758B] font-medium truncate mt-0.5">
            Pastikan atlet dalam posisi tegak dan rileks
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="chua-m-growth-input-box">
          <label htmlFor="m-growth-date" className="text-[10px] font-bold text-[#68758B] uppercase tracking-wider">
            Tanggal Pengukuran
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2455E8]" />
            <input
              id="m-growth-date"
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              disabled={isArchived}
              className="chua-m-growth-input-field"
            />
          </div>
        </div>

        <div className="chua-m-growth-input-group">
          <div className="chua-m-growth-input-box">
            <label htmlFor="m-growth-height" className="text-[10px] font-bold text-[#68758B] uppercase tracking-wider">
              Tinggi (cm)
            </label>
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-[#2455E8]" />
              <input
                id="m-growth-height"
                type="number"
                inputMode="decimal"
                value={newHeight}
                onChange={(e) => setNewHeight(e.target.value)}
                placeholder="170"
                disabled={isArchived}
                className="chua-m-growth-input-field"
              />
            </div>
          </div>
          <div className="chua-m-growth-input-box">
            <label htmlFor="m-growth-weight" className="text-[10px] font-bold text-[#68758B] uppercase tracking-wider">
              Berat (kg)
            </label>
            <div className="flex items-center gap-2">
              <Weight className="w-4 h-4 text-rose-500" />
              <input
                id="m-growth-weight"
                type="number"
                inputMode="decimal"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="60"
                disabled={isArchived}
                className="chua-m-growth-input-field"
              />
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#F5F7FC] border border-[#E7EBF2] rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#2455E8]" />
            <div className="leading-tight">
              <p className="text-[10px] font-bold text-[#68758B] uppercase">Kalkulasi BMI</p>
              <p className="text-[14px] font-black text-[#17233D]">{liveBMI || '--'}</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${liveStatus.color}`}>
            {liveStatus.status || 'N/A'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-[12px] rounded-xl font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] rounded-xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A779] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || isArchived}
        className="chua-m-eval-primary-btn"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Menyimpan Data...</span>
          </>
        ) : (
          <>
            <Save className="w-4 h-4 text-white" />
            <span>Simpan Data Antropometri</span>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * D. Grafik Pertumbuhan (Mobile)
 */
export function MobileGrowthChartContainer({ children, historyCount = 0 }) {
  return (
    <div className="chua-m-growth-card space-y-3">
      <div className="flex items-center justify-between border-b border-[#E7EBF2] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] bg-[#16A779]/10 text-[#16A779] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-[13px] text-[#17233D]">Growth Curve</h3>
        </div>
        <span className="text-[11px] font-bold text-[#68758B] bg-[#F5F7FC] px-2 py-0.5 rounded-full border border-[#E7EBF2]">
          {historyCount} Pengukuran
        </span>
      </div>
      <div className="chua-m-growth-chart-container">
        {children}
      </div>
    </div>
  );
}

/**
 * E. Analisis AI (Mobile)
 */
export function MobileGrowthAiInsight({
  aiInsight,
  onGenerate,
  isGenerating,
  isArchived
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="chua-m-growth-insight-box space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C89D32]" />
          <span className="text-[12px] font-bold uppercase tracking-wider text-[#C89D32]">
            AI Nutrition & Training
          </span>
        </div>
        {aiInsight && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded-lg bg-white/10 text-white/80"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {aiInsight && isOpen && (
        <div className="p-3 bg-black/30 border border-white/10 rounded-xl text-[12px] text-sky-100 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
          {aiInsight}
        </div>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating || isArchived}
        className="w-full min-h-[44px] bg-[#354944] border-b-2 border-[#C89D32] text-white font-bold text-[12px] rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Menganalisis...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-[#C89D32]" />
            <span>{aiInsight ? 'Perbarui Analisis AI' : 'Generate Analisis AI'}</span>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * F. Riwayat Pengukuran (Mobile)
 */
export function MobileGrowthHistorySection({ history = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="chua-m-growth-card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left bg-white"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F5F7FC] border border-[#E7EBF2] text-[#2455E8] flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[13px] text-[#17233D] leading-tight">Riwayat Pengukuran</h3>
            <p className="text-[11px] text-[#68758B] font-medium mt-0.5">Lihat progres historis atlet</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-[#F5F7FC] text-[#2455E8] border border-[#E7EBF2] text-[10px] font-bold">
            {history.length}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-[#68758B]" /> : <ChevronDown className="w-4 h-4 text-[#68758B]" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3 border-t border-[#E7EBF2] bg-[#F5F7FC]/40 space-y-2">
          {history.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#68758B] font-medium bg-white border border-dashed border-[#E7EBF2] rounded-xl">
              Belum ada riwayat pengukuran.
            </div>
          ) : (
            [...history].reverse().map((item, idx) => {
              // Calculate delta if possible
              const prevItem = history[history.length - 1 - idx - 1];
              const hDelta = prevItem ? (item.height - prevItem.height).toFixed(1) : null;
              const wDelta = prevItem ? (item.weight - prevItem.weight).toFixed(1) : null;

              return (
                <div key={idx} className="chua-m-growth-history-item !items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-[#2455E8]" />
                      <span className="text-[12px] font-bold text-[#17233D]">{item.date || item.recordedAt?.split('T')[0]}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[9px] font-bold text-[#68758B] uppercase tracking-tight">Tinggi</p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-[13px] font-black text-[#17233D]">{item.height}</p>
                          <span className="text-[9px] font-medium text-[#68758B]">cm</span>
                        </div>
                        {hDelta && Number(hDelta) !== 0 && (
                          <div className={`flex items-center text-[9px] font-bold ${Number(hDelta) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {Number(hDelta) > 0 ? <TrendingUp className="w-2 h-2 mr-0.5" /> : <ChevronDown className="w-2 h-2 mr-0.5" />}
                            <span>{Number(hDelta) > 0 ? '+' : ''}{hDelta}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-[#68758B] uppercase tracking-tight">Berat</p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-[13px] font-black text-[#17233D]">{item.weight}</p>
                          <span className="text-[9px] font-medium text-[#68758B]">kg</span>
                        </div>
                        {wDelta && Number(wDelta) !== 0 && (
                          <div className={`flex items-center text-[9px] font-bold ${Number(wDelta) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {Number(wDelta) > 0 ? <TrendingUp className="w-2 h-2 mr-0.5" /> : <ChevronDown className="w-2 h-2 mr-0.5" />}
                            <span>{Number(wDelta) > 0 ? '+' : ''}{wDelta}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-[#68758B] uppercase tracking-tight">BMI</p>
                        <p className="text-[13px] font-black text-[#17233D]">{item.bmi || '--'}</p>
                        <span className="text-[9px] font-bold text-[#2455E8] uppercase leading-none block mt-0.5">
                          {item.status || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
