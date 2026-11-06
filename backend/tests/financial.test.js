/**
 * Corpus Fund & Financial Management Integration Test Suite
 * Covers fund categories, transactions (Income, Expense, Transfer), balance calculations,
 * overdraft prevention, audited reversals, financial reports, and dashboard KPIs.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Fund, Transaction } from '../src/models/index.js';

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

async function request(server, path, method = 'GET', body = null, headers = {}) {
  const address = server.address();
  const port = address.port;

  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = resBody ? JSON.parse(resBody) : null;
          } catch {
            json = resBody;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
          });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runFinancialTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Corpus Fund & Financial Module Tests');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  let society = null;
  let treasurerToken = null;

  try {
    // 1. Setup society & authenticated Treasurer
    society = await Society.create({
      name: `Financial Test RWA ${suffix}`,
      code: `FIN-${suffix}`.slice(0, 15),
      contactEmail: `fin_${suffix}@test.org`,
    });

    const treasurer = await User.create({
      name: 'Priya Treasurer',
      email: `treasurer_${suffix}@test.org`,
      passwordHash: 'Password@123',
      role: 'Treasurer',
      society: society._id,
      verificationStatus: 'VERIFIED',
    });

    const loginRes = await request(server, '/api/auth/login', 'POST', {
      email: `treasurer_${suffix}@test.org`,
      password: 'Password@123',
    });
    treasurerToken = loginRes.body.data.accessToken;
    const authHeader = { Authorization: `Bearer ${treasurerToken}` };

    // --- 2. Funds Creation & Balance Management ---
    console.log('--- 1. Funds Creation & Integer Paise Precision ---');

    // Create Corpus Fund
    const corpusRes = await request(
      server,
      '/api/funds',
      'POST',
      {
        name: 'General Corpus Reserve Fund',
        code: `CORPUS-${suffix}`.slice(0, 16),
        type: 'CORPUS',
        openingBalance: 1000000, // ₹ 10 Lakhs (1,00,00,000 Paise)
        restrictedUse: true,
        purpose: 'Permanent fixed deposit reserve',
        bankAccount: 'HDFC Bank - A/C ****1111',
      },
      authHeader
    );
    assert(corpusRes.statusCode === 201, 'Created Corpus Fund');
    assert(corpusRes.body.data.currentBalance === 1000000, 'Opening balance exposed as rupees for display');
    assert(corpusRes.body.data.currentBalancePaise === 100000000, 'Balance stored precisely in integer paise');
    const corpusFundId = corpusRes.body.data._id;

    // Create Maintenance Operational Fund
    const maintRes = await request(
      server,
      '/api/funds',
      'POST',
      {
        name: 'Maintenance Operational Account',
        code: `MAINT-${suffix}`.slice(0, 16),
        type: 'OPERATIONAL',
        openingBalance: 200000, // ₹ 2 Lakhs
        restrictedUse: false,
        purpose: 'Routine repairs, electricity and vendor expenses',
        bankAccount: 'SBI - A/C ****2222',
      },
      authHeader
    );
    assert(maintRes.statusCode === 201, 'Created Maintenance Fund');
    const maintFundId = maintRes.body.data._id;

    // --- 3. Ledger Transactions: Income, Expense & Balance Updates ---
    console.log('\n--- 2. Ledger Transactions & Authoritative Balances ---');

    // 3a: Post Income Voucher (Maintenance collections ₹ 50,000)
    const incomeRes = await request(
      server,
      '/api/transactions',
      'POST',
      {
        reference: `VR-INC-${suffix}`.slice(0, 16),
        date: new Date().toISOString().split('T')[0],
        type: 'INCOME',
        fund: maintFundId,
        category: 'Maintenance Dues',
        description: 'October Maintenance Collections',
        amount: 50000,
        paymentMethod: 'UPI',
        status: 'PAID',
      },
      authHeader
    );
    assert(incomeRes.statusCode === 201, 'Posted INCOME transaction voucher');
    assert(incomeRes.body.data.amount === 50000, 'Income amount verified in rupees');
    assert(incomeRes.body.data.amountPaise === 5000000, 'Income amount stored in paise');

    // Verify Maintenance Fund balance updated: 2,00,000 + 50,000 = 2,50,000
    const checkMaint1 = await request(server, `/api/funds/${maintFundId}`, 'GET', null, authHeader);
    assert(checkMaint1.body.data.currentBalance === 250000, 'Fund balance correctly incremented after INCOME voucher');

    // 3b: Post Expense Voucher (Security vendor ₹ 30,000)
    const expenseRes = await request(
      server,
      '/api/transactions',
      'POST',
      {
        reference: `VR-EXP-${suffix}`.slice(0, 16),
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        fund: maintFundId,
        category: 'Security Services',
        description: 'Monthly Security Agency Invoice',
        amount: 30000,
        paymentMethod: 'NEFT_RTGS',
        vendorName: 'EagleEye Security',
        status: 'PAID',
      },
      authHeader
    );
    assert(expenseRes.statusCode === 201, 'Posted EXPENSE transaction voucher');

    // Verify Maintenance Fund balance updated: 2,50,000 - 30,000 = 2,20,000
    const checkMaint2 = await request(server, `/api/funds/${maintFundId}`, 'GET', null, authHeader);
    assert(checkMaint2.body.data.currentBalance === 220000, 'Fund balance correctly decremented after EXPENSE voucher');

    // 3c: Overdraft Prevention: Attempt to spend more than available balance
    const overdraftRes = await request(
      server,
      '/api/transactions',
      'POST',
      {
        reference: `VR-OVER-${suffix}`.slice(0, 16),
        type: 'EXPENSE',
        fund: maintFundId,
        description: 'Massive unbudgeted expense',
        amount: 9999999, // Way more than available ₹ 2,20,000
        status: 'APPROVED',
      },
      authHeader
    );
    assert(overdraftRes.statusCode === 400, 'Overdraft blocked: Cannot post approved expense exceeding balance');

    // 3d: Transfer between Funds: Move ₹ 20,000 from Maintenance to Corpus
    const transferRes = await request(
      server,
      '/api/transactions',
      'POST',
      {
        reference: `VR-TRF-${suffix}`.slice(0, 16),
        type: 'TRANSFER',
        fund: maintFundId,
        transferToFund: corpusFundId,
        description: 'Transfer surplus to permanent reserve',
        amount: 20000,
        status: 'APPROVED',
      },
      authHeader
    );
    assert(transferRes.statusCode === 201, 'Internal TRANSFER posted successfully');

    // Verify source decremented (2,20,000 - 20,000 = 2,00,000) and target incremented (10,00,000 + 20,000 = 10,20,000)
    const checkMaint3 = await request(server, `/api/funds/${maintFundId}`, 'GET', null, authHeader);
    const checkCorpus = await request(server, `/api/funds/${corpusFundId}`, 'GET', null, authHeader);
    assert(checkMaint3.body.data.currentBalance === 200000, 'Source fund correctly debited on transfer');
    assert(checkCorpus.body.data.currentBalance === 1020000, 'Target fund correctly credited on transfer');

    // --- 4. Audited Reversals ---
    console.log('\n--- 3. Audited Reversal Workflow ---');

    // 4a: Missing justification rejection
    const txToReverse = expenseRes.body.data.id;
    const noJustRes = await request(
      server,
      `/api/transactions/${txToReverse}/reverse`,
      'POST',
      { justification: '   ' },
      authHeader
    );
    assert(noJustRes.statusCode === 400, 'Reversal without justification is rejected');

    // 4b: Successful reversal with mandatory justification
    const reverseRes = await request(
      server,
      `/api/transactions/${txToReverse}/reverse`,
      'POST',
      { justification: 'Duplicate payment voucher entered in error' },
      authHeader
    );
    assert(reverseRes.statusCode === 200, 'Reversal executed successfully');
    assert(reverseRes.body.data.originalTransaction.status === 'REVERSED', 'Original voucher marked REVERSED');
    assert(reverseRes.body.data.reversalTransaction.status === 'REVERSED', 'Counter-voucher created');

    // Verify fund balance restored (+30,000 restored to Maintenance Fund: 2,00,000 + 30,000 = 2,30,000)
    const checkMaint4 = await request(server, `/api/funds/${maintFundId}`, 'GET', null, authHeader);
    assert(checkMaint4.body.data.currentBalance === 230000, 'Fund balance correctly restored after reversal');

    // 4c: Double reversal prevention
    const doubleRevRes = await request(
      server,
      `/api/transactions/${txToReverse}/reverse`,
      'POST',
      { justification: 'Attempting to reverse twice' },
      authHeader
    );
    assert(doubleRevRes.statusCode === 400, 'Cannot reverse an already reversed voucher');

    // --- 5. Financial Reports & Dashboard ---
    console.log('\n--- 4. Reports & Dashboard Aggregations ---');

    // 5a: Income & Expenditure report
    const ieRes = await request(server, '/api/reports/income-expenditure', 'GET', null, authHeader);
    assert(ieRes.statusCode === 200, 'Income & Expenditure report generated');
    assert(ieRes.body.data.income.total === 50000, 'Income total calculated from ledger');

    // 5b: Fund statement
    const fundStmtRes = await request(server, '/api/reports/fund-statement', 'GET', null, authHeader);
    assert(fundStmtRes.statusCode === 200, 'Fund movement statement generated');
    assert(fundStmtRes.body.data.funds.length === 2, 'All funds included in statement');

    // 5c: Dashboard summary
    const dashSummaryRes = await request(server, '/api/dashboard/summary', 'GET', null, authHeader);
    assert(dashSummaryRes.statusCode === 200, 'Dashboard summary metrics calculated');
    assert(dashSummaryRes.body.data.totalAvailableFunds === 1250000, 'Total available funds equals sum of fund balances (10,20,000 + 2,30,000)');

    // 5d: Dashboard charts
    const dashChartsRes = await request(server, '/api/dashboard/charts', 'GET', null, authHeader);
    assert(dashChartsRes.statusCode === 200, 'Dashboard chart data retrieved');
    assert(dashChartsRes.body.data.fundDistribution.length === 2, 'Fund distribution chart populated');

    console.log('\n======================================================');
    console.log(`   Financial Module Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    if (society) {
      await Transaction.collection.deleteMany({ society: society._id });
      await Fund.collection.deleteMany({ society: society._id });
      await User.collection.deleteMany({ society: society._id });
      await Society.collection.deleteOne({ _id: society._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runFinancialTests().catch((err) => {
  console.error('\n❌ Financial Module Test Suite Failure:', err);
  process.exit(1);
});
