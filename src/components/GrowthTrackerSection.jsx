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
  UserCheck,
  Lock
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
import {
  MobileGrowthContextBar,
  MobileGrowthHeroCard,
  MobileGrowthInputForm,
  MobileGrowthChartContainer,
  MobileGrowthAiInsight,
  MobileGrowthHistorySection
} from '../mobile/components/growth/MobileGrowthBlocks';

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

/**
 * Filters students strictly by the currently selected class,
 * respecting active status, tenant context, and academy context.
 */
export function filterStudentsBySelectedClass(
  students = [],
  selectedClass,
  tenantId,
  activeAcademy
) {
  if (!selectedClass?.id) return [];
  if (!Array.isArray(students) || students.length === 0) return [];

  const targetTenantId = tenantId || selectedClass.tenantId || selectedClass.tenant_id || null;
  const targetAcademyId =
    activeAcademy?.id || selectedClass.academyId || selectedClass.academy_id || null;

  return students.filter((student) => {
    if (!student || typeof student !== 'object') return false;

    const isInactive =
      student.status === 'Non-Aktif' ||
      student.status === 'Nonaktif' ||
      student.status === 'Belum Aktif' ||
      student.status === 'inactive' ||
      student.isActive === false;
    if (isInactive) return false;

    const studentTenantId = student.tenantId || student.tenant_id;
    if (targetTenantId && studentTenantId && String(studentTenantId) !== String(targetTenantId)) {
      return false;
    }

    const studentAcademyId = student.academyId || student.academy_id;
    if (targetAcademyId && studentAcademyId && String(studentAcademyId) !== String(targetAcademyId)) {
      return false;
    }

    const studentClassId = student.classId || student.class_id;
    if (studentClassId) {
      return String(studentClassId) === String(selectedClass.id);
    }

    if (selectedClass.className && student.className) {
      return student.className === selectedClass.className;
    }

    return false;
  });
}

/**
 * Resolves the active athlete selection when the class or class member list changes.
 * If the previously selected athlete is not a member of the new class, resets selection.
 */
export function resolveClassAthleteSelection(classStudents = [], previousSelectedStudentId = '') {
  if (!Array.isArray(classStudents) || classStudents.length === 0) {
    return {
      selectedStudentId: '',
      selectedStudent: null,
      wasReset: Boolean(previousSelectedStudentId)
    };
  }

  const existingMember = classStudents.find(
    (s) => String(s.id) === String(previousSelectedStudentId)
  );
  if (existingMember) {
    return {
      selectedStudentId: existingMember.id,
      selectedStudent: existingMember,
      wasReset: false
    };
  }

  return {
    selectedStudentId: classStudents[0].id,
    selectedStudent: classStudents[0],
    wasReset: true
  };
}

