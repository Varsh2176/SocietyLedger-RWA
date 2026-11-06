import mongoose from 'mongoose';

/**
 * Reconciliation Model
 * Records a bank statement reconciliation exercise for a society fund/account.
 * 
 * FINANCIAL & VERIFICATION RULES:
 * - Both statement and book balances are stored in integer paise.
 * - Comparing statement and ledger balances does NOT alter ledger transactions.
 * - Finalized reconciliations are immutable; they cannot be silently overwritten or modified.
 * - Discrepancies are categorized as automated flags until confirmed by an authorized auditor.
 */

const RECONCILIATION_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'RECONCILED',
  'DISCREPANCY_UNRESOLVED',
];

const MATCH_STATUSES = ['UNMATCHED', 'MATCHED', 'FLAGGED'];

const DISCREPANCY_TYPES = [
  'UNMATCHED_STATEMENT',
  'UNMATCHED_LEDGER',
  'AMOUNT_MISMATCH',
  'DUPLICATE_REFERENCE',
  'DATE_DISCREPANCY',
  'UNEXPLAINED_BALANCE',
];

const DISCREPANCY_STATUSES = ['OPEN', 'RESOLVED', 'ACCEPTED_DISCREPANCY'];

const statementTransactionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    reference: {
      type: String,
      trim: true,
      maxlength: [100, 'Reference cannot exceed 100 characters'],
      default: null,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Must be integer paise' },
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    status: {
      type: String,
      enum: MATCH_STATUSES,
      default: 'UNMATCHED',
    },
    matchedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    matchConfidence: {
      type: String,
      enum: ['MANUAL', 'EXACT_REF_AND_AMOUNT', 'AMOUNT_AND_DATE', 'LOW', null],
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null,
    },
  },
  { _id: true }
);

const discrepancySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    type: {
      type: String,
      enum: DISCREPANCY_TYPES,
      required: true,
    },
    severity: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    amountPaise: {
      type: Number,
      validate: { validator: (val) => val == null || Number.isInteger(val), message: 'Must be integer paise' },
      default: null,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
      default: null,
    },
    correctiveAction: {
      type: String,
      trim: true,
      maxlength: [1000, 'Corrective action cannot exceed 1000 characters'],
      default: null,
    },
    responsiblePerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: DISCREPANCY_STATUSES,
      default: 'OPEN',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const unmatchedEntrySchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true,
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: 'Must be integer paise' },
    },
    type: {
      type: String,
      enum: ['BANK_ONLY', 'LEDGER_ONLY'],
      required: true,
    },
    date: {
      type: Date,
      default: null,
    },
    resolution: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const reconciliationSchema = new mongoose.Schema(
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
      index: true,
    },
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      maxlength: [200, 'Account name cannot exceed 200 characters'],
    },
    statementPeriodStart: {
      type: Date,
      required: [true, 'Statement period start date is required'],
    },
    statementPeriodEnd: {
      type: Date,
      required: [true, 'Statement period end date is required'],
    },
    statementOpeningBalancePaise: {
      type: Number,
      validate: { validator: (val) => val == null || Number.isInteger(val), message: 'Must be integer paise' },
      default: 0,
    },
    statementClosingBalancePaise: {
      type: Number,
      required: [true, 'Statement closing balance is required'],
      validate: { validator: Number.isInteger, message: 'Must be integer paise' },
    },
    bookOpeningBalancePaise: {
      type: Number,
      validate: { validator: (val) => val == null || Number.isInteger(val), message: 'Must be integer paise' },
      default: 0,
    },
    bookClosingBalancePaise: {
      type: Number,
      required: [true, 'Book closing balance is required'],
      validate: { validator: Number.isInteger, message: 'Must be integer paise' },
    },
    status: {
      type: String,
      enum: {
        values: RECONCILIATION_STATUSES,
        message: 'Status must be one of: ' + RECONCILIATION_STATUSES.join(', '),
      },
      default: 'PENDING',
      index: true,
    },
    isFinalized: {
      type: Boolean,
      default: false,
      index: true,
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Preparer reference is required'],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
    matchedTransactionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    statementTransactions: [statementTransactionSchema],
    discrepancies: [discrepancySchema],
    unmatchedEntries: [unmatchedEntrySchema],
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reconciliationSchema.index({ society: 1, status: 1 });
reconciliationSchema.index({ society: 1, fund: 1, statementPeriodEnd: -1 });

// Virtuals
reconciliationSchema.virtual('differenceAmountPaise').get(function () {
  return this.statementClosingBalancePaise - this.bookClosingBalancePaise;
});
reconciliationSchema.virtual('differenceAmountRupees').get(function () {
  return this.differenceAmountPaise / 100;
});
reconciliationSchema.virtual('statementClosingBalanceRupees').get(function () {
  return this.statementClosingBalancePaise / 100;
});
reconciliationSchema.virtual('bookClosingBalanceRupees').get(function () {
  return this.bookClosingBalancePaise / 100;
});

// Protect finalized reconciliations from being modified
reconciliationSchema.pre('save', async function (next) {
  if (!this.isNew) {
    const existing = await this.constructor.findById(this._id).select('isFinalized');
    if (existing && existing.isFinalized && !this.isModified('isFinalized')) {
      return next(new Error('Finalized reconciliation records are immutable and cannot be modified.'));
    }
  }
  next();
});

const Reconciliation = mongoose.model('Reconciliation', reconciliationSchema);
export {
  RECONCILIATION_STATUSES,
  MATCH_STATUSES,
  DISCREPANCY_TYPES,
  DISCREPANCY_STATUSES,
};
export default Reconciliation;
