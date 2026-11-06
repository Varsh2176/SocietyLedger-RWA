/**
 * Secure Document Management Test Suite
 * Covers upload validation, private storage, role-based disclosure,
 * resident protection from private files, society isolation, and verification.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Document, AuditLog } from '../src/models/index.js';

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

async function runDocumentsTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Secure Document Management Tests');
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
      name: `Docs RWA A ${suffix}`,
      code: `DOC-A-${suffix}`.slice(0, 15),
      contactEmail: `doc_a_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/501',
    });

    societyB = await Society.create({
      name: `Docs RWA B ${suffix}`,
      code: `DOC-B-${suffix}`.slice(0, 15),
      contactEmail: `doc_b_${suffix}@test.org`,
      registrationNumber: 'RWA/2026/502',
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
      name: 'External Member',
      email: `member_b_${suffix}@test.org`,
      passwordHash: 'Admin@123',
      apartmentNumber: 'PH-01',
      role: 'Treasurer',
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

    // --- 1. Upload Validation (Disallowed extension & size) ---
    console.log('--- 1. Upload Validation ---');
    const badExtRes = await request(
      server,
      '/api/documents',
      'POST',
      {
        name: 'Malicious Executable Script',
        category: 'OTHER',
        fileName: 'exploit.exe',
        fileDataBase64: Buffer.from('malicious payload').toString('base64'),
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(badExtRes.statusCode === 400, 'Upload rejected with 400 for disallowed file extension (.exe)');
    assert(badExtRes.body.errors.some((e) => e.includes('Disallowed file extension')), 'Specific extension error returned');

    // --- 2. Legitimate Private Document Upload ---
    console.log('\n--- 2. Legitimate Private Document Upload ---');
    const invoiceContent = Buffer.from('Johnson Lifts AMC Invoice Tax Receipt INR 18,500. GSTIN: 29AABCU9912Q1ZX').toString('base64');
    const uploadRes = await request(
      server,
      '/api/documents',
      'POST',
      {
        name: 'Johnson Lifts Q3 Comprehensive AMC Invoice',
        category: 'INVOICE_RECEIPT',
        fileName: 'Invoice_JL_Q3_2026.pdf',
        mimeType: 'application/pdf',
        fileDataBase64: invoiceContent,
        description: 'Original signed tax invoice verified against bank RTGS debit',
        isPublishedToResidents: false, // Strictly confidential to committee/auditors
      },
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(uploadRes.statusCode === 201, 'Private document successfully stored (HTTP 201)');
    assert(uploadRes.body.data.document.verificationStatus === 'PENDING', 'Initial verification status is PENDING');
    const docId = uploadRes.body.data.document._id;

    // --- 3. Privacy & Access Control Enforcement (Resident Protected) ---
    console.log('\n--- 3. Resident Privacy & Confidentiality Enforcement ---');
    // Resident listing documents should NOT see the private invoice
    const residentListRes = await request(server, '/api/documents', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(residentListRes.statusCode === 200, 'Resident can query documents');
    assert(residentListRes.body.data.documents.length === 0, 'Unpublished confidential document is completely hidden from Resident list');

    // Resident attempting direct download of private document by ID MUST BE REJECTED!
    const residentDownloadRes = await request(
      server,
      `/api/documents/${docId}/download`,
      'GET',
      null,
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(residentDownloadRes.statusCode === 403, 'Resident strictly blocked with 403 from downloading private confidential file');

    // Committee / Auditor download MUST SUCCEED
    const auditorDownloadRes = await request(
      server,
      `/api/documents/${docId}/download`,
      'GET',
      null,
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(auditorDownloadRes.statusCode === 200, 'Auditor successfully downloaded file');
    assert(auditorDownloadRes.body.includes('Johnson Lifts AMC Invoice'), 'File content verified through secure stream');

    // --- 4. Society-Level Data Isolation ---
    console.log('\n--- 4. Society-Level Data Isolation ---');
    const crossSocDownload = await request(
      server,
      `/api/documents/${docId}/download`,
      'GET',
      null,
      { Authorization: `Bearer ${socBToken}` }
    );
    assert(crossSocDownload.statusCode === 404, 'User in Society B cannot download Society A document (404)');

    // --- 5. Document Verification Workflow ---
    console.log('\n--- 5. Document Verification Workflow ---');
    const verifyRes = await request(
      server,
      `/api/documents/${docId}/verify`,
      'POST',
      { status: 'VERIFIED', notes: 'Checked GSTIN and matched with bank debit voucher VR-2026-089' },
      { Authorization: `Bearer ${auditorToken}` }
    );
    assert(verifyRes.statusCode === 200, 'Auditor marked document as VERIFIED');
    assert(verifyRes.body.data.document.verificationStatus === 'VERIFIED', 'Status transitioned to VERIFIED');

    // --- 6. Document Deletion Restrictions ---
    console.log('\n--- 6. Deletion Permissions ---');
    // Unauthorized resident cannot delete
    const badDeleteRes = await request(
      server,
      `/api/documents/${docId}`,
      'DELETE',
      null,
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(badDeleteRes.statusCode === 403, 'Unauthorized user blocked from deleting document');

    // Uploader deletes document
    const legitimateDeleteRes = await request(
      server,
      `/api/documents/${docId}`,
      'DELETE',
      null,
      { Authorization: `Bearer ${treasurerToken}` }
    );
    assert(legitimateDeleteRes.statusCode === 200, 'Original uploader successfully deleted document');

    console.log('\n======================================================');
    console.log(`   Document Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    if (societyA) {
      await Document.deleteMany({ society: societyA._id });
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

runDocumentsTests().catch((err) => {
  console.error('\n❌ Document Management Test Suite Failure:', err);
  process.exit(1);
});
