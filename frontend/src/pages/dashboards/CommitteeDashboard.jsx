import React from 'react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SummaryCard } from '../../components/common/SummaryCard';
import { useAuth } from '../../context/AuthContext';
import { eventsService } from '../../services/eventsService';
import { approvalsService } from '../../services/approvalsService';
import { complianceService } from '../../services/complianceService';
import { documentsService } from '../../services/documentsService';
import { formatINR, formatDate } from '../../utils/formatters';
import { settledValue, useDashboardData } from './useDashboardData';
import {
  DashboardFailure,
  DashboardHeader,
  DashboardLoading,
  Panel,
  QuickLinks,
  RecordList,
  SectionError,
  numericValue,
} from './dashboardShared';

const COMMITTEE_LINKS = [
  { to: '/events', label: 'Events', detail: 'Proposals, budgets, and event status' },
  { to: '/approvals', label: 'Approvals', detail: 'Expense requests waiting for a decision' },
  { to: '/compliance', label: 'Compliance', detail: 'Filings and supporting documents' },
  { to: '/reports', label: 'Reports', detail: 'Published financial statements' },
];

export function CommitteeDashboard() {
  const { user, role } = useAuth();
  const { loading, error, live, data, reload } = useDashboardData(async () => {
    const [eventsResult, approvalsResult, complianceResult, documentsResult] = await Promise.allSettled([
      eventsService.getEvents(),
      approvalsService.getApprovals(),
      complianceService.getDashboard(),
      documentsService.getDocuments(),
    ]);
    const events = settledValue(eventsResult);
    const approvals = settledValue(approvalsResult);
    if (!events.ok && !approvals.ok) throw new Error('Committee records are unavailable.');
    return {
      live: [events, approvals, settledValue(complianceResult), settledValue(documentsResult)].every((section) => section.live),
      data: {
        events,
        approvals,
        compliance: settledValue(complianceResult),
        documents: settledValue(documentsResult),
      },
    };
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Committee Dashboard"
        description="Event proposals, budgets, approvals, and compliance"
        user={user}
        role={role}
        live={live}
        onRefresh={reload}
        loading={loading}
      />
      {loading && <DashboardLoading message="Loading the committee dashboard" />}
      {error && !loading && <DashboardFailure title="Could not load the committee dashboard" onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <EventPanels section={data.events} onRetry={reload} />
          <ApprovalsPanel section={data.approvals} onRetry={reload} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CompliancePanel section={data.compliance} onRetry={reload} />
            <DocumentsPanel section={data.documents} onRetry={reload} />
          </div>
          <QuickLinks links={COMMITTEE_LINKS} />
        </>
      )}
    </div>
  );
}

function eventRows(section) {
  return Array.isArray(section.value?.events) ? section.value.events : [];
}

