import React, { useState } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import MobileHeader from '../components/MobileHeader';
import MobileAvatar from '../components/MobileAvatar';
import MobileBadge from '../components/MobileBadge';
import MobileBottomNav from '../components/MobileBottomNav';
import MobileMoreMenu from '../components/MobileMoreMenu';
import MobileProfileSheet from '../components/MobileProfileSheet';
import useArenaData from '../../hooks/useArenaData';
import useUserAccessScope from '../../hooks/useUserAccessScope';

/**
 * MobileAppShell Component
 * Dedicated Mobile Presentation Layout for CHUVATOR Sports Management App.
 * Strictly scoped under .chua-mobile-app
 */
export default function MobileAppShell({ userProfile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantProfile } = useArenaData(userProfile);
  const userAccess = useUserAccessScope(userProfile);

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const tenant = tenantProfile || userProfile?.tenant;
  const tenantName = tenant?.name || 'TAWANG FOOTBALL CLUB';
  const tenantLogo = tenant?.logoUrl || '';
  
  const roleDisplay = 
    userProfile?.role === 'superadmin' ? 'Super Admin' :
    userProfile?.role === 'owner' ? 'Owner GOR' :
    userProfile?.role === 'admin' ? 'Admin Staf' :
    userAccess.isCoach ? 'Pelatih Akademi' : 'Staf';

  const isProfilActive = location.pathname.startsWith('/pengaturan');
  const currentProfileTab = new URLSearchParams(location.search).get('tab') || 'profil';
  const profileSubMenuItems = [
    { id: 'profil', label: 'Profil GOR', path: '/pengaturan?tab=profil' },
    { id: 'pembayaran', label: 'Rekening & QRIS', path: '/pengaturan?tab=pembayaran' },
    { id: 'spp_struk', label: 'Struk SPP', path: '/pengaturan?tab=spp_struk' },
    { id: 'tarif', label: 'Tarif Lapangan', path: '/pengaturan?tab=tarif' },
    { id: 'master_pricing', label: 'Master Tarif', path: '/pengaturan?tab=master_pricing' },
    { id: 'staf', label: 'Kelola Staf', path: '/pengaturan?tab=staf' },
  ];

  return (
    <div className="chua-mobile-app chua-mobile-page min-h-screen bg-[var(--chua-m-bg)] text-[var(--chua-m-text-primary)]">
      {/* 1. STICKY TOP HEADER */}
      <MobileHeader
        leftAction={
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 text-left border-none bg-transparent p-0 cursor-pointer"
          >
            {tenantLogo ? (
              <img
                src={tenantLogo}
                alt={tenantName}
                className="w-9 h-9 rounded-full object-cover border-2 border-[var(--chua-m-blue)] shadow-xs shrink-0"
                onError={(e) => { e.target.src = '/logo_2.jpg'; }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[var(--chua-m-blue)] text-white font-black flex items-center justify-center shrink-0 text-sm shadow-xs">
                {tenantName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-slate-900 truncate max-w-[170px] leading-tight my-0">
                {tenantName}
              </h1>
              <span className="text-[10px] font-extrabold text-[var(--chua-m-blue)] uppercase tracking-wider block">
                {roleDisplay}
              </span>
            </div>
          </button>
        }
        rightAction={
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="p-1 rounded-full border border-slate-200 bg-white shadow-xs cursor-pointer active:scale-95 transition-transform"
            aria-label="Buka Profil"
          >
            <MobileAvatar
              src={userProfile?.photoURL}
              name={userProfile?.displayName || 'User'}
              size="sm"
            />
          </button>
        }
      />

      {/* 2. STICKY SUB-MENU TAB BAR (PROFIL) */}
      {isProfilActive && (
        <div className="sticky top-[var(--chua-m-header-height)] z-20 bg-white border-b border-slate-200 p-2 shadow-xs">
          <div className="flex overflow-x-auto no-scrollbar gap-2 px-1">
            {profileSubMenuItems.map((sub) => {
              const isSubActive = currentProfileTab === sub.id;
              return (
                <Link
                  key={sub.id}
                  to={sub.path}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    isSubActive
                      ? 'bg-[var(--chua-m-blue)] text-white border-[var(--chua-m-blue)] shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sub.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. SCROLLABLE MAIN CONTENT AREA */}
      <main className="chua-mobile-page-content pb-24">
        <Outlet />
      </main>

      {/* 5. STICKY BOTTOM NAVIGATION BAR */}
      <MobileBottomNav
        userProfile={userProfile}
        onOpenMore={() => setIsMoreOpen(true)}
      />

      {/* 6. MORE MENU BOTTOM SHEET */}
      <MobileMoreMenu
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        userProfile={userProfile}
      />

      {/* 7. PROFILE & SETTINGS BOTTOM SHEET */}
      <MobileProfileSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userProfile={userProfile}
      />
    </div>
  );
}
