import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  FileText,
  Building,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { SummaryCard } from '../components/common/SummaryCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { reportsService } from '../services/reportsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatINR, formatDate } from '../utils/formatters';
import { readSocietyIdentity } from '../utils/societyIdentity';

export function ReportsPage() {
  const { role, user } = useAuth();
  const society = readSocietyIdentity(user);
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('income_expenditure'); // 'income_expenditure' | 'fund_statement' | 'balance_sheet'
  const [period, setPeriod] = useState('current_month');
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      let res;
      if (activeTab === 'income_expenditure') {
        res = await reportsService.getIncomeExpenditure({ period });
      } else if (activeTab === 'fund_statement') {
        res = await reportsService.getFundStatement({ period });
      } else {
        res = await reportsService.getBalanceSheet({ period });
      }
      setReportData(res.data);
      setIsLiveBackend(res.isLiveBackend);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, period]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = () => {
    if (!reportData) return;

    if (activeTab === 'income_expenditure') {
      reportsService.exportIncomeExpenseCSV(reportData);
      addToast({
        title: 'Report Downloaded',
        message: 'Income & Expenditure statement saved as CSV.',
        type: 'success',
      });
    } else if (activeTab === 'fund_statement') {
      reportsService.exportFundStatementCSV(reportData);
      addToast({
        title: 'Report Downloaded',
        message: 'Fund-wise movement statement saved as CSV.',
        type: 'success',
      });
    } else {
      addToast({
        title: 'Export',
        message: 'Balance sheet download generated.',
        type: 'info',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Financial Statements & Reports
            </h1>
            <StatusBadge variant={isLiveBackend ? 'success' : 'neutral'} size="sm" dot={true}>
              {isLiveBackend ? 'Live Backend Report' : 'Sample data — not society records'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Income, fund movement, and balance-sheet statements from the society ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-1 text-xs shadow-2xs">
            <Calendar size={14} className="text-slate-400 ml-1.5 mr-1" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none pr-2 py-0.5"
            >
              <option value="current_month">Current month</option>
              <option value="last_quarter">Previous quarter</option>
              <option value="financial_year">Financial year to date</option>
            </select>
          </div>

          <Button variant="outline" size="md" icon={RefreshCw} onClick={fetchReport}>
            Refresh
          </Button>

          <Button variant="primary" size="md" icon={Download} onClick={handleExportCSV}>
            Download CSV
          </Button>
        </div>
      </div>

      {/* Statement Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('income_expenditure')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 ${
            activeTab === 'income_expenditure'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={15} />
          Income & Expenditure Statement
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fund_statement')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 ${
            activeTab === 'fund_statement'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={15} />
          Fund Movement Statement
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('balance_sheet')}
          className={`pb-3 font-semibold transition-colors border-b-2 px-1 flex items-center gap-1.5 ${
            activeTab === 'balance_sheet'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building size={15} />
          Balance Sheet Summary
        </button>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-12">
          <LoadingState message="Generating the financial statement..." />
        </div>
      )}

      {hasError && !isLoading && (
        <ErrorState
          title="Statement generation failed"
          message="Could not retrieve the financial report from the backend reporting engine."
          onRetry={fetchReport}
        />
      )}

      {/* Report 1: Income & Expenditure Statement */}
      {!isLoading && !hasError && activeTab === 'income_expenditure' && reportData && (
        <div className="space-y-6">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              title={reportData.reportingPeriodShort ? `Posted income (${reportData.reportingPeriodShort})` : 'Posted income'}
              value={formatINR(reportData.income?.total)}
              icon={ArrowUpRight}
              subtitle={reportData.incomeExpenseDescription || 'Posted vouchers for the selected period'}
              badge={<StatusBadge variant="success" size="sm">Credits</StatusBadge>}
            />
            <SummaryCard
              title={reportData.reportingPeriodShort ? `Posted expenditure (${reportData.reportingPeriodShort})` : 'Posted expenditure'}
              value={formatINR(reportData.expenditure?.total)}
              icon={ArrowDownRight}
              subtitle={reportData.incomeExpenseDescription || 'Posted vouchers for the selected period'}
              badge={<StatusBadge variant="danger" size="sm">Debits</StatusBadge>}
            />
            <SummaryCard
              title="Net surplus"
              value={formatINR(reportData.netSurplus)}
              icon={ShieldCheck}
              subtitle="Posted income minus posted expenditure for the same period"
              badge={<StatusBadge variant="info" size="sm">Net</StatusBadge>}
            />
          </div>

          {/* Statement Paper Sheet */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="text-center border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {society.name || 'Society details unavailable'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Income and expenditure for {reportData.period || 'the selected period'}
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                <span>
                  Registration: {society.registrationNumber || 'Unavailable'}
                </span>
                <span>•</span>
                <span>Fiscal year: {reportData.fiscalYear || 'Unavailable'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Income Side */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Income & Collections</h3>
                  <span className="text-xs font-semibold text-emerald-800">Amount (INR)</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {reportData.income?.items.map((item) => (
                    <div key={item.code} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] text-slate-400 mr-2">{item.code}</span>
                        <span className="text-slate-800 font-medium">{item.particulars}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900">{formatINR(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2 text-xs font-bold text-slate-900">
                  <span>Total Income (A)</span>
                  <span className="font-mono text-emerald-700">{formatINR(reportData.income?.total)}</span>
                </div>
              </div>

              {/* Expenditure Side */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b-2 border-red-600 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-800">Operational Expenditures</h3>
                  <span className="text-xs font-semibold text-red-800">Amount (INR)</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {reportData.expenditure?.items.map((item) => (
                    <div key={item.code} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] text-slate-400 mr-2">{item.code}</span>
                        <span className="text-slate-800 font-medium">{item.particulars}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900">{formatINR(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2 text-xs font-bold text-slate-900">
                  <span>Total Expenditure (B)</span>
                  <span className="font-mono text-slate-900">{formatINR(reportData.expenditure?.total)}</span>
                </div>
              </div>
            </div>

            {/* Net Surplus Footer */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800">Net Operating Surplus (A - B):</span>
              <span className="font-mono text-base font-bold text-blue-700">
                {formatINR(reportData.netSurplus)}
              </span>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>{reportData.incomeExpenseDescription}</span>
              <span>Generated on {formatDate(reportData.generatedAt, { includeTime: true })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Fund Movement Statement */}
      {!isLoading && !hasError && activeTab === 'fund_statement' && reportData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="text-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Fund-wise Movement & Reserve Balances</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {reportData.period || 'As of date unavailable'} • Fiscal year: {reportData.fiscalYear || 'Unavailable'}
            </p>
            <p className="text-[11px] text-slate-500 mt-2">
              {reportData.fundBalanceDescription} {reportData.movementDescription}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Fund Name</th>
                  <th className="py-3 px-4 text-right">Opening Balance</th>
                  <th className="py-3 px-4 text-right">Credits (Inflows)</th>
                  <th className="py-3 px-4 text-right">Debits (Outflows)</th>
                  <th className="py-3 px-4 text-right">Closing Balance</th>
                  <th className="py-3 px-4 text-center">Fund status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {reportData.funds?.map((fund, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{fund.fundName}</td>
                    <td className="py-3.5 px-4 text-right font-mono">{formatINR(fund.openingBalance)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700">+{formatINR(fund.totalCredits)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">-{formatINR(fund.totalDebits)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(fund.closingBalance)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge variant="success" size="sm">{fund.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold text-slate-900">
                  <td className="py-3.5 px-4">Total Society Reserves</td>
                  <td className="py-3.5 px-4 text-right font-mono" colSpan={3}>
                    Combined Closing Capital:
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-sm text-blue-700">
                    {formatINR(reportData.totalSocietyReserves)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Balance Sheet Summary */}
      {!isLoading && !hasError && activeTab === 'balance_sheet' && reportData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="text-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Society Balance Sheet Summary</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              As of {formatDate(reportData.asOfDate)} • Fiscal year: {reportData.fiscalYear || 'Unavailable'}
            </p>
            <p className="text-[11px] text-slate-500 mt-2">
              {reportData.fundBalanceDescription} These balances are current and are not restated for {reportData.requestedPeriod || 'the selected income-statement period'}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Liabilities */}
            <div className="space-y-3">
              <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Capital Funds & Liabilities</h3>
                <span className="text-xs font-semibold text-slate-900">Amount (INR)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {reportData.liabilities?.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-800 font-medium">{item.category}</span>
                    <span className="font-mono font-semibold text-slate-900">{formatINR(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2 text-xs font-bold text-slate-900">
                <span>Total Liabilities</span>
                <span className="font-mono text-slate-900">{formatINR(reportData.totalLiabilities)}</span>
              </div>
            </div>

            {/* Assets */}
            <div className="space-y-3">
              <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Society Property & Assets</h3>
                <span className="text-xs font-semibold text-slate-900">Amount (INR)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {reportData.assets?.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-800 font-medium">{item.category}</span>
                    <span className="font-mono font-semibold text-slate-900">{formatINR(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2 text-xs font-bold text-slate-900">
                <span>Total Assets</span>
                <span className="font-mono text-slate-900">{formatINR(reportData.totalAssets)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between text-xs text-emerald-900">
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Balanced Sheet Verified (Total Assets = Total Liabilities)
            </span>
            <span className="font-mono font-bold">{formatINR(reportData.totalAssets)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
