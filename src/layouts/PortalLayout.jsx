import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * PortalLayout - Dedicated isolated mobile-first layout for Portal Wali Murid
 * Max-width: 480px, centered on screen with dark background around it.
 * Strictly isolated: no ERP sidebar, admin header, or tenant management nav.
 */
export default function PortalLayout() {
  return (
    <div className="min-h-screen bg-slate-900 sm:bg-slate-950 flex justify-center items-start sm:py-6 sm:px-4 font-sans antialiased text-slate-800">
      <div className="w-full max-w-[480px] mx-auto min-h-screen sm:min-h-[85vh] bg-slate-50 sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative border border-slate-800/40">
        <Outlet />
      </div>
    </div>
  );
}
