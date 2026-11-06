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

/**
 * Connects to MongoDB with structured logging and event lifecycle handlers.
 */
export async function connectDB(uri) {
  const isProduction = process.env.NODE_ENV === 'production';
  const configured = (typeof uri === 'string' && uri.trim())
    ? uri.trim()
    : String(process.env.MONGODB_URI || '').trim();
  if (isProduction && !configured) {
    console.error('[MongoDB] Refusing to use the local database because MONGODB_URI is not set.');
    return null;
  }
  const mongoURI = configured || LOCAL_MONGODB_URI;
  const problem = mongoUriProblem(mongoURI, { production: isProduction });
  if (problem) {
    console.error(`[MongoDB] ${problem}`);
    return null;
  }
  const target = describeMongoTarget(mongoURI);

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

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Initial connection failure: ${redactMongoCredentials(error?.message)}`);
    console.error(`[MongoDB] Check that the database service is reachable at ${target}.`);
    // Don't kill process immediately in dev so health endpoint can report DB down status
    return null;
  }
}

/**
 * Gracefully disconnects from MongoDB
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  }
}
