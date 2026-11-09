import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

/**
 * MobileToast Component
 * Top notification toast popup for mobile user feedback.
 * Variant: 'success' | 'error' | 'info'
 */
export default function MobileToast({
  isOpen,
  onClose,
  message,
  variant = 'info',
  duration = 4000
}) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  let Icon = Info;
  let iconColor = 'text-blue-400';
  if (variant === 'success') {
    Icon = CheckCircle2;
    iconColor = 'text-emerald-400';
  } else if (variant === 'error') {
    Icon = AlertCircle;
    iconColor = 'text-red-400';
  }

  return (
    <div className="chua-mobile-app chua-mobile-toast-container">
      <div className="chua-mobile-toast">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
          <span className="text-xs font-semibold">{message}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded"
          aria-label="Tutup pemberitahuan"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
