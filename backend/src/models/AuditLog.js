import mongoose from 'mongoose';

/**
 * AuditLog Model
 * Immutable ledger of every significant state-changing action in the system.
 * Records are append-only. No update or delete operations are permitted.
 * Actor, action, entity, IP, and timestamp are always captured.
 */
const auditLogSchema = new mongoose.Schema(
  {
    society: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: [true, 'Society reference is required'],
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor reference is required'],
    },
    // e.g. 'CREATE_VOUCHER', 'APPROVE_EXPENSE', 'RECONCILE_TRANSACTION', 'LOGIN'
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      uppercase: true,
      maxlength: [100, 'Action cannot exceed 100 characters'],
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true,
      uppercase: true,
      // e.g. 'TRANSACTION', 'APPROVAL', 'EVENT', 'USER', 'FUND', 'COMPLIANCE'
      maxlength: [50, 'Entity type cannot exceed 50 characters'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    entityRef: {
      // Human-readable reference, e.g. voucher number 'VR-2026-089'
      type: String,
      trim: true,
      maxlength: [100, 'Entity reference cannot exceed 100 characters'],
      default: null,
    },
    details: {
      type: String,
      trim: true,
      maxlength: [2000, 'Details cannot exceed 2000 characters'],
      default: null,
    },
    // Snapshot of changed values for financial integrity
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [300, 'User agent cannot exceed 300 characters'],
      default: null,
    },
    severity: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW', 'INFO'],
      default: 'INFO',
    },
  },
  {
    // Use createdAt from timestamps; updatedAt is intentionally excluded
    timestamps: { createdAt: 'timestamp', updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Efficient queries for audit trail viewing
auditLogSchema.index({ society: 1, timestamp: -1 });
auditLogSchema.index({ society: 1, actor: 1, timestamp: -1 });
auditLogSchema.index({ society: 1, entityType: 1, entityId: 1 });
auditLogSchema.index({ society: 1, action: 1 });

// Prevent all mutations on audit log records
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit log entries are immutable and cannot be modified'));
  }
  next();
});
auditLogSchema.pre('updateOne', function (next) {
  next(new Error('Audit log entries cannot be updated'));
});
auditLogSchema.pre('findOneAndUpdate', function (next) {
  next(new Error('Audit log entries cannot be updated'));
});
auditLogSchema.pre('deleteOne', function (next) {
  next(new Error('Audit log entries cannot be deleted'));
});
auditLogSchema.pre('findOneAndDelete', function (next) {
  next(new Error('Audit log entries cannot be deleted'));
});
auditLogSchema.pre('deleteMany', function (next) {
  next(new Error('Audit log entries cannot be bulk deleted'));
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
