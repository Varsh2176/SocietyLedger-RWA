import api, { shouldUseMockFallback } from './api.js';
import { WORKFLOW_ENDPOINTS, COMPLIANCE_STATUS } from './apiContract.js';

const COMPLIANCE_DISCLAIMER =
  'This compliance tracker is an administrative and governance record-keeping tool. Deadlines reflect administrator configurations and statutory reference sources. It does not constitute certified legal counsel or statutory audit certification.';

const fallbackFilings = [
  {
    id: 'cmp_001',
    _id: 'cmp_001',
    filingType: 'Society Annual Return (Form V)',
    category: 'REGISTRAR_SOCIETIES',
    statutoryBody: 'Registrar of Societies (Karnataka)',
    financialPeriod: 'FY 2025-26',
    deadline: '2026-09-30',
    deadlineSource: 'Karnataka Societies Registration Act 1960 Sec 13',
    submissionDate: '2026-09-24',
    status: COMPLIANCE_STATUS.FILED,
    preparationStatus: 'PREPARED',
    reviewStatus: 'APPROVED',
    documentationStatus: 'COMPLETE',
    responsiblePerson: { name: 'Priya Sharma (Treasurer)' },
    reviewedBy: { name: 'Suresh Menon, CA (Auditor)' },
    acknowledgementReference: 'KAR-SOC-RET-2026-98102',
    acknowledgementRef: 'KAR-SOC-RET-2026-98102',
    supportingDocuments: [
      {
        id: 'doc_1',
        title: 'Form V Signed Audited Accounts',
        documentType: 'RETURN_FORM',
        fileName: 'Form_V_Signed_Audited_Accounts.pdf',
        fileUrl: '#',
      },
    ],
    notes: 'Annual returns and certified audited balance sheets formally accepted by District Registrar.',
    statusHistory: [
      {
        fromStatus: 'PENDING',
        toStatus: 'FILED',
        action: 'FORMAL_SUBMISSION',
        changedAt: '2026-09-24',
        comments: 'Submitted with physical signed copies and acknowledged.',
      },
    ],
  },
  {
    id: 'cmp_002',
    _id: 'cmp_002',
    filingType: 'Quarterly GST-TDS Return (GSTR-7)',
    category: 'TAX_INDIRECT',
    statutoryBody: 'Goods & Services Tax Department',
    financialPeriod: 'Q2 FY 2026-27 (Jul - Sep)',
    deadline: '2026-10-10',
    deadlineSource: 'CGST Act 2017 Sec 51 & Rule 66',
    submissionDate: '2026-10-08',
    status: COMPLIANCE_STATUS.FILED,
    preparationStatus: 'PREPARED',
    reviewStatus: 'APPROVED',
    documentationStatus: 'COMPLETE',
    responsiblePerson: { name: 'Priya Sharma (Treasurer)' },
    reviewedBy: { name: 'Suresh Menon, CA (Auditor)' },
    acknowledgementReference: 'GSTN-GSTR7-ACK-881920',
    acknowledgementRef: 'GSTN-GSTR7-ACK-881920',
    challanReference: 'CPIN-2610-8849-0128',
    challanAmountRupees: 4250,
    supportingDocuments: [
      {
        id: 'doc_2',
        title: 'GSTR-7 Filing Acknowledgment Receipt',
        documentType: 'ACKNOWLEDGEMENT',
        fileName: 'GSTR7_Q2_Ack_Challan.pdf',
        fileUrl: '#',
      },
    ],
    notes: 'TDS deducted on security and lift AMC vendor payments deposited with central government.',
    statusHistory: [],
  },
  {
    id: 'cmp_003',
    _id: 'cmp_003',
    filingType: 'Quarterly TDS Statement (Form 26Q)',
    category: 'TAX_DIRECT',
    statutoryBody: 'Income Tax Department (TRACES)',
    financialPeriod: 'Q2 FY 2026-27 (Jul - Sep)',
    deadline: '2026-10-31',
    deadlineSource: 'Income Tax Act 1961 Sec 200(3)',
    submissionDate: null,
    status: 'UNDER_REVIEW',
    preparationStatus: 'PREPARED',
    reviewStatus: 'UNDER_REVIEW',
    documentationStatus: 'PENDING_VERIFICATION',
    responsiblePerson: { name: 'Priya Sharma (Treasurer)' },
    reviewedBy: { name: 'Suresh Menon, CA (Auditor)' },
    challanReference: 'BSR-0210048-CHALLAN-9921',
    challanAmountRupees: 18500,
    supportingDocuments: [
      {
        id: 'doc_3',
        title: 'ITNS-281 Tax Deposit Challan',
        documentType: 'CHALLAN',
        fileName: 'ITNS281_Challan_18500.pdf',
        fileUrl: '#',
      },
    ],
    notes: 'TDS challan 281 deposited. Annexure draft submitted to auditor for PAN verification.',
    statusHistory: [],
  },
  {
    id: 'cmp_004',
    _id: 'cmp_004',
    filingType: 'Fire Safety NOC Bi-annual Renewal Inspection',
    category: 'SAFETY_MUNICIPAL',
    statutoryBody: 'Karnataka Fire and Emergency Services',
    financialPeriod: 'Bi-annual Cycle 2026',
    deadline: '2026-10-15',
    deadlineSource: 'Karnataka Fire Safety Act & Building Bye-Laws',
    submissionDate: null,
    status: COMPLIANCE_STATUS.OVERDUE,
    preparationStatus: 'REVISION_NEEDED',
    reviewStatus: 'CHANGES_REQUESTED',
    documentationStatus: 'INCOMPLETE',
    responsiblePerson: { name: 'Praveen Kumar (Committee Member)' },
    reviewedBy: null,
    acknowledgementReference: null,
    acknowledgementRef: null,
    supportingDocuments: [],
    notes: 'Fire pump pressure sensor replacement pending with vendor before inspector site signoff.',
    statusHistory: [],
  },
  {
    id: 'cmp_005',
    _id: 'cmp_005',
    filingType: 'Elevator Safety Fitness License Renewal',
    category: 'SAFETY_MUNICIPAL',
    statutoryBody: 'Chief Inspectorate of Lifts & Escalators',
    financialPeriod: 'Annual Inspection 2026',
    deadline: '2026-11-20',
    deadlineSource: 'Karnataka Lifts, Escalators and Passenger Conveyors Act',
    submissionDate: null,
    status: COMPLIANCE_STATUS.PENDING,
    preparationStatus: 'IN_PREPARATION',
    reviewStatus: 'NOT_REVIEWED',
    documentationStatus: 'INCOMPLETE',
    responsiblePerson: { name: 'Praveen Kumar (Maintenance In-Charge)' },
    reviewedBy: null,
    acknowledgementReference: null,
    acknowledgementRef: null,
    supportingDocuments: [],
    notes: 'AMC maintenance completed. Government electrical inspector visit scheduled.',
    statusHistory: [],
  },
];

