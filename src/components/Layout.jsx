import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  Building2, 
  Menu, 
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { logoutUser } from '../services/authService';
import useArenaData from '../hooks/useArenaData';
import { useTheme } from '../context/ThemeContext';
import {
  Dashboard3DIcon,
  Booking3DIcon,
  Kasir3DIcon,
  Akademi3DIcon,
  Event3DIcon,
  Keuangan3DIcon,
  AIInsight3DIcon,
  Pengaturan3DIcon
} from './icons/App3DIcons';

import useUserAccessScope from '../hooks/useUserAccessScope';

const ALL_NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', name: 'Dashboard', icon: Dashboard3DIcon },
  { path: '/booking', label: 'Booking', name: 'Booking', icon: Booking3DIcon },
  { path: '/kasir', label: 'Kasir', name: 'Kasir', icon: Kasir3DIcon },
  { path: '/akademi', label: 'Akademi', name: 'Akademi', icon: Akademi3DIcon },
  { path: '/events', label: 'Event & Turnamen', name: 'Event & Turnamen', icon: Event3DIcon },
  { path: '/keuangan', label: 'Keuangan', name: 'Keuangan', icon: Keuangan3DIcon },
  { path: '/intelligence', label: 'AI Insight', name: 'AI Insight', icon: AIInsight3DIcon },
  { path: '/pengaturan', label: 'Profil', name: 'Profil', icon: Pengaturan3DIcon },
];

