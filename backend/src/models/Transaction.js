import mongoose from 'mongoose';

/**
 * Transaction Model
 * Represents a single financial voucher entry in the general ledger.
 * Amounts are stored as integer PAISE. Transactions are immutable once posted;
 * corrections require an audited REVERSAL creating a paired offset entry.
 */
const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'];

const TRANSACTION_STATUSES = [
  'PENDING',
  'APPROVED',
  'PAID',
  'REJECTED',
  'REVERSED',
  'RECONCILED',
];

const PAYMENT_METHODS = ['NEFT_RTGS', 'UPI', 'CHEQUE', 'CARD', 'CASH'];

const transactionSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    fund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fund',
      required: [true, 'Fund reference is required'],
    },
    // Human-readable voucher reference, unique within a society
    reference: {
      type: String,
      required: [true, 'Voucher reference is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Reference cannot exceed 50 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Transaction date is required'],
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: TRANSACTION_TYPES,
        message: 'Type must be one of: ' + TRANSACTION_TYPES.join(', '),
      },
    },
    category: {
      type: String,
      trim: true,
      maxlength: [100, 'Category cannot exceed 100 characters'],
      default: null,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    // Amount in integer paise
    amountPaise: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be positive'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be stored as integer paise',
      },
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: 'Payment method must be one of: ' + PAYMENT_METHODS.join(', '),
      },
      default: null,
    },
    vendorName: {
      type: String,
      trim: true,
      maxlength: [200, 'Vendor name cannot exceed 200 characters'],
      default: null,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      maxlength: [100, 'Invoice number cannot exceed 100 characters'],
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: TRANSACTION_STATUSES,
        message: 'Status must be one of: ' + TRANSACTION_STATUSES.join(', '),
      },
      default: 'PENDING',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
    reconciliationReference: {
      type: String,
      trim: true,
      default: null,
    },
    // If this is a reversal, point to the original transaction
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    // Mandatory justification required when creating a reversal
    reversalJustification: {
      type: String,
      trim: true,
      maxlength: [1000, 'Justification cannot exceed 1000 characters'],
      default: null,
    },
    // For TRANSFER type: destination fund
    transferToFund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fund',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: null,
    },
    // Attached document references
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Core query indexes
transactionSchema.index({ society: 1, date: -1 });
transactionSchema.index({ society: 1, fund: 1, date: -1 });
transactionSchema.index({ society: 1, status: 1 });
transactionSchema.index({ society: 1, type: 1, date: -1 });
transactionSchema.index({ society: 1, reference: 1 }, { unique: true });

// Virtual: amount in rupees for display
transactionSchema.virtual('amountRupees').get(function () {
  return this.amountPaise / 100;
});

// Prevent physical deletion of any transaction
transactionSchema.pre('deleteOne', { document: true, query: false }, function (next) {
  next(new Error('Transaction records cannot be deleted. Use the reversal workflow.'));
});
transactionSchema.pre('deleteMany', function (next) {
  next(new Error('Transaction records cannot be bulk deleted.'));
});
transactionSchema.pre('findOneAndDelete', function (next) {
  next(new Error('Transaction records cannot be deleted. Use the reversal workflow.'));
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export { TRANSACTION_TYPES, TRANSACTION_STATUSES, PAYMENT_METHODS };
export default Transaction;
