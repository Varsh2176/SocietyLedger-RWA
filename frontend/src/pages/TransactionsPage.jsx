import React, { useState, useEffect, useCallback } from 'react';
import {
  ReceiptText,
  Plus,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Eye,
  RotateCcw,
  CheckCircle2,
  X,
  CreditCard,
  Building,
  UserCheck,
  Calendar,
  Layers,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { SummaryCard } from '../components/common/SummaryCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { FormField } from '../components/common/FormField';
import { SearchFilterToolbar } from '../components/common/SearchFilterToolbar';
import { DataTable } from '../components/common/DataTable';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { transactionsService } from '../services/transactionsService';
import { fundsService } from '../services/fundsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  USER_ROLES,
  TRANSACTION_STATUS,
  TRANSACTION_TYPES,
  PAYMENT_METHODS,
} from '../services/apiContract';
import { formatINR, formatDate, getStatusConfig, downloadCSV } from '../utils/formatters';

export function TransactionsPage() {
  const { role } = useAuth();
  const { addToast } = useToast();

  const isTreasurerOrAdmin = role === USER_ROLES.ADMIN || role === USER_ROLES.TREASURER;
  const isAuditor = role === USER_ROLES.AUDITOR;

  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  // Available Funds for Dropdown
  const [availableFunds, setAvailableFunds] = useState([]);

  // Server-side filter state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fundFilter, setFundFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals State
  const [selectedTx, setSelectedTx] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [txToReverse, setTxToReverse] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Voucher Form
  const [newVoucher, setNewVoucher] = useState({
    reference: '',
    date: new Date().toISOString().split('T')[0],
    type: TRANSACTION_TYPES.EXPENSE,
    fund: '',
    fundCode: '',
    category: '',
    description: '',
    amount: '',
    paymentMethod: PAYMENT_METHODS.NEFT_RTGS,
    vendorName: '',
    invoiceNumber: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch Available Funds
  useEffect(() => {
    fundsService.getFunds().then((res) => {
      setAvailableFunds(res.funds || []);
      if (res.funds && res.funds.length > 0) {
        setNewVoucher((prev) => ({
          ...prev,
          fund: res.funds[0].name,
          fundCode: res.funds[0].code,
        }));
      }
    });
  }, []);

  // Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await transactionsService.getTransactions({
        page,
        limit: pageSize,
        search: searchTerm,
        type: typeFilter,
        fund: fundFilter,
        status: statusFilter,
        startDate,
        endDate,
        sortKey,
        sortOrder,
      });

      setTransactions(res.data || []);
      setTotalCount(res.total || 0);
      setIsLiveBackend(res.isLiveBackend);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    pageSize,
    searchTerm,
    typeFilter,
    fundFilter,
    statusFilter,
    startDate,
    endDate,
    sortKey,
    sortOrder,
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const validateVoucher = () => {
    const errors = {};
    if (!newVoucher.description.trim()) errors.description = 'Particulars description is required.';
    if (!newVoucher.category.trim()) errors.category = 'Expenditure/Income category is required.';
    if (!newVoucher.amount || isNaN(newVoucher.amount) || Number(newVoucher.amount) <= 0) {
      errors.amount = 'Valid positive amount in INR is required.';
    }
    if (!newVoucher.fund) errors.fund = 'Target fund allocation is required.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!validateVoucher()) return;

    setIsSubmitting(true);
    try {
      await transactionsService.createTransaction(newVoucher);
      addToast({
        title: 'Voucher Recorded',
        message: `Transaction recorded under ${newVoucher.fundCode}. Status: PENDING signoff.`,
        type: 'success',
      });
      setIsCreateModalOpen(false);
      setNewVoucher({
        reference: '',
        date: new Date().toISOString().split('T')[0],
        type: TRANSACTION_TYPES.EXPENSE,
        fund: availableFunds[0]?.name || '',
        fundCode: availableFunds[0]?.code || '',
        category: '',
        description: '',
        amount: '',
        paymentMethod: PAYMENT_METHODS.NEFT_RTGS,
        vendorName: '',
        invoiceNumber: '',
      });
      fetchTransactions();
    } catch (err) {
      addToast({
        title: 'Voucher Recording Failed',
        message: err.message || 'Error communicating with backend service.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reversal Action
  const handleConfirmReversal = async () => {
    if (!txToReverse || !reversalReason.trim()) {
      addToast({
        title: 'Justification Required',
        message: 'A formal justification reason is required to reverse an audited voucher.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await transactionsService.reverseTransaction(txToReverse.id, reversalReason);
      addToast({
        title: 'Voucher Reversed',
        message: `Voucher ${txToReverse.reference} has been officially reversed with audit trail.`,
        type: 'info',
      });
      setIsReversalModalOpen(false);
      setTxToReverse(null);
      setReversalReason('');
      if (selectedTx && selectedTx.id === txToReverse.id) {
        setSelectedTx((prev) => ({
          ...prev,
          status: TRANSACTION_STATUS.REVERSED,
          reversalReason,
        }));
      }
      fetchTransactions();
    } catch (err) {
      addToast({
        title: 'Reversal Failed',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    const headers = [
      'Reference',
      'Date',
      'Type',
      'Fund',
      'Category',
      'Particulars',
      'Amount (INR)',
      'Payment Method',
      'Status',
      'Vendor',
      'Invoice No',
    ];
    const rows = transactions.map((t) => [
      t.reference,
      t.date,
      t.type,
      t.fund,
      t.category,
      t.description,
      t.amount,
      t.paymentMethod,
      t.status,
      t.vendorName || '',
      t.invoiceNumber || '',
    ]);
    downloadCSV(headers, rows, `General_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const columns = [
    {
      key: 'reference',
      header: 'Voucher ID',
      width: '130px',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">{row.reference}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      width: '110px',
      sortable: true,
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.date)}</span>,
    },
    {
      key: 'description',
      header: 'Particulars & Allocation',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800 text-xs">{row.description}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span className="font-medium text-slate-600">{row.category}</span>
            <span>•</span>
            <span>{row.fund}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '90px',
      render: (row) => (
        <span
          className={`text-xs font-semibold ${
            row.type === TRANSACTION_TYPES.INCOME ? 'text-emerald-700' : 'text-slate-700'
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: '130px',
      sortable: true,
      render: (row) => (
        <span
          className={`font-mono text-xs font-bold ${
            row.type === TRANSACTION_TYPES.INCOME ? 'text-emerald-700' : 'text-slate-900'
          }`}
        >
          {row.type === TRANSACTION_TYPES.INCOME ? '+ ' : '- '}
          {formatINR(row.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Audit State',
      align: 'right',
      width: '150px',
      render: (row) => {
        const config = getStatusConfig(row.status);
        return <StatusBadge variant={config.variant} size="sm">{config.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Details',
      align: 'right',
      width: '90px',
      render: (row) => (
        <Button variant="outline" size="sm" icon={Eye} onClick={() => setSelectedTx(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Transactions & General Ledger
            </h1>
            <StatusBadge variant={isLiveBackend ? 'success' : 'neutral'} size="sm" dot={true}>
              {isLiveBackend ? 'Live Ledger Service' : 'Sample data — not society records'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Immutable double-entry society financial vouchers, payments, and audit reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="md" icon={Download} onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button variant="outline" size="md" icon={RefreshCw} onClick={fetchTransactions}>
            Refresh
          </Button>
          {isTreasurerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Record Voucher
            </Button>
          )}
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        {/* Advanced Server-side Filter Toolbar */}
        <SearchFilterToolbar
          searchValue={searchTerm}
          onSearchChange={(val) => {
            setSearchTerm(val);
            setPage(1);
          }}
          searchPlaceholder="Search by reference, description or vendor..."
          filters={[
            {
              id: 'txType',
              label: 'Type',
              value: typeFilter,
              onChange: (v) => {
                setTypeFilter(v);
                setPage(1);
              },
              options: [
                { label: 'All Types', value: 'ALL' },
                { label: 'Expenditures', value: TRANSACTION_TYPES.EXPENSE },
                { label: 'Income & Dues', value: TRANSACTION_TYPES.INCOME },
              ],
            },
            {
              id: 'txStatus',
              label: 'Status',
              value: statusFilter,
              onChange: (v) => {
                setStatusFilter(v);
                setPage(1);
              },
              options: [
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Reconciled / Audited', value: TRANSACTION_STATUS.RECONCILED },
                { label: 'Approved', value: TRANSACTION_STATUS.APPROVED },
                { label: 'Pending Approval', value: TRANSACTION_STATUS.PENDING },
                { label: 'Paid', value: TRANSACTION_STATUS.PAID },
                { label: 'Rejected', value: TRANSACTION_STATUS.REJECTED },
                { label: 'Reversed', value: TRANSACTION_STATUS.REVERSED },
              ],
            },
            {
              id: 'txFund',
              label: 'Fund Allocation',
              value: fundFilter,
              onChange: (v) => {
                setFundFilter(v);
                setPage(1);
              },
              options: [
                { label: 'All Funds', value: 'ALL' },
                ...availableFunds.map((f) => ({ label: f.name, value: f.name })),
              ],
            },
          ]}
          isFiltered={
            searchTerm !== '' ||
            typeFilter !== 'ALL' ||
            statusFilter !== 'ALL' ||
            fundFilter !== 'ALL' ||
            startDate !== '' ||
            endDate !== ''
          }
          onReset={() => {
            setSearchTerm('');
            setTypeFilter('ALL');
            setStatusFilter('ALL');
            setFundFilter('ALL');
            setStartDate('');
            setEndDate('');
            setPage(1);
          }}
        />

        {/* Date Range Sub-row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Calendar size={13} /> Date Filter:
          </span>
          <div className="flex items-center gap-1.5">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            />
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="text-blue-600 hover:underline font-medium ml-2"
            >
              Clear dates
            </button>
          )}
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="py-12">
            <LoadingState message="Fetching ledger records from database..." />
          </div>
        ) : hasError ? (
          <ErrorState
            title="Failed to fetch transactions"
            message="Could not load the general ledger entries."
            onRetry={fetchTransactions}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={transactions}
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={handleSort}
              emptyTitle="No transactions found"
              emptyDescription="No records match your search query or date range filters."
            />

            <Pagination
              currentPage={page}
              totalPages={Math.ceil(totalCount / pageSize) || 1}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* Record New Voucher Modal (Treasurer & Admin) */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ReceiptText size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Financial Voucher</h3>
                <p className="text-xs text-slate-500">Record audited society expenditure or income</p>
              </div>
            </div>

            <form onSubmit={handleCreateVoucher} className="mt-4 space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Transaction Type" htmlFor="txType" required={true}>
                  <Select
                    id="txType"
                    value={newVoucher.type}
                    onChange={(e) => setNewVoucher((p) => ({ ...p, type: e.target.value }))}
                  >
                    <option value={TRANSACTION_TYPES.EXPENSE}>Expenditure</option>
                    <option value={TRANSACTION_TYPES.INCOME}>Income / Receipt</option>
                  </Select>
                </FormField>

                <FormField label="Voucher Date" htmlFor="txDate" required={true}>
                  <Input
                    id="txDate"
                    type="date"
                    value={newVoucher.date}
                    onChange={(e) => setNewVoucher((p) => ({ ...p, date: e.target.value }))}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Target Fund" htmlFor="txFund" required={true} error={formErrors.fund}>
                  <Select
                    id="txFund"
                    value={newVoucher.fund}
                    onChange={(e) => {
                      const selected = availableFunds.find((f) => f.name === e.target.value);
                      setNewVoucher((p) => ({
                        ...p,
                        fund: e.target.value,
                        fundCode: selected?.code || '',
                      }));
                    }}
                  >
                    {availableFunds.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label="Amount (INR)"
                  htmlFor="txAmount"
                  required={true}
                  error={formErrors.amount}
                >
                  <Input
                    id="txAmount"
                    type="number"
                    placeholder="e.g. 18500"
                    value={newVoucher.amount}
                    onChange={(e) => setNewVoucher((p) => ({ ...p, amount: e.target.value }))}
                    error={Boolean(formErrors.amount)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Category"
                  htmlFor="txCat"
                  required={true}
                  error={formErrors.category}
                >
                  <Input
                    id="txCat"
                    placeholder="e.g. Lift AMC, Security, BESCOM"
                    value={newVoucher.category}
                    onChange={(e) => setNewVoucher((p) => ({ ...p, category: e.target.value }))}
                    error={Boolean(formErrors.category)}
                  />
                </FormField>

                <FormField label="Payment Method" htmlFor="txMethod" required={true}>
                  <Select
                    id="txMethod"
                    value={newVoucher.paymentMethod}
                    onChange={(e) => setNewVoucher((p) => ({ ...p, paymentMethod: e.target.value }))}
                  >
                    <option value={PAYMENT_METHODS.NEFT_RTGS}>NEFT / RTGS Bank Transfer</option>
                    <option value={PAYMENT_METHODS.UPI}>UPI (Razorpay / QR)</option>
                    <option value={PAYMENT_METHODS.CHEQUE}>Bank Cheque</option>
                    <option value={PAYMENT_METHODS.CASH}>Petty Cash</option>
                  </Select>
                </FormField>
              </div>

              <FormField
                label="Particulars / Description"
                htmlFor="txDesc"
                required={true}
                error={formErrors.description}
              >
                <textarea
                  id="txDesc"
                  rows={2}
                  placeholder="Detailed breakdown of the expenditure or collection batch..."
                  value={newVoucher.description}
                  onChange={(e) => setNewVoucher((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Vendor / Payee Name" htmlFor="txVendor" optional={true}>
                  <Input
                    id="txVendor"
                    placeholder="e.g. Johnson Lifts Pvt Ltd"
                    value={newVoucher.vendorName}
                    onChange={(e) => setNewVoucher((p) => ({ ...p, vendorName: e.target.value }))}
                  />
                </FormField>

                <FormField label="Invoice / Receipt Ref No." htmlFor="txInv" optional={true}>
                  <Input
                    id="txInv"
                    placeholder="e.g. INV-JL-2026-441"
                    value={newVoucher.invoiceNumber}
                    onChange={(e) => setNewVoucher((p) => ({ ...p, invoiceNumber: e.target.value }))}
                  />
                </FormField>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <Button
                  variant="outline"
                  size="md"
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
                  Record Voucher
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Detail View Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ReceiptText size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {selectedTx.reference}
                  </span>
                  <StatusBadge variant={getStatusConfig(selectedTx.status).variant} size="sm">
                    {getStatusConfig(selectedTx.status).label}
                  </StatusBadge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedTx.description}</h3>
                <p className="text-xs text-slate-500">Date: {formatDate(selectedTx.date)}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Amount</span>
                  <div className="text-xl font-bold font-mono text-slate-900">
                    {formatINR(selectedTx.amount)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Classification</span>
                  <div className="text-xs font-semibold text-slate-800">{selectedTx.type}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500">Fund Account:</span>
                  <p className="font-semibold text-slate-800">{selectedTx.fund}</p>
                </div>
                <div>
                  <span className="text-slate-500">Category:</span>
                  <p className="font-semibold text-slate-800">{selectedTx.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5">
                <div>
                  <span className="text-slate-500">Vendor / Payee:</span>
                  <p className="text-slate-800 font-medium">{selectedTx.vendorName || 'Not applicable'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Invoice / Bill Ref:</span>
                  <p className="font-mono text-slate-800 font-medium">{selectedTx.invoiceNumber || 'None'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5">
                <div>
                  <span className="text-slate-500">Payment Mode:</span>
                  <p className="text-slate-800 font-medium">{selectedTx.paymentMethod}</p>
                </div>
                <div>
                  <span className="text-slate-500">Bank Reconciliation:</span>
                  <p className="font-mono text-slate-800 font-medium">{selectedTx.reconciliationReference || 'Pending'}</p>
                </div>
              </div>

              {selectedTx.reversalReason && (
                <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-red-800">
                  <span className="font-semibold">Reversal Audit Reason: </span>
                  <span>{selectedTx.reversalReason}</span>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              {/* Financial Safety: Audited Reversal instead of deletion */}
              {isTreasurerOrAdmin && selectedTx.status !== TRANSACTION_STATUS.REVERSED && (
                <Button
                  variant="dangerOutline"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => {
                    setTxToReverse(selectedTx);
                    setIsReversalModalOpen(true);
                  }}
                >
                  Reverse Voucher
                </Button>
              )}
              <div className="ml-auto">
                <Button variant="primary" size="md" onClick={() => setSelectedTx(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Dialog with Mandatory Justification */}
      {isReversalModalOpen && txToReverse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Audited Reversal: {txToReverse.reference}
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Financial Safety Rule: Finalized transactions are never silently deleted. A reversal voucher will be appended to the immutable audit trail.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <FormField
                label="Mandatory Reversal Justification"
                htmlFor="revReason"
                required={true}
                hint="Explain the discrepancy, calculation error, or duplicate entry for statutory audit records."
              >
                <textarea
                  id="revReason"
                  rows={3}
                  placeholder="e.g. Duplicate entry posted for Johnson Lifts AMC (Invoice already settled under VR-2026-041)."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </FormField>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setIsReversalModalOpen(false);
                  setTxToReverse(null);
                  setReversalReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleConfirmReversal}
                isLoading={isSubmitting}
              >
                Execute Reversal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
