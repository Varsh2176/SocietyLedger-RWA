import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Building,
  User,
  Users,
  Tag,
  Receipt,
  FileText,
  AlertCircle,
  Eye,
  X,
  ExternalLink,
  RefreshCw,
  Award,
} from 'lucide-react';
import { SummaryCard } from '../components/common/SummaryCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { FormField } from '../components/common/FormField';
import { SearchFilterToolbar } from '../components/common/SearchFilterToolbar';
import { DataTable } from '../components/common/DataTable';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { eventsService } from '../services/eventsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EVENT_STATUS } from '../services/apiContract';
import { formatINR, formatDate } from '../utils/formatters';

export function EventsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Proposal form state
  const [proposalData, setProposalData] = useState({
    title: '',
    description: '',
    date: '',
    proposedBudget: '',
    fundingSource: 'Cultural Sub-Fund & Contributions',
  });
  const [proposalErrors, setProposalErrors] = useState({});

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await eventsService.getEvents({
        search: searchTerm,
        status: statusFilter,
      });
      setEvents(res.events || []);
      setIsLiveBackend(res.isLiveBackend);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const validateProposal = () => {
    const errors = {};
    if (!proposalData.title.trim()) errors.title = 'Event title is required.';
    if (!proposalData.description.trim()) errors.description = 'Proposal description is required.';
    if (!proposalData.date) errors.date = 'Event date is required.';
    if (!proposalData.proposedBudget || isNaN(proposalData.proposedBudget) || Number(proposalData.proposedBudget) <= 0) {
      errors.proposedBudget = 'A valid positive estimated budget is required.';
    }

    setProposalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    if (!validateProposal()) return;

    setIsSubmitting(true);
    try {
      await eventsService.createProposal({
        ...proposalData,
        proposedBy: user?.name ? `${user.name} (${user.role || 'Resident'})` : 'Resident Member',
      });
      addToast({
        title: 'Event Proposal Submitted',
        message: 'Proposal registered. Awaiting Management Committee budget sanction.',
        type: 'success',
      });
      setIsProposeModalOpen(false);
      setProposalData({
        title: '',
        description: '',
        date: '',
        proposedBudget: '',
        fundingSource: 'Cultural Sub-Fund & Contributions',
      });
      fetchEvents();
    } catch (err) {
      addToast({
        title: 'Submission Failed',
        message: err.message || 'Error communicating with backend service.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEventStatusBadge = (status) => {
    switch (status) {
      case EVENT_STATUS.SETTLED:
        return <StatusBadge variant="success" size="sm">Settled</StatusBadge>;
      case EVENT_STATUS.COMPLETED:
        return <StatusBadge variant="info" size="sm">Completed</StatusBadge>;
      case EVENT_STATUS.APPROVED:
        return <StatusBadge variant="purple" size="sm">Sanctioned</StatusBadge>;
      case EVENT_STATUS.PROPOSED:
        return <StatusBadge variant="warning" size="sm">Proposed / Review</StatusBadge>;
      case EVENT_STATUS.CANCELLED:
        return <StatusBadge variant="danger" size="sm">Cancelled</StatusBadge>;
      default:
        return <StatusBadge variant="neutral" size="sm">{status}</StatusBadge>;
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Community Event & Scope',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{row.title}</div>
          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{row.description}</div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Event Date',
      width: '120px',
      render: (row) => <span className="text-xs text-slate-600 font-medium">{formatDate(row.date)}</span>,
    },
    {
      key: 'proposedBudget',
      header: 'Proposed Budget',
      align: 'right',
      width: '130px',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatINR(row.proposedBudget)}</span>
      ),
    },
    {
      key: 'approvedBudget',
      header: 'Approved Budget',
      align: 'right',
      width: '140px',
      render: (row) =>
        row.approvedBudget ? (
          <span className="font-mono text-xs font-bold text-slate-900">
            {formatINR(row.approvedBudget)}
          </span>
        ) : (
          <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded">
            Under Review
          </span>
        ),
    },
    {
      key: 'actualExpenditure',
      header: 'Actual Spent',
      align: 'right',
      width: '120px',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {row.actualExpenditure == null ? '—' : formatINR(row.actualExpenditure)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      width: '140px',
      render: (row) => getEventStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      width: '100px',
      render: (row) => (
        <Button variant="outline" size="sm" icon={Eye} onClick={() => setSelectedEvent(row)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Community Events & Governance
            </h1>
            <StatusBadge variant={isLiveBackend ? 'success' : 'neutral'} size="sm" dot={true}>
              {isLiveBackend ? 'Live Events Service' : 'Sample data — not society records'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Event budget proposals, vendor bidding comparison, payment milestones, and post-event settlement
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="md" icon={RefreshCw} onClick={fetchEvents}>
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => setIsProposeModalOpen(true)}
          >
            Propose Event
          </Button>
        </div>
      </div>

      {/* Main Events Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <SearchFilterToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search events by title or description..."
          filters={[
            {
              id: 'eventStatus',
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Settled', value: EVENT_STATUS.SETTLED },
                { label: 'Completed', value: EVENT_STATUS.COMPLETED },
                { label: 'Proposed', value: EVENT_STATUS.PROPOSED },
              ],
            },
          ]}
          isFiltered={searchTerm !== '' || statusFilter !== 'ALL'}
          onReset={() => {
            setSearchTerm('');
            setStatusFilter('ALL');
          }}
        />

        {isLoading ? (
          <div className="py-12">
            <LoadingState message="Loading community events and budget settlements..." />
          </div>
        ) : hasError ? (
          <ErrorState
            title="Failed to load events"
            message="Could not retrieve the event registry from the events microservice."
            onRetry={fetchEvents}
          />
        ) : (
          <DataTable
            columns={columns}
            data={events}
            emptyTitle="No community events found"
            emptyDescription="Propose a new festival, general body meeting or cultural event to begin."
          />
        )}
      </div>

      {/* Propose Event Modal */}
      {isProposeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsProposeModalOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CalendarDays size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Propose Community Event</h3>
                <p className="text-xs text-slate-500">Submit an event plan and estimated budget for sanction</p>
              </div>
            </div>

            <form onSubmit={handleCreateProposal} className="mt-4 space-y-4" noValidate>
              <FormField label="Event Title" htmlFor="evtTitle" required={true} error={proposalErrors.title}>
                <Input
                  id="evtTitle"
                  placeholder="e.g. New Year Gala & Musical Night"
                  value={proposalData.title}
                  onChange={(e) => setProposalData((p) => ({ ...p, title: e.target.value }))}
                  error={Boolean(proposalErrors.title)}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Event Date" htmlFor="evtDate" required={true} error={proposalErrors.date}>
                  <Input
                    id="evtDate"
                    type="date"
                    value={proposalData.date}
                    onChange={(e) => setProposalData((p) => ({ ...p, date: e.target.value }))}
                    error={Boolean(proposalErrors.date)}
                  />
                </FormField>

                <FormField
                  label="Proposed Budget (INR)"
                  htmlFor="evtBudget"
                  required={true}
                  error={proposalErrors.proposedBudget}
                  hint="Initial estimate for review"
                >
                  <Input
                    id="evtBudget"
                    type="number"
                    placeholder="e.g. 50000"
                    value={proposalData.proposedBudget}
                    onChange={(e) => setProposalData((p) => ({ ...p, proposedBudget: e.target.value }))}
                    error={Boolean(proposalErrors.proposedBudget)}
                  />
                </FormField>
              </div>

              <FormField label="Funding Source" htmlFor="evtFunding" required={true}>
                <Input
                  id="evtFunding"
                  placeholder="e.g. Cultural Sub-Fund or Ticket Assessment"
                  value={proposalData.fundingSource}
                  onChange={(e) => setProposalData((p) => ({ ...p, fundingSource: e.target.value }))}
                />
              </FormField>

              <FormField
                label="Detailed Description & Schedule"
                htmlFor="evtDesc"
                required={true}
                error={proposalErrors.description}
              >
                <textarea
                  id="evtDesc"
                  rows={3}
                  placeholder="Explain event activities, target resident attendance, caterers, and AV setup..."
                  value={proposalData.description}
                  onChange={(e) => setProposalData((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </FormField>

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <Button variant="outline" size="md" onClick={() => setIsProposeModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
                  Submit Proposal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Details & Settlement Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CalendarDays size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{selectedEvent.title}</h3>
                  {getEventStatusBadge(selectedEvent.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled: {formatDate(selectedEvent.date)} • Proposed By: {selectedEvent.proposedBy}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-5 text-xs">
              {/* Financial Rule: Never confuse proposed vs approved budget */}
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Proposed Budget</span>
                  <div className="text-sm font-semibold text-slate-600 mt-0.5 font-mono">
                    {formatINR(selectedEvent.proposedBudget)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Approved Sanction</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                    {selectedEvent.approvedBudget ? formatINR(selectedEvent.approvedBudget) : 'Pending Sanction'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Actual Settlement</span>
                  <div className="text-base font-bold text-blue-700 mt-0.5 font-mono">
                    {selectedEvent.actualExpenditure == null ? '—' : formatINR(selectedEvent.actualExpenditure)}
                  </div>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Proposal Scope:</span>
                <p className="text-slate-600 mt-1 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Budget Breakdown Table */}
              {selectedEvent.budgetBreakdown && selectedEvent.budgetBreakdown.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-2">Itemized Budget Breakdown:</span>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Head</th>
                          <th className="py-2 px-3 text-right">Proposed</th>
                          <th className="py-2 px-3 text-right">Approved</th>
                          <th className="py-2 px-3 text-right">Actual Spent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEvent.budgetBreakdown.map((b, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-medium text-slate-800">{b.head}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{formatINR(b.proposed)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">{formatINR(b.approved)}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">{b.actual == null ? '—' : formatINR(b.actual)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Vendor Quotations */}
              {selectedEvent.quotations && selectedEvent.quotations.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-2">Competitive Vendor Quotations:</span>
                  <div className="space-y-2">
                    {selectedEvent.quotations.map((q) => (
                      <div
                        key={q.id}
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          q.status === 'SELECTED'
                            ? 'bg-blue-50/70 border-blue-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            <span>{q.name}</span>
                            {q.status === 'SELECTED' && (
                              <span className="rounded bg-blue-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">
                                Selected Vendor
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">Ref: {q.quotationRef}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">{formatINR(q.bidAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settlement Notes */}
              {selectedEvent.settlementNotes && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900">
                  <span className="font-semibold block mb-0.5">Post-Event Settlement Summary:</span>
                  <span>{selectedEvent.settlementNotes}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <Button variant="primary" size="md" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
