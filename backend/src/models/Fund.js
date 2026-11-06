import mongoose from 'mongoose';

/**
 * Fund Model
 * Represents a named financial reserve or account within a society.
 * Monetary balances are stored in integer PAISE to avoid floating-point errors.
 * (1 Rupee = 100 Paise)
 */
const FUND_TYPES = ['CORPUS', 'OPERATIONAL', 'SINKING', 'SPECIAL_PROJECT'];
const FUND_STATUSES = ['ACTIVE', 'CLOSED', 'SUSPENDED'];

const fundSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Fund name is required'],
      trim: true,
      maxlength: [200, 'Fund name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Fund code is required'],
      uppercase: true,
      trim: true,
      maxlength: [30, 'Fund code cannot exceed 30 characters'],
    },
    type: {
      type: String,
      required: [true, 'Fund type is required'],
      enum: {
        values: FUND_TYPES,
        message: 'Fund type must be one of: ' + FUND_TYPES.join(', '),
      },
    },
    purpose: {
      type: String,
      trim: true,
      maxlength: [1000, 'Purpose description cannot exceed 1000 characters'],
      default: null,
    },
    fiscalYear: {
      type: String,
      trim: true,
      default: null,
    },
    bankAccount: {
      // Stored as masked display value only, e.g. "HDFC Bank - A/C ****4891"
      type: String,
      trim: true,
      default: null,
    },
    // Opening balance in integer paise
    openingBalancePaise: {
      type: Number,
      required: [true, 'Opening balance is required'],
      min: [0, 'Opening balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be stored as integer paise',
      },
      default: 0,
    },
    // Current balance in integer paise. Updated by transaction write operations.
    currentBalancePaise: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be stored as integer paise',
      },
      default: 0,
    },
    restrictedUse: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: FUND_STATUSES,
      default: 'ACTIVE',
    },
    lastReconciledAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Society-scoped unique code constraint
fundSchema.index({ society: 1, code: 1 }, { unique: true });
fundSchema.index({ society: 1, type: 1 });
fundSchema.index({ society: 1, status: 1 });

// Virtual: current balance in rupees for display
fundSchema.virtual('currentBalanceRupees').get(function () {
  return this.currentBalancePaise / 100;
});
fundSchema.virtual('openingBalanceRupees').get(function () {
  return this.openingBalancePaise / 100;
});

const Fund = mongoose.model('Fund', fundSchema);
export { FUND_TYPES };
export default Fund;
