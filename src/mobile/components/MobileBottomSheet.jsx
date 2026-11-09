import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * MobileBottomSheet Component
 * Bottom drawer overlay for mobile actions & dialogs with drag handle and safe area spacing.
 */
export default function MobileBottomSheet({
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
    <div className="chua-mobile-app chua-mobile-overlay" onClick={onClose}>
      <div
        className={`chua-mobile-bottom-sheet ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chua-mobile-sheet-handle" />
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 my-0">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Tutup sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
