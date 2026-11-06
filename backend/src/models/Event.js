import mongoose from 'mongoose';

/**
 * Event Model
 * Represents a community event with full budget lifecycle tracking:
 * proposed → approved → in_progress → completed → settled.
 * Budgets are stored as integer paise.
 */
const EVENT_STATUSES = [
  'PROPOSED',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'SETTLED',
  'CANCELLED',
];

const vendorQuotationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Vendor name cannot exceed 200 characters'],
    },
    quotationReference: {
      type: String,
      trim: true,
      maxlength: [100, 'Quotation reference cannot exceed 100 characters'],
      default: null,
    },
    // Bid amount in paise
    bidAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Bid amount must be stored as integer paise',
      },
    },
    status: {
      type: String,
      enum: ['PENDING', 'SELECTED', 'REJECTED'],
      default: 'PENDING',
    },
    isContractSigned: {
      type: Boolean,
      default: false,
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

const budgetLineSchema = new mongoose.Schema(
  {
    head: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Budget head cannot exceed 200 characters'],
    },
    proposedAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Must be integer paise' },
    },
    approvedAmountPaise: {
      type: Number,
      min: 0,
      validate: { validator: (val) => val == null || Number.isInteger(val), message: 'Must be integer paise' },
      default: null,
    },
    actualAmountPaise: {
      type: Number,
      min: 0,
      validate: { validator: (val) => val == null || Number.isInteger(val), message: 'Must be integer paise' },
      default: null,
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: null,
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: EVENT_STATUSES,
        message: 'Status must be one of: ' + EVENT_STATUSES.join(', '),
      },
      default: 'PROPOSED',
    },
    // All budget amounts in paise
    proposedBudgetPaise: {
      type: Number,
      required: [true, 'Proposed budget is required'],
      min: 0,
      validate: { validator: Number.isInteger, message: 'Must be integer paise' },
    },
    approvedBudgetPaise: {
      type: Number,
      min: 0,
      validate: { validator: (val) => val == null || Number.isInteger(val), message: 'Must be integer paise' },
      default: null,
    },
    actualExpenditurePaise: {
      type: Number,
      min: 0,
      validate: { validator: (val) => val == null || Number.isInteger(val), message: 'Must be integer paise' },
      default: null,
    },
    fundingSource: {
      type: String,
      trim: true,
      maxlength: [300, 'Funding source cannot exceed 300 characters'],
      default: null,
    },
    fundingFund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fund',
      default: null,
    },
    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Proposer reference is required'],
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
    approvalResolution: {
      // e.g. "Management Committee Resolution #2026/08"
      type: String,
      trim: true,
      maxlength: [200, 'Resolution reference cannot exceed 200 characters'],
      default: null,
    },
    selectedVendor: {
      type: mongoose.Schema.Types.ObjectId,
      // References a sub-document id in quotations array
      default: null,
    },
    quotations: [vendorQuotationSchema],
    budgetBreakdown: [budgetLineSchema],
    settlementReport: {
      type: String,
      trim: true,
      maxlength: [3000, 'Settlement report cannot exceed 3000 characters'],
      default: null,
    },
    settledAt: {
      type: Date,
      default: null,
    },
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

eventSchema.index({ society: 1, status: 1 });
eventSchema.index({ society: 1, date: -1 });

// Virtuals for display
eventSchema.virtual('proposedBudgetRupees').get(function () {
  return this.proposedBudgetPaise / 100;
});
eventSchema.virtual('approvedBudgetRupees').get(function () {
  return this.approvedBudgetPaise != null ? this.approvedBudgetPaise / 100 : null;
});
eventSchema.virtual('actualExpenditureRupees').get(function () {
  return this.actualExpenditurePaise != null ? this.actualExpenditurePaise / 100 : null;
});
eventSchema.virtual('unspentBalancePaise').get(function () {
  if (this.approvedBudgetPaise == null || this.actualExpenditurePaise == null) return null;
  return this.approvedBudgetPaise - this.actualExpenditurePaise;
});

const Event = mongoose.model('Event', eventSchema);
export { EVENT_STATUSES };
export default Event;
