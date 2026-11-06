/**
 * Resident Financial Transparency & Queries Test Suite
 * Covers published financial metrics, bank account masking,
 * resident query submission, committee responses, and query lifecycle.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Fund, Transaction, Event, ResidentQuery } from '../src/models/index.js';

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

async function runResidentTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Resident Transparency & Queries Tests');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  let society = null;

  try {
    // 1. Setup society, users, and funds
    society = await Society.create({
      name: `Resident Portal Test RWA ${suffix}`,
      code: `RES-${suffix}`.slice(0, 15),
      contactEmail: `res_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/999',
    });

    const residentUser = await User.create({
      society: society._id,
      name: 'Rohan Deshmukh',
      email: `rohan_${suffix}@test.org`,
      passwordHash: 'Resident@123',
      apartmentNumber: 'B-304',
      role: 'Resident',
    });

    const committeeUser = await User.create({
      society: society._id,
      name: 'Praveen Kumar',
      email: `praveen_${suffix}@test.org`,
      passwordHash: 'Committee@123',
      apartmentNumber: 'A-102',
      role: 'Committee Member',
    });

    const fund = await Fund.create({
      society: society._id,
      name: 'General Maintenance Fund',
      code: `FND-MNT-${suffix}`.slice(0, 16),
      type: 'OPERATIONAL',
      openingBalancePaise: 50000000, // ₹ 5,00,000
      bankAccount: 'HDFC Bank - A/C 501004891234',
      createdBy: committeeUser._id,
    });

    // Create an event
    await Event.create({
      society: society._id,
      title: 'Monsoon Tree Pruning & Safety Drive',
      date: new Date('2026-11-15'),
      status: 'APPROVED',
      proposedBudgetPaise: 4000000,
      approvedBudgetPaise: 3500000,
      fundingSource: 'Operational Maintenance Account',
      proposedBy: residentUser._id,
    });

    await Event.create({
      society: society._id,
      title: 'Unpublished Draft Carnival',
      date: new Date('2026-12-01'),
      status: 'PROPOSED',
      proposedBudgetPaise: 900000,
      fundingSource: 'Operational Maintenance Account',
      proposedBy: residentUser._id,
    });

    const draftVoucher = await Transaction.create({
      society: society._id,
      fund: fund._id,
      reference: `VR-DRAFT-${suffix}`.slice(0, 50),
      date: new Date('2026-10-20'),
      type: 'EXPENSE',
      category: 'Internal Draft',
      description: 'Unpublished committee draft voucher',
      amountPaise: 250000,
      paymentMethod: 'CASH',
      status: 'PENDING',
      createdBy: committeeUser._id,
    });

    // Obtain JWT tokens
    const resLogin = await request(server, '/api/auth/login', 'POST', {
      email: residentUser.email,
      password: 'Resident@123',
    });
    const residentToken = resLogin.body.data.accessToken;

    const commLogin = await request(server, '/api/auth/login', 'POST', {
      email: committeeUser.email,
      password: 'Committee@123',
    });
    const committeeToken = commLogin.body.data.accessToken;

    // --- 1. Transparency Feed Verification ---
    console.log('--- 1. Published Transparency Data & Masking ---');
    const transRes = await request(server, '/api/resident/transparency', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });

    assert(transRes.statusCode === 200, 'Resident successfully accessed transparency data');
    assert(transRes.body.data.societyName.includes('Resident Portal Test RWA'), 'Returned society name');
    assert(Array.isArray(transRes.body.data.publishedFunds), 'Published funds list returned');
    assert(transRes.body.data.publishedFunds.length > 0, 'Fund record present');

    const publishedFund = transRes.body.data.publishedFunds[0];
    assert(publishedFund.bankAccountMasked.includes('****'), 'Bank account is masked with asterisks');
    assert(!publishedFund.bankAccountMasked.includes('501004891234'), 'Full confidential bank account is never exposed to residents');
    assert(transRes.body.data.publishedIncomeExpenditure !== undefined, 'Published income vs expenditure returned');
    assert(Array.isArray(transRes.body.data.publishedEvents), 'Published approved events returned');
    assert(transRes.body.data.publishedEvents[0].approvedBudget === 35000, 'Approved event budget accurately displayed');

    // --- 2. Resident Query Submission ---
    console.log('\n--- 2. Resident Clarification Query Submission ---');

    // Validation check: empty subject
    const invalidQueryRes = await request(
      server,
      '/api/resident/queries',
      'POST',
      { category: 'Maintenance Billing', subject: '', question: 'Where is the bill?' },
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(invalidQueryRes.statusCode === 400, 'Query rejected with 400 when subject is empty');

    // Legitimate query submission
    const submitRes = await request(
      server,
      '/api/resident/queries',
      'POST',
      {
        category: 'Maintenance Billing',
        subject: 'Clarification regarding water tanker surcharge in October bill',
        question: 'Could the committee share the number of tankers procured during the BESCOM water supply outage?',
      },
      { Authorization: `Bearer ${residentToken}` }
    );

    assert(submitRes.statusCode === 201, 'Clarification query submitted successfully (HTTP 201)');
    assert(submitRes.body.data.query.status === 'OPEN', 'Initial query status is OPEN');
    assert(submitRes.body.data.query.reference.startsWith('QRY-'), 'Auto-generated formatted reference code (e.g. QRY-2026-001)');

    const queryId = submitRes.body.data.query._id;

    // --- 3. Query Listing & Privacy Scoping ---
    console.log('\n--- 3. Query Scoping & Query Search ---');
    const getQueriesRes = await request(server, '/api/resident/queries', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });

    assert(getQueriesRes.statusCode === 200, 'Queries retrieved');
    assert(getQueriesRes.body.data.queries.length === 1, 'Resident sees their own open query');
    assert(getQueriesRes.body.data.queries[0].subject.includes('water tanker surcharge'), 'Subject matched');

    // --- 4. Committee Response & Lifecycle Transition ---
    console.log('\n--- 4. Committee Official Response & Lifecycle ---');

    // Unauthorized role (resident cannot respond to their own query)
    const unauthorizedRespondRes = await request(
      server,
      `/api/resident/queries/${queryId}/respond`,
      'POST',
      { response: 'Self response attempt' },
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(unauthorizedRespondRes.statusCode === 403, 'Resident blocked with 403 from posting committee responses');

    // Committee member responds
    const legitimateRespondRes = await request(
      server,
      `/api/resident/queries/${queryId}/respond`,
      'POST',
      {
        response: '14 tankers of 6,000L capacity were procured between Oct 12-16. Logbook is available at the security desk.',
        newStatus: 'ANSWERED',
      },
      { Authorization: `Bearer ${committeeToken}` }
    );

    assert(legitimateRespondRes.statusCode === 200, 'Committee member successfully posted response');
    assert(legitimateRespondRes.body.data.query.status === 'ANSWERED', 'Query status transitioned to ANSWERED');
    assert(legitimateRespondRes.body.data.query.responses.length === 1, 'Official response recorded in history');

    // --- 5. Unpublished financial records stay hidden from residents ---
    console.log('\n--- 5. Unpublished Financial Records ---');
    const residentTxRes = await request(server, '/api/transactions?limit=100', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentTxRes.statusCode === 200, 'Resident can query the published ledger');
    assert(
      !residentTxRes.body.data.transactions.some((t) => t.reference === draftVoucher.reference),
      'Pending unpublished voucher is hidden from the resident ledger'
    );

    const residentTxById = await request(server, `/api/transactions/${draftVoucher._id}`, 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentTxById.statusCode === 404, 'Direct access to an unpublished voucher returns 404');

    const residentFundsRes = await request(server, '/api/funds', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentFundsRes.statusCode === 200, 'Resident can query fund summaries');
    assert(
      residentFundsRes.body.data.funds.every((f) => !String(f.bankAccount).includes('501004891234')),
      'Full bank account number is masked on resident fund responses'
    );

    const residentEventsRes = await request(server, '/api/events', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentEventsRes.statusCode === 200, 'Resident can query published events');
    assert(
      !residentEventsRes.body.data.events.some((e) => e.title === 'Unpublished Draft Carnival'),
      'Proposed unpublished events are hidden from residents'
    );
    assert(
      residentEventsRes.body.data.events.some((e) => e.title === 'Monsoon Tree Pruning & Safety Drive'),
      'Approved events remain visible to residents'
    );

    console.log('\n======================================================');
    console.log(`   Resident Portal Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    if (society) {
      await ResidentQuery.deleteMany({ society: society._id });
      await Transaction.collection.deleteMany({ society: society._id });
      await Event.deleteMany({ society: society._id });
      await Fund.deleteMany({ society: society._id });
      await User.deleteMany({ society: society._id });
      await Society.collection.deleteOne({ _id: society._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runResidentTests().catch((err) => {
  console.error('\n❌ Resident Portal Test Suite Failure:', err);
  process.exit(1);
});
