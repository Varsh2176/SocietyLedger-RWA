import React from 'react';
import { Clock } from 'lucide-react';
import { SummaryCard } from '../../components/common/SummaryCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTable } from '../../components/common/DataTable';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import { fundsService } from '../../services/fundsService';
import { approvalsService } from '../../services/approvalsService';
import { reconciliationService } from '../../services/reconciliationService';
import { transactionsService } from '../../services/transactionsService';
import { formatINR, formatDate, getStatusConfig } from '../../utils/formatters';
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

const TREASURER_LINKS = [
  { to: '/funds', label: 'Funds', detail: 'Open current fund balances' },
  { to: '/transactions', label: 'Transactions', detail: 'Open the posted ledger' },
  { to: '/reports', label: 'Reports', detail: 'Open period income and expenditure' },
  { to: '/reconciliation', label: 'Reconciliation', detail: 'Open bank reconciliation sessions' },
];

export function TreasurerDashboard() {
  const { user, role } = useAuth();
  const [period, setPeriod] = React.useState('current_month');
  const { loading, error, live, data, reload } = useDashboardData(async () => {
    const [summaryResult, chartsResult, fundsResult, approvalsResult, reconciliationResult, transactionResult] = await Promise.allSettled([
      dashboardService.getSummary(period),
      dashboardService.getCharts(period),
      fundsService.getFunds(),
      approvalsService.getApprovals(),
      reconciliationService.getReconciliations(),
      transactionsService.getTransactions({ limit: 5, sortKey: 'date', sortOrder: 'desc' }),
    ]);
    const summary = settledValue(summaryResult);
    const charts = settledValue(chartsResult);
    if (!summary.ok || !charts.ok) throw new Error('Dashboard summary is unavailable.');
    const sections = [summary, charts, settledValue(fundsResult), settledValue(approvalsResult), settledValue(reconciliationResult), settledValue(transactionResult)];
    return {
      live: sections.every((section) => section.live),
      data: {
        summary: summary.value.data,
        charts: charts.value.data,
        funds: settledValue(fundsResult),
        approvals: settledValue(approvalsResult),
        reconciliations: settledValue(reconciliationResult),
        transactions: settledValue(transactionResult),
      },
    };
  }, [period]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Treasurer Dashboard"
        description="Fund balances, posted activity, approvals, and reconciliation"
        user={user}
        role={role}
        live={live}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={reload}
        loading={loading}
      />
      {loading && <DashboardLoading message="Loading the treasurer dashboard" />}
      {error && !loading && <DashboardFailure title="Could not load the treasurer dashboard" onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FundTotalCard summary={data.summary} />
            <PostedIncomeCard summary={data.summary} />
            <PostedExpenseCard summary={data.summary} />
            <SummaryCard
              title="Pending financial approvals"
              value={numericValue(data.summary.pendingApprovalsCount)}
              icon={Clock}
              subtitle="Expense requests awaiting a decision"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            The fund total is the current balance. Posted income and posted expenses follow {data.summary.reportingPeriodLabel || 'the selected period'}.
          </p>
          <FundBalances section={data.funds} onRetry={reload} />
          <ApprovalsPanel section={data.approvals} onRetry={reload} />
          <ReconciliationPanel section={data.reconciliations} onRetry={reload} />
          <TransactionsPanel section={data.transactions} onRetry={reload} />
          <FinancialCharts charts={data.charts} summary={data.summary} />
          <QuickLinks links={TREASURER_LINKS} />
        </>
      )}
    </div>
  );
}

function FundBalances({ section, onRetry }) {
  const funds = Array.isArray(section.value?.funds) ? section.value.funds : [];
  return (
    <Panel title="Fund balances" description="Current balances. These are not the selected period's income or expenditure." to="/funds" linkLabel="Open funds">
      {!section.ok && <SectionError title="Could not load fund balances" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={funds}
          emptyTitle="No funds returned"
          emptyDescription="This society has no fund records to show."
          renderItem={(fund) => (
            <li key={fund.id || fund._id || fund.code} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">{fund.name}</p>
                <p className="text-[11px] text-slate-500">{fund.code} • {fund.status}</p>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-900">{formatINR(fund.currentBalance)}</span>
            </li>
          )}
        />
      )}
    </Panel>
  );
}

function ApprovalsPanel({ section, onRetry }) {
  const approvals = Array.isArray(section.value?.approvals) ? section.value.approvals : [];
  const pending = approvals.filter((approval) => approval.status === 'PENDING').slice(0, 5);
  return (
    <Panel title="Pending financial approvals" description="Requests that still need a treasurer or administrator decision" to="/approvals" linkLabel="Review approvals">
      {!section.ok && <SectionError title="Could not load approvals" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={pending}
          emptyTitle="No pending approvals"
          emptyDescription="There are no expense requests waiting for a decision."
          renderItem={(approval) => (
            <li key={approval.id || approval._id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">{approval.description}</p>
                <p className="text-[11px] text-slate-500">{approval.requesterName || 'Requester'} • {approval.fund}</p>
              </div>
              <span className="font-mono text-xs">{formatINR(approval.requestedAmount)}</span>
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
    <Panel title="Reconciliation status" description="Bank sessions and open discrepancies" to="/reconciliation" linkLabel="Open reconciliation">
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
                <p className="text-[11px] text-slate-500">{session.statementPeriod || 'Period not recorded'} • {session.openDiscrepanciesCount || 0} open discrepancies</p>
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

function TransactionsPanel({ section, onRetry }) {
  const rows = Array.isArray(section.value?.data) ? section.value.data : [];
  const columns = [
    { key: 'reference', header: 'Voucher', render: (row) => <span className="font-mono text-xs">{row.reference}</span> },
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'description', header: 'Particulars', render: (row) => row.description },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => formatINR(row.amount),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (row) => {
        const config = getStatusConfig(row.status);
        return <StatusBadge variant={config.variant} size="sm">{config.label}</StatusBadge>;
      },
    },
  ];
  return (
    <Panel title="Recent transactions" description="Latest vouchers returned for this society" to="/transactions" linkLabel="Open ledger">
      {!section.ok && <SectionError title="Could not load transactions" onRetry={onRetry} />}
      {section.ok && (
        <DataTable
          columns={columns}
          data={rows}
          emptyTitle="No recent transactions"
          emptyDescription="No vouchers were returned for this society."
        />
      )}
    </Panel>
  );
}
