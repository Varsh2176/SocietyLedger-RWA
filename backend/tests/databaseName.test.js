/**
 * Production database-name checks.
 * These tests never open a MongoDB connection.
 */

import { spawn } from 'child_process';
import mongoose from 'mongoose';
import { assertBootstrapAllowed } from '../src/bootstrap/productionInit.js';
import {
  connectDB,
  isAtlasMongoUri,
  mongoDatabaseName,
  mongoUriProblem,
  REQUIRED_DATABASE_NAME,
} from '../src/config/db.js';
import { collectProductionEnvProblems } from '../src/config/productionEnv.js';

const CORRECT_ATLAS_URI = 'mongodb+srv://atlas_user:s3cret-pass@cluster.mongodb.net/society_ledger';
const CORRECT_ATLAS_URI_WITH_QUERY = 'mongodb+srv://atlas_user:s3cret-pass@cluster.mongodb.net/society_ledger?retryWrites=true&w=majority';
const WRONG_ATLAS_URI = 'mongodb+srv://atlas_user:s3cret-pass@rejected.invalid/other_db';
const MISSING_ATLAS_URI = 'mongodb+srv://atlas_user:s3cret-pass@rejected.invalid';
const MISSING_ATLAS_URI_WITH_SLASH = 'mongodb+srv://atlas_user:s3cret-pass@rejected.invalid/';
const MISSING_ATLAS_URI_WITH_QUERY = 'mongodb+srv://atlas_user:s3cret-pass@rejected.invalid/?retryWrites=true';
const LOCAL_URI = 'mongodb://127.0.0.1:27017/society_ledger';
const LOCAL_OTHER_URI = 'mongodb://127.0.0.1:27017/society_ledger_bootstrap_test';
const JWT_SECRET = 'production-jwt-secret-not-a-default-value';
const COOKIE_SECRET = 'production-cookie-secret-not-a-default-value';

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

function productionEnv(uri) {
  return {
    NODE_ENV: 'production',
    MONGODB_URI: uri,
    JWT_SECRET,
    COOKIE_SECRET,
    CLIENT_URL: 'https://societyledger.example',
  };
}

function leaksCredentials(text) {
  return text.includes('s3cret-pass')
    || text.includes('atlas_user')
    || text.includes('mongodb+srv://')
    || text.includes('mongodb://');
}

function assertSafeProblem(problem, pattern, message) {
  assert(typeof problem === 'string' && pattern.test(problem), message);
  assert(!leaksCredentials(problem), `${message} does not reveal credentials or the connection string`);
}

