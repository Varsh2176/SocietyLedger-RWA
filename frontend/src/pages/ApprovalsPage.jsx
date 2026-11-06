import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Building,
  User,
  Receipt,
  FileText,
  AlertTriangle,
  Eye,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  X,
  CreditCard,
} from 'lucide-react';
import { SummaryCard } from '../components/common/SummaryCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { FormField } from '../components/common/FormField';
import { SearchFilterToolbar } from '../components/common/SearchFilterToolbar';
import { DataTable } from '../components/common/DataTable';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { approvalsService } from '../services/approvalsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { APPROVAL_STATUS, USER_ROLES } from '../services/apiContract';
import { formatINR, formatDate } from '../utils/formatters';

export function ApprovalsPage() {
  const { user, role } = useAuth();
  const { addToast } = useToast();

  const isSignatory =
    role === USER_ROLES.ADMIN ||
    role === USER_ROLES.TREASURER ||
    role === USER_ROLES.COMMITTEE_MEMBER;

  const [approvals, setApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [decisionModal, setDecisionModal] = useState({
    isOpen: false,
    action: null, // 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED'
    comments: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await approvalsService.getApprovals({
        search: searchTerm,
        status: statusFilter,
      });
      setApprovals(res.approvals || []);
      setIsLiveBackend(res.isLiveBackend);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleOpenDecision = (action) => {
    setDecisionModal({
      isOpen: true,
      action,
      comments: '',
    });
  };

  const handleExecuteDecision = async () => {
    if (!selectedApproval || !decisionModal.action) return;

    // Separation-of-Duties Enforcement
    if (user && user.email === selectedApproval.requesterEmail) {
      addToast({
        title: 'Separation of Duties Violation',
        message: 'Requesters are prohibited from self-approving their own expense requests.',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await approvalsService.decideApproval(selectedApproval.id, {
        action: decisionModal.action,
        comments: decisionModal.comments,
        user,
      });

      const actionLabels = {
        [APPROVAL_STATUS.APPROVED]: 'sanctioned and approved',
        [APPROVAL_STATUS.REJECTED]: 'rejected',
        [APPROVAL_STATUS.INFO_REQUESTED]: 'marked for additional vendor quotations',
      };

      addToast({
        title: 'Decision Recorded',
        message: `Expense ${selectedApproval.description} has been ${actionLabels[decisionModal.action]}.`,
        type: decisionModal.action === APPROVAL_STATUS.APPROVED ? 'success' : 'info',
      });

      setDecisionModal({ isOpen: false, action: null, comments: '' });
      setSelectedApproval(null);
      fetchApprovals();
    } catch (err) {
      addToast({
        title: 'Decision Failed',
        message: err.message || 'Error communicating with backend service.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case APPROVAL_STATUS.APPROVED:
        return <StatusBadge variant="success" size="sm">Sanctioned</StatusBadge>;
      case APPROVAL_STATUS.PENDING:
        return <StatusBadge variant="warning" size="sm">Pending Signoff</StatusBadge>;
      case APPROVAL_STATUS.REJECTED:
        return <StatusBadge variant="danger" size="sm">Rejected</StatusBadge>;
      case APPROVAL_STATUS.INFO_REQUESTED:
        return <StatusBadge variant="info" size="sm">Info Requested</StatusBadge>;
      default:
        return <StatusBadge variant="neutral" size="sm">{status}</StatusBadge>;
    }
  };

  const columns = [
    {
      key: 'description',
      header: 'Expense Description & Vendor',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{row.description}</div>
          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
            Vendor: {row.vendorName || 'Not specified'} • Requester: {row.requesterName}
          </div>
        </div>
      ),
    },
    {
      key: 'fund',
      header: 'Target Fund',
      width: '150px',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">{row.fund}</span>
      ),
    },
    {
      key: 'submissionDate',
      header: 'Submitted',
      width: '110px',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.submissionDate)}</span>,
    },
    {
      key: 'requestedAmount',
      header: 'Amount',
      align: 'right',
      width: '130px',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-900">
          {formatINR(row.requestedAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Review State',
      align: 'right',
      width: '150px',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Review',
      align: 'right',
      width: '90px',
      render: (row) => (
        <Button variant="outline" size="sm" icon={Eye} onClick={() => setSelectedApproval(row)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Expense Approvals & Governance Signoff
            </h1>
            <StatusBadge variant={isLiveBackend ? 'success' : 'neutral'} size="sm" dot={true}>
              {isLiveBackend ? 'Live Approvals Service' : 'Sample data — not society records'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Multi-stage financial sanctioning for operational payouts, capital works, and vendor settlements
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="md" icon={RefreshCw} onClick={fetchApprovals}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Approvals Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <SearchFilterToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search approvals by description, vendor or requester..."
          filters={[
            {
              id: 'apprStatus',
              label: 'Filter State',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { label: 'All Review States', value: 'ALL' },
                { label: 'Pending Signoff', value: APPROVAL_STATUS.PENDING },
                { label: 'Sanctioned', value: APPROVAL_STATUS.APPROVED },
                { label: 'Info Requested', value: APPROVAL_STATUS.INFO_REQUESTED },
                { label: 'Rejected', value: APPROVAL_STATUS.REJECTED },
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
            <LoadingState message="Fetching pending governance approvals..." />
          </div>
        ) : hasError ? (
          <ErrorState
            title="Failed to load approvals"
            message="Could not retrieve approval queue from the backend."
            onRetry={fetchApprovals}
          />
        ) : (
          <DataTable
            columns={columns}
            data={approvals}
            emptyTitle="No approvals matching criteria"
            emptyDescription="All submitted expenses have been processed by the management committee."
          />
        )}
      </div>

      {/* Review & Consequential Decision Modal */}
      {selectedApproval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedApproval(null)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CheckSquare size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedApproval.description}
                  </h3>
                  {getStatusBadge(selectedApproval.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Requested by: <strong className="text-slate-700">{selectedApproval.requesterName}</strong> on {formatDate(selectedApproval.submissionDate)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Requested Amount</span>
                  <div className="text-xl font-bold font-mono text-slate-900">
                    {formatINR(selectedApproval.requestedAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Target Fund Account</span>
                  <div className="text-xs font-semibold text-slate-800">{selectedApproval.fund}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500">Proposed Vendor:</span>
                  <p className="font-semibold text-slate-800">{selectedApproval.vendorName || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Quotation / Bill Ref:</span>
                  <p className="font-mono text-slate-800 font-semibold">{selectedApproval.quotationRef || selectedApproval.invoiceNumber || 'None'}</p>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Justification & Notes:</span>
                <p className="text-slate-600 mt-1 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                  {selectedApproval.notes}
                </p>
              </div>

              {/* Decision History Audit Trail */}
              {selectedApproval.decisionHistory && selectedApproval.decisionHistory.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1.5">Decision Audit Trail:</span>
                  <div className="space-y-2">
                    {selectedApproval.decisionHistory.map((d, idx) => (
                      <div key={idx} className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{d.decidedBy}</span>
                          <span className="text-[10px] text-slate-400">{formatDate(d.date, { includeTime: true })}</span>
                        </div>
                        <p className="text-slate-600 mt-1 text-[11px]">{d.comments}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Consequential Action Buttons for Authorized Signatories */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              {isSignatory && selectedApproval.status === APPROVAL_STATUS.PENDING ? (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleOpenDecision(APPROVAL_STATUS.REJECTED)}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDecision(APPROVAL_STATUS.INFO_REQUESTED)}
                    >
                      Request Info / Bids
                    </Button>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenDecision(APPROVAL_STATUS.APPROVED)}
                  >
                    Sanction & Approve
                  </Button>
                </>
              ) : (
                <div className="ml-auto">
                  <Button variant="primary" size="md" onClick={() => setSelectedApproval(null)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision Justification Modal */}
      {decisionModal.isOpen && selectedApproval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Consequential Decision: {decisionModal.action}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Your decision, timestamp, and digital identity will be permanently recorded in the immutable audit trail.
            </p>

            <div className="mt-4">
              <FormField
                label="Signatory Notes & Remarks"
                htmlFor="decRemarks"
                required={decisionModal.action !== APPROVAL_STATUS.APPROVED}
                hint="Explain rationale for sanction, rejection or requested additional tenders."
              >
                <textarea
                  id="decRemarks"
                  rows={3}
                  placeholder="Enter committee comments or approval resolution ref..."
                  value={decisionModal.comments}
                  onChange={(e) => setDecisionModal((p) => ({ ...p, comments: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </FormField>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="md"
                onClick={() => setDecisionModal({ isOpen: false, action: null, comments: '' })}
              >
                Cancel
              </Button>
              <Button
                variant={decisionModal.action === APPROVAL_STATUS.APPROVED ? 'primary' : 'danger'}
                size="md"
                onClick={handleExecuteDecision}
                isLoading={isSubmitting}
              >
                Confirm {decisionModal.action}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
