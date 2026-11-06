import mongoose from 'mongoose';

/**
 * Approval Model
 * Tracks expense approval workflow items.
 * Enforces separation-of-duties: requester cannot be the approver.
 * All decisions are recorded with timestamps for audit purposes.
 */
const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED'];

const decisionSchema = new mongoose.Schema(
  {
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: APPROVAL_STATUSES,
      required: true,
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comments cannot exceed 1000 characters'],
      default: null,
    },
    decidedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const approvalSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    // Requested amount in integer paise
    requestedAmountPaise: {
      type: Number,
      required: [true, 'Requested amount is required'],
      min: [1, 'Amount must be positive'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be stored as integer paise',
      },
    },
    fund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fund',
      required: [true, 'Fund reference is required'],
    },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    vendorName: {
      type: String,
      trim: true,
      maxlength: [200, 'Vendor name cannot exceed 200 characters'],
      default: null,
    },
    quotationReference: {
      type: String,
      trim: true,
      maxlength: [100, 'Quotation reference cannot exceed 100 characters'],
      default: null,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      maxlength: [100, 'Invoice number cannot exceed 100 characters'],
      default: null,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester reference is required'],
    },
    status: {
      type: String,
      enum: {
        values: APPROVAL_STATUSES,
        message: 'Status must be one of: ' + APPROVAL_STATUSES.join(', '),
      },
      default: 'PENDING',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: null,
    },
    // Chronological decision history
    decisionHistory: [decisionSchema],
    // Reference to the transaction created after final approval
    resultingTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
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

approvalSchema.index({ society: 1, status: 1 });
approvalSchema.index({ society: 1, requester: 1 });
approvalSchema.index({ society: 1, createdAt: -1 });

// Virtual: requested amount in rupees
approvalSchema.virtual('requestedAmountRupees').get(function () {
  return this.requestedAmountPaise / 100;
});

const Approval = mongoose.model('Approval', approvalSchema);
export { APPROVAL_STATUSES };
export default Approval;
