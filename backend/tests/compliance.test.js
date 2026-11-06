/**
 * Tax Compliance & Filing Tracker Test Suite
 * Tests date validation, overdue auto-classification, permission enforcement,
 * draft vs. filed separation, revision lifecycle, and supporting documents.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Compliance } from '../src/models/index.js';

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

async function runComplianceTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Tax Compliance & Filing Tracker Tests');
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
    // 1. Setup societies and users
    societyA = await Society.create({
      name: `Compliance RWA A ${suffix}`,
      code: `CMP-A-${suffix}`.slice(0, 15),
      contactEmail: `cmp_a_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/101',
    });

    societyB = await Society.create({
      name: `Compliance RWA B ${suffix}`,
      code: `CMP-B-${suffix}`.slice(0, 15),
      contactEmail: `cmp_b_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/102',
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

    const userInSocB = await User.create({
      society: societyB._id,
      name: 'External Admin',
      email: `admin_b_${suffix}@test.org`,
      passwordHash: 'Admin@123',
      apartmentNumber: 'PH-01',
      role: 'Society Administrator',
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

    const socBLogin = await request(server, '/api/auth/login', 'POST', {
      email: userInSocB.email,
      password: 'Admin@123',
    });
    const socBToken = socBLogin.body.data.accessToken;

    // --- 1. Task Creation & Date Validation ---
    console.log('--- 1. Task Creation & Date Validation ---');

    // Missing required fields
    const invalidReq = await request(
      server,
      '/api/compliance',
      'POST',
      { filingType: '', statutoryBody: '', deadline: 'not-a-date' },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(invalidReq.statusCode === 400, 'Creation rejected with 400 when fields missing');
    assert(invalidReq.body.errors.length > 0, 'Returns specific field validation errors');

    // Create overdue task for past date
    const pastDeadline = new Date();
    pastDeadline.setDate(pastDeadline.getDate() - 15);

    const overdueTaskRes = await request(
      server,
      '/api/compliance',
      'POST',
      {
        filingType: 'Quarterly TDS Return - Form 26Q',
        category: 'TAX_DIRECT',
        statutoryBody: 'Income Tax Department (TRACES)',
        financialPeriod: 'Q1 FY 2026-27 (Apr - Jun)',
        deadline: pastDeadline.toISOString(),
        deadlineSource: 'Income Tax Act Sec 200(3)',
        responsiblePerson: treasurer._id,
        notes: 'Deductions on elevator AMC and security guard invoices',
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(overdueTaskRes.statusCode === 201, 'TDS compliance task created successfully');
    assert(overdueTaskRes.body.data.task.status === 'PENDING', 'Initial status is PENDING');
    const overdueTaskId = overdueTaskRes.body.data.task._id;

    // Create upcoming task for next month
    const futureDeadline = new Date();
    futureDeadline.setDate(futureDeadline.getDate() + 20);

    const upcomingTaskRes = await request(
      server,
      '/api/compliance',
      'POST',
      {
        filingType: 'Society Annual Return (Form V)',
        category: 'REGISTRAR_SOCIETIES',
        statutoryBody: 'Registrar of Co-operative Societies (Karnataka)',
        financialPeriod: 'FY 2025-26',
        deadline: futureDeadline.toISOString(),
        deadlineSource: 'Karnataka Societies Registration Act 1960 Sec 13',
        responsiblePerson: treasurer._id,
        notes: 'Certified audited accounts to be submitted within 14 days of AGM',
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(upcomingTaskRes.statusCode === 201, 'Form V compliance task created');
    const upcomingTaskId = upcomingTaskRes.body.data.task._id;

    // --- 2. Overdue Classification & Dashboard Aggregation ---
    console.log('\n--- 2. Overdue Classification & Dashboard Aggregation ---');
    const dashboardRes = await request(server, '/api/compliance/dashboard', 'GET', null, {
      Authorization: `Bearer ${treasurerToken}`,
    });
    assert(dashboardRes.statusCode === 200, 'Dashboard metrics returned HTTP 200');
    assert(dashboardRes.body.data.disclaimer.includes('administrative and governance'), 'Contains legal disclaimer banner');
    assert(dashboardRes.body.data.summary.totalTasks === 2, 'Total tracked tasks equals 2');
    assert(dashboardRes.body.data.summary.overdueCount === 1, 'Auto-classified 1 task as overdue');
    assert(dashboardRes.body.data.summary.upcomingCount === 1, 'Auto-classified 1 task as upcoming within 30 days');

    // Filter query: overdue=true
    const overdueFilterRes = await request(server, '/api/compliance?overdue=true', 'GET', null, {
      Authorization: `Bearer ${treasurerToken}`,
    });
    assert(overdueFilterRes.body.data.tasks.length === 1, 'Filter overdue=true correctly returns 1 task');
    assert(overdueFilterRes.body.data.tasks[0]._id === overdueTaskId, 'Matched overdue task ID');

    // --- 3. Draft vs. Filed Rule (Saving draft does NOT mark as filed) ---
    console.log('\n--- 3. Draft vs. Filed Rule ---');
    const draftUpdateRes = await request(
      server,
      `/api/compliance/${overdueTaskId}`,
      'PUT',
      {
        notes: 'Challan 281 generated in bank portal; challan receipt under compilation.',
        preparationStatus: 'IN_PREPARATION',
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(draftUpdateRes.statusCode === 200, 'Draft update successfully saved');
    assert(draftUpdateRes.body.data.task.status === 'PENDING', 'Task status strictly remains PENDING (draft saving does not mark as FILED)');

    // --- 4. Formal Filing Recording with Validation Proof ---
    console.log('\n--- 4. Formal Filing Recording ---');
    // Reject filing without acknowledgement reference
    const invalidFilingRes = await request(
      server,
      `/api/compliance/${overdueTaskId}/record-filing`,
      'POST',
      { submissionDate: new Date().toISOString(), acknowledgementReference: '' },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(invalidFilingRes.statusCode === 400, 'Filing without acknowledgement reference is rejected with 400');

    // Reject future submission date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureFilingRes = await request(
      server,
      `/api/compliance/${overdueTaskId}/record-filing`,
      'POST',
      {
        submissionDate: futureDate.toISOString(),
        acknowledgementReference: 'ACK-TRACES-9921',
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(futureFilingRes.statusCode === 400, 'Future submission date is strictly rejected with 400');

    // Legitimate filing submission
    const legitimateFilingRes = await request(
      server,
      `/api/compliance/${overdueTaskId}/record-filing`,
      'POST',
      {
        submissionDate: new Date().toISOString(),
        acknowledgementReference: 'TRACES-26Q-Q1-2026-98124',
        challanReference: 'BSR-0210048-CHALLAN-8891',
        challanAmount: 18500, // ₹ 18,500
        challanDate: new Date().toISOString(),
        notes: 'TDS deposited through HDFC net banking and acknowledged by TRACES',
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(legitimateFilingRes.statusCode === 200, 'Legitimate filing recorded with HTTP 200');
    assert(legitimateFilingRes.body.data.task.status === 'FILED', 'Task status transitioned to FILED');
    assert(legitimateFilingRes.body.data.task.challanAmountPaise === 1850000, 'Challan amount stored in integer paise');
    assert(legitimateFilingRes.body.data.task.documentationStatus === 'COMPLETE', 'Documentation marked COMPLETE');
    assert(legitimateFilingRes.body.data.task.statusHistory.length >= 2, 'Audit status history timeline recorded');

    // --- 5. Lifecycle Revision: Correction Required -> Revised Filing ---
    console.log('\n--- 5. Revision & Correction Lifecycle ---');
    // Auditor requests correction on task
    const markCorrectionRes = await request(
      server,
      `/api/compliance/${overdueTaskId}/status`,
      'POST',
      {
        action: 'MARK_CORRECTION_REQUIRED',
        comments: 'TRACES intimation notice u/s 200A: PAN mismatch for lift AMC vendor in Annexure B.',
      },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(markCorrectionRes.statusCode === 200, 'Transitioned to CORRECTION_REQUIRED');
    assert(markCorrectionRes.body.data.task.status === 'CORRECTION_REQUIRED', 'Status is CORRECTION_REQUIRED');

    // Treasurer files correction return -> REVISED_FILED
    const revisedFilingRes = await request(
      server,
      `/api/compliance/${overdueTaskId}/record-filing`,
      'POST',
      {
        submissionDate: new Date().toISOString(),
        acknowledgementReference: 'TRACES-26Q-REV-2026-1049',
        notes: 'Correction statement filed with updated vendor PAN verified from Form 16A',
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(revisedFilingRes.statusCode === 200, 'Revised filing accepted');
    assert(revisedFilingRes.body.data.task.status === 'REVISED_FILED', 'Status transitioned to REVISED_FILED');

    // --- 6. Supporting Document Attachment ---
    console.log('\n--- 6. Supporting Document Attachment ---');
    const attachDocRes = await request(
      server,
      `/api/compliance/${overdueTaskId}/documents`,
      'POST',
      {
        title: 'TRACES 26Q Revised Filing Provisional Receipt',
        documentType: 'ACKNOWLEDGEMENT',
        fileName: 'TRACES_Form26Q_Q1_Provisional_Receipt.pdf',
        fileUrl: 'https://docs.society.internal/tax/2026/form26q_rev_ack.pdf',
        fileSize: 245000,
      },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(attachDocRes.statusCode === 201, 'Document attachment saved successfully (HTTP 201)');
    assert(attachDocRes.body.data.documents.length === 1, 'Supporting document present in array');

    // --- 7. Role-Based Access Control Restrictions ---
    console.log('\n--- 7. Role-Based Access Control Restrictions ---');
    // Resident cannot create compliance task
    const residentCreateRes = await request(
      server,
      '/api/compliance',
      'POST',
      {
        filingType: 'Illegal Resident Task',
        statutoryBody: 'Tax Dept',
        financialPeriod: 'FY 26-27',
        deadline: new Date().toISOString(),
      },
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(residentCreateRes.statusCode === 403, 'Resident strictly blocked from creating compliance tasks (403)');

    // Resident cannot record a filing
    const residentFilingRes = await request(
      server,
      `/api/compliance/${upcomingTaskId}/record-filing`,
      'POST',
      { submissionDate: new Date().toISOString(), acknowledgementReference: 'HACK' },
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(residentFilingRes.statusCode === 403, 'Resident strictly blocked from recording compliance filings (403)');

    // --- 8. Society-Level Data Isolation ---
    console.log('\n--- 8. Society-Level Data Isolation ---');
    const crossSocRes = await request(
      server,
      `/api/compliance/${overdueTaskId}`,
      'GET',
      null,
      { Authorization: `Bearer ${socBToken}` }
    );
    assert(crossSocRes.statusCode === 404, 'User in Society B cannot view Society A compliance task (Returns 404)');

    // --- 9. Export Summary ---
    console.log('\n--- 9. Export Summary Report ---');
    const exportRes = await request(server, '/api/compliance/export/summary', 'GET', null, {
      Authorization: `Bearer ${auditorToken}`,
    });
    assert(exportRes.statusCode === 200, 'Compliance export statement generated');
    assert(Array.isArray(exportRes.body.data.complianceRecords), 'Records array returned');
    assert(exportRes.body.data.totalTrackedTasks === 2, 'Exported all society compliance records');

    console.log('\n======================================================');
    console.log(`   Compliance Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    if (societyA) {
      await Compliance.deleteMany({ society: societyA._id });
      await User.deleteMany({ society: societyA._id });
      await Society.collection.deleteOne({ _id: societyA._id });
    }
    if (societyB) {
      await Compliance.deleteMany({ society: societyB._id });
      await User.deleteMany({ society: societyB._id });
      await Society.collection.deleteOne({ _id: societyB._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runComplianceTests().catch((err) => {
  console.error('\n❌ Compliance Test Suite Failure:', err);
  process.exit(1);
});
