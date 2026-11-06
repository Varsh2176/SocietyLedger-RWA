import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB, disconnectDB, redactMongoCredentials } from './config/db.js';
import { validateProductionEnv } from './config/productionEnv.js';

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

async function startServer() {
  validateProductionEnv();

  console.log('----------------------------------------------------');
  console.log('   SocietyLedger Backend Service Initializing...   ');
  console.log('----------------------------------------------------');

  const database = await connectDB();
  if (process.env.NODE_ENV === 'production' && !database) {
    console.error('[Server] Refusing to start without a database connection.');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(PORT, HOST, () => {
    console.log(`[Server] SocietyLedger API running on ${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`[Server] Health check endpoint: /api/health`);
    console.log(`[Server] Allowed browser origins: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log('----------------------------------------------------');
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Commencing graceful shutdown...`);
    server.close(async () => {
      console.log('[Server] HTTP listener closed.');
      await disconnectDB();
      console.log('[Server] Process exited gracefully.');
      process.exit(0);
    });

    // Force exit if shutdown takes longer than 10s
    setTimeout(() => {
      console.error('[Server] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason || 'unknown rejection');
    console.error('[Server] Unhandled promise rejection:', redactMongoCredentials(message));
  });

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', redactMongoCredentials(err?.message || 'unknown exception'));
    shutdown('UNCAUGHT_EXCEPTION');
  });

  return server;
}

// Start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup failure:', redactMongoCredentials(err?.message || 'unknown startup error'));
    process.exit(1);
  });
}
