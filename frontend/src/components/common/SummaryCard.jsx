import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  badge,
  className = '',
  onClick,
}) {
  const isClickable = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all ${
        isClickable
          ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900'
          : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        </div>

        {Icon && (
          <div className="rounded-lg bg-slate-100 p-2.5 text-slate-700">
            <Icon size={20} aria-hidden="true" />
          </div>
        )}
      </div>

      {(subtitle || trend || badge) && (
        <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
          {trend ? (
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 ${
                  trend.isPositive === true
                    ? 'bg-emerald-50 text-emerald-700'
                    : trend.isPositive === false
                    ? 'bg-red-50 text-red-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {trend.isPositive === true && <TrendingUp size={12} />}
                {trend.isPositive === false && <TrendingDown size={12} />}
                {trend.isPositive === null && <Minus size={12} />}
                {trend.value}
              </span>
              {trend.label && <span className="text-slate-500 font-normal">{trend.label}</span>}
            </div>
          ) : subtitle ? (
            <span className="text-slate-500">{subtitle}</span>
          ) : (
            <span />
          )}

          {badge && <div>{badge}</div>}
        </div>
      )}
    </div>
  );
}
