/**
 * Society Administrator management.
 * Uses disposable local societies and does not touch Greenwood Heights records.
 */

import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Society, User, Fund, AuditLog } from '../src/models/index.js';

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

function request(server, path, method = 'GET', body = null, token = null) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => { resBody += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = resBody ? JSON.parse(resBody) : null; } catch { json = resBody; }
          resolve({ statusCode: res.statusCode, body: json, raw: resBody });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function auth(token) {
  return token;
}

const registerBody = (email, societyCode, role = 'Treasurer') => ({
  name: 'Invited Resident',
  email,
  password: 'Password@123',
  phone: '9876543210',
  apartmentNumber: 'B-204',
  societyCode,
  role,
  societyId: new mongoose.Types.ObjectId().toString(),
});

async function runAdminTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Administrator Management Test Suite');
  console.log('======================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  if (/mongodb\+srv:|\.mongodb\.net/i.test(mongoURI)) {
    throw new Error('Administrator tests refuse an Atlas connection.');
  }
  await mongoose.connect(mongoURI);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const suffix = Date.now();
  let societyA = null;
  let societyB = null;
  const createdUserIds = [];

  try {
    societyA = await Society.create({
      name: `Admin A ${suffix}`,
      code: `ADA-${suffix}`.slice(0, 20),
      registrationNumber: `REG-A-${suffix}`,
      contactEmail: `ada_${suffix}@test.org`,
      contactPhone: '9876500000',
    });
    societyB = await Society.create({
      name: `Admin B ${suffix}`,
      code: `ADB-${suffix}`.slice(0, 20),
      registrationNumber: `REG-B-${suffix}`,
      contactEmail: `adb_${suffix}@test.org`,
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
        email: `${key}_${suffix}@admin.test`,
        passwordHash: 'Password@123',
        phone: '9876543210',
        apartmentNumber: `A-${key.slice(0, 3).toUpperCase()}`,
        role,
        society: societyA._id,
        verificationStatus: 'VERIFIED',
      });
      createdUserIds.push(users[key]._id);
      const login = await request(server, '/api/auth/login', 'POST', {
        email: users[key].email,
        password: 'Password@123',
      });
      assert(login.statusCode === 200, `${role} can log in`);
      tokens[key] = login.body.data.accessToken;
    }

    const otherAdmin = await User.create({
      name: `Other Admin ${suffix}`,
      email: `other_${suffix}@admin.test`,
      passwordHash: 'Password@123',
      role: 'Society Administrator',
      society: societyB._id,
      verificationStatus: 'VERIFIED',
    });
    createdUserIds.push(otherAdmin._id);
    const otherLogin = await request(server, '/api/auth/login', 'POST', {
      email: otherAdmin.email,
      password: 'Password@123',
    });
    assert(otherLogin.statusCode === 200, 'Administrator of another society can log in');
    const otherToken = otherLogin.body.data.accessToken;

    const fund = await Fund.create({
      society: societyA._id,
      name: 'Admin Isolation Fund',
      code: `FND-AD-${suffix}`.slice(0, 20),
      type: 'OPERATIONAL',
      openingBalancePaise: 250000,
      currentBalancePaise: 250000,
      createdBy: users.admin._id,
    });

    console.log('\n--- Role access ---');
    for (const key of ['treasurer', 'committee', 'auditor', 'resident']) {
      const list = await request(server, '/api/admin/members', 'GET', null, auth(tokens[key]));
      assert(list.statusCode === 403, `${roleNames[key]} cannot list members`);
      const profile = await request(server, '/api/admin/society', 'GET', null, auth(tokens[key]));
      assert(profile.statusCode === 403, `${roleNames[key]} cannot read the society profile`);
      const rotate = await request(server, '/api/admin/invitation-code/rotate', 'POST', {}, auth(tokens[key]));
      assert(rotate.statusCode === 403, `${roleNames[key]} cannot rotate the invitation code`);
      const roleChange = await request(
        server,
        `/api/admin/members/${users.resident._id}/role`,
        'PATCH',
        { role: 'Society Administrator' },
        auth(tokens[key])
      );
      assert(roleChange.statusCode === 403, `${roleNames[key]} cannot change roles`);
    }
    const anonymous = await request(server, '/api/admin/members');
    assert(anonymous.statusCode === 401, 'Anonymous callers cannot open administrator routes');

    console.log('\n--- Society isolation ---');
    const ownList = await request(server, '/api/admin/members', 'GET', null, auth(tokens.admin));
    assert(ownList.statusCode === 200, 'Administrator can list members of their society');
    const ownEmails = ownList.body.data.members.map((member) => member.email);
    assert(ownEmails.includes(users.resident.email), 'The resident of this society is listed');
    assert(!ownEmails.includes(otherAdmin.email), 'A member of another society is not listed');
    assert(ownList.body.data.members.every((member) => !Object.prototype.hasOwnProperty.call(member, 'passwordHash')), 'Member list omits password hashes');
    assert(!ownList.raw.includes('passwordHash'), 'Member response text does not contain a password hash field');
    assert(!ownList.raw.includes('$2a$') && !ownList.raw.includes('$2b$'), 'Member response text does not contain a bcrypt hash');

    const residentDetail = await request(server, `/api/admin/members/${users.resident._id}`, 'GET', null, auth(tokens.admin));
    assert(residentDetail.statusCode === 200, 'Administrator can view a resident in their society');
    assert(residentDetail.body.data.member.email === users.resident.email, 'Resident detail returns the resident email');
    assert(residentDetail.body.data.member.apartmentNumber === 'A-RES', 'Resident detail returns the flat number');
    assert(!Object.prototype.hasOwnProperty.call(residentDetail.body.data.member, 'passwordHash'), 'Resident detail omits the password hash');

    const foreignDetail = await request(server, `/api/admin/members/${otherAdmin._id}`, 'GET', null, auth(tokens.admin));
    assert(foreignDetail.statusCode === 404, 'A member id from another society is not visible');
    const foreignRole = await request(
      server,
      `/api/admin/members/${otherAdmin._id}/role`,
      'PATCH',
      { role: 'Resident' },
      auth(tokens.admin)
    );
    assert(foreignRole.statusCode === 404, 'A member of another society cannot have their role changed');
    const crossQuery = await request(
      server,
      `/api/admin/members?societyId=${societyB._id}`,
      'GET',
      null,
      auth(tokens.admin)
    );
    assert(crossQuery.statusCode === 403, 'A browser-supplied society id is rejected');

    const otherList = await request(server, '/api/admin/members', 'GET', null, auth(otherToken));
    assert(otherList.statusCode === 200, 'The other administrator can list their own society');
    assert(
      otherList.body.data.members.every((member) => member.email !== users.admin.email),
      'The other society list does not include this society’s administrator'
    );

    console.log('\n--- Residents and roles ---');
    const residents = await request(server, '/api/admin/members?role=Resident', 'GET', null, auth(tokens.admin));
    assert(residents.statusCode === 200, 'Administrator can filter residents');
    assert(residents.body.data.members.every((member) => member.role === 'Resident'), 'Resident filter returns only residents');
    const badRole = await request(server, '/api/admin/members?role=Owner', 'GET', null, auth(tokens.admin));
    assert(badRole.statusCode === 400, 'An unknown role filter is rejected');

    const deactivate = await request(
      server,
      `/api/admin/members/${users.resident._id}/status`,
      'PATCH',
      { isActive: false, role: 'Society Administrator', societyId: societyA._id.toString() },
      auth(tokens.admin)
    );
    assert(deactivate.statusCode === 200, 'Administrator can deactivate a resident');
    assert(deactivate.body.data.member.isActive === false, 'Deactivated resident is inactive');
    assert(deactivate.body.data.member.role === 'Resident', 'A status update does not apply a browser-supplied role');
    const blockedSession = await request(server, '/api/auth/me', 'GET', null, auth(tokens.resident));
    assert(blockedSession.statusCode === 403, 'A deactivated resident session stops working');
    const blockedLogin = await request(server, '/api/auth/login', 'POST', {
      email: users.resident.email,
      password: 'Password@123',
    });
    assert(blockedLogin.statusCode === 403, 'A deactivated resident cannot sign in');

    const activate = await request(
      server,
      `/api/admin/members/${users.resident._id}/status`,
      'PATCH',
      { isActive: true },
      auth(tokens.admin)
    );
    assert(activate.statusCode === 200 && activate.body.data.member.isActive === true, 'Administrator can activate the resident again');

    const demoteLast = await request(
      server,
      `/api/admin/members/${users.admin._id}/role`,
      'PATCH',
      { role: 'Resident' },
      auth(tokens.admin)
    );
    assert(demoteLast.statusCode === 400, 'The last active Society Administrator cannot be demoted');
    const deactivateLast = await request(
      server,
      `/api/admin/members/${users.admin._id}/status`,
      'PATCH',
      { isActive: false },
      auth(tokens.admin)
    );
    assert(deactivateLast.statusCode === 400, 'The last active Society Administrator cannot be deactivated');
    const stillAdmin = await User.findById(users.admin._id);
    assert(stillAdmin.role === 'Society Administrator' && stillAdmin.isActive === true, 'The last administrator remains active');

    const invalidRole = await request(
      server,
      `/api/admin/members/${users.resident._id}/role`,
      'PATCH',
      { role: 'Platform Owner', passwordHash: 'not-a-hash' },
      auth(tokens.admin)
    );
    assert(invalidRole.statusCode === 400, 'A role outside the five society roles is rejected');

    const promote = await request(
      server,
      `/api/admin/members/${users.resident._id}/role`,
      'PATCH',
      { role: 'Society Administrator', societyId: societyB._id.toString() },
      auth(tokens.admin)
    );
    assert(promote.statusCode === 403, 'A role change that names another society is rejected');
    const promoteOwn = await request(
      server,
      `/api/admin/members/${users.resident._id}/role`,
      'PATCH',
      { role: 'Society Administrator' },
      auth(tokens.admin)
    );
    assert(promoteOwn.statusCode === 200, 'Administrator can assign a legitimate society role');
    assert(promoteOwn.body.data.member.role === 'Society Administrator', 'The resident is now a Society Administrator');
    const promotedUser = await User.findById(users.resident._id);
    assert(promotedUser.society.toString() === societyA._id.toString(), 'A role change does not move the member to another society');

    const roleAudit = await AuditLog.findOne({
      society: societyA._id,
      action: 'CHANGE_MEMBER_ROLE',
      entityId: users.resident._id,
    });
    assert(roleAudit, 'The role change is recorded in the audit log');
    assert(roleAudit.previousState.role === 'Resident', 'The audit log records the previous role');
    assert(roleAudit.newState.role === 'Society Administrator', 'The audit log records the new role');
    assert(!JSON.stringify(roleAudit).includes(societyA.code), 'The role audit entry does not contain the invitation code');

    const demoteOriginal = await request(
      server,
      `/api/admin/members/${users.admin._id}/role`,
      'PATCH',
      { role: 'Treasurer' },
      auth(tokens.admin)
    );
    assert(demoteOriginal.statusCode === 200, 'An administrator can be demoted when another active administrator remains');

    const residentLogin = await request(server, '/api/auth/login', 'POST', {
      email: users.resident.email,
      password: 'Password@123',
    });
    assert(residentLogin.statusCode === 200, 'The promoted resident can still sign in with the original password');
    const residentAdminToken = residentLogin.body.data.accessToken;
    const protectRemaining = await request(
      server,
      `/api/admin/members/${users.resident._id}/role`,
      'PATCH',
      { role: 'Resident' },
      auth(residentAdminToken)
    );
    assert(protectRemaining.statusCode === 400, 'The remaining active administrator cannot remove their own administrator role');

    const restoreAdmin = await request(
      server,
      `/api/admin/members/${users.admin._id}/role`,
      'PATCH',
      { role: 'Society Administrator' },
      auth(residentAdminToken)
    );
    assert(restoreAdmin.statusCode === 200, 'The second administrator can restore the original administrator');
    const restoreResident = await request(
      server,
      `/api/admin/members/${users.resident._id}/role`,
      'PATCH',
      { role: 'Resident' },
      auth(tokens.admin)
    );
    assert(restoreResident.statusCode === 200, 'The original administrator can return the temporary administrator to Resident');
    const adminLogin = await request(server, '/api/auth/login', 'POST', {
      email: users.admin.email,
      password: 'Password@123',
    });
    assert(adminLogin.statusCode === 200, 'The restored administrator can sign in');
    tokens.admin = adminLogin.body.data.accessToken;

    console.log('\n--- Society profile and invitation code ---');
    const profile = await request(server, '/api/admin/society', 'GET', null, auth(tokens.admin));
    assert(profile.statusCode === 200, 'Administrator can read the society profile');
    assert(profile.body.data.society.invitationCode === societyA.code, 'Administrator can see the current invitation code');
    assert(profile.body.data.society.id === societyA._id.toString(), 'The profile uses the existing society id');

    const blockedIdentity = await request(server, '/api/admin/society', 'PUT', {
      name: 'Renamed Society',
      registrationNumber: `REG-A-${suffix}`,
      fiscalYearStartMonth: 4,
      code: 'NEW-CODE-1',
    }, auth(tokens.admin));
    assert(blockedIdentity.statusCode === 400, 'The profile cannot change the invitation code directly');

    const updated = await request(server, '/api/admin/society', 'PUT', {
      name: `Renamed Society ${suffix}`,
      registrationNumber: `REG-NEW-${suffix}`.slice(0, 40),
      contactEmail: `office_${suffix}@test.org`,
      contactPhone: '9988776655',
      fiscalYearStartMonth: 4,
      address: { street: '1 Lake Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    }, auth(tokens.admin));
    assert(updated.statusCode === 200, 'Administrator can update society contact details');
    assert(updated.body.data.society.id === societyA._id.toString(), 'A profile update keeps the same society id');
    assert(updated.body.data.society.name === `Renamed Society ${suffix}`, 'The society name is updated');
    assert(updated.body.data.society.invitationCode === societyA.code, 'A profile update keeps the current invitation code');

    const fundAfterProfile = await Fund.findById(fund._id);
    assert(fundAfterProfile.society.toString() === societyA._id.toString(), 'Profile edits leave financial records on the same society');
    assert(fundAfterProfile.currentBalancePaise === 250000, 'Profile edits do not change fund balances');

    const oldCode = societyA.code;
    const rotated = await request(server, '/api/admin/invitation-code/rotate', 'POST', {}, auth(tokens.admin));
    assert(rotated.statusCode === 200, 'Administrator can rotate the invitation code');
    const newCode = rotated.body.data.invitationCode;
    assert(newCode && newCode !== oldCode, 'Rotation returns a different invitation code');
    assert(/^GW-[A-Z0-9]{8}$/.test(newCode), 'The rotated code uses the society code format');

    const rotationAudit = await AuditLog.findOne({ society: societyA._id, action: 'ROTATE_INVITATION_CODE' });
    assert(rotationAudit, 'Invitation code rotation is recorded in the audit log');
    assert(!JSON.stringify(rotationAudit).includes(newCode), 'The audit log does not store the new invitation code');
    assert(!JSON.stringify(rotationAudit).includes(oldCode), 'The audit log does not store the previous invitation code');

    const oldRegistration = await request(server, '/api/auth/register', 'POST', registerBody(`old_${suffix}@admin.test`, oldCode));
    assert(oldRegistration.statusCode === 404, 'The previous invitation code stops working');
    const newRegistration = await request(server, '/api/auth/register', 'POST', registerBody(`new_${suffix}@admin.test`, newCode, 'Treasurer'));
    assert(newRegistration.statusCode === 201, 'The new invitation code can register an account');
    assert(newRegistration.body.data.user.role === 'Resident', 'Registration still creates a Resident even if another role is submitted');
    const registered = await User.findOne({ email: `new_${suffix}@admin.test` });
    createdUserIds.push(registered._id);
    assert(registered.society.toString() === societyA._id.toString(), 'The new resident joins the administrator’s society');
    const fundAfterRotation = await Fund.findById(fund._id);
    assert(fundAfterRotation.society.toString() === societyA._id.toString(), 'Code rotation leaves financial records on the same society');

    const profileAudit = await AuditLog.findOne({ society: societyA._id, action: 'UPDATE_SOCIETY_PROFILE' });
    assert(profileAudit, 'Society profile changes are recorded in the audit log');

    console.log('\n======================================================');
    console.log(`   Verification Results: ${passedTests}/${totalTests} Tests Passed`);
    console.log('======================================================\n');
  } finally {
    server.close();
    if (societyA) {
      await Fund.deleteMany({ society: societyA._id });
      await User.deleteMany({ society: { $in: [societyA._id, societyB?._id].filter(Boolean) } });
      await AuditLog.collection.deleteMany({ society: { $in: [societyA._id, societyB?._id].filter(Boolean) } });
      await Society.deleteMany({ _id: { $in: [societyA._id, societyB?._id].filter(Boolean) } });
    }
    await mongoose.disconnect();
  }
}

runAdminTests().catch(async (error) => {
  console.error('\n❌ Administrator Test Suite Encountered Critical Failure:', error);
  try { await mongoose.disconnect(); } catch { /* already closed */ }
  process.exit(1);
});
