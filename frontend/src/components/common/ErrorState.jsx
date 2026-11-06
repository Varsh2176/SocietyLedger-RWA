import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = 'Failed to load content',
  message = 'An unexpected error occurred while fetching information.',
  onRetry,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-3.5">
        <AlertTriangle size={24} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-600 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={RefreshCw}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
