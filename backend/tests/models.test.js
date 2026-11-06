/**
 * SocietyLedger Backend: Comprehensive Model Validation & Schema Test Suite
 * Verifies all 11 Mongoose models, validations, virtuals, hooks, and local MongoDB operations.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { describeMongoTarget, redactMongoCredentials } from '../src/config/db.js';
import {
  Society,
  User,
  Fund,
  Transaction,
  Approval,
  Event,
  Compliance,
  Reconciliation,
  AuditLog,
  Document,
  ResidentQuery,
  USER_ROLES,
  FUND_TYPES,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
  APPROVAL_STATUSES,
  EVENT_STATUSES,
  COMPLIANCE_STATUSES,
  RECONCILIATION_STATUSES,
  DOCUMENT_CATEGORIES,
  QUERY_STATUSES,
  QUERY_CATEGORIES,
} from '../src/models/index.js';

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

async function runModelTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger Backend: Model Validation Test Suite');
  console.log('======================================================\n');

  // --- 1. Model Imports & Enum Integrity ---
  console.log('--- 1. Model Imports & Enum Definitions ---');
  assert(typeof Society === 'function', 'Society model defined and exported');
  assert(typeof User === 'function', 'User model defined and exported');
  assert(typeof Fund === 'function', 'Fund model defined and exported');
  assert(typeof Transaction === 'function', 'Transaction model defined and exported');
  assert(typeof Approval === 'function', 'Approval model defined and exported');
  assert(typeof Event === 'function', 'Event model defined and exported');
  assert(typeof Compliance === 'function', 'Compliance model defined and exported');
  assert(typeof Reconciliation === 'function', 'Reconciliation model defined and exported');
  assert(typeof AuditLog === 'function', 'AuditLog model defined and exported');
  assert(typeof Document === 'function', 'Document model defined and exported');
  assert(typeof ResidentQuery === 'function', 'ResidentQuery model defined and exported');

  assert(USER_ROLES.length === 5, '5 system roles defined');
  assert(FUND_TYPES.includes('CORPUS') && FUND_TYPES.includes('SINKING'), 'Fund types include CORPUS and SINKING');
  assert(TRANSACTION_TYPES.length === 3, '3 transaction types (INCOME, EXPENSE, TRANSFER)');
  assert(TRANSACTION_STATUSES.includes('REVERSED') && TRANSACTION_STATUSES.includes('RECONCILED'), 'Transaction statuses include REVERSED & RECONCILED');

  // --- 2. Schema Validation Without Database ---
  console.log('\n--- 2. In-Memory Schema Validation Rules ---');

  // Society validation
  const invalidSociety = new Society({});
  const socErr = invalidSociety.validateSync();
  assert(socErr.errors['name'] !== undefined, 'Society requires name');
  assert(socErr.errors['code'] !== undefined, 'Society requires code');

  // User email & role validation
  const invalidUser = new User({
    name: 'Test',
    email: 'not-an-email',
    passwordHash: 'secret',
    role: 'SuperAdmin', // Invalid role
    society: new mongoose.Types.ObjectId(),
  });
  const userErr = invalidUser.validateSync();
  assert(userErr.errors['email'] !== undefined, 'User rejects invalid email format');
  assert(userErr.errors['role'] !== undefined, 'User rejects undefined role enum');

  // Fund integer paise validation
  const invalidFund = new Fund({
    society: new mongoose.Types.ObjectId(),
    name: 'Operational Fund',
    code: 'FND-OPS',
    type: 'OPERATIONAL',
    openingBalancePaise: 100.50, // Non-integer paise
    currentBalancePaise: 100,
    createdBy: new mongoose.Types.ObjectId(),
  });
  const fundErr = invalidFund.validateSync();
  assert(fundErr.errors['openingBalancePaise'] !== undefined, 'Fund rejects non-integer opening balance paise');

  // Fund virtual getters
  const validFund = new Fund({
    society: new mongoose.Types.ObjectId(),
    name: 'General Corpus',
    code: 'FND-CORPUS',
    type: 'CORPUS',
    openingBalancePaise: 284000000,
    currentBalancePaise: 284000000,
    createdBy: new mongoose.Types.ObjectId(),
  });
  assert(validFund.currentBalanceRupees === 2840000, 'Fund virtual currentBalanceRupees converts paise to rupees');

  // Transaction virtual getters and non-negative amount
  const validTx = new Transaction({
    society: new mongoose.Types.ObjectId(),
    fund: new mongoose.Types.ObjectId(),
    reference: 'VR-2026-001',
    date: new Date(),
    type: 'EXPENSE',
    description: 'Lift AMC Maintenance',
    amountPaise: 1850000,
    createdBy: new mongoose.Types.ObjectId(),
  });
  assert(validTx.amountRupees === 18500, 'Transaction virtual amountRupees converts paise to rupees');

  // Approval virtuals
  const validAppr = new Approval({
    society: new mongoose.Types.ObjectId(),
    description: 'Pandal & Sound Services',
    requestedAmountPaise: 3500000,
    fund: new mongoose.Types.ObjectId(),
    requester: new mongoose.Types.ObjectId(),
  });
  assert(validAppr.requestedAmountRupees === 35000, 'Approval virtual requestedAmountRupees converts paise to rupees');

  // Event virtuals
  const validEvent = new Event({
    society: new mongoose.Types.ObjectId(),
    title: 'Diwali Fest',
    date: new Date(),
    proposedBudgetPaise: 8000000,
    approvedBudgetPaise: 7500000,
    actualExpenditurePaise: 7200000,
    proposedBy: new mongoose.Types.ObjectId(),
  });
  assert(validEvent.proposedBudgetRupees === 80000, 'Event virtual proposedBudgetRupees converts paise');
  assert(validEvent.approvedBudgetRupees === 75000, 'Event virtual approvedBudgetRupees converts paise');
  assert(validEvent.actualExpenditureRupees === 72000, 'Event virtual actualExpenditureRupees converts paise');
  assert(validEvent.unspentBalancePaise === 300000, 'Event virtual unspentBalancePaise calculates difference');

  // Compliance isOverdue virtual
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);
  const overdueCompliance = new Compliance({
    society: new mongoose.Types.ObjectId(),
    filingType: 'Form V',
    statutoryBody: 'Registrar',
    financialPeriod: 'FY 25-26',
    deadline: pastDate,
    status: 'PENDING',
  });
  assert(overdueCompliance.isOverdue === true, 'Compliance isOverdue returns true when deadline has passed');

  // Reconciliation virtuals
  const validRec = new Reconciliation({
    society: new mongoose.Types.ObjectId(),
    fund: new mongoose.Types.ObjectId(),
    accountName: 'HDFC Current A/C',
    statementPeriodStart: new Date(),
    statementPeriodEnd: new Date(),
    statementClosingBalancePaise: 61235000,
    bookClosingBalancePaise: 60035000,
    preparedBy: new mongoose.Types.ObjectId(),
  });
  assert(validRec.differenceAmountPaise === 1200000, 'Reconciliation differenceAmountPaise calculates discrepancy');
  assert(validRec.differenceAmountRupees === 12000, 'Reconciliation differenceAmountRupees converts to INR');

  // Document sizeDisplay virtual
  const validDoc = new Document({
    society: new mongoose.Types.ObjectId(),
    name: 'Invoice.pdf',
    category: 'INVOICE_RECEIPT',
    sizeBytes: 1048576 * 2.5, // 2.5 MB
    storagePath: '/uploads/invoice.pdf',
    uploadedBy: new mongoose.Types.ObjectId(),
  });
  assert(validDoc.sizeDisplay === '2.5 MB', 'Document sizeDisplay formats byte count to MB');

  const secretUri = 'mongodb+srv://atlas_user:s3cret-pass@cluster.mongodb.net/society_ledger';
  const described = describeMongoTarget(secretUri);
  assert(described === 'mongodb+srv://cluster.mongodb.net/society_ledger', 'Connection target keeps host and database name');
  assert(!described.includes('atlas_user') && !described.includes('s3cret-pass'), 'Connection target omits username and password');
  const driverError = redactMongoCredentials(
    `connect failed mongodb+srv://atlas_user:s3cret-pass@cluster.mongodb.net/society_ledger bad auth`
  );
  assert(!driverError.includes('s3cret-pass'), 'Connection errors omit passwords');
  assert(!driverError.includes('atlas_user'), 'Connection errors omit usernames');
  assert(driverError.includes('cluster.mongodb.net'), 'Connection errors keep the database host');
  assert(describeMongoTarget('not a uri') === 'configured MongoDB target', 'Unparseable targets are not printed');

  // --- 3. Live Local MongoDB Integration & Hook Tests ---
  console.log('\n--- 3. Local MongoDB Live Connection & Hooks ---');
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';
  console.log(`Connecting to MongoDB at: ${describeMongoTarget(mongoURI)}`);

  await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
  assert(mongoose.connection.readyState === 1, 'Mongoose successfully connected to local MongoDB instance');

  const testSuffix = Date.now();
  let testSocietyId = null;
  let testUserId = null;

  try {
    // 3a. Create Society
    const testSociety = await Society.create({
      name: `Test Society ${testSuffix}`,
      code: `TS-${testSuffix}`.slice(0, 16),
      address: { city: 'Bengaluru', state: 'Karnataka', pincode: '560100' },
    });
    testSocietyId = testSociety._id;
    assert(testSociety._id !== undefined, 'Society created and persisted to MongoDB');

    // 3b. Create User with Bcrypt Pre-save Hook
    const rawPassword = 'Password@123';
    const testUser = await User.create({
      name: 'Priya Sharma',
      email: `priya_${testSuffix}@society.org`,
      passwordHash: rawPassword, // Pre-save hook should hash this
      role: 'Treasurer',
      society: testSocietyId,
      apartmentNumber: 'A-402',
    });
    testUserId = testUser._id;
    assert(testUser.passwordHash !== rawPassword, 'User pre-save hook successfully hashed plaintext password');

    // 3c. Verify comparePassword method
    const userWithPassword = await User.findById(testUserId).select('+passwordHash');
    const isMatch = await userWithPassword.comparePassword(rawPassword);
    const isMismatch = await userWithPassword.comparePassword('WrongPassword!');
    assert(isMatch === true, 'User comparePassword returns true for valid password');
    assert(isMismatch === false, 'User comparePassword returns false for invalid password');

    // 3d. Verify JSON transform does not expose passwordHash
    const userJSON = testUser.toJSON();
    assert(userJSON.passwordHash === undefined, 'User toJSON transform strips passwordHash');

    // 3e. Create AuditLog and test immutability hook
    const testAudit = await AuditLog.create({
      society: testSocietyId,
      actor: testUserId,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: testUserId,
      details: 'User authenticated successfully',
      severity: 'INFO',
    });
    assert(testAudit._id !== undefined, 'AuditLog created in database');

    let auditUpdateBlocked = false;
    try {
      testAudit.details = 'Attempted modification of audit entry';
      await testAudit.save();
    } catch (err) {
      if (err.message.includes('immutable and cannot be modified')) {
        auditUpdateBlocked = true;
      }
    }
    assert(auditUpdateBlocked, 'AuditLog pre-save hook strictly blocks updates to existing logs');

    // 3f. Create Transaction and test deletion prevention hook
    const testFund = await Fund.create({
      society: testSocietyId,
      name: 'Maintenance Fund',
      code: `FND-M-${testSuffix}`.slice(0, 20),
      type: 'OPERATIONAL',
      openingBalancePaise: 50000000,
      currentBalancePaise: 50000000,
      createdBy: testUserId,
    });

    const testTx = await Transaction.create({
      society: testSocietyId,
      fund: testFund._id,
      reference: `VR-${testSuffix}`.slice(0, 20),
      date: new Date(),
      type: 'INCOME',
      description: 'Maintenance collection Wing A',
      amountPaise: 1500000,
      createdBy: testUserId,
      status: 'APPROVED',
    });
    assert(testTx._id !== undefined, 'Transaction voucher created in database');

    let txDeleteBlocked = false;
    try {
      await testTx.deleteOne();
    } catch (err) {
      if (err.message.includes('records cannot be deleted')) {
        txDeleteBlocked = true;
      }
    }
    assert(txDeleteBlocked, 'Transaction pre-deleteOne hook blocks physical deletion');

    // Clean up test documents safely
    await Transaction.collection.deleteOne({ _id: testTx._id });
    await Fund.collection.deleteOne({ _id: testFund._id });
    await AuditLog.collection.deleteOne({ _id: testAudit._id });
    await User.collection.deleteOne({ _id: testUserId });
    await Society.collection.deleteOne({ _id: testSocietyId });
    console.log('Test fixtures cleaned up from database');

  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed cleanly');
  }

  console.log('\n======================================================');
  console.log(`   Model Verification Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
  console.log('======================================================\n');
}

runModelTests().catch((err) => {
  console.error('\n❌ Model Validation Suite Encountered Critical Failure:', err);
  process.exit(1);
});
