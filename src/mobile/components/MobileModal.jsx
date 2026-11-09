import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * MobileModal Component
 * Center popup dialog for confirmation and critical alerts.
 */
export default function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  className = ''
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="chua-mobile-app chua-mobile-modal-overlay" onClick={onClose}>
      <div
        className={`chua-mobile-modal ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 my-0">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
