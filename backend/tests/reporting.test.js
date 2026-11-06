/**
 * Reporting periods follow the society's fiscal-year start month.
 * Posted income and expenditure stay on approved, paid, and reconciled vouchers,
 * including vouchers on suspended or closed funds.
 * Resident fund balances stay limited to active funds.
 * Disposable local societies only. Does not touch Greenwood Heights records.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Fund, Transaction, AuditLog, Event } from '../src/models/index.js';
import { resolveReportingPeriod } from '../src/utils/reportingPeriod.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✓ PASS: ${message}`);
}

function request(server, path, method = 'GET', body = null, headers = {}) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    if (postData) reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers: reqHeaders },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => { resBody += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = resBody ? JSON.parse(resBody) : null; } catch { json = resBody; }
          resolve({ statusCode: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function noon(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

async function runReportingTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Reporting Accuracy Test Suite');
  console.log('======================================================\n');

  const november = new Date(2026, 10, 6, 15, 0, 0);
  const aprilYear = resolveReportingPeriod('financial_year', november, 4);
  assert(aprilYear.fiscalYear === 'FY 2026-27', 'An April fiscal year in November is FY 2026-27');
  assert(aprilYear.start.getFullYear() === 2026 && aprilYear.start.getMonth() === 3 && aprilYear.start.getDate() === 1, 'An April fiscal year starts on 1 April');
  assert(aprilYear.shortLabel === 'FY 2026-27 to date', 'The financial-year label says to date');
  assert(aprilYear.label.startsWith('1 Apr 2026 – '), 'The financial-year range starts on 1 April');

  const januaryYear = resolveReportingPeriod('financial_year', november, 1);
  assert(januaryYear.fiscalYear === 'FY 2026', 'A January fiscal year uses a single calendar year');
  assert(januaryYear.start.getMonth() === 0 && januaryYear.start.getFullYear() === 2026, 'A January fiscal year starts on 1 January');

  const decemberYear = resolveReportingPeriod('financial_year', november, 12);
  assert(decemberYear.fiscalYear === 'FY 2025-26', 'A December fiscal year in November belongs to the previous start year');
  assert(decemberYear.start.getFullYear() === 2025 && decemberYear.start.getMonth() === 11, 'A December fiscal year starts on 1 December of the previous year');

  const julyBeforeStart = resolveReportingPeriod('financial_year', new Date(2026, 0, 15), 7);
  assert(julyBeforeStart.fiscalYear === 'FY 2025-26', 'A July fiscal year in January still belongs to the prior July');
  assert(julyBeforeStart.start.getFullYear() === 2025 && julyBeforeStart.start.getMonth() === 6, 'That July fiscal year starts on 1 July 2025');

  const quarter = resolveReportingPeriod('last_quarter', november, 4);
  assert(quarter.shortLabel === 'Q3 2026', 'The previous quarter in November is Q3 2026');
  assert(quarter.label === '1 Jul 2026 – 30 Sep 2026', 'The previous quarter covers 1 July through 30 September');
  assert(quarter.fiscalYear === 'FY 2026-27', 'The quarter label keeps the society fiscal year');

  const month = resolveReportingPeriod('current_month', november, 7);
  assert(month.shortLabel === 'Nov 2026', 'The current month label is the calendar month');
  assert(month.label.startsWith('1 Nov 2026 – '), 'The current month starts on the first of the month');
  assert(month.fiscalYear === 'FY 2026-27', 'A July fiscal year in November is FY 2026-27');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  if (/mongodb\+srv:|\.mongodb\.net/i.test(mongoURI)) {
    throw new Error('Reporting tests refuse an Atlas connection.');
  }
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  const societies = [];

  try {
    const aprilSociety = await Society.create({
      name: `Reporting April ${suffix}`,
      code: `RA${String(suffix).slice(-8)}`,
      fiscalYearStartMonth: 4,
      isActive: true,
    });
    const decemberSociety = await Society.create({
      name: `Reporting December ${suffix}`,
      code: `RD${String(suffix).slice(-8)}`,
      fiscalYearStartMonth: 12,
      isActive: true,
    });
    societies.push(aprilSociety, decemberSociety);

    async function makeUser(society, role, key) {
      const email = `report_${key}_${suffix}@test.org`;
      const user = await User.create({
        name: `${role} ${suffix}`,
        email,
        passwordHash: 'Password@123',
        role,
        society: society._id,
        verificationStatus: 'VERIFIED',
      });
      const login = await request(server, '/api/auth/login', 'POST', {
        email,
        password: 'Password@123',
      });
      assert(login.statusCode === 200, `${role} can log in for reporting`);
      return { user, token: login.body.data.accessToken };
    }

    const aprilTreasurer = await makeUser(aprilSociety, 'Treasurer', 'april_treasurer');
    const aprilResident = await makeUser(aprilSociety, 'Resident', 'april_resident');
    const decemberTreasurer = await makeUser(decemberSociety, 'Treasurer', 'december_treasurer');
    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    async function seedLedger(society, user) {
      const active = await Fund.create({
        society: society._id,
        name: `Active Corpus ${suffix}`,
        code: `AC${String(society._id).slice(-6)}`,
        type: 'CORPUS',
        openingBalancePaise: 100000,
        currentBalancePaise: 100000,
        status: 'ACTIVE',
        createdBy: user._id,
      });
      const suspended = await Fund.create({
        society: society._id,
        name: `Suspended Sinking ${suffix}`,
        code: `SS${String(society._id).slice(-6)}`,
        type: 'SINKING',
        openingBalancePaise: 50000,
        currentBalancePaise: 50000,
        status: 'SUSPENDED',
        createdBy: user._id,
      });
      const rows = [
        ['IN-MAY', 'INCOME', 10100, 'PAID', noon(2026, 4, 15), active._id],
        ['IN-DEC', 'INCOME', 20200, 'PAID', noon(2025, 11, 15), active._id],
        ['IN-PEND', 'INCOME', 30300, 'PENDING', noon(2026, 4, 15), active._id],
        ['EX-SUS', 'EXPENSE', 40400, 'RECONCILED', noon(2026, 4, 15), suspended._id],
        ['IN-AUG', 'INCOME', 50500, 'APPROVED', noon(2026, 7, 15), active._id],
        ['EX-REV', 'EXPENSE', 99900, 'REVERSED', noon(2026, 4, 15), active._id],
      ];
      for (const [reference, type, amountPaise, status, date, fund] of rows) {
        await Transaction.create({
          society: society._id,
          fund,
          reference: `${reference}-${String(society._id).slice(-4)}`,
          date,
          type,
          description: reference,
          amountPaise,
          status,
          createdBy: user._id,
        });
      }
    }

    await seedLedger(aprilSociety, aprilTreasurer.user);
    await seedLedger(decemberSociety, decemberTreasurer.user);

    const now = new Date();
    const aprilFinancial = resolveReportingPeriod('financial_year', now, 4);
    const decemberFinancial = resolveReportingPeriod('financial_year', now, 12);
    const quarterNow = resolveReportingPeriod('last_quarter', now, 4);
    const monthNow = resolveReportingPeriod('current_month', now, 4);

    const aprilIncome = await request(
      server,
      '/api/reports/income-expenditure?period=financial_year',
      'GET',
      null,
      auth(aprilTreasurer.token)
    );
    assert(aprilIncome.statusCode === 200, 'The April society income statement is available');
    assert(aprilIncome.body.data.fiscalYear === aprilFinancial.fiscalYear, 'The April income statement uses that society fiscal year');
    assert(aprilIncome.body.data.fiscalYearStartMonth === 4, 'The April income statement records the start month');
    assert(aprilIncome.body.data.period === aprilFinancial.label, 'The April income label matches the calculated period');
    assert(aprilIncome.body.data.reportingPeriodShort === aprilFinancial.shortLabel, 'The April short label matches the calculated period');
    assert(aprilIncome.body.data.income.total === 606, 'The April year includes only posted income inside that year');
    assert(aprilIncome.body.data.expenditure.total === 404, 'The April year includes the posted expense on a suspended fund');
    assert(
      aprilIncome.body.data.incomeExpenseDescription.includes('suspended or closed funds'),
      'The income statement says posted vouchers are not limited to active funds'
    );

    const decemberIncome = await request(
      server,
      '/api/reports/income-expenditure?period=financial_year',
      'GET',
      null,
      auth(decemberTreasurer.token)
    );
    assert(decemberIncome.statusCode === 200, 'The December society income statement is available');
    assert(decemberIncome.body.data.fiscalYear === decemberFinancial.fiscalYear, 'The December income statement uses that society fiscal year');
    assert(decemberIncome.body.data.fiscalYear !== aprilIncome.body.data.fiscalYear, 'Different fiscal-year start months produce different year labels');
    assert(decemberIncome.body.data.period === decemberFinancial.label, 'The December income label matches the calculated period');
    assert(decemberIncome.body.data.income.total === 808, 'The December year includes the December posted income');
    assert(decemberIncome.body.data.expenditure.total === 404, 'The December year keeps the same posted suspended-fund expense');

    const quarterIncome = await request(
      server,
      '/api/reports/income-expenditure?period=last_quarter',
      'GET',
      null,
      auth(aprilTreasurer.token)
    );
    assert(quarterIncome.body.data.period === quarterNow.label, 'The quarter label matches the calculated quarter');
    assert(quarterIncome.body.data.reportingPeriodShort === quarterNow.shortLabel, 'The quarter short label matches the calculated quarter');
    assert(quarterIncome.body.data.income.total === 505, 'The previous quarter includes only its posted income');
    assert(quarterIncome.body.data.expenditure.total === 0, 'The previous quarter excludes expenses outside it');

    const monthIncome = await request(
      server,
      '/api/reports/income-expenditure?period=current_month',
      'GET',
      null,
      auth(aprilTreasurer.token)
    );
    assert(monthIncome.body.data.period === monthNow.label, 'The month label matches the calculated month');
    assert(monthIncome.body.data.reportingPeriodShort === monthNow.shortLabel, 'The month short label matches the calculated month');
    assert(monthIncome.body.data.income.total === 0, 'The current month excludes vouchers from other months');
    assert(!JSON.stringify(monthIncome.body.data).includes('FY 2026-27') || monthNow.fiscalYear === 'FY 2026-27', 'A hardcoded fiscal year is not substituted for the society year');

    const residentSummary = await request(
      server,
      '/api/dashboard/summary?period=financial_year',
      'GET',
      null,
      auth(aprilResident.token)
    );
    assert(residentSummary.statusCode === 200, 'A resident can read the dashboard summary');
    assert(residentSummary.body.data.totalAvailableFunds === 1000, 'A resident fund total includes the active fund only');
    assert(residentSummary.body.data.sinkingFundBalance === 0, 'A resident does not receive the suspended fund balance');
    assert(residentSummary.body.data.totalIncomeMonth === 606, 'A resident still receives posted income for the selected year');
    assert(residentSummary.body.data.totalExpenseMonth === 404, 'A resident still receives the posted expense on a suspended fund');
    assert(residentSummary.body.data.reportingPeriodLabel === aprilFinancial.label, 'The resident summary label matches the income-statement period');
    assert(residentSummary.body.data.fundBalanceScope === 'ACTIVE_FUNDS', 'The resident summary records active-fund balances');
    assert(residentSummary.body.data.postedVoucherStatuses.includes('RECONCILED'), 'Posted voucher statuses include reconciled');
    assert(!residentSummary.body.data.postedVoucherStatuses.includes('PENDING'), 'Posted voucher statuses omit pending');

    const treasurerSummary = await request(
      server,
      '/api/dashboard/summary?period=financial_year',
      'GET',
      null,
      auth(aprilTreasurer.token)
    );
    assert(treasurerSummary.body.data.totalAvailableFunds === 1500, 'A treasurer fund total includes the suspended fund');
    assert(treasurerSummary.body.data.sinkingFundBalance === 500, 'A treasurer sees the suspended sinking balance');
    assert(treasurerSummary.body.data.totalIncomeMonth === 606, 'A treasurer income total matches the resident posted total');
    assert(treasurerSummary.body.data.totalExpenseMonth === 404, 'A treasurer expense total matches the resident posted total');
    assert(treasurerSummary.body.data.fundBalanceScope === 'ALL_FUND_STATUSES', 'The treasurer summary records every fund status');
    assert(treasurerSummary.body.data.reportingPeriodShort === aprilFinancial.shortLabel, 'The treasurer summary short label matches the period');

    const residentQuarter = await request(
      server,
      '/api/dashboard/summary?period=last_quarter',
      'GET',
      null,
      auth(aprilResident.token)
    );
    assert(residentQuarter.body.data.reportingPeriodShort === quarterNow.shortLabel, 'The dashboard quarter label matches the quarter');
    assert(residentQuarter.body.data.totalIncomeMonth === 505, 'The dashboard quarter income matches the income statement');
    assert(residentQuarter.body.data.totalAvailableFunds === 1000, 'Changing the period does not add the suspended fund to a resident balance');

    const residentSheet = await request(server, '/api/reports/balance-sheet?period=current_month', 'GET', null, auth(aprilResident.token));
    const residentSheetYear = await request(server, '/api/reports/balance-sheet?period=financial_year', 'GET', null, auth(aprilResident.token));
    const treasurerSheet = await request(server, '/api/reports/balance-sheet?period=financial_year', 'GET', null, auth(aprilTreasurer.token));
    const decemberSheet = await request(server, '/api/reports/balance-sheet', 'GET', null, auth(decemberTreasurer.token));
    assert(residentSheet.body.data.fiscalYear === aprilFinancial.fiscalYear, 'The resident balance sheet uses the society fiscal year');
    assert(residentSheet.body.data.fiscalYearStartMonth === 4, 'The balance sheet returns the configured start month');
    assert(residentSheet.body.data.balancesFollowRequestedPeriod === false, 'Balance-sheet amounts are not restated for the selected period');
    assert(residentSheet.body.data.totalAssets === residentSheetYear.body.data.totalAssets, 'The selected period does not change balance-sheet totals');
    assert(residentSheet.body.data.totalAssets === 1000, 'A resident balance sheet includes the active fund only');
    assert(treasurerSheet.body.data.totalAssets === 1500, 'A treasurer balance sheet includes the suspended fund');
    assert(decemberSheet.body.data.fiscalYear === decemberFinancial.fiscalYear, 'The other society balance sheet uses its own fiscal year');
    assert(!String(residentSheet.body.data.fiscalYear).includes('2026-27') || aprilFinancial.fiscalYear === 'FY 2026-27', 'The balance sheet fiscal year comes from the society');

    const residentFunds = await request(server, '/api/reports/fund-statement', 'GET', null, auth(aprilResident.token));
    const treasurerFunds = await request(server, '/api/reports/fund-statement', 'GET', null, auth(aprilTreasurer.token));
    assert(residentFunds.body.data.funds.length === 1, 'A resident fund statement omits the suspended fund');
    assert(treasurerFunds.body.data.funds.length === 2, 'A treasurer fund statement keeps the suspended fund');
    const suspendedRow = treasurerFunds.body.data.funds.find((fund) => fund.status === 'SUSPENDED');
    assert(suspendedRow.totalDebits === 404, 'Posted movement on a suspended fund remains in the fund statement');
    assert(residentFunds.body.data.balancesFollowRequestedPeriod === false, 'Fund-statement balances are not limited to the selected period');

    const cross = await request(
      server,
      `/api/reports/income-expenditure?period=financial_year&societyId=${decemberSociety._id}`,
      'GET',
      null,
      auth(aprilTreasurer.token)
    );
    assert(cross.statusCode === 403, 'A report rejects another society id');

    const preserved = await Fund.create({
      society: aprilSociety._id,
      name: `Preserved Fund ${suffix}`,
      code: `PR${String(suffix).slice(-6)}`,
      type: 'SPECIAL_PROJECT',
      openingBalancePaise: 100,
      currentBalancePaise: 100,
      fiscalYear: 'FY 2019-20',
      status: 'ACTIVE',
      createdBy: aprilTreasurer.user._id,
    });

    async function createFund(token, code) {
      return request(server, '/api/funds', 'POST', {
        name: `Derived ${code}`,
        code,
        type: 'OPERATIONAL',
        openingBalance: 1,
        purpose: 'Opening reserve',
        fiscalYear: 'FY 1999-00',
      }, auth(token));
    }

    const aprilFund = await createFund(aprilTreasurer.token, `DA${String(suffix).slice(-6)}`);
    assert(aprilFund.statusCode === 201, 'A fund can be created without trusting a client fiscal year');
    assert(aprilFund.body.data.fiscalYear === aprilFinancial.fiscalYear, 'An April society fund uses the April fiscal year');
    assert(aprilFund.body.data.fiscalYear !== 'FY 1999-00', 'A client-supplied fiscal year is ignored');
    const decemberFund = await createFund(decemberTreasurer.token, `DD${String(suffix).slice(-6)}`);
    assert(decemberFund.statusCode === 201, 'A December society fund can be created');
    assert(decemberFund.body.data.fiscalYear === decemberFinancial.fiscalYear, 'A December society fund uses the December fiscal year');

    const julySociety = await Society.create({
      name: `Reporting July ${suffix}`,
      code: `RJ${String(suffix).slice(-8)}`,
      fiscalYearStartMonth: 7,
      isActive: true,
    });
    societies.push(julySociety);
    const julyTreasurer = await makeUser(julySociety, 'Treasurer', 'july_treasurer');
    const julyPeriod = resolveReportingPeriod('current_month', new Date(), 7);
    const julyFund = await createFund(julyTreasurer.token, `DJ${String(suffix).slice(-6)}`);
    assert(julyFund.statusCode === 201, 'A July society fund can be created');
    assert(julyFund.body.data.fiscalYear === julyPeriod.fiscalYear, 'A July society fund uses the July fiscal year');
    assert(julyFund.body.data.fiscalYear !== 'FY 2026-27' || julyPeriod.fiscalYear === 'FY 2026-27', 'A new fund does not receive a fixed fiscal-year label');

    const preservedAfter = await Fund.findById(preserved._id);
    assert(preservedAfter.fiscalYear === 'FY 2019-20', 'Creating a fund does not rewrite an existing fund fiscal year');

    const residentFundList = await request(server, '/api/funds', 'GET', null, auth(aprilResident.token));
    assert(residentFundList.body.data.funds.every((fund) => fund.status === 'ACTIVE'), 'A resident fund list includes active funds only');
    assert(
      !residentFundList.body.data.funds.some((fund) => String(fund.name).includes('Suspended')),
      'A resident fund list omits the suspended fund'
    );
    const treasurerFundList = await request(server, '/api/funds', 'GET', null, auth(aprilTreasurer.token));
    const suspendedFund = treasurerFundList.body.data.funds.find((fund) => fund.status === 'SUSPENDED');
    const hiddenFund = await request(server, `/api/funds/${suspendedFund.id}`, 'GET', null, auth(aprilResident.token));
    assert(hiddenFund.statusCode === 404, 'A resident cannot open a suspended fund by id');

    const progressEvent = await Event.create({
      society: aprilSociety._id,
      title: `Progress Spend ${suffix}`,
      date: new Date(),
      status: 'IN_PROGRESS',
      proposedBudgetPaise: 200000,
      approvedBudgetPaise: 200000,
      actualExpenditurePaise: 80000,
      fundingFund: preserved._id,
      proposedBy: aprilTreasurer.user._id,
    });
    const residentEvents = await request(server, '/api/events', 'GET', null, auth(aprilResident.token));
    const progressRow = residentEvents.body.data.events.find((event) => event.id === String(progressEvent._id) || event.title === progressEvent.title);
    assert(progressRow, 'A resident can see an in-progress event');
    assert(progressRow.approvedBudget === 2000, 'An in-progress event keeps its approved budget');
    assert(!Object.hasOwn(progressRow, 'actualExpenditure'), 'An in-progress event omits actual spending for a resident');
    const treasurerEvents = await request(server, '/api/events', 'GET', null, auth(aprilTreasurer.token));
    const treasurerProgress = treasurerEvents.body.data.events.find((event) => event.title === progressEvent.title);
    assert(treasurerProgress.approvedBudget === 2000, 'A treasurer still sees the approved budget');
    assert(!Object.hasOwn(treasurerProgress, 'actualExpenditure'), 'A treasurer does not receive in-progress actual spending');
    const settledEvent = await Event.create({
      society: aprilSociety._id,
      title: `Settled Spend ${suffix}`,
      date: new Date(),
      status: 'SETTLED',
      proposedBudgetPaise: 400000,
      approvedBudgetPaise: 400000,
      actualExpenditurePaise: 350000,
      fundingFund: preserved._id,
      proposedBy: aprilTreasurer.user._id,
    });
    const treasurerSettled = (await request(server, `/api/events/${settledEvent._id}`, 'GET', null, auth(aprilTreasurer.token))).body.data;
    const residentSettled = (await request(server, `/api/events/${settledEvent._id}`, 'GET', null, auth(aprilResident.token))).body.data;
    assert(treasurerSettled.actualExpenditure === 3500, 'A treasurer sees actual spending after settlement');
    assert(residentSettled.actualExpenditure === 3500, 'A resident sees actual spending after settlement');
    assert(treasurerSettled.approvedBudget === 4000, 'Settlement does not remove the approved budget');
    const spendReaders = {
      'Society Administrator': await makeUser(aprilSociety, 'Society Administrator', 'spend_admin'),
      'Committee Member': await makeUser(aprilSociety, 'Committee Member', 'spend_committee'),
      Auditor: await makeUser(aprilSociety, 'Auditor', 'spend_auditor'),
    };
    for (const [role, account] of Object.entries(spendReaders)) {
      const list = await request(server, '/api/events', 'GET', null, auth(account.token));
      const row = list.body.data.events.find((event) => event.title === progressEvent.title);
      assert(row && row.approvedBudget === 2000, `${role} keeps the approved budget on an in-progress event`);
      assert(!Object.hasOwn(row, 'actualExpenditure'), `${role} does not receive in-progress actual spending`);
    }

    const charts = await request(server, '/api/dashboard/charts?period=financial_year', 'GET', null, auth(aprilTreasurer.token));
    assert(charts.body.data.chartRange === 'PAST_SIX_MONTHS', 'Dashboard charts identify the six-month range');
    assert(charts.body.data.chartRangeDescription.includes('past six months'), 'The chart description names the past six months');
    assert(charts.body.data.chartRangeDescription.includes('independent'), 'Charts are described separately from the selected summary period');

    for (const path of ['/api/compliance', '/api/documents', '/api/audit/logs']) {
      const blocked = await request(
        server,
        `${path}?societyId=${decemberSociety._id}`,
        'GET',
        null,
        auth(aprilTreasurer.token)
      );
      assert(blocked.statusCode === 403, `${path} rejects another society id`);
    }

    console.log('\n======================================================');
    console.log(`   Reporting Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    for (const society of societies) {
      await Event.deleteMany({ society: society._id });
      await Transaction.collection.deleteMany({ society: society._id });
      await AuditLog.collection.deleteMany({ society: society._id });
      await Fund.deleteMany({ society: society._id });
      await User.deleteMany({ society: society._id });
      await Society.collection.deleteOne({ _id: society._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runReportingTests().catch((err) => {
  console.error('\n❌ Reporting Test Suite Failure:', err);
  process.exit(1);
});
