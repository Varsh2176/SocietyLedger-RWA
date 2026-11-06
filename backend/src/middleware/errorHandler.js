import { redactMongoCredentials } from '../config/db.js';

/**
 * Centralized Global Error Handler Middleware
 * Adheres strictly to docs/api-contract.md response envelope:
 * { success: false, message: string, data: null, errors: array | null }
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Mongoose validation error
  let errors = err.errors || null;
  let message = redactMongoCredentials(err.message || 'An unexpected internal server error occurred');

  if (err.name === 'ValidationError') {
    message = 'Validation failed for one or more fields';
    errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
  }

  // Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for unique property: ${field}`;
    errors = [{ field, message }];
  }

  // CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    message = `Resource not found with specified identifier: ${err.value}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid authentication token signature';
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Authentication session has expired. Please sign in again';
  }

  // Log critical 500 server errors
  if (statusCode >= 500) {
    console.error(
      `[Server Error] ${req.method} ${req.originalUrl} - ${redactMongoCredentials(err.message || 'unknown error')}`
    );
  }

  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    errors: errors || (process.env.NODE_ENV === 'development' ? [err.stack] : null),
  });
}
