import React from 'react';
import { Clock, ShieldCheck, Users } from 'lucide-react';
import { SummaryCard } from '../../components/common/SummaryCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import { adminService } from '../../services/adminService';
import { approvalsService } from '../../services/approvalsService';
import { complianceService } from '../../services/complianceService';
import { auditService } from '../../services/auditService';
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

const ADMIN_LINKS = [
  { to: '/settings', label: 'Settings', detail: 'Residents, roles, and the invitation code' },
  { to: '/funds', label: 'Funds', detail: 'Current balances for every fund status' },
  { to: '/reports', label: 'Reports', detail: 'Posted income, expenditure, and balances' },
  { to: '/audit', label: 'Audit', detail: 'Audit logs and observations' },
];

export function AdminDashboard() {
  const { user, role } = useAuth();
  const [period, setPeriod] = React.useState('current_month');
  const { loading, error, live, data, reload } = useDashboardData(async () => {
    const [summaryResult, chartsResult, membersResult, approvalsResult, complianceResult, observationsResult] = await Promise.allSettled([
      dashboardService.getSummary(period),
      dashboardService.getCharts(period),
      adminService.getMembers(),
      approvalsService.getApprovals(),
      complianceService.getDashboard(),
      auditService.getObservations(),
    ]);
    const summary = settledValue(summaryResult);
    const charts = settledValue(chartsResult);
    if (!summary.ok || !charts.ok) {
      throw new Error('Dashboard summary is unavailable.');
    }
    return {
      live: summary.live && charts.live,
      data: {
        summary: summary.value.data,
        charts: charts.value.data,
        members: settledValue(membersResult),
        approvals: settledValue(approvalsResult),
        compliance: settledValue(complianceResult),
        observations: settledValue(observationsResult),
      },
    };
  }, [period]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Society Administrator Dashboard"
        description="Society finances, members, approvals, compliance, and audit alerts"
        user={user}
        role={role}
        live={live}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={reload}
        loading={loading}
      />
      {loading && <DashboardLoading message="Loading the administrator dashboard" />}
      {error && !loading && <DashboardFailure title="Could not load the administrator dashboard" onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FundTotalCard summary={data.summary} />
            <PostedIncomeCard summary={data.summary} />
            <PostedExpenseCard summary={data.summary} />
            <SummaryCard
              title="Pending approvals"
              value={numericValue(data.summary.pendingApprovalsCount)}
              icon={Clock}
              subtitle="Expense requests awaiting a decision"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Fund totals are current balances. Posted income and posted expenses follow {data.summary.reportingPeriodLabel || 'the selected period'}.
          </p>
          <MemberOverview section={data.members} onRetry={reload} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApprovalsPanel section={data.approvals} onRetry={reload} />
            <CompliancePanel section={data.compliance} onRetry={reload} />
          </div>
          <ObservationsPanel section={data.observations} onRetry={reload} />
          <FinancialCharts charts={data.charts} summary={data.summary} />
          <QuickLinks links={ADMIN_LINKS} />
        </>
      )}
    </div>
  );
}

function MemberOverview({ section, onRetry }) {
  return (
    <Panel title="Members and residents" description="Accounts returned by the society directory" to="/settings" linkLabel="Open settings">
      {!section.ok && <SectionError title="Could not load members" onRetry={onRetry} />}
      {section.ok && <MemberCounts members={section.value || []} />}
    </Panel>
  );
}

function MemberCounts({ members }) {
  const residents = members.filter((member) => member.role === 'Resident');
  const pending = members.filter((member) => member.verificationStatus === 'PENDING');
  const active = members.filter((member) => member.isActive);
  const counts = members.reduce((groups, member) => {
    groups[member.role] = (groups[member.role] || 0) + 1;
    return groups;
  }, {});
  if (members.length === 0) {
    return <p className="text-xs text-slate-500">No member accounts were returned.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <SummaryCard title="Member accounts" value={members.length} icon={Users} subtitle={`${active.length} active`} />
      <SummaryCard title="Residents" value={residents.length} subtitle={`${pending.length} awaiting verification`} />
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Roles</p>
        <ul className="mt-2 space-y-1">
          {Object.entries(counts).map(([role, count]) => (
            <li key={role} className="flex items-center justify-between text-xs text-slate-700">
              <span>{role}</span>
              <span className="font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ApprovalsPanel({ section, onRetry }) {
  const approvals = Array.isArray(section.value?.approvals) ? section.value.approvals : [];
  const pending = approvals.filter((approval) => approval.status === 'PENDING').slice(0, 5);
  return (
    <Panel title="Pending approvals" description="Requests still waiting for a decision" to="/approvals" linkLabel="Review approvals">
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
                <p className="text-[11px] text-slate-500">{approval.fund || 'Fund not recorded'} • {formatDate(approval.submissionDate)}</p>
              </div>
              <span className="font-mono text-xs text-slate-800">{formatINR(approval.requestedAmount)}</span>
            </li>
          )}
        />
      )}
    </Panel>
  );
}

function CompliancePanel({ section, onRetry }) {
  const summary = section.value?.data?.summary;
  return (
    <Panel title="Compliance status" description="Filing counts from the compliance register" to="/compliance" linkLabel="Open compliance">
      {!section.ok && <SectionError title="Could not load compliance" onRetry={onRetry} />}
      {section.ok && (
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard title="Overdue filings" value={numericValue(summary?.overdueCount)} icon={ShieldCheck} subtitle="Past the recorded deadline" />
          <SummaryCard title="Upcoming filings" value={numericValue(summary?.upcomingCount)} subtitle={`${numericValue(summary?.totalTasks)} tasks in the register`} />
        </div>
      )}
    </Panel>
  );
}

function ObservationsPanel({ section, onRetry }) {
  const observations = Array.isArray(section.value?.observations) ? section.value.observations : [];
  const open = observations.filter((item) => item.status !== 'RESOLVED').slice(0, 5);
  return (
    <Panel title="Audit observations" description="Open findings that still need attention" to="/audit" linkLabel="Open audit">
      {!section.ok && <SectionError title="Could not load audit observations" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={open}
          emptyTitle="No open audit observations"
          emptyDescription="There are no unresolved audit findings for this society."
          renderItem={(item) => (
            <li key={item._id || item.id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-500">{item.severity} • {item.status}</p>
              </div>
              <StatusBadge variant={item.severity === 'HIGH' || item.severity === 'CRITICAL' ? 'warning' : 'neutral'} size="sm">
                {item.status}
              </StatusBadge>
            </li>
          )}
        />
      )}
    </Panel>
  );
}
