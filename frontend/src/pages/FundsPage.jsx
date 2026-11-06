import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  Building,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Eye,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  CreditCard,
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
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { fundsService } from '../services/fundsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { USER_ROLES, FUND_TYPES } from '../services/apiContract';
import { formatINR, formatDate } from '../utils/formatters';

export function FundsPage() {
  const { role } = useAuth();
  const { addToast } = useToast();

  const isTreasurerOrAdmin = role === USER_ROLES.ADMIN || role === USER_ROLES.TREASURER;

  const [funds, setFunds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');

  // Modals
  const [selectedFund, setSelectedFund] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: FUND_TYPES.SINKING,
    openingBalance: '',
    restrictedUse: true,
    purpose: '',
    bankAccount: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchFunds = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await fundsService.getFunds({
        search: searchTerm,
        type: selectedType,
      });
      setFunds(res.funds || []);
      setIsLiveBackend(res.isLiveBackend);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedType]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  // Aggregate summary totals using backend-provided figures
  const totalReserves = funds.reduce((acc, f) => acc + (Number(f.currentBalance) || 0), 0);
  const totalCorpus = funds
    .filter((f) => f.type === FUND_TYPES.CORPUS)
    .reduce((acc, f) => acc + (Number(f.currentBalance) || 0), 0);
  const totalSinking = funds
    .filter((f) => f.type === FUND_TYPES.SINKING)
    .reduce((acc, f) => acc + (Number(f.currentBalance) || 0), 0);
  const totalOperational = funds
    .filter((f) => f.type === FUND_TYPES.OPERATIONAL)
    .reduce((acc, f) => acc + (Number(f.currentBalance) || 0), 0);

  const validateCreateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Fund title is required.';
    if (!formData.code.trim()) errors.code = 'Fund identifier code is required.';
    if (!formData.openingBalance || isNaN(formData.openingBalance) || Number(formData.openingBalance) < 0) {
      errors.openingBalance = 'A valid non-negative opening balance is required.';
    }
    if (!formData.purpose.trim()) errors.purpose = 'Statutory governance purpose is required.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateFund = async (e) => {
    e.preventDefault();
    if (!validateCreateForm()) return;

    setIsSubmitting(true);
    try {
      await fundsService.createFund(formData);
      addToast({
        title: 'Fund Created',
        message: `Fund "${formData.name}" established under ${formData.type}.`,
        type: 'success',
      });
      setIsCreateModalOpen(false);
      setFormData({
        name: '',
        code: '',
        type: FUND_TYPES.SINKING,
        openingBalance: '',
        restrictedUse: true,
        purpose: '',
        bankAccount: '',
      });
      fetchFunds();
    } catch (err) {
      addToast({
        title: 'Fund Creation Failed',
        message: err.message || 'Error communicating with backend service.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fundColumns = [
    {
      key: 'code',
      header: 'Fund Code',
      width: '130px',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Fund Name & Purpose',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{row.name}</div>
          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{row.purpose}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Classification',
      width: '140px',
      render: (row) => {
        const typeMap = {
          [FUND_TYPES.CORPUS]: { label: 'Corpus Reserve', variant: 'purple' },
          [FUND_TYPES.SINKING]: { label: 'Sinking Fund', variant: 'info' },
          [FUND_TYPES.OPERATIONAL]: { label: 'Operational', variant: 'success' },
          [FUND_TYPES.SPECIAL_PROJECT]: { label: 'Special Project', variant: 'warning' },
        };
        const config = typeMap[row.type] || { label: row.type, variant: 'neutral' };
        return <StatusBadge variant={config.variant} size="sm">{config.label}</StatusBadge>;
      },
    },
    {
      key: 'openingBalance',
      header: 'Opening Bal',
      align: 'right',
      width: '120px',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatINR(row.openingBalance)}</span>
      ),
    },
    {
      key: 'currentBalance',
      header: 'Current Bal',
      align: 'right',
      width: '130px',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-900">
          {formatINR(row.currentBalance)}
        </span>
      ),
    },
    {
      key: 'restrictedUse',
      header: 'Usage Policy',
      align: 'center',
      width: '130px',
      render: (row) =>
        row.restrictedUse ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Lock size={10} /> Ring-Fenced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Unlock size={10} /> Operational
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '110px',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          icon={Eye}
          onClick={() => setSelectedFund(row)}
        >
          Details
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
              Funds & Reserves Management
            </h1>
            <StatusBadge variant={isLiveBackend ? 'success' : 'neutral'} size="sm" dot={true}>
              {isLiveBackend ? 'Live Backend Service' : 'Sample data — not society records'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Statutory capital reserves, sinking funds, and operational bank allocations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="md" icon={RefreshCw} onClick={fetchFunds}>
            Refresh
          </Button>
          {isTreasurerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Establish Fund
            </Button>
          )}
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Society Capital"
          value={formatINR(totalReserves)}
          icon={Wallet}
          subtitle="All 4 accounts aggregated"
        />
        <SummaryCard
          title="Corpus Reserve"
          value={formatINR(totalCorpus)}
          icon={Building}
          subtitle="Fixed deposit capital pool"
          badge={<StatusBadge variant="purple" size="sm">Protected</StatusBadge>}
        />
        <SummaryCard
          title="Sinking Reserves"
          value={formatINR(totalSinking)}
          icon={TrendingUp}
          subtitle="Capital asset replacements"
          badge={<StatusBadge variant="info" size="sm">Ring-Fenced</StatusBadge>}
        />
        <SummaryCard
          title="Operational Account"
          value={formatINR(totalOperational)}
          icon={ShieldCheck}
          subtitle="Monthly maintenance pool"
          badge={<StatusBadge variant="success" size="sm">Active</StatusBadge>}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <SearchFilterToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search funds by name, code or purpose..."
          filters={[
            {
              id: 'fundType',
              label: 'Classification',
              value: selectedType,
              onChange: setSelectedType,
              options: [
                { label: 'All Classifications', value: 'ALL' },
                { label: 'Corpus Reserve', value: FUND_TYPES.CORPUS },
                { label: 'Sinking Fund', value: FUND_TYPES.SINKING },
                { label: 'Operational Account', value: FUND_TYPES.OPERATIONAL },
                { label: 'Special Project', value: FUND_TYPES.SPECIAL_PROJECT },
              ],
            },
          ]}
          isFiltered={searchTerm !== '' || selectedType !== 'ALL'}
          onReset={() => {
            setSearchTerm('');
            setSelectedType('ALL');
          }}
        />

        {/* Data Table */}
        {isLoading ? (
          <div className="py-12">
            <LoadingState message="Loading society funds..." />
          </div>
        ) : hasError ? (
          <ErrorState
            title="Failed to retrieve funds"
            message="Could not load the society funds register."
            onRetry={fetchFunds}
          />
        ) : (
          <DataTable
            columns={fundColumns}
            data={funds}
            emptyTitle="No funds matching criteria"
            emptyDescription="Try clearing your search filters or create a new fund."
          />
        )}
      </div>

      {/* Create New Fund Modal (Treasurer & Admin) */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Wallet size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Establish Society Fund</h3>
                <p className="text-xs text-slate-500">Record a statutory reserve or operational sub-account</p>
              </div>
            </div>

            <form onSubmit={handleCreateFund} className="mt-4 space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Fund Name" htmlFor="fundName" required={true} error={formErrors.name}>
                  <Input
                    id="fundName"
                    placeholder="e.g. Lift Modernization Fund"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    error={Boolean(formErrors.name)}
                  />
                </FormField>

                <FormField label="Identifier Code" htmlFor="fundCode" required={true} error={formErrors.code}>
                  <Input
                    id="fundCode"
                    placeholder="e.g. FND-LIFT-26"
                    value={formData.code}
                    onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    error={Boolean(formErrors.code)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Classification" htmlFor="fundType" required={true}>
                  <Select
                    id="fundType"
                    value={formData.type}
                    onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                  >
                    <option value={FUND_TYPES.SINKING}>Sinking Fund (Capital Assets)</option>
                    <option value={FUND_TYPES.CORPUS}>Corpus Fund (Permanent Reserve)</option>
                    <option value={FUND_TYPES.OPERATIONAL}>Operational Account (Maintenance)</option>
                    <option value={FUND_TYPES.SPECIAL_PROJECT}>Special Project Fund</option>
                  </Select>
                </FormField>

                <FormField
                  label="Opening Balance (INR)"
                  htmlFor="openingBal"
                  required={true}
                  error={formErrors.openingBalance}
                >
                  <Input
                    id="openingBal"
                    type="number"
                    placeholder="e.g. 500000"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData((p) => ({ ...p, openingBalance: e.target.value }))}
                    error={Boolean(formErrors.openingBalance)}
                  />
                </FormField>
              </div>

              <FormField label="Linked Bank Account" htmlFor="bankAccount" optional={true}>
                <Input
                  id="bankAccount"
                  placeholder="e.g. HDFC Bank - A/C ****4891"
                  value={formData.bankAccount}
                  onChange={(e) => setFormData((p) => ({ ...p, bankAccount: e.target.value }))}
                  icon={CreditCard}
                />
              </FormField>

              <FormField
                label="Statutory Purpose & Restrictions"
                htmlFor="purpose"
                required={true}
                error={formErrors.purpose}
              >
                <textarea
                  id="purpose"
                  rows={2}
                  placeholder="Describe the governance mandate and permitted expenditures for this fund..."
                  value={formData.purpose}
                  onChange={(e) => setFormData((p) => ({ ...p, purpose: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </FormField>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="restrictedUse"
                  type="checkbox"
                  checked={formData.restrictedUse}
                  onChange={(e) => setFormData((p) => ({ ...p, restrictedUse: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="restrictedUse" className="text-xs text-slate-700">
                  Ring-fenced fund: Disbursements require special Management Committee signoff.
                </label>
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
                  Establish Fund
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fund Detail Drawer / Modal */}
      {selectedFund && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setSelectedFund(null)}
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Building size={22} />
              </div>
              <div>
                <span className="font-mono text-xs text-blue-600 font-semibold">{selectedFund.code}</span>
                <h3 className="text-base font-bold text-slate-900">{selectedFund.name}</h3>
                <p className="text-xs text-slate-500">{selectedFund.fiscalYear}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Opening Balance</span>
                  <div className="text-sm font-semibold text-slate-700 mt-0.5">
                    {formatINR(selectedFund.openingBalance)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] font-semibold">Current Balance</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                    {formatINR(selectedFund.currentBalance)}
                  </div>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700">Governance Mandate:</span>
                <p className="text-slate-600 mt-1 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                  {selectedFund.purpose}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-slate-500">Linked Bank Account:</span>
                <span className="font-mono text-slate-800 font-medium">{selectedFund.bankAccount || 'Not linked'}</span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">Last Bank Reconciliation:</span>
                <span className="text-slate-800 font-medium">{formatDate(selectedFund.lastReconciledAt)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" size="md" onClick={() => setSelectedFund(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
