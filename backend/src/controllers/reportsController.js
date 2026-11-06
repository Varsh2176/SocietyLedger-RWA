import { Transaction, Fund, Society } from '../models/index.js';
import { maskBankAccount } from '../utils/maskBankAccount.js';
import {
  POSTED_MOVEMENT_DESCRIPTION,
  POSTED_PERIOD_DESCRIPTION,
  POSTED_VOUCHER_STATUSES,
  formatPeriodDate,
  fundBalanceDescription,
  fundBalanceScopeForRole,
  fundQueryForRole,
  resolveReportingPeriod,
} from '../utils/reportingPeriod.js';

async function reportingContext(req) {
  const society = await Society.findById(req.societyId).select('fiscalYearStartMonth');
  const now = new Date();
  const period = resolveReportingPeriod(req.query.period, now, society?.fiscalYearStartMonth);
  return { now, period };
}

/**
 * Income & Expenditure Statement Aggregation.
 * Totals use posted vouchers inside the selected period. Fund status does not
 * remove a posted voucher.
 */
export async function getIncomeExpenditure(req, res, next) {
  try {
    const { period } = await reportingContext(req);

    const transactions = await Transaction.find({
      society: req.societyId,
      date: { $gte: period.start, $lte: period.end },
      status: { $in: POSTED_VOUCHER_STATUSES },
    });

    const incomeMap = {};
    const expenseMap = {};
    let totalIncomePaise = 0;
    let totalExpensePaise = 0;

    for (const t of transactions) {
      const cat = t.category || (t.type === 'INCOME' ? 'General Income' : 'General Operating Expense');
      if (t.type === 'INCOME') {
        incomeMap[cat] = (incomeMap[cat] || 0) + t.amountPaise;
        totalIncomePaise += t.amountPaise;
      } else if (t.type === 'EXPENSE') {
        expenseMap[cat] = (expenseMap[cat] || 0) + t.amountPaise;
        totalExpensePaise += t.amountPaise;
      }
    }

    const incomeItems = Object.entries(incomeMap).map(([particulars, paise], idx) => ({
      code: `INC-${idx + 101}`,
      particulars,
      amount: paise / 100,
      amountPaise: paise,
    }));

    const expenseItems = Object.entries(expenseMap).map(([particulars, paise], idx) => ({
      code: `EXP-${idx + 101}`,
      particulars,
      amount: paise / 100,
      amountPaise: paise,
    }));

    res.status(200).json({
      success: true,
      message: 'Income and Expenditure statement generated.',
      data: {
        fiscalYear: period.fiscalYear,
        fiscalYearStartMonth: period.fiscalYearStartMonth,
        period: period.label,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        reportingPeriodKey: period.key,
        reportingPeriodShort: period.shortLabel,
        figureScope: 'POSTED_VOUCHERS_IN_PERIOD',
        postedVoucherStatuses: POSTED_VOUCHER_STATUSES,
        incomeExpenseDescription: POSTED_PERIOD_DESCRIPTION,
        generatedAt: new Date().toISOString(),
        income: {
          items: incomeItems,
          total: totalIncomePaise / 100,
          totalPaise: totalIncomePaise,
        },
        expenditure: {
          items: expenseItems,
          total: totalExpensePaise / 100,
          totalPaise: totalExpensePaise,
        },
        netSurplus: (totalIncomePaise - totalExpensePaise) / 100,
        netSurplusPaise: totalIncomePaise - totalExpensePaise,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fund Statement (Fund-wise movements).
 * Credits and debits stay the full posted ledger. Residents receive active
 * funds only. Other roles receive every fund status.
 */
export async function getFundStatement(req, res, next) {
  try {
    const { now, period } = await reportingContext(req);
    const funds = await Fund.find(fundQueryForRole(req.societyId, req.user?.role));

    let totalSocietyReservesPaise = 0;

    const fundStatements = await Promise.all(
      funds.map(async (fund) => {
        const transactions = await Transaction.find({
          society: req.societyId,
          fund: fund._id,
          status: { $in: POSTED_VOUCHER_STATUSES },
        });

        let creditsPaise = 0;
        let debitsPaise = 0;

        for (const t of transactions) {
          if (t.type === 'INCOME') creditsPaise += t.amountPaise;
          if (t.type === 'EXPENSE') debitsPaise += t.amountPaise;
        }

        totalSocietyReservesPaise += fund.currentBalancePaise;

        return {
          id: fund._id,
          fundName: fund.name,
          fundCode: fund.code,
          type: fund.type,
          status: fund.status,
          openingBalance: fund.openingBalanceRupees,
          openingBalancePaise: fund.openingBalancePaise,
          totalCredits: creditsPaise / 100,
          totalCreditsPaise: creditsPaise,
          totalDebits: debitsPaise / 100,
          totalDebitsPaise: debitsPaise,
          closingBalance: fund.currentBalanceRupees,
          closingBalancePaise: fund.currentBalancePaise,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Fund movement statement generated.',
      data: {
        fiscalYear: period.fiscalYear,
        fiscalYearStartMonth: period.fiscalYearStartMonth,
        period: `As of ${formatPeriodDate(now)}`,
        asOfDate: now.toISOString().split('T')[0],
        requestedPeriod: period.label,
        requestedPeriodKey: period.key,
        balancesFollowRequestedPeriod: false,
        figureScope: 'ALL_POSTED_VOUCHER_MOVEMENTS',
        fundBalanceScope: fundBalanceScopeForRole(req.user?.role),
        fundBalanceDescription: fundBalanceDescription(req.user?.role),
        movementDescription: POSTED_MOVEMENT_DESCRIPTION,
        postedVoucherStatuses: POSTED_VOUCHER_STATUSES,
        funds: fundStatements,
        totalSocietyReserves: totalSocietyReservesPaise / 100,
        totalSocietyReservesPaise,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Balance Sheet Statement.
 * Amounts are current fund balances as of the response date. The fiscal year
 * comes from the society's start month. The requested period is returned for
 * context and does not restate the balances.
 */
export async function getBalanceSheet(req, res, next) {
  try {
    const { now, period } = await reportingContext(req);
    const funds = await Fund.find(fundQueryForRole(req.societyId, req.user?.role));

    let totalFundsPaise = 0;
    const liabilities = [];

    for (const f of funds) {
      totalFundsPaise += f.currentBalancePaise;
      liabilities.push({
        category: `${f.name} (${f.code})`,
        amount: f.currentBalanceRupees,
        amountPaise: f.currentBalancePaise,
      });
    }

    const assets = funds.map((f) => ({
      category:
        req.user?.role === 'Resident'
          ? maskBankAccount(f.bankAccount)
          : f.bankAccount || `${f.name} Deposit Account`,
      amount: f.currentBalanceRupees,
      amountPaise: f.currentBalancePaise,
    }));

    res.status(200).json({
      success: true,
      message: 'Balance sheet generated.',
      data: {
        fiscalYear: period.fiscalYear,
        fiscalYearStartMonth: period.fiscalYearStartMonth,
        asOfDate: now.toISOString().split('T')[0],
        period: `As of ${formatPeriodDate(now)}`,
        requestedPeriod: period.label,
        requestedPeriodKey: period.key,
        balancesFollowRequestedPeriod: false,
        figureScope: 'CURRENT_FUND_BALANCES',
        fundBalanceScope: fundBalanceScopeForRole(req.user?.role),
        fundBalanceDescription: fundBalanceDescription(req.user?.role),
        liabilities,
        totalLiabilities: totalFundsPaise / 100,
        totalLiabilitiesPaise: totalFundsPaise,
        assets,
        totalAssets: totalFundsPaise / 100,
        totalAssetsPaise: totalFundsPaise,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
