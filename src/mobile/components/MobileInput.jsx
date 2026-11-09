import React from 'react';

/**
 * MobileInput Component
 * Touch input field with label, error state, helper text, and 48–50px touch height.
 */
export default function MobileInput({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  error = null,
  helperText = null,
  id,
  className = '',
  ...props
}) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className={`chua-mobile-input-wrapper ${className}`}>
      {label && (
        <label htmlFor={inputId} className="chua-mobile-input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="chua-mobile-input-field"
        style={error ? { borderColor: 'var(--chua-m-danger)' } : {}}
        {...props}
      />
      {error && <span className="text-xs font-semibold" style={{ color: 'var(--chua-m-danger)' }}>{error}</span>}
      {!error && helperText && <span className="text-xs text-slate-500">{helperText}</span>}
    </div>
  );
}
