/**
 * Audit Trail & Formal Observations Test Suite
 * Tests immutable append-only enforcement, role restrictions,
 * observation recording, corrective action tracking, and sensitive-data redaction.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, AuditLog, Observation } from '../src/models/index.js';

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

async function runAuditTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Audit Trail & Governance Tests');
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
      name: `Audit RWA A ${suffix}`,
      code: `AUD-A-${suffix}`.slice(0, 15),
      contactEmail: `aud_a_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/401',
    });

    societyB = await Society.create({
      name: `Audit RWA B ${suffix}`,
      code: `AUD-B-${suffix}`.slice(0, 15),
      contactEmail: `aud_b_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/402',
    });

    const auditor = await User.create({
      society: societyA._id,
      name: 'Suresh Menon, CA',
      email: `auditor_${suffix}@test.org`,
      passwordHash: 'Auditor@123',
      apartmentNumber: 'C-201',
      role: 'Auditor',
    });

    const admin = await User.create({
      society: societyA._id,
      name: 'Dr. Anand Rao',
      email: `admin_${suffix}@test.org`,
      passwordHash: 'Admin@123',
      apartmentNumber: 'PH-01',
      role: 'Society Administrator',
    });

    const resident = await User.create({
      society: societyA._id,
      name: 'Rohan Resident',
      email: `resident_${suffix}@test.org`,
      passwordHash: 'Resident@123',
      apartmentNumber: 'B-104',
      role: 'Resident',
    });

    const treasurer = await User.create({
      society: societyA._id,
      name: 'Priya Treasurer',
      email: `treasurer_${suffix}@test.org`,
      passwordHash: 'Treasurer@123',
      apartmentNumber: 'A-101',
      role: 'Treasurer',
    });

    const committee = await User.create({
      society: societyA._id,
      name: 'Committee Member',
      email: `committee_${suffix}@test.org`,
      passwordHash: 'Committee@123',
      apartmentNumber: 'A-102',
      role: 'Committee Member',
    });

    const socBUser = await User.create({
      society: societyB._id,
      name: 'External Auditor',
      email: `ext_aud_${suffix}@test.org`,
      passwordHash: 'Auditor@123',
      apartmentNumber: 'D-101',
      role: 'Auditor',
    });

    // Seed test audit log entries
    const log1 = await AuditLog.create({
      society: societyA._id,
      actor: admin._id,
      action: 'APPROVE_EXPENSE',
      entityType: 'APPROVAL',
      entityRef: 'VR-2026-089',
      details: 'Approved AMC maintenance voucher of ₹18,500',
      severity: 'INFO',
    });

    const log2 = await AuditLog.create({
      society: societyA._id,
      actor: auditor._id,
      action: 'RECORD_AUDIT_OBSERVATION',
      entityType: 'OBSERVATION',
      entityRef: 'Lift AMC Quotation Missing',
      details: 'Elevator capacitor repair was sanctioned without 3 comparative vendor bids',
      severity: 'HIGH',
    });

    // Obtain JWT tokens
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

    const adminLogin = await request(server, '/api/auth/login', 'POST', {
      email: admin.email,
      password: 'Admin@123',
    });
    const adminToken = adminLogin.body.data.accessToken;

    const treasurerLogin = await request(server, '/api/auth/login', 'POST', {
      email: treasurer.email,
      password: 'Treasurer@123',
    });
    const treasurerToken = treasurerLogin.body.data.accessToken;

    const committeeLogin = await request(server, '/api/auth/login', 'POST', {
      email: committee.email,
      password: 'Committee@123',
    });
    const committeeToken = committeeLogin.body.data.accessToken;

    const socBLogin = await request(server, '/api/auth/login', 'POST', {
      email: socBUser.email,
      password: 'Auditor@123',
    });
    const socBToken = socBLogin.body.data.accessToken;

    // --- 1. Audit Log Query & Scoping ---
    console.log('--- 1. Audit Log Query & Scoping ---');
    const logsRes = await request(server, '/api/audit/logs', 'GET', null, {
      Authorization: `Bearer ${auditorToken}`,
    });
    assert(logsRes.statusCode === 200, 'Auditor successfully retrieved audit trail');
    assert(logsRes.body.data.disclaimer.includes('Application-level append-only'), 'Returns required append-only legal disclosure');
    assert(logsRes.body.data.total >= 2, 'Retrieved society audit logs');
    assert(logsRes.body.data.logs.some((l) => l.action === 'APPROVE_EXPENSE'), 'Action matched');

    // Filter by severity: HIGH
    const highSevRes = await request(server, '/api/audit/logs?severity=HIGH', 'GET', null, {
      Authorization: `Bearer ${auditorToken}`,
    });
    assert(highSevRes.body.data.logs.length === 1, 'Filter by severity=HIGH returned 1 log');
    assert(highSevRes.body.data.logs[0].action === 'RECORD_AUDIT_OBSERVATION', 'Matched high severity observation log');

    // --- 2. Append-Only Immutability Enforcement ---
    console.log('\n--- 2. Append-Only Immutability Enforcement ---');
    let mutationBlocked = false;
    try {
      log1.details = 'Tampered log content';
      await log1.save();
    } catch (err) {
      if (err.message.includes('immutable and cannot be modified')) {
        mutationBlocked = true;
      }
    }
    assert(mutationBlocked, 'AuditLog pre-save hook strictly blocks modification of existing logs');

    let deleteBlocked = false;
    try {
      await AuditLog.deleteOne({ _id: log1._id });
    } catch (err) {
      if (err.message.includes('cannot be deleted')) {
        deleteBlocked = true;
      }
    }
    assert(deleteBlocked, 'AuditLog pre-deleteOne hook strictly blocks deletion of audit records');

    // --- 3. Sensitive Data Redaction Test ---
    console.log('\n--- 3. Sensitive Data Redaction ---');
    // Ensure passwords or bearer tokens are NEVER logged in details
    const allLogs = logsRes.body.data.logs;
    const hasPassword = allLogs.some((l) => l.details && (l.details.includes('Auditor@123') || l.details.includes('passwordHash')));
    assert(!hasPassword, 'Privacy rule: Plaintext passwords/hashes are never exposed in audit logs');

    // --- 4. Role Restrictions (Ordinary Resident Blocked) ---
    console.log('\n--- 4. Role Restrictions ---');
    const residentAuditRes = await request(server, '/api/audit/logs', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentAuditRes.statusCode === 403, 'Resident strictly blocked from viewing internal audit trail (403)');

    const adminLogs = await request(server, '/api/audit/logs', 'GET', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminLogs.statusCode === 200, 'Society Administrator can read audit logs');
    const treasurerLogs = await request(server, '/api/audit/logs', 'GET', null, {
      Authorization: `Bearer ${treasurerToken}`,
    });
    assert(treasurerLogs.statusCode === 403, 'Treasurer cannot read audit logs');
    const committeeLogs = await request(server, '/api/audit/logs', 'GET', null, {
      Authorization: `Bearer ${committeeToken}`,
    });
    assert(committeeLogs.statusCode === 403, 'Committee Member cannot read audit logs');
    const mismatchedLogs = await request(server, `/api/audit/logs?societyId=${societyB._id}`, 'GET', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(mismatchedLogs.statusCode === 403, 'Audit logs reject another society id');

    // --- 5. Formal Audit Observations CRUD ---
    console.log('\n--- 5. Formal Audit Observations CRUD ---');
    const createObsRes = await request(
      server,
      '/api/audit/observations',
      'POST',
      {
        title: 'Generator Diesel Consumption Log Discrepancy',
        category: 'INTERNAL_CONTROL',
        severity: 'HIGH',
        finding: '400 liters of diesel purchased in September without corresponding generator run-hour log entries.',
        riskDescription: 'Potential fuel pilferage or unrecorded run hours during power outage.',
        recommendation: 'Implement dual-signature digital diesel logbook at the security gate.',
        relatedEntityRef: 'DG-SET-01',
      },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(createObsRes.statusCode === 201, 'Audit observation created by Auditor (HTTP 201)');
    assert(createObsRes.body.data.observation.status === 'OPEN', 'Initial observation status is OPEN');
    const obsId = createObsRes.body.data.observation._id;

    const treasurerUpdate = await request(
      server,
      `/api/audit/observations/${obsId}`,
      'PUT',
      { status: 'RESOLVED', correctiveAction: 'Treasurer attempt' },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(treasurerUpdate.statusCode === 403, 'Treasurer cannot update an audit observation');
    const committeeUpdate = await request(
      server,
      `/api/audit/observations/${obsId}`,
      'PUT',
      { status: 'RESOLVED' },
      { Authorization: `Bearer ${committeeToken}` }
    );
    assert(committeeUpdate.statusCode === 403, 'Committee Member cannot update an audit observation');
    const residentUpdate = await request(
      server,
      `/api/audit/observations/${obsId}`,
      'PUT',
      { status: 'RESOLVED' },
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(residentUpdate.statusCode === 403, 'Resident cannot update an audit observation');
    const otherSocietyUpdate = await request(
      server,
      `/api/audit/observations/${obsId}`,
      'PUT',
      { status: 'RESOLVED' },
      { Authorization: `Bearer ${socBToken}` }
    );
    assert(otherSocietyUpdate.statusCode === 404, 'Another society cannot update the observation');
    const adminUpdate = await request(
      server,
      `/api/audit/observations/${obsId}`,
      'PUT',
      { correctiveAction: 'Administrator recorded the management response.' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(adminUpdate.statusCode === 200, 'Society Administrator can update an audit observation');

    // Update with corrective action & resolve
    const updateObsRes = await request(
      server,
      `/api/audit/observations/${obsId}`,
      'PUT',
      {
        managementResponse: 'Management committee reviewed gate log and confirmed 48 hours of power cuts in storm.',
        correctiveAction: 'Digital flow meter installed on generator fuel line with weekly cross-checks.',
        status: 'RESOLVED',
      },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(updateObsRes.statusCode === 200, 'Observation updated with corrective action');
    assert(updateObsRes.body.data.observation.status === 'RESOLVED', 'Observation status transitioned to RESOLVED');

    // --- 6. Society-Level Data Isolation ---
    console.log('\n--- 6. Society-Level Data Isolation ---');
    const crossSocLogs = await request(server, '/api/audit/logs', 'GET', null, {
      Authorization: `Bearer ${socBToken}`,
    });
    assert(
      !crossSocLogs.body.data.logs.some((l) => l.action === 'APPROVE_EXPENSE' || l.action === 'RECORD_AUDIT_OBSERVATION'),
      'User in Society B cannot see Society A audit logs (isolated)'
    );

    console.log('\n======================================================');
    console.log(`   Audit Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    if (societyA) {
      await Observation.deleteMany({ society: societyA._id });
      await AuditLog.collection.deleteMany({ society: societyA._id });
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

runAuditTests().catch((err) => {
  console.error('\n❌ Audit Test Suite Failure:', err);
  process.exit(1);
});
