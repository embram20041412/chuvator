import React from 'react';

/**
 * MobilePrimaryButton Component
 * High-intent primary action button with 48–50px touch height & feedback.
 */
export default function MobilePrimaryButton({
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
      className={`chua-mobile-btn-primary ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