function EventPanels({ section, onRetry }) {
  if (!section.ok) {
    return (
      <Panel title="Events" description="Proposals and budgets visible to the committee">
        <SectionError title="Could not load events" onRetry={onRetry} />
      </Panel>
    );
  }
  const events = eventRows(section);
  const proposals = events.filter((event) => event.status === 'PROPOSED');
  const ongoing = events.filter((event) => event.status === 'APPROVED' || event.status === 'IN_PROGRESS');
  const recent = [...events].sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 5);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Pending proposals" value={proposals.length} subtitle="Events still awaiting sanction" />
        <SummaryCard title="Approved or in progress" value={ongoing.length} subtitle="Upcoming and ongoing events" />
        <SummaryCard title="Events returned" value={events.length} subtitle="Records visible to this role" />
      </div>
      <Panel title="Event budgets" description="Approved budgets stay visible. Actual spending appears only after completion or settlement." to="/events" linkLabel="Open events">
        <RecordList
          items={events.slice(0, 6)}
          emptyTitle="No events returned"
          emptyDescription="There are no event proposals for this society."
          renderItem={(event) => (
            <li key={event.id || event._id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">{event.title}</p>
                <p className="text-[11px] text-slate-500">{formatDate(event.date)} • {event.status}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-slate-900">{event.approvedBudget == null ? 'Budget pending' : formatINR(event.approvedBudget)}</p>
                <p className="text-[11px] text-slate-500">{event.actualExpenditure == null ? 'Actual spending not shown' : `Actual ${formatINR(event.actualExpenditure)}`}</p>
              </div>
            </li>
          )}
        />
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Pending event proposals" description="Proposals that have not been sanctioned" to="/events" linkLabel="Open events">
          <RecordList
            items={proposals.slice(0, 5)}
            emptyTitle="No pending event proposals"
            emptyDescription="There are no proposals waiting for committee review."
            renderItem={(event) => (
              <li key={event.id || event._id} className="py-3">
                <p className="text-xs font-medium text-slate-800">{event.title}</p>
                <p className="text-[11px] text-slate-500">Proposed {formatINR(event.proposedBudget)} • {event.proposedBy}</p>
              </li>
            )}
          />
        </Panel>
        <Panel title="Upcoming and ongoing events" description="Approved and in-progress events" to="/events" linkLabel="Open events">
          <RecordList
            items={ongoing.slice(0, 5)}
            emptyTitle="No upcoming events"
            emptyDescription="There are no approved or in-progress events."
            renderItem={(event) => (
              <li key={event.id || event._id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-800">{event.title}</p>
                  <p className="text-[11px] text-slate-500">{formatDate(event.date)}</p>
                </div>
                <StatusBadge variant="info" size="sm">{event.status}</StatusBadge>
              </li>
            )}
          />
        </Panel>
      </div>
      <Panel title="Recent committee activity" description="Latest events visible to the committee">
        <RecordList
          items={recent}
          emptyTitle="No recent committee activity"
          emptyDescription="Event activity will appear here when proposals are recorded."
          renderItem={(event) => (
            <li key={event.id || event._id} className="py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-800">{event.title}</p>
              <span className="text-[11px] text-slate-500">{event.status} • {formatDate(event.date)}</span>
            </li>
          )}
        />
      </Panel>
    </>
  );
}

function ApprovalsPanel({ section, onRetry }) {
  const approvals = Array.isArray(section.value?.approvals) ? section.value.approvals : [];
  const pending = approvals.filter((approval) => approval.status === 'PENDING');
  return (
    <Panel title="Pending approvals" description="Expense requests the committee can review" to="/approvals" linkLabel="Review approvals">
      {!section.ok && <SectionError title="Could not load approvals" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={pending.slice(0, 5)}
          emptyTitle="No pending approvals"
          emptyDescription="There are no expense requests waiting for a decision."
          renderItem={(approval) => (
            <li key={approval.id || approval._id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">{approval.description}</p>
                <p className="text-[11px] text-slate-500">{approval.relatedEvent || approval.fund || 'General request'}</p>
              </div>
              <span className="font-mono text-xs">{formatINR(approval.requestedAmount)}</span>
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
    <Panel title="Compliance" description="Filing counts from the compliance register" to="/compliance" linkLabel="Open compliance">
      {!section.ok && <SectionError title="Could not load compliance" onRetry={onRetry} />}
      {section.ok && (
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard title="Overdue filings" value={numericValue(summary?.overdueCount)} subtitle="Past the recorded deadline" />
          <SummaryCard title="Upcoming filings" value={numericValue(summary?.upcomingCount)} subtitle="Still inside the deadline" />
        </div>
      )}
    </Panel>
  );
}

function DocumentsPanel({ section, onRetry }) {
  const documents = Array.isArray(section.value?.documents) ? section.value.documents : [];
  return (
    <Panel title="Documents" description="Recent repository files. Open compliance to review filings." to="/compliance" linkLabel="Open compliance">
      {!section.ok && <SectionError title="Could not load documents" onRetry={onRetry} />}
      {section.ok && (
        <RecordList
          items={documents.slice(0, 5)}
          emptyTitle="No documents returned"
          emptyDescription="The document repository has no files for this society."
          renderItem={(document) => (
            <li key={document.id || document._id} className="py-3">
              <p className="text-xs font-medium text-slate-800">{document.name}</p>
              <p className="text-[11px] text-slate-500">{document.category || 'Uncategorised'} • {document.verificationStatus || 'Status unavailable'}</p>
            </li>
          )}
        />
      )}
    </Panel>
  );
}
