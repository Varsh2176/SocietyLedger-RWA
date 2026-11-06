/**
 * Event Budget & Expenditure Transparency Test Suite
 * Covers event proposals, committee approval, vendor quotation comparison,
 * expense approvals, strict Separation of Duties, and event settlement calculations.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Fund, Event, Approval, Transaction } from '../src/models/index.js';

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

async function runEventsTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Events & Expense Governance Tests');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  let society = null;

  try {
    // 1. Setup society, users, and fund
    society = await Society.create({
      name: `Events Test RWA ${suffix}`,
      code: `EVT-${suffix}`.slice(0, 15),
      contactEmail: `evt_${suffix}@test.org`,
    });

    const fund = await Fund.create({
      society: society._id,
      name: 'Cultural & Event Fund',
      code: `FND-CULT-${suffix}`.slice(0, 16),
      type: 'OPERATIONAL',
      openingBalancePaise: 50000000, // ₹ 5,00,000
      currentBalancePaise: 50000000,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // Create 3 users for separation-of-duties verification:
    // User 1: Requester (Committee Member)
    const requester = await User.create({
      name: 'Sunil Requester',
      email: `req_${suffix}@test.org`,
      passwordHash: 'Password@123',
      role: 'Committee Member',
      society: society._id,
      verificationStatus: 'VERIFIED',
    });

    // User 2: Approver (Treasurer)
    const approver = await User.create({
      name: 'Priya Approver',
      email: `appr_${suffix}@test.org`,
      passwordHash: 'Password@123',
      role: 'Treasurer',
      society: society._id,
      verificationStatus: 'VERIFIED',
    });

    // Login both users
    const loginReq = await request(server, '/api/auth/login', 'POST', {
      email: `req_${suffix}@test.org`,
      password: 'Password@123',
    });
    const requesterToken = loginReq.body.data.accessToken;

    const loginAppr = await request(server, '/api/auth/login', 'POST', {
      email: `appr_${suffix}@test.org`,
      password: 'Password@123',
    });
    const approverToken = loginAppr.body.data.accessToken;

    // --- 2. Event Proposal & Budget Lifecycle ---
    console.log('--- 1. Event Proposal & Budget Sanction ---');

    // 2a: Propose Event
    const proposeRes = await request(
      server,
      '/api/events',
      'POST',
      {
        title: 'Diwali Cultural Gala',
        description: 'Pandal setup, community sweets, and cultural stage for residents',
        date: '2026-11-01',
        proposedBudget: 80000, // ₹ 80,000
        fundingSource: 'Cultural Reserve',
        budgetBreakdown: [
          { head: 'Stage & Audio', proposed: 35000 },
          { head: 'Community Dinner', proposed: 45000 },
        ],
      },
      { Authorization: `Bearer ${requesterToken}` }
    );
    assert(proposeRes.statusCode === 201, 'Proposed community event');
    assert(proposeRes.body.data.status === 'PROPOSED', 'Event initial status is PROPOSED');
    assert(proposeRes.body.data.proposedBudgetPaise === 8000000, 'Budget stored in integer paise');
    const eventId = proposeRes.body.data._id;

    // 2b: Committee approves event budget with reduction (sanction ₹ 75,000)
    const approveEvtRes = await request(
      server,
      `/api/events/${eventId}/approve`,
      'POST',
      {
        approvedBudget: 75000,
        resolution: 'Managing Committee Resolution #2026/10',
      },
      { Authorization: `Bearer ${approverToken}` }
    );
    assert(approveEvtRes.statusCode === 200, 'Approved event budget');
    assert(approveEvtRes.body.data.status === 'APPROVED', 'Event status transitioned to APPROVED');
    assert(approveEvtRes.body.data.approvedBudgetPaise === 7500000, 'Approved budget recorded');

    // --- 3. Vendor Quotation Submission & Selection ---
    console.log('\n--- 2. Quotation Submission & Comparison ---');

    // 3a: Add Vendor A quotation
    const quote1Res = await request(
      server,
      `/api/events/${eventId}/quotations`,
      'POST',
      {
        name: 'Royal Pandal Decorators',
        quotationRef: 'Q-RP-101',
        bidAmount: 32000,
      },
      { Authorization: `Bearer ${requesterToken}` }
    );
    assert(quote1Res.statusCode === 201, 'Submitted Vendor A quotation');

    // 3b: Add Vendor B quotation
    const quote2Res = await request(
      server,
      `/api/events/${eventId}/quotations`,
      'POST',
      {
        name: 'Krishna Caterers & Stage',
        quotationRef: 'Q-KC-202',
        bidAmount: 28000,
      },
      { Authorization: `Bearer ${requesterToken}` }
    );
    assert(quote2Res.statusCode === 201, 'Submitted Vendor B quotation');

    // Get event and select Vendor B (more competitive bid)
    const getEvtRes = await request(server, `/api/events/${eventId}`, 'GET', null, {
      Authorization: `Bearer ${requesterToken}`,
    });
    const vendorBQuote = getEvtRes.body.data.quotations.find((q) => q.name === 'Krishna Caterers & Stage');

    const selectVendorRes = await request(
      server,
      `/api/events/${eventId}/select-vendor`,
      'POST',
      { quotationId: vendorBQuote._id },
      { Authorization: `Bearer ${approverToken}` }
    );
    assert(selectVendorRes.statusCode === 200, 'Selected preferred vendor');
    const updatedVendorB = selectVendorRes.body.data.quotations.find((q) => q.name === 'Krishna Caterers & Stage');
    assert(updatedVendorB.status === 'SELECTED', 'Chosen vendor bid marked SELECTED');

    // --- 4. Expense Approvals & Separation of Duties ---
    console.log('\n--- 3. Expense Approvals & Strict Separation of Duties ---');

    // 4a: Requester submits an expense approval request for Vendor B's advance
    const approvalReqRes = await request(
      server,
      '/api/approvals',
      'POST',
      {
        description: 'Advance payment for stage setup (Krishna Caterers)',
        requestedAmount: 15000, // ₹ 15,000
        fund: fund._id,
        relatedEvent: eventId,
        vendorName: 'Krishna Caterers & Stage',
        invoiceNumber: 'ADV-KC-01',
      },
      { Authorization: `Bearer ${requesterToken}` }
    );
    assert(approvalReqRes.statusCode === 201, 'Expense approval request created');
    const approvalId = approvalReqRes.body.data._id;

    // 4b: SEPARATION OF DUTIES VIOLATION TEST: Requester tries to approve their OWN request!
    const selfApproveRes = await request(
      server,
      `/api/approvals/${approvalId}/decision`,
      'POST',
      { action: 'APPROVED', comments: 'Self approval attempt' },
      { Authorization: `Bearer ${requesterToken}` } // Sunil created it and tries to approve it!
    );
    assert(selfApproveRes.statusCode === 403, 'Self-approval strictly blocked with 403 Forbidden');
    assert(selfApproveRes.body.message.includes('Separation-of-Duties'), 'Clear error indicates separation of duties policy');

    // 4c: Authorized third-party approver (Treasurer Priya) approves the request
    const legitimateApproveRes = await request(
      server,
      `/api/approvals/${approvalId}/decision`,
      'POST',
      { action: 'APPROVED', comments: 'Stage advance approved as per selected quotation' },
      { Authorization: `Bearer ${approverToken}` }
    );
    assert(legitimateApproveRes.statusCode === 200, 'Legitimate approval successfully executed');
    assert(legitimateApproveRes.body.data.approval.status === 'APPROVED', 'Approval status transitioned to APPROVED');
    assert(legitimateApproveRes.body.data.resultingTransaction !== null, 'Automatically generated linked ledger transaction');

    // Verify fund was deducted: 5,00,000 - 15,000 = 4,85,000
    const checkFundRes = await request(server, `/api/funds/${fund._id}`, 'GET', null, {
      Authorization: `Bearer ${approverToken}`,
    });
    assert(checkFundRes.body.data.currentBalance === 485000, 'Fund balance debited automatically on approved expense');

    // --- 5. Event Settlement Summary ---
    console.log('\n--- 4. Event Settlement & Unspent Balance Calculation ---');

    // Settle event with actual expenditure of ₹ 72,000 (Approved: ₹ 75,000, Unspent: ₹ 3,000)
    const settleRes = await request(
      server,
      `/api/events/${eventId}/settle`,
      'POST',
      {
        actualExpenditure: 72000,
        settlementNotes: 'Event concluded successfully. All bills verified against bank statement.',
      },
      { Authorization: `Bearer ${approverToken}` }
    );
    assert(settleRes.statusCode === 200, 'Event settlement recorded');
    assert(settleRes.body.data.event.status === 'SETTLED', 'Event transitioned to SETTLED');
    assert(settleRes.body.data.unspentBalanceRupees === 3000, 'Authoritative unspent balance calculated: ₹ 3,000 (75,000 - 72,000)');

    console.log('\n======================================================');
    console.log(`   Events & Governance Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    if (society) {
      await Approval.deleteMany({ society: society._id });
      await Event.deleteMany({ society: society._id });
      await Transaction.collection.deleteMany({ society: society._id });
      await Fund.deleteMany({ society: society._id });
      await User.deleteMany({ society: society._id });
      await Society.collection.deleteOne({ _id: society._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runEventsTests().catch((err) => {
  console.error('\n❌ Events & Governance Test Suite Failure:', err);
  process.exit(1);
});
