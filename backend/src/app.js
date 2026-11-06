import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

function allowedBrowserOrigins() {
  const configured = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured;
}

export function createApp() {
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

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
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

  // Body and Cookie Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(process.env.COOKIE_SECRET || 'society_ledger_cookie_secret_dev'));

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
