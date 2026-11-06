import api, { shouldUseMockFallback } from './api.js';
import { WORKFLOW_ENDPOINTS, AUDIT_SEVERITY, AUDIT_OBSERVATION_STATUS } from './apiContract.js';

const fallbackAuditLogs = [
  {
    id: 'log_101',
    timestamp: '2026-10-24T17:45:00.000Z',
    actor: 'Suresh Menon (Auditor)',
    action: 'RECONCILE_TRANSACTION',
    entityType: 'TRANSACTION',
    entityRef: 'VR-2026-089',
    details: 'Verified Johnson Lifts Q3 AMC invoice against HDFC bank debit entry (₹18,500). Stamped as verified.',
  },
  {
    id: 'log_102',
    timestamp: '2026-10-23T14:20:00.000Z',
    actor: 'Priya Sharma (Treasurer)',
    action: 'CREATE_VOUCHER',
    entityType: 'TRANSACTION',
    entityRef: 'VR-2026-088',
    details: 'Recorded October Maintenance batch collection for Wing C (₹1,47,000) via Razorpay UPI gateway.',
  },
  {
    id: 'log_103',
    timestamp: '2026-10-22T19:10:00.000Z',
    actor: 'Dr. Anand Rao (President)',
    action: 'APPROVE_EXPENSE',
    entityType: 'APPROVAL',
    entityRef: 'VR-2026-087',
    details: 'Sanctioned solar inverter synchronizer replacement (₹34,200) from Sinking Fund.',
  },
  {
    id: 'log_104',
    timestamp: '2026-10-18T16:00:00.000Z',
    actor: 'Management Committee',
    action: 'REJECT_EXPENSE',
    entityType: 'APPROVAL',
    entityRef: 'VR-2026-085',
    details: 'Disapproved clubhouse audio setup (₹45,000). Quorum noted lack of competitive bidding.',
  },
  {
    id: 'log_105',
    timestamp: '2026-10-15T11:00:00.000Z',
    actor: 'Dr. Anand Rao (President)',
    action: 'FILE_COMPLIANCE',
    entityType: 'COMPLIANCE',
    entityRef: 'cmp_001',
    details: 'Form V Society Annual Return signed and dispatched to Registrar of Societies.',
  },
];

const fallbackObservations = [
  {
    id: 'obs_001',
    title: 'Discretionary Procurement Limit Exceeded',
    severity: AUDIT_SEVERITY.HIGH,
    status: AUDIT_OBSERVATION_STATUS.UNDER_REVIEW,
    date: '2026-10-19',
    relatedEntity: 'VR-2026-085 (Clubhouse Audio)',
    assignedTo: 'Vikram Joshi & Procurement Committee',
    observation: 'Quotation of ₹45,000 submitted without 3 independent vendor tenders required for expenditures exceeding ₹25,000.',
    correctiveAction: 'Expense rejected by committee. Tender guidelines reiterated to sports and amenities committee.',
    evidenceDocument: 'Society_ByeLaws_Procurement_Section8.pdf',
    isWarningOnly: false,
  },
  {
    id: 'obs_002',
    title: 'Vendor GST Number Verification Pending',
    severity: AUDIT_SEVERITY.MEDIUM,
    status: AUDIT_OBSERVATION_STATUS.OPEN,
    date: '2026-10-21',
    relatedEntity: 'VR-2026-086 (GreenThumb Nurseries)',
    assignedTo: 'Priya Sharma (Treasurer)',
    observation: 'GST invoice submitted does not show active GSTIN validation on the GST portal for horticultural services.',
    correctiveAction: 'Treasurer requested updated B2B tax invoice with active GSTIN before cheque clearance.',
    evidenceDocument: 'INV-GT-5091_Scan.pdf',
    isWarningOnly: true,
  },
  {
    id: 'obs_003',
    title: 'Uncleared Cheque Approaching Stale Threshold',
    severity: AUDIT_SEVERITY.LOW,
    status: AUDIT_OBSERVATION_STATUS.RESOLVED,
    date: '2026-10-10',
    relatedEntity: 'Chq #092102 (₹8,500)',
    assignedTo: 'Accounts Department',
    observation: 'Cheque issued in July remained unpresented for 75 days.',
    correctiveAction: 'Vendor contacted; cheque presented and successfully cleared in SBI account.',
    evidenceDocument: 'SBI_Passbook_Oct26.pdf',
    isWarningOnly: true,
  },
];

export const auditService = {
  async getAuditLogs(params = {}) {
    try {
      const response = await api.get(WORKFLOW_ENDPOINTS.AUDIT_LOGS, { params });
      return {
        logs: response.data?.data?.logs || response.data?.data || response.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return { logs: fallbackAuditLogs, isLiveBackend: false };
    }
  },

  async getObservations(params = {}) {
    try {
      const response = await api.get(WORKFLOW_ENDPOINTS.AUDIT_OBSERVATIONS, { params });
      return {
        observations: response.data?.data?.observations || response.data?.data || response.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      let filtered = [...fallbackObservations];
      if (params.severity && params.severity !== 'ALL') {
        filtered = filtered.filter((o) => o.severity === params.severity);
      }
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((o) => o.status === params.status);
      }
      return { observations: filtered, isLiveBackend: false };
    }
  },

  async createObservation(data) {
    try {
      const response = await api.post(WORKFLOW_ENDPOINTS.AUDIT_OBSERVATIONS, data);
      return response.data?.data?.observation || response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const newObs = {
        id: `obs_${Date.now()}`,
        _id: `obs_${Date.now()}`,
        ...data,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };
      fallbackObservations.unshift(newObs);
      return newObs;
    }
  },

  async updateObservation(id, data) {
    try {
      const response = await api.put(`${WORKFLOW_ENDPOINTS.AUDIT_OBSERVATIONS}/${id}`, data);
      return response.data?.data?.observation || response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const obs = fallbackObservations.find((o) => o.id === id || o._id === id);
      if (obs) Object.assign(obs, data);
      return obs;
    }
  },
};
