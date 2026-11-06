import api, { shouldUseMockFallback } from './api.js';
import { WORKFLOW_ENDPOINTS } from './apiContract.js';

const fallbackReconciliations = [
  {
    id: 'rec_001',
    _id: 'rec_001',
    accountName: 'HDFC Bank - General Operations (A/C ****4891)',
    fund: 'Monthly Maintenance & Operational Account',
    statementPeriod: '01 Oct 2026 – 24 Oct 2026',
    statementClosingBalance: 612350,
    bookClosingBalance: 612350,
    differenceAmount: 0,
    status: 'RECONCILED',
    isFinalized: true,
    preparedBy: 'Priya Sharma (Treasurer)',
    reviewedBy: 'Suresh Menon (Auditor)',
    reconciledAt: '2026-10-24T18:00:00.000Z',
    matchedTransactionsCount: 42,
    totalStatementRows: 42,
    statementTransactions: [],
    discrepancies: [],
  },
  {
    id: 'rec_002',
    _id: 'rec_002',
    accountName: 'SBI - Capital Sinking Reserve (A/C ****9102)',
    fund: 'Asset Replacement & Sinking Fund',
    statementPeriod: '01 Oct 2026 – 24 Oct 2026',
    statementClosingBalance: 1457400,
    bookClosingBalance: 1445400,
    differenceAmount: 12000,
    status: 'DISCREPANCY_UNRESOLVED',
    isFinalized: false,
    preparedBy: 'Priya Sharma (Treasurer)',
    reviewedBy: 'Pending Auditor Review',
    reconciledAt: null,
    matchedTransactionsCount: 8,
    totalStatementRows: 9,
    statementTransactions: [],
    discrepancies: [
      {
        id: 'disc_1',
        title: 'Uncleared Vendor Cheque #094102',
        type: 'UNMATCHED_STATEMENT',
        severity: 'MEDIUM',
        amountPaise: 1200000,
        explanation: 'Cheque issued by society on Oct 20; not yet presented by vendor at SBI clearing branch.',
        status: 'OPEN',
      },
    ],
  },
];

export const reconciliationService = {
  async getReconciliations(params = {}) {
    try {
      const response = await api.get(WORKFLOW_ENDPOINTS.RECONCILIATION, { params });
      const raw = response.data?.data?.reconciliations || response.data?.data || response.data;
      const reconciliations = Array.isArray(raw)
        ? raw.map((rec) => ({
            ...rec,
            statementPeriod:
              rec.statementPeriod ||
              (rec.periodStart && rec.periodEnd ? `${rec.periodStart} – ${rec.periodEnd}` : rec.periodStart || ''),
          }))
        : [];
      return {
        reconciliations,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return { reconciliations: fallbackReconciliations, isLiveBackend: false };
    }
  },

  async getReconciliationById(id) {
    try {
      const response = await api.get(`${WORKFLOW_ENDPOINTS.RECONCILIATION}/${id}`);
      return {
        reconciliation: response.data?.data?.reconciliation || response.data?.data,
        availableLedgerTransactions: response.data?.data?.availableLedgerTransactions || [],
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const rec = fallbackReconciliations.find((r) => r.id === id || r._id === id);
      return {
        reconciliation: rec || fallbackReconciliations[0],
        availableLedgerTransactions: [],
        isLiveBackend: false,
      };
    }
  },

  async createReconciliation(data) {
    try {
      const response = await api.post(WORKFLOW_ENDPOINTS.RECONCILIATION, data);
      return response.data?.data?.reconciliation || response.data?.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async importStatement(id, payload) {
    try {
      const response = await api.post(
        `${WORKFLOW_ENDPOINTS.RECONCILIATION}/${id}/import-statement`,
        payload
      );
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      throw error;
    }
  },

  async matchTransaction(id, statementTxId, ledgerTxId, notes = '') {
    try {
      const response = await api.post(`${WORKFLOW_ENDPOINTS.RECONCILIATION}/${id}/match`, {
        statementTxId,
        ledgerTxId,
        notes,
      });
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      throw error;
    }
  },

  async unmatchTransaction(id, statementTxId) {
    try {
      const response = await api.post(`${WORKFLOW_ENDPOINTS.RECONCILIATION}/${id}/unmatch`, {
        statementTxId,
      });
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      throw error;
    }
  },

  async resolveDiscrepancy(id, discrepancyId, resolutionData) {
    try {
      const response = await api.post(
        `${WORKFLOW_ENDPOINTS.RECONCILIATION}/${id}/discrepancies/${discrepancyId}/resolve`,
        resolutionData
      );
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      throw error;
    }
  },

  async finalizeReconciliation(id, notes = '') {
    try {
      const response = await api.post(`${WORKFLOW_ENDPOINTS.RECONCILIATION}/${id}/finalize`, {
        notes,
      });
      return response.data?.data?.reconciliation || response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      throw error;
    }
  },

  async runReconciliationVerification(id) {
    return this.finalizeReconciliation(id);
  },
};
