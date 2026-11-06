/**
 * Dashboard chart and approval visibility.
 * Uses disposable local societies and does not touch Greenwood Heights records.
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
          resolve({ statusCode: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runExposureTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Dashboard Exposure Test Suite');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  if (/mongodb\+srv:|\.mongodb\.net/i.test(mongoURI)) {
    throw new Error('Exposure tests refuse an Atlas connection.');
  }
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  const code = `EX-${String(suffix).slice(-8)}`;
  let societyA = null;
  let societyB = null;

  try {
    societyA = await Society.create({
      name: `Exposure A ${suffix}`,
      code,
      contactEmail: `exposure_${suffix}@test.org`,
    });
    societyB = await Society.create({
      name: `Exposure B ${suffix}`,
      code: `EY-${String(suffix).slice(-8)}`,
      contactEmail: `exposure_b_${suffix}@test.org`,
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
        email: `exposure_${key}_${suffix}@test.org`,
        passwordHash: 'Password@123',
        role,
        society: societyA._id,
        verificationStatus: 'VERIFIED',
      });
      const login = await request(server, '/api/auth/login', 'POST', {
        email: `exposure_${key}_${suffix}@test.org`,
        password: 'Password@123',
      });
      assert(login.statusCode === 200, `${role} can log in`);
      tokens[key] = login.body.data.accessToken;
    }

    const otherAdmin = await User.create({
      name: `Other Exposure ${suffix}`,
      email: `exposure_other_${suffix}@test.org`,
      passwordHash: 'Password@123',
      role: 'Society Administrator',
      society: societyB._id,
      verificationStatus: 'VERIFIED',
    });
    const otherLogin = await request(server, '/api/auth/login', 'POST', {
      email: `exposure_other_${suffix}@test.org`,
      password: 'Password@123',
    });
    const otherToken = otherLogin.body.data.accessToken;
    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    const activeFund = await Fund.create({
      society: societyA._id,
      name: `Published Corpus ${suffix}`,
      code: `PUB-${String(suffix).slice(-6)}`,
      type: 'CORPUS',
      openingBalancePaise: 500000,
      currentBalancePaise: 500000,
      status: 'ACTIVE',
      createdBy: users.admin._id,
    });
    await Fund.create({
      society: societyA._id,
      name: `Suspended Reserve ${suffix}`,
      code: `SUS-${String(suffix).slice(-6)}`,
      type: 'SINKING',
      openingBalancePaise: 77700,
      currentBalancePaise: 77700,
      status: 'SUSPENDED',
      createdBy: users.admin._id,
    });

    const today = new Date();
    await Transaction.create({
      society: societyA._id,
      fund: activeFund._id,
      reference: `PUB-${suffix}`,
      date: today,
      type: 'INCOME',
      category: `Published Collection ${suffix}`,
      description: `Published collection ${suffix}`,
      amountPaise: 50000,
      status: 'APPROVED',
      createdBy: users.treasurer._id,
    });
    await Transaction.create({
      society: societyA._id,
      fund: activeFund._id,
      reference: `EXP-${suffix}`,
      date: today,
      type: 'EXPENSE',
      category: `Published Housekeeping ${suffix}`,
      description: `Published expense ${suffix}`,
      amountPaise: 10000,
      status: 'PAID',
      createdBy: users.treasurer._id,
    });
    await Transaction.create({
      society: societyA._id,
      fund: activeFund._id,
      reference: `PND-${suffix}`,
      date: today,
      type: 'EXPENSE',
      category: `Pending Catering ${suffix}`,
      description: `Pending voucher ${suffix}`,
      amountPaise: 99900,
      status: 'PENDING',
      createdBy: users.treasurer._id,
    });
    await Transaction.create({
      society: societyA._id,
      fund: activeFund._id,
      reference: `REJ-${suffix}`,
      date: today,
      type: 'EXPENSE',
      category: `Rejected Voucher ${suffix}`,
      description: `Rejected voucher ${suffix}`,
      amountPaise: 88800,
      status: 'REJECTED',
      createdBy: users.treasurer._id,
    });

    const settledEvent = await Event.create({
      society: societyA._id,
      title: `Published Sports Day ${suffix}`,
      date: today,
      status: 'SETTLED',
      proposedBudgetPaise: 250000,
      approvedBudgetPaise: 200000,
      actualExpenditurePaise: 150000,
      proposedBy: users.committee._id,
    });
    await Event.create({
      society: societyA._id,
      title: `Secret Proposed Fair ${suffix}`,
      date: today,
      status: 'PROPOSED',
      proposedBudgetPaise: 1234500,
      proposedBy: users.committee._id,
    });
    await Event.create({
      society: societyA._id,
      title: `Cancelled Carnival ${suffix}`,
      date: today,
      status: 'CANCELLED',
      proposedBudgetPaise: 640000,
      proposedBy: users.committee._id,
    });

    const pendingApproval = await Approval.create({
      society: societyA._id,
      description: `Pending sanction ${suffix}`,
      requestedAmountPaise: 10000,
      fund: activeFund._id,
      requester: users.treasurer._id,
      vendorName: `Hidden Vendor ${suffix}`,
      status: 'PENDING',
      notes: 'Waiting for the committee',
      relatedEvent: settledEvent._id,
    });
    const rejectedApproval = await Approval.create({
      society: societyA._id,
      description: `Rejected sanction ${suffix}`,
      requestedAmountPaise: 20000,
      fund: activeFund._id,
      requester: users.committee._id,
      vendorName: `Rejected Vendor ${suffix}`,
      status: 'REJECTED',
      decisionHistory: [{
        decidedBy: users.admin._id,
        action: 'REJECTED',
        comments: `Internal signatory comment ${suffix}`,
        decidedAt: today,
      }],
    });
    const approvedApproval = await Approval.create({
      society: societyA._id,
      description: `Approved sanction ${suffix}`,
      requestedAmountPaise: 30000,
      fund: activeFund._id,
      requester: users.admin._id,
      vendorName: `Published Vendor ${suffix}`,
      quotationReference: `RES-${suffix}`,
      status: 'APPROVED',
      notes: `Published sanction note ${suffix}`,
      relatedEvent: settledEvent._id,
      decisionHistory: [{
        decidedBy: users.treasurer._id,
        action: 'APPROVED',
        comments: `Internal signatory comment ${suffix}`,
        decidedAt: today,
      }],
    });

    console.log('\n--- Dashboard charts ---');
    const charts = {};
    for (const [key, role] of Object.entries(roleNames)) {
      const response = await request(server, '/api/dashboard/charts', 'GET', null, auth(tokens[key]));
      assert(response.statusCode === 200, `${role} can read dashboard charts`);
      charts[key] = response.body.data;
      assert(Array.isArray(charts[key].monthlyCashflow), `${role} receives a cash-flow series`);
      assert(Array.isArray(charts[key].fundDistribution), `${role} receives a fund series`);
      assert(Array.isArray(charts[key].categoryBreakdown), `${role} receives a category series`);
      assert(Array.isArray(charts[key].eventBudgetVsActual), `${role} receives an event series`);
    }

    const residentChart = JSON.stringify(charts.resident);
    assert(residentChart.includes(`Published Housekeeping ${suffix}`), 'A resident chart includes the published expense category');
    assert(residentChart.includes(`Published Corpus ${suffix}`), 'A resident chart includes the active fund');
    assert(residentChart.includes(`Published Sports Day ${suffix}`), 'A resident chart includes the settled event');
    assert(!residentChart.includes(`Pending Catering ${suffix}`), 'A resident chart omits a pending voucher');
    assert(!residentChart.includes(`Rejected Voucher ${suffix}`), 'A resident chart omits a rejected voucher');
    assert(!residentChart.includes(`Suspended Reserve ${suffix}`), 'A resident chart omits a suspended fund');
    assert(!residentChart.includes(`Secret Proposed Fair ${suffix}`), 'A resident chart omits a proposed event');
    assert(!residentChart.includes(`Cancelled Carnival ${suffix}`), 'A resident chart omits a cancelled event');
    assert(!residentChart.includes('12345'), 'A resident chart omits a proposed budget');
    const residentEvent = charts.resident.eventBudgetVsActual.find((item) => item.event === `Published Sports Day ${suffix}`);
    assert(residentEvent.allocatedBudget === 2000, 'A resident sees the approved event budget');
    assert(residentEvent.actualExpense === 1500, 'A resident sees the settled event expenditure');

    for (const key of ['admin', 'treasurer', 'auditor', 'committee']) {
      const serialized = JSON.stringify(charts[key]);
      assert(serialized.includes(`Published Corpus ${suffix}`), `${roleNames[key]} still sees the active fund`);
      assert(serialized.includes(`Suspended Reserve ${suffix}`), `${roleNames[key]} still sees a suspended fund`);
      assert(serialized.includes(`Secret Proposed Fair ${suffix}`), `${roleNames[key]} still sees a proposed event`);
      assert(serialized.includes(`Published Housekeeping ${suffix}`), `${roleNames[key]} still sees the published category`);
      assert(!serialized.includes(`Pending Catering ${suffix}`), `${roleNames[key]} chart stays on posted vouchers`);
      const publishedMonth = charts[key].monthlyCashflow.find((month) => month.income === 500);
      assert(publishedMonth, `${roleNames[key]} chart includes the posted income`);
    }

    const crossCharts = await request(
      server,
      `/api/dashboard/charts?societyId=${societyA._id}`,
      'GET',
      null,
      auth(otherToken)
    );
    assert(crossCharts.statusCode === 403, 'Dashboard charts reject another society id');
    const otherCharts = await request(server, '/api/dashboard/charts', 'GET', null, auth(otherToken));
    assert(
      !JSON.stringify(otherCharts.body.data).includes(`Published Corpus ${suffix}`),
      'Another society does not receive these chart figures'
    );

    console.log('\n--- Approvals ---');
    const residentList = await request(server, '/api/approvals', 'GET', null, auth(tokens.resident));
    assert(residentList.statusCode === 200, 'A resident can read published approvals');
    const residentSerialized = JSON.stringify(residentList.body.data);
    assert(residentSerialized.includes(`Approved sanction ${suffix}`), 'A resident receives the approved sanction');
    assert(!residentSerialized.includes(`Pending sanction ${suffix}`), 'A resident list omits a pending sanction');
    assert(!residentSerialized.includes(`Rejected sanction ${suffix}`), 'A resident list omits a rejected sanction');
    assert(!residentSerialized.includes(`Hidden Vendor ${suffix}`), 'A resident list omits a pending vendor');
    assert(!residentSerialized.includes(`Internal signatory comment ${suffix}`), 'A resident list omits decision comments');
    assert(!residentSerialized.includes(users.admin.email), 'A resident list omits requester email addresses');
    const residentApproved = residentList.body.data.approvals.find((item) => item.description === `Approved sanction ${suffix}`);
    assert(residentApproved.status === 'APPROVED', 'The published sanction is approved');
    assert(residentApproved.requestedAmount === 300, 'The published sanction amount is unchanged');
    assert(!Object.hasOwn(residentApproved, 'requesterEmail'), 'The published sanction has no requester email');
    assert(!Object.hasOwn(residentApproved, 'decisionHistory'), 'The published sanction has no decision history');

    const residentPendingFilter = await request(server, '/api/approvals?status=PENDING', 'GET', null, auth(tokens.resident));
    assert(residentPendingFilter.body.data.approvals.length === 0, 'A resident pending filter returns no records');
    const residentRejectedFilter = await request(server, '/api/approvals?status=REJECTED', 'GET', null, auth(tokens.resident));
    assert(residentRejectedFilter.body.data.approvals.length === 0, 'A resident rejected filter returns no records');

    const residentPendingById = await request(server, `/api/approvals/${pendingApproval._id}`, 'GET', null, auth(tokens.resident));
    assert(residentPendingById.statusCode === 404, 'A resident cannot open a pending approval by id');
    const residentRejectedById = await request(server, `/api/approvals/${rejectedApproval._id}`, 'GET', null, auth(tokens.resident));
    assert(residentRejectedById.statusCode === 404, 'A resident cannot open a rejected approval by id');
    const residentApprovedById = await request(server, `/api/approvals/${approvedApproval._id}`, 'GET', null, auth(tokens.resident));
    assert(residentApprovedById.statusCode === 200, 'A resident can open an approved sanction by id');
    assert(!JSON.stringify(residentApprovedById.body.data).includes(users.admin.email), 'The approved detail omits the requester email');
    assert(residentApprovedById.body.data.relatedEvent === `Published Sports Day ${suffix}`, 'The approved detail keeps the published event title');

    for (const key of ['admin', 'treasurer', 'committee']) {
      const list = await request(server, '/api/approvals', 'GET', null, auth(tokens[key]));
      assert(list.statusCode === 200, `${roleNames[key]} can read approvals`);
      const serialized = JSON.stringify(list.body.data);
      assert(serialized.includes(`Pending sanction ${suffix}`), `${roleNames[key]} still sees a pending sanction`);
      assert(serialized.includes(`Rejected sanction ${suffix}`), `${roleNames[key]} still sees a rejected sanction`);
      assert(serialized.includes(`Approved sanction ${suffix}`), `${roleNames[key]} still sees an approved sanction`);
      const byId = await request(server, `/api/approvals/${pendingApproval._id}`, 'GET', null, auth(tokens[key]));
      assert(byId.statusCode === 200, `${roleNames[key]} can open a pending approval by id`);
      assert(byId.body.data.vendorName === `Hidden Vendor ${suffix}`, `${roleNames[key]} still sees the vendor on a pending approval`);
    }

    const auditorList = await request(server, '/api/approvals', 'GET', null, auth(tokens.auditor));
    assert(auditorList.statusCode === 200, 'An auditor can read approved sanctions');
    const auditorSerialized = JSON.stringify(auditorList.body.data);
    assert(auditorSerialized.includes(`Approved sanction ${suffix}`), 'An auditor receives the approved sanction');
    assert(!auditorSerialized.includes(`Pending sanction ${suffix}`), 'An auditor list omits a pending sanction');
    assert(!auditorSerialized.includes(`Rejected sanction ${suffix}`), 'An auditor list omits a rejected sanction');
    const auditorPending = await request(server, `/api/approvals/${pendingApproval._id}`, 'GET', null, auth(tokens.auditor));
    assert(auditorPending.statusCode === 404, 'An auditor cannot open a pending approval by id');
    const auditorApproved = await request(server, `/api/approvals/${approvedApproval._id}`, 'GET', null, auth(tokens.auditor));
    assert(auditorApproved.statusCode === 200, 'An auditor can open an approved sanction by id');
    assert(auditorApproved.body.data.vendorName === `Published Vendor ${suffix}`, 'An auditor still sees the vendor on an approved sanction');

    const created = await request(server, '/api/approvals', 'POST', {
      description: `Workflow sanction ${suffix}`,
      requestedAmount: 50,
      fund: activeFund._id,
    }, auth(tokens.committee));
    assert(created.statusCode === 201, 'A committee member can still submit an approval');
    const residentCreate = await request(server, '/api/approvals', 'POST', {
      description: `Resident sanction ${suffix}`,
      requestedAmount: 50,
      fund: activeFund._id,
    }, auth(tokens.resident));
    assert(residentCreate.statusCode === 403, 'A resident still cannot submit an approval');
    const selfDecision = await request(
      server,
      `/api/approvals/${created.body.data._id}/decision`,
      'POST',
      { action: 'APPROVED', comments: 'Self approval' },
      auth(tokens.committee)
    );
    assert(selfDecision.statusCode === 403, 'A requester still cannot approve their own request');
    const treasurerDecision = await request(
      server,
      `/api/approvals/${created.body.data._id}/decision`,
      'POST',
      { action: 'APPROVED', comments: 'Authorized decision' },
      auth(tokens.treasurer)
    );
    assert(treasurerDecision.statusCode === 200, 'A treasurer can still decide another member request');

    const crossList = await request(
      server,
      `/api/approvals?societyId=${societyA._id}`,
      'GET',
      null,
      auth(otherToken)
    );
    assert(crossList.statusCode === 403, 'Approval list rejects another society id');
    const crossDetail = await request(server, `/api/approvals/${approvedApproval._id}`, 'GET', null, auth(otherToken));
    assert(crossDetail.statusCode === 404, 'Another society cannot open the approval by id');
    const crossDecision = await request(
      server,
      `/api/approvals/${pendingApproval._id}/decision`,
      'POST',
      { action: 'REJECTED', comments: 'Cross society' },
      auth(otherToken)
    );
    assert(crossDecision.statusCode === 404, 'Another society cannot decide the approval');
    assert(otherAdmin.role === 'Society Administrator', 'The other society user remains an administrator');

    console.log('\n======================================================');
    console.log(`   Exposure Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
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

runExposureTests().catch((error) => {
  console.error('\n❌ Exposure Test Suite Failure:', error);
  process.exit(1);
});
