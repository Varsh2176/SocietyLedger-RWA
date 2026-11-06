import React from 'react';

export function StatusBadge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = true,
  icon: Icon,
  className = '',
}) {
  const variants = {
    success: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    warning: {
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
    },
    danger: {
      bg: 'bg-red-50 text-red-800 border-red-200',
      dot: 'bg-red-500',
    },
    info: {
      bg: 'bg-blue-50 text-blue-800 border-blue-200',
      dot: 'bg-blue-500',
    },
    neutral: {
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-800 border-purple-200',
      dot: 'bg-purple-500',
    },
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  const selected = variants[variant] || variants.neutral;

  return (
    <span
      className={`inline-flex items-center rounded-full border ${selected.bg} ${
        sizes[size] || sizes.md
      } ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${selected.dot}`}
          aria-hidden="true"
        />
      )}
      {Icon && <Icon size={12} className="flex-shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