async function withEnv(values, fn) {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI,
  };
  try {
    if (values.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = values.NODE_ENV;
    if (values.MONGODB_URI === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = values.MONGODB_URI;
    return await fn();
  } finally {
    if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved.NODE_ENV;
    if (saved.MONGODB_URI === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = saved.MONGODB_URI;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

function runStartup(uri) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/server.js'], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        PATHEXT: process.env.PATHEXT,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        ...productionEnv(uri),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Production startup did not exit'));
    }, 15000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Production Database Name');
  console.log('======================================================\n');

  assert(REQUIRED_DATABASE_NAME === 'society_ledger', 'Production database name is society_ledger');
  assert(isAtlasMongoUri(CORRECT_ATLAS_URI), 'An SRV URI is recognized as Atlas');
  assert(!isAtlasMongoUri(LOCAL_URI), 'The local development URI is not Atlas');

  console.log('\n--- Correct Atlas URI ---');
  assert(mongoDatabaseName(CORRECT_ATLAS_URI) === 'society_ledger', 'Correct Atlas path selects society_ledger');
  assert(mongoUriProblem(CORRECT_ATLAS_URI, { production: true }) === null, 'Correct Atlas URI passes production validation');
  assert(mongoUriProblem(CORRECT_ATLAS_URI_WITH_QUERY, { production: true }) === null, 'Query options do not change the Atlas database name');
  assert(
    collectProductionEnvProblems(productionEnv(CORRECT_ATLAS_URI)).length === 0,
    'Production startup accepts an Atlas URI for society_ledger'
  );

  console.log('\n--- Incorrect database name ---');
  assert(mongoDatabaseName(WRONG_ATLAS_URI) === 'other_db', 'Incorrect Atlas path is visible to the validator');
  assertSafeProblem(
    mongoUriProblem(WRONG_ATLAS_URI, { production: true }),
    /must use the society_ledger database/,
    'Incorrect Atlas database name is rejected'
  );
  const incorrectStartup = collectProductionEnvProblems(productionEnv(WRONG_ATLAS_URI));
  assert(incorrectStartup.length === 1, 'Incorrect Atlas database is the only production startup problem');
  assertSafeProblem(incorrectStartup[0], /must use the society_ledger database/, 'Startup names the database requirement');

  console.log('\n--- Missing database name ---');
  for (const uri of [MISSING_ATLAS_URI, MISSING_ATLAS_URI_WITH_SLASH, MISSING_ATLAS_URI_WITH_QUERY]) {
    assert(mongoDatabaseName(uri) === '', 'Missing Atlas database path produces no database name');
    assertSafeProblem(
      mongoUriProblem(uri, { production: true }),
      /must include the society_ledger database name/,
      'Missing Atlas database path is rejected'
    );
  }
  const missingStartup = collectProductionEnvProblems(productionEnv(MISSING_ATLAS_URI));
  assertSafeProblem(missingStartup[0], /must include the society_ledger database name/, 'Startup rejects a missing Atlas database path');

  console.log('\n--- Local development URI ---');
  assert(mongoDatabaseName(LOCAL_URI) === 'society_ledger', 'Local development URI selects society_ledger');
  assert(mongoUriProblem(LOCAL_URI, { production: false }) === null, 'Local development URI is accepted outside production');
  assert(mongoUriProblem(LOCAL_OTHER_URI, { production: false }) === null, 'Another local development database is unchanged');
  assert(
    collectProductionEnvProblems({ NODE_ENV: 'development', MONGODB_URI: LOCAL_OTHER_URI }).length === 0,
    'Development startup does not apply the production database rule'
  );
  assert(
    mongoUriProblem(LOCAL_URI, { production: true }) === null,
    'An explicit local URI for society_ledger names the required database'
  );

  console.log('\n--- Connection guard ---');
  await withEnv({ NODE_ENV: 'production', MONGODB_URI: undefined }, async () => {
    const result = await connectDB();
    assert(result === null, 'Production does not fall back to local MongoDB');
    assert(mongoose.connection.readyState === 0, 'Missing production URI does not open a connection');
  });
  await withEnv({ NODE_ENV: 'production', MONGODB_URI: WRONG_ATLAS_URI }, async () => {
    const result = await connectDB();
    assert(result === null, 'Production refuses an incorrect database before connecting');
    assert(mongoose.connection.readyState === 0, 'Incorrect Atlas URI does not open a connection');
  });
  await withEnv({ NODE_ENV: 'development', MONGODB_URI: LOCAL_URI }, async () => {
    assert(mongoUriProblem(process.env.MONGODB_URI, { production: false }) === null, 'Development connect path keeps the local URI');
  });

  let bootstrapRefused = false;
  try {
    assertBootstrapAllowed({
      BOOTSTRAP_CONFIRM: 'INITIALIZE_GREENWOOD_HEIGHTS',
      MONGODB_URI: WRONG_ATLAS_URI,
      NODE_ENV: 'production',
      CONFIRM_ATLAS_INIT: 'YES',
    });
  } catch (error) {
    bootstrapRefused = error.code === 'BOOTSTRAP_REFUSED'
      && /must use the society_ledger database/.test(error.message)
      && !leaksCredentials(error.message);
  }
  assert(bootstrapRefused, 'Bootstrap refuses an incorrect Atlas database before connecting');

  console.log('\n--- Production startup process ---');
  const started = await runStartup(WRONG_ATLAS_URI);
  const output = `${started.stdout}\n${started.stderr}`;
  assert(started.code === 1, 'Production startup exits when the Atlas database name is wrong');
  assert(/must use the society_ledger database/.test(output), 'Production startup reports the database-name rejection');
  assert(!leaksCredentials(output), 'Production startup output omits credentials and the connection string');
  assert(!output.includes('Connected successfully'), 'Production startup does not connect with an invalid URI');
  assert(!output.includes('Initial connection failure'), 'Production startup validates the URI before connecting');
  assert(!output.includes('API running'), 'Production startup does not listen with an invalid URI');

  const missingProcess = await runStartup(MISSING_ATLAS_URI);
  const missingOutput = `${missingProcess.stdout}\n${missingProcess.stderr}`;
  assert(missingProcess.code === 1, 'Production startup exits when the Atlas database path is missing');
  assert(/must include the society_ledger database name/.test(missingOutput), 'Production startup reports the missing database path');
  assert(!leaksCredentials(missingOutput), 'Missing-path startup output omits credentials and the connection string');
  assert(!missingOutput.includes('Initial connection failure'), 'Missing database path is rejected before connecting');

  console.log('\n======================================================');
  console.log(`   Verification Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Production database-name verification failed:', err.message);
  process.exit(1);
});
