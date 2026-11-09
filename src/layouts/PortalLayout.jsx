import React from 'react';
import { Outlet } from 'react-router-dom';
import useMobileViewport from '../mobile/hooks/useMobileViewport';

/**
 * PortalLayout - Dedicated layout for Portal Wali Murid
 * - Mobile (< 768px): Clean edge-to-edge mobile app container.
 * - Desktop (>= 768px): Centered device frame on dark background (original implementation).
 */
export default function PortalLayout() {
  const isMobile = useMobileViewport(767);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 w-full flex flex-col font-sans antialiased text-slate-800">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 sm:bg-slate-950 flex justify-center items-start sm:py-6 sm:px-4 font-sans antialiased text-slate-800">
      <div className="w-full max-w-[480px] mx-auto min-h-screen sm:min-h-[85vh] bg-slate-50 sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative border border-slate-800/40">
        <Outlet />
      </div>
    </div>
  );
}

