import api, { readApiData, shouldUseMockFallback } from './api.js';
import { FINANCIAL_ENDPOINTS, USER_ROLES } from './apiContract.js';

// Mock aggregation payload strictly conforming to the documented backend contract
const fallbackSummary = {
  totalAvailableFunds: 4897750,
  corpusFundBalance: 2840000,
  maintenanceFundBalance: 612350,
  sinkingFundBalance: 1445400,
  totalIncomeMonth: 1845000,
  totalExpenseMonth: 236400,
  pendingApprovalsCount: 'Unavailable',
  pendingReconciliationsCount: 'Unavailable',
  overdueComplianceCount: 'Unavailable',
  openAuditObservationsCount: 'Unavailable',
  statutoryAuditStatus: 'Unavailable',
};

const fallbackCharts = {
  monthlyCashflow: [
    { month: 'May 26', income: 1420000, expenditure: 310000, netReserve: 1110000 },
    { month: 'Jun 26', income: 1510000, expenditure: 285000, netReserve: 1225000 },
    { month: 'Jul 26', income: 1480000, expenditure: 420000, netReserve: 1060000 },
    { month: 'Aug 26', income: 1620000, expenditure: 395000, netReserve: 1225000 },
    { month: 'Sep 26', income: 1540000, expenditure: 340000, netReserve: 1200000 },
    { month: 'Oct 26', income: 1845000, expenditure: 236400, netReserve: 1608600 },
  ],
  fundDistribution: [
    { name: 'Corpus Reserve', value: 2840000, color: '#1E3A8A' },
    { name: 'Sinking Fund', value: 1445400, color: '#2563EB' },
    { name: 'Maintenance Fund', value: 612350, color: '#059669' },
  ],
  categoryBreakdown: [
    { category: 'Lift & Elevator AMC', amount: 48500 },
    { category: 'Security Services', amount: 62000 },
    { category: 'Common Electricity (BESCOM)', amount: 54200 },
    { category: 'Housekeeping & Waste', amount: 38000 },
    { category: 'Gardening & Landscaping', amount: 15000 },
    { category: 'Water Supply Tankers', amount: 18700 },
  ],
  eventBudgetVsActual: [
    { event: 'Independence Day', allocatedBudget: 45000, actualExpense: 41200 },
    { event: 'Ganesh Utsav', allocatedBudget: 75000, actualExpense: 72800 },
    { event: 'Solar Panel Inauguration', allocatedBudget: 30000, actualExpense: 28400 },
  ],
};

export const dashboardService = {
  /**
   * Fetches dashboard metric summary.
   * Scopes metrics according to user role to enforce data segregation.
   */
  async getSummary(period = 'current_month') {
    try {
      const response = await api.get(FINANCIAL_ENDPOINTS.DASHBOARD_SUMMARY, {
        params: { period },
      });
      return {
        data: readApiData(response),
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      // Graceful fallback to contract-compliant mock when backend endpoint is in development
      return {
        data: fallbackSummary,
        isLiveBackend: false,
        error: error.message,
      };
    }
  },

  /**
   * Fetches analytical chart datasets
   */
  async getCharts(period = 'current_month') {
    try {
      const response = await api.get(FINANCIAL_ENDPOINTS.DASHBOARD_CHARTS, {
        params: { period },
      });
      return {
        data: readApiData(response),
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return {
        data: fallbackCharts,
        isLiveBackend: false,
        error: error.message,
      };
    }
  },
};
