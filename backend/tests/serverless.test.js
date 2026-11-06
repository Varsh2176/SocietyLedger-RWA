/**
 * Vercel function entry, connection reuse, and production secret checks.
 * Connections stay on local MongoDB. Atlas is never contacted.
 */

import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { sessionCookieOptions } from '../src/controllers/authController.js';
import { connectDB, disconnectDB, mongoPoolSize, mongoUriProblem } from '../src/config/db.js';
import { resolveSecret } from '../src/config/productionEnv.js';
import { createVercelHandler } from '../src/vercelApp.js';

const LOCAL_URI = 'mongodb://127.0.0.1:27017/society_ledger';
const CLOSED_PORT_URI = 'mongodb://127.0.0.1:1/society_ledger';
const JWT_SECRET = 'production-jwt-secret-not-a-default-value';
const COOKIE_SECRET = 'production-cookie-secret-not-a-default-value';
const DEV_JWT = 'society_ledger_dev_jwt_secret_change_in_production';
const DEV_COOKIE = 'society_ledger_cookie_secret_dev';

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

function serverCount() {
  return process._getActiveHandles().filter((handle) => handle instanceof http.Server).length;
}

async function withEnv(values, fn) {
  const keys = Object.keys(values);
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    return await fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

function request(server, path, headers = {}) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: body ? JSON.parse(body) : null });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function runNode(script, env, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        PATHEXT: process.env.PATHEXT,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${script} did not finish`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, pid: child.pid });
    });
  });
}

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    MONGODB_URI: LOCAL_URI,
    JWT_SECRET,
    COOKIE_SECRET,
    CLIENT_URL: 'https://societyledger.example',
    BLOB_STORE_ID: 'store_test',
    ...overrides,
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Vercel Serverless Backend');
  console.log('======================================================\n');

  const serverSource = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const vercelSource = fs.readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
  const renderSource = fs.readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
  assert(serverSource.includes('app.listen('), 'Local server entry still listens');
  assert(serverSource.includes('shutdown'), 'Local server entry keeps graceful shutdown');
  assert(!vercelSource.includes('.listen('), 'Vercel entry does not open a listener');
  assert(renderSource.includes('npm start'), 'Render start command is unchanged');

  console.log('\n--- Express export ---');
  await withEnv(productionEnv(), async () => {
    const beforeServers = serverCount();
    const handler = createVercelHandler();
    assert(typeof handler === 'function', 'Vercel handler exports the Express app');
    assert(serverCount() === beforeServers, 'Creating the Vercel handler does not open a listener');
    assert(handler.get('trust proxy') === 1, 'Production handler trusts the platform proxy');

    const routeServer = http.createServer(handler);
    await new Promise((resolve) => routeServer.listen(0, '127.0.0.1', resolve));
    try {
      const funds = await request(routeServer, '/api/funds');
      assert(funds.statusCode === 401, 'Existing protected /api route still requires authentication');
      const health = await request(routeServer, '/api/health');
      assert(health.statusCode === 200, 'Health route responds through the Vercel handler');
      assert(health.body.data.database.name === 'society_ledger', 'Vercel handler stays on the society_ledger database');
      assert(health.body.data.database.status === 'connected', 'Warm handler reused a database connection');
      const second = await request(routeServer, '/api/health');
      assert(second.statusCode === 200, 'A second request uses the cached database connection');
      const missing = await request(routeServer, '/api/unregistered-route-xyz');
      assert(missing.statusCode === 404, 'Unknown /api routes still return 404');
    } finally {
      await new Promise((resolve) => routeServer.close(resolve));
      await disconnectDB();
    }
  });

  console.log('\n--- Local development startup ---');
  const devServer = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      PATHEXT: process.env.PATHEXT,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: 'development',
      PORT: '0',
      MONGODB_URI: LOCAL_URI,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let devOut = '';
  const started = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      devServer.kill();
      reject(new Error('Local development server did not start'));
    }, 20000);
    const onData = (chunk) => {
      devOut += chunk;
      if (devOut.includes('API running')) {
        clearTimeout(timer);
        resolve();
      }
    };
    devServer.stdout.on('data', onData);
    devServer.stderr.on('data', onData);
    devServer.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  assert(started === undefined, 'Local development server reaches the listening log');
  assert(devOut.includes('127.0.0.1:27017/society_ledger'), 'Local development server uses the local database');
  assert(!devOut.includes('mongodb+srv://'), 'Local development startup does not print an Atlas URI');
  const devClosed = new Promise((resolve) => devServer.once('close', resolve));
  devServer.kill();
  await devClosed;

  console.log('\n--- Connection reuse ---');
  assert(mongoPoolSize({}) === 5, 'Serverless pool defaults to 5');
  assert(mongoPoolSize({ MONGODB_MAX_POOL_SIZE: '3' }) === 3, 'Pool size is configurable');
  assert(mongoPoolSize({ MONGODB_MAX_POOL_SIZE: '100' }) === 5, 'An oversized pool setting falls back to 5');

  const firstWave = await Promise.all([connectDB(LOCAL_URI), connectDB(LOCAL_URI), connectDB(LOCAL_URI)]);
  const listenersAfterFirst = mongoose.connection.listenerCount('connected');
  const secondWave = await Promise.all([connectDB(LOCAL_URI), connectDB(LOCAL_URI)]);
  assert(firstWave.every(Boolean) && secondWave.every(Boolean), 'Concurrent connection requests resolve together');
  assert(mongoose.connection.readyState === 1, 'Concurrent requests share a connected database');
  assert(mongoose.connection.listenerCount('connected') === listenersAfterFirst, 'Connection reuse does not register more listeners');
  const poolSize = mongoose.connection.getClient()?.options?.maxPoolSize;
  assert(poolSize === 5, 'The live client uses the small connection pool');
  await disconnectDB();

  console.log('\n--- Connection failure and retry ---');
  const failed = await connectDB(CLOSED_PORT_URI);
  const retried = await connectDB(CLOSED_PORT_URI);
  assert(failed === null && retried === null, 'A refused connection fails and can be attempted again');
  const recovered = await connectDB(LOCAL_URI);
  assert(recovered && mongoose.connection.readyState === 1, 'A later connection attempt can succeed after a failure');
  await disconnectDB();

  console.log('\n--- Production database name and secrets ---');
  assert(mongoUriProblem('mongodb+srv://atlas_user:s3cret-pass@rejected.invalid/society_ledger', { production: true }) === null, 'Correct Atlas database name is accepted');
  const wrongName = mongoUriProblem('mongodb+srv://atlas_user:s3cret-pass@rejected.invalid/other_db', { production: true });
  assert(wrongName === 'MONGODB_URI must use the society_ledger database', 'Incorrect database name is rejected');
  assert(!wrongName.includes('s3cret-pass'), 'Database-name rejection omits credentials');
  await withEnv(productionEnv({ MONGODB_URI: undefined }), async () => {
    const result = await connectDB();
    assert(result === null, 'Production does not fall back to local MongoDB');
  });

  await withEnv(productionEnv({ JWT_SECRET: undefined, COOKIE_SECRET: undefined, CLIENT_URL: undefined }), async () => {
    let refused = false;
    try {
      createVercelHandler();
    } catch (error) {
      refused = error.code === 'PRODUCTION_ENV_INVALID'
        && /JWT_SECRET is required/.test(error.message)
        && /COOKIE_SECRET is required/.test(error.message)
        && /CLIENT_URL is required/.test(error.message);
    }
    assert(refused, 'Vercel entry refuses missing production secrets');
  });

  await withEnv(productionEnv({ JWT_SECRET: DEV_JWT, COOKIE_SECRET: DEV_COOKIE }), async () => {
    let refused = false;
    let message = '';
    try {
      createVercelHandler();
    } catch (error) {
      refused = error.code === 'PRODUCTION_ENV_INVALID';
      message = error.message;
    }
    assert(refused, 'Vercel entry refuses development secrets');
    assert(!message.includes(DEV_JWT) && !message.includes(DEV_COOKIE), 'Development-secret rejection omits the secret values');
    let jwtRefused = false;
    try {
      resolveSecret('JWT_SECRET');
    } catch (error) {
      jwtRefused = error.code === 'PRODUCTION_SECRET_INVALID' && !error.message.includes(DEV_JWT);
    }
    assert(jwtRefused, 'Authentication refuses a development JWT secret in production');
  });

  assert(resolveSecret('JWT_SECRET', { NODE_ENV: 'development' }) === DEV_JWT, 'Development JWT fallback remains available outside production');
  const devCookie = sessionCookieOptions({ NODE_ENV: 'development' });
  const prodCookie = sessionCookieOptions({ NODE_ENV: 'production' });
  assert(devCookie.httpOnly === true && devCookie.sameSite === 'lax' && devCookie.secure === false, 'Local session cookie is HttpOnly, Lax, and not Secure');
  assert(prodCookie.httpOnly === true && prodCookie.sameSite === 'lax' && prodCookie.secure === true, 'Production session cookie is HttpOnly, Lax, and Secure');

  console.log('\n--- CORS allowlist ---');
  const corsApp = createApp();
  const corsServer = http.createServer(corsApp);
  await new Promise((resolve) => corsServer.listen(0, '127.0.0.1', resolve));
  try {
    const blocked = await request(corsServer, '/api/health', { Origin: 'https://evil.example' });
    const allowOrigin = blocked.headers['access-control-allow-origin'];
    assert(allowOrigin !== 'https://evil.example', 'CORS does not reflect an unlisted origin');
  } finally {
    await new Promise((resolve) => corsServer.close(resolve));
  }

  console.log('\n--- Vercel process entry ---');
  const rejectedProcess = await runNode('api/index.js', productionEnv({
    JWT_SECRET: '',
    COOKIE_SECRET: '',
    CLIENT_URL: '',
  }));
  const rejectedOutput = `${rejectedProcess.stdout}\n${rejectedProcess.stderr}`;
  assert(rejectedProcess.code === 1, 'Vercel entry exits when production secrets are missing');
  assert(/JWT_SECRET is required/.test(rejectedOutput), 'Vercel entry reports the missing secret name');
  assert(!rejectedOutput.includes('API running'), 'Invalid Vercel entry does not start a listener');
  assert(!rejectedOutput.includes(JWT_SECRET), 'Vercel entry output does not include a configured secret');

  console.log('\n======================================================');
  console.log(`   Verification Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
  console.log('======================================================\n');
}

runTests().catch(async (err) => {
  console.error('\n❌ Vercel serverless verification failed:', err.message);
  try { await disconnectDB(); } catch { /* already closed */ }
  process.exit(1);
});
