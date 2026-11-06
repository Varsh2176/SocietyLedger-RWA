/**
 * Role authorization for event proposals, expense approvals, and dashboard summaries.
 * Uses a disposable local society and does not touch Greenwood Heights records.
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

const eventBody = (title) => ({
  title,
  description: 'Authorization fixture',
  date: '2026-12-01',
  proposedBudget: 1000,
});

async function runAuthorizationTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Role Authorization Test Suite');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  if (/mongodb\+srv:|\.mongodb\.net/i.test(mongoURI)) {
    throw new Error('Authorization tests refuse an Atlas connection.');
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
      name: `Authz A ${suffix}`,
      code: `AZA-${suffix}`.slice(0, 15),
      contactEmail: `aza_${suffix}@test.org`,
    });
    societyB = await Society.create({
      name: `Authz B ${suffix}`,
      code: `AZB-${suffix}`.slice(0, 15),
      contactEmail: `azb_${suffix}@test.org`,
    });

    const fund = await Fund.create({
      society: societyA._id,
      name: 'Authorization Fund',
      code: `FND-AZ-${suffix}`.slice(0, 16),
      type: 'OPERATIONAL',
      openingBalancePaise: 10000000,
      currentBalancePaise: 10000000,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const roleNames = {
      admin: 'Society Administrator',
      treasurer: 'Treasurer',
      committee: 'Committee Member',
      auditor: 'Auditor',
      resident: 'Resident',
    };
    const tokens = {};
    for (const [key, role] of Object.entries(roleNames)) {
      await User.create({
        name: `${role} ${suffix}`,
        email: `${key}_${suffix}@test.org`,
        passwordHash: 'Password@123',
        role,
        society: societyA._id,
        verificationStatus: 'VERIFIED',
      });
      const login = await request(server, '/api/auth/login', 'POST', {
        email: `${key}_${suffix}@test.org`,
        password: 'Password@123',
      });
      assert(login.statusCode === 200, `${role} can log in`);
      tokens[key] = login.body.data.accessToken;
    }

    await User.create({
      name: `Other Admin ${suffix}`,
      email: `other_${suffix}@test.org`,
      passwordHash: 'Password@123',
      role: 'Society Administrator',
      society: societyB._id,
      verificationStatus: 'VERIFIED',
    });
    const otherLogin = await request(server, '/api/auth/login', 'POST', {
      email: `other_${suffix}@test.org`,
      password: 'Password@123',
    });
    const otherToken = otherLogin.body.data.accessToken;

    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    console.log('\n--- Event and approval creation ---');
    for (const key of ['resident', 'auditor']) {
      const eventRes = await request(server, '/api/events', 'POST', eventBody(`${key} event`), auth(tokens[key]));
      assert(eventRes.statusCode === 403, `${roleNames[key]} cannot create an event`);
      const approvalRes = await request(server, '/api/approvals', 'POST', {
        description: `${key} request`,
        requestedAmount: 100,
        fund: fund._id,
      }, auth(tokens[key]));
      assert(approvalRes.statusCode === 403, `${roleNames[key]} cannot create an approval`);
    }

    const createdEvents = {};
    for (const key of ['committee', 'treasurer', 'admin']) {
      const eventRes = await request(server, '/api/events', 'POST', eventBody(`${key} event ${suffix}`), auth(tokens[key]));
      assert(eventRes.statusCode === 201, `${roleNames[key]} can create an event`);
      createdEvents[key] = eventRes.body.data._id;
      const approvalRes = await request(server, '/api/approvals', 'POST', {
        description: `${key} approval ${suffix}`,
        requestedAmount: 100,
        fund: fund._id,
      }, auth(tokens[key]));
      assert(approvalRes.statusCode === 201, `${roleNames[key]} can create an approval`);
    }

    const quoteRes = await request(
      server,
      `/api/events/${createdEvents.committee}/quotations`,
      'POST',
      { name: 'Resident Vendor', quotationRef: 'Q-1', bidAmount: 500 },
      auth(tokens.resident)
    );
    assert(quoteRes.statusCode === 403, 'Resident cannot add an event quotation');

    const auditorQuote = await request(
      server,
      `/api/events/${createdEvents.committee}/quotations`,
      'POST',
      { name: 'Auditor Vendor', quotationRef: 'Q-2', bidAmount: 500 },
      auth(tokens.auditor)
    );
    assert(auditorQuote.statusCode === 403, 'Auditor cannot add an event quotation');

    const committeeQuote = await request(
      server,
      `/api/events/${createdEvents.committee}/quotations`,
      'POST',
      { name: 'Committee Vendor', quotationRef: 'Q-3', bidAmount: 500 },
      auth(tokens.committee)
    );
    assert(committeeQuote.statusCode === 201, 'Committee Member can add an event quotation');

    const residentApprove = await request(
      server,
      `/api/events/${createdEvents.committee}/approve`,
      'POST',
      { approvedBudget: 900 },
      auth(tokens.resident)
    );
    assert(residentApprove.statusCode === 403, 'Resident cannot approve an event');

    const residentSettle = await request(
      server,
      `/api/events/${createdEvents.committee}/settle`,
      'POST',
      { actualExpenditure: 100 },
      auth(tokens.resident)
    );
    assert(residentSettle.statusCode === 403, 'Resident cannot settle an event');

    const auditorSettle = await request(
      server,
      `/api/events/${createdEvents.committee}/settle`,
      'POST',
      { actualExpenditure: 100 },
      auth(tokens.auditor)
    );
    assert(auditorSettle.statusCode === 403, 'Auditor cannot settle an event');

    const treasurerApprove = await request(
      server,
      `/api/events/${createdEvents.committee}/approve`,
      'POST',
      { approvedBudget: 900, resolution: 'Authorization check' },
      auth(tokens.treasurer)
    );
    assert(treasurerApprove.statusCode === 200, 'Treasurer can approve a Committee Member event');

    const adminSettle = await request(
      server,
      `/api/events/${createdEvents.admin}/settle`,
      'POST',
      { actualExpenditure: 0 },
      auth(tokens.admin)
    );
    assert(adminSettle.statusCode === 200, 'Society Administrator can settle an event');

    console.log('\n--- Cross-society access ---');
    const crossEvent = await request(server, `/api/events/${createdEvents.committee}`, 'GET', null, auth(otherToken));
    assert(crossEvent.statusCode === 404, 'Another society cannot read the event');
    const crossApprove = await request(
      server,
      `/api/events/${createdEvents.committee}/approve`,
      'POST',
      { approvedBudget: 1 },
      auth(otherToken)
    );
    assert(crossApprove.statusCode === 404, 'Another society cannot approve the event');
    const crossSummary = await request(
      server,
      `/api/dashboard/summary?societyId=${societyA._id}`,
      'GET',
      null,
      auth(otherToken)
    );
    assert(crossSummary.statusCode === 403, 'Dashboard summary rejects another society id');

    console.log('\n--- Dashboard summary fields ---');
    const expectations = {
      resident: { approvals: false, reconciliations: false, observations: false },
      auditor: { approvals: false, reconciliations: true, observations: true },
      committee: { approvals: true, reconciliations: true, observations: true },
      treasurer: { approvals: true, reconciliations: true, observations: true },
      admin: { approvals: true, reconciliations: true, observations: true },
    };
    for (const [key, expected] of Object.entries(expectations)) {
      const summaryRes = await request(server, '/api/dashboard/summary', 'GET', null, auth(tokens[key]));
      assert(summaryRes.statusCode === 200, `${roleNames[key]} can read the dashboard summary`);
      const data = summaryRes.body.data;
      assert(typeof data.totalAvailableFunds === 'number', `${roleNames[key]} receives published fund totals`);
      assert(typeof data.maintenanceFundBalance === 'number', `${roleNames[key]} receives the maintenance balance`);
      assert(typeof data.totalExpenseMonth === 'number', `${roleNames[key]} receives published period expenses`);
      assert(Object.hasOwn(data, 'pendingApprovalsCount') === expected.approvals, `${roleNames[key]} approval count visibility is ${expected.approvals}`);
      assert(Object.hasOwn(data, 'pendingReconciliationsCount') === expected.reconciliations, `${roleNames[key]} reconciliation count visibility is ${expected.reconciliations}`);
      assert(Object.hasOwn(data, 'openAuditObservationsCount') === expected.observations, `${roleNames[key]} observation count visibility is ${expected.observations}`);
    }

    const otherSummary = await request(server, '/api/dashboard/summary', 'GET', null, auth(otherToken));
    assert(otherSummary.body.data.totalAvailableFunds === 0, 'Another society does not receive these fund balances');

    console.log('\n======================================================');
    console.log(`   Authorization Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
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

runAuthorizationTests().catch((error) => {
  console.error('\n❌ Authorization Test Suite Failure:', error);
  process.exit(1);
});
