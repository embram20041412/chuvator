import React from 'react';

/**
 * MobileBadge Component
 * Semantic status indicator badge.
 * Variant: 'blue' | 'emerald' | 'warning' | 'danger' | 'neutral'
 */
export default function MobileBadge({ children, variant = 'blue', icon, className = '' }) {
  const variantClass = `chua-mobile-badge-${variant}`;
  return (
    <span className={`chua-mobile-badge ${variantClass} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
