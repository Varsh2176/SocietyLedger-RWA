/**
 * Private document storage. These tests do not call Vercel or Atlas.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'node:stream';
import {
  isPrivateBlobPath,
  maxDocumentBytes,
  openDocument,
  privateStorageConfigured,
  removeDocument,
  setDocumentBlobClient,
  storeDocument,
  usesObjectStorage,
} from '../src/storage/documentStorage.js';

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
    setDocumentBlobClient(null);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SocietyLedger: Private Document Storage');
  console.log('======================================================\n');

  assert(usesObjectStorage({ NODE_ENV: 'development' }) === false, 'Local development keeps filesystem storage');
  assert(usesObjectStorage({ NODE_ENV: 'production' }) === true, 'Production uses object storage');
  assert(maxDocumentBytes({ NODE_ENV: 'development' }) === 10 * 1024 * 1024, 'Local uploads remain limited to 10 MB');
  assert(maxDocumentBytes({ NODE_ENV: 'production' }) === 3 * 1024 * 1024, 'Production uploads stay within the function body limit');
  assert(privateStorageConfigured({ BLOB_STORE_ID: 'store_test' }) === true, 'A connected Blob store id configures private storage');
  assert(privateStorageConfigured({}) === false, 'Missing Blob configuration is detected');
  assert(isPrivateBlobPath('societies/society-id/minutes.pdf') === true, 'A society pathname is a private blob key');
  assert(isPrivateBlobPath('https://example.private.blob.vercel-storage.com/file.pdf') === false, 'A blob URL is not accepted as a storage key');
  assert(isPrivateBlobPath('../uploads/secret.pdf') === false, 'A path escape is not a private blob key');

  console.log('\n--- Production refuses local storage ---');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'society-docs-'));
  await withEnv({
    NODE_ENV: 'production',
    UPLOADS_DIR: tempRoot,
    BLOB_STORE_ID: undefined,
    BLOB_READ_WRITE_TOKEN: undefined,
  }, async () => {
    let refused = false;
    try {
      await storeDocument({ societyId: 'soc1', fileName: 'minutes.pdf', bytes: Buffer.from('minutes') });
    } catch (error) {
      refused = error.code === 'DOCUMENT_STORAGE_UNAVAILABLE';
    }
    assert(refused, 'Production upload fails when private storage is not configured');
    assert(fs.readdirSync(tempRoot).length === 0, 'Production does not write the local upload directory');
  });

  console.log('\n--- Private blob client ---');
  const saved = new Map();
  const fakeBlob = {
    async put(pathname, body, options) {
      assert(options.access === 'private', 'Uploads request private Blob access');
      assert(!String(pathname).includes('://'), 'Upload key is a pathname');
      saved.set(pathname, Buffer.from(body));
      return {
        pathname,
        url: 'https://example.private.blob.vercel-storage.com/secret.pdf',
      };
    },
    async get(pathname, options) {
      assert(options.access === 'private', 'Downloads request private Blob access');
      const body = saved.get(pathname);
      if (!body) return null;
      return { statusCode: 200, stream: Readable.toWeb(Readable.from(body)) };
    },
    async del(pathname) {
      saved.delete(pathname);
    },
  };

  await withEnv({ NODE_ENV: 'production', BLOB_STORE_ID: 'store_test' }, async () => {
    setDocumentBlobClient(fakeBlob);
    const storedPath = await storeDocument({
      societyId: 'soc1',
      fileName: 'minutes.pdf',
      bytes: Buffer.from('private minutes'),
    });
    assert(isPrivateBlobPath(storedPath), 'Stored key stays inside the society prefix');
    assert(!storedPath.includes('vercel-storage.com'), 'Stored key is not a public URL');
    const opened = await openDocument(storedPath);
    const chunks = [];
    for await (const chunk of opened) chunks.push(chunk);
    assert(Buffer.concat(chunks).toString() === 'private minutes', 'Authorized download reads the private object');
    await openDocument('https://example.private.blob.vercel-storage.com/secret.pdf').then((value) => {
      assert(value === null, 'A public blob URL cannot be opened');
    });
    await removeDocument(storedPath);
    assert(saved.size === 0, 'Delete removes the private object');
    assert(fs.readdirSync(tempRoot).length === 0, 'Private blob storage does not create a local file');
  });

  console.log('\n--- Vercel routing ---');
  const vercel = readJson('../../vercel.json');
  const render = fs.readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
  assert(vercel.services.web.root === 'frontend', 'Frontend service uses the Vite project');
  assert(vercel.services.web.rewrites[0].destination === '/index.html', 'React Router paths rewrite to index.html');
  assert(vercel.services.api.root === 'backend', 'API service uses the Express project');
  assert(vercel.services.api.entrypoint === 'api/index.js', 'API service uses the Vercel function entry');
  assert(vercel.services.api.framework === 'express', 'API service selects the Express framework');
  assert(vercel.regions[0] === 'bom1', 'Project functions run in Mumbai');
  assert(vercel.services.api.functions['api/index.js'].regions[0] === 'bom1', 'API region is Mumbai, next to the Atlas cluster');
  assert(vercel.rewrites[0].source === '/api/(.*)', 'API paths are routed before the site');
  assert(vercel.rewrites[0].destination.service === 'api', 'API paths reach the backend service');
  assert(vercel.rewrites[1].destination.service === 'web', 'Other paths reach the frontend service');
  assert(render.includes('npm start'), 'Render start command remains the local server');
  assert(render.includes('/var/data/uploads'), 'Render disk configuration remains in place');

  console.log('\n======================================================');
  console.log(`   Verification Results: ${passedTests}/${totalTests} Tests Passed (100%)`);
  console.log('======================================================\n');
}

runTests().catch((error) => {
  console.error('\n❌ Private document storage verification failed:', error.message);
  process.exit(1);
});