export const complianceService = {
  /**
   * Retrieves summary metrics and upcoming/overdue tasks for dashboard
   */
  async getDashboard() {
    try {
      const response = await api.get(`${WORKFLOW_ENDPOINTS.COMPLIANCE}/dashboard`);
      return {
        data: response.data?.data || response.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const now = new Date();
      let overdueCount = 0;
      let upcomingCount = 0;
      let completedCount = 0;

      fallbackFilings.forEach((f) => {
        if (f.status === 'FILED' || f.status === 'REVISED_FILED') completedCount++;
        else if (new Date(f.deadline) < now) overdueCount++;
        else upcomingCount++;
      });

      return {
        data: {
          disclaimer: COMPLIANCE_DISCLAIMER,
          summary: {
            totalTasks: fallbackFilings.length,
            completedCount,
            overdueCount,
            upcomingCount,
            pendingReviewsCount: 1,
            incompleteDocsCount: 2,
            correctionRequiredCount: 0,
          },
          upcomingDeadlines: fallbackFilings.filter((f) => f.status === 'PENDING'),
          overdueTasks: fallbackFilings.filter((f) => f.status === 'OVERDUE'),
          pendingReviews: fallbackFilings.filter((f) => f.status === 'UNDER_REVIEW'),
        },
        isLiveBackend: false,
      };
    }
  },

  /**
   * Retrieves compliance task list with filters and search
   */
  async getTasks(params = {}) {
    try {
      const response = await api.get(WORKFLOW_ENDPOINTS.COMPLIANCE, { params });
      return {
        tasks: response.data?.data?.tasks || response.data?.data?.filings || response.data?.data || response.data,
        total: response.data?.data?.total || response.data?.meta?.total,
        disclaimer: response.data?.data?.disclaimer || COMPLIANCE_DISCLAIMER,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      let filtered = [...fallbackFilings];
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((f) => f.status === params.status);
      }
      if (params.category && params.category !== 'ALL') {
        filtered = filtered.filter((f) => f.category === params.category);
      }
      if (params.overdue === 'true') {
        filtered = filtered.filter((f) => f.status === 'OVERDUE');
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (f) =>
            f.filingType.toLowerCase().includes(q) ||
            f.statutoryBody.toLowerCase().includes(q) ||
            f.financialPeriod.toLowerCase().includes(q) ||
            (f.acknowledgementReference && f.acknowledgementReference.toLowerCase().includes(q))
        );
      }

      return {
        tasks: filtered,
        total: filtered.length,
        disclaimer: COMPLIANCE_DISCLAIMER,
        isLiveBackend: false,
      };
    }
  },

  /**
   * Alias for backward compatibility with AuditLogsPage
   */
  async getFilings(params = {}) {
    const res = await this.getTasks(params);
    return {
      filings: res.tasks,
      isLiveBackend: res.isLiveBackend,
    };
  },

  /**
   * Retrieves single compliance task details
   */
  async getTaskById(id) {
    try {
      const response = await api.get(`${WORKFLOW_ENDPOINTS.COMPLIANCE}/${id}`);
      return {
        task: response.data?.data?.task || response.data?.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const task = fallbackFilings.find((f) => f.id === id || f._id === id);
      return {
        task: task || fallbackFilings[0],
        isLiveBackend: false,
      };
    }
  },

  /**
   * Creates new compliance task (Admin & Treasurer only)
   */
  async createTask(taskData) {
    const payload = {
      filingType: taskData.filingType?.trim(),
      statutoryBody: taskData.statutoryBody?.trim(),
      financialPeriod: taskData.financialPeriod?.trim(),
      deadline: taskData.deadline,
      deadlineSource: taskData.deadlineSource?.trim() || 'Administrator Confirmed Calendar',
      category: taskData.category || 'OTHER',
      responsiblePerson: taskData.responsiblePerson || null,
      notes: taskData.notes?.trim() || null,
    };

    try {
      const response = await api.post(WORKFLOW_ENDPOINTS.COMPLIANCE, payload);
      return response.data?.data?.task || response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (error.isNetworkError || error.status === 404) {
        const newTask = {
          id: `cmp_${Date.now()}`,
          _id: `cmp_${Date.now()}`,
          ...payload,
          status: 'PENDING',
          preparationStatus: 'NOT_STARTED',
          reviewStatus: 'NOT_REVIEWED',
          documentationStatus: 'INCOMPLETE',
          supportingDocuments: [],
          statusHistory: [],
        };
        fallbackFilings.push(newTask);
        return newTask;
      }
      throw error;
    }
  },

  /**
   * Updates task metadata
   */
  async updateTask(id, updateData) {
    try {
      const response = await api.put(`${WORKFLOW_ENDPOINTS.COMPLIANCE}/${id}`, updateData);
      return response.data?.data?.task || response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const item = fallbackFilings.find((f) => f.id === id || f._id === id);
      if (item) {
        Object.assign(item, updateData);
        return item;
      }
      throw error;
    }
  },

  /**
   * Records formal filing with submission date and acknowledgement proof
   */
  async recordFiling(id, filingData) {
    try {
      const response = await api.post(
        `${WORKFLOW_ENDPOINTS.COMPLIANCE}/${id}/record-filing`,
        filingData
      );
      return response.data?.data?.task || response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const item = fallbackFilings.find((f) => f.id === id || f._id === id);
      if (item) {
        item.status = COMPLIANCE_STATUS.FILED;
        item.acknowledgementReference = filingData.acknowledgementReference || filingData.acknowledgementRef;
        item.acknowledgementRef = item.acknowledgementReference;
        item.submissionDate = filingData.submissionDate || new Date().toISOString().split('T')[0];
        item.challanReference = filingData.challanReference;
        item.challanAmountRupees = Number(filingData.challanAmount) || null;
        item.documentationStatus = 'COMPLETE';
        if (filingData.notes) item.notes = filingData.notes;
        return item;
      }
      throw error;
    }
  },

  /**
   * Transitions task lifecycle status (Review, Correction notice, etc.)
   */
  async transitionStatus(id, actionData) {
    try {
      const response = await api.post(
        `${WORKFLOW_ENDPOINTS.COMPLIANCE}/${id}/status`,
        actionData
      );
      return response.data?.data?.task || response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const item = fallbackFilings.find((f) => f.id === id || f._id === id);
      if (item) {
        if (actionData.action === 'SUBMIT_FOR_REVIEW') item.status = 'UNDER_REVIEW';
        if (actionData.action === 'APPROVE_REVIEW') item.reviewStatus = 'APPROVED';
        if (actionData.action === 'MARK_CORRECTION_REQUIRED') item.status = 'CORRECTION_REQUIRED';
        return item;
      }
      throw error;
    }
  },

  /**
   * Attaches supporting document, challan, or acknowledgement link
   */
  async addDocument(id, docData) {
    try {
      const response = await api.post(
        `${WORKFLOW_ENDPOINTS.COMPLIANCE}/${id}/documents`,
        docData
      );
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const item = fallbackFilings.find((f) => f.id === id || f._id === id);
      if (item) {
        item.supportingDocuments = item.supportingDocuments || [];
        item.supportingDocuments.push({
          id: `doc_${Date.now()}`,
          ...docData,
        });
        return { documents: item.supportingDocuments };
      }
      throw error;
    }
  },

  /**
   * Exports structured compliance statement report
   */
  async exportSummary() {
    try {
      const response = await api.get(`${WORKFLOW_ENDPOINTS.COMPLIANCE}/export/summary`);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return {
        societyName: null,
        registrationNumber: null,
        generatedAt: new Date().toISOString(),
        disclaimer: COMPLIANCE_DISCLAIMER,
        totalTrackedTasks: fallbackFilings.length,
        complianceRecords: fallbackFilings,
      };
    }
  },
};
