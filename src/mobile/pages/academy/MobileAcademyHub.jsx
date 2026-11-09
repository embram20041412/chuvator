import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  ClipboardCheck, 
  LayoutDashboard,
  Award
} from 'lucide-react';
import useUserAccessScope from '../../../hooks/useUserAccessScope';
import MobileStudentManagement from '../students/MobileStudentManagement';

/**
 * MobileAcademyHub Component
 * Dedicated Mobile Navigation & Layout Host for Akademi Module.
 * Supports all 5 valid tabs: 'dasbor' | 'siswa' | 'pelatih' | 'kelas' | 'presensi'
 * Scoped strictly under .chua-mobile-app
 */
export default function MobileAcademyHub({ userProfile }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessScope = useUserAccessScope(userProfile);
  const { isCoachOnly } = accessScope;

  const validTabs = ['dasbor', 'siswa', 'pelatih', 'kelas', 'presensi'];
  const currentTabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(() => {
    if (currentTabParam && validTabs.includes(currentTabParam)) {
      if (isCoachOnly && (currentTabParam === 'dasbor' || currentTabParam === 'siswa' || currentTabParam === 'pelatih')) {
        return 'kelas';
      }
      return currentTabParam;
    }
    return isCoachOnly ? 'kelas' : 'siswa';
  });

  useEffect(() => {
    if (currentTabParam && validTabs.includes(currentTabParam)) {
      if (isCoachOnly && (currentTabParam === 'dasbor' || currentTabParam === 'siswa' || currentTabParam === 'pelatih')) {
        setActiveTab('kelas');
      } else {
        setActiveTab(currentTabParam);
      }
    }
  }, [currentTabParam, isCoachOnly]);

  const handleTabChange = (tab) => {
    if (isCoachOnly && (tab === 'dasbor' || tab === 'siswa' || tab === 'pelatih')) return;
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Tabs for Mobile Academy Module */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
        {!isCoachOnly && (
          <button
            type="button"
            onClick={() => handleTabChange('siswa')}
            className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'siswa'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Siswa</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => handleTabChange('kelas')}
          className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'kelas'
              ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Kelas</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('presensi')}
          className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'presensi'
              ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Presensi</span>
        </button>

        {!isCoachOnly && (
          <button
            type="button"
            onClick={() => handleTabChange('pelatih')}
            className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'pelatih'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Pelatih</span>
          </button>
        )}

        {!isCoachOnly && (
          <button
            type="button"
            onClick={() => handleTabChange('dasbor')}
            className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'dasbor'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Dasbor</span>
          </button>
        )}
      </div>

      {/* Main Tab Views */}
      {activeTab === 'siswa' && <MobileStudentManagement userProfile={userProfile} />}

      {activeTab === 'kelas' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--chua-m-blue)] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 my-0">Manajemen Kelas &amp; Jadwal</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto my-0">
            Daftar kelas aktif, kelompok usia, dan alokasi pelatih utama.
          </p>
        </div>
      )}

      {activeTab === 'presensi' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 my-0">Presensi &amp; Evaluasi Sesi</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto my-0">
            Pencatatan kehadiran siswa dan evaluasi teknis sesi latihan.
          </p>
        </div>
      )}

      {activeTab === 'pelatih' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 my-0">Tim Pelatih Akademi</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto my-0">
            Daftar pelatih utama, lisensi, dan spesialisasi bidang olahraga.
          </p>
        </div>
      )}

      {activeTab === 'dasbor' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 my-0">Dasbor &amp; Laporan Akademi</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto my-0">
            Ringkasan kualitatif perkembangan akademi dan statistik penerimaan SPP.
          </p>
        </div>
      )}
    </div>
  );
}
