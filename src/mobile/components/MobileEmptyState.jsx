import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * MobileEmptyState Component
 * Clean empty state illustration placeholder with title, description, and optional action.
 */
export default function MobileEmptyState({
  title = 'Belum Ada Data',
  description = 'Data tidak ditemukan atau belum ditambahkan.',
  icon,
  action,
  className = ''
}) {
  return (
    <div className={`chua-mobile-empty-state ${className}`}>
      <div className="chua-mobile-empty-icon">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}
