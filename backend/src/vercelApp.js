import { createApp } from './app.js';
import { collectProductionEnvProblems } from './config/productionEnv.js';

/**
 * Problems that block the Vercel function. Names only, never secret values.
 * The function requires production mode in addition to the normal production checks.
 */
export function vercelProductionProblems(env = process.env) {
  if (env.NODE_ENV !== 'production') {
    return ['NODE_ENV=production is required'];
  }
  return collectProductionEnvProblems(env);
}

/**
 * Express app for one warm Vercel instance. This does not call listen.
 * Database connection starts on the first request and is reused after that.
 */
export function createVercelHandler(env = process.env) {
  const problems = vercelProductionProblems(env);
  if (problems.length > 0) {
    const error = new Error(`Production configuration is incomplete: ${problems.join('; ')}.`);
    error.code = 'PRODUCTION_ENV_INVALID';
    throw error;
  }
  return createApp({ ensureDatabase: true });
}
