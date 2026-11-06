/**
 * Bank Reconciliation & Financial Verification Test Suite
 * Covers session creation, closing balance variance, safe statement import,
 * duplicate reference checks, manual matching, discrepancy resolution,
 * immutability upon finalization, and RBAC / society isolation.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Fund, Transaction, Reconciliation } from '../src/models/index.js';

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

async function runReconciliationTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Bank Reconciliation Module Tests');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  let societyA = null;
  let societyB = null;

  try {
    // 1. Setup societies, users, and funds
    societyA = await Society.create({
      name: `Reconciliation RWA A ${suffix}`,
      code: `REC-A-${suffix}`.slice(0, 15),
      contactEmail: `rec_a_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/301',
    });

    societyB = await Society.create({
      name: `Reconciliation RWA B ${suffix}`,
      code: `REC-B-${suffix}`.slice(0, 15),
      contactEmail: `rec_b_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/302',
    });

    const treasurer = await User.create({
      society: societyA._id,
      name: 'Priya Sharma',
      email: `treasurer_${suffix}@test.org`,
      passwordHash: 'Treasurer@123',
      apartmentNumber: 'A-402',
      role: 'Treasurer',
    });

    const auditor = await User.create({
      society: societyA._id,
      name: 'Suresh Menon, CA',
      email: `auditor_${suffix}@test.org`,
      passwordHash: 'Auditor@123',
      apartmentNumber: 'C-201',
      role: 'Auditor',
    });

    const resident = await User.create({
      society: societyA._id,
      name: 'Rohan Resident',
      email: `resident_${suffix}@test.org`,
      passwordHash: 'Resident@123',
      apartmentNumber: 'B-104',
      role: 'Resident',
    });

    const committee = await User.create({
      society: societyA._id,
      name: 'Committee Member',
      email: `committee_${suffix}@test.org`,
      passwordHash: 'Committee@123',
      apartmentNumber: 'D-101',
      role: 'Committee Member',
    });

    const admin = await User.create({
      society: societyA._id,
      name: 'Society Admin',
      email: `admin_${suffix}@test.org`,
      passwordHash: 'Admin@123',
      apartmentNumber: 'A-101',
      role: 'Society Administrator',
    });

    const userInSocB = await User.create({
      society: societyB._id,
      name: 'External Admin',
      email: `admin_b_${suffix}@test.org`,
      passwordHash: 'Admin@123',
      apartmentNumber: 'PH-01',
      role: 'Society Administrator',
    });

    const fund = await Fund.create({
      society: societyA._id,
      name: 'Operational Maintenance Fund',
      code: `FND-MNT-${suffix}`.slice(0, 16),
      type: 'OPERATIONAL',
      openingBalancePaise: 40000000, // ₹ 4,00,000
      currentBalancePaise: 40000000,
      bankAccount: 'HDFC Bank - A/C 501004891200',
      createdBy: treasurer._id,
    });

    // Create 2 ledger transactions for matching
    const ledgerTx1 = await Transaction.create({
      society: societyA._id,
      fund: fund._id,
      reference: `VR-${suffix}-01`,
      date: new Date('2026-10-15'),
      type: 'EXPENSE',
      category: 'Lift Maintenance',
      description: 'Johnson Lifts quarterly maintenance AMC',
      amountPaise: 1850000, // ₹ 18,500
      paymentMethod: 'NEFT_RTGS',
      createdBy: treasurer._id,
    });

    const ledgerTx2 = await Transaction.create({
      society: societyA._id,
      fund: fund._id,
      reference: `VR-${suffix}-02`,
      date: new Date('2026-10-18'),
      type: 'INCOME',
      category: 'Maintenance Dues',
      description: 'Maintenance collection batch Wing A',
      amountPaise: 4500000, // ₹ 45,000
      paymentMethod: 'UPI',
      createdBy: treasurer._id,
    });

    // Obtain JWT tokens
    const treasLogin = await request(server, '/api/auth/login', 'POST', {
      email: treasurer.email,
      password: 'Treasurer@123',
    });
    const treasurerToken = treasLogin.body.data.accessToken;

    const auditLogin = await request(server, '/api/auth/login', 'POST', {
      email: auditor.email,
      password: 'Auditor@123',
    });
    const auditorToken = auditLogin.body.data.accessToken;

    const resLogin = await request(server, '/api/auth/login', 'POST', {
      email: resident.email,
      password: 'Resident@123',
    });
    const residentToken = resLogin.body.data.accessToken;

    const committeeLogin = await request(server, '/api/auth/login', 'POST', {
      email: committee.email,
      password: 'Committee@123',
    });
    const committeeToken = committeeLogin.body.data.accessToken;

    const adminLogin = await request(server, '/api/auth/login', 'POST', {
      email: admin.email,
      password: 'Admin@123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const socBLogin = await request(server, '/api/auth/login', 'POST', {
      email: userInSocB.email,
      password: 'Admin@123',
    });
    const socBToken = socBLogin.body.data.accessToken;

    // --- 1. Session Creation & Balance Comparison ---
    console.log('--- 1. Session Creation & Balance Comparison ---');
    const createSessionRes = await request(
      server,
      '/api/reconciliation',
      'POST',
      {
        fundId: fund._id,
        accountName: 'HDFC Operational Current A/C #1200',
        statementPeriodStart: '2026-10-01',
        statementPeriodEnd: '2026-10-31',
        statementClosingBalance: 400000, // ₹ 4,00,000
        notes: 'Monthly bank statement reconciliation for October 2026',
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );

    assert(createSessionRes.statusCode === 201, 'Reconciliation session created (HTTP 201)');
    assert(createSessionRes.body.data.reconciliation.status === 'IN_PROGRESS', 'Initial session status is IN_PROGRESS');
    assert(createSessionRes.body.data.reconciliation.isFinalized === false, 'Session is not finalized initially');
    const sessionId = createSessionRes.body.data.reconciliation._id;

    const pendingListRes = await request(server, '/api/reconciliation', 'GET', null, {
      Authorization: `Bearer ${treasurerToken}`,
    });
    const pendingSession = pendingListRes.body.data.reconciliations.find(
      (item) => String(item.id) === String(sessionId)
    );
    assert(pendingSession.differenceAmount === 0, 'New session has zero statement variance');
    assert(pendingSession.isFinalized === false, 'Zero-variance session remains editable');
    assert(
      pendingSession.displayStatus === 'Matched — Pending Finalization',
      'Zero-variance session is pending finalization'
    );
    assert(
      pendingSession.displayStatus !== 'Reconciled & Matched',
      'Zero-variance session is not labeled reconciled before finalization'
    );

    // --- 2. Safe Statement Import & Idempotency / Duplicate Detection ---
    console.log('\n--- 2. Safe Statement Import & Idempotency ---');
    const sampleRows = [
      {
        date: '2026-10-15',
        description: 'RTGS/HDFC/JOHNSON LIFTS AMC',
        reference: 'UTR-HDFC-992144',
        debit: 18500, // Matches ledgerTx1 exactly
      },
      {
        date: '2026-10-18',
        description: 'UPI/RAZORPAY/WING A COLLECTION',
        reference: 'UPI-RAZ-881920',
        credit: 42000, // Intentional variance: ₹42,000 vs ledger ₹45,000!
      },
      {
        date: '2026-10-25',
        description: 'BANK SERVICE CHARGES Q2',
        reference: 'CHG-9901',
        debit: 550, // Unmatched bank-only charge
      },
    ];

    const importRes = await request(
      server,
      `/api/reconciliation/${sessionId}/import-statement`,
      'POST',
      { rows: sampleRows },
      { Authorization: `Bearer ${treasurerToken}` }
    );

    assert(importRes.statusCode === 200, 'Statement rows successfully imported');
    assert(importRes.body.data.importedCount === 3, 'Imported 3 statement transactions');

    // Verify statement import did NOT alter ledger balances
    const checkFund = await Fund.findById(fund._id);
    assert(checkFund.currentBalancePaise === 40000000, 'Financial safety: Statement import did NOT modify fund ledger balance');

    // Duplicate import test (idempotency check)
    const duplicateImportRes = await request(
      server,
      `/api/reconciliation/${sessionId}/import-statement`,
      'POST',
      { rows: [sampleRows[0]] }, // Same reference UTR-HDFC-992144
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(duplicateImportRes.body.data.skippedDuplicateCount === 1, 'Idempotency control skipped duplicate statement reference');

    // --- 3. Manual Matching & Discrepancy Detection ---
    console.log('\n--- 3. Manual Matching & Discrepancy Detection ---');
    const sessionDetails = await request(
      server,
      `/api/reconciliation/${sessionId}`,
      'GET',
      null,
      { Authorization: `Bearer ${treasurerToken}` }
    );
    const stTx1 = sessionDetails.body.data.reconciliation.statementTransactions.find(
      (st) => st.reference === 'UTR-HDFC-992144'
    );
    const stTx2 = sessionDetails.body.data.reconciliation.statementTransactions.find(
      (st) => st.reference === 'UPI-RAZ-881920'
    );

    // 3a. Exact match on ledgerTx1
    const match1Res = await request(
      server,
      `/api/reconciliation/${sessionId}/match`,
      'POST',
      { statementTxId: stTx1._id, ledgerTxId: ledgerTx1._id },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(match1Res.statusCode === 200, 'Matched exact transaction');
    assert(match1Res.body.data.matchedStatementRow.status === 'MATCHED', 'Statement row status is MATCHED');

    // 3b. Amount mismatch test on ledgerTx2 (Statement ₹42,000 vs Ledger ₹45,000)
    const match2Res = await request(
      server,
      `/api/reconciliation/${sessionId}/match`,
      'POST',
      { statementTxId: stTx2._id, ledgerTxId: ledgerTx2._id },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(match2Res.statusCode === 200, 'Recorded match with variance');

    // Verify discrepancy item was generated
    const sessionWithDisc = await request(
      server,
      `/api/reconciliation/${sessionId}`,
      'GET',
      null,
      { Authorization: `Bearer ${treasurerToken}` }
    );
    const amountDisc = sessionWithDisc.body.data.reconciliation.discrepancies.find(
      (d) => d.type === 'AMOUNT_MISMATCH'
    );
    assert(amountDisc !== undefined, 'Auto-generated AMOUNT_MISMATCH discrepancy');
    assert(amountDisc.amountPaise === 300000, 'Calculated exact discrepancy: ₹ 3,000 (45,000 - 42,000)');

    // --- 4. Discrepancy Resolution ---
    console.log('\n--- 4. Discrepancy Resolution ---');
    const resolveRes = await request(
      server,
      `/api/reconciliation/${sessionId}/discrepancies/${amountDisc._id}/resolve`,
      'POST',
      {
        explanation: 'Tenant flat A-302 deducted ₹3,000 maintenance credit for plumbing repair invoice VR-2026-081.',
        correctiveAction: 'Credit memo adjustment passed in November batch.',
        status: 'RESOLVED',
      },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(resolveRes.statusCode === 200, 'Discrepancy resolved with explanation');
    assert(resolveRes.body.data.discrepancy.status === 'RESOLVED', 'Discrepancy transitioned to RESOLVED');

    // --- 5. Finalization & Immutability Lock ---
    console.log('\n--- 5. Finalization & Immutability Lock ---');
    const finalizeRes = await request(
      server,
      `/api/reconciliation/${sessionId}/finalize`,
      'POST',
      { notes: 'October 2026 bank reconciliation signed off by Suresh Menon, CA' },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(finalizeRes.statusCode === 200, 'Reconciliation finalized and locked');
    assert(finalizeRes.body.data.reconciliation.isFinalized === true, 'isFinalized set to true');

    // Immutability Enforcement: attempt to match or import into finalized session MUST FAIL!
    const tamperMatchRes = await request(
      server,
      `/api/reconciliation/${sessionId}/match`,
      'POST',
      { statementTxId: stTx1._id, ledgerTxId: ledgerTx1._id },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(tamperMatchRes.statusCode === 400, 'Immutability: Further matching on finalized session strictly blocked (400)');
    assert(
      tamperMatchRes.body.message.includes('finalized'),
      'Match rejection uses the finalized-session message'
    );

    const finalizedListRes = await request(server, '/api/reconciliation', 'GET', null, {
      Authorization: `Bearer ${auditorToken}`,
    });
    const finalizedSession = finalizedListRes.body.data.reconciliations.find(
      (item) => String(item.id) === String(sessionId)
    );
    assert(finalizedSession.isFinalized === true, 'Listed session is finalized');
    assert(
      finalizedSession.displayStatus === 'Reconciled & Matched',
      'Finalized zero-variance session is labeled reconciled and matched'
    );

    const repeatFinalizeRes = await request(
      server,
      `/api/reconciliation/${sessionId}/finalize`,
      'POST',
      { notes: 'Second attempt' },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(repeatFinalizeRes.statusCode === 400, 'Repeated finalization is rejected');
    assert(
      repeatFinalizeRes.body.message === 'Reconciliation is already finalized and locked.',
      'Repeated finalization returns the specific lock message'
    );

    const tamperImportRes = await request(
      server,
      `/api/reconciliation/${sessionId}/import-statement`,
      'POST',
      { rows: [{ date: '2026-10-26', description: 'Late row', reference: `LATE-${suffix}`, debit: 10 }] },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(tamperImportRes.statusCode === 400, 'Statement import is rejected after finalization');
    assert(
      tamperImportRes.body.message.includes('finalized'),
      'Import rejection uses the finalized-session message'
    );

    // --- 6. Role-Based Access Control Restrictions ---
    console.log('\n--- 6. Role-Based Access Control Restrictions ---');
    const residentCreateRes = await request(
      server,
      '/api/reconciliation',
      'POST',
      { fundId: fund._id, accountName: 'Hacked', statementPeriodStart: '2026-10-01', statementPeriodEnd: '2026-10-31', statementClosingBalance: 100 },
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(residentCreateRes.statusCode === 403, 'Resident strictly blocked from creating reconciliation sessions (403)');

    const residentListRes = await request(server, '/api/reconciliation', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentListRes.statusCode === 403, 'Resident cannot list reconciliation sessions (403)');
    const residentDetailRes = await request(server, `/api/reconciliation/${sessionId}`, 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentDetailRes.statusCode === 403, 'Resident cannot open a reconciliation session (403)');

    const committeeListRes = await request(server, '/api/reconciliation', 'GET', null, {
      Authorization: `Bearer ${committeeToken}`,
    });
    assert(committeeListRes.statusCode === 403, 'Committee Member cannot list reconciliation sessions (403)');
    const committeeCreateRes = await request(
      server,
      '/api/reconciliation',
      'POST',
      { fundId: fund._id, accountName: 'Committee account', statementPeriodStart: '2026-10-01', statementPeriodEnd: '2026-10-31', statementClosingBalance: 100 },
      { Authorization: `Bearer ${committeeToken}` }
    );
    assert(committeeCreateRes.statusCode === 403, 'Committee Member cannot create a reconciliation session (403)');
    const committeeMatchRes = await request(
      server,
      `/api/reconciliation/${sessionId}/match`,
      'POST',
      { statementTxId: new mongoose.Types.ObjectId().toString(), ledgerTxId: ledgerTx1._id.toString() },
      { Authorization: `Bearer ${committeeToken}` }
    );
    assert(committeeMatchRes.statusCode === 403, 'Committee Member cannot match reconciliation rows (403)');

    const auditorCreateRes = await request(
      server,
      '/api/reconciliation',
      'POST',
      { fundId: fund._id, accountName: 'Auditor account', statementPeriodStart: '2026-10-01', statementPeriodEnd: '2026-10-31', statementClosingBalance: 100 },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(auditorCreateRes.statusCode === 403, 'Auditor cannot create a reconciliation session (403)');
    const auditorImportRes = await request(
      server,
      `/api/reconciliation/${sessionId}/import-statement`,
      'POST',
      { rows: [{ date: '2026-10-20', description: 'Late', reference: `AUD-${suffix}`, debit: 10 }] },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(auditorImportRes.statusCode === 403, 'Auditor cannot import a bank statement (403)');
    const auditorListRes = await request(server, '/api/reconciliation', 'GET', null, {
      Authorization: `Bearer ${auditorToken}`,
    });
    assert(auditorListRes.statusCode === 200, 'Auditor can inspect reconciliation sessions');

    const adminListRes = await request(server, '/api/reconciliation', 'GET', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminListRes.statusCode === 200, 'Society Administrator can inspect reconciliation sessions');

    const lockedResolveRes = await request(
      server,
      `/api/reconciliation/${sessionId}/discrepancies/${new mongoose.Types.ObjectId().toString()}/resolve`,
      'POST',
      { explanation: 'Too late' },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(lockedResolveRes.statusCode === 400, 'Discrepancy resolution is rejected after finalization');

    // --- 7. Society-Level Data Isolation ---
    console.log('\n--- 7. Society-Level Data Isolation ---');
    const crossSocRes = await request(
      server,
      `/api/reconciliation/${sessionId}`,
      'GET',
      null,
      { Authorization: `Bearer ${socBToken}` }
    );
    assert(crossSocRes.statusCode === 404, 'User in Society B cannot view Society A reconciliation session (404)');
    const crossMatchRes = await request(
      server,
      `/api/reconciliation/${sessionId}/match`,
      'POST',
      { statementTxId: new mongoose.Types.ObjectId().toString(), ledgerTxId: ledgerTx1._id.toString() },
      { Authorization: `Bearer ${socBToken}` }
    );
    assert(crossMatchRes.statusCode === 404, 'User in Society B cannot match a session from Society A');
    const crossQueryRes = await request(
      server,
      `/api/reconciliation?societyId=${societyB._id}`,
      'GET',
      null,
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(crossQueryRes.statusCode === 403, 'A browser-supplied society id is rejected');

    console.log('\n======================================================');
    console.log(`   Reconciliation Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    if (societyA) {
      await Reconciliation.deleteMany({ society: societyA._id });
      await Transaction.collection.deleteMany({ society: societyA._id });
      await Fund.deleteMany({ society: societyA._id });
      await User.deleteMany({ society: societyA._id });
      await Society.collection.deleteOne({ _id: societyA._id });
    }
    if (societyB) {
      await User.deleteMany({ society: societyB._id });
      await Society.collection.deleteOne({ _id: societyB._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runReconciliationTests().catch((err) => {
  console.error('\n❌ Reconciliation Test Suite Failure:', err);
  process.exit(1);
});
