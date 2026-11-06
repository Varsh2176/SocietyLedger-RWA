/**
 * Reporting periods and fund-visibility labels.
 *
 * Fund balances:
 * - Residents see active funds only.
 * - Society Administrator, Treasurer, Committee Member, and Auditor see
 *   active, suspended, and closed funds.
 *
 * Posted income and expenditure:
 * - Count vouchers with status APPROVED, PAID, or RECONCILED.
 * - Include those vouchers whether the fund is active, suspended, or closed.
 * - Dashboard and income-statement totals use the selected period.
 * - Resident transparency collections are the full posted ledger, not a period.
 *
 * last_quarter is the previous calendar quarter.
 * financial_year runs from the society's fiscalYearStartMonth through today.
 */

import { PUBLISHED_TRANSACTION_STATUSES } from './maskBankAccount.js';

export const POSTED_VOUCHER_STATUSES = PUBLISHED_TRANSACTION_STATUSES;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function normalizeFiscalYearStartMonth(month) {
  const value = Number(month);
  if (!Number.isInteger(value) || value < 1 || value > 12) return 4;
  return value;
}

export function formatPeriodDate(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatFiscalYearLabel(startYear, startMonth) {
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  if (endYear === startYear) return `FY ${startYear}`;
  return `FY ${startYear}-${String(endYear).slice(2)}`;
}

export function fiscalYearContaining(now, fiscalYearStartMonth) {
  const startMonth = normalizeFiscalYearStartMonth(fiscalYearStartMonth);
  const monthIndex = startMonth - 1;
  const startYear = now.getMonth() >= monthIndex ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(startYear, monthIndex, 1);
  const end = new Date(startYear + 1, monthIndex, 0, 23, 59, 59, 999);
  return {
    startYear,
    startMonth,
    start,
    end,
    label: formatFiscalYearLabel(startYear, startMonth),
  };
}

export function resolveReportingPeriod(periodKey, now, fiscalYearStartMonth = 4) {
  const fiscalYear = fiscalYearContaining(now, fiscalYearStartMonth);

  if (periodKey === 'last_quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterIndex = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const start = new Date(year, quarterIndex * 3, 1);
    const end = new Date(year, quarterIndex * 3 + 3, 0, 23, 59, 59, 999);
    return {
      key: 'last_quarter',
      start,
      end,
      label: `${formatPeriodDate(start)} – ${formatPeriodDate(end)}`,
      shortLabel: `Q${quarterIndex + 1} ${end.getFullYear()}`,
      fiscalYear: fiscalYear.label,
      fiscalYearStartMonth: fiscalYear.startMonth,
    };
  }

  if (periodKey === 'financial_year') {
    const end = now.getTime() < fiscalYear.end.getTime() ? now : fiscalYear.end;
    return {
      key: 'financial_year',
      start: fiscalYear.start,
      end,
      label: `${formatPeriodDate(fiscalYear.start)} – ${formatPeriodDate(end)}`,
      shortLabel: `${fiscalYear.label} to date`,
      fiscalYear: fiscalYear.label,
      fiscalYearStartMonth: fiscalYear.startMonth,
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    key: 'current_month',
    start,
    end: now,
    label: `${formatPeriodDate(start)} – ${formatPeriodDate(now)}`,
    shortLabel: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`,
    fiscalYear: fiscalYear.label,
    fiscalYearStartMonth: fiscalYear.startMonth,
  };
}

export function fundBalanceScopeForRole(role) {
  return role === 'Resident' ? 'ACTIVE_FUNDS' : 'ALL_FUND_STATUSES';
}

export function fundQueryForRole(societyId, role) {
  const filter = { society: societyId };
  if (role === 'Resident') filter.status = 'ACTIVE';
  return filter;
}

export function fundBalanceDescription(role) {
  return role === 'Resident'
    ? 'Fund balances include active funds only.'
    : 'Fund balances include active, suspended, and closed funds.';
}

export const POSTED_PERIOD_DESCRIPTION =
  'Income and expenditure include approved, paid, and reconciled vouchers for the selected period, including vouchers on suspended or closed funds.';

export const POSTED_LEDGER_DESCRIPTION =
  'Collections and expenditure include every approved, paid, and reconciled voucher. They are not limited to the fiscal year or to active funds.';

export const POSTED_MOVEMENT_DESCRIPTION =
  'Credits and debits include every approved, paid, and reconciled voucher. They are not limited to the selected period.';
