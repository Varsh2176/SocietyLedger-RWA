import api, { shouldUseMockFallback } from './api.js';
import { FINANCIAL_ENDPOINTS, FUND_TYPES } from './apiContract.js';

const fallbackFunds = [
  {
    id: 'fnd_001',
    code: 'FND-CORPUS',
    name: 'General Corpus Reserve Fund',
    type: FUND_TYPES.CORPUS,
    openingBalance: 2750000,
    currentBalance: 2840000,
    restrictedUse: true,
    purpose: 'Permanent reserve capital held in fixed deposit. Interest utilized for society operational deficit.',
    fiscalYear: 'FY 2026-27',
    bankAccount: 'HDFC Bank - A/C ****4891',
    status: 'ACTIVE',
    lastReconciledAt: '2026-10-20',
  },
  {
    id: 'fnd_002',
    code: 'FND-SINKING',
    name: 'Asset Replacement & Sinking Fund',
    type: FUND_TYPES.SINKING,
    openingBalance: 1320000,
    currentBalance: 1445400,
    restrictedUse: true,
    purpose: 'Ring-fenced fund for elevator overhaul, exterior painting, and major structural refurbishments.',
    fiscalYear: 'FY 2026-27',
    bankAccount: 'SBI - A/C ****9102',
    status: 'ACTIVE',
    lastReconciledAt: '2026-10-22',
  },
  {
    id: 'fnd_003',
    code: 'FND-MAINT',
    name: 'Monthly Maintenance & Operational Account',
    type: FUND_TYPES.OPERATIONAL,
    openingBalance: 450000,
    currentBalance: 612350,
    restrictedUse: false,
    purpose: 'Working liquidity for security salaries, common electricity, water tankers, and routine repairs.',
    fiscalYear: 'FY 2026-27',
    bankAccount: 'ICICI Bank - A/C ****3310',
    status: 'ACTIVE',
    lastReconciledAt: '2026-10-24',
  },
  {
    id: 'fnd_004',
    code: 'FND-SOLAR',
    name: 'Rooftop Solar Special Project Fund',
    type: FUND_TYPES.SPECIAL_PROJECT,
    openingBalance: 0,
    currentBalance: 215000,
    restrictedUse: true,
    purpose: 'Member contributions toward Phase 2 grid-tied solar net metering infrastructure.',
    fiscalYear: 'FY 2026-27',
    bankAccount: 'ICICI Bank - A/C ****3310 (Sub-ledger)',
    status: 'ACTIVE',
    lastReconciledAt: '2026-10-18',
  },
];

export const fundsService = {
  /**
   * Retrieves funds with optional keyword search and type filter
   */
  async getFunds(params = {}) {
    try {
      const response = await api.get(FINANCIAL_ENDPOINTS.FUNDS, { params });
      return {
        funds: response.data?.data?.funds || response.data?.data || response.data,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      // Local search/filter on fallback data
      let filtered = [...fallbackFunds];
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.code.toLowerCase().includes(q) ||
            f.purpose.toLowerCase().includes(q)
        );
      }
      if (params.type && params.type !== 'ALL') {
        filtered = filtered.filter((f) => f.type === params.type);
      }

      return {
        funds: filtered,
        isLiveBackend: false,
        error: error.message,
      };
    }
  },

  /**
   * Get fund details by ID
   */
  async getFundById(id) {
    try {
      const response = await api.get(`${FINANCIAL_ENDPOINTS.FUNDS}/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const fund = fallbackFunds.find((f) => f.id === id);
      if (!fund) throw new Error('Fund not found');
      return fund;
    }
  },

  /**
   * Create a new fund (Admin / Treasurer only)
   */
  async createFund(data) {
    const payload = {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      type: data.type,
      openingBalance: Number(data.openingBalance) || 0,
      restrictedUse: Boolean(data.restrictedUse),
      purpose: data.purpose?.trim(),
      bankAccount: data.bankAccount?.trim(),
    };

    try {
      const response = await api.post(FINANCIAL_ENDPOINTS.FUNDS, payload);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (error.isNetworkError || error.status === 404) {
        // Optimistic local add for offline dev inspection
        const newFund = {
          id: `fnd_${Date.now()}`,
          ...payload,
          currentBalance: payload.openingBalance,
          status: 'ACTIVE',
          lastReconciledAt: 'Not yet reconciled',
        };
        fallbackFunds.push(newFund);
        return newFund;
      }
      throw error;
    }
  },
};