export default function Layout({ userProfile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const userAccess = useUserAccessScope(userProfile);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { tenantProfile } = useArenaData(userProfile);
  const { theme, isDark, toggleTheme } = useTheme();

  const isAkademiActive = location.pathname.startsWith('/akademi');
  const currentTab = new URLSearchParams(location.search).get('tab') || 'dasbor';

  const isProfilActive = location.pathname.startsWith('/pengaturan');
  const currentProfileTab = new URLSearchParams(location.search).get('tab') || 'profil';

  // State single-open accordion: default tertutup rapat (null) saat pertama kali dimuat
  const [expandedMenu, setExpandedMenu] = useState(null); // 'akademi' | 'profil' | null
  const isAkademiOpen = expandedMenu === 'akademi';
  const isProfilOpen = expandedMenu === 'profil';

  const [academyCounts, setAcademyCounts] = useState({ students: 0, coaches: 0, classes: 0 });

  // Sinkronisasi accordion dengan navigasi rute (auto-expand saat di rute terkait, collapse saat di menu lain)
  useEffect(() => {
    if (isAkademiActive) {
      setExpandedMenu('akademi');
    } else if (isProfilActive) {
      setExpandedMenu('profil');
    } else {
      setExpandedMenu(null);
    }
  }, [location.pathname]);

  // Listen to accurate counts emitted by AcademyPage
  useEffect(() => {
    const handleCounts = (e) => {
      if (e.detail) {
        setAcademyCounts({
          students: e.detail.students ?? 0,
          coaches: e.detail.coaches ?? 0,
          classes: e.detail.classes ?? 0,
        });
      }
    };
    window.addEventListener('simak_academy_counts', handleCounts);
    return () => window.removeEventListener('simak_academy_counts', handleCounts);
  }, []);

  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  // On-demand Supabase counts
  useEffect(() => {
    if (!tenantId) return;

    const fetchCounts = async () => {
      try {
        const activeAcId = localStorage.getItem('activeAcademyId');
        let studQuery = supabase.from('students').select('id, academy_id').eq('tenant_id', tenantId);
        let coachQuery = supabase.from('coaches').select('id, academy_id').eq('tenant_id', tenantId);
        let clsQuery = supabase.from('academy_classes').select('id, academy_id').eq('tenant_id', tenantId);

        if (activeAcId) {
          studQuery = studQuery.eq('academy_id', activeAcId);
          coachQuery = coachQuery.eq('academy_id', activeAcId);
          clsQuery = clsQuery.eq('academy_id', activeAcId);
        }

        const [sRes, cRes, clRes] = await Promise.all([studQuery, coachQuery, clsQuery]);
        setAcademyCounts((prev) => ({
          students: sRes.data?.length ?? prev.students,
          coaches: cRes.data?.length ?? prev.coaches,
          classes: clRes.data?.length ?? prev.classes,
        }));
      } catch (err) {
        console.warn('Failed to fetch academy counts from Supabase:', err);
      }
    };

    fetchCounts();
    window.addEventListener('simak_refresh_arena_data', fetchCounts);
    return () => window.removeEventListener('simak_refresh_arena_data', fetchCounts);
  }, [tenantId]);

  const rawAcademySubMenuItems = [
    { id: 'dasbor', label: 'Dasbor & Laporan', path: '/akademi?tab=dasbor', count: null },
    { id: 'siswa', label: 'Siswa & SPP', path: '/akademi?tab=siswa', count: academyCounts.students },
    { id: 'pelatih', label: 'Pelatih', path: '/akademi?tab=pelatih', count: academyCounts.coaches },
    { id: 'kelas', label: 'Kelas & Kelompok', path: '/akademi?tab=kelas', count: academyCounts.classes },
    { id: 'presensi', label: 'Presensi & Evaluasi', path: '/akademi?tab=presensi', count: null },
  ];

  // Jika pelatih (coach), tampilkan hanya Kelas & Kelompok serta Presensi & Evaluasi
  const academySubMenuItems = rawAcademySubMenuItems.filter((sub) => {
    if (userAccess.isCoachOnly) {
      return sub.id === 'kelas' || sub.id === 'presensi';
    }
    return true;
  });

  const profileSubMenuItems = [
    { id: 'profil', label: 'Profil Identitas GOR', path: '/pengaturan?tab=profil' },
    { id: 'pembayaran', label: 'Rekening & QRIS', path: '/pengaturan?tab=pembayaran' },
    { id: 'spp_struk', label: 'Tagihan SPP & Struk', path: '/pengaturan?tab=spp_struk' },
    { id: 'tarif', label: 'Tarif Lapangan', path: '/pengaturan?tab=tarif' },
    { id: 'master_pricing', label: 'Master Tarif Akademi', path: '/pengaturan?tab=master_pricing' },
    { id: 'staf', label: 'Kelola Staf & Pelatih', path: '/pengaturan?tab=staf' },
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const tenant = tenantProfile || userProfile?.tenant;
  const tenantName = tenant?.name || 'TAWANG FOOTBALL CLUB';
  const tenantLogo = tenant?.logoUrl || '';
  const tenantPhone = tenant?.whatsappNumber || tenant?.phone || userProfile?.phone || '0856-0495-9707';
  const tenantEmail = tenant?.email || userProfile?.email || 'sheinaranajwa0@gmail.com';
  const tenantContact = tenantPhone || tenantEmail;
  
  // Format Label Role untuk Badge Sidebar
  const roleDisplay = 
    userProfile?.role === 'superadmin' ? 'Super Admin' :
    userProfile?.role === 'owner' ? 'Owner GOR' :
    userProfile?.role === 'admin' ? 'Admin Staf' :
    userAccess.isCoach ? 'Pelatih Akademi' : 'Staf';

  // Filter Menu Berdasarkan Client-Side RBAC (Pelatih HANYA melihat Akademi)
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (userAccess.isCoachOnly) {
      return item.path === '/akademi';
    }
    return true;
  });

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row font-sans text-slate-800 dark:text-slate-100 text-sm bg-[#EBF0EE] dark:bg-[#0C1412]">
      
      {/* DESKTOP SIDEBAR (>= 1024px) */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-[#354944] dark:bg-[#14211E] fixed top-3 bottom-3 left-3 z-30 rounded-3xl transition-all duration-300 select-none text-slate-200 border-l border-t border-b border-r-0 border-[#425953] dark:border-[#233531] shadow-none`}>
        {/* Sidebar Header with Toggle */}
        <div className="relative pt-4">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute right-2 top-2 z-10 p-1.5 rounded-lg text-slate-300 hover:text-[#D4A73A] hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title={isSidebarCollapsed ? "Perluas Sidebar" : "Perkecil Sidebar"}
            aria-label="Toggle Sidebar"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {!isSidebarCollapsed ? (
            <div className="flex flex-col items-center justify-center text-center w-full px-2 pt-2">
              <img
                src={tenantLogo || '/logo_2.jpg'}
                alt={tenantName}
                className="w-16 h-16 rounded-full object-cover p-0.5 border-2 border-[#C89D32] shadow-md bg-white/10 mx-auto"
                onError={(e) => { e.target.src = '/logo_2.jpg'; }}
              />
              <h2 className="text-white font-bold text-sm uppercase tracking-wider text-center mt-3 px-2 leading-tight">
                {tenantName}
              </h2>
              <p className="text-[#CBD5E1]/80 text-[11px] font-normal text-center mt-1 truncate px-3 max-w-full">
                {tenantContact}
              </p>
              <div className="border-b border-white/10 mx-4 my-4 w-[calc(100%-2rem)]" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center w-full pt-2">
              <img
                src={tenantLogo || '/logo_2.jpg'}
                alt={tenantName}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#C89D32] mx-auto shadow-sm"
                onError={(e) => { e.target.src = '/logo_2.jpg'; }}
              />
              <div className="border-b border-white/10 mx-2 my-3 w-[calc(100%-1rem)]" />
            </div>
          )}
        </div>

        {/* Sidebar Navigation (RTL Scrollbar Trick: Scrollbar on Left Side) */}
        <nav className="flex-1 overflow-y-auto overflow-x-visible rtl dir-rtl">
          <div className="ltr dir-ltr pl-3 pr-0 py-3 space-y-1.5 text-left">
            {navItems.map((item) => {
              const Icon = item.icon;

              // SPECIAL ACCORDION FOR AKADEMI
              if (item.path === '/akademi') {
                if (isSidebarCollapsed) {
                  return (
                    <NavLink
                      key={item.path}
                      to="/akademi"
                      title={item.label}
                      className={({ isActive }) =>
                        `flex items-center justify-center px-2 py-2.5 rounded-2xl text-xs transition-all duration-150 mr-3 ${
                          isActive
                            ? 'bg-[#C89D32] text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5 shrink-0 text-[#D4A73A]" />
                    </NavLink>
                  );
                }

                return (
                  <div key={item.path} className="space-y-1 pr-0">
                    <div
                      className={`flex items-center justify-between ${isSidebarCollapsed ? 'px-2 py-2.5 rounded-2xl mr-3' : 'pl-4 pr-3 py-2.5 rounded-l-full'} text-xs uppercase tracking-wider font-semibold transition-all duration-150 cursor-pointer ${
                        isAkademiActive && !isAkademiOpen
                          ? 'fluid-tab-active shadow-xs'
                          : isAkademiActive
                          ? 'text-white bg-white/10 rounded-2xl mr-3'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium mr-3'
                      }`}
                      onClick={() => {
                        if (!isAkademiActive) {
                          navigate('/akademi?tab=dasbor');
                          setExpandedMenu('akademi');
                        } else {
                          setExpandedMenu((prev) => (prev === 'akademi' ? null : 'akademi'));
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <Icon className="w-5 h-5 shrink-0 text-[#D4A73A]" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenu((prev) => (prev === 'akademi' ? null : 'akademi'));
                        }}
                        className="p-0.5 text-slate-300 hover:text-white transition-colors rounded cursor-pointer"
                        aria-label="Toggle submenu"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isAkademiOpen ? 'rotate-180' : 'rotate-0'}`} />
                      </button>
                    </div>

                    {/* Expandable Sub-Menu (Smooth CSS Grid Accordion) */}
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                        isAkademiOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-l-2 border-[#D4A73A]/40 ml-4 pl-2 space-y-1 py-1.5 pr-0">
                          {academySubMenuItems.map((sub) => {
                            const isSubActive = isAkademiActive && currentTab === sub.id;
                            return (
                              <Link
                                key={sub.id}
                                to={sub.path}
                                className={`text-xs flex items-center justify-between transition-all duration-150 ${
                                  isSubActive
                                    ? 'pl-3 pr-4 py-2 rounded-l-full fluid-tab-active font-bold shadow-xs'
                                    : 'px-3 py-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white font-medium mr-3'
                                }`}
                              >
                                <span className="truncate">{sub.label}</span>
                                {sub.count !== null && sub.count !== undefined && sub.count > 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1.5 shrink-0 ${
                                      isSubActive
                                        ? 'bg-[#354944]/15 text-[#354944] dark:bg-white/20 dark:text-white'
                                        : 'bg-white/10 text-slate-300'
                                    }`}
                                  >
                                    {sub.count}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // SPECIAL ACCORDION FOR PROFIL
              if (item.path === '/pengaturan') {
                if (isSidebarCollapsed) {
                  return (
                    <NavLink
                      key={item.path}
                      to="/pengaturan?tab=profil"
                      title={item.label}
                      className={({ isActive }) =>
                        `flex items-center justify-center px-2 py-2.5 rounded-2xl text-xs transition-all duration-150 mr-3 ${
                          isActive || isProfilActive
                            ? 'bg-[#C89D32] text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5 shrink-0 text-[#D4A73A]" />
                    </NavLink>
                  );
                }

                return (
                  <div key={item.path} className="space-y-1 pr-0">
                    <div
                      className={`flex items-center justify-between ${isSidebarCollapsed ? 'px-2 py-2.5 rounded-2xl mr-3' : 'pl-4 pr-3 py-2.5 rounded-l-full'} text-xs uppercase tracking-wider font-semibold transition-all duration-150 cursor-pointer ${
                        isProfilActive && !isProfilOpen
                          ? 'fluid-tab-active shadow-xs'
                          : isProfilActive
                          ? 'text-white bg-white/10 rounded-2xl mr-3'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium mr-3'
                      }`}
                      onClick={() => {
                        if (!isProfilActive) {
                          navigate('/pengaturan?tab=profil');
                          setExpandedMenu('profil');
                        } else {
                          setExpandedMenu((prev) => (prev === 'profil' ? null : 'profil'));
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <Icon className="w-5 h-5 shrink-0 text-[#D4A73A]" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenu((prev) => (prev === 'profil' ? null : 'profil'));
                        }}
                        className="p-0.5 text-slate-300 hover:text-white transition-colors rounded cursor-pointer"
                        aria-label="Toggle submenu"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isProfilOpen ? 'rotate-180' : 'rotate-0'}`} />
                      </button>
                    </div>

                    {/* Expandable Sub-Menu (Smooth CSS Grid Accordion) */}
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                        isProfilOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-l-2 border-[#D4A73A]/40 ml-4 pl-2 space-y-1 py-1.5 pr-0">
                          {profileSubMenuItems.map((sub) => {
                            const isSubActive = isProfilActive && currentProfileTab === sub.id;
                            return (
                              <Link
                                key={sub.id}
                                to={sub.path}
                                className={`text-xs flex items-center justify-between transition-all duration-150 ${
                                  isSubActive
                                    ? 'pl-3 pr-4 py-2 rounded-l-full fluid-tab-active font-bold shadow-xs'
                                    : 'px-3 py-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white font-medium mr-3'
                                }`}
                              >
                                <span className="truncate">{sub.label}</span>
                              </Link>
                            );
                          })}
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer text-left mr-3"
                          >
                            <LogOut className="w-3.5 h-3.5 shrink-0" />
                            <span>Keluar Sistem</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setExpandedMenu(null)}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center ${isSidebarCollapsed ? 'justify-center px-2 py-2 rounded-xl mr-2.5' : 'space-x-3 pl-3.5 pr-3 py-2 rounded-l-full'} text-xs uppercase tracking-wider font-semibold transition-all duration-150 ${
                      isActive
                        ? 'fluid-tab-active shadow-xs'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 shrink-0 text-[#D4A73A]" />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Theme Switcher & Logout Footer */}
        <div className="p-3 border-t border-[#425953] dark:border-[#233531]">
          {!isSidebarCollapsed ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-100 border border-[#425953] transition-colors cursor-pointer"
                title={isDark ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
              >
                <div className="flex items-center gap-2">
                  {isDark ? (
                    <Sun className="w-4 h-4 text-[#D4A73A] shrink-0" />
                  ) : (
                    <Moon className="w-4 h-4 text-[#D4A73A] shrink-0" />
                  )}
                  <span>{isDark ? 'Mode Gelap' : 'Mode Terang'}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4A73A]/20 text-[#D4A73A] tracking-wider">
                  {isDark ? 'DARK' : 'LIGHT'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20 bg-rose-500/10 rounded-2xl border border-rose-500/30 transition-colors cursor-pointer"
                title="Keluar dari Akun"
              >
                <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Keluar Akun</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 text-slate-100 border border-[#425953] transition-colors cursor-pointer shadow-xs"
                title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-[#D4A73A]" />
                ) : (
                  <Moon className="w-5 h-5 text-[#D4A73A]" />
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer shadow-xs"
                title="Keluar Akun"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5 text-rose-400" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE TOP APP BAR (< 1024px) */}
      <header className="flex lg:hidden sticky top-0 z-40 bg-[#354944] text-white px-4 h-14 items-center justify-between border-b border-white/10 shadow-md shrink-0">
        <div className="flex items-center space-x-2.5">
          {tenantLogo ? (
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 border-[#C89D32] shadow-2xs">
              <img src={tenantLogo} alt={tenantName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#C89D32] text-slate-900 font-black flex items-center justify-center shrink-0 border-2 border-white/20">
              {tenantName.charAt(0)}
            </div>
          )}
          <div className="overflow-hidden">
            <h1 className="font-bold text-xs text-white leading-tight truncate max-w-[180px]">{tenantName}</h1>
            <span className="text-[9px] text-[#C89D32] font-extrabold uppercase tracking-wider">{roleDisplay}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5 text-[#C89D32]" /> : <Moon className="w-5 h-5 text-[#C89D32]" />}
          </button>
        </div>
      </header>

      {/* STICKY HORIZONTAL / GRID SUB-MENU BAR FOR PROFIL (< 1024px) */}
      {isProfilActive && (
        <div className="flex lg:hidden sticky top-14 z-30 border-b border-slate-200/70 dark:border-white/10 shrink-0 bg-[#EBF0EE] dark:bg-[#0C1412] p-2">
          <div className="w-full flex overflow-x-auto no-scrollbar gap-2 py-1 px-1">
            {profileSubMenuItems.map((sub) => {
              const isSubActive = currentProfileTab === sub.id;
              return (
                <Link
                  key={sub.id}
                  to={sub.path}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    isSubActive
                      ? 'bg-[#354944] text-white border-b-2 border-[#C89D32] shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* MOBILE SLIDE-OUT MENU OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-4/5 max-w-sm bg-slate-50 z-50 p-5 flex flex-col justify-between lg:hidden shadow-2xl overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 bg-white -mx-5 -mt-5 p-5 mb-4 shadow-2xs">
                  <img src="/logo_2.jpg" alt="CHUA SPORT CORE" className="h-9 w-auto object-contain" />
                  <button 
                    onClick={() => setMobileMenuOpen(false)} 
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
                    aria-label="Tutup Menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="py-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Menu Navigasi ({roleDisplay})</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const targetPath = item.path === '/pengaturan' 
                        ? '/pengaturan?tab=profil' 
                        : (item.path === '/akademi' ? '/akademi?tab=dasbor' : item.path);

                      return (
                        <NavLink
                          key={item.path}
                          to={targetPath}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex flex-col items-center justify-center p-4 rounded-2xl bg-white border shadow-sm text-center transition-all ${
                              isActive
                                ? 'bg-blue-50 text-blue-600 border-blue-300 font-semibold ring-2 ring-blue-500/20'
                                : 'border-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`
                          }
                        >
                          <Icon className="w-7 h-7 mb-2" />
                          <span className="text-[11px] text-center font-medium leading-tight">
                            {item.name}
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>

                  {/* Profil Sub-Menu in Mobile Drawer */}
                  {isProfilActive && (
                    <div className="mt-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Sub-Menu Profil</p>
                      <div className="space-y-1">
                        {profileSubMenuItems.map((sub) => {
                          const isSubActive = currentProfileTab === sub.id;
                          return (
                            <Link
                              key={sub.id}
                              to={sub.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`rounded-lg px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                                isSubActive
                                  ? 'bg-blue-50 text-blue-700 font-semibold'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                            </Link>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer text-left"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span>Keluar Sistem</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Akademi Sub-Menu in Mobile Drawer */}
                  {isAkademiActive && (
                    <div className="mt-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Sub-Menu Akademi</p>
                      <div className="space-y-1">
                        {academySubMenuItems.map((sub) => {
                          const isSubActive = currentTab === sub.id;
                          return (
                            <Link
                              key={sub.id}
                              to={sub.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`rounded-lg px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                                isSubActive
                                  ? 'bg-blue-50 text-blue-700 font-semibold'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                              {sub.count !== null && sub.count !== undefined && sub.count > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1.5 shrink-0 ${
                                  isSubActive ? 'bg-blue-200/80 text-blue-800' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {sub.count}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3 bg-white -mx-5 -mb-5 p-5 mt-6 shadow-2xs">
                {/* Mobile Drawer Theme Toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
                    <span>{isDark ? 'Mode Gelap (Dark Mode)' : 'Mode Terang (Light Mode)'}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 tracking-wider">
                    {isDark ? 'DARK' : 'LIGHT'}
                  </span>
                </button>
                <div className="flex items-center space-x-3 px-1">
                  {userProfile?.photoURL ? (
                    <img src={userProfile.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border border-slate-200" />
                  ) : (
                    <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                      {userProfile?.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate">{userProfile?.displayName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{userProfile?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Sistem</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MOBILE BOTTOM NAVIGATION BAR (< 1024px) */}
      <nav className="flex lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#354944] dark:bg-[#111C19] rounded-t-2xl shadow-2xl border-t border-white/10 px-3 items-center justify-around">
        {/* Dasbor */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isActive ? 'text-[#C89D32] font-bold' : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <span className="text-[17px] mb-0.5">🏠</span>
          <span className="text-[10px] tracking-tight">Dasbor</span>
        </NavLink>

        {/* Booking */}
        <NavLink
          to="/booking"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isActive ? 'text-[#C89D32] font-bold' : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <span className="text-[17px] mb-0.5">📅</span>
          <span className="text-[10px] tracking-tight">Booking</span>
        </NavLink>

        {/* Kasir POS (Prominent Center Pill) */}
        <div className="flex-1 flex justify-center -mt-5">
          <NavLink
            to="/kasir"
            className="w-13 h-13 rounded-full bg-[#C89D32] hover:bg-[#B38A28] text-slate-950 font-black shadow-lg border-4 border-[#354944] flex flex-col items-center justify-center transition-transform active:scale-95 cursor-pointer"
            title="Kasir POS"
          >
            <span className="text-lg leading-none">💳</span>
            <span className="text-[9px] font-black uppercase tracking-tighter mt-0.5">POS</span>
          </NavLink>
        </div>

        {/* Akademi */}
        <NavLink
          to="/akademi?tab=dasbor"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isActive ? 'text-[#C89D32] font-bold' : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <span className="text-[17px] mb-0.5">🎓</span>
          <span className="text-[10px] tracking-tight">Akademi</span>
        </NavLink>

        {/* Lainnya (Trigger Bottom Sheet Drawer) */}
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            mobileMoreOpen ? 'text-[#C89D32] font-bold' : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <span className="text-[17px] mb-0.5">📂</span>
          <span className="text-[10px] tracking-tight">Lainnya</span>
        </button>
      </nav>

      {/* BOTTOM SHEET DRAWER FOR 'LAINNYA' (< 1024px) */}
      <AnimatePresence>
        {mobileMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMoreOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed bottom-0 inset-x-0 bg-white dark:bg-[#162320] z-50 p-5 rounded-t-3xl shadow-2xl lg:hidden max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2" />
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#354944] text-[#C89D32] flex items-center justify-center font-bold">
                    🚀
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">Menu Navigasi Tambahan</h3>
                    <p className="text-[11px] text-slate-500">Pilih modul operasional GOR &amp; AI</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/events"
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex flex-col items-center text-center transition-all shadow-2xs"
                >
                  <span className="text-2xl mb-1.5">🏆</span>
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Event &amp; Turnamen</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Bagan, Skor &amp; Sponsor</span>
                </Link>

                <Link
                  to="/keuangan"
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex flex-col items-center text-center transition-all shadow-2xs"
                >
                  <span className="text-2xl mb-1.5">💰</span>
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Keuangan &amp; Kas</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Laporan &amp; Arus Kas</span>
                </Link>

                <Link
                  to="/intelligence"
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex flex-col items-center text-center transition-all shadow-2xs"
                >
                  <span className="text-2xl mb-1.5">✨</span>
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">AI Insight</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Rekomendasi Bisnis GOR</span>
                </Link>

                <Link
                  to="/pengaturan?tab=profil"
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex flex-col items-center text-center transition-all shadow-2xs"
                >
                  <span className="text-2xl mb-1.5">⚙️</span>
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Profil &amp; Pengaturan</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Identitas &amp; Tarif</span>
                </Link>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                    {userProfile?.displayName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{userProfile?.displayName}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{userProfile?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    handleLogout();
                  }}
                  className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 h-full overflow-y-auto relative ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} transition-[margin] duration-300 min-w-0 max-w-full pb-20 lg:pb-5 pt-3 lg:pt-3.5 px-3 sm:px-4 lg:px-6`}>
        <div key={location.pathname + location.search} className="max-w-[1536px] mx-auto w-full min-w-0 animate-page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
