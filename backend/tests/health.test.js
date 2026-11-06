/**
 * Backend Health & Route Registration Integration Test
 * Verifies Express app bootstrap, MongoDB connectivity, and standard JSON envelope.
 */

import 'dotenv/config';
import http from 'http';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

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

async function request(server, path, method = 'GET') {
  const address = server.address();
  const port = address.port;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = body ? JSON.parse(body) : null;
            resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
          } catch {
            resolve({ statusCode: res.statusCode, headers: res.headers, body });
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger Backend Phase 2: Health Verification');
  console.log('======================================================\n');

  // 1. Database Connection
  console.log('--- 1. MongoDB Connection Setup ---');
  const conn = await connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger');
  assert(conn !== null, 'MongoDB successfully connected to local service');
  assert(conn.connection.readyState === 1, 'MongoDB connection readyState is 1 (Connected)');

  // 2. Start Test Server Instance
  console.log('\n--- 2. Express Server Initialization ---');
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Test server dynamically listening on port ${port}`);

  try {
    // 3. Health Check Endpoint
    console.log('\n--- 3. GET /api/health Endpoint ---');
    const healthRes = await request(server, '/api/health');
    assert(healthRes.statusCode === 200, 'GET /api/health returns HTTP 200 OK');
    assert(healthRes.body.success === true, 'Response conforms to standard success envelope');
    assert(healthRes.body.data.service === 'SocietyLedger Core API', 'Correct service identifier reported');
    assert(healthRes.body.data.database.status === 'connected', 'Database reported as connected in health check');
    assert(typeof healthRes.body.data.uptimeSeconds === 'number', 'Uptime metric returned');

    // 4. 404 Route Not Found Handling
    console.log('\n--- 4. 404 Not Found Handling ---');
    const notFoundRes = await request(server, '/api/unregistered-route-xyz');
    assert(notFoundRes.statusCode === 404, 'Unknown endpoint returns HTTP 404');
    assert(notFoundRes.body.success === false, 'Error follows standard success: false envelope');
    assert(notFoundRes.body.message.includes('Resource endpoint not found'), 'Helpful error message returned');

    // 5. Future Module Stub Handlers
    console.log('\n--- 5. Future Module Stub Route Registration ---');
    const stubRes = await request(server, '/api/future-roadmap');
    assert(stubRes.statusCode === 501, 'Future endpoint returns HTTP 501 Not Implemented');
    assert(stubRes.body.success === false, 'Stub follows standard envelope');
    assert(stubRes.body.message.includes('scheduled for subsequent'), 'Stub provides clear roadmap explanation');

    console.log('\n======================================================');
    console.log(`   Verification Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
    console.log('======================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Backend Health Verification Failed:', err);
  process.exit(1);
});
