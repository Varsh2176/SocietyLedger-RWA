import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  FileCheck,
  FileWarning,
  UserCheck,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Eye,
  Edit,
  X,
  ExternalLink,
  ChevronRight,
  Receipt,
  FileText,
  Building,
  RefreshCw,
  Info,
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
import { complianceService } from '../services/complianceService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { USER_ROLES } from '../services/apiContract';
import { formatINR, formatDate } from '../utils/formatters';

export function CompliancePage() {
  const { user, role } = useAuth();
  const { addToast } = useToast();

  const isOfficerOrAuditor =
    role === USER_ROLES.ADMIN ||
    role === USER_ROLES.TREASURER ||
    role === USER_ROLES.AUDITOR;

  const isTreasurerOrAdmin =
    role === USER_ROLES.ADMIN || role === USER_ROLES.TREASURER;

  // Active Tab Filter
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UPCOMING' | 'OVERDUE' | 'UNDER_REVIEW' | 'INCOMPLETE' | 'FILED'

  // Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  // Filter & Search Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modal States
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilingModalOpen, setIsFilingModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportData, setExportData] = useState(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    filingType: '',
    statutoryBody: '',
    financialPeriod: '',
    deadline: '',
    deadlineSource: 'Administrator Confirmed Calendar',
    category: 'TAX_DIRECT',
    notes: '',
  });

  const [filingForm, setFilingForm] = useState({
    submissionDate: new Date().toISOString().split('T')[0],
    acknowledgementReference: '',
    challanReference: '',
    challanAmount: '',
    challanDate: '',
    notes: '',
  });

  const [docForm, setDocForm] = useState({
    title: '',
    documentType: 'ACKNOWLEDGEMENT',
    fileName: '',
    fileUrl: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Compliance Dashboard & Task List
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (categoryFilter !== 'ALL') params.category = categoryFilter;

      if (activeTab === 'OVERDUE') params.overdue = 'true';
      else if (activeTab === 'FILED') params.status = 'FILED';
      else if (activeTab === 'UNDER_REVIEW') params.status = 'UNDER_REVIEW';

      const [dashRes, tasksRes] = await Promise.all([
        complianceService.getDashboard(),
        complianceService.getTasks(params),
      ]);

      setDashboardData(dashRes.data);

      let fetchedTasks = tasksRes.tasks || [];
      if (activeTab === 'INCOMPLETE') {
        fetchedTasks = fetchedTasks.filter(
          (t) => t.documentationStatus === 'INCOMPLETE'
        );
      } else if (activeTab === 'UPCOMING') {
        const now = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(now.getDate() + 30);
        fetchedTasks = fetchedTasks.filter(
          (t) =>
            t.status !== 'FILED' &&
            t.status !== 'REVISED_FILED' &&
            new Date(t.deadline) >= now &&
            new Date(t.deadline) <= thirtyDays
        );
      }

      setTasks(fetchedTasks);
      setIsLiveBackend(dashRes.isLiveBackend && tasksRes.isLiveBackend);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchQuery, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!createForm.filingType.trim()) errors.filingType = 'Filing title is required.';
    if (!createForm.statutoryBody.trim()) errors.statutoryBody = 'Statutory authority is required.';
    if (!createForm.financialPeriod.trim()) errors.financialPeriod = 'Financial period is required.';
    if (!createForm.deadline) errors.deadline = 'Filing deadline date is required.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await complianceService.createTask(createForm);
      addToast('Compliance task successfully scheduled in governance calendar.', 'success');
      setIsCreateModalOpen(false);
      setCreateForm({
        filingType: '',
        statutoryBody: '',
        financialPeriod: '',
        deadline: '',
        deadlineSource: 'Administrator Confirmed Calendar',
        category: 'TAX_DIRECT',
        notes: '',
      });
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create task.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Record Filing
  const handleRecordFiling = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!filingForm.submissionDate) errors.submissionDate = 'Submission date is required.';
    if (!filingForm.acknowledgementReference.trim()) {
      errors.acknowledgementReference = 'Acknowledgement reference code is mandatory.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const taskId = selectedTask._id || selectedTask.id;
      await complianceService.recordFiling(taskId, filingForm);
      addToast('Filing acknowledged and formally recorded in ledger.', 'success');
      setIsFilingModalOpen(false);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to record filing.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Document Attachment
  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!docForm.title.trim() || !docForm.fileName.trim()) {
      addToast('Document title and filename are required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const taskId = selectedTask._id || selectedTask.id;
      await complianceService.addDocument(taskId, docForm);
      addToast('Supporting document attached to compliance record.', 'success');
      setIsDocumentModalOpen(false);
      setDocForm({
        title: '',
        documentType: 'ACKNOWLEDGEMENT',
        fileName: '',
        fileUrl: '',
      });
      // Refresh current task details
      const updated = await complianceService.getTaskById(taskId);
      setSelectedTask(updated.task);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to attach document.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Export Summary
  const handleExport = async () => {
    try {
      const report = await complianceService.exportSummary();
      setExportData(report);
      setIsExportModalOpen(true);
    } catch {
      addToast('Failed to generate export report.', 'error');
    }
  };

  const getStatusBadge = (status, deadline) => {
    switch (status) {
      case 'FILED':
        return <StatusBadge status="APPROVED" label="Filed & Acknowledged" />;
      case 'REVISED_FILED':
        return <StatusBadge status="APPROVED" label="Revised Return Filed" />;
      case 'UNDER_REVIEW':
        return <StatusBadge status="PENDING" label="Under Auditor Review" />;
      case 'CORRECTION_REQUIRED':
        return <StatusBadge status="REJECTED" label="Correction Notice" />;
      case 'OVERDUE':
        return <StatusBadge status="REJECTED" label="Filing Overdue" />;
      case 'PENDING':
      default: {
        const isPast = deadline && new Date(deadline) < new Date();
        if (isPast) return <StatusBadge status="REJECTED" label="Overdue" />;
        return <StatusBadge status="WARNING" label="Scheduled / Pending" />;
      }
    }
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'TAX_DIRECT':
        return <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">Direct Tax (TDS / ITR)</span>;
      case 'TAX_INDIRECT':
        return <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">Indirect Tax (GST)</span>;
      case 'REGISTRAR_SOCIETIES':
        return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">Societies Registrar</span>;
      case 'SAFETY_MUNICIPAL':
        return <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">Safety & Municipal</span>;
      default:
        return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">General</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Governance Disclaimer Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Landmark className="text-blue-600 dark:text-blue-400" size={24} />
            Tax Compliance & Statutory Filing Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Governance calendar, statutory due dates, payment challans, and audited acknowledgement repository.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-1.5">
            <Download size={15} />
            Export Audit Statement
          </Button>

          {isTreasurerOrAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setFormErrors({});
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Plus size={15} />
              Schedule Compliance Task
            </Button>
          )}
        </div>
      </div>

      {/* Prominent Legal Disclaimer Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">COMPLIANCE TRACKING DISCLOSURE:</span>
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            This tracker operates strictly as an administrative and governance record-keeping tool for RWA management committees. Deadlines are configured from statutory government notifications and verified calendar sources. This system does not constitute certified legal counsel or statutory tax certification.
          </p>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <SummaryCard
          title="Upcoming Deadlines"
          value={dashboardData?.summary?.upcomingCount ?? 0}
          subtitle="Next 30 calendar days"
          icon={Calendar}
          trend={{ direction: 'neutral', label: 'Monitored' }}
        />
        <SummaryCard
          title="Overdue Tasks"
          value={dashboardData?.summary?.overdueCount ?? 0}
          subtitle="Past statutory due date"
          icon={AlertTriangle}
          trend={{
            direction: (dashboardData?.summary?.overdueCount ?? 0) > 0 ? 'down' : 'up',
            label: (dashboardData?.summary?.overdueCount ?? 0) > 0 ? 'Action required' : 'Clear',
          }}
        />
        <SummaryCard
          title="Pending Reviews"
          value={dashboardData?.summary?.pendingReviewsCount ?? 0}
          subtitle="Awaiting auditor signoff"
          icon={UserCheck}
        />
        <SummaryCard
          title="Incomplete Docs"
          value={dashboardData?.summary?.incompleteDocsCount ?? 0}
          subtitle="Challan / Ack pending"
          icon={FileWarning}
        />
        <SummaryCard
          title="Filed & Concluded"
          value={dashboardData?.summary?.completedCount ?? 0}
          subtitle="Acknowledged returns"
          icon={CheckCircle2}
        />
      </div>

      {/* 3. Filter Tabs & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Tasks' },
            { id: 'UPCOMING', label: 'Upcoming (30d)' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'UNDER_REVIEW', label: 'Under Review' },
            { id: 'INCOMPLETE', label: 'Missing Docs' },
            { id: 'FILED', label: 'Filed & Done' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search return or authority..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 w-48 sm:w-60"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="ALL">All Authorities</option>
            <option value="TAX_DIRECT">Direct Tax (TDS / ITR)</option>
            <option value="TAX_INDIRECT">Indirect Tax (GST)</option>
            <option value="REGISTRAR_SOCIETIES">Societies Registrar</option>
            <option value="SAFETY_MUNICIPAL">Safety & Municipal</option>
          </select>
        </div>
      </div>

      {/* 4. Task List & Deadline Table */}
      {isLoading ? (
        <LoadingState message="Loading statutory compliance records and deadlines..." />
      ) : hasError ? (
        <ErrorState
          title="Failed to Load Compliance Records"
          message="Could not connect to statutory compliance service."
          onRetry={fetchData}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No Compliance Tasks Found"
          message="No statutory tasks match your current filter criteria."
          icon={FileCheck}
          action={
            isTreasurerOrAdmin && (
              <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
                Schedule First Task
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Filing & Return Type</th>
                  <th className="py-3 px-4">Statutory Body & Period</th>
                  <th className="py-3 px-4">Due Date & Source</th>
                  <th className="py-3 px-4">Status & Readiness</th>
                  <th className="py-3 px-4">Proof & Acknowledgement</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => {
                  const isPast = task.deadline && new Date(task.deadline) < new Date();
                  const isFiled = task.status === 'FILED' || task.status === 'REVISED_FILED';

                  return (
                    <tr
                      key={task._id || task.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Title & Category */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {task.filingType}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {getCategoryBadge(task.category)}
                        </div>
                      </td>

                      {/* Authority & Period */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {task.statutoryBody}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Period: {task.financialPeriod}
                        </div>
                      </td>

                      {/* Due Date & Legal Source */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-semibold ${
                              isPast && !isFiled
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {formatDate(task.deadline)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Src: {task.deadlineSource || 'Admin Calendar'}
                        </div>
                      </td>

                      {/* Status & Readiness */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {getStatusBadge(task.status, task.deadline)}
                          {task.documentationStatus === 'INCOMPLETE' && !isFiled && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              • Challan / Docs Incomplete
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acknowledgement / Challan */}
                      <td className="py-3 px-4">
                        {task.acknowledgementReference || task.acknowledgementRef ? (
                          <div className="space-y-0.5">
                            <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                              Ack: {task.acknowledgementReference || task.acknowledgementRef}
                            </span>
                            {task.submissionDate && (
                              <div className="text-[10px] text-slate-500">
                                Submitted: {formatDate(task.submissionDate)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Unsubmitted Draft
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTask(task);
                              setIsDetailModalOpen(true);
                            }}
                          >
                            Details
                          </Button>

                          {isTreasurerOrAdmin && !isFiled && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSelectedTask(task);
                                setFormErrors({});
                                setFilingForm({
                                  submissionDate: new Date().toISOString().split('T')[0],
                                  acknowledgementReference: '',
                                  challanReference: task.challanReference || '',
                                  challanAmount: task.challanAmountRupees || '',
                                  challanDate: '',
                                  notes: '',
                                });
                                setIsFilingModalOpen(true);
                              }}
                            >
                              Record Filing
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL: Task Details, Documents & Chronological History */}
      {/* ============================================================ */}
      {isDetailModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Compliance Item Record
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedTask.filingType}
                </h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Status and Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl dark:bg-slate-800/50">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedTask.status, selectedTask.deadline)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Filing Due</span>
                  <div className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                    {formatDate(selectedTask.deadline)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Authority</span>
                  <div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                    {selectedTask.statutoryBody}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Period</span>
                  <div className="mt-1 font-mono text-slate-800 dark:text-slate-200">
                    {selectedTask.financialPeriod}
                  </div>
                </div>
              </div>

              {/* Challan & Ack Section if present */}
              {(selectedTask.acknowledgementReference || selectedTask.challanReference) && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-1.5">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-1.5">
                    <Receipt size={14} className="text-emerald-600" />
                    Verified Proof of Statutory Submission
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                    <div>
                      Acknowledgement Ref: <strong className="font-mono text-slate-900 dark:text-slate-100">{selectedTask.acknowledgementReference || selectedTask.acknowledgementRef}</strong>
                    </div>
                    {selectedTask.submissionDate && (
                      <div>
                        Filing Date: <strong className="text-slate-900 dark:text-slate-100">{formatDate(selectedTask.submissionDate)}</strong>
                      </div>
                    )}
                    {selectedTask.challanReference && (
                      <div>
                        Challan Reference: <strong className="font-mono text-slate-900 dark:text-slate-100">{selectedTask.challanReference}</strong>
                      </div>
                    )}
                    {selectedTask.challanAmountRupees && (
                      <div>
                        Challan Amount: <strong className="text-emerald-700 dark:text-emerald-400">{formatINR(selectedTask.challanAmountRupees)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedTask.notes && (
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Governance Notes & Instructions
                  </span>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{selectedTask.notes}</p>
                </div>
              )}

              {/* Supporting Documents Section */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-600" />
                    Attached Challans & Proof Documents ({selectedTask.supportingDocuments?.length || 0})
                  </span>
                  {isOfficerOrAuditor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDocumentModalOpen(true)}
                      className="text-[11px]"
                    >
                      + Attach Document
                    </Button>
                  )}
                </div>

                {(!selectedTask.supportingDocuments || selectedTask.supportingDocuments.length === 0) ? (
                  <p className="text-[11px] text-slate-400 italic">No supporting challans or documents uploaded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedTask.supportingDocuments.map((doc, idx) => (
                      <div key={doc._id || doc.id || idx} className="py-2 flex items-center justify-between text-[11px]">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{doc.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{doc.fileName} • Type: {doc.documentType}</div>
                        </div>
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                          >
                            View <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chronological Status Audit Trail */}
              {selectedTask.statusHistory && selectedTask.statusHistory.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-600" />
                    Chronological Lifecycle Audit Trail
                  </span>
                  <div className="space-y-2 mt-2">
                    {selectedTask.statusHistory.map((h, i) => (
                      <div key={h._id || i} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/40 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{h.action}</span>
                          <span className="text-[10px] text-slate-400">{formatDate(h.changedAt)}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{h.comments}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MODAL: Create New Compliance Task */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Calendar size={16} className="text-blue-600" />
                Schedule Statutory Compliance Task
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Filing or Return Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Quarterly TDS Statement (Form 26Q)"
                  value={createForm.filingType}
                  onChange={(e) => setCreateForm({ ...createForm, filingType: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                {formErrors.filingType && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.filingType}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Statutory Authority *</label>
                  <input
                    type="text"
                    placeholder="e.g. Income Tax Dept"
                    value={createForm.statutoryBody}
                    onChange={(e) => setCreateForm({ ...createForm, statutoryBody: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  {formErrors.statutoryBody && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.statutoryBody}</p>}
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Financial Period *</label>
                  <input
                    type="text"
                    placeholder="e.g. Q2 FY 2026-27"
                    value={createForm.financialPeriod}
                    onChange={(e) => setCreateForm({ ...createForm, financialPeriod: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  {formErrors.financialPeriod && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.financialPeriod}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Filing Due Date *</label>
                  <input
                    type="date"
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  {formErrors.deadline && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.deadline}</p>}
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Compliance Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="TAX_DIRECT">Direct Tax (TDS / ITR)</option>
                    <option value="TAX_INDIRECT">Indirect Tax (GST)</option>
                    <option value="REGISTRAR_SOCIETIES">Societies Registrar</option>
                    <option value="SAFETY_MUNICIPAL">Safety & Municipal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Statutory Deadline Source / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Income Tax Act 1961 Sec 200(3)"
                  value={createForm.deadlineSource}
                  onChange={(e) => setCreateForm({ ...createForm, deadlineSource: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Operational Notes</label>
                <textarea
                  rows={2}
                  placeholder="Supporting instructions for preparation..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Scheduling...' : 'Save Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MODAL: Record Filing with Verification Proof */}
      {/* ============================================================ */}
      {isFilingModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Receipt size={16} className="text-emerald-600" />
                Record Formal Filing Acknowledgment
              </h3>
              <button onClick={() => setIsFilingModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              Recording a return as formally filed transitions its state to FILED and marks documentation complete. You must provide a valid government submission date and verifiable acknowledgement reference.
            </p>

            <form onSubmit={handleRecordFiling} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Actual Submission Date *</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={filingForm.submissionDate}
                    onChange={(e) => setFilingForm({ ...filingForm, submissionDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  {formErrors.submissionDate && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.submissionDate}</p>}
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Acknowledgement Reference Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. TRACES-26Q-98124"
                    value={filingForm.acknowledgementReference}
                    onChange={(e) => setFilingForm({ ...filingForm, acknowledgementReference: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  {formErrors.acknowledgementReference && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.acknowledgementReference}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Challan Ref (CIN / BSR)</label>
                  <input
                    type="text"
                    placeholder="e.g. BSR-0210048-CHALLAN-9921"
                    value={filingForm.challanReference}
                    onChange={(e) => setFilingForm({ ...filingForm, challanReference: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Challan Paid Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 18500"
                    value={filingForm.challanAmount}
                    onChange={(e) => setFilingForm({ ...filingForm, challanAmount: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Filing Notes & Auditor Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Remarks on tax deducted, deposit accounts, etc."
                  value={filingForm.notes}
                  onChange={(e) => setFilingForm({ ...filingForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsFilingModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Formally Record Filing'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. MODAL: Attach Supporting Document */}
      {/* ============================================================ */}
      {isDocumentModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Upload size={16} className="text-blue-600" />
                Attach Proof Document
              </h3>
              <button onClick={() => setIsDocumentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="mt-4 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. ITNS 281 Challan Paid Receipt"
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Document Type</label>
                  <select
                    value={docForm.documentType}
                    onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="ACKNOWLEDGEMENT">Acknowledgement</option>
                    <option value="CHALLAN">Tax Challan Receipt</option>
                    <option value="RETURN_FORM">Return Form (PDF)</option>
                    <option value="SUPPORTING_SCHEDULE">Supporting Schedule</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Filename *</label>
                  <input
                    type="text"
                    placeholder="e.g. Challan_281_18500.pdf"
                    value={docForm.fileName}
                    onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Document Link / URL</label>
                <input
                  type="text"
                  placeholder="https://docs.society.internal/tax/challan.pdf"
                  value={docForm.fileUrl}
                  onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsDocumentModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  Attach Document
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 9. MODAL: Export Statutory Compliance Statement */}
      {/* ============================================================ */}
      {isExportModalOpen && exportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Landmark size={18} className="text-blue-600" />
                  Statutory Compliance Audit Statement
                </h3>
                <p className="text-[11px] text-slate-500">
                  {exportData.societyName} ({exportData.registrationNumber}) • Generated: {formatDate(exportData.generatedAt, { includeTime: true })}
                </p>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
                {exportData.disclaimer}
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl dark:border-slate-800">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
                      <th className="py-2.5 px-3">Filing Type</th>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Statutory Body</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Ack Ref</th>
                      <th className="py-2.5 px-3">Challan (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {exportData.complianceRecords?.map((rec, i) => (
                      <tr key={rec.id || i} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold">{rec.filingType}</td>
                        <td className="py-2 px-3 font-mono">{rec.financialPeriod}</td>
                        <td className="py-2 px-3">{rec.statutoryBody}</td>
                        <td className="py-2 px-3">{rec.deadline}</td>
                        <td className="py-2 px-3 font-semibold">{rec.status}</td>
                        <td className="py-2 px-3 font-mono">{rec.acknowledgementReference}</td>
                        <td className="py-2 px-3">{rec.challanAmountRupees ? formatINR(rec.challanAmountRupees) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" size="sm" onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
