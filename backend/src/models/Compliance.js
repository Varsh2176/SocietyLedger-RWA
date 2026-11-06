import mongoose from 'mongoose';

/**
 * Compliance Model
 * Tracks statutory filings, tax compliance, and regulatory deadlines for a society.
 * 
 * IMPORTANT COMPLIANCE RULES:
 * - Operates as an administrative tracking tool, not professional tax/legal advice.
 * - Deadlines must have an identifiable source or administrator confirmation.
 * - Saving a draft never marks a task as submitted or filed.
 * - Lifecycle status transitions require appropriate audit trail and verification records.
 */

const COMPLIANCE_STATUSES = [
  'PENDING',
  'UNDER_REVIEW',
  'FILED',
  'OVERDUE',
  'CORRECTION_REQUIRED',
  'REVISED_FILED',
];

const COMPLIANCE_CATEGORIES = [
  'TAX_DIRECT',          // e.g. TDS Quarterly Returns (Form 24Q, 26Q), ITR-7
  'TAX_INDIRECT',        // e.g. GSTR-3B, GSTR-1, GSTR-7 (GST-TDS)
  'REGISTRAR_SOCIETIES', // e.g. Annual Returns (Form V), Governing Body List
  'SAFETY_MUNICIPAL',    // e.g. Lift Fitness Certificate, Fire Safety NOC
  'OTHER',               // e.g. Pollution Control Board, Water Tanker Hygiene Cert
];

const PREPARATION_STATUSES = [
  'NOT_STARTED',
  'IN_PREPARATION',
  'PREPARED',
  'REVISION_NEEDED',
];

const REVIEW_STATUSES = [
  'NOT_REVIEWED',
  'UNDER_REVIEW',
  'APPROVED',
  'CHANGES_REQUESTED',
];

const DOCUMENTATION_STATUSES = [
  'COMPLETE',
  'INCOMPLETE',
  'PENDING_VERIFICATION',
];

const DOCUMENT_TYPES = [
  'ACKNOWLEDGEMENT',
  'CHALLAN',
  'RETURN_FORM',
  'SUPPORTING_SCHEDULE',
  'CORRECTION_REQUEST',
  'OTHER',
];

const COMPLIANCE_DISCLAIMER =
  'This compliance tracker is an administrative and governance record-keeping tool. Deadlines reflect administrator configurations and statutory reference sources. It does not constitute certified legal counsel or statutory audit certification.';

const documentAttachmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    documentType: {
      type: String,
      enum: DOCUMENT_TYPES,
      default: 'OTHER',
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [255, 'Filename cannot exceed 255 characters'],
    },
    fileUrl: {
      type: String,
      trim: true,
      maxlength: [1000, 'File URL cannot exceed 1000 characters'],
      default: null,
    },
    fileSize: {
      type: Number,
      min: 0,
      default: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: COMPLIANCE_STATUSES,
      required: true,
    },
    toStatus: {
      type: String,
      enum: COMPLIANCE_STATUSES,
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Action description cannot exceed 100 characters'],
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comments cannot exceed 1000 characters'],
      default: null,
    },
  },
  { _id: true }
);

const complianceSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    filingType: {
      type: String,
      required: [true, 'Filing or return type is required'],
      trim: true,
      maxlength: [200, 'Filing type cannot exceed 200 characters'],
    },
    category: {
      type: String,
      enum: {
        values: COMPLIANCE_CATEGORIES,
        message: 'Category must be one of: ' + COMPLIANCE_CATEGORIES.join(', '),
      },
      default: 'OTHER',
      index: true,
    },
    statutoryBody: {
      type: String,
      required: [true, 'Statutory or regulatory body is required'],
      trim: true,
      maxlength: [200, 'Statutory body cannot exceed 200 characters'],
    },
    financialPeriod: {
      type: String,
      required: [true, 'Financial period is required'],
      trim: true,
      maxlength: [100, 'Financial period cannot exceed 100 characters'],
    },
    deadline: {
      type: Date,
      required: [true, 'Filing deadline is required'],
      index: true,
    },
    deadlineSource: {
      type: String,
      trim: true,
      maxlength: [300, 'Deadline source cannot exceed 300 characters'],
      default: 'Administrator Confirmed Calendar',
    },
    status: {
      type: String,
      enum: {
        values: COMPLIANCE_STATUSES,
        message: 'Status must be one of: ' + COMPLIANCE_STATUSES.join(', '),
      },
      default: 'PENDING',
      index: true,
    },
    preparationStatus: {
      type: String,
      enum: PREPARATION_STATUSES,
      default: 'NOT_STARTED',
    },
    reviewStatus: {
      type: String,
      enum: REVIEW_STATUSES,
      default: 'NOT_REVIEWED',
    },
    documentationStatus: {
      type: String,
      enum: DOCUMENTATION_STATUSES,
      default: 'INCOMPLETE',
    },
    responsiblePerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submissionDate: {
      type: Date,
      default: null,
    },
    acknowledgementReference: {
      type: String,
      trim: true,
      maxlength: [200, 'Acknowledgement reference cannot exceed 200 characters'],
      default: null,
    },
    challanReference: {
      type: String,
      trim: true,
      maxlength: [100, 'Challan reference cannot exceed 100 characters'],
      default: null,
    },
    challanAmountPaise: {
      type: Number,
      min: 0,
      validate: {
        validator: (val) => val == null || Number.isInteger(val),
        message: 'Challan amount must be integer paise',
      },
      default: null,
    },
    challanDate: {
      type: Date,
      default: null,
    },
    penaltyPaidPaise: {
      type: Number,
      min: 0,
      validate: {
        validator: (val) => val == null || Number.isInteger(val),
        message: 'Penalty paid must be integer paise',
      },
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: null,
    },
    supportingDocuments: [documentAttachmentSchema],
    statusHistory: [statusHistorySchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

complianceSchema.index({ society: 1, status: 1 });
complianceSchema.index({ society: 1, deadline: 1 });
complianceSchema.index({ society: 1, category: 1 });

// Virtuals
complianceSchema.virtual('isOverdue').get(function () {
  if (['FILED', 'REVISED_FILED'].includes(this.status)) {
    return false;
  }
  return this.deadline && new Date() > this.deadline;
});

complianceSchema.virtual('challanAmountRupees').get(function () {
  return this.challanAmountPaise != null ? this.challanAmountPaise / 100 : null;
});

complianceSchema.virtual('penaltyPaidRupees').get(function () {
  return this.penaltyPaidPaise != null ? this.penaltyPaidPaise / 100 : 0;
});

complianceSchema.virtual('daysRemaining').get(function () {
  if (!this.deadline) return null;
  const now = new Date();
  const diffTime = this.deadline.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

const Compliance = mongoose.model('Compliance', complianceSchema);

export {
  COMPLIANCE_STATUSES,
  COMPLIANCE_CATEGORIES,
  PREPARATION_STATUSES,
  REVIEW_STATUSES,
  DOCUMENTATION_STATUSES,
  DOCUMENT_TYPES,
  COMPLIANCE_DISCLAIMER,
};
export default Compliance;
