import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, HelpCircle, X } from 'lucide-react';
import { Button } from './Button';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary', // 'danger' | 'primary' | 'warning'
  isLoading = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const iconMap = {
    danger: <AlertCircle className="text-red-600" size={22} />,
    warning: <AlertTriangle className="text-amber-600" size={22} />,
    primary: <HelpCircle className="text-slate-800" size={22} />,
  };

  const iconBgMap = {
    danger: 'bg-red-50',
    warning: 'bg-amber-50',
    primary: 'bg-slate-100',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl transition-all z-10">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
              iconBgMap[variant] || iconBgMap.primary
            }`}
          >
            {iconMap[variant] || iconMap.primary}
          </div>

          <div className="flex-1 pt-0.5">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
              {title}
            </h3>
            <div className="mt-2 text-xs leading-relaxed text-slate-600">
              {message}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
