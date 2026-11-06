import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes/index.js';
import { connectDB } from './config/db.js';
import { resolveSecret } from './config/productionEnv.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

function allowedBrowserOrigins() {
  const configured = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured;
}

function databaseUnavailable(res) {
  return res.status(503).json({
    success: false,
    message: 'Database connection unavailable',
    data: null,
    errors: ['Database connection unavailable'],
  });
}

/**
 * @param {{ ensureDatabase?: boolean }} [options]
 * ensureDatabase connects on the first request and reuses the warm connection.
 * The local server connects before listen instead, so its default stays false.
 */
export function createApp({ ensureDatabase = false } = {}) {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  // Security Headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS Configuration
  const allowedOrigins = allowedBrowserOrigins();
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (!isProduction && /^https?:\/\/localhost(?::\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Rate limiting. The memory store counts requests on this function instance only.
  // It is not a shared limit across Vercel instances. No external store is added here.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window on this instance
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests from this IP address. Please try again after 15 minutes.',
      data: null,
      errors: ['Rate limit exceeded'],
    },
  });
  app.use('/api', limiter);

  // Application body limit remains 10 MB for local development and Render.
  // Vercel Functions reject a request body above 4.5 MB before this parser runs.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(resolveSecret('COOKIE_SECRET')));

  if (ensureDatabase) {
    app.use(async (req, res, next) => {
      try {
        const database = await connectDB();
        if (!database) return databaseUnavailable(res);
        return next();
      } catch (error) {
        return next(error);
      }
    });
  }

  // Request Logging
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('tiny'));
  } else if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Mount API Endpoints
  app.use('/api', apiRouter);

  // Fallback 404 & Centralized Error Handler
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
