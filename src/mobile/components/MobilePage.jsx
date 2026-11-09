import React from 'react';

/**
 * MobilePage Component
 * Provides isolated container page layout for CHUVATOR Mobile Design System.
 */
export default function MobilePage({ children, className = '', style = {} }) {
  return (
    <div className={`chua-mobile-app chua-mobile-page ${className}`} style={style}>
      <div className="chua-mobile-page-content">
        {children}
      </div>
    </div>
  );
}
