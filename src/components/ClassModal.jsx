import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as supabaseAcademyService from '../services/supabaseAcademyService';
import useArenaData from '../hooks/useArenaData';
import { 
  X, 
  GraduationCap, 
  Calendar, 
  Plus, 
  Trash2, 
  Dumbbell, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Users, 
  Info, 
  Layers, 
  Tag 
} from 'lucide-react';
import { isTennisSport } from '../config/tennisAssessmentData';
import { 
  getTiersForSport, 
  getSuggestedClassName, 
  normalizeSportString 
} from '../config/tierCurriculumConfig';

const DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function ClassModal({
  isOpen,
  onClose,
  userProfile,
  activeAcademy = null,
  uniqueSports,
  coaches,
  courts = [],
  onClassAdded
}) {
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  // Cabang olahraga yang mutlak diwarisi dari activeAcademy
  const inheritedSport = useMemo(() => {
    if (activeAcademy?.sport) return activeAcademy.sport;
    if (isTennisSport(null, activeAcademy)) return 'Tenis';
    if (Array.isArray(uniqueSports) && uniqueSports.length > 0) return uniqueSports[0];
    return 'Tenis'; // Fallback aman
  }, [activeAcademy, uniqueSports]);

  // Dual data fetch: Use props if available, fallback to internal useArenaData hook
  const arenaData = useArenaData(userProfile);
  const safeCourts = Array.isArray(courts) && courts.length > 0 ? courts : (arenaData?.courts || []);

  const [className, setClassName] = useState('');
  const [sport, setSport] = useState(inheritedSport);
  const [coachId, setCoachId] = useState(coaches?.[0]?.id || '');

  // Smart Age-Group & Tier States
  const [tierCode, setTierCode] = useState('ALL_AGE');
  const [tierLabel, setTierLabel] = useState('Umum / Lintas Usia');
  const [minAge, setMinAge] = useState(6);
  const [maxAge, setMaxAge] = useState(12);
  const [maxQuota, setMaxQuota] = useState(20);

  // Structured Schedule Array State
  const [schedules, setSchedules] = useState([
    { id: '1', day: 'Senin', startTime: '15:00', endTime: '17:00', courtId: '', courtName: '' }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Daftar opsi cabor yang tersedia dengan garansi cabor akademi aktif selalu di posisi teratas
  const availableSports = useMemo(() => {
    const list = [];
    if (inheritedSport && !list.includes(inheritedSport)) list.push(inheritedSport);
    if (activeAcademy?.sport && !list.includes(activeAcademy.sport)) list.push(activeAcademy.sport);
    if (Array.isArray(uniqueSports)) {
      uniqueSports.forEach((s) => {
        if (s && !list.includes(s)) list.push(s);
      });
    }
    ['Tenis', 'Badminton', 'Futsal', 'SepakBola', 'Minisoccer', 'BolaBasket 5v5', 'Bola Voli indoor'].forEach((s) => {
      if (!list.includes(s)) list.push(s);
    });
    return list;
  }, [inheritedSport, activeAcademy?.sport, uniqueSports]);

  // Tiers yang relevan dengan cabang olahraga yang dipilih
  const currentTiers = useMemo(() => getTiersForSport(sport), [sport]);

  // Re-sync sport state whenever modal opens or inheritedSport changes
  useEffect(() => {
    if (isOpen) {
      setSport(inheritedSport);
    }
  }, [isOpen, inheritedSport]);

  // Re-sync tier ketika sport atau modal dibuka
  useEffect(() => {
    if (isOpen && currentTiers.length > 0) {
      // Prioritaskan tier representatif jika ada
      const defaultTier = currentTiers.find((t) => 
        t.code === 'U-12' || t.code === 'T10_RED' || t.code === 'LEVEL_2'
      ) || currentTiers[0];

      setTierCode(defaultTier.code);
      setTierLabel(defaultTier.name);
      setMinAge(defaultTier.minAge);
      setMaxAge(defaultTier.maxAge);
      setMaxQuota(defaultTier.defaultQuota || 20);

      // Otomatis rekomendasikan nama kelas jika masih kosong
      if (!className) {
        setClassName(getSuggestedClassName(sport, defaultTier));
      }
    }
  }, [sport, isOpen, currentTiers]);

  // Handler pergantian Tier / Kelompok Umur
  const handleTierChange = (newCode) => {
    const selected = currentTiers.find((t) => t.code === newCode);
    if (!selected) return;

    setTierCode(selected.code);
    setTierLabel(selected.name);
    setMinAge(selected.minAge);
    setMaxAge(selected.maxAge);
    setMaxQuota(selected.defaultQuota || 20);

    // Sugesti nama jika nama masih kosong atau pola bawaan
    if (!className || className.includes('Grup') || className.includes('Prestasi') || className.includes('Kelas') || className.includes('ITF') || className.includes('U-')) {
      setClassName(getSuggestedClassName(sport, selected));
    }
  };

  // Normalisasi string pada filter lapangan (case & space insensitive)
  const normSelectedSport = normalizeSportString(sport);
  const matchedCourts = safeCourts.filter((court) => {
    return normalizeSportString(court.sport) === normSelectedSport;
  });
  const fallbackCourts = safeCourts.filter((court) => {
    return normalizeSportString(court.sport) !== normSelectedSport;
  });
  const hasMatchedCourts = matchedCourts.length > 0;
  const displayCourts = hasMatchedCourts ? matchedCourts : safeCourts;

  // Auto-set initial court for schedule rows when sport/courts change
  useEffect(() => {
    if (displayCourts.length > 0) {
      setSchedules((prev) =>
        prev.map((row) => {
          if (!row.courtId || !displayCourts.some((c) => c.id === row.courtId)) {
            return {
              ...row,
              courtId: displayCourts[0].id,
              courtName: displayCourts[0].name
            };
          }
          return row;
        })
      );
    } else {
      setSchedules((prev) =>
        prev.map((row) => ({
          ...row,
          courtId: '',
          courtName: ''
        }))
      );
    }
  }, [sport, safeCourts.length, hasMatchedCourts]);

  if (!isOpen) return null;

  const handleAddScheduleRow = () => {
    const defaultCourt = displayCourts[0];
    setSchedules((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        day: 'Rabu',
        startTime: '15:00',
        endTime: '17:00',
        courtId: defaultCourt?.id || '',
        courtName: defaultCourt?.name || ''
      }
    ]);
  };

  const handleRemoveScheduleRow = (id) => {
    if (schedules.length === 1) return;
    setSchedules((prev) => prev.filter((row) => row.id !== id));
  };

  const handleUpdateScheduleRow = (id, field, value) => {
    setSchedules((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          if (field === 'courtId') {
            const selectedCourt = safeCourts.find((c) => c.id === value);
            return {
              ...row,
              courtId: value,
              courtName: selectedCourt?.name || ''
            };
          }
          return { ...row, [field]: value };
        }
        return row;
      })
    );
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!className.trim() || !tenantId) {
      setErrorMsg('Nama kelas wajib diisi.');
      return;
    }

    // Validation: Ensure every schedule row has a court selected
    const missingCourt = schedules.some((s) => !s.courtId);
    if (missingCourt) {
      setErrorMsg('Silakan pilih lapangan untuk semua sesi jadwal latihan.');
      return;
    }

    setSubmitting(true);

    try {
      const selectedCoachObj = coaches.find((c) => c.id === coachId);

      // Summary string for fast table display
      const scheduleSummary = schedules
        .map((s) => `${s.day} (${s.startTime}-${s.endTime}, ${s.courtName || 'Lapangan'})`)
        .join('; ');

      // Mutlak prioritaskan cabor akademi aktif atau pilihan eksplisit
      const finalSport = activeAcademy?.sport || sport || inheritedSport;

      const newClass = {
        tenantId,
        academyId: activeAcademy?.id || '',
        academyName: activeAcademy?.name || '',
        className: className.trim(),
        sport: finalSport,
        tierCode: tierCode || 'ALL_AGE',
        tierLabel: tierLabel || 'Umum / Lintas Usia',
        minAge: Number(minAge) >= 0 ? Number(minAge) : 0,
        maxAge: Number(maxAge) > 0 ? Number(maxAge) : 99,
        maxQuota: Number(maxQuota) > 0 ? Number(maxQuota) : 20,
        coachId: selectedCoachObj?.id || '',
        coachName: selectedCoachObj?.name || 'Pelatih Utama',
        schedules: schedules, // Array of structured objects
        schedule: scheduleSummary,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const createdClass = await supabaseAcademyService.createClass({
        ...newClass,
        schedules,
        schedule: scheduleSummary,
        maxQuota: Number(maxQuota) || 20,
        tierCode,
        tierLabel
      });

      if (onClassAdded) {
        onClassAdded(createdClass || { id: `cls_${Date.now()}`, ...newClass });
      }

      onClose();
      setClassName('');
    } catch (err) {
      console.error('Error adding academy class:', err);
      setErrorMsg('Gagal membuat kelas. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#162320] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Sticky) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">Buat Kelas / Kelompok Latihan</h3>
              {activeAcademy?.sport && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#354944]/10 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20">
                  {activeAcademy.sport}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Akademi: <strong className="text-slate-700 dark:text-slate-200">{activeAcademy?.name || 'Akademi Aktif'}</strong> &bull; Mewarisi cabor: <strong className="text-[#354944] dark:text-[#C89D32]">{inheritedSport}</strong>
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-medium shrink-0">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateClass} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">

          {/* CABANG OLAHRAGA & PELATIH */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cabang Olahraga (Mewarisi Akademi Aktif) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center justify-between">
                <span>Cabang Olahraga</span>
                {activeAcademy?.sport && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold normal-case flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Mewarisi Akademi</span>
                  </span>
                )}
              </label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                {availableSports.map((s) => (
                  <option key={s} value={s}>
                    {s} {activeAcademy?.sport === s ? '★ (Sesuai Akademi)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Pelatih Utama */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Pelatih Utama
              </label>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                {coaches?.length === 0 ? (
                  <option value="">Belum ada pelatih terdaftar</option>
                ) : (
                  coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.sportSpecialty || 'Pelatih'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* SEKSI SMART AGE-GROUP & TIER SELECTION */}
          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#354944] dark:text-[#C89D32] uppercase flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                <span>Jenjang Kurikulum &amp; Kelompok Umur (Tier) <span className="text-[#C89D32]">*</span></span>
              </label>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60">
                Smart LTAD Filter
              </span>
            </div>

            {/* Dropdown Tier */}
            <div>
              <select
                value={tierCode}
                onChange={(e) => handleTierChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-bold text-slate-800 dark:text-slate-100 cursor-pointer shadow-2xs"
              >
                {currentTiers.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3 Kolom Input: Usia Min, Usia Max, Kuota Siswa */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Usia Min (Thn)
                </label>
                <input
                  type="number"
                  min="3"
                  max="99"
                  required
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-[#354944]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Usia Max (Thn)
                </label>
                <input
                  type="number"
                  min="3"
                  max="99"
                  required
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-[#354944]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                  <span>Kuota (Atlet)</span>
                  <Users className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={maxQuota}
                  onChange={(e) => setMaxQuota(e.target.value)}
                  placeholder="20"
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-[#354944]"
                />
              </div>
            </div>

            {/* Keterangan Tier */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
              {currentTiers.find((t) => t.code === tierCode)?.description || 'Kelompok umur menentukan rekomendasi pendaftaran siswa dan indikator evaluasi atlet.'}
            </p>
          </div>
          
          {/* Nama Kelas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center justify-between">
              <span>Nama Kelas / Kelompok Latihan <span className="text-[#C89D32]">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Dapat disesuaikan sesuai kebutuhan tim</span>
            </label>
            <div className="relative">
              <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="misal: U-12 Golden Age - Grup A"
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#354944] focus:ring-1 focus:ring-[#354944] font-medium"
              />
            </div>
          </div>

          {/* DYNAMIC SCHEDULE BUILDER WITH COURT INTEGRATION */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#354944] dark:text-[#C89D32] uppercase flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Alokasi Jadwal &amp; Lapangan Rutin</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {hasMatchedCourts ? (
                  <span>Filter Lapangan: <strong className="text-emerald-700 dark:text-emerald-400">{sport} ({matchedCourts.length})</strong></span>
                ) : (
                  <span>Semua Lapangan GOR ({safeCourts.length})</span>
                )}
              </span>
            </div>

            {/* Friendly Alert if no court specifically matches this sport in GOR master */}
            {!hasMatchedCourts && safeCourts.length > 0 && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  GOR belum memiliki data master lapangan dengan kategori <strong>{sport}</strong>. Menampilkan seluruh <strong>{safeCourts.length} lapangan GOR</strong> sebagai opsi alokasi.
                </span>
              </div>
            )}

            <div className="space-y-2.5">
              {schedules.map((row, idx) => (
                <div key={row.id} className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="font-bold text-[#354944] dark:text-[#C89D32] text-[11px]">Sesi #{idx + 1}</span>
                    {schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveScheduleRow(row.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer flex items-center space-x-1 text-[10px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Hari */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">Hari</label>
                      <select
                        value={row.day}
                        onChange={(e) => handleUpdateScheduleRow(row.id, 'day', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        {DAYS_LIST.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Jam Mulai */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">Mulai</label>
                      <input
                        type="time"
                        required
                        value={row.startTime}
                        onChange={(e) => handleUpdateScheduleRow(row.id, 'startTime', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {/* Jam Selesai */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">Selesai</label>
                      <input
                        type="time"
                        required
                        value={row.endTime}
                        onChange={(e) => handleUpdateScheduleRow(row.id, 'endTime', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Dropdown Pilih Lapangan Smart Filtered with Optgroups */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                      Pilih Lapangan Latihan <span className="text-[#C89D32]">*</span>
                    </label>
                    <select
                      value={row.courtId}
                      onChange={(e) => handleUpdateScheduleRow(row.id, 'courtId', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="">-- Pilih Lapangan --</option>
                      {safeCourts.length === 0 ? (
                        <option value="" disabled>Belum ada lapangan terdaftar di GOR</option>
                      ) : hasMatchedCourts ? (
                        <>
                          <optgroup label={`Lapangan Khusus ${sport} (${matchedCourts.length})`}>
                            {matchedCourts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} - Rp {Number(c.price || 0).toLocaleString('id-ID')}/jam
                              </option>
                            ))}
                          </optgroup>
                          {fallbackCourts.length > 0 && (
                            <optgroup label="Lapangan GOR Lainnya (Fallback Opsi)">
                              {fallbackCourts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.sport || 'Umum'}) - Rp {Number(c.price || 0).toLocaleString('id-ID')}/jam
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      ) : (
                        <optgroup label="Semua Lapangan GOR">
                          {safeCourts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.sport || 'Umum'}) - Rp {Number(c.price || 0).toLocaleString('id-ID')}/jam
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddScheduleRow}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1 border border-slate-200 dark:border-slate-700"
            >
              <Plus className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
              <span>+ Tambah Sesi Hari Lain</span>
            </button>
          </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex space-x-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-[#354944] hover:bg-[#2B3D38] text-white font-bold text-xs rounded-xl border-b-2 border-[#C89D32] shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Memproses...' : `Buat Kelas (${sport})`}
            </button>
          </div>

        </form>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
