/**
 * Production initialization safety tests.
 * Uses a separate local database and never contacts Atlas.
 */

import mongoose from 'mongoose';
import { spawn } from 'child_process';
import {
  assertBootstrapAllowed,
  generateInvitationCode,
  GREENWOOD_NAME,
  GREENWOOD_REGISTRATION_NUMBER,
  isAtlasUri,
  isLocalDevelopmentLedger,
  readBootstrapAdmin,
  runProductionInit,
} from '../src/bootstrap/productionInit.js';

const LOCAL_BOOTSTRAP_URI = 'mongodb://127.0.0.1:27017/society_ledger_bootstrap_test';
const LOCAL_LEDGER_URI = 'mongodb://127.0.0.1:27017/society_ledger';
const GREENWOOD_ID = '6ae226b9bf65c0cccce713bc';
const TEST_PASSWORD = 'Local-Bootstrap-Test-Password-1';

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

function baseEnv(overrides = {}) {
  return {
    BOOTSTRAP_CONFIRM: 'INITIALIZE_GREENWOOD_HEIGHTS',
    MONGODB_URI: LOCAL_BOOTSTRAP_URI,
    BOOTSTRAP_ADMIN_NAME: 'Greenwood Administrator',
    BOOTSTRAP_ADMIN_EMAIL: 'bootstrap.admin@example.com',
    BOOTSTRAP_ADMIN_PASSWORD: TEST_PASSWORD,
    NODE_ENV: 'test',
    ...overrides,
  };
}

function expectRefusal(env, pattern, message) {
  let refused = false;
  try {
    assertBootstrapAllowed(env);
    readBootstrapAdmin(env);
  } catch (error) {
    refused = error.code === 'BOOTSTRAP_REFUSED' && pattern.test(error.message);
  }
  assert(refused, message);
}

async function greenwoodLedgerState() {
  const connection = await mongoose.createConnection(LOCAL_LEDGER_URI).asPromise();
  const societyId = new mongoose.Types.ObjectId(GREENWOOD_ID);
  const society = await connection.collection('societies').findOne(
    { _id: societyId },
    { projection: { name: 1, code: 1, registrationNumber: 1 } }
  );
  const funds = await connection.collection('funds').countDocuments({ society: societyId });
  const transactions = await connection.collection('transactions').countDocuments({ society: societyId });
  await connection.close();
  return {
    name: society?.name || null,
    code: society?.code || null,
    registrationNumber: society?.registrationNumber || null,
    funds,
    transactions,
  };
}

async function dropBootstrapDatabase() {
  const connection = await mongoose.createConnection(LOCAL_BOOTSTRAP_URI).asPromise();
  if (connection.name !== 'society_ledger_bootstrap_test') {
    throw new Error('Refusing to drop an unexpected database.');
  }
  await connection.dropDatabase();
  await connection.close();
}

