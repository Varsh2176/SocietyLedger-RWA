import api, { shouldUseMockFallback } from './api.js';
import {
  FINANCIAL_ENDPOINTS,
  TRANSACTION_STATUS,
  TRANSACTION_TYPES,
  PAYMENT_METHODS,
} from './apiContract.js';

const fallbackTransactions = [
  {
    id: 'tx_001',
    reference: 'VR-2026-089',
    date: '2026-10-24',
    type: TRANSACTION_TYPES.EXPENSE,
    fund: 'Monthly Maintenance & Operational Account',
    fundCode: 'FND-MAINT',
    category: 'Lift & Elevator Maintenance',
    description: 'Johnson Lifts Annual Maintenance Contract (Q3 Comprehensive AMC)',
    amount: 18500,
    paymentMethod: PAYMENT_METHODS.NEFT_RTGS,
    status: TRANSACTION_STATUS.RECONCILED,
    vendorName: 'Johnson Lifts Pvt Ltd',
    invoiceNumber: 'INV-JL-2026-441',
    verifiedBy: 'Suresh Menon (Auditor)',
    approvedBy: 'Priya Sharma (Treasurer)',
    reconciliationReference: 'BANK-HDFC-9921',
  },
  {
    id: 'tx_002',
    reference: 'VR-2026-088',
    date: '2026-10-23',
    type: TRANSACTION_TYPES.INCOME,
    fund: 'Monthly Maintenance & Operational Account',
    fundCode: 'FND-MAINT',
    category: 'Maintenance Dues',
    description: 'October Maintenance Collection Batch — Wing C (Flat C-101 to C-404)',
    amount: 147000,
    paymentMethod: PAYMENT_METHODS.UPI,
    status: TRANSACTION_STATUS.RECONCILED,
    vendorName: null,
    invoiceNumber: 'RCPT-OCT-BATCH-C',
    verifiedBy: 'Suresh Menon (Auditor)',
    approvedBy: 'Priya Sharma (Treasurer)',
    reconciliationReference: 'UPI-RAZORPAY-COLLECT-401',
  },
  {
    id: 'tx_003',
    reference: 'VR-2026-087',
    date: '2026-10-22',
    type: TRANSACTION_TYPES.EXPENSE,
    fund: 'Asset Replacement & Sinking Fund',
    fundCode: 'FND-SINKING',
    category: 'Solar Capital Works',
    description: 'Replacement of Phase 1 20kVA Solar Inverter Grid Synchronizer',
    amount: 34200,
    paymentMethod: PAYMENT_METHODS.NEFT_RTGS,
    status: TRANSACTION_STATUS.APPROVED,
    vendorName: 'SunPower Renewable Systems',
    invoiceNumber: 'SP-BLR-892',
    verifiedBy: null,
    approvedBy: 'Dr. Anand Rao (President / Committee)',
    reconciliationReference: null,
  },
  {
    id: 'tx_004',
    reference: 'VR-2026-086',
    date: '2026-10-20',
    type: TRANSACTION_TYPES.EXPENSE,
    fund: 'Monthly Maintenance & Operational Account',
    fundCode: 'FND-MAINT',
    category: 'Gardening & Common Area',
    description: 'Monsoon Tree Pruning and Horticulture Landscaping Overhaul',
    amount: 12000,
    paymentMethod: PAYMENT_METHODS.CHEQUE,
    status: TRANSACTION_STATUS.PENDING,
    vendorName: 'GreenThumb Nurseries & Landscaping',
    invoiceNumber: 'GT-5091',
    verifiedBy: null,
    approvedBy: null,
    reconciliationReference: null,
  },
  {
    id: 'tx_005',
    reference: 'VR-2026-085',
    date: '2026-10-18',
    type: TRANSACTION_TYPES.EXPENSE,
    fund: 'Asset Replacement & Sinking Fund',
    fundCode: 'FND-SINKING',
    category: 'Clubhouse Amenities',
    description: 'Clubhouse Surround Sound System and Wireless Microphones',
    amount: 45000,
    paymentMethod: PAYMENT_METHODS.NEFT_RTGS,
    status: TRANSACTION_STATUS.REJECTED,
    vendorName: 'Acoustic Sound Tech',
    invoiceNumber: 'AST-2026-19',
    rejectionReason: 'Exceeded discretionary limit without 3 competitive quotation bids.',
    verifiedBy: null,
    approvedBy: null,
    reconciliationReference: null,
  },
  {
    id: 'tx_006',
    reference: 'VR-2026-084',
    date: '2026-10-15',
    type: TRANSACTION_TYPES.INCOME,
    fund: 'General Corpus Reserve Fund',
    fundCode: 'FND-CORPUS',
    category: 'Corpus Interest Deposit',
    description: 'Quarterly Fixed Deposit Interest Credit (FD #98102390)',
    amount: 54000,
    paymentMethod: PAYMENT_METHODS.NEFT_RTGS,
    status: TRANSACTION_STATUS.RECONCILED,
    vendorName: 'HDFC Bank Ltd',
    invoiceNumber: 'FD-INT-Q2-2026',
    verifiedBy: 'Suresh Menon (Auditor)',
    approvedBy: 'Priya Sharma (Treasurer)',
    reconciliationReference: 'BANK-HDFC-FD-9810',
  },
  {
    id: 'tx_007',
    reference: 'VR-2026-083',
    date: '2026-10-12',
    type: TRANSACTION_TYPES.EXPENSE,
    fund: 'Monthly Maintenance & Operational Account',
    fundCode: 'FND-MAINT',
    category: 'Security Services',
    description: 'Security Guard Agency Monthly Invoice (8 Guards + 1 Supervisor)',
    amount: 62000,
    paymentMethod: PAYMENT_METHODS.NEFT_RTGS,
    status: TRANSACTION_STATUS.PAID,
    vendorName: 'EagleEye Security Services LLP',
    invoiceNumber: 'EE-OCT-2026-77',
    verifiedBy: null,
    approvedBy: 'Priya Sharma (Treasurer)',
    reconciliationReference: null,
  },
  {
    id: 'tx_008',
    reference: 'VR-2026-082',
    date: '2026-10-10',
    type: TRANSACTION_TYPES.EXPENSE,
    fund: 'Monthly Maintenance & Operational Account',
    fundCode: 'FND-MAINT',
    category: 'Common Electricity',
    description: 'BESCOM Electricity Bill for Common Area Lighting & Water Pumps',
    amount: 54200,
    paymentMethod: PAYMENT_METHODS.UPI,
    status: TRANSACTION_STATUS.RECONCILED,
    vendorName: 'BESCOM Bengaluru',
    invoiceNumber: 'BES-RR-8849102',
    verifiedBy: 'Suresh Menon (Auditor)',
    approvedBy: 'Priya Sharma (Treasurer)',
    reconciliationReference: 'UPI-BESCOM-OCT-2026',
  },
];

