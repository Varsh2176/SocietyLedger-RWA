import React from 'react';
import { FolderOpen } from 'lucide-react';

export function EmptyState({
  icon: Icon = FolderOpen,
  title = 'No records available',
  description = 'There is currently no data to display in this view.',
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3.5">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
