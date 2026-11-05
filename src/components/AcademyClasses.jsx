import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import {
  Calendar,
  Lock,
  User,
  Clock,
  Edit3,
  Archive,
  RotateCcw
} from 'lucide-react';
import { formatIndonesianDate } from '../utils/scheduleGenerator';

export default function AcademyClasses({
  classes = [],
  classSubTab = 'active',
  canManageClasses = true,
  onEditClass,
  onArchiveClass,
  onUnarchiveClass,
  onOpenGenerateSchedule,
  students = [],
  tenantId
}) {
  const [classLockStatus, setClassLockStatus] = useState({});
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // Cek jadwal terdekat yang terkunci untuk setiap kelas
  const checkClassLockStatuses = useCallback(async () => {
    if (!classes || classes.length === 0) {
      setClassLockStatus({});
      return;
    }

    try {
      setLoadingStatuses(true);
      const today = new Date().toISOString().split('T')[0];
      const statusMap = {};

      await Promise.all(
        classes.map(async (cls) => {
          if (!cls?.id) return;
          try {
            const { data, error } = await supabase
              .from('bookings')
              .select('date, start_time')
              .eq('class_id', cls.id)
              .gte('date', today)
              .not('status', 'in', '("Dibatalkan","Cancelled","VOID")')
              .order('date', { ascending: false })
              .limit(1);

            if (!error && Array.isArray(data) && data.length > 0) {
              statusMap[cls.id] = {
                isLocked: true,
                untilDate: data[0].date,
                startTime: data[0].start_time
              };
            } else {
              statusMap[cls.id] = {
                isLocked: false,
                untilDate: null
              };
            }
          } catch (err) {
            console.warn(`[AcademyClasses] Check lock status failed for class ${cls.id}:`, err);
            statusMap[cls.id] = { isLocked: false, untilDate: null };
          }
        })
      );

      setClassLockStatus(statusMap);
    } catch (globalErr) {
      console.warn('[AcademyClasses] Error checking lock statuses:', globalErr);
    } finally {
      setLoadingStatuses(false);
    }
  }, [classes]);

  useEffect(() => {
    checkClassLockStatuses();

    const handleRefresh = () => {
      checkClassLockStatuses();
    };

    window.addEventListener('simak_refresh_arena_data', handleRefresh);
    return () => {
      window.removeEventListener('simak_refresh_arena_data', handleRefresh);
    };
  }, [checkClassLockStatuses]);

  if (classes.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-slate-500">
        <p className="text-xs">
          {classSubTab === 'active' ? 'Belum ada kelas aktif.' : 'Tidak ada kelas yang diarsipkan.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {classes.map((cls) => {
        // Enrolled count
        const enrolledCount = students.filter(
          (s) => (s.classId === cls.id || s.class_id === cls.id) && s.status !== 'Nonaktif'
        ).length;
        const maxQuota = cls.maxQuota || 20;
        const isFull = enrolledCount >= maxQuota;

        // Schedule items
        const rawSchedules = Array.isArray(cls.schedules)
          ? cls.schedules
          : Array.isArray(cls.schedule)
          ? cls.schedule
          : typeof cls.schedule === 'string' && cls.schedule
          ? cls.schedule.split(',').map((s) => ({ day: s.trim() }))
          : [];

        const scheduleItems = rawSchedules.map((item) => {
          if (typeof item === 'string') return { day: item };
          const time =
            item.startTime && item.endTime
              ? `${item.startTime} - ${item.endTime}`
              : item.start_time && item.end_time
              ? `${item.start_time} - ${item.end_time}`
              : '';
          const court = item.courtName || item.court_name || item.court || '';
          return { day: item.day || 'Jadwal Rutin', time, court };
        });

        // Status Kunci Jadwal
        const lockInfo = classLockStatus[cls.id] || { isLocked: false, untilDate: null };

        return (
          <div
            key={cls.id}
            className={
              classSubTab === 'archived'
                ? "bg-amber-50/15 dark:bg-slate-900 border border-dashed border-amber-300/80 dark:border-amber-800/70 shadow-2xs rounded-xl p-3 sm:p-3.5 hover:border-amber-400 transition-all space-y-2 flex flex-col justify-between group"
                : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs rounded-xl p-3 sm:p-3.5 hover:border-[#354944]/40 transition-all space-y-2 flex flex-col justify-between group"
            }
          >
            <div className="space-y-2">
              {/* Header Kelas */}
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="px-2 py-0.5 bg-[#354944]/10 dark:bg-[#354944]/30 text-[#354944] dark:text-[#C89D32] font-bold text-[9px] rounded uppercase border border-[#354944]/20 shrink-0">
                    {cls.sport || 'Sports'}
                  </span>
                  {cls.tierCode && cls.tierCode !== 'ALL_AGE' && (
                    <span
                      className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-[#C89D32] font-extrabold text-[9px] rounded border border-amber-200/80 dark:border-amber-800/60 truncate max-w-[110px]"
                      title={cls.tierLabel || cls.tierCode}
                    >
                      {cls.tierLabel || cls.tierCode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {classSubTab === 'active' ? (
                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/50">
                      Aktif
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-800/50 flex items-center gap-1">
                      <Archive className="w-2.5 h-2.5" /> Diarsipkan
                    </span>
                  )}

                  {/* Tombol Aksi Kelas */}
                  {canManageClasses && (
                    <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                      {classSubTab === 'active' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditClass && onEditClass(cls)}
                            className="p-0.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded transition-colors cursor-pointer"
                            title="Edit Data Kelas"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchiveClass && onArchiveClass(cls.id, cls.className)}
                            className="p-0.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded transition-colors cursor-pointer"
                            title="Arsipkan Kelas"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUnarchiveClass && onUnarchiveClass(cls.id, cls.className)}
                          className="px-2 py-0.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-300/70 dark:border-emerald-700/60 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Pulihkan Kelas ke Status Aktif"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Pulihkan</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Judul & Pelatih */}
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                  {cls.className}
                </h4>
                <div className="flex items-center justify-between mt-0.5 flex-wrap gap-1 text-[11px]">
                  <p className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>
                      Pelatih: <strong className="text-slate-800 dark:text-slate-200">{cls.coachName || 'Pelatih Utama'}</strong>
                    </span>
                  </p>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                      isFull
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {enrolledCount}/{maxQuota} Atlet {isFull ? '● Penuh' : ''}
                  </span>
                </div>
                {((cls.minAge !== undefined && cls.minAge !== null) ||
                  (cls.maxAge !== undefined && cls.maxAge !== null)) && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Target Usia: <strong className="text-slate-600 dark:text-slate-300">{cls.minAge || 0} - {cls.maxAge || 99} Thn</strong>
                  </p>
                )}
                {classSubTab === 'archived' && cls.archivedAt && (
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>
                      Diarsipkan: {new Date(cls.archivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </p>
                )}
              </div>

              {/* Daftar Jadwal Rutin */}
              <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#354944] dark:text-[#C89D32] shrink-0" />
                    <span>Jadwal Latihan Rutin</span>
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                    {scheduleItems.length} Sesi/Minggu
                  </span>
                </div>

                {scheduleItems.length === 0 ? (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    Belum ada jadwal
                  </div>
                ) : (
                  <div className="space-y-1">
                    {scheduleItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/70 flex items-center justify-between gap-1.5 p-1.5 rounded-lg shadow-2xs text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                          <span className="text-[#354944] dark:text-[#C89D32] font-bold text-[11px] shrink-0">
                            📅 {item.day}
                          </span>
                          {item.time && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600 font-bold text-[9px] hidden sm:inline">&bull;</span>
                              <span className="bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold border border-slate-200/60 dark:border-slate-600/70 shrink-0">
                                {item.time}
                              </span>
                            </>
                          )}
                        </div>
                        {item.court && (
                          <span className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.2 rounded text-[10px] font-medium whitespace-nowrap ml-1 shrink-0">
                            ({item.court})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Kunci Jadwal */}
            {canManageClasses && classSubTab === 'active' && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
                {lockInfo.isLocked ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 cursor-not-allowed opacity-90 shadow-2xs"
                    title={`Jadwal rutin kelas ini telah dikunci sampai dengan ${formatIndonesianDate(lockInfo.untilDate)}`}
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>🔒 Terkunci s.d {formatIndonesianDate(lockInfo.untilDate)}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenGenerateSchedule && onOpenGenerateSchedule(cls)}
                    className="w-full py-1.5 bg-[#354944]/10 dark:bg-[#354944]/30 text-[#354944] dark:text-[#C89D32] border border-[#354944]/20 hover:bg-[#354944]/20 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#354944] dark:text-[#C89D32]" />
                    <span>Kunci Jadwal Lapangan</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
