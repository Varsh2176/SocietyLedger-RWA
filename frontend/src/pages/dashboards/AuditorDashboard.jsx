import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { SummaryCard } from '../../components/common/SummaryCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import { auditService } from '../../services/auditService';
import { reconciliationService } from '../../services/reconciliationService';
import { formatINR, formatDate } from '../../utils/formatters';
import { FinancialCharts } from './FinancialCharts';
import { settledValue, useDashboardData } from './useDashboardData';
import {
  DashboardFailure,
  DashboardHeader,
  DashboardLoading,
  FundTotalCard,
  Panel,
  PostedExpenseCard,
  PostedIncomeCard,
  QuickLinks,
  RecordList,
  SectionError,
  numericValue,
} from './dashboardShared';

const AUDITOR_LINKS = [
  { to: '/audit', label: 'Audit', detail: 'Observations and the audit log' },
  { to: '/reports', label: 'Reports', detail: 'Posted statements and fund balances' },
  { to: '/reconciliation', label: 'Reconciliation', detail: 'Sessions and open discrepancies' },
  { to: '/funds', label: 'Funds', detail: 'Read current fund balances' },
];

export function AuditorDashboard() {
  const { user, role } = useAuth();
  const [period, setPeriod] = React.useState('current_month');
  const { loading, error, live, data, reload } = useDashboardData(async () => {
    const [summaryResult, chartsResult, observationsResult, reconciliationResult, logsResult] = await Promise.allSettled([
      dashboardService.getSummary(period),
      dashboardService.getCharts(period),
      auditService.getObservations(),
      reconciliationService.getReconciliations(),
      auditService.getAuditLogs({ limit: 5 }),
    ]);
    const summary = settledValue(summaryResult);
    const charts = settledValue(chartsResult);
    if (!summary.ok || !charts.ok) throw new Error('Dashboard summary is unavailable.');
    return {
      live: [summary, charts, settledValue(observationsResult), settledValue(reconciliationResult), settledValue(logsResult)].every((section) => section.live),
      data: {
        summary: summary.value.data,
        charts: charts.value.data,
        observations: settledValue(observationsResult),
        reconciliations: settledValue(reconciliationResult),
        logs: settledValue(logsResult),
      },
    };
  }, [period]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Auditor Dashboard"
        description="Financial overview, observations, reconciliation, and audit activity"
        user={user}
        role={role}
        live={live}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={reload}
        loading={loading}
      />
      {loading && <DashboardLoading message="Loading the auditor dashboard" />}
      {error && !loading && <DashboardFailure title="Could not load the auditor dashboard" onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FundTotalCard summary={data.summary} />
            <PostedIncomeCard summary={data.summary} />
            <PostedExpenseCard summary={data.summary} />
            <SummaryCard
              title="Open audit observations"
              value={numericValue(data.summary.openAuditObservationsCount)}
              icon={AlertTriangle}
              subtitle="Findings that are not resolved"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Fund totals are current balances. Posted income and posted expenses follow {data.summary.reportingPeriodLabel || 'the selected period'}.
          </p>
          <ObservationsPanel section={data.observations} onRetry={reload} />
          <ReconciliationPanel section={data.reconciliations} onRetry={reload} />
          <AuditActivity section={data.logs} onRetry={reload} />
          <FinancialCharts charts={data.charts} summary={data.summary} fundsHref="/funds" />
          <QuickLinks links={AUDITOR_LINKS} />
        </>
      )}
    </div>
  );
}

function ObservationsPanel({ section, onRetry }) {
  const observations = Array.isArray(section.value?.observations) ? section.value.observations : [];
  const open = observations.filter((item) => item.status !== 'RESOLVED');
  return (
    <Panel title="Audit observations" description="Open findings for this society" to="/audit" linkLabel="Open audit">
      {!section.ok && <SectionError title="Could not load audit observations" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={open.slice(0, 6)}
          emptyTitle="No open audit observations"
          emptyDescription="There are no unresolved audit findings for this society."
          renderItem={(item) => (
            <li key={item._id || item.id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-500">{item.severity} • {item.category || item.status}</p>
              </div>
              <StatusBadge variant={item.status === 'OPEN' ? 'warning' : 'neutral'} size="sm">{item.status}</StatusBadge>
            </li>
          )}
        />
      )}
    </Panel>
  );
}

function ReconciliationPanel({ section, onRetry }) {
  const sessions = Array.isArray(section.value?.reconciliations) ? section.value.reconciliations : [];
  return (
    <Panel title="Reconciliation sessions" description="Sessions and their open discrepancies" to="/reconciliation" linkLabel="Open reconciliation">
      {!section.ok && <SectionError title="Could not load reconciliation" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={sessions.slice(0, 5)}
          emptyTitle="No reconciliation sessions"
          emptyDescription="No bank reconciliation session has been opened for this society."
          renderItem={(session) => (
            <li key={session.id || session._id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">{session.fund || 'Fund'}</p>
                <p className="text-[11px] text-slate-500">
                  {session.statementPeriod || 'Period not recorded'} • Difference {formatINR(session.differenceAmount)} • {session.openDiscrepanciesCount || 0} open discrepancies
                </p>
              </div>
              <StatusBadge variant={session.isFinalized ? 'success' : 'warning'} size="sm">
                {session.displayStatus || session.status}
              </StatusBadge>
            </li>
          )}
        />
      )}
    </Panel>
  );
}

function AuditActivity({ section, onRetry }) {
  const logs = Array.isArray(section.value?.logs) ? section.value.logs : [];
  return (
    <Panel title="Recent audit activity" description="Latest audit-log entries for this society" to="/audit" linkLabel="Open audit log">
      {!section.ok && <SectionError title="Could not load audit activity" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={logs.slice(0, 5)}
          emptyTitle="No audit activity"
          emptyDescription="No audit-log entries were returned for this society."
          renderItem={(entry) => (
            <li key={entry.id || entry._id} className="py-3">
              <p className="text-xs font-medium text-slate-800">{entry.action}</p>
              <p className="text-[11px] text-slate-500">{entry.actor} • {formatDate(entry.timestamp)} • {entry.details}</p>
            </li>
          )}
        />
      )}
    </Panel>
  );
}
