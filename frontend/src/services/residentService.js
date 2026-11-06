import api, { readApiData, shouldUseMockFallback } from './api.js';
import { WORKFLOW_ENDPOINTS, QUERY_STATUS } from './apiContract.js';

const fallbackTransparencyData = {
  societyName: null,
  registrationNumber: null,
  fiscalYear: null,
  fundBalanceDescription: 'Fund balances include active funds only.',
  publishedEvents: [],
  publishedAt: '2026-10-25T18:00:00.000Z',
  auditorCertification: 'Statutory Annual Audit completed and certified by Suresh Menon, CA (Reg. No. 048912).',

  publishedFunds: [
    {
      name: 'General Corpus Reserve Fund',
      code: 'FND-CORPUS',
      currentBalance: 2840000,
      purpose: 'Permanent reserve held in term deposits with nationalized banks.',
      bankName: 'HDFC Bank & SBI (Term Deposits)',
      isRestricted: true,
    },
    {
      name: 'Asset Replacement & Sinking Fund',
      code: 'FND-SINKING',
      currentBalance: 1445400,
      purpose: 'Ring-fenced reserves for elevator replacements and major structural painting.',
      bankName: 'State Bank of India',
      isRestricted: true,
    },
    {
      name: 'Monthly Maintenance & Operational Account',
      code: 'FND-MAINT',
      currentBalance: 612350,
      purpose: 'Operating liquidity for security, housekeeping, BESCOM common power, and water.',
      bankName: 'ICICI Bank Operating Current A/C',
      isRestricted: false,
    },
  ],

  publishedIncomeExpenditure: {
    period: 'All posted vouchers',
    description: 'Collections and expenditure include every approved, paid, and reconciled voucher. They are not limited to the fiscal year or to active funds.',
    totalCollections: 1845000,
    totalExpenditure: 236400,
    netOperatingSurplus: 1608600,
    collectionEfficiency: 'Unavailable',
  },

  publishedDecisions: [
    {
      id: 'dec_01',
      date: '2026-10-20',
      title: 'Elevator Comprehensive AMC Renewal for FY 2026-27',
      sanctionedAmount: 18500,
      quorum: 'Unanimous (7 Committee Members present)',
      resolutionRef: 'RES-2026-10-01',
      summary: 'Management committee ratified 1-year comprehensive AMC with Johnson Lifts following technical safety inspection.',
    },
    {
      id: 'dec_02',
      date: '2026-10-05',
      title: 'Rooftop Solar Net-Metering Tariff Agreement Ratification',
      sanctionedAmount: 28400,
      quorum: 'Ratified at Annual General Meeting',
      resolutionRef: 'AGM-2026-RES-04',
      summary: 'Sanctioned synchronization expenses for BESCOM 50kWp net-metering solar microgrid.',
    },
  ],

  publishedAuditReports: [
    {
      id: 'aud_rep_01',
      title: 'Statutory Financial Audit Report FY 2025-26',
      certifiedBy: 'Suresh Menon, Chartered Accountant',
      certificationDate: '2026-09-20',
      status: 'UNQUALIFIED_CLEAN_OPINION',
      summary: 'Books of accounts, general ledger vouchers, and bank statements examined. True and fair view verified.',
      downloadFile: 'Audited_Financial_Statements_FY25_26.pdf',
    },
  ],
};

const fallbackQueries = [
  {
    id: 'qry_001',
    reference: 'QRY-2026-042',
    category: 'Maintenance Billing',
    subject: 'Breakdown of water tanker charges during September rain deficit',
    unit: 'Block B - 302',
    residentName: 'Arun Varma',
    date: '2026-10-18',
    status: 'RESOLVED',
    question: 'Could the committee clarify why water tanker expenses increased in late September given the monsoon rains?',
    response: {
      answeredBy: 'Priya Sharma (Treasurer)',
      answeredAt: '2026-10-20T11:00:00.000Z',
      replyText: 'Due to BWSSB municipal pipeline maintenance between Sep 18-22, society sump relied on 12 emergency tankers (Invoice #GT-881 verified in ledger under VR-2026-068). Tanker logbook is available in society office.',
    },
  },
  {
    id: 'qry_002',
    reference: 'QRY-2026-045',
    category: 'Event Budget',
    subject: 'Unspent surplus allocation from Ganesh Utsav 2026',
    unit: 'Block A - 402',
    residentName: 'Ramesh Kumar',
    date: '2026-10-22',
    status: 'ANSWERED',
    question: 'How is the unspent balance of ₹2,200 from Ganesh Utsav being treated in the society accounts?',
    response: {
      answeredBy: 'Priya Sharma (Treasurer)',
      answeredAt: '2026-10-23T16:30:00.000Z',
      replyText: 'As per society financial governance rules, the unspent balance of ₹2,200 has been credited back to the Cultural Sub-Account and reflected in the October ledger settlement report.',
    },
  },
  {
    id: 'qry_003',
    reference: 'QRY-2026-048',
    category: 'Facility Maintenance',
    subject: 'Status of Block C lift inverter capacitor replacement',
    unit: 'Block C - 104',
    residentName: 'Meenakshi Sundaram',
    date: '2026-10-24',
    status: 'IN_PROGRESS',
    question: 'When will the capacitor replacement for Lift #2 be installed? The elevator produces intermittent jerks.',
    response: {
      answeredBy: 'Praveen Kumar (Maintenance Lead)',
      answeredAt: '2026-10-25T10:15:00.000Z',
      replyText: 'Replacement voucher VR-2026-087 sanctioned. Johnson Lifts technician dispatched for installation on Monday, Oct 27.',
    },
  },
];

export const residentService = {
  async getTransparencyData() {
    try {
      const response = await api.get('/resident/transparency');
      return {
        data: readApiData(response),
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return {
        data: fallbackTransparencyData,
        isLiveBackend: false,
      };
    }
  },

  async getQueries(params = {}) {
    try {
      const response = await api.get('/resident/queries', { params });
      return {
        queries: response.data?.data?.queries || response.data?.data || response.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      let filtered = [...fallbackQueries];
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((q) => q.status === params.status);
      }
      if (params.search) {
        const queryStr = params.search.toLowerCase();
        filtered = filtered.filter(
          (q) =>
            q.subject.toLowerCase().includes(queryStr) ||
            q.question.toLowerCase().includes(queryStr) ||
            q.reference.toLowerCase().includes(queryStr) ||
            q.category.toLowerCase().includes(queryStr)
        );
      }
      return {
        queries: filtered,
        isLiveBackend: false,
      };
    }
  },

  async submitQuery(queryData) {
    try {
      const response = await api.post('/resident/queries', queryData);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (error.isNetworkError || error.status === 404) {
        const newQry = {
          id: `qry_${Date.now()}`,
          reference: `QRY-2026-${Math.floor(100 + Math.random() * 900)}`,
          category: queryData.category,
          subject: queryData.subject,
          unit: queryData.unit || 'Resident Unit',
          residentName: queryData.residentName || 'Resident Member',
          date: new Date().toISOString().split('T')[0],
          status: 'OPEN',
          question: queryData.question,
          response: null,
        };
        fallbackQueries.unshift(newQry);
        return newQry;
      }
      throw error;
    }
  },
};
