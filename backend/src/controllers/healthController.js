import mongoose from 'mongoose';

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Health check controller reporting server, database, and memory stats.
 */
export function getHealth(req, res) {
  const dbStateCode = mongoose.connection.readyState;
  const dbStatus = DB_STATES[dbStateCode] || 'unknown';
  const isHealthy = dbStateCode === 1;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'SocietyLedger API operational' : 'Database connection unavailable',
    data: {
      service: 'SocietyLedger Core API',
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        host: mongoose.connection.host || null,
        name: mongoose.connection.name || null,
        port: mongoose.connection.port || null,
      },
      memoryUsage: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    },
    errors: null,
  });
}
