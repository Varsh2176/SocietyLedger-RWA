import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export function ToastItem({ toast, onDismiss }) {
  const { id, title, message, type = 'info' } = toast;

  const typeConfig = {
    success: {
      icon: <CheckCircle2 className="text-emerald-600" size={18} />,
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/90',
    },
    error: {
      icon: <AlertCircle className="text-red-600" size={18} />,
      border: 'border-red-200',
      bg: 'bg-red-50/90',
    },
    warning: {
      icon: <AlertTriangle className="text-amber-600" size={18} />,
      border: 'border-amber-200',
      bg: 'bg-amber-50/90',
    },
    info: {
      icon: <Info className="text-blue-600" size={18} />,
      border: 'border-blue-200',
      bg: 'bg-blue-50/90',
    },
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${config.border} bg-white p-3.5 shadow-lg shadow-slate-900/5 transition-all`}
    >
      <div className="flex-shrink-0 pt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        {title && <h4 className="text-xs font-semibold text-slate-900">{title}</h4>}
        {message && <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
