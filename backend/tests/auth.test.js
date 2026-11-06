/**
 * Authentication, Session & RBAC Integration Test Suite
 * Covers registration, login, logout, password hashing, session restoration,
 * role restrictions, privilege escalation prevention, and society data isolation.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User } from '../src/models/index.js';

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

async function runAuthTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Authentication & RBAC Test Suite');
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
    // Setup test societies
    societyA = await Society.create({
      name: `Apartment A ${suffix}`,
      code: `SOCA-${suffix}`.slice(0, 15),
      contactEmail: `admin_a_${suffix}@test.org`,
    });

    societyB = await Society.create({
      name: `Apartment B ${suffix}`,
      code: `SOCB-${suffix}`.slice(0, 15),
      contactEmail: `admin_b_${suffix}@test.org`,
      registrationNumber: `REG-B-${suffix}`,
    });

    // --- 1. Registration & Privilege Escalation Prevention ---
    console.log('--- 1. Registration & Privilege Escalation Defense ---');

    const residentProfile = {
      phone: '9876543210',
      apartmentNumber: 'A-402',
    };

    // 1a: Each missing field has its own message
    const missingRes = await request(server, '/api/auth/register', 'POST', {});
    assert(missingRes.statusCode === 400, 'Register with an empty body returns 400');
    const missingFields = new Map((missingRes.body.errors || []).map((item) => [item.field, item.message]));
    assert(missingFields.get('name') === 'Full name is required.', 'Missing name has a field-specific message');
    assert(missingFields.get('email') === 'Email address is required.', 'Missing email has a field-specific message');
    assert(missingFields.get('password') === 'Password is required.', 'Missing password has a field-specific message');
    assert(missingFields.get('phone') === 'Phone number is required.', 'Missing phone number has a field-specific message');
    assert(
      missingFields.get('apartmentNumber') === 'Apartment/flat number is required.',
      'Missing apartment number has a field-specific message'
    );
    assert(
      missingFields.get('societyCode') === 'Society invitation code is required.',
      'Missing invitation code has a field-specific message'
    );

    const invalidEmailRes = await request(server, '/api/auth/register', 'POST', {
      name: 'Ramesh Kumar',
      email: 'not-an-email',
      password: 'Password@123',
      ...residentProfile,
      societyCode: societyA.code,
    });
    assert(invalidEmailRes.statusCode === 400, 'Register with an invalid email returns 400');
    assert(
      invalidEmailRes.body.errors.some((item) => item.field === 'email' && item.message.includes('valid email')),
      'Invalid email names the email field'
    );

    // 1b: Invalid society code
    const badCodeRes = await request(server, '/api/auth/register', 'POST', {
      name: 'Ramesh Kumar',
      email: `ramesh_${suffix}@test.org`,
      password: 'Password@123',
      ...residentProfile,
      societyCode: 'NON_EXISTENT_CODE',
    });
    assert(badCodeRes.statusCode === 404, 'Register with non-existent society code returns 404');
    assert(
      badCodeRes.body.message.includes('Invalid society invitation code'),
      'Invalid invitation code returns a clear error'
    );
    assert(
      badCodeRes.body.errors.some((item) => item.field === 'societyCode'),
      'Invalid invitation code is attached to the invitation field'
    );

    // 1c: Short password rejection
    const shortPassRes = await request(server, '/api/auth/register', 'POST', {
      name: 'Ramesh Kumar',
      email: `ramesh_${suffix}@test.org`,
      password: '123',
      ...residentProfile,
      societyCode: societyA.code,
    });
    assert(shortPassRes.statusCode === 400, 'Register with short password returns 400');
    assert(
      shortPassRes.body.errors.some((item) => item.field === 'password'),
      'Short password names the password field'
    );

    // 1d: Attempt to self-grant 'Society Administrator' role (privilege escalation defense)
    const privEscRes = await request(server, '/api/auth/register', 'POST', {
      name: 'Hacker User',
      email: `hacker_${suffix}@test.org`,
      password: 'Password@123',
      ...residentProfile,
      societyCode: societyA.code,
      role: 'Society Administrator', // Attack: user attempts to grant themselves admin
      societyId: String(societyB._id),
    });
    assert(privEscRes.statusCode === 201, 'Registration succeeded');
    assert(privEscRes.body.data.user.role === 'Resident', 'Privilege Escalation Blocked: Role strictly forced to Resident');
    assert(privEscRes.body.data.user.society.name === societyA.name, 'Invitation code selects the society, not a client-supplied society id');
    assert(privEscRes.body.data.user.passwordHash === undefined, 'Password hash is not leaked in registration response');
    assert(privEscRes.body.data.user.verificationStatus === 'PENDING', 'Registration leaves resident verification pending');
    assert(
      privEscRes.body.message === 'Registration successful. You are signed in, and resident verification is still pending.',
      'Registration reports the signed-in session and the pending verification'
    );
    assert(privEscRes.body.data.accessToken, 'Registration returns an access token for the new session');

    for (const elevatedRole of ['Treasurer', 'Auditor', 'Committee Member']) {
      const elevatedRes = await request(server, '/api/auth/register', 'POST', {
        name: `${elevatedRole} Applicant`,
        email: `${elevatedRole.replace(/\s/g, '').toLowerCase()}_${suffix}@test.org`,
        password: 'Password@123',
        ...residentProfile,
        societyCode: societyA.code,
        role: elevatedRole,
      });
      assert(elevatedRes.statusCode === 201, `Registration with requested ${elevatedRole} role still succeeds as a resident`);
      assert(elevatedRes.body.data.user.role === 'Resident', `${elevatedRole} is not granted during registration`);
    }

    // Check cookie was set
    const setCookie = privEscRes.headers['set-cookie'];
    assert(setCookie && setCookie.some((c) => c.includes('jwt_token=')), 'HttpOnly jwt_token cookie set on registration');
    assert(setCookie.some((cookie) => /httponly/i.test(cookie)), 'Registration session cookie is HttpOnly');
    assert(setCookie.some((cookie) => /samesite=lax/i.test(cookie)), 'Registration session cookie is SameSite=Lax');

    // 1d: Duplicate email rejection
    const dupRes = await request(server, '/api/auth/register', 'POST', {
      name: 'Duplicate Hacker',
      email: `hacker_${suffix}@test.org`,
      password: 'Password@123',
      ...residentProfile,
      societyCode: societyA.code,
    });
    assert(dupRes.statusCode === 409, 'Duplicate registration returns 409 Conflict');

    // --- 2. Login & Password Verification ---
    console.log('\n--- 2. Login & Credential Verification ---');

    // 2a: Invalid password
    const badLoginRes = await request(server, '/api/auth/login', 'POST', {
      email: `hacker_${suffix}@test.org`,
      password: 'WrongPassword!',
    });
    assert(badLoginRes.statusCode === 401, 'Invalid password returns 401 Unauthorized');
    assert(badLoginRes.body.message.includes('Invalid email or password'), 'Safe generic authentication error returned');

    // 2b: Non-existent email
    const nonExistRes = await request(server, '/api/auth/login', 'POST', {
      email: `unknown_${suffix}@test.org`,
      password: 'Password@123',
    });
    assert(nonExistRes.statusCode === 401, 'Unknown email returns 401 Unauthorized');

    // 2c: Successful login
    const loginRes = await request(server, '/api/auth/login', 'POST', {
      email: `hacker_${suffix}@test.org`,
      password: 'Password@123',
    });
    assert(loginRes.statusCode === 200, 'Valid credentials returns 200 OK');
    assert(loginRes.body.success === true, 'Success envelope true');
    assert(loginRes.body.data.user.email === `hacker_${suffix}@test.org`, 'User profile returned');
    assert(typeof loginRes.body.data.accessToken === 'string', 'In-memory accessToken provided alongside cookie');
    assert(
      loginRes.body.data.user.society.name === societyA.name,
      'Login returns the authenticated user society name'
    );
    assert(
      loginRes.body.data.user.society.registrationNumber == null,
      'Missing society registration is left empty'
    );
    assert(
      !JSON.stringify(loginRes.body.data.user).includes(societyB.name),
      'Login profile does not include another society name'
    );

    const residentToken = loginRes.body.data.accessToken;
    const cookieHeader = loginRes.headers['set-cookie'];

    // --- 3. Session Restoration & Logout ---
    console.log('\n--- 3. Session Restoration & Logout ---');

    // 3a: Session restoration via Bearer token
    const meBearerRes = await request(server, '/api/auth/me', 'GET', null, {
      Authorization: `Bearer ${residentToken}`,
    });
    assert(meBearerRes.statusCode === 200, 'GET /api/auth/me restored session via Bearer header');

    // 3b: Session restoration via Cookie
    const cookieStr = cookieHeader[0].split(';')[0];
    const meCookieRes = await request(server, '/api/auth/me', 'GET', null, {
      Cookie: cookieStr,
    });
    assert(meCookieRes.statusCode === 200, 'GET /api/auth/me restored session via HttpOnly cookie');

    // 3c: Logout clears cookie
    const logoutRes = await request(server, '/api/auth/logout', 'POST');
    assert(logoutRes.statusCode === 200, 'Logout returns 200 OK');
    const clearedCookie = logoutRes.headers['set-cookie'];
    assert(clearedCookie && clearedCookie.some((c) => c.includes('jwt_token=;')), 'Logout clears jwt_token cookie');

    // --- 4. Role-Based Access Control (RBAC) ---
    console.log('\n--- 4. Role-Based Access Control Restrictions ---');

    // Create an Administrator and Treasurer in Society A
    const adminUser = await User.create({
      name: 'Admin A',
      email: `admin_${suffix}@test.org`,
      passwordHash: 'Admin@123',
      role: 'Society Administrator',
      society: societyA._id,
      verificationStatus: 'VERIFIED',
    });

    const adminLoginRes = await request(server, '/api/auth/login', 'POST', {
      email: `admin_${suffix}@test.org`,
      password: 'Admin@123',
    });
    const adminToken = adminLoginRes.body.data.accessToken;

    // 4a: Resident attempts to create a Fund (Restricted to Admin / Treasurer)
    const residentCreateFundRes = await request(
      server,
      '/api/funds',
      'POST',
      {
        name: 'Unauthorized Fund',
        code: `UNAUTH-${suffix}`.slice(0, 15),
        type: 'CORPUS',
        openingBalance: 100000,
      },
      { Authorization: `Bearer ${residentToken}` }
    );
    assert(residentCreateFundRes.statusCode === 403, 'Resident role is rejected with 403 from creating a fund');
    assert(residentCreateFundRes.body.message.includes('Access denied'), 'RBAC error message specifies permission denied');

    // 4b: Admin can create fund successfully
    const adminCreateFundRes = await request(
      server,
      '/api/funds',
      'POST',
      {
        name: 'Authorized Corpus Fund',
        code: `AUTH-${suffix}`.slice(0, 15),
        type: 'CORPUS',
        openingBalance: 500000,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(adminCreateFundRes.statusCode === 201, 'Society Administrator can successfully create a fund');

    // --- 5. Society-Level Data Isolation ---
    console.log('\n--- 5. Society-Level Data Isolation ---');

    // Create User in Society B
    const userInSocietyB = await User.create({
      name: 'Resident B',
      email: `resident_b_${suffix}@test.org`,
      passwordHash: 'Password@123',
      role: 'Resident',
      society: societyB._id,
      verificationStatus: 'VERIFIED',
    });

    const loginSocietyBRes = await request(server, '/api/auth/login', 'POST', {
      email: `resident_b_${suffix}@test.org`,
      password: 'Password@123',
    });
    const tokenB = loginSocietyBRes.body.data.accessToken;
    assert(
      loginSocietyBRes.body.data.user.society.name === societyB.name,
      'User in Society B receives Society B name'
    );
    assert(
      loginSocietyBRes.body.data.user.society.registrationNumber === societyB.registrationNumber,
      'User in Society B receives Society B registration number'
    );
    assert(
      !JSON.stringify(loginSocietyBRes.body.data.user).includes(societyA.name),
      'Society B profile does not include Society A name'
    );

    const spoofedLogin = await request(server, '/api/auth/login', 'POST', {
      email: `resident_b_${suffix}@test.org`,
      password: 'Password@123',
      societyId: String(societyA._id),
    });
    assert(
      spoofedLogin.body.data.user.society.name === societyB.name,
      'Login ignores a client-supplied society id'
    );

    const spoofedMe = await request(
      server,
      `/api/auth/me?societyId=${societyA._id}`,
      'GET',
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    assert(
      spoofedMe.body.data.user.society.registrationNumber === societyB.registrationNumber,
      'Session profile ignores a client-supplied society id'
    );

    // User in Society B queries funds
    const fundsForBRes = await request(server, '/api/funds', 'GET', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert(fundsForBRes.statusCode === 200, 'User B can query funds');
    const fundList = fundsForBRes.body.data.funds;
    // Society B has no funds created yet; should NOT see Society A's fund!
    const seesSocietyAFund = fundList.some((f) => f.code === `AUTH-${suffix}`.slice(0, 15));
    assert(!seesSocietyAFund, 'Society Isolation: User in Society B cannot view Society A funds');

    // User in Society B attempts to access Society A explicitly
    const crossSocietyRes = await request(
      server,
      `/api/funds?societyId=${societyA._id}`,
      'GET',
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    assert(crossSocietyRes.statusCode === 403, 'Cross-society IDOR query rejected with 403 Forbidden');

    console.log('\n======================================================');
    console.log(`   Auth & RBAC Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    // Cleanup
    if (societyA) await Society.deleteOne({ _id: societyA._id });
    if (societyB) await Society.deleteOne({ _id: societyB._id });
    await User.deleteMany({ email: { $regex: `${suffix}@test.org` } });
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runAuthTests().catch((err) => {
  console.error('\n❌ Authentication Test Suite Failure:', err);
  process.exit(1);
});
