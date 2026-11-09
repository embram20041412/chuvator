import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  CreditCard, 
  GraduationCap, 
  Grid 
} from 'lucide-react';
import useUserAccessScope from '../../hooks/useUserAccessScope';

/**
 * MobileBottomNav Component
 * 5-Item Mobile Bottom Navigation Bar with prominent center POS button.
 * Scoped under .chua-mobile-app
 */
export default function MobileBottomNav({ userProfile, onOpenMore }) {
  const location = useLocation();
  const userAccess = useUserAccessScope(userProfile);

  const isHomeActive = location.pathname === '/dashboard';
  const isBookingActive = location.pathname === '/booking';
  const isKasirActive = location.pathname === '/kasir';
  const isAkademiActive = location.pathname.startsWith('/akademi');

  // If coach-only role, render simplified coach navigation
  if (userAccess.isCoachOnly) {
    return (
      <nav 
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-lg flex items-center justify-around px-4"
        style={{
          height: 'calc(var(--chua-m-bottom-nav-height) + var(--chua-m-safe-bottom))',
          paddingBottom: 'var(--chua-m-safe-bottom)',
        }}
      >
        <NavLink
          to="/akademi?tab=dasbor"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
              isActive || isAkademiActive ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 font-medium'
            }`
          }
        >
          <GraduationCap className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] tracking-tight">Akademi</span>
        </NavLink>

        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] text-slate-500 font-medium hover:text-slate-800 transition-colors"
        >
          <Grid className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] tracking-tight">Lainnya</span>
        </button>
      </nav>
    );
  }

  return (
    <nav 
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(16,29,56,0.08)] flex items-center justify-around px-2"
      style={{
        height: 'calc(var(--chua-m-bottom-nav-height) + var(--chua-m-safe-bottom))',
        paddingBottom: 'var(--chua-m-safe-bottom)',
      }}
    >
      {/* 1. Beranda */}
      <NavLink
        to="/dashboard"
        className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
          isHomeActive ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
        }`}
      >
        <Home className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Beranda</span>
      </NavLink>

      {/* 2. Booking */}
      <NavLink
        to="/booking"
        className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
          isBookingActive ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
        }`}
      >
        <Calendar className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Booking</span>
      </NavLink>

      {/* 3. Kasir POS Prominent Center Button */}
      <div className="flex-1 flex justify-center -mt-5">
        <NavLink
          to="/kasir"
          className={`w-13 h-13 rounded-full bg-[var(--chua-m-blue)] hover:bg-[var(--chua-m-blue-hover)] text-white shadow-md border-4 border-white flex flex-col items-center justify-center transition-transform active:scale-95 ${
            isKasirActive ? 'ring-2 ring-[var(--chua-m-blue)] ring-offset-2' : ''
          }`}
          title="Kasir POS"
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter mt-0.5">POS</span>
        </NavLink>
      </div>

      {/* 4. Akademi */}
      <NavLink
        to="/akademi?tab=dasbor"
        className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
          isAkademiActive ? 'text-[var(--chua-m-blue)] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
        }`}
      >
        <GraduationCap className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Akademi</span>
      </NavLink>

      {/* 5. Lainnya */}
      <button
        type="button"
        onClick={onOpenMore}
        className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] text-slate-500 hover:text-slate-800 font-medium transition-colors"
      >
        <Grid className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Lainnya</span>
      </button>
    </nav>
  );
}
