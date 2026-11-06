import { mongoUriProblem } from './db.js';

const DEVELOPMENT_SECRETS = new Set([
  'society_ledger_dev_jwt_secret_change_in_production',
  'society_ledger_cookie_secret_dev',
  'society_ledger_dev_cookie_secret_change_in_production',
  'replace-with-a-long-random-jwt-secret',
  'replace-with-a-long-random-cookie-secret',
]);

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