export const transactionsService = {
  /**
   * Retrieves paginated transactions with server-side filters
   */
  async getTransactions(params = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      type = 'ALL',
      fund = 'ALL',
      status = 'ALL',
      startDate = '',
      endDate = '',
      sortKey = 'date',
      sortOrder = 'desc',
    } = params;

    try {
      const response = await api.get(FINANCIAL_ENDPOINTS.TRANSACTIONS, { params });
      return {
        data: response.data?.data?.transactions || response.data?.data || response.data,
        total: response.data?.meta?.total || response.data?.data?.transactions?.length,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      // Local server-side simulation for offline dev
      let filtered = [...fallbackTransactions];

      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.description.toLowerCase().includes(q) ||
            t.reference.toLowerCase().includes(q) ||
            (t.vendorName && t.vendorName.toLowerCase().includes(q)) ||
            (t.category && t.category.toLowerCase().includes(q))
        );
      }

      if (type && type !== 'ALL') {
        filtered = filtered.filter((t) => t.type === type);
      }

      if (fund && fund !== 'ALL') {
        filtered = filtered.filter((t) => t.fund === fund || t.fundCode === fund);
      }

      if (status && status !== 'ALL') {
        filtered = filtered.filter((t) => t.status === status);
      }

      if (startDate) {
        filtered = filtered.filter((t) => t.date >= startDate);
      }
      if (endDate) {
        filtered = filtered.filter((t) => t.date <= endDate);
      }

      // Sort
      filtered.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (sortKey === 'amount') {
          valA = Number(valA);
          valB = Number(valB);
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginatedData = filtered.slice(startIndex, startIndex + limit);

      return {
        data: paginatedData,
        total,
        isLiveBackend: false,
        error: error.message,
      };
    }
  },

  /**
   * Retrieves single transaction by ID
   */
  async getTransactionById(id) {
    try {
      const response = await api.get(`${FINANCIAL_ENDPOINTS.TRANSACTIONS}/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const tx = fallbackTransactions.find((t) => t.id === id || t.reference === id);
      if (!tx) throw new Error('Transaction record not found');
      return tx;
    }
  },

  /**
   * Create a new audited financial voucher (Treasurer / Admin)
   */
  async createTransaction(voucherData) {
    const payload = {
      reference: voucherData.reference?.trim() || `VR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: voucherData.date || new Date().toISOString().split('T')[0],
      type: voucherData.type,
      fund: voucherData.fund,
      fundCode: voucherData.fundCode,
      category: voucherData.category?.trim(),
      description: voucherData.description?.trim(),
      amount: Number(voucherData.amount),
      paymentMethod: voucherData.paymentMethod,
      vendorName: voucherData.vendorName?.trim() || null,
      invoiceNumber: voucherData.invoiceNumber?.trim() || null,
      status: TRANSACTION_STATUS.PENDING,
    };

    try {
      const response = await api.post(FINANCIAL_ENDPOINTS.TRANSACTIONS, payload);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (error.isNetworkError || error.status === 404) {
        const newRecord = {
          id: `tx_${Date.now()}`,
          ...payload,
        };
        fallbackTransactions.unshift(newRecord);
        return newRecord;
      }
      throw error;
    }
  },

  /**
   * Financial Safety Rule: Never silently delete finalized transactions.
   * Instead, execute an audited reversal with required justification.
   */
  async reverseTransaction(id, justification) {
    if (!justification || justification.trim().length < 5) {
      throw new Error('Mandatory reversal justification required by society audit rules.');
    }

    try {
      const response = await api.post(`${FINANCIAL_ENDPOINTS.TRANSACTIONS}/${id}/reverse`, {
        justification: justification.trim(),
      });
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const tx = fallbackTransactions.find((t) => t.id === id || t.reference === id);
      if (tx) {
        tx.status = TRANSACTION_STATUS.REVERSED;
        tx.reversalReason = justification.trim();
        tx.reversedAt = new Date().toISOString();
        return tx;
      }
      throw error;
    }
  },
};
