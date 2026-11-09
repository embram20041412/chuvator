import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * MobileListItem Component
 * Touch list row item with optional left icon/avatar, title, subtitle, right element/chevron.
 */
export default function MobileListItem({
  title,
  subtitle,
  leftElement,
  rightElement,
  onClick,
  showChevron = false,
  className = ''
}) {
  const isClickable = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`chua-mobile-list-item ${isClickable ? 'chua-mobile-list-item-clickable' : ''} ${className}`}
    >
      {leftElement && <div className="shrink-0">{leftElement}</div>}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-800 truncate my-0">{title}</h4>
        {subtitle && <p className="text-xs text-slate-500 truncate my-0 mt-0.5">{subtitle}</p>}
      </div>
      {rightElement && <div className="shrink-0">{rightElement}</div>}
      {showChevron && <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 ml-1" />}
    </div>
  );
}
