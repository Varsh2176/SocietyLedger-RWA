import api, { shouldUseMockFallback } from './api.js';
import { WORKFLOW_ENDPOINTS, APPROVAL_STATUS } from './apiContract.js';

const fallbackApprovals = [
  {
    id: 'appr_001',
    description: 'Lift Modernization Capacitor & Inverter Overhaul (Johnson Lifts)',
    requestedAmount: 34200,
    fund: 'Asset Replacement & Sinking Fund',
    fundCode: 'FND-SINKING',
    relatedEvent: null,
    vendorName: 'SunPower Renewable & Elevator Systems',
    quotationRef: 'Q-SP-982',
    invoiceNumber: 'INV-SP-2026-44',
    requesterName: 'Praveen Kumar (Maintenance In-Charge)',
    requesterEmail: 'praveen@society.org',
    submissionDate: '2026-10-22',
    status: APPROVAL_STATUS.PENDING,
    notes: 'Urgent replacement requested following quarterly lift inspection report.',
    decisionHistory: [],
  },
  {
    id: 'appr_002',
    description: 'Monsoon Landscape & Tree Pruning Overhaul',
    requestedAmount: 12000,
    fund: 'Monthly Maintenance & Operational Account',
    fundCode: 'FND-MAINT',
    relatedEvent: null,
    vendorName: 'GreenThumb Nurseries & Landscaping',
    quotationRef: 'GT-5091',
    invoiceNumber: 'INV-GT-09',
    requesterName: 'Sunil Rao (Committee Member)',
    requesterEmail: 'sunil@society.org',
    submissionDate: '2026-10-20',
    status: APPROVAL_STATUS.PENDING,
    notes: 'Trimming branches obstructing overhead power lines near Block C transformer.',
    decisionHistory: [],
  },
  {
    id: 'appr_003',
    description: 'Diwali Tower Facade Illumination Advance Bid',
    requestedAmount: 30000,
    fund: 'Operational Surplus Sub-Account',
    fundCode: 'FND-MAINT',
    relatedEvent: 'Diwali Lights & Cultural Gala 2026',
    vendorName: 'Luminance Tower Facade Lighting',
    quotationRef: 'Q-LT-401',
    invoiceNumber: null,
    requesterName: 'Kavita Deshmukh (Cultural Committee)',
    requesterEmail: 'kavita@society.org',
    submissionDate: '2026-10-23',
    status: APPROVAL_STATUS.INFO_REQUESTED,
    notes: 'Requested 2 additional comparative quotations as per society procurement threshold policy (> ₹25,000).',
    decisionHistory: [
      {
        action: 'INFO_REQUESTED',
        decidedBy: 'Priya Sharma (Treasurer)',
        date: '2026-10-24T11:30:00.000Z',
        comments: 'Please attach 2 alternate vendor bids before financial sanction.',
      },
    ],
  },
  {
    id: 'appr_004',
    description: 'Clubhouse Surround Audio Amplifiers & Microphones',
    requestedAmount: 45000,
    fund: 'Asset Replacement & Sinking Fund',
    fundCode: 'FND-SINKING',
    relatedEvent: null,
    vendorName: 'Acoustic Sound Tech',
    quotationRef: 'AST-2026-19',
    invoiceNumber: null,
    requesterName: 'Vikram Joshi (Resident)',
    requesterEmail: 'vikram@society.org',
    submissionDate: '2026-10-17',
    status: APPROVAL_STATUS.REJECTED,
    notes: 'Disapproved by Management Committee. Procurement policy requires prior AGM sanction for amenity enhancements exceeding ₹30,000.',
    decisionHistory: [
      {
        action: 'REJECTED',
        decidedBy: 'Dr. Anand Rao (President)',
        date: '2026-10-18T14:15:00.000Z',
        comments: 'Disapproved. Sinking fund cannot be disbursed for non-essential audio amenities without AGM ratification.',
      },
    ],
  },
  {
    id: 'appr_005',
    description: 'BESCOM Common Area Meter Electricity Bill',
    requestedAmount: 54200,
    fund: 'Monthly Maintenance & Operational Account',
    fundCode: 'FND-MAINT',
    relatedEvent: null,
    vendorName: 'BESCOM Bengaluru',
    quotationRef: null,
    invoiceNumber: 'BES-RR-8849102',
    requesterName: 'Accounts Automation',
    requesterEmail: 'system@society.org',
    submissionDate: '2026-10-09',
    status: APPROVAL_STATUS.APPROVED,
    notes: 'Approved and disbursed on time to prevent late payment surcharge.',
    decisionHistory: [
      {
        action: 'APPROVED',
        decidedBy: 'Priya Sharma (Treasurer)',
        date: '2026-10-10T09:00:00.000Z',
        comments: 'Bill verified against common meter reading.',
      },
    ],
  },
];

export const approvalsService = {
  async getApprovals(params = {}) {
    try {
      const response = await api.get(WORKFLOW_ENDPOINTS.APPROVALS, { params });
      return {
        approvals: response.data?.data?.approvals || response.data?.data || response.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      let filtered = [...fallbackApprovals];
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((a) => a.status === params.status);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.description.toLowerCase().includes(q) ||
            a.requesterName.toLowerCase().includes(q) ||
            a.vendorName.toLowerCase().includes(q)
        );
      }
      return { approvals: filtered, isLiveBackend: false };
    }
  },

  async decideApproval(id, { action, comments, user }) {
    // Separation-of-duties check
    const approval = fallbackApprovals.find((a) => a.id === id);
    if (approval && user && user.email === approval.requesterEmail) {
      throw new Error('Separation-of-Duties Violation: Requesters are prohibited from self-approving their own expense requests.');
    }

    try {
      const response = await api.post(`${WORKFLOW_ENDPOINTS.APPROVALS}/${id}/decision`, {
        action,
        comments,
      });
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (approval) {
        approval.status = action;
        approval.decisionHistory.unshift({
          action,
          decidedBy: user?.name ? `${user.name} (${user.role || 'Committee'})` : 'Authorized Signatory',
          date: new Date().toISOString(),
          comments: comments || 'Decision registered.',
        });
        return approval;
      }
      throw error;
    }
  },
};
