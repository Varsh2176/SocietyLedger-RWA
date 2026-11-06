import mongoose from 'mongoose';

/**
 * ResidentQuery Model
 * Tracks questions submitted by residents to the management committee
 * through the transparency portal.
 * Lifecycle: OPEN → IN_PROGRESS → ANSWERED → RESOLVED
 */
const QUERY_STATUSES = ['OPEN', 'IN_PROGRESS', 'ANSWERED', 'RESOLVED'];

const QUERY_CATEGORIES = [
  'Maintenance Billing',
  'Fund Utilization',
  'Event Budget',
  'Audit Report',
  'Committee Decision',
  'Vendor Selection',
  'Compliance Filing',
  'General',
  'Other',
];

const responseSchema = new mongoose.Schema(
  {
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    response: {
      type: String,
      required: true,
      trim: true,
      maxlength: [3000, 'Response cannot exceed 3000 characters'],
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
    isOfficialResponse: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const residentQuerySchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Submitter reference is required'],
    },
    reference: {
      type: String,
      trim: true,
      maxlength: [50, 'Reference code cannot exceed 50 characters'],
      default: null,
    },
    // Unit/flat number for display context
    unit: {
      type: String,
      trim: true,
      maxlength: [50, 'Unit cannot exceed 50 characters'],
      default: null,
    },
    category: {
      type: String,
      enum: {
        values: QUERY_CATEGORIES,
        message: 'Category must be one of: ' + QUERY_CATEGORIES.join(', '),
      },
      required: [true, 'Category is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [300, 'Subject cannot exceed 300 characters'],
    },
    question: {
      type: String,
      required: [true, 'Question is required'],
      trim: true,
      maxlength: [3000, 'Question cannot exceed 3000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: QUERY_STATUSES,
        message: 'Status must be one of: ' + QUERY_STATUSES.join(', '),
      },
      default: 'OPEN',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    responses: [responseSchema],
    resolutionDetails: {
      type: String,
      trim: true,
      maxlength: [2000, 'Resolution details cannot exceed 2000 characters'],
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Related transparency items
    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

residentQuerySchema.index({ society: 1, status: 1 });
residentQuerySchema.index({ society: 1, submittedBy: 1 });
residentQuerySchema.index({ society: 1, category: 1 });
residentQuerySchema.index({ society: 1, createdAt: -1 });

const ResidentQuery = mongoose.model('ResidentQuery', residentQuerySchema);
export { QUERY_STATUSES, QUERY_CATEGORIES };
export default ResidentQuery;
