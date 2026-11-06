import mongoose from 'mongoose';

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/society_ledger';

export const REQUIRED_DATABASE_NAME = 'society_ledger';

/**
 * First database path segment. An empty string means the URI has no database name.
 * Unparseable values are indistinguishable from a missing name and are never returned.
 */
export function mongoDatabaseName(uri) {
  if (!uri || typeof uri !== 'string') return '';
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') return '';
    const segment = parsed.pathname.replace(/^\//, '').split('/')[0] || '';
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

export function isAtlasMongoUri(uri) {
  return /mongodb\+srv:|\.mongodb\.net/i.test(uri || '');
}

/**
 * Credential-free reason to refuse a connection, or null when the URI may be used.
 * Production must name society_ledger. An Atlas URI must do so in every environment.
 * Local development URIs are left unchanged.
 */
export function mongoUriProblem(uri, { production = false } = {}) {
  const atlas = isAtlasMongoUri(uri);
  if (!production && !atlas) return null;
  if (!uri || !String(uri).trim()) {
    return 'MONGODB_URI is required in production';
  }
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    return 'MONGODB_URI must include the society_ledger database name';
  }
  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    return 'MONGODB_URI must include the society_ledger database name';
  }
  const name = mongoDatabaseName(uri);
  if (!name) return 'MONGODB_URI must include the society_ledger database name';
  if (name !== REQUIRED_DATABASE_NAME) return 'MONGODB_URI must use the society_ledger database';
  return null;
}

/**
 * Host and database name only. Usernames and passwords are never included.
 */
export function describeMongoTarget(uri) {
  if (!uri || typeof uri !== 'string') return 'configured MongoDB target';
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
      return 'configured MongoDB target';
    }
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'default';
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${parsed.hostname}${port}/${database}`;
  } catch {
    return 'configured MongoDB target';
  }
}

/**
 * Removes connection strings and user:password pairs from a driver error.
 */
export function redactMongoCredentials(message) {
  if (!message || typeof message !== 'string') return 'Database connection failed.';
  const redacted = message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'")]+/gi, (match) => describeMongoTarget(match))
    .replace(/\/\/[^/\s:@]+:[^@\s/]+@/g, '//');
  return redacted.trim() || 'Database connection failed.';
}

const DEFAULT_POOL_SIZE = 5;
const MAX_CONFIGURABLE_POOL_SIZE = 20;

let listenersAttached = false;
let activeConnection = null;

/**
 * Serverless instances should not open the driver's default 100-connection pool.
 * MONGODB_MAX_POOL_SIZE overrides the default of 5, up to 20.
 */
export function mongoPoolSize(env = process.env) {
  const parsed = Number(env.MONGODB_MAX_POOL_SIZE);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_CONFIGURABLE_POOL_SIZE) {
    return parsed;
  }
  return DEFAULT_POOL_SIZE;
}

function resolveMongoUri(uri) {
  const isProduction = process.env.NODE_ENV === 'production';
  const configured = (typeof uri === 'string' && uri.trim())
    ? uri.trim()
    : String(process.env.MONGODB_URI || '').trim();
  if (isProduction && !configured) {
    return { error: 'Refusing to use the local database because MONGODB_URI is not set.' };
  }
  const mongoURI = configured || LOCAL_MONGODB_URI;
  const problem = mongoUriProblem(mongoURI, { production: isProduction });
  if (problem) return { error: problem };
  return { uri: mongoURI };
}

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    const port = mongoose.connection.port ? `:${mongoose.connection.port}` : '';
    const host = mongoose.connection.host || 'unknown host';
    const name = mongoose.connection.name || 'unknown database';
    console.log(`[MongoDB] Connected successfully to: ${host}${port}/${name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB] Connection error occurred: ${redactMongoCredentials(err?.message)}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection lost. Reconnecting...');
  });
}

/**
 * Connects to MongoDB once per warm process. Concurrent callers share one attempt.
 * A failed attempt clears the cache so a later request can retry.
 */
export async function connectDB(uri) {
  const resolved = resolveMongoUri(uri);
  if (resolved.error) {
    console.error(`[MongoDB] ${resolved.error}`);
    return null;
  }
  const mongoURI = resolved.uri;

  if (activeConnection && activeConnection.uri === mongoURI && mongoose.connection.readyState !== 0) {
    return activeConnection.promise;
  }

  if (activeConnection && activeConnection.uri !== mongoURI) {
    await activeConnection.promise.catch(() => null);
  }

  if (activeConnection && activeConnection.uri === mongoURI && mongoose.connection.readyState !== 0) {
    return activeConnection.promise;
  }

  attachConnectionListeners();
  const target = describeMongoTarget(mongoURI);
  const promise = mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: mongoPoolSize(),
  }).then((conn) => conn).catch((error) => {
    if (activeConnection?.promise === promise) activeConnection = null;
    console.error(`[MongoDB] Initial connection failure: ${redactMongoCredentials(error?.message)}`);
    console.error(`[MongoDB] Check that the database service is reachable at ${target}.`);
    return null;
  });
  activeConnection = { uri: mongoURI, promise };
  return promise;
}

/**
 * Gracefully disconnects from MongoDB and allows the next call to connect again.
 */
export async function disconnectDB() {
  activeConnection = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  }
}
