import jwt from 'jsonwebtoken';
import { User, Society, AuditLog } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'society_ledger_dev_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

/**
 * Generate signed JWT token
 */
function generateToken(user) {
  const societyId = (user.society?._id || user.society).toString();
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      society: societyId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Set HttpOnly cookie for session token
 */
function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    // Separate frontend and API hosts require a cross-site cookie.
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}

function setTokenCookie(res, token) {
  res.cookie('jwt_token', token, {
    ...sessionCookieOptions(),
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
}

function registrationText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Field-specific registration checks. A client-supplied role or society id is ignored.
 */
function registrationFieldErrors(body) {
  const errors = [];
  const name = registrationText(body?.name);
  const email = registrationText(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  const phone = registrationText(body?.phone);
  const apartmentNumber = registrationText(body?.apartmentNumber);
  const societyCode = registrationText(body?.societyCode);

  if (!name) errors.push({ field: 'name', message: 'Full name is required.' });
  if (!email) {
    errors.push({ field: 'email', message: 'Email address is required.' });
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.push({ field: 'email', message: 'Please provide a valid email address.' });
  }
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else if (password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters long.' });
  }
  if (!phone) {
    errors.push({ field: 'phone', message: 'Phone number is required.' });
  } else if (phone.replace(/\D/g, '').length < 10) {
    errors.push({ field: 'phone', message: 'Please enter a valid phone number (10+ digits).' });
  }
  if (!apartmentNumber) {
    errors.push({ field: 'apartmentNumber', message: 'Apartment/flat number is required.' });
  }
  if (!societyCode) {
    errors.push({ field: 'societyCode', message: 'Society invitation code is required.' });
  }

  return errors;
}

/**
 * Register a new resident user account
 * Enforces:
 * - Privilege escalation prevention: Role is strictly locked to 'Resident'
 * - Mandatory society code lookup
 */
export async function register(req, res, next) {
  try {
    const fieldErrors = registrationFieldErrors(req.body);
    if (fieldErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: fieldErrors.length === 1
          ? fieldErrors[0].message
          : 'Please correct the highlighted registration fields.',
        data: null,
        errors: fieldErrors,
      });
    }

    const name = registrationText(req.body.name);
    const email = registrationText(req.body.email);
    const phone = registrationText(req.body.phone);
    const apartmentNumber = registrationText(req.body.apartmentNumber);
    const societyCode = registrationText(req.body.societyCode);
    const password = req.body.password;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
        data: null,
        errors: ['Email address is already registered'],
      });
    }

    // Lookup society by invitation code
    const society = await Society.findOne({
      code: societyCode.trim().toUpperCase(),
      isActive: true,
    });

    if (!society) {
      return res.status(404).json({
        success: false,
        message: 'Invalid society invitation code. Please verify with your RWA administration.',
        data: null,
        errors: [{
          field: 'societyCode',
          message: 'Invalid society invitation code. Please verify with your RWA administration.',
        }],
      });
    }

    // Create user - explicitly enforce 'Resident' role to prevent privilege escalation
    const newUser = await User.create({
      name,
      email: normalizedEmail,
      passwordHash: password, // Pre-save hook hashes with bcrypt (salt rounds 12)
      phone,
      apartmentNumber: apartmentNumber.toUpperCase(),
      role: 'Resident', // Client-supplied roles are never applied
      society: society._id,
      verificationStatus: 'PENDING', // Registration does not verify the resident
    });

    // Populate society for response
    await newUser.populate('society');

    const token = generateToken(newUser);
    setTokenCookie(res, token);

    // Audit log
    await AuditLog.create({
      society: society._id,
      actor: newUser._id,
      action: 'REGISTER',
      entityType: 'USER',
      entityId: newUser._id,
      details: `New resident account registered: ${newUser.name} (${newUser.email}) for Unit ${newUser.apartmentNumber || 'N/A'}`,
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. You are signed in, and resident verification is still pending.',
      data: {
        user: newUser,
        accessToken: token,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticate existing member
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
        data: null,
        errors: ['Missing login credentials'],
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user with password hash selected
    const user = await User.findOne({ email: normalizedEmail })
      .select('+passwordHash')
      .populate('society');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        data: null,
        errors: ['Authentication failed'],
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact society management.',
        data: null,
        errors: ['Account deactivated'],
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        data: null,
        errors: ['Authentication failed'],
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    setTokenCookie(res, token);

    // Audit log login
    await AuditLog.create({
      society: user.society?._id || user.society,
      actor: user._id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user._id,
      details: `User signed in: ${user.name} (${user.role})`,
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user,
        accessToken: token,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Terminate active session and clear cookie
 */
export async function logout(req, res) {
  res.clearCookie('jwt_token', sessionCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
    data: null,
    errors: null,
  });
}

/**
 * Restore current session from authenticated request
 */
export async function getMe(req, res) {
  res.status(200).json({
    success: true,
    message: 'User profile retrieved.',
    data: {
      user: req.user,
    },
    errors: null,
  });
}

/**
 * Refresh session credentials
 */
export async function refreshToken(req, res) {
  const token = generateToken(req.user);
  setTokenCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Session refreshed.',
    data: {
      user: req.user,
      accessToken: token,
    },
    errors: null,
  });
}
