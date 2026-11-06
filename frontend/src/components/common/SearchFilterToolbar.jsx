import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Select } from './Select';
import { Button } from './Button';

export function SearchFilterToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [], // Array of { id, label, value, onChange, options: [{ label, value }] }
  onReset,
  isFiltered = false,
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {/* Search and Filters Left Group */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {onSearchChange && (
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Dynamic Select Filters */}
        {filters.map((filter) => (
          <div key={filter.id} className="min-w-[140px]">
            <Select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="text-xs py-2 bg-white"
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        ))}

        {/* Reset Filter Button */}
        {isFiltered && onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            icon={X}
            className="text-slate-600 hover:text-red-600 text-xs"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Action Buttons Right Group */}
      {children && (
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {children}
        </div>
      )}
    </div>
  );
}
