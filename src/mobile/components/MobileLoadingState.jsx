import React from 'react';

/**
 * MobileLoadingState Component
 * Mobile loading spinner with optional text message.
 */
export default function MobileLoadingState({ message = 'Memuat data...', className = '' }) {
  return (
    <div className={`chua-mobile-loading-state ${className}`}>
      <div className="chua-mobile-spinner" />
      {message && <p className="text-xs font-semibold text-slate-500">{message}</p>}
    </div>
  );
}
