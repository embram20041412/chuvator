import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  DollarSign, 
  Sparkles, 
  Settings, 
  Users, 
  ShieldCheck,
  Building2,
  Receipt
} from 'lucide-react';
import MobileBottomSheet from './MobileBottomSheet';
import useUserAccessScope from '../../hooks/useUserAccessScope';

/**
 * MobileMoreMenu Component
 * Bottom sheet drawer for additional operational modules, RBAC-filtered.
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
      icon: Trophy,
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'keuangan',
      title: 'Keuangan & Kas',
      subtitle: 'Laporan & Arus Kas',
      path: '/keuangan',
      icon: DollarSign,
      show: userAccess.canAccessFinance || userAccess.isOwner || userAccess.isSuperAdmin,
    },
    {
      id: 'intelligence',
      title: 'AI Insight',
      subtitle: 'Rekomendasi Bisnis GOR',
      path: '/intelligence',
      icon: Sparkles,
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'parents',
      title: 'Wali Murid',
      subtitle: 'Portal & Tagihan SPP',
      path: '/parents',
      icon: Users,
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'profil',
      title: 'Profil Identitas GOR',
      subtitle: 'Identitas, Logo & Kontak',
      path: '/pengaturan?tab=profil',
      icon: Building2,
      show: true,
    },
    {
      id: 'tarifs',
      title: 'Tarif Lapangan & SPP',
      subtitle: 'Master Tarif & Rekening',
      path: '/pengaturan?tab=tarif',
      icon: Receipt,
      show: !userAccess.isCoachOnly,
    },
    {
      id: 'staf',
      title: 'Kelola Staf & Pelatih',
      subtitle: 'Manajemen Akses & Sesi',
      path: '/pengaturan?tab=staf',
      icon: ShieldCheck,
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
        {visibleModules.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.path)}
              className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex flex-col items-start text-left transition-all active:scale-98 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[var(--chua-m-surface-subtle)] text-[var(--chua-m-blue)] flex items-center justify-center mb-2">
                <Icon className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-slate-800 line-clamp-1">
                {item.title}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                {item.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </MobileBottomSheet>
  );
}
