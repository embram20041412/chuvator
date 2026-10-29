import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Memverifikasi Otentikasi & Akses Security...' }) {
  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center text-center space-y-3 max-w-sm w-full">
        {/* New Animated Pulse Logo */}
        <img 
          src="/logo.png" 
          alt="Loading Logo" 
          className="w-36 sm:w-44 h-auto object-contain mb-4 animate-pulse drop-shadow-xs" 
        />
        
        {/* Loading Spinner & Dark Wording */}
        <div className="flex items-center justify-center space-x-2.5 text-slate-600 font-medium text-xs sm:text-sm pt-2">
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-600 shrink-0" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
