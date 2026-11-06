import { Fund, Transaction, Approval, Event, Compliance, Reconciliation, Observation, Society } from '../models/index.js';
import { PUBLISHED_EVENT_STATUSES, PUBLISHED_TRANSACTION_STATUSES } from '../utils/maskBankAccount.js';
import {
  POSTED_PERIOD_DESCRIPTION,
  POSTED_VOUCHER_STATUSES,
  formatPeriodDate,
  fundBalanceDescription,
  fundBalanceScopeForRole,
  fundQueryForRole,
  resolveReportingPeriod,
} from '../utils/reportingPeriod.js';

const APPROVAL_SUMMARY_ROLES = new Set(['Society Administrator', 'Treasurer', 'Committee Member']);
const RECONCILIATION_SUMMARY_ROLES = new Set(['Society Administrator', 'Treasurer', 'Committee Member', 'Auditor']);
const OBSERVATION_SUMMARY_ROLES = new Set(['Society Administrator', 'Treasurer', 'Committee Member', 'Auditor']);

/**
 * Removes committee and audit counts from roles that cannot access those records.
 * Published fund and cash-flow figures remain for every authenticated member.
 */
export function projectDashboardSummary(role, summary) {
  const projected = {
    totalAvailableFunds: summary.totalAvailableFunds,
    corpusFundBalance: summary.corpusFundBalance,
    maintenanceFundBalance: summary.maintenanceFundBalance,
    sinkingFundBalance: summary.sinkingFundBalance,
    totalIncomeMonth: summary.totalIncomeMonth,
    totalExpenseMonth: summary.totalExpenseMonth,
    overdueComplianceCount: summary.overdueComplianceCount,
    reportingPeriodLabel: summary.reportingPeriodLabel,
    reportingPeriodShort: summary.reportingPeriodShort,
    fiscalYear: summary.fiscalYear,
    fiscalYearStartMonth: summary.fiscalYearStartMonth,
    fundBalanceScope: summary.fundBalanceScope,
    fundBalanceDescription: summary.fundBalanceDescription,
    incomeExpenseDescription: summary.incomeExpenseDescription,
    postedVoucherStatuses: summary.postedVoucherStatuses,
    fundChangePercent: summary.fundChangePercent,
    statutoryAuditStatus: summary.statutoryAuditStatus,
  };

  if (APPROVAL_SUMMARY_ROLES.has(role)) {
    projected.pendingApprovalsCount = summary.pendingApprovalsCount;
  }
  if (RECONCILIATION_SUMMARY_ROLES.has(role)) {
    projected.pendingReconciliationsCount = summary.pendingReconciliationsCount;
  }
  if (OBSERVATION_SUMMARY_ROLES.has(role)) {
    projected.openAuditObservationsCount = summary.openAuditObservationsCount;
  }

  return projected;
}

/**
 * Dashboard Summary KPI Cards Aggregation
 */
