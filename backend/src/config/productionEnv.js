import { mongoUriProblem } from './db.js';

const DEVELOPMENT_SECRETS = new Set([
  'society_ledger_dev_jwt_secret_change_in_production',
  'society_ledger_cookie_secret_dev',
  'society_ledger_dev_cookie_secret_change_in_production',
  'replace-with-a-long-random-jwt-secret',
  'replace-with-a-long-random-cookie-secret',
]);

const DEVELOPMENT_FALLBACKS = {
  JWT_SECRET: 'society_ledger_dev_jwt_secret_change_in_production',
  COOKIE_SECRET: 'society_ledger_cookie_secret_dev',
};

/**
 * Resolves a runtime secret. Production never receives a development fallback.
 * The thrown message names the variable and does not include the secret.
 */
export function resolveSecret(name, env = process.env) {
  const value = typeof env[name] === 'string' ? env[name].trim() : '';
  if (env.NODE_ENV === 'production') {
    if (!value || DEVELOPMENT_SECRETS.has(value)) {
      const error = new Error(`${name} is not valid for production`);
      error.code = 'PRODUCTION_SECRET_INVALID';
      throw error;
    }
    return value;
  }
  return value || DEVELOPMENT_FALLBACKS[name] || '';
}

/**
 * Production startup checks. Reports missing names only, never secret values.
 * Returns the problems instead of exiting so tests can inspect them.
 */
export function collectProductionEnvProblems(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];

  const problems = [];
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'COOKIE_SECRET', 'CLIENT_URL']) {
    if (!env[key] || !String(env[key]).trim()) {
      problems.push(`${key} is required`);
    }
  }

  if (env.MONGODB_URI && String(env.MONGODB_URI).trim()) {
    const databaseProblem = mongoUriProblem(env.MONGODB_URI, { production: true });
    if (databaseProblem) problems.push(databaseProblem);
  }

  const blobToken = typeof env.BLOB_READ_WRITE_TOKEN === 'string' ? env.BLOB_READ_WRITE_TOKEN.trim() : '';
  const blobStore = typeof env.BLOB_STORE_ID === 'string' && env.BLOB_STORE_ID.trim();
  const placeholderToken = blobToken === 'replace-with-the-private-blob-token';
  if (!blobStore && (!blobToken || placeholderToken)) {
    problems.push('BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN is required');
  }

  if (env.JWT_SECRET && DEVELOPMENT_SECRETS.has(env.JWT_SECRET)) {
    problems.push('JWT_SECRET is still a development default');
  }
  if (env.COOKIE_SECRET && DEVELOPMENT_SECRETS.has(env.COOKIE_SECRET)) {
    problems.push('COOKIE_SECRET is still a development default');
  }

  return problems;
}

/**
 * Production startup checks. Reports missing names only, never secret values.
 */
export function validateProductionEnv() {
  const problems = collectProductionEnvProblems();
  if (problems.length > 0) {
    console.error(`[Server] Production configuration is incomplete: ${problems.join('; ')}.`);
    process.exit(1);
  }
}
