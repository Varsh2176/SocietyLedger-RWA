import mongoose from 'mongoose';

/**
 * Document Model
 * Metadata record for files attached to transactions, approvals, events, etc.
 * The actual file bytes are stored separately (filesystem or object storage).
 * This model tracks metadata, verification status, access permissions, and linkage.
 */
const DOCUMENT_CATEGORIES = [
  'INVOICE_RECEIPT',
  'QUOTATION',
  'BANK_STATEMENT',
  'AUDIT_REPORT',
  'STATUTORY_COMPLIANCE',
  'COMMITTEE_RESOLUTION',
  'UTILITY_BILL',
  'CONTRACT',
  'IDENTITY_DOCUMENT',
  'OTHER',
];

const DOCUMENT_VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

const documentSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
      maxlength: [300, 'Document name cannot exceed 300 characters'],
    },
    category: {
      type: String,
      required: [true, 'Document category is required'],
      enum: {
        values: DOCUMENT_CATEGORIES,
        message: 'Category must be one of: ' + DOCUMENT_CATEGORIES.join(', '),
      },
    },
    mimeType: {
      type: String,
      trim: true,
      default: 'application/octet-stream',
    },
    // Size in bytes
    sizeBytes: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Storage path or key (never exposed to untrusted clients directly)
    storagePath: {
      type: String,
      trim: true,
      required: [true, 'Storage path is required'],
      select: false, // Not returned in standard queries
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader reference is required'],
    },
    verificationStatus: {
      type: String,
      enum: DOCUMENT_VERIFICATION_STATUSES,
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
    // Whether residents can see this document via transparency portal
    isPublishedToResidents: {
      type: Boolean,
      default: false,
    },
    // Related entity linkages
    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    relatedApproval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Approval',
      default: null,
    },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    relatedCompliance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Compliance',
      default: null,
    },
    // Human-readable entity description, e.g. 'VR-2026-089'
    relatedEntityDescription: {
      type: String,
      trim: true,
      maxlength: [200, 'Entity description cannot exceed 200 characters'],
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.storagePath;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

documentSchema.index({ society: 1, category: 1 });
documentSchema.index({ society: 1, verificationStatus: 1 });
documentSchema.index({ society: 1, isPublishedToResidents: 1 });
documentSchema.index({ society: 1, uploadedBy: 1 });

// Virtual: human-readable file size
documentSchema.virtual('sizeDisplay').get(function () {
  if (this.sizeBytes < 1024) return `${this.sizeBytes} B`;
  if (this.sizeBytes < 1024 * 1024) return `${(this.sizeBytes / 1024).toFixed(1)} KB`;
  return `${(this.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
});

const Document = mongoose.model('Document', documentSchema);
export { DOCUMENT_CATEGORIES };
export default Document;
