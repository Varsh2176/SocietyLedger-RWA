import React from 'react';
import { AlertCircle } from 'lucide-react';

export function FormField({
  label,
  htmlFor,
  required = false,
  optional = false,
  error,
  hint,
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={htmlFor}
            className="text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
          {optional && (
            <span className="text-xs text-slate-400">Optional</span>
          )}
        </div>
      )}

      {children}

      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 font-medium" role="alert">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
