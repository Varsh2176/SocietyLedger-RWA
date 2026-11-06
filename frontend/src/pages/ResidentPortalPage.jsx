import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Building,
  Wallet,
  Receipt,
  FileCheck,
  FileText,
  HelpCircle,
  MessageSquare,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Download,
  ShieldCheck,
  X,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Lock,
  CalendarDays,
} from 'lucide-react';
import { SummaryCard } from '../components/common/SummaryCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { FormField } from '../components/common/FormField';
import { SearchFilterToolbar } from '../components/common/SearchFilterToolbar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { residentService } from '../services/residentService';
import { documentsService } from '../services/documentsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatINR, formatDate } from '../utils/formatters.js';
import { readSocietyIdentity } from '../utils/societyIdentity';
import {
  eventShowsActualSpending,
  publishedEventStatusLabel,
  selectPublishedEvents,
} from '../utils/publishedEvents';

export function ResidentPortalPage() {
  const { user } = useAuth();
  const society = readSocietyIdentity(user);
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('transparency'); // 'transparency' | 'queries' | 'documents'

  const [transparencyData, setTransparencyData] = useState(null);
  const [queries, setQueries] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Queries Filter & Modal
  const [querySearch, setQuerySearch] = useState('');
  const [queryStatusFilter, setQueryStatusFilter] = useState('ALL');
  const [isSubmitQueryModalOpen, setIsSubmitQueryModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Query Form
  const [queryForm, setQueryForm] = useState({
    category: 'Maintenance Billing',
    subject: '',
    question: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [transRes, queryRes, docRes] = await Promise.all([
        residentService.getTransparencyData(),
        residentService.getQueries({
          search: querySearch,
          status: queryStatusFilter,
        }),
        documentsService.getDocuments({ category: 'STATUTORY_COMPLIANCE' }),
      ]);

      setTransparencyData(transRes.data);
      setQueries(queryRes.queries || []);
      setDocuments(docRes.documents || []);
      setIsLiveBackend(transRes.isLiveBackend && queryRes.isLiveBackend);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [querySearch, queryStatusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const validateQuery = () => {
    const errors = {};
    if (!queryForm.subject.trim()) errors.subject = 'Subject is required.';
    if (!queryForm.question.trim()) errors.question = 'Detailed query question is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateQuery = async (e) => {
    e.preventDefault();
    if (!validateQuery()) return;

    setIsSubmitting(true);
    try {
      await residentService.submitQuery({
        ...queryForm,
        unit: user?.apartmentNumber || 'Block A - 402',
        residentName: user?.name || 'Resident Member',
      });

      addToast({
        title: 'Clarification Query Submitted',
        message: 'Your query has been queued for the Management Committee / Treasurer review.',
        type: 'success',
      });

      setIsSubmitQueryModalOpen(false);
      setQueryForm({
        category: 'Maintenance Billing',
        subject: '',
        question: '',
      });
      fetchData();
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

  const getQueryStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED':
        return <StatusBadge variant="success" size="sm">Resolved</StatusBadge>;
      case 'ANSWERED':
        return <StatusBadge variant="info" size="sm">Committee Answered</StatusBadge>;
      case 'IN_PROGRESS':
        return <StatusBadge variant="warning" size="sm">In Review</StatusBadge>;
      case 'OPEN':
      default:
        return <StatusBadge variant="neutral" size="sm">Open</StatusBadge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Resident Dashboard
            </h1>
            <StatusBadge variant={isLiveBackend ? 'success' : 'neutral'} size="sm" dot={true}>
              {isLiveBackend ? 'Live Transparency Feed' : 'Sample data — not society records'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Open governance for apartment owners and residents
            {society.name ? ` • ${society.name}` : ''}
            {society.registrationNumber ? ` • ${society.registrationNumber}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="md" icon={RefreshCw} onClick={fetchData}>
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => setIsSubmitQueryModalOpen(true)}
          >
            Ask Committee
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('transparency')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 ${
            activeTab === 'transparency'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building size={15} />
          Published Financial Statements & Decisions
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('queries')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 ${
            activeTab === 'queries'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare size={15} />
          Clarification Queries & Q&A
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 ${
            activeTab === 'documents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={15} />
          Authorized Member Documents
        </button>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-12">
          <LoadingState message="Connecting to resident transparency repository..." />
        </div>
      )}

      {hasError && !isLoading && (
        <ErrorState
          title="Could not load resident portal"
          message="Failed to retrieve published financial disclosures."
          onRetry={fetchData}
        />
      )}

      {/* Tab 1: Transparency Disclosures */}
      {!isLoading && !hasError && activeTab === 'transparency' && transparencyData && (
        <div className="space-y-6">
          {/* Privacy & Governance Notice */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 flex-shrink-0 mt-0.5">
              <ShieldCheck size={20} />
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900 block mb-0.5">
                Published ledger disclosures
              </span>
              <span>
                Fund balances below are active published balances. Event budgets and actual spending follow the published event rules. Bank account numbers are masked.
              </span>
            </div>
          </div>

          {/* Published Fund Balances */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-2">
              <Wallet size={16} className="text-blue-600" />
              Active published fund balances
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              {transparencyData.fundBalanceDescription || 'Fund balances include active funds only.'}
              {transparencyData.fiscalYear ? ` Society fiscal year: ${transparencyData.fiscalYear}.` : ''}
            </p>
            {(transparencyData.publishedFunds || []).length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No active fund balances"
                description="Suspended and closed funds are not published in this portal."
              />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(transparencyData.publishedFunds || []).map((fund) => (
                <div key={fund.code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-mono text-[11px] font-semibold text-blue-600">{fund.code}</span>
                    {fund.isRestricted ? (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                        Ring-Fenced
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                        Operational
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 mt-2">{fund.name}</h3>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {formatINR(fund.currentBalance)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{fund.purpose}</p>
                  <div className="mt-3 text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex items-center gap-1">
                    <Lock size={10} />
                    <span>Depository: {fund.bankName || fund.bankAccountMasked || 'Designated Society Bank Account'}</span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Published events from the same transparency response */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <CalendarDays size={16} className="text-blue-600" />
              Published events
            </h2>
            <p className="text-[11px] text-slate-500">
              Approved and in-progress events show the approved budget. Actual spending is shown after an event is completed or settled.
            </p>
            {selectPublishedEvents(transparencyData.publishedEvents).length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No published events"
                description="Proposed, cancelled, and events funded by a suspended or closed fund are not published."
                className="py-8"
              />
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {selectPublishedEvents(transparencyData.publishedEvents).map((event) => {
                  const statusLabel = publishedEventStatusLabel(event.status);
                  const showActual = eventShowsActualSpending(event);
                  return (
                    <div key={event.id} className="py-3.5 space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 text-xs">{event.title}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {event.date ? formatDate(event.date) : 'Date unavailable'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                        {statusLabel ? <span>{statusLabel}</span> : null}
                        {event.fundingSource ? <span>Funded by {event.fundingSource}</span> : null}
                        {event.approvedBudget != null ? (
                          <span>Approved budget: <strong className="text-slate-800 font-mono">{formatINR(event.approvedBudget)}</strong></span>
                        ) : null}
                        {showActual ? (
                          <span>Actual spending: <strong className="text-slate-800 font-mono">{formatINR(event.actualExpenditure)}</strong></span>
                        ) : null}
                        {showActual && event.unspentBalanceRupees != null ? (
                          <span>Unspent: <strong className="text-slate-800 font-mono">{formatINR(event.unspentBalanceRupees)}</strong></span>
                        ) : null}
                      </div>
                      {showActual && event.settlementReport ? (
                        <p className="text-slate-600 leading-relaxed text-xs">{event.settlementReport}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Published Income vs. Expenditure Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Receipt size={16} className="text-blue-600" />
              Published collections and expenditure ({transparencyData.publishedIncomeExpenditure.period})
            </h2>
            <p className="text-[11px] text-slate-500">
              {transparencyData.publishedIncomeExpenditure.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-slate-500 text-[11px]">Total Resident Collections</span>
                <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                  {formatINR(transparencyData.publishedIncomeExpenditure.totalCollections)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-slate-500 text-[11px]">Operating Expenditures</span>
                <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                  {formatINR(transparencyData.publishedIncomeExpenditure.totalExpenditure)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-slate-500 text-[11px]">Net Reserve Surplus</span>
                <div className="text-base font-bold text-blue-700 font-mono mt-0.5">
                  {formatINR(transparencyData.publishedIncomeExpenditure.netOperatingSurplus)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-slate-500 text-[11px]">On-Time Collection Efficiency</span>
                <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                  {transparencyData.publishedIncomeExpenditure.collectionEfficiency}
                </div>
              </div>
            </div>
          </div>

          {/* Published Committee Resolutions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <FileCheck size={16} className="text-blue-600" />
              Published Committee Financial Resolutions & Decisions
            </h2>

            <div className="divide-y divide-slate-100 text-xs">
              {(transparencyData.publishedDecisions || []).map((dec) => (
                <div key={dec.id} className="py-3.5 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-slate-900 text-xs">{dec.title}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{formatDate(dec.date)}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs">{dec.summary}</p>
                  <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                    <span>Sanction: <strong className="text-slate-800 font-mono">{formatINR(dec.sanctionedAmount)}</strong></span>
                    <span>•</span>
                    <span>Resolution: <strong className="text-slate-700 font-mono">{dec.resolutionRef}</strong></span>
                    <span>•</span>
                    <span>Quorum: {dec.quorum}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Clarification Queries Q&A */}
      {!isLoading && !hasError && activeTab === 'queries' && (
        <div className="space-y-4">
          <SearchFilterToolbar
            searchValue={querySearch}
            onSearchChange={setQuerySearch}
            searchPlaceholder="Search questions by keyword or reference..."
            filters={[
              {
                id: 'qryStatus',
                label: 'Status',
                value: queryStatusFilter,
                onChange: setQueryStatusFilter,
                options: [
                  { label: 'All Statuses', value: 'ALL' },
                  { label: 'Resolved', value: 'RESOLVED' },
                  { label: 'Committee Answered', value: 'ANSWERED' },
                  { label: 'In Progress', value: 'IN_PROGRESS' },
                  { label: 'Open', value: 'OPEN' },
                ],
              },
            ]}
            isFiltered={querySearch !== '' || queryStatusFilter !== 'ALL'}
            onReset={() => {
              setQuerySearch('');
              setQueryStatusFilter('ALL');
            }}
          />

          <div className="space-y-3">
            {queries.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">No clarification questions match your criteria.</p>
              </div>
            ) : (
              queries.map((q) => (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{q.reference}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {q.category}
                      </span>
                      {getQueryStatusBadge(q.status)}
                    </div>
                    <span className="text-[11px] text-slate-400">Submitted: {formatDate(q.date)}</span>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{q.subject}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      "{q.question}"
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">Asked by: {q.unit}</span>
                  </div>

                  {/* Committee Formal Response */}
                  {q.response ? (
                    <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3 text-xs text-emerald-950 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] flex items-center gap-1.5 text-emerald-900">
                          <CheckCircle2 size={14} className="text-emerald-700" />
                          Official Committee Response — {q.response.answeredBy}
                        </span>
                        <span className="text-[10px] text-emerald-700">
                          {formatDate(q.response.answeredAt, { includeTime: true })}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900 leading-relaxed pt-0.5">
                        {q.response.replyText}
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 italic">
                      <Clock size={12} /> Awaiting treasurer or committee response.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Authorized Documents */}
      {!isLoading && !hasError && activeTab === 'documents' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Certified Financial Accounts & AGM Statements
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Official copies available for download by verified residents
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {documents.map((doc) => (
              <div key={doc.id} className="py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{doc.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      Certified on: {formatDate(doc.uploadedAt)} • File Size: {doc.size}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={() => documentsService.downloadDocument(doc)}
                >
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Question Modal */}
      {isSubmitQueryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setIsSubmitQueryModalOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <HelpCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Submit Financial Clarification Query</h3>
                <p className="text-xs text-slate-500">Ask the Management Committee or Treasurer regarding society expenditures</p>
              </div>
            </div>

            <form onSubmit={handleCreateQuery} className="mt-4 space-y-4 text-xs" noValidate>
              <FormField label="Query Topic" htmlFor="qryTopic" required={true}>
                <Select
                  id="qryTopic"
                  value={queryForm.category}
                  onChange={(e) => setQueryForm((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="Maintenance Billing">Maintenance Dues & Monthly Billing</option>
                  <option value="Event Budget">Event Budget & Settlement</option>
                  <option value="Vendor Procurement">Vendor Procurement & AMC Tenders</option>
                  <option value="General Reserve">Capital Reserves & Fixed Deposits</option>
                  <option value="Facility Maintenance">Lift, Power & Amenity Repairs</option>
                </Select>
              </FormField>

              <FormField
                label="Subject / Question Summary"
                htmlFor="qrySub"
                required={true}
                error={formErrors.subject}
              >
                <Input
                  id="qrySub"
                  placeholder="e.g. Inflow clarification on rooftop solar tariff credit"
                  value={queryForm.subject}
                  onChange={(e) => setQueryForm((p) => ({ ...p, subject: e.target.value }))}
                  error={Boolean(formErrors.subject)}
                />
              </FormField>

              <FormField
                label="Detailed Query Description"
                htmlFor="qryDesc"
                required={true}
                error={formErrors.question}
                hint="Include voucher references or invoice dates if applicable."
              >
                <textarea
                  id="qryDesc"
                  rows={3}
                  placeholder="Provide context and the specific clarification sought from the committee..."
                  value={queryForm.question}
                  onChange={(e) => setQueryForm((p) => ({ ...p, question: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </FormField>

              <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 border border-slate-100">
                Submitting as: <strong className="text-slate-800">{user?.name || 'Resident Member'}</strong> (Unit: {user?.apartmentNumber || 'Block A - 402'})
              </div>

              <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <Button variant="outline" size="md" onClick={() => setIsSubmitQueryModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
                  Submit Clarification
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
