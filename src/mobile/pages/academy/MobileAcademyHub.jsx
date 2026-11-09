import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  ClipboardCheck, 
  LayoutDashboard,
  Sparkles
} from 'lucide-react';
import useUserAccessScope from '../../../hooks/useUserAccessScope';
import MobileStudentManagement from '../students/MobileStudentManagement';

/**
 * MobileAcademyHub Component
 * Dedicated Mobile Navigation & Layout Host for Akademi Module.
 * Scoped strictly under .chua-mobile-app
 */
export default function MobileAcademyHub({ userProfile }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessScope = useUserAccessScope(userProfile);
  const { isCoachOnly } = accessScope;

  // Active Tab: 'siswa' | 'kelas' | 'presensi' | 'dasbor'
  const currentTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    currentTabParam && ['siswa', 'kelas', 'presensi', 'dasbor'].includes(currentTabParam)
      ? currentTabParam
      : (isCoachOnly ? 'kelas' : 'siswa')
  );

  useEffect(() => {
    if (currentTabParam && ['siswa', 'kelas', 'presensi', 'dasbor'].includes(currentTabParam)) {
      setActiveTab(currentTabParam);
    }
  }, [currentTabParam]);

  const handleTabChange = (tab) => {
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
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'siswa'
                ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Siswa &amp; SPP</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => handleTabChange('kelas')}
          className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'kelas'
              ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Kelas &amp; Jadwal</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('presensi')}
          className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'presensi'
              ? 'bg-[var(--chua-m-navy)] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Presensi</span>
        </button>
      </div>

      {/* Main Tab View */}
      {activeTab === 'siswa' && <MobileStudentManagement userProfile={userProfile} />}

      {activeTab === 'kelas' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--chua-m-blue)] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 my-0">Jadwal Kelas Akademi</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto my-0">
            Daftar kelas dan jadwal latihan aktif dapat diakses via menu presensi atau dasbor utama.
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
            Absensi kehadiran siswa dan pencatatan evaluasi latihan per kelas.
          </p>
        </div>
      )}
    </div>
  );
}
