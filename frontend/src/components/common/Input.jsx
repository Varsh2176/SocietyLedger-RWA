import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  {
    type = 'text',
    error = false,
    icon: Icon,
    iconPosition = 'left',
    className = '',
    disabled = false,
    ...props
  },
  ref
) {
  const baseInputStyles = 'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

  const stateStyles = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-200 text-red-900'
    : 'border-slate-300 focus:border-slate-900 focus:ring-slate-200';

  const paddingWithIcon = Icon
    ? iconPosition === 'left'
      ? 'pl-9 pr-3'
      : 'pl-3 pr-9'
    : '';

  return (
    <div className="relative w-full">
      {Icon && iconPosition === 'left' && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <Icon size={16} aria-hidden="true" />
        </div>
      )}

      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={`${baseInputStyles} ${stateStyles} ${paddingWithIcon} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />

      {Icon && iconPosition === 'right' && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          <Icon size={16} aria-hidden="true" />
        </div>
      )}
    </div>
  );
});
