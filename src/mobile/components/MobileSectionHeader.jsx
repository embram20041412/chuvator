import React from 'react';

/**
 * MobileSectionHeader Component
 * Provides clean section title and optional action link for content groups.
 */
export default function MobileSectionHeader({ title, icon, actionText, onActionClick, className = '' }) {
  return (
    <div className={`chua-mobile-section-header ${className}`}>
      <h2 className="chua-mobile-section-title">
        {icon && <span className="inline-flex items-center shrink-0">{icon}</span>}
        <span>{title}</span>
      </h2>
      {actionText && (
        <button
          type="button"
          onClick={onActionClick}
          className="chua-mobile-section-action"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
