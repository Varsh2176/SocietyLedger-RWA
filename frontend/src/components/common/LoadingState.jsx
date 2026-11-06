import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingState({
  message = 'Loading data...',
  description,
  className = '',
  size = 'md',
}) {
  const iconSizes = {
    sm: 18,
    md: 28,
    lg: 40,
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <Loader2
        size={iconSizes[size] || iconSizes.md}
        className="animate-spin text-slate-800 mb-3"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-slate-800">{message}</p>
      {description && <p className="mt-1 text-xs text-slate-500 max-w-sm">{description}</p>}
    </div>
  );
}
