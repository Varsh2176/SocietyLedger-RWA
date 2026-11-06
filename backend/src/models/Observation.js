import mongoose from 'mongoose';

/**
 * AuditObservation Model
 * Tracks formal auditor findings, control discrepancies, and corrective actions.
 * Distinguishes automated rule-based flags from verified auditor observations.
 * Never asserts fraud merely because a discrepancy exists.
 */
const OBSERVATION_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const OBSERVATION_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED'];
const OBSERVATION_CATEGORIES = [
  'RECONCILIATION_VARIANCE',
  'BUDGET_OVERRUN',
  'MISSING_VOUCHER_DOCUMENT',
  'DUPLICATE_INVOICE',
  'INTERNAL_CONTROL',
  'STATUTORY_FILING',
  'OTHER',
];

const observationSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Observation title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },
    category: {
      type: String,
      enum: {
        values: OBSERVATION_CATEGORIES,
        message: 'Category must be one of: ' + OBSERVATION_CATEGORIES.join(', '),
      },
      default: 'INTERNAL_CONTROL',
    },
    severity: {
      type: String,
      enum: {
        values: OBSERVATION_SEVERITIES,
        message: 'Severity must be one of: ' + OBSERVATION_SEVERITIES.join(', '),
      },
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: {
        values: OBSERVATION_STATUSES,
        message: 'Status must be one of: ' + OBSERVATION_STATUSES.join(', '),
      },
      default: 'OPEN',
      index: true,
    },
    finding: {
      type: String,
      required: [true, 'Detailed finding description is required'],
      trim: true,
      maxlength: [3000, 'Finding cannot exceed 3000 characters'],
    },
    riskDescription: {
      type: String,
      trim: true,
      maxlength: [2000, 'Risk description cannot exceed 2000 characters'],
      default: null,
    },
    recommendation: {
      type: String,
      trim: true,
      maxlength: [2000, 'Recommendation cannot exceed 2000 characters'],
      default: null,
    },
    managementResponse: {
      type: String,
      trim: true,
      maxlength: [2000, 'Management response cannot exceed 2000 characters'],
      default: null,
    },
    correctiveAction: {
      type: String,
      trim: true,
      maxlength: [2000, 'Corrective action cannot exceed 2000 characters'],
      default: null,
    },
    responsiblePerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    auditor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Auditor reference is required'],
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
    relatedEntityRef: {
      type: String,
      trim: true,
      maxlength: [100, 'Reference cannot exceed 100 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

observationSchema.index({ society: 1, status: 1 });
observationSchema.index({ society: 1, severity: 1 });

const Observation = mongoose.model('Observation', observationSchema);
export {
  OBSERVATION_SEVERITIES,
  OBSERVATION_STATUSES,
  OBSERVATION_CATEGORIES,
};
export default Observation;
