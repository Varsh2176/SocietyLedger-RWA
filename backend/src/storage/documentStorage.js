import path from 'path';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function localUploadsDir() {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(__dirname, '../../uploads');
}

const BLOB_PREFIX = 'societies/';
const LOCAL_LIMIT = 10 * 1024 * 1024;
const PRODUCTION_LIMIT = 3 * 1024 * 1024;

let blobClient = null;

export function setDocumentBlobClient(client) {
  blobClient = client;
}

export function privateStorageConfigured(env = process.env) {
  const store = typeof env.BLOB_STORE_ID === 'string' && env.BLOB_STORE_ID.trim();
  const token = typeof env.BLOB_READ_WRITE_TOKEN === 'string' && env.BLOB_READ_WRITE_TOKEN.trim();
  return Boolean(store || token);
}

export function usesObjectStorage(env = process.env) {
  return env.NODE_ENV === 'production';
}

/**
 * Vercel rejects function bodies above 4.5 MB. Base64 JSON is larger than the file,
 * so production uploads stop at 3 MB. Local development and Render keep 10 MB.
 */
export function maxDocumentBytes(env = process.env) {
  return usesObjectStorage(env) ? PRODUCTION_LIMIT : LOCAL_LIMIT;
}

export function isPrivateBlobPath(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return false;
  if (!storagePath.startsWith(BLOB_PREFIX) || storagePath.includes('\\') || storagePath.includes('://')) return false;
  const parts = storagePath.split('/');
  return parts.length === 3 && parts.every((part) => part && part !== '.' && part !== '..');
}

function isLocalUploadPath(storagePath) {
  if (!storagePath || typeof storagePath !== 'string' || isPrivateBlobPath(storagePath)) return false;
  const root = path.resolve(localUploadsDir());
  const target = path.resolve(storagePath);
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeFileName(fileName) {
  const base = path.basename(fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}_${base}`.slice(0, 180);
}

async function loadBlob() {
  if (blobClient) return blobClient;
  return import('@vercel/blob');
}

function storageUnavailable() {
  const error = new Error('Private document storage is not configured.');
  error.code = 'DOCUMENT_STORAGE_UNAVAILABLE';
  return error;
}

/**
 * Saves bytes for one society. Production uses a private Blob pathname only.
 */
export async function storeDocument({ societyId, fileName, bytes }) {
  if (usesObjectStorage()) {
    if (!privateStorageConfigured()) throw storageUnavailable();
    const pathname = `${BLOB_PREFIX}${societyId}/${safeFileName(fileName)}`;
    const { put } = await loadBlob();
    const stored = await put(pathname, bytes, {
      access: 'private',
      addRandomSuffix: false,
    });
    const storedPath = stored?.pathname;
    if (!isPrivateBlobPath(storedPath)) {
      throw new Error('Private document storage did not return a private pathname.');
    }
    return storedPath;
  }

  const societyDir = path.join(localUploadsDir(), String(societyId));
  await fs.mkdir(societyDir, { recursive: true });
  const storageFilePath = path.join(societyDir, safeFileName(fileName));
  await fs.writeFile(storageFilePath, bytes);
  return storageFilePath;
}

/**
 * Opens a readable stream after the caller has authorized the document.
 * Production never reads the local upload directory.
 */
export async function openDocument(storagePath) {
  if (usesObjectStorage()) {
    if (!isPrivateBlobPath(storagePath)) return null;
    if (!privateStorageConfigured()) throw storageUnavailable();
    const { get } = await loadBlob();
    const result = await get(storagePath, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return Readable.fromWeb(result.stream);
  }

  if (!isLocalUploadPath(storagePath) || !existsSync(storagePath)) return null;
  return createReadStream(storagePath);
}

export async function removeDocument(storagePath) {
  if (!storagePath) return;
  if (usesObjectStorage()) {
    if (!isPrivateBlobPath(storagePath) || !privateStorageConfigured()) return;
    const { del } = await loadBlob();
    await del(storagePath);
    return;
  }
  if (isLocalUploadPath(storagePath) && existsSync(storagePath)) {
    await fs.unlink(storagePath);
  }
}
