import React from 'react';

/**
 * MobileHeader Component
 * Provides top bar header for mobile views with title, optional subtitle, left/right actions.
 */
export default function MobileHeader({ title, subtitle, leftAction, rightAction, className = '' }) {
  return (
    <header className={`chua-mobile-header ${className}`}>
      <div className="flex items-center gap-3">
        {leftAction}
        <div>
          <h1 className="chua-mobile-header-title">{title}</h1>
          {subtitle && <p className="chua-mobile-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
    </header>
  );
}