export default function GrowthTrackerSection({
  selectedStudent,
  students = [],
  onStudentUpdated,
  selectedClass,
  tenantId,
  activeAcademy,
  isArchived = false,
  isMobile = false
}) {
  const effectiveIsArchived = isArchived || selectedClass?.isArchived === true;
  const isSingleStudentMode = Boolean(selectedStudent?.id);

  // Filter athletes strictly by selectedClass when in class-based workspace mode
  const classStudents = useMemo(() => {
    if (isSingleStudentMode) return [selectedStudent];
    return filterStudentsBySelectedClass(students, selectedClass, tenantId, activeAcademy);
  }, [isSingleStudentMode, selectedStudent, students, selectedClass, tenantId, activeAcademy]);

  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    if (selectedStudent?.id) return selectedStudent.id;
    return '';
  });
  const [localStudentData, setLocalStudentData] = useState(null);

  // Form states
  const [newHeight, setNewHeight] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [aiInsight, setAiInsight] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync selectedStudentId when in single-student modal mode
  useEffect(() => {
    if (selectedStudent?.id) {
      setSelectedStudentId(selectedStudent.id);
    }
  }, [selectedStudent?.id]);

  // Validate and reset athlete selection immediately when selectedClass or classStudents changes
  useEffect(() => {
    if (isSingleStudentMode) return;

    const resolved = resolveClassAthleteSelection(classStudents, selectedStudentId);
    if (resolved.selectedStudentId !== selectedStudentId) {
      setSelectedStudentId(resolved.selectedStudentId);
    }
    if (resolved.wasReset) {
      setLocalStudentData(null);
      setAiInsight('');
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [isSingleStudentMode, selectedClass?.id, classStudents, selectedStudentId]);

  // Clear transient state when switching classes or athletes
  useEffect(() => {
    setLocalStudentData(null);
    setAiInsight('');
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [selectedClass?.id, selectedStudentId, selectedStudent?.id]);

  const baseStudent = useMemo(() => {
    if (selectedStudent) return selectedStudent;
    if (!selectedClass?.id || classStudents.length === 0) return null;
    return classStudents.find((s) => String(s.id) === String(selectedStudentId)) || classStudents[0] || null;
  }, [selectedStudent, selectedClass?.id, classStudents, selectedStudentId]);

  // Use localStudentData (latest from DB update) if available for current student
  const currentStudent = useMemo(() => {
    if (localStudentData && baseStudent && String(localStudentData.id) === String(baseStudent.id)) {
      return localStudentData;
    }
    return baseStudent;
  }, [baseStudent, localStudentData]);

  // Sync form inputs when currentStudent changes; clear inputs when no student is active
  useEffect(() => {
    if (currentStudent) {
      setNewHeight(
        currentStudent.height !== null && currentStudent.height !== undefined && currentStudent.height !== ''
          ? String(currentStudent.height)
          : ''
      );
      setNewWeight(
        currentStudent.weight !== null && currentStudent.weight !== undefined && currentStudent.weight !== ''
          ? String(currentStudent.weight)
          : ''
      );
    } else {
      setNewHeight('');
      setNewWeight('');
    }
  }, [currentStudent?.id, currentStudent?.height, currentStudent?.weight]);

  // Live BMI calculation for current form inputs
  const liveBMI = useMemo(() => calculateBMI(newHeight, newWeight), [newHeight, newWeight]);
  const liveStatus = useMemo(() => getBMIStatus(liveBMI), [liveBMI]);

  // Sorted Growth History for Line Chart Visualization and History Table
  const historyList = useMemo(() => {
    const raw = currentStudent?.growthHistory ?? currentStudent?.growth_history;
    let list = [];
    if (Array.isArray(raw)) {
      list = [...raw];
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = [...parsed];
      } catch {
        list = [];
      }
    }
    return list
      .filter((item) => item && typeof item === 'object')
      .sort((a, b) => new Date(a.date || a.recordedAt || 0) - new Date(b.date || b.recordedAt || 0));
  }, [currentStudent?.growthHistory, currentStudent?.growth_history]);

  const chartData = useMemo(() => {
    if (historyList.length === 0) {
      if (newHeight && newWeight && Number(newHeight) > 0 && Number(newWeight) > 0) {
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

  // Save new growth record to Supabase
  const handleSaveGrowthRecord = async (e) => {
    e.preventDefault();

    if (effectiveIsArchived) {
      setErrorMsg('Tidak dapat menyimpan rekam pertumbuhan: Kelas ini telah diarsipkan (mode baca-saja).');
      return;
    }

    // Hindari penambahan histori ganda akibat satu kali klik Simpan
    if (isSaving) return;

    if (!currentStudent?.id) {
      setErrorMsg('Pilih siswa atlet untuk mencatat data antropometri.');
      return;
    }

    const parsedH = Number(newHeight);
    const parsedW = Number(newWeight);

    // Pertahankan validasi tinggi dan berat badan
    if (!newHeight || !newWeight || isNaN(parsedH) || isNaN(parsedW) || parsedH <= 0 || parsedW <= 0) {
      setErrorMsg('Masukkan tinggi badan (cm) dan berat badan (kg) yang valid.');
      return;
    }

    if (parsedH < 50 || parsedH > 250) {
      setErrorMsg('Tinggi badan harus di antara 50 cm dan 250 cm.');
      return;
    }

    if (parsedW < 10 || parsedW > 250) {
      setErrorMsg('Berat badan harus di antara 10 kg dan 250 kg.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const bmiVal = calculateBMI(parsedH, parsedW);
    const statusObj = getBMIStatus(bmiVal);

    const newEntry = {
      date: recordDate || new Date().toISOString().split('T')[0],
      height: parsedH,
      weight: parsedW,
      bmi: Number(bmiVal),
      status: statusObj.status,
      recordedAt: new Date().toISOString()
    };

    try {
      const updatedStudent = await updateStudentGrowth(currentStudent.id, {
        height: parsedH,
        weight: parsedW,
        growthEntry: newEntry
      });

      if (!updatedStudent) {
        throw new Error('Tidak ada data respon dari database.');
      }

      // Perbarui data siswa dan histori yang ditampilkan secara instan
      setLocalStudentData(updatedStudent);

      // Notifikasi ke parent component jika callback tersedia
      if (typeof onStudentUpdated === 'function') {
        onStudentUpdated(updatedStudent);
      }

      setSuccessMsg(`Data antropometri (${parsedH} cm / ${parsedW} kg - ${statusObj.status}) berhasil dicatat!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to save growth record in Supabase:', err);
      const friendlyMsg = err?.message || 'Silakan coba lagi.';
      setErrorMsg('Gagal menyimpan rekam pertumbuhan antropometri: ' + friendlyMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Generate AI Sports Nutrition Recommendation
  const handleGenerateAIInsight = async () => {
    if (effectiveIsArchived) return;
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
        sport: currentStudent.sportCategoryLabel || currentStudent.sport || selectedClass?.sport || 'Sepakbola',
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

  const studentAge = currentStudent ? calculateAge(currentStudent.birthDate) : '-';
  const recordedBMI = currentStudent ? calculateBMI(currentStudent.height, currentStudent.weight) : 0;
  const recordedStatus = getBMIStatus(recordedBMI);

  if (isMobile) {
    return (
      <div className="space-y-3 text-left">
        {!isSingleStudentMode && (
          <MobileGrowthContextBar
            selectedClass={selectedClass}
            students={classStudents}
            selectedStudent={currentStudent}
            onSelectStudentId={setSelectedStudentId}
            isArchived={effectiveIsArchived}
          />
        )}

        {currentStudent ? (
          <div className="space-y-3">
            {/* Summary Hero */}
            <MobileGrowthHeroCard
              height={currentStudent.height}
              weight={currentStudent.weight}
              bmi={recordedBMI}
              bmiStatus={recordedStatus}
              lastMeasuredDate={historyList.length > 0 ? historyList[historyList.length - 1].date : null}
            />

            {/* Input Form */}
            <MobileGrowthInputForm
              newHeight={newHeight}
              setNewHeight={setNewHeight}
              newWeight={newWeight}
              setNewWeight={setNewWeight}
              recordDate={recordDate}
              setRecordDate={setRecordDate}
              liveBMI={liveBMI}
              liveStatus={liveStatus}
              onSave={handleSaveGrowthRecord}
              isSaving={isSaving}
              isArchived={effectiveIsArchived}
              successMsg={successMsg}
              errorMsg={errorMsg}
            />

            {/* Growth Curve */}
            <MobileGrowthChartContainer historyCount={historyList.length}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis 
                      dataKey="dateFormatted" 
                      stroke="#94a3b8" 
                      tick={{ fill: '#cbd5e1', fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      minTickGap={20}
                    />
                    <YAxis 
                      yAxisId="left" 
                      orientation="left" 
                      width={40}
                      stroke="#38bdf8" 
                      tick={{ fill: '#38bdf8', fontSize: 10 }} 
                      domain={['dataMin - 5', 'dataMax + 5']}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      width={40}
                      stroke="#fb7185" 
                      tick={{ fill: '#fb7185', fontSize: 10 }} 
                      domain={['dataMin - 5', 'dataMax + 5']}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#f8fafc' }}
                      itemStyle={{ padding: '2px 0' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="height" name="TB (cm)" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#101D38' }} activeDot={{ r: 6 }} />
                    <Line yAxisId="right" type="monotone" dataKey="weight" name="BB (kg)" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#101D38' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-center p-6">
                  <p className="text-slate-400 text-[12px]">Belum ada data riwayat untuk menampilkan grafik pertumbuhan.</p>
                </div>
              )}
            </MobileGrowthChartContainer>

            {/* AI Insight */}
            <MobileGrowthAiInsight
              aiInsight={aiInsight}
              onGenerate={handleGenerateAIInsight}
              isGenerating={isGeneratingAI}
              isArchived={effectiveIsArchived}
            />

            {/* History */}
            <MobileGrowthHistorySection history={historyList} />
          </div>
        ) : (
          <div className="chua-m-growth-card py-10 text-center space-y-2">
            <User className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-[13px] font-bold text-[#17233D]">Pilih atlet terlebih dahulu</p>
            <p className="text-[11px] text-[#68758B]">Gunakan menu pilihan di atas untuk memuat data antropometri atlet.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/80 shadow-xs space-y-3">
        {/* 1. HEADER GROWTH TRACKER (RINGKAS) */}
        <div className="flex items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0 border border-sky-100">
              <TrendingUp className="w-4 h-4 text-sky-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight truncate">
                Growth Tracker & AI Sport Nutrition
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Pantau tinggi, berat badan, BMI, dan nutrisi atlet.
              </p>
            </div>
          </div>

          {/* 2. KONTEKS KELAS TERPILIH */}
          {!isSingleStudentMode && selectedClass?.className && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 shrink-0 truncate max-w-[140px] sm:max-w-xs">
              {selectedClass.className}
            </span>
          )}
        </div>

        {/* ARCHIVED BANNER */}
        {effectiveIsArchived && (
          <div className="p-2.5 bg-amber-50 border border-amber-200/90 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Kelas diarsipkan (mode baca-saja).</span>
          </div>
        )}

        {/* FEEDBACK ALERTS */}
        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold flex items-center gap-1.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. PEMILIHAN ATLET (HANYA ANGGOTA KELAS AKTIF) */}
        {!isSingleStudentMode && (
          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <label
                htmlFor="growth-student-selector"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Pilih Atlet Akademi</span>
              </label>
              {selectedClass?.id && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
                  {classStudents.length} Atlet
                </span>
              )}
            </div>

            <select
              id="growth-student-selector"
              name="selectedStudentId"
              aria-label="Pilih Atlet Akademi"
              disabled={!selectedClass?.id || classStudents.length === 0}
              value={baseStudent?.id || ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[240px] min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {!selectedClass?.id ? (
                <option value="">-- Pilih kelas terlebih dahulu --</option>
              ) : classStudents.length === 0 ? (
                <option value="">-- Belum ada atlet di kelas ini --</option>
              ) : (
                classStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.studentName} ({st.playerRole || st.position || 'Umum'})
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* EMPTY STATES OR MAIN CONTENT */}
        {!isSingleStudentMode && !selectedClass?.id ? (
          <div className="py-8 px-4 border border-dashed border-slate-200 rounded-xl text-center space-y-1 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-700">
              Pilih kelas terlebih dahulu
            </p>
            <p className="text-[11px] text-slate-500">
              Gunakan pilihan kelas di atas untuk memuat daftar atlet yang terdaftar.
            </p>
          </div>
        ) : !isSingleStudentMode && classStudents.length === 0 ? (
          <div className="py-8 px-4 border border-dashed border-slate-200 rounded-xl text-center space-y-1 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-700">
              Belum ada atlet di kelas {selectedClass?.className || 'ini'}
            </p>
            <p className="text-[11px] text-slate-500">
              Daftarkan atlet ke kelas ini terlebih dahulu untuk mencatat pertumbuhan antropometri.
            </p>
          </div>
        ) : currentStudent ? (
          <div className="space-y-3 pt-0.5">
            {/* 4. RINGKASAN SINGKAT ATLET TERPILIH (SATU KALI SAJA) */}
            <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#354944] text-[#C89D32] flex items-center justify-center font-black text-xs shrink-0">
                  {(currentStudent.studentName || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {currentStudent.studentName}
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                    <span className="font-semibold text-slate-700">
                      {currentStudent.playerRole || currentStudent.position || 'Atlet'}
                    </span>
                    {studentAge !== '-' && (
                      <>
                        <span>•</span>
                        <span>{studentAge} Thn</span>
                      </>
                    )}
                    {selectedClass?.className && (
                      <>
                        <span>•</span>
                        <span>{selectedClass.className}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
                  TB: <strong className="text-sky-600">{currentStudent.height || '-'}</strong> cm
                </span>
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
                  BB: <strong className="text-rose-600">{currentStudent.weight || '-'}</strong> kg
                </span>
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
                  BMI: <strong>{recordedBMI > 0 ? recordedBMI : '-'}</strong>
                </span>
              </div>
            </div>

            {/* MAIN GRID: MOBILE STACKED (5 -> 6 -> 7 -> 8), DESKTOP 2 COLUMNS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* LEFT COLUMN: 5. FORM ANTROPOMETRI & 6. AI NUTRITION */}
              <div className="lg:col-span-5 space-y-3">
                {/* 5. FORM PENCATATAN ANTROPOMETRI */}
                <form
                  onSubmit={handleSaveGrowthRecord}
                  className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Catat Antropometri
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      Input Pengukuran Baru
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="growth-record-date"
                      className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"
                    >
                      <Calendar className="w-3 h-3 text-sky-600" />
                      <span>Tanggal Pencatatan</span>
                    </label>
                    <input
                      id="growth-record-date"
                      name="recordDate"
                      type="date"
                      value={recordDate}
                      disabled={effectiveIsArchived}
                      onChange={(e) => setRecordDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold text-slate-800 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="growth-new-height"
                        className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"
                      >
                        <Ruler className="w-3 h-3 text-sky-600" />
                        <span>Tinggi (cm)</span>
                      </label>
                      <input
                        id="growth-new-height"
                        name="newHeight"
                        type="number"
                        inputMode="decimal"
                        min="50"
                        max="250"
                        step="0.5"
                        placeholder="172"
                        value={newHeight}
                        disabled={effectiveIsArchived}
                        onChange={(e) => setNewHeight(e.target.value)}
                        required={!effectiveIsArchived}
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="growth-new-weight"
                        className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"
                      >
                        <Weight className="w-3 h-3 text-rose-500" />
                        <span>Berat (kg)</span>
                      </label>
                      <input
                        id="growth-new-weight"
                        name="newWeight"
                        type="number"
                        inputMode="decimal"
                        min="10"
                        max="250"
                        step="0.5"
                        placeholder="62"
                        value={newWeight}
                        disabled={effectiveIsArchived}
                        onChange={(e) => setNewWeight(e.target.value)}
                        required={!effectiveIsArchived}
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* INDIKATOR VISUAL RINGKAS BMI & STATUS */}
                  <div className="p-2.5 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-600">BMI:</span>
                      <strong className="text-sm font-black text-slate-900">
                        {liveBMI > 0 ? liveBMI : '-'}
                      </strong>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${liveStatus.color}`}>
                      {liveStatus.label}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving || effectiveIsArchived}
                    className="w-full min-h-[42px] py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Menyimpan...</span>
                      </>
                    ) : effectiveIsArchived ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-[#C89D32]" />
                        <span>Terkunci (Kelas Arsip)</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-[#C89D32]" />
                        <span>Simpan Catatan Antropometri</span>
                      </>
                    )}
                  </button>
                </form>

                {/* 6. AI SPORTS NUTRITION & TRAINING (RINGKAS) */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-3 sm:p-3.5 rounded-xl text-white border border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C89D32] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#C89D32]" />
                      <span>AI Sports Nutrition & Training</span>
                    </span>
                  </div>

                  {aiInsight && (
                    <div className="p-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-[11px] text-sky-100 space-y-1 animate-fadeIn whitespace-pre-line leading-relaxed">
                      <strong className="block text-[10px] uppercase font-black text-sky-400 border-b border-slate-800 pb-1">
                        Rekomendasi Gizi & Latihan:
                      </strong>
                      <div>{aiInsight}</div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateAIInsight}
                    disabled={isGeneratingAI || effectiveIsArchived}
                    className="w-full min-h-[40px] py-2 bg-[#354944] hover:bg-[#2B3D38] border-b-2 border-[#C89D32] text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isGeneratingAI ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Menghitung Insight AI...</span>
                      </>
                    ) : effectiveIsArchived ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-[#C89D32]" />
                        <span>AI Insight Nonaktif (Arsip)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#C89D32]" />
                        <span>{aiInsight ? 'Perbarui AI Insight' : 'Generate AI Insight'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: 7. GROWTH CURVE & 8. RIWAYAT ANTROPOMETRI */}
              <div className="lg:col-span-7 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 space-y-3.5">
                {/* 7. GROWTH CURVE */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-sky-600" />
                      <span>Growth Curve</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {historyList.length} Rekam
                    </span>
                  </div>

                  {chartData.length === 0 ? (
                    <div className="py-8 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 px-3">
                      Belum ada data grafik. Simpan catatan antropometri untuk melihat kurva pertumbuhan.
                    </div>
                  ) : (
                    <div className="bg-slate-900 rounded-xl p-2.5 text-white min-h-[210px] min-w-0">
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="dateFormatted" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 9 }} />
                          <YAxis yAxisId="left" orientation="left" stroke="#38bdf8" tick={{ fill: '#38bdf8', fontSize: 9 }} domain={['dataMin - 5', 'dataMax + 5']} />
                          <YAxis yAxisId="right" orientation="right" stroke="#fb7185" tick={{ fill: '#fb7185', fontSize: 9 }} domain={['dataMin - 5', 'dataMax + 5']} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '10px', color: '#f8fafc' }} />
                          <Legend wrapperStyle={{ fontSize: '10px', color: '#cbd5e1' }} />
                          <Line yAxisId="left" type="monotone" dataKey="height" name="Tinggi (cm)" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: '#0ea5e9' }} activeDot={{ r: 5 }} />
                          <Line yAxisId="right" type="monotone" dataKey="weight" name="Berat (kg)" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3, fill: '#f43f5e' }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 8. RIWAYAT ANTROPOMETRI */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Riwayat Antropometri
                    </span>
                  </div>

                  {historyList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      Belum ada riwayat antropometri tercatat.
                    </p>
                  ) : (
                    <>
                      {/* MOBILE COMPACT CARDS (< sm) */}
                      <div className="space-y-2 sm:hidden">
                        {[...historyList].reverse().map((item, idx) => {
                          const stObj = getBMIStatus(item.bmi);
                          const dateLabel = item.date || (item.recordedAt ? item.recordedAt.split('T')[0] : 'Tgl');
                          return (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-900">{dateLabel}</span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${stObj.color}`}>
                                  {item.status || stObj.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-white p-2 rounded-lg border border-slate-100">
                                <div>
                                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Tinggi</span>
                                  <strong className="text-sky-600">{item.height} cm</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Berat</span>
                                  <strong className="text-rose-600">{item.weight} kg</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 block uppercase font-bold">BMI</span>
                                  <strong className="text-slate-900">{item.bmi || '-'}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* DESKTOP / TABLET TABLE (>= sm) */}
                      <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/80">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80 text-[9px] font-bold text-slate-500 uppercase">
                              <th className="py-1.5 px-2.5">Tanggal</th>
                              <th className="py-1.5 px-2.5 text-center">Tinggi</th>
                              <th className="py-1.5 px-2.5 text-center">Berat</th>
                              <th className="py-1.5 px-2.5 text-center">BMI</th>
                              <th className="py-1.5 px-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {historyList.map((item, idx) => {
                              const stObj = getBMIStatus(item.bmi);
                              return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-1.5 px-2.5 font-bold text-slate-900">
                                    {item.date || (item.recordedAt ? item.recordedAt.split('T')[0] : 'Tgl')}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center font-bold text-sky-600">
                                    {item.height} cm
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center font-bold text-rose-600">
                                    {item.weight} kg
                                  </td>
                                  <td className="py-1.5 px-2.5 text-center font-black">
                                    {item.bmi || '-'}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right">
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${stObj.color}`}>
                                      {item.status || stObj.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 p-4">
            Pilih atlet untuk melihat dan mencatat pertumbuhan antropometri.
          </div>
        )}
      </div>
    </div>
  );
}