export async function getDashboardSummary(req, res, next) {
  try {
    const societyId = req.societyId;
    const now = new Date();
    const society = await Society.findById(societyId).select('fiscalYearStartMonth');
    const reportingPeriod = resolveReportingPeriod(
      req.query.period,
      now,
      society?.fiscalYearStartMonth
    );

    // Residents receive active published funds. Governance and audit roles
    // retain active, suspended, and closed balances.
    const funds = await Fund.find(fundQueryForRole(societyId, req.user?.role));
    let totalAvailablePaise = 0;
    let corpusFundPaise = 0;
    let maintenanceFundPaise = 0;
    let sinkingFundPaise = 0;

    for (const f of funds) {
      totalAvailablePaise += f.currentBalancePaise;
      if (f.type === 'CORPUS') corpusFundPaise += f.currentBalancePaise;
      if (f.type === 'OPERATIONAL') maintenanceFundPaise += f.currentBalancePaise;
      if (f.type === 'SINKING') sinkingFundPaise += f.currentBalancePaise;
    }

    // 2. Published income and expense inside the selected reporting period
    const monthTx = await Transaction.find({
      society: societyId,
      date: { $gte: reportingPeriod.start, $lte: reportingPeriod.end },
      status: { $in: POSTED_VOUCHER_STATUSES },
    });

    let totalIncomeMonthPaise = 0;
    let totalExpenseMonthPaise = 0;
    for (const t of monthTx) {
      if (t.type === 'INCOME') totalIncomeMonthPaise += t.amountPaise;
      if (t.type === 'EXPENSE') totalExpenseMonthPaise += t.amountPaise;
    }

    // 3. Pending approvals count
    const pendingApprovalsCount = await Approval.countDocuments({
      society: societyId,
      status: 'PENDING',
    });

    // 4. Pending reconciliations count
    const pendingReconciliationsCount = await Reconciliation.countDocuments({
      society: societyId,
      status: { $in: ['PENDING', 'IN_PROGRESS', 'DISCREPANCY_UNRESOLVED'] },
    });

    // 5. Overdue compliance tasks
    const overdueComplianceCount = await Compliance.countDocuments({
      society: societyId,
      status: 'PENDING',
      deadline: { $lt: now },
    });

    // Change versus the balance implied at the start of the reporting period.
    // This is only defined when reversing published period activity leaves a positive opening balance.
    const netMovementPaise = totalIncomeMonthPaise - totalExpenseMonthPaise;
    const openingBalancePaise = totalAvailablePaise - netMovementPaise;
    const fundChangePercent =
      openingBalancePaise > 0
        ? Math.round((netMovementPaise / openingBalancePaise) * 1000) / 10
        : null;

    let openAuditObservationsCount = 'Unavailable';
    try {
      openAuditObservationsCount = await Observation.countDocuments({
        society: societyId,
        status: { $in: ['OPEN', 'UNDER_REVIEW'] },
      });
    } catch (countError) {
      console.error('[Dashboard] Open audit observation count failed:', countError.message);
    }

    const summary = {
      totalAvailableFunds: totalAvailablePaise / 100,
      corpusFundBalance: corpusFundPaise / 100,
      maintenanceFundBalance: maintenanceFundPaise / 100,
      sinkingFundBalance: sinkingFundPaise / 100,
      totalIncomeMonth: totalIncomeMonthPaise / 100,
      totalExpenseMonth: totalExpenseMonthPaise / 100,
      pendingApprovalsCount,
      pendingReconciliationsCount,
      overdueComplianceCount,
      openAuditObservationsCount,
      reportingPeriodLabel: reportingPeriod.label,
      reportingPeriodShort: reportingPeriod.shortLabel,
      fiscalYear: reportingPeriod.fiscalYear,
      fiscalYearStartMonth: reportingPeriod.fiscalYearStartMonth,
      fundBalanceScope: fundBalanceScopeForRole(req.user?.role),
      fundBalanceDescription: fundBalanceDescription(req.user?.role),
      incomeExpenseDescription: POSTED_PERIOD_DESCRIPTION,
      postedVoucherStatuses: POSTED_VOUCHER_STATUSES,
      fundChangePercent,
      statutoryAuditStatus: 'Unavailable',
    };

    res.status(200).json({
      success: true,
      message: 'Dashboard summary retrieved.',
      data: projectDashboardSummary(req.user?.role, summary),
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

const SETTLED_EVENT_STATUSES = ['COMPLETED', 'SETTLED'];

/**
 * Chart series use posted vouchers only. Pending, rejected, and reversed
 * vouchers are not plotted for any role. Actual event spending is included
 * only after an event is completed or settled. No governance requirement
 * records in-progress spend on this chart. Residents still receive active
 * funds and ratified events, and their budget is the approved amount.
 */
function presentEventChartPoint(event, role) {
  const point = {
    event: event.title,
    allocatedBudget: role === 'Resident'
      ? (event.approvedBudgetRupees || 0)
      : (event.approvedBudgetRupees || event.proposedBudgetRupees || 0),
  };
  if (SETTLED_EVENT_STATUSES.includes(event.status) && event.actualExpenditureRupees != null) {
    point.actualExpense = event.actualExpenditureRupees;
  }
  return point;
}

/**
 * Dashboard Visualizations Aggregation (Charts)
 */
export async function getDashboardCharts(req, res, next) {
  try {
    const societyId = req.societyId;
    const role = req.user?.role;
    const residentView = role === 'Resident';
    const now = new Date();

    // 1. Monthly cashflow (last 6 months) from posted vouchers only.
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const transactions = await Transaction.find({
      society: societyId,
      date: { $gte: sixMonthsAgo },
      status: { $in: PUBLISHED_TRANSACTION_STATUSES },
    }).sort({ date: 1 });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = {};

    // Initialize all 6 months in order
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      monthlyMap[label] = { month: label, income: 0, expenditure: 0, netReserve: 0 };
    }

    for (const t of transactions) {
      const d = new Date(t.date);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      if (monthlyMap[label]) {
        if (t.type === 'INCOME') monthlyMap[label].income += t.amountRupees;
        if (t.type === 'EXPENSE') monthlyMap[label].expenditure += t.amountRupees;
      }
    }

    const monthlyCashflow = Object.values(monthlyMap).map((m) => ({
      ...m,
      netReserve: m.income - m.expenditure,
    }));

    // 2. Fund distribution. Residents receive active published funds only.
    const funds = await Fund.find(fundQueryForRole(societyId, role));
    const COLORS = ['#1E3A8A', '#2563EB', '#059669', '#D97706', '#7C3AED'];
    const fundDistribution = funds.map((f, i) => ({
      name: f.name,
      value: f.currentBalanceRupees,
      color: COLORS[i % COLORS.length],
    }));

    // 3. Category breakdown of expenses
    const categoryMap = {};
    for (const t of transactions) {
      if (t.type === 'EXPENSE') {
        const cat = t.category || 'Other Operating Expense';
        categoryMap[cat] = (categoryMap[cat] || 0) + t.amountRupees;
      }
    }
    const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount,
    }));

    // 4. Event budget versus actual. Proposed, cancelled, and rejected events
    // stay off the resident chart. Other roles keep the operational series.
    const eventFilter = { society: societyId };
    if (residentView) {
      eventFilter.status = { $in: PUBLISHED_EVENT_STATUSES };
    }
    const events = await Event.find(eventFilter).sort({ date: -1 }).limit(5);
    const eventBudgetVsActual = events.map((event) => presentEventChartPoint(event, role));

    res.status(200).json({
      success: true,
      message: 'Dashboard charts retrieved.',
      data: {
        monthlyCashflow,
        fundDistribution,
        categoryBreakdown,
        eventBudgetVsActual,
        chartRange: 'PAST_SIX_MONTHS',
        chartRangeLabel: `${formatPeriodDate(sixMonthsAgo)} – ${formatPeriodDate(now)}`,
        chartRangeDescription:
          'Cash-flow and category charts cover the past six months. They are independent of the selected summary period.',
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
