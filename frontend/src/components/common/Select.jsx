import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export const Select = forwardRef(function Select(
  {
    options = [],
    placeholder,
    error = false,
    className = '',
    disabled = false,
    value,
    onChange,
    children,
    ...props
  },
  ref
) {
  const baseSelectStyles = 'w-full appearance-none rounded-lg border bg-white pl-3 pr-9 py-2 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

  const stateStyles = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
    : 'border-slate-300 focus:border-slate-900 focus:ring-slate-200';

  return (
    <div className="relative w-full">
      <select
        ref={ref}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className={`${baseSelectStyles} ${stateStyles} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.length > 0
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </div>
  );
});
