import React from 'react';

/**
 * MobileIconButton Component
 * Accessible touch button strictly for icon actions with min 44x44px target.
 */
export default function MobileIconButton({
  icon,
  onClick,
  ariaLabel,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`chua-mobile-btn-icon ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