function runCli(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/bootstrap/runProductionInit.js'], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function runBootstrapTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Production Bootstrap Safety Tests');
  console.log('======================================================\n');

  assert(isAtlasUri('mongodb+srv://example.mongodb.net/society_ledger'), 'Atlas SRV URIs are recognized');
  assert(!isAtlasUri(LOCAL_BOOTSTRAP_URI), 'Local URIs are not treated as Atlas');
  assert(isLocalDevelopmentLedger(LOCAL_LEDGER_URI), 'The local financial database is recognized');
  assert(!isLocalDevelopmentLedger(LOCAL_BOOTSTRAP_URI), 'The bootstrap test database is separate');

  const code = generateInvitationCode();
  assert(/^[A-Z0-9-]{4,20}$/.test(code), 'Generated invitation code matches the society code rule');
  assert(code !== 'GW-2021', 'Generated invitation code is not the public demo code');

  console.log('\n--- Refusals before any connection ---');
  expectRefusal({}, /BOOTSTRAP_CONFIRM/, 'Missing confirmation is refused');
  expectRefusal(baseEnv({ MONGODB_URI: 'mongodb+srv://cluster.mongodb.net/society_ledger', CONFIRM_ATLAS_INIT: '' }), /CONFIRM_ATLAS_INIT/, 'Atlas writes are refused without Atlas confirmation');
  expectRefusal(baseEnv({ MONGODB_URI: 'mongodb+srv://cluster.mongodb.net/society_ledger', CONFIRM_ATLAS_INIT: 'YES', NODE_ENV: 'development' }), /NODE_ENV=production/, 'Atlas writes are refused outside production');
  expectRefusal(baseEnv({ MONGODB_URI: LOCAL_LEDGER_URI }), /local society_ledger/, 'The local financial database is refused');
  expectRefusal(baseEnv({ BOOTSTRAP_ADMIN_PASSWORD: 'Admin@123' }), /development password/, 'Development passwords are refused');
  expectRefusal(baseEnv({ BOOTSTRAP_ADMIN_PASSWORD: 'short' }), /12 characters/, 'Short administrator passwords are refused');
  expectRefusal(baseEnv({ BOOTSTRAP_ADMIN_EMAIL: 'admin@society.org' }), /development account/, 'Development administrator emails are refused');

  const atlasCli = await runCli({
    BOOTSTRAP_CONFIRM: 'INITIALIZE_GREENWOOD_HEIGHTS',
    MONGODB_URI: 'mongodb+srv://cluster.mongodb.net/society_ledger',
    BOOTSTRAP_ADMIN_NAME: 'Greenwood Administrator',
    BOOTSTRAP_ADMIN_EMAIL: 'bootstrap.admin@example.com',
    BOOTSTRAP_ADMIN_PASSWORD: TEST_PASSWORD,
    NODE_ENV: 'production',
  });
  assert(atlasCli.code === 1, 'The command exits before an unconfirmed Atlas write');
  assert(atlasCli.stderr.includes('CONFIRM_ATLAS_INIT'), 'The Atlas refusal names the missing confirmation');
  assert(!atlasCli.stdout.includes(TEST_PASSWORD) && !atlasCli.stderr.includes(TEST_PASSWORD), 'Refusal output does not contain the password');

  console.log('\n--- Local disposable database ---');
  const before = await greenwoodLedgerState();
  await dropBootstrapDatabase();

  const created = await runProductionInit(baseEnv());
  assert(created.societyCreated, 'Greenwood society is created when absent');
  assert(created.userCreated, 'Initial administrator is created when absent');
  assert(created.societyName === GREENWOOD_NAME, 'Created society name is Greenwood Heights RWA');
  assert(created.registrationNumber === GREENWOOD_REGISTRATION_NUMBER, 'Created society keeps the Greenwood registration number');
  assert(created.invitationCode !== 'GW-2021', 'Created invitation code is not the public demo code');
  assert(created.adminRole === 'Society Administrator', 'Initial account is a Society Administrator');

  const connection = await mongoose.createConnection(LOCAL_BOOTSTRAP_URI).asPromise();
  const society = await connection.collection('societies').findOne({ registrationNumber: GREENWOOD_REGISTRATION_NUMBER });
  const admin = await connection.collection('users').findOne({ email: 'bootstrap.admin@example.com' });
  const funds = await connection.collection('funds').countDocuments({});
  const transactions = await connection.collection('transactions').countDocuments({});
  assert(society?.isActive === true, 'Created society is active');
  assert(society?.code === created.invitationCode, 'Invitation code is stored on that society');
  assert(String(admin.society) === String(society._id), 'Administrator is linked to Greenwood');
  assert(admin.role === 'Society Administrator', 'Stored role is Society Administrator');
  assert(typeof admin.passwordHash === 'string' && admin.passwordHash.startsWith('$2'), 'Password is stored as a bcrypt hash');
  assert(admin.passwordHash !== TEST_PASSWORD, 'Plaintext password is not stored');
  assert(funds === 0 && transactions === 0, 'No financial records are created');
  const firstHash = admin.passwordHash;
  await connection.close();

  const repeated = await runProductionInit(baseEnv());
  assert(!repeated.societyCreated && !repeated.userCreated, 'A second run creates nothing');
  assert(repeated.invitationCode === created.invitationCode, 'A second run keeps the invitation code');

  const afterRepeat = await mongoose.createConnection(LOCAL_BOOTSTRAP_URI).asPromise();
  const adminAgain = await afterRepeat.collection('users').findOne({ email: 'bootstrap.admin@example.com' });
  const societyCount = await afterRepeat.collection('societies').countDocuments({ registrationNumber: GREENWOOD_REGISTRATION_NUMBER });
  assert(societyCount === 1, 'Initialization does not duplicate the society');
  assert(adminAgain.passwordHash === firstHash, 'A second run does not replace the password hash');
  const passwordMatches = await import('bcryptjs').then((bcrypt) => bcrypt.default.compare(TEST_PASSWORD, adminAgain.passwordHash));
  assert(passwordMatches, 'The stored hash matches the supplied administrator password');
  await afterRepeat.close();

  const cli = await runCli(baseEnv());
  assert(cli.code === 0, 'The command succeeds against the disposable local database');
  assert(cli.stdout.includes(created.invitationCode), 'The command reports the invitation code');
  assert(!cli.stdout.includes(TEST_PASSWORD) && !cli.stderr.includes(TEST_PASSWORD), 'The command does not print the password');

  const after = await greenwoodLedgerState();
  assert(after.name === before.name && after.code === before.code, 'Local Greenwood identity is unchanged');
  assert(after.registrationNumber === before.registrationNumber, 'Local Greenwood registration number is unchanged');
  assert(after.funds === before.funds && after.transactions === before.transactions, 'Local Greenwood financial counts are unchanged');

  await dropBootstrapDatabase();

  console.log('\n======================================================');
  console.log(`   Bootstrap Safety Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
  console.log('======================================================\n');
}

runBootstrapTests().catch(async (error) => {
  console.error('\n❌ Bootstrap Test Suite Failure:', error);
  try {
    await dropBootstrapDatabase();
  } catch {
    // The disposable database may already be closed.
  }
  process.exit(1);
});
