import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

/**
 * Authentication Middleware
 * Verifies JWT token from HttpOnly cookie `jwt_token` or `Authorization: Bearer <token>`.
 * Attaches authenticated user to `req.user`.
 */
export async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.jwt_token) {
      token = req.cookies.jwt_token;
    }
    // 2. Check Authorization Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.',
        data: null,
        errors: ['No authentication token provided'],
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET || 'society_ledger_dev_jwt_secret_change_in_production';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please sign in again.',
          data: null,
          errors: ['Token expired'],
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid session token. Please sign in again.',
        data: null,
        errors: ['Invalid token signature'],
      });
    }

    // Find user
    const user = await User.findById(decoded.id).populate('society');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account associated with this session no longer exists.',
        data: null,
        errors: ['User not found'],
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact society administration.',
        data: null,
        errors: ['Account deactivated'],
      });
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAfter && user.passwordChangedAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        message: 'Password was recently changed. Please sign in again.',
        data: null,
        errors: ['Password changed after token issued'],
      });
    }

    // Attach user to request
    req.user = user;
    req.societyId = user.society?._id || user.society;

    next();
  } catch (error) {
    next(error);
  }
}
