import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, RefreshCw } from 'lucide-react';
import { SummaryCard } from '../../components/common/SummaryCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { formatINR } from '../../utils/formatters';
import { readSocietyIdentity } from '../../utils/societyIdentity';

export function DashboardHeader({
  title,
  description,
  user,
  role,
  live,
  period,
  onPeriodChange,
  onRefresh,
  loading,
}) {
  const society = readSocietyIdentity(user);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <StatusBadge variant={live ? 'success' : 'neutral'} size="sm" dot={true}>
            {live ? 'Connected to Backend API' : 'Sample data — not society records'}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {society.label} • {description || role}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onPeriodChange && (
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-1 text-xs shadow-2xs">
            <Calendar size={14} className="text-slate-400 ml-1.5 mr-1" />
            <select
              value={period}
              onChange={(event) => onPeriodChange(event.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none pr-2 py-0.5"
              aria-label="Reporting period"
            >
              <option value="current_month">Current month</option>
              <option value="last_quarter">Previous quarter</option>
              <option value="financial_year">Financial year to date</option>
            </select>
          </div>
        )}
        <Button variant="outline" size="md" icon={RefreshCw} onClick={onRefresh} isLoading={loading}>
          Refresh
        </Button>
      </div>
    </div>
  );
}

export function DashboardLoading({ message }) {
  return (
    <div className="py-12">
      <LoadingState message={message} description="Loading the records this role is allowed to see." />
    </div>
  );
}

export function DashboardFailure({ title, onRetry }) {
  return (
    <ErrorState
      title={title}
      message="The dashboard could not retrieve this role's records. Refresh to try again."
      onRetry={onRetry}
    />
  );
}

export function Panel({ title, description, to, linkLabel, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</h2>
          {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
        </div>
        {to && (
          <Link to={to} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
            {linkLabel || 'Open'} <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function QuickLinks({ links }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300"
        >
          <span className="block text-sm font-semibold text-slate-900">{link.label}</span>
          <span className="mt-1 block text-[11px] text-slate-500">{link.detail}</span>
        </Link>
      ))}
    </div>
  );
}

export function RecordList({ items, emptyTitle, emptyDescription, renderItem }) {
  if (!items || items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <ul className="divide-y divide-slate-100">{items.map(renderItem)}</ul>;
}

export function SectionError({ title, onRetry }) {
  return (
    <ErrorState
      title={title}
      message="This section could not be loaded. The rest of the dashboard is unchanged."
      onRetry={onRetry}
    />
  );
}

export function postedIncomeTitle(summary) {
  return summary?.reportingPeriodShort
    ? `Posted income (${summary.reportingPeriodShort})`
    : 'Posted income';
}

export function postedExpenseTitle(summary) {
  return summary?.reportingPeriodShort
    ? `Posted expenses (${summary.reportingPeriodShort})`
    : 'Posted expenses';
}

export function FundTotalCard({ summary }) {
  return (
    <SummaryCard
      title="Total Available Funds"
      value={formatINR(summary?.totalAvailableFunds)}
      subtitle={summary?.fundBalanceDescription || 'Published fund balances'}
    />
  );
}

export function PostedIncomeCard({ summary }) {
  return (
    <SummaryCard
      title={postedIncomeTitle(summary)}
      value={formatINR(summary?.totalIncomeMonth)}
      subtitle={summary?.incomeExpenseDescription || 'Posted vouchers for the selected period'}
    />
  );
}

export function PostedExpenseCard({ summary }) {
  return (
    <SummaryCard
      title={postedExpenseTitle(summary)}
      value={formatINR(summary?.totalExpenseMonth)}
      subtitle={summary?.incomeExpenseDescription || 'Posted vouchers for the selected period'}
    />
  );
}

export function numericValue(value) {
  return typeof value === 'number' ? value : 'Unavailable';
}
