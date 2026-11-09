import React from 'react';

/**
 * MobileCard Component
 * Surface card with 18px radius, subtle shadow, and touch active state.
 */
export default function MobileCard({ children, onClick, className = '', style = {} }) {
  const isClickable = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      style={style}
      className={`chua-mobile-card ${isClickable ? 'chua-mobile-card-clickable' : ''} ${className}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {children}
    </div>
  );
}
