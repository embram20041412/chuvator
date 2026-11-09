import React from 'react';

/**
 * MobileAvatar Component
 * Avatar image or fallback initials circle.
 * Size: 'sm' (32px) | 'md' (44px) | 'lg' (60px)
 */
export default function MobileAvatar({ src, name = 'User', size = 'md', className = '' }) {
  const sizeClass = `chua-mobile-avatar-${size}`;
  const initial = name ? name.charAt(0).toUpperCase() : 'U';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`chua-mobile-avatar ${sizeClass} ${className}`}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className={`chua-mobile-avatar ${sizeClass} ${className}`}>
      <span>{initial}</span>
    </div>
  );
}
