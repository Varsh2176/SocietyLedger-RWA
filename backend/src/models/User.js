import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Model
 * Represents every authenticated member of a society.
 * A user belongs to exactly one society and has a single role within it.
 * Passwords are hashed with bcrypt; plaintext is never persisted.
 */
const USER_ROLES = [
  'Society Administrator',
  'Treasurer',
  'Committee Member',
  'Auditor',
  'Resident',
];

const VERIFICATION_STATUS = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never returned in queries by default
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    apartmentNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: 'Role must be one of: ' + USER_ROLES.join(', '),
      },
      default: 'Resident',
    },
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society association is required'],
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUS,
      default: 'PENDING',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Used to invalidate tokens on password change or logout
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // Ensure passwordHash never leaks into JSON output
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient society-scoped queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ society: 1, role: 1 });
userSchema.index({ society: 1, verificationStatus: 1 });
userSchema.index({ society: 1, apartmentNumber: 1 });

/**
 * Hash password before save if modified
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Compare supplied plaintext password against stored hash.
 * Call this on a user instance retrieved with +passwordHash selected.
 */
userSchema.methods.comparePassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash);
};

/**
 * Returns true if JWT was issued before the most recent password change
 */
userSchema.methods.passwordChangedAfter = function (jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return changedTimestamp > jwtIssuedAt;
};

const User = mongoose.model('User', userSchema);
export { USER_ROLES };
export default User;
