import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileBottomSheet from './MobileBottomSheet';
import useUserAccessScope from '../../hooks/useUserAccessScope';
import App3DMobileIcon from './App3DMobileIcon';

/**
 * MobileMoreMenu Component
 * Bottom sheet drawer for additional operational modules, RBAC-filtered.
 * Uses custom 3D claymorphic icons for each operational module.
 * Scoped under .chua-mobile-app
 */
export default function MobileMoreMenu({ isOpen, onClose, userProfile }) {
  const navigate = useNavigate();
  const userAccess = useUserAccessScope(userProfile);

  const handleNavigate = (path) => {
    onClose();
    navigate(path);
  };

  const menuModules = [
    {
      id: 'events',
      title: 'Event & Turnamen',
      subtitle: 'Bagan, Skor & Sponsor',
      path: '/events',
      icon3d: 'event',
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'keuangan',
      title: 'Keuangan & Kas',
      subtitle: 'Laporan & Arus Kas',
      path: '/keuangan',
      icon3d: 'keuangan',
      show: userAccess.canAccessFinance || userAccess.isOwner || userAccess.isSuperAdmin,
    },
    {
      id: 'intelligence',
      title: 'AI Insight',
      subtitle: 'Rekomendasi Bisnis GOR',
      path: '/intelligence',
      icon3d: 'ai_insight',
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'parents',
      title: 'Wali Murid',
      subtitle: 'Portal & Tagihan SPP',
      path: '/parents',
      icon3d: 'wali_murid',
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'profil',
      title: 'Profil Identitas GOR',
      subtitle: 'Identitas, Logo & Kontak',
      path: '/pengaturan?tab=profil',
      icon3d: 'profil_gor',
      show: true,
    },
    {
      id: 'tarifs',
      title: 'Tarif Lapangan & SPP',
      subtitle: 'Master Tarif & Rekening',
      path: '/pengaturan?tab=tarif',
      icon3d: 'tarif_spp',
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'staf',
      title: 'Kelola Staf & Pelatih',
      subtitle: 'Manajemen Akses & Sesi',
      path: '/staff',
      icon3d: 'staf_pelatih',
      show: userAccess.isOwner || userAccess.isSuperAdmin,
    },
  ];

  const visibleModules = menuModules.filter((m) => m.show);

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Menu Navigasi Operasional"
    >
      <p className="text-xs text-slate-500 mb-4 -mt-2">
        Pilih modul operasional GOR yang ingin Anda kelola.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-2">
        {visibleModules.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavigate(item.path)}
            className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl flex flex-col items-start text-left transition-all active:scale-98 cursor-pointer shadow-2xs"
          >
            <div className="w-10 h-10 flex items-center justify-center mb-2 shrink-0">
              <App3DMobileIcon name={item.icon3d} className="w-7 h-7" alt={item.title} />
            </div>
            <span className="font-bold text-xs text-slate-800 line-clamp-1">
              {item.title}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
              {item.subtitle}
            </span>
          </button>
        ))}
      </div>
    </MobileBottomSheet>
  );
}

