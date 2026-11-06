import crypto from 'crypto';
import mongoose from 'mongoose';
import { describeMongoTarget, redactMongoCredentials } from '../config/db.js';
import { Society, User, AuditLog, Fund, Transaction } from '../models/index.js';

export const BOOTSTRAP_CONFIRMATION = 'INITIALIZE_GREENWOOD_HEIGHTS';
export const GREENWOOD_NAME = 'Greenwood Heights RWA';
export const GREENWOOD_REGISTRATION_NUMBER = 'RWA/2021/489';
const PUBLIC_DEMO_CODE = 'GW-2021';
const DEMO_PASSWORDS = new Set([
  'Admin@123',
  'Treasurer@123',
  'Committee@123',
  'Auditor@123',
  'Resident@123',
  'Fixture@123',
]);
const DEMO_EMAILS = new Set([
  'admin@society.org',
  'treasurer@society.org',
  'committee@society.org',
  'auditor@society.org',
  'resident@society.org',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isAtlasUri(uri) {
  return /mongodb\+srv:|\.mongodb\.net/i.test(uri || '');
}

export function isLocalDevelopmentLedger(uri) {
  if (!uri || isAtlasUri(uri)) return false;
  try {
    const parsed = new URL(uri);
    const host = parsed.hostname;
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    const localHost = host === '127.0.0.1' || host === 'localhost';
    return localHost && database === 'society_ledger';
  } catch {
    return false;
  }
}

/**
 * Refuses every write until the operator confirms it. Atlas and the local
 * financial database need additional confirmation and are not used by tests.
 */
export function assertBootstrapAllowed(env) {
  const problems = [];
  if (env.BOOTSTRAP_CONFIRM !== BOOTSTRAP_CONFIRMATION) {
    problems.push(`BOOTSTRAP_CONFIRM must be ${BOOTSTRAP_CONFIRMATION}`);
  }
  if (!text(env.MONGODB_URI)) {
    problems.push('MONGODB_URI is required');
  } else if (isAtlasUri(env.MONGODB_URI)) {
    if (env.NODE_ENV !== 'production') {
      problems.push('Atlas initialization requires NODE_ENV=production');
    }
    if (env.CONFIRM_ATLAS_INIT !== 'YES') {
      problems.push('CONFIRM_ATLAS_INIT=YES is required before any Atlas write');
    }
  } else if (isLocalDevelopmentLedger(env.MONGODB_URI) && env.ALLOW_LOCAL_LEDGER_INIT !== 'YES') {
    problems.push('Refusing to write the local society_ledger database');
  }

  if (problems.length > 0) {
    const error = new Error(problems.join('; '));
    error.code = 'BOOTSTRAP_REFUSED';
    throw error;
  }
}

export function readBootstrapAdmin(env) {
  const name = text(env.BOOTSTRAP_ADMIN_NAME);
  const email = text(env.BOOTSTRAP_ADMIN_EMAIL).toLowerCase();
  const password = typeof env.BOOTSTRAP_ADMIN_PASSWORD === 'string' ? env.BOOTSTRAP_ADMIN_PASSWORD : '';
  const problems = [];

  if (!name) problems.push('BOOTSTRAP_ADMIN_NAME is required');
  if (!/^\S+@\S+\.\S+$/.test(email)) problems.push('BOOTSTRAP_ADMIN_EMAIL must be a valid email');
  if (DEMO_EMAILS.has(email)) problems.push('BOOTSTRAP_ADMIN_EMAIL must not be a development account');
  if (password.length < 12) problems.push('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters');
  if (DEMO_PASSWORDS.has(password)) problems.push('BOOTSTRAP_ADMIN_PASSWORD must not be a development password');

  if (problems.length > 0) {
    const error = new Error(problems.join('; '));
    error.code = 'BOOTSTRAP_REFUSED';
    throw error;
  }

  return {
    name,
    email,
    password,
    phone: text(env.BOOTSTRAP_ADMIN_PHONE) || null,
    apartmentNumber: text(env.BOOTSTRAP_ADMIN_APARTMENT) || null,
  };
}

export function generateInvitationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  const bytes = crypto.randomBytes(8);
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  const code = `GW-${body}`;
  if (!/^[A-Z0-9-]{4,20}$/.test(code) || code === PUBLIC_DEMO_CODE) {
    throw new Error('Generated invitation code was rejected.');
  }
  return code;
}

async function unusedInvitationCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInvitationCode();
    const existing = await Society.findOne({ code });
    if (!existing) return code;
  }
  throw new Error('Could not allocate a unique invitation code.');
}

