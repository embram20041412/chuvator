import React, { useState, useEffect, useMemo } from 'react';
import { updateStudentGrowth } from '../services/supabaseAcademyService';
import { generateSportsNutritionInsight } from '../services/aiService';
import { calculateAge } from '../utils/helpers';


import {
  Ruler,
  Weight,
  Activity,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Scale,
  Calendar,
  User,
  Loader2,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

/**
 * Calculates BMI (Body Mass Index) = weight (kg) / (height (m) ^ 2)
 */
export function calculateBMI(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!h || !w || h <= 0 || w <= 0) return 0;
  const hM = h / 100;
  const bmi = w / (hM * hM);
  return Math.round(bmi * 10) / 10;
}

/**
 * Determines Sports Science BMI Status
 */
export function getBMIStatus(bmi) {
  const b = Number(bmi);
  if (b <= 0) return { status: 'Belum Ada', label: 'Belum Terdata', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  if (b < 18.5) return { status: 'Underweight', label: 'Kekurangan Massa (Underweight)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  if (b <= 24.9) return { status: 'Proporsional', label: 'Ideal (Proporsional)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  return { status: 'Overweight', label: 'Kelebihan Massa (Overweight)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
}

export default function GrowthTrackerSection({ selectedStudent, students = [] }) {
  // If students array is passed and selectedStudent is not provided, allow choosing a student locally
  const [selectedStudentId, setSelectedStudentId] = useState(selectedStudent?.id || '');

  useEffect(() => {
    if (selectedStudent?.id) {
      setSelectedStudentId(selectedStudent.id);
    }
  }, [selectedStudent?.id]);

  const currentStudent = useMemo(() => {
    if (selectedStudent) return selectedStudent;
    if (students.length > 0) {
      return students.find((s) => s.id === selectedStudentId) || students[0];
    }
    return null;
  }, [selectedStudent, students, selectedStudentId]);

  // Form states
  const [newHeight, setNewHeight] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Sync form inputs when currentStudent changes
  useEffect(() => {
    if (currentStudent) {
      setNewHeight(currentStudent.height ? String(currentStudent.height) : '');
      setNewWeight(currentStudent.weight ? String(currentStudent.weight) : '');
    }
  }, [currentStudent?.id, currentStudent?.height, currentStudent?.weight]);

  const [aiInsight, setAiInsight] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Live BMI calculation for current form inputs
  const liveBMI = useMemo(() => calculateBMI(newHeight, newWeight), [newHeight, newWeight]);
  const liveStatus = useMemo(() => getBMIStatus(liveBMI), [liveBMI]);

  // Sorted Growth History for Line Chart Visualization
  const historyList = useMemo(() => {
    if (!currentStudent?.growthHistory || !Array.isArray(currentStudent.growthHistory)) {
      return [];
    }
    const list = [...currentStudent.growthHistory];
    list.sort((a, b) => new Date(a.date || a.recordedAt || 0) - new Date(b.date || b.recordedAt || 0));
    return list;
  }, [currentStudent?.growthHistory]);

  const chartData = useMemo(() => {
    if (historyList.length === 0) {
      if (newHeight && newWeight) {
        return [
          {
            dateFormatted: recordDate || 'Hari Ini',
            height: Number(newHeight),
            weight: Number(newWeight),
            bmi: liveBMI
          }
        ];
      }
      return [];
    }
    return historyList.map((item) => ({
      dateFormatted: item.date || (item.recordedAt ? item.recordedAt.split('T')[0] : 'Tgl'),
      height: Number(item.height || 0),
      weight: Number(item.weight || 0),
      bmi: Number(item.bmi || 0)
    }));
  }, [historyList, newHeight, newWeight, recordDate, liveBMI]);

  // Save new growth record to Firestore
  const handleSaveGrowthRecord = async (e) => {
    e.preventDefault();
    if (!currentStudent?.id) {
      setErrorMsg('Pilih siswa atlet untuk mencatat data antropometri.');
      return;
    }
    if (!newHeight || !newWeight || Number(newHeight) <= 0 || Number(newWeight) <= 0) {
      setErrorMsg('Masukkan tinggi badan (cm) dan berat badan (kg) yang valid.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const bmiVal = calculateBMI(newHeight, newWeight);
    const statusObj = getBMIStatus(bmiVal);

    const newEntry = {
      date: recordDate || new Date().toISOString().split('T')[0],
      height: Number(newHeight),
      weight: Number(newWeight),
      bmi: Number(bmiVal),
      status: statusObj.status,
      recordedAt: new Date().toISOString()
    };

    try {
      await updateStudentGrowth(currentStudent.id, {
        height: Number(newHeight),
        weight: Number(newWeight),
        growthEntry: newEntry
      });

      setSuccessMsg(`Data antropometri (${newHeight} cm / ${newWeight} kg - ${statusObj.status}) berhasil dicatat!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to save growth record in Supabase:', err);
      setErrorMsg('Gagal menyimpan rekam pertumbuhan antropometri: ' + (err.message || 'Silakan coba lagi.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Generate AI Sports Nutrition Recommendation
  const handleGenerateAIInsight = async () => {
    if (!currentStudent) return;
    const h = Number(newHeight || currentStudent.height || 165);
    const w = Number(newWeight || currentStudent.weight || 55);
    const bmiVal = calculateBMI(h, w);
    const statusObj = getBMIStatus(bmiVal);

    setIsGeneratingAI(true);
    setAiInsight('');
    try {
      const studentAge = calculateAge(currentStudent.birthDate);
      const text = await generateSportsNutritionInsight({
        studentName: currentStudent.studentName,
        age: studentAge !== '-' ? studentAge : undefined,
        sport: currentStudent.sportCategoryLabel || currentStudent.sport || 'Sepakbola',
        position: currentStudent.playerRole || currentStudent.position || 'Pemain',
        height: h,
        weight: w,
        bmi: bmiVal,
        status: statusObj.status
      });
      setAiInsight(text);
    } catch (err) {
      console.error('Failed to generate AI insight:', err);
      setAiInsight('Gagal mengambil insight AI gizi. Silakan coba lagi.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* HEADER SECTION */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0 border border-sky-100 shadow-2xs">
              <TrendingUp className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight flex items-center gap-2">
                <span>Growth Tracker & AI Sport Nutrition</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                  Fase 12 Part 6
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pencatatan Tinggi, Berat Badan, BMI, serta rekomendasi makronutrisi & latihan berbasis AI.
              </p>
            </div>
          </div>
        </div>

        {/* FEEDBACK ALERTS */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-2 shadow-2xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-bold flex items-center gap-2 shadow-2xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MASTER STUDENT SELECTOR (IF MULTIPLE STUDENTS PASSED) */}
        {!selectedStudent && students.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-sky-600" />
              <span>Pilih Atlet Akademi:</span>
            </span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.studentName} ({st.playerRole || 'Umum'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* MAIN GRID LAYOUT: LEFT = FORM & AI, RIGHT = LINE CHART & HISTORY */}
        {currentStudent ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-1">
            
            {/* LEFT COLUMN: FORM INPUT & AI NUTRITION (5 COLS) */}
            <div className="lg:col-span-5 space-y-5">
              
              {/* FORM CARD */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-3xl border border-slate-200/90 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider block">
                      Pencatatan Baru:
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <h4 className="font-extrabold text-sm text-slate-900">{currentStudent.studentName}</h4>
                      {calculateAge(currentStudent.birthDate) !== '-' && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-[10px] font-bold">
                          Usia: {calculateAge(currentStudent.birthDate)} Tahun
                        </span>
                      )}
                    </div>
                  </div>
                  {currentStudent.playerRole && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-200 text-slate-700">
                      {currentStudent.playerRole}
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveGrowthRecord} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                      <span>Tanggal Pencatatan</span>
                    </label>
                    <input
                      type="date"
                      value={recordDate}
                      onChange={(e) => setRecordDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-slate-800 cursor-pointer shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Ruler className="w-3.5 h-3.5 text-sky-600" />
                        <span>Tinggi (cm)</span>
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="250"
                        step="0.5"
                        placeholder="e.g. 172"
                        value={newHeight}
                        onChange={(e) => setNewHeight(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-slate-800 shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Weight className="w-3.5 h-3.5 text-rose-500" />
                        <span>Berat (kg)</span>
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="200"
                        step="0.5"
                        placeholder="e.g. 62"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-slate-800 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* LIVE BMI INDICATOR CARD */}
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-sky-600" />
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Index BMI saat ini</span>
                        <strong className="text-base font-black text-slate-900">{liveBMI > 0 ? liveBMI : '-'}</strong>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-xl border ${liveStatus.color}`}>
                      {liveStatus.label}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Mencatat Growth...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-[#C89D32]" />
                        <span>Simpan Catatan Antropometri</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* AI NUTRITION & TRAINING RECOMMENDER */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-5 rounded-3xl text-white border border-slate-700 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#C89D32] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#C89D32]" />
                    <span>AI Sports Nutrition & Training</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Gemini Engine</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Analisis asupan makronutrisi harian dan fokus latihan fisik berdasarkan BMI, umur, dan posisi atlet.
                </p>

                <button
                  type="button"
                  onClick={handleGenerateAIInsight}
                  disabled={isGeneratingAI}
                  className="w-full py-2.5 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Menghitung Insight AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#C89D32]" />
                      <span>🤖 Generate AI Insight (Gizi & Latihan)</span>
                    </>
                  )}
                </button>

                {aiInsight && (
                  <div className="p-3.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-xs text-sky-100 space-y-2 animate-fadeIn whitespace-pre-line leading-relaxed">
                    <strong className="block text-[10px] uppercase font-black text-sky-400 border-b border-slate-800 pb-1">
                      Hasil Analisa Ahli Gizi AI:
                    </strong>
                    <div>{aiInsight}</div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: RECHARTS LINE CHART & HISTORI TABLE (7 COLS) */}
            <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 space-y-5 shadow-2xs">
              
              {/* RECHARTS KURVA PERTUMBUHAN */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-sky-600" />
                    <span>Kurva Pertumbuhan Atlet (Growth Curve)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {historyList.length} Rekam Terdata
                  </span>
                </div>

                {chartData.length === 0 ? (
                  <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                    Belum ada rekam data pertumbuhan. Isi form di sebelah kiri untuk mulai membuat grafik.
                  </div>
                ) : (
                  <div className="bg-slate-900 rounded-2xl p-3.5 text-white shadow-inner">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="dateFormatted" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                        <YAxis yAxisId="left" orientation="left" stroke="#38bdf8" tick={{ fill: '#38bdf8', fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                        <YAxis yAxisId="right" orientation="right" stroke="#fb7185" tick={{ fill: '#fb7185', fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#f8fafc' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />
                        <Line yAxisId="left" type="monotone" dataKey="height" name="Tinggi (cm)" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" type="monotone" dataKey="weight" name="Berat (kg)" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* HISTORI DATA TABEL */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                  Riwayat Antropometri Siswa
                </span>

                {historyList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada riwayat antropometri terdata.</p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3 text-center">Tinggi</th>
                          <th className="py-2.5 px-3 text-center">Berat</th>
                          <th className="py-2.5 px-3 text-center">BMI</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {historyList.map((item, idx) => {
                          const stObj = getBMIStatus(item.bmi);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {item.date || (item.recordedAt ? item.recordedAt.split('T')[0] : 'Tgl')}
                              </td>
                              <td className="py-2.5 px-3 text-center font-extrabold text-sky-600">
                                {item.height} cm
                              </td>
                              <td className="py-2.5 px-3 text-center font-extrabold text-rose-600">
                                {item.weight} kg
                              </td>
                              <td className="py-2.5 px-3 text-center font-black">
                                {item.bmi || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${stObj.color}`}>
                                  {item.status || stObj.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 border-2 border-dashed border-slate-200 rounded-3xl text-center text-xs text-slate-400 p-6">
            Pilih siswa atlet dari akademi untuk mencatat dan melihat modul antropometri.
          </div>
        )}
      </div>
    </div>
  );
}
