import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  FileText,
  Building,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserCheck,
  Paperclip,
  Check,
  X,
  RefreshCw,
  ExternalLink,
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
import { auditService } from '../services/auditService';
import { complianceService } from '../services/complianceService';
import { documentsService } from '../services/documentsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  AUDIT_SEVERITY,
  AUDIT_OBSERVATION_STATUS,
  COMPLIANCE_STATUS,
  USER_ROLES,
} from '../services/apiContract';
import { formatDate } from '../utils/formatters';

export function AuditLogsPage() {
  const { user, role } = useAuth();
  const { addToast } = useToast();

  const isAuditorOrAdmin = role === USER_ROLES.ADMIN || role === USER_ROLES.AUDITOR;

  // Active Tab
  const [activeTab, setActiveTab] = useState('observations');

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  // Tab Data States
  const [observations, setObservations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [complianceFilings, setComplianceFilings] = useState([]);
  const [documents, setDocuments] = useState([]);

  // Observation Filter
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedObservation, setSelectedObservation] = useState(null);

  // Compliance Modal
  const [filingToRecord, setFilingToRecord] = useState(null);
  const [ackRef, setAckRef] = useState('');

  // Document Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('INVOICE_RECEIPT');
  const [uploadEntity, setUploadEntity] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchTabData = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      if (activeTab === 'observations') {
        const res = await auditService.getObservations({ severity: severityFilter });
        setObservations(res.observations || []);
        setIsLiveBackend(res.isLiveBackend);
      } else if (activeTab === 'logs') {
        const res = await auditService.getAuditLogs();
        setAuditLogs(res.logs || []);
        setIsLiveBackend(res.isLiveBackend);
      } else if (activeTab === 'compliance') {
        const res = await complianceService.getFilings();
        setComplianceFilings(res.filings || []);
        setIsLiveBackend(res.isLiveBackend);
      } else if (activeTab === 'documents') {
        const res = await documentsService.getDocuments();
        setDocuments(res.documents || []);
        setIsLiveBackend(res.isLiveBackend);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, severityFilter]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  // Submit Compliance Record
  const handleSubmitFiling = async (e) => {
    e.preventDefault();
    if (!filingToRecord || !ackRef.trim()) return;

    try {
      await complianceService.recordFiling(filingToRecord.id, {
        acknowledgementRef: ackRef.trim(),
      });
      addToast({
        title: 'Filing Recorded',
        message: `Acknowledgement ${ackRef} attached to ${filingToRecord.filingType}.`,
        type: 'success',
      });
      setFilingToRecord(null);
      setAckRef('');
      fetchTabData();
    } catch (err) {
      addToast({
        title: 'Filing Update Failed',
        message: err.message,
        type: 'error',
      });
    }
  };

  // Upload Document Handler
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      await documentsService.uploadDocument(uploadFile, {
        category: uploadCategory,
        relatedEntity: uploadEntity,
      });
      addToast({
        title: 'Document Deposited',
        message: `${uploadFile.name} uploaded to society repository.`,
        type: 'success',
      });
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadEntity('');
      fetchTabData();
    } catch (err) {
      addToast({
        title: 'Upload Failed',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case AUDIT_SEVERITY.HIGH:
        return <StatusBadge variant="danger" size="sm">High Severity</StatusBadge>;
      case AUDIT_SEVERITY.MEDIUM:
        return <StatusBadge variant="warning" size="sm">Medium</StatusBadge>;
      case AUDIT_SEVERITY.LOW:
        return <StatusBadge variant="info" size="sm">Low</StatusBadge>;
      default:
        return <StatusBadge variant="neutral" size="sm">Info</StatusBadge>;
    }
  };

  const getComplianceBadge = (status) => {
    switch (status) {
      case COMPLIANCE_STATUS.FILED:
        return <StatusBadge variant="success" size="sm">Filed & Certified</StatusBadge>;
      case COMPLIANCE_STATUS.PENDING:
        return <StatusBadge variant="warning" size="sm">Pending Filing</StatusBadge>;
      case COMPLIANCE_STATUS.OVERDUE:
        return <StatusBadge variant="danger" size="sm">Overdue Statutory Task</StatusBadge>;
      case COMPLIANCE_STATUS.CORRECTION_REQUIRED:
        return <StatusBadge variant="neutral" size="sm">Correction Required</StatusBadge>;
      default:
        return <StatusBadge variant="neutral" size="sm">{status}</StatusBadge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Audit Trail, Compliance & Verification Hub
            </h1>
            <StatusBadge variant={isLiveBackend ? 'success' : 'neutral'} size="sm" dot={true}>
              {isLiveBackend ? 'Live Audit Engine' : 'Sample data — not society records'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Statutory filings, verification findings, and the secure document repository
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="md" icon={RefreshCw} onClick={fetchTabData}>
            Refresh
          </Button>
          {activeTab === 'documents' && (
            <Button variant="primary" size="md" icon={Upload} onClick={() => setIsUploadModalOpen(true)}>
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('observations')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'observations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertCircle size={15} />
          Audit Observations & System Warnings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={15} />
          Chronological Audit Trail
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compliance')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'compliance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck size={15} />
          Statutory Compliance Filings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'documents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Paperclip size={15} />
          Verified Documents
        </button>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-12">
          <LoadingState message="Connecting to compliance and audit ledger..." />
        </div>
      )}

      {hasError && !isLoading && (
        <ErrorState
          title="Failed to load governance records"
          message="Could not retrieve the requested compliance stream."
          onRetry={fetchTabData}
        />
      )}

      {/* Tab 1: Audit Observations & Automated System Warnings */}
      {!isLoading && !hasError && activeTab === 'observations' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Financial Verification Accuracy Rule: </span>
              <span>
                Automated system flags and audit observations represent verification checks (e.g. tender thresholds, GST status, uncleared cheques). A warning is not proof of fraud, but highlights items requiring committee review and resolution.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {observations.map((obs) => (
              <div
                key={obs.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(obs.severity)}
                    <h3 className="text-xs font-bold text-slate-900">{obs.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Logged: {formatDate(obs.date)}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">{obs.status}</span>
                  </div>
                </div>

                <div className="mt-3 text-xs space-y-2">
                  <p className="text-slate-700 leading-relaxed">{obs.observation}</p>
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">Related Reference: </span>
                      <strong className="text-slate-800 font-mono">{obs.relatedEntity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Assigned To: </span>
                      <strong className="text-slate-800">{obs.assignedTo}</strong>
                    </div>
                  </div>
                  {obs.correctiveAction && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded border border-emerald-100">
                      <strong className="font-semibold">Corrective Action Taken: </strong>
                      <span>{obs.correctiveAction}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Chronological Audit Trail */}
      {!isLoading && !hasError && activeTab === 'logs' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-1.5">
            <Clock size={16} className="text-blue-600" />
            Chronological Governance Event Stream
          </h2>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {auditLogs.map((log) => (
              <div key={log.id} className="relative">
                <span className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 ring-2 ring-blue-100" />
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-semibold text-slate-900">{log.action}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDate(log.timestamp, { includeTime: true })}
                    </span>
                  </div>
                  <p className="text-slate-700 mt-1">{log.details}</p>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-3">
                    <span>Actor: <strong className="text-slate-700">{log.actor}</strong></span>
                    <span>•</span>
                    <span>Ref: <strong className="font-mono text-slate-700">{log.entityRef}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Statutory Compliance Filings */}
      {!isLoading && !hasError && activeTab === 'compliance' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Statutory Compliance & Legal Obligations
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Deadlines supplied by backend governance calendar. No estimated or fabricated filing dates.
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {complianceFilings.map((f) => (
              <div key={f.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{f.filingType}</span>
                    {getComplianceBadge(f.status)}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Statutory Authority: {f.statutoryBody} • Period: {f.financialPeriod}
                  </p>
                  <p className="text-slate-600 text-[11px]">{f.notes}</p>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5 flex-shrink-0">
                  <div className="text-slate-600">
                    Filing Deadline: <strong className="text-slate-900">{formatDate(f.deadline)}</strong>
                  </div>
                  {f.acknowledgementRef ? (
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">
                      Ack: {f.acknowledgementRef}
                    </span>
                  ) : (
                    isAuditorOrAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilingToRecord(f);
                          setAckRef('');
                        }}
                      >
                        Record Acknowledgment
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified Document Repository */}
      {!isLoading && !hasError && activeTab === 'documents' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Verified Society Document & Invoice Repository
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Secure document storage for signed returns, vendor invoices, and compliance certificates
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
                      Category: {doc.category} • Size: {doc.size} • Uploaded: {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge
                    variant={doc.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {doc.verificationStatus === 'VERIFIED' ? 'Verified' : 'Pending Verification'}
                  </StatusBadge>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    onClick={() => documentsService.downloadDocument(doc)}
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-slate-900">Deposit Document to Repository</h3>
            <p className="text-xs text-slate-500 mt-0.5">Supported formats: PDF, JPG, PNG (Max 10 MB)</p>

            <form onSubmit={handleUploadDocument} className="mt-4 space-y-4 text-xs">
              <FormField label="Document Category" htmlFor="docCat" required={true}>
                <Select
                  id="docCat"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                >
                  <option value="INVOICE_RECEIPT">Vendor Tax Invoice / Receipt</option>
                  <option value="STATUTORY_COMPLIANCE">Statutory Return / Form V</option>
                  <option value="UTILITY_BILL">Electricity / Water Utility Bill</option>
                  <option value="WARRANTY_AMC">AMC Contract / Warranty Certificate</option>
                </Select>
              </FormField>

              <FormField label="Related Reference (Optional)" htmlFor="docRel">
                <Input
                  id="docRel"
                  placeholder="e.g. VR-2026-089 or Lift AMC"
                  value={uploadEntity}
                  onChange={(e) => setUploadEntity(e.target.value)}
                />
              </FormField>

              <FormField label="Choose File" htmlFor="docFile" required={true}>
                <input
                  id="docFile"
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </FormField>

              <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <Button variant="outline" size="md" onClick={() => setIsUploadModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isUploading}>
                  Upload File
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Compliance Acknowledgment Modal */}
      {filingToRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Record Statutory Acknowledgment
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Filing: {filingToRecord.filingType} ({filingToRecord.financialPeriod})
            </p>

            <form onSubmit={handleSubmitFiling} className="mt-4 space-y-4 text-xs">
              <FormField
                label="Statutory Acknowledgement Reference"
                htmlFor="ackNumber"
                required={true}
                hint="Provided by Government Portal or Department"
              >
                <Input
                  id="ackNumber"
                  placeholder="e.g. KAR-SOC-2026-ACK-401"
                  value={ackRef}
                  onChange={(e) => setAckRef(e.target.value)}
                />
              </FormField>

              <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <Button variant="outline" size="md" onClick={() => setFilingToRecord(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" type="submit">
                  Record Filing
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
