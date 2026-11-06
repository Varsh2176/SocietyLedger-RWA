/**
 * Financial consistency: resident transparency, dashboard fund visibility,
 * registration session state, and auditor approval visibility.
 * Uses disposable local societies and does not touch Greenwood Heights records.
 *
 * Auditor decision: auditors do not participate in the expense-approval workflow.
 * They may read approved sanctions. Pending, rejected, and information-requested
 * approvals stay with Society Administrator, Treasurer, and Committee Member.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Fund, Event, Approval, Transaction, AuditLog } from '../src/models/index.js';

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
          resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runConsistencyTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Financial Consistency Test Suite');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  if (/mongodb\+srv:|\.mongodb\.net/i.test(mongoURI)) {
    throw new Error('Consistency tests refuse an Atlas connection.');
  }
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  let societyA = null;
  let societyB = null;

  try {
    societyA = await Society.create({
      name: `Consistency A ${suffix}`,
      code: `CS-${String(suffix).slice(-8)}`,
      contactEmail: `consistency_${suffix}@test.org`,
    });
    societyB = await Society.create({
      name: `Consistency B ${suffix}`,
      code: `CT-${String(suffix).slice(-8)}`,
      contactEmail: `consistency_b_${suffix}@test.org`,
    });

    const roleNames = {
      admin: 'Society Administrator',
      treasurer: 'Treasurer',
      committee: 'Committee Member',
      auditor: 'Auditor',
      resident: 'Resident',
    };
    const users = {};
    const tokens = {};
    for (const [key, role] of Object.entries(roleNames)) {
      users[key] = await User.create({
        name: `${role} ${suffix}`,
        email: `consistency_${key}_${suffix}@test.org`,
        passwordHash: 'Password@123',
        role,
        society: societyA._id,
        verificationStatus: 'VERIFIED',
      });
      const login = await request(server, '/api/auth/login', 'POST', {
        email: `consistency_${key}_${suffix}@test.org`,
        password: 'Password@123',
      });
      assert(login.statusCode === 200, `${role} can log in`);
      tokens[key] = login.body.data.accessToken;
    }
    const otherLogin = await request(server, '/api/auth/login', 'POST', {
      email: `consistency_other_${suffix}@test.org`,
      password: 'Password@123',
    });
    await User.create({
      name: `Other Consistency ${suffix}`,
      email: `consistency_other_${suffix}@test.org`,
      passwordHash: 'Password@123',
      role: 'Society Administrator',
      society: societyB._id,
      verificationStatus: 'VERIFIED',
    });
    const otherLoginAfter = await request(server, '/api/auth/login', 'POST', {
      email: `consistency_other_${suffix}@test.org`,
      password: 'Password@123',
    });
    assert(otherLogin.statusCode === 401, 'A user cannot log in before the account exists');
    assert(otherLoginAfter.statusCode === 200, 'The other society administrator can log in');
    const otherToken = otherLoginAfter.body.data.accessToken;
    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    const activeFund = await Fund.create({
      society: societyA._id,
      name: `Active Corpus ${suffix}`,
      code: `ACA-${String(suffix).slice(-6)}`,
      type: 'CORPUS',
      openingBalancePaise: 100000,
      currentBalancePaise: 100000,
      status: 'ACTIVE',
      createdBy: users.admin._id,
    });
    const suspendedFund = await Fund.create({
      society: societyA._id,
      name: `Suspended Sinking ${suffix}`,
      code: `SSK-${String(suffix).slice(-6)}`,
      type: 'SINKING',
      openingBalancePaise: 50000,
      currentBalancePaise: 50000,
      status: 'SUSPENDED',
      createdBy: users.admin._id,
    });
    await Fund.create({
      society: societyA._id,
      name: `Closed Operational ${suffix}`,
      code: `CLO-${String(suffix).slice(-6)}`,
      type: 'OPERATIONAL',
      openingBalancePaise: 25000,
      currentBalancePaise: 25000,
      status: 'CLOSED',
      createdBy: users.admin._id,
    });

    const today = new Date();
    const eventSpecs = [
      ['Proposed Fair', 'PROPOSED', null, 100000, 10000, null],
      ['Approved Meet', 'APPROVED', null, 100000, 40000, activeFund._id],
      ['Progress Drive', 'IN_PROGRESS', null, 200000, 80000, activeFund._id],
      ['Completed Drive', 'COMPLETED', null, 300000, 250000, activeFund._id],
      ['Settled Drive', 'SETTLED', null, 400000, 350000, activeFund._id],
      ['Cancelled Drive', 'CANCELLED', null, 150000, 10000, activeFund._id],
      ['Suspended Fund Event', 'APPROVED', null, 175000, 99900, suspendedFund._id],
    ];
    for (const [title, status, , approved, actual, fundingFund] of eventSpecs) {
      await Event.create({
        society: societyA._id,
        title: `${title} ${suffix}`,
        date: today,
        status,
        proposedBudgetPaise: approved + 1000,
        approvedBudgetPaise: status === 'PROPOSED' ? null : approved,
        actualExpenditurePaise: actual,
        fundingFund,
        proposedBy: users.committee._id,
      });
    }

    console.log('\n--- Resident transparency ---');
    const transparency = await request(server, '/api/resident/transparency', 'GET', null, auth(tokens.resident));
    assert(transparency.statusCode === 200, 'A resident can read the transparency feed');
    const events = transparency.body.data.publishedEvents;
    const byTitle = (name) => events.find((event) => event.title === `${name} ${suffix}`);
    const serialized = JSON.stringify(transparency.body.data);
    assert(!serialized.includes(`Proposed Fair ${suffix}`), 'A proposed event is omitted');
    assert(!serialized.includes(`Cancelled Drive ${suffix}`), 'A cancelled event is omitted');
    assert(!serialized.includes(`Suspended Fund Event ${suffix}`), 'An event funded by a suspended fund is omitted');
    assert(!serialized.includes(`Suspended Sinking ${suffix}`), 'A suspended fund balance is omitted');
    assert(!serialized.includes(`Closed Operational ${suffix}`), 'A closed fund balance is omitted');
    assert(serialized.includes(`Active Corpus ${suffix}`), 'An active fund balance is published');

    const approved = byTitle('Approved Meet');
    assert(approved && approved.approvedBudget === 1000, 'An approved event keeps its approved budget');
    assert(!Object.hasOwn(approved, 'actualExpenditure'), 'An approved event omits actual spending');
    assert(!Object.hasOwn(approved, 'proposedBudget'), 'An approved event omits the proposed budget');

    const progress = byTitle('Progress Drive');
    assert(progress && progress.approvedBudget === 2000, 'An in-progress event keeps its approved budget');
    assert(!Object.hasOwn(progress, 'actualExpenditure'), 'An in-progress event omits actual spending');

    const completed = byTitle('Completed Drive');
    assert(completed.actualExpenditure === 2500, 'A completed event includes actual spending');
    assert(completed.approvedBudget === 3000, 'A completed event keeps its approved budget');

    const settled = byTitle('Settled Drive');
    assert(settled.actualExpenditure === 3500, 'A settled event includes actual spending');
    assert(settled.approvedBudget === 4000, 'A settled event keeps its approved budget');

    const crossTransparency = await request(
      server,
      `/api/resident/transparency?societyId=${societyA._id}`,
      'GET',
      null,
      auth(otherToken)
    );
    assert(crossTransparency.statusCode === 403, 'Transparency rejects another society id');
    const otherTransparency = await request(server, '/api/resident/transparency', 'GET', null, auth(otherToken));
    assert(
      !JSON.stringify(otherTransparency.body.data).includes(`Approved Meet ${suffix}`),
      'Another society does not receive these events'
    );

    console.log('\n--- Dashboard summary funds ---');
    const expected = {
      resident: { total: 1000, corpus: 1000, maintenance: 0, sinking: 0 },
      admin: { total: 1750, corpus: 1000, maintenance: 250, sinking: 500 },
      treasurer: { total: 1750, corpus: 1000, maintenance: 250, sinking: 500 },
      committee: { total: 1750, corpus: 1000, maintenance: 250, sinking: 500 },
      auditor: { total: 1750, corpus: 1000, maintenance: 250, sinking: 500 },
    };
    for (const [key, role] of Object.entries(roleNames)) {
      const summary = await request(server, '/api/dashboard/summary', 'GET', null, auth(tokens[key]));
      assert(summary.statusCode === 200, `${role} can read the dashboard summary`);
      const data = summary.body.data;
      assert(data.totalAvailableFunds === expected[key].total, `${role} total uses the funds that role can see`);
      assert(data.corpusFundBalance === expected[key].corpus, `${role} corpus balance is limited to visible funds`);
      assert(data.maintenanceFundBalance === expected[key].maintenance, `${role} maintenance balance is limited to visible funds`);
      assert(data.sinkingFundBalance === expected[key].sinking, `${role} sinking balance is limited to visible funds`);
    }
    const crossSummary = await request(
      server,
      `/api/dashboard/summary?societyId=${societyA._id}`,
      'GET',
      null,
      auth(otherToken)
    );
    assert(crossSummary.statusCode === 403, 'Dashboard summary rejects another society id');

    console.log('\n--- Registration session ---');
    const registered = await request(server, '/api/auth/register', 'POST', {
      name: 'New Consistency Resident',
      email: `consistency_new_${suffix}@test.org`,
      password: 'Password@123',
      phone: '9876543210',
      apartmentNumber: 'C-12',
      societyCode: societyA.code,
    });
    assert(registered.statusCode === 201, 'Registration succeeds');
    assert(registered.body.data.user.verificationStatus === 'PENDING', 'The new account stays pending verification');
    assert(registered.body.data.user.role === 'Resident', 'The new account is a resident');
    assert(registered.body.data.accessToken, 'Registration establishes an access token');
    assert(
      registered.body.message === 'Registration successful. You are signed in, and resident verification is still pending.',
      'The response describes both the session and the pending verification'
    );
    const me = await request(server, '/api/auth/me', 'GET', null, auth(registered.body.data.accessToken));
    assert(me.statusCode === 200, 'The registration token authenticates the new resident');
    assert(me.body.data.user.email === `consistency_new_${suffix}@test.org`, 'The session belongs to the new resident');
    assert(me.body.data.user.verificationStatus === 'PENDING', 'The session does not mark the account verified');
    const invalid = await request(server, '/api/auth/register', 'POST', {
      name: 'Bad Code Resident',
      email: `consistency_bad_${suffix}@test.org`,
      password: 'Password@123',
      phone: '9876543210',
      apartmentNumber: 'C-13',
      societyCode: 'NO-SUCH-CODE',
    });
    assert(invalid.statusCode === 404, 'An invalid invitation code is rejected');
    assert(!invalid.body.data, 'A failed registration does not create a session');

    console.log('\n--- Auditor approvals ---');
    const pending = await Approval.create({
      society: societyA._id,
      description: `Pending workflow ${suffix}`,
      requestedAmountPaise: 1000,
      fund: activeFund._id,
      requester: users.treasurer._id,
      status: 'PENDING',
    });
    const rejected = await Approval.create({
      society: societyA._id,
      description: `Rejected workflow ${suffix}`,
      requestedAmountPaise: 2000,
      fund: activeFund._id,
      requester: users.committee._id,
      status: 'REJECTED',
    });
    const info = await Approval.create({
      society: societyA._id,
      description: `Information workflow ${suffix}`,
      requestedAmountPaise: 3000,
      fund: activeFund._id,
      requester: users.admin._id,
      status: 'INFO_REQUESTED',
    });
    const approvedApproval = await Approval.create({
      society: societyA._id,
      description: `Approved workflow ${suffix}`,
      requestedAmountPaise: 4000,
      fund: activeFund._id,
      requester: users.treasurer._id,
      vendorName: `Audit Vendor ${suffix}`,
      status: 'APPROVED',
    });

    const auditorList = await request(server, '/api/approvals', 'GET', null, auth(tokens.auditor));
    const auditorText = JSON.stringify(auditorList.body.data);
    assert(auditorText.includes(`Approved workflow ${suffix}`), 'An auditor receives an approved sanction');
    assert(!auditorText.includes(`Pending workflow ${suffix}`), 'An auditor does not receive a pending approval');
    assert(!auditorText.includes(`Rejected workflow ${suffix}`), 'An auditor does not receive a rejected approval');
    assert(!auditorText.includes(`Information workflow ${suffix}`), 'An auditor does not receive an information request');
    assert((await request(server, `/api/approvals/${pending._id}`, 'GET', null, auth(tokens.auditor))).statusCode === 404, 'An auditor cannot open a pending approval by id');
    assert((await request(server, `/api/approvals/${rejected._id}`, 'GET', null, auth(tokens.auditor))).statusCode === 404, 'An auditor cannot open a rejected approval by id');
    assert((await request(server, `/api/approvals/${info._id}`, 'GET', null, auth(tokens.auditor))).statusCode === 404, 'An auditor cannot open an information request by id');
    const auditorApproved = await request(server, `/api/approvals/${approvedApproval._id}`, 'GET', null, auth(tokens.auditor));
    assert(auditorApproved.statusCode === 200, 'An auditor can open an approved sanction by id');
    assert(auditorApproved.body.data.vendorName === `Audit Vendor ${suffix}`, 'An auditor still sees the approved sanction vendor');

    const treasurerList = await request(server, '/api/approvals', 'GET', null, auth(tokens.treasurer));
    const treasurerText = JSON.stringify(treasurerList.body.data);
    assert(treasurerText.includes(`Pending workflow ${suffix}`), 'A treasurer still sees a pending approval');
    assert(treasurerText.includes(`Rejected workflow ${suffix}`), 'A treasurer still sees a rejected approval');
    assert(treasurerText.includes(`Information workflow ${suffix}`), 'A treasurer still sees an information request');
    const auditorCreate = await request(server, '/api/approvals', 'POST', {
      description: `Auditor workflow ${suffix}`,
      requestedAmount: 10,
      fund: activeFund._id,
    }, auth(tokens.auditor));
    assert(auditorCreate.statusCode === 403, 'An auditor still cannot create an approval');

    const crossApproval = await request(server, `/api/approvals/${approvedApproval._id}`, 'GET', null, auth(otherToken));
    assert(crossApproval.statusCode === 404, 'Another society cannot open the approved sanction');

    console.log('\n======================================================');
    console.log(`   Consistency Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    for (const society of [societyA, societyB]) {
      if (!society) continue;
      await Approval.deleteMany({ society: society._id });
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

runConsistencyTests().catch((error) => {
  console.error('\n❌ Consistency Test Suite Failure:', error);
  process.exit(1);
});
