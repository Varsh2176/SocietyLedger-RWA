import React from 'react';
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';

const VARIANT_CONFIG = {
  info: {
    container: 'bg-blue-50/90 text-blue-900 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900',
    iconColor: 'text-blue-600 dark:text-blue-400',
    Icon: Info,
    dismissColor: 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50',
  },
  success: {
    container: 'bg-emerald-50/90 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
    dismissColor: 'text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
  },
  warning: {
    container: 'bg-amber-50/90 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
    dismissColor: 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/50',
  },
  error: {
    container: 'bg-rose-50/90 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900',
    iconColor: 'text-rose-600 dark:text-rose-400',
    Icon: AlertCircle,
    dismissColor: 'text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50',
  },
  neutral: {
    container: 'bg-slate-100/90 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-500 dark:text-slate-400',
    Icon: HelpCircle,
    dismissColor: 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
  },
};

/**
 * Reusable Alert Component for Governance & Financial Notifications
 */
export function Alert({
  variant = 'info',
  title,
  children,
  icon: CustomIcon,
  onClose,
  action,
  className = '',
}) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
  const IconComponent = CustomIcon || config.Icon;

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-xl border p-3.5 text-xs transition-colors ${config.container} ${className}`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${config.iconColor}`}>
        <IconComponent size={18} aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold text-xs leading-snug">{title}</h4>}
        <div className={`text-xs ${title ? 'mt-0.5' : ''} leading-relaxed opacity-90`}>
          {children}
        </div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className={`-mr-1 -mt-1 rounded-lg p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 ${config.dismissColor}`}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export default Alert;
