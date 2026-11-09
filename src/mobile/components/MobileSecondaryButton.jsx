import React from 'react';

/**
 * MobileSecondaryButton Component
 * Secondary action button for complementary actions.
 */
export default function MobileSecondaryButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  icon,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`chua-mobile-btn-secondary ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
