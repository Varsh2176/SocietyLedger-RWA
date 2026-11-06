import React from 'react';
import { Clock, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

export function PlaceholderView({
  title,
  description,
  icon: Icon,
  phase = 'Upcoming Phase',
  owningTeam,
  plannedFeatures = [],
  contractRequirement,
}) {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <Icon size={24} aria-hidden="true" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
                <StatusBadge variant="neutral" size="sm" dot={true}>
                  {phase}
                </StatusBadge>
              </div>
              <p className="mt-1 text-xs text-slate-500 max-w-2xl">{description}</p>
            </div>
          </div>

          {owningTeam && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
              <ShieldAlert size={14} className="text-blue-600 flex-shrink-0" />
              <span>Owner: <strong className="text-slate-800">{owningTeam}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Planned Specifications Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plannedFeatures.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Planned Scope & Capabilities
            </h2>
            <ul className="mt-4 space-y-2.5">
              {plannedFeatures.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {contractRequirement && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              Integration Pre-requisites
            </h2>
            <div className="mt-4 rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-xs text-slate-600 leading-relaxed">
              <p className="font-medium text-slate-800 mb-1">Pending API / Schema Alignment:</p>
              <p>{contractRequirement}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <Clock size={13} />
              <span>Implementation scheduled once teammate contracts are provided.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
