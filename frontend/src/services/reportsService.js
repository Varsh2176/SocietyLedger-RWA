import api, { readApiData, shouldUseMockFallback } from './api.js';
import { FINANCIAL_ENDPOINTS } from './apiContract.js';
import { downloadCSV, formatINR } from '../utils/formatters.js';

const fallbackIncomeExpenditure = {
  fiscalYear: null,
  period: null,
  reportingPeriodShort: null,
  incomeExpenseDescription: null,
  generatedAt: '2026-10-25T23:59:00.000Z',
  income: {
    items: [
      { code: 'INC-MAINT', particulars: 'Monthly Maintenance Fees Collection', amount: 1470000 },
      { code: 'INC-CORPUS-INT', particulars: 'Fixed Deposit Quarterly Interest', amount: 54000 },
      { code: 'INC-CLUBHOUSE', particulars: 'Clubhouse Event Booking Charges', amount: 21000 },
      { code: 'INC-PENALTY', particulars: 'Late Payment Surcharges & Moving In Charges', amount: 8500 },
    ],
    total: 1553500,
  },
  expenditure: {
    items: [
      { code: 'EXP-SEC', particulars: 'Security Services (EagleEye Security LLP)', amount: 62000 },
      { code: 'EXP-ELEC', particulars: 'Common Utility Electricity (BESCOM)', amount: 54200 },
      { code: 'EXP-LIFT', particulars: 'Elevator Comprehensive AMC (Johnson Lifts)', amount: 18500 },
      { code: 'EXP-HK', particulars: 'Housekeeping & Garbage Disposal Charges', amount: 38000 },
      { code: 'EXP-GARDEN', particulars: 'Horticulture & Landscape Pruning', amount: 12000 },
      { code: 'EXP-WATER', particulars: 'Emergency Water Tanker Supply', amount: 18700 },
      { code: 'EXP-SOLAR-REP', particulars: 'Solar Inverter Synchronizer Overhaul', amount: 34200 },
    ],
    total: 237600,
  },
  netSurplus: 1315900,
};

const fallbackFundStatement = {
  fiscalYear: null,
  period: null,
  fundBalanceDescription: null,
  movementDescription: null,
  funds: [
    {
      fundName: 'General Corpus Reserve Fund',
      openingBalance: 2750000,
      totalCredits: 90000,
      totalDebits: 0,
      closingBalance: 2840000,
      status: 'AUDITED',
    },
    {
      fundName: 'Asset Replacement & Sinking Fund',
      openingBalance: 1320000,
      totalCredits: 204600,
      totalDebits: 79200,
      closingBalance: 1445400,
      status: 'AUDITED',
    },
    {
      fundName: 'Monthly Maintenance & Operational Account',
      openingBalance: 450000,
      totalCredits: 1470000,
      totalDebits: 1307650,
      closingBalance: 612350,
      status: 'RECONCILED',
    },
  ],
  totalSocietyReserves: 4897750,
};

const fallbackBalanceSheet = {
  fiscalYear: null,
  asOfDate: null,
  fundBalanceDescription: null,
  requestedPeriod: null,
  liabilities: [
    { category: 'Corpus Reserve Pool', amount: 2840000 },
    { category: 'Sinking Fund Reserve', amount: 1445400 },
    { category: 'Accumulated Surplus from Operations', amount: 612350 },
    { category: 'Outstanding Vendor Payables', amount: 46200 },
  ],
  totalLiabilities: 4943950,
  assets: [
    { category: 'Bank Fixed Deposits (HDFC / SBI)', amount: 3500000 },
    { category: 'Operational Bank Current Accounts', amount: 1182750 },
    { category: 'Petty Cash in Hand', amount: 15000 },
    { category: 'Maintenance Dues Receivable (Defaulters)', amount: 246200 },
  ],
  totalAssets: 4943950,
};

export const reportsService = {
  async getIncomeExpenditure(params = {}) {
    try {
      const response = await api.get(FINANCIAL_ENDPOINTS.REPORTS_INCOME_EXPENSE, { params });
      return { data: readApiData(response), isLiveBackend: true };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return { data: fallbackIncomeExpenditure, isLiveBackend: false };
    }
  },

  async getFundStatement(params = {}) {
    try {
      const response = await api.get(FINANCIAL_ENDPOINTS.REPORTS_FUND_STATEMENT, { params });
      return { data: readApiData(response), isLiveBackend: true };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return { data: fallbackFundStatement, isLiveBackend: false };
    }
  },

  async getBalanceSheet(params = {}) {
    try {
      const response = await api.get(FINANCIAL_ENDPOINTS.REPORTS_BALANCE_SHEET, { params });
      return { data: readApiData(response), isLiveBackend: true };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      return { data: fallbackBalanceSheet, isLiveBackend: false };
    }
  },

  /**
   * Export Income & Expenditure Statement to CSV
   */
  exportIncomeExpenseCSV(report) {
    const headers = ['Category', 'Code', 'Particulars', 'Amount (INR)'];
    const rows = [];

    // Income items
    report.income.items.forEach((item) => {
      rows.push(['Income', item.code, item.particulars, item.amount]);
    });
    rows.push(['Total Income', '', '', report.income.total]);
    rows.push(['', '', '', '']); // Blank line

    // Expenditure items
    report.expenditure.items.forEach((item) => {
      rows.push(['Expenditure', item.code, item.particulars, item.amount]);
    });
    rows.push(['Total Expenditure', '', '', report.expenditure.total]);
    rows.push(['', '', '', '']);

    rows.push(['Net Surplus / (Deficit)', '', '', report.netSurplus]);

    downloadCSV(headers, rows, `Income_Expenditure_${String(report.fiscalYear || 'statement').replace(/\s+/g, '_')}.csv`);
  },

  /**
   * Export Fund-wise Statement to CSV
   */
  exportFundStatementCSV(statement) {
    const headers = ['Fund Name', 'Opening Balance (INR)', 'Credits (INR)', 'Debits (INR)', 'Closing Balance (INR)', 'Audit Status'];
    const rows = statement.funds.map((f) => [
      f.fundName,
      f.openingBalance,
      f.totalCredits,
      f.totalDebits,
      f.closingBalance,
      f.status,
    ]);
    rows.push(['Total Reserves', '', '', '', statement.totalSocietyReserves, '']);

    downloadCSV(headers, rows, `Fund_Statement_${String(statement.fiscalYear || 'statement').replace(/\s+/g, '_')}.csv`);
  },
};
