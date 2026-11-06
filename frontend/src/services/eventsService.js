import api, { shouldUseMockFallback } from './api.js';
import { WORKFLOW_ENDPOINTS, EVENT_STATUS } from './apiContract.js';

const fallbackEvents = [
  {
    id: 'evt_001',
    title: 'Ganesh Utsav & Cultural Fest 2026',
    description: 'Community eco-friendly idol installation, 3-day evening cultural events, and community dinner for 180 families.',
    date: '2026-09-15',
    endDate: '2026-09-18',
    status: EVENT_STATUS.SETTLED,
    proposedBudget: 80000,
    approvedBudget: 75000, // Management Committee approved with ₹5,000 reduction
    actualExpenditure: 72800,
    unspentBalance: 2200, // Refunded back to General Reserve
    fundingSource: 'Cultural Sub-Fund & Voluntary Contributions',
    proposedBy: 'Sunil Rao (Cultural Committee)',
    approvedBy: 'Management Committee Resolution #2026/08',
    selectedVendor: {
      id: 'vnd_01',
      name: 'Shree Krishna Caterers & Pandal Decors',
      bidAmount: 48000,
      quotationRef: 'Q-SKC-881',
      isContractSigned: true,
    },
    quotations: [
      { id: 'vnd_01', name: 'Shree Krishna Caterers & Pandal Decors', bidAmount: 48000, quotationRef: 'Q-SKC-881', status: 'SELECTED' },
      { id: 'vnd_02', name: 'Royal Pandal & Sound Engineers', bidAmount: 54000, quotationRef: 'Q-RP-104', status: 'REJECTED' },
      { id: 'vnd_03', name: 'Festive Moments Event Management', bidAmount: 58500, quotationRef: 'Q-FM-902', status: 'REJECTED' },
    ],
    budgetBreakdown: [
      { head: 'Eco-Friendly Clay Idol & Puja Samagri', proposed: 15000, approved: 15000, actual: 14200 },
      { head: 'Pandal Setup, Lighting & PA Audio', proposed: 35000, approved: 30000, actual: 30000 },
      { head: 'Community Prasad & Dinner for Residents', proposed: 30000, approved: 30000, actual: 28600 },
    ],
    invoices: [
      { id: 'inv_101', ref: 'INV-SKC-01', amount: 30000, type: 'ADVANCE', status: 'PAID' },
      { id: 'inv_102', ref: 'INV-SKC-FINAL', amount: 18000, type: 'FINAL_SETTLEMENT', status: 'PAID' },
    ],
    settlementNotes: 'Event successfully concluded. Audited expense vouchers verified against vendor GST bills. Unspent balance of ₹2,200 deposited back into Cultural Sub-Account.',
  },
  {
    id: 'evt_002',
    title: 'Solar Net-Metering & Microgrid Inauguration',
    description: 'Technical walkthrough and townhall for Phase 2 50kWp rooftop solar installation with BESCOM officials.',
    date: '2026-10-02',
    status: EVENT_STATUS.COMPLETED,
    proposedBudget: 35000,
    approvedBudget: 30000,
    actualExpenditure: 28400,
    unspentBalance: 1600,
    fundingSource: 'Rooftop Solar Special Project Fund',
    proposedBy: 'Green Initiative Taskforce',
    approvedBy: 'Dr. Anand Rao (President)',
    selectedVendor: {
      id: 'vnd_04',
      name: 'Apex Visuals & Stage Systems',
      bidAmount: 18000,
      quotationRef: 'APX-990',
      isContractSigned: true,
    },
    quotations: [
      { id: 'vnd_04', name: 'Apex Visuals & Stage Systems', bidAmount: 18000, quotationRef: 'APX-990', status: 'SELECTED' },
      { id: 'vnd_05', name: 'MediaOne Audio-Visuals', bidAmount: 22000, quotationRef: 'MO-2026', status: 'REJECTED' },
    ],
    budgetBreakdown: [
      { head: 'Stage Setup & Projector Screen', proposed: 20000, approved: 18000, actual: 18000 },
      { head: 'High Tea & Information Booklets', proposed: 15000, approved: 12000, actual: 10400 },
    ],
    invoices: [
      { id: 'inv_103', ref: 'INV-APX-81', amount: 18000, type: 'PAYMENT', status: 'PAID' },
    ],
    settlementNotes: 'BESCOM synchronization completed. Final settlement pending auditor formal clearance.',
  },
  {
    id: 'evt_003',
    title: 'Diwali Lights & Cultural Gala 2026',
    description: 'Tower exterior LED illumination, rangoli competition, cultural performances by resident children, and festive sweets box for 240 apartments.',
    date: '2026-11-01',
    endDate: '2026-11-03',
    status: EVENT_STATUS.PROPOSED,
    proposedBudget: 130000,
    approvedBudget: null, // Pending committee voting!
    actualExpenditure: 0,
    unspentBalance: null,
    fundingSource: 'Proposed: Festive Assessment & Operational Surplus',
    proposedBy: 'Cultural Committee (Kavita Deshmukh)',
    approvedBy: 'Pending Management Committee Meeting',
    selectedVendor: null,
    quotations: [
      { id: 'vnd_06', name: 'Luminance Tower Facade Lighting', bidAmount: 65000, quotationRef: 'Q-LT-401', status: 'PENDING' },
      { id: 'vnd_07', name: 'StarLights Bangalore', bidAmount: 72000, quotationRef: 'Q-SL-89', status: 'PENDING' },
    ],
    budgetBreakdown: [
      { head: 'Common Area Facade Lighting (3 Towers)', proposed: 65000, approved: null, actual: 0 },
      { head: 'Diwali Sweets & Dry Fruit Gift Boxes (240 units)', proposed: 45000, approved: null, actual: 0 },
      { head: 'Sound, Stage & Prizes for Children', proposed: 20000, approved: null, actual: 0 },
    ],
    invoices: [],
    settlementNotes: 'Proposal submitted for committee review. Budget sanction and resident survey open.',
  },
];

export const eventsService = {
  async getEvents(params = {}) {
    try {
      const response = await api.get(WORKFLOW_ENDPOINTS.EVENTS, { params });
      return {
        events: response.data?.data?.events || response.data?.data || response.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      let filtered = [...fallbackEvents];
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((e) => e.status === params.status);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.fundingSource.toLowerCase().includes(q)
        );
      }
      return { events: filtered, isLiveBackend: false };
    }
  },

  async getEventById(id) {
    try {
      const response = await api.get(`${WORKFLOW_ENDPOINTS.EVENTS}/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const evt = fallbackEvents.find((e) => e.id === id);
      if (!evt) throw new Error('Event not found');
      return evt;
    }
  },

  async createProposal(proposalData) {
    try {
      const response = await api.post(WORKFLOW_ENDPOINTS.EVENTS, proposalData);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (error.isNetworkError || error.status === 404) {
        const newEvt = {
          id: `evt_${Date.now()}`,
          title: proposalData.title,
          description: proposalData.description,
          date: proposalData.date,
          status: EVENT_STATUS.PROPOSED,
          proposedBudget: Number(proposalData.proposedBudget),
          approvedBudget: null,
          actualExpenditure: 0,
          fundingSource: proposalData.fundingSource || 'Operational Account',
          proposedBy: proposalData.proposedBy || 'Resident Member',
          approvedBy: 'Pending Committee Review',
          selectedVendor: null,
          quotations: [],
          budgetBreakdown: proposalData.budgetBreakdown || [],
          invoices: [],
        };
        fallbackEvents.unshift(newEvt);
        return newEvt;
      }
      throw error;
    }
  },
};
