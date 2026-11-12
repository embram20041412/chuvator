import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  Users,
  Shield,
  FileSpreadsheet,
  BarChart3,
  Sparkles,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  ChevronRight,
  Activity,
  Zap,
  HelpCircle,
  FileText
} from 'lucide-react';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line
} from 'recharts';

import {
  analyzeAthletePerformance,
  analyzePositionEventPerformance,
  analyzeAthleteDevelopment,
  compareAthletes,
  analyzeAcademyTeamPerformance,
  generateAnalyticsReport,
  analyzeDataQuality
} from '../services/analyticsEngine';

import supabaseAcademyService from '../services/supabaseAcademyService';

export default function AnalyticsSection({
  selectedClass,
  students = [],
  tenantId,
  activeAcademy,
  isMobile = false
}) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [comparisonStudentId, setComparisonStudentId] = useState('');
  const [activeModuleTab, setActiveModuleTab] = useState('performance'); // 'performance' | 'development' | 'comparison' | 'team' | 'reports' | 'quality'

  // Fetch evaluations for current class
  useEffect(() => {
    async function fetchEvals() {
      if (!tenantId || !selectedClass?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await supabaseAcademyService.getEvaluationsByClass(tenantId, selectedClass.id, 200);
        setEvaluations(data || []);
      } catch (err) {
        console.warn('[AnalyticsSection] Failed to load evaluations:', err);
        setEvaluations([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvals();
  }, [tenantId, selectedClass?.id]);

  // Default selected student
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  const currentStudentEvals = useMemo(() => {
    if (!currentStudent) return [];
    return evaluations.filter((e) => e.studentId === currentStudent.id);
  }, [evaluations, currentStudent]);

  const latestEval = useMemo(() => {
    if (currentStudentEvals.length === 0) return null;
    return [...currentStudentEvals].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];
  }, [currentStudentEvals]);

  // Performance Analysis for selected athlete (Module 1 & 2)
  const performanceData = useMemo(() => {
    if (!currentStudent || !latestEval) return null;
    return analyzeAthletePerformance({
      scores: latestEval.scores || {},
      sport: selectedClass?.sport || activeAcademy?.sport || 'football',
      activeTier: latestEval.activeTier || 1,
      playerRole: currentStudent.playerRole || currentStudent.position
    });
  }, [currentStudent, latestEval, selectedClass, activeAcademy]);

  // Position / Event Analysis (Module 3)
  const positionData = useMemo(() => {
    if (!currentStudent || !latestEval) return null;
    return analyzePositionEventPerformance({
      scores: latestEval.scores || {},
      sport: selectedClass?.sport || activeAcademy?.sport || 'football',
      activeTier: latestEval.activeTier || 1,
      roleOrPosition: currentStudent.playerRole || currentStudent.position || 'CB'
    });
  }, [currentStudent, latestEval, selectedClass, activeAcademy]);

  // Development Analysis (Module 4)
  const developmentData = useMemo(() => {
    if (currentStudentEvals.length === 0) return null;
    return analyzeAthleteDevelopment({
      evaluations: currentStudentEvals,
      sport: selectedClass?.sport || activeAcademy?.sport || 'football'
    });
  }, [currentStudentEvals, selectedClass, activeAcademy]);

  // Comparison Analysis (Module 5)
  const comparisonData = useMemo(() => {
    if (!currentStudent || !comparisonStudentId || currentStudent.id === comparisonStudentId) return null;
    const compStudent = students.find((s) => s.id === comparisonStudentId);
    if (!compStudent) return null;

    const compEvals = evaluations.filter((e) => e.studentId === compStudent.id);
    const compLatest = compEvals.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];

    return compareAthletes({
      athleteA: {
        id: currentStudent.id,
        name: currentStudent.studentName || currentStudent.name,
        playerRole: currentStudent.playerRole,
        scores: latestEval?.scores || {}
      },
      athleteB: {
        id: compStudent.id,
        name: compStudent.studentName || compStudent.name,
        playerRole: compStudent.playerRole,
        scores: compLatest?.scores || {}
      },
      sport: selectedClass?.sport || activeAcademy?.sport || 'football'
    });
  }, [currentStudent, comparisonStudentId, students, evaluations, latestEval, selectedClass, activeAcademy]);

  // Team Analytics (Module 6)
  const teamData = useMemo(() => {
    return analyzeAcademyTeamPerformance({
      evaluations,
      students,
      sport: selectedClass?.sport || activeAcademy?.sport || 'football',
      tenantId
    });
  }, [evaluations, students, selectedClass, activeAcademy, tenantId]);

  // Data Quality Audit (Module 8)
  const qualityData = useMemo(() => {
    return analyzeDataQuality({
      evaluations,
      sport: selectedClass?.sport || activeAcademy?.sport || 'football'
    });
  }, [evaluations, selectedClass, activeAcademy]);

  // Chart data for Radar Chart
  const radarChartData = useMemo(() => {
    if (!performanceData) return [];
    return Object.entries(performanceData.categoryAnalysis).map(([catKey, data]) => ({
      category: catKey.toUpperCase(),
      score: data.categoryAverage ?? 0,
      fullMark: 100
    }));
  }, [performanceData]);

  // Chart data for Timeline Chart
  const timelineChartData = useMemo(() => {
    if (!developmentData?.evaluationTimeline) return [];
    return developmentData.evaluationTimeline.map((item) => ({
      date: item.date,
      score: item.overallScore ?? 0,
      coverage: item.evaluationCoverage
    }));
  }, [developmentData]);

  return (
    <div className="space-y-4">
      {/* HEADER TOOLBAR & ATHLETE SELECTOR */}
      <div className="bg-white dark:bg-[#162320] rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#354944]/10 dark:bg-[#354944]/30 rounded-lg text-[#354944] dark:text-[#C89D32]">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Advanced Analytics & BI Engine
              <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold rounded-full border border-emerald-200 dark:border-emerald-800">
                Phase 2.0
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Analisis performa atlet, tren perkembangan, perbandingan, dan kualitas data berbasis Canonical Registry.
            </p>
          </div>
        </div>

        {/* SELECT ATHLETE DROPDOWN */}
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-student-select" className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
            Pilih Atlet:
          </label>
          <select
            id="analytics-student-select"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1.5 font-medium focus:ring-2 focus:ring-[#354944]"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.studentName || s.name} ({s.playerRole || s.position || 'N/A'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MODULE NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'performance', label: 'Modul 1-3: Performa & Posisi', icon: Activity },
          { id: 'development', label: 'Modul 4: Tren Perkembangan', icon: TrendingUp },
          { id: 'comparison', label: 'Modul 5: Komparasi Atlet', icon: Users },
          { id: 'team', label: 'Modul 6: Tim & Akademi', icon: Shield },
          { id: 'reports', label: 'Modul 7: Laporan & Ekspor', icon: FileText },
          { id: 'quality', label: 'Modul 8: Kualitas Data', icon: CheckCircle2 }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeModuleTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveModuleTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#354944] text-white shadow-2xs border-b-2 border-[#C89D32]'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="p-8 text-center bg-white dark:bg-[#162320] rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#354944] border-t-transparent mb-2"></div>
          <p className="text-xs text-slate-500 font-medium">Memuat data evaluasi dan analytics engine...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ATHLETE PERFORMANCE & POSITION ANALYTICS (MODULE 1, 2, 3) */}
          {activeModuleTab === 'performance' && (
            <div className="space-y-4">
              {!currentStudent ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-white dark:bg-[#162320] rounded-xl">
                  Tidak ada atlet terpilih.
                </div>
              ) : !performanceData ? (
                <div className="p-6 text-center bg-white dark:bg-[#162320] rounded-xl border border-slate-200 dark:border-slate-800">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Belum ada data evaluasi resmi untuk {currentStudent.studentName || currentStudent.name}.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Lakukan evaluasi atlet terlebih dahulu pada tab "Evaluasi Atlet" untuk mengaktifkan modul analytics.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* KPI SUMMARY CARDS */}
                  <div className="lg:col-span-1 space-y-3">
                    <div className="bg-white dark:bg-[#162320] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Skor Performa Keseluruhan</span>
                        <Award className="w-5 h-5 text-[#C89D32]" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                          {performanceData.overallScore ?? '—'}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">/ 100</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs">
                        <span className="text-slate-500">Kelengkapan Evaluasi:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {performanceData.evaluationCoverage}% ({performanceData.totalEvaluatedCount}/{performanceData.totalRegistryIndicators} Indikator)
                        </span>
                      </div>
                    </div>

                    {/* STRENGTHS CARD */}
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-3.5 border border-emerald-200/80 dark:border-emerald-800/60">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                        <Zap className="w-4 h-4 text-emerald-600" />
                        Indikator Keunggulan Utama (Evaluated)
                      </div>
                      <div className="space-y-1.5">
                        {performanceData.strengths.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Belum ada indikator ter-evaluasi.</p>
                        ) : (
                          performanceData.strengths.map((s) => (
                            <div key={s.id} className="flex justify-between items-center text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{s.score}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* WEAKNESSES CARD */}
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-3.5 border border-amber-200/80 dark:border-amber-800/60">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Area Pengembangan Atlet (Evaluated Only)
                      </div>
                      <div className="space-y-1.5">
                        {performanceData.weaknesses.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Diperlukan minimal 3 indikator ter-evaluasi.</p>
                        ) : (
                          performanceData.weaknesses.map((w) => (
                            <div key={w.id} className="flex justify-between items-center text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-100 dark:border-amber-900/50">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{w.name}</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">{w.score}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RADAR CHART & CATEGORY BREAKDOWN */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-[#162320] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                        Profil Performa Multi-Pilar (Radar View)
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarChartData}>
                            <PolarGrid stroke="#94a3b8" strokeDasharray="3 3" opacity={0.4} />
                            <PolarAngleAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <Radar name="Skor Atlet" dataKey="score" stroke="#354944" fill="#354944" fillOpacity={0.4} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* CATEGORY METRICS BREAKDOWN */}
                    <div className="bg-white dark:bg-[#162320] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Rincian Skor Per Kategori & Status Kelengkapan
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {Object.entries(performanceData.categoryAnalysis).map(([catKey, cData]) => (
                          <div key={catKey} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/60 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">
                                {catKey.replace('_', ' ')}
                              </span>
                              <span className="text-xs font-black text-[#354944] dark:text-[#C89D32]">
                                {cData.categoryAverage !== null ? cData.categoryAverage : '—'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[#354944] dark:bg-[#C89D32] h-full transition-all"
                                style={{ width: `${cData.categoryAverage ?? 0}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5">
                              <span>Dinilai: {cData.evaluatedCount} / {cData.totalCount}</span>
                              <span>Belum: {cData.untestedCount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DEVELOPMENT TREND (MODULE 4) */}
          {activeModuleTab === 'development' && (
            <div className="space-y-4">
              {!developmentData || !developmentData.hasHistory ? (
                <div className="p-6 text-center bg-white dark:bg-[#162320] rounded-xl border border-slate-200 dark:border-slate-800">
                  <TrendingUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Diperlukan minimal 2 sesi evaluasi untuk menampilkan tren perkembangan longitudinal.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Saat ini atlet hanya memiliki {currentStudentEvals.length} sesi evaluasi recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-[#162320] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Grafik Perkembangan Skor Longitudinal
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Perubahan skor dari evaluasi pertama ke evaluasi terbaru (Delta: {developmentData.overallDelta > 0 ? `+${developmentData.overallDelta}` : developmentData.overallDelta})
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        developmentData.trendDirection === 'IMPROVING'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : developmentData.trendDirection === 'DECLINING'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                      }`}>
                        Tren: {developmentData.trendDirection}
                      </span>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timelineChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.3} />
                          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="score" stroke="#354944" strokeWidth={3} dot={{ r: 5, fill: '#C89D32' }} name="Skor Performa" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* TIMELINE LIST */}
                  <div className="bg-white dark:bg-[#162320] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Riwayat Evaluasi Sesi</h3>
                    {developmentData.evaluationTimeline.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">Sesi {item.index + 1} ({item.date})</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.coachNote || 'Tidak ada catatan pelatih.'}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-[#354944] dark:text-[#C89D32] text-sm">{item.overallScore ?? '—'}</span>
                          <p className="text-[10px] text-slate-400">{item.evaluationCoverage}% Ter-evaluasi</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATHLETE COMPARISON (MODULE 5) */}
          {activeModuleTab === 'comparison' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#162320] rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Bandingkan dengan:</span>
                <select
                  value={comparisonStudentId}
                  onChange={(e) => setComparisonStudentId(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1.5 font-medium"
                >
                  <option value="">-- Pilih Atlet Pembanding --</option>
                  {students.filter((s) => s.id !== currentStudent?.id).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentName || s.name} ({s.playerRole || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              {!comparisonData ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-white dark:bg-[#162320] rounded-xl border border-slate-200 dark:border-slate-800">
                  Pilih atlet pembanding pada dropdown di atas untuk memulai analisis komparatif sepadan.
                </div>
              ) : (
                <div className="bg-white dark:bg-[#162320] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {comparisonData.athleteA.name} VS {comparisonData.athleteB.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">Komparasi skor kategori pada indikator sepadan.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500">Selisih Skor Utama: </span>
                      <span className="font-bold text-[#354944] dark:text-[#C89D32]">
                        {comparisonData.overallDiff > 0 ? `+${comparisonData.overallDiff}` : comparisonData.overallDiff}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(comparisonData.categoryComparison).map(([catKey, cComp]) => (
                      <div key={catKey} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">{catKey.replace('_', ' ')}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{cComp.avgA ?? '—'}</span>
                          <span className="text-slate-400">vs</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{cComp.avgB ?? '—'}</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                            cComp.diff > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : cComp.diff < 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {cComp.diff !== null ? (cComp.diff > 0 ? `+${cComp.diff}` : cComp.diff) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TEAM ANALYTICS (MODULE 6) */}
          {activeModuleTab === 'team' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Total Atlet Terdaftar</span>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{teamData.totalStudents}</p>
                </div>
                <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Atlet Ter-evaluasi</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{teamData.evaluatedStudentsCount}</p>
                </div>
                <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Coverage Tim</span>
                  <p className="text-2xl font-black text-[#354944] dark:text-[#C89D32] mt-1">{teamData.coverageRatePercent}%</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Rata-Rata Performa Tim Per Kategori</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(teamData.teamCategoryAverages).map(([catKey, avg]) => (
                    <div key={catKey} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 capitalize">{catKey.replace('_', ' ')}</span>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{avg}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADVANCED REPORTING (MODULE 7) */}
          {activeModuleTab === 'reports' && (
            <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Generator Laporan Analytics</h3>
                  <p className="text-[11px] text-slate-500">Ekspor laporan individual atlet atau ringkasan tim.</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#354944] text-white text-xs font-bold rounded-lg hover:bg-[#2B3D38] transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak / Export PDF
                </button>
              </div>

              {currentStudent && performanceData && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-3 border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{currentStudent.studentName || currentStudent.name}</h4>
                      <p className="text-xs text-slate-500">Kelas: {selectedClass?.className || 'Umum'} | Posisi: {currentStudent.playerRole || 'N/A'}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{new Date().toLocaleDateString('id-ID')}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-slate-400">Skor Utama:</span> <strong className="text-slate-800 dark:text-slate-100">{performanceData.overallScore ?? 'N/A'}</strong></div>
                    <div><span className="text-slate-400">Coverage:</span> <strong className="text-slate-800 dark:text-slate-100">{performanceData.evaluationCoverage}%</strong></div>
                    <div><span className="text-slate-400">Ter-evaluasi:</span> <strong className="text-slate-800 dark:text-slate-100">{performanceData.totalEvaluatedCount}</strong></div>
                    <div><span className="text-slate-400">Belum Dinilai:</span> <strong className="text-slate-800 dark:text-slate-100">{performanceData.totalUntestedCount}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DATA QUALITY AUDIT (MODULE 8) */}
          {activeModuleTab === 'quality' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Skor Kualitas Data</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{qualityData.dataQualityScore} / 100</p>
                </div>
                <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Total Nilai Terrekam</span>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{qualityData.totalScoresRecorded}</p>
                </div>
                <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Skor Tidak Valid</span>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{qualityData.totalInvalidScores}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#162320] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Peringatan Integritas Data & Evaluasi Kurang Lengkap</h3>
                {qualityData.warningList.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    ✓ Semua data evaluasi memenuhi standar kualitas dan integritas.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {qualityData.warningList.map((warn, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-xs flex justify-between items-center">
                        <span className="text-amber-800 dark:text-amber-300 font-medium">{warn.message}</span>
                        <span className="text-[10px] text-amber-600 font-bold uppercase">{warn.issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