/**
 * Creates the Greenwood society and its first administrator when they are absent.
 * Existing records, passwords, invitation codes, and financial collections are left unchanged.
 */
export async function initializeGreenwoodAdmin(admin) {
  const fundsBefore = await Fund.countDocuments({});
  const transactionsBefore = await Transaction.countDocuments({});

  const byRegistration = await Society.findOne({ registrationNumber: GREENWOOD_REGISTRATION_NUMBER });
  const byName = await Society.findOne({ name: GREENWOOD_NAME });
  if (byRegistration && byName && String(byRegistration._id) !== String(byName._id)) {
    throw new Error('Greenwood name and registration number point at different societies.');
  }
  if (byName && byName.registrationNumber && byName.registrationNumber !== GREENWOOD_REGISTRATION_NUMBER) {
    throw new Error('A society named Greenwood Heights RWA has a different registration number.');
  }

  let society = byRegistration || byName;
  let societyCreated = false;
  if (!society) {
    society = await Society.create({
      name: GREENWOOD_NAME,
      code: await unusedInvitationCode(),
      registrationNumber: GREENWOOD_REGISTRATION_NUMBER,
      isActive: true,
    });
    societyCreated = true;
  }

  const existingUser = await User.findOne({ email: admin.email });
  let userCreated = false;
  if (existingUser) {
    if (String(existingUser.society) !== String(society._id)) {
      throw new Error('The administrator email already belongs to another society.');
    }
    if (existingUser.role !== 'Society Administrator') {
      throw new Error('The administrator email already belongs to a non-administrator account.');
    }
  } else {
    const created = await User.create({
      name: admin.name,
      email: admin.email,
      passwordHash: admin.password,
      phone: admin.phone,
      apartmentNumber: admin.apartmentNumber,
      role: 'Society Administrator',
      society: society._id,
      verificationStatus: 'VERIFIED',
      isActive: true,
    });
    userCreated = true;
    await AuditLog.create({
      society: society._id,
      actor: created._id,
      action: 'BOOTSTRAP_ADMIN',
      entityType: 'USER',
      entityId: created._id,
      details: 'Initial Society Administrator created by production initialization.',
      severity: 'HIGH',
    });
  }

  const fundsAfter = await Fund.countDocuments({});
  const transactionsAfter = await Transaction.countDocuments({});
  if (fundsAfter !== fundsBefore || transactionsAfter !== transactionsBefore) {
    throw new Error('Initialization changed financial records.');
  }

  return {
    societyCreated,
    userCreated,
    societyName: society.name,
    registrationNumber: society.registrationNumber,
    invitationCode: society.code,
    demoCodeRetained: society.code === PUBLIC_DEMO_CODE,
    adminEmail: admin.email,
    adminRole: 'Society Administrator',
  };
}

export async function runProductionInit(env = process.env) {
  assertBootstrapAllowed(env);
  const admin = readBootstrapAdmin(env);
  const target = describeMongoTarget(env.MONGODB_URI);

  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    throw new Error(`Bootstrap connection failed: ${redactMongoCredentials(error?.message)}`);
  }

  try {
    const result = await initializeGreenwoodAdmin(admin);
    return { ...result, target };
  } finally {
    await mongoose.disconnect();
  }
}
