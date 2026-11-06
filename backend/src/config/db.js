import mongoose from 'mongoose';

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/society_ledger';

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
  const mongoURI = uri || process.env.MONGODB_URI || LOCAL_MONGODB_URI;
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
