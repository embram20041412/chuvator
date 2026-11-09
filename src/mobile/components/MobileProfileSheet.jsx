import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  Sun, 
  Moon, 
  Building2, 
  ShieldCheck, 
  User, 
  ChevronRight 
} from 'lucide-react';
import MobileBottomSheet from './MobileBottomSheet';
import MobileAvatar from './MobileAvatar';
import MobileBadge from './MobileBadge';
import { useTheme } from '../../context/ThemeContext';
import { logoutUser } from '../../services/authService';
import useArenaData from '../../hooks/useArenaData';
import useUserAccessScope from '../../hooks/useUserAccessScope';

/**
 * MobileProfileSheet Component
 * Bottom sheet for user identity, role info, theme switcher, and logout.
 * Scoped under .chua-mobile-app
 */
export default function MobileProfileSheet({ isOpen, onClose, userProfile }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { tenantProfile } = useArenaData(userProfile);
  const userAccess = useUserAccessScope(userProfile);
  const [logoutError, setLogoutError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const tenant = tenantProfile || userProfile?.tenant;
  const tenantName = tenant?.name || 'TAWANG FOOTBALL CLUB';
  const roleDisplay = 
    userProfile?.role === 'superadmin' ? 'Super Admin' :
    userProfile?.role === 'owner' ? 'Owner GOR' :
    userProfile?.role === 'admin' ? 'Admin Staf' :
    userAccess.isCoach ? 'Pelatih Akademi' : 'Staf';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logoutUser();
      onClose();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error on mobile:', err);
      setLogoutError(err?.message || 'Gagal keluar dari sesi. Silakan coba kembali.');
      setIsLoggingOut(false);
    }
  };

  const handleGoToProfile = () => {
    onClose();
    navigate('/pengaturan?tab=profil');
  };

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Akun &amp; Sesi Pengguna"
    >
      {logoutError && (
        <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl mb-3 flex items-center justify-between font-medium">
          <span>{logoutError}</span>
          <button type="button" onClick={() => setLogoutError(null)} className="font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* User Info Header */}
      <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mb-4">
        <MobileAvatar
          src={userProfile?.photoURL}
          name={userProfile?.displayName || 'User'}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-slate-800 truncate my-0">
              {userProfile?.displayName || 'Pengguna'}
            </h4>
            <MobileBadge variant="blue" className="shrink-0 text-[10px] px-2 py-0.5">
              {roleDisplay}
            </MobileBadge>
          </div>
          <p className="text-xs text-slate-500 truncate my-0.5">
            {userProfile?.email || '-'}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{tenantName}</span>
          </div>
        </div>
      </div>

      {/* Quick Settings Options */}
      <div className="space-y-2 mb-5">
        {/* Profile Link */}
        <button
          type="button"
          onClick={handleGoToProfile}
          className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-[var(--chua-m-blue)]" />
            <span>Pengaturan Profil GOR</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
            <span>Beralih Mode Tampilan</span>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
            {isDark ? 'Mode Gelap' : 'Mode Terang'}
          </span>
        </button>
      </div>

      {/* Logout Action Button */}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full h-12 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98 disabled:opacity-60"
      >
        <LogOut className="w-4 h-4 text-rose-600" />
        <span>{isLoggingOut ? 'Mengakhiri Sesi...' : 'Keluar Akun'}</span>
      </button>
    </MobileBottomSheet>
  );
}
