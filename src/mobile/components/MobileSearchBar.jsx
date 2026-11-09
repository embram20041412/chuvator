import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * MobileSearchBar Component
 * Search field with search icon and clear button.
 */
export default function MobileSearchBar({
  value,
  onChange,
  placeholder = 'Cari...',
  onClear,
  className = ''
}) {
  return (
    <div className={`chua-mobile-search-bar ${className}`}>
      <Search className="chua-mobile-search-icon w-5 h-5" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="chua-mobile-input-field chua-mobile-search-input"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Bersihkan pencarian"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
